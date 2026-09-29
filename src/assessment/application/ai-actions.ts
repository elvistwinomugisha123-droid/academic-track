"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AssessmentPayloadSchema, type AssessmentPayload } from "@/assessment/domain/types";
import { validateAssessment } from "@/assessment/domain/validation";
import { configuredAIGateway, generateStructured } from "@/ai/gateway";
import { canonicalJson } from "@/ai/canonical-json";
import { loadAssessmentWorkspace } from "./queries";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createPostgresKnowledgeClient } from "@/knowledge/db/client";
import { assessmentLevelMatches } from "@/assessment/domain/curriculum-level";

const promptVersion = "assessment-draft-v2-grounded";
const uuid = z.string().uuid();
export type AssessmentProposal = { ok: true; runId: string; content: AssessmentPayload; contextFingerprint: string; outputFingerprint: string; expectedVersion: number; model: string } | { ok: false; error: string; code?: "RIGHTS_BLOCKED" | "UNAVAILABLE" | "VALIDATION_FAILED" };

function fingerprint(value: unknown) { return createHash("sha256").update(canonicalJson(value)).digest("hex"); }

export async function generateAssessmentDraft(workspaceId: string): Promise<AssessmentProposal> {
  try {
    const data = await loadAssessmentWorkspace(workspaceId);
    const { blueprintIssues } = await import("@/assessment/domain/blueprint");
    const blueprintError = blueprintIssues(data.version.content_json.blueprint)[0];
    if (blueprintError) return { ok: false, code: "UNAVAILABLE", error: `${blueprintError} Save the blueprint before asking ATE to draft.` };
    const workspaceIdValue = uuid.parse(workspaceId);
    const profile = data.runtimeProfile;
    if (!profile || data.profileResolution.state !== "RESOLVED") return { ok: false, code: "UNAVAILABLE", error: data.profileResolution.explanation };
    const profileId = profile.id;
    const eligibleCanonicalIds = (data.workspace.purpose === "COMMON_STREAM_TEST"
      ? [...new Set(data.scopeItems.map((item) => String(item.canonical_id)))].filter((canonicalId) => data.sections.every((section) => data.scopeItems.some((item) => String(item.canonical_id) === canonicalId && String(item.section_id) === String(section.teaching_section_id) && ["CONFIRMED_ELIGIBLE", "BROADER_PROFILE_PERMITTED"].includes(String(item.scope_state)))))
      : [...new Set(data.scopeItems.filter((item) => ["CONFIRMED_ELIGIBLE", "BROADER_PROFILE_PERMITTED"].includes(String(item.scope_state))).map((item) => String(item.canonical_id)))]).sort();
    const aiAllowed = profile.externalAiAllowed;
    const rightsState = profile.rightsState;
    const service = createSupabaseServiceRoleClient();
    if (!aiAllowed) {
      const ai = configuredAIGateway();
      const blocked = await service.from("assessment_ai_generation_runs").insert({ school_id: data.access.schoolId, assessment_workspace_id: workspaceIdValue, created_by_user_id: data.access.userId, created_by_membership_id: data.access.membershipId, provider: ai.provider, model: ai.model, prompt_version: promptVersion, context_fingerprint: fingerprint({ profileId, rightsState, promptVersion }), context_snapshot: { profileId, purpose: data.workspace.purpose, expectedVersion: data.version.version_number }, status: "RIGHTS_BLOCKED", validation_status: "FAILED", rights_state: rightsState });
      if (blocked.error) return { ok: false, code: "UNAVAILABLE", error: "The AI rights decision could not be recorded." };
      return { ok: false, code: "RIGHTS_BLOCKED", error: "AI drafting is unavailable for the active assessment source configuration. Manual authoring remains available." };
    }
    if (!eligibleCanonicalIds.length) return { ok: false, code: "UNAVAILABLE", error: "Confirm taught curriculum content for this class before drafting an assessment." };
    const knowledge = createPostgresKnowledgeClient();
    let curriculum: Array<{ canonicalId: string; type: string; title: string; wording: string; level: string | null; sourceId: string }> = [];
    let topicGuidance: Array<{ topicId: string; type: string; wording: string }> = [];
    try {
      const records = await knowledge.query<{ canonical_id: string; record_type: string; normalized: Record<string, unknown>; source_wording: string; education_level: string; source_id: string }>("select distinct r.canonical_id, r.record_type, r.normalized, r.source_wording, r.education_level, r.source_id from knowledge_records r join knowledge_profile_records pr on pr.canonical_id=r.canonical_id join knowledge_release_sources rs on rs.source_id=r.source_id and rs.release_id=pr.release_id and rs.status='APPROVED' where pr.subject_profile_id=$1 and pr.release_id=$2 and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE' and r.verification_status='VERIFIED' and r.canonical_id = any($3::text[])", [String(data.workspace.curriculum_subject_profile_id), profile.releaseId, eligibleCanonicalIds]);
      curriculum = records.rows.map((row) => ({ canonicalId: row.canonical_id, type: row.record_type, title: typeof row.normalized?.title === "string" ? row.normalized.title : "", wording: row.source_wording.slice(0, 600), level: typeof row.normalized?.level === "string" ? row.normalized.level : null, sourceId: row.source_id }));
      const topicIds = curriculum.filter((item) => item.type === "topic").map((item) => item.canonicalId);
      if (topicIds.length) {
        const related = await knowledge.query<{ topic_id: string; record_type: string; source_wording: string }>("select rel.to_canonical_id as topic_id, r.record_type, r.source_wording from knowledge_relationships rel join knowledge_records r on r.canonical_id=rel.from_canonical_id join knowledge_profile_records pr on pr.canonical_id=r.canonical_id and pr.subject_profile_id=$1 and pr.release_id=$2 and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE' join knowledge_release_sources rs on rs.source_id=r.source_id and rs.release_id=pr.release_id and rs.status='APPROVED' where rel.to_canonical_id = any($3::text[]) and rel.verification_status='VERIFIED' and r.verification_status='VERIFIED' and r.record_type in ('learning_outcome','assessment_strategy') order by rel.to_canonical_id,r.record_type,r.canonical_id limit 80", [String(data.workspace.curriculum_subject_profile_id), profile.releaseId, topicIds]);
        topicGuidance = related.rows.map((row) => ({ topicId: row.topic_id, type: row.record_type, wording: row.source_wording.slice(0, 450) }));
      }
    } finally { await knowledge.close(); }
    if (curriculum.length !== eligibleCanonicalIds.length) return { ok: false, code: "UNAVAILABLE", error: "Some taught outcomes are not verified in the active curriculum profile. Ask your academic administrator to review the curriculum binding." };
    if (curriculum.some((item) => !item.title && !item.wording)) return { ok: false, code: "UNAVAILABLE", error: "The eligible curriculum content has no readable learning outcome for assessment drafting." };
    if (curriculum.some((item) => item.type === "topic" && !topicGuidance.some((guide) => guide.topicId === item.canonicalId && guide.type === "learning_outcome"))) return { ok: false, code: "UNAVAILABLE", error: "The selected topic has no verified learning outcomes attached. Review its curriculum mapping before drafting." };
    if (["CLASS_TEST", "COMMON_STREAM_TEST", "INTERNAL_EXAM"].includes(String(data.workspace.purpose))) {
      const sectionIds = data.sections.map((section) => String(section.teaching_section_id));
      const school = await createSupabaseServerClient();
      const teaching = await school.from("teaching_sections").select("id, class_level_id").eq("school_id", data.access.schoolId).in("id", sectionIds);
      if (teaching.error || !teaching.data || teaching.data.length !== sectionIds.length) return { ok: false, code: "UNAVAILABLE", error: "The participating class levels could not be verified." };
      const levelIds = [...new Set(teaching.data.map((section) => section.class_level_id))];
      const levels = await school.from("class_levels").select("id, name").eq("school_id", data.access.schoolId).in("id", levelIds);
      if (levels.error || !levels.data || levels.data.length !== levelIds.length) return { ok: false, code: "UNAVAILABLE", error: "The participating class levels could not be verified." };
      if (curriculum.some((item) => !item.level || levels.data!.some((level) => !assessmentLevelMatches(level.name, item.level!)))) return { ok: false, code: "UNAVAILABLE", error: "The taught curriculum topic does not match the class level. Correct the curriculum position before drafting this paper." };
    }
    const safeContext = { purpose: data.workspace.purpose, profile: { id: profile.id, title: profile.displayTitle, regime: profile.regime, educationLevel: profile.educationLevel, releaseId: profile.releaseId, releaseVersion: profile.releaseVersion }, blueprint: data.version.content_json.blueprint, eligibleCurriculum: curriculum, topicGuidance, eligibleCanonicalIds, currentVersion: data.version.version_number, rightsState: profile.rightsState, externalAiAllowed: profile.externalAiAllowed };
    const contextFingerprint = fingerprint({ safeContext, promptVersion });
    const ai = configuredAIGateway();
    const runInsert = await service.from("assessment_ai_generation_runs").insert({ school_id: data.access.schoolId, assessment_workspace_id: workspaceIdValue, created_by_user_id: data.access.userId, created_by_membership_id: data.access.membershipId, provider: ai.provider, model: ai.model, prompt_version: promptVersion, context_fingerprint: contextFingerprint, context_snapshot: { profileId, purpose: data.workspace.purpose, expectedVersion: data.version.version_number, blueprint: data.version.content_json.blueprint, eligibleCanonicalIds }, status: aiAllowed ? "RUNNING" : "RIGHTS_BLOCKED", validation_status: aiAllowed ? "NOT_RUN" : "FAILED", rights_state: rightsState }).select("id").single();
    if (runInsert.error || !runInsert.data) return { ok: false, code: "UNAVAILABLE", error: "The AI generation run could not be recorded." };
    const runId = String(runInsert.data.id);
    const started = Date.now();
    try {
      const result = await generateStructured({ system: "Draft a teacher-review-required assessment using the supplied verified curriculum wording and blueprint. Match the education level and subject. For a class test, include realistic application or interpretation tasks where the outcome supports them, with enough context to answer; do not force one scenario onto a simple formative check. Use only eligibleCanonicalIds. Give each question a specific marking guide with marks that sum to its allocated marks. Do not invent source facts, curriculum IDs, official status, NCDC/UNEB claims, or assessment rules. Preserve purpose, durationMinutes, totalMarks, blueprint and participatingSectionIds exactly. Return only the canonical AssessmentPayload JSON with stable question IDs.", payload: { workflow: "ASSESSMENT_DRAFT", safeContext }, maxTokens: 4800, validate: (value) => AssessmentPayloadSchema.parse(value) });
      const validation = validateAssessment({ payload: result.output, blueprint: data.version.content_json.blueprint, eligibleCanonicalIds, knownCanonicalIds: eligibleCanonicalIds, participatingSectionIds: data.sections.map((section) => String(section.teaching_section_id)), profile, exportAllowed: profile.exportAllowed });
      if (!validation.valid) throw new Error(validation.issues[0]?.message || "AI assessment draft did not satisfy the blueprint.");
      const outputFingerprint = fingerprint(result.output);
      await service.from("assessment_ai_generation_runs").update({ status: "SUCCEEDED", validation_status: "PASSED", output_fingerprint: outputFingerprint, output_json: result.output, model: result.model, input_token_count: result.usage.inputTokens, output_token_count: result.usage.outputTokens, latency_ms: result.latencyMs }).eq("id", runId).eq("school_id", data.access.schoolId);
      return { ok: true, runId, content: result.output, contextFingerprint, outputFingerprint, expectedVersion: data.version.version_number, model: result.model };
    } catch (error) {
      await service.from("assessment_ai_generation_runs").update({ status: "FAILED", validation_status: "FAILED", latency_ms: Date.now() - started, error_code: error instanceof Error ? error.name : "GENERATION_FAILED" }).eq("id", runId).eq("school_id", data.access.schoolId);
      return { ok: false, code: "VALIDATION_FAILED", error: error instanceof Error ? error.message : "ATE could not prepare a valid assessment proposal." };
    }
  } catch (error) { return { ok: false, code: "UNAVAILABLE", error: error instanceof Error ? error.message : "Assessment AI drafting is unavailable." }; }
}

export async function acceptAssessmentDraft(workspaceId: string, runId: string, outputFingerprint: string, expectedVersion: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireWorkspaceAccess();
    const client = await createSupabaseServerClient();
    const response = await client.rpc("accept_assessment_ai_version", { p_workspace_id: uuid.parse(workspaceId), p_generation_run_id: uuid.parse(runId), p_expected_version: expectedVersion, p_output_fingerprint: z.string().length(64).parse(outputFingerprint) });
    if (response.error) return { ok: false, error: response.error.message };
    revalidatePath(`/workspace/teacher/assessments/${workspaceId}`);
    void access;
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "AI proposal could not be accepted." }; }
}

export async function rejectAssessmentDraft(runId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireWorkspaceAccess();
    const response = await createSupabaseServiceRoleClient().from("assessment_ai_generation_runs").update({ status: "REJECTED" }).eq("id", uuid.parse(runId)).eq("created_by_user_id", access.userId).eq("created_by_membership_id", access.membershipId).eq("status", "SUCCEEDED");
    if (response.error) return { ok: false, error: response.error.message };
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "AI proposal could not be rejected." }; }
}
