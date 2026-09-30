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
      await page.setViewportSize({ width, height: 900 });
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
          sidePadding: header.paddingLeft,
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
        };
      });
      if (width === 1440) expect(values.railWidth).toBe(296);
      expect(values.topPadding).toBe("13px");
      expect(values.sidePadding).toBe("24px");
      expect(values.columnWidth).toBe("780px");
      expect(values.streamPadding).toBe("24px");
      expect(values.titleSize).toBe("15.5px");
      expect(values.bodySize).toBe(width === 390 ? "15px" : "14.5px");
      expect(values.buttonRadius).toBe("8px");
      expect(values.focusWidth).toBe("2px");
      expect(values.focusOffset).toBe("2px");
      expect(values.frameWidth).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Sulje navigaatio" }).click();
  await expect(page.locator(".ah-rail")).toHaveCSS("width", "52px");
});
