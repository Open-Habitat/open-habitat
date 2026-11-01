// Screenshots and an interaction sweep: node shots.mjs <abs taitekohdat.html> <out dir>
// (Playwright from the main checkout's web/node_modules; device scale factor 2).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/home/maintainer/src/open-habitat/web/node_modules/playwright/index.mjs");
const page0 = 'file://' + process.argv[2];
const out = process.argv[3];
const only = process.argv[4];
const b = await chromium.launch();
const errs = [];
async function shot(name, q, act, opts = {}) {
  if (only && name && !name.startsWith(only)) return;
  const ctx = await b.newContext({ viewport: { width: opts.vw ?? 1500, height: opts.h ?? 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(page0 + '?' + q);
  await p.waitForTimeout(300);
  if (act) await act(p);
  await p.mouse.move(2, 2);
  await p.waitForTimeout(150);
  const el = opts.el ? p.locator(opts.el).first() : p;
  if (name) await el.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
  const info = await p.evaluate(() => document.querySelector('#ruler').innerText.replace(/\n/g, ' '));
  console.log(name || '-', q, info);
  await ctx.close();
}
const click = (...sels) => async (p) => { for (const s of sels) { await p.click(s); await p.waitForTimeout(80); } };
const sec = (id) => `#frame [data-sec="${id}"]`;
const wrap = '.pg-work';
await shot('00-sivun-alku-erot', 'v=1', null, { h: 1000 });
await shot('01-nykyinen-1000-auki', 'v=1', null, { el: wrap });
await shot('02-nykyinen-810-kapeimmillaan', 'v=1&w=810', null, { el: wrap });
await shot('03-ikkunan-raja-1000-pino', 'v=2', null, { el: wrap });
await shot('04-ikkunan-raja-1100-kapea-sivupalkki-pino', 'v=2&w=1100&r=compact', null, { el: wrap });
await shot('05-asetusalue-1000-pino', 'v=3', null, { el: wrap });
await shot('06-asetusalue-1000-kapea-sivupalkki-lista', 'v=3&r=compact', null, { el: wrap });
await shot('07-asetusalue-1180-auki-lista', 'v=3&w=1180', null, { el: wrap });
await shot('08-kuvakkeet-1000-auki', 'v=4', null, { el: wrap });
await shot('09-kuvakkeet-900-ulkoasu-en-tumma', 'v=4&w=900&l=en&t=dark&s=ulkoasu', null, { el: wrap });
await shot('10-kuvakkeet-1200-kokeelliset-en', 'v=4&w=1200&l=en&s=kokeelliset', null, { el: wrap });
await shot('11-asetusalue-pino-osiolista', 'v=3&list=1', null, { el: wrap });
await shot('12-kuvakkeet-390-puhelin-tumma', 'v=4&w=390&t=dark', null, { el: wrap });
await shot('13-nykyinen-kayra', 'v=1', null, { el: '.chart' });
await shot('14-ikkunan-raja-kayra', 'v=2', null, { el: '.chart' });
await shot('15-asetusalue-kayra', 'v=3', null, { el: '.chart' });
await shot('16-kuvakkeet-kayra', 'v=4', null, { el: '.chart' });
// interaction sweep without screenshots: every control, the frame's navigation, the handle
if (!only) for (const v of [1, 2, 3, 4]) for (const x of ['', '&r=compact&l=en', '&t=dark&w=600'])
  await shot('', `v=${v}${x}`, async (p) => {
    for (const w of [1440, 1140, 900, 760, 390, 1000]) await p.click(`#presets [data-w="${w}"]`);
    for (const g of ['[data-g="rail"] [data-v="compact"]', '[data-g="lang"] [data-v="en"]', '[data-g="theme"] [data-v="dark"]', '[data-g="rail"] [data-v="open"]', '[data-g="lang"] [data-v="fi"]'])
      await p.click(g);
    for (const s of ['ulkoasu', 'kokeelliset', 'levy', 'tili']) { const e = p.locator(sec(s)); if (await e.isVisible()) await e.click(); }
    const back = p.locator('#frame [data-act="back"]'); if (await back.isVisible()) { await back.click(); await p.click(sec('ulkoasu')); }
    for (const row of await p.locator('.bp:not([hidden]) input[type=number]').all()) { await row.fill('700'); await row.dispatchEvent('input'); }
    await p.locator('.bp:not([hidden]) input[type=range]').first().fill('900');
    await p.focus('#handle'); for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowLeft');
    const h = await p.locator('#handle').boundingBox();
    await p.mouse.move(h.x + 7, h.y + 100); await p.mouse.down(); await p.mouse.move(h.x - 150, h.y + 100, { steps: 5 }); await p.mouse.up();
    const c = await p.locator('#chart').boundingBox(); await p.mouse.click(c.x + c.width * 0.6, c.y + c.height / 2);
    const picked = await p.evaluate(() => document.querySelector('.proto-picker-item[data-active]').textContent);
    if (!picked) throw new Error('no active direction');
  });
console.log('ERRORS', JSON.stringify(errs));
await b.close();
