import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sha256Canonical } from "./canonical-json";
import type { KnowledgeImportPaths } from "./importer";

type ManifestDocument = { id: string; document_title: string; authority: string; publication_year: number | null; document_version: string | null; document_type: string; sha256: string; extraction_status: string };
type RawSource = { document_id: string; authority: string; document_title: string; publication_year: number | null; document_version: string | null; page_pdf: number; page_printed?: number; pages_pdf?: number[]; pages_printed?: number[]; section_heading?: string; source_type?: string; rights_notice_present?: boolean; spans?: Array<{ page_pdf: number; bbox?: number[] }> };
type RawEntity = { id: string; entity_type: string; text?: string; title?: string; subject?: string; level?: string; term?: number | string; topic_code?: string; source: RawSource; normalized_metadata?: Record<string, unknown>; derived_metadata?: Record<string, unknown>; [key: string]: unknown };
type RawRelationship = { id: string; from_id: string; to_id: string; relationship: string; source: RawSource; normalized_metadata?: Record<string, unknown>; extraction_confidence?: string };
type ReviewItem = { id: string; affected_entity: string; category: string; status: string; reason_for_uncertainty: string };

export type RealCorpusAdapterReport = {
  sources: string[];
  sourceChecksums: Record<string, string>;
  biologyEntities: number;
  frameworkRecords: number;
  relationshipsSeen: number;
  includedRecordIds: string[];
  excludedRecordIds: string[];
  excludedRelationshipIds: string[];
  unresolvedReviewItems: Array<{ id: string; affectedEntity: string; reason: string }>;
  reviewItems: number;
  datasetChecksumSha256: string;
};

export type RealCorpusAdapterOutput = { paths: KnowledgeImportPaths; report: RealCorpusAdapterReport; cleanup: () => Promise<void> };

function textFor(entity: RawEntity): string {
  return String(entity.text ?? entity.title ?? entity.topic_code ?? entity.id);
}

function safeType(entityType: string): string {
  if (entityType === "ict_support_preamble" || entityType === "learning_outcome_preamble") return "source_note";
  if (entityType === "subject") return "subject_profile";
  return entityType;
}

function levelValue(level: string | undefined): string | null {
  if (!level) return null;
  return level.toLowerCase().replace(/\s+/g, "-") === "senior-1" || level === "Senior 1" ? "Senior 1" : level;
}

function provenance(source: RawSource, spanId: string) {
  const pageStart = source.page_pdf;
  return { sourceId: source.document_id, pageStart, pageEnd: Math.max(pageStart, ...(source.pages_pdf ?? [pageStart])), spanId, locator: `${source.section_heading ?? "source"}#${spanId}`, extractionConfidence: String(source.spans?.length ? "HIGH" : "MEDIUM") as "HIGH" | "MEDIUM" | "LOW" };
}

export async function prepareRealBiologyCorpus(root = process.cwd()): Promise<RealCorpusAdapterOutput> {
  const data = path.join(root, "curriculum-data");
  const manifest = JSON.parse(await readFile(path.join(data, "01_source_manifest.json"), "utf8")) as { documents: ManifestDocument[] };
  const selected = manifest.documents.filter((document) => document.id === "ncdc-biology-2019" || document.id === "ncdc-framework-2019");
  if (selected.length !== 2) throw new Error("The committed real corpus must contain both Lower Secondary Biology and framework sources.");
  const sourceById = new Map(selected.map((source) => [source.id, source]));
  const biology = (await readFile(path.join(data, "05_biology_entities.jsonl"), "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as RawEntity);
  const frameworkDocument = JSON.parse(await readFile(path.join(data, "02_curriculum_framework.json"), "utf8")) as { id: string; entity_type: string; title: string; source: RawSource; records: RawEntity[] };
  const subject = JSON.parse(await readFile(path.join(data, "03_biology_subject.json"), "utf8")) as RawEntity;
  const relationships = (await readFile(path.join(data, "06_curriculum_relationships.jsonl"), "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as RawRelationship);
  const review = JSON.parse(await readFile(path.join(data, "09_human_review_queue.json"), "utf8")) as { items: ReviewItem[] };
  const reviewIds = new Set(review.items.filter((item) => item.status === "open").map((item) => item.affected_entity));
  const allEntities: RawEntity[] = [subject, ...biology, { id: frameworkDocument.id, entity_type: frameworkDocument.entity_type, title: frameworkDocument.title, source: frameworkDocument.source }, ...frameworkDocument.records];
  const excludedEntityIds = new Set(reviewIds);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const entity of allEntities) {
      const dependencies = Array.isArray(entity.derived_metadata?.restriction_bearing_entity_ids) ? entity.derived_metadata.restriction_bearing_entity_ids.map(String) : [];
      if (dependencies.some((dependency) => excludedEntityIds.has(dependency)) && !excludedEntityIds.has(entity.id)) { excludedEntityIds.add(entity.id); expanded = true; }
    }
  }
  const included = allEntities.filter((entity) => sourceById.has(entity.source.document_id) && !excludedEntityIds.has(entity.id));
  const includedIds = new Set(included.map((entity) => entity.id));
  const excluded = allEntities.filter((entity) => !includedIds.has(entity.id));
  const spanRows: string[] = [];
  const curriculumRows: string[] = [];
  const spanByEntity = new Map<string, string>();
  for (const entity of included) {
    const spanId = `real-${entity.source.document_id}-${entity.id}`;
    spanByEntity.set(entity.id, spanId);
    const p = provenance(entity.source, spanId);
    spanRows.push(JSON.stringify({ id: spanId, source: { sourceId: entity.source.document_id, authority: entity.source.authority, title: entity.source.document_title, documentType: sourceById.get(entity.source.document_id)?.document_type ?? "official_curriculum", educationLevel: "lower-secondary", subject: entity.source.document_id === "ncdc-biology-2019" ? "Biology" : null, publicationYear: entity.source.publication_year, effectiveYear: entity.source.publication_year, version: entity.source.document_version, rightsStatus: "UNKNOWN", checksumSha256: sourceById.get(entity.source.document_id)!.sha256, sourcePath: entity.source.document_id }, pageStart: p.pageStart, pageEnd: p.pageEnd, locator: p.locator, text: textFor(entity), extractionConfidence: p.extractionConfidence, verificationStatus: "REVIEW_REQUIRED" }));
    const type = safeType(entity.entity_type);
    const normalized = { subject: entity.subject ?? (entity.source.document_id === "ncdc-biology-2019" ? "Biology" : null), level: levelValue(entity.level), term: entity.term == null ? null : String(entity.term), title: entity.title ?? textFor(entity), parentId: null, recordKey: entity.topic_code ?? null, sourceEntityId: entity.id, ...entity.normalized_metadata };
    curriculumRows.push(JSON.stringify({ id: entity.id, entityType: type, sourceWording: { text: textFor(entity), language: "en" }, normalized, extracted: { method: "committed-curriculum-data-adapter", parserVersion: "ate-real-corpus-adapter-1.0.0", candidates: { sourceEntityId: entity.id, sourceDocumentId: entity.source.document_id } }, verificationStatus: "REVIEW_REQUIRED", provenance: p }));
  }
  const relationshipRows: string[] = [];
  const excludedRelationshipIds: string[] = [];
  for (const relationship of relationships) {
    const sourceSelected = sourceById.has(relationship.source.document_id);
    if (!sourceSelected || !includedIds.has(relationship.from_id) || !includedIds.has(relationship.to_id) || !spanByEntity.has(relationship.from_id) || !spanByEntity.has(relationship.to_id)) { excludedRelationshipIds.push(relationship.id); continue; }
    const spanId = `real-${relationship.source.document_id}-relationship-${relationship.id}`;
    const p = provenance(relationship.source, spanId);
    spanRows.push(JSON.stringify({ id: spanId, source: { sourceId: relationship.source.document_id, authority: relationship.source.authority, title: relationship.source.document_title, documentType: sourceById.get(relationship.source.document_id)?.document_type ?? "official_curriculum", educationLevel: "lower-secondary", subject: relationship.source.document_id === "ncdc-biology-2019" ? "Biology" : null, publicationYear: relationship.source.publication_year, effectiveYear: relationship.source.publication_year, version: relationship.source.document_version, rightsStatus: "UNKNOWN", checksumSha256: sourceById.get(relationship.source.document_id)!.sha256, sourcePath: relationship.source.document_id }, pageStart: p.pageStart, pageEnd: p.pageEnd, locator: `${p.locator}#relationship`, text: relationship.relationship, extractionConfidence: p.extractionConfidence, verificationStatus: "REVIEW_REQUIRED" }));
    relationshipRows.push(JSON.stringify({ id: relationship.id, relationshipType: relationship.relationship, fromId: relationship.from_id, toId: relationship.to_id, verificationStatus: "REVIEW_REQUIRED", provenance: { sourceId: relationship.source.document_id, pageStart: p.pageStart, pageEnd: p.pageEnd, spanId, locator: p.locator, extractionConfidence: p.extractionConfidence } }));
  }
  const temp = await mkdtemp(path.join(os.tmpdir(), "ate-real-corpus-"));
  const sourceRegistry = { records: selected.map((source) => ({ source_id: source.id, authority: source.authority, title: source.document_title, document_type: source.document_type, education_level: "lower-secondary", subject: source.id === "ncdc-biology-2019" ? "Biology" : null, publication_year: source.publication_year, effective_year: source.publication_year, version: source.document_version, checksum_sha256: source.sha256, rights_status: "UNKNOWN", production_use_status: "PERMISSION_PENDING", processing_status: source.extraction_status, verification_status: "REVIEW_REQUIRED", local_path: `curriculum-data/${source.id}`, duplicate_of: null })) };
  const datasetChecksumSha256 = sha256Canonical({ sources: selected.map((source) => ({ id: source.id, checksum: source.sha256 })), includedIds: [...includedIds].sort(), excludedRelationshipIds: [...excludedRelationshipIds].sort() });
  const files: Record<string, unknown> = { registry: sourceRegistry, datasetManifest: { datasetChecksumSha256 }, sourceSpans: spanRows.join("\n") + "\n", curriculumItems: curriculumRows.join("\n") + "\n", assessmentItems: "", relationships: relationshipRows.join("\n") + "\n", legacyEntities: "" };
  const paths = {} as KnowledgeImportPaths;
  for (const [key, value] of Object.entries(files)) { const filePath = path.join(temp, `${key}.${key === "registry" || key === "datasetManifest" ? "json" : "jsonl"}`); await writeFile(filePath, typeof value === "string" ? value : JSON.stringify(value)); (paths as Record<string, string>)[key] = filePath; }
  return { paths, report: { sources: selected.map((source) => source.id), sourceChecksums: Object.fromEntries(selected.map((source) => [source.id, source.sha256])), biologyEntities: biology.length, frameworkRecords: frameworkDocument.records.length, relationshipsSeen: relationships.length, includedRecordIds: [...includedIds].sort(), excludedRecordIds: excluded.map((entity) => entity.id), excludedRelationshipIds, unresolvedReviewItems: review.items.filter((item) => item.status === "open").map((item) => ({ id: item.id, affectedEntity: item.affected_entity, reason: item.reason_for_uncertainty })), reviewItems: review.items.length, datasetChecksumSha256 }, cleanup: () => rm(temp, { recursive: true, force: true }) };
}
