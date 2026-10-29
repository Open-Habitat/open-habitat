// Builds index.html and checks it offline: each direction walks the setup from "not set up" to
// connected (Tailscale login, machine, key line refused then accepted, host key confirmed), an
// expired grant renews without a new host-key step, removal tells the person to remove the line
// on the machine, every state renders in Settings, Käyttöönotto and the conversation, the two
// plain statements (everything the user has; the server's root) are on the page before the grant
// is saved, and nothing offers a pause. Screenshots at device scale factor 2 into evidence/ as
// PNG; convert them with scripts/screenshots-to-avif.py. No console errors or network requests;
// the picker passes picker-check.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-own-machine-access/prototypes/oma-kone/verify.mjs
// A worktree without web/node_modules points OH_WEB_PACKAGE at another checkout's web/package.json.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { checkPicker } = await import(pathToFileURL(path.join(root, 'design-system/prototypes/picker-check.mjs')).href);
const pkg = process.env.OH_WEB_PACKAGE ?? path.join(root, 'web/package.json');
const require = createRequire(existsSync(path.join(path.dirname(pkg), 'node_modules')) ? pkg : path.join(process.env.HOME, 'src/open-habitat/web/package.json'));
const { chromium } = require('@playwright/test');

const file = path.join(here, 'index.html');
const out = path.join(here, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs')], { stdio: 'inherit' });
mkdirSync(out, { recursive: true });

const NAMES = ['1-ohjattu', '2-tilasivu', '3-agentin-kanssa'];
const STATES = ['noprofile', 'none', 'login', 'key', 'ok', 'asleep', 'expired', 'revoked'];
const HEIGHTS = { 1280: 800, 390: 844 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
const F = sel => page.locator('#frame ' + sel);
const count = sel => F(sel).count();
const click = async sel => { await F(sel).first().click(); await page.waitForTimeout(60); };
const text = sel => F(sel).first().innerText();
const theme = t => (t === 'dark' ? 'tumma' : 'vaalea');
let shots = 0;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); shots++; };

async function open(v, o = {}) {
  const w = o.w ?? '1280';
  await page.setViewportSize({ width: +w, height: HEIGHTS[w] });
  await page.goto(pathToFileURL(file).href + '?' + new URLSearchParams({ v: v + 1, bare: '1', n: 'asetukset', st: 'none', os: 'mac', t: 'dark', w, ...o }));
  await page.waitForFunction(() => document.querySelector('#frame .app'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}
const frameText = () => page.locator('#frame').innerText();

// Every state renders in every view, and nothing anywhere offers a pause.
for (let v = 0; v < 3; v++) for (const st of STATES) for (const n of ['asetukset', 'kayttoonotto', 'keskustelu']) {
  await open(v, { st, n });
  assert.doesNotMatch(await frameText(), /\bTauko\b|Tauolla|tauolle/i, `${NAMES[v]} ${st} ${n}: no pause`);
  assert.equal(await count('[data-testid="keys"]'), 0, `${NAMES[v]} ${st}: no account keys card (own round)`);
}

// 1 Ohjattu: the whole setup in the dialog.
await open(0);
await click('[data-testid="add-machine"]');
assert.equal(await count('[data-testid="wz-step-1"]'), 1, 'wizard opens at Tailscale');
assert.ok(await F('[data-testid="wz-next"]').isDisabled(), 'next waits for Tailscale');
await click('[data-testid="ts-start"]');
assert.equal(await count('[data-testid="ts-login"] .qr'), 1, 'desktop shows a QR');
await shot('1-ohjattu-tailscale-kirjautuminen-1280-tumma');
await click('[data-testid="ts-open"]');
await page.waitForTimeout(1400);
assert.equal(await count('[data-testid="wizard"] [data-testid="ts-facts"]'), 1, 'Tailscale connected');
await click('[data-testid="wz-next"]');
assert.ok(await F('[data-testid="wz-next"]').isDisabled(), 'next waits for a machine');
assert.equal(await F('[data-testid="peer-jarin-iphone"]').getAttribute('aria-disabled'), 'true', 'iPhone is not a choice');
await click('[data-testid="peer-jarin-macbook-air"]');
await click('.seg [data-act="exp"][data-v="7"]');
assert.match(await text('[data-testid="until"]'), /5\.11\.2026/, '7 days ends 5.11.');
await click('.seg [data-act="exp"][data-v="30"]');
await shot('1-ohjattu-kone-1280-tumma');
await click('[data-testid="wz-next"]');
assert.match(await text('[data-testid="wz-step-3"]'), /Vain nämä käyttäjät/);
await shot('1-ohjattu-etakirjautuminen-1280-tumma');
await click('[data-testid="wz-next"]');
assert.match(await text('[data-testid="install-cmd"]'), /expiry-time="20261128"/, 'line expires in 30 days');
assert.match(await text('[data-testid="install-cmd"]'), /from="100\.101\.22\.7"/, 'line bound to the node');
await click('[data-testid="check"]'); await page.waitForTimeout(900);
assert.equal(await count('[data-testid="denied"]'), 1, 'refused before the line is installed');
await click('[data-act="copy"][data-copy="cmd"]');
await click('[data-testid="check"]'); await page.waitForTimeout(900);
assert.equal(await count('[data-testid="accepted"]'), 1, 'accepted after');
await click('[data-testid="wz-next"]');
assert.equal(await count('[data-testid="hostkey"]'), 1, 'host key step');
assert.match(await text('[data-testid="wz-step-5"]'), /kaiken, mitä käyttäjäsi jari saa/, 'statement 1 before saving');
assert.match(await text('[data-testid="wz-step-5"]'), /ylläpitäjä \(root\)/, 'statement 2 before saving');
await shot('1-ohjattu-vahvistus-1280-tumma');
await click('[data-testid="hk-ok"]');
assert.equal(await count('[data-testid="wz-done"]'), 1, 'done');
await click('[data-testid="wz-finish"]');
assert.equal(await count('[data-testid="machine"] [data-testid="pill-active"]'), 1, 'machine connected');
// An expired grant renews at the line step; the host key is already pinned.
await open(0, { st: 'expired' });
await click('[data-testid="renew"]');
assert.equal(await count('[data-testid="wz-step-4"]'), 1, 'renew opens at the line');
await click('[data-act="copy"][data-copy="cmd"]');
await click('[data-testid="check"]'); await page.waitForTimeout(900);
assert.equal(await count('[data-testid="wz-done"]'), 1, 'renew needs no host-key step');
await click('[data-testid="wz-finish"]');
assert.equal(await count('[data-testid="pill-active"]'), 1, 'renewed');
// Mismatch stops.
await open(0, { st: 'key', n: 'kayttoonotto' });
await click('[data-act="copy"][data-copy="cmd"]');
await click('[data-testid="check"]'); await page.waitForTimeout(900);
await click('[data-testid="wz-next"]');
await click('[data-testid="hk-bad"]');
assert.equal(await count('[data-testid="mismatch"]'), 1, 'mismatch stops');
await shot('1-ohjattu-tunniste-ei-tasmaa-1280-tumma');

// 2 Tilasivu: the checklist does the setup and later the diagnosis.
await open(1);
assert.ok(await F('[data-testid="add-machine"]').isDisabled(), 'add waits for Tailscale');
assert.match(await frameText(), /kaiken, mitä käyttäjäsi jari saa/, 'statements always on the page');
await click('[data-testid="ts-start"]'); await click('[data-testid="ts-open"]'); await page.waitForTimeout(1400);
await click('[data-testid="add-machine"]');
assert.equal(await count('[data-testid="setup-card"] [data-ck="kone"][data-open]'), 1, 'first open row is the machine');
await click('[data-testid="peer-tyoasema"]');
assert.equal(await page.locator('.pc-group[data-k="os"] button[aria-pressed="true"]').innerText(), 'Linux', 'choosing a Linux peer switches the OS');
assert.equal(await count('[data-ck="remote"][data-open]'), 1, 'next open row is the SSH server');
await click('[data-ck="line"] .ck-sum');
assert.match(await text('[data-testid="install-cmd"]'), /sed -i '/, 'GNU sed on Linux');
await click('[data-act="copy"][data-copy="cmd"]');
await click('[data-testid="check"]'); await page.waitForTimeout(900);
assert.equal(await count('[data-ck="hostkey"][data-open] [data-testid="hostkey"]'), 1, 'host key row opens');
await click('[data-testid="hk-ok"]');
assert.equal(await count('[data-testid="machine"] [data-testid="pill-active"]'), 1, 'connected');
assert.match(await text('[data-testid="checklist"] .ck-bar'), /4\/4/, 'all four in order');
await click('[data-testid="remove"]');
assert.equal(await count('[data-testid="remove-confirm"]'), 1, 'removal asks and names the machine-side step');
await page.evaluate(() => document.querySelector('#frame [data-testid="remove-confirm"]').scrollIntoView({ block: 'center' }));
await shot('2-tilasivu-poisto-1280-tumma');
await click('[data-testid="remove-yes"]');
assert.equal(await count('[data-testid="removed-note"]'), 1, 'after removal: remove the line too');
await open(1, { st: 'revoked' });
assert.equal(await count('[data-ck="line"][data-open] [data-testid="revoked-note"]'), 1, 'revoked opens the line row');
await page.evaluate(() => document.querySelector('#frame [data-ck="line"]').scrollIntoView({ block: 'start' }));
await shot('2-tilasivu-peruttu-rivi-1280-tumma');

// 3 Agentin kanssa: the conversation explains, the card holds facts and buttons.
await open(2);
await click('[data-testid="add-machine"]');
assert.equal(await count('[data-testid="setup-conversation"] [data-testid="status-card"]'), 1, 'setup conversation with card');
assert.match(await frameText(), /kaiken, mitä käyttäjäsi jari saa|Saan koneella kaiken, mitä käyttäjäsi jari saa/, 'statement 1');
await click('[data-act="ask"][data-v="admin"]');
assert.match(await frameText(), /Kyllä, teknisesti/, 'root answered plainly');
await click('[data-testid="ts-start"]'); await click('[data-testid="ts-open"]'); await page.waitForTimeout(1400);
await shot('3-agentin-kanssa-kone-1280-tumma');
await click('[data-testid="peer-jarin-macbook-air"]');
assert.equal(await count('[data-testid="status-card"] [data-testid="install-cmd"]'), 1, 'the line is in the card');
assert.doesNotMatch(await F('.col').innerText(), /ssh-ed25519 AAAA/, 'the line is never in an agent message');
await click('[data-testid="check"]'); await page.waitForTimeout(900);
assert.match(await F('.col').innerText(), /Permission denied/, 'the agent reports the refusal');
await click('[data-act="copy"][data-copy="cmd"]');
await click('[data-testid="check"]'); await page.waitForTimeout(900);
await shot('3-agentin-kanssa-vahvistus-1280-tumma');
await click('[data-testid="hk-ok"]');
assert.match(await F('.col').innerText(), /Valmis\. Yhteys toimii/, 'done');
await shot('3-agentin-kanssa-valmis-1280-tumma');
await open(2, { st: 'expired', n: 'kayttoonotto' });
await click('[data-act="copy"][data-copy="cmd"]');
await click('[data-testid="check"]'); await page.waitForTimeout(900);
assert.equal(await count('[data-testid="status-card"] [data-testid="pill-active"]'), 1, 'renewed in the conversation');

// The conversation where the agent uses the machine.
await open(0, { st: 'ok', n: 'keskustelu' });
assert.equal(await count('[data-testid="live"]'), 1, 'live connection indicator');
assert.equal(await count('.tool .mchip'), 2, 'machine chip on each ssh row');
for (const [st, re] of [['asleep', /unessa/], ['expired', /päättyi 28\.10\.2026/], ['revoked', /ei enää hyväksy/], ['none', /En pääse koneellesi/], ['noprofile', /ei vielä tarjoa Tailscalea/]]) {
  await open(0, { st, n: 'keskustelu' });
  assert.match(await F('.col').innerText(), re, `conversation ${st}`);
  assert.equal(await count('[data-testid="live"]'), 0, `${st}: no live indicator`);
}

// Screenshots: every direction, both themes, desktop and phone: Settings connected, Käyttöönotto at the key line.
for (let v = 0; v < 3; v++) for (const t of ['dark', 'light']) for (const w of ['1280', '390']) {
  const wn = w === '390' ? 'puhelin' : '1280';
  await open(v, { st: 'ok', t, w });
  await shot(`${NAMES[v]}-asetukset-yhdistetty-${wn}-${theme(t)}`);
  await open(v, { st: 'key', n: 'kayttoonotto', t, w });
  await shot(`${NAMES[v]}-kayttoonotto-avainrivi-${wn}-${theme(t)}`);
}
// The remaining states in Settings (desktop dark) and on the phone (light), per direction.
for (let v = 0; v < 3; v++) for (const st of ['noprofile', 'none', 'login', 'asleep', 'expired', 'revoked']) {
  await open(v, { st, n: st === 'login' ? 'kayttoonotto' : 'asetukset' });
  await shot(`${NAMES[v]}-${st === 'login' ? 'kayttoonotto' : 'asetukset'}-${st}-1280-tumma`);
}
for (let v = 0; v < 3; v++) for (const st of ['login', 'expired']) {
  await open(v, { st, n: 'kayttoonotto', w: '390', t: 'light' });
  await shot(`${NAMES[v]}-kayttoonotto-${st}-puhelin-vaalea`);
}
// Linux target.
await open(0, { st: 'key', n: 'kayttoonotto', os: 'linux', t: 'light' });
await click('[data-act="wz-back"]');
await shot('1-ohjattu-etakirjautuminen-linux-1280-vaalea');
await open(1, { st: 'key', n: 'kayttoonotto', os: 'linux' });
await shot('2-tilasivu-kayttoonotto-linux-1280-tumma');
// The usage conversation (same in every direction).
for (const st of ['ok', 'asleep', 'expired', 'revoked', 'none']) {
  await open(0, { st, n: 'keskustelu' });
  await shot(`keskustelu-${st}-1280-tumma`);
}
await open(0, { st: 'ok', n: 'keskustelu', w: '390', t: 'light' });
await shot('keskustelu-ok-puhelin-vaalea');
await open(1, { st: 'ok', n: 'keskustelu', os: 'linux', t: 'light' });
await shot('keskustelu-ok-linux-1280-vaalea');

// Picker and console.
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => document.querySelector('#frame .app'));
await checkPicker(page, 'proto-own-machine-access');
for (const key of ['2', '3', '1']) { await page.keyboard.press(key); await page.waitForTimeout(80); }
assert.equal(await page.locator('.proto-picker-item[data-active]').innerText(), '1 Ohjattu');

await browser.close();
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${shots} screenshots in ${path.relative(root, out)} (PNG; run scripts/screenshots-to-avif.py next)`);
