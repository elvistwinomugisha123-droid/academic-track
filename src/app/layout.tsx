import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PwaRuntime } from "@/components/foundation/PwaRuntime";
import "./globals.css";

export const metadata: Metadata = { title: "ATE · Academic Track Engine", description: "A teacher-first academic operating system foundation.", applicationName: "Academic Track Engine", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "ATE", statusBarStyle: "default" }, icons: { icon: [{ url: "/icons/ate.svg", sizes: "any", type: "image/svg+xml" }] } };
export const viewport: Viewport = { themeColor: "#0b1f3a" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><PwaRuntime />{children}<Analytics /><SpeedInsights /></body></html>; }
