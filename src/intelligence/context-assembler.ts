import "server-only";
import type { AppState } from "@/domain/types";
import { eligibleOutcomes } from "@/domain/engine";
import { retrieveExactKnowledge } from "@/knowledge/retrieval";
import type { KnowledgeSqlClient } from "@/knowledge/db/client";
import type { EducationLevel, RetrievalUse, RetrievedKnowledgeRecord } from "@/knowledge/types";

export async function assembleLessonContext(client: KnowledgeSqlClient, input: { state: AppState; sectionId: string; currentKnowledgeId: string; use: RetrievalUse }) {
  const section = input.state.sections.find((item) => item.id === input.sectionId);
  if (!section) throw new Error("Teaching Section was not found.");
  const currentCurriculum = await retrieveExactKnowledge(client, { canonicalId: input.currentKnowledgeId, use: input.use });
  return { section: { id: section.id, subject: section.subjectName, currentOutcomeStatus: section.currentOutcomeStatus }, previousOutcome: input.state.outcomes.filter((item) => item.sectionId === section.id).at(-1), currentCurriculum, lessonPlanningContext: { schoolConstraints: section.constraints } };
}

export async function assembleAssessmentContext(client: KnowledgeSqlClient, input: { state: AppState; sectionId: string; educationLevel: EducationLevel; subject: string; purpose: string; use: RetrievalUse }) {
  const assessmentProfile = await retrieveExactKnowledge(client, { educationLevel: input.educationLevel, subject: input.subject, recordTypes: ["assessment_guidance"], use: input.use, limit: 20 });
  const section = input.state.sections.find((item) => item.id === input.sectionId);
  return { assessmentPurpose: input.purpose, assessmentProfile, eligibleCurriculumScope: eligibleOutcomes(input.state, section ? [section.id] : [], input.purpose === "DIAGNOSTIC" ? "DIAGNOSTIC" : "FORMATIVE_CHECK") };
}

export type LessonContextRecord = RetrievedKnowledgeRecord;
