import type { AppState, AssessmentMode, LessonOutcome, LessonOutcomeType } from "./types";
import { getCurriculumTopic, getCurriculumLearningOutcome } from "@/curriculum/repository";

export function recordLessonOutcome(state: AppState, input: Omit<LessonOutcome, "id" | "recordedAt">): AppState {
  const outcome: LessonOutcome = { ...input, id: `outcome-${Date.now()}`, recordedAt: new Date().toISOString() };
  const next = structuredClone(state) as AppState;
  next.outcomes = [...next.outcomes.filter((item) => item.scheduledLessonId !== input.scheduledLessonId), outcome];
  const section = next.sections.find((item) => item.id === input.sectionId);
  if (!section) return next;
  section.confirmedOutcomeIds = [...section.confirmedOutcomeIds.filter((id) => id !== outcome.id), outcome.id];
  section.currentOutcomeStatus = input.type === "PARTIALLY_DELIVERED" ? "PARTIALLY_ADDRESSED" : input.type === "DELIVERED_AS_PLANNED" || input.type === "CHANGED_FROM_PLAN" ? "CONFIRMED_ADDRESSED" : "UNCONFIRMED";
  section.unfinishedWorkIds = next.unfinished.filter((item) => item.sectionId === section.id && item.status === "OPEN").map((item) => item.id);
  if (input.type === "PARTIALLY_DELIVERED" && input.unfinishedSegmentIds?.length) {
    const unfinishedId = `unfinished-${outcome.id}`;
    next.unfinished.push({ id: unfinishedId, sectionId: section.id, topicId: section.topicId, outcomeId: outcome.id, segmentIds: input.unfinishedSegmentIds, learningOutcomeIds: input.partiallyAddressedLearningOutcomeIds, status: "OPEN" });
    section.unfinishedWorkIds = [...section.unfinishedWorkIds, unfinishedId];
  }
  const lesson = next.lessons.find((item) => item.id === input.scheduledLessonId);
  if (lesson) lesson.status = "OUTCOME_RECORDED";
  next.exceptions = deriveExceptions(next);
  return next;
}

export function eligibleOutcomes(state: AppState, sectionIds: string[], mode: AssessmentMode): { allowed: string[]; excluded: string[] } {
  const all = sectionIds.flatMap((id) => { const section = state.sections.find((item) => item.id === id); const topic = getCurriculumTopic(section?.topicId ?? ""); return topic?.learningOutcomes.map((item) => item.id) ?? []; });
  const verified = (ids: string[]) => ids.filter((id) => getCurriculumLearningOutcome(id)?.review.state === "VERIFIED");
  if (mode === "DIAGNOSTIC" || mode === "REVISION_PRACTICE") { const allowed = [...new Set(verified(all))]; return { allowed, excluded: all.filter((id) => !allowed.includes(id)) }; }
  const confirmed = sectionIds.map((id) => { const section = state.sections.find((item) => item.id === id); const topic = getCurriculumTopic(section?.topicId ?? ""); return topic?.learningOutcomes.filter((outcome) => section?.currentOutcomeStatus === "CONFIRMED_ADDRESSED" && outcome.review.state === "VERIFIED").map((item) => item.id) ?? []; });
  const allowed = mode === "COMMON_STREAM_TEST" ? (confirmed[0] ?? []).filter((id) => confirmed.every((items) => items.includes(id))) : [...new Set(confirmed.flat())];
  return { allowed, excluded: all.filter((id) => !allowed.includes(id)) };
}

export function isValidAssessmentOutcomeIds(ids: string[]): boolean { return ids.every((id) => Boolean(getCurriculumLearningOutcome(id)?.review.state === "VERIFIED")); }

export function deriveExceptions(state: AppState) {
  return state.sections.flatMap((section) => { const open = state.unfinished.filter((item) => item.sectionId === section.id && item.status === "OPEN"); if (!open.length) return []; const canAbsorb = open.every((item) => item.segmentIds.length <= 2); return [{ id: `exception-${section.id}`, sectionId: section.id, severity: canAbsorb ? "DEPARTMENT_ATTENTION" as const : "DOS_ACTION" as const, reason: "UNFINISHED_WORK", explanation: canAbsorb ? "Unfinished work can be carried into the next normal lesson." : "Unfinished work may require timetable intervention.", status: "OPEN" as const }]; });
}

export function streamDrift(state: AppState, levelId: string) { return state.sections.filter((section) => section.levelId === levelId).map((section) => ({ section, status: section.currentOutcomeStatus, unfinished: section.unfinishedWorkIds.length })); }
export function roleSummary(state: AppState) { return { unconfirmed: state.sections.filter((section) => section.currentOutcomeStatus === "UNCONFIRMED").length, openExceptions: deriveExceptions(state).filter((item) => item.severity === "DOS_ACTION").length, departmentAttention: deriveExceptions(state).filter((item) => item.severity === "DEPARTMENT_ATTENTION").length }; }
export function deriveHODView(state: AppState) { return { teachingSections: state.sections, streamDrift: streamDrift(state, "s2"), openCoordinationItems: deriveExceptions(state).filter((item) => item.severity === "DEPARTMENT_ATTENTION") }; }
export function deriveDOSExceptions(state: AppState) { return deriveExceptions(state).filter((item) => item.severity === "DOS_ACTION"); }
export function derivePrincipalSummary(state: AppState) { const summary = roleSummary(state); return { unconfirmedSections: summary.unconfirmed, departmentAttention: summary.departmentAttention, DOSDecisions: summary.openExceptions }; }
export const outcomeLabels: Record<LessonOutcomeType, string> = { DELIVERED_AS_PLANNED: "Delivered as planned", PARTIALLY_DELIVERED: "Partially delivered", MISSED_OR_CANCELLED: "Missed / cancelled", CHANGED_FROM_PLAN: "Changed from plan", UNCONFIRMED: "Unconfirmed" };
