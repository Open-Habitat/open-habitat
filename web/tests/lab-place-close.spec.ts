import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test.describe(`place close ${width} ${language}`, () => {
      test.use({
        ignoreHTTPSErrors: true,
        viewport: { width, height: 900 },
        hasTouch: width === 390,
        reducedMotion: "reduce",
      });
      test("explains the close control and allows safe return navigation", async ({
        page,
      }) => {
        await page.goto("/workspaces");
        await page.getByTestId("github-sign-in").click();
        await page
          .getByRole("link")
          .and(page.locator('a[href*="code=42"]'))
          .click();
        const session = await (await page.request.get("/auth/session")).json();
        for (const data of [
          { experimental: { "explain-mode": true } },
          { language },
        ]) {
          expect(
            (
              await page.request.put("/api/v1/account/preferences", {
                headers: {
                  Origin: new URL(page.url()).origin,
                  "X-Agent-Host-CSRF": session.csrf,
                },
                data,
              })
            ).ok(),
          ).toBe(true);
        }
        for (const place of ["shares", "resources"]) {
          await page.goto(`/${place}`);
          if (width === 390) await page.getByTestId("navigation-open").click();
          await page.getByTestId("account-menu-trigger").click();
          await page.getByTestId("menu-explain").click();
          await expect(page.getByTestId("explain-bar")).toBeVisible();
          if (width === 390)
            await page
              .getByTestId("close-navigation")
              .filter({ visible: true })
              .click();
          const close = page.getByTestId("place-close");
          if (width === 390) await close.tap();
          else await close.hover();
          await expect(page.getByTestId("explain-card")).toHaveAttribute(
            "data-card",
            "J10",
          );
          if (process.env.OH_VISUAL_CAPTURE === "1") {
            await snapshot(
              page,
              `/var/tmp/agent-keep/place-view-close-button/${place}-${width}-${language}`,
              {
                labOrigin: new URL(page.url()).origin,
              },
            );
          }
          if (width === 390) await close.tap();
          else await close.click();
          await expect(page).toHaveURL(/\/workspaces$/);
        }
      });
    });
  }
}
