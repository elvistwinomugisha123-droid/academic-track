-- Step 9: production Assessment Studio foundation.
-- Assessment scope/evidence is relational institutional truth. The version payload
-- is immutable JSON because questions are edited and reordered as one artifact.

create table public.assessment_workspaces (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  academic_period_id uuid not null,
  school_subject_id uuid not null,
  curriculum_subject_profile_id uuid not null references public.knowledge_subject_profiles(id),
  assessment_profile_id uuid not null references public.knowledge_assessment_profiles(id),
  purpose text not null check (purpose in ('FORMATIVE_CHECK','CLASS_TEST','DIAGNOSTIC','REVISION_PRACTICE','COMMON_STREAM_TEST','INTERNAL_EXAM')),
  title text not null check (char_length(trim(title)) between 1 and 240),
  status text not null default 'DRAFT' check (status in ('DRAFT','IN_REVIEW','FINAL')),
  duration_minutes integer not null check (duration_minutes > 0),
  total_marks integer not null check (total_marks > 0),
  current_version_id uuid,
  finalised_by_membership_id uuid,
  finalised_at timestamptz,
  profile_snapshot jsonb not null default '{}'::jsonb,
  scope_snapshot jsonb,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (academic_period_id, school_id) references public.academic_periods(id, school_id),
  foreign key (school_subject_id, school_id) references public.school_subjects(id, school_id),
  foreign key (created_by_membership_id, school_id) references public.memberships(id, school_id)
);

create table public.assessment_workspace_sections (
  assessment_workspace_id uuid not null,
  school_id uuid not null,
  teaching_section_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (assessment_workspace_id, teaching_section_id),
  foreign key (assessment_workspace_id, school_id) references public.assessment_workspaces(id, school_id) on delete cascade,
  foreign key (teaching_section_id, school_id) references public.teaching_sections(id, school_id)
);

create table public.assessment_scope_items (
  id uuid primary key default gen_random_uuid(),
  assessment_workspace_id uuid not null,
  school_id uuid not null,
  canonical_id text not null references public.knowledge_records(canonical_id),
  scope_state text not null check (scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED','EXCLUDED')),
  evidence_type text not null check (evidence_type in ('CONFIRMED_DELIVERY','EXPLICIT_PARTIAL_SCOPE_CONFIRMATION','PROFILE_BROADER_SCOPE','TEACHER_EXCLUSION')),
  evidence_reference_id text,
  section_id uuid,
  override_reason text,
  confirmed_by_membership_id uuid,
  created_at timestamptz not null default now(),
  unique (assessment_workspace_id, canonical_id, section_id),
  foreign key (assessment_workspace_id, school_id) references public.assessment_workspaces(id, school_id) on delete cascade,
  foreign key (section_id, school_id) references public.teaching_sections(id, school_id),
  foreign key (confirmed_by_membership_id, school_id) references public.memberships(id, school_id)
);

create table public.assessment_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  assessment_workspace_id uuid not null,
  version_number integer not null check (version_number > 0),
  content_json jsonb not null,
  change_source text not null check (change_source in ('TEACHER','AI','SYSTEM')),
  change_summary text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  unique (assessment_workspace_id, version_number),
  unique (id, school_id),
  foreign key (assessment_workspace_id, school_id) references public.assessment_workspaces(id, school_id) on delete cascade,
  foreign key (created_by_membership_id, school_id) references public.memberships(id, school_id)
);

alter table public.assessment_workspaces
  add constraint assessment_workspaces_current_version_fk
  foreign key (current_version_id, school_id) references public.assessment_versions(id, school_id);

create table public.assessment_ai_generation_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  assessment_workspace_id uuid not null,
  created_by_user_id uuid not null,
  created_by_membership_id uuid not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  context_fingerprint text not null,
  output_fingerprint text,
  output_json jsonb,
  status text not null check (status in ('RUNNING','SUCCEEDED','FAILED','RIGHTS_BLOCKED','REJECTED','ACCEPTED')),
  validation_status text not null check (validation_status in ('NOT_RUN','PASSED','FAILED','STALE')),
  rights_state text not null check (rights_state in ('CLEARED','REVIEW_REQUIRED','RESTRICTED','UNKNOWN')),
  input_token_count integer,
  output_token_count integer,
  latency_ms integer,
  error_code text,
  created_at timestamptz not null default now(),
  foreign key (assessment_workspace_id, school_id) references public.assessment_workspaces(id, school_id)
);

create index assessment_workspaces_teacher_idx on public.assessment_workspaces(school_id, created_by_membership_id, updated_at desc);
create index assessment_scope_items_lookup_idx on public.assessment_scope_items(school_id, assessment_workspace_id, scope_state, canonical_id);
create index assessment_versions_lookup_idx on public.assessment_versions(school_id, assessment_workspace_id, version_number desc);
create index assessment_ai_runs_lookup_idx on public.assessment_ai_generation_runs(school_id, assessment_workspace_id, created_at desc);

create or replace function private.assessment_can_manage(target_school_id uuid, target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_school_member(target_school_id)
    and exists (
      select 1 from public.assessment_workspaces workspace
      where workspace.id = target_workspace_id and workspace.school_id = target_school_id
        and workspace.created_by_membership_id = (select m.id from public.memberships m where m.school_id = target_school_id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE' limit 1)
    )
    and not exists (
      select 1
      from public.assessment_workspace_sections workspace_section
      join public.teaching_sections section on section.id = workspace_section.teaching_section_id and section.school_id = workspace_section.school_id
      where workspace_section.assessment_workspace_id = target_workspace_id
        and workspace_section.school_id = target_school_id
        and section.teacher_membership_id <> (select m.id from public.memberships m where m.school_id = target_school_id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE' limit 1)
    )
$$;

create or replace function private.assessment_sections_are_owned(target_school_id uuid, target_membership_id uuid, target_section_ids uuid[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(array_length(target_section_ids, 1), 0) > 0
    and not exists (
      select 1 from unnest(target_section_ids) requested(section_id)
      where not exists (
        select 1 from public.teaching_sections section
        where section.id = requested.section_id and section.school_id = target_school_id
          and section.teacher_membership_id = target_membership_id
          and section.assignment_state = 'CONFIRMED' and section.operational_status = 'ACTIVE'
      )
    )
$$;

create or replace function private.prevent_final_assessment_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status = 'FINAL' then raise exception 'finalised assessment workspaces are immutable; create a new draft revision'; end if;
  if new.status = 'FINAL' and coalesce(current_setting('ate.assessment_finalisation', true), '') <> 'true' then raise exception 'finalisation must use the controlled Assessment Studio command'; end if;
  return new;
end;
$$;
create trigger assessment_workspace_final_immutable before update or delete on public.assessment_workspaces for each row execute function private.prevent_final_assessment_mutation();
create or replace function private.prevent_assessment_version_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'assessment versions are immutable; create a new assessment version';
end;
$$;
create trigger assessment_version_append_only before update or delete on public.assessment_versions for each row execute function private.prevent_assessment_version_mutation();

alter table public.assessment_workspaces enable row level security;
alter table public.assessment_workspace_sections enable row level security;
alter table public.assessment_scope_items enable row level security;
alter table public.assessment_versions enable row level security;
alter table public.assessment_ai_generation_runs enable row level security;
revoke all on public.assessment_workspaces, public.assessment_workspace_sections, public.assessment_scope_items, public.assessment_versions, public.assessment_ai_generation_runs from anon, authenticated;
grant select on public.assessment_workspaces, public.assessment_workspace_sections, public.assessment_scope_items, public.assessment_versions to authenticated;
create policy assessment_workspaces_read on public.assessment_workspaces for select to authenticated using (private.assessment_can_manage(school_id, id));
create policy assessment_workspace_sections_read on public.assessment_workspace_sections for select to authenticated using (private.assessment_can_manage(school_id, assessment_workspace_id));
create policy assessment_scope_items_read on public.assessment_scope_items for select to authenticated using (private.assessment_can_manage(school_id, assessment_workspace_id));
create policy assessment_versions_read on public.assessment_versions for select to authenticated using (private.assessment_can_manage(school_id, assessment_workspace_id));

create or replace function public.create_assessment_workspace(
  p_academic_period_id uuid, p_school_subject_id uuid, p_curriculum_subject_profile_id uuid,
  p_assessment_profile_id uuid, p_purpose text, p_title text, p_duration_minutes integer,
  p_total_marks integer, p_section_ids uuid[], p_scope_items jsonb, p_content_json jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor record; profile record; workspace_id uuid; version_id uuid; item jsonb; section_id uuid; canonical_id text; scope_state text; evidence_type text;
begin
  select m.id, m.school_id, m.user_id into actor from memberships m where m.user_id = auth.uid() and m.status='ACTIVE' limit 1;
  if not found then raise exception 'active school membership is required'; end if;
  if p_title is null or char_length(trim(p_title)) = 0 or p_duration_minutes <= 0 or p_total_marks <= 0 then raise exception 'assessment identity, duration, and marks are required'; end if;
  if not private.assessment_sections_are_owned(actor.school_id, actor.id, p_section_ids) then raise exception 'every participating Teaching Section must be assigned to the authenticated teacher'; end if;
  if not exists(select 1 from school_subject_curriculum_bindings binding where binding.school_id=actor.school_id and binding.school_subject_id=p_school_subject_id and binding.subject_profile_id=p_curriculum_subject_profile_id and binding.status='ACTIVE') then raise exception 'curriculum subject profile is not the active governed binding for the selected subject'; end if;
  if exists(select 1 from unnest(p_section_ids) requested(section_id) where not exists(select 1 from teaching_section_curriculum_bindings binding where binding.school_id=actor.school_id and binding.teaching_section_id=requested.section_id and binding.subject_profile_id=p_curriculum_subject_profile_id and binding.status='ACTIVE')) then raise exception 'curriculum subject profile is not the active governed binding for every Teaching Section'; end if;
  select ap.id, ap.purpose, ap.status, release.status as release_status, ap.subject_profile_id
    into profile from knowledge_assessment_profiles ap join knowledge_curriculum_releases release on release.id=ap.release_id
   where ap.id=p_assessment_profile_id and ap.purpose=p_purpose and ap.status='ACTIVE' and release.status='ACTIVE'
     and (ap.subject_profile_id is null or ap.subject_profile_id=p_curriculum_subject_profile_id);
  if not found then raise exception 'assessment profile is not active, verified, or applicable to this purpose'; end if;
  insert into assessment_workspaces(school_id, academic_period_id, school_subject_id, curriculum_subject_profile_id, assessment_profile_id, purpose, title, duration_minutes, total_marks, profile_snapshot, created_by_membership_id)
  values(actor.school_id,p_academic_period_id,p_school_subject_id,p_curriculum_subject_profile_id,p_assessment_profile_id,p_purpose,trim(p_title),p_duration_minutes,p_total_marks,jsonb_build_object('assessmentProfileId',profile.id,'purpose',profile.purpose,'subjectProfileId',profile.subject_profile_id,'releaseStatus',profile.release_status),actor.id)
  returning id into workspace_id;
  foreach section_id in array p_section_ids loop insert into assessment_workspace_sections(assessment_workspace_id, school_id, teaching_section_id) values(workspace_id, actor.school_id, section_id); end loop;
  for item in select * from jsonb_array_elements(coalesce(p_scope_items,'[]'::jsonb)) loop
    canonical_id := item->>'canonicalId'; scope_state := coalesce(item->>'scopeState','CONFIRMED_ELIGIBLE'); evidence_type := coalesce(item->>'evidenceType','CONFIRMED_DELIVERY');
    if not exists(select 1 from knowledge_records record where record.canonical_id=canonical_id) then raise exception 'scope item references an unknown curriculum ID'; end if;
    if scope_state = 'BROADER_PROFILE_PERMITTED' and p_purpose not in ('DIAGNOSTIC','REVISION_PRACTICE','INTERNAL_EXAM') then raise exception 'broader scope is not permitted for this purpose'; end if;
    if nullif(item->>'sectionId','') is not null and not (nullif(item->>'sectionId','')::uuid = any(p_section_ids)) then raise exception 'scope evidence references a Teaching Section outside this assessment'; end if;
    if evidence_type = 'CONFIRMED_DELIVERY' and not exists(select 1 from teaching_section_curriculum_position_events position where position.school_id=actor.school_id and position.id=(item->>'evidenceReferenceId')::uuid and position.teaching_section_id=nullif(item->>'sectionId','')::uuid and position.canonical_id=canonical_id) then raise exception 'confirmed scope evidence does not match the governed curriculum position history'; end if;
    insert into assessment_scope_items(assessment_workspace_id,school_id,canonical_id,scope_state,evidence_type,evidence_reference_id,section_id,override_reason,confirmed_by_membership_id)
    values(workspace_id,actor.school_id,canonical_id,scope_state,evidence_type,item->>'evidenceReferenceId',nullif(item->>'sectionId','')::uuid,item->>'overrideReason',actor.id);
  end loop;
  insert into assessment_versions(school_id,assessment_workspace_id,version_number,content_json,change_source,change_summary,created_by_membership_id)
  values(actor.school_id,workspace_id,1,p_content_json,'TEACHER','Initial teacher-authored assessment draft',actor.id) returning id into version_id;
  update assessment_workspaces set current_version_id=version_id, updated_at=now() where id=workspace_id;
  insert into audit_events(school_id,actor_user_id,action,resource_type,resource_id,metadata,after_state) values(actor.school_id,actor.user_id,'CREATE','ASSESSMENT_WORKSPACE',workspace_id,jsonb_build_object('purpose',p_purpose,'profile_id',p_assessment_profile_id,'section_ids',p_section_ids),jsonb_build_object('version_id',version_id));
  return jsonb_build_object('workspaceId',workspace_id,'versionId',version_id,'versionNumber',1);
end;
$$;

create or replace function public.create_assessment_version(p_workspace_id uuid, p_content_json jsonb, p_expected_version integer default null, p_change_source text default 'TEACHER', p_change_summary text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare workspace record; actor record; next_version integer; version_id uuid; question jsonb; question_marks integer; question_canonical text; blueprint_canonical text;
begin
  select m.id,m.school_id,m.user_id into actor from memberships m where m.user_id=auth.uid() and m.status='ACTIVE' limit 1;
  select w.* into workspace from assessment_workspaces w where w.id=p_workspace_id and w.school_id=actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id,p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status='FINAL' then raise exception 'finalised assessment workspaces cannot be edited'; end if;
  if p_change_source not in ('TEACHER','AI') then raise exception 'invalid assessment version source'; end if;
  select coalesce(version_number,0)+1 into next_version from assessment_versions where id=workspace.current_version_id;
  if p_expected_version is not null and p_expected_version <> next_version-1 then raise exception 'assessment changed in another session; reopen before saving'; end if;
  if coalesce((p_content_json->>'totalMarks')::integer,-1) <> workspace.total_marks then raise exception 'assessment total marks must remain equal to the configured total'; end if;
  if coalesce((p_content_json->>'durationMinutes')::integer,-1) <> workspace.duration_minutes then raise exception 'assessment duration must remain equal to the configured duration'; end if;
  select coalesce(sum((question->>'marks')::integer),0) into question_marks from jsonb_array_elements(coalesce(p_content_json->'questions','[]'::jsonb)) question;
  if question_marks <> workspace.total_marks and jsonb_array_length(coalesce(p_content_json->'questions','[]'::jsonb)) > 0 then raise exception 'question marks must equal the configured total'; end if;
  for blueprint_canonical in select value from jsonb_array_elements_text(coalesce(p_content_json->'blueprint'->'scopeCanonicalIds','[]'::jsonb)) value loop
    if not exists(select 1 from assessment_scope_items item where item.assessment_workspace_id=p_workspace_id and item.canonical_id=blueprint_canonical and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED')) then raise exception 'blueprint references curriculum content outside the recorded eligible scope'; end if;
  end loop;
  for question in select * from jsonb_array_elements(coalesce(p_content_json->'questions','[]'::jsonb)) loop
    if coalesce((question->>'marks')::integer,0) <= 0 then raise exception 'all assessment questions must have marks greater than zero'; end if;
    for question_canonical in select value from jsonb_array_elements_text(coalesce(question->'canonicalIds','[]'::jsonb)) value loop
      if not exists(select 1 from assessment_scope_items item where item.assessment_workspace_id=p_workspace_id and item.canonical_id=question_canonical and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED')) then raise exception 'question references curriculum content outside the recorded eligible scope'; end if;
    end loop;
  end loop;
  insert into assessment_versions(school_id,assessment_workspace_id,version_number,content_json,change_source,change_summary,created_by_membership_id) values(actor.school_id,p_workspace_id,next_version,p_content_json,p_change_source,p_change_summary,actor.id) returning id into version_id;
  update assessment_workspaces set current_version_id=version_id,updated_at=now() where id=p_workspace_id;
  insert into audit_events(school_id,actor_user_id,action,resource_type,resource_id,metadata) values(actor.school_id,actor.user_id,'CREATE_VERSION','ASSESSMENT_WORKSPACE',p_workspace_id,jsonb_build_object('version_id',version_id,'version_number',next_version,'change_source',p_change_source));
  return jsonb_build_object('workspaceId',p_workspace_id,'versionId',version_id,'versionNumber',next_version);
end;
$$;

create or replace function public.finalize_assessment_workspace(p_workspace_id uuid, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare workspace record; actor record; version record; question_marks integer; question jsonb; canonical_id text; v_finalised_at timestamptz := now();
begin
  select m.id,m.school_id,m.user_id into actor from memberships m where m.user_id=auth.uid() and m.status='ACTIVE' limit 1;
  select w.* into workspace from assessment_workspaces w where w.id=p_workspace_id and w.school_id=actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id,p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status='FINAL' then raise exception 'assessment is already finalised'; end if;
  if not exists(select 1 from knowledge_assessment_profiles profile join knowledge_curriculum_releases release on release.id=profile.release_id where profile.id=workspace.assessment_profile_id and profile.purpose=workspace.purpose and profile.status='ACTIVE' and release.status='ACTIVE') then raise exception 'the assessment profile is no longer applicable; reopen and resolve the current profile'; end if;
  select * into version from assessment_versions where id=workspace.current_version_id and school_id=actor.school_id;
  if not found or (p_expected_version is not null and version.version_number <> p_expected_version) then raise exception 'assessment version is stale; reopen before finalising'; end if;
  if jsonb_array_length(coalesce(version.content_json->'questions','[]'::jsonb)) = 0 then raise exception 'add at least one question before finalising'; end if;
  select coalesce(sum((question->>'marks')::integer),0) into question_marks from jsonb_array_elements(version.content_json->'questions') question;
  if question_marks <> workspace.total_marks then raise exception 'question marks must equal the configured total before finalising'; end if;
  for question in select * from jsonb_array_elements(version.content_json->'questions') loop
    if coalesce((question->>'marks')::integer,0) <= 0 or jsonb_array_length(coalesce(question->'canonicalIds','[]'::jsonb)) = 0 then raise exception 'every final assessment question needs positive marks and eligible curriculum scope'; end if;
    for canonical_id in select value from jsonb_array_elements_text(coalesce(question->'canonicalIds','[]'::jsonb)) value loop
      if not exists(select 1 from assessment_scope_items item where item.assessment_workspace_id=p_workspace_id and item.canonical_id=canonical_id and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED')) then raise exception 'final assessment contains curriculum content outside the recorded eligible scope'; end if;
    end loop;
  end loop;
  perform set_config('ate.assessment_finalisation','true',true);
  update assessment_workspaces set status='FINAL', finalised_by_membership_id=actor.id, finalised_at=v_finalised_at, scope_snapshot=(select jsonb_agg(to_jsonb(item)) from assessment_scope_items item where item.assessment_workspace_id=p_workspace_id), updated_at=v_finalised_at where id=p_workspace_id;
  insert into audit_events(school_id,actor_user_id,action,resource_type,resource_id,metadata,after_state) values(actor.school_id,actor.user_id,'FINALIZE','ASSESSMENT_WORKSPACE',p_workspace_id,jsonb_build_object('version_id',workspace.current_version_id,'version_number',version.version_number),jsonb_build_object('finalised_at',v_finalised_at));
  return jsonb_build_object('workspaceId',p_workspace_id,'versionId',workspace.current_version_id,'versionNumber',version.version_number,'finalisedAt',v_finalised_at);
end;
$$;

create or replace function public.accept_assessment_ai_version(p_workspace_id uuid, p_generation_run_id uuid, p_expected_version integer, p_output_fingerprint text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor record; workspace record; run_record record; next_version integer; version_id uuid; question jsonb; question_marks integer; canonical_id text;
begin
  select m.id,m.school_id,m.user_id into actor from memberships m where m.user_id=auth.uid() and m.status='ACTIVE' limit 1;
  select w.* into workspace from assessment_workspaces w where w.id=p_workspace_id and w.school_id=actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id,p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status='FINAL' then raise exception 'finalised assessment workspaces cannot be edited'; end if;
  select run.* into run_record from assessment_ai_generation_runs run where run.id=p_generation_run_id and run.assessment_workspace_id=p_workspace_id and run.school_id=actor.school_id and run.created_by_user_id=actor.user_id and run.created_by_membership_id=actor.id and run.status='SUCCEEDED' and run.validation_status='PASSED' and run.output_fingerprint=p_output_fingerprint for update;
  if not found or run_record.output_json is null then raise exception 'AI proposal is unavailable or has already been accepted'; end if;
  select coalesce(version_number,0)+1 into next_version from assessment_versions where id=workspace.current_version_id;
  if p_expected_version is not null and p_expected_version <> next_version-1 then raise exception 'assessment changed while the AI proposal was open'; end if;
  if coalesce((run_record.output_json->>'totalMarks')::integer,-1) <> workspace.total_marks or coalesce((run_record.output_json->>'durationMinutes')::integer,-1) <> workspace.duration_minutes then raise exception 'AI proposal changed the approved marks or duration'; end if;
  select coalesce(sum((question->>'marks')::integer),0) into question_marks from jsonb_array_elements(coalesce(run_record.output_json->'questions','[]'::jsonb)) question;
  if question_marks <> workspace.total_marks then raise exception 'AI proposal marks do not match the approved blueprint'; end if;
  for question in select * from jsonb_array_elements(coalesce(run_record.output_json->'questions','[]'::jsonb)) loop
    if coalesce((question->>'marks')::integer,0) <= 0 then raise exception 'AI proposal contains a question without positive marks'; end if;
    for canonical_id in select value from jsonb_array_elements_text(coalesce(question->'canonicalIds','[]'::jsonb)) value loop
      if not exists(select 1 from assessment_scope_items item where item.assessment_workspace_id=p_workspace_id and item.canonical_id=canonical_id and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED')) then raise exception 'AI proposal contains curriculum content outside the recorded eligible scope'; end if;
    end loop;
  end loop;
  insert into assessment_versions(school_id,assessment_workspace_id,version_number,content_json,change_source,change_summary,created_by_membership_id) values(actor.school_id,p_workspace_id,next_version,run_record.output_json,'AI','Teacher accepted the ATE assessment proposal',actor.id) returning id into version_id;
  update assessment_workspaces set current_version_id=version_id,updated_at=now() where id=p_workspace_id;
  update assessment_ai_generation_runs set status='ACCEPTED' where id=p_generation_run_id;
  insert into audit_events(school_id,actor_user_id,action,resource_type,resource_id,metadata) values(actor.school_id,actor.user_id,'ACCEPT_AI_VERSION','ASSESSMENT_WORKSPACE',p_workspace_id,jsonb_build_object('version_id',version_id,'generation_run_id',p_generation_run_id,'version_number',next_version));
  return jsonb_build_object('workspaceId',p_workspace_id,'versionId',version_id,'versionNumber',next_version);
end;
$$;

revoke all on function private.assessment_can_manage(uuid,uuid) from public;
revoke all on function private.assessment_sections_are_owned(uuid,uuid,uuid[]) from public;
revoke all on function public.create_assessment_workspace(uuid,uuid,uuid,uuid,text,text,integer,integer,uuid[],jsonb,jsonb) from public;
revoke all on function public.create_assessment_version(uuid,jsonb,integer,text,text) from public;
revoke all on function public.finalize_assessment_workspace(uuid,integer) from public;
revoke all on function public.accept_assessment_ai_version(uuid,uuid,integer,text) from public;
grant execute on function private.assessment_can_manage(uuid,uuid) to authenticated;
grant execute on function private.assessment_sections_are_owned(uuid,uuid,uuid[]) to authenticated;
grant execute on function public.create_assessment_workspace(uuid,uuid,uuid,uuid,text,text,integer,integer,uuid[],jsonb,jsonb) to authenticated;
grant execute on function public.create_assessment_version(uuid,jsonb,integer,text,text) to authenticated;
grant execute on function public.finalize_assessment_workspace(uuid,integer) to authenticated;
grant execute on function public.accept_assessment_ai_version(uuid,uuid,integer,text) to authenticated;
