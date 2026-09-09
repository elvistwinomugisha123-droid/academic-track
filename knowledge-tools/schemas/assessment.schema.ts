import { z } from "zod";
import { canonicalRecordSchema } from "./source.schema";

export const assessmentItemKindSchema = z.enum([
  "assessment_profile",
  "assessment_objective",
  "construct",
  "ability",
  "indicator",
  "assessment_rule",
  "paper_structure",
  "scoring_rule",
  "rubric_rule",
  "performance_descriptor",
  "assessment_guidance",
]);

export const assessmentItemSchema = canonicalRecordSchema.extend({
  entityType: assessmentItemKindSchema,
  normalized: z.object({
    subject: z.string().nullable(),
    educationLevel: z.enum(["lower-secondary", "advanced-secondary", "cross-level"]),
    appliesTo: z.string().nullable(),
  }).passthrough(),
});
