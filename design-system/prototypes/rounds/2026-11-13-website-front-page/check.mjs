// node check.mjs <offline.html> <out-dir> [--quick]
// Playwright comes from web/node_modules (PROTO_WEB=<dir with package.json
// and node_modules> to borrow another checkout's). Every direction at 1440
// in Päivä, Yö and Korkea kontrasti and at 390 in Päivä and Yö, reduced
// motion: its line is marked, nothing overflows, every text measures at least
// 4.5:1 (7:1 in Korkea kontrasti) against its own background, the hero is the
// direction's own composition. Then: each direction's default theme under a
// light, a dark and a more-contrast system; the intro and working marks
// running without reduced motion and still with it; the language and theme
// switches; brand.css still equal to the issue's CSS. Screenshots at device
// scale 2: <n>-<direction>-<width>-<theme>[-full].png, plus intro frames.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const round = '2026-11-13-website-front-page';
const [input, out, flag] = process.argv.slice(2);
const quick = flag === '--quick';
mkdirSync(out, { recursive: true });
const html = readFileSync(input, 'utf8');
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? { executablePath: process.env.PROTO_CHROMIUM } : {});
const names = ['hiljainen', 'yo', 'merkki'];
let checks = 0; const errors = [];
const ok = (v, m) => { assert.ok(v, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };

async function open(width, d, { theme = null, scheme = 'light', contrast = 'no-preference', motion = 'reduce', lang = 'en' } = {}) {
  const phone = width === 390;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 2, reducedMotion: motion, colorScheme: scheme, contrast, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('http://prototype.test/**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  const q = new URLSearchParams({ v: d + 1, lang, ...(theme ? { theme } : {}) });
  await page.goto(`http://prototype.test/?${q}`);
  await page.locator(`.wf[data-direction="${d}"]`).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(motion === 'reduce' ? 150 : 50);
  page.ctx = ctx;
  return page;
}
const close = (page) => page.ctx.close();
const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);

// Every element with its own text, against the first opaque background up the tree.
const lowContrast = (page, min) => page.evaluate((min) => {
  const rgb = (s) => { const m = s.match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bad = [];
  for (const el of document.querySelectorAll('.wf *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (el.closest('.wf-sr, option')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const fg = rgb(getComputedStyle(el).color); if (fg.length > 3 && fg[3] < 1) { bad.push(`${el.tagName}.${el.className}: translucent text`); continue; }
    let bg = null;
    for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && (c.length === 3 || c[3] === 1)) { bg = c; break; } if (c && c.length > 3 && c[3] > 0) { bad.push(`${el.tagName}.${el.className}: translucent background`); break; } }
    bg ||= rgb(getComputedStyle(document.documentElement).backgroundColor);
    const v = ratio(fg, bg);
    if (v < min) bad.push(`${el.tagName}.${el.className} "${el.textContent.trim().slice(0, 30)}" ${v.toFixed(2)}`);
  }
  return bad;
}, min);

async function assertDefault(page, d, tag, theme) {
  eq(await page.locator('.rq-lines li[aria-current]').count(), 1, `${names[d]} ${tag}: one line marked`);
  eq(await page.locator('.rq-lines li').nth(d).getAttribute('aria-current'), 'true', `${names[d]} ${tag}: its own line`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${names[d]} ${tag}: horizontal overflow`);
  const bad = await lowContrast(page, theme === 'contrast' ? 7 : 4.5);
  eq(bad.length, 0, `${names[d]} ${tag}: contrast ${bad.join(' | ')}`);
  // The difference is in the default view: each direction's own hero piece is above the fold.
  const sel = ['.wf-server', '.wf-console', '.wf-states'][d];
  const top = await page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top);
  ok(top < 844 || tag.startsWith('390'), `${names[d]} ${tag}: hero piece in view`);
  eq(await page.locator('.wf h1').count(), 1, `${names[d]}: one h1`);
  ok((await page.locator('.wf').innerText()).includes('0.1.0'), `${names[d]}: names the version`);
}

try {
  if (existsSync(join(root, 'issues/brand-themes-and-state-mark/item.md'))) {
    const issue = readFileSync(join(root, 'issues/brand-themes-and-state-mark/item.md'), 'utf8');
    const blocks = [...issue.matchAll(/```css\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
    const brand = readFileSync(join(here, 'brand.css'), 'utf8').split('\n').slice(3).join('\n');
    eq(brand.replace(/\s+/g, ''), blocks.replace(/\s+/g, ''), 'brand.css equals the issue CSS');
  }
  const matrix = quick ? [[1440, 'light']] : [[1440, 'light'], [1440, 'dark'], [1440, 'contrast'], [390, 'light'], [390, 'dark']];
  for (let d = 0; d < 3; d++) for (const [w, theme] of matrix) {
    const page = await open(w, d, { theme });
    if (theme === 'light') await checkPicker(page, round);
    eq(await themeOf(page), theme, `${names[d]} ${w}: theme applied`);
    await assertDefault(page, d, `${w}-${theme}`, theme);
    await page.screenshot({ path: `${out}/${d + 1}-${names[d]}-${w}-${theme}.png` });
    await close(page);
  }
  if (!quick) {
    // Full page in each direction's default look.
    for (let d = 0; d < 3; d++) for (const w of [1440, 390]) {
      const page = await open(w, d);
      await page.evaluate(() => { document.querySelector('.proto-picker').style.display = 'none'; });
      await page.screenshot({ path: `${out}/${d + 1}-${names[d]}-${w}-default-full.png`, fullPage: true });
      await close(page);
    }
    // Default themes: 1 and 3 follow the system, 2 is dark-first.
    const expect = { light: ['light', 'dark', 'light'], dark: ['dark', 'dark', 'dark'] };
    for (const scheme of ['light', 'dark']) for (let d = 0; d < 3; d++) {
      const page = await open(1440, d, { scheme });
      eq(await themeOf(page), expect[scheme][d], `${names[d]} under ${scheme} system`);
      await close(page);
    }
    for (let d = 0; d < 3; d++) {
      const page = await open(1440, d, { contrast: 'more' });
      eq(await themeOf(page), 'contrast', `${names[d]}: more contrast selects Korkea kontrasti`);
      await close(page);
    }
    // Motion: intro and working run, and stop with reduced motion.
    for (let d = 0; d < 3; d++) {
      const page = await open(1440, d, { motion: 'no-preference' });
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName));
      ok(running.includes('oh-turn'), `${names[d]}: the working mark moves`);
      if (d !== 2) ok(running.includes('oh-draw'), `${names[d]}: the header mark plays intro`);
      if (d === 2) {
        ok(running.includes('oh-draw') && running.includes('oh-orbit'), 'merkki: the hero mark draws itself and sub-agents orbit');
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${out}/3-merkki-1440-intro-frame-1.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${out}/3-merkki-1440-intro-frame-2.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
        // The intro runs once: after it the hero mark is the logo.
        await page.waitForTimeout(1200);
        ok(!(await page.evaluate(() => document.getAnimations().some((a) => a.playState === 'running' && a.animationName === 'oh-draw'))), 'merkki: intro plays once');
        // Replay re-runs it.
        await page.locator('.proto-picker-replay').click();
        await page.locator('.wf-bigmark').waitFor();
        await page.waitForTimeout(100);
        ok(await page.evaluate(() => document.getAnimations().some((a) => a.playState === 'running' && a.animationName === 'oh-draw')), 'merkki: replay plays intro again');
      }
      await close(page);
      const still = await open(1440, d);
      eq(await still.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length), 0, `${names[d]}: nothing runs with reduced motion`);
      if (d === 2) eq(await still.locator('.wf-st[data-state="waiting"] .oh-dot').evaluate((el) => getComputedStyle(el).transform !== 'none'), true, 'merkki: waiting still stands at the door with reduced motion');
      await close(still);
    }
    // Language and theme switches, then the picker.
    for (let d = 0; d < 3; d++) {
      const page = await open(1440, d);
      await page.locator('.wf-lang [data-lang="fi"]').click();
      ok((await page.locator('.wf h1').innerText()).includes('Linux-palvelimella'), `${names[d]}: Finnish`);
      eq(await page.locator('.wf').getAttribute('lang'), 'fi', `${names[d]}: lang attribute`);
      ok((await page.locator('.wf').innerText()).includes('varhainen esijulkaisu'), `${names[d]}: Finnish status`);
      for (const t of ['contrast', 'light', 'dark']) {
        await page.locator('#wf-theme').selectOption(t);
        eq(await themeOf(page), t, `${names[d]}: theme switch ${t}`);
      }
      const bad = await lowContrast(page, 4.5);
      eq(bad.length, 0, `${names[d]} fi dark: contrast ${bad.join(' | ')}`);
      await page.screenshot({ path: `${out}/${d + 1}-${names[d]}-1440-dark-fi.png` });
      await close(page);
    }
    const page = await open(1440, 0);
    await page.keyboard.press('3');
    await page.locator('.wf[data-direction="2"]').waitFor();
    eq(await page.locator('.proto-picker-item[data-active]').innerText(), 'Merkki kantaa', 'picker: key 3');
    await page.locator('.proto-picker-item', { hasText: 'Yö ensin' }).click();
    await page.locator('.wf[data-direction="1"]').waitFor();
    eq(await themeOf(page), 'dark', 'picker: Yö ensin brings its own default');
    await close(page);
  }
  eq(errors.length, 0, `console clean: ${errors.join(' | ')}`);
  console.log(`${checks} checks, console clean`);
} finally { await browser.close(); }
