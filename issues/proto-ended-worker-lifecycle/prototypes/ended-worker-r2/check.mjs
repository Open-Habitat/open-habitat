// Builds index.html and checks it offline: every variant at 1440 and 390 px in light and dark,
// device scale factor 2. Jari's case shows a red ball on the idle pill instead of "0"; the list
// holds only rows whose branch or worktree exists, so a landed or failed-without-work worker
// leaves it the moment it ends; every ended row tells the agent through a draft that does
// nothing until sent, and the sent request that removes the branch and worktree removes the
// row; the browser's own worktree removal follows the variant (Pyyntö: none; Yhdistetty: only
// a merged worktree, which takes the row; Worktree: any the existing flow accepts, and an
// unmerged branch keeps the row and the ball; an interrupted run's worktree is blocked);
// the worker view shows the report, changes and the same actions; Escape closes the dialog and
// the panel; nothing overflows sideways; the picker holds; no console errors or network.
// Screenshots go to evidence/.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-ended-worker-lifecycle/prototypes/ended-worker-r2/check.mjs
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
const NAMES = ['1-pyynto', '2-yhdistetty', '3-worktree'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const fit = async (p, what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${what}: horizontal overflow`);
// The panel and Jari's case in every width and theme; the steps in desktop-light and phone-dark.
let pair = false;
async function shot(p, file, always = false) {
  if (!always && !pair) return;
  // On the phone, only the views whose layout differs from the desktop.
  if (!always && file.includes('-phone-') && !/-(paneeli|jarin-ratkaistu|poista-ei-mergetty|worker-raportti)$/.test(file)) return;
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  await p.screenshot({ path: path.join(evidence, file + '.png'), animations: 'disabled' });
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
}
const panel = (p) => p.locator('[data-testid="panel"]');
const pill = (p) => p.locator('[data-testid="chip-spin"]');
const balls = (p) => pill(p).locator('.ball').count();
const row = (p, id) => p.locator(`.row[data-run="${id}"]`);
const openPanel = async (p) => { if (!await panel(p).count()) await pill(p).click(); await panel(p).waitFor(); };
const closePanel = async (p) => { if (await panel(p).count()) await p.keyboard.press('Escape'); };
const menu = async (p, id) => { await row(p, id).locator('.tell').click(); return row(p, id).locator('[data-testid="requests"]'); };
const send = async (p, id, act) => {
  await openPanel(p);
  await (await menu(p, id)).locator(`[data-do="${act}"]`).click();
  assert.equal(await panel(p).count(), 0, 'a request closes the panel');
  assert.match(await p.locator('[data-testid="draft"]').innerText(), /Mitään ei tapahdu ennen kuin lähetät/);
  await p.locator('[data-act="send"]').click();
};
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
      await p.locator('.app[data-variant]').waitFor();
      const key = `${NAMES[v]}-${size}-${theme}`;

      // Jari's case: nothing live, one unfinished run. The pill shows a red ball, not "0".
      await p.selectOption('#scene', 'b');
      assert.equal(await pill(p).locator('.n').count(), 0, 'no "0" on the idle pill');
      assert.equal(await balls(p), 1);
      assert.match(await pill(p).getAttribute('aria-label'), /1 keskeneräinen/);
      await shot(p, key + '-jarin-siru', size === 'phone' && theme === 'light' && v === 0);
      await openPanel(p);
      assert.match(await panel(p).innerText(), /ei mergetty · työ tallessa/);
      assert.equal(await row(p, 'e2').locator('.ball').count(), 1);
      assert.equal(await row(p, 'e2').locator('.rm').count(), v === 2 ? 1 : 0, 'a remove button on an unmerged row only in Worktree');
      const m = await menu(p, 'e2');
      assert.match(await m.innerText(), /Kerro pääagentille/);
      assert.match(await m.innerText(), /git rebase \+ merge/, 'a done run is merged with Git, not Taskfleet');
      assert.match(await m.innerText(), /Kirjoita oma viesti/);
      await fit(p, key + ' jari'); await shot(p, key + '-jarin-tapaus', true);
      if (v === 2) {
        // The existing flow removes the checkout and keeps the unmerged branch: the row stays.
        await row(p, 'e2').locator('.rm').click();
        const dlg = p.locator('[data-testid="remove-dialog"]');
        assert.match(await dlg.innerText(), /säilyy, joten sen commitit eivät häviä/);
        assert.match(await dlg.innerText(), /rivi ja punainen pallo jäävät/);
        await fit(p, key + ' dialog'); await shot(p, key + '-poista-ei-mergetty');
        await dlg.locator('[data-disposal="remove"]').click();
        assert.match(await row(p, 'e2').innerText(), /haara tallessa, worktree poistettu/);
        assert.equal(await balls(p), 1, 'the branch remains, so the ball remains');
        assert.equal(await row(p, 'e2').locator('.rm').count(), 0);
        await shot(p, key + '-worktree-poistettu');
      }
      // Asking the agent to merge removes the branch and the worktree, and with them the row
      // and, with nothing left, the pill.
      await closePanel(p);
      await send(p, 'e2', 'merge');
      assert.match(await p.locator('.thread').innerText(), /mergesin sen/);
      assert.equal(await pill(p).count(), 0, 'nothing listed, no pill');
      assert.match(await p.locator('.toast').innerText(), /poistui Workerit-listasta/);
      await shot(p, key + '-jarin-ratkaistu');

      // All states.
      await p.selectOption('#scene', 'a');
      assert.equal(await balls(p), 3, 'unfinished: not merged, cancelled, interrupted');
      await openPanel(p);
      const text = await panel(p).innerText();
      for (const w of ['ei mergetty · työ tallessa', 'peruttu · työ tallessa', 'keskeytyi · jatkettavissa', 'mergetty · worktree jäljellä', 'agentti odottaa', 'agentti ei odota']) assert.ok(text.includes(w), `${key}: ${w}`);
      assert.match(await p.locator('[data-testid="rule"]').innerText(), /haara tai worktree on olemassa/);
      assert.equal(await row(p, 'e1').locator('.ball').count(), 0, 'a merged row is not unfinished');
      assert.equal(await row(p, 'e1').locator('.rm').count(), v === 0 ? 0 : 1);
      assert.equal(await row(p, 'e4').locator('.rm').count(), v === 2 ? 1 : 0);
      assert.equal(await row(p, 'e5').locator('.rm').count(), 0, 'a live Taskfleet run owns the interrupted worktree');
      await fit(p, key); await shot(p, key + '-paneeli');
      // Interrupted: resume and salvage are Taskfleet's own; in Worktree the lock says why.
      const m5 = await menu(p, 'e5');
      assert.match(await m5.innerText(), /taskfleet run reattach/);
      assert.match(await m5.innerText(), /taskfleet run salvage/);
      if (v === 2) assert.match(await m5.locator('[data-testid="removal-note"]').innerText(), /omistaa sen/);
      await fit(p, key + ' menu'); await shot(p, key + '-keskeytynyt');
      await row(p, 'e5').locator('.tell').click();
      // Cancelled: discard is Taskfleet's own.
      assert.match(await (await menu(p, 'e4')).innerText(), /taskfleet run discard/);
      await row(p, 'e4').locator('.tell').click();

      // Landed and failed-without-work leave nothing on disk, so they leave the list.
      await closePanel(p);
      await p.locator('[data-event="land"]').click();
      await p.locator('[data-event="fail"]').click();
      assert.match(await p.locator('.thread').innerText(), /laskeutui mainiin/);
      assert.match(await p.locator('.thread').innerText(), /epäonnistui klo 14.05/);
      await openPanel(p);
      assert.equal(await row(p, 'w1').count(), 0); assert.equal(await row(p, 'w2').count(), 0);
      assert.match(await panel(p).innerText(), /Ei työskenteleviä workereita/);
      await shot(p, key + '-paattyneet-poistuivat');

      // The merged row with its worktree left.
      if (v === 0) {
        assert.match(await (await menu(p, 'e1')).innerText(), /git worktree remove \+ git branch -d/);
        await closePanel(p);
        await send(p, 'e1', 'cleanup');
      } else {
        await row(p, 'e1').locator('.rm').click();
        const dlg = p.locator('[data-testid="remove-dialog"]');
        assert.match(await dlg.innerText(), /yhdistetty haaraan main/);
        assert.match(await dlg.innerText(), /rivi poistuu/);
        await shot(p, key + '-poista-mergetty');
        await dlg.locator('[data-disposal="remove"]').click();
      }
      await openPanel(p);
      assert.equal(await row(p, 'e1').count(), 0, 'cleaned up, gone');

      if (v === 2) {
        // A dirty worktree: commit to the branch, or force with the typed name.
        await row(p, 'e4').locator('.rm').click();
        const dlg = p.locator('[data-testid="remove-dialog"]');
        assert.match(await dlg.innerText(), /Tallennetaanko muutokset/);
        await dlg.locator('[data-act="rm-force"]').click();
        await p.locator('#typed').fill('väärä');
        await dlg.locator('[data-disposal="force"]').click();
        assert.match(await dlg.innerText(), /vahvistukseksi/);
        await shot(p, key + '-poista-pakolla');
        await p.keyboard.press('Escape');
        assert.equal(await dlg.count(), 0);
        assert.ok(await row(p, 'e4').locator('.tell').evaluate(n => n === document.activeElement), 'Escape returns focus from the dialog');
      }

      // The worker view: report, changes, the same actions at the foot.
      await row(p, 'e4').locator('.row-main').click();
      await p.locator('[data-testid="worker-view"]').waitFor();
      assert.equal(await p.locator('.wv-tabs [data-tab="report"]').getAttribute('aria-selected'), 'true');
      const foot = p.locator('[data-testid="worker-decide"]');
      assert.match(await foot.innerText(), /Mitä tälle työlle tehdään/);
      assert.match(await foot.innerText(), /Kerro pääagentille/);
      assert.equal(await foot.locator('.btn.rm').count(), v === 2 ? 1 : 0);
      await fit(p, key + ' worker'); await shot(p, key + '-worker-raportti');
      await p.locator('.wv-tabs [data-tab="changes"]').click();
      assert.match(await p.locator('[data-testid="diff"]').innerText(), /Lomake\.tsx/);
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
  console.log(`PASS: ${cases} variant × width × theme cases; Jari's pill without "0", rows only while branch or worktree exists, landed and failed rows leave, requests drafted then sent, removal per variant (none / merged only / any accepted, branch kept), the interrupted run's blocked worktree, dirty removal with commit or typed force, worker view, Escape focus, no overflow, picker, no console errors or network requests.`);
} finally { await browser.close(); }
