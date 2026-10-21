import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Capture-only review material, not a visual regression comparison.
// The native edit/geometry assertions live in composer-geometry.spec.ts.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`shell prefix review ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      if (width < 600) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-aurinkokello")
        .click();
      await expect(page.getByTestId("command-palette")).toBeVisible();
      const editor = page.getByTestId("message-input");
      const { snapshot } = await import("../lab/session.mjs");
      for (const [prefix, value] of [
        ["single", "!git status"],
        ["double", "!!ls"],
      ]) {
        await editor.fill(value);
        await editor.focus();
        await snapshot(
          page,
          testInfo.outputPath(`${prefix}-${width}-${theme}`),
          {
            region: ".ah-composer",
            labOrigin: new URL(page.url()).origin,
          },
        );
      }
    });
  }
}
