-- Step 5: classroom reality is append-only evidence projected from scheduled lessons.

alter table public.scheduled_lessons add constraint scheduled_lessons_id_school_unique unique (id, school_id);

create table public.classroom_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  scheduled_lesson_id uuid not null references public.scheduled_lessons(id),
  teaching_section_id uuid not null references public.teaching_sections(id),
  actor_membership_id uuid not null references public.memberships(id),
  outcome text not null check (outcome in ('DELIVERED', 'PARTIALLY_DELIVERED', 'NOT_DELIVERED', 'CHANGED')),
  reason text check (reason is null or length(trim(reason)) between 1 and 240),
  note text check (note is null or length(trim(note)) between 1 and 500),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  supersedes_event_id uuid,
  unique (id, school_id),
  unique (id, school_id, scheduled_lesson_id),
  foreign key (scheduled_lesson_id, school_id) references public.scheduled_lessons(id, school_id),
  foreign key (teaching_section_id, school_id) references public.teaching_sections(id, school_id),
  foreign key (actor_membership_id, school_id) references public.memberships(id, school_id),
  foreign key (supersedes_event_id, school_id, scheduled_lesson_id) references public.classroom_events(id, school_id, scheduled_lesson_id),
  check (outcome <> 'NOT_DELIVERED' or (reason is not null and length(trim(reason)) between 1 and 240)),
  check (outcome <> 'CHANGED' or coalesce(length(trim(reason)), 0) > 0 or coalesce(length(trim(note)), 0) > 0),
  check (supersedes_event_id is null or supersedes_event_id <> id)
);

create index classroom_events_lesson_idx on public.classroom_events (school_id, scheduled_lesson_id, created_at desc);
create index classroom_events_section_idx on public.classroom_events (school_id, teaching_section_id, occurred_at desc);
create index classroom_events_actor_idx on public.classroom_events (school_id, actor_membership_id, created_at desc);
create unique index classroom_events_one_root_per_lesson_idx on public.classroom_events (school_id, scheduled_lesson_id)
  where supersedes_event_id is null;
create unique index classroom_events_one_successor_idx on public.classroom_events (supersedes_event_id)
  where supersedes_event_id is not null;

create or replace function private.prevent_classroom_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'classroom events are append-only';
end
$$;

create trigger classroom_events_append_only
before update or delete on public.classroom_events
for each row execute function private.prevent_classroom_event_mutation();

create or replace function private.classroom_event_can_read(target_school_id uuid, target_section_id uuid, target_membership_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_school_member(target_school_id)
    and (
      private.is_membership_owner(target_school_id, target_membership_id)
      or private.has_school_role(target_school_id, 'DOS')
      or private.has_school_role(target_school_id, 'PRINCIPAL')
      or exists (
        select 1
        from public.teaching_sections section
        join public.school_subjects subject on subject.id = section.school_subject_id and subject.school_id = section.school_id
        where section.id = target_section_id
          and section.school_id = target_school_id
          and private.has_department_role(target_school_id, subject.department_id, 'HOD')
      )
    )
$$;

create policy classroom_events_read on public.classroom_events
for select to authenticated
using (private.classroom_event_can_read(school_id, teaching_section_id, actor_membership_id));

create or replace function private.require_classroom_actor(target_scheduled_lesson_id uuid)
returns table(school_id uuid, lesson_id uuid, section_id uuid, actor_membership_id uuid, lesson_ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  lesson_record record;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required'; end if;
  select lesson.id, lesson.school_id, lesson.teaching_section_id, lesson.ends_at, lesson.schedule_status, section.teacher_membership_id, membership.user_id
    into lesson_record
  from public.scheduled_lessons lesson
  join public.teaching_sections section on section.id = lesson.teaching_section_id and section.school_id = lesson.school_id
  join public.memberships membership on membership.id = section.teacher_membership_id and membership.school_id = section.school_id
  where lesson.id = target_scheduled_lesson_id
  for update of lesson;
  if not found then raise exception 'scheduled lesson not found'; end if;
  if lesson_record.schedule_status <> 'SCHEDULED' then raise exception 'only scheduled lessons can receive classroom confirmation'; end if;
  if lesson_record.user_id <> actor or not private.is_active_school_member(lesson_record.school_id) then
    raise exception 'only the assigned active teacher may confirm this lesson';
  end if;
  if not exists (
    select 1 from public.role_grants grant_row
    where grant_row.membership_id = lesson_record.teacher_membership_id
      and grant_row.school_id = lesson_record.school_id
      and grant_row.role = 'TEACHER'
      and grant_row.status = 'ACTIVE'
  ) then raise exception 'an active TEACHER grant is required'; end if;
  if lesson_record.ends_at > now() then raise exception 'this lesson is not yet ready for confirmation'; end if;
  return query select lesson_record.school_id, lesson_record.id, lesson_record.teaching_section_id, lesson_record.teacher_membership_id, lesson_record.ends_at;
end
$$;

create or replace function private.current_classroom_event(target_lesson_id uuid)
returns uuid language sql stable set search_path = '' as $$
  select event.id
  from public.classroom_events event
  where event.scheduled_lesson_id = target_lesson_id
    and not exists (
      select 1 from public.classroom_events successor
      where successor.supersedes_event_id = event.id
    )
  order by event.created_at desc
  limit 1
$$;

create or replace function public.confirm_classroom_outcome(
  p_scheduled_lesson_id uuid,
  p_outcome text,
  p_reason text default null,
  p_note text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  lesson_record record;
  event_id uuid;
  actor uuid := (select auth.uid());
  clean_reason text := nullif(trim(p_reason), '');
  clean_note text := nullif(trim(p_note), '');
begin
  select * into lesson_record from private.require_classroom_actor(p_scheduled_lesson_id);
  if p_outcome not in ('DELIVERED', 'PARTIALLY_DELIVERED', 'NOT_DELIVERED', 'CHANGED') then raise exception 'invalid classroom outcome'; end if;
  if p_outcome = 'NOT_DELIVERED' and clean_reason is null then raise exception 'not delivered requires a reason'; end if;
  if p_outcome = 'CHANGED' and clean_reason is null and clean_note is null then raise exception 'changed requires a reason or note'; end if;
  if private.current_classroom_event(p_scheduled_lesson_id) is not null then raise exception 'this lesson already has a classroom confirmation'; end if;
  perform set_config('app.ate_command', 'confirm_classroom_outcome', true);
  insert into public.classroom_events (school_id, scheduled_lesson_id, teaching_section_id, actor_membership_id, outcome, reason, note, occurred_at)
    values (lesson_record.school_id, lesson_record.lesson_id, lesson_record.section_id, lesson_record.actor_membership_id, p_outcome, clean_reason, clean_note, now())
    returning id into event_id;
  return event_id;
end
$$;

create or replace function public.correct_classroom_outcome(
  p_scheduled_lesson_id uuid,
  p_supersedes_event_id uuid,
  p_outcome text,
  p_reason text default null,
  p_note text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  lesson_record record;
  prior_event record;
  event_id uuid;
  clean_reason text := nullif(trim(p_reason), '');
  clean_note text := nullif(trim(p_note), '');
begin
  select * into lesson_record from private.require_classroom_actor(p_scheduled_lesson_id);
  select * into prior_event from public.classroom_events where id = p_supersedes_event_id for update;
  if not found or prior_event.scheduled_lesson_id <> p_scheduled_lesson_id or prior_event.school_id <> lesson_record.school_id then raise exception 'classroom event does not belong to this lesson'; end if;
  if private.current_classroom_event(p_scheduled_lesson_id) is distinct from p_supersedes_event_id then raise exception 'only the current classroom confirmation can be corrected'; end if;
  if p_outcome not in ('DELIVERED', 'PARTIALLY_DELIVERED', 'NOT_DELIVERED', 'CHANGED') then raise exception 'invalid classroom outcome'; end if;
  if p_outcome = 'NOT_DELIVERED' and clean_reason is null then raise exception 'not delivered requires a reason'; end if;
  if p_outcome = 'CHANGED' and clean_reason is null and clean_note is null then raise exception 'changed requires a reason or note'; end if;
  perform set_config('app.ate_command', 'correct_classroom_outcome', true);
  insert into public.classroom_events (school_id, scheduled_lesson_id, teaching_section_id, actor_membership_id, outcome, reason, note, occurred_at, supersedes_event_id)
    values (lesson_record.school_id, lesson_record.lesson_id, lesson_record.section_id, lesson_record.actor_membership_id, p_outcome, clean_reason, clean_note, now(), p_supersedes_event_id)
    returning id into event_id;
  return event_id;
end
$$;

create or replace function public.get_classroom_continuity(p_scope text)
returns table(
  lesson_id uuid,
  teaching_section_id uuid,
  school_id uuid,
  scheduled_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  class_level_name text,
  stream_name text,
  subject_name text,
  teacher_membership_id uuid,
  outcome text,
  event_id uuid,
  reason text,
  note text,
  confirmed_at timestamptz,
  lesson_state text,
  carry_forward_state text,
  previous_lesson_id uuid,
  school_timezone text,
  is_today boolean,
  can_confirm boolean,
  can_correct boolean
)
language sql stable security invoker set search_path = '' as $$
  with effective as (
    select event.*
    from public.classroom_events event
    where not exists (select 1 from public.classroom_events successor where successor.supersedes_event_id = event.id)
  ), ordered as (
    select
      lesson.id as lesson_id,
      section.id as teaching_section_id,
      lesson.school_id,
      lesson.scheduled_date,
      lesson.starts_at,
      lesson.ends_at,
      level.name as class_level_name,
      stream.name as stream_name,
      subject.name as subject_name,
      section.teacher_membership_id,
      event.outcome,
      event.id as event_id,
      event.reason,
      event.note,
      event.created_at as confirmed_at,
      school.timezone as school_timezone,
      lag(event.outcome) over (partition by section.id order by lesson.starts_at, lesson.id) as previous_outcome,
      lag(lesson.id) over (partition by section.id order by lesson.starts_at, lesson.id) as previous_lesson_id,
      private.is_membership_owner(lesson.school_id, section.teacher_membership_id) as is_owner,
      private.has_school_role(lesson.school_id, 'TEACHER') as has_teacher_role
    from public.scheduled_lessons lesson
    join public.schools school on school.id = lesson.school_id
    join public.teaching_sections section on section.id = lesson.teaching_section_id and section.school_id = lesson.school_id
    join public.class_levels level on level.id = section.class_level_id and level.school_id = section.school_id
    join public.streams stream on stream.id = section.stream_id and stream.school_id = section.school_id
    join public.school_subjects subject on subject.id = section.school_subject_id and subject.school_id = section.school_id
    left join effective event on event.scheduled_lesson_id = lesson.id
    where lesson.schedule_status = 'SCHEDULED'
      and private.is_active_school_member(lesson.school_id)
      and (
        (p_scope = 'MY' and private.is_membership_owner(lesson.school_id, section.teacher_membership_id))
        or (p_scope = 'DEPARTMENT' and private.has_department_role(lesson.school_id, subject.department_id, 'HOD'))
        or (p_scope = 'SCHOOL' and (private.has_school_role(lesson.school_id, 'DOS') or private.has_school_role(lesson.school_id, 'PRINCIPAL')))
      )
  )
  select ordered.lesson_id, ordered.teaching_section_id, ordered.school_id, ordered.scheduled_date, ordered.starts_at, ordered.ends_at,
    ordered.class_level_name, ordered.stream_name, ordered.subject_name, ordered.teacher_membership_id, ordered.outcome, ordered.event_id, ordered.reason, ordered.note, ordered.confirmed_at,
    case
      when ordered.outcome = 'PARTIALLY_DELIVERED' then 'PARTIAL_CARRY_FORWARD'
      when ordered.outcome = 'NOT_DELIVERED' then 'NOT_DELIVERED_CARRY_FORWARD'
      when ordered.outcome = 'CHANGED' then 'CHANGED_REVIEW'
      when ordered.outcome = 'DELIVERED' then 'CLEAR'
      when ordered.ends_at <= now() then 'UNCONFIRMED'
      else 'SCHEDULED'
    end,
    case
      when ordered.previous_outcome = 'PARTIALLY_DELIVERED' then 'PARTIAL_CARRY_FORWARD'
      when ordered.previous_outcome = 'NOT_DELIVERED' then 'NOT_DELIVERED_CARRY_FORWARD'
      when ordered.previous_outcome = 'CHANGED' then 'CHANGED_REVIEW'
      else null
    end,
    ordered.previous_lesson_id,
    ordered.school_timezone,
    ((now() at time zone ordered.school_timezone)::date = ordered.scheduled_date),
    (ordered.ends_at <= now() and ordered.event_id is null and ordered.is_owner and ordered.has_teacher_role),
    (ordered.ends_at <= now() and ordered.event_id is not null and ordered.is_owner and ordered.has_teacher_role)
  from ordered
  where ordered.starts_at <= now() + interval '60 days'
    and ordered.ends_at >= now() - interval '30 days'
  order by ordered.starts_at, ordered.lesson_id;
$$;

revoke all on public.classroom_events from anon, authenticated;
grant select on public.classroom_events to authenticated;
revoke all on function private.prevent_classroom_event_mutation() from public;
revoke all on function private.classroom_event_can_read(uuid, uuid, uuid) from public;
grant execute on function private.classroom_event_can_read(uuid, uuid, uuid) to authenticated;
revoke all on function private.require_classroom_actor(uuid) from public;
revoke all on function private.current_classroom_event(uuid) from public;
revoke all on function public.confirm_classroom_outcome(uuid, text, text, text) from public;
revoke all on function public.correct_classroom_outcome(uuid, uuid, text, text, text) from public;
revoke all on function public.get_classroom_continuity(text) from public;
grant execute on function public.confirm_classroom_outcome(uuid, text, text, text) to authenticated;
grant execute on function public.correct_classroom_outcome(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.get_classroom_continuity(text) to authenticated;

alter table public.classroom_events enable row level security;
