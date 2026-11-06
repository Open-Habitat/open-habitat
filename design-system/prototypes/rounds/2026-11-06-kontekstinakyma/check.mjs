// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" and every direction at 1440 and 390 light: the default view (the
// direction's line, its own section visible), then the direction's
// interactions: A opens an item, marks two, compacts with the marks' instruction
// and asks to re-read a summarized file; B marks the largest part, compacts,
// and asks to re-read; C opens a turn, compacts from the forecast row and
// forks from a turn. The defaults again at 1440 and 390 dark. Screenshots at
// device scale factor 2; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-11-06-kontekstinakyma';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['0-nyt', 'a-kohteet', 'b-koko', 'c-aikajana'];
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
    const capture = async (name) => { await page.waitForTimeout(350); await page.screenshot({path: `${out}/${name}-${tag}.png`}); };
    const fits = async () => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'document overflow');
    const id = (x) => page.getByTestId(x).first();
    const scrollTo = async (x) => { await id(x).scrollIntoViewIfNeeded(); };
    for (const d of [0, 1, 2, 3]) {
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.cx-review.variant-${d}`).waitFor({state: 'attached'});
      await id('cx-reset').click();
      await page.waitForTimeout(200);
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${['Nyt:', 'A ', 'B ', 'C '][d]}`)); checks++;
      if (d !== 1) await id('context-page').waitFor();
      if (d === 0) { await id('context-parts').waitFor(); ok(await page.getByTestId('b-section').count() === 0, 'Nyt has no round section'); }
      if (d === 1) { await id('a-panel').waitFor(); await id('group-Muutti').waitFor(); ok(await page.getByTestId('tag-in').count() >= 5, 'A in-context tags'); }
      if (d === 2) { await id('b-section').waitFor(); assert.match(await id('b-lead').innerText(), /Kuormitustesti-loki\.csv/); checks++; }
      if (d === 3) { await id('c-section').waitFor(); await id('c-cut-1').waitFor(); await id('c-cut-next').waitFor(); }
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      if (d === 0) {
        // Today's page: the compaction's own file lists are all it says about files.
        await scrollTo('context-compactions');
        await capture(`${n}-1-tiivistykset`);
      }
      if (d === 1) {
        await id('item-loki').click();
        await id('more-loki').waitFor();
        await id('drop-loki').click();
        await id('item-aq').click();
        await id('keep-aq').click();
        await capture(`${n}-1-merkitty`);
        await scrollTo('compact-open');
        await id('compact-open').click();
        await id('compact-dialog').waitFor();
        assert.match(await id('compact-instruction').innerText(), /Avoimet kysymykset\.md.*Kuormitustesti-loki\.csv/s); checks++;
        await capture(`${n}-2-tiivista`);
        await id('compact-confirm').click();
        await id('compacting').waitFor();
        await id('compacted').waitFor({timeout: 6000}); checks++;
        await page.getByTestId('a-filter').getByText(/^Tiivistetty/).click();
        await id('item-plan').click();
        await capture(`${n}-3-tiivistetty`);
        await id('reread-plan').click();
        ok((await page.locator('textarea').first().inputValue()).includes('Projektisuunnitelma.docx'), 'A re-read draft');
        if (!mobile) await capture(`${n}-4-lue-uudelleen`);
      }
      if (d === 2) {
        await id('bdrop-loki').click();
        await scrollTo('compact-open');
        await capture(`${n}-1-merkitty`);
        await id('compact-open').click();
        await id('compact-dialog').waitFor();
        assert.match(await id('compact-instruction').innerText(), /ei tarvita.*Kuormitustesti-loki\.csv/is); checks++;
        await id('compact-confirm').click();
        await id('compacted').waitFor({timeout: 6000}); checks++;
        await scrollTo('b-gone');
        await capture(`${n}-2-tiivistetty`);
        await id('breread-pk').click();
        ok((await page.locator('textarea').first().inputValue()).includes('pöytäkirjat'), 'B re-read draft');
      }
      if (d === 3) {
        await id('turn-9').click();
        await id('turn-more-9').waitFor();
        await scrollTo('turn-9');
        await capture(`${n}-1-vuoro`);
        await id('fork-9').click();
        await id('fork-dialog').waitFor();
        await capture(`${n}-2-haaraudu`);
        await id('fork-confirm').click();
        await page.locator('.ah-agent-header').getByText('(haara)').first().waitFor();
        ok((await page.locator('textarea').first().inputValue()).includes('Kuormitustesti'), 'C fork draft');
        await capture(`${n}-3-haara`);
        await id('cx-reset').click();
        await id('c-compact').click();
        await id('compact-confirm').click();
        await id('c-cut-2').waitFor({timeout: 6000}); checks++;
        await scrollTo('c-cut-2');
        await capture(`${n}-4-tiivistetty`);
      }
      await fits();
    }
    await page.close();
  }
  assert.deepEqual(errors, [], 'console errors');
  console.log(`${checks} checks, console clean`);
} finally {
  await browser.close();
}
