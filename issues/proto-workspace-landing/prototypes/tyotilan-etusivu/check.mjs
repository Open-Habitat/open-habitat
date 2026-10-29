// Browser check and evidence capture for the workspace-landing round.
//
//   PLAYWRIGHT_DIR=<dir containing node_modules/playwright> \
//   PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" \
//   node check.mjs <out-dir>
//
// Visits every direction light/dark at 1440 and 390 px, clicks the
// interactions (goal → guide → Aloita → send, Git layer, intro disclosure,
// absent start page), fails on console errors or horizontal overflow, and
// writes PNG captures at device scale 2 plus checks.json into <out-dir>.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const out = process.argv[2];
if (!out || !process.env.PLAYWRIGHT_DIR) {
  console.error("usage: PLAYWRIGHT_DIR=<dir> node check.mjs <out-dir>");
  process.exit(2);
}
const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR, "x.js"));
const { chromium } = require("playwright");
const file = pathToFileURL(path.join(import.meta.dirname, "index.html")).href;
mkdirSync(out, { recursive: true });

const NAMES = ["nyt", "esittely", "tilannekuva", "aloitus"];
const SIZES = { 1440: { width: 1440, height: 1000 }, 390: { width: 390, height: 1400 } };
const results = [];
const failures = [];
const browser = await chromium.launch();

async function open(v, theme, width, page = "authored") {
  const ctx = await browser.newContext({ viewport: SIZES[width], deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${file}?v=${v + 1}&theme=${theme}&page=${page}&capture=1`);
  await p.waitForSelector(".app");
  await p.evaluate(() => document.fonts.ready);
  return { ctx, p, errors };
}
async function overflow(p) {
  return p.evaluate(() =>
    [...document.querySelectorAll(".app, .main, .wsp-scroll, .conv-stream, .ah-workspace-page")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.className),
  );
}
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}: ${detail}`);
}
async function shot(p, name) {
  await p.screenshot({ path: path.join(out, `${name}.png`) });
}

for (const [v, vname] of NAMES.entries()) {
  for (const theme of ["light", "dark"]) {
    for (const width of [1440, 390]) {
      const id = `${vname}-${width}-${theme}`;
      const { ctx, p, errors } = await open(v, theme, width);
      const of = await overflow(p);
      record(`${id} initial no overflow`, of.length === 0, of.join(","));
      record(`${id} theme`, (await p.getAttribute("html", "data-theme")) === theme);
      if (v > 0) record(`${id} landing shown`, (await p.locator('[data-testid="landing"]').count()) === 1);
      const capture =
        (theme === "light" && width === 1440) || (theme === "dark" && width === 390) ||
        (theme === "dark" && width === 1440 && v === 1) || (theme === "light" && width === 390 && v === 2);
      if (capture) await shot(p, id);

      // Git layer opens and closes.
      await p.locator('#stage [data-act="git"]').first().click();
      record(`${id} git layer`, await p.locator(".git-layer").isVisible());
      await p.locator('.git-layer [data-act="git-close"]').click();
      record(`${id} git closed`, (await p.locator(".git-layer").count()) === 0);

      if (v === 1 || v === 2) {
        await p.locator('#stage [data-act="intro"]').click();
        const text = await p.locator(".app").innerText();
        record(`${id} intro opens`, text.includes("make test"));
      }
      if (v === 0) {
        await p.locator('#stage [data-act="new"]').click();
        record(`${id} new conversation catalogue`, (await p.locator(".conv .ah-start-goal").count()) === 4);
      } else {
        // Goal → guide: in place for Aloitus tässä, in a new conversation otherwise.
        await p.locator('#stage [data-act="goal"][data-i="0"]').click();
        record(`${id} guide opens`, await p.locator('[data-testid="goal-guide"]').isVisible());
        record(`${id} guide place`, (await p.locator(".conv").count()) === (v === 3 ? 0 : 1));
        if (theme === "light" && width === 1440) await shot(p, `${vname}-opas-1440-light`);
        if (v === 3 && theme === "light" && width === 390) await shot(p, `${vname}-opas-390-light`);
      }
      if (v !== 0) {
        await p.locator('#stage [data-act="aloita"]').click();
        const draft = await p.locator("#field").inputValue();
        record(`${id} Aloita prepares draft`, draft.startsWith("/skill:korjaa Korjaa") && draft.endsWith("[kuvaile havainto]"), draft);
        record(`${id} field focused`, await p.evaluate(() => document.activeElement?.id === "field"));
        if (v === 3 && theme === "light" && width === 1440) await shot(p, `${vname}-aloitettu-1440-light`);
      } else {
        await p.locator("#field").fill("Miksi kesäaika menee väärin?");
      }
      await p.locator('#stage [data-act="send"]').click();
      record(`${id} sent bubble`, await p.locator(".bubble").isVisible());
      const of2 = await overflow(p);
      record(`${id} after send no overflow`, of2.length === 0, of2.join(","));
      record(`${id} console clean`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }
  // Absent start page: each direction says so and offers a way to create one.
  for (const [theme, width] of [["light", 1440], ["dark", 390]]) {
    if (v === 0) continue;
    const id = `${vname}-puuttuu-${width}-${theme}`;
    const { ctx, p, errors } = await open(v, theme, width, "none");
    const text = await p.locator(".app").innerText();
    record(`${id} explains absence`, text.includes("aloitussivu") || text.includes("Aloitussivu"));
    record(`${id} no goals`, (await p.locator(".ah-start-goal, .goal-pill").count()) === 0);
    const of = await overflow(p);
    record(`${id} no overflow`, of.length === 0, of.join(","));
    await shot(p, id);
    if (v !== 3) {
      await p.locator('#stage [data-act="create-start"]').click();
      record(`${id} create prepares skill`, (await p.locator("#field").inputValue()).startsWith("/open-habitat-start-page"));
    }
    record(`${id} console clean`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}

// Picker: keys and URL persistence, with chrome visible.
{
  const ctx = await browser.newContext({ viewport: SIZES[1440] });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${file}?v=2`);
  await p.waitForSelector(".app");
  record("picker restores ?v=2", (await p.locator(".proto-picker-item[data-active]").innerText()) === "Esittely");
  await p.keyboard.press("4");
  await p.waitForSelector('.app[data-variant="3"]');
  record("picker key 4", new URL(p.url()).searchParams.get("v") === "4");
  await p.locator('.p-ctl [data-val="dark"]').click();
  record("control theme", (await p.getAttribute("html", "data-theme")) === "dark");
  await p.locator('.p-ctl [data-val="phone"]').click();
  const w = await p.locator(".app").evaluate((el) => el.getBoundingClientRect().width);
  record("control phone frame 390", Math.round(w) === 390, String(w));
  record("phone frame hides rail", !(await p.locator(".rail").isVisible()));
  await p.screenshot({ path: path.join(out, "kehys-puhelin-1440-dark.png") });
  record("picker console clean", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

await browser.close();
writeFileSync(path.join(out, "checks.json"), `${JSON.stringify({ passed: results.filter((r) => r.ok).length, failed: failures.length, results }, null, 1)}\n`);
console.log(`${results.length - failures.length}/${results.length} passed`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
