import { afterEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeSqlClient } from "@/knowledge/db/client";
import { runNotificationScheduler } from "./scheduler";

function fakeClient() {
  const deliveries = new Set<string>();
  const query = vi.fn(async <Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) => {
    if (statement.includes("from push_subscriptions ps")) return { rows: [{ school_id: "00000000-0000-0000-0000-000000000001", membership_id: "00000000-0000-0000-0000-000000000002", user_id: "u", display_name: "Ms. Amina", timezone: "Africa/Kampala", subscription_id: "00000000-0000-0000-0000-000000000003", endpoint: "https://push.example/sub", p256dh: "x".repeat(65), auth_secret: "x".repeat(22), notifications_enabled: true, morning_brief_enabled: true, upcoming_lesson_enabled: false, recovery_alert_enabled: false, missing_record_enabled: false, morning_brief_time: "06:30:00", upcoming_lead_minutes: 20 } as unknown as Row] };
    if (statement.includes("with effective as")) return { rows: [] as Row[] };
    if (statement.includes("insert into notification_deliveries")) { const key = String(parameters[4]); if (deliveries.has(key)) return { rows: [] as Row[] }; deliveries.add(key); return { rows: [{ id: "delivery" } as unknown as Row] }; }
    return { rows: [] as Row[] };
  });
  return { client: { query, close: vi.fn(async () => undefined) } as KnowledgeSqlClient, query };
}

afterEach(() => vi.unstubAllEnvs());

describe("notification scheduler", () => {
  it("persists before sending and suppresses duplicate delivery for the same device/day", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public"); vi.stubEnv("VAPID_PRIVATE_KEY", "private"); vi.stubEnv("VAPID_SUBJECT", "mailto:support@example.com");
    const { client } = fakeClient(); const send = vi.fn(async () => ({ ok: true, status: 201 })); const now = new Date("2026-10-03T03:35:00Z");
    const first = await runNotificationScheduler({ client, send, now }); const second = await runNotificationScheduler({ client, send, now });
    expect(first).toMatchObject({ planned: 1, sent: 1, duplicates: 0 }); expect(second).toMatchObject({ planned: 1, sent: 0, duplicates: 1 }); expect(send).toHaveBeenCalledTimes(1);
  });
});
