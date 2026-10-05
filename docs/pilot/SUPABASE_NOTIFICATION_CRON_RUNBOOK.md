# Supabase notification Cron operator runbook

**Purpose:** invoke ATE's existing protected notification scheduler every five minutes without relying on a Vercel Cron plan.

**Architecture:** Supabase `pg_cron` → `pg_net` HTTPS GET → ATE `/api/cron/notifications` → deterministic notification scheduler.

This is an operator procedure, not an application migration. Run it in TEST first and only repeat it in the dedicated pilot Supabase project after TEST evidence is accepted. Do not put the deployment URL or cron credential in Git, migration files, shell history, query history, or a `NEXT_PUBLIC_*` variable.

## Fixed configuration names

| Item | Required value |
|---|---|
| Cron job | `ate-notification-scheduler` |
| Schedule | `*/5 * * * *` |
| URL Vault secret name | `ate_notification_scheduler_url` |
| Credential Vault secret name | `ate_notification_cron_secret` |
| Target path | `/api/cron/notifications` |
| Authentication | `Authorization: Bearer <CRON_SECRET>` |

The URL secret must be the canonical HTTPS deployment URL including the exact target path. The credential secret must exactly match the server-only `CRON_SECRET` configured for that deployment.

## 1. Configure the application secret

Generate a high-entropy secret of at least 32 characters in an approved secret manager. Add it to the target Vercel deployment as the server-only environment variable `CRON_SECRET`. Never prefix it with `NEXT_PUBLIC_`. Redeploy so the protected route receives the value.

## 2. Enable Supabase modules

In **Supabase Dashboard → Integrations → Cron**, enable Cron (`pg_cron`). In **Database → Extensions**, enable `pg_net`. Confirm without changing live data:

```sql
select extname
from pg_extension
where extname in ('pg_cron', 'pg_net')
order by extname;
```

Both rows must be returned.

## 3. Store both values in Supabase Vault

Use **Supabase Dashboard → Vault** to create the following secrets. Vault values are environment-specific; enter them only through the dashboard:

1. `ate_notification_scheduler_url`: the canonical HTTPS URL ending in `/api/cron/notifications`.
2. `ate_notification_cron_secret`: the same high-entropy value configured as Vercel's server-only `CRON_SECRET`.

Confirm presence and shape without selecting decrypted values:

```sql
select
  exists (
    select 1 from vault.decrypted_secrets
    where name = 'ate_notification_scheduler_url'
      and decrypted_secret ~ '^https://[^/?#]+(?:/[^?#]*)?/api/cron/notifications$'
  ) as scheduler_url_valid,
  exists (
    select 1 from vault.decrypted_secrets
    where name = 'ate_notification_cron_secret'
      and length(decrypted_secret) >= 32
  ) as cron_secret_present;
```

Both booleans must be `true`. Access to `vault.decrypted_secrets` must remain restricted to trusted database/operator roles.

## 4. Create the five-minute job

Run this exact SQL in the target project's SQL editor. It removes only a prior job with the fixed ATE job name, then recreates it. It does not embed or return either secret value.

```sql
do $cleanup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'ate-notification-scheduler';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$cleanup$;

select cron.schedule(
  'ate-notification-scheduler',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'ate_notification_scheduler_url'
      ),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'ate_notification_cron_secret'
        )
      ),
      timeout_milliseconds := 30000
    ) as request_id;
  $job$
);
```

## 5. Verify configuration and TEST execution

First inspect only non-secret job metadata:

```sql
select jobid, jobname, schedule, active, database, username
from cron.job
where jobname = 'ate-notification-scheduler';
```

The row must be active with schedule `*/5 * * * *`. After at least one interval in TEST, inspect recent Cron outcomes:

```sql
select status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid from cron.job where jobname = 'ate-notification-scheduler'
)
order by start_time desc
limit 10;
```

Then verify the deployment logs show an authorised scheduler response and the database delivery history shows only deterministic, eligible deliveries. Do not print request headers, Vault values, push subscription keys, or endpoints into evidence.

Run `npm run pilot:check` against the same project. Notification configuration remains **NOT READY** unless the extensions, both valid Vault entries, active five-minute job, Vault lookups, bearer header, application values, protected route, and notification tables are all present.

## Disable or recover

To stop the trigger without deleting notification audit history:

```sql
select cron.unschedule('ate-notification-scheduler');
```

Leave `notification_deliveries` intact for recovery/audit. Remove or rotate the two Vault secrets and Vercel `CRON_SECRET` only through their respective operator consoles. Recreate and revalidate the job after rotating the shared credential.
