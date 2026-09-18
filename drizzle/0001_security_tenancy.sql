create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  timezone text not null default 'Africa/Kampala',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  user_id uuid not null references auth.users(id),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  display_name text not null check (length(trim(display_name)) > 0),
  joined_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, user_id),
  unique (id, school_id)
);
create index memberships_user_status_idx on memberships (user_id, status);
create index memberships_school_status_idx on memberships (school_id, status);

create table departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null check (length(trim(name)) > 0),
  code text not null check (length(trim(code)) > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code),
  unique (school_id, name),
  unique (id, school_id)
);
create index departments_school_status_idx on departments (school_id, status);

create table role_grants (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null,
  school_id uuid not null,
  role text not null check (role in ('TEACHER', 'HOD', 'DOS', 'PRINCIPAL', 'SCHOOL_ADMIN')),
  scope_type text not null check (scope_type in ('SCHOOL', 'DEPARTMENT')),
  department_id uuid,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (membership_id, school_id) references memberships(id, school_id),
  foreign key (department_id, school_id) references departments(id, school_id),
  check ((scope_type = 'SCHOOL' and department_id is null) or (scope_type = 'DEPARTMENT' and department_id is not null)),
  unique (membership_id, role, scope_type, department_id)
);
create index role_grants_membership_status_idx on role_grants (membership_id, status);
create index role_grants_school_role_status_idx on role_grants (school_id, role, status);
create index role_grants_department_role_status_idx on role_grants (school_id, department_id, role, status);

create table academic_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null check (length(trim(name)) > 0),
  period_type text not null check (period_type in ('YEAR', 'TERM', 'SEMESTER', 'BREAK', 'CUSTOM')),
  academic_year integer not null check (academic_year between 2000 and 2200),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'CURRENT', 'CLOSED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (school_id, name, starts_on)
);
create index academic_periods_school_dates_idx on academic_periods (school_id, starts_on, ends_on);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  token_hash text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  intended_role text check (intended_role in ('TEACHER', 'HOD', 'DOS', 'PRINCIPAL', 'SCHOOL_ADMIN')),
  department_id uuid,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (department_id, school_id) references departments(id, school_id)
);
create index invitations_school_status_expiry_idx on invitations (school_id, status, expires_at);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  actor_user_id uuid references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  occurred_at timestamptz not null default now(),
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  before_state jsonb,
  after_state jsonb
);
create index audit_events_school_time_idx on audit_events (school_id, occurred_at desc);
create index audit_events_actor_time_idx on audit_events (actor_user_id, occurred_at desc);

create table school_files (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  bucket_id text not null check (bucket_id in ('school-files', 'school-exports', 'restricted-files')),
  object_path text not null,
  file_kind text not null,
  classification text not null check (classification in ('SCHOOL_INTERNAL', 'RESTRICTED')),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  checksum_sha256 text,
  uploaded_by uuid not null references auth.users(id),
  status text not null default 'ACTIVE' check (status in ('PENDING', 'ACTIVE', 'DELETED')),
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);
create index school_files_school_classification_idx on school_files (school_id, classification, status);

create or replace function private.current_user_id()
returns uuid language sql stable set search_path = '' as $$
  select auth.uid()
$$;

create or replace function private.is_active_school_member(target_school_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m join public.schools s on s.id = m.school_id
    where m.school_id = target_school_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and s.status = 'ACTIVE'
  )
$$;

create or replace function private.has_school_role(target_school_id uuid, required_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.role_grants rg
    join public.memberships m on m.id = rg.membership_id
    where rg.school_id = target_school_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and rg.status = 'ACTIVE'
      and rg.role = required_role
      and rg.scope_type = 'SCHOOL'
  )
$$;

create or replace function private.has_department_role(target_school_id uuid, target_department_id uuid, required_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.role_grants rg
    join public.memberships m on m.id = rg.membership_id
    where rg.school_id = target_school_id
      and rg.department_id = target_department_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and rg.status = 'ACTIVE'
      and rg.role = required_role
      and rg.scope_type = 'DEPARTMENT'
  )
$$;

create or replace function private.record_audit_event(
  target_school_id uuid, event_action text, target_resource_type text, target_resource_id uuid,
  event_metadata jsonb default '{}'::jsonb, event_before jsonb default null, event_after jsonb default null, correlation_id text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare event_id uuid;
begin
  if not (select private.is_active_school_member(target_school_id)) then
    raise exception 'active membership required';
  end if;
  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata, before_state, after_state, request_id)
  values (target_school_id, (select auth.uid()), event_action, target_resource_type, target_resource_id, coalesce(event_metadata, '{}'::jsonb), event_before, event_after, correlation_id)
  returning id into event_id;
  return event_id;
end
$$;

create or replace function private.accept_invitation(raw_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  invite public.invitations%rowtype;
  new_membership_id uuid;
  current_email text;
begin
  if (select auth.uid()) is null or raw_token is null or length(raw_token) < 32 then
    raise exception 'invalid invitation';
  end if;
  select email into current_email from auth.users where id = (select auth.uid());
  select * into invite from public.invitations
    where token_hash = encode(extensions.digest(raw_token::bytea, 'sha256'), 'hex')
      and status = 'PENDING' and expires_at > now()
    for update;
  if not found or lower(trim(current_email)) <> invite.email_normalized then
    raise exception 'invalid invitation';
  end if;
  insert into public.memberships (school_id, user_id, status, display_name, joined_at)
    values (invite.school_id, (select auth.uid()), 'ACTIVE', coalesce(nullif(trim(current_email), ''), invite.email_normalized), now())
    on conflict (school_id, user_id) do update set status = 'ACTIVE', joined_at = coalesce(public.memberships.joined_at, now()), deactivated_at = null
    returning id into new_membership_id;
  if invite.intended_role is not null then
    insert into public.role_grants (membership_id, school_id, role, scope_type, department_id, granted_by)
      values (new_membership_id, invite.school_id, invite.intended_role, case when invite.department_id is null then 'SCHOOL' else 'DEPARTMENT' end, invite.department_id, invite.created_by)
      on conflict (membership_id, role, scope_type, department_id) do update set status = 'ACTIVE', revoked_at = null;
  end if;
  update public.invitations set status = 'ACCEPTED', accepted_by = (select auth.uid()), accepted_at = now() where id = invite.id;
  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata)
    values (invite.school_id, (select auth.uid()), 'invitation.accepted', 'invitation', invite.id, jsonb_build_object('membership_id', new_membership_id));
  return invite.school_id;
end
$$;

create or replace function public.accept_invitation(raw_token text)
returns uuid language sql invoker set search_path = '' as $$
  select private.accept_invitation(raw_token)
$$;

revoke all on function private.current_user_id() from public;
revoke all on function private.is_active_school_member(uuid) from public;
revoke all on function private.has_school_role(uuid, text) from public;
revoke all on function private.has_department_role(uuid, uuid, text) from public;
revoke all on function private.record_audit_event(uuid, text, text, uuid, jsonb, jsonb, jsonb, text) from public;
revoke all on function private.accept_invitation(text) from public;
revoke all on function public.accept_invitation(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_id() to authenticated;
grant execute on function private.is_active_school_member(uuid) to authenticated;
grant execute on function private.has_school_role(uuid, text) to authenticated;
grant execute on function private.has_department_role(uuid, uuid, text) to authenticated;
grant execute on function private.record_audit_event(uuid, text, text, uuid, jsonb, jsonb, jsonb, text) to authenticated;
grant execute on function private.accept_invitation(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

alter table schools enable row level security;
alter table memberships enable row level security;
alter table departments enable row level security;
alter table role_grants enable row level security;
alter table academic_periods enable row level security;
alter table invitations enable row level security;
alter table audit_events enable row level security;
alter table school_files enable row level security;

revoke all on schools, memberships, departments, role_grants, academic_periods, invitations, audit_events, school_files from anon;
revoke all on schools, memberships, departments, role_grants, academic_periods, invitations, audit_events, school_files from authenticated;
grant select on schools, memberships, departments, role_grants, academic_periods, invitations, audit_events, school_files to authenticated;

create policy schools_read on schools for select to authenticated using ((select private.is_active_school_member(id)));
create policy memberships_read on memberships for select to authenticated using (user_id = (select auth.uid()) or (select private.has_school_role(school_id, 'SCHOOL_ADMIN')));
create policy memberships_admin_update on memberships for update to authenticated using ((select private.has_school_role(school_id, 'SCHOOL_ADMIN'))) with check (school_id = school_id and user_id = user_id);
create policy departments_read on departments for select to authenticated using ((select private.is_active_school_member(school_id)));
create policy role_grants_read on role_grants for select to authenticated using ((select private.is_active_school_member(school_id)));
create policy academic_periods_read on academic_periods for select to authenticated using ((select private.is_active_school_member(school_id)));
create policy invitations_admin_read on invitations for select to authenticated using ((select private.has_school_role(school_id, 'SCHOOL_ADMIN')));
create policy audit_events_read on audit_events for select to authenticated using ((select private.has_school_role(school_id, 'SCHOOL_ADMIN')) or (select private.has_school_role(school_id, 'PRINCIPAL')));
create policy school_files_read on school_files for select to authenticated using ((select private.is_active_school_member(school_id)));

revoke insert, update, delete on audit_events from authenticated;
revoke insert, update, delete on role_grants, departments, academic_periods, invitations, school_files, schools from authenticated;

create policy ate_private_objects_read on storage.objects for select to authenticated using (
  bucket_id in ('school-files', 'school-exports', 'restricted-files')
  and exists (select 1 from public.memberships m where m.school_id::text = split_part(storage.objects.name, '/', 1) and m.user_id = (select auth.uid()) and m.status = 'ACTIVE')
);
create policy ate_private_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('school-files', 'school-exports', 'restricted-files')
  and exists (select 1 from public.memberships m where m.school_id::text = split_part(storage.objects.name, '/', 1) and m.user_id = (select auth.uid()) and m.status = 'ACTIVE')
);
create policy ate_private_objects_delete on storage.objects for delete to authenticated using (
  bucket_id in ('school-files', 'school-exports', 'restricted-files')
  and exists (select 1 from public.memberships m where m.school_id::text = split_part(storage.objects.name, '/', 1) and m.user_id = (select auth.uid()) and m.status = 'ACTIVE')
);
