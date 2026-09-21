"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AssessmentPayloadSchema } from "@/assessment/domain/types";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const createSchema = z.object({
  academicPeriodId: uuid,
  schoolSubjectId: uuid,
  curriculumSubjectProfileId: uuid,
  assessmentProfileId: uuid,
  purpose: z.enum(["FORMATIVE_CHECK", "CLASS_TEST", "DIAGNOSTIC", "REVISION_PRACTICE", "COMMON_STREAM_TEST", "INTERNAL_EXAM"]),
  title: z.string().trim().min(1).max(240),
  durationMinutes: z.coerce.number().int().positive().max(600),
  totalMarks: z.coerce.number().int().positive().max(1000),
  sectionIds: z.array(uuid).min(1).max(12),
});

function result(error: { message?: string } | null, fallback: string) { return error ? { ok: false as const, error: error.message || fallback } : { ok: true as const }; }

export async function createAssessmentWorkspace(input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const access = await requireWorkspaceAccess();
    const value = createSchema.parse(input);
    const client = await createSupabaseServerClient();
    const sectionResult = await client.from("teaching_sections").select("id, school_subject_id, academic_period_id").eq("school_id", access.schoolId).eq("teacher_membership_id", access.membershipId).eq("assignment_state", "CONFIRMED").eq("operational_status", "ACTIVE").in("id", value.sectionIds);
    if (sectionResult.error || !sectionResult.data || sectionResult.data.length !== value.sectionIds.length) return { ok: false, error: "Every participating Teaching Section must be assigned to you and active." };
    if (sectionResult.data.some((section) => section.school_subject_id !== value.schoolSubjectId || section.academic_period_id !== value.academicPeriodId)) return { ok: false, error: "Participating Teaching Sections must share the selected subject and academic period." };
    const profileResult = await client.from("knowledge_assessment_profiles").select("id, purpose, subject_profile_id, status").eq("id", value.assessmentProfileId).eq("purpose", value.purpose).eq("status", "ACTIVE").maybeSingle();
    if (profileResult.error || !profileResult.data || (profileResult.data.subject_profile_id && profileResult.data.subject_profile_id !== value.curriculumSubjectProfileId)) return { ok: false, error: "No active assessment profile applies to this purpose and subject." };
    const positions = await client.from("teaching_section_curriculum_position_events").select("id, teaching_section_id, canonical_id").eq("school_id", access.schoolId).in("teaching_section_id", value.sectionIds).order("confirmed_at", { ascending: false });
    if (positions.error) return { ok: false, error: "Confirmed curriculum position could not be resolved." };
    const bySection = value.sectionIds.map((sectionId) => [...new Set((positions.data ?? []).filter((item) => item.teaching_section_id === sectionId).map((item) => item.canonical_id))]);
    const eligible = value.purpose === "COMMON_STREAM_TEST" ? [...new Set(bySection[0] ?? [])].filter((id) => bySection.every((items) => items.includes(id))) : [...new Set(bySection.flat())];
    if (!eligible.length) return { ok: false, error: "No confirmed curriculum scope is available yet. Confirm classroom position before creating this assessment." };
    const content = { title: value.title, purpose: value.purpose, durationMinutes: value.durationMinutes, totalMarks: value.totalMarks, instructions: ["Answer all questions unless instructed otherwise."], blueprint: { participatingSectionIds: value.sectionIds, scopeCanonicalIds: eligible, expectedEvidence: "Teacher-marked responses", itemDistribution: {}, difficultyDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0 }, marksDistribution: {}, totalMarks: value.totalMarks, durationMinutes: value.durationMinutes, practicalRequirements: [], accessibilityConstraints: [], subjectConstraints: [], teacherNotes: "" }, questions: [] };
    const scopeItems = (positions.data ?? []).filter((item) => eligible.includes(item.canonical_id)).map((item) => ({ canonicalId: item.canonical_id, scopeState: "CONFIRMED_ELIGIBLE", evidenceType: "CONFIRMED_DELIVERY", evidenceReferenceId: item.id, sectionId: item.teaching_section_id }));
    const response = await client.rpc("create_assessment_workspace", { p_academic_period_id: value.academicPeriodId, p_school_subject_id: value.schoolSubjectId, p_curriculum_subject_profile_id: value.curriculumSubjectProfileId, p_assessment_profile_id: value.assessmentProfileId, p_purpose: value.purpose, p_title: value.title, p_duration_minutes: value.durationMinutes, p_total_marks: value.totalMarks, p_section_ids: value.sectionIds, p_scope_items: scopeItems, p_content_json: content });
    if (response.error || !response.data) return { ok: false, error: response.error?.message || "Assessment workspace could not be created." };
    revalidatePath("/workspace/teacher/assessments");
    return { ok: true, id: String((response.data as { workspaceId: string }).workspaceId) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Assessment workspace could not be created." }; }
}

export async function saveAssessmentVersion(workspaceId: string, content: unknown, expectedVersion: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireWorkspaceAccess();
    const payload = AssessmentPayloadSchema.parse(content);
    const client = await createSupabaseServerClient();
    const response = await client.rpc("create_assessment_version", { p_workspace_id: uuid.parse(workspaceId), p_content_json: payload, p_expected_version: expectedVersion, p_change_source: "TEACHER", p_change_summary: "Teacher edited assessment draft" });
    if (response.error) return { ok: false, error: response.error.message };
    revalidatePath(`/workspace/teacher/assessments/${workspaceId}`);
    revalidatePath("/workspace/teacher/assessments");
    void access;
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Assessment draft could not be saved." }; }
}

export async function finalizeAssessment(workspaceId: string, expectedVersion: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await createSupabaseServerClient();
    const response = await client.rpc("finalize_assessment_workspace", { p_workspace_id: uuid.parse(workspaceId), p_expected_version: expectedVersion });
    if (response.error) return { ok: false, error: response.error.message };
    revalidatePath(`/workspace/teacher/assessments/${workspaceId}`);
    revalidatePath("/workspace/teacher/assessments");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Assessment could not be finalised." }; }
}
