import { existsSync, readFileSync } from "node:fs";
import { expect, type BrowserContext, type Page } from "@playwright/test";

export type ProductRole = "schoolAdmin" | "teacher" | "hod" | "dos" | "principal";
export type AssessmentRole = "teacher" | "dos";
export type FixtureKind = "product" | "assessment";

type AuthState = Awaited<ReturnType<BrowserContext["storageState"]>>;
type ProductFixture = { password: string; accounts: Record<string, { email: string }> };
type AssessmentFixture = { teacherEmail: string; dosEmail: string; teacherPassword: string };

async function waitForPath(page: Page, expectedPath: string) {
  const expected = expectedPath.replace(/\/$/, "") || "/";
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const actual = new URL(page.url()).pathname.replace(/\/$/, "") || "/";
    if (actual === expected) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`Expected ${expectedPath}, received ${page.url()}.`);
}

const statePath = (kind: FixtureKind, role: string) => `test-artifacts/auth-${kind}-${role}.json`;

export function readAuthState(kind: FixtureKind, role: string): AuthState | null {
  const path = statePath(kind, role);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as AuthState : null;
}

function credentials(kind: FixtureKind, role: string) {
  if (kind === "product") {
    const fixture = JSON.parse(readFileSync("output/playwright/product-fixture.json", "utf8")) as ProductFixture;
    return { email: fixture.accounts[role].email, password: fixture.password };
  }
  const fixture = JSON.parse(readFileSync("test-artifacts/assessment-fixture.json", "utf8")) as AssessmentFixture;
  return { email: role === "teacher" ? fixture.teacherEmail : fixture.dosEmail, password: fixture.teacherPassword };
}

async function signInFresh(page: Page, kind: FixtureKind, role: string, next: string) {
  const account = credentials(kind, role);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.context().clearCookies();
    await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email address").fill(account.email);
    await page.getByRole("textbox", { name: "Password" }).fill(account.password);
    try {
      await page.getByRole("button", { name: "Sign in" }).click();
      await waitForPath(page, next);
      await expect(page.locator("header:visible").first()).toBeVisible({ timeout: 20_000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw new Error(`Fresh TEST sign-in did not complete for ${role}.`, { cause: lastError });
}

export async function restoreAuthState(page: Page, kind: FixtureKind, role: string, next: string) {
  // Supabase refresh tokens rotate and are single-use. Reusing a saved browser
  // state across tests therefore creates false session-expiry failures. Each
  // flow signs in through the real UI so every test owns a fresh session.
  void readAuthState;
  await signInFresh(page, kind, role, next);
}
