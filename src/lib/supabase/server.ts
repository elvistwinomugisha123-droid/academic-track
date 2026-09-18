import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicEnvironment, supabasePublicKey } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const environment = readPublicEnvironment();
  return createServerClient(environment.NEXT_PUBLIC_SUPABASE_URL, supabasePublicKey(), {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot write cookies. Middleware owns refresh. */ }
      },
    },
  });
}
