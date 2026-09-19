import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { assessmentItemSchema, curriculumItemSchema, relationshipSchema, sourceMetadataSchema } from "../../knowledge-tools/schemas";
import type { KnowledgeSqlClient } from "./db/client";
import { withKnowledgeTransaction } from "./db/transaction";
import { sha256Canonical } from "./canonical-json";
import { sourcePermitsProductionImport } from "./rights";
import type { ImportMode, ImportReport, KnowledgeSource, ProductionUseStatus, RightsStatus, VerificationStatus } from "./types";

type RegistryRecord = {
  source_id: string; authority: string; title: string; document_type: string; education_level: KnowledgeSource["educationLevel"];
  subject: string | null; publication_year: number | null; effective_year: number | null; version: string | null; checksum_sha256: string;
  rights_status: RightsStatus; production_use_status: ProductionUseStatus; processing_status: string; verification_status: string; local_path: string;
  duplicate_of: string | null;
};

export const ACADEMIC_KNOWLEDGE_IMPORTER_VERSION = "ate-knowledge-importer-2.0.0";
export const ACADEMIC_KNOWLEDGE_SCHEMA_VERSION = "ate-knowledge-v2";

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
function reviewState(value: string): VerificationStatus { return value === "UNVERIFIED" ? "UNVERIFIED" : "REVIEW_REQUIRED"; }

function sourceFromRegistry(record: RegistryRecord): KnowledgeSource {
  return {
    sourceId: record.source_id, authority: record.authority, title: record.title, documentType: record.document_type,
    educationLevel: record.education_level, subject: record.subject, publicationYear: record.publication_year, effectiveYear: record.effective_year,
    sourceVersion: record.version, checksumSha256: record.checksum_sha256, rightsStatus: "UNKNOWN",
    productionUseStatus: "PERMISSION_PENDING", externalAiAllowed: false, attributionRequired: true, formalArtifactAllowed: false, exportAllowed: false,
    processingStatus: record.processing_status, verificationStatus: reviewState(record.verification_status), sourcePath: record.local_path,
  };
}

async function upsertSource(client: KnowledgeSqlClient, source: KnowledgeSource): Promise<void> {
  const existing = await client.query<{ checksum_sha256: string }>("SELECT checksum_sha256 FROM knowledge_sources WHERE source_id=$1", [source.sourceId]);
  if (existing.rows[0] && existing.rows[0].checksum_sha256 !== source.checksumSha256) throw new Error(`Source ${source.sourceId} changed checksum; import requires a new source version identity.`);
  await client.query(`INSERT INTO knowledge_sources (source_id, authority, title, document_type, education_level, subject, publication_year, effective_year, source_version, checksum_sha256, rights_status, production_use_status, external_ai_allowed, attribution_required, processing_status, verification_status, source_path, source_schema_version, formal_artifact_allowed, export_allowed)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    ON CONFLICT (source_id) DO UPDATE SET authority=EXCLUDED.authority, title=EXCLUDED.title, document_type=EXCLUDED.document_type, education_level=EXCLUDED.education_level, subject=EXCLUDED.subject, publication_year=EXCLUDED.publication_year, effective_year=EXCLUDED.effective_year, source_version=EXCLUDED.source_version, processing_status=EXCLUDED.processing_status, source_path=EXCLUDED.source_path, source_schema_version=EXCLUDED.source_schema_version`, [source.sourceId, source.authority, source.title, source.documentType, source.educationLevel, source.subject, source.publicationYear, source.effectiveYear, source.sourceVersion, source.checksumSha256, source.rightsStatus, source.productionUseStatus, source.externalAiAllowed, source.attributionRequired, source.processingStatus, source.verificationStatus, source.sourcePath, "ate-source-v2", source.formalArtifactAllowed, source.exportAllowed]);
}

async function insertBatches(client: KnowledgeSqlClient, table: string, columns: string[], rows: unknown[][], chunkSize = 200): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const parameters: unknown[] = [];
    const placeholders = rows.slice(offset, offset + chunkSize).map((row) => `(${row.map((value) => { parameters.push(value); return `$${parameters.length}`; }).join(",")})`).join(",");
    await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders} ON CONFLICT DO NOTHING`, parameters);
  }
}

async function importAcademicKnowledgeInTransaction(client: KnowledgeSqlClient, mode: ImportMode, paths: KnowledgeImportPaths): Promise<ImportReport> {
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
    spanRows.push([span.id, parsedSource.sourceId, span.pageStart, span.pageEnd, span.locator, span.text, span.extractionConfidence, reviewState(span.verificationStatus), createHash("sha256").update(span.text).digest("hex"), "ate-extractor-unknown", ACADEMIC_KNOWLEDGE_SCHEMA_VERSION]);
    allowedSpans.add(span.id);
  }
  await insertBatches(client, "knowledge_source_spans", ["span_id", "source_id", "page_start", "page_end", "locator", "source_text", "extraction_confidence", "verification_status", "content_sha256", "extractor_version", "schema_version"], spanRows);
  const spansImported = spanRows.length;
  const inputRecords = [...curriculum.map((item) => curriculumItemSchema.parse(item)), ...assessment.map((item) => assessmentItemSchema.parse(item))] as CanonicalInput[];
  const existingRun = await client.query<{ import_run_id: string; report: ImportReport }>("SELECT import_run_id, report FROM knowledge_import_runs WHERE mode=$1 AND dataset_checksum_sha256=$2 AND importer_version=$3 AND schema_version=$4 AND transaction_status='COMMITTED' ORDER BY completed_at DESC LIMIT 1", [mode, manifest.datasetChecksumSha256, ACADEMIC_KNOWLEDGE_IMPORTER_VERSION, ACADEMIC_KNOWLEDGE_SCHEMA_VERSION]);
  const importedRecords: CanonicalInput[] = []; const byType: Record<string, number> = {}; const candidateToCanonical = new Map<string, string>(); const canonicalByCandidate = new Map<string, Map<string, string>>(); const identityRows: unknown[][] = [];
  const recordRows: unknown[][] = [];
  for (const record of inputRecords) {
    if (!allowedSources.has(record.provenance.sourceId) || !allowedSpans.has(record.provenance.spanId)) { rejected.push({ id: record.id, reason: "Record source is not permitted for this import mode." }); continue; }
    const source = sources.get(record.provenance.sourceId)!;
    const candidateContentSha256 = sha256Canonical({ entityType: record.entityType, sourceWording: record.sourceWording, normalized: record.normalized, extracted: record.extracted, provenance: record.provenance });
    const identity = await client.query<{ canonical_id: string; candidate_content_sha256: string }>("SELECT canonical_id, candidate_content_sha256 FROM knowledge_record_identity_mappings WHERE source_id=$1 AND source_checksum_sha256=$2 AND candidate_id=$3 AND importer_version=$4 AND schema_version=$5", [record.provenance.sourceId, source.checksumSha256, record.id, ACADEMIC_KNOWLEDGE_IMPORTER_VERSION, ACADEMIC_KNOWLEDGE_SCHEMA_VERSION]);
    const conflictingIdentity = await client.query<{ canonical_id: string; candidate_content_sha256: string }>("SELECT canonical_id, candidate_content_sha256 FROM knowledge_record_identity_mappings WHERE source_id=$1 AND source_checksum_sha256=$2 AND candidate_id=$3 AND importer_version=$4 AND schema_version=$5 LIMIT 1", [record.provenance.sourceId, source.checksumSha256, record.id, ACADEMIC_KNOWLEDGE_IMPORTER_VERSION, ACADEMIC_KNOWLEDGE_SCHEMA_VERSION]);
    if (conflictingIdentity.rows[0] && conflictingIdentity.rows[0].candidate_content_sha256 !== candidateContentSha256) throw new Error(`Candidate ${record.id} changed content under the same source/import/schema identity; explicit reviewed remapping is required.`);
    const canonicalId = identity.rows[0]?.canonical_id ?? randomUUID();
    if (!identity.rows[0]) identityRows.push([record.provenance.sourceId, source.checksumSha256, record.id, ACADEMIC_KNOWLEDGE_IMPORTER_VERSION, ACADEMIC_KNOWLEDGE_SCHEMA_VERSION, candidateContentSha256, canonicalId]);
    candidateToCanonical.set(`${record.provenance.sourceId}::${record.id}`, canonicalId);
    const sourceCandidates = canonicalByCandidate.get(record.id) ?? new Map<string, string>();
    sourceCandidates.set(record.provenance.sourceId, canonicalId);
    canonicalByCandidate.set(record.id, sourceCandidates);
    recordRows.push([canonicalId, record.provenance.sourceId, record.provenance.spanId, record.entityType, source.educationLevel, source.subject, record.sourceWording.text, record.sourceWording.language ?? "en", JSON.stringify(record.normalized), JSON.stringify(record.extracted), reviewState(record.verificationStatus), null, sha256Canonical(record.normalized), ACADEMIC_KNOWLEDGE_SCHEMA_VERSION]);
    importedRecords.push(record); byType[record.entityType] = (byType[record.entityType] ?? 0) + 1;
  }
  await insertBatches(client, "knowledge_records", ["canonical_id", "source_id", "span_id", "record_type", "education_level", "subject", "source_wording", "source_language", "normalized", "extracted", "verification_status", "record_key", "content_sha256", "payload_schema_version"], recordRows);
  await insertBatches(client, "knowledge_record_identity_mappings", ["source_id", "source_checksum_sha256", "candidate_id", "importer_version", "schema_version", "candidate_content_sha256", "canonical_id"], identityRows);
  const relationshipRows: unknown[][] = [];
  function resolveRelationshipEndpoint(candidateId: string, relationshipSourceId: string, relationshipId: string, endpoint: "from" | "to"): string {
    const sourceScoped = candidateToCanonical.get(`${relationshipSourceId}::${candidateId}`);
    if (sourceScoped) return sourceScoped;
    const candidates = [...(canonicalByCandidate.get(candidateId)?.entries() ?? [])];
    if (candidates.length > 1) throw new Error(`Ambiguous ${endpoint} endpoint ${candidateId} in relationship ${relationshipId}: it is present in multiple imported sources and is not present in relationship source ${relationshipSourceId}.`);
    if (candidates.length === 1) return candidates[0][1];
    throw new Error(`Unresolved ${endpoint} endpoint ${candidateId} in allowed relationship ${relationshipId}: no imported canonical record matches the candidate ID.`);
  }
  for (const rawRelationship of relationships) {
    const relationship = relationshipSchema.parse(rawRelationship);
    if (!allowedSources.has(relationship.provenance.sourceId) || !allowedSpans.has(relationship.provenance.spanId)) continue;
    const fromCanonicalId = resolveRelationshipEndpoint(relationship.fromId, relationship.provenance.sourceId, relationship.id, "from");
    const toCanonicalId = resolveRelationshipEndpoint(relationship.toId, relationship.provenance.sourceId, relationship.id, "to");
    relationshipRows.push([relationship.id, relationship.relationshipType, fromCanonicalId, toCanonicalId, relationship.provenance.sourceId, relationship.provenance.spanId, reviewState(relationship.verificationStatus)]);
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
    const canonicalId = candidateToCanonical.get(`${match.provenance.sourceId}::${match.id}`); if (!canonicalId) continue;
    if (await ensureLegacyKnowledgeMapping(client, { legacyId: item.id, canonicalId, sourceId: match.provenance.sourceId, mappingReason: "Exact lower-secondary Biology source wording match during corpus import." })) legacyIdsMapped += 1;
  }
  const report: ImportReport = { importRunId: existingRun.rows[0]?.import_run_id ?? runId, mode, recordsImportedByType: byType, sourcesImported: allowedSources.size, spansImported, relationshipsImported, legacyIdsMapped, sourcesRejected: rejectedSources, recordsRejected: rejected };
  if (!existingRun.rows[0]) {
    const reportHash = createHash("sha256").update(JSON.stringify(report)).digest("hex");
    await client.query(`INSERT INTO knowledge_import_runs (import_run_id, mode, dataset_checksum_sha256, source_count, imported_count, rejected_count, started_at, completed_at, report, importer_version, schema_version, manifest_id, transaction_status, completed_report_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,'COMMITTED',$13)`, [runId, mode, manifest.datasetChecksumSha256, allowedSources.size, importedRecords.length, rejected.length, startedAt.toISOString(), new Date().toISOString(), JSON.stringify(report), ACADEMIC_KNOWLEDGE_IMPORTER_VERSION, ACADEMIC_KNOWLEDGE_SCHEMA_VERSION, manifest.datasetChecksumSha256, reportHash]);
  }
  return report;
}

export async function ensureLegacyKnowledgeMapping(client: KnowledgeSqlClient, input: { legacyId: string; canonicalId: string; sourceId: string; mappingReason: string }): Promise<boolean> {
  const existing = await client.query<{ canonical_id: string }>("SELECT canonical_id FROM knowledge_legacy_id_mappings WHERE legacy_id=$1", [input.legacyId]);
  if (existing.rows[0]) {
    if (existing.rows[0].canonical_id !== input.canonicalId) throw new Error(`Legacy ID ${input.legacyId} already points to a different canonical record; explicit reviewed remapping is required.`);
    return false;
  }
  await client.query("INSERT INTO knowledge_legacy_id_mappings (legacy_id, canonical_id, mapping_reason, verification_status, source_id) VALUES ($1,$2,$3,'REVIEW_REQUIRED',$4)", [input.legacyId, input.canonicalId, input.mappingReason, input.sourceId]);
  return true;
}

export async function importAcademicKnowledge(client: KnowledgeSqlClient, mode: ImportMode, paths = defaultKnowledgeImportPaths): Promise<ImportReport> {
  return withKnowledgeTransaction(client, () => importAcademicKnowledgeInTransaction(client, mode, paths));
}
