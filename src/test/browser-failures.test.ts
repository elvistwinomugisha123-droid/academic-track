import { describe, expect, it } from "vitest";
import { isLocalPlaywrightTelemetryUrl } from "../../playwright/browser-failure-policy";

describe("Playwright browser failure allow-list", () => {
  it.each([
    "http://127.0.0.1:3000/_vercel/insights/script.js",
    "http://localhost:3000/_vercel/speed-insights/script.js",
  ])("allows the exact local telemetry resource %s", (url) => {
    expect(isLocalPlaywrightTelemetryUrl(url)).toBe(true);
  });

  it.each([
    "https://pilot.example.com/_vercel/insights/script.js",
    "http://127.0.0.1:3000/_vercel/insights/other.js",
    "http://127.0.0.1:3000/unrelated-missing.js",
    "http://127.0.0.1:4000/_vercel/insights/script.js",
    "not a URL",
  ])("preserves failure detection for %s", (url) => {
    expect(isLocalPlaywrightTelemetryUrl(url)).toBe(false);
  });
});
