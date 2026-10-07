"""Conservative, format-aware candidates for the seven controlled-pilot PDFs.

Only printed detailed-syllabus anchors become topics. Table columns remain
review-required candidates because PDF blocks do not reliably encode rows.
"""

from __future__ import annotations

import re
from typing import Any

import fitz
from pilot_table import extract_table_columns
from pilot_assessment_rules import framework_pilot_subject_summary_candidates, framework_policy_candidates, framework_scoring_candidate, guideline_ao_mapping_candidates, paper_structure_candidates
from pilot_assessment_pages import back_cover_decisions, example_page_decisions, framework_other_subject_decisions
from pilot_rotated_assessment import rotated_construct_table_candidates


SENIOR_RE = re.compile(r"\bSENIOR\s+(1|2|3|4|5|6|ONE|TWO|THREE|FOUR|FIVE|SIX)\b", re.I)
TERM_RE = re.compile(r"\bTERM\s+([1-3])\b", re.I)
TOPIC_RE = re.compile(r"^TOPIC\s+([.\d\s]+?)\s*:\s*(.+)$", re.I)
TOPIC_NO_COLON_RE = re.compile(r"^TOPIC\s+(\d+(?:\.\d+)?)\s+(.+\bPERIODS?\s*\d*|.+\d+\s+PERIODS?)$", re.I)
TOPIC_DURATION_RE = re.compile(r"^(.*?)\s+(?:(?:Duration:\s*)?(\d+)\s+PERIODS?|PERIODS?\s+(\d+))$", re.I)
SUBTOPIC_RE = re.compile(r"^SUB[- ]TOPIC\s+(\d+(?:\.\d+)?)\s*[:.]\s*(.+?)(?:\s+Duration:\s*(\d+)\s+PERIODS?)?$", re.I)
TABLE_HEADER_RE = re.compile(r"^(?:LEARNING OUTCOMES?|SUGGESTED LEARNING ACTIVITIES|SAMPLE ASSESSMENT STRATEG|The learner should be able to)", re.I)
TAGS_RE = re.compile(r"\((k|u|s|gs|v/a|a)(?:[ ,;/]+(?:k|u|s|gs|v/a|a))*\)\s*$", re.I)
SENIOR_NAMES = {"ONE": "S1", "TWO": "S2", "THREE": "S3", "FOUR": "S4", "FIVE": "S5", "SIX": "S6"}


def clean(value: str) -> str:
    return " ".join(value.split())


def source_info(record: dict[str, Any]) -> dict[str, Any]:
    return {"sourceId": record["source_id"], "authority": record["authority"], "title": record["title"],
            "documentType": record["document_type"], "educationLevel": record["education_level"],
            "subject": record.get("subject"), "publicationYear": record.get("publication_year"),
            "effectiveYear": record.get("effective_year"), "version": record.get("version"),
            "rightsStatus": record["rights_status"], "checksumSha256": record["checksum_sha256"],
            "sourcePath": record["local_path"]}


def anchor_item(record: dict[str, Any], page: int, block: int, kind: str, wording: str,
                normalized: dict[str, Any]) -> dict[str, Any]:
    source_id = record["source_id"]
    return {"id": f"{source_id}:{kind}:p{page}:b{block}", "entityType": kind,
            "sourceWording": {"text": wording, "label": None, "language": "en"},
            "normalized": normalized,
            "extracted": {"method": "pilot-layout-anchor", "parserVersion": "ate-pilot-layout-1", "blockNumber": block},
            "verificationStatus": "REVIEW_REQUIRED",
            "provenance": {"sourceId": source_id, "pageStart": page, "pageEnd": page,
                           "spanId": f"{source_id}:p{page}", "locator": f"PDF page {page}, block {block}",
                           "extractionConfidence": "MEDIUM"}}


def relation(record: dict[str, Any], parent: str, item: dict[str, Any], kind: str) -> dict[str, Any]:
    return {"id": f"{record['source_id']}:{kind}:{item['id']}", "relationshipType": kind,
            "fromId": parent, "toId": item["id"], "verificationStatus": "UNVERIFIED", "provenance": item["provenance"]}


def extract_pilot_syllabus(record: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    document = fitz.open(record["local_path"])
    items: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    review: list[dict[str, Any]] = []
    level = term = theme = topic_id = subtopic_id = None
    in_detailed = False
    pending_competency: list[str] = []
    pending_provenance: tuple[int, int] | None = None
    for page_number, page in enumerate(document, start=1):
        blocks = page.get_text("blocks", sort=True)
        for block_number, block in enumerate(blocks, start=1):
            text = clean(block[4])
            if not text or block[1] < 65 or block[1] > 765:
                continue
            if "DETAILED SYLLABUS" in text.upper() and page_number >= 12 and len(text) < 80 and "..." not in text:
                in_detailed = True
                continue
            if not in_detailed:
                continue
            if TABLE_HEADER_RE.match(text):
                if pending_competency and pending_provenance and topic_id:
                    competency = anchor_item(record, *pending_provenance, "competency", clean(" ".join(pending_competency)),
                        {"subject": record["subject"], "level": level, "term": term, "title": clean(" ".join(pending_competency)), "parentId": topic_id})
                    items.append(competency); relations.append(relation(record, topic_id, competency, "belongs_to_topic"))
                    pending_competency.clear(); pending_provenance = None
                continue
            senior = SENIOR_RE.search(text)
            if senior and (text.upper().startswith("SENIOR") or text.upper().startswith("THEME:")):
                value = senior.group(1).upper()
                level = f"S{value}" if value.isdigit() else SENIOR_NAMES[value]
                found_term = TERM_RE.search(text)
                if found_term: term = found_term.group(1)
                if text.upper().startswith("SENIOR"): continue
            if text.upper().startswith("THEME:"):
                theme = re.split(r"\bTOPIC\s+[.\d\s]+\s*:", text.split(":", 1)[1], maxsplit=1, flags=re.I)[0].strip()
                if not re.search(r"(?<!SUB-)\bTOPIC\s+[.\d\s]+\s*:", text, re.I):
                    continue
            embedded_topic = re.search(r"(?<!SUB-)\bTOPIC\s+[.\d\s]+\s*:", text)
            topic_text = text[embedded_topic.start():] if embedded_topic else text
            topic_match = TOPIC_RE.match(topic_text) or TOPIC_NO_COLON_RE.match(topic_text)
            if topic_match:
                topic_id = None
                subtopic_id = None
                title = topic_match.group(2).strip()
                duration_match = TOPIC_DURATION_RE.match(title)
                periods = int(duration_match.group(2) or duration_match.group(3)) if duration_match else None
                if duration_match:
                    title = duration_match.group(1).strip()
                printed_number = topic_match.group(1).strip()
                number = printed_number.replace(" ", "").strip(".")
                if printed_number.startswith(".") and len(number) == 2:
                    number = f"{number[0]}.{number[1]}"
                # The printed O-Level Chemistry headings on pages 23 and 27
                # read 3.1 and 5.1; only their PDF text layer inserts dots/spaces.
                item = anchor_item(record, page_number, block_number, "topic", topic_text,
                    {"subject": record["subject"], "level": level, "term": term, "title": title,
                     "parentId": None, "topicNumber": number, "theme": theme, "periods": periods})
                topic_id = item["id"]; items.append(item)
                if periods is None: review.append({"sourceId": record["source_id"], "page": page_number, "extractedValue": text, "problem": "Topic duration not isolated", "proposedInterpretation": "Compare the detailed heading with the programme planner."})
                continue
            subtopic_match = SUBTOPIC_RE.match(text)
            if subtopic_match and topic_id:
                periods = int(subtopic_match.group(3)) if subtopic_match.group(3) else None
                if periods is None:
                    for following in blocks[block_number:block_number + 3]:
                        duration = re.fullmatch(r"Duration:\s*(\d+)\s+Periods?", clean(following[4]), re.I)
                        if duration and abs(following[1] - block[1]) < 35:
                            periods = int(duration.group(1))
                            break
                item = anchor_item(record, page_number, block_number, "subtopic", text,
                    {"subject": record["subject"], "level": level, "term": term, "title": subtopic_match.group(2).strip(),
                     "parentId": topic_id, "subtopicNumber": subtopic_match.group(1), "periods": periods})
                subtopic_id = item["id"]; items.append(item); relations.append(relation(record, topic_id, item, "belongs_to_topic"))
                if periods is None: review.append({"sourceId": record["source_id"], "page": page_number, "extractedValue": text, "problem": "Subtopic duration not isolated", "proposedInterpretation": "Compare the detailed heading with the programme planner."})
                continue
            if text.lower().startswith(("competency:", "topic competency:")):
                pending_competency = [text]
                pending_provenance = (page_number, block_number)
                continue
            if pending_competency:
                if block[0] < 220 and not text.startswith("SAMPLE"):
                    pending_competency.append(text)
                    continue
            if not topic_id:
                continue
            if text.upper().startswith(("THE LOWER SECONDARY CURRICULUM", "ADVANCED SECONDARY CURRICULUM", "MATHEMATICS SYLLABUS", "CHEMISTRY SYLLABUS")):
                continue
            x = block[0]
            if record["education_level"] == "lower-secondary":
                cut1, cut2 = (190, 380) if record["subject"] == "Mathematics" else (195, 390)
            else:
                cut1, cut2 = (220, 365)
            if x < cut1:
                kind = "learning_outcome"
            elif x < cut2:
                kind = "activity"
            else:
                kind = "assessment_strategy"
            if len(text) < 12 or text.lower().startswith(("the learner should be able", "learning outcomes", "suggested learning", "sample assessment")):
                continue
            parent = subtopic_id or topic_id
            tags = TAGS_RE.search(text)
            item = anchor_item(record, page_number, block_number, kind, text,
                {"subject": record["subject"], "level": level, "term": term, "title": text,
                 "parentId": parent, "topicId": topic_id, "subtopicId": subtopic_id,
                 "sourceTags": tags.group(0) if tags else None})
            items.append(item); relations.append(relation(record, parent, item, "belongs_to_topic"))
            if text.count("•") > 1 or re.search(r"\ba\).*\bb\)", text, re.I | re.S):
                review.append({"sourceId": record["source_id"], "page": page_number, "extractedValue": text,
                               "problem": f"Multiple {kind} table entries merged into one PDF block under {parent}",
                               "proposedInterpretation": f"Split the printed {kind} entries at their original cell/list boundaries and keep the {parent} parent."})
    anchors = [item for item in items if item["entityType"] in ("topic", "subtopic", "competency")]
    anchor_ids = {item["id"] for item in anchors}
    column_items, column_relations, column_review = extract_table_columns(record, document, anchors)
    document.close()
    return anchors + column_items, [item for item in relations if item["toId"] in anchor_ids] + column_relations, [item for item in review if "duration" in item["problem"].lower()] + column_review


ASSESSMENT_HEADING_RE = re.compile(r"^(?:\d+(?:\.\d+)*\s+)?(?:Table\s+\d+:\s*)?(Assessment Objectives?|Table of Constructs|Structure of the Assessment Papers|Scoring Rubrics?|Performance Level Descriptors?|Generic Scoring Rubric|Indicators? of Mastery|Summative Assessment|Formative Assessment|Structure of the Assessment Items)(?:\b|:)", re.I)


def extract_pilot_assessment(record: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    document = fitz.open(record["local_path"])
    items: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    review: list[dict[str, Any]] = []
    printed_papers = paper_structure_candidates(record, document)
    items.extend(printed_papers)
    excluded_pages = {decision["page"] for decision in example_page_decisions(record, document) + back_cover_decisions(record, document) + framework_other_subject_decisions(record, document)}
    items.extend(framework_policy_candidates(record, document))
    items.extend(framework_pilot_subject_summary_candidates(record, document))
    items.extend(guideline_ao_mapping_candidates(record, document))
    scoring_rule = framework_scoring_candidate(record, document)
    if scoring_rule:
        items.append(scoring_rule)
    rotated_items, rotated_relationships = rotated_construct_table_candidates(record, document)
    items.extend(rotated_items)
    relations.extend(rotated_relationships)
    mapped_rotated_pages = {page for item in rotated_items for page in range(item["provenance"]["pageStart"], item["provenance"]["pageEnd"] + 1)}
    mapped_paper_pages = {item["provenance"]["pageStart"] for item in printed_papers}
    for page_number, page in enumerate(document, start=1):
        if page_number < 7:
            continue
        page_text = clean(page.get_text())
        if len(page_text) > 120 and page_number not in mapped_paper_pages and page_number not in excluded_pages:
            mapped_table = page_number in mapped_rotated_pages
            review.append({"sourceId": record["source_id"], "page": page_number,
                "extractedValue": page_text[:240],
                "problem": ("Rotated construct-table row candidates and associations require source comparison."
                            if mapped_table else "Assessment page has no verified row-level mapping; section anchors alone omit applicable constructs, objectives, indicators, scoring, scenario, or paper rules."),
                "proposedInterpretation": ("Check every printed column, row continuation, construct association and complexity label before verification."
                                           if mapped_table else "Transcribe and classify the printed rules on this page by assessment construct and paper/task, preserving this page as provenance.")})
        for block_number, block in enumerate(page.get_text("blocks", sort=True), start=1):
            text = clean(block[4])
            if block[1] < 65 or block[1] > 765 or len(text) > 100:
                continue
            match = ASSESSMENT_HEADING_RE.match(text)
            if not match:
                continue
            heading = match.group(1).lower()
            if "construct" in heading: kind = "construct"
            elif "objective" in heading: kind = "assessment_objective"
            elif "indicator" in heading: kind = "indicator"
            elif "paper" in heading or "assessment items" in heading: kind = "paper_structure"
            elif "scor" in heading or "rubric" in heading: kind = "rubric_rule"
            elif "descriptor" in heading: kind = "performance_descriptor"
            else: kind = "assessment_guidance"
            item = anchor_item(record, page_number, block_number, kind, text,
                {"subject": record.get("subject"), "educationLevel": record["education_level"],
                 "appliesTo": None, "title": text, "documentRole": record["document_type"]})
            items.append(item)
    if record.get("subject") == "Chemistry" and record["document_type"] == "assessment-guidelines" and mapped_paper_pages and not any(
        item["normalized"].get("academicDecisionId") for item in printed_papers):
        review.append({"sourceId": record["source_id"], "page": 26,
            "extractedValue": "Paper 1 Section A: construct 3 (Stoichiometry, Thermochemistry and Reaction Kinetics), construct 4 (Chemical Equilibria and Electrochemical Systems)",
            "problem": "Printed construct names in paper structure conflict with the AO3/AO4 construct names and topic memberships in Table 1 on PDF pages 9–10.",
            "proposedInterpretation": "Keep the printed Section A wording and AO numbers; obtain an academic ruling before normalizing construct labels or using this mapping for assessment eligibility."})
    if record["document_type"] == "assessment-framework" and not scoring_rule:
        review.append({"sourceId": record["source_id"], "page": 21,
            "extractedValue": "The minimum score for an item will always be equal to the number of bases of assessment for that item, while its maximum score will be five times the number of bases of assessment. Example 1: An item with 5 bases of assessment Maximum score possible = 20",
            "problem": "The printed maximum-score rule says five times the number of bases, but the immediately following five-base example gives 20 (four times).",
            "proposedInterpretation": "Preserve both printed statements; obtain an academic ruling before computing maximum marks or score bands from this formula."})
    document.close()
    return items, relations, review
