import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const knowledgeSources = pgTable("knowledge_sources", {
  sourceId: text("source_id").primaryKey(),
  authority: text("authority").notNull(),
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  educationLevel: text("education_level").notNull(),
  subject: text("subject"),
  publicationYear: integer("publication_year"),
  effectiveYear: integer("effective_year"),
  sourceVersion: text("source_version"),
  checksumSha256: text("checksum_sha256").notNull(),
  rightsStatus: text("rights_status").notNull(),
  productionUseStatus: text("production_use_status").notNull(),
  externalAiAllowed: boolean("external_ai_allowed").notNull().default(false),
  attributionRequired: boolean("attribution_required").notNull().default(true),
  processingStatus: text("processing_status").notNull(),
  verificationStatus: text("verification_status").notNull(),
  sourcePath: text("source_path").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("knowledge_sources_subject_level_idx").on(table.subject, table.educationLevel),
  index("knowledge_sources_rights_idx").on(table.rightsStatus, table.productionUseStatus),
]);

export const knowledgeSourceSpans = pgTable("knowledge_source_spans", {
  spanId: text("span_id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => knowledgeSources.sourceId),
  pageStart: integer("page_start").notNull(),
  pageEnd: integer("page_end").notNull(),
  locator: text("locator").notNull(),
  sourceText: text("source_text").notNull(),
  extractionConfidence: text("extraction_confidence").notNull(),
  verificationStatus: text("verification_status").notNull(),
}, (table) => [index("knowledge_source_spans_source_page_idx").on(table.sourceId, table.pageStart)]);

export const knowledgeRecords = pgTable("knowledge_records", {
  canonicalId: text("canonical_id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => knowledgeSources.sourceId),
  spanId: text("span_id").notNull().references(() => knowledgeSourceSpans.spanId),
  recordType: text("record_type").notNull(),
  educationLevel: text("education_level").notNull(),
  subject: text("subject"),
  sourceWording: text("source_wording").notNull(),
  sourceLanguage: text("source_language").notNull().default("en"),
  normalized: jsonb("normalized").$type<Record<string, unknown>>().notNull(),
  extracted: jsonb("extracted").$type<Record<string, unknown>>().notNull(),
  verificationStatus: text("verification_status").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("knowledge_records_exact_lookup_idx").on(table.educationLevel, table.subject, table.recordType),
  index("knowledge_records_source_idx").on(table.sourceId),
]);

export const knowledgeRelationships = pgTable("knowledge_relationships", {
  relationshipId: text("relationship_id").primaryKey(),
  relationshipType: text("relationship_type").notNull(),
  fromCanonicalId: text("from_canonical_id").notNull(),
  toCanonicalId: text("to_canonical_id").notNull().references(() => knowledgeRecords.canonicalId),
  sourceId: text("source_id").notNull().references(() => knowledgeSources.sourceId),
  spanId: text("span_id").notNull().references(() => knowledgeSourceSpans.spanId),
  verificationStatus: text("verification_status").notNull(),
}, (table) => [
  index("knowledge_relationships_from_idx").on(table.fromCanonicalId),
  index("knowledge_relationships_to_idx").on(table.toCanonicalId),
]);

export const knowledgeLegacyIdMappings = pgTable("knowledge_legacy_id_mappings", {
  legacyId: text("legacy_id").primaryKey(),
  canonicalId: text("canonical_id").notNull().references(() => knowledgeRecords.canonicalId),
  mappingReason: text("mapping_reason").notNull(),
  verificationStatus: text("verification_status").notNull(),
  sourceId: text("source_id").references(() => knowledgeSources.sourceId),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeImportRuns = pgTable("knowledge_import_runs", {
  importRunId: text("import_run_id").primaryKey(),
  mode: text("mode").notNull(),
  datasetChecksumSha256: text("dataset_checksum_sha256").notNull(),
  sourceCount: integer("source_count").notNull(),
  importedCount: integer("imported_count").notNull(),
  rejectedCount: integer("rejected_count").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  report: jsonb("report").$type<Record<string, unknown>>().notNull(),
});
