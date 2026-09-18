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
  "activity",
  "assessment_strategy",
  "ict_support",
  "note",
  "source_note",
  "curriculum_framework",
  "active_learning_expectation",
  "assessment_principle",
  "cross_cutting_issue",
  "curriculum_menu",
  "elective_subject_time_allocation",
  "framework_model",
  "gender_equity",
  "generic_skill_descriptor",
  "graduate_profile",
  "implementation_guidance",
  "inclusion_mixed_ability",
  "key_learning_outcome",
  "learning_environment",
  "subject_menu",
  "subject_rationale",
  "subject_rationale_table",
  "subject_time_allocation",
  "teaching_learning_principle",
  "time_allocation_guidance",
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
