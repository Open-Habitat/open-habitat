// node check.mjs <out-dir> [desktop|phone]
// Checks and measures the three scroll mechanisms in the page build.mjs wrote,
// with Playwright from web/node_modules (PROTO_WEB=<dir with package.json and
// node_modules> borrows another checkout's), at 1440×900 and 390×844:
//   - walks Alice's story (and Carol's) step by step with the wheel, Page Down,
//     Space and the arrow key, and records for each step which step became
//     active and how far its text's top sits from the screen's top edge (on
//     the phone: from 16px under the status bar); "skipped" lists steps that
//     were never active;
//   - an anchor (#g-alice-receipts), a capability-style link and a simulated
//     find-in-page jump (the found ask centred without input events) land with
//     that step active and level;
//   - every step's ask is in the accessibility tree in order;
//   - reduced motion: no snapping, no cross-fade;
//   - the console is clean.
// Writes measure.json, screenshots (<vp>-<variant>-<pos>.png) and, at both
// sizes, a short video per variant (video/<vp>-<variant>.webm) into
// <out-dir>/check/. Exits 1 on failures.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const { checkPicker } = await import(pathToFileURL(join(here, '../../picker-check.mjs')).href);
const [dir, onlyVp] = process.argv.slice(2);
if (!dir || (onlyVp && !['desktop', 'phone'].includes(onlyVp))) { console.error('usage: node check.mjs <out-dir> [desktop|phone]'); process.exit(2); }
const outDir = join(dir, 'check'); mkdirSync(join(outDir, 'video'), { recursive: true });
const url = pathToFileURL(join(dir, 'index.html')).href;
const fails = [];
const fail = (m) => { fails.push(m); console.log(`FAIL ${m}`); };
const VP = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const NAMES = { 1: 'napsahdus', 2: 'kiinnitetty', 3: 'ylareuna' };
const TOL = 3; // px: "level"

const browser = await chromium.launch();
async function open(vp, v, { reduced = false, hash = '', video = false } = {}) {
  const ctx = await browser.newContext({ viewport: VP[vp], reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1, ...(video ? { recordVideo: { dir: join(outDir, 'video'), size: VP[vp] } } : {}) });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(`${url}?v=${v}${hash}`);
  await page.waitForLoadState('load');
  await page.waitForTimeout(300);
  return page;
}
// The state of a story: which step is active and where its text's top is
// relative to the line it should be level with.
const state = (page, story) => page.evaluate((story) => {
  const sec = document.querySelector(`[data-story="${story}"]`);
  const els = [...sec.querySelectorAll(':scope > .s1-steps > .s1-step')];
  const i = els.findIndex((s) => s.classList.contains('on'));
  const wide = matchMedia('(min-width: 901px)').matches;
  const line = wide ? sec.querySelector('.s1-app').getBoundingClientRect().top : sec.querySelector('.s1-bar').getBoundingClientRect().bottom + 16;
  const txt = els[i].querySelector('.s1-txt').getBoundingClientRect().top;
  const opacity = +getComputedStyle(els[i].querySelector('.s1-txt')).opacity * +getComputedStyle(els[i]).opacity;
  return { i, n: els.length, off: Math.round(txt - line), opacity: +opacity.toFixed(2), y: Math.round(scrollY), max: Math.round(document.documentElement.scrollHeight - innerHeight), secBottom: Math.round(sec.getBoundingClientRect().bottom) };
}, story);
async function settle(page) {
  let last = -1;
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(k < 2 ? 120 : 80);
    const y = await page.evaluate(() => scrollY);
    if (y === last) break;
    last = y;
  }
  await page.waitForTimeout(260); // the cross-fade
}
// Put a story's first step at its line.
async function toStart(page, story) {
  await page.evaluate((story) => {
    const sec = document.querySelector(`[data-story="${story}"]`);
    const s = sec.querySelector('.s1-step');
    const wide = matchMedia('(min-width: 901px)').matches;
    const line = wide ? parseFloat(getComputedStyle(sec.querySelector('.s1-app')).top) : sec.querySelector('.s1-bar').offsetHeight;
    scrollTo(0, scrollY + s.getBoundingClientRect().top - line);
  }, story);
  await settle(page);
}
// One reader action.
async function act(page, how, vp) {
  // A short flick: four wheel events of 100px, 16ms apart (a precise wheel or touchpad).
  if (how === 'wheel') { await page.mouse.move(vp === 'desktop' ? 300 : 6, 600); for (let k = 0; k < 4; k++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(16); } }
  else if (how === 'nudge') { await page.mouse.move(vp === 'desktop' ? 300 : 6, 600); await page.mouse.wheel(0, 100); }
  else await page.keyboard.press(how);
}
async function walk(page, story, how, vp) {
  await toStart(page, story);
  const first = new Map();
  let s = await state(page, story);
  first.set(s.i, s);
  const maxActs = how === 'nudge' ? 12 : how === 'ArrowDown' ? 900 : 400;
  for (let k = 0; k < maxActs; k++) {
    const prevY = s.y;
    await act(page, how, vp);
    if (how === 'ArrowDown' || how === 'wheel' || how === 'nudge') {
      // Small steps: only settle fully when the active step changed.
      await page.waitForTimeout(60);
      const q = await state(page, story);
      if (q.i === s.i && q.y !== prevY) { s = q; continue; }
    }
    await settle(page);
    s = await state(page, story);
    if (!first.has(s.i)) first.set(s.i, s);
    if (s.i === s.n - 1 || s.y >= s.max || s.secBottom < 0) break;
  }
  const steps = [...Array(s.n).keys()].map((i) => first.get(i) || null);
  return { how, steps: steps.map((x) => (x ? { off: x.off, opacity: x.opacity } : null)), skipped: steps.map((x, i) => (x ? null : i + 1)).filter(Boolean) };
}

const result = {};
for (const vp of onlyVp ? [onlyVp] : ['desktop', 'phone']) for (const v of [1, 2, 3]) {
  const key = `${vp}-${NAMES[v]}`;
  const page = await open(vp, v);
  const r = (result[key] = { walks: {}, landings: {} });
  for (const story of ['alice', 'role-carol']) {
    for (const how of story === 'alice' ? ['wheel', 'nudge', 'PageDown', 'Space', 'ArrowDown'] : ['wheel', 'PageDown']) {
      const w = await walk(page, story, how, vp);
      r.walks[`${story}/${how}`] = w;
      const offs = w.steps.filter(Boolean).map((x) => Math.abs(x.off));
      console.log(`${key} ${story} ${how}: skipped [${w.skipped}] off ${w.steps.map((x) => (x ? x.off : '–')).join(' ')}`);
      if (w.skipped.length && how !== 'nudge') fail(`${key} ${story} ${how}: steps never active: ${w.skipped}`);
    }
  }
  // Screenshots at three positions: Alice's first step, between steps 4 and 5, Carol's second step.
  await toStart(page, 'alice');
  await page.screenshot({ path: join(outDir, `${key}-1-alku.png`) });
  await page.evaluate(() => { const s = document.querySelectorAll('[data-story="alice"] .s1-step')[4]; scrollBy(0, s.getBoundingClientRect().top - innerHeight * 0.35); });
  await settle(page);
  r.between = await state(page, 'alice');
  await page.screenshot({ path: join(outDir, `${key}-2-valissa.png`) });
  await page.evaluate(() => { const s = document.querySelectorAll('[data-story="role-carol"] .s1-step')[1]; s.scrollIntoView({ block: 'start' }); });
  await settle(page);
  await page.screenshot({ path: join(outDir, `${key}-3-carol.png`) });
  // Find-in-page, simulated: the browser centres the match without input events.
  await toStart(page, 'alice');
  await page.evaluate(() => document.querySelectorAll('[data-story="alice"] .s1-step')[7].querySelector('.did').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(150); await settle(page); await settle(page);
  r.landings.find = await state(page, 'alice');
  if (r.landings.find.i !== 7 || Math.abs(r.landings.find.off) > TOL || r.landings.find.opacity < 0.95) fail(`${key}: find-in-page jump to step 8 lands on ${r.landings.find.i + 1}, off ${r.landings.find.off}, opacity ${r.landings.find.opacity}`);
  // A capability-style link in the page.
  await page.evaluate(() => scrollTo(0, 0)); await settle(page);
  await page.click('.vr-links a[href="#g-alice-orders"]'); await settle(page); await settle(page);
  r.landings.capLink = await page.evaluate(() => [...document.querySelectorAll('[data-story="alice"] .s1-step')].findIndex((s) => s.id === 'g-alice-orders'));
  const cl = await state(page, 'alice');
  r.landings.capLinkState = cl;
  if (cl.i !== r.landings.capLink || Math.abs(cl.off) > TOL) fail(`${key}: capability link to #g-alice-orders lands on ${cl.i + 1} (want ${r.landings.capLink + 1}), off ${cl.off}`);
  try { await checkPicker(page, '2026-11-23-vieritys'); } catch (e) { fail(`${key}: ${e.message}`); }
  // Accessibility tree: every ask in order.
  const asks = await page.locator('[data-story="alice"] .s1-step .ask').allInnerTexts();
  const tree = await page.locator('[data-story="alice"] .s1-steps').ariaSnapshot();
  const norm = (x) => x.replace(/[^\p{L}\p{N}]+/gu, '');
  const ntree = norm(tree);
  let pos = 0; for (const a of asks) { const k = ntree.indexOf(norm(a).slice(0, 40)); if (k < pos) { fail(`${key}: ask "${a.slice(0, 30)}" missing or out of order in the accessibility tree`); break; } pos = k; }
  if (page.errors.length) fail(`${key}: console: ${page.errors.slice(0, 3).join(' | ')}`);
  await page.context().close();
  // An anchor on load.
  const pa = await open(vp, v, { hash: '#g-alice-receipts' });
  await settle(pa);
  const want = await pa.evaluate(() => [...document.querySelectorAll('[data-story="alice"] .s1-step')].findIndex((s) => s.id === 'g-alice-receipts'));
  r.landings.hash = await state(pa, 'alice');
  if (r.landings.hash.i !== want || Math.abs(r.landings.hash.off) > TOL) fail(`${key}: #g-alice-receipts on load lands on ${r.landings.hash.i + 1} (want ${want + 1}), off ${r.landings.hash.off}`);
  await pa.context().close();
  // Reduced motion: no snap, no cross-fade.
  const pr = await open(vp, v, { reduced: true });
  r.reduced = await pr.evaluate(() => ({ snap: getComputedStyle(document.documentElement).scrollSnapType, fade: getComputedStyle(document.querySelector('.s1-txt')).transitionDuration }));
  if (r.reduced.snap !== 'none' || !/^0s(, 0s)*$/.test(r.reduced.fade)) fail(`${key}: reduced motion still has snap ${r.reduced.snap} / transition ${r.reduced.fade}`);
  const rw = await walk(pr, 'alice', 'PageDown', vp);
  r.walks['alice/PageDown-reduced'] = rw;
  console.log(`${key} reduced PageDown: skipped [${rw.skipped}] off ${rw.steps.map((x) => (x ? x.off : '–')).join(' ')}`);
  await pr.context().close();
  // Video: the wheel through Alice's first five steps, a reader's pace.
  const pv = await open(vp, v, { video: true });
  await toStart(pv, 'alice');
  await pv.waitForTimeout(600);
  await pv.mouse.move(vp === 'desktop' ? 300 : 6, 600);
  for (let k = 0; k < (vp === 'desktop' ? 34 : 40); k++) { await pv.mouse.wheel(0, 100); await pv.waitForTimeout(k % 8 === 7 ? 900 : 110); }
  await pv.waitForTimeout(800);
  const vid = pv.video();
  await pv.context().close();
  await vid.saveAs(join(outDir, 'video', `${key}.webm`));
  await vid.delete();
}
await browser.close();
writeFileSync(join(outDir, `measure${onlyVp ? `-${onlyVp}` : ''}.json`), JSON.stringify(result, null, 1));
console.log(fails.length ? `\n${fails.length} failures` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
