export type HealthStatus = "PASS" | "FAIL" | "WARN";
export type HealthCheck = { id: string; label: string; status: HealthStatus; mandatory: boolean; detail: string };
export type PilotHealthReport = { schemaVersion: "ate-pilot-health-v1"; generatedAt: string; status: "READY" | "NOT_READY"; checks: HealthCheck[] };

export interface PilotHealthProbes {
  database(): Promise<{ reachable: boolean; migrationContractCurrent: boolean; detail: string }>;
  auth(url: string, key: string): Promise<{ reachable: boolean; detail: string }>;
  curriculum(): Promise<{ available: boolean; detail: string }>;
  bindings(): Promise<{ valid: boolean; detail: string }>;
  pwa(): Promise<{ configured: boolean; detail: string }>;
  notifications(): Promise<{ configured: boolean; detail: string }>;
}

function check(id: string, label: string, status: HealthStatus, mandatory: boolean, detail: string): HealthCheck { return { id, label, status, mandatory, detail }; }
function projectRefFromSupabaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try { const match = new URL(value).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i); return match?.[1] ?? null; } catch { return null; }
}
function databaseTargetsRef(value: string | undefined, expectedRef: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.hostname === `db.${expectedRef}.supabase.co`
      || (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username) === `postgres.${expectedRef}`);
  } catch { return false; }
}

export async function runPilotHealthCheck(input: { env: NodeJS.ProcessEnv; probes: PilotHealthProbes; now?: Date }): Promise<PilotHealthReport> {
  const { env, probes } = input;
  const checks: HealthCheck[] = [];
  const environmentName = env.ATE_ENVIRONMENT?.trim();
  checks.push(check("environment.identity", "Environment identity", environmentName === "pilot" ? "PASS" : "FAIL", true,
    environmentName === "pilot" ? "ATE_ENVIRONMENT identifies the controlled pilot." : "ATE_ENVIRONMENT must be exactly 'pilot'."));

  const required = ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "EXPECTED_SUPABASE_PROJECT_REF"];
  const missing = required.filter((name) => !env[name]?.trim());
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!publicKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  checks.push(check("environment.required", "Required environment", missing.length ? "FAIL" : "PASS", true,
    missing.length ? `Missing: ${missing.join(", ")}.` : "All mandatory configuration names are present; values are not printed."));

  const expectedRef = env.EXPECTED_SUPABASE_PROJECT_REF?.trim() ?? "";
  const publicRef = projectRefFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const projectMatches = Boolean(expectedRef && publicRef === expectedRef && databaseTargetsRef(env.DATABASE_URL, expectedRef));
  checks.push(check("supabase.project", "Expected Supabase project", projectMatches ? "PASS" : "FAIL", true,
    projectMatches ? `Public API and database target expected project ref ${expectedRef}.` : "Public API and database must both target EXPECTED_SUPABASE_PROJECT_REF; TEST or ambiguous targets fail closed."));

  let database = { reachable: false, migrationContractCurrent: false, detail: "Not checked because database configuration is incomplete." };
  if (env.DATABASE_URL && projectMatches) {
    try { database = await probes.database(); } catch { database = { reachable: false, migrationContractCurrent: false, detail: "Database probe failed without exposing connection details." }; }
  }
  checks.push(check("database.reachability", "Database reachability", database.reachable ? "PASS" : "FAIL", true, database.detail));
  checks.push(check("database.migrations", "Migration/schema contract", database.reachable && database.migrationContractCurrent ? "PASS" : "FAIL", true,
    database.reachable ? database.detail : "Migration state cannot pass until the database is reachable."));

  let auth = { reachable: false, detail: "Not checked because Supabase public configuration is incomplete." };
  if (env.NEXT_PUBLIC_SUPABASE_URL && publicKey && projectMatches) {
    try { auth = await probes.auth(env.NEXT_PUBLIC_SUPABASE_URL, publicKey); } catch { auth = { reachable: false, detail: "Auth health probe failed." }; }
  }
  checks.push(check("auth.health", "Supabase Auth", auth.reachable ? "PASS" : "FAIL", true, auth.detail));

  const anthropicConfigured = (!env.AI_DEFAULT_PROVIDER || env.AI_DEFAULT_PROVIDER === "anthropic") && Boolean(env.ANTHROPIC_API_KEY?.trim() && env.ANTHROPIC_MODEL?.trim());
  checks.push(check("anthropic.configuration", "Anthropic configuration", anthropicConfigured ? "PASS" : "FAIL", true,
    anthropicConfigured ? "Provider, explicit model and server-only API key are configured; sensitive values are not printed." : "ANTHROPIC_API_KEY and ANTHROPIC_MODEL are mandatory and AI_DEFAULT_PROVIDER must be anthropic or unset."));

  let curriculum = { available: false, detail: "Not checked because the database is unavailable." };
  let bindings = { valid: false, detail: "Not checked because the database is unavailable." };
  if (database.reachable && database.migrationContractCurrent) {
    try { curriculum = await probes.curriculum(); } catch { curriculum = { available: false, detail: "Curriculum runtime probe failed." }; }
    try { bindings = await probes.bindings(); } catch { bindings = { valid: false, detail: "Curriculum binding probe failed." }; }
  }
  checks.push(check("curriculum.runtime", "Curriculum runtime", curriculum.available ? "PASS" : "FAIL", true, curriculum.detail));
  checks.push(check("curriculum.bindings", "Required bindings", bindings.valid ? "PASS" : "FAIL", true, bindings.detail));

  let pwa = { configured: false, detail: "PWA probe failed." };
  let notifications = { configured: false, detail: "Notification probe failed." };
  try { pwa = await probes.pwa(); } catch { /* fail closed */ }
  try { notifications = await probes.notifications(); } catch { /* fail closed */ }
  checks.push(check("pwa.configuration", "PWA configuration", pwa.configured ? "PASS" : "FAIL", true, pwa.detail));
  checks.push(check("notifications.configuration", "Notification configuration", notifications.configured ? "PASS" : "FAIL", true, notifications.detail));

  const deploymentAvailable = Boolean(env.VERCEL && env.VERCEL_GIT_COMMIT_SHA && (env.VERCEL_DEPLOYMENT_ID || env.VERCEL_URL));
  checks.push(check("deployment.metadata", "Deployment metadata", deploymentAvailable ? "PASS" : "FAIL", true,
    deploymentAvailable ? "Vercel deployment and commit metadata are available." : "VERCEL, VERCEL_GIT_COMMIT_SHA and VERCEL_DEPLOYMENT_ID or VERCEL_URL are required in the pilot deployment."));

  return { schemaVersion: "ate-pilot-health-v1", generatedAt: (input.now ?? new Date()).toISOString(), status: checks.every((item) => !item.mandatory || item.status === "PASS") ? "READY" : "NOT_READY", checks };
}
