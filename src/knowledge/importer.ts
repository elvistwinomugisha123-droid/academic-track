import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assessmentItemSchema, curriculumItemSchema, relationshipSchema, sourceMetadataSchema } from "../../knowledge-tools/schemas";
import type { KnowledgeSqlClient } from "./db/client";
import { sourcePermitsProductionImport } from "./rights";
import type { ImportMode, ImportReport, KnowledgeSource, ProductionUseStatus, RightsStatus, VerificationStatus } from "./types";

type RegistryRecord = {
  source_id: string; authority: string; title: string; document_type: string; education_level: KnowledgeSource["educationLevel"];
  subject: string | null; publication_year: number | null; effective_year: number | null; version: string | null; checksum_sha256: string;
  rights_status: RightsStatus; production_use_status: ProductionUseStatus; processing_status: string; verification_status: string; local_path: string;
  duplicate_of: string | null;
};

type SourceSpan = { id: string; source: unknown; pageStart: number; pageEnd: number; locator: string; text: string; extractionConfidence: "HIGH" | "MEDIUM" | "LOW"; verificationStatus: VerificationStatus };
type CanonicalInput = { id: string; entityType: string; sourceWording: { text: string; language?: string }; normalized: Record<string, unknown>; extracted: Record<string, unknown>; verificationStatus: VerificationStatus; provenance: { sourceId: string; spanId: string } };

export type KnowledgeImportPaths = {
  registry: string;
  datasetManifest: string;
  sourceSpans: string;
  curriculumItems: string;
  assessmentItems: string;
  relationships: string;
  legacyEntities: string;
};

export const defaultKnowledgeImportPaths: KnowledgeImportPaths = {
  registry: path.join(process.cwd(), "knowledge-sources", "derived", "manifests", "source-registry.json"),
  datasetManifest: path.join(process.cwd(), "knowledge-sources", "derived", "manifests", "knowledge-dataset-manifest.json"),
  sourceSpans: path.join(process.cwd(), "knowledge-sources", "derived", "source-spans", "source-spans.jsonl"),
  curriculumItems: path.join(process.cwd(), "knowledge-sources", "derived", "structured", "curriculum-items.jsonl"),
  assessmentItems: path.join(process.cwd(), "knowledge-sources", "derived", "structured", "assessment-items.jsonl"),
  relationships: path.join(process.cwd(), "knowledge-sources", "derived", "structured", "curriculum-relationships.jsonl"),
  legacyEntities: path.join(process.cwd(), "curriculum-data", "05_biology_entities.jsonl"),
};

async function jsonFile<T>(filePath: string): Promise<T> { return JSON.parse(await readFile(filePath, "utf8")) as T; }
async function jsonLines<T>(filePath: string): Promise<T[]> { return (await readFile(filePath, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line) as T); }
function reviewState(value: string): VerificationStatus { return value === "VERIFIED" ? "VERIFIED" : value === "UNVERIFIED" ? "UNVERIFIED" : "REVIEW_REQUIRED"; }

function sourceFromRegistry(record: RegistryRecord): KnowledgeSource {
  return {
    sourceId: record.source_id, authority: record.authority, title: record.title, documentType: record.document_type,
    educationLevel: record.education_level, subject: record.subject, publicationYear: record.publication_year, effectiveYear: record.effective_year,
    sourceVersion: record.version, checksumSha256: record.checksum_sha256, rightsStatus: record.rights_status,
    productionUseStatus: record.production_use_status, externalAiAllowed: false, attributionRequired: true,
    processingStatus: record.processing_status, verificationStatus: reviewState(record.verification_status), sourcePath: record.local_path,
  };
}

async function upsertSource(client: KnowledgeSqlClient, source: KnowledgeSource): Promise<void> {
  await client.query(`INSERT INTO knowledge_sources (source_id, authority, title, document_type, education_level, subject, publication_year, effective_year, source_version, checksum_sha256, rights_status, production_use_status, external_ai_allowed, attribution_required, processing_status, verification_status, source_path)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ON CONFLICT (source_id) DO UPDATE SET authority=EXCLUDED.authority, title=EXCLUDED.title, document_type=EXCLUDED.document_type, education_level=EXCLUDED.education_level, subject=EXCLUDED.subject, publication_year=EXCLUDED.publication_year, effective_year=EXCLUDED.effective_year, source_version=EXCLUDED.source_version, checksum_sha256=EXCLUDED.checksum_sha256, rights_status=EXCLUDED.rights_status, production_use_status=EXCLUDED.production_use_status, external_ai_allowed=EXCLUDED.external_ai_allowed, attribution_required=EXCLUDED.attribution_required, processing_status=EXCLUDED.processing_status, verification_status=EXCLUDED.verification_status, source_path=EXCLUDED.source_path`, [source.sourceId, source.authority, source.title, source.documentType, source.educationLevel, source.subject, source.publicationYear, source.effectiveYear, source.sourceVersion, source.checksumSha256, source.rightsStatus, source.productionUseStatus, source.externalAiAllowed, source.attributionRequired, source.processingStatus, source.verificationStatus, source.sourcePath]);
}

async function insertBatches(client: KnowledgeSqlClient, table: string, columns: string[], rows: unknown[][], chunkSize = 200): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const parameters: unknown[] = [];
    const placeholders = rows.slice(offset, offset + chunkSize).map((row) => `(${row.map((value) => { parameters.push(value); return `$${parameters.length}`; }).join(",")})`).join(",");
    await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders} ON CONFLICT DO NOTHING`, parameters);
  }
}

export async function importAcademicKnowledge(client: KnowledgeSqlClient, mode: ImportMode, paths = defaultKnowledgeImportPaths): Promise<ImportReport> {
  const [registry, manifest, spans, curriculum, assessment, relationships, legacy] = await Promise.all([
    jsonFile<{ records: RegistryRecord[] }>(paths.registry), jsonFile<{ datasetChecksumSha256: string }>(paths.datasetManifest),
    jsonLines<SourceSpan>(paths.sourceSpans), jsonLines<CanonicalInput>(paths.curriculumItems), jsonLines<CanonicalInput>(paths.assessmentItems),
    jsonLines<{ id?: string; text?: string }>(paths.relationships), jsonLines<{ id?: string; text?: string }>(paths.legacyEntities),
  ]);
  const runId = randomUUID(); const startedAt = new Date(); const rejected: ImportReport["recordsRejected"] = []; const rejectedSources: ImportReport["sourcesRejected"] = [];
  const uniqueRegistry = new Map<string, RegistryRecord>();
  for (const record of registry.records) if (!record.duplicate_of) uniqueRegistry.set(record.source_id, record);
  const sources = new Map([...uniqueRegistry.values()].map((record) => [record.source_id, sourceFromRegistry(record)]));
  const allowedSources = new Set<string>();
  for (const source of sources.values()) {
    if (mode === "PRODUCTION_AUTHORISED" && !sourcePermitsProductionImport(source)) {
      rejectedSources.push({ sourceId: source.sourceId, reason: "Source is not cleared and permitted for production-authorised import." });
      continue;
    }
    await upsertSource(client, source); allowedSources.add(source.sourceId);
  }
  const allowedSpans = new Set<string>(); const spanRows: unknown[][] = [];
  for (const span of spans) {
    const parsedSource = sourceMetadataSchema.parse(span.source);
    if (!allowedSources.has(parsedSource.sourceId)) continue;
    spanRows.push([span.id, parsedSource.sourceId, span.pageStart, span.pageEnd, span.locator, span.text, span.extractionConfidence, reviewState(span.verificationStatus)]);
    allowedSpans.add(span.id);
  }
  await insertBatches(client, "knowledge_source_spans", ["span_id", "source_id", "page_start", "page_end", "locator", "source_text", "extraction_confidence", "verification_status"], spanRows);
  const spansImported = spanRows.length;
  const inputRecords = [...curriculum.map((item) => curriculumItemSchema.parse(item)), ...assessment.map((item) => assessmentItemSchema.parse(item))] as CanonicalInput[];
  const importedRecords: CanonicalInput[] = []; const byType: Record<string, number> = {};
  const recordRows: unknown[][] = [];
  for (const record of inputRecords) {
    if (!allowedSources.has(record.provenance.sourceId) || !allowedSpans.has(record.provenance.spanId)) { rejected.push({ id: record.id, reason: "Record source is not permitted for this import mode." }); continue; }
    const source = sources.get(record.provenance.sourceId)!;
    recordRows.push([record.id, record.provenance.sourceId, record.provenance.spanId, record.entityType, source.educationLevel, source.subject, record.sourceWording.text, record.sourceWording.language ?? "en", JSON.stringify(record.normalized), JSON.stringify(record.extracted), reviewState(record.verificationStatus)]);
    importedRecords.push(record); byType[record.entityType] = (byType[record.entityType] ?? 0) + 1;
  }
  await insertBatches(client, "knowledge_records", ["canonical_id", "source_id", "span_id", "record_type", "education_level", "subject", "source_wording", "source_language", "normalized", "extracted", "verification_status"], recordRows);
  const importedRecordIds = new Set(importedRecords.map((record) => record.id)); const relationshipRows: unknown[][] = [];
  for (const rawRelationship of relationships) {
    const relationship = relationshipSchema.parse(rawRelationship);
    if (!allowedSources.has(relationship.provenance.sourceId) || !allowedSpans.has(relationship.provenance.spanId) || !importedRecordIds.has(relationship.toId)) continue;
    relationshipRows.push([relationship.id, relationship.relationshipType, relationship.fromId, relationship.toId, relationship.provenance.sourceId, relationship.provenance.spanId, relationship.verificationStatus]);
  }
  await insertBatches(client, "knowledge_relationships", ["relationship_id", "relationship_type", "from_canonical_id", "to_canonical_id", "source_id", "span_id", "verification_status"], relationshipRows);
  const relationshipsImported = relationshipRows.length;
  const biologySourceIds = new Set([...sources.values()].filter((source) => source.educationLevel === "lower-secondary" && source.subject === "biology").map((source) => source.sourceId));
  const canonicalByWording = new Map(importedRecords.filter((record) => biologySourceIds.has(record.provenance.sourceId)).map((record) => [record.sourceWording.text.trim().replace(/\s+/g, " ").toLowerCase(), record]));
  let legacyIdsMapped = 0;
  for (const item of legacy) {
    if (!item.id || !item.text) continue;
    const match = canonicalByWording.get(item.text.trim().replace(/\s+/g, " ").toLowerCase());
    if (!match) continue;
    await client.query(`INSERT INTO knowledge_legacy_id_mappings (legacy_id, canonical_id, mapping_reason, verification_status, source_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (legacy_id) DO UPDATE SET canonical_id=EXCLUDED.canonical_id, mapping_reason=EXCLUDED.mapping_reason, verification_status=EXCLUDED.verification_status, source_id=EXCLUDED.source_id`, [item.id, match.id, "Exact lower-secondary Biology source wording match during corpus import.", "REVIEW_REQUIRED", match.provenance.sourceId]);
    legacyIdsMapped += 1;
  }
  const report: ImportReport = { importRunId: runId, mode, recordsImportedByType: byType, sourcesImported: allowedSources.size, spansImported, relationshipsImported, legacyIdsMapped, sourcesRejected: rejectedSources, recordsRejected: rejected };
  await client.query(`INSERT INTO knowledge_import_runs (import_run_id, mode, dataset_checksum_sha256, source_count, imported_count, rejected_count, started_at, completed_at, report) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [runId, mode, manifest.datasetChecksumSha256, allowedSources.size, importedRecords.length, rejected.length, startedAt.toISOString(), new Date().toISOString(), JSON.stringify(report)]);
  return report;
}
