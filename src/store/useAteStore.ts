"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { seedState } from "@/data/seed";
import { recordLessonOutcome } from "@/domain/engine";
import { curriculumRepository } from "@/curriculum/repository";
import type { AppState, Assessment, AssessmentQuestion, CurriculumTopic, LessonOutcome } from "@/domain/types";

export type AteStore = AppState & { readonly topics: readonly CurriculumTopic[];
  recordOutcome: (input: Omit<LessonOutcome, "id" | "recordedAt">) => void;
  saveAssessment: (assessment: Assessment) => void;
  updateAssessmentQuestion: (assessmentId: string, questionId: string, patch: Partial<AssessmentQuestion>) => void;
  deleteAssessmentQuestion: (assessmentId: string, questionId: string) => void;
  reorderAssessmentQuestion: (assessmentId: string, questionId: string, direction: "up" | "down") => void;
  finalizeAssessment: (assessmentId: string) => void;
  resetDemoData: () => void;
  reset: () => void;
};

const freshSeed = () => structuredClone(seedState) as AppState;
const canonicalTopics = Object.freeze([...curriculumRepository.topics.values()]);

export const useAteStore = create<AteStore>()(persist((set) => ({
  ...freshSeed(), topics: canonicalTopics,
  recordOutcome: (input) => set((state) => recordLessonOutcome(state, input)),
  saveAssessment: (assessment) => set((state) => ({ assessments: [...state.assessments.filter((item) => item.id !== assessment.id), assessment] })),
  updateAssessmentQuestion: (assessmentId, questionId, patch) => set((state) => ({ assessments: state.assessments.map((assessment) => assessment.id !== assessmentId ? assessment : (() => { const questions = assessment.questions.map((question) => question.id !== questionId ? question : { ...question, ...patch }); return { ...assessment, status: "TEACHER_EDITED", totalMarks: questions.reduce((sum, question) => sum + question.marks, 0), questions }; })()) })),
  deleteAssessmentQuestion: (assessmentId, questionId) => set((state) => ({ assessments: state.assessments.map((assessment) => assessment.id !== assessmentId ? assessment : { ...assessment, status: "TEACHER_EDITED", questions: assessment.questions.filter((question) => question.id !== questionId) }) })),
  reorderAssessmentQuestion: (assessmentId, questionId, direction) => set((state) => ({ assessments: state.assessments.map((assessment) => {
    if (assessment.id !== assessmentId) return assessment;
    const index = assessment.questions.findIndex((question) => question.id === questionId);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= assessment.questions.length) return assessment;
    const questions = [...assessment.questions];
    [questions[index], questions[nextIndex]] = [questions[nextIndex], questions[index]];
    return { ...assessment, status: "TEACHER_EDITED", questions };
  }) })),
  finalizeAssessment: (assessmentId) => set((state) => ({ assessments: state.assessments.map((assessment) => assessment.id === assessmentId ? { ...assessment, status: "FINALIZED" } : assessment) })),
  resetDemoData: () => set({ ...freshSeed(), topics: canonicalTopics }),
  reset: () => set({ ...freshSeed(), topics: canonicalTopics }),
} as AteStore), {
  name: "ate-demo-state",
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    school: state.school, term: state.term, people: state.people, levels: state.levels, streams: state.streams,
    timetable: state.timetable, sections: state.sections, lessons: state.lessons,
    outcomes: state.outcomes, unfinished: state.unfinished, recovery: state.recovery, exceptions: state.exceptions,
    resources: state.resources, assessments: state.assessments,
  }),
  version: 2,
  migrate: (persisted) => {
    const value = persisted as Partial<AteStore> & { topics?: unknown };
    const { topics: _legacyTopics, ...operational } = value;
    return { ...freshSeed(), topics: canonicalTopics, ...operational } as AteStore;
  },
}));
