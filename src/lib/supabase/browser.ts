import { createBrowserClient } from "@supabase/ssr";
import { PublicEnvironmentSchema, supabasePublicKey } from "@/lib/env-public";

export function createSupabaseBrowserClient() {
  const environment = PublicEnvironmentSchema.parse(process.env);
  return createBrowserClient(environment.NEXT_PUBLIC_SUPABASE_URL, supabasePublicKey());
}
