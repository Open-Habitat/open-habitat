import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const evidence = "test-results/evidence";
for (const theme of ["light", "dark"] as const) {
  test(`@visual design catalog happy state in ${theme}`, async ({ page }) => {
    await page.goto("/?fixture=design");
    await page
      .locator("html")
      .evaluate(
        (element, value) => element.setAttribute("data-theme", value),
        theme,
      );
    await expect(
      page.getByRole("heading", {
        name: "Rakenna saavutettava komponenttikirjasto",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Työskentelee", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Lähetä", exact: true }).last(),
    ).toBeEnabled();
    await page.screenshot({
      path: `${evidence}/design-happy-${theme}.png`,
      fullPage: true,
    });
  });
}
test("@visual unhappy states remain explicit", async ({ page }) => {
  await page.goto("/?fixture=design-unhappy");
  await expect(page.getByText("Näytettävä tieto on vanhentunut")).toBeVisible();
  await expect(page.getByText("Tulos epävarma")).toBeVisible();
  await expect(page.getByText("Osittainen")).toBeVisible();
  await expect(page.getByText("Capabilityä ei ole vahvistettu.")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveAttribute("readonly");
  await page.screenshot({
    path: `${evidence}/design-unhappy-light.png`,
    fullPage: true,
  });
});
test("@visual keyboard focus follows visible controls", async ({ page }) => {
  await page.goto("/?fixture=design");
  await expect(
    page.getByRole("heading", {
      name: "Rakenna saavutettava komponenttikirjasto",
    }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Siirry sisältöön" }).last(),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});
test("@visual 200 percent zoom has no page-level horizontal overflow", async ({
  page,
}) => {
  // 1280 physical pixels at 200% browser zoom yields a 640 CSS-pixel viewport.
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/?fixture=design-unhappy");
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
});
test("@visual reduced motion removes running animation without hiding status", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=design");
  const mark = page.getByText("Työskentelee", { exact: true }).first();
  await expect(mark).toBeVisible();
  await expect(mark.locator(".ah-status-dot")).toHaveCSS(
    "animation-name",
    "none",
  );
});
test("@a11y design catalog themes and unhappy state have no axe violations", async ({
  page,
}) => {
  for (const fixture of ["design", "design-unhappy"]) {
    for (const theme of ["light", "dark"]) {
      await page.goto(`/?fixture=${fixture}`);
      await page
        .locator("html")
        .evaluate(
          (element, value) => element.setAttribute("data-theme", value),
          theme,
        );
      await expect(page.locator("main#main")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `${fixture}-${theme}`).toEqual([]);
    }
  }
});
