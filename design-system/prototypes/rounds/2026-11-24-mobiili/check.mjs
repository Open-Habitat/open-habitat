// node check.mjs <out-dir> [<v1-out-dir>]
// Checks the page build.mjs wrote, with Playwright from web/node_modules
// (PROTO_WEB=<dir with package.json and node_modules> borrows another
// checkout's), at 390×844 and 360×740, each variant:
//   - the console is clean, nothing overflows sideways, the picker passes
//     picker-check.mjs;
//   - from several places on the page (and from inside a story), every
//     person's day and the install section are reached in at most two taps,
//     with real clicks on things that are in view and not covered;
//   - the page says whose day and which step wherever a step is on screen;
//   - the keyboard alone reaches every step in order, with a visible focus
//     ring; the steps on screen are in the accessibility tree in order;
//   - reduced motion: no transition or animation left on the layer's parts;
//   - switching variant, and leaving for the desktop width and coming back,
//     leaves nothing of the previous layer behind.
// With <v1-out-dir> (the v1 round built with its own build.mjs), 1440×900 is
// compared with it: the same .pg markup and the same pixels for every variant.
// Writes measure.json, screenshots (<vp>-v<n>-<name>.png) and a video per
// variant (video/v<n>.webm, 390×844) into <out-dir>/check/. Exits 1 on failures.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const { checkPicker } = await import(pathToFileURL(join(here, '../../picker-check.mjs')).href);
const [dir, v1dir] = process.argv.slice(2);
if (!dir || dir.startsWith('-')) { console.error('usage: node check.mjs <out-dir> [<v1-out-dir>]'); process.exit(2); }
const outDir = join(resolve(dir), 'check'); mkdirSync(join(outDir, 'video'), { recursive: true });
const url = pathToFileURL(join(resolve(dir), 'index.html')).href;
const ROUND = '2026-11-24-mobiili';
const VP = { 390: { width: 390, height: 844 }, 360: { width: 360, height: 740 } };
const PEOPLE = ['alice', 'bob', 'kirsi', 'carol', 'dave', 'erin', 'frank'];
const fails = []; const measure = {};
const fail = (m) => { fails.push(m); console.log(`FAIL ${m}`); };
const ok = (c, m) => { if (!c) fail(m); return c; };

const browser = await chromium.launch();
async function open(vp, v, { reduced = true, hash = '', video = false } = {}) {
  const ctx = await browser.newContext({ viewport: VP[vp] || vp, hasTouch: !!VP[vp], isMobile: !!VP[vp], reducedMotion: reduced ? 'reduce' : 'no-preference', ...(video ? { recordVideo: { dir: join(outDir, 'video'), size: VP[vp] } } : {}) });
  const page = await ctx.newPage();
  const tag = `${typeof vp === 'object' ? vp.width : vp} v${v}`;
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) fail(`${tag}: console ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => fail(`${tag}: page error: ${e.message}`));
  await page.goto(`${url}?v=${v}${hash}`);
  await page.waitForTimeout(250);
  return { ctx, page, tag };
}
// In view and on top: its centre is inside the viewport above the picker's
// band, and that point belongs to it.
const seen = (page, sel) => page.evaluate((s) => {
  const el = typeof s === 'string' ? document.querySelector(s) : null; if (!el) return false;
  const r = el.getBoundingClientRect(); const dock = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mb-dock')) || 0;
  const x = r.left + r.width / 2; const y = r.top + r.height / 2;
  if (!r.width || x < 0 || x > innerWidth || y < 0 || y > innerHeight - dock) return false;
  const hit = document.elementFromPoint(x, y); return !!hit && (el.contains(hit) || hit.contains(el));
}, sel);
// A tap: only on something the reader can see. No scrolling to find it.
async function tap(page, sel, tag) { if (!ok(await seen(page, sel), `${tag}: ${sel} is not in view to tap`)) return false; await page.click(sel, { timeout: 2000 }).catch((e) => fail(`${tag}: tap ${sel}: ${e.message.split('\n')[0]}`)); await page.waitForTimeout(60); return true; }
const scrollFrac = (page, f) => page.evaluate((x) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * x), f).then(() => page.waitForTimeout(80));
const stories = (page) => page.evaluate(() => [...document.querySelectorAll('.s1[data-story]')].map((s) => ({ key: s.dataset.story.replace(/^role-/, ''), n: s.querySelectorAll(':scope > .s1-steps > .s1-step').length, asks: [...s.querySelectorAll(':scope > .s1-steps > .s1-step .s1-txt .ask')].map((a) => a.textContent) })));

// ---------- What each variant must be able to say and do ----------
const V = {
  1: {
    name: 'valinta',
    // [taps to a person's day, what then identifies it]
    async person(page, id, tag) {
      let taps = 0;
      if (!(await seen(page, `.m1-card[data-open="${id}"]`))) { await tap(page, (await seen(page, '.m1-back')) ? '.m1-back' : '.m1-days', tag); taps++; }
      await tap(page, `.m1-card[data-open="${id}"]`, tag); taps++;
      const t = await page.textContent('.m1-title');
      ok(new RegExp(`^${id}’s Thursday · 1 / \\d+$`, 'i').test(t) && await seen(page, '.m1-title') && await seen(page, '.m1-cur .ask'), `${tag}: after choosing ${id} the page says "${t}"`);
      return taps;
    },
    async install(page, tag) { await tap(page, '.m1-install', tag); return 1; },
    async starts(page) { return [['top', () => scrollFrac(page, 0)], ['30 %', () => scrollFrac(page, 0.3)], ['60 %', () => scrollFrac(page, 0.6)], ['end', () => scrollFrac(page, 1)], ['inside Frank 2/3', async () => { await page.evaluate(() => { location.hash = '#/frank/2'; }); await page.waitForTimeout(80); await scrollFrac(page, 1); }], ['inside The web 1/2', async () => { await page.evaluate(() => { location.hash = '#/cap-web/1'; }); await page.waitForTimeout(80); await scrollFrac(page, 0.5); }]]; },
    reset: (page) => page.evaluate(() => { if (document.documentElement.dataset.m1) document.querySelector('.m1-back').click(); }),
  },
  2: {
    name: 'pyyhkaisy',
    async person(page, id, tag) {
      let taps = 0; const chip = `.m2-chip[data-id="${id}"]`;
      if (!(await seen(page, chip))) { await tap(page, '.m2-who', tag); taps++; }
      await tap(page, chip, tag); taps++;
      const t = await page.textContent('.m2-sw-days .m2-pos');
      ok(new RegExp(`^${id}’s Thursday · 1 / \\d+$`, 'i').test(t) && await seen(page, '.m2-sw-days .m2-pos') && await seen(page, '.m2-on .s1-step:first-child .s1-when'), `${tag}: after choosing ${id} the page says "${t}"`);
      return taps;
    },
    async install(page, tag) { await tap(page, '.m2-cta a.btn', tag); return 1; },
    async starts(page) { return [['top', () => scrollFrac(page, 0)], ['30 %', () => scrollFrac(page, 0.3)], ['in the capabilities', async () => { await page.evaluate(() => document.querySelector('.caps .m2-sw').scrollIntoView()); await page.waitForTimeout(80); await page.click('.m2-chip[data-id="cap-maps"]'); }], ['end', () => scrollFrac(page, 1)]]; },
    reset: async () => {},
  },
  3: {
    name: 'aikajana',
    async person(page, id, tag) {
      await tap(page, '.m3-who', tag); await tap(page, `.m3-menu [data-go="${id}"]`, tag);
      await page.waitForTimeout(120);
      const t = await page.textContent('.m3-who b');
      ok(t.toLowerCase() === id && await seen(page, '.m3-who') && await seen(page, `${id === 'alice' ? '.pg > .s1' : `#role-${id}`} .s1-step:first-child .m3-row`), `${tag}: after choosing ${id} the bar says "${t}"`);
      return 2;
    },
    async install(page, tag) { await tap(page, '.m3-install', tag); return 1; },
    async starts(page) { return [['top', () => scrollFrac(page, 0)], ['30 %', () => scrollFrac(page, 0.3)], ['60 %, a row open', async () => { await scrollFrac(page, 0.6); await page.evaluate(() => { const r = [...document.querySelectorAll('.m3-row')].find((x) => { const t = x.getBoundingClientRect().top; return t > 80 && t < 500; }); r?.click(); }); }], ['end', () => scrollFrac(page, 1)]]; },
    reset: (page) => page.evaluate(() => document.querySelectorAll('.m3-row[aria-expanded="true"]').forEach((r) => r.click())),
  },
};

async function twoTaps(vp, v) {
  const { ctx, page, tag } = await open(vp, v);
  const starts = await V[v].starts(page); let worst = 0;
  for (const [name, go] of starts) {
    for (const target of [...PEOPLE, 'install']) {
      await V[v].reset(page); await go();
      const t = `${tag} from ${name} to ${target}`;
      const taps = target === 'install' ? await V[v].install(page, t) : await V[v].person(page, target, t);
      if (target === 'install') { await page.waitForTimeout(120); ok(await page.evaluate(() => { const r = document.querySelector('#install').getBoundingClientRect(); return r.top < innerHeight * 0.5 && r.bottom > 100; }), `${t}: the install section is not on screen`); }
      ok(taps <= 2, `${t}: ${taps} taps`); worst = Math.max(worst, taps);
    }
  }
  await ctx.close();
  return { starts: starts.length, worst };
}

// ---------- Whose day and which step, everywhere ----------
async function whereAmI(vp, v) {
  const { ctx, page, tag } = await open(vp, v);
  const S = await stories(page); let said = 0;
  if (v === 1) {
    // Next from the first card walks every step of every story to the install section.
    await page.evaluate(() => document.querySelector('#m1-people').scrollIntoView()); await tap(page, '.m1-card[data-open="alice"]', tag);
    for (const s of S) for (let i = 0; i < s.n; i++) {
      const t = await page.textContent('.m1-title'); const ask = await page.textContent('.m1-cur .s1-txt .ask');
      ok(t.endsWith(`· ${i + 1} / ${s.n}`) && ask === s.asks[i] && await seen(page, '.m1-title'), `${tag}: ${s.key} step ${i + 1}: title "${t}"`); said++;
      ok(await page.evaluate(() => Math.abs(document.querySelector('.pg').getBoundingClientRect().top) < 2), `${tag}: ${s.key} step ${i + 1} does not open at its top`);
      await page.click('.m1-next');
    }
    ok(await page.evaluate(() => !document.documentElement.dataset.m1 && document.querySelector('#install').getBoundingClientRect().top < innerHeight * 0.5), `${tag}: Next after the last step does not end at install`);
  }
  if (v === 2) {
    for (const s of S) {
      await page.evaluate((k) => document.querySelector(`.m2-chip[data-id="${k}"]`).click(), s.key);
      const bar = s.key.startsWith('cap-') ? '.caps .m2-sw' : '.m2-sw-days';
      await page.evaluate((b) => document.querySelector(b).scrollIntoView(), bar);
      for (let i = 0; i < s.n; i++) {
        // A swipe: the deck is dragged to the next card and let go.
        if (i) { await page.evaluate(([k, j]) => { const d = document.querySelector(`.s1[data-story$="${k}"] > .s1-steps`); d.scrollTo({ left: d.children[j].offsetLeft - 60 }); }, [s.key, i]); await page.waitForTimeout(140); }
        const t = await page.textContent(`${bar} .m2-pos`);
        ok(t.endsWith(`· ${i + 1} / ${s.n}`) && await seen(page, `${bar} .m2-pos`), `${tag}: ${s.key} card ${i + 1}: indicator "${t}"`); said++;
        ok(await seen(page, `.s1[data-story$="${s.key}"] .s1-step:nth-child(${i + 1}) .ask`), `${tag}: ${s.key} card ${i + 1} is not the one on screen`);
      }
    }
  }
  if (v === 3) {
    const rows = await page.evaluate(() => [...document.querySelectorAll('.m3-row')].map((r) => ({ time: r.querySelector('.m3-time').textContent, who: r.closest('.role')?.querySelector('.role-h h3').textContent || (r.closest('.cap-g') ? r.closest('.cap-g').querySelector('.cap-gh h3').textContent : 'Alice') })));
    for (let i = 0; i < rows.length; i++) {
      await page.evaluate((j) => { const r = document.querySelectorAll('.m3-row')[j]; r.scrollIntoView({ block: 'center' }); r.click(); }, i); await page.waitForTimeout(60);
      const who = await page.textContent('.m3-who b'); const now = await page.textContent('.m3-now');
      ok(who === rows[i].who && (!rows[i].time || now.startsWith(rows[i].time)) && await seen(page, '.m3-who'), `${tag}: row ${i + 1} open (${rows[i].who} ${rows[i].time}): bar says "${who} · ${now}"`); said++;
      ok(await page.evaluate((j) => { const s = document.querySelectorAll('.m3-row')[j].closest('.s1-step'); return s.querySelector('.s1-inline').offsetHeight > 100 && s.parentElement.querySelectorAll('.m3-open').length === 1; }, i), `${tag}: row ${i + 1} does not open its screen alone`);
    }
  }
  await ctx.close();
  return said;
}

// ---------- Keyboard and the accessibility tree ----------
async function keyboard(vp, v) {
  const { ctx, page, tag } = await open(vp, v);
  const S = await stories(page); const all = S.flatMap((s) => s.asks);
  const ring = () => page.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2; });
  const focusKey = () => page.evaluate(() => { const a = document.activeElement; return a.closest('.s1-step') ? [...document.querySelectorAll('.s1-step')].indexOf(a.closest('.s1-step')) : -1; });
  let reached = 0;
  if (v === 1) {
    await page.focus('.m1-card[data-open="alice"]'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    ok(await ring(), `${tag}: a person card has no visible focus`);
    await page.keyboard.press('Enter');
    for (const ask of all) {
      ok(await page.evaluate(() => document.activeElement.textContent) === ask, `${tag}: keyboard: focus is not on step "${ask.slice(0, 40)}"`); reached++;
      // From the step's heading, Tab leads on through the screen to Next.
      for (let k = 0; k < 60 && !(await page.evaluate(() => document.activeElement.matches('.m1-next'))); k++) await page.keyboard.press('Tab');
      if (reached === 1) ok(await ring(), `${tag}: Next has no visible focus`);
      await page.keyboard.press('Enter');
    }
  } else {
    // Tab from the top of the page; each step is met in page order. In 2 only
    // the chosen person's deck is on the page, so every chip is chosen in turn.
    const picks = v === 2 ? S.map((s) => s.key) : [null];
    const met = [];
    for (const k of picks) {
      if (k) await page.evaluate((id) => document.querySelector(`.m2-chip[data-id="${id}"]`).click(), k);
      const want = v === 2 ? `.s1[data-story$="${k}"] .m2-more` : '.m3-row';
      const n = await page.locator(want).count();
      await page.evaluate((w) => { const f = document.querySelector(w); f.focus(); }, want);
      await page.keyboard.press('Shift+Tab');
      const got = [];
      for (let t = 0; t < 400 && got.length < n; t++) { await page.keyboard.press('Tab'); if (await page.evaluate((w) => document.activeElement.matches(w), want)) { got.push(await focusKey()); if (got.length === 1) ok(await ring(), `${tag}: a step control has no visible focus`); if (v === 2) await page.waitForTimeout(120); /* a card left behind closes first */ if (v === 2 && !(await seen(page, ':focus'))) fail(`${tag}: ${k}: the focused card is not brought on screen: ${await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return JSON.stringify([Math.round(r.left), Math.round(r.top), Math.round(r.width), h?.className, got => 0].slice(0, 4)) + ' step ' + [...document.activeElement.closest('.s1-steps').children].indexOf(document.activeElement.closest('.s1-step')); })}`); } }
      ok(got.length === n && got.every((x, i) => !i || x > got[i - 1]), `${tag}: keyboard: ${k || 'the page'} reaches ${got.length} of ${n} steps in order`);
      met.push(...got);
      if (v === 3) { await page.keyboard.press('Enter'); ok(await page.evaluate(() => document.activeElement.getAttribute('aria-expanded') === 'true'), `${tag}: Enter does not open a row`); }
    }
    reached = met.length;
    ok(reached === all.length, `${tag}: keyboard reached ${reached} of ${all.length} steps`);
    // The steps on the page are in the accessibility tree in page order.
    const tree = await page.locator('.pg').ariaSnapshot();
    const shown = v === 2 ? S.filter((s) => ['frank', 'cap-web'].includes(s.key)).flatMap((s) => s.asks) : all; // 2: the last chips chosen
    let at = -1; let inTree = 0;
    for (const a of shown) { const i = tree.indexOf(a.replace(/^“|”$/g, '').slice(0, 28), at + 1); if (i > at) { at = i; inTree++; } }
    ok(inTree === shown.length, `${tag}: accessibility tree has ${inTree} of ${shown.length} asks in order`);
  }
  await ctx.close();
  return reached;
}

// ---------- Reduced motion; switching; leaving for the desktop ----------
async function calm(vp, v) {
  const { ctx, page, tag } = await open(vp, v);
  if (v === 3) await page.click('.m3-who');
  const moving = await page.evaluate(() => [...document.querySelectorAll('[class^="m1-"], [class^="m2-"], [class^="m3-"], [class*=" m2-"], [class*=" m3-"]')].filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && (parseFloat(c.transitionDuration) > 0 || c.animationName !== 'none'); }).map((e) => e.className));
  ok(!moving.length, `${tag}: reduced motion: still moving: ${[...new Set(moving)].join(', ')}`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: the page overflows sideways`);
  await checkPicker(page, ROUND).catch((e) => fail(`${tag}: ${e.message}`));
  measure[`${tag} height`] = await page.evaluate(() => document.documentElement.scrollHeight);
  await ctx.close();
}
const LEFT = '[class^="m1-"], [class^="m2-"], [class^="m3-"], [class*=" m1-"], [class*=" m2-"], [class*=" m3-"], [class*=" mb-cta"], .mb-cta';
async function cleanSwitch() {
  const { ctx, page } = await open(390, 1);
  const pristine = async () => (await page.evaluate((sel) => ({ left: document.querySelectorAll(sel).length, on: document.documentElement.classList.contains('mb-on'), m1: 'm1' in document.documentElement.dataset }), LEFT));
  await page.evaluate(() => { location.hash = '#/carol/2'; }); await page.waitForTimeout(80);
  // 1 → 2 → 3 → 1 with the picker's keys, then to the desktop width.
  for (const k of ['2', '3', '1']) {
    await page.keyboard.press(k); await page.waitForTimeout(120);
    const other = { 1: ['m2-', 'm3-'], 2: ['m1-', 'm3-'], 3: ['m1-', 'm2-'] }[k];
    const stray = await page.evaluate((o) => [...document.querySelectorAll('.pg *')].filter((e) => [...e.classList].some((c) => o.some((p) => c.startsWith(p)))).length, other);
    ok(stray === 0 && (await page.evaluate(() => document.documentElement.dataset.v)) === k, `switch to ${k}: ${stray} parts of another variant left`);
    if (k !== '1') ok(!(await pristine()).m1, `switch to ${k}: variant 1's story state left on the page`);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(150);
  const p = await pristine();
  ok(p.left === 0 && !p.on, `at 1440 after the phone: ${p.left} layer parts left, mb-on ${p.on}`);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.s1-app')).display !== 'none' && document.querySelector('#day').parentElement.classList.contains('pg') && document.querySelector('.day-end').parentElement.classList.contains('pg')), 'at 1440 after the phone: the page is not back in v1 order');
  await ctx.close();
}

// ---------- The desktop is the v1 page ----------
async function desktopSame() {
  const vp = { width: 1440, height: 900 }; const res = {};
  const grab = async (u) => {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => fail(`1440 ${u.split('/').slice(-2).join('/')}: ${e.message}`));
    // The harness chrome (the line above the page, the picker) is taken out
    // before the first layout: hidden afterwards, the page has already been
    // rastered at the offset the line gave it, and faded text keeps that.
    await page.addInitScript(() => { const st = document.createElement('style'); st.textContent = '.mb-head, .mb-dock, .proto-picker { display: none !important } video { visibility: hidden !important }'; const put = () => { if (!document.head) return false; document.head.append(st); return true; }; if (!put()) new MutationObserver((_, o) => { if (put()) o.disconnect(); }).observe(document, { childList: true, subtree: true }); });
    await page.goto(u); await page.waitForTimeout(400);
    const html = await page.evaluate(() => document.querySelector('.pg').innerHTML.replace(/\s+/g, ' '));
    const shots = [];
    for (const f of [0, 0.08, 0.2, 0.45, 0.7, 0.9, 1]) { await page.evaluate((x) => scrollTo(0, Math.round((document.documentElement.scrollHeight - innerHeight) * x)), f); await page.waitForTimeout(350); shots.push((await page.screenshot()).toString('base64')); }
    const h = await page.evaluate(() => document.querySelector('.pg').offsetHeight);
    await ctx.close(); return { html, shots, h };
  };
  const base = await grab(pathToFileURL(join(resolve(v1dir), 'index.html')).href);
  // A place where v1 does not match itself between two loads (something on
  // the page moves on its own) proves nothing either way; it is left out and reported.
  const again = await grab(pathToFileURL(join(resolve(v1dir), 'index.html')).href);
  const steady = base.shots.map((s, i) => s === again.shots[i]);
  res.unsteadyInV1 = steady.map((x, i) => (x ? null : i)).filter((x) => x !== null);
  for (const v of [1, 2, 3]) {
    let mine = await grab(`${url}?v=${v}`);
    // The same unsteadiness can fall on our load instead of v1's two: one more look.
    if (mine.shots.some((s, i) => steady[i] && s !== base.shots[i])) { const more = await grab(`${url}?v=${v}`); mine = { ...mine, shots: mine.shots.map((s, i) => (s === base.shots[i] ? s : more.shots[i])) }; }
    ok(mine.html === base.html, `1440 v${v}: the page's markup differs from v1`);
    ok(mine.h === base.h, `1440 v${v}: the page is ${mine.h}px tall, v1 is ${base.h}px`);
    const diff = mine.shots.filter((s, i) => steady[i] && s !== base.shots[i]).length;
    ok(diff === 0, `1440 v${v}: ${diff} of ${steady.filter(Boolean).length} screenshots differ from v1`);
    res[`v${v}`] = { height: mine.h, v1: base.h, screenshotsIdentical: steady.filter(Boolean).length - diff };
  }
  return res;
}

// ---------- Screenshots and a video, with motion as a reader has it ----------
async function show(vp, v, video) {
  const { ctx, page } = await open(vp, v, { reduced: false, video });
  const shot = async (n) => { await page.waitForTimeout(video ? 700 : 450); await page.screenshot({ path: join(outDir, `${vp}-v${v}-${n}.png`) }); };
  const into = (sel, block = 'start') => page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ block: b, behavior: 'smooth' }), [sel, block]);
  await shot('1-top');
  if (v === 1) {
    await page.click('.m1-days'); await shot('2-choosing');
    await page.click('.m1-card[data-open="carol"]'); await shot('3-story-first');
    await page.click('.m1-next'); await shot('4-mid-story');
    await page.mouse.wheel(0, 700); await shot('5-mid-story-screen');
    await page.click('.m1-next'); await page.evaluate(() => scrollTo({ top: 1e6, behavior: 'smooth' })); await shot('6-end');
    await page.click('.m1-back'); await into('.m1-capchoose'); await shot('7-capabilities');
  }
  if (v === 2) {
    await page.click('.m2-who'); await shot('2-choosing');
    await page.click('.m2-chip[data-id="carol"]'); await shot('3-story-first');
    await page.click('.m2-sw-days .m2-next'); await shot('4-mid-story');
    await page.click('.m2-on .s1-step:nth-child(2) .m2-more'); await page.mouse.wheel(0, 500); await shot('5-mid-story-screen');
    await page.click('.m2-who'); await page.waitForTimeout(700); await page.click('.m2-sw-days .m2-next'); await page.waitForTimeout(500); await page.click('.m2-sw-days .m2-next'); await shot('6-end');
    await into('.caps .m2-sw'); await shot('7-capabilities');
  }
  if (v === 3) {
    await page.click('.m3-who'); await shot('2-choosing');
    await page.click('.m3-menu [data-go="alice"]'); await shot('3-story-first');
    await page.mouse.wheel(0, 420); await page.waitForTimeout(300); await page.click('.pg > .s1 .s1-step:nth-child(8) .m3-row'); await shot('4-mid-story');
    await page.mouse.wheel(0, 500); await shot('5-mid-story-screen');
    await into('.day-end', 'center'); await shot('6-end');
    await into('#cap-av'); await page.waitForTimeout(900); await shot('7-capabilities');
  }
  const vid = page.video(); await ctx.close();
  if (vid) { const p = await vid.path(); if (existsSync(p)) renameSync(p, join(outDir, 'video', `v${v}.webm`)); }
}

for (const vp of [390, 360]) for (const v of [1, 2, 3]) {
  await calm(vp, v);
  const t = await twoTaps(vp, v);
  measure[`${vp} v${v} taps`] = `at most ${t.worst} from ${t.starts} places to each of 7 people and install`;
  measure[`${vp} v${v} identified`] = `${await whereAmI(vp, v)} steps`;
  measure[`${vp} v${v} keyboard`] = `${await keyboard(vp, v)} steps in order`;
  await show(vp, v, vp === 390);
  console.log(`${vp} v${v} ${V[v].name}: ${measure[`${vp} v${v} height`]}px · ${measure[`${vp} v${v} taps`]} · ${measure[`${vp} v${v} identified`]} identified · keyboard ${measure[`${vp} v${v} keyboard`]}`);
}
await cleanSwitch();
if (v1dir) { measure.desktop = await desktopSame(); console.log(`1440: ${JSON.stringify(measure.desktop)}`); } else console.log('1440 not compared: no <v1-out-dir> given');
await browser.close();
writeFileSync(join(outDir, 'measure.json'), JSON.stringify({ measure, fails }, null, 1));
console.log(fails.length ? `${fails.length} failures` : 'ok');
process.exit(fails.length ? 1 : 0);
