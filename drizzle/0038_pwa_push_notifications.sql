-- Workstream E: tenant-scoped Web Push subscriptions, preferences and durable delivery history.

create table public.notification_preferences (
  membership_id uuid primary key,
  school_id uuid not null,
  user_id uuid not null,
  notifications_enabled boolean not null default false,
  morning_brief_enabled boolean not null default true,
  upcoming_lesson_enabled boolean not null default true,
  recovery_alert_enabled boolean not null default true,
  missing_record_enabled boolean not null default true,
  morning_brief_time time not null default '06:30',
  upcoming_lead_minutes integer not null default 20 check (upcoming_lead_minutes between 5 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (membership_id, school_id) references public.memberships(id, school_id) on delete cascade,
  foreign key (user_id) references auth.users(id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  membership_id uuid not null,
  user_id uuid not null,
  endpoint text not null check (endpoint ~ '^https://(fcm.googleapis.com|updates.push.services.mozilla.com|web.push.apple.com)/'),
  endpoint_sha256 text not null check (endpoint_sha256 ~ '^[0-9a-f]{64}$'),
  p256dh text not null check (char_length(p256dh) between 40 and 180),
  auth_secret text not null check (char_length(auth_secret) between 16 and 100),
  user_agent text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','EXPIRED','REVOKED')),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membership_id, endpoint_sha256),
  unique (id, school_id),
  foreign key (membership_id, school_id) references public.memberships(id, school_id) on delete cascade,
  foreign key (user_id) references auth.users(id)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  membership_id uuid not null,
  subscription_id uuid not null,
  notification_type text not null check (notification_type in ('MORNING_BRIEF','UPCOMING_LESSON','RECOVERY_ALERT','MISSING_CLASSROOM_RECORD')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 20 and 200),
  scheduled_lesson_id uuid,
  local_date date not null,
  scheduled_for timestamptz not null,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 180),
  deep_link text not null check (deep_link ~ '^/workspace(?:/|$)'),
  status text not null default 'PENDING' check (status in ('PENDING','SENDING','SENT','RETRYABLE','PERMANENT_FAILURE')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  provider_status integer,
  error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (membership_id, school_id) references public.memberships(id, school_id) on delete cascade,
  foreign key (subscription_id, school_id) references public.push_subscriptions(id, school_id) on delete cascade,
  foreign key (scheduled_lesson_id, school_id) references public.scheduled_lessons(id, school_id)
);

create index push_subscriptions_active_idx on public.push_subscriptions (school_id, membership_id) where status='ACTIVE';
create index notification_deliveries_due_idx on public.notification_deliveries (status, scheduled_for) where status in ('PENDING','RETRYABLE');
create index notification_deliveries_membership_idx on public.notification_deliveries (school_id, membership_id, created_at desc);

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on public.notification_preferences, public.push_subscriptions, public.notification_deliveries from public, anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.notification_deliveries to authenticated;

create or replace function private.is_teacher_notification_owner(target_school_id uuid, target_membership_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_membership_owner(target_school_id,target_membership_id)
    and exists(select 1 from public.role_grants rg where rg.school_id=target_school_id and rg.membership_id=target_membership_id and rg.role='TEACHER' and rg.status='ACTIVE')
$$;
revoke all on function private.is_teacher_notification_owner(uuid,uuid) from public, anon;
grant execute on function private.is_teacher_notification_owner(uuid,uuid) to authenticated;

create policy notification_preferences_own_read on public.notification_preferences for select to authenticated
  using (private.is_teacher_notification_owner(school_id, membership_id) and user_id=(select auth.uid()));
create policy notification_preferences_own_insert on public.notification_preferences for insert to authenticated
  with check (private.is_teacher_notification_owner(school_id, membership_id) and user_id=(select auth.uid()));
create policy notification_preferences_own_update on public.notification_preferences for update to authenticated
  using (private.is_teacher_notification_owner(school_id, membership_id) and user_id=(select auth.uid()))
  with check (private.is_teacher_notification_owner(school_id, membership_id) and user_id=(select auth.uid()));

create policy push_subscriptions_own_read on public.push_subscriptions for select to authenticated
  using (private.is_teacher_notification_owner(school_id, membership_id) and user_id=(select auth.uid()));
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated
  with check (private.is_teacher_notification_owner(school_id, membership_id) and user_id=(select auth.uid()));
create policy push_subscriptions_own_update on public.push_subscriptions for update to authenticated
  using (private.is_teacher_notification_owner(school_id, membership_id) and user_id=(select auth.uid()))
  with check (private.is_teacher_notification_owner(school_id, membership_id) and user_id=(select auth.uid()));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated
  using (private.is_teacher_notification_owner(school_id, membership_id) and user_id=(select auth.uid()));

create policy notification_deliveries_own_read on public.notification_deliveries for select to authenticated
  using (private.is_teacher_notification_owner(school_id, membership_id));

create or replace function private.protect_notification_identity()
returns trigger language plpgsql set search_path = '' as $$ begin
  if tg_table_name='notification_preferences' and (new.membership_id is distinct from old.membership_id or new.school_id is distinct from old.school_id or new.user_id is distinct from old.user_id) then raise exception 'notification preference identity is immutable'; end if;
  if tg_table_name='push_subscriptions' and (new.school_id is distinct from old.school_id or new.membership_id is distinct from old.membership_id or new.user_id is distinct from old.user_id or new.endpoint is distinct from old.endpoint or new.endpoint_sha256 is distinct from old.endpoint_sha256) then raise exception 'push subscription identity is immutable'; end if;
  if tg_table_name='notification_deliveries' and (new.school_id is distinct from old.school_id or new.membership_id is distinct from old.membership_id or new.subscription_id is distinct from old.subscription_id or new.idempotency_key is distinct from old.idempotency_key or new.notification_type is distinct from old.notification_type or new.scheduled_lesson_id is distinct from old.scheduled_lesson_id or new.title is distinct from old.title or new.body is distinct from old.body or new.deep_link is distinct from old.deep_link) then raise exception 'notification delivery identity and payload are immutable'; end if;
  return new;
end $$;
create trigger notification_preferences_identity before update on public.notification_preferences for each row execute function private.protect_notification_identity();
create trigger push_subscriptions_identity before update on public.push_subscriptions for each row execute function private.protect_notification_identity();
create trigger notification_deliveries_identity before update on public.notification_deliveries for each row execute function private.protect_notification_identity();

create or replace function private.touch_notification_record()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end $$;
create trigger notification_preferences_touch before update on public.notification_preferences for each row execute function private.touch_notification_record();
create trigger push_subscriptions_touch before update on public.push_subscriptions for each row execute function private.touch_notification_record();
create trigger notification_deliveries_touch before update on public.notification_deliveries for each row execute function private.touch_notification_record();

revoke all on function private.protect_notification_identity(), private.touch_notification_record() from public, anon, authenticated;
