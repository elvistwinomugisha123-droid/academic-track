-- Narrow operator command for staging one real teacher's controlled pilot.
-- School creation requires an explicit input flag and an existing Auth actor
-- with the server-managed ate_pilot_operator app-metadata claim.
create table if not exists public.pilot_teaching_section_constraints (
  teaching_section_id uuid primary key references public.teaching_sections(id),
  school_id uuid not null references public.schools(id),
  constraints jsonb not null default '[]'::jsonb check (jsonb_typeof(constraints)='array'),
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now()
);
alter table public.pilot_teaching_section_constraints enable row level security;
revoke all on public.pilot_teaching_section_constraints from public;

create or replace function public.apply_one_teacher_controlled_pilot(p_plan jsonb, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  actor uuid := (select auth.uid());
  teacher_id uuid;
  school_id uuid;
  period_id uuid;
  membership_id uuid;
  version_id uuid;
  level_id uuid;
  stream_id uuid;
  subject_id uuid;
  section_id uuid;
  slot_id uuid;
  profile_id uuid;
  existing_profile uuid;
  section_item jsonb;
  slot_item jsonb;
  level_item text;
  stream_item jsonb;
  subject_item jsonb;
  section_ids jsonb := '{}'::jsonb;
  school_slug text := p_plan #>> '{school,slug}';
  period_start date := (p_plan #>> '{academicPeriod,startsOn}')::date;
  period_end date := (p_plan #>> '{academicPeriod,endsOn}')::date;
  binding_date date;
begin
  if actor is null or not exists (
    select 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'ate_pilot_operator'='true'
  ) then raise exception 'authenticated controlled-pilot operator authority required'; end if;
  if p_dry_run is null then raise exception 'dry-run mode must be explicit'; end if;
  if p_plan #>> '{timetable,name}' <> 'ONE-TEACHER CONTROLLED PILOT TIMETABLE'
    or p_plan #>> '{timetable,scope}' <> 'ONLY_THIS_TEACHER' then
    raise exception 'pilot timetable scope/name mismatch';
  end if;
  if jsonb_typeof(p_plan->'sections') <> 'array' or jsonb_array_length(p_plan->'sections') = 0
    or jsonb_typeof(p_plan #> '{timetable,slots}') <> 'array' then
    raise exception 'sections and timetable slots must be explicit arrays';
  end if;
  if school_slug is null or school_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or period_end < period_start then raise exception 'invalid pilot school or academic period'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_plan #>> '{school,timezone}') then
    raise exception 'unknown school timezone'; end if;
  teacher_id := (p_plan #>> '{teacher,existingAuthUserId}')::uuid;
  if not exists (select 1 from auth.users u where u.id=teacher_id and lower(u.email)=lower(p_plan #>> '{teacher,email}')) then
    raise exception 'teacher Auth identity and email must already match'; end if;
  if exists (select 1 from jsonb_array_elements(p_plan->'sections') s
    where s ?| array['positionConfirmed','confirmedCurriculumPositionId','curriculumPositionEvent','confirmedAt']) then
    raise exception 'teacher curriculum position confirmation is a separate teacher action'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_plan #> '{timetable,slots}') with ordinality a(slot, n)
    join jsonb_array_elements(p_plan #> '{timetable,slots}') with ordinality b(slot, n) on a.n < b.n
    where a.slot->>'dayOfWeek'=b.slot->>'dayOfWeek'
      and (a.slot->>'startsAt')::time < (b.slot->>'endsAt')::time
      and (b.slot->>'startsAt')::time < (a.slot->>'endsAt')::time
  ) then raise exception 'overlapping teacher timetable slots'; end if;
  for section_item in select value from jsonb_array_elements(p_plan->'sections') loop
    if section_item->>'assignmentState' <> 'PROPOSED'
      or section_item->>'curriculumPositionState' <> 'AWAITING_TEACHER_CONFIRMATION'
      or section_item->>'stream' is null or section_item->>'classLevel' is null
      or section_item->>'schoolSubjectKey' is null then
      raise exception 'pilot sections must be explicit and unconfirmed'; end if;
    profile_id := nullif(section_item->>'curriculumProfileId','')::uuid;
    if profile_id is not null then
      if section_item->>'bindingEffectiveFrom' is null then raise exception 'profile binding date required'; end if;
      if not exists (
        select 1 from public.knowledge_subject_profiles p
        join public.knowledge_curriculum_releases r on r.id=p.release_id
        join public.knowledge_curriculum_subjects s on s.id=p.governed_subject_id
        where p.id=profile_id and p.status='ACTIVE' and p.runtime_status='PILOT_ACTIVE'
          and r.status='ACTIVE'
          and p.education_level=case when section_item->>'classLevel' in ('S5','S6') then 'advanced-secondary' else 'lower-secondary' end
          and lower(s.title)=lower(case section_item->>'subject'
            when 'PRINCIPAL_MATHEMATICS' then 'Principal Mathematics'
            when 'SUBSIDIARY_MATHEMATICS' then 'Subsidiary Mathematics'
            when 'MATHEMATICS' then 'Mathematics'
            when 'CHEMISTRY' then 'Chemistry' else '' end)
      ) then raise exception 'eligible published curriculum profile required'; end if;
    end if;
  end loop;
  select s.id into school_id from public.schools s where s.slug=school_slug;
  if school_id is null and coalesce((p_plan #>> '{school,createIfMissing}')::boolean,false) is not true then
    raise exception 'school does not exist and creation was not explicitly requested'; end if;
  if school_id is not null and exists (select 1 from public.schools s where s.id=school_id
    and (s.name <> p_plan #>> '{school,name}' or s.timezone <> p_plan #>> '{school,timezone}' or s.status <> 'ACTIVE')) then
    raise exception 'existing school identity differs from the explicit plan'; end if;
  if p_dry_run then
    return jsonb_build_object('dryRun',true,'schoolId',school_id,'academicPeriodId',null,
      'teacherMembershipId',null,'timetableVersionId',null,'teachingSectionIds','{}'::jsonb,
      'scheduledLessonsPendingActivation',true,
      'plannedSectionCount',jsonb_array_length(p_plan->'sections'),
      'plannedSlotCount',jsonb_array_length(p_plan #> '{timetable,slots}'));
  end if;
  perform pg_advisory_xact_lock(hashtext('ate_one_teacher_pilot:' || school_slug));
  if school_id is null then
    insert into public.schools(name,slug,status,timezone) values
      (p_plan #>> '{school,name}',school_slug,'ACTIVE',p_plan #>> '{school,timezone}') returning id into school_id;
  end if;
  select p.id into period_id from public.academic_periods p
    where p.school_id=school_id and p.name=p_plan #>> '{academicPeriod,name}' and p.starts_on=period_start;
  if period_id is null then
    insert into public.academic_periods(school_id,name,period_type,academic_year,starts_on,ends_on,status)
      values(school_id,p_plan #>> '{academicPeriod,name}',p_plan #>> '{academicPeriod,periodType}',
        (p_plan #>> '{academicPeriod,academicYear}')::integer,period_start,period_end,'PLANNED')
      returning id into period_id;
  elsif exists (select 1 from public.academic_periods p where p.id=period_id
    and (p.ends_on <> period_end or p.period_type <> p_plan #>> '{academicPeriod,periodType}'
      or p.academic_year <> (p_plan #>> '{academicPeriod,academicYear}')::integer)) then
    raise exception 'existing academic period differs from the explicit plan';
  end if;
  select m.id into membership_id from public.memberships m where m.school_id=school_id and m.user_id=teacher_id;
  if membership_id is null then
    insert into public.memberships(school_id,user_id,status,display_name,joined_at)
      values(school_id,teacher_id,'ACTIVE',p_plan #>> '{teacher,name}',now()) returning id into membership_id;
  elsif exists (select 1 from public.memberships m where m.id=membership_id
    and (m.status <> 'ACTIVE' or m.display_name <> p_plan #>> '{teacher,name}')) then
    raise exception 'existing teacher membership differs from the explicit plan';
  end if;
  insert into public.role_grants(membership_id,school_id,role,scope_type,status,granted_by)
    select membership_id,school_id,'TEACHER','SCHOOL','ACTIVE',actor
    where not exists(select 1 from public.role_grants g where g.membership_id=membership_id and g.role='TEACHER' and g.status='ACTIVE');
  for level_item in select value #>> '{}' from jsonb_array_elements(p_plan->'classLevels') loop
    insert into public.class_levels(school_id,code,name,sort_order,status)
      values(school_id,level_item,level_item,substring(level_item from 2)::integer,'ACTIVE')
      on conflict do nothing;
  end loop;
  for stream_item in select value from jsonb_array_elements(p_plan->'streams') loop
    select l.id into level_id from public.class_levels l where l.school_id=school_id and l.code=stream_item->>'classLevel';
    insert into public.streams(school_id,class_level_id,name,status)
      values(school_id,level_id,stream_item->>'name','ACTIVE')
      on conflict do nothing;
  end loop;
  for subject_item in select value from jsonb_array_elements(p_plan->'subjects') loop
    insert into public.school_subjects(school_id,code,name,status)
      values(school_id,subject_item->>'key',subject_item->>'key','ACTIVE')
      on conflict do nothing;
  end loop;
  for section_item in select value from jsonb_array_elements(p_plan->'sections') loop
    select l.id into level_id from public.class_levels l where l.school_id=school_id and l.code=section_item->>'classLevel';
    select st.id into stream_id from public.streams st where st.school_id=school_id and st.class_level_id=level_id and lower(st.name)=lower(section_item->>'stream');
    select ss.id into subject_id from public.school_subjects ss where ss.school_id=school_id and ss.code=section_item->>'schoolSubjectKey';
    if level_id is null or stream_id is null or subject_id is null then raise exception 'school structure missing for section'; end if;
    select ts.id into section_id from public.teaching_sections ts where ts.school_id=school_id
      and ts.academic_period_id=period_id and ts.teacher_membership_id=membership_id and ts.school_subject_id=subject_id
      and ts.class_level_id=level_id and ts.stream_id=stream_id;
    if section_id is null then
      insert into public.teaching_sections(school_id,academic_period_id,teacher_membership_id,school_subject_id,
        class_level_id,stream_id,assignment_state,operational_status,created_by)
        values(school_id,period_id,membership_id,subject_id,level_id,stream_id,'PROPOSED','ACTIVE',actor)
        returning id into section_id;
    end if;
    if exists(select 1 from public.pilot_teaching_section_constraints c where c.teaching_section_id=section_id
      and c.constraints <> coalesce(section_item->'classroomConstraints','[]'::jsonb)) then
      raise exception 'existing classroom constraints differ from the explicit plan'; end if;
    insert into public.pilot_teaching_section_constraints(teaching_section_id,school_id,constraints,recorded_by)
      values(section_id,school_id,coalesce(section_item->'classroomConstraints','[]'::jsonb),actor)
      on conflict (teaching_section_id) do nothing;
    section_ids := section_ids || jsonb_build_object(section_item->>'key',section_id::text);
    profile_id := nullif(section_item->>'curriculumProfileId','')::uuid;
    if profile_id is not null then
      binding_date := (section_item->>'bindingEffectiveFrom')::date;
      select b.subject_profile_id into existing_profile from public.school_subject_curriculum_bindings b
        where b.school_id=school_id and b.school_subject_id=subject_id and b.status='ACTIVE' and b.effective_from=binding_date;
      if existing_profile is not null and existing_profile <> profile_id then raise exception 'conflicting school subject curriculum binding'; end if;
      if existing_profile is null then
        insert into public.school_subject_curriculum_bindings(school_id,school_subject_id,subject_profile_id,effective_from,status,bound_by)
          values(school_id,subject_id,profile_id,binding_date,'ACTIVE',actor);
      end if;
      select b.subject_profile_id into existing_profile from public.teaching_section_curriculum_bindings b
        where b.school_id=school_id and b.teaching_section_id=section_id and b.status='ACTIVE' and b.effective_from=binding_date;
      if existing_profile is not null and existing_profile <> profile_id then raise exception 'conflicting section curriculum binding'; end if;
      if existing_profile is null then
        insert into public.teaching_section_curriculum_bindings(school_id,teaching_section_id,subject_profile_id,effective_from,status,bound_by)
          values(school_id,section_id,profile_id,binding_date,'ACTIVE',actor);
      end if;
    end if;
  end loop;
  select v.id into version_id from public.timetable_versions v where v.school_id=school_id
    and v.academic_period_id=period_id and v.version_number=(p_plan #>> '{timetable,versionNumber}')::integer;
  if version_id is null then
    insert into public.timetable_versions(school_id,academic_period_id,version_number,name,effective_from,status,created_by,notes)
      values(school_id,period_id,(p_plan #>> '{timetable,versionNumber}')::integer,
        'ONE-TEACHER CONTROLLED PILOT TIMETABLE',(p_plan #>> '{timetable,effectiveFrom}')::date,
        'DRAFT',actor,'Only the supplied teacher and sections; not a complete school timetable.') returning id into version_id;
  elsif exists(select 1 from public.timetable_versions v where v.id=version_id and
    (v.name <> 'ONE-TEACHER CONTROLLED PILOT TIMETABLE' or v.effective_from <> (p_plan #>> '{timetable,effectiveFrom}')::date
      or v.status <> 'DRAFT')) then raise exception 'existing timetable version differs or is no longer DRAFT'; end if;
  for slot_item in select value from jsonb_array_elements(p_plan #> '{timetable,slots}') loop
    section_id := (section_ids->>(slot_item->>'sectionKey'))::uuid;
    if section_id is null then raise exception 'timetable slot references an unknown Teaching Section'; end if;
    select t.id into slot_id from public.timetable_slots t where t.timetable_version_id=version_id
      and t.teaching_section_id=section_id and t.day_of_week=(slot_item->>'dayOfWeek')::smallint
      and t.starts_at=(slot_item->>'startsAt')::time;
    if slot_id is not null then
      if exists(select 1 from public.timetable_slots t where t.id=slot_id and
        (t.ends_at <> (slot_item->>'endsAt')::time or coalesce(t.room_label,'') <> coalesce(slot_item->>'room',''))) then
        raise exception 'duplicate timetable slot has different time or room'; end if;
      continue;
    end if;
    if exists(select 1 from public.timetable_slots t where t.timetable_version_id=version_id
      and t.day_of_week=(slot_item->>'dayOfWeek')::smallint
      and t.starts_at < (slot_item->>'endsAt')::time and t.ends_at > (slot_item->>'startsAt')::time) then
      raise exception 'teacher timetable slots overlap'; end if;
    insert into public.timetable_slots(school_id,timetable_version_id,teaching_section_id,day_of_week,starts_at,ends_at,room_label)
      values(school_id,version_id,section_id,(slot_item->>'dayOfWeek')::smallint,
        (slot_item->>'startsAt')::time,(slot_item->>'endsAt')::time,nullif(slot_item->>'room',''));
  end loop;
  return jsonb_build_object('dryRun',false,'schoolId',school_id,'academicPeriodId',period_id,
    'teacherMembershipId',membership_id,'timetableVersionId',version_id,'teachingSectionIds',section_ids,
    'scheduledLessonsPendingActivation',true);
end
$$;

revoke all on function public.apply_one_teacher_controlled_pilot(jsonb,boolean) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname='authenticated') then
    grant execute on function public.apply_one_teacher_controlled_pilot(jsonb,boolean) to authenticated;
  end if;
end $$;
