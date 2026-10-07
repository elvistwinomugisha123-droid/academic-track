import type { LessonArtifactType } from "@/artifacts/types";

type Schema = { [key: string]: unknown };
const string = { type: "string" } as const;
const integer = { type: "integer" } as const;
const strings = { type: "array", items: string } as const;

function object(properties: Record<string, Schema>): Schema {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const curriculumAnchor = object({
  canonicalId: string,
  title: string,
  positionKind: { anyOf: [{ type: "string", enum: ["TOPIC", "LEARNING_OUTCOME"] }, { type: "null" }] },
  profileId: { anyOf: [string, { type: "null" }] },
  rightsState: { type: "string", enum: ["CLEARED", "OPERATOR_AUTHORIZED_FOR_PILOT", "REVIEW_REQUIRED", "RESTRICTED", "UNKNOWN"] },
});

const teachingStep = object({
  id: string, label: string, minutes: integer, teacherActivity: string,
  learnerActivity: string, prompts: strings, formativeCheck: string,
});

export const lessonArtifactOutputSchemas: Record<LessonArtifactType, Schema> = {
  FORMAL_LESSON_PLAN: object({
    title: string,
    curriculumAnchor: { anyOf: [curriculumAnchor, { type: "null" }] },
    learningIntention: string, expectedOutcome: string, priorLearning: string,
    continuityContext: string, lessonFocus: string, intendedCoverage: string,
    durationMinutes: integer, resources: strings,
    teachingSequence: { type: "array", items: teachingStep },
    differentiation: string, conclusionFollowUp: string, teacherNotes: string,
  }),
  BOARD_NOTES: object({ title: string, keyPoints: strings, examples: strings, equations: strings, prompts: strings }),
  LEARNER_NOTES: object({ title: string, keyConcepts: strings, explanation: string, examples: strings, applications: strings, summary: string }),
  ACTIVITY_SHEET: object({ title: string, instructions: string, materialsRequired: strings, tasks: strings, questions: strings, observationResponseArea: string, conclusionPrompts: strings }),
  LESSON_SUMMARY: object({ title: string, keyTakeaways: strings, conciseSummary: string, learnerReflection: string }),
  HOMEWORK: object({ title: string, instructions: string, tasks: strings, followUpNotes: string }),
};

export const askATEOutputSchema = object({ answer: string, suggestedFollowUps: strings });
