import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`capacity refusal stays in its column with controls ${width} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.request.get("/fixture/conversations-reset");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      await page.goto("/settings/conversations");
      const written = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/v1/server/conversations") &&
          r.request().method() === "PUT",
      );
      await page.getByTestId("live-default-input").fill("1");
      await page.getByTestId("live-default-input").press("Enter");
      expect((await written).status()).toBe(200);
      await page.request.get("/fixture/scenario?value=pi-visual-hold");
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const ws = state.workspaces.find(
        (w: { name: string }) => w.name === "aurinkokello",
      ).workspace_id;
      await page.goto(`/workspaces/${ws}`);
      await page.getByTestId("conversation-start").click();
      await page
        .getByTestId("message-input")
        .fill("Keep this synthetic turn working");
      await page.getByTestId("send").click();
      await expect(
        page.locator(".ah-turn-reply > .ah-message").last(),
      ).toBeVisible();
      await page.goto(`/workspaces/${ws}`);
      await page.getByTestId("conversation-start").click();
      const banner = page.getByTestId("creation-problem");
      await expect(banner).toHaveAttribute("data-tone", "danger");
      await expect(banner).toBeInViewport({ ratio: 1 });
      const bounds = await banner.boundingBox();
      const composer = await page.locator(".ah-cbox").boundingBox();
      if (!bounds || !composer) throw new Error("Missing column bounds");
      expect(Math.abs(bounds.x - composer.x)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(bounds.x + bounds.width - composer.x - composer.width),
      ).toBeLessThanOrEqual(1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(composer.y);
      const start = page.getByTestId("start-here");
      await expect(start).toBeAttached();
      const startBounds = await start.boundingBox();
      if (!startBounds) throw new Error("Missing start page");
      expect(startBounds.y + startBounds.height).toBeLessThanOrEqual(bounds.y);
      // The start page remains reachable by scrolling, not deleted or overlaid.
      const stream = page.getByTestId("conversation-stream");
      await stream.evaluate((el) => {
        el.scrollTop = 0;
      });
      await expect(start).toBeInViewport();
      await stream.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(banner).toBeInViewport({ ratio: 1 });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      await page.mouse.move(0, 0);
      if (process.env.OH_VISUAL_CAPTURE === "1") {
        await snapshot(
          page,
          `../issues/capacity-refusal-banner/evidence/${width}-${theme}`,
          { labOrigin: new URL(page.url()).origin },
        );
      }
      const results = await new AxeBuilder({ page })
        .include(".ah-conversation-frame")
        .analyze();
      expect(results.violations).toEqual([]);
      if (width === 390) {
        await page.getByTestId("conversation-menu").click();
        await expect(page.getByTestId("menu-retitle")).toHaveAttribute(
          "aria-disabled",
          "true",
        );
        await expect(page.getByTestId("menu-details")).toBeVisible();
        await expect(page.getByTestId("menu-toggle-editor")).toBeVisible();
        await page.getByTestId("menu-close").click();
      } else {
        await expect(page.getByTestId("conversation-retitle")).toBeDisabled();
        await page.getByTestId("workspace-details").click();
        await expect(page.getByTestId("conversation-details")).toBeVisible();
        await page.getByTestId("workspace-details").click();
        await expect(page.getByTestId("toggle-editor")).toBeVisible();
        await page.getByTestId("dialog-close").click();
      }
      await expect(page).toHaveURL(new RegExp(`/workspaces/${ws}$`));
      await expect(banner).toHaveCount(0);
    });
  }
}
