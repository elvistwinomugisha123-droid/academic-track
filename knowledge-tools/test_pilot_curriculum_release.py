import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import fitz

import pilot_curriculum_release as pilot


class PilotCurriculumReleaseTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.patch = patch.object(pilot, "ROOT", self.root)
        self.patch.start()
        self.registry = {}
        self.records = []
        self.relationships = []
        self.decision = {"state": "OPERATOR_VERIFIED_FOR_PILOT",
                         "scope": "CONTROLLED_PILOT_CURRICULUM_ONLY",
                         "parserVersions": ["test-layout-1"], "sourceChecksums": {}}
        for source_id in pilot.SYLLABI:
            _, subject, level = pilot.SYLLABI[source_id]
            path = self.root / f"{source_id}.pdf"
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((72, 72), "TOPIC 1: Algebra 12 PERIODS")
            doc.save(path)
            doc.close()
            checksum = hashlib.sha256(path.read_bytes()).hexdigest()
            self.registry[source_id] = {"source_id": source_id, "document_type": "syllabus",
                "authority": "National Curriculum Development Centre (NCDC)",
                "subject": subject, "education_level": level,
                "local_path": path.name, "checksum_sha256": checksum,
                "rights_status": "OPERATOR_AUTHORIZED_FOR_PILOT"}
            self.decision["sourceChecksums"][source_id] = checksum
            item_id = source_id + ":topic:1"
            provenance = {"sourceId": source_id, "spanId": source_id + ":p1",
                          "pageStart": 1, "pageEnd": 1, "locator": "PDF page 1, heading"}
            self.records.append({"id": item_id, "entityType": "topic",
                "sourceWording": {"text": "TOPIC 1: Algebra 12 PERIODS"},
                "normalized": {"parentId": None, "periods": 12},
                "extracted": {"method": "test", "parserVersion": "test-layout-1"},
                "provenance": provenance})
            self.relationships.append({"id": source_id + ":defines:1", "relationshipType": "SOURCE_DEFINES_ENTITY",
                                       "fromId": source_id, "toId": item_id, "provenance": provenance})

    def tearDown(self):
        self.patch.stop()
        self.folder.cleanup()

    def verify(self, review=None):
        return pilot.verify_records(self.records, self.relationships, self.registry, review or [], self.decision)

    def test_explicit_checksum_bound_decision_accepts_source_backed_rows(self):
        records, relationships = self.verify()
        self.assertEqual(4, sum(len(items) for items in records.values()))
        self.assertEqual(0, sum(len(items) for items in relationships.values()))

    def test_checksum_change_fails_closed(self):
        source_id = next(iter(pilot.SYLLABI))
        self.decision["sourceChecksums"][source_id] = "0" * 64
        with self.assertRaisesRegex(ValueError, "checksum"):
            self.verify()

    def test_unapproved_source_fails_closed(self):
        source_id = next(iter(pilot.SYLLABI))
        self.registry[source_id]["rights_status"] = "UNKNOWN"
        with self.assertRaisesRegex(ValueError, "Unapproved"):
            self.verify()

    def test_open_review_item_fails_closed(self):
        source_id = next(iter(pilot.SYLLABI))
        with self.assertRaisesRegex(ValueError, "review"):
            self.verify([{"sourceId": source_id, "status": "open"}])

    def test_synthetic_wording_fails_closed(self):
        self.records[0]["sourceWording"]["text"] = "TOPIC 1: Imaginary synthetic syllabus 12 PERIODS"
        with self.assertRaisesRegex(ValueError, "Wording absent"):
            self.verify()

    def test_wrong_parent_fails_closed(self):
        self.records[0]["normalized"]["parentId"] = "invented-parent"
        with self.assertRaisesRegex(ValueError, "Detached"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
