// Checks round 7's built page and takes the issue's screenshots (DSF 2, PNG;
// turn them into AVIF with scripts/screenshots-to-avif.py). Every riff, view,
// width (riff 1 also dark): each explainable part is pointed at (desktop) or
// tapped (phone) and its card stays inside the view; in a conversation the
// state card shows while nothing is pointed at and stays inside the view.
// Presses: a press in the mode does what it does (1 ajatus ja 3 työkalua
// opens, a tool row opens) and the mode stays on; a lasting one waits; the
// state card's rows press their part; each riff's entry opens the mode on the
// state; a phone's first tap explains and the second does it; Esc, Lopeta,
// the start page's strip, the all-cards page; the shared picker check; a clean
// console.
//   node design-system/prototypes/rounds/2026-11-06-selitystila-tila/shoot.mjs [evidence-dir]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '../../../../web/node_modules/@playwright/test/index.mjs';
import { checkPicker } from '../../picker-check.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const file = pathToFileURL(path.join(root, 'issues/proto-explain-mode-r6/prototype/kierros-7/selitystila-tila.html')).href;
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
  await checkPicker(p, '2026-11-06-selitystila-tila');
  await p.close();
  return v;
})());
const stateViews = new Set(META.states.flatMap((s) => s.views));

// Every part of every view, and the state card.
for (const riff of [1, 2, 3]) {
  for (const v of META.views) for (const w of v.widths) for (const theme of riff === 1 ? ['light', 'dark'] : ['light']) {
    const phone = w <= 800;
    const page = await open(`page=tila&v=${riff}&view=${v.id}&w=${w}&theme=${theme}&explain=on&pop=0`, { width: phone ? 420 : 1480, height: phone ? 1500 : 1200 });
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

// Riff 1: the dot's row opens the mode on the state; presses keep working.
{
  const page = await open('page=tila&v=1&view=kaynnissa&w=1440', { height: 1200 });
  let { frame } = await frameOf(page);
  check(await frame.$('.xm-pop:not([hidden]) [data-xm-dotask]'), 'riff 1: the dot\'s row is not open by default');
  const { box } = await frameOf(page);
  const b = await frame.evaluate(() => { const r = document.querySelector('[data-xm-dotask]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(box.x + b.x, box.y + b.y);
  await page.waitForTimeout(300);
  check(await modeOn(page), 'riff 1: Mitä nyt? did not start the mode');
  check(await frame.$('.xm-card.xm-state[data-card="vuorosi"]'), 'riff 1: the mode did not open on the state card');
  await press(page, 'K04');
  check((await viewOf(page)) === 'kaynnissa-auki' && await modeOn(page), 'a press on 1 ajatus ja 3 työkalua did not open it in the mode');
  await press(page, 'K05');
  check((await viewOf(page)) === 'kaynnissa-tuloste' && await modeOn(page), 'a press on a tool row did not open it in the mode');
  await press(page, 'Y11');
  check((await viewOf(page)) === 'kaynnissa-tuloste' && await modeOn(page), 'Arkistoi acted in the mode');
  ({ frame } = await frameOf(page));
  check(await frame.$('.xm-toast'), 'Arkistoi in the mode said nothing');
  await press(page, 'Y08');
  check((await viewOf(page)) === 'paate' && await modeOn(page), 'Pääte did not open in the mode');
  await page.keyboard.press('Escape');
  ({ frame } = await frameOf(page));
  await frame.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await page.waitForTimeout(200);
  check(!(await modeOn(page)), 'Esc did not end the mode');
  await page.close();
}
// The state card's rows press their part.
{
  const page = await open('page=tila&v=1&view=kaynnissa&w=1440&explain=on&pop=0', { height: 1200 });
  const { frame } = await frameOf(page);
  await frame.click('.xm-state [data-xm-can="K04"]');
  await page.waitForTimeout(400);
  check((await viewOf(page)) === 'kaynnissa-auki' && await modeOn(page), 'the state card\'s row did not open the agent\'s work');
  await page.click('[data-xm-end]');
  await page.waitForTimeout(200);
  check(!(await modeOn(page)), 'Lopeta did not end the mode');
  await page.close();
}
// Riff 2: the ? in the top bar and the ? key.
{
  const page = await open('page=tila&v=2&view=tyossa&w=1440', { height: 1200 });
  const { frame, box } = await frameOf(page);
  const b = await frame.evaluate(() => { const r = document.querySelector('[data-xm-help]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(box.x + b.x, box.y + b.y);
  await page.waitForTimeout(300);
  check(await modeOn(page) && await frame.$('.xm-card.xm-state[data-card="tyossa"]'), 'riff 2: ? did not open the mode on the state');
  await frame.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })));
  await page.waitForTimeout(200);
  check(!(await modeOn(page)), 'riff 2: the ? key did not end the mode');
  await page.close();
}
// Riff 3: the hint row opens the mode; its × removes it.
for (const v of ['tyossa', 'virhe', 'kaynnissa', 'pysaytetty', 'taustatyo-merkki']) {
  const page = await open(`page=tila&v=3&view=${v}&w=1440`, { height: 1200 });
  const { frame, box } = await frameOf(page);
  const b = await frame.evaluate(() => { const r = document.querySelector('[data-xm-hint] [data-xm-toggle]')?.getBoundingClientRect(); return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
  if (!b) { errors.push(`riff 3: no hint row in ${v}`); await page.close(); continue; }
  await page.mouse.click(box.x + b.x, box.y + b.y);
  await page.waitForTimeout(300);
  check(await modeOn(page) && await frame.$('.xm-card.xm-state'), `riff 3: the hint in ${v} did not open the mode on the state`);
  await page.close();
}
{
  const page = await open('page=tila&v=3&view=tyossa&w=1440', { height: 1200 });
  const { frame, box } = await frameOf(page);
  const b = await frame.evaluate(() => { const r = document.querySelector('.xm-hint-x').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(box.x + b.x, box.y + b.y);
  check(!(await frame.$('[data-xm-hint]')), 'riff 3: × did not remove the hint');
  await page.close();
}
// Phone: the first tap explains, the second does it; the card's button does it too.
{
  const page = await open('page=tila&v=1&view=kaynnissa&w=390&explain=on&pop=0', { width: 420, height: 1500 });
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
  const page = await open('page=tila&v=1&view=uusi&w=390', { width: 420, height: 1500 });
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
    ['r7-01-riffi1-tilapiste-1440-vaalea', 'v=1&view=kaynnissa&w=1440&explain=off&pop=1'],
    ['r7-02-riffi1-tila-odottaa-1440-vaalea', 'v=1&view=kaynnissa&w=1440&explain=on'],
    ['r7-03-riffi2-painike-1440-vaalea', 'v=2&view=tyossa&w=1440&explain=off', 'help'],
    ['r7-04-riffi2-tila-tyoskentelee-1440-tumma', 'v=2&view=tyossa&w=1440&theme=dark&explain=on'],
    ['r7-05-riffi3-vihje-tyoskentelee-1440-vaalea', 'v=3&view=tyossa&w=1440&explain=off'],
    ['r7-06-riffi3-vihje-epaonnistui-1440-vaalea', 'v=3&view=virhe&w=1440&explain=off'],
    ['r7-07-tila-epaonnistui-1440-vaalea', 'v=3&view=virhe&w=1440&explain=on'],
    ['r7-08-tila-pysaytetty-1440-tumma', 'v=1&view=pysaytetty&w=1440&theme=dark&explain=on'],
    ['r7-09-tila-taustalla-1440-vaalea', 'v=1&view=taustatyo-merkki&w=1440&explain=on'],
    ['r7-10-tila-rivi-osoittaa-1440-vaalea', 'v=1&view=kaynnissa&w=1440&explain=on', 'ring:K04'],
    ['r7-11-napsautus-tyo-kiinni-1440-vaalea', 'v=1&view=kaynnissa&w=1440&explain=on&hover=K04'],
    ['r7-12-napsautus-tyo-auki-1440-vaalea', 'v=1&view=kaynnissa-auki&w=1440&explain=on&hover=K05'],
    ['r7-13-napsautus-tuloste-auki-1440-tumma', 'v=1&view=kaynnissa-tuloste&w=1440&theme=dark&explain=on&hover=K15'],
    ['r7-14-arkistoi-odottaa-1440-vaalea', 'v=1&view=kaynnissa&w=1440&explain=on&hover=Y11'],
    ['r7-15-puhelin-riffi1-tilapiste-390-vaalea', 'v=1&view=tyossa&w=390&explain=off&pop=1'],
    ['r7-16-puhelin-tila-tyoskentelee-390-vaalea', 'v=1&view=tyossa&w=390&explain=on'],
    ['r7-17-puhelin-riffi2-painike-390-tumma', 'v=2&view=kaynnissa&w=390&theme=dark&explain=off'],
    ['r7-18-puhelin-riffi3-vihje-390-vaalea', 'v=3&view=virhe&w=390&explain=off'],
    ['r7-19-puhelin-napautus-kortti-390-vaalea', 'v=1&view=kaynnissa&w=390&explain=on', 'tap:K04'],
    ['r7-20-puhelin-tila-odottaa-390-tumma', 'v=1&view=kaynnissa&w=390&theme=dark&explain=on'],
  ];
  for (const [name, q, extra] of list) {
    const phone = q.includes('w=390');
    const page = await open(`page=tila&bare=1&${q}${q.includes('pop=') ? '' : '&pop=0'}`, { width: phone ? 390 : 1440, height: phone ? 844 : 900, dsf: 2 });
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
  for (const [name, q, w] of [['r7-21-kaikki-kortit-tilat-1440-vaalea', 'page=kortit&w=1440', 1440]]) {
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
writeFileSync(path.join(root, 'design-system/prototypes/dist/selitystila-tila-check.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, notInCapturedViews: never.length, unreachable: report.unreachable.length, cardOutsideView: report.cardOutsideView.length }, null, 1));
if (errors.length || stats.unreachable.length || stats.outside.length) process.exitCode = 1;
