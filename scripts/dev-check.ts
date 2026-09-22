import fs from "node:fs";
import postgres from "postgres";

const TEST_PROJECT_REF = "lwbkxhimqlfuzzxilaga";
const REQUIRED_TABLES = ["schools", "memberships", "teaching_sections", "scheduled_lessons", "knowledge_records"];

function loadLocalEnvironment() {
  const path = ".env.local";
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function pass(label: string, detail = "") {
  console.log(`${label}: PASS${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, detail: string) {
  console.log(`${label}: FAIL — ${detail}`);
}

async function checkHttp(url: string, headers: Record<string, string>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      if (response.ok) return response;
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function check() {
  loadLocalEnvironment();
  let failures = 0;
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const testUrl = process.env.TEST_SUPABASE_URL;
  const testKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (publicUrl && publicKey) pass("Supabase public config");
  else { fail("Supabase public config", "set NEXT_PUBLIC_SUPABASE_URL and a publishable or anon key"); failures += 1; }

  let testHost = "";
  try { testHost = testUrl ? new URL(testUrl).hostname : ""; } catch { /* reported below */ }
  if (testUrl && testKey && testHost.includes(TEST_PROJECT_REF)) pass("TEST Supabase config", "isolated project configured");
  else { fail("TEST Supabase config", `set TEST_SUPABASE_URL and TEST_SUPABASE_PUBLISHABLE_KEY for ${TEST_PROJECT_REF}`); failures += 1; }

  if (testUrl && testKey) {
    try {
      const response = await checkHttp(`${testUrl.replace(/\/$/, "")}/auth/v1/health`, { apikey: testKey });
      if (response.ok) pass("Supabase connectivity");
      else { fail("Supabase connectivity", `TEST Auth returned HTTP ${response.status}`); failures += 1; }
    } catch { fail("Supabase connectivity", "the isolated TEST project could not be reached"); failures += 1; }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail("Database URL configured", "set DATABASE_URL for the isolated TEST database");
    failures += 1;
    fail("Database connectivity", "not checked because DATABASE_URL is missing");
    fail("Required migrations", "not checked because DATABASE_URL is missing");
  } else {
    pass("Database URL configured");
    const sql = postgres(databaseUrl, { max: 1, connect_timeout: 8, idle_timeout: 2, ssl: "require" });
    try {
      await sql`select 1`;
      pass("Database connectivity");
      const rows = await sql<{ table_name: string }[]>`select table_name from information_schema.tables where table_schema = 'public' and table_name in ${sql(REQUIRED_TABLES)}`;
      const present = new Set(rows.map((row) => row.table_name));
      const missing = REQUIRED_TABLES.filter((table) => !present.has(table));
      if (missing.length === 0) pass("Required migrations", "core ATE tables are present");
      else { fail("Required migrations", `missing core tables: ${missing.join(", ")}`); failures += 1; }
    } catch { fail("Database connectivity", "the configured TEST database could not be reached"); failures += 1; fail("Required migrations", "not checked because the database connection failed"); }
    finally { await sql.end({ timeout: 2 }); }
  }

  if (serviceKey) pass("Auth", "server-side auth configuration present");
  else { fail("Auth", "set TEST_SUPABASE_SERVICE_ROLE_KEY for fixture setup and auth checks"); failures += 1; }

  console.log(`AI key: ${process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ? "AVAILABLE" : "OPTIONAL UNAVAILABLE"}`);
  if (failures > 0) process.exitCode = 1;
}

check().catch(() => {
  console.log("Readiness check: FAIL — unable to complete the local configuration check");
  process.exitCode = 1;
});
