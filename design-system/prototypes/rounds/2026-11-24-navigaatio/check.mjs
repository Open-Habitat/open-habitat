// node check.mjs [out-dir] <shots-dir>
// Checks the page build.mjs wrote (default out-dir
// ~/src/open-habitat-dev/worker-results/navigaatio). Playwright from
// web/node_modules (PROTO_WEB=<dir with package.json and node_modules>
// borrows another checkout's). For every variant at 1440×900 and 390×844, with
// reduced motion unless said otherwise:
//   - the console is clean, nothing leaves the directory, no sideways scroll;
//   - the first keyboard stop reaches the variant's navigation and shows a
//     focus ring (variant 3: the strip after Alice's day);
//   - story activation still aligns: for steps in Alice's day, a person and a
//     capability group, the step scrolled to its anchor is the active one and
//     its text is level with the sticky screen's top (desktop) or its top
//     touches the status bar (phone), and no bar covers either;
//   - anchors: a capability line that points into Alice's day lands its step
//     at the line; loading the page at #role-carol and at a step's anchor
//     lands them under any bar;
//   - from the bottom of the page, the top and each main section are reached
//     in at most two actions, land correctly, and the section is marked
//     aria-current; variant 3 also from mid-page by scroll-up intent;
//   - once more for one jump with motion on (smooth scroll), the landing holds;
//   - sheets open, close with Escape and give focus back;
//   - layout shift while scrolling the whole page, against the page with no
//     variant (?nav=off), and the sections' offsets;
//   - 1024×768 and 700×800 load clean and align.
// Screenshots: <size>-v<n>-top / -mid / -team / -end / -open .png, and the
// measurements in measurements.json. Exits 1 with the list of failures.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const args = process.argv.slice(2);
if (!args.length) { console.error('usage: node check.mjs [out-dir] <shots-dir>'); process.exit(2); }
const shots = resolve(args.pop());
const dir = resolve(args[0] || join(homedir(), 'src/open-habitat-dev/worker-results/navigaatio'));
if (!existsSync(join(dir, 'index.html'))) { console.error(`no build in ${dir}; run build.mjs first`); process.exit(2); }
mkdirSync(shots, { recursive: true });
const url = pathToFileURL(join(dir, 'index.html')).href;
const fails = [];
const fail = (m) => { fails.push(m); console.log(`FAIL ${m}`); };
const M = {};
const SECTIONS = ['day', 'roles', 'can', 'install'];

const browser = await chromium.launch();
async function open(q, width, height, { reduce = true, hash = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduce ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.route('**/*', (r) => { const u = r.request().url(); if (!u.startsWith('file:') && !u.startsWith('data:')) { page.errors.push(`request left the page: ${u}`); return r.abort(); } return r.continue(); });
  await page.goto(`${url}?${q}${hash}`);
  await page.waitForLoadState('load');
  await settle(page);
  return page;
}
// Wait until the page has stopped scrolling and the variants have updated.
async function settle(page, max = 5000) {
  const t0 = Date.now(); let last = -1; let same = 0;
  while (Date.now() - t0 < max) {
    const y = await page.evaluate(() => scrollY);
    same = y === last ? same + 1 : 0; last = y;
    if (same >= 3) break;
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(120);
}
// The bottom edge of the variant's fixed top chrome (0 when there is none or it is not shown).
const chromeBottom = (page) => page.evaluate(() => { const b = document.querySelector('.tb'); return b && b.dataset.shown === 'true' ? b.getBoundingClientRect().bottom : 0; });
// A step at its line: active, text level with the screen (desktop) or under the status bar (phone), nothing covering.
async function aligned(page, sel, label) {
  const m = await page.evaluate(([sel]) => {
    const step = document.querySelector(sel);
    const sec = step.closest('.s1');
    const b = document.querySelector('.tb');
    const cb = b && b.dataset.shown === 'true' ? b.getBoundingClientRect().bottom : 0;
    const wide = matchMedia('(min-width: 901px)').matches;
    const on = step.classList.contains('on');
    if (wide) {
      const txt = step.querySelector('.s1-txt').getBoundingClientRect().top;
      const app = sec.querySelector('.s1-app').getBoundingClientRect().top;
      return { wide, on, d: txt - app, cover: cb - app, cb, line: app };
    }
    const sb = sec.querySelector('.s1-bar');
    // A story without a status bar (a capability group): the line is the top bar's edge.
    if (!sb) return { wide, on, d: step.getBoundingClientRect().top - cb, cover: 0, cb, line: cb };
    const bar = sb.getBoundingClientRect();
    return { wide, on, d: step.getBoundingClientRect().top - bar.bottom, cover: cb - bar.top, cb, line: bar.bottom };
  }, [sel]);
  if (!m.on) fail(`${label}: ${sel} is not the active step at its line`);
  if (Math.abs(m.d) > 2) fail(`${label}: ${sel} ${m.wide ? 'text is ' + m.d.toFixed(1) + ' px off the screen top' : 'top is ' + m.d.toFixed(1) + ' px off the status bar'}`);
  if (m.cover > 1) fail(`${label}: the bar covers the ${m.wide ? 'sticky screen' : 'status bar'} by ${m.cover.toFixed(1)} px`);
  return m;
}
async function landed(page, target, label) {
  const m = await page.evaluate(([t]) => {
    const b = document.querySelector('.tb');
    const cb = b && b.dataset.shown === 'true' ? b.getBoundingClientRect().bottom : 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (t === 'top') return { y: scrollY, ok: scrollY <= 2 };
    const r = document.getElementById(t).getBoundingClientRect();
    return { y: scrollY, top: r.top, cb, ok: Math.abs(r.top - cb) <= 3 || (scrollY >= max - 2 && r.top >= cb - 3 && r.top < innerHeight) };
  }, [target]);
  if (!m.ok) fail(`${label}: did not land on ${target} (${JSON.stringify(m)})`);
  return m;
}
const current = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((a) => a.getAttribute('href') || a.dataset.sec), sel);
const toBottom = async (page) => { await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await settle(page); };
const real = (page, sel) => page.locator(sel).first().click();

// The actions that take the reader from where they are to a target, per variant and size.
const ROUTES = {
  1: { desk: (t) => (t === 'top' ? ['.tb-logo'] : [`.tb-nav a[href="#${t}"]`]), phone: (t) => (t === 'top' ? ['.tb-logo'] : ['.tb-menu', `.tb-sheet a[href="#${t}"]`]), cur: '.tb-nav a[aria-current], .tb-sheet a[aria-current]' },
  2: { desk: (t) => (t === 'top' ? ['.ix-top'] : [`.ix-sec-a[href="#${t}"]`]), phone: (t) => ['.ix-fab', t === 'top' ? '.ix-sh-f a' : `.ix-sh-a[href="#${t}"]`], cur: '.ix-sec-a[aria-current], .ix-sh-a[aria-current]' },
  3: { desk: (t) => (t === 'top' ? ['.wn-last .wn-top-link'] : [`.wn-last a.wn-card[href="#${t}"], .wn-last .wn-path a[href="#${t}"]`]), cur: null },
};
ROUTES[3].phone = ROUTES[3].desk;

const SIZES = [[1440, 900, 'desktop'], [390, 844, 'phone']];
for (const [W, H, tag] of SIZES) {
  const desk = W > 900;
  for (const v of [1, 2, 3]) {
    const L = `${tag} v${v}`;
    const mm = (M[`${tag}-v${v}`] = { actions: {} });
    const page = await open(`v=${v}`, W, H);
    // ---------- Load ----------
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fail(`${L}: the page scrolls sideways`);
    await page.screenshot({ path: join(shots, `${tag}-v${v}-top.png`) });
    if (v === 1 && (await page.locator('.tb').getAttribute('data-shown')) !== 'false') fail(`${L}: the bar is shown over the hero's own top bar`);
    // ---------- Keyboard ----------
    if (v === 3) await page.locator('.day-end p').first().click();
    await page.keyboard.press('Tab');
    const kb = await page.evaluate((v) => {
      const a = document.activeElement;
      const host = a.closest(v === 1 ? '.tb' : v === 2 ? '.ix-rail, .ix-fab' : '.wn');
      const r = a.getBoundingClientRect(); const cs = getComputedStyle(a);
      const hostCs = host && getComputedStyle(host);
      return { host: !!host, what: a.className || a.tagName, visible: r.bottom > 0 && r.top < innerHeight && r.width > 0 && (!hostCs || hostCs.opacity !== '0'), ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 };
    }, v);
    await settle(page);
    const kb2 = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    if (!kb.host) fail(`${L}: the first Tab lands on ${kb.what}, not the navigation`);
    else if (!(kb.visible || kb2)) fail(`${L}: the focused navigation control is not visible`);
    else if (!kb.ring) fail(`${L}: no visible focus ring on ${kb.what}`);
    mm.keyboard = kb;
    await page.evaluate(() => document.activeElement.blur());
    // ---------- Reduced motion: no transitions on the chrome ----------
    const rm = await page.evaluate(() => [...document.querySelectorAll('.tb, .ix-rail, .ix-fab, .wn-up, .tb-nav a, .wn-card')].map((e) => getComputedStyle(e).transitionDuration).filter((d) => d.split(',').some((x) => parseFloat(x) > 0)));
    if (rm.length) fail(`${L}: transitions under reduced motion: ${rm.join(' | ')}`);
    // ---------- Story activation ----------
    const samples = await page.evaluate(() => {
      const id = (el) => { if (!el.id) el.id = `chk-${Math.random().toString(36).slice(2, 8)}`; return `#${el.id}`; };
      const alice = [...document.querySelector('.s1[data-story]').querySelectorAll(':scope > .s1-steps > .s1-step')];
      const carol = document.querySelector('#role-carol .s1-step:nth-child(2)');
      const cap = document.querySelector('.cap-g .s1 .s1-step:nth-child(2)') || document.querySelector('.cap-g .s1 .s1-step');
      return [['alice 1', id(alice[0])], ['alice 5', id(alice[4])], ['alice 12', id(alice[11])], ['carol 2', id(carol)], ['cap', id(cap)]];
    });
    mm.align = {};
    for (const [n, sel] of samples) {
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'start' }), sel);
      await settle(page);
      mm.align[n] = await aligned(page, sel, `${L} ${n}`);
      if (n === 'alice 5') await page.screenshot({ path: join(shots, `${tag}-v${v}-mid.png`) });
      if (n === 'carol 2') {
        await page.screenshot({ path: join(shots, `${tag}-v${v}-team.png`) });
        // aria-current follows the reader (v1, v2): in the team now.
        if (ROUTES[v].cur) { const c = await current(page, ROUTES[v].cur); if (!c.length || !c.every((h) => h === '#roles')) fail(`${L}: aria-current in the team section is ${JSON.stringify(c)}`); }
      }
    }
    // ---------- Anchors ----------
    const capLine = page.locator('a.cap-role[href^="#g-"]').first();
    if (await capLine.count()) {
      const href = await capLine.getAttribute('href');
      await capLine.evaluate((a) => a.scrollIntoView({ block: 'center' }));
      await settle(page);
      await capLine.click();
      await settle(page);
      mm.capLine = await aligned(page, href, `${L} capability line → ${href}`);
    } else fail(`${L}: no capability line points into a day`);
    // ---------- Two actions from the bottom ----------
    for (const t of ['top', ...SECTIONS]) {
      await toBottom(page);
      const steps = ROUTES[v][desk ? 'desk' : 'phone'](t);
      for (const s of steps) { await real(page, s); await page.waitForTimeout(60); }
      await settle(page);
      mm.actions[t] = { n: steps.length, ...(await landed(page, t, `${L} bottom → ${t}`)) };
      if (steps.length > 2) fail(`${L}: ${t} takes ${steps.length} actions from the bottom`);
      if (ROUTES[v].cur && t !== 'top') { const c = await current(page, ROUTES[v].cur); if (!c.length || !c.every((h) => h === `#${t}` || h === t)) fail(`${L}: after jumping to ${t}, aria-current is ${JSON.stringify(c)}`); }
      const sheetOpen = await page.evaluate(() => [...document.querySelectorAll('dialog')].some((d) => d.open));
      if (sheetOpen) fail(`${L}: the sheet stayed open after a jump to ${t}`);
    }
    if (v === 3) {
      const strips = await page.evaluate(() => [...document.querySelectorAll('.wn')].map((s) => s.querySelector('[aria-current]')?.getAttribute('href')));
      if (JSON.stringify(strips) !== JSON.stringify(['#day', '#roles', '#can', '#install'])) fail(`${L}: strips mark ${JSON.stringify(strips)} as current`);
      // The section heading sticks while its intro scrolls under it, and leaves with the intro.
      const head = await page.evaluate(async () => {
        const intro = document.getElementById('day'); const h = intro.querySelector('h2');
        scrollTo(0, intro.getBoundingClientRect().top + scrollY + 160);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const stuck = h.getBoundingClientRect().top;
        scrollTo(0, intro.getBoundingClientRect().bottom + scrollY + 200);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { stuck, after: h.getBoundingClientRect().bottom };
      });
      if (Math.abs(head.stuck) > 1) fail(`${L}: the day's heading does not stick (top ${head.stuck})`);
      if (head.after > 0) fail(`${L}: the day's heading did not leave with its intro`);
      await page.evaluate(() => { const i = document.getElementById('day'); scrollTo(0, i.getBoundingClientRect().top + scrollY + 160); });
      await settle(page);
      await page.screenshot({ path: join(shots, `${tag}-v${v}-head.png`) });
      mm.stickyHeading = head;
      // Scroll-up intent: from the capability groups, a little up shows Top; Top goes there.
      await page.evaluate(() => document.querySelectorAll('.cap-g')[3].scrollIntoView({ block: 'start' }));
      await settle(page);
      await page.mouse.move(W / 2, H / 2);
      await page.mouse.wheel(0, 200); await settle(page);
      if ((await page.locator('.wn-up').getAttribute('data-shown')) !== 'false') fail(`${L}: Top is shown while scrolling down`);
      await page.mouse.wheel(0, -120); await settle(page);
      if ((await page.locator('.wn-up').getAttribute('data-shown')) !== 'true') fail(`${L}: Top did not appear on scrolling up`);
      await page.screenshot({ path: join(shots, `${tag}-v${v}-up.png`) });
      await real(page, '.wn-up');
      await settle(page);
      mm.actions.upIntent = { n: 2, ...(await landed(page, 'top', `${L} scroll up + Top`)) };
    }
    // ---------- Near the end, and the open states ----------
    await page.evaluate(() => { const g = [...document.querySelectorAll('.cap-g')].pop(); g.scrollIntoView({ block: 'start' }); });
    await settle(page);
    await page.screenshot({ path: join(shots, `${tag}-v${v}-end.png`) });
    if (v === 3) { const s = page.locator('.wn').first(); await s.scrollIntoViewIfNeeded(); await settle(page); await s.screenshot({ path: join(shots, `${tag}-v${v}-open.png`) }); }
    if (v === 2 && desk) { await page.hover('.ix-kid >> nth=8'); await page.waitForTimeout(250); await page.screenshot({ path: join(shots, `${tag}-v${v}-open.png`) }); await page.mouse.move(W / 2, H / 2); }
    if (!desk && v !== 3) {
      const opener = v === 1 ? '.tb-menu' : '.ix-fab';
      await real(page, opener);
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(shots, `${tag}-v${v}-open.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      const st = await page.evaluate((o) => ({ open: [...document.querySelectorAll('dialog')].some((d) => d.open), back: document.activeElement === document.querySelector(o), exp: document.querySelector(o).getAttribute('aria-expanded') }), opener);
      if (st.open) fail(`${L}: Escape did not close the sheet`);
      if (!st.back) fail(`${L}: focus did not return to ${opener} after Escape`);
      if (st.exp !== 'false') fail(`${L}: ${opener} still says expanded`);
    }
    if (page.errors.length) fail(`${L}: console: ${[...new Set(page.errors)].join(' | ')}`);
    await page.context().close();
    // ---------- Hash loads ----------
    for (const hash of ['#role-carol', '#g-alice-video']) {
      const p = await open(`v=${v}`, W, H, { hash });
      const exists = await p.evaluate((h) => !!document.getElementById(h.slice(1)), hash);
      if (!exists) { if (hash !== '#g-alice-video') fail(`${L}: no ${hash}`); await p.context().close(); continue; }
      await p.waitForTimeout(300); await settle(p);
      if (hash.startsWith('#g-')) mm[`load${hash}`] = await aligned(p, hash, `${L} load at ${hash}`);
      else mm[`load${hash}`] = await landed(p, hash.slice(1), `${L} load at ${hash}`);
      if (p.errors.length) fail(`${L} ${hash}: console: ${p.errors.join(' | ')}`);
      await p.context().close();
    }
    // ---------- With motion: a smooth jump lands too ----------
    {
      const p = await open(`v=${v}`, W, H, { reduce: false });
      await toBottom(p);
      for (const s of ROUTES[v][desk ? 'desk' : 'phone']('roles')) { await real(p, s); await p.waitForTimeout(300); }
      await p.waitForTimeout(400); await settle(p, 8000);
      mm.smooth = await landed(p, 'roles', `${L} smooth jump to the team`);
      if (p.errors.length) fail(`${L} motion: console: ${p.errors.join(' | ')}`);
      await p.context().close();
    }
  }
  // ---------- Layout shift while reading, and section offsets ----------
  for (const q of ['nav=off', 'v=1', 'v=2', 'v=3']) {
    const p = await open(q, W, H);
    await p.evaluate(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: false }); });
    await p.mouse.move(W / 2, H / 2);
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 700) { await p.mouse.wheel(0, 700); await p.waitForTimeout(30); }
    await settle(p);
    const r = await p.evaluate(() => ({ cls: +window.__cls.toFixed(4), offsets: Object.fromEntries(['day', 'roles', 'can', 'install'].map((id) => [id, Math.round(document.getElementById(id).getBoundingClientRect().top - document.querySelector('.pg').getBoundingClientRect().top)])), height: document.documentElement.scrollHeight }));
    (M.shift ||= {})[`${tag} ${q}`] = r;
    if (p.errors.length) fail(`${tag} ${q} scroll pass: console: ${p.errors.join(' | ')}`);
    await p.context().close();
  }
  const base = M.shift[`${tag} nav=off`];
  for (const v of [1, 2]) {
    const r = M.shift[`${tag} v=${v}`];
    // Offsets are reported, not judged: variant 1's shorter rest room makes
    // each story's last step shorter by the bar (the engine's own formula),
    // a static difference, not a shift while reading. Variant 2 must match.
    if (v === 2) for (const id of SECTIONS) if (r.offsets[id] !== base.offsets[id]) fail(`${tag} v2: #${id} moved from ${base.offsets[id]} to ${r.offsets[id]} (the rail must not move the page)`);
    if (r.cls > base.cls + 0.01) fail(`${tag} v${v}: layout shift ${r.cls} against ${base.cls} without a variant`);
  }
  if (M.shift[`${tag} v=3`].cls > base.cls + 0.01) fail(`${tag} v3: layout shift ${M.shift[`${tag} v=3`].cls} against ${base.cls}`);
}

// ---------- In between ----------
for (const [W, H] of [[1024, 768], [700, 800]]) for (const v of [1, 2, 3]) {
  const L = `${W} v${v}`;
  const p = await open(`v=${v}`, W, H);
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fail(`${L}: the page scrolls sideways`);
  const sel = await p.evaluate(() => { const s = document.querySelectorAll('.s1[data-story] > .s1-steps > .s1-step')[6]; s.id ||= 'chk-mid'; s.scrollIntoView({ block: 'start' }); return `#${s.id}`; });
  await settle(p);
  (M.between ||= {})[L] = await aligned(p, sel, L);
  await p.screenshot({ path: join(shots, `${W}-v${v}-mid.png`) });
  if (p.errors.length) fail(`${L}: console: ${p.errors.join(' | ')}`);
  await p.context().close();
}

await browser.close();
writeFileSync(join(shots, 'measurements.json'), JSON.stringify(M, null, 1));
console.log(`measurements: ${join(shots, 'measurements.json')}`);
if (fails.length) { console.log(`\n${fails.length} failures`); process.exit(1); }
console.log('all checks pass');
