// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every riff at 1440 and 390 light, one stage per kind's section: files
// (the default), mail with the agent's unsent draft, calendar, contacts,
// code with what GitHub cannot narrow, machines (one expired), what the
// agent does not see, the read-only and drafts Microsoft levels, Microsoft's
// settings from the mail section in the production settings page and back,
// and connecting Apple from the mail section. The defaults again at 1440
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
const round = '2026-11-06-resurssien-lajit';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['r2-a-valilehdet', 'r2-b-yhdessa', 'r2-c-kortit'];
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
    const click = async (x) => { await id(x).scrollIntoViewIfNeeded(); await id(x).click(); };
    const level = async (v) => { await page.locator('#level').selectOption(v); await page.waitForTimeout(300); };
    // The phone shows one screen at a time: back to the kinds before picking.
    const kind = async (k) => {
      if (mobile && await page.getByTestId('detail-back').count()) await id('detail-back').click();
      await click(`kind-${k}`);
      await page.locator(`[data-testid="kind-section"][data-kind="${k}"]`).waitFor();
    };
    const top = async () => page.evaluate(() => document.querySelectorAll('.rv-page, .rv-detail').forEach((e) => e.scrollTo(0, 0)));
    for (const d of [0, 1, 2]) {
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.rv-review.variant-${d}`).waitFor({state: 'attached'});
      await id('rv-reset').click();
      await id('resources-page').waitFor();
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${'ABC'[d]} `)); checks++;
      const text = await id('list-kinds').innerText();
      for (const word of ['Tiedostot', 'Posti', 'Kalenteri', 'Yhteystiedot', 'Koodi', 'Koneet']) ok(text.includes(word), `${n}: ${word} in the kinds`);
      if (!mobile) {
        // The default: the files section, whose pattern is the riff.
        const section = id('kind-section');
        assert.equal(await section.getAttribute('data-kind'), 'files'); checks++;
        if (d === 0) { ok(await id('tab-ms-proj').getAttribute('aria-selected') === 'true', 'A: SharePoint tab'); ok(await page.getByTestId('agent-badge').count() > 0, 'A: agent report'); }
        if (d === 1) { ok(await page.getByTestId('lvl-g-drive').count() === 1, 'B: level table'); ok(await page.getByTestId('root-db-app').count() === 1, 'B: every root together'); }
        if (d === 2) { ok(await page.getByTestId('card-ms-od').count() === 1, 'C: cards'); ok(await page.getByTestId('files').count() === 0, 'C: content folded'); }
      } else ok(!(await page.getByTestId('kind-section').count()), 'phone starts from the kinds');
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      // Mail: the agent's draft, not sent.
      await kind('mail');
      if (d === 2) await click('browse-ms-mail');
      await click('folder-Luonnokset');
      await click('msg-d1');
      assert.match(await id('message').innerText(), /ei lähetetty/); checks++;
      if (d === 1) ok(await page.getByTestId('lvl-g-mail').count() === 1, 'B: Gmail in the level table');
      await fits();
      await capture(`${n}-1-posti`);

      // Calendar: Outlook and Google; B together in one agenda.
      await kind('calendar');
      if (d === 2) await click('browse-ms-cal');
      ok(await page.getByTestId('event-Kesko: viikkopalaveri').count() === 1, 'Outlook event');
      if (d === 1) ok(await page.getByTestId('event-Uintikilpailu, Leo').count() === 1, 'B: Google event together');
      assert.match(await page.locator('[data-testid^="limits-ms-cal"]').first().innerText(), /kutsut/); checks++;
      await fits();
      await capture(`${n}-2-kalenteri`);

      // Contacts.
      await kind('contacts');
      if (d === 0) await click('tab-g-contacts');
      if (d === 2) await click('browse-g-contacts');
      ok(await page.getByTestId('person-Matti Virtanen').count() === 1, 'Google contact');
      await fits();
      await capture(`${n}-3-yhteystiedot`);

      // Code: what GitHub does not let anyone narrow, and the organisation it hides.
      await kind('code');
      assert.match(await id('limits-gh-repos').innerText(), /GitHub ei anna rajata/); checks++;
      assert.match(await id('h-kesko').innerText(), /kesko-digital/); checks++;
      if (d === 2) await click('browse-gh-repos');
      ok(await page.getByTestId('repo-contoso/verkkosivut').count() === 1, 'read-only repo');
      await fits();
      await capture(`${n}-4-koodi`);

      // Machines: one line open, one ended.
      await kind('machine');
      if (d === 0) await click('tab-pc');
      if (d === 2) await click('browse-mac');
      ok(await page.getByTestId(d === 1 ? 'lvl-pc' : 'ability-pc').count() === 1, 'expired machine');
      if (d !== 0) { assert.match(await id(d === 1 ? 'lvl-mac' : 'ability-mac').innerText(), /4\.12\.2026/); checks++; }
      assert.match(await page.getByTestId('kind-summary').innerText(), /ei pääse 1/); checks++;
      await fits();
      await capture(`${n}-5-koneet`);

      // What the agent does not see: the files the person left out.
      await kind('files');
      if (d === 0) await click('tab-ms-proj');
      await id('h-yleinen').scrollIntoViewIfNeeded();
      ok(await id('h-yleinen').isVisible(), 'unselected library');
      ok(await page.getByTestId('h-dropbox').count() === (d === 0 ? 0 : 1), 'Dropbox beyond the app folder');
      await capture(`${n}-6-ei-nae`);

      // Read only: Microsoft's file sources say so and the agent's report is gone.
      await level('read');
      await top();
      assert.equal(await id('ability-ms-proj').getAttribute('data-can'), 'read'); checks++;
      if (d === 1) { await click('root-ms-proj'); await click('file-Kesko – kassajärjestelmä'); }
      if (d === 2) await click('browse-ms-proj');
      if (d === 0 || d === 2) await page.getByTestId('crumbs').first().waitFor();
      if (await page.getByTestId('file-Viikkoraportit').count()) await click('file-Viikkoraportit');
      ok(await page.getByTestId('file-Viikkoraportti vko 45.docx').count() === 0, 'no agent report at read');
      ok(await page.getByTestId('file-Viikkoraportti vko 44.docx').count() === 1, 'older report still there');
      await fits();
      await capture(`${n}-7-vain-luku`);
      // Drafts: mail is still written, never sent.
      await level('drafts');
      await kind('mail');
      assert.equal(await id('ability-ms-mail').getAttribute('data-can'), 'change'); checks++;
      assert.match(await id('ability-ms-mail').innerText(), /Ei voi lähettää/); checks++;
      await level('full');

      // Settings: from the mail section to Microsoft's row in the production page.
      await click('settings-ms-mail');
      await id('settings-section-tiedot').waitFor(); checks++;
      await page.locator('[data-settings-row="microsoft"]').first().waitFor(); checks++;
      await capture(`${n}-8-asetukset`);
      await id('settings-close').click();
      await id('resources-page').waitFor(); checks++;
      if (!mobile) { assert.equal(await id('kind-section').getAttribute('data-kind'), 'mail'); checks++; }

      // Connecting: Apple from the mail section opens its row in Tiedot agenteille.
      await kind('mail');
      await click('connect-apple');
      await id('settings-section-tiedot').waitFor(); checks++;
      await page.locator('[data-settings-row="apple"]').first().waitFor(); checks++;
      await capture(`${n}-9-yhdista`);
      await id('settings-close').click();
      await id('resources-page').waitFor();
    }
    await page.close();
  }
} finally { await browser.close(); }
assert.deepEqual(errors, []);
console.log(`ok: ${checks} checkpoints`);
