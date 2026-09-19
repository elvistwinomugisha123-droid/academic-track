import "server-only";
import { randomUUID } from "node:crypto";
import type { KnowledgeSqlClient } from "./db/client";
import { sha256CanonicalTextFile } from "./artifact-checksum";
import { sha256Canonical } from "./canonical-json";
import { activateKnowledgeReleaseForControlledPilot, recordKnowledgeVerificationDecision, submitKnowledgeReleaseForReview } from "./governance";
import { importAcademicKnowledge } from "./importer";
import { prepareRealBiologyCorpus } from "./real-corpus-adapter";

const EXPECTED_BIOLOGY_SOURCE_CHECKSUMS = {
  "ncdc-biology-2019": "5b6bf4e8aa9d255be59148ac585a169baa5469186d96f9731428e263dd9c1b1c",
  "ncdc-framework-2019": "75578bece361085dab500e2e7d6c2e1dd581c23bfb9bd8796be27351a77e253c",
} as const;
const EXPECTED_VALIDATION_REPORT_SHA256 = "0cf803db5c68727041173c304b4f17b2ac2619b65f818574be3e346ad0a83331";
const EXPECTED_REVIEW_QUEUE_SHA256 = "7ff2589a821ba3d6b70c3826ab2a01e078dca6e4f1ab5a30d42a5c165835acce";
const EXPECTED_CLEAN_SUBSET_DATASET_SHA256 = "e17a4b515a0998dee5a0b859c1ed698b105a26ac4b2512de2cb908a132897c41";
const EXPECTED_EXCLUSION_REPORT_SHA256 = "40c2922cee6df1c35d169142a12072043d65b94e4f5599f6019ee00741415092";

function sameMembers(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

type LatestVerificationDecision = { entity_id: string; resulting_status: string; evidence_reference: string | null; source_version_context: string | null };

async function latestVerificationDecisions(client: KnowledgeSqlClient, entityType: string, entityIds: string[]): Promise<Map<string, LatestVerificationDecision>> {
  if (!entityIds.length) return new Map();
  const result = await client.query<LatestVerificationDecision>(`select distinct on (entity_id) entity_id, resulting_status, evidence_reference, source_version_context from knowledge_verification_decisions where entity_type=$1 and entity_id = any($2::text[]) order by entity_id, decided_at desc, decision_id desc`, [entityType, entityIds]);
  return new Map(result.rows.map((row) => [row.entity_id, row]));
}

function decisionAlreadyMatches(latest: LatestVerificationDecision | undefined, evidenceReference: string, sourceVersionContext?: string): boolean {
  return latest?.resulting_status === "VERIFIED" && latest.evidence_reference === evidenceReference && (sourceVersionContext === undefined || latest.source_version_context === sourceVersionContext);
}

function assertDecisionIsCurrentOrMissing(latest: LatestVerificationDecision | undefined, entityType: string, entityId: string, evidenceReference: string, sourceVersionContext?: string): boolean {
  if (!latest) return false;
  if (decisionAlreadyMatches(latest, evidenceReference, sourceVersionContext)) return true;
  throw new Error(`Stale or contrary ${entityType} verification decision for ${entityId}; committed clean-subset evidence no longer matches.`);
}

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
  const records = await client.query<{ canonical_id: string; source_id: string; authority_eligible: boolean }>(`select r.canonical_id,r.source_id,coalesce(rt.authority_eligible,false) as authority_eligible from knowledge_records r join knowledge_record_identity_mappings m on m.canonical_id=r.canonical_id left join knowledge_record_taxonomy rt on rt.record_type=r.record_type where r.source_id in ('ncdc-framework-2019','ncdc-biology-2019')`);
  for (const record of records.rows) {
    const membershipRole = record.source_id === "ncdc-biology-2019" && record.authority_eligible ? "CURRICULUM" : "SUPPORTING";
    await client.query(`insert into knowledge_profile_records(release_id,subject_profile_id,canonical_id,membership_role,ordering_key,status,effective_from,effective_to,approved_at,approved_by) values($1,$2,$3,$4,$3,'APPROVED','2019-01-01','2019-12-31',now(),$5)`, [releaseId, profileId, record.canonical_id, membershipRole, actorUserId]);
  }
  await submitKnowledgeReleaseForReview(client, releaseId);
  await reconcileHistoricalBiologyPilotMemberships(client, profileId);
  return { releaseId, subjectId, profileId };
}

export async function reconcileHistoricalBiologyPilotMemberships(client: KnowledgeSqlClient, profileId: string): Promise<number> {
  const profile = await client.query<{ release_status: string }>(`select r.status as release_status from knowledge_subject_profiles p join knowledge_curriculum_releases r on r.id=p.release_id where p.id=$1`, [profileId]);
  if (!profile.rows[0]) throw new Error("Biology pilot profile not found.");
  if (profile.rows[0].release_status === "ACTIVE") throw new Error("An ACTIVE historical Biology pilot cannot be reclassified in place.");
  const result = await client.query<{ count: string }>(`update knowledge_profile_records pr set membership_role='SUPPORTING' from knowledge_records r left join knowledge_record_taxonomy rt on rt.record_type=r.record_type where pr.subject_profile_id=$1 and pr.canonical_id=r.canonical_id and coalesce(rt.authority_eligible,false)=false and pr.membership_role <> 'SUPPORTING' returning pr.id`, [profileId]);
  return result.rows.length;
}

export async function verifyRealBiologyCleanSubset(client: KnowledgeSqlClient, profileId: string, actorUserId: string) {
  const prepared = await prepareRealBiologyCorpus();
  try {
    const validationReportSha256 = await sha256CanonicalTextFile("curriculum-data/08_validation_report.md");
    const reviewQueueSha256 = await sha256CanonicalTextFile("curriculum-data/09_human_review_queue.json");
    const report = prepared.report;
    if (validationReportSha256 !== EXPECTED_VALIDATION_REPORT_SHA256 || reviewQueueSha256 !== EXPECTED_REVIEW_QUEUE_SHA256) throw new Error("Committed curriculum validation artifacts changed; clean-subset verification is blocked.");
    if (JSON.stringify(report.sourceChecksums) !== JSON.stringify(EXPECTED_BIOLOGY_SOURCE_CHECKSUMS)) throw new Error("Real Biology source checksums do not match the committed verification contract.");
    if (report.reviewItems !== 26 || report.unresolvedReviewItems.length !== 26) throw new Error("The expected 26 open review items are not present; clean-subset verification is blocked.");
    const exclusionReportSha256 = sha256Canonical({ excludedRecordIds: [...report.excludedRecordIds].sort(), excludedRelationshipIds: [...report.excludedRelationshipIds].sort(), unresolvedReviewItems: report.unresolvedReviewItems });
    if (report.datasetChecksumSha256 !== EXPECTED_CLEAN_SUBSET_DATASET_SHA256 || exclusionReportSha256 !== EXPECTED_EXCLUSION_REPORT_SHA256) throw new Error("The real-corpus clean subset or adapter exclusion report changed; verification is blocked.");
    if (new Set([...report.includedRecordIds, ...report.excludedRecordIds]).size !== report.includedRecordIds.length + report.excludedRecordIds.length || report.includedRecordIds.some((id) => report.excludedRecordIds.includes(id)) || report.includedRelationshipIds.some((id) => report.excludedRelationshipIds.includes(id))) throw new Error("The adapter clean subset contains overlapping included and excluded evidence.");

    const evidenceReference = JSON.stringify({ validationReportSha256, reviewQueueSha256, sourceChecksums: EXPECTED_BIOLOGY_SOURCE_CHECKSUMS, cleanSubsetDatasetSha256: report.datasetChecksumSha256, exclusionReportSha256, openReviewItems: 26 });
    const profileRecords = await client.query<{ candidate_id: string; canonical_id: string; source_id: string; checksum_sha256: string }>(`select m.candidate_id, r.canonical_id, r.source_id, s.checksum_sha256 from knowledge_profile_records pr join knowledge_records r on r.canonical_id=pr.canonical_id join knowledge_record_identity_mappings m on m.canonical_id=r.canonical_id and m.source_id=r.source_id join knowledge_sources s on s.source_id=r.source_id where pr.subject_profile_id=$1 and pr.status='APPROVED' order by m.candidate_id`, [profileId]);
    const candidateIds = profileRecords.rows.map((row) => row.candidate_id);
    if (!sameMembers(candidateIds, report.includedRecordIds) || profileRecords.rows.some((row) => !(row.source_id in EXPECTED_BIOLOGY_SOURCE_CHECKSUMS) || row.checksum_sha256 !== EXPECTED_BIOLOGY_SOURCE_CHECKSUMS[row.source_id as keyof typeof EXPECTED_BIOLOGY_SOURCE_CHECKSUMS])) throw new Error("The governed Biology profile is not an exact membership of the clean adapter subset.");
    if (profileRecords.rows.some((row) => report.excludedRecordIds.includes(row.candidate_id))) throw new Error("A review-dependent Biology record is present in the governed profile.");
    const relationships = await client.query<{ relationship_id: string }>(`select distinct rel.relationship_id from knowledge_relationships rel join knowledge_profile_records pr on pr.subject_profile_id=$1 and (pr.canonical_id=rel.from_canonical_id or pr.canonical_id=rel.to_canonical_id) order by rel.relationship_id`, [profileId]);
    const relationshipIds = relationships.rows.map((row) => row.relationship_id);
    if (!sameMembers(relationshipIds, report.includedRelationshipIds) || relationshipIds.some((id) => report.excludedRelationshipIds.includes(id))) throw new Error("The governed Biology profile contains a relationship outside the clean adapter subset.");

    const sources = await client.query<{ source_id: string }>(`select distinct r.source_id from knowledge_records r join knowledge_profile_records pr on pr.canonical_id=r.canonical_id where pr.subject_profile_id=$1 order by r.source_id`, [profileId]);
    const sourceDecisions = await latestVerificationDecisions(client, "SOURCE", sources.rows.map((source) => source.source_id));
    for (const source of sources.rows) {
      const sourceVersionContext = EXPECTED_BIOLOGY_SOURCE_CHECKSUMS[source.source_id as keyof typeof EXPECTED_BIOLOGY_SOURCE_CHECKSUMS];
      if (!assertDecisionIsCurrentOrMissing(sourceDecisions.get(source.source_id), "SOURCE", source.source_id, evidenceReference, sourceVersionContext)) await recordKnowledgeVerificationDecision(client, { entityType: "SOURCE", entityId: source.source_id, resultingStatus: "VERIFIED", actorUserId, reason: "Committed clean-subset validation report, source checksums, adapter exclusion report, and open review queue matched exactly.", evidenceReference, sourceVersionContext });
    }
    const spans = await client.query<{ span_id: string }>(`select distinct span_id from (select r.span_id from knowledge_records r join knowledge_profile_records pr on pr.canonical_id=r.canonical_id where pr.subject_profile_id=$1 union select rel.span_id from knowledge_relationships rel where rel.relationship_id = any($2::text[])) selected order by span_id`, [profileId, report.includedRelationshipIds]);
    const spanDecisions = await latestVerificationDecisions(client, "SPAN", spans.rows.map((span) => span.span_id));
    for (const span of spans.rows) if (!assertDecisionIsCurrentOrMissing(spanDecisions.get(span.span_id), "SPAN", span.span_id, evidenceReference)) await recordKnowledgeVerificationDecision(client, { entityType: "SPAN", entityId: span.span_id, resultingStatus: "VERIFIED", actorUserId, reason: "Committed clean-subset validation report and exact source-span comparison matched the adapter output.", evidenceReference });
    const recordDecisions = await latestVerificationDecisions(client, "RECORD", profileRecords.rows.map((record) => record.canonical_id));
    for (const record of profileRecords.rows) if (!assertDecisionIsCurrentOrMissing(recordDecisions.get(record.canonical_id), "RECORD", record.canonical_id, evidenceReference, record.checksum_sha256)) await recordKnowledgeVerificationDecision(client, { entityType: "RECORD", entityId: record.canonical_id, resultingStatus: "VERIFIED", actorUserId, reason: "Normalized record matches the committed source wording and explicit hierarchy with no open review dependency.", evidenceReference, sourceVersionContext: record.checksum_sha256 });
    const relationshipDecisions = await latestVerificationDecisions(client, "RELATIONSHIP", relationships.rows.map((relationship) => relationship.relationship_id));
    for (const relationship of relationships.rows) if (!assertDecisionIsCurrentOrMissing(relationshipDecisions.get(relationship.relationship_id), "RELATIONSHIP", relationship.relationship_id, evidenceReference)) await recordKnowledgeVerificationDecision(client, { entityType: "RELATIONSHIP", entityId: relationship.relationship_id, resultingStatus: "VERIFIED", actorUserId, reason: "Relationship endpoints and cited source span are included in the committed clean adapter subset.", evidenceReference });
    return { sources: sources.rows.length, spans: spans.rows.length, records: profileRecords.rows.length, relationships: relationships.rows.length, evidenceReference };
  } finally {
    await prepared.cleanup();
  }
}

export async function activateRealBiologyPilot(client: KnowledgeSqlClient, profileId: string, actorUserId: string) {
  const profile = await client.query<{ release_id: string }>(`select release_id from knowledge_subject_profiles where id=$1`, [profileId]);
  if (!profile.rows[0]) throw new Error("Biology pilot profile not found.");
  const releaseReport = await activateKnowledgeReleaseForControlledPilot(client, profile.rows[0].release_id, actorUserId);
  if (!releaseReport.activated) return releaseReport;
  await client.query(`select public.activate_knowledge_profile_pilot($1,$2,$3)`, [profileId, actorUserId, "Controlled historical 2019 reference pilot; academic runtime only; rights remain independently governed."]);
  return releaseReport;
}
