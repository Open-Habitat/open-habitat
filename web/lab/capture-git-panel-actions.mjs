// Synthetic lab evidence for git-panel-actions. Run before and after building.
import { execFileSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import { openLab, snapshot } from "./session.mjs";

const phase = process.argv[2];
if (!["before", "after"].includes(phase)) throw Error("Use before or after");
const { browser, page } = await openLab();
try {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await page.getByRole("button", { name: /^status-rivit ·/ }).click();
      const dialog = page.getByRole("dialog", { name: "Git · aurinkokello" });
      await dialog.locator(".ah-gs-file").first().waitFor();
      if (phase === "after") {
        await dialog.getByRole("button", { name: "Päivitä tila" }).click();
        await dialog
          .getByRole("status")
          .filter({ hasText: "Etätiedot haettu." })
          .waitFor();
      }
      const out = `issues/git-panel-actions/evidence/${phase}-${width === 1440 ? "desktop" : "phone"}-${theme}`;
      await snapshot(page, out);
      execFileSync("avifenc", [
        "--lossless",
        "-s",
        "8",
        "-j",
        "2",
        `${out}.png`,
        `${out}.avif`,
      ]);
      await unlink(`${out}.png`);
      await page.keyboard.press("Escape");
    }
  }
} finally {
  await browser.close();
}
