import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAcademicKnowledgeMigration } from "./db/migration";
import type { KnowledgeSqlClient } from "./db/client";
import { importAcademicKnowledge } from "./importer";

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
    const second = await importAcademicKnowledge(client, "DEVELOPMENT", paths);
    expect(second.importRunId).toBe(report.importRunId);
    expect((await client.query<{ count: string }>("SELECT count(*)::text AS count FROM knowledge_records")).rows[0].count).toBe("1");
  });
});
