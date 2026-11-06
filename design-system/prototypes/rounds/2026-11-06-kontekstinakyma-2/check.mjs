// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" and every riff at 1440 and 390 light: the default view (the riff's
// line, its own section visible), the "Vain tiedostot" filter, then the
// riff's steering: B1 writes an instruction and compacts; B2 marks two rows
// (the instruction box fills), opens the compaction and compacts; B3 rewinds
// from the large kept output, then from a reset opens the compaction with its
// own instruction field and compacts. The defaults again at 1440 and 390
// dark. Screenshots at device scale factor 2 named r2-<riff>-<step>-<width>-
// <theme>.png; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-11-06-kontekstinakyma-2';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['0-nyt', 'b1-ennuste', 'b2-ohje', 'b3-raja'];
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
    const capture = async (name) => { await page.waitForTimeout(350); await page.screenshot({path: `${out}/r2-${name}-${tag}.png`}); };
    const fits = async () => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'document overflow');
    const id = (x) => page.getByTestId(x).first();
    const scrollTo = async (x) => { await id(x).scrollIntoViewIfNeeded(); };
    // Bring the round's section to the top of the page's scroll area.
    const toSection = async (x) => { await id(x).evaluate((el) => el.scrollIntoView({block: 'start'})); };
    const files = async () => { await page.getByTestId('files-filter').getByText(/^Vain tiedostot/).click(); await id('files-note').waitFor(); };
    for (const d of [0, 1, 2, 3]) {
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.cx-review.variant-${d}`).waitFor({state: 'attached'});
      await id('cx-reset').click();
      await page.waitForTimeout(200);
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${['Nyt:', 'B1 ', 'B2 ', 'B3 '][d]}`)); checks++;
      await id('context-page').waitFor();
      if (d === 0) { await id('context-parts').waitFor(); ok(await page.locator('.cx-b').count() === 0, 'Nyt has no round section'); }
      if (d === 1) { await id('b1-section').waitFor(); ok(await page.locator('.cx-fate[data-fate="next"]').count() >= 3, 'B1 fates'); await id('b1-form').waitFor(); }
      if (d === 2) { await id('b2-box').waitFor(); ok(await page.getByTestId('skip-loki').count() === 1 && await page.getByTestId('skip-test').count() === 0, 'B2 marks only on rows Pi will summarize'); }
      if (d === 3) { for (const b of ['always', 'next', 'kept', 'gone']) await id(`band-${b}`).waitFor(); await id('rewind-test').waitFor(); }
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full || d === 0) continue;

      // The files filter: files only, also those only the summary has.
      await files();
      ok(await page.getByTestId('row-test').count() === 0 && await page.getByTestId('row-thinking').count() === 0, 'files only');
      ok(await page.getByTestId('row-pk').count() === 1, 'summarized file listed');
      await toSection(d === 3 ? 'b3-section' : 'b-rows');
      await capture(`${n}-1-tiedostot`);
      await page.getByTestId('files-filter').getByText(/^Kaikki osat/).click();

      if (d === 1) {
        await id('b1-instruction').fill('Säilytä kuormitustestin luvut tarkkoina.');
        await id('compact-open').click();
        await id('compact-dialog').waitFor();
        assert.match(await id('compact-instruction').innerText(), /kuormitustestin luvut/); checks++;
        await capture(`${n}-2-tiivista`);
        await id('compact-confirm').click();
        await id('compacting').waitFor();
        await id('compacted').waitFor({timeout: 6000}); checks++;
        ok(await page.locator('.cx-fate[data-fate="next"]').count() === 0, 'B1 no forecast right after compaction');
        await toSection('b-rows');
        await capture(`${n}-3-tiivistetty`);
      }
      if (d === 2) {
        await id('skip-loki').click();
        await id('keep-aq').click();
        assert.match(await id('b2-instruction').inputValue(), /Avoimet kysymykset\.md[\s\S]*Kuormitustesti-loki\.csv/); checks++;
        await toSection('b2-box');
        await capture(`${n}-2-merkitty`);
        await id('compact-open').click();
        await id('compact-dialog').waitFor();
        assert.match(await id('compact-instruction').innerText(), /maininta.*Kuormitustesti-loki\.csv/s); checks++;
        await capture(`${n}-3-tiivista`);
        await id('compact-confirm').click();
        await id('compacted').waitFor({timeout: 6000}); checks++;
      }
      if (d === 3) {
        await id('rewind-test').click();
        await id('rewind-dialog').waitFor();
        await capture(`${n}-2-palaa`);
        await id('rewind-confirm').click();
        await id('rewound').waitFor(); checks++;
        ok((await page.locator('textarea').last().inputValue()).includes('60 kassalla'), 'B3 rewind puts the turn back in the composer');
        ok(await page.getByTestId('row-test').count() === 0, 'B3 rewound output gone');
        await toSection('b3-section');
        await capture(`${n}-3-palattu`);
        await id('cx-reset').click();
        await id('band-next').waitFor();
        await scrollTo('compact-open');
        await id('compact-open').click();
        await id('compact-dialog').waitFor();
        await id('compact-instruction-field').fill('Säilytä kuormitustestin luvut tarkkoina.');
        await capture(`${n}-4-tiivista`);
        await id('compact-confirm').click();
        await id('compacted').waitFor({timeout: 6000}); checks++;
        ok(await page.getByTestId('band-next').count() === 0, 'B3 no next band right after compaction');
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
