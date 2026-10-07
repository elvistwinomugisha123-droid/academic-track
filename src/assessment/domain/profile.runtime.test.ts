import { describe, expect, it } from "vitest";
import { resolveRuntimeAssessmentProfile } from "./profile";

const base = {
  profile: { id: "assessment-profile", displayTitle: "Class test", purpose: "CLASS_TEST" as const, regime: "LOWER_SECONDARY", releaseId: "release", subjectProfileId: "subject-profile", status: "ACTIVE", allowsBroaderScope: false, allowsPartialScope: true, requiresReview: true },
  release: { id: "release", versionLabel: "2026.1", authority: "Test authority", status: "ACTIVE", effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" },
  subjectProfile: { id: "subject-profile", releaseId: "release", governedSubjectId: "governed-subject", educationLevel: "lower-secondary", status: "ACTIVE", runtimeStatus: "PILOT_ACTIVE" },
  subjectProfileId: "subject-profile",
  subjectId: "governed-subject",
  subjectBinding: { status: "ACTIVE", effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" },
  sectionIds: ["section"],
  sectionBindings: [{ sectionId: "section", status: "ACTIVE", effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" }],
  assessmentDate: "2026-03-01",
  sources: [{ sourceId: "source", sourceVersion: "2026.1", rightsStatus: "CLEARED" as const, productionUseStatus: "PERMITTED" as const, externalAiAllowed: true, formalArtifactAllowed: true, exportAllowed: true }],
};

describe("runtime assessment profile resolver", () => {
  it("allows export only when every applicable governed source permits it", () => {
    const resolved = resolveRuntimeAssessmentProfile(base);
    expect(resolved.state).toBe("RESOLVED");
    expect(resolved.profile?.exportAllowed).toBe(true);
    expect(resolved.profile?.formalArtifactAllowed).toBe(true);
  });

  it("denies export for a restricted source", () => {
    const resolved = resolveRuntimeAssessmentProfile({ ...base, sources: [{ ...base.sources[0], rightsStatus: "RESTRICTED", productionUseStatus: "BLOCKED", exportAllowed: false, formalArtifactAllowed: false }] });
    expect(resolved.state).toBe("RESOLVED");
    expect(resolved.profile?.rightsState).toBe("RESTRICTED");
    expect(resolved.profile?.exportAllowed).toBe(false);
  });

  it("permits explicit operator pilot authorization while unknown stays closed for AI and export", () => {
    const pilot = resolveRuntimeAssessmentProfile({ ...base, sources: [{ ...base.sources[0], rightsStatus: "OPERATOR_AUTHORIZED_FOR_PILOT" as const }] });
    expect(pilot.profile).toMatchObject({ rightsState: "OPERATOR_AUTHORIZED_FOR_PILOT", productionUseStatus: "PERMITTED", externalAiAllowed: true, exportAllowed: true });
    const unknown = resolveRuntimeAssessmentProfile({ ...base, sources: [{ ...base.sources[0], rightsStatus: "UNKNOWN" as const, productionUseStatus: "PERMISSION_PENDING" as const }] });
    expect(unknown.profile).toMatchObject({ rightsState: "REVIEW_REQUIRED", externalAiAllowed: false, exportAllowed: false });
  });

  it("does not resolve an expired governed release", () => {
    const resolved = resolveRuntimeAssessmentProfile({ ...base, release: { ...base.release, effectiveTo: "2026-02-28" } });
    expect(resolved.state).toBe("UNAVAILABLE");
  });

  it("uses the assessment date for binding applicability", () => {
    const resolved = resolveRuntimeAssessmentProfile({ ...base, assessmentDate: "2026-07-01", subjectBinding: { ...base.subjectBinding, effectiveTo: "2026-06-30" } });
    expect(resolved.state).toBe("UNAVAILABLE");
  });

  it("does not combine an assessment profile with a subject profile from another release", () => {
    const resolved = resolveRuntimeAssessmentProfile({ ...base, subjectProfile: { ...base.subjectProfile, releaseId: "another-release" } });
    expect(resolved.state).toBe("UNAVAILABLE");
  });
});
