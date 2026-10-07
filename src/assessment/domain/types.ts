import { z } from "zod";

export const assessmentPurposes = [
  "FORMATIVE_CHECK",
  "CLASS_TEST",
  "DIAGNOSTIC",
  "REVISION_PRACTICE",
  "COMMON_STREAM_TEST",
  "INTERNAL_EXAM",
] as const;
export type AssessmentPurpose = (typeof assessmentPurposes)[number];

export const assessmentStatuses = ["DRAFT", "IN_REVIEW", "FINAL"] as const;
export type AssessmentStatus = (typeof assessmentStatuses)[number];

export const assessmentItemTypes = ["SHORT_ANSWER", "STRUCTURED", "MULTIPLE_CHOICE", "PRACTICAL", "ESSAY", "OTHER"] as const;
export type AssessmentItemType = (typeof assessmentItemTypes)[number];
export const assessmentDifficulties = ["LOW", "MEDIUM", "HIGH"] as const;
export type AssessmentDifficulty = (typeof assessmentDifficulties)[number];

export const AssessmentQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1),
  marks: z.number().int().positive(),
  itemType: z.enum(assessmentItemTypes),
  difficulty: z.enum(assessmentDifficulties),
  cognitiveDemand: z.string().trim().min(1).nullable(),
  canonicalIds: z.array(z.string().min(1)).min(1),
  markingGuide: z.array(z.string().trim().min(1)).min(1),
  expectedResponse: z.string().trim().min(1).nullable(),
  rubric: z.array(z.object({ descriptor: z.string().trim().min(1), marks: z.number().int().positive() })).nullable(),
});
export type AssessmentQuestion = z.infer<typeof AssessmentQuestionSchema>;

export const AssessmentBlueprintSchema = z.object({
  participatingSectionIds: z.array(z.string().uuid()).min(1),
  scopeCanonicalIds: z.array(z.string().min(1)),
  expectedEvidence: z.string().trim().min(1),
  itemDistribution: z.record(z.string(), z.number().int().nonnegative()),
  difficultyDistribution: z.record(z.enum(assessmentDifficulties), z.number().int().nonnegative()),
  marksDistribution: z.record(z.string(), z.number().int().positive()),
  totalMarks: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  practicalRequirements: z.array(z.string().trim().min(1)),
  accessibilityConstraints: z.array(z.string().trim().min(1)),
  subjectConstraints: z.array(z.string().trim().min(1)),
  teacherNotes: z.string(),
});
export type AssessmentBlueprint = z.infer<typeof AssessmentBlueprintSchema>;

export const AssessmentPayloadSchema = z.object({
  title: z.string().trim().min(1),
  purpose: z.enum(assessmentPurposes),
  durationMinutes: z.number().int().positive(),
  totalMarks: z.number().int().positive(),
  instructions: z.array(z.string().trim().min(1)),
  blueprint: AssessmentBlueprintSchema,
  questions: z.array(AssessmentQuestionSchema),
});
export type AssessmentPayload = z.infer<typeof AssessmentPayloadSchema>;

export type AssessmentProfile = {
  id: string;
  displayTitle: string;
  purpose: AssessmentPurpose;
  regime: string;
  authority: string;
  sourceId: string | null;
  sourceVersion: string | null;
  releaseId: string;
  releaseVersion: string;
  verificationStatus: "VERIFIED" | "UNVERIFIED";
  rightsState: "CLEARED" | "OPERATOR_AUTHORIZED_FOR_PILOT" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN";
  externalAiAllowed: boolean;
  exportAllowed: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  allowsBroaderScope: boolean;
  allowsPartialScope?: boolean;
  requiresReview: boolean;
  productionUseStatus?: "PERMITTED" | "PERMISSION_PENDING" | "BLOCKED";
  formalArtifactAllowed?: boolean;
  releaseStatus?: "ACTIVE" | "DRAFT" | "REVIEW" | "SUPERSEDED" | "RETIRED";
  subjectProfileStatus?: "ACTIVE" | "DRAFT" | "RETIRED";
  subjectProfileRuntimeStatus?: "PILOT_ACTIVE" | "ACADEMICALLY_VERIFIED" | "CANDIDATE" | "RETIRED";
  applicable?: boolean;
  assessmentDate?: string;
  subjectProfileId?: string | null;
  subjectId?: string;
  educationLevel?: string;
};

export type ProfileResolution =
  | { state: "RESOLVED"; profile: AssessmentProfile; explanation: string }
  | { state: "UNAVAILABLE"; profile: null; explanation: string };

export type EligibilityEvidence = {
  canonicalId: string;
  sectionId: string;
  evidenceType: "CONFIRMED_DELIVERY" | "EXPLICIT_PARTIAL_SCOPE_CONFIRMATION";
  evidenceReferenceId: string;
  confirmedByMembershipId: string;
};

export type SectionEligibility = {
  sectionId: string;
  confirmedCanonicalIds: string[];
  explicitlyConfirmedPartialCanonicalIds: string[];
  evidence: EligibilityEvidence[];
};

export type EligibleScope = {
  canonicalIds: string[];
  broaderCanonicalIds: string[];
  excludedCanonicalIds: string[];
  evidence: EligibilityEvidence[];
  explanation: string;
};

export type ValidationIssue = {
  code: string;
  message: string;
  questionId?: string;
  path?: string;
};

export type AssessmentValidation = {
  valid: boolean;
  issues: ValidationIssue[];
  summary: {
    totalMarks: number;
    configuredMarks: number;
    eligibleScopeCount: number;
    outOfScopeItems: number;
    missingMarkingGuides: number;
    blueprintDistributionSatisfied: boolean;
    rightsPassed: boolean;
  };
};
