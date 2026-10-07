"""Apply individually reviewed, checksum-bound pilot assessment decisions.

The ledger is deliberately an allowlist of exact record hashes. Extraction never
grants verification merely because a parser matched a page.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


LEDGER = Path(__file__).resolve().parent / "catalog" / "pilot-verification-decisions.json"


def record_digest(item: dict[str, Any]) -> str:
    material = {key: item[key] for key in ("id", "entityType", "sourceWording", "normalized", "provenance")}
    return hashlib.sha256(json.dumps(material, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def apply_verified_decisions(items: list[dict[str, Any]], registry: list[dict[str, Any]],
                             path: Path = LEDGER) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    decisions = json.loads(path.read_text(encoding="utf-8"))["decisions"]
    by_id = {item["id"]: item for item in items}
    sources = {source["source_id"]: source for source in registry}
    applied = []
    for decision in decisions:
        item = by_id.get(decision["recordId"])
        source = sources.get(decision["sourceId"])
        if (not item or not source or decision["decision"] != "VERIFIED"
                or decision.get("decisionAuthority") != "SOURCE_COMPARISON"
                or not decision.get("basis") or not decision.get("decisionDate")):
            continue
        provenance = item["provenance"]
        if (source["checksum_sha256"] != decision["sourceChecksumSha256"]
                or provenance["sourceId"] != decision["sourceId"]
                or provenance["pageStart"] != decision["pageStart"]
                or provenance["pageEnd"] != decision["pageEnd"]
                or record_digest(item) != decision["recordSha256"]):
            continue
        item["verificationStatus"] = "VERIFIED"
        item["verificationDecisionId"] = decision["decisionId"]
        applied.append(decision)
    return applied
