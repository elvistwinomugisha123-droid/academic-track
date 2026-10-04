import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("drizzle/0038_pwa_push_notifications.sql", "utf8");

describe("push persistence migration", () => {
  it("supports multiple devices with tenant/user RLS and durable idempotency", () => {
    expect(migration).toContain("create table public.push_subscriptions");
    expect(migration).toContain("unique (membership_id, endpoint_sha256)");
    expect(migration).toContain("create table public.notification_preferences");
    expect(migration).toContain("create table public.notification_deliveries");
    expect(migration).toContain("idempotency_key text not null unique");
    expect(migration).toContain("private.is_teacher_notification_owner(school_id, membership_id)");
    expect(migration).toContain("grant select on public.notification_deliveries to authenticated");
    expect(migration).not.toContain("grant insert on public.notification_deliveries to authenticated");
  });
});
