// node scripts/og-image.mjs [<out-dir>]
// Renders the site's share image (og:image, 1200 × 630) and its 180 px
// apple-touch-icon from HTML with Playwright into public/og.png and
// public/apple-touch-icon.png, or into <out-dir>. The share image is the product's own
// look: the design system's tokens and fonts, the mark from
// src/components/mark.ts, the hero's headline and the hero capture
// (public/landing/hero/hero.webp, the fictional Example Studio). Everything it
// loads is a local file, so the image has no outside resources.
//
// Share previews crop: some apps show a centred square or a 1.91:1 strip, and
// every app shows it small (about 400 px wide). So the headline sits in the
// middle third, large enough to read at a third of its size, and the capture
// below it is a glimpse, not something to read.
//
// Playwright comes from web/node_modules, or PROTO_WEB=<dir with package.json
// and node_modules>, as in check-landing.mjs. The page HTML is written to
// $TMPDIR (os.tmpdir()).
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mark } from '../src/components/mark.ts';

const site = fileURLToPath(new URL('..', import.meta.url));
const repo = path.join(site, '..');
const require = createRequire(path.join(process.env.PROTO_WEB || path.join(repo, 'web'), 'package.json'));
const { chromium } = require('playwright');

const outDir = path.resolve(process.argv[2] || path.join(site, 'public'));
const file = (p) => pathToFileURL(path.join(site, p)).href;

// The hero's headline (the round's blocks/hero/block.js) and its eyebrow.
const headline = 'Coding-grade AI agents<br>for your whole team.';
const eyebrow = 'Open source · on your own server · in a browser tab';

const og = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${file('../design-system/styles.css')}">
<link rel="stylesheet" href="${file('src/styles/brand.css')}">
<style>
  html, body { margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden; position: relative;
    background: var(--ah-bg); color: var(--ah-ink);
    font-family: var(--ah-font); -webkit-font-smoothing: antialiased;
  }
  .head { position: absolute; inset: 0 0 auto; text-align: center; padding-top: 40px; }
  .brand {
    display: inline-flex; align-items: center; gap: 12px;
    font-size: 30px; font-weight: 600; letter-spacing: -0.01em;
  }
  .brand .oh-mark { color: var(--ah-accent); }
  h1 {
    margin: 22px 0 0; font-size: 66px; line-height: 1.04;
    letter-spacing: -0.03em; font-weight: 600;
  }
  .eyebrow { margin: 16px 0 0; font-size: 22px; color: var(--ah-muted); letter-spacing: 0.01em; }
  /* The capture spans the full width: its background is a soft vignette, so
     a band colour beside it would show a seam. */
  .band { position: absolute; inset: 346px 0 0; overflow: hidden; }
  .band img { position: absolute; left: 0; top: -24px; width: 1200px; }
</style>
</head>
<body>
  <div class="band"><img src="${file('public/landing/hero/hero.webp')}" alt=""></div>
  <div class="head">
    <div class="brand">${mark('idle', 40)}<span>Open Habitat</span></div>
    <h1>${headline}</h1>
    <p class="eyebrow">${eyebrow}</p>
  </div>
</body>
</html>`;

// The touch icon: the mark in the accent colour on the page background,
// inside the safe area iOS leaves when it rounds the corners.
const icon = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${file('../design-system/styles.css')}">
<link rel="stylesheet" href="${file('src/styles/brand.css')}">
<style>
  html, body { margin: 0; }
  body { width: 180px; height: 180px; display: grid; place-items: center; background: var(--ah-bg); }
  .oh-mark { color: var(--ah-accent); }
</style>
</head>
<body>${mark('idle', 112)}</body>
</html>`;

const shots = [
  { name: 'og.png', html: og, width: 1200, height: 630, fonts: ['600 66px "Instrument Sans"'] },
  { name: 'apple-touch-icon.png', html: icon, width: 180, height: 180, fonts: [] },
];

const tmp = mkdtempSync(path.join(os.tmpdir(), 'og-image-'));
const browser = await chromium.launch();
try {
  for (const { name, html, width, height, fonts } of shots) {
    const page = path.join(tmp, `${name}.html`);
    const out = path.join(outDir, name);
    writeFileSync(page, html);
    const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const outside = [];
    tab.on('request', (r) => { if (!r.url().startsWith('file:')) outside.push(r.url()); });
    await tab.goto(pathToFileURL(page).href, { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    const missing = await tab.evaluate((list) => list.filter((f) => !document.fonts.check(f)), fonts);
    if (outside.length || missing.length) {
      throw new Error(`${name}: outside requests: ${outside.join(', ') || 'none'}; missing fonts: ${missing.join(', ') || 'none'}`);
    }
    await tab.screenshot({ path: out, type: 'png' });
    await tab.close();
    console.log(`${path.relative(process.cwd(), out)} ${Math.round(statSync(out).size / 1024)} KB`);
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
