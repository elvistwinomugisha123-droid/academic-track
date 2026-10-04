"""Build the private curriculum source registry from the supplied NCDC PDFs.

The raw PDFs and generated registry remain under gitignored ``knowledge-sources``.
This script records document identity and provenance only; it does not assign a
curriculum expiry date or infer facts that are not present in the source files.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import fitz


ROOT = Path(__file__).resolve().parents[1]
RAW_ROOT = ROOT / "knowledge-sources" / "raw"
REGISTRY_PATH = ROOT / "knowledge-sources" / "derived" / "manifests" / "source-registry.json"

CATALOG_PATH = ROOT / "knowledge-tools" / "catalog" / "pilot-source-catalog.json"
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
    }


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    authority = catalog["authority"]
    if authority != AUTHORITY:
        raise ValueError(f"Unsupported source authority in {CATALOG_PATH.relative_to(ROOT)}: {authority}")
    records: list[dict[str, Any]] = []
    for entry in catalog["entries"]:
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
    for source in catalog["shared_sources"]:
        records.append(
            record(
                RAW_ROOT / source["relative_path"],
                education_level=source["education_level"],
                subject=None,
                document_type=source["document_type"],
                publication_year=source["publication_year"],
            )
        )

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
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: registry[key] for key in ("source_file_count", "unique_document_count", "duplicate_aliases")}, indent=2))


if __name__ == "__main__":
    main()
