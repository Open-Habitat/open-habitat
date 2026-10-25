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
const pages = [
  ['Tekoäly', 'Koodipalvelut', 'Tiedot agenteille'],
  ['Agentit ja mallit', 'Yhteydet'],
  ['Agentit', 'Yhteydet'],
];
async function open(v, size, theme, scenario = 'ok') {
  await page.setViewportSize({ width: sizes[size][0], height: sizes[size][1] });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(target + '?v=' + v);
  await expect(page.locator(`[data-variant="${v}"]`)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#scenario').selectOption(scenario);
}
const nav = (label) => page.locator('.s-nav-i', { hasText: new RegExp('^' + label) }).first();
async function fit(what) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 0) throw new Error(`${what}: horizontal overflow ${over}px`);
}
async function shot(name) { await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true, animations: 'disabled', style: '.proto-picker{display:none}' }); }
async function goNav(label) {
  await nav(label).click();
  await expect(page.locator('#section-title')).toBeFocused();
  await expect(page.locator('#section-title')).toHaveText(label);
}
const checked = [];
try {
  for (const v of [1, 2, 3]) {
    // Every page of every variant, both widths, all three scenarios: renders and fits.
    for (const size of ['desktop', 'phone']) {
      for (const scenario of ['ok', 'err', 'new']) {
        await open(v, size, 'light', scenario);
        for (const label of pages[v - 1]) {
          if (size === 'phone' && await page.locator('.s-back').isVisible()) await page.locator('.s-back').click();
          await goNav(label);
          await fit(`${v} ${size} ${scenario} ${label}`);
          checked.push(`${v}/${size}/${scenario}/${label}`);
          if (v === 3 && label === 'Yhteydet') {
            for (const sub of ['Tekoälypalvelut', 'Koodipalvelut', 'Tiedot agenteille']) {
              await page.locator('.hub-head', { hasText: sub }).click();
              await expect(page.locator('#section-title')).toHaveText(sub);
              await fit(`${v} ${size} ${scenario} ${sub}`);
              if (size === 'phone') { await page.locator('.s-back').click(); await expect(page.locator('#section-title')).toHaveText('Yhteydet'); }
              else await nav('Yhteydet').click();
            }
          }
        }
      }
    }
    // Error-state badges in the navigation.
    await open(v, 'desktop', 'light', 'err');
    await expect(page.locator('.s-nav-i .alert').first()).toBeVisible();
    await open(v, 'desktop', 'light', 'ok');
    await expect(page.locator('.s-nav-i .alert')).toHaveCount(0);

    // Screens for Jari.
    const main = pages[v - 1][v === 1 ? 1 : 1];
    const ai = pages[v - 1][0];
    await open(v, 'desktop', 'light', 'err'); await goNav(main); await shot(`${v}-desktop-light-errors-${v === 1 ? 'koodi' : 'yhteydet'}`);
    await open(v, 'desktop', 'dark', 'err');
    if (v === 3) { await goNav('Yhteydet'); await page.locator('.hub-head', { hasText: 'Tekoälypalvelut' }).click(); } else await goNav(ai);
    await shot(`${v}-desktop-dark-errors-tekoaly`);
    await open(v, 'desktop', 'light', 'ok');
    if (v === 1) await goNav('Tiedot agenteille'); else if (v === 2) await goNav('Yhteydet'); else { await goNav('Yhteydet'); await page.locator('.hub-head', { hasText: 'Tiedot agenteille' }).click(); }
    await shot(`${v}-desktop-light-ok-tiedot`);
    await open(v, 'desktop', 'dark', 'new'); await goNav(v === 3 ? 'Yhteydet' : ai); await shot(`${v}-desktop-dark-new-${v === 3 ? 'yhteydet' : 'tekoaly'}`);
    await open(v, 'phone', 'light', 'err'); await shot(`${v}-phone-light-errors-nav`);
    await goNav(main); await shot(`${v}-phone-light-errors-${v === 1 ? 'koodi' : 'yhteydet'}`);
    await open(v, 'phone', 'dark', 'err'); await goNav(v === 3 ? 'Agentit' : ai); await shot(`${v}-phone-dark-errors-${v === 3 ? 'agentit' : 'tekoaly'}`);
    await open(v, 'phone', 'dark', 'ok'); await goNav(main); await shot(`${v}-phone-dark-ok-${v === 1 ? 'koodi' : 'yhteydet'}`);

    // Origins: every link lands on the right page and marks the row.
    for (const size of ['desktop', 'phone']) {
      await open(v, size, 'light', 'err');
      await page.locator('[data-view="origins"]').click();
      await fit(`${v} ${size} origins`);
      if (size === 'desktop') await shot(`${v}-desktop-light-origins`); else await shot(`${v}-phone-light-origins`);
      const links = await page.locator('.origins [data-go]').evaluateAll((els) => els.map((e) => e.dataset.go));
      for (const go of links) {
        await page.locator('[data-view="origins"]').click();
        const dest = await page.locator(`.origins [data-go="${go}"]`).first().getAttribute('data-dest');
        await page.locator(`.origins [data-go="${go}"]`).first().click();
        await expect(page.locator('#section-title')).toBeFocused();
        const row = { 'model-claude': 'claude', 'model-default': 'model', 'onb-code': 'github', 'onb-data': 'google', 'onb-ai': 'chatgpt', 'ws-gitea': 'gitea', 'agents-manage': 'chatgpt', sitekey: null }[go];
        if (row) await expect(page.locator('#row-' + row)).toHaveClass(/flash/);
        const title = await page.locator('#section-title').textContent();
        if (!dest.split(' › ').includes(title)) throw new Error(`${v} ${go}: landed on ${title}, origin says ${dest}`);
        if (size === 'desktop' && go === 'model-claude') await shot(`${v}-desktop-light-landed-model-claude`);
        if (size === 'desktop' && go === 'ws-gitea') await shot(`${v}-desktop-light-landed-ws-gitea`);
      }
      await page.locator('[data-view="settings"]').click();
    }

    // Interactions: connect, fix, manage/disconnect, model note link.
    await open(v, 'desktop', 'light', 'err');
    if (v === 3) { await goNav('Yhteydet'); await page.locator('.chip', { hasText: 'Gitea' }).click(); await expect(page.locator('#row-gitea')).toBeFocused(); }
    else await goNav(pages[v - 1][1]);
    await page.locator('#row-gitea [data-act="fix"]').click();
    await expect(page.locator('#row-gitea')).toHaveAttribute('data-state', 'ok');
    await expect(page.locator('#status')).toContainText('Gitea korjattu');
    await page.locator('#row-gitea [data-act="toggle"]').click();
    await page.locator('#row-gitea [data-act="disconnect"]').click();
    await expect(page.locator('#row-gitea')).toHaveAttribute('data-state', 'off');
    await page.locator('#row-gitea [data-act="connect"]').click();
    await expect(page.locator('#row-gitea')).toHaveAttribute('data-state', 'ok');
    await goNav(v === 3 ? 'Agentit' : ai);
    await page.locator('#row-model').locator('..').locator('[data-go="model-claude"]').click();
    await expect(page.locator('#row-claude')).toHaveClass(/flash/);
    await page.locator('#row-claude [data-act="fix"]').click();
    await goNav(v === 3 ? 'Agentit' : ai);
    await expect(page.locator('#row-model select')).toContainText('Claude Sonnet');
  }
  // Picker keys and a switch that keeps the subject.
  await open(1, 'desktop', 'light'); await goNav('Tiedot agenteille');
  await page.keyboard.press('3'); await expect(page.locator('#section-title')).toHaveText('Tiedot agenteille');
  await page.keyboard.press('ArrowLeft'); await expect(page.locator('#section-title')).toHaveText('Yhteydet');
  await page.goto(target + '?v=99'); await expect(page.locator('[data-variant="1"]')).toBeVisible();
  if (errors.length) throw new Error('console: ' + errors.join('\n'));
  if (requests.length) throw new Error('network: ' + requests.join('\n'));
  await fs.writeFile(path.join(evidence, 'checks.json'), JSON.stringify({ rendered_and_fit: checked, errors, requests }, null, 1) + '\n');
  console.log(`PASS: ${checked.length} page renders (3 variants × 390/1440 × 3 scenarios) fit without overflow; origin links land on their stated page; connect/fix/disconnect; nav error badges; picker keys; no console errors or network requests.`);
} finally { await browser.close(); }
