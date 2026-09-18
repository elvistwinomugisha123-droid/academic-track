import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const admin = url && serviceKey ? createClient(url, serviceKey) : null;
const suffix = `security-${Date.now()}`;
let schoolA: string; let schoolB: string; let userA: string;
let userAEmail: string; let userAPassword: string;

describe("isolated Supabase security integration", () => {
  beforeAll(() => {
    if (!url || !publishableKey || !serviceKey) throw new Error("Security integration tests require TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY, and TEST_SUPABASE_SERVICE_ROLE_KEY for the isolated test project. No production project is permitted.");
    if (!admin) throw new Error("Unable to create the isolated Supabase admin client.");
  });
  beforeAll(async () => {
    userAEmail = `${suffix}-a@example.test`; userAPassword = `Ate-${suffix}-password!`;
    const { data: user, error: userError } = await admin!.auth.admin.createUser({ email: userAEmail, password: userAPassword, email_confirm: true });
    if (userError || !user.user) throw userError ?? new Error("Could not create test user.");
    userA = user.user.id;
    const { data: createdSchools, error: schoolError } = await admin!.from("schools").insert([{ name: "Security Test School A", slug: `${suffix}-a` }, { name: "Security Test School B", slug: `${suffix}-b` }]).select("id, slug");
    if (schoolError || !createdSchools || createdSchools.length !== 2) throw schoolError ?? new Error("Could not create test schools.");
    schoolA = createdSchools.find((school) => school.slug.endsWith("-a"))!.id; schoolB = createdSchools.find((school) => school.slug.endsWith("-b"))!.id;
    const { error: membershipError } = await admin!.from("memberships").insert({ school_id: schoolA, user_id: userA, status: "ACTIVE", display_name: "Security Test User", joined_at: new Date().toISOString() });
    if (membershipError) throw membershipError;
  });
  afterAll(async () => {
    if (!admin) return;
    if (userA) await admin.from("memberships").delete().eq("user_id", userA);
    if (schoolA || schoolB) await admin.from("schools").delete().in("id", [schoolA, schoolB].filter(Boolean));
    if (userA) await admin.auth.admin.deleteUser(userA);
  });
  it("has an explicitly configured isolated test project", () => {
    expect(url).toMatch(/^https:\/\//); expect(serviceKey).toBeTruthy(); expect(createClient(url!, publishableKey!)).toBeDefined();
  });
  it("prevents cross-tenant reads and writes for an authenticated member", async () => {
    const client = createClient(url!, publishableKey!); const { error: signInError } = await client.auth.signInWithPassword({ email: userAEmail, password: userAPassword }); expect(signInError).toBeNull();
    const { data: visible, error: readError } = await client.from("schools").select("id"); expect(readError).toBeNull(); expect(visible?.map((row) => row.id)).toEqual([schoolA]);
    const { error: writeError } = await client.from("academic_periods").insert({ school_id: schoolB, name: "Cross tenant", period_type: "TERM", academic_year: 2026, starts_on: "2026-01-01", ends_on: "2026-03-31" }); expect(writeError).toBeTruthy();
  });
  it("denies access after membership deactivation", async () => {
    await admin!.from("memberships").update({ status: "SUSPENDED" }).eq("school_id", schoolA).eq("user_id", userA);
    const client = createClient(url!, publishableKey!); await client.auth.signInWithPassword({ email: userAEmail, password: userAPassword }); const { data } = await client.from("schools").select("id"); expect(data).toEqual([]);
  });
});
