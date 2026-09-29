"use client";

import { useEffect, useState } from "react";
import { greetingAt } from "@/teacher/domain/greeting";

export function TeacherGreeting({ firstName, schoolName, timeZone, initialNow }: {
  firstName: string;
  schoolName: string;
  timeZone: string;
  initialNow: string;
}) {
  const [now, setNow] = useState(() => new Date(initialNow));

  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const date = new Intl.DateTimeFormat("en-UG", { weekday: "long", day: "numeric", month: "long", timeZone }).format(now);
  return <header className="teacher-heading"><div><p className="eyebrow">Teacher home</p><h1>{greetingAt(now, timeZone)}, {firstName}.</h1><p className="lede">{date} · {schoolName}</p></div></header>;
}
