// node check.mjs <built.html> <out-dir>
// Playwright from web/node_modules (PROTO_WEB=<dir with package.json and
// node_modules> borrows another checkout's). Each story at 1440 and 390:
// the floating picker holds (picker-check.mjs); the hero image is whole and
// centred; nothing pokes past the viewport and the page does not scroll
// sideways; no request leaves the file; the console is clean; no two visible
// text boxes overlap; a tool row opens to its output and an offered file
// answers; and each story's own motion works (1: the screen, clock and ribbon
// follow the chapter; 3: the status file and the week strip follow the
// evening, and a day in the strip jumps to its evening). Writes screenshots
// <n>-<width>-<what>.png, including one per scene at the phone width.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';

const ROUND = '2026-11-20-alicen-paiva-c';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const [input, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const html = readFileSync(input, 'utf8');
const browser = await chromium.launch();
const errors = [];
const settle = (page, ms = 450) => page.waitForTimeout(ms);
const scrollMid = (loc) => loc.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY + e.offsetHeight / 2 - innerHeight / 2));

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
    await page.locator(`.v${d + 1}`).waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
    await settle(page);
    await checkPicker(page, ROUND);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-top.png`) });

    const hero = await page.evaluate(() => { const r = document.querySelector('.hero-img').getBoundingClientRect(); return { l: r.left, r: r.right, vw: innerWidth }; });
    assert.ok(hero.l >= 0 && hero.r <= hero.vw + 0.5 && Math.abs((hero.l + hero.r) / 2 - hero.vw / 2) <= 1, `${tag}: hero image not whole and centred`);

    const wide = await page.evaluate(() => [...document.querySelectorAll('.pg h1, .pg h2, .pg h3, .pg p, .pg li, .pg .scr, .pg .f-file, .pg img')]
      .filter((e) => !e.closest('pre') && e.getClientRects().length)
      .filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; })
      .map((e) => `${e.tagName}.${e.className} "${(e.textContent || '').slice(0, 30)}"`).slice(0, 6));
    assert.deepEqual(wide, [], `${tag}: past the viewport ${wide.join(' | ')}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: horizontal overflow`);

    // No two visible text boxes overlap. Hidden story frames and files are excluded.
    const overlaps = await page.evaluate(() => {
      const shown = (e) => { if (e.closest('details:not([open]) > :not(summary)')) return false; for (let n = e; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false; } return true; };
      const els = [...document.querySelectorAll('.pg h1, .pg h2, .pg h3, .pg p, .pg li, .pg pre, .pg img, .pg .bubble, .pg .tool, .pg .offer-b')].filter(shown);
      const clipped = (e) => {
        let { left, right, top, bottom } = e.getBoundingClientRect();
        for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const c = n.getBoundingClientRect(); left = Math.max(left, c.left); right = Math.min(right, c.right); top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); }
        }
        return { left, right, top, bottom, width: right - left, height: bottom - top };
      };
      // Sticky lanes and strips may sit over content in a single frame; compare in-flow boxes only.
      const sticky = (e) => e.closest('.l-heads, .w-week, .l-her, .m-side, .w-side');
      const boxes = els.filter((e) => !sticky(e)).map((e) => [e, clipped(e)]).filter(([, r]) => r.width > 0 && r.height > 0);
      const bad = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, ra] = boxes[i], [b, rb] = boxes[j];
        if (a.contains(b) || b.contains(a)) continue;
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 2 && y > 2) bad.push(`${a.tagName}.${a.className} × ${b.tagName}.${b.className} "${(a.textContent || '').slice(0, 30)}"`);
      }
      return bad.slice(0, 8);
    });
    assert.equal(overlaps.length, 0, `${tag}: overlap ${overlaps.join(' | ')}`);

    // A tool row opens to its output; an offered file answers.
    // A handle, not a locator: the selector would move on to the next closed row.
    const disc = await page.locator('.scr .disc[aria-expanded="false"]:visible').first().elementHandle();
    await disc.scrollIntoViewIfNeeded();
    await disc.click();
    assert.equal(await disc.getAttribute('aria-expanded'), 'true', `${tag}: tool row opens`);
    assert.ok(await disc.evaluate((b) => b.nextElementSibling.checkVisibility()), `${tag}: tool output shows`);
    await disc.click();
    assert.ok(await disc.evaluate((b) => !b.nextElementSibling.checkVisibility()), `${tag}: tool output closes`);
    if (d === 0 && !phone) { await scrollMid(page.locator('.m-ch').nth(1)); await settle(page); }
    const dl = page.locator('.offer-b:visible').first();
    if (await dl.count()) {
      await dl.scrollIntoViewIfNeeded();
      await dl.click();
      assert.equal((await dl.textContent()).trim(), 'Saved to Downloads', `${tag}: offered file answers`);
    }

    if (d === 0 && !phone) {
      for (const i of [2, 3, 6]) {
        await scrollMid(page.locator('.m-ch').nth(i));
        await settle(page);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.m-frame')].findIndex((f) => f.classList.contains('on'))), i, `${tag}: screen follows chapter ${i}`);
        assert.equal(await page.locator('.m-frame.on').count(), 1, `${tag}: one frame on`);
        const want = await page.locator('.m-ch').nth(i).locator('.m-time b').textContent();
        assert.equal(await page.locator('.m-clock b').textContent(), want, `${tag}: clock follows chapter`);
        await page.screenshot({ path: join(out, `${d + 1}-${width}-ch${i}.png`) });
      }
      const undo = page.locator('.m-frame.on [data-undo]');
      await undo.click();
      assert.equal(await undo.textContent(), 'Redo', `${tag}: undo answers`);
    }
    if (d === 1) {
      for (const i of [0, 2, 4]) {
        await page.locator('.l-row').nth(i).evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 20));
        await settle(page, 250);
        await page.screenshot({ path: join(out, `${d + 1}-${width}-row${i}.png`) });
      }
    }
    if (d === 2) {
      if (!phone) {
        for (const i of [1, 3]) {
          await scrollMid(page.locator('.w-eve').nth(i));
          await settle(page);
          assert.equal(await page.evaluate(() => [...document.querySelectorAll('.w-f')].findIndex((f) => f.classList.contains('on'))), i, `${tag}: file follows evening ${i}`);
          assert.equal(await page.locator('.w-week a[aria-current]').getAttribute('data-i'), String(i), `${tag}: week strip follows`);
          await page.screenshot({ path: join(out, `${d + 1}-${width}-eve${i}.png`) });
        }
      }
      await page.locator('.w-week a').nth(4).click();
      await settle(page, 700);
      const top = await page.locator('.w-eve').nth(4).evaluate((e) => e.getBoundingClientRect().top);
      assert.ok(top > 0 && top < 200, `${tag}: Fri jumps to its evening (${top})`);
      if (phone) {
        const det = page.locator('.w-inline').nth(1);
        await det.locator('summary').click();
        assert.ok(await det.evaluate((e) => e.open), `${tag}: status file opens`);
        await page.screenshot({ path: join(out, `${d + 1}-${width}-eve-file.png`) });
      }
    }
    if (phone) {
      // One shot per scene, for flipping through at the phone width.
      const sel = ['.m-ch', '.l-row', '.w-eve'][d];
      const n = await page.locator(sel).count();
      for (let i = 0; i < n; i++) {
        await page.locator(sel).nth(i).evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - (document.querySelector('.w-week')?.offsetHeight || 0)));
        await settle(page, 150);
        await page.screenshot({ path: join(out, `${d + 1}-${width}-scene${i}.png`) });
      }
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const pk = await page.evaluate(() => { const p = document.querySelector('.proto-picker').getBoundingClientRect(); const f = [...document.querySelectorAll('.foot > *')].map((e) => e.getBoundingClientRect()); return f.some((r) => r.bottom > p.top && r.top < p.bottom && r.right > p.left && r.left < p.right); });
    assert.equal(pk, false, `${tag}: picker covers the footer`);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-end.png`) });

    await page.keyboard.press('ArrowRight');
    await settle(page);
    assert.ok(await page.locator(`.v${((d + 1) % 3) + 1}`).count(), `${tag}: → flips to the next story`);
    await ctx.close();
  }
}
await browser.close();
assert.deepEqual(errors, [], `errors:\n${errors.join('\n')}`);
console.log('ok: 3 stories × 2 widths');
