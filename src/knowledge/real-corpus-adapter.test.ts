import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { curriculumItemSchema } from "../../knowledge-tools/schemas/curriculum.schema";
import { relationshipSchema } from "../../knowledge-tools/schemas/relationships.schema";
import { PGlite } from "@electric-sql/pglite";
import { applyAcademicKnowledgeMigration } from "./db/migration";
import { importAcademicKnowledge } from "./importer";
import { prepareRealBiologyCorpus } from "./real-corpus-adapter";
import { createHistoricalBiologyPilot, verifyRealBiologyCleanSubset } from "./real-pilot";

describe("committed real Biology/framework corpus adapter", () => {
  it("preserves source identity and produces a review-excluding deterministic subset", async () => {
    const prepared = await prepareRealBiologyCorpus();
    try {
      expect(prepared.report.sources).toEqual(["ncdc-biology-2019", "ncdc-framework-2019"]);
      expect(prepared.report.sourceChecksums["ncdc-biology-2019"]).toBe("5b6bf4e8aa9d255be59148ac585a169baa5469186d96f9731428e263dd9c1b1c");
      expect(prepared.report.sourceChecksums["ncdc-framework-2019"]).toBe("75578bece361085dab500e2e7d6c2e1dd581c23bfb9bd8796be27351a77e253c");
      expect(prepared.report.biologyEntities).toBe(588);
      expect(prepared.report.frameworkRecords).toBe(130);
      expect(prepared.report.relationshipsSeen).toBe(1103);
      expect(prepared.report.reviewItems).toBe(26);
      expect(prepared.report.includedRecordIds).not.toContain("bio-s1-t2-1.3.2-lo-07");
      expect(prepared.report.excludedRelationshipIds.length).toBeGreaterThan(0);
      const [items, relationships] = await Promise.all([
        readFile(prepared.paths.curriculumItems, "utf8"),
        readFile(prepared.paths.relationships, "utf8"),
      ]);
      items.split(/\r?\n/).filter(Boolean).forEach((line) => curriculumItemSchema.parse(JSON.parse(line)));
      relationships.split(/\r?\n/).filter(Boolean).forEach((line) => relationshipSchema.parse(JSON.parse(line)));
    } finally {
      await prepared.cleanup();
    }
  });

  it("does not import the user extraction brief as curriculum authority", async () => {
    const prepared = await prepareRealBiologyCorpus();
    try { expect(prepared.report.sources).not.toContain("user-extraction-brief"); } finally { await prepared.cleanup(); }
  });

  it("imports the clean real candidate corpus without rights or verification elevation", async () => {
    const database = new PGlite();
    const client = { query: async <Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) => ({ rows: (await database.query(statement, parameters)).rows as Row[] }), close: async () => { await database.close(); } };
    await applyAcademicKnowledgeMigration(client);
    const prepared = await prepareRealBiologyCorpus();
    try {
      const report = await importAcademicKnowledge(client, "DEVELOPMENT", prepared.paths);
      expect(report.sourcesImported).toBe(2);
      expect(report.relationshipsImported).toBeGreaterThan(0);
      expect(report.recordsImportedByType.topic).toBeGreaterThan(0);
      expect((await client.query<{ count: string }>("select count(*)::text as count from knowledge_sources")).rows[0].count).toBe("2");
      expect((await client.query<{ count: string }>("select count(*)::text as count from knowledge_records where verification_status <> 'REVIEW_REQUIRED'")).rows[0].count).toBe("0");
      expect((await client.query<{ count: string }>("select count(*)::text as count from knowledge_rights_decisions")).rows[0].count).toBe("0");
    } finally {
      await prepared.cleanup();
      await client.close();
    }
  }, 60_000);

  it("classifies source interpretation as supporting and makes clean-subset verification resumable", async () => {
    const database = new PGlite();
    const client = { query: async <Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) => ({ rows: (await database.query(statement, parameters)).rows as Row[] }), close: async () => { await database.close(); } };
    const actor = "00000000-0000-0000-0000-000000000401";
    await applyAcademicKnowledgeMigration(client);
    const prepared = await prepareRealBiologyCorpus();
    try {
      await importAcademicKnowledge(client, "DEVELOPMENT", prepared.paths);
      const pilot = await createHistoricalBiologyPilot(client, actor, prepared.report.datasetChecksumSha256);
      expect((await client.query<{ count: string }>("select count(*)::text as count from knowledge_profile_records pr join knowledge_records r on r.canonical_id=pr.canonical_id join knowledge_record_taxonomy t on t.record_type=r.record_type where pr.subject_profile_id=$1 and pr.membership_role='SUPPORTING' and t.authority_eligible=false", [pilot.profileId])).rows[0].count).toBe("18");
      const first = await verifyRealBiologyCleanSubset(client, pilot.profileId, actor);
      const firstCount = (await client.query<{ count: string }>("select count(*)::text as count from knowledge_verification_decisions")).rows[0].count;
      const second = await verifyRealBiologyCleanSubset(client, pilot.profileId, actor);
      const secondCount = (await client.query<{ count: string }>("select count(*)::text as count from knowledge_verification_decisions")).rows[0].count;
      expect(first.records).toBe(700);
      expect(first.relationships).toBe(601);
      expect(second.records).toBe(700);
      expect(second.relationships).toBe(601);
      expect(secondCount).toBe(firstCount);
    } finally {
      await prepared.cleanup();
      await client.close();
    }
  }, 180_000);
});
