import "server-only";

import { getCurrentTeachingSectionCurriculumPosition } from "@/knowledge/curriculum-bindings";
import { createPostgresKnowledgeClient } from "@/knowledge/db/client";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withTransientReadRetry } from "@/lib/supabase/retry";
import { deriveNextPosition, positionKindForRecordType, recommendedFocus, safeCurrentPositionTitle, safeCurriculumPositionLabel, type CurrentPosition, type NextPositionProposal, type PositionOption, type TeacherOutcome } from "@/teacher/domain/continuity";

type Row = Record<string, unknown>;

export type TeacherSection = {
  id: string;
  academicPeriodId: string;
  academicPeriodName: string;
  academicPeriodStatus: string;
  teacherMembershipId: string;
  subjectId: string;
  subjectName: string;
  classLevelId: string;
  classLevelName: string;
  streamId: string;
  streamName: string;
};

export type TeacherLesson = {
  id: string;
  sectionId: string;
  scheduledDate: string;
  startsAt: string;
  endsAt: string;
  roomLabel: string | null;
  section: TeacherSection;
  outcome: TeacherOutcome | null;
  eventId: string | null;
  eventReason: string | null;
  eventNote: string | null;
  confirmedAt: string | null;
  lessonState: string;
  carryForwardState: string | null;
  previousLessonId: string | null;
  unfinishedWork: string | null;
  preparation: Preparation | null;
  currentPosition: CurrentPosition | null;
};

export type Preparation = {
  id: string;
  scheduledLessonId: string;
  lessonFocus: string;
  teacherNotes: string;
  intendedCoverage: string;
  preparationNotes: string;
  version: number;
  updatedAt: string;
};

export type GovernedCurriculumContext = {
  subjectProfileId: string;
  profileTitle: string;
  profileKey: string;
  releaseId: string;
  releaseTitle: string;
  releaseKey: string;
  current: CurrentPosition | null;
  options: PositionOption[];
  // Only from verified, ACTIVE curriculum profile records whose source explicitly
  // permits pilot formal artifacts and external AI. Never use these as classroom facts.
  supportingRecords: Array<{ recordType: string; title: string }>;
};

export type TeacherHomeData = {
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  schoolName: string;
  schoolTimezone: string;
  nextLesson: TeacherLesson | null;
  todayLessons: TeacherLesson[];
  attention: TeacherAttention[];
  continuityWarning: string | null;
};

export type TeacherAttention = {
  id: string;
  kind: "UNCONFIRMED" | "CARRY_FORWARD" | "POSITION_NEEDED";
  title: string;
  detail: string;
  lessonId: string | null;
};

export type TeachingSectionData = {
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  schoolName: string;
  schoolTimezone: string;
  section: TeacherSection;
  curriculum: GovernedCurriculumContext;
  nextLesson: TeacherLesson | null;
  recentLessons: TeacherLesson[];
  positionHistory: PositionHistory[];
  continuityWarning: string | null;
};

export type PositionHistory = {
  eventId: string;
  title: string;
  positionKind: string;
  confirmedAt: string;
  correctionReason: string | null;
};

export type LessonReadinessData = {
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  schoolName: string;
  schoolTimezone: string;
  lesson: TeacherLesson;
  curriculum: GovernedCurriculumContext;
  previousLesson: TeacherLesson | null;
  recommendedFocus: string;
  proposal: NextPositionProposal | null;
  artifacts: LessonArtifactRecord[];
  continuityWarning: string | null;
};

export type LessonArtifactRecord = {
  id: string;
  artifactType: import("@/artifacts/types").LessonArtifactType;
  status: string;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  currentContent: unknown | null;
  parentArtifactId: string | null;
  parentVersionId: string | null;
  curriculumProfileId: string | null;
  curriculumPositionEventId: string | null;
  curriculumCanonicalId: string | null;
  updatedAt: string;
  rightsState: "CLEARED" | "OPERATOR_AUTHORIZED_FOR_PILOT" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN";
  provenance: unknown[];
  potentiallyStale: boolean;
};

function requiredRows<T>(result: { data: T[] | null; error: { message?: string; code?: string } | null }, label: string): T[] {
  if (result.error) throw new Error(`${label} ${result.error.code ?? ""} ${result.error.message ?? ""}`.trim());
  return result.data ?? [];
}

function stringValue(row: Row | undefined, key: string): string { return String(row?.[key] ?? ""); }
function nullableString(row: Row | undefined, key: string): string | null { const value = row?.[key]; return value == null || value === "" ? null : String(value); }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

function recordTitle(normalized: unknown, sourceWording: string, allowSourceWording = true): string {
  if (!allowSourceWording) return safeCurriculumPositionLabel;
  const value = objectValue(normalized);
  return String(value.title ?? value.name ?? sourceWording).trim() || sourceWording;
}

function optionFromKnowledgeRow(row: Row, allowSourceWording = true): PositionOption | null {
  const recordType = stringValue(row, "record_type");
  const positionKind = positionKindForRecordType(recordType);
  if (!positionKind) return null;
  const normalized = objectValue(row.normalized);
  return {
    canonicalId: stringValue(row, "canonical_id"),
    recordType: recordType as PositionOption["recordType"],
    positionKind,
    title: recordTitle(normalized, stringValue(row, "source_wording"), allowSourceWording),
    sourceWording: stringValue(row, "source_wording"),
    orderingKey: nullableString(row, "ordering_key"),
    topicCode: normalized.topic_code == null ? null : String(normalized.topic_code),
    level: normalized.level == null ? null : String(normalized.level),
    term: normalized.term == null ? null : String(normalized.term),
    sourceEntityId: normalized.sourceEntityId == null ? null : String(normalized.sourceEntityId),
    parentTopicSourceId: normalized.parentId == null ? null : String(normalized.parentId),
  };
}

function currentFromKnowledgeRow(row: Row | null): CurrentPosition | null {
  if (!row) return null;
  // The previous false argument permanently replaced the genuine topic with
  // "Current confirmed curriculum position" even when rights permitted use.
  // safeCurrentPositionTitle below remains the rights gate.
  const option = optionFromKnowledgeRow(row);
  if (!option) return null;
  const current = {
    ...option,
    eventId: stringValue(row, "id"),
    confirmedAt: stringValue(row, "confirmed_at"),
    sourceId: stringValue(row, "source_id"),
    sourceTitle: stringValue(row, "title"),
    sourceAuthority: stringValue(row, "authority"),
    sourceLocator: stringValue(row, "locator"),
    sourcePageStart: Number(row.page_start ?? 0),
    sourcePageEnd: Number(row.page_end ?? 0),
    sourceChecksum: stringValue(row, "source_checksum_sha256"),
    rightsStatus: (stringValue(row, "rights_status") || "UNKNOWN") as CurrentPosition["rightsStatus"],
    productionUseStatus: (stringValue(row, "production_use_status") || "BLOCKED") as CurrentPosition["productionUseStatus"],
    formalArtifactAllowed: Boolean(row.formal_artifact_allowed),
    externalAiAllowed: Boolean(row.external_ai_allowed),
    exportAllowed: Boolean(row.export_allowed),
    attributionRequired: Boolean(row.attribution_required),
  };
  return { ...current, title: safeCurrentPositionTitle(current) };
}

async function loadGovernedContext(client: ReturnType<typeof createPostgresKnowledgeClient>, schoolId: string, sectionId: string, classLevelName: string, effectiveOn: string): Promise<GovernedCurriculumContext> {
  const binding = await client.query<Row>(`select b.subject_profile_id, p.release_id, p.profile_key, p.display_title as profile_title, r.release_key, r.display_name as release_title
    from teaching_section_curriculum_bindings b
    join knowledge_subject_profiles p on p.id=b.subject_profile_id and p.status='ACTIVE' and p.runtime_status='PILOT_ACTIVE'
    join knowledge_curriculum_releases r on r.id=p.release_id and r.status in ('ACTIVE','SUPERSEDED')
    where b.school_id=$1 and b.teaching_section_id=$2 and b.status='ACTIVE'
      and b.effective_from <= $3::date and (b.effective_to is null or b.effective_to >= $3::date)
    order by b.effective_from desc limit 1`, [schoolId, sectionId, effectiveOn]);
  if (!binding.rows[0]) throw new Error("This Teaching Section has no active curriculum setup.");
  const profile = binding.rows[0];
  const current = await getCurrentTeachingSectionCurriculumPosition(client, schoolId, sectionId, effectiveOn);
  const optionsResult = await client.query<Row>(`select pr.canonical_id, pr.ordering_key, r.record_type, r.source_wording, r.normalized
    from knowledge_profile_records pr
    join knowledge_records r on r.canonical_id=pr.canonical_id
    where pr.subject_profile_id=$1 and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE'
      and r.record_type in ('topic','learning_outcome')
    order by coalesce(pr.ordering_key, ''), r.canonical_id limit 300`, [stringValue(profile, "subject_profile_id")]);
  const allOptions = optionsResult.rows.map((row) => optionFromKnowledgeRow(row)).filter((option): option is PositionOption => Boolean(option));
  const allTopics = allOptions.filter((option) => option.positionKind === "TOPIC");
  const levelTopics = allTopics.filter((option) => option.level?.trim().toLowerCase() === classLevelName.trim().toLowerCase());
  const availableTopics = levelTopics.length ? levelTopics : allTopics;
  // Source IDs were absent from some imported topic records, so the earlier
  // parentId-based filter silently omitted their learning outcomes. Resolve
  // the approved topic -> outcome relationships using canonical IDs instead.
  const topicIds = availableTopics.map((topic) => topic.canonicalId);
  const linkedOutcomes = topicIds.length ? await client.query<Row>(`select pr.canonical_id, pr.ordering_key, r.record_type, r.source_wording, r.normalized,
      rel.from_canonical_id as parent_topic_canonical_id
    from knowledge_relationships rel
    join knowledge_profile_records pr on pr.canonical_id=rel.to_canonical_id
      and pr.subject_profile_id=$1 and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE'
    join knowledge_records r on r.canonical_id=pr.canonical_id and r.record_type='learning_outcome'
    where rel.relationship_type='belongs_to_topic' and rel.from_canonical_id=any($2::uuid[])
    order by pr.ordering_key, pr.canonical_id limit 450`,
    [stringValue(profile, "subject_profile_id"), topicIds]) : { rows: [] as Row[] };
  const topicsWithIdentity = availableTopics.map((topic) => ({ ...topic, sourceEntityId: topic.sourceEntityId || topic.canonicalId }));
  const topicIdentity = new Map(topicsWithIdentity.map((topic) => [topic.canonicalId, topic.sourceEntityId]));
  const linkedOptions: PositionOption[] = linkedOutcomes.rows.flatMap((row): PositionOption[] => {
    const option = optionFromKnowledgeRow(row);
    const parent = topicIdentity.get(stringValue(row, "parent_topic_canonical_id"));
    return option && parent ? [{ ...option, parentTopicSourceId: parent }] : [];
  });
  const options = [...topicsWithIdentity, ...linkedOptions];

  const selected = currentFromKnowledgeRow(current as Row | null);
  let supportingRecords: GovernedCurriculumContext["supportingRecords"] = [];
  if (selected && selected.externalAiAllowed && selected.formalArtifactAllowed
    && selected.productionUseStatus === "PERMITTED"
    && (selected.rightsStatus === "CLEARED" || selected.rightsStatus === "OPERATOR_AUTHORIZED_FOR_PILOT")) {
    const topicId = selected.positionKind === "TOPIC" ? selected.canonicalId
      : (await client.query<Row>(`select from_canonical_id from knowledge_relationships
        where to_canonical_id=$1 and relationship_type='belongs_to_topic' limit 1`,
        [selected.canonicalId])).rows[0]?.from_canonical_id;
    if (topicId) {
      const related = await client.query<Row>(`select r.record_type, r.normalized
        from knowledge_relationships rel
        join knowledge_profile_records pr on pr.canonical_id=rel.to_canonical_id
          and pr.subject_profile_id=$1 and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE'
        join knowledge_records r on r.canonical_id=pr.canonical_id
        join knowledge_sources s on s.source_id=r.source_id
        where rel.from_canonical_id=$2 and rel.relationship_type='belongs_to_topic'
          and r.record_type in ('competency','learning_outcome','activity','assessment_strategy')
          and s.production_use_status='PERMITTED' and s.external_ai_allowed=true and s.formal_artifact_allowed=true
          and s.rights_status in ('CLEARED','OPERATOR_AUTHORIZED_FOR_PILOT')
        order by case r.record_type when 'competency' then 0 when 'learning_outcome' then 1
          when 'activity' then 2 else 3 end, pr.ordering_key, r.canonical_id
        limit 36`, [stringValue(profile, "subject_profile_id"), topicId]);
      supportingRecords = related.rows.map((row) => ({
        recordType: stringValue(row, "record_type"),
        title: String(objectValue(row.normalized).title || "").trim(),
      })).filter((row) => row.title);
    }
  }
  return {
    subjectProfileId: stringValue(profile, "subject_profile_id"),
    profileTitle: stringValue(profile, "profile_title"),
    profileKey: stringValue(profile, "profile_key"),
    releaseId: stringValue(profile, "release_id"),
    releaseTitle: stringValue(profile, "release_title"),
    releaseKey: stringValue(profile, "release_key"),
    current: selected,
    options,
    supportingRecords,
  };
}

function todayInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function loadTeacherReadModelOnce(nextPath = "/workspace") {
  const access = await requireWorkspaceAccess(undefined, nextPath);
  const client = await createSupabaseServerClient();
  const schoolResult = await client.from("schools").select("id, name, timezone").eq("id", access.schoolId).single();
  if (schoolResult.error || !schoolResult.data) throw new Error("School context could not be loaded.");
  const school = schoolResult.data as Row;
  const [periodsResult, levelsResult, streamsResult, subjectsResult, sectionsResult, lessonsResult, slotsResult, continuityResult, preparationsResult] = await Promise.all([
    client.from("academic_periods").select("id, name, status").eq("school_id", access.schoolId),
    client.from("class_levels").select("id, name").eq("school_id", access.schoolId),
    client.from("streams").select("id, class_level_id, name").eq("school_id", access.schoolId),
    client.from("school_subjects").select("id, name").eq("school_id", access.schoolId),
    client.from("teaching_sections").select("id, academic_period_id, teacher_membership_id, school_subject_id, class_level_id, stream_id").eq("school_id", access.schoolId).eq("teacher_membership_id", access.membershipId).eq("assignment_state", "CONFIRMED").eq("operational_status", "ACTIVE"),
    client.from("scheduled_lessons").select("id, teaching_section_id, scheduled_date, starts_at, ends_at, timetable_slot_id").eq("school_id", access.schoolId).eq("schedule_status", "SCHEDULED").order("starts_at", { ascending: true }).limit(240),
    client.from("timetable_slots").select("id, room_label").eq("school_id", access.schoolId),
    client.rpc("get_classroom_continuity", { p_scope: "MY" }),
    client.from("lesson_preparations").select("id, scheduled_lesson_id, lesson_focus, teacher_notes, intended_coverage, preparation_notes, version, updated_at").eq("school_id", access.schoolId),
  ]);
  const periods = requiredRows(periodsResult, "Academic periods could not be loaded.");
  const levels = requiredRows(levelsResult, "Class levels could not be loaded.");
  const streams = requiredRows(streamsResult, "Streams could not be loaded.");
  const subjects = requiredRows(subjectsResult, "Subjects could not be loaded.");
  const sections = requiredRows(sectionsResult, "Teaching Sections could not be loaded.");
  const scheduledLessonRows = requiredRows(lessonsResult, "Scheduled lessons could not be loaded.");
  const slots = requiredRows(slotsResult, "Timetable slots could not be loaded.");
  const continuityWarning = continuityResult.error ? "Classroom updates are temporarily unavailable. Your schedule and saved preparation remain available. Try again before recording an outcome." : null;
  const continuity = (continuityResult.data ?? []) as Row[];
  const preparations = requiredRows(preparationsResult, "Saved preparation could not be loaded.");
  const periodById = new Map(periods.map((row) => [stringValue(row, "id"), row]));
  const levelById = new Map(levels.map((row) => [stringValue(row, "id"), row]));
  const streamById = new Map(streams.map((row) => [stringValue(row, "id"), row]));
  const subjectById = new Map(subjects.map((row) => [stringValue(row, "id"), row]));
  const slotById = new Map(slots.map((row) => [stringValue(row, "id"), row]));
  const sectionRows = sections.map((row) => {
    const period = periodById.get(stringValue(row, "academic_period_id"));
    const level = levelById.get(stringValue(row, "class_level_id"));
    const stream = streamById.get(stringValue(row, "stream_id"));
    const subject = subjectById.get(stringValue(row, "school_subject_id"));
    return {
      id: stringValue(row, "id"), academicPeriodId: stringValue(row, "academic_period_id"), academicPeriodName: stringValue(period, "name"), academicPeriodStatus: stringValue(period, "status"), teacherMembershipId: stringValue(row, "teacher_membership_id"), subjectId: stringValue(row, "school_subject_id"), subjectName: stringValue(subject, "name"), classLevelId: stringValue(row, "class_level_id"), classLevelName: stringValue(level, "name"), streamId: stringValue(row, "stream_id"), streamName: stringValue(stream, "name"),
    } satisfies TeacherSection;
  });
  const sectionById = new Map(sectionRows.map((section) => [section.id, section]));
  const ownContinuity = continuity.filter((row) => sectionById.has(stringValue(row, "teaching_section_id")));
  const continuityByLesson = new Map(ownContinuity.map((row) => [stringValue(row, "lesson_id"), row]));
  const eventRows = sectionRows.length ? requiredRows(await client.from("classroom_events").select("id, scheduled_lesson_id, outcome, reason, note, created_at").eq("school_id", access.schoolId).in("teaching_section_id", sectionRows.map((section) => section.id)), "Classroom evidence could not be loaded.") : [];
  const eventByLesson = new Map(eventRows.map((row) => [stringValue(row, "scheduled_lesson_id"), row]));
  const prepByLesson = new Map(preparations.map((row) => [stringValue(row, "scheduled_lesson_id"), {
    id: stringValue(row, "id"), scheduledLessonId: stringValue(row, "scheduled_lesson_id"), lessonFocus: stringValue(row, "lesson_focus"), teacherNotes: stringValue(row, "teacher_notes"), intendedCoverage: stringValue(row, "intended_coverage"), preparationNotes: stringValue(row, "preparation_notes"), version: Number(row.version ?? 1), updatedAt: stringValue(row, "updated_at"),
  } satisfies Preparation]));
  const baseLessons = scheduledLessonRows.map((row): TeacherLesson | null => {
    const section = sectionById.get(stringValue(row, "teaching_section_id"));
    if (!section) return null;
    const continuityRow = continuityByLesson.get(stringValue(row, "id"));
    const currentEvent = eventByLesson.get(stringValue(row, "id"));
    const previousEvent = continuityRow?.previous_lesson_id ? eventByLesson.get(String(continuityRow.previous_lesson_id)) : undefined;
    return {
      id: stringValue(row, "id"), sectionId: section.id, scheduledDate: stringValue(row, "scheduled_date"), startsAt: stringValue(row, "starts_at"), endsAt: stringValue(row, "ends_at"), roomLabel: nullableString(slotById.get(stringValue(row, "timetable_slot_id")), "room_label"), section, outcome: (stringValue(currentEvent, "outcome") || nullableString(continuityRow, "outcome")) as TeacherOutcome | null, eventId: nullableString(currentEvent, "id") || nullableString(continuityRow, "event_id"), eventReason: nullableString(currentEvent, "reason") || nullableString(continuityRow, "reason"), eventNote: nullableString(currentEvent, "note") || nullableString(continuityRow, "note"), confirmedAt: nullableString(currentEvent, "created_at") || nullableString(continuityRow, "confirmed_at"), lessonState: stringValue(continuityRow, "lesson_state") || "SCHEDULED", carryForwardState: nullableString(continuityRow, "carry_forward_state"), previousLessonId: nullableString(continuityRow, "previous_lesson_id"), unfinishedWork: nullableString(previousEvent, "note"), preparation: prepByLesson.get(stringValue(row, "id")) ?? null,
      currentPosition: null as CurrentPosition | null,
    } satisfies TeacherLesson;
  }).filter((lesson): lesson is TeacherLesson => lesson !== null);
  const contextBySection = new Map<string, GovernedCurriculumContext>();
  // A newly activated teacher may not have any assigned sections yet. Do not
  // require the server-side knowledge database for that valid empty state.
  // Once sections exist, curriculum context remains mandatory and is loaded
  // through the governed PostgreSQL read model as before.
  if (sectionRows.length > 0) {
    const knowledge = createPostgresKnowledgeClient();
    try {
      await Promise.all(sectionRows.map(async (section) => {
        const context = await loadGovernedContext(knowledge, access.schoolId, section.id, section.classLevelName, todayInTimezone(String(school.timezone)));
        contextBySection.set(section.id, context);
      }));
    } finally {
      await knowledge.close();
    }
  }
  const lessons = baseLessons.map((lesson) => ({ ...lesson, currentPosition: contextBySection.get(lesson.sectionId)?.current ?? null }));
  return { access, schoolName: String(school.name), schoolTimezone: String(school.timezone), sections: sectionRows, lessons, contextBySection, continuityWarning };
}

async function loadTeacherReadModel(nextPath = "/workspace") {
  return withTransientReadRetry(() => loadTeacherReadModelOnce(nextPath), { label: "Teacher read model", attempts: 3, delayMs: 250 });
}

function attentionForLessons(lessons: TeacherLesson[], contexts: Map<string, GovernedCurriculumContext>, now = new Date()): TeacherAttention[] {
  const attention: TeacherAttention[] = [];
  for (const lesson of lessons) {
    if (new Date(lesson.endsAt) <= now && !lesson.eventId) attention.push({ id: `unconfirmed-${lesson.id}`, kind: "UNCONFIRMED", title: `${lesson.section.subjectName} · ${lesson.section.classLevelName} ${lesson.section.streamName}`, detail: "This scheduled lesson still needs a teacher-confirmed classroom record.", lessonId: lesson.id });
    if (lesson.unfinishedWork || lesson.carryForwardState) attention.push({ id: `carry-${lesson.id}`, kind: "CARRY_FORWARD", title: `${lesson.section.classLevelName} ${lesson.section.streamName}`, detail: lesson.unfinishedWork || "Previous classroom work needs to carry forward.", lessonId: lesson.id });
  }
  for (const [sectionId, context] of contexts) if (!context.current && lessons.some((lesson) => lesson.sectionId === sectionId && new Date(lesson.startsAt) > now)) attention.push({ id: `position-${sectionId}`, kind: "POSITION_NEEDED", title: "Confirm the curriculum starting point", detail: "This Teaching Section has no teacher-confirmed curriculum position yet.", lessonId: null });
  return attention.slice(0, 4);
}

export async function loadTeacherHomeData(nextPath = "/workspace"): Promise<TeacherHomeData> {
  const model = await loadTeacherReadModel(nextPath);
  const now = new Date();
  const future = model.lessons.filter((lesson) => new Date(lesson.startsAt) >= now);
  const nextLesson = future[0] ?? null;
  const today = model.lessons.filter((lesson) => lesson.scheduledDate === todayInTimezone(model.schoolTimezone));
  return { access: model.access, schoolName: model.schoolName, schoolTimezone: model.schoolTimezone, nextLesson, todayLessons: today, attention: attentionForLessons(model.lessons, model.contextBySection, now), continuityWarning: model.continuityWarning };
}

async function loadTeachingSectionDataOnce(sectionId: string, nextPath = `/workspace/teacher/sections/${sectionId}`): Promise<TeachingSectionData> {
  const model = await loadTeacherReadModel(nextPath);
  const section = model.sections.find((item) => item.id === sectionId);
  if (!section) throw new Error("Teaching Section not found or not assigned to this teacher.");
  const lessons = model.lessons.filter((lesson) => lesson.sectionId === sectionId);
  const now = new Date();
  const nextLesson = lessons.find((lesson) => new Date(lesson.startsAt) >= now) ?? null;
  const historyClient = createPostgresKnowledgeClient();
  let positionHistory: PositionHistory[] = [];
  try {
    const history = await historyClient.query<Row>(`select e.id, e.position_kind, e.confirmed_at, e.correction_reason, r.source_wording, r.normalized
      from teaching_section_curriculum_position_events e join knowledge_records r on r.canonical_id=e.canonical_id
      where e.school_id=$1 and e.teaching_section_id=$2 order by e.confirmed_at desc, e.id desc limit 8`, [model.access.schoolId, sectionId]);
    positionHistory = history.rows.map((row) => ({ eventId: stringValue(row, "id"), title: recordTitle(row.normalized, stringValue(row, "source_wording")), positionKind: stringValue(row, "position_kind"), confirmedAt: stringValue(row, "confirmed_at"), correctionReason: nullableString(row, "correction_reason") }));
  } finally { await historyClient.close(); }
  return { access: model.access, schoolName: model.schoolName, schoolTimezone: model.schoolTimezone, section, curriculum: model.contextBySection.get(sectionId)!, nextLesson, recentLessons: lessons.filter((lesson) => new Date(lesson.startsAt) < now).slice(-5).reverse(), positionHistory, continuityWarning: model.continuityWarning };
}

export async function loadTeachingSectionData(sectionId: string, nextPath = `/workspace/teacher/sections/${sectionId}`): Promise<TeachingSectionData> {
  return withTransientReadRetry(() => loadTeachingSectionDataOnce(sectionId, nextPath), { label: "Teaching Section read model", attempts: 3, delayMs: 250 });
}

async function loadLessonReadinessDataOnce(lessonId: string, nextPath = `/workspace/teacher/lessons/${lessonId}`): Promise<LessonReadinessData> {
  const model = await loadTeacherReadModel(nextPath);
  const lesson = model.lessons.find((item) => item.id === lessonId);
  if (!lesson) throw new Error("Scheduled lesson not found or not assigned to this teacher.");
  const curriculum = model.contextBySection.get(lesson.sectionId)!;
  const previousLesson = lesson.previousLessonId ? model.lessons.find((item) => item.id === lesson.previousLessonId) ?? null : null;
  const proposal = lesson.outcome ? deriveNextPosition({ outcome: lesson.outcome, current: curriculum.current, options: curriculum.options }) : null;
  const client = await createSupabaseServerClient();
  const artifactRows = requiredRows(await client.from("lesson_artifacts").select("id, artifact_type, status, current_version_id, parent_artifact_id, parent_version_id, curriculum_profile_id, curriculum_position_event_id, curriculum_canonical_id, updated_at, rights_state, provenance").eq("school_id", model.access.schoolId).eq("scheduled_lesson_id", lessonId).eq("teaching_section_id", lesson.sectionId).order("updated_at", { ascending: false }), "Lesson artifacts could not be loaded.");
  const artifactIds = artifactRows.map((row) => stringValue(row, "id"));
  const versionRows = artifactIds.length ? requiredRows(await client.from("lesson_artifact_versions").select("id, artifact_id, version_number, content_json").eq("school_id", model.access.schoolId).in("artifact_id", artifactIds), "Lesson artifact versions could not be loaded.") : [];
  const versionById = new Map(versionRows.map((row) => [stringValue(row, "id"), row]));
  const plan = artifactRows.find((row) => stringValue(row, "artifact_type") === "FORMAL_LESSON_PLAN");
  const planVersionId = nullableString(plan, "current_version_id");
  const artifacts = artifactRows.map((row) => {
    const currentVersionId = nullableString(row, "current_version_id");
    const currentVersion = currentVersionId ? versionById.get(currentVersionId) : undefined;
    return {
      id: stringValue(row, "id"), artifactType: stringValue(row, "artifact_type") as LessonArtifactRecord["artifactType"], status: stringValue(row, "status"), currentVersionId, currentVersionNumber: currentVersion ? Number(currentVersion.version_number) : null, currentContent: currentVersion?.content_json ?? null, parentArtifactId: nullableString(row, "parent_artifact_id"), parentVersionId: nullableString(row, "parent_version_id"), curriculumProfileId: nullableString(row, "curriculum_profile_id"), curriculumPositionEventId: nullableString(row, "curriculum_position_event_id"), curriculumCanonicalId: nullableString(row, "curriculum_canonical_id"), updatedAt: stringValue(row, "updated_at"), rightsState: (stringValue(row, "rights_state") || "UNKNOWN") as LessonArtifactRecord["rightsState"], provenance: Array.isArray(row.provenance) ? row.provenance as unknown[] : [], potentiallyStale: stringValue(row, "artifact_type") !== "FORMAL_LESSON_PLAN" && Boolean(planVersionId && nullableString(row, "parent_version_id") && planVersionId !== nullableString(row, "parent_version_id")),
    } satisfies LessonArtifactRecord;
  });
  return { access: model.access, schoolName: model.schoolName, schoolTimezone: model.schoolTimezone, lesson, curriculum, previousLesson, recommendedFocus: recommendedFocus({ current: curriculum.current, previousOutcome: previousLesson?.outcome ?? null, unfinishedWork: lesson.unfinishedWork, scheduledSubject: lesson.section.subjectName }), proposal, artifacts, continuityWarning: model.continuityWarning };
}

export async function loadLessonReadinessData(lessonId: string, nextPath = `/workspace/teacher/lessons/${lessonId}`): Promise<LessonReadinessData> {
  return withTransientReadRetry(() => loadLessonReadinessDataOnce(lessonId, nextPath), { label: "Lesson readiness read model", attempts: 3, delayMs: 250 });
}
