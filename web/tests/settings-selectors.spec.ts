import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(false, {
  BROWSER_HOST_LAB: process.env.OH_VISUAL_CAPTURE === "1" ? "1" : "0",
});

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

for (const locale of ["fi-FI", "en-US"]) {
  test(`settings selectors fit and remain keyboard accessible in ${locale}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: hostOrigin,
      ignoreHTTPSErrors: true,
      locale,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    try {
      const page = await context.newPage();
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.getByRole("link").nth(0).click();
      await page.goto("/settings/appearance");
      const trigger = page.getByTestId("language-choice");
      for (const width of [1440, 1040, 800, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(trigger).toBeEnabled();
        await page.evaluate(() => document.fonts.ready);
        const layout = await page
          .locator('[data-settings-row="theme"]')
          .evaluate((row) => {
            const buttons = [...row.querySelectorAll("button")].map((b) =>
              b.getBoundingClientRect(),
            );
            const card = row.parentElement?.getBoundingClientRect();
            if (!card) throw new Error("Missing settings card");
            return {
              tops: buttons.map((b) => b.top),
              fits: buttons.every(
                (b) => b.left >= card.left && b.right <= card.right,
              ),
            };
          });
        expect(new Set(layout.tops).size).toBe(1);
        expect(layout.fits, `theme at ${width}`).toBe(true);
        const theme = page.getByTestId("theme-choice");
        await theme.click();
        await expect(page.getByRole("menuitemradio")).toHaveCount(4);
        await page.getByTestId("choice-contrast").click();
        await expect(theme).toHaveAttribute("data-value", "contrast");
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme",
          "contrast",
        );
        await theme.click();
        await page.getByTestId("choice-system").click();
        await expect(theme).toHaveAttribute("data-value", "system");
        const before = await trigger.getAttribute("data-value");
        await trigger.click();
        await expect(page.getByRole("menuitemradio")).toHaveCount(4);
        const selected = page.getByRole("menuitemradio", { checked: true });
        await expect(selected).toHaveCount(1);
        await expect(selected).toHaveAttribute(
          "data-testid",
          `choice-${before}`,
        );
        const mark = selected.locator('[aria-hidden="true"]');
        await expect(mark).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
        await expect(mark).toHaveCSS("border-top-width", "0px");
        await expect(selected).not.toHaveCSS(
          "background-color",
          "rgba(0, 0, 0, 0)",
        );
        if (
          process.env.OH_VISUAL_CAPTURE === "1" &&
          [1440, 390].includes(width)
        )
          await snapshot(
            page,
            `../issues/gate-red-settings-and-explain-1411/evidence/language-${locale}-${width}`,
            { labOrigin: hostOrigin },
          );
        // Opening a bottom sheet must not accidentally choose the item
        // now covering the mouse pointer that opened it.
        await expect(trigger).toHaveAttribute("data-value", before ?? "system");
        expect(
          (
            await new AxeBuilder({ page })
              .include(".ah-choice-popover")
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
      }
      await trigger.press("ArrowDown");
      await expect(page.getByRole("menu")).toBeVisible();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await expect(trigger).toHaveAttribute("data-value", "en-GB");
      await expect(trigger).toBeFocused();
      await expect(page.getByRole("menu")).toHaveCount(0);
      await trigger.tap();
      await expect(page.getByTestId("choice-en-GB")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await page.keyboard.press("Escape");
    } finally {
      await context.close();
    }
  });
}
