// Kokoaa käsin kirjoitetusta page.html:stä yhden offline-tiedoston index.html: tokenit
// design-system/tokens-hakemistosta ja fontit design-system/fonts-hakemistosta upotettuina.
//   node issues/proto-notification-bell/prototypes/kello/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const tokens = path.join(root, 'design-system/tokens');
const css = ['colors.css', 'spacing.css', 'typography.css', 'motion.css']
  .map((f) => readFileSync(path.join(tokens, f), 'utf8'))
  .join('\n')
  .replace(/url\("\.\.\/fonts\/([a-z-]+\.woff2)"\)/g, (_, f) =>
    `url("data:font/woff2;base64,${readFileSync(path.join(root, 'design-system/fonts', f)).toString('base64')}")`);
const page = readFileSync(path.join(here, 'page.html'), 'utf8');
if (!page.includes('/*TOKENS*/')) throw new Error('page.html: /*TOKENS*/ marker missing');
writeFileSync(path.join(here, 'index.html'), page.replace('/*TOKENS*/', () => css));
console.log('wrote', path.relative(root, path.join(here, 'index.html')));
