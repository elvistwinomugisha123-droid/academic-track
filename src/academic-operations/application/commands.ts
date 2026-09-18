import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { activateTimetableVersionCommandSchema, confirmTeachingSectionAssignmentCommandSchema, verifyTimetableVersionCommandSchema } from "@/academic-operations/schemas";

type RpcError = { message: string };

function throwRpcError(error: RpcError | null): never {
  throw new Error(error?.message ?? "Academic operations command failed");
}

async function expectUuid(data: unknown, error: RpcError | null): Promise<string> {
  if (error) throwRpcError(error);
  if (typeof data !== "string") throw new Error("Academic operations command returned an invalid result");
  return data;
}

export async function confirmTeachingSectionAssignment(input: unknown): Promise<string> {
  const command = confirmTeachingSectionAssignmentCommandSchema.parse(input);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("confirm_teaching_section_assignment", {
    p_section_id: command.sectionId,
    p_decision: command.decision,
    p_reason: command.reason ?? null,
  });
  return expectUuid(data, error);
}

export async function verifyTimetableVersion(input: unknown): Promise<string> {
  const command = verifyTimetableVersionCommandSchema.parse(input);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("verify_timetable_version", { p_version_id: command.versionId });
  return expectUuid(data, error);
}

export async function activateTimetableVersion(input: unknown): Promise<string> {
  const command = activateTimetableVersionCommandSchema.parse(input);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("activate_timetable_version", { p_version_id: command.versionId });
  return expectUuid(data, error);
}

export type ProgrammeEventOverlap = {
  event_id: string;
  event_type: string;
  title: string;
  starts_at: string;
  ends_at: string;
  target_scope: "SCHOOL" | "TARGETED";
};

export async function findProgrammeEventOverlaps(scheduledLessonId: string): Promise<ProgrammeEventOverlap[]> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("find_programme_event_overlaps", { p_scheduled_lesson_id: scheduledLessonId });
  if (error) throwRpcError(error);
  return (data ?? []) as ProgrammeEventOverlap[];
}

export type AssignableTeacher = { membership_id: string; display_name: string };

export async function listAssignableTeachers(schoolId: string): Promise<AssignableTeacher[]> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("list_assignable_teachers", { p_school_id: schoolId });
  if (error) throwRpcError(error);
  return (data ?? []) as AssignableTeacher[];
}

export type ProgrammeTargetType = "SCHOOL" | "CLASS_LEVEL" | "STREAM" | "DEPARTMENT";

export async function createProgrammeEvent(input: { schoolId: string; academicPeriodId: string | null; eventType: string; title: string; startsAt: string; endsAt: string; notes: string | null; targetType: ProgrammeTargetType; targetId: string | null }): Promise<string> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("create_programme_event", {
    p_school_id: input.schoolId,
    p_academic_period_id: input.academicPeriodId,
    p_event_type: input.eventType,
    p_title: input.title,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_notes: input.notes,
    p_target_type: input.targetType,
    p_target_id: input.targetId,
  });
  return expectUuid(data, error);
}
