import { describe, expect, it } from "vitest";
import { resolveEligibleScope } from "./eligibility";
import { resolveAssessmentProfile } from "./profile";
import { validateAssessment } from "./validation";
import { assessmentLevelMatches } from "./curriculum-level";
import { blueprintIssues } from "./blueprint";
import type { AssessmentPayload, AssessmentProfile } from "./types";

const profile: AssessmentProfile = { id: "profile", displayTitle: "Test-only Class Test", purpose: "CLASS_TEST", regime: "TEST_ONLY_SCHOOL_INTERNAL", authority: "ATE test fixture", sourceId: "source", sourceVersion: "test-v1", releaseId: "release", releaseVersion: "TEST-2026", verificationStatus: "VERIFIED", rightsState: "CLEARED", productionUseStatus: "PERMITTED", externalAiAllowed: true, exportAllowed: true, effectiveFrom: "2026-01-01", effectiveTo: null, allowsBroaderScope: false, requiresReview: false };
const question = (id: string, canonicalId: string, marks = 5) => ({ id, text: `Question ${id}`, marks, itemType: "SHORT_ANSWER" as const, difficulty: "MEDIUM" as const, cognitiveDemand: null, canonicalIds: [canonicalId], markingGuide: ["Award the mark for a correct response."], expectedResponse: null, rubric: null });
const payload: AssessmentPayload = { title: "Biology class test", purpose: "CLASS_TEST", durationMinutes: 40, totalMarks: 10, instructions: ["Answer all questions."], blueprint: { participatingSectionIds: ["00000000-0000-0000-0000-000000000001"], scopeCanonicalIds: ["A", "B"], expectedEvidence: "Written responses", itemDistribution: { SHORT_ANSWER: 2 }, difficultyDistribution: { LOW: 0, MEDIUM: 2, HIGH: 0 }, marksDistribution: { SHORT_ANSWER: 10 }, totalMarks: 10, durationMinutes: 40, practicalRequirements: [], accessibilityConstraints: [], subjectConstraints: [], teacherNotes: "" }, questions: [question("q1", "A"), question("q2", "B")] };

describe("Assessment Studio domain", () => {
  it("requires a distribution before generation and checks the draft difficulty mix", () => {
    expect(blueprintIssues({ ...payload.blueprint, itemDistribution: {}, marksDistribution: {} }).length).toBeGreaterThan(0);
    const changed: AssessmentPayload = { ...payload, questions: [{ ...payload.questions[0], marks: 6, difficulty: "HIGH" }, { ...payload.questions[1], marks: 4 }] };
    const result = validateAssessment({ payload: changed, blueprint: payload.blueprint, eligibleCanonicalIds: ["A", "B"], knownCanonicalIds: ["A", "B"], participatingSectionIds: payload.blueprint.participatingSectionIds, profile, exportAllowed: true });
    expect(result.issues.map((issue) => issue.code)).toContain("DIFFICULTY_DISTRIBUTION_MISMATCH");
  });
  it("blocks a Senior 2 topic from a Senior 1 class test", () => {
    expect(assessmentLevelMatches("Senior 1", "Senior 2")).toBe(false);
    expect(assessmentLevelMatches("S1", "Senior 1")).toBe(true);
    expect(assessmentLevelMatches("Year 1", "Senior 1")).toBe(false);
  });
  it("uses confirmed taught evidence and records explicit partial confirmations", () => {
    const result = resolveEligibleScope({ purpose: "CLASS_TEST", profileAllowsBroaderScope: false, sections: [{ sectionId: "a", confirmedCanonicalIds: ["A"], explicitlyConfirmedPartialCanonicalIds: ["B"], evidence: [{ canonicalId: "A", sectionId: "a", evidenceType: "CONFIRMED_DELIVERY", evidenceReferenceId: "event-a", confirmedByMembershipId: "teacher" }, { canonicalId: "B", sectionId: "a", evidenceType: "EXPLICIT_PARTIAL_SCOPE_CONFIRMATION", evidenceReferenceId: "scope-b", confirmedByMembershipId: "teacher" }] }] });
    expect(result.canonicalIds).toEqual(["A", "B"]);
    expect(result.explanation).toContain("confirmed taught");
  });

  it("intersects common stream scope", () => {
    const result = resolveEligibleScope({ purpose: "COMMON_STREAM_TEST", profileAllowsBroaderScope: false, sections: [{ sectionId: "a", confirmedCanonicalIds: ["A", "B", "C"], explicitlyConfirmedPartialCanonicalIds: [], evidence: [] }, { sectionId: "b", confirmedCanonicalIds: ["A", "B"], explicitlyConfirmedPartialCanonicalIds: [], evidence: [] }] });
    expect(result.canonicalIds).toEqual(["A", "B"]);
    expect(result.excludedCanonicalIds).toEqual(["C"]);
  });

  it("only permits broader diagnostic scope when the profile permits it", () => {
    const result = resolveEligibleScope({ purpose: "DIAGNOSTIC", profileAllowsBroaderScope: true, broaderCanonicalIds: ["P"], sections: [{ sectionId: "a", confirmedCanonicalIds: ["A"], explicitlyConfirmedPartialCanonicalIds: [], evidence: [] }] });
    expect(result.canonicalIds).toEqual(["A", "P"]);
    expect(result.broaderCanonicalIds).toEqual(["P"]);
  });

  it("resolves only verified effective profiles", () => {
    const result = resolveAssessmentProfile({ candidates: [{ ...profile, subjectProfileId: "subject-profile", subjectId: "subject", educationLevel: "LOWER_SECONDARY", subject: "Biology" }], subjectProfileId: "subject-profile", subjectId: "subject", educationLevel: "LOWER_SECONDARY", subject: "Biology", purpose: "CLASS_TEST", effectiveOn: "2026-03-01" });
    expect(result.state).toBe("RESOLVED");
    expect(resolveAssessmentProfile({ candidates: [{ ...profile, verificationStatus: "UNVERIFIED", subjectProfileId: "subject-profile", subjectId: "subject", educationLevel: "LOWER_SECONDARY", subject: "Biology" }], subjectProfileId: "subject-profile", subjectId: "subject", educationLevel: "LOWER_SECONDARY", subject: "Biology", purpose: "CLASS_TEST", effectiveOn: "2026-03-01" }).state).toBe("UNAVAILABLE");
  });

  it("rejects out-of-scope content and mark mismatches", () => {
    const result = validateAssessment({ payload: { ...payload, totalMarks: 11, questions: [payload.questions[0], { ...payload.questions[1], marks: 6 }] }, blueprint: payload.blueprint, eligibleCanonicalIds: ["A"], knownCanonicalIds: ["A", "B"], participatingSectionIds: payload.blueprint.participatingSectionIds, profile, exportAllowed: true });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["TOTAL_MARKS_MISMATCH", "OUT_OF_SCOPE", "PAYLOAD_TOTAL_MARKS_MISMATCH"]));
  });

  it("rejects ambiguous question identities and marking rubrics with incorrect totals", () => {
    const invalid: AssessmentPayload = { ...payload, questions: [
      { ...payload.questions[0], rubric: [{ descriptor: "Explains the result", marks: 3 }] },
      { ...payload.questions[1], id: "q1" },
    ] };
    const result = validateAssessment({ payload: invalid, blueprint: payload.blueprint, eligibleCanonicalIds: ["A", "B"], knownCanonicalIds: ["A", "B"], participatingSectionIds: payload.blueprint.participatingSectionIds, profile, exportAllowed: true });
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["DUPLICATE_QUESTION_ID", "RUBRIC_MARKS_MISMATCH"]));
  });
});
