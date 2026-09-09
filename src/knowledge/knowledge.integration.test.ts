import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAcademicKnowledgeMigration } from "./db/migration";
import type { KnowledgeSqlClient } from "./db/client";
import { importAcademicKnowledge } from "./importer";
import { retrieveExactKnowledge } from "./retrieval";
import { assembleAssessmentContext, assembleLessonContext } from "@/intelligence/context-assembler";
import { seedState } from "@/data/seed";

function pgliteClient(database: PGlite): KnowledgeSqlClient {
  return {
    async query<Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) {
      const result = await database.query(statement, parameters);
      return { rows: result.rows as Row[] };
    },
    async close() { await database.close(); },
  };
}

describe("Academic Knowledge PostgreSQL foundation", () => {
  let client: KnowledgeSqlClient;

  let developmentReport: Awaited<ReturnType<typeof importAcademicKnowledge>>;

  beforeAll(async () => {
    client = pgliteClient(new PGlite());
    await applyAcademicKnowledgeMigration(client);
    developmentReport = await importAcademicKnowledge(client, "DEVELOPMENT");
  }, 60_000);

  afterAll(async () => { await client.close(); });

  it("imports the structured corpus for controlled development and preserves canonical records", async () => {
    const report = developmentReport;
    expect(report.sourcesImported).toBe(45);
    expect(report.recordsImportedByType.topic).toBeGreaterThan(0);
    expect(report.recordsImportedByType.assessment_guidance).toBeGreaterThan(0);
    expect(report.relationshipsImported).toBeGreaterThan(10_000 - 1);
    expect(report.recordsRejected).toEqual([]);
    expect(report.legacyIdsMapped).toBeGreaterThan(0);
    const verified = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM knowledge_records WHERE verification_status = 'VERIFIED'");
    expect(verified.rows[0].count).toBe("0");
  }, 60_000);

  it("retrieves exact lower and advanced secondary records with provenance", async () => {
    const lower = await retrieveExactKnowledge(client, { use: "DEVELOPMENT_VIEW", subject: "physics", educationLevel: "lower-secondary", recordTypes: ["topic"], limit: 3 });
    const advanced = await retrieveExactKnowledge(client, { use: "DEVELOPMENT_VIEW", subject: "physics", educationLevel: "advanced-secondary", recordTypes: ["assessment_guidance"], limit: 3 });
    const biology = await retrieveExactKnowledge(client, { use: "DEVELOPMENT_VIEW", subject: "biology", educationLevel: "lower-secondary", recordTypes: ["topic"], limit: 3 });
    const legacyId = await client.query<{ legacy_id: string }>("SELECT legacy_id FROM knowledge_legacy_id_mappings ORDER BY legacy_id LIMIT 1");
    const legacy = await retrieveExactKnowledge(client, { use: "DEVELOPMENT_VIEW", legacyId: legacyId.rows[0].legacy_id });
    expect(lower).not.toHaveLength(0);
    expect(advanced).not.toHaveLength(0);
    expect(biology).not.toHaveLength(0);
    expect(legacy).not.toHaveLength(0);
    expect(lower[0]).toMatchObject({ educationLevel: "lower-secondary", subject: "physics", verificationStatus: "REVIEW_REQUIRED" });
    expect(advanced[0]).toMatchObject({ educationLevel: "advanced-secondary", subject: "physics", verificationStatus: "REVIEW_REQUIRED" });
    expect(biology[0]).toMatchObject({ educationLevel: "lower-secondary", subject: "biology", verificationStatus: "REVIEW_REQUIRED" });
    expect(lower[0].provenance).toMatchObject({ pageStart: expect.any(Number), sourceId: expect.stringContaining("lower-secondary-physics"), rightsStatus: "REVIEW_REQUIRED", productionUseStatus: "PERMISSION_PENDING" });
  }, 60_000);

  it("retrieves the representative subject and assessment matrix with complete provenance", async () => {
    const queries = [
      { label: "Lower Secondary Physics", subject: "physics", educationLevel: "lower-secondary" as const, recordTypes: ["topic"] },
      { label: "Lower Secondary Biology", subject: "biology", educationLevel: "lower-secondary" as const, recordTypes: ["topic"] },
      { label: "Lower Secondary Mathematics", subject: "mathematics", educationLevel: "lower-secondary" as const, recordTypes: ["topic"] },
      { label: "Advanced Secondary Physics", subject: "physics", educationLevel: "advanced-secondary" as const, recordTypes: ["topic"] },
      { label: "Advanced Secondary Biology", subject: "biology", educationLevel: "advanced-secondary" as const, recordTypes: ["topic"] },
      { label: "Advanced Secondary Geography", subject: "geography", educationLevel: "advanced-secondary" as const, recordTypes: ["topic"] },
      { label: "Advanced Secondary Biology assessment profile", subject: "biology", educationLevel: "advanced-secondary" as const, recordTypes: ["assessment_guidance"] },
    ];

    for (const query of queries) {
      const records = await retrieveExactKnowledge(client, { use: "DEVELOPMENT_VIEW", ...query, limit: 3 });
      expect(records, query.label).not.toHaveLength(0);
      for (const record of records) {
        expect(record).toMatchObject({
          educationLevel: query.educationLevel,
          subject: query.subject,
          verificationStatus: "REVIEW_REQUIRED",
          provenance: {
            sourceId: expect.stringContaining(`${query.educationLevel}-${query.subject}`),
            pageStart: expect.any(Number),
            rightsStatus: "REVIEW_REQUIRED",
            productionUseStatus: "PERMISSION_PENDING",
          },
        });
      }
    }
  }, 60_000);

  it("fails closed for production and external AI retrieval when rights are pending", async () => {
    const request = { subject: "biology", educationLevel: "lower-secondary" as const, recordTypes: ["topic"] };
    await expect(retrieveExactKnowledge(client, { ...request, use: "PRODUCTION_APP" })).rejects.toMatchObject({ code: "KNOWLEDGE_RIGHTS_DENIED" });
    await expect(retrieveExactKnowledge(client, { ...request, use: "EXTERNAL_AI" })).rejects.toMatchObject({ code: "KNOWLEDGE_RIGHTS_DENIED" });
  }, 60_000);

  it("rejects permission-pending sources in production-authorised import mode", async () => {
    const productionClient = pgliteClient(new PGlite());
    await applyAcademicKnowledgeMigration(productionClient);
    const report = await importAcademicKnowledge(productionClient, "PRODUCTION_AUTHORISED");
    expect(report.sourcesImported).toBe(0);
    expect(report.recordsImportedByType).toEqual({});
    expect(report.sourcesRejected).toHaveLength(45);
    expect(report.recordsRejected).toHaveLength(10_186);
    await productionClient.close();
  }, 60_000);

  it("assembles teacher lesson context from section facts and provenance-bearing curriculum", async () => {
    const current = await client.query<{ canonical_id: string }>("SELECT canonical_id FROM knowledge_records WHERE education_level = 'lower-secondary' AND subject = 'biology' AND record_type = 'topic' ORDER BY canonical_id LIMIT 1");
    const state = structuredClone(seedState);
    state.outcomes.push({ id: "previous-outcome", scheduledLessonId: "lesson-1", sectionId: "s1-east-biology", recordedBy: "person-teacher", type: "PARTIALLY_DELIVERED", addressedLearningOutcomeIds: [], partiallyAddressedLearningOutcomeIds: [], note: "Continue practical observation.", recordedAt: "2026-09-08T09:00:00.000Z" });
    const context = await assembleLessonContext(client, { state, sectionId: "s1-east-biology", currentKnowledgeId: current.rows[0].canonical_id, use: "DEVELOPMENT_VIEW" });
    expect(context.section).toMatchObject({ subject: "Biology", currentOutcomeStatus: "UNCONFIRMED" });
    expect(context.previousOutcome).toMatchObject({ id: "previous-outcome", type: "PARTIALLY_DELIVERED" });
    expect(context.currentCurriculum[0].provenance).toMatchObject({ sourceId: expect.stringContaining("lower-secondary-biology"), pageStart: expect.any(Number), rightsStatus: "REVIEW_REQUIRED" });
    expect(context.lessonPlanningContext.schoolConstraints).toContain("Four microscopes available");
  }, 60_000);

  it("assembles advanced assessment context without collapsing its profile into lower-secondary rules", async () => {
    const context = await assembleAssessmentContext(client, { state: seedState, sectionId: "s1-east-biology", educationLevel: "advanced-secondary", subject: "biology", purpose: "DIAGNOSTIC", use: "DEVELOPMENT_VIEW" });
    expect(context.assessmentPurpose).toBe("DIAGNOSTIC");
    expect(context.assessmentProfile).not.toHaveLength(0);
    expect(context.assessmentProfile.every((record) => record.educationLevel === "advanced-secondary" && record.subject === "biology")).toBe(true);
    expect(context.assessmentProfile[0].provenance).toMatchObject({ sourceId: expect.stringContaining("advanced-secondary-biology"), rightsStatus: "REVIEW_REQUIRED", productionUseStatus: "PERMISSION_PENDING" });
    expect(context.eligibleCurriculumScope.allowed).toEqual(expect.any(Array));
  }, 60_000);
});
