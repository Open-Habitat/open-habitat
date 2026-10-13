// Kierros 13.10.2026: istunnon merkinnät. Pi tallentaa mallin ja ajattelutason omina
// merkintöinään keskustelun alussa (usein eri hetkinä) ja aina kun ne vaihtuvat;
// tiivistys on samaa perhettä. Fixture lisää alkuasetukset, ajattelutason vaihdon ja
// tiivistyksen historiaan.

const MODEL_ID = 'openai-codex/gpt-5.5';
const ICON_CHIP = SVG('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>');
const ICON_THINK = SVG('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>');
const ICON_COMPACT = SVG('<path d="M4 9h16M4 15h16"/><path d="m9 4 3 3 3-3M9 20l3-3 3 3"/>');

CONVO.unshift({ kind: 'marker', t: 'settings', time: '14:28', model: MODEL_ID, thinking: 'medium' });
const at33 = CONVO.findIndex(m => m.kind === 'user' && m.time === '14:33');
CONVO.splice(at33, 0,
  { kind: 'marker', t: 'compaction', time: '14:33', detail: '41 viestiä tiivistettiin, 38 000 → 5 200 tokenia' },
  { kind: 'marker', t: 'thinking', time: '14:33', from: 'medium', to: 'high' });
// The thread after a change knows its settings (v2 shows them in its head).
let thinkingNow = 'medium';
// The level in force now: the last change in the history.
const CURRENT = [...CONVO].reverse().find(m => m.kind === 'marker' && m.t === 'thinking')?.to ?? 'medium';

let V = 'v1';
const copyId = copyBtn('Kopioi mallin tunniste', MODEL_ID);
const setting = (icon, label, value, extra = '') => `<span class="set"><span class="set-ic">${icon}</span><span class="set-l">${label}</span><span class="set-v">${value}</span>${extra}</span>`;

const MARK = {
  // Alkurivi: the start settings as one row; changes and compaction as the same kind of row.
  v1: (m, i) => {
    if (m.t === 'settings') return `<div class="mrow ah-in" style="--i:${i}" role="note" aria-label="Keskustelun asetukset">${setting(ICON_CHIP, 'Malli', `<span class="mono">${esc(m.model)}</span>`, copyId)}${setting(ICON_THINK, 'Ajattelu', esc(m.thinking))}<time class="meta">${m.time}</time></div>`;
    if (m.t === 'thinking') return `<div class="mrow ah-in" style="--i:${i}" role="note">${setting(ICON_THINK, 'Ajattelu', `${esc(m.from)} <span class="arrow">→</span> <strong>${esc(m.to)}</strong>`)}<time class="meta">${m.time}</time></div>`;
    if (m.t === 'compaction') return `<div class="mrow ah-in" style="--i:${i}" role="note">${setting(ICON_COMPACT, 'Tiivistys', esc(m.detail))}<time class="meta">${m.time}</time></div>`;
    return '';
  },
  // Langan pää: no rows for the start; a change or compaction is a thin divider, and the next
  // Pi head says the new value.
  v2: (m, i) => {
    if (m.t === 'thinking') { thinkingNow = m.to; return ''; }
    if (m.t === 'compaction') return `<div class="mline ah-in" style="--i:${i}" role="note"><span>${ICON_COMPACT}Tiivistys · ${esc(m.detail)}</span><time class="meta">${m.time}</time></div>`;
    return '';
  },
  // Yläpalkki: settings in the bar; in the stream only change and compaction lines.
  v3: (m, i) => {
    if (m.t === 'thinking') return `<div class="mline ah-in" style="--i:${i}" role="note"><span>${ICON_THINK}Ajattelu ${esc(m.from)} → <strong>${esc(m.to)}</strong></span><time class="meta">${m.time}</time></div>`;
    if (m.t === 'compaction') return `<div class="mline ah-in" style="--i:${i}" role="note"><span>${ICON_COMPACT}Tiivistys · ${esc(m.detail)}</span><time class="meta">${m.time}</time></div>`;
    return '';
  },
};
markerR = (m, i) => MARK[V](m, i);

// ---------- Thread head carries the summary; no settled strip at the end ----------
const libLanka = lanka;
lanka = (cls, opts) => {
  thinkingNow = 'medium';
  let html = libLanka(cls, opts);
  // v2: each Pi head shows model and thinking level; the first head after a change marks it.
  if (V === 'v2') {
    let seen = 'medium'; const order = CONVO.filter(m => m.kind === 'turn' || (m.kind === 'marker' && m.t === 'thinking'));
    let level = 'medium'; const heads = [];
    for (const m of order) { if (m.kind === 'marker') { level = m.to; continue; } heads.push(level); }
    let n = 0;
    html = html.replace(/<span class="model">GPT-5\.5<\/span>(<span class="sum")/g, (all, rest) => {
      const lv = heads[n++] ?? level; const changed = lv !== seen; seen = lv;
      return `<span class="model">GPT-5.5</span><span class="think-lv${changed ? ' changed' : ''}" title="Ajattelutaso">${changed ? 'ajattelu → ' : 'ajattelu '}${lv}</span>${rest}`;
    });
    thinkingNow = level;
  }
  return html;
};
const libWithLive = withLive;
withLive = (cls, R) => libWithLive(cls, {
  ...R,
  head: (s, sum) => `<div class="head-cell">${s.status === 'settled' ? `<button class="head-btn" type="button" data-fold aria-expanded="${s.open}">${CHEV}<span class="who">Pi</span></button>` : '<span class="who" style="padding-left:1px">Pi</span>'}<span class="model">${MODEL}</span>${V === 'v2' ? `<span class="think-lv">ajattelu ${thinkingNow}</span>` : ''}${s.status === 'settled' ? `<span class="sum">${sum} · ${s.dur}</span>` : ''}</div>`,
  strip: (s, sum) => s.status === 'working' ? R.strip(s, sum) : '',
});

// ---------- v3: the settings chip in the top bar ----------
const libActions = APP.actions;
APP.actions = (c) => (V === 'v3' && c.id === 'c1' ? `<button class="set-chip" type="button" data-ui="info" title="Malli ja ajattelutaso · avaa tiedot"><span class="mono">gpt-5.5</span><span class="dot" aria-hidden="true">·</span><span>${CURRENT}</span></button>` : '') + libActions(c);

function view(v) { V = v; return appView(); }
const v1 = () => view('v1');
const v2 = () => view('v2');
const v3 = () => view('v3');
