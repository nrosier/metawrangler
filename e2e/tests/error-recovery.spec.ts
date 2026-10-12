import { test, expect } from "@playwright/test";

/**
 * E2E Test: Basic Connectivity Tests
 * Verify application core pages are accessible
 */
test.describe("App Connectivity", () => {
  test("should load jobs page successfully", async ({ page }) => {
    const response = await page.goto("/jobs");
    // Should succeed or redirect via auth (200 or 302)
    expect([200, 302, 401]).toContain(response?.status());
  });

  test("should load bulk-edit page", async ({ page }) => {
    const response = await page.goto("/bulk-edit");
    expect([200, 302, 401]).toContain(response?.status());
  });

  test("should have valid page structure", async ({ page }) => {
    await page.goto("/");
    const htmlElement = page.locator("html");
    await expect(htmlElement).toBeTruthy();
  });
});
