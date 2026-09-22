/**
 * Creates an isolated, synthetic Assessment Studio fixture in TEST only.
 *
 * Run after the reviewed migrations (including 0023) are installed:
 *   $env:TEST_ASSESSMENT_FIXTURE="1"
 *   npx tsx scripts/assessment-test-fixture.ts
 *
 * This deliberately uses TEST-SYNTHETIC identifiers and never imports or
 * copies curriculum material from a real authority.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
if (!process.env.TEST_ASSESSMENT_FIXTURE || !databaseUrl || !supabaseUrl || !serviceRoleKey || !supabaseUrl.includes("lwbkxhimqlfuzzxilaga")) {
  throw new Error("This setup path is TEST-only. Set TEST_ASSESSMENT_FIXTURE=1, TEST_DATABASE_URL or DATABASE_URL, TEST_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, and TEST_SUPABASE_SERVICE_ROLE_KEY for the isolated TEST project.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = postgres(databaseUrl, { max: 1 });
const id = () => randomUUID();
const fixtureSuffix = randomUUID().slice(0, 8).toUpperCase();
const password = "Test-only-Ate-Assessment-2026!";

async function ensureUser(email: string, displayName: string) {
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = users.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
  if (created.error || !created.data.user) throw created.error ?? new Error(`Could not create TEST user ${email}`);
  return created.data.user;
}

async function main() {
const teacher = await ensureUser(`assessment-teacher-${fixtureSuffix.toLowerCase()}@test.invalid`, "Synthetic Assessment Teacher");
const otherTeacher = await ensureUser(`assessment-other-teacher-${fixtureSuffix.toLowerCase()}@test.invalid`, "Synthetic Other Teacher");
const dos = await ensureUser(`assessment-dos-${fixtureSuffix.toLowerCase()}@test.invalid`, "Synthetic Academic Lead");
const schoolId = id();
const foreignSchoolId = id();
const departmentId = id();
const periodId = id();
const foreignPeriodId = id();
const subjectId = id();
const classLevelId = id();
const streamAId = id();
const streamBId = id();
const sectionAId = id();
const sectionBId = id();
const foreignSectionId = id();
const timetableId = id();
const subjectIdInForeignSchool = id();
const foreignClassLevelId = id();
const foreignStreamId = id();
const foreignTimetableId = id();
const sourceId = `TEST_ASSESSMENT_SYNTHETIC_SOURCE_${fixtureSuffix}`;
const checksum = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const manifestChecksum = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const releaseId = id();
const subjectProfileId = id();
const governedSubjectId = id();
const otherGovernedSubjectId = id();
const otherSubjectProfileId = id();
const assessmentProfileId = id();
const canonicalIds = [`TEST-ASSESSMENT-${fixtureSuffix}-A`, `TEST-ASSESSMENT-${fixtureSuffix}-B`, `TEST-ASSESSMENT-${fixtureSuffix}-C`, `TEST-ASSESSMENT-${fixtureSuffix}-D`];
const foreignCanonicalId = `TEST-ASSESSMENT-${fixtureSuffix}-FOREIGN`;

const teacherMembershipId = id();
const otherTeacherMembershipId = id();
const dosMembershipId = id();
const foreignTeacherMembershipId = id();

const fixture: Record<string, unknown> = {
  schoolId, foreignSchoolId, periodId, foreignPeriodId, schoolSubjectId: subjectId, subjectProfileId, assessmentProfileId,
  sectionAId, sectionBId, foreignSectionId, teacherEmail: teacher.email, otherTeacherEmail: otherTeacher.email, dosEmail: dos.email,
  teacherPassword: password, otherTeacherPassword: password, canonicalIds, foreignCanonicalId,
  assessmentDate: "2026-03-20", periodStartsOn: "2026-01-01", periodEndsOn: "2026-12-31",
};

await sql.begin(async (tx) => {
  await tx`insert into schools (id,name,slug,status) values (${schoolId},'TEST Synthetic Assessment School',${`test-assessment-${schoolId.slice(0, 8)}`},'ACTIVE')`;
  await tx`insert into schools (id,name,slug,status) values (${foreignSchoolId},'TEST Foreign Assessment School',${`test-assessment-foreign-${foreignSchoolId.slice(0, 8)}`},'ACTIVE')`;
  await tx`insert into departments (id,school_id,name,code) values (${departmentId},${schoolId},'TEST Synthetic Department','TEST')`;
  await tx`insert into academic_periods (id,school_id,name,period_type,academic_year,starts_on,ends_on,status) values (${periodId},${schoolId},'TEST Synthetic Term','TERM',2026,'2026-01-01','2026-12-31','CURRENT'),(${foreignPeriodId},${foreignSchoolId},'TEST Foreign Term','TERM',2026,'2026-01-01','2026-12-31','CURRENT')`;
  await tx`insert into memberships (id,school_id,user_id,status,display_name,joined_at) values (${teacherMembershipId},${schoolId},${teacher.id},'ACTIVE','Synthetic Assessment Teacher',now()),(${otherTeacherMembershipId},${schoolId},${otherTeacher.id},'ACTIVE','Synthetic Other Teacher',now()),(${dosMembershipId},${schoolId},${dos.id},'ACTIVE','Synthetic Academic Lead',now())`;
  await tx`insert into memberships (id,school_id,user_id,status,display_name,joined_at) values (${foreignTeacherMembershipId},${foreignSchoolId},${otherTeacher.id},'ACTIVE','Synthetic Other Teacher',now())`;
  await tx`insert into role_grants (membership_id,school_id,role,scope_type,status,granted_by) values (${teacherMembershipId},${schoolId},'TEACHER','SCHOOL','ACTIVE',${dos.id}),(${otherTeacherMembershipId},${schoolId},'TEACHER','SCHOOL','ACTIVE',${dos.id}),(${dosMembershipId},${schoolId},'DOS','SCHOOL','ACTIVE',${dos.id}),(${foreignTeacherMembershipId},${foreignSchoolId},'TEACHER','SCHOOL','ACTIVE',${dos.id})`;

  await tx`insert into knowledge_sources (source_id,authority,title,document_type,education_level,subject,checksum_sha256,rights_status,production_use_status,external_ai_allowed,attribution_required,processing_status,verification_status,source_path,effective_from,effective_to,formal_artifact_allowed,export_allowed) values (${sourceId},'TEST-SYNTHETIC','TEST Synthetic Assessment Source','TEST','lower-secondary','TEST-SUBJECT',${checksum},'REVIEW_REQUIRED','PERMISSION_PENDING',false,true,'IMPORTED','UNVERIFIED','synthetic://assessment-test','2026-01-01','2026-12-31',false,false)`;
  await tx`insert into knowledge_curriculum_subjects (id,subject_key,title,education_level,status) values (${governedSubjectId},${`TEST-ASSESSMENT-SUBJECT-${fixtureSuffix}`},'TEST Synthetic Subject','lower-secondary','DRAFT'),(${otherGovernedSubjectId},${`TEST-ASSESSMENT-OTHER-SUBJECT-${fixtureSuffix}`},'TEST Synthetic Other Subject','lower-secondary','DRAFT')`;
  await tx`insert into knowledge_curriculum_releases (id,release_key,authority,display_name,education_level,version_label,effective_from,effective_to,status,manifest_checksum_sha256,created_by) values (${releaseId},${`TEST-ASSESSMENT-RELEASE-${fixtureSuffix}`},'TEST-SYNTHETIC','TEST Synthetic Assessment Release','lower-secondary','TEST-1','2026-01-01','2026-12-31','DRAFT',${manifestChecksum},${dos.id})`;
  await tx`insert into knowledge_subject_profiles (id,release_id,governed_subject_id,profile_key,display_title,education_level,status,requires_assessment_profile) values (${subjectProfileId},${releaseId},${governedSubjectId},${`TEST-ASSESSMENT-PROFILE-${fixtureSuffix}`},'TEST Synthetic Assessment Subject Profile','lower-secondary','DRAFT',true),(${otherSubjectProfileId},${releaseId},${otherGovernedSubjectId},${`TEST-ASSESSMENT-OTHER-PROFILE-${fixtureSuffix}`},'TEST Synthetic Other Subject Profile','lower-secondary','DRAFT',false)`;
  await tx`insert into knowledge_assessment_profiles (id,release_id,subject_profile_id,assessment_key,display_title,purpose,regime,applicable_source_roles,status,allows_broader_scope,allows_partial_scope,requires_review) values (${assessmentProfileId},${releaseId},${subjectProfileId},${`TEST-ASSESSMENT-CLASS-TEST-${fixtureSuffix}`},'TEST Synthetic Class Test','CLASS_TEST','TEST_SYNTHETIC',array['SUBJECT_SYLLABUS']::text[],'DRAFT',false,true,true)`;
  await tx`insert into knowledge_release_sources (release_id,subject_profile_id,source_id,source_role,is_required,status,approved_at,approved_by) values (${releaseId},${subjectProfileId},${sourceId},'SUBJECT_SYLLABUS',true,'APPROVED',now(),${dos.id}),(${releaseId},${otherSubjectProfileId},${sourceId},'SUBJECT_SYLLABUS',true,'APPROVED',now(),${dos.id})`;
  for (const [index, canonicalId] of [...canonicalIds, foreignCanonicalId].entries()) {
    const spanId = `${sourceId}:ASSESSMENT:${canonicalId}`;
    const profile = canonicalId === foreignCanonicalId ? otherSubjectProfileId : subjectProfileId;
    const governedSubject = canonicalId === foreignCanonicalId ? "TEST Synthetic Other Subject" : "TEST Synthetic Subject";
    await tx`insert into knowledge_source_spans (span_id,source_id,page_start,page_end,locator,source_text,extraction_confidence,verification_status,content_sha256,extractor_version,schema_version) values (${spanId},${sourceId},1,1,${`synthetic:${index}`},${`Synthetic assessment content ${canonicalId}`},'HIGH','UNVERIFIED',${checksum},'test-fixture','test-fixture-v1')`;
    await tx`insert into knowledge_records (canonical_id,source_id,span_id,record_type,education_level,subject,source_wording,normalized,extracted,verification_status,record_key,content_sha256,payload_schema_version) values (${canonicalId},${sourceId},${spanId},'topic','lower-secondary',${governedSubject},${`Synthetic wording ${canonicalId}`},${JSON.stringify({ title: canonicalId })}::jsonb,${JSON.stringify({ fixture: true })}::jsonb,'UNVERIFIED',${canonicalId},${checksum},'test-fixture-v1')`;
    await tx`insert into knowledge_profile_records (release_id,subject_profile_id,canonical_id,membership_role,status,ordering_key,effective_from,effective_to,approved_at,approved_by) values (${releaseId},${profile},${canonicalId},'CURRICULUM','APPROVED',${String(index + 1).padStart(3, "0")},'2026-01-01','2026-12-31',now(),${dos.id})`;
    await tx`select public.record_knowledge_verification_decision('SPAN',${spanId},'VERIFIED',${dos.id},'Synthetic test span verified')`;
    await tx`select public.record_knowledge_verification_decision('RECORD',${canonicalId},'VERIFIED',${dos.id},'Synthetic test record verified')`;
  }
  await tx`select public.record_knowledge_verification_decision('SOURCE',${sourceId},'VERIFIED',${dos.id},'Synthetic test source verified')`;
  await tx`select public.record_knowledge_rights_decision(${sourceId},'CLEARED','PERMITTED',true,true,true,true,'TEST_SYNTHETIC_FIXTURE',${dos.id})`;
  await tx`select set_config('ate.knowledge_governance_command','SUBMIT_RELEASE_REVIEW',true)`;
  await tx`update knowledge_curriculum_releases set status='REVIEW' where id=${releaseId}`;
  await tx`select set_config('ate.knowledge_governance_command','ACTIVATE_RELEASE',true)`;
  await tx`update knowledge_subject_profiles set status='ACTIVE' where release_id=${releaseId}`;
  await tx`update knowledge_curriculum_subjects set status='ACTIVE' where id in (${governedSubjectId},${otherGovernedSubjectId})`;
  await tx`update knowledge_assessment_profiles set status='ACTIVE' where id=${assessmentProfileId}`;
  await tx`update knowledge_curriculum_releases set status='ACTIVE',activated_at=now(),activated_by=${dos.id} where id=${releaseId}`;
  await tx`select public.activate_knowledge_profile_pilot(${subjectProfileId},${dos.id},'Synthetic TEST fixture activation')`;
  await tx`select public.activate_knowledge_profile_pilot(${otherSubjectProfileId},${dos.id},'Synthetic TEST fixture activation')`;

  await tx`insert into school_subjects (id,school_id,department_id,curriculum_subject_id,curriculum_education_level,code,name,status) values (${subjectId},${schoolId},${departmentId},${governedSubjectId},'lower-secondary','TEST','TEST Synthetic Subject','ACTIVE'),(${subjectIdInForeignSchool},${foreignSchoolId},null,${governedSubjectId},'lower-secondary','TEST','TEST Synthetic Subject','ACTIVE')`;
  await tx`insert into class_levels (id,school_id,code,name,status) values (${classLevelId},${schoolId},'TEST-S2','TEST Level','ACTIVE'),(${foreignClassLevelId},${foreignSchoolId},'TEST-S2','TEST Level','ACTIVE')`;
  await tx`insert into streams (id,school_id,class_level_id,code,name,status) values (${streamAId},${schoolId},${classLevelId},'A','TEST Stream A','ACTIVE'),(${streamBId},${schoolId},${classLevelId},'B','TEST Stream B','ACTIVE'),(${foreignStreamId},${foreignSchoolId},${foreignClassLevelId},'A','TEST Foreign Stream','ACTIVE')`;
  await tx`insert into teaching_sections (id,school_id,academic_period_id,teacher_membership_id,school_subject_id,class_level_id,stream_id,assignment_state,operational_status,confirmed_at) values (${sectionAId},${schoolId},${periodId},${teacherMembershipId},${subjectId},${classLevelId},${streamAId},'CONFIRMED','ACTIVE',now()),(${sectionBId},${schoolId},${periodId},${teacherMembershipId},${subjectId},${classLevelId},${streamBId},'CONFIRMED','ACTIVE',now())`;
  await tx`insert into teaching_sections (id,school_id,academic_period_id,teacher_membership_id,school_subject_id,class_level_id,stream_id,assignment_state,operational_status,confirmed_at) values (${foreignSectionId},${foreignSchoolId},${foreignPeriodId},${foreignTeacherMembershipId},${subjectIdInForeignSchool},${foreignClassLevelId},${foreignStreamId},'CONFIRMED','ACTIVE',now())`;
  await tx`insert into school_subject_curriculum_bindings (school_id,school_subject_id,subject_profile_id,effective_from,status,bound_by) values (${schoolId},${subjectId},${subjectProfileId},'2026-01-01','ACTIVE',${dos.id})`;
  await tx`insert into teaching_section_curriculum_bindings (school_id,teaching_section_id,subject_profile_id,effective_from,status,bound_by) values (${schoolId},${sectionAId},${subjectProfileId},'2026-01-01','ACTIVE',${dos.id}),(${schoolId},${sectionBId},${subjectProfileId},'2026-01-01','ACTIVE',${dos.id})`;
  await tx`insert into timetable_versions (id,school_id,academic_period_id,version_number,name,status,effective_from,created_by) values (${timetableId},${schoolId},${periodId},1,'TEST Synthetic Timetable','DRAFT','2026-01-01',${dos.id}),(${foreignTimetableId},${foreignSchoolId},${foreignPeriodId},1,'TEST Foreign Timetable','DRAFT','2026-01-01',${dos.id})`;
  const lessonIds: string[] = [];
  const evidence: Record<string, string> = {};
  const positions: Record<string, string> = {};
  for (const [sectionId, streamId, membershipId, values] of [[sectionAId, streamAId, teacherMembershipId, [canonicalIds[0], canonicalIds[1], canonicalIds[2], canonicalIds[3], canonicalIds[3], canonicalIds[3]]], [sectionBId, streamBId, teacherMembershipId, [canonicalIds[0], canonicalIds[1], canonicalIds[2], canonicalIds[3]]] ] as const) {
    for (const [index, canonicalId] of values.entries()) {
      const slotId = id(); const lessonId = id(); const positionId = id(); const scheduledDate = `2026-03-${String(10 + index).padStart(2, "0")}`;
      await tx`insert into timetable_slots (id,school_id,timetable_version_id,teaching_section_id,day_of_week,starts_at,ends_at) values (${slotId},${schoolId},${timetableId},${sectionId},${index + 1},'08:00','09:00')`;
      await tx`insert into scheduled_lessons (id,school_id,academic_period_id,teaching_section_id,timetable_version_id,timetable_slot_id,scheduled_date,starts_at,ends_at,schedule_status) values (${lessonId},${schoolId},${periodId},${sectionId},${timetableId},${slotId},${scheduledDate},${scheduledDate}::date + time '08:00',${scheduledDate}::date + time '09:00','SCHEDULED')`;
      await tx`insert into teaching_section_curriculum_position_events (id,school_id,teaching_section_id,subject_profile_id,canonical_id,position_kind,confirmed_by,confirmed_at) values (${positionId},${schoolId},${sectionId},${subjectProfileId},${canonicalId},'TOPIC',${teacher.id},${scheduledDate}::date + time '09:30')`;
      positions[`${sectionId}:${canonicalId}:${index}`] = positionId;
      await tx`insert into lesson_preparations (school_id,scheduled_lesson_id,teaching_section_id,curriculum_position_event_id,curriculum_canonical_id,curriculum_profile_id,created_by,updated_by) values (${schoolId},${lessonId},${sectionId},${positionId},${canonicalId},${subjectProfileId},${teacher.id},${teacher.id})`;
      const outcome = sectionId === sectionAId
        ? index < 3 ? "DELIVERED" : index === 3 ? "PARTIALLY_DELIVERED" : index === 4 ? "NOT_DELIVERED" : "CHANGED"
        : index < 2 ? "DELIVERED" : "PARTIALLY_DELIVERED";
      const eventId = id();
      await tx`insert into classroom_events (id,school_id,scheduled_lesson_id,teaching_section_id,actor_membership_id,outcome,reason,note,occurred_at) values (${eventId},${schoolId},${lessonId},${sectionId},${membershipId},${outcome},${outcome === "NOT_DELIVERED" ? "Synthetic test not delivered" : outcome === "CHANGED" ? "Synthetic test changed" : null},${outcome === "CHANGED" ? "Synthetic test alternative content requires review" : null},now())`;
      evidence[`${sectionId}:${canonicalId}:${outcome}`] = eventId;
      lessonIds.push(lessonId);
    }
  }
  const foreignSlotId = id(); const foreignLessonId = id();
  await tx`insert into timetable_slots (id,school_id,timetable_version_id,teaching_section_id,day_of_week,starts_at,ends_at) values (${foreignSlotId},${foreignSchoolId},${foreignTimetableId},${foreignSectionId},1,'08:00','09:00')`;
  await tx`insert into scheduled_lessons (id,school_id,academic_period_id,teaching_section_id,timetable_version_id,timetable_slot_id,scheduled_date,starts_at,ends_at,schedule_status) values (${foreignLessonId},${foreignSchoolId},${foreignPeriodId},${foreignSectionId},${foreignTimetableId},${foreignSlotId},'2026-03-10','2026-03-10 08:00+00','2026-03-10 09:00+00','SCHEDULED')`;
  await tx`insert into lesson_preparations (school_id,scheduled_lesson_id,teaching_section_id,curriculum_canonical_id,curriculum_profile_id,created_by,updated_by) values (${foreignSchoolId},${foreignLessonId},${foreignSectionId},${canonicalIds[0]},${subjectProfileId},${otherTeacher.id},${otherTeacher.id})`;
  fixture.lessonIds = lessonIds;
  fixture.evidence = evidence;
  fixture.positions = positions;
});

await mkdir("test-artifacts", { recursive: true });
await writeFile("test-artifacts/assessment-fixture.json", `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
await sql.end({ timeout: 5 });
console.log(JSON.stringify(fixture, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  await sql.end({ timeout: 5 }).catch(() => undefined);
  process.exitCode = 1;
});
