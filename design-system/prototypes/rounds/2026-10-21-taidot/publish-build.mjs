// Publish only the generated synthetic page, not issue reports or browser evidence.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const space = resolve(here, '../../dist/skill-catalogue-space');
mkdirSync(space, {recursive:true});
execFileSync(process.execPath, [resolve(here, '../../build.mjs'), here, '--out', join(space,'index.html')]);
// Glasspad blocks data fonts; its null-origin frame cannot load hosted font assets.
writeFileSync(join(space,'index.html'), readFileSync(join(space,'index.html'),'utf8').replace(/@font-face\s*\{[^}]*\}/g, ''));
console.log(space);
