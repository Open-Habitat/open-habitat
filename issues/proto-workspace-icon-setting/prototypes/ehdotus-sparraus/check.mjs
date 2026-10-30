// Walks the three sparring directions in light and dark on desktop and phone:
// first suggestions, a wish, accepting one (silent commit), no credentials, a
// timeout, a directory without Git and a repo whose icon is already set. Fails
// on a missing state or a console error and writes PNGs at DSF 2:
//   PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright \
//   NODE_PATH=<checkout>/web/node_modules node check.mjs <outdir>
// The simulated model delays run at speed=0.2 here; the page itself uses real ones.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(join(process.env.NODE_PATH ?? ".", "x.js"));
const { chromium } = require("playwright");
const out = process.argv[2];
if (!out) throw new Error("usage: node check.mjs <outdir>");
const file = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "ehdotus-sparraus.html")).href;
const browser = await chromium.launch();
const errors = [];
let shots = 0;
async function open(v, view, theme, ws, model = "ok") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const tag = `${v}/${view}/${theme}/${ws}/${model}`;
  page.on("console", (m) => m.type() === "error" && errors.push(`${tag}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
  await page.goto(`${file}?v=${v}&view=${view}&theme=${theme}&ws=${ws}&model=${model}&speed=0.2`);
  await page.waitForTimeout(150);
  return { ctx, page };
}
async function shot(page, name, view) {
  await page.waitForTimeout(250); // let an entrance finish
  const path = join(out, `${name}.png`);
  if (view === "phone") await page.locator(".frame-phone").screenshot({ path });
  else await page.screenshot({ path });
  shots++;
}
const wait = (page, sel) => page.waitForSelector(sel, { timeout: 8000 });
async function none(page, sel, why) { if ((await page.locator(sel).count()) !== 0) throw new Error(why); }
async function accepted(page, icon) {
  await none(page, ".sg", "line still shown after accepting");
  const head = await page.locator(".head-icon").innerText();
  if (icon && !head.includes(icon)) throw new Error(`header shows ${head}, wanted ${icon}`);
  await none(page, ".notice", "accepting announced something");
}

for (const theme of ["light", "dark"]) {
  for (const view of ["desktop", "phone"]) {
    const t = `${view === "phone" ? "puhelin" : "tyopoyta"}-${theme}`;
    const main = theme === "light" && view === "desktop";

    // 1. Sirut
    let { ctx, page } = await open(1, view, theme, "open-habitat");
    await wait(page, '.sg[data-ai="loading"]');
    if (main || view === "phone") await shot(page, `sirut-${t}-ladataan`, view);
    await wait(page, '.sg[data-ai="ok"] .cand[data-act="accept"]');
    await shot(page, `sirut-${t}-ehdotukset`, view);
    await page.fill('.sg [data-in="wish"]', "leikkisämpi");
    await page.click('.sg [data-act="ask"]');
    await wait(page, '.sg[data-ai="ok"] .rounds');
    await shot(page, `sirut-${t}-toive`, view);
    await page.click('.sg .cand[aria-label^="🦫"]');
    await accepted(page, "🦫");
    await page.click(".gs-chip");
    await wait(page, ".gitdlg");
    if (!(await page.locator(".gitdlg").innerText()).includes("Työtilan kuvake: 🦫")) throw new Error("no silent commit");
    await shot(page, `sirut-${t}-hyvaksytty-git`, view);
    await ctx.close();

    // 2. Keskustelu
    ({ ctx, page } = await open(2, view, theme, "hapanjuurikirja"));
    await wait(page, '.sg[data-ai="ok"] .cand');
    await shot(page, `keskustelu-${t}-rivi`, view);
    await page.click('[data-act="chat"]');
    await wait(page, ".chat .tile");
    await page.fill('.chat [data-in="wish"]', "kettu");
    await page.click('.chat [data-act="ask"]');
    await wait(page, ".chat .typing");
    await shot(page, `keskustelu-${t}-miettii`, view);
    await page.waitForFunction(() => document.querySelectorAll(".chat .msg.model .tiles").length === 2, null, { timeout: 8000 });
    await shot(page, `keskustelu-${t}-sparraus`, view);
    await page.click('.chat .tile[aria-label^="🦊"]');
    await accepted(page, "🦊");
    await none(page, ".chat", "chat open after accepting");
    await ctx.close();

    // 3. Valitsimessa
    ({ ctx, page } = await open(3, view, theme, "tailspin-monorepo"));
    await wait(page, '.sg[data-ai="ok"] .cand');
    await shot(page, `valitsimessa-${t}-rivi`, view);
    await page.click('[data-act="more"]');
    await wait(page, '.pop .ai-tab[data-ai="ok"] .tile');
    await page.click('.pop [data-act="quick"][data-v="kirjaimet"]');
    await wait(page, '.pop .ai-tab[data-ai="ok"] .rounds');
    await shot(page, `valitsimessa-${t}-kirjaimet`, view);
    await page.click('.pop .tile[aria-label^="IT:"]');
    await accepted(page, "IT");
    await page.click(".head-icon");
    await page.click('.pop [data-act="tab"][data-v="manual"]');
    await wait(page, ".pop .egrid");
    if (main) await shot(page, `valitsimessa-${t}-valitse-itse`, view);
    await ctx.close();

    // Failures, Git-less directory and a set icon: light only, every direction once.
    if (theme !== "light") continue;
    ({ ctx, page } = await open(1, view, theme, "tailspin-monorepo", "noauth"));
    await wait(page, '.sg[data-ai="failed"] .cand.local');
    await none(page, '.sg [data-in="wish"]', "a wish offered without credentials");
    await shot(page, `sirut-${t}-ei-kirjautumista`, view);
    await ctx.close();
    ({ ctx, page } = await open(2, view, theme, "open-habitat", "timeout"));
    await page.click('[data-act="chat"]');
    await wait(page, '.chat .msg.sys');
    await shot(page, `keskustelu-${t}-aikakatkaisu`, view);
    await ctx.close();
    ({ ctx, page } = await open(3, view, theme, "muistiinpanot", "slow"));
    await page.click(".head-icon");
    await wait(page, '.pop .ai-tab[data-ai="loading"]');
    await page.waitForTimeout(800);
    await shot(page, `valitsimessa-${t}-hidas-ei-gitia`, view);
    await wait(page, '.pop .ai-tab[data-ai="ok"] .tile');
    await page.click(".pop .tile >> nth=0");
    await accepted(page, null);
    if ((await page.locator(".gs-chip").count()) !== 0) throw new Error("Git chip without Git");
    await ctx.close();
    for (const v of [1, 2, 3]) {
      ({ ctx, page } = await open(v, view, theme, "fleetrepo"));
      await page.waitForTimeout(300);
      await none(page, ".sg", "suggestion on a repo whose icon is set");
      await ctx.close();
    }
  }
}
await browser.close();
console.log(JSON.stringify({ ok: errors.length === 0, errors, shots }, null, 1));
process.exit(errors.length ? 1 : 0);
