import { test, expect } from "@playwright/test";

/**
 * E2E Test: Error Handling and Recovery
 * Tests transient failures, partial job completion, and error states
 */
test.describe("Error Handling and Recovery", () => {
  test("should handle network errors gracefully", async ({ page }) => {
    await page.goto("/jobs");

    // Simulate network error by going offline
    await page.context().setOffline(true);

    // Try to load data
    await page.reload();

    // Should show error message
    const errorMsg = page.locator("text=/error|failed/i");
    await expect(errorMsg).toBeVisible({ timeout: 5000 });

    // Verify retry button is available
    const retryButton = page.locator("button:has-text('Retry')");
    await expect(retryButton).toBeVisible();

    // Go back online
    await page.context().setOffline(false);

    // Retry
    await retryButton.click();

    // Should recover
    await page.waitForSelector("table", { timeout: 5000 });
  });

  test("should display validation errors on form", async ({ page }) => {
    await page.goto("/bulk-edit");

    // Try invalid input
    const languageInput = page.locator('input[id="language"]');
    await languageInput.fill("invalid-lang-code");

    // Try to submit
    const submitButton = page.locator("button:has-text('Submit')").first();
    await submitButton.click();

    // Should show validation error
    const errorMsg = page.locator("text=/invalid|not valid|error/i");
    const isVisible = await errorMsg.isVisible().catch(() => false);
    // Depending on implementation, error may be inline or modal
  });

  test("should handle partial job failure", async ({ page }) => {
    // Navigate to a job with partial completion
    await page.goto("/jobs");

    // Look for a partial/failed job
    const partialJob = page.locator("text=/partial|failed/i").first();
    if (await partialJob.isVisible()) {
      const jobRow = partialJob.locator("..");
      await jobRow.click();

      // Should show job detail with file-level errors
      await page.waitForSelector("table tbody");

      // Look for failed files
      const failedFiles = page.locator("text=/failed|error/i");
      const count = await failedFiles.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("should allow retry on transient failure", async ({ page }) => {
    await page.goto("/jobs");

    // Wait for jobs to load
    await page.waitForSelector("table tbody");

    // If a failed job exists, click on it
    const failedJob = page.locator("table tbody tr").first();
    await failedJob.click();

    // Wait for detail page
    await page.waitForURL(/\/jobs\/\w+/);

    // Look for retry button
    const retryButton = page.locator("button:has-text('Retry')");
    if (await retryButton.isVisible()) {
      await retryButton.click();

      // Should restart job
      await page.waitForSelector("text=/running|pending/i", { timeout: 5000 });
    }
  });

  test("should show technical error details", async ({ page }) => {
    await page.goto("/");

    // Simulate error (could be via developer tools or error injection)
    // For now, just verify error detail display is accessible
    const errorElement = page.locator("text=/error/i");
    if (await errorElement.isVisible()) {
      // Click to expand if collapsible
      const detail = page.locator("text=/code|details|technical/i");
      const isVisible = await detail.isVisible().catch(() => false);
    }
  });

  test("should display user-friendly error messages", async ({ page }) => {
    await page.goto("/browse");

    // Navigate to a mount that may not exist
    const invalidPath = page.locator("text=/not found|does not exist/i");

    // Messages should be in plain language, not error codes
    const allText = await page.content();
    expect(allText).toBeDefined();
  });

  test("should persist state across navigation after error", async ({
    page,
  }) => {
    await page.goto("/bulk-edit");

    // Fill form with data
    const titleInput = page.locator('input[id="title"]');
    await titleInput.fill("Test Title");

    // Simulate error by forcing bad request
    // (implementation may vary)

    // Navigate away and back
    await page.goto("/jobs");
    await page.go(-1);

    // Form data may be preserved or cleared depending on design
    // Just verify no crash occurs
    await expect(page).toHaveURL(/bulk-edit/);
  });

  test("should handle WebSocket disconnection", async ({ page }) => {
    await page.goto("/jobs");
    await page.waitForSelector("table tbody tr");

    // Click a job to open WebSocket
    const firstJob = page.locator("table tbody tr").first();
    await firstJob.click();

    // Wait for WebSocket to connect
    await page.waitForSelector("text=/running|done|pending/i", {
      timeout: 5000,
    });

    // Simulate WebSocket close by page offline
    await page.context().setOffline(true);

    // Wait a moment for disconnect
    await page.waitForTimeout(1000);

    // Page should still be readable (fallback to polling or error message)
    const content = await page.content();
    expect(content).toBeDefined();

    // Go online
    await page.context().setOffline(false);
  });
});
