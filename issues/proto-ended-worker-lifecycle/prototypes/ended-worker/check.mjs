// Builds index.html and checks it offline: every direction at 1440 and 390 px in light and
// dark, device scale factor 2. Jari's case (one ended, unmerged run with preserved work) shows
// the idle pill with the red dot; the panel lists the five ended states; a row's actions say
// which are views, which are requests to the main agent (with the command the agent runs) and
// which touch only this view; a request becomes a draft in the composer and does nothing until
// sent; sending it resolves the row, and the direction decides where the row goes (Kuittaus:
// stays until acknowledged; Ratkaisu: ages out a day later; Siivous: moves to history at once);
// the worker view shows the report and the changes; Escape closes the panel; nothing overflows
// sideways; the picker holds; no console errors and no network requests.
// Screenshots go to evidence/.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-ended-worker-lifecycle/prototypes/ended-worker/check.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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
const evidence = path.join(here, 'evidence'); mkdirSync(evidence, { recursive: true });
const NAMES = ['1-kuittaus', '2-ratkaisu', '3-siivous'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const fit = async (p, what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${what}: horizontal overflow`);
// Panel and Jari's case in every width and theme; the steps in desktop-light and phone-dark.
let pair = false;
async function shot(p, file, always = false) {
  if (!always && !pair) return;
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  await p.screenshot({ path: path.join(evidence, file + '.png'), animations: 'disabled' });
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
}
const panel = (p) => p.locator('[data-testid="panel"]');
const pill = (p) => p.locator('[data-testid="chip-spin"]');
const dot = (p) => pill(p).locator('.corner.attn').count();
const row = (p, id) => p.locator(`.row[data-run="${id}"]`);
const openPanel = async (p) => { if (!await panel(p).count()) await pill(p).click(); await panel(p).waitFor(); };
const unfold = async (p) => { const f = p.locator('.endfold[data-key="ended"]'); if (await f.count() && await f.getAttribute('aria-expanded') === 'false') await f.click(); };
let cases = 0;
try {
  for (const [width, height, size] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) for (const theme of ['light', 'dark']) {
    pair = (size === 'desktop') === (theme === 'light');
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + path.join(here, 'index.html'));
    await p.evaluate(() => document.fonts.ready);
    assert.equal(await p.locator('html').getAttribute('data-theme'), theme);
    await checkPicker(p, 'proto-ended-worker-lifecycle');
    for (let v = 0; v < 3; v++) {
      await p.locator('.proto-picker-item').nth(v).click();
      await p.locator(`.app[data-variant]`).waitFor();
      const key = `${NAMES[v]}-${size}-${theme}`;
      if (await p.locator('#later').isChecked()) await p.locator('#later').uncheck();

      // Jari's case: no live worker, one preserved ended run. The pill says 0 with the red dot.
      await p.selectOption('#scene', 'b');
      assert.equal(await pill(p).locator('.n').innerText(), '0');
      assert.equal(await dot(p), 1);
      await openPanel(p); await unfold(p);
      assert.match(await panel(p).innerText(), /test-guide: worker-näkymän koe/);
      assert.match(await panel(p).innerText(), /ei mergetty · työ tallessa/);
      await p.locator('.more[data-id="e2"]').click();
      const acts = p.locator('[data-testid="actions"]');
      assert.match(await acts.innerText(), /Katso · ei muuta mitään/);
      assert.match(await acts.innerText(), /Pyydä pääagentilta/);
      assert.match(await acts.innerText(), /git rebase \+ merge/, 'a done run is merged with Git, not Taskfleet');
      if (v === 0) assert.match(await acts.innerText(), /Vain tämä näkymä/);
      await fit(p, key + ' jari'); await shot(p, key + '-jarin-tapaus', true);
      await p.keyboard.press('Escape');

      // All states.
      await p.selectOption('#scene', 'a');
      assert.equal(await dot(p), 1);
      await openPanel(p); await unfold(p);
      const text = await panel(p).innerText();
      for (const w of ['ei mergetty · työ tallessa', 'peruttu · työ tallessa', 'keskeytyi · jatkettavissa']) assert.ok(text.includes(w), `${key}: ${w}`);
      if (v === 2) {
        assert.match(text, /Odottaa päätöstäsi/);
        assert.ok(!text.includes('laskeutui'), 'Siivous keeps landed runs out of the panel');
        await fit(p, key); await shot(p, key + '-paneeli', true);
        await p.locator('[data-act="history"]').click();
        const hist = await panel(p).innerText();
        assert.match(hist, /laskeutui/); assert.match(hist, /epäonnistui/);
        await shot(p, key + '-historia');
        await p.locator('[data-act="hist-back"]').click();
      } else {
        assert.match(text, /laskeutui/); assert.match(text, /epäonnistui/);
        await fit(p, key); await shot(p, key + '-paneeli', true);
      }
      // Interrupted: resume and salvage are Taskfleet's own commands.
      await p.locator('.more[data-id="e5"]').click();
      assert.match(await p.locator('[data-testid="actions"]').innerText(), /taskfleet run reattach/);
      assert.match(await p.locator('[data-testid="actions"]').innerText(), /taskfleet run salvage/);
      await p.locator('.more[data-id="e5"]').click();
      // Cancelled: discard is Taskfleet's own.
      await p.locator('.more[data-id="e4"]').click();
      assert.match(await p.locator('[data-testid="actions"]').innerText(), /taskfleet run discard/);
      await fit(p, key + ' actions'); await shot(p, key + '-toiminnot');
      await p.locator('.more[data-id="e4"]').click();

      if (v === 0) {
        // Acknowledging a run without work hides it; one with work asks first.
        await row(p, 'e3').locator('[data-act="ack"]').click();
        assert.equal(await panel(p).locator('.group[aria-label="Workerit: päättyneet"] .row[data-run="e3"]').count(), 0);
        await row(p, 'e2').locator('[data-act="ack"]').click();
        assert.match(await p.locator('.confirm').innerText(), /Työ jää haaraan/);
        await fit(p, key + ' confirm'); await shot(p, key + '-kuittaa-tallessa');
        await p.locator('[data-act="ack-yes"]').click();
        await p.locator('.endfold[data-key="acked"]').click();
        assert.equal(await p.locator('.group[aria-label="Workerit: kuitatut"] .row').count(), 2);
        assert.equal(await dot(p), 1, 'cancelled and interrupted still need the person');
        await shot(p, key + '-kuitatut');
        await p.locator('.row[data-run="e2"] [data-act="unack"]').click();
      }

      // A request: drafted into the composer, nothing happens until sent.
      await p.locator('.more[data-id="e2"]').click();
      await p.locator('[data-testid="actions"] [data-do="merge"]').click();
      assert.equal(await panel(p).count(), 0);
      const draft = p.locator('[data-testid="draft"]');
      assert.match(await draft.innerText(), /Mitään ei tapahdu ennen kuin lähetät/);
      assert.match(await p.locator('.cbox textarea').inputValue(), /rebasea haara/);
      assert.ok(await p.locator('.cbox textarea').evaluate(n => n === document.activeElement), 'the draft has focus');
      await fit(p, key + ' draft'); await shot(p, key + '-luonnos');
      await p.locator('[data-act="send"]').click();
      assert.equal(await draft.count(), 0);
      assert.match(await p.locator('.thread').innerText(), /mergesin sen/);
      await openPanel(p); await unfold(p);
      if (v === 2) {
        assert.equal(await row(p, 'e2').count(), 0, 'Siivous: resolved row moves to history');
      } else {
        assert.match(await row(p, 'e2').innerText(), /mergetty käsin/);
      }
      await shot(p, key + '-ratkaistu');
      // A day later: only Ratkaisu drops the rows without work.
      await p.keyboard.press('Escape');
      await p.locator('#later').check();
      await openPanel(p); await unfold(p);
      const later = await panel(p).innerText();
      if (v === 1) { assert.ok(!later.includes('Kuvien pakkaus') && !later.includes('worker-näkymän koe'), 'Ratkaisu: rows without work aged out'); assert.match(later, /Lomakkeen saavutettavuus/); }
      if (v === 0) assert.match(later, /Kuvien pakkaus/);
      if (v === 1) await shot(p, key + '-vuorokautta-myohemmin');
      await p.locator('#later').uncheck();

      // The worker view: report, changes, the decision at the foot.
      await openPanel(p); await unfold(p);
      await row(p, 'e4').locator('.row-main').click();
      await p.locator('[data-testid="worker-view"]').waitFor();
      assert.equal(await p.locator('.wv-tabs [data-tab="report"]').getAttribute('aria-selected'), 'true');
      assert.match(await p.locator('[data-testid="worker-decide"]').innerText(), /Mitä tälle työlle tehdään/);
      await p.locator('.wv-tabs [data-tab="changes"]').click();
      assert.match(await p.locator('[data-testid="diff"]').innerText(), /Lomake\.tsx/);
      await fit(p, key + ' worker');
      if (v === 1) await shot(p, `worker-muutokset-${size}-${theme}`);
      await p.locator('.wv-back').click();
      await panel(p).waitFor();
      await p.keyboard.press('Escape');
      assert.equal(await panel(p).count(), 0);
      assert.ok(await pill(p).evaluate(n => n === document.activeElement), 'Escape returns focus to the pill');
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction × width × theme cases; Jari's case, five ended states, action kinds and commands, acknowledgement, draft-then-send, where a resolved row goes, the day-later rule, worker view report and changes, Escape focus, no overflow, picker, no console errors or network requests.`);
} finally { await browser.close(); }
