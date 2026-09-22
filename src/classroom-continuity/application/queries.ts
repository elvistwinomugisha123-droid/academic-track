import "server-only";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withTransientReadRetry } from "@/lib/supabase/retry";

export type ContinuityRow = {
  lesson_id: string;
  teaching_section_id: string;
  school_id: string;
  scheduled_date: string;
  starts_at: string;
  ends_at: string;
  class_level_name: string;
  stream_name: string;
  subject_name: string;
  teacher_membership_id: string;
  outcome: "DELIVERED" | "PARTIALLY_DELIVERED" | "NOT_DELIVERED" | "CHANGED" | null;
  event_id: string | null;
  reason: string | null;
  note: string | null;
  confirmed_at: string | null;
  lesson_state: "CLEAR" | "PARTIAL_CARRY_FORWARD" | "NOT_DELIVERED_CARRY_FORWARD" | "CHANGED_REVIEW" | "UNCONFIRMED" | "SCHEDULED";
  carry_forward_state: "PARTIAL_CARRY_FORWARD" | "NOT_DELIVERED_CARRY_FORWARD" | "CHANGED_REVIEW" | null;
  previous_lesson_id: string | null;
  school_timezone: string;
  is_today: boolean;
  can_confirm: boolean;
  can_correct: boolean;
};

export type ClassroomContinuityData = {
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  scope: "MY" | "DEPARTMENT" | "SCHOOL";
  lessons: ContinuityRow[];
};

function scopeFor(roles: string[]): ClassroomContinuityData["scope"] {
  if (roles.includes("DOS")) return "SCHOOL";
  if (roles.includes("PRINCIPAL")) return "SCHOOL";
  if (roles.includes("HOD")) return "DEPARTMENT";
  return "MY";
}

async function loadClassroomContinuityDataOnce(nextPath = "/workspace/classroom"): Promise<ClassroomContinuityData> {
  const access = await requireWorkspaceAccess(undefined, nextPath);
  const scope = scopeFor(access.roles);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_classroom_continuity", { p_scope: scope });
  if (error) throw new Error("Classroom continuity could not be loaded.");
  return { access, scope, lessons: (data ?? []) as ContinuityRow[] };
}

export async function loadClassroomContinuityData(nextPath = "/workspace/classroom"): Promise<ClassroomContinuityData> {
  return withTransientReadRetry(() => loadClassroomContinuityDataOnce(nextPath), { label: "Classroom continuity read model", attempts: 3, delayMs: 250 });
}
