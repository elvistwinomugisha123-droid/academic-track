import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const admin = url && serviceKey ? createClient(url, serviceKey) : null;
const suffix = `security-${Date.now()}`;

type TestUser = { id: string; email: string; password: string; client: SupabaseClient };
let schoolA = "";
let schoolB = "";
let biologyA = "";
let chemistryA = "";
let teacherA: TestUser;
let hodA: TestUser;
let adminA: TestUser;
let invitedUser: TestUser;
let unverifiedUser: TestUser;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const requireError = (error: unknown) => expect(error).toBeTruthy();

async function createTestUser(label: string, emailConfirmed = true): Promise<TestUser> {
  const email = `${suffix}-${label}@example.test`;
  const password = `Ate-${suffix}-${label}-Password!`;
  const { data, error } = await admin!.auth.admin.createUser({ email, password, email_confirm: emailConfirmed });
  if (error || !data.user) throw error ?? new Error(`Could not create ${label}`);
  return { id: data.user.id, email, password, client: createClient(url!, publishableKey!) };
}

async function signIn(user: TestUser) {
  const { error } = await user.client.auth.signInWithPassword({ email: user.email, password: user.password });
  expect(error).toBeNull();
}

async function createInvitation(email: string, roles: Array<{ role: string; scope_type: string; department_id?: string }>, expiresAt = new Date(Date.now() + 60_000).toISOString()) {
  const token = randomBytes(32).toString("hex");
  const { data, error } = await admin!.from("invitations").insert({ school_id: schoolA, email_normalized: email.toLowerCase(), token_hash: hashToken(token), expires_at: expiresAt, created_by: adminA.id }).select("id").single();
  if (error || !data) throw error ?? new Error("Could not create invitation");
  const { error: grantError } = await admin!.from("invitation_role_grants").insert(roles.map((role) => ({ ...role, invitation_id: data.id, school_id: schoolA })));
  if (grantError) throw grantError;
  return token;
}

async function insertFile(file: Record<string, unknown>) {
  const { data, error } = await admin!.from("school_files").insert(file).select("id").single();
  if (error || !data) throw error ?? new Error("Could not create file metadata");
  return data.id as string;
}

describe("isolated Supabase security integration", () => {
  beforeAll(async () => {
    if (!url || !publishableKey || !serviceKey) throw new Error("Security integration tests require TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY, and TEST_SUPABASE_SERVICE_ROLE_KEY for the isolated test project. No production project is permitted.");
    if (!admin) throw new Error("Unable to create the isolated Supabase admin client.");
    teacherA = await createTestUser("teacher");
    hodA = await createTestUser("hod");
    adminA = await createTestUser("admin");
    invitedUser = await createTestUser("invitee");
    unverifiedUser = await createTestUser("unverified", false);
    const { data: schools, error: schoolError } = await admin.from("schools").insert([{ name: "Security Test School A", slug: `${suffix}-a` }, { name: "Security Test School B", slug: `${suffix}-b` }]).select("id, slug");
    if (schoolError || !schools || schools.length !== 2) throw schoolError ?? new Error("Could not create test schools");
    schoolA = schools.find((school) => school.slug.endsWith("-a"))!.id;
    schoolB = schools.find((school) => school.slug.endsWith("-b"))!.id;
    const { data: departments, error: departmentError } = await admin.from("departments").insert([{ school_id: schoolA, name: "Biology", code: `${suffix}-BIO` }, { school_id: schoolA, name: "Chemistry", code: `${suffix}-CHEM` }]).select("id, code");
    if (departmentError || !departments || departments.length !== 2) throw departmentError ?? new Error("Could not create departments");
    biologyA = departments.find((department) => department.code.endsWith("-BIO"))!.id;
    chemistryA = departments.find((department) => department.code.endsWith("-CHEM"))!.id;
    const memberships = [teacherA, hodA, adminA].map((user) => ({ school_id: schoolA, user_id: user.id, status: "ACTIVE", display_name: user.email, joined_at: new Date().toISOString() }));
    const { data: membershipRows, error: membershipError } = await admin.from("memberships").insert(memberships).select("id, user_id");
    if (membershipError || !membershipRows) throw membershipError ?? new Error("Could not create memberships");
    const membershipId = (user: TestUser) => membershipRows.find((membership) => membership.user_id === user.id)!.id;
    const { error: roleError } = await admin.from("role_grants").insert([{ membership_id: membershipId(teacherA), school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: adminA.id }, { membership_id: membershipId(hodA), school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: adminA.id }, { membership_id: membershipId(hodA), school_id: schoolA, role: "HOD", scope_type: "DEPARTMENT", department_id: biologyA, granted_by: adminA.id }, { membership_id: membershipId(adminA), school_id: schoolA, role: "SCHOOL_ADMIN", scope_type: "SCHOOL", granted_by: adminA.id }]);
    if (roleError) throw roleError;
    await Promise.all([signIn(teacherA), signIn(hodA), signIn(adminA)]);
    for (const bucket of ["school-files", "school-exports", "restricted-files"]) await admin.storage.createBucket(bucket, { public: false }).catch(() => undefined);
  });

  afterAll(async () => {
    if (!admin) return;
    const userIds = [teacherA?.id, hodA?.id, adminA?.id, invitedUser?.id, unverifiedUser?.id].filter(Boolean);
    if (schoolA) {
      await admin.from("audit_events").delete().eq("school_id", schoolA);
      await admin.from("school_files").delete().eq("school_id", schoolA);
      await admin.from("role_grants").delete().eq("school_id", schoolA);
      await admin.from("invitation_role_grants").delete().eq("school_id", schoolA);
      await admin.from("invitations").delete().eq("school_id", schoolA);
      await admin.from("memberships").delete().eq("school_id", schoolA);
      await admin.from("departments").delete().eq("school_id", schoolA);
    }
    if (schoolB) await admin.from("schools").delete().eq("id", schoolB);
    if (schoolA) await admin.from("schools").delete().eq("id", schoolA);
    for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
  });

  it("requires explicit isolated test-project configuration", () => { expect(url).toMatch(/^https:\/\//); expect(serviceKey).toBeTruthy(); });

  it("denies anonymous access and prevents cross-tenant reads and writes", async () => {
    const anonymous = createClient(url!, publishableKey!);
    const { data: anonymousSchools, error: anonymousError } = await anonymous.from("schools").select("id");
    expect(anonymousSchools).toBeNull(); requireError(anonymousError);
    const { data: visible, error: readError } = await teacherA.client.from("schools").select("id");
    expect(readError).toBeNull(); expect(visible?.map((row) => row.id)).toEqual([schoolA]);
    requireError((await teacherA.client.from("academic_periods").insert({ school_id: schoolB, name: "Cross tenant", period_type: "TERM", academic_year: 2026, starts_on: "2026-01-01", ends_on: "2026-03-31" })).error);
  });

  it("keeps internal knowledge governance tables outside direct browser access", async () => {
    const anonymous = createClient(url!, publishableKey!);
    const anonymousResult = await anonymous.from("knowledge_runtime_decisions").select("decision_id").limit(1);
    expect(anonymousResult.data).toBeNull(); requireError(anonymousResult.error);
    const authenticatedResult = await teacherA.client.from("knowledge_runtime_decisions").select("decision_id").limit(1);
    expect(authenticatedResult.data).toBeNull(); requireError(authenticatedResult.error);
  });

  it("denies inactive memberships and applies role revocation immediately", async () => {
    await admin!.from("memberships").update({ status: "SUSPENDED" }).eq("school_id", schoolA).eq("user_id", teacherA.id);
    expect((await teacherA.client.from("schools").select("id")).data).toEqual([]);
    await admin!.from("memberships").update({ status: "ACTIVE" }).eq("school_id", schoolA).eq("user_id", teacherA.id);
    const membership = await admin!.from("memberships").select("id").eq("school_id", schoolA).eq("user_id", teacherA.id).single();
    await admin!.from("role_grants").insert({ membership_id: membership.data!.id, school_id: schoolA, role: "PRINCIPAL", scope_type: "SCHOOL", granted_by: adminA.id });
    const fileId = await insertFile({ school_id: schoolA, bucket_id: "restricted-files", object_path: `${schoolA}/revocation-test.txt`, file_kind: "test", classification: "RESTRICTED", mime_type: "text/plain", size_bytes: 1, uploaded_by: adminA.id });
    expect((await teacherA.client.from("school_files").select("id").eq("id", fileId)).data).toHaveLength(1);
    await admin!.from("role_grants").update({ status: "REVOKED", revoked_at: new Date().toISOString() }).eq("membership_id", membership.data!.id).eq("role", "PRINCIPAL");
    expect((await teacherA.client.from("school_files").select("id").eq("id", fileId)).data).toEqual([]);
  });

  it("prevents membership tenant and identity changes", async () => {
    const membership = await admin!.from("memberships").select("id").eq("school_id", schoolA).eq("user_id", teacherA.id).single();
    requireError((await adminA.client.from("memberships").update({ school_id: schoolB, user_id: hodA.id }).eq("id", membership.data!.id)).error);
    expect((await admin!.from("memberships").select("school_id, user_id").eq("id", membership.data!.id).single()).data).toEqual({ school_id: schoolA, user_id: teacherA.id });
  });

  it("enforces role scope and uniqueness, and does not give a teacher HOD authority", async () => {
    const membership = await admin!.from("memberships").select("id").eq("school_id", schoolA).eq("user_id", teacherA.id).single();
    requireError((await admin!.from("role_grants").insert({ membership_id: membership.data!.id, school_id: schoolA, role: "HOD", scope_type: "SCHOOL", granted_by: adminA.id })).error);
    requireError((await teacherA.client.from("role_grants").insert({ membership_id: membership.data!.id, school_id: schoolA, role: "HOD", scope_type: "DEPARTMENT", department_id: biologyA })).error);
    requireError((await admin!.from("role_grants").insert({ membership_id: membership.data!.id, school_id: schoolA, role: "TEACHER", scope_type: "SCHOOL", granted_by: adminA.id })).error);
    const hodMembership = await admin!.from("memberships").select("id").eq("user_id", hodA.id).single();
    expect((await admin!.from("role_grants").insert({ membership_id: hodMembership.data!.id, school_id: schoolA, role: "HOD", scope_type: "DEPARTMENT", department_id: chemistryA, granted_by: adminA.id })).error).toBeNull();
    await admin!.from("role_grants").delete().eq("membership_id", hodMembership.data!.id).eq("department_id", chemistryA);
  });

  it("requires verified matching email and rejects expired or reused invitations", async () => {
    const wrongEmailToken = await createInvitation(invitedUser.email, [{ role: "TEACHER", scope_type: "SCHOOL" }]);
    requireError((await hodA.client.rpc("accept_invitation", { raw_token: wrongEmailToken })).error);
    const expiredToken = await createInvitation(invitedUser.email, [{ role: "TEACHER", scope_type: "SCHOOL" }], new Date(Date.now() - 1_000).toISOString());
    await signIn(invitedUser); requireError((await invitedUser.client.rpc("accept_invitation", { raw_token: expiredToken })).error);
    const validToken = await createInvitation(invitedUser.email, [{ role: "TEACHER", scope_type: "SCHOOL" }]);
    expect((await invitedUser.client.rpc("accept_invitation", { raw_token: validToken })).error).toBeNull();
    requireError((await invitedUser.client.rpc("accept_invitation", { raw_token: validToken })).error);
    const unverifiedToken = await createInvitation(unverifiedUser.email, [{ role: "TEACHER", scope_type: "SCHOOL" }]);
    const signInResult = await unverifiedUser.client.auth.signInWithPassword({ email: unverifiedUser.email, password: unverifiedUser.password });
    if (signInResult.error) expect(signInResult.error).toBeTruthy(); else requireError((await unverifiedUser.client.rpc("accept_invitation", { raw_token: unverifiedToken })).error);
  });

  it("applies all invitation role grants atomically", async () => {
    const token = await createInvitation(invitedUser.email, [{ role: "TEACHER", scope_type: "SCHOOL" }, { role: "HOD", scope_type: "DEPARTMENT", department_id: biologyA }]);
    expect((await invitedUser.client.rpc("accept_invitation", { raw_token: token })).error).toBeNull();
    const membership = await admin!.from("memberships").select("id").eq("school_id", schoolA).eq("user_id", invitedUser.id).single();
    const grants = await admin!.from("role_grants").select("role, scope_type, department_id").eq("membership_id", membership.data!.id).eq("status", "ACTIVE");
    expect(grants.data).toEqual(expect.arrayContaining([{ role: "TEACHER", scope_type: "SCHOOL", department_id: null }, { role: "HOD", scope_type: "DEPARTMENT", department_id: biologyA }]));
  });

  it("keeps audit events append-only and rejects forged writes", async () => {
    requireError((await teacherA.client.from("audit_events").insert({ school_id: schoolA, actor_user_id: teacherA.id, action: "forged", resource_type: "school" })).error);
    const audit = await admin!.from("audit_events").select("id").eq("action", "invitation.accepted").limit(1).single();
    expect(audit.error).toBeNull();
    requireError((await teacherA.client.from("audit_events").update({ action: "forged" }).eq("id", audit.data!.id)).error);
    requireError((await teacherA.client.from("audit_events").delete().eq("id", audit.data!.id)).error);
  });

  it("enforces restricted metadata and private storage boundaries", async () => {
    const restrictedPath = `${schoolA}/restricted-${suffix}.txt`;
    const restrictedId = await insertFile({ school_id: schoolA, bucket_id: "restricted-files", object_path: restrictedPath, file_kind: "test", classification: "RESTRICTED", mime_type: "text/plain", size_bytes: 4, uploaded_by: adminA.id });
    expect((await teacherA.client.from("school_files").select("id").eq("id", restrictedId)).data).toEqual([]);
    expect((await adminA.client.from("school_files").select("id").eq("id", restrictedId)).data).toHaveLength(1);
    const schoolFilePath = `${schoolA}/${suffix}-teacher.txt`;
    const pendingId = await teacherA.client.from("school_files").insert({ school_id: schoolA, bucket_id: "school-files", object_path: schoolFilePath, file_kind: "test", classification: "SCHOOL_INTERNAL", mime_type: "text/plain", size_bytes: 4, uploaded_by: teacherA.id, status: "PENDING" }).select("id").single();
    expect(pendingId.error).toBeNull();
    expect((await teacherA.client.storage.from("school-files").upload(schoolFilePath, new Blob(["test"]))).error).toBeNull();
    await admin!.from("school_files").update({ status: "ACTIVE" }).eq("id", pendingId.data!.id);
    expect((await teacherA.client.storage.from("school-files").download(schoolFilePath)).error).toBeNull();
    const wrongSchoolPath = `${schoolB}/${suffix}-wrong.txt`;
    await admin!.from("school_files").insert({ school_id: schoolB, bucket_id: "school-files", object_path: wrongSchoolPath, file_kind: "test", classification: "SCHOOL_INTERNAL", mime_type: "text/plain", size_bytes: 1, uploaded_by: adminA.id });
    await admin!.storage.from("school-files").upload(wrongSchoolPath, new Blob(["x"]));
    requireError((await teacherA.client.storage.from("school-files").upload(wrongSchoolPath, new Blob(["x"]))).error);
    requireError((await teacherA.client.storage.from("school-files").download(wrongSchoolPath)).error);

    await teacherA.client.storage.from("school-files").remove([wrongSchoolPath]);
    expect((await admin!.storage.from("school-files").download(wrongSchoolPath)).error).toBeNull();

    await teacherA.client.storage.from("school-files").remove([schoolFilePath]);
    expect((await admin!.storage.from("school-files").download(schoolFilePath)).error).toBeNull();

    const removal = await adminA.client.storage.from("school-files").remove([schoolFilePath]);
    expect(removal.error).toBeNull();
    expect(removal.data).toEqual(expect.arrayContaining([expect.objectContaining({ name: schoolFilePath })]));
    // Private Storage reads can briefly hit an already cached object after DELETE.
    // The object must become inaccessible within this bounded window.
    await expect.poll(
      async () => (await admin!.storage.from("school-files").download(schoolFilePath)).error,
      { timeout: 10_000, intervals: [250, 500, 1_000] },
    ).toBeTruthy();

    await admin!.storage.from("school-files").remove([wrongSchoolPath]);
    await admin!.from("school_files").delete().eq("object_path", wrongSchoolPath);
  });
});
