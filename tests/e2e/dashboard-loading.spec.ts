import { expect, test } from "@playwright/test";

test.describe("Dashboard loading preview", () => {
  test("renders a stable nonblank globe in preview mode", async ({ page }) => {
    await page.goto("/dashboard-loading-preview");

    await expect(page.getByRole("heading", { name: /Preparing applications/i })).toBeVisible();
    await expect(page.locator("[data-testid='dashboard-loading-page']")).toHaveAttribute("data-preview", "true");

    const canvas = page.locator("[data-testid='dashboard-loading-globe'] canvas").first();
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(1200);

    const stats = await canvas.evaluate((element) => {
      const globeCanvas = element as HTMLCanvasElement;
      const gl =
        globeCanvas.getContext("webgl2", { preserveDrawingBuffer: true }) ??
        globeCanvas.getContext("webgl", { preserveDrawingBuffer: true });
      if (!gl) {
        return { width: globeCanvas.width, height: globeCanvas.height, litPixels: 0 };
      }

      const pixels = new Uint8Array(globeCanvas.width * globeCanvas.height * 4);
      gl.readPixels(0, 0, globeCanvas.width, globeCanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let litPixels = 0;
      for (let index = 0; index < pixels.length; index += 16) {
        const alpha = pixels[index + 3] ?? 0;
        const luminance = (pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0);
        if (alpha > 0 && luminance > 16) {
          litPixels += 1;
        }
      }

      return {
        width: globeCanvas.width,
        height: globeCanvas.height,
        litPixels,
      };
    });

    expect(stats.width).toBeGreaterThan(120);
    expect(stats.height).toBeGreaterThan(120);
    expect(stats.litPixels).toBeGreaterThan(700);

    await page.waitForTimeout(6200);
    await expect(page).toHaveURL(/\/dashboard-loading-preview$/);
  });
});
