// node check.mjs <offline.html> <evidence-directory>
// One Chromium, sequential pages. For each direction (A, B, C, Nyt) in
// fi/en × light/dark at 1440×1100: the picker, the three rails (5 icon-row
// items, 4 tiles, 4 rows), every place button named, the tooltip visible on
// hover and on keyboard focus, the three situations (badges and their words),
// the account menu, the 1x/2x rasters drawn, offline and a clean console.
// The distinctness measure: in A, B and C no two icon-row icons may overlap
// more than 50 % at 1x; Nyt must show its two globes as the same picture.
// Also 390×844 for overflow of the review page. Screenshots for review only.

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkPicker } from "../../picker-check.mjs";

const ROUND = "2026-11-22-rail-icons";
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, "../../../../web/package.json"));
const { chromium } = require("playwright");
const [input, out] = process.argv.slice(2);
if (!input || !out) throw new Error("usage: node check.mjs <offline.html> <evidence-directory>");
mkdirSync(out, { recursive: true });
const url = (q) => pathToFileURL(resolve(input)).href + "?" + q;
const browser = await chromium.launch();
const errors = [];
const requests = [];
const worst = {};

async function open(width, height, q) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.route(/^https?:/, (r) => {
    requests.push(r.request().url());
    return r.abort();
  });
  await page.goto(url(q));
  await page.locator(".rit[data-direction]").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector("[data-testid=distinct]")?.dataset.worst);
  return { context, page };
}

for (let v = 1; v <= 4; v++)
  for (const lang of ["fi", "en"])
    for (const theme of ["light", "dark"]) {
      const tag = `v${v}-${lang}-${theme}`;
      const { context, page } = await open(1440, 1100, `v=${v}&lang=${lang}&theme=${theme}`);
      await checkPicker(page, ROUND);
      assert.equal(await page.locator(".rit").getAttribute("data-direction"), String(v - 1), `${tag}: direction`);
      const col = (s) => page.locator(`.rit-col[data-step="${s}"]`);
      assert.equal(await col(0).locator(".rit-icon-item").count(), 5, `${tag}: icon row`);
      assert.equal(await col(1).locator(".rit-tile").count(), 4, `${tag}: tiles`);
      assert.equal(await col(2).locator(".rit-row").count(), 4, `${tag}: rows`);
      for (const b of await page.locator(".rit-rail button").all())
        assert.ok(((await b.getAttribute("aria-label")) || (await b.innerText())).trim(), `${tag}: unnamed button`);
      // Usual: one new output, the agent in the browser.
      const outputs = col(0).locator('[data-place="outputs"]');
      assert.equal((await outputs.locator(".rit-count").innerText()).trim(), "1", `${tag}: count badge`);
      assert.match(await outputs.getAttribute("aria-label"), lang === "fi" ? /1 uusi/ : /1 new/, `${tag}: count named`);
      assert.equal(await col(0).locator('[data-place="browser"] .rit-dot[data-state="agent"]').count(), 1, `${tag}: agent dot`);
      assert.match(await col(1).locator('[data-place="browser"] small').innerText(), lang === "fi" ? /Agentti työssä/ : /Agent working/);
      // Tooltip on hover, then on keyboard focus.
      await outputs.hover();
      await page.waitForTimeout(450);
      assert.ok(await outputs.locator(".rit-tip").isVisible(), `${tag}: tooltip on hover`);
      if (v === 1 && theme === "light") await page.screenshot({ path: `${out}/${tag}-tooltip.png` });
      await page.mouse.move(1430, 10);
      await col(0).locator('[data-place="access"]').focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await page.waitForTimeout(450);
      assert.ok(await col(0).locator('[data-place="access"] .rit-tip').isVisible(), `${tag}: tooltip on focus`);
      await page.screenshot({ path: `${out}/${tag}.png`, fullPage: true });
      // Rasters: every canvas drawn at its own pixel size.
      const sizes = await page.$$eval("canvas[data-k]", (cs) => cs.map((c) => [c.width, Number(c.dataset.dpr) * 18]));
      assert.ok(sizes.length === 36 && sizes.every(([w, want]) => w === want), `${tag}: rasters`);
      const w = Number(await page.locator("[data-testid=distinct]").getAttribute("data-worst"));
      const pair = await page.locator("[data-testid=distinct]").getAttribute("data-pair");
      worst[v] = { w, pair };
      if (v < 4) assert.ok(w <= 0.5, `${tag}: icons too alike (${pair} ${w})`);
      else assert.ok(w > 0.95 && pair === "outputs/browser", `${tag}: today's globes should match (${pair} ${w})`);
      // Waiting for you: the browser and a connection ask, Selitä pressed.
      await page.selectOption("[data-ctl=scene]", "waiting");
      assert.equal(await col(0).locator('[data-place="browser"] .rit-dot[data-state="ask"]').count(), 1, `${tag}: ask dot`);
      assert.equal(await col(0).locator('[data-place="access"] .rit-dot[data-state="ask"]').count(), 1, `${tag}: access ask`);
      assert.match(await col(2).locator('[data-place="browser"] .rit-state').innerText(), lang === "fi" ? /Odottaa sinua/ : /Waiting for you/);
      assert.equal(await col(0).locator('[data-act="explain"]').getAttribute("aria-pressed"), "true");
      // Account menu in the rows step, closed with Escape.
      await col(2).locator('[data-act="menu"]').click();
      assert.equal(await page.locator(".rit-menu [role=menuitem]").count(), 3, `${tag}: menu`);
      if (theme === "dark" && lang === "fi") await page.screenshot({ path: `${out}/${tag}-waiting-menu.png`, fullPage: true });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".rit-menu").count(), 0, `${tag}: menu closes`);
      await page.selectOption("[data-ctl=scene]", "rest");
      assert.equal(await page.locator(".rit-rail .rit-dot, .rit-rail .rit-count").count(), 0, `${tag}: rest has no badges`);
      // A place press makes it current.
      await col(1).locator('[data-place="browser"]').click();
      assert.equal(await col(0).locator('[data-place="browser"]').getAttribute("aria-current"), "page", `${tag}: current`);
      await context.close();
    }

// The review page on a phone: no sideways overflow.
{
  const { context, page } = await open(390, 844, "v=1");
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(over <= 1, `phone: overflow ${over}px`);
  await page.screenshot({ path: `${out}/phone.png`, fullPage: true });
  await context.close();
}
await browser.close();
assert.deepEqual(errors, [], `console errors: ${errors.join(" | ")}`);
assert.deepEqual(requests, [], `network requests: ${requests.join(" ")}`);
console.log(JSON.stringify({ ok: true, worst }, null, 1));
