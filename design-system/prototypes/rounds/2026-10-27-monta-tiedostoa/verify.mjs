// Builds the round into its issue and checks it offline: every direction at 1440 and 390 px in
// light and dark, the whole conversation in one tall frame; four offer cards with the version
// notes; the gallery steps through one offer's images and Escape returns focus; Ryhmät's groups
// open and its file filter finds nauvo-satama.jpg; Kansio navigates into a folder, searches the
// package and unfolds the superseded version; Hylly's panel opens from the top bar and from a
// card, searches every offer and previews the selected file; downloads toast; nothing overflows
// horizontally; the picker holds; no console errors or network requests. Screenshots at device
// scale factor 2 into the issue's evidence directory.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-27-monta-tiedostoa/verify.mjs
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

const dir = path.join(root, 'issues/proto-file-offer-many/prototypes/file-offer-many');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const DIRS = ['type', 'folder', 'shelf'];
const NAMES = ['ryhmat', 'kansio', 'hylly'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const pick = async (p, v) => { await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click(); await p.locator(`.mf-dir-${DIRS[v]}`).waitFor(); await p.waitForTimeout(400); };
const hidePicker = (p, on) => p.locator('.proto-picker').evaluate((n, on) => { n.style.visibility = on ? 'hidden' : ''; }, on);
async function shoot(p, file, sel = '.frame') { await p.evaluate(() => document.querySelector('.toast')?.classList.remove('on')); await hidePicker(p, true); await p.locator(sel).first().screenshot({ path: path.join(out, file) }); await hidePicker(p, false); }
// The frame grows to the whole conversation so one picture shows every card.
async function tall(p) {
  await p.evaluate(() => { document.querySelector('.frame').style.height = ''; });
  const h = await p.evaluate(() => { const s = document.querySelector('#stage'), f = document.querySelector('.frame'); return f.clientHeight + s.scrollHeight - s.clientHeight + 8; });
  await p.evaluate((h) => { document.querySelector('.frame').style.setProperty('height', h + 'px', 'important'); }, h);
  await p.waitForTimeout(100);
}
const short = (p) => p.evaluate(() => { document.querySelector('.frame').style.height = ''; });
async function noOverflow(p, tag) {
  for (const sel of ['.topbar', '.frame', 'body', '#stage', '.mf-dlg[open]', '.mf-panel:not([hidden])', '.mf-plist']) {
    const loc = p.locator(sel).first(); if (!(await loc.count()) || !(await loc.isVisible())) continue;
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
  for (const c of await p.locator('.mf-card:visible').all()) assert.ok(await c.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: a card overflows`);
}
const card = (p, k) => p.locator(`[data-mf-offer="${k}"]`);
async function gallery(p, opener, tag, shot) {
  await opener.click();
  const d = p.locator('.mf-dlg[open]'); await d.waitFor();
  const pos = await d.locator('.mf-gpos').innerText();
  await p.keyboard.press('ArrowRight');
  const pos2 = await d.locator('.mf-gpos').innerText();
  assert.notEqual(pos, pos2, `${tag}: arrow steps the gallery`);
  await d.getByRole('button', { name: 'Edellinen kuva' }).click();
  assert.equal(await d.locator('.mf-gpos').innerText(), pos, `${tag}: back again`);
  await noOverflow(p, tag);
  if (shot) await shoot(p, shot, '.mf-dlg[open]');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.mf-dlg[open]'));
  assert.ok(await opener.evaluate(n => n === document.activeElement), `${tag}: focus returns to the opener`);
}
const toastSays = (p, re) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector('.toast')?.textContent || ''), re.source);
let cases = 0;
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (width === 390) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, '2026-10-27-monta-tiedostoa');
    const interact = theme === 'light';
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`, n = `${v + 1}-${NAMES[v]}-${size}-${theme}`;
      await pick(p, v);
      await tall(p);
      await noOverflow(p, tag);
      const text = await p.locator('#stage').innerText();
      assert.ok(!/undefined|NaN|\bnull\b/.test(text), `${tag}: bad text`);
      assert.equal(await p.locator('.mf-card').count(), 4, `${tag}: four offers`);
      assert.ok(/Korvaa klo 13\.19 tarjotun version: 2 muuttunutta, 1 uusi/.test(await card(p, 'paketti2').innerText()), `${tag}: new version says what changed`);
      assert.ok(/33 tiedostoa · 5 kansiota/.test(await card(p, 'paketti2').innerText()), `${tag}: package facts`);
      await shoot(p, `${n}.png`);
      if (DIRS[v] === 'type') {
        assert.equal(await card(p, 'paketti2').locator('.mf-group').count(), 4, `${tag}: four type groups`);
        assert.ok(/\+16/.test(await card(p, 'paketti2').locator('.mf-mosaic').innerText()), `${tag}: mosaic counts the rest`);
        if (interact) {
          await card(p, 'paketti2').locator('.mf-group summary').first().click();
          assert.equal(await card(p, 'paketti2').locator('.mf-group[open] .mf-row').count(), 21, `${tag}: photos group lists 21`);
          await gallery(p, card(p, 'paketti2').locator('.mf-tile').nth(2), tag + ' gallery', size === 'desktop' ? `${n}-galleria.png` : '');
          await card(p, 'paketti2').locator('[data-mf-zip]').click(); await toastSays(p, /kumppanipaketti\.zip · 33 tiedostoa/);
          await card(p, 'some').locator('.mf-group summary').first().click();
          await tall(p); await noOverflow(p, tag + ' groups open');
          await shoot(p, `${n}-ryhmat-auki.png`);
          await short(p);
          await p.locator('.mf-tb[data-mf-only]').click();
          await p.locator('[data-mf-tq]').fill('nauvo-satama');
          assert.equal(await p.locator('.mf-row:visible').count(), 2, `${tag}: filter finds both versions`);
          assert.equal(await p.locator('.mf-card:visible').count(), 2, `${tag}: only the matching offers`);
          assert.ok(/2 osumaa, 2 tarjouksessa/.test(await p.locator('.mf-fcount').innerText()), `${tag}: hit count`);
          await noOverflow(p, tag + ' filtered');
          await shoot(p, `${n}-suodatus.png`);
          await p.locator('[data-mf-tq]').fill('');
          await p.locator('.mf-filter [data-mf-only]').click();
          assert.equal(await p.locator('.mf-only').count(), 0, `${tag}: filter off`);
        }
      }
      if (DIRS[v] === 'folder') {
        assert.ok(await card(p, 'paketti').evaluate(n => n.classList.contains('mf-folded')), `${tag}: old version folded`);
        assert.equal(await card(p, 'paketti2').locator('.mf-dirrow').count(), 5, `${tag}: five folders`);
        if (interact) {
          await card(p, 'paketti2').locator('[data-mf-cd="etappi-2-nauvo-korppoo"]').click();
          assert.ok(/etappi-2-nauvo-korppoo/.test(await card(p, 'paketti2').locator('.mf-crumbs').innerText()), `${tag}: breadcrumb`);
          assert.equal(await card(p, 'paketti2').locator('.mf-grid .mf-tile').count(), 5, `${tag}: five photos in the folder`);
          assert.equal(await card(p, 'paketti2').locator('.mf-tstate').count(), 1, `${tag}: the changed photo is marked`);
          await card(p, 'paketti2').locator('[data-mf-zipdir]').click(); await toastSays(p, /etappi-2-nauvo-korppoo\.zip · 6 tiedostoa/);
          await gallery(p, card(p, 'paketti2').locator('.mf-grid .mf-tile').first(), tag + ' gallery', size === 'phone' ? `${n}-galleria.png` : '');
          await tall(p); await shoot(p, `${n}-kansiossa.png`); await short(p);
          await card(p, 'paketti2').locator('.mf-crumb[data-mf-cd]').click();
          assert.equal(await card(p, 'paketti2').locator('.mf-dirrow').count(), 5, `${tag}: back at the root`);
          await card(p, 'paketti2').locator('[data-mf-fq]').fill('lautta');
          assert.equal(await card(p, 'paketti2').locator('.mf-row').count(), 3, `${tag}: package search`);
          await card(p, 'paketti').getByRole('button', { name: 'Näytä tämä versio' }).click();
          assert.equal(await card(p, 'paketti').locator('.mf-dirrow').count(), 5, `${tag}: old version unfolds`);
          await tall(p); await noOverflow(p, tag + ' opened');
          await shoot(p, `${n}-haku-ja-aiempi.png`);
          await short(p);
        }
      }
      if (DIRS[v] === 'shelf') {
        assert.ok(await p.locator('.mf-panel').evaluate(n => n.hidden), `${tag}: panel starts closed`);
        if (interact || size === 'desktop') {
          await short(p);
          await p.locator('[data-mf-ptoggle]').click();
          await p.locator('.mf-panel:not([hidden])').waitFor();
          assert.equal(await p.locator('.mf-plist > section').count(), 3, `${tag}: three live offers`);
          assert.ok(/Aiemmat versiot/.test(await p.locator('.mf-plist').innerText()), `${tag}: older versions section`);
          await noOverflow(p, tag + ' panel');
          await shoot(p, `${n}-paneeli.png`);
          if (interact) {
            await p.locator('[data-mf-sq]').fill('nauvo-satama');
            assert.equal(await p.locator('.mf-prow').count(), 2, `${tag}: panel search finds both versions`);
            await p.locator('.mf-prow').first().click();
            assert.ok(/nauvo-satama\.jpg/.test(await p.locator('.mf-pview').innerText()), `${tag}: preview of the selection`);
            await shoot(p, `${n}-paneeli-haku.png`);
            await gallery(p, p.locator('.mf-pview [data-mf-open]').last(), tag + ' gallery', '');
            await p.keyboard.press('Escape');
            assert.ok(await p.locator('.mf-panel').evaluate(n => n.hidden), `${tag}: Escape closes the panel`);
            assert.ok(await p.locator('[data-mf-ptoggle]').evaluate(n => n === document.activeElement), `${tag}: focus back on the toggle`);
            await card(p, 'some').getByRole('button', { name: 'Näytä tiedostot' }).click();
            assert.ok(/etappi-1-nelio\.png/.test(await p.locator('.mf-pview').innerText()), `${tag}: card opens its offer`);
            await p.locator('[data-mf-pclose]').click();
          } else await p.locator('[data-mf-pclose]').click();
        }
      }
      if (interact) { await card(p, 'juliste').locator('[data-mf-dl]').click(); await toastSays(p, /juliste-a2\.png · 8,4 Mt/); }
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×size×theme cases; four offers with version notes; gallery steps and returns focus; type groups and file filter; folder navigation, package search and unfolding the old version; shelf panel, search, preview and Escape; downloads; picker; no overflow, console errors or network requests.`);
} finally { await browser.close(); }
