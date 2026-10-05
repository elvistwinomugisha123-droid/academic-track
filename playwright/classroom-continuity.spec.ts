import { expect, test, type Page } from "@playwright/test";
import { restoreAuthState, type ProductRole } from "./auth-state";

async function signIn(page: Page, role: ProductRole, next = "/workspace/classroom") {
  await restoreAuthState(page, "product", role, next);
}

test("teacher sees the own-lesson workflow and a reachable correction affordance", async ({ page }) => {
  await signIn(page, "teacher");
  await expect(page.getByRole("heading", { name: /What happened in class/i })).toBeVisible();
  await expect(page.getByText(/Schedule intent stays separate from classroom reality/i)).toBeVisible();

  await page.getByText(/^Other scheduled and recorded lessons/).click();
  const recordedPartial = page.locator("article.lesson-card").filter({ has: page.locator(".confirmed-line").filter({ hasText: "Partially delivered" }) }).first();
  await expect(recordedPartial, "the deterministic product fixture includes one recorded partial lesson").toBeVisible();
  const correction = recordedPartial.getByRole("button", { name: /Correct this record/i });
  await expect(correction).toBeVisible();
  await correction.click();

  const changed = recordedPartial.getByRole("button", { name: /^Something changed$/i });
  await expect(changed).toBeEnabled();
  await changed.click();
  await expect(recordedPartial.locator("textarea[name=note]")).toHaveAttribute("required", "");
  await expect(recordedPartial.locator("input[name=reason]")).toHaveCount(0);
});

test("teacher outcome surface stays usable at 390px and exposes the school timezone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "teacher");
  await expect(page.getByRole("heading", { name: /What happened in class/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByText(/Senior 2 · Stream A/i).first()).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("small").filter({ hasText: /School time · Africa\/Kampala/i })).toBeVisible();
});

test("HOD sees department exceptions and retains only additive teacher authority", async ({ page }) => {
  await signIn(page, "hod");
  await expect(page.getByRole("heading", { name: /Your department/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Lessons to review/i })).toBeVisible();
  if (process.env.E2E_HOD_HAS_TEACHER === "true") await expect(page.getByRole("button", { name: /^Completed as planned$/i }).first()).toBeVisible();
  else await expect(page.getByRole("button", { name: /Completed as planned|Correct this record|Something changed/i })).toHaveCount(0);
});

test("DOS sees school exceptions without classroom mutation controls", async ({ page }) => {
  await signIn(page, "dos");
  await expect(page.getByRole("heading", { name: /School lessons/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Lessons to review/i })).toBeVisible();
  if (process.env.E2E_DOS_HAS_TEACHER === "true") await expect(page.getByRole("button", { name: /^Completed as planned$/i }).first()).toBeVisible();
  else await expect(page.getByRole("button", { name: /Completed as planned|Correct this record|Something changed/i })).toHaveCount(0);
});

test("Principal receives read-only assurance", async ({ page }) => {
  await signIn(page, "principal");
  await expect(page.getByRole("heading", { name: /School lessons/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Lessons to review/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Completed as planned|Correct this record|Something changed/i })).toHaveCount(0);
});

test("School Admin alone does not receive classroom navigation", async ({ page }) => {
  await signIn(page, "schoolAdmin", "/workspace");
  await expect(page.getByRole("link", { name: "Classroom" })).toHaveCount(0);
});
