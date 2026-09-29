import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { restoreAuthState } from "./auth-state";

type ProductFixture = {
  nextLessonId: string;
  accounts: Record<string, { email: string; name: string }>;
  password: string;
};

const fixturePath = "output/playwright/product-fixture.json";
const fixture: ProductFixture | null = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, "utf8")) as ProductFixture
  : null;

function requireFixture() {
  if (!fixture) throw new Error("BLOCKED: product fixture is unavailable. Run scripts/test-product-fixture.ts against the isolated TEST Supabase project.");
  return fixture;
}

function browserFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText || "failed";
    if (errorText === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
    failures.push(`request: ${request.method()} ${request.url()} — ${errorText}`);
  });
  return () => expect(failures, "browser console, page and network failures").toEqual([]);
}

async function signIn(page: Page, role: keyof ProductFixture["accounts"], next: string) {
  await restoreAuthState(page, "product", role, next);
}

async function expectNoOverflow(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `horizontal overflow at ${width}px`).toBe(true);
}

async function capture(page: Page, width: number, height: number, name: string) {
  await page.setViewportSize({ width, height });
  await page.screenshot({ path: `output/playwright/${name}-${width}.png`, fullPage: true });
  await expectNoOverflow(page, width);
}

test.describe("ATE authenticated visual evidence", () => {
  test.setTimeout(240_000);

  test("captures core teacher and leadership surfaces", async ({ page }) => {
    requireFixture();
    const assertClean = browserFailures(page);
    const teacherHomeWidths = [360, 390, 430, 768, 1366, 1440];

    await signIn(page, "teacher", "/workspace");
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible({ timeout: 60_000 });
    for (const width of teacherHomeWidths) await capture(page, width, width < 1000 ? 844 : 900, "teacher-home");

    await page.goto(`/workspace/teacher/lessons/${fixture!.nextLessonId}`);
    await expect(page.getByRole("heading", { name: /Biology · Senior 1 East/ })).toBeVisible({ timeout: 60_000 });
    await capture(page, 390, 844, "teacher-readiness");
    await capture(page, 1440, 900, "teacher-readiness");

    await page.context().clearCookies();
    await signIn(page, "hod", "/workspace/leadership/hod");
    await expect(page.getByRole("heading", { name: /Department Pulse/i })).toBeVisible({ timeout: 60_000 });
    await capture(page, 1440, 900, "hod-workspace");

    await page.context().clearCookies();
    await signIn(page, "dos", "/workspace/academic-operations");
    await expect(page.getByRole("heading", { name: /Set up your school day/i })).toBeVisible({ timeout: 60_000 });
    await capture(page, 1440, 900, "dos-operations");

    await page.context().clearCookies();
    await signIn(page, "principal", "/workspace/leadership/principal");
    await expect(page.getByRole("heading", { name: /Academic Assurance/i })).toBeVisible({ timeout: 60_000 });
    await capture(page, 1440, 900, "principal-assurance");

    assertClean();
  });
});
