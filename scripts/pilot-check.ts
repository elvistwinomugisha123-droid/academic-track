import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { runPilotHealthCheck, type PilotHealthProbes } from "../src/pilot-readiness/health";
import {
  evaluateNotificationCron,
  NOTIFICATION_CRON_JOB_NAME,
  NOTIFICATION_CRON_SECRET,
  NOTIFICATION_SCHEDULER_URL_SECRET,
  type SupabaseCronEvidence,
} from "../src/pilot-readiness/supabase-cron";

function loadLocalEnvironment() {
  const filePath = path.join(process.cwd(), ".env.local");
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

async function main() {
  loadLocalEnvironment();
  const databaseUrl = process.env.DATABASE_URL;
  const sql = databaseUrl ? postgres(databaseUrl, { max: 1, connect_timeout: 8, idle_timeout: 2, ssl: "require" }) : null;
  const query = async <Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) => {
    if (!sql) throw new Error("Database is not configured.");
    return sql.unsafe<Row[]>(statement, parameters as never[]);
  };
  const probes: PilotHealthProbes = {
    async database() {
      await query("select 1 as reachable");
      const rows = await query<{ core_tables: boolean; final_policy: boolean }>(`select
        to_regclass('public.schools') is not null and to_regclass('public.teaching_sections') is not null and to_regclass('public.knowledge_curriculum_releases') is not null and to_regclass('public.ai_generation_runs') is not null and to_regclass('public.assessment_workspaces') is not null as core_tables,
        exists(select 1 from pg_policies where schemaname='public' and tablename='teaching_section_curriculum_position_events' and policyname='teaching_section_curriculum_position_events_insert' and roles @> array['authenticated']::name[]) as final_policy`);
      const current = Boolean(rows[0]?.core_tables && rows[0]?.final_policy);
      return { reachable: true, migrationContractCurrent: current, detail: current ? "Database is reachable and the schema contract through the current security hardening is present." : "Database is reachable but required current tables/policies are missing." };
    },
    async auth(url, key) {
      const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, { headers: { apikey: key }, signal: AbortSignal.timeout(10_000) });
      return { reachable: response.ok, detail: response.ok ? "Supabase Auth health endpoint is reachable." : `Supabase Auth health returned HTTP ${response.status}.` };
    },
    async curriculum() {
      const rows = await query<{ profiles: string; records: string }>(`select
        (select count(*)::text from knowledge_subject_profiles where status='ACTIVE' and runtime_status='PILOT_ACTIVE') as profiles,
        (select count(*)::text from knowledge_profile_records where status='APPROVED' and runtime_status='PILOT_ACTIVE') as records`);
      const profiles = Number(rows[0]?.profiles ?? 0); const records = Number(rows[0]?.records ?? 0);
      return { available: profiles > 0 && records > 0, detail: profiles > 0 && records > 0 ? `${profiles} PILOT_ACTIVE profile(s) and ${records} approved runtime record(s) are available.` : "No active pilot curriculum profiles with approved runtime records are available." };
    },
    async bindings() {
      const rows = await query<{ active_sections: string; unbound_sections: string }>(`select
        count(*) filter (where ts.operational_status='ACTIVE' and ts.assignment_state='CONFIRMED')::text as active_sections,
        count(*) filter (where ts.operational_status='ACTIVE' and ts.assignment_state='CONFIRMED' and not exists (select 1 from teaching_section_curriculum_bindings b where b.teaching_section_id=ts.id and b.school_id=ts.school_id and b.status='ACTIVE' and b.effective_from <= current_date and (b.effective_to is null or b.effective_to >= current_date)))::text as unbound_sections
        from teaching_sections ts`);
      const active = Number(rows[0]?.active_sections ?? 0); const unbound = Number(rows[0]?.unbound_sections ?? 0);
      return { valid: active > 0 && unbound === 0, detail: active === 0 ? "No confirmed active Teaching Sections exist in the target database." : unbound ? `${unbound} of ${active} confirmed active Teaching Section(s) lack a current active curriculum binding.` : `All ${active} confirmed active Teaching Section(s) have a current active curriculum binding.` };
    },
    async pwa() {
      const manifest = ["src/app/manifest.ts", "src/app/manifest.webmanifest", "public/manifest.webmanifest"].some((file) => existsSync(path.join(process.cwd(), file)));
      const worker = ["public/sw.js", "public/service-worker.js"].some((file) => existsSync(path.join(process.cwd(), file)));
      const icons = ["public/icons/ate.svg", "public/icons/ate-maskable.svg"].every((file) => existsSync(path.join(process.cwd(), file)));
      return { configured: manifest && worker && icons, detail: manifest && worker && icons ? "Manifest, service worker and required icons are present; device acceptance remains separate." : "Required PWA manifest, service worker and icons are not all present." };
    },
    async notifications() {
      const secrets = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT && process.env.CRON_SECRET);
      const implementation = ["src/app/api/cron/notifications/route.ts", "src/notifications/scheduler.ts", "src/notifications/web-push.ts"].every((file) => existsSync(path.join(process.cwd(), file)));
      let schema = false;
      let cron = { configured: false, detail: "Supabase Cron cannot be checked until the database is configured." };
      if (sql) {
        const rows = await query<{ subscriptions: boolean; deliveries: boolean }>("select to_regclass('public.push_subscriptions') is not null as subscriptions, to_regclass('public.notification_deliveries') is not null as deliveries");
        schema = Boolean(rows[0]?.subscriptions && rows[0]?.deliveries);

        const extensionRows = await query<{ pg_cron_installed: boolean; pg_net_installed: boolean }>(`select
          exists(select 1 from pg_extension where extname='pg_cron') as pg_cron_installed,
          exists(select 1 from pg_extension where extname='pg_net') as pg_net_installed`);
        const extensions = extensionRows[0] ?? { pg_cron_installed: false, pg_net_installed: false };
        const evidence: SupabaseCronEvidence = {
          pgCronInstalled: extensions.pg_cron_installed,
          pgNetInstalled: extensions.pg_net_installed,
          schedulerUrlSecretValid: false,
          cronSecretPresent: false,
          jobPresent: false,
          jobActive: false,
          schedule: null,
          commandUsesPgNet: false,
          commandUsesVaultUrl: false,
          commandUsesVaultSecret: false,
          commandSetsBearerHeader: false,
        };
        if (extensions.pg_cron_installed && extensions.pg_net_installed) {
          const vaultRows = await query<{ scheduler_url_valid: boolean; cron_secret_present: boolean }>(`select
            exists(select 1 from vault.decrypted_secrets where name=$1 and decrypted_secret ~ '^https://[^/?#]+(?:/[^?#]*)?/api/cron/notifications$') as scheduler_url_valid,
            exists(select 1 from vault.decrypted_secrets where name=$2 and length(decrypted_secret) >= 32) as cron_secret_present`, [NOTIFICATION_SCHEDULER_URL_SECRET, NOTIFICATION_CRON_SECRET]);
          const jobRows = await query<{ active: boolean; schedule: string; command_uses_pg_net: boolean; command_uses_vault_url: boolean; command_uses_vault_secret: boolean; command_sets_bearer: boolean }>(`select
            active,
            schedule,
            command ~* 'net\\.http_(get|post)' as command_uses_pg_net,
            position($2 in command) > 0 as command_uses_vault_url,
            position($3 in command) > 0 as command_uses_vault_secret,
            command ~* 'Authorization' and command ~* 'Bearer' as command_sets_bearer
          from cron.job where jobname=$1`, [NOTIFICATION_CRON_JOB_NAME, NOTIFICATION_SCHEDULER_URL_SECRET, NOTIFICATION_CRON_SECRET]);
          const vault = vaultRows[0]; const job = jobRows[0];
          Object.assign(evidence, {
            schedulerUrlSecretValid: Boolean(vault?.scheduler_url_valid), cronSecretPresent: Boolean(vault?.cron_secret_present),
            jobPresent: Boolean(job), jobActive: Boolean(job?.active), schedule: job?.schedule ?? null,
            commandUsesPgNet: Boolean(job?.command_uses_pg_net), commandUsesVaultUrl: Boolean(job?.command_uses_vault_url),
            commandUsesVaultSecret: Boolean(job?.command_uses_vault_secret), commandSetsBearerHeader: Boolean(job?.command_sets_bearer),
          });
        }
        cron = evaluateNotificationCron(evidence);
      }
      const configured = secrets && schema && implementation && cron.configured;
      return { configured, detail: configured ? "Push keys, sender identity, protected route, persistence tables and Supabase Cron trigger are configured; delivery acceptance remains separate." : `Push requires its protected scheduler route, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET, persistence tables, and Supabase Cron/Vault trigger. ${cron.detail}` };
    },
  };

  try {
    const report = await runPilotHealthCheck({ env: process.env, probes });
    for (const item of report.checks) console.log(`${item.status.padEnd(4)} ${item.label}: ${item.detail}`);
    console.log(`\n${report.status}`);
    if (report.status !== "READY") process.exitCode = 1;
  } finally { if (sql) await sql.end({ timeout: 2 }); }
}

main().catch((error) => { console.error(`NOT READY: ${error instanceof Error ? error.message : "pilot health check failed"}`); process.exitCode = 1; });
