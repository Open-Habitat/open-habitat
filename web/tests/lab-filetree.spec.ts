import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390])
  for (const theme of ["light", "dark"]) {
    test(`@lab @a11y Viivasto tree ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
      // Synthetic presentation-only directories exercise a compact chain;
      // the open document still uses the real synthetic host's confined API.
      await page.route("**/api/v1/workspaces/editor/list?**", async (route) => {
        const url = new URL(route.request().url());
        const path = url.searchParams.get("path") ?? "";
        const entries =
          path === "src"
            ? [{ name: "components", kind: "directory" }]
            : path === "src/components"
              ? [{ name: "editor", kind: "directory" }]
              : path === "src/components/editor"
                ? [
                    { name: "Tree.tsx", kind: "file" },
                    {
                      name: "A-very-long-file-name-demonstrating-ellipsis.ts",
                      kind: "file",
                    },
                  ]
                : undefined;
        if (entries) {
          await route.fulfill({
            json: {
              schema_version: 1,
              workspace_id: url.searchParams.get("workspace_id"),
              path,
              entries,
              truncated: false,
            },
          });
        } else {
          const response = await route.fetch();
          const json = await response.json();
          if (!path) json.entries.push({ name: "src", kind: "directory" });
          await route.fulfill({ response, json });
        }
      });
      await page.getByTestId("toggle-editor").click();
      const entry = (path: string) =>
        page
          .getByTestId("editor-file-entry")
          .and(page.locator(`[data-path="${path}"]`));
      await entry("cmd").click();
      await entry("cmd/main.go").click();
      await expect(page.getByTestId("editor-document")).toBeVisible();
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      await page
        .getByTestId("editor-document")
        .fill(
          'package main\n\nfunc main() {\n\tprintln("Paikallinen muutos")\n}\n',
        );
      if (width === 390) {
        await page.getByTestId("hide-conversation").click();
        await page.getByTestId("editor-picker").click();
      }
      await entry("src").click();
      await entry("src/components").click();
      await entry("src/components/editor").click();
      await expect(entry("src/components/editor/Tree.tsx")).toBeVisible();
      await entry("src/components/editor/Tree.tsx").focus();
      await entry("src/components/editor/Tree.tsx").press("ArrowDown");
      await expect(
        entry(
          "src/components/editor/A-very-long-file-name-demonstrating-ellipsis.ts",
        ),
      ).toBeFocused();
      await expect(
        entry("cmd/main.go").getByTestId("editor-file-state"),
      ).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="browser-editor"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      const out = testInfo.outputPath(`tree-${width}-${theme}`);
      await snapshot(page, out, { labOrigin: new URL(page.url()).origin });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
