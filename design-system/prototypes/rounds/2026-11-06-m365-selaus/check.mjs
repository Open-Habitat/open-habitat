// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every direction at 1440 and 390 light: the default view (the direction's
// line, the full level, the agent's changes visible), the edited file's
// preview with the agent's diff and its sync reaching Microsoft, giving a
// file to the agent and sending it, the read-only level (no agent changes,
// the lock said on the file), and what the agent does not see. B also opens
// the changed file from the conversation's turn. The defaults again at 1440
// and 390 dark. Screenshots at device scale factor 2; the console must stay
// clean.
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-11-06-m365-selaus';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['a-asetukset', 'b-tiedostot', 'c-paneeli'];
let checks = 0;
const errors = [];
const ok = (v, m) => { assert.ok(v, m); checks++; };
const runs = [
  {width: 1440, theme: 'light', full: true},
  {width: 390, theme: 'light', full: true},
  {width: 1440, theme: 'dark', full: false},
  {width: 390, theme: 'dark', full: false},
];
try {
  for (const run of runs) {
    const {width, theme} = run, mobile = width === 390;
    const page = await browser.newPage({viewport: {width, height: mobile ? 844 : 900}, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile});
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('http://prototype.test/**', (r) => r.fulfill({contentType: 'text/html', body: readFileSync(input, 'utf8')}));
    await page.goto('http://prototype.test/');
    await page.locator('#theme').selectOption(theme);
    await checkPicker(page, round);
    const tag = `${width}-${theme}`;
    const capture = async (name) => { await page.waitForTimeout(300); await page.screenshot({path: `${out}/${name}-${tag}.png`}); };
    const fits = async () => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'document overflow');
    const id = (x) => page.getByTestId(x).first();
    const level = async (v) => { await page.locator('#level').selectOption(v); await page.waitForTimeout(400); };
    for (const d of [0, 1, 2]) {
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.mb-review.variant-${d}`).waitFor({state: 'attached'});
      await level('full');
      // Alusta starts the story over: the last edit is still on its way to Microsoft.
      await page.getByTestId('mb-reset').click();
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${'ABC'[d]} `)); checks++;
      // The default: the full level and the agent's changes are visible.
      await id('level-note').waitFor();
      assert.equal(await id('level-note').getAttribute('data-level'), 'full'); checks++;
      if (d === 0) { await id('a-section').waitFor(); await id('change-list').waitFor(); ok(await id('agent-badge').isVisible(), 'A badge'); }
      if (d === 1) { await id('files-page').waitFor(); ok(await id('agent-badge').isVisible(), 'B badge'); ok(await id('rail-files').count() || mobile, 'B rail'); }
      if (d === 2) { await id('c-panel').waitFor(); await id('change-list').waitFor(); await id('read-list').waitFor(); }
      if (d !== 1) { await id('sync-pending').waitFor(); checks++; }
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      // The edited file: the agent's diff, and the sync reaching Microsoft.
      if (d === 1) await id('file-Avoimet kysymykset.md').click();
      else await id('change-open-q').click();
      await id('preview').waitFor();
      await id('agent-did').waitFor();
      ok(await page.locator('[data-testid="agent-did"] .ah-diff-add').count() >= 2, 'diff lines');
      await capture(`${n}-1-muutos`);
      await page.waitForFunction(() => document.querySelector('[data-testid="preview"] [data-testid="sync-done"]'), null, {timeout: 9000}); checks++;
      assert.match(await page.locator('[data-testid="preview"] [data-testid="sync-done"]').innerText(), /Microsoftissa 10\.48/); checks++;
      await capture(`${n}-2-siirretty`);
      if (d === 0) await id('preview-back').click();
      if (d === 1 && !mobile) {
        // The changes tab, and the changed file from the conversation's turn.
        await page.getByTestId('segment-changes').click();
        await id('change-list').waitFor();
        await capture(`${n}-3-muutokset`);
        await page.getByTestId('segment-browse').click();
        await page.getByTestId('workspace-navigation').getByText('Keskon viikkoraportti').first().click();
        await id('turn-links').waitFor();
        await capture(`${n}-3-vuoron-linkit`);
        await id('turn-link-r').click();
        await id('files-page').waitFor();
        assert.match(await id('preview').innerText(), /Viikkoraportti vko 45\.docx/); checks++;
        assert.match(await id('agent-did').innerText(), /loi tämän tiedoston/); checks++;
        await capture(`${n}-3-vuorosta-tiedostoon`);
        await id('crumbs').getByText('Kesko – kassajärjestelmä').click();
      }
      if (d === 2) await id('preview-back').click();

      // Giving a file to the agent.
      if (d === 0) {
        await id('file-Projektisuunnitelma.docx').click();
        await id('give').click();
      } else if (d === 1) {
        if (mobile) await id('preview-back').click();
        await id('file-Projektisuunnitelma.docx').click();
        await id('give').click();
        await id('give-dialog').waitFor();
        await capture(`${n}-4-anna`);
        await id('give-new').click();
      } else {
        await page.getByTestId('segment-browse').click();
        await id('source-proj').click();
        await id('file-Kesko – kassajärjestelmä').click();
        await id('file-Projektisuunnitelma.docx').click();
        await id('preview').waitFor();
        await capture(`${n}-4-selaa`);
        await id('give').click();
      }
      await id('given-chip').waitFor();
      assert.match(await id('given-row').innerText(), /Projektisuunnitelma\.docx/); checks++;
      await fits();
      await capture(`${n}-5-annettu`);
      await id('message-input').fill('Tiivistä tämä kolmeen kohtaan.');
      await id('send').click();
      await page.locator('[data-testid="conversation-timeline"] [data-testid="given-chip"]').waitFor(); checks++;
      assert.equal(await page.getByTestId('given-row').count(), 0); checks++;
      await capture(`${n}-6-lahetetty`);

      // The read-only level: no changes reach Microsoft; the lock is said on the file.
      await level('read');
      await id('level-note').waitFor();
      assert.equal(await id('level-note').getAttribute('data-level'), 'read'); checks++;
      if (d === 2 && !(await page.getByTestId('c-panel').count())) await id('c-toggle').click();
      if (d === 1) await page.getByTestId('segment-changes').click();
      await id('changes-empty').waitFor(); checks++;
      if (d === 1) { await capture(`${n}-7-vain-luku-muutokset`); await page.getByTestId('segment-browse').click(); }
      assert.equal(await page.getByTestId('agent-badge').count(), 0); checks++;
      await fits();
      await capture(`${n}-7-vain-luku`);
      if (d === 2) await id('read-Avoimet kysymykset.md').click();
      else await id('file-Avoimet kysymykset.md').click();
      await id('cannot-change').waitFor(); checks++;
      assert.equal(await page.getByTestId('agent-did').count(), 0); checks++;
      assert.doesNotMatch(await id('preview-content').innerText(), /varmenteiden vaihdon/); checks++;
      await capture(`${n}-8-vain-luku-tiedosto`);
      if (d !== 1 || mobile) await id('preview-back').click();

      // What the agent does not see.
      if (d === 2) { await page.getByTestId('segment-browse').click(); }
      if (d === 1 && mobile) { await id('files-back').click(); await id('files-back').click(); }
      await id('hidden-list').scrollIntoViewIfNeeded();
      assert.match(await id('hidden-list').innerText(), /Johtoryhmä/); checks++;
      assert.match(await id('hidden-list').innerText(), /Contoso yleinen/); checks++;
      await capture(`${n}-9-ei-nae`);
      await level('full');
    }
    await page.close();
  }
} finally { await browser.close(); }
assert.deepEqual(errors, []);
console.log(`ok: ${checks} checkpoints`);
