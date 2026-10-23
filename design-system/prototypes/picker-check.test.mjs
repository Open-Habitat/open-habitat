// PROTO_CHROMIUM=<path> node --test design-system/prototypes/picker-check.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '../../web/node_modules/playwright/index.mjs';
import {checkPicker, supersededRounds} from './picker-check.mjs';

test('built-page picker gate, including custom builds and closed-round exemptions', async () => {
  const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
  try {
    const page = await browser.newPage({viewport:{width:390,height:800}});
    await page.setContent('<main>Production-component round without harness chrome</main>');
    await assert.rejects(checkPicker(page, 'custom-build'), /missing prototype picker/);
    for (const round of supersededRounds) {
      await checkPicker(page, round);
      await assert.rejects(checkPicker(page, round, `Review rounds/${round}/`), /missing prototype picker/);
    }
    await page.setContent(`<nav class="proto-picker" style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%)">
      <span class="proto-picker-highlight"></span>
      <button class="proto-picker-item" data-active aria-current="true">One</button>
      <button class="proto-picker-item">Two</button>
    </nav>`);
    await checkPicker(page, 'custom-build');
    await page.locator('.proto-picker').evaluate(n => n.style.display='none');
    await assert.rejects(checkPicker(page, 'custom-build'), /picker is hidden/);
    await page.locator('.proto-picker').evaluate(n => n.style.display='block');
    await page.locator('[data-active]').evaluate(n => n.removeAttribute('aria-current'));
    await assert.rejects(checkPicker(page, 'custom-build'), /exactly one (active|current)/);
  } finally { await browser.close(); }
});
