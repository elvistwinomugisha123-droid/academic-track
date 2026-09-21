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
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Assessment date must be YYYY-MM-DD."),
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
    const [classroomEvents, preparations, scheduledLessons] = await Promise.all([
      client.from("classroom_events").select("id, scheduled_lesson_id, teaching_section_id, outcome, occurred_at, supersedes_event_id").eq("school_id", access.schoolId).in("teaching_section_id", value.sectionIds).order("occurred_at", { ascending: false }),
      client.from("lesson_preparations").select("scheduled_lesson_id, teaching_section_id, curriculum_position_event_id, curriculum_canonical_id, curriculum_profile_id").eq("school_id", access.schoolId).in("teaching_section_id", value.sectionIds),
      client.from("scheduled_lessons").select("id, academic_period_id, scheduled_date").eq("school_id", access.schoolId).in("teaching_section_id", value.sectionIds).eq("academic_period_id", value.academicPeriodId).lte("scheduled_date", value.assessmentDate),
    ]);
    if (classroomEvents.error || preparations.error || scheduledLessons.error) return { ok: false, error: "Classroom delivery evidence could not be resolved." };
    const scheduledLessonIds = new Set((scheduledLessons.data ?? []).map((lesson) => lesson.id));
    const supersededClassroomIds = new Set((classroomEvents.data ?? []).map((event) => event.supersedes_event_id).filter(Boolean));
    const preparationByLesson = new Map((preparations.data ?? []).map((preparation) => [preparation.scheduled_lesson_id, preparation]));
    const deliveryRows = (classroomEvents.data ?? []).filter((event) => !supersededClassroomIds.has(event.id) && scheduledLessonIds.has(event.scheduled_lesson_id)).flatMap((event) => {
      const preparation = preparationByLesson.get(event.scheduled_lesson_id);
      if (!preparation || preparation.curriculum_profile_id !== value.curriculumSubjectProfileId || !preparation.curriculum_canonical_id) return [];
      return [{ ...event, preparation }];
    });
    const deliveredRows = deliveryRows.filter((event) => event.outcome === "DELIVERED");
    const partialRows = deliveryRows.filter((event) => event.outcome === "PARTIALLY_DELIVERED");
    const bySection = value.sectionIds.map((sectionId) => [...new Set(deliveredRows.filter((item) => item.teaching_section_id === sectionId).map((item) => item.preparation.curriculum_canonical_id).filter(Boolean))]);
    const eligible = value.purpose === "COMMON_STREAM_TEST" ? [...new Set(bySection[0] ?? [])].filter((id) => bySection.every((items) => items.includes(id))) : [...new Set(bySection.flat())];
    if (!eligible.length && !partialRows.length) return { ok: false, error: "No delivered classroom evidence with a matching lesson preparation is available yet." };
    const content = { title: value.title, purpose: value.purpose, durationMinutes: value.durationMinutes, totalMarks: value.totalMarks, instructions: ["Answer all questions unless instructed otherwise."], blueprint: { participatingSectionIds: value.sectionIds, scopeCanonicalIds: eligible, expectedEvidence: "Teacher-marked responses", itemDistribution: {}, difficultyDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0 }, marksDistribution: {}, totalMarks: value.totalMarks, durationMinutes: value.durationMinutes, practicalRequirements: [], accessibilityConstraints: [], subjectConstraints: [], teacherNotes: "" }, questions: [] };
    const seen = new Set<string>();
    const scopeItems = deliveredRows.filter((item) => eligible.includes(item.preparation.curriculum_canonical_id || "")).filter((item) => { const key = `${item.teaching_section_id}:${item.preparation.curriculum_canonical_id}`; if (seen.has(key)) return false; seen.add(key); return true; }).map((item) => ({ canonicalId: item.preparation.curriculum_canonical_id, scopeState: "CONFIRMED_ELIGIBLE", evidenceType: "CONFIRMED_DELIVERY", evidenceReferenceId: item.id, classroomEvidenceId: item.id, curriculumPositionEventId: item.preparation.curriculum_position_event_id, sectionId: item.teaching_section_id }));
    const response = await client.rpc("create_assessment_workspace", { p_academic_period_id: value.academicPeriodId, p_school_subject_id: value.schoolSubjectId, p_curriculum_subject_profile_id: value.curriculumSubjectProfileId, p_assessment_profile_id: value.assessmentProfileId, p_purpose: value.purpose, p_title: value.title, p_duration_minutes: value.durationMinutes, p_total_marks: value.totalMarks, p_section_ids: value.sectionIds, p_scope_items: scopeItems, p_content_json: content, p_assessment_date: value.assessmentDate });
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
    const response = await client.rpc("create_assessment_version", { p_workspace_id: uuid.parse(workspaceId), p_content_json: payload, p_expected_version: expectedVersion, p_change_summary: "Teacher edited assessment draft" });
    if (response.error) return { ok: false, error: response.error.message };
    revalidatePath(`/workspace/teacher/assessments/${workspaceId}`);
    revalidatePath("/workspace/teacher/assessments");
    void access;
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Assessment draft could not be saved." }; }
}

export async function confirmPartialAssessmentScope(workspaceId: string, sectionId: string, canonicalId: string, evidenceReferenceId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireWorkspaceAccess();
    const client = await createSupabaseServerClient();
    const response = await client.rpc("confirm_assessment_partial_scope", { p_workspace_id: uuid.parse(workspaceId), p_section_id: uuid.parse(sectionId), p_canonical_id: z.string().trim().min(1).parse(canonicalId), p_evidence_reference_id: uuid.parse(evidenceReferenceId), p_reason: "Teacher confirmed this partially covered curricular portion is assessable." });
    if (response.error) return { ok: false, error: response.error.message };
    revalidatePath(`/workspace/teacher/assessments/${workspaceId}`);
    revalidatePath("/workspace/teacher/assessments");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Partial scope could not be confirmed." }; }
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

export async function submitAssessmentForReview(workspaceId: string, expectedVersion: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await createSupabaseServerClient();
    const response = await client.rpc("submit_assessment_for_review", { p_workspace_id: uuid.parse(workspaceId), p_expected_version: expectedVersion });
    if (response.error) return { ok: false, error: response.error.message };
    revalidatePath(`/workspace/teacher/assessments/${workspaceId}`);
    revalidatePath("/workspace/teacher/assessments");
    revalidatePath("/workspace/leadership/hod");
    revalidatePath("/workspace/leadership/dos");
    revalidatePath("/workspace/leadership/principal");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Assessment could not be submitted for review." }; }
}

export async function reviewAssessmentWorkspace(workspaceId: string, decision: "APPROVE" | "RETURN", reason?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await createSupabaseServerClient();
    const response = await client.rpc("review_assessment_workspace", { p_workspace_id: uuid.parse(workspaceId), p_decision: decision, p_reason: reason?.trim() || null });
    if (response.error) return { ok: false, error: response.error.message };
    revalidatePath(`/workspace/leadership/assessments/${workspaceId}`);
    revalidatePath("/workspace/leadership/hod");
    revalidatePath("/workspace/leadership/dos");
    revalidatePath("/workspace/leadership/principal");
    revalidatePath(`/workspace/teacher/assessments/${workspaceId}`);
    revalidatePath("/workspace/teacher/assessments");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Assessment review could not be recorded." }; }
}
