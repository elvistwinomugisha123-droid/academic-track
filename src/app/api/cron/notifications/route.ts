import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runNotificationScheduler } from "@/notifications/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request) {
  const configured = process.env.CRON_SECRET; const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const left = Buffer.from(configured); const right = Buffer.from(supplied); return left.length === right.length && timingSafeEqual(left, right);
}
export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ ok: true, report: await runNotificationScheduler() }); }
  catch { return NextResponse.json({ ok: false, error: "Notification scheduler failed." }, { status: 503 }); }
}
