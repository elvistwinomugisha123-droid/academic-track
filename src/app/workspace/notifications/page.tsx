import { AppShell } from "@/components/foundation/AppShell";
import { NotificationSettingsPanel } from "@/components/notifications/NotificationSettings";
import { loadNotificationSettings } from "@/notifications/application";
import { redirect } from "next/navigation";

export default async function NotificationsPage() { const { access, settings } = await loadNotificationSettings(); if (!access.roles.includes("TEACHER")) redirect("/access-denied"); return <AppShell activePath="/workspace/notifications" access={access}><NotificationSettingsPanel settings={settings} /></AppShell>; }
