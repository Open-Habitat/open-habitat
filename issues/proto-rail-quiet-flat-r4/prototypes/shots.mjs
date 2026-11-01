// Screenshots and an interaction sweep: node shots.mjs <abs hiljaiset-r4.html> <out dir>
// (Playwright from the main checkout's web/node_modules; device scale factor 2).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/home/maintainer/src/open-habitat/web/node_modules/playwright/index.mjs");
const page0 = 'file://' + process.argv[2];
const out = process.argv[3];
const b = await chromium.launch();
const errs = [];
async function shot(name, q, act, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: opts.h ?? 1000 }, deviceScaleFactor: 2 });
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
  const info = await p.evaluate(() => ({
    head: document.querySelector('.app [data-sec=quiet] h2')?.textContent,
    rows: document.querySelectorAll('.app [data-sec=quiet] .row').length,
    sorts: [...document.querySelectorAll('.app [data-q=sort]')].map((e) => e.textContent).join('|'),
    pop: (() => { const m = document.querySelector('.app .qpop'); return m ? Math.round(m.getBoundingClientRect().height) : null; })(),
  }));
  console.log(name || '-', q, JSON.stringify(info));
  await ctx.close();
}
const click = (...sels) => async (p) => { for (const s of sels) { if (s === 'Escape') await p.keyboard.press('Escape'); else await p.click(s); await p.waitForTimeout(80); } };
const q = (k, a) => a ? `.app [data-q="${k}"][data-arg="${a}"]` : `.app [data-q="${k}"]`;
await shot('00-sivun-alku-erot', 'v=1', null, { h: 1100 });
const R = [[1, 'ruudut'], [2, 'nauha'], [3, 'tiivis']];
let n = 1;
const nm = (s) => String(n++).padStart(2, '0') + '-' + s;
for (const [v, k] of R) {
  await shot(nm(`${k}-oletus-vaalea`), `v=${v}`, null, { h: 1100, el: '.pg-grid' });
  await shot(nm(`${k}-ikkuna-auki-vaalea`), `v=${v}`, click(q('menu')), { el: '.app' });
  await shot(nm(`${k}-deutschpad-tumma`), `v=${v}&t=dark`, click(q('menu'), q('ws', 'deutschpad')), { el: '.app' });
  await shot(nm(`${k}-taitettu-tumma`), `v=${v}&t=dark`, click(q('fold')), { el: '.app' });
  await shot(nm(`${k}-puhelin-ikkuna-vaalea`), `v=${v}&d=phone`, click(q('menu')), { el: '.app' });
  await shot(nm(`${k}-puhelin-taitettu-tumma`), `v=${v}&d=phone&t=dark`, click(q('fold')), { el: '.app' });
}
await shot(nm('ruudut-paljon-ikkuna-vaalea'), 'v=1&m=many', click(q('menu')), { el: '.app' });
await shot(nm('tiivis-paljon-ikkuna-tumma'), 'v=3&m=many&t=dark', click(q('menu')), { el: '.app' });
// interaction sweep without screenshots
for (const [v] of R) for (const x of ['', '&d=phone', '&t=dark&m=many'])
  await shot('', `v=${v}${x}`, async (p) => {
    for (const s of [q('menu'), q('sort', 'ws'), q('ws', 'fleetrepo'), q('sort', 'name'), q('all'), q('ws', 'taskfleet'), q('close'), 'ESC', q('menu'), 'ESC', q('fold'), q('unfold', 'fleetrepo'), q('fold'), q('fold'), q('ws', 'workspace'), q('ws', 'workspace'), '[data-device-set="phone"]', '[data-device-set="desktop"]', '[data-amount-set="many"]', '[data-amount-set="five"]']) {
      if (s === 'ESC') { await p.keyboard.press('Escape'); continue; }
      const e = p.locator(s).first(); if (await e.count() && await e.isVisible()) await e.click();
    }
    const r = p.locator('.app .row').nth(3); if (await r.isVisible()) await r.click();
    await p.keyboard.press('ArrowRight');
  });
console.log('ERRORS', JSON.stringify(errs));
await b.close();
