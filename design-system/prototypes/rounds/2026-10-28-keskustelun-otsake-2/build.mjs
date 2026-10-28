#!/usr/bin/env node
// Builds the hand-written page.html into one offline file: the tokens from ../../../tokens with
// the fonts embedded, and the shared picker from ../../lib. No production-component bundle
// (those render blank in Habitat views).
//   node design-system/prototypes/rounds/2026-10-28-keskustelun-otsake-2/build.mjs [--out <file>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ds = path.resolve(here, '../../..');
const root = path.resolve(ds, '..');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? path.resolve(args[outIdx + 1])
  : path.join(root, 'issues/proto-conversation-header/prototypes/conversation-header-2/index.html');

const read = (...p) => readFileSync(path.join(...p), 'utf8');
const fonts = read(ds, 'tokens/typography.css').replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) =>
  `url("data:font/woff2;base64,${readFileSync(path.join(ds, 'fonts', f)).toString('base64')}")`);
const tokens = [read(ds, 'tokens/colors.css'), read(ds, 'tokens/spacing.css'), fonts, read(ds, 'tokens/motion.css')].join('\n');
const html = read(here, 'page.html')
  .replace('/*TOKENS*/', () => tokens)
  .replace('/*PICKER_CSS*/', () => read(ds, 'prototypes/lib/picker.css'))
  .replace('/*PICKER_JS*/', () => read(ds, 'prototypes/lib/picker.js'));
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${path.relative(root, out)} (${Math.round(html.length / 1024)} KiB)`);
