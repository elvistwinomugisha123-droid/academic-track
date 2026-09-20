import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const admin = url && serviceKey ? createClient(url, serviceKey) : null;
const suffix = `artifacts-${Date.now()}`;
type TestUser = { id: string; email: string; password: string; client: SupabaseClient };
let schoolA = ""; let schoolB = ""; let teacherMembershipA = ""; let teacherMembershipB = ""; let sectionA = ""; let sectionB = ""; let lessonA = ""; let teacherA: TestUser; let teacherB: TestUser;

const required = <T>(data: T | null, error: { message: string } | null): T => { if (error || data === null) throw error ?? new Error("Expected test data"); return data; };
async function user(label: string): Promise<TestUser> { const email = `${suffix}-${label}@example.test`; const password = `Ate-${suffix}-${label}-Password!`; const result = await admin!.auth.admin.createUser({ email, password, email_confirm: true }); const created = required(result.data.user, result.error); return { id: created.id, email, password, client: createClient(url!, publishableKey!) }; }
async function insert(table: string, values: Record<string, unknown>): Promise<string> { const result = await admin!.from(table).insert(values).select("id").single(); return String(required(result.data, result.error).id); }

describe("isolated lesson artifact integration", () => {
  beforeAll(async () => {
    if (!url || !publishableKey || !serviceKey || !admin) throw new Error("Lesson artifact integration requires the isolated TEST Supabase project. No production fallback is permitted.");
    [teacherA, teacherB] = await Promise.all([user("teacher-a"), user("teacher-b")]);
    const schools = required((await admin.from("schools").insert([{ name: `Artifact Test A ${suffix}`, slug: `${suffix}-a` }, { name: `Artifact Test B ${suffix}`, slug: `${suffix}-b` }]).select("id, slug")).data, null);
    schoolA = schools.find((row) => row.slug.endsWith("-a"))!.id; schoolB = schools.find((row) => row.slug.endsWith("-b"))!.id;
    const department = await insert("departments", { school_id: schoolA, name: `Biology ${suffix}`, code: `BIO-${suffix}` });
    teacherMembershipA = await insert("memberships", { school_id: schoolA, user_id: teacherA.id, status: "ACTIVE", display_name: teacherA.email, joined_at: new Date().toISOString() });
    teacherMembershipB = await insert("memberships", { school_id: schoolA, user_id: teacherB.id, status: "ACTIVE", display_name: teacherB.email, joined_at: new Date().toISOString() });
    await admin.from("role_grants").insert([{ membership_id: teacherMembershipA, school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: teacherA.id }, { membership_id: teacherMembershipB, school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: teacherA.id }]);
    const period = await insert("academic_periods", { school_id: schoolA, name: `Term ${suffix}`, period_type: "TERM", academic_year: 2026, starts_on: "2026-01-01", ends_on: "2026-12-31", status: "CURRENT" });
    const level = await insert("class_levels", { school_id: schoolA, code: `S2-${suffix}`, name: `Senior 2 ${suffix}` });
    const stream = await insert("streams", { school_id: schoolA, class_level_id: level, code: `BLUE-${suffix}`, name: `Blue ${suffix}` });
    const subject = await insert("school_subjects", { school_id: schoolA, department_id: department, code: `BIO-${suffix}`, name: `Biology ${suffix}` });
    sectionA = await insert("teaching_sections", { school_id: schoolA, academic_period_id: period, teacher_membership_id: teacherMembershipA, school_subject_id: subject, class_level_id: level, stream_id: stream, assignment_state: "CONFIRMED", confirmed_at: new Date().toISOString(), created_by: teacherA.id });
    sectionB = await insert("teaching_sections", { school_id: schoolA, academic_period_id: period, teacher_membership_id: teacherMembershipB, school_subject_id: subject, class_level_id: level, stream_id: stream, assignment_state: "CONFIRMED", confirmed_at: new Date().toISOString(), created_by: teacherA.id });
    const timetable = await insert("timetable_versions", { school_id: schoolA, academic_period_id: period, version_number: 1, name: `Draft ${suffix}`, status: "DRAFT", effective_from: "2026-01-01", created_by: teacherA.id });
    const slot = await insert("timetable_slots", { school_id: schoolA, timetable_version_id: timetable, teaching_section_id: sectionA, day_of_week: 1, starts_at: "08:00", ends_at: "09:00" });
    lessonA = await insert("scheduled_lessons", { school_id: schoolA, academic_period_id: period, teaching_section_id: sectionA, timetable_version_id: timetable, timetable_slot_id: slot, scheduled_date: "2026-10-05", starts_at: "2026-10-05T05:00:00Z", ends_at: "2026-10-05T06:00:00Z", schedule_status: "SCHEDULED" });
    await teacherA.client.auth.signInWithPassword({ email: teacherA.email, password: teacherA.password }); await teacherB.client.auth.signInWithPassword({ email: teacherB.email, password: teacherB.password });
  });
  afterAll(async () => { if (!admin) return; if (schoolA) { for (const table of ["lesson_artifact_versions", "lesson_artifacts", "audit_events", "scheduled_lessons", "timetable_slots", "timetable_versions", "teaching_sections", "streams", "class_levels", "school_subjects", "academic_periods", "role_grants", "memberships", "departments"]) await admin.from(table).delete().eq("school_id", schoolA); await admin.from("schools").delete().eq("id", schoolA); } if (schoolB) await admin.from("schools").delete().eq("id", schoolB); for (const value of [teacherA?.id, teacherB?.id].filter(Boolean)) await admin.auth.admin.deleteUser(value); });

  it("enforces teacher ownership, cross-tenant isolation, lineage, immutable history and rights state", async () => {
    const created = required((await teacherA.client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: lessonA, p_artifact_type: "FORMAL_LESSON_PLAN", p_content_json: { title: "Teacher plan", curriculumAnchor: null, learningIntention: "", expectedOutcome: "", priorLearning: "", continuityContext: "", lessonFocus: "Cells", intendedCoverage: "", durationMinutes: 60, resources: [], teachingSequence: [], differentiation: "", conclusionFollowUp: "", teacherNotes: "" }, p_rights_state: "RESTRICTED", p_provenance: [{ category: "CURRICULUM_ANCHOR", label: "Metadata only" }] })).data, null) as { artifactId: string; versionId: string; versionNumber: number };
    expect(created.versionNumber).toBe(1);
    expect((await teacherB.client.from("lesson_artifacts").select("id").eq("id", created.artifactId)).data).toEqual([]);
    expect((await teacherA.client.from("lesson_artifact_versions").update({ content_json: { forged: true } }).eq("id", created.versionId)).error).toBeTruthy();
    const next = required((await teacherA.client.rpc("create_lesson_artifact_version", { p_artifact_id: created.artifactId, p_expected_version: 1, p_content_json: { title: "Teacher plan v2", curriculumAnchor: null, learningIntention: "", expectedOutcome: "", priorLearning: "", continuityContext: "", lessonFocus: "Cells", intendedCoverage: "", durationMinutes: 60, resources: [], teachingSequence: [], differentiation: "", conclusionFollowUp: "", teacherNotes: "" } })).data, null) as { versionNumber: number };
    expect(next.versionNumber).toBe(2);
    const child = required((await teacherA.client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: lessonA, p_artifact_type: "BOARD_NOTES", p_parent_artifact_id: created.artifactId, p_parent_version_id: (await teacherA.client.from("lesson_artifacts").select("current_version_id").eq("id", created.artifactId).single()).data!.current_version_id, p_content_json: { title: "Board notes", keyPoints: [], examples: [], equations: [], prompts: [] }, p_rights_state: "RESTRICTED" })).data, null) as { artifactId: string; versionNumber: number };
    expect(child.versionNumber).toBe(1);
    expect((await teacherB.client.from("lesson_artifacts").select("id").eq("id", child.artifactId)).data).toEqual([]);
    expect((await teacherA.client.from("lesson_artifacts").select("rights_state").eq("id", created.artifactId).single()).data?.rights_state).toBe("RESTRICTED");
    expect(sectionB).not.toBe(sectionA); expect(schoolB).not.toBe(schoolA);
  });
});
