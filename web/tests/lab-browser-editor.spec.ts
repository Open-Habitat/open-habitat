import { fileURLToPath } from "node:url";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { test, expect } from "./lab-host";

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
      await page.getByTestId("toggle-editor").click();
      await page
        .getByTestId("editor-file-entry")
        .filter({ hasText: "cmd" })
        .click();
      await page
        .getByTestId("editor-file-entry")
        .filter({ hasText: "main.go" })
        .click();
      await expect(page.getByTestId("editor-document")).toBeVisible();
      await page.locator("html").evaluate((el, theme) => {
        el.dataset.theme = theme;
      }, theme);
      await page
        .getByTestId("editor-document")
        .fill(
          'package main\n\nimport "fmt"\n\nfunc main() {\n\t// Paikallinen muutos\n\tfmt.Println("Aurinkokello")\n}\n',
        );
      if (width === 390) await page.getByTestId("hide-conversation").click();
      const out = fileURLToPath(
        new URL(
          `../../issues/implement-editor-files-codemirror/evidence/editor-${width}-${theme}`,
          import.meta.url,
        ),
      );
      await snapshot(page, out, { labOrigin: new URL(page.url()).origin });
      await expect(page.getByTestId("editor-save")).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
