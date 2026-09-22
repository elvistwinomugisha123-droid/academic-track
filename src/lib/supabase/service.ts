import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readEnvironment } from "@/lib/env";

export function createSupabaseServiceRoleClient() {
  const environment = readEnvironment();
  const isolatedTestProject = "lwbkxhimqlfuzzxilaga";
  const key = environment.NEXT_PUBLIC_SUPABASE_URL.includes(isolatedTestProject)
    ? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || environment.SUPABASE_SERVICE_ROLE_KEY
    : environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("A trusted Supabase service key is required for server operations.");
  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
