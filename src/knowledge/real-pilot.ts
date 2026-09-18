import "server-only";
import { randomUUID } from "node:crypto";
import type { KnowledgeSqlClient } from "./db/client";
import { activateKnowledgeReleaseForControlledPilot, recordKnowledgeVerificationDecision, submitKnowledgeReleaseForReview } from "./governance";
import { importAcademicKnowledge } from "./importer";
import { prepareRealBiologyCorpus } from "./real-corpus-adapter";

export async function importRealBiologyCandidates(client: KnowledgeSqlClient) {
  const prepared = await prepareRealBiologyCorpus();
  try { return { report: await importAcademicKnowledge(client, "DEVELOPMENT", prepared.paths), corpus: prepared.report }; } finally { await prepared.cleanup(); }
}

export async function createHistoricalBiologyPilot(client: KnowledgeSqlClient, actorUserId: string, datasetChecksumSha256: string) {
  if (!actorUserId) throw new Error("A designated governance actor is required.");
  const releaseId = randomUUID(); const subjectId = randomUUID(); const profileId = randomUUID();
  await client.query(`insert into knowledge_curriculum_subjects(id,subject_key,title,education_level,programme_track,status) values($1,'UG-LSC-BIOLOGY-2019-REFERENCE','Biology — Lower Secondary (2019 reference pilot)','lower-secondary','Lower Secondary','DRAFT')`, [subjectId]);
  await client.query(`insert into knowledge_curriculum_releases(id,release_key,authority,display_name,education_level,version_label,effective_from,effective_to,status,manifest_checksum_sha256,created_by) values($1,'UG-LSC-2019-REFERENCE-PILOT','National Curriculum Development Centre (source-labelled; not independently currentness-verified)','Lower Secondary Biology/framework — historical 2019 reference pilot','lower-secondary','2019 historical reference pilot','2019-01-01','2019-12-31','DRAFT',$2,$3)`, [releaseId, datasetChecksumSha256, actorUserId]);
  await client.query(`insert into knowledge_subject_profiles(id,release_id,governed_subject_id,profile_key,display_title,education_level,programme_track,status,display_order,requires_assessment_profile) values($1,$2,$3,'UG-LSC-BIOLOGY-2019-REFERENCE','Biology — Lower Secondary (2019 reference pilot) — not currentness or endorsement claim','lower-secondary','Lower Secondary','DRAFT',1,false)`, [profileId, releaseId, subjectId]);
  await client.query(`insert into knowledge_release_sources(release_id,subject_profile_id,source_id,source_role,is_required,precedence_order,status,approved_at,approved_by) values($1,null,'ncdc-framework-2019','FRAMEWORK',true,10,'APPROVED',now(),$2),($1,$3,'ncdc-biology-2019','SUBJECT_SYLLABUS',true,20,'APPROVED',now(),$2)`, [releaseId, actorUserId, profileId]);
  const records = await client.query<{ canonical_id: string; source_id: string }>(`select r.canonical_id,r.source_id from knowledge_records r join knowledge_record_identity_mappings m on m.canonical_id=r.canonical_id where r.source_id in ('ncdc-framework-2019','ncdc-biology-2019')`);
  for (const record of records.rows) await client.query(`insert into knowledge_profile_records(release_id,subject_profile_id,canonical_id,membership_role,ordering_key,status,effective_from,effective_to,approved_at,approved_by) values($1,$2,$3,$4,$3,'APPROVED','2019-01-01','2019-12-31',now(),$5)`, [releaseId, profileId, record.canonical_id, record.source_id === "ncdc-biology-2019" ? "CURRICULUM" : "SUPPORTING", actorUserId]);
  await submitKnowledgeReleaseForReview(client, releaseId);
  return { releaseId, subjectId, profileId };
}

export async function verifyRealBiologyCleanSubset(client: KnowledgeSqlClient, profileId: string, actorUserId: string, evidenceReference: string) {
  if (!evidenceReference.trim()) throw new Error("Exact comparison evidence is required before academic verification.");
  const sources = await client.query<{ source_id: string }>(`select distinct r.source_id from knowledge_profile_records pr join knowledge_records r on r.canonical_id=pr.canonical_id where pr.subject_profile_id=$1`, [profileId]);
  for (const source of sources.rows) await recordKnowledgeVerificationDecision(client, { entityType: "SOURCE", entityId: source.source_id, resultingStatus: "VERIFIED", actorUserId, reason: "Controlled source-to-extraction comparison completed for the clean 2019 reference subset.", evidenceReference });
  const spans = await client.query<{ span_id: string }>(`select distinct sp.span_id from knowledge_profile_records pr join knowledge_records r on r.canonical_id=pr.canonical_id join knowledge_source_spans sp on sp.span_id=r.span_id and sp.source_id=r.source_id where pr.subject_profile_id=$1`, [profileId]);
  for (const span of spans.rows) await recordKnowledgeVerificationDecision(client, { entityType: "SPAN", entityId: span.span_id, resultingStatus: "VERIFIED", actorUserId, reason: "Controlled exact source-span comparison completed for the clean subset.", evidenceReference });
  const records = await client.query<{ canonical_id: string }>(`select canonical_id from knowledge_profile_records where subject_profile_id=$1 and status='APPROVED'`, [profileId]);
  for (const record of records.rows) await recordKnowledgeVerificationDecision(client, { entityType: "RECORD", entityId: record.canonical_id, resultingStatus: "VERIFIED", actorUserId, reason: "Normalized record matches the cited source wording and explicit hierarchy; no open review dependency.", evidenceReference });
  const relationships = await client.query<{ relationship_id: string }>(`select distinct rel.relationship_id from knowledge_relationships rel join knowledge_records r on (r.canonical_id=rel.from_canonical_id or r.canonical_id=rel.to_canonical_id) join knowledge_profile_records pr on pr.canonical_id=r.canonical_id where pr.subject_profile_id=$1`, [profileId]);
  for (const relationship of relationships.rows) await recordKnowledgeVerificationDecision(client, { entityType: "RELATIONSHIP", entityId: relationship.relationship_id, resultingStatus: "VERIFIED", actorUserId, reason: "Relationship endpoints and cited source span were compared in the clean subset.", evidenceReference });
  return { sources: sources.rows.length, spans: spans.rows.length, records: records.rows.length, relationships: relationships.rows.length };
}

export async function activateRealBiologyPilot(client: KnowledgeSqlClient, profileId: string, actorUserId: string) {
  const profile = await client.query<{ release_id: string }>(`select release_id from knowledge_subject_profiles where id=$1`, [profileId]);
  if (!profile.rows[0]) throw new Error("Biology pilot profile not found.");
  const releaseReport = await activateKnowledgeReleaseForControlledPilot(client, profile.rows[0].release_id, actorUserId);
  if (!releaseReport.activated) return releaseReport;
  await client.query(`select public.activate_knowledge_profile_pilot($1,$2,$3)`, [profileId, actorUserId, "Controlled historical 2019 reference pilot; academic runtime only; rights remain independently governed."]);
  return releaseReport;
}
