import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const { browser, page } = await openLab({ deviceScaleFactor: 2 });
try {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(`${origin}/settings/account`);
  await expect(page.getByTestId("settings-section-tili")).toBeVisible();
  for (const collapsed of [false, true]) {
    if (collapsed) await page.getByTestId("close-navigation").click();
    for (const width of [1040, 1060, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await snapshot(
        page,
        `issues/settings-breakpoint-1050/evidence/${width}-${collapsed ? "closed" : "open"}`,
      );
    }
  }
} finally {
  await browser.close();
}
