import { z } from "zod";
import { curriculumItemSchema } from "./curriculum.schema";

export const lowerSecondaryCurriculumItemSchema = curriculumItemSchema.extend({
  normalized: z.object({
    subject: z.string().min(1),
    yearClass: z.string().nullable(),
    term: z.string().nullable(),
    topic: z.string().nullable(),
    subtopic: z.string().nullable(),
    assessmentGuidance: z.string().nullable(),
  }).passthrough(),
});

export const lowerSecondaryAssessmentEvidenceSchema = z.object({
  learningOutcomeId: z.string().nullable(),
  evidenceMode: z.enum(["observation", "conversation", "product", "activity_of_integration", "other"]),
  criteria: z.array(z.string()),
});
