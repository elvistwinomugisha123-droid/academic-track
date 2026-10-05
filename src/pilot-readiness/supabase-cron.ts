export const NOTIFICATION_CRON_JOB_NAME = "ate-notification-scheduler";
export const NOTIFICATION_CRON_SCHEDULE = "*/5 * * * *";
export const NOTIFICATION_SCHEDULER_URL_SECRET = "ate_notification_scheduler_url";
export const NOTIFICATION_CRON_SECRET = "ate_notification_cron_secret";

export type SupabaseCronEvidence = {
  pgCronInstalled: boolean;
  pgNetInstalled: boolean;
  schedulerUrlSecretValid: boolean;
  cronSecretPresent: boolean;
  jobPresent: boolean;
  jobActive: boolean;
  schedule: string | null;
  commandUsesPgNet: boolean;
  commandUsesVaultUrl: boolean;
  commandUsesVaultSecret: boolean;
  commandSetsBearerHeader: boolean;
};

export function evaluateNotificationCron(evidence: SupabaseCronEvidence): { configured: boolean; detail: string } {
  const missing: string[] = [];
  if (!evidence.pgCronInstalled) missing.push("pg_cron extension");
  if (!evidence.pgNetInstalled) missing.push("pg_net extension");
  if (!evidence.schedulerUrlSecretValid) missing.push(`valid HTTPS Vault secret ${NOTIFICATION_SCHEDULER_URL_SECRET}`);
  if (!evidence.cronSecretPresent) missing.push(`non-empty Vault secret ${NOTIFICATION_CRON_SECRET}`);
  if (!evidence.jobPresent) missing.push(`cron job ${NOTIFICATION_CRON_JOB_NAME}`);
  else {
    if (!evidence.jobActive) missing.push("active cron job");
    if (evidence.schedule !== NOTIFICATION_CRON_SCHEDULE) missing.push(`cron schedule ${NOTIFICATION_CRON_SCHEDULE}`);
    if (!evidence.commandUsesPgNet) missing.push("pg_net HTTP invocation");
    if (!evidence.commandUsesVaultUrl) missing.push("scheduler URL lookup from Vault");
    if (!evidence.commandUsesVaultSecret) missing.push("cron secret lookup from Vault");
    if (!evidence.commandSetsBearerHeader) missing.push("Authorization Bearer header");
  }

  return missing.length === 0
    ? { configured: true, detail: "Supabase pg_cron has an active five-minute pg_net job using the scheduler URL and bearer credential from Vault." }
    : { configured: false, detail: `Supabase notification trigger is incomplete: ${missing.join(", ")}.` };
}
