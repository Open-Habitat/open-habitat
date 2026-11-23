// node build.mjs [--only <block-id>] <out-dir>
// Builds the landing page v1 into a directory: <out-dir>/index.html, its
// assets/ (fonts, and each block's files copied from $ETUSIVU_ASSETS/<id>/),
// and manifest.json for check.mjs. With --only, the page holds that one block
// (and what it needs to stand: a glimpse comes with Alice's sidebar, a role
// with its header), without the hero.
// The page is rendered here, in Node, from the blocks (blocks/index.js gives
// the order); the browser script (engine/client.js plus each block's
// client.js) only adds behaviour, so every block's text reads without
// JavaScript. A block's assets.mjs runs when its asset directory is missing.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { esc, screen, you, reply, USED_ASSETS } from './engine/kit.mjs';
import { mkDay, dayStep, storySection, avatar, wrap } from './engine/story.mjs';

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

// ---------- Blocks ----------
const INDEX = (await import(pathToFileURL(join(here, 'blocks/index.js')))).default;
const ids = INDEX.flatMap((x) => (typeof x === 'string' ? [x] : [x.day, x.intro, ...(x.glimpses || []), ...(x.roles || []), ...(x.caps || [])].filter(Boolean)));
const B = {};
for (const id of ids) {
  const mod = (await import(pathToFileURL(join(here, 'blocks', id, 'block.js')))).default;
  if (mod.id !== id) throw new Error(`blocks/${id}/block.js says id "${mod.id}"`);
  B[id] = mod;
}
if (only && !B[only]) { console.error(`--only ${only}: no such block in blocks/index.js (${ids.join(', ')})`); process.exit(2); }
const shown = new Set(); // blocks that appear on this page
const anchors = new Set();
const ctx = { screen, anchors };

// ---------- Sections ----------
function daySection(entry) {
  const dayB = B[entry.day];
  const g = entry.glimpses.map((id) => ({ ...B[id], block: id }));
  const d = mkDay({ ...dayB.person, g });
  const showAll = !only || only === entry.day;
  const steps = d.g.filter((x) => showAll || x.block === only).map(dayStep);
  if (!steps.length) return '';
  steps.forEach((s) => shown.add(s.block));
  if (showAll) shown.add(entry.day);
  return `${showAll ? wrap(entry.day, dayB.intro(esc(d.blurb)), 'section', 'day-intro" id="day') : ''}
${storySection(d.id, steps, {}, ctx)}
${showAll ? wrap(entry.day, dayB.end, 'section', 'day-end') : ''}`;
}
const roleHead = (d, n) => `<header class="role-h">${avatar(d, 40)}<div><p class="role-k">${esc(d.role)} · ${esc(d.org)}</p><h3>${esc(d.name)}</h3><p>${esc(d.blurb)}</p></div><span class="role-n">${n}</span></header>`;
function rolesSection(entry) {
  const days = entry.roles.map((id) => { const d = mkDay({ ...B[id].day, g: B[id].day.g.map((x) => ({ ...x, block: id })) }); return [id, d]; });
  const list = days.filter(([id]) => !only || only === id || only === entry.intro);
  if (!list.length) return '';
  const intro = !only || only === entry.intro;
  if (intro) shown.add(entry.intro);
  const rolesHtml = only === entry.intro ? '' : list.map(([id, d]) => { shown.add(id); return `<div class="role blk" data-block="${id}" id="role-${d.id}">${roleHead(d, `${days.findIndex(([x]) => x === id) + 1}/${days.length}`)}${storySection(`role-${d.id}`, d.g.filter((x) => x.pick).map(dayStep), { cls: 's1-role' }, ctx)}</div>`; }).join('\n');
  return `<section class="roles" id="roles">
${intro ? wrap(entry.intro, B[entry.intro].html({ roles: days.map(([, d]) => d), avatar }), 'div', 'day-intro roles-intro') : ''}
${rolesHtml}
</section>`;
}
// Capabilities: a group's full screens as a story, the ones somebody's day
// shows as lines pointing there, the rest in a list the reader opens.
const capStep = (b, n) => { const c = b.caps.find((x) => x[0] === n); return { block: b.id, who: c[4], org: c[5], clock: `<span class="cap-prog">${esc(c[3])}</span>`, head: `<span class="cap-tag">${esc(c[3])}</span><span class="cap-who">${esc(c[4])}, ${esc(c[5])}</span>`, ask: c[6], did: c[7], screen: b.full[n] }; };
const capItem = (c) => `<li><details class="cap-it"><summary><span class="cap-t">${esc(c[2])}</span><span class="cap-p">${esc(c[3])}</span></summary><div class="cap-b">${screen(c[2], you('', c[6]) + reply(c[7]), '', c[5])}<p class="cap-by">${esc(c[4])}, ${esc(c[5])}</p></div></details></li>`;
const capIn = (b, c) => { const [who, sid] = b.inDay[c[0]]; const id = `g-${who}-${sid}`; const href = anchors.has(id) ? id : `role-${who}`; return `<li class="cap-in"><span class="cap-t">${esc(c[2])}</span><span class="cap-p">${esc(c[3])}</span><a class="cap-role" href="#${href}" data-who="${who}">${esc(c[4])}’s day</a></li>`; };
function capsSection(entry) {
  const groups = entry.caps.map((id) => B[id]);
  const list = groups.filter((b) => !only || only === b.id || only === entry.intro);
  if (!list.length) return '';
  const intro = !only || only === entry.intro;
  if (intro) shown.add(entry.intro);
  const nav = `<nav class="cap-nav" aria-label="Capability groups">${groups.map((b) => `<a href="#cap-${b.group.id}">${esc(b.group.name)} <b>${b.caps.length}</b></a>`).join('')}</nav>`;
  const body = only === entry.intro ? '' : list.map((b) => {
    shown.add(b.id);
    const notFull = b.caps.filter((c) => !b.show.includes(c[0]));
    const inDays = notFull.filter((c) => b.inDay[c[0]]); const rest = notFull.filter((c) => !b.inDay[c[0]]);
    const name = b.group.name;
    return `<div class="cap-g blk" data-block="${b.id}" id="cap-${b.group.id}">
  <header class="cap-gh"><h3>${esc(name)}</h3><p>${esc(b.group.line)}</p></header>
  ${b.show.length ? storySection(`cap-${b.group.id}`, b.show.map((n) => capStep(b, n)), { cls: 's1-cap' }, ctx) : ''}
  ${inDays.length ? `<div class="cap-days"><p class="cap-days-h">Shown in someone’s day above</p><ul>${inDays.map((c) => capIn(b, c)).join('')}</ul></div>` : ''}
  ${rest.length ? `<details class="cap-more"><summary>${rest.length} more: ${esc(name.toLowerCase())}</summary><ul>${rest.map(capItem).join('')}</ul></details>` : ''}
</div>`;
  }).join('\n');
  return `<section class="caps" id="can">
${intro ? wrap(entry.intro, B[entry.intro].html() + nav, 'div', 'caps-intro') : ''}
${body}
</section>`;
}
const parts = INDEX.map((x) => {
  if (typeof x === 'string') { if (only && only !== x) return ''; shown.add(x); return wrap(x, B[x].html(ctx), 'div', 'blk-section'); }
  if (x.day) return daySection(x);
  if (x.roles) return rolesSection(x);
  if (x.caps) return capsSection(x);
  throw new Error(`blocks/index.js: unknown entry ${JSON.stringify(x)}`);
});

// ---------- CSS ----------
// A block's block.css is namespaced: every selector starts with [data-block="<id>"].
function blockCss(id) {
  const p = join(here, 'blocks', id, 'block.css');
  if (!existsSync(p)) return '';
  const css = read(p);
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const bad = [];
  const walk = (s) => { let i = 0; while (i < s.length) { const o = s.indexOf('{', i); if (o < 0) break; const sel = s.slice(i, o).trim(); let dd = 1, j = o + 1; while (dd && j < s.length) { if (s[j] === '{') dd++; else if (s[j] === '}') dd--; j++; } if (/^@(media|supports|container)/.test(sel)) walk(s.slice(o + 1, j - 1)); else if (/^@keyframes/.test(sel)) { if (!sel.includes(id)) bad.push(sel); } else for (const one of sel.split(',')) if (!one.trim().startsWith(`[data-block="${id}"]`)) bad.push(one.trim()); i = j; } };
  walk(flat);
  if (bad.length) throw new Error(`blocks/${id}/block.css: every selector must start with [data-block="${id}"] (and a @keyframes name must contain the id); not: ${bad.slice(0, 5).join(' | ')}`);
  return `/* ---- blocks/${id}/block.css ---- */\n${css}`;
}
const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n').replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, 'url("assets/fonts/$1")');
const css = [tokens, read(join(root, 'website/src/styles/brand.css')), ...['page', 'screen', 'product', 'views'].map((n) => read(join(here, 'engine', `${n}.css`))), ...[...shown].map(blockCss)].join('\n');

// ---------- JS ----------
const blockJs = [...shown].filter((id) => existsSync(join(here, 'blocks', id, 'client.js'))).map((id) => `// ---- blocks/${id}/client.js ----\n(() => {\n${read(join(here, 'blocks', id, 'client.js'))}\n})();`);
const js = [read(join(here, 'engine/client.js')), ...blockJs].join('\n');

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
${parts.filter(Boolean).join('\n')}
</div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`${join(out, 'index.html')} ${(statSync(join(out, 'index.html')).size / 1e6).toFixed(2)} MB · ${shown.size} blocks`);
