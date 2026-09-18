import { expect, test, type Page } from "@playwright/test";

const accounts = {
  schoolAdmin: { email: process.env.E2E_SCHOOL_ADMIN_EMAIL, password: process.env.E2E_SCHOOL_ADMIN_PASSWORD },
  dos: { email: process.env.E2E_DOS_EMAIL, password: process.env.E2E_DOS_PASSWORD },
  teacher: { email: process.env.E2E_TEACHER_EMAIL, password: process.env.E2E_TEACHER_PASSWORD },
  hod: { email: process.env.E2E_HOD_EMAIL, password: process.env.E2E_HOD_PASSWORD },
  principal: { email: process.env.E2E_PRINCIPAL_EMAIL, password: process.env.E2E_PRINCIPAL_PASSWORD },
};

async function signIn(page: Page, account: { email?: string; password?: string }) {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(account.email!);
  await page.getByLabel(/password/i).fill(account.password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.goto("/workspace/academic-operations");
}

function requires(account: { email?: string; password?: string }) { return !account.email || !account.password; }

test("unauthenticated users cannot enter academic operations", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "requires the configured Supabase public environment");
  await page.goto("/workspace/academic-operations");
  await expect(page).toHaveURL(/\/sign-in|\/session-expired/);
});

test("School Admin sees setup but no timetable lifecycle controls", async ({ page }) => {
  test.skip(requires(accounts.schoolAdmin), "requires isolated School Admin E2E credentials");
  await signIn(page, accounts.schoolAdmin);
  await expect(page.getByRole("button", { name: /Academic setup/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Verify$/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Activate$/i })).toHaveCount(0);
});

test("DOS sees draft, readiness and lifecycle controls", async ({ page }) => {
  test.skip(requires(accounts.dos), "requires isolated DOS E2E credentials");
  await signIn(page, accounts.dos);
  await expect(page.getByRole("button", { name: /Timetable/i })).toBeVisible();
  await expect(page.getByText(/Create a draft timetable/i)).toBeVisible();
  await expect(page.getByText(/Deterministic readiness signals/i)).toBeVisible();
});

test("Teacher sees own sections and schedule-intent language only", async ({ page }) => {
  test.skip(requires(accounts.teacher), "requires isolated Teacher E2E credentials");
  await signIn(page, accounts.teacher);
  await expect(page.getByRole("heading", { name: /My Teaching Sections/i })).toBeVisible();
  await expect(page.getByText(/My schedule/i)).toBeVisible();
  await expect(page.getByText(/schedule intent only/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Verify|Activate/i })).toHaveCount(0);
});

test("HOD and Principal receive read-oriented section presentation", async ({ page }) => {
  test.skip(requires(accounts.hod) || requires(accounts.principal), "requires isolated HOD and Principal E2E credentials");
  await signIn(page, accounts.hod);
  await expect(page.getByRole("button", { name: /Department Teaching Sections/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Timetable/i })).toHaveCount(0);
  await page.getByRole("button", { name: /Teaching Sections/i }).click();
  await page.getByRole("button", { name: /Overview/i }).click();
  await page.context().clearCookies();
  await signIn(page, accounts.principal);
  await expect(page.getByRole("button", { name: /Teaching Sections \/ assurance/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Verify|Activate/i })).toHaveCount(0);
});

test("programme targeting UI exposes school, class, stream and department scopes", async ({ page }) => {
  test.skip(requires(accounts.dos), "requires isolated DOS E2E credentials");
  await signIn(page, accounts.dos);
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
  test.skip(requires(accounts.teacher), "requires isolated Teacher E2E credentials");
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, accounts.teacher);
  await expect(page.getByRole("heading", { name: /My Teaching Sections/i })).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
