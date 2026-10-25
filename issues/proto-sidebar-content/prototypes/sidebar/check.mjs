// Review check and screenshots for the sidebar round; never part of the product gate.
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
const NAMES = ['Nyt', 'Saapuneet', 'Työpuu', 'Työtila kerrallaan', 'Kiinnitetyt'];
async function go(v) { await page.goto(target + '?v=' + v); await expect(page.locator('nav.rail')).toHaveAttribute('aria-label', 'Sivupalkki · ' + NAMES[v - 1]); await page.evaluate(() => document.fonts.ready); }
async function shot(name) { await page.screenshot({ path: path.join(evidence, name + '.png'), animations: 'disabled' }); }
async function fit() { expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false); }
const rail = page.locator('nav.rail');
try {
  for (const v of [1, 2, 3, 4, 5]) {
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      // Desktop: wide rail with the start page, then a conversation selected.
      await page.setViewportSize({ width: 1440, height: 900 }); await go(v);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(rail).toBeVisible(); await fit();
      await shot(`${v}-1440-${theme}-home`);
      if (theme === 'dark') continue;
      // Reaching an inactive workspace: opinnaytetyo has no conversations at all.
      if (v === 1) await rail.getByRole('link', { name: /opinnaytetyo/ }).click();
      if (v === 2) { await rail.getByRole('tab', { name: /Työtilat/ }).click(); await rail.getByRole('link', { name: /opinnaytetyo/ }).click(); }
      if (v === 3 || v === 5) { await rail.getByRole('button', { name: /(Muut|Kaikki) työtilat/ }).click(); await rail.getByRole('link', { name: /opinnaytetyo/ }).last().click(); }
      if (v === 4) { await rail.locator('[data-switcher]').click(); await shot(`${v}-1440-light-switcher`); await rail.locator('.pop [data-switch="opinnaytetyo"]').click(); }
      await expect(page.locator('main h1')).toHaveText('opinnaytetyo');
      // The waiting question, reached from the rail.
      await go(v);
      if (v === 2) await rail.locator('.msg-link', { hasText: 'Etusivun kuvagalleria' }).click();
      else await rail.locator('[data-open="a4"]').first().click();
      await expect(page.locator('main h1')).toHaveText('Etusivun kuvagalleria');
      await expect(page.locator('.q')).toBeVisible(); await fit();
      await shot(`${v}-1440-light-question`);
      // Narrow rail form.
      await rail.locator('[data-collapse]').click();
      await expect(page.locator('.app')).toHaveClass(/collapsed/);
      expect(await rail.evaluate((n) => n.getBoundingClientRect().width)).toBeLessThanOrEqual(53);
      await fit(); await shot(`${v}-1440-light-narrow`);
      await rail.locator('[data-collapse]').click();
      // Phone: content first, the rail is a drawer opened from the toolbar.
      await page.setViewportSize({ width: 390, height: 844 }); await go(v);
      await expect(rail).toBeHidden(); await fit();
      await shot(`${v}-390-light-home`);
      await page.locator('[data-drawer]').click();
      await expect(rail).toBeVisible(); await fit();
      await shot(`${v}-390-light-drawer`);
      await page.keyboard.press('Escape'); await expect(rail).toBeHidden();
      await page.locator('[data-drawer]').click();
      if (v === 2) await rail.locator('.msg-link', { hasText: 'Lokakuun' }).click();
      else if (v === 4) await rail.locator('.elsewhere [data-open="a6"]').click();
      else await rail.locator('[data-open="a6"]').first().click();
      await expect(rail).toBeHidden(); await expect(page.locator('main h1')).toHaveText('Lokakuun kuukausiraportti');
      await fit(); await shot(`${v}-390-light-conversation`);
    }
    await page.emulateMedia({ colorScheme: 'dark' }); await page.setViewportSize({ width: 390, height: 844 }); await go(v);
    await page.locator('[data-drawer]').click(); await fit(); await shot(`${v}-390-dark-drawer`);
    await page.emulateMedia({ colorScheme: 'light' });
  }
  // Variant-specific behaviour.
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(1); await rail.locator('[data-filter]').fill('rese'); await expect(rail.locator('.row.ws')).toHaveCount(1); await expect(rail.locator('[data-filter]')).toBeFocused();
  await go(2); const before = await rail.locator('.msg').count(); await rail.locator('[data-ack]').first().click(); await expect(rail.locator('.msg')).toHaveCount(before - 1);
  await go(5); await rail.locator('[data-filter]').fill('ostos'); await expect(rail.locator('.rail-scroll .row')).toHaveCount(1);
  await go(5); await rail.locator('[data-pin="ws:kotisivu"]').click(); await expect(rail.locator('[data-pin="ws:kotisivu"]')).toHaveCount(0);
  await go(1); await page.keyboard.press('ArrowRight'); await expect(rail).toHaveAttribute('aria-label', /Saapuneet/); await page.keyboard.press('4'); await expect(rail).toHaveAttribute('aria-label', /kerrallaan/);
  expect(errors).toEqual([]); expect(requests).toEqual([]);
  console.log('PASS: 5 variants × 1440/390; light/dark; inactive workspace reachable; waiting question; narrow rail; phone drawer open/Escape/navigate; filter, acknowledge, search, unpin, picker keys; no console errors or network requests.');
} finally { await browser.close(); }
