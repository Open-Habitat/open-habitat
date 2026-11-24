// node scripts/check-landing.mjs <site-dir> <shots-dir> [<path>...]
// Serves a built site (dist/, or the round's `node build.mjs <out>` for
// comparison) on 127.0.0.1 and opens each path (default /) in
// Chromium at 1440 and 390 px with reduced motion. It scrolls the whole page,
// opens Show work in a few blocks (on the phone, where each step is a timeline
// row, it opens the row first), plays a video, and fails on a console error,
// an uncaught exception, a failed or 4xx/5xx request, any request to another
// origin, or sideways scrolling. Screenshots: the top, Alice's day, a role,
// the capability section, the install section and the page's end (those that
// exist).
// Playwright comes from web/node_modules, or PROTO_WEB=<dir with
// package.json and node_modules> as in the round's check.mjs. Exits 1 with
// the list of failures. The round's check.mjs checks each block in depth;
// this checks the page as the site serves it.
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
  const size = statSync(p).size;
  const type = TYPES[path.extname(p)] || 'application/octet-stream';
  // Ranges, so a video plays as it would from Pages.
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    return createReadStream(p, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const fails = [];
const fail = (m) => {
  fails.push(m);
  console.log(`FAIL ${m}`);
};
const SECTIONS = [
  ['top', 'body'],
  ['alice', '#g-alice-video'],
  ['role', '#role-carol'],
  ['caps', '#can'],
  ['install', '#install'],
  ['end', 'footer.site-foot'],
];

const browser = await chromium.launch();
for (const p of paths.length ? paths : ['/']) {
  for (const width of [1440, 390]) {
    const tag = `${width}${p.replace(/\//g, '-').replace(/-$/, '')}`;
    const page = await browser.newPage({ viewport: { width, height: width > 600 ? 900 : 844 }, reducedMotion: 'reduce' });
    page.on('console', (m) => m.type() === 'error' && fail(`${tag}: console: ${m.text()}`));
    page.on('pageerror', (e) => fail(`${tag}: exception: ${e.message}`));
    page.on('request', (r) => !r.url().startsWith(origin) && !r.url().startsWith('data:') && fail(`${tag}: request to another origin: ${r.url()}`));
    page.on('requestfailed', (r) => {
      // A video's request is cancelled when it scrolls out of view.
      if (r.failure()?.errorText !== 'net::ERR_ABORTED' || r.resourceType() !== 'media') fail(`${tag}: request failed: ${r.url()} (${r.failure()?.errorText})`);
    });
    page.on('response', (r) => r.status() >= 400 && fail(`${tag}: ${r.status()} ${r.url()}`));
    await page.goto(origin + p, { waitUntil: 'load' });

    // The whole page, step by step, so every lazy image and sticky screen loads.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 600) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(40);
    }
    await page.waitForLoadState('networkidle');
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) fail(`${tag}: the page scrolls sideways`);

    // Show work in a few blocks: scrolled to the block, the summary row on screen
    // (on the desktop the sticky screen's, on the phone the step's own).
    // A screen may scroll inside itself (the sticky screen shows its end), so a
    // row of the block's own counts too; the click scrolls it into view.
    const onScreen = async (sel, block = '') =>
      page.evaluate(([sel, block]) => {
        document.querySelectorAll('[data-check-pick]').forEach((e) => e.removeAttribute('data-check-pick'));
        const el = [...document.querySelectorAll(sel)].find((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && ((r.top < innerHeight && r.bottom > 0) || (block && e.closest(`[data-block="${block}"]`)));
        });
        if (el) el.setAttribute('data-check-pick', '');
        return Boolean(el);
      }, [sel, block]);
    // On the phone a step's screen is behind its row: open it as a reader would.
    const openRow = (loc) =>
      loc.evaluate((e) => {
        const step = e.matches('.s1-step') ? e : e.querySelector('.s1-step');
        const b = step?.querySelector(':scope > .s1-row button');
        if (b && b.offsetParent && b.getAttribute('aria-expanded') !== 'true') b.click();
      });
    let opened = 0;
    for (const block of ['alice-01-whats-waiting', 'alice-08-returns-workers', 'role-frank', 'caps-pictures']) {
      const anchor = page.locator(`[data-block="${block}"]`).first();
      if (!(await anchor.count())) continue;
      await openRow(anchor);
      await anchor.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      if (!(await onScreen('.ah-stage-toggle', block))) {
        fail(`${tag}: ${block}: no Show work on screen`);
        continue;
      }
      const toggle = page.locator('[data-check-pick]').first();
      await toggle.click();
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') fail(`${tag}: ${block}: Show work did not open`);
      else opened++;
      await toggle.click();
    }
    if (p === '/' && opened === 0) fail(`${tag}: no Show work found to open`);

    // A video plays from the site's origin.
    const glimpse = page.locator('#g-alice-video');
    if (await glimpse.count()) {
      await openRow(glimpse);
      await glimpse.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      if (await onScreen('video')) {
        const t = await page.locator('[data-check-pick]').first().evaluate(async (v) => {
          v.muted = true;
          await v.play();
          await new Promise((r) => setTimeout(r, 1200));
          return v.currentTime;
        });
        if (!(t > 0)) fail(`${tag}: the video did not play`);
      } else fail(`${tag}: no video on screen at Alice's market video`);
    }

    for (const [name, sel] of SECTIONS) {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      if (sel === 'body') await page.evaluate(() => window.scrollTo(0, 0));
      else await el.evaluate((e) => e.scrollIntoView({ block: e.tagName === 'FOOTER' ? 'end' : 'start' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(shots, `${tag}-${name}.png`) });
    }
    await page.close();
  }
}
await browser.close();
server.close();
if (fails.length) {
  console.log(`${fails.length} failure(s)`);
  process.exit(1);
}
console.log(`ok: ${(paths.length ? paths : ['/']).join(' ')} at 1440 and 390 px; screenshots in ${shots}`);
