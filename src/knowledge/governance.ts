import "server-only";
import type { KnowledgeSqlClient } from "./db/client";
import { withKnowledgeTransaction } from "./db/transaction";
import { sha256Canonical } from "./canonical-json";
import type { KnowledgeEntityType, KnowledgeReleaseStatus, VerificationStatus } from "./types";

export type ActivationIssue = { code: string; entityType: string; entityId: string | null; message: string };
export type ActivationReport = { releaseId: string; status: "ACTIVE" | "BLOCKED"; activated: boolean; checkedAt: string; issues: ActivationIssue[] };

async function command<T>(client: KnowledgeSqlClient, name: string, work: () => Promise<T>): Promise<T> {
  await client.query("SELECT set_config('ate.knowledge_governance_command', $1, false)", [name]);
  let workError: unknown;
  try { return await work(); } catch (error) { workError = error; throw error; } finally {
    try { await client.query("SELECT set_config('ate.knowledge_governance_command', '', false)"); } catch (resetError) { if (!workError) throw resetError; }
  }
}

export async function recordKnowledgeVerificationDecision(client: KnowledgeSqlClient, input: { entityType: KnowledgeEntityType; entityId: string; resultingStatus: VerificationStatus; actorUserId: string; reason: string; evidenceReference?: string; sourceVersionContext?: string }): Promise<string> {
  const result = await client.query<{ decision_id: string }>("SELECT public.record_knowledge_verification_decision($1,$2,$3,$4,$5,$6,$7) AS decision_id", [input.entityType, input.entityId, input.resultingStatus, input.actorUserId, input.reason, input.evidenceReference ?? null, input.sourceVersionContext ?? null]);
  return result.rows[0].decision_id;
}

export async function recordKnowledgeRightsDecision(client: KnowledgeSqlClient, input: { sourceId: string; rightsStatus: "CLEARED" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN"; productionUseStatus: "PERMITTED" | "PERMISSION_PENDING" | "BLOCKED"; externalAiAllowed: boolean; formalArtifactAllowed: boolean; exportAllowed: boolean; attributionRequired: boolean; decisionSource: string; actorUserId: string; evidenceReference?: string; reviewExpiresAt?: string; notes?: string }): Promise<string> {
  const result = await client.query<{ decision_id: string }>("SELECT public.record_knowledge_rights_decision($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS decision_id", [input.sourceId, input.rightsStatus, input.productionUseStatus, input.externalAiAllowed, input.formalArtifactAllowed, input.exportAllowed, input.attributionRequired, input.decisionSource, input.actorUserId, input.evidenceReference ?? null, input.reviewExpiresAt ?? null, input.notes ?? null]);
  return result.rows[0].decision_id;
}

export async function resolveKnowledgeConflict(client: KnowledgeSqlClient, input: { conflictId: string; status: "RESOLVED" | "ACCEPTED_OVERRIDE"; actorUserId: string; reason: string; resolutionText: string }): Promise<void> {
  await client.query("SELECT public.resolve_knowledge_conflict($1,$2,$3,$4,$5)", [input.conflictId, input.status, input.actorUserId, input.reason, input.resolutionText]);
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
type SourceRow = { source_id: string; source_role: string; subject_profile_id: string | null; is_required: boolean; status: string; authority: string | null; checksum_sha256: string | null; education_level: string | null; effective_from: string | null; effective_to: string | null; rights_status: string | null; production_use_status: string | null; verification_status: string | null; rights_decision_id: string | null; rights_decision_expiry: string | null; rights_decision_expired: boolean | null; rights_decision_matches: boolean | null; source_verification_evidence: boolean };

function sourceEffectiveWindowMismatch(source: SourceRow, release: ReleaseRow, mode: "PRODUCTION" | "CONTROLLED_PILOT"): boolean {
  const explicitOverlapConflict = (source.effective_from !== null && release.effective_to !== null && source.effective_from > release.effective_to)
    || (source.effective_to !== null && source.effective_to < release.effective_from);
  if (explicitOverlapConflict) return true;
  if (mode === "CONTROLLED_PILOT") return false;
  return source.effective_from === null || (release.effective_to !== null && source.effective_to === null)
    || (source.effective_from !== null && source.effective_from > release.effective_from)
    || (release.effective_to !== null && source.effective_to !== null && source.effective_to < release.effective_to);
}

async function recordActivationRun(client: KnowledgeSqlClient, report: ActivationReport, actorUserId: string): Promise<ActivationReport> {
  const serialized = JSON.stringify(report);
  await client.query("INSERT INTO knowledge_release_activation_runs (release_id,actor_user_id,checked_at,activated,report,report_sha256) VALUES ($1,$2,$3,$4,$5::jsonb,$6)", [report.releaseId, actorUserId, report.checkedAt, report.activated, serialized, sha256Canonical(report)]);
  return report;
}

function addIssue(issues: ActivationIssue[], code: string, entityType: string, entityId: string | null, message: string): void { issues.push({ code, entityType, entityId, message }); }

export async function activateKnowledgeRelease(client: KnowledgeSqlClient, releaseId: string, actorUserId: string, mode: "PRODUCTION" | "CONTROLLED_PILOT" = "PRODUCTION"): Promise<ActivationReport> {
  if (!actorUserId) throw new Error("Activation actor is required.");
  return withKnowledgeTransaction(client, async () => {
    const checkedAt = new Date().toISOString();
    const issues: ActivationIssue[] = [];
    const releaseResult = await client.query<ReleaseRow>("SELECT id, education_level, status, effective_from, effective_to FROM knowledge_curriculum_releases WHERE id=$1 FOR UPDATE", [releaseId]);
    const release = releaseResult.rows[0];
    if (!release) return { releaseId, status: "BLOCKED", activated: false, checkedAt, issues: [{ code: "NOT_FOUND", entityType: "RELEASE", entityId: releaseId, message: "Curriculum release does not exist." }] };
    if (release.status === "ACTIVE") addIssue(issues, "ALREADY_ACTIVE", "RELEASE", releaseId, "An ACTIVE release cannot be activated again or amended in place.");
    else if (release.status !== "REVIEW") addIssue(issues, "RELEASE_NOT_IN_REVIEW", "RELEASE", releaseId, "Only a REVIEW release may become ACTIVE; DRAFT must first pass through REVIEW.");
    const overlapping = await client.query<{ id: string }>("SELECT id FROM knowledge_curriculum_releases WHERE id<>$1 AND status='ACTIVE' AND education_level=$2 AND effective_from <= coalesce($4::date, '9999-12-31') AND coalesce(effective_to, '9999-12-31') >= $3::date", [releaseId, release.education_level, release.effective_from, release.effective_to]);
    if (overlapping.rows.length) addIssue(issues, "EFFECTIVE_DATE_OVERLAP", "RELEASE", releaseId, "An active release overlaps the effective period for this education regime.");

    const profiles = await client.query<{ id: string; governed_subject_id: string; education_level: string; status: string; requires_assessment_profile: boolean }>("SELECT id, governed_subject_id, education_level, status, requires_assessment_profile FROM knowledge_subject_profiles WHERE release_id=$1 ORDER BY display_order, id", [releaseId]);
    if (!profiles.rows.length) addIssue(issues, "PROFILE_MISSING", "RELEASE", releaseId, "A release must contain at least one subject profile.");
    for (const profile of profiles.rows) {
      if (profile.education_level !== release.education_level && release.education_level !== "cross-level") addIssue(issues, "PROFILE_MISMATCH", "SUBJECT_PROFILE", profile.id, "Subject profile education level does not match its release.");
      const subject = await client.query<{ education_level: string }>("SELECT education_level FROM knowledge_curriculum_subjects WHERE id=$1", [profile.governed_subject_id]);
      if (!subject.rows[0]) addIssue(issues, "SUBJECT_PROFILE_MISMATCH", "SUBJECT", profile.governed_subject_id, "Subject profile has no governed central subject.");
      else if (subject.rows[0].education_level !== profile.education_level && subject.rows[0].education_level !== "cross-level") addIssue(issues, "SUBJECT_PROFILE_MISMATCH", "SUBJECT", profile.governed_subject_id, "Subject and profile education levels are incompatible.");

      const sources = await client.query<SourceRow>("SELECT rs.source_id, rs.source_role, rs.subject_profile_id, rs.is_required, rs.status, s.authority, s.checksum_sha256, s.education_level, s.effective_from, s.effective_to, s.rights_status, s.production_use_status, s.verification_status, rights_decision.decision_id AS rights_decision_id, rights_decision.review_expires_at::text AS rights_decision_expiry, (rights_decision.review_expires_at < CURRENT_DATE) AS rights_decision_expired, (rights_decision.rights_status=s.rights_status AND rights_decision.production_use_status=s.production_use_status AND rights_decision.external_ai_allowed=s.external_ai_allowed AND rights_decision.formal_artifact_allowed=s.formal_artifact_allowed AND rights_decision.export_allowed=s.export_allowed AND rights_decision.attribution_required=s.attribution_required) AS rights_decision_matches, EXISTS (SELECT 1 FROM knowledge_verification_decisions d WHERE d.entity_type='SOURCE' AND d.entity_id=s.source_id AND d.resulting_status='VERIFIED' AND NOT EXISTS (SELECT 1 FROM knowledge_verification_decisions newer WHERE newer.entity_type=d.entity_type AND newer.entity_id=d.entity_id AND (newer.decided_at, newer.decision_id) > (d.decided_at, d.decision_id))) AS source_verification_evidence FROM knowledge_release_sources rs LEFT JOIN knowledge_sources s ON s.source_id=rs.source_id LEFT JOIN LATERAL (SELECT rd.decision_id, rd.rights_status, rd.production_use_status, rd.external_ai_allowed, rd.formal_artifact_allowed, rd.export_allowed, rd.attribution_required, rd.review_expires_at FROM knowledge_rights_decisions rd WHERE rd.source_id=rs.source_id AND rd.source_checksum_sha256=s.checksum_sha256 ORDER BY rd.decided_at DESC, rd.decision_id DESC LIMIT 1) rights_decision ON true WHERE rs.release_id=$1 AND (rs.subject_profile_id IS NULL OR rs.subject_profile_id=$2)", [releaseId, profile.id]);
      if (!sources.rows.some((source) => source.is_required && source.status === "APPROVED")) addIssue(issues, "REQUIRED_SOURCE_MISSING", "SUBJECT_PROFILE", profile.id, "No required approved source is present for the subject profile.");
      for (const source of sources.rows) {
        if (source.subject_profile_id !== null && source.education_level !== profile.education_level && source.education_level !== "cross-level") addIssue(issues, "PROFILE_SOURCE_MISMATCH", "SOURCE", source.source_id, "Profile-specific source education level does not match its subject profile.");
        if (source.subject_profile_id === null && source.source_role !== "SUPPORTING_REFERENCE" && source.education_level !== release.education_level && source.education_level !== "cross-level") addIssue(issues, "PROFILE_SOURCE_MISMATCH", "SOURCE", source.source_id, "Release-wide framework source is incompatible with the release education regime.");
        if (source.is_required && (source.status !== "APPROVED" || !source.checksum_sha256)) addIssue(issues, "SOURCE_INACTIVE", "SOURCE", source.source_id, "Required source is not approved or has no checksum identity.");
        if (mode === "PRODUCTION" && source.is_required && (source.rights_status !== "CLEARED" || source.production_use_status !== "PERMITTED" || !source.rights_decision_id || !source.rights_decision_matches || source.rights_decision_expired === true)) addIssue(issues, "RIGHTS_DENIED", "SOURCE", source.source_id, "Required source has no current matching unexpired rights decision today.");
        if (source.is_required && (source.verification_status !== "VERIFIED" || !source.source_verification_evidence)) addIssue(issues, "NOT_VERIFIED", "SOURCE", source.source_id, "Required source is not verified with current append-only decision evidence.");
        if (source.is_required && sourceEffectiveWindowMismatch(source, release, mode)) addIssue(issues, "EFFECTIVE_DATE_MISMATCH", "SOURCE", source.source_id, mode === "CONTROLLED_PILOT" ? "Source has explicit applicability dates conflicting with the bounded historical pilot release." : "Required source does not cover the complete release effective window.");
      }
      const records = await client.query<{ canonical_id: string; membership_role: string; status: string; record_verification_status: string; span_verification_status: string; record_verification_evidence: boolean; span_verification_evidence: boolean; source_id: string; span_source_id: string; authority_eligible: boolean; education_level: string; source_membership_status: string | null; effective_from: string | null; effective_to: string | null }>("SELECT pr.canonical_id, pr.membership_role, pr.status, pr.effective_from, pr.effective_to, r.verification_status AS record_verification_status, sp.verification_status AS span_verification_status, EXISTS (SELECT 1 FROM knowledge_verification_decisions d WHERE d.entity_type='RECORD' AND d.entity_id=r.canonical_id AND d.resulting_status='VERIFIED' AND NOT EXISTS (SELECT 1 FROM knowledge_verification_decisions newer WHERE newer.entity_type=d.entity_type AND newer.entity_id=d.entity_id AND (newer.decided_at, newer.decision_id) > (d.decided_at, d.decision_id))) AS record_verification_evidence, EXISTS (SELECT 1 FROM knowledge_verification_decisions d WHERE d.entity_type='SPAN' AND d.entity_id=sp.span_id AND d.resulting_status='VERIFIED' AND NOT EXISTS (SELECT 1 FROM knowledge_verification_decisions newer WHERE newer.entity_type=d.entity_type AND newer.entity_id=d.entity_id AND (newer.decided_at, newer.decision_id) > (d.decided_at, d.decision_id))) AS span_verification_evidence, r.source_id, sp.source_id AS span_source_id, coalesce(rt.authority_eligible,false) AS authority_eligible, r.education_level, source_membership.status AS source_membership_status FROM knowledge_profile_records pr JOIN knowledge_records r ON r.canonical_id=pr.canonical_id JOIN knowledge_source_spans sp ON sp.span_id=r.span_id LEFT JOIN knowledge_record_taxonomy rt ON rt.record_type=r.record_type LEFT JOIN LATERAL (SELECT rs.status FROM knowledge_release_sources rs WHERE rs.release_id=pr.release_id AND rs.source_id=r.source_id AND (rs.subject_profile_id IS NULL OR rs.subject_profile_id=pr.subject_profile_id) ORDER BY rs.subject_profile_id NULLS LAST LIMIT 1) source_membership ON true WHERE pr.release_id=$1 AND pr.subject_profile_id=$2", [releaseId, profile.id]);
      if (!records.rows.length) addIssue(issues, "PROFILE_RECORDS_MISSING", "SUBJECT_PROFILE", profile.id, "Subject profile has no governed record membership.");
      for (const record of records.rows) {
        if (record.status !== "APPROVED" || !record.source_membership_status || record.source_membership_status !== "APPROVED") addIssue(issues, "PROFILE_SOURCE_MISMATCH", "RECORD", record.canonical_id, "Every approved profile record must come from an approved applicable source membership.");
        const authorityBearingMembership = record.membership_role === "CURRICULUM" || record.membership_role === "ASSESSMENT";
        if (record.record_verification_status !== "VERIFIED" || record.span_verification_status !== "VERIFIED" || !record.record_verification_evidence || !record.span_verification_evidence || (authorityBearingMembership && !record.authority_eligible)) addIssue(issues, "NOT_VERIFIED", "RECORD", record.canonical_id, authorityBearingMembership ? "Authority-bearing profile records require current verified record/span evidence and an authority-eligible taxonomy." : "Supporting profile records require current verified record/span evidence; they remain non-authoritative context.");
        if (record.source_id !== record.span_source_id) addIssue(issues, "PROVENANCE_BROKEN", "RECORD", record.canonical_id, "Record source and span source do not match.");
        if ((record.effective_from !== null && record.effective_from < release.effective_from) || (record.effective_to !== null && release.effective_to !== null && record.effective_to > release.effective_to)) addIssue(issues, "EFFECTIVE_DATE_MISMATCH", "RECORD", record.canonical_id, "Profile record effective dates exceed the release window.");
        const recordSource = sources.rows.find((source) => source.source_id === record.source_id && source.status === "APPROVED");
        if (!recordSource) addIssue(issues, "PROFILE_SOURCE_MISMATCH", "SOURCE", record.source_id, "Every profile record must resolve to an approved applicable source membership.");
        else {
          if (mode === "PRODUCTION" && (recordSource.rights_status !== "CLEARED" || recordSource.production_use_status !== "PERMITTED" || !recordSource.rights_decision_id || !recordSource.rights_decision_matches || recordSource.rights_decision_expired === true)) addIssue(issues, "RIGHTS_DENIED", "SOURCE", record.source_id, "Every source used by an authoritative profile record requires a current matching unexpired rights decision today.");
          if (recordSource.verification_status !== "VERIFIED" || !recordSource.source_verification_evidence) addIssue(issues, "NOT_VERIFIED", "SOURCE", record.source_id, "Every source used by an authoritative profile record requires current append-only verification evidence.");
          if (sourceEffectiveWindowMismatch(recordSource, release, mode)) addIssue(issues, "EFFECTIVE_DATE_MISMATCH", "SOURCE", record.source_id, mode === "CONTROLLED_PILOT" ? "A source used by the historical pilot has explicit applicability dates conflicting with the release." : "A source used by the profile does not cover the release effective window.");
        }
        const relationshipGaps = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM knowledge_relationships rel LEFT JOIN knowledge_records rf ON rf.canonical_id=rel.from_canonical_id LEFT JOIN knowledge_records rt2 ON rt2.canonical_id=rel.to_canonical_id LEFT JOIN knowledge_source_spans rsp ON rsp.span_id=rel.span_id WHERE (rel.verification_status <> 'VERIFIED' OR NOT EXISTS (SELECT 1 FROM knowledge_verification_decisions d WHERE d.entity_type='RELATIONSHIP' AND d.entity_id=rel.relationship_id AND d.resulting_status='VERIFIED' AND NOT EXISTS (SELECT 1 FROM knowledge_verification_decisions newer WHERE newer.entity_type=d.entity_type AND newer.entity_id=d.entity_id AND (newer.decided_at, newer.decision_id) > (d.decided_at, d.decision_id))) OR rf.canonical_id IS NULL OR rt2.canonical_id IS NULL OR rsp.source_id <> rel.source_id) AND (rel.from_canonical_id=$1 OR rel.to_canonical_id=$1)", [record.canonical_id]);
        if (Number(relationshipGaps.rows[0]?.count ?? 0) > 0) addIssue(issues, "PROVENANCE_BROKEN", "RELATIONSHIP", record.canonical_id, "A relationship required by the profile is unverified or has broken endpoints/provenance.");
      }
      const conflicts = await client.query<{ id: string }>("SELECT c.id FROM knowledge_conflicts c WHERE c.release_id=$1 AND c.status='OPEN' AND (c.subject_profile_id IS NULL OR c.subject_profile_id=$2)", [releaseId, profile.id]);
      for (const conflict of conflicts.rows) addIssue(issues, "CONFLICT_UNRESOLVED", "CONFLICT", conflict.id, "Open conflict blocks activation.");
      if (profile.requires_assessment_profile) {
        const assessments = await client.query<{ id: string; applicable_source_roles: string[] }>("SELECT id, applicable_source_roles FROM knowledge_assessment_profiles WHERE release_id=$1 AND (subject_profile_id IS NULL OR subject_profile_id=$2) AND status <> 'RETIRED'", [releaseId, profile.id]);
        const validAssessment = assessments.rows.some((assessment) => assessment.applicable_source_roles.length > 0 && assessment.applicable_source_roles.every((role) => sources.rows.some((source) => source.source_role === role && source.status === "APPROVED" && (role === "FRAMEWORK" || role === "ASSESSMENT_FRAMEWORK" ? source.subject_profile_id === null : role === "SUBJECT_SYLLABUS" || role === "SUBJECT_ASSESSMENT_GUIDELINE" ? source.subject_profile_id === profile.id : true))));
        if (!validAssessment) addIssue(issues, "ASSESSMENT_PROFILE_MISSING", "SUBJECT_PROFILE", profile.id, "Required assessment profile has no complete applicable approved source-role composition.");
      }
    }
    if (issues.length) return recordActivationRun(client, { releaseId, status: "BLOCKED", activated: false, checkedAt, issues }, actorUserId);
    await command(client, "ACTIVATE_RELEASE", async () => {
      await client.query("UPDATE knowledge_subject_profiles SET status='ACTIVE' WHERE release_id=$1", [releaseId]);
      await client.query("UPDATE knowledge_curriculum_subjects s SET status='ACTIVE', updated_at=now() WHERE EXISTS (SELECT 1 FROM knowledge_subject_profiles p WHERE p.release_id=$1 AND p.governed_subject_id=s.id)", [releaseId]);
      await client.query("UPDATE knowledge_assessment_profiles SET status='ACTIVE' WHERE release_id=$1 AND status='DRAFT'", [releaseId]);
      await client.query("UPDATE knowledge_curriculum_releases SET status='ACTIVE', activated_at=now(), activated_by=$2 WHERE id=$1 AND status='REVIEW'", [releaseId, actorUserId]);
    });
    return recordActivationRun(client, { releaseId, status: "ACTIVE", activated: true, checkedAt, issues: [] }, actorUserId);
  });
}

export async function activateKnowledgeReleaseForControlledPilot(client: KnowledgeSqlClient, releaseId: string, actorUserId: string): Promise<ActivationReport> {
  return activateKnowledgeRelease(client, releaseId, actorUserId, "CONTROLLED_PILOT");
}
