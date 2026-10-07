import { z } from "zod";
import { AssessmentPayloadSchema } from "@/assessment/domain/types";

const AssessmentQuestionSchema = z.object({ id: z.string(), text: z.string(), marks: z.number().nonnegative(), markingGuide: z.array(z.string()) });
export const AssessmentArtifactPayloadSchema = z.object({ title: z.string(), durationMinutes: z.number().nonnegative(), totalMarks: z.number().nonnegative(), questions: z.array(AssessmentQuestionSchema) });
export type AssessmentArtifactPayload = z.infer<typeof AssessmentArtifactPayloadSchema>;

export const LessonCurriculumAnchorSchema = z.object({ canonicalId: z.string().min(1), title: z.string(), positionKind: z.enum(["TOPIC", "LEARNING_OUTCOME"]).nullable(), profileId: z.string().nullable(), rightsState: z.enum(["CLEARED", "OPERATOR_AUTHORIZED_FOR_PILOT", "REVIEW_REQUIRED", "RESTRICTED", "UNKNOWN"]) });
export type LessonCurriculumAnchor = z.infer<typeof LessonCurriculumAnchorSchema>;

export const LessonPlanSequenceItemSchema = z.object({ id: z.string().min(1), label: z.string(), minutes: z.number().int().nonnegative(), teacherActivity: z.string(), learnerActivity: z.string(), prompts: z.array(z.string()), formativeCheck: z.string() });
export const FormalLessonPlanPayloadSchema = z.object({
  title: z.string(),
  curriculumAnchor: LessonCurriculumAnchorSchema.nullable(),
  learningIntention: z.string(),
  expectedOutcome: z.string(),
  priorLearning: z.string(),
  continuityContext: z.string(),
  lessonFocus: z.string(),
  intendedCoverage: z.string(),
  durationMinutes: z.number().int().nonnegative(),
  resources: z.array(z.string()),
  teachingSequence: z.array(LessonPlanSequenceItemSchema),
  differentiation: z.string(),
  conclusionFollowUp: z.string(),
  teacherNotes: z.string(),
});
export type FormalLessonPlanPayload = z.infer<typeof FormalLessonPlanPayloadSchema>;

export const BoardNotesPayloadSchema = z.object({ title: z.string(), keyPoints: z.array(z.string()), examples: z.array(z.string()), equations: z.array(z.string()), prompts: z.array(z.string()) });
export const LearnerNotesPayloadSchema = z.object({ title: z.string(), keyConcepts: z.array(z.string()), explanation: z.string(), examples: z.array(z.string()), applications: z.array(z.string()), summary: z.string() });
export const ActivitySheetPayloadSchema = z.object({ title: z.string(), instructions: z.string(), materialsRequired: z.array(z.string()), tasks: z.array(z.string()), questions: z.array(z.string()), observationResponseArea: z.string(), conclusionPrompts: z.array(z.string()) });
export const LessonSummaryPayloadSchema = z.object({ title: z.string(), keyTakeaways: z.array(z.string()), conciseSummary: z.string(), learnerReflection: z.string() });
export const HomeworkPayloadSchema = z.object({ title: z.string(), instructions: z.string(), tasks: z.array(z.string()), followUpNotes: z.string() });

export type LessonArtifactType = "FORMAL_LESSON_PLAN" | "BOARD_NOTES" | "LEARNER_NOTES" | "LESSON_SUMMARY" | "ACTIVITY_SHEET" | "HOMEWORK";
export type BoardNotesPayload = z.infer<typeof BoardNotesPayloadSchema>;
export type LearnerNotesPayload = z.infer<typeof LearnerNotesPayloadSchema>;
export type ActivitySheetPayload = z.infer<typeof ActivitySheetPayloadSchema>;
export type LessonSummaryPayload = z.infer<typeof LessonSummaryPayloadSchema>;
export type HomeworkPayload = z.infer<typeof HomeworkPayloadSchema>;
export type LessonArtifactPayloadMap = { FORMAL_LESSON_PLAN: FormalLessonPlanPayload; BOARD_NOTES: BoardNotesPayload; LEARNER_NOTES: LearnerNotesPayload; LESSON_SUMMARY: LessonSummaryPayload; ACTIVITY_SHEET: ActivitySheetPayload; HOMEWORK: HomeworkPayload };
export const lessonArtifactTypes: LessonArtifactType[] = ["FORMAL_LESSON_PLAN", "BOARD_NOTES", "LEARNER_NOTES", "LESSON_SUMMARY", "ACTIVITY_SHEET", "HOMEWORK"];
const CanonicalMetadataSchema = z.object({ artifactId: z.string(), versionId: z.string(), status: z.enum(["DRAFT", "REVIEW", "FINAL"]), ownerScope: z.string(), curriculumAnchorIds: z.array(z.string()), curriculumProfileId: z.string().optional(), rightsState: z.enum(["CLEARED", "OPERATOR_AUTHORIZED_FOR_PILOT", "REVIEW_REQUIRED", "RESTRICTED", "UNKNOWN"]).optional(), provenance: z.array(z.object({ category: z.string(), label: z.string(), sourceId: z.string().optional(), sourceLocation: z.string().optional(), rightsState: z.string().optional() })) });
export const CanonicalArtifactVersionSchema = z.discriminatedUnion("artifactType", [
  CanonicalMetadataSchema.extend({ artifactType: z.literal("ASSESSMENT"), payload: z.union([AssessmentPayloadSchema, AssessmentArtifactPayloadSchema]) }),
  CanonicalMetadataSchema.extend({ artifactType: z.literal("FORMAL_LESSON_PLAN"), payload: FormalLessonPlanPayloadSchema }),
  CanonicalMetadataSchema.extend({ artifactType: z.literal("BOARD_NOTES"), payload: BoardNotesPayloadSchema }),
  CanonicalMetadataSchema.extend({ artifactType: z.literal("LEARNER_NOTES"), payload: LearnerNotesPayloadSchema }),
  CanonicalMetadataSchema.extend({ artifactType: z.literal("LESSON_SUMMARY"), payload: LessonSummaryPayloadSchema }),
  CanonicalMetadataSchema.extend({ artifactType: z.literal("ACTIVITY_SHEET"), payload: ActivitySheetPayloadSchema }),
  CanonicalMetadataSchema.extend({ artifactType: z.literal("HOMEWORK"), payload: HomeworkPayloadSchema }),
]);
export type CanonicalArtifactVersion = z.infer<typeof CanonicalArtifactVersionSchema>;

export function assertCanonicalArtifactVersion(value: unknown): CanonicalArtifactVersion { return CanonicalArtifactVersionSchema.parse(value); }
