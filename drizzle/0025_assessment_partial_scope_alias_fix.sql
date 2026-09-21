-- Fix a live TEST-only PL/pgSQL name collision found during Step 9 acceptance.
-- The record variable `workspace` must not also be used as the table alias.

create or replace function public.confirm_assessment_partial_scope(p_workspace_id uuid, p_section_id uuid, p_canonical_id text, p_evidence_reference_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor record; workspace record; profile_context jsonb; classroom_event record; current_version record; item_id uuid; version_id uuid; next_version integer; updated_content jsonb; current_scope_eligible boolean;
begin
  select m.id, m.school_id, m.user_id into actor from memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select w.* into workspace from assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id, p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status = 'FINAL' then raise exception 'finalised assessment workspaces cannot be changed'; end if;
  if not exists(select 1 from assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id and section.teaching_section_id = p_section_id) then raise exception 'partial scope section is outside the assessment'; end if;
  profile_context := private.resolve_assessment_profile_context(actor.school_id, workspace.academic_period_id, workspace.assessment_date, workspace.school_subject_id, workspace.curriculum_subject_profile_id, workspace.assessment_profile_id, workspace.purpose, array[p_section_id]);
  if coalesce((profile_context->>'applicable')::boolean, false) is not true or coalesce((profile_context->>'allowsPartialScope')::boolean, false) is not true then raise exception 'the resolved assessment profile does not permit partial-scope confirmation'; end if;
  if not private.assessment_canonical_is_governed(workspace.curriculum_subject_profile_id, p_canonical_id, workspace.assessment_date) then raise exception 'partial scope must reference an approved, runtime-eligible record in the bound subject profile'; end if;
  select classroom.*, preparation.curriculum_position_event_id as preparation_position_event_id into classroom_event
    from classroom_events classroom
    join scheduled_lessons lesson on lesson.id = classroom.scheduled_lesson_id and lesson.school_id = classroom.school_id
    join lesson_preparations preparation on preparation.school_id = classroom.school_id and preparation.scheduled_lesson_id = classroom.scheduled_lesson_id and preparation.teaching_section_id = classroom.teaching_section_id
   where classroom.id = p_evidence_reference_id and classroom.school_id = actor.school_id and classroom.teaching_section_id = p_section_id and classroom.outcome = 'PARTIALLY_DELIVERED'
     and lesson.academic_period_id = workspace.academic_period_id and lesson.scheduled_date <= workspace.assessment_date and preparation.curriculum_profile_id = workspace.curriculum_subject_profile_id and preparation.curriculum_canonical_id = p_canonical_id
     and not exists(select 1 from classroom_events successor where successor.supersedes_event_id = classroom.id);
  if not found then raise exception 'partial scope must reference current PARTIALLY_DELIVERED classroom evidence with a matching lesson preparation anchor'; end if;
  insert into assessment_scope_items(assessment_workspace_id, school_id, canonical_id, scope_state, evidence_type, evidence_reference_id, classroom_evidence_id, curriculum_position_event_id, section_id, override_reason, confirmed_by_membership_id) values(p_workspace_id, actor.school_id, p_canonical_id, 'CONFIRMED_ELIGIBLE', 'EXPLICIT_PARTIAL_SCOPE_CONFIRMATION', classroom_event.id::text, classroom_event.id, classroom_event.preparation_position_event_id, p_section_id, nullif(trim(p_reason), ''), actor.id)
  on conflict (assessment_workspace_id, canonical_id, section_id) do update set scope_state = excluded.scope_state, evidence_type = excluded.evidence_type, evidence_reference_id = excluded.evidence_reference_id, classroom_evidence_id = excluded.classroom_evidence_id, curriculum_position_event_id = excluded.curriculum_position_event_id, override_reason = excluded.override_reason, confirmed_by_membership_id = excluded.confirmed_by_membership_id;
  select id into item_id from assessment_scope_items where assessment_workspace_id = p_workspace_id and canonical_id = p_canonical_id and section_id = p_section_id;
  current_scope_eligible := private.assessment_scope_is_eligible(p_workspace_id, p_canonical_id);
  if current_scope_eligible then
    select * into current_version from assessment_versions where id = workspace.current_version_id for update;
    next_version := current_version.version_number + 1;
    updated_content := jsonb_set(current_version.content_json, '{blueprint,scopeCanonicalIds}', case when exists(select 1 from jsonb_array_elements_text(coalesce(current_version.content_json->'blueprint'->'scopeCanonicalIds', '[]'::jsonb)) value where value = p_canonical_id) then coalesce(current_version.content_json->'blueprint'->'scopeCanonicalIds', '[]'::jsonb) else coalesce(current_version.content_json->'blueprint'->'scopeCanonicalIds', '[]'::jsonb) || jsonb_build_array(p_canonical_id) end, true);
    insert into assessment_versions(school_id, assessment_workspace_id, version_number, content_json, change_source, change_summary, created_by_membership_id) values(actor.school_id, p_workspace_id, next_version, updated_content, 'TEACHER', 'Teacher confirmed an assessable partial curricular portion', actor.id) returning id into version_id;
    update assessment_workspaces set current_version_id = version_id, updated_at = now() where id = p_workspace_id;
  end if;
  insert into audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata) values(actor.school_id, actor.user_id, 'CONFIRM_PARTIAL_ASSESSMENT_SCOPE', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('scope_item_id', item_id, 'section_id', p_section_id, 'canonical_id', p_canonical_id, 'classroom_evidence_id', classroom_event.id, 'curriculum_position_event_id', classroom_event.preparation_position_event_id));
  return jsonb_build_object('workspaceId', p_workspace_id, 'scopeItemId', item_id, 'canonicalId', p_canonical_id, 'sectionId', p_section_id);
end;
$$;

revoke execute on function public.confirm_assessment_partial_scope(uuid, uuid, text, uuid, text) from anon;
grant execute on function public.confirm_assessment_partial_scope(uuid, uuid, text, uuid, text) to authenticated;
