import { expect, test, type Page } from "@playwright/test";

function browserFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => { const errorText = request.failure()?.errorText || "failed"; if (errorText === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return; failures.push(`request: ${request.method()} ${request.url()} — ${errorText}`); });
  return () => expect(failures, "browser console, page and network failures").toEqual([]);
}

test("foundation entry is truthful and navigable", async ({ page }) => {
  const assertClean = browserFailures(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/ATE/);
  await expect(page.getByRole("heading", { name: /dependable place/i })).toBeVisible();
  await expect(page.getByText(/No school or teacher data is loaded/i)).toBeVisible();
  await page.getByRole("link", { name: /Design system/i }).click();
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
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();
  assertClean();
});

test("academic operations requires an authenticated school workspace", async ({ page }) => {
  await page.goto("/workspace/academic-operations");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fworkspace%2Facademic-operations/);
  await expect(page.getByRole("heading", { name: /sign in to your academic workspace/i })).toBeVisible();
});

test("recovery routes explain the safe next action", async ({ page }) => {
  const routes: Array<[string, RegExp]> = [
    ["/session-expired?next=%2Fworkspace", /Your session has expired/i],
    ["/access-denied", /not available to your role/i],
    ["/no-membership", /not active yet/i],
    ["/this-page-does-not-exist", /could not find that page/i],
  ];
  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});
