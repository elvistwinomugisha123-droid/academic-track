import Link from "next/link";

export default function NotFound() {
  return <main className="error-state"><section aria-labelledby="not-found-title"><p className="eyebrow">Academic workspace</p><h1 id="not-found-title">We could not find that page.</h1><p>Check the address or return to the workspace. No academic record was changed.</p><Link className="button button-primary" href="/workspace">Return to workspace</Link></section></main>;
}
