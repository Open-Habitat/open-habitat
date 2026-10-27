// node check.mjs <offline.html> <screenshot-dir>
// Synthetic prototype check, not a host-backed acceptance test: every
// direction in light and dark at 1440 and 390 px, the connect flow and its
// refusals, the card's states, the common list's arrangement and an import.
// Screenshots at device scale factor 2 (light and dark, desktop and phone).
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-10-27-gitlab-yhdistys', names = ['Koko polku', 'Pääryhmä', 'Ryhmäsuodatin'];
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
let checks = 0; const errors = [];
try {
 for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({viewport: {width, height: width > 400 ? 1000 : 844}, deviceScaleFactor: 2, reducedMotion: 'reduce'});
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.route('http://prototype.test/**', r => r.fulfill({contentType: 'text/html', body: readFileSync(input, 'utf8')}));
  await page.goto('http://prototype.test/');
  const id = x => page.getByTestId(x).first();
  const tag = `${width === 390 ? 'phone' : 'desktop'}-${theme}`;
  // Light desktop gets every shot; the others the ones that change most.
  const shot = async (name, always = false) => {if (always || tag === 'desktop-light') await page.screenshot({path: `${out}/${name}-${tag}.png`});};
  const fit = async () => {
   assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.proto-picker')).slice(0, 4).map(e => `${e.tagName}.${e.className}`)), [], 'document overflow');
   for (const el of await page.locator('.shell button:visible,.ah-dialog button:visible').all()) {const b = await el.boundingBox(); if (b) assert.ok(b.x >= -1 && b.x + b.width <= width + 1, `control overflow ${JSON.stringify(b)}`);}
   checks++;
  };
  await page.locator('#theme').selectOption(theme);
  await checkPicker(page, round);
  const pick = async d => {await page.locator('.proto-picker-item').nth(d).click(); await page.locator(`.shell.variant-${d}`).waitFor();};
  const scenario = async label => {await id('scenario').getByRole('button', {name: label, exact: true}).click();};
  const outcome = async o => {await page.locator('#outcome').selectOption(o);};
  const toSettings = () => id('nav-settings').click();
  const toNew = () => id('nav-new').click();
  const back = async () => {const b = page.getByTestId('all-repos'); if (await b.isVisible()) await b.click();};

  // ---- Connect: refusals at the top, the form kept ----
  await scenario('Ei GitLabia'); await toSettings();
  await id('gitlab-tile').waitFor(); await fit(); await shot('1-koodipalvelut-ei-gitlabia');
  await id('gitlab-open').click();
  assert.equal(await id('gitlab-address').inputValue(), 'https://gitlab.com', 'gitlab.com is the default');
  assert.match(await id('gitlab-token-link').getAttribute('href'), /^https:\/\/gitlab\.com\/-\/user_settings\/personal_access_tokens\?name=Open\+Habitat&scopes=read_api,write_repository$/);
  await id('gitlab-submit').click();
  assert.equal(await id('gitlab-error').getAttribute('data-field'), 'token');
  await id('gitlab-address').fill('gitlab.yritys.fi'); await id('gitlab-token-input').click();
  assert.equal(await id('gitlab-address').inputValue(), 'https://gitlab.yritys.fi', 'https:// added on leaving the field');
  assert.match(await id('gitlab-token-link').getAttribute('href'), /^https:\/\/gitlab\.yritys\.fi\/-\/user_settings/);
  await outcome('tls'); await id('gitlab-token-input').fill('glpat-esimerkki'); await id('gitlab-submit').click();
  await id('gitlab-error').waitFor();
  assert.equal(await id('gitlab-error').getAttribute('data-field'), 'server');
  assert.match(await id('gitlab-error').innerText(), /varmennetta/);
  assert.equal(await id('gitlab-address').getAttribute('aria-invalid'), 'true');
  assert.equal(await id('gitlab-token-input').inputValue(), 'glpat-esimerkki', 'fields kept on refusal');
  await id('gitlab-token-help').click(); await id('gitlab-token-instructions').waitFor();
  // The error stays in view without scrolling, also with the help open.
  const eb = await id('gitlab-error').boundingBox(); assert.ok(eb.y >= 0 && eb.y + eb.height <= (width > 400 ? 1000 : 844), 'error visible');
  await fit(); await shot('2-yhdista-tls-virhe', true);
  for (const [o, field, re] of [['notgitlab', 'server', /ei vastannut GitLab/], ['unreachable', 'server', /ei vastaa/], ['rejected', 'token', /hylkäsi/], ['expired', 'token', /vanhentunut/], ['noscope', 'token', /read_api/]]) {
   await outcome(o); await id('gitlab-submit').click();
   await page.waitForFunction(r => document.querySelector('[data-testid=gitlab-error]')?.textContent.match(new RegExp(r)), re.source);
   assert.equal(await id('gitlab-error').getAttribute('data-field'), field, o);
  }
  // Connect gitlab.com read-only first: push is said to fail.
  await id('gitlab-address').fill('https://gitlab.com'); await outcome('readonly'); await id('gitlab-submit').click();
  await id('gitlab-connected').waitFor();
  assert.equal(await id('gitlab-connected').getAttribute('data-push'), 'no');
  await id('gitlab-readonly').waitFor(); await fit(); await shot('3-yhdistetty-vain-luku');
  await id('gitlab-done').click();
  assert.equal(await id('gitlab-connection').getAttribute('data-push'), 'no');
  // One account per server: the same host is refused before any request.
  await id('gitlab-add').click(); await id('gitlab-token-input').fill('x'); await id('gitlab-submit').click();
  assert.match(await id('gitlab-error').innerText(), /yhden tilin palvelinta kohden/);
  await page.keyboard.press('Escape');
  // Replace the token with a full one.
  await outcome('ok'); await id('gitlab-replace').click(); await id('gitlab-token-input').fill('glpat-uusi'); await id('gitlab-submit').click();
  await id('gitlab-connected').waitFor(); assert.match(await page.getByTestId('gitlab-dialog').innerText(), /Tunnus vaihdettu/); await id('gitlab-done').click();
  assert.equal(await id('gitlab-connection').getAttribute('data-push'), 'yes');
  await id('gitlab-check').click(); assert.equal(await id('gitlab-check-result').innerText(), 'Tunnus toimii');

  // ---- Card states ----
  await scenario('Myös oma GitLab');
  await page.locator('[data-testid=gitlab-connection][data-host="gitlab.yritys.fi"]').waitFor();
  assert.match(await page.locator('[data-host="gitlab.yritys.fi"] [data-testid=gitlab-token]').innerText(), /Vanhenee 9 pv:n päästä/);
  assert.equal(await page.locator('[data-host="gitlab.yritys.fi"]').getAttribute('data-push'), 'unknown');
  assert.match(await id('gitlab-excluded').innerText(), /external_url/);
  await page.locator('[data-host="gitlab.yritys.fi"]').scrollIntoViewIfNeeded();
  await fit(); await shot('4-kortit-vanhenee-ja-external-url', true);
  await scenario('Tunnus vanhentunut');
  assert.equal(await id('gitlab-connection').getAttribute('data-state'), 'expired');
  await page.locator('[data-testid=code-host-workspace][data-host=gitlab]').getByText(/Pull ja push eivät onnistu/).waitFor();
  await fit(); await shot('5-tunnus-vanhentunut');
  await toNew();
  assert.match(await id('repository-source-note').innerText(), /tunnus vanheni 20\.10\.2026/);
  assert.equal(await page.locator('[data-testid^="repository-option-gitlab.com/"]').count(), 0, 'an expired source lists nothing');

  // ---- The common list, per direction ----
  await scenario('Myös oma GitLab'); await toNew();
  const sections = () => page.locator('[data-testid=repo-section]').evaluateAll(es => es.map(e => e.dataset.title));
  for (const d of [0, 1, 2]) {
   await pick(d);
   await toNew(); await id('repository-search').waitFor();
   const s = await sections();
   if (d === 0) {
    assert.ok(s.includes('konepaja/verkkokauppa/infra') && s.includes('konepaja/asiakkaat/kauppa-oy'), 'a section per full path');
    assert.ok(!s.includes('konepaja'));
   } else {
    assert.ok(s.includes('konepaja') && s.includes('pankki-oy') && s.includes('tuotanto'), 'a section per top group');
    assert.ok(!s.some(t => t.includes('/')), 'no nested section titles');
    const sec = page.locator('[data-testid=repo-section][data-title=konepaja]');
    assert.match(await sec.locator('.ah-clone-row-name').first().innerText(), /^[a-z-]+\/|^[a-z-]+$/);
    await sec.getByTestId('expand-repos').click();
    await sec.getByTestId('repository-option-gitlab.com/konepaja/verkkokauppa/infra/terraform').waitFor();
    assert.match(await sec.getByTestId('repository-option-gitlab.com/konepaja/verkkokauppa/infra/terraform').innerText(), /^verkkokauppa\/infra\/terraform/);
   }
   assert.equal(await page.getByTestId('group-filter').count(), d === 2 ? 1 : 0);
   if (d === 2) {
    const opts = await page.getByTestId('group-filter').locator('option').allInnerTexts();
    assert.ok(opts.some(o => /verkkokauppa \(4\)/.test(o)) && opts.some(o => /tuotanto \(3\)/.test(o)), 'options built from projects');
    await page.getByTestId('group-filter').selectOption('gitlab.com konepaja/verkkokauppa');
    assert.deepEqual(await sections(), ['konepaja/verkkokauppa']);
    assert.equal(await page.locator('[data-testid^="repository-option-"]').count(), 4);
    assert.match(await id('repository-option-gitlab.com/konepaja/verkkokauppa/infra/ansible').innerText(), /^infra\/ansible/);
   }
   // The external_url note, with its way to Koodipalvelut.
   assert.match(await page.getByTestId('repository-source-note').first().innerText(), /external_url/);
   await page.locator('.ah-clone-finder').scrollIntoViewIfNeeded();
   await fit(); await shot(`6-lista-${d + 1}`, true);
   if (d === 2) await id('group-clear').click();
   // Search reaches the group path.
   await id('repository-search').fill('asiakkaat');
   assert.equal(await page.locator('[data-testid^="repository-option-"]').count(), 3);
   await id('repository-search').fill('');
   checks++;
  }

  // ---- Import (same in every direction) ----
  await pick(1); await toNew();
  // A name already taken by another source's workspace.
  await id('repository-search').fill('aino.virtanen/notes');
  await id('repository-option-gitlab.com/aino.virtanen/notes').click();
  await id('repo-taken').waitFor(); assert.match(await id('repo-taken').innerText(), /GitHub esimerkki\/notes/);
  await back();
  await id('repository-search').fill('terraform');
  await id('repository-option-gitlab.com/konepaja/verkkokauppa/infra/terraform').click();
  assert.equal(await id('repo-details-group').innerText(), 'konepaja › verkkokauppa › infra');
  assert.match(await id('repo-details-push').innerText(), /Toimii/);
  await fit(); await shot('7-tiedot', true);
  await id('repository-clone').click();
  await page.locator('[data-testid=clone-job][data-state=confirmed]').waitFor();
  assert.match(await page.locator('[data-testid=clone-job]').innerText(), /~\/src\/terraform/);
  await fit(); await shot('8-kloonattu');
  await back();
  // An SSO group refuses Git.
  await id('repository-search').fill('mobiilisovellus');
  await id('repository-option-gitlab.com/pankki-oy/digi/mobiilisovellus').click();
  await id('repository-clone').click();
  await page.locator('[data-testid=clone-job][data-state=failed]').waitFor();
  assert.match(await id('clone-reason').innerText(), /SSO-istunnon/);
  await page.locator('[data-testid=clone-job][data-state=failed]').scrollIntoViewIfNeeded();
  await fit(); await shot('9-sso-virhe', true);
  // The new workspace is listed in Koodipalvelut with its GitLab source.
  await toSettings();
  await page.locator('[data-testid=code-host-workspace][data-host=gitlab]').filter({hasText: 'konepaja/verkkokauppa/infra/terraform'}).waitFor();
  await page.close();
 }
} finally {await browser.close();}
assert.deepEqual(errors, [], 'console errors');
writeFileSync(`${out}/checks.json`, JSON.stringify({round, checks, errors}, null, 1) + '\n');
console.log(`${checks} checkpoints, no console errors`);
