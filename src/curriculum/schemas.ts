import { z } from "zod";

const sourceSchema = z.object({
  document_id: z.string(),
  authority: z.string(),
  document_title: z.string(),
  publication_year: z.number().nullable().optional(),
  document_version: z.string().nullable().optional(),
  page_pdf: z.number().nullable().optional(),
  page_printed: z.number().nullable().optional(),
  pages_pdf: z.array(z.number()).optional(),
  pages_printed: z.array(z.number()).optional(),
  section_heading: z.string().optional(),
  source_type: z.string().optional(),
  rights_notice_present: z.boolean().optional(),
}).passthrough();

const entitySchema = z.object({
  id: z.string(),
  entity_type: z.string(),
  text: z.string().optional(),
  source: sourceSchema.optional(),
  extraction_confidence: z.enum(["high", "medium", "low"]).optional(),
  human_review_ids: z.union([z.string(), z.array(z.string())]).optional(),
}).passthrough();

export const sourceManifestSchema = z.object({
  schema_version: z.string(),
  extraction_date: z.string().optional(),
  status: z.string().optional(),
  method: z.unknown().optional(),
  rights_and_authority: z.unknown().optional(),
  documents: z.array(z.unknown()),
});

export const frameworkSchema = z.object({
  id: z.string(),
  schema_version: z.string(),
  entity_type: z.string(),
  title: z.string(),
  source: sourceSchema,
  records: z.array(entitySchema),
}).passthrough();

export const subjectSchema = z.object({
  id: z.string(),
  schema_version: z.string(),
  entity_type: z.string(),
  title: z.string(),
  source: sourceSchema,
  subject_guidance: z.array(entitySchema).optional(),
}).passthrough();

export const topicSchema = z.object({
  id: z.string(),
  entity_type: z.literal("topic"),
  subject: z.string(),
  level: z.string(),
  term: z.number(),
  theme: z.string().nullable(),
  topic_code: z.string(),
  title: z.string(),
  allocated_periods: z.number().nullable(),
  competency: entitySchema.nullable(),
  learning_outcome_preamble: entitySchema.nullable().optional(),
  learning_outcomes: z.array(entitySchema),
  suggested_learning_activities: z.array(entitySchema),
  sample_assessment_strategies: z.array(entitySchema),
  ict_support: z.array(entitySchema),
  notes: z.array(entitySchema),
  source: sourceSchema,
  extraction_confidence: z.enum(["high", "medium", "low"]).optional(),
  human_review_ids: z.union([z.string(), z.array(z.string())]).optional(),
}).passthrough();

export const topicsFileSchema = z.object({ schema_version: z.string(), subject_id: z.string(), topics: z.array(topicSchema) });

export const runtimeContextSchema = z.object({ schema_version: z.string(), basis: z.string(), authority_boundary: z.unknown(), subject_context: z.unknown(), topics: z.array(z.unknown()) });

export const reviewItemSchema = z.object({
  id: z.string(),
  affected_entity: z.string().optional(),
  uncertain_text: z.string().optional(),
  reason_for_uncertainty: z.string().optional(),
  proposed_extraction: z.unknown().optional(),
  category: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
}).passthrough();

export const reviewQueueSchema = z.object({ schema_version: z.string(), status: z.string(), items: z.array(reviewItemSchema) });

export type AstraSource = z.infer<typeof sourceSchema>;
export type AstraEntity = z.infer<typeof entitySchema>;
export type AstraTopic = z.infer<typeof topicSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;
