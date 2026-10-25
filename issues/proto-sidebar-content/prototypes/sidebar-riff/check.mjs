// Review check and screenshots for the sidebar riff (round 2); never part of the product gate.
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const errors = [], requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url()); });
const target = 'file://' + path.join(here, 'index.html');
const evidence = path.join(here, 'evidence'); await fs.mkdir(evidence, { recursive: true });
const NAMES = ['Aakkoset', 'Viimeisimmät', 'Ryhmät', 'Haku ensin'];
async function go(v) { await page.goto(target + '?v=' + v); await expect(page.locator('nav.rail')).toHaveAttribute('aria-label', 'Sivupalkki · ' + NAMES[v - 1]); await page.evaluate(() => document.fonts.ready); }
async function shot(name) { await page.screenshot({ path: path.join(evidence, name + '.png'), animations: 'disabled' }); }
async function fit() { expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false); }
const rail = page.locator('nav.rail');
const wsSec = rail.locator('[data-sec="workspaces"]');
// Reach a workspace from the rail the way each variant offers it.
async function openWs(v, name, archivedWs = false) {
  if (v === 4) { await rail.locator('[data-filter]').fill(name.slice(0, 5)); await wsSec.locator(`[data-ws="${name}"]`).click(); return; }
  if (v === 2) await wsSec.locator('[data-all]').click();
  if (archivedWs) await wsSec.locator('[data-archived]').click();
  await wsSec.locator(`[data-ws="${name}"]`).last().click();
}
try {
  for (const v of [1, 2, 3, 4]) {
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 1440, height: 900 }); await go(v);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(rail).toBeVisible(); await fit();
      // Round 1 verdict: Käynnissä holds background waits; workspaces list no agents.
      await expect(rail.locator('[data-sec="running"]')).toContainText('Odottaa taustatyötä');
      await expect(rail.locator('[data-sec="running"] .mk-bg')).toHaveCount(2);
      await expect(wsSec.locator('.row.agent')).toHaveCount(0);
      await shot(`${v}-1440-${theme}-home`);
      // Workspace front page with a worker under its parent.
      await openWs(v, 'kirjasto-api');
      await expect(page.locator('main h1')).toHaveText('kirjasto-api');
      await expect(page.locator('main')).toContainText('Muistutusten sähköpostipohja');
      await fit(); await shot(`${v}-1440-${theme}-workspace`);
      if (theme === 'dark') continue;
      // A workspace with nothing in it, and an archived one.
      await go(v); await openWs(v, 'opinnaytetyo');
      await expect(page.locator('main h1')).toHaveText('opinnaytetyo');
      await go(v); await openWs(v, 'vanha-blogi', true);
      await expect(page.locator('main h1')).toHaveText('vanha-blogi'); await expect(page.locator('.note')).toContainText('Arkistoitu');
      await fit(); await shot(`${v}-1440-light-archived`);
      // Narrow rail form.
      await go(v); await rail.locator('[data-collapse]').click();
      await expect(page.locator('.app')).toHaveClass(/collapsed/);
      expect(await rail.evaluate((n) => n.getBoundingClientRect().width)).toBeLessThanOrEqual(53);
      await fit(); await shot(`${v}-1440-light-narrow`);
      await rail.locator('[data-collapse]').click();
      // Phone: the rail is a drawer; a workspace opens its front page and closes the drawer.
      await page.setViewportSize({ width: 390, height: 844 }); await go(v);
      await expect(rail).toBeHidden(); await fit(); await shot(`${v}-390-light-home`);
      await page.locator('[data-drawer]').click(); await expect(rail).toBeVisible(); await fit();
      await shot(`${v}-390-light-drawer`);
      await page.keyboard.press('Escape'); await expect(rail).toBeHidden();
      await page.locator('[data-drawer]').click();
      await openWs(v, 'kotisivu');
      await expect(rail).toBeHidden(); await expect(page.locator('main h1')).toHaveText('kotisivu');
      await fit(); await shot(`${v}-390-light-workspace`);
    }
    await page.emulateMedia({ colorScheme: 'dark' }); await page.setViewportSize({ width: 390, height: 844 }); await go(v);
    await page.locator('[data-drawer]').click(); await fit(); await shot(`${v}-390-dark-drawer`);
    await page.emulateMedia({ colorScheme: 'light' });
  }
  // Variant-specific behaviour.
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(1); await rail.locator('[data-filter]').fill('kes'); await expect(wsSec.locator('[data-ws="kesatyo-2024"]')).toBeVisible(); await expect(rail.locator('[data-filter]')).toBeFocused();
  await go(2); await expect(wsSec.locator('.row.ws')).toHaveCount(5);
  await rail.locator('[data-collapse]').click(); await rail.locator('[data-expand-all]').click(); await expect(wsSec.locator('[data-filter]')).toBeVisible();
  await go(3); const before = await wsSec.locator('.row.ws').count(); await wsSec.locator('[data-group="github:tailspin"]').click();
  await expect(wsSec.locator('.row.ws')).toHaveCount(before - 3); await expect(wsSec.locator('[data-group="github:tailspin"] .mk-working')).toHaveCount(1);
  await go(4); await page.keyboard.press('/'); await expect(rail.locator('[data-filter]')).toBeFocused();
  await page.keyboard.type('ostos'); await expect(wsSec.locator('.row.agent')).toHaveCount(1);
  await go(4); await openWs(4, 'asiakasportaali'); await page.locator('[data-ws-state="done"]').click(); await expect(page.locator('.trow')).toHaveCount(1);
  await go(1); await page.keyboard.press('ArrowRight'); await expect(rail).toHaveAttribute('aria-label', /Viimeisimmät/);
  expect(errors).toEqual([]); expect(requests).toEqual([]);
  console.log('PASS: 4 variants × 1440/390; light/dark; background waits in Käynnissä; no agents under workspaces; workspace page, empty and archived workspace reachable; narrow rail; phone drawer open/Escape/navigate; filter, Kaikki, group fold, "/" search with conversation hits, state chips, picker keys; no console errors or network requests.');
} finally { await browser.close(); }
