// Rakentaa kierroksen (build.mjs) ja tarkistaa sen offline-tilassa: jokainen suunta vaaleana,
// tummana, 1280 px työpöydällä ja 390 px puhelimessa. Tarkistaa kellon näkymisen, lukemattomat,
// kuittauksen, ratkeamisen, noston taittumisen, Escin ja kohdistuksen palautumisen, ylläpitäjän
// ryhmät, ettei yläpalkki vuoda puhelimessa, ettei konsolissa ole virheitä eikä verkkopyyntöjä,
// ja valitsimen (picker-check). Kuvat evidence/-hakemistoon PNG:nä laitteen skaalauksella 2;
// muunna ne: python3 scripts/screenshots-to-avif.py issues/proto-notification-bell/prototypes/kello/evidence
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-notification-bell/prototypes/kello/verify.mjs
// Worktree ilman web/node_modulesia: OH_WEB_PACKAGE=<toinen checkout>/web/package.json
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkPicker } from '../../../../design-system/prototypes/picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(process.env.OH_WEB_PACKAGE ?? path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

execFileSync('node', [path.join(here, 'build.mjs')], { stdio: 'inherit' });
const file = path.join(here, 'index.html');
const out = path.join(here, 'evidence');
mkdirSync(out, { recursive: true });
// Aiemmat kuvat korvataan tiedosto kerrallaan, hakemistoa ei poisteta.
for (const f of readdirSync(out).filter((f) => /\.(png|avif)$/.test(f))) rmSync(path.join(out, f));

const NAMES = ['1-tila', '2-saapuneet', '3-nosto', '4-nykyinen'];
const HEIGHTS = { 1280: 800, 390: 844 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [], requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });

const loc = (sel) => page.locator('#frame ' + sel);
const bell = () => page.locator('#frame [data-testid="bell"] >> visible=true');
const theme = (t) => (t === 'dark' ? 'tumma' : 'vaalea');
const width = (w) => (w === '390' ? 'puhelin' : '1280');
async function open(v, o = {}) {
  const w = o.w ?? '1280';
  await page.setViewportSize({ width: +w, height: HEIGHTS[w] });
  const q = new URLSearchParams({ v: v + 1, bare: '1', t: 'light', w, s: 'many', view: 'conv', role: 'person', ...o });
  await page.goto(pathToFileURL(file).href + '?' + q);
  await page.waitForFunction(() => document.querySelector('#frame .shell'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(260);
}
const shot = (name) => page.screenshot({ path: path.join(out, name + '.png') });
async function noOverflow(label) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('#frame .topbar, #frame .peek, #frame .panel, #frame .ws-head')]
    .filter((el) => el.offsetParent && el.scrollWidth > el.clientWidth + 1).map((el) => el.className));
  assert.deepEqual(bad, [], `${label}: horizontal overflow`);
}
async function clickBell() { await bell().click(); await page.waitForTimeout(200); }

let cases = 0;
// --- Ruutukaappaukset ja yleiset tarkistukset ---
for (const [v, name] of NAMES.entries()) {
  for (const w of ['1280', '390']) {
    for (const t of ['light', 'dark']) {
      const tag = `${name}-${width(w)}-${theme(t)}`;
      await open(v, { w, t });
      await checkPicker(page, 'kello');
      await noOverflow(tag);
      await shot(`${name}-useita-${width(w)}-${theme(t)}`);
      if (v < 3) {
        await clickBell();
        assert.equal(await loc('[data-testid="bell-panel"]').count(), 1, `${tag}: panel opens`);
        await noOverflow(tag + ' auki');
        await shot(`${name}-auki-${width(w)}-${theme(t)}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(120);
        assert.equal(await loc('[data-testid="bell-panel"]').count(), 0, `${tag}: Esc closes`);
        assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'bell', `${tag}: focus returns to the bell`);
      }
      cases++;
    }
  }
}

// --- Tila: kello vain kun jokin on voimassa; ratkeaminen poistaa sen ---
await open(0, { s: 'none' });
assert.equal(await bell().count(), 0, 'Tila: no bell when nothing holds');
await open(0, { s: 'warn' });
assert.equal(await loc('[data-testid="bell"] .badge').innerText(), '1');
await clickBell();
await loc('[data-act="recheck"]').click();
await page.waitForTimeout(150);
assert.equal(await loc('[data-testid="bell-empty"]').count(), 1, 'Tila: resolved item leaves the panel');
await page.keyboard.press('Escape');
await page.waitForTimeout(120);
assert.equal(await bell().count(), 0, 'Tila: bell disappears after the condition clears');
await open(0, { s: 'full' });
assert.match(await bell().innerText(), /Tila täynnä/, 'Tila: danger shows in words');
await shot('1-tila-taynna-1280-vaalea');
await open(0, { s: 'full', w: '390', t: 'dark' });
await noOverflow('Tila full phone');
await shot('1-tila-taynna-puhelin-tumma');
await open(0, { role: 'admin', open: '1' });
assert.equal(await loc('[data-testid="bell-item"]').count(), 4, 'Tila admin: server item');
assert.equal(await loc('.panel .group').count(), 2, 'Tila admin: groups');
await shot('1-tila-yllapitaja-auki-1280-vaalea');
await open(0, { view: 'ws', open: '1', t: 'dark' });
assert.equal(await loc('[data-testid="bell-item"]').count(), 3, 'Tila ws: panel on the workspace page');
await shot('1-tila-tyotila-auki-1280-tumma');
await open(0, { view: 'ws', w: '390' });
assert.equal(await bell().count(), 1, 'Tila ws phone: one visible bell');
await noOverflow('ws phone');
await shot('1-tila-tyotila-puhelin-vaalea');
// Saapuva asia soittaa kelloa.
await open(0, { s: 'warn' });
await page.locator('[data-ev="version"]').dispatchEvent('click');
await page.waitForTimeout(100);
assert.equal(await loc('[data-testid="bell"] .badge').innerText(), '2', 'Tila: arrival adds to the count');

// --- Saapuneet: lukemattomat, kuittaus, ratkenneet ---
await open(1, { s: 'none' });
assert.equal(await bell().count(), 1, 'Saapuneet: bell is always there');
assert.equal(await loc('[data-testid="bell"] .badge').count(), 0);
await clickBell();
assert.equal(await loc('[data-testid="bell-empty"]').count(), 1);
await open(1);
assert.equal(await loc('[data-testid="bell"] .badge').innerText(), '3');
await clickBell();
assert.equal(await loc('.item .new').count(), 3, 'Saapuneet: unseen marked new on open');
await loc('.x').first().click();
await page.waitForTimeout(120);
assert.equal(await loc('[data-testid="bell-item"]').count(), 2, 'Saapuneet: dismiss hides the item');
await loc('[data-act="recheck"]').click();
await page.waitForTimeout(150);
assert.equal(await loc('[data-testid="bell-resolved"]').count(), 1, 'Saapuneet: resolved stays listed');
await shot('2-saapuneet-ratkennut-1280-vaalea');
await page.keyboard.press('Escape');
assert.equal(await loc('[data-testid="bell"] .badge').count(), 0, 'Saapuneet: opening marks seen');
await page.locator('[data-ev="fill"]').dispatchEvent('click');
await page.waitForTimeout(100);
assert.equal(await loc('[data-testid="bell"] .badge').innerText(), '1', 'Saapuneet: a new state is unread again');

// --- Nosto: tärkein nousee riviksi, muut kelloon; varoitus taittuu itse ---
await open(2);
assert.equal(await loc('[data-testid="peek"]').getAttribute('data-key'), 'github:expired', 'Nosto: danger peeks first');
assert.match(await loc('[data-testid="peek"]').innerText(), /\+2 kellossa/);
await loc('[data-fold]').click();
await page.waitForTimeout(350);
assert.equal(await loc('[data-testid="peek"]').count(), 0, 'Nosto: fold hides the row');
assert.equal(await loc('[data-testid="bell"] .unread').count(), 1, 'Nosto: unread dot after fold');
await shot('3-nosto-taitettu-1280-vaalea');
await clickBell();
assert.equal(await loc('[data-testid="bell-item"]').count(), 3);
await page.keyboard.press('Escape');
assert.equal(await loc('[data-testid="bell"] .unread').count(), 0, 'Nosto: opening clears the dot');
await open(2, { s: 'warn' });
assert.equal(await loc('[data-testid="peek"]').count(), 1);
await page.waitForTimeout(8600);
assert.equal(await loc('[data-testid="peek"]').count(), 0, 'Nosto: warning folds itself after 8 s');
await open(2, { s: 'full' });
await page.waitForTimeout(8600);
assert.equal(await loc('[data-testid="peek"]').count(), 1, 'Nosto: danger stays until resolved or folded');

// --- Nykyinen ---
await open(3);
assert.equal(await loc('[data-testid="strip"]').count(), 3, 'Nykyinen: three strips');
assert.equal(await bell().count(), 0);

await browser.close();
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${cases} variant/size/theme cases, ${readdirSync(out).filter((f) => f.endsWith('.png')).length} screenshots`);
