"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const router = useRouter(); const searchParams = useSearchParams();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const { error: signInError } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (signInError) { setError("We could not sign you in. Check your details and try again."); setBusy(false); return; }
    const next = searchParams.get("next"); router.replace(next?.startsWith("/") ? next : "/workspace"); router.refresh();
  }
  return <form className="auth-form" onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />{error ? <p className="auth-error" role="alert">{error}</p> : null}<button className="button button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form>;
}
