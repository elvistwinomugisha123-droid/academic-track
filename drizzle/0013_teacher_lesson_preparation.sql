-- Step 7: lightweight, server-persisted Lesson Readiness preparation.
-- Preparation is editable teacher work, while classroom evidence and curriculum
-- position events remain append-only canonical facts.

create table public.lesson_preparations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  scheduled_lesson_id uuid not null,
  teaching_section_id uuid not null,
  curriculum_position_event_id uuid,
  curriculum_canonical_id text,
  curriculum_profile_id uuid,
  lesson_focus text not null default '' check (length(lesson_focus) <= 240),
  teacher_notes text not null default '' check (length(teacher_notes) <= 2000),
  intended_coverage text not null default '' check (length(intended_coverage) <= 1200),
  preparation_notes text not null default '' check (length(preparation_notes) <= 1200),
  context_snapshot jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  unique (school_id, scheduled_lesson_id),
  foreign key (scheduled_lesson_id, school_id) references public.scheduled_lessons(id, school_id),
  foreign key (teaching_section_id, school_id) references public.teaching_sections(id, school_id),
  foreign key (curriculum_position_event_id, school_id) references public.teaching_section_curriculum_position_events(id, school_id),
  check (curriculum_canonical_id is null or length(trim(curriculum_canonical_id)) > 0)
);

create index lesson_preparations_section_idx on public.lesson_preparations (school_id, teaching_section_id, updated_at desc);
create index lesson_preparations_lesson_idx on public.lesson_preparations (school_id, scheduled_lesson_id);

create or replace function private.can_manage_lesson_preparation(target_school_id uuid, target_section_id uuid, target_lesson_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_school_member(target_school_id)
    and exists (
      select 1
      from public.scheduled_lessons lesson
      join public.teaching_sections section
        on section.id = lesson.teaching_section_id
       and section.school_id = lesson.school_id
      join public.memberships membership
        on membership.id = section.teacher_membership_id
       and membership.school_id = section.school_id
      join public.role_grants grant_row
        on grant_row.membership_id = membership.id
       and grant_row.school_id = membership.school_id
      where lesson.id = target_lesson_id
        and lesson.school_id = target_school_id
        and lesson.teaching_section_id = target_section_id
        and section.assignment_state = 'CONFIRMED'
        and section.operational_status = 'ACTIVE'
        and membership.user_id = (select auth.uid())
        and membership.status = 'ACTIVE'
        and grant_row.role = 'TEACHER'
        and grant_row.scope_type = 'SCHOOL'
        and grant_row.status = 'ACTIVE'
    )
$$;

create or replace function private.touch_lesson_preparation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.school_id <> old.school_id
     or new.scheduled_lesson_id <> old.scheduled_lesson_id
     or new.teaching_section_id <> old.teaching_section_id
     or new.created_by <> old.created_by then
    raise exception 'lesson preparation ownership is immutable';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end
$$;

create trigger lesson_preparations_touch before update on public.lesson_preparations
for each row execute function private.touch_lesson_preparation();

alter table public.lesson_preparations enable row level security;
revoke all on public.lesson_preparations from anon, authenticated;
grant select, insert, update on public.lesson_preparations to authenticated;

create policy lesson_preparations_read on public.lesson_preparations
for select to authenticated
using (private.can_manage_lesson_preparation(school_id, teaching_section_id, scheduled_lesson_id));

create policy lesson_preparations_insert on public.lesson_preparations
for insert to authenticated
with check (
  private.can_manage_lesson_preparation(school_id, teaching_section_id, scheduled_lesson_id)
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy lesson_preparations_update on public.lesson_preparations
for update to authenticated
using (private.can_manage_lesson_preparation(school_id, teaching_section_id, scheduled_lesson_id))
with check (
  private.can_manage_lesson_preparation(school_id, teaching_section_id, scheduled_lesson_id)
  and updated_by = (select auth.uid())
);

revoke all on function private.can_manage_lesson_preparation(uuid, uuid, uuid) from public;
revoke all on function private.touch_lesson_preparation() from public;
grant execute on function private.can_manage_lesson_preparation(uuid, uuid, uuid) to authenticated;
