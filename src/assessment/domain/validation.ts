import { AssessmentPayloadSchema, type AssessmentBlueprint, type AssessmentPayload, type AssessmentProfile, type AssessmentValidation, type ValidationIssue } from "./types";

export function validateAssessment(input: {
  payload: AssessmentPayload;
  blueprint: AssessmentBlueprint;
  eligibleCanonicalIds: string[];
  knownCanonicalIds: string[];
  participatingSectionIds: string[];
  profile: AssessmentProfile | null;
  exportAllowed: boolean;
}): AssessmentValidation {
  const issues: ValidationIssue[] = [];
  const parsed = AssessmentPayloadSchema.safeParse(input.payload);
  if (!parsed.success) issues.push(...parsed.error.issues.map((issue) => ({ code: "SCHEMA_INVALID", message: issue.message, path: issue.path.join(".") })));
  const eligible = new Set(input.eligibleCanonicalIds);
  const known = new Set(input.knownCanonicalIds);
  const configuredMarks = input.payload.questions.reduce((total, question) => total + question.marks, 0);
  const requiredItemTypes = Object.entries(input.blueprint.itemDistribution).filter(([, count]) => count > 0);
  for (const question of input.payload.questions) {
    if (question.marks <= 0) issues.push({ code: "QUESTION_MARKS_INVALID", message: `Question ${question.id} must have marks greater than zero.`, questionId: question.id });
    if (!question.markingGuide.length) issues.push({ code: "MARKING_GUIDE_MISSING", message: `Question ${question.id} is missing a marking guide.`, questionId: question.id });
    for (const canonicalId of question.canonicalIds) {
      if (!known.has(canonicalId)) issues.push({ code: "UNKNOWN_CURRICULUM_ID", message: `Question ${question.id} references an unknown curriculum ID.`, questionId: question.id });
      else if (!eligible.has(canonicalId)) issues.push({ code: "OUT_OF_SCOPE", message: `Question ${question.id} uses curriculum content outside the confirmed eligible scope.`, questionId: question.id });
    }
  }
  if (configuredMarks !== input.blueprint.totalMarks) issues.push({ code: "TOTAL_MARKS_MISMATCH", message: `Question marks total ${configuredMarks}, but the blueprint requires ${input.blueprint.totalMarks}.` });
  if (input.payload.totalMarks !== input.blueprint.totalMarks) issues.push({ code: "PAYLOAD_TOTAL_MARKS_MISMATCH", message: "Assessment total marks must match the blueprint." });
  if (input.payload.durationMinutes !== input.blueprint.durationMinutes || input.payload.durationMinutes <= 0) issues.push({ code: "DURATION_INVALID", message: "Assessment duration must remain a positive value from the blueprint." });
  if (input.payload.purpose !== input.profile?.purpose) issues.push({ code: "PROFILE_PURPOSE_MISMATCH", message: "Assessment purpose does not match the active assessment profile." });
  if (!input.profile) issues.push({ code: "PROFILE_UNAVAILABLE", message: "No verified assessment profile is currently activated for this assessment." });
  if (!input.profile || input.profile.rightsState === "RESTRICTED" || !input.exportAllowed || !input.profile.exportAllowed) issues.push({ code: "EXPORT_NOT_ALLOWED", message: "The active source configuration is not ready for final assessment export." });
  if (!input.blueprint.participatingSectionIds.every((id) => input.participatingSectionIds.includes(id))) issues.push({ code: "SECTION_OUT_OF_SCOPE", message: "Blueprint includes a Teaching Section outside the authorised assessment sections." });
  for (const [itemType, required] of requiredItemTypes) {
    const actual = input.payload.questions.filter((question) => question.itemType === itemType).length;
    if (actual !== required) issues.push({ code: "ITEM_DISTRIBUTION_MISMATCH", message: `Blueprint requires ${required} ${itemType} item(s), but the draft has ${actual}.` });
  }
  const missingMarkingGuides = input.payload.questions.filter((question) => !question.markingGuide.length).length;
  const outOfScopeItems = input.payload.questions.filter((question) => question.canonicalIds.some((id) => !eligible.has(id))).length;
  const blueprintDistributionSatisfied = !issues.some((issue) => issue.code === "ITEM_DISTRIBUTION_MISMATCH");
  return {
    valid: issues.length === 0,
    issues,
    summary: { totalMarks: input.payload.totalMarks, configuredMarks, eligibleScopeCount: input.eligibleCanonicalIds.length, outOfScopeItems, missingMarkingGuides, blueprintDistributionSatisfied, rightsPassed: !issues.some((issue) => issue.code === "EXPORT_NOT_ALLOWED") },
  };
}
