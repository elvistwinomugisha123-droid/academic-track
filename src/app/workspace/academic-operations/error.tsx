"use client";

export default function AcademicOperationsError({ reset }: { reset: () => void }) {
  return <main className="error-state"><section><p className="eyebrow">Academic operations</p><h1>Operations data is unavailable.</h1><p>ATE could not load the school’s operational records. Nothing was treated as empty. Try again, or contact your school administrator if the problem continues.</p><button className="button button-primary" onClick={() => reset()}>Try again</button></section></main>;
}
