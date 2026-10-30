// Walks every direction in light and dark on desktop and phone, clicks each
// direction's choose → write → commit flow on the three synthetic repos, fails
// on a console error, and writes PNGs at DSF 2 into the given directory:
//   PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright \
//   NODE_PATH=<checkout>/web/node_modules node check.mjs <outdir>
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(join(process.env.NODE_PATH ?? ".", "x.js"));
const { chromium } = require("playwright");
const out = process.argv[2];
if (!out) throw new Error("usage: node check.mjs <outdir>");
const file = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "kuvakkeen-asetus.html"),
).href;
const browser = await chromium.launch();
const errors = [];
let shots = 0;
async function open(v, view, theme, ws) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const tag = `${v}/${view}/${theme}/${ws}`;
  page.on("console", (m) => m.type() === "error" && errors.push(`${tag}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
  await page.goto(`${file}?v=${v}&view=${view}&theme=${theme}&ws=${ws}`);
  await page.waitForTimeout(250);
  return { ctx, page };
}
async function shot(page, name, view) {
  const path = join(out, `${name}.png`);
  if (view === "phone") await page.locator(".frame-phone").screenshot({ path });
  else await page.screenshot({ path });
  shots++;
}
const settle = (page) => page.waitForTimeout(200);
async function must(page, sel) {
  if ((await page.locator(sel).count()) === 0) throw new Error(`missing ${sel}`);
}

for (const theme of ["light", "dark"]) {
  for (const view of ["desktop", "phone"]) {
    const t = `${view === "phone" ? "puhelin" : "tyopoyta"}-${theme}`;
    // 1. Otsikko
    let { ctx, page } = await open(1, view, theme, "open-habitat");
    await shot(page, `otsikko-${t}-logo`, view);
    await page.click(".head-icon");
    await settle(page);
    await shot(page, `otsikko-${t}-valitsin`, view);
    await page.click('.pop .egrid [data-v="🦔"]');
    await settle(page);
    await must(page, '.notice [data-act="commit"]');
    await shot(page, `otsikko-${t}-commitoimatta`, view);
    await page.click('[data-act="commit"]');
    await settle(page);
    await must(page, ".notice.ok");
    await shot(page, `otsikko-${t}-commitoitu`, view);
    await page.click(".gs-chip");
    await settle(page);
    await must(page, ".gitdlg");
    if (theme === "light") await shot(page, `otsikko-${t}-git`, view);
    await ctx.close();

    // 2. Ulkoasu
    ({ ctx, page } = await open(2, view, theme, "open-habitat"));
    await page.locator('section[aria-label="Ulkoasu"]').scrollIntoViewIfNeeded();
    await shot(page, `ulkoasu-${t}-logo`, view);
    await page.click('[data-act="look-edit"]');
    await page.click('[data-act="tab"][data-v="emoji"]');
    await page.click('.look-edit .egrid [data-v="🦔"]');
    await settle(page);
    await page.locator(".look-edit .diff").scrollIntoViewIfNeeded();
    await shot(page, `ulkoasu-${t}-muokkaus`, view);
    await page.click('[data-act="look-save"]');
    await settle(page);
    await must(page, ".badge.dirty");
    await page.locator(".look").scrollIntoViewIfNeeded();
    await shot(page, `ulkoasu-${t}-tallennettu`, view);
    await ctx.close();
    ({ ctx, page } = await open(2, view, theme, "fleetrepo"));
    await page.locator(".look").scrollIntoViewIfNeeded();
    await shot(page, `ulkoasu-${t}-asetettu`, view);
    await ctx.close();

    // 3. Ehdotus
    ({ ctx, page } = await open(3, view, theme, "tailspin-monorepo"));
    await must(page, ".suggest");
    await shot(page, `ehdotus-${t}-ei-mitaan`, view);
    await page.click('.suggest [data-act="sug-pick"] >> nth=1');
    await settle(page);
    await must(page, ".notice.ok");
    await shot(page, `ehdotus-${t}-commitoitu`, view);
    await ctx.close();
    ({ ctx, page } = await open(3, view, theme, "fleetrepo"));
    if ((await page.locator(".suggest").count()) !== 0) throw new Error("suggestion on a set repo");
    await page.click(".head-icon");
    await settle(page);
    await page.click('.dlg .egrid [data-v="🦉"]');
    await settle(page);
    await shot(page, `ehdotus-${t}-dialogi`, view);
    await page.click('[data-act="dlg-save"]');
    await settle(page);
    await must(page, ".notice.ok");
    await ctx.close();
    ({ ctx, page } = await open(3, view, theme, "muistiinpanot"));
    if ((await page.locator('[data-in="sug-commit"]').count()) !== 0) throw new Error("commit offered without Git");
    if (theme === "light") await shot(page, `ehdotus-${t}-ei-gitia`, view);
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify({ ok: errors.length === 0, errors, shots }, null, 1));
process.exit(errors.length ? 1 : 0);
