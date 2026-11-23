// node blocks/caps-data/assets.mjs: the two pictures of the data block, made by
// the programs the screens name. Set TMPDIR to your scratch (never /tmp) and
// PROTO_WEB to a web/ directory with node_modules (for Playwright's Chromium).
//
//   returns.svg  Graphviz `dot -Tsvg` from src/returns.dot, laid out with the
//                design system's Instrument Sans (fontconfig points at TTFs
//                decompressed from design-system/fonts), then the glyphs it
//                uses embedded as a WOFF2 subset so the <img> draws the same font.
//   results.webp A seeded results table (src/make_results.py) loaded into SQLite
//                with sqlite-utils, full-text search on, served by Datasette with
//                the club's template and stylesheet (src/), searched for "Peggy"
//                and captured by Chromium at 380 × 600 CSS px, 2×.
//
// Tools: `dot` and `datasette`/`sqlite-utils` are taken from $CAPS_DATA_TOOLS
// (default $TMPDIR/caps-data-tools) and installed there when missing: Graphviz
// from conda-forge with micromamba, Datasette, sqlite-utils and fontTools in a
// uv venv. Versions used for the shipped files are in NOTES.md.
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { arch, homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const root = resolve(here, '../../../../../..');
const fonts = join(root, 'design-system/fonts');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'caps-data');
mkdirSync(out, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'caps-data-'));
const tools = process.env.CAPS_DATA_TOOLS || join(tmpdir(), 'caps-data-tools');
mkdirSync(tools, { recursive: true });
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts }).toString();

// ---------- Tools ----------
const gv = join(tools, 'graphviz');
const dot = join(gv, 'bin/dot');
if (!existsSync(dot)) {
  const mm = join(tools, 'micromamba');
  if (!existsSync(join(mm, 'bin/micromamba'))) {
    mkdirSync(mm, { recursive: true });
    const plat = arch() === 'arm64' ? 'linux-aarch64' : 'linux-64';
    run('/bin/sh', ['-c', `curl -sSL https://micro.mamba.pm/api/micromamba/${plat}/latest | tar -xj -C "${mm}" bin/micromamba`]);
  }
  run(join(mm, 'bin/micromamba'), ['create', '-y', '-q', '-p', gv, '-c', 'conda-forge', 'graphviz'], { env: { ...process.env, MAMBA_ROOT_PREFIX: join(tools, 'mamba') } });
}
const venv = join(tools, 'venv');
const py = join(venv, 'bin/python');
if (!existsSync(join(venv, 'bin/datasette'))) {
  run('uv', ['venv', '-q', venv]);
  run('uv', ['pip', 'install', '-q', 'datasette', 'sqlite-utils', 'fonttools', 'brotli'], { env: { ...process.env, VIRTUAL_ENV: venv } });
}

// ---------- returns.svg: Graphviz ----------
const ttf = join(scratch, 'ttf');
mkdirSync(ttf);
for (const f of ['instrument-sans-latin', 'instrument-sans-latin-ext']) {
  run(py, ['-I', '-c', 'import sys;from fontTools.ttLib import TTFont;t=TTFont(sys.argv[1]);t.flavor=None;t.save(sys.argv[2])', join(fonts, `${f}.woff2`), join(ttf, `${f}.ttf`)]);
}
const fcConf = join(scratch, 'fonts.conf');
writeFileSync(fcConf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${ttf}</dir><cachedir>${join(scratch, 'fc-cache')}</cachedir></fontconfig>\n`);
const rawSvg = run(dot, ['-Tsvg', join(src, 'returns.dot')], { env: { ...process.env, FONTCONFIG_FILE: fcConf } });
// Embed only the glyphs the chart uses (plus digits and €), keeping the weight axis.
const text = [...rawSvg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join('') + '0123456789€?';
const sub = join(scratch, 'sub.woff2');
run(join(venv, 'bin/pyftsubset'), [join(fonts, 'instrument-sans-latin.woff2'), `--text=${text}`, '--flavor=woff2', `--output-file=${sub}`, '--layout-features=kern,liga']);
const face = `<style>@font-face{font-family:"Instrument Sans";src:url(data:font/woff2;base64,${readFileSync(sub).toString('base64')}) format("woff2");font-weight:400 700}</style>`;
const svg = rawSvg
  .replace(/<!DOCTYPE[^>]*>\s*/, '')
  .replace(/<!--[\s\S]*?-->\s*/g, '')
  .replace(/(<svg[^>]*>)/, `$1\n${face}`);
writeFileSync(join(out, 'returns.svg'), svg);

// ---------- results.webp: Datasette ----------
const ds = join(scratch, 'ds');
mkdirSync(join(ds, 'static'), { recursive: true });
run('python3', ['-I', join(src, 'make_results.py'), join(ds, 'results.csv')]);
const db = join(ds, 'results.db');
run(join(venv, 'bin/sqlite-utils'), ['insert', db, 'results', join(ds, 'results.csv'), '--csv']);
run(join(venv, 'bin/sqlite-utils'), ['enable-fts', db, 'results', 'crew', 'regatta', 'event', '--create-triggers']);
copyFileSync(join(src, 'club.css'), join(ds, 'static/club.css'));
for (const f of ['instrument-sans-latin.woff2', 'jetbrains-mono-latin.woff2']) copyFileSync(join(fonts, f), join(ds, 'static', f));
const port = 18000 + Math.floor(Math.random() * 2000);
const server = spawn(join(venv, 'bin/datasette'), ['serve', db, '-m', join(src, 'metadata.json'), '--template-dir', join(src, 'templates'), '--static', `static:${join(ds, 'static')}`, '-p', String(port)], { stdio: 'ignore' });
try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/-/versions.json`)).ok) break; } catch { /* not up yet */ }
    if (i > 100) throw new Error('datasette did not start');
    await new Promise((r) => setTimeout(r, 150));
  }
  const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 380, height: 600 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/results/results?_search=Peggy`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const png = join(scratch, 'results.png');
  await page.screenshot({ path: png });
  await browser.close();
  run('convert', [png, '-quality', '82', '-define', 'webp:method=6', join(out, 'results.webp')]);
} finally {
  server.kill();
}
console.log(run('identify', ['-format', '%f %wx%h %b\n', join(out, 'results.webp')]).trim());
console.log(`returns.svg ${Math.round(svg.length / 1024)} KB`);
