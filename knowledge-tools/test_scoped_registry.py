"""The pilot selector must not expand to unrelated catalogue entries."""

import copy
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from build_source_registry import CATALOG_PATH, PILOT_AUTHORIZATION_PATH, PILOT_SUBJECTS, apply_pilot_authorization, available_pilot_sources, select_sources


class ScopedRegistryTests(unittest.TestCase):
    def setUp(self):
        self.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_pilot_selects_four_subject_levels_and_shared_framework(self):
        entries, shared = select_sources(self.catalog, "pilot-math-chem")
        self.assertEqual({(entry["education_level"], entry["subject"]) for entry in entries}, PILOT_SUBJECTS)
        self.assertEqual(sum(len(entry["sources"]) for entry in entries) + len(shared), 7)
        self.assertEqual(shared[0]["document_type"], "assessment-framework")

    def test_full_catalogue_remains_default_selection(self):
        entries, shared = select_sources(self.catalog, "all")
        self.assertEqual(entries, self.catalog["entries"])
        self.assertEqual(shared, self.catalog["shared_sources"])

    def test_missing_pilot_subject_fails_closed(self):
        catalog = copy.deepcopy(self.catalog)
        catalog["entries"] = [entry for entry in catalog["entries"] if entry["subject"] != "Principal Mathematics"]
        with self.assertRaisesRegex(ValueError, "missing a required subject"):
            select_sources(catalog, "pilot-math-chem")

    def test_missing_pdf_blocks_only_its_subject(self):
        entries, shared = select_sources(self.catalog, "pilot-math-chem")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for entry in entries:
                for source in entry["sources"]:
                    path = root / source["relative_path"]
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.touch()
            for source in shared:
                path = root / source["relative_path"]
                path.parent.mkdir(parents=True, exist_ok=True)
                path.touch()
            (root / "o-level/chemistry syllbus.pdf").unlink()
            selected, framework, blocked = available_pilot_sources(entries, shared, root)
            self.assertEqual(len(selected), 3)
            self.assertEqual(len(framework), 1)
            self.assertEqual(blocked[0]["subject"], "Chemistry")
            self.assertEqual(blocked[0]["education_level"], "lower-secondary")

    def test_authorization_requires_exact_checksum_and_recorded_decision(self):
        authorization = json.loads(PILOT_AUTHORIZATION_PATH.read_text(encoding="utf-8"))
        source = authorization["sources"][0]
        record = {"local_path": "knowledge-sources/raw/" + source["relative_path"], "checksum_sha256": source["sha256"]}
        apply_pilot_authorization([record], authorization)
        self.assertEqual(record["rights_status"], "OPERATOR_AUTHORIZED_FOR_PILOT")
        self.assertEqual(record["authorization_reference"], authorization["decision_source"])
        with self.assertRaisesRegex(ValueError, "No matching checksum"):
            apply_pilot_authorization([{**record, "checksum_sha256": "0" * 64}], authorization)
        with self.assertRaisesRegex(ValueError, "explicit operator"):
            apply_pilot_authorization([record], {**authorization, "decision_source": ""})

    def test_private_raw_pdfs_are_gitignored(self):
        authorization = json.loads(PILOT_AUTHORIZATION_PATH.read_text(encoding="utf-8"))
        root = CATALOG_PATH.parents[2]
        paths = ["knowledge-sources/raw/" + item["relative_path"] for item in authorization["sources"]]
        result = subprocess.run(["git", "check-ignore", "--stdin"], input="\n".join(paths) + "\n",
                                cwd=root, text=True, capture_output=True, check=True)
        self.assertEqual(set(result.stdout.splitlines()), set(paths))


if __name__ == "__main__":
    unittest.main()
