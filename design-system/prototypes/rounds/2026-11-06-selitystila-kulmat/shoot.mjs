// Checks round 8's built page and takes the issue's screenshots (DSF 2, PNG;
// turn them into AVIF with scripts/screenshots-to-avif.py). Every riff, view,
// width (riff 1 also dark): each explainable part is pointed at (desktop) or
// tapped (phone) and its card stays inside the view; in a conversation the
// state card shows when the mode opens and stays inside the view.
// Round 7's presses still hold (a press does what it does and the mode stays
// on; a lasting one waits; the state card's rows; the ? and the ? key; a
// phone's two taps; Esc, Lopeta, the strip, the all-cards page). Round 8's
// corner cases: the empty band above the field explains nothing; an invisible
// hover-only button never explains; each riff's empty space and hidden
// controls behave as its line says, on desktop and phone. The shared picker
// check; a clean console.
//   node design-system/prototypes/rounds/2026-11-06-selitystila-kulmat/shoot.mjs [evidence-dir]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '../../../../web/node_modules/@playwright/test/index.mjs';
import { checkPicker } from '../../picker-check.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const file = pathToFileURL(path.join(root, 'issues/proto-explain-mode-r6/prototype/kierros-8/selitystila-kulmat.html')).href;
const shots = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const stats = { explained: 0, views: 0, covered: 0, stateCards: 0, stateCoversAnchor: [], unreachable: [], outside: [], seen: new Set() };

async function open(q, { width = 1480, height = 1000, dsf = 1 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dsf });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${q}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${q}: ${e.message}`));
  await page.goto(`${file}?${q}`);
  await page.waitForFunction(() => window.PROTO_READY);
  await page.waitForTimeout(300);
  return page;
}
const frameOf = async (page) => {
  await page.waitForTimeout(150);
  const el = await page.waitForSelector('.pc-scale iframe');
  const frame = await el.contentFrame();
  await frame.waitForFunction(() => window.XM);
  return { frame, box: await el.boundingBox() };
};
const viewOf = (page) => page.evaluate(() => new URL(location).searchParams.get('view'));
const modeOn = async (page) => !!(await page.$('.xm-bar:not([hidden])'));
const check = (ok, msg) => { if (!ok) errors.push(msg); };

const META = JSON.parse(await (async () => {
  const p = await open('page=tila');
  const v = await p.evaluate(() => JSON.stringify({ views: META.views, cards: META.cards.map((c) => c.id), states: Object.values(META.states).map((s) => ({ id: s.id, views: s.views })) }));
  await checkPicker(p, '2026-11-06-selitystila-kulmat');
  await p.close();
  return v;
})());
const stateViews = new Set(META.states.flatMap((s) => s.views));

// Every part of every view, and the state card.
for (const riff of [1, 2, 3]) {
  for (const v of META.views) for (const w of v.widths) for (const theme of riff === 1 ? ['light', 'dark'] : ['light']) {
    const phone = w <= 800;
    const page = await open(`page=tila&v=${riff}&view=${v.id}&w=${w}&theme=${theme}&explain=on&pt=`, { width: phone ? 420 : 1480, height: phone ? 2100 : 1400 });
    const { frame, box } = await frameOf(page);
    stats.views++;
    if (stateViews.has(v.id)) {
      const st = await frame.evaluate(() => {
        const c = document.querySelector('.xm-card.xm-state');
        if (!c) return null;
        const r = c.getBoundingClientRect(), a = XM.stateRect();
        const over = a ? Math.max(0, Math.min(r.right, a.x + a.w) - Math.max(r.left, a.x)) * Math.max(0, Math.min(r.bottom, a.y + a.h) - Math.max(r.top, a.y)) : 0;
        return { ok: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, anchor: !!a, over: a ? over / (a.w * a.h) : 0 };
      });
      if (!st) errors.push(`${v.id}-${w} riff ${riff}: no state card`);
      else {
        stats.stateCards++;
        if (!st.ok) stats.outside.push(`${v.id}-${w}-${theme} state`);
        if (!st.anchor) errors.push(`${v.id}-${w}: the state's anchor is not on screen`);
        if (st.over > 0.5) stats.stateCoversAnchor.push(`${v.id}-${w} ${Math.round(st.over * 100)} %`);
      }
    }
    const targets = await frame.evaluate(() => {
      const seen = new Map();
      for (const t of XM.targets()) { if (!seen.has(t.id)) seen.set(t.id, []); seen.get(t.id).push({ x: t.x, y: t.y, w: t.w, h: t.h }); }
      return [...seen.entries()];
    });
    for (const [id, rects] of targets) {
      // On a phone the state card is closed first (its ×), as a person would.
      if (phone) await frame.evaluate(() => { XM.state.hover = null; XM.state.stateHidden = true; XM.draw(); });
      const { point, shows } = await frame.evaluate(([id, rects]) => {
        let shows = false;
        for (const r of rects) for (const fx of [0.5, 0.2, 0.8, 0.05, 0.95]) for (const fy of [0.5, 0.2, 0.8, 0.1, 0.9]) {
          const x = r.x + r.w * fx, y = r.y + r.h * fy;
          const top = XM.under(x, y);
          const t = XM.targets().find((q) => q.id === id && x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
          if (top && t && t.el.contains(top)) shows = true;
          // Not under the state card, which takes the pointer.
          const sc = document.querySelector('.xm-card.xm-state')?.getBoundingClientRect();
          if (sc && x >= sc.left && x <= sc.right && y >= sc.top && y <= sc.bottom) continue;
          if (XM.hit(x, y)?.id === id && !top?.closest('[data-xm-toggle]')) return { point: { x, y }, shows: true };
        }
        return { point: null, shows };
      }, [id, rects]);
      if (!point) {
        if (shows && !['X01', 'X03', 'X04', 'X05', 'X06'].includes(id)) {
          // A part under the state card is reached once the pointer is elsewhere.
          const ok = await frame.evaluate((id) => { XM.state.hover = id; XM.draw(); return document.querySelector('.xm-card')?.dataset.card === id; }, id);
          if (!ok) stats.unreachable.push(`${v.id}-${w} ${id}`); else stats.explained++;
          await frame.evaluate(() => { XM.state.hover = null; XM.draw(); });
        } else stats.covered++;
        continue;
      }
      const x = box.x + point.x, y = box.y + point.y;
      if (phone) {
        await page.mouse.click(x, y);
      } else await page.mouse.move(x, y);
      if (!frame.parentFrame() || frame.isDetached()) { errors.push(`${v.id}-${w} riff ${riff} ${id}: the tap changed the view`); break; }
      const card = await frame.evaluate(() => {
        const c = document.querySelector('.xm-card:not(.xm-state)');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { id: c.dataset.card, ok: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
      });
      // A phone's first tap only explains: the view must not change.
      if (phone && (await viewOf(page)) !== v.id) errors.push(`${v.id}-390 ${id}: the first tap acted`);
      if (!card || card.id !== id) { stats.unreachable.push(`${v.id}-${w} ${id} (card ${card?.id})`); continue; }
      if (!card.ok) stats.outside.push(`${v.id}-${w}-${theme} ${id}`);
      stats.explained++;
      if (riff === 1) stats.seen.add(id);
    }
    await page.close();
  }
}

const at = (frame, id) => frame.evaluate((id) => { const t = XM.findTarget(id); return t && { x: t.x + t.w / 2, y: t.y + t.h / 2 }; }, id);
async function press(page, id) {
  const { frame, box } = await frameOf(page);
  const p = await at(frame, id);
  if (!p) return errors.push(`press: ${id} is not on screen in ${await viewOf(page)}`);
  await page.mouse.move(box.x + p.x, box.y + p.y);
  await page.mouse.click(box.x + p.x, box.y + p.y);
  await page.waitForTimeout(400);
}

const center = (frame, sel) => frame.evaluate((sel) => { const el = document.querySelector(sel); const r = el?.getBoundingClientRect(); return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, sel);
// Every riff: the ? opens the mode on the state; presses keep working; the ? key ends it.
for (const riff of [1, 2, 3]) {
  const page = await open(`page=tila&v=${riff}&view=kaynnissa&w=1440&explain=off&pt=`, { height: 1400 });
  let { frame, box } = await frameOf(page);
  const b = await center(frame, '[data-xm-help]');
  await page.mouse.click(box.x + b.x, box.y + b.y);
  await page.waitForTimeout(300);
  check(await modeOn(page) && await frame.$('.xm-card.xm-state[data-card="vuorosi"]'), `riff ${riff}: ? did not open the mode on the state`);
  await press(page, 'K04');
  check((await viewOf(page)) === 'kaynnissa-auki' && await modeOn(page), `riff ${riff}: a press on 1 ajatus ja 3 työkalua did not open it in the mode`);
  await press(page, 'K05');
  check((await viewOf(page)) === 'kaynnissa-tuloste' && await modeOn(page), `riff ${riff}: a press on a tool row did not open it in the mode`);
  await press(page, 'Y11');
  check((await viewOf(page)) === 'kaynnissa-tuloste' && await modeOn(page), `riff ${riff}: Arkistoi acted in the mode`);
  ({ frame } = await frameOf(page));
  check(await frame.$('.xm-toast'), `riff ${riff}: Arkistoi in the mode said nothing`);
  await frame.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })));
  await page.waitForTimeout(200);
  check(!(await modeOn(page)), `riff ${riff}: the ? key did not end the mode`);
  await page.close();
}
// The state card's rows press their part; Lopeta and Esc end the mode.
{
  const page = await open('page=tila&v=1&view=kaynnissa&w=1440&explain=on&pt=', { height: 1400 });
  const { frame } = await frameOf(page);
  await frame.click('.xm-state [data-xm-can="K04"]');
  await page.waitForTimeout(400);
  check((await viewOf(page)) === 'kaynnissa-auki' && await modeOn(page), 'the state card\'s row did not open the agent\'s work');
  await page.click('[data-xm-end]');
  await page.waitForTimeout(200);
  check(!(await modeOn(page)), 'Lopeta did not end the mode');
  await page.close();
  const p2 = await open('page=tila&v=2&view=kaynnissa&w=1440&explain=on&pt=', { height: 1400 });
  const f2 = (await frameOf(p2)).frame;
  await f2.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await p2.waitForTimeout(200);
  check(!(await modeOn(p2)), 'Esc did not end the mode');
  await p2.close();
}

// ---- round 8: the corner cases
const stats8 = {};
// Move through a preset path (the frame's own spots) with the real mouse.
async function walk(page, name) {
  const { frame, box } = await frameOf(page);
  const path = await frame.evaluate((n) => XM.spot(n), name);
  if (!path?.length) { errors.push(`spot ${name} missing in ${await viewOf(page)}`); return { frame, box, last: null }; }
  for (const q of path) { await page.mouse.move(box.x + q.x, box.y + q.y, { steps: 4 }); await page.waitForTimeout(80); }
  return { frame, box, last: path[path.length - 1] };
}
const now = (frame) => frame.evaluate(() => ({ card: document.querySelector('.xm-card')?.dataset.card || null, state: !!document.querySelector('.xm-card.xm-state'), linger: !!document.querySelector('.xm-card.xm-linger'), chip: document.querySelector('.xm-chip')?.textContent || null, also: document.querySelectorAll('.xm-also li').length, ids: XM.ids(), archiveShown: [...document.querySelectorAll('.ah-rail [data-testid="rail-archive-conversation"]')].some((el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o > 0.5; }) }));
for (const riff of [1, 2, 3]) {
  for (const theme of ['light', 'dark']) {
    // The empty band above the field: nothing of it explains in any riff.
    const page = await open(`page=tila&v=${riff}&view=kaynnissa&w=1440&theme=${theme}&explain=on&pt=`, { height: 1400 });
    let { frame, last } = await walk(page, 'tyhja-kentta');
    let n = await now(frame);
    check(n.card !== 'V09', `riff ${riff}: the empty band above the field still explains Taustatyö`);
    if (riff === 1) check(n.linger && n.card === 'V10', `riff 1: the last card did not stay over empty space (${n.card})`);
    if (riff === 2) check(!n.card && !n.chip, `riff 2: empty space showed ${n.card || n.chip}`);
    if (riff === 3) check(n.chip?.includes(theme === 'light' ? 'Viestikenttä' : 'Viestikenttä') && !n.card, `riff 3: empty space above the field did not name its area (${n.chip})`);
    // The first row's hidden controls.
    const fresh = await now(frame);
    check(riff === 2 ? fresh.ids.includes('S13') : !fresh.ids.includes('S13'), `riff ${riff}: an invisible Arkistoi ${riff === 2 ? 'is not shown' : 'still explains'} before the row is pointed at`);
    ({ frame } = await walk(page, 'piilo'));
    n = await now(frame);
    if (riff === 3) check(n.card === 'S09' && n.also === 2 && !n.archiveShown, `riff 3: the row's card did not list its two hidden controls (${n.card}, ${n.also})`);
    else check(n.card === 'S13' && n.archiveShown, `riff ${riff}: the row's Arkistoi was not reached (${n.card}, shown ${n.archiveShown})`);
    // Riff 1: from the hidden button to empty space, the row stays awake with its card.
    if (riff === 1) {
      ({ frame } = await walk(page, 'tyhja-keskustelu'));
      n = await now(frame);
      check(n.card === 'K01' || n.linger, `riff 1: empty conversation space did not keep the last card (${n.card})`);
    }
    // Riff 3: empty conversation space is the state; a click there opens the state card.
    if (riff === 3) {
      ({ frame, last } = await walk(page, 'tyhja-keskustelu'));
      n = await now(frame);
      check(n.chip?.includes('Odottaa sinua'), `riff 3: empty conversation space did not show the state line (${n.chip})`);
      const { box } = await frameOf(page);
      await page.mouse.click(box.x + last.x, box.y + last.y);
      await page.waitForTimeout(200);
      check((await now(frame)).state, 'riff 3: a click on empty conversation space did not open the state card');
    }
    await page.close();
  }
  // Phone: hidden controls always show (touch); a tap on empty space per riff.
  {
    const page = await open(`page=tila&v=${riff}&view=sivupalkki&w=390&explain=on&pt=piilo`, { width: 420, height: 2100 });
    const { frame } = await frameOf(page);
    const n = await now(frame);
    check(n.card === 'S13' && n.archiveShown, `riff ${riff} phone: Arkistoi did not show and explain on tap (${n.card})`);
    await page.close();
    const p2 = await open(`page=tila&v=${riff}&view=kaynnissa&w=390&explain=on&pt=`, { width: 420, height: 2100 });
    const f2 = (await frameOf(p2)).frame;
    await press(p2, 'K04');
    const { box } = await frameOf(p2);
    const e = await f2.evaluate(() => XM.spot('tyhja-kentta').pop());
    await p2.mouse.click(box.x + e.x, box.y + e.y);
    await p2.waitForTimeout(200);
    const m = await now(f2);
    if (riff === 1) check(m.card === 'K04', `riff 1 phone: a tap on empty space did not keep the card (${m.card})`);
    if (riff === 2) check(!m.card, `riff 2 phone: a tap on empty space did not clear the card (${m.card})`);
    if (riff === 3) check(m.chip?.includes('Viestikenttä'), `riff 3 phone: a tap on empty space did not name the area (${m.chip})`);
    await p2.close();
  }
}

// Phone: the first tap explains, the second does it; the card's button does it too.
{
  const page = await open('page=tila&v=1&view=kaynnissa&w=390&explain=on&pt=', { width: 420, height: 2100 });
  await press(page, 'K04');
  let { frame } = await frameOf(page);
  check((await viewOf(page)) === 'kaynnissa' && await frame.$('.xm-card[data-card="K04"] [data-xm-do]'), 'phone: the first tap did not explain K04 with a button');
  await press(page, 'K04');
  check((await viewOf(page)) === 'kaynnissa-auki' && await modeOn(page), 'phone: the second tap did not open the work');
  await press(page, 'K05');
  ({ frame } = await frameOf(page));
  await frame.click('[data-xm-do]');
  await page.waitForTimeout(400);
  check((await viewOf(page)) === 'kaynnissa-tuloste', 'phone: the card\'s button did not open the tool row');
  await page.close();
}
// The start page's strip still starts the mode.
{
  const page = await open('page=tila&v=1&view=uusi&w=390&explain=off&pt=', { width: 420, height: 2100 });
  const { frame, box } = await frameOf(page);
  const go = await frame.evaluate(() => { const b = document.querySelector('.xm-strip-go').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.click(box.x + go.x, box.y + go.y);
  await page.waitForTimeout(200);
  check(await modeOn(page) && await frame.$('.xm-card.xm-state[data-card="alku"]'), 'the strip did not start the mode on the state');
  await page.close();
}
{
  const page = await open('page=kortit&w=1440');
  check((await page.$$('.lc-card')).length === META.cards.length + META.states.length, 'the all-cards page lacks cards');
  await page.click('#K05 [data-open]');
  const { frame } = await frameOf(page);
  check(await frame.$('.xm-card[data-card="K05"]'), 'a Näkyy link did not open its card');
  await page.close();
}

// Screenshots for Jari, DSF 2, with the round prefix.
if (shots) {
  const list = [
    ['r8-01-riffi1-rivi-heraa-1440-vaalea', 'v=1&view=kaynnissa&w=1440&pt=piilo'],
    ['r8-02-riffi2-kaikki-esilla-1440-vaalea', 'v=2&view=kaynnissa&w=1440&pt=piilo'],
    ['r8-03-riffi3-rivin-kortti-1440-vaalea', 'v=3&view=kaynnissa&w=1440&pt=rivi'],
    ['r8-04-riffi1-tyhja-kortti-jaa-1440-vaalea', 'v=1&view=kaynnissa&w=1440&pt=tyhja-kentta'],
    ['r8-05-riffi2-tyhja-on-tyhjaa-1440-vaalea', 'v=2&view=kaynnissa&w=1440&pt=tyhja-kentta'],
    ['r8-06-riffi3-alueen-nimi-1440-vaalea', 'v=3&view=kaynnissa&w=1440&pt=tyhja-kentta'],
    ['r8-07-riffi3-tilanne-keskustelussa-1440-vaalea', 'v=3&view=kaynnissa&w=1440&pt=tyhja-keskustelu'],
    ['r8-08-riffi1-rivi-heraa-1440-tumma', 'v=1&view=kaynnissa&w=1440&theme=dark&pt=piilo'],
    ['r8-09-riffi2-kaikki-esilla-1440-tumma', 'v=2&view=tyotila&w=1440&theme=dark&pt=rivi'],
    ['r8-10-riffi3-rivin-kortti-1440-tumma', 'v=3&view=etusivu&w=1440&theme=dark&pt=rivi'],
    ['r8-12-puhelin-piilopainike-390-vaalea', 'v=1&view=sivupalkki&w=390&pt=piilo'],
    ['r8-13-puhelin-riffi3-alueen-nimi-390-vaalea', 'v=3&view=kaynnissa&w=390&pt=tyhja-kentta'],
    ['r8-14-puhelin-riffi2-tyhja-390-tumma', 'v=2&view=kaynnissa&w=390&theme=dark&pt=tyhja-kentta'],
    ['r8-15-puhelin-riffi1-rivi-390-tumma', 'v=1&view=sivupalkki&w=390&theme=dark&pt=rivi'],
  ];
  for (const [name, q, extra] of list) {
    const phone = q.includes('w=390');
    const page = await open(`page=tila&bare=1&explain=on&${q}`, { width: phone ? 390 : 1440, height: phone ? 844 : 900, dsf: 2 });
    const { frame, box } = await frameOf(page);
    const m = q.match(/hover=([A-Z]\d+)/);
    if (m && !phone) { const p = await at(frame, m[1]); if (p) await page.mouse.move(box.x + p.x, box.y + p.y); }
    if (extra?.startsWith('ring:')) {
      const id = extra.slice(5);
      const r = await frame.evaluate((id) => { const b = document.querySelector(`[data-xm-can="${id}"]`).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
      await page.mouse.move(box.x + r.x, box.y + r.y);
    }
    if (extra?.startsWith('tap:')) { const p = await at(frame, extra.slice(4)); await page.mouse.click(box.x + p.x, box.y + p.y); }
    if (extra === 'help') {
      const r = await frame.evaluate(() => { const b = document.querySelector('[data-xm-help]').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
      await page.mouse.move(box.x + r.x, box.y + r.y);
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, `${name}.png`) });
    await page.close();
  }
  // Round 7 for comparison, from its own page: the empty band explained over its whole width.
  {
    const r7 = pathToFileURL(path.join(root, 'issues/proto-explain-mode-r6/prototype/kierros-7/selitystila-tila.html')).href;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(`${r7}?page=tila&bare=1&v=2&view=kaynnissa&w=1440&explain=on&pop=0`);
    await page.waitForFunction(() => window.PROTO_READY);
    const { frame, box } = await frameOf(page);
    const q = await frame.evaluate(() => { const r = document.querySelector('.ah-bg-strip').getBoundingClientRect(); return { x: r.right - 160, y: r.top + r.height / 2 }; });
    await page.mouse.move(box.x + q.x, box.y + q.y);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, 'r8-11-kierros7-tyhja-nauha-selittyy-1440-vaalea.png') });
    await page.close();
  }
  for (const [name, q, w] of []) {
    const page = await open(q, { width: w + 40, height: 1400, dsf: 2 });
    await page.screenshot({ path: path.join(shots, `${name}.png`) });
    await page.close();
  }
}

await browser.close();
const never = META.cards.filter((id) => !stats.seen.has(id));
const report = { explained: stats.explained, views: stats.views, stateCards: stats.stateCards, coveredByOpenMenus: stats.covered, cards: META.cards.length, shownInViews: stats.seen.size,
  notInCapturedViews: never, stateCardCoversAnchor: stats.stateCoversAnchor, unreachable: stats.unreachable, cardOutsideView: stats.outside, errors };
mkdirSync(path.join(root, 'design-system/prototypes/dist'), { recursive: true });
writeFileSync(path.join(root, 'design-system/prototypes/dist/selitystila-kulmat-check.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, notInCapturedViews: never.length, unreachable: report.unreachable.length, cardOutsideView: report.cardOutsideView.length }, null, 1));
if (errors.length || stats.unreachable.length || stats.outside.length) process.exitCode = 1;
