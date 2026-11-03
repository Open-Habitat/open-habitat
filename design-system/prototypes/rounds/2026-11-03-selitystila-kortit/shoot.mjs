// Checks the built page and takes the issue's screenshots (DSF 2, PNG; turn
// them into AVIF with scripts/screenshots-to-avif.py). Every direction, view,
// width and theme: each explainable part is pointed at (desktop) or tapped
// (phone), reachable at some point of its own box, and its card stays inside
// the view. It also presses Kokeile, Irrota, Esc and the bar's Lopeta, walks a
// view by an ordinary press, runs the shared picker check and keeps the
// console clean.
//   NODE_PATH=web/node_modules node design-system/prototypes/rounds/2026-11-03-selitystila-kortit/shoot.mjs [kuvat-dir]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '../../../../web/node_modules/@playwright/test/index.mjs';
import { checkPicker } from '../../picker-check.mjs';
import { CARDS } from './cards.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const file = pathToFileURL(path.join(root, 'issues/proto-explain-mode-r6/prototype/selitystila-kortit.html')).href;
const shots = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const stats = { explained: 0, views: 0, covered: 0, unreachable: [], outside: [], seen: new Set() };

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
  const el = await page.waitForSelector('.pc-scale iframe');
  const frame = await el.contentFrame();
  await frame.waitForFunction(() => window.XM);
  return { frame, box: await el.boundingBox() };
};

const VIEWS = JSON.parse(await (async () => {
  const p = await open('page=tila');
  const v = await p.evaluate(() => JSON.stringify(META.views));
  await checkPicker(p, '2026-11-03-selitystila-kortit');
  await p.close();
  return v;
})());

// Every part of every view: reachable, and its card inside the view.
for (const dir of [1, 2, 3]) {
  for (const v of VIEWS) for (const w of v.widths) for (const theme of dir === 1 ? ['light', 'dark'] : ['light']) {
    const phone = w <= 800;
    const page = await open(`page=tila&v=${dir}&view=${v.id}&w=${w}&theme=${theme}&explain=on&hover=`, { width: phone ? 420 : 1480, height: phone ? 1500 : 1200 });
    const { frame, box } = await frameOf(page);
    stats.views++; if (process.env.DEBUG) console.error(dir, v.id, w, theme);
    const targets = await frame.evaluate(() => {
      const seen = new Map();
      for (const t of XM.targets()) if (!seen.has(t.id)) seen.set(t.id, []);
      for (const t of XM.targets()) seen.get(t.id).push({ x: t.x, y: t.y, w: t.w, h: t.h });
      return [...seen.entries()];
    });
    for (const [id, rects] of targets) {
      // The first point of the part's own boxes that resolves to it.
      // A part under an open list or menu is covered, as in production; a part
      // that shows but whose every point goes to another card is a defect.
      const { point, shows } = await frame.evaluate(([id, rects]) => {
        let shows = false;
        for (const r of rects) for (const fx of [0.5, 0.2, 0.8, 0.05, 0.95]) for (const fy of [0.5, 0.2, 0.8, 0.1, 0.9]) {
          const x = r.x + r.w * fx, y = r.y + r.h * fy;
          const top = XM.under(x, y);
          const t = XM.targets().find((q) => q.id === id && x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
          if (top && t && t.el.contains(top)) shows = true;
          if (XM.hit(x, y)?.id === id && !top?.closest('[data-xm-toggle]')) return { point: { x, y }, shows: true };
        }
        return { point: null, shows };
      }, [id, rects]);
      if (!point) { if (shows && !['X01', 'X03'].includes(id)) stats.unreachable.push(`${v.id}-${w} ${id}`); else stats.covered++; continue; }
      const x = box.x + point.x, y = box.y + point.y;
      if (process.env.DEBUG) console.error("  ", id, Math.round(x), Math.round(y));
      // A pinned phone card covers what is under it; let it go first.
      if (phone) { await frame.evaluate(() => { XM.state.pin = null; XM.state.hover = null; XM.draw(); }); await page.mouse.click(x, y); }
      else await page.mouse.move(x, y);
      const card = await frame.evaluate(() => {
        const c = document.querySelector('.xm-card');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { id: c.dataset.card, ok: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
      });
      if (!card || card.id !== id) { stats.unreachable.push(`${v.id}-${w} ${id} (card ${card?.id})`); continue; }
      if (!card.ok) stats.outside.push(`${v.id}-${w}-${theme} ${id}`);
      stats.explained++;
      if (dir === 1) stats.seen.add(id);
    }
    await page.close();
  }
}

// Presses: pin, Kokeile opens the captured result, Irrota, Esc, Lopeta, a walk.
{
  const page = await open('page=tila&view=kaynnissa&w=1440&explain=on&hover=', { height: 1200 });
  let { frame, box } = await frameOf(page);
  const at = async (id) => frame.evaluate((id) => { const t = XM.findTarget(id); return { x: t.x + t.w / 2, y: t.y + t.h / 2 }; }, id);
  let p = await at('Y08');
  await page.mouse.click(box.x + p.x, box.y + p.y);
  if (!(await frame.$('.xm-card.pinned [data-xm-try]'))) errors.push('Y08: no Kokeile on the pinned card');
  await frame.click('[data-xm-try]');
  await page.waitForTimeout(500);
  ({ frame, box } = await frameOf(page));
  if (!(await frame.$('[data-testid="terminal-panel"]'))) errors.push('Kokeile on Y08 did not open the terminal view');
  if (await page.$('.xm-bar:not([hidden])')) errors.push('Kokeile left the mode on');
  // an ordinary press walks: ⋯ is not on this row at 1440, the Git chip is
  p = await at('Y04');
  await page.mouse.click(box.x + p.x, box.y + p.y);
  await page.waitForTimeout(500);
  ({ frame, box } = await frameOf(page));
  if (!(await frame.$('[data-testid="git-dialog"]'))) errors.push('a press on the Git chip did not open Git');
  await page.click('[data-ctl="explain"] [data-v="on"]');
  ({ frame, box } = await frameOf(page));
  p = await at('P09');
  await page.mouse.click(box.x + p.x, box.y + p.y);
  await frame.click('[data-xm-free]');
  if (await frame.$('.xm-card.pinned')) errors.push('Irrota left the card pinned');
  await page.keyboard.press('Escape');
  await frame.focus('body').catch(() => {});
  await frame.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await page.waitForTimeout(200);
  if (await frame.evaluate(() => XM.state.on)) errors.push('Esc did not end the mode');
  await page.close();
  const p2 = await open('page=tila&view=uusi&w=390&explain=off', { width: 420, height: 1500 });
  ({ frame, box } = await frameOf(p2));
  await frame.click('[data-xm-toggle]', { force: true }).catch(() => {});
  const go = await frame.evaluate(() => { const b = document.querySelector('.xm-strip-go').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await p2.mouse.click(box.x + go.x, box.y + go.y);
  await p2.waitForTimeout(200);
  if (!(await p2.$('.xm-bar:not([hidden])'))) errors.push('the strip did not start the mode');
  await p2.click('[data-xm-end]');
  await p2.waitForTimeout(200);
  if (await p2.$('.xm-bar:not([hidden])')) errors.push('Lopeta did not end the mode');
  await p2.close();
  const p3 = await open('page=kortit&w=1440');
  if ((await p3.$$('.lc-card')).length !== CARDS.length) errors.push('the all-cards page lacks cards');
  await p3.click('#K05 [data-open]');
  ({ frame } = await frameOf(p3));
  if (!(await frame.$('.xm-card.pinned[data-card="K05"]'))) errors.push('a Näkyy link did not open its card');
  await p3.close();
}

// Screenshots for Jari, DSF 2.
if (shots) {
  const list = [
    ['01-suunta1-paate-1440-vaalea', 'view=kaynnissa&w=1440&theme=light&hover=Y08'],
    ['02-suunta1-paate-kiinnitetty-1440-tumma', 'view=kaynnissa&w=1440&theme=dark&pin=Y08'],
    ['03-suunta2-paate-1440-vaalea', 'v=2&view=kaynnissa&w=1440&pin=Y08'],
    ['04-suunta3-paate-1440-vaalea', 'v=3&view=kaynnissa&w=1440&pin=Y08'],
    ['05-suunta1-konteksti-1440-vaalea', 'view=kaynnissa&w=1440&pin=Y05'],
    ['06-suunta1-hiljaiset-1440-tumma', 'view=kaynnissa&w=1440&theme=dark&pin=S07'],
    ['07-suunta1-tyokalurivi-1440-vaalea', 'view=kaynnissa&w=1440&pin=K05'],
    ['08-aloitussivu-nauha-1440-vaalea', 'view=uusi&w=1440&explain=off'],
    ['09-tavoite-1440-vaalea', 'view=uusi&w=1440&pin=A02'],
    ['10-komennot-1440-vaalea', 'view=komennot&w=1440&pin=L02'],
    ['11-git-1440-tumma', 'view=git&w=1440&theme=dark&pin=P02'],
    ['12-paate-1440-vaalea', 'view=paate&w=1440&pin=R04'],
    ['13-editori-1440-vaalea', 'view=editori&w=1440&pin=D03'],
    ['14-tyossa-1440-vaalea', 'view=tyossa&w=1440&pin=V08'],
    ['15-tilivalikko-selita-1440-vaalea', 'view=tilivalikko&w=1440&pin=X03'],
    ['16-worker-1440-tumma', 'view=worker&w=1440&theme=dark&pin=W04'],
    ['17-asetukset-1440-vaalea', 'view=asetukset&w=1440&pin=M06'],
    ['18-puhelin-paate-390-vaalea', 'view=kaynnissa&w=390&pin=Y08'],
    ['19-puhelin-valikko-390-vaalea', 'view=valikko&w=390&pin=X03'],
    ['20-puhelin-kentta-390-tumma', 'view=kaynnissa&w=390&theme=dark&pin=V03'],
    ['21-puhelin-nauha-390-vaalea', 'view=uusi&w=390&explain=off'],
    ['22-puhelin-sivupalkki-390-tumma', 'view=sivupalkki&w=390&theme=dark&pin=S10'],
    ['23-puhelin-suunta3-390-vaalea', 'v=3&view=kaynnissa&w=390&pin=Y05'],
  ];
  for (const [name, q] of list) {
    const phone = q.includes('w=390');
    const page = await open(`page=tila&explain=on&bare=1&${q}${q.includes('hover=') ? '' : '&hover='}`, { width: phone ? 390 : 1440, height: phone ? 844 : 900, dsf: 2 });
    const { frame, box } = await frameOf(page);
    const m = q.match(/hover=([A-Z]\d+)/);
    if (m) {
      const p = await frame.evaluate((id) => { const t = XM.findTarget(id); return t && { x: t.x + t.w / 2, y: t.y + t.h / 2 }; }, m[1]);
      if (p) await page.mouse.move(box.x + p.x, box.y + p.y);
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, `${name}.png`) });
    await page.close();
  }
  for (const [name, q, w] of [['24-kaikki-kortit-1440-vaalea', 'page=kortit&w=1440', 1440], ['25-kaikki-kortit-390-tumma', 'page=kortit&w=390&theme=dark', 390]]) {
    const page = await open(q, { width: w + (w > 800 ? 40 : 0), height: 1400, dsf: 2 });
    await page.screenshot({ path: path.join(shots, `${name}.png`) });
    await page.close();
  }
}

await browser.close();
const never = CARDS.map((c) => c.id).filter((id) => !stats.seen.has(id));
const report = { explained: stats.explained, views: stats.views, coveredByOpenMenus: stats.covered, cards: CARDS.length, shownInViews: stats.seen.size,
  notInCapturedViews: never, unreachable: stats.unreachable, cardOutsideView: stats.outside, errors };
writeFileSync(path.join(root, 'design-system/prototypes/dist/selitystila-kortit-check.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, unreachable: report.unreachable.length, cardOutsideView: report.cardOutsideView.length }, null, 1));
if (errors.length || stats.unreachable.length || stats.outside.length) process.exitCode = 1;
