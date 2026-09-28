"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { userFacingError } from "@/lib/user-facing-error";
import { activateTimetableVersion, confirmTeachingSectionAssignment, createProgrammeEvent as createProgrammeEventCommand, verifyTimetableVersion } from "@/academic-operations/application/commands";

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(160);
const date = z.string().date();
const optionalText = z.preprocess((item) => typeof item === "string" && item.trim() === "" ? undefined : item, text.optional());
const optionalUuid = z.preprocess((item) => typeof item === "string" && item.trim() === "" ? undefined : item, uuid.optional());

type ActionResult = { ok: true } | { ok: false; error: string };
type InvitationResult = ActionResult & { invitationLink?: string; expiresAt?: string };

function result(error: { message?: string } | null): ActionResult {
  return error ? { ok: false, error: userFacingError(error, "The change could not be saved.") } : { ok: true };
}

async function contextFor(roles: string[]) {
  const access = await requireWorkspaceAccess();
  if (!access.roles.some((role) => roles.includes(role))) throw new Error("You are not authorized for this operation.");
  return access;
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function invitationBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && !/^https?:\/\/localhost(?::\d+)?\/?$/i.test(configured)) return new URL(configured).origin;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host) || !["http", "https"].includes(protocol)) throw new Error("The invitation link could not be prepared. Configure NEXT_PUBLIC_APP_URL for this deployment.");
  return `${protocol}://${host}`;
}

export async function createTeacherInvitation(input: { email: string }): Promise<InvitationResult> {
  try {
    const access = await contextFor(["SCHOOL_ADMIN"]);
    const value = z.object({ email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()) }).parse(input);
    const client = createSupabaseServiceRoleClient();
    const baseUrl = await invitationBaseUrl();
    const { data: existing, error: existingError } = await client.from("invitations").select("id").eq("school_id", access.schoolId).eq("email_normalized", value.email).eq("status", "PENDING").gt("expires_at", new Date().toISOString()).maybeSingle();
    if (existingError) return { ok: false, error: userFacingError(existingError, "The existing invitations could not be checked.") };
    if (existing) return { ok: false, error: "An active invitation already exists for this email. Revoke it before generating a replacement link." };

    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invitation, error: invitationError } = await client.from("invitations").insert({ school_id: access.schoolId, email_normalized: value.email, token_hash: hashInvitationToken(rawToken), expires_at: expiresAt, created_by: access.userId }).select("id").single();
    if (invitationError || !invitation) return { ok: false, error: userFacingError(invitationError, "The invitation could not be created.") };

    const { error: grantError } = await client.from("invitation_role_grants").insert({ invitation_id: invitation.id, school_id: access.schoolId, role: "TEACHER", scope_type: "SCHOOL" });
    if (grantError) {
      await client.from("invitations").delete().eq("id", invitation.id).eq("school_id", access.schoolId);
      return { ok: false, error: userFacingError(grantError, "The invitation role could not be saved.") };
    }
    const { error: auditError } = await client.from("audit_events").insert({ school_id: access.schoolId, actor_user_id: access.userId, action: "invitation.created", resource_type: "invitation", resource_id: invitation.id, metadata: { role: "TEACHER", expires_at: expiresAt } });
    if (auditError) {
      await client.from("invitations").delete().eq("id", invitation.id).eq("school_id", access.schoolId);
      return { ok: false, error: userFacingError(auditError, "The invitation could not be audited, so it was not kept.") };
    }

    const invitationLink = `${baseUrl}/invite/accept?token=${encodeURIComponent(rawToken)}`;
    revalidatePath("/workspace/academic-operations");
    return { ok: true, invitationLink, expiresAt };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "The teacher invitation could not be created." }; }
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  try {
    const access = await contextFor(["SCHOOL_ADMIN"]);
    const invitationId = uuid.parse(id);
    const client = createSupabaseServiceRoleClient();
    const { data: invitation, error: invitationError } = await client.from("invitations").update({ status: "REVOKED" }).eq("id", invitationId).eq("school_id", access.schoolId).eq("status", "PENDING").select("id").maybeSingle();
    if (invitationError) return { ok: false, error: userFacingError(invitationError, "The invitation could not be revoked.") };
    if (!invitation) return { ok: false, error: "Only a pending invitation can be revoked." };
    const { error: auditError } = await client.from("audit_events").insert({ school_id: access.schoolId, actor_user_id: access.userId, action: "invitation.revoked", resource_type: "invitation", resource_id: invitationId, metadata: {} });
    if (auditError) return { ok: false, error: userFacingError(auditError, "The invitation was revoked but could not be audited.") };
    revalidatePath("/workspace/academic-operations");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "The invitation could not be revoked." }; }
}

export async function createClassLevel(input: { code: string; name: string; sortOrder: number }): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const value = z.object({ code: text, name: text, sortOrder: z.number().int().min(0) }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("class_levels").insert({ school_id: access.schoolId, code: value.code, name: value.name, sort_order: value.sortOrder }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Class level could not be created." }; }
}

export async function updateClassLevelStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const client = await createSupabaseServerClient(); const response = await client.from("class_levels").update({ status, updated_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("school_id", access.schoolId); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Class level could not be updated." }; }
}

export async function createStream(input: { classLevelId: string; code: string; name: string }): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const value = z.object({ classLevelId: uuid, code: optionalText, name: text }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("streams").insert({ school_id: access.schoolId, class_level_id: value.classLevelId, code: value.code || null, name: value.name }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Stream could not be created." }; }
}

export async function updateStreamStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const client = await createSupabaseServerClient(); const response = await client.from("streams").update({ status, updated_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("school_id", access.schoolId); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Stream could not be updated." }; }
}

export async function createSubject(input: { code: string; name: string; departmentId: string }): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const value = z.object({ code: optionalText, name: text, departmentId: optionalUuid }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("school_subjects").insert({ school_id: access.schoolId, code: value.code || null, name: value.name, department_id: value.departmentId || null }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Subject could not be created." }; }
}

export async function updateSubjectStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  try { const access = await contextFor(["SCHOOL_ADMIN"]); const client = await createSupabaseServerClient(); const response = await client.from("school_subjects").update({ status, updated_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("school_id", access.schoolId); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Subject could not be updated." }; }
}

export async function createTeachingSection(input: { academicPeriodId: string; teacherMembershipId: string; schoolSubjectId: string; classLevelId: string; streamId: string }): Promise<ActionResult> {
  try { const access = await contextFor(["DOS", "SCHOOL_ADMIN"]); const value = z.object({ academicPeriodId: uuid, teacherMembershipId: uuid, schoolSubjectId: uuid, classLevelId: uuid, streamId: uuid }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("teaching_sections").insert({ school_id: access.schoolId, ...{ academic_period_id: value.academicPeriodId, teacher_membership_id: value.teacherMembershipId, school_subject_id: value.schoolSubjectId, class_level_id: value.classLevelId, stream_id: value.streamId }, created_by: access.userId }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Teaching Section could not be created." }; }
}

export async function confirmSection(input: { sectionId: string; decision: "CONFIRMED" | "FLAGGED"; reason?: string }): Promise<ActionResult> {
  try { await confirmTeachingSectionAssignment(input); revalidatePath("/workspace/academic-operations"); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "The assignment could not be updated." }; }
}

export async function createTimetableVersion(input: { academicPeriodId: string; versionNumber: number; name: string; effectiveFrom: string }): Promise<ActionResult> {
  try { const access = await contextFor(["DOS"]); const value = z.object({ academicPeriodId: uuid, versionNumber: z.number().int().positive(), name: text, effectiveFrom: date }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("timetable_versions").insert({ school_id: access.schoolId, academic_period_id: value.academicPeriodId, version_number: value.versionNumber, name: value.name, effective_from: value.effectiveFrom, created_by: access.userId }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Timetable version could not be created." }; }
}

export async function createTimetableSlot(input: { versionId: string; sectionId: string; dayOfWeek: number; startsAt: string; endsAt: string; roomLabel: string }): Promise<ActionResult> {
  try { const access = await contextFor(["DOS"]); const value = z.object({ versionId: uuid, sectionId: uuid, dayOfWeek: z.number().int().min(1).max(7), startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), roomLabel: optionalText }).parse(input); const client = await createSupabaseServerClient(); const response = await client.from("timetable_slots").insert({ school_id: access.schoolId, timetable_version_id: value.versionId, teaching_section_id: value.sectionId, day_of_week: value.dayOfWeek, starts_at: value.startsAt, ends_at: value.endsAt, room_label: value.roomLabel || null }); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Timetable slot could not be created." }; }
}

export async function importTimetableDraft(input: { academicPeriodId: string; versionNumber: number; name: string; effectiveFrom: string; slots: Array<{ sectionId: string; dayOfWeek: number; startsAt: string; endsAt: string; roomLabel: string }> }): Promise<ActionResult> {
  try {
    const access = await contextFor(["DOS"]);
    const value = z.object({ academicPeriodId: uuid, versionNumber: z.number().int().positive(), name: text, effectiveFrom: date, slots: z.array(z.object({ sectionId: uuid, dayOfWeek: z.number().int().min(1).max(7), startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), roomLabel: optionalText })).min(1).max(1000) }).parse(input);
    if (value.slots.some((slot) => slot.endsAt <= slot.startsAt)) return { ok: false, error: "Every imported timetable row must end after it starts." };
    const client = await createSupabaseServerClient();
    const { data: version, error: versionError } = await client.from("timetable_versions").insert({ school_id: access.schoolId, academic_period_id: value.academicPeriodId, version_number: value.versionNumber, name: value.name, effective_from: value.effectiveFrom, created_by: access.userId }).select("id").single();
    if (versionError || !version) return { ok: false, error: userFacingError(versionError, "The timetable draft could not be created.") };
    const { error: slotsError } = await client.from("timetable_slots").insert(value.slots.map((slot) => ({ school_id: access.schoolId, timetable_version_id: version.id, teaching_section_id: slot.sectionId, day_of_week: slot.dayOfWeek, starts_at: slot.startsAt, ends_at: slot.endsAt, room_label: slot.roomLabel || null })));
    if (slotsError) {
      await client.from("timetable_versions").delete().eq("id", version.id).eq("school_id", access.schoolId);
      return { ok: false, error: userFacingError(slotsError, "The imported rows could not be saved. No timetable draft was kept.") };
    }
    revalidatePath("/workspace/academic-operations");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "The timetable import could not be saved." }; }
}

export async function verifyVersion(id: string): Promise<ActionResult> { try { await verifyTimetableVersion({ versionId: id }); revalidatePath("/workspace/academic-operations"); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Timetable verification failed." }; } }
export async function activateVersion(id: string): Promise<ActionResult> { try { await activateTimetableVersion({ versionId: id }); revalidatePath("/workspace/academic-operations"); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Timetable activation failed." }; } }

export async function createProgrammeEvent(input: { academicPeriodId: string; eventType: string; title: string; startsAt: string; endsAt: string; notes: string; targetType?: "SCHOOL" | "CLASS_LEVEL" | "STREAM" | "DEPARTMENT"; targetId?: string | null }): Promise<ActionResult> {
  try { const access = await contextFor(["DOS", "SCHOOL_ADMIN"]); const value = z.object({ academicPeriodId: optionalUuid.transform((item) => item || null), eventType: z.enum(["HOLIDAY", "ASSEMBLY", "SPORTS", "TRIP", "VISITATION", "EXAMINATION", "MOCK", "OTHER"]), title: text, startsAt: z.string().datetime(), endsAt: z.string().datetime(), notes: z.string().trim().max(500).transform((item) => item || null), targetType: z.enum(["SCHOOL", "CLASS_LEVEL", "STREAM", "DEPARTMENT"]).default("SCHOOL"), targetId: z.preprocess((item) => item === "null" || item === "" ? null : item, uuid.nullable().default(null)) }).superRefine((item, refinement) => { if (item.targetType === "SCHOOL" && item.targetId) refinement.addIssue({ code: z.ZodIssueCode.custom, path: ["targetId"], message: "School-wide events do not use a target." }); if (item.targetType !== "SCHOOL" && !item.targetId) refinement.addIssue({ code: z.ZodIssueCode.custom, path: ["targetId"], message: "Choose a target for this scope." }); }).parse(input); await createProgrammeEventCommand({ ...value, schoolId: access.schoolId }); revalidatePath("/workspace/academic-operations"); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Programme event could not be created." }; }
}

export async function cancelProgrammeEvent(id: string): Promise<ActionResult> { try { const access = await contextFor(["DOS", "SCHOOL_ADMIN"]); const client = await createSupabaseServerClient(); const response = await client.from("school_programme_events").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("school_id", access.schoolId); revalidatePath("/workspace/academic-operations"); return result(response.error); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Programme event could not be cancelled." }; } }
