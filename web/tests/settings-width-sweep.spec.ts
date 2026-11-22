import paths from "../../internal/uiroutes/settings.json" with { type: "json" };
import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(false, {
  BROWSER_HOST_LAB: process.env.OH_VISUAL_CAPTURE === "1" ? "1" : "0",
});
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
});

// Include both sides of every shell/row boundary, with a dense sweep through
// the old jump. Geometry, rather than a CSS value, catches flex wrapping too.
const widths = [
  ...new Set([
    ...Array.from({ length: 61 }, (_, i) => 1600 - i * 20),
    ...Array.from({ length: 31 }, (_, i) => 1065 - i),
    1401,
    1101,
    801,
    799,
    761,
    759,
    521,
    519,
    401,
    390,
  ]),
].sort((a, b) => b - a);

for (const [section, path] of Object.entries(paths)) {
  test(`${section}: narrowing settings never moves a value back beside its label`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await page.goto(`/settings/${path}`);
    await expect(page.getByTestId(`settings-section-${section}`)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const stacked = new Set<number>();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      const rows = await page.locator(".s-main .s-row").evaluateAll((rows) =>
        rows
          .map((row, index) => {
            const label = row.querySelector(":scope > .s-lbl");
            const value = row.querySelector(
              ":scope > .s-val, :scope > [data-ah-primitive='segmented'], :scope > .ah-choice-trigger, :scope > .ah-stepper",
            );
            if (!label || !value) return null;
            const l = label.getBoundingClientRect();
            const v = value.getBoundingClientRect();
            if (!l.width || !v.width) return null;
            return { index, stacked: v.top >= l.bottom - 1 };
          })
          .filter((row) => row !== null),
      );
      for (const row of rows) {
        expect(
          !stacked.has(row.index) || row.stacked,
          `${section} row ${row.index} widened at ${width}`,
        ).toBe(true);
        if (row.stacked) stacked.add(row.index);
      }
      expect(
        await page
          .locator(".s-main")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `${section} overflow at ${width}`,
      ).toBe(true);
      if (
        process.env.OH_VISUAL_CAPTURE === "1" &&
        section === "tili" &&
        [1060, 1050, 1040].includes(width)
      ) {
        for (const theme of ["light", "dark"]) {
          await page.evaluate(
            (theme) =>
              document.documentElement.setAttribute("data-theme", theme),
            theme,
          );
          await snapshot(
            page,
            `../issues/settings-breakpoint-jump/evidence/fixed-${width}-${theme}`,
            { labOrigin: hostOrigin },
          );
        }
      }
    }
  });
}
