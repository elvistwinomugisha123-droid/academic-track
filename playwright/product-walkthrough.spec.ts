import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { restoreAuthState } from "./auth-state";

type Fixture = {
  sectionAId: string;
  unconfirmedLessonId: string;
  nextLessonId: string;
  accounts: Record<string, { email: string; name: string }>;
  password: string;
};

const fixturePath = "output/playwright/product-fixture.json";
const fixture: Fixture | null = existsSync(fixturePath) ? JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture : null;

function requireFixture() {
  if (!fixture) throw new Error("BLOCKED: TEST fixture is unavailable. Run scripts/test-product-fixture.ts against the isolated TEST Supabase project.");
  return fixture;
}

function browserFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => { const errorText = request.failure()?.errorText || "failed"; const expectedAbort = errorText === "net::ERR_ABORTED" && (request.url().includes("_rsc=") || request.url().includes("/auth/v1/logout") || (request.method() === "POST" && request.url().includes("/workspace/teacher/lessons/"))); if (expectedAbort) return; failures.push(`request: ${request.method()} ${request.url()} — ${errorText}`); });
  return () => expect(failures, "browser console, page and network failures").toEqual([]);
}

async function signIn(page: Page, role: keyof Fixture["accounts"], next = "/workspace") {
  await restoreAuthState(page, "product", role, next);
}

async function expectNoOverflow(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `horizontal overflow at ${width}px`).toBe(true);
}

test.describe("ATE product walkthrough", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    page.setDefaultTimeout(60_000);
  });

  test.setTimeout(180_000);

  test("sign-in controls are accessible and usable", async ({ page }) => {
    const failures: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
    page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
    page.on("requestfailed", (request) => { const errorText = request.failure()?.errorText || "failed"; if (errorText === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return; failures.push(`request: ${request.method()} ${request.url()} — ${errorText}`); });
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: /sign in to your academic workspace/i })).toBeVisible();
    const password = page.getByRole("textbox", { name: "Password" });
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
    await expect(page.getByRole("link", { name: /create account|forgot password/i })).toHaveCount(0);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: `output/playwright/sign-in-${width}.png`, fullPage: true });
      await expectNoOverflow(page, width);
    }
    expect(failures, "browser console, page and network failures").toEqual([]);
  });

  test("teacher completes the core route sequence", async ({ page }) => {
    requireFixture();
    const assertClean = browserFailures(page);
    await signIn(page, "teacher");
    await expect(page.getByRole("heading", { name: "Your teaching day." })).toBeVisible({ timeout: 30_000 });
    await page.goto(`/workspace/teacher/sections/${fixture!.sectionAId}`);
    await expect(page.getByText(/Curriculum source/i)).toBeVisible({ timeout: 30_000 });
    await page.goto(`/workspace/teacher/lessons/${fixture!.nextLessonId}`);
    await expect(page.getByRole("heading", { name: "Prepare with the class in view." })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Lesson Plan" }).click();
    await expect(page.getByRole("heading", { name: "Formal Lesson Plan" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Create Formal Lesson Plan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Formal Lesson Plan created as version 1" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Teaching Pack" }).click();
    await expect(page.getByRole("heading", { name: "Teaching Pack" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Create" }).first().click();
    await expect(page.getByRole("status")).toContainText(/created as version 1/i, { timeout: 60_000 });
    const lessonPdf = page.getByRole("link", { name: "PDF" }).first();
    await expect(lessonPdf).toBeVisible({ timeout: 60_000 });
    const lessonPdfHref = await lessonPdf.getAttribute("href");
    expect(lessonPdfHref).toBeTruthy();
    const lessonPdfResponse = await page.request.get(lessonPdfHref!);
    expect(lessonPdfResponse.status(), "lesson artifact PDF status").toBe(200);
    expect(lessonPdfResponse.headers()["content-type"], "lesson artifact PDF content type").toContain("application/pdf");
    expect((await lessonPdfResponse.body()).byteLength, "lesson artifact PDF body").toBeGreaterThan(100);
    await page.getByRole("button", { name: "Readiness" }).click();
    await page.getByLabel("Lesson focus").fill("Cell structure and microscope observation");
    await page.getByRole("button", { name: "Save preparation" }).click();
    await expect(page.getByRole("status")).toContainText(/Preparation saved/i, { timeout: 30_000 });
    await page.getByRole("banner").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    assertClean();
  });

  test("teacher records a classroom outcome and sees continuity feedback", async ({ page }) => {
    requireFixture();
    const assertClean = browserFailures(page);
    await signIn(page, "teacher");
    await page.goto(`/workspace/teacher/lessons/${fixture!.unconfirmedLessonId}`);
    await expect(page.getByRole("heading", { name: "Prepare with the class in view." })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Partially delivered" }).click();
    await page.getByLabel("Unfinished work or factual note").fill("Finish the microscope diagram in the next lesson.");
    await page.getByRole("button", { name: "Record classroom outcome" }).click();
    await expect(page.getByRole("status")).toContainText(/Recorded: Partially delivered/i, { timeout: 30_000 });
    await expect(page.getByText("Decide what the next lesson inherits.")).toBeVisible();
    await expect(page.getByText("Finish the microscope diagram in the next lesson.", { exact: true }).first()).toBeVisible();
    assertClean();
  });

  test("HOD, DOS and Principal receive their role-scoped workspaces", async ({ page }) => {
    requireFixture();
    const assertClean = browserFailures(page);
    await signIn(page, "hod", "/workspace/leadership/hod");
    await expect(page.getByRole("heading", { name: /Department Pulse/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Needs attention" })).toBeVisible({ timeout: 30_000 });
    await page.context().clearCookies();
    await signIn(page, "dos", "/workspace/leadership/dos");
    await expect(page.getByRole("heading", { name: /Academic Operations/i })).toBeVisible({ timeout: 30_000 });
    await page.context().clearCookies();
    await signIn(page, "principal", "/workspace/leadership/principal");
    await expect(page.getByRole("heading", { name: /Academic Assurance/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /verify|activate/i })).toHaveCount(0);
    assertClean();
  });

  test("DOS can schedule and cancel a programme event", async ({ page }) => {
    requireFixture();
    const assertClean = browserFailures(page);
    await signIn(page, "dos", "/workspace/academic-operations");
    await expect(page.getByRole("heading", { name: /School structure that stays dependable/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Programme/ }).click();
    const title = `Browser validation event ${Date.now()}`;
    const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const localDateTime = (value: Date) => { const pad = (item: number) => String(item).padStart(2, "0"); return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`; };
    await page.getByLabel("Title").fill(title);
    await page.locator('input[name="startsAt"]').fill(localDateTime(start));
    await page.locator('input[name="endsAt"]').fill(localDateTime(end));
    await page.getByRole("button", { name: "Schedule event" }).click();
    await expect(page.getByRole("status")).toContainText(/Programme event scheduled atomically/i, { timeout: 30_000 });
    await page.goto(`/workspace/academic-operations?validation=${Date.now()}`);
    await page.getByRole("button", { name: /^Programme/ }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
    const row = page.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("status")).toContainText(/Programme event cancelled/i, { timeout: 30_000 });
    assertClean();
  });

  test("AI degradation is visible and does not replace manual authoring", async ({ page }) => {
    requireFixture();
    const assertClean = browserFailures(page);
    await signIn(page, "teacher");
    await page.goto(`/workspace/teacher/lessons/${fixture!.nextLessonId}`);
    await page.getByRole("button", { name: "Lesson Plan" }).click();
    await page.getByRole("button", { name: "Generate with ATE" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /ATE cannot send this curriculum context|ATE drafting is unavailable/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Create Formal Lesson Plan|Generate with ATE/ }).first()).toBeEnabled();
    assertClean();
  });

  test("teacher assessment entry stays honest when no verified profile is available", async ({ page }) => {
    requireFixture();
    const assertClean = browserFailures(page);
    await signIn(page, "teacher", "/workspace/teacher/assessments");
    await expect(page.getByRole("heading", { name: "Assessment Studio" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("No assessments yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open assessment workspace" })).toBeDisabled();
    assertClean();
  });

  test("unauthenticated direct navigation returns to sign-in", async ({ page }) => {
    const failures: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
    page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
    page.on("requestfailed", (request) => { const errorText = request.failure()?.errorText || "failed"; if (errorText === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return; failures.push(`request: ${request.method()} ${request.url()} — ${errorText}`); });
    await page.goto("/workspace/teacher/sections");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    expect(failures, "browser console, page and network failures").toEqual([]);
  });
});
