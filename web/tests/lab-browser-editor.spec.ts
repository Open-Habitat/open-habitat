import { fileURLToPath } from "node:url";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { openHeaderPanel } from "./conversation-view";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390])
  for (const theme of ["light", "dark"]) {
    test(`@lab @browser-editor editor evidence ${width} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
      await openHeaderPanel(page, "toggle-editor");
      await page
        .getByTestId("editor-file-entry")
        .and(page.locator('[data-path="cmd"]'))
        .click();
      await page
        .getByTestId("editor-file-entry")
        .and(page.locator('[data-path="cmd/main.go"]'))
        .click();
      await expect(page.getByTestId("editor-document")).toBeVisible();
      await page.locator("html").evaluate((el, theme) => {
        el.dataset.theme = theme;
      }, theme);
      const doc = page.getByTestId("editor-document");
      await doc.fill(
        Array.from(
          { length: 250 },
          (_, i) => `// synthetic line ${i + 1}`,
        ).join("\n"),
      );
      for (const mode of ["split", "full"]) {
        if (mode === "full")
          await page.getByTestId("hide-conversation").click();
        await doc.press("Control+End");
        await expect(
          doc
            .locator(".cm-line")
            .filter({ hasText: /^\/\/ synthetic line 250$/ }),
        ).toBeInViewport();
        // Committed issue evidence is refreshed only on request, so the
        // ordinary suite and the clean gate leave the tree untouched.
        if (process.env.OH_VISUAL_CAPTURE === "1") {
          const out = fileURLToPath(
            new URL(
              `../../issues/editor-long-file-cannot-scroll/evidence/editor-${width}-${theme}-${mode}`,
              import.meta.url,
            ),
          );
          await snapshot(page, out, { labOrigin: new URL(page.url()).origin });
        }
        await expect(page.getByTestId("editor-save")).toBeInViewport();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
