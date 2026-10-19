#!/usr/bin/env node
// Key-state screenshots and keyboard-flow checks for this round: check.mjs only clicks, and
// these states need typing and a turn of Pi's work in progress.
//
//   node rounds/2026-10-19-koko-alakerta/shots.mjs <page.html> --out <dir> [--flows-only] [--modes desk-light,phone-light,...]
//
// Every direction in light at desktop width, a subset in dark and at phone width. The turn is
// played slowed down ("Hidastettu") so the working states hold still for the screenshot. Then
// keyboard-only flows run in every direction and assert the outcome. Exits 1 on console errors
// or a failed check.
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(join(here, '../../../../web/node_modules/playwright/index.mjs'));
const args = process.argv.slice(2);
const flowsOnly = args.includes('--flows-only');
const onlyModes = args.includes('--modes') ? args[args.indexOf('--modes') + 1].split(',') : null;
const file = resolve(args[0]); const out = resolve(args[args.indexOf('--out') + 1]);
mkdirSync(out, { recursive: true });

const type = (p, s) => p.keyboard.type(s, { delay: 12 });
const field = (p) => p.locator('.composer textarea');
const working = (p) => p.evaluate(() => UI.working);
const clearField = async (p) => { await p.evaluate(() => { const t = document.querySelector('.composer textarea'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); }); await field(p).focus(); };
// Back to a settled conversation in direction d: replay the direction and wait for the turn to end.
const settle = async (p, d) => {
  // Unchecking "Hidastettu" focuses the checkbox, and the picker ignores keys in inputs: blur after it.
  await p.uncheck('#slow');
  await p.evaluate(() => { if (UI.sel !== 'c1') openConv('c1'); document.activeElement?.blur(); });
  await p.waitForTimeout(100);
  await p.keyboard.press(String(d));
  await p.waitForFunction(() => UI.working, null, { timeout: 3000 }).catch(() => {});
  await p.waitForFunction(() => !UI.working && !stage.querySelector('.turn.live.working'), null, { timeout: 120000 });
  await p.waitForTimeout(150); await clearField(p);
};
const toWork = async (p) => { await p.check('#slow'); await p.click('#a-work'); await p.waitForFunction(() => UI.working, null, { timeout: 5000 }); await p.waitForTimeout(1200); await field(p).focus(); };
const STATES = [
  ['1-idle', async () => {}],
  ['2-idle-text', async (p) => { await type(p, 'Lisää --today-lippu ja testi kiinteällä päivämäärällä.'); }],
  ['3-working', async (p) => { await toWork(p); }],
  ['4-working-text', async (p) => { await toWork(p); await type(p, 'Älä muuta testien odotusarvoja.'); }],
  ['5-queued', async (p) => { await toWork(p); await type(p, 'Älä muuta testien odotusarvoja.'); await p.keyboard.press('Enter'); await type(p, 'Kun olet valmis, aja koko testisarja ja näytä yhteenveto.'); await p.keyboard.press('Alt+Enter'); await type(p, 'Päivitä myös README'); }],
  ['6-menu', async (p, d) => { if (d !== 2) return false; await toWork(p); await type(p, 'Päivitä myös README'); await p.click('[data-a="menu"]'); }],
  ['7-shell', async (p) => { await toWork(p); await type(p, '!git status'); }],
  ['8-shell-running', async (p) => { await type(p, '!make serve'); await p.keyboard.press('Enter'); await p.waitForTimeout(4600); }],
  ['9-stopped', async (p) => { await toWork(p); await type(p, 'Kun olet valmis, aja koko testisarja.'); await p.keyboard.press('Alt+Enter'); await p.locator('[data-a="stop"]').first().click(); await p.waitForTimeout(300); }],
  ['10-new', async (p) => { await type(p, '/uusi'); await p.keyboard.press('Enter'); await p.waitForTimeout(500); await type(p, 'Tee kiintiönäkymän tekstit'); }],
];
const PLAN = {
  'desk-light': null,
  'desk-dark': ['1-idle', '5-queued', '6-menu', '8-shell-running'],
  'phone-light': ['1-idle', '3-working', '5-queued', '6-menu', '8-shell-running', '10-new'],
  'phone-dark': ['5-queued'],
};

// Keyboard only. [label, steps, check] — check returns true or a description of what was seen.
const FLOW = [
  ['levossa Enter lähettää', async (p) => { const n = await p.locator('.bubble.user').count(); await type(p, 'Hei'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); return (await p.locator('.bubble.user').count()) === n + 1 || 'kupla ei lisääntynyt'; }],
  ['työn aikana Enter ohjaa', async (p) => { await toWork(p); await type(p, 'ohjaus'); await p.keyboard.press('Enter'); const q = await p.evaluate(() => C.queue.map(q => q.kind).join()); return q === 'steer' || q; }],
  [`työn aikana Alt+Enter työn jälkeen`, async (p) => { await toWork(p); await type(p, 'jälkeen'); await p.keyboard.press('Alt+Enter'); const q = await p.evaluate(() => C.queue.map(q => q.kind).join()); return q === 'follow' || q; }],
  ['tavan vaihto näppäimistöllä, sitten Enter', async (p) => {
    await toWork(p); await type(p, 'jonoon');
    // Reach the mode control by Tab from the field and switch it. Työnauha's band is before
    // the field, so there it is Shift+Tab.
    for (let i = 0; i < 8; i++) { await p.keyboard.press(p.dir === 3 ? 'Shift+Tab' : 'Tab'); const a = await p.evaluate(() => document.activeElement?.dataset?.a); if (a === 'toggle' || a === 'mode' || a === 'menu') break; }
    const a = await p.evaluate(() => document.activeElement?.dataset?.a);
    if (a === 'toggle') await p.keyboard.press('Enter');
    else if (a === 'mode') await p.keyboard.press('ArrowRight');
    else if (a === 'menu') { await p.keyboard.press('Enter'); await p.waitForTimeout(100); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); }
    else return `tavan valitsinta ei tavoitettu Tabilla (${a})`;
    await field(p).focus(); await p.keyboard.press('Enter');
    const q = await p.evaluate(() => C.queue.map(q => q.kind).join()); return q === 'follow' || q;
  }],
  ['Esc tyhjässä kentässä pysäyttää Pi:n, jono palaa kenttään', async (p) => { await toWork(p); await type(p, 'jälkeen'); await p.keyboard.press('Alt+Enter'); await p.keyboard.press('Escape'); await p.waitForTimeout(200); const w = await working(p); const v = await field(p).inputValue(); return (!w && v === 'jälkeen') || `working=${w} kenttä=${JSON.stringify(v)}`; }],
  ['Palauta kenttään', async (p) => { await toWork(p); await type(p, 'yksi'); await p.keyboard.press('Alt+Enter'); await type(p, 'kaksi'); await p.keyboard.press('Alt+Enter'); await p.locator('[data-a="restore"]').click(); const v = await field(p).inputValue(); return v === 'yksi\n\nkaksi' || JSON.stringify(v); }],
  ['! Enter ajaa, Esc pysäyttää komennon', async (p) => { await type(p, '!make serve'); await p.keyboard.press('Enter'); await p.waitForTimeout(600); await field(p).focus(); await p.keyboard.press('Escape'); await p.waitForTimeout(150); return (await p.locator('.x-run .x-st.stop').count()) === 1 || 'ei pysäytetty'; }],
  ['/rev Enter → komento viestin alkuun', async (p) => { await type(p, '/rev'); await p.keyboard.press('Enter'); const v = await field(p).inputValue(); return v === '/review ' || JSON.stringify(v); }],
];

const browser = await chromium.launch(); const errors = []; const fails = []; let n = 0;
for (const [mode, only] of Object.entries(PLAN)) {
  if ((flowsOnly && mode !== 'desk-light') || (onlyModes && !onlyModes.includes(mode))) continue;
  const [form, theme] = mode.split('-');
  const p = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('console', m => m.type() === 'error' && errors.push(`${mode}: ${m.text()}`));
  p.on('pageerror', e => errors.push(`${mode}: ${e}`));
  await p.goto('file://' + file);
  // The fixed direction picker would cover the phone frame's composer; keys still switch.
  await p.addStyleTag({ content: '.proto-picker{display:none!important}' });
  await p.selectOption('#theme', theme);
  if (form === 'phone') await p.check('#phone');
  for (const d of [1, 2, 3]) {
    for (const [name, steps] of STATES) {
      if (flowsOnly || (only && !only.includes(name))) continue;
      await settle(p, d);
      if (await steps(p, d) === false) continue;
      await p.waitForTimeout(250);
      await p.locator('.frame').screenshot({ path: join(out, `${mode}-v${d}-${name}.png`) }); n++;
    }
    if (mode === 'desk-light') for (const [label, steps] of FLOW) {
      await settle(p, d); p.dir = d;
      const r = await steps(p);
      if (r !== true) fails.push(`v${d} ${label}: ${r}`);
    }
  }
  await p.close();
}
await browser.close();
console.log(`${n} kuvaa → ${out}`);
const flowsRan = !onlyModes || onlyModes.includes('desk-light');
console.log(fails.length ? 'Näppäimistövirrat epäonnistuivat:\n' + fails.join('\n') : flowsRan ? `Näppäimistövirrat: ${FLOW.length} × 3 suuntaa läpi.` : 'Näppäimistövirtoja ei ajettu (vain desk-light).');
if (errors.length) console.log('Konsolivirheet:\n' + errors.join('\n')); else console.log('Konsoli puhdas.');
if (errors.length || fails.length) process.exit(1);
