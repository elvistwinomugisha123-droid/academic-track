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

AUTHORITY = "National Curriculum Development Centre (NCDC)"

O_LEVEL: dict[str, tuple[str, str, int | None]] = {
    "AGRIC_SYLLABUS_compressed.pdf": ("Agriculture", "syllabus", 2019),
    "Biology_Syllabus_compressed (1).pdf": ("Biology", "syllabus", 2019),
    "Biology_Syllabus_compressed.pdf": ("Biology", "syllabus", 2019),
    "CRE_syllabus_compressed.pdf": ("Christian Religious Education", "syllabus", 2019),
    "ENGLISH_SYLLABUS_compressed.pdf": ("English Language", "syllabus", 2019),
    "ENTREPRENEURSHIP_SYLLABUS_compressed.pdf": ("Entrepreneurship Education", "syllabus", 2019),
    "Georgraphy-Syllabus.pdf": ("Geography", "syllabus", None),
    "Olevel-History-syllabus-June-2023.pdf": ("History and Political Education", "syllabus", 2019),
    "HISTORY-AND-POLITICAL-EDUCATION-S.4-LEARNERS-BOOK-FINAL-07.11.2021_Web-file.pdf": (
        "History and Political Education",
        "learner-book",
        2021,
    ),
    "LITERATURE_SYLLABUS.pdf": ("Literature in English", "syllabus", 2019),
    "Mathematics_Syllabus_compressed.pdf": ("Mathematics", "syllabus", 2019),
    "PHYSICS_Syllabus_compressed.pdf": ("Physics", "syllabus", 2019),
    "chemistry syllbus.pdf": ("Chemistry", "syllabus", 2019),
}

A_LEVEL: dict[str, str] = {
    "Agriculture.pdf": "Agriculture",
    "Art & Design.pdf": "Art and Design",
    "Biology.pdf": "Biology",
    "CHEMISTRY.pdf": "Chemistry",
    "CRE SYLLABUS.pdf": "Christian Religious Education",
    "Economics.pdf": "Economics",
    "Entrepreneurship.pdf": "Entrepreneurship Education",
    "General Paper.pdf": "General Paper",
    "Geography.pdf": "Geography",
    "HISTORY.pdf": "History",
    "Kiswahili.pdf": "Kiswahili",
    "Literature in English.pdf": "Literature in English",
    "Local Languages Framework.pdf": "Local Languages",
    "MUSIC.pdf": "Music",
    "PRINCIPAL MATHS.pdf": "Principal Mathematics",
    "Physics.pdf": "Physics",
    "SUBSIDIARY MATHEMATICS.pdf": "Subsidiary Mathematics",
    "Subsidiary ICT.pdf": "Subsidiary ICT",
    "TEchnical Drawing.pdf": "Technical Drawing",
}

ASSESSMENT: dict[str, str | None] = {
    "ASSESSMENT-FRAMEWORK-FOR-ADVANCED-SECONDARY-CURRICULUM-2026_Web-file.pdf": None,
    "Agriculture-Assessment-Guidelines-01.04.Web_File.pdf": "Agriculture",
    "Art-Design_Assessment-Guidelines-24.02.Web_File.pdf": "Art and Design",
    "Biology-Assessment-Guidelines_Final-edit-13.05.2026_Web-file.pdf": "Biology",
    "CRE-Assessment-Guidelines_Final-edit-16.04.2026_Web-file.pdf": "Christian Religious Education",
    "Chemistry-Assessment-Guidelines-01.04.Web_File.pdf": "Chemistry",
    "Economics-Assessment-Guidelines_Final-edit-20.04.2026_Web-file.pdf": "Economics",
    "Entrepreneurship-Education-Assessment-Guidelines_Final-edit-21.04.2026_Web-file-2-1.pdf": "Entrepreneurship Education",
    "General-Paper-Assessment-Guidelines_Final-edit-24.07.2026_Web-file.pdf": "General Paper",
    "Geography-Assessment-Guidelines_Approved-Final-14.05.2026_Web-file.pdf": "Geography",
    "ICT-Assessment-Guidelines-01.04.Web_File.pdf": "Subsidiary ICT",
    "Literature-Assessment-Guidelines-01.04.Web_File.pdf": "Literature in English",
    "Local-Languages-Assessment-Guidelines_Final-edit-20.04.2026_Web-file.pdf": "Local Languages",
    "Physics-Assessment-Guidelines_Final-edit-15.04.2026_Web-file.pdf": "Physics",
    "Principle-Mathematics-Assessment-Guidelines-01.04.Web_File.pdf": "Principal Mathematics",
}


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
    records: list[dict[str, Any]] = []
    for filename, (subject, document_type, publication_year) in O_LEVEL.items():
        records.append(
            record(
                RAW_ROOT / "o-level" / filename,
                education_level="lower-secondary",
                subject=subject,
                document_type=document_type,
                publication_year=publication_year,
            )
        )
    for filename, subject in A_LEVEL.items():
        records.append(
            record(
                RAW_ROOT / "a-level" / filename,
                education_level="advanced-secondary",
                subject=subject,
                document_type="syllabus",
                publication_year=2025,
            )
        )
    for filename, subject in ASSESSMENT.items():
        records.append(
            record(
                RAW_ROOT / "a-level-assessment" / filename,
                education_level="advanced-secondary",
                subject=subject,
                document_type="assessment-framework" if subject is None else "assessment-guidelines",
                publication_year=2026,
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
        "authority": AUTHORITY,
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
