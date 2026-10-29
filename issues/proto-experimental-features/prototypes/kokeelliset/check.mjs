// Builds index.html and checks it offline: every direction at 1440 and 390 px in light and dark,
// device scale factor 2. In each: the section lists the three features off by default; turning
// each on takes effect at once (next row, worker sentence on the panel and the rail, Katso
// päätteessä and its read-only dock); a failing save keeps the feature off and says so. Merkki
// marks each feature where it appears, and its popover turns it off with an undo and leads to
// the setting; Rivit and Esittely leave the features unmarked. Nothing overflows sideways, the
// picker holds, no console errors or network.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-experimental-features/prototypes/kokeelliset/check.mjs [--evidence]
// --evidence writes the PNG screenshots into evidence/; convert them with
//   python3 scripts/screenshots-to-avif.py issues/proto-experimental-features/prototypes/kokeelliset/evidence
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { checkPicker } = await import(path.join(root, 'design-system/prototypes/picker-check.mjs'));
// A worker may reuse the source checkout's installed browser tools, read-only.
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
let require = createRequire(path.join(root, 'web/package.json'));
try { require.resolve('playwright'); } catch { require = createRequire(path.join(path.dirname(common), 'web/package.json')); }
const { chromium } = require('playwright');

execFileSync('node', [path.join(here, 'build.mjs')], { stdio: 'inherit' });
const keep = process.argv.includes('--evidence');
const out = keep ? path.join(here, 'evidence') : mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'kokeelliset-'));
mkdirSync(out, { recursive: true });
const NAMES = ['1-rivit', '2-merkki', '3-esittely'];
const browser = await chromium.launch();
const errors = [], requests = [];
const fit = async (p, what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${what}: horizontal overflow`);
async function shot(p, file) {
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  await p.screenshot({ path: path.join(out, file + '.png'), animations: 'disabled' });
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
}
const set = (p, patch) => p.evaluate((x) => window.__proto.set(x), patch);
const flags = (p) => p.evaluate(() => ({ ...window.__proto.S.flags }));
let cases = 0;
try {
  for (const [width, height, size] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) for (const theme of ['light', 'dark']) for (let v = 0; v < 3; v++) {
    const phone = size === 'phone';
    const tag = `${NAMES[v]}-${size}-${theme}`;
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    p.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
    p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
    await p.goto(`file://${path.join(here, 'index.html')}?v=${v + 1}`);
    await p.evaluate(() => document.fonts.ready);
    assert.equal(await p.locator('html').getAttribute('data-theme'), theme);
    await checkPicker(p, 'proto-experimental-features');
    assert.equal(await p.locator('.proto-picker-item[data-active]').innerText(), ['Rivit', 'Merkki', 'Esittely'][v]);

    // The section, everything off.
    await p.getByTestId('settings-section-kokeelliset').waitFor();
    for (const id of ['next', 'sentence', 'mirror'])
      assert.equal(await p.locator(`[data-testid="exp-${id}"] [data-on="0"]`).getAttribute('aria-pressed'), 'true', `${tag}: ${id} off by default`);
    assert.equal(await p.locator('.ex-card').count(), v === 2 ? 3 : 0, `${tag}: Esittely cards`);
    await fit(p, tag);
    await shot(p, `${tag}-asetukset-pois`);

    // A failing save keeps the feature off and says so.
    if (!phone && theme === 'light') {
      await p.locator('#fail').check();
      await p.locator('[data-testid="exp-next"] [data-on="1"]').click();
      await p.getByTestId('exp-error').waitFor();
      assert.equal((await flags(p)).next, false, `${tag}: failed save stays off`);
      await shot(p, `${tag}-tallennus-epaonnistui`);
      await p.getByRole('button', { name: 'Lue tallennettu valinta' }).click();
      await p.locator('#fail').uncheck();
    }

    // Turning each on: immediate, all three.
    for (const id of ['next', 'sentence', 'mirror']) {
      await p.locator(`[data-testid="exp-${id}"] [data-on="1"]`).click();
      await p.waitForFunction((k) => window.__proto.S.flags[k] && !window.__proto.S.busy, id);
    }
    assert.match(await p.locator('.s-note[role="status"]').innerText(), /kaikilla laitteillasi/);
    await fit(p, tag);
    await shot(p, `${tag}-asetukset-paalla`);

    // Iltakierros: next row, the sentence on the panel and on the rail.
    if (phone) {
      await p.getByTestId('settings-close').click();
    } else {
      await p.getByTestId('settings-close').click();
    }
    await p.getByTestId('next-row').waitFor();
    assert.equal(await p.getByTestId('sentence').count(), 3, `${tag}: sentence on every worker row`);
    assert.match(await p.getByTestId('sentence').first().innerText(), /2 committia · 3 muutosta/);
    if (phone) {
      await p.locator('.hamb').click();
      assert.ok(await p.getByTestId('rail-sentence').isVisible(), `${tag}: rail sentence in the drawer`);
      await p.locator('.app').click({ position: { x: width - 10, y: 300 } });
      assert.equal(await p.evaluate(() => window.__proto.S.drawer), false, `${tag}: drawer closes`);
    } else {
      assert.ok(await p.getByTestId('rail-sentence').isVisible(), `${tag}: rail sentence`);
    }
    const tags = await p.locator('.exp-tag').count();
    assert.equal(tags, v === 1 ? 2 : 0, `${tag}: Kokeellinen tags in Iltakierros`);
    await fit(p, tag);
    await shot(p, `${tag}-iltakierros`);

    if (v === 1) {
      await p.getByTestId('tag-next').click();
      await p.getByTestId('pop-next').waitFor();
      const pop = await p.getByTestId('pop-next').boundingBox();
      assert.ok(pop.x >= 0 && pop.x + pop.width <= width, `${tag}: popover inside the screen`);
      await shot(p, `${tag}-merkki-auki`);
      await p.keyboard.press('Escape');
      assert.equal(await p.getByTestId('pop-next').count(), 0, `${tag}: Esc closes the popover`);
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.testid), 'tag-next', `${tag}: focus back on the tag`);
      await p.getByTestId('tag-next').click();
      await p.getByRole('button', { name: 'Poista käytöstä' }).click();
      await p.waitForFunction(() => !window.__proto.S.flags.next && !window.__proto.S.busy);
      assert.equal(await p.getByTestId('next-row').count(), 0, `${tag}: off from the popover`);
      await p.getByTestId('toast').waitFor();
      await shot(p, `${tag}-poistettu`);
      await p.getByRole('button', { name: 'Kumoa' }).click();
      await p.getByTestId('next-row').waitFor();
      // The popover leads to the setting.
      await p.getByTestId('tag-sentence').click();
      await p.getByTestId('pop-sentence').getByRole('button', { name: /Asetukset/ }).click();
      await p.getByTestId('settings-section-kokeelliset').waitFor();
      await p.waitForFunction(() => document.activeElement?.dataset.settingsRow === 'worker-row-sentence');
      await shot(p, `${tag}-asetukseen`);
      await p.getByTestId('settings-close').click();
    }

    // Status-skripti: Katso päätteessä and the read-only dock.
    await set(p, { view: 'status', from: 'status', dock: false });
    await p.getByTestId('watch').click();
    await p.getByTestId('dock').waitFor();
    assert.match(await p.getByTestId('dock').innerText(), /vain luku/);
    assert.equal(await p.locator('.exp-tag').count(), v === 1 ? 1 : 0, `${tag}: tag on the terminal footer`);
    await fit(p, tag);
    await shot(p, `${tag}-paate`);

    // Off again: today's footer, no button.
    await set(p, { flags: { next: false, sentence: false, mirror: false }, dock: false });
    assert.equal(await p.getByTestId('watch').count(), 0, `${tag}: no Katso when off`);
    assert.match(await p.getByTestId('ro-foot').innerText(), /aktiivinen kirjoittaja/);
    if (v === 2) {
      await set(p, { view: 'settings', section: 'kokeelliset', detail: true });
      await p.getByTestId('ex-mirror').getByRole('button', { name: /Näytä/ }).click();
      assert.equal(await p.evaluate(() => window.__proto.S.view), 'status', `${tag}: Esittely shows the place`);
    }
    // Account menu opens Settings on desktop; phone opens it from the drawer.
    if (phone) await p.locator('.hamb').click();
    await p.getByTestId('account').click();
    await p.getByTestId('menu-settings').click();
    await p.getByTestId('settings-section-kokeelliset').waitFor();
    if (phone) {
      await p.getByRole('button', { name: '← Asetukset' }).click();
      assert.ok(await p.getByTestId('settings-kokeelliset').isVisible(), `${tag}: phone section list`);
      await fit(p, tag);
      if (theme === 'light') await shot(p, `${tag}-osiolista`);
    }
    assert.deepEqual(errors, []);
    cases++;
    await p.close();
  }
  assert.deepEqual(requests, [], 'network requests');
  console.log(`ok: ${cases} variant × width × theme cases; screenshots in ${out}`);
} finally {
  await browser.close();
}
