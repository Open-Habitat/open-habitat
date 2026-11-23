// The block kit: what a block draws its screen with. Runs at build time in
// Node; every function returns an HTML string, so the built page reads without
// JavaScript and client.js only adds behaviour.
//
// The conversation pieces copy the product's DOM and class names
// (web/src/components/AgentTurn.tsx, Conversation.tsx Message and ToolRow,
// PiBlocks.tsx PiToolUse, OfferCard.tsx, the workers panel) so that
// product.css, which carries the product's CSS values, gives them the
// product's shapes. A settled turn is closed, as in the product: one summary
// row per stage ("1 thought · 3 tools · 52 min 10 s") that opens that stage's
// work; every tool row in it is closed again and opens on its own.
import { readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const lib = (n) => readFileSync(join(here, '../../../lib', n), 'utf8');
// lib/markdown.js and lib/icons.js are browser scripts of top-level consts; read them once here.
const L = new Function(`${lib('markdown.js')}\n${lib('icons.js')}\nreturn { esc, inline, md, ICON_CHECK, ICON_COPY, CHEV };`)();
export const { esc, inline, md, ICON_CHECK, ICON_COPY, CHEV } = L;

// ---------- Icons ----------
const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
export const FILE_IC = sv('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>');
export const MAIL_IC = sv('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>');
export const MIC_IC = sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>');
export const SKILL_IC = sv('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>');
export const PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
// The product's Icon set (web/src/components/Icon.tsx): forward, check, message, copy, download.
const IC = {
  forward: sv('<path d="m9 6 6 6-6 6"/>', ' class="ah-ic"'),
  check: sv('<path d="M5 12.5 10 17l9-10"/>', ' class="ah-ic"'),
  message: sv('<path d="M4 5h16v11H9l-5 4z"/>', ' class="ah-ic"'),
  copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', ' class="ah-ic"'),
  download: sv('<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>', ' class="ah-ic"'),
  branch: sv('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M6 12h3a6 6 0 0 0 6-3"/>', ' class="ah-ic"'),
};
export { IC as ICONS };

// The Open Habitat mark; data-state is idle, working or waiting as in the product's rail.
const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';
export const mark = (px = 22, state = 'idle') => `<svg class="oh-mark" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" aria-hidden="true"><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/></svg>`;

// ---------- Assets ----------
// A block's binary files live outside git in $ETUSIVU_ASSETS/<block-id>/ and
// are copied by build.mjs to <out>/assets/<block-id>/. A block gets its own
// resolver: `const asset = assets(import.meta.url); asset('clip.mp4')`.
export const USED_ASSETS = new Map(); // block id -> Set of names
export function assets(metaUrl) {
  const id = relative(join(here, '../blocks'), dirname(fileURLToPath(metaUrl))).split(sep)[0];
  return (name) => {
    if (!USED_ASSETS.has(id)) USED_ASSETS.set(id, new Set());
    USED_ASSETS.get(id).add(name);
    return `assets/${id}/${name}`;
  };
}

// ---------- The person's message ----------
// you(time, text, extra?, note?): the person's message card, right-aligned as in
// the product's feed. `extra` goes under the text (an attachment); `note` is a
// quiet line such as "Dictated" or "Sent while it worked".
export const you = (time, text, extra = '', note = '') => `<div class="c-row c-you"><article class="ah-message ah-message-user"><header><strong>You</strong><span class="ah-copy" aria-hidden="true">${IC.copy}</span>${time ? `<time>${time}</time>` : ''}</header><div class="ah-prose">${md(text)}</div>${extra}${note ? `<p class="u-note">${note}</p>` : ''}</article></div>`;
export const att = (name, meta) => `<p class="att">${FILE_IC}<span class="att-n">${esc(name)}</span><span class="att-m">${esc(meta)}</span></p>`;

// ---------- Work ----------
// tool(name, target, out?, stat?): one tool row, closed, "done". `out` is what
// opens under it; `stat` is the product's quiet file stat ("new · 45 lines").
export const tool = (name, target, out = '', stat = '') => ({ kind: 'tool', html: `<div class="ah-pi-tool-use"><section class="ah-tool-row" data-state="succeeded" data-tool-name="${esc(name)}"><button type="button" class="ah-disclosure-button ah-tool-disclosure" aria-expanded="false">${IC.forward}<span class="ah-tool-names"><span class="ah-tool-name">${esc(name)}</span>${target ? `<code class="ah-tool-target">${esc(target.split('\n')[0])}</code>` : ''}</span>${stat ? `<span class="ah-file-stat">${esc(stat)}</span>` : ''}<span class="ah-status ah-status-success">${IC.check}done</span></button><div class="ah-disclosure-panel" hidden><div class="ah-tool-output"><pre>${esc(out || 'ok')}</pre></div></div></section></div>` });
// thought(text): one line of Pi's reasoning, as the product's ThinkingRow.
export const thought = (text) => ({ kind: 'thinking', html: `<div class="ah-think-row"><span>Thinking</span><span class="ah-think-text">${inline(text)}</span></div>` });
// Anything else in the work (a diff, a mail draft): drawn as given.
const asWork = (x) => (typeof x === 'string' ? { kind: 'other', html: `<div class="ah-work-other">${x}</div>` } : x);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const message = (kind, text, extra = '') => {
  const head = kind === 'interim' ? `${IC.message}Interim reply` : `${IC.check}Reply done`;
  return `<article class="ah-message ah-message-reply${kind === 'interim' ? ' ah-message-interim' : ''}"><header><strong>${head}</strong><span class="ah-copy" aria-hidden="true">${IC.copy}</span></header><div class="ah-prose">${md(text)}</div>${extra}</article>`;
};
// reply(text, extra?): a finished reply card on its own (outside a turn).
export const reply = (text, extra = '') => `<div class="c-row c-reply">${message('final', text, extra)}</div>`;

function stage(st, last) {
  const work = [...(st.thoughts || []).map((t) => (typeof t === 'string' ? thought(t) : t)), ...(st.tools || []).map(asWork)];
  const n = (k) => work.filter((w) => w.kind === k).length;
  const sum = st.summary || [n('thinking') && plural(n('thinking'), 'thought', 'thoughts'), n('tool') && plural(n('tool'), 'tool', 'tools')].filter(Boolean).join(' · ') || 'Work';
  const label = `${sum}${st.time ? ` · ${st.time}` : ''}`;
  const row = work.length ? `<div class="ah-turn-stage"><button type="button" class="ah-stage-toggle" aria-expanded="false" aria-label="Show work: ${esc(label)}" data-show="Show work: ${esc(label)}" data-hide="Hide work: ${esc(label)}"><span aria-hidden="true" class="ah-disclosure-chevron"></span><span class="ah-stage-sum">${esc(sum)}</span>${st.time ? ` · <span class="ah-stage-elapsed">${esc(st.time)}</span>` : ''}</button></div><div class="ah-turn-work" hidden><div class="ah-ordered-blocks">${work.map((w) => w.html).join('')}</div></div>` : '';
  const text = st.text ?? st.reply;
  const end = text != null ? `<div class="ah-turn-reply${last ? '' : ' ah-turn-interim'}">${message(last ? 'final' : 'interim', text, st.extra || '')}</div>` : '';
  return row + end;
}
// turn({ thoughts, tools, time, summary, reply, extra, interim, panel }):
// one settled agent turn. `tools` may hold tool() rows and plain HTML (a diff,
// a draft). `interim: { thoughts, tools, time, text }` is an earlier stage
// that ended in an interim reply. `summary` replaces the counted summary
// ("2 tools · 5 workers"). `panel` (workers()) is drawn under the turn, open,
// as the product's workers panel is.
export function turn(o) {
  const stages = [...(o.interim ? [o.interim] : []), o];
  return `<div class="c-row c-agent"><section class="ah-agent-turn">${stages.map((s, i) => stage(s, i === stages.length - 1)).join('')}</section>${o.panel || ''}</div>`;
}

// offer(name, meta): the file the agent offers for download (OfferCard).
export const offer = (name, meta) => `<div class="ah-offer"><span class="ah-offer-ic">${FILE_IC}</span><span class="ah-offer-n"><b>${esc(name)}</b><small>${esc(meta)}</small></span><button type="button" class="ah-offer-b" data-done="Saved to Downloads">${IC.download}<span>Download</span></button></div>`;
// workers([[state, name, task, progress], ...]): the workers panel (WorkerHeader, workers.png).
export const workers = (rows) => `<div class="ah-workers" role="group" aria-label="Workers"><p class="ah-workers-tabs"><span class="on">${IC.branch}Workers <b>${rows.length}</b></span></p><ul>${rows.map(([state, name, task, prog]) => `<li class="wk-${state}">${mark(16, state === 'run' ? 'working' : 'idle')}<span class="wk-main"><b>${esc(name)}</b><span class="wk-t">${esc(task)}</span></span><span class="wk-p">${esc(prog)}</span></li>`).join('')}</ul></div>`;
export const drafts = (rows) => `<ul class="drafts">${rows.map(([state, to, subj, first]) => `<li class="dr dr-${state.split(' ')[0]}">${MAIL_IC}<span class="dr-main"><span class="dr-to">To ${esc(to)}</span><b>${esc(subj)}</b><span class="dr-first">${esc(first)}</span></span><span class="dr-s">${esc(state)}</span></li>`).join('')}</ul>`;
export const diff = (file, lines, label = '') => `<div class="diff"><p class="diff-h">${FILE_IC}<span>${esc(file)}</span>${label ? `<small>${esc(label)}</small>` : ''}</p><pre>${lines.map((l) => `<span class="${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx'}">${esc(l)}</span>`).join('')}</pre></div>`;

// ---------- The window ----------
// screen(title, body, view?, org?): one conversation in a slim product window,
// with an optional view opened beside it.
export const screen = (title, body, v = '', org = 'Example Studio') => `<div class="scr${v ? ' has-view' : ''}"><div class="scr-bar">${mark(14)}<b>${esc(title)}</b><span>${esc(org)}</span></div><div class="scr-main"><div class="scr-convo"><div class="c-feed">${body}</div></div>${v}</div></div>`;
// view(title, html, kind?): the view panel beside the conversation (ViewPanel).
export const view = (title, html, kind = 'View') => `<aside class="scr-view" aria-label="${esc(kind)}: ${esc(title)}"><p class="scr-view-h"><span class="scr-view-ic">${FILE_IC}</span><span class="scr-view-t"><b>${esc(title)}</b><small>${esc(kind)} · Only for you</small></span></p><div class="scr-view-b">${html}</div></aside>`;
export const nTools = (n) => plural(n, 'tool', 'tools');
// A conversation still working: the ask and the product's working row.
export const working = (time, ask, line) => you(time, ask) + `<div class="c-row c-agent"><section class="ah-agent-turn"><div class="ah-turn-strip ah-turn-working"><button type="button" class="ah-show-work" aria-expanded="false" disabled><span>Show work</span></button><span class="ah-status ah-status-working">${mark(14, 'working')}Agent working · ${esc(line)}…</span></div></section></div>`;

// ---------- Media from a block's assets ----------
// image(src, alt, w, h): a picture that keeps its space while it loads.
export const image = (src, alt, w, h, cls = '') => `<img class="m-img${cls ? ` ${cls}` : ''}" src="${esc(src)}" alt="${esc(alt)}" width="${w}" height="${h}" loading="lazy" decoding="async">`;
// video(src, { poster, w, h, label }): an MP4 with its poster; nothing loads
// until the reader presses play. `label` names it for a screen reader.
export const video = (src, { poster, w, h, label = '' } = {}) => `<video class="m-video" src="${esc(src)}"${poster ? ` poster="${esc(poster)}"` : ''}${w ? ` width="${w}" height="${h}"` : ''} controls muted playsinline preload="none"${label ? ` aria-label="${esc(label)}"` : ''}></video>`;
