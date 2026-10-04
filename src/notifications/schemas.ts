import { z } from "zod";

const permittedPushHosts = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
export function isPermittedPushEndpoint(value: string) { try { const url = new URL(value); return url.protocol === "https:" && permittedPushHosts.has(url.hostname); } catch { return false; } }
export const PushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().refine(isPermittedPushEndpoint, "Push endpoint provider is not supported."),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(40).max(180), auth: z.string().min(16).max(100) }),
});
export const NotificationPreferencesInputSchema = z.object({
  notificationsEnabled: z.boolean(), morningBrief: z.boolean(), upcomingLesson: z.boolean(), recoveryAlert: z.boolean(), missingRecord: z.boolean(),
  morningBriefTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), upcomingLeadMinutes: z.number().int().min(5).max(120),
});
