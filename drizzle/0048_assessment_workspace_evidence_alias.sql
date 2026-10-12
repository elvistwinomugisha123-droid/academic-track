create or replace function public.create_assessment_workspace(p_academic_period_id uuid, p_school_subject_id uuid, p_curriculum_subject_profile_id uuid, p_assessment_profile_id uuid, p_purpose text, p_title text, p_duration_minutes integer, p_total_marks integer, p_section_ids uuid[], p_scope_items jsonb, p_content_json jsonb, p_assessment_date date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor record; workspace_id uuid; version_id uuid; item jsonb; section_id uuid; canonical_id text; scope_state text; evidence_type text; section_value uuid; evidence_value uuid; classroom_evidence_value uuid; profile_context jsonb; assessment_date date; period_start_date date; period_end_date date;
begin
  select m.id, m.school_id, m.user_id into actor from memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  if not found then raise exception 'active school membership is required'; end if;
  if p_title is null or char_length(trim(p_title)) = 0 or p_duration_minutes <= 0 or p_total_marks <= 0 then raise exception 'assessment identity, duration, and marks are required'; end if;
  if not private.assessment_sections_are_owned(actor.school_id, actor.id, p_section_ids) then raise exception 'every participating Teaching Section must be assigned to the authenticated teacher'; end if;
  select period.starts_on, period.ends_on into period_start_date, period_end_date from academic_periods period where period.id = p_academic_period_id and period.school_id = actor.school_id;
  if period_start_date is null or p_assessment_date is null or p_assessment_date < period_start_date or p_assessment_date > period_end_date then raise exception 'assessment date must fall inside the selected academic period'; end if;
  assessment_date := p_assessment_date;
  profile_context := private.resolve_assessment_profile_context(actor.school_id, p_academic_period_id, p_assessment_date, p_school_subject_id, p_curriculum_subject_profile_id, p_assessment_profile_id, p_purpose, p_section_ids);
  if coalesce((profile_context->>'applicable')::boolean, false) is not true then raise exception '%', coalesce(profile_context->>'reason', 'assessment profile is not applicable'); end if;
  perform private.validate_assessment_payload_shape(p_content_json, p_purpose, p_total_marks, p_duration_minutes);
  if p_scope_items is null or jsonb_typeof(p_scope_items) <> 'array' then raise exception 'assessment scope items must be a JSON array'; end if;
  insert into assessment_workspaces(school_id, academic_period_id, school_subject_id, curriculum_subject_profile_id, assessment_profile_id, purpose, title, duration_minutes, total_marks, assessment_date, profile_snapshot, created_by_membership_id) values(actor.school_id, p_academic_period_id, p_school_subject_id, p_curriculum_subject_profile_id, p_assessment_profile_id, p_purpose, trim(p_title), p_duration_minutes, p_total_marks, assessment_date, profile_context, actor.id) returning id into workspace_id;
  foreach section_id in array p_section_ids loop insert into assessment_workspace_sections(assessment_workspace_id, school_id, teaching_section_id) values(workspace_id, actor.school_id, section_id); end loop;
  for item in select value from jsonb_array_elements(p_scope_items) value loop
    canonical_id := nullif(trim(item->>'canonicalId'), ''); scope_state := coalesce(item->>'scopeState', 'CONFIRMED_ELIGIBLE'); evidence_type := coalesce(item->>'evidenceType', 'CONFIRMED_DELIVERY'); section_value := nullif(item->>'sectionId', '')::uuid; classroom_evidence_value := nullif(item->>'classroomEvidenceId', '')::uuid; evidence_value := nullif(item->>'curriculumPositionEventId', '')::uuid;
    if canonical_id is null or not private.assessment_canonical_is_governed(p_curriculum_subject_profile_id, canonical_id, assessment_date) then raise exception 'scope item is not an approved, runtime-eligible record in the bound subject profile'; end if;
    if scope_state not in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED') then raise exception 'scope items may only establish governed eligible scope during workspace creation'; end if;
    if scope_state = 'BROADER_PROFILE_PERMITTED' and coalesce((profile_context->>'allowsBroaderScope')::boolean, false) is not true then raise exception 'the resolved assessment profile does not permit broader scope'; end if;
    if section_value is null or not (section_value = any(p_section_ids)) then raise exception 'scope evidence must belong to a participating Teaching Section'; end if;
    if evidence_type <> 'CONFIRMED_DELIVERY' then raise exception 'partial scope must be confirmed through the controlled partial-scope RPC'; end if;
    if classroom_evidence_value is null or not exists (
      select 1
      from classroom_events classroom_event
      join scheduled_lessons lesson on lesson.id = classroom_event.scheduled_lesson_id and lesson.school_id = classroom_event.school_id
      join lesson_preparations preparation on preparation.school_id = classroom_event.school_id and preparation.scheduled_lesson_id = classroom_event.scheduled_lesson_id and preparation.teaching_section_id = classroom_event.teaching_section_id
      where classroom_event.id = classroom_evidence_value and classroom_event.school_id = actor.school_id and classroom_event.teaching_section_id = section_value and classroom_event.outcome = 'DELIVERED'
        and lesson.academic_period_id = p_academic_period_id and lesson.scheduled_date <= assessment_date and not exists (select 1 from classroom_events successor where successor.supersedes_event_id = classroom_event.id)
        and preparation.curriculum_profile_id = p_curriculum_subject_profile_id and preparation.curriculum_canonical_id = canonical_id
        and (evidence_value is null or preparation.curriculum_position_event_id = evidence_value)
    ) then raise exception 'confirmed delivery scope must reference a current DELIVERED classroom event and matching lesson preparation anchor'; end if;
    insert into assessment_scope_items(assessment_workspace_id, school_id, canonical_id, scope_state, evidence_type, evidence_reference_id, classroom_evidence_id, curriculum_position_event_id, section_id, override_reason, confirmed_by_membership_id) values(workspace_id, actor.school_id, canonical_id, scope_state, evidence_type, classroom_evidence_value::text, classroom_evidence_value, evidence_value, section_value, item->>'overrideReason', actor.id);
  end loop;
  if not exists(select 1 from assessment_scope_items item where item.assessment_workspace_id = workspace_id and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED')) and not (coalesce((profile_context->>'allowsPartialScope')::boolean, false) and exists(
    select 1 from classroom_events classroom_event
    join scheduled_lessons lesson on lesson.id = classroom_event.scheduled_lesson_id and lesson.school_id = classroom_event.school_id
    join lesson_preparations preparation on preparation.school_id = classroom_event.school_id and preparation.scheduled_lesson_id = classroom_event.scheduled_lesson_id and preparation.teaching_section_id = classroom_event.teaching_section_id
    where classroom_event.school_id = actor.school_id and classroom_event.teaching_section_id = any(p_section_ids) and classroom_event.outcome = 'PARTIALLY_DELIVERED' and lesson.academic_period_id = p_academic_period_id and preparation.curriculum_profile_id = p_curriculum_subject_profile_id and preparation.curriculum_canonical_id is not null and not exists(select 1 from classroom_events successor where successor.supersedes_event_id = classroom_event.id)
  )) then raise exception 'no governed eligible assessment scope was supplied'; end if;
  insert into assessment_versions(school_id, assessment_workspace_id, version_number, content_json, change_source, change_summary, created_by_membership_id) values(actor.school_id, workspace_id, 1, p_content_json, 'TEACHER', 'Initial teacher-authored assessment draft', actor.id) returning id into version_id;
  update assessment_workspaces set current_version_id = version_id, updated_at = now() where id = workspace_id;
  insert into audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state) values(actor.school_id, actor.user_id, 'CREATE', 'ASSESSMENT_WORKSPACE', workspace_id, jsonb_build_object('purpose', p_purpose, 'profile_id', p_assessment_profile_id, 'section_ids', p_section_ids), jsonb_build_object('version_id', version_id));
  return jsonb_build_object('workspaceId', workspace_id, 'versionId', version_id, 'versionNumber', 1);
end;
$$;
