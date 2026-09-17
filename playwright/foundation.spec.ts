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
  for (const width of [360, 390, 430, 768, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
    await page.goto("/design-system");
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
  }
});

test("foundation exposes a keyboard skip link", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();
});
