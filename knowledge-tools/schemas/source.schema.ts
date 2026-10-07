import { z } from "zod";

export const verificationStateSchema = z.enum(["UNVERIFIED", "REVIEW_REQUIRED", "VERIFIED"]);
export const extractionConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const rightsStatusSchema = z.enum(["CLEARED", "REVIEW_REQUIRED", "RESTRICTED", "UNKNOWN", "OPERATOR_AUTHORIZED_FOR_PILOT"]);

export const provenanceSchema = z.object({
  sourceId: z.string().min(1),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  spanId: z.string().min(1),
  locator: z.string().min(1),
  extractionConfidence: extractionConfidenceSchema,
});

export const sourceMetadataSchema = z.object({
  sourceId: z.string().min(1),
  authority: z.string().min(1),
  title: z.string().min(1),
  documentType: z.string().min(1),
  educationLevel: z.enum(["lower-secondary", "advanced-secondary", "cross-level"]),
  subject: z.string().nullable(),
  publicationYear: z.number().int().nullable(),
  effectiveYear: z.number().int().nullable(),
  version: z.string().nullable(),
  rightsStatus: rightsStatusSchema,
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  sourcePath: z.string().min(1),
});

export const sourceWordingSchema = z.object({
  text: z.string(),
  label: z.string().nullable().optional(),
  language: z.string().default("en"),
});

export const extractedMetadataSchema = z.object({
  method: z.string().min(1),
  parserVersion: z.string().min(1),
  candidates: z.record(z.string(), z.unknown()).default({}),
});

export const canonicalRecordSchema = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1),
  sourceWording: sourceWordingSchema,
  normalized: z.record(z.string(), z.unknown()),
  extracted: extractedMetadataSchema,
  verificationStatus: verificationStateSchema,
  provenance: provenanceSchema,
});

export type SourceMetadata = z.infer<typeof sourceMetadataSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type CanonicalRecord = z.infer<typeof canonicalRecordSchema>;
