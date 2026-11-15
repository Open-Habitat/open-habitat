import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { openHeaderPanel } from "./conversation-view";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test(`@lab YAML explanation ${width} ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      const session = await (await page.request.get("/auth/session")).json();
      const headers = { Origin: labOrigin, "X-Agent-Host-CSRF": session.csrf };
      for (const data of [
        { language },
        { experimental: { "explain-mode": true } },
      ]) {
        expect(
          (
            await page.request.put("/api/v1/account/preferences", {
              headers,
              data,
            })
          ).ok(),
        ).toBe(true);
      }
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const root = state.workspaces.find(
        (w: { name: string }) => w.name === "aurinkokello",
      ).path;
      await writeFile(
        join(root, "preview.yml"),
        "name: Example\nsteps:\n  - name: Test\n    run: |\n      npm ci\n      npm test\nempty: []\n",
      );
      await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
      // Enable while the conversation controls are visible; opening a panel
      // remains a safe action in Explain mode, also at phone width.
      await page.getByTestId("explain-toggle").click();
      await openHeaderPanel(page, "toggle-editor");
      if (width === 390) await page.getByTestId("hide-conversation").click();
      await expect(page.getByTestId("editor-file-picker")).toBeVisible();
      await page
        .getByTestId("editor-file-entry")
        .and(page.locator('[data-path="preview.yml"]'))
        .click();
      await expect(page.getByTestId("editor-document")).toBeVisible();
      if (await page.getByTestId("editor-file-picker").isVisible())
        await page.getByTestId("editor-picker").click();
      await page.getByTestId("editor-preview-toggle").click();
      const preview = page.getByTestId("yaml-preview");
      await expect(preview).toBeVisible();
      await preview.getByText("Example", { exact: true }).hover();
      const card = page.getByTestId("explain-card");
      await expect(card).toHaveAttribute("data-card", "D09");
      await expect(card).toContainText(
        language === "fi" ? "YAML-esikatselu" : "YAML preview",
      );
      await expect(card).toBeInViewport();
      if (process.env.OH_VISUAL_CAPTURE === "1") {
        await snapshot(
          page,
          `../issues/frontmatter-nested-preview/evidence/explain-${width}-${language}`,
          { labOrigin },
        );
      }
    });
  }
}
