import { expect, test, type Page } from "@playwright/test";

const accounts = {
  schoolAdmin: { email: process.env.E2E_SCHOOL_ADMIN_EMAIL, password: process.env.E2E_SCHOOL_ADMIN_PASSWORD },
  teacher: { email: process.env.E2E_TEACHER_EMAIL, password: process.env.E2E_TEACHER_PASSWORD },
  hod: { email: process.env.E2E_HOD_EMAIL, password: process.env.E2E_HOD_PASSWORD },
  dos: { email: process.env.E2E_DOS_EMAIL, password: process.env.E2E_DOS_PASSWORD },
  principal: { email: process.env.E2E_PRINCIPAL_EMAIL, password: process.env.E2E_PRINCIPAL_PASSWORD },
};

async function signIn(page: Page, account: { email?: string; password?: string }) {
  await page.goto("/sign-in?next=/workspace/classroom");
  await page.getByLabel(/email/i).fill(account.email!);
  await page.getByLabel(/password/i).fill(account.password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.goto("/workspace/classroom");
}

function requires(account: { email?: string; password?: string }) { return !account.email || !account.password; }

test("teacher sees the own-lesson workflow and a reachable correction affordance", async ({ page }) => {
  test.skip(requires(accounts.teacher), "requires isolated Teacher E2E credentials and seeded lessons");
  await signIn(page, accounts.teacher);
  await expect(page.getByRole("heading", { name: /What happened in class/i })).toBeVisible();
  await expect(page.getByText(/Schedule intent stays separate from classroom reality/i)).toBeVisible();
  const delivered = page.getByRole("button", { name: /^Delivered$/i }).first();
  const correction = page.getByRole("button", { name: /Correct this record/i }).first();
  if (await correction.count() === 0) {
    await expect(delivered).toBeVisible();
    await delivered.click();
    await expect(page.getByRole("status").filter({ hasText: /Confirmed: Delivered/i })).toBeVisible();
    await expect(page.locator("article.lesson-card").first()).not.toContainText(/awaiting confirmation/i);
  }
  await expect(correction).toBeVisible();
  await correction.click();
  await page.getByRole("button", { name: /^Changed$/i }).last().click();
  await expect(page.locator("textarea[name=note]").last()).toBeRequired();
  await expect(page.locator("input[name=reason]").last()).toHaveCount(0);
});

test("teacher outcome controls stay usable at 390px and the school timezone is explicit", async ({ page }) => {
  test.skip(requires(accounts.teacher), "requires isolated Teacher E2E credentials and seeded lessons");
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, accounts.teacher);
  await expect(page.getByRole("heading", { name: /What happened in class/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByText(/School time/i).first()).toBeVisible();
});

test("HOD sees department exceptions and retains only additive teacher authority", async ({ page }) => {
  test.skip(requires(accounts.hod), "requires isolated HOD E2E credentials and seeded lessons");
  await signIn(page, accounts.hod);
  await expect(page.getByRole("heading", { name: /Department continuity/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Operational exceptions/i })).toBeVisible();
  if (process.env.E2E_HOD_HAS_TEACHER === "true") await expect(page.getByRole("button", { name: /^Delivered$/i }).first()).toBeVisible();
  else await expect(page.getByRole("button", { name: /Delivered|Correct this record/i })).toHaveCount(0);
});

test("DOS sees school exceptions without classroom mutation controls", async ({ page }) => {
  test.skip(requires(accounts.dos), "requires isolated DOS E2E credentials and seeded lessons");
  await signIn(page, accounts.dos);
  await expect(page.getByRole("heading", { name: /Academic continuity/i })).toBeVisible();
  if (process.env.E2E_DOS_HAS_TEACHER === "true") await expect(page.getByRole("button", { name: /^Delivered$/i }).first()).toBeVisible();
  else await expect(page.getByRole("button", { name: /Delivered|Correct this record/i })).toHaveCount(0);
});

test("Principal receives read-only assurance", async ({ page }) => {
  test.skip(requires(accounts.principal), "requires isolated Principal E2E credentials and seeded lessons");
  await signIn(page, accounts.principal);
  await expect(page.getByRole("heading", { name: /Academic continuity/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Delivered|Correct this record/i })).toHaveCount(0);
});

test("School Admin alone does not receive classroom navigation", async ({ page }) => {
  test.skip(requires(accounts.schoolAdmin), "requires isolated School Admin E2E credentials");
  await page.goto("/sign-in?next=/workspace");
  await page.getByLabel(/email/i).fill(accounts.schoolAdmin.email!);
  await page.getByLabel(/password/i).fill(accounts.schoolAdmin.password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.goto("/workspace");
  await expect(page.getByRole("link", { name: "Classroom" })).toHaveCount(0);
});
