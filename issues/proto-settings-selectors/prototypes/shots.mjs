// Screenshots and an interaction sweep: node shots.mjs <abs valitsimet.html> <out dir>
// (Playwright from the main checkout's web/node_modules; device scale factor 2).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/home/maintainer/src/open-habitat/web/node_modules/playwright/index.mjs");
const page0 = 'file://' + process.argv[2];
const out = process.argv[3];
const b = await chromium.launch();
const errs = [];
async function shot(name, q, act, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: opts.h ?? 1220 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(page0 + '?' + q);
  await p.waitForTimeout(300);
  if (act) await act(p);
  await p.mouse.move(2, 2);
  await p.waitForTimeout(200);
  if (opts.el) await p.addStyleTag({ content: '.proto-picker { display: none !important; }' });
  const el = opts.el ? p.locator(opts.el).first() : p;
  if (name) await el.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
  const m = await p.locator('#measures').innerText();
  console.log(name || '-', q, m.replace(/\s*\n\s*/g, ' | ').slice(0, 400));
  await ctx.close();
}
const click = (...sels) => async (p) => { for (const s of sels) { if (s === 'Escape') await p.keyboard.press('Escape'); else await p.click(s); await p.waitForTimeout(80); } };
await shot('00-sivun-alku-erot', 'v=1', null, { h: 900 });
await shot('01-lahtokohta-en-vaalea', 'v=1', null, { el: '.frames' });
await shot('02-lahtokohta-fi-tumma', 'v=1&l=fi&t=dark', null, { el: '.frames' });
await shot('03-sarake-en-vaalea', 'v=2', null, { el: '.frames' });
await shot('04-sarake-levea-fi-vaalea', 'v=2&l=fi&w=wide', null, { el: '#desk' });
await shot('05-sarake-fi-tumma', 'v=2&l=fi&t=dark', null, { el: '.frames' });
await shot('06-valikko-en-vaalea', 'v=3', null, { el: '.frames' });
await shot('07-valikko-puhelin-alalehti-fi-tumma', 'v=3&l=fi&t=dark', click('Escape', '#phone [data-menu="level"]'), { el: '#phone' });
await shot('08-valikko-levea-laajuus-fi-vaalea', 'v=3&l=fi&w=wide', click('Escape', '#desk [data-menu="level"]'), { el: '#desk' });
await shot('09-luettelo-en-vaalea', 'v=4', null, { el: '.frames' });
await shot('10-luettelo-fi-tumma', 'v=4&l=fi&t=dark', null, { el: '.frames' });
await shot('11-lahtokohta-levea-fi-vaalea', 'v=1&l=fi&w=wide', null, { el: '#desk' });
// interaction sweep without screenshots
for (const v of [1, 2, 3, 4]) for (const x of ['', '&l=fi&t=dark', '&w=wide'])
  await shot('', `v=${v}${x}`, async (p) => {
    const tries = ['[data-pick="theme"][data-id="dark"]', '[data-menu="language"]', '[data-pick="language"][data-id="fi"]', '[data-menu="level"]', '[data-pick="level"][data-id="thorough"]', '[data-menu="level"]', '[data-pick="level"][data-id="custom"]', '[data-step="recent"][data-d="1"]', '[data-step="messages"][data-d="-1"]', '[data-step="history"][data-d="1"]', '[data-pick="work"][data-id="visible"]', '[data-pick="editor"][data-id="vscode"]'];
    for (const f of ['#desk', '#phone']) for (const s of tries) {
      const e = p.locator(`${f} ${s}`).first(); if (await e.count() && await e.isVisible()) await e.click();
    }
    const inp = p.locator('#desk [data-num="words"]').first();
    if (await inp.count()) { await inp.fill('77'); await inp.press('Enter'); await inp.press('ArrowUp'); }
    const val = await p.evaluate(() => document.querySelector('#desk [data-num="words"]')?.value);
    if (val && !/^8[05]$/.test(val)) errs.push(`v=${v}${x}: words ${val}`);
    await p.keyboard.press('Escape');
    await p.keyboard.press('ArrowRight');
  });
console.log('ERRORS', JSON.stringify(errs));
await b.close();
