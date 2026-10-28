// Kokoaa käsin kirjoitetun prototyypin yhdeksi offline-tiedostoksi index.html: tokenit ja
// fontit design-systemistä (fontit data-URL:eina), sivun CSS ja JS src/-hakemistosta,
// synteettiset tiedostot src/files/-hakemistosta ja valitsin PICKER.md:n mukaan.
//   node issues/proto-markdown-full-preview-button/prototypes/full-preview-icons/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const ds = path.join(root, 'design-system');
const read = (p) => readFileSync(p, 'utf8');
const tokens = ['colors', 'spacing', 'typography', 'motion'].map(n => read(path.join(ds, 'tokens', n + '.css'))).join('\n')
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(path.join(ds, 'fonts', f)).toString('base64')}")`);
const files = Object.fromEntries(Object.entries({ md: 'saaristoretki-2027.md', csv: 'ilmoittautuneet.csv', svg: 'reittikartta.svg', html: 'kutsu.html', json: 'asetukset.json' })
  .map(([k, f]) => [k, read(path.join(here, 'src/files', f))]));
// The picker is PICKER.md verbatim; its wiring calls window.variants.
const picker = read(path.join(ds, 'prototypes/lib/picker.css'));
const pickerJs = `const variants = window.variants;\nconst stage = document.getElementById('stage');\n${read(path.join(ds, 'prototypes/lib/picker.js'))}`;
const out = read(path.join(here, 'src/page.html'))
  .replace('/*TOKENS*/', () => tokens)
  .replace('/*PAGE_CSS*/', () => read(path.join(here, 'src/page.css')))
  .replace('/*PICKER_CSS*/', () => picker)
  // `</script` inside a file would end the inline script.
  .replace('/*FILES*/', () => JSON.stringify(files).replace(/<\//g, '<\\/'))
  .replace('/*PAGE_JS*/', () => read(path.join(here, 'src/page.js')))
  .replace('/*PICKER_JS*/', () => pickerJs);
writeFileSync(path.join(here, 'index.html'), out);
console.log(`index.html ${(out.length / 1024).toFixed(0)} kB`);
