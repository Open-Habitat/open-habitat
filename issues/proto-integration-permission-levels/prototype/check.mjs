// Checks the offline prototype and writes Jari's screenshots (device scale 2)
// into ../screenshots as AVIF. Usage: TMPDIR=<scratch> node check.mjs
// (ONLY=1|2|3 limits directions)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
// A worker may reuse the source checkout's installed browser tools, read-only.
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
let require = createRequire(path.join(root, 'web/package.json'));
try { require.resolve('@playwright/test'); } catch { require = createRequire(path.join(path.dirname(common), 'web/package.json')); }
const { chromium, expect } = require('@playwright/test');
const { checkPicker } = await import(path.join(root, 'design-system/prototypes/picker-check.mjs'));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [], requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
const target = 'file://' + path.join(here, 'index.html');
const shots = path.join(here, '..', 'screenshots');
await fs.mkdir(shots, { recursive: true });
const scratch = await fs.mkdtemp(path.join(process.env.TMPDIR || '/var/tmp', 'perm-shots-'));
const sizes = { 1440: [1440, 1000], 390: [390, 844] };
const NAMES = ['a', 'b', 'c'];
const only = process.env.ONLY ? Number(process.env.ONLY) : 0;

async function open(v, size, theme, scenario = 'ok') {
  await page.setViewportSize({ width: sizes[size][0], height: sizes[size][1] });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(target + '?v=' + v);
  await expect(page.locator(`[data-variant="${v}"]`)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#scenario').selectOption(scenario);
  await expect(page.locator('#section-title')).toHaveText('Tiedot agenteille');
}
async function fit(what) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 0) throw new Error(`${what}: horizontal overflow ${over}px`);
  const dlg = page.locator('.dlg');
  if (await dlg.count()) {
    const inner = await dlg.evaluate((el) => el.scrollWidth - el.clientWidth);
    if (inner > 0) throw new Error(`${what}: dialog overflows ${inner}px`);
  }
}
// These steps look the same in every direction: photograph them once, in a.
const once = /^[bc]-(kirjautuminen-microsoft|yhdistetty-microsoft|rajattu-yhdistetty)-/;
async function shot(name) {
  await page.mouse.move(0, 0);
  await fit(name);
  if (once.test(name)) return;
  const dialog = await page.locator('.dlg').count();
  const png = path.join(scratch, name + '.png');
  await page.screenshot({ path: png, fullPage: !dialog, animations: 'disabled', style: '.proto-picker{display:none}' });
  // AVIF keeps the committed screens small; ImageMagick does the encoding.
  execFileSync('convert', [png, '-quality', '60', path.join(shots, name + '.avif')]);
}
const dlg = () => page.locator('.dlg');
const connect = (p) => page.locator(`[data-act="connect"][data-p="${p}"]`).first();
const change = (id) => page.locator(`[data-act="change"][data-id="${id}"]`);

for (const v of [1, 2, 3]) {
  if (only && v !== only) continue;
  const n = NAMES[v - 1];
  // The page with connected accounts, three ways.
  for (const [size, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light']]) {
    await open(v, size, theme);
    await checkPicker(page, 'proto-integration-permission-levels');
    await expect(page.locator('[data-testid="limits"]')).toBeVisible();
    await expect(page.locator('.ig-card')).toHaveCount(4);
    await shot(`${n}-sivu-${size}-${theme}`);
  }
  // Connect Microsoft and Google from scratch.
  await open(v, 1440, 'light', 'none');
  await connect('microsoft').click();
  await expect(dlg()).toBeVisible();
  if (v === 1) {
    await page.locator('.lvl-opt[data-level="drafts"]').click();
    await expect(page.locator('.lvl-opt[data-level="drafts"] input')).toBeChecked();
  } else if (v === 2) {
    await page.locator('[data-act="svc"][data-svc="mail"][data-cap="drafts"]').click();
    await expect(page.locator('.svc-row[data-svc="calendar"] .locked')).toContainText('Vain luku');
  }
  await shot(`${n}-yhdista-microsoft-1440-light`);
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('[data-testid="provider-page"]')).toBeVisible();
  await shot(`${n}-kirjautuminen-microsoft-1440-light`);
  await page.locator('[data-act="accept"]').click();
  await expect(page.locator('[data-testid="connected"]')).toBeVisible();
  await shot(`${n}-yhdistetty-microsoft-1440-light`);
  await page.locator('[data-act="done"]').click();
  await expect(page.locator('.ig-card.flash')).toHaveCount(1);
  if (v < 3) await expect(page.locator('.ig-card.flash .ig-svc[data-svc="mail"]')).toHaveAttribute('data-cap', 'drafts');

  await connect('google').click();
  if (v === 1) {
    await expect(page.locator('.lvl-opt[data-level="drafts"] input')).toBeDisabled();
    await page.locator('.lvl-opt[data-level="read"]').click();
  } else if (v === 2) {
    await expect(page.locator('[data-act="svc"][data-svc="mail"][data-cap="drafts"]')).toBeDisabled();
    await page.locator('[data-act="svc"][data-svc="mail"][data-cap="read"]').click();
  }
  await shot(`${n}-yhdista-google-1440-light`);
  await page.locator('[data-act="continue"]').click();
  if (v === 3) await page.locator('[data-act="consent"][data-svc="mail"]').uncheck();
  await shot(`${n}-kirjautuminen-google-1440-light`);
  await page.locator('[data-act="accept"]').click();
  await page.locator('[data-act="done"]').click();
  const gmail = page.locator('.ig-card.flash .ig-svc[data-svc="mail"]');
  await expect(gmail).toHaveAttribute('data-cap', v === 3 ? 'none' : 'read');
  if (v === 3) await expect(page.locator('.ig-card.flash [data-testid="narrowed"]')).toBeVisible();
  await shot(`${n}-uudet-tilit-1440-light`);

  // Phone sheet, dark: Dropbox (v1, v2) or Microsoft (v3).
  await open(v, 390, 'dark', 'none');
  await connect(v === 3 ? 'microsoft' : 'dropbox').click();
  await expect(dlg()).toBeVisible();
  await shot(`${n}-yhdista-${v === 3 ? 'microsoft' : 'dropbox'}-390-dark`);

  // Changing the level later: Google read → full in the connected scenario.
  await open(v, 1440, 'light');
  await change('google:aino@laaksonen.example').click();
  if (v === 1) await page.locator('.lvl-opt[data-level="full"]').click();
  else if (v === 2) await page.locator('[data-act="svc"][data-svc="drive"][data-cap="full"]').click();
  await shot(`${n}-vaihda-google-1440-light`);
  await page.locator('[data-act="continue"]').click();
  // Direction 3: Gmail was left out; tick it back on Google's page.
  if (v === 3) { await page.locator('[data-act="consent"][data-svc="mail"]').check(); await shot(`${n}-vaihda-google-kirjautuminen-1440-light`); }
  await page.locator('[data-act="accept"]').click();
  await expect(page.locator('[data-testid="connected"]')).toBeVisible();
  await page.locator('[data-act="done"]').click();
  if (v === 2) await expect(page.locator('.ig-card.flash .ig-svc[data-svc="drive"]')).toHaveAttribute('data-cap', 'full');
  if (v === 3) await expect(page.locator('.ig-card.flash .ig-svc[data-svc="mail"]')).toHaveAttribute('data-cap', 'full');
  // Microsoft drafts → read: the mirror fact appears in v1 and v2.
  if (v < 3) {
    await change('microsoft:aino.laaksonen@konepaja.example').click();
    if (v === 1) await page.locator('.lvl-opt[data-level="full"]').click();
    else await page.locator('[data-act="svc"][data-svc="mail"][data-cap="full"]').click();
    await expect(page.locator('.change')).toContainText('synkronoituu taas');
    await shot(`${n}-vaihda-microsoft-1440-light`);
    await page.keyboard.press('Escape');
    await expect(dlg()).toHaveCount(0);
  }

  // Narrowed by the organisation and limited by the server.
  for (const [size, theme] of [[1440, 'light'], [390, 'dark']]) {
    await open(v, size, theme, 'org');
    await expect(page.locator('[data-testid="narrowed"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="smtp-open"]')).toHaveCount(1);
    await shot(`${n}-rajattu-${size}-${theme}`);
  }
  await open(v, 1440, 'light', 'org');
  await connect('microsoft').click();
  if (v === 1) await expect(page.locator('.lvl-opt[data-level="read"] input')).toBeDisabled();
  await shot(`${n}-rajattu-yhdista-microsoft-1440-light`);
  await page.locator('[data-act="continue"]').click();
  await page.locator('[data-act="accept"]').click();
  await expect(page.locator('.result.narrow')).toBeVisible();
  await shot(`${n}-rajattu-yhdistetty-1440-light`);
  await page.locator('.dlg-h [data-act="close"]').click();

  // The other providers' dialogs open and close cleanly.
  await open(v, 1440, 'light', 'none');
  for (const p of ['dropbox', 'imap', 'caldav']) {
    await connect(p).click();
    await expect(dlg()).toBeVisible();
    await fit(`${n} ${p}`);
    if (v === 1 && p === 'imap') await shot(`${n}-yhdista-imap-1440-light`);
    if (v === 1 && p === 'dropbox') await shot(`${n}-yhdista-dropbox-1440-light`);
    await page.keyboard.press('Escape');
  }
  // Remove.
  await open(v, 1440, 'light');
  await page.locator('[data-act="remove"]').first().click();
  await page.locator('[data-act="really-remove"]').click();
  await expect(page.locator('.ig-card')).toHaveCount(3);
}
// Picker keys keep working and land on the right direction.
await open(1, 1440, 'light');
await page.keyboard.press('3');
await expect(page.locator('[data-variant="3"]')).toBeVisible();
await page.keyboard.press('ArrowLeft');
await expect(page.locator('[data-variant="2"]')).toBeVisible();

await browser.close();
if (requests.length) throw new Error('network requests: ' + requests.join(', '));
if (errors.length) throw new Error('console errors:\n' + errors.join('\n'));
console.log('ok', (await fs.readdir(shots)).length, 'screenshots');
