// Walks every direction in light and dark, desktop, strip and phone, clicks
// the change flow and the name affordances, fails on a console error, and
// writes PNGs at DSF 2 into the directory given as the first argument:
//   PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright \
//   NODE_PATH=<checkout>/web/node_modules node check.mjs <outdir>
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(join(process.env.NODE_PATH ?? ".", "x.js"));
const { chromium } = require("playwright");
const out = process.argv[2];
if (!out) throw new Error("usage: node check.mjs <outdir>");
const page$ = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "tyotilan-kuvake.html"),
).href;
const names = ["hymio", "monogrammi", "lahdeketju"];
const browser = await chromium.launch();
const errors = [];
const shots = [];
async function open(v, view, theme) {
  const ctx = await browser.newContext({
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`${v}/${view}/${theme}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${v}/${view}/${theme}: ${e.message}`));
  await page.goto(`${page$}?v=${v}&view=${view}&theme=${theme}`);
  await page.waitForTimeout(250);
  return { ctx, page };
}
async function shot(page, name, el) {
  const path = join(out, `${name}.png`);
  if (el) await page.locator(el).screenshot({ path });
  else await page.screenshot({ path });
  shots.push(path);
}
for (let v = 1; v <= 3; v++) {
  const n = names[v - 1];
  for (const theme of ["light", "dark"]) {
    let { ctx, page } = await open(v, "desktop", theme);
    // Open the quiet fold and the dormant workspaces so every row shape shows.
    await page.click('[data-k="q:open-habitat"]');
    await page.click('[data-k="d:northwind-monorepo"]');
    // The name affordance on the open-habitat row.
    const row = '.row:has([data-id="a3"])';
    if (v === 1) await page.hover(`${row} .wi`);
    if (v === 2) await page.hover(`${row} .lead`);
    if (v === 3) await page.click(`${row} .icbtn`);
    await page.waitForTimeout(250);
    await shot(page, `${n}-tyopoyta-${theme}`);
    if (v === 3) await page.click(".pop [data-act=dialog]");
    else {
      await page.click('.ws-row [data-ws="tailspin-monorepo"]');
      await page.waitForTimeout(100);
      await page.click(".ws-bigicon");
    }
    await page.waitForTimeout(250);
    if (v === 1) await page.click('.egrid [data-v="🧾"], .egrid button:nth-child(5)');
    if (v === 2) await page.click('[data-act=hue][data-v="5"]');
    if (v === 3) await page.click('[data-act=choice][data-v="logo"], [data-act=choice][data-v="mono"]');
    await page.waitForTimeout(150);
    await shot(page, `${n}-vaihto-${theme}`);
    await page.click("[data-act=save]");
    await page.waitForTimeout(150);
    await shot(page, `${n}-tallennettu-${theme}`);
    await ctx.close();

    ({ ctx, page } = await open(v, "strip", theme));
    await page.hover('.dot[data-id="a10"]');
    await page.waitForTimeout(200);
    await shot(page, `${n}-kaistale-${theme}`);
    await ctx.close();

    ({ ctx, page } = await open(v, "phone", theme));
    await shot(page, `${n}-puhelin-${theme}`, ".frame-phone");
    if (v === 2) {
      await page.click('.row:has([data-id="a10"]) .lead');
      await page.waitForTimeout(200);
      await shot(page, `${n}-puhelin-nimi-${theme}`, ".frame-phone");
    }
    if (v === 3) {
      await page.click('.row:has([data-id="a10"]) .icbtn');
      await page.waitForTimeout(250);
      await shot(page, `${n}-puhelin-nimi-${theme}`, ".frame-phone");
    }
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify({ ok: errors.length === 0, errors, shots: shots.length }, null, 1));
process.exit(errors.length ? 1 : 0);
