import { prepareOneTeacherPilot, type OneTeacherPilotInput } from "./one-teacher-bootstrap";

export interface PilotRpcClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

export type PilotApplicationResult = {
  dryRun: boolean;
  schoolId: string | null;
  academicPeriodId: string | null;
  teacherMembershipId: string | null;
  timetableVersionId: string | null;
  teachingSectionIds: Record<string, string>;
  scheduledLessonsPendingActivation: boolean;
};

/** Runs the narrow, operator-authorised database command. The RPC revalidates
 * Auth identity, tenancy, release eligibility and idempotency inside one SQL
 * transaction. Timetable occurrence creation remains the existing DOS
 * activation command, after section assignments are confirmed by the teacher.
 */
export async function applyOneTeacherPilot(
  client: PilotRpcClient,
  input: OneTeacherPilotInput,
  options: { dryRun: boolean },
): Promise<PilotApplicationResult> {
  const plan = prepareOneTeacherPilot(input);
  const result = await client.rpc("apply_one_teacher_controlled_pilot", { p_plan: plan, p_dry_run: options.dryRun });
  if (result.error) throw new Error(`One-teacher pilot application failed: ${result.error.message}`);
  if (!result.data || typeof result.data !== "object") throw new Error("Pilot application RPC returned no result.");
  const data = result.data as PilotApplicationResult;
  if (data.dryRun !== options.dryRun) throw new Error("Pilot application RPC dry-run state mismatch.");
  return data;
}

/** The existing domain commands generate scheduled lessons after the assigned
 * teacher has confirmed each Teaching Section. This never confirms a position.
 */
export async function activateOneTeacherPilotTimetable(client: PilotRpcClient, timetableVersionId: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(timetableVersionId)) throw new Error("A timetable version UUID is required.");
  for (const name of ["verify_timetable_version", "activate_timetable_version"]) {
    const result = await client.rpc(name, { p_version_id: timetableVersionId });
    if (result.error) throw new Error(`${name} failed: ${result.error.message}`);
  }
}
