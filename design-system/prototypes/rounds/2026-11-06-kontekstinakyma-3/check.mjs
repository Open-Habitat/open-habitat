// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every direction at 1440 and 390 light: the default view (its line, the
// buttons it has and has not), the "Vain tiedostot" filter, and the compact
// dialog (with or without the instruction field) through to the compacted
// state. Direction 1 also: "Lue uudelleen" puts the request in the composer,
// "Palaa ennen tätä" opens the rewind and takes the large output away, and
// "Näytä Pi:n omat luvut" opens the production sections. The defaults again
// at 1440 and 390 dark. Screenshots at device scale factor 2 named
// r3-<direction>-<step>-<width>-<theme>.png; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-11-06-kontekstinakyma-3';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['1-selitetty', '2-lista', '3-pelkka'];
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
    const capture = async (name) => { await page.waitForTimeout(350); await page.screenshot({path: `${out}/r3-${name}-${tag}.png`}); };
    const fits = async () => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'document overflow');
    const id = (x) => page.getByTestId(x).first();
    const count = (x) => page.getByTestId(x).count();
    const toTop = async (x) => { await id(x).evaluate((el) => el.scrollIntoView({block: 'start'})); };
    for (const d of [0, 1, 2]) {
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.cx-review.variant-${d}`).waitFor({state: 'attached'});
      await id('cx-reset').click();
      await page.waitForTimeout(200);
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${d + 1} `)); checks++;
      await id('cx3-section').waitFor();
      ok(await page.locator('[data-testid="context-parts"]').isHidden(), 'production parts hidden');
      await id('compact-open').waitFor();
      ok(await count('rewind-test') === (d === 0 ? 1 : 0), 'rewind only in 1');
      ok(await count('reread-pk') === (d === 0 ? 1 : 0), 'read again only in 1');
      ok(await count('open-loki') === (d === 2 ? 0 : 1), 'open in 1 and 2');
      ok(await count('legend') === (d === 2 ? 0 : 1), 'legend in 1 and 2');
      ok(await count('details-toggle') === (d === 0 ? 1 : 0), 'details only in 1');
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      // Files only: every file read or changed, also those only the summary has.
      await page.getByTestId('files-filter').getByText(/^Vain tiedostot/).click();
      await id('files-note').waitFor();
      ok(await count('row-test') === 0 && await count('row-talk') === 0, 'files only');
      ok(await page.getByTestId('rows-summary').getByTestId('row-pk').count() === 1, 'summarized file listed');
      await toTop('files-filter');
      await capture(`${n}-1-tiedostot`);
      await page.getByTestId('files-filter').getByText(/^Kaikki/).click();

      if (d === 0) {
        await id('reread-pk').click();
        ok((await page.locator('textarea').last().inputValue()).includes('Ohjausryhmän pöytäkirjat'), 'read again drafts the request');
        await toTop('group-summary');
        await capture(`${n}-2-lue-uudelleen`);
        await id('cx-reset').click();
        await id('rewind-test').click();
        await id('rewind-dialog').waitFor();
        await capture(`${n}-3-palaa`);
        await id('rewind-confirm').click();
        await id('rewound').waitFor(); checks++;
        ok((await page.locator('textarea').last().inputValue()).includes('60 kassalla'), 'rewind puts the message back in the composer');
        ok(await count('row-test') === 0, 'rewound output gone');
        await toTop('cx3-section');
        await capture(`${n}-4-palattu`);
        await id('cx-reset').click();
        await id('details-toggle').click();
        await id('context-parts').waitFor(); checks++;
        await toTop('details-toggle');
        await capture(`${n}-5-luvut`);
        await id('cx-reset').click();
      }
      await id('compact-open').scrollIntoViewIfNeeded();
      await id('compact-open').click();
      await id('compact-dialog').waitFor();
      ok(await count('compact-instruction-field') === (d === 2 ? 0 : 1), 'instruction only in 1 and 2');
      if (d !== 2) await id('compact-instruction-field').fill('Säilytä kuormitustestin luvut tarkkoina.');
      await capture(`${n}-${d === 0 ? 6 : 2}-tiivista`);
      await id('compact-confirm').click();
      await id('compacting').waitFor();
      await id('compacted').waitFor({timeout: 6000}); checks++;
      ok(await count('compact-open') === 0, 'no compact button right after compaction');
      ok(await page.getByTestId('rows-summary').getByTestId('row-loki').count() === 1, 'compacted output moves to the summary group');
      await toTop('cx3-section');
      await capture(`${n}-${d === 0 ? 7 : 3}-tiivistetty`);
      await fits();
    }
    await page.close();
  }
  assert.deepEqual(errors, [], 'console errors');
  console.log(`${checks} checks, console clean`);
} finally {
  await browser.close();
}
