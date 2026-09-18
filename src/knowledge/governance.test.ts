import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAcademicKnowledgeMigration } from "./db/migration";
import type { KnowledgeSqlClient } from "./db/client";
import { activateKnowledgeRelease, recordKnowledgeRightsDecision, recordKnowledgeVerificationDecision, submitKnowledgeReleaseForReview, supersedeKnowledgeRelease } from "./governance";
import { retrieveExactKnowledge } from "./retrieval";

const sourceId = "TEST_SYNTHETIC_SOURCE";
const spanId = "TEST_SYNTHETIC_SOURCE:P1";
const canonicalId = "TEST-SYNTHETIC-CANONICAL-1";
const subjectId = "00000000-0000-0000-0000-000000000101";
const releaseId = "00000000-0000-0000-0000-000000000102";
const profileId = "00000000-0000-0000-0000-000000000103";
const actorId = "00000000-0000-0000-0000-000000000104";
const checksum = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const manifestChecksum = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function pgliteClient(database: PGlite): KnowledgeSqlClient {
  return { async query<Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) { const result = await database.query(statement, parameters); return { rows: result.rows as Row[] }; }, async close() { await database.close(); } };
}

describe("central Academic Knowledge governance", () => {
  let database: PGlite;
  let client: KnowledgeSqlClient;

  beforeAll(async () => {
    database = new PGlite(); client = pgliteClient(database); await applyAcademicKnowledgeMigration(client);
    await client.query("INSERT INTO knowledge_sources (source_id,authority,title,document_type,education_level,subject,checksum_sha256,rights_status,production_use_status,processing_status,verification_status,source_path) VALUES ($1,'TEST','TEST SYNTHETIC SOURCE','TEST','lower-secondary','physics',$2,'REVIEW_REQUIRED','PERMISSION_PENDING','IMPORTED','UNVERIFIED','synthetic://TEST_SYNTHETIC_SOURCE')", [sourceId, checksum]);
    await client.query("INSERT INTO knowledge_source_spans (span_id,source_id,page_start,page_end,locator,source_text,extraction_confidence,verification_status,content_sha256,extractor_version,schema_version) VALUES ($1,$2,1,1,'page:1','Synthetic source wording','HIGH','UNVERIFIED',$3,'test-extractor','test-schema')", [spanId, sourceId, checksum]);
    await client.query("INSERT INTO knowledge_records (canonical_id,source_id,span_id,record_type,education_level,subject,source_wording,normalized,extracted,verification_status,content_sha256,payload_schema_version) VALUES ($1,$2,$3,'topic','lower-secondary','physics','Synthetic source wording',$4::jsonb,$5::jsonb,'UNVERIFIED',$6,'test-schema')", [canonicalId, sourceId, spanId, JSON.stringify({ title: "Synthetic topic" }), JSON.stringify({ method: "synthetic-test" }), checksum]);
    await client.query("INSERT INTO knowledge_curriculum_subjects (id,subject_key,title,education_level,status) VALUES ($1,'TEST-LOWER-PHYSICS','TEST Synthetic Physics','lower-secondary','DRAFT')", [subjectId]);
    await client.query("INSERT INTO knowledge_curriculum_releases (id,release_key,authority,display_name,education_level,version_label,effective_from,status,manifest_checksum_sha256) VALUES ($1,'TEST-SYNTHETIC-RELEASE','TEST AUTHORITY','TEST Synthetic Release','lower-secondary','test-1','2026-01-01','DRAFT',$2)", [releaseId, manifestChecksum]);
    await client.query("INSERT INTO knowledge_subject_profiles (id,release_id,governed_subject_id,profile_key,display_title,education_level,status,requires_assessment_profile) VALUES ($1,$2,$3,'TEST-SYNTHETIC-PHYSICS','TEST Synthetic Physics Profile','lower-secondary','DRAFT',false)", [profileId, releaseId, subjectId]);
    await client.query("INSERT INTO knowledge_release_sources (release_id,subject_profile_id,source_id,source_role,is_required,status) VALUES ($1,$2,$3,'SUBJECT_SYLLABUS',true,'APPROVED')", [releaseId, profileId, sourceId]);
    await client.query("INSERT INTO knowledge_profile_records (release_id,subject_profile_id,canonical_id,membership_role,status,ordering_key) VALUES ($1,$2,$3,'CURRICULUM','APPROVED','001')", [releaseId, profileId, canonicalId]);
  }, 60_000);

  afterAll(async () => { await client.close(); });

  it("keeps central authority server-only and blocks unaudited elevation", async () => {
    const rls = await client.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE oid='public.knowledge_sources'::regclass");
    expect(rls.rows[0].relrowsecurity).toBe(true);
    const browserRoles = await client.query<{ rolname: string }>("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')");
    for (const role of browserRoles.rows) {
      const privilege = await client.query<{ allowed: boolean }>("SELECT has_table_privilege($1, 'public.knowledge_sources', 'INSERT') AS allowed", [role.rolname]);
      expect(privilege.rows[0].allowed).toBe(false);
    }
    await expect(client.query("UPDATE knowledge_sources SET verification_status='VERIFIED' WHERE source_id=$1", [sourceId])).rejects.toThrow();
    await expect(client.query("UPDATE knowledge_sources SET rights_status='CLEARED', production_use_status='PERMITTED' WHERE source_id=$1", [sourceId])).rejects.toThrow();
  });

  it("fails closed until source, span, record, and rights decisions are independently recorded", async () => {
    await submitKnowledgeReleaseForReview(client, releaseId);
    let report = await activateKnowledgeRelease(client, releaseId, actorId);
    expect(report.activated).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["NOT_VERIFIED", "RIGHTS_DENIED"]));
    await recordKnowledgeRightsDecision(client, { sourceId, rightsStatus: "CLEARED", productionUseStatus: "PERMITTED", externalAiAllowed: false, formalArtifactAllowed: true, exportAllowed: true, attributionRequired: true, decisionSource: "TEST_SYNTHETIC_REVIEW", actorUserId: actorId });
    await recordKnowledgeVerificationDecision(client, { entityType: "SOURCE", entityId: sourceId, resultingStatus: "VERIFIED", actorUserId: actorId, reason: "Synthetic fixture checked against its synthetic source." });
    await recordKnowledgeVerificationDecision(client, { entityType: "SPAN", entityId: spanId, resultingStatus: "VERIFIED", actorUserId: actorId, reason: "Synthetic span checked." });
    report = await activateKnowledgeRelease(client, releaseId, actorId);
    expect(report.activated).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain("NOT_VERIFIED");
    await recordKnowledgeVerificationDecision(client, { entityType: "RECORD", entityId: canonicalId, resultingStatus: "VERIFIED", actorUserId: actorId, reason: "Synthetic normalized record checked against the synthetic span." });
    report = await activateKnowledgeRelease(client, releaseId, actorId);
    expect(report).toMatchObject({ activated: true, status: "ACTIVE", issues: [] });
    const release = await client.query<{ status: string }>("SELECT status FROM knowledge_curriculum_releases WHERE id=$1", [releaseId]);
    expect(release.rows[0].status).toBe("ACTIVE");
  });

  it("returns only complete governed provenance and applies the external-AI rights gate", async () => {
    const request = { use: "PRODUCTION_APP" as const, releaseId, subjectProfileId: profileId, effectiveOn: "2026-03-01", recordTypes: ["topic"] };
    const records = await retrieveExactKnowledge(client, request);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ canonicalId, governance: { releaseId, subjectProfileId: profileId, conflictFree: true }, provenance: { sourceId, spanId, pageStart: 1, sourceContentSha256: checksum, recordContentSha256: checksum } });
    await expect(retrieveExactKnowledge(client, { ...request, use: "EXTERNAL_AI" })).rejects.toMatchObject({ code: "RIGHTS_DENIED" });
    await recordKnowledgeRightsDecision(client, { sourceId, rightsStatus: "CLEARED", productionUseStatus: "PERMITTED", externalAiAllowed: true, formalArtifactAllowed: true, exportAllowed: true, attributionRequired: true, decisionSource: "TEST_SYNTHETIC_EXTERNAL_AI_REVIEW", actorUserId: actorId });
    expect(await retrieveExactKnowledge(client, { ...request, use: "EXTERNAL_AI" })).toHaveLength(1);
    expect((await retrieveExactKnowledge(client, request))[0].canonicalId).toBe((await retrieveExactKnowledge(client, request))[0].canonicalId);
  });

  it("blocks open conflicts, wrong profiles, and superseded releases", async () => {
    await expect(client.query("UPDATE knowledge_curriculum_releases SET display_name='MUTATED' WHERE id=$1", [releaseId])).rejects.toThrow();
    await expect(client.query("UPDATE knowledge_profile_records SET ordering_key='002' WHERE release_id=$1", [releaseId])).rejects.toThrow();
    const conflictId = "00000000-0000-0000-0000-000000000105";
    await client.query("INSERT INTO knowledge_conflicts (id,release_id,subject_profile_id,category,status,summary) VALUES ($1,$2,$3,'WORDING','OPEN','TEST OPEN CONFLICT')", [conflictId, releaseId, profileId]);
    await client.query("INSERT INTO knowledge_conflict_items (conflict_id,item_type,canonical_id,item_role) VALUES ($1,'RECORD',$2,'CLAIM_A')", [conflictId, canonicalId]);
    await expect(retrieveExactKnowledge(client, { use: "PRODUCTION_APP", releaseId, subjectProfileId: profileId, effectiveOn: "2026-03-01", recordTypes: ["topic"] })).rejects.toMatchObject({ code: "CONFLICT_UNRESOLVED" });
    await client.query("DELETE FROM knowledge_conflict_items WHERE conflict_id=$1", [conflictId]); await client.query("DELETE FROM knowledge_conflicts WHERE id=$1", [conflictId]);
    const wrongProfile = "00000000-0000-0000-0000-000000000106";
    await expect(retrieveExactKnowledge(client, { use: "PRODUCTION_APP", releaseId, subjectProfileId: wrongProfile, effectiveOn: "2026-03-01", recordTypes: ["topic"] })).rejects.toMatchObject({ code: "PROFILE_MISMATCH" });
    await supersedeKnowledgeRelease(client, releaseId);
    await expect(retrieveExactKnowledge(client, { use: "PRODUCTION_APP", releaseId, subjectProfileId: profileId, effectiveOn: "2026-03-01", recordTypes: ["topic"] })).rejects.toMatchObject({ code: "RELEASE_SUPERSEDED" });
  });

  it("enforces append-only decisions and relational provenance constraints", async () => {
    await expect(client.query("UPDATE knowledge_verification_decisions SET reason='changed' WHERE entity_id=$1", [canonicalId])).rejects.toThrow();
    await expect(client.query("DELETE FROM knowledge_rights_decisions WHERE source_id=$1", [sourceId])).rejects.toThrow();
    await expect(client.query("INSERT INTO knowledge_records (canonical_id,source_id,span_id,record_type,education_level,subject,source_wording,normalized,extracted,verification_status) VALUES ('TEST-BAD-ENDPOINT',$1,'missing-span','topic','lower-secondary','physics','bad','{}','{}','UNVERIFIED')", [sourceId])).rejects.toThrow();
    await expect(client.query("INSERT INTO knowledge_relationships (relationship_id,relationship_type,from_canonical_id,to_canonical_id,source_id,span_id,verification_status) VALUES ('TEST-BAD-REL','TOPIC_CONTAINS_OUTCOME','missing-from',$1,$2,$3,'UNVERIFIED')", [canonicalId, sourceId, spanId])).rejects.toThrow();
  });
});
