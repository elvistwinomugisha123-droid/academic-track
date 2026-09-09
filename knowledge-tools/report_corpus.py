"""Write the human coverage and legacy-migration reports from generated data."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "knowledge-sources" / "derived" / "manifests" / "source-registry.json"
MANIFEST = ROOT / "knowledge-sources" / "derived" / "manifests" / "knowledge-dataset-manifest.json"
QUEUE = ROOT / "knowledge-sources" / "review" / "human-review" / "review-queue.json"
VALIDATION = ROOT / "knowledge-sources" / "review" / "validation" / "knowledge-dataset-validation.json"
REPORT = ROOT / "knowledge-sources" / "review" / "knowledge-corpus-report.md"
LEGACY = ROOT / "knowledge-sources" / "review" / "legacy-curriculum-data-migration.md"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def markdown_table(rows: list[list[str]]) -> str:
    if not rows: return "No rows.\n"
    return "| " + " | ".join(rows[0]) + " |\n| " + " | ".join(["---"] * len(rows[0])) + " |\n" + "\n".join("| " + " | ".join(row) + " |" for row in rows[1:]) + "\n"


def main() -> None:
    registry = load(REGISTRY)["records"]
    manifest, queue, validation = load(MANIFEST), load(QUEUE), load(VALIDATION)
    unique = {}
    for source in registry:
        unique.setdefault(source["local_path"], source)
    sources = list(unique.values())
    by_level = Counter(source["education_level"] for source in sources)
    assessment_subjects = sorted({source["subject"] for source in sources if source["document_type"] in {"assessment-framework", "assessment-guidelines"} and source["subject"]})
    syllabus_subjects = sorted({source["subject"] for source in sources if source["document_type"] == "syllabus" and source["subject"]})
    missing_assessment = sorted(set(syllabus_subjects) - set(assessment_subjects))
    review_by_severity = Counter(item["severity"] for item in queue["items"])
    subject_sources: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for source in sources:
        subject_sources[(source["education_level"], source.get("subject") or "cross-level")].append(source)
    coverage_rows = [["Level", "Subject", "Sources", "Assessment guidance", "Production readiness"]]
    for (level, subject), members in sorted(subject_sources.items()):
        has_assessment = any(item["document_type"] in {"assessment-framework", "assessment-guidelines"} for item in members)
        coverage_rows.append([level, subject, str(len(members)), "yes" if has_assessment else "no", "NOT READY: rights and human review pending"])
    rights = Counter(source.get("rights_status", "UNKNOWN") for source in sources)
    report = [
        "# ATE Knowledge Corpus Report", "", "## Summary", "",
        f"- Unique source documents processed: {manifest['sourceCount']}",
        f"- Source spans created: {manifest['sourceSpanCount']}",
        f"- Curriculum candidates created: {manifest['curriculumCandidateCount']}",
        f"- Assessment candidates created: {manifest['assessmentCandidateCount']}",
        f"- Provenance relationships created: {manifest.get('relationshipCount', 0)}",
        f"- Validation errors: {len(validation['errors'])}",
        f"- Validation warnings: {len(validation['warnings'])}",
        f"- Human review queue: {len(queue['items'])} ({', '.join(f'{key}={value}' for key, value in sorted(review_by_severity.items())) or 'none'})", "",
        "## Coverage", "", f"Lower Secondary sources: {by_level['lower-secondary']}. Advanced Secondary sources: {by_level['advanced-secondary']}. Cross-level sources: {by_level['cross-level']}.", "", markdown_table(coverage_rows).rstrip(), "",
        "## Assessment Coverage", "", f"Subjects with dedicated assessment guidance: {', '.join(assessment_subjects) or 'none'}.", f"Syllabus subjects without a dedicated assessment-guideline source in this library: {', '.join(missing_assessment) or 'none'}.", "",
        "## Rights And Readiness", "", "All automatically extracted records remain `UNVERIFIED` or `REVIEW_REQUIRED`; none is marked `VERIFIED`. The source registry currently reports: " + ", ".join(f"{key}={value}" for key, value in sorted(rights.items())) + ".", "",
        "The dataset is mechanically suitable for a future PostgreSQL import after a rights decision and exception-focused human review. It is not production-ready as curriculum authority because the source registry has `PERMISSION_PENDING` material and extracted candidates are not yet verified.", "",
        "## Representation Limits", "", "The current pass preserves every page as a source span and emits heading/keyword candidates with page provenance. Complex tables, diagrams, merged cells, and subject-specific planner layouts remain review items rather than being flattened or inferred. This is intentional: source wording is retained and normalized metadata is kept separate from extraction candidates.", "",
        "## Validation", "", "The validation output is `knowledge-sources/review/validation/knowledge-dataset-validation.json`. It checks source resolution, page/span provenance, duplicate record IDs, relationship targets, and that automated output has not been marked verified.",
    ]
    REPORT.write_text("\n".join(report) + "\n", encoding="utf-8")

    legacy = [
        "# Legacy curriculum-data Migration Assessment", "",
        "## Current State", "", "`curriculum-data/` is an earlier, Biology-focused development extraction. The new private corpus contains the lower-secondary Biology syllabus again as a source-registry record, but it uses a new source ID and page-span contract. The legacy files must not be treated as equivalent to the new unverified corpus without provenance reconciliation.", "",
        "## Preserve", "", "- The legacy Biology entity IDs and relationship IDs where downstream prototype code still references them.", "- The detailed human-review annotations, because they describe known ambiguities in the previous manual extraction.", "- The runtime-context shape only as a temporary compatibility adapter, not as new source authority.", "",
        "## Do Not Migrate Blindly", "", "- Do not import legacy `VERIFIED`-style application states into the canonical knowledge layer; verification terminology and provenance contracts differ.", "- Do not merge records solely by display wording: page conventions, source identifiers, and extraction methods differ.", "- Do not treat the legacy framework and Biology files as current production content or proof of source rights.", "",
        "## Eventual Removal", "", "After a reviewed canonical lower-secondary Biology import exists and the application repository adapter is migrated, the Biology-specific runtime context and duplicate flat exports can be retired. Preserve the migration mapping and review history first.", "",
        "## Recommended Next Step", "", "Build a review workflow that lets curriculum experts verify the highest-priority page-span candidates, approve rights per source, and create an explicit legacy-ID to canonical-ID mapping before any PostgreSQL import.",
    ]
    LEGACY.write_text("\n".join(legacy) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
