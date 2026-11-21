// Round 5 of the landing page: the content. Round 4's Sivupalkki form is the
// page's principle now: the product's own screen tells each story, and
// scrolling moves time forward. This file holds the shared pieces, the story
// engine (one sticky product screen per story section) and Alice's day of
// twelve glimpses. roles.js holds the other people's days, caps.js the
// capabilities, variants.js the three ways of showing roles. People,
// organisations and addresses are invented (example.org); command lines are
// illustrative. build.mjs defines IMG and VARIANTS; lib/markdown.js gives esc,
// inline and md; lib/icons.js gives ICON_CHECK and CHEV; lib/picker.js expects
// `stage` and `variants`.
const stage = document.getElementById('stage');

const REPO = 'https://github.com/Open-Habitat/open-habitat';
const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';
const mark = (px = 22, state = 'idle') => `<svg class="oh-mark" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" aria-hidden="true"><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/></svg>`;
const heroPic = () => { const i = IMG.hero; return `<img class="hero-img" src="${i.src}" width="${i.w}" height="${i.h}" alt="A conversation with an agent in Open Habitat on a desktop browser, with running and waiting conversations in the sidebar, and the same conversation on a phone">`; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Round 2's hero, unchanged in all three ----------
const hero = (i) => `<p class="rq-line" lang="fi"><b>${i + 1}/3 ${VARIANTS[i][0]}.</b> ${VARIANTS[i][1]} <span>1–3 tai ←/→ vaihtaa</span></p>
<header class="top"><a class="brandword" href="#">${mark(24)} Open Habitat</a><nav><a href="#day">A day</a><a href="#can">What it can do</a><a href="#install">Install</a><a href="${REPO}">GitHub</a></nav></header>
<section class="hero">
  <p class="eyebrow">Open source · on your own server · pre-release 0.1</p>
  <h1>Coding-grade AI agents <br>for your whole team.</h1>
  <p class="lede">No terminal required. Everyone gets a real agent with its own Linux account, in a browser tab. One person sets up one server; everyone else signs in and gets to work.</p>
  <p class="cta"><a class="btn" href="#install">Install on your server</a><a class="btn ghost" href="#day">See a day</a></p>
</section>
<figure class="hero-band">${heroPic()}</figure>`;

// ---------- The stub below: the rest of the page is not this round's ----------
const stub = `<section class="stub" id="install">
  <p class="kicker">The rest of the page</p>
  <h2>Nobody in these days had anything to set up. Somebody did, once.</h2>
  <p>One person who administers a Linux server installs Open Habitat for the team, by giving their coding agent the operator guide. After that, everyone signs in with a browser and gets an agent of their own.</p>
  <p class="cta"><a class="btn" href="${REPO}">Install on your server</a><a class="btn ghost" href="${REPO}#limits">What it does not do</a></p>
  <p class="stub-note">Install, limits and the pre-release note follow here, as in round 2.</p>
</section>
<footer class="foot"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span><a href="${REPO}">GitHub</a><a href="${REPO}/releases">Releases</a><span class="quiet">This page sets no cookies and loads nothing from anywhere else.</span></footer>`;

// ---------- The conversation language: small builders over lib/language.css ----------
const FILE_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
const MAIL_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const MIC_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const SKILL_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const you = (time, text, extra = '', note = '') => `<article class="bubble user"><div class="bubble-head"><span class="who">You</span><time class="meta">${time}</time></div><div class="prose">${md(text)}</div>${extra}${note ? `<p class="u-note">${note}</p>` : ''}</article>`;
const att = (name, meta) => `<p class="att">${FILE_IC}<span class="att-n">${esc(name)}</span><span class="att-m">${esc(meta)}</span></p>`;
// Tool rows are closed as in the product; `open` shows the output that carries the glimpse.
const tool = (name, target, out = '', open = false) => `<section class="tool"><button class="disc" type="button" aria-expanded="${open}">${CHEV}<span class="names"><span class="name">${esc(name)}</span><span class="target">${esc(target)}</span></span><span class="ok">${ICON_CHECK}done</span></button><div class="tool-body"${open ? '' : ' hidden'}><pre>${esc(out || 'ok')}</pre></div></section>`;
const reply = (text, extra = '') => `<article class="bubble reply"><div class="prose">${md(text)}</div>${extra}</article>`;
const offer = (name, meta) => `<div class="offer">${FILE_IC}<span class="offer-n">${esc(name)}<small>${esc(meta)}</small></span><button type="button" class="offer-b" data-done="Saved to Downloads">Download</button></div>`;
const workers = (rows) => `<div class="wk" role="group" aria-label="Workers"><p class="wk-h">Workers <span>${rows.length}</span></p><ul>${rows.map(([state, name, task, prog]) => `<li class="wk-${state}"><span class="wk-dot" aria-hidden="true"></span><b>${esc(name)}</b><span class="wk-t">${esc(task)}</span><span class="wk-p">${esc(prog)}</span></li>`).join('')}</ul></div>`;
const drafts = (rows) => `<ul class="drafts">${rows.map(([state, to, subj, first]) => `<li class="dr dr-${state.split(' ')[0]}">${MAIL_IC}<span class="dr-main"><span class="dr-to">To ${esc(to)}</span><b>${esc(subj)}</b><span class="dr-first">${esc(first)}</span></span><span class="dr-s">${esc(state)}</span></li>`).join('')}</ul>`;
const diff = (file, lines, label = '') => `<div class="diff"><p class="diff-h">${FILE_IC}<span>${esc(file)}</span>${label ? `<small>${esc(label)}</small>` : ''}</p><pre>${lines.map((l) => `<span class="${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx'}">${esc(l)}</span>`).join('')}</pre></div>`;
// One agent turn on the rail: a head, the work, and the reply on the last node.
function pi(rows, answer, sum = '') {
  const cells = [`<div class="rail-cell first"><span class="node head" aria-hidden="true"></span></div><div class="cell"><div class="head-cell"><span class="who">Pi</span><span class="sum">${sum}</span></div></div>`];
  for (const r of rows) cells.push(`<div class="rail-cell"><span class="node${r.startsWith('<section class="tool"') ? ' tool done' : ''}" aria-hidden="true"></span></div><div class="cell">${r}</div>`);
  cells.push(`<div class="rail-cell last"><span class="node done" aria-hidden="true"></span></div><div class="cell">${answer}</div>`);
  return `<div class="turn">${cells.join('')}</div>`;
}
// A conversation in a slim window: its title, whose place it is, and a view opened beside it.
const screen = (title, body, view = '', org = 'Example Studio') => `<div class="scr${view ? ' has-view' : ''}"><div class="scr-bar">${mark(14)}<b>${esc(title)}</b><span>${esc(org)}</span></div><div class="scr-main"><div class="scr-convo">${body}</div>${view}</div></div>`;
const viewPane = (title, html, kind = 'View') => `<aside class="scr-view" aria-label="${esc(kind)}: ${esc(title)}"><p class="scr-view-h">${FILE_IC}<span>${esc(title)}</span><small>${esc(kind)}</small></p><div class="scr-view-b">${html}</div></aside>`;
const nTools = (n) => `${n} tool${n === 1 ? '' : 's'}`;

// =====================================================================
// Time, places, sessions: shared by every day on the page
// =====================================================================
const T = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const hhmm = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
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

// A day: who, where they work, where they are through the day, their
// conversations' states ([time, state, the line under the title]) and the
// glimpses. mkDay fills in the derived fields.
function mkDay(d) {
  d.SID = Object.fromEntries(d.sess.map((s) => [s.id, s]));
  d.g.forEach((g, i) => { g.i = i; g.t = T(g.at); g.title = d.SID[g.s].title; g.day = d; });
  return d;
}
const placeAt = (d, t) => d.places.filter((p) => T(p[0]) <= t).pop() || d.places[0];
const segAt = (s, t) => { let cur = null; for (const g of s.segs) if (T(g[0]) <= t) cur = g; return cur; };
const counts = (d, t) => { const c = { turn: 0, run: 0, quiet: 0 }; for (const s of d.sess) { const g = segAt(s, t); if (g) c[g[1]]++; } return c; };
const countLine = (d, t) => { const c = counts(d, t); return [c.run && `${c.run} running`, c.turn && `${c.turn} waiting for ${d.name}`, c.quiet && `${c.quiet} quiet`].filter(Boolean).join(' · '); };
const glimpseOf = (d, sid, t) => { const own = d.g.filter((g) => g.s === sid); return own.filter((g) => g.t <= t).pop() || own[0]; };

// The sidebar, as the product draws it, at a moment of the day.
// Your turn newest first, Running in the order they started, Quiet newest first.
function railAt(d, t, active) {
  const groups = { turn: [], run: [], quiet: [] };
  for (const s of d.sess) { const g = segAt(s, t); if (g) groups[g[1]].push([s, g]); }
  groups.turn.sort((a, b) => T(b[1][0]) - T(a[1][0]));
  groups.quiet.sort((a, b) => T(b[1][0]) - T(a[1][0]));
  const row = ([s, g]) => `<li><button type="button" class="rl-row rl-${g[1]}" data-s="${s.id}"${s.id === active ? ' aria-current="true"' : ''}>${mark(16, MARK_STATE[g[1]])}<span class="rl-t">${esc(s.title)}</span><span class="rl-l">${esc(g[2])}</span><time>${g[0]}</time></button></li>`;
  return `<div class="rl">${['turn', 'run', 'quiet'].map((k) => `<section class="rl-sec rl-sec-${k}"><h4><span>${STATE[k]}</span><b>${groups[k].length}</b></h4>${groups[k].length ? `<ul>${groups[k].map(row).join('')}</ul>` : '<p class="rl-none">Nothing</p>'}</section>`).join('')}</div>`;
}
const chips = (d, t) => { const c = counts(d, t); return `<span class="chips"><i class="c-turn">${c.turn} Your turn</i><i class="c-run">${c.run} Running</i><i class="c-quiet">${c.quiet} Quiet</i></span>`; };
const when = (d, t) => { const p = placeAt(d, t); return `<span class="when"><b>${hhmm(t)}</b><span>${placeIc(p[2])}${p[1]}</span></span>`; };
const avatar = (d, px = 22) => `<span class="av" style="--av:${d.color}; --px:${px}px" aria-hidden="true">${d.name[0]}</span>`;
const whoTag = (d) => `<span class="who-tag">${avatar(d, 20)}<b>${esc(d.name)}</b><span>${esc(d.role)}, ${esc(d.org)}</span></span>`;
// A conversation that has started but has not yet come back: the ask, and the agent at work.
const runningScreen = (d, s, t) => { const g = glimpseOf(d, s.id, t); const seg = segAt(s, t); return screen(s.title, you(s.segs[0][0], g.ask) + `<p class="working-lbl run-lbl">${mark(16, 'working')}<span>${esc(seg[2])}…</span></p>`, '', d.org); };

// =====================================================================
// The story engine: steps on the left, the product's own screen sticky on
// the right; the step in the middle of the viewport owns the screen. On a
// phone each step carries its own screen, and a sticky bar keeps the clock
// and the counts, with the sidebar one press away.
// A step: { head, ask, did, foot, screen(), d?, t?, sid?, label? }
// =====================================================================
const SECTIONS = {};
const dayStep = (g, opts = {}) => ({
  d: g.day, t: g.t, sid: g.s, ask: g.ask, did: g.did, screen: g.screen,
  head: opts.meanwhile ? `<span class="mw">Meanwhile</span>${whoTag(g.day)}<span class="when-sep"></span>${when(g.day, g.t)}` : when(g.day, g.t),
  foot: countLine(g.day, g.t), meanwhile: !!opts.meanwhile, hand: g.hand || '',
});
function appTop(st) {
  if (st.d) return `${avatar(st.d)}<b>${esc(st.d.name)}</b><span class="s1-org">${esc(st.d.org)}</span><span class="s1-clock">${when(st.d, st.t)}</span>`;
  return `<span class="av" style="--av:var(--ah-line-strong); --px:22px" aria-hidden="true">${esc((st.who || '?')[0])}</span><b>${esc(st.who || '')}</b><span class="s1-org">${esc(st.org || '')}</span><span class="s1-clock">${st.clock || ''}</span>`;
}
function storySection(key, steps, o = {}) {
  SECTIONS[key] = steps;
  const s0 = steps[0];
  const rail = !!s0.d;
  return `<section class="s1${rail ? '' : ' s1-norail'}${o.cls ? ` ${o.cls}` : ''}" data-story="${key}">
  ${rail ? `<div class="s1-bar"><div class="s1-bar-row">${avatar(s0.d, 22)}${when(s0.d, s0.t)}<button type="button" class="s1-tog" aria-expanded="false">${chips(s0.d, s0.t)}</button></div><div class="s1-drop" hidden>${railAt(s0.d, s0.t, s0.sid)}</div></div>` : ''}
  <div class="s1-steps">
${steps.map((st, i) => `<article class="s1-step${i === 0 ? ' on' : ''}${st.meanwhile ? ' mw-step' : ''}" data-i="${i}">
    <p class="s1-when">${st.head}</p>
    <h3 class="ask">“${esc(st.ask)}”</h3>
    <p class="did">${esc(st.did)}</p>
    ${st.hand ? `<p class="hand">${esc(st.hand)}</p>` : ''}
    ${st.foot ? `<p class="s1-count">${st.foot}</p>` : ''}
    <div class="s1-inline">${st.screen()}</div>
  </article>`).join('\n')}
  </div>
  <div class="s1-app" aria-label="The product’s screen at the moment shown">
    <div class="s1-top">${appTop(s0)}</div>
    <div class="s1-body">${rail ? `<nav class="s1-rail" aria-label="Conversations">${railAt(s0.d, s0.t, s0.sid)}</nav>` : ''}<div class="s1-main">${s0.screen()}</div></div>
  </div>
</section>`;
}
function initStory(sec) {
  const steps = SECTIONS[sec.dataset.story];
  const els = [...sec.querySelectorAll(':scope > .s1-steps > .s1-step')];
  const rail = sec.querySelector('.s1-rail');
  const main = sec.querySelector('.s1-main');
  const top = sec.querySelector('.s1-top');
  const app = sec.querySelector('.s1-app');
  const bar = sec.querySelector('.s1-bar');
  const drop = sec.querySelector('.s1-drop');
  const tog = sec.querySelector('.s1-tog');
  let cur = 0;
  // The screen opens at its newest content, as a conversation does: the
  // result and any view beside it, with the work above to scroll back to.
  const anchor = () => { main.scrollTop = main.scrollHeight; };
  anchor();
  // Rows that change section glide to their new place (FLIP), so the eye can follow them.
  const flip = (host, html, sameDay) => {
    const before = sameDay ? new Map([...host.querySelectorAll('.rl-row')].map((r) => [r.dataset.s, r.getBoundingClientRect()])) : new Map();
    host.innerHTML = html;
    if (reduced()) return;
    for (const r of host.querySelectorAll('.rl-row')) {
      const b = before.get(r.dataset.s); const a = r.getBoundingClientRect();
      if (!b) { r.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }); continue; }
      const dy = b.top - a.top;
      if (Math.abs(dy) > 1) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    }
  };
  const show = (i) => {
    if (i === cur) return;
    const prev = steps[cur]; cur = i;
    const st = steps[i];
    els.forEach((s, j) => s.classList.toggle('on', j === i));
    const sameDay = prev.d === st.d;
    if (app) app.classList.toggle('mw-app', !!st.meanwhile);
    top.innerHTML = appTop(st);
    if (rail && st.d) flip(rail, railAt(st.d, st.t, st.sid), sameDay);
    main.innerHTML = st.screen();
    anchor();
    if (bar && st.d) {
      bar.querySelector('.s1-bar-row > .av').outerHTML = avatar(st.d, 22);
      bar.querySelector('.when').outerHTML = when(st.d, st.t);
      tog.innerHTML = chips(st.d, st.t);
      flip(drop, railAt(st.d, st.t, st.sid), sameDay);
    }
  };
  // A row opens that conversation as it stood at the moment shown.
  const onClick = (e) => {
    const r = e.target.closest('.rl-row');
    if (r && sec.contains(r)) {
      const st = steps[cur]; const d = st.d; const s = d.SID[r.dataset.s]; const t = st.t; const seg = segAt(s, t);
      const g = d.g.filter((x) => x.s === s.id && x.t <= t).pop();
      const html = g && !(seg[1] === 'run' && T(seg[0]) > g.t) ? g.screen() : runningScreen(d, s, t);
      sec.querySelectorAll('.rl-row').forEach((x) => (x.dataset.s === s.id ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current')));
      const inline = r.closest('.s1-drop');
      if (inline) { const host = els[cur].querySelector('.s1-inline'); host.innerHTML = html; drop.hidden = true; tog.setAttribute('aria-expanded', 'false'); host.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); }
      else { main.innerHTML = html; anchor(); }
      return;
    }
    if (tog && e.target.closest('.s1-tog') === tog) { const open = drop.hidden; drop.hidden = !open; tog.setAttribute('aria-expanded', String(open)); }
  };
  sec.addEventListener('click', onClick);
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(+e.target.dataset.i)), { rootMargin: '-45% 0px -45% 0px' });
  els.forEach((s) => io.observe(s));
  return () => { io.disconnect(); sec.removeEventListener('click', onClick); };
}

// =====================================================================
// Mock views opened beside a conversation (shared by days and capabilities)
// =====================================================================
const CAPTIONS = ['Saturday at the market', 'Printed by hand in our studio', 'One block, one colour at a time', 'Wrapped while you wait', 'example.org/shop'];
const videoMock = () => `<div class="vid" data-vid><div class="vid-frame" data-k="0"><span class="vid-cloth" aria-hidden="true"></span><span class="vid-cap">${CAPTIONS[0]}</span><button type="button" class="vid-play" aria-label="Play">${PLAY_SVG}</button></div><div class="vid-bar"><span class="vid-prog"></span></div><p class="vid-meta"><span class="vid-t">0:00</span><span>0:30 · 5 captions</span></p></div>`;
const newsMock = () => `<div class="nl"><p class="nl-from">Example Studio <span>shop@example.org</span></p><div class="nl-img" aria-hidden="true"></div><b class="nl-h">Twelve days of linen</b><p>Our winter prints are on the shelves: indigo, rust and a new forest green, printed by hand in the studio.</p><p>Returns are now 30 days, so a gift can wait under the tree.</p><span class="nl-btn">See the winter prints</span><p class="nl-foot">You get this because you bought from us in 2026. Unsubscribe.</p></div>`;
const returnsView = () => `<ul class="files">${[['site/faq.md', 6, 3], ['site/terms.md', 2, 2], ['handbook/shop/returns.md', 4, 4], ['handbook/online/gifts.md', 3, 1], ['handbook/online/wholesale.md', 1, 1], ['… 12 more', 19, 14]].map(([f, a, d]) => `<li><span>${esc(f)}</span><b class="fa">+${a}</b><b class="fd">−${d}</b></li>`).join('')}</ul>${diff('site/faq.md', ['- You can return anything within 14 days.', '+ You can return anything within 30 days of delivery.', '+ Sale items too: the same 30 days apply.', '+ A gift can be returned by the person who received it.'])}`;
// A transcript with named speakers and the minute each line was said.
const SPK = { Alice: 'a', Bob: 'b', Lena: 'c' };
const transcriptMock = (lines, people = SPK, len = '58:12') => `<div class="tr"><div class="tr-wave" aria-hidden="true">${Array.from({ length: 64 }, (_, k) => `<i style="--h:${(22 + ((k * 37) % 61)) }%" class="sp-${'abc'[Math.floor(k / 9) % 3]}"></i>`).join('')}</div><p class="tr-len">${len} · ${Object.keys(people).length} speakers · transcribed on this server</p><ol>${lines.map(([t, who, text]) => `<li><time>${t}</time><b class="sp-${people[who] || 'a'}">${esc(who)}</b><span>${esc(text)}</span></li>`).join('')}</ol></div>`;
const memoMock = () => `<div class="doc"><p class="doc-k">Memo · Planning, Thu 19 Nov · Alice, Bob, Lena</p><b class="doc-h">Decisions</b><ol><li>Winter prints go on the shop page on Monday. <time>12:40</time></li><li>Wholesale shops get an order page instead of phoning Bob. <time>31:05</time></li><li>Markets stop after 12 December. <time>44:18</time></li></ol><b class="doc-h">Tasks</b><ul class="doc-tasks"><li><i class="sp-a">Alice</i>Order page for wholesale shops <small>notes/open.md</small></li><li><i class="sp-a">Alice</i>Reply to the market organiser <small>notes/open.md</small></li><li><i class="sp-b">Bob</i>Ask Northside about the four prices, by Monday <small>team/tasks.md</small></li><li><i class="sp-b">Bob</i>Book the van for the 12th <small>team/tasks.md</small></li><li><i class="sp-c">Lena</i>Photograph the winter prints <small>team/tasks.md</small></li><li class="more">+ 2 more</li></ul></div>`;
// Alice's own order page, live at its address: + and − really change the order.
const ORDER_ROWS = [['Tea towel, indigo', 9.5], ['Napkins, set of 4', 16], ['Linen tote', 12.5], ['Apron, rust', 22]];
const orderPageMock = () => `<div class="br"><p class="br-url"><span class="br-lock" aria-hidden="true"></span>wholesale.example.org<i class="live">Live</i></p><div class="op" data-op><p class="op-h"><b>Example Studio · Wholesale</b><span>Signed in as Corner Books</span></p>${ORDER_ROWS.map(([n, p], k) => `<div class="op-row" data-k="${k}" data-p="${p}"><span>${esc(n)}</span><small>€${p.toFixed(2)}</small><span class="op-q"><button type="button" class="op-b" data-d="-1" aria-label="One less ${esc(n)}">−</button><output>${k === 0 ? 10 : k === 2 ? 6 : 0}</output><button type="button" class="op-b" data-d="1" aria-label="One more ${esc(n)}">+</button></span></div>`).join('')}<p class="op-tot"><span>Order total</span><b class="op-sum">€170.00</b></p><span class="op-send">Send order to Bob</span></div></div>`;
const MARKET_PHOTO = 'repeating-linear-gradient(115deg, #3e5b6e 0 14px, #e9e1d2 14px 18px, #3e5b6e 18px 40px)';

// Alice's phone at lunch: the summary of what happened while she was away, and her dictated answer.
const phoneMock = () => `<div class="ph-stage"><div class="ph" role="img" aria-label="Alice’s phone"><div class="ph-notch" aria-hidden="true"></div>
  <div class="ph-top"><b>October receipts</b><span class="ph-chips"><i class="c-turn">3 Your turn</i><i class="c-run">1 Running</i></span></div>
  <div class="ph-body">
    <div class="away"><p class="away-h">While you were away</p><p>Found and filed 23 of 26 receipts. Not found: Northside Packaging €230.00, city parking €12.60, Fjord Fonts €49.00.</p></div>
    ${you('12:38', 'The packaging one is Bob’s, ask him. Skip the parking. Fonts come to the info inbox.', '', `${MIC_IC}Dictated`)}
    ${pi([tool('bash', 'himalaya -a info search "Fjord Fonts"', '1 found · 28 Oct · invoice FF-10291.pdf', true), drafts([['sent', 'bob@example.org', 'Receipt: Northside Packaging €230', 'Hi Bob, do you have the receipt for 6 October?']])], reply('Fonts invoice filed. Asked Bob for the packaging receipt; parking marked *no receipt*. **25 of 26** done, in the folder Kirsi reads.'))}
  </div>
  <div class="ph-comp">${MIC_IC}<span>Message</span></div></div></div>`;

// =====================================================================
// Alice's day: twelve glimpses, the same in all three variants
// =====================================================================
const ALICE = mkDay({
  id: 'alice', name: 'Alice', role: 'Owner', org: 'Example Studio', color: 'var(--ah-accent)',
  blurb: 'Alice runs Example Studio, a small shop for hand-printed linen, with a website, a wholesale list and a staff handbook. Bob handles orders and suppliers; Lena designs part-time.',
  places: [
    ['08:00', 'At home', 'home'], ['08:25', 'On the tram', 'tram'], ['09:10', 'In the studio', 'studio'],
    ['10:15', 'Planning with Bob and Lena', 'meet'], ['11:00', 'In the studio', 'studio'],
    ['12:20', 'Out for lunch', 'lunch'], ['13:25', 'In the studio', 'studio'],
    ['15:40', 'Packing orders with Bob', 'box'], ['16:40', 'In the studio', 'studio'], ['17:40', 'Gone home', 'home'],
  ],
  sess: [
    { id: 'today', title: 'What’s waiting today', segs: [['08:02', 'run', 'Reading mail and calendar'], ['08:04', 'turn', 'Five things today'], ['08:10', 'quiet', 'Read']] },
    { id: 'receipts', title: 'October receipts', segs: [['08:12', 'run', 'Searching 1,284 emails'], ['08:41', 'turn', '3 charges not found'], ['12:39', 'run', 'Searching the info inbox'], ['12:44', 'quiet', '25 of 26 filed']] },
    { id: 'video', title: 'Market video', segs: [['08:20', 'run', 'Installing a video program'], ['09:02', 'turn', 'Video ready to watch'], ['09:14', 'quiet', 'market-30s.mp4']] },
    { id: 'prices', title: 'Northside prices', segs: [['08:30', 'run', 'Running last week’s margin check'], ['08:34', 'turn', '4 products under 40 %'], ['09:15', 'run', 'Writing to Bob'], ['09:16', 'quiet', 'Sent to Bob']] },
    { id: 'banner', title: 'Shipping banner', segs: [['09:40', 'run', 'Reading the site’s history'], ['09:44', 'turn', 'Bob’s agent, Tuesday'], ['09:47', 'run', 'Editing the banner'], ['09:48', 'turn', 'Publish?'], ['09:49', 'run', 'Publishing'], ['09:50', 'quiet', 'Published']] },
    { id: 'returns', title: 'Returns: 30 days', segs: [['10:10', 'run', '5 workers'], ['13:35', 'turn', '17 pages ready to review'], ['13:50', 'run', 'Merging'], ['13:55', 'quiet', 'Merged'], ['15:30', 'run', 'Undoing one page'], ['15:32', 'quiet', 'Wholesale back to 14 days']] },
    { id: 'memo', title: 'Planning memo', segs: [['11:05', 'run', 'Transcribing 58 minutes'], ['11:24', 'turn', 'Memo and 7 tasks'], ['13:38', 'quiet', 'memo-2026-11-19.docx']] },
    { id: 'orders', title: 'Wholesale order page', segs: [['11:40', 'run', 'Building the order page'], ['12:10', 'turn', 'Live · send the codes?'], ['13:40', 'quiet', 'Running at wholesale.example.org'], ['16:47', 'run', 'Reading today’s orders'], ['16:50', 'turn', '3 shops ordered'], ['16:58', 'quiet', 'Running · 3 orders today']] },
    { id: 'newsletter', title: 'December newsletter', segs: [['14:05', 'run', 'Counting this year’s buyers'], ['14:30', 'turn', 'Draft for 386 people']] },
    { id: 'wrapup', title: 'Before I go', segs: [['17:25', 'run', 'Reading back through the day'], ['17:28', 'turn', 'Saved: 3 for you, 4 for the team'], ['17:32', 'quiet', 'Saved']] },
  ],
  g: [
    {
      s: 'today', at: '08:04', ask: 'What’s waiting for me today?',
      did: 'Her agent reads the notes she left in her folder yesterday, her mail since then and today’s calendar, and puts them on one screen.',
      screen: () => screen('What’s waiting today', you('08:02', 'What’s waiting for me today?') + pi([
        tool('read', 'notes/open.md', '- [ ] December newsletter: everyone who bought this year\n- [ ] Market video from Saturday’s clips\n- [ ] Returns go to 30 days on 1 Dec: handbook and site'),
        tool('bash', 'gog gmail search "newer_than:1d"', '14 messages\n07:31  Bob     Northside price list 2027 (xlsx)\n06:50  Kirsi   October: receipts missing for 26 card charges\n…', true),
        tool('bash', 'gog calendar events --today', '10:15 Planning with Bob and Lena (record it)\n15:40 Packing with Bob'),
      ], reply('Five things today:\n\n1. **Receipts.** Kirsi needs them for 26 October card charges by Friday.\n2. **Northside’s new price list** from Bob, 07:31.\n3. **The market video** from Saturday’s clips.\n4. **Returns go to 30 days** on 1 December; the handbook and the site still say 14.\n5. **Planning at 10:15** with Bob and Lena.\n\nThe December newsletter is still open from yesterday.'), nTools(3))),
    },
    {
      s: 'prices', at: '08:34', ask: 'Run last week’s margin check on Bob’s new price list.',
      did: 'Last week Alice and her agent wrote a small program that checks a supplier’s prices against the shop’s own. It is still in her folder, and today it runs on the new list from the tram.',
      screen: () => screen('Northside prices', you('08:30', 'Run last week’s margin check on Bob’s new price list.') + pi([
        tool('bash', 'git log --oneline -- tools/margin_check.py', '3f2d1aa  12 Nov  Add margin check for supplier price lists', true),
        tool('bash', 'gog gmail attachment "Northside price list 2027"', 'saved inbox/northside-prices-2027.xlsx · 148 rows'),
        tool('bash', 'python3 tools/margin_check.py inbox/northside-prices-2027.xlsx', '148 products · 144 at 40 % or more\nunder 40 %: 4', true),
      ], reply('Four products fall under your 40 % margin at Northside’s new prices:\n\n| Product | Cost | Price | Margin |\n|---|---|---|---|\n| Linen tote | €14.20 | €22 | 35 % |\n| Apron, indigo | €24.50 | €39 | 37 % |\n| Tea towels, 2 | €11.80 | €19 | 38 % |\n| Napkins, 4 | €17.10 | €28 | 39 % |'), nTools(3)) + you('09:15', 'Send Bob that table and ask what Northside says.') + pi([], reply('Sent from your mailbox.', drafts([['sent', 'bob@example.org', 'Northside 2027: four products under 40 %', 'Hi Bob, the margin check flags four products…']])))),
    },
    {
      s: 'receipts', at: '08:41', ask: 'Find the receipts for October’s card charges and file them for Kirsi.',
      did: 'It reads the card statement, searches every email since late September for attachments, matches each charge by amount and date in a short program, and files the receipts under one naming rule. Three it cannot find, so it asks.',
      screen: () => screen('October receipts', you('08:12', 'Find the receipts for October’s card charges and file them for Kirsi.', att('statement-2026-10.pdf', 'Card statement · 2 pages')) + pi([
        tool('bash', 'pdftotext statement-2026-10.pdf -', '26 charges · €2,914.60'),
        tool('bash', 'gog gmail search "has:attachment after:2026/09/25" --all', '1,284 messages · 212 with a PDF or image attached', true),
        tool('write', 'bookkeeping/match_receipts.py', '48 lines'),
        tool('bash', 'python3 bookkeeping/match_receipts.py', 'matched 23 of 26 (amount, and date within 3 days)\nsaved bookkeeping/2026-10/2026-10-03 Paper Mill Supply 184.20.pdf\n… 22 more\nnot found: 3', true),
      ], reply('**23 of 26** are in *bookkeeping/2026-10*, named date, vendor, amount. Not in your mail:\n\n| Date | Charge | Amount |\n|---|---|---|\n| 6 Oct | Northside Packaging | €230.00 |\n| 14 Oct | City parking | €12.60 |\n| 28 Oct | Fjord Fonts | €49.00 |\n\nDo you know where these are?'), nTools(4))),
    },
    {
      s: 'video', at: '09:02', ask: 'Cut Saturday’s market clips into a 30-second video for the shop page, with captions.',
      did: 'The clips are on her laptop. The agent copies them over, finds that the server has no video program, installs one into her own account, and cuts and captions the video. She watches it on the tram.',
      screen: () => screen('Market video', you('08:20', 'Cut Saturday’s market clips into a 30-second video for the shop page, with captions.') + pi([
        tool('computer', 'Alice’s laptop › Pictures › Market 14 Nov', '3 clips · 4K · 6 min 12 s in all\ncopied to video/market-2026-11-14/'),
        tool('bash', 'ffmpeg -version', 'bash: ffmpeg: command not found', true),
        tool('bash', 'install ffmpeg into ~/.local/bin', 'downloaded ffmpeg 7.1, static build, 79 MB\ninstalled for alice only; no administrator rights needed', true),
        tool('write', 'video/market-2026-11-14/captions.srt', '5 captions'),
        tool('bash', 'ffmpeg -i stall.mov -i print.mov -i wrap.mov -filter_complex … market-30s.mp4', '30.0 s · 1080p · 14 MB'),
      ], reply('A 30-second cut with five captions: the stall, printing, wrapping. It is open beside this conversation.', offer('market-30s.mp4', 'Video · 30 s · 14 MB')), nTools(5)), viewPane('market-30s.mp4', videoMock())),
    },
    {
      s: 'banner', at: '09:44', ask: 'Our site says “Free shipping over €30”. Who put that there, and why?',
      did: 'The website lives in a shared folder where every change has an author, a time and a reason. Her agent looks up the change that added the line: it was Bob’s agent, on Bob’s word. She adds an end date, and it publishes when she says yes.',
      screen: () => screen('Shipping banner', you('09:40', 'Our site says “Free shipping over €30”. Who put that there, and why?') + pi([
        tool('bash', 'git log -S "Free shipping" -- site/', 'a41c9e2  Tue 17 Nov 16:42  Bob (agent)\n    Add free-shipping banner for Northside week\n    Bob: Northside pays the postage on orders over €30\n    until Sunday 22 Nov. Take it down on Monday.', true),
      ], reply('**Bob’s agent added it on Tuesday at 16:42**, at Bob’s request: Northside pays the postage on orders over €30 until Sunday, and Bob wants it down on Monday. The banner itself does not say that it ends.'), nTools(1)) + you('09:47', 'Add “until Sunday” to it.') + pi([
        diff('site/_includes/banner.html', ['- Free shipping over €30', '+ Free shipping over €30 until Sunday 22 November']),
      ], reply('Changed. Publishing pushes it to the shop’s repository on Gitea, and the site updates from there. Publish?')) + you('09:49', 'Yes.') + pi([tool('bash', 'git push origin main', 'a41c9e2..5be07d1  main -> main')], reply('Published.'))),
    },
    {
      s: 'memo', at: '11:24', ask: 'Here’s this morning’s planning. A memo and the tasks, please.',
      did: 'The planning meeting was recorded on her phone. Back at her desk she drops in the hour’s recording. It is transcribed on the server with each speaker named, the memo is written, and each task lands in the list of the person who owns it. Nothing is sent: Bob and Lena find theirs in the team folder.',
      screen: () => screen('Planning memo', you('11:05', 'Here’s this morning’s planning. A memo and the tasks, please.', att('planning-2026-11-19.m4a', 'Recording · 58 min · 54 MB')) + pi([
        tool('bash', 'ffmpeg -i planning-2026-11-19.m4a -ac 1 -ar 16000 planning.wav', '58:12 · mono · 16 kHz'),
        tool('bash', 'whisperx planning.wav --diarize --language en', 'transcribed on this server in 9 min · nothing uploaded\n3 speakers: SPEAKER_00 41 % · SPEAKER_01 35 % · SPEAKER_02 24 %', true),
        tool('read', 'calendar › Planning 10:15', 'Alice, Bob, Lena · speakers named from the invite; check the memo'),
        tool('write', 'meetings/2026-11-19-planning.md', '3 decisions · 7 tasks · each with its minute in the recording'),
        diff('team/tasks.md', ['+ Bob: ask Northside about the four prices (by Mon)  [planning 19 Nov, 22:10]', '+ Bob: book the van for 12 Dec  [44:30]', '+ Lena: photograph the winter prints  [12:55]']),
      ], reply('The memo is open beside this, and as a Word file. **Seven tasks**: three for you in *notes/open.md*, two for Bob and two for Lena in *team/tasks.md*, each with the minute it was agreed. Nothing was sent; they will find theirs in the team folder.', offer('memo-2026-11-19.docx', 'Word · 2 pages · 18 KB')), nTools(4)), viewPane('meetings/2026-11-19-planning.md', memoMock())),
    },
    {
      s: 'receipts', at: '12:38', ask: 'The packaging one is Bob’s, ask him. Skip the parking. Fonts come to the info inbox.',
      did: 'At lunch Alice opens her phone. Three conversations wait for her, and the returns job has been working since ten with the tab closed. She reads the summary and answers by voice; the agent searches the shop’s other inbox and writes to Bob, as she asked.',
      screen: phoneMock,
    },
    {
      s: 'returns', at: '13:35', ask: 'From 1 December returns are 30 days, not 14. Update the handbook and the site, and check them against what customers actually ask.',
      did: 'She asked just before the meeting. The agent finds 17 pages that mention returns and splits the work. One worker reads every return question customers mailed this year; three each rewrite one part, starting fresh with only their own pages; a fifth, on a different model, checks every change against the policy and the real questions and sends two back. Alice talks to one agent the whole time.',
      screen: () => screen('Returns: 30 days', you('10:10', 'From 1 December returns are 30 days, not 14. Update the handbook and the site, and check them against what customers actually ask.') + pi([
        tool('bash', 'grep -ril "return" handbook/ site/', '17 files'),
        workers([['done', 'Mail', '212 return questions since January', '1-page report'], ['done', 'Shop floor', 'handbook/shop · 6 pages', '6 changed'], ['done', 'Online orders', 'handbook/online · 7 pages', '7 changed'], ['done', 'Site', 'site/faq, site/terms · 4 pages', '4 changed'], ['done', 'Checker', 'every change against policy and mail', '2 sent back']]),
        tool('read', 'workers/checker/report.md', '1. site/faq.md still says “14 days” for sale items → back to Site, fixed\n2. handbook/online/gifts.md contradicts the gift rule → back to Online orders, fixed\n3 customer questions that no page answered now have answers', true),
      ], reply('**17 pages updated** on the branch *returns-30-days*. The checker found two contradictions and the workers fixed them. Three questions customers kept asking (sale items, gifts, exchanges) now have answers in the FAQ.\n\nThe changes are open beside this conversation. Merge them?'), '2 tools · 5 workers'), viewPane('returns-30-days · 17 files', returnsView())),
    },
    {
      s: 'newsletter', at: '14:30', ask: 'Draft the December newsletter for everyone who bought from us this year.',
      did: 'While the agent counts buyers, Alice changes her mind and adds a message; it takes it on board at the next step. The photos are the ones Bob’s agent cleaned up an hour ago. Every number comes from the order file, and the recipient list says who was left out and why. Nothing is sent until she says so.',
      screen: () => screen('December newsletter', you('14:05', 'Draft the December newsletter for everyone who bought from us this year.') + you('14:08', 'Leave out the wholesale shops, they get their own letter.', '', 'Sent while it worked · taken on board at the next step') + pi([
        tool('bash', 'python3 newsletter/recipients.py orders/2026.csv', '512 buyers in 2026\n− 61 unsubscribed\n−  9 duplicates (same address, different case)\n− 56 wholesale shops\n= 386 → newsletter/recipients.csv', true),
        tool('write', 'newsletter/2026-12.html', '1 page · 2 photos from team/photos/winter (Bob, today 13:20)'),
      ], reply('A draft for **386 people** is open beside this. *recipients.csv* lists them, and the 126 left out with the reason for each. Nothing has been sent; say when.', offer('recipients.csv', '386 recipients + 126 left out · 41 KB')), nTools(2)), viewPane('2026-12.html', newsMock())),
    },
    {
      s: 'returns', at: '15:30', ask: 'Bob says wholesale stays at 14 days. Undo just the change to the wholesale page.',
      did: 'Every change the workers made is recorded with what changed, when and why. The agent puts one page back as it was and leaves the other sixteen alone, and the undo is recorded too.',
      screen: () => screen('Returns: 30 days', you('15:30', 'Bob says wholesale stays at 14 days. Undo just the change to the wholesale page.') + pi([
        tool('bash', 'git log --oneline -2 -- handbook/online/wholesale.md', 'c7e01b2  13:55  Returns: 30 days from 1 Dec (worker: Online orders)\n81aa0f4  2 Sep   Wholesale terms 2026', true),
        tool('bash', 'git restore --source=81aa0f4 handbook/online/wholesale.md', 'e93b4d0  Wholesale keeps 14-day returns (Bob, 19 Nov)'),
      ], reply('Undone. Wholesale is back to 14 days; the other 16 pages keep the new policy.', diff('handbook/online/wholesale.md', ['- Wholesale orders can be returned within 30 days.', '+ Wholesale orders can be returned within 14 days.']) + `<p class="hist"><span>Recorded 15:31 · e93b4d0</span><button type="button" class="quiet-btn" data-undo>Undo this too</button></p>`), nTools(2))),
    },
    {
      s: 'orders', at: '16:50', ask: 'How did the order page do today?',
      did: 'At noon her agent built a small order page for the shops that buy wholesale: their prices, a code per shop, orders straight into Bob’s order file. It runs in her own account at her own address, and it kept running all afternoon with every tab closed. Three shops have already used it.',
      screen: () => screen('Wholesale order page', you('11:40', 'Bob says the shops still phone in their orders. Make a simple order page for our wholesale shops: their prices, a code for each shop, and the orders go into Bob’s order file.') + pi([
        tool('read', 'wholesale/prices-2026.csv', '64 products · 12 shops'),
        tool('write', 'apps/wholesale/app.py', '182 lines · Python and SQLite'),
        tool('bash', 'systemctl --user enable --now wholesale', 'wholesale.service: active (running)\nkeeps running when you sign out', true),
        tool('publish', 'wholesale.example.org → apps/wholesale', 'https://wholesale.example.org · certificate ok'),
      ], reply('It is live at **wholesale.example.org**. Each shop signs in with its own code, and orders go into *orders/wholesale.csv*, where Bob’s agent reads them. Send the twelve shops their codes?'), nTools(4)) + you('12:12', 'Yes, from my mailbox.') + pi([], reply('Sent, one message per shop.', drafts([['sent', '12 shops', 'Order online from today', 'Hi, from today you can order at wholesale.example.org with the code…']]))) + you('16:48', 'How did the order page do today?') + pi([
        tool('bash', 'sqlite3 apps/wholesale/orders.db "select shop, items, total from orders where day = today"', 'Corner Books     16 items   €170.00\nHarbour Gifts    19 items   €742.50\nMill Lane Deli    6 items   €373.50', true),
      ], reply('Running since 12:10. **Three shops ordered**, 41 items, €1,286. Bob already has them in *orders/wholesale.csv*.'), nTools(1)), viewPane('wholesale.example.org', orderPageMock(), 'Live')),
    },
    {
      s: 'wrapup', at: '17:28', ask: 'Before I go.',
      did: 'In October Alice wrote herself a small skill for the end of the day, three sentences long. Her agent follows it: it reads back through the day’s conversations and writes down what the next agent should know. What concerns only Alice goes into her own notes; what concerns everyone goes into the team’s folder, where Bob’s agent will read it tomorrow.',
      screen: () => screen('Before I go', you('17:25', 'Before I go.', '', `${SKILL_IC}Her own skill · <code>before-i-go</code>`) + pi([
        tool('read', 'skills/before-i-go/SKILL.md', 'Written by Alice, 2 Oct.\nRead back through today’s conversations. What only I need goes in ~/AGENTS.md;\nwhat everyone needs goes in team/AGENTS.md. Short lines. Ask before removing anything.', true),
        tool('read', 'today’s 9 conversations', 'What’s waiting today · Northside prices · October receipts · Market video · Shipping banner · Planning memo · Wholesale order page · Returns: 30 days · December newsletter'),
        diff('~/AGENTS.md', ['+ Receipts: name them “date vendor amount.pdf”.', '+ The Fjord Fonts bill comes to the info inbox.', '+ Video captions: the shop font, six words at most.'], 'Only for you'),
        diff('team/AGENTS.md', ['+ Returns: 30 days from 1 Dec 2026. Wholesale stays', '+   at 14 days (Bob, 19 Nov).', '+ Wholesale orders arrive in orders/wholesale.csv', '+   from wholesale.example.org.', '+ A promotion banner on the site says when it ends.', '+ Supplier price lists: run tools/margin_check.py.'], 'For everyone at Example Studio'),
      ], reply('Written down. Your own notes stay yours. The team notes are in the shared folder, so tomorrow Bob’s agent knows the returns rule and where the wholesale orders come in.'), '2 tools · 2 files')),
    },
  ],
});
const aliceIntro = (how) => `<section class="day-intro" id="day">
  <p class="kicker">One person, one day</p>
  <h2>Alice’s Thursday, ten agents.</h2>
  <p>${ALICE.blurb} On Thursday she started ten conversations with her agents: some were done in a minute, one worked through lunch, one is still running tonight. ${how}</p>
</section>`;
const aliceEnd = `<section class="day-end"><p>At 17:40 the newsletter still waits for her: it goes out when she says so. The order page is still taking orders. Tomorrow her agents start from what this one wrote down, and so do Bob’s.</p></section>`;

// ---------- Interactions shared by the screens ----------
stage.addEventListener('click', (e) => {
  const disc = e.target.closest('.disc');
  if (disc) {
    const open = disc.getAttribute('aria-expanded') !== 'true';
    disc.setAttribute('aria-expanded', String(open));
    disc.nextElementSibling.hidden = !open;
    return;
  }
  const dl = e.target.closest('.offer-b');
  if (dl) { const t = dl.textContent; dl.textContent = dl.dataset.done; dl.dataset.done = t; dl.classList.toggle('done'); return; }
  const undo = e.target.closest('[data-undo]');
  if (undo) {
    const sp = undo.parentElement.querySelector('span');
    const undone = undo.toggleAttribute('data-undone');
    undo.textContent = undone ? 'Redo' : 'Undo this too';
    sp.textContent = undone ? 'Undone 15:34 · wholesale back at 30 days' : 'Recorded 15:31 · e93b4d0';
    return;
  }
  const ob = e.target.closest('.op-b');
  if (ob) {
    const row = ob.closest('.op-row'); const out = row.querySelector('output');
    out.textContent = Math.max(0, +out.textContent + +ob.dataset.d);
    const op = ob.closest('[data-op]');
    const sum = [...op.querySelectorAll('.op-row')].reduce((a, r) => a + +r.dataset.p * +r.querySelector('output').textContent, 0);
    op.querySelector('.op-sum').textContent = `€${sum.toFixed(2)}`;
    return;
  }
  const play = e.target.closest('.vid-play');
  if (play) {
    const v = play.closest('.vid'); const frame = v.querySelector('.vid-frame');
    if (v.classList.toggle('playing')) {
      play.setAttribute('aria-label', 'Pause');
      const start = performance.now() - (+v.dataset.pos || 0);
      const step = () => {
        if (!v.isConnected || !v.classList.contains('playing')) return;
        const pos = (performance.now() - start) % 30000; v.dataset.pos = pos;
        const k = Math.min(4, Math.floor(pos / 6000));
        if (frame.dataset.k !== String(k)) { frame.dataset.k = k; frame.querySelector('.vid-cap').textContent = CAPTIONS[k]; }
        v.querySelector('.vid-prog').style.transform = `scaleX(${pos / 30000})`;
        v.querySelector('.vid-t').textContent = `0:${String(Math.floor(pos / 1000)).padStart(2, '0')}`;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else play.setAttribute('aria-label', 'Play');
    return;
  }
  // Toggles inside mock views (before/after, oak/black, ink mixing): one attribute on the view.
  const tg = e.target.closest('[data-set]');
  if (tg) {
    const host = tg.closest('[data-view]');
    host.dataset.state = tg.dataset.set;
    host.querySelectorAll('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(b === tg)));
    const lbl = host.querySelector(':not(button)[data-label]');
    if (lbl && tg.dataset.label) lbl.textContent = tg.dataset.label;
  }
});
