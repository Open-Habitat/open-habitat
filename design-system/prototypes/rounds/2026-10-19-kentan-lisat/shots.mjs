#!/usr/bin/env node
// Key-state screenshots for this round: check.mjs only clicks, and these states need typing.
//
//   node rounds/2026-10-19-kentan-lisat/shots.mjs <page.html> --out <dir>
//
// Every direction in light at desktop width, a subset in dark and at phone width. Each state
// starts from an empty field after the live turn has settled. Exits 1 on console errors.
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(join(here, '../../../../web/node_modules/playwright/index.mjs'));
const args = process.argv.slice(2);
const file = resolve(args[0]); const out = resolve(args[args.indexOf('--out') + 1]);
mkdirSync(out, { recursive: true });

const type = (p, s) => p.keyboard.type(s, { delay: 15 });
const field = (p) => p.locator('.composer textarea');
const reset = async (p) => { await p.keyboard.press('Escape'); await p.evaluate(() => { const t = document.querySelector('.composer textarea'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); }); await field(p).focus(); await p.keyboard.press('Backspace'); };
// [name, steps(page, dir)]
const STATES = [
  ['1-slash', async (p) => { await type(p, '/'); }],
  ['2-midline', async (p) => { await type(p, 'Korjaa testit ja aja sitten /re'); }],
  ['3-at', async (p) => { await type(p, 'Katso @stat'); }],
  ['4-picker', async (p) => { await type(p, 'Vertaa '); await p.keyboard.press('Control+P'); await p.waitForTimeout(200); await type(p, 'sta'); }],
  ['5-shell', async (p, d) => { await type(p, d === 1 ? '!git status' : '!git status'); }],
  ['6-ran', async (p) => { await type(p, '!pytest -q'); await p.keyboard.press('Enter'); await p.waitForTimeout(3600); }],
  ['7-long', async (p) => { await type(p, '!make serve'); await p.keyboard.press('Enter'); await p.waitForTimeout(5200); }],
  ['8-noctx', async (p) => { await type(p, '!!git diff --stat'); await p.waitForTimeout(100); }],
  ['9-button', async (p, d) => { if (d !== 3) return false; await p.click('.x-row [data-x="cmds"]'); await p.waitForTimeout(200); await type(p, 'git'); }],
];
const PLAN = { 'desk-light': null, 'desk-dark': ['1-slash', '4-picker', '6-ran', '5-shell'], 'phone-light': ['1-slash', '3-at', '4-picker', '6-ran', '9-button'] };

const browser = await chromium.launch(); const errors = []; let n = 0;
for (const [mode, only] of Object.entries(PLAN)) {
  const [form, theme] = mode.split('-');
  const p = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('console', m => m.type() === 'error' && errors.push(`${mode}: ${m.text()}`));
  p.on('pageerror', e => errors.push(`${mode}: ${e}`));
  await p.goto('file://' + file);
  await p.selectOption('#theme', theme);
  if (form === 'phone') await p.check('#phone');
  for (const d of [1, 2, 3]) {
    await p.evaluate(() => document.activeElement?.blur());
    await p.keyboard.press(String(d));
    await p.waitForSelector('.turn.live.working', { timeout: 3000 }).catch(() => {});
    await p.waitForSelector('.turn.live:not(.working)', { timeout: 120000 });
    for (const [name, steps] of STATES) {
      if (only && !only.includes(name)) continue;
      await reset(p);
      if (await steps(p, d) === false) continue;
      await p.waitForTimeout(250);
      await p.locator('.frame').screenshot({ path: join(out, `${mode}-v${d}-${name}.png`) }); n++;
      // A run left in the conversation would pile up; replay the direction after one.
      if (name === '6-ran' || name === '7-long') { await p.keyboard.press('Escape'); await p.evaluate(() => document.activeElement?.blur()); await p.keyboard.press(String(d)); await p.waitForSelector('.turn.live.working', { timeout: 3000 }).catch(() => {}); await p.waitForSelector('.turn.live:not(.working)', { timeout: 120000 }); }
    }
  }
  await p.close();
}
await browser.close();
console.log(`${n} kuvaa → ${out}`);
if (errors.length) { console.log('Konsolivirheet:\n' + errors.join('\n')); process.exit(1); }
console.log('Konsoli puhdas.');
