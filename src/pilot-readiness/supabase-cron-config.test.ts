import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notification trigger configuration contract", () => {
  it("does not declare a Vercel cron", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as Record<string, unknown>;
    expect(config.crons).toBeUndefined();
  });

  it("keeps the protected scheduler route server-side", () => {
    const route = readFileSync("src/app/api/cron/notifications/route.ts", "utf8");
    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("timingSafeEqual");
    expect(route).not.toContain("NEXT_PUBLIC_CRON_SECRET");
  });

  it("documents the Vault-backed five-minute job without a concrete URL or credential", () => {
    const runbook = readFileSync("docs/pilot/SUPABASE_NOTIFICATION_CRON_RUNBOOK.md", "utf8");
    expect(runbook).toContain("'*/5 * * * *'");
    expect(runbook).toContain("ate_notification_scheduler_url");
    expect(runbook).toContain("ate_notification_cron_secret");
    expect(runbook).toContain("'Authorization', 'Bearer '");
    expect(runbook).not.toMatch(/https:\/\/[a-z0-9-]+\.(?:vercel\.app|com|org|net)\/api\/cron\/notifications/i);
  });
});
