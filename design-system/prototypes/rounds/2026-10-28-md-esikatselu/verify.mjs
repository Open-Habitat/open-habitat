// Builds the round into its issue and checks it offline: every direction at 1440 and 390 px in
// light and dark. A long Markdown file is scrolled to its middle; ⌘⇧V (Ctrl+Shift+V) shows the
// preview in place of the text at the same section; Esc returns to the text where it was; the
// direction's own full-view control does the same; ⌘⌥V (Ctrl+Alt+V) shows it beside the text on
// a wide pane, and on a narrow pane (phone, or the conversation beside) the beside control is
// gone; typing updates the preview; the picker holds; nothing overflows horizontally; no
// console errors or network requests. Screenshots at device scale factor 2 into the issue.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NODE_PATH=<checkout>/web/node_modules \
//     node design-system/prototypes/rounds/2026-10-28-md-esikatselu/verify.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const req = createRequire(existsSync(path.join(root, 'web/node_modules')) ? path.join(root, 'web/package.json') : path.join(process.env.NODE_PATH || '', 'x.js'));
const { chromium } = req('@playwright/test');

const dir = path.join(root, 'issues/proto-markdown-full-preview-button/prototypes/markdown-preview');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['painike', 'valitsin', 'kelluva'];
const DIRS = ['two', 'seg', 'float'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const ready = (p, v) => p.waitForFunction((d) => document.querySelector('.md-demo')?.dataset.dir === d && !!document.querySelector('.md-rows .ln'), DIRS[v]);
const pick = async (p, v) => { await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click(); await ready(p, v); await p.waitForTimeout(150); };
const hidePicker = (p, on) => p.locator('.proto-picker').evaluate((n, on) => { n.style.visibility = on ? 'hidden' : ''; }, on);
async function shoot(p, file) { await hidePicker(p, true); await p.locator('.frame').screenshot({ path: path.join(out, file) }); await hidePicker(p, false); }
const shown = (p) => p.evaluate(() => window.__md.shown());
const visible = (p, sel) => p.locator(sel).first().isVisible();
async function noOverflow(p, tag) {
  for (const sel of ['.frame', '.md-toolbar', '.md-note', '.md-pv']) {
    const loc = p.locator(sel).first(); if (!(await loc.count()) || !(await loc.isVisible())) continue;
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
}
// Scrolls the text so that the given heading line is at the top.
const scrollSrcTo = (p, heading) => p.evaluate((h) => {
  const row = [...document.querySelectorAll('.md-rows .ln')].find(r => r.textContent === h);
  document.querySelector('.md-src').scrollTop = row.offsetTop;
}, heading);
// The heading the preview shows nearest its top edge.
const pvTopHeading = (p) => p.evaluate(() => {
  const pv = document.querySelector('.md-pv'); const top = pv.getBoundingClientRect().top;
  const hs = [...pv.querySelectorAll('h2,h3,h4')];
  return hs.reduce((best, h) => Math.abs(h.getBoundingClientRect().top - top) < Math.abs(best.getBoundingClientRect().top - top) ? h : best).textContent;
});
const srcTopLine = (p) => p.evaluate(() => {
  const src = document.querySelector('.md-src');
  return [...document.querySelectorAll('.md-rows .ln')].find(r => r.offsetTop + r.offsetHeight > src.scrollTop + 2)?.textContent;
});

let cases = 0;
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (width === 390) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, '2026-10-28-md-esikatselu');
    const full = theme === 'light';
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`, n = `${v + 1}-${NAMES[v]}-${size}-${theme}`;
      await pick(p, v);
      await p.selectOption('[data-set="kbd"]', 'mac'); await ready(p, v);
      await noOverflow(p, tag);
      // A long file in the middle: the text, and the full-view control in reach.
      await scrollSrcTo(p, '## Majoitus');
      await p.locator('.md-code textarea').focus();
      await p.locator('.md-src').evaluate(n => { n.scrollTop = [...n.querySelectorAll('.ln')].find(r => r.textContent === '## Majoitus').offsetTop; });
      assert.ok(await visible(p, '[data-act="only"]'), `${tag}: full-view control visible`);
      if (full) await shoot(p, `${n}-teksti.png`);
      // ⌘⇧V: preview in place of the text, at the same section, focus on the preview.
      await p.keyboard.press('Control+Shift+KeyV');
      assert.equal(await shown(p), 'only', `${tag}: shortcut opens the full view`);
      assert.ok(!(await visible(p, '.md-src')), `${tag}: text hidden`);
      assert.equal(await pvTopHeading(p), 'Majoitus', `${tag}: preview opens at the same section`);
      assert.ok(await p.evaluate(() => document.activeElement?.classList.contains('md-pv')), `${tag}: focus moves to the preview`);
      await noOverflow(p, tag + ' full');
      await shoot(p, `${n}-koko-nakyma.png`);
      // Reading on in the preview, Esc returns to the text at the section that was read.
      await p.locator('.md-pv').evaluate(pv => { pv.scrollTop = [...pv.querySelectorAll('h3')].find(h => h.textContent === 'Huolto').offsetTop - pv.firstElementChild.offsetTop; });
      await p.keyboard.press('Escape');
      assert.equal(await shown(p), 'off', `${tag}: Esc closes`);
      assert.equal(await srcTopLine(p), '## Huolto', `${tag}: text returns where the reading was`);
      assert.ok(await p.evaluate(() => document.activeElement?.matches('.md-code textarea')), `${tag}: focus back in the text`);
      // The direction's own control does the same, and pressing its other state returns.
      await p.locator('[data-act="only"]').first().click();
      assert.equal(await shown(p), 'only', `${tag}: control opens the full view`);
      if (v === 0) assert.equal(await p.locator('[data-act="only"]').getAttribute('aria-pressed'), 'true', `${tag}: pressed`);
      if (v === 2) assert.ok(await visible(p, '.fab[data-act="off"]'), `${tag}: Muokkaa in the corner`);
      if (full) await shoot(p, `${n}-painikkeella.png`);
      await p.locator(v === 0 ? '[data-act="only"]' : '[data-act="off"]').first().click();
      assert.equal(await shown(p), 'off', `${tag}: control returns to the text`);
      if (size === 'desktop') {
        // ⌘⌥V: beside the text on a wide pane.
        await p.locator('.md-code textarea').focus();
        await p.keyboard.press('Control+Alt+KeyV');
        assert.equal(await shown(p), 'side', `${tag}: beside shortcut`);
        assert.ok(await visible(p, '.md-src') && await visible(p, '.md-pv'), `${tag}: both panes`);
        // Typing updates the preview.
        if (full) {
          await p.locator('.md-code textarea').evaluate(t => { t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
          await p.keyboard.type('\n## Paluukyyti\n');
          await p.waitForFunction(() => [...document.querySelectorAll('.md-pv h3')].some(h => h.textContent === 'Paluukyyti'));
          assert.equal(await p.locator('.md-state').innerText(), 'Muokattu', `${tag}: edited`);
          await shoot(p, `${n}-rinnakkain.png`);
          // The shortcut hint on hover.
          await p.locator('[data-act="only"]').first().hover(); await p.waitForTimeout(150);
          await shoot(p, `${n}-vihje.png`);
          await p.mouse.move(5, 5);
        }
        await p.locator('.md-code textarea').focus();
        await p.keyboard.press('Control+Alt+KeyV');
        assert.equal(await shown(p), 'off', `${tag}: beside shortcut closes`);
        // Conversation beside: the pane is narrow, the beside control is gone, full view stays.
        if (full) {
          await p.selectOption('[data-set="conv"]', '1');
          await p.waitForFunction(() => document.querySelector('.md-editor')?.dataset.narrow === 'true');
          assert.equal(await p.locator('.md-toolbar [data-act="side"]:visible, .md-fab [data-act="side"]:visible').count(), 0, `${tag}: no beside control on a narrow pane`);
          await p.locator('[data-act="only"]').first().click();
          assert.equal(await shown(p), 'only', `${tag}: full view beside the conversation`);
          await noOverflow(p, tag + ' conversation');
          await shoot(p, `${n}-keskustelu-rinnalla.png`);
          await p.selectOption('[data-set="conv"]', '0');
        }
      } else {
        assert.equal(await p.locator('[data-act="side"]:visible').count(), 0, `${tag}: no beside control on the phone`);
      }
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×size×theme cases; ⌘⇧V opens the preview in place at the same section; Esc returns to where the reading was; own control; ⌘⌥V beside; typing updates; narrow pane hides beside; picker; no overflow, console errors or network requests.`);
} finally { await browser.close(); }
