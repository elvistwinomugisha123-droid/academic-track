import { z } from "zod";
import { provenanceSchema, verificationStateSchema } from "./source.schema";

export const relationshipTypeSchema = z.enum([
  "SUBJECT_CONTAINS_TOPIC",
  "TOPIC_CONTAINS_OUTCOME",
  "OUTCOME_FOLLOWS_OUTCOME",
  "OUTCOME_RELATED_TO_COMPETENCY",
  "OUTCOME_SUPPORTS_CONSTRUCT",
  "CONSTRUCT_ASSESSED_THROUGH_ABILITY",
  "ABILITY_EVIDENCED_BY_INDICATOR",
  "ASSESSMENT_RULE_APPLIES_TO_SUBJECT",
  "SOURCE_DEFINES_ENTITY",
  "PREREQUISITE_OF",
  "CURRICULUM_LINKED_TO_ASSESSMENT_GUIDANCE",
]);

export const relationshipSchema = z.object({
  id: z.string().min(1),
  relationshipType: relationshipTypeSchema,
  fromId: z.string().min(1),
  toId: z.string().min(1),
  verificationStatus: verificationStateSchema,
  provenance: provenanceSchema,
});
