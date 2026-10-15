#!/usr/bin/env node
// Builds one prototype round into a single self-contained HTML file.
//
//   node build.mjs <round-dir> [--out <file>]
//
// A round is a directory: round.mjs exports `title` and `variants` ([{ name, axis, fn }]),
// and optional round.css and round.js carry the round's own rules and render functions
// (each `fn` must be defined there). `export const app = true` puts the conversation in the
// application frame from lib/app.* (sidebar and top bar) and the composer from
// lib/composer.* with the recap card from lib/recap.*; a round that draws its own composer
// or recap exports `composer = false` or `recap = false`, and one that draws its own
// sidebar controls exports `account = false`; lib/quiet.* (hidden work, info row) comes
// with the frame unless the round exports `quiet = false`. Tokens come from ../tokens with the fonts from
// ../fonts embedded; the library from lib/ is inlined before the round's own code. One
// variant builds a draft (no picker, R replays); several build a comparison behind the
// picker. Default output is dist/<round-dir>.html.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const roundPath = args.find(a => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
if (!roundPath) { console.error('usage: node build.mjs <round-dir> [--out <file>]'); process.exit(2); }
const roundDir = resolve(roundPath);
const out = outIdx >= 0 ? resolve(args[outIdx + 1]) : join(here, 'dist', basename(roundDir) + '.html');

const round = await import(pathToFileURL(join(roundDir, 'round.mjs')).href);
const { title, variants, app } = round;
const composer = app && round.composer !== false;
const recap = composer && round.recap !== false;
const account = app && round.account !== false;
const quiet = app && round.quiet !== false;
const optional = (f) => existsSync(join(roundDir, f)) ? readFileSync(join(roundDir, f), 'utf8') : '';
const css = optional('round.css'), js = optional('round.js');
if (!title || !variants?.length) { console.error('round must export title and a non-empty variants array'); process.exit(2); }
for (const v of variants) if (!v.name || !v.fn) { console.error('each variant needs name and fn'); process.exit(2); }

const read = (p) => readFileSync(join(here, p), 'utf8');
const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Tokens with the bundled fonts embedded, so the file opens anywhere with the right type.
const tokens = ['colors', 'typography', 'spacing', 'motion'].map(n => read(`../tokens/${n}.css`)).join('\n')
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(here, '../fonts', f)).toString('base64')}")`);

const many = variants.length > 1;
const hint = many ? `<kbd>1</kbd>–<kbd>${variants.length}</kbd> vaihtaa suuntaa, <kbd>R</kbd> toistaa vuoron` : `<kbd>R</kbd> toistaa vuoron`;
const picker = many ? `<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${variants.map((v, i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''}>${esc(v.name)}</button>`).join('\n')}
  <span class="proto-picker-divider" aria-hidden="true"></span>
  <button class="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)">↻</button>
</nav>
` : '';

const html = `<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<style>
/* ===== Open Habitat tokens (design-system/tokens, fonts embedded) ===== */
${tokens}
${read('lib/chrome.css')}
${read('lib/language.css')}
${round.density !== false ? read('lib/density.css') : ''}
${app ? read('lib/app.css') : ''}
${account ? read('lib/account.css') : ''}
${quiet ? read('lib/quiet.css') : ''}
${composer ? read('lib/composer.css') : ''}
${recap ? read('lib/recap.css') : ''}
${css}
${many ? read('lib/picker.css') : ''}
</style>
</head>
<body>
<div class="page-bar">
  <h1>${esc(title)}</h1>
  <label>Teema <select id="theme"><option value="system">Järjestelmä</option><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
  <label><input type="checkbox" id="phone"> Puhelin 390 px</label>
  <label><input type="checkbox" id="slow"> Hidastettu</label>
  <span class="hint">${hint}</span>
</div>
<div class="frame-wrap" id="wrap">
  <div class="frame">
    <div class="topbar"><strong>Status-skripti</strong><code>aurinkokello</code><span class="state"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Valmis</span></div>
    <div class="stream" id="stage"></div>
    <dialog class="out-dialog" id="outdlg"></dialog>
    <div class="composer"><div><textarea placeholder="Kirjoita Pi:lle…" aria-label="Viesti"></textarea><button type="button">Lähetä</button></div></div>
  </div>
</div>
${picker}
<script>
${['stage', 'fixture', 'markdown', 'icons', 'pieces', 'turn', 'output', 'live', ...(app ? ['app'] : []), ...(account ? ['account'] : []), ...(composer ? ['composer'] : []), ...(recap ? ['recap'] : []), ...(quiet ? ['quiet'] : [])].map(n => read(`lib/${n}.js`)).join('\n')}
// ---------- Round: ${title} ----------
${js}
const variants = [${variants.map(v => v.fn).join(', ')}];
${read(many ? 'lib/picker.js' : 'lib/replay.js')}
</script>
</body>
</html>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} kB, ${variants.length} ${many ? 'suuntaa' : 'suunta'})`);
