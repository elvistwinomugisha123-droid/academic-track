-- Fix Workstream E notification identity triggers so each trigger function only references columns present on its table.

drop trigger if exists notification_preferences_identity on public.notification_preferences;
drop trigger if exists push_subscriptions_identity on public.push_subscriptions;
drop trigger if exists notification_deliveries_identity on public.notification_deliveries;

drop function if exists private.protect_notification_identity();

create or replace function private.protect_notification_preferences_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.membership_id is distinct from old.membership_id
     or new.school_id is distinct from old.school_id
     or new.user_id is distinct from old.user_id then
    raise exception 'notification preference identity is immutable';
  end if;
  return new;
end
$$;

create or replace function private.protect_push_subscription_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.school_id is distinct from old.school_id
     or new.membership_id is distinct from old.membership_id
     or new.user_id is distinct from old.user_id
     or new.endpoint is distinct from old.endpoint
     or new.endpoint_sha256 is distinct from old.endpoint_sha256 then
    raise exception 'push subscription identity is immutable';
  end if;
  return new;
end
$$;

create or replace function private.protect_notification_delivery_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.school_id is distinct from old.school_id
     or new.membership_id is distinct from old.membership_id
     or new.subscription_id is distinct from old.subscription_id
     or new.idempotency_key is distinct from old.idempotency_key
     or new.notification_type is distinct from old.notification_type
     or new.scheduled_lesson_id is distinct from old.scheduled_lesson_id
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.deep_link is distinct from old.deep_link then
    raise exception 'notification delivery identity and payload are immutable';
  end if;
  return new;
end
$$;

create trigger notification_preferences_identity
before update on public.notification_preferences
for each row execute function private.protect_notification_preferences_identity();

create trigger push_subscriptions_identity
before update on public.push_subscriptions
for each row execute function private.protect_push_subscription_identity();

create trigger notification_deliveries_identity
before update on public.notification_deliveries
for each row execute function private.protect_notification_delivery_identity();

revoke all on function private.protect_notification_preferences_identity() from public, anon, authenticated;
revoke all on function private.protect_push_subscription_identity() from public, anon, authenticated;
revoke all on function private.protect_notification_delivery_identity() from public, anon, authenticated;
