import "server-only";
import { createPostgresKnowledgeClient, type KnowledgeSqlClient } from "@/knowledge/db/client";
import { isPermanentPushFailure, isRetryablePushFailure, planNotifications, type NotificationContext, type NotificationLesson } from "./domain";
import { sendWebPush } from "./web-push";

type RecipientRow = Record<string, unknown> & { school_id: string; membership_id: string; user_id: string; display_name: string; timezone: string; subscription_id: string; endpoint: string; p256dh: string; auth_secret: string; notifications_enabled: boolean; morning_brief_enabled: boolean; upcoming_lesson_enabled: boolean; recovery_alert_enabled: boolean; missing_record_enabled: boolean; morning_brief_time: string; upcoming_lead_minutes: number };
type LessonRow = Record<string, unknown> & { id: string; teaching_section_id: string; starts_at: string; ends_at: string; subject_name: string; class_level_name: string; stream_name: string; has_outcome: boolean; unresolved_recovery: boolean };

export type SchedulerReport = { recipients: number; planned: number; sent: number; duplicates: number; retryable: number; expired: number; failed: number };

async function recipients(client: KnowledgeSqlClient) {
  return (await client.query<RecipientRow>(`select s.id as school_id,m.id as membership_id,m.user_id,m.display_name,s.timezone,ps.id as subscription_id,ps.endpoint,ps.p256dh,ps.auth_secret,np.notifications_enabled,np.morning_brief_enabled,np.upcoming_lesson_enabled,np.recovery_alert_enabled,np.missing_record_enabled,np.morning_brief_time::text,np.upcoming_lead_minutes
    from push_subscriptions ps join memberships m on m.id=ps.membership_id and m.school_id=ps.school_id join schools s on s.id=m.school_id join notification_preferences np on np.membership_id=m.id and np.school_id=m.school_id
    where ps.status='ACTIVE' and m.status='ACTIVE' and s.status='ACTIVE' and np.notifications_enabled=true
      and exists(select 1 from role_grants rg where rg.membership_id=m.id and rg.school_id=m.school_id and rg.role='TEACHER' and rg.status='ACTIVE')`)).rows;
}

async function lessons(client: KnowledgeSqlClient, recipient: RecipientRow, now: Date): Promise<NotificationLesson[]> {
  const result = await client.query<LessonRow>(`with effective as (select ce.* from classroom_events ce where not exists(select 1 from classroom_events successor where successor.supersedes_event_id=ce.id))
    select l.id,l.teaching_section_id,l.starts_at::text,l.ends_at::text,ss.name subject_name,cl.name class_level_name,st.name stream_name,(current_event.outcome is not null) has_outcome,
      (previous.outcome in ('PARTIALLY_DELIVERED','NOT_DELIVERED','CHANGED') and coalesce(length(trim(coalesce(previous.note,previous.reason))),0)>0) unresolved_recovery
    from scheduled_lessons l join teaching_sections ts on ts.id=l.teaching_section_id and ts.school_id=l.school_id join school_subjects ss on ss.id=ts.school_subject_id and ss.school_id=ts.school_id join class_levels cl on cl.id=ts.class_level_id and cl.school_id=ts.school_id join streams st on st.id=ts.stream_id and st.school_id=ts.school_id left join effective current_event on current_event.scheduled_lesson_id=l.id
    left join lateral (select pe.outcome,pe.note,pe.reason from scheduled_lessons pl left join effective pe on pe.scheduled_lesson_id=pl.id where pl.school_id=l.school_id and pl.teaching_section_id=l.teaching_section_id and pl.starts_at<l.starts_at order by pl.starts_at desc,pl.id desc limit 1) previous on true
    where l.school_id=$1 and ts.teacher_membership_id=$2 and l.schedule_status='SCHEDULED' and l.starts_at >= $3::timestamptz-interval '1 day' and l.starts_at <= $3::timestamptz+interval '2 days' order by l.starts_at`, [recipient.school_id, recipient.membership_id, now.toISOString()]);
  return result.rows.map((row) => ({ id: row.id, sectionId: row.teaching_section_id, subject: row.subject_name, classLevel: row.class_level_name, stream: row.stream_name, startsAt: row.starts_at, endsAt: row.ends_at, hasOutcome: Boolean(row.has_outcome), unresolvedRecovery: Boolean(row.unresolved_recovery) }));
}

export async function runNotificationScheduler(input: { client?: KnowledgeSqlClient; now?: Date; send?: typeof sendWebPush } = {}): Promise<SchedulerReport> {
  const client = input.client ?? createPostgresKnowledgeClient(); const shouldClose = !input.client; const now = input.now ?? new Date(); const send = input.send ?? sendWebPush;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY; const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) throw new Error("Web Push VAPID configuration is incomplete.");
  const report: SchedulerReport = { recipients: 0, planned: 0, sent: 0, duplicates: 0, retryable: 0, expired: 0, failed: 0 };
  try {
    const targets = await recipients(client); report.recipients = targets.length;
    for (const target of targets) {
      const context: NotificationContext = { schoolId: target.school_id, membershipId: target.membership_id, displayName: target.display_name, timezone: target.timezone, subscriptionId: target.subscription_id, preferences: { enabled: target.notifications_enabled, morningBrief: target.morning_brief_enabled, upcomingLesson: target.upcoming_lesson_enabled, recoveryAlert: target.recovery_alert_enabled, missingRecord: target.missing_record_enabled, morningBriefTime: target.morning_brief_time.slice(0, 5), upcomingLeadMinutes: Number(target.upcoming_lead_minutes) }, lessons: await lessons(client, target, now) };
      let plans;
      try { plans = planNotifications(context, now); } catch { report.failed += 1; continue; }
      for (const planned of plans) {
        report.planned += 1;
        const inserted = await client.query<{ id: string; attempt_count: number }>(`insert into notification_deliveries(school_id,membership_id,subscription_id,notification_type,idempotency_key,scheduled_lesson_id,local_date,scheduled_for,title,body,deep_link,status,attempt_count) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SENDING',1)
          on conflict(idempotency_key) do update set status='SENDING',attempt_count=notification_deliveries.attempt_count+1,error_code=null
          where (notification_deliveries.status='RETRYABLE' or (notification_deliveries.status='SENDING' and notification_deliveries.updated_at<now()-interval '10 minutes')) and notification_deliveries.attempt_count<3 returning id,attempt_count`, [target.school_id,target.membership_id,target.subscription_id,planned.type,planned.idempotencyKey,planned.scheduledLessonId,planned.localDate,planned.scheduledFor,planned.title,planned.body,planned.deepLink]);
        const deliveryId = inserted.rows[0]?.id; const attemptCount = Number(inserted.rows[0]?.attempt_count ?? 0); if (!deliveryId) { report.duplicates += 1; continue; }
        try {
          const response = await send({ subscription: { endpoint: target.endpoint, p256dh: target.p256dh, auth: target.auth_secret }, payload: { title: planned.title, body: planned.body, deepLink: planned.deepLink, tag: planned.idempotencyKey }, vapidPublicKey, vapidPrivateKey, vapidSubject, now });
          if (response.ok) { await client.query("update notification_deliveries set status='SENT',provider_status=$2,sent_at=now() where id=$1", [deliveryId,response.status]); await client.query("update push_subscriptions set last_success_at=now(),failure_count=0 where id=$1", [target.subscription_id]); report.sent += 1; }
          else if (isPermanentPushFailure(response.status)) { await client.query("update notification_deliveries set status='PERMANENT_FAILURE',provider_status=$2,error_code='SUBSCRIPTION_EXPIRED' where id=$1", [deliveryId,response.status]); await client.query("update push_subscriptions set status='EXPIRED',last_failure_at=now(),failure_count=failure_count+1 where id=$1", [target.subscription_id]); report.expired += 1; }
          else if (isRetryablePushFailure(response.status) && attemptCount < 3) { await client.query("update notification_deliveries set status='RETRYABLE',provider_status=$2,error_code='PROVIDER_RETRYABLE' where id=$1", [deliveryId,response.status]); report.retryable += 1; }
          else if (isRetryablePushFailure(response.status)) { await client.query("update notification_deliveries set status='PERMANENT_FAILURE',provider_status=$2,error_code='RETRY_LIMIT_REACHED' where id=$1", [deliveryId,response.status]); report.failed += 1; }
          else { await client.query("update notification_deliveries set status='PERMANENT_FAILURE',provider_status=$2,error_code='PROVIDER_REJECTED' where id=$1", [deliveryId,response.status]); report.failed += 1; }
        } catch { if (attemptCount < 3) { await client.query("update notification_deliveries set status='RETRYABLE',error_code='NETWORK_FAILURE' where id=$1", [deliveryId]); report.retryable += 1; } else { await client.query("update notification_deliveries set status='PERMANENT_FAILURE',error_code='RETRY_LIMIT_REACHED' where id=$1", [deliveryId]); report.failed += 1; } }
      }
    }
    return report;
  } finally { if (shouldClose) await client.close(); }
}
