// Screenshots and an interaction sweep: node shots.mjs <abs hiljaiset-r3.html> <out dir>
// (Playwright from the main checkout's web/node_modules; device scale factor 2).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/home/maintainer/src/open-habitat/web/node_modules/playwright/index.mjs");
const page0 = 'file://' + process.argv[2];
const out = process.argv[3];
const b = await chromium.launch();
const errs = [];
async function shot(name, q, act, opts = {}) {
  const phone = q.includes('d=phone');
  const ctx = await b.newContext({ viewport: { width: phone ? 1180 : 1500, height: opts.h ?? 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(page0 + '?' + q);
  await p.waitForTimeout(300);
  if (act) await act(p);
  await p.mouse.move(2, 2);
  await p.waitForTimeout(250);
  if (opts.el) await p.addStyleTag({ content: '.proto-picker { display: none !important; }' });
  const el = opts.el ? p.locator(opts.el).first() : p;
  if (name) await el.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
  const info = await p.evaluate(() => {
    const sc = document.querySelector('.app .rail-scroll');
    const ws = [...document.querySelectorAll('.app .rail h2')].find((h) => h.textContent.startsWith('Työtilat'));
    return { rows: document.querySelectorAll('[data-sec="quiet"] .row').length,
      wsTop: ws && sc ? Math.round(ws.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop) : null,
      railH: sc ? Math.round(sc.clientHeight) : null, menuH: (() => { const m = document.querySelector('.app .qmenu, .app .qpop'); return m ? Math.round(m.getBoundingClientRect().height) : null; })(), head: document.querySelector('.app [data-sec=quiet] h2')?.textContent, log: document.querySelector('.ev-log')?.textContent.slice(0, 200) };
  });
  console.log(name || '-', q, JSON.stringify(info));
  await ctx.close();
}
const click = (...sels) => async (p) => { for (const s of sels) { if (s === 'Escape') await p.keyboard.press('Escape'); else await p.click(s); await p.waitForTimeout(80); } };
const q = (k, a) => a ? `.app [data-q="${k}"][data-arg="${a}"]` : `.app [data-q="${k}"]`;
const openRail = '.topbar [data-act="rail"]';
const verbs = '.app .row >> text=Verbien taivutus';
await shot('00-sivun-alku-erot', 'v=2', null, { h: 820 });
await shot('01-lahtokohta-vaalea', 'v=1', null, { el: '.app' });
await shot('02-pudotus-auki-vaalea', 'v=2', null, { el: '.app' });
await shot('03-pudotus-valittu-open-habitat-tumma', 'v=2&t=dark', click(q('ws', 'open-habitat')), { el: '.app' });
await shot('04-pudotus-puhelin-alalehti-vaalea', 'v=2&d=phone', click(openRail), { el: '.app' });
await shot('05-ruudukko-auki-vaalea', 'v=3', null, { el: '.app' });
await shot('06-ruudukko-fleetrepo-nimi-tumma', 'v=3&t=dark', click(q('ws', 'fleetrepo'), q('sort', 'name')), { el: '.app' });
await shot('07-ruudukko-taitettu-kuvakerivi-vaalea', 'v=3', click('Escape', verbs, q('fold')), { el: '.app' });
await shot('08-sarake-auki-vaalea', 'v=4', null, { el: '.app' });
await shot('09-sarake-kaksi-tyotilaa-tumma', 'v=4&t=dark', click(q('ws', 'open-habitat'), q('menu') + ' >> nth=1', q('tick', 'fleetrepo'), 'Escape'), { el: '.app' });
await shot('10-sarake-taitettu-merkit-vaalea', 'v=4', click('Escape', verbs, q('menu') + ' >> nth=1', q('ws', 'fleetrepo'), q('fold')), { el: '.app' });
await shot('11-pudotus-taitettu-avoin-rivi-vaalea', 'v=2', click('Escape', verbs, q('fold')), { el: '.app' });
await shot('12-sarake-puhelin-tumma', 'v=4&d=phone&t=dark', click(openRail), { el: '.app' });
await shot('13-ruudukko-puhelin-paljon-vaalea', 'v=3&d=phone&m=many', click(openRail), { el: '.app' });
await shot('14-pudotus-paljon-tumma', 'v=2&t=dark&m=many', null, { el: '.app' });
await shot('15-sarake-ei-kuvakkeita-vaalea', 'v=4&i=off', null, { el: '.app' });
await shot('16-pudotus-tilakone-toinen-laite-vaalea', 'v=2', click(q('ws', 'deutschpad'), '[data-ev="device"]'), { el: '.graph-card' });
await shot('17-ruudukko-taitettu-kortti-vaalea', 'v=3', null, { el: '.foldprev' });
// interaction sweep without screenshots
for (const v of [1, 2, 3, 4]) for (const x of ['', '&d=phone', '&t=dark&i=off&m=many', '&n=on'])
  await shot('', `v=${v}${x}`, async (p) => {
    if (x.includes('phone')) await p.click(openRail);
    for (const s of [q('sort', 'ws'), q('menu'), q('ws', 'fleetrepo'), q('menu'), q('sort', 'name'), q('tick', 'deutschpad'), q('sort', 'old'), q('all'), q('close'), q('menu'), 'ESC', q('fold'), q('unfold', 'fleetrepo'), q('fold'), q('fold')]) {
      if (s === 'ESC') { await p.keyboard.press('Escape'); continue; }
      const e = p.locator(s).first(); if (await e.count() && await e.isVisible()) await e.click();
    }
    for (const e of ['start', 'finish', 'idle', 't60', 'restart', 'tday', 'openT', 'merge', 'archive', 'storyOld', 'fold', 'reload', 'device', 'device', 'newWt', 'finish', 'fold']) { const el = p.locator(`[data-ev="${e}"]`).first(); if (await el.isEnabled()) await el.click(); }
    if (!x.includes('phone')) { const r = p.locator('.app .row').nth(3); if (await r.count()) await r.click(); }
    await p.keyboard.press('Escape');
    await p.keyboard.press('ArrowRight');
  });
console.log('ERRORS', JSON.stringify(errs));
await b.close();
