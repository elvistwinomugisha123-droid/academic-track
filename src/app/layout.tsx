import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "ATE · Academic Track Engine", description: "A teacher-first academic operating system foundation." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
