// node check.mjs <built.html> <out-dir>
// Playwright from web/node_modules (PROTO_WEB=<dir with package.json and
// node_modules> borrows another checkout's). Each story at 1440 and 390:
// the floating picker holds (picker-check.mjs); the hero image is centred
// under the headline and whole; nothing pokes past the viewport; no request
// leaves the file; the console is clean; no two visible text boxes of the page
// overlap; nothing inside a drawn screen is wider than the screen; on desktop
// the fixed screen follows every chapter (frame, clock) and each frame's
// conversation reaches the composer without being cut at the bottom; on the
// phone every chapter carries its own screen; following a thread marks the
// chapters where it appears; the picker does not cover the end of the page;
// switching shows the next story from the top.
// Writes <n>-<width>-top.png, -s<k>.png per scene, -follow.png and -end.png.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';

const ROUND = '2026-11-20-alicen-paiva-a';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const [input, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const html = readFileSync(input, 'utf8');
const browser = await chromium.launch();
const errors = [];
const settle = (page, ms = 400) => page.waitForTimeout(ms);

for (const width of [1440, 390]) {
  for (const d of [0, 1, 2]) {
    const tag = `${d + 1}@${width}`;
    const phone = width === 390;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${tag} ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} ${m.text()}`); });
    await page.route('**/*', (r) => (r.request().url().startsWith('http://prototype.test/') ? r.fulfill({ contentType: 'text/html', body: html }) : (errors.push(`network: ${r.request().url()}`), r.abort())));
    await page.goto(`http://prototype.test/?v=${d + 1}`);
    await page.locator(`.s${d + 1}`).waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
    await settle(page);
    await checkPicker(page, ROUND);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-top.png`) });

    const hero = await page.evaluate(() => {
      const img = document.querySelector('.hero-img').getBoundingClientRect();
      const h1 = document.querySelector('.hero h1').getBoundingClientRect();
      return { l: img.left, r: img.right, h1c: h1.left + h1.width / 2, vw: innerWidth };
    });
    assert.ok(hero.l >= 0 && hero.r <= hero.vw + 0.5, `${tag}: hero image not whole`);
    assert.ok(Math.abs((hero.l + hero.r) / 2 - hero.vw / 2) <= 1, `${tag}: hero image off centre`);
    assert.ok(Math.abs(hero.h1c - hero.vw / 2) <= 1, `${tag}: headline off centre`);

    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: horizontal overflow`);
    const wide = await page.evaluate(() => [...document.querySelectorAll('.pg h1, .pg h2, .pg h3, .pg p, .pg li, .pg blockquote, .pg .fl')]
      .filter((e) => !e.closest('.sc-win, .sc-phone') && e.getClientRects().length)
      .filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; })
      .map((e) => `${e.tagName}.${e.className} "${e.textContent.slice(0, 30)}"`).slice(0, 6));
    assert.deepEqual(wide, [], `${tag}: past the viewport ${wide.join(' | ')}`);

    // Page text (outside the drawn screens) never overlaps.
    const overlaps = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.pg h1, .pg h2, .pg h3, .pg p, .pg li, .pg blockquote, .pg .fl, .pg .ch-inline')].filter((e) => !e.closest('.sc-win, .sc-phone, .screen') && e.getClientRects().length);
      const bad = [];
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
        const a = els[i], b = els[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 2 && y > 2) bad.push(`${a.tagName}.${a.className} × ${b.tagName}.${b.className} "${a.textContent.slice(0, 30)}"`);
      }
      return bad.slice(0, 8);
    });
    assert.equal(overlaps.length, 0, `${tag}: overlap ${overlaps.join(' | ')}`);

    // Inside every visible drawn screen: nothing wider than the conversation column.
    const screenCheck = () => page.evaluate(() => {
      const bad = [];
      const shown = [...document.querySelectorAll(innerWidth > 900 ? '.frame.on' : '.ch-inline')];
      for (const s of shown) for (const body of s.querySelectorAll('.sc-body')) {
        const b = body.getBoundingClientRect();
        for (const e of body.querySelectorAll('.sc-col > *, .sc-col .tool, .sc-col .md-table, .sc-col .sc-card')) {
          const r = e.getBoundingClientRect();
          if (r.width && (r.right > b.right + 1 || r.left < b.left - 1)) bad.push(`${e.className} "${e.textContent.slice(0, 40)}"`);
        }
        // The conversation ends just above the composer: its last element is whole.
        const last = body.querySelector('.sc-col').lastElementChild.getBoundingClientRect();
        if (last.bottom > b.bottom + 1) bad.push(`last element cut at the bottom`);
      }
      return bad.slice(0, 6);
    });

    const scenes = await page.locator('.ch').count();
    if (!phone) {
      // Back above the first chapter, the screen is the first scene again.
      await page.locator('.ch').last().scrollIntoViewIfNeeded();
      await settle(page, 250);
      await page.locator('.intro').evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY));
      await settle(page, 250);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('.frame')].findIndex((f) => f.classList.contains('on'))), 0, `${tag}: back at the intro, the first scene`);
      for (let k = 0; k < scenes; k++) {
        await page.locator('.ch').nth(k).evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY + e.offsetHeight / 2 - innerHeight / 2));
        await settle(page, 250);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.frame')].findIndex((f) => f.classList.contains('on'))), k, `${tag}: screen follows chapter ${k + 1}`);
        assert.equal(await page.locator('.frame.on').count(), 1, `${tag}: one frame on`);
        const t = await page.locator('.ch').nth(k).locator('.ch-time span').textContent();
        assert.equal(await page.locator('.clock b').textContent(), t, `${tag}: clock follows chapter ${k + 1}`);
        const bad = await screenCheck();
        assert.deepEqual(bad, [], `${tag} scene ${k + 1}: ${bad.join(' | ')}`);
        await page.screenshot({ path: join(out, `${d + 1}-${width}-s${k + 1}.png`) });
      }
    } else {
      assert.equal(await page.locator('.ch-inline:visible').count(), scenes, `${tag}: every chapter has its screen`);
      const bad = await screenCheck();
      assert.deepEqual(bad, [], `${tag}: ${bad.join(' | ')}`);
      for (let k = 0; k < scenes; k++) {
        await page.locator('.ch-inline').nth(k).scrollIntoViewIfNeeded();
        await settle(page, 150);
        await page.locator('.ch').nth(k).screenshot({ path: join(out, `${d + 1}-${width}-s${k + 1}.png`) });
      }
    }

    // Following a thread marks exactly the chapters that carry it.
    const btn = page.locator('.fl').nth(1);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    assert.equal(await btn.getAttribute('aria-pressed'), 'true', `${tag}: follow pressed`);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-follow.png`) });
    const lit = await page.evaluate(() => { const k = document.querySelector('.story').dataset.follow; const chs = [...document.querySelectorAll('.ch')]; return { lit: chs.filter((c) => c.classList.contains('lit')).length, want: chs.filter((c) => c.dataset.threads.split(' ').includes(k)).length }; });
    assert.ok(lit.lit >= 2 && lit.lit === lit.want, `${tag}: thread marks ${lit.lit}/${lit.want}`);
    await btn.click();
    assert.equal(await page.locator('.ch.lit').count(), 0, `${tag}: follow off`);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const end = await page.evaluate(() => ({ foot: [...document.querySelectorAll('.pgfoot > *')].reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0), picker: document.querySelector('.proto-picker').getBoundingClientRect().top }));
    assert.ok(end.foot <= end.picker, `${tag}: picker covers the footer`);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-end.png`) });

    await page.locator('.proto-picker-item').nth((d + 1) % 3).click();
    await page.locator(`.s${((d + 1) % 3) + 1}`).waitFor();
    await settle(page);
    assert.ok(await page.evaluate(() => scrollY < 2), `${tag}: next story starts at the top`);
    await ctx.close();
  }
}
await browser.close();
assert.deepEqual(errors, [], errors.join('\n'));
console.log('ok');
