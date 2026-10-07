"""Extract syllabus table columns without allowing PDF blocks to cross columns.

This is a candidate parser. A column crop preserves the printed column role,
while row membership and wrapped entries still require source comparison.
"""

from __future__ import annotations

import re
from typing import Any

import fitz


COLS = {
    ("lower-secondary", "Mathematics"): ((30, 190), (190, 380), (380, 560)),
    ("lower-secondary", "Chemistry"): ((30, 194), (194, 380), (380, 558)),
    ("advanced-secondary", "Chemistry"): ((76, 205), (205, 375), (375, 522)),
    ("advanced-secondary", "Principal Mathematics"): ((76, 220), (220, 365), (365, 522)),
}
KINDS = ("learning_outcome", "activity", "assessment_strategy")
LEAD = re.compile(r"^(?:[•●▪]\s*|[a-z]\s*[.)]\s+|\d+[.)]\s+)", re.I)
HEADER = re.compile(r"^(?:LEARNING OUTCOMES?|SUGGESTED LEARNING ACTIVITIES|SAMPLE ASSESSMENT STRATEG|The learner should be(?: able(?: to:?)?)?|able to:$|to:$|ACTIVITIES$|STRATEGY$)", re.I)
TAG = re.compile(r"\((?:k|u|s|gs|v/a|a)(?:[ ,;/]+(?:k|u|s|gs|v/a|a))*\)\s*$", re.I)
STOP = re.compile(r"^(?:ICT Support|Cross.Cutting Issues|THEME:|SENIOR\s+(?:[1-6]|ONE|TWO|THREE|FOUR|FIVE|SIX)|TOPIC\s+[\d. ]+\s*:|SUB[- ]TOPIC\s+[\d. ]+\s*:)", re.I)


def clean(text: str) -> str:
    return " ".join(text.split())


def marker_y(page: fitz.Page, item: dict[str, Any]) -> float:
    number = item["extracted"]["blockNumber"]
    return page.get_text("blocks", sort=True)[number - 1][1]


def printed_table_gutters(page: fitz.Page, header_bottom: float, segment_end: float,
                          pixels: fitz.Pixmap) -> tuple[int, int] | None:
    """Find the two persistent vertical rules in a lower-secondary table."""
    start = max(0, int(header_bottom + 6))
    end = min(int(segment_end - 5), start + 120, pixels.height)
    if end - start < 35:
        return None
    samples = pixels.samples
    ys = range(start, end, 2)
    candidates = []
    for x in range(120, min(470, pixels.width - 1)):
        if sum(samples[y * pixels.width + x] < 240 for y in ys) / len(ys) >= .85:
            candidates.append(x)
    groups: list[list[int]] = []
    for x in candidates:
        if not groups or x > groups[-1][-1] + 2:
            groups.append([x])
        else:
            groups[-1].append(x)
    centers = [round(sum(group) / len(group)) for group in groups]
    if len(centers) != 2 or centers[1] - centers[0] < 90:
        return None
    return centers[0], centers[1]


def lines_in(page: fitz.Page, x0: float, x1: float, y0: float, y1: float) -> list[tuple[float, float, str, float]]:
    grouped: list[list[tuple[Any, ...]]] = []
    words = sorted(page.get_text("words", sort=True), key=lambda word: (word[1], word[0]))
    for word in words:
        midpoint = (word[0] + word[2]) / 2
        if x0 <= midpoint < x1 and y0 <= word[1] and word[3] <= y1:
            if grouped and abs(grouped[-1][0][1] - word[1]) <= 2.5:
                grouped[-1].append(word)
            else:
                grouped.append([word])
    found = []
    for line_words in grouped:
        line_words.sort(key=lambda word: word[0])
        bullet_at = next((index for index, word in enumerate(line_words) if word[4] in ("•", "●", "▪")), None)
        if bullet_at is not None:
            line_words = line_words[bullet_at:]
        wording = clean(" ".join(word[4] for word in line_words))
        if wording:
            found.append((min(word[1] for word in line_words), max(word[3] for word in line_words), wording,
                          min(word[0] for word in line_words)))
    return sorted(found)


def extract_table_columns(record: dict[str, Any], document: fitz.Document,
                          anchors: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    columns = COLS[(record["education_level"], record["subject"])]
    by_page: dict[int, list[dict[str, Any]]] = {}
    for anchor in anchors:
        if anchor["entityType"] in ("topic", "subtopic"):
            by_page.setdefault(anchor["provenance"]["pageStart"], []).append(anchor)
    last_anchor_page = max(by_page) if by_page else 0
    items: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    review: list[dict[str, Any]] = []
    active: dict[str, Any] | None = None
    active_columns = columns
    raster_cache: dict[int, fitz.Pixmap] = {}
    last_gutters: dict[str, tuple[int, int]] = {}
    detailed = False
    last_entry: dict[tuple[str, str], dict[str, Any]] = {}
    for page_number, page in enumerate(document, start=1):
        blocks = page.get_text("blocks", sort=True)
        if page_number > last_anchor_page and any(
            block[1] < 190 and re.match(r"^(?:\d+\.\d*\s+)?(?:ASSESSMENT|Assessing the new expectations)", clean(block[4]), re.I)
            for block in blocks):
            break
        if any("DETAILED SYLLABUS" in clean(block[4]).upper() and len(clean(block[4])) < 80 for block in blocks) and page_number >= 12:
            detailed = True
        if not detailed:
            continue
        markers: list[tuple[float, dict[str, Any] | None]] = []
        for anchor in by_page.get(page_number, []):
            markers.append((marker_y(page, anchor), anchor))
        for block in blocks:
            wording = clean(block[4])
            if wording and STOP.match(wording) and not re.search(r"\bTOPIC\s+[.\d\s]+\s*:", wording, re.I):
                markers.append((block[1], None))
        markers.sort(key=lambda pair: pair[0])
        boundaries = [(65.0, active)] + markers + [(765.0, None)]
        for index in range(len(boundaries) - 1):
            y0, parent = boundaries[index]
            y1, next_parent = boundaries[index + 1]
            if y1 - y0 < 12 or parent is None:
                continue
            header_blocks = [block for block in blocks if y0 <= block[1] < y1 and "LEARNING OUTCOME" in clean(block[4]).upper()]
            if header_blocks:
                y0 = min(block[3] for block in header_blocks) - 3
            elif index > 0:
                if next_parent is not None and next_parent["entityType"] == "subtopic":
                    continue
                if len(clean(" ".join(block[4] for block in blocks if y0 <= block[1] < y1))) < 120:
                    continue
                # A new topic without a printed column header is unsafe to parse.
                review.append({"sourceId": record["source_id"], "page": page_number,
                    "extractedValue": parent["sourceWording"]["text"],
                    "problem": "No table header located after this detailed-syllabus anchor",
                    "proposedInterpretation": "Inspect the printed page and locate the actual outcome/activity/strategy table before assigning its entries."})
                continue
            if y1 - y0 < 12:
                continue
            if header_blocks and record["education_level"] == "lower-secondary":
                heading = [rect for rect in page.search_for("LEARNING OUTCOMES") if boundaries[index][0] <= rect.y0 < y1]
                if heading:
                    if page_number not in raster_cache:
                        raster_cache[page_number] = page.get_pixmap(colorspace=fitz.csGRAY)
                    raster = raster_cache[page_number]
                    gutters = printed_table_gutters(page, heading[0].y1, y1, raster)
                    if gutters:
                        active_columns = ((30, gutters[0]), (gutters[0], gutters[1]), (gutters[1], columns[2][1]))
                        last_gutters[parent["id"]] = gutters
                    elif parent["id"] in last_gutters:
                        previous = last_gutters[parent["id"]]
                        active_columns = ((30, previous[0]), (previous[0], previous[1]), (previous[1], columns[2][1]))
                    else:
                        suggested = [rect for rect in page.search_for("SUGGESTED LEARNING ACTIVITIES") if boundaries[index][0] <= rect.y0 < y1]
                        assessment = [rect for rect in page.search_for("SAMPLE ASSESSMENT") if boundaries[index][0] <= rect.y0 < y1]
                        if suggested and assessment and 170 < suggested[0].x0 < 260 and 350 < assessment[0].x0 < 475:
                            first_cut = round(suggested[0].x0 - 16)
                            second_cut = round(assessment[0].x0 - 20)
                            active_columns = ((30, first_cut), (first_cut, second_cut), (second_cut, columns[2][1]))
                        else:
                            review.append({"sourceId": record["source_id"], "page": page_number,
                                "extractedValue": parent["sourceWording"]["text"],
                                "problem": "Printed table gutters and heading-derived boundaries could not be isolated for this topic",
                                "proposedInterpretation": "Read the column boundaries from the original table before verifying outcomes, activities and assessment strategies."})
            if header_blocks and record["education_level"] == "advanced-secondary":
                suggested = [rect for rect in page.search_for("Suggested Learning") if boundaries[index][0] <= rect.y0 < y1]
                assessment = [rect for phrase in ("Sample Assessment", "Suggested Assessment")
                              for rect in page.search_for(phrase) if boundaries[index][0] <= rect.y0 < y1]
                if suggested and assessment:
                    first_cut = suggested[0].x0 - 5
                    second_cut = assessment[0].x0 - 10
                    if columns[0][0] + 75 < first_cut < second_cut - 80 < columns[2][1] - 60:
                        active_columns = ((columns[0][0], first_cut), (first_cut, second_cut), (second_cut, columns[2][1]))
            for column_index, (x0, x1) in enumerate(active_columns):
                kind = KINDS[column_index]
                lines = lines_in(page, x0, x1, y0, y1)
                entries: list[list[tuple[float, float, str, float]]] = []
                pending_bullet = False
                for line in lines:
                    wording = line[2]
                    if wording in ("•", "●", "▪"):
                        pending_bullet = True
                        continue
                    if pending_bullet:
                        line = (line[0], line[1], "• " + wording, line[3])
                        wording = line[2]
                        pending_bullet = False
                    if HEADER.match(wording) or STOP.match(wording) or wording.isdigit() or len(wording) < 2:
                        continue
                    if (record["source_id"] == "ncdc-lower-secondary-mathematics-2019-83e3739a34"
                            and page_number == 55 and kind == "activity" and line[0] < 280):
                        # This coordinate band is the printed bar chart and
                        # possibility-space diagram. The two actual activities
                        # begin below it at y=285 and y=425.
                        continue
                    nested_bullet = (kind != "learning_outcome" and entries and wording.startswith(("•", "●", "▪"))
                                     and line[3] >= entries[-1][0][3] + 8)
                    if (LEAD.match(wording) and not nested_bullet) or not entries:
                        entries.append([line])
                    else:
                        entries[-1].append(line)
                for entry_index, entry in enumerate(entries, start=1):
                    wording = clean(" ".join(line[2] for line in entry))
                    if len(wording) < 8:
                        continue
                    first_y, last_y = entry[0][0], entry[-1][1]
                    id_part = f"p{page_number}:c{column_index}:y{round(first_y * 10)}:e{entry_index}"
                    item_id = f"{record['source_id']}:{kind}:{id_part}"
                    parent_id = parent["id"]
                    topic_id = parent_id if parent["entityType"] == "topic" else parent["normalized"]["parentId"]
                    tags = TAG.search(wording)
                    provenance = {"sourceId": record["source_id"], "pageStart": page_number, "pageEnd": page_number,
                        "spanId": f"{record['source_id']}:p{page_number}",
                        "locator": f"PDF page {page_number}, table column {column_index + 1}, x {x0}-{x1}, y {first_y:.1f}-{last_y:.1f}",
                        "extractionConfidence": "MEDIUM"}
                    item = {"id": item_id, "entityType": kind,
                        "sourceWording": {"text": wording, "label": None, "language": "en"},
                        "normalized": {"subject": record["subject"], "level": parent["normalized"]["level"],
                            "term": parent["normalized"]["term"], "title": wording,
                            "parentId": parent_id, "topicId": topic_id,
                            "subtopicId": parent_id if parent["entityType"] == "subtopic" else None,
                            "sourceTags": tags.group(0) if tags else None},
                        "extracted": {"method": "pilot-column-crop", "parserVersion": "ate-pilot-layout-2",
                            "column": column_index + 1, "yStart": first_y, "yEnd": last_y},
                        "verificationStatus": "REVIEW_REQUIRED", "provenance": provenance}
                    prior = last_entry.get((parent_id, kind))
                    continuation = (not LEAD.match(entry[0][2]) and entry_index == 1
                        and first_y < (145 if record["education_level"] == "advanced-secondary" else 115) and prior is not None
                        and prior["provenance"]["pageEnd"] == page_number - 1)
                    if continuation:
                        prior["sourceWording"]["text"] = clean(prior["sourceWording"]["text"] + " " + wording)
                        prior["normalized"]["title"] = prior["sourceWording"]["text"]
                        complete_tags = TAG.search(prior["sourceWording"]["text"])
                        prior["normalized"]["sourceTags"] = complete_tags.group(0) if complete_tags else None
                        prior["provenance"]["pageEnd"] = page_number
                        prior["provenance"].setdefault("additionalSpanIds", []).append(f"{record['source_id']}:p{page_number}")
                        prior["provenance"]["locator"] += f"; PDF page {page_number}, table column {column_index + 1}, y {first_y:.1f}-{last_y:.1f}"
                        for relationship in reversed(relations):
                            if relationship["toId"] == prior["id"]:
                                relationship["provenance"] = prior["provenance"]
                                break
                        continue
                    items.append(item)
                    relations.append({"id": f"{record['source_id']}:belongs_to_topic:{item_id}",
                        "relationshipType": "belongs_to_topic", "fromId": parent_id, "toId": item_id,
                        "verificationStatus": "UNVERIFIED", "provenance": provenance})
                    last_entry[(parent_id, kind)] = item
                    source_prints_single_unlettered_outcome = (
                        kind == "learning_outcome" and record["education_level"] == "advanced-secondary"
                        and parent["entityType"] == "subtopic" and parent["provenance"]["pageStart"] == page_number
                        and bool(header_blocks) and entry_index == 1 and bool(tags)
                    )
                    first_strategy_in_new_topic = (kind == "assessment_strategy" and bool(header_blocks)
                        and parent["entityType"] == "topic" and parent["provenance"]["pageStart"] == page_number
                        and entry_index == 1)
                    if not LEAD.match(entry[0][2]) and not source_prints_single_unlettered_outcome and not first_strategy_in_new_topic:
                        review.append({"sourceId": record["source_id"], "page": page_number, "extractedValue": wording,
                            "problem": f"Unmarked {kind} text may continue a table entry from another page or row",
                            "proposedInterpretation": f"Compare the {kind} text with the printed row and preceding page before verifying its parent."})
                    elif kind == "learning_outcome" and len(re.findall(r"(?<![A-Za-z(])[a-h]\)\s+", wording, re.I)) > 1:
                        review.append({"sourceId": record["source_id"], "page": page_number, "extractedValue": wording,
                            "problem": f"Multiple lettered {kind} entries remain inside one cropped column entry",
                            "proposedInterpretation": f"Split at the printed list boundaries in column {column_index + 1} while retaining the page and parent."})
        active = boundaries[-2][1] if len(boundaries) > 1 else active
    return items, relations, review
