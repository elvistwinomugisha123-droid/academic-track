-- Step 9: production Assessment Studio foundation and hardening.
-- This migration is intentionally unapplied until reviewed. Assessment truth is
-- relational and tenant-scoped; JSON is only the versioned artifact payload.

alter table public.knowledge_assessment_profiles
  add column if not exists allows_broader_scope boolean not null default false,
  add column if not exists allows_partial_scope boolean not null default false,
  add column if not exists requires_review boolean not null default false;

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
  assessment_date date not null,
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
  classroom_evidence_id uuid,
  curriculum_position_event_id uuid,
  section_id uuid,
  override_reason text,
  confirmed_by_membership_id uuid,
  created_at timestamptz not null default now(),
  unique (assessment_workspace_id, canonical_id, section_id),
  foreign key (assessment_workspace_id, school_id) references public.assessment_workspaces(id, school_id) on delete cascade,
  foreign key (section_id, school_id) references public.teaching_sections(id, school_id),
  foreign key (confirmed_by_membership_id, school_id) references public.memberships(id, school_id),
  foreign key (classroom_evidence_id, school_id) references public.classroom_events(id, school_id),
  foreign key (curriculum_position_event_id, school_id) references public.teaching_section_curriculum_position_events(id, school_id)
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
  context_snapshot jsonb not null default '{}'::jsonb,
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

create or replace function private.resolve_assessment_profile_context(
  target_school_id uuid,
  target_period_id uuid,
  target_school_subject_id uuid,
  target_subject_profile_id uuid,
  target_profile_id uuid,
  target_purpose text,
  target_section_ids uuid[]
) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  period_record record;
  profile_record record;
  subject_profile_record record;
  subject_binding_record record;
  assessment_date date;
  section_bindings_ok boolean;
  rights_count integer := 0;
  rights_state text := 'UNKNOWN';
  external_ai_allowed boolean := false;
  formal_artifact_allowed boolean := false;
  export_allowed boolean := false;
  production_use_status text := 'PERMISSION_PENDING';
  has_restricted boolean := false;
  all_cleared boolean := false;
begin
  select period.* into period_record from academic_periods period where period.id = target_period_id and period.school_id = target_school_id;
  if not found then return jsonb_build_object('applicable', false, 'reason', 'The academic period is not part of the authenticated school.'); end if;
  assessment_date := period_record.starts_on;

  select ap.id, ap.display_title, ap.purpose, ap.regime, ap.release_id, ap.subject_profile_id,
         ap.status, ap.allows_broader_scope, ap.allows_partial_scope, ap.requires_review,
         ap.applicable_source_roles,
         release.version_label, release.authority, release.status as release_status,
         release.effective_from, release.effective_to
    into profile_record
    from knowledge_assessment_profiles ap
    join knowledge_curriculum_releases release on release.id = ap.release_id
   where ap.id = target_profile_id
     and ap.purpose = target_purpose
     and (ap.subject_profile_id is null or ap.subject_profile_id = target_subject_profile_id);
  if not found then return jsonb_build_object('applicable', false, 'reason', 'The assessment profile is not applicable to the requested purpose or subject profile.'); end if;

  select subject_profile.* into subject_profile_record from knowledge_subject_profiles subject_profile where subject_profile.id = target_subject_profile_id;
  if not found then return jsonb_build_object('applicable', false, 'reason', 'The governed subject profile could not be resolved.'); end if;

  select binding.* into subject_binding_record
    from school_subject_curriculum_bindings binding
   where binding.school_id = target_school_id and binding.school_subject_id = target_school_subject_id and binding.subject_profile_id = target_subject_profile_id and binding.status = 'ACTIVE'
     and binding.effective_from <= assessment_date and (binding.effective_to is null or binding.effective_to >= assessment_date)
   order by binding.effective_from desc limit 1;

  select not exists (
    select 1 from unnest(coalesce(target_section_ids, array[]::uuid[])) requested(section_id)
    where not exists (
      select 1 from teaching_section_curriculum_bindings binding
      where binding.school_id = target_school_id and binding.teaching_section_id = requested.section_id and binding.subject_profile_id = target_subject_profile_id and binding.status = 'ACTIVE'
        and binding.effective_from <= assessment_date and (binding.effective_to is null or binding.effective_to >= assessment_date)
    )
  ) into section_bindings_ok;

  select count(*)::integer,
         coalesce(bool_and(source_rights.rights_status = 'CLEARED' and source_rights.production_use_status = 'PERMITTED'), false),
         coalesce(bool_or(source_rights.rights_status = 'RESTRICTED' or source_rights.production_use_status = 'BLOCKED'), false),
         coalesce(bool_and(source_rights.external_ai_allowed), false),
         coalesce(bool_and(source_rights.formal_artifact_allowed), false),
         coalesce(bool_and(source_rights.export_allowed), false)
    into rights_count, all_cleared, has_restricted, external_ai_allowed, formal_artifact_allowed, export_allowed
    from (
      select
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then 'REVIEW_REQUIRED' else coalesce(decision.rights_status, source.rights_status) end as rights_status,
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then 'PERMISSION_PENDING' else coalesce(decision.production_use_status, source.production_use_status) end as production_use_status,
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then false else coalesce(decision.external_ai_allowed, source.external_ai_allowed) end as external_ai_allowed,
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then false else coalesce(decision.formal_artifact_allowed, source.formal_artifact_allowed) end as formal_artifact_allowed,
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then false else coalesce(decision.export_allowed, source.export_allowed) end as export_allowed
      from knowledge_release_sources release_source
      join knowledge_sources source on source.source_id = release_source.source_id
      left join lateral (
        select rights_decision.* from knowledge_rights_decisions rights_decision
        where rights_decision.source_id = source.source_id and rights_decision.source_checksum_sha256 = source.checksum_sha256
        order by rights_decision.decided_at desc, rights_decision.decision_id desc limit 1
      ) decision on true
      where release_source.release_id = profile_record.release_id and release_source.status = 'APPROVED' and release_source.source_role = any(profile_record.applicable_source_roles)
        and (release_source.subject_profile_id is null or release_source.subject_profile_id = target_subject_profile_id)
    ) source_rights;
  if rights_count = 0 then rights_state := 'UNKNOWN'; production_use_status := 'PERMISSION_PENDING';
  elsif has_restricted then rights_state := 'RESTRICTED'; production_use_status := 'BLOCKED';
  elsif all_cleared then rights_state := 'CLEARED'; production_use_status := 'PERMITTED';
  else rights_state := 'REVIEW_REQUIRED'; production_use_status := 'PERMISSION_PENDING'; end if;

  if profile_record.status <> 'ACTIVE' then return jsonb_build_object('applicable', false, 'reason', 'The assessment profile is not ACTIVE.'); end if;
  if profile_record.release_status <> 'ACTIVE' or profile_record.effective_from > assessment_date or (profile_record.effective_to is not null and profile_record.effective_to < assessment_date) then return jsonb_build_object('applicable', false, 'reason', 'The curriculum release is not ACTIVE and date-applicable for this academic period.'); end if;
  if subject_profile_record.status <> 'ACTIVE' or subject_profile_record.runtime_status <> 'PILOT_ACTIVE' then return jsonb_build_object('applicable', false, 'reason', 'The governed subject profile is not active for this controlled runtime environment.'); end if;
  if subject_binding_record.id is null or not section_bindings_ok then return jsonb_build_object('applicable', false, 'reason', 'The school-subject or Teaching Section curriculum binding is not active and date-applicable.'); end if;

  return jsonb_build_object('applicable', true, 'assessmentDate', assessment_date, 'profileId', profile_record.id, 'profileTitle', profile_record.display_title, 'purpose', profile_record.purpose, 'regime', profile_record.regime, 'releaseId', profile_record.release_id, 'releaseVersion', profile_record.version_label, 'releaseAuthority', profile_record.authority, 'releaseStatus', profile_record.release_status, 'releaseEffectiveFrom', profile_record.effective_from, 'releaseEffectiveTo', profile_record.effective_to, 'subjectProfileId', target_subject_profile_id, 'subjectProfileStatus', subject_profile_record.status, 'subjectProfileRuntimeStatus', subject_profile_record.runtime_status, 'rightsState', rights_state, 'productionUseStatus', production_use_status, 'externalAiAllowed', external_ai_allowed and all_cleared, 'formalArtifactAllowed', formal_artifact_allowed and all_cleared, 'exportAllowed', export_allowed and all_cleared, 'allowsBroaderScope', profile_record.allows_broader_scope, 'allowsPartialScope', profile_record.allows_partial_scope, 'requiresReview', profile_record.requires_review, 'sourceCount', rights_count);
end;
$$;

create or replace function private.assessment_canonical_is_governed(target_subject_profile_id uuid, target_canonical_id text, target_on date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.knowledge_profile_records profile_record join public.knowledge_subject_profiles subject_profile on subject_profile.id = profile_record.subject_profile_id join public.knowledge_records record on record.canonical_id = profile_record.canonical_id where profile_record.subject_profile_id = target_subject_profile_id and profile_record.canonical_id = target_canonical_id and profile_record.status = 'APPROVED' and profile_record.runtime_status = 'PILOT_ACTIVE' and (profile_record.effective_from is null or profile_record.effective_from <= target_on) and (profile_record.effective_to is null or profile_record.effective_to >= target_on) and subject_profile.status = 'ACTIVE' and subject_profile.runtime_status = 'PILOT_ACTIVE' and record.verification_status = 'VERIFIED')
$$;

create or replace function private.assessment_scope_is_eligible(target_workspace_id uuid, target_canonical_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when workspace.purpose = 'COMMON_STREAM_TEST' then (select count(distinct item.section_id) from public.assessment_scope_items item where item.assessment_workspace_id = workspace.id and item.canonical_id = target_canonical_id and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED')) = (select count(*) from public.assessment_workspace_sections section where section.assessment_workspace_id = workspace.id) else exists (select 1 from public.assessment_scope_items item where item.assessment_workspace_id = workspace.id and item.canonical_id = target_canonical_id and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED')) end from public.assessment_workspaces workspace where workspace.id = target_workspace_id
$$;

create or replace function private.validate_assessment_payload_shape(target_payload jsonb, target_purpose text, target_total_marks integer, target_duration_minutes integer)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(jsonb_typeof(target_payload) <> 'object', true) then raise exception 'assessment content must be a JSON object'; end if;
  if coalesce(jsonb_typeof(target_payload->'blueprint') <> 'object', true) then raise exception 'assessment blueprint must be a JSON object'; end if;
  if coalesce(jsonb_typeof(target_payload->'questions') <> 'array', true) then raise exception 'assessment questions must be a JSON array'; end if;
  if coalesce(jsonb_typeof(target_payload->'blueprint'->'participatingSectionIds') <> 'array', true) then raise exception 'participatingSectionIds must be an array'; end if;
  if coalesce(jsonb_typeof(target_payload->'title') <> 'string', true) or char_length(trim(target_payload->>'title')) = 0 then raise exception 'assessment title must be a non-empty string'; end if;
  if target_payload->>'purpose' is distinct from target_purpose then raise exception 'assessment purpose must match the workspace'; end if;
  if coalesce(jsonb_typeof(target_payload->'totalMarks') <> 'number', true) or (target_payload->>'totalMarks')::integer <> target_total_marks then raise exception 'assessment total marks must match the workspace'; end if;
  if coalesce(jsonb_typeof(target_payload->'durationMinutes') <> 'number', true) or (target_payload->>'durationMinutes')::integer <> target_duration_minutes then raise exception 'assessment duration must match the workspace'; end if;
end;
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
returns trigger language plpgsql set search_path = public, pg_temp as $$ begin raise exception 'assessment versions are immutable; create a new assessment version'; end; $$;
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

create or replace function public.create_assessment_workspace(p_academic_period_id uuid, p_school_subject_id uuid, p_curriculum_subject_profile_id uuid, p_assessment_profile_id uuid, p_purpose text, p_title text, p_duration_minutes integer, p_total_marks integer, p_section_ids uuid[], p_scope_items jsonb, p_content_json jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor record; workspace_id uuid; version_id uuid; item jsonb; section_id uuid; canonical_id text; scope_state text; evidence_type text; section_value uuid; evidence_value uuid; profile_context jsonb; assessment_date date;
begin
  select m.id, m.school_id, m.user_id into actor from memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  if not found then raise exception 'active school membership is required'; end if;
  if p_title is null or char_length(trim(p_title)) = 0 or p_duration_minutes <= 0 or p_total_marks <= 0 then raise exception 'assessment identity, duration, and marks are required'; end if;
  if not private.assessment_sections_are_owned(actor.school_id, actor.id, p_section_ids) then raise exception 'every participating Teaching Section must be assigned to the authenticated teacher'; end if;
  select period.starts_on into assessment_date from academic_periods period where period.id = p_academic_period_id and period.school_id = actor.school_id;
  if assessment_date is null then raise exception 'academic period does not belong to the authenticated school'; end if;
  profile_context := private.resolve_assessment_profile_context(actor.school_id, p_academic_period_id, p_school_subject_id, p_curriculum_subject_profile_id, p_assessment_profile_id, p_purpose, p_section_ids);
  if coalesce((profile_context->>'applicable')::boolean, false) is not true then raise exception '%', coalesce(profile_context->>'reason', 'assessment profile is not applicable'); end if;
  perform private.validate_assessment_payload_shape(p_content_json, p_purpose, p_total_marks, p_duration_minutes);
  if p_scope_items is null or jsonb_typeof(p_scope_items) <> 'array' then raise exception 'assessment scope items must be a JSON array'; end if;
  insert into assessment_workspaces(school_id, academic_period_id, school_subject_id, curriculum_subject_profile_id, assessment_profile_id, purpose, title, duration_minutes, total_marks, assessment_date, profile_snapshot, created_by_membership_id) values(actor.school_id, p_academic_period_id, p_school_subject_id, p_curriculum_subject_profile_id, p_assessment_profile_id, p_purpose, trim(p_title), p_duration_minutes, p_total_marks, assessment_date, profile_context, actor.id) returning id into workspace_id;
  foreach section_id in array p_section_ids loop insert into assessment_workspace_sections(assessment_workspace_id, school_id, teaching_section_id) values(workspace_id, actor.school_id, section_id); end loop;
  for item in select value from jsonb_array_elements(p_scope_items) value loop
    canonical_id := nullif(trim(item->>'canonicalId'), ''); scope_state := coalesce(item->>'scopeState', 'CONFIRMED_ELIGIBLE'); evidence_type := coalesce(item->>'evidenceType', 'CONFIRMED_DELIVERY'); section_value := nullif(item->>'sectionId', '')::uuid; evidence_value := nullif(item->>'evidenceReferenceId', '')::uuid;
    if canonical_id is null or not private.assessment_canonical_is_governed(p_curriculum_subject_profile_id, canonical_id, assessment_date) then raise exception 'scope item is not an approved, runtime-eligible record in the bound subject profile'; end if;
    if scope_state not in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED') then raise exception 'scope items may only establish governed eligible scope during workspace creation'; end if;
    if scope_state = 'BROADER_PROFILE_PERMITTED' and coalesce((profile_context->>'allowsBroaderScope')::boolean, false) is not true then raise exception 'the resolved assessment profile does not permit broader scope'; end if;
    if section_value is null or not (section_value = any(p_section_ids)) then raise exception 'scope evidence must belong to a participating Teaching Section'; end if;
    if evidence_type <> 'CONFIRMED_DELIVERY' then raise exception 'partial scope must be confirmed through the controlled partial-scope RPC'; end if;
    if evidence_value is null or not exists (select 1 from teaching_section_curriculum_position_events position where position.id = evidence_value and position.school_id = actor.school_id and position.teaching_section_id = section_value and position.subject_profile_id = p_curriculum_subject_profile_id and position.canonical_id = canonical_id and position.confirmed_at::date <= assessment_date and not exists (select 1 from teaching_section_curriculum_position_events successor where successor.supersedes_event_id = position.id) and not exists (select 1 from classroom_events classroom_event where classroom_event.school_id = actor.school_id and classroom_event.teaching_section_id = section_value and classroom_event.outcome = 'PARTIALLY_DELIVERED' and not exists (select 1 from classroom_events successor where successor.supersedes_event_id = classroom_event.id))) then raise exception 'confirmed scope evidence does not match the current governed position and classroom state'; end if;
    insert into assessment_scope_items(assessment_workspace_id, school_id, canonical_id, scope_state, evidence_type, evidence_reference_id, curriculum_position_event_id, section_id, override_reason, confirmed_by_membership_id) values(workspace_id, actor.school_id, canonical_id, scope_state, evidence_type, evidence_value::text, evidence_value, section_value, item->>'overrideReason', actor.id);
  end loop;
  if not exists(select 1 from assessment_scope_items item where item.assessment_workspace_id = workspace_id and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED')) and not (coalesce((profile_context->>'allowsPartialScope')::boolean, false) and exists(select 1 from classroom_events classroom_event where classroom_event.school_id = actor.school_id and classroom_event.teaching_section_id = any(p_section_ids) and classroom_event.outcome = 'PARTIALLY_DELIVERED' and not exists(select 1 from classroom_events successor where successor.supersedes_event_id = classroom_event.id))) then raise exception 'no governed eligible assessment scope was supplied'; end if;
  insert into assessment_versions(school_id, assessment_workspace_id, version_number, content_json, change_source, change_summary, created_by_membership_id) values(actor.school_id, workspace_id, 1, p_content_json, 'TEACHER', 'Initial teacher-authored assessment draft', actor.id) returning id into version_id;
  update assessment_workspaces set current_version_id = version_id, updated_at = now() where id = workspace_id;
  insert into audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state) values(actor.school_id, actor.user_id, 'CREATE', 'ASSESSMENT_WORKSPACE', workspace_id, jsonb_build_object('purpose', p_purpose, 'profile_id', p_assessment_profile_id, 'section_ids', p_section_ids), jsonb_build_object('version_id', version_id));
  return jsonb_build_object('workspaceId', workspace_id, 'versionId', version_id, 'versionNumber', 1);
end;
$$;

-- Teacher-facing saves deliberately have no source parameter. The database owns authorship.
create or replace function public.create_assessment_version(p_workspace_id uuid, p_content_json jsonb, p_expected_version integer default null, p_change_summary text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare workspace record; actor record; next_version integer; version_id uuid; question jsonb; question_marks integer; question_canonical text; blueprint_canonical text; participant text;
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
  insert into assessment_versions(school_id, assessment_workspace_id, version_number, content_json, change_source, change_summary, created_by_membership_id) values(actor.school_id, p_workspace_id, next_version, p_content_json, 'TEACHER', p_change_summary, actor.id) returning id into version_id;
  update assessment_workspaces set current_version_id = version_id, updated_at = now() where id = p_workspace_id;
  insert into audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata) values(actor.school_id, actor.user_id, 'CREATE_VERSION', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('version_id', version_id, 'version_number', next_version, 'change_source', 'TEACHER'));
  return jsonb_build_object('workspaceId', p_workspace_id, 'versionId', version_id, 'versionNumber', next_version);
end;
$$;

create or replace function public.confirm_assessment_partial_scope(p_workspace_id uuid, p_section_id uuid, p_canonical_id text, p_evidence_reference_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare actor record; workspace record; profile_context jsonb; position_event record; classroom_event record; current_version record; item_id uuid; version_id uuid; next_version integer; updated_content jsonb; current_scope_eligible boolean;
begin
  select m.id, m.school_id, m.user_id into actor from memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select workspace.* into workspace from assessment_workspaces workspace where workspace.id = p_workspace_id and workspace.school_id = actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id, p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status = 'FINAL' then raise exception 'finalised assessment workspaces cannot be changed'; end if;
  if not exists(select 1 from assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id and section.teaching_section_id = p_section_id) then raise exception 'partial scope section is outside the assessment'; end if;
  profile_context := private.resolve_assessment_profile_context(actor.school_id, workspace.academic_period_id, workspace.school_subject_id, workspace.curriculum_subject_profile_id, workspace.assessment_profile_id, workspace.purpose, array[p_section_id]);
  if coalesce((profile_context->>'applicable')::boolean, false) is not true or coalesce((profile_context->>'allowsPartialScope')::boolean, false) is not true then raise exception 'the resolved assessment profile does not permit partial-scope confirmation'; end if;
  if not private.assessment_canonical_is_governed(workspace.curriculum_subject_profile_id, p_canonical_id, workspace.assessment_date) then raise exception 'partial scope must reference an approved, runtime-eligible record in the bound subject profile'; end if;
  select position.* into position_event from teaching_section_curriculum_position_events position where position.school_id = actor.school_id and position.teaching_section_id = p_section_id and position.subject_profile_id = workspace.curriculum_subject_profile_id and position.canonical_id = p_canonical_id and position.confirmed_at::date <= workspace.assessment_date and not exists(select 1 from teaching_section_curriculum_position_events successor where successor.supersedes_event_id = position.id) order by position.confirmed_at desc, position.id desc limit 1;
  if not found then raise exception 'partial scope must be tied to the current governed curricular position'; end if;
  select classroom.* into classroom_event from classroom_events classroom where classroom.id = p_evidence_reference_id and classroom.school_id = actor.school_id and classroom.teaching_section_id = p_section_id and classroom.outcome = 'PARTIALLY_DELIVERED' and not exists(select 1 from classroom_events successor where successor.supersedes_event_id = classroom.id);
  if not found then raise exception 'partial scope must reference the current PARTIALLY_DELIVERED classroom evidence'; end if;
  insert into assessment_scope_items(assessment_workspace_id, school_id, canonical_id, scope_state, evidence_type, evidence_reference_id, classroom_evidence_id, curriculum_position_event_id, section_id, override_reason, confirmed_by_membership_id) values(p_workspace_id, actor.school_id, p_canonical_id, 'CONFIRMED_ELIGIBLE', 'EXPLICIT_PARTIAL_SCOPE_CONFIRMATION', classroom_event.id::text, classroom_event.id, position_event.id, p_section_id, nullif(trim(p_reason), ''), actor.id)
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
  insert into audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata) values(actor.school_id, actor.user_id, 'CONFIRM_PARTIAL_ASSESSMENT_SCOPE', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('scope_item_id', item_id, 'section_id', p_section_id, 'canonical_id', p_canonical_id, 'classroom_evidence_id', classroom_event.id, 'curriculum_position_event_id', position_event.id));
  return jsonb_build_object('workspaceId', p_workspace_id, 'scopeItemId', item_id, 'canonicalId', p_canonical_id, 'sectionId', p_section_id);
end;
$$;

create or replace function public.finalize_assessment_workspace(p_workspace_id uuid, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare workspace record; actor record; version record; question_marks integer; question jsonb; canonical_id text; v_finalised_at timestamptz := now(); profile_context jsonb; section_ids uuid[];
begin
  select m.id, m.school_id, m.user_id into actor from memberships m where m.user_id = auth.uid() and m.status = 'ACTIVE' limit 1;
  select w.* into workspace from assessment_workspaces w where w.id = p_workspace_id and w.school_id = actor.school_id for update;
  if not found or not private.assessment_can_manage(actor.school_id, p_workspace_id) then raise exception 'assessment is not available to this teacher'; end if;
  if workspace.status = 'FINAL' then raise exception 'assessment is already finalised'; end if;
  select array_agg(section.teaching_section_id order by section.teaching_section_id) into section_ids from assessment_workspace_sections section where section.assessment_workspace_id = p_workspace_id;
  profile_context := private.resolve_assessment_profile_context(actor.school_id, workspace.academic_period_id, workspace.school_subject_id, workspace.curriculum_subject_profile_id, workspace.assessment_profile_id, workspace.purpose, section_ids);
  if coalesce((profile_context->>'applicable')::boolean, false) is not true then raise exception 'the assessment profile is no longer applicable; reopen and resolve the current profile'; end if;
  select * into version from assessment_versions where id = workspace.current_version_id and school_id = actor.school_id;
  if not found or (p_expected_version is not null and version.version_number <> p_expected_version) then raise exception 'assessment version is stale; reopen before finalising'; end if;
  perform private.validate_assessment_payload_shape(version.content_json, workspace.purpose, workspace.total_marks, workspace.duration_minutes);
  if jsonb_array_length(version.content_json->'questions') = 0 then raise exception 'add at least one question before finalising'; end if;
  select coalesce(sum((question->>'marks')::integer), 0) into question_marks from jsonb_array_elements(version.content_json->'questions') question;
  if question_marks <> workspace.total_marks then raise exception 'question marks must equal the configured total before finalising'; end if;
  for question in select value from jsonb_array_elements(version.content_json->'questions') value loop
    if coalesce((question->>'marks')::integer, 0) <= 0 or jsonb_array_length(coalesce(question->'canonicalIds', '[]'::jsonb)) = 0 then raise exception 'every final assessment question needs positive marks and eligible curriculum scope'; end if;
    for canonical_id in select value from jsonb_array_elements_text(coalesce(question->'canonicalIds', '[]'::jsonb)) value loop
      if not private.assessment_scope_is_eligible(p_workspace_id, canonical_id) then raise exception 'final assessment contains curriculum content outside the recorded eligible scope'; end if;
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
declare actor record; workspace record; run_record record; version record; next_version integer; version_id uuid; question jsonb; question_marks integer; canonical_id text; profile_context jsonb; section_ids uuid[]; current_scope jsonb;
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
  profile_context := private.resolve_assessment_profile_context(actor.school_id, workspace.academic_period_id, workspace.school_subject_id, workspace.curriculum_subject_profile_id, workspace.assessment_profile_id, workspace.purpose, section_ids);
  if coalesce((profile_context->>'applicable')::boolean, false) is not true or coalesce((profile_context->>'externalAiAllowed')::boolean, false) is not true then raise exception 'the current assessment profile is no longer eligible for AI acceptance'; end if;
  current_scope := to_jsonb(array(select distinct item.canonical_id from assessment_scope_items item where item.assessment_workspace_id = p_workspace_id and item.scope_state in ('CONFIRMED_ELIGIBLE','BROADER_PROFILE_PERMITTED') order by item.canonical_id));
  if run_record.context_snapshot->>'profileId' is distinct from workspace.assessment_profile_id::text or run_record.context_snapshot->>'purpose' is distinct from workspace.purpose or coalesce((run_record.context_snapshot->>'expectedVersion')::integer, -1) <> next_version - 1 or run_record.context_snapshot->'blueprint' is distinct from version.content_json->'blueprint' or run_record.context_snapshot->'eligibleCanonicalIds' is distinct from current_scope then raise exception 'AI proposal context is stale; generate a new proposal'; end if;
  perform private.validate_assessment_payload_shape(run_record.output_json, workspace.purpose, workspace.total_marks, workspace.duration_minutes);
  select coalesce(sum((question->>'marks')::integer), 0) into question_marks from jsonb_array_elements(run_record.output_json->'questions') question;
  if question_marks <> workspace.total_marks then raise exception 'AI proposal marks do not match the approved blueprint'; end if;
  for question in select value from jsonb_array_elements(run_record.output_json->'questions') value loop
    if coalesce((question->>'marks')::integer, 0) <= 0 then raise exception 'AI proposal contains a question without positive marks'; end if;
    for canonical_id in select value from jsonb_array_elements_text(coalesce(question->'canonicalIds', '[]'::jsonb)) value loop
      if not private.assessment_scope_is_eligible(p_workspace_id, canonical_id) then raise exception 'AI proposal contains curriculum content outside the recorded eligible scope'; end if;
    end loop;
  end loop;
  insert into assessment_versions(school_id, assessment_workspace_id, version_number, content_json, change_source, change_summary, created_by_membership_id) values(actor.school_id, p_workspace_id, next_version, run_record.output_json, 'AI', 'Teacher accepted the ATE assessment proposal', actor.id) returning id into version_id;
  update assessment_workspaces set current_version_id = version_id, updated_at = now() where id = p_workspace_id;
  update assessment_ai_generation_runs set status = 'ACCEPTED' where id = p_generation_run_id;
  insert into audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata) values(actor.school_id, actor.user_id, 'ACCEPT_AI_VERSION', 'ASSESSMENT_WORKSPACE', p_workspace_id, jsonb_build_object('version_id', version_id, 'generation_run_id', p_generation_run_id, 'version_number', next_version));
  return jsonb_build_object('workspaceId', p_workspace_id, 'versionId', version_id, 'versionNumber', next_version);
end;
$$;

revoke all on function private.assessment_can_manage(uuid, uuid) from public;
revoke all on function private.assessment_sections_are_owned(uuid, uuid, uuid[]) from public;
revoke all on function private.resolve_assessment_profile_context(uuid, uuid, uuid, uuid, uuid, text, uuid[]) from public;
revoke all on function private.assessment_canonical_is_governed(uuid, text, date) from public;
revoke all on function private.assessment_scope_is_eligible(uuid, text) from public;
revoke all on function private.validate_assessment_payload_shape(jsonb, text, integer, integer) from public;
revoke all on function public.create_assessment_workspace(uuid, uuid, uuid, uuid, text, text, integer, integer, uuid[], jsonb, jsonb) from public;
revoke all on function public.create_assessment_version(uuid, jsonb, integer, text) from public;
revoke all on function public.confirm_assessment_partial_scope(uuid, uuid, text, uuid, text) from public;
revoke all on function public.finalize_assessment_workspace(uuid, integer) from public;
revoke all on function public.accept_assessment_ai_version(uuid, uuid, integer, text) from public;
grant execute on function private.assessment_can_manage(uuid, uuid) to authenticated;
grant execute on function private.assessment_sections_are_owned(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.create_assessment_workspace(uuid, uuid, uuid, uuid, text, text, integer, integer, uuid[], jsonb, jsonb) to authenticated;
grant execute on function public.create_assessment_version(uuid, jsonb, integer, text) to authenticated;
grant execute on function public.confirm_assessment_partial_scope(uuid, uuid, text, uuid, text) to authenticated;
grant execute on function public.finalize_assessment_workspace(uuid, integer) to authenticated;
grant execute on function public.accept_assessment_ai_version(uuid, uuid, integer, text) to authenticated;
