"""Build the private curriculum source registry from the supplied NCDC PDFs.

The raw PDFs and generated registry remain under gitignored ``knowledge-sources``.
This script records document identity and provenance only; it does not assign a
curriculum expiry date or infer facts that are not present in the source files.
"""

from __future__ import annotations

import hashlib
import json
import argparse
from pathlib import Path
from typing import Any

import fitz


ROOT = Path(__file__).resolve().parents[1]
RAW_ROOT = ROOT / "knowledge-sources" / "raw"
REGISTRY_PATH = ROOT / "knowledge-sources" / "derived" / "manifests" / "source-registry.json"

CATALOG_PATH = ROOT / "knowledge-tools" / "catalog" / "pilot-source-catalog.json"
PILOT_AUTHORIZATION_PATH = ROOT / "knowledge-tools" / "catalog" / "pilot-operator-authorization.json"
AUTHORITY = "National Curriculum Development Centre (NCDC)"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slug(value: str) -> str:
    return "-".join("".join(character.lower() if character.isalnum() else " " for character in value).split())


def record(
    path: Path,
    *,
    education_level: str,
    subject: str | None,
    document_type: str,
    publication_year: int | None,
) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"Expected curriculum source is missing: {path.relative_to(ROOT)}")
    checksum = sha256_file(path)
    with fitz.open(path) as document:
        page_count = document.page_count
    title = (
        "Advanced Secondary Curriculum Assessment Framework"
        if document_type == "assessment-framework"
        else "Principle Mathematics Assessment Guidelines"
        if path.name == "Principle-Mathematics-Assessment-Guidelines-01.04.Web_File.pdf"
        else f"{subject} {'Assessment Guidelines' if document_type == 'assessment-guidelines' else 'Learner Book' if document_type == 'learner-book' else 'Syllabus'}"
    )
    identifier = f"ncdc-{education_level}-{slug(subject or 'curriculum')}-{publication_year or 'undated'}-{checksum[:10]}"
    return {
        "source_id": identifier,
        "authority": AUTHORITY,
        "title": title,
        "document_type": document_type,
        "education_level": education_level,
        "subject": subject,
        "publication_year": publication_year,
        "effective_year": None,
        "version": None,
        "rights_status": "UNKNOWN",
        "checksum_sha256": checksum,
        "page_count": page_count,
        "local_path": path.relative_to(ROOT).as_posix(),
        "original_filename": path.name,
        "classification_confidence": "HIGH",
        "subject_mapping_evidence": "Body pages 8, 11, 43, 44 and 50 explicitly name Principal Mathematics" if path.name == "Principle-Mathematics-Assessment-Guidelines-01.04.Web_File.pdf" else None,
    }


PILOT_SUBJECTS = {
    ("lower-secondary", "Mathematics"),
    ("lower-secondary", "Chemistry"),
    ("advanced-secondary", "Chemistry"),
    ("advanced-secondary", "Principal Mathematics"),
}


def select_sources(catalog: dict[str, Any], scope: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if scope == "all":
        return catalog["entries"], catalog["shared_sources"]
    entries = [entry for entry in catalog["entries"] if (entry["education_level"], entry["subject"]) in PILOT_SUBJECTS]
    if {(entry["education_level"], entry["subject"]) for entry in entries} != PILOT_SUBJECTS:
        raise ValueError("Pilot source catalogue is missing a required subject/level entry")
    shared = [source for source in catalog["shared_sources"] if source["education_level"] == "advanced-secondary" and source["document_type"] == "assessment-framework"]
    if len(shared) != 1:
        raise ValueError("Pilot source catalogue must contain one Advanced Secondary assessment framework")
    return entries, shared


def available_pilot_sources(entries: list[dict[str, Any]], shared: list[dict[str, Any]], raw_root: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    missing_framework = [source["relative_path"] for source in shared if not (raw_root / source["relative_path"]).is_file()]
    selected, blocked = [], []
    for entry in entries:
        missing = [source["relative_path"] for source in entry["sources"] if not (raw_root / source["relative_path"]).is_file()]
        if entry["education_level"] == "advanced-secondary":
            missing += missing_framework
        if missing:
            blocked.append({"education_level": entry["education_level"], "subject": entry["subject"], "missing_sources": missing})
        else:
            selected.append(entry)
    available_shared = shared if not missing_framework and any(entry["education_level"] == "advanced-secondary" for entry in selected) else []
    return selected, available_shared, blocked


def apply_pilot_authorization(records: list[dict[str, Any]], authorization: dict[str, Any]) -> None:
    if authorization.get("state") != "OPERATOR_AUTHORIZED_FOR_PILOT" or not authorization.get("decision_source"):
        raise ValueError("An explicit operator pilot authorization record is required")
    authorized = {item["relative_path"]: item["sha256"] for item in authorization["sources"]}
    if len(authorized) != len(authorization["sources"]):
        raise ValueError("Pilot authorization has duplicate source paths")
    for item in records:
        relative_path = item["local_path"].removeprefix("knowledge-sources/raw/")
        if authorized.get(relative_path) != item["checksum_sha256"]:
            raise ValueError(f"No matching checksum-bound operator authorization: {relative_path}")
        item.update({
            "rights_status": "OPERATOR_AUTHORIZED_FOR_PILOT",
            "production_use_status": "PERMITTED",
            "external_ai_allowed": True,
            "formal_artifact_allowed": True,
            "export_allowed": True,
            "attribution_required": True,
            "authorization_reference": authorization["decision_source"],
        })


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", choices=("all", "pilot-math-chem"), default="all")
    args = parser.parse_args()
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    authority = catalog["authority"]
    if authority != AUTHORITY:
        raise ValueError(f"Unsupported source authority in {CATALOG_PATH.relative_to(ROOT)}: {authority}")
    records: list[dict[str, Any]] = []
    entries, shared_sources = select_sources(catalog, args.scope)
    blocked_subjects: list[dict[str, Any]] = []
    if args.scope == "pilot-math-chem":
        entries, shared_sources, blocked_subjects = available_pilot_sources(entries, shared_sources, RAW_ROOT)
    for entry in entries:
        for source in entry["sources"]:
            records.append(
                record(
                    RAW_ROOT / source["relative_path"],
                    education_level=entry["education_level"],
                    subject=entry["subject"],
                    document_type=source["document_type"],
                    publication_year=source["publication_year"],
                )
            )
    for source in shared_sources:
        records.append(
            record(
                RAW_ROOT / source["relative_path"],
                education_level=source["education_level"],
                subject=None,
                document_type=source["document_type"],
                publication_year=source["publication_year"],
            )
        )

    if args.scope == "pilot-math-chem":
        authorization = json.loads(PILOT_AUTHORIZATION_PATH.read_text(encoding="utf-8"))
        apply_pilot_authorization(records, authorization)

    canonical_by_checksum: dict[str, str] = {}
    duplicate_aliases: list[dict[str, str]] = []
    canonical_records: list[dict[str, Any]] = []
    for item in records:
        checksum = item["checksum_sha256"]
        canonical_id = canonical_by_checksum.get(checksum)
        if canonical_id:
            duplicate_aliases.append(
                {
                    "canonical_source_id": canonical_id,
                    "duplicate_path": item["local_path"],
                    "reason": "identical-sha256",
                }
            )
            continue
        canonical_by_checksum[checksum] = item["source_id"]
        canonical_records.append(item)

    registry = {
        "schema_version": "ate-source-registry-v2",
        "authority": authority,
        "source_file_count": len(records),
        "unique_document_count": len(canonical_records),
        "duplicate_aliases": duplicate_aliases,
        "records": sorted(canonical_records, key=lambda item: item["source_id"]),
    }
    if args.scope != "all":
        registry["scope"] = args.scope
        registry["blocked_subjects"] = blocked_subjects
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: registry[key] for key in ("source_file_count", "unique_document_count", "duplicate_aliases", "blocked_subjects") if key in registry}, indent=2))


if __name__ == "__main__":
    main()
