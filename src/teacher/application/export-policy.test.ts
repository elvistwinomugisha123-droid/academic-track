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
  it("allows protected wording for an explicit pilot decision and denies unknown", () => {
    expect(canExportLessonArtifact({ artifactRightsState: "OPERATOR_AUTHORIZED_FOR_PILOT", governedAnchor: true, sourceDecision: { ...cleared, rightsStatus: "OPERATOR_AUTHORIZED_FOR_PILOT" }, content: { title: "Protected wording" } })).toEqual({ allowed: true });
    expect(canExportLessonArtifact({ artifactRightsState: "UNKNOWN", governedAnchor: true, sourceDecision: { ...cleared, rightsStatus: "UNKNOWN" }, content: { title: "Protected wording" } })).toMatchObject({ allowed: false });
  });
});
