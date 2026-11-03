#!/usr/bin/env node
// Builds the round into one offline file. Each view is the production page as the
// synthetic lab rendered it (capture.mjs), with production's stylesheet and fonts,
// shown in an iframe as wide as the device so production's own breakpoints apply;
// frame.css and frame.js lay each direction over it. The lab's unknown model is
// shown as Jari's "Opus 5.5 · Medium".
//   node design-system/prototypes/rounds/2026-11-03-otsakkeen-jako/build.mjs [--out <file>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ds = path.resolve(here, '../../..');
const root = path.resolve(ds, '..');
const cap = path.join(ds, 'prototypes/dist/otsakkeen-jako-capture');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? path.resolve(args[outIdx + 1])
  : path.join(root, 'issues/phone-header-second-row-uneven/prototype-2/otsakkeen-jako.html');

const read = (...p) => readFileSync(path.join(...p), 'utf8');
// The capture pointer's hover and its tooltip are not part of the view.
const model = (s) => s
  .replaceAll(' data-hovered="true"', '')
  .replace(/<div[^>]*role="tooltip"[^>]*>[^<]*<\/div>/g, '')
  .replaceAll('Malli ei tiedossa', 'Opus 5.5')
  .replaceAll('ajattelutaso Ei tiedossa', 'ajattelutaso Medium')
  .replace(/(<span class="ah-set-thinking"[^>]*>(?:<[^>]+>)*)Ei tiedossa/g, '$1Medium');

// Production's @font-face URLs name the design system's font files plus a hash.
const css = read(cap, 'production.css').replace(/url\("\/assets\/([a-z-]+?)-[A-Za-z0-9_]{8}\.woff2"\)/g, (_, f) =>
  `url("data:font/woff2;base64,${readFileSync(path.join(ds, 'fonts', `${f}.woff2`)).toString('base64')}")`);
if (/url\("\/assets\//.test(css)) throw new Error('an asset URL was left in production.css');

// The new conversation's composer model chip, for the running conversation.
function element(html, start) {
  const tag = html.slice(start + 1).match(/^[a-z]+/)[0];
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m; (m = re.exec(html));) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (!depth) return html.slice(start, re.lastIndex);
  }
  throw new Error(`unclosed <${tag}>`);
}
const uusi = model(read(cap, 'uusi-390.html'));
const chip = element(uusi, uusi.indexOf('<div class="ah-composer-model"'));

const data = {
  css,
  frameCss: read(here, 'frame.css'),
  frameJs: read(here, 'frame.js'),
  menus: { uusi: model(read(cap, 'menu-uusi-390.html')), kaynnissa: model(read(cap, 'menu-kaynnissa-390.html')) },
  chip,
  snaps: Object.fromEntries(['uusi-390', 'uusi-1440', 'kaynnissa-390', 'kaynnissa-1440']
    .map((k) => [k, model(read(cap, `${k}.html`))])),
};
const html = read(here, 'page.html')
  .replace('/*PICKER_CSS*/', () => read(ds, 'prototypes/lib/picker.css'))
  .replace('/*PICKER_JS*/', () => read(ds, 'prototypes/lib/picker.js'))
  .replace('/*DATA*/', () => JSON.stringify(data).replace(/</g, '\\u003c'));
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${path.relative(root, out)} (${Math.round(html.length / 1024)} KiB)`);
