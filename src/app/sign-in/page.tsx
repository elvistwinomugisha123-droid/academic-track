import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";

export default function SignInPage() {
  return <main className="auth-page">
    <section className="auth-rail" aria-label="About ATE">
      <div className="auth-brand"><span className="auth-brand-mark" aria-hidden="true">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></div>
      <div className="auth-rail-copy"><p className="auth-rail-kicker">Academic work, in context</p><p className="auth-rail-title">Continue the teaching day with the class in view.</p><span className="auth-rail-rule" aria-hidden="true" /><p className="auth-rail-note">A calm place to prepare, teach, confirm what happened and carry the work forward.</p></div>
      <p className="auth-rail-footer">For Uganda’s secondary schools</p>
    </section>
    <section className="auth-stage" aria-labelledby="sign-in-title">
      <div className="auth-panel">
        <h1 id="sign-in-title">Sign in to your academic workspace.</h1>
        <p className="auth-lede">Use the account provided by your school.</p>
        <Suspense fallback={<p className="auth-loading" role="status">Loading sign-in…</p>}><SignInForm /></Suspense>
      </div>
    </section>
  </main>;
}
