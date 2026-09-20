import { describe, expect, it } from "vitest";
import { lessonArtifactRenderModel } from "./lesson-render";

describe("lesson artifact presentation model", () => {
  it("renders lesson plans and pack artifacts as semantic sections", () => {
    const artifact = { artifactType: "ACTIVITY_SHEET" as const, artifactId: "a", versionId: "v1", status: "DRAFT" as const, ownerScope: "section", curriculumAnchorIds: [], provenance: [], payload: { title: "Practical activity", instructions: "Work in pairs.", materialsRequired: ["Leaves"], tasks: ["Observe"], questions: ["What changed?"], observationResponseArea: "Record results", conclusionPrompts: ["Explain"] } };
    const model = lessonArtifactRenderModel(artifact);
    expect(model.sections.map((section) => section.heading)).toEqual(["Instructions", "Materials required", "Tasks", "Questions", "Observation / response", "Conclusion"]);
    expect(model.sections.find((section) => section.heading === "Tasks")?.items).toEqual(["Observe"]);
  });
});
