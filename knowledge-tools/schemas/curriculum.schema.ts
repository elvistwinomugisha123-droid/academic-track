import { z } from "zod";
import { canonicalRecordSchema } from "./source.schema";

export const curriculumItemKindSchema = z.enum([
  "subject_profile",
  "topic",
  "subtopic",
  "competency",
  "learning_outcome",
  "learning_experience",
  "knowledge_concept",
  "skill",
  "generic_skill",
  "value",
  "cross_cutting_issue",
  "resource",
  "time_allocation",
  "programme_planner",
  "practical_requirement",
]);

export const curriculumItemSchema = canonicalRecordSchema.extend({
  entityType: curriculumItemKindSchema,
  normalized: z.object({
    subject: z.string().nullable(),
    level: z.string().nullable(),
    term: z.string().nullable(),
    title: z.string().nullable(),
    parentId: z.string().nullable(),
  }).passthrough(),
});

export type CurriculumItem = z.infer<typeof curriculumItemSchema>;
