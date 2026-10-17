import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const { browser, page } = await openLab();
try {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  const pill = page.getByRole("button", {
    name: "main · 2 muutosta ↑1",
    exact: true,
  });
  await expect(pill).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Aloita uusi Pi-keskustelu",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(page.locator(".ah-home-recap").first()).toBeVisible();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await snapshot(
        page,
        `issues/implement-workspace-page/page-${width}-${theme}`,
      );
      await pill.click();
      const git = page.getByRole("dialog", {
        name: "Git · aurinkokello",
        exact: true,
      });
      await expect(git).toContainText("Erota statusrivien jäsennin");
      await snapshot(
        page,
        `issues/implement-workspace-page/git-${width}-${theme}`,
      );
      await page.keyboard.press("Escape");
      const menu = page.locator("main").getByRole("button", {
        name: "Työtilan aurinkokello toiminnot",
        exact: true,
      });
      await menu.click();
      await snapshot(
        page,
        `issues/implement-workspace-page/menu-${width}-${theme}`,
      );
      await page.keyboard.press("Escape");
    }
  await page.goto(`${origin}/workspaces`);
  await expect(
    page.locator(".ah-home-card:has(.ah-home-stale)").first(),
  ).toBeVisible();
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await snapshot(
        page,
        `issues/implement-workspace-page/home-archive-${width}-${theme}`,
        { region: ".ah-home-card:has(.ah-home-stale)" },
      );
    }
} finally {
  await browser.close();
}
