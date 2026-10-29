// Builds the keys page round and checks it offline. Every direction (Kortit, Taulukko, Ohjattu)
// and every account (no keys, SSH only, both, an agent-made key not yet seen): the page offers
// "Luo" only where the default file is absent and the created key then appears; Kopioi turns into
// Kopioitu with its hint; the unseen key carries its note until "Tunnistan tämän"; the SSH
// fingerprint and the age recipient are on the page for the administrator; nothing claims to show
// a private key. Screenshots on a 1280 px desktop and a 390 px phone, dark and light, at device
// scale factor 2, then converted to AVIF with scripts/screenshots-to-avif.py. No console errors or
// network requests; the picker passes picker-check.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-account-keys-page/prototypes/avaimet/verify.mjs
// A worktree without web/node_modules can point OH_WEB_PACKAGE at another checkout's web/package.json.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { checkPicker } = await import(pathToFileURL(path.join(root, 'design-system/prototypes/picker-check.mjs')).href);
const require = createRequire(process.env.OH_WEB_PACKAGE ?? path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

const file = path.join(here, 'index.html');
const out = path.join(here, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs')], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['1-kortit', '2-taulukko', '3-ohjattu'];
const HEIGHTS = { 1280: 800, 390: 844 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
const url = (v, o) => pathToFileURL(file).href + '?' + new URLSearchParams({ v: v + 1, bare: '1', ...o });
const F = sel => page.locator('#frame ' + sel);
const count = sel => F(sel).count();
const visible = sel => F(sel).filter({ visible: true });
const text = () => F('[data-testid="settings-main"]').innerText();
const theme = t => (t === 'dark' ? 'tumma' : 'vaalea');
const width = w => (w === '390' ? 'puhelin' : w);
let shots = 0;
async function shot(v, what, o) {
  await page.screenshot({ path: path.join(out, `${NAMES[v]}-${what}-${width(o.w)}-${theme(o.t)}.png`) });
  shots++;
}
async function open(v, o = {}) {
  const w = o.w ?? '1280';
  await page.setViewportSize({ width: +w, height: HEIGHTS[w] });
  await page.goto(url(v, { k: 'on', t: 'dark', w, ...o }));
  await page.waitForFunction(() => document.querySelector('#frame .app'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250); // entrance animations settle
}

// The page never offers anything private: no "näytä yksityinen", no download, no PRIVATE KEY text.
for (let v = 0; v < 3; v++) for (const k of ['tyhja', 'osittain', 'on', 'uusi']) for (const w of ['1280', '390']) {
  await open(v, { k, w });
  const t = await text();
  assert.doesNotMatch(t, /PRIVATE KEY|AGE-SECRET-KEY|Lataa|Näytä yksityinen/i, `${NAMES[v]} ${k} ${w}: nothing private`);
  assert.equal(await count('[data-testid="settings-avaimet"]'), w === '390' ? 0 : 1, `${NAMES[v]}: Avaimet in the settings nav`);
  // Luo appears exactly for the kinds whose default file is absent.
  const createSsh = await visible('[data-testid="create-ssh"]').count(), createAge = await visible('[data-testid="create-age"]').count();
  assert.equal(createSsh > 0, k === 'tyhja', `${NAMES[v]} ${k} ${w}: Luo SSH-avain only when absent`);
  assert.equal(createAge > 0, k === 'tyhja' || k === 'osittain', `${NAMES[v]} ${k} ${w}: Luo age-avain only when absent`);
  // The unseen note is there exactly when the agent's key is.
  assert.equal(await visible('[data-testid="unseen-agent"]').count() > 0, k === 'uusi', `${NAMES[v]} ${k} ${w}: unseen note`);
}

// Creating: the button shows progress, the key appears, the button is gone and never returns.
for (let v = 0; v < 3; v++) {
  await open(v, { k: 'tyhja' });
  await visible('[data-testid="create-ssh"]').first().click();
  assert.equal(await visible('[data-testid="creating-ssh"]').count(), 1, `${NAMES[v]}: creating`);
  await page.waitForTimeout(900);
  assert.equal(await visible('[data-testid="create-ssh"]').count(), 0, `${NAMES[v]}: Luo gone after create`);
  assert.match(await text(), /SHA256:OKpabU3V/, `${NAMES[v]}: fresh fingerprint shown`);
  if (v === 1) await F('[data-testid="row-freshSsh"]').click(); // Taulukko: open the row to see the line
  await page.waitForTimeout(250);
  await shot(v, 'ssh-luotu', { w: '1280', t: 'dark' });
  await visible('[data-testid="create-age"]').first().click();
  await page.waitForTimeout(900);
  assert.match(await text(), /age1sqe8rtw8/, `${NAMES[v]}: fresh age recipient shown`);
}

// Copying: Kopioi → Kopioitu with the hint; Ohjattu copies the whole message.
for (let v = 0; v < 3; v++) for (const t of ['dark', 'light']) {
  await open(v, { k: 'on', t });
  const btn = v === 2 ? '[data-testid="copy-message"]' : '[data-testid="copy-main"]';
  await visible(btn).first().click();
  assert.match(await visible(btn).first().innerText(), /kopioitu/i, `${NAMES[v]}: copied state`);
  assert.equal(await visible('[data-testid="copied-hint"]').count(), 1, `${NAMES[v]}: copied hint`);
  if (v === 2) {
    const msg = await F('[data-testid="message"]').innerText();
    assert.match(msg, /ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA6RU15e/, 'message: ssh line');
    assert.match(msg, /SHA256:coG\/1EFZ/, 'message: fingerprint');
    assert.match(msg, /age1fktyq6uw/, 'message: age recipient');
  }
  await page.waitForTimeout(300);
  await shot(v, 'kopioitu', { w: '1280', t });
}

// Ohjattu: unticking Salaisuudet drops the age line from the message; with nothing ticked step 3 waits.
await open(2, { k: 'on' });
await F('input[data-kind="age"]').uncheck();
assert.doesNotMatch(await F('[data-testid="message"]').innerText(), /age1/, 'ohjattu: no age without the need');
await F('input[data-kind="ssh"]').uncheck();
assert.equal(await F('[data-testid="step-3"]').getAttribute('aria-disabled'), 'true', 'ohjattu: step 3 waits');
assert.equal(await count('[data-testid="message"]'), 0, 'ohjattu: no message without a need');
// The person can pick which SSH key goes to the admin; the default is id_ed25519.
await open(2, { k: 'uusi' });
assert.match(await F('[data-testid="message"]').innerText(), /SHA256:coG\/1EFZ/, 'ohjattu: default key in the message');
await F('select[data-act="pick"]').selectOption('agent');
assert.match(await F('[data-testid="message"]').innerText(), /SHA256:RVzWv3xY/, 'ohjattu: picked key in the message');

// The unseen key: its note goes once acknowledged.
for (let v = 0; v < 3; v++) {
  await open(v, { k: 'uusi' });
  await visible('[data-testid="unseen-agent"]').first().evaluate(el => el.scrollIntoView({ block: 'center' }));
  await shot(v, 'uusi-avain', { w: '1280', t: 'dark' });
  await visible('[data-testid="unseen-agent"] [data-act="seen"]').first().click();
  assert.equal(await visible('[data-testid="unseen-agent"]').count(), 0, `${NAMES[v]}: note gone after Tunnistan`);
  assert.equal(await visible('[data-testid="unseen-pill"]').count(), 0, `${NAMES[v]}: pill gone after Tunnistan`);
}

// Taulukko: a row opens to the full line and the admin check.
await open(1, { k: 'on' });
await F('[data-testid="row-main"]').click();
assert.match(await text(), /ssh-keygen -lf/, 'taulukko: admin check in the open row');
await page.waitForTimeout(400);
await shot(1, 'rivi-auki', { w: '1280', t: 'dark' });
await open(1, { k: 'on', w: '390', t: 'light' });
await visible('[data-testid="item-main"] .k-head').first().click();
assert.match(await text(), /ssh-keygen -lf/, 'taulukko phone: admin check in the open item');
await page.waitForTimeout(400);
await shot(1, 'rivi-auki', { w: '390', t: 'light' });

// The state screenshots.
for (let v = 0; v < 3; v++) {
  for (const k of ['tyhja', 'on']) for (const t of ['dark', 'light']) { await open(v, { k, t }); await shot(v, k === 'on' ? 'molemmat' : 'ei-avaimia', { w: '1280', t }); }
  await open(v, { k: 'osittain', t: 'light' }); await shot(v, 'vain-ssh', { w: '1280', t: 'light' });
  for (const [k, t] of [['tyhja', 'dark'], ['on', 'light'], ['on', 'dark'], ['uusi', 'light']]) {
    await open(v, { k, t, w: '390' }); await shot(v, { tyhja: 'ei-avaimia', on: 'molemmat', uusi: 'uusi-avain' }[k], { w: '390', t });
  }
}

// The picker, with its own chrome.
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => document.querySelector('#frame .app'));
await checkPicker(page, 'proto-account-keys-page');
for (let i = 1; i <= 3; i++) { await page.keyboard.press(String(i)); await page.waitForTimeout(80); assert.ok(await count('.app'), `picker key ${i}`); }

await browser.close();
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
const pngs = readdirSync(out).filter(f => f.endsWith('.png')).length;
assert.equal(pngs, shots, 'every screenshot written');
execFileSync('python3', [path.join(root, 'scripts/screenshots-to-avif.py'), out], { stdio: 'inherit' });
assert.equal(readdirSync(out).filter(f => f.endsWith('.png')).length, 0, 'every PNG converted');
console.log(`ok: ${shots} screenshots (AVIF) in ${path.relative(root, out)}`);
