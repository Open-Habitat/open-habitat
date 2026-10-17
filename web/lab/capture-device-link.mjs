#!/usr/bin/env node
// Synthetic lab only (ui-control-audit): Asetukset › Laitteet with the Näytä
// koodi button, desktop and phone, light and dark.
//   node web/lab/capture-device-link.mjs <before|after>
import { openLab, origin, snapshot } from "./session.mjs";

const label = process.argv[2];
if (!["before", "after"].includes(label))
  throw new Error("usage: capture-device-link.mjs before|after");
const { browser, page } = await openLab();
try {
  for (const [form, width, height] of [
    ["desktop", 1280, 800],
    ["phone", 390, 844],
  ])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/settings`);
      await page.evaluate((t) => localStorage.setItem("nah:theme", t), theme);
      await page.reload();
      await page.getByRole("button", { name: "Laitteet", exact: true }).click();
      await page.getByRole("button", { name: "Näytä koodi" }).waitFor();
      await page.waitForTimeout(300);
      await snapshot(
        page,
        `issues/ui-control-audit/${label}-laitteet-${form}-${theme}`,
      );
    }
} finally {
  await browser.close();
}
