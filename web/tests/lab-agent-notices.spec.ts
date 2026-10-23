import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab @a11y notice can be dismissed by keyboard at desktop and phone sizes", async ({
  page,
}, info) => {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  const card = page.getByTestId("agent-notice");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      expect(
        (
          await page.request.get(
            `/fixture/notice?id=${encodeURIComponent(id)}&text=${encodeURIComponent("Muista tarkistaa testit ennen seuraavaa julkaisua.")}`,
          )
        ).status(),
      ).toBe(204);
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="agent-notice"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await snapshot(page, info.outputPath(`notice-${width}-${theme}`), {
        labOrigin: new URL(page.url()).origin,
      });
      const dismiss = card.getByTestId("agent-notice-dismiss");
      await dismiss.focus();
      await page.keyboard.press("Enter");
      await expect(card).toHaveCount(0);
    }
  }
});
