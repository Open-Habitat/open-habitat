// The landing page v1 rendered in Node from the blocks: the one renderer that
// both build.mjs (the prototype page) and the website (website/landing.mjs,
// the site's English front page) use, so a block change shows up in both.
// render({ only }) returns the page body's HTML, the engine's and the shown
// blocks' CSS (without the design-system tokens, the brand themes and the
// fonts, which each caller loads its own way), the browser script, and the
// assets the page uses. An asset is referenced in the HTML as
// assets/<block-id>/<name> (engine/kit.mjs); a caller that serves them from
// elsewhere rewrites exactly those paths.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { esc, screen, you, reply, USED_ASSETS } from './engine/kit.mjs';
import { mkDay, dayStep, storySection, avatar, wrap } from './engine/story.mjs';
import { pageRail, phoneBar, ctaStrip } from './engine/nav.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(p, 'utf8');
// The links the phone's bar and strips share with the hero's top bar.
const LINKS = { docs: '/docs/', repo: 'https://github.com/Open-Habitat/open-habitat' };

// A bad --only: the caller's usage error, not a crash.
export class UsageError extends Error {}

export async function render({ only = null } = {}) {
  // ---------- Blocks ----------
  const INDEX = (await import(pathToFileURL(join(here, 'blocks/index.js')))).default;
  const ids = INDEX.flatMap((x) => (typeof x === 'string' ? [x] : [x.day, x.intro, ...(x.glimpses || []), ...(x.roles || []), ...(x.caps || [])].filter(Boolean)));
  const B = {};
  for (const id of ids) {
    const mod = (await import(pathToFileURL(join(here, 'blocks', id, 'block.js')))).default;
    if (mod.id !== id) throw new Error(`blocks/${id}/block.js says id "${mod.id}"`);
    B[id] = mod;
  }
  if (only && !B[only]) throw new UsageError(`--only ${only}: no such block in blocks/index.js (${ids.join(', ')})`);
  const shown = new Set(); // blocks that appear on this page
  const anchors = new Set();
  const ctx = { screen, anchors };
  const sections = []; // the page's sections for engine/nav.mjs, filled as they render

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
    sections.push({ id: 'day', label: 'A day', kids: [{ key: d.id, href: '#day', label: d.name, sub: 'Ten conversations, one Thursday', avatar: avatar(d, 28), steps: steps.length }] });
    // Her first row starts open on the phone, so the reader learns that rows open.
    return `${showAll ? wrap(entry.day, dayB.intro(esc(d.blurb)), 'section', 'day-intro" id="day') : ''}
  ${storySection(d.id, steps, { openFirst: true }, ctx)}
  ${showAll ? `${wrap(entry.day, dayB.end, 'section', 'day-end')}\n  ${ctaStrip(LINKS)}` : ''}`;
  }
  const roleHead = (d, n) => `<header class="role-h">${avatar(d, 40)}<div><p class="role-k">${esc(d.role)} · ${esc(d.org)}</p><h3>${esc(d.name)}</h3><p>${esc(d.blurb)}</p></div><span class="role-n">${n}</span></header>`;
  function rolesSection(entry) {
    const days = entry.roles.map((id) => { const d = mkDay({ ...B[id].day, g: B[id].day.g.map((x) => ({ ...x, block: id })) }); return [id, d]; });
    const list = days.filter(([id]) => !only || only === id || only === entry.intro);
    if (!list.length) return '';
    const intro = !only || only === entry.intro;
    if (intro) shown.add(entry.intro);
    if (only !== entry.intro) sections.push({ id: 'roles', label: 'The team', kids: list.map(([, d]) => ({ key: `role-${d.id}`, href: `#role-${d.id}`, label: d.name, sub: d.role, avatar: avatar(d, 28), steps: d.g.filter((x) => x.pick).length })) });
    const rolesHtml = only === entry.intro ? '' : list.map(([id, d]) => { shown.add(id); return `<div class="role blk" data-block="${id}" id="role-${d.id}">${roleHead(d, `${days.findIndex(([x]) => x === id) + 1}/${days.length}`)}${storySection(`role-${d.id}`, d.g.filter((x) => x.pick).map(dayStep), { cls: 's1-role' }, ctx)}</div>`; }).join('\n');
    return `<section class="roles" id="roles">
  ${intro ? wrap(entry.intro, B[entry.intro].html({ roles: days.map(([, d]) => d), avatar }), 'div', 'day-intro roles-intro') : ''}
  ${rolesHtml}
  </section>
  ${!only ? ctaStrip(LINKS) : ''}`;
  }
  // Capabilities: a group's full screens as a story, the ones somebody's day
  // shows as lines pointing there, the rest in a list the reader opens.
  const capStep = (b, n) => { const c = b.caps.find((x) => x[0] === n); return { block: b.id, who: c[4], org: c[5], clock: `<span class="cap-prog">${esc(c[3])}</span>`, head: `<span class="cap-tag">${esc(c[3])}</span><span class="cap-who">${esc(c[4])}, ${esc(c[5])}</span>`, ask: c[6], did: c[7], screen: b.full[n], tag: c[3] }; };
  const capItem = (c) => `<li><details class="cap-it"><summary><span class="cap-t">${esc(c[2])}</span><span class="cap-p">${esc(c[3])}</span></summary><div class="cap-b">${screen(c[2], you('', c[6]) + reply(c[7]), '', c[5])}<p class="cap-by">${esc(c[4])}, ${esc(c[5])}</p></div></details></li>`;
  const capIn = (b, c) => { const [who, sid] = b.inDay[c[0]]; const id = `g-${who}-${sid}`; const href = anchors.has(id) ? id : `role-${who}`; return `<li class="cap-in"><span class="cap-t">${esc(c[2])}</span><span class="cap-p">${esc(c[3])}</span><a class="cap-role" href="#${href}" data-who="${who}">${esc(c[4])}’s day</a></li>`; };
  function capsSection(entry) {
    const groups = entry.caps.map((id) => B[id]);
    const list = groups.filter((b) => !only || only === b.id || only === entry.intro);
    if (!list.length) return '';
    const intro = !only || only === entry.intro;
    if (intro) shown.add(entry.intro);
    const nav = `<nav class="cap-nav" aria-label="Capability groups">${groups.map((b) => `<a href="#cap-${b.group.id}">${esc(b.group.name)} <b>${b.caps.length}</b></a>`).join('')}</nav>`;
    if (only !== entry.intro) sections.push({ id: 'can', label: 'What it can do', kids: list.map((b) => ({ key: `cap-${b.group.id}`, href: `#cap-${b.group.id}`, label: b.group.name, sub: `${b.caps.length} examples`, avatar: '', steps: b.show.length || 1 })) });
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
    if (x === 'install' && (!only || only === x)) sections.push({ id: 'install', label: 'Install', kids: [] });
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
  const css = [...['page', 'screen', 'product', 'views', 'nav'].map((n) => read(join(here, 'engine', `${n}.css`))), ...[...shown].map(blockCss)].join('\n');

  // ---------- JS ----------
  const blockJs = [...shown].filter((id) => existsSync(join(here, 'blocks', id, 'client.js'))).map((id) => `// ---- blocks/${id}/client.js ----\n(() => {\n${read(join(here, 'blocks', id, 'client.js'))}\n})();`);
  const js = [read(join(here, 'engine/client.js')), ...blockJs].join('\n');

  // Assets the shown blocks use, as block id -> Set of names. A block may
  // register an asset when its module loads or while it renders, so this is
  // read after rendering.
  const assets = new Map([...shown].filter((id) => USED_ASSETS.has(id)).map((id) => [id, new Set(USED_ASSETS.get(id))]));
  // The navigation: the phone's bar first, so it can stick over the whole
  // page; the desktop's rail is fixed. A page with one block (--only) has none.
  const navHtml = only ? '' : `${phoneBar(sections, LINKS)}\n${pageRail(sections)}`;
  return { html: [navHtml, ...parts].filter(Boolean).join('\n'), css, js, shown: [...shown], assets };
}
