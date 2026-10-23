import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390])
  for (const theme of ["light", "dark"]) {
    test(`@a11y editor settings keyboard and layout ${width} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      await page.goto("/settings/editor");
      await page.locator("html").evaluate((el, theme) => {
        el.dataset.theme = theme;
      }, theme);
      const cm = page.getByTestId("segment-codemirror6");
      const vs = page.getByTestId("segment-vscode");
      await expect(cm).toBeEnabled();
      await cm.focus();
      await page.keyboard.press("Tab");
      await expect(vs).toBeFocused();
      await page.keyboard.press("Space");
      await expect(vs).toHaveAttribute("aria-pressed", "true");
      await expect(cm).toHaveAttribute("aria-pressed", "false");
      await page.reload();
      await expect(vs).toHaveAttribute("aria-pressed", "true");
      await page.locator("html").evaluate((el, theme) => {
        el.dataset.theme = theme;
      }, theme);
      await cm.focus();
      await page.keyboard.press("Enter");
      await expect(cm).toHaveAttribute("aria-pressed", "true");
      await expect(vs).toHaveAttribute("aria-pressed", "false");
      await expect(cm).toBeInViewport();
      await expect(vs).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      if (process.env.OH_VISUAL_CAPTURE === "1") {
        await snapshot(
          page,
          fileURLToPath(
            new URL(
              `../../issues/editor-settings-segmented-control/evidence/settings-${width}-${theme}`,
              import.meta.url,
            ),
          ),
          { labOrigin: new URL(page.url()).origin },
        );
      }
    });
  }
