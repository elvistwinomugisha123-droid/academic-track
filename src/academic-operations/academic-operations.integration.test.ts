import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const admin = url && serviceKey ? createClient(url, serviceKey) : null;
const suffix = `operations-${Date.now()}`;
const revisionEffectiveFrom = "2026-10-01";

type TestUser = { id: string; email: string; password: string; client: SupabaseClient };
let schoolA = "";
let schoolB = "";
let biologyA = "";
let chemistryA = "";
let teacherMembershipA = "";
let teacherMembershipB = "";
let dosMembershipA = "";
let levelA = "";
let streamA = "";
let periodB = "";
let levelB = "";
let streamB = "";
let subjectBiology = "";
let subjectChemistry = "";
let periodA = "";
let sectionA = "";
let sectionB = "";
let chemistrySection = "";
let versionA = "";
let versionB = "";
let teacherA: TestUser;
let teacherB: TestUser;
let hodA: TestUser;
let dosA: TestUser;
let multiSchoolDos: TestUser;
let principalA: TestUser;
let adminA: TestUser;

const requireConfigured = () => {
  if (!url || !publishableKey || !serviceKey || !admin) throw new Error("Academic operations integration tests require TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY, and TEST_SUPABASE_SERVICE_ROLE_KEY. No production fallback is permitted.");
};
const requireData = <T>(data: T | null, error: { message: string } | null): T => {
  if (error || data === null) throw error ?? new Error("Expected Supabase data");
  return data;
};

async function createTestUser(label: string): Promise<TestUser> {
  const email = `${suffix}-${label}@example.test`;
  const password = `Ate-${suffix}-${label}-Password!`;
  const { data, error } = await admin!.auth.admin.createUser({ email, password, email_confirm: true });
  const user = requireData(data.user, error);
  return { id: user.id, email, password, client: createClient(url!, publishableKey!) };
}

async function signIn(user: TestUser) {
  const { error } = await user.client.auth.signInWithPassword({ email: user.email, password: user.password });
  expect(error).toBeNull();
}

async function insertOne(table: string, values: Record<string, unknown>, select = "id"): Promise<string> {
  const result = await admin!.from(table).insert(values).select(select).single();
  const row = requireData(result.data, result.error) as unknown as Record<string, unknown>;
  return row.id as string;
}

describe("isolated Step 4 academic operations integration", () => {
  beforeAll(async () => {
    requireConfigured();
    [teacherA, teacherB, hodA, dosA, multiSchoolDos, principalA, adminA] = await Promise.all([
      createTestUser("teacher-a"), createTestUser("teacher-b"), createTestUser("hod"), createTestUser("dos"), createTestUser("multi-school-dos"), createTestUser("principal"), createTestUser("admin"),
    ]);
    const schools = requireData((await admin!.from("schools").insert([
      { name: `Operations Test A ${suffix}`, slug: `${suffix}-a` },
      { name: `Operations Test B ${suffix}`, slug: `${suffix}-b` },
    ]).select("id, slug")).data, null);
    schoolA = schools.find((row) => row.slug.endsWith("-a"))!.id;
    schoolB = schools.find((row) => row.slug.endsWith("-b"))!.id;
    biologyA = await insertOne("departments", { school_id: schoolA, name: `Biology ${suffix}`, code: `${suffix}-BIO` });
    chemistryA = await insertOne("departments", { school_id: schoolA, name: `Chemistry ${suffix}`, code: `${suffix}-CHEM` });
    const memberships = await admin!.from("memberships").insert([
      ...[teacherA, teacherB, hodA, dosA, multiSchoolDos, principalA, adminA].map((user) => ({ school_id: schoolA, user_id: user.id, status: "ACTIVE", display_name: user.email, joined_at: new Date().toISOString() })),
      { school_id: schoolB, user_id: multiSchoolDos.id, status: "ACTIVE", display_name: multiSchoolDos.email, joined_at: new Date().toISOString() },
    ]).select("id, user_id, school_id");
    const membershipRows = requireData(memberships.data, memberships.error);
    const membership = (user: TestUser, schoolId = schoolA) => membershipRows.find((row) => row.user_id === user.id && row.school_id === schoolId)!.id;
    teacherMembershipA = membership(teacherA); teacherMembershipB = membership(teacherB); dosMembershipA = membership(dosA, schoolA);
    const roleRows = [
      { membership_id: teacherMembershipA, school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: teacherMembershipA, school_id: schoolA, role: "HOD", scope_type: "DEPARTMENT", department_id: biologyA, granted_by: adminA.id },
      { membership_id: teacherMembershipB, school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: membership(hodA), school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: membership(hodA), school_id: schoolA, role: "HOD", scope_type: "DEPARTMENT", department_id: biologyA, granted_by: adminA.id },
      { membership_id: dosMembershipA, school_id: schoolA, role: "DOS", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: membership(principalA), school_id: schoolA, role: "PRINCIPAL", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: membership(adminA), school_id: schoolA, role: "SCHOOL_ADMIN", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: membership(multiSchoolDos), school_id: schoolA, role: "DOS", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: membership(multiSchoolDos, schoolB), school_id: schoolB, role: "DOS", scope_type: "SCHOOL", granted_by: adminA.id },
    ];
    const roleResult = await admin!.from("role_grants").insert(roleRows);
    if (roleResult.error) throw roleResult.error;
    periodA = await insertOne("academic_periods", { school_id: schoolA, name: `Term 3 ${suffix}`, period_type: "TERM", academic_year: 2026, starts_on: "2026-09-01", ends_on: "2026-12-31", status: "CURRENT" });
    periodB = await insertOne("academic_periods", { school_id: schoolB, name: `Term 3 B ${suffix}`, period_type: "TERM", academic_year: 2026, starts_on: "2026-09-01", ends_on: "2026-12-31", status: "CURRENT" });
    levelA = await insertOne("class_levels", { school_id: schoolA, code: `S2-${suffix}`, name: `Senior 2 ${suffix}` });
    streamA = await insertOne("streams", { school_id: schoolA, class_level_id: levelA, code: `A-${suffix}`, name: `Blue ${suffix}` });
    levelB = await insertOne("class_levels", { school_id: schoolB, code: `S2-B-${suffix}`, name: `Senior 2 B ${suffix}` });
    streamB = await insertOne("streams", { school_id: schoolB, class_level_id: levelB, code: `B-${suffix}`, name: `Blue B ${suffix}` });
    subjectBiology = await insertOne("school_subjects", { school_id: schoolA, department_id: biologyA, code: `BIO-${suffix}`, name: `Biology ${suffix}` });
    subjectChemistry = await insertOne("school_subjects", { school_id: schoolA, department_id: chemistryA, code: `CHEM-${suffix}`, name: `Chemistry ${suffix}` });
    sectionA = await insertOne("teaching_sections", { school_id: schoolA, academic_period_id: periodA, teacher_membership_id: teacherMembershipA, school_subject_id: subjectBiology, class_level_id: levelA, stream_id: streamA, created_by: dosA.id });
    sectionB = await insertOne("teaching_sections", { school_id: schoolA, academic_period_id: periodA, teacher_membership_id: teacherMembershipB, school_subject_id: subjectBiology, class_level_id: levelA, stream_id: streamA, created_by: dosA.id });
    chemistrySection = await insertOne("teaching_sections", { school_id: schoolA, academic_period_id: periodA, teacher_membership_id: teacherMembershipB, school_subject_id: subjectChemistry, class_level_id: levelA, stream_id: streamA, created_by: dosA.id });
    versionA = await insertOne("timetable_versions", { school_id: schoolA, academic_period_id: periodA, version_number: 1, name: `Draft ${suffix}`, status: "DRAFT", effective_from: "2026-01-01", created_by: dosA.id });
    await signIn(teacherA); await signIn(teacherB); await signIn(hodA); await signIn(dosA); await signIn(multiSchoolDos); await signIn(principalA); await signIn(adminA);
  });

  afterAll(async () => {
    if (!admin || !schoolA) return;
    for (const table of ["scheduled_lessons", "timetable_slots", "timetable_versions", "programme_event_targets", "school_programme_events", "teaching_sections", "streams", "class_levels", "school_subjects", "academic_periods", "role_grants", "memberships", "departments"]) await admin.from(table).delete().in("school_id", [schoolA, schoolB]);
    await admin.from("schools").delete().in("id", [schoolA, schoolB]);
    for (const user of [teacherA, teacherB, hodA, dosA, multiSchoolDos, principalA, adminA]) if (user) await admin.auth.admin.deleteUser(user.id);
  });

  it("denies anonymous and cross-tenant access", async () => {
    const anonymous = createClient(url!, publishableKey!);
    expect((await anonymous.from("class_levels").select("id")).data).toEqual(null);
    expect((await teacherA.client.from("class_levels").select("id").eq("school_id", schoolB)).data).toEqual([]);
    expect((await teacherA.client.from("class_levels").insert({ school_id: schoolB, code: `X-${suffix}`, name: "Cross tenant" })).error).toBeTruthy();
  });

  it("scopes teachers to their own sections and schedules", async () => {
    const visibleIds = (await teacherB.client.from("teaching_sections").select("id")).data?.map((row) => row.id) ?? [];
    expect(visibleIds).toHaveLength(2);
    expect(visibleIds).toEqual(expect.arrayContaining([sectionB, chemistrySection]));
    expect(visibleIds).not.toContain(sectionA);
    expect((await teacherB.client.from("scheduled_lessons").select("id")).data).toEqual([]);
  });

  it("limits HOD reads to the active department scope", async () => {
    const visible = await hodA.client.from("teaching_sections").select("id, school_subject_id");
    expect(visible.error).toBeNull();
    expect(visible.data?.map((row) => row.id)).toEqual(expect.arrayContaining([sectionA, sectionB]));
    expect(visible.data?.map((row) => row.id)).not.toContain(chemistrySection);
  });

  it("allows only the assigned teacher to confirm a proposed section", async () => {
    expect((await teacherB.client.rpc("confirm_teaching_section_assignment", { p_section_id: sectionA, p_decision: "CONFIRMED", p_reason: null })).error).toBeTruthy();
    expect((await teacherA.client.rpc("confirm_teaching_section_assignment", { p_section_id: sectionA, p_decision: "CONFIRMED", p_reason: null })).error).toBeNull();

    const attemptedIdentityChange = await teacherA.client
      .from("teaching_sections")
      .update({ teacher_membership_id: teacherMembershipB })
      .eq("id", sectionA)
      .select("id, teacher_membership_id");

    expect(attemptedIdentityChange.error).toBeNull();
    expect(attemptedIdentityChange.data).toEqual([]);

    const persistedSection = await admin!
      .from("teaching_sections")
      .select("teacher_membership_id")
      .eq("id", sectionA)
      .single();

    expect(persistedSection.error).toBeNull();
    expect(persistedSection.data?.teacher_membership_id).toBe(teacherMembershipA);
  });

  it("rejects verification with unconfirmed sections and conflicts", async () => {
    await admin!.from("timetable_slots").insert({ school_id: schoolA, timetable_version_id: versionA, teaching_section_id: sectionA, day_of_week: 1, starts_at: "08:00", ends_at: "09:00" });
    await admin!.from("timetable_slots").insert({ school_id: schoolA, timetable_version_id: versionA, teaching_section_id: sectionB, day_of_week: 1, starts_at: "08:30", ends_at: "09:30" });
    expect((await dosA.client.rpc("verify_timetable_version", { p_version_id: versionA })).error).toBeTruthy();
    expect((await admin!.from("timetable_slots").delete().eq("timetable_version_id", versionA)).error).toBeNull();
  });

  it("verifies, activates, stamps actors, and generates idempotent schedule intent", async () => {
    expect((await teacherB.client.rpc("confirm_teaching_section_assignment", { p_section_id: sectionB, p_decision: "CONFIRMED", p_reason: null })).error).toBeNull();
    versionB = await insertOne("timetable_versions", { school_id: schoolA, academic_period_id: periodA, version_number: 2, name: `Verified ${suffix}`, status: "DRAFT", effective_from: "2026-09-01", created_by: dosA.id });
    await admin!.from("timetable_slots").insert({ school_id: schoolA, timetable_version_id: versionB, teaching_section_id: sectionB, day_of_week: 1, starts_at: "08:00", ends_at: "09:00" });
    expect((await dosA.client.rpc("verify_timetable_version", { p_version_id: versionB })).error).toBeNull();
    expect((await dosA.client.rpc("activate_timetable_version", { p_version_id: versionB })).error).toBeNull();
    const version = await admin!.from("timetable_versions").select("status, verified_by, activated_by").eq("id", versionB).single();
    expect(version.data).toMatchObject({ status: "ACTIVE", verified_by: dosA.id, activated_by: dosA.id });
    const lessons = await admin!.from("scheduled_lessons").select("id, schedule_status, starts_at, ends_at").eq("timetable_version_id", versionB);
    expect(lessons.error).toBeNull();
    expect(lessons.data!.length).toBeGreaterThan(0);
    expect(lessons.data!.every((lesson) => lesson.schedule_status === "SCHEDULED" && lesson.starts_at && lesson.ends_at)).toBe(true);
    const count = lessons.data!.length;
    expect((await dosA.client.rpc("activate_timetable_version", { p_version_id: versionB })).error).toBeTruthy();
    expect((await admin!.from("scheduled_lessons").select("id", { count: "exact", head: true }).eq("timetable_version_id", versionB)).count).toBe(count);
  });

  it("protects active slots and supersedes only future occurrences during revision", async () => {
    const activeSlot = (await admin!.from("timetable_slots").select("id").eq("timetable_version_id", versionB).single()).data!.id;
    expect((await dosA.client.from("timetable_slots").update({ room_label: "Moved" }).eq("id", activeSlot)).error).toBeTruthy();
    const versionC = await insertOne("timetable_versions", { school_id: schoolA, academic_period_id: periodA, version_number: 3, name: `Revision ${suffix}`, status: "DRAFT", effective_from: revisionEffectiveFrom, created_by: dosA.id });
    await admin!.from("timetable_slots").insert({ school_id: schoolA, timetable_version_id: versionC, teaching_section_id: sectionB, day_of_week: 1, starts_at: "10:00", ends_at: "11:00" });
    expect((await dosA.client.rpc("verify_timetable_version", { p_version_id: versionC })).error).toBeNull();
    expect((await dosA.client.rpc("activate_timetable_version", { p_version_id: versionC })).error).toBeNull();
    const oldLessons = await admin!.from("scheduled_lessons").select("scheduled_date, schedule_status, superseded_by_timetable_version_id").eq("timetable_version_id", versionB);
    expect(oldLessons.data!.some((lesson) => lesson.scheduled_date >= revisionEffectiveFrom && lesson.schedule_status === "SUPERSEDED" && lesson.superseded_by_timetable_version_id === versionC)).toBe(true);
    expect(oldLessons.data!.some((lesson) => lesson.scheduled_date < revisionEffectiveFrom && lesson.schedule_status === "SCHEDULED")).toBe(true);
    const replacementLessons = await admin!.from("scheduled_lessons").select("scheduled_date").eq("timetable_version_id", versionC);
    expect(replacementLessons.data!.every((lesson) => lesson.scheduled_date >= revisionEffectiveFrom)).toBe(true);
  });

  it("does not allow Principal to verify or activate", async () => {
    expect((await principalA.client.rpc("verify_timetable_version", { p_version_id: versionA })).error).toBeTruthy();
    expect((await principalA.client.rpc("activate_timetable_version", { p_version_id: versionA })).error).toBeTruthy();
  });

  it("keeps timetable state transitions and actor stamps command-controlled", async () => {
    expect((await dosA.client.from("timetable_versions").update({ status: "ACTIVE", activated_by: principalA.id }).eq("id", versionA)).error).toBeTruthy();
    expect((await dosA.client.from("timetable_versions").update({ status: "RETIRED" }).eq("id", versionA)).error).toBeNull();
    expect((await dosA.client.from("timetable_versions").update({ status: "ACTIVE" }).eq("id", versionA)).error).toBeTruthy();
  });

  it("keeps programme overlap as an overlap fact only", async () => {
    const event = await insertOne("school_programme_events", { school_id: schoolA, academic_period_id: periodA, event_type: "ASSEMBLY", title: `Assembly ${suffix}`, starts_at: "2026-09-21T05:30:00+00:00", ends_at: "2026-09-21T06:30:00+00:00", created_by: dosA.id });
    await admin!.from("programme_event_targets").insert({ event_id: event, school_id: schoolA, stream_id: streamA });
    const lesson = (await admin!.from("scheduled_lessons").select("id").eq("timetable_version_id", versionB).eq("scheduled_date", "2026-09-21").single()).data;
    expect(lesson).toBeTruthy();
    const overlaps = await teacherB.client.rpc("find_programme_event_overlaps", { p_scheduled_lesson_id: lesson!.id });
    expect(overlaps.error).toBeNull();
    expect(overlaps.data).toEqual(expect.arrayContaining([expect.objectContaining({ event_id: event, target_scope: "TARGETED" })]));
    expect((await admin!.from("scheduled_lessons").select("schedule_status")).data ?? []).not.toContainEqual(expect.objectContaining({ schedule_status: "DELIVERED" }));
  });

  it("limits the assignment directory to authorized active teachers and safe fields", async () => {
    const directory = await dosA.client.rpc("list_assignable_teachers", { p_school_id: schoolA });
    expect(directory.error).toBeNull();
    expect(directory.data?.map((row: { membership_id: string }) => row.membership_id)).toEqual([teacherMembershipA, teacherMembershipB]);
    expect(directory.data?.every((row: { membership_id: string; display_name: string }) => Object.keys(row).sort().join(",") === "display_name,membership_id")).toBe(true);
    const adminDirectory = await adminA.client.rpc("list_assignable_teachers", { p_school_id: schoolA });
    expect(adminDirectory.error).toBeNull();
    expect(adminDirectory.data?.map((row: { membership_id: string }) => row.membership_id)).toEqual([teacherMembershipA, teacherMembershipB]);
    expect((await dosA.client.rpc("list_assignable_teachers", { p_school_id: schoolB })).error).toBeTruthy();
    expect((await teacherA.client.rpc("list_assignable_teachers", { p_school_id: schoolA })).error).toBeTruthy();

    await admin!.from("memberships").update({ status: "SUSPENDED" }).eq("id", teacherMembershipB);
    const inactiveDirectory = await dosA.client.rpc("list_assignable_teachers", { p_school_id: schoolA });
    expect(inactiveDirectory.data?.map((row: { membership_id: string }) => row.membership_id)).toEqual([teacherMembershipA]);
    await admin!.from("memberships").update({ status: "ACTIVE" }).eq("id", teacherMembershipB);

    await admin!.from("role_grants").update({ status: "REVOKED", revoked_at: new Date().toISOString() }).eq("membership_id", teacherMembershipB).eq("role", "TEACHER");
    const revokedDirectory = await dosA.client.rpc("list_assignable_teachers", { p_school_id: schoolA });
    expect(revokedDirectory.data?.map((row: { membership_id: string }) => row.membership_id)).toEqual([teacherMembershipA]);
  });

  it("creates programme events and targets atomically through the narrow command", async () => {
    const targeted = await dosA.client.rpc("create_programme_event", { p_school_id: schoolA, p_academic_period_id: periodA, p_event_type: "ASSEMBLY", p_title: `Targeted ${suffix}`, p_starts_at: "2026-11-02T08:00:00+00:00", p_ends_at: "2026-11-02T09:00:00+00:00", p_notes: "Department assembly", p_target_type: "STREAM", p_target_id: streamA });
    expect(targeted.error).toBeNull();
    const target = await admin!.from("programme_event_targets").select("stream_id, class_level_id, department_id").eq("event_id", targeted.data).single();
    expect(target.error).toBeNull();
    expect(target.data).toMatchObject({ stream_id: streamA, class_level_id: null, department_id: null });
    const audit = await admin!.from("audit_events").select("actor_user_id, action, resource_type, resource_id").eq("resource_id", targeted.data).single();
    expect(audit.error).toBeNull();
    expect(audit.data).toMatchObject({ actor_user_id: dosA.id, action: "CREATE", resource_type: "SCHOOL_PROGRAMME_EVENT", resource_id: targeted.data });
    const schoolWide = await dosA.client.rpc("create_programme_event", { p_school_id: schoolA, p_academic_period_id: periodA, p_event_type: "HOLIDAY", p_title: `Whole school ${suffix}`, p_starts_at: "2026-11-03T08:00:00+00:00", p_ends_at: "2026-11-03T09:00:00+00:00", p_notes: "", p_target_type: "SCHOOL", p_target_id: null });
    expect(schoolWide.error).toBeNull();
    expect((await admin!.from("programme_event_targets").select("id").eq("event_id", schoolWide.data)).data).toEqual([]);
    const adminEvent = await adminA.client.rpc("create_programme_event", { p_school_id: schoolA, p_academic_period_id: periodA, p_event_type: "VISITATION", p_title: `Admin event ${suffix}`, p_starts_at: "2026-11-05T08:00:00+00:00", p_ends_at: "2026-11-05T09:00:00+00:00", p_notes: null, p_target_type: "SCHOOL", p_target_id: null });
    expect(adminEvent.error).toBeNull();
    const noPeriod = await multiSchoolDos.client.rpc("create_programme_event", { p_school_id: schoolA, p_academic_period_id: null, p_event_type: "OTHER", p_title: `No period ${suffix}`, p_starts_at: "2026-11-06T08:00:00+00:00", p_ends_at: "2026-11-06T09:00:00+00:00", p_notes: null, p_target_type: "SCHOOL", p_target_id: null });
    expect(noPeriod.error).toBeNull();
    expect((await dosA.client.rpc("create_programme_event", { p_school_id: schoolB, p_academic_period_id: null, p_event_type: "OTHER", p_title: "Wrong school", p_starts_at: "2026-11-07T08:00:00+00:00", p_ends_at: "2026-11-07T09:00:00+00:00", p_notes: null, p_target_type: "SCHOOL", p_target_id: null })).error).toBeTruthy();
    expect((await dosA.client.rpc("create_programme_event", { p_school_id: schoolA, p_academic_period_id: periodB, p_event_type: "OTHER", p_title: "Wrong period", p_starts_at: "2026-11-08T08:00:00+00:00", p_ends_at: "2026-11-08T09:00:00+00:00", p_notes: null, p_target_type: "SCHOOL", p_target_id: null })).error).toBeTruthy();
    expect((await dosA.client.rpc("create_programme_event", { p_school_id: schoolA, p_academic_period_id: null, p_event_type: "OTHER", p_title: "Wrong target", p_starts_at: "2026-11-09T08:00:00+00:00", p_ends_at: "2026-11-09T09:00:00+00:00", p_notes: null, p_target_type: "STREAM", p_target_id: streamB })).error).toBeTruthy();
    expect((await teacherA.client.rpc("create_programme_event", { p_school_id: schoolA, p_academic_period_id: periodA, p_event_type: "ASSEMBLY", p_title: "No", p_starts_at: "2026-11-04T08:00:00+00:00", p_ends_at: "2026-11-04T09:00:00+00:00", p_notes: null, p_target_type: "SCHOOL", p_target_id: null })).error).toBeTruthy();
  });
});
