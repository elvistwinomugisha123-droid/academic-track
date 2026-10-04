"use client";

import { Bell, BellOff, Smartphone } from "lucide-react";
import { useState, useTransition } from "react";
import { registerPushSubscription, saveNotificationPreferences, type NotificationSettings } from "@/notifications/application";

function decodeKey(value: string) { const padding = "=".repeat((4 - value.length % 4) % 4); const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (character) => character.charCodeAt(0)); }

export function NotificationSettingsPanel({ settings }: { settings: NotificationSettings }) {
  const [preferences, setPreferences] = useState(settings.preferences); const [message, setMessage] = useState(""); const [pending, startTransition] = useTransition();
  const update = (key: keyof typeof preferences, value: boolean | number | string) => setPreferences((current) => ({ ...current, [key]: value }));
  const subscribe = () => startTransition(async () => {
    if (!settings.vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) { setMessage("Push notifications are not configured for this deployment or browser."); return; }
    const permission = await Notification.requestPermission(); if (permission !== "granted") { setMessage("Notification permission was not granted. You can keep using ATE without push notifications."); return; }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(settings.vapidPublicKey) as BufferSource });
    const result = await registerPushSubscription(subscription.toJSON());
    setMessage(result.ok ? "This device is registered. Save your preferences to enable the reminders you want." : result.error);
  });
  const save = () => startTransition(async () => { const result = await saveNotificationPreferences(preferences); setMessage(result.ok ? "Notification preferences saved." : result.error); });
  return <div className="notification-settings">
    <header className="notification-heading"><span className="notification-icon"><Bell size={22} /></span><div><span className="section-kicker">Useful, bounded reminders</span><h1>Teaching notifications</h1><p>ATE uses your verified timetable and classroom records. Notifications never decide whether a lesson was taught.</p></div></header>
    {!settings.vapidPublicKey && <div className="teacher-message warning" role="status"><BellOff size={17} />Push delivery is not configured for this deployment.</div>}
    <section className="notification-card"><div><h2>Register this device</h2><p>Each browser is registered separately. Locked-screen text contains only the minimum teaching context.</p></div><button className="button button-primary" type="button" disabled={pending || !settings.vapidPublicKey} onClick={subscribe}><Smartphone size={17} />Enable on this device</button><small>{settings.subscriptions.length} active device{settings.subscriptions.length === 1 ? "" : "s"} · School timezone: {settings.timezone}</small></section>
    <section className="notification-card"><div><h2>Preferences</h2><p>Missing-record reminders are bounded to the first 24 hours after a lesson.</p></div>
      <label className="toggle-row"><span><strong>Allow teaching notifications</strong><small>Master switch for all ATE push reminders.</small></span><input type="checkbox" checked={preferences.notificationsEnabled} onChange={(event) => update("notificationsEnabled", event.target.checked)} /></label>
      {[["morningBrief","Morning teaching brief"],["upcomingLesson","Upcoming lesson"],["recoveryAlert","Unfinished-work recovery"],["missingRecord","Missing classroom record"]].map(([key,label]) => <label className="toggle-row" key={key}><span><strong>{label}</strong></span><input type="checkbox" checked={Boolean(preferences[key as keyof typeof preferences])} onChange={(event) => update(key as keyof typeof preferences, event.target.checked)} disabled={!preferences.notificationsEnabled} /></label>)}
      <div className="notification-time-row"><label>Morning brief time<input type="time" value={preferences.morningBriefTime} onChange={(event) => update("morningBriefTime", event.target.value)} /></label><label>Lesson reminder<select value={preferences.upcomingLeadMinutes} onChange={(event) => update("upcomingLeadMinutes", Number(event.target.value))}><option value={10}>10 minutes before</option><option value={20}>20 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option></select></label></div>
      <button className="button button-primary" type="button" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save preferences"}</button>
    </section>{message && <p className="teacher-message" role="status">{message}</p>}
  </div>;
}
