// Synthetic lab only: the sidebar's working-spinoff mark with no live wait
// (sidebar-spinoff-mark-without-wait). The lab's fake Taskfleet reports one
// working spinoff of a seeded conversation; no personal browser or live data.
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = "issues/sidebar-spinoff-mark-without-wait";
const parent = "a1a1a1a1-0000-4000-8000-000000000001";
const { browser, page } = await openLab();
const fixture = async (status) =>
  expect(
    (
      await page.request.get(
        `${origin}/fixture/taskfleet?parent=${parent}&workspace=aurinkokello&status=${status}`,
      )
    ).status(),
  ).toBe(204);
try {
  await fixture("running");
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  const row = page.locator("li.ah-waiting-spinoff");
  await expect(row).toHaveCount(1);
  for (const [width, theme] of [
    [1440, "light"],
    [1440, "dark"],
    [390, "light"],
    [390, "dark"],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    if (width === 390) {
      const menu = page.getByRole("button", { name: "Avaa navigaatio" });
      if (await menu.count()) await menu.first().click();
    }
    await expect(row).toBeVisible();
    await snapshot(
      page,
      `${out}/sidebar-${width === 390 ? "phone" : "desktop"}-${theme}`,
    );
    if (width === 390) await page.keyboard.press("Escape");
  }
} finally {
  await fixture("none").catch(() => {});
  await browser.close();
}
