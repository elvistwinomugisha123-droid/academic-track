import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

type Fixture = {
  periodId: string; schoolSubjectId: string; subjectProfileId: string; assessmentProfileId: string;
  sectionAId: string; sectionBId: string; foreignSectionId: string; teacherEmail: string; teacherPassword: string;
  canonicalIds: string[]; foreignCanonicalId: string; assessmentDate: string; evidence: Record<string, string>; positions: Record<string, string>;
};

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const fixturePath = process.env.TEST_ASSESSMENT_FIXTURE_FILE ?? "test-artifacts/assessment-fixture.json";
const configured = Boolean(url && publishableKey && process.env.TEST_ASSESSMENT_FIXTURE);
const describeConfigured = configured ? describe : describe.skip;

async function loadFixture(): Promise<Fixture> { return JSON.parse(await readFile(fixturePath, "utf8")) as Fixture; }
async function signedInClient(fixture: Fixture): Promise<SupabaseClient> {
  const client = createClient(url!, publishableKey!);
  const result = await client.auth.signInWithPassword({ email: fixture.teacherEmail, password: fixture.teacherPassword });
  if (result.error) throw result.error;
  return client;
}
function content(fixture: Fixture, scopeCanonicalIds: string[] = [], sectionIds: string[] = [fixture.sectionAId]) {
  return { title: "Synthetic assessment", purpose: "CLASS_TEST", totalMarks: 20, durationMinutes: 45, blueprint: { participatingSectionIds: sectionIds, scopeCanonicalIds }, questions: [] };
}
function item(sectionId: string, canonicalId: string, evidenceId: string, positionId?: string) {
  return { canonicalId, scopeState: "CONFIRMED_ELIGIBLE", evidenceType: "CONFIRMED_DELIVERY", evidenceReferenceId: evidenceId, classroomEvidenceId: evidenceId, curriculumPositionEventId: positionId, sectionId };
}
async function createWorkspace(client: SupabaseClient, fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return client.rpc("create_assessment_workspace", {
    p_academic_period_id: fixture.periodId, p_school_subject_id: fixture.schoolSubjectId, p_curriculum_subject_profile_id: fixture.subjectProfileId,
    p_assessment_profile_id: fixture.assessmentProfileId, p_purpose: "CLASS_TEST", p_title: "Synthetic assessment", p_duration_minutes: 45,
    p_total_marks: 20, p_section_ids: [fixture.sectionAId], p_scope_items: [], p_content_json: content(fixture), p_assessment_date: fixture.assessmentDate, ...overrides,
  });
}

describeConfigured("Step 9 direct Assessment Studio RPC attacks and taught-scope truth", () => {
  it("requires classroom delivery evidence rather than a curriculum-position event alone", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture);
    const result = await createWorkspace(client, fixture, { p_scope_items: [item(fixture.sectionAId, fixture.canonicalIds[0], "00000000-0000-0000-0000-000000000000", fixture.positions[`${fixture.sectionAId}:${fixture.canonicalIds[0]}:0`])] });
    expect(result.error).toBeTruthy();
  });

  it("accepts a delivered event only when its lesson-preparation anchor matches", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture); const canonicalId = fixture.canonicalIds[0];
    const evidenceId = fixture.evidence[`${fixture.sectionAId}:${canonicalId}:DELIVERED`];
    const result = await createWorkspace(client, fixture, { p_scope_items: [item(fixture.sectionAId, canonicalId, evidenceId, fixture.positions[`${fixture.sectionAId}:${canonicalId}:0`])], p_content_json: content(fixture, [canonicalId]) });
    expect(result.error).toBeNull(); expect(result.data?.workspaceId).toBeTruthy();
  });

  it("rejects NOT_DELIVERED and CHANGED events as taught scope", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture); const canonicalId = fixture.canonicalIds[3];
    for (const outcome of ["NOT_DELIVERED", "CHANGED"]) {
      const result = await createWorkspace(client, fixture, { p_scope_items: [item(fixture.sectionAId, canonicalId, fixture.evidence[`${fixture.sectionAId}:${canonicalId}:${outcome}`])] });
      expect(result.error).toBeTruthy();
    }
  });

  it("requires explicit teacher confirmation for a partial classroom event", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture); const canonicalId = fixture.canonicalIds[3];
    const partialEvidenceId = fixture.evidence[`${fixture.sectionAId}:${canonicalId}:PARTIALLY_DELIVERED`];
    const workspace = await createWorkspace(client, fixture); expect(workspace.error).toBeNull();
    const arbitrary = await client.rpc("confirm_assessment_partial_scope", { p_workspace_id: workspace.data.workspaceId, p_section_id: fixture.sectionAId, p_canonical_id: fixture.canonicalIds[0], p_evidence_reference_id: partialEvidenceId, p_reason: "attack" });
    expect(arbitrary.error).toBeTruthy();
    const confirmed = await client.rpc("confirm_assessment_partial_scope", { p_workspace_id: workspace.data.workspaceId, p_section_id: fixture.sectionAId, p_canonical_id: canonicalId, p_evidence_reference_id: partialEvidenceId, p_reason: "Synthetic teacher confirmation" });
    expect(confirmed.error).toBeNull();
  });

  it("adds a partially covered anchor to a common test only after both streams confirm it", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture); const canonicalId = fixture.canonicalIds[3]; const a = fixture.canonicalIds[0];
    const workspace = await client.rpc("create_assessment_workspace", { p_academic_period_id: fixture.periodId, p_school_subject_id: fixture.schoolSubjectId, p_curriculum_subject_profile_id: fixture.subjectProfileId, p_assessment_profile_id: fixture.assessmentProfileId, p_purpose: "COMMON_STREAM_TEST", p_title: "Synthetic partial common test", p_duration_minutes: 45, p_total_marks: 20, p_section_ids: [fixture.sectionAId, fixture.sectionBId], p_scope_items: [item(fixture.sectionAId, a, fixture.evidence[`${fixture.sectionAId}:${a}:DELIVERED`]), item(fixture.sectionBId, a, fixture.evidence[`${fixture.sectionBId}:${a}:DELIVERED`])], p_content_json: content(fixture, [a], [fixture.sectionAId, fixture.sectionBId]), p_assessment_date: fixture.assessmentDate });
    expect(workspace.error).toBeNull();
    const first = await client.rpc("confirm_assessment_partial_scope", { p_workspace_id: workspace.data.workspaceId, p_section_id: fixture.sectionAId, p_canonical_id: canonicalId, p_evidence_reference_id: fixture.evidence[`${fixture.sectionAId}:${canonicalId}:PARTIALLY_DELIVERED`], p_reason: "Synthetic stream A confirmation" });
    expect(first.error).toBeNull();
    const beforeSecond = await client.from("assessment_versions").select("content_json").eq("assessment_workspace_id", workspace.data.workspaceId).order("version_number", { ascending: false }).limit(1).single();
    expect(beforeSecond.data?.content_json?.blueprint?.scopeCanonicalIds).not.toContain(canonicalId);
    const second = await client.rpc("confirm_assessment_partial_scope", { p_workspace_id: workspace.data.workspaceId, p_section_id: fixture.sectionBId, p_canonical_id: canonicalId, p_evidence_reference_id: fixture.evidence[`${fixture.sectionBId}:${canonicalId}:PARTIALLY_DELIVERED`], p_reason: "Synthetic stream B confirmation" });
    expect(second.error).toBeNull();
    const afterSecond = await client.from("assessment_versions").select("content_json").eq("assessment_workspace_id", workspace.data.workspaceId).order("version_number", { ascending: false }).limit(1).single();
    expect(afterSecond.data?.content_json?.blueprint?.scopeCanonicalIds).toContain(canonicalId);
  });

  it("keeps accumulated anchors and computes common scope as the stream intersection", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture); const [a, b] = fixture.canonicalIds;
    const rows = [item(fixture.sectionAId, a, fixture.evidence[`${fixture.sectionAId}:${a}:DELIVERED`]), item(fixture.sectionAId, b, fixture.evidence[`${fixture.sectionAId}:${b}:DELIVERED`]), item(fixture.sectionBId, a, fixture.evidence[`${fixture.sectionBId}:${a}:DELIVERED`]), item(fixture.sectionBId, b, fixture.evidence[`${fixture.sectionBId}:${b}:DELIVERED`])];
    const result = await client.rpc("create_assessment_workspace", { p_academic_period_id: fixture.periodId, p_school_subject_id: fixture.schoolSubjectId, p_curriculum_subject_profile_id: fixture.subjectProfileId, p_assessment_profile_id: fixture.assessmentProfileId, p_purpose: "COMMON_STREAM_TEST", p_title: "Synthetic common test", p_duration_minutes: 45, p_total_marks: 20, p_section_ids: [fixture.sectionAId, fixture.sectionBId], p_scope_items: rows, p_content_json: content(fixture, [a, b], [fixture.sectionAId, fixture.sectionBId]), p_assessment_date: fixture.assessmentDate });
    expect(result.error).toBeNull();
    const scope = await client.from("assessment_scope_items").select("canonical_id, section_id").eq("assessment_workspace_id", result.data.workspaceId);
    expect(scope.error).toBeNull(); expect(scope.data?.map((row) => row.canonical_id).sort()).toEqual([a, a, b, b].sort());
  });

  it("rejects an assessment date outside the selected academic period", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture);
    expect((await createWorkspace(client, fixture, { p_assessment_date: "2027-01-01" })).error).toBeTruthy();
  });

  it("rejects malformed assessment JSON through the direct version RPC", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture); const canonicalId = fixture.canonicalIds[0]; const evidenceId = fixture.evidence[`${fixture.sectionAId}:${canonicalId}:DELIVERED`];
    const workspace = await createWorkspace(client, fixture, { p_scope_items: [item(fixture.sectionAId, canonicalId, evidenceId)] }); expect(workspace.error).toBeNull();
    const current = await client.from("assessment_versions").select("version_number").eq("assessment_workspace_id", workspace.data.workspaceId).order("version_number", { ascending: false }).limit(1).single();
    expect((await client.rpc("create_assessment_version", { p_workspace_id: workspace.data.workspaceId, p_content_json: { title: "", purpose: "CLASS_TEST", totalMarks: 20, durationMinutes: 45, blueprint: [], questions: "not-an-array" }, p_expected_version: current.data?.version_number })).error).toBeTruthy();
  });

  it("rejects foreign sections, foreign-profile canonical IDs, and forbidden broader scope", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture); const canonicalId = fixture.canonicalIds[0]; const evidenceId = fixture.evidence[`${fixture.sectionAId}:${canonicalId}:DELIVERED`];
    expect((await createWorkspace(client, fixture, { p_section_ids: [fixture.foreignSectionId] })).error).toBeTruthy();
    expect((await createWorkspace(client, fixture, { p_scope_items: [item(fixture.sectionAId, fixture.foreignCanonicalId, evidenceId)] })).error).toBeTruthy();
    expect((await createWorkspace(client, fixture, { p_scope_items: [{ ...item(fixture.sectionAId, canonicalId, evidenceId), scopeState: "BROADER_PROFILE_PERMITTED" }] })).error).toBeTruthy();
  });

  it("stores manual versions as TEACHER and rejects browser-authored AI/SYSTEM source claims", async () => {
    const fixture = await loadFixture(); const client = await signedInClient(fixture); const canonicalId = fixture.canonicalIds[0]; const evidenceId = fixture.evidence[`${fixture.sectionAId}:${canonicalId}:DELIVERED`];
    const workspace = await createWorkspace(client, fixture, { p_scope_items: [item(fixture.sectionAId, canonicalId, evidenceId)] }); expect(workspace.error).toBeNull();
    const current = await client.from("assessment_versions").select("version_number, content_json").eq("assessment_workspace_id", workspace.data.workspaceId).order("version_number", { ascending: false }).limit(1).single(); expect(current.error).toBeNull(); if (current.error || !current.data) throw current.error ?? new Error("Synthetic fixture version is missing");
    const manual = await client.rpc("create_assessment_version", { p_workspace_id: workspace.data.workspaceId, p_content_json: current.data.content_json, p_expected_version: current.data.version_number, p_change_summary: "Synthetic manual save" });
    expect(manual.error).toBeNull();
    const saved = await client.from("assessment_versions").select("change_source").eq("id", manual.data.versionId).single(); expect(saved.data?.change_source).toBe("TEACHER");
    for (const forgedSource of ["AI", "SYSTEM"]) expect((await client.rpc("create_assessment_version", { p_workspace_id: workspace.data.workspaceId, p_content_json: current.data.content_json, p_expected_version: manual.data.versionNumber, p_change_source: forgedSource })).error).toBeTruthy();
  });
});
