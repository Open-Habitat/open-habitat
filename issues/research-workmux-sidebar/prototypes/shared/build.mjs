#!/usr/bin/env node
// Builds one round's self-contained review page <round>/index.html; never imported by production.
//   node issues/research-workmux-sidebar/prototypes/shared/build.mjs <round-dir>
// The round directory holds round.json ({ round, title, subtitle, names }), round.css and
// round.js. Tokens and fonts come from design-system/, the picker from
// design-system/prototypes/lib/ (PICKER.md verbatim, placed at the top because the composer
// is at the bottom), the frame from this directory.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const dir = resolve(process.argv[2] ?? '');
const read = (p) => readFileSync(join(root, p), 'utf8');
const local = (p) => readFileSync(join(here, p), 'utf8');
const own = (p) => readFileSync(join(dir, p), 'utf8');
const meta = JSON.parse(own('round.json'));
const tokens = ['colors', 'typography', 'spacing', 'motion'].map(n => read(`design-system/tokens/${n}.css`)).join('\n')
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(root, 'design-system/fonts', f)).toString('base64')}")`);
const picker = `<nav class="proto-picker" data-position="top" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${meta.names.map((n, i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''}>${n}</button>`).join('\n')}
</nav>`;
const html = `<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="prototype-round" content="${meta.round}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>${meta.title} · Habitat</title>
<style>
${tokens}
${local('frame.css')}
${own('round.css')}
${read('design-system/prototypes/lib/picker.css')}
</style>
</head>
<body>
<header class="lab">
  <div><strong>${meta.title}</strong><span>${meta.subtitle}</span></div>
  <div class="lab-controls">
    <label>Tilanne <select id="scene"><option value="many">Rupeama käynnissä (16 keskustelua)</option><option value="few">Hiljainen ilta (4)</option></select></label>
    <button type="button" id="reset">Alusta</button>
    <button type="button" id="theme">Tumma</button>
  </div>
</header>
<div id="stage"></div>
${picker}
<script>
${local('frame.js')}
${own('round.js')}
const stage = document.getElementById('stage');
${read('design-system/prototypes/lib/picker.js')}
</script>
</body>
</html>
`;
writeFileSync(join(dir, 'index.html'), html);
console.log(join(dir, 'index.html'), `${(html.length / 1024).toFixed(0)} kB`);
