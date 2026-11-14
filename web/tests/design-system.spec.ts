import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./worker-host";

const evidence = "test-results/evidence";
const captureTest = process.env.OH_VISUAL_CAPTURE === "1" ? test : test.skip;
for (const theme of ["light", "dark"] as const) {
  captureTest(
    `@visual design catalog happy state in ${theme}`,
    async ({ page }) => {
      await page.goto("/?fixture=design");
      await page
        .locator("html")
        .evaluate(
          (element, value) => element.setAttribute("data-theme", value),
          theme,
        );
      await expect(page.getByTestId("workspace-title")).toBeVisible();
      await expect(
        page
          .locator('[data-testid="status-mark"][data-animated="running"]')
          .first(),
      ).toBeVisible();
      await expect(page.getByTestId("send").last()).toBeEnabled();
      await page.screenshot({
        path: `${evidence}/design-happy-${theme}.png`,
        fullPage: true,
      });
    },
  );
}
test("@visual unhappy states remain explicit", async ({ page }) => {
  await page.goto("/?fixture=design-unhappy");
  await expect(
    page.locator(
      '[data-testid^="connection-"][data-state][data-state="stale"]',
    ),
  ).toBeVisible();
  await expect(page.locator('[data-testid="uncertain-command"]')).toBeVisible();
  await expect(
    page.locator('[data-testid="operation-progress"][data-state="partial"]'),
  ).toBeVisible();
  const title = page.getByTestId("conversation-retitle");
  await expect(title).toBeDisabled();
  await expect(title).toHaveAttribute("aria-describedby", /.+/);
  await expect(page.getByTestId("message-input")).toHaveAttribute("readonly");
  if (process.env.OH_VISUAL_CAPTURE === "1")
    await page.screenshot({
      path: `${evidence}/design-unhappy-light.png`,
      fullPage: true,
    });
});
test("@visual multiline composer keeps send reachable on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?fixture=design");
  const editor = page.getByTestId("message-input");
  await editor.fill(
    Array.from({ length: 20 }, (_, i) => `rivi ${i}`).join("\n"),
  );
  expect(
    await editor.evaluate((node) => node.scrollHeight > node.clientHeight),
  ).toBe(true);
  // The fixture's agent is working; the send action stays reachable.
  await expect(page.getByTestId("send").last()).toBeInViewport();
  await page.setViewportSize({ width: 312, height: 675 });
  await expect(page.getByTestId("send").last()).toBeInViewport();
});

test("@visual keyboard focus follows visible controls", async ({ page }) => {
  await page.goto("/?fixture=design");
  await expect(page.getByTestId("workspace-title")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("skip-content").last()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});
test("@visual 200 percent zoom has no page-level horizontal overflow", async ({
  page,
}) => {
  // 1280 physical pixels at 200% browser zoom yields a 640 CSS-pixel viewport.
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/?fixture=design-unhappy");
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
});
test("@visual reduced motion removes running animation without hiding status", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=design");
  // The header's animated state mark stands still and stays visible.
  const mark = page.getByTestId("header-activity").locator(".oh-mark").first();
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute("data-state", "loading");
  await expect(mark.locator(".oh-ring")).toHaveCSS("animation-name", "none");
});
for (const fixture of ["design", "design-unhappy"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`@a11y ${fixture} in ${theme} has no axe violations`, async ({
      page,
    }) => {
      // Choose the theme before mounting: changing it afterwards lets Axe
      // sample intermediate colors during the shared control transitions.
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/?fixture=${fixture}`);
      await expect(page.locator("main#main")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
