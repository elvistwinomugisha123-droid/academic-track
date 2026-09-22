-- Repair the Assessment Studio validation functions after the leadership review
-- migration reintroduced a PL/pgSQL variable/column alias collision.

create or replace function private.validate_assessment_ready(
  target_workspace_id uuid,
  target_version_id uuid,
  target_expected_version integer
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  workspace record;
  version record;
  section_ids uuid[];
  profile_context jsonb;
  question_record jsonb;
  question_marks integer;
  canonical_id text;
begin
  select * into workspace from public.assessment_workspaces where id = target_workspace_id for update;
  if not found then raise exception 'assessment workspace was not found'; end if;
  select * into version from public.assessment_versions where id = target_version_id and assessment_workspace_id = target_workspace_id and school_id = workspace.school_id;
  if not found or (target_expected_version is not null and version.version_number <> target_expected_version) then
    raise exception 'assessment version is stale; reopen before submitting or finalising';
  end if;
  select array_agg(section.teaching_section_id order by section.teaching_section_id)
    into section_ids
    from public.assessment_workspace_sections section
   where section.assessment_workspace_id = target_workspace_id;
  profile_context := private.resolve_assessment_profile_context(
    workspace.school_id, workspace.academic_period_id, workspace.assessment_date,
    workspace.school_subject_id, workspace.curriculum_subject_profile_id,
    workspace.assessment_profile_id, workspace.purpose, section_ids
  );
  if coalesce((profile_context->>'applicable')::boolean, false) is not true then
    raise exception 'the assessment profile is no longer applicable; reopen and resolve the current profile';
  end if;
  perform private.validate_assessment_payload_shape(version.content_json, workspace.purpose, workspace.total_marks, workspace.duration_minutes);
  if jsonb_array_length(version.content_json->'questions') = 0 then raise exception 'add at least one question before submitting or finalising'; end if;
  select coalesce(sum((q.value->>'marks')::integer), 0) into question_marks
    from jsonb_array_elements(version.content_json->'questions') as q(value);
  if question_marks <> workspace.total_marks then raise exception 'question marks must equal the configured total before submitting or finalising'; end if;
  for question_record in select q.value from jsonb_array_elements(version.content_json->'questions') as q(value) loop
    if coalesce((question_record->>'marks')::integer, 0) <= 0 or jsonb_array_length(coalesce(question_record->'canonicalIds', '[]'::jsonb)) = 0 then
      raise exception 'every assessment question needs positive marks and eligible curriculum scope';
    end if;
    for canonical_id in select q.value from jsonb_array_elements_text(coalesce(question_record->'canonicalIds', '[]'::jsonb)) as q(value) loop
      if not private.assessment_scope_is_eligible(target_workspace_id, canonical_id) then
        raise exception 'assessment contains curriculum content outside the recorded eligible scope';
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.create_assessment_version(
  p_workspace_id uuid,
  p_content_json jsonb,
  p_expected_version integer default null,
  p_change_summary text default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  workspace record;
  actor record;
  next_version integer;
  version_id uuid;
  question_record jsonb;
  question_marks integer;
  question_canonical text;
  blueprint_canonical text;
  participant text;
begin
  select m.id, m.school_id, m.user_id into actor from public.memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select w.* into workspace from public.assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id, p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status = 'FINAL' then raise exception 'finalised assessment workspaces cannot be edited'; end if;
  if workspace.status = 'IN_REVIEW' then raise exception 'assessment is frozen while it is under academic review'; end if;
  select coalesce(version_number, 0) + 1 into next_version from public.assessment_versions where id = workspace.current_version_id;
  if p_expected_version is not null and p_expected_version <> next_version - 1 then raise exception 'assessment changed in another session; reopen before saving'; end if;
  perform private.validate_assessment_payload_shape(p_content_json, workspace.purpose, workspace.total_marks, workspace.duration_minutes);
  for participant in select q.value from jsonb_array_elements_text(p_content_json->'blueprint'->'participatingSectionIds') as q(value) loop
    if not exists(select 1 from public.assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id and section.teaching_section_id = participant::uuid) then raise exception 'assessment participants must belong to the workspace'; end if;
  end loop;
  select coalesce(sum((q.value->>'marks')::integer), 0) into question_marks from jsonb_array_elements(p_content_json->'questions') as q(value);
  if question_marks <> workspace.total_marks and jsonb_array_length(p_content_json->'questions') > 0 then raise exception 'question marks must equal the configured total'; end if;
  for blueprint_canonical in select q.value from jsonb_array_elements_text(coalesce(p_content_json->'blueprint'->'scopeCanonicalIds', '[]'::jsonb)) as q(value) loop
    if not private.assessment_scope_is_eligible(p_workspace_id, blueprint_canonical) then raise exception 'blueprint references curriculum content outside the recorded eligible scope'; end if;
  end loop;
  for question_record in select q.value from jsonb_array_elements(p_content_json->'questions') as q(value) loop
    if coalesce((question_record->>'marks')::integer, 0) <= 0 then raise exception 'all assessment questions must have marks greater than zero'; end if;
    for question_canonical in select q.value from jsonb_array_elements_text(coalesce(question_record->'canonicalIds', '[]'::jsonb)) as q(value) loop
      if not private.assessment_scope_is_eligible(p_workspace_id, question_canonical) then raise exception 'question references curriculum content outside the recorded eligible scope'; end if;
    end loop;
  end loop;
  insert into public.assessment_versions(school_id, assessment_workspace_id, version_number, content_json, change_source, change_summary, created_by_membership_id)
    values(actor.school_id, p_workspace_id, next_version, p_content_json, 'TEACHER', p_change_summary, actor.id)
    returning id into version_id;
  update public.assessment_workspaces set current_version_id = version_id, updated_at = now() where id = p_workspace_id;
  insert into public.audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata)
    values(actor.school_id, actor.user_id, 'CREATE_VERSION', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('version_id', version_id, 'version_number', next_version, 'change_source', 'TEACHER'));
  return jsonb_build_object('workspaceId', p_workspace_id, 'versionId', version_id, 'versionNumber', next_version);
end;
$$;
