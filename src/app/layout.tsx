import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "ATE · Academic Track Engine", description: "Teacher-first academic operations for Mount of Olives College" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
