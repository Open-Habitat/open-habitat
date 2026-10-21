// Run on a browser-capable machine: node check.mjs <built-html> <evidence-dir>
// Uses only the authored synthetic page, never a live host or browser profile.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [input, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const html = readFileSync(input, 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
let states = 0;
try {
  for (const width of [1440, 1366, 390]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: {width, height: 1000} });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('http://prototype.test/**', route => route.fulfill({contentType:'text/html',body:html}));
    await page.goto('http://prototype.test/');
    await page.locator('#theme').selectOption(theme);
    for (let direction = 0; direction < 3; direction++) {
      await page.locator('.proto-picker-item:not(.proto-picker-replay)').nth(direction).click();
      await page.waitForSelector('.e-demo[data-mode="closed"]');
      const action = name => page.locator(`.e-demo [data-action="${name}"]`);
      const check = async mode => {
        assert.equal(await page.locator('.e-demo').getAttribute('data-mode'), mode);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'document overflow');
        const buttons = page.locator('.e-main button:visible');
        for (let i = 0; i < await buttons.count(); i++) {
          const box = await buttons.nth(i).boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width + 1, 'control outside viewport');
        }
        states++;
      };
      await check('closed');
      await page.locator('.e-demo textarea').fill('Säilytä luonnos.');
      await action(direction === 2 ? 'split' : 'toggle').focus();
      await page.keyboard.press('Enter');
      await check('split');
      if (width > 800) {
        const editor = await page.locator('.e-editor').boundingBox();
        const conv = await page.locator('.e-conversation').boundingBox();
        assert.ok(editor.x + editor.width <= conv.x + 1, 'desktop panes not side by side');
      }
      const capture = async suffix => {
        const base = `${out}/d${direction+1}-${width}-${theme}-${suffix}`;
        await page.screenshot({path:`${base}.png`,fullPage:true});
        writeFileSync(`${base}.html`, (await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''));
      };
      if (width === 1440 && theme === 'light') await capture('split');
      await action(direction === 2 ? 'full' : 'size').click();
      await check('full');
      assert.equal(await page.locator('.e-conversation').isVisible(), false);
      if (width === 390 && theme === 'dark') await capture('full');
      await action('back').click();
      await check('split');
      assert.equal(await page.locator('.e-demo textarea').inputValue(), 'Säilytä luonnos.');
      // Separate restore path from the full-window control itself.
      await action(direction === 2 ? 'full' : 'size').click();
      await action(direction === 2 ? 'split' : 'size').click();
      await check('split');
      await action(direction === 2 ? 'closed' : direction === 1 ? 'close' : 'toggle').click();
      await check('closed');
      assert.equal(await page.locator('.e-demo textarea').inputValue(), 'Säilytä luonnos.');
      await action('file').click();
      await check('split');
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({success:true, states, errors, captures:6}));
} finally { await browser.close(); }
