#!/usr/bin/env node
// Builds the self-contained review page index.html; never imported by production.
//   node issues/proto-experimental-features/prototypes/kokeelliset/build.mjs
// Tokens and fonts from design-system/, the picker from design-system/prototypes/lib/
// (PICKER.md verbatim, at the top because the composer and the next-conversation row sit
// at the bottom). round.css is a hand-written copy of the production settings page
// (web/src/components/Settings.css, Controls.module.css) and the app frame around it;
// round.js draws the three directions.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const local = (p) => readFileSync(join(here, p), 'utf8');
const tokens = ['colors', 'typography', 'spacing', 'motion'].map(n => read(`design-system/tokens/${n}.css`)).join('\n')
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(root, 'design-system/fonts', f)).toString('base64')}")`);
const names = ['Rivit', 'Merkki', 'Esittely'];
const picker = `<nav class="proto-picker" data-position="top" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${names.map((n, i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''}>${n}</button>`).join('\n')}
</nav>`;
const html = `<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="prototype-round" content="proto-experimental-features">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Kokeelliset ominaisuudet · Habitat · Kierros 1</title>
<style>
${tokens}
${local('round.css')}
${read('design-system/prototypes/lib/picker.css')}
</style>
</head>
<body>
<header class="lab">
  <div class="lab-title"><strong>Kokeelliset ominaisuudet · Kierros 1</strong><span>Missä kokeilu selittää itsensä · synteettinen offline-prototyyppi · 1–3 tai ←/→ vaihtaa</span></div>
  <div class="lab-controls">
    <label><input type="checkbox" id="fail"> Tallennus epäonnistuu</label>
    <button type="button" id="reset">Alusta</button>
    <button type="button" id="theme">Tumma</button>
  </div>
</header>
<main id="stage"></main>
${picker}
<script>
${local('round.js')}
const stage = document.getElementById('stage');
${read('design-system/prototypes/lib/picker.js')}
</script>
</body>
</html>
`;
writeFileSync(join(here, 'index.html'), html);
console.log(join(here, 'index.html'), `${(html.length / 1024).toFixed(0)} kB`);
