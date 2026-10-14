import { expect, test } from "./lab-host";
import { labOrigin } from "../test-ports.mjs";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
import inventory from "../lab/inventory.json" with { type: "json" };

// Host-backed synthetic lab, not a screenshot or a live-user session.
test("@lab v2 shared conversation metrics in both themes and at phone width", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  await expect(page.locator(inventory.foundation_metrics.frame)).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const values = await page.evaluate((selectors) => {
        const q = (key: keyof typeof selectors) => selectors[key];
        const style = (selector: string) =>
          getComputedStyle(
            document.querySelector(selector) ?? document.documentElement,
          );
        const rail =
          document.querySelector(q("rail")) ?? document.documentElement;
        const header = style(q("header"));
        const stream = style(q("stream"));
        const button = style(q("button"));
        const heading = style(q("heading"));
        const message = style(q("message"));
        const root = getComputedStyle(document.documentElement);
        return {
          railWidth: Math.round(rail.getBoundingClientRect().width),
          topPadding: header.paddingTop,
          sidePadding: header.paddingRight,
          headerLeadingPadding: header.paddingLeft,
          columnWidth: root.getPropertyValue("--ah-conversation-width").trim(),
          streamPadding: stream.paddingLeft,
          titleSize: heading.fontSize,
          bodySize: message.fontSize,
          buttonRadius: button.borderRadius,
          focusWidth: root.getPropertyValue("--ah-focus-width").trim(),
          focusOffset: root.getPropertyValue("--ah-focus-offset").trim(),
          frameWidth: (
            document.querySelector(q("frame")) ?? document.documentElement
          ).getBoundingClientRect().width,
          renderedColumnWidth: (
            document.querySelector(q("column")) ?? document.documentElement
          ).getBoundingClientRect().width,
          streamScrolls:
            (document.querySelector(q("stream"))?.scrollHeight ?? 0) >
            (document.querySelector(q("stream"))?.clientHeight ?? 0),
          speakerSize: style(q("speaker")).fontSize,
          copyIcon: Boolean(document.querySelector(q("copyIcon"))),
          toolBorder: style(q("tool")).borderTopWidth,
          detailsVisible: Boolean(document.querySelector(q("detailsIcon"))),
          mainScrolls:
            (document.querySelector(q("main"))?.scrollHeight ?? 0) >
            (document.querySelector(q("main"))?.clientHeight ?? 0),
          streamBlockPadding: stream.paddingTop,
          composerBlockPadding: style(q("composer")).paddingTop,
          composerBottom:
            document.querySelector(q("composer"))?.getBoundingClientRect()
              .bottom ?? 9999,
          composerActionsBottom:
            document.querySelector(q("actions"))?.getBoundingClientRect()
              .bottom ?? 9999,
          composerPresent: Boolean(document.querySelector(q("composer"))),
          streamBottom:
            document.querySelector(q("stream"))?.getBoundingClientRect()
              .bottom ?? 9999,
          composerScrolls:
            (document.querySelector(q("composer"))?.scrollHeight ?? 0) >
            (document.querySelector(q("composer"))?.clientHeight ?? 0),
        };
      }, inventory.foundation_metrics);
      if (width === 1440) {
        expect(values.railWidth).toBe(296);
        // Tool and reply cards share the stream's inset 732px reading column.
        expect(values.renderedColumnWidth).toBe(732);
      }
      expect(values.streamScrolls).toBe(true);
      expect(values.mainScrolls).toBe(false);
      expect(values.topPadding).toBe(width === 390 ? "6px" : "13px");
      expect(values.sidePadding).toBe(width === 390 ? "14px" : "24px");
      expect(values.headerLeadingPadding).toBe(
        width === 390 ? "100px" : "24px",
      );
      expect(values.columnWidth).toBe("780px");
      expect(values.streamPadding).toBe(width === 390 ? "14px" : "24px");
      expect(values.streamBlockPadding).toBe(width === 390 ? "12px" : "22px");
      if (width === 390 && !values.composerPresent) {
        expect(values.streamBottom).toBeLessThanOrEqual(844);
        await expect(
          page.locator(inventory.foundation_metrics.composer),
        ).toHaveCount(0);
      }
      if (values.composerPresent) {
        expect(values.composerBlockPadding).toBe("12px");
        expect(values.composerScrolls).toBe(false);
        expect(values.composerActionsBottom).toBeLessThanOrEqual(
          values.composerBottom,
        );
        expect(values.composerBottom).toBeLessThanOrEqual(
          width === 390 ? 844 : 900,
        );
      }
      expect(values.titleSize).toBe("15.5px");
      expect(values.bodySize).toBe(width === 390 ? "15px" : "14.5px");
      expect(values.buttonRadius).toBe("8px");
      expect(values.speakerSize).toBe("11px");
      expect(values.copyIcon).toBe(true);
      expect(values.toolBorder).toBe("1px");
      expect(values.detailsVisible).toBe(true);
      expect(values.focusWidth).toBe("2px");
      expect(values.focusOffset).toBe("2px");
      expect(values.frameWidth).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const focusTarget = page.locator(inventory.foundation_metrics.button).first();
  await focusTarget.focus();
  await expect
    .poll(() =>
      focusTarget.evaluate((node) => getComputedStyle(node).outlineWidth),
    )
    .toBe("2px");
  await expect
    .poll(() =>
      focusTarget.evaluate((node) => getComputedStyle(node).outlineOffset),
    )
    .toBe("2px");
  await page.getByRole("button", { name: "Sulje navigaatio" }).click();
  await expect(page.locator(inventory.foundation_metrics.rail)).toHaveCSS(
    "width",
    "52px",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "Avaa navigaatio" });
  await trigger.click();
  await expect(
    page
      .getByRole("navigation", { name: "Työtilat ja keskustelut" })
      .getByRole("link", { name: /aurinkokello/ })
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
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  await expect(
    page.locator(inventory.foundation_metrics.main),
  ).not.toHaveAttribute("inert");
  await expect(
    page.getByRole("heading", { name: "aurinkokello", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(844);
});
