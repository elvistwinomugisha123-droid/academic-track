import Link from "next/link";

export default async function SessionExpiredPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next?.startsWith("/") ? (await searchParams).next! : "/workspace";
  return <main className="auth-page"><section className="auth-panel" aria-labelledby="session-title"><div className="brand-mark">A</div><p className="eyebrow">Sign-in required</p><h1 id="session-title">Your session has expired.</h1><p className="lede">Sign in again to return to your academic workspace. No institutional state was changed.</p><Link className="button button-primary" href={`/sign-in?next=${encodeURIComponent(next)}&reason=session-expired`}>Sign in again</Link></section></main>;
}
