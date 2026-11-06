import inventory from "../lab/inventory.json" with { type: "json" };
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

// Host-backed synthetic lab, not a screenshot or a live-user session.
test("@lab conversation remains usable at desktop and phone widths", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  await expect(page.locator(inventory.foundation_metrics.frame)).toBeVisible();
  // The frame mounts before native history arrives; an empty loading stream
  // need not overflow. Measure the populated conversation, not that shell.
  await expect(
    page.locator(inventory.foundation_metrics.message).first(),
  ).toBeVisible();
  // Check usable space, not a second copy of the CSS token values. Both
  // themes share the same layout; a visual comparison belongs to capture.
  for (const width of [1440, 390]) {
    const height = width === 390 ? 844 : 900;
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate((selectors) => {
      const root = document.documentElement;
      const stream = document.querySelector(selectors.stream);
      const main = document.querySelector(selectors.main);
      const composer = document.querySelector(selectors.composer);
      const actions = document.querySelector(selectors.actions);
      return {
        pageFits: root.scrollWidth <= root.clientWidth + 1,
        streamScrolls: !!stream && stream.scrollHeight > stream.clientHeight,
        mainScrolls: !!main && main.scrollHeight > main.clientHeight,
        composerFits:
          !composer ||
          (composer.scrollHeight <= composer.clientHeight &&
            composer.getBoundingClientRect().bottom <= window.innerHeight &&
            !!actions &&
            actions.getBoundingClientRect().bottom <=
              composer.getBoundingClientRect().bottom),
      };
    }, inventory.foundation_metrics);
    expect(layout.pageFits).toBe(true);
    expect(layout.streamScrolls).toBe(true);
    expect(layout.mainScrolls).toBe(false);
    expect(layout.composerFits).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // The first rendered button: the phone's facts line is mounted but hidden
  // on a desktop.
  const focusTarget = page
    .locator(inventory.foundation_metrics.button)
    .filter({ visible: true })
    .first();
  await focusTarget.focus();
  await expect
    .poll(() =>
      focusTarget.evaluate((node) => getComputedStyle(node).outlineStyle),
    )
    .not.toBe("none");
  await page
    .getByRole("button")
    .and(page.getByTestId("close-navigation"))
    .click();
  await expect(page.locator(inventory.foundation_metrics.rail)).toHaveClass(
    /ah-rail-collapsed/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page
    .getByRole("button")
    .and(page.getByTestId("navigation-open"));
  await trigger.click();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-aurinkokello"))
      .first(),
  ).toBeVisible();
  await expect(page.locator(inventory.foundation_metrics.rail)).not.toHaveClass(
    /ah-rail-collapsed/,
  );
  await expect(page.locator(inventory.foundation_metrics.rail)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.locator(inventory.foundation_metrics.main),
  ).not.toHaveAttribute("inert");
  await page.setViewportSize({ width: 390, height: 390 });
  await trigger.click();
  const content = page.locator(".ah-rail-content");
  await expect
    .poll(() =>
      content.evaluate((node) => node.scrollHeight > node.clientHeight),
    )
    .toBe(true);
  await content.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  expect(await content.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-aurinkokello"))
    .click();
  await expect(
    page.locator(inventory.foundation_metrics.main),
  ).not.toHaveAttribute("inert");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(844);
});
