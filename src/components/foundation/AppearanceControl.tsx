"use client";

import { useEffect, useState } from "react";

type Appearance = "system" | "light" | "dark";
const key = "ate-appearance";

function apply(value: Appearance) {
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value === "system" ? "light dark" : value;
  const dark = value === "dark" || value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b2438" : "#0b1f3a");
  localStorage.setItem(key, value);
}

export function AppearanceControl() {
  const [appearance, setAppearance] = useState<Appearance>("system");
  useEffect(() => {
    const stored = localStorage.getItem(key);
    const initial = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setAppearance(initial);
    apply(initial);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => { if (localStorage.getItem(key) === "system") apply("system"); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <label className="appearance-control">Appearance
    <select aria-label="Appearance" value={appearance} onChange={(event) => { const value = event.target.value as Appearance; setAppearance(value); apply(value); }}>
      <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
    </select>
  </label>;
}
