// The story engine, build-time half: a day's model (places, conversations and
// their states through the day), the product's sidebar at a moment, and a
// story section rendered to static HTML. Steps sit on the left; on a wide
// screen one sticky product screen on the right follows the step in view
// (client.js); on a phone each step is a timeline row that opens its text and
// its own copy of the screen in place, and without JavaScript every step shows
// both. Everything client.js needs is in the HTML: each step's screen is its
// inline copy, and the sidebar state and the screens a sidebar row opens are
// <template>s. Round 6's round.js, made static.
import { esc, mark, you, working } from './kit.mjs';

export const T = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const hhmm = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
const ICONS = {
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>',
  tram: '<rect x="6" y="4" width="12" height="13" rx="3"/><path d="M6 11h12M9 20l-1.5 2M15 20l1.5 2M10 2h4"/><circle cx="9.5" cy="14" r=".6"/><circle cx="14.5" cy="14" r=".6"/>',
  studio: '<path d="M4 20h16M6 20V9l6-4 6 4v11"/><path d="M10 20v-5h4v5"/>',
  lunch: '<path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M11 3v2"/>',
  box: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8M12 12v8"/>',
  meet: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19c.6-3 2.6-5 5-5s4.4 2 5 5M11 19c.6-3 2.6-5 5-5s4.4 2 5 5"/>',
  van: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  desk: '<rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  class: '<path d="M3 5h18v11H3z"/><path d="M7 20l2-4M17 20l-2-4M7 9h6M7 12h9"/>',
  lab: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8l2 8"/>',
};
const placeIc = (k) => `<svg class="pl-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
const STATE = { run: 'Running', turn: 'Your turn', quiet: 'Quiet' };
const MARK_STATE = { run: 'working', turn: 'waiting', quiet: 'idle' };

// A day: { id, name, role, org, color, blurb, places: [[time, label, icon]],
// sess: [{ id, title, segs: [[time, state, line]] }], g: [glimpse] } where a
// glimpse is { block?, s, at, ask, did, screen(), pick?, hand? }.
export function mkDay(d) {
  d.SID = Object.fromEntries(d.sess.map((s) => [s.id, s]));
  d.g.forEach((g, i) => { g.i = i; g.t = T(g.at); if (!d.SID[g.s]) throw new Error(`${d.id}: glimpse at ${g.at} names conversation "${g.s}", which the day does not have`); g.title = d.SID[g.s].title; g.day = d; });
  return d;
}
const placeAt = (d, t) => d.places.filter((p) => T(p[0]) <= t).pop() || d.places[0];
const segAt = (s, t) => { let cur = null; for (const g of s.segs) if (T(g[0]) <= t) cur = g; return cur; };
const counts = (d, t) => { const c = { turn: 0, run: 0, quiet: 0 }; for (const s of d.sess) { const g = segAt(s, t); if (g) c[g[1]]++; } return c; };
export const countLine = (d, t) => { const c = counts(d, t); return [c.run && `${c.run} running`, c.turn && `${c.turn} waiting for ${d.name}`, c.quiet && `${c.quiet} quiet`].filter(Boolean).join(' · '); };
const glimpseOf = (d, sid, t) => { const own = d.g.filter((g) => g.s === sid); return own.filter((g) => g.t <= t).pop() || own[0]; };

// The sidebar as the product draws it (AdaptiveRail): Your turn newest first,
// Running in the order they started, Quiet newest first.
export function railAt(d, t, active) {
  const groups = { turn: [], run: [], quiet: [] };
  for (const s of d.sess) { const g = segAt(s, t); if (g) groups[g[1]].push([s, g]); }
  groups.turn.sort((a, b) => T(b[1][0]) - T(a[1][0]));
  groups.quiet.sort((a, b) => T(b[1][0]) - T(a[1][0]));
  const row = ([s, g]) => `<li><button type="button" class="rl-row rl-${g[1]}" data-s="${s.id}"${s.id === active ? ' aria-current="true"' : ''}>${mark(16, MARK_STATE[g[1]])}<span class="rl-t">${esc(s.title)}</span><span class="rl-l">${esc(g[2])}</span><time>${g[0]}</time></button></li>`;
  return `<div class="rl">${['turn', 'run', 'quiet'].map((k) => `<section class="rl-sec rl-sec-${k}"><h4><span>${STATE[k]}</span><b>${groups[k].length}</b></h4>${groups[k].length ? `<ul>${groups[k].map(row).join('')}</ul>` : '<p class="rl-none">Nothing</p>'}</section>`).join('')}</div>`;
}
export const when = (d, t) => { const p = placeAt(d, t); return `<span class="when"><b>${hhmm(t)}</b><span>${placeIc(p[2])}${p[1]}</span></span>`; };
export const avatar = (d, px = 22) => `<span class="av" style="--av:${d.color}; --px:${px}px" aria-hidden="true">${d.name[0]}</span>`;
const runningScreen = (d, s, t, screenFn) => { const g = glimpseOf(d, s.id, t); const seg = segAt(s, t); return screenFn(s.title, working(s.segs[0][0], g.ask, seg[2]), '', d.org); };

// A step: { block, d?, t?, sid?, head, ask, did, hand?, foot?, screen() }.
// `row` is what the phone's timeline row shows for the step (time, the
// conversation's sidebar line at that moment as a chip, its state) and `now`
// what the phone's bar says while the step is under it.
export const dayStep = (g) => {
  const seg = segAt(g.day.SID[g.s], g.t); const c = counts(g.day, g.t);
  const now = `${hhmm(g.t)} · ${c.turn ? `${c.turn} waiting` : c.run ? `${c.run} running` : 'all quiet'}`;
  return { block: g.block, d: g.day, t: g.t, sid: g.s, ask: g.ask, did: g.did, screen: g.screen, head: when(g.day, g.t), foot: countLine(g.day, g.t), hand: g.hand || '', row: { time: hhmm(g.t), chip: seg[2], state: seg[1] }, now };
};
function appTop(st) {
  if (st.d) return `${avatar(st.d)}<b>${esc(st.d.name)}</b><span class="s1-org">${esc(st.d.org)}</span><span class="s1-clock">${when(st.d, st.t)}</span>`;
  return `<span class="av" style="--av:var(--ah-line-strong); --px:22px" aria-hidden="true">${esc((st.who || '?')[0])}</span><b>${esc(st.who || '')}</b><span class="s1-org">${esc(st.org || '')}</span><span class="s1-clock">${st.clock || ''}</span>`;
}
// Each block's own HTML is wrapped so its block.css can be namespaced by id.
export const wrap = (block, html, tag = 'div', cls = '') => `<${tag} class="blk${cls ? ` ${cls}` : ''}" data-block="${block}">${html}</${tag}>`;

// Render a story section. `anchors` collects the glimpse anchors
// (g-<person>-<conversation>) that capability lines may point at.
export function storySection(key, steps, o = {}, { screen, anchors = new Set() } = {}) {
  const s0 = steps[0];
  const rail = !!s0.d;
  const scr = new Map(); // screen html -> template id
  const scrId = (html) => { if (!scr.has(html)) scr.set(html, `${key}-s${scr.size}`); return scr.get(html); };
  const own = steps.map((st) => wrap(st.block, st.screen()));
  // The screen a sidebar row opens: that conversation as it stood at the step's moment.
  const rows = steps.map((st, i) => {
    if (!st.d) return null;
    const m = {};
    for (const s of st.d.sess) {
      const seg = segAt(s, st.t); if (!seg) continue;
      if (s.id === st.sid) { m[s.id] = 'own'; continue; }
      const g = st.d.g.filter((x) => x.s === s.id && x.t <= st.t).pop();
      const html = g && !(seg[1] === 'run' && T(seg[0]) > g.t) ? wrap(g.block, g.screen()) : runningScreen(st.d, s, st.t, screen);
      m[s.id] = scrId(html);
    }
    return m;
  });
  const seen = new Set();
  const anchor = (st) => { if (!st.d) return ''; const id = `g-${st.d.id}-${st.sid}`; if (seen.has(id) || anchors.has(id)) return ''; seen.add(id); anchors.add(id); return ` id="${id}" data-who="${st.d.id}"`; };
  const state = (st, i) => `<template class="s1-state" data-i="${i}"><div data-part="top">${appTop(st)}</div>${st.d ? `<div data-part="rail">${railAt(st.d, st.t, st.sid)}</div>` : ''}</template>`;
  // The phone's timeline row: a heading with one button that opens the step's
  // text and screen in place (client.js; on the desktop the row is not shown).
  const row = (st, i, open) => {
    const r = st.row || {};
    const chip = r.chip ? `<span class="s1-chip s1-chip-${r.state}">${esc(r.chip)}</span>` : `<span class="s1-chip s1-chip-tag">${esc(st.tag || '')}</span>`;
    return `<h3 class="s1-row"><button type="button" aria-expanded="${open}" aria-controls="${key}-${i}-t ${key}-${i}-s"><span class="s1-row-time">${esc(r.time || '')}</span>${chip}<span class="s1-row-ask">“${esc(st.ask)}”</span><span class="s1-row-chev" aria-hidden="true"></span></button></h3>`;
  };
  return `<section class="s1${rail ? '' : ' s1-norail'}${o.cls ? ` ${o.cls}` : ''}" data-story="${key}">
  <div class="s1-steps">
${steps.map((st, i) => { const open = !!o.openFirst && i === 0; return `<article class="s1-step blk${i === 0 ? ' on' : ''}${open ? ' s1-open' : ''}" data-block="${st.block}"${anchor(st)} data-i="${i}" data-now="${esc(st.now || st.tag || '')}"${rows[i] ? ` data-rows='${JSON.stringify(rows[i])}'` : ''}>
    ${row(st, i, open)}
    <div class="s1-txt" id="${key}-${i}-t">
    <p class="s1-when">${st.head}</p>
    <h3 class="ask">“${esc(st.ask)}”</h3>
    <p class="did">${esc(st.did)}</p>
    ${st.hand ? `<p class="hand">${esc(st.hand)}</p>` : ''}
    ${st.foot ? `<p class="s1-count">${st.foot}</p>` : ''}
    </div>
    <div class="s1-inline" id="${key}-${i}-s">${own[i]}</div>
    ${state(st, i)}
  </article>`; }).join('\n')}
  </div>
  <div class="s1-app" aria-label="The product’s screen at the moment shown">
    <div class="s1-top">${appTop(s0)}</div>
    <div class="s1-body">${rail ? `<nav class="s1-rail" aria-label="Conversations">${railAt(s0.d, s0.t, s0.sid)}</nav>` : ''}<div class="s1-main"></div></div>
  </div>
  ${[...scr].map(([html, id]) => `<template class="s1-scr" data-k="${id}">${html}</template>`).join('')}
</section>`;
}
