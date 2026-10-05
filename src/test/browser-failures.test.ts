import { describe, expect, it } from "vitest";
import { isLocalPlaywrightAuthRedirectUrl, isLocalPlaywrightTelemetryUrl } from "../../playwright/browser-failure-policy";

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

  it.each([
    "http://127.0.0.1:3000/workspace/teacher/sections",
    "http://localhost:3000/sign-in?next=%2Fworkspace%2Fteacher%2Fsections",
  ])("recognises only the expected local auth redirect navigation %s", (url) => {
    expect(isLocalPlaywrightAuthRedirectUrl(url, "/workspace/teacher/sections")).toBe(true);
  });

  it.each([
    "https://pilot.example.com/workspace/teacher/sections",
    "http://127.0.0.1:4000/workspace/teacher/sections",
    "http://127.0.0.1:3000/workspace/teacher/sections?unexpected=1",
    "http://127.0.0.1:3000/sign-in?next=%2Fworkspace%2Fteacher%2Fassessments",
    "http://127.0.0.1:3000/sign-in",
    "not a URL",
  ])("does not broaden auth redirect suppression for %s", (url) => {
    expect(isLocalPlaywrightAuthRedirectUrl(url, "/workspace/teacher/sections")).toBe(false);
  });
});
