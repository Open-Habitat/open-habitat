#!/usr/bin/env node
// Opens index.html offline in headless Chromium at device scale factor 2, walks
// every variant through the Claude history states, the Pi worker and a
// finished worker at 1440 px light and 390 px dark, clicks the interactions,
// and writes AVIF screenshots to evidence/. Fails on console errors, network
// requests or horizontal overflow. From the repository root (Playwright
// resolves from web/node_modules; ffmpeg with libsvtav1 makes the AVIFs):
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-worker-view/prototypes/worker-view-2/check.mjs [--no-shots]
import { createRequire } from 'node:module';
import { readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(new URL('../../../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const url = pathToFileURL(fileURLToPath(new URL('./index.html', import.meta.url))).href;
const evidence = fileURLToPath(new URL('./evidence/', import.meta.url));
const shots = !process.argv.includes('--no-shots');
const names = ['valilehti', 'vaihtuu', 'paate-keskustelussa'];
// [label, query]: the Claude history states, the history arriving while the
// terminal is open, a live Pi worker, and a finished Claude worker.
const cases = [
  ['claude-odottaa', 'harness=claude&history=pending'],
  ['claude-ei-luettavissa', 'harness=claude&history=none'],
  ['claude-saapui', 'harness=claude&arrived=1'],
  ['pi', 'harness=pi'],
  ['pi-kehote', 'harness=pi&state=waiting'],
  ['claude-laskeutui', 'harness=claude&history=ready&state=landed'],
  ['claude-epaonnistui-ei-historiaa', 'harness=claude&history=none&state=failed'],
];

const browser = await chromium.launch({ headless: true });
const results = [];
const problems = [];
const shot = async (page, label) => { if (shots) await page.screenshot({ path: `${evidence}${label}.png` }); };
try {
  for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const requests = [];
    page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${width} console: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`${width} pageerror: ${e.message}`));
    const open = async (q) => {
      await page.goto(`${url}?${q}${theme === 'dark' ? '&theme=dark' : ''}`);
      await page.locator('#stage .wv-band').waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    const inspect = async (label) => {
      const r = await page.evaluate(() => {
        const wide = [...document.querySelectorAll('#stage *')].filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.right > innerWidth + 1 && !e.closest('.ah-terminal-surface, pre, .ah-rail-slot, .wv-termcard-body');
        }).slice(0, 3).map((e) => e.className || e.tagName);
        const text = document.querySelector('#stage').innerText;
        return { overflow: wide, worker: /Aikavyöhyketestit kellonäkymälle/.test(text), notice: !!document.querySelector('#stage .wv-ask, #stage .wv-askbox, #stage .wv-band-ask'), composer: !!document.querySelector('#stage .ah-composer') };
      });
      if (r.overflow.length) problems.push(`${label}: horizontal overflow ${JSON.stringify(r.overflow)}`);
      if (!r.worker) problems.push(`${label}: worker title not visible`);
      if (!r.notice) problems.push(`${label}: no ask-the-parent notice`);
      if (r.composer) problems.push(`${label}: a composer in the worker view`);
      results.push({ label, ...r });
    };
    for (const [vi, name] of names.entries())
      for (const [c, q] of cases) {
        if ((c === 'pi-kehote' || c.startsWith('claude-epaonnistui')) && vi === 1) continue;
        const label = `${name}-${c}-${width}-${theme}`;
        await open(`v=${vi + 1}&${q}`);
        await inspect(label);
        await shot(page, label);
      }

    // The history arriving live, through the lab button, in each variant.
    await open('v=1&harness=claude&history=pending');
    await page.getByRole('button', { name: 'Historia saapuu ▶' }).click();
    await page.locator('.wv-histline[data-tone="ready"]').waitFor();
    if (await page.locator('.ah-feed').count()) problems.push(`${width} v1 switched without the person`);
    await page.getByRole('button', { name: 'Näytä keskustelu' }).click();
    await page.locator('.ah-feed').waitFor();
    await open('v=2&harness=claude&history=pending');
    await page.getByRole('button', { name: 'Historia saapuu ▶' }).click();
    await page.locator('.wv-switched').waitFor();
    await page.getByRole('button', { name: 'Takaisin päätteeseen' }).click();
    await page.locator('.wv-termview').waitFor();
    await open('v=3&harness=claude&history=pending');
    await page.getByRole('button', { name: 'Historia saapuu ▶' }).click();
    await page.locator('.wv-termrow').waitFor();
    await page.locator('.wv-termrow').click();
    await page.locator('.ah-terminal-dock[data-max]').waitFor();
    // Variant 2's question box drafts into the parent and comes back.
    await open('v=2&harness=pi');
    await page.getByLabel('Kysymys pääagentille').fill('Ovatko kaikki kolme kesäaikatapausta jo vihreinä?');
    await page.getByRole('button', { name: /^Pääkeskusteluun/ }).click();
    await page.locator('.wv-back-worker').waitFor();
    const draft = await page.locator('#stage .ah-composer textarea').inputValue();
    if (!/Workerista »Aikavyöhyketestit kellonäkymälle«: Ovatko/.test(draft)) problems.push(`${width} v2 draft not carried: ${draft}`);
    await shot(page, `vaihtuu-luonnos-paakeskustelussa-${width}-${theme}`);
    await page.getByRole('link', { name: 'Takaisin workeriin' }).click();
    await page.locator('.wv-askbox').waitFor();
    // Details, keyboard switching.
    await open('v=1&harness=claude&history=pending');
    await page.getByRole('button', { name: 'Tiedot' }).click();
    await page.locator('.wv-details').waitFor();
    if (!/Istuntoa ei ole vielä löytynyt/.test(await page.locator('.wv-details').innerText())) problems.push(`${width} details lack the history line`);
    await page.keyboard.press('3');
    await page.locator('.wv-band-ask').waitFor();
    if (requests.length) problems.push(`${width} network: ${requests.join(', ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${evidence}checks.json`, JSON.stringify({ checked: results.length, problems, results }, null, 1) + '\n');
if (shots)
  for (const f of readdirSync(evidence).filter((n) => n.endsWith('.png'))) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', evidence + f, '-c:v', 'libsvtav1', '-crf', '32', '-pix_fmt', 'yuv420p', '-frames:v', '1', evidence + f.replace(/\.png$/, '.avif')], { stdio: 'ignore' });
    unlinkSync(evidence + f);
  }
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`PASS: ${results.length} renders (3 variants × Claude history states, Pi and finished, 1440 light / 390 dark, DPR 2), interactions, no console errors, no network, no horizontal overflow, no composer.`);
