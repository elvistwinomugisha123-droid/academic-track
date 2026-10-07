"""Checksum-bound page roles for printed specimen sections in pilot guidelines.

These decisions exclude examples from normative assessment profiles; they do
not erase source spans or assert that the example content has been verified.
"""

from __future__ import annotations

from typing import Any

import fitz


EXAMPLE_SECTIONS = {
    "ncdc-advanced-secondary-chemistry-2026-9b0961b964": {
        "checksum": "9b0961b96487040ee3a64509758718a976bbcef82dd2656a3c5c3ba3475eb611",
        "start": 27, "end": 61, "descriptorStart": 62,
        "startEvidence": "UGANDA ADVANCED CERTIFICATE OF EDUCATION",
        "descriptorEvidence": "Performance Level Descriptors",
    },
    "ncdc-advanced-secondary-principal-mathematics-2026-9874365d71": {
        "checksum": "9874365d71881c259d6463ad9b628eed2ffd4c8bd2585844ce41e2cedb20a196",
        "start": 44, "end": 116, "descriptorStart": 117,
        "startEvidence": "SAMPLE EXAMINATION PAPER",
        "descriptorEvidence": "Performance Level Descriptors",
    },
}

BACK_COVERS = {
    "ncdc-advanced-secondary-curriculum-2026-0d48fb4137": ("0d48fb4137672864224f89a77ad9987f058eaa971d2faabc74782ab70bf62cab", 26),
    "ncdc-advanced-secondary-chemistry-2026-9b0961b964": ("9b0961b96487040ee3a64509758718a976bbcef82dd2656a3c5c3ba3475eb611", 67),
    "ncdc-advanced-secondary-principal-mathematics-2026-9874365d71": ("9874365d71881c259d6463ad9b628eed2ffd4c8bd2585844ce41e2cedb20a196", 123),
}

FRAMEWORK_OTHER_SUBJECT_PAGES = (12, 13, 14, 15, 17)


def example_page_decisions(record: dict[str, Any], document: fitz.Document) -> list[dict[str, Any]]:
    section = EXAMPLE_SECTIONS.get(record.get("source_id"))
    if not section or record.get("checksum_sha256") != section["checksum"]:
        return []
    if len(document) < section["descriptorStart"]:
        return []
    start_text = " ".join(document[section["start"] - 1].get_text().split())
    descriptor_text = " ".join(document[section["descriptorStart"] - 1].get_text().split())
    if section["startEvidence"] not in start_text or section["descriptorEvidence"] not in descriptor_text:
        return []
    return [{"decisionId": f"{record['source_id']}:example-page:p{page}",
             "sourceId": record["source_id"], "checksumSha256": section["checksum"],
             "page": page, "spanId": f"{record['source_id']}:p{page}",
             "pageRole": "SAMPLE_ITEM_OR_SAMPLE_RUBRIC",
             "decision": "EXCLUDE_FROM_NORMATIVE_ASSESSMENT_PROFILE",
             "basis": f"Printed specimen/sample-rubric section runs from PDF page {section['start']} through {section['end']}; performance descriptors begin on PDF page {section['descriptorStart']}.",
             "verificationStatus": "REVIEW_REQUIRED"}
            for page in range(section["start"], section["end"] + 1)]


def back_cover_decisions(record: dict[str, Any], document: fitz.Document) -> list[dict[str, Any]]:
    configuration = BACK_COVERS.get(record.get("source_id"))
    if not configuration:
        return []
    checksum, page = configuration
    if record.get("checksum_sha256") != checksum or len(document) < page:
        return []
    text = " ".join(document[page - 1].get_text().split())
    if "National Curriculum Development Centre" not in text or "Kampala" not in text:
        return []
    return [{"decisionId": f"{record['source_id']}:back-cover:p{page}",
             "sourceId": record["source_id"], "checksumSha256": checksum,
             "page": page, "spanId": f"{record['source_id']}:p{page}",
             "pageRole": "BACK_COVER", "decision": "EXCLUDE_FROM_NORMATIVE_ASSESSMENT_PROFILE",
             "basis": "Printed NCDC address and publisher back cover; no assessment rule on this PDF page.",
             "verificationStatus": "REVIEW_REQUIRED"}]


def framework_other_subject_decisions(record: dict[str, Any], document: fitz.Document) -> list[dict[str, Any]]:
    framework_id = "ncdc-advanced-secondary-curriculum-2026-0d48fb4137"
    framework_checksum = "0d48fb4137672864224f89a77ad9987f058eaa971d2faabc74782ab70bf62cab"
    if record.get("source_id") != framework_id or record.get("checksum_sha256") != framework_checksum or len(document) < 17:
        return []
    if "ASC subject list" not in " ".join(document[9].get_text().split()):
        return []
    if "Principal Mathematics" not in " ".join(document[15].get_text().split()):
        return []
    return [{"decisionId": f"{framework_id}:other-subject-catalogue:p{page}",
             "sourceId": framework_id, "checksumSha256": framework_checksum,
             "page": page, "spanId": f"{framework_id}:p{page}",
             "pageRole": "OTHER_SUBJECT_CATALOGUE", "decision": "EXCLUDE_FROM_MATH_CHEM_PILOT_PROFILE",
             "basis": "Framework Table 1 catalogue page with no Chemistry or Principal Mathematics row; those pilot rows are on PDF pages 11 and 16.",
             "verificationStatus": "REVIEW_REQUIRED"}
            for page in FRAMEWORK_OTHER_SUBJECT_PAGES
            if not any(term in " ".join(document[page - 1].get_text().split()) for term in ("Chemistry 4 2", "Principal Mathematics 5 2"))]
