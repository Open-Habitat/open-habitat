#!/usr/bin/env node
// Builds the round into one offline file. Each view is the production page as the
// synthetic lab rendered it (capture.mjs), with production's stylesheet and fonts,
// shown in an iframe as wide as the device so production's own breakpoints apply;
// frame.css and frame.js lay round 3's chosen bottom row (Alarivi) over it and
// riff what its tap opens. Production's own places (the ⋯ menu, the Git sheet,
// the model card, the context page) come from the same capture. The lab's
// unknown model is shown as Jari's "Opus 5.5 · Medium".
//   node design-system/prototypes/rounds/2026-11-06-alarivin-valikko/build.mjs [--out <file>]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ds = path.resolve(here, '../../..');
const root = path.resolve(ds, '..');
const cap = path.join(ds, 'prototypes/dist/alarivin-valikko-capture');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? path.resolve(args[outIdx + 1])
  : path.join(root, 'issues/phone-header-second-row-uneven/prototype-4/alarivin-valikko.html');

const read = (...p) => readFileSync(path.join(...p), 'utf8');
const maybe = (f) => (existsSync(path.join(cap, f)) ? model(read(cap, f)) : '');
// The capture pointer's hover and its tooltip are not part of the view.
const model = (s) => s
  .replaceAll(' data-hovered="true"', '')
  .replace(/<div[^>]*role="tooltip"[^>]*>[^<]*<\/div>/g, '')
  .replaceAll('Malli ei tiedossa', 'Opus 5.5')
  .replaceAll('ajattelutaso Ei tiedossa', 'ajattelutaso Medium')
  .replace(/(<span class="ah-set-thinking"[^>]*>(?:<[^>]+>)*)Ei tiedossa/g, '$1Medium')
  .replace('<p class="md-note">fake-pi</p>', '<p class="md-note">anthropic/claude-opus-5-5</p>')
  .replace(/(data-testid="thinking-options"[^>]*>)<li>Ei tiedossa<\/li>/, '$1<li>Low</li><li aria-current="true">Medium</li><li>High</li>');

// Production's @font-face URLs name the design system's font files plus a hash.
const css = read(cap, 'production.css').replace(/url\("\/assets\/([a-z-]+?)-[A-Za-z0-9_]{8}\.woff2"\)/g, (_, f) =>
  `url("data:font/woff2;base64,${readFileSync(path.join(ds, 'fonts', `${f}.woff2`)).toString('base64')}")`);
if (/url\("\/assets\//.test(css)) throw new Error('an asset URL was left in production.css');

const places = (sit) => ({
  menu: maybe(`menu-${sit}-390.html`),
  git: maybe(`git-${sit}-390.html`),
  model: maybe('model-kaynnissa-390.html'),
  ctx: maybe('ctx-kaynnissa-390.html'),
});
const data = {
  css,
  frameCss: read(here, 'frame.css'),
  frameJs: read(here, 'frame.js'),
  places: { uusi: places('uusi'), kaynnissa: places('kaynnissa') },
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
