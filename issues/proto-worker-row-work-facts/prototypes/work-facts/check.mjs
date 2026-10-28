// Builds index.html and checks it offline: every variant at 1440 and 390 px in light and dark,
// device scale factor 2. The Workers panel shows each worker's work in the variant's form (Lause:
// words on the second line; Luvut: marks at the row's end; Työrivi: a third line), the same
// facts in every accessible name; nothing yet and unknown are told apart; a merged row says no
// work; gh not logged in hides PR facts behind one panel note; "Worker etenee" changes counts
// without changing the row's height; the rail's worktree conversations carry the same facts;
// the worker view carries them (Luvut: chip and layer, Työrivi: Työ card). Nothing overflows
// sideways, the picker holds, no console errors or network. Screenshots go to evidence/ as AVIF.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-worker-row-work-facts/prototypes/work-facts/check.mjs
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
const evidence = path.join(here, 'evidence'); mkdirSync(evidence, { recursive: true });
const scratch = mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'work-facts-'));
const NAMES = ['1-lause', '2-luvut', '3-tyorivi'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const fit = async (p, what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${what}: horizontal overflow`);
async function shot(p, file) {
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  const png = path.join(scratch, file + '.png');
  await p.screenshot({ path: png, animations: 'disabled' });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '40', '-cpu-used', '6', '-pix_fmt', 'yuv444p', path.join(evidence, file + '.avif')]);
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
}
const row = (p, id) => p.locator(`.pop .row[data-run="${id}"]`);
const facts = (p, id) => row(p, id).locator('[data-testid="facts"]');
const label = async (loc) => loc.getAttribute('aria-label');
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();
let cases = 0;
try {
  for (const [width, height, size] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) for (const theme of ['light', 'dark']) {
    const phone = size === 'phone';
    const full = theme === 'light';
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + path.join(here, 'index.html'));
    await p.evaluate(() => document.fonts.ready);
    assert.equal(await p.locator('html').getAttribute('data-theme'), theme);
    await checkPicker(p, 'proto-worker-row-work-facts');
    for (let v = 0; v < 3; v++) {
      await p.locator('.proto-picker-item').nth(v).click();
      await p.locator('.app[data-variant]').waitFor();
      await p.selectOption('#scene', 'a');
      const key = `${NAMES[v]}-${size}-${theme}`;

      // ---- The panel: the same facts in every variant's words.
      await p.locator('[data-testid="panel"]').waitFor();
      assert.match(await label(facts(p, 'w1')), /^2 committia haarassa, 3 tiedostoa commitoimatta\. 146 riviä lisätty ja 12 poistettu\. Ei pull requestia\.$/);
      assert.match(await label(facts(p, 'w3')), /PR #412 \(luonnos\): tarkistukset käynnissä\./);
      assert.match(await label(facts(p, 'w2')), /^Ei vielä muutoksia\./);
      assert.match(await label(facts(p, 'e2')), /main on edennyt 5 commitilla\./);
      assert.match(await label(facts(p, 'e4')), /PR #405: tarkistus epäonnistui\./);
      assert.equal(await facts(p, 'e1').count(), 0, 'a merged row says no work');
      const w2 = await txt(facts(p, 'w2'));
      if (v === 0) {
        assert.match(await txt(row(p, 'w1').locator('.line2')), /agentti odottaa · 2 committia · 3 muutosta/);
        assert.match(await txt(row(p, 'e2').locator('.line2')), /työ tallessa · 3 committia · Pi/);
        assert.match(await txt(row(p, 'e4').locator('.line2')), /1 commit · 2 muutosta · PR #405 tarkistus epäonnistui/);
        assert.equal(w2, 'ei vielä muutoksia');
        // Desktop: one line. Phone: whole clauses wrap, so the PR's verdict is never cut off.
        if (phone) assert.ok(await row(p, 'e4').locator('.f1-check').evaluate(n => { const a = n.getBoundingClientRect(), b = n.closest('.pop-body').getBoundingClientRect(); return a.right <= b.right && a.width > 20; }), 'PR verdict visible on the phone');
        else for (const id of ['w1', 'w3', 'e4']) assert.ok((await row(p, id).locator('.line2').evaluate(n => n.getBoundingClientRect().height)) < 20, `${key} ${id}: second line wraps`);
      } else if (v === 1) {
        assert.equal(await row(p, 'w1').locator('.f2-n').count(), 2, 'ahead and changed files');
        assert.equal(await row(p, 'e2').locator('.f2-n.behind').isVisible(), !phone, 'behind shown when the source moved on (desktop)');
        assert.equal(await row(p, 'e4').locator('.f2-pr[data-tone="err"]').count(), 1);
        assert.equal(await row(p, 'w3').locator('.f2-pr[data-draft="true"]').count(), 1);
        assert.equal(w2, '', 'nothing yet: no marks, as on the Git chip');
        assert.equal(await row(p, 'w1').locator('.f2-lines').isVisible(), !phone, 'phone drops the line counts from the row');
      } else {
        assert.equal(await row(p, 'w1').locator('.f3-bar i[data-c="a"]').count(), 5);
        assert.match(await txt(row(p, 'e4').locator('.f3-pr')), /#405 1\/4 epäonnistui/);
        assert.match(await txt(row(p, 'w3').locator('.f3-pr')), /#412 luonnos 2\/3 · 1 käynnissä/);
        assert.equal(w2, 'Ei vielä muutoksia');
      }
      await fit(p, key + ' panel');
      await shot(p, key + '-paneeli');

      // ---- The worker produces more: counts change, the row keeps its height.
      const h0 = await row(p, 'w1').evaluate(n => n.getBoundingClientRect().height);
      await p.click('#tick');
      assert.match(await label(facts(p, 'w1')), /^3 committia haarassa, 1 tiedosto commitoimatta\. 171 riviä/);
      assert.equal(await row(p, 'w1').evaluate(n => n.getBoundingClientRect().height), h0, `${key}: row height changed`);

      // ---- PR opens on GitHub (offline: says so). Lause has no link on the row: the row is
      // one button, so its PR opens from the worker view.
      assert.equal(await row(p, 'e4').locator('[data-act="pr"]').count(), v === 0 ? 0 : 1);
      if (v) {
        await row(p, 'e4').locator('[data-act="pr"]').click();
        assert.match(await p.locator('.toast').innerText(), /PR #405/);
        await p.locator('[data-testid="panel"]').waitFor();
      }

      // ---- The worker view.
      await row(p, 'e4').locator('.row-main').click();
      await p.locator('[data-testid="worker-view"]').waitFor();
      if (v === 0) {
        assert.match(await txt(p.locator('.wv-sentence')), /1 commit haarassa, 2 tiedostoa commitoimatta/);
        await p.locator('.wv-meta [data-act="pr"]').click();
        assert.match(await p.locator('.toast').innerText(), /PR #405/);
      }
      if (v === 1) {
        await p.locator('[data-testid="worker-chip"]').click();
        assert.match(await txt(p.locator('[data-testid="layer"]')), /src\/Lomake\.tsx[\s\S]*e2e/);
        await fit(p, key + ' layer');
        if (full) await shot(p, key + '-worker-taso');
        await p.keyboard.press('Escape');
        assert.equal(await p.locator('[data-testid="layer"]').count(), 0);
        assert.ok(await p.locator('.wv-chip').evaluate(n => n === document.activeElement), 'Escape returns focus to the chip');
      }
      if (v === 2) assert.match(await txt(p.locator('[data-testid="workcard"]')), /Työ[\s\S]*src\/Lomake\.tsx[\s\S]*e2e epäonnistui/);
      await fit(p, key + ' worker');
      await shot(p, key + '-worker');
      await p.locator('.wv-back').click();
      await p.locator('[data-testid="panel"]').waitFor();

      // ---- The rail's worktree conversations. On the phone the open panel covers the menu
      // button, as in production, so it is closed first.
      if (phone) { await p.keyboard.press('Escape'); await p.locator('.topbar [data-act="drawer"]').click(); }
      const place = p.locator('[data-testid="place-zoom"]');
      assert.match(await place.getAttribute('aria-label'), /Worktree-agentti\. 2 committia haarassa, 1 tiedosto commitoimatta\. 40 riviä lisätty ja 3 poistettu\. PR #409: tarkistukset läpi\./);
      assert.match(await p.locator('[data-testid="place-siivo"]').getAttribute('aria-label'), /työ yhdistetty/);
      assert.equal(await p.locator('[data-testid="place-siivo"] [data-testid="facts"]').count(), 0);
      if (phone || full) await shot(p, key + '-sivupalkki');
      await place.click();
      assert.equal(await p.locator('.main').getAttribute('data-conv'), 'zoom');
      if (phone) await p.locator('.topbar [data-act="drawer"]').click();
      await p.locator('.conv[data-to="ilta"]').click();
      await p.locator('[data-testid="panel"]').waitFor();

      // ---- gh not logged in: no PR facts anywhere, one note in the panel; nothing says "no PR".
      await p.selectOption('#scene', 'b');
      assert.match(await p.locator('[data-testid="pr-note"]').innerText(), /gh ei ole kirjautunut/);
      assert.equal(await p.locator('.pop [data-act="pr"]').count(), 0);
      assert.match(await label(facts(p, 'e4')), /PR-tieto ei saatavilla\./);
      await fit(p, key + ' gh');
      if (full) await shot(p, key + '-ei-gh');

      // ---- Git does not answer for one worker: unknown, never zero.
      await p.selectOption('#scene', 'c');
      assert.match(await label(facts(p, 'w1')), /Työn tila ei tiedossa/);
      assert.notEqual(await txt(facts(p, 'w1')), await txt(facts(p, 'w2')), 'unknown differs from nothing yet');
      if (full) await shot(p, key + '-git-ei-vastaa');
      await p.selectOption('#scene', 'a');
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} variant × width × theme cases; same facts in every accessible name; variant forms; nothing yet vs unknown; merged says no work; progress keeps row height; PR link; worker view (sentence / chip layer with Escape focus / Työ card); rail worktree rows; gh missing → one note, no PR claims; no overflow, picker, no console errors or network requests.`);
} finally { await browser.close(); }
