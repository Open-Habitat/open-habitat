import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});

for (const width of [1280, 1024, 390]) {
  test(`@own-machines login layout ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/settings/machines");
    await page.getByTestId("github-sign-in").click();
    await page.locator('a[href*="code=42"]').click();
    await page.goto("/settings/machines");
    await page.getByTestId("own-machines-add").click();
    await page.getByTestId("own-machines-connect").click();
    const dialog = page.getByTestId("own-machines-wizard");
    await expect(page.getByTestId("own-machines-login-open")).toBeVisible();
    await expect(page.getByTestId("device-qr")).toHaveCount(
      width > 640 ? 1 : 0,
    );

    async function checkLayout() {
      const violations = await dialog.evaluate((el) => {
        const rect = (selector: string) => {
          const element = el.querySelector(selector);
          if (!element) throw new Error(`Missing layout element: ${selector}`);
          return element.getBoundingClientRect();
        };
        const overlaps = (a: DOMRect, b: DOMRect) =>
          a.left < b.right &&
          b.left < a.right &&
          a.top < b.bottom &&
          b.top < a.bottom;
        const qr = el
          .querySelector('[data-testid="device-qr"]')
          ?.getBoundingClientRect();
        const side = rect(".om-login-side");
        const footer = rect(".ah-dialog-actions");
        const body = rect(".om-wz-body");
        const actions = Array.from(
          el.querySelectorAll(".ah-dialog-actions button"),
          (b) => b.getBoundingClientRect(),
        );
        return {
          overflow:
            el.scrollWidth > el.clientWidth ||
            document.documentElement.scrollWidth > innerWidth,
          qrOverlap: qr ? overlaps(qr, side) || overlaps(qr, footer) : false,
          footerGap: footer.top > body.bottom,
          buttonsOverlap: actions.some((a, i) =>
            actions.slice(i + 1).some((b) => overlaps(a, b)),
          ),
          sideOverlap: overlaps(
            rect(".om-login-side > p"),
            rect(".om-login-side .om-btns"),
          ),
        };
      });
      expect(violations).toEqual({
        overflow: false,
        qrOverlap: false,
        footerGap: true,
        buttonsOverlap: false,
        sideOverlap: false,
      });
    }
    await checkLayout();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="own-machines-wizard"]')
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    if (process.env.OH_TAILSCALE_CAPTURE)
      await snapshot(
        page,
        `${process.env.OH_TAILSCALE_CAPTURE}/login-${width}`,
        { labOrigin: new URL(page.url()).origin },
      );

    if (width === 1024) {
      // A window can narrow after mount while the QR is still displayed.
      await page.setViewportSize({ width: 390, height: 900 });
      await checkLayout();
      if (process.env.OH_TAILSCALE_CAPTURE)
        await snapshot(
          page,
          `${process.env.OH_TAILSCALE_CAPTURE}/login-resized-390`,
          { labOrigin: new URL(page.url()).origin },
        );
    }
  });
}
