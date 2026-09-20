import { createBrowserClient } from "@supabase/ssr";
import { getBrowserPublicEnvironment } from "@/lib/env-public";

export function createSupabaseBrowserClient() {
  const environment = getBrowserPublicEnvironment();
  const publicKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? environment.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(environment.NEXT_PUBLIC_SUPABASE_URL, publicKey);
}
