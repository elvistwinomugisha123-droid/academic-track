import { expect, type Page, type Request } from "@playwright/test";
import { isLocalPlaywrightTelemetryUrl } from "./browser-failure-policy";

type BrowserFailureOptions = {
  expectedRequestFailure?: (request: Request, errorText: string) => boolean;
};

export function observeBrowserFailures(page: Page, options: BrowserFailureOptions = {}) {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const sourceUrl = message.location().url;
    if (sourceUrl && isLocalPlaywrightTelemetryUrl(sourceUrl)) return;
    failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText || "failed";
    if (request.method() === "GET" && isLocalPlaywrightTelemetryUrl(request.url())) return;
    if (options.expectedRequestFailure?.(request, errorText)) return;
    failures.push(`request: ${request.method()} ${request.url()} — ${errorText}`);
  });

  return () => expect(failures, "browser console, page and network failures").toEqual([]);
}
