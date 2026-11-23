// node blocks/caps-web/assets.mjs: the web block's showpieces, made by the
// programs the screens name. Set TMPDIR to your scratch (never /tmp) and
// PROTO_WEB to a web/ directory with node_modules (Playwright and its Chromium).
//
//   club.webp           Riverside Rowing Club's site built by Hugo from the
//                       Markdown, data file and layouts in src/club/, with three
//                       CC0 photographs from Wikimedia Commons resized by Hugo's
//                       own image pipeline; served locally and captured by
//                       Chromium at 440 CSS px wide, the whole page, 2×.
//   src/check/findings.json
//                       Not a binary and not shipped as an asset: the true
//                       findings the block's report draws. Example Studio's shop
//                       (src/shop/make_shop.py, 105 pages with planted problems)
//                       is served locally, the retired supplier pages from a
//                       second local server, and checked as it is and again as
//                       the agent fixed it (--fixed): lychee over every page in
//                       the sitemap, pa11y-ci (axe and HTML_CodeSniffer) over
//                       the sitemap, Lighthouse (performance, simulated mobile)
//                       on every product page before and on the slow ones after.
//
// Tools come from $CAPS_WEB_TOOLS (default $TMPDIR/caps-web-tools) and are
// installed there when missing: the official Hugo extended and lychee release
// binaries from GitHub, and Lighthouse and pa11y-ci from npm. Chromium is
// Playwright's. Versions used for the shipped files are in NOTES.md.
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { arch, homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const root = resolve(here, '../../../../../..');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'caps-web');
mkdirSync(out, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'caps-web-'));
const tools = process.env.CAPS_WEB_TOOLS || join(tmpdir(), 'caps-web-tools');
mkdirSync(tools, { recursive: true });
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 << 20, ...opts }).toString();
const sh = (script, opts) => run('/bin/sh', ['-c', script], opts);
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const chrome = chromium.executablePath();

// ---------- Tools ----------
const plat = arch() === 'arm64' ? { hugo: 'linux-arm64', lychee: 'aarch64-unknown-linux-gnu' } : { hugo: 'linux-amd64', lychee: 'x86_64-unknown-linux-gnu' };
const HUGO_V = '0.170.1';
const LYCHEE_V = '0.24.2';
const hugo = join(tools, `hugo-${HUGO_V}/hugo`);
if (!existsSync(hugo)) {
  mkdirSync(dirname(hugo), { recursive: true });
  sh(`curl -sSfL https://github.com/gohugoio/hugo/releases/download/v${HUGO_V}/hugo_extended_${HUGO_V}_${plat.hugo}.tar.gz | tar -xz -C "${dirname(hugo)}" hugo`);
}
const lychee = join(tools, `lychee-${LYCHEE_V}/lychee`);
if (!existsSync(lychee)) {
  mkdirSync(dirname(lychee), { recursive: true });
  sh(`curl -sSfL https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_V}/lychee-${plat.lychee}.tar.gz | tar -xz -C "${dirname(lychee)}" --strip-components=1 lychee-${plat.lychee}/lychee`);
}
const npmDir = join(tools, 'npm');
const bin = (n) => join(npmDir, 'node_modules/.bin', n);
if (!existsSync(bin('pa11y-ci')) || !existsSync(bin('lighthouse'))) {
  mkdirSync(npmDir, { recursive: true });
  writeFileSync(join(npmDir, 'package.json'), '{"private":true}\n');
  run('npm', ['install', '--silent', '--no-audit', '--no-fund', 'lighthouse@13', 'pa11y-ci@4'], { cwd: npmDir, env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' } });
}

// A static server for a directory; python's http.server is threaded and enough.
const serve = async (dir) => {
  const port = 18000 + Math.floor(Math.random() * 3000);
  const proc = spawn('python3', ['-I', '-m', 'http.server', String(port), '-b', '127.0.0.1', '-d', dir], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { await fetch(base); break; } catch { /* not up yet */ }
    if (i > 100) throw new Error(`server for ${dir} did not start`);
    await new Promise((r) => setTimeout(r, 100));
  }
  return { base, port, stop: () => proc.kill() };
};

// ---------- club.webp: Hugo ----------
// CC0 photographs from Wikimedia Commons (sources and authors in NOTES.md).
const PHOTOS = {
  'hero.jpg': 'd/d8/St_George%27s_College_Boat_Club%2C_Desborough_Cut%2C_River_Thames.jpg',
  'fog.jpg': '5/5e/Ripple_on_a_foggy_buoyed_late.jpg',
  'archive-scan.jpg': '8/86/Rowing_on_the_River_Murray%28GN14199%29.jpg',
};
const photoCache = join(tools, 'photos');
mkdirSync(photoCache, { recursive: true });
for (const [name, path] of Object.entries(PHOTOS)) {
  const f = join(photoCache, name);
  if (!existsSync(f)) run('curl', ['-sSfL', '-A', 'open-habitat-landing-assets/1.0', '-o', f, `https://upload.wikimedia.org/wikipedia/commons/${path}`]);
}
const club = join(scratch, 'club');
cpSync(join(src, 'club'), club, { recursive: true });
mkdirSync(join(club, 'assets/photos'), { recursive: true });
mkdirSync(join(club, 'static/fonts'), { recursive: true });
cpSync(join(photoCache, 'hero.jpg'), join(club, 'assets/photos/hero.jpg'));
cpSync(join(photoCache, 'fog.jpg'), join(club, 'assets/photos/fog.jpg'));
// The 1930s negative scan keeps its film rebate and pencilled numbers; crop to the picture.
run('convert', [join(photoCache, 'archive-scan.jpg'), '-gravity', 'center', '-crop', '86%x78%+0+0', '+repage', '-resize', '1600x', join(club, 'assets/photos/archive.jpg')]);
cpSync(join(root, 'design-system/fonts/instrument-sans-latin.woff2'), join(club, 'static/fonts/instrument-sans-latin.woff2'));
console.log(run(hugo, ['--minify', '--quiet', '-s', club, '-d', join(scratch, 'club-public')]).trim() || 'hugo: site built');

const browser = await chromium.launch();
{
  const srv = await serve(join(scratch, 'club-public'));
  try {
    const page = await browser.newPage({ viewport: { width: 440, height: 1060 }, deviceScaleFactor: 2 });
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(scratch, 'club.png'), fullPage: true });
    await page.close();
  } finally { srv.stop(); }
  run('convert', [join(scratch, 'club.png'), '-quality', '80', '-define', 'webp:method=6', join(out, 'club.webp')]);
}
await browser.close();

// CAPS_WEB_ONLY=club remakes the picture alone (the shop checks take ten minutes).
if (process.env.CAPS_WEB_ONLY === 'club') {
  rmSync(scratch, { recursive: true, force: true });
  console.log(run('identify', ['-format', '%f %wx%h %b\n', join(out, 'club.webp')]).trim());
  process.exit(0);
}

// ---------- findings.json: lychee, pa11y-ci, Lighthouse on the shop ----------
// One linen swatch per colour, in three sizes; the "original" is the 4000 px
// photograph (about 4.4 MB) that eleven pages carry before the fix.
const swatches = join(scratch, 'swatches');
mkdirSync(swatches);
const COLOURS = { indigo: '#2c3e6b', rust: '#a2512c', moss: '#5d6b3a', charcoal: '#3a3a3a', ochre: '#c08a2e', 'sea-blue': '#3f7a8c' };
for (const [n, c] of Object.entries(COLOURS)) {
  const o = join(swatches, `${n}-original.jpg`);
  run('convert', ['-size', '4000x4000', `xc:${c}`, '-seed', '7', '-attenuate', '0.5', '+noise', 'Gaussian', '-motion-blur', '0x2+90', '-quality', '90', o]);
  run('convert', [o, '-resize', '1200', '-quality', '78', join(swatches, `${n}.jpg`)]);
  run('convert', [o, '-resize', '400', '-quality', '75', join(swatches, `${n}-thumb.jpg`)]);
}
const supplier = join(scratch, 'supplier');
mkdirSync(join(supplier, 'catalogue/2026'), { recursive: true });
writeFileSync(join(supplier, 'catalogue/2026/index.html'), '<!doctype html><html lang="en"><title>Northside linen · catalogue 2026</title><h1>Catalogue 2026</h1></html>\n');
const sup = await serve(supplier);

const check = async (variant) => {
  const dir = join(scratch, variant);
  console.log(run('python3', ['-I', join(src, 'shop/make_shop.py'), join(dir, 'site'), ...(variant === 'after' ? ['--fixed'] : [])]).trim());
  cpSync(swatches, join(dir, 'site/photos'), { recursive: true });
  const products = readFileSync(join(dir, 'products.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
  const srv = await serve(join(dir, 'site'));
  const local = (u) => u.replace('https://shop.example.org', srv.base);
  const pub = (u) => u.replace(srv.base, 'https://shop.example.org').replace(sup.base, 'https://northside.example.org');
  try {
    const urls = [...readFileSync(join(dir, 'site/sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => local(m[1]));
    // lychee exits 2 when it finds broken links; the JSON is the result either way.
    try { run(lychee, ['--no-progress', '--format', 'json', '--output', join(dir, 'lychee.json'), '--remap', `https://northside.example.org ${sup.base}`, ...urls]); } catch (e) { if (e.status !== 2) throw e; }
    const ly = JSON.parse(readFileSync(join(dir, 'lychee.json'), 'utf8'));
    const dead = Object.entries(ly.error_map).flatMap(([from, errs]) => errs.map((e) => ({ from: pub(from), url: e.remap ? e.remap.original.url : pub(e.url), code: e.status.code })));
    const deadBy = {};
    for (const d of dead) (deadBy[d.url] ||= { url: d.url, code: d.code, pages: 0 }).pages++;

    writeFileSync(join(dir, 'pa11y.json'), JSON.stringify({ defaults: { standard: 'WCAG2AA', runners: ['axe', 'htmlcs'], concurrency: 1, timeout: 60000, chromeLaunchConfig: { executablePath: chrome, args: ['--no-sandbox'] } } }));
    let pa;
    try { pa = run(bin('pa11y-ci'), ['--config', join(dir, 'pa11y.json'), '--json', '--sitemap', `${srv.base}/sitemap.xml`, '--sitemap-find', 'https://shop.example.org', '--sitemap-replace', srv.base], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { if (e.status !== 2) throw e; pa = e.stdout.toString(); }
    pa = JSON.parse(pa);
    const a11y = Object.entries(pa.results).flatMap(([u, issues]) => issues.map((i) => {
      if (typeof i !== 'object' || !i.runner) throw new Error(`pa11y failed on ${u}: ${i.message || i}`);
      return { page: pub(u), runner: i.runner, code: i.code, message: i.message, context: i.context };
    }));

    // Lighthouse: before on every product page, after on the pages that were slow.
    const before = variant === 'before';
    const lhPages = products.filter((p) => before || p[2] === '1').map((p) => `${srv.base}/${p[1]}/${p[0]}/`);
    const lh = [];
    const one = (u, i) => {
      const f = join(dir, `lh-${i}.json`);
      run(bin('lighthouse'), [u, '--only-categories=performance', '--output=json', `--output-path=${f}`, '--quiet', '--chrome-flags=--headless=new --no-sandbox'], { env: { ...process.env, CHROME_PATH: chrome } });
      const r = JSON.parse(readFileSync(f, 'utf8'));
      return { page: pub(u), score: r.categories.performance.score, lcp_s: +(r.audits['largest-contentful-paint'].numericValue / 1000).toFixed(1), bytes: r.audits['total-byte-weight'].numericValue, lighthouse: r.lighthouseVersion };
    };
    // One page at a time, so the runs do not compete for the CPU.
    for (const [i, u] of lhPages.entries()) lh.push(one(u, i));
    return {
      pages: urls.length,
      links: { total: ly.total, unique: ly.unique, ok: ly.successful, dead: dead.length, by_target: Object.values(deadBy).sort((a, b) => b.pages - a.pages) },
      a11y: { pages: pa.total, passing: pa.passes, issues: a11y },
      speed: lh,
    };
  } finally { srv.stop(); }
};

let findings;
try {
  findings = { shop: 'https://shop.example.org', before: await check('before'), after: await check('after') };
} finally { sup.stop(); }
findings.versions = {
  lychee: run(lychee, ['--version']).trim(),
  pa11y_ci: JSON.parse(readFileSync(join(npmDir, 'node_modules/pa11y-ci/package.json'), 'utf8')).version,
  axe_core: JSON.parse(readFileSync(join(npmDir, 'node_modules/axe-core/package.json'), 'utf8')).version,
  lighthouse: findings.before.speed[0]?.lighthouse,
  hugo: run(hugo, ['version']).split(' ')[1],
};
mkdirSync(join(src, 'check'), { recursive: true });
writeFileSync(join(src, 'check/findings.json'), JSON.stringify(findings, null, 1) + '\n');
rmSync(scratch, { recursive: true, force: true });
console.log(run('identify', ['-format', '%f %wx%h %b\n', join(out, 'club.webp')]).trim());
const b = findings.before; const a = findings.after;
console.log(`before: ${b.links.dead} dead links, ${b.a11y.issues.length} a11y issues, ${b.speed.filter((s) => s.bytes > 1e6).length} pages over 1 MB`);
console.log(`after:  ${a.links.dead} dead links, ${a.a11y.issues.length} a11y issues, ${a.speed.filter((s) => s.bytes > 1e6).length} pages over 1 MB`);
