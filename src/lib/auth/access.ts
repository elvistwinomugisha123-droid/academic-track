import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AccessContext = { userId: string; schoolId: string; membershipId: string; displayName: string; roles: string[] };

export async function resolveAccessContext(schoolId?: string): Promise<AccessContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let query = supabase.from("memberships").select("id, school_id, display_name, role_grants(role, status)").eq("user_id", user.id).eq("status", "ACTIVE");
  if (schoolId) query = query.eq("school_id", schoolId);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const grants = Array.isArray(data.role_grants) ? data.role_grants : [];
  return { userId: user.id, schoolId: data.school_id, membershipId: data.id, displayName: data.display_name, roles: grants.filter((grant) => grant.status === "ACTIVE").map((grant) => grant.role) };
}

export async function requireWorkspaceAccess(schoolId?: string) {
  const context = await resolveAccessContext(schoolId);
  if (context) return context;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/no-membership" : "/sign-in?next=/workspace");
}
