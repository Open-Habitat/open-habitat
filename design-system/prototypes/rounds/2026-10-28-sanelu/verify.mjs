// Builds the round into its issue and checks it offline: every direction at 1440 and 390 px in
// light and dark; a long dictation shows confirmed text and a dimmed guess in the field and the
// recording pill in the row; Valmis puts the text back into an editable field; each direction's
// ceiling approaches and ends the way its axis says (Katto: note at 25 min, ends at 30:00;
// Hiljaisuus: note after 2 min of silence, ends at 3 min; Jatkokysymys: question at 25 min,
// Jatka keeps going, no answer ends at 30 min); the shared error and no-key states; the
// picker holds; nothing overflows horizontally; no console errors or network requests.
// Screenshots at device scale factor 2 into the issue's evidence directory.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NODE_PATH=<checkout>/web/node_modules \
//     node design-system/prototypes/rounds/2026-10-28-sanelu/verify.mjs
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

const dir = path.join(root, 'issues/proto-speech-input/prototypes/speech-input');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['katto', 'hiljaisuus', 'jatkokysymys'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const pick = async (p, v) => { await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click(); await p.waitForFunction((v) => document.querySelector('.composer').dataset.dir === ['cap', 'silence', 'ask'][v], v); await p.waitForTimeout(200); };
const hidePicker = (p, on) => p.locator('.proto-picker').evaluate((n, on) => { n.style.visibility = on ? 'hidden' : ''; }, on);
async function shoot(p, file) { await p.evaluate(() => document.querySelector('.toast')?.classList.remove('on')); await hidePicker(p, true); await p.locator('.frame').screenshot({ path: path.join(out, file) }); await hidePicker(p, false); }
const scene = async (p, id, wait = 350) => { await p.selectOption('#sp-scene', id); await p.waitForTimeout(wait); };
const speed = (p, s) => p.evaluate((s) => window.__sp.speed(s), s);
const t = (p) => p.evaluate(() => window.__sp.D.t);
const phase = (p) => p.evaluate(() => window.__sp.D.phase);
const waitPhase = (p, ph, ms = 8000) => p.waitForFunction((ph) => window.__sp.D.phase === ph, ph, { timeout: ms });
const text = (p, sel) => p.locator(sel).first().innerText();
async function noOverflow(p, tag) {
  for (const sel of ['.frame', 'body', '#stage', '.composer', '.sp-row', '.sp-above', '.sp-below']) {
    const loc = p.locator(sel).first(); if (!(await loc.count()) || !(await loc.isVisible())) continue;
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
}
// The live turn plays on mount; pictures are taken once the agent has finished.
const settle = (p) => p.waitForFunction(() => !document.querySelector('.turn.live.working'), null, { timeout: 30000 });

let cases = 0;
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (width === 390) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, '2026-10-28-sanelu');
    const full = theme === 'light';
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`, n = `${v + 1}-${NAMES[v]}-${size}-${theme}`;
      await pick(p, v);
      await settle(p);
      // At rest: the mic sits in the row.
      assert.ok(await p.locator('.sp-mic').isVisible(), `${tag}: mic in the row`);
      // Long dictation: confirmed text, a guess after it, the pill with time.
      await scene(p, 'long', 900); await speed(p, 0);
      assert.equal(await phase(p), 'live', `${tag}: dictating`);
      assert.ok((await text(p, '.sp-final')).length > 2000, `${tag}: twelve minutes of text`);
      assert.ok(/\n\n/.test(await text(p, '.sp-final')), `${tag}: pauses start paragraphs`);
      assert.ok(/^12:0\d$/.test(await text(p, '.sp-time')), `${tag}: pill time`);
      assert.ok(await p.locator('.sp-pill').isVisible(), `${tag}: pill visible`);
      await noOverflow(p, tag + ' long');
      await shoot(p, `${n}-pitka-sanelu.png`);
      // The ceiling approaches.
      await scene(p, 'warn', 300); await speed(p, 10);
      await p.waitForSelector('.sp-note, .sp-ask', { timeout: 8000 }); await speed(p, 0);
      const warn = await text(p, '.sp-above');
      if (v === 0) assert.ok(/Sanelu päättyy 4:5\d kuluttua/.test(warn), `${tag}: cap note`);
      if (v === 1) assert.ok(/Hiljaista 2:0\d/.test(warn), `${tag}: silence note`);
      if (v === 2) assert.ok(/Jatketaanko sanelua\?/.test(warn) && /25:00/.test(warn), `${tag}: ask card`);
      await noOverflow(p, tag + ' warn');
      await shoot(p, `${n}-katto-lahestyy.png`);
      if (full || size === 'phone') {
        // The ceiling ends the dictation; the text is in an editable field with the reason below.
        await scene(p, 'end', 300); await speed(p, 10);
        await waitPhase(p, 'idle', 10000);
        const ta = p.locator('textarea.sp-field');
        assert.ok(await ta.isVisible(), `${tag}: editable field after the end`);
        assert.ok((await ta.inputValue()).length > 2000, `${tag}: text kept`);
        const why = await text(p, '.sp-below');
        assert.ok([/30 minuutin kattoon/, /hiljaista 3 minuuttia/, /jatkoon ei vastattu/][v].test(why), `${tag}: end reason`);
        await noOverflow(p, tag + ' end');
        await shoot(p, `${n}-katto-paattyi.png`);
        await p.getByRole('button', { name: 'Jatka sanelua' }).click();
        await waitPhase(p, 'live');
        await p.locator('.sp-pill').click();
        await waitPhase(p, 'idle');
      }
      if (full && v === 2) {
        // Jatka keeps the same dictation going and moves the next question.
        await scene(p, 'warn', 300); await speed(p, 10);
        await p.waitForSelector('.sp-ask'); await speed(p, 0);
        await p.getByRole('button', { name: 'Jatka sanelua' }).click();
        assert.equal(await phase(p), 'live', `${tag}: continue keeps dictating`);
        assert.ok(/Kysyn uudelleen 50:00 kohdalla/.test(await text(p, '.sp-above')), `${tag}: next question`);
        await shoot(p, `${n}-jatkettu.png`);
      }
      if (full && v > 0) {
        await scene(p, 'back', 300); await speed(p, 10);
        await p.waitForSelector('[data-note="backstop"]', { timeout: 8000 }); await speed(p, 0);
        assert.ok(/enimmäispituus/.test(await text(p, '.sp-above')), `${tag}: backstop note`);
        if (size === 'desktop') await shoot(p, `${n}-takaraja.png`);
      }
      if (full && v === 0) {
        // Tap mic, words arrive as a guess first, Valmis returns an editable field.
        await scene(p, 'rest', 100);
        await p.locator('.sp-mic').click();
        await waitPhase(p, 'live'); await speed(p, 1);
        await p.waitForFunction(() => document.querySelector('.sp-int').textContent.length > 0);
        await p.waitForFunction(() => document.querySelector('.sp-final').textContent.length > 0, null, { timeout: 8000 });
        await speed(p, 0);
        await shoot(p, `${n}-alku.png`);
        await p.locator('.sp-pill').click();
        await waitPhase(p, 'idle');
        assert.ok(/^Okei, aloitetaan/.test(await p.locator('textarea.sp-field').inputValue()), `${tag}: text in the field`);
        // A pause shows in the pill.
        await scene(p, 'pause', 300); await speed(p, 0);
        assert.ok(/tauko 0:\d\d/.test(await text(p, '.sp-state')), `${tag}: pause in the pill`);
        await shoot(p, `${n}-tauko.png`);
        // Dictation continues typed text.
        await scene(p, 'draft', 1200); await speed(p, 0);
        assert.ok(/^Kaksi korjausta edelliseen: /.test(await text(p, '.sp-live')), `${tag}: appends to typed text`);
        // Send while dictating: stops, then sends.
        await speed(p, 1); await p.waitForFunction(() => document.querySelector('.sp-final').textContent.length > 0, null, { timeout: 8000 });
        await p.locator('.sp-send').click();
        await waitPhase(p, 'idle');
        await p.waitForFunction(() => [...document.querySelectorAll('.bubble.user')].some(b => /Kaksi korjausta edelliseen/.test(b.textContent)));
        // Connection drops and comes back; then it does not.
        await scene(p, 'drop', 300); await speed(p, 1);
        await waitPhase(p, 'reconnecting'); await shoot(p, `${n}-yhdistetaan-uudelleen.png`);
        await waitPhase(p, 'live', 4000);
        await scene(p, 'dropfail', 300); await speed(p, 1);
        await waitPhase(p, 'idle', 8000);
        assert.ok(/yhteys Sonioxiin ei palannut/.test(await text(p, '.sp-below')), `${tag}: drop notice`);
        await shoot(p, `${n}-yhteys-katkesi.png`);
      }
      if (v === 0 && (full || size === 'phone')) {
        for (const [id, re] of [['nokey', /tarvitsee Soniox-avaimen/], ['mic', /ei antanut mikrofonia/], ['rejected', /hylkäsi avaimen/], ['limit', /10 sanelua käynnissä/]]) {
          await scene(p, id, 900);
          assert.ok(re.test(await text(p, '.sp-below')), `${tag}: ${id}`);
          assert.equal(await phase(p), 'idle', `${tag}: ${id} leaves the field usable`);
          await noOverflow(p, `${tag} ${id}`);
          if (theme === 'light' || id === 'nokey') await shoot(p, `${n}-${id}.png`);
        }
        await p.getByRole('button', { name: 'Avaa asetukset' }).first().click();
      }
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×size×theme cases; long dictation with guess and pill; ceiling note and end per direction; Jatka; backstop; start, pause, typed text, send while dictating; reconnect and drop; no key, mic, rejected, limit; picker; no overflow, console errors or network requests.`);
} finally { await browser.close(); }
