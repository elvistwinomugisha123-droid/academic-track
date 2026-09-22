"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTeachingSectionCurriculumPosition } from "@/knowledge/curriculum-bindings";
import { createPostgresKnowledgeClient } from "@/knowledge/db/client";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { userFacingError } from "@/lib/user-facing-error";
import { loadLessonReadinessData } from "@/teacher/application/queries";

const uuid = z.string().uuid();
const preparationSchema = z.object({
  scheduledLessonId: uuid,
  version: z.number().int().positive().nullable().optional(),
  lessonFocus: z.string().trim().max(240),
  teacherNotes: z.string().trim().max(2000),
  intendedCoverage: z.string().trim().max(1200),
  preparationNotes: z.string().trim().max(1200),
});

const positionSchema = z.object({
  teachingSectionId: uuid,
  canonicalId: z.string().trim().min(1),
  positionKind: z.enum(["TOPIC", "LEARNING_OUTCOME"]),
  correctionReason: z.string().trim().max(240).optional(),
});

type ActionResult = { ok: true; id: string; version?: number } | { ok: false; error: string };

async function assignedTeacherSection(sectionId: string, schoolId: string, membershipId: string) {
  const client = await createSupabaseServerClient();
  const result = await client.from("teaching_sections").select("id, teacher_membership_id, assignment_state, operational_status").eq("id", sectionId).eq("school_id", schoolId).eq("teacher_membership_id", membershipId).eq("assignment_state", "CONFIRMED").eq("operational_status", "ACTIVE").maybeSingle();
  if (result.error || !result.data) throw new Error("This Teaching Section is not assigned to the active teacher.");
  return client;
}

async function lessonOwnership(lessonId: string, schoolId: string, membershipId: string) {
  const client = await createSupabaseServerClient();
  const lessonResult = await client.from("scheduled_lessons").select("id, teaching_section_id, school_id").eq("id", lessonId).eq("school_id", schoolId).maybeSingle();
  if (lessonResult.error || !lessonResult.data) throw new Error("Scheduled lesson not found in this school.");
  const sectionResult = await client.from("teaching_sections").select("id, teacher_membership_id, assignment_state, operational_status").eq("id", lessonResult.data.teaching_section_id).eq("school_id", schoolId).eq("teacher_membership_id", membershipId).eq("assignment_state", "CONFIRMED").eq("operational_status", "ACTIVE").maybeSingle();
  if (sectionResult.error || !sectionResult.data) throw new Error("This scheduled lesson is not assigned to the active teacher.");
  return { client, lesson: lessonResult.data as { id: string; teaching_section_id: string; school_id: string } };
}

function contextSnapshot(data: Awaited<ReturnType<typeof loadLessonReadinessData>>) {
  return {
    capturedAt: new Date().toISOString(),
    teachingSection: { id: data.lesson.section.id, subject: data.lesson.section.subjectName, classLevel: data.lesson.section.classLevelName, stream: data.lesson.section.streamName, academicPeriod: data.lesson.section.academicPeriodName },
    scheduledLesson: { id: data.lesson.id, scheduledDate: data.lesson.scheduledDate, startsAt: data.lesson.startsAt, endsAt: data.lesson.endsAt, room: data.lesson.roomLabel },
    currentPosition: data.curriculum.current ? { canonicalId: data.curriculum.current.canonicalId, title: data.curriculum.current.title, positionKind: data.curriculum.current.positionKind, eventId: data.curriculum.current.eventId, sourceTitle: data.curriculum.current.sourceTitle, sourceLocator: data.curriculum.current.sourceLocator, sourceChecksum: data.curriculum.current.sourceChecksum } : null,
    previousLesson: data.previousLesson ? { id: data.previousLesson.id, outcome: data.previousLesson.outcome, note: data.previousLesson.eventNote, unfinishedWork: data.previousLesson.unfinishedWork } : null,
    recommendedFocus: data.recommendedFocus,
  };
}

export async function saveLessonPreparation(input: unknown): Promise<ActionResult> {
  try {
    const value = preparationSchema.parse(input);
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required to save preparation.");
    const ownership = await lessonOwnership(value.scheduledLessonId, access.schoolId, access.membershipId);
    const readiness = await loadLessonReadinessData(value.scheduledLessonId);
    const payload = {
      school_id: access.schoolId,
      scheduled_lesson_id: value.scheduledLessonId,
      teaching_section_id: ownership.lesson.teaching_section_id,
      curriculum_position_event_id: readiness.curriculum.current?.eventId ?? null,
      curriculum_canonical_id: readiness.curriculum.current?.canonicalId ?? null,
      curriculum_profile_id: readiness.curriculum.subjectProfileId,
      lesson_focus: value.lessonFocus,
      teacher_notes: value.teacherNotes,
      intended_coverage: value.intendedCoverage,
      preparation_notes: value.preparationNotes,
      context_snapshot: contextSnapshot(readiness),
      updated_by: access.userId,
    };
    const existing = await ownership.client.from("lesson_preparations").select("id, version").eq("school_id", access.schoolId).eq("scheduled_lesson_id", value.scheduledLessonId).maybeSingle();
    if (existing.error) throw new Error("Saved preparation could not be checked.");
    if (existing.data) {
      if (value.version != null && Number(existing.data.version) !== value.version) throw new Error("This preparation changed in another session. Reopen it before saving again.");
      const update = await ownership.client.from("lesson_preparations").update(payload).eq("id", existing.data.id).eq("school_id", access.schoolId).select("id, version").single();
      if (update.error || !update.data) throw new Error("Preparation could not be updated.");
      return { ok: true, id: String(update.data.id), version: Number(update.data.version) };
    }
    const insert = await ownership.client.from("lesson_preparations").insert({ ...payload, created_by: access.userId }).select("id, version").single();
    if (insert.error || !insert.data) throw new Error("Preparation could not be saved.");
    return { ok: true, id: String(insert.data.id), version: Number(insert.data.version) };
  } catch (error) {
    return { ok: false, error: userFacingError(error, "Preparation could not be saved.") };
  }
}

export async function confirmTeacherCurriculumPosition(input: unknown): Promise<ActionResult> {
  try {
    const value = positionSchema.parse(input);
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required to confirm a curriculum position.");
    await assignedTeacherSection(value.teachingSectionId, access.schoolId, access.membershipId);
    const effectiveOn = new Date().toISOString().slice(0, 10);
    const knowledge = createPostgresKnowledgeClient();
    let current: Record<string, unknown> | null = null;
    let subjectProfileId: string | null = null;
    try {
      const binding = await knowledge.query<{ subject_profile_id: string }>(`select subject_profile_id from teaching_section_curriculum_bindings where school_id=$1 and teaching_section_id=$2 and status='ACTIVE' and effective_from <= $3::date and (effective_to is null or effective_to >= $3::date) order by effective_from desc limit 1`, [access.schoolId, value.teachingSectionId, effectiveOn]);
      if (!binding.rows[0]) throw new Error("This Teaching Section has no active curriculum setup.");
      subjectProfileId = binding.rows[0].subject_profile_id;
      const candidate = await knowledge.query<{ record_type: string }>(`select r.record_type from knowledge_profile_records pr join knowledge_records r on r.canonical_id=pr.canonical_id where pr.subject_profile_id=$1 and pr.canonical_id=$2 and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE' and r.record_type in ('topic','learning_outcome')`, [binding.rows[0].subject_profile_id, value.canonicalId]);
      if (!candidate.rows[0]) throw new Error("Select a valid position from the active curriculum setup.");
      const expectedKind = candidate.rows[0].record_type === "topic" ? "TOPIC" : "LEARNING_OUTCOME";
      if (expectedKind !== value.positionKind) throw new Error("The selected curriculum position type does not match the verified record.");
      current = await getCurrentTeachingSectionCurriculumPosition(knowledge, access.schoolId, value.teachingSectionId, effectiveOn);
      if (current?.canonical_id === value.canonicalId) throw new Error("That position is already confirmed for this Teaching Section.");
    } finally { await knowledge.close(); }
    if (current && !value.correctionReason) throw new Error("A short reason is required when correcting the confirmed position.");
    if (!subjectProfileId) throw new Error("This Teaching Section has no active curriculum setup.");
    const client = await createSupabaseServerClient();
    const response = await client.from("teaching_section_curriculum_position_events").insert({ school_id: access.schoolId, teaching_section_id: value.teachingSectionId, subject_profile_id: subjectProfileId, canonical_id: value.canonicalId, position_kind: value.positionKind, confirmed_by: access.userId, supersedes_event_id: current?.id ?? null, correction_reason: current ? value.correctionReason : null }).select("id").single();
    if (response.error || !response.data) throw new Error(userFacingError(response.error, "Curriculum position could not be confirmed."));
    revalidatePath("/workspace"); revalidatePath(`/workspace/teacher/sections/${value.teachingSectionId}`);
    return { ok: true, id: String(response.data.id) };
  } catch (error) {
    return { ok: false, error: userFacingError(error, "Curriculum position could not be confirmed.") };
  }
}
