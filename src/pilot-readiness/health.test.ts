import { describe, expect, it, vi } from "vitest";
import { runPilotHealthCheck, type PilotHealthProbes } from "./health";

const completeEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  ATE_ENVIRONMENT: "pilot",
  NEXT_PUBLIC_APP_URL: "https://pilot.example.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://pilotref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
  DATABASE_URL: "postgresql://postgres.pilotref:secret@aws-0.pooler.supabase.com:6543/postgres",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  EXPECTED_SUPABASE_PROJECT_REF: "pilotref",
  ANTHROPIC_API_KEY: "anthropic-key",
  ANTHROPIC_MODEL: "model",
  AI_DEFAULT_PROVIDER: "anthropic",
  VERCEL: "1",
  VERCEL_GIT_COMMIT_SHA: "abc123",
  VERCEL_URL: "pilot.example.test",
};

function probes(pass = true): PilotHealthProbes {
  return {
    database: vi.fn(async () => ({ reachable: pass, migrationContractCurrent: pass, detail: "database evidence" })),
    auth: vi.fn(async () => ({ reachable: pass, detail: "auth evidence" })),
    curriculum: vi.fn(async () => ({ available: pass, detail: "curriculum evidence" })),
    bindings: vi.fn(async () => ({ valid: pass, detail: "binding evidence" })),
    pwa: vi.fn(async () => ({ configured: pass, detail: "pwa evidence" })),
    notifications: vi.fn(async () => ({ configured: pass, detail: "notification evidence" })),
  };
}

describe("pilot health check", () => {
  it("returns READY only when every mandatory static and live check passes", async () => {
    const report = await runPilotHealthCheck({ env: completeEnvironment, probes: probes(), now: new Date("2026-10-03T00:00:00Z") });
    expect(report.status).toBe("READY");
    expect(report.checks.every((item) => item.status === "PASS")).toBe(true);
    expect(JSON.stringify(report)).not.toContain("secret");
    expect(JSON.stringify(report)).not.toContain("anthropic-key");
  });

  it("fails closed with exact missing configuration reasons", async () => {
    const report = await runPilotHealthCheck({ env: { NODE_ENV: "test" }, probes: probes() });
    expect(report.status).toBe("NOT_READY");
    expect(report.checks.find((item) => item.id === "environment.required")?.detail).toContain("DATABASE_URL");
    expect(report.checks.find((item) => item.id === "supabase.project")?.status).toBe("FAIL");
  });

  it("rejects a TEST or ambiguous project even when other probes would pass", async () => {
    const liveProbes = probes();
    const report = await runPilotHealthCheck({ env: { ...completeEnvironment, NEXT_PUBLIC_SUPABASE_URL: "https://lwbkxhimqlfuzzxilaga.supabase.co" }, probes: liveProbes });
    expect(report.status).toBe("NOT_READY");
    expect(report.checks.find((item) => item.id === "supabase.project")?.detail).toContain("fail closed");
    expect(liveProbes.database).not.toHaveBeenCalled();
    expect(liveProbes.auth).not.toHaveBeenCalled();
  });

  it("does not accept environment assertions in place of PWA and notification probes", async () => {
    const report = await runPilotHealthCheck({ env: { ...completeEnvironment, PILOT_PWA_CONFIGURED: "true", PILOT_NOTIFICATIONS_CONFIGURED: "true" }, probes: probes(false) });
    expect(report.status).toBe("NOT_READY");
    expect(report.checks.find((item) => item.id === "pwa.configuration")?.status).toBe("FAIL");
    expect(report.checks.find((item) => item.id === "notifications.configuration")?.status).toBe("FAIL");
  });
});
