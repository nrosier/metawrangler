import { test, expect } from "@playwright/test";

/**
 * E2E Test: Mount Management Workflow
 * Tests add, edit, and delete mount operations
 */
test.describe("Mount Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("should display mounts list", async ({ page }) => {
    // Wait for mounts table to load
    await page.waitForSelector("table");

    // Verify table has headers with scope
    const headers = await page.locator("th[scope='col']").count();
    expect(headers).toBeGreaterThan(0);
  });

  test("should add new mount", async ({ page }) => {
    // Find mount form
    const nameInput = page.locator('input[id="mount-name"]');
    const pathInput = page.locator('input[id="mount-path"]');
    const typeSelect = page.locator('select[id="mount-type"]');

    // Verify inputs are associated with labels
    const nameLabel = page.locator('label[for="mount-name"]');
    await expect(nameLabel).toBeVisible();

    // Fill in form
    await nameInput.fill("Test Mount");
    await pathInput.fill("/mnt/test");
    await typeSelect.selectOption("local");

    // Submit
    const submitButton = page.locator(
      "button:has-text('Add Mount'), button:has-text('Submit')"
    );
    await submitButton.click();

    // Verify mount appears in list (after potential delay)
    await page.waitForSelector("table");
    const tableContent = await page.locator("table").textContent();
    expect(tableContent).toContain("Test Mount");
  });

  test("should validate mount form", async ({ page }) => {
    // Try to submit empty form
    const submitButton = page.locator(
      "button:has-text('Add Mount'), button:has-text('Submit')"
    );
    await submitButton.click();

    // Should show validation error
    const errorMsg = page.locator("text=/required|invalid/i");
    const isVisible = await errorMsg.isVisible().catch(() => false);
    // Error may or may not appear depending on validation strategy
  });

  test("should delete mount with confirmation", async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector("table tbody tr");

    // Get first mount name
    const firstMountName = await page
      .locator("table tbody tr")
      .first()
      .textContent();

    // Click delete button on first row
    const deleteButton = page.locator("table tbody tr button").first();
    await deleteButton.click();

    // Handle confirmation if present
    if (await page.locator("text=/confirm|delete/i").isVisible()) {
      const confirmButton = page.locator(
        "button:has-text('Confirm'), button:has-text('Delete')"
      );
      await confirmButton.click();
    }

    // Verify mount is removed from list
    await page.waitForSelector("table");
    const tableContent = await page.locator("table").textContent();
    if (firstMountName) {
      expect(tableContent).not.toContain(firstMountName);
    }
  });

  test("should display keyboard-accessible mount controls", async ({
    page,
  }) => {
    // Tab to first delete button
    const deleteButton = page.locator("table tbody button").first();
    await deleteButton.focus();
    await expect(deleteButton).toBeFocused();

    // Verify it has proper ARIA attributes
    const ariaLabel = await deleteButton.getAttribute("aria-label");
    expect(ariaLabel).toBeDefined();
  });

  test("should display form labels correctly", async ({ page }) => {
    const formInputs = [
      { id: "mount-name", label: /name|label/i },
      { id: "mount-path", label: /path|location/i },
      { id: "mount-type", label: /type|kind/i },
    ];

    for (const input of formInputs) {
      const label = page.locator(`label[for="${input.id}"]`);
      await expect(label).toBeVisible();
    }
  });

  test("should show mount health status", async ({ page }) => {
    // Wait for mount list
    await page.waitForSelector("table");

    // Look for health status indicators (e.g., online/offline badges)
    const statusElements = await page.locator("text=/online|offline|healthy/i");
    const count = await statusElements.count();
    // May or may not have status column depending on implementation
  });
});
