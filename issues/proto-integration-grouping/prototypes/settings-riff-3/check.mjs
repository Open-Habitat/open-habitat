import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
// A worker may reuse the source checkout's installed browser tools, read-only.
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
let require = createRequire(path.join(root, 'web/package.json'));
try { require.resolve('@playwright/test'); } catch { require = createRequire(path.join(path.dirname(common), 'web/package.json')); }
const { chromium, expect } = require('@playwright/test');
const browser = await chromium.launch();
// Screens for Jari at device scale factor 2.
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await context.newPage();
const errors = [], requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
const target = 'file://' + path.join(here, 'index.html');
const evidence = path.join(here, 'evidence');
await fs.mkdir(evidence, { recursive: true });
const sizes = { desktop: [1440, 1000], phone: [390, 844] };
const VARIANTS = [1, 2, 3, 4];
const only = process.env.ONLY ? Number(process.env.ONLY) : 0;

async function open(v, size, theme, scenario = 'ok') {
  await page.setViewportSize({ width: sizes[size][0], height: sizes[size][1] });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(target + '?v=' + v);
  await expect(page.locator(`[data-variant="${v}"]`)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#scenario').selectOption(scenario);
  await nav('Tekoäly').click();
  await expect(page.locator('#section-title')).toHaveText('Tekoäly');
}
const nav = (label) => page.locator('.s-nav-i', { hasText: new RegExp('^' + label) }).first();
async function fit(what) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 0) throw new Error(`${what}: horizontal overflow ${over}px`);
}
// The open popover must stay inside the viewport horizontally.
async function popFits(what) {
  const box = await page.locator('#def-panel').boundingBox();
  const w = (await page.viewportSize()).width;
  if (box.x < 0 || box.x + box.width > w + 0.5) throw new Error(`${what}: popover outside viewport (${box.x}..${box.x + box.width})`);
}
// An open sheet or dialog is fixed to the viewport: photograph the viewport.
async function shot(name) { await page.mouse.move(0, 0); const overlay = await page.locator('.dlg-layer, .pop').count() && (await page.viewportSize()).width < 500; await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: !overlay, animations: 'disabled', style: '.proto-picker{display:none}' }); }
// The top of the page, where the row lives: enough for a side-by-side look.
async function shotTop(name) { await page.mouse.move(0, 0); await page.screenshot({ path: path.join(evidence, name + '.png'), clip: { x: 0, y: 0, width: (await page.viewportSize()).width, height: 640 }, animations: 'disabled', style: '.proto-picker{display:none}' }); }
const row = (p) => page.locator('#row-' + p);

async function openDefault() {
  await page.locator('#def-trigger').click();
  await expect(page.locator('#def-panel')).toBeVisible();
  await expect(page.locator('#def-trigger')).toHaveAttribute('aria-expanded', 'true');
}
async function chooseOther() {
  await page.locator('#def-panel [data-act="tab"][data-p="openai-codex"]').click();
  await page.locator('#def-panel .md-row', { hasText: 'GPT 5.5 Codex' }).click();
  await expect(page.locator('#save-state')).toContainText('Valinta vahvistettu');
}

const checked = [];
try {
  for (const v of VARIANTS) {
    if (only && v !== only) continue;
    // Every scenario at both widths: the page and the opened chooser fit.
    for (const size of ['desktop', 'phone']) {
      for (const scenario of ['ok', 'err', 'site']) {
        await open(v, size, 'light', scenario);
        await fit(`${v} ${size} ${scenario} page`);
        if (scenario === 'err') await expect(row('default')).toContainText('ei nyt vastaa');
        else await expect(row('default')).not.toContainText('ei nyt vastaa');
        // Every form names the model and the route it goes through.
        await expect(row('default')).toContainText('Sonnet 5');
        const route = { ok: 'Claude-tilaus', err: 'Anthropic API', site: 'ylläpitäjän avain' }[scenario];
        await expect(row('default')).toContainText(route);
        await openDefault();
        await fit(`${v} ${size} ${scenario} chooser`);
        await popFits(`${v} ${size} ${scenario}`);
        checked.push(`${v}/${size}/${scenario}`);
      }
    }
    // Choosing elsewhere confirms and shows on the row; Escape returns focus.
    await open(v, 'desktop', 'light', 'ok');
    await openDefault();
    await expect(page.locator('#def-panel input:checked')).toBeFocused();
    await chooseOther();
    await page.keyboard.press('Escape');
    await expect(page.locator('#def-panel')).toHaveCount(0);
    await expect(page.locator('#def-trigger')).toBeFocused();
    await expect(row('default')).toContainText('GPT 5.5 Codex');
    await expect(row('default')).toContainText('ChatGPT-tilaus');
    // An outside click closes too.
    await openDefault();
    await page.locator('#section-title').click();
    await expect(page.locator('#def-panel')).toHaveCount(0);
    // Error scenario: the row leads to a working choice.
    await open(v, 'desktop', 'light', 'err');
    await openDefault();
    await expect(page.locator('#def-panel [role="alert"]')).toContainText('hylkää');
    await chooseOther();
    await page.keyboard.press('Escape');
    await expect(row('default')).not.toContainText('ei nyt vastaa');
    // A first key changes the default, and the row says so at once.
    await open(v, 'desktop', 'light', 'ok');
    await page.locator('#add-key').click();
    await page.locator('.prov-opt[data-p="anthropic"]').click();
    await page.locator('[data-act="sample"]').click();
    await page.locator('#kf-save').click();
    await expect(row('default')).toContainText('Opus 5.5');
    await expect(row('default')).toContainText('Anthropic API');

    // Screens for Jari.
    await open(v, 'desktop', 'light', 'ok'); await shot(`${v}-desktop-light-ok`); await shotTop(`${v}-desktop-light-ok-top`);
    await openDefault(); await shotTop(`${v}-desktop-light-open`);
    await open(v, 'desktop', 'dark', 'err'); await shotTop(`${v}-desktop-dark-err`);
    await open(v, 'desktop', 'light', 'site'); await shotTop(`${v}-desktop-light-site`);
    await open(v, 'phone', 'light', 'ok'); await shot(`${v}-phone-light-ok`);
    await openDefault(); await shot(`${v}-phone-light-open`);
    await open(v, 'phone', 'dark', 'err'); await shot(`${v}-phone-dark-err`);
  }
  if (!only) {
    // Picker keys keep the page; an unknown ?v falls back to the first.
    await open(1, 'desktop', 'light', 'ok');
    await page.keyboard.press('4'); await expect(page.locator('[data-variant="4"]')).toBeVisible();
    await page.keyboard.press('ArrowRight'); await expect(page.locator('[data-variant="1"]')).toBeVisible();
    await page.goto(target + '?v=99'); await expect(page.locator('[data-variant="1"]')).toBeVisible();
  }
  if (errors.length) throw new Error('console: ' + errors.join('\n'));
  if (requests.length) throw new Error('network: ' + requests.join('\n'));
  if (!only) await fs.writeFile(path.join(evidence, 'checks.json'), JSON.stringify({ rendered_and_fit: checked, errors, requests }, null, 1) + '\n');
  console.log(`PASS: ${checked.length} renders (variant × 390/1440 × scenario) fit with the chooser open; choose, Escape and outside click, error recovery, first key changes the row; no console errors or network requests.`);
} finally { await browser.close(); }
