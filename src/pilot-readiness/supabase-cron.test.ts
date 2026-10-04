import { describe, expect, it } from "vitest";
import {
  evaluateNotificationCron,
  NOTIFICATION_CRON_JOB_NAME,
  NOTIFICATION_CRON_SCHEDULE,
  NOTIFICATION_CRON_SECRET,
  NOTIFICATION_SCHEDULER_URL_SECRET,
  type SupabaseCronEvidence,
} from "./supabase-cron";

const completeEvidence: SupabaseCronEvidence = {
  pgCronInstalled: true,
  pgNetInstalled: true,
  schedulerUrlSecretValid: true,
  cronSecretPresent: true,
  jobPresent: true,
  jobActive: true,
  schedule: NOTIFICATION_CRON_SCHEDULE,
  commandUsesPgNet: true,
  commandUsesVaultUrl: true,
  commandUsesVaultSecret: true,
  commandSetsBearerHeader: true,
};

describe("Supabase notification cron readiness", () => {
  it("passes only the active five-minute pg_net and Vault contract", () => {
    expect(evaluateNotificationCron(completeEvidence)).toEqual({
      configured: true,
      detail: "Supabase pg_cron has an active five-minute pg_net job using the scheduler URL and bearer credential from Vault.",
    });
  });

  it.each([
    ["missing pg_cron", { pgCronInstalled: false }, "pg_cron extension"],
    ["daily schedule", { schedule: "0 7 * * *" }, "cron schedule */5 * * * *"],
    ["inactive job", { jobActive: false }, "active cron job"],
    ["missing URL secret", { schedulerUrlSecretValid: false }, NOTIFICATION_SCHEDULER_URL_SECRET],
    ["missing bearer secret", { cronSecretPresent: false }, NOTIFICATION_CRON_SECRET],
    ["literal header instead of Vault lookup", { commandUsesVaultSecret: false }, "cron secret lookup from Vault"],
  ])("fails closed for %s", (_label, change, reason) => {
    const result = evaluateNotificationCron({ ...completeEvidence, ...change });
    expect(result.configured).toBe(false);
    expect(result.detail).toContain(reason);
  });

  it("uses the stable operator-facing job name", () => {
    expect(NOTIFICATION_CRON_JOB_NAME).toBe("ate-notification-scheduler");
  });
});
