const LOCAL_PLAYWRIGHT_HOSTS = new Set(["127.0.0.1", "localhost"]);
const VERCEL_TELEMETRY_PATHS = new Set([
  "/_vercel/insights/script.js",
  "/_vercel/speed-insights/script.js",
]);

function localPlaywrightUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:"
      && LOCAL_PLAYWRIGHT_HOSTS.has(url.hostname)
      && url.port === "3000"
      ? url
      : null;
  } catch {
    return null;
  }
}

export function isLocalPlaywrightTelemetryUrl(value: string) {
  const url = localPlaywrightUrl(value);
  return Boolean(url && VERCEL_TELEMETRY_PATHS.has(url.pathname));
}

export function isLocalPlaywrightAuthRedirectUrl(value: string, protectedPath: string) {
  const url = localPlaywrightUrl(value);
  if (!url) return false;
  if (url.pathname === protectedPath && !url.search) return true;
  return url.pathname === "/sign-in" && url.searchParams.get("next") === protectedPath;
}
