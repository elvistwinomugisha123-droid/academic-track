import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const testProjectRef = "lwbkxhimqlfuzzxilaga";
const admin = url && serviceKey ? createClient(url, serviceKey) : null;
const suffix = `knowledge-binding-${Date.now()}`;

type TestUser = { id: string; email: string; password: string; client: SupabaseClient };
type Row = Record<string, unknown>;

let schoolA = "";
let schoolB = "";
let subjectA = "";
let subjectB = "";
let sectionA = "";
let sectionA2 = "";
let sectionB = "";
let teacherA: TestUser;
let teacherB: TestUser;
let dosA: TestUser;
let adminA: TestUser;
let teacherMembershipA = "";
let teacherMembershipB = "";
let profileId = "";
let governedSubjectId = "";
let canonicalId = "";
let initialEventId = "";
let correctionEventId = "";
let syntheticWrongSubjectId = "";

function requireConfigured() {
  if (!url || !publishableKey || !serviceKey || !admin) throw new Error("Curriculum binding acceptance requires isolated TEST Supabase credentials.");
  if (!url.includes(testProjectRef)) throw new Error("Refusing curriculum binding acceptance outside ATE_Security_Test.");
}

function requireResult<T>(data: T | null, error: { message: string } | null): T {
  if (error || data === null) throw error ?? new Error("Expected Supabase data");
  return data;
}

async function createUser(label: string): Promise<TestUser> {
  const email = `${suffix}-${label}@example.test`;
  const password = `Ate-${suffix}-${label}-Password!`;
  const result = await admin!.auth.admin.createUser({ email, password, email_confirm: true });
  const user = requireResult(result.data.user, result.error);
  return { id: user.id, email, password, client: createClient(url!, publishableKey!) };
}

async function signIn(user: TestUser) {
  const result = await user.client.auth.signInWithPassword({ email: user.email, password: user.password });
  expect(result.error).toBeNull();
}

async function insertOne(table: string, values: Row): Promise<string> {
  const result = await admin!.from(table).insert(values).select("id").single();
  const row = requireResult(result.data as Row | null, result.error);
  return row.id as string;
}

async function expectError(result: { error: unknown }) {
  expect(result.error).toBeTruthy();
}

describe("live Step 6 curriculum binding acceptance", () => {
  beforeAll(async () => {
    requireConfigured();
    [teacherA, teacherB, dosA, adminA] = await Promise.all([createUser("teacher-a"), createUser("teacher-b"), createUser("dos-a"), createUser("admin-a")]);
    const users = [teacherA, teacherB, dosA, adminA];
    const schools = requireResult((await admin!.from("schools").insert([
      { name: `Knowledge Binding A ${suffix}`, slug: `${suffix}-a` },
      { name: `Knowledge Binding B ${suffix}`, slug: `${suffix}-b` },
    ]).select("id, slug")).data, null);
    schoolA = schools.find((row) => row.slug.endsWith("-a"))!.id;
    schoolB = schools.find((row) => row.slug.endsWith("-b"))!.id;

    const profile = requireResult((await admin!.from("knowledge_subject_profiles").select("id, governed_subject_id, education_level").eq("profile_key", "UG-LSC-BIOLOGY-2019-REFERENCE").single()).data, null);
    profileId = profile.id;
    governedSubjectId = profile.governed_subject_id;
    const record = requireResult((await admin!.from("knowledge_profile_records").select("canonical_id").eq("subject_profile_id", profileId).eq("runtime_status", "PILOT_ACTIVE").eq("status", "APPROVED").in("canonical_id", (await admin!.from("knowledge_records").select("canonical_id").eq("record_type", "topic")).data?.map((row) => row.canonical_id) ?? []).limit(1).single()).data, null);
    canonicalId = record.canonical_id;

    const memberships = requireResult((await admin!.from("memberships").insert([
      { school_id: schoolA, user_id: teacherA.id, status: "ACTIVE", display_name: teacherA.email, joined_at: new Date().toISOString() },
      { school_id: schoolA, user_id: dosA.id, status: "ACTIVE", display_name: dosA.email, joined_at: new Date().toISOString() },
      { school_id: schoolA, user_id: adminA.id, status: "ACTIVE", display_name: adminA.email, joined_at: new Date().toISOString() },
      { school_id: schoolB, user_id: teacherB.id, status: "ACTIVE", display_name: teacherB.email, joined_at: new Date().toISOString() },
    ]).select("id, user_id, school_id")).data, null);
    teacherMembershipA = memberships.find((row) => row.user_id === teacherA.id)!.id;
    teacherMembershipB = memberships.find((row) => row.user_id === teacherB.id)!.id;
    const dosMembership = memberships.find((row) => row.user_id === dosA.id)!.id;
    const adminMembership = memberships.find((row) => row.user_id === adminA.id)!.id;
    const roleGrantResult = await admin!.from("role_grants").insert([
      { membership_id: teacherMembershipA, school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: dosMembership, school_id: schoolA, role: "DOS", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: adminMembership, school_id: schoolA, role: "SCHOOL_ADMIN", scope_type: "SCHOOL", granted_by: adminA.id },
      { membership_id: teacherMembershipB, school_id: schoolB, role: "TEACHER", scope_type: "SCHOOL", granted_by: adminA.id },
    ]);
    expect(roleGrantResult.error).toBeNull();

    const wrongSubject = await admin!.from("knowledge_curriculum_subjects").insert({ subject_key: `TEST-WRONG-${suffix}`, title: `TEST Wrong Subject ${suffix}`, education_level: "lower-secondary", status: "DRAFT" }).select("id").single();
    syntheticWrongSubjectId = requireResult(wrongSubject.data, wrongSubject.error).id;
    subjectA = await insertOne("school_subjects", { school_id: schoolA, name: `Biology ${suffix}`, curriculum_subject_id: governedSubjectId, curriculum_education_level: "lower-secondary" });
    subjectB = await insertOne("school_subjects", { school_id: schoolB, name: `Biology ${suffix}`, curriculum_subject_id: governedSubjectId, curriculum_education_level: "lower-secondary" });
    const periodA = await insertOne("academic_periods", { school_id: schoolA, name: `Term ${suffix}`, period_type: "TERM", academic_year: 2026, starts_on: "2026-01-01", ends_on: "2026-12-31", status: "CURRENT" });
    const periodB = await insertOne("academic_periods", { school_id: schoolB, name: `Term ${suffix}`, period_type: "TERM", academic_year: 2026, starts_on: "2026-01-01", ends_on: "2026-12-31", status: "CURRENT" });
    const levelA = await insertOne("class_levels", { school_id: schoolA, code: `S2-${suffix}`, name: `S2 ${suffix}` });
    const levelB = await insertOne("class_levels", { school_id: schoolB, code: `S2-${suffix}`, name: `S2 ${suffix}` });
    const streamA = await insertOne("streams", { school_id: schoolA, class_level_id: levelA, code: `A-${suffix}`, name: `A ${suffix}` });
    const streamA2 = await insertOne("streams", { school_id: schoolA, class_level_id: levelA, code: `B-${suffix}`, name: `B ${suffix}` });
    const streamB = await insertOne("streams", { school_id: schoolB, class_level_id: levelB, code: `A-${suffix}`, name: `A ${suffix}` });
    sectionA = await insertOne("teaching_sections", { school_id: schoolA, academic_period_id: periodA, teacher_membership_id: teacherMembershipA, school_subject_id: subjectA, class_level_id: levelA, stream_id: streamA, created_by: adminA.id });
    sectionA2 = await insertOne("teaching_sections", { school_id: schoolA, academic_period_id: periodA, teacher_membership_id: teacherMembershipA, school_subject_id: subjectA, class_level_id: levelA, stream_id: streamA2, created_by: adminA.id });
    sectionB = await insertOne("teaching_sections", { school_id: schoolB, academic_period_id: periodB, teacher_membership_id: teacherMembershipB, school_subject_id: subjectB, class_level_id: levelB, stream_id: streamB, created_by: adminA.id });
    await Promise.all(users.map(signIn));
  });

  afterAll(async () => {
    if (!admin) return;
    for (const schoolId of [schoolA, schoolB]) {
      if (!schoolId) continue;
      await admin.from("teaching_section_curriculum_bindings").delete().eq("school_id", schoolId);
      await admin.from("school_subject_curriculum_bindings").delete().eq("school_id", schoolId);
      await admin.from("teaching_sections").delete().eq("school_id", schoolId);
      await admin.from("streams").delete().eq("school_id", schoolId);
      await admin.from("class_levels").delete().eq("school_id", schoolId);
      await admin.from("academic_periods").delete().eq("school_id", schoolId);
      await admin.from("school_subjects").delete().eq("school_id", schoolId);
      await admin.from("role_grants").delete().eq("school_id", schoolId);
      await admin.from("memberships").delete().eq("school_id", schoolId);
      await admin.from("schools").delete().eq("id", schoolId);
    }
    if (syntheticWrongSubjectId) await admin.from("knowledge_curriculum_subjects").delete().eq("id", syntheticWrongSubjectId);
    for (const user of [teacherA, teacherB, dosA, adminA]) if (user?.id) await admin.auth.admin.deleteUser(user.id);
  });

  it("accepts the correct tenant, Biology identity, and level", async () => {
    const result = await dosA.client.from("school_subject_curriculum_bindings").insert({ school_id: schoolA, school_subject_id: subjectA, subject_profile_id: profileId, effective_from: "2026-01-01", bound_by: dosA.id }).select("id").single();
    expect(result.error).toBeNull();
  });

  it("accepts a Teaching Section whose school subject is correctly bound", async () => {
    const result = await dosA.client.from("teaching_section_curriculum_bindings").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, effective_from: "2026-01-01", bound_by: dosA.id }).select("id").single();
    expect(result.error).toBeNull();
  });

  it("rejects cross-tenant subject and Teaching Section bindings", async () => {
    await expectError(await dosA.client.from("school_subject_curriculum_bindings").insert({ school_id: schoolA, school_subject_id: subjectB, subject_profile_id: profileId, effective_from: "2026-01-01", bound_by: dosA.id }));
    await expectError(await dosA.client.from("teaching_section_curriculum_bindings").insert({ school_id: schoolA, teaching_section_id: sectionB, subject_profile_id: profileId, effective_from: "2026-01-01", bound_by: dosA.id }));
    expect((await teacherA.client.from("school_subject_curriculum_bindings").select("id").eq("school_id", schoolB)).data).toEqual([]);
  });

  it("rejects wrong subject identity and wrong education level", async () => {
    expect((await admin!.from("school_subjects").update({ curriculum_subject_id: syntheticWrongSubjectId }).eq("id", subjectA)).error).toBeNull();
    await expectError(await dosA.client.from("school_subject_curriculum_bindings").insert({ school_id: schoolA, school_subject_id: subjectA, subject_profile_id: profileId, effective_from: "2026-02-01", bound_by: dosA.id }));
    expect((await admin!.from("school_subjects").update({ curriculum_subject_id: governedSubjectId, curriculum_education_level: "advanced-secondary" }).eq("id", subjectA)).error).toBeNull();
    await expectError(await dosA.client.from("school_subject_curriculum_bindings").insert({ school_id: schoolA, school_subject_id: subjectA, subject_profile_id: profileId, effective_from: "2026-02-01", bound_by: dosA.id }));
    expect((await admin!.from("school_subjects").update({ curriculum_education_level: "lower-secondary" }).eq("id", subjectA)).error).toBeNull();
  });

  it("requires authorised binding actors and accepts the assigned teacher position", async () => {
    await expectError(await teacherA.client.from("school_subject_curriculum_bindings").insert({ school_id: schoolA, school_subject_id: subjectA, subject_profile_id: profileId, effective_from: "2026-02-01", bound_by: teacherA.id }));
    const result = await teacherA.client.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: teacherA.id, confirmed_at: "2026-02-01T09:00:00Z" }).select("id, supersedes_event_id, correction_reason").single();
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ supersedes_event_id: null, correction_reason: null });
    initialEventId = result.data!.id;
  });

  it("rejects a position outside the bound profile and invalid initial correction shape", async () => {
    await expectError(await teacherA.client.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: "00000000-0000-0000-0000-000000000999", canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: teacherA.id, confirmed_at: "2026-02-02T09:00:00Z" }));
    await expectError(await teacherA.client.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: teacherA.id, correction_reason: "Initial event cannot be a correction." }));
  });

  it("preserves append-only correction history and resolves one terminal event", async () => {
    const correction = await teacherA.client.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "LEARNING_OUTCOME", confirmed_by: teacherA.id, confirmed_at: "2026-02-03T09:00:00Z", supersedes_event_id: initialEventId, correction_reason: "Teacher corrected the selected curriculum position." }).select("id, supersedes_event_id, correction_reason").single();
    expect(correction.error).toBeNull();
    correctionEventId = correction.data!.id;
    await expectError(await admin!.from("teaching_section_curriculum_position_events").update({ correction_reason: "mutation" }).eq("id", initialEventId));
    await expectError(await admin!.from("teaching_section_curriculum_position_events").delete().eq("id", initialEventId));
    await expectError(await teacherA.client.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: teacherA.id, supersedes_event_id: initialEventId, correction_reason: "Second successor is forbidden." }));
    const wrongPredecessor = await teacherA.client.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA2, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: teacherA.id, supersedes_event_id: initialEventId, correction_reason: "Wrong Teaching Section." });
    await expectError(wrongPredecessor);
    const events = requireResult((await admin!.from("teaching_section_curriculum_position_events").select("id, supersedes_event_id, confirmed_at").eq("school_id", schoolA).eq("teaching_section_id", sectionA).order("confirmed_at", { ascending: true }).order("id", { ascending: true })).data, null);
    const successors = new Set(events.map((event) => event.supersedes_event_id).filter(Boolean));
    const terminal = events.filter((event) => !successors.has(event.id));
    expect(terminal).toHaveLength(1);
    expect(terminal[0].id).toBe(correctionEventId);
  });

  it("rejects unrelated or inactive teachers while DOS and SCHOOL_ADMIN retain override authority", async () => {
    await expectError(await teacherB.client.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: teacherB.id, supersedes_event_id: correctionEventId, correction_reason: "Cross-tenant actor." }));

    const eventRows = requireResult((await admin!.from("teaching_section_curriculum_position_events").select("id, supersedes_event_id").eq("school_id", schoolA).eq("teaching_section_id", sectionA)).data, null);
    const supersededIds = new Set(eventRows.map((event) => event.supersedes_event_id).filter(Boolean));
    const terminal = eventRows.find((event) => !supersededIds.has(event.id));
    expect(terminal).toBeTruthy();

    try {
      await admin!.from("memberships").update({ status: "SUSPENDED" }).eq("id", teacherMembershipA);
      await expectError(await admin!.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: teacherA.id, supersedes_event_id: terminal!.id, correction_reason: "Suspended assigned teacher." }));

      const dosSuspendedCorrection = await admin!.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: dosA.id, supersedes_event_id: terminal!.id, correction_reason: "DOS correction while assigned teacher is suspended." }).select("id").single();
      const dosSuspendedEvent = requireResult(dosSuspendedCorrection.data as Row | null, dosSuspendedCorrection.error);

      await admin!.from("memberships").update({ status: "REVOKED" }).eq("id", teacherMembershipA);
      await expectError(await admin!.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: teacherA.id, supersedes_event_id: dosSuspendedEvent.id, correction_reason: "Revoked assigned teacher." }));

      const dosRevokedCorrection = await admin!.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: dosA.id, supersedes_event_id: dosSuspendedEvent.id, correction_reason: "DOS correction while assigned teacher is revoked." }).select("id").single();
      const dosRevokedEvent = requireResult(dosRevokedCorrection.data as Row | null, dosRevokedCorrection.error);

      const schoolAdminCorrection = await admin!.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: adminA.id, supersedes_event_id: dosRevokedEvent.id, correction_reason: "SCHOOL_ADMIN correction while assigned teacher is revoked." }).select("id").single();
      const schoolAdminEvent = requireResult(schoolAdminCorrection.data as Row | null, schoolAdminCorrection.error);

      await expectError(await admin!.from("teaching_section_curriculum_position_events").insert({ school_id: schoolA, teaching_section_id: sectionA, subject_profile_id: profileId, canonical_id: canonicalId, position_kind: "TOPIC", confirmed_by: teacherB.id, supersedes_event_id: schoolAdminEvent.id, correction_reason: "Unrelated teacher." }));
    } finally {
      await admin!.from("memberships").update({ status: "ACTIVE" }).eq("id", teacherMembershipA);
    }
  });
});
