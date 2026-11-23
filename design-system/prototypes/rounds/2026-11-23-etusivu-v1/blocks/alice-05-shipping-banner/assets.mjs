// node blocks/alice-05-shipping-banner/assets.mjs
//
// Makes the block's two pictures and its history from one real thing: a small
// Git repository holding Example Studio's shop page.
//
//   1. Writes the shop site (site/index.html, site/_includes/banner.html,
//      site/shop.css) into a fresh repository under $TMPDIR and commits it as
//      the block's story goes: Carol's two commits, Bob's agent adding the
//      banner on Tuesday, Alice's agent adding the end date on Thursday. Names,
//      dates and messages are fixed, so the hashes come out the same every run.
//   2. Pushes to a bare repository beside it (the stand-in for the shop's
//      Gitea), so the push output is git's own.
//   3. Renders the committed page at HEAD with Chromium (Playwright from
//      $PROTO_WEB/node_modules) at two widths and writes
//      $ETUSIVU_ASSETS/alice-05-shipping-banner/shop-wide.webp and shop-narrow.webp.
//   4. Prints the git output that block.js quotes (log -S, show, log, push).
//      If a commit message or the page changes, paste the new output there.
//
// Needs git, ImageMagick (convert) and PROTO_WEB. Set TMPDIR to your scratch.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../..');
const ID = 'alice-05-shipping-banner';
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), ID);
mkdirSync(out, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), `${ID}-`));
const repo = join(scratch, 'shop');
const bare = join(scratch, 'shop.git');
mkdirSync(join(repo, 'site/_includes'), { recursive: true });

// ---------- The shop page ----------
// Four hand-printed linens, drawn as block-print repeats on a woven ground.
const print = (id, ground, ink, motif, size = 44) => `<svg class="cloth" viewBox="0 0 200 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <pattern id="p-${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)" fill="${ink}" stroke="${ink}">${motif}</pattern>
    <filter id="w-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" seed="${id.length * 7}"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.34 0.24"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <linearGradient id="f-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>
  </defs>
  <rect width="200" height="240" fill="${ground}"/>
  <rect width="200" height="240" fill="url(#p-${id})"/>
  <rect width="200" height="240" fill="#000" filter="url(#w-${id})"/>
  <rect width="200" height="240" fill="url(#f-${id})"/>
</svg>`;
const FERN = '<g fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M22 40V6"/><path d="M22 34 10 26M22 34l12-8M22 26l-10-7M22 26l10-7M22 18l-7-6M22 18l7-6M22 11l-4-4M22 11l4-4"/></g>';
const ROWAN = '<circle cx="12" cy="12" r="4.6" stroke="none"/><circle cx="22" cy="9" r="4.6" stroke="none"/><circle cx="18" cy="19" r="4.6" stroke="none"/><path d="M26 22c5 3 9 8 10 15" fill="none" stroke-width="2" stroke-linecap="round"/><path d="M32 28c4-3 8-3 10-1-3 3-7 4-10 1z" stroke="none"/>';
const BIRCH = '<g stroke="none"><rect x="6" y="2" width="9" height="40" rx="4.5"/><rect x="28" y="-8" width="9" height="30" rx="4.5"/><rect x="28" y="28" width="9" height="30" rx="4.5"/></g><g stroke-width="1.6" stroke-linecap="round" opacity=".45"><path d="M8 12h4M9 24h5M8 33h3M30 8h4M31 38h4"/></g>';
const FROST = '<g fill="none" stroke-width="2" stroke-linecap="round"><path d="M22 6v32M8 14l28 16M36 14 8 30"/><path d="M22 12l-4-4M22 12l4-4M22 32l-4 4M22 32l4 4M13 17l-5 0M13 17l-1-5M31 27l5 0M31 27l1 5M31 17l5 0M31 17l1-5M13 27l-5 0M13 27l-1 5"/></g>';
const PRODUCTS = [
  ['fern', 'Tea towel', 'Fern', '18', '#e7e0cf', '#2f5d43', FERN],
  ['rowan', 'Tote bag', 'Rowan', '24', '#efe6d6', '#a8432b', ROWAN, 46],
  ['birch', 'Napkins, set of 4', 'Birch', '32', '#d9dcd2', '#3d4a45', BIRCH, 44],
  ['frost', 'Cushion cover', 'Frost', '38', '#2f4858', '#e9e4d6', FROST],
];

const css = `@font-face { font-family: "Instrument Sans"; src: url("FONT") format("woff2"); font-weight: 400 700; }
* { box-sizing: border-box; margin: 0; }
body { font: 400 14px/1.45 "Instrument Sans", system-ui, sans-serif; color: #26302a; background: #faf7f0; -webkit-font-smoothing: antialiased; }
.banner { background: #23432c; color: #f4efe2; text-align: center; padding: 9px 12px; font-weight: 600; font-size: 13.5px; letter-spacing: .01em; }
.banner svg { width: 15px; height: 15px; vertical-align: -3px; margin-right: 7px; }
header { display: flex; align-items: center; gap: 18px; padding: 14px 22px; border-bottom: 1px solid #e6dfd0; }
.brand { font-weight: 700; font-size: 17px; letter-spacing: -.02em; display: flex; align-items: center; gap: 8px; }
.brand i { width: 16px; height: 16px; border-radius: 4px; background: #a8432b; box-shadow: 6px 6px 0 -2px #2f5d43; margin-right: 4px; }
nav { display: flex; gap: 16px; margin-left: auto; font-size: 13px; color: #55605a; }
nav b { color: #26302a; font-weight: 600; }
.bag { font-size: 13px; font-weight: 600; border: 1px solid #cfc7b5; border-radius: 99px; padding: 4px 11px; }
.hero { display: grid; grid-template-columns: 1.05fr 1fr; gap: 20px; padding: 20px 22px 16px; align-items: stretch; }
.hero small { font-weight: 600; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #a8432b; }
.hero h1 { font-size: 27px; line-height: 1.05; letter-spacing: -.035em; font-weight: 700; margin: 8px 0 10px; }
.hero p { color: #55605a; font-size: 14px; max-width: 30ch; }
.cta { display: inline-block; margin-top: 14px; padding: 9px 16px; border-radius: 99px; background: #26302a; color: #faf7f0; font-weight: 600; font-size: 13px; }
.hero .cloth { width: 100%; height: 172px; border-radius: 12px; display: block; }
.hero-pic { position: relative; align-self: start; }
.hero-pic span { position: absolute; left: 10px; bottom: 10px; background: #faf7f0; border-radius: 99px; padding: 4px 10px; font-size: 11.5px; font-weight: 600; }
h2 { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: #55605a; padding: 4px 22px 10px; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 0 22px 24px; }
.card .cloth { width: 100%; aspect-ratio: 5 / 6; border-radius: 10px; display: block; }
.card b { display: block; margin-top: 8px; font-size: 13px; font-weight: 600; line-height: 1.25; }
.card span { display: flex; justify-content: space-between; font-size: 12.5px; color: #55605a; }
.card span i { font-style: normal; color: #26302a; font-weight: 600; }
@media (max-width: 480px) {
  .banner { font-size: 12px; padding: 8px 6px; } .banner svg { width: 13px; height: 13px; margin-right: 5px; }
  header { padding: 12px 16px; } nav { display: none; } .bag { margin-left: auto; }
  .hero { grid-template-columns: 1fr; padding: 18px 16px 14px; gap: 14px; }
  .hero h1 { font-size: 26px; } .hero .cloth { height: 120px; }
  h2 { padding: 4px 16px 10px; } .grid { grid-template-columns: repeat(2, 1fr); padding: 0 16px 20px; }
}
`;
const page = (winter) => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Example Studio · hand-printed linen</title>
<link rel="stylesheet" href="shop.css">
{% include banner.html %}
<header>
  <span class="brand"><i></i>Example Studio</span>
  <nav><b>Shop</b><span>${winter ? 'Winter prints' : 'Prints'}</span><span>Courses</span><span>Wholesale</span></nav>
  <span class="bag">Bag · 0</span>
</header>
<section class="hero">
  <div>
    <small>${winter ? 'New · winter prints' : 'Hand-printed linen'}</small>
    <h1>Linen, printed by hand, one block at a time.</h1>
    <p>Tea towels, totes and napkins from our studio. Every piece is cut, printed and sewn by the seven of us.</p>
    <span class="cta">${winter ? 'See the winter prints' : 'See the shop'}</span>
  </div>
  <div class="hero-pic">${print('hero', '#e7e0cf', '#a8432b', ROWAN, 46)}<span>Rowan, on washed linen</span></div>
</section>
<h2>From the studio this week</h2>
<section class="grid">
${PRODUCTS.map(([id, what, name, eur, ground, ink, motif, size]) => `  <div class="card">${print(id, ground, ink, motif, size)}<b>${what}</b><span>${name}<i>€${eur}</i></span></div>`).join('\n')}
</section>
</html>
`;
const TRUCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h11v10H2zM13 9h5l4 4v3h-9z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/></svg>';
const banner = (text) => `<p class="banner">\n  {% include truck.svg %}\n  ${text}\n</p>\n`;

// ---------- The history ----------
const git = (args, env = {}) => execFileSync('git', args, { cwd: repo, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', TZ: 'Europe/Helsinki', LC_ALL: 'C', ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const put = (file, text) => writeFileSync(join(repo, file), text);
const commit = (who, date, msg) => {
  const env = { GIT_AUTHOR_NAME: who, GIT_AUTHOR_EMAIL: `${who.split(' ')[0].toLowerCase()}@example.org`, GIT_AUTHOR_DATE: date, GIT_COMMITTER_NAME: who, GIT_COMMITTER_EMAIL: `${who.split(' ')[0].toLowerCase()}@example.org`, GIT_COMMITTER_DATE: date };
  git(['add', '-A'], env);
  git(['commit', '-q', '-m', msg], env);
};
git(['init', '-q', '-b', 'main']);
execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
git(['remote', 'add', 'origin', bare]);

put('site/shop.css', css.replace('FONT', 'fonts/instrument-sans-latin.woff2'));
put('site/index.html', page(false));
put('site/_includes/banner.html', '');
put('site/_includes/truck.svg', `${TRUCK}\n`);
commit('Carol (agent)', '2026-10-09T11:20:00+03:00', 'Shop front page: four products from the studio\n\nCarol: start the front page with the tea towel, the tote, the\nnapkins and the cushion cover. Photos follow.');
put('site/index.html', page(true));
commit('Carol (agent)', '2026-11-12T14:05:00+02:00', 'Front page: lead with the winter prints\n\nCarol: Rowan goes on top, and the menu says "Winter prints".');
put('site/_includes/banner.html', banner('Free shipping over €30'));
commit('Bob (agent)', '2026-11-17T16:42:00+02:00', 'Add free-shipping banner for Northside week\n\nBob: Northside pays the postage on orders over €30\nuntil Sunday 22 Nov. Take it down on Monday.');
git(['push', '-q', 'origin', 'main']);
put('site/_includes/banner.html', banner('Free shipping over €30 until Sunday 22 November'));
const worktreeDiff = git(['diff', '--stat']);
commit('Alice (agent)', '2026-11-19T09:49:00+02:00', 'Banner: free shipping ends on Sunday 22 November\n\nAlice: add "until Sunday" to it. The banner did not say that\nthe offer ends; Bob\'s note in a41c9e2 gives the date.'.replace('a41c9e2', git(['log', '-1', '--format=%h']).trim()));
// git writes a push's report to stderr; keep the line that names the range.
const pushed = spawnSync('git', ['push', 'origin', 'main'], { cwd: repo, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C' }, encoding: 'utf8' });
const push = pushed.stderr.split('\n').filter((l) => l.includes('->')).join('\n');

const FMT = '--format=%h  %ad  %an%n    %s%n%w(0,4,4)%b';
const show = (title, text) => console.log(`\n--- ${title}\n${text.trimEnd()}`);
show('git log -S "Free shipping" --reverse -- site/', git(['log', '-S', 'Free shipping', '--reverse', '--date=format:%a %d %b %H:%M', FMT, '--', 'site/']));
show('git log -S "Free shipping" --reverse -- site/   (git\'s default format)', git(['log', '-S', 'Free shipping', '--reverse', '--', 'site/']));
show('git show <banner commit> -- site/_includes/banner.html', git(['show', '--format=', 'HEAD~1', '--', 'site/_includes/banner.html']));
show('git diff HEAD~1 HEAD', git(['diff', 'HEAD~1', 'HEAD']));
show('git log --oneline (all)', git(['log', '--date=format:%a %d %b %H:%M', '--format=%h|%ad|%an|%s']));
show('git diff --stat (before the last commit)', worktreeDiff);
show('git show --stat HEAD', git(['show', '--stat', '--format=%h %s', 'HEAD']));
show('git push origin main', push);

// ---------- The pictures: the committed page, rendered ----------
const build = join(scratch, 'build');
mkdirSync(join(build, 'fonts'), { recursive: true });
// The site's build step, as small as it gets: includes are pasted in.
const include = (text) => text.replace(/\{% include (\S+) %\}/g, (_, f) => include(git(['show', `HEAD:site/_includes/${f}`])));
writeFileSync(join(build, 'index.html'), include(git(['show', 'HEAD:site/index.html'])));
writeFileSync(join(build, 'shop.css'), git(['show', 'HEAD:site/shop.css']));
writeFileSync(join(build, 'fonts/instrument-sans-latin.woff2'), readFileSync(join(root, 'design-system/fonts/instrument-sans-latin.woff2')));
const web = process.env.PROTO_WEB || join(root, 'web');
const { chromium } = createRequire(join(web, 'package.json'))('playwright');
const browser = await chromium.launch();
for (const [name, w, h] of [['shop-wide', 600, 500], ['shop-narrow', 360, 560]]) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await pg.goto(pathToFileURL(join(build, 'index.html')).href);
  await pg.evaluate(() => document.fonts.ready);
  const png = join(scratch, `${name}.png`);
  await pg.screenshot({ path: png });
  execFileSync('convert', [png, '-quality', '86', '-define', 'webp:method=6', join(out, `${name}.webp`)]);
  await pg.close();
}
await browser.close();
console.log(`\n${execFileSync('identify', ['-format', '%f %wx%h %b\n', join(out, 'shop-wide.webp'), join(out, 'shop-narrow.webp')]).toString().trim()}`);
