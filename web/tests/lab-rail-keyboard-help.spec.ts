import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});
for (const width of [1440, 390]) {
  for (const locale of ["fi-FI", "en-US"]) {
    test.describe(`rail keyboard help ${width} ${locale}`, () => {
      test.use({
        viewport: { width, height: 900 },
        locale,
        hasTouch: width === 390,
        isMobile: width === 390,
      });
      test("@rail-keyboard-help desktop explains the keys; touch omits the keyboard hint", async ({
        page,
      }) => {
        await page.goto("/workspaces");
        await page.getByTestId("github-sign-in").click();
        await page
          .getByRole("link")
          .and(page.locator('a[href*="code=42"]'))
          .click();
        const session = await (await page.request.get("/auth/session")).json();
        expect(
          (
            await page.request.put("/api/v1/account/preferences", {
              headers: {
                Origin: new URL(page.url()).origin,
                "X-Agent-Host-CSRF": session.csrf,
              },
              data: { experimental: { "explain-mode": true } },
            })
          ).ok(),
        ).toBe(true);
        await page.reload();
        if (width === 390) await page.getByTestId("navigation-open").click();
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        await expect(page.getByTestId("explain-bar")).toBeVisible();
        const section = page.getByTestId("rail-yours").getByRole("heading");
        const card = page.getByTestId("explain-card");
        await expect(async () => {
          const box = await section.boundingBox();
          if (!box) throw new Error("Missing rail heading");
          if (width === 390)
            await page.touchscreen.tap(box.x + 20, box.y + box.height / 2);
          else {
            await page.mouse.move(1000, 800);
            await page.mouse.move(box.x + 20, box.y + box.height / 2);
          }
          await expect(card).toHaveAttribute("data-card", "S05");
        }).toPass();
        await expect(card.locator(".ah-explain-know")).toHaveCount(
          width === 390 ? 1 : 2,
        );
        if (process.env.OH_VISUAL_CAPTURE === "1")
          await snapshot(
            page,
            resolve(
              `../issues/rail-keyboard-direct/evidence/help-${width}-${locale}`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
      });
    });
  }
}
