import "server-only";
import type { KnowledgeSqlClient } from "./db/client";

export type CurriculumBinding = { schoolSubjectId: string; subjectProfileId: string; effectiveFrom: string; effectiveTo?: string };
export type TeachingSectionBinding = { teachingSectionId: string; subjectProfileId: string; effectiveFrom: string; effectiveTo?: string };
export type PositionEvent = { teachingSectionId: string; subjectProfileId: string; canonicalId: string; positionKind: "TOPIC" | "LEARNING_OUTCOME" | "CURRICULAR_UNIT"; confirmedBy: string; confirmedAt?: string; supersedesEventId?: string; correctionReason?: string };

export async function bindSchoolSubjectToCurriculumProfile(client: KnowledgeSqlClient, schoolId: string, input: CurriculumBinding, actorUserId: string): Promise<string> {
  const result = await client.query<{ id: string }>(`insert into school_subject_curriculum_bindings (school_id, school_subject_id, subject_profile_id, effective_from, effective_to, bound_by) values ($1,$2,$3,$4,$5,$6) returning id`, [schoolId, input.schoolSubjectId, input.subjectProfileId, input.effectiveFrom, input.effectiveTo ?? null, actorUserId]);
  return result.rows[0].id;
}

export async function bindTeachingSectionToCurriculumProfile(client: KnowledgeSqlClient, schoolId: string, input: TeachingSectionBinding, actorUserId: string): Promise<string> {
  const result = await client.query<{ id: string }>(`insert into teaching_section_curriculum_bindings (school_id, teaching_section_id, subject_profile_id, effective_from, effective_to, bound_by) values ($1,$2,$3,$4,$5,$6) returning id`, [schoolId, input.teachingSectionId, input.subjectProfileId, input.effectiveFrom, input.effectiveTo ?? null, actorUserId]);
  return result.rows[0].id;
}

export async function recordTeachingSectionCurriculumPosition(client: KnowledgeSqlClient, schoolId: string, input: PositionEvent): Promise<string> {
  const result = await client.query<{ id: string }>(`insert into teaching_section_curriculum_position_events (school_id, teaching_section_id, subject_profile_id, canonical_id, position_kind, confirmed_by, confirmed_at, supersedes_event_id, correction_reason) values ($1,$2,$3,$4,$5,$6,coalesce($7::timestamptz,now()),$8,$9) returning id`, [schoolId, input.teachingSectionId, input.subjectProfileId, input.canonicalId, input.positionKind, input.confirmedBy, input.confirmedAt ?? null, input.supersedesEventId ?? null, input.correctionReason ?? null]);
  return result.rows[0].id;
}

export async function getCurrentTeachingSectionCurriculumPosition(client: KnowledgeSqlClient, schoolId: string, teachingSectionId: string, effectiveOn: string) {
  const result = await client.query(`select e.id, e.teaching_section_id, e.subject_profile_id, e.canonical_id, e.position_kind, e.confirmed_by, e.confirmed_at, e.supersedes_event_id, e.correction_reason, r.record_type, r.normalized, r.source_wording, s.source_id, s.title, s.authority, s.checksum_sha256 as source_checksum_sha256, s.rights_status, s.production_use_status, s.formal_artifact_allowed, s.export_allowed, s.attribution_required, sp.span_id, sp.page_start, sp.page_end, sp.locator, sp.content_sha256 as span_content_sha256, r.content_sha256 as record_content_sha256 from teaching_section_curriculum_position_events e join knowledge_profile_records pr on pr.subject_profile_id=e.subject_profile_id and pr.canonical_id=e.canonical_id and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE' join knowledge_records r on r.canonical_id=e.canonical_id join knowledge_sources s on s.source_id=r.source_id join knowledge_source_spans sp on sp.source_id=r.source_id and sp.span_id=r.span_id where e.school_id=$1 and e.teaching_section_id=$2 and e.confirmed_at::date <= $3::date and not exists (select 1 from teaching_section_curriculum_position_events successor where successor.school_id=e.school_id and successor.teaching_section_id=e.teaching_section_id and successor.supersedes_event_id=e.id) order by e.confirmed_at desc, e.id desc limit 1`, [schoolId, teachingSectionId, effectiveOn]);
  return result.rows[0] ?? null;
}
