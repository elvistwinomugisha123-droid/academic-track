import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { applyAcademicKnowledgeMigration } from "./db/migration";
import type { KnowledgeSqlClient } from "./db/client";
import { getCurrentTeachingSectionCurriculumPosition, recordTeachingSectionCurriculumPosition } from "./curriculum-bindings";

function clientFor(database: PGlite): KnowledgeSqlClient {
  return { async query<Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) { const result = await database.query(statement, parameters); return { rows: result.rows as Row[] }; }, async close() { await database.close(); } };
}

describe("teaching-section curriculum position history", () => {
  it("enforces append-only corrections and resolves the terminal event", async () => {
    const database = new PGlite();
    const client = clientFor(database);
    const schoolId = "00000000-0000-0000-0000-000000000201";
    const sectionId = "00000000-0000-0000-0000-000000000202";
    const actorId = "00000000-0000-0000-0000-000000000203";
    const subjectId = "00000000-0000-0000-0000-000000000204";
    const releaseId = "00000000-0000-0000-0000-000000000205";
    const profileId = "00000000-0000-0000-0000-000000000206";
    const otherProfileId = "00000000-0000-0000-0000-000000000207";
    const canonicalId = "TEST-POSITION-CANONICAL";
    const sourceId = "TEST-POSITION-SOURCE";
    const spanId = "TEST-POSITION-SOURCE:P1";
    try {
      await applyAcademicKnowledgeMigration(client);
      await client.query("insert into knowledge_sources(source_id,authority,title,document_type,education_level,subject,checksum_sha256,rights_status,production_use_status,processing_status,verification_status,source_path) values($1,'TEST','TEST POSITION SOURCE','TEST','lower-secondary','Biology',$2,'UNKNOWN','PERMISSION_PENDING','IMPORTED','UNVERIFIED','synthetic://position')", [sourceId, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]);
      await client.query("insert into knowledge_source_spans(span_id,source_id,page_start,page_end,locator,source_text,extraction_confidence,verification_status,content_sha256,extractor_version,schema_version) values($1,$2,1,1,'page:1','TEST POSITION WORDING','HIGH','UNVERIFIED',$3,'test','test')", [spanId, sourceId, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]);
      await client.query("insert into knowledge_records(canonical_id,source_id,span_id,record_type,education_level,subject,source_wording,normalized,extracted,verification_status,content_sha256,payload_schema_version) values($1,$2,$3,'topic','lower-secondary','Biology','TEST POSITION WORDING','{}','{}','UNVERIFIED',$4,'test')", [canonicalId, sourceId, spanId, "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"]);
      await client.query("insert into knowledge_curriculum_subjects(id,subject_key,title,education_level,status) values($1,'TEST-POSITION-SUBJECT','TEST POSITION SUBJECT','lower-secondary','DRAFT')", [subjectId]);
      await client.query("insert into knowledge_curriculum_releases(id,release_key,authority,display_name,education_level,version_label,effective_from,status,manifest_checksum_sha256) values($1,'TEST-POSITION-RELEASE','TEST','TEST POSITION RELEASE','lower-secondary','test','2026-01-01','DRAFT',$2)", [releaseId, "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"]);
      await client.query("insert into knowledge_subject_profiles(id,release_id,governed_subject_id,profile_key,display_title,education_level,status) values($1,$2,$3,'TEST-POSITION-PROFILE','TEST POSITION PROFILE','lower-secondary','DRAFT'),($4,$2,$3,'TEST-POSITION-OTHER-PROFILE','TEST POSITION OTHER PROFILE','lower-secondary','DRAFT')", [profileId, releaseId, subjectId, otherProfileId]);
      await client.query("insert into knowledge_profile_records(release_id,subject_profile_id,canonical_id,membership_role,status,ordering_key,effective_from,approved_at,approved_by,runtime_status) values($1,$2,$3,'CURRICULUM','APPROVED','001','2026-01-01',now(),$4,'PILOT_ACTIVE')", [releaseId, profileId, canonicalId, actorId]);

      const initialId = await recordTeachingSectionCurriculumPosition(client, schoolId, { teachingSectionId: sectionId, subjectProfileId: profileId, canonicalId, positionKind: "TOPIC", confirmedBy: actorId, confirmedAt: "2026-01-01T09:00:00Z" });
      await expect(client.query("update teaching_section_curriculum_position_events set correction_reason='illegal mutation' where id=$1", [initialId])).rejects.toThrow();
      await expect(client.query("delete from teaching_section_curriculum_position_events where id=$1", [initialId])).rejects.toThrow();
      await expect(recordTeachingSectionCurriculumPosition(client, schoolId, { teachingSectionId: sectionId, subjectProfileId: profileId, canonicalId, positionKind: "TOPIC", confirmedBy: actorId, confirmedAt: "2026-01-02T09:00:00Z", supersedesEventId: initialId })).rejects.toThrow();
      const correctionId = await recordTeachingSectionCurriculumPosition(client, schoolId, { teachingSectionId: sectionId, subjectProfileId: profileId, canonicalId, positionKind: "LEARNING_OUTCOME", confirmedBy: actorId, confirmedAt: "2026-01-02T09:00:00Z", supersedesEventId: initialId, correctionReason: "Teacher corrected the selected curriculum position." });
      await expect(recordTeachingSectionCurriculumPosition(client, schoolId, { teachingSectionId: sectionId, subjectProfileId: profileId, canonicalId, positionKind: "TOPIC", confirmedBy: actorId, supersedesEventId: initialId, correctionReason: "Second successor is not allowed." })).rejects.toThrow();
      await expect(recordTeachingSectionCurriculumPosition(client, schoolId, { teachingSectionId: sectionId, subjectProfileId: profileId, canonicalId, positionKind: "TOPIC", confirmedBy: actorId, confirmedAt: "2026-01-03T09:00:00Z", supersedesEventId: correctionId, correctionReason: "Follow-up correction." })).resolves.toBeTruthy();
      await expect(client.query("insert into teaching_section_curriculum_position_events(id,school_id,teaching_section_id,subject_profile_id,canonical_id,position_kind,confirmed_by,supersedes_event_id,correction_reason) values($1,$2,$3,$4,$5,'TOPIC',$6,$1,'self')", ["00000000-0000-0000-0000-000000000208", schoolId, sectionId, profileId, canonicalId, actorId])).rejects.toThrow();
      await expect(recordTeachingSectionCurriculumPosition(client, schoolId, { teachingSectionId: sectionId, subjectProfileId: otherProfileId, canonicalId, positionKind: "TOPIC", confirmedBy: actorId, supersedesEventId: initialId, correctionReason: "Wrong profile." })).rejects.toThrow();
      await expect(recordTeachingSectionCurriculumPosition(client, schoolId, { teachingSectionId: sectionId, subjectProfileId: profileId, canonicalId, positionKind: "TOPIC", confirmedBy: actorId, correctionReason: "Initial event cannot be a correction." })).rejects.toThrow();

      const current = await getCurrentTeachingSectionCurriculumPosition(client, schoolId, sectionId, "2026-01-03");
      expect(current).toMatchObject({ id: expect.any(String), supersedes_event_id: correctionId });
    } finally {
      await client.close();
    }
  }, 60_000);
});
