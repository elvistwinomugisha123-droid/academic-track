"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [showPassword, setShowPassword] = useState(false); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const retryable = (value: { status?: number; message?: string }) => value.status === 429 || (value.status != null && value.status >= 500) || /fetch|network|timeout|temporarily unavailable/i.test(value.message || "");
  const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const client = createSupabaseBrowserClient();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const { error: signInError } = await client.auth.signInWithPassword({ email, password });
          if (!signInError) break;
          if (!retryable(signInError) || attempt === 2) { setError("We couldn’t sign you in. Check your email and password, then try again."); return; }
        } catch (caughtError) {
          const detail = caughtError instanceof Error ? caughtError.message : "";
          if (attempt === 2 || !retryable({ message: detail })) throw caughtError;
        }
        await pause(350 * (attempt + 1));
      }
      const next = searchParams.get("next"); window.location.assign(next?.startsWith("/") && !next.startsWith("//") ? next : "/workspace");
    } catch (caughtError) {
      if (process.env.NODE_ENV !== "production") console.error("Sign-in failed", caughtError);
      setError("ATE couldn’t reach the sign-in service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return <form className="auth-form" onSubmit={submit} aria-busy={busy}>{searchParams.get("reason") === "session-expired" ? <p className="auth-notice" role="status">Your session ended. Sign in again to continue.</p> : null}<label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}<span>{showPassword ? "Hide password" : "Show password"}</span></button></div>{error ? <p className="auth-error" role="alert">{error}</p> : null}<button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="auth-spinner" size={17} aria-hidden="true" />Signing in…</> : "Sign in"}</button></form>;
}
