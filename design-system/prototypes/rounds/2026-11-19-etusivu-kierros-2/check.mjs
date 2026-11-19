// node check.mjs <built.html> <out-dir>
// Playwright from web/node_modules (PROTO_WEB=<dir with package.json and
// node_modules> borrows another checkout's). Each variant at 1440 and 390:
// the floating picker holds (picker-check.mjs); the hero image is centred
// under the headline and whole; nothing outside a sideways scroller pokes past
// the viewport; no request leaves the file; the console is clean; no two
// visible text or picture boxes overlap; the picker does not cover the end of
// the page; and each variant's own interaction works (the story's screen
// follows the chapter, the filmstrip steps, the request tabs switch by click
// and by arrow key without flipping the picker, the copy button answers).
// Writes <n>-<width>-top.png, -hero.png and -end.png.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';

const ROUND = '2026-11-19-etusivu-kierros-2';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const [input, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const html = readFileSync(input, 'utf8');
const browser = await chromium.launch();
const errors = [];
const settle = (page) => page.waitForTimeout(400);

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
    await page.locator(`.d${d + 1}`).waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
    await settle(page);
    await checkPicker(page, ROUND);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-top.png`) });

    // The hero image: centred on the headline's axis, whole, on a band with no visible edge.
    const hero = await page.evaluate(() => {
      const img = document.querySelector('.hero-img').getBoundingClientRect();
      const h1 = document.querySelector('.hero h1').getBoundingClientRect();
      return { l: img.left, r: img.right, w: img.width, h1c: h1.left + h1.width / 2, vw: innerWidth };
    });
    assert.ok(hero.l >= 0 && hero.r <= hero.vw + 0.5, `${tag}: hero image not whole (${hero.l}–${hero.r})`);
    assert.ok(Math.abs((hero.l + hero.r) / 2 - hero.vw / 2) <= 1, `${tag}: hero image off centre`);
    assert.ok(Math.abs(hero.h1c - hero.vw / 2) <= 1, `${tag}: headline off centre`);
    await page.locator('.hero-band').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(out, `${d + 1}-${width}-hero.png`) });

    // Nothing pokes past the viewport, except inside a sideways scroller.
    const wide = await page.evaluate(() => [...document.querySelectorAll('.pg h1, .pg h2, .pg h3, .pg p, .pg li, .pg dt, .pg dd, .pg figcaption, .pg img, .pg pre, .pg .msg')]
      .filter((e) => !e.closest('.d2-film-track, .d3-tabs, pre') && e.getClientRects().length)
      .filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; })
      .map((e) => `${e.tagName}.${e.className} "${(e.textContent || e.alt || '').slice(0, 30)}"`).slice(0, 6));
    assert.deepEqual(wide, [], `${tag}: past the viewport ${wide.join(' | ')}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: horizontal overflow`);

    // No two visible boxes overlap (hidden frames of the story and tabs excluded).
    const overlaps = await page.evaluate(() => {
      const shown = (e) => { if (e.closest('details:not([open]) > :not(summary)')) return false; for (let n = e; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false; } return true; };
      const els = [...document.querySelectorAll('.pg h1, .pg h2, .pg h3, .pg p, .pg li, .pg dt, .pg dd, .pg figcaption, .pg pre, .pg img, .pg .copy')].filter(shown);
      // What shows of a box is its rect clipped by every ancestor that clips overflow.
      const clipped = (e) => {
        const r = e.getBoundingClientRect(); let { left, right, top, bottom } = r;
        for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const c = n.getBoundingClientRect(); left = Math.max(left, c.left); right = Math.min(right, c.right); top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); }
        }
        return { left, right, top, bottom, width: right - left, height: bottom - top };
      };
      const boxes = els.map((e) => [e, clipped(e)]).filter(([, r]) => r.width > 0 && r.height > 0);
      const bad = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, ra] = boxes[i], [b, rb] = boxes[j];
        if (a.contains(b) || b.contains(a)) continue;
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 2 && y > 2) bad.push(`${a.tagName}.${a.className} × ${b.tagName}.${b.className} "${(a.textContent || a.alt || '').slice(0, 30)}"`);
      }
      return bad.slice(0, 8);
    });
    assert.equal(overlaps.length, 0, `${tag}: overlap ${overlaps.join(' | ')}`);

    // Each variant's own interaction.
    if (d === 0 && !phone) {
      await page.locator('.d1-ch').nth(4).evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY + e.offsetHeight / 2 - innerHeight / 2));
      await settle(page);
      assert.equal(await page.locator('.d1-frame.on').getAttribute('class'), 'd1-frame on', `${tag}: one frame on`);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('.d1-frame')].findIndex((f) => f.classList.contains('on'))), 4, `${tag}: screen follows chapter`);
      assert.match(await page.locator('.d1-clock b').textContent(), /10:20/, `${tag}: clock follows chapter`);
      const fr = await page.evaluate(() => { const box = document.querySelector('.d1-frames').getBoundingClientRect(); const img = document.querySelector('.d1-frame.on img').getBoundingClientRect(); return img.top >= box.top - 1 && img.bottom <= box.bottom + 1 && img.left >= box.left - 1 && img.right <= box.right + 1; });
      assert.ok(fr, `${tag}: story picture inside its screen`);
      await page.screenshot({ path: join(out, `${d + 1}-${width}-story.png`) });
    }
    if (d === 1) {
      const pos = page.locator('.d2-film-pos');
      await page.locator('.d2-film').scrollIntoViewIfNeeded();
      await page.locator('.d2-film-btn[data-dir="1"]').click();
      await page.waitForFunction(() => document.querySelector('.d2-film-pos').textContent.startsWith('2 '));
      assert.equal(await page.locator('.d2-film-btn[data-dir="-1"]').isDisabled(), false, `${tag}: back enabled`);
      await page.screenshot({ path: join(out, `${d + 1}-${width}-film.png`) });
      if (!phone) {
        await page.locator('#apart').evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 40));
        await settle(page);
        assert.equal(await page.locator('.d2-toc a[aria-current]').getAttribute('data-q'), 'apart', `${tag}: index follows`);
      }
      void pos;
    }
    if (d === 2) {
      await page.locator('[role=tab]').nth(3).click();
      await settle(page);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('.d3-shot')].findIndex((s) => s.classList.contains('on'))), 3, `${tag}: tab click`);
      await page.keyboard.press(phone ? 'ArrowRight' : 'ArrowDown');
      await settle(page);
      assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('data-i'), '4', `${tag}: arrow moves the tab`);
      assert.equal(await page.locator('.proto-picker-item[data-active]').textContent(), 'Tutki itse', `${tag}: arrow must not flip the picker`);
      await page.screenshot({ path: join(out, `${d + 1}-${width}-try.png`) });
    }
    const copy = page.locator('.copy').first();
    await copy.scrollIntoViewIfNeeded();
    await copy.click();
    await page.waitForFunction(() => document.querySelector('.copy').textContent !== 'Copy');

    // The end of the page is not under the picker.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const end = await page.evaluate(() => ({ foot: [...document.querySelectorAll('.foot > *')].reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0), picker: document.querySelector('.proto-picker').getBoundingClientRect().top }));
    assert.ok(end.foot <= end.picker, `${tag}: picker covers the footer (${end.foot} > ${end.picker})`);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-end.png`) });

    // Switching shows the next variant from the top.
    await page.locator('.proto-picker-item').nth((d + 1) % 3).click();
    await page.locator(`.d${((d + 1) % 3) + 1}`).waitFor();
    await settle(page);
    assert.ok(await page.evaluate(() => scrollY < 2), `${tag}: next variant starts at the top`);
    await ctx.close();
  }
}
await browser.close();
assert.deepEqual(errors, [], errors.join('\n'));
console.log('ok');
