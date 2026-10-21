// Hosted smoke test: only the synthetic Glasspad artifact, no product host.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
const errors = [];
let transitions = 0;
try {
  for (const width of [1440,1366,390]) for (const theme of ['light','dark']) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(process.argv[2]);
    const f = page.frameLocator('iframe').first();
    await f.locator('.e-demo').waitFor();
    await f.locator('#theme').selectOption(theme);
    for (let i = 0; i < 3; i++) {
      await f.locator('.proto-picker-item:not(.proto-picker-replay)').nth(i).click();
      await f.locator('.e-demo[data-mode="closed"]').waitFor();
      for (const [action,mode] of [[i===2?'split':'toggle','split'],[i===2?'full':'size','full'],['back','split']]) {
        await f.locator(`.e-demo [data-action="${action}"]`).click();
        await f.locator(`.e-demo[data-mode="${mode}"]`).waitFor();
        transitions++;
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({success:true, hosted:true, transitions, errors}));
} finally { await browser.close(); }
