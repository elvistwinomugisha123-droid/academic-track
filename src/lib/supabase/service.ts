import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readEnvironment } from "@/lib/env";

export function createSupabaseServiceRoleClient() {
  const environment = readEnvironment();
  if (!environment.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for trusted server operations.");
  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}
