import "server-only";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assessmentPurposes, type AssessmentPayload, type AssessmentProfile, type ProfileResolution } from "@/assessment/domain/types";
import { resolveRuntimeAssessmentProfile } from "@/assessment/domain/profile";

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
  runtimeProfile: AssessmentProfile | null;
  profileResolution: ProfileResolution;
  partialScopeCandidates: Array<{ sectionId: string; canonicalId: string; evidenceReferenceId: string }>;
};

function records(value: unknown): Array<Record<string, unknown>> { return Array.isArray(value) ? value as Array<Record<string, unknown>> : []; }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }

async function loadRuntimeProfile(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, workspace: Record<string, unknown>, sectionIds: string[]): Promise<ProfileResolution> {
  const profileId = stringValue(workspace.assessment_profile_id);
  const subjectProfileId = stringValue(workspace.curriculum_subject_profile_id);
  const schoolSubjectId = stringValue(workspace.school_subject_id);
  const schoolId = stringValue(workspace.school_id);
  const assessmentDate = stringValue(workspace.assessment_date);
  const profileResult = await client.from("knowledge_assessment_profiles").select("id, display_title, purpose, regime, release_id, subject_profile_id, status, applicable_source_roles, allows_broader_scope, allows_partial_scope, requires_review").eq("id", profileId).maybeSingle();
  if (profileResult.error || !profileResult.data) return { state: "UNAVAILABLE", profile: null, explanation: "The governed assessment profile context could not be loaded." };
  const profileRow = profileResult.data as Record<string, unknown>;
  const [releaseResult, subjectProfileResult, subjectBindingResult, sectionBindingsResult, sourcesResult] = await Promise.all([
    client.from("knowledge_curriculum_releases").select("id, version_label, authority, status, effective_from, effective_to").eq("id", stringValue(profileRow.release_id)).maybeSingle(),
    client.from("knowledge_subject_profiles").select("id, governed_subject_id, education_level, status, runtime_status, release_id").eq("id", subjectProfileId).maybeSingle(),
    client.from("school_subject_curriculum_bindings").select("status, effective_from, effective_to").eq("school_id", schoolId).eq("school_subject_id", schoolSubjectId).eq("subject_profile_id", subjectProfileId).order("effective_from", { ascending: false }),
    client.from("teaching_section_curriculum_bindings").select("teaching_section_id, status, effective_from, effective_to").eq("school_id", schoolId).in("teaching_section_id", sectionIds).eq("subject_profile_id", subjectProfileId),
    client.from("knowledge_release_sources").select("release_id, source_id, source_role, subject_profile_id, status").eq("status", "APPROVED").eq("release_id", stringValue(profileRow.release_id)),
  ]);
  if (profileResult.error || releaseResult.error || subjectProfileResult.error || subjectBindingResult.error || sectionBindingsResult.error || sourcesResult.error || !profileResult.data || !releaseResult.data || !subjectProfileResult.data) {
    return { state: "UNAVAILABLE", profile: null, explanation: "The governed assessment profile context could not be loaded." };
  }
  const releaseRow = releaseResult.data as Record<string, unknown>;
  const subjectProfileRow = subjectProfileResult.data as Record<string, unknown>;
  const applicableRoles = new Set(Array.isArray(profileRow.applicable_source_roles) ? profileRow.applicable_source_roles.map((role) => stringValue(role)) : []);
  const releaseSources = records(sourcesResult.data).filter((source) => stringValue(source.release_id) === stringValue(profileRow.release_id) && (source.subject_profile_id == null || stringValue(source.subject_profile_id) === subjectProfileId) && (applicableRoles.size === 0 || applicableRoles.has(stringValue(source.source_role))));
  const sourceIds = [...new Set(releaseSources.map((source) => stringValue(source.source_id)).filter(Boolean))];
  const [sourceRowsResult, decisionsResult] = await Promise.all([
    sourceIds.length ? client.from("knowledge_sources").select("source_id, source_version, checksum_sha256, rights_status, production_use_status, external_ai_allowed, formal_artifact_allowed, export_allowed").in("source_id", sourceIds) : Promise.resolve({ data: [], error: null }),
    sourceIds.length ? client.from("knowledge_rights_decisions").select("source_id, source_checksum_sha256, rights_status, production_use_status, external_ai_allowed, formal_artifact_allowed, export_allowed, review_expires_at, decided_at, decision_id").in("source_id", sourceIds).order("decided_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (sourceRowsResult.error || decisionsResult.error) return { state: "UNAVAILABLE", profile: null, explanation: "The governed assessment source rights could not be loaded." };
  const decisionsBySource = new Map<string, Record<string, unknown>>();
  for (const decision of records(decisionsResult.data)) {
    const key = `${stringValue(decision.source_id)}:${stringValue(decision.source_checksum_sha256)}`;
    if (!decisionsBySource.has(key)) decisionsBySource.set(key, decision);
  }
  const sources = records(sourceRowsResult.data).map((source) => {
    const decision = decisionsBySource.get(`${stringValue(source.source_id)}:${stringValue(source.checksum_sha256)}`);
    const current = decision && (!decision.review_expires_at || stringValue(decision.review_expires_at) >= assessmentDate) ? decision : null;
    return {
      sourceId: stringValue(source.source_id),
      sourceVersion: source.source_version == null ? null : stringValue(source.source_version),
      rightsStatus: (current ? stringValue(current.rights_status) : "REVIEW_REQUIRED") as AssessmentProfile["rightsState"],
      productionUseStatus: (current ? stringValue(current.production_use_status) : "PERMISSION_PENDING") as NonNullable<AssessmentProfile["productionUseStatus"]>,
      externalAiAllowed: Boolean(current?.external_ai_allowed),
      formalArtifactAllowed: Boolean(current?.formal_artifact_allowed),
      exportAllowed: Boolean(current?.export_allowed),
    };
  });
  return resolveRuntimeAssessmentProfile({
    profile: { id: profileId, displayTitle: stringValue(profileRow.display_title), purpose: stringValue(profileRow.purpose) as AssessmentProfile["purpose"], regime: stringValue(profileRow.regime), releaseId: stringValue(profileRow.release_id), subjectProfileId: profileRow.subject_profile_id == null ? null : stringValue(profileRow.subject_profile_id), status: stringValue(profileRow.status), allowsBroaderScope: Boolean(profileRow.allows_broader_scope), allowsPartialScope: Boolean(profileRow.allows_partial_scope), requiresReview: Boolean(profileRow.requires_review) },
    release: { id: stringValue(releaseRow.id), versionLabel: stringValue(releaseRow.version_label), authority: stringValue(releaseRow.authority), status: stringValue(releaseRow.status), effectiveFrom: stringValue(releaseRow.effective_from), effectiveTo: releaseRow.effective_to == null ? null : stringValue(releaseRow.effective_to) },
    subjectProfile: { id: stringValue(subjectProfileRow.id), governedSubjectId: stringValue(subjectProfileRow.governed_subject_id), educationLevel: stringValue(subjectProfileRow.education_level), status: stringValue(subjectProfileRow.status), runtimeStatus: stringValue(subjectProfileRow.runtime_status) },
    subjectProfileId,
    subjectId: stringValue(subjectProfileRow.governed_subject_id),
    sectionIds,
    subjectBinding: records(subjectBindingResult.data).map((row) => ({ status: stringValue(row.status), effectiveFrom: stringValue(row.effective_from), effectiveTo: row.effective_to == null ? null : stringValue(row.effective_to) })).find((binding) => binding.effectiveFrom <= assessmentDate && (binding.effectiveTo === null || binding.effectiveTo >= assessmentDate)) ?? null,
    sectionBindings: records(sectionBindingsResult.data).map((row) => ({ sectionId: stringValue(row.teaching_section_id), status: stringValue(row.status), effectiveFrom: stringValue(row.effective_from), effectiveTo: row.effective_to == null ? null : stringValue(row.effective_to) })),
    assessmentDate,
    sources,
  });
}

export async function loadAssessmentWorkspace(workspaceId: string): Promise<AssessmentWorkspaceData> {
  const access = await requireWorkspaceAccess();
  const client = await createSupabaseServerClient();
  const workspaceResult = await client.from("assessment_workspaces").select("*").eq("id", workspaceId).eq("school_id", access.schoolId).single();
  if (workspaceResult.error || !workspaceResult.data) throw new Error("Assessment workspace could not be loaded.");
  const [sections, scopeItems, versions, profile] = await Promise.all([
    client.from("assessment_workspace_sections").select("teaching_section_id").eq("assessment_workspace_id", workspaceId).eq("school_id", access.schoolId),
    client.from("assessment_scope_items").select("id, canonical_id, scope_state, evidence_type, evidence_reference_id, classroom_evidence_id, curriculum_position_event_id, section_id, override_reason, confirmed_by_membership_id, created_at").eq("assessment_workspace_id", workspaceId).eq("school_id", access.schoolId).order("canonical_id"),
    client.from("assessment_versions").select("id, version_number, content_json, change_source, created_at").eq("assessment_workspace_id", workspaceId).eq("school_id", access.schoolId).order("version_number", { ascending: false }),
    client.from("knowledge_assessment_profiles").select("id, display_title, purpose, regime, status, release_id, subject_profile_id").eq("id", workspaceResult.data.assessment_profile_id).maybeSingle(),
  ]);
  if (sections.error || scopeItems.error || versions.error || profile.error) throw new Error("Assessment workspace context could not be loaded.");
  const current = (versions.data ?? []).find((item) => item.id === workspaceResult.data.current_version_id) ?? versions.data?.[0];
  if (!current) throw new Error("Assessment workspace has no current version.");
  const sectionIds = (sections.data ?? []).map((section) => String(section.teaching_section_id));
  const [runtimeProfile, classroomEvents, positionEvents] = await Promise.all([
    loadRuntimeProfile(client, workspaceResult.data, sectionIds),
    sectionIds.length ? client.from("classroom_events").select("id, teaching_section_id, outcome, occurred_at, supersedes_event_id").eq("school_id", access.schoolId).in("teaching_section_id", sectionIds).order("occurred_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    sectionIds.length ? client.from("teaching_section_curriculum_position_events").select("id, teaching_section_id, canonical_id, supersedes_event_id, confirmed_at").eq("school_id", access.schoolId).in("teaching_section_id", sectionIds).eq("subject_profile_id", String(workspaceResult.data.curriculum_subject_profile_id)).order("confirmed_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (classroomEvents.error || positionEvents.error) throw new Error("Assessment classroom continuity context could not be loaded.");
  const supersededClassroomIds = new Set(records(classroomEvents.data).map((event) => stringValue(event.supersedes_event_id)).filter(Boolean));
  const currentPartialBySection = new Map<string, Record<string, unknown>>();
  for (const event of records(classroomEvents.data)) if (!supersededClassroomIds.has(stringValue(event.id)) && stringValue(event.outcome) === "PARTIALLY_DELIVERED" && !currentPartialBySection.has(stringValue(event.teaching_section_id))) currentPartialBySection.set(stringValue(event.teaching_section_id), event);
  const supersededPositionIds = new Set(records(positionEvents.data).map((event) => stringValue(event.supersedes_event_id)).filter(Boolean));
  const currentPositionBySection = new Map<string, Record<string, unknown>>();
  for (const event of records(positionEvents.data)) if (!supersededPositionIds.has(stringValue(event.id)) && !currentPositionBySection.has(stringValue(event.teaching_section_id))) currentPositionBySection.set(stringValue(event.teaching_section_id), event);
  const partialScopeCandidates = [...currentPartialBySection.entries()].flatMap(([sectionId, classroomEvent]) => {
    const position = currentPositionBySection.get(sectionId);
    if (!position || !runtimeProfile.profile?.allowsPartialScope) return [];
    return [{ sectionId, canonicalId: stringValue(position.canonical_id), evidenceReferenceId: stringValue(classroomEvent.id) }];
  });
  return { access, workspace: workspaceResult.data, sections: sections.data ?? [], scopeItems: scopeItems.data ?? [], version: current as AssessmentWorkspaceData["version"], versions: versions.data ?? [], profile: profile.data ?? null, runtimeProfile: runtimeProfile.profile, profileResolution: runtimeProfile, partialScopeCandidates };
}
