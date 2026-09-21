-- Fix live TEST PL/pgSQL name collisions in Step 9 version/finalisation/AI paths.
-- PL/pgSQL variables must not share names with SQL aliases used in the same function.

create or replace function public.create_assessment_version(p_workspace_id uuid, p_content_json jsonb, p_expected_version integer default null, p_change_summary text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare workspace record; actor record; next_version integer; version_id uuid; question_record jsonb; question_marks integer; question_canonical text; blueprint_canonical text; participant text;
begin
  select m.id, m.school_id, m.user_id into actor from memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select w.* into workspace from assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id, p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status = 'FINAL' then raise exception 'finalised assessment workspaces cannot be edited'; end if;
  select coalesce(version_number, 0) + 1 into next_version from assessment_versions where id = workspace.current_version_id;
  if p_expected_version is not null and p_expected_version <> next_version - 1 then raise exception 'assessment changed in another session; reopen before saving'; end if;
  perform private.validate_assessment_payload_shape(p_content_json, workspace.purpose, workspace.total_marks, workspace.duration_minutes);
  for participant in select value from jsonb_array_elements_text(p_content_json->'blueprint'->'participatingSectionIds') value loop
    if not exists(select 1 from assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id and section.teaching_section_id = participant::uuid) then raise exception 'assessment participants must belong to the workspace'; end if;
  end loop;
  select coalesce(sum((q.value->>'marks')::integer), 0) into question_marks from jsonb_array_elements(p_content_json->'questions') as q(value);
  if question_marks <> workspace.total_marks and jsonb_array_length(p_content_json->'questions') > 0 then raise exception 'question marks must equal the configured total'; end if;
  for blueprint_canonical in select value from jsonb_array_elements_text(coalesce(p_content_json->'blueprint'->'scopeCanonicalIds', '[]'::jsonb)) value loop
    if not private.assessment_scope_is_eligible(p_workspace_id, blueprint_canonical) then raise exception 'blueprint references curriculum content outside the recorded eligible scope'; end if;
  end loop;
  for question_record in select value from jsonb_array_elements(p_content_json->'questions') value loop
    if coalesce((question_record->>'marks')::integer, 0) <= 0 then raise exception 'all assessment questions must have marks greater than zero'; end if;
    for question_canonical in select value from jsonb_array_elements_text(coalesce(question_record->'canonicalIds', '[]'::jsonb)) value loop
      if not private.assessment_scope_is_eligible(p_workspace_id, question_canonical) then raise exception 'question references curriculum content outside the recorded eligible scope'; end if;
    end loop;
  end loop;
  insert into assessment_versions(school_id, assessment_workspace_id, version_number, content_json, change_source, change_summary, created_by_membership_id) values(actor.school_id, p_workspace_id, next_version, p_content_json, 'TEACHER', p_change_summary, actor.id) returning id into version_id;
  update assessment_workspaces set current_version_id = version_id, updated_at = now() where id = p_workspace_id;
  insert into audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata) values(actor.school_id, actor.user_id, 'CREATE_VERSION', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('version_id', version_id, 'version_number', next_version, 'change_source', 'TEACHER'));
  return jsonb_build_object('workspaceId', p_workspace_id, 'versionId', version_id, 'versionNumber', next_version);
end;
$$;

create or replace function public.finalize_assessment_workspace(p_workspace_id uuid, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare workspace record; actor record; version record; question_marks integer; question_record jsonb; scope_canonical_id text; v_finalised_at timestamptz := now(); profile_context jsonb; section_ids uuid[];
begin
  select m.id, m.school_id, m.user_id into actor from memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select w.* into workspace from assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id, p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status = 'FINAL' then raise exception 'assessment is already finalised'; end if;
  select array_agg(section.teaching_section_id order by section.teaching_section_id) into section_ids from assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id;
  profile_context := private.resolve_assessment_profile_context(actor.school_id, workspace.academic_period_id, workspace.assessment_date, workspace.school_subject_id, workspace.curriculum_subject_profile_id, workspace.assessment_profile_id, workspace.purpose, section_ids);
  if coalesce((profile_context->>'applicable')::boolean, false) is not true then raise exception 'the assessment profile is no longer applicable; reopen and resolve the current profile'; end if;
  select * into version from assessment_versions where id = workspace.current_version_id and school_id = actor.school_id;
  if not found or (p_expected_version is not null and version.version_number <> p_expected_version) then raise exception 'assessment version is stale; reopen before finalising'; end if;
  perform private.validate_assessment_payload_shape(version.content_json, workspace.purpose, workspace.total_marks, workspace.duration_minutes);
  if jsonb_array_length(version.content_json->'questions') = 0 then raise exception 'add at least one question before finalising'; end if;
  select coalesce(sum((q.value->>'marks')::integer), 0) into question_marks from jsonb_array_elements(version.content_json->'questions') as q(value);
  if question_marks <> workspace.total_marks then raise exception 'question marks must equal the configured total before finalising'; end if;
  for question_record in select value from jsonb_array_elements(version.content_json->'questions') value loop
    if coalesce((question_record->>'marks')::integer, 0) <= 0 or jsonb_array_length(coalesce(question_record->'canonicalIds', '[]'::jsonb)) = 0 then raise exception 'every final assessment question needs positive marks and eligible curriculum scope'; end if;
    for scope_canonical_id in select value from jsonb_array_elements_text(coalesce(question_record->'canonicalIds', '[]'::jsonb)) value loop
      if not private.assessment_scope_is_eligible(p_workspace_id, scope_canonical_id) then raise exception 'final assessment contains curriculum content outside the recorded eligible scope'; end if;
    end loop;
  end loop;
  perform set_config('ate.assessment_finalisation', 'true', true);
  update assessment_workspaces set status = 'FINAL', finalised_by_membership_id = actor.id, finalised_at = v_finalised_at, scope_snapshot = (select jsonb_agg(to_jsonb(item)) from assessment_scope_items item where item.assessment_workspace_id = p_workspace_id), updated_at = v_finalised_at where id = p_workspace_id;
  insert into audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state) values(actor.school_id, actor.user_id, 'FINALIZE', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('version_id', workspace.current_version_id, 'version_number', version.version_number), jsonb_build_object('finalised_at', v_finalised_at));
  return jsonb_build_object('workspaceId', p_workspace_id, 'versionId', workspace.current_version_id, 'versionNumber', version.version_number, 'finalisedAt', v_finalised_at);
end;
$$;

create or replace function public.accept_assessment_ai_version(p_workspace_id uuid, p_generation_run_id uuid, p_expected_version integer, p_output_fingerprint text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor record; workspace record; run_record record; version record; next_version integer; version_id uuid; question_record jsonb; question_marks integer; scope_canonical_id text; profile_context jsonb; section_ids uuid[]; current_scope jsonb;
begin
  select m.id, m.school_id, m.user_id into actor from memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select w.* into workspace from assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id, p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status = 'FINAL' then raise exception 'finalised assessment workspaces cannot be edited'; end if;
  select run.* into run_record from assessment_ai_generation_runs run where run.id = p_generation_run_id and run.assessment_workspace_id = p_workspace_id and run.school_id = actor.school_id and run.created_by_user_id = actor.user_id and run.created_by_membership_id = actor.id and run.status = 'SUCCEEDED' and run.validation_status = 'PASSED' and run.output_fingerprint = p_output_fingerprint for update;
  if not found or run_record.output_json is null then raise exception 'AI proposal is unavailable or has already been accepted'; end if;
  select coalesce(version_number, 0) + 1 into next_version from assessment_versions where id = workspace.current_version_id;
  select * into version from assessment_versions where id = workspace.current_version_id;
  if p_expected_version is not null and p_expected_version <> next_version - 1 then raise exception 'assessment changed while the AI proposal was open'; end if;
  select array_agg(section.teaching_section_id order by section.teaching_section_id) into section_ids from assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id;
  profile_context := private.resolve_assessment_profile_context(actor.school_id, workspace.academic_period_id, workspace.assessment_date, workspace.school_subject_id, workspace.curriculum_subject_profile_id, workspace.assessment_profile_id, workspace.purpose, section_ids);
  if coalesce((profile_context->>'applicable')::boolean, false) is not true or coalesce((profile_context->>'externalAiAllowed')::boolean, false) is not true then raise exception 'the current assessment profile is no longer eligible for AI acceptance'; end if;
  current_scope := to_jsonb(array(select distinct item.canonical_id from assessment_scope_items item where item.assessment_workspace_id = p_workspace_id and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED') order by item.canonical_id));
  if run_record.context_snapshot->>'profileId' is distinct from workspace.assessment_profile_id::text or run_record.context_snapshot->>'purpose' is distinct from workspace.purpose or coalesce((run_record.context_snapshot->>'expectedVersion')::integer, -1) <> next_version - 1 or run_record.context_snapshot->'blueprint' is distinct from version.content_json->'blueprint' or run_record.context_snapshot->'eligibleCanonicalIds' is distinct from current_scope then raise exception 'AI proposal context is stale; generate a new proposal'; end if;
  perform private.validate_assessment_payload_shape(run_record.output_json, workspace.purpose, workspace.total_marks, workspace.duration_minutes);
  select coalesce(sum((q.value->>'marks')::integer), 0) into question_marks from jsonb_array_elements(run_record.output_json->'questions') as q(value);
  if question_marks <> workspace.total_marks then raise exception 'AI proposal marks do not match the approved blueprint'; end if;
  for question_record in select value from jsonb_array_elements(run_record.output_json->'questions') value loop
    if coalesce((question_record->>'marks')::integer, 0) <= 0 then raise exception 'AI proposal contains a question without positive marks'; end if;
    for scope_canonical_id in select value from jsonb_array_elements_text(coalesce(question_record->'canonicalIds', '[]'::jsonb)) value loop
      if not private.assessment_scope_is_eligible(p_workspace_id, scope_canonical_id) then raise exception 'AI proposal contains curriculum content outside the recorded eligible scope'; end if;
    end loop;
  end loop;
  insert into assessment_versions(school_id, assessment_workspace_id, version_number, content_json, change_source, change_summary, created_by_membership_id) values(actor.school_id, p_workspace_id, next_version, run_record.output_json, 'AI', 'Teacher accepted the ATE assessment proposal', actor.id) returning id into version_id;
  update assessment_workspaces set current_version_id = version_id, updated_at = now() where id = p_workspace_id;
  update assessment_ai_generation_runs set status = 'ACCEPTED' where id = p_generation_run_id;
  insert into audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata) values(actor.school_id, actor.user_id, 'ACCEPT_AI_VERSION', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('version_id', version_id, 'generation_run_id', p_generation_run_id, 'version_number', next_version));
  return jsonb_build_object('workspaceId', p_workspace_id, 'versionId', version_id, 'versionNumber', next_version);
end;
$$;

revoke execute on function public.create_assessment_version(uuid, jsonb, integer, text) from anon;
revoke execute on function public.finalize_assessment_workspace(uuid, integer) from anon;
revoke execute on function public.accept_assessment_ai_version(uuid, uuid, integer, text) from anon;
grant execute on function public.create_assessment_version(uuid, jsonb, integer, text) to authenticated;
grant execute on function public.finalize_assessment_workspace(uuid, integer) to authenticated;
grant execute on function public.accept_assessment_ai_version(uuid, uuid, integer, text) to authenticated;
