"""Deterministic integrity checks for local generated ATE knowledge data."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from pilot_verification import apply_verified_decisions

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "knowledge-sources" / "derived" / "manifests" / "source-registry.json"
STRUCTURED = ROOT / "knowledge-sources" / "derived" / "structured"
SPANS = ROOT / "knowledge-sources" / "derived" / "source-spans" / "source-spans.jsonl"
RELATIONSHIPS = STRUCTURED / "curriculum-relationships.jsonl"
REPORT = ROOT / "knowledge-sources" / "review" / "validation" / "knowledge-dataset-validation.json"


def lines(path: Path):
    if not path.exists(): return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> None:
    registry_records = json.loads(REGISTRY.read_text(encoding="utf-8"))["records"]
    canonical_records = {}
    for source in registry_records:
        canonical_records.setdefault(source["local_path"], source)
    sources = {item["source_id"] for item in canonical_records.values()}
    spans = lines(SPANS)
    records = lines(STRUCTURED / "curriculum-items.jsonl") + lines(STRUCTURED / "assessment-items.jsonl")
    relationships = lines(RELATIONSHIPS)
    errors, warnings = [], []
    expected_records = [{**item, "verificationStatus": "REVIEW_REQUIRED"} for item in records]
    applied_decisions = apply_verified_decisions(expected_records, list(canonical_records.values()))
    approved = {decision["recordId"]: decision["decisionId"] for decision in applied_decisions}
    identifiers = [item.get("id") for item in records]
    for duplicate, count in Counter(identifiers).items():
        if duplicate and count > 1: errors.append({"code": "DUPLICATE_ID", "id": duplicate, "count": count})
    span_ids = {item.get("id") for item in spans}
    for item in records:
        provenance = item.get("provenance", {})
        if item.get("verificationStatus") == "VERIFIED" and item.get("verificationDecisionId") != approved.get(item.get("id")):
            errors.append({"code": "AUTO_VERIFIED", "id": item.get("id")})
        if item.get("id") in approved and item.get("verificationStatus") != "VERIFIED":
            errors.append({"code": "MISSING_VERIFICATION", "id": item.get("id")})
        if provenance.get("sourceId") not in sources: errors.append({"code": "UNKNOWN_SOURCE", "id": item.get("id")})
        if provenance.get("spanId") not in span_ids: errors.append({"code": "UNKNOWN_SOURCE_SPAN", "id": item.get("id")})
        if not isinstance(provenance.get("pageStart"), int) or provenance.get("pageStart", 0) < 1: errors.append({"code": "INVALID_PAGE", "id": item.get("id")})
        if not item.get("sourceWording", {}).get("text"): warnings.append({"code": "EMPTY_SOURCE_WORDING", "id": item.get("id")})
    record_ids = set(identifiers)
    for relationship in relationships:
        if relationship.get("verificationStatus") == "VERIFIED": errors.append({"code": "AUTO_VERIFIED_RELATIONSHIP", "id": relationship.get("id")})
        if relationship.get("relationshipType") == "SOURCE_DEFINES_ENTITY" and relationship.get("fromId") not in sources: errors.append({"code": "UNKNOWN_RELATIONSHIP_SOURCE", "id": relationship.get("id")})
        if relationship.get("toId") not in record_ids: errors.append({"code": "UNKNOWN_RELATIONSHIP_TARGET", "id": relationship.get("id")})
        if relationship.get("provenance", {}).get("spanId") not in span_ids: errors.append({"code": "UNKNOWN_RELATIONSHIP_SPAN", "id": relationship.get("id")})
    report = {"schemaVersion": "ate-knowledge-validation-v1", "sourceCount": len(sources), "sourceSpanCount": len(spans), "recordCount": len(records), "relationshipCount": len(relationships), "errors": errors, "warnings": warnings, "valid": not errors}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
