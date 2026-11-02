// Run from the repository root with the synthetic lab up (scripts/lab.sh start):
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-11-02-aloitussivun-painike/nyt.mjs <out-dir>
// Captures today's empty new conversation in a workspace without a start page
// (the lab's muistiinpanot) at 1440 and 390 px, scale 2, as the round's "Nyt".
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { openLab } from "../../../../web/lab/session.mjs";

const out = resolve(process.argv[2] ?? ".cache/lab/shots");
mkdirSync(out, { recursive: true });
for (const width of [1440, 390]) {
  const { browser, page } = await openLab({ width, height: width === 390 ? 844 : 900, deviceScaleFactor: 2 });
  try {
    await page.getByRole("navigation").or(page.getByTestId("navigation-open")).first().waitFor();
    if (width === 390) await page.getByTestId("navigation-open").click();
    await page.getByRole("navigation").getByTestId("workspace-start-muistiinpanot").click();
    await page.getByTestId("start-page-hint").waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/nyt-${width}.png` });
  } finally {
    await browser.close();
  }
}
console.log(out);
