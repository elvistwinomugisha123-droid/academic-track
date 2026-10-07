import tempfile
import unittest
import json
from pathlib import Path

import fitz

from pilot_assessment_rules import framework_pilot_subject_summary_candidates, framework_policy_candidates, guideline_ao_mapping_candidates, paper_structure_candidates
from pilot_assessment_pages import back_cover_decisions, example_page_decisions, framework_other_subject_decisions
from pilot_rotated_assessment import rotated_construct_table_candidates
from pilot_table import printed_table_gutters
from pilot_structured import TOPIC_NO_COLON_RE, extract_pilot_assessment, extract_pilot_syllabus


class PilotLayoutTests(unittest.TestCase):
    def official_record(self, source_name):
        path = Path(__file__).resolve().parents[1] / "knowledge-sources/derived/manifests/source-registry.json"
        records = json.loads(path.read_text(encoding="utf-8"))["records"]
        return next(record for record in records if source_name in record["local_path"])

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level-assessment/ASSESSMENT-FRAMEWORK-FOR-ADVANCED-SECONDARY-CURRICULUM-2026_Web-file.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_framework_conflicting_score_formula_stays_open(self):
        source = Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level-assessment/ASSESSMENT-FRAMEWORK-FOR-ADVANCED-SECONDARY-CURRICULUM-2026_Web-file.pdf"
        record = {"source_id": "test-framework", "local_path": str(source), "subject": None,
                  "education_level": "advanced-secondary", "document_type": "assessment-framework"}
        _, _, review = extract_pilot_assessment(record)
        self.assertTrue(any(item["page"] == 21 and "five times" in item["problem"] for item in review))
        official = self.official_record("ASSESSMENT-FRAMEWORK-FOR-ADVANCED")
        with fitz.open(source) as document:
            policies = framework_policy_candidates(official, document)
            summaries = framework_pilot_subject_summary_candidates(official, document)
            covers = back_cover_decisions(official, document)
            other_subjects = framework_other_subject_decisions(official, document)
        self.assertEqual({item["normalized"]["ruleType"] for item in policies},
                         {"assessment_principles", "formative_guidance", "school_level_aoi", "end_cycle_assessment"})
        self.assertTrue(all(item["provenance"]["pageStart"] in (8, 9) for item in policies))
        self.assertEqual([(item["normalized"]["subject"], item["normalized"]["numberOfConstructs"], item["normalized"]["numberOfPapers"])
                          for item in summaries], [("Chemistry", 4, 2), ("Principal Mathematics", 5, 2)])
        self.assertEqual([item["page"] for item in covers], [26])
        self.assertEqual([item["page"] for item in other_subjects], [12, 13, 14, 15, 17])
        items, _, review = extract_pilot_assessment(official)
        scoring = [item for item in items if item["id"].endswith("p21:written-maximum")]
        self.assertEqual(len(scoring), 1)
        self.assertEqual(scoring[0]["normalized"]["maximumScorePerBase"], 5)
        self.assertFalse(scoring[0]["normalized"]["scoreBandsDerivable"])
        self.assertFalse(any("five times" in item["problem"] for item in review))
        altered = {**official, "checksum_sha256": "0" * 64}
        altered_items, _, altered_review = extract_pilot_assessment(altered)
        self.assertFalse(any(item["id"].endswith("p21:written-maximum") for item in altered_items))
        self.assertTrue(any("five times" in item["problem"] for item in altered_review))

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level-assessment/Chemistry-Assessment-Guidelines-01.04.Web_File.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_chemistry_paper_rules_keep_source_conflict_open(self):
        source = Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level-assessment/Chemistry-Assessment-Guidelines-01.04.Web_File.pdf"
        record = {"source_id": "test-chem-guide", "local_path": str(source), "subject": "Chemistry",
                  "education_level": "advanced-secondary", "document_type": "assessment-guidelines"}
        with fitz.open(source) as document:
            papers = paper_structure_candidates(record, document)
        self.assertEqual([(item["provenance"]["pageStart"], item["normalized"]["durationMinutes"])
                          for item in papers], [(26, 165), (26, 195)])
        self.assertTrue(all(item["verificationStatus"] == "REVIEW_REQUIRED" for item in papers))
        _, _, review = extract_pilot_assessment(record)
        self.assertTrue(any("conflict" in item["problem"] and item["page"] == 26 for item in review))
        official = self.official_record("Chemistry-Assessment-Guidelines")
        items, _, review = extract_pilot_assessment(official)
        with fitz.open(source) as document:
            ao_rows = guideline_ao_mapping_candidates(official, document)
            changed_ao_rows = guideline_ao_mapping_candidates({**official, "checksum_sha256": "0" * 64}, document)
        self.assertEqual([item["normalized"]["assessmentObjective"] for item in ao_rows], ["AO1", "AO2", "AO3", "AO4"])
        self.assertEqual([item["normalized"]["assessmentObjective"] for item in changed_ao_rows], ["AO1", "AO2"])
        self.assertEqual(ao_rows[1]["provenance"]["pageEnd"], 9)
        paper_one = next(item for item in items if item["id"].endswith("p26:paper1"))
        self.assertEqual(paper_one["normalized"]["constructMappingAuthority"], "Table 1, PDF pages 9–10")
        self.assertEqual(paper_one["normalized"]["constructNamesByObjective"]["AO3"], "Thermochemistry, Electrochemistry and Reaction Kinetics")
        self.assertFalse(any("conflict" in item["problem"] for item in review))
        with fitz.open(source) as document:
            example_pages = example_page_decisions(official, document)
        self.assertEqual(len(example_pages), 35)
        self.assertEqual((example_pages[0]["page"], example_pages[-1]["page"]), (27, 61))
        altered = {**official, "checksum_sha256": "0" * 64}
        _, _, altered_review = extract_pilot_assessment(altered)
        self.assertTrue(any("conflict" in item["problem"] for item in altered_review))

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level-assessment/Chemistry-Assessment-Guidelines-01.04.Web_File.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_rotated_chemistry_construct_table_keeps_printed_columns_and_ao_boundary(self):
        record = self.official_record("Chemistry-Assessment-Guidelines")
        with fitz.open(record["local_path"]) as document:
            items, relations = rotated_construct_table_candidates(record, document)
            stale, _ = rotated_construct_table_candidates({**record, "checksum_sha256": "0" * 64}, document)
        self.assertEqual(stale, [])
        first = next(item for item in items if item["entityType"] == "assessment_objective" and item["normalized"]["constructGroup"] == "AO1")
        self.assertEqual(first["sourceWording"]["label"], "1")
        self.assertIn("deduce electronic configurations", first["sourceWording"]["text"])
        self.assertTrue(any(item["entityType"] == "ability" and item["sourceWording"]["text"].startswith("a) apply the Aufbau") for item in items))
        self.assertTrue(any(item["entityType"] == "indicator" and item["sourceWording"]["text"].startswith("i) writes electronic") for item in items))
        self.assertFalse(any(link["toId"] == item["id"] for link in relations for item in items if item["normalized"]["constructGroup"] == "AO3_AO4_SHARED"))

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level-assessment/Principle-Mathematics-Assessment-Guidelines-01.04.Web_File.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_rotated_principal_mathematics_table_keeps_cross_page_outcome(self):
        record = self.official_record("Principle-Mathematics-Assessment-Guidelines")
        with fitz.open(record["local_path"]) as document:
            items, relationships = rotated_construct_table_candidates(record, document)
        outcomes = [item for item in items if item["entityType"] == "assessment_objective"]
        self.assertEqual(len(outcomes), 27)
        second = next(item for item in outcomes if item["normalized"]["constructGroup"] == "AO1" and item["sourceWording"]["label"] == "2")
        self.assertEqual((second["provenance"]["pageStart"], second["provenance"]["pageEnd"]), (12, 13))
        self.assertIn(f"{record['source_id']}:p13", second["provenance"]["additionalSpanIds"])
        self.assertEqual(len(relationships), len(items))

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level-assessment/Principle-Mathematics-Assessment-Guidelines-01.04.Web_File.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_principle_title_maps_to_principal_mathematics_papers(self):
        source = Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level-assessment/Principle-Mathematics-Assessment-Guidelines-01.04.Web_File.pdf"
        record = {"source_id": "test-math-guide", "local_path": str(source), "subject": "Principal Mathematics",
                  "education_level": "advanced-secondary", "document_type": "assessment-guidelines"}
        with fitz.open(source) as document:
            papers = paper_structure_candidates(record, document)
        self.assertEqual([(item["provenance"]["pageStart"], item["normalized"]["durationMinutes"])
                          for item in papers], [(43, 140), (43, 135)])
        self.assertTrue(all(item["normalized"]["subject"] == "Principal Mathematics" for item in papers))
        official = self.official_record("Principle-Mathematics-Assessment-Guidelines")
        with fitz.open(source) as document:
            decisions = example_page_decisions(official, document)
            changed = example_page_decisions({**official, "checksum_sha256": "0" * 64}, document)
            ao_rows = guideline_ao_mapping_candidates(official, document)
        self.assertEqual(len(decisions), 73)
        self.assertEqual((decisions[0]["page"], decisions[-1]["page"]), (44, 116))
        self.assertEqual(changed, [])
        self.assertTrue(all(item["verificationStatus"] == "REVIEW_REQUIRED" for item in decisions))
        self.assertEqual([item["normalized"]["assessmentObjective"] for item in ao_rows], ["AO1", "AO2", "AO3", "AO4", "AO5"])
        self.assertEqual((ao_rows[2]["provenance"]["pageStart"], ao_rows[2]["provenance"]["pageEnd"]), (9, 10))

    def test_detailed_topic_heading_without_colon_keeps_its_periods(self):
        match = TOPIC_NO_COLON_RE.match("TOPIC 1 LINES AND PLANES IN THREE DIMENSIONS 20 PERIODS")
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), "1")

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/o-level/chemistry syllbus.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_printed_chemistry_topic_numbers_survive_pdf_text_layer_distortion(self):
        source = Path(__file__).resolve().parents[1] / "knowledge-sources/raw/o-level/chemistry syllbus.pdf"
        record = {"source_id": "test-real-chemistry", "local_path": str(source),
                  "subject": "Chemistry", "education_level": "lower-secondary"}
        items, _, _ = extract_pilot_syllabus(record)
        observed = {(item["provenance"]["pageStart"], item["normalized"].get("topicNumber"))
                    for item in items if item["entityType"] == "topic"}
        self.assertIn((23, "3.1"), observed)
        self.assertIn((27, "5.1"), observed)
        page_17_activities = [item["sourceWording"]["text"] for item in items
                              if item["entityType"] == "activity" and item["provenance"]["pageStart"] == 17]
        self.assertEqual(len(page_17_activities), 5)
        self.assertTrue(all(value.startswith("• ") for value in page_17_activities))

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/o-level/chemistry syllbus.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_lower_chemistry_water_outcomes_retain_printed_letters_and_parent(self):
        record = self.official_record("chemistry syllbus.pdf")
        items, relationships, review = extract_pilot_syllabus(record)
        water = next(item for item in items if item["entityType"] == "topic" and item["provenance"]["pageStart"] == 25)
        outcomes = [item for item in items if item["entityType"] == "learning_outcome"
                    and item["provenance"]["pageStart"] == 25]
        self.assertEqual([item["sourceWording"]["text"][:2] for item in outcomes], ["a.", "b.", "c."])
        self.assertTrue(all(item["normalized"]["parentId"] == water["id"] for item in outcomes))
        self.assertTrue(all(any(link["fromId"] == water["id"] and link["toId"] == item["id"] for link in relationships)
                            for item in outcomes))
        self.assertFalse(any(item["page"] == 25 and "Unmarked learning_outcome" in item["problem"] for item in review))
        self.assertFalse(any(item["page"] == 21 and "Multiple lettered learning_outcome" in item["problem"] for item in review))
        periodic_table_activities = [item["sourceWording"]["text"] for item in items
                                     if item["entityType"] == "activity" and item["provenance"]["pageStart"] == 29]
        self.assertTrue(periodic_table_activities[0].startswith("• In groups, learners"))
        self.assertFalse(any(value == "• oxygen" for value in periodic_table_activities))
        self.assertTrue(any("• oxygen" in value for value in periodic_table_activities))
        self.assertFalse(any(item["page"] == 29 and item["problem"].startswith("Unmarked") for item in review))

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level/CHEMISTRY.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_advanced_chemistry_activity_letters_do_not_pollute_outcomes(self):
        source = Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level/CHEMISTRY.pdf"
        record = {"source_id": "test-real-advanced-chemistry", "local_path": str(source),
                  "subject": "Chemistry", "education_level": "advanced-secondary"}
        items, _, review = extract_pilot_syllabus(record)
        outcomes = [item["sourceWording"]["text"] for item in items
                    if item["entityType"] == "learning_outcome" and item["provenance"]["pageStart"] == 29]
        self.assertEqual(len(outcomes), 2)
        self.assertTrue(outcomes[0].endswith("exceptions. (u, s)"))
        self.assertTrue(outcomes[1].endswith("relationships. (u, s v/a)"))
        self.assertFalse(any(item["page"] in (23, 24, 31, 41, 47)
                             and item["problem"].startswith("Unmarked learning_outcome") for item in review))
        continued = [item for item in items if item["entityType"] == "learning_outcome"
                     and item["provenance"]["pageStart"] == 43 and item["provenance"]["pageEnd"] == 44
                     and "mineral formation" in item["sourceWording"]["text"]]
        self.assertEqual(len(continued), 1)
        self.assertFalse(any(item["page"] == 44 and item["problem"].startswith("Unmarked learning_outcome") for item in review))

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level/PRINCIPAL MATHS.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_principal_mathematics_variable_gutters_keep_activity_letters_out_of_outcomes(self):
        source = Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level/PRINCIPAL MATHS.pdf"
        record = {"source_id": "test-real-principal-mathematics", "local_path": str(source),
                  "subject": "Principal Mathematics", "education_level": "advanced-secondary"}
        items, _, _ = extract_pilot_syllabus(record)
        outcomes = [item["sourceWording"]["text"] for item in items
                    if item["entityType"] == "learning_outcome" and item["provenance"]["pageStart"] == 79]
        self.assertEqual(outcomes, ["a) explain the algebra of complex numbers. (k, s, u, v/a, gs)"])

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/a-level/PRINCIPAL MATHS.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_principal_mathematics_page_continuation_keeps_both_spans(self):
        record = self.official_record("PRINCIPAL MATHS.pdf")
        items, _, review = extract_pilot_syllabus(record)
        continued = [item for item in items if item["entityType"] == "activity"
                     and item["provenance"]["pageStart"] == 26
                     and item["provenance"]["pageEnd"] == 27
                     and "relationship between gradients of parallel lines" in item["sourceWording"]["text"]]
        self.assertEqual(len(continued), 1)
        self.assertIn(f"{record['source_id']}:p27", continued[0]["provenance"]["additionalSpanIds"])
        self.assertFalse(any(item["page"] == 27 and item["problem"].startswith("Unmarked activity") for item in review))

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/o-level/Mathematics_Syllabus_compressed.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_mathematics_topic_embedded_after_theme_is_retained(self):
        source = Path(__file__).resolve().parents[1] / "knowledge-sources/raw/o-level/Mathematics_Syllabus_compressed.pdf"
        record = {"source_id": "test-real-mathematics", "local_path": str(source),
                  "subject": "Mathematics", "education_level": "lower-secondary"}
        items, _, _ = extract_pilot_syllabus(record)
        observed = {(item["provenance"]["pageStart"], item["normalized"].get("title"))
                    for item in items if item["entityType"] == "topic"}
        self.assertIn((28, "ALGEBRA 1"), observed)
        self.assertEqual(len(observed), 45)

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/o-level/Mathematics_Syllabus_compressed.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_lower_mathematics_changed_table_gutter_keeps_outcome_column(self):
        record = self.official_record("Mathematics_Syllabus_compressed.pdf")
        items, _, _ = extract_pilot_syllabus(record)
        page_59 = [item["sourceWording"]["text"] for item in items
                   if item["entityType"] == "learning_outcome" and item["provenance"]["pageStart"] == 59]
        self.assertEqual(len(page_59), 3)
        self.assertTrue(page_59[0].startswith("a) build formula from word statements"))
        self.assertTrue(page_59[1].startswith("b) re-write a given formula"))
        self.assertTrue(page_59[2].startswith("c) solve equations and inequalities"))
        self.assertFalse(any("Bayo" in value for value in page_59))

    @unittest.skipUnless((Path(__file__).resolve().parents[1] / "knowledge-sources/raw/o-level/Mathematics_Syllabus_compressed.pdf").exists(),
                         "Private pilot PDF is absent")
    def test_printed_grid_gutters_follow_each_lower_mathematics_table(self):
        record = self.official_record("Mathematics_Syllabus_compressed.pdf")
        with fitz.open(record["local_path"]) as document:
            for page_number, expected in ((20, (191, 376)), (31, (191, 334)), (59, (168, 422))):
                with self.subTest(page=page_number):
                    page = document[page_number - 1]
                    header = page.search_for("LEARNING OUTCOMES")[0]
                    observed = printed_table_gutters(page, header.y1, page.rect.height - 70,
                                                      page.get_pixmap(colorspace=fitz.csGRAY))
                    self.assertEqual(observed, expected)

    def test_assessment_pages_queue_unmapped_rules_with_page_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / "assessment-layout.pdf"
            document = fitz.open()
            for index in range(8):
                page = document.new_page()
                if index == 7:
                    page.insert_text((72, 110), "Assessment Objective")
                    page.insert_textbox(fitz.Rect(72, 145, 520, 300),
                        "The learner must apply the assessed construct to a scenario. " * 4)
            document.save(pdf)
            document.close()
            record = {"source_id": "test-assessment", "local_path": str(pdf),
                      "subject": "Chemistry", "education_level": "advanced-secondary", "document_type": "assessment-guidelines"}
            items, _, review = extract_pilot_assessment(record)
            self.assertEqual(len(items), 1)
            self.assertEqual([item["page"] for item in review], [8])
            self.assertIn("The learner", review[0]["extractedValue"])

    def test_detailed_syllabus_anchors_exclude_front_matter_and_link_columns(self):
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / "synthetic-layout.pdf"
            document = fitz.open()
            for index in range(13):
                page = document.new_page()
                if index == 1:
                    page.insert_text((72, 120), "TOPIC 99: Contents Entry Duration: 10 Periods")
                if index == 12:
                    page.insert_text((72, 100), "2.0 DETAILED SYLLABUS")
                    page.insert_text((72, 135), "SENIOR FIVE TERM 1")
                    page.insert_text((72, 170), "TOPIC 1: Mole Concepts Duration: 12 Periods")
                    page.insert_text((72, 205), "Competency: The learner applies mole concepts.")
                    page.insert_text((78, 250), "Learning Outcome")
                    page.insert_text((78, 305), "a) calculate moles. (u)")
                    page.insert_text((226, 325), "a) Learners measure.")
                    page.insert_text((380, 345), "a) Observe work.")
            document.save(pdf)
            document.close()
            record = {"source_id": "test-source", "local_path": str(pdf), "subject": "Chemistry",
                      "education_level": "advanced-secondary"}
            items, relationships, review = extract_pilot_syllabus(record)
            topics = [item for item in items if item["entityType"] == "topic"]
            self.assertEqual(len(topics), 1)
            self.assertEqual(topics[0]["normalized"]["title"], "Mole Concepts")
            self.assertEqual(topics[0]["normalized"]["periods"], 12)
            self.assertEqual(topics[0]["normalized"]["level"], "S5")
            self.assertEqual(topics[0]["normalized"]["term"], "1")
            self.assertEqual({item["entityType"] for item in items}, {"topic", "competency", "learning_outcome", "activity", "assessment_strategy"})
            self.assertTrue(all(item["verificationStatus"] == "REVIEW_REQUIRED" for item in items))
            self.assertTrue(any(rel["fromId"] == topics[0]["id"] for rel in relationships))
            self.assertEqual(review, [])


if __name__ == "__main__":
    unittest.main()
