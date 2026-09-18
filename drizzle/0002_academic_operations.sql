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
  unique (school_id, class_level_id, code),
  check (code is null or length(trim(code)) > 0)
);
create index streams_school_level_status_idx on public.streams (school_id, class_level_id, status);
create unique index streams_normalized_name_idx on public.streams (school_id, class_level_id, lower(trim(name)));
create unique index streams_normalized_code_idx on public.streams (school_id, class_level_id, lower(trim(code))) where code is not null;

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
  unique (school_id, code),
  check (code is null or length(trim(code)) > 0)
);
create index school_subjects_school_department_idx on public.school_subjects (school_id, department_id, status);
create unique index class_levels_normalized_code_idx on public.class_levels (school_id, lower(trim(code)));
create unique index school_subjects_normalized_name_idx on public.school_subjects (school_id, lower(trim(name)));
create unique index school_subjects_normalized_code_idx on public.school_subjects (school_id, lower(trim(code))) where code is not null;

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
  foreign key (superseded_by_timetable_version_id, academic_period_id, school_id) references public.timetable_versions(id, academic_period_id, school_id),
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
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.validate_operational_period(new.academic_period_id, new.school_id);
  return new;
end
$$;
create trigger teaching_sections_operational_period
before insert or update of academic_period_id, school_id on public.teaching_sections
for each row execute function private.validate_teaching_section_period();

create or replace function private.validate_timetable_version_period()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.validate_operational_period(new.academic_period_id, new.school_id);
  return new;
end
$$;
create trigger timetable_versions_operational_period
before insert or update of academic_period_id, school_id on public.timetable_versions
for each row execute function private.validate_timetable_version_period();

create or replace function private.validate_timetable_slot_context()
returns trigger language plpgsql security definer set search_path = '' as $$
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

create or replace function private.prevent_academic_operations_identity_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.school_id is distinct from old.school_id then
    raise exception 'academic operations tenant identity is immutable';
  end if;
  case tg_table_name
    when 'streams' then
      if new.class_level_id is distinct from old.class_level_id then raise exception 'stream class/level identity is immutable'; end if;
    when 'teaching_sections' then
      if new.academic_period_id is distinct from old.academic_period_id or new.teacher_membership_id is distinct from old.teacher_membership_id or
        new.school_subject_id is distinct from old.school_subject_id or new.class_level_id is distinct from old.class_level_id or
        new.stream_id is distinct from old.stream_id then raise exception 'Teaching Section identity is immutable; create a successor section'; end if;
    when 'timetable_versions' then
      if new.academic_period_id is distinct from old.academic_period_id or new.version_number is distinct from old.version_number then raise exception 'timetable version identity is immutable'; end if;
    when 'timetable_slots' then
      if new.timetable_version_id is distinct from old.timetable_version_id or new.teaching_section_id is distinct from old.teaching_section_id then raise exception 'timetable slot ownership is immutable'; end if;
    when 'school_programme_events' then
      if new.academic_period_id is distinct from old.academic_period_id then raise exception 'programme event period identity is immutable'; end if;
    when 'programme_event_targets' then
      if new.event_id is distinct from old.event_id or new.class_level_id is distinct from old.class_level_id or new.stream_id is distinct from old.stream_id or new.department_id is distinct from old.department_id then raise exception 'programme event target identity is immutable'; end if;
    else null;
  end case;
  return new;
end
$$;

create trigger class_levels_identity_immutable before update on public.class_levels for each row execute function private.prevent_academic_operations_identity_change();
create trigger streams_identity_immutable before update on public.streams for each row execute function private.prevent_academic_operations_identity_change();
create trigger school_subjects_identity_immutable before update on public.school_subjects for each row execute function private.prevent_academic_operations_identity_change();
create trigger teaching_sections_identity_immutable before update on public.teaching_sections for each row execute function private.prevent_academic_operations_identity_change();
create trigger timetable_versions_identity_immutable before update on public.timetable_versions for each row execute function private.prevent_academic_operations_identity_change();
create trigger timetable_slots_identity_immutable before update on public.timetable_slots for each row execute function private.prevent_academic_operations_identity_change();
create trigger school_programme_events_identity_immutable before update on public.school_programme_events for each row execute function private.prevent_academic_operations_identity_change();
create trigger programme_event_targets_identity_immutable before update on public.programme_event_targets for each row execute function private.prevent_academic_operations_identity_change();

create or replace function private.enforce_academic_operations_actor()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (select auth.uid()) is not null then
    if new.created_by is distinct from (select auth.uid()) then raise exception 'created_by must be the authenticated actor'; end if;
  elsif tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable';
  end if;
  return new;
end
$$;
create trigger teaching_sections_actor before insert or update on public.teaching_sections for each row execute function private.enforce_academic_operations_actor();
create trigger timetable_versions_actor before insert or update on public.timetable_versions for each row execute function private.enforce_academic_operations_actor();
create trigger school_programme_events_actor before insert or update on public.school_programme_events for each row execute function private.enforce_academic_operations_actor();

create or replace function private.enforce_teaching_section_assignment_command()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null and (new.assignment_state <> 'PROPOSED' or new.confirmed_at is not null or new.flag_reason is not null) then
      raise exception 'new Teaching Sections must begin PROPOSED with no confirmation fields';
    end if;
  elsif new.assignment_state is distinct from old.assignment_state or new.confirmed_at is distinct from old.confirmed_at or new.flag_reason is distinct from old.flag_reason then
    if current_setting('app.ate_command', true) <> 'confirm_teaching_section_assignment' then
      raise exception 'Teaching Section assignment confirmation is command-controlled';
    end if;
  end if;
  return new;
end
$$;
create trigger teaching_sections_assignment_command
before insert or update on public.teaching_sections
for each row execute function private.enforce_teaching_section_assignment_command();

create or replace function private.enforce_timetable_version_lifecycle()
returns trigger language plpgsql set search_path = '' as $$
declare
  command_name text := current_setting('app.ate_command', true);
  actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' then raise exception 'new timetable versions must start as DRAFT'; end if;
    if (select auth.uid()) is not null and (new.verified_by is not null or new.verified_at is not null or new.activated_by is not null or new.activated_at is not null) then
      raise exception 'verification and activation authorship are command-controlled';
    end if;
    return new;
  end if;
  if new.verified_by is distinct from old.verified_by or new.verified_at is distinct from old.verified_at then
    if command_name <> 'verify_timetable_version' or actor is null or new.verified_by is distinct from actor then raise exception 'verification authorship is command-controlled'; end if;
  end if;
  if new.activated_by is distinct from old.activated_by or new.activated_at is distinct from old.activated_at then
    if command_name <> 'activate_timetable_version' or actor is null or new.activated_by is distinct from actor then raise exception 'activation authorship is command-controlled'; end if;
  end if;
  if old.status = 'RETIRED' and new.status <> 'RETIRED' then raise exception 'retired timetable versions cannot transition'; end if;
  if old.status = 'DRAFT' and new.status not in ('DRAFT', 'VERIFIED', 'RETIRED') then raise exception 'invalid timetable lifecycle transition'; end if;
  if old.status = 'VERIFIED' and new.status not in ('VERIFIED', 'ACTIVE', 'RETIRED') then raise exception 'invalid timetable lifecycle transition'; end if;
  if old.status = 'ACTIVE' and new.status not in ('ACTIVE', 'RETIRED') then raise exception 'invalid timetable lifecycle transition'; end if;
  if old.status = 'ACTIVE' and new.status = 'RETIRED' and command_name <> 'activate_timetable_version' then raise exception 'active timetable retirement must be part of activation'; end if;
  if old.status = 'DRAFT' and new.status = 'VERIFIED' and command_name <> 'verify_timetable_version' then raise exception 'verification must use the verification command'; end if;
  if old.status = 'VERIFIED' and new.status = 'ACTIVE' and command_name <> 'activate_timetable_version' then raise exception 'activation must use the activation command'; end if;
  if new.status = 'VERIFIED' and (new.verified_by is null or new.verified_at is null) then raise exception 'VERIFIED timetable versions require verification metadata'; end if;
  if new.status = 'ACTIVE' and (new.verified_by is null or new.verified_at is null or new.activated_by is null or new.activated_at is null) then raise exception 'ACTIVE timetable versions require verification and activation metadata'; end if;
  return new;
end
$$;
create trigger timetable_versions_lifecycle before insert or update on public.timetable_versions for each row execute function private.enforce_timetable_version_lifecycle();

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
  old_version_status text;
  new_version_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into old_version_status from public.timetable_versions where id = old.timetable_version_id and school_id = old.school_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select status into new_version_status from public.timetable_versions where id = new.timetable_version_id and school_id = new.school_id;
  end if;
  if old_version_status = 'ACTIVE' or new_version_status = 'ACTIVE' then raise exception 'slots in active timetable versions are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
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

create or replace function private.validate_timetable_version_ready(target_version_id uuid, target_school_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  version_record record;
  slot_count integer;
begin
  select v.id, v.school_id, v.academic_period_id, v.effective_from, p.starts_on, p.ends_on, p.period_type, p.status
    into version_record
  from public.timetable_versions v
  join public.academic_periods p on p.id = v.academic_period_id and p.school_id = v.school_id
  where v.id = target_version_id and v.school_id = target_school_id;
  if not found then raise exception 'timetable version not found in school'; end if;
  if version_record.period_type not in ('TERM', 'SEMESTER', 'CUSTOM') or version_record.status in ('CLOSED', 'CANCELLED') then raise exception 'timetable requires an open operational academic period'; end if;
  if version_record.effective_from < version_record.starts_on or version_record.effective_from > version_record.ends_on then raise exception 'timetable effective date must be inside the academic period'; end if;
  select count(*) into slot_count from public.timetable_slots where timetable_version_id = target_version_id and school_id = target_school_id;
  if slot_count = 0 then raise exception 'timetable version must contain at least one slot'; end if;
  if exists (
    select 1 from public.timetable_slots a
    join public.timetable_slots b on b.timetable_version_id = a.timetable_version_id and b.school_id = a.school_id and b.id > a.id and b.day_of_week = a.day_of_week
      and a.starts_at < b.ends_at and b.starts_at < a.ends_at
    join public.teaching_sections sa on sa.id = a.teaching_section_id and sa.school_id = a.school_id
    join public.teaching_sections sb on sb.id = b.teaching_section_id and sb.school_id = b.school_id
    where a.timetable_version_id = target_version_id and a.school_id = target_school_id
      and (sa.teacher_membership_id = sb.teacher_membership_id or (sa.class_level_id = sb.class_level_id and sa.stream_id = sb.stream_id))
  ) then raise exception 'timetable contains an overlapping teacher or stream slot'; end if;
  if exists (
    select 1 from public.timetable_slots s
    join public.teaching_sections section on section.id = s.teaching_section_id and section.school_id = s.school_id
    where s.timetable_version_id = target_version_id and s.school_id = target_school_id
      and (section.assignment_state <> 'CONFIRMED' or section.operational_status <> 'ACTIVE' or section.academic_period_id <> version_record.academic_period_id)
  ) then raise exception 'all timetable sections must be confirmed, active, and in the same period'; end if;
end
$$;

create or replace function public.confirm_teaching_section_assignment(p_section_id uuid, p_decision text, p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  section_record record;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required'; end if;
  if p_decision not in ('CONFIRMED', 'FLAGGED') then raise exception 'invalid Teaching Section decision'; end if;
  if p_decision = 'FLAGGED' and length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'flagged assignments require a reason'; end if;
  select ts.id, ts.school_id, ts.assignment_state, ts.teacher_membership_id, m.user_id
    into section_record
  from public.teaching_sections ts
  join public.memberships m on m.id = ts.teacher_membership_id and m.school_id = ts.school_id
  where ts.id = p_section_id
  for update of ts;
  if not found then raise exception 'Teaching Section not found'; end if;
  if not private.is_active_school_member(section_record.school_id) or section_record.user_id <> actor then raise exception 'only the assigned active teacher may confirm this section'; end if;
  if not private.has_school_role(section_record.school_id, 'TEACHER') then raise exception 'an active TEACHER grant is required'; end if;
  if section_record.assignment_state <> 'PROPOSED' then raise exception 'only proposed Teaching Sections may be confirmed or flagged'; end if;
  perform set_config('app.ate_command', 'confirm_teaching_section_assignment', true);
  update public.teaching_sections
    set assignment_state = p_decision,
        confirmed_at = case when p_decision = 'CONFIRMED' then now() else null end,
        flag_reason = case when p_decision = 'FLAGGED' then trim(p_reason) else null end,
        updated_at = now()
  where id = p_section_id;
  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
    values (section_record.school_id, actor, 'teaching_section.assignment_' || lower(p_decision), 'teaching_section', p_section_id,
      jsonb_build_object('decision', p_decision), jsonb_build_object('assignment_state', p_decision));
  return p_section_id;
end
$$;

create or replace function public.verify_timetable_version(p_version_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  version_record record;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required'; end if;
  select id, school_id, status into version_record from public.timetable_versions where id = p_version_id for update;
  if not found then raise exception 'timetable version not found'; end if;
  if not private.has_school_role(version_record.school_id, 'DOS') then raise exception 'DOS authority required'; end if;
  if version_record.status <> 'DRAFT' then raise exception 'only DRAFT timetable versions may be verified'; end if;
  perform private.validate_timetable_version_ready(p_version_id, version_record.school_id);
  perform set_config('app.ate_command', 'verify_timetable_version', true);
  update public.timetable_versions set status = 'VERIFIED', verified_by = actor, verified_at = now(), updated_at = now() where id = p_version_id;
  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
    values (version_record.school_id, actor, 'timetable_version.verified', 'timetable_version', p_version_id, '{}'::jsonb, jsonb_build_object('status', 'VERIFIED', 'verified_by', actor));
  return p_version_id;
end
$$;

create or replace function public.activate_timetable_version(p_version_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  version_record record;
  old_version record;
  slot_record record;
  occurrence_date date;
  generation_start date;
  replacement_boundary timestamptz;
  occurrence_starts_at timestamptz;
  occurrence_ends_at timestamptz;
  had_previous_active boolean := false;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required'; end if;
  select v.id, v.school_id, v.academic_period_id, v.status, v.verified_by, v.verified_at, p.starts_on, p.ends_on, s.timezone
    into version_record
  from public.timetable_versions v
  join public.academic_periods p on p.id = v.academic_period_id and p.school_id = v.school_id
  join public.schools s on s.id = v.school_id
  where v.id = p_version_id
  for update of v;
  if not found then raise exception 'timetable version not found'; end if;
  if not private.has_school_role(version_record.school_id, 'DOS') then raise exception 'DOS authority required'; end if;
  if version_record.status <> 'VERIFIED' then raise exception 'only VERIFIED timetable versions may be activated'; end if;
  if version_record.verified_by is null or version_record.verified_at is null then raise exception 'timetable verification metadata is required'; end if;
  perform private.validate_timetable_version_ready(p_version_id, version_record.school_id);
  perform set_config('app.ate_command', 'activate_timetable_version', true);
  replacement_boundary := greatest(now(), ((select effective_from from public.timetable_versions where id = p_version_id)::timestamp at time zone version_record.timezone));
  for old_version in select id from public.timetable_versions where school_id = version_record.school_id and academic_period_id = version_record.academic_period_id and status = 'ACTIVE' and id <> p_version_id for update loop
    had_previous_active := true;
    update public.scheduled_lessons
      set schedule_status = 'SUPERSEDED', superseded_by_timetable_version_id = p_version_id, updated_at = now()
    where school_id = version_record.school_id and timetable_version_id = old_version.id and schedule_status = 'SCHEDULED' and starts_at >= replacement_boundary;
    update public.timetable_versions set status = 'RETIRED', updated_at = now() where id = old_version.id;
  end loop;
  update public.timetable_versions set status = 'ACTIVE', activated_by = actor, activated_at = now(), updated_at = now() where id = p_version_id;
  generation_start := greatest(version_record.starts_on, (select effective_from from public.timetable_versions where id = p_version_id));
  if had_previous_active then generation_start := greatest(generation_start, (replacement_boundary at time zone version_record.timezone)::date); end if;
  for slot_record in
    select slot.id, slot.day_of_week, slot.starts_at, slot.ends_at, slot.teaching_section_id
    from public.timetable_slots slot
    where slot.timetable_version_id = p_version_id and slot.school_id = version_record.school_id
  loop
    for occurrence_date in select generated::date from generate_series(generation_start::timestamp, version_record.ends_on::timestamp, interval '1 day') generated loop
      if extract(isodow from occurrence_date) = slot_record.day_of_week then
        occurrence_starts_at := ((occurrence_date::timestamp + slot_record.starts_at) at time zone version_record.timezone);
        occurrence_ends_at := ((occurrence_date::timestamp + slot_record.ends_at) at time zone version_record.timezone);
        if not had_previous_active or occurrence_starts_at >= replacement_boundary then
        insert into public.scheduled_lessons (school_id, academic_period_id, teaching_section_id, timetable_version_id, timetable_slot_id, scheduled_date, starts_at, ends_at, schedule_status)
          values (version_record.school_id, version_record.academic_period_id, slot_record.teaching_section_id, p_version_id, slot_record.id, occurrence_date,
            occurrence_starts_at, occurrence_ends_at, 'SCHEDULED')
          on conflict (school_id, teaching_section_id, timetable_slot_id, scheduled_date) do nothing;
        end if;
      end if;
    end loop;
  end loop;
  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
    values (version_record.school_id, actor, 'timetable_version.activated', 'timetable_version', p_version_id,
      jsonb_build_object('academic_period_id', version_record.academic_period_id), jsonb_build_object('status', 'ACTIVE', 'activated_by', actor));
  return p_version_id;
end
$$;

create or replace function public.find_programme_event_overlaps(p_scheduled_lesson_id uuid)
returns table (event_id uuid, event_type text, title text, starts_at timestamptz, ends_at timestamptz, target_scope text)
language sql stable security invoker set search_path = '' as $$
  select distinct e.id, e.event_type, e.title, e.starts_at, e.ends_at,
    case when not exists (select 1 from public.programme_event_targets empty_target where empty_target.event_id = e.id and empty_target.school_id = e.school_id) then 'SCHOOL' else 'TARGETED' end
  from public.scheduled_lessons lesson
  join public.teaching_sections section on section.id = lesson.teaching_section_id and section.school_id = lesson.school_id
  join public.school_subjects subject on subject.id = section.school_subject_id and subject.school_id = section.school_id
  join public.school_programme_events e on e.school_id = lesson.school_id and e.status = 'SCHEDULED' and e.starts_at < lesson.ends_at and e.ends_at > lesson.starts_at
  where lesson.id = p_scheduled_lesson_id
    and private.is_active_school_member(lesson.school_id)
    and (not exists (select 1 from public.programme_event_targets target where target.event_id = e.id and target.school_id = e.school_id)
      or exists (select 1 from public.programme_event_targets target where target.event_id = e.id and target.school_id = e.school_id
        and (target.class_level_id = section.class_level_id or target.stream_id = section.stream_id or target.department_id = subject.department_id)))
$$;

revoke all on function private.validate_operational_period(uuid, uuid) from public;
revoke all on function private.is_membership_owner(uuid, uuid) from public;
revoke all on function private.validate_teaching_section_period() from public;
revoke all on function private.validate_timetable_version_period() from public;
revoke all on function private.validate_timetable_slot_context() from public;
revoke all on function private.prevent_academic_operations_identity_change() from public;
revoke all on function private.enforce_academic_operations_actor() from public;
revoke all on function private.enforce_teaching_section_assignment_command() from public;
revoke all on function private.enforce_timetable_version_lifecycle() from public;
revoke all on function private.prevent_active_timetable_mutation() from public;
revoke all on function private.prevent_active_timetable_slot_mutation() from public;
revoke all on function private.prevent_scheduled_lesson_identity_mutation() from public;
revoke all on function private.validate_timetable_version_ready(uuid, uuid) from public;
grant execute on function private.is_membership_owner(uuid, uuid) to authenticated;

revoke all on function public.confirm_teaching_section_assignment(uuid, text, text) from public;
revoke all on function public.verify_timetable_version(uuid) from public;
revoke all on function public.activate_timetable_version(uuid) from public;
revoke all on function public.find_programme_event_overlaps(uuid) from public;
grant execute on function public.confirm_teaching_section_assignment(uuid, text, text) to authenticated;
grant execute on function public.verify_timetable_version(uuid) to authenticated;
grant execute on function public.activate_timetable_version(uuid) to authenticated;
grant execute on function public.find_programme_event_overlaps(uuid) to authenticated;

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
grant insert, update on public.class_levels, public.streams, public.school_subjects,
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
