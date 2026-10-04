import { expect, test } from "@playwright/test";
import { observeBrowserFailures } from "./browser-failures";

const browserFailures = (page: Parameters<typeof observeBrowserFailures>[0]) => observeBrowserFailures(page, {
  expectedRequestFailure: (request, errorText) => errorText === "net::ERR_ABORTED" && request.url().includes("_rsc="),
});

test("foundation entry is truthful and navigable", async ({ page }) => {
  const assertClean = browserFailures(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/ATE/);
  await expect(page.getByRole("heading", { name: /Start the day knowing what comes next/i })).toBeVisible();
  await expect(page.getByText(/Use the account provided by your school/i)).toBeVisible();
  await page.getByRole("link", { name: /Enter your workspace/i }).click();
  await expect(page.getByRole("heading", { name: /Sign in to your academic workspace/i })).toBeVisible();
  await page.goto("/design-system");
  await expect(page.getByRole("heading", { name: /Quietly precise/i })).toBeVisible();
  assertClean();
});

test("foundation has no horizontal overflow at teacher width", async ({ page }) => {
  const assertClean = browserFailures(page);
  for (const width of [360, 390, 430, 768, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
    await page.goto("/design-system");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: `horizontal overflow at ${width}px` }).toBe(true);
  }
  assertClean();
});

test("foundation exposes a keyboard skip link", async ({ page }) => {
  const assertClean = browserFailures(page);
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: /skip to content/i });
  await expect(skipLink).toBeAttached();
  await page.getByRole("link", { name: "ATE home", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#welcome$/);
  assertClean();
});

test("academic operations requires an authenticated school workspace", async ({ page }) => {
  await page.goto("/workspace/academic-operations");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fworkspace%2Facademic-operations/);
  await expect(page.getByRole("heading", { name: /sign in to your academic workspace/i })).toBeVisible();
});

test("recovery routes explain the safe next action", async ({ context }) => {
  const routes: Array<[string, RegExp]> = [
    ["/session-expired?next=%2Fworkspace", /Your session has expired/i],
    ["/access-denied", /not available to your role/i],
    ["/no-membership", /not active yet/i],
    ["/this-page-does-not-exist", /could not find that page/i],
  ];
  for (const [route, heading] of routes) {
    const routePage = await context.newPage();
    try {
      await routePage.goto(route);
      await expect(routePage.getByRole("heading", { name: heading })).toBeVisible({ timeout: 10_000 });
    } finally {
      await routePage.close();
    }
  }
});
