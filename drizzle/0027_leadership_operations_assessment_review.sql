-- Step 10: role-aware leadership projections and the Assessment Studio review gate.
-- This migration is forward-only. It reuses classroom_events, scheduled_lessons,
-- curriculum position events, Teaching Sections and immutable assessment versions.

alter table public.assessment_workspaces
  add column if not exists submitted_version_id uuid,
  add column if not exists submitted_by_membership_id uuid,
  add column if not exists submitted_at timestamptz;

alter table public.assessment_workspaces
  add constraint assessment_workspaces_submitted_version_fk
  foreign key (submitted_version_id, school_id) references public.assessment_versions(id, school_id);

alter table public.assessment_workspaces
  add constraint assessment_workspaces_submitted_membership_fk
  foreign key (submitted_by_membership_id, school_id) references public.memberships(id, school_id);

create table public.assessment_review_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  assessment_workspace_id uuid not null,
  assessment_version_id uuid not null,
  event_type text not null check (event_type in ('SUBMITTED', 'APPROVED', 'RETURNED')),
  actor_membership_id uuid not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (assessment_workspace_id, school_id) references public.assessment_workspaces(id, school_id),
  foreign key (assessment_version_id, school_id) references public.assessment_versions(id, school_id),
  foreign key (actor_membership_id, school_id) references public.memberships(id, school_id),
  check (reason is null or char_length(trim(reason)) <= 2000),
  check (event_type <> 'RETURNED' or char_length(trim(coalesce(reason, ''))) > 0)
);

create index assessment_review_events_workspace_idx
  on public.assessment_review_events (school_id, assessment_workspace_id, created_at desc);

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
  question jsonb;
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
  select coalesce(sum((question->>'marks')::integer), 0) into question_marks
    from jsonb_array_elements(version.content_json->'questions') question;
  if question_marks <> workspace.total_marks then raise exception 'question marks must equal the configured total before submitting or finalising'; end if;
  for question in select value from jsonb_array_elements(version.content_json->'questions') value loop
    if coalesce((question->>'marks')::integer, 0) <= 0 or jsonb_array_length(coalesce(question->'canonicalIds', '[]'::jsonb)) = 0 then
      raise exception 'every assessment question needs positive marks and eligible curriculum scope';
    end if;
    for canonical_id in select value from jsonb_array_elements_text(coalesce(question->'canonicalIds', '[]'::jsonb)) value loop
      if not private.assessment_scope_is_eligible(target_workspace_id, canonical_id) then
        raise exception 'assessment contains curriculum content outside the recorded eligible scope';
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function private.prevent_assessment_review_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status = 'FINAL' then raise exception 'finalised assessment workspaces are immutable; create a new draft revision'; end if;
  if old.status = 'IN_REVIEW' and coalesce(current_setting('ate.assessment_review_transition', true), '') <> 'true' then
    raise exception 'assessment is frozen while it is under academic review';
  end if;
  if new.status = 'FINAL' and coalesce(current_setting('ate.assessment_finalisation', true), '') <> 'true' then
    raise exception 'finalisation must use the controlled Assessment Studio command';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_assessment_review_event_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'assessment review history is append-only';
end;
$$;

create trigger assessment_review_events_append_only
before update or delete on public.assessment_review_events
for each row execute function private.prevent_assessment_review_event_mutation();

create or replace function private.prevent_assessment_version_insert_while_review()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (
    select 1
      from public.assessment_workspaces workspace
     where workspace.id = new.assessment_workspace_id
       and workspace.school_id = new.school_id
       and workspace.status in ('IN_REVIEW', 'FINAL')
  ) and coalesce(current_setting('ate.assessment_review_transition', true), '') <> 'true'
    and coalesce(current_setting('ate.assessment_finalisation', true), '') <> 'true' then
    raise exception 'assessment versions are frozen while the assessment is under review or finalised';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_version_review_freeze on public.assessment_versions;
create trigger assessment_version_review_freeze
before insert on public.assessment_versions
for each row execute function private.prevent_assessment_version_insert_while_review();

drop trigger if exists assessment_workspace_final_immutable on public.assessment_workspaces;
create trigger assessment_workspace_final_immutable
before update or delete on public.assessment_workspaces
for each row execute function private.prevent_assessment_review_mutation();

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
  question jsonb;
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
  for participant in select value from jsonb_array_elements_text(p_content_json->'blueprint'->'participatingSectionIds') value loop
    if not exists(select 1 from public.assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id and section.teaching_section_id = participant::uuid) then raise exception 'assessment participants must belong to the workspace'; end if;
  end loop;
  select coalesce(sum((question->>'marks')::integer), 0) into question_marks from jsonb_array_elements(p_content_json->'questions') question;
  if question_marks <> workspace.total_marks and jsonb_array_length(p_content_json->'questions') > 0 then raise exception 'question marks must equal the configured total'; end if;
  for blueprint_canonical in select value from jsonb_array_elements_text(coalesce(p_content_json->'blueprint'->'scopeCanonicalIds', '[]'::jsonb)) value loop
    if not private.assessment_scope_is_eligible(p_workspace_id, blueprint_canonical) then raise exception 'blueprint references curriculum content outside the recorded eligible scope'; end if;
  end loop;
  for question in select value from jsonb_array_elements(p_content_json->'questions') value loop
    if coalesce((question->>'marks')::integer, 0) <= 0 then raise exception 'all assessment questions must have marks greater than zero'; end if;
    for question_canonical in select value from jsonb_array_elements_text(coalesce(question->'canonicalIds', '[]'::jsonb)) value loop
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

create or replace function public.finalize_assessment_workspace(p_workspace_id uuid, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  workspace record;
  actor record;
  version record;
  profile_context jsonb;
  v_finalised_at timestamptz := now();
begin
  select m.id, m.school_id, m.user_id into actor from public.memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select w.* into workspace from public.assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id, p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status = 'FINAL' then raise exception 'assessment is already finalised'; end if;
  if workspace.status = 'IN_REVIEW' then raise exception 'assessment is under academic review; only an authorised reviewer may finalise it'; end if;
  select private.resolve_assessment_profile_context(actor.school_id, workspace.academic_period_id, workspace.assessment_date, workspace.school_subject_id, workspace.curriculum_subject_profile_id, workspace.assessment_profile_id, workspace.purpose, array(select section.teaching_section_id from public.assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id)) into profile_context;
  if coalesce((profile_context->>'requiresReview')::boolean, false) then raise exception 'this assessment profile requires academic review before finalisation'; end if;
  select * into version from public.assessment_versions where id = workspace.current_version_id and school_id = actor.school_id;
  perform private.validate_assessment_ready(p_workspace_id, workspace.current_version_id, p_expected_version);
  perform set_config('ate.assessment_finalisation', 'true', true);
  update public.assessment_workspaces set status = 'FINAL', finalised_by_membership_id = actor.id, finalised_at = v_finalised_at, scope_snapshot = (select jsonb_agg(to_jsonb(item)) from public.assessment_scope_items item where item.assessment_workspace_id = p_workspace_id), updated_at = v_finalised_at where id = p_workspace_id;
  insert into public.audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
    values(actor.school_id, actor.user_id, 'FINALIZE', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('version_id', workspace.current_version_id, 'version_number', version.version_number, 'requires_review', false), jsonb_build_object('finalised_at', v_finalised_at));
  return jsonb_build_object('workspaceId', p_workspace_id, 'versionId', workspace.current_version_id, 'versionNumber', version.version_number, 'finalisedAt', v_finalised_at);
end;
$$;

create or replace function public.submit_assessment_for_review(p_workspace_id uuid, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  workspace record;
  actor record;
  profile_context jsonb;
  version record;
  v_submitted_at timestamptz := now();
begin
  select m.id, m.school_id, m.user_id into actor from public.memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  if not found or not exists(select 1 from public.role_grants grant_row where grant_row.membership_id = actor.id and grant_row.school_id = actor.school_id and grant_row.role = 'TEACHER' and grant_row.scope_type = 'SCHOOL' and grant_row.status = 'ACTIVE') then raise exception 'an active teacher role is required'; end if;
  select w.* into workspace from public.assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id, p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status <> 'DRAFT' then raise exception 'only a draft assessment can be submitted for review'; end if;
  select private.resolve_assessment_profile_context(actor.school_id, workspace.academic_period_id, workspace.assessment_date, workspace.school_subject_id, workspace.curriculum_subject_profile_id, workspace.assessment_profile_id, workspace.purpose, array(select section.teaching_section_id from public.assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id)) into profile_context;
  if coalesce((profile_context->>'applicable')::boolean, false) is not true then raise exception 'the assessment profile is no longer applicable'; end if;
  if coalesce((profile_context->>'requiresReview')::boolean, false) is not true then raise exception 'this assessment profile does not require academic review; the teacher may finalise directly'; end if;
  perform private.validate_assessment_ready(p_workspace_id, workspace.current_version_id, p_expected_version);
  select * into version from public.assessment_versions where id = workspace.current_version_id;
  perform set_config('ate.assessment_review_transition', 'true', true);
  update public.assessment_workspaces set status = 'IN_REVIEW', submitted_version_id = version.id, submitted_by_membership_id = actor.id, submitted_at = v_submitted_at, updated_at = v_submitted_at where id = p_workspace_id;
  insert into public.assessment_review_events(school_id, assessment_workspace_id, assessment_version_id, event_type, actor_membership_id, created_at)
    values(actor.school_id, p_workspace_id, version.id, 'SUBMITTED', actor.id, v_submitted_at);
  insert into public.audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
    values(actor.school_id, actor.user_id, 'SUBMIT_FOR_REVIEW', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('version_id', version.id, 'version_number', version.version_number), jsonb_build_object('status', 'IN_REVIEW', 'submitted_at', v_submitted_at));
  return jsonb_build_object('workspaceId', p_workspace_id, 'versionId', version.id, 'versionNumber', version.version_number, 'submittedAt', v_submitted_at);
end;
$$;

create or replace function public.review_assessment_workspace(p_workspace_id uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  workspace record;
  actor record;
  subject_department_id uuid;
  submitted_version uuid;
  reviewed_at timestamptz := now();
  clean_reason text := nullif(trim(p_reason), '');
begin
  select m.id, m.school_id, m.user_id into actor from public.memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select w.* into workspace from public.assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id for update;
  if not found or workspace.status <> 'IN_REVIEW' then raise exception 'only an assessment under review can be reviewed'; end if;
  select subject.department_id into subject_department_id from public.school_subjects subject where subject.id = workspace.school_subject_id and subject.school_id = actor.school_id;
  if not (private.has_school_role(actor.school_id, 'DOS') or private.has_department_role(actor.school_id, subject_department_id, 'HOD')) then raise exception 'the active reviewer is not authorised for this assessment subject'; end if;
  if p_decision not in ('APPROVE', 'RETURN') then raise exception 'review decision must be APPROVE or RETURN'; end if;
  if p_decision = 'RETURN' and clean_reason is null then raise exception 'a return reason is required'; end if;
  submitted_version := coalesce(workspace.submitted_version_id, workspace.current_version_id);
  if not exists(select 1 from public.assessment_versions version where version.id = submitted_version and version.assessment_workspace_id = p_workspace_id and version.school_id = actor.school_id) then raise exception 'the submitted assessment version was not found'; end if;
  perform set_config('ate.assessment_review_transition', 'true', true);
  if p_decision = 'APPROVE' then
    perform set_config('ate.assessment_finalisation', 'true', true);
    update public.assessment_workspaces set status = 'FINAL', finalised_by_membership_id = actor.id, finalised_at = reviewed_at, scope_snapshot = (select jsonb_agg(to_jsonb(item)) from public.assessment_scope_items item where item.assessment_workspace_id = p_workspace_id), updated_at = reviewed_at where id = p_workspace_id;
    insert into public.assessment_review_events(school_id, assessment_workspace_id, assessment_version_id, event_type, actor_membership_id, reason, created_at)
      values(actor.school_id, p_workspace_id, submitted_version, 'APPROVED', actor.id, clean_reason, reviewed_at);
  else
    update public.assessment_workspaces set status = 'DRAFT', updated_at = reviewed_at where id = p_workspace_id;
    insert into public.assessment_review_events(school_id, assessment_workspace_id, assessment_version_id, event_type, actor_membership_id, reason, created_at)
      values(actor.school_id, p_workspace_id, submitted_version, 'RETURNED', actor.id, clean_reason, reviewed_at);
  end if;
  insert into public.audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
    values(actor.school_id, actor.user_id, case when p_decision = 'APPROVE' then 'APPROVE_ASSESSMENT_REVIEW' else 'RETURN_ASSESSMENT_REVIEW' end, 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('version_id', submitted_version, 'decision', p_decision, 'reason', clean_reason), jsonb_build_object('status', case when p_decision = 'APPROVE' then 'FINAL' else 'DRAFT' end, 'reviewed_at', reviewed_at));
  return jsonb_build_object('workspaceId', p_workspace_id, 'decision', p_decision, 'status', case when p_decision = 'APPROVE' then 'FINAL' else 'DRAFT' end, 'reviewedAt', reviewed_at);
end;
$$;

create or replace function public.get_assessment_review_workspace(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  actor record;
  workspace record;
  subject_department_id uuid;
  version record;
begin
  select m.id, m.school_id into actor from public.memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select w.* into workspace from public.assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id;
  if not found then raise exception 'assessment review workspace was not found'; end if;
  select subject.department_id into subject_department_id from public.school_subjects subject where subject.id = workspace.school_subject_id and subject.school_id = actor.school_id;
  if not (private.has_school_role(actor.school_id, 'DOS') or private.has_department_role(actor.school_id, subject_department_id, 'HOD')) then raise exception 'the active user is not authorised to review this assessment'; end if;
  if workspace.status not in ('IN_REVIEW', 'FINAL') then raise exception 'only submitted or final assessments are visible to academic reviewers'; end if;
  if workspace.status = 'IN_REVIEW' then
    select * into version from public.assessment_versions where id = coalesce(workspace.submitted_version_id, workspace.current_version_id) and school_id = actor.school_id;
  end if;
  return jsonb_build_object(
    'workspace', jsonb_build_object('id', workspace.id, 'title', workspace.title, 'purpose', workspace.purpose, 'status', workspace.status, 'durationMinutes', workspace.duration_minutes, 'totalMarks', workspace.total_marks, 'assessmentDate', workspace.assessment_date, 'schoolSubjectId', workspace.school_subject_id, 'profileSnapshot', workspace.profile_snapshot, 'submittedAt', workspace.submitted_at, 'finalisedAt', workspace.finalised_at),
    'version', case when version.id is null then null else jsonb_build_object('id', version.id, 'versionNumber', version.version_number, 'content', version.content_json, 'createdAt', version.created_at) end,
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id', section.id, 'classLevel', level.name, 'stream', stream.name, 'teacher', teacher.display_name) order by level.sort_order, stream.name) from public.assessment_workspace_sections workspace_section join public.teaching_sections section on section.id = workspace_section.teaching_section_id and section.school_id = workspace_section.school_id join public.class_levels level on level.id = section.class_level_id and level.school_id = section.school_id join public.streams stream on stream.id = section.stream_id and stream.school_id = section.school_id join public.memberships teacher on teacher.id = section.teacher_membership_id and teacher.school_id = section.school_id where workspace_section.assessment_workspace_id = p_workspace_id and workspace_section.school_id = actor.school_id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('eventType', review.event_type, 'reason', review.reason, 'createdAt', review.created_at, 'actor', membership.display_name) order by review.created_at desc) from public.assessment_review_events review join public.memberships membership on membership.id = review.actor_membership_id and membership.school_id = review.school_id where review.assessment_workspace_id = p_workspace_id and review.school_id = actor.school_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_leadership_overview(p_scope text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  actor record;
  result jsonb;
begin
  select m.id, m.school_id into actor from public.memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  if not found or p_scope not in ('HOD', 'DOS', 'PRINCIPAL') then raise exception 'a valid leadership scope is required'; end if;
  if p_scope = 'HOD' and not exists(select 1 from public.role_grants grant_row where grant_row.membership_id = actor.id and grant_row.school_id = actor.school_id and grant_row.role = 'HOD' and grant_row.scope_type = 'DEPARTMENT' and grant_row.status = 'ACTIVE') then raise exception 'an active HOD grant is required'; end if;
  if p_scope in ('DOS', 'PRINCIPAL') and not private.has_school_role(actor.school_id, p_scope) then raise exception 'the active leadership role is not authorised for this overview'; end if;

  with scope_sections as (
    select section.id, section.academic_period_id, section.teacher_membership_id, section.school_subject_id, section.class_level_id, section.stream_id,
           period.name as period_name, period.starts_on, period.ends_on,
           subject.department_id, subject.name as subject_name, subject.code as subject_code,
           department.name as department_name, level.name as class_level_name, level.sort_order as class_level_sort_order,
           stream.name as stream_name, teacher.display_name as teacher_name,
           greatest(period.starts_on, least(current_date, period.ends_on)) as effective_on
      from public.teaching_sections section
      join public.academic_periods period on period.id = section.academic_period_id and period.school_id = section.school_id
      join public.school_subjects subject on subject.id = section.school_subject_id and subject.school_id = section.school_id
      left join public.departments department on department.id = subject.department_id and department.school_id = subject.school_id
      join public.class_levels level on level.id = section.class_level_id and level.school_id = section.school_id
      join public.streams stream on stream.id = section.stream_id and stream.school_id = section.school_id
      join public.memberships teacher on teacher.id = section.teacher_membership_id and teacher.school_id = section.school_id
     where section.school_id = actor.school_id and section.assignment_state = 'CONFIRMED' and section.operational_status = 'ACTIVE'
       and (p_scope in ('DOS', 'PRINCIPAL') or private.has_department_role(section.school_id, subject.department_id, 'HOD'))
  ), section_context as (
    select scoped.*,
           binding.subject_profile_id,
           position_event.id as position_event_id,
           position_event.canonical_id,
           position_event.confirmed_at as position_confirmed_at,
           position_record.ordering_key,
           position_record.id as governed_record_id,
           coalesce(nullif(position_record_record.normalized->>'title', ''), nullif(position_record_record.normalized->>'name', ''), position_event.canonical_id) as position_label
      from scope_sections scoped
      left join lateral (
        select section_binding.subject_profile_id
          from public.teaching_section_curriculum_bindings section_binding
         where section_binding.school_id = actor.school_id and section_binding.teaching_section_id = scoped.id and section_binding.status = 'ACTIVE'
           and section_binding.effective_from <= scoped.effective_on and (section_binding.effective_to is null or section_binding.effective_to >= scoped.effective_on)
         order by section_binding.effective_from desc, section_binding.id desc limit 1
      ) binding on true
      left join lateral (
        select event.*
          from public.teaching_section_curriculum_position_events event
         where event.school_id = actor.school_id and event.teaching_section_id = scoped.id and event.confirmed_at::date <= scoped.effective_on
           and not exists(select 1 from public.teaching_section_curriculum_position_events successor where successor.school_id = event.school_id and successor.supersedes_event_id = event.id and successor.confirmed_at::date <= scoped.effective_on)
         order by event.confirmed_at desc, event.id desc limit 1
      ) position_event on true
      left join public.knowledge_profile_records position_record on position_record.subject_profile_id = binding.subject_profile_id and position_record.canonical_id = position_event.canonical_id and position_record.status = 'APPROVED' and position_record.runtime_status = 'PILOT_ACTIVE'
       and (position_record.effective_from is null or position_record.effective_from <= scoped.effective_on) and (position_record.effective_to is null or position_record.effective_to >= scoped.effective_on)
      left join public.knowledge_records position_record_record on position_record_record.canonical_id = position_event.canonical_id and position_record_record.verification_status = 'VERIFIED'
  ), positioned as (
    select context.*, case when context.subject_profile_id is null then 'UNAVAILABLE' when context.position_event_id is null then 'UNAVAILABLE' when context.governed_record_id is null then 'REVIEW_REQUIRED' else 'CONFIRMED' end as position_status,
           case when context.ordering_key is not null and context.governed_record_id is not null then row_number() over(partition by context.subject_profile_id order by context.ordering_key, context.canonical_id) end as position_order
      from section_context context
  ), lesson_state as (
    select lesson.id as lesson_id, lesson.teaching_section_id, lesson.scheduled_date, lesson.starts_at, lesson.ends_at,
           section.subject_name, section.subject_code, section.department_name, section.class_level_name, section.stream_name,
           section.teacher_name, event.id as event_id, event.outcome, event.reason, event.note,
           case when event.outcome = 'PARTIALLY_DELIVERED' then 'PARTIALLY_DELIVERED' when event.outcome = 'NOT_DELIVERED' then 'NOT_DELIVERED' when event.outcome = 'CHANGED' then 'CHANGED' when event.outcome = 'DELIVERED' then 'DELIVERED' when lesson.ends_at <= now() then 'UNCONFIRMED' else 'SCHEDULED' end as lesson_state
      from public.scheduled_lessons lesson
      join positioned section on section.id = lesson.teaching_section_id
      left join lateral (select classroom.* from public.classroom_events classroom where classroom.school_id = actor.school_id and classroom.scheduled_lesson_id = lesson.id and not exists(select 1 from public.classroom_events successor where successor.supersedes_event_id = classroom.id) order by classroom.created_at desc limit 1) event on true
     where lesson.school_id = actor.school_id and lesson.schedule_status = 'SCHEDULED' and lesson.starts_at <= now() + interval '60 days' and lesson.ends_at >= now() - interval '90 days'
  ), programme_disruptions as (
    select distinct lesson.id as lesson_id, lesson.teaching_section_id, event.id as programme_event_id, event.title, event.event_type, event.starts_at, event.ends_at
      from public.scheduled_lessons lesson
      join positioned section on section.id = lesson.teaching_section_id
      join public.school_programme_events event on event.school_id = actor.school_id and event.status = 'SCHEDULED' and event.starts_at < lesson.ends_at and event.ends_at > lesson.starts_at
     where lesson.schedule_status = 'SCHEDULED'
       and (not exists(select 1 from public.programme_event_targets target where target.event_id = event.id and target.school_id = actor.school_id) or exists(select 1 from public.programme_event_targets target where target.event_id = event.id and target.school_id = actor.school_id and (target.class_level_id = section.class_level_id or target.stream_id = section.stream_id or target.department_id = section.department_id)))
  ), attention as (
    select 'UNCONFIRMED_LESSON' as item_type, 'ACTION_REQUIRED' as category, lesson.teaching_section_id, lesson.subject_name, lesson.class_level_name, lesson.stream_name, lesson.scheduled_date as relevant_date, 'Past scheduled lesson has no authorised classroom outcome.' as reason, 'DEPARTMENT' as responsible_scope, concat('#section-', lesson.teaching_section_id) as safe_destination
      from lesson_state lesson where lesson.lesson_state = 'UNCONFIRMED'
    union all
    select concat(lower(lesson.lesson_state), '_LESSON'), case when lesson.lesson_state in ('NOT_DELIVERED', 'PARTIALLY_DELIVERED') then 'ACTION_REQUIRED' else 'REVIEW' end, lesson.teaching_section_id, lesson.subject_name, lesson.class_level_name, lesson.stream_name, lesson.scheduled_date, case lesson.lesson_state when 'NOT_DELIVERED' then coalesce(nullif(lesson.reason, ''), 'Teacher confirmed that the lesson was not delivered.') when 'PARTIALLY_DELIVERED' then 'Teacher-confirmed partial delivery has carry-forward implications.' else 'Teacher confirmed a change from the planned lesson.' end, 'DEPARTMENT', concat('#section-', lesson.teaching_section_id)
      from lesson_state lesson where lesson.lesson_state in ('NOT_DELIVERED', 'PARTIALLY_DELIVERED', 'CHANGED')
    union all
    select 'CURRICULUM_POSITION', 'REVIEW', positioned.id, positioned.subject_name, positioned.class_level_name, positioned.stream_name, positioned.effective_on, case when positioned.subject_profile_id is null then 'Teaching Section has no applicable governed curriculum binding.' when positioned.position_event_id is null then 'No confirmed curriculum position is recorded for this Teaching Section.' else 'The recorded curriculum position is not currently usable under the governed profile.' end, 'DEPARTMENT', concat('#section-', positioned.id)
      from positioned where positioned.position_status <> 'CONFIRMED'
    union all
    select 'PROGRAMME_DISRUPTION', 'REVIEW', disruption.teaching_section_id, section.subject_name, section.class_level_name, section.stream_name, disruption.starts_at::date, concat('Programme event affects scheduled teaching: ', disruption.title, '.'), 'SCHOOL', concat('#section-', disruption.teaching_section_id)
      from programme_disruptions disruption join positioned section on section.id = disruption.teaching_section_id
    union all
    select 'STREAM_DRIFT', 'REVIEW', left_section.id, left_section.subject_name, left_section.class_level_name, left_section.stream_name, current_date, concat('Parallel stream is ', case when abs(left_section.position_order - right_section.position_order) >= 2 then '2+ positions' else '1 position' end, ' apart based on governed ordering.'), 'DEPARTMENT', concat('#section-', left_section.id)
      from positioned left_section join positioned right_section on right_section.academic_period_id = left_section.academic_period_id and right_section.school_subject_id = left_section.school_subject_id and right_section.class_level_id = left_section.class_level_id and right_section.id > left_section.id and left_section.position_status = 'CONFIRMED' and right_section.position_status = 'CONFIRMED' and left_section.position_order is not null and right_section.position_order is not null and abs(left_section.position_order - right_section.position_order) >= 1
    union all
    select 'ASSESSMENT_REVIEW', 'ACTION_REQUIRED', null, subject.name, null, null, workspace.submitted_at::date, 'Assessment submitted for required academic review.', case when p_scope = 'HOD' then 'DEPARTMENT' else 'SCHOOL' end, concat('/workspace/leadership/assessments/', workspace.id)
      from public.assessment_workspaces workspace join public.school_subjects subject on subject.id = workspace.school_subject_id and subject.school_id = workspace.school_id
     where workspace.school_id = actor.school_id and workspace.status = 'IN_REVIEW' and (p_scope <> 'HOD' or private.has_department_role(actor.school_id, subject.department_id, 'HOD'))
  ), assessment_state as (
    select workspace.id, workspace.title, workspace.purpose, workspace.status, workspace.total_marks, workspace.duration_minutes, workspace.assessment_date, workspace.submitted_at, workspace.finalised_at, subject.name as subject_name, department.name as department_name,
           coalesce((workspace.profile_snapshot->>'requiresReview')::boolean, false) as requires_review,
           count(distinct workspace_section.teaching_section_id) as section_count
      from public.assessment_workspaces workspace
      join public.school_subjects subject on subject.id = workspace.school_subject_id and subject.school_id = workspace.school_id
      left join public.departments department on department.id = subject.department_id and department.school_id = subject.school_id
      join public.assessment_workspace_sections workspace_section on workspace_section.assessment_workspace_id = workspace.id and workspace_section.school_id = workspace.school_id
      join positioned section on section.id = workspace_section.teaching_section_id
     where workspace.school_id = actor.school_id and workspace.status in ('IN_REVIEW', 'FINAL') and (p_scope <> 'PRINCIPAL' or workspace.status = 'IN_REVIEW')
     group by workspace.id, workspace.title, workspace.purpose, workspace.status, workspace.total_marks, workspace.duration_minutes, workspace.assessment_date, workspace.submitted_at, workspace.finalised_at, workspace.profile_snapshot, subject.name, department.name
  ), drift as (
    select left_section.id as left_section_id, right_section.id as right_section_id, left_section.subject_name, left_section.class_level_name, left_section.stream_name as left_stream, right_section.stream_name as right_stream,
           case when left_section.canonical_id = right_section.canonical_id then 'ALIGNED' when left_section.position_order is null or right_section.position_order is null then 'UNKNOWN' when abs(left_section.position_order - right_section.position_order) >= 2 then 'TWO_OR_MORE_POSITIONS_APART' else 'ONE_POSITION_APART' end as alignment,
           case when left_section.position_order is null or right_section.position_order is null then null else abs(left_section.position_order - right_section.position_order) end as position_distance
      from positioned left_section join positioned right_section on right_section.academic_period_id = left_section.academic_period_id and right_section.school_subject_id = left_section.school_subject_id and right_section.class_level_id = left_section.class_level_id and right_section.id > left_section.id
       and left_section.subject_profile_id is not distinct from right_section.subject_profile_id
  )
  select jsonb_build_object(
    'scope', p_scope,
    'summary', (select jsonb_build_object('scheduledLessons', count(*), 'delivered', count(*) filter (where lesson_state = 'DELIVERED'), 'partiallyDelivered', count(*) filter (where lesson_state = 'PARTIALLY_DELIVERED'), 'notDelivered', count(*) filter (where lesson_state = 'NOT_DELIVERED'), 'changed', count(*) filter (where lesson_state = 'CHANGED'), 'unconfirmed', count(*) filter (where lesson_state = 'UNCONFIRMED'), 'curriculumReviewRequired', (select count(*) from positioned where position_status <> 'CONFIRMED'), 'streamDrift', (select count(*) from drift where alignment in ('ONE_POSITION_APART','TWO_OR_MORE_POSITIONS_APART')), 'assessmentsInReview', (select count(*) from assessment_state where status = 'IN_REVIEW'), 'programmeDisruptions', (select count(*) from programme_disruptions)) from lesson_state),
    'attention', coalesce((select jsonb_agg(jsonb_build_object('id', md5(concat(item_type, ':', coalesce(teaching_section_id::text, ''), ':', coalesce(relevant_date::text, ''))), 'type', item_type, 'category', category, 'teachingSectionId', teaching_section_id, 'subject', subject_name, 'classLevel', class_level_name, 'stream', stream_name, 'relevantDate', relevant_date, 'reason', reason, 'responsibleScope', responsible_scope, 'safeDestination', safe_destination) order by case category when 'ACTION_REQUIRED' then 1 when 'REVIEW' then 2 else 3 end, relevant_date desc nulls last, item_type) from attention), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id', positioned.id, 'departmentId', positioned.department_id, 'department', positioned.department_name, 'subject', positioned.subject_name, 'subjectCode', positioned.subject_code, 'classLevel', positioned.class_level_name, 'stream', positioned.stream_name, 'teacher', positioned.teacher_name, 'period', positioned.period_name, 'currentPosition', case when positioned.position_status = 'CONFIRMED' then positioned.position_label else null end, 'positionStatus', positioned.position_status, 'positionStatusLabel', case positioned.position_status when 'CONFIRMED' then 'Confirmed current position' when 'REVIEW_REQUIRED' then 'Review required' else 'Unavailable' end, 'positionEventId', positioned.position_event_id, 'positionConfirmedAt', positioned.position_confirmed_at, 'lessonStates', (select jsonb_agg(jsonb_build_object('lessonId', lesson.lesson_id, 'date', lesson.scheduled_date, 'state', lesson.lesson_state, 'reason', lesson.reason, 'note', lesson.note) order by lesson.scheduled_date desc, lesson.starts_at desc) from lesson_state lesson where lesson.teaching_section_id = positioned.id and lesson.lesson_state <> 'SCHEDULED' limit 8)) order by positioned.department_name, positioned.subject_name, positioned.class_level_sort_order, positioned.class_level_name, positioned.stream_name)), '[]'::jsonb),
    'drift', coalesce((select jsonb_agg(jsonb_build_object('leftSectionId', left_section_id, 'rightSectionId', right_section_id, 'subject', subject_name, 'classLevel', class_level_name, 'leftStream', left_stream, 'rightStream', right_stream, 'alignment', alignment, 'positionDistance', position_distance) order by subject_name, class_level_name, left_stream, right_stream) from drift where alignment <> 'ALIGNED'), '[]'::jsonb),
    'assessments', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'purpose', purpose, 'status', status, 'subject', subject_name, 'department', department_name, 'totalMarks', total_marks, 'durationMinutes', duration_minutes, 'assessmentDate', assessment_date, 'submittedAt', submitted_at, 'finalisedAt', finalised_at, 'requiresReview', requires_review, 'sectionCount', section_count, 'canReview', status = 'IN_REVIEW' and p_scope <> 'PRINCIPAL') order by case status when 'IN_REVIEW' then 1 else 2 end, submitted_at desc nulls last)), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(jsonb_build_object('id', department_id, 'name', department_name, 'sectionCount', count(*), 'exceptionCount', count(*) filter (where position_status <> 'CONFIRMED' or exists(select 1 from lesson_state lesson where lesson.teaching_section_id = positioned.id and lesson.lesson_state in ('UNCONFIRMED','NOT_DELIVERED','PARTIALLY_DELIVERED','CHANGED')))) order by department_name) from positioned group by department_id, department_name), '[]'::jsonb),
    'programmeDisruptions', coalesce((select jsonb_agg(jsonb_build_object('lessonId', lesson_id, 'teachingSectionId', teaching_section_id, 'programmeEventId', programme_event_id, 'title', title, 'type', event_type, 'startsAt', starts_at, 'endsAt', ends_at) order by starts_at) from programme_disruptions), '[]'::jsonb)
  ) into result;
  if p_scope = 'PRINCIPAL' then
    result := result - 'sections';
  end if;
  return result;
end;
$$;

alter table public.assessment_review_events enable row level security;
revoke all on public.assessment_review_events from anon, authenticated;

revoke all on function private.validate_assessment_ready(uuid, uuid, integer) from public;
revoke all on function private.prevent_assessment_review_mutation() from public;
revoke all on function private.prevent_assessment_review_event_mutation() from public;
revoke all on function private.prevent_assessment_version_insert_while_review() from public;
revoke all on function public.submit_assessment_for_review(uuid, integer) from public, anon, authenticated;
revoke all on function public.review_assessment_workspace(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_assessment_review_workspace(uuid) from public, anon, authenticated;
revoke all on function public.get_leadership_overview(text) from public, anon, authenticated;
grant execute on function public.submit_assessment_for_review(uuid, integer) to authenticated;
grant execute on function public.review_assessment_workspace(uuid, text, text) to authenticated;
grant execute on function public.get_assessment_review_workspace(uuid) to authenticated;
grant execute on function public.get_leadership_overview(text) to authenticated;
