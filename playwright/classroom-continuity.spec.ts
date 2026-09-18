import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("Step 5 classroom continuity", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD for an authenticated seeded school.");
    await page.goto("/sign-in?next=/workspace/classroom");
    await page.getByLabel("Email address").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/workspace\/classroom/);
  });

  test("renders without horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: /What happened in class|Department continuity|Academic continuity/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("lets a seeded teacher reach the outcome controls", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Delivered" }).first()).toBeVisible();
    await expect(page.getByText("Schedule intent stays separate from classroom reality.")).toBeVisible();
  });
});
