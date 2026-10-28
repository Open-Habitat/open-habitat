// Builds index.html and checks it offline: every variant at 1440 and 390 px in light and dark,
// device scale factor 2. Kerro agentille sends the request at once (no draft): the person's own
// message names the run, branch and worktree and asks for a recommendation; the row follows the
// request (checking, waiting for your answer, acting) and folds away when the agent has removed
// the branch and the worktree. Käsittele kaikki on the panel header and beside the pill sends
// one request for every unfinished row. The receiving conversation follows the variant
// (Vanhempi: the parent, queued while it works and continued when closed; Valittava: the parent
// or a chosen one; Uusi keskustelu: a new conversation each time). Nothing overflows sideways;
// the picker holds; no console errors or network. Screenshots go to evidence/ as AVIF (needs ffmpeg).
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-ended-worker-lifecycle/prototypes/ended-worker-r3/check.mjs
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
// Screenshots are taken into scratch (TMPDIR) and committed as AVIF, which is a fraction of the PNG.
const scratch = mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'ended-worker-r3-'));
const NAMES = ['1-vanhempi', '2-valittava', '3-uusi'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const fit = async (p, what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${what}: horizontal overflow`);
// Jari's case in every width and theme; the steps in desktop-light and phone-dark.
let pair = false;
async function shot(p, file, always = false) {
  if (!always && !pair) return;
  // On the phone, only the views whose layout differs from the desktop.
  if (!always && file.includes('-phone-') && !/-(paneeli|valitsin|suositus|kaikki-suositus|rivi-poistuu|jonossa|paate)$/.test(file)) return;
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  const png = path.join(scratch, file + '.png');
  await p.screenshot({ path: png, animations: 'disabled' });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '42', '-cpu-used', '6', '-pix_fmt', 'yuv444p', path.join(evidence, file + '.avif')]);
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
}
const panel = (p) => p.locator('[data-testid="panel"]');
const pill = (p) => p.locator('[data-testid="chip-spin"]');
const row = (p, id) => p.locator(`.row[data-run="${id}"]`);
const rowText = async (p, id) => (await row(p, id).innerText()).replace(/\s+/g, ' ');
const phase = (p, id, ph) => p.locator(`.row[data-run="${id}"][data-phase="${ph}"]`).waitFor({ timeout: 8000 });
const openPanel = async (p) => { if (!await panel(p).count()) await pill(p).click(); await panel(p).waitFor(); };
const closePanel = async (p) => { if (await panel(p).count()) await p.keyboard.press('Escape'); };
const conv = (p) => p.locator('.main').getAttribute('data-conv');
async function goto(p, title, phone) {
  if (phone) await p.locator('.topbar [data-act="drawer"]').click();
  await p.locator('.rail .conv', { hasText: title }).click();
}
async function reply(p, text) {
  const box = p.locator('.cbox textarea');
  await box.fill(text);
  await box.press('Enter');
}
const agentSaid = (p, re) => p.locator('[data-testid="agent-msg"]', { hasText: re }).last().waitFor({ timeout: 8000 });
let cases = 0;
try {
  for (const [width, height, size] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) for (const theme of ['light', 'dark']) {
    pair = (size === 'desktop') === (theme === 'light');
    const phone = size === 'phone';
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + path.join(here, 'index.html'));
    await p.evaluate(() => document.fonts.ready);
    assert.equal(await p.locator('html').getAttribute('data-theme'), theme);
    await checkPicker(p, 'proto-ended-worker-lifecycle');
    for (let v = 0; v < 3; v++) {
      await p.locator('.proto-picker-item').nth(v).click();
      await p.locator(`.app[data-variant]`).waitFor();
      await p.selectOption('#parent', 'idle');
      const key = `${NAMES[v]}-${size}-${theme}`;

      // ---- Jari's case: one unfinished worker, the parent waiting for the person.
      await p.selectOption('#scene', 'b');
      assert.equal(await pill(p).locator('.ball').count(), 1);
      assert.match(await p.locator('[data-testid="pill-all"]').innerText(), /Käsittele/);
      await shot(p, key + '-jarin-siru');
      await openPanel(p);
      assert.equal(await row(p, 'e2').locator('.ball').count(), 1);
      assert.equal(await row(p, 'e2').locator('.caret').count(), v === 1 ? 1 : 0, 'a chooser caret only in Valittava');
      assert.match(await p.locator('[data-testid="rule"]').innerText(), [/tähän keskusteluun\./, /▾ valitsee toisen/, /aloittaa uuden keskustelun/][v]);
      await fit(p, key + ' jari'); await shot(p, key + '-jarin-tapaus', true);
      await row(p, 'e2').locator('.tell').click();
      // Sent at once: no draft, the panel stays open, the row takes the request.
      assert.equal(await p.locator('[data-testid="draft"]').count(), 0);
      await panel(p).waitFor();
      assert.equal(await row(p, 'e2').locator('.ball').count(), 0, 'a handled row has no red ball');
      if (v < 2) {
        const req = p.locator('[data-testid="request"]');
        assert.match(await req.innerText(), /Käsittele worker ”test-guide: worker-näkymän koe” \(Taskfleet-ajo 01m5yq1t6wkd3r8n2c4h7pqa0e, haara wt\/5yq1-test-guide-worker-nakyma, worktree ~\/src\/kasvimaa__worktrees\//);
        assert.match(await req.innerText(), /Älä muuta mitään ennen kuin vastaan/);
        assert.match(await rowText(p, 'e2'), /agentti tarkistaa · tässä keskustelussa/);
        await shot(p, key + '-pyynto-lahti');
        await phase(p, 'e2', 'answer');
        assert.match(await rowText(p, 'e2'), /odottaa vastaustasi/);
        await agentSaid(p, /Suosittelen mergeämistä/);
        await shot(p, key + '-suositus', v === 2 && theme === 'dark');
      } else {
        // A new conversation in the workspace: the parent conversation is untouched.
        assert.equal(await p.locator('[data-testid="request"]').count(), 0);
        assert.match(await rowText(p, 'e2'), /pyyntö lähetetty · uusi keskustelu käynnistyy/);
        assert.equal(await p.locator('.rail .conv', { hasText: 'Worker: test-guide' }).count(), phone ? 1 : 1);
        await shot(p, key + '-pyynto-lahti');
        await phase(p, 'e2', 'answer');
        assert.match(await rowText(p, 'e2'), /odottaa vastaustasi · keskustelussa Worker: test-guide/);
        await row(p, 'e2').locator('.open-conv').click();
        assert.match(await conv(p), /^n/);
        assert.match(await p.locator('[data-testid="request"]').innerText(), /Sen käynnisti keskustelu ”Iltakierros”/);
        await agentSaid(p, /Suosittelen mergeämistä/);
        assert.equal(await pill(p).count(), 0, 'the new conversation has no Workers panel of its own');
        await shot(p, key + '-suositus', v === 2 && theme === 'dark');
      }
      // The person answers in the conversation; the agent acts and the row folds away.
      await reply(p, 'Kyllä, mergeä.');
      if (v === 2) { await goto(p, 'Iltakierros', phone); }
      await openPanel(p);
      await phase(p, 'e2', 'gone');
      assert.match(await rowText(p, 'e2'), /mergetty · haara ja worktree poistettu/);
      await shot(p, key + '-rivi-poistuu');
      await row(p, 'e2').waitFor({ state: 'detached', timeout: 8000 });
      assert.equal(await pill(p).count(), 0, 'nothing listed, no pill');
      assert.match(await p.locator('.toast').innerText(), /poistui Workerit-listasta/);
      if (v < 2) assert.match(await p.locator('.thread').innerText(), /Mergesin ”test-guide/);

      // ---- All states: Käsittele kaikki from the panel header (Valittava: to a chosen conversation).
      await p.selectOption('#scene', 'a');
      await openPanel(p);
      assert.equal(await pill(p).locator('.ball').count(), 3);
      const head = p.locator('.endhead');
      assert.match(await head.innerText(), /Käsittele kaikki \(3\)/);
      assert.match(await p.locator('[data-testid="pill-all"]').innerText(), /Käsittele kaikki \(3\)/);
      assert.equal(await row(p, 'e1').locator('.ball').count(), 0, 'a merged row is not unfinished');
      await fit(p, key + ' all'); await shot(p, key + '-paneeli');
      let target = 'Iltakierros';
      if (v === 1) {
        await head.locator('.caret').click();
        const ch = p.locator('[data-testid="chooser"]');
        assert.match(await ch.innerText(), /Iltakierros[\s\S]*käynnisti workerit[\s\S]*Sääaseman kalibrointi[\s\S]*Uusi keskustelu/);
        await fit(p, key + ' chooser'); await shot(p, key + '-valitsin');
        await p.keyboard.press('Escape');
        assert.equal(await ch.count(), 0);
        await head.locator('.caret').click();
        await p.locator('[data-testid="chooser"] [data-to="kalib"]').click();
        target = 'Sääaseman kalibrointi';
      } else await head.locator('.tell').click();
      if (v === 2) target = 'Workereiden käsittely';
      for (const id of ['e2', 'e4', 'e5']) assert.equal(await row(p, id).locator('.ball').count(), 0);
      assert.equal(await row(p, 'e1').locator('.tell').count(), 1, 'Käsittele kaikki covers only unfinished rows');
      assert.equal(await p.locator('[data-testid="pill-all"]').count(), 0, 'nothing left to send');
      await phase(p, 'e5', 'answer');
      assert.match(await rowText(p, 'e4'), v === 0 ? /tässä keskustelussa/ : new RegExp(`keskustelussa ${target}`));
      await shot(p, key + '-kaikki-kasittelyssa');
      if (v > 0) await goto(p, target, phone); else await closePanel(p);
      const batch = p.locator('[data-testid="request"]').last();
      assert.match(await batch.innerText(), /Käsittele nämä 3 keskeneräistä workeria:\n1\. ”test-guide/);
      await agentSaid(p, /Teenkö nämä kaikki/);
      await fit(p, key + ' batch'); await shot(p, key + '-kaikki-suositus');
      await reply(p, 'Kyllä, tee kaikki.');
      await agentSaid(p, /taskfleet run reattach/);
      if (v > 0) await goto(p, 'Iltakierros', phone);
      await openPanel(p);
      await row(p, 'e2').waitFor({ state: 'detached', timeout: 8000 });
      await row(p, 'e4').waitFor({ state: 'detached', timeout: 8000 });
      assert.match(await rowText(p, 'e5'), /jatkuu · agentti ei odota/);
      assert.equal(await pill(p).locator('.ball').count(), 0);
      assert.equal(await row(p, 'e1').count(), 1, 'the merged row waits for its own cleanup');
      await shot(p, key + '-kaikki-valmis');
      await closePanel(p);

      // ---- The parent is busy: Vanhempi and Valittava queue the request as a follow-up.
      await p.selectOption('#parent', 'working');
      await openPanel(p);
      await row(p, 'e4').locator('.tell').click();
      if (v < 2) {
        assert.match(await rowText(p, 'e4'), /pyyntö jonossa · lähtee, kun Iltakierros vapautuu/);
        assert.match(await p.locator('[data-testid="queued"]').innerText(), /Jonossa/);
        await shot(p, key + '-jonossa');
        await phase(p, 'e4', 'answer');
        assert.match(await p.locator('.thread').innerText(), /README päivitetty[\s\S]*Käsittele worker ”Lomakkeen/);
        await agentSaid(p, /Suosittelen hylkäämistä/);
        // Leaving it is an answer too: the row returns with its red ball.
        await reply(p, 'Jätä toistaiseksi.');
        await agentSaid(p, /en tee nyt mitään/);
        assert.equal(await row(p, 'e4').locator('.ball').count(), 1);
      } else {
        assert.equal(await p.locator('[data-testid="queued"]').count(), 0, 'a new conversation does not wait for the parent');
        await phase(p, 'e4', 'answer');
      }
      await closePanel(p);

      // ---- The parent is closed: sending continues it (Vanhempi); a new one does not care.
      await p.selectOption('#parent', 'closed');
      assert.match(await p.locator('.cnote').innerText(), /Viestin lähettäminen jatkaa sitä/);
      await openPanel(p);
      await row(p, 'e2').locator('.tell').click();
      if (v < 2) {
        assert.match(await p.locator('.toast').innerText(), /oli suljettu; pyyntö jatkoi keskustelua/);
        assert.match(await rowText(p, 'e2'), /pyyntö lähetetty · Iltakierros jatkuu/);
        await shot(p, key + '-suljettu-jatkuu');
      }
      await phase(p, 'e2', 'answer');
      await closePanel(p);

      // ---- The parent was started in a terminal: the browser cannot write to it, so the
      // request falls back to a new conversation (Valittava greys the parent out).
      await p.selectOption('#parent', 'terminal');
      assert.match(await p.locator('.cnote').innerText(), /Selaimesta sitä voi vain lukea/);
      await openPanel(p);
      if (v === 1) {
        await row(p, 'e4').locator('.caret').click();
        assert.ok(await p.locator('[data-testid="chooser"] [data-to="ilta"]').isDisabled());
        await shot(p, key + '-paate-valitsin');
        await p.keyboard.press('Escape');
      }
      await row(p, 'e4').locator('.tell').click();
      assert.equal(await p.locator('.rail .conv', { hasText: 'Worker: Lomakkeen' }).count(), 1);
      if (v < 2) assert.match(await p.locator('.toast').innerText(), /ajettu päätteessä[\s\S]*uuteen keskusteluun/);
      await shot(p, key + '-paate');
      await phase(p, 'e4', 'answer');
      await closePanel(p);

      // ---- The worker view carries the same request at its foot.
      await p.selectOption('#parent', 'idle');
      await openPanel(p);
      await row(p, 'e5').locator('.row-main').click();
      const foot = p.locator('[data-testid="worker-decide"]');
      assert.match(await foot.innerText(), /Mitä tälle työlle tehdään/);
      await fit(p, key + ' worker'); await shot(p, key + '-worker');
      await foot.locator('.tell').click();
      assert.match(await p.locator('[data-testid="worker-phase"]').innerText(), /agentti tarkistaa · keskustelussa Iltakierros|uusi keskustelu käynnistyy/);
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
  console.log(`PASS: ${cases} variant × width × theme cases; request sent at once naming run, branch and worktree; row phases checking → waiting for you → acting → folds away; Käsittele kaikki from panel header (and chooser in Valittava); pill companion; busy parent queues, closed parent continues, new conversation independent; leave keeps the ball; worker view; Escape focus; no overflow, picker, no console errors or network requests.`);
} finally { await browser.close(); }
