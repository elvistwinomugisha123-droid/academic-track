import { expect, test, type Page } from "@playwright/test";
import { restoreAuthState, type ProductRole } from "./auth-state";

async function signIn(page: Page, role: ProductRole, next = "/workspace/classroom") {
  await restoreAuthState(page, "product", role, next);
}

test("teacher sees the own-lesson workflow and a reachable correction affordance", async ({ page }) => {
  await signIn(page, "teacher");
  await expect(page.getByRole("heading", { name: /What happened in class/i })).toBeVisible();
  await expect(page.getByText(/Schedule intent stays separate from classroom reality/i)).toBeVisible();
  const delivered = page.getByRole("button", { name: /^Completed as planned$/i }).first();
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
  await expect(page.locator("textarea[name=note]").last()).toHaveAttribute("required", "");
  await expect(page.locator("input[name=reason]").last()).toHaveCount(0);
});

test("teacher outcome controls stay usable at 390px and the school timezone is explicit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "teacher");
  await expect(page.getByRole("heading", { name: /What happened in class/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByText(/School time/i).first()).toBeVisible();
});

test("HOD sees department exceptions and retains only additive teacher authority", async ({ page }) => {
  await signIn(page, "hod");
  await expect(page.getByRole("heading", { name: /Department continuity/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Operational exceptions/i })).toBeVisible();
  if (process.env.E2E_HOD_HAS_TEACHER === "true") await expect(page.getByRole("button", { name: /^Completed as planned$/i }).first()).toBeVisible();
  else await expect(page.getByRole("button", { name: /Completed as planned|Correct this record/i })).toHaveCount(0);
});

test("DOS sees school exceptions without classroom mutation controls", async ({ page }) => {
  await signIn(page, "dos");
  await expect(page.getByRole("heading", { name: /Academic continuity/i })).toBeVisible();
  if (process.env.E2E_DOS_HAS_TEACHER === "true") await expect(page.getByRole("button", { name: /^Completed as planned$/i }).first()).toBeVisible();
  else await expect(page.getByRole("button", { name: /Completed as planned|Correct this record/i })).toHaveCount(0);
});

test("Principal receives read-only assurance", async ({ page }) => {
  await signIn(page, "principal");
  await expect(page.getByRole("heading", { name: /Academic continuity/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Completed as planned|Correct this record/i })).toHaveCount(0);
});

test("School Admin alone does not receive classroom navigation", async ({ page }) => {
  await signIn(page, "schoolAdmin", "/workspace");
  await expect(page.getByRole("link", { name: "Classroom" })).toHaveCount(0);
});
