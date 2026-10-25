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
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const errors = [], requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
const target = 'file://' + path.join(here, 'index.html');
const evidence = path.join(here, 'evidence');
await fs.mkdir(evidence, { recursive: true });
const sizes = { desktop: [1440, 1000], phone: [390, 844] };
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
// An open sheet or dialog is fixed to the viewport: photograph the viewport.
async function shot(name) { const overlay = await page.locator('.dlg-layer, .pop').count() && (await page.viewportSize()).width < 500; await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: !overlay, animations: 'disabled', style: '.proto-picker{display:none}' }); }
const row = (p) => page.locator('#row-' + p);

// Open the default-model chooser the way the variant does.
async function openDefault(v) {
  if (v === 3) { await page.locator('.hero').click(); await expect(page.locator('#section-title')).toHaveText('Mallit'); return; }
  await page.locator('#def-trigger').click();
  await expect(page.locator('#def-panel')).toBeVisible();
}
async function chooseOther(v) {
  if (v === 3) {
    await page.locator('.rp[data-p="openai-codex"][data-id="gpt-5.5-codex"]').click();
    await expect(page.locator('.rp[data-p="openai-codex"][data-id="gpt-5.5-codex"]')).toHaveAttribute('aria-pressed', 'true');
  } else {
    await page.locator('#def-panel [data-act="tab"][data-p="openai-codex"]').click();
    await page.locator('#def-panel .md-row', { hasText: 'GPT 5.5 Codex' }).click();
  }
  await expect(page.locator('#save-state')).toContainText('Valinta vahvistettu');
}
// Add, reject and remove a key through the variant's own path.
async function startAdd(v, p) {
  if (v === 1) {
    const c = { openai: 'openai', anthropic: 'anthropic', deepseek: 'deepseek' }[p];
    await row('co-' + c).locator('[data-act="toggle"]').click();
    await row(p).locator('[data-act="add"]').click();
  } else if (v === 2) {
    await page.locator('#add-key').click();
    await page.locator(`.prov-opt[data-p="${p}"]`).click();
  } else await row(p).locator('[data-act="add"]').click();
  await expect(page.locator('#kf-input')).toBeFocused();
}

const checked = [];
try {
  for (const v of [1, 2, 3]) {
    if (only && v !== only) continue;
    // Every scenario at both widths: the page, the opened chooser and the add form fit.
    for (const size of ['desktop', 'phone']) {
      for (const scenario of ['ok', 'err', 'site']) {
        await open(v, size, 'light', scenario);
        await fit(`${v} ${size} ${scenario} page`);
        if (scenario === 'err') await expect(page.locator('.s-nav-i .alert')).toHaveCount(1);
        if (scenario === 'ok') await expect(page.locator('.s-nav-i .alert')).toHaveCount(0);
        if (scenario === 'err') await expect(page.locator('#row-default')).toContainText('ei nyt vastaa');
        if (scenario === 'site') await expect(page.locator('#section-title').locator('..')).toContainText(/ylläpitäjän antama/i);
        await openDefault(v);
        await fit(`${v} ${size} ${scenario} chooser`);
        checked.push(`${v}/${size}/${scenario}`);
      }
    }
    // Default model: choosing elsewhere confirms and shows on the page.
    await open(v, 'desktop', 'light', 'ok');
    await openDefault(v);
    await chooseOther(v);
    if (v === 2) { await page.keyboard.press('Escape'); await expect(page.locator('#def-panel')).toHaveCount(0); await expect(page.locator('#def-trigger')).toBeFocused(); }
    if (v === 3) await page.locator('.s-crumb [data-act="back"]').click();
    if (v === 1) await page.locator('#def-trigger').click();
    await expect(page.locator('#row-default')).toContainText('GPT 5.5 Codex');
    // Error scenario: the default row leads to a working choice.
    await open(v, 'desktop', 'light', 'err');
    if (v === 3) await expect(page.locator('.hero')).toContainText('Anthropic API');
    await openDefault(v);
    if (v !== 3) await expect(page.locator('#def-panel [role="alert"]')).toContainText('hylkää');
    else await expect(page.locator('.rp.refused').first()).toBeDisabled();
    await chooseOther(v);
    if (v === 3) await page.locator('.s-crumb [data-act="back"]').click();
    if (v === 2) await page.keyboard.press('Escape');
    await expect(page.locator('#row-default')).not.toContainText('ei nyt vastaa');

    // Keys: wrong prefix is caught, a rejected key is not stored, a good one is.
    await open(v, 'desktop', 'light', 'ok');
    await startAdd(v, 'anthropic');
    await page.locator('#kf-input').fill('sk-EI-OIKEA-vaara-etuliite-0003');
    await expect(page.locator('#kf-hint')).toContainText('ei näytä Anthropic-avaimelta');
    await expect(page.locator('#kf-save')).toBeDisabled();
    await page.locator('[data-act="sample-bad"]').click();
    await page.locator('#kf-save').click();
    await expect(page.locator('.kf-err')).toContainText('hylkäsi avaimen');
    await page.locator('[data-act="sample"]').click();
    await page.locator('#kf-save').click();
    await expect(row('anthropic')).toContainText('sk-ant-…0001');
    await expect(page.locator('#status')).toContainText('Oletusmalliksi vaihtui Opus 5.5');
    await expect(page.locator('#row-default')).toContainText('Opus 5.5');
    if (v === 1) await shot(`${v}-desktop-light-key-added`);
    // Remove asks first and names what stops working.
    await row('anthropic').locator('[data-act="ask-remove"]').click();
    await expect(page.locator('[role="dialog"]')).toContainText('Oletusmalli Opus 5.5');
    await page.locator('[data-act="remove"]').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    if (v === 2) await expect(row('anthropic')).toHaveCount(0);
    else await expect(row('anthropic')).toHaveAttribute('data-state', 'none');
    await expect(page.locator('#row-default')).toContainText('ei nyt vastaa');
    // The site's key: replaced by one's own.
    await open(v, 'desktop', 'light', 'site');
    if (v === 1) await row('co-anthropic').locator('[data-act="toggle"]').click();
    await row('anthropic').locator('[data-act="add"], [data-act="dlg-add"]').first().click();
    await expect(page.locator('.kf')).toContainText('korvaa ylläpitäjän antaman kopion');
    await page.locator('[data-act="sample"]').click();
    await page.locator('#kf-save').click();
    await expect(row('anthropic')).not.toContainText('Ylläpitäjän antama');

    // Screens for Jari.
    await open(v, 'desktop', 'light', 'ok'); await shot(`${v}-desktop-light-ok`);
    await openDefault(v); await shot(`${v}-desktop-light-default-open`);
    await open(v, 'desktop', 'dark', 'err'); await shot(`${v}-desktop-dark-err`);
    if (v === 1) { await row('co-anthropic').locator('[data-act="toggle"]').click(); await shot(`${v}-desktop-dark-err-anthropic`); }
    await open(v, 'desktop', 'light', 'site'); await shot(`${v}-desktop-light-site`);
    await open(v, 'desktop', 'light', 'ok');
    await startAdd(v, 'anthropic'); await page.locator('[data-act="sample-bad"]').click(); await page.locator('#kf-save').click();
    await shot(`${v}-desktop-light-key-rejected`);
    await open(v, 'phone', 'light', 'ok'); await shot(`${v}-phone-light-ok`);
    await openDefault(v); await shot(`${v}-phone-light-default-open`);
    await open(v, 'phone', 'dark', 'err'); await shot(`${v}-phone-dark-err`);
    await openDefault(v); await shot(`${v}-phone-dark-err-default-open`);
    await open(v, 'phone', 'light', 'site');
    await startAdd(v, 'openai'); await shot(`${v}-phone-light-add-key`);
  }
  if (!only) {
    // Koodipalvelut keeps round 1's GitHub and Gitea tiles.
    await open(1, 'desktop', 'light', 'ok');
    await nav('Koodipalvelut').click();
    await expect(page.locator('.mark', { hasText: 'GH' }).first()).toBeVisible();
    await expect(page.locator('.mark', { hasText: 'Gt' }).first()).toBeVisible();
    await shot('koodipalvelut-desktop-light');
    // Picker keys keep the page; an unknown ?v falls back to the first.
    await page.keyboard.press('3'); await expect(page.locator('[data-variant="3"]')).toBeVisible();
    await expect(page.locator('#section-title')).toHaveText('Koodipalvelut');
    await page.goto(target + '?v=99'); await expect(page.locator('[data-variant="1"]')).toBeVisible();
  }
  if (errors.length) throw new Error('console: ' + errors.join('\n'));
  if (requests.length) throw new Error('network: ' + requests.join('\n'));
  if (!only) await fs.writeFile(path.join(evidence, 'checks.json'), JSON.stringify({ rendered_and_fit: checked, errors, requests }, null, 1) + '\n');
  console.log(`PASS: ${checked.length} renders (variant × 390/1440 × scenario) fit with the default chooser open; choose default, error recovery, add/reject/remove key, replace the site key, Escape and focus, Koodipalvelut tiles; no console errors or network requests.`);
} finally { await browser.close(); }
