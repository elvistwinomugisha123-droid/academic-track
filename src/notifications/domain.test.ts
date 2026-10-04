import { describe, expect, it } from "vitest";
import { notificationIdempotencyKey, planNotifications, type NotificationContext } from "./domain";
import { PushSubscriptionInputSchema } from "./schemas";

function context(overrides: Partial<NotificationContext> = {}): NotificationContext {
  return { schoolId: "school", membershipId: "member", displayName: "Ms. Amina K.", timezone: "Africa/Kampala", subscriptionId: "device", preferences: { enabled: true, morningBrief: true, upcomingLesson: true, recoveryAlert: true, missingRecord: true, morningBriefTime: "06:30", upcomingLeadMinutes: 20 }, lessons: [], ...overrides };
}

describe("deterministic notification eligibility", () => {
  it("creates one privacy-safe morning brief in the school timezone", () => {
    const now = new Date("2026-10-03T03:35:00Z");
    const planned = planNotifications(context({ lessons: [{ id: "lesson-1", sectionId: "s", subject: "Biology", classLevel: "S2", stream: "East", startsAt: "2026-10-03T05:00:00Z", endsAt: "2026-10-03T05:40:00Z", hasOutcome: false, unresolvedRecovery: true }] }), now);
    const brief = planned.find((item) => item.type === "MORNING_BRIEF");
    expect(brief).toMatchObject({ deepLink: "/workspace", localDate: "2026-10-03" });
    expect(brief?.body).toContain("1 lesson"); expect(brief?.body).not.toContain("unfinished work to review before the lesson");
  });

  it("respects the master switch and per-type preferences", () => {
    expect(planNotifications(context({ preferences: { ...context().preferences, enabled: false } }), new Date("2026-10-03T03:35:00Z"))).toEqual([]);
    const lesson = { id: "lesson-2", sectionId: "s", subject: "Physics", classLevel: "S5", stream: "North", startsAt: "2026-10-03T08:20:00Z", endsAt: "2026-10-03T09:00:00Z", hasOutcome: false, unresolvedRecovery: true };
    const planned = planNotifications(context({ preferences: { ...context().preferences, morningBrief: false, recoveryAlert: false }, lessons: [lesson] }), new Date("2026-10-03T08:00:00Z"));
    expect(planned.map((item) => item.type)).toEqual(["UPCOMING_LESSON"]);
  });

  it("bounds missing-record reminders and uses authenticated internal deep links", () => {
    const lesson = { id: "lesson / safe", sectionId: "s", subject: "Chemistry", classLevel: "S3", stream: "West", startsAt: "2026-10-03T07:00:00Z", endsAt: "2026-10-03T07:40:00Z", hasOutcome: false, unresolvedRecovery: false };
    const planned = planNotifications(context({ preferences: { ...context().preferences, morningBrief: false }, lessons: [lesson] }), new Date("2026-10-03T08:00:00Z"));
    expect(planned).toHaveLength(1); expect(planned[0].type).toBe("MISSING_CLASSROOM_RECORD");
    expect(planned[0].deepLink).toBe("/workspace/teacher/lessons/lesson%20%2F%20safe");
    expect(planNotifications(context({ preferences: { ...context().preferences, morningBrief: false }, lessons: [lesson] }), new Date("2026-10-04T08:00:01Z"))).toEqual([]);
  });

  it("uses stable per-device idempotency keys", () => {
    const first = notificationIdempotencyKey("UPCOMING_LESSON", "m", "d", "2026-10-03", "l");
    expect(first).toBe(notificationIdempotencyKey("UPCOMING_LESSON", "m", "d", "2026-10-04", "l"));
    expect(first).not.toBe(notificationIdempotencyKey("UPCOMING_LESSON", "m", "other-device", "2026-10-03", "l"));
  });

  it("accepts known browser push services and rejects arbitrary HTTPS callbacks", () => {
    const keys = { p256dh: "x".repeat(65), auth: "x".repeat(22) };
    expect(PushSubscriptionInputSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/id", keys }).success).toBe(true);
    expect(PushSubscriptionInputSchema.safeParse({ endpoint: "https://school.example.test/internal", keys }).success).toBe(false);
  });
});
