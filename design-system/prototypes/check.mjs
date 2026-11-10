#!/usr/bin/env node
// Checks a built prototype page in headless Chromium before it is shown: every direction
// at desktop width in light and dark and at phone width, after the live turn has settled,
// with optional clicks. Writes screenshots to one directory it owns and reports console
// errors; the exit status is 1 when the page logged any or a comparison lacks its visible picker.
//
//   node check.mjs <page.html> [--out <dir>] [--target <text>] [--click <selector>]...
//                  [--at <n>] [--modes desk-light,desk-dark,phone-light]
//
// --target screenshots the reply bubble or tool card containing that text instead of the
// whole frame. --click clicks each selector in turn (inside the target when one is given,
// in direction --at, default 1, in the first mode only) and screenshots after each.
// The default output directory is dist/check-<page>; it is emptied first.
// Run from the repository root with PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright.
import { checkPicker } from './picker-check.mjs';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(join(here, '../../web/node_modules/playwright/index.mjs'));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const all = (name) => args.flatMap((a, i) => a === name ? [args[i + 1]] : []);
const page = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!page) { console.error('usage: node check.mjs <page.html> [--out <dir>] [--target <text>] [--click <selector>]... [--modes ...]'); process.exit(2); }
const file = resolve(page);
const out = resolve(opt('--out') ?? join(here, 'dist', `check-${basename(file, '.html')}`));
const target = opt('--target'); const at = Number(opt('--at') ?? 1); const clicks = all('--click');
const modes = (opt('--modes') ?? 'desk-light,desk-dark,phone-light').split(',');
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? { executablePath: process.env.PROTO_CHROMIUM } : {}); const errors = []; const shots = [];
for (const mode of modes) {
  const [form, theme] = mode.split('-');
  const p = await browser.newPage({ viewport: { width: form === 'phone' ? 390 : 1280, height: 2600 } });
  p.on('console', m => m.type() === 'error' && errors.push(`${mode}: ${m.text()}`));
  p.on('pageerror', e => errors.push(`${mode}: ${e}`));
  await p.goto('file://' + file);
  const round = await p.evaluate(() => document.querySelector('meta[name="prototype-round"]')?.content) ?? basename(file, '.html');
  if (round !== 'agentin-vuoro' && !file.includes('/drafts/')) {
    // The trial list names superseded rounds still offered for review; a tree without it has none.
    const trials = join(here, '../../KOKEILTAVAA.md');
    try { await checkPicker(p, round, existsSync(trials) ? readFileSync(trials, 'utf8') : ''); }
    catch (e) { await browser.close(); throw e; }
  }
  // A tall frame shows the whole conversation; the recap card would cover the stage.
  await p.addStyleTag({ content: '.frame{height:2400px!important} .recap-host{display:none!important}' });
  await p.selectOption('#theme', theme);
  if (form === 'phone') await p.check('#phone');
  const count = Math.max(1, await p.locator('.proto-picker-item:not(.proto-picker-replay)').count());
  for (let k = 1; k <= count; k++) {
    await p.evaluate(() => document.activeElement?.blur());
    if (count > 1) await p.keyboard.press(String(k));
    // The previous direction's settled turn lingers until the new one mounts; wait for the new one to start.
    await p.waitForSelector('.turn.live.working', { timeout: 3000 }).catch(() => {});
    if (await p.locator('.turn.live').count()) await p.waitForSelector('.turn.live:not(.working)', { timeout: 90000 });
    await p.waitForTimeout(400);
    const el = target ? p.locator('.bubble.reply, section.tool').filter({ hasText: target }).first() : p.locator('.frame, .review').first();
    await el.evaluate(n => n.scrollIntoView({ block: 'start' }));
    const name = (s) => { const f = join(out, `${mode}-${k}${s}.png`); shots.push(f); return f; };
    await el.screenshot({ path: name('') });
    if (mode === modes[0] && k === at && clicks.length) for (const [i, sel] of clicks.entries()) {
      await el.locator(sel).first().click(); await p.waitForTimeout(250);
      const dlg = p.locator('dialog[open]');
      await ((await dlg.count()) ? dlg : el).screenshot({ path: name(`-click${i + 1}`) });
      if (await dlg.count()) await p.keyboard.press('Escape');
    }
  }
  await p.close();
}
await browser.close();
console.log(JSON.stringify({ out, shots: shots.length, errors }, null, 2));
process.exit(errors.length ? 1 : 0);
