import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { prepareOneTeacherPilot } from "./one-teacher-bootstrap";

describe("one-teacher pilot RPC migration", () => {
  it("parses and rejects unauthenticated application before any write", async () => {
    const database = new PGlite();
    try {
      await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key, email text, raw_app_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid'; CREATE TABLE public.schools(id uuid primary key); CREATE TABLE public.teaching_sections(id uuid primary key);");
      const migration = await readFile("drizzle/0043_one_teacher_controlled_pilot_application.sql", "utf8");
      await database.exec(migration);
      await expect(database.query("SELECT public.apply_one_teacher_controlled_pilot('{}'::jsonb,true)")).rejects.toThrow("operator authority required");
      const functionCount = await database.query<{ count: string }>("SELECT count(*)::text AS count FROM pg_proc WHERE proname='apply_one_teacher_controlled_pilot'");
      expect(Number(functionCount.rows[0].count)).toBe(1);
    } finally { await database.close(); }
  }, 30_000);

  it("dry-runs a valid existing Auth teacher with zero operational writes", async () => {
    const database = new PGlite();
    const operatorId = "a5555555-5555-4555-8555-555555555555";
    const teacherId = "a6666666-6666-4666-8666-666666666666";
    try {
      await database.exec(`CREATE SCHEMA auth;
        CREATE TABLE auth.users(id uuid primary key, email text, raw_app_meta_data jsonb);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT ''${operatorId}''::uuid';
        CREATE TABLE public.schools(id uuid primary key, slug text, name text, timezone text, status text);
        INSERT INTO auth.users VALUES ('${operatorId}','operator@example.test','{"ate_pilot_operator":"true"}'),
          ('${teacherId}','teacher@example.test','{}');`);
      await database.exec("CREATE TABLE public.teaching_sections(id uuid primary key);");
      await database.exec(await readFile("drizzle/0043_one_teacher_controlled_pilot_application.sql", "utf8"));
      const plan = { school: { name: "Fixture School", slug: "fixture-school", timezone: "Africa/Kampala", createIfMissing: true },
        teacher: { name: "Fixture Teacher", email: "teacher@example.test", existingAuthUserId: teacherId },
        academicPeriod: { name: "Term 3", startsOn: "2026-09-01", endsOn: "2026-09-14" },
        sections: [{ subject: "CHEMISTRY", classLevel: "S3", stream: "East", schoolSubjectKey: "LOWER_CHEMISTRY",
          assignmentState: "PROPOSED", curriculumPositionState: "AWAITING_TEACHER_CONFIRMATION" }],
        timetable: { name: "ONE-TEACHER CONTROLLED PILOT TIMETABLE", scope: "ONLY_THIS_TEACHER",
          slots: [{ dayOfWeek: 1, startsAt: "08:00", endsAt: "08:40" }] } };
      const result = await database.query<{ apply_one_teacher_controlled_pilot: { dryRun: boolean; plannedSectionCount: number } }>(
        "SELECT public.apply_one_teacher_controlled_pilot($1::jsonb,true)", [JSON.stringify(plan)]);
      expect(result.rows[0].apply_one_teacher_controlled_pilot).toMatchObject({ dryRun: true, plannedSectionCount: 1 });
      const schools = await database.query<{ count: string }>("SELECT count(*)::text AS count FROM public.schools");
      expect(Number(schools.rows[0].count)).toBe(0);
    } finally { await database.close(); }
  }, 30_000);

  it("applies explicit parallel streams once and rejects overlapping or missing identities", async () => {
    const database = new PGlite();
    const operatorId = "a5555555-5555-4555-8555-555555555555";
    const teacherId = "a6666666-6666-4666-8666-666666666666";
    try {
      await database.exec(`CREATE SCHEMA auth;
        CREATE TABLE auth.users(id uuid primary key, email text, raw_app_meta_data jsonb);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT ''${operatorId}''::uuid';
        INSERT INTO auth.users VALUES ('${operatorId}','operator@example.test','{"ate_pilot_operator":"true"}'),
          ('${teacherId}','teacher@example.test','{}');
        CREATE TABLE schools(id uuid primary key default gen_random_uuid(),name text,slug text unique,status text,timezone text);
        CREATE TABLE academic_periods(id uuid primary key default gen_random_uuid(),school_id uuid,name text,period_type text,academic_year int,starts_on date,ends_on date,status text);
        CREATE TABLE memberships(id uuid primary key default gen_random_uuid(),school_id uuid,user_id uuid,status text,display_name text,joined_at timestamptz);
        CREATE TABLE role_grants(id uuid primary key default gen_random_uuid(),membership_id uuid,school_id uuid,role text,scope_type text,status text,granted_by uuid);
        CREATE TABLE class_levels(id uuid primary key default gen_random_uuid(),school_id uuid,code text,name text,sort_order int,status text,unique(school_id,code));
        CREATE TABLE streams(id uuid primary key default gen_random_uuid(),school_id uuid,class_level_id uuid,name text,status text,unique(school_id,class_level_id,name));
        CREATE TABLE school_subjects(id uuid primary key default gen_random_uuid(),school_id uuid,code text,name text,status text,unique(school_id,code));
        CREATE TABLE teaching_sections(id uuid primary key default gen_random_uuid(),school_id uuid,academic_period_id uuid,teacher_membership_id uuid,school_subject_id uuid,class_level_id uuid,stream_id uuid,assignment_state text,operational_status text,created_by uuid);
        CREATE TABLE timetable_versions(id uuid primary key default gen_random_uuid(),school_id uuid,academic_period_id uuid,version_number int,name text,effective_from date,status text,created_by uuid,notes text);
        CREATE TABLE timetable_slots(id uuid primary key default gen_random_uuid(),school_id uuid,timetable_version_id uuid,teaching_section_id uuid,day_of_week smallint,starts_at time,ends_at time,room_label text);
        CREATE TABLE knowledge_subject_profiles(id uuid,release_id uuid,governed_subject_id uuid,status text,runtime_status text,education_level text);
        CREATE TABLE knowledge_curriculum_releases(id uuid,status text);
        CREATE TABLE knowledge_curriculum_subjects(id uuid,title text);
        CREATE TABLE school_subject_curriculum_bindings(school_id uuid,school_subject_id uuid,subject_profile_id uuid,effective_from date,status text,bound_by uuid);
        CREATE TABLE teaching_section_curriculum_bindings(school_id uuid,teaching_section_id uuid,subject_profile_id uuid,effective_from date,status text,bound_by uuid);`);
      await database.exec(await readFile("drizzle/0043_one_teacher_controlled_pilot_application.sql", "utf8"));
      const input = { createSchoolIfMissing: true, schoolName: "Fixture School", schoolSlug: "fixture-school",
        schoolTimezone: "Africa/Kampala", teacherName: "Fixture Teacher", teacherEmail: "teacher@example.test",
        existingAuthUserId: teacherId, academicPeriod: { name: "Term 3", periodType: "TERM" as const,
          academicYear: 2026, startsOn: "2026-09-01", endsOn: "2026-09-14" },
        timetableEffectiveFrom: "2026-09-01", timetableVersionNumber: 1,
        sections: [
          { subject: "MATHEMATICS" as const, classLevel: "S3" as const, stream: "East" },
          { subject: "MATHEMATICS" as const, classLevel: "S3" as const, stream: "West" },
          { subject: "CHEMISTRY" as const, classLevel: "S5" as const, stream: "East" },
        ],
        slots: [{ sectionIndex: 0, dayOfWeek: 1, startsAt: "08:00", endsAt: "08:40" }] };
      const plan = prepareOneTeacherPilot(input);
      const apply = () => database.query<{ apply_one_teacher_controlled_pilot: { dryRun: boolean; teachingSectionIds: Record<string, string> } }>(
        "SELECT public.apply_one_teacher_controlled_pilot($1::jsonb,false)", [JSON.stringify(plan)]);
      const first = (await apply()).rows[0].apply_one_teacher_controlled_pilot;
      const second = (await apply()).rows[0].apply_one_teacher_controlled_pilot;
      expect(first).toEqual(second);
      expect(Object.keys(first.teachingSectionIds)).toHaveLength(3);
      const count = await database.query<{ count: string }>("SELECT count(*)::text AS count FROM teaching_sections");
      expect(Number(count.rows[0].count)).toBe(3);
      const overlap = structuredClone(plan);
      overlap.timetable.slots.push({ ...overlap.timetable.slots[0], sectionKey: overlap.sections[1].key, startsAt: "08:20", endsAt: "09:00" });
      await expect(database.query("SELECT public.apply_one_teacher_controlled_pilot($1::jsonb,false)", [JSON.stringify(overlap)])).rejects.toThrow("overlapping");
      const wrongTeacher = structuredClone(plan);
      wrongTeacher.teacher.existingAuthUserId = "a7777777-7777-4777-8777-777777777777";
      await expect(database.query("SELECT public.apply_one_teacher_controlled_pilot($1::jsonb,false)", [JSON.stringify(wrongTeacher)])).rejects.toThrow("Auth identity");
    } finally { await database.close(); }
  }, 30_000);
});
