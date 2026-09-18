"use client";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
export function SignOutButton() { const router = useRouter(); return <button className="button" type="button" onClick={async () => { await createSupabaseBrowserClient().auth.signOut(); router.replace("/sign-in"); router.refresh(); }}>Sign out</button>; }
