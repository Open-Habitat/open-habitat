// Rakentaa kierroksen (build.mjs) ja tarkistaa sen offline-tilassa: jokainen suunta vaaleana,
// tummana, 1280 px työpöydällä ja 390 px puhelimessa, ja jokaisen suunnan kulku: tarjous,
// siirtyminen Alt+↓:llä, vastaaminen, lähtökeskustelun valmistuminen, paluu Alt+↑:llä tai Escillä,
// toisaalla hoidettu kysymys. Lisäksi ettei telakka vuoda vaakasuunnassa, ettei konsolissa ole
// virheitä eikä verkkopyyntöjä, ja valitsin (picker-check). Kuvat evidence/-hakemistoon PNG:nä
// laitteen skaalauksella 2; muunna ne:
//   python3 scripts/screenshots-to-avif.py issues/proto-next-waiting-navigation/prototypes/siirtyma/evidence
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-next-waiting-navigation/prototypes/siirtyma/verify.mjs
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

const NAMES = ['1-paluu', '2-jono', '3-rinnakkain', '4-nykyinen'];
const HEIGHTS = { 1280: 800, 390: 844 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [], requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });

const loc = (sel) => page.locator('#frame ' + sel);
const theme = (t) => (t === 'dark' ? 'tumma' : 'vaalea');
const width = (w) => (w === '390' ? 'puhelin' : '1280');
let W = '1280', T = 'light';
async function open(v, o = {}) {
  W = o.w ?? '1280'; T = o.t ?? 'light';
  await page.setViewportSize({ width: +W, height: HEIGHTS[W] });
  const q = new URLSearchParams({ v: v + 1, bare: '1', shot: '1', auto: '0', t: T, w: W, ...o });
  await page.goto(pathToFileURL(file).href + '?' + q);
  await page.waitForFunction(() => document.querySelector('#frame .shell'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}
const shot = (name) => page.screenshot({ path: path.join(out, `${name}-${width(W)}-${theme(T)}.png`) });
const title = () => loc('.col [data-testid="title"]').innerText();
async function key(k) {
  // Kuten kirjoittaessa: kohdistus kentässä.
  await loc('.col textarea').first().focus();
  await page.keyboard.press(k);
  await page.waitForTimeout(150);
}
async function ev(name) { await page.locator(`[data-ev="${name}"]`).dispatchEvent('click'); await page.waitForTimeout(120); }
async function answer(text, scope = '.col') { await loc(`${scope} .opt:text-is("${text}")`).click(); await page.waitForTimeout(120); }
async function noOverflow(label) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('#frame .topbar, #frame .dock, #frame .dock > *, #frame .pane-head, #frame .composer')]
    .filter((el) => el.offsetParent && el.scrollWidth > el.clientWidth + 1).map((el) => el.className));
  assert.deepEqual(bad, [], `${label}: horizontal overflow`);
}

let cases = 0;
// --- Valitsin, perustila ja kuvat kaikissa ko'oissa ja teemoissa ---
for (const [v, name] of NAMES.entries()) {
  for (const w of ['1280', '390']) {
    for (const t of ['light', 'dark']) {
      await open(v, { w, t, bare: '0', shot: '0' });
      await checkPicker(page, 'siirtyma');
      await open(v, { w, t });
      await noOverflow(`${name} ${w} ${t}`);
      assert.equal(await loc('[data-testid="next-open"]').count(), 1, `${name}: offer while the agent works`);
      await shot(`${name}-lahto`);
      cases++;
    }
  }
}

// --- Paluu: tarjous alla (Alt+↓), paluu lähtöön yllä (Alt+↑) ---
for (const [w, t] of [['1280', 'light'], ['390', 'dark'], ['1280', 'dark'], ['390', 'light']]) {
  await open(0, { w, t });
  assert.equal(await loc('[data-testid="next-open"]').getAttribute('data-offer'), 'b');
  await key('Alt+ArrowDown');
  assert.equal(await title(), 'Varmuuskopion ajastus', 'Paluu: Alt+↓ opens the offer');
  assert.equal(await loc('[data-testid="return"]').count(), 1, 'Paluu: return line in the target');
  assert.match(await loc('[data-testid="return"]').innerText(), /Kirjautumisen virheilmoitukset/);
  assert.equal(await loc('[data-testid="next-open"]').count(), 0, 'Paluu: no offer while the target asks');
  await noOverflow('Paluu target');
  await shot('1-paluu-kohteessa');
  await answer('Klo 4.30');
  assert.equal(await loc('[data-testid="next-open"]').getAttribute('data-offer'), 'c', 'Paluu: next offer after answering');
  await shot('1-paluu-vastattu');
  await ev('origin');
  assert.match(await loc('[data-testid="return"]').getAttribute('class'), /ready/, 'Paluu: return line turns ready');
  await noOverflow('Paluu ready');
  await shot('1-paluu-lahto-valmis');
  // Luettu vastaus ei tarvitse sinua: seuraava tarjotaan heti.
  await key('Alt+ArrowDown');
  assert.equal(await title(), 'Tiedostopuun lajittelu');
  assert.equal(await loc('[data-testid="next-open"]').getAttribute('data-offer'), 'd', 'Paluu: offer after a read reply');
  await key('Alt+ArrowUp');
  assert.equal(await title(), 'Kirjautumisen virheilmoitukset', 'Paluu: Alt+↑ returns to the origin');
  assert.equal(await loc('[data-testid="return"]').count(), 0, 'Paluu: the walk ends at the origin');
  cases++;
}
// Toisaalla hoidettu: tarjous siirtyy ja sanoo sen kerran.
await open(0);
await ev('elsewhere');
assert.equal(await loc('[data-testid="next-open"]').getAttribute('data-offer'), 'c');
assert.match(await loc('[data-testid="next-note"]').innerText(), /hoidettiin toisaalla/);
await shot('1-paluu-toisaalla');

// --- Jono: koko kierros näkyvissä, Alt+↓/Alt+↑ kulkevat siinä ---
for (const [w, t] of [['1280', 'light'], ['390', 'dark'], ['1280', 'dark'], ['390', 'light']]) {
  await open(1, { w, t });
  assert.match(await loc('[data-testid="next-open"]').innerText(), /3 odottaa sinua/);
  await key('Alt+ArrowDown');
  assert.equal(await title(), 'Varmuuskopion ajastus', 'Jono: Alt+↓ starts the round');
  assert.equal(await loc('[data-testid="queue"]').count(), 1, 'Jono: queue visible also while the target asks');
  await noOverflow('Jono queue');
  await shot('2-jono-kohteessa');
  await answer('Klo 4.30');
  await key('Alt+ArrowDown');
  assert.equal(await title(), 'Tiedostopuun lajittelu');
  await key('Alt+ArrowUp');
  assert.equal(await title(), 'Varmuuskopion ajastus', 'Jono: Alt+↑ steps back');
  await key('Alt+ArrowDown');
  await ev('origin');
  await shot('2-jono-lahto-valmis');
  await key('Alt+ArrowDown');
  assert.equal(await title(), 'Laskun PDF-pohja');
  await key('Alt+ArrowDown');
  assert.equal(await title(), 'Kirjautumisen virheilmoitukset', 'Jono: the end leads back to the origin');
  assert.equal(await loc('[data-testid="queue"]').count(), 0, 'Jono: the round ends');
  assert.match(await loc('[data-testid="next-note"]').innerText(), /Kierros käyty: 3 hoidettu/);
  await shot('2-jono-kierros-kayty');
  cases++;
}
await open(1);
await key('Alt+ArrowDown');
await key('Alt+ArrowDown');
await ev('elsewhere');
assert.match(await loc('[data-testid="q-step"]').nth(1).getAttribute('class'), /gone/, 'Jono: handled elsewhere is struck');
await shot('2-jono-toisaalla');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
assert.equal(await loc('[data-testid="queue"]').count(), 0, 'Jono: Esc ends the round');

// --- Rinnakkain: odottava viereen, nykyinen jää näkyviin ---
for (const [w, t] of [['1280', 'light'], ['390', 'dark'], ['1280', 'dark'], ['390', 'light']]) {
  await open(2, { w, t });
  await key('Alt+ArrowDown');
  assert.equal(await loc('[data-testid="pane"]').count(), 1, 'Rinnakkain: Alt+↓ opens beside');
  assert.equal(await title(), 'Kirjautumisen virheilmoitukset', 'Rinnakkain: the current conversation stays');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.conv), 'b', 'Rinnakkain: focus in the pane');
  await noOverflow('Rinnakkain pane');
  await shot('3-rinnakkain-viereinen');
  await answer('Klo 4.30', '.pane');
  assert.equal(await loc('.pane [data-testid="next-open"]').getAttribute('data-offer'), 'c');
  await loc('.pane [data-testid="next-open"]').click();
  await page.waitForTimeout(150);
  assert.match(await loc('.pane-head').innerText(), /Tiedostopuun lajittelu/);
  await ev('origin');
  // Työpöydällä lähtö on näkyvissä, joten sen vastaus on luettu; puhelimessa alalehti peittää sen.
  assert.equal(await loc('.rrow[data-id="a"] .ball.you').count(), w === '390' ? 1 : 0, 'Rinnakkain: origin unread only when covered');
  await shot('3-rinnakkain-lahto-valmis');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert.equal(await loc('[data-testid="pane"]').count(), 0, 'Rinnakkain: Esc closes the pane');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.conv), 'a', 'Rinnakkain: focus returns to the origin');
  assert.equal(await loc('.rrow[data-id="a"] .ball.you').count(), 0, 'Rinnakkain: closing shows the origin, so it is read');
  cases++;
}
await open(2);
await key('Alt+ArrowDown');
await loc('[data-act="promote"]').click();
await page.waitForTimeout(150);
assert.equal(await title(), 'Varmuuskopion ajastus', 'Rinnakkain: open fully');
assert.equal(await loc('[data-testid="pane"]').count(), 0);

// --- Nykyinen: tuotannon käytös vertailuksi ---
await open(3);
await key('Alt+ArrowDown');
assert.equal(await title(), 'Varmuuskopion ajastus');
assert.equal(await loc('.dock').count(), 0, 'Nykyinen: nothing tells where Alt+↑ goes');
await answer('Klo 4.30');
assert.equal(await loc('[data-testid="next-open"]').getAttribute('data-offer'), 'c');
await key('Alt+ArrowDown');
assert.equal(await title(), 'Tiedostopuun lajittelu');
assert.equal(await loc('[data-testid="next-open"]').count(), 0, 'Nykyinen: a read reply stalls the walk');
await shot('4-nykyinen-luettu-ei-jatkoa');
await key('Alt+ArrowUp');
assert.equal(await title(), 'Varmuuskopion ajastus', 'Nykyinen: Alt+↑ steps back one');

await browser.close();
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${cases} variant/size/theme cases, ${readdirSync(out).filter((f) => f.endsWith('.png')).length} screenshots`);
