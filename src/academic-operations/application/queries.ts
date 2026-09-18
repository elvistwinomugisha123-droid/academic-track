import "server-only";

import { listAssignableTeachers } from "@/academic-operations/application/commands";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AcademicOperationsData = {
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  periods: Array<Record<string, string | number>>;
  departments: Array<Record<string, string>>;
  levels: Array<Record<string, string | number>>;
  streams: Array<Record<string, string>>;
  subjects: Array<Record<string, string | null>>;
  sections: Array<Record<string, string | null>>;
  versions: Array<Record<string, string | number | null>>;
  slots: Array<Record<string, string | number | null>>;
  lessons: Array<Record<string, string | null>>;
  events: Array<Record<string, string | null>>;
  eventTargets: Array<Record<string, string | null>>;
  teachers: Array<{ membership_id: string; display_name: string }>;
};

function requiredRows<T>(result: { data: T[] | null; error: { message?: string } | null }, label: string): T[] {
  if (result.error) throw new Error(label);
  return result.data ?? [];
}

export async function loadAcademicOperationsData(): Promise<AcademicOperationsData> {
  const access = await requireWorkspaceAccess();
  const client = await createSupabaseServerClient();
  const schoolId = access.schoolId;
  const [periods, departments, levels, streams, subjects, sections, versions, slots, lessons, events, eventTargets] = await Promise.all([
    client.from("academic_periods").select("id, name, period_type, starts_on, ends_on, status").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    client.from("departments").select("id, name, code").eq("school_id", schoolId).order("name"),
    client.from("class_levels").select("id, code, name, sort_order, status").eq("school_id", schoolId).order("sort_order"),
    client.from("streams").select("id, class_level_id, code, name, status").eq("school_id", schoolId).order("name"),
    client.from("school_subjects").select("id, department_id, code, name, status").eq("school_id", schoolId).order("name"),
    client.from("teaching_sections").select("id, academic_period_id, teacher_membership_id, school_subject_id, class_level_id, stream_id, assignment_state, operational_status, confirmed_at, flag_reason").eq("school_id", schoolId).order("created_at", { ascending: false }),
    client.from("timetable_versions").select("id, academic_period_id, version_number, name, status, effective_from, verified_by, verified_at, activated_by, activated_at").eq("school_id", schoolId).order("effective_from", { ascending: false }),
    client.from("timetable_slots").select("id, timetable_version_id, teaching_section_id, day_of_week, starts_at, ends_at, room_label").eq("school_id", schoolId).order("day_of_week").order("starts_at"),
    client.from("scheduled_lessons").select("id, teaching_section_id, timetable_version_id, scheduled_date, starts_at, ends_at, schedule_status").eq("school_id", schoolId).order("scheduled_date").limit(80),
    client.from("school_programme_events").select("id, academic_period_id, event_type, title, starts_at, ends_at, status, notes").eq("school_id", schoolId).order("starts_at"),
    client.from("programme_event_targets").select("event_id, class_level_id, stream_id, department_id").eq("school_id", schoolId),
  ]);
  const required = {
    periods: requiredRows(periods, "Academic periods could not be loaded."),
    departments: requiredRows(departments, "Departments could not be loaded."),
    levels: requiredRows(levels, "Class levels could not be loaded."),
    streams: requiredRows(streams, "Streams could not be loaded."),
    subjects: requiredRows(subjects, "School subjects could not be loaded."),
    sections: requiredRows(sections, "Teaching Sections could not be loaded."),
    versions: requiredRows(versions, "Timetable versions could not be loaded."),
    slots: requiredRows(slots, "Timetable slots could not be loaded."),
    lessons: requiredRows(lessons, "Scheduled lessons could not be loaded."),
    events: requiredRows(events, "Programme events could not be loaded."),
    eventTargets: requiredRows(eventTargets, "Programme event targets could not be loaded."),
  };
  let teachers: Array<{ membership_id: string; display_name: string }> = [];
  if (access.roles.some((role) => role === "DOS" || role === "SCHOOL_ADMIN")) {
    try { teachers = await listAssignableTeachers(schoolId); } catch { throw new Error("The teacher assignment directory could not be loaded."); }
  }
  return {
    access,
    periods: required.periods as AcademicOperationsData["periods"],
    departments: required.departments as AcademicOperationsData["departments"],
    levels: required.levels as AcademicOperationsData["levels"],
    streams: required.streams as AcademicOperationsData["streams"],
    subjects: required.subjects as AcademicOperationsData["subjects"],
    sections: required.sections as AcademicOperationsData["sections"],
    versions: required.versions as AcademicOperationsData["versions"],
    slots: required.slots as AcademicOperationsData["slots"],
    lessons: required.lessons as AcademicOperationsData["lessons"],
    events: required.events as AcademicOperationsData["events"],
    eventTargets: required.eventTargets as AcademicOperationsData["eventTargets"],
    teachers,
  };
}
