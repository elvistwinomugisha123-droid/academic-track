import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { safeCurriculumPositionLabel } from "../src/teacher/domain/continuity";

type Row = Record<string, unknown>;
type TestAdmin = SupabaseClient;

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const admin = url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;
const suffix = `step7-${Date.now()}-${randomUUID().slice(0, 8)}`;

type Fixture = {
  userId: string;
  adminUserId: string;
  email: string;
  password: string;
  schoolId: string;
  sectionId: string;
  currentLessonId: string;
  nextLessonId: string;
  currentCanonicalId: string;
  nextCanonicalId: string;
  currentPositionKind: "TOPIC" | "LEARNING_OUTCOME";
  currentTitle: string;
  nextTitle: string;
};

type AssessmentFixture = {
  subjectProfileId: string;
};

let fixture: Fixture | null = null;

function requireResult<T>(data: T | null, error: { message?: string } | null): T {
  if (error || data === null) throw new Error(error?.message || "Acceptance fixture operation failed.");
  return data;
}

async function insertOne(client: TestAdmin, table: string, values: Row): Promise<string> {
  const result = await client.from(table).insert(values).select("id").single();
  const row = requireResult(result.data as Row | null, result.error);
  return String(row.id);
}

function dateInKampala(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const fields = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

async function createFixture(client: TestAdmin): Promise<Fixture> {
  if (!url || !publishableKey || !serviceRoleKey) throw new Error("Step 7 acceptance requires the isolated TEST Supabase secrets.");
  if (!url.includes("lwbkxhimqlfuzzxilaga")) throw new Error("Step 7 acceptance refuses a non-test Supabase project.");

  const email = `${suffix}-teacher@example.test`;
  const password = `Ate-${suffix}-Password!`;
  const userResult = await client.auth.admin.createUser({ email, password, email_confirm: true });
  const user = requireResult(userResult.data.user, userResult.error);
  const adminEmail = `${suffix}-admin@example.test`;
  const adminPassword = `Ate-${suffix}-Admin-Password!`;
  let adminUserId: string | null = null;
  try {
    const adminUserResult = await client.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true });
    adminUserId = String(requireResult(adminUserResult.data.user, adminUserResult.error).id);
  } catch (error) {
    await client.auth.admin.deleteUser(user.id);
    throw error;
  }
  if (!adminUserId) throw new Error("Step 7 acceptance admin fixture user was not created.");
  const adminId = adminUserId;
  let createdSchoolId: string | null = null;
  const now = new Date();
  const today = dateInKampala(now);
  const tomorrow = dateInKampala(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const periodStart = dateInKampala(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const periodEnd = dateInKampala(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
  const assessmentFixture = JSON.parse(readFileSync("test-artifacts/assessment-fixture.json", "utf8")) as AssessmentFixture;
  if (!assessmentFixture.subjectProfileId) throw new Error("Step 7 acceptance requires the isolated synthetic curriculum fixture.");

  let schoolId = "";
  try {
    schoolId = await insertOne(client, "schools", { name: `Step 7 Acceptance School ${suffix}`, slug: suffix, timezone: "Africa/Kampala" });
    createdSchoolId = schoolId;
    const departmentId = await insertOne(client, "departments", { school_id: schoolId, name: `Biology Department ${suffix}`, code: `BIO-${suffix}` });
    const membershipId = await insertOne(client, "memberships", { school_id: schoolId, user_id: user.id, status: "ACTIVE", display_name: `Step 7 Teacher ${suffix}`, joined_at: now.toISOString() });
    const adminMembershipId = await insertOne(client, "memberships", { school_id: schoolId, user_id: adminId, status: "ACTIVE", display_name: `Step 7 School Admin ${suffix}`, joined_at: now.toISOString() });
    await insertOne(client, "role_grants", { membership_id: adminMembershipId, school_id: schoolId, role: "SCHOOL_ADMIN", scope_type: "SCHOOL", granted_by: adminId });
    await insertOne(client, "role_grants", { membership_id: membershipId, school_id: schoolId, role: "TEACHER", scope_type: "SCHOOL", granted_by: adminId });
    const periodId = await insertOne(client, "academic_periods", { school_id: schoolId, name: `Step 7 Term ${suffix}`, period_type: "TERM", academic_year: now.getUTCFullYear(), starts_on: periodStart, ends_on: periodEnd, status: "CURRENT" });
    const levelId = await insertOne(client, "class_levels", { school_id: schoolId, code: `S2-${suffix}`, name: `Senior 2 ${suffix}` });
    const streamId = await insertOne(client, "streams", { school_id: schoolId, class_level_id: levelId, code: `BLUE-${suffix}`, name: `Blue ${suffix}` });
    const profile = requireResult((await client.from("knowledge_subject_profiles").select("id, governed_subject_id, education_level").eq("id", assessmentFixture.subjectProfileId).eq("status", "ACTIVE").eq("runtime_status", "PILOT_ACTIVE").single()).data, null) as Row;
    const profileId = String(profile.id);
    const subjectId = await insertOne(client, "school_subjects", {
      school_id: schoolId,
      department_id: departmentId,
      code: `BIO-${suffix}`,
      name: `Biology ${suffix}`,
      curriculum_subject_id: String(profile.governed_subject_id),
      curriculum_education_level: String(profile.education_level),
    });
    const sectionId = await insertOne(client, "teaching_sections", {
      school_id: schoolId,
      academic_period_id: periodId,
      teacher_membership_id: membershipId,
      school_subject_id: subjectId,
      class_level_id: levelId,
      stream_id: streamId,
      assignment_state: "CONFIRMED",
      confirmed_at: now.toISOString(),
      created_by: user.id,
    });

    const profileRows = requireResult((await client.from("knowledge_profile_records")
      .select("canonical_id, ordering_key, effective_from, effective_to")
      .eq("subject_profile_id", profileId)
      .eq("status", "APPROVED")
      .eq("runtime_status", "PILOT_ACTIVE")
      .or(`effective_from.is.null,effective_from.lte.${today}`)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("ordering_key", { ascending: true, nullsFirst: true })
      .order("canonical_id", { ascending: true })).data, null) as Row[];
    const recordRows = requireResult((await client.from("knowledge_records")
      .select("canonical_id, record_type, normalized, source_wording")
      .in("canonical_id", profileRows.map((row) => String(row.canonical_id)))
      .in("record_type", ["topic", "learning_outcome"])).data, null) as Row[];
    const recordById = new Map(recordRows.map((row) => [String(row.canonical_id), row]));
    const selectableRecords = profileRows
      .map((profileRow) => {
        const record = recordById.get(String(profileRow.canonical_id));
        return record ? { ...record, ordering_key: profileRow.ordering_key } : null;
      })
      .filter((record): record is Row => Boolean(record && (record.record_type === "topic" || record.record_type === "learning_outcome")))
      .sort((left, right) => {
        const orderingComparison = String(left.ordering_key ?? "").localeCompare(String(right.ordering_key ?? ""));
        return orderingComparison || String(left.canonical_id).localeCompare(String(right.canonical_id));
      })
      .slice(0, 300);
    const topics = selectableRecords.filter((record) => record.record_type === "topic");
    const candidates = topics.length >= 2 ? topics : selectableRecords;
    if (selectableRecords.length < 2) throw new Error(`Step 7 fixture requires at least two selectable curriculum positions; found ${selectableRecords.length}.`);
    if (candidates.length < 2) throw new Error("Step 7 fixture could not select two distinct curriculum positions from the app-visible set.");
    const currentRecord = candidates[0];
    const nextRecord = candidates[1];
    const currentCanonicalId = String(currentRecord.canonical_id);
    const nextCanonicalId = String(nextRecord.canonical_id);
    const selectableIds = new Set(selectableRecords.map((record) => String(record.canonical_id)));
    if (!selectableIds.has(currentCanonicalId) || !selectableIds.has(nextCanonicalId)) throw new Error("Step 7 fixture selected a curriculum position outside the app-visible option set.");
    if (currentCanonicalId === nextCanonicalId) throw new Error("Step 7 fixture requires two distinct selectable curriculum positions.");
    const currentPositionKind = currentRecord.record_type === "topic" ? "TOPIC" : currentRecord.record_type === "learning_outcome" ? "LEARNING_OUTCOME" : null;
    if (!currentPositionKind) throw new Error(`Unsupported curriculum position type: ${String(currentRecord.record_type)}.`);

    await insertOne(client, "school_subject_curriculum_bindings", { school_id: schoolId, school_subject_id: subjectId, subject_profile_id: profileId, effective_from: periodStart, bound_by: adminId });
    await insertOne(client, "teaching_section_curriculum_bindings", { school_id: schoolId, teaching_section_id: sectionId, subject_profile_id: profileId, effective_from: periodStart, bound_by: adminId });
    await insertOne(client, "teaching_section_curriculum_position_events", { school_id: schoolId, teaching_section_id: sectionId, subject_profile_id: profileId, canonical_id: currentCanonicalId, position_kind: currentPositionKind, confirmed_by: user.id, confirmed_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() });

    const versionId = await insertOne(client, "timetable_versions", { school_id: schoolId, academic_period_id: periodId, version_number: 1, name: `Step 7 Acceptance Draft ${suffix}`, status: "DRAFT", effective_from: periodStart, created_by: user.id });
    const slotId = await insertOne(client, "timetable_slots", { school_id: schoolId, timetable_version_id: versionId, teaching_section_id: sectionId, day_of_week: 1, starts_at: "08:00", ends_at: "09:00", room_label: "Biology Lab" });
    const currentLessonId = await insertOne(client, "scheduled_lessons", { school_id: schoolId, academic_period_id: periodId, teaching_section_id: sectionId, timetable_version_id: versionId, timetable_slot_id: slotId, scheduled_date: today, starts_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), ends_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), schedule_status: "SCHEDULED" });
    const nextLessonId = await insertOne(client, "scheduled_lessons", { school_id: schoolId, academic_period_id: periodId, teaching_section_id: sectionId, timetable_version_id: versionId, timetable_slot_id: slotId, scheduled_date: tomorrow, starts_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), ends_at: new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString(), schedule_status: "SCHEDULED" });

    return { userId: user.id, adminUserId: adminId, email, password, schoolId, sectionId, currentLessonId, nextLessonId, currentCanonicalId, nextCanonicalId, currentPositionKind, currentTitle: safeCurriculumPositionLabel, nextTitle: safeCurriculumPositionLabel };
  } catch (error) {
    if (createdSchoolId) await cleanupSchool(client, createdSchoolId, [user.id, adminId]);
    else {
      await client.auth.admin.deleteUser(user.id);
      await client.auth.admin.deleteUser(adminId);
    }
    throw error;
  }
}

async function cleanupSchool(client: TestAdmin, schoolId: string, userIds: string[]) {
  for (const [table, column] of [
    ["lesson_preparations", "school_id"],
    ["classroom_events", "school_id"],
    ["audit_events", "school_id"],
    ["teaching_section_curriculum_position_events", "school_id"],
    ["teaching_section_curriculum_bindings", "school_id"],
    ["school_subject_curriculum_bindings", "school_id"],
    ["scheduled_lessons", "school_id"],
    ["timetable_slots", "school_id"],
    ["timetable_versions", "school_id"],
    ["teaching_sections", "school_id"],
    ["streams", "school_id"],
    ["class_levels", "school_id"],
    ["school_subjects", "school_id"],
    ["academic_periods", "school_id"],
    ["role_grants", "school_id"],
    ["memberships", "school_id"],
    ["departments", "school_id"],
    ["schools", "id"],
  ] as const) {
    await client.from(table).delete().eq(column, schoolId);
  }
  for (const userId of userIds) await client.auth.admin.deleteUser(userId);
}

async function cleanupFixture(client: TestAdmin, value: Fixture) {
  await cleanupSchool(client, value.schoolId, [value.userId, value.adminUserId]);
}

async function signIn(page: Page, value: Fixture) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(value.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(value.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/workspace", { timeout: 30_000 });
}

type ViewportWidth = 360 | 390 | 430 | 1440;

type OverflowDiagnostic = {
  selector: string;
  text: string;
  left: number;
  right: number;
  width: number;
  scrollWidth: number;
};

async function findOverflow(page: Page): Promise<{ clientWidth: number; scrollWidth: number; offenders: OverflowDiagnostic[] }> {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const selectorFor = (element: Element) => {
      const node = element as HTMLElement;
      if (node.id) return `#${node.id}`;
      const classes = typeof node.className === "string" ? node.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
      return `${node.tagName.toLowerCase()}${classes.length ? `.${classes.join(".")}` : ""}`;
    };
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *")).flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const overflowX = getComputedStyle(element).overflowX;
      const leaksContent = overflowX === "visible" && element.scrollWidth > element.clientWidth + 1;
      if (rect.width === 0 || (!leaksContent && rect.right <= viewport + 1 && rect.left >= -1)) return [];
      return [{
        selector: selectorFor(element),
        text: (element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 160),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        scrollWidth: element.scrollWidth,
      }];
    });
    return { clientWidth: viewport, scrollWidth: document.documentElement.scrollWidth, offenders };
  });
}

async function capture(page: Page, state: string, width: ViewportWidth) {
  const height = width === 1440 ? 900 : 844;
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(50);
  const diagnostic = await findOverflow(page);
  expect(diagnostic.scrollWidth, `Horizontal overflow at ${width}px: ${JSON.stringify(diagnostic.offenders)}`).toBeLessThanOrEqual(width);
  mkdirSync("output/playwright", { recursive: true });
  await page.screenshot({ path: `output/playwright/step7-${state}-${width}x${height}.png`, fullPage: true });
}

async function captureResponsive(page: Page, state: string) {
  for (const width of [360, 390, 430, 1440] as const) await capture(page, state, width);
}

test.describe("Step 7 authenticated teacher acceptance", () => {
  test.describe.configure({ mode: "serial", retries: 0 });
  test.setTimeout(180_000);
  test.beforeAll(async () => {
    if (!admin || !url || !publishableKey || !serviceRoleKey) throw new Error("Step 7 acceptance requires TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY, and TEST_SUPABASE_SERVICE_ROLE_KEY.");
    fixture = await createFixture(admin);
  });

  test.afterAll(async () => {
    if (admin && fixture) await cleanupFixture(admin, fixture);
  });

  test("completes preparation, classroom evidence, and continuity inheritance", async ({ page }) => {
    const value = fixture!;
    const lessonHeading = new RegExp(`Biology ${suffix} · Senior 2 ${suffix} Blue ${suffix}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, value);

    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
    await expect(page.locator(".next-context-grid strong").filter({ hasText: value.currentTitle }).first()).toBeVisible();
    await captureResponsive(page, "teacher-home");

    await page.goto(`/workspace/teacher/sections/${value.sectionId}`);
    await expect(page.getByRole("heading", { name: value.currentTitle })).toBeVisible();
    await expect(page.getByText("Current confirmed position", { exact: true })).toBeVisible();
    await captureResponsive(page, "teaching-section");

    await page.goto(`/workspace/teacher/lessons/${value.currentLessonId}`);
    await expect(page.getByRole("heading", { name: lessonHeading })).toBeVisible();
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByRole("heading", { name: value.currentTitle, exact: true })).toBeVisible();
    await captureResponsive(page, "lesson-readiness");

    await page.getByLabel("Lesson focus").fill("Cell structure and microscope observation");
    await page.getByLabel("Anything specific to cover?").fill("Identify cell structures and record one factual observation.");
    await page.getByLabel("Your private reminder").fill("Bring the prepared slide set.");
    await page.getByLabel("Resources or setup notes").fill("Start with the carry-forward diagram.");
    await page.getByRole("button", { name: "Save optional notes" }).click();
    await expect(page.getByRole("status")).toContainText("Preparation saved");
    await captureResponsive(page, "saved-preparation");

    await page.reload();
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByLabel("Lesson focus")).toHaveValue("Cell structure and microscope observation");
    await expect(page.getByText(/Saved version/i)).toBeVisible();

    await page.getByRole("button", { name: "Partially delivered" }).click();
    await page.getByLabel("Unfinished work or factual note").fill("Finish the microscope diagram in the next lesson.");
    await page.getByRole("button", { name: "Record classroom outcome" }).click();
    await expect(page.getByRole("status")).toContainText("Recorded: Partially delivered");
    await expect(page.locator(".recorded-outcome").getByText(/Finish the microscope diagram/i)).toBeVisible();
    await captureResponsive(page, "delivery-recording");

    const proposalSelect = page.getByLabel("Adjust proposal");
    await expect(proposalSelect).toBeVisible();
    await expect(proposalSelect.locator(`option[value="${value.nextCanonicalId}"]`)).toHaveCount(1);
    await proposalSelect.selectOption(value.nextCanonicalId);
    await page.getByRole("button", { name: "Confirm next position" }).click();
    await expect(page.getByRole("status")).toContainText("Next curriculum position confirmed");
    await captureResponsive(page, "next-position-confirmation");

    const preparation = requireResult((await admin!.from("lesson_preparations").select("lesson_focus, teacher_notes, intended_coverage, preparation_notes").eq("scheduled_lesson_id", value.currentLessonId).single()).data, null) as Row;
    expect(preparation.lesson_focus).toBe("Cell structure and microscope observation");
    expect(preparation.intended_coverage).toContain("Identify cell structures");
    const event = requireResult((await admin!.from("classroom_events").select("outcome, note").eq("scheduled_lesson_id", value.currentLessonId).single()).data, null) as Row;
    expect(event.outcome).toBe("PARTIALLY_DELIVERED");
    expect(event.note).toContain("Finish the microscope diagram");
    const positions = requireResult((await admin!.from("teaching_section_curriculum_position_events").select("id, canonical_id, supersedes_event_id").eq("school_id", value.schoolId).eq("teaching_section_id", value.sectionId).order("confirmed_at", { ascending: true })).data, null) as Row[];
    expect(positions).toHaveLength(2);
    expect(positions[1].canonical_id).toBe(value.nextCanonicalId);
    expect(positions[1].supersedes_event_id).toBe(positions[0].id);

    await page.goto(`/workspace/teacher/lessons/${value.nextLessonId}`);
    await expect(page.getByRole("heading", { name: lessonHeading })).toBeVisible();
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByRole("heading", { name: value.nextTitle, exact: true })).toBeVisible();
    await expect(page.locator(".readiness-card").filter({ hasText: "Last lesson" }).getByRole("heading", { name: "Partially delivered", exact: true })).toBeVisible();
    await expect(page.locator(".carry-forward-box").getByText(/Finish the microscope diagram/i)).toBeVisible();
    await captureResponsive(page, "next-lesson-inherited-continuity");
  });
});
