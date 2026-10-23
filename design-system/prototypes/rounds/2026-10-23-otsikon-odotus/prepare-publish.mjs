// Build first with prototypes/build.mjs. Glasspad CSP rejects data: fonts;
// the hosted copy uses the tokens' system fallbacks, not external font requests.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../../dist/', import.meta.url);
const dir = new URL('title-publish/', root);
mkdirSync(dir, {recursive:true});
const html = readFileSync(new URL('2026-10-23-otsikon-odotus.html',root),'utf8');
writeFileSync(new URL('index.html',dir),html.replace(/@font-face\s*\{[^}]*\}/g,''));
console.log(dir.pathname);
