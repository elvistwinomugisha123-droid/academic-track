import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAcademicKnowledgeMigration } from "./db/migration";
import type { KnowledgeSqlClient } from "./db/client";
import { ensureLegacyKnowledgeMapping, importAcademicKnowledge } from "./importer";

function pgliteClient(database: PGlite): KnowledgeSqlClient { return { async query<Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) { const result = await database.query(statement, parameters); return { rows: result.rows as Row[] }; }, async close() { await database.close(); } }; }

describe("candidate-only Academic Knowledge import", () => {
  let database: PGlite; let client: KnowledgeSqlClient; let fixtureDirectory: string;
  beforeAll(async () => {
    database = new PGlite(); client = pgliteClient(database); await applyAcademicKnowledgeMigration(client); fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "ate-knowledge-test-"));
    const source = { source_id: "TEST_SYNTHETIC_IMPORT_SOURCE", authority: "TEST", title: "TEST Synthetic Import Source", document_type: "TEST", education_level: "lower-secondary", subject: "physics", publication_year: 2026, effective_year: 2026, version: "test-1", checksum_sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", rights_status: "CLEARED", production_use_status: "PERMITTED", processing_status: "IMPORTED", verification_status: "VERIFIED", local_path: "synthetic://import", duplicate_of: null };
    const sourceSpan = { id: "TEST_SYNTHETIC_IMPORT_SOURCE:P1", source: { sourceId: source.source_id, authority: source.authority, title: source.title, documentType: source.document_type, educationLevel: source.education_level, subject: source.subject, publicationYear: source.publication_year, effectiveYear: source.effective_year, version: source.version, rightsStatus: source.rights_status, checksumSha256: source.checksum_sha256, sourcePath: source.local_path }, pageStart: 1, pageEnd: 1, locator: "page:1", text: "Synthetic imported wording", extractionConfidence: "HIGH", verificationStatus: "VERIFIED" };
    const item = { id: "TEST-SYNTHETIC-CANDIDATE-1", entityType: "topic", sourceWording: { text: "Synthetic imported wording", language: "en" }, normalized: { subject: "physics", level: "lower-secondary", term: null, title: "Synthetic imported topic", parentId: null }, extracted: { method: "synthetic", parserVersion: "test", candidates: {} }, verificationStatus: "VERIFIED", provenance: { sourceId: source.source_id, pageStart: 1, pageEnd: 1, spanId: sourceSpan.id, locator: "page:1", extractionConfidence: "HIGH" } };
    const files: Record<string, unknown> = {
      registry: { records: [source] }, datasetManifest: { datasetChecksumSha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" }, sourceSpans: [sourceSpan], curriculumItems: [item], assessmentItems: [], relationships: [], legacyEntities: [],
    };
    for (const [name, value] of Object.entries(files)) await writeFile(path.join(fixtureDirectory, `${name}.json${name === "sourceSpans" || name === "curriculumItems" || name === "assessmentItems" || name === "relationships" || name === "legacyEntities" ? "l" : ""}`), name === "sourceSpans" || name === "curriculumItems" || name === "assessmentItems" || name === "relationships" || name === "legacyEntities" ? `${(value as unknown[]).map((row) => JSON.stringify(row)).join("\n")}\n` : JSON.stringify(value));
  }, 60_000);
  afterAll(async () => { await rm(fixtureDirectory, { recursive: true, force: true }); await client.close(); });

  it("imports deterministic candidates without granting authority or activation", async () => {
    const paths = { registry: path.join(fixtureDirectory, "registry.json"), datasetManifest: path.join(fixtureDirectory, "datasetManifest.json"), sourceSpans: path.join(fixtureDirectory, "sourceSpans.jsonl"), curriculumItems: path.join(fixtureDirectory, "curriculumItems.jsonl"), assessmentItems: path.join(fixtureDirectory, "assessmentItems.jsonl"), relationships: path.join(fixtureDirectory, "relationships.jsonl"), legacyEntities: path.join(fixtureDirectory, "legacyEntities.jsonl") };
    const report = await importAcademicKnowledge(client, "DEVELOPMENT", paths);
    expect(report.sourcesImported).toBe(1);
    expect(report.recordsImportedByType.topic).toBe(1);
    expect((await client.query<{ verification_status: string }>("SELECT verification_status FROM knowledge_records")).rows[0].verification_status).toBe("REVIEW_REQUIRED");
    expect((await client.query<{ count: string }>("SELECT count(*)::text AS count FROM knowledge_curriculum_releases WHERE status='ACTIVE'")).rows[0].count).toBe("0");
    const mapping = await client.query<{ canonical_id: string }>("SELECT canonical_id FROM knowledge_record_identity_mappings WHERE candidate_id=$1", ["TEST-SYNTHETIC-CANDIDATE-1"]);
    expect(mapping.rows).toHaveLength(1);
    expect(await ensureLegacyKnowledgeMapping(client, { legacyId: "TEST-LEGACY-ID", canonicalId: mapping.rows[0].canonical_id, sourceId: "TEST_SYNTHETIC_IMPORT_SOURCE", mappingReason: "Synthetic test mapping." })).toBe(true);
    await expect(ensureLegacyKnowledgeMapping(client, { legacyId: "TEST-LEGACY-ID", canonicalId: "DIFFERENT-CANONICAL", sourceId: "TEST_SYNTHETIC_IMPORT_SOURCE", mappingReason: "Unreviewed repoint." })).rejects.toThrow("different canonical");
    const originalItem = await readFile(paths.curriculumItems, "utf8");
    const changedItem = { ...JSON.parse(originalItem) as Record<string, unknown>, normalized: { subject: "physics", level: "lower-secondary", term: null, title: "CHANGED UNDER SAME IDENTITY", parentId: null } };
    await writeFile(paths.curriculumItems, `${JSON.stringify(changedItem)}\n`);
    await expect(importAcademicKnowledge(client, "DEVELOPMENT", paths)).rejects.toThrow("changed content");
    await writeFile(paths.curriculumItems, originalItem);
    const second = await importAcademicKnowledge(client, "DEVELOPMENT", paths);
    expect(second.importRunId).toBe(report.importRunId);
    expect((await client.query<{ count: string }>("SELECT count(*)::text AS count FROM knowledge_records")).rows[0].count).toBe("1");
  });

  it("resolves cross-source relationship endpoints and rejects ambiguous fallback IDs", async () => {
    const paths = { registry: path.join(fixtureDirectory, "registry.json"), datasetManifest: path.join(fixtureDirectory, "datasetManifest.json"), sourceSpans: path.join(fixtureDirectory, "sourceSpans.jsonl"), curriculumItems: path.join(fixtureDirectory, "curriculumItems.jsonl"), assessmentItems: path.join(fixtureDirectory, "assessmentItems.jsonl"), relationships: path.join(fixtureDirectory, "relationships.jsonl"), legacyEntities: path.join(fixtureDirectory, "legacyEntities.jsonl") };
    const sourceA = JSON.parse(await readFile(paths.registry, "utf8")) as { records: Array<Record<string, unknown>> };
    const sourceB = { source_id: "TEST_SYNTHETIC_IMPORT_SOURCE_B", authority: "TEST", title: "TEST Synthetic Import Source B", document_type: "TEST", education_level: "lower-secondary", subject: "physics", publication_year: 2026, effective_year: 2026, version: "test-1", checksum_sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", rights_status: "CLEARED", production_use_status: "PERMITTED", processing_status: "IMPORTED", verification_status: "VERIFIED", local_path: "synthetic://import-b", duplicate_of: null };
    sourceA.records.push(sourceB);
    const sourceSpanA = JSON.parse((await readFile(paths.sourceSpans, "utf8")).split(/\r?\n/).filter(Boolean)[0]) as Record<string, unknown>;
    const sourceSpanB = { ...sourceSpanA, id: "TEST_SYNTHETIC_IMPORT_SOURCE_B:P1", source: { ...(sourceSpanA.source as Record<string, unknown>), sourceId: sourceB.source_id, title: sourceB.title, checksumSha256: sourceB.checksum_sha256, sourcePath: sourceB.local_path }, text: "Synthetic cross-source target wording" };
    const itemA = JSON.parse((await readFile(paths.curriculumItems, "utf8")).split(/\r?\n/).filter(Boolean)[0]) as Record<string, unknown>;
    const itemB = { ...itemA, id: "TEST-CROSS-SOURCE-CANDIDATE-B", sourceWording: { text: "Synthetic cross-source target wording", language: "en" }, normalized: { ...(itemA.normalized as Record<string, unknown>), title: "Synthetic cross-source target" }, provenance: { ...(itemA.provenance as Record<string, unknown>), sourceId: sourceB.source_id, spanId: sourceSpanB.id } };
    const crossSourceRelationship = { id: "TEST-CROSS-SOURCE-RELATIONSHIP", relationshipType: "SOURCE_DEFINES_ENTITY", fromId: itemA.id, toId: itemB.id, verificationStatus: "REVIEW_REQUIRED", provenance: { ...(itemA.provenance as Record<string, unknown>), sourceId: sourceA.records[0].source_id, spanId: sourceSpanA.id } };
    await writeFile(paths.registry, JSON.stringify(sourceA));
    await writeFile(paths.sourceSpans, `${JSON.stringify(sourceSpanA)}\n${JSON.stringify(sourceSpanB)}\n`);
    await writeFile(paths.curriculumItems, `${JSON.stringify(itemA)}\n${JSON.stringify(itemB)}\n`);
    await writeFile(paths.relationships, `${JSON.stringify(crossSourceRelationship)}\n`);
    await writeFile(paths.datasetManifest, JSON.stringify({ datasetChecksumSha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }));
    const report = await importAcademicKnowledge(client, "DEVELOPMENT", paths);
    expect(report.relationshipsImported).toBe(1);
    const endpoints = await client.query<{ from_canonical_id: string; to_canonical_id: string }>("select rel.from_canonical_id, rel.to_canonical_id from knowledge_relationships rel where rel.relationship_id=$1", [crossSourceRelationship.id]);
    const expectedFrom = await client.query<{ canonical_id: string }>("select canonical_id from knowledge_record_identity_mappings where source_id=$1 and candidate_id=$2", [sourceA.records[0].source_id, itemA.id]);
    const expectedTo = await client.query<{ canonical_id: string }>("select canonical_id from knowledge_record_identity_mappings where source_id=$1 and candidate_id=$2", [sourceB.source_id, itemB.id]);
    expect(endpoints.rows).toEqual([{ from_canonical_id: expectedFrom.rows[0].canonical_id, to_canonical_id: expectedTo.rows[0].canonical_id }]);
    const rerun = await importAcademicKnowledge(client, "DEVELOPMENT", paths);
    expect(rerun.importRunId).toBe(report.importRunId);
    expect(rerun.relationshipsImported).toBe(1);
    expect((await client.query<{ count: string }>("select count(*)::text as count from knowledge_relationships where relationship_id=$1", [crossSourceRelationship.id])).rows[0].count).toBe("1");

    const sourceC = { ...sourceB, source_id: "TEST_SYNTHETIC_IMPORT_SOURCE_C", title: "TEST Synthetic Import Source C", checksum_sha256: "1111111111111111111111111111111111111111111111111111111111111111", local_path: "synthetic://import-c" };
    const sourceD = { ...sourceB, source_id: "TEST_SYNTHETIC_IMPORT_SOURCE_D", title: "TEST Synthetic Import Source D", checksum_sha256: "2222222222222222222222222222222222222222222222222222222222222222", local_path: "synthetic://import-d" };
    sourceA.records.push(sourceC, sourceD);
    const ambiguousItem = (source: typeof sourceC) => ({ ...itemB, id: "AMBIGUOUS-CANDIDATE", sourceWording: { text: `Ambiguous ${source.source_id}`, language: "en" }, provenance: { ...(itemB.provenance as Record<string, unknown>), sourceId: source.source_id, spanId: `${source.source_id}:P1` } });
    const spanFor = (source: typeof sourceC) => ({ ...sourceSpanB, id: `${source.source_id}:P1`, source: { ...(sourceSpanB.source as Record<string, unknown>), sourceId: source.source_id, title: source.title, checksumSha256: source.checksum_sha256, sourcePath: source.local_path }, text: `Ambiguous ${source.source_id}` });
    const ambiguousRelationship = { ...crossSourceRelationship, id: "TEST-AMBIGUOUS-RELATIONSHIP", fromId: "AMBIGUOUS-CANDIDATE" };
    await writeFile(paths.registry, JSON.stringify(sourceA));
    await writeFile(paths.sourceSpans, `${JSON.stringify(sourceSpanA)}\n${JSON.stringify(sourceSpanB)}\n${JSON.stringify(spanFor(sourceC))}\n${JSON.stringify(spanFor(sourceD))}\n`);
    await writeFile(paths.curriculumItems, `${JSON.stringify(itemA)}\n${JSON.stringify(itemB)}\n${JSON.stringify(ambiguousItem(sourceC))}\n${JSON.stringify(ambiguousItem(sourceD))}\n`);
    await writeFile(paths.relationships, `${JSON.stringify(crossSourceRelationship)}\n${JSON.stringify(ambiguousRelationship)}\n`);
    await writeFile(paths.datasetManifest, JSON.stringify({ datasetChecksumSha256: "3333333333333333333333333333333333333333333333333333333333333333" }));
    await expect(importAcademicKnowledge(client, "DEVELOPMENT", paths)).rejects.toThrow("Ambiguous from endpoint AMBIGUOUS-CANDIDATE");
  });
});
