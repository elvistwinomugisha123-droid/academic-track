import { chromium, type Browser, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const baseURL = "http://127.0.0.1:3000";

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

async function signInAndSave(browser: Browser, role: string, email: string, password: string, next: string, path: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    try {
      await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
      await page.getByLabel("Email address").fill(email);
      await page.getByRole("textbox", { name: "Password" }).fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await waitForPath(page, next);
      await page.getByRole("banner").waitFor({ state: "visible", timeout: 20_000 });
      await context.storageState({ path });
      await context.close();
      return;
    } catch (error) {
      lastError = error;
      await context.close();
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw new Error(`Could not create browser auth state for ${role}.`, { cause: lastError });
}

export default async function globalSetup() {
  const browser = await chromium.launch();
  try {
    const productPath = "output/playwright/product-fixture.json";
    if (existsSync(productPath)) {
      const fixture = JSON.parse(readFileSync(productPath, "utf8")) as ProductFixture;
      const destinations: Record<string, string> = { schoolAdmin: "/workspace", teacher: "/workspace", hod: "/workspace/leadership/hod", dos: "/workspace/academic-operations", principal: "/workspace/leadership/principal" };
      for (const role of Object.keys(destinations)) await signInAndSave(browser, role, fixture.accounts[role].email, fixture.password, destinations[role], `test-artifacts/auth-product-${role}.json`);
    }

    const assessmentPath = "test-artifacts/assessment-fixture.json";
    if (existsSync(assessmentPath)) {
      const fixture = JSON.parse(readFileSync(assessmentPath, "utf8")) as AssessmentFixture;
      await signInAndSave(browser, "teacher", fixture.teacherEmail, fixture.teacherPassword, "/workspace/teacher/assessments", "test-artifacts/auth-assessment-teacher.json");
      await signInAndSave(browser, "dos", fixture.dosEmail, fixture.teacherPassword, "/workspace/leadership/dos", "test-artifacts/auth-assessment-dos.json");
    }
  } finally {
    await browser.close();
  }
}
