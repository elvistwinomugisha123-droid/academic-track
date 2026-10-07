import copy
import json
import tempfile
import unittest
from pathlib import Path

from pilot_verification import apply_verified_decisions, record_digest


class PilotVerificationTests(unittest.TestCase):
    def setUp(self):
        self.item = {"id": "source:ao1", "entityType": "construct",
                     "sourceWording": {"text": "AO1 printed rule"},
                     "normalized": {"subject": "Chemistry"},
                     "provenance": {"sourceId": "source", "pageStart": 9, "pageEnd": 9},
                     "verificationStatus": "REVIEW_REQUIRED"}
        self.source = {"source_id": "source", "checksum_sha256": "a" * 64}
        self.decision = {"decisionId": "review-ao1", "recordId": self.item["id"],
                         "recordSha256": record_digest(self.item), "sourceId": "source",
                         "sourceChecksumSha256": "a" * 64, "pageStart": 9, "pageEnd": 9,
                         "decision": "VERIFIED", "basis": "Direct comparison with printed PDF page 9",
                         "decisionAuthority": "SOURCE_COMPARISON", "decisionDate": "2026-10-07"}

    def apply(self, item=None, source=None, decision=None):
        item = copy.deepcopy(item or self.item)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "decisions.json"
            path.write_text(json.dumps({"decisions": [decision or self.decision]}))
            result = apply_verified_decisions([item], [source or self.source], path)
        return result, item

    def test_explicit_exact_decision_verifies(self):
        decisions, item = self.apply()
        self.assertEqual(len(decisions), 1)
        self.assertEqual(item["verificationStatus"], "VERIFIED")
        self.assertEqual(item["verificationDecisionId"], "review-ao1")

    def test_changed_source_checksum_invalidates(self):
        decisions, item = self.apply(source={**self.source, "checksum_sha256": "b" * 64})
        self.assertEqual(decisions, [])
        self.assertEqual(item["verificationStatus"], "REVIEW_REQUIRED")

    def test_changed_record_or_page_invalidates(self):
        for change in ({"normalized": {"subject": "Mathematics"}},
                       {"provenance": {"sourceId": "source", "pageStart": 10, "pageEnd": 10}}):
            with self.subTest(change=change):
                decisions, item = self.apply(item={**self.item, **change})
                self.assertEqual(decisions, [])
                self.assertEqual(item["verificationStatus"], "REVIEW_REQUIRED")

    def test_missing_or_nonverifying_decision_never_grants_verification(self):
        decisions, item = self.apply(decision={**self.decision, "decision": "REVIEW_REQUIRED"})
        self.assertEqual(decisions, [])
        self.assertEqual(item["verificationStatus"], "REVIEW_REQUIRED")
        decisions, item = self.apply(decision={**self.decision, "decisionAuthority": "PARSER"})
        self.assertEqual(decisions, [])
        self.assertEqual(item["verificationStatus"], "REVIEW_REQUIRED")


if __name__ == "__main__":
    unittest.main()
