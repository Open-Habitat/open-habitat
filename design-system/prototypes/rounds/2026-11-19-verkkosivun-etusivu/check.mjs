// node check.mjs <built.html> <out-dir>
// Playwright from web/node_modules (PROTO_WEB=<dir with package.json and
// node_modules> borrows another checkout's). Each direction at 1440 and 390:
// the picker holds (picker-check.mjs), its own switcher line is marked, no
// horizontal overflow, no request leaves the file, the console is clean, and
// no two text boxes overlap. Writes <n>-<width>-top.png and -full.png.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const [input, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const html = readFileSync(input, 'utf8');
const browser = await chromium.launch();
const errors = [];
for (const width of [1440, 390]) {
  for (const d of [0, 1, 2]) {
    const phone = width === 390;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*', (r) => (r.request().url().startsWith('http://prototype.test/') ? r.fulfill({ contentType: 'text/html', body: html }) : (errors.push(`network: ${r.request().url()}`), r.abort())));
    await page.goto(`http://prototype.test/?v=${d + 1}`);
    await page.locator(`.d${d + 1}`).waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
    await checkPicker(page, '2026-11-19-verkkosivun-etusivu');
    assert.equal(await page.locator('.rq-lines li').nth(d).getAttribute('aria-current'), 'true', `${d + 1}@${width}: own line`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${d + 1}@${width}: horizontal overflow`);
    const overlaps = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.pg h1, .pg h2, .pg h3, .pg p, .pg li, .pg dt, .pg dd, .pg figcaption, .pg code, .pg pre, .pg img')].filter((e) => !e.closest('.d1-more ul') || e.tagName === 'LI');
      const boxes = els.map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width && r.height);
      const bad = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, ra] = boxes[i], [b, rb] = boxes[j];
        if (a.contains(b) || b.contains(a)) continue;
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 2 && y > 2) bad.push(`${a.tagName}.${a.className} × ${b.tagName}.${b.className} "${(a.textContent || a.alt || '').slice(0, 30)}"`);
      }
      return bad.slice(0, 8);
    });
    assert.equal(overlaps.length, 0, `${d + 1}@${width}: overlap ${overlaps.join(' | ')}`);
    await page.screenshot({ path: join(out, `${d + 1}-${width}-top.png`) });
    await page.screenshot({ path: join(out, `${d + 1}-${width}-full.png`), fullPage: true });
    // Switching shows the next direction at once, from the top.
    await page.locator('.proto-picker-item').nth((d + 1) % 3).click();
    await page.locator(`.d${((d + 1) % 3) + 1}`).waitFor();
    await ctx.close();
  }
}
await browser.close();
assert.deepEqual(errors, [], errors.join('\n'));
console.log('ok');
