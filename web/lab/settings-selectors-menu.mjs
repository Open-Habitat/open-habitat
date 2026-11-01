import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

for (const language of ["fi", "en-US"]) {
  for (const width of [1440, 390]) {
    for (const theme of ["light", "dark"]) {
      const { browser, page } = await openLab({
        width,
        height: 1000,
        deviceScaleFactor: 2,
        locale: language,
      });
      try {
        await page.goto(`${origin}/settings/appearance`);
        await page.getByTestId("language-choice").click();
        await page.getByTestId(`choice-${language}`).click();
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await page.getByTestId(`segment-${theme}`).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const base = `issues/settings-selectors-menu/shots/${language}-${width}-${theme}`;
        await snapshot(page, `${base}-appearance`, { region: ".s-main" });
        await page.getByTestId("language-choice").click();
        await expect(page.getByRole("menu")).toBeVisible();
        await snapshot(page, `${base}-menu`);
        await page.keyboard.press("Escape");
        await page.setViewportSize({ width, height: 3000 });
        await page.goto(`${origin}/settings/recap`);
        await page.getByTestId("recap-level").click();
        await page.getByTestId("choice-custom").click();
        await expect(page.getByTestId("recap-words-input")).toBeVisible();
        await snapshot(page, `${base}-recap`, { region: ".ah-recap-levels" });
      } finally {
        await browser.close();
      }
    }
  }
}
