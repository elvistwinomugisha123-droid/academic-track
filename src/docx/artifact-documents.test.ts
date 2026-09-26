import { describe, expect, it } from "vitest";
import { assertCanonicalArtifactVersion } from "@/artifacts/types";
import { renderAssessmentDocx, renderLessonArtifactDocx } from "./artifact-documents";

const zipSignature = (value: Uint8Array) => Array.from(value.subarray(0, 4));

describe("DOCX artifact rendering", () => {
  it("renders a lesson artifact as a non-empty Office document", async () => {
    const artifact = assertCanonicalArtifactVersion({ artifactId: "a", versionId: "v1", artifactType: "HOMEWORK", status: "DRAFT", ownerScope: "section", curriculumAnchorIds: [], provenance: [{ category: "CURRICULUM", label: "Biology syllabus", sourceLocation: "page 12" }], payload: { title: "Cell homework", instructions: "Complete the tasks.", tasks: ["Label the cell"], followUpNotes: "Bring your work." } });
    if (artifact.artifactType === "ASSESSMENT") throw new Error("Unexpected assessment artifact.");
    const result = await renderLessonArtifactDocx({ artifact, schoolName: "Test School", lessonMeta: "Biology · S2" });
    expect(zipSignature(result)).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(result.byteLength).toBeGreaterThan(1_000);
  });

  it("renders an assessment question paper and marking guide", async () => {
    const artifact = assertCanonicalArtifactVersion({ artifactId: "a", versionId: "v1", artifactType: "ASSESSMENT", status: "FINAL", ownerScope: "section", curriculumAnchorIds: ["BIO-1"], provenance: [{ category: "CURRICULUM", label: "Biology syllabus" }], payload: { title: "Biology Test", durationMinutes: 40, totalMarks: 5, questions: [{ id: "q1", text: "Name one cell structure.", marks: 5, markingGuide: ["Award for a correct structure."] }] } });
    if (artifact.artifactType !== "ASSESSMENT") throw new Error("Unexpected lesson artifact.");
    for (const kind of ["question-paper", "marking-guide"] as const) {
      const result = await renderAssessmentDocx({ artifact, meta: { schoolName: "Test School", subject: "Biology" }, kind });
      expect(zipSignature(result)).toEqual([0x50, 0x4b, 0x03, 0x04]);
      expect(result.byteLength).toBeGreaterThan(1_000);
    }
  });
});
