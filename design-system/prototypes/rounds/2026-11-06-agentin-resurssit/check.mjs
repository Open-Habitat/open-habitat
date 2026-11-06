// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every direction at 1440 and 390 light: the default view (every account in
// the list, the selected source's level and limits), Outlook mail with the
// agent's unsent draft, GitHub's repositories with what cannot be narrowed,
// the own machine, what the agent does not see, the read-only Microsoft
// level (C moves the sources between groups; the agent's report is gone),
// the drafts level (mail still writable, no sending), a source's settings
// in the production settings page and back, and connecting Apple from the
// list. The defaults again at 1440 and 390 dark. Screenshots at device
// scale factor 2; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-11-06-agentin-resurssit';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['r1-a-tileittain', 'r1-b-lajeittain', 'r1-c-oikeuksittain'];
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
    const level = async (v) => { await page.locator('#level').selectOption(v); await page.waitForTimeout(300); };
    // The phone shows one screen at a time: back to the list before picking.
    const toList = async () => { if (mobile && await page.getByTestId('detail-back').count()) await id('detail-back').click(); };
    const pick = async (src) => { await toList(); await id(`src-${src}`).scrollIntoViewIfNeeded(); await id(`src-${src}`).click(); await id('source-view').waitFor(); };
    for (const d of [0, 1, 2]) {
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.rv-review.variant-${d}`).waitFor({state: 'attached'});
      await id('rv-reset').click();
      await id('resources-page').waitFor();
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${'ABC'[d]} `)); checks++;
      // The default: every integration is in the list, which round 1 did not have.
      const list = id(['list-accounts', 'list-kinds', 'list-abilities'][d]);
      await list.waitFor();
      const text = await list.innerText();
      for (const word of ['OneDrive', 'Gmail', 'Dropbox', 'GitHub', 'Gitea', 'aino-mbp', 'GitLab']) ok(text.includes(word), `${n}: ${word} in the list`);
      if (!mobile) { await id('source-view').waitFor(); assert.equal(await id('ability').getAttribute('data-can'), 'change'); checks++; }
      else ok(!(await page.getByTestId('source-view').count()), 'phone starts from the list');
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      // Outlook: the inbox, and the agent's draft that was not sent.
      await pick('ms-mail');
      await id('msg-m1').waitFor();
      await id('folder-Luonnokset').click();
      await id('msg-d1').waitFor();
      ok(await id('agent-badge').isVisible(), 'draft badge');
      await id('msg-d1').click();
      assert.match(await id('message').innerText(), /ei lähetetty/); checks++;
      await fits();
      await capture(`${n}-1-posti`);

      // GitHub: every repository, and what GitHub does not let anyone narrow.
      await pick('gh-repos');
      assert.match(await id('limits').innerText(), /GitHub ei anna rajata/); checks++;
      assert.match(await id('hidden-list').innerText(), /kesko-digital/); checks++;
      ok(await page.getByTestId('repo-contoso/verkkosivut').count() === 1, 'read-only repo');
      await capture(`${n}-2-koodi`);

      // The own machine: everything its user may, until the line ends.
      await pick('mac');
      await id('machine').waitFor();
      assert.match(await id('ability').innerText(), /4\.12\.2026/); checks++;
      await capture(`${n}-3-kone`);

      // What the agent does not see.
      if (d === 2) {
        await toList();
        await id('band-hidden').scrollIntoViewIfNeeded();
        assert.match(await id('band-hidden').innerText(), /Johtoryhmä/); checks++;
        assert.match(await id('band-hidden').innerText(), /Muu Dropbox/); checks++;
      } else {
        await pick('ms-proj');
        await id('hidden-list').scrollIntoViewIfNeeded();
        assert.match(await id('hidden-list').innerText(), /Contoso yleinen/); checks++;
      }
      await capture(`${n}-4-ei-nae`);

      // Read only: Microsoft's sources say so; C moves them to Lukee.
      await level('read');
      await toList();
      if (d !== 2) { assert.match(await id('pill-ms').innerText(), /Vain luku/); checks++; }
      if (d === 2) {
        ok(await page.locator('[data-testid="band-read"] [data-testid="src-ms-proj"]').count() === 1, 'C moved SharePoint to Lukee');
        ok(await page.locator('[data-testid="band-change"] [data-testid="src-ms-mail"]').count() === 0, 'C moved mail to Lukee');
      }
      await pick('ms-proj');
      assert.equal(await id('ability').getAttribute('data-can'), 'read'); checks++;
      if (!(await page.getByTestId('file-Viikkoraportit').count())) await id('file-Kesko – kassajärjestelmä').click();
      await id('file-Viikkoraportit').click();
      ok(await page.getByTestId('file-Viikkoraportti vko 45.docx').count() === 0, 'no agent report at read');
      await fits();
      if (mobile && d === 2) await toList();
      await capture(`${n}-5-vain-luku`);
      // Drafts: mail is still written, never sent.
      await level('drafts');
      await pick('ms-mail');
      assert.equal(await id('ability').getAttribute('data-can'), 'change'); checks++;
      assert.match(await id('ability').innerText(), /Ei voi lähettää/); checks++;
      await level('full');

      // Settings: the source leads to its own account in the production page.
      await pick('gh-repos');
      await id('open-settings').click();
      await id('settings-section-koodipalvelut').waitFor(); checks++;
      await page.locator('[data-settings-row="github"]').waitFor(); checks++;
      await capture(`${n}-6-asetukset`);
      await id('settings-close').click();
      await id('resources-page').waitFor(); checks++;

      // Connecting: Apple from the list opens its row in Tiedot agenteille.
      await toList();
      await id('connect-apple').scrollIntoViewIfNeeded();
      await id('connect-apple').click();
      await id('settings-section-tiedot').waitFor(); checks++;
      await page.locator('[data-settings-row="apple"]').first().waitFor(); checks++;
      await capture(`${n}-7-yhdista`);
      await id('settings-close').click();
      await id('resources-page').waitFor();
    }
    await page.close();
  }
} finally { await browser.close(); }
assert.deepEqual(errors, []);
console.log(`ok: ${checks} checkpoints`);
