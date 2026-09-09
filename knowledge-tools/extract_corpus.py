"""Extract the private ATE source corpus into provenance-preserving JSON/JSONL.

The script deliberately emits candidates, not verified curriculum facts. It is
safe to rerun: output IDs are derived from source IDs and physical PDF pages.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import fitz
except ImportError as error:
    raise SystemExit("PyMuPDF is required. Install it with: .venv\\Scripts\\python -m pip install PyMuPDF") from error


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "knowledge-sources" / "derived" / "manifests" / "source-registry.json"
OUTPUT_ROOT = ROOT / "knowledge-sources" / "derived" / "structured"
SPANS_ROOT = ROOT / "knowledge-sources" / "derived" / "source-spans"
REVIEW_ROOT = ROOT / "knowledge-sources" / "review"
PARSER_VERSION = "ate-corpus-extractor-1.0.0"

HEADING_RE = re.compile(r"^(?:\d+(?:\.\d+){0,5}[.)]?\s+)?[A-Z][A-Za-z0-9 ,:;()&/'-]{2,140}$")
OUTCOME_RE = re.compile(r"\b(learning outcome|outcome|competenc|objective|ability|indicator|assessment objective|performance descriptor)\b", re.I)
TOPIC_RE = re.compile(r"\b(topic|sub[- ]?topic|theme|strand|content area)\b", re.I)
ASSESSMENT_RE = re.compile(r"\b(assessment|construct|rubric|scor(?:e|ing)|paper structure|examination|formative|summative)\b", re.I)


def slug(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", value.lower())).strip("-") or "unclassified"


def normalise(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def json_dump(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def jsonl_dump(path: Path, values: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n" for value in values), encoding="utf-8")


def source_metadata(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceId": record["source_id"], "authority": record["authority"], "title": record["title"],
        "documentType": record["document_type"], "educationLevel": record["education_level"],
        "subject": record.get("subject"), "publicationYear": record.get("publication_year"),
        "effectiveYear": record.get("effective_year"), "version": record.get("version"),
        "rightsStatus": "REVIEW_REQUIRED", "checksumSha256": record["checksum_sha256"],
        "sourcePath": record["local_path"],
    }


def page_lines(page: Any) -> list[str]:
    lines = []
    for block in page.get_text("blocks", sort=True):
        if len(block) > 4:
            text = normalise(block[4])
            if text:
                lines.append(text)
    return lines


def candidate_kind(text: str, document_type: str) -> str | None:
    if OUTCOME_RE.search(text):
        return "learning_outcome" if document_type == "syllabus" else "assessment_objective"
    if TOPIC_RE.search(text):
        return "topic"
    if ASSESSMENT_RE.search(text):
        return "assessment_guidance"
    return None


def confidence(text: str) -> str:
    if len(text) < 4 or "\ufffd" in text:
        return "LOW"
    if len(text) > 180:
        return "MEDIUM"
    return "HIGH"


def extract_source(record: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    pdf_path = ROOT / record["local_path"]
    document = fitz.open(pdf_path)
    source = source_metadata(record)
    spans: list[dict[str, Any]] = []
    curriculum_items: list[dict[str, Any]] = []
    assessment_items: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []
    seen = set()

    for index, page in enumerate(document, start=1):
        lines = page_lines(page)
        text = normalise("\n".join(lines))
        span_id = f"{record['source_id']}:p{index}"
        page_confidence = confidence(text)
        spans.append({
            "id": span_id, "source": source, "pageStart": index, "pageEnd": index,
            "locator": f"PDF page {index}", "text": text, "extractionConfidence": page_confidence,
            "verificationStatus": "UNVERIFIED",
        })
        for line_number, line in enumerate(lines, start=1):
            if len(line) < 8 or len(line) > 420:
                continue
            kind = candidate_kind(line, record["document_type"])
            if not kind and HEADING_RE.match(line):
                kind = "topic" if record["document_type"] == "syllabus" else "assessment_guidance"
            if not kind:
                continue
            item_id = f"{record['source_id']}:{kind}:p{index}:l{line_number}"
            fingerprint = (kind, line.lower())
            if fingerprint in seen:
                continue
            seen.add(fingerprint)
            provenance = {"sourceId": record["source_id"], "pageStart": index, "pageEnd": index, "spanId": span_id, "locator": f"PDF page {index}, extracted line {line_number}", "extractionConfidence": confidence(line)}
            normalized = (
                {"subject": record.get("subject"), "educationLevel": record["education_level"], "appliesTo": None, "title": line}
                if kind.startswith("assessment")
                else {"subject": record.get("subject"), "level": None, "term": None, "title": line, "parentId": None}
            )
            item = {
                "id": item_id, "entityType": kind, "sourceWording": {"text": line, "label": None, "language": "en"},
                "normalized": normalized,
                "extracted": {"method": "heading-and-keyword-candidate", "parserVersion": PARSER_VERSION, "candidates": {"lineNumber": line_number}},
                "verificationStatus": "REVIEW_REQUIRED", "provenance": provenance,
            }
            (assessment_items if kind.startswith("assessment") else curriculum_items).append(item)
            relationships.append({"id": f"{record['source_id']}:defines:{item_id}", "relationshipType": "SOURCE_DEFINES_ENTITY", "fromId": record["source_id"], "toId": item_id, "verificationStatus": "UNVERIFIED", "provenance": provenance})
    document.close()
    summary = {"source": source, "pageCount": len(spans), "curriculumCandidateCount": len(curriculum_items), "assessmentCandidateCount": len(assessment_items)}
    return summary, spans, curriculum_items, assessment_items, relationships


def sha256_tree(path: Path) -> str:
    digest = hashlib.sha256()
    for child in sorted(path.rglob("*")):
        if child.is_file():
            digest.update(child.relative_to(path).as_posix().encode())
            digest.update(child.read_bytes())
    return digest.hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        for chunk in iter(lambda: source_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    seen_paths = set()
    records = []
    registry_duplicates = []
    for record in sorted(registry["records"], key=lambda item: item["source_id"]):
        if record["local_path"] in seen_paths:
            registry_duplicates.append(record)
            continue
        seen_paths.add(record["local_path"])
        records.append(record)
    summaries, all_spans, all_curriculum, all_assessment, all_relationships, review_items = [], [], [], [], [], []
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)

    for record in registry_duplicates:
        review_items.append({"id": f"duplicate-registry-path:{record['source_id']}", "severity": "LOW", "status": "open", "sourceId": record["source_id"], "reason": "A registry record points to a canonical file already represented by another source record; it was not extracted twice."})

    for record in records:
        pdf_path = ROOT / record["local_path"]
        if not pdf_path.exists():
            review_items.append({"id": f"missing-source:{record['source_id']}", "severity": "CRITICAL", "status": "open", "sourceId": record["source_id"], "reason": "Registry source file is not available for extraction."})
            continue
        if sha256_file(pdf_path) != record["checksum_sha256"]:
            review_items.append({"id": f"checksum-mismatch:{record['source_id']}", "severity": "CRITICAL", "status": "open", "sourceId": record["source_id"], "reason": "The local PDF checksum does not match the source registry."})
            continue
        summary, spans, curriculum, assessment, relationships = extract_source(record)
        summaries.append(summary); all_spans.extend(spans); all_curriculum.extend(curriculum); all_assessment.extend(assessment); all_relationships.extend(relationships)
        grouped[(record["education_level"], slug(record.get("subject") or "cross-level"))].append(summary)
        if not curriculum and record["document_type"] == "syllabus":
            review_items.append({"id": f"no-curriculum-candidates:{record['source_id']}", "severity": "HIGH", "status": "open", "sourceId": record["source_id"], "reason": "No curriculum candidates were detected; visual/table extraction review is required."})
        if not assessment and record["document_type"] in {"assessment-framework", "assessment-guidelines"}:
            review_items.append({"id": f"no-assessment-candidates:{record['source_id']}", "severity": "HIGH", "status": "open", "sourceId": record["source_id"], "reason": "No assessment candidates were detected; visual/table extraction review is required."})
        if record.get("classification_confidence") != "HIGH":
            review_items.append({"id": f"metadata-review:{record['source_id']}", "severity": "MEDIUM", "status": "open", "sourceId": record["source_id"], "reason": "Source classification was not high confidence in the registry."})

    jsonl_dump(SPANS_ROOT / "source-spans.jsonl", all_spans)
    jsonl_dump(OUTPUT_ROOT / "curriculum-items.jsonl", all_curriculum)
    jsonl_dump(OUTPUT_ROOT / "assessment-items.jsonl", all_assessment)
    jsonl_dump(OUTPUT_ROOT / "curriculum-relationships.jsonl", all_relationships)
    json_dump(OUTPUT_ROOT / "sources.json", {"schemaVersion": "ate-knowledge-v1", "generatedAt": datetime.now(timezone.utc).isoformat(), "sources": summaries})
    for (level, subject), source_summaries in grouped.items():
        subject_root = OUTPUT_ROOT / level / subject
        subject_sources = {item["source"]["sourceId"] for item in source_summaries}
        json_dump(subject_root / "subject-profile.json", {"schemaVersion": "ate-knowledge-v1", "educationLevel": level, "subject": subject, "sources": source_summaries})
        jsonl_dump(subject_root / "curriculum-items.jsonl", [item for item in all_curriculum if item["provenance"]["sourceId"] in subject_sources])
        jsonl_dump(subject_root / "assessment-items.jsonl", [item for item in all_assessment if item["provenance"]["sourceId"] in subject_sources])
        jsonl_dump(subject_root / "curriculum-relationships.jsonl", [item for item in all_relationships if item["provenance"]["sourceId"] in subject_sources])

    review_items.sort(key=lambda item: ({"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}[item["severity"]], item["id"]))
    json_dump(REVIEW_ROOT / "human-review" / "review-queue.json", {"schemaVersion": "ate-knowledge-review-v1", "generatedAt": datetime.now(timezone.utc).isoformat(), "items": review_items})
    manifest = {"schemaVersion": "ate-knowledge-v1", "generatedAt": datetime.now(timezone.utc).isoformat(), "sourceCount": len(summaries), "sourceSpanCount": len(all_spans), "curriculumCandidateCount": len(all_curriculum), "assessmentCandidateCount": len(all_assessment), "relationshipCount": len(all_relationships), "reviewQueueCount": len(review_items), "datasetChecksumSha256": sha256_tree(OUTPUT_ROOT)}
    json_dump(ROOT / "knowledge-sources" / "derived" / "manifests" / "knowledge-dataset-manifest.json", manifest)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
