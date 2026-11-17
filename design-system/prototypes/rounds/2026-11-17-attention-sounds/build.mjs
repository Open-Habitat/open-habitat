#!/usr/bin/env node
// Builds the attention-sound round into one self-contained HTML file.
//
//   node build.mjs [--out <file>]     # default ../../dist/2026-11-17-attention-sounds.html
//
// Plain JavaScript, no bundler: tokens with the bundled fonts embedded, the
// shared picker (lib/picker.css and lib/picker.js unchanged, the latter given
// a stage sink as rail-agent-state does), synth.mjs with its `export`
// keywords stripped, then round.js. No audio file is embedded: the page
// renders every sound from its recipe when it first plays.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILIES, RECOMMENDED, SOUNDS } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lib = resolve(here, '../../lib'), ds = resolve(here, '../../..');
const round = '2026-11-17-attention-sounds';
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? resolve(args[outIdx + 1]) : resolve(here, '../../dist', `${round}.html`);
const read = (p) => readFileSync(p, 'utf8');
const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const tokens = ['colors', 'typography', 'spacing', 'motion'].map(n => read(join(ds, `tokens/${n}.css`))).join('\n')
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(ds, 'fonts', f)).toString('base64')}")`);
const synth = read(join(here, 'synth.mjs')).replace(/^export /gm, '');
const recommended = SOUNDS.find(s => s.id === RECOMMENDED.sound);
const title = 'Huomioäänet – kierros 1';

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
    <span class="as-faint"><kbd>1</kbd>–<kbd>3</kbd> vaihtaa perhettä</span>
  </div>
  <ul class="as-families">
${FAMILIES.map(f => `    <li data-family="${f.id}"><strong>${f.id} ${esc(f.name)}</strong> ${esc(f.line)}</li>`).join('\n')}
  </ul>
  <p class="as-reco" data-testid="recommendation"><strong>Suositus:</strong> perhe C Habitat-aiheet, oletusääni <strong>${esc(recommended.name)}</strong>. Lyhyt, nouseva ja oma: se ei muistuta käyttöjärjestelmän ääniä, kestää toistoa ja samasta soundista saa myöhemmin työtilakohtaiset muunnelmat.</p>
</header>
<main class="as-main">
  <section class="as-palette" id="palette" aria-label="Äänet"></section>
  <section class="as-sim" aria-labelledby="sim-h">
    <h2 class="as-h2" id="sim-h">Milloin ääni soi</h2>
    <p class="as-lead">Simuloitu sivupalkki. Tapahtumat siirtävät keskusteluja, ja loki kertoo, soiko ääni ja miksi.</p>
    <div id="sim-body"></div>
    <details class="as-rules" open><summary>Suositellut säännöt</summary>
      <ol>
        <li>Ääni soi, kun keskustelu siirtyy Sinun vuorosi -osioon agentin takia: uusi vastaus, kysymys tai vuoro, joka päättyy ilman käynnissä olevaa työntekijää.</li>
        <li>Agentin oma siirto Käynnissä- tai Hiljaiset-osioon ei soi, eikä vuoron loppu, jonka aikana työntekijä vielä jatkaa. Ääni tulee, kun työ loppuu ja vastaus jää sinulle.</li>
        <li>Enintään yksi ääni kolmessa sekunnissa: ensimmäinen soi heti, seuraavat yhdistetään siihen.</li>
        <li>Keskustelu, jota katsot (välilehti näkyvissä, ikkuna aktiivinen, keskustelu auki), ei soi. Toinen keskustelu, toinen välilehti tai taustalla oleva ikkuna soi.</li>
        <li>Oma äänenvoimakkuus ja Äänet pois. Vähennä liikettä ei vaimenna ääntä; ääni ei ole ainoa merkki, sillä rivi, merkki ja välilehden otsikko kertovat saman.</li>
        <li>Jos selain estää äänen, sivupalkki sanoo sen kerran ja tarjoaa painikkeen. Mikä tahansa napsautus Habitatissa avaa äänen myös.</li>
        <li>Sivun latautuminen tai yhteyden palaaminen ei soi jo odottavista keskusteluista.</li>
        <li>Vain yksi välilehti soittaa, vaikka Habitat olisi auki useassa.</li>
      </ol>
    </details>
  </section>
</main>
<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${FAMILIES.map((f, i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''}>${f.id}\u00a0${esc(f.short).replace(/ /g, '\u00a0')}</button>`).join('\n')}
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
