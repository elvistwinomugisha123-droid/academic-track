import { expect, test, type Page } from "@playwright/test";
import { restoreAuthState, type ProductRole } from "./auth-state";

async function signIn(page: Page, role: ProductRole) {
  await restoreAuthState(page, "product", role, "/workspace/academic-operations");
}

test("unauthenticated users cannot enter academic operations", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "requires the configured Supabase public environment");
  await page.goto("/workspace/academic-operations");
  await expect(page).toHaveURL(/\/sign-in|\/session-expired/);
});

test("School Admin sees setup but no timetable lifecycle controls", async ({ page }) => {
  await signIn(page, "schoolAdmin");
  await expect(page.getByRole("button", { name: /Academic setup/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Verify$/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Activate$/i })).toHaveCount(0);
});

test("DOS sees draft, readiness and lifecycle controls", async ({ page }) => {
  await signIn(page, "dos");
  await expect(page.getByRole("button", { name: /Timetable/i })).toBeVisible();
  await expect(page.getByText(/Create a draft timetable/i)).toBeVisible();
  await expect(page.getByText(/Deterministic readiness signals/i)).toBeVisible();
});

test("Teacher sees own sections and schedule-intent language only", async ({ page }) => {
  await signIn(page, "teacher");
  await expect(page.getByRole("heading", { name: /My Teaching Sections/i })).toBeVisible();
  await expect(page.getByText(/My schedule/i)).toBeVisible();
  await expect(page.getByText(/schedule intent only/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Verify|Activate/i })).toHaveCount(0);
});

test("HOD and Principal receive read-oriented section presentation", async ({ page }) => {
  await signIn(page, "hod");
  await expect(page.getByRole("button", { name: /Department Teaching Sections/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Timetable/i })).toHaveCount(0);
  await page.getByRole("button", { name: /Teaching Sections/i }).click();
  await page.getByRole("button", { name: /Overview/i }).click();
  await page.context().clearCookies();
  await signIn(page, "principal");
  await expect(page.getByRole("button", { name: /Teaching Sections \/ assurance/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Verify|Activate/i })).toHaveCount(0);
});

test("programme targeting UI exposes school, class, stream and department scopes", async ({ page }) => {
  await signIn(page, "dos");
  await page.getByRole("button", { name: /Programme/i }).click();
  const scope = page.getByLabel(/Target scope/i);
  await expect(scope).toHaveValue("SCHOOL");
  await expect(page.getByText(/No target required/i)).toBeVisible();
  await scope.selectOption("CLASS_LEVEL");
  await expect(page.getByLabel(/^Target$/i)).toBeVisible();
  await scope.selectOption("STREAM");
  await scope.selectOption("DEPARTMENT");
  await expect(page.getByText(/missed lesson/i)).toHaveCount(0);
});

test("teacher assignment surface remains usable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "teacher");
  await expect(page.getByRole("heading", { name: /My Teaching Sections/i })).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
