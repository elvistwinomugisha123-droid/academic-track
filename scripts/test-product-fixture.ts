/**
 * Creates the deterministic TEST-only fixture used by the product walkthrough.
 *
 * Usage:
 *   npx tsx scripts/test-product-fixture.ts
 *
 * The script refuses every Supabase project except the isolated ATE TEST project.
 * Credentials are generated at runtime and written only to output/playwright,
 * which is ignored by git.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const TEST_PROJECT_REF = "lwbkxhimqlfuzzxilaga";
const FIXTURE_SLUG = "ate-product-validation-test";
type Row = Record<string, unknown>;
type AdminClient = SupabaseClient;

function loadLocalEnvironment() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requireRow<T>(data: T | null, error: { message?: string } | null): T {
  if (error || data === null) throw new Error(error?.message || "TEST fixture operation failed.");
  return data;
}

async function insertOne(client: AdminClient, table: string, values: Row) {
  const result = await client.from(table).insert(values).select("id").single();
  return String(requireRow(result.data as Row | null, result.error).id);
}

function dateInKampala(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const fields = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

async function ensureUser(client: AdminClient, email: string, displayName: string, password: string): Promise<User> {
  const result = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (result.error) throw result.error;
  const existing = result.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const updated = await client.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { display_name: displayName } });
    if (updated.error || !updated.data.user) throw updated.error ?? new Error(`Could not update ${email}.`);
    return updated.data.user;
  }
  const created = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
  if (created.error || !created.data.user) throw created.error ?? new Error(`Could not create ${email}.`);
  return created.data.user;
}

async function cleanupSchool(client: AdminClient, schoolId: string) {
  const membershipResult = await client.from("memberships").select("user_id").eq("school_id", schoolId);
  const userIds = (membershipResult.data ?? []).map((row) => String(row.user_id));
  const tables: Array<[string, string]> = [
    ["assessment_ai_generation_runs", "school_id"], ["assessment_scope_items", "school_id"], ["assessment_workspace_sections", "school_id"], ["assessment_versions", "school_id"], ["assessment_workspaces", "school_id"],
    ["lesson_preparations", "school_id"], ["classroom_events", "school_id"], ["programme_event_targets", "school_id"], ["school_programme_events", "school_id"], ["audit_events", "school_id"],
    ["teaching_section_curriculum_position_events", "school_id"], ["teaching_section_curriculum_bindings", "school_id"],
    ["school_subject_curriculum_bindings", "school_id"], ["scheduled_lessons", "school_id"], ["timetable_slots", "school_id"],
    ["timetable_versions", "school_id"], ["teaching_sections", "school_id"], ["streams", "school_id"], ["class_levels", "school_id"],
    ["school_subjects", "school_id"], ["academic_periods", "school_id"], ["role_grants", "school_id"], ["memberships", "school_id"],
    ["departments", "school_id"], ["schools", "id"],
  ];
  for (const [table, column] of tables) {
    const result = await client.from(table).delete().eq(column, schoolId);
    if (result.error) throw new Error(`Could not reset TEST fixture table ${table}: ${result.error.message}`);
  }
  for (const userId of userIds) await client.auth.admin.deleteUser(userId);
}

async function main() {
  const url = env("TEST_SUPABASE_URL");
  const serviceRoleKey = env("TEST_SUPABASE_SERVICE_ROLE_KEY");
  if (!url.includes(TEST_PROJECT_REF)) throw new Error(`Refusing to run outside isolated TEST project ${TEST_PROJECT_REF}.`);
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to create TEST fixtures in production mode.");
  const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = randomUUID().slice(0, 8);
  const password = `Ate-Test-${Date.now()}-${suffix}!`;
  const accounts = {
    schoolAdmin: { email: `ate.admin+${suffix}@test.invalid`, name: "Sarah Nakato" },
    teacher: { email: `ate.teacher+${suffix}@test.invalid`, name: "Amina Nsubuga" },
    hod: { email: `ate.hod+${suffix}@test.invalid`, name: "Daniel Okello" },
    dos: { email: `ate.dos+${suffix}@test.invalid`, name: "Grace Namusoke" },
    principal: { email: `ate.principal+${suffix}@test.invalid`, name: "Peter Ouma" },
  } as const;
  const users = {
    schoolAdmin: await ensureUser(client, accounts.schoolAdmin.email, accounts.schoolAdmin.name, password),
    teacher: await ensureUser(client, accounts.teacher.email, accounts.teacher.name, password),
    hod: await ensureUser(client, accounts.hod.email, accounts.hod.name, password),
    dos: await ensureUser(client, accounts.dos.email, accounts.dos.name, password),
    principal: await ensureUser(client, accounts.principal.email, accounts.principal.name, password),
  };

  // Classroom history is append-only by design. Each run therefore receives a
  // fresh school slug while reusing the named TEST accounts and no production data.
  const fixtureSlug = `${FIXTURE_SLUG}-${suffix}`;

  const now = new Date();
  const today = dateInKampala(now);
  const yesterday = dateInKampala(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const twoDaysAgo = dateInKampala(new Date(now.getTime() - 48 * 60 * 60 * 1000));
  const tomorrow = dateInKampala(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const periodStart = dateInKampala(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
  const periodEnd = dateInKampala(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000));
  const schoolId = await insertOne(client, "schools", { name: "ATE Product Validation School", slug: fixtureSlug, timezone: "Africa/Kampala" });
  const departmentId = await insertOne(client, "departments", { school_id: schoolId, name: "Biology Department", code: `BIO-${suffix}` });
  const periodId = await insertOne(client, "academic_periods", { school_id: schoolId, name: "Term 3 2026", period_type: "TERM", academic_year: 2026, starts_on: periodStart, ends_on: periodEnd, status: "CURRENT" });
  const schoolAdminMembershipId = await insertOne(client, "memberships", { school_id: schoolId, user_id: users.schoolAdmin.id, status: "ACTIVE", display_name: accounts.schoolAdmin.name, joined_at: now.toISOString() });
  const teacherMembershipId = await insertOne(client, "memberships", { school_id: schoolId, user_id: users.teacher.id, status: "ACTIVE", display_name: accounts.teacher.name, joined_at: now.toISOString() });
  const hodMembershipId = await insertOne(client, "memberships", { school_id: schoolId, user_id: users.hod.id, status: "ACTIVE", display_name: accounts.hod.name, joined_at: now.toISOString() });
  const dosMembershipId = await insertOne(client, "memberships", { school_id: schoolId, user_id: users.dos.id, status: "ACTIVE", display_name: accounts.dos.name, joined_at: now.toISOString() });
  const principalMembershipId = await insertOne(client, "memberships", { school_id: schoolId, user_id: users.principal.id, status: "ACTIVE", display_name: accounts.principal.name, joined_at: now.toISOString() });
  await client.from("role_grants").insert([
    { membership_id: schoolAdminMembershipId, school_id: schoolId, role: "SCHOOL_ADMIN", scope_type: "SCHOOL", granted_by: users.schoolAdmin.id },
    { membership_id: teacherMembershipId, school_id: schoolId, role: "TEACHER", scope_type: "SCHOOL", granted_by: users.dos.id },
    { membership_id: hodMembershipId, school_id: schoolId, role: "HOD", scope_type: "DEPARTMENT", department_id: departmentId, granted_by: users.dos.id },
    { membership_id: dosMembershipId, school_id: schoolId, role: "DOS", scope_type: "SCHOOL", granted_by: users.dos.id },
    { membership_id: principalMembershipId, school_id: schoolId, role: "PRINCIPAL", scope_type: "SCHOOL", granted_by: users.dos.id },
  ]);
  const profileResult = await client.from("knowledge_subject_profiles").select("id, release_id, governed_subject_id, education_level").eq("profile_key", "UG-LSC-BIOLOGY-2019-REFERENCE").eq("status", "ACTIVE").eq("runtime_status", "PILOT_ACTIVE").single();
  const profile = requireRow(profileResult.data as Row | null, profileResult.error);
  const profileId = String(profile.id);
  const subjectId = await insertOne(client, "school_subjects", { school_id: schoolId, department_id: departmentId, code: "BIO", name: "Biology", curriculum_subject_id: String(profile.governed_subject_id), curriculum_education_level: String(profile.education_level) });
  const levelId = await insertOne(client, "class_levels", { school_id: schoolId, code: "S2", name: "Senior 2" });
  const streamAId = await insertOne(client, "streams", { school_id: schoolId, class_level_id: levelId, code: "A", name: "Stream A" });
  const streamBId = await insertOne(client, "streams", { school_id: schoolId, class_level_id: levelId, code: "B", name: "Stream B" });
  const sectionAId = await insertOne(client, "teaching_sections", { school_id: schoolId, academic_period_id: periodId, teacher_membership_id: teacherMembershipId, school_subject_id: subjectId, class_level_id: levelId, stream_id: streamAId, assignment_state: "CONFIRMED", operational_status: "ACTIVE", confirmed_at: now.toISOString(), created_by: users.dos.id });
  const sectionBId = await insertOne(client, "teaching_sections", { school_id: schoolId, academic_period_id: periodId, teacher_membership_id: teacherMembershipId, school_subject_id: subjectId, class_level_id: levelId, stream_id: streamBId, assignment_state: "CONFIRMED", operational_status: "ACTIVE", confirmed_at: now.toISOString(), created_by: users.dos.id });
  await insertOne(client, "school_subject_curriculum_bindings", { school_id: schoolId, school_subject_id: subjectId, subject_profile_id: profileId, effective_from: periodStart, bound_by: users.dos.id });
  await client.from("teaching_section_curriculum_bindings").insert([
    { school_id: schoolId, teaching_section_id: sectionAId, subject_profile_id: profileId, effective_from: periodStart, bound_by: users.dos.id },
    { school_id: schoolId, teaching_section_id: sectionBId, subject_profile_id: profileId, effective_from: periodStart, bound_by: users.dos.id },
  ]);
  const recordsResult = await client.from("knowledge_profile_records").select("canonical_id, ordering_key").eq("subject_profile_id", profileId).eq("status", "APPROVED").eq("runtime_status", "PILOT_ACTIVE").order("ordering_key", { ascending: true, nullsFirst: true }).limit(4);
  const records = requireRow(recordsResult.data as Row[] | null, recordsResult.error);
  if (records.length < 2) throw new Error("TEST fixture requires two approved pilot curriculum positions.");
  const currentCanonicalId = String(records[0].canonical_id);
  const nextCanonicalId = String(records[1].canonical_id);
  const currentPositionEventId = await insertOne(client, "teaching_section_curriculum_position_events", { school_id: schoolId, teaching_section_id: sectionAId, subject_profile_id: profileId, canonical_id: currentCanonicalId, position_kind: "TOPIC", confirmed_by: users.teacher.id, confirmed_at: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString() });
  await insertOne(client, "teaching_section_curriculum_position_events", { school_id: schoolId, teaching_section_id: sectionBId, subject_profile_id: profileId, canonical_id: currentCanonicalId, position_kind: "TOPIC", confirmed_by: users.teacher.id, confirmed_at: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString() });
  const timetableId = await insertOne(client, "timetable_versions", { school_id: schoolId, academic_period_id: periodId, version_number: 1, name: "Term 3 2026 timetable", status: "DRAFT", effective_from: periodStart, created_by: users.dos.id });
  const slotAId = await insertOne(client, "timetable_slots", { school_id: schoolId, timetable_version_id: timetableId, teaching_section_id: sectionAId, day_of_week: 1, starts_at: "08:00", ends_at: "09:00", room_label: "Biology lab" });
  const slotBId = await insertOne(client, "timetable_slots", { school_id: schoolId, timetable_version_id: timetableId, teaching_section_id: sectionBId, day_of_week: 2, starts_at: "10:00", ends_at: "11:00", room_label: "Room B2" });
  await insertOne(client, "school_programme_events", { school_id: schoolId, academic_period_id: periodId, event_type: "ASSEMBLY", title: "Validation assembly", starts_at: new Date(now.getTime() - 26 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(), ends_at: new Date(now.getTime() - 25 * 60 * 60 * 1000 - 15 * 60 * 1000).toISOString(), notes: "Synthetic TEST programme event for overlap review.", created_by: users.dos.id });
  const unconfirmedLessonId = await insertOne(client, "scheduled_lessons", { school_id: schoolId, academic_period_id: periodId, teaching_section_id: sectionAId, timetable_version_id: timetableId, timetable_slot_id: slotAId, scheduled_date: twoDaysAgo, starts_at: new Date(now.getTime() - 50 * 60 * 60 * 1000).toISOString(), ends_at: new Date(now.getTime() - 49 * 60 * 60 * 1000).toISOString(), schedule_status: "SCHEDULED" });
  const currentLessonId = await insertOne(client, "scheduled_lessons", { school_id: schoolId, academic_period_id: periodId, teaching_section_id: sectionAId, timetable_version_id: timetableId, timetable_slot_id: slotAId, scheduled_date: yesterday, starts_at: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(), ends_at: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), schedule_status: "SCHEDULED" });
  const nextLessonId = await insertOne(client, "scheduled_lessons", { school_id: schoolId, academic_period_id: periodId, teaching_section_id: sectionAId, timetable_version_id: timetableId, timetable_slot_id: slotAId, scheduled_date: today, starts_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), ends_at: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(), schedule_status: "SCHEDULED" });
  const parallelLessonId = await insertOne(client, "scheduled_lessons", { school_id: schoolId, academic_period_id: periodId, teaching_section_id: sectionBId, timetable_version_id: timetableId, timetable_slot_id: slotBId, scheduled_date: tomorrow, starts_at: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString(), ends_at: new Date(now.getTime() + 27 * 60 * 60 * 1000).toISOString(), schedule_status: "SCHEDULED" });
  await insertOne(client, "lesson_preparations", { school_id: schoolId, scheduled_lesson_id: nextLessonId, teaching_section_id: sectionAId, curriculum_position_event_id: currentPositionEventId, curriculum_canonical_id: nextCanonicalId, curriculum_profile_id: profileId, created_by: users.teacher.id, updated_by: users.teacher.id });
  await insertOne(client, "classroom_events", { school_id: schoolId, scheduled_lesson_id: currentLessonId, teaching_section_id: sectionAId, actor_membership_id: teacherMembershipId, outcome: "PARTIALLY_DELIVERED", note: "Finish the microscope diagram in the next lesson.", occurred_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() });
  await insertOne(client, "classroom_events", { school_id: schoolId, scheduled_lesson_id: parallelLessonId, teaching_section_id: sectionBId, actor_membership_id: teacherMembershipId, outcome: "DELIVERED", note: null, occurred_at: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString() });

  const fixture = { schoolId, sectionAId, sectionBId, unconfirmedLessonId, currentLessonId, nextLessonId, currentCanonicalId, nextCanonicalId, curriculumProfileId: profileId, password, accounts, generatedAt: now.toISOString() };
  await mkdir("output/playwright", { recursive: true });
  await writeFile("output/playwright/product-fixture.json", `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(`TEST fixture ready: ${fixtureSlug}`);
  console.log("Walkthrough credentials (temporary; generated for this reset):");
  for (const [role, account] of Object.entries(accounts)) console.log(`${role}: ${account.email} / ${password}`);
  console.log("Fixture file: output/playwright/product-fixture.json");
}

loadLocalEnvironment();
main().catch((error) => {
  console.error(`TEST fixture failed: ${error instanceof Error ? error.message : "unknown fixture error"}`);
  process.exitCode = 1;
});
