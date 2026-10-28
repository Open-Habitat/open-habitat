// Builds the round into its issue and checks it offline: every direction at 1440 and 390 px in
// light and dark with the file panel open where Näytä tiedostot leaves it; no preview of a
// selected file above the list; nested folders open and close; every row reaches its preview
// and its download (Leijuva on hover and focus, always on the phone; Näkyvä always; Avautuva
// after opening the row); the file the browser cannot show has no preview button; search across
// offers; Escape closes the dialog, then the panel, and focus returns; the card reopens the panel;
// nothing overflows horizontally; the picker holds; no console errors or network requests.
// Screenshots at device scale factor 2 into the issue's evidence directory.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-kansion-tiedostorivit/verify.mjs
// (NODE_PATH=<checkout>/web/node_modules when this worktree has no web/node_modules.)
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

const dir = path.join(root, 'issues/proto-folder-offer-file-rows/prototypes/folder-offer-file-rows');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const DIRS = ['hover', 'shown', 'open'];
const NAMES = ['leijuva', 'nakyva', 'avautuva'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const pick = async (p, v) => { await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click(); await p.locator(`.fr-dir-${DIRS[v]}`).waitFor(); await p.locator('.fr-panel:not([hidden])').waitFor(); await p.waitForTimeout(300); };
const hidePicker = (p, on) => p.locator('.proto-picker').evaluate((n, on) => { n.style.visibility = on ? 'hidden' : ''; }, on);
async function shoot(p, file, sel = '.frame', keepToast = false) {
  if (!keepToast) await p.evaluate(() => document.querySelector('.toast')?.classList.remove('on'));
  await hidePicker(p, true); await p.locator(sel).first().screenshot({ path: path.join(out, file) }); await hidePicker(p, false);
}
async function noOverflow(p, tag) {
  for (const sel of ['.topbar', '.frame', 'body', '#stage', '.fr-panel:not([hidden])', '.fr-pscroll', '.fr-dlg[open]']) {
    const loc = p.locator(sel).first(); if (!(await loc.count()) || !(await loc.isVisible())) continue;
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
}
const row = (p, name) => p.locator(`.fr-row[data-fr-id$="/${name}"], .fr-row[data-fr-id$=":${name}"]`).first();
const toastSays = (p, re) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector('.toast')?.textContent || ''), re.source);
const opacity = (loc) => loc.evaluate(n => +getComputedStyle(n).opacity);
async function dialog(p, opener, name, tag, shot) {
  await opener.click();
  const d = p.locator('.fr-dlg[open]'); await d.waitFor();
  assert.equal(await d.locator('#fr-dlg-title').innerText(), name, `${tag}: dialog names the file`);
  await noOverflow(p, tag + ' dialog');
  if (shot) await shoot(p, shot, '.fr-dlg[open]');
  await d.locator('[data-fr-dl]').click(); await toastSays(p, new RegExp(name.replace('.', '\\.')));
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.fr-dlg[open]'));
  assert.ok(await opener.evaluate(n => n === document.activeElement), `${tag}: focus returns to the opener`);
  assert.ok(await p.locator('.fr-panel').isVisible(), `${tag}: Escape in the dialog keeps the panel`);
}
let cases = 0;
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (width === 390) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, '2026-10-28-kansion-tiedostorivit');
    const interact = theme === 'light';
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`, n = `${v + 1}-${NAMES[v]}-${size}-${theme}`;
      await pick(p, v);
      await p.mouse.move(2, 2);
      await noOverflow(p, tag);
      const text = await p.locator('.frame').innerText();
      assert.ok(!/undefined|NaN|\bnull\b/.test(text), `${tag}: bad text`);
      assert.equal(await p.locator('.fr-card').count(), 2, `${tag}: two offers in the conversation`);
      assert.ok(/54 tiedostoa · 3 kansiota/.test(await p.locator('[data-fr-offer="juhla"]').innerText()), `${tag}: folder facts`);
      const first = p.locator('.fr-pscroll > *').nth(1).locator('.fr-sec').first();
      assert.equal(await first.getAttribute('data-fr-sec'), 'juhla', `${tag}: the newest offer first`);
      assert.equal(await p.locator('.fr-panel img:not(.fr-thumb)').count(), 0, `${tag}: no large preview in the panel`);
      assert.equal(await p.locator('.fr-panel details[open]').count(), 3, `${tag}: top folders open, nested ones closed`);
      assert.equal(await p.locator('.fr-panel .fr-row:visible').count(), 8 + 6 + 4 + 4 + 1, `${tag}: visible rows`);
      await shoot(p, `${n}.png`);
      const lue = row(p, 'LUE-MINUT.md'), indd = row(p, 'juliste-painoon.indd');
      if (DIRS[v] === 'hover') {
        const acts = lue.locator('.fr-acts');
        if (size === 'desktop') {
          assert.equal(await opacity(acts), 0, `${tag}: buttons hidden at rest`);
          await lue.hover();
          assert.equal(await opacity(acts), 1, `${tag}: buttons on hover`);
          assert.equal(await opacity(lue.locator('.fr-size')), 0, `${tag}: size gives way`);
          if (interact) await shoot(p, `${n}-osoitin.png`);
          await p.mouse.move(2, 2);
          await lue.locator('.fr-main').focus();
          assert.equal(await opacity(acts), 1, `${tag}: buttons on keyboard focus`);
          await p.keyboard.press('Tab');
          assert.ok(await lue.locator('[data-fr-preview].fr-act').evaluate(n => n === document.activeElement), `${tag}: Tab reaches the row's preview button`);
        } else assert.equal(await opacity(acts), 1, `${tag}: buttons always on the phone`);
        assert.equal(await indd.locator('.fr-act[data-fr-preview]').count(), 0, `${tag}: no preview for .indd`);
        if (interact) {
          await dialog(p, row(p, 'sali-valmiina.jpg').locator('.fr-main'), 'sali-valmiina.jpg', tag + ' row', `${n}-esikatselu.png`);
          await lue.hover(); await dialog(p, lue.locator('.fr-act[data-fr-preview]'), 'LUE-MINUT.md', tag + ' button', '');
          await indd.hover(); await indd.locator('[data-fr-dl]').click(); await toastSays(p, /juliste-painoon\.indd · 38,6 Mt/);
        }
      }
      if (DIRS[v] === 'shown') {
        assert.equal(await opacity(lue.locator('.fr-acts')), 1, `${tag}: buttons always`);
        assert.ok(/Markdown · 19 riviä · 1 kt/.test(await lue.locator('.fr-sub').innerText()), `${tag}: facts on the row`);
        assert.equal(await indd.locator('[data-fr-preview]').count(), 0, `${tag}: no preview for .indd`);
        if (interact) {
          await dialog(p, row(p, 'ohjelma.pdf').locator('[data-fr-preview]'), 'ohjelma.pdf', tag, size === 'phone' ? `${n}-esikatselu.png` : '');
          await row(p, 'kutsu.docx').locator('[data-fr-dl]').click(); await toastSays(p, /kutsu\.docx · 86 kt/);
        }
      }
      if (DIRS[v] === 'open') {
        assert.equal(await p.locator('.fr-panel [data-fr-preview], .fr-panel [data-fr-dl]').count(), 0, `${tag}: buttons only in an opened row`);
        if (interact || size === 'desktop') {
          await row(p, 'juliste-a3.png').locator('.fr-main').click();
          const open = row(p, 'juliste-a3.png');
          assert.equal(await open.locator('[aria-expanded="true"]').count(), 1, `${tag}: row opens`);
          assert.ok(/PNG-kuva · 2\s480 × 3\s508 · 6,2 Mt/.test(await open.locator('.fr-more').innerText()), `${tag}: facts in the opened row`);
          await noOverflow(p, tag + ' opened');
          await shoot(p, `${n}-rivi-auki.png`);
          await indd.locator('.fr-main').click();
          assert.equal(await p.locator('.fr-o.on').count(), 1, `${tag}: one row open at a time`);
          assert.equal(await indd.locator('[data-fr-preview]').count(), 0, `${tag}: no preview for .indd`);
          assert.ok(/Selain ei osaa näyttää \.indd/.test(await indd.innerText()), `${tag}: says why`);
          if (interact) {
            await indd.locator('[data-fr-dl]').click(); await toastSays(p, /juliste-painoon\.indd/);
            await row(p, 'osallistujat.csv').locator('.fr-main').click();
            await dialog(p, row(p, 'osallistujat.csv').locator('[data-fr-preview]'), 'osallistujat.csv', tag, '');
            await row(p, 'osallistujat.csv').locator('.fr-main').click();
            assert.equal(await p.locator('.fr-o.on').count(), 0, `${tag}: row closes again`);
          }
        }
      }
      if (interact) {
        // Nested folders, then search, then Escape and the card.
        await p.locator('.fr-panel summary', { hasText: 'juhla/' }).click();
        await p.locator('.fr-panel summary', { hasText: 'valitut/' }).click();
        assert.equal(await p.locator('.fr-panel details[open]').count(), 5, `${tag}: nested folders open`);
        await noOverflow(p, tag + ' nested');
        await p.locator('.fr-panel summary', { hasText: 'valitut/' }).scrollIntoViewIfNeeded();
        await shoot(p, `${n}-alikansiot.png`);
        await p.locator('[data-fr-q]').fill('ryhmakuva');
        assert.equal(await p.locator('.fr-panel .fr-row').count(), 2, `${tag}: search across folders`);
        assert.ok(/kuvat\/juhla\/valitut\//.test(await p.locator('.fr-panel').innerText()), `${tag}: hits show their folder`);
        if (size === 'phone' || DIRS[v] === 'shown') await shoot(p, `${n}-haku.png`);
        await p.locator('[data-fr-q]').fill('');
        await p.locator('.fr-phead [data-fr-close]').focus();
        await p.keyboard.press('Escape');
        assert.ok(await p.locator('.fr-panel').evaluate(n => n.hidden), `${tag}: Escape closes the panel`);
        assert.ok(await p.locator('[data-fr-toggle]').evaluate(n => n === document.activeElement), `${tag}: focus on the toggle`);
        if (v === 0) { await noOverflow(p, tag + ' conversation'); await shoot(p, `0-keskustelu-${size}-${theme}.png`); }
        await p.locator('[data-fr-offer="juhla"] [data-fr-shelf]').click();
        await p.locator('.fr-panel:not([hidden])').waitFor();
        assert.ok(await p.locator('.fr-phead h2').evaluate(n => n === document.activeElement), `${tag}: card opens the panel at its title`);
        await p.locator('.fr-sec[data-fr-sec="juhla"] [data-fr-zip]').click(); await toastSays(p, /kevatjuhla-2027\.zip · 54 tiedostoa/);
      }
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×size×theme cases; no large preview; nested folders; row preview and download in every direction (hover, focus, touch, opened row); no preview for .indd; search across folders; Escape order and focus; card reopens the panel; picker; no overflow, console errors or network requests.`);
} finally { await browser.close(); }
