// Build a synthetic-only Glasspad space. Its null-origin iframe cannot load
// bundled fonts (CSP for data fonts, CORS for assets). Use token fallback stacks;
// the offline build and evidence retain the production fonts.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const space = resolve(here, '../../dist/editor-buttons-fallback-space');
mkdirSync(space, {recursive:true});
execFileSync(process.execPath, [resolve(here, '../../build.mjs'), here, '--out', join(space,'index.html')]);
let html = readFileSync(join(space,'index.html'),'utf8');
html = html.replace(/@font-face\s*\{[^}]*\}/g, '');
html = html.replace('Vain painikkeet, tiedostolinkki ja viestikenttä toimivat.', 'Vain painikkeet, tiedostolinkki ja viestikenttä toimivat. Linkkiversiossa järjestelmäfontit; offline-kuvissa tuotannon fontit.');
writeFileSync(join(space,'index.html'),html);
console.log(space);
