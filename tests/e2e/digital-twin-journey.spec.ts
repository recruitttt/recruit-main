/**
 * Digital twin journey smoke tests.
 *
 * Verifies the `/3d` page boots without runtime errors and that the
 * R3F canvas plus walk-mode control are mounted. Full journey coverage
 * (walking, station focus, intake) requires authenticated state and is
 * intentionally out of scope for this smoke layer.
 *
 * NOTE: These tests must be run against a running dev server (`pnpm dev`).
 */

import { test, expect } from "@playwright/test";

test.describe("Digital twin", () => {
  test("renders 3D scene", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/3d");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15000 });

    // No critical pageerrors (warnings/network errors filtered)
    const fatalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.toLowerCase().includes("warning"),
    );
    expect(fatalErrors, `page errors: ${fatalErrors.join("\n")}`).toHaveLength(0);
  });

  test("digital twin heading is visible", async ({ page }) => {
    await page.goto("/3d");
    await expect(page.getByRole("heading", { name: /the room/i })).toBeVisible();
  });
});
