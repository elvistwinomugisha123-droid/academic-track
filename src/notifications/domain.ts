import { createHash } from "node:crypto";

export type NotificationType = "MORNING_BRIEF" | "UPCOMING_LESSON" | "RECOVERY_ALERT" | "MISSING_CLASSROOM_RECORD";
export type NotificationPreferences = {
  enabled: boolean;
  morningBrief: boolean;
  upcomingLesson: boolean;
  recoveryAlert: boolean;
  missingRecord: boolean;
  morningBriefTime: string;
  upcomingLeadMinutes: number;
};
export type NotificationLesson = {
  id: string; sectionId: string; subject: string; classLevel: string; stream: string;
  startsAt: string; endsAt: string; hasOutcome: boolean; unresolvedRecovery: boolean;
};
export type NotificationContext = {
  schoolId: string; membershipId: string; displayName: string; timezone: string;
  subscriptionId: string; preferences: NotificationPreferences; lessons: NotificationLesson[];
};
export type PlannedNotification = {
  type: NotificationType; idempotencyKey: string; scheduledLessonId: string | null;
  localDate: string; scheduledFor: string; title: string; body: string; deepLink: string;
};

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, minutes: Number(value.hour) * 60 + Number(value.minute) };
}
function minutesOf(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function safeName(value: string) { return value.trim().split(/\s+/)[0]?.slice(0, 30) || "teacher"; }
function lessonLabel(lesson: NotificationLesson) { return `${lesson.subject} · ${lesson.classLevel} ${lesson.stream}`.slice(0, 90); }
function lessonTime(lesson: NotificationLesson, timeZone: string) { return new Intl.DateTimeFormat("en-UG", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(lesson.startsAt)); }
export function lessonDeepLink(lessonId: string) { return `/workspace/teacher/lessons/${encodeURIComponent(lessonId)}`; }
export function notificationIdempotencyKey(type: NotificationType, membershipId: string, subscriptionId: string, localDate: string, lessonId?: string) {
  return createHash("sha256").update([type, membershipId, subscriptionId, type === "MORNING_BRIEF" ? localDate : "lesson", lessonId ?? "day"].join(":"), "utf8").digest("hex");
}

export function planNotifications(context: NotificationContext, now = new Date()): PlannedNotification[] {
  if (!context.preferences.enabled) return [];
  const local = localParts(now, context.timezone);
  const planned: PlannedNotification[] = [];
  const lessons = [...context.lessons].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  const today = lessons.filter((lesson) => localParts(new Date(lesson.startsAt), context.timezone).date === local.date);
  const future = lessons.filter((lesson) => Date.parse(lesson.startsAt) > now.getTime());

  const add = (type: NotificationType, title: string, body: string, deepLink: string, lesson?: NotificationLesson) => planned.push({
    type, idempotencyKey: notificationIdempotencyKey(type, context.membershipId, context.subscriptionId, local.date, lesson?.id),
    scheduledLessonId: lesson?.id ?? null, localDate: local.date, scheduledFor: now.toISOString(), title: title.slice(0, 80), body: body.slice(0, 180), deepLink,
  });

  const briefMinute = minutesOf(context.preferences.morningBriefTime);
  if (context.preferences.morningBrief && local.minutes >= briefMinute && local.minutes < briefMinute + 10) {
    const first = today[0]; const recoveryCount = new Set(future.filter((lesson) => lesson.unresolvedRecovery).map((lesson) => lesson.sectionId)).size;
    const lessonText = first ? ` First: ${lessonLabel(first)} at ${lessonTime(first, context.timezone)}.` : " No lessons are scheduled today.";
    const recoveryText = recoveryCount ? ` ${recoveryCount} section${recoveryCount === 1 ? " has" : "s have"} unfinished work to review.` : "";
    add("MORNING_BRIEF", `Good morning, ${safeName(context.displayName)}`, `You have ${today.length} lesson${today.length === 1 ? "" : "s"} today.${lessonText}${recoveryText}`, "/workspace");
  }

  for (const lesson of future) {
    const untilStart = (Date.parse(lesson.startsAt) - now.getTime()) / 60_000;
    if (untilStart <= context.preferences.upcomingLeadMinutes && untilStart > 0) {
      if (context.preferences.upcomingLesson) add("UPCOMING_LESSON", "Upcoming lesson", `${lessonLabel(lesson)} starts at ${lessonTime(lesson, context.timezone)}.`, lessonDeepLink(lesson.id), lesson);
      if (context.preferences.recoveryAlert && lesson.unresolvedRecovery) add("RECOVERY_ALERT", "Recovery needed", `${lessonLabel(lesson)} at ${lessonTime(lesson, context.timezone)} has unfinished work to review.`, lessonDeepLink(lesson.id), lesson);
    }
  }

  if (context.preferences.missingRecord) for (const lesson of lessons) {
    const sinceEnd = (now.getTime() - Date.parse(lesson.endsAt)) / 60_000;
    if (!lesson.hasOutcome && sinceEnd >= 15 && sinceEnd < 24 * 60) add("MISSING_CLASSROOM_RECORD", "Classroom record needed", `Confirm what happened in ${lessonLabel(lesson)}.`, lessonDeepLink(lesson.id), lesson);
  }
  return planned;
}

export function isPermanentPushFailure(status: number) { return status === 404 || status === 410; }
export function isRetryablePushFailure(status: number) { return status === 408 || status === 429 || status >= 500; }
