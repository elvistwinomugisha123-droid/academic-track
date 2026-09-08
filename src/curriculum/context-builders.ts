import type { AppState, CurriculumContext } from "@/domain/types";
import { getCurriculumTopic, getFrameworkGuidance } from "./repository";

export function buildCurriculumContext(state: AppState, sectionId: string): CurriculumContext {
  const section = state.sections.find((item) => item.id === sectionId);
  if (!section) throw new Error(`Teaching Section ${sectionId} was not found.`);
  const topic = getCurriculumTopic(section.topicId);
  if (!topic) throw new Error(`Teaching Section ${sectionId} references missing curriculum topic ${section.topicId}.`);
  return { topic, frameworkGuidance: getFrameworkGuidance(), teacherConfirmedOutcomeIds: section.confirmedOutcomeIds, currentOutcomeStatus: section.currentOutcomeStatus, schoolConstraints: section.constraints };
}
