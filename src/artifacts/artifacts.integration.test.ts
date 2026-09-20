import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const admin = url && serviceKey ? createClient(url, serviceKey) : null;
const suffix = `artifacts-${Date.now()}`;
type TestUser = { id: string; email: string; password: string; client: SupabaseClient };
let schoolA = "";
let schoolB = "";
let teacherMembershipA = "";
let teacherMembershipB = "";
let teacherMembershipB2 = "";
let sectionA = "";
let sectionB = "";
let sectionB2 = "";
let lessonA = "";
let lessonOtherSection = "";
let lessonB = "";
let teacherA: TestUser;
let teacherB: TestUser;
let teacherB2: TestUser;

const required = <T>(data: T | null, error: { message: string } | null): T => { if (error || data === null) throw error ?? new Error("Expected test data"); return data; };
async function user(label: string): Promise<TestUser> { const email = `${suffix}-${label}@example.test`; const password = `Ate-${suffix}-${label}-Password!`; const result = await admin!.auth.admin.createUser({ email, password, email_confirm: true }); const created = required(result.data.user, result.error); return { id: created.id, email, password, client: createClient(url!, publishableKey!) }; }
async function insert(table: string, values: Record<string, unknown>): Promise<string> { const result = await admin!.from(table).insert(values).select("id").single(); return String(required(result.data, result.error).id); }
function planContent(title: string) { return { title, curriculumAnchor: null, learningIntention: "", expectedOutcome: "", priorLearning: "", continuityContext: "", lessonFocus: "Cells", intendedCoverage: "", durationMinutes: 60, resources: [], teachingSequence: [], differentiation: "", conclusionFollowUp: "", teacherNotes: "" }; }

describe("isolated lesson artifact integration", () => {
  beforeAll(async () => {
    if (!url || !publishableKey || !serviceKey || !admin) throw new Error("Lesson artifact integration requires the isolated TEST Supabase project. No production fallback is permitted.");
    [teacherA, teacherB, teacherB2] = await Promise.all([user("teacher-a"), user("teacher-b"), user("teacher-b2")]);
    const schools = required((await admin.from("schools").insert([{ name: `Artifact Test A ${suffix}`, slug: `${suffix}-a` }, { name: `Artifact Test B ${suffix}`, slug: `${suffix}-b` }]).select("id, slug")).data, null);
    schoolA = schools.find((row) => row.slug.endsWith("-a"))!.id;
    schoolB = schools.find((row) => row.slug.endsWith("-b"))!.id;

    const departmentA = await insert("departments", { school_id: schoolA, name: `Biology ${suffix}`, code: `BIO-${suffix}` });
    const departmentB = await insert("departments", { school_id: schoolB, name: `Chemistry ${suffix}`, code: `CHEM-${suffix}` });
    teacherMembershipA = await insert("memberships", { school_id: schoolA, user_id: teacherA.id, status: "ACTIVE", display_name: teacherA.email, joined_at: new Date().toISOString() });
    teacherMembershipB = await insert("memberships", { school_id: schoolA, user_id: teacherB.id, status: "ACTIVE", display_name: teacherB.email, joined_at: new Date().toISOString() });
    teacherMembershipB2 = await insert("memberships", { school_id: schoolB, user_id: teacherB2.id, status: "ACTIVE", display_name: teacherB2.email, joined_at: new Date().toISOString() });
    await admin.from("role_grants").insert([
      { membership_id: teacherMembershipA, school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: teacherA.id },
      { membership_id: teacherMembershipB, school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: teacherA.id },
      { membership_id: teacherMembershipB2, school_id: schoolB, role: "TEACHER", scope_type: "SCHOOL", granted_by: teacherB2.id },
    ]);

    const periodA = await insert("academic_periods", { school_id: schoolA, name: `Term ${suffix}`, period_type: "TERM", academic_year: 2026, starts_on: "2026-01-01", ends_on: "2026-12-31", status: "CURRENT" });
    const levelA = await insert("class_levels", { school_id: schoolA, code: `S2-${suffix}`, name: `Senior 2 ${suffix}` });
    const streamA = await insert("streams", { school_id: schoolA, class_level_id: levelA, code: `BLUE-${suffix}`, name: `Blue ${suffix}` });
    const subjectA = await insert("school_subjects", { school_id: schoolA, department_id: departmentA, code: `BIO-${suffix}`, name: `Biology ${suffix}` });
    sectionA = await insert("teaching_sections", { school_id: schoolA, academic_period_id: periodA, teacher_membership_id: teacherMembershipA, school_subject_id: subjectA, class_level_id: levelA, stream_id: streamA, assignment_state: "CONFIRMED", confirmed_at: new Date().toISOString(), created_by: teacherA.id });
    sectionB = await insert("teaching_sections", { school_id: schoolA, academic_period_id: periodA, teacher_membership_id: teacherMembershipB, school_subject_id: subjectA, class_level_id: levelA, stream_id: streamA, assignment_state: "CONFIRMED", confirmed_at: new Date().toISOString(), created_by: teacherA.id });
    const timetableA = await insert("timetable_versions", { school_id: schoolA, academic_period_id: periodA, version_number: 1, name: `Draft ${suffix}`, status: "DRAFT", effective_from: "2026-01-01", created_by: teacherA.id });
    const slotA = await insert("timetable_slots", { school_id: schoolA, timetable_version_id: timetableA, teaching_section_id: sectionA, day_of_week: 1, starts_at: "08:00", ends_at: "09:00" });
    const slotOtherSection = await insert("timetable_slots", { school_id: schoolA, timetable_version_id: timetableA, teaching_section_id: sectionB, day_of_week: 2, starts_at: "08:00", ends_at: "09:00" });
    lessonA = await insert("scheduled_lessons", { school_id: schoolA, academic_period_id: periodA, teaching_section_id: sectionA, timetable_version_id: timetableA, timetable_slot_id: slotA, scheduled_date: "2026-10-05", starts_at: "2026-10-05T05:00:00Z", ends_at: "2026-10-05T06:00:00Z", schedule_status: "SCHEDULED" });
    lessonOtherSection = await insert("scheduled_lessons", { school_id: schoolA, academic_period_id: periodA, teaching_section_id: sectionB, timetable_version_id: timetableA, timetable_slot_id: slotOtherSection, scheduled_date: "2026-10-06", starts_at: "2026-10-06T05:00:00Z", ends_at: "2026-10-06T06:00:00Z", schedule_status: "SCHEDULED" });

    const periodB = await insert("academic_periods", { school_id: schoolB, name: `Term ${suffix} B`, period_type: "TERM", academic_year: 2026, starts_on: "2026-01-01", ends_on: "2026-12-31", status: "CURRENT" });
    const levelB = await insert("class_levels", { school_id: schoolB, code: `S2-${suffix}-B`, name: `Senior 2 ${suffix} B` });
    const streamB = await insert("streams", { school_id: schoolB, class_level_id: levelB, code: `RED-${suffix}`, name: `Red ${suffix}` });
    const subjectB = await insert("school_subjects", { school_id: schoolB, department_id: departmentB, code: `CHEM-${suffix}`, name: `Chemistry ${suffix}` });
    sectionB2 = await insert("teaching_sections", { school_id: schoolB, academic_period_id: periodB, teacher_membership_id: teacherMembershipB2, school_subject_id: subjectB, class_level_id: levelB, stream_id: streamB, assignment_state: "CONFIRMED", confirmed_at: new Date().toISOString(), created_by: teacherB2.id });
    const timetableB = await insert("timetable_versions", { school_id: schoolB, academic_period_id: periodB, version_number: 1, name: `Draft ${suffix} B`, status: "DRAFT", effective_from: "2026-01-01", created_by: teacherB2.id });
    const slotB = await insert("timetable_slots", { school_id: schoolB, timetable_version_id: timetableB, teaching_section_id: sectionB2, day_of_week: 1, starts_at: "08:00", ends_at: "09:00" });
    lessonB = await insert("scheduled_lessons", { school_id: schoolB, academic_period_id: periodB, teaching_section_id: sectionB2, timetable_version_id: timetableB, timetable_slot_id: slotB, scheduled_date: "2026-10-05", starts_at: "2026-10-05T05:00:00Z", ends_at: "2026-10-05T06:00:00Z", schedule_status: "SCHEDULED" });
    await Promise.all([
      teacherA.client.auth.signInWithPassword({ email: teacherA.email, password: teacherA.password }),
      teacherB.client.auth.signInWithPassword({ email: teacherB.email, password: teacherB.password }),
      teacherB2.client.auth.signInWithPassword({ email: teacherB2.email, password: teacherB2.password }),
    ]);
  });

  afterAll(async () => {
    if (!admin) return;
    for (const school of [schoolA, schoolB].filter(Boolean)) {
      for (const table of ["lesson_artifact_versions", "lesson_artifacts", "audit_events", "scheduled_lessons", "timetable_slots", "timetable_versions", "teaching_sections", "streams", "class_levels", "school_subjects", "academic_periods", "role_grants", "memberships", "departments"]) await admin.from(table).delete().eq("school_id", school);
      await admin.from("schools").delete().eq("id", school);
    }
    for (const value of [teacherA?.id, teacherB?.id, teacherB2?.id].filter(Boolean)) await admin.auth.admin.deleteUser(value);
  });

  it("enforces teacher ownership, real cross-tenant isolation, lineage, immutable history, governed metadata and teacher authorship", async () => {
    const createdResult = await teacherA.client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: lessonA, p_artifact_type: "FORMAL_LESSON_PLAN", p_content_json: planContent("Teacher plan") });
    const created = required(createdResult.data, createdResult.error) as { artifactId: string; versionId: string; versionNumber: number };
    expect(created.versionNumber).toBe(1);
    expect((await teacherA.client.from("lesson_artifacts").select("rights_state, provenance").eq("id", created.artifactId).single()).data).toMatchObject({ rights_state: "UNKNOWN", provenance: [{ category: "TEACHER" }] });
    expect((await teacherB.client.from("lesson_artifacts").select("id").eq("id", created.artifactId)).data).toEqual([]);
    expect((await teacherA.client.from("lesson_artifact_versions").update({ content_json: { forged: true } }).eq("id", created.versionId)).error).toBeTruthy();

    const currentParent = created.versionId;
    const childResult = await teacherA.client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: lessonA, p_artifact_type: "BOARD_NOTES", p_parent_artifact_id: created.artifactId, p_parent_version_id: currentParent, p_content_json: { title: "Board notes", keyPoints: [], examples: [], equations: [], prompts: [] } });
    const child = required(childResult.data, childResult.error) as { artifactId: string; versionNumber: number };
    expect(child.versionNumber).toBe(1);

    const nextResult = await teacherA.client.rpc("create_lesson_artifact_version", { p_artifact_id: created.artifactId, p_expected_version: 1, p_content_json: planContent("Teacher plan v2"), p_change_summary: "Teacher edited the plan" });
    const next = required(nextResult.data, nextResult.error) as { versionId: string; versionNumber: number };
    expect(next.versionNumber).toBe(2);
    const staleBeforeEdit = required((await teacherA.client.from("lesson_artifacts").select("parent_version_id").eq("id", child.artifactId).single()).data, null);
    expect(staleBeforeEdit.parent_version_id).toBe(currentParent);
    expect(staleBeforeEdit.parent_version_id).not.toBe(next.versionId);

    const childNextResult = await teacherA.client.rpc("create_lesson_artifact_version", { p_artifact_id: child.artifactId, p_expected_version: 1, p_content_json: { title: "Board notes v2", keyPoints: ["Reviewed after the plan changed"], examples: [], equations: [], prompts: [] }, p_change_summary: "Teacher reviewed the stale material" });
    const childNext = required(childNextResult.data, childNextResult.error) as { versionNumber: number };
    expect(childNext.versionNumber).toBe(2);
    const staleAfterEdit = required((await teacherA.client.from("lesson_artifacts").select("parent_version_id, current_version_id").eq("id", child.artifactId).single()).data, null);
    expect(staleAfterEdit.parent_version_id).toBe(currentParent);
    expect(staleAfterEdit.parent_version_id).not.toBe(staleAfterEdit.current_version_id);
    expect(staleAfterEdit.parent_version_id).not.toBe(next.versionId);
    for (const forgedSource of ["AI", "SYSTEM"]) {
      const forged = await teacherA.client.rpc("create_lesson_artifact_version", { p_artifact_id: created.artifactId, p_expected_version: 2, p_content_json: planContent(`Forged ${forgedSource}`), p_change_source: forgedSource, p_change_summary: "Forged source" });
      expect(forged.error).toBeTruthy();
    }
    const savedVersion = required((await teacherA.client.from("lesson_artifact_versions").select("change_source").eq("artifact_id", created.artifactId).eq("version_number", 2).single()).data, null);
    expect(savedVersion.change_source).toBe("TEACHER");

    const governanceBase = { p_scheduled_lesson_id: lessonA, p_artifact_type: "FORMAL_LESSON_PLAN", p_content_json: planContent("Governance attack") };
    for (const attack of [
      { p_curriculum_profile_id: crypto.randomUUID() },
      { p_curriculum_position_event_id: crypto.randomUUID() },
      { p_curriculum_canonical_id: "foreign-canonical-id" },
      { p_rights_state: "CLEARED" },
      { p_provenance: [{ category: "CURRICULUM_ANCHOR", label: "Forged", rightsState: "CLEARED" }] },
    ]) {
      const result = await teacherA.client.rpc("create_lesson_artifact", { ...governanceBase, ...attack });
      expect(result.error).toBeTruthy();
    }

    expect((await teacherB.client.from("lesson_artifacts").select("id").eq("id", child.artifactId)).data).toEqual([]);

    const sameSchoolWrongSection = await teacherB.client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: lessonOtherSection, p_artifact_type: "BOARD_NOTES", p_parent_artifact_id: created.artifactId, p_parent_version_id: currentParent, p_content_json: { title: "Wrong section parent", keyPoints: [], examples: [], equations: [], prompts: [] } });
    expect(sameSchoolWrongSection.error).toBeTruthy();
    const foreignParent = await teacherB2.client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: lessonB, p_artifact_type: "BOARD_NOTES", p_parent_artifact_id: created.artifactId, p_parent_version_id: currentParent, p_content_json: { title: "Foreign parent", keyPoints: [], examples: [], equations: [], prompts: [] } });
    expect(foreignParent.error).toBeTruthy();

    expect((await teacherB2.client.from("lesson_artifacts").select("id").eq("id", created.artifactId)).data).toEqual([]);
    expect((await teacherB2.client.from("lesson_artifact_versions").select("id").eq("artifact_id", created.artifactId)).data).toEqual([]);
    expect((await teacherB2.client.rpc("create_lesson_artifact_version", { p_artifact_id: created.artifactId, p_expected_version: 2, p_content_json: planContent("Cross-tenant version") })).error).toBeTruthy();
    expect((await teacherB2.client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: lessonA, p_artifact_type: "FORMAL_LESSON_PLAN", p_content_json: planContent("Cross-tenant lesson") })).error).toBeTruthy();
    expect((await teacherB2.client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: lessonB, p_artifact_type: "BOARD_NOTES", p_parent_artifact_id: created.artifactId, p_parent_version_id: currentParent, p_content_json: { title: "Cross-tenant parent", keyPoints: [], examples: [], equations: [], prompts: [] } })).error).toBeTruthy();
    expect(sectionB).not.toBe(sectionA);
    expect(sectionB2).not.toBe(sectionA);
    expect(schoolB).not.toBe(schoolA);
  });
});
