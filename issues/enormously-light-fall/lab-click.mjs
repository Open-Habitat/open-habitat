// Synthetic lab only: hides and restores a workspace with real clicks so the
// gateway and daemon http_request records of each click can be joined.
// Usage (repository root, lab running via scripts/lab.sh start):
//   PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright \
//     node issues/enormously-light-fall/lab-click.mjs
// then read .cache/lab/host.log for the http_request lines.
import { openLab, origin } from "../../web/lab/session.mjs";

const { browser, page } = await openLab();
const href = await page
  .locator('nav[aria-label="Työtilat ja keskustelut"] a', {
    hasText: "muistiinpanot",
  })
  .first()
  .getAttribute("href");
await page.goto(`${origin}${href}`);
const hide = page.getByRole("button", { name: "Piilota sivupalkista" });
await hide.waitFor();
console.log(JSON.stringify({ click: "hide", at: new Date().toISOString() }));
await hide.click();
const undo = page.getByRole("button", { name: "Kumoa" });
await undo.waitFor();
console.log(JSON.stringify({ click: "undo", at: new Date().toISOString() }));
await undo.click();
await page.getByRole("button", { name: "Piilota sivupalkista" }).waitFor();
await browser.close();
