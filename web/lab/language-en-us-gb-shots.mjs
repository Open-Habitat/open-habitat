// Synthetic lab evidence only. Start/stop the lab in the calling shell.
import { readFile, writeFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL("../../issues/language-en-us-gb/evidence/", import.meta.url)
  .pathname;
for (const [width, name] of [
  [1440, "desktop"],
  [390, "phone"],
]) {
  const { browser, page } = await openLab({
    width,
    deviceScaleFactor: 2,
    locale: "en-GB",
  });
  try {
    for (const [route, group, row] of [
      ["appearance", "language-choice", "language"],
      ["server", "server-language-choice", "server-language"],
    ]) {
      await page.goto(`${origin}/settings/${route}`);
      const control = page.getByTestId(group);
      await expect(control.getByTestId("segment-en-US")).toBeEnabled();
      await control.getByTestId("segment-en-GB").click();
      await expect(control.getByTestId("segment-en-GB")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");
      for (const id of ["system", "fi", "en-US", "en-GB"]) {
        const box = await control.getByTestId(`segment-${id}`).boundingBox();
        if (!box || box.x < 0 || box.x + box.width > width)
          throw new Error(`Offscreen language choice: ${name}/${id}`);
      }
      await snapshot(page, `${out}${name}-${route}`, {
        region: `[data-settings-row="${row}"]`,
      });
      const html = `${out}${name}-${route}.html`;
      await writeFile(
        html,
        (await readFile(html, "utf8")).replace(/[ \t]+$/gm, ""),
      );
    }
  } finally {
    await browser.close();
  }
}
