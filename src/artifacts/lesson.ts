import { z } from "zod";
import {
  ActivitySheetPayloadSchema,
  BoardNotesPayloadSchema,
  FormalLessonPlanPayloadSchema,
  HomeworkPayloadSchema,
  LearnerNotesPayloadSchema,
  LessonSummaryPayloadSchema,
  type FormalLessonPlanPayload,
  type LessonArtifactPayloadMap,
  type LessonArtifactType,
} from "./types";

export const lessonArtifactPayloadSchemas = {
  FORMAL_LESSON_PLAN: FormalLessonPlanPayloadSchema,
  BOARD_NOTES: BoardNotesPayloadSchema,
  LEARNER_NOTES: LearnerNotesPayloadSchema,
  LESSON_SUMMARY: LessonSummaryPayloadSchema,
  ACTIVITY_SHEET: ActivitySheetPayloadSchema,
  HOMEWORK: HomeworkPayloadSchema,
} as const;

export type LessonRecommendation = { artifactType: Exclude<LessonArtifactType, "FORMAL_LESSON_PLAN">; title: string; reason: string; required: boolean };

export function recommendTeachingPack(plan: FormalLessonPlanPayload): LessonRecommendation[] {
  const text = JSON.stringify(plan).toLowerCase();
  const recommendations: LessonRecommendation[] = [];
  if (/(practical|investigat|experiment|observe|specimen|microscope|measure)/.test(text)) recommendations.push({ artifactType: "ACTIVITY_SHEET", title: "Activity Sheet", reason: "The plan includes practical or investigative learner work.", required: true });
  if (plan.teachingSequence.some((step) => step.teacherActivity.trim() || step.prompts.length > 0) || /(equation|diagram|example|key point|board)/.test(text)) recommendations.push({ artifactType: "BOARD_NOTES", title: "Board Notes", reason: "The plan contains concepts, prompts or examples to make visible during teaching.", required: true });
  if (/(retain|written reference|copy|handout|reference note)/.test(text)) recommendations.push({ artifactType: "LEARNER_NOTES", title: "Learner Notes", reason: "The plan indicates that learners need a retained written reference.", required: true });
  if (plan.conclusionFollowUp.trim()) recommendations.push({ artifactType: "HOMEWORK", title: "Homework", reason: "The plan includes a post-lesson follow-up.", required: true });
  return recommendations;
}

export function isPotentiallyStale(childParentVersionId: string | null, currentParentVersionId: string | null): boolean {
  return Boolean(childParentVersionId && currentParentVersionId && childParentVersionId !== currentParentVersionId);
}

export function parseLessonPayload<T extends LessonArtifactType>(type: T, value: unknown): LessonArtifactPayloadMap[T] {
  return lessonArtifactPayloadSchemas[type].parse(value) as LessonArtifactPayloadMap[T];
}

export function splitLines(value: string): string[] { return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
export function joinLines(values: string[]): string { return values.join("\n"); }
