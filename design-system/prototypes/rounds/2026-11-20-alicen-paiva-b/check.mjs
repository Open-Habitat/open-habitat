// node check.mjs <built.html> <out-dir>
// Playwright from web/node_modules (PROTO_WEB=<dir with package.json and
// node_modules> borrows another checkout's). Each story at 1440 and 390: the
// floating picker holds (picker-check.mjs); the hero image is centred and
// whole; nothing pokes past the viewport; no request leaves the file; the
// console is clean; on the desktop every scene's screen follows its chapter,
// fits inside the frame and is not scaled below a readable size; on the phone
// every scene's screen is inline and inside the viewport; a "comes back"
// button scrolls to the scene it names; the picker does not cover the footer.
// Writes <n>-<width>-top.png, one <n>-<width>-s<k>.png per scene and -end.png.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';

const ROUND = '2026-11-20-alicen-paiva-b';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const [input, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const html = readFileSync(input, 'utf8');
const browser = await chromium.launch();
const errors = [];
const settle = (page) => page.waitForTimeout(350);

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
    await page.locator('.d1').waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
    await settle(page);
    await checkPicker(page, ROUND);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-top.png`) });

    const hero = await page.evaluate(() => { const img = document.querySelector('.hero-img').getBoundingClientRect(); return { l: img.left, r: img.right, vw: innerWidth }; });
    assert.ok(hero.l >= 0 && hero.r <= hero.vw + 0.5, `${tag}: hero image not whole`);
    assert.ok(Math.abs((hero.l + hero.r) / 2 - hero.vw / 2) <= 1, `${tag}: hero image off centre`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: horizontal overflow`);

    const n = await page.locator('.d1-ch').count();
    assert.ok(n >= 6, `${tag}: a day has scenes`);
    for (let k = 0; k < n; k++) {
      if (!phone) {
        await page.locator('.d1-ch').nth(k).evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY + e.offsetHeight / 2 - innerHeight / 2));
        await settle(page);
        const s = await page.evaluate(() => {
          const on = [...document.querySelectorAll('.d1-frame')].map((f, i) => (f.classList.contains('on') ? i : -1)).filter((i) => i >= 0);
          const box = document.querySelector('.d1-frames').getBoundingClientRect();
          const sc = document.querySelector('.d1-frame.on > .sc');
          const r = sc.getBoundingClientRect();
          return { on, inside: r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.left >= box.left - 1 && r.right <= box.right + 1, scale: r.width / sc.offsetWidth, clock: document.querySelector('.d1-clock b').textContent, time: document.querySelector('.d1-ch.on .d1-time').firstChild.textContent };
        });
        assert.deepEqual(s.on, [k], `${tag}: screen follows chapter ${k}`);
        assert.equal(s.clock, s.time, `${tag}: clock follows chapter ${k}`);
        assert.ok(s.inside, `${tag}: scene ${k} screen leaves its frame`);
        assert.ok(s.scale >= 0.74, `${tag}: scene ${k} screen scaled to ${s.scale.toFixed(2)}`);
        console.log(`${tag} scene ${k} scale ${s.scale.toFixed(2)}`);
        await page.screenshot({ path: join(out, `${d + 1}-${width}-s${k}.png`) });
      } else {
        const fig = page.locator('.d1-inline').nth(k);
        await fig.scrollIntoViewIfNeeded();
        const bad = await fig.evaluate((f) => [...f.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); const clip = e.closest('.target, pre, .sc-comp span, .sc-bar b, code'); return r.width && !clip && (r.right > innerWidth + 1 || r.left < -1); }).map((e) => `${e.tagName}.${e.className}`).slice(0, 4));
        assert.deepEqual(bad, [], `${tag}: scene ${k} past the viewport ${bad.join(' | ')}`);
        await page.locator('.d1-ch').nth(k).screenshot({ path: join(out, `${d + 1}-${width}-s${k}.png`) });
      }
    }

    // A "comes back" button scrolls to the scene it names.
    const back = page.locator('.d1-back button').first();
    const to = +(await back.getAttribute('data-to'));
    await back.scrollIntoViewIfNeeded();
    await back.click();
    await settle(page);
    const mid = await page.locator('.d1-ch').nth(to).evaluate((e) => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    assert.ok(mid, `${tag}: comes-back button scrolls to its scene`);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const end = await page.evaluate(() => ({ foot: [...document.querySelectorAll('.foot > *')].reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0), picker: document.querySelector('.proto-picker').getBoundingClientRect().top }));
    assert.ok(end.foot <= end.picker, `${tag}: picker covers the footer (${end.foot} > ${end.picker})`);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-end.png`) });

    // Switching shows the next story from the top.
    await page.locator('.proto-picker-item').nth((d + 1) % 3).click();
    await settle(page);
    assert.equal(await page.evaluate(() => scrollY), 0, `${tag}: next story starts at the top`);
    assert.match(page.url(), new RegExp(`v=${((d + 1) % 3) + 1}`), `${tag}: picker writes ?v=`);
    await ctx.close();
  }
}
await browser.close();
assert.deepEqual(errors, [], errors.join('\n'));
console.log('ok');
