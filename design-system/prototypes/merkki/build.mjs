#!/usr/bin/env node
// Builds the mark bed (merkkipeti) into one self-contained HTML file.
//
//   node build.mjs [--out <file>]        default ../dist/merkki-peti.html
//
// Inlines peti.js, the draft (vedos.svg) as reference shapes, and the wordmark fonts as data
// URLs, because an offered view runs without network. fonts/ holds OFL subsets (Latin and
// åäö) of the families without a Reserved Font Name. Quicksand, Comfortaa and Varela Round
// have one, so OFL forbids shipping a modified subset under their names: they are fetched
// unmodified from google/fonts into ../dist/merkki-fonts and embedded whole when available.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? resolve(args[outIdx + 1]) : join(here, '../dist/merkki-peti.html');
const read = (p) => readFileSync(join(here, p));
const b64 = (buf) => buf.toString('base64');

const subsets = { Nunito: 'nunito', Fredoka: 'fredoka', 'Baloo 2': 'baloo2', Lexend: 'lexend', Outfit: 'outfit', Figtree: 'figtree', Manrope: 'manrope' };
const reserved = {
  Quicksand: 'quicksand/Quicksand%5Bwght%5D.ttf',
  Comfortaa: 'comfortaa/Comfortaa%5Bwght%5D.ttf',
  'Varela Round': 'varelaround/VarelaRound-Regular.ttf',
};
const face = (family, mime, data) => `@font-face { font-family: "${family}"; src: url("data:${mime};base64,${data}"); font-weight: 100 1000; font-stretch: 75% 125%; font-display: block; }`;
const faces = Object.entries(subsets).map(([f, file]) => face(f, 'font/woff2', b64(read(`fonts/${file}.woff2`))));
const cache = join(here, '../dist/merkki-fonts');
mkdirSync(cache, { recursive: true });
for (const [family, path] of Object.entries(reserved)) {
  const file = join(cache, path.split('/')[0] + '.ttf');
  if (!existsSync(file)) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${path}`);
      if (!res.ok) throw new Error(res.status);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    } catch (e) { console.warn(`${family}: not fetched (${e.message}); the bed falls back to a system font`); continue; }
  }
  faces.push(face(family, 'font/ttf', b64(readFileSync(file))));
}
// The product fonts from the design system.
const product = { 'Instrument Sans': ['instrument-sans-latin', 'instrument-sans-latin-ext'], 'JetBrains Mono': ['jetbrains-mono-latin', 'jetbrains-mono-latin-ext'] };
for (const [family, files] of Object.entries(product)) for (const f of files) faces.push(face(family, 'font/woff2', b64(read(`../../fonts/${f}.woff2`))));

// The draft's three groups, as inner markup in the draft's own 1254-unit coordinates.
const svg = read('vedos.svg').toString();
const group = (id) => svg.match(new RegExp(`<g id="${id}"[^>]*>[\\s\\S]*?</g>`))[0];
const vedos = { nest: group('nest'), agent: group('agent'), word: group('wordmark').replace(/^<g[^>]*>|<\/g>$/g, '') };

const html = read('peti.html').toString()
  .replace('/*FONTS*/', () => faces.join('\n'))
  .replace('/*VEDOS*/', () => JSON.stringify(vedos))
  .replace('/*JS*/', () => read('peti.js').toString());
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} kB)`);
