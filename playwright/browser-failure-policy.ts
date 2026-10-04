const LOCAL_PLAYWRIGHT_HOSTS = new Set(["127.0.0.1", "localhost"]);
const VERCEL_TELEMETRY_PATHS = new Set([
  "/_vercel/insights/script.js",
  "/_vercel/speed-insights/script.js",
]);

export function isLocalPlaywrightTelemetryUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:"
      && LOCAL_PLAYWRIGHT_HOSTS.has(url.hostname)
      && url.port === "3000"
      && VERCEL_TELEMETRY_PATHS.has(url.pathname);
  } catch {
    return false;
  }
}
