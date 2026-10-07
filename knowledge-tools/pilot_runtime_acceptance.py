"""Deterministic curriculum-context acceptance for the four pilot profiles."""

from __future__ import annotations

import json
from pathlib import Path

from pilot_curriculum_release import DERIVED, ROOT, build, rows


def acceptance() -> dict:
    manifests = build()
    corpus = {item["id"]: item for item in rows(DERIVED / "structured/curriculum-items.jsonl")}
    relations = {item["id"]: item for item in rows(DERIVED / "structured/curriculum-relationships.jsonl")}
    profiles = []
    for manifest in manifests:
        assert manifest["assessmentReadiness"] == "ASSESSMENT_RUNTIME_NOT_READY"
        assert not manifest["assessmentRuntimeRecordIds"]
        for profile in manifest["profiles"]:
            members = set(profile["recordIds"])
            assert members == set(profile["orderedRecordIds"])
            assert len(members) == len(profile["orderedRecordIds"])
            assert all(corpus[item_id]["provenance"]["sourceId"] == profile["sourceId"] for item_id in members)
            assert all(relations[link_id]["fromId"] in members and relations[link_id]["toId"] in members
                       for link_id in profile["relationshipIds"])
            outcomes = [corpus[item_id] for item_id in profile["orderedRecordIds"]
                        if corpus[item_id]["entityType"] == "learning_outcome"]
            assert outcomes, f"No selectable outcomes: {profile['subject']}"
            selected = outcomes[0]
            parent_id = selected["normalized"]["parentId"]
            assert parent_id in members
            parent = corpus[parent_id]
            if parent["entityType"] == "subtopic":
                topic_id = parent["normalized"]["parentId"]
                assert topic_id in members and corpus[topic_id]["entityType"] == "topic"
            else:
                topic_id = parent_id
                assert parent["entityType"] == "topic"
            topic = corpus[topic_id]
            assert selected["normalized"]["level"] in ("S1", "S2", "S3", "S4") if profile["educationLevel"] == "lower-secondary" else selected["normalized"]["level"] in ("S5", "S6")
            provenance = selected["provenance"]
            assert provenance["pageStart"] > 0 and provenance["spanId"] == f"{profile['sourceId']}:p{provenance['pageStart']}"
            context = {"subject": profile["subject"], "educationLevel": profile["educationLevel"],
                       "classLevel": selected["normalized"]["level"], "topic": topic["normalized"]["title"],
                       "subtopic": parent["normalized"]["title"] if parent["entityType"] == "subtopic" else None,
                       "learningOutcome": selected["sourceWording"]["text"],
                       "sourceId": profile["sourceId"], "sourcePage": provenance["pageStart"],
                       "canonicalPositionId": profile["orderedCanonicalRecordIds"][profile["orderedRecordIds"].index(selected["id"])]}
            assert all(context[key] for key in ("subject", "educationLevel", "classLevel", "topic", "learningOutcome", "sourceId", "sourcePage", "canonicalPositionId"))
            profiles.append({"releaseKey": manifest["releaseKey"], "profileId": profile["profileId"],
                             "subject": profile["subject"], "recordCount": len(members),
                             "relationshipCount": len(profile["relationshipIds"]),
                             "topicCount": profile["countsByType"]["topic"],
                             "outcomeCount": profile["countsByType"]["learning_outcome"],
                             "positionSelection": context["canonicalPositionId"],
                             "lessonContext": context, "teachingPackContext": context, "askAteContext": context,
                             "curriculumRuntimeReady": True, "assessmentRuntimeReady": False})
    assert len(profiles) == 4
    return {"schemaVersion": "ate-pilot-runtime-acceptance-v1", "profiles": profiles,
            "lowerSecondaryInheritedAdvancedAssessment": False}


if __name__ == "__main__":
    report = acceptance()
    destination = DERIVED / "releases/runtime-acceptance.json"
    destination.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"profiles": len(report["profiles"]), "curriculumReady": [p["subject"] for p in report["profiles"]],
                      "assessmentReady": sum(p["assessmentRuntimeReady"] for p in report["profiles"])}))
