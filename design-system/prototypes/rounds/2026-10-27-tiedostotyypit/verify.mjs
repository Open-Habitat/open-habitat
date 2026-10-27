// Builds the round into its issue and checks it offline: every direction at 1440 and 390 px in
// light and dark, the whole conversation in one tall frame; the previews open for every kind
// that has one and Escape returns focus; the unknown type offers only Lataa; the media really
// play (video and the synthesized audio advance), the in-card pager, Markdown fold, zip tree and
// audio scrubbing work; nothing overflows horizontally; the picker holds; no console errors or
// network requests. Screenshots at device scale factor 2 into the issue's evidence directory.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-27-tiedostotyypit/verify.mjs
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

const dir = path.join(root, 'issues/proto-file-offer-types/prototypes/file-offer-types');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const DIRS = ['facts', 'peek', 'live'];
const NAMES = ['tunniste', 'kurkistus', 'soitin'];
const KINDS = ['juliste', 'logo', 'gif', 'video', 'audio', 'md', 'docx', 'pptx', 'pdf', 'csv', 'code', 'zip', 'unknown'];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const pick = async (p, v) => { await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click(); await p.locator(`.ft-dir-${DIRS[v]}`).waitFor(); await p.waitForTimeout(450); };
const hidePicker = (p, on) => p.locator('.proto-picker').evaluate((n, on) => { n.style.visibility = on ? 'hidden' : ''; }, on);
async function shoot(p, file, sel = '.frame') { await hidePicker(p, true); await p.locator(sel).screenshot({ path: path.join(out, file) }); await hidePicker(p, false); }
// The frame grows to the whole conversation so one picture shows every card.
async function tall(p) {
  await p.evaluate(() => { const f = document.querySelector('.frame'); f.style.height = ''; });
  const h = await p.evaluate(() => { const s = document.querySelector('#stage'), f = document.querySelector('.frame'); return f.clientHeight + s.scrollHeight - s.clientHeight + 8; });
  await p.evaluate((h) => { document.querySelector('.frame').style.setProperty('height', h + 'px', 'important'); }, h);
  await p.waitForTimeout(100);
}
async function noOverflow(p, tag) {
  for (const sel of ['.topbar', '.frame', 'body', '#stage', '.ft-dlg[open]', '.ft-dlg[open] .ft-dbody']) {
    const loc = p.locator(sel).first(); if (!(await loc.count())) continue;
    if (sel.endsWith('.ft-dbody')) continue; // tables and code scroll inside the preview body by design
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
  for (const card of await p.locator('.ft-card').all()) assert.ok(await card.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: a card overflows`);
}
const card = (p, k) => p.locator(`[data-ft-offer="${k}"]`);
async function preview(p, opener, tag, shot, during) {
  await opener.click();
  const d = p.locator('.ft-dlg[open]'); await d.waitFor();
  await p.waitForTimeout(250);
  await noOverflow(p, tag);
  assert.ok(await d.locator('.ft-dactions .ft-dl').isVisible(), `${tag}: preview offers Lataa`);
  if (during) await during(d);
  if (shot) await shoot(p, shot, '.ft-dlg[open]');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.ft-dlg[open]'));
  assert.ok(await opener.evaluate(n => n === document.activeElement), `${tag}: focus returns to the opener`);
}
const advances = async (p, sel, tag) => {
  const t0 = await p.locator(sel).first().evaluate(v => v.currentTime);
  await p.waitForFunction(([sel, t0]) => document.querySelector(sel).currentTime > t0 + 0.4, [sel, t0], { timeout: 5000 });
  return tag;
};
const audioAt = (p) => p.evaluate(() => window.__ft.aud.currentTime);
let cases = 0;
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (width === 390) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, '2026-10-27-tiedostotyypit');
    const interact = theme === 'light';
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`;
      await pick(p, v);
      await tall(p);
      await noOverflow(p, tag);
      const text = await p.locator('#stage').innerText();
      assert.ok(!/undefined|NaN|\bnull\b/.test(text), `${tag}: bad text`);
      assert.equal(await p.locator('.ft-card').count(), KINDS.length, `${tag}: one card per file`);
      // The unknown type: Lataa and the reason, nothing to open.
      assert.equal(await card(p, 'unknown').locator('[data-ft-open]').count(), 0, `${tag}: unknown has no preview`);
      assert.ok(/Selain ei osaa näyttää/.test(await card(p, 'unknown').innerText()), `${tag}: unknown says why`);
      await p.waitForTimeout(400); // video frames decode
      await shoot(p, `${v + 1}-${NAMES[v]}-${size}-${theme}.png`);
      if (DIRS[v] === 'facts') {
        assert.equal(await p.locator('.ft-card video, .ft-card .ft-peek, .ft-card .ft-player').count(), 0, `${tag}: no content beyond images`);
        if (interact) {
          await preview(p, card(p, 'video').getByRole('button', { name: 'Toista' }), tag + ' video', size === 'desktop' ? `${v + 1}-${NAMES[v]}-${size}-${theme}-video.png` : '', async (d) => {
            await d.locator('video').evaluate(v => v.play()); await advances(p, '.ft-dlg video', tag);
          });
          await preview(p, card(p, 'audio').getByRole('button', { name: 'Kuuntele' }), tag + ' audio', `${v + 1}-${NAMES[v]}-${size}-${theme}-aani.png`, async (d) => {
            await d.locator('[data-ft-play]').click(); await p.waitForFunction(() => window.__ft.aud.currentTime > 0.6, null, { timeout: 5000 });
            await d.locator('[data-ft-play]').click();
            assert.ok(/^0:0[0-9] \/ 0:34$/.test(await d.locator('[data-ft-time]').innerText()), `${tag}: audio time`);
          });
          await preview(p, card(p, 'md').getByRole('button', { name: 'Lue' }), tag + ' md', size === 'desktop' ? `${v + 1}-${NAMES[v]}-${size}-${theme}-markdown.png` : '');
          await preview(p, card(p, 'pptx').getByRole('button', { name: 'Selaa dioja' }), tag + ' pptx');
          await preview(p, card(p, 'csv').getByRole('button', { name: 'Näytä taulukko' }), tag + ' csv', `${v + 1}-${NAMES[v]}-${size}-${theme}-csv.png`);
          await preview(p, card(p, 'zip').getByRole('button', { name: 'Näytä sisältö' }), tag + ' zip', size === 'phone' ? `${v + 1}-${NAMES[v]}-${size}-${theme}-zip.png` : '');
          await preview(p, card(p, 'code').getByRole('button', { name: 'Näytä koodi' }), tag + ' code');
          await card(p, 'unknown').locator('[data-ft-dl]').click();
          await p.waitForFunction(() => /Lataus alkoi: osallistujat\.parquet/.test(document.querySelector('.toast')?.textContent));
        }
      }
      if (DIRS[v] === 'peek') {
        // The video peek is a decoded still at its poster time, not playing.
        const still = await card(p, 'video').locator('video').evaluate(v => ({ t: v.currentTime, paused: v.paused, ready: v.readyState }));
        assert.ok(still.paused && still.ready >= 2 && Math.abs(still.t - 2.6) < 0.2, `${tag}: video poster ${JSON.stringify(still)}`);
        assert.equal(await p.locator('.ft-card .ft-peek').count(), KINDS.length - 1, `${tag}: every known kind has a peek`);
        if (interact) {
          await preview(p, card(p, 'video').locator('.ft-peek'), tag + ' video');
          await preview(p, card(p, 'zip').locator('.ft-peek'), tag + ' zip', size === 'desktop' ? `${v + 1}-${NAMES[v]}-${size}-${theme}-zip.png` : '');
          await preview(p, card(p, 'pdf').locator('.ft-peek'), tag + ' pdf', size === 'phone' ? `${v + 1}-${NAMES[v]}-${size}-${theme}-pdf.png` : '');
          await preview(p, card(p, 'gif').locator('.ft-peek'), tag + ' gif');
        }
      }
      if (DIRS[v] === 'live') {
        assert.equal(await card(p, 'video').locator('video[controls]').count(), 1, `${tag}: video player in card`);
        assert.equal(await card(p, 'audio').locator('[data-ft-play]').count(), 1, `${tag}: audio player in card`);
        if (interact) {
          await card(p, 'audio').locator('[data-ft-play]').click();
          await p.waitForFunction(() => window.__ft.aud.currentTime > 0.6, null, { timeout: 5000 });
          await card(p, 'audio').locator('[data-ft-play]').click();
          const scrub = card(p, 'audio').locator('[data-ft-scrub]'); const b = await scrub.boundingBox();
          await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
          const at = await audioAt(p); assert.ok(Math.abs(at - 17) < 1.5, `${tag}: scrub to the middle (${at})`);
          await p.waitForFunction((want) => document.querySelector('[data-ft-offer="audio"] [data-ft-time]').textContent === want, `0:${String(Math.floor(at)).padStart(2, '0')} / 0:34`);
          await card(p, 'video').locator('video').evaluate(v => { v.muted = true; return v.play(); }); await advances(p, '[data-ft-offer="video"] video', tag);
          await card(p, 'video').locator('video').evaluate(v => v.pause());
          await card(p, 'pptx').getByRole('button', { name: 'Seuraava dia' }).click();
          await card(p, 'pptx').getByRole('button', { name: 'Seuraava dia' }).click();
          assert.equal(await card(p, 'pptx').locator('.ft-pager-n').innerText(), 'Dia 3 / 12', `${tag}: pager`);
          assert.equal(await card(p, 'pptx').locator('.ft-slide-t').innerText(), 'Reitti ja etapit', `${tag}: slide 3`);
          await card(p, 'md').locator('[data-ft-more]').click();
          assert.equal(await card(p, 'md').locator('[data-ft-more]').getAttribute('aria-expanded'), 'true', `${tag}: md expands`);
          await card(p, 'zip').locator('summary').nth(2).click();
          assert.equal(await card(p, 'zip').locator('details[open]').count(), 1, `${tag}: zip folder opens`);
          await preview(p, card(p, 'pdf').getByRole('button', { name: 'Näytä isona' }), tag + ' pdf');
          await tall(p);
          await p.waitForTimeout(300);
          await noOverflow(p, tag + ' opened');
          await shoot(p, `${v + 1}-${NAMES[v]}-${size}-${theme}-avattu.png`);
          await p.evaluate(() => window.__ft.aud.pause());
        }
      }
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×size×theme cases, ${KINDS.length} kinds each; previews open and return focus; video and audio play; pager, fold, zip tree and scrub work; unknown type downloads only; picker; no overflow, console errors or network requests.`);
} finally { await browser.close(); }
