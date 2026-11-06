// Checks round 9's built page and takes the issue's screenshots (DSF 2, PNG;
// turn them into AVIF with scripts/screenshots-to-avif.py).
// The pictures: in every conversation state, width and (Odottaa sinua) both
// themes, each picture shows what its caption says: the part's card before,
// the action's mark, the state card after. Try it: on desktop and phone, in
// each way, pointing at a message gives its card and the way's action brings
// the state card back, while the other ways' actions do not; the ? ends the
// mode in B and C but not in A; Esc ends it. The shared picker check; a clean
// console.
//   node design-system/prototypes/rounds/2026-11-06-tilakortin-tie/shoot.mjs [evidence-dir]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '../../../../web/node_modules/@playwright/test/index.mjs';
import { checkPicker } from '../../picker-check.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const file = pathToFileURL(path.join(root, 'issues/proto-explain-mode-r6/prototype/kierros-9/selitystila-tilakortti.html')).href;
const shots = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const stats = { pictures: 0, live: 0 };
const check = (ok, msg) => { if (!ok) errors.push(msg); };

async function open(q, { width = 1600, height = 1000, dsf = 1 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dsf });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${q}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${q}: ${e.message}`));
  await page.goto(`${file}?${q}`);
  await page.waitForFunction(() => window.PROTO_READY);
  await page.waitForTimeout(300);
  return page;
}
async function frameIn(el) {
  const f = await (await el.waitForSelector('iframe')).contentFrame();
  await f.waitForFunction(() => window.XM);
  return f;
}
const now = (f) => f.evaluate(() => ({ card: document.querySelector('.xm-card')?.dataset.card || null, state: !!document.querySelector('.xm-card.xm-state'),
  linger: !!document.querySelector('.xm-card.xm-linger'), on: document.documentElement.classList.contains('xm-on'), mark: !!document.querySelector('.xm-cursor, .xm-tap') }));

const meta = await (async () => {
  const p = await open('page=kuvat');
  await checkPicker(p, '2026-11-06-tilakortin-tie');
  const m = await p.evaluate(() => ({ views: META.views, states: Object.values(META.states).map((s) => ({ id: s.id, views: s.views })) }));
  await p.close();
  return m;
})();
const stateId = (v) => meta.states.find((s) => s.views.includes(v))?.id;

// ---- the pictures
for (const v of meta.views.filter((x) => x.story)) for (const w of v.widths) for (const theme of v.id === 'kaynnissa' ? ['light', 'dark'] : ['light']) {
  const phone = w <= 800;
  const page = await open(`page=kuvat&view=${v.id}&w=${w}&theme=${theme}`);
  const tag = `${v.id}-${w}-${theme}`;
  for (const fig of await page.$$('.sq-fig')) {
    const id = await fig.getAttribute('data-shot');
    const f = await frameIn(fig);
    await page.waitForTimeout(50);
    const n = await now(f);
    const [row, step] = [id[0], +id[1]];
    stats.pictures++;
    if (row === 'k' && step === 1) check(!n.on && !n.card && n.mark, `${tag} ${id}: the mode should be off with the pointer on ?`);
    else if (step === 3 || id === 'k2') check(n.on && n.state && n.card === stateId(v.id), `${tag} ${id}: no state card (${n.card})`);
    else if (step === 1) check(n.on && !n.state && n.card, `${tag} ${id}: no card of the part pointed at (${n.card})`);
    else if (step === 2) {
      check(n.on && !n.state && n.card, `${tag} ${id}: the card before the action is missing (${n.card})`);
      if (row === 'a' && !phone) check(n.card === 'X05', `${tag} a2: pointing at ? did not explain it (${n.card})`);
      if (row === 'b' && !phone) check(n.linger, `${tag} b2: the card did not linger over empty space`);
      if (row !== 'c') check(n.mark, `${tag} ${id}: the action is not marked`);
      else check(!!(await fig.$('.pc-tap')), `${tag} c2: the bar's press is not marked`);
    }
    // The state card stays inside its view.
    const out = await f.evaluate(() => { const c = document.querySelector('.xm-card'); if (!c) return false; const r = c.getBoundingClientRect(); return r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5; });
    check(!out, `${tag} ${id}: the card goes outside the view`);
  }
  // A picture opens larger.
  if (v.id === 'kaynnissa' && theme === 'light') {
    await page.click('.sq-fig[data-shot="c3"] .pc-sizer');
    check(await page.$('.lb iframe'), `${tag}: a picture did not open larger`);
    await page.keyboard.press('Escape');
    check(!(await page.$('.lb')), `${tag}: Esc did not close the larger picture`);
  }
  await page.close();
}

// ---- try it
const center = (f, sel) => f.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r?.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, sel);
for (const w of [1440, 390]) for (let way = 0; way < 3; way++) for (const tryWay of [0, 1, 2]) {
  const phone = w <= 800;
  const page = await open(`page=kokeile&v=${way + 1}&view=kaynnissa&w=${w}&explain=on`, { width: phone ? 420 : 1480, height: phone ? 2100 : 1400 });
  const sizer = await page.$('.pc-scale');
  const f = await frameIn(sizer);
  const box = await (await page.$('.pc-scale iframe')).boundingBox();
  const tag = `live ${w} way ${'ABC'[way]} action ${'ABC'[tryWay]}`;
  check((await now(f)).state, `${tag}: the mode did not open at the state card`);
  // On a phone the state card covers the top; a person closes it first (its ×).
  if (phone) { await f.click('.xm-state [data-xm-x]'); await page.waitForTimeout(100); }
  const m = await f.evaluate(() => XM.spot('osoitus'));
  if (phone) await page.mouse.click(box.x + m.x, box.y + m.y); else await page.mouse.move(box.x + m.x, box.y + m.y);
  await page.waitForTimeout(150);
  check((await now(f)).card === 'K01', `${tag}: the message did not explain`);
  if (tryWay === 0) {
    const p = await center(f, '[data-xm-help]');
    if (!phone) await page.mouse.move(box.x + p.x, box.y + p.y);
    await page.mouse.click(box.x + p.x, box.y + p.y);
  } else if (tryWay === 1) {
    const p = await f.evaluate(() => XM.spot('tyhja'));
    if (!phone) await page.mouse.move(box.x + p.x, box.y + p.y);
    await page.mouse.click(box.x + p.x, box.y + p.y);
  } else {
    const b = await page.$('[data-xm-now]');
    check(way === 2 ? !!b : !b, `${tag}: the bar's state button ${way === 2 ? 'is missing' : 'shows in another way'}`);
    if (b) await b.click();
  }
  await page.waitForTimeout(200);
  const n = await now(f);
  const barOn = !!(await page.$('.xm-bar:not([hidden])'));
  if (tryWay === way) check(n.state && barOn, `${tag}: the way's action did not bring the state card (${n.card})`);
  else if (tryWay === 0) check(!barOn, `${tag}: ? did not end the mode in way ${'ABC'[way]}`);
  else if (tryWay === 1) check(!n.state && barOn, `${tag}: empty space brought the state card in way ${'ABC'[way]}`);
  if (way === 2 && tryWay === 2) check((await page.getAttribute('[data-xm-now]', 'aria-pressed')) === 'true', `${tag}: the bar's state button does not show the card open`);
  stats.live++;
  // Esc ends the mode in every way.
  if (barOn) {
    await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await page.waitForTimeout(150);
    check(!(await page.$('.xm-bar:not([hidden])')), `${tag}: Esc did not end the mode`);
  }
  await page.close();
}
// A press still works in the mode (round 7): the work opens and the mode stays on.
{
  const page = await open('page=kokeile&v=3&view=kaynnissa&w=1440&explain=on', { width: 1480 });
  const f = await frameIn(await page.$('.pc-scale'));
  const box = await (await page.$('.pc-scale iframe')).boundingBox();
  const p = await f.evaluate(() => { const t = XM.findTarget('K04'); return { x: t.x + t.w / 2, y: t.y + t.h / 2 }; });
  await page.mouse.move(box.x + p.x, box.y + p.y);
  await page.mouse.click(box.x + p.x, box.y + p.y);
  await page.waitForTimeout(500);
  check(new URL(page.url()).searchParams.get('view') === 'kaynnissa-auki' && !!(await page.$('.xm-bar:not([hidden])')), 'a press on the work did not open it in the mode');
  await page.close();
}

// ---- screenshots for Jari, DSF 2, with the round prefix
if (shots) {
  const list = [
    ['r9-01-kuvasarjat-1440-vaalea', 'page=kuvat&v=3', 1600, 'full'],
    ['r9-02-kuvasarjat-390-vaalea', 'page=kuvat&v=3&w=390', 1440, 'full'],
    ['r9-03-k1-tila-pois-1440-vaalea', 'shot=k1'],
    ['r9-04-k2-tilakortti-1440-vaalea', 'shot=k2'],
    ['r9-05-a1-viestin-kortti-1440-vaalea', 'shot=a1'],
    ['r9-06-a2-selita-painike-1440-vaalea', 'shot=a2'],
    ['r9-07-a3-tilakortti-1440-vaalea', 'shot=a3'],
    ['r9-08-b2-tyhja-kohta-1440-vaalea', 'shot=b2'],
    ['r9-09-b3-tilakortti-1440-vaalea', 'shot=b3'],
    ['r9-10-c2-palkin-tilanne-1440-vaalea', 'shot=c2'],
    ['r9-11-c3-tilakortti-1440-vaalea', 'shot=c3'],
    ['r9-12-a2-selita-painike-1440-tumma', 'shot=a2&theme=dark'],
    ['r9-13-b2-tyhja-kohta-1440-tumma', 'shot=b2&theme=dark'],
    ['r9-14-c2-palkin-tilanne-1440-tumma', 'shot=c2&theme=dark'],
    ['r9-15-c3-epaonnistui-1440-vaalea', 'shot=c3&view=virhe'],
    ['r9-16-c3-tyoskentelee-1440-tumma', 'shot=c3&view=tyossa&theme=dark'],
    ['r9-17-puhelin-a2-selita-390-vaalea', 'shot=a2&w=390'],
    ['r9-18-puhelin-b2-tyhja-390-vaalea', 'shot=b2&w=390'],
    ['r9-19-puhelin-c2-palkki-390-vaalea', 'shot=c2&w=390'],
    ['r9-20-puhelin-c3-tilakortti-390-vaalea', 'shot=c3&w=390'],
    ['r9-21-puhelin-b3-tilakortti-390-tumma', 'shot=b3&w=390&theme=dark'],
    ['r9-22-puhelin-c2-palkki-390-tumma', 'shot=c2&w=390&theme=dark'],
  ];
  for (const [name, q, vw, mode] of list) {
    const phone = q.includes('w=390');
    const full = mode === 'full';
    const page = await open(full ? q : `bare=1&${q}`, { width: vw || (phone ? 390 : 1440), height: full ? 1000 : (phone ? 844 : 900), dsf: 2 });
    for (const el of await page.$$('.pc-scale')) await frameIn(el);
    await page.waitForTimeout(400);
    if (full) await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
    else await (await page.$('.pc-sizer')).screenshot({ path: path.join(shots, `${name}.png`) });
    await page.close();
  }
}

await browser.close();
const report = { ...stats, errors };
mkdirSync(path.join(root, 'design-system/prototypes/dist'), { recursive: true });
writeFileSync(path.join(root, 'design-system/prototypes/dist/tilakortin-tie-check.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
if (errors.length) process.exitCode = 1;
