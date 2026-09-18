import { describe, expect, it } from "vitest";
import { assessmentToCanonicalArtifact } from "./assessment";
import { assertCanonicalArtifactVersion } from "./types";
import { MarkingGuideDocument, QuestionPaperDocument } from "@/pdf/assessment-documents";
import type { Assessment } from "@/domain/types";

const assessment: Assessment = { id: "assessment-test", mode: "FORMATIVE_CHECK", title: "Plant structure check", sectionIds: ["section-test"], durationMinutes: 20, totalMarks: 4, allowedLearningOutcomeIds: ["outcome-test"], excludedLearningOutcomeIds: [], questions: [{ id: "question-test", text: "Name one plant tissue.", marks: 4, type: "SHORT_ANSWER", difficulty: "LOW", learningOutcomeIds: ["outcome-test"], markingGuide: ["Names a relevant tissue"] }], status: "DRAFT", provenance: [{ category: "TEACHER", label: "Teacher authored" }] };

describe("canonical artifact rendering boundary", () => {
  it("creates a typed immutable-version input for renderers", () => {
    const artifact = assessmentToCanonicalArtifact(assessment, "assessment-test-v2");
    expect(artifact).toMatchObject({ artifactId: "assessment-test", versionId: "assessment-test-v2", artifactType: "ASSESSMENT", status: "DRAFT", curriculumAnchorIds: ["outcome-test"] });
    expect(artifact.payload.questions[0].text).toBe("Name one plant tissue.");
    expect(() => assertCanonicalArtifactVersion({ ...artifact, versionId: undefined })).toThrow();
  });

  it("feeds both existing PDF concepts from the same canonical version", () => {
    const artifact = assessmentToCanonicalArtifact(assessment);
    expect(QuestionPaperDocument({ artifact })).toBeTruthy();
    expect(MarkingGuideDocument({ artifact })).toBeTruthy();
  });
});
