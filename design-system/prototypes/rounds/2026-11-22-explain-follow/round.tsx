// Explain mode: the card follows the pointer (issue explain-card-follows-pointer).
// Jari 22.11.: the card is in the way while browsing. In every direction the
// card keeps following the pointer; moving onto it does not hold it (it never
// takes the pointer); only F pins it, and F also opens the report field; a
// click never opens the report. Esc unpins, a second Esc ends the mode.
// One axis: how the following card stays out of the way.
//   A Beside: the card travels beside the pointer, below right, flipping
//     sides near the edges.
//   B Sidestep: the card sits beside the pointed part and slides to the
//     part's other side when the pointer comes near it.
//   C Corner: a fixed corner panel whose content changes; a small marker
//     sits on the pointed part, and the panel changes corner when the
//     pointer comes near it.
//
// Hit-testing is round explain-feedback-3's copy of production's
// ExplainLayer (elementsFromPoint, the smallest visible part, lingering over
// empty space); the look is production's ExplainMode.css and the cards are
// production's text/explainMode.ts. The view under the mode is synthetic: a
// Habitat rail, a conversation's top bar, feed and composer, with about forty
// parts carrying their real card ids.
import React, {type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/ExplainMode.css';
import {Icon} from '../../../../web/src/components/Icon';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {parts, waiting, type CardId} from '../../../../web/src/components/explainParts';
import {explainModeText} from '../../../../web/src/text/explainMode';
import {type Lang, NAMES, TEXT, type Text} from './text';
import './round.css';

type Rect = {x: number; y: number; w: number; h: number};
type Target = {id: CardId; el: Element; rect: Rect};
type Src = 'pointer' | 'keyboard' | 'touch';
type Point = {x: number; y: number};
type CardText = {name: string; lead: string; know?: string; keyboard?: string; try?: string};

const params = new URLSearchParams(location.search);
let lang: Lang = params.get('lang') === 'en' ? 'en' : 'fi';
let theme = params.get('theme') === 'dark' ? 'dark' : 'light';
let lessMotion = params.get('motion') === 'less';
setPersonalLanguage(lang);
const systemReduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/* ---------- the synthetic Habitat view under the mode ---------- */
function Shell({x, modeOn, onToggle}: {x: Text; modeOn: boolean; onToggle: () => void}) {
  const row = (name: string, i: number, mark: string, orbit = false) => (
    <a href="#c" key={name} className="fw-row" data-card="S09" onClick={(e) => e.preventDefault()}>
      <span className="fw-mark" data-card="S10" data-mark={mark} aria-hidden="true">{orbit ? <i className="fw-orbit" data-card="S11" /> : null}</span>
      <span className="fw-row-name">{name}</span>
      <span className="fw-row-ws">{x.wsRows[i]}</span>
    </a>
  );
  return (
    <div className="fw-shell">
      <nav className="fw-rail" aria-label="Habitat">
        <div className="fw-server">
          <button type="button" className="fw-plain fw-server-name" data-card="S01">{x.server}</button>
          <span className="fw-status" data-card="S02" aria-label="●" />
        </div>
        <button type="button" className="fw-nav" data-card="S03"><Icon name="home" aria-hidden="true" />{x.home}</button>
        <button type="button" className="fw-nav fw-search" data-card="S34"><Icon name="search" aria-hidden="true" />{x.search}</button>
        <section className="fw-sec" data-card="S05"><h3>{x.yours}</h3>{row(x.rows[0], 0, 'waiting')}{row(x.rows[2], 1, 'waiting')}</section>
        <section className="fw-sec" data-card="S06"><h3>{x.running}</h3>{row(x.rows[1], 2, 'running', true)}</section>
        <button type="button" className="fw-nav fw-fold" data-card="S07">› {x.quiet}</button>
        <section className="fw-sec" data-card="S14">
          <h3>{x.workspaces}</h3>
          <input className="fw-filter" data-card="S16" placeholder={x.filter} aria-label={x.filter} />
          {x.wsRows.map((w, i) => (
            <a href="#w" key={w} className="fw-ws" data-card="S18" onClick={(e) => e.preventDefault()}><i className="fw-ws-icon" data-glyph={i}>{w.slice(0, 1).toUpperCase()}</i><code>{w}</code></a>
          ))}
          <button type="button" className="fw-nav" data-card="S15"><Icon name="plus" aria-hidden="true" />{x.newWorkspace}</button>
        </section>
        <button type="button" className="fw-account" data-card="S21"><i>{x.account.slice(0, 1)}</i>{x.account}</button>
      </nav>
      <div className="fw-conv">
        <header className="fw-head">
          <span className="fw-title">
            <button type="button" className="fw-plain" data-card="Y01">{x.convTitle}</button>
            <button type="button" className="fw-plain fw-wsname" data-card="Y02"><code>{x.workspace}</code></button>
          </span>
          <span className="fw-state" data-card="Y03"><i data-dot="waiting" />{x.stateText}</span>
          <button type="button" className="fw-chip" data-card="Y04"><Icon name="branch" aria-hidden="true" /><code>main</code> ↑2</button>
          <button type="button" className="fw-ring" data-card="Y05" aria-label="38 %"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><circle cx="10" cy="10" r="7.5" className="fw-ring-fill" pathLength="100" strokeDasharray="38 100" /></svg>38 %</button>
          <button type="button" className="fw-chip" data-card="Y06">{x.model}</button>
          <button type="button" className="fw-icon" data-card="Y07" aria-label="Editor"><Icon name="editor" aria-hidden="true" /></button>
          <button type="button" className="fw-icon" data-card="Y08" aria-label="Terminal"><Icon name="terminal" aria-hidden="true" /></button>
          <button type="button" className="fw-icon ah-explain-toggle" data-card="X05" data-testid="explain-toggle" aria-pressed={modeOn} onClick={onToggle}><span className="ah-explain-q" aria-hidden="true">?</span></button>
          <button type="button" className="fw-icon" data-card="Y14" aria-label="⋯"><Icon name="more" aria-hidden="true" /></button>
        </header>
        <ol className="fw-feed">
          <li className="fw-user"><div data-card="K01">{x.user1}</div><button type="button" className="fw-mini" data-card="K02" aria-label="Copy"><Icon name="copy" aria-hidden="true" /></button></li>
          <li className="fw-agent">
            <button type="button" className="fw-work" data-card="K04">▾ {x.work}</button>
            <ul className="fw-steps">
              <li className="fw-step" data-card="K06"><Icon name="file" aria-hidden="true" /><code>{x.steps[0]}</code></li>
              <li className="fw-step" data-card="K05"><Icon name="run" aria-hidden="true" /><code>{x.steps[1]}</code></li>
              <li className="fw-step fw-failed" data-card="K10"><Icon name="warning" aria-hidden="true" /><code>{x.steps[2]}</code></li>
              <li className="fw-step" data-card="K08"><Icon name="pencil" aria-hidden="true" /><code>{x.steps[3]}</code></li>
              <li className="fw-step" data-card="K05"><Icon name="run" aria-hidden="true" /><code>{x.steps[4]}</code><span className="fw-ok">✓</span></li>
            </ul>
            <div className="fw-answer" data-card="K11">
              <p>{x.answer1}<a href="#f" className="fw-file" data-card="K12" onClick={(e) => e.preventDefault()}>src/login/messages.ts</a>{x.answer2}</p>
              <div className="fw-code"><pre>{x.code}</pre><button type="button" className="fw-mini fw-codecopy" data-card="K15" aria-label="Copy"><Icon name="copy" aria-hidden="true" /></button></div>
              <p>{x.answer3}</p>
            </div>
            <button type="button" className="fw-work" data-card="K30">▸ {x.changes}</button>
          </li>
          <li className="fw-user"><div data-card="K01">{x.user2}</div></li>
          <li className="fw-agent"><div className="fw-answer" data-card="K11"><p>{x.answer4}</p></div></li>
        </ol>
        <div className="fw-bottom">
          <div className="fw-bg" data-card="V09">
            <button type="button" className="fw-chip" data-card="V10"><i className="fw-pdot" />{x.processes}</button>
            <button type="button" className="fw-chip" data-card="V11"><Icon name="bots" aria-hidden="true" />{x.workers}</button>
          </div>
          <div className="fw-composer">
            <div className="fw-field" data-card="V01" tabIndex={0}>{x.placeholder}</div>
            <div className="fw-tools">
              <button type="button" className="fw-icon" data-card="V02" aria-label="📎"><Icon name="paperclip" aria-hidden="true" /></button>
              <button type="button" className="fw-icon" data-card="V05" aria-label="🎤"><Icon name="mic" aria-hidden="true" /></button>
              <span className="fw-tools-end">
                <button type="button" className="fw-chip" data-card="V08">{x.mode}</button>
                <button type="button" className="fw-send" data-card="V06" aria-label="↑"><Icon name="arrowUp" aria-hidden="true" /></button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- hit-testing: round explain-feedback-3's copy of production ---------- */
function opacity(el: Element | null, memo: Map<Element, number>): number {
  if (!el || el === document.documentElement) return 1;
  const known = memo.get(el);
  if (known !== undefined) return known;
  const style = getComputedStyle(el);
  const value = style.visibility === 'hidden' ? 0 : Number(style.opacity) * opacity(el.parentElement, memo);
  memo.set(el, value);
  return value;
}
function visibleRect(el: Element, memo: Map<Element, number>): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width < 3 || r.height < 3 || opacity(el, memo) < 0.15) return null;
  let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const style = getComputedStyle(p);
    if (style.display === 'none') return null;
    if (/(auto|scroll|hidden|clip)/.test(style.overflow)) {
      const q = p.getBoundingClientRect();
      left = Math.max(left, q.left); top = Math.max(top, q.top); right = Math.min(right, q.right); bottom = Math.min(bottom, q.bottom);
    }
  }
  left = Math.max(left, 0); top = Math.max(top, 0); right = Math.min(right, innerWidth); bottom = Math.min(bottom, innerHeight);
  if (right - left < 3 || bottom - top < 3) return null;
  return {x: left, y: top, w: right - left, h: bottom - top};
}
const cardOf = (el: Element) => (el.closest('.fw-stage') ? el.getAttribute('data-card') as CardId | null : null) ?? undefined;
function hit(x: number, y: number): Target | 'own' | null {
  const memo = new Map<Element, number>();
  // The card never takes the pointer unless pinned, so elementsFromPoint
  // does not see it: moving onto the card is moving onto what is under it.
  const top = document.elementsFromPoint(x, y).find((n) => opacity(n, memo) >= 0.15);
  if (!top) return null;
  if (top.closest('.ah-explain-ui, .ah-explain-bar, .rq-bar, .proto-picker')) return 'own';
  let best: Target | null = null;
  for (let n: Element | null = top; n && n !== document.body; n = n.parentElement) {
    const id = cardOf(n);
    if (!id) continue;
    const rect = visibleRect(n, memo);
    if (!rect || x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h) continue;
    if (!best || rect.w * rect.h < best.rect.w * best.rect.h) best = {id, el: n, rect};
  }
  return best;
}
const isTyping = (el: Element | null) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio'].includes(el.type));
const barBottom = () => Math.max(0, document.querySelector('.ah-explain-bar')?.getBoundingClientRect().bottom ?? 0);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const inside = (p: Point, r: Rect, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const distance = (p: Point, r: Rect) => Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h));

/** How near the pointer may come before B's card slides away. */
const KEEP_AWAY = 36;
/** How near the pointer may come before C's panel changes corner. */
const CORNER_AWAY = 40;

/* ---------- the mode ---------- */
type ModeProps = {dir: number; x: Text; l: Lang; reduce: boolean; say: (s: string) => void; onEnd: () => void};
function Mode({dir, x, l, reduce, say, onEnd}: ModeProps) {
  const t = explainModeText[l];
  const f = t.feedback;
  const [target, setTarget] = useState<Target | null>(null);
  const [src, setSrc] = useState<Src>('pointer');
  const [linger, setLinger] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [note, setNote] = useState('');
  const [need, setNeed] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [done, setDone] = useState(false);
  const [touch, setTouch] = useState(() => window.matchMedia?.('(hover: none)').matches ?? false);
  const [, setTick] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string>(undefined);
  const pointer = useRef<Point | null>(null);
  /** Where the pointer entered the shown part (B anchors the card there). */
  const entry = useRef<Point | null>(null);
  /** The card's current side or corner, kept unless it has to change. */
  const side = useRef('');
  /** The card's box when a report was sent: the sent card is smaller, and
   * the pointer resting where the note was must not let it go at once. */
  const sentBox = useRef<Rect | null>(null);
  const live = useRef({target, src, linger, pinned, note, done, touch, shown: null as Target | null});
  live.current = {...live.current, target, src, linger, pinned, note, done, touch};

  useLayoutEffect(() => {
    const selector = focusNext.current;
    if (!selector) return;
    focusNext.current = undefined;
    card.current?.querySelector<HTMLElement>(selector)?.focus({preventScroll: true});
  });
  useEffect(() => {
    if (!nudge) return;
    const id = setTimeout(() => setNudge(false), 2400);
    return () => clearTimeout(id);
  }, [nudge]);

  /** Positions the card for this direction. `moved` is true when the shown
   * part changed (or the card's size did), false for a pointer move within
   * the same part. */
  const place = useCallback((moved: boolean) => {
    const el = card.current;
    const s = live.current;
    const shown = s.shown;
    if (!el || !shown) return;
    const w = el.offsetWidth, h = el.offsetHeight, vw = innerWidth, vh = innerHeight;
    const top = barBottom() + 8;
    const clampX = (v: number) => Math.min(Math.max(8, v), vw - w - 8);
    const clampY = (v: number) => Math.min(Math.max(top, v), vh - h - 8);
    const r = shown.rect;
    const p = s.src === 'pointer' ? pointer.current : null;
    const now = el.getBoundingClientRect();
    let px: number, py: number;
    let instant = false;
    if (s.touch) {
      // Touch: no pointer to follow; a sheet at the bottom edge.
      // The review picker is not part of the product: the sheet sits above it.
      const picker = document.querySelector('.proto-picker')?.getBoundingClientRect();
      px = 8; py = Math.max(top, (picker ? picker.top : vh) - h - 8); side.current = 'sheet';
    } else if (s.pinned) {
      // Pinned: where it was, kept on screen as the report grows.
      px = clampX(now.left); py = clampY(now.top); instant = true;
    } else if (dir === 0) {
      // A: beside the pointer, below right; flips at the edges and flips
      // back only with room to spare, so it does not flicker along an edge.
      const at = p ?? {x: r.x + Math.min(r.w, 24), y: r.y + r.h - 14};
      const gx = 18, gy = p ? 22 : 22;
      let [hs, vs] = side.current.length === 2 ? side.current.split('') : ['R', 'D'];
      if (hs === 'R' && at.x + gx + w > vw - 8) hs = 'L';
      else if (hs === 'L' && at.x + gx + w < vw - 48) hs = 'R';
      if (vs === 'D' && at.y + gy + h > vh - 8) vs = 'U';
      else if (vs === 'U' && at.y + gy + h < vh - 48) vs = 'D';
      const nx = clampX(hs === 'R' ? at.x + gx : at.x - gx - w);
      const ny = clampY(vs === 'D' ? at.y + gy : at.y - 14 - h);
      // Less motion: the card does not trail the pointer. It is placed
      // beside the pointer when the part changes, and moves within a part
      // only if the pointer would otherwise go under it.
      if (reduce && !moved && el.dataset.placed && !inside(at, {x: now.left, y: now.top, w: now.width, h: now.height}, 12)) return;
      side.current = hs + vs; px = nx; py = ny;
    } else if (dir === 1) {
      // B: beside the part; slides to another side when the pointer comes
      // within KEEP_AWAY of the card.
      const e = entry.current ?? {x: r.x + r.w / 2, y: r.y + r.h / 2};
      const gap = 10;
      const cands: [string, number, number, number][] = [
        ['below', e.x - w / 2, r.y + r.h + gap, 0],
        ['above', e.x - w / 2, r.y - h - gap, 6],
        ['right', r.x + r.w + gap, r.y, 12],
        ['left', r.x - w - gap, r.y, 14],
        // A part bigger than the room around it: beside where the pointer
        // entered it, inside the part.
        ['in-right', e.x + 28, e.y - h / 2, 40],
        ['in-left', e.x - 28 - w, e.y - h / 2, 40],
      ];
      let best = {name: '', x: 0, y: 0, score: Infinity};
      for (const [name, cx0, cy0, pref] of cands) {
        const cx = clampX(cx0), cy = clampY(cy0);
        const box = {x: cx, y: cy, w, h};
        let score = pref + (overlap(box, r) / (w * h)) * 400;
        if (p) {
          // Inside its part the pointer is where the person is looking: the
          // card only must not be under it. Outside the part the pointer is
          // on its way somewhere, and the card keeps its distance.
          const inPart = inside(p, r);
          if (inside(p, box, inPart ? 12 : KEEP_AWAY)) score += 5000;
          if (!inPart) score += Math.max(0, 140 - distance(p, box));
        }
        if (name === side.current && !moved) score -= 20;
        if (score < best.score) best = {name, x: cx, y: cy, score};
      }
      side.current = best.name; px = best.x; py = best.y;
      // A new part: the card appears there at once; only the sidestep
      // within one part slides.
      instant = moved;
    } else {
      // C: a corner panel; changes corner when the pointer (or a focused
      // part) comes near it.
      const m = 16;
      const corner = (c: string): Rect => ({x: c === 'L' ? m : vw - w - m, y: vh - h - m, w, h});
      let c = side.current === 'L' ? 'L' : 'R';
      const near = (k: string) => (p ? inside(p, corner(k), CORNER_AWAY) : overlap(corner(k), r) > 0);
      if (near(c) && !near(c === 'R' ? 'L' : 'R')) c = c === 'R' ? 'L' : 'R';
      side.current = c; px = corner(c).x; py = corner(c).y;
    }
    if (instant || !el.dataset.placed) {
      el.style.transition = 'none';
      el.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
      void el.offsetWidth;
      el.style.transition = '';
    } else el.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
    el.dataset.placed = '1';
    el.dataset.placement = side.current;
  }, [dir, reduce]);

  const pointAt = useCallback((found: Target, how: Src) => {
    setTarget(found);
    setSrc(how);
    setLinger(false);
    setNote('');
    setNeed(false);
    setDone(false);
  }, []);
  const release = useCallback(() => {
    setPinned(false);
    setNote('');
    setNeed(false);
    setNudge(false);
    setDone(false);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && card.current?.contains(focused)) focused.blur();
  }, []);
  const pin = useCallback(() => {
    setPinned(true);
    setDone(false);
    focusNext.current = 'textarea';
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let frame = 0;
    const move = () => {
      frame = 0;
      const at = pointer.current;
      const s = live.current;
      if (!at) return;
      if (s.pinned) {
        // A sent report lets go once the pointer leaves its card.
        const box = card.current?.getBoundingClientRect();
        const held = sentBox.current;
        if (s.done && box && !inside(at, {x: box.left, y: box.top, w: box.width, h: box.height}, 24) && !(held && inside(at, held, 8))) release();
        return;
      }
      const found = hit(at.x, at.y);
      if (found === 'own' || !found) {
        if (s.target && !s.linger) setLinger(true);
        place(false);
        return;
      }
      if (s.target?.el !== found.el || s.src !== 'pointer') {
        entry.current = {...at};
        pointAt(found, 'pointer');
      } else {
        if (s.linger) setLinger(false);
        place(false);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (live.current.touch) setTouch(false);
      pointer.current = {x: e.clientX, y: e.clientY};
      if (!frame) frame = requestAnimationFrame(move);
    };
    let gesture: {apply?: () => void} | null = null;
    const block = (e: Event) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
    const onDown = (e: PointerEvent) => {
      gesture = null;
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('.rq-bar, .proto-picker, .ah-explain-ui, .ah-explain-bar')) return;
      const touchPress = e.pointerType === 'touch';
      setTouch(touchPress);
      const s = live.current;
      if (s.pinned) {
        // A press outside an open report never loses what was typed.
        if (!s.done && s.note.trim()) { block(e); gesture = {}; setNudge(true); return; }
        release();
      }
      const found = hit(e.clientX, e.clientY);
      if (!found || found === 'own') return;
      if (touchPress && s.target?.el !== found.el) {
        block(e);
        gesture = {apply: () => { entry.current = null; pointAt(found, 'touch'); }};
        return;
      }
      if (found.id === 'X05') return;
      // The press acts as it always does; a click never opens the report.
      block(e);
      gesture = {apply: () => {
        if (waiting.has(found.id)) { say(t.card.waited); return; }
        const tryText = (t.cards[found.id] as CardText).try;
        say(tryText ? x.pressed(lower(tryText)) : x.pressedPlain);
      }};
    };
    const onUp = (e: PointerEvent) => { if (!gesture) return; block(e); gesture.apply?.(); gesture.apply = undefined; };
    const swallow = (e: Event) => { if (gesture) block(e); };
    const onClick = (e: MouseEvent) => { if (!gesture) return; block(e); gesture = null; };
    const onKey = (e: KeyboardEvent) => {
      const focused = document.activeElement;
      // The review bar's selects keep their own keys.
      if (focused instanceof HTMLSelectElement) return;
      const s = live.current;
      if (e.key === 'Escape') {
        block(e);
        // The first Esc unpins (and drops an unsent report), the second
        // ends the mode.
        if (s.pinned) { release(); return; }
        onEnd();
        return;
      }
      // F pins the card and opens the report field. event.code, so it is the
      // same key on every layout; in a text field F is typing.
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey && s.shown && !isTyping(focused) && !(focused instanceof HTMLElement && focused.isContentEditable)) {
        block(e);
        if (s.pinned && !s.done) { card.current?.querySelector<HTMLElement>('textarea')?.focus({preventScroll: true}); return; }
        pin();
      }
    };
    // Keyboard: a part focused from the keyboard explains itself.
    const onFocus = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof Element) || card.current?.contains(el) || el.closest('.rq-bar, .proto-picker, .ah-explain-bar')) return;
      const s = live.current;
      if (s.pinned) {
        if (!s.done && s.note.trim()) return;
        release();
      }
      let keyboard = false;
      try { keyboard = el.matches(':focus-visible'); } catch { keyboard = false; }
      const id = keyboard ? cardOf(el) : undefined;
      if (!id) return;
      const rect = visibleRect(el, new Map());
      if (!rect) return;
      pointer.current = null;
      entry.current = null;
      pointAt({id, el, rect}, 'keyboard');
    };
    const remeasure = () => setTick((n) => n + 1);
    const onLeave = () => { if (live.current.target && !live.current.pinned) setLinger(true); };
    window.addEventListener('pointermove', onMove, {passive: true});
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('mousedown', swallow, true);
    window.addEventListener('mouseup', swallow, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('focusin', onFocus);
    window.addEventListener('scroll', remeasure, true);
    window.addEventListener('resize', remeasure);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('mousedown', swallow, true);
      window.removeEventListener('mouseup', swallow, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('focusin', onFocus);
      window.removeEventListener('scroll', remeasure, true);
      window.removeEventListener('resize', remeasure);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [place, pointAt, release, pin, say, t, x, onEnd]);

  // Re-measure on every render: the part may have scrolled.
  let shown: Target | null = null;
  if (target) {
    const rect = target.el.isConnected ? visibleRect(target.el, new Map()) : null;
    shown = rect ? {...target, rect} : null;
  }
  live.current.shown = shown;
  useLayoutEffect(() => {
    if (target && !shown && !pinned) setTarget(null);
  });
  // Placed after every render: a new part, a new size, a pinned report.
  const placedFor = useRef<string>('');
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || !shown) { placedFor.current = ''; return; }
    const key = `${shown.id}|${src}|${pinned}|${done}|${l}`;
    place(key !== placedFor.current);
    placedFor.current = key;
  });

  const offset = barBottom();
  const hole = (r: Rect, className = 'ah-explain-hole') => (
    <i className={className} style={{left: r.x - 3, top: r.y - 3 - offset, width: r.w + 6, height: r.h + 6}} />
  );

  let body: ReactNode = null;
  let dim: ReactNode = <i className="ah-explain-veil" />;
  if (shown) {
    const part = parts[shown.id];
    const text = t.cards[shown.id] as CardText;
    const waits = waiting.has(shown.id);
    let foot: ReactNode = null;
    if (waits) foot = <p className="ah-explain-wait">{t.card.waits}</p>;
    else if (text.try || part.opens) foot = <p className="ah-explain-foot">{text.try ? t.card.clickHint(lower(text.try)) : t.card.clickOpens}</p>;
    dim = (
      <>
        {hole(shown.rect, `ah-explain-hole${linger ? ' ah-explain-linger' : ''}`)}
        {dir === 2 && !touch ? <i className="fw-marker" data-testid="explain-marker" style={{left: shown.rect.x + shown.rect.w - 7, top: shown.rect.y - 7 - offset}}>?</i> : null}
      </>
    );
    let report: ReactNode;
    if (done) {
      report = (
        <div className="ah-explain-done" data-testid="explain-feedback-done" tabIndex={-1}>
          <p><Icon name="check" aria-hidden="true" />{f.done}</p>
          <p className="ah-explain-meta">{x.sentProto}</p>
        </div>
      );
    } else if (pinned) {
      const empty = !note.trim();
      report = (
        <div className="ah-explain-report-note" data-testid="explain-feedback">
          <label htmlFor="fw-note">{f.label}</label>
          <textarea id="fw-note" data-testid="explain-feedback-text" required aria-invalid={need && empty ? true : undefined} placeholder={f.placeholder} value={note} rows={3} maxLength={600}
            onChange={(e) => { setNote(e.target.value); if (e.target.value.trim()) setNeed(false); }} />
          {need && empty ? <p className="ah-explain-nudge" role="alert" data-testid="explain-feedback-need">{f.needText}</p> : null}
          <div className="ah-explain-report-row">
            <button type="button" className="ah-explain-send" data-testid="explain-feedback-send" data-empty={empty || undefined}
              onClick={() => {
                if (empty) { setNeed(true); card.current?.querySelector<HTMLElement>('textarea')?.focus({preventScroll: true}); return; }
                const b = card.current?.getBoundingClientRect();
                sentBox.current = b ? {x: b.left, y: b.top, w: b.width, h: b.height} : null;
                setDone(true); setNote('');
                focusNext.current = '[data-testid="explain-feedback-done"]';
              }}>
              <Icon name="github" aria-hidden="true" />{f.send}<Icon name="external" aria-hidden="true" />
            </button>
            <button type="button" className="fw-cancel" data-testid="explain-feedback-cancel" onClick={release}>{f.cancel} <kbd>Esc</kbd></button>
          </div>
          {nudge ? <p className="ah-explain-nudge" role="status" data-testid="explain-feedback-nudge">{f.finishFirst}</p> : null}
          <p className="ah-explain-meta">{f.facts}</p>
        </div>
      );
    } else if (touch) {
      // No F on a touch screen: the report is a button on the sheet.
      report = (
        <button type="button" className="ah-explain-report" data-testid="explain-report" onClick={pin}>
          <Icon name="warning" aria-hidden="true" />
          <span className="ah-explain-report-label"><b>{f.report}</b><small>{f.reportSub}</small></span>
        </button>
      );
    } else {
      // The card never takes the pointer, so the report is not a button:
      // F is the one way in.
      report = (
        <div className="ah-explain-report fw-report-key" data-testid="explain-report-key">
          <Icon name="warning" aria-hidden="true" />
          <span className="ah-explain-report-label"><b>{f.report}</b><small>{x.reportKey}</small></span>
          <kbd>F</kbd>
        </div>
      );
    }
    body = (
      <div ref={card}
        className={`ah-explain-ui ah-explain-card fw-card fw-dir-${dir}${linger ? ' ah-explain-linger' : ''}`}
        data-testid="explain-card" data-card={shown.id} data-src={src}
        data-touch={touch || undefined} data-pinned={pinned || undefined} data-held={done || undefined}
        data-nudge={nudge || undefined} data-reduce={reduce || undefined} aria-live="polite">
        <div className="ah-explain-top">
          {dir === 2 && !touch ? <i className="fw-marker fw-marker-inline" aria-hidden="true">?</i> : null}
          <span className="ah-explain-kind">{t.kinds[part.kind]}</span>
          {part.key ? <kbd>{part.key}</kbd> : null}
          {pinned ? <span className="fw-pinned" data-testid="explain-pinned">{x.pinned} · <kbd>Esc</kbd></span> : null}
          {touch ? (
            <button type="button" className="ah-explain-x fw-x" data-testid="explain-close" aria-label={t.card.close}
              onClick={() => { release(); setTarget(null); }}><span aria-hidden="true">×</span></button>
          ) : null}
        </div>
        <h2>{text.name}</h2>
        <p>{text.lead}</p>
        {text.know ? <p className="ah-explain-know">{text.know}</p> : null}
        {!touch && text.keyboard ? <p className="ah-explain-know">{text.keyboard}</p> : null}
        {foot}
        <div className="ah-explain-feedback">{report}</div>
      </div>
    );
  }

  return (
    <>
      <div className="ah-explain-bar" data-testid="explain-bar">
        <b>{t.bar.title}</b>
        <span className="ah-explain-hint">{touch ? t.bar.hintTouch : pinned ? x.barHintPinned : x.barHint}</span>
        <button type="button" className="ah-explain-stop" data-testid="explain-stop" data-explain-own="" onClick={onEnd}>{t.bar.stop} <kbd>Esc</kbd></button>
      </div>
      {createPortal(
        <>
          <div className="ah-explain-ui ah-explain-layer" style={{top: offset}} aria-hidden="true">{dim}</div>
          {body}
        </>,
        document.body,
      )}
    </>
  );
}

/* ---------- the review page ---------- */
function App({direction}: {direction: number}) {
  const [th, setTh] = useState(theme);
  const [language, setLanguage] = useState<Lang>(lang);
  const [less, setLess] = useState(lessMotion);
  const [on, setOn] = useState(true);
  const [gen, setGen] = useState(0);
  const [toast, setToast] = useState('');
  const x = TEXT[language];
  const reduce = less || systemReduce();
  useEffect(() => { document.documentElement.dataset.theme = th; document.documentElement.style.colorScheme = th; }, [th]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    if (on) document.documentElement.setAttribute('data-explain-mode', '');
    else document.documentElement.removeAttribute('data-explain-mode');
  }, [on]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3600); return () => clearTimeout(id); }, [toast]);
  const end = useCallback(() => { setOn(false); setToast(TEXT[lang].ended); }, []);
  const reset = () => { setOn(true); setToast(''); setGen((n) => n + 1); };
  return (
    <div className="rq-review fw-review" data-direction={direction}>
      <header className="rq-bar">
        <div className="rq-controls">
          <strong>{x.title}</strong>
          <label>{x.theme} <select id="theme" value={th} onChange={(e) => { theme = e.target.value; setTh(theme); }}>
            <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
          <label>{x.language} <select id="language" value={language} onChange={(e) => { lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); setGen((n) => n + 1); }}>
            <option value="fi">Suomi</option><option value="en">English</option></select></label>
          <label>{x.motion} <select id="motion" value={less ? 'less' : 'system'} onChange={(e) => { lessMotion = e.target.value === 'less'; setLess(lessMotion); setGen((n) => n + 1); }}>
            <option value="system">{x.motionSystem}</option><option value="less">{x.motionLess}</option></select></label>
          <button type="button" data-testid="rq-reset" onClick={reset}>{x.reset}</button>
        </div>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((line, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{line}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <main className="rq-main fw-main">
        {on ? <Mode key={`${gen}-${direction}`} dir={direction} x={x} l={language} reduce={reduce} say={setToast} onEnd={end} /> : null}
        <div className="fw-stage">
          <Shell x={x} modeOn={on} onToggle={() => (on ? end() : reset())} />
        </div>
      </main>
      {toast ? <div className="ah-explain-toast fw-toast" role="status" data-testid="rq-toast">{toast}</div> : null}
    </div>
  );
}

const reactRoot = createRoot(document.getElementById('root')!);
document.documentElement.dataset.theme = theme;
const stageSink = {set innerHTML(node: ReactNode) { flushSync(() => reactRoot.render(node === '' ? null : node)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
