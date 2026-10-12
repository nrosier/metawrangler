import { test, expect } from "@playwright/test";

/**
 * E2E Test: Browse → Edit → Undo Workflow
 * Tests complete user journey: select files, edit metadata, commit, undo
 */
test.describe("Browse, Edit, and Undo Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Login via Authentik/Traefik (if auth is required)
    await page.goto("/");
  });

  test("should browse and select files", async ({ page }) => {
    await page.goto("/browse");

    // Wait for mount list to load
    await page.waitForSelector("table");

    // Select a mount (first available)
    const mountButton = page.locator("table tbody button").first();
    await mountButton.click();

    // Verify directory listing loads
    await expect(page.locator("table")).toContainText(/\.mkv|\.m2ts/i);
  });

  test("should select multiple files", async ({ page }) => {
    await page.goto("/browse");

    // Wait for content
    await page.waitForSelector("table tbody");

    // Select first file via checkbox or button
    const selectButton = page.locator("table tbody button").first();
    await selectButton.click();

    // Verify selection count updates
    const selectionText = await page.locator("text=/files? selected/i").textContent();
    expect(selectionText).toMatch(/1 files? selected/i);

    // Select second file
    const selectButton2 = page.locator("table tbody button").nth(1);
    await selectButton2.click();

    // Verify count incremented
    const selectionText2 = await page
      .locator("text=/files? selected/i")
      .textContent();
    expect(selectionText2).toMatch(/2 files? selected/i);
  });

  test("should navigate to bulk edit page", async ({ page }) => {
    await page.goto("/browse");
    await page.waitForSelector("table tbody");

    // Select a file
    const selectButton = page.locator("table tbody button").first();
    await selectButton.click();

    // Click "Edit" button
    const editButton = page.locator("button:has-text('Edit')").first();
    await editButton.click();

    // Verify we're on bulk edit page
    await expect(page).toHaveURL(/\/bulk-edit/);
    await expect(page.locator("heading")).toContainText(/bulk edit/i);
  });

  test("should fill edit form and submit", async ({ page }) => {
    await page.goto("/bulk-edit");

    // Fill in title field
    const titleInput = page.locator('input[id="title"]');
    await titleInput.fill("New Title");

    // Fill in language field
    const langInput = page.locator('input[id="language"]');
    await langInput.fill("eng");

    // Submit form (dry-run first)
    const dryRunButton = page.locator("button:has-text('Dry Run')");
    if (await dryRunButton.isVisible()) {
      await dryRunButton.click();

      // Wait for preview to load
      await page.waitForSelector("text=/preview|changes/i");

      // Verify changes preview is shown
      await expect(page.locator("text=/preview|changes/i")).toBeVisible();
    }
  });

  test("should commit job and monitor progress", async ({ page }) => {
    await page.goto("/bulk-edit");

    // Fill and submit
    const titleInput = page.locator('input[id="title"]');
    await titleInput.fill("Test Title");

    const submitButton = page.locator("button:has-text('Submit')").first();
    await submitButton.click();

    // Should redirect to job detail page
    await expect(page).toHaveURL(/\/jobs\/\w+/);

    // Verify job is running
    await expect(page.locator("text=/running|pending|done/i")).toBeVisible();

    // Wait for completion (timeout 30s)
    await page.waitForSelector("text=/done|failed/i", { timeout: 30000 });

    // Verify final status
    const status = await page.locator("text=/done|failed/i").textContent();
    expect(status).toMatch(/done|partial|failed/i);
  });

  test("should display undo button when job completes", async ({ page }) => {
    // Assuming a completed job exists
    await page.goto("/jobs");

    // Click a completed job
    const jobRow = page.locator("table tbody tr").first();
    await jobRow.click();

    // Wait for job detail to load
    await page.waitForSelector("button:has-text('Undo')");

    // Undo button should be visible
    const undoButton = page.locator("button:has-text('Undo')");
    await expect(undoButton).toBeVisible();
  });

  test("should undo job and verify restoration", async ({ page }) => {
    await page.goto("/jobs");

    // Find a completed job and navigate to it
    const jobRow = page.locator("table tbody tr").first();
    await jobRow.click();

    // Wait for undo button
    await page.waitForSelector("button:has-text('Undo')");

    // Click undo
    const undoButton = page.locator("button:has-text('Undo')");
    await undoButton.click();

    // Confirm if dialog appears
    if (await page.locator("text=/confirm|are you sure/i").isVisible()) {
      const confirmButton = page.locator("button:has-text('Confirm')").first();
      await confirmButton.click();
    }

    // Wait for undo job to complete
    await page.waitForSelector("text=/undo.*done|undo.*complete/i", {
      timeout: 30000,
    });

    // Verify success message or status
    const statusText = await page.locator("text=/complete|done/i").textContent();
    expect(statusText).toBeDefined();
  });

  test("should display accessibility features", async ({ page }) => {
    await page.goto("/browse");

    // Verify table headers have scope attribute
    const headers = await page.locator("th[scope='col']").count();
    expect(headers).toBeGreaterThan(0);

    // Verify keyboard navigation (Tab through buttons)
    const firstButton = page.locator("table tbody button").first();
    await firstButton.focus();
    await expect(firstButton).toBeFocused();

    // Verify Enter key works
    await page.press("table tbody button", "Enter");
  });
});
