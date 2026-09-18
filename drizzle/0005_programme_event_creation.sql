-- Step 4C: atomic programme-event creation with an optional single target.

create or replace function public.create_programme_event(
  p_academic_period_id uuid,
  p_event_type text,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text,
  p_target_type text,
  p_target_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  school_id uuid;
  event_id uuid;
  authorized_school_count integer;
begin
  if actor is null then raise exception 'authentication required'; end if;
  if p_event_type is null or p_event_type not in ('HOLIDAY', 'ASSEMBLY', 'SPORTS', 'TRIP', 'VISITATION', 'EXAMINATION', 'MOCK', 'OTHER') then raise exception 'unsupported programme event type'; end if;
  if p_target_type is null or p_target_type not in ('SCHOOL', 'CLASS_LEVEL', 'STREAM', 'DEPARTMENT') then raise exception 'unsupported programme target type'; end if;
  if p_title is null or length(trim(p_title)) = 0 then raise exception 'programme event title is required'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then raise exception 'programme event end must be after start'; end if;

  if p_academic_period_id is not null then
    select p.school_id into school_id from public.academic_periods p where p.id = p_academic_period_id;
    if school_id is null then raise exception 'academic period does not belong to this school'; end if;
    if not private.is_active_school_member(school_id) or not (private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN')) then
      raise exception 'academic operations authority required';
    end if;
  else
    select count(distinct m.school_id)::integer into authorized_school_count
    from public.memberships m
    join public.schools s on s.id = m.school_id and s.status = 'ACTIVE'
    where m.user_id = actor and m.status = 'ACTIVE'
      and (private.has_school_role(m.school_id, 'DOS') or private.has_school_role(m.school_id, 'SCHOOL_ADMIN'));
    if authorized_school_count <> 1 then raise exception 'an unambiguous active school context is required'; end if;
    select m.school_id into school_id
    from public.memberships m
    join public.schools s on s.id = m.school_id and s.status = 'ACTIVE'
    where m.user_id = actor and m.status = 'ACTIVE'
      and (private.has_school_role(m.school_id, 'DOS') or private.has_school_role(m.school_id, 'SCHOOL_ADMIN'))
    limit 1;
  end if;
  if school_id is null then raise exception 'academic operations authority required'; end if;

  if p_target_type = 'SCHOOL' and p_target_id is not null then raise exception 'school-wide events cannot have a target id'; end if;
  if p_target_type <> 'SCHOOL' and p_target_id is null then raise exception 'targeted events require a target id'; end if;
  if p_academic_period_id is not null and not exists (select 1 from public.academic_periods p where p.id = p_academic_period_id and p.school_id = school_id) then raise exception 'academic period does not belong to this school'; end if;
  if p_target_type = 'CLASS_LEVEL' and not exists (select 1 from public.class_levels c where c.id = p_target_id and c.school_id = school_id) then raise exception 'class level does not belong to this school'; end if;
  if p_target_type = 'STREAM' and not exists (select 1 from public.streams s where s.id = p_target_id and s.school_id = school_id) then raise exception 'stream does not belong to this school'; end if;
  if p_target_type = 'DEPARTMENT' and not exists (select 1 from public.departments d where d.id = p_target_id and d.school_id = school_id) then raise exception 'department does not belong to this school'; end if;

  insert into public.school_programme_events (school_id, academic_period_id, event_type, title, starts_at, ends_at, notes, created_by)
  values (school_id, p_academic_period_id, p_event_type, trim(p_title), p_starts_at, p_ends_at, nullif(trim(coalesce(p_notes, '')), ''), actor)
  returning id into event_id;

  if p_target_type <> 'SCHOOL' then
    insert into public.programme_event_targets (event_id, school_id, class_level_id, stream_id, department_id)
    values (event_id, school_id,
      case when p_target_type = 'CLASS_LEVEL' then p_target_id end,
      case when p_target_type = 'STREAM' then p_target_id end,
      case when p_target_type = 'DEPARTMENT' then p_target_id end);
  end if;

  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (school_id, actor, 'CREATE', 'SCHOOL_PROGRAMME_EVENT', event_id,
    jsonb_build_object('event_type', p_event_type, 'target_type', p_target_type, 'target_id', p_target_id));
  return event_id;
end
$$;

revoke all on function public.create_programme_event(uuid, text, text, timestamptz, timestamptz, text, text, uuid) from public;
revoke all on function public.create_programme_event(uuid, text, text, timestamptz, timestamptz, text, text, uuid) from anon;
grant execute on function public.create_programme_event(uuid, text, text, timestamptz, timestamptz, text, text, uuid) to authenticated;
