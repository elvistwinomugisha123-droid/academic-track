import "server-only";
import type { KnowledgeSqlClient } from "./db/client";
import { withKnowledgeTransaction } from "./db/transaction";
import type { KnowledgeEntityType, KnowledgeReleaseStatus, VerificationStatus } from "./types";

export type ActivationIssue = { code: string; entityType: string; entityId: string | null; message: string };
export type ActivationReport = { releaseId: string; status: "ACTIVE" | "BLOCKED"; activated: boolean; checkedAt: string; issues: ActivationIssue[] };

async function command<T>(client: KnowledgeSqlClient, name: string, work: () => Promise<T>): Promise<T> {
  await client.query("SELECT set_config('ate.knowledge_governance_command', $1, false)", [name]);
  try { return await work(); } finally { await client.query("SELECT set_config('ate.knowledge_governance_command', '', false)"); }
}

export async function recordKnowledgeVerificationDecision(client: KnowledgeSqlClient, input: { entityType: KnowledgeEntityType; entityId: string; resultingStatus: VerificationStatus; actorUserId: string; reason: string; evidenceReference?: string; sourceVersionContext?: string }): Promise<string> {
  const result = await client.query<{ decision_id: string }>("SELECT public.record_knowledge_verification_decision($1,$2,$3,$4,$5,$6,$7) AS decision_id", [input.entityType, input.entityId, input.resultingStatus, input.actorUserId, input.reason, input.evidenceReference ?? null, input.sourceVersionContext ?? null]);
  return result.rows[0].decision_id;
}

export async function recordKnowledgeRightsDecision(client: KnowledgeSqlClient, input: { sourceId: string; rightsStatus: "CLEARED" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN"; productionUseStatus: "PERMITTED" | "PERMISSION_PENDING" | "BLOCKED"; externalAiAllowed: boolean; formalArtifactAllowed: boolean; exportAllowed: boolean; attributionRequired: boolean; decisionSource: string; actorUserId: string; evidenceReference?: string; reviewExpiresAt?: string; notes?: string }): Promise<string> {
  const result = await client.query<{ decision_id: string }>("SELECT public.record_knowledge_rights_decision($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS decision_id", [input.sourceId, input.rightsStatus, input.productionUseStatus, input.externalAiAllowed, input.formalArtifactAllowed, input.exportAllowed, input.attributionRequired, input.decisionSource, input.actorUserId, input.evidenceReference ?? null, input.reviewExpiresAt ?? null, input.notes ?? null]);
  return result.rows[0].decision_id;
}

export async function submitKnowledgeReleaseForReview(client: KnowledgeSqlClient, releaseId: string): Promise<void> {
  await command(client, "SUBMIT_RELEASE_REVIEW", async () => { await client.query("UPDATE knowledge_curriculum_releases SET status='REVIEW' WHERE id=$1 AND status='DRAFT'", [releaseId]); });
}

export async function supersedeKnowledgeRelease(client: KnowledgeSqlClient, releaseId: string): Promise<void> {
  await command(client, "SUPERSEDE_RELEASE", async () => { await client.query("UPDATE knowledge_curriculum_releases SET status='SUPERSEDED' WHERE id=$1 AND status='ACTIVE'", [releaseId]); });
}

export async function retireKnowledgeRelease(client: KnowledgeSqlClient, releaseId: string): Promise<void> {
  await command(client, "RETIRE_RELEASE", async () => { await client.query("UPDATE knowledge_curriculum_releases SET status='RETIRED' WHERE id=$1 AND status IN ('DRAFT','REVIEW','SUPERSEDED')", [releaseId]); });
}

type ReleaseRow = { id: string; education_level: string; status: KnowledgeReleaseStatus; effective_from: string; effective_to: string | null };

export async function activateKnowledgeRelease(client: KnowledgeSqlClient, releaseId: string, actorUserId: string): Promise<ActivationReport> {
  return withKnowledgeTransaction(client, async () => {
    const checkedAt = new Date().toISOString();
    const issues: ActivationIssue[] = [];
    const releaseResult = await client.query<ReleaseRow>("SELECT id, education_level, status, effective_from, effective_to FROM knowledge_curriculum_releases WHERE id=$1 FOR UPDATE", [releaseId]);
    const release = releaseResult.rows[0];
    if (!release) return { releaseId, status: "BLOCKED", activated: false, checkedAt, issues: [{ code: "NOT_FOUND", entityType: "RELEASE", entityId: releaseId, message: "Curriculum release does not exist." }] };
    if (release.status === "SUPERSEDED" || release.status === "RETIRED") issues.push({ code: "RELEASE_SUPERSEDED", entityType: "RELEASE", entityId: releaseId, message: "Only draft/review releases may be activated." });
    const overlapping = await client.query<{ id: string }>("SELECT id FROM knowledge_curriculum_releases WHERE id<>$1 AND status='ACTIVE' AND education_level=$2 AND effective_from <= coalesce($4::date, '9999-12-31') AND coalesce(effective_to, '9999-12-31') >= $3::date", [releaseId, release.education_level, release.effective_from, release.effective_to]);
    if (overlapping.rows.length) issues.push({ code: "EFFECTIVE_DATE_OVERLAP", entityType: "RELEASE", entityId: releaseId, message: "An active release overlaps the effective period for this education regime." });

    const profiles = await client.query<{ id: string; governed_subject_id: string; education_level: string; status: string; requires_assessment_profile: boolean }>("SELECT id, governed_subject_id, education_level, status, requires_assessment_profile FROM knowledge_subject_profiles WHERE release_id=$1 ORDER BY display_order, id", [releaseId]);
    if (!profiles.rows.length) issues.push({ code: "PROFILE_MISSING", entityType: "RELEASE", entityId: releaseId, message: "A release must contain at least one subject profile." });
    for (const profile of profiles.rows) {
      if (profile.education_level !== release.education_level && release.education_level !== "cross-level") issues.push({ code: "PROFILE_MISMATCH", entityType: "SUBJECT_PROFILE", entityId: profile.id, message: "Subject profile education level does not match its release." });
      const subject = await client.query<{ education_level: string; status: string }>("SELECT education_level, status FROM knowledge_curriculum_subjects WHERE id=$1", [profile.governed_subject_id]);
      if (!subject.rows[0]) issues.push({ code: "SUBJECT_PROFILE_MISMATCH", entityType: "SUBJECT", entityId: profile.governed_subject_id, message: "Subject profile has no governed central subject." });
      else if (subject.rows[0].education_level !== profile.education_level && subject.rows[0].education_level !== "cross-level") issues.push({ code: "SUBJECT_PROFILE_MISMATCH", entityType: "SUBJECT", entityId: profile.governed_subject_id, message: "Subject and profile education levels are incompatible." });

      const sources = await client.query<{ source_id: string; is_required: boolean; status: string; rights_status: string; production_use_status: string; verification_status: string; checksum_sha256: string }>("SELECT rs.source_id, rs.is_required, rs.status, s.rights_status, s.production_use_status, s.verification_status, s.checksum_sha256 FROM knowledge_release_sources rs LEFT JOIN knowledge_sources s ON s.source_id=rs.source_id WHERE rs.release_id=$1 AND (rs.subject_profile_id IS NULL OR rs.subject_profile_id=$2)", [releaseId, profile.id]);
      if (!sources.rows.some((source) => source.is_required)) issues.push({ code: "REQUIRED_SOURCE_MISSING", entityType: "SUBJECT_PROFILE", entityId: profile.id, message: "No required approved source is present for the subject profile." });
      for (const source of sources.rows) {
        if (source.is_required && (source.status !== "APPROVED" || !source.checksum_sha256)) issues.push({ code: "SOURCE_INACTIVE", entityType: "SOURCE", entityId: source.source_id, message: "Required source is not approved or has no checksum identity." });
        if (source.is_required && (source.rights_status !== "CLEARED" || source.production_use_status !== "PERMITTED")) issues.push({ code: "RIGHTS_DENIED", entityType: "SOURCE", entityId: source.source_id, message: "Required source is not rights-cleared for production." });
        if (source.is_required && source.verification_status !== "VERIFIED") issues.push({ code: "NOT_VERIFIED", entityType: "SOURCE", entityId: source.source_id, message: "Required source is not verified." });
      }
      const records = await client.query<{ canonical_id: string; status: string; record_verification_status: string; span_verification_status: string; source_id: string; span_source_id: string; authority_eligible: boolean }>("SELECT pr.canonical_id, pr.status, r.verification_status AS record_verification_status, sp.verification_status AS span_verification_status, r.source_id, sp.source_id AS span_source_id, coalesce(rt.authority_eligible,false) AS authority_eligible FROM knowledge_profile_records pr JOIN knowledge_records r ON r.canonical_id=pr.canonical_id JOIN knowledge_source_spans sp ON sp.span_id=r.span_id LEFT JOIN knowledge_record_taxonomy rt ON rt.record_type=r.record_type WHERE pr.release_id=$1 AND pr.subject_profile_id=$2", [releaseId, profile.id]);
      if (!records.rows.length) issues.push({ code: "PROFILE_RECORDS_MISSING", entityType: "SUBJECT_PROFILE", entityId: profile.id, message: "Subject profile has no governed record membership." });
      for (const record of records.rows) {
        if (record.status !== "APPROVED" || record.record_verification_status !== "VERIFIED" || record.span_verification_status !== "VERIFIED" || !record.authority_eligible) issues.push({ code: "NOT_VERIFIED", entityType: "RECORD", entityId: record.canonical_id, message: "Every authoritative profile record requires approved membership, verified record/span, and an authority-eligible taxonomy." });
        if (record.source_id !== record.span_source_id) issues.push({ code: "PROVENANCE_BROKEN", entityType: "RECORD", entityId: record.canonical_id, message: "Record source and span source do not match." });
        const relationshipGaps = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM knowledge_relationships rel LEFT JOIN knowledge_records rf ON rf.canonical_id=rel.from_canonical_id LEFT JOIN knowledge_records rt2 ON rt2.canonical_id=rel.to_canonical_id LEFT JOIN knowledge_source_spans rsp ON rsp.span_id=rel.span_id WHERE (rel.verification_status <> 'VERIFIED' OR rf.canonical_id IS NULL OR rt2.canonical_id IS NULL OR rsp.source_id <> rel.source_id) AND (rel.from_canonical_id=$1 OR rel.to_canonical_id=$1)", [record.canonical_id]);
        if (Number(relationshipGaps.rows[0]?.count ?? 0) > 0) issues.push({ code: "PROVENANCE_BROKEN", entityType: "RELATIONSHIP", entityId: record.canonical_id, message: "A relationship required by the profile is unverified or has broken endpoints/provenance." });
      }
      const conflicts = await client.query<{ id: string }>("SELECT c.id FROM knowledge_conflicts c WHERE c.release_id=$1 AND c.status='OPEN' AND (c.subject_profile_id IS NULL OR c.subject_profile_id=$2)", [releaseId, profile.id]);
      for (const conflict of conflicts.rows) issues.push({ code: "CONFLICT_UNRESOLVED", entityType: "CONFLICT", entityId: conflict.id, message: "Open conflict blocks activation." });
      if (profile.requires_assessment_profile) {
        const assessment = await client.query<{ id: string }>("SELECT id FROM knowledge_assessment_profiles WHERE release_id=$1 AND (subject_profile_id IS NULL OR subject_profile_id=$2) AND status <> 'RETIRED' LIMIT 1", [releaseId, profile.id]);
        if (!assessment.rows.length) issues.push({ code: "ASSESSMENT_PROFILE_MISSING", entityType: "SUBJECT_PROFILE", entityId: profile.id, message: "This profile declares that an assessment profile is required." });
      }
    }
    if (issues.length) return { releaseId, status: "BLOCKED", activated: false, checkedAt, issues };
    await command(client, "ACTIVATE_RELEASE", async () => {
      await client.query("UPDATE knowledge_curriculum_releases SET status='ACTIVE', activated_at=now(), activated_by=$2 WHERE id=$1", [releaseId, actorUserId]);
      await client.query("UPDATE knowledge_subject_profiles SET status='ACTIVE' WHERE release_id=$1", [releaseId]);
      await client.query("UPDATE knowledge_curriculum_subjects s SET status='ACTIVE', updated_at=now() WHERE EXISTS (SELECT 1 FROM knowledge_subject_profiles p WHERE p.release_id=$1 AND p.governed_subject_id=s.id)", [releaseId]);
      await client.query("UPDATE knowledge_assessment_profiles SET status='ACTIVE' WHERE release_id=$1 AND status='DRAFT'", [releaseId]);
    });
    return { releaseId, status: "ACTIVE", activated: true, checkedAt, issues: [] };
  });
}
