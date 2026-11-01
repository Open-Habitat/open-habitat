// Screenshots and an interaction sweep: node shots.mjs <abs hiljaiset.html> <out dir>
// (Playwright from the main checkout's web/node_modules; device scale factor 2).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/home/maintainer/src/open-habitat/web/node_modules/playwright/index.mjs");
const page0 = 'file://' + process.argv[2];
const out = process.argv[3];
const b = await chromium.launch();
const errs = [];
async function shot(name, q, act, opts = {}) {
  const phone = q.includes('d=phone');
  const ctx = await b.newContext({ viewport: { width: phone ? 1180 : 1500, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(page0 + '?' + q);
  await p.waitForTimeout(300);
  if (act) await act(p);
  await p.waitForTimeout(250);
  const el = opts.el ? p.locator(opts.el).first() : p;
  if (name) await el.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
  const info = await p.evaluate(() => {
    const sc = document.querySelector('.app .rail-scroll') || document.querySelector('.app .rail');
    const ws = [...document.querySelectorAll('.app .rail h2')].find((h) => h.textContent.startsWith('Työtilat'));
    const q = document.querySelector('[data-sec="quiet"] ul, [data-sec="recent"]');
    return { rows: document.querySelectorAll('[data-sec="quiet"] .row, [data-sec="recent"] .row').length,
      wsTop: ws ? Math.round(ws.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop) : null,
      railH: Math.round(sc.clientHeight), log: document.querySelector('.ev-log')?.textContent.slice(0, 220) };
  });
  console.log(name || '-', q, JSON.stringify(info));
  await ctx.close();
}
const click = (sel) => async (p) => { await p.click(sel); };
const ev = (e) => `[data-ev="${e}"]`;
const scrollRail = async (p) => { await p.evaluate(() => { const s = document.querySelector('.app .rail-scroll'); s.scrollTop = s.scrollHeight; }); };
await shot('01-nykyinen-muutama-vaalea', 'v=1&i=off');
await shot('02-nimi-muutama-ei-kuvakkeita-vaalea', 'v=2&i=off', null, { el: '.app' });
await shot('03-nimi-paljon-ei-kuvakkeita-vaalea', 'v=2&i=off&m=many', null, { el: '.app' });
await shot('04-nimi-paljon-raide-alhaalla-vaalea', 'v=2&i=off&m=many', scrollRail, { el: '.app' });
await shot('05-nimi-paljon-kuvakkeet-tumma', 'v=2&t=dark&m=many', null, { el: '.app' });
await shot('06-kirjaimet-paljon-ei-kuvakkeita-tumma', 'v=3&t=dark&i=off&m=many', null, { el: '.app' });
await shot('07-nimi-puhelin-paljon-vaalea', 'v=2&d=phone&i=off&m=many', click('.topbar [data-act="rail"]'), { el: '.app' });
await shot('08-kirjaimet-puhelin-paljon-tumma', 'v=3&d=phone&t=dark&i=off&m=many', click('.topbar [data-act="rail"]'), { el: '.app' });
await shot('09-nimi-kolmen-viikon-takainen-vaalea', 'v=2&i=off', async (p) => { await p.click(ev('storyOld')); await p.waitForTimeout(100); await p.evaluate(() => { const s = document.querySelector('.app .rail-scroll'); const r = [...document.querySelectorAll('.app .row')].find((x) => x.textContent.includes('Labin portit')); s.scrollTop = r.offsetTop - 300; }); await p.click('.app .row >> text=Labin portit'); }, { el: '.app' });
await shot('10-nykyinen-kolmen-viikon-takainen-vaalea', 'v=1&i=off', async (p) => { await p.click(ev('storyOld')); await p.click(ev('openT')); }, { el: '.app' });
await shot('11-kapea-raide-tumma', 'v=2&t=dark&n=on', null, { el: '.app' });
await shot('12-asetukset-ilman-maaraa-vaalea', 'v=2', async (p) => { await p.click('[data-act="menu"]'); await p.click('.acct-menu [data-ev="settings"]'); }, { el: '.app' });
await shot('13-nimi-worktree-ilta-kuvakkeet-vaalea', 'v=2', async (p) => { await p.click(ev('story')); await p.click(ev('merge')); }, { el: '.app' });
// interaction sweep without screenshots
for (const v of [1, 2, 3]) for (const q of ['', '&d=phone', '&t=dark&i=off&m=many', '&n=on'])
  await shot('', `v=${v}${q}`, async (p) => {
    for (const e of ['start', 'finish', 'idle', 't60', 'restart', 'tday', 'story', 'openT', 'merge', 'archive', 'storyOld', 'newWt', 'finish', 'reload']) { const x = p.locator(ev(e)).first(); if (await x.isEnabled()) await x.click(); }
    if (!q.includes('phone')) { const r = p.locator('.app .row').nth(3); if (await r.count()) await r.click(); }
    await p.keyboard.press('ArrowRight');
  });
console.log('ERRORS', JSON.stringify(errs));
await b.close();
