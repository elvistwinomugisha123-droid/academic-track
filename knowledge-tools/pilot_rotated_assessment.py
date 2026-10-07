"""Read the five printed columns of the landscape construct tables.

The guideline PDFs encode landscape tables as text rotated 90 degrees inside
portrait PDF pages. PDF text order interleaves columns; source coordinates,
not prose order, determine the printed column and list entry.
"""

from __future__ import annotations

import re
from typing import Any

import fitz


TABLE_PAGES = {
    "ncdc-advanced-secondary-chemistry-2026-9b0961b964": {
        "checksum": "9b0961b96487040ee3a64509758718a976bbcef82dd2656a3c5c3ba3475eb611",
        "groups": ((11, 17, "AO1"), (18, 19, "AO2"), (20, 25, "AO3_AO4_SHARED")),
    },
    "ncdc-advanced-secondary-principal-mathematics-2026-9874365d71": {
        "checksum": "9874365d71881c259d6463ad9b628eed2ffd4c8bd2585844ce41e2cedb20a196",
        "groups": ((11, 22, "AO1"), (23, 29, "AO2"), (30, 34, "AO3"), (35, 40, "AO4"), (41, 42, "AO5")),
    },
}

COLUMNS = (
    ("assessment_objective", 410, 540, re.compile(r"^(\d{1,2})\)\s*", re.I)),
    ("ability", 280, 410, re.compile(r"^([a-z])\)\s*", re.I)),
    ("indicator", 145, 280, re.compile(r"^([ivxlcdm]+)\)\s*", re.I)),
    ("assessment_rule", 70, 145, re.compile(r"^(\d+\s*[-–]\s*(?:High|Medium|Low))\b", re.I)),
)


def rotated_construct_table_candidates(record: dict[str, Any], document: fitz.Document) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    config = TABLE_PAGES.get(record.get("source_id"))
    if (not config or record.get("checksum_sha256") != config["checksum"]
            or record.get("document_type") != "assessment-guidelines"):
        return [], []
    items: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []
    source_id = record["source_id"]
    for first, last, group in config["groups"]:
        if len(document) < last:
            continue
        for kind, y0, y1, marker in COLUMNS:
            active: dict[str, Any] | None = None
            for page_number in range(first, last + 1):
                page = document[page_number - 1]
                lines = []
                for block in page.get_text("dict")["blocks"]:
                    for line in block.get("lines", []):
                        if line["dir"] != (0.0, -1.0):
                            continue
                        box = line["bbox"]
                        midpoint = (box[1] + box[3]) / 2
                        if not y0 <= midpoint < y1 or not 45 <= box[0] < 660:
                            continue
                        text = " ".join("".join(span["text"] for span in line["spans"]).split())
                        if text:
                            lines.append((box[0], midpoint, text))
                for x, y, text in sorted(lines):
                    found = marker.match(text)
                    if found:
                        item_id = f"{source_id}:rotated-construct:{group.lower()}:{kind}:p{page_number}:x{round(x * 10)}"
                        active = {"id": item_id, "entityType": kind,
                            "sourceWording": {"text": text, "label": found.group(1), "language": "en"},
                            "normalized": {"subject": record["subject"], "educationLevel": "advanced-secondary",
                                "appliesTo": "S5-S6", "title": text, "constructGroup": group,
                                "printedListMarker": found.group(1)},
                            "extracted": {"method": "pilot-rotated-construct-table", "parserVersion": "ate-pilot-assessment-3",
                                "printedColumn": kind, "rotatedX": x, "rotatedY": y},
                            "verificationStatus": "REVIEW_REQUIRED",
                            "provenance": {"sourceId": source_id, "pageStart": page_number, "pageEnd": page_number,
                                "spanId": f"{source_id}:p{page_number}", "additionalSpanIds": [],
                                "locator": f"PDF page {page_number}, rotated construct table, {kind} column, x {x:.1f}",
                                "extractionConfidence": "MEDIUM"}}
                        items.append(active)
                        if group.startswith("AO") and "_" not in group:
                            relationships.append({"id": f"{source_id}:construct-maps:{item_id}",
                                "relationshipType": "belongs_to_assessment_construct",
                                "fromId": f"{source_id}:assessment-construct-mapping:{group.lower()}",
                                "toId": item_id, "verificationStatus": "UNVERIFIED",
                                "provenance": active["provenance"]})
                    elif active and not (page_number == first and x < 170 and text.lower().startswith(("the learner", "construct", "level of"))):
                        active["sourceWording"]["text"] += " " + text
                        active["normalized"]["title"] = active["sourceWording"]["text"]
                        if active["provenance"]["pageEnd"] != page_number:
                            active["provenance"]["pageEnd"] = page_number
                            active["provenance"]["additionalSpanIds"].append(f"{source_id}:p{page_number}")
    return items, relationships
