import { AssessmentPayloadSchema, type AssessmentBlueprint, type AssessmentPayload, type AssessmentProfile, type AssessmentValidation, type ValidationIssue } from "./types";
import { blueprintIssues } from "./blueprint";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

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
  issues.push(...blueprintIssues(input.blueprint).map((message) => ({ code: "BLUEPRINT_INCOMPLETE", message })));
  if (stable(input.payload.blueprint) !== stable(input.blueprint)) issues.push({ code: "BLUEPRINT_CHANGED", message: "The draft changed the approved blueprint. Save a new teacher blueprint first." });
  const eligible = new Set(input.eligibleCanonicalIds);
  const known = new Set(input.knownCanonicalIds);
  const configuredMarks = input.payload.questions.reduce((total, question) => total + question.marks, 0);
  const questionIds = new Set<string>();
  const requiredItemTypes = Object.entries(input.blueprint.itemDistribution).filter(([, count]) => count > 0);
  for (const question of input.payload.questions) {
    if (questionIds.has(question.id)) issues.push({ code: "DUPLICATE_QUESTION_ID", message: `Question ID ${question.id} occurs more than once.`, questionId: question.id });
    questionIds.add(question.id);
    if (question.marks <= 0) issues.push({ code: "QUESTION_MARKS_INVALID", message: `Question ${question.id} must have marks greater than zero.`, questionId: question.id });
    if (!question.markingGuide.length) issues.push({ code: "MARKING_GUIDE_MISSING", message: `Question ${question.id} is missing a marking guide.`, questionId: question.id });
    if (question.rubric && question.rubric.reduce((total, row) => total + row.marks, 0) !== question.marks) issues.push({ code: "RUBRIC_MARKS_MISMATCH", message: `Question ${question.id} rubric marks do not equal its allocated marks.`, questionId: question.id });
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
    const allocated = input.payload.questions.filter((question) => question.itemType === itemType).reduce((sum, question) => sum + question.marks, 0);
    if (allocated !== input.blueprint.marksDistribution[itemType]) issues.push({ code: "MARKS_DISTRIBUTION_MISMATCH", message: `Blueprint allocates ${input.blueprint.marksDistribution[itemType] || 0} marks to ${itemType}, but the draft has ${allocated}.` });
  }
  for (const difficulty of ["LOW", "MEDIUM", "HIGH"] as const) {
    const actual = input.payload.questions.filter((question) => question.difficulty === difficulty).length;
    if (actual !== (input.blueprint.difficultyDistribution[difficulty] || 0)) issues.push({ code: "DIFFICULTY_DISTRIBUTION_MISMATCH", message: `Blueprint requires ${input.blueprint.difficultyDistribution[difficulty] || 0} ${difficulty.toLowerCase()} difficulty question(s), but the draft has ${actual}.` });
  }
  const missingMarkingGuides = input.payload.questions.filter((question) => !question.markingGuide.length).length;
  const outOfScopeItems = input.payload.questions.filter((question) => question.canonicalIds.some((id) => !eligible.has(id))).length;
  const blueprintDistributionSatisfied = !issues.some((issue) => ["BLUEPRINT_INCOMPLETE", "BLUEPRINT_CHANGED", "ITEM_DISTRIBUTION_MISMATCH", "MARKS_DISTRIBUTION_MISMATCH", "DIFFICULTY_DISTRIBUTION_MISMATCH"].includes(issue.code));
  return {
    valid: issues.length === 0,
    issues,
    summary: { totalMarks: input.payload.totalMarks, configuredMarks, eligibleScopeCount: input.eligibleCanonicalIds.length, outOfScopeItems, missingMarkingGuides, blueprintDistributionSatisfied, rightsPassed: !issues.some((issue) => issue.code === "EXPORT_NOT_ALLOWED") },
  };
}
