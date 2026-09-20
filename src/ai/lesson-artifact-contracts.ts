import { z } from "zod";
import { parseLessonPayload } from "@/artifacts/lesson";
import { formalArtifactRightsState, safeCurrentPositionTitle, safeCurriculumPositionLabel, type CurrentPosition } from "@/teacher/domain/continuity";
import type { FormalLessonPlanPayload, LessonArtifactPayloadMap, LessonArtifactType } from "@/artifacts/types";
import type { LessonReadinessData } from "@/teacher/application/queries";

export const LESSON_PLAN_PROMPT_VERSION = "lesson-plan-v1";
export const TEACHING_PACK_PROMPT_VERSION = "teaching-pack-v1";
export const ARTIFACT_PATCH_PROMPT_VERSION = "artifact-patch-v1";
export const ASK_ATE_PROMPT_VERSION = "ask-ate-v1";

export type AIArtifactOperation = "GENERATE_FORMAL_LESSON_PLAN" | "GENERATE_TEACHING_PACK" | "PATCH_ARTIFACT" | "ASK_ATE";

export type TrustedLessonAIContext = {
  schoolId: string;
  membershipId: string;
  userId: string;
  scheduledLessonId: string;
  teachingSectionId: string;
  subjectName: string;
  classLevelName: string;
  streamName: string;
  durationMinutes: number;
  lessonFocus: string;
  intendedCoverage: string;
  teacherNotes: string;
  preparationNotes: string;
  continuityNote: string;
  previousOutcome: string | null;
  anchor: {
    canonicalId: string;
    profileId: string | null;
    positionKind: "TOPIC" | "LEARNING_OUTCOME" | null;
    safeLabel: string;
    sourceId: string | null;
    sourceLocator: string | null;
    sourcePageStart: number | null;
    sourcePageEnd: number | null;
    rightsState: "CLEARED" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN";
    externalAiAllowed: boolean;
    formalArtifactAllowed: boolean;
    exportAllowed: boolean;
  } | null;
  protectedSourceWording: string | null;
};

export function buildTrustedLessonAIContext(data: LessonReadinessData): TrustedLessonAIContext {
  const current = data.curriculum.current;
  const anchor = current ? {
    canonicalId: current.canonicalId,
    profileId: data.curriculum.subjectProfileId,
    positionKind: current.positionKind,
    safeLabel: safeCurrentPositionTitle(current),
    sourceId: current.sourceId || null,
    sourceLocator: current.sourceLocator || null,
    sourcePageStart: current.sourcePageStart || null,
    sourcePageEnd: current.sourcePageEnd || null,
    rightsState: formalArtifactRightsState(current),
    externalAiAllowed: current.externalAiAllowed === true,
    formalArtifactAllowed: current.formalArtifactAllowed === true,
    exportAllowed: current.exportAllowed === true,
  } : null;
  return {
    schoolId: data.access.schoolId,
    membershipId: data.access.membershipId,
    userId: data.access.userId,
    scheduledLessonId: data.lesson.id,
    teachingSectionId: data.lesson.section.id,
    subjectName: data.lesson.section.subjectName,
    classLevelName: data.lesson.section.classLevelName,
    streamName: data.lesson.section.streamName,
    durationMinutes: Math.max(0, Math.round((new Date(data.lesson.endsAt).getTime() - new Date(data.lesson.startsAt).getTime()) / 60000)),
    lessonFocus: data.lesson.preparation?.lessonFocus || data.recommendedFocus,
    intendedCoverage: data.lesson.preparation?.intendedCoverage || "",
    teacherNotes: data.lesson.preparation?.teacherNotes || "",
    preparationNotes: data.lesson.preparation?.preparationNotes || "",
    continuityNote: data.lesson.unfinishedWork || data.previousLesson?.eventNote || "",
    previousOutcome: data.previousLesson?.outcome || null,
    anchor,
    protectedSourceWording: current?.sourceWording || null,
  };
}

export function canUseExternalAI(context: TrustedLessonAIContext): boolean {
  return context.anchor === null || context.anchor.externalAiAllowed;
}

export function safeModelContext(context: TrustedLessonAIContext, currentArtifact: unknown | null = null, instruction: string | null = null, selectedField: string | null = null) {
  return {
    lesson: {
      subject: context.subjectName,
      classLevel: context.classLevelName,
      stream: context.streamName,
      durationMinutes: context.durationMinutes,
      focus: context.lessonFocus,
      intendedCoverage: context.intendedCoverage,
      teacherNotes: context.teacherNotes,
      preparationNotes: context.preparationNotes,
      continuityNote: context.continuityNote,
      previousOutcome: context.previousOutcome,
    },
    governedContext: context.anchor ? {
      canonicalId: context.anchor.canonicalId,
      profileId: context.anchor.profileId,
      positionKind: context.anchor.positionKind,
      label: context.anchor.formalArtifactAllowed && context.anchor.externalAiAllowed ? context.anchor.safeLabel : safeCurriculumPositionLabel,
      sourceId: context.anchor.sourceId,
      sourceLocator: context.anchor.sourceLocator,
      sourcePageStart: context.anchor.sourcePageStart,
      sourcePageEnd: context.anchor.sourcePageEnd,
      rightsState: context.anchor.rightsState,
      externalAiAllowed: context.anchor.externalAiAllowed,
      formalArtifactAllowed: context.anchor.formalArtifactAllowed,
      exportAllowed: context.anchor.exportAllowed,
    } : null,
    currentArtifact,
    teacherInstruction: instruction,
    selectedField,
  };
}

export function containsProtectedWording(value: unknown, protectedWording: string | null): boolean {
  if (!protectedWording?.trim()) return false;
  if (typeof value === "string") return value.includes(protectedWording);
  if (Array.isArray(value)) return value.some((item) => containsProtectedWording(item, protectedWording));
  if (value && typeof value === "object") return Object.values(value).some((item) => containsProtectedWording(item, protectedWording));
  return false;
}

export function validateGeneratedArtifact<T extends LessonArtifactType>(type: T, value: unknown, context: TrustedLessonAIContext, expectedCanonicalId?: string | null): LessonArtifactPayloadMap[T] {
  const parsed = parseLessonPayload(type, value);
  if (containsProtectedWording(parsed, context.protectedSourceWording) && !context.anchor?.formalArtifactAllowed) throw new Error("The proposed artifact contains curriculum wording that is not permitted for formal artifact use.");
  if (type === "FORMAL_LESSON_PLAN") {
    const plan = parsed as FormalLessonPlanPayload;
    if (plan.durationMinutes !== context.durationMinutes) throw new Error("The proposed lesson plan changed the scheduled lesson duration.");
    const expected = expectedCanonicalId ?? context.anchor?.canonicalId ?? null;
    if ((plan.curriculumAnchor?.canonicalId || null) !== expected) throw new Error("The proposed lesson plan changed the governed curriculum anchor.");
    return { ...plan, curriculumAnchor: context.anchor ? { canonicalId: context.anchor.canonicalId, title: context.anchor.safeLabel, positionKind: context.anchor.positionKind, profileId: context.anchor.profileId, rightsState: context.anchor.rightsState } : null } as LessonArtifactPayloadMap[T];
  }
  return parsed;
}

export const AIProposalInputSchema = z.object({
  runId: z.string().uuid(),
  scheduledLessonId: z.string().uuid(),
  artifactId: z.string().uuid().nullable(),
  artifactType: z.enum(["FORMAL_LESSON_PLAN", "BOARD_NOTES", "LEARNER_NOTES", "LESSON_SUMMARY", "ACTIVITY_SHEET", "HOMEWORK"]),
  expectedVersion: z.number().int().positive().nullable(),
  parentArtifactId: z.string().uuid().nullable(),
  parentVersionId: z.string().uuid().nullable(),
  content: z.unknown(),
  contextFingerprint: z.string().min(16),
  outputFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  instruction: z.string().nullable().optional(),
  selectedField: z.string().nullable().optional(),
  changeSummary: z.string().max(500).optional(),
});

export type AIProposalInput = z.infer<typeof AIProposalInputSchema>;
