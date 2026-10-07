"""Source-format-aware paper-structure candidates for the pilot guidelines.

Only the printed structure section is used. Sample papers are excluded because
their example text is not itself a general assessment rule.
"""

from __future__ import annotations

import re
import json
from pathlib import Path
from typing import Any

import fitz


DECISIONS_PATH = Path(__file__).resolve().parent / "catalog" / "pilot-academic-decisions.json"


def academic_decision(record: dict[str, Any], issue: str) -> dict[str, Any] | None:
    """Only an explicit decision for this exact source checksum can resolve a conflict."""
    if not DECISIONS_PATH.exists():
        return None
    decisions = json.loads(DECISIONS_PATH.read_text(encoding="utf-8"))["decisions"]
    return next((decision for decision in decisions
                 if decision["sourceId"] == record.get("source_id")
                 and decision["checksumSha256"] == record.get("checksum_sha256")
                 and decision["issue"] == issue), None)


def clean(text: str) -> str:
    return " ".join(text.split())


def paper_structure_candidates(record: dict[str, Any], document: fitz.Document) -> list[dict[str, Any]]:
    subject = record.get("subject")
    if subject not in ("Chemistry", "Principal Mathematics") or record["document_type"] != "assessment-guidelines":
        return []
    result = []
    chemistry_decision = academic_decision(record, "CONSTRUCT_3_4_LABEL_CONFLICT")
    if chemistry_decision:
        table_text = clean(document[9].get_text())
        if not all(value in table_text for value in ("AO3", "AO4", "Thermochemistry", "Electrochemistry", "Reaction Kinetics", "Stoichiometry", "Chemical", "Equilibria")):
            chemistry_decision = None
    for page_number, page in enumerate(document, start=1):
        text = page.get_text()
        if "3. Structure of the Assessment Papers" not in text:
            continue
        if subject == "Chemistry":
            first = re.search(r"Paper 1 \(theory paper\)(.*?)(?=Paper 2 \(practical paper\))", text, re.S | re.I)
            second = re.search(r"Paper 2 \(practical paper\)(.*)$", text, re.S | re.I)
            profiles = (
                {"paperNumber": 1, "paperType": "THEORY", "durationMinutes": 165,
                 "sections": {"A": {"compulsory": True, "constructs": [3, 4], "objectives": [3, 4]},
                              "B": {"partI": {"choose": 1, "construct": 1, "objective": 1},
                                    "partII": {"choose": 1, "construct": 2, "objective": 2}}},
                 "scenarioBased": True},
                {"paperNumber": 2, "paperType": "PRACTICAL", "durationMinutes": 195,
                 "compulsoryItems": 2, "eligibleConstructs": [1, 2, 3, 4], "scienceProcessSkills": True},
            )
            evidence = (r"2\s+hours:\s*45\s+min", r"3hrs:15min")
        else:
            first = re.search(r"Paper 1:\s*(.*?)(?=Paper 2:)", text, re.S | re.I)
            second = re.search(r"Paper 2:\s*(.*)$", text, re.S | re.I)
            profiles = (
                {"paperNumber": 1, "paperType": "THEORY", "durationMinutes": 140,
                 "offeredItems": 5, "equallyWeighted": True,
                 "sections": {"A": {"construct": "Geometry", "offered": 1, "attempt": 1},
                              "B": {"construct": "Algebra", "offered": 2, "attempt": 1},
                              "C": {"construct": "Calculus", "offered": 2, "attempt": 1}},
                 "scenarioBased": True},
                {"paperNumber": 2, "paperType": "THEORY", "durationMinutes": 135,
                 "offeredItems": 4, "equallyWeighted": True,
                 "sections": {"A": {"construct": "Data Analysis and Probability", "offered": 2, "attempt": 2},
                              "B": {"construct": "Mechanics", "offered": 2, "attempt": 1}},
                 "scenarioBased": True},
            )
            evidence = (r"2\s*1\s*3hours", r"2\s*1\s*4\s+hours")
        if not first or not second or not all(re.search(token, text) for token in evidence):
            continue
        for match, normalized in zip((first, second), profiles):
            if subject == "Chemistry" and normalized["paperNumber"] == 1 and chemistry_decision:
                normalized["constructMappingAuthority"] = "Table 1, PDF pages 9–10"
                normalized["constructNamesByObjective"] = {
                    "AO3": "Thermochemistry, Electrochemistry and Reaction Kinetics",
                    "AO4": "Stoichiometry, Chemical Equilibria Systems",
                }
                normalized["academicDecisionId"] = chemistry_decision["decisionId"]
            wording = clean(match.group(0))
            paper_number = normalized["paperNumber"]
            identifier = f"{record['source_id']}:paper-structure:p{page_number}:paper{paper_number}"
            result.append({"id": identifier, "entityType": "paper_structure",
                "sourceWording": {"text": wording, "label": f"Paper {paper_number}", "language": "en"},
                "normalized": {"subject": subject, "educationLevel": record["education_level"],
                    "appliesTo": "S5-S6", "title": f"Paper {paper_number} structure", **normalized},
                "extracted": {"method": "pilot-printed-paper-structure", "parserVersion": "ate-pilot-assessment-2",
                    "printedSection": "3. Structure of the Assessment Papers"},
                "verificationStatus": "REVIEW_REQUIRED",
                "provenance": {"sourceId": record["source_id"], "pageStart": page_number,
                    "pageEnd": page_number, "spanId": f"{record['source_id']}:p{page_number}",
                    "locator": f"PDF page {page_number}, section 3, Paper {paper_number}",
                    "extractionConfidence": "HIGH"}})
    return result


def framework_scoring_candidate(record: dict[str, Any], document: fitz.Document) -> dict[str, Any] | None:
    if record.get("document_type") != "assessment-framework":
        return None
    decision = academic_decision(record, "MAXIMUM_SCORE_FORMULA_CONFLICT")
    if not decision or len(document) < 21:
        return None
    page_text = clean(document[20].get_text())
    match = re.search(r"The minimum score for an item will always be equal to the number of bases of assessment for that item, while its maximum score will be five times the number of bases of assessment\.", page_text, re.I)
    if not match or "An item with 5 bases of assessment Maximum score possible = 20" not in page_text:
        return None
    source_id = record["source_id"]
    return {"id": f"{source_id}:rubric-rule:p21:written-maximum", "entityType": "rubric_rule",
        "sourceWording": {"text": match.group(0), "label": "Written maximum-score rule", "language": "en"},
        "normalized": {"subject": None, "educationLevel": "advanced-secondary", "appliesTo": "S5-S6",
            "title": "Written maximum-score rule", "minimumScorePerBase": 1,
            "maximumScorePerBase": 5, "academicDecisionId": decision["decisionId"],
            "contradictoryExamplePage": 21, "scoreBandsDerivable": False},
        "extracted": {"method": "pilot-printed-scoring-rule", "parserVersion": "ate-pilot-assessment-2"},
        "verificationStatus": "REVIEW_REQUIRED",
        "provenance": {"sourceId": source_id, "pageStart": 21, "pageEnd": 21,
            "spanId": f"{source_id}:p21", "locator": "PDF page 21, written rule before Example 1",
            "extractionConfidence": "HIGH"}}


def framework_policy_candidates(record: dict[str, Any], document: fitz.Document) -> list[dict[str, Any]]:
    """Keep the short prose rules on framework pages 8–9 distinct from rubric tables."""
    if record.get("document_type") != "assessment-framework" or len(document) < 9:
        return []
    rules = (
        (8, "Guiding Principles", "The Assessment Approaches", "assessment_principles"),
        (8, "Formative Assessment Formative assessment", "Summative Assessment", "formative_guidance"),
        (9, "At school level, the teacher is expected", "ii) The end of cycle", "school_level_aoi"),
        (9, "The end of cycle summative assessment", "The end of cycle assessment will be guided", "end_cycle_assessment"),
    )
    result = []
    for page_number, start, end, kind in rules:
        wording = clean(document[page_number - 1].get_text())
        start_index = wording.find(start)
        end_index = wording.find(end, start_index + len(start)) if end in wording else len(wording)
        if start_index < 0 or end_index < 0:
            continue
        excerpt = wording[start_index:end_index].strip()
        if len(excerpt) < 90:
            continue
        source_id = record["source_id"]
        result.append({"id": f"{source_id}:assessment-guidance:p{page_number}:{kind}",
            "entityType": "assessment_guidance",
            "sourceWording": {"text": excerpt, "label": kind, "language": "en"},
            "normalized": {"subject": None, "educationLevel": "advanced-secondary", "appliesTo": "S5-S6",
                "title": kind.replace("_", " ").title(), "ruleType": kind},
            "extracted": {"method": "pilot-framework-prose-section", "parserVersion": "ate-pilot-assessment-2"},
            "verificationStatus": "REVIEW_REQUIRED",
            "provenance": {"sourceId": source_id, "pageStart": page_number, "pageEnd": page_number,
                "spanId": f"{source_id}:p{page_number}", "locator": f"PDF page {page_number}, {start}",
                "extractionConfidence": "HIGH"}})
    return result


def framework_pilot_subject_summary_candidates(record: dict[str, Any], document: fitz.Document) -> list[dict[str, Any]]:
    """Read only the two pilot rows in the framework's cross-subject Table 1."""
    if record.get("document_type") != "assessment-framework" or len(document) < 16:
        return []
    rows = ((11, "Chemistry", 4, 2, "Chinese"),
            (16, "Principal Mathematics", 5, 2, "Subsidiary ICT"))
    result = []
    for page_number, subject, constructs, papers, next_subject in rows:
        text = clean(document[page_number - 1].get_text())
        pattern = re.compile(rf"\b{re.escape(subject)}\s+{constructs}\s+{papers}\s+(.*?)\s+{re.escape(next_subject)}\s+\d+\s+\d+\b", re.S)
        match = pattern.search(text)
        if not match:
            continue
        source_id = record["source_id"]
        result.append({"id": f"{source_id}:framework-subject-summary:p{page_number}:{subject.lower().replace(' ', '-')}",
            "entityType": "assessment_profile",
            "sourceWording": {"text": match.group(0).rsplit(next_subject, 1)[0].strip(), "label": subject, "language": "en"},
            "normalized": {"subject": subject, "educationLevel": "advanced-secondary", "appliesTo": "S5-S6",
                "title": f"{subject} assessment summary", "numberOfConstructs": constructs,
                "numberOfPapers": papers, "assessmentFocus": match.group(1).strip()},
            "extracted": {"method": "pilot-framework-table-1-row", "parserVersion": "ate-pilot-assessment-2"},
            "verificationStatus": "REVIEW_REQUIRED",
            "provenance": {"sourceId": source_id, "pageStart": page_number, "pageEnd": page_number,
                "spanId": f"{source_id}:p{page_number}", "locator": f"PDF page {page_number}, Table 1, {subject} row",
                "extractionConfidence": "HIGH"}})
    return result


GUIDELINE_AO_ROWS = {
    "Chemistry": (
        ("AO1", "Foundations of atomic structure, bonding and periodicity of elements", (2, 3, 4, 11)),
        ("AO2", "Structure, reactivity and applications of organic molecules", (6, 9, 12)),
        ("AO3", "Thermochemistry, Electrochemistry and Reaction Kinetics", (5, 10, 13)),
        ("AO4", "Stoichiometry, Chemical Equilibria Systems", (1, 7, 8)),
    ),
    "Principal Mathematics": (
        ("AO1", "Algebra", (1, 2, 12, 13, 25)),
        ("AO2", "Geometry", (3, 5, 17, 24)),
        ("AO3", "Calculus", (4, 10, 11, 16, 18, 19, 26, 21, 23, 27)),
        ("AO4", "Data analysis and probability", (6, 7, 9, 14, 15, 22)),
        ("AO5", "Mechanics", (8, 20)),
    ),
}


def guideline_ao_mapping_candidates(record: dict[str, Any], document: fitz.Document) -> list[dict[str, Any]]:
    """Read Table 1 AO/construct/topic rows, preserving a two-page row where printed."""
    subject = record.get("subject")
    rows = GUIDELINE_AO_ROWS.get(subject)
    if record.get("document_type") != "assessment-guidelines" or not rows or len(document) < 10:
        return []
    first_page = clean(document[8].get_text())
    second_page = re.sub(r"^\d+\s+ADVANCED SECONDARY CURRICULUM\s+www\.ncdc\.go\.ug\s*", "", clean(document[9].get_text()), flags=re.I)
    combined = first_page + " " + second_page
    boundary = len(first_page)
    found = list(re.finditer(r"\bAO[1-5]\b", combined))
    if len(found) != len(rows):
        return []
    result = []
    for index, (objective, title, topic_numbers) in enumerate(rows):
        marker = found[index]
        if marker.group(0) != objective:
            return []
        end = found[index + 1].start() if index + 1 < len(found) else len(combined)
        if subject == "Chemistry" and objective == "AO2":
            end = boundary
        wording = combined[marker.start():end].strip()
        if clean(title).lower() not in wording.lower():
            return []
        if not all(re.search(rf"\b{number}\s*[.)]", wording) for number in topic_numbers):
            return []
        decision = academic_decision(record, "CONSTRUCT_3_4_LABEL_CONFLICT") if subject == "Chemistry" and objective in ("AO3", "AO4") else None
        if subject == "Chemistry" and objective in ("AO3", "AO4") and not decision:
            continue
        page_start = 9 if marker.start() < boundary else 10
        page_end = 10 if end > boundary and page_start == 9 else page_start
        source_id = record["source_id"]
        result.append({"id": f"{source_id}:assessment-construct-mapping:{objective.lower()}",
            "entityType": "construct",
            "sourceWording": {"text": wording, "label": objective, "language": "en"},
            "normalized": {"subject": subject, "educationLevel": "advanced-secondary", "appliesTo": "S5-S6",
                "assessmentObjective": objective, "constructTitle": title, "syllabusTopicNumbers": list(topic_numbers),
                "mappingAuthority": "Guideline Table 1, PDF pages 9–10",
                "academicDecisionId": decision["decisionId"] if decision else None},
            "extracted": {"method": "pilot-guideline-ao-table-1", "parserVersion": "ate-pilot-assessment-2"},
            "verificationStatus": "REVIEW_REQUIRED",
            "provenance": {"sourceId": source_id, "pageStart": page_start, "pageEnd": page_end,
                "spanId": f"{source_id}:p{page_start}",
                "additionalSpanIds": [f"{source_id}:p10"] if page_end == 10 and page_start == 9 else [],
                "locator": f"PDF page {page_start}" + ("–10" if page_end == 10 and page_start == 9 else "") + f", Table 1, {objective} row",
                "extractionConfidence": "HIGH"}})
    return result
