import { expect, test } from "@playwright/test";

test("foundation entry is truthful and navigable", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ATE/);
  await expect(page.getByRole("heading", { name: /dependable place/i })).toBeVisible();
  await expect(page.getByText(/No school or teacher data is loaded/i)).toBeVisible();
  await page.getByRole("link", { name: /Design system/i }).click();
  await expect(page.getByRole("heading", { name: /Quietly precise/i })).toBeVisible();
});

test("foundation has no horizontal overflow at teacher width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/design-system");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
