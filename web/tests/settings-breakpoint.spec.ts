import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

for (const collapsed of [false, true])
  test(`Settings folds at the window boundary with the app rail ${collapsed ? "closed" : "open"}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
    if (collapsed) await page.getByTestId("close-navigation").click();
    await page.goto("/settings/account");
    // Resize the mounted page in both directions, including the formerly
    // squeezed width just above the app rail's own mobile breakpoint.
    for (const width of [1280, 1060, 1051, 1050, 1040, 810, 390, 1060]) {
      await page.setViewportSize({ width, height: 900 });
      const folded = width <= 1050;
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
      if (folded) {
        await page.getByTestId("settings-list-back").click();
        await expect(page.getByTestId("settings-section-tili")).toBeHidden();
        await page.getByTestId("settings-tili").click();
        await expect(page.getByTestId("settings-section-tili")).toBeVisible();
      }
    }
  });
