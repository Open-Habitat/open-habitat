import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(false, {
  BROWSER_HOST_LAB:
    process.env.OH_VISUAL_CAPTURE === "1" ||
    process.env.OH_NARROW_SETTINGS_CAPTURE === "1"
      ? "1"
      : "0",
});

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
});

for (const collapsed of [false, true])
  test(`Settings folds at the window boundary with the app rail ${collapsed ? "closed" : "open"}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
    if (collapsed) await page.getByTestId("close-navigation").click();
    // The root route draws Account on desktop too, without a section URL.
    await page.goto("/settings");
    // Resize the mounted page in both directions, including the formerly
    // squeezed width just above the app rail's own mobile breakpoint.
    for (const width of [
      1600, 1401, 1400, 1366, 1280, 1101, 1100, 1060, 1051, 1050, 1040, 1030,
      900, 810, 801, 800, 799, 600, 390, 1600,
    ]) {
      await page.setViewportSize({ width, height: 900 });
      const folded = width <= 800;
      await expect(page.getByTestId("settings-tili")).toBeVisible({
        visible: !folded,
      });
      await expect(page.getByTestId("settings-list-back")).toBeVisible({
        visible: folded,
      });
      await expect(page.getByTestId("settings-section-tili")).toBeVisible();
      await expect(page.getByTestId("settings-close")).toBeInViewport();
      expect(
        await page
          .locator(".s-main")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      if (
        process.env.OH_VISUAL_CAPTURE === "1" &&
        !collapsed &&
        [1280, 1030, 900, 390].includes(width)
      ) {
        for (const theme of ["light", "dark"]) {
          await page.evaluate(
            (theme) =>
              document.documentElement.setAttribute("data-theme", theme),
            theme,
          );
          await snapshot(
            page,
            `../issues/settings-one-pane-desktop/evidence/settings-${width}-${theme}`,
            { labOrigin: hostOrigin },
          );
        }
      }
      if (folded) {
        const assertCentred = async (selector: string) => {
          const box = await page.locator(selector).boundingBox();
          if (!box) throw new Error(`Missing visible ${selector}`);
          expect(
            Math.abs(box.x - (width - box.x - box.width)),
          ).toBeLessThanOrEqual(2);
        };
        const capture = async (view: string) => {
          if (
            process.env.OH_NARROW_SETTINGS_CAPTURE !== "1" ||
            collapsed ||
            ![390, 600, 800].includes(width)
          )
            return;
          for (const theme of ["light", "dark"]) {
            await page.evaluate(
              (theme) =>
                document.documentElement.setAttribute("data-theme", theme),
              theme,
            );
            await snapshot(
              page,
              `../issues/settings-narrow-left-aligned/evidence/${view}-${width}-${theme}`,
              { labOrigin: hostOrigin },
            );
          }
        };
        await assertCentred(".s-main");
        const back = await page.getByTestId("settings-list-back").boundingBox();
        const main = await page.locator(".s-main").boundingBox();
        if (!back || !main) throw new Error("Missing detail or back row");
        expect(Math.abs(back.x - main.x)).toBeLessThanOrEqual(1);
        await capture("detail");
        await page.getByTestId("settings-list-back").click();
        await expect(page.getByTestId("settings-section-tili")).toBeHidden();
        await assertCentred(".s-nav");
        await assertCentred(".s-search-field");
        await capture("list");
        await page.getByTestId("settings-tili").click();
        await expect(page.getByTestId("settings-section-tili")).toBeVisible();
      }
    }
    // A fresh root entry must show Account, not just a desktop-wide list.
    for (const width of [1400, 1280, 1030, 900, 801, 800, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/settings");
      await expect(page.getByTestId("settings-tili")).toBeVisible();
      await expect(page.getByTestId("settings-section-tili")).toBeVisible({
        visible: width > 800,
      });
      const nav = await page.locator(".s-nav").boundingBox();
      expect(nav?.width).toBeLessThanOrEqual(400);
    }
  });
