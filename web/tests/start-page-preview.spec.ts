import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { snapshot as captureSnapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { openHeaderPanel } from "./conversation-view";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(false, { BROWSER_HOST_LAB: "1" });
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});
const source =
  "---\ntitle: Example workspace\ngoals:\n  - title: Plan work\n    when: Before starting\n    what: Make a plan\n    steps: [Read, Discuss]\n    prompt: Please plan the work\n    start: immediate\n  - title: Continue work\n    guide: none\n    prompt: Continue the work\n---\n# Introduction\nAn example workspace.\n";
for (const width of [1440, 390])
  for (const language of ["fi", "en-US"]) {
    test(`@start-page-preview inert checked page in editor ${width} ${language}`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      const session = await (await page.request.get("/auth/session")).json();
      for (const data of [
        { language },
        { experimental: { "explain-mode": true } },
      ]) {
        expect(
          (
            await page.request.put("/api/v1/account/preferences", {
              headers: {
                Origin: new URL(page.url()).origin,
                "X-Agent-Host-CSRF": session.csrf,
              },
              data,
            })
          ).ok(),
        ).toBe(true);
      }
      await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
      await openHeaderPanel(page, "toggle-editor");
      if (width === 390) await page.getByTestId("hide-conversation").click();
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const root = state.workspaces.find(
        (w: { name: string }) => w.name === "aurinkokello",
      ).path;
      await mkdir(join(root, ".agents"), { recursive: true });
      await writeFile(join(root, ".agents/start-page.md"), source);
      await writeFile(
        join(root, "example.json"),
        '{"goals":[{"title":"JSON example","steps":["Read","Discuss"]}]}',
      );
      const entry = (path: string) =>
        page
          .getByTestId("editor-file-entry")
          .and(page.locator(`[data-path="${path}"]`));
      await expect(entry(".agents")).toBeVisible();
      await entry(".agents").click();
      await entry(".agents/start-page.md").click();
      const preview = page.getByTestId("editor-preview");
      await expect(preview.getByTestId("start-page-preview")).toBeVisible();
      const writes: string[] = [];
      page.on("request", (request) => {
        if (request.method() === "POST")
          writes.push(new URL(request.url()).pathname);
      });
      const goal = preview.locator(".ah-start-goal").first();
      await goal.click();
      await expect(
        preview
          .getByTestId("preview-goal-guides")
          .locator(":scope > li")
          .first(),
      ).toBeFocused();
      await preview.getByTestId("starting-goal").nth(1).click();
      const noGuideDetails = preview
        .getByTestId("preview-goal-guides")
        .locator(":scope > li")
        .nth(1);
      await expect(noGuideDetails).toBeFocused();
      await expect(noGuideDetails.locator("dl")).toHaveCount(0);
      await expect(noGuideDetails.locator(".ah-markdown")).toContainText(
        "Continue the work",
      );
      expect(writes.filter((path) => /conversations/.test(path))).toEqual([]);
      await expect(
        preview.getByTestId("preview-renderer-toggle"),
      ).toBeVisible();
      await preview.getByTestId("preview-renderer-toggle").click();
      await expect(preview.getByTestId("markdown-frontmatter")).toBeVisible();
      await expect(preview.getByTestId("start-page-preview")).toHaveCount(0);
      await preview.getByTestId("preview-renderer-toggle").click();
      await expect(preview.getByTestId("start-page-preview")).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="browser-editor"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(
        await preview.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      if (process.env.OH_VISUAL_CAPTURE === "1")
        await captureSnapshot(
          page,
          `../issues/start-page-preview-renderer/evidence/valid-${width}-${language}`,
          { labOrigin: hostOrigin },
        );
      // Enter through the desktop account menu, then inspect the same card
      // at the target width (the compact editor hides the global navigation).
      if (width === 390)
        await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByTestId("account-menu-trigger").click();
      await page.getByTestId("menu-explain").click();
      if (width === 390) await page.setViewportSize({ width, height: 900 });
      await preview.getByTestId("preview-renderer-toggle").hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "D11",
      );
      if (process.env.OH_VISUAL_CAPTURE === "1")
        await captureSnapshot(
          page,
          `../issues/start-page-preview-renderer/evidence/explain-${width}-${language}`,
          { labOrigin: hostOrigin },
        );
      await preview.locator(".ah-start-goal").first().hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "D12",
      );
      await page.getByTestId("explain-stop").click();
      await page.getByTestId("editor-text-toggle").click();
      await page
        .getByTestId("editor-document")
        .fill(source.replace("    prompt: Please plan the work\n", ""));
      await page.getByTestId("editor-preview-toggle").click();
      await expect(preview.getByTestId("start-page-preview")).toHaveCount(0);
      await expect(
        preview.getByTestId("preview-check").locator("code"),
      ).toHaveText("goals[0].prompt");
      await expect(preview.getByTestId("markdown-frontmatter")).toBeVisible();
      expect(await readFile(join(root, ".agents/start-page.md"), "utf8")).toBe(
        source,
      );
      if (process.env.OH_VISUAL_CAPTURE === "1")
        await captureSnapshot(
          page,
          `../issues/start-page-preview-renderer/evidence/invalid-${width}-${language}`,
          { labOrigin: hostOrigin },
        );
      // Changing files uses the ordinary save-on-leave. JSON is always generic.
      if (!(await page.getByTestId("editor-file-picker").isVisible()))
        await page.getByTestId("editor-picker").click();
      await entry("example.json").click();
      await expect(page.locator(".ah-browser-filename")).toHaveText(
        "example.json",
      );
      await expect(page.getByTestId("editor-document")).toContainText(
        "JSON example",
      );
      await page.getByTestId("editor-preview-toggle").click();
      await expect(
        preview
          .locator(".ah-yaml-card header")
          .filter({ hasText: "JSON example" }),
      ).toHaveCount(1);
      await expect(preview.getByTestId("preview-check")).toHaveCount(0);
    });
  }
