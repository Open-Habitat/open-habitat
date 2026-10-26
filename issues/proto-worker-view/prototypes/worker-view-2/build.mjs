#!/usr/bin/env node
// Builds the self-contained review page index.html; never imported by production.
//   node build.mjs
// Inputs: design-system tokens with the fonts embedded, the production CSS and
// shell markup round 1 copied from the synthetic lab (../worker-view/captured/), the
// picker from design-system/prototypes/lib, and this round's CSS and JS.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../..');
const read = (p) => readFileSync(join(here, p), 'utf8');
const captured = (p) => read(`../worker-view/captured/${p}`);
const ds = (p) => readFileSync(join(root, 'design-system', p), 'utf8');

const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => ds(`tokens/${n}.css`)).join('\n')
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(root, 'design-system/fonts', f)).toString('base64')}")`);
const variants = ['Välilehti', 'Vaihtuu itse', 'Pääte keskustelussa'];
const picker = `<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${variants.map((v, i) => `  <button class="proto-picker-item"${i ? '' : ' data-active aria-current="true"'}>${v}</button>`).join('\n')}
  <span class="proto-picker-divider" aria-hidden="true"></span>
  <button class="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)">↻</button>
</nav>`;
// The captured shell's lab name and inline viewport sizes are the lab's, not the round's.
const shell = captured('shell.html')
  .replace(/^<body>|<\/body>$/g, '')
  .replace(/ style="--ah-visible-height:[^"]*"/, '')
  .replace(/<div id="overlays">\s*<\/div>/, '')
  .replace(/ aria-current="page"/g, '');
// The capture is a busy turn; the parent here has ended its turn, so no Stop.
const composer = captured('composer.html').replace(/<button data-testid="composer-stop"[\s\S]*?<\/button>/, '').replace(' ah-crow-busy', '').replace(/<button data-testid="composer-mode"[\s\S]*?<\/button>/, '').replace(/<input[^>]*type="file"[^>]*>/, '').replace('<textarea', '<textarea disabled title="Prototyyppi: ei lähetä"');
const js = `const SHELL = ${JSON.stringify(shell)};\nconst COMPOSER = ${JSON.stringify(composer)};\n${read('variants.js')}\n${ds('prototypes/lib/picker.js')}`;

const html = `<!doctype html>
<html lang="fi" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Workerin näkymä · Habitat · Kierros 2</title>
<style>
${tokens}
${captured('production.css')}
${read('round.css')}
${ds('prototypes/lib/picker.css')}
</style>
</head>
<body>
<header class="lab"><strong>Workerin näkymä · Kierros 2</strong><span class="lab-hint">Kehys · 1–3 vaihtaa suuntaa</span><span class="lab-grow"></span>
<label>Tila <select id="wv-state"><option value="running">Työskentelee</option><option value="waiting">Odottaa päätteessä</option><option value="landed">Valmis, laskeutui</option><option value="failed">Epäonnistui, tallessa</option></select></label>
<label>Worker <select id="wv-harness"><option value="claude">Claude Code</option><option value="pi">Pi</option></select></label>
<label>Claude-historia <select id="wv-history"><option value="pending">Ei vielä löytynyt</option><option value="none">Habitat ei lue (tänään)</option><option value="ready">Luettavissa</option></select></label>
<button id="wv-arrive" type="button" title="Historia tulee luettavaksi, kun katsot päätettä">Historia saapuu ▶</button>
<button id="wv-theme" type="button">Tumma</button></header>
<main id="stage"></main>
<div class="picker-band" aria-hidden="true"></div>
<div id="toast" role="status" hidden></div>
${picker}
<script>
${js}
</script>
</body>
</html>
`;
writeFileSync(join(here, 'index.html'), html);
console.log(join(here, 'index.html'), `${Math.round(html.length / 1024)} KiB`);
