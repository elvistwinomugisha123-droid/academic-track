import type { FormalLessonPlanPayload } from "./types";
import { formalArtifactRightsState, safeCurrentPositionTitle } from "@/teacher/domain/continuity";

export type LessonPlanContext = {
  recommendedFocus: string;
  lesson: { startsAt: string; endsAt: string; unfinishedWork: string | null };
  curriculum: { subjectProfileId: string; current: { canonicalId: string; title: string; positionKind: "TOPIC" | "LEARNING_OUTCOME"; rightsStatus?: "CLEARED" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN"; productionUseStatus?: "PERMITTED" | "PERMISSION_PENDING" | "BLOCKED"; formalArtifactAllowed?: boolean } | null };
  previousLesson: { outcome: string | null } | null;
};

function durationMinutes(startsAt: string, endsAt: string): number { return Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000)); }

export function createInitialFormalLessonPlan(data: LessonPlanContext): FormalLessonPlanPayload {
  const current = data.curriculum.current;
  const previous = data.previousLesson;
  const rightsState = current ? formalArtifactRightsState(current) : "UNKNOWN";
  const duration = durationMinutes(data.lesson.startsAt, data.lesson.endsAt);
  return {
    title: data.recommendedFocus,
    curriculumAnchor: current ? { canonicalId: current.canonicalId, title: safeCurrentPositionTitle(current), positionKind: current.positionKind, profileId: data.curriculum.subjectProfileId, rightsState } : null,
    learningIntention: "", expectedOutcome: "", priorLearning: previous?.outcome ? `Previous classroom state: ${previous.outcome.toLowerCase().replaceAll("_", " ")}.` : "", continuityContext: data.lesson.unfinishedWork ? `Carry forward: ${data.lesson.unfinishedWork}` : "", lessonFocus: data.recommendedFocus, intendedCoverage: "", durationMinutes: duration, resources: [],
    teachingSequence: [{ id: "sequence-1", label: "Opening and lesson work", minutes: duration, teacherActivity: "", learnerActivity: "", prompts: [], formativeCheck: "" }], differentiation: "", conclusionFollowUp: "", teacherNotes: "",
  };
}
