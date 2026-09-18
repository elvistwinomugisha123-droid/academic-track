-- ATE v1 Step 4A: Academic Operations relational foundation.
-- This migration is intentionally additive. It must be reviewed before application.

alter table public.school_files
  add constraint school_files_id_school_unique unique (id, school_id);
alter table public.academic_periods
  add constraint academic_periods_id_school_unique unique (id, school_id);

create table public.class_levels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id) references public.schools(id),
  unique (id, school_id),
  unique (school_id, code)
);
create index class_levels_school_status_idx on public.class_levels (school_id, status, sort_order);

create table public.streams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_level_id uuid not null,
  code text,
  name text not null check (length(trim(name)) > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id) references public.schools(id),
  foreign key (class_level_id, school_id) references public.class_levels(id, school_id),
  unique (id, school_id),
  unique (id, class_level_id, school_id),
  unique (school_id, class_level_id, name),
  unique (school_id, class_level_id, code)
);
create index streams_school_level_status_idx on public.streams (school_id, class_level_id, status);

create table public.school_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  department_id uuid,
  code text,
  name text not null check (length(trim(name)) > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id) references public.schools(id),
  foreign key (department_id, school_id) references public.departments(id, school_id),
  unique (id, school_id),
  unique (school_id, name),
  unique (school_id, code)
);
create index school_subjects_school_department_idx on public.school_subjects (school_id, department_id, status);

create table public.teaching_sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_period_id uuid not null,
  teacher_membership_id uuid not null,
  school_subject_id uuid not null,
  class_level_id uuid not null,
  stream_id uuid not null,
  assignment_state text not null default 'PROPOSED' check (assignment_state in ('PROPOSED', 'CONFIRMED', 'FLAGGED')),
  operational_status text not null default 'ACTIVE' check (operational_status in ('ACTIVE', 'PAUSED', 'CLOSED')),
  confirmed_at timestamptz,
  flag_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id) references public.schools(id),
  foreign key (academic_period_id, school_id) references public.academic_periods(id, school_id),
  foreign key (teacher_membership_id, school_id) references public.memberships(id, school_id),
  foreign key (school_subject_id, school_id) references public.school_subjects(id, school_id),
  foreign key (class_level_id, school_id) references public.class_levels(id, school_id),
  foreign key (stream_id, class_level_id, school_id) references public.streams(id, class_level_id, school_id),
  unique (id, school_id),
  unique (id, academic_period_id, school_id),
  unique (id, school_subject_id, school_id),
  unique (school_id, academic_period_id, teacher_membership_id, school_subject_id, class_level_id, stream_id),
  check ((assignment_state = 'CONFIRMED' and confirmed_at is not null) or assignment_state <> 'CONFIRMED'),
  check ((assignment_state = 'FLAGGED' and length(trim(coalesce(flag_reason, ''))) > 0) or assignment_state <> 'FLAGGED')
);
create index teaching_sections_teacher_period_idx on public.teaching_sections (school_id, teacher_membership_id, academic_period_id, operational_status);
create index teaching_sections_subject_department_idx on public.teaching_sections (school_id, school_subject_id, operational_status);
create index teaching_sections_stream_period_idx on public.teaching_sections (school_id, stream_id, academic_period_id, operational_status);

create table public.timetable_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_period_id uuid not null,
  version_number integer not null check (version_number > 0),
  name text not null check (length(trim(name)) > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'VERIFIED', 'ACTIVE', 'RETIRED')),
  effective_from date not null,
  source_file_id uuid,
  created_by uuid not null references auth.users(id),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  activated_by uuid references auth.users(id),
  activated_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id) references public.schools(id),
  foreign key (academic_period_id, school_id) references public.academic_periods(id, school_id),
  foreign key (source_file_id, school_id) references public.school_files(id, school_id),
  unique (id, school_id),
  unique (id, academic_period_id, school_id),
  unique (school_id, academic_period_id, version_number),
  check ((status = 'VERIFIED' and verified_by is not null and verified_at is not null) or status <> 'VERIFIED'),
  check ((status = 'ACTIVE' and activated_by is not null and activated_at is not null) or status <> 'ACTIVE')
);
create unique index timetable_versions_one_active_idx
  on public.timetable_versions (school_id, academic_period_id)
  where status = 'ACTIVE';
create index timetable_versions_effective_idx on public.timetable_versions (school_id, academic_period_id, effective_from, status);

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  timetable_version_id uuid not null,
  teaching_section_id uuid not null,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  room_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id) references public.schools(id),
  foreign key (timetable_version_id, school_id) references public.timetable_versions(id, school_id),
  foreign key (teaching_section_id, school_id) references public.teaching_sections(id, school_id),
  unique (id, school_id),
  unique (id, timetable_version_id, teaching_section_id, school_id),
  check (ends_at > starts_at),
  unique (timetable_version_id, teaching_section_id, day_of_week, starts_at, school_id)
);
create index timetable_slots_version_day_idx on public.timetable_slots (school_id, timetable_version_id, day_of_week, starts_at);
create index timetable_slots_section_idx on public.timetable_slots (school_id, teaching_section_id, day_of_week, starts_at);

create table public.scheduled_lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_period_id uuid not null,
  teaching_section_id uuid not null,
  timetable_version_id uuid not null,
  timetable_slot_id uuid not null,
  scheduled_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  schedule_status text not null default 'SCHEDULED' check (schedule_status in ('SCHEDULED', 'CANCELLED', 'SUPERSEDED')),
  superseded_by_timetable_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id) references public.schools(id),
  foreign key (academic_period_id, school_id) references public.academic_periods(id, school_id),
  foreign key (teaching_section_id, academic_period_id, school_id) references public.teaching_sections(id, academic_period_id, school_id),
  foreign key (timetable_version_id, academic_period_id, school_id) references public.timetable_versions(id, academic_period_id, school_id),
  foreign key (timetable_slot_id, timetable_version_id, teaching_section_id, school_id) references public.timetable_slots(id, timetable_version_id, teaching_section_id, school_id),
  foreign key (superseded_by_timetable_version_id, school_id) references public.timetable_versions(id, school_id),
  unique (school_id, teaching_section_id, timetable_slot_id, scheduled_date),
  check (ends_at > starts_at),
  check ((schedule_status = 'SUPERSEDED') = (superseded_by_timetable_version_id is not null))
);
create index scheduled_lessons_teacher_date_idx on public.scheduled_lessons (school_id, teaching_section_id, scheduled_date, starts_at);
create index scheduled_lessons_version_date_idx on public.scheduled_lessons (school_id, timetable_version_id, scheduled_date);

create table public.school_programme_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_period_id uuid,
  event_type text not null check (event_type in ('HOLIDAY', 'ASSEMBLY', 'SPORTS', 'TRIP', 'VISITATION', 'EXAMINATION', 'MOCK', 'OTHER')),
  title text not null check (length(trim(title)) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'CANCELLED')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id) references public.schools(id),
  foreign key (academic_period_id, school_id) references public.academic_periods(id, school_id),
  unique (id, school_id),
  check (ends_at > starts_at)
);
create index school_programme_events_school_time_idx on public.school_programme_events (school_id, starts_at, ends_at, status);

create table public.programme_event_targets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  school_id uuid not null,
  class_level_id uuid,
  stream_id uuid,
  department_id uuid,
  created_at timestamptz not null default now(),
  foreign key (event_id, school_id) references public.school_programme_events(id, school_id) on delete cascade,
  foreign key (class_level_id, school_id) references public.class_levels(id, school_id),
  foreign key (stream_id, school_id) references public.streams(id, school_id),
  foreign key (department_id, school_id) references public.departments(id, school_id),
  check (((class_level_id is not null)::integer + (stream_id is not null)::integer + (department_id is not null)::integer) = 1),
  unique (id, school_id)
);
create unique index programme_event_targets_unique_target_idx on public.programme_event_targets (
  event_id,
  school_id,
  coalesce(class_level_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(stream_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index programme_event_targets_school_target_idx on public.programme_event_targets (school_id, class_level_id, stream_id, department_id);

create or replace function private.validate_operational_period(target_period_id uuid, target_school_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  period_record record;
begin
  select period_type, status into period_record
  from public.academic_periods
  where id = target_period_id and school_id = target_school_id;
  if not found or period_record.period_type not in ('TERM', 'SEMESTER', 'CUSTOM') then
    raise exception 'academic period must be an operational TERM, SEMESTER, or CUSTOM period';
  end if;
  if period_record.status in ('CLOSED', 'CANCELLED') then
    raise exception 'academic period is closed or cancelled';
  end if;
end
$$;

create or replace function private.validate_teaching_section_period()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform private.validate_operational_period(new.academic_period_id, new.school_id);
  return new;
end
$$;
create trigger teaching_sections_operational_period
before insert or update of academic_period_id, school_id on public.teaching_sections
for each row execute function private.validate_teaching_section_period();

create or replace function private.validate_timetable_version_period()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform private.validate_operational_period(new.academic_period_id, new.school_id);
  return new;
end
$$;
create trigger timetable_versions_operational_period
before insert or update of academic_period_id, school_id on public.timetable_versions
for each row execute function private.validate_timetable_version_period();

create or replace function private.validate_timetable_slot_context()
returns trigger language plpgsql set search_path = '' as $$
declare
  version_period uuid;
  section_period uuid;
begin
  select academic_period_id into version_period from public.timetable_versions where id = new.timetable_version_id and school_id = new.school_id;
  select academic_period_id into section_period from public.teaching_sections where id = new.teaching_section_id and school_id = new.school_id;
  if version_period is distinct from section_period then
    raise exception 'timetable version and teaching section must use the same academic period';
  end if;
  return new;
end
$$;
create trigger timetable_slots_context
before insert or update of timetable_version_id, teaching_section_id, school_id on public.timetable_slots
for each row execute function private.validate_timetable_slot_context();

create or replace function private.prevent_active_timetable_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.status = 'ACTIVE' then
    raise exception 'active timetable versions cannot be deleted';
  end if;
  if tg_op = 'UPDATE' and old.status = 'ACTIVE' and (
    new.school_id is distinct from old.school_id or new.academic_period_id is distinct from old.academic_period_id or
    new.version_number is distinct from old.version_number or new.name is distinct from old.name or
    new.effective_from is distinct from old.effective_from or new.source_file_id is distinct from old.source_file_id or
    new.created_by is distinct from old.created_by or new.verified_by is distinct from old.verified_by or
    new.verified_at is distinct from old.verified_at or new.activated_by is distinct from old.activated_by or
    new.activated_at is distinct from old.activated_at or new.notes is distinct from old.notes
  ) then
    raise exception 'active timetable versions are immutable; create a new draft';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;
create trigger timetable_versions_active_immutable
before update or delete on public.timetable_versions
for each row execute function private.prevent_active_timetable_mutation();

create or replace function private.prevent_active_timetable_slot_mutation()
returns trigger language plpgsql set search_path = '' as $$
declare
  version_status text;
begin
  if tg_op = 'DELETE' then
    select status into version_status from public.timetable_versions
    where id = old.timetable_version_id and school_id = old.school_id;
  else
    select status into version_status from public.timetable_versions
    where id = new.timetable_version_id and school_id = new.school_id;
  end if;
  if version_status = 'ACTIVE' then
    raise exception 'slots in an active timetable version are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;
create trigger timetable_slots_active_immutable
before insert or update or delete on public.timetable_slots
for each row execute function private.prevent_active_timetable_slot_mutation();

create or replace function private.prevent_scheduled_lesson_identity_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.school_id is distinct from old.school_id or new.academic_period_id is distinct from old.academic_period_id or
    new.teaching_section_id is distinct from old.teaching_section_id or new.timetable_version_id is distinct from old.timetable_version_id or
    new.timetable_slot_id is distinct from old.timetable_slot_id or new.scheduled_date is distinct from old.scheduled_date or
    new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    raise exception 'scheduled lesson identity and schedule intent are immutable';
  end if;
  return new;
end
$$;
create trigger scheduled_lessons_identity_immutable
before update on public.scheduled_lessons
for each row execute function private.prevent_scheduled_lesson_identity_mutation();

create or replace function private.is_membership_owner(target_school_id uuid, target_membership_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.schools s on s.id = m.school_id
    where m.id = target_membership_id and m.school_id = target_school_id
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and s.status = 'ACTIVE'
  )
$$;

revoke all on function private.validate_operational_period(uuid, uuid) from public;
revoke all on function private.is_membership_owner(uuid, uuid) from public;
grant execute on function private.is_membership_owner(uuid, uuid) to authenticated;

alter table public.class_levels enable row level security;
alter table public.streams enable row level security;
alter table public.school_subjects enable row level security;
alter table public.teaching_sections enable row level security;
alter table public.timetable_versions enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.scheduled_lessons enable row level security;
alter table public.school_programme_events enable row level security;
alter table public.programme_event_targets enable row level security;

revoke all on public.class_levels, public.streams, public.school_subjects, public.teaching_sections,
  public.timetable_versions, public.timetable_slots, public.scheduled_lessons,
  public.school_programme_events, public.programme_event_targets from anon;
revoke all on public.class_levels, public.streams, public.school_subjects, public.teaching_sections,
  public.timetable_versions, public.timetable_slots, public.scheduled_lessons,
  public.school_programme_events, public.programme_event_targets from authenticated;
grant select on public.class_levels, public.streams, public.school_subjects, public.teaching_sections,
  public.timetable_versions, public.timetable_slots, public.scheduled_lessons,
  public.school_programme_events, public.programme_event_targets to authenticated;
grant insert, update, delete on public.class_levels, public.streams, public.school_subjects,
  public.teaching_sections, public.timetable_versions, public.timetable_slots,
  public.school_programme_events, public.programme_event_targets to authenticated;

create policy class_levels_read on public.class_levels for select to authenticated using (private.is_active_school_member(school_id));
create policy class_levels_admin_write on public.class_levels for all to authenticated using (private.has_school_role(school_id, 'SCHOOL_ADMIN')) with check (private.has_school_role(school_id, 'SCHOOL_ADMIN'));
create policy streams_read on public.streams for select to authenticated using (private.is_active_school_member(school_id));
create policy streams_admin_write on public.streams for all to authenticated using (private.has_school_role(school_id, 'SCHOOL_ADMIN')) with check (private.has_school_role(school_id, 'SCHOOL_ADMIN'));
create policy school_subjects_read on public.school_subjects for select to authenticated using (private.is_active_school_member(school_id));
create policy school_subjects_admin_write on public.school_subjects for all to authenticated using (private.has_school_role(school_id, 'SCHOOL_ADMIN')) with check (private.has_school_role(school_id, 'SCHOOL_ADMIN'));

create policy teaching_sections_read on public.teaching_sections for select to authenticated using (
  private.is_active_school_member(school_id) and (
    private.is_membership_owner(school_id, teacher_membership_id) or
    private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN') or
    private.has_school_role(school_id, 'PRINCIPAL') or exists (
      select 1 from public.school_subjects subject
      where subject.id = school_subject_id and subject.school_id = school_id
        and private.has_department_role(school_id, subject.department_id, 'HOD')
    )
  )
);
create policy teaching_sections_manage on public.teaching_sections for all to authenticated using (
  private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN')
) with check (
  private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN')
);

create policy timetable_versions_read on public.timetable_versions for select to authenticated using (private.is_active_school_member(school_id));
create policy timetable_versions_manage on public.timetable_versions for all to authenticated using (
  private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN')
) with check (private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN'));

create policy timetable_slots_read on public.timetable_slots for select to authenticated using (
  exists (select 1 from public.teaching_sections section where section.id = teaching_section_id and section.school_id = school_id
    and (private.is_membership_owner(school_id, section.teacher_membership_id) or private.has_school_role(school_id, 'DOS')
      or private.has_school_role(school_id, 'SCHOOL_ADMIN') or private.has_school_role(school_id, 'PRINCIPAL') or exists (
        select 1 from public.school_subjects subject
        where subject.id = section.school_subject_id and subject.school_id = school_id
          and private.has_department_role(school_id, subject.department_id, 'HOD'))))
);
create policy timetable_slots_manage on public.timetable_slots for all to authenticated using (
  private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN')
) with check (private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN'));

create policy scheduled_lessons_read on public.scheduled_lessons for select to authenticated using (
  exists (select 1 from public.teaching_sections section where section.id = teaching_section_id and section.school_id = school_id
    and (private.is_membership_owner(school_id, section.teacher_membership_id) or private.has_school_role(school_id, 'DOS')
      or private.has_school_role(school_id, 'SCHOOL_ADMIN') or private.has_school_role(school_id, 'PRINCIPAL') or exists (
        select 1 from public.school_subjects subject
        where subject.id = section.school_subject_id and subject.school_id = school_id
          and private.has_department_role(school_id, subject.department_id, 'HOD'))))
);

create policy school_programme_events_read on public.school_programme_events for select to authenticated using (private.is_active_school_member(school_id));
create policy school_programme_events_manage on public.school_programme_events for all to authenticated using (
  private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN')
) with check (private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN'));
create policy programme_event_targets_read on public.programme_event_targets for select to authenticated using (private.is_active_school_member(school_id));
create policy programme_event_targets_manage on public.programme_event_targets for all to authenticated using (
  private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN')
) with check (private.has_school_role(school_id, 'DOS') or private.has_school_role(school_id, 'SCHOOL_ADMIN'));
