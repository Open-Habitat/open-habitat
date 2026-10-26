// Builds the round into its issue and checks it offline: every direction at 1440 and 390 px in
// light and dark, the whole conversation in one tall frame; the preview opens from each
// direction and Escape returns focus; the removed file offers no download; the shelf panel opens,
// selects and closes; nothing overflows horizontally; the picker holds; no console errors or
// network requests. Screenshots at device scale factor 2 into the issue's evidence directory.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-26-agentin-tiedostot/verify.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

const dir = path.join(root, 'issues/proto-agent-file-offer/prototypes/file-offer');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['kortti', 'vastauksessa', 'hylly'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const pick = async (p, v) => { await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click(); await p.locator(`.fo-dir-${['card', 'inline', 'shelf'][v]}`).waitFor(); await p.waitForTimeout(450); };
const hidePicker = (p, on) => p.locator('.proto-picker').evaluate((n, on) => { n.style.visibility = on ? 'hidden' : ''; }, on);
async function shoot(p, file, sel = '.frame') { await hidePicker(p, true); await p.locator(sel).screenshot({ path: path.join(out, file) }); await hidePicker(p, false); }
async function noOverflow(p, tag) {
  for (const sel of ['.topbar', '.frame', 'body', '#stage', '.fo-panel:not([hidden])', '.fo-dlg[open]']) {
    const loc = p.locator(sel).first(); if (!(await loc.count())) continue;
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
}
async function preview(p, opener, tag, shot) {
  await opener.click();
  const d = p.locator('.fo-dlg[open]'); await d.waitFor();
  await p.waitForTimeout(250);
  await noOverflow(p, tag);
  assert.ok(await d.locator('.fo-dactions .fo-dl').isVisible(), `${tag}: preview offers Lataa`);
  if (shot) await shoot(p, shot, '.fo-dlg[open]');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.fo-dlg[open]'));
  assert.ok(await opener.evaluate(n => n === document.activeElement), `${tag}: focus returns to the opener`);
}
let cases = 0;
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height: 1100 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (width === 390) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, '2026-10-26-agentin-tiedostot');
    // A tall frame shows the whole conversation in one picture.
    await p.addStyleTag({ content: '.frame{height:2050px!important}' });
    const interact = theme === 'light';
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`;
      await pick(p, v);
      await noOverflow(p, tag);
      const text = await p.locator('#stage').innerText();
      assert.ok(!/undefined|NaN|\bnull\b|\{\{OFFER/.test(text), `${tag}: bad text`);
      await shoot(p, `${v + 1}-${NAMES[v]}-${size}-${theme}.png`);
      if (v === 0) {
        // Removed: no download or open; the pack card has three rows and a zip; the single image card one primary.
        assert.equal(await p.locator('[data-fo-offer="draft"] button').count(), 0, `${tag}: removed card has no actions`);
        assert.equal(await p.locator('[data-fo-offer="pack"] .fo-file').count(), 3, `${tag}: three files`);
        assert.ok(await p.locator('[data-fo-offer="pack"] [data-fo-zip]').isVisible(), `${tag}: zip`);
        if (interact) {
          await preview(p, p.locator('[data-fo-offer="pack"] .fo-fname').nth(1), tag + ' xlsx', `${v + 1}-${NAMES[v]}-${size}-${theme}-excel.png`);
          await preview(p, p.locator('[data-fo-offer="cmp"] .fo-shot'), tag + ' png', size === 'desktop' ? `${v + 1}-${NAMES[v]}-${size}-${theme}-kuva.png` : '');
          await p.locator('[data-fo-offer="pack"] [data-fo-zip]').click();
          await p.waitForFunction(() => /\.zip · 3 tiedostoa/.test(document.querySelector('.toast')?.textContent));
        }
      }
      if (v === 1) {
        assert.equal(await p.locator('.fo-chip.gone button').count(), 0, `${tag}: removed chip is inert`);
        assert.equal(await p.locator('.fo-fig').count(), 2, `${tag}: two images in replies`);
        if (interact) {
          await preview(p, p.locator('.fo-chip-open').filter({ hasText: 'q3-raportti.pdf' }), tag + ' pdf', `${v + 1}-${NAMES[v]}-${size}-${theme}-pdf.png`);
          await p.locator('.fo-chip .fo-dl').first().click();
          await p.waitForFunction(() => /Lataus alkoi: myynti-q3\.xlsx/.test(document.querySelector('.toast')?.textContent));
        }
      }
      if (v === 2) {
        assert.equal(await p.locator('.fo-line').count(), 3, `${tag}: three lines`);
        await p.locator('[data-fo-toggle]').click();
        const panel = p.locator('.fo-panel:not([hidden])'); await panel.waitFor();
        await p.waitForTimeout(300);
        await noOverflow(p, tag + ' panel');
        assert.equal(await panel.locator('.fo-prow').count(), 5, `${tag}: five rows`);
        await shoot(p, `${v + 1}-${NAMES[v]}-${size}-${theme}-paneeli.png`);
        if (interact) {
          await panel.locator('[data-fo-sel="xlsx"]').click();
          assert.equal(await p.evaluate(() => document.activeElement?.dataset.foSel), 'xlsx', `${tag}: selection keeps focus`);
          await shoot(p, `${v + 1}-${NAMES[v]}-${size}-${theme}-paneeli-excel.png`);
          await panel.locator('[data-fo-sel="draft"]').click();
          assert.equal(await panel.locator('.fo-pview .fo-dl').count(), 0, `${tag}: removed file has no download`);
          await preview(p, (await panel.locator('[data-fo-sel="pdf"]').click(), panel.locator('.fo-pprev')), tag + ' panel pdf');
        }
        await p.keyboard.press('Escape');
        await p.waitForFunction(() => document.querySelector('.fo-panel').hidden);
        assert.ok(await p.locator('[data-fo-toggle]').evaluate(n => n === document.activeElement), `${tag}: focus returns to Tiedostot`);
        // The thread line opens the panel at its file.
        await p.locator('.fo-line [data-fo-shelf]').nth(1).click();
        assert.equal(await p.evaluate(() => document.activeElement?.dataset.foSel), 'png', `${tag}: line opens at its file`);
        await p.keyboard.press('Escape');
      }
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×size×theme cases; previews open and return focus; removed file inert; shelf panel; picker; no overflow, console errors or network requests.`);
} finally { await browser.close(); }
