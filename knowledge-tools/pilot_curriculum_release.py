"""Build checksum-bound curriculum-only pilot releases from the seven-source corpus.

The founder's decision governs a *specific* extracted dataset. Candidates remain
review-required in the general corpus. This module admits syllabus records to the
controlled pilot only after independent source, page, hierarchy and relationship
checks; assessment records are never promoted by this decision.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

import fitz

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "knowledge-sources/derived"
DECISION = ROOT / "knowledge-tools/catalog/pilot-curriculum-verification.json"
OUTPUT = DERIVED / "releases"
NAMESPACE = uuid.UUID("ab22a0e7-2f33-4cf8-a772-843b11742f64")
SYLLABI = {
    "ncdc-lower-secondary-mathematics-2019-83e3739a34": ("A", "Mathematics", "lower-secondary"),
    "ncdc-lower-secondary-chemistry-2019-176ad60b42": ("A", "Chemistry", "lower-secondary"),
    "ncdc-advanced-secondary-chemistry-2025-a6f0531fb4": ("B", "Chemistry", "advanced-secondary"),
    "ncdc-advanced-secondary-principal-mathematics-2025-9f06a325b7": ("B", "Principal Mathematics", "advanced-secondary"),
}
RELATION_TYPES = {
    "SOURCE_DEFINES_ENTITY", "belongs_to_topic", "belongs_to_subject",
    "belongs_to_theme", "belongs_to_term", "belongs_to_level",
    "associated_with_topic", "associated_with_subject", "suggested_for_topic",
    "maps_to_detailed_topic", "SUBJECT_CONTAINS_TOPIC", "TOPIC_CONTAINS_OUTCOME",
}


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def canonical_record_id(source_id: str, source_checksum: str, candidate_id: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{source_id}:{source_checksum}:{candidate_id}"))


def rows(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def curriculum_dataset_checksum(records: list[dict[str, Any]], relationships: list[dict[str, Any]]) -> str:
    return digest({"records": sorted((item for item in records if item["provenance"]["sourceId"] in SYLLABI), key=lambda item: item["id"]),
                   "relationships": sorted((item for item in relationships if item["provenance"]["sourceId"] in SYLLABI), key=lambda item: item["id"])})


def tokens(value: str) -> Counter[str]:
    return Counter(re.findall(r"[a-z0-9]+", value.lower()))


def verify_records(records: list[dict[str, Any]], relationships: list[dict[str, Any]],
                   registry: dict[str, dict[str, Any]], review: list[dict[str, Any]],
                   decision: dict[str, Any]) -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[dict[str, Any]]]]:
    if decision.get("state") != "OPERATOR_VERIFIED_FOR_PILOT" or decision.get("scope") != "CONTROLLED_PILOT_CURRICULUM_ONLY":
        raise ValueError("No explicit controlled-pilot curriculum verification decision")
    if set(decision.get("sourceChecksums", {})) != set(SYLLABI):
        raise ValueError("Operator decision must name exactly the four approved syllabuses")
    if any(item["sourceId"] in SYLLABI and item["status"] == "open" for item in review):
        raise ValueError("A syllabus review item remains open")
    grouped: dict[str, list[dict[str, Any]]] = {key: [] for key in SYLLABI}
    links: dict[str, list[dict[str, Any]]] = {key: [] for key in SYLLABI}
    document_cache: dict[str, fitz.Document] = {}
    page_cache: dict[tuple[str, int, int], Counter[str]] = {}
    try:
        for source_id in SYLLABI:
            source = registry.get(source_id)
            _, expected_subject, expected_level = SYLLABI[source_id]
            if (not source or source.get("document_type") != "syllabus"
                    or source.get("authority") != "National Curriculum Development Centre (NCDC)"
                    or source.get("subject") != expected_subject
                    or source.get("education_level") != expected_level
                    or source.get("rights_status") != "OPERATOR_AUTHORIZED_FOR_PILOT"):
                raise ValueError(f"Unapproved or missing syllabus: {source_id}")
            expected = decision["sourceChecksums"][source_id]
            physical = hashlib.sha256((ROOT / source["local_path"]).read_bytes()).hexdigest()
            if expected != source["checksum_sha256"] or expected != physical:
                raise ValueError(f"Stale or mismatched source checksum: {source_id}")
            document_cache[source_id] = fitz.open(ROOT / source["local_path"])
        by_id: dict[str, dict[str, Any]] = {}
        for item in records:
            source_id = item["provenance"]["sourceId"]
            if source_id not in SYLLABI:
                continue
            if item["id"] in by_id:
                raise ValueError(f"Duplicate curriculum record ID: {item['id']}")
            provenance = item["provenance"]
            first, last = provenance["pageStart"], provenance["pageEnd"]
            document = document_cache[source_id]
            if not (1 <= first <= last <= len(document)) or provenance["spanId"] != f"{source_id}:p{first}":
                raise ValueError(f"Broken page provenance: {item['id']}")
            if not provenance.get("locator") or not item["sourceWording"].get("text"):
                raise ValueError(f"Missing source wording/locator: {item['id']}")
            if item["entityType"] in ("topic", "subtopic"):
                period_match = re.search(r"\b(\d+)\s+PERIODS\b", item["sourceWording"]["text"], re.I)
                if not period_match:
                    period_match = re.search(r"\bPERIODS\s+(\d+)\b", item["sourceWording"]["text"], re.I)
                if not period_match and item["entityType"] == "subtopic":
                    blocks = document[first - 1].get_text("blocks", sort=True)
                    block_number = item["extracted"].get("blockNumber")
                    if isinstance(block_number, int) and 0 < block_number <= len(blocks):
                        anchor = blocks[block_number - 1]
                        for following in blocks[block_number:block_number + 3]:
                            if abs(following[1] - anchor[1]) >= 35:
                                continue
                            period_match = re.fullmatch(r"Duration:\s*(\d+)\s+Periods?", " ".join(following[4].split()), re.I)
                            if period_match:
                                break
                if not period_match or item["normalized"].get("periods") != int(period_match.group(1)):
                    raise ValueError(f"Period allocation differs from the cited heading: {item['id']}")
            key = source_id, first, last
            if key not in page_cache:
                page_cache[key] = tokens(" ".join(document[number - 1].get_text() for number in range(first, last + 1)))
            source_tokens = page_cache[key]
            record_tokens = tokens(item["sourceWording"]["text"])
            if not record_tokens or any(count > source_tokens[token] for token, count in record_tokens.items()):
                raise ValueError(f"Wording absent from cited PDF page: {item['id']}")
            method = item.get("extracted", {}).get("method")
            parser_version = item.get("extracted", {}).get("parserVersion")
            if not method or not parser_version or parser_version not in decision.get("parserVersions", []):
                raise ValueError(f"Unapproved parser version: {item['id']}")
            grouped[source_id].append(item)
            by_id[item["id"]] = item
        for source_id, items in grouped.items():
            if not items or not any(item["entityType"] == "topic" for item in items):
                raise ValueError(f"Empty syllabus profile: {source_id}")
            for item in items:
                parent = item["normalized"].get("parentId")
                if parent is not None and (parent not in by_id or by_id[parent]["provenance"]["sourceId"] != source_id):
                    raise ValueError(f"Detached or cross-source parent: {item['id']}")
                if item["entityType"] == "subtopic" and (parent is None or by_id[parent]["entityType"] != "topic"):
                    raise ValueError(f"Subtopic has no topic parent: {item['id']}")
        for rel in relationships:
            source_id = rel["provenance"]["sourceId"]
            if source_id not in SYLLABI:
                continue
            if rel["relationshipType"] not in RELATION_TYPES:
                raise ValueError(f"Unknown syllabus relationship type: {rel['id']}")
            child = by_id.get(rel["toId"])
            parent = by_id.get(rel["fromId"])
            if child is None or child["provenance"]["sourceId"] != source_id:
                raise ValueError(f"Dangling/cross-source relationship child: {rel['id']}")
            if rel["relationshipType"] == "SOURCE_DEFINES_ENTITY":
                if rel["fromId"] != source_id:
                    raise ValueError(f"Wrong source relationship: {rel['id']}")
            elif parent is None or parent["provenance"]["sourceId"] != source_id:
                raise ValueError(f"Dangling/cross-source relationship parent: {rel['id']}")
            if rel["provenance"]["spanId"] != child["provenance"]["spanId"]:
                raise ValueError(f"Relationship page differs from child: {rel['id']}")
            if rel["relationshipType"] == "belongs_to_topic" and child["normalized"].get("parentId") != rel["fromId"]:
                raise ValueError(f"Relationship parent differs from record: {rel['id']}")
            # Source ownership is already canonical in record.source_id and
            # release-source membership. It is not a record-to-record edge.
            if rel["relationshipType"] != "SOURCE_DEFINES_ENTITY":
                links[source_id].append(rel)
        for source_id, items in grouped.items():
            parent_links = Counter(rel["toId"] for rel in links[source_id] if rel["relationshipType"] == "belongs_to_topic")
            for item in items:
                expected = 0 if item["entityType"] == "topic" else 1
                if parent_links[item["id"]] != expected:
                    raise ValueError(f"Missing or duplicate parent relationship: {item['id']}")
        return grouped, links
    finally:
        for document in document_cache.values():
            document.close()


def build() -> list[dict[str, Any]]:
    decision = json.loads(DECISION.read_text())
    registry = {item["source_id"]: item for item in json.loads((DERIVED / "manifests/source-registry.json").read_text())["records"]}
    validation = json.loads((ROOT / "knowledge-sources/review/validation/knowledge-dataset-validation.json").read_text())
    review = json.loads((ROOT / "knowledge-sources/review/human-review/review-queue.json").read_text())["items"]
    if not validation["valid"] or validation["errors"] or validation["warnings"]:
        raise ValueError("Structural validation is not clean")
    records = rows(DERIVED / "structured/curriculum-items.jsonl")
    relationships = rows(DERIVED / "structured/curriculum-relationships.jsonl")
    dataset_checksum = curriculum_dataset_checksum(records, relationships)
    if dataset_checksum != decision.get("datasetChecksumSha256"):
        raise ValueError("Curriculum dataset changed since the operator decision")
    grouped, links = verify_records(records, relationships, registry, review, decision)
    release_manifests = []
    for release_key, title, level in (("A", "Lower Secondary Curriculum 2019", "lower-secondary"),
                                      ("B", "Advanced Secondary Curriculum 2025", "advanced-secondary")):
        source_ids = [source_id for source_id, (key, _, _) in SYLLABI.items() if key == release_key]
        release_id = str(uuid.uuid5(NAMESPACE, "pilot-curriculum-release:" + release_key + ":" + dataset_checksum))
        profiles = []
        for source_id in source_ids:
            _, subject, _ = SYLLABI[source_id]
            items = grouped[source_id]
            ordered_items = sorted(items, key=lambda item: (item["provenance"]["pageStart"],
                item["extracted"].get("yStart", item["extracted"].get("blockNumber", 0)), item["id"]))
            profile = {"profileId": str(uuid.uuid5(NAMESPACE, "pilot-profile:" + source_id + ":" + dataset_checksum)),
                       "subject": subject, "educationLevel": level, "sourceId": source_id,
                       "recordIds": sorted(item["id"] for item in items),
                       "orderedRecordIds": [item["id"] for item in ordered_items],
                       "canonicalRecordIds": sorted(canonical_record_id(source_id, decision["sourceChecksums"][source_id], item["id"]) for item in items),
                       "orderedCanonicalRecordIds": [canonical_record_id(source_id, decision["sourceChecksums"][source_id], item["id"]) for item in ordered_items],
                       "relationshipIds": sorted(item["id"] for item in links[source_id]),
                       "countsByType": dict(sorted(Counter(item["entityType"] for item in items).items())),
                       "readiness": "CURRICULUM_RUNTIME_READY"}
            profile["profileChecksumSha256"] = digest(profile)
            profiles.append(profile)
        manifest = {"schemaVersion": "ate-pilot-curriculum-release-v1", "releaseId": release_id,
                    "releaseKey": release_key, "title": title, "educationLevel": level,
                    "effectiveFrom": None, "effectiveTo": None,
                    "curriculumReadiness": "CURRICULUM_RUNTIME_READY",
                    "assessmentReadiness": "ASSESSMENT_RUNTIME_NOT_READY",
                    "assessmentRuntimeRecordIds": [],
                    "operatorVerificationDecisionId": str(uuid.uuid5(NAMESPACE, decision["decisionId"] + ":release:" + release_key)),
                    "operatorVerificationSourceDecisionId": decision["decisionId"],
                    "operatorVerificationDecisionSha256": digest(decision),
                    "datasetChecksumSha256": dataset_checksum,
                    "sourceMemberships": [{"sourceId": source_id, "sha256": decision["sourceChecksums"][source_id],
                                           "rightsState": "OPERATOR_AUTHORIZED_FOR_PILOT", "role": "SUBJECT_SYLLABUS"}
                                          for source_id in source_ids],
                    "profiles": profiles}
        manifest["manifestChecksumSha256"] = digest(manifest)
        release_manifests.append(manifest)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for manifest in release_manifests:
        (OUTPUT / f"release-{manifest['releaseKey'].lower()}.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return release_manifests


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    for release in build():
        print(release["releaseKey"], release["releaseId"], release["manifestChecksumSha256"],
              [(profile["subject"], len(profile["recordIds"]), len(profile["relationshipIds"])) for profile in release["profiles"]])
