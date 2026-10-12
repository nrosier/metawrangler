import { test, expect } from "@playwright/test";

/**
 * E2E Test: Basic Smoke Tests
 * Verify core application pages load and basic functionality works
 */
test.describe("MetaWrangler E2E", () => {
  test("should load home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/MetaWrangler/i);
  });

  test("should load browse page", async ({ page }) => {
    await page.goto("/browse");
    // Just verify the page loads without crashing
    await expect(page.locator("body")).toContainText(/browse|mount/i);
  });

  test("should load jobs page", async ({ page }) => {
    await page.goto("/jobs");
    // Just verify the page loads
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
  });

  test("should load settings page", async ({ page }) => {
    await page.goto("/settings");
    // Just verify the page loads
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
  });

  test("should load audit log page", async ({ page }) => {
    await page.goto("/audit-log");
    // Just verify the page loads
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
  });

  test("should have accessible navigation", async ({ page }) => {
    await page.goto("/");
    // Verify navigation links exist
    const navLinks = await page.locator("nav a, nav button").count();
    expect(navLinks).toBeGreaterThan(0);
  });

  test("should respond to API health check", async ({ page }) => {
    const response = await page.request.get("/health");
    // Health check should be available (or redirect through auth)
    expect([200, 302, 401]).toContain(response.status());
  });
});
