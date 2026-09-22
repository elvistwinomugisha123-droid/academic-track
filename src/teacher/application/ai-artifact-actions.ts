"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseLessonPayload } from "@/artifacts/lesson";
import { lessonArtifactTypes, type LessonArtifactType } from "@/artifacts/types";
import { generateAnthropicStructured } from "@/ai/anthropic-provider";
import { lessonArtifactSystemPrompt } from "@/ai/lesson-artifact-prompts";
import { ARTIFACT_PATCH_PROMPT_VERSION, ASK_ATE_PROMPT_VERSION, LESSON_PLAN_PROMPT_VERSION, TEACHING_PACK_PROMPT_VERSION, AIProposalInputSchema, buildTrustedLessonAIContext, canUseExternalAI, safeModelContext, validateGeneratedArtifact, type AIArtifactOperation, type TrustedLessonAIContext } from "@/ai/lesson-artifact-contracts";
import { canonicalJson } from "@/ai/canonical-json";
import { DEFAULT_ANTHROPIC_MODEL } from "@/ai/anthropic-provider";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { loadLessonReadinessData } from "./queries";

const uuid = z.string().uuid();
const artifactType = z.enum(lessonArtifactTypes as [LessonArtifactType, ...LessonArtifactType[]]);
const packType = z.enum(["BOARD_NOTES", "LEARNER_NOTES", "LESSON_SUMMARY", "ACTIVITY_SHEET", "HOMEWORK"]);

export type AIProposal = { ok: true; runId: string; scheduledLessonId: string; content: unknown; artifactId: string | null; artifactType: LessonArtifactType; expectedVersion: number | null; parentArtifactId: string | null; parentVersionId: string | null; contextFingerprint: string; outputFingerprint: string; instruction: string | null; selectedField: string | null; model: string } | { ok: false; error: string; code?: "RIGHTS_BLOCKED" | "STALE" | "UNAVAILABLE" | "VALIDATION_FAILED" };
type ActionResult = { ok: true; id: string; version: number } | { ok: false; error: string; code?: string };

function promptVersion(operation: AIArtifactOperation) { return operation === "GENERATE_FORMAL_LESSON_PLAN" ? LESSON_PLAN_PROMPT_VERSION : operation === "GENERATE_TEACHING_PACK" ? TEACHING_PACK_PROMPT_VERSION : operation === "ASK_ATE" ? ASK_ATE_PROMPT_VERSION : ARTIFACT_PATCH_PROMPT_VERSION; }
function rightsState(context: TrustedLessonAIContext) { return context.anchor?.rightsState || "UNKNOWN"; }
function fingerprint(input: { modelContext: unknown; artifactId: string | null; artifactCurrentVersion: number | null; parentArtifactId: string | null; parentVersionId: string | null; operation: AIArtifactOperation; artifactType: LessonArtifactType; promptVersion: string }) {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

async function createRun(input: { context: TrustedLessonAIContext; artifactId: string | null; artifactType: LessonArtifactType; operation: AIArtifactOperation; promptVersion: string; contextFingerprint: string }) {
  const service = createSupabaseServiceRoleClient();
  const result = await service.from("ai_generation_runs").insert({ school_id: input.context.schoolId, created_by_user_id: input.context.userId, created_by_membership_id: input.context.membershipId, scheduled_lesson_id: input.context.scheduledLessonId, artifact_id: input.artifactId, artifact_type: input.artifactType, operation: input.operation, provider: "anthropic", model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL, prompt_version: input.promptVersion, context_fingerprint: input.contextFingerprint, status: "RUNNING", validation_status: "NOT_RUN", rights_state: rightsState(input.context) }).select("id").single();
  if (result.error || !result.data) throw new Error("AI generation run could not be recorded.");
  return result.data.id as string;
}

async function updateRun(runId: string, values: Record<string, unknown>) {
  try { await createSupabaseServiceRoleClient().from("ai_generation_runs").update(values).eq("id", runId); } catch { /* the generation result remains visible as a recoverable UI error */ }
}

function refresh(lessonId: string, sectionId: string) { revalidatePath(`/workspace/teacher/lessons/${lessonId}`); revalidatePath(`/workspace/teacher/sections/${sectionId}`); revalidatePath("/workspace"); }

function blocked(context: TrustedLessonAIContext): AIProposal { return { ok: false, code: "RIGHTS_BLOCKED", error: "ATE cannot send this curriculum context to an external model under its current rights decision. You can continue by editing the saved artifact manually." }; }
function aiFailureMessage(error: unknown) { const message = error instanceof Error ? error.message : ""; return /ANTHROPIC_API_KEY|API key|not configured|fetch failed/i.test(message) ? "ATE drafting is unavailable right now. You can continue by writing the lesson plan manually." : message || "ATE could not prepare a valid structured proposal."; }

async function runGeneration<T extends LessonArtifactType>(input: { context: TrustedLessonAIContext; type: T; operation: AIArtifactOperation; artifactId: string | null; expectedVersion: number | null; parentArtifactId: string | null; parentVersionId: string | null; currentArtifact: unknown | null; instruction?: string; selectedField?: string | null; expectedCanonicalId?: string | null }): Promise<AIProposal> {
  const version = promptVersion(input.operation);
  const modelContext = safeModelContext(input.context, input.currentArtifact, input.instruction || null, input.selectedField || null);
  const contextFingerprint = fingerprint({ modelContext, artifactId: input.artifactId, artifactCurrentVersion: input.expectedVersion, parentArtifactId: input.parentArtifactId, parentVersionId: input.parentVersionId, operation: input.operation, artifactType: input.type, promptVersion: version });
  const runId = await createRun({ context: input.context, artifactId: input.artifactId, artifactType: input.type, operation: input.operation, promptVersion: version, contextFingerprint });
  if (!canUseExternalAI(input.context)) { await updateRun(runId, { status: "RIGHTS_BLOCKED", validation_status: "FAILED", error_code: "RIGHTS_BLOCKED" }); return blocked(input.context); }
  const started = Date.now();
  try {
    const result = await generateAnthropicStructured({
      system: lessonArtifactSystemPrompt(input.operation, input.type, input.selectedField),
      payload: modelContext,
      maxTokens: input.type === "FORMAL_LESSON_PLAN" ? 3000 : 1800,
      validate: (value) => validateGeneratedArtifact(input.type, value, input.context, input.expectedCanonicalId),
    });
    const outputFingerprint = createHash("sha256").update(canonicalJson(result.output)).digest("hex");
    await updateRun(runId, { status: "SUCCEEDED", validation_status: "PASSED", model: result.model, input_token_count: result.usage.inputTokens, output_token_count: result.usage.outputTokens, latency_ms: result.latencyMs, output_fingerprint: outputFingerprint });
    return { ok: true, runId, scheduledLessonId: input.context.scheduledLessonId, content: result.output, artifactId: input.artifactId, artifactType: input.type, expectedVersion: input.expectedVersion, parentArtifactId: input.parentArtifactId, parentVersionId: input.parentVersionId, contextFingerprint, outputFingerprint, instruction: input.instruction || null, selectedField: input.selectedField || null, model: result.model };
  } catch (error) {
    await updateRun(runId, { status: "FAILED", validation_status: "FAILED", latency_ms: Date.now() - started, error_code: error instanceof Error ? error.name : "GENERATION_FAILED" });
    return { ok: false, code: "UNAVAILABLE", error: aiFailureMessage(error) };
  }
}

export async function generateFormalLessonPlanDraft(scheduledLessonId: string): Promise<AIProposal> {
  try {
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required.");
    const data = await loadLessonReadinessData(uuid.parse(scheduledLessonId));
    const context = buildTrustedLessonAIContext(data);
    const artifact = data.artifacts.find((item) => item.artifactType === "FORMAL_LESSON_PLAN");
    const current = artifact?.currentContent ? parseLessonPayload("FORMAL_LESSON_PLAN", artifact.currentContent) : null;
    return runGeneration({ context, type: "FORMAL_LESSON_PLAN", operation: "GENERATE_FORMAL_LESSON_PLAN", artifactId: artifact?.id || null, expectedVersion: artifact?.currentVersionNumber || null, parentArtifactId: null, parentVersionId: null, currentArtifact: current, expectedCanonicalId: context.anchor?.canonicalId || null });
  } catch (error) { return { ok: false, code: "UNAVAILABLE", error: aiFailureMessage(error) }; }
}

export async function generateTeachingPackDraft(input: unknown): Promise<AIProposal> {
  try {
    const value = z.object({ scheduledLessonId: uuid, artifactType: packType }).parse(input);
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required.");
    const data = await loadLessonReadinessData(value.scheduledLessonId);
    const context = buildTrustedLessonAIContext(data);
    const plan = data.artifacts.find((item) => item.artifactType === "FORMAL_LESSON_PLAN");
    if (!plan?.currentVersionId || !plan.currentContent) throw new Error("Save the Formal Lesson Plan before generating a Teaching Pack artifact.");
    const child = data.artifacts.find((item) => item.artifactType === value.artifactType);
    return runGeneration({ context, type: value.artifactType, operation: "GENERATE_TEACHING_PACK", artifactId: child?.id || null, expectedVersion: child?.currentVersionNumber || null, parentArtifactId: plan.id, parentVersionId: plan.currentVersionId, currentArtifact: child?.currentContent ? parseLessonPayload(value.artifactType, child.currentContent) : parseLessonPayload("FORMAL_LESSON_PLAN", plan.currentContent), instruction: "Create a useful lesson-specific Teaching Pack artifact from the saved Formal Lesson Plan." });
  } catch (error) { return { ok: false, code: "UNAVAILABLE", error: error instanceof Error ? error.message : "ATE could not start Teaching Pack generation." }; }
}

export async function proposeArtifactPatch(input: unknown): Promise<AIProposal> {
  try {
    const value = z.object({ scheduledLessonId: uuid, artifactId: uuid, artifactType, instruction: z.string().trim().min(1).max(1000), selectedField: z.string().trim().max(80).nullable().optional() }).parse(input);
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required.");
    const data = await loadLessonReadinessData(value.scheduledLessonId);
    const context = buildTrustedLessonAIContext(data);
    const artifact = data.artifacts.find((item) => item.id === value.artifactId && item.artifactType === value.artifactType);
    if (!artifact?.currentContent) throw new Error("The saved artifact could not be reopened.");
    return runGeneration({ context, type: value.artifactType, operation: "PATCH_ARTIFACT", artifactId: artifact.id, expectedVersion: artifact.currentVersionNumber, parentArtifactId: artifact.parentArtifactId, parentVersionId: artifact.parentVersionId, currentArtifact: parseLessonPayload(value.artifactType, artifact.currentContent), instruction: value.instruction, selectedField: value.selectedField || null, expectedCanonicalId: value.artifactType === "FORMAL_LESSON_PLAN" ? context.anchor?.canonicalId || null : undefined });
  } catch (error) { return { ok: false, code: "UNAVAILABLE", error: error instanceof Error ? error.message : "ATE could not prepare this change." }; }
}

export async function askATEForArtifact(input: unknown): Promise<AIProposal> {
  try {
    const value = z.object({ scheduledLessonId: uuid, artifactId: uuid, artifactType, instruction: z.string().trim().min(1).max(1000), selectedField: z.string().trim().max(80).nullable().optional() }).parse(input);
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required.");
    const data = await loadLessonReadinessData(value.scheduledLessonId);
    const context = buildTrustedLessonAIContext(data);
    const artifact = data.artifacts.find((item) => item.id === value.artifactId && item.artifactType === value.artifactType);
    if (!artifact?.currentContent) throw new Error("The saved artifact could not be reopened.");
    return runGeneration({ context, type: value.artifactType, operation: "ASK_ATE", artifactId: artifact.id, expectedVersion: artifact.currentVersionNumber, parentArtifactId: artifact.parentArtifactId, parentVersionId: artifact.parentVersionId, currentArtifact: parseLessonPayload(value.artifactType, artifact.currentContent), instruction: value.instruction, selectedField: value.selectedField || null, expectedCanonicalId: value.artifactType === "FORMAL_LESSON_PLAN" ? context.anchor?.canonicalId || null : undefined });
  } catch (error) { return { ok: false, code: "UNAVAILABLE", error: error instanceof Error ? error.message : "ATE could not prepare this change." }; }
}

export async function acceptAIProposal(input: unknown): Promise<ActionResult> {
  try {
    const value = AIProposalInputSchema.parse(input);
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required.");
    const data = await loadLessonReadinessData(value.scheduledLessonId);
    const context = buildTrustedLessonAIContext(data);
    const artifact = value.artifactId ? data.artifacts.find((item) => item.id === value.artifactId) : null;
    const service = createSupabaseServiceRoleClient();
    const runResult = await service.from("ai_generation_runs").select("id, artifact_id, artifact_type, operation, prompt_version, context_fingerprint, output_fingerprint, status, validation_status").eq("id", value.runId).eq("school_id", access.schoolId).eq("created_by_user_id", access.userId).eq("created_by_membership_id", access.membershipId).maybeSingle();
    if (runResult.error || !runResult.data || runResult.data.status !== "SUCCEEDED" || runResult.data.validation_status !== "PASSED") return { ok: false, error: "The AI proposal is unavailable or has already been used.", code: "STALE" };
    const run = runResult.data as { artifact_id: string | null; artifact_type: LessonArtifactType; operation: AIArtifactOperation; prompt_version: string; context_fingerprint: string; output_fingerprint: string | null };
    if (run.artifact_type !== value.artifactType || run.artifact_id !== value.artifactId) return { ok: false, error: "The AI proposal does not belong to this artifact.", code: "STALE" };
    const plan = data.artifacts.find((item) => item.artifactType === "FORMAL_LESSON_PLAN");
    const currentArtifact = artifact?.currentContent
      ? parseLessonPayload(value.artifactType, artifact.currentContent)
      : runResult.data.operation === "GENERATE_TEACHING_PACK" && plan?.currentContent
        ? parseLessonPayload("FORMAL_LESSON_PLAN", plan.currentContent)
        : null;
    const instruction = runResult.data.operation === "GENERATE_TEACHING_PACK"
      ? "Create a useful lesson-specific Teaching Pack artifact from the saved Formal Lesson Plan."
      : value.instruction || null;
    const modelContext = safeModelContext(context, currentArtifact, instruction, value.selectedField || null);
    const expectedFingerprint = fingerprint({ modelContext, artifactId: value.artifactId, artifactCurrentVersion: artifact?.currentVersionNumber || value.expectedVersion, parentArtifactId: value.parentArtifactId, parentVersionId: value.parentVersionId, operation: run.operation, artifactType: value.artifactType, promptVersion: run.prompt_version });
    if (expectedFingerprint !== value.contextFingerprint || expectedFingerprint !== run.context_fingerprint) return { ok: false, error: "The lesson context changed while this proposal was open. Reopen the lesson and generate again.", code: "STALE" };
    const expectedCanonicalId = value.artifactType === "FORMAL_LESSON_PLAN" ? context.anchor?.canonicalId || null : undefined;
    const content = validateGeneratedArtifact(value.artifactType, value.content, context, expectedCanonicalId);
    const outputFingerprint = createHash("sha256").update(canonicalJson(content)).digest("hex");
    if (!run.output_fingerprint || outputFingerprint !== value.outputFingerprint || outputFingerprint !== run.output_fingerprint) return { ok: false, error: "This proposal no longer matches the generated result. Generate it again before accepting.", code: "STALE" };
    const result = await service.rpc("accept_ai_lesson_artifact_version", { p_generation_run_id: value.runId, p_scheduled_lesson_id: value.scheduledLessonId, p_artifact_id: value.artifactId, p_artifact_type: value.artifactType, p_parent_artifact_id: value.parentArtifactId, p_parent_version_id: value.parentVersionId, p_content_json: content, p_output_fingerprint: outputFingerprint, p_expected_version: value.expectedVersion, p_change_summary: value.changeSummary || "Teacher accepted ATE proposal", p_actor_user_id: access.userId, p_actor_membership_id: access.membershipId });
    if (result.error || !result.data) throw new Error(result.error?.message || "The AI proposal could not be accepted.");
    refresh(value.scheduledLessonId, data.lesson.section.id);
    const response = result.data as { artifactId: string; versionNumber: number };
    return { ok: true, id: response.artifactId, version: response.versionNumber };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "The AI proposal could not be accepted." }; }
}

export async function rejectAIProposal(runId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireWorkspaceAccess();
    uuid.parse(runId);
    const result = await createSupabaseServiceRoleClient().from("ai_generation_runs").update({ status: "REJECTED" }).eq("id", runId).eq("created_by_user_id", access.userId).eq("created_by_membership_id", access.membershipId).eq("status", "SUCCEEDED");
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "The proposal could not be rejected." }; }
}
