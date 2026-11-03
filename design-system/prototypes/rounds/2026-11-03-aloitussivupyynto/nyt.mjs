// Run from the repository root with the synthetic lab up (scripts/lab.sh start):
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-11-03-aloitussivupyynto/nyt.mjs <out-dir>
// Captures today's flow in the lab's muistiinpanot (no start page) at 1440
// and 390 px, scale 2: the workspace page with Luo aloitussivu, the new
// conversation that pressing opens, the history after sending, and the
// empty new conversation's own hint.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { openLab } from "../../../../web/lab/session.mjs";

const out = resolve(process.argv[2] ?? ".cache/lab/shots");
mkdirSync(out, { recursive: true });
for (const width of [1440, 390]) {
  const { browser, page } = await openLab({ width, height: width === 390 ? 844 : 900, deviceScaleFactor: 2 });
  const shot = async (name) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/nyt-${name}-${width}.png` });
  };
  try {
    const nav = async () => {
      await page.getByRole("navigation").or(page.getByTestId("navigation-open")).first().waitFor();
      if (width === 390) await page.getByTestId("navigation-open").click();
    };
    await nav();
    await page.getByRole("navigation").getByTestId("workspace-start-muistiinpanot").click();
    await page.getByTestId("start-page-hint").waitFor();
    await shot("tyhja");
    await nav();
    await page.getByRole("navigation").getByRole("link", { name: "muistiinpanot", exact: true }).first().click();
    await page.getByTestId("landing-create").waitFor();
    await shot("sivu");
    await page.getByTestId("landing-create").click();
    await page.locator(".ah-composer textarea").waitFor();
    await shot("kentassa");
    await page.locator(".ah-composer textarea").press("Enter");
    // The lab's fake Pi answers the bare command as an ordinary message.
    await page.getByText("Vastaus valmis").first().waitFor({ timeout: 15000 });
    await shot("lahetetty");
  } finally {
    await browser.close();
  }
}
console.log(out);
