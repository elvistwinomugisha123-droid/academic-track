"use server";

import { revalidatePath } from "next/cache";
import { confirmClassroomOutcome, correctClassroomOutcome } from "@/academic-operations/application/commands";
import { userFacingError } from "@/lib/user-facing-error";

export type ContinuityActionResult = { ok: true; eventId: string } | { ok: false; error: string };

export async function recordClassroomOutcome(input: unknown): Promise<ContinuityActionResult> {
  try {
    const eventId = await confirmClassroomOutcome(input);
    revalidatePath("/workspace/classroom");
    return { ok: true, eventId };
  } catch (error) {
    return { ok: false, error: userFacingError(error, "The classroom outcome could not be recorded.") };
  }
}

export async function correctRecordedOutcome(input: unknown): Promise<ContinuityActionResult> {
  try {
    const eventId = await correctClassroomOutcome(input);
    revalidatePath("/workspace/classroom");
    return { ok: true, eventId };
  } catch (error) {
    return { ok: false, error: userFacingError(error, "The classroom record could not be corrected.") };
  }
}
