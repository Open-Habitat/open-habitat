import { expect, test } from "@playwright/test";

// Host-backed synthetic lab, not a screenshot or a live-user session.
test("@lab v2 shared conversation metrics in both themes and at phone width", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  await expect(page.locator(".ah-conversation-frame")).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const values = await page.evaluate(() => {
        const style = (selector: string) =>
          getComputedStyle(
            document.querySelector(selector) ?? document.documentElement,
          );
        const rail =
          document.querySelector(".ah-rail") ?? document.documentElement;
        const header = style(".ah-conversation-frame > .ah-agent-header");
        const stream = style(".ah-conversation-stream");
        const button = style(".ah-conversation-frame .ah-button");
        const heading = style(".ah-agent-header h1");
        const message = style(".ah-prose");
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
            document.querySelector(".ah-conversation-frame") ??
            document.documentElement
          ).getBoundingClientRect().width,
          renderedColumnWidth: (
            document.querySelector(".ah-conversation-stream > .ah-timeline") ??
            document.documentElement
          ).getBoundingClientRect().width,
          streamScrolls:
            (document.querySelector(".ah-conversation-stream")?.scrollHeight ??
              0) >
            (document.querySelector(".ah-conversation-stream")?.clientHeight ??
              0),
          speakerSize: style(".ah-message header strong").fontSize,
          copyIcon: Boolean(
            document.querySelector(".ah-message header .ah-button svg"),
          ),
          toolBorder: style(".ah-tool-group").borderTopWidth,
          detailsVisible: Boolean(
            document.querySelector(
              ".ah-agent-header .ah-details-toggle[aria-expanded] svg",
            ),
          ),
          mainScrolls:
            (document.querySelector("main")?.scrollHeight ?? 0) >
            (document.querySelector("main")?.clientHeight ?? 0),
          streamBlockPadding: stream.paddingTop,
          composerBlockPadding: style(".ah-composer").paddingTop,
          composerBottom:
            document.querySelector(".ah-composer")?.getBoundingClientRect()
              .bottom ?? 9999,
          composerActionsBottom:
            document
              .querySelector(".ah-composer .ah-actions")
              ?.getBoundingClientRect().bottom ?? 9999,
          composerPresent: Boolean(document.querySelector(".ah-composer")),
          streamBottom:
            document
              .querySelector(".ah-conversation-stream")
              ?.getBoundingClientRect().bottom ?? 9999,
          composerScrolls:
            (document.querySelector(".ah-composer")?.scrollHeight ?? 0) >
            (document.querySelector(".ah-composer")?.clientHeight ?? 0),
        };
      });
      if (width === 1440) {
        expect(values.railWidth).toBe(296);
        expect(values.renderedColumnWidth).toBe(780);
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
        await expect(page.locator(".ah-composer")).toHaveCount(0);
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
  const focusTarget = page.locator(".ah-conversation-frame .ah-button").first();
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
  await expect(page.locator(".ah-rail")).toHaveCSS("width", "52px");
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "Avaa navigaatio" });
  await trigger.click();
  await expect(
    page
      .getByRole("navigation", { name: "Työtilat ja keskustelut" })
      .getByRole("link", { name: /aurinkokello/ })
      .first(),
  ).toBeVisible();
  await expect(page.locator(".ah-rail")).not.toHaveClass(/ah-rail-collapsed/);
  await expect(page.locator(".ah-rail")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("main")).not.toHaveAttribute("inert");
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
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await expect(
    page.getByRole("heading", { name: "aurinkokello", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(844);
});
