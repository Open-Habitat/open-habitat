#!/usr/bin/env node
// Key-state screenshots and keyboard-flow checks for this round: check.mjs only clicks, and
// these states need typing.
//
//   node rounds/2026-10-19-kentta-yhdessa/shots.mjs <page.html> --out <dir>
//
// Every direction in light at desktop width, a subset in dark and at phone width. Each state
// starts from an empty field after the live turn has settled. Then a keyboard-only flow runs
// in every direction and asserts the field's text. Exits 1 on console errors or a failed check.
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
const value = (p) => field(p).inputValue();
const reset = async (p) => { await p.keyboard.press('Escape'); await p.evaluate(() => { const t = document.querySelector('.composer textarea'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); }); await field(p).focus(); await p.keyboard.press('Backspace'); };
const settle = async (p, d) => { await p.evaluate(() => { if (UI.sel !== 'c1') openConv('c1'); document.activeElement?.blur(); }); await p.waitForTimeout(100); await p.keyboard.press(String(d)); await p.waitForSelector('.turn.live.working', { timeout: 3000 }).catch(() => {}); await p.waitForSelector('.turn.live:not(.working)', { timeout: 120000 }); };
const STATES = [
  ['1-slash', async (p) => { await type(p, '/'); }],
  ['2-at', async (p) => { await type(p, 'Katso @stat'); }],
  ['3-btn-cmds', async (p) => { await type(p, 'korjaa ensin pienin syy'); await p.click('[data-x="cmds"]'); await p.waitForTimeout(200); await type(p, 'pyt'); }],
  ['4-btn-files', async (p) => { await type(p, 'Vertaa '); await p.click('[data-x="files"]'); await p.waitForTimeout(200); }],
  ['5-picker', async (p) => { await type(p, 'Vertaa '); await p.keyboard.press('Control+P'); await p.waitForTimeout(200); await type(p, 'sta'); await p.keyboard.press('Tab'); }],
  ['6-shell', async (p) => { await type(p, '!git status'); }],
  ['7-ran', async (p) => { await type(p, '!pytest -q'); await p.keyboard.press('Enter'); await p.waitForTimeout(3600); }],
  ['8-noctx', async (p) => { await type(p, '!!git diff --stat'); await p.waitForTimeout(100); }],
  ['9-new-loading', async (p) => { await type(p, '/uusi'); await p.keyboard.press('Enter'); await p.waitForTimeout(400); await p.click('[data-x="cmds"]'); await p.waitForTimeout(250); }],
  ['10-new-listed', async (p) => { await p.waitForTimeout(1300); }],
];
const PLAN = {
  'desk-light': null,
  'desk-dark': ['1-slash', '3-btn-cmds', '5-picker', '6-shell'],
  'phone-light': ['1-slash', '3-btn-cmds', '4-btn-files', '5-picker', '6-shell', '9-new-loading', '10-new-listed'],
  'phone-dark': ['3-btn-cmds', '6-shell'],
};

// Keyboard only: typed completion, the button reached by Tab, the palette, `!`. [steps, expected value]
const FLOW = [
  ['/rev Enter → komento viestin alkuun', async (p) => { await type(p, '/rev'); await p.keyboard.press('Enter'); }, '/review '],
  ['kesken lauseen / ei korostu, Enter lähettäisi', async (p) => { await type(p, 'aja /re'); return p.locator('.x-pop li[aria-selected="true"]').count().then(n => n === 0 ? 'ok' : 'highlighted'); }, 'ok'],
  ['@stat Tab → @polku', async (p) => { await type(p, 'katso @status_r'); await p.keyboard.press('Tab'); }, 'katso @scripts/status_rows.py '],
  ['Tab (Yläpuolella Shift+Tab) Komennot-painikkeeseen, Enter, haku, Enter → alkuun', async (p) => { await type(p, 'korjaa testi'); await p.keyboard.press(p.dir === 2 ? 'Shift+Tab' : 'Tab'); if (p.dir === 2) await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Enter'); await p.waitForTimeout(150); await type(p, 'fix'); await p.keyboard.press('Enter'); }, '/fix-tests korjaa testi'],
  ['Ctrl+P kahdesta merkitystä', async (p) => { await type(p, 'vertaa'); await p.keyboard.press('Control+P'); await p.waitForTimeout(150); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); }, 'vertaa @scripts/status_rows.py @tests/test_status_rows.py '],
  ['@ ja Ctrl+P vie haun palettiin', async (p) => { await type(p, 'lue @READ'); await p.keyboard.press('Control+P'); await p.waitForTimeout(150); await p.keyboard.press('Enter'); }, 'lue @README.md '],
  ['Esc listasta pitää tekstin', async (p) => { await type(p, 'x @do'); await p.keyboard.press('Escape'); }, 'x @do'],
  ['! komennossa Ctrl+P lisää polun ilman @', async (p) => { await type(p, '!git diff '); await p.keyboard.press('Control+P'); await p.waitForTimeout(150); await p.keyboard.press('Enter'); }, '!git diff scripts/status_rows.py '],
];

const browser = await chromium.launch(); const errors = []; const fails = []; let n = 0;
for (const [mode, only] of Object.entries(PLAN)) {
  const [form, theme] = mode.split('-');
  const p = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('console', m => m.type() === 'error' && errors.push(`${mode}: ${m.text()}`));
  p.on('pageerror', e => errors.push(`${mode}: ${e}`));
  await p.goto('file://' + file);
  await p.selectOption('#theme', theme);
  if (form === 'phone') await p.check('#phone');
  for (const d of [1, 2, 3]) {
    await settle(p, d);
    for (const [name, steps] of STATES) {
      if (only && !only.includes(name)) continue;
      if (name !== '10-new-listed') await reset(p);
      if (await steps(p, d) === false) continue;
      await p.waitForTimeout(250);
      await p.locator('.frame').screenshot({ path: join(out, `${mode}-v${d}-${name}.png`) }); n++;
      // A run or a new conversation changes the scene; replay the direction after one.
      if (['7-ran', '9-new-loading', '10-new-listed'].includes(name) && (name !== '9-new-loading' || (only && !only.includes('10-new-listed')))) await settle(p, d);
    }
    if (mode === 'desk-light') {
      for (const [label, steps, want] of FLOW) {
        await reset(p); p.dir = d;
        const got = (await steps(p)) ?? await value(p);
        if (got !== want) fails.push(`v${d} ${label}: odotettiin ${JSON.stringify(want)}, saatiin ${JSON.stringify(got)}`);
      }
      await reset(p);
    }
  }
  await p.close();
}
await browser.close();
console.log(`${n} kuvaa → ${out}`);
console.log(fails.length ? 'Näppäimistövirrat epäonnistuivat:\n' + fails.join('\n') : `Näppäimistövirrat: ${FLOW.length} × 3 suuntaa läpi.`);
if (errors.length) console.log('Konsolivirheet:\n' + errors.join('\n')); else console.log('Konsoli puhdas.');
if (errors.length || fails.length) process.exit(1);
