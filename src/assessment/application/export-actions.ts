"use server";

import { assessmentPayloadToCanonicalArtifact } from "@/artifacts/assessment";
import { loadAssessmentWorkspace } from "./queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function resolveAssessmentExport(workspaceId: string) {
  const data = await loadAssessmentWorkspace(workspaceId, `/workspace/teacher/assessments/${workspaceId}`, { exportOnly: true });
  if (data.workspace.status !== "FINAL") return { ok: false as const, error: "Only a finalised assessment can be exported." };
  if (data.profileResolution.state !== "RESOLVED" || !data.runtimeProfile?.exportAllowed || data.runtimeProfile.rightsState !== "CLEARED" || data.runtimeProfile.formalArtifactAllowed !== true) {
    return { ok: false as const, error: "Formal export is unavailable for the current assessment source configuration." };
  }
  const client = await createSupabaseServerClient();
  const [school, subject, sections] = await Promise.all([
    client.from("schools").select("name").eq("id", data.access.schoolId).single(),
    client.from("school_subjects").select("name").eq("id", data.workspace.school_subject_id).eq("school_id", data.access.schoolId).single(),
    client.from("teaching_sections").select("class_level_id, stream_id").eq("school_id", data.access.schoolId).in("id", data.sections.map((section) => String(section.teaching_section_id))),
  ]);
  if (school.error || !school.data || subject.error || !subject.data || sections.error) return { ok: false as const, error: "Assessment identity could not be verified for export." };
  const classLevelIds = [...new Set((sections.data ?? []).map((section) => section.class_level_id))];
  const streamIds = [...new Set((sections.data ?? []).map((section) => section.stream_id))];
  const [classLevels, streams] = await Promise.all([
    classLevelIds.length ? client.from("class_levels").select("id, name").in("id", classLevelIds) : Promise.resolve({ data: [], error: null }),
    streamIds.length ? client.from("streams").select("id, name").in("id", streamIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (classLevels.error || streams.error) return { ok: false as const, error: "Assessment class identity could not be verified for export." };
  const classLabel = [...new Set([...(classLevels.data ?? []).map((item) => String(item.name)), ...(streams.data ?? []).map((item) => String(item.name))])].join(" · ");
  const canonical = assessmentPayloadToCanonicalArtifact({ id: String(data.workspace.id), versionId: String(data.version.id), status: "FINAL", ownerScope: data.sections.map((section) => String(section.teaching_section_id)), curriculumAnchorIds: data.scopeItems.map((item) => String(item.canonical_id)), provenance: [{ category: "CURRICULUM", label: `${data.runtimeProfile.displayTitle} · ${data.runtimeProfile.authority}`, sourceId: data.runtimeProfile.sourceId || data.runtimeProfile.id, rightsState: data.runtimeProfile.rightsState }], payload: data.version.content_json });
  return { ok: true as const, canonical, schoolName: String(school.data.name), subjectName: String(subject.data.name), classLabel, workspace: data.workspace };
}
