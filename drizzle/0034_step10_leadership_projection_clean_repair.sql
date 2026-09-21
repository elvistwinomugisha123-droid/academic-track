-- Forward repair for the applied Step 10 leadership projection.
-- Keep the public 0029 wrapper and replace only its private legacy delegate
-- with an explicitly aliased deterministic projection.
create or replace function public.get_leadership_overview_pre_0029(p_scope text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  actor record;
  result jsonb;
begin
  select membership.id, membership.school_id
    into actor
    from public.memberships membership
   where membership.user_id = auth.uid()
     and membership.status = 'ACTIVE'
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
    select section.id,
           section.academic_period_id,
           section.teacher_membership_id,
           section.school_subject_id,
           section.class_level_id,
           section.stream_id,
           period.name as period_name,
           subject.department_id,
           subject.name as subject_name,
           subject.code as subject_code,
           department.name as department_name,
           level.name as class_level_name,
           level.sort_order as class_level_sort_order,
           stream.name as stream_name,
           teacher.display_name as teacher_name,
           greatest(period.starts_on, least(current_date, period.ends_on)) as effective_on
      from public.teaching_sections section
      join public.academic_periods period
        on period.id = section.academic_period_id
       and period.school_id = section.school_id
      join public.school_subjects subject
        on subject.id = section.school_subject_id
       and subject.school_id = section.school_id
      left join public.departments department
        on department.id = subject.department_id
       and department.school_id = subject.school_id
      join public.class_levels level
        on level.id = section.class_level_id
       and level.school_id = section.school_id
      join public.streams stream
        on stream.id = section.stream_id
       and stream.school_id = section.school_id
      join public.memberships teacher
        on teacher.id = section.teacher_membership_id
       and teacher.school_id = section.school_id
     where section.school_id = actor.school_id
       and section.assignment_state = 'CONFIRMED'
       and section.operational_status = 'ACTIVE'
       and (p_scope in ('DOS', 'PRINCIPAL') or private.has_department_role(section.school_id, subject.department_id, 'HOD'))
  ), section_context as (
    select scoped.*,
           binding.subject_profile_id,
           position_event.id as position_event_id,
           position_event.canonical_id,
           position_event.confirmed_at as position_confirmed_at,
           position_record.id as governed_record_id,
           coalesce(
             nullif(position_record_record.normalized->>'title', ''),
             nullif(position_record_record.normalized->>'name', ''),
             position_event.canonical_id
           ) as position_label
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
       and position_record.status = 'APPROVED'
       and position_record.runtime_status = 'PILOT_ACTIVE'
       and (position_record.effective_from is null or position_record.effective_from <= scoped.effective_on)
       and (position_record.effective_to is null or position_record.effective_to >= scoped.effective_on)
      left join public.knowledge_records position_record_record
        on position_record_record.canonical_id = position_event.canonical_id
       and position_record_record.verification_status = 'VERIFIED'
  ), positioned as (
    select context.*,
           case
             when context.subject_profile_id is null then 'UNAVAILABLE'
             when context.position_event_id is null then 'UNAVAILABLE'
             when context.governed_record_id is null then 'REVIEW_REQUIRED'
             else 'CONFIRMED'
           end as position_status
      from section_context context
  ), lesson_state as (
    select lesson.id as lesson_id,
           lesson.teaching_section_id,
           lesson.scheduled_date,
           lesson.starts_at,
           lesson.ends_at,
           section_row.subject_name,
           section_row.subject_code,
           section_row.department_name,
           section_row.class_level_name,
           section_row.stream_name,
           event.outcome,
           event.reason,
           event.note,
           case
             when event.outcome = 'PARTIALLY_DELIVERED' then 'PARTIALLY_DELIVERED'
             when event.outcome = 'NOT_DELIVERED' then 'NOT_DELIVERED'
             when event.outcome = 'CHANGED' then 'CHANGED'
             when event.outcome = 'DELIVERED' then 'DELIVERED'
             when lesson.ends_at <= now() then 'UNCONFIRMED'
             else 'SCHEDULED'
           end as lesson_state
      from public.scheduled_lessons lesson
      join positioned section_row on section_row.id = lesson.teaching_section_id
      left join lateral (
        select classroom.*
          from public.classroom_events classroom
         where classroom.school_id = actor.school_id
           and classroom.scheduled_lesson_id = lesson.id
           and not exists (
             select 1 from public.classroom_events successor
              where successor.supersedes_event_id = classroom.id
           )
         order by classroom.created_at desc
         limit 1
      ) event on true
     where lesson.school_id = actor.school_id
       and lesson.schedule_status = 'SCHEDULED'
       and lesson.starts_at <= now() + interval '60 days'
       and lesson.ends_at >= now() - interval '90 days'
  ), programme_disruptions as (
    select distinct
           lesson.id as lesson_id,
           lesson.teaching_section_id,
           programme.id as programme_event_id,
           programme.title,
           programme.event_type,
           programme.starts_at,
           programme.ends_at
      from public.scheduled_lessons lesson
      join positioned section_row on section_row.id = lesson.teaching_section_id
      join public.school_programme_events programme
        on programme.school_id = actor.school_id
       and programme.status = 'SCHEDULED'
       and programme.starts_at < lesson.ends_at
       and programme.ends_at > lesson.starts_at
     where lesson.school_id = actor.school_id
       and lesson.schedule_status = 'SCHEDULED'
       and (
         not exists (
           select 1 from public.programme_event_targets target
            where target.event_id = programme.id and target.school_id = actor.school_id
         )
         or exists (
           select 1 from public.programme_event_targets target
            where target.event_id = programme.id
              and target.school_id = actor.school_id
              and (target.class_level_id = section_row.class_level_id
                or target.stream_id = section_row.stream_id
                or target.department_id = section_row.department_id)
         )
       )
  ), attention as (
    select 'UNCONFIRMED_LESSON' as item_type,
           'ACTION_REQUIRED' as category,
           lesson_row.teaching_section_id,
           lesson_row.subject_name,
           lesson_row.class_level_name,
           lesson_row.stream_name,
           lesson_row.scheduled_date as relevant_date,
           'Past scheduled lesson has no authorised classroom outcome.' as reason,
           'DEPARTMENT' as responsible_scope,
           concat('#section-', lesson_row.teaching_section_id) as safe_destination
      from lesson_state lesson_row
     where lesson_row.lesson_state = 'UNCONFIRMED'
    union all
    select concat(lower(lesson_row.lesson_state), '_LESSON'),
           case when lesson_row.lesson_state in ('NOT_DELIVERED', 'PARTIALLY_DELIVERED') then 'ACTION_REQUIRED' else 'REVIEW' end,
           lesson_row.teaching_section_id,
           lesson_row.subject_name,
           lesson_row.class_level_name,
           lesson_row.stream_name,
           lesson_row.scheduled_date,
           case lesson_row.lesson_state
             when 'NOT_DELIVERED' then coalesce(nullif(lesson_row.reason, ''), 'Teacher confirmed that the lesson was not delivered.')
             when 'PARTIALLY_DELIVERED' then 'Teacher-confirmed partial delivery has carry-forward implications.'
             else 'Teacher confirmed a change from the planned lesson.'
           end,
           'DEPARTMENT',
           concat('#section-', lesson_row.teaching_section_id)
      from lesson_state lesson_row
     where lesson_row.lesson_state in ('NOT_DELIVERED', 'PARTIALLY_DELIVERED', 'CHANGED')
    union all
    select 'CURRICULUM_POSITION',
           'REVIEW',
           position_row.id,
           position_row.subject_name,
           position_row.class_level_name,
           position_row.stream_name,
           position_row.effective_on,
           case when position_row.subject_profile_id is null then 'Teaching Section has no applicable governed curriculum binding.'
                when position_row.position_event_id is null then 'No confirmed curriculum position is recorded for this Teaching Section.'
                else 'The recorded curriculum position is not currently usable under the governed profile.' end,
           'DEPARTMENT',
           concat('#section-', position_row.id)
      from positioned position_row
     where position_row.position_status <> 'CONFIRMED'
    union all
    select 'PROGRAMME_DISRUPTION',
           'REVIEW',
           disruption.teaching_section_id,
           position_row.subject_name,
           position_row.class_level_name,
           position_row.stream_name,
           disruption.starts_at::date,
           concat('Programme event affects scheduled teaching: ', disruption.title, '.'),
           'SCHOOL',
           concat('#section-', disruption.teaching_section_id)
      from programme_disruptions disruption
      join positioned position_row on position_row.id = disruption.teaching_section_id
  ), assessment_state as (
    select workspace.id,
           workspace.title,
           workspace.purpose,
           workspace.status,
           workspace.total_marks,
           workspace.duration_minutes,
           workspace.assessment_date,
           workspace.submitted_at,
           workspace.finalised_at,
           subject.name as subject_name,
           department.name as department_name,
           coalesce((workspace.profile_snapshot->>'requiresReview')::boolean, false) as requires_review,
           count(distinct workspace_section.teaching_section_id) as section_count
      from public.assessment_workspaces workspace
      join public.school_subjects subject
        on subject.id = workspace.school_subject_id
       and subject.school_id = workspace.school_id
      left join public.departments department
        on department.id = subject.department_id
       and department.school_id = subject.school_id
      left join public.assessment_workspace_sections workspace_section
        on workspace_section.assessment_workspace_id = workspace.id
       and workspace_section.school_id = workspace.school_id
      left join positioned position_row
        on position_row.id = workspace_section.teaching_section_id
     where workspace.school_id = actor.school_id
       and workspace.status in ('IN_REVIEW', 'FINAL')
       and (p_scope <> 'PRINCIPAL' or workspace.status = 'IN_REVIEW')
     group by workspace.id, workspace.title, workspace.purpose, workspace.status,
              workspace.total_marks, workspace.duration_minutes, workspace.assessment_date,
              workspace.submitted_at, workspace.finalised_at, workspace.profile_snapshot,
              subject.name, department.name
  )
  select jsonb_build_object(
    'scope', p_scope,
    'summary', jsonb_build_object(
      'scheduledLessons', (select count(*) from lesson_state),
      'delivered', (select count(*) from lesson_state where lesson_state = 'DELIVERED'),
      'partiallyDelivered', (select count(*) from lesson_state where lesson_state = 'PARTIALLY_DELIVERED'),
      'notDelivered', (select count(*) from lesson_state where lesson_state = 'NOT_DELIVERED'),
      'changed', (select count(*) from lesson_state where lesson_state = 'CHANGED'),
      'unconfirmed', (select count(*) from lesson_state where lesson_state = 'UNCONFIRMED'),
      'curriculumReviewRequired', (select count(*) from positioned where position_status <> 'CONFIRMED'),
      'streamDrift', 0,
      'assessmentsInReview', (select count(*) from assessment_state where status = 'IN_REVIEW'),
      'programmeDisruptions', (select count(*) from programme_disruptions)
    ),
    'attention', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', md5(concat(item_type, ':', coalesce(teaching_section_id::text, ''), ':', coalesce(relevant_date::text, ''))),
        'type', item_type,
        'category', category,
        'teachingSectionId', teaching_section_id,
        'subject', subject_name,
        'classLevel', class_level_name,
        'stream', stream_name,
        'relevantDate', relevant_date,
        'reason', reason,
        'responsibleScope', responsible_scope,
        'safeDestination', safe_destination
      ) order by case category when 'ACTION_REQUIRED' then 1 when 'REVIEW' then 2 else 3 end, relevant_date desc nulls last, item_type)
        from attention
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', position_row.id,
        'departmentId', position_row.department_id,
        'department', position_row.department_name,
        'subject', position_row.subject_name,
        'subjectCode', position_row.subject_code,
        'classLevel', position_row.class_level_name,
        'stream', position_row.stream_name,
        'teacher', position_row.teacher_name,
        'period', position_row.period_name,
        'currentPosition', case when position_row.position_status = 'CONFIRMED' then position_row.position_label else null end,
        'positionStatus', position_row.position_status,
        'positionStatusLabel', case position_row.position_status when 'CONFIRMED' then 'Confirmed current position' when 'REVIEW_REQUIRED' then 'Review required' else 'Unavailable' end,
        'positionEventId', position_row.position_event_id,
        'positionConfirmedAt', position_row.position_confirmed_at,
        'lessonStates', (select jsonb_agg(jsonb_build_object('lessonId', lesson_row.lesson_id, 'date', lesson_row.scheduled_date, 'state', lesson_row.lesson_state, 'reason', lesson_row.reason, 'note', lesson_row.note) order by lesson_row.scheduled_date desc, lesson_row.starts_at desc) from lesson_state lesson_row where lesson_row.teaching_section_id = position_row.id and lesson_row.lesson_state <> 'SCHEDULED')
      ) order by position_row.department_name, position_row.subject_name, position_row.class_level_sort_order, position_row.class_level_name, position_row.stream_name)
        from positioned position_row
    ), '[]'::jsonb),
    'drift', '[]'::jsonb,
    'assessments', coalesce((
      select jsonb_agg(jsonb_build_object('id', assessment.id, 'title', assessment.title, 'purpose', assessment.purpose, 'status', assessment.status, 'subject', assessment.subject_name, 'department', assessment.department_name, 'totalMarks', assessment.total_marks, 'durationMinutes', assessment.duration_minutes, 'assessmentDate', assessment.assessment_date, 'submittedAt', assessment.submitted_at, 'finalisedAt', assessment.finalised_at, 'requiresReview', assessment.requires_review, 'sectionCount', assessment.section_count, 'canReview', assessment.status = 'IN_REVIEW' and p_scope <> 'PRINCIPAL') order by case assessment.status when 'IN_REVIEW' then 1 else 2 end, assessment.submitted_at desc nulls last)
        from assessment_state assessment
    ), '[]'::jsonb),
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object('id', department_row.department_id, 'name', department_row.department_name, 'sectionCount', count(*), 'exceptionCount', count(*) filter (where department_row.position_status <> 'CONFIRMED' or exists(select 1 from lesson_state lesson_row where lesson_row.teaching_section_id = department_row.id and lesson_row.lesson_state in ('UNCONFIRMED', 'NOT_DELIVERED', 'PARTIALLY_DELIVERED', 'CHANGED')))) order by department_row.department_name)
        from positioned department_row
       group by department_row.department_id, department_row.department_name
    ), '[]'::jsonb),
    'programmeDisruptions', coalesce((
      select jsonb_agg(jsonb_build_object('lessonId', disruption.lesson_id, 'teachingSectionId', disruption.teaching_section_id, 'programmeEventId', disruption.programme_event_id, 'title', disruption.title, 'type', disruption.event_type, 'startsAt', disruption.starts_at, 'endsAt', disruption.ends_at) order by disruption.starts_at)
        from programme_disruptions disruption
    ), '[]'::jsonb)
  ) into result;

  if p_scope = 'PRINCIPAL' then
    result := result - 'sections';
  end if;
  return result;
end;
$$;
