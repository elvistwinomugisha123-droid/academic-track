-- Step 10 forward migration.
-- 0027/0028 are already applied and are intentionally not edited.
-- This migration corrects stream drift using the full governed profile order,
-- revalidates an assessment immediately before approval, and adds only the
-- Step 10 foreign-key indexes.

create index if not exists assessment_review_events_workspace_fk_idx
  on public.assessment_review_events (assessment_workspace_id, school_id);

create index if not exists assessment_review_events_version_fk_idx
  on public.assessment_review_events (assessment_version_id, school_id);

create index if not exists assessment_review_events_actor_fk_idx
  on public.assessment_review_events (actor_membership_id, school_id);

create index if not exists assessment_workspaces_submitted_version_fk_idx
  on public.assessment_workspaces (submitted_version_id, school_id);

create index if not exists assessment_workspaces_submitted_membership_fk_idx
  on public.assessment_workspaces (submitted_by_membership_id, school_id);

alter function public.get_leadership_overview(text)
  rename to get_leadership_overview_pre_0029;

revoke all on function public.get_leadership_overview_pre_0029(text) from public, anon, authenticated;

create or replace function private.get_step10_stream_drift(p_scope text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  actor record;
  result jsonb;
begin
  select m.id, m.school_id into actor
    from public.memberships m
   where m.user_id = auth.uid() and m.status = 'ACTIVE'
   limit 1;
  if not found or p_scope not in ('HOD', 'DOS', 'PRINCIPAL') then
    raise exception 'a valid leadership scope is required';
  end if;
  if p_scope = 'HOD' and not exists (
    select 1 from public.role_grants grant_row
     where grant_row.membership_id = actor.id
       and grant_row.school_id = actor.school_id
       and grant_row.role = 'HOD'
       and grant_row.scope_type = 'DEPARTMENT'
       and grant_row.status = 'ACTIVE'
  ) then
    raise exception 'an active HOD grant is required';
  end if;
  if p_scope in ('DOS', 'PRINCIPAL') and not private.has_school_role(actor.school_id, p_scope) then
    raise exception 'the active leadership role is not authorised for this overview';
  end if;

  with scope_sections as (
    select section.id, section.academic_period_id, section.school_subject_id, section.class_level_id,
           period.starts_on, period.ends_on, subject.department_id,
           subject.name as subject_name, level.name as class_level_name,
           stream.name as stream_name,
           greatest(period.starts_on, least(current_date, period.ends_on)) as effective_on
      from public.teaching_sections section
      join public.academic_periods period
        on period.id = section.academic_period_id
       and period.school_id = section.school_id
      join public.school_subjects subject
        on subject.id = section.school_subject_id
       and subject.school_id = section.school_id
      join public.class_levels level
        on level.id = section.class_level_id
       and level.school_id = section.school_id
      join public.streams stream
        on stream.id = section.stream_id
       and stream.school_id = section.school_id
     where section.school_id = actor.school_id
       and section.assignment_state = 'CONFIRMED'
       and section.operational_status = 'ACTIVE'
       and (p_scope in ('DOS', 'PRINCIPAL') or private.has_department_role(section.school_id, subject.department_id, 'HOD'))
  ), section_context as (
    select scoped.*,
           binding.subject_profile_id,
           position_event.canonical_id,
           position_record.id as governed_record_id,
           position_order.full_profile_ordinal,
           coalesce(position_order.ordering_complete, false) as ordering_complete
      from scope_sections scoped
      left join lateral (
        select section_binding.subject_profile_id
          from public.teaching_section_curriculum_bindings section_binding
         where section_binding.school_id = actor.school_id
           and section_binding.teaching_section_id = scoped.id
           and section_binding.status = 'ACTIVE'
           and section_binding.effective_from <= scoped.effective_on
           and (section_binding.effective_to is null or section_binding.effective_to >= scoped.effective_on)
         order by section_binding.effective_from desc, section_binding.id desc
         limit 1
      ) binding on true
      left join lateral (
        select event.*
          from public.teaching_section_curriculum_position_events event
         where event.school_id = actor.school_id
           and event.teaching_section_id = scoped.id
           and event.confirmed_at::date <= scoped.effective_on
           and not exists (
             select 1
               from public.teaching_section_curriculum_position_events successor
              where successor.school_id = event.school_id
                and successor.supersedes_event_id = event.id
                and successor.confirmed_at::date <= scoped.effective_on
           )
         order by event.confirmed_at desc, event.id desc
         limit 1
      ) position_event on true
      left join public.knowledge_profile_records position_record
        on position_record.subject_profile_id = binding.subject_profile_id
       and position_record.canonical_id = position_event.canonical_id
       and position_record.membership_role = 'CURRICULUM'
       and position_record.status = 'APPROVED'
       and position_record.runtime_status = 'PILOT_ACTIVE'
       and (position_record.effective_from is null or position_record.effective_from <= scoped.effective_on)
       and (position_record.effective_to is null or position_record.effective_to >= scoped.effective_on)
      left join lateral (
        select max(case when ordered.canonical_id = position_event.canonical_id then ordered.full_profile_ordinal end) as full_profile_ordinal,
               bool_and(ordered.ordering_key is not null)
                 and count(distinct ordered.ordering_key) = count(*) as ordering_complete
          from (
            select full_record.canonical_id,
                   full_record.ordering_key,
                   row_number() over (order by full_record.ordering_key, full_record.canonical_id) as full_profile_ordinal
              from public.knowledge_profile_records full_record
             where full_record.subject_profile_id = binding.subject_profile_id
               and full_record.membership_role = 'CURRICULUM'
               and full_record.status = 'APPROVED'
               and full_record.runtime_status = 'PILOT_ACTIVE'
               and (full_record.effective_from is null or full_record.effective_from <= scoped.effective_on)
               and (full_record.effective_to is null or full_record.effective_to >= scoped.effective_on)
          ) ordered
      ) position_order on true
  ), positioned as (
    select context.*,
           case
             when context.subject_profile_id is null then 'UNAVAILABLE'
             when context.canonical_id is null then 'UNAVAILABLE'
             when context.governed_record_id is null then 'REVIEW_REQUIRED'
             else 'CONFIRMED'
           end as position_status,
           case
             when context.governed_record_id is not null and context.ordering_complete
               then context.full_profile_ordinal
           end as position_order
      from section_context context
  ), drift as (
    select left_section.id as left_section_id,
           right_section.id as right_section_id,
           left_section.subject_name,
           left_section.class_level_name,
           left_section.stream_name as left_stream,
           right_section.stream_name as right_stream,
           case
             when left_section.canonical_id = right_section.canonical_id then 'ALIGNED'
             when left_section.position_order is null or right_section.position_order is null then 'UNKNOWN'
             when abs(left_section.position_order - right_section.position_order) = 1 then 'ONE_POSITION_APART'
             else 'TWO_OR_MORE_POSITIONS_APART'
           end as alignment,
           case
             when left_section.position_order is null or right_section.position_order is null then null
             else abs(left_section.position_order - right_section.position_order)
           end as position_distance
      from positioned left_section
      join positioned right_section
        on right_section.academic_period_id = left_section.academic_period_id
       and right_section.school_subject_id = left_section.school_subject_id
       and right_section.class_level_id = left_section.class_level_id
       and right_section.id > left_section.id
       and left_section.subject_profile_id is not null
       and left_section.subject_profile_id = right_section.subject_profile_id
       and left_section.position_status = 'CONFIRMED'
       and right_section.position_status = 'CONFIRMED'
  )
  select jsonb_build_object(
    'drift', coalesce((
      select jsonb_agg(jsonb_build_object(
        'leftSectionId', left_section_id,
        'rightSectionId', right_section_id,
        'subject', subject_name,
        'classLevel', class_level_name,
        'leftStream', left_stream,
        'rightStream', right_stream,
        'alignment', alignment,
        'positionDistance', position_distance
      ) order by subject_name, class_level_name, left_stream, right_stream)
        from drift
       where alignment <> 'ALIGNED'
    ), '[]'::jsonb),
    'attention', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', md5(concat('STREAM_DRIFT:', left_section_id, ':', right_section_id)),
        'type', 'STREAM_DRIFT',
        'category', 'REVIEW',
        'teachingSectionId', left_section_id,
        'subject', subject_name,
        'classLevel', class_level_name,
        'stream', left_stream,
        'relevantDate', current_date,
        'reason', case alignment when 'UNKNOWN' then 'Parallel streams cannot be aligned because governed curriculum ordering is unavailable or unreliable.' when 'ONE_POSITION_APART' then 'Parallel stream is 1 position apart based on the full governed curriculum ordering.' else 'Parallel stream is 2+ positions apart based on the full governed curriculum ordering.' end,
        'responsibleScope', 'DEPARTMENT',
        'safeDestination', concat('#section-', left_section_id)
      ) order by subject_name, class_level_name, left_stream, right_stream)
        from drift
       where alignment <> 'ALIGNED'
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_leadership_overview(p_scope text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  legacy_result jsonb;
  corrected_result jsonb;
  retained_attention jsonb;
begin
  legacy_result := public.get_leadership_overview_pre_0029(p_scope);
  corrected_result := private.get_step10_stream_drift(p_scope);
  select coalesce(jsonb_agg(item), '[]'::jsonb)
    into retained_attention
    from jsonb_array_elements(coalesce(legacy_result->'attention', '[]'::jsonb)) item
   where item->>'type' <> 'STREAM_DRIFT';
  legacy_result := jsonb_set(legacy_result, '{drift}', corrected_result->'drift', true);
  legacy_result := jsonb_set(legacy_result, '{summary,streamDrift}', to_jsonb(jsonb_array_length(corrected_result->'drift')), true);
  legacy_result := jsonb_set(legacy_result, '{attention}', retained_attention || coalesce(corrected_result->'attention', '[]'::jsonb), true);
  return legacy_result;
end;
$$;

revoke all on function private.get_step10_stream_drift(text) from public;
revoke all on function public.get_leadership_overview(text) from public, anon, authenticated;
grant execute on function public.get_leadership_overview(text) to authenticated;

create or replace function public.review_assessment_workspace(p_workspace_id uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  workspace record;
  actor record;
  subject_department_id uuid;
  submitted_version uuid;
  section_ids uuid[];
  profile_context jsonb;
  reviewed_at timestamptz := now();
  clean_reason text := nullif(trim(p_reason), '');
begin
  select m.id, m.school_id, m.user_id into actor
    from public.memberships m
   where m.user_id = auth.uid() and m.status = 'ACTIVE'
   limit 1;
  select w.* into workspace
    from public.assessment_workspaces w
   where w.id = p_workspace_id and w.school_id = actor.school_id
   for update;
  if not found or workspace.status <> 'IN_REVIEW' then raise exception 'only an assessment under review can be reviewed'; end if;
  select subject.department_id into subject_department_id
    from public.school_subjects subject
   where subject.id = workspace.school_subject_id and subject.school_id = actor.school_id;
  if not (private.has_school_role(actor.school_id, 'DOS') or private.has_department_role(actor.school_id, subject_department_id, 'HOD')) then
    raise exception 'the active reviewer is not authorised for this assessment subject';
  end if;
  if p_decision not in ('APPROVE', 'RETURN') then raise exception 'review decision must be APPROVE or RETURN'; end if;
  if p_decision = 'RETURN' and clean_reason is null then raise exception 'a return reason is required'; end if;
  submitted_version := coalesce(workspace.submitted_version_id, workspace.current_version_id);
  if not exists (
    select 1 from public.assessment_versions version
     where version.id = submitted_version
       and version.assessment_workspace_id = p_workspace_id
       and version.school_id = actor.school_id
  ) then raise exception 'the submitted assessment version was not found'; end if;

  if p_decision = 'APPROVE' then
    if workspace.current_version_id is distinct from submitted_version then
      raise exception 'the submitted assessment version is no longer current; return it for teacher revision';
    end if;
    select array_agg(section.teaching_section_id order by section.teaching_section_id)
      into section_ids
      from public.assessment_workspace_sections section
     where section.assessment_workspace_id = p_workspace_id
       and section.school_id = actor.school_id;
    profile_context := private.resolve_assessment_profile_context(
      actor.school_id, workspace.academic_period_id, workspace.assessment_date,
      workspace.school_subject_id, workspace.curriculum_subject_profile_id,
      workspace.assessment_profile_id, workspace.purpose, section_ids
    );
    if coalesce((profile_context->>'applicable')::boolean, false) is not true then
      raise exception 'approval blocked: the governed assessment profile is no longer applicable; return the assessment for revision';
    end if;
    if coalesce(profile_context->>'rightsState', 'UNKNOWN') <> 'CLEARED'
       or coalesce(profile_context->>'productionUseStatus', 'PERMISSION_PENDING') <> 'PERMITTED'
       or coalesce((profile_context->>'formalArtifactAllowed')::boolean, false) is not true
       or coalesce((profile_context->>'exportAllowed')::boolean, false) is not true then
      raise exception 'approval blocked: current curriculum rights or institutional rules no longer permit this assessment to become final';
    end if;
    perform private.validate_assessment_ready(p_workspace_id, submitted_version, null);
  end if;

  perform set_config('ate.assessment_review_transition', 'true', true);
  if p_decision = 'APPROVE' then
    perform set_config('ate.assessment_finalisation', 'true', true);
    update public.assessment_workspaces
       set status = 'FINAL', finalised_by_membership_id = actor.id, finalised_at = reviewed_at,
           scope_snapshot = (select jsonb_agg(to_jsonb(item)) from public.assessment_scope_items item where item.assessment_workspace_id = p_workspace_id),
           updated_at = reviewed_at
     where id = p_workspace_id;
    insert into public.assessment_review_events(school_id, assessment_workspace_id, assessment_version_id, event_type, actor_membership_id, reason, created_at)
      values(actor.school_id, p_workspace_id, submitted_version, 'APPROVED', actor.id, clean_reason, reviewed_at);
  else
    update public.assessment_workspaces set status = 'DRAFT', updated_at = reviewed_at where id = p_workspace_id;
    insert into public.assessment_review_events(school_id, assessment_workspace_id, assessment_version_id, event_type, actor_membership_id, reason, created_at)
      values(actor.school_id, p_workspace_id, submitted_version, 'RETURNED', actor.id, clean_reason, reviewed_at);
  end if;
  insert into public.audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
    values(actor.school_id, actor.user_id,
      case when p_decision = 'APPROVE' then 'APPROVE_ASSESSMENT_REVIEW' else 'RETURN_ASSESSMENT_REVIEW' end,
      'ASSESSMENT_WORKSPACE', p_workspace_id,
      jsonb_build_object('version_id', submitted_version, 'decision', p_decision, 'reason', clean_reason),
      jsonb_build_object('status', case when p_decision = 'APPROVE' then 'FINAL' else 'DRAFT' end, 'reviewed_at', reviewed_at));
  return jsonb_build_object('workspaceId', p_workspace_id, 'decision', p_decision, 'status', case when p_decision = 'APPROVE' then 'FINAL' else 'DRAFT' end, 'reviewedAt', reviewed_at);
end;
$$;

revoke all on function public.review_assessment_workspace(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_assessment_workspace(uuid, text, text) to authenticated;
