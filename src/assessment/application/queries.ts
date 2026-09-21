import "server-only";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assessmentPurposes, type AssessmentPayload } from "@/assessment/domain/types";

export type AssessmentStudioListData = {
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  sections: Array<Record<string, unknown>>;
  subjects: Array<Record<string, unknown>>;
  periods: Array<Record<string, unknown>>;
  profiles: Array<Record<string, unknown>>;
  workspaces: Array<Record<string, unknown>>;
  purposes: typeof assessmentPurposes;
};

export async function loadAssessmentStudioList(): Promise<AssessmentStudioListData> {
  const access = await requireWorkspaceAccess();
  if (!access.roles.includes("TEACHER")) throw new Error("Assessment Studio is available to assigned teachers.");
  const client = await createSupabaseServerClient();
  const [sections, subjects, periods, profiles, workspaces] = await Promise.all([
    client.from("teaching_sections").select("id, academic_period_id, school_subject_id, class_level_id, stream_id, assignment_state, operational_status").eq("school_id", access.schoolId).eq("teacher_membership_id", access.membershipId).eq("assignment_state", "CONFIRMED").eq("operational_status", "ACTIVE"),
    client.from("school_subjects").select("id, name, code").eq("school_id", access.schoolId).order("name"),
    client.from("academic_periods").select("id, name, academic_year, starts_on, ends_on").eq("school_id", access.schoolId).order("starts_on", { ascending: false }),
    client.from("knowledge_assessment_profiles").select("id, release_id, subject_profile_id, assessment_key, display_title, purpose, regime, status").eq("status", "ACTIVE").in("purpose", [...assessmentPurposes]),
    client.from("assessment_workspaces").select("id, title, purpose, status, duration_minutes, total_marks, current_version_id, updated_at").eq("school_id", access.schoolId).order("updated_at", { ascending: false }),
  ]);
  for (const result of [sections, subjects, periods, profiles, workspaces]) if (result.error) throw new Error("Assessment Studio data could not be loaded.");
  return { access, sections: sections.data ?? [], subjects: subjects.data ?? [], periods: periods.data ?? [], profiles: profiles.data ?? [], workspaces: workspaces.data ?? [], purposes: assessmentPurposes };
}

export type AssessmentWorkspaceData = {
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  workspace: Record<string, unknown>;
  sections: Array<Record<string, unknown>>;
  scopeItems: Array<Record<string, unknown>>;
  version: { id: string; version_number: number; content_json: AssessmentPayload; change_source: string; created_at: string };
  versions: Array<Record<string, unknown>>;
  profile: Record<string, unknown> | null;
};

export async function loadAssessmentWorkspace(workspaceId: string): Promise<AssessmentWorkspaceData> {
  const access = await requireWorkspaceAccess();
  const client = await createSupabaseServerClient();
  const workspaceResult = await client.from("assessment_workspaces").select("*").eq("id", workspaceId).eq("school_id", access.schoolId).single();
  if (workspaceResult.error || !workspaceResult.data) throw new Error("Assessment workspace could not be loaded.");
  const [sections, scopeItems, versions, profile] = await Promise.all([
    client.from("assessment_workspace_sections").select("teaching_section_id").eq("assessment_workspace_id", workspaceId).eq("school_id", access.schoolId),
    client.from("assessment_scope_items").select("id, canonical_id, scope_state, evidence_type, evidence_reference_id, section_id, override_reason, confirmed_by_membership_id, created_at").eq("assessment_workspace_id", workspaceId).eq("school_id", access.schoolId).order("canonical_id"),
    client.from("assessment_versions").select("id, version_number, content_json, change_source, created_at").eq("assessment_workspace_id", workspaceId).eq("school_id", access.schoolId).order("version_number", { ascending: false }),
    client.from("knowledge_assessment_profiles").select("id, display_title, purpose, regime, status, release_id, subject_profile_id").eq("id", workspaceResult.data.assessment_profile_id).maybeSingle(),
  ]);
  if (sections.error || scopeItems.error || versions.error || profile.error) throw new Error("Assessment workspace context could not be loaded.");
  const current = (versions.data ?? []).find((item) => item.id === workspaceResult.data.current_version_id) ?? versions.data?.[0];
  if (!current) throw new Error("Assessment workspace has no current version.");
  return { access, workspace: workspaceResult.data, sections: sections.data ?? [], scopeItems: scopeItems.data ?? [], version: current as AssessmentWorkspaceData["version"], versions: versions.data ?? [], profile: profile.data ?? null };
}
