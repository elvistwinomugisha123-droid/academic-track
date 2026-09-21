import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const workspaceId = process.env.TEST_ASSESSMENT_WORKSPACE_ID;
const teacherEmail = process.env.TEST_ASSESSMENT_TEACHER_EMAIL;
const teacherPassword = process.env.TEST_ASSESSMENT_TEACHER_PASSWORD;
const foreignSectionId = process.env.TEST_ASSESSMENT_FOREIGN_SECTION_ID;
const foreignCanonicalId = process.env.TEST_ASSESSMENT_FOREIGN_CANONICAL_ID;
const partialCanonicalId = process.env.TEST_ASSESSMENT_PARTIAL_CANONICAL_ID;
const partialEvidenceId = process.env.TEST_ASSESSMENT_PARTIAL_EVIDENCE_ID;
const foreignWorkspaceId = process.env.TEST_ASSESSMENT_FOREIGN_WORKSPACE_ID;
const configured = Boolean(url && publishableKey && workspaceId && teacherEmail && teacherPassword);

type Row = Record<string, unknown>;

async function signedInClient(): Promise<SupabaseClient> {
  const client = createClient(url!, publishableKey!);
  const result = await client.auth.signInWithPassword({ email: teacherEmail!, password: teacherPassword! });
  if (result.error) throw result.error;
  return client;
}

async function currentDraft(client: SupabaseClient) {
  const workspace = await client.from("assessment_workspaces").select("id, purpose, total_marks, duration_minutes, current_version_id").eq("id", workspaceId!).single();
  if (workspace.error || !workspace.data) throw workspace.error ?? new Error("Assessment fixture workspace is unavailable");
  const version = await client.from("assessment_versions").select("version_number, content_json").eq("id", workspace.data.current_version_id).single();
  if (version.error || !version.data) throw version.error ?? new Error("Assessment fixture version is unavailable");
  return { workspace: workspace.data as Row, version: version.data as Row };
}

const describeConfigured = configured ? describe : describe.skip;

describeConfigured("Step 9 direct Assessment Studio RPC attacks", () => {
  it("does not allow a teacher to forge AI or SYSTEM authorship", async () => {
    const client = await signedInClient();
    const draft = await currentDraft(client);
    for (const forgedSource of ["AI", "SYSTEM"]) {
      const result = await client.rpc("create_assessment_version", {
        p_workspace_id: workspaceId,
        p_content_json: draft.version.content_json,
        p_expected_version: draft.version.version_number,
        p_change_source: forgedSource,
        p_change_summary: "forged source",
      });
      expect(result.error).toBeTruthy();
    }
  });

  it("rejects malformed JSON before it can become an assessment version", async () => {
    const client = await signedInClient();
    const draft = await currentDraft(client);
    const result = await client.rpc("create_assessment_version", {
      p_workspace_id: workspaceId,
      p_content_json: { title: "", purpose: draft.workspace.purpose, totalMarks: draft.workspace.total_marks, durationMinutes: draft.workspace.duration_minutes, blueprint: [], questions: "not-an-array" },
      p_expected_version: draft.version.version_number,
    });
    expect(result.error).toBeTruthy();
  });

  it.skipIf(!foreignSectionId)("rejects a foreign Teaching Section in the payload", async () => {
    const client = await signedInClient();
    const draft = await currentDraft(client);
    const content = structuredClone(draft.version.content_json as Row);
    const blueprint = { ...(content.blueprint as Row), participatingSectionIds: [foreignSectionId] };
    const result = await client.rpc("create_assessment_version", { p_workspace_id: workspaceId, p_content_json: { ...content, blueprint }, p_expected_version: draft.version.version_number });
    expect(result.error).toBeTruthy();
  });

  it.skipIf(!partialCanonicalId || !partialEvidenceId)("rejects arbitrary partial-scope curriculum IDs", async () => {
    const client = await signedInClient();
    const result = await client.rpc("confirm_assessment_partial_scope", { p_workspace_id: workspaceId, p_section_id: foreignSectionId || "00000000-0000-0000-0000-000000000000", p_canonical_id: partialCanonicalId, p_evidence_reference_id: partialEvidenceId, p_reason: "attack" });
    expect(result.error).toBeTruthy();
  });

  it.skipIf(!foreignCanonicalId)("rejects a canonical ID outside the bound subject profile", async () => {
    const client = await signedInClient();
    const draft = await currentDraft(client);
    const content = structuredClone(draft.version.content_json as Row);
    const blueprint = { ...(content.blueprint as Row), scopeCanonicalIds: [foreignCanonicalId] };
    const result = await client.rpc("create_assessment_version", { p_workspace_id: workspaceId, p_content_json: { ...content, blueprint }, p_expected_version: draft.version.version_number });
    expect(result.error).toBeTruthy();
  });

  it.skipIf(!foreignWorkspaceId)("does not expose a foreign-tenant workspace to the teacher", async () => {
    const client = await signedInClient();
    const result = await client.from("assessment_workspaces").select("id").eq("id", foreignWorkspaceId!);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});
