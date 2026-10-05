"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationPreferencesInputSchema, PushSubscriptionInputSchema } from "./schemas";

export type NotificationSettings = {
  vapidPublicKey: string | null; timezone: string; subscriptions: Array<{ id: string; userAgent: string | null; createdAt: string }>;
  preferences: { notificationsEnabled: boolean; morningBrief: boolean; upcomingLesson: boolean; recoveryAlert: boolean; missingRecord: boolean; morningBriefTime: string; upcomingLeadMinutes: number };
};

export async function loadNotificationSettings(): Promise<{ access: Awaited<ReturnType<typeof requireWorkspaceAccess>>; settings: NotificationSettings }> {
  const access = await requireWorkspaceAccess(undefined, "/workspace/notifications");
  const client = await createSupabaseServerClient();
  const [school, preference, subscriptions] = await Promise.all([
    client.from("schools").select("timezone").eq("id", access.schoolId).single(),
    client.from("notification_preferences").select("notifications_enabled,morning_brief_enabled,upcoming_lesson_enabled,recovery_alert_enabled,missing_record_enabled,morning_brief_time,upcoming_lead_minutes").eq("membership_id", access.membershipId).maybeSingle(),
    client.from("push_subscriptions").select("id,user_agent,created_at").eq("membership_id", access.membershipId).eq("status", "ACTIVE").order("created_at", { ascending: false }),
  ]);
  if (school.error || !school.data) throw new Error("School notification context could not be loaded.");
  if (preference.error || subscriptions.error) throw new Error("Notification settings could not be loaded.");
  const row = preference.data;
  return { access, settings: {
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null, timezone: String(school.data.timezone),
    subscriptions: (subscriptions.data ?? []).map((item: { id: unknown; user_agent: unknown; created_at: unknown }) => ({ id: String(item.id), userAgent: item.user_agent ? String(item.user_agent) : null, createdAt: String(item.created_at) })),
    preferences: { notificationsEnabled: Boolean(row?.notifications_enabled), morningBrief: row?.morning_brief_enabled ?? true, upcomingLesson: row?.upcoming_lesson_enabled ?? true, recoveryAlert: row?.recovery_alert_enabled ?? true, missingRecord: row?.missing_record_enabled ?? true, morningBriefTime: String(row?.morning_brief_time ?? "06:30").slice(0, 5), upcomingLeadMinutes: Number(row?.upcoming_lead_minutes ?? 20) },
  } };
}

export async function saveNotificationPreferences(input: unknown) {
  try {
    const access = await requireWorkspaceAccess(undefined, "/workspace/notifications");
    if (!access.roles.includes("TEACHER")) throw new Error("Teacher access is required.");
    const value = NotificationPreferencesInputSchema.parse(input);
    const client = await createSupabaseServerClient();
    const { error } = await client.from("notification_preferences").upsert({ membership_id: access.membershipId, school_id: access.schoolId, user_id: access.userId, notifications_enabled: value.notificationsEnabled, morning_brief_enabled: value.morningBrief, upcoming_lesson_enabled: value.upcomingLesson, recovery_alert_enabled: value.recoveryAlert, missing_record_enabled: value.missingRecord, morning_brief_time: value.morningBriefTime, upcoming_lead_minutes: value.upcomingLeadMinutes }, { onConflict: "membership_id" });
    if (error) throw error;
    revalidatePath("/workspace/notifications"); return { ok: true as const };
  } catch { return { ok: false as const, error: "Notification preferences could not be saved." }; }
}

export async function registerPushSubscription(input: unknown) {
  try {
    const access = await requireWorkspaceAccess(undefined, "/workspace/notifications");
    if (!access.roles.includes("TEACHER")) throw new Error("Teacher access is required.");
    const value = PushSubscriptionInputSchema.parse(input);
    const client = await createSupabaseServerClient();
    const requestHeaders = await headers();
    const endpointHash = createHash("sha256").update(value.endpoint).digest("hex");
    const { error } = await client.from("push_subscriptions").upsert({ school_id: access.schoolId, membership_id: access.membershipId, user_id: access.userId, endpoint: value.endpoint, endpoint_sha256: endpointHash, p256dh: value.keys.p256dh, auth_secret: value.keys.auth, user_agent: requestHeaders.get("user-agent")?.slice(0, 300) ?? null, status: "ACTIVE", failure_count: 0 }, { onConflict: "membership_id,endpoint_sha256" });
    if (error) throw error;
    revalidatePath("/workspace/notifications"); return { ok: true as const };
  } catch { return { ok: false as const, error: "This device could not be registered for notifications." }; }
}

export async function revokePushSubscription(endpoint: string) {
  try {
    const access = await requireWorkspaceAccess(undefined, "/workspace/notifications");
    if (!access.roles.includes("TEACHER")) throw new Error("Teacher access is required.");
    const endpointHash = createHash("sha256").update(PushSubscriptionInputSchema.shape.endpoint.parse(endpoint)).digest("hex");
    const client = await createSupabaseServerClient();
    const { error } = await client.from("push_subscriptions").update({ status: "REVOKED" }).eq("membership_id", access.membershipId).eq("endpoint_sha256", endpointHash);
    if (error) throw error;
    revalidatePath("/workspace/notifications"); return { ok: true as const };
  } catch { return { ok: false as const, error: "This device subscription could not be removed." }; }
}
