// node build.mjs [--only <block-id>] <out-dir>
// Builds the landing page v1 into a directory: <out-dir>/index.html, its
// assets/ (fonts, and each block's files copied from $ETUSIVU_ASSETS/<id>/),
// and manifest.json for check.mjs. With --only, the page holds that one block
// (and what it needs to stand: a glimpse comes with Alice's sidebar, a role
// with its header), without the hero.
// The page is rendered in Node from the blocks by render.mjs (blocks/index.js
// gives the order), which the website's front page uses too; the browser script (engine/client.js plus each block's
// client.js) only adds behaviour, so every block's text reads without
// JavaScript. A block's assets.mjs runs when its asset directory is missing.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { render, UsageError } from './render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const ds = join(root, 'design-system');
const args = process.argv.slice(2);
const oi = args.indexOf('--only');
const only = oi >= 0 ? args.splice(oi, 2)[1] : null;
if (!args[0] || args[0].startsWith('-')) { console.error('usage: node build.mjs [--only <block-id>] <out-dir>'); process.exit(2); }
const out = resolve(args[0]);
const ASSETS = process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets');
const read = (p) => readFileSync(p, 'utf8');

const r = await render({ only }).catch((e) => { if (e instanceof UsageError) { console.error(e.message); process.exit(2); } throw e; });
const shown = new Set(r.shown);
const USED_ASSETS = r.assets;
const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n').replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, 'url("assets/fonts/$1")');
const css = [tokens, read(join(root, 'website/src/styles/brand.css')), r.css].join('\n');
const js = r.js;

// ---------- Assets ----------
mkdirSync(join(out, 'assets/fonts'), { recursive: true });
for (const f of readdirSync(join(ds, 'fonts')).filter((f) => f.endsWith('.woff2'))) cpSync(join(ds, 'fonts', f), join(out, 'assets/fonts', f));
const manifest = { only, blocks: [...shown], assets: {} };
const missing = [];
for (const id of shown) {
  const src = join(ASSETS, id);
  const gen = join(here, 'blocks', id, 'assets.mjs');
  if (!existsSync(src) && USED_ASSETS.has(id) && existsSync(gen)) { console.log(`running blocks/${id}/assets.mjs`); execFileSync(process.execPath, [gen], { stdio: 'inherit' }); }
  const used = USED_ASSETS.get(id) || new Set();
  for (const n of used) if (!existsSync(join(src, n))) missing.push(`${id}/${n}`);
  if (!existsSync(src)) continue;
  cpSync(src, join(out, 'assets', id), { recursive: true });
  manifest.assets[id] = readdirSync(src, { recursive: true }).filter((f) => statSync(join(src, f)).isFile()).map((f) => ({ name: f, bytes: statSync(join(src, f)).size, used: used.has(f) }));
}
if (missing.length) { console.error(`missing assets (in ${ASSETS}): ${missing.join(', ')}`); process.exit(1); }

// ---------- Page ----------
const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2c6e3f" stroke-width="2" stroke-linecap="round"><path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6"/><circle cx="12" cy="12" r="2.5" fill="#2c6e3f" stroke="none"/></svg>';
const html = `<!doctype html><html lang="en" data-theme="light" class="no-js"><head><meta charset="utf-8"><meta name="prototype-round" content="2026-11-23-etusivu-v1"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Open Habitat · Coding-grade AI agents for your whole team${only ? ` · ${only}` : ''}</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><script>document.documentElement.classList.replace('no-js','js')</script><style>${css}</style></head><body><div class="pg v1${only ? ' only' : ''}">
${r.html}
</div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`${join(out, 'index.html')} ${(statSync(join(out, 'index.html')).size / 1e6).toFixed(2)} MB · ${shown.size} blocks`);
