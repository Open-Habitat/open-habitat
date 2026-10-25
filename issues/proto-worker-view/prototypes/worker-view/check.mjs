#!/usr/bin/env node
// Opens index.html offline in headless Chromium and walks every variant and
// state at 1440 and 390 px, clicks the interactions, and writes screenshots to
// evidence/. Fails on console errors, network requests or horizontal overflow.
// From the repository root (Playwright resolves from web/node_modules):
//   (ffmpeg with libsvtav1 converts the screenshots to AVIF)
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-worker-view/prototypes/worker-view/check.mjs [--no-shots]
import { createRequire } from 'node:module';
import { readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(new URL('../../../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const page_ = fileURLToPath(new URL('./index.html', import.meta.url));
const evidence = fileURLToPath(new URL('./evidence/', import.meta.url));
const shots = !process.argv.includes('--no-shots');
const names = ['hiljainen', 'kehys', 'sivupaneeli', 'keskustelussa'];
const states = ['running', 'waiting', 'landed', 'failed'];

const browser = await chromium.launch({ headless: true });
const results = [];
const problems = [];
try {
  for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const requests = [];
    page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${width} console: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`${width} pageerror: ${e.message}`));
    for (const [vi, name] of names.entries())
      for (const state of states)
        for (const harness of ['pi', 'claude']) {
          if (harness === 'claude' && state !== 'running') continue;
          const url = `${pathToFileURL(page_).href}?v=${vi + 1}&state=${state}&harness=${harness}${theme === 'dark' ? '&theme=dark' : ''}`;
          await page.goto(url);
          await page.locator('#stage .ah-app-shell').waitFor();
          await page.evaluate(() => document.fonts.ready);
          const label = `${name}-${state}${harness === 'claude' ? '-claude' : ''}-${width}-${theme}`;
          const overflow = await page.evaluate(() => {
            const wide = [...document.querySelectorAll('#stage *')].filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.ah-terminal-surface, pre, .ah-rail-slot');
            });
            return wide.slice(0, 3).map((e) => e.className || e.tagName);
          });
          const rendered = await page.evaluate(() => ({
            worker: /Aikavyöhyketestit kellonäkymälle/.test(document.querySelector('#stage').innerText),
            composer: !!document.querySelector('#stage .ah-composer:not([hidden])'),
          }));
          if (overflow.length) problems.push(`${label}: horizontal overflow ${JSON.stringify(overflow)}`);
          if (!rendered.worker) problems.push(`${label}: worker title not visible`);
          results.push({ label, overflow, ...rendered });
          if (shots && (harness === 'pi' || width === 1440)) await page.screenshot({ path: `${evidence}${label}.png` });
        }
    // Interactions, on the running state.
    await page.goto(`${pathToFileURL(page_).href}?v=1&state=waiting`);
    await page.getByRole('button', { name: 'Tiedot' }).click();
    await page.locator('.wv-details').waitFor();
    if (shots) await page.screenshot({ path: `${evidence}hiljainen-details-${width}-${theme}.png` });
    await page.getByRole('button', { name: 'Tiedot' }).click();
    await page.getByRole('button', { name: 'Näytä pääte' }).click();
    await page.locator('.wv-term').waitFor();
    if (!/continue connecting/.test(await page.locator('.wv-term').innerText())) problems.push(`${width} terminal lacks the prompt`);
    if (shots) await page.screenshot({ path: `${evidence}hiljainen-waiting-terminal-${width}-${theme}.png` });
    await page.goto(`${pathToFileURL(page_).href}?v=2&state=failed`);
    await page.getByRole('tab', { name: 'Pääte' }).click();
    await page.locator('.wv-term').waitFor();
    await page.goto(`${pathToFileURL(page_).href}?v=3&state=running`);
    await page.getByRole('button', { name: /Sulje worker|Takaisin pääkeskusteluun/ }).first().click();
    if (await page.locator('.wv-side').count()) problems.push(`${width} side panel did not close`);
    await page.getByRole('button', { name: 'Workerit' }).click();
    await page.locator('.wv-side').waitFor();
    await page.goto(`${pathToFileURL(page_).href}?v=4&state=running`);
    await page.getByRole('button', { name: /Avaa workerin keskustelu/ }).click();
    await page.locator('.wv-crumb').waitFor();
    await page.locator('.wv-crumb a').click();
    await page.locator('.wv-card').waitFor();
    await page.locator('[data-wv-toggle="s1"]').first().click().catch(() => {});
    await page.goto(`${pathToFileURL(page_).href}?v=1&state=running`);
    await page.locator('[data-wv-toggle="s1"]').click();
    await page.locator('.ah-think-row').waitFor();
    await page.locator('[data-wv-toggle="t2"]').click();
    await page.locator('.ah-output-box').first().waitFor();
    if (shots && width === 1440) await page.screenshot({ path: `${evidence}hiljainen-expanded-${width}-${theme}.png` });
    await page.keyboard.press('2');
    await page.locator('.wv-band').waitFor();
    if (requests.length) problems.push(`${width} network: ${requests.join(', ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${evidence}checks.json`, JSON.stringify({ checked: results.length, problems, results }, null, 1) + '\n');
// Screenshots go into the issue as AVIF, as in earlier rounds (about a quarter of the PNG size).
if (shots && !process.argv.includes('--keep-png'))
  for (const f of readdirSync(evidence).filter((n) => n.endsWith('.png'))) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', evidence + f, '-c:v', 'libsvtav1', '-crf', '28', '-pix_fmt', 'yuv420p', '-frames:v', '1', evidence + f.replace(/\.png$/, '.avif')]);
    unlinkSync(evidence + f);
  }
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`PASS: ${results.length} renders (4 variants × 4 states + Claude fallback × 1440 light / 390 dark), interactions, no console errors, no network, no horizontal overflow.`);
