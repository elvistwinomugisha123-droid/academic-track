import { describe, expect, it } from "vitest";
import { canExportLessonArtifact } from "./export-policy";

const cleared = { rightsStatus: "CLEARED", productionUseStatus: "PERMITTED", formalArtifactAllowed: true, exportAllowed: true, sourceWording: "Protected wording" };

describe("lesson artifact export policy", () => {
  it("denies restricted print and PDF decisions", () => {
    expect(canExportLessonArtifact({ artifactRightsState: "RESTRICTED", governedAnchor: true, sourceDecision: cleared, content: { title: "Teacher work" } })).toMatchObject({ allowed: false });
  });
  it("allows safe teacher-authored content when source wording cannot be exported", () => {
    expect(canExportLessonArtifact({ artifactRightsState: "REVIEW_REQUIRED", governedAnchor: true, sourceDecision: { ...cleared, exportAllowed: false, formalArtifactAllowed: false }, content: { title: "Teacher explanation" } })).toEqual({ allowed: true });
  });
  it("denies protected wording when export is not allowed", () => {
    expect(canExportLessonArtifact({ artifactRightsState: "REVIEW_REQUIRED", governedAnchor: true, sourceDecision: { ...cleared, exportAllowed: false }, content: { title: "Protected wording" } })).toMatchObject({ allowed: false });
  });
  it("fails closed when a governed source decision cannot be reconstructed", () => {
    expect(canExportLessonArtifact({ artifactRightsState: "UNKNOWN", governedAnchor: true, sourceDecision: null, content: { title: "Teacher work" } })).toMatchObject({ allowed: false });
  });
});
