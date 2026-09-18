import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { hasSupabasePublicEnvironment, PublicEnvironmentSchema, supabasePublicKey } from "@/lib/env-public";

export async function updateSupabaseSession(request: NextRequest) {
  if (!hasSupabasePublicEnvironment()) {
    if (process.env.NODE_ENV === "production") throw new Error("Supabase authentication is not configured.");
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });
  const environment = PublicEnvironmentSchema.parse(process.env);
  const supabase = createServerClient(environment.NEXT_PUBLIC_SUPABASE_URL, supabasePublicKey(), {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
