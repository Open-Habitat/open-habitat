// node scripts/check-landing.mjs <site-dir> <shots-dir> [<path>...]
// Serves a built site (dist/) on 127.0.0.1 and opens each path (default /)
// in Chromium at 1440 and 390 px. It scrolls the whole page, opens Show work
// in a screen, presses Copy on the install prompt and reads the clipboard,
// pauses and resumes the browser row's live demo (play must continue from the
// paused frame, in the same iframe), turns the wheel over the demo and over
// every screen (the page must scroll, nothing scrolls on its own), and checks
// that under reduced motion the demo starts on its poster and plays on
// request. It fails on a console error or warning, an uncaught exception, a
// failed or 4xx/5xx request, any request to another origin, a broken image or
// sideways scrolling. Screenshots go down the page and of the demo.
// Playwright comes from web/node_modules, or PROTO_WEB=<dir with
// package.json and node_modules>. Exits 1 with the list of failures.
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(path.join(process.env.PROTO_WEB || path.join(repo, 'web'), 'package.json'));
const { chromium } = require('playwright');
const [dir, shots, ...paths] = process.argv.slice(2);
if (!dir || !shots) {
  console.error('usage: node scripts/check-landing.mjs <site-dir> <shots-dir> [<path>...]');
  process.exit(2);
}
mkdirSync(shots, { recursive: true });

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
const root = path.resolve(dir);
const server = createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root)) return res.writeHead(403).end();
  if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'content-length': statSync(p).size });
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const fails = [];
const fail = (m) => {
  fails.push(m);
  console.log(`FAIL ${m}`);
};
const watch = (page, tag) => {
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && fail(`${tag}: console ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => fail(`${tag}: exception: ${e.message}`));
  page.on('request', (r) => !r.url().startsWith(origin) && !r.url().startsWith('data:') && fail(`${tag}: request to another origin: ${r.url()}`));
  page.on('requestfailed', (r) => fail(`${tag}: request failed: ${r.url()} (${r.failure()?.errorText})`));
  page.on('response', (r) => r.status() >= 400 && fail(`${tag}: ${r.status()} ${r.url()}`));
};
const scrollY = (page) => page.evaluate(() => window.scrollY);
// The wheel over the element's middle must move the page, not something inside it.
async function wheelScrolls(page, loc) {
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const bb = await loc.boundingBox();
  const vh = page.viewportSize().height;
  await page.mouse.move(bb.x + bb.width / 3, Math.min(bb.y + bb.height / 2, vh - 40));
  const y0 = await scrollY(page);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  return (await scrollY(page)) - y0 >= 200;
}

const browser = await chromium.launch();
for (const p of paths.length ? paths : ['/']) {
  for (const width of [1440, 390]) {
    const tag = `${width}${p.replace(/\//g, '-').replace(/-$/, '')}`;
    const vh = width > 600 ? 900 : 844;
    const ctx = await browser.newContext({ viewport: { width, height: vh }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    watch(page, tag);
    await page.goto(origin + p, { waitUntil: 'load' });

    // The whole page, step by step, so every lazy image loads.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 600) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(40);
    }
    await page.waitForLoadState('networkidle');
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) fail(`${tag}: the page scrolls sideways`);
    const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.getAttribute('src')));
    if (broken.length) fail(`${tag}: broken images: ${broken.join(', ')}`);
    const inner = await page.evaluate(() =>
      [...document.querySelectorAll('.pg *')]
        .filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1)
        .map((e) => e.className || e.tagName),
    );
    if (inner.length) fail(`${tag}: elements that scroll on their own: ${inner.slice(0, 6).join(' | ')}`);

    // Show work opens in a screen.
    const tog = page.locator('.ah-stage-toggle:visible').first();
    if (await tog.count()) {
      await tog.scrollIntoViewIfNeeded();
      await tog.click();
      if ((await tog.getAttribute('aria-expanded')) !== 'true') fail(`${tag}: Show work did not open`);
      await tog.click();
    } else fail(`${tag}: no Show work on the page`);

    // Copy puts the install prompt on the clipboard.
    const cp = page.locator('.ag-win [data-copy]').first();
    await cp.scrollIntoViewIfNeeded();
    await cp.click();
    await page.waitForTimeout(200);
    if ((await cp.textContent()) !== 'Copied') fail(`${tag}: Copy says "${await cp.textContent()}"`);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    if (!clip.startsWith('Please install Open Habitat') || !clip.includes('docs/operations.md')) fail(`${tag}: Copy put "${clip}" on the clipboard`);

    // The live demo: one iframe sandboxed to scripts, taking no pointer events.
    const fr = page.locator('.demo-frame');
    if ((await fr.count()) !== 1) fail(`${tag}: ${await fr.count()} demo iframes`);
    else {
      if ((await fr.getAttribute('sandbox')) !== 'allow-scripts') fail(`${tag}: the demo's sandbox is "${await fr.getAttribute('sandbox')}"`);
      if ((await fr.evaluate((e) => getComputedStyle(e).pointerEvents)) !== 'none') fail(`${tag}: the demo iframe takes pointer events`);
      await page.locator('.demo').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      if (!(await wheelScrolls(page, page.locator('.demo-box')))) fail(`${tag}: the wheel over the demo did not scroll the page`);
      await page.locator('.demo').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.locator('.demo').screenshot({ path: path.join(shots, `${tag}-demo.png`) });
      // Pause holds the frame; play continues from it, in the same iframe.
      const ctl = page.locator('.demo-ctl');
      if ((await ctl.getAttribute('data-paused')) !== 'false') fail(`${tag}: the demo is not playing`);
      await ctl.click();
      await page.waitForTimeout(400);
      if ((await ctl.getAttribute('data-paused')) !== 'true') fail(`${tag}: the demo did not pause`);
      const tp = Number(await page.locator('.demo').getAttribute('data-t'));
      await page.waitForTimeout(800);
      const handle = await fr.elementHandle();
      await ctl.click();
      await page.waitForTimeout(300);
      const tq = Number(await page.locator('.demo').getAttribute('data-t'));
      if ((await ctl.getAttribute('data-paused')) !== 'false') fail(`${tag}: the demo did not play again`);
      if (!(tq >= tp && tq - tp < 0.6)) fail(`${tag}: play did not continue from the paused frame (${tp} → ${tq} s)`);
      if (!(await handle.evaluate((e) => e.isConnected)) || (await fr.count()) !== 1) fail(`${tag}: the demo iframe was replaced`);
    }

    // The wheel over every feature screen scrolls the page (desktop: screens sit beside the text).
    if (width > 900)
      for (let k = 0, n = await page.locator('.b-scr').count(); k < n; k++)
        if (!(await wheelScrolls(page, page.locator('.b-scr').nth(k)))) fail(`${tag}: the wheel over feature screen ${k + 1} did not scroll the page`);

    // Screenshots down the page.
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const n = Math.min(14, Math.ceil(h / vh));
    for (let i = 0; i < n; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round((i * (h - vh)) / Math.max(1, n - 1)));
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(shots, `${tag}-${String(i).padStart(2, '0')}.png`) });
    }
    await ctx.close();

    // Reduced motion: the demo starts on its poster, and play starts the scene.
    const rctx = await browser.newContext({ viewport: { width, height: vh }, reducedMotion: 'reduce' });
    const rp = await rctx.newPage();
    watch(rp, `${tag} reduced`);
    await rp.goto(origin + p, { waitUntil: 'load' });
    const ctl = rp.locator('.demo-ctl');
    if (await ctl.count()) {
      await ctl.scrollIntoViewIfNeeded();
      await rp.waitForTimeout(300);
      if ((await rp.locator('.demo-frame').count()) !== 0 || !(await rp.locator('.demo-poster').isVisible())) fail(`${tag} reduced: the demo does not start on its poster`);
      if ((await ctl.getAttribute('data-paused')) !== 'true') fail(`${tag} reduced: the control does not offer play`);
      await ctl.click();
      await rp.waitForTimeout(1500);
      if ((await rp.locator('.demo-frame').count()) !== 1 || (await ctl.getAttribute('data-paused')) !== 'false') fail(`${tag} reduced: play did not start the scene`);
    } else fail(`${tag} reduced: no demo control`);
    await rctx.close();
  }
}
await browser.close();
server.close();
if (fails.length) {
  console.log(`${fails.length} failure(s)`);
  process.exit(1);
}
console.log(`ok: ${(paths.length ? paths : ['/']).join(' ')} at 1440 and 390 px; screenshots in ${shots}`);
