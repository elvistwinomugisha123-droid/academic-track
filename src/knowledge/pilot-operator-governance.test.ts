import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAcademicKnowledgeMigration } from "./db/migration";
import type { KnowledgeSqlClient } from "./db/client";
import { activateKnowledgeReleaseForControlledPilot, recordKnowledgePilotOperatorAuthorization, submitKnowledgeReleaseForReview } from "./governance";
import { retrieveExactKnowledge } from "./retrieval";

const sourceId = "TEST-OPERATOR-PILOT-SYLLABUS";
const checksum = "a".repeat(64);
const candidateHash = "b".repeat(64);
const recordId = "TEST-OPERATOR-PILOT-TOPIC";
const profileId = "a1111111-1111-4111-8111-111111111111";
const releaseId = "a2222222-2222-4222-8222-222222222222";
const subjectId = "a3333333-3333-4333-8333-333333333333";
const decisionId = "a4444444-4444-4444-8444-444444444444";
const actorId = "a5555555-5555-4555-8555-555555555555";
const manifestChecksum = "c".repeat(64);

describe("dataset-level operator verification for controlled-pilot curriculum", () => {
  let database: PGlite;
  let client: KnowledgeSqlClient;
  beforeAll(async () => {
    database = new PGlite();
    client = { async query<Row extends Record<string, unknown>>(sql: string, args: unknown[] = []) {
      const result = await database.query(sql, args); return { rows: result.rows as Row[] };
    }, async close() { await database.close(); } };
    await applyAcademicKnowledgeMigration(client);
    await client.query("INSERT INTO knowledge_sources(source_id,authority,title,document_type,education_level,subject,checksum_sha256,rights_status,production_use_status,processing_status,verification_status,source_path) VALUES($1,'NCDC','Pilot syllabus','syllabus','lower-secondary','mathematics',$2,'UNKNOWN','PERMISSION_PENDING','IMPORTED','REVIEW_REQUIRED','private:test')", [sourceId, checksum]);
    await client.query("INSERT INTO knowledge_source_spans(span_id,source_id,page_start,page_end,locator,source_text,extraction_confidence,verification_status,content_sha256) VALUES($1,$2,1,1,'PDF page 1','Source-backed topic','HIGH','REVIEW_REQUIRED',$3)", [sourceId + ":p1", sourceId, checksum]);
    await client.query("INSERT INTO knowledge_records(canonical_id,source_id,span_id,record_type,education_level,subject,source_wording,normalized,extracted,verification_status,content_sha256) VALUES($1,$2,$3,'topic','lower-secondary','mathematics','Source-backed topic',$4::jsonb,$5::jsonb,'REVIEW_REQUIRED',$6)", [recordId, sourceId, sourceId + ":p1", JSON.stringify({ title: "Topic" }), JSON.stringify({ method: "source-checked" }), checksum]);
    await client.query("INSERT INTO knowledge_record_identity_mappings(source_id,source_checksum_sha256,candidate_id,importer_version,schema_version,candidate_content_sha256,canonical_id) VALUES($1,$2,'candidate:topic','pilot-test','pilot-test',$3,$4)", [sourceId, checksum, candidateHash, recordId]);
    await client.query("INSERT INTO knowledge_curriculum_subjects(id,subject_key,title,education_level,status) VALUES($1,'TEST-PILOT-MATH','Mathematics','lower-secondary','DRAFT')", [subjectId]);
    await client.query("INSERT INTO knowledge_curriculum_releases(id,release_key,authority,display_name,education_level,version_label,effective_from,status,manifest_checksum_sha256) VALUES($1,'TEST-OPERATOR-PILOT','NCDC','Pilot release','lower-secondary','2019',NULL,'DRAFT',$2)", [releaseId, manifestChecksum]);
    await client.query("INSERT INTO knowledge_subject_profiles(id,release_id,governed_subject_id,profile_key,display_title,education_level,status,runtime_status,requires_assessment_profile) VALUES($1,$2,$3,'TEST-PILOT-PROFILE','Mathematics','lower-secondary','DRAFT','CANDIDATE',false)", [profileId, releaseId, subjectId]);
    await client.query("INSERT INTO knowledge_release_sources(release_id,subject_profile_id,source_id,source_role,is_required,status,approved_at,approved_by) VALUES($1,$2,$3,'SUBJECT_SYLLABUS',true,'APPROVED',now(),$4)", [releaseId, profileId, sourceId, actorId]);
    await client.query("INSERT INTO knowledge_profile_records(release_id,subject_profile_id,canonical_id,membership_role,status,runtime_status,approved_at,approved_by) VALUES($1,$2,$3,'CURRICULUM','APPROVED','CANDIDATE',now(),$4)", [releaseId, profileId, recordId, actorId]);
    await client.query("INSERT INTO knowledge_pilot_curriculum_decisions(decision_id,release_id,manifest_checksum_sha256,dataset_checksum_sha256,source_checksums,parser_versions,decision_payload,decision_payload_sha256,actor_user_id) VALUES($1,$2,$3,$4,$5::jsonb,'[\"pilot-test\"]'::jsonb,'{}'::jsonb,$6,$7)", [decisionId, releaseId, manifestChecksum, "d".repeat(64), JSON.stringify({ [sourceId]: checksum }), "e".repeat(64), actorId]);
    await client.query("INSERT INTO knowledge_pilot_curriculum_record_memberships(decision_id,release_id,subject_profile_id,canonical_id,source_id,source_checksum_sha256,candidate_id,candidate_content_sha256) VALUES($1,$2,$3,$4,$5,$6,'candidate:topic',$7)", [decisionId, releaseId, profileId, recordId, sourceId, checksum, candidateHash]);
    await submitKnowledgeReleaseForReview(client, releaseId);
  }, 60_000);
  afterAll(async () => { await client.close(); });

  it("keeps UNKNOWN rights closed even with a dataset decision, then accepts the exact authorised syllabus", async () => {
    const denied = await activateKnowledgeReleaseForControlledPilot(client, releaseId, actorId);
    expect(denied.activated).toBe(false);
    expect(denied.issues.map((issue) => issue.code)).toContain("RIGHTS_DENIED");
    await recordKnowledgePilotOperatorAuthorization(client, { sourceId, expectedChecksumSha256: checksum,
      decisionSource: "test operator decision", actorUserId: actorId, evidenceReference: "test:checksum-bound" });
    const accepted = await activateKnowledgeReleaseForControlledPilot(client, releaseId, actorId);
    expect(accepted).toMatchObject({ activated: true, issues: [] });
    await client.query("SELECT public.activate_knowledge_profile_pilot($1,$2,$3)", [profileId, actorId, "Source and dataset checked"]);
    const records = await retrieveExactKnowledge(client, { use: "CONTROLLED_PILOT", releaseId, subjectProfileId: profileId,
      effectiveOn: "2026-10-07", recordTypes: ["topic"] });
    expect(records.map((record) => record.canonicalId)).toEqual([recordId]);
    const assessment = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM knowledge_assessment_profiles WHERE release_id=$1", [releaseId]);
    expect(Number(assessment.rows[0].count)).toBe(0);
  });
});
