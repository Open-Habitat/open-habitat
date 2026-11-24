// node check.mjs [--only <block-id>] <out-dir> <shots-dir>
// Checks a page built by build.mjs (the same --only). Playwright from
// web/node_modules (PROTO_WEB=<dir with package.json and node_modules> borrows
// another checkout's). At 1440 and 390 px with reduced motion:
//   - nothing leaves the directory, the console is clean, the page does not
//     scroll sideways;
//   - on load every agent turn is closed: every stage's work and every tool
//     row's output is hidden;
//   - for every step of every block: its screen follows it (on the desktop the
//     sticky screen, on the phone the step's own), each stage's summary row
//     opens its work (Show work) and closes it again (Hide work), each tool row
//     opens and closes, and every button in the screen answers (view toggles,
//     offered files, a block's own buttons); screenshots of the step closed and
//     open: <width>-<block>-<step>-closed.png / -open.png;
//   - sections: a screenshot each; on the desktop a sidebar row opens its
//     conversation; on the phone each step is a row that opens its screen in
//     place (one open per story), and the sticky bar names the person under it
//     and opens the list, whose person links land at that person; capability
//     lists open; a line pointing at someone's day scrolls there (on the phone
//     with its row open);
//   - without JavaScript every step's request, story and replies are visible;
//   - asset budget per block (BUDGET below), formats, nothing unused.
// Exits 1 with the list of failures.
import { createRequire } from 'node:module';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const oi = args.indexOf('--only');
const only = oi >= 0 ? args.splice(oi, 2)[1] : null;
const [dir, shots] = args;
if (!dir || !shots) { console.error('usage: node check.mjs [--only <block-id>] <out-dir> <shots-dir>'); process.exit(2); }
mkdirSync(shots, { recursive: true });
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
if ((manifest.only || null) !== only) { console.error(`the build in ${dir} was made with --only ${manifest.only}; build again or pass the same --only`); process.exit(2); }
const url = pathToFileURL(join(dir, 'index.html')).href;
const fails = [];
const fail = (m) => { fails.push(m); console.log(`FAIL ${m}`); };

// ---------- Budget ----------
// Per file and per block, in bytes. Images: WebP or AVIF (SVG for drawings);
// video: MP4 (H.264) with a poster image; everything else (a .vtt, a .glb) small.
export const BUDGET = { image: 300e3, video: 2e6, other: 500e3, block: 4e6 };
const KIND = { '.webp': 'image', '.avif': 'image', '.svg': 'image', '.mp4': 'video', '.vtt': 'other', '.glb': 'other', '.json': 'other', '.csv': 'other', '.pdf': 'other' };
for (const [id, files] of Object.entries(manifest.assets)) {
  let total = 0;
  for (const f of files) {
    total += f.bytes;
    const kind = KIND[extname(f.name).toLowerCase()];
    if (!kind) fail(`${id}/${f.name}: format not allowed (images WebP/AVIF/SVG, video MP4, small data files)`);
    else if (f.bytes > BUDGET[kind]) fail(`${id}/${f.name}: ${(f.bytes / 1e3).toFixed(0)} KB, over the ${kind} budget of ${BUDGET[kind] / 1e3} KB`);
    if (!f.used) fail(`${id}/${f.name}: in the asset directory but not used by the block (it would ship anyway)`);
  }
  if (total > BUDGET.block) fail(`${id}: assets ${(total / 1e6).toFixed(2)} MB, over the block budget of ${BUDGET.block / 1e6} MB`);
}

const browser = await chromium.launch();
async function open(width, js = true) {
  const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 844 }, reducedMotion: 'reduce', javaScriptEnabled: js, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.route('**/*', (r) => { const u = r.request().url(); if (!u.startsWith('file:') && !u.startsWith('data:')) { page.errors.push(`request left the page: ${u}`); return r.abort(); } return r.continue(); });
  await page.goto(url);
  await page.waitForLoadState('load');
  return page;
}
const tag = (w) => (w > 600 ? 'desktop' : 'phone');
const name = (s) => s.replace(/[^a-z0-9-]+/gi, '-');

// The screen that belongs to a step: the sticky one on the desktop, the step's
// own on the phone, where its row is opened first.
async function screenFor(page, step, desktop) {
  await step.scrollIntoViewIfNeeded();
  await step.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
  if (!desktop) {
    const row = step.locator(':scope > .s1-row button');
    if ((await row.getAttribute('aria-expanded')) !== 'true') await press(row);
    if (!(await step.locator('.s1-inline').isVisible())) fail(`${await step.getAttribute('data-block')} step ${await step.getAttribute('data-i')}: its row did not open its screen`);
    return step.locator('.s1-inline');
  }
  const sec = step.locator('xpath=ancestor::section[contains(@class,"s1")][1]');
  const i = await step.getAttribute('data-i');
  const id = await step.getAttribute('data-block');
  await page.waitForFunction(([el, i]) => el.closest('.s1').querySelector(':scope > .s1-steps > .s1-step.on')?.dataset.i === i, [await step.elementHandle(), i], { timeout: 4000 }).catch(() => fail(`${id} step ${i}: the sticky screen did not follow the step`));
  return sec.locator('.s1-main');
}

// A click that does not scroll the page: the sticky screen stays on its step.
const press = (loc) => loc.evaluate((el) => el.click());
async function exercise(page, scr, label) {
  // Closed on arrival.
  const openWork = await scr.locator('.ah-turn-work:not([hidden]), .ah-disclosure-panel:not([hidden])').count();
  if (openWork) fail(`${label}: ${openWork} work or tool output open before anything was clicked`);
  const stages = scr.locator('.ah-stage-toggle');
  const n = await stages.count();
  for (let k = 0; k < n; k++) {
    const b = stages.nth(k);
    await press(b);
    if ((await b.getAttribute('aria-expanded')) !== 'true' || !(await b.getAttribute('aria-label')).startsWith('Hide work')) fail(`${label}: stage ${k + 1} did not open (Show work)`);
    const work = b.locator('xpath=../following-sibling::div[contains(@class,"ah-turn-work")][1]');
    if (!(await work.isVisible())) fail(`${label}: stage ${k + 1}'s work is not visible after Show work`);
    const tools = work.locator('.ah-tool-disclosure');
    const tn = await tools.count();
    for (let t = 0; t < tn; t++) {
      const tb = tools.nth(t);
      if ((await tb.getAttribute('aria-expanded')) !== 'false') fail(`${label}: tool ${t + 1} was open when its stage opened`);
      await press(tb);
      if (!(await tb.locator('xpath=following-sibling::div[1]').isVisible())) fail(`${label}: tool ${t + 1} did not open`);
    }
  }
  if (n === 0 && (await scr.locator('.ah-agent-turn').count())) {
    const turns = await scr.locator('.ah-agent-turn').count();
    const plain = await scr.locator('.ah-agent-turn:not(:has(.ah-turn-stage))').count();
    if (plain !== turns) fail(`${label}: turn without a summary row`);
  }
  // Every other button in the screen answers without an error.
  for (const sel of ['[data-set]', '.ah-offer-b', '.vid-play', '.op-b', '[data-undo]']) {
    const bs = scr.locator(sel); const c = await bs.count();
    for (let k = 0; k < c; k++) { await press(bs.nth(k)); }
  }
  return n;
}
async function closeAll(scr, label) {
  const tools = scr.locator('.ah-tool-disclosure[aria-expanded="true"]');
  while (await tools.count()) await press(tools.first());
  const st = scr.locator('.ah-stage-toggle[aria-expanded="true"]');
  while (await st.count()) await press(st.first());
  if (await scr.locator('.ah-turn-work:not([hidden])').count()) fail(`${label}: Hide work left work open`);
}

for (const width of [1440, 390]) {
  const desktop = width > 600;
  const page = await open(width);
  const W = tag(width);
  // Closed on arrival, everywhere.
  const openOnLoad = await page.locator('.ah-turn-work:not([hidden]), .ah-tool-row .ah-disclosure-panel:not([hidden]), .ah-stage-toggle[aria-expanded="true"]').count();
  if (openOnLoad) fail(`${W}: ${openOnLoad} pieces of work open on load`);
  // Sections without a story: one shot each.
  for (const el of await page.locator('.blk-section, .day-intro.blk, .day-end.blk, .caps-intro.blk').all()) {
    const id = await el.getAttribute('data-block');
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: join(shots, `${W}-${id}-${name((await el.getAttribute('class')).split(' ').pop())}.png`) });
  }
  // Every step of every block.
  const steps = await page.locator('.s1-step').all();
  for (const step of steps) {
    const id = await step.getAttribute('data-block');
    const i = await step.getAttribute('data-i');
    const sec = await step.evaluate((el) => el.closest('.s1').dataset.story);
    const label = `${W} ${id} (${sec} step ${i})`;
    const scr = await screenFor(page, step, desktop);
    const shotEl = desktop ? step.locator('xpath=ancestor::section[contains(@class,"s1")][1]') : step;
    await page.waitForTimeout(100);
    await (desktop ? page : step).screenshot({ path: join(shots, `${W}-${id}-${sec}-${i}-closed.png`), style: '.pn-bar { visibility: hidden; }' });
    const n = await exercise(page, scr, label);
    // Open state: the screen scrolled to the first opened stage.
    if (n) await scr.locator('.ah-stage-toggle').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await (desktop ? page : step).screenshot({ path: join(shots, `${W}-${id}-${sec}-${i}-open.png`), style: '.pn-bar { visibility: hidden; }' });
    await closeAll(scr, label);
    void shotEl;
  }
  // The sidebar.
  const railSec = page.locator('.s1:not(.s1-norail)').first();
  if (await railSec.count()) {
    const step = railSec.locator('.s1-step').last();
    const scr = await screenFor(page, step, desktop);
    if (desktop) {
      const rows = railSec.locator('.s1-rail .rl-row:not([aria-current])');
      if (await rows.count()) {
        const r = rows.first(); const title = await r.locator('.rl-t').innerText();
        await r.click();
        const t = await scr.locator('.scr-bar b').first().innerText();
        if (t !== title) fail(`${W}: a sidebar row (${title}) did not open its conversation (${t})`);
        await exercise(page, scr, `${W} sidebar ${title}`);
      }
    } else {
      // One row open per story: the last step's row is open, the others closed.
      const open = await railSec.locator('.s1-step.s1-open').count();
      if (open !== 1) fail(`${W}: ${open} rows open in one story after opening one`);
      void scr;
    }
  }
  // The phone's bar: it names the person under it, and its list lands at a person.
  if (!desktop && (await page.locator('.pn-bar').count())) {
    await page.locator('#role-carol .s1-step').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(200);
    const who = (await page.locator('.pn-who b').innerText()).trim();
    if (who !== 'Carol') fail(`${W}: the bar says "${who}" in Carol's day`);
    await page.locator('.pn-who').click();
    if (!(await page.locator('.pn-menu').isVisible())) fail(`${W}: the bar's switcher did not open the list`);
    await page.locator('.pn-menu a[href="#role-frank"]').click(); await page.waitForTimeout(250);
    if (await page.locator('.pn-menu').isVisible()) fail(`${W}: the list stayed open after a jump`);
    const top = (await page.locator('#role-frank').boundingBox())?.y;
    const bar = (await page.locator('.pn-bar').boundingBox())?.height;
    if (!(top >= bar - 1 && top < bar + 40)) fail(`${W}: the list's Frank landed at ${top}px (bar ${bar}px)`);
  }
  // Capability lists and lines that point at someone's day.
  for (const more of await page.locator('.cap-more').all()) {
    await more.locator('summary').first().click();
    const it = more.locator('.cap-it summary').first();
    if (await it.count()) { await it.click(); if (!(await more.locator('.cap-it[open] .scr').first().isVisible())) fail(`${W}: a capability item did not open`); }
  }
  for (const a of (await page.locator('a.cap-role').all()).slice(0, 3)) {
    const href = await a.getAttribute('href');
    if (!(await page.locator(href).count())) continue; // --only: the person is not on this page
    await a.click(); await page.waitForTimeout(150);
    const box = await page.locator(href).boundingBox();
    if (!box || box.y > 900 || box.y + box.height < 0) fail(`${W}: ${href} not in view after its line was clicked`);
  }
  // The whole page to its end.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(200);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (wide > 0) fail(`${W}: the page scrolls sideways by ${wide}px`);
  for (const e of page.errors) fail(`${W} console: ${e}`);
  await page.close();
}

// ---------- Without JavaScript: the text reads ----------
{
  const page = await open(1440, false);
  const steps = await page.locator('.s1-step').all();
  for (const step of steps) {
    const id = await step.getAttribute('data-block');
    for (const sel of ['.ask', '.did', '.s1-inline .ah-message .ah-prose']) {
      const el = step.locator(sel).first();
      if (!(await el.count()) || !(await el.isVisible()) || !(await el.innerText()).trim()) fail(`no JavaScript: ${id} ${sel} is not readable`);
    }
  }
  await page.screenshot({ path: join(shots, 'nojs-1440-top.png') });
  if (steps[0]) { await steps[0].scrollIntoViewIfNeeded(); await page.screenshot({ path: join(shots, 'nojs-1440-first-step.png') }); }
  for (const e of page.errors) fail(`no JavaScript console: ${e}`);
  await page.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} failures` : `ok: ${manifest.blocks.length} blocks, screenshots in ${shots}`);
process.exit(fails.length ? 1 : 0);
