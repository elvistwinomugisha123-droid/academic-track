"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("ATE route error", error);
  }, [error]);

  return <main className="error-state"><section aria-labelledby="error-title"><p className="eyebrow">Academic workspace</p><h1 id="error-title">This workspace could not load.</h1><p>Something interrupted the page before it was ready. Your saved academic records were not changed. Try again, and contact your school administrator if the problem continues.</p><button className="button button-primary" type="button" onClick={reset}>Try again</button></section></main>;
}
