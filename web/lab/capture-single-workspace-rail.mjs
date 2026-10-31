#!/usr/bin/env node
// Run from the repository root with a freshly started lab (scripts/lab.sh
// start): node web/lab/capture-single-workspace-rail.mjs
// Evidence for single-workspace-normal-rail: the rail with one workspace on
// desktop and phone, light and dark, Finnish and English, at device scale
// factor 2, and the two-workspace rail for comparison. It removes every lab
// workspace but aurinkokello and one more, so restart the lab afterwards.
// Synthetic lab only.
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/single-workspace-normal-rail/evidence/",
  import.meta.url,
).pathname;

async function shoot(names, label, languages, phones = true) {
  for (const [language, locale] of languages) {
    const { browser, page } = await openLab({
      locale,
      deviceScaleFactor: 2,
    });
    try {
      const kept = await page.request.get(
        `${origin}/fixture/keep-workspaces?names=${names}`,
      );
      if (kept.status() !== 204) throw new Error("keep-workspaces refused");
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => {
          localStorage.setItem("nah:theme", value);
        }, theme);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${origin}/workspaces`);
        await page.getByTestId("workspace-navigation").waitFor();
        await page.waitForTimeout(800);
        await snapshot(page, `${out}${label}-desktop-${theme}-${language}`, {
          html: false,
        });
        if (!phones) continue;
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${origin}/workspaces`);
        await page
          .locator(".ah-mobile-toolbar")
          .getByTestId("navigation-open")
          .click();
        await page.waitForTimeout(800);
        await snapshot(page, `${out}${label}-phone-${theme}-${language}`, {
          html: false,
        });
      }
    } finally {
      await browser.close();
    }
  }
}

await shoot("aurinkokello,kotisivu", "two", [["fi", "fi-FI"]], false);
await shoot("aurinkokello", "one", [
  ["fi", "fi-FI"],
  ["en", "en-GB"],
]);
