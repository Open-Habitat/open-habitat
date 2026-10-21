import { hostOrigin } from "../test-ports.mjs";
import { expect, type Locator, type Page, test } from "./worker-host";

test.use({ ignoreHTTPSErrors: true });

async function feedback(control: Locator, page: Page, press = true) {
  await expect(control).toHaveAttribute(
    "data-ah-primitive",
    /button|link|menu-item|disclosure/,
  );
  await control.scrollIntoViewIfNeeded();
  const background = () =>
    control.evaluate((node) => getComputedStyle(node).backgroundColor);
  const idle = await background();
  await control.hover();
  await expect.poll(background).not.toBe(idle);
  if (press) {
    const hover = await background();
    await page.mouse.down();
    await expect.poll(background).not.toBe(hover);
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
  // Programmatic keyboard focus is used here to avoid opening a menu or following a link.
  await page.keyboard.press("Tab");
  await control.focus();
  await expect(control).toBeFocused();
  await expect(control).not.toHaveCSS("outline-width", "0px");
}

test("@control-states production navigation and menu expose hover and keyboard focus", async ({
  page,
}) => {
  await page.request.get(`${hostOrigin}/fixture/reset-clock`);
  await page.request.get(`${hostOrigin}/fixture/conversations-reset`);
  await page.request.get(`${hostOrigin}/fixture/scenario?value=ready`);
  await page.goto(`${hostOrigin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await feedback(page.locator(".ah-home-card-head a").first(), page);
  const menu = page.getByTestId("account-menu-trigger");
  await feedback(menu, page, false);
  await menu.click();
  await feedback(page.getByTestId("menu-settings"), page, false);
});

test("@control-states migrated rail, drawer and text links retain their layout", async ({
  page,
}) => {
  await page.request.get(`${hostOrigin}/fixture/reset-clock`);
  await page.request.get(`${hostOrigin}/fixture/conversations-reset`);
  await page.request.get(`${hostOrigin}/fixture/scenario?value=ready`);
  await page.goto(`${hostOrigin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  const row = page.locator(".ah-workspace-row").first();
  await expect(row).toBeVisible();
  expect(
    await row.evaluate((node) => node.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(36);
  const workspace = row.locator(".ah-workspace-link");
  await expect(workspace).toHaveCSS("display", "block");
  expect(
    await workspace.evaluate((node) => {
      const label = node as HTMLElement;
      label.textContent =
        "long-workspace-name-that-does-not-fit-in-the-sidebar";
      return (
        label.getBoundingClientRect().right <=
        (label.parentElement?.getBoundingClientRect().right ?? -1)
      );
    }),
  ).toBe(true);
  await page.locator(".ah-home-card-head a").first().click();
  await expect(page.locator(".ah-header-workspace")).toHaveCSS(
    "padding-left",
    "0px",
  );
  await expect(page.locator(".ah-header-workspace")).toHaveCSS(
    "display",
    "block",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("navigation-open").first().click();
  const scrim = page.locator(".ah-mobile-scrim");
  const idle = await scrim.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  expect(idle).not.toBe("rgba(0, 0, 0, 0)");
  await scrim.hover({ force: true });
  await expect(scrim).toHaveCSS("background-color", idle);
  await scrim.click({ force: true });
  await page.locator(".ah-skip").focus();
  await expect(page.locator(".ah-skip")).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
});
