"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { activateTimetableVersion, confirmTeachingSectionAssignment, verifyTimetableVersion } from "@/academic-operations/application/commands";

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(160);
const date = z.string().date();

type ActionResult = { ok: true } | { ok: false; error: string };

function result(error: { message?: string } | null): ActionResult {
  return error ? { ok: false, error: error.message ?? "The change could not be saved." } : { ok: true };
}

async function contextFor(roles: string[]) {
  const access = await requireWorkspaceAccess();
  if (!access.roles.some((role) => roles.includes(role))) throw new Error("You are not authorized for this operation.");
  return access;
}

export async function createClassLevel(input: { code: string; name: string; sortOrder: number }): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const value = z.object({ code: text, name: text, sortOrder: z.number().int().min(0) }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("class_levels").insert({ school_id: access.schoolId, code: value.code, name: value.name, sort_order: value.sortOrder }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Class level could not be created." }; }
}

export async function updateClassLevelStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const client = await createSupabaseServerClient(); const response = await client.from("class_levels").update({ status, updated_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("school_id", access.schoolId); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Class level could not be updated." }; }
}

export async function createStream(input: { classLevelId: string; code: string; name: string }): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const value = z.object({ classLevelId: uuid, code: text.optional(), name: text }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("streams").insert({ school_id: access.schoolId, class_level_id: value.classLevelId, code: value.code || null, name: value.name }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Stream could not be created." }; }
}

export async function updateStreamStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const client = await createSupabaseServerClient(); const response = await client.from("streams").update({ status, updated_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("school_id", access.schoolId); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Stream could not be updated." }; }
}

export async function createSubject(input: { code: string; name: string; departmentId: string }): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const value = z.object({ code: text.optional(), name: text, departmentId: uuid.optional() }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("school_subjects").insert({ school_id: access.schoolId, code: value.code || null, name: value.name, department_id: value.departmentId || null }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Subject could not be created." }; }
}

export async function updateSubjectStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const client = await createSupabaseServerClient(); const response = await client.from("school_subjects").update({ status, updated_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("school_id", access.schoolId); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Subject could not be updated." }; }
}

export async function createTeachingSection(input: { academicPeriodId: string; teacherMembershipId: string; schoolSubjectId: string; classLevelId: string; streamId: string }): Promise<ActionResult> {
  try { const access = await contextFor(["DOS", "SCHOOL_ADMIN"]); const value = z.object({ academicPeriodId: uuid, teacherMembershipId: uuid, schoolSubjectId: uuid, classLevelId: uuid, streamId: uuid }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("teaching_sections").insert({ school_id: access.schoolId, ...{ academic_period_id: value.academicPeriodId, teacher_membership_id: value.teacherMembershipId, school_subject_id: value.schoolSubjectId, class_level_id: value.classLevelId, stream_id: value.streamId }, created_by: access.userId }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Teaching Section could not be created." }; }
}

export async function confirmSection(input: { sectionId: string; decision: "CONFIRMED" | "FLAGGED"; reason?: string }): Promise<ActionResult> {
  try { await confirmTeachingSectionAssignment(input); revalidatePath("/workspace/academic-operations"); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "The assignment could not be updated." }; }
}

export async function createTimetableVersion(input: { academicPeriodId: string; versionNumber: number; name: string; effectiveFrom: string }): Promise<ActionResult> {
  try { const access = await contextFor(["DOS", "SCHOOL_ADMIN"]); const value = z.object({ academicPeriodId: uuid, versionNumber: z.number().int().positive(), name: text, effectiveFrom: date }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("timetable_versions").insert({ school_id: access.schoolId, academic_period_id: value.academicPeriodId, version_number: value.versionNumber, name: value.name, effective_from: value.effectiveFrom, created_by: access.userId }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Timetable version could not be created." }; }
}

export async function createTimetableSlot(input: { versionId: string; sectionId: string; dayOfWeek: number; startsAt: string; endsAt: string; roomLabel: string }): Promise<ActionResult> {
  try { const access = await contextFor(["DOS", "SCHOOL_ADMIN"]); const value = z.object({ versionId: uuid, sectionId: uuid, dayOfWeek: z.number().int().min(1).max(7), startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), roomLabel: z.string().trim().max(80) }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("timetable_slots").insert({ school_id: access.schoolId, timetable_version_id: value.versionId, teaching_section_id: value.sectionId, day_of_week: value.dayOfWeek, starts_at: value.startsAt, ends_at: value.endsAt, room_label: value.roomLabel || null }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Timetable slot could not be created." }; }
}

export async function verifyVersion(id: string): Promise<ActionResult> { try { await verifyTimetableVersion({ versionId: id }); revalidatePath("/workspace/academic-operations"); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Timetable verification failed." }; } }
export async function activateVersion(id: string): Promise<ActionResult> { try { await activateTimetableVersion({ versionId: id }); revalidatePath("/workspace/academic-operations"); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Timetable activation failed." }; } }

export async function createProgrammeEvent(input: { academicPeriodId: string; eventType: string; title: string; startsAt: string; endsAt: string; notes: string }): Promise<ActionResult> {
  try { const access = await contextFor(["DOS", "SCHOOL_ADMIN"]); const value = z.object({ academicPeriodId: uuid.optional(), eventType: z.enum(["HOLIDAY", "ASSEMBLY", "SPORTS", "TRIP", "VISITATION", "EXAMINATION", "MOCK", "OTHER"]), title: text, startsAt: z.string().datetime(), endsAt: z.string().datetime(), notes: z.string().trim().max(500) }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("school_programme_events").insert({ school_id: access.schoolId, academic_period_id: value.academicPeriodId || null, event_type: value.eventType, title: value.title, starts_at: value.startsAt, ends_at: value.endsAt, notes: value.notes || null, created_by: access.userId }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Programme event could not be created." }; }
}

export async function cancelProgrammeEvent(id: string): Promise<ActionResult> { try { const access = await contextFor(["DOS", "SCHOOL_ADMIN"]); const client = await createSupabaseServerClient(); const response = await client.from("school_programme_events").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("school_id", access.schoolId); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Programme event could not be cancelled." }; } }
