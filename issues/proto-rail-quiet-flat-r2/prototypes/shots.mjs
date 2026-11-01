// Screenshots and an interaction sweep: node shots.mjs <abs hiljaiset-r2.html> <out dir>
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
  const el = opts.el ? p.locator(opts.el).first() : p;
  if (name) await el.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
  const info = await p.evaluate(() => {
    const sc = document.querySelector('.app .rail-scroll');
    const ws = [...document.querySelectorAll('.app .rail h2')].find((h) => h.textContent.startsWith('Työtilat'));
    return { rows: document.querySelectorAll('[data-sec="quiet"] .row').length,
      wsTop: ws && sc ? Math.round(ws.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop) : null,
      railH: sc ? Math.round(sc.clientHeight) : null, log: document.querySelector('.ev-log')?.textContent.slice(0, 200) };
  });
  console.log(name || '-', q, JSON.stringify(info));
  await ctx.close();
}
const click = (...sels) => async (p) => { for (const s of sels) { await p.click(s); await p.waitForTimeout(80); } };
const q = (k, a) => a ? `.app [data-q="${k}"][data-arg="${a}"]` : `.app [data-q="${k}"]`;
const openRail = '.topbar [data-act="rail"]';
await shot('00-sivun-alku-erot', 'v=2', null, { h: 760 });
await shot('01-kierros1-vaalea', 'v=1', null, { el: '.app' });
await shot('02-valikko-vaalea', 'v=2', null, { el: '.app' });
await shot('03-valikko-auki-vaalea', 'v=2', click(q('menu')), { el: '.app' });
await shot('04-valikko-tyotilan-mukaan-tumma', 'v=2&t=dark', click(q('menu'), q('sort', 'ws')), { el: '.app' });
await shot('05-tyotiloittain-vaalea', 'v=3', null, { el: '.app' });
await shot('06-tyotiloittain-kaksi-taitettu-vaalea', 'v=3', click(q('grp', 'deutschpad'), q('grp', 'workspace')), { el: '.app' });
await shot('07-piirit-vaalea', 'v=4', null, { el: '.app' });
await shot('08-piirit-taskfleet-tumma', 'v=4&t=dark', click(q('chip', 'taskfleet')), { el: '.app' });
await shot('09-valikko-taitettu-avoin-rivi-vaalea', 'v=2', click('.app .row >> text=Verbien taivutus', q('fold')), { el: '.app' });
await shot('10-tyotiloittain-puhelin-tumma', 'v=3&d=phone&t=dark', click(openRail), { el: '.app' });
await shot('11-piirit-puhelin-paljon-vaalea', 'v=4&d=phone&m=many', click(openRail), { el: '.app' });
await shot('12-tyotiloittain-paljon-tumma', 'v=3&t=dark&m=many', null, { el: '.app' });
await shot('13-valikko-tilakone-toinen-laite-vaalea', 'v=2', click(q('menu'), q('sort', 'name'), q('fold'), '[data-ev="device"]'), { el: '.graph-card' });
await shot('14-piirit-tilakone-lataus-unohtaa-vaalea', 'v=4', click(q('chip', 'fleetrepo'), '[data-ev="reload"]'), { el: '.graph-card' });
await shot('15-kierros1-ei-kuvakkeita-vaalea', 'v=1&i=off', null, { el: '.app' });
// interaction sweep without screenshots
for (const v of [1, 2, 3, 4]) for (const x of ['', '&d=phone', '&t=dark&i=off&m=many', '&n=on'])
  await shot('', `v=${v}${x}`, async (p) => {
    if (x.includes('phone')) await p.click(openRail);
    for (const s of [q('menu'), q('sort', 'ws'), q('menu'), q('sort', 'name'), q('sort', 'new'), q('sort', 'ws'), q('grp', 'fleetrepo'), q('chip', 'deutschpad'), q('chip', 'all'), q('fold'), q('fold')]) {
      const e = p.locator(s).first(); if (await e.count() && await e.isVisible()) await e.click();
    }
    for (const e of ['start', 'finish', 'idle', 't60', 'restart', 'tday', 'openT', 'merge', 'archive', 'storyOld', 'fold', 'reload', 'device', 'device', 'newWt', 'finish', 'fold']) { const el = p.locator(`[data-ev="${e}"]`).first(); if (await el.isEnabled()) await el.click(); }
    if (!x.includes('phone')) { const r = p.locator('.app .row').nth(3); if (await r.count()) await r.click(); }
    await p.keyboard.press('ArrowRight');
  });
console.log('ERRORS', JSON.stringify(errs));
await b.close();
