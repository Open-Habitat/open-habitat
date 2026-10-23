import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@a11y activity line on a native held turn in light and dark", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=pi-visual-hold");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-start-aurinkokello")
    .click();
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("message-input").fill("Tarkista tiedostot.");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect
    .poll(async () =>
      (await page.request.get("/fixture/pi-visual-ready")).status(),
    )
    .toBe(204);
  await expect(page.getByTestId("turn-progress")).toBeVisible();
  const { snapshot } = await import("../lab/session.mjs");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      await expect(page.getByTestId("turn-progress")).toBeInViewport();
      await snapshot(page, testInfo.outputPath(`activity-${width}-${theme}`), {
        labOrigin: new URL(page.url()).origin,
      });
      expect(
        (await new AxeBuilder({ page }).include(".ah-agent-turn").analyze())
          .violations,
      ).toEqual([]);
    }
  }
  await page.request.get("/fixture/scenario?value=ready");
});
