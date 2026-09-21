"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AssessmentPayloadSchema, type AssessmentPayload, type AssessmentProfile } from "@/assessment/domain/types";
import { validateAssessment } from "@/assessment/domain/validation";
import { generateAnthropicStructured, DEFAULT_ANTHROPIC_MODEL } from "@/ai/anthropic-provider";
import { canonicalJson } from "@/ai/canonical-json";
import { loadAssessmentWorkspace } from "./queries";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/access";

const promptVersion = "assessment-draft-v1";
const uuid = z.string().uuid();
export type AssessmentProposal = { ok: true; runId: string; content: AssessmentPayload; contextFingerprint: string; outputFingerprint: string; expectedVersion: number; model: string } | { ok: false; error: string; code?: "RIGHTS_BLOCKED" | "UNAVAILABLE" | "VALIDATION_FAILED" };

function fingerprint(value: unknown) { return createHash("sha256").update(canonicalJson(value)).digest("hex"); }

export async function generateAssessmentDraft(workspaceId: string): Promise<AssessmentProposal> {
  try {
    const data = await loadAssessmentWorkspace(workspaceId);
    const workspaceIdValue = uuid.parse(workspaceId);
    const profileId = String(data.workspace.assessment_profile_id);
    const releaseId = String(data.profile?.release_id || "");
    const sourceSet = await (await createSupabaseServerClient()).from("knowledge_release_sources").select("source_id").eq("release_id", releaseId).eq("status", "APPROVED");
    if (sourceSet.error) return { ok: false, code: "UNAVAILABLE", error: "Assessment profile rights could not be resolved." };
    const sourceIds = (sourceSet.data ?? []).map((item) => String(item.source_id));
    const sources = sourceIds.length ? await (await createSupabaseServerClient()).from("knowledge_sources").select("source_id, rights_status, production_use_status, external_ai_allowed").in("source_id", sourceIds) : { data: [], error: null };
    if (sources.error) return { ok: false, code: "UNAVAILABLE", error: "Assessment source rights could not be resolved." };
    const sourceRows = sources.data ?? [];
    const aiAllowed = sourceRows.length > 0 && sourceRows.every((source) => source.rights_status === "CLEARED" && source.production_use_status === "PERMITTED" && source.external_ai_allowed === true);
    const rightsState = aiAllowed ? "CLEARED" : "REVIEW_REQUIRED";
    const service = createSupabaseServiceRoleClient();
    const safeContext = { purpose: data.workspace.purpose, profile: { id: profileId, title: data.profile?.display_title, regime: data.profile?.regime, releaseId }, blueprint: data.version.content_json.blueprint, eligibleCanonicalIds: data.scopeItems.filter((item) => ["CONFIRMED_ELIGIBLE", "BROADER_PROFILE_PERMITTED"].includes(String(item.scope_state))).map((item) => String(item.canonical_id)), currentVersion: data.version.version_number };
    const contextFingerprint = fingerprint({ safeContext, promptVersion });
    const runInsert = await service.from("assessment_ai_generation_runs").insert({ school_id: data.access.schoolId, assessment_workspace_id: workspaceIdValue, created_by_user_id: data.access.userId, created_by_membership_id: data.access.membershipId, provider: "anthropic", model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL, prompt_version: promptVersion, context_fingerprint: contextFingerprint, status: aiAllowed ? "RUNNING" : "RIGHTS_BLOCKED", validation_status: aiAllowed ? "NOT_RUN" : "FAILED", rights_state: rightsState }).select("id").single();
    if (runInsert.error || !runInsert.data) return { ok: false, code: "UNAVAILABLE", error: "The AI generation run could not be recorded." };
    const runId = String(runInsert.data.id);
    if (!aiAllowed) return { ok: false, code: "RIGHTS_BLOCKED", error: "The active assessment sources are not cleared for external AI. Manual authoring remains available." };
    const started = Date.now();
    try {
      const result = await generateAnthropicStructured({ system: "Draft a teacher-review-required assessment inside the supplied blueprint. Use only eligibleCanonicalIds. Never invent curriculum IDs, official status, NCDC/UNEB claims, or assessment rules. Preserve purpose, durationMinutes, totalMarks, blueprint and participatingSectionIds exactly. Return only the canonical AssessmentPayload JSON with stable question IDs.", payload: { workflow: "ASSESSMENT_DRAFT", safeContext }, maxTokens: 3200, validate: (value) => AssessmentPayloadSchema.parse(value) });
      const profile: AssessmentProfile = { id: profileId, displayTitle: String(data.profile?.display_title || "Active assessment profile"), purpose: data.workspace.purpose as AssessmentProfile["purpose"], regime: String(data.profile?.regime || "GOVERNED"), authority: "Governed ATE knowledge", sourceId: null, sourceVersion: null, releaseId, releaseVersion: "active", verificationStatus: "VERIFIED", rightsState: "CLEARED", externalAiAllowed: true, exportAllowed: true, effectiveFrom: "1900-01-01", effectiveTo: null, allowsBroaderScope: true, requiresReview: false };
      const validation = validateAssessment({ payload: result.output, blueprint: data.version.content_json.blueprint, eligibleCanonicalIds: safeContext.eligibleCanonicalIds, knownCanonicalIds: safeContext.eligibleCanonicalIds, participatingSectionIds: data.sections.map((section) => String(section.teaching_section_id)), profile, exportAllowed: true });
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
