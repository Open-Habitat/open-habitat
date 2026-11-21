#!/usr/bin/env node
// Builds the attention-sound round 2 into one self-contained HTML file.
//
//   node build.mjs [--out <file>]     # default ../../dist/2026-11-21-attention-sounds-2.html
//
// Plain JavaScript, no bundler: tokens with the bundled fonts embedded, the
// shared picker (lib/picker.css and lib/picker.js unchanged, given a stage
// sink), synth.mjs with its `export` keywords stripped, then round.js. No audio
// file is embedded: the page renders every sound from its recipe.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILIES, RECOMMENDED, SOUNDS } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lib = resolve(here, '../../lib'), ds = resolve(here, '../../..');
const round = '2026-11-21-attention-sounds-2';
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? resolve(args[outIdx + 1]) : resolve(here, '../../dist', `${round}.html`);
const read = (p) => readFileSync(p, 'utf8');
const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const tokens = ['colors', 'typography', 'spacing', 'motion'].map(n => read(join(ds, `tokens/${n}.css`))).join('\n')
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(ds, 'fonts', f)).toString('base64')}")`);
const synth = read(join(here, 'synth.mjs')).replace(/^export /gm, '');
const name = (id) => SOUNDS.find(s => s.id === id).name;
const title = 'Huomioäänet – kierros 2';

const html = `<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="prototype-round" content="${round}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(read(join(ds, 'favicon.svg'))).toString('base64')}">
<style>
${tokens}
${read(join(here, 'round.css'))}
${read(join(lib, 'picker.css'))}
</style>
</head>
<body>
<header class="as-head">
  <div class="as-bar">
    <h1>${title}</h1>
    <label>Teema <select id="theme"><option value="system">Järjestelmä</option><option value="light">Päivä</option><option value="dark">Yö</option><option value="contrast">Korkea kontrasti</option></select></label>
    <span class="as-faint"><kbd>1</kbd>–<kbd>${FAMILIES.length}</kbd> vaihtaa perhettä</span>
  </div>
  <ul class="as-families">
${FAMILIES.map(f => `    <li data-family="${f.id}"><strong>${f.id} ${esc(f.name)}</strong> ${esc(f.line)}</li>`).join('\n')}
  </ul>
  <p class="as-reco" data-testid="recommendation"><strong>Suositus:</strong> oletusääneksi <strong>${esc(name(RECOMMENDED.sound))}</strong> (perhe D): Habitatin oma aihe marimban lämpimällä puulla. Se on tuttu ja miellyttävä soitin mutta oma sävelmä, ja samasta aiheesta saa myöhemmin työtilakohtaiset muunnelmat. Asetuksiin lyhytlista:</p>
  <div class="as-short" data-testid="shortlist">${RECOMMENDED.shortlist.map(id => `<button type="button" class="as-btn${id === RECOMMENDED.sound ? ' as-primary' : ''}" data-play="${id}">▶ ${esc(name(id))}</button>`).join('')}</div>
  <div class="as-levels">
    <label class="as-volume">Äänenvoimakkuus <input type="range" id="volume" min="0" max="100" step="5" value="70"> <output id="volume-out">70 %</output></label>
    <label><input type="checkbox" id="muted"> Äänet pois</label>
    <span id="audio-state" class="as-faint" data-on="false"></span>
  </div>
</header>
<main class="as-main">
  <section id="palette" aria-label="Äänet"></section>
</main>
<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${FAMILIES.map((f, i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''}>${f.id} ${esc(f.short).replace(/ /g, ' ')}</button>`).join('\n')}
  <span class="proto-picker-divider" aria-hidden="true"></span>
  <button class="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)">↻</button>
</nav>
<script>
${synth}
// ---------- Round ----------
${read(join(here, 'round.js'))}
new Function('stage', 'variants', ${JSON.stringify(read(join(lib, 'picker.js')))})(stageSink, variants);
</script>
</body>
</html>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} kB, ${FAMILIES.length} perhettä, ${SOUNDS.length} ääntä)`);
