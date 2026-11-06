// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every direction at 1440 and 390 light: the default (SharePoint's library,
// where the three directions differ at once), a folder (A, B) or OneDrive's
// scope (C), Outlook, the agent's unsent draft at the drafts level, GitHub,
// the read-only Microsoft level, where each fact comes from (files and mail),
// and a hidden library's action into the production settings page. The
// left list is round 1's B in every direction. The defaults again at 1440
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
const round = '2026-11-06-resurssien-sisalto';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['r3-a-kuten-palvelussa', 'r3-b-kohde-kohteelta', 'r3-c-vain-rajat'];
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
    const has = async (x) => (await page.getByTestId(x).count()) > 0;
    const level = async (v) => { await page.locator('#level').selectOption(v); await page.waitForTimeout(300); };
    const toList = async () => { if (mobile && await has('detail-back')) await id('detail-back').click(); };
    const pick = async (src) => { await toList(); await id(`src-${src}`).scrollIntoViewIfNeeded(); await id(`src-${src}`).click(); await id('source-view').waitFor(); };
    for (const d of [0, 1, 2]) {
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.rv-review.variant-${d}`).waitFor({state: 'attached'});
      await id('rv-reset').click();
      await id('resources-page').waitFor();
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${'ABC'[d]} `)); checks++;
      await id('source-view').waitFor();
      assert.equal(await id('source-view').getAttribute('data-source'), 'ms-proj'); checks++;
      // Round 1's B list is the same in every direction.
      if (!mobile) {
        const list = await id('list-kinds').innerText();
        for (const word of ['Tiedostot', 'Posti', 'Koodi', 'Koneet', 'OneDrive', 'Gmail', 'GitHub-repot', 'aino-mbp', 'GitLab']) ok(list.includes(word), `${n}: ${word} in the list`);
      }
      // The default view differs by direction.
      if (d === 0) { ok(await id('ability').isVisible(), 'A: level box'); ok(await has('file-Kesko – kassajärjestelmä'), 'A: folders'); ok(await has('hidden-list'), 'A: hidden below'); }
      if (d === 1) { ok(!(await has('ability')), 'B: no level box'); ok(await has('can-Kesko – kassajärjestelmä'), 'B: per-item'); ok(await has('grey-h-yleinen'), 'B: hidden in place'); }
      if (d === 2) { ok(!(await has('files')), 'C: no files'); ok(await has('scope-in'), 'C: scope'); assert.match(await id('scope-out').innerText(), /Contoso yleinen/); checks++; assert.match(await id('verbs').innerText(), /Jakaa linkillä/); checks++; }
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      // 1: inside a folder (A, B); C has none, so OneDrive's scope.
      if (d < 2) {
        await id('file-Kesko – kassajärjestelmä').click();
        await id('file-Viikkoraportit').waitFor();
        if (d === 1) { assert.match(await id('can-Projektisuunnitelma.docx').innerText(), /varattu/); checks++; await id('file-Projektisuunnitelma.docx').click(); await id('file-verbs').waitFor(); assert.match(await id('item-verbs').innerText(), /varannut/); checks++; }
        else { await id('file-Viikkoraportit').click(); await id('agent-badge').waitFor(); checks++; }
      } else {
        await pick('ms-od');
        assert.match(await id('scope-out').innerText(), /Ei rajauksia/); checks++;
      }
      await fits();
      await capture(`${n}-1-kansio`);

      // 2: Outlook.
      await pick('ms-mail');
      if (d === 2) { assert.match(await id('scope-in').innerText(), /Koko postilaatikko/); checks++; ok(!(await has('msg-m1')), 'C: no messages'); }
      else { await id('msg-m1').waitFor(); checks++; }
      if (d === 1) { assert.match(await id('can-m1').innerText(), /Voi vastata/); checks++; ok(await has('grey-h-shared'), 'B: shared mailbox in place'); }
      await fits();
      await capture(`${n}-2-posti`);

      // 3: the drafts level: the agent writes, never sends.
      await level('drafts');
      if (d === 0) { await id('folder-Luonnokset').click(); await id('msg-d1').click(); assert.match(await id('ability').innerText(), /Ei voi lähettää/); checks++; }
      if (d === 1) { await id('folder-Luonnokset').click(); assert.match(await id('can-d1').innerText(), /Odottaa sinua/); checks++; await id('msg-d1').click(); assert.equal(await page.locator('[data-testid="mail-verbs"] li', {hasText: 'Lähettää'}).getAttribute('data-yes'), 'false'); checks++; }
      if (d === 2) { assert.equal(await page.locator('[data-testid="verbs"] li', {hasText: 'Lähettää'}).getAttribute('data-yes'), 'false'); checks++; }
      await fits();
      await capture(`${n}-3-luonnos`);
      await level('full');

      // 4: GitHub, with what cannot be narrowed.
      await pick('gh-repos');
      if (d === 0) { assert.match(await id('limits').innerText(), /GitHub ei anna rajata/); checks++; }
      if (d === 1) { ok(await has('grey-h-kesko'), 'B: org in place'); assert.match(await id('limits').innerText(), /GitHub ei anna rajata/); checks++; }
      if (d === 2) { assert.match(await id('scope-in').innerText(), /contoso/); checks++; assert.match(await id('verbs').innerText(), /Ei voi estää/); checks++; }
      await fits();
      await capture(`${n}-4-koodi`);

      // 5: read only at Microsoft.
      await level('read');
      await pick('ms-proj');
      if (d === 0) { assert.equal(await id('ability').getAttribute('data-can'), 'read'); checks++; }
      if (d === 1) { assert.match(await id('can-Kesko – kassajärjestelmä').innerText(), /Lukee kaiken/); checks++; }
      if (d === 2) { assert.equal(await page.locator('[data-testid="verbs"] li', {hasText: 'Muuttaa'}).getAttribute('data-yes'), 'false'); checks++; }
      await fits();
      await capture(`${n}-5-vain-luku`);
      await level('full');

      // 6, 7: where each fact comes from.
      await page.locator('#origins').check();
      await id('origins').scrollIntoViewIfNeeded();
      assert.match(await id('origins').innerText(), d === 2 ? /Ei uutta lukureittiä/ : /peilikansio/); checks++;
      await fits();
      await capture(`${n}-6-lahteet-tiedostot`);
      await pick('ms-mail');
      await id('origins').scrollIntoViewIfNeeded();
      assert.match(await id('origins').innerText(), d === 2 ? /Ei uutta lukureittiä/ : /uuden lukureitin/); checks++;
      await capture(`${n}-7-lahteet-posti`);
      await page.locator('#origins').uncheck();

      // 8: a hidden library's action leads to Microsoft's settings.
      await pick('ms-proj');
      const row = d === 0 ? 'h-yleinen' : 'grey-h-yleinen';
      await page.getByTestId(row).getByRole('button', {name: 'Valitse kirjastot'}).click();
      await id('settings-section-tiedot').waitFor(); checks++;
      await page.locator('[data-settings-row="microsoft"]').first().waitFor(); checks++;
      await capture(`${n}-8-asetukset`);
      await id('settings-close').click();
      await id('resources-page').waitFor();
    }
    await page.close();
  }
} finally { await browser.close(); }
assert.deepEqual(errors, []);
console.log(`ok: ${checks} checkpoints`);
