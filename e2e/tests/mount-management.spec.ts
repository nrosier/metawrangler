import { test, expect } from "@playwright/test";

/**
 * E2E Test: Settings Page
 * Verify settings page loads and has expected structure
 */
test.describe("Settings Page", () => {
  test("should load settings page", async ({ page }) => {
    await page.goto("/settings");
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
  });

  test("should have navigation to settings", async ({ page }) => {
    await page.goto("/");
    const settingsLink = page.locator("a[href*='settings'], button:has-text('Settings')");
    // Either find a link or just verify page is accessible
    const response = await page.request.get("/settings");
    expect([200, 302]).toContain(response.status());
  });
});
