import { z } from "zod";
import type { AppState, CurriculumContext } from "@/domain/types";

export const LessonReadinessSchema = z.object({ learningIntention: z.string(), priorLearning: z.string(), segments: z.array(z.object({ title: z.string(), durationMinutes: z.number(), activity: z.string(), rationale: z.string(), sourceCategory: z.enum(["CURRICULUM", "ATE"]) })), formativeCheck: z.object({ method: z.string(), evidenceExpected: z.string() }), resourceNeeds: z.array(z.string()), teacherWatchouts: z.array(z.string()) });
export type LessonReadinessOutput = z.infer<typeof LessonReadinessSchema>;
export type LessonReadinessRequest = { state: AppState; sectionId: string; curriculumContext: CurriculumContext; prompt?: string };
export const AssessmentDraftSchema = z.object({ title: z.string(), instructions: z.array(z.string()), questions: z.array(z.object({ text: z.string(), marks: z.number(), questionType: z.string(), difficulty: z.enum(["LOW", "MEDIUM", "HIGH"]), learningOutcomeIds: z.array(z.string()), markingGuide: z.array(z.object({ point: z.string(), marks: z.number() })) })) });
export type AssessmentDraftOutput = z.infer<typeof AssessmentDraftSchema>;
export type AssessmentDraftRequest = { mode: string; allowedLearningOutcomeIds: string[]; topicTitle: string; totalMarks: number; curriculumContext?: CurriculumContext };
export interface AssessmentProvider { generateAssessment(request: AssessmentDraftRequest): Promise<AssessmentDraftOutput> }
export interface AIProvider { generateLessonReadiness(request: LessonReadinessRequest): Promise<LessonReadinessOutput> }
export const AskATEResponseSchema = z.object({ answer: z.string(), suggestedFollowUps: z.array(z.string()).max(3) });
export type AskATEResponse = z.infer<typeof AskATEResponseSchema>;
export type AskATERequest = { question: string; role: "TEACHER" | "HOD" | "DOS" | "PRINCIPAL"; curriculumContext?: CurriculumContext; sectionId?: string };
export interface AskATEProvider { ask(request: AskATERequest): Promise<AskATEResponse> }
