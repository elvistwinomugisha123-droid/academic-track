"use server";

import { assessmentPayloadToCanonicalArtifact } from "@/artifacts/assessment";
import { loadAssessmentWorkspace } from "./queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function resolveAssessmentExport(workspaceId: string) {
  const data = await loadAssessmentWorkspace(workspaceId);
  if (data.workspace.status !== "FINAL") return { ok: false as const, error: "Only a finalised assessment can be exported." };
  const school = await (await createSupabaseServerClient()).from("schools").select("name").eq("id", data.access.schoolId).single();
  if (school.error || !school.data) return { ok: false as const, error: "School identity could not be verified for export." };
  const canonical = assessmentPayloadToCanonicalArtifact({ id: String(data.workspace.id), versionId: String(data.version.id), status: "FINAL", ownerScope: data.sections.map((section) => String(section.teaching_section_id)), curriculumAnchorIds: data.scopeItems.map((item) => String(item.canonical_id)), provenance: [{ category: "CURRICULUM", label: String(data.profile?.display_title || "Active assessment profile"), sourceId: String(data.profile?.id || "") }], payload: data.version.content_json });
  return { ok: true as const, canonical, schoolName: String(school.data.name), workspace: data.workspace };
}
