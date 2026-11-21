// Explain mode feedback, round 3 (issue explain-mode-feedback). Round 2
// chose A Path for holding the card. Jari then dropped positive feedback and
// merged "Wrong" with the note: one "Report a mistake" path where writing is
// required. One axis: how the written report reaches the developers.
//
// The pointing is round 2's faithful copy of production's ExplainLayer
// (web/src/components/ExplainMode.tsx) with A's path kept in every direction:
// pointer moves batched per frame, hit() over elementsFromPoint, the smallest
// visible part, the card below the part at the pointer's x (above when there
// is no room), lingering over empty space, a card that lets the pointer
// through unless the pointer travels from its own part, a touch tap that
// explains first, presses that wait, Esc that stops. `?path=off` turns the
// path off, which is production, for the check's negative control.
import React, {type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/ExplainMode.css';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {parts, waiting, type CardId as RealCardId} from '../../../../web/src/components/explainParts';
import {explainModeText} from '../../../../web/src/text/explainMode';
import {type Lang, NAMES, NOTE_MAX, REPO, ROUTES, type Route, TEXT, type Text, type View} from './text';
import './round.css';

type CardId = Extract<RealCardId, 'X05' | 'Y01' | 'Y02' | 'Y03' | 'Y04' | 'Y05' | 'Y06' | 'V01' | 'V02' | 'V06' | 'V08' | 'V09'>;
type Report = {key: number; id: CardId; note: string; ago: 'now' | 'd1' | 'd3'; sent?: boolean};
type Rect = {x: number; y: number; w: number; h: number};
type Target = {id: CardId; el: Element; rect: Rect};
type Scenario = 'card' | 'note' | 'done';
const SCENARIOS: Scenario[] = ['card', 'note', 'done'];

const params = new URLSearchParams(location.search);
let lang: Lang = params.get('lang') === 'en' ? 'en' : 'fi';
let view: View = params.get('view') === 'mine' ? 'mine' : 'mode';
let scenario: Scenario = SCENARIOS.includes(params.get('s') as Scenario) ? params.get('s') as Scenario : 'card';
let theme = ['dark', 'contrast'].includes(params.get('theme') ?? '') ? params.get('theme')! : 'light';
const pathOn = params.get('path') !== 'off';
setPersonalLanguage(lang);

const cardText = (l: Lang, id: CardId) => explainModeText[l].cards[id] as {name: string; lead: string; know?: string; try?: string; grey?: string};
let reportKey = 10;
/** B's account already holds one unsent report from yesterday and one sent. */
const seed = (l: Lang): Report[] => [
  {key: 1, id: 'V02', note: l === 'fi' ? 'Puhelimella tiedostoja ei voi vetää kenttään, vaikka kortti niin sanoo.' : 'On a phone you cannot drag files into the field, though the card says so.', ago: 'd1'},
  {key: 2, id: 'X05', note: l === 'fi' ? 'Ei kerro, miten tilan saa pois näppäimistöllä.' : 'Does not say how to stop the mode from the keyboard.', ago: 'd3', sent: true},
];
const NOTE: Record<Lang, string> = {
  fi: 'Ei kerro, mitä tapahtuu, kun konteksti täyttyy: tiivistyykö keskustelu itsestään?',
  en: 'It does not say what happens when the context fills up: is the conversation compacted by itself?',
};

/* ---------- the synthetic conversation under the mode ---------- */
function Conversation({x, onToggle, modeOn}: {x: Text; onToggle: () => void; modeOn: boolean}) {
  return (
    <div className="ef-conv">
      <header className="ef-head">
        <span className="ef-title"><button type="button" className="ef-plain" data-card="Y01">{x.convTitle}</button><button type="button" className="ef-plain ef-ws" data-card="Y02"><code>{x.workspace}</code></button></span>
        <button type="button" className="ef-dot" data-card="Y03" aria-label="●"><i /></button>
        <button type="button" className="ef-chip" data-card="Y04"><Icon name="branch" /><code>main</code> ↑1 · 3</button>
        <button type="button" className="ef-ring" data-card="Y05" aria-label="42 %"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><circle cx="10" cy="10" r="7.5" className="ef-ring-fill" pathLength="100" strokeDasharray="42 100" /></svg><span>42 %</span></button>
        <button type="button" className="ef-chip ef-model" data-card="Y06">{x.model}</button>
        <button type="button" className="ef-q ah-explain-toggle" data-card="X05" data-testid="explain-toggle" aria-pressed={modeOn} onClick={onToggle}><span className="ah-explain-q">?</span></button>
      </header>
      <ol className="ef-feed">
        <li className="ef-user">{x.user}</li>
        <li className="ef-agent">{x.agent}</li>
      </ol>
      <div className="ef-bottom">
        <button type="button" className="ef-chip ef-bg" data-card="V09"><i className="ef-bg-dot" />{x.background}</button>
        <div className="ef-composer">
          <div className="ef-field" data-card="V01" data-testid="message-input" tabIndex={0}>{x.placeholder}</div>
          <div className="ef-tools">
            <button type="button" className="ef-tool" data-card="V02" data-testid="attach-file" aria-label="📎"><Icon name="paperclip" /></button>
            <span className="ef-tools-end">
              <button type="button" className="ef-chip ef-modechip" data-card="V08">{x.mode}</button>
              <button type="button" className="ef-send" data-card="V06" aria-label="↑" aria-disabled="true"><Icon name="arrowUp" /></button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- a faithful copy of ExplainLayer's pointing ---------- */
const OWN = '[data-explain-own], .ah-explain-ui';
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
const cardOf = (el: Element) => (el.closest('.ef-stage') ? el.getAttribute('data-card') as CardId | null : null) ?? undefined;
function hit(x: number, y: number): Target | 'own' | null {
  const memo = new Map<Element, number>();
  const top = document.elementsFromPoint(x, y).find((n) => n.closest(OWN) || opacity(n, memo) >= 0.15);
  if (!top) return null;
  if (top.closest('.ah-explain-ui, .ah-explain-bar [data-explain-own], .rq-bar, .proto-picker, .ef-sheet-back')) return 'own';
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
function find(id: CardId, el?: Element): Target | null {
  const memo = new Map<Element, number>();
  if (el?.isConnected) { const rect = visibleRect(el, memo); if (rect) return {id, el, rect}; }
  const all = [...document.querySelectorAll(`.ef-stage [data-card="${id}"]`)].reverse();
  for (const c of all) { const rect = visibleRect(c, memo); if (rect) return {id, el: c, rect}; }
  return null;
}
const isTyping = (el: Element | null) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio'].includes(el.type));
const barBottom = () => Math.max(0, document.querySelector('.ah-explain-bar')?.getBoundingClientRect().bottom ?? 0);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** A: the path from the part to its card, the hull of the part's facing
 * edge and the card's facing edge, plus a few pixels. */
function inPath(px: number, py: number, part: Rect, card: DOMRect): boolean {
  const below = card.top >= part.y + part.h - 1;
  const y0 = below ? part.y + part.h : card.bottom;
  const y1 = below ? card.top : part.y;
  if (py < Math.min(y0, y1) - 4 || py > Math.max(y0, y1) + 4) return false;
  const t = y1 === y0 ? 0 : Math.min(1, Math.max(0, (py - y0) / (y1 - y0)));
  const [a0, a1] = below ? [part.x, part.x + part.w] : [card.left, card.right];
  const [b0, b1] = below ? [card.left, card.right] : [part.x, part.x + part.w];
  return px >= a0 + (b0 - a0) * t - 4 && px <= a1 + (b1 - a1) * t + 4;
}

/* ---------- the text that leaves ---------- */
function issueOf(x: Text, l: Lang, items: Report[]) {
  const one = items.length === 1;
  const title = one ? x.issueOne(cardText(l, items[0].id).name, items[0].id) : x.issueMany(items.length);
  const body = one
    ? [items[0].note, '', x.cardLine(cardText(l, items[0].id).name, items[0].id), x.issueVersion].join('\n')
    : [...items.flatMap((f) => [`### ${cardText(l, f.id).name} (${f.id})`, f.note, '']), x.issueVersion].join('\n');
  const url = `https://github.com/${REPO}/issues/new?${new URLSearchParams({title, body, labels: 'explain-feedback'})}`;
  return {title, body, url};
}

const ICON: Record<Route, 'github' | 'lock' | 'mail'> = {github: 'github', batch: 'lock', inbox: 'mail'};

/* ---------- the mode ---------- */
type ModeProps = {
  dir: number; x: Text; l: Lang; s: Scenario; paused: boolean;
  saved: Report[]; add: (r: {id: CardId; note: string}, sent: boolean) => void;
  say: (t: string) => void; openSend: () => void; openMine: () => void;
};

function Mode({dir, x, l, s, paused, saved, add, say, openSend, openMine}: ModeProps) {
  const t = explainModeText[l];
  const route = ROUTES[dir];
  const [on, setOn] = useState(true);
  const [target, setTarget] = useState<{id: CardId; el?: Element} | null>({id: 'Y05'});
  const [linger, setLinger] = useState(false);
  const [pointer, setPointer] = useState<number>();
  const [touch, setTouch] = useState(() => matchMedia('(hover: none)').matches);
  const [open, setOpen] = useState(s === 'note');
  const [note, setNote] = useState(s === 'note' ? NOTE[l] : '');
  const [what, setWhat] = useState(false);
  const [need, setNeed] = useState(false);
  const [done, setDone] = useState<CardId | null>(s === 'done' ? 'Y05' : null);
  const [nudge, setNudge] = useState(false);
  const [, setTick] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const keyOpen = useRef(false);
  const pinned = open || keyOpen.current;
  const live = useRef({target, pinned, touch, note, paused});
  live.current = {target, pinned, touch, note, paused};

  const pointAt = useCallback((found: {id: CardId; el: Element}) => {
    setTarget(found); setLinger(false); setDone(null);
    setOpen(false); setNote(''); setWhat(false); setNeed(false); keyOpen.current = false;
  }, []);
  const cancel = useCallback(() => { setOpen(false); setNote(''); setWhat(false); setNeed(false); keyOpen.current = false; setNudge(false); (document.activeElement as HTMLElement | null)?.blur?.(); }, []);
  const stop = useCallback(() => { setOn(false); setTarget(null); cancel(); }, [cancel]);
  useEffect(() => { if (!nudge) return; const id = setTimeout(() => setNudge(false), 2400); return () => clearTimeout(id); }, [nudge]);

  useEffect(() => {
    if (!on) return;
    let frame = 0;
    let at: {x: number; y: number} | null = null;
    const armed = (v: boolean) => card.current?.toggleAttribute('data-armed', v);
    const move = () => {
      frame = 0;
      if (!at || live.current.paused) return;
      const cur = live.current.target;
      const found = hit(at.x, at.y);
      if (live.current.pinned || found === 'own') {
        // On the card (or held): a part passed on the way does not take it.
        if (found === 'own') setLinger(false);
        return;
      }
      const cardBox = card.current?.getBoundingClientRect();
      const shownNow = cur ? find(cur.id, cur.el) : null;
      // A Path: travelling from the part onto its card keeps the card.
      if (pathOn && shownNow && cardBox && found?.el !== shownNow.el && inPath(at.x, at.y, shownNow.rect, cardBox)) {
        armed(true); setLinger(false); return;
      }
      armed(pathOn && !!found && found.el === shownNow?.el);
      if (found) {
        if (cur?.el !== found.el) pointAt(found);
        else setLinger(false);
        setPointer(at.x);
      } else if (cur) setLinger(true);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      setTouch(false);
      at = {x: e.clientX, y: e.clientY};
      if (!frame) frame = requestAnimationFrame(move);
    };
    let gesture: {block: boolean; apply?: () => void} | null = null;
    const block = (e: Event) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
    const onDown = (e: PointerEvent) => {
      gesture = null;
      if (live.current.paused) return;
      const touchPress = e.pointerType === 'touch';
      setTouch(touchPress);
      if (!(e.target instanceof Element) || e.target.closest(OWN) || e.target.closest('.rq-bar, .proto-picker')) return;
      // A press outside an open report: what was typed is never lost.
      if (live.current.pinned) {
        if (live.current.note.trim()) { block(e); gesture = {block: true}; setNudge(true); return; }
        cancel();
      }
      const found = hit(e.clientX, e.clientY);
      if (!found || found === 'own') return;
      if (touchPress && live.current.target?.el !== found.el) gesture = {block: true, apply: () => pointAt(found)};
      else if (waiting.has(found.id)) gesture = {block: true, apply: () => say(t.card.waited)};
      if (gesture?.block) block(e);
    };
    const onUp = (e: PointerEvent) => { if (!gesture?.block) return; block(e); gesture.apply?.(); gesture.apply = undefined; };
    const swallow = (e: Event) => { if (gesture?.block) block(e); };
    const onClick = (e: MouseEvent) => { if (!gesture?.block) return; block(e); gesture = null; };
    const onKey = (e: KeyboardEvent) => {
      if (live.current.paused) return;
      const focused = document.activeElement;
      if (e.key === 'Escape') {
        block(e);
        if (live.current.pinned || card.current?.contains(focused)) { cancel(); return; }
        stop();
        return;
      }
      // F reports a mistake in the card that is showing.
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(focused) && live.current.target) {
        block(e);
        keyOpen.current = true;
        setTick((n) => n + 1);
        requestAnimationFrame(() => card.current?.querySelector<HTMLElement>('.ef-report, .ef-link')?.focus());
      }
    };
    // Keyboard: a focused part explains itself, as a pointed one does.
    const onFocus = (e: FocusEvent) => {
      if (live.current.pinned || live.current.paused || !(e.target instanceof Element)) return;
      const id = cardOf(e.target);
      if (id && live.current.target?.el !== e.target) { pointAt({id, el: e.target}); setPointer(undefined); }
    };
    const remeasure = () => setTick((n) => n + 1);
    addEventListener('pointermove', onMove, {passive: true});
    addEventListener('pointerdown', onDown, true);
    addEventListener('pointerup', onUp, true);
    addEventListener('pointercancel', () => { gesture = null; }, true);
    addEventListener('mousedown', swallow, true);
    addEventListener('mouseup', swallow, true);
    addEventListener('click', onClick, true);
    addEventListener('keydown', onKey, true);
    addEventListener('focusin', onFocus);
    addEventListener('scroll', remeasure, true);
    addEventListener('resize', remeasure);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown, true);
      removeEventListener('pointerup', onUp, true); removeEventListener('mousedown', swallow, true);
      removeEventListener('mouseup', swallow, true); removeEventListener('click', onClick, true);
      removeEventListener('keydown', onKey, true); removeEventListener('focusin', onFocus);
      removeEventListener('scroll', remeasure, true); removeEventListener('resize', remeasure);
    };
  }, [on, pointAt, cancel, stop, say, t]);

  useLayoutEffect(() => { setTick((n) => n + 1); }, [on]);
  const shown = on && target ? find(target.id, target.el) : null;
  useLayoutEffect(() => {
    if (target && !target.el && shown) setTarget({id: shown.id, el: shown.el});
  });

  // Place the card as production does.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || !shown) return;
    const w = el.offsetWidth, h = el.offsetHeight, vw = innerWidth, vh = innerHeight;
    const top = barBottom() + 8, gap = 10, r = shown.rect;
    const cx = !touch && pointer !== undefined ? pointer : r.x + r.w / 2;
    const x0 = Math.min(Math.max(8, cx - w / 2), vw - w - 8);
    let y0 = r.y + r.h + gap;
    if (y0 + h > vh - 8) y0 = r.y - h - gap;
    if (y0 < top) y0 = Math.min(vh - h - 8, Math.max(top, r.y + r.h + gap));
    // While a report is open the card keeps its place, even as the note grows.
    if (!(pinned && el.dataset.placed === shown.id)) {
      const above = y0 < r.y + r.h;
      el.style.left = `${Math.round(x0)}px`;
      // A card above its part hangs from its bottom edge, so the note grows
      // upwards, away from the part, and stays on screen.
      el.style.top = above ? 'auto' : `${Math.round(Math.max(top, y0))}px`;
      el.style.bottom = above ? `${Math.round(vh - Math.max(top, y0) - h)}px` : 'auto';
      el.dataset.side = above ? 'above' : 'below';
      el.dataset.placed = shown.id;
    }
  });

  const openNote = () => {
    keyOpen.current = false; setOpen(true);
    requestAnimationFrame(() => card.current?.querySelector<HTMLElement>('textarea')?.focus({preventScroll: true}));
  };
  const send = () => {
    if (!shown) return;
    if (!note.trim()) { setNeed(true); card.current?.querySelector<HTMLElement>('textarea')?.focus({preventScroll: true}); return; }
    add({id: shown.id, note: note.trim()}, route !== 'batch');
    if (route === 'github') say(x.openToast);
    if (route === 'inbox') say(x.sendToast);
    setOpen(false); setNote(''); setWhat(false); setNeed(false); keyOpen.current = false;
    setDone(shown.id);
    requestAnimationFrame(() => (card.current?.querySelector<HTMLElement>('[data-testid="fb-send-now"]') ?? card.current?.querySelector<HTMLElement>('[data-testid="fb-done"]'))?.focus({preventScroll: true}));
  };
  const unsent = saved.filter((f) => !f.sent).length;
  const recent = (id: CardId) => saved.some((f) => f.id === id && f.ago === 'now');

  let body: ReactNode = null;
  if (shown) {
    const id = shown.id;
    const c = cardText(l, id);
    const part = parts[id];
    const disabled = shown.el.matches('[aria-disabled="true"]');
    let fb: ReactNode;
    if (done === id) {
      fb = (
        <div className="ef-done" data-testid="fb-done" tabIndex={-1}>
          <p><Icon name="check" aria-hidden="true" />{x.done[route]}
            {route === 'batch' ? <button type="button" className="ef-link" data-testid="fb-send-now" onClick={openSend}>{x.sendNow} ›</button> : null}</p>
          {x.doneMore[route] ? <p className="ef-kept">{x.doneMore[route]}</p> : null}
          {route === 'github' ? <button type="button" className="ef-link" data-testid="fb-copy" onClick={() => say(x.copiedToast)}>{x.copy}</button> : null}
        </div>
      );
    } else if (!open) {
      fb = (
        <>
          <button type="button" className="ef-report" data-route={route} data-testid="fb-report" onClick={openNote}>
            <Icon name="warning" aria-hidden="true" />
            <span><b>{x.report}</b><small>{x.reportSub}</small></span>
            {!touch ? <kbd className="ef-key" title={x.keyHint}>F</kbd> : null}
          </button>
          <p className="ef-dest" data-route={route} data-testid="fb-dest"><Icon name={ICON[route]} aria-hidden="true" />{x.dest[route]}</p>
          {recent(id) ? <p className="ef-kept" data-testid="fb-recent">{x.reported}</p> : null}
        </>
      );
    } else {
      const preview = issueOf(x, l, [{key: 0, id, note: note.trim() || '…', ago: 'now'}]);
      fb = (
        <div className="ef-note" data-testid="fb-note">
          <label className="ef-note-label" htmlFor="ef-note-text"><Icon name="warning" aria-hidden="true" />{x.noteLabel}</label>
          <textarea id="ef-note-text" required aria-required="true" aria-invalid={need && !note.trim() ? true : undefined} aria-describedby="ef-facts"
            placeholder={x.notePlaceholder} value={note} rows={3} maxLength={NOTE_MAX}
            onChange={(e) => { setNote(e.target.value); if (e.target.value.trim()) setNeed(false); }} data-testid="fb-note-text" />
          {need && !note.trim() ? <p className="ef-nudge" role="alert" data-testid="fb-need">{x.needText}</p> : null}
          <div className="ef-note-row">
            <button type="button" className="ef-primary" data-route={route} data-testid="fb-send" aria-disabled={!note.trim() || undefined} onClick={send}>
              <Icon name={ICON[route]} aria-hidden="true" />{x.send[route]}{route === 'github' ? <Icon name="external" aria-hidden="true" /> : null}
            </button>
            <ControlButton size="row" variant="quiet" onPress={cancel} data-testid="fb-cancel">{x.cancel}</ControlButton>
          </div>
          {nudge ? <p className="ef-nudge" role="status" data-testid="fb-nudge">{x.finishFirst}</p> : null}
          <p className="ef-kept" id="ef-facts" data-testid="fb-facts"><Icon name={route === 'batch' ? 'lock' : 'globe'} aria-hidden="true" />{x.facts[route]}</p>
          <button type="button" className="ef-link ef-what-toggle" aria-expanded={what} data-testid="fb-what" onClick={() => setWhat((v) => !v)}>{x.what}</button>
          {what ? (
            <div className="ef-issue ef-issue-small" data-testid="fb-preview">
              <small>{x.whatLead[route]}</small>
              <b>{preview.title}</b>
              <pre>{preview.body}</pre>
            </div>
          ) : null}
        </div>
      );
    }
    const foot = waiting.has(id)
      ? <p className="ah-explain-wait">{t.card.waits}</p>
      : c.try && !disabled
        ? touch
          ? <div className="ah-explain-foot"><ControlButton data-testid="explain-do" size="row" variant="primary" onPress={() => (shown.el as HTMLElement).click()}>{c.try}</ControlButton><span>{t.card.tapAgain}</span></div>
          : <p className="ah-explain-foot">{t.card.clickHint(lower(c.try))}</p>
        : null;
    body = (
      <div ref={card} className={`ah-explain-ui ah-explain-card ef-card${linger ? ' ah-explain-linger' : ''}`} data-testid="explain-card" data-card={id}
        data-route={route} data-touch={touch || undefined} data-pinned={pinned || undefined} data-held={done === id || undefined} data-nudge={nudge || undefined} aria-live="polite">
        <div className="ah-explain-top">
          <span className="ah-explain-kind">{t.kinds[part.kind]}</span>
          {part.key && !touch ? <kbd>{part.key}</kbd> : null}
          {touch ? <ControlButton data-testid="explain-close" size="inline" variant="quiet" className="ah-explain-x" aria-label={t.card.close} onPress={() => { cancel(); setTarget(null); }}><span aria-hidden="true">×</span></ControlButton> : null}
        </div>
        <h2>{c.name}</h2>
        <p>{c.lead}</p>
        {c.know ? <p className="ah-explain-know">{c.know}</p> : null}
        {disabled && c.grey ? <p className="ah-explain-note">{c.grey}</p> : null}
        {foot}
        <div className="ef-fb" data-testid="fb-row">{fb}</div>
      </div>
    );
  }

  const offset = barBottom();
  return (
    <div className="ef-mode" data-on={on || undefined}>
      {on ? (
        <div className="ah-explain-bar ef-xbar" data-testid="explain-bar">
          <b>{t.bar.title}</b>
          <span className="ah-explain-hint">{touch ? t.bar.hintTouch : t.bar.hint}</span>
          {route === 'batch' ? (
            <button type="button" className="ah-explain-now ef-mine-button" data-explain-own="" data-testid="bar-mine" onClick={openMine}>
              <Icon name="lock" aria-hidden="true" /><span>{x.barMine(unsent)}</span>
            </button>
          ) : null}
          <button type="button" className="ah-explain-stop" data-testid="explain-stop" data-explain-own="" onClick={stop}>{t.bar.stop} <kbd>Esc</kbd></button>
        </div>
      ) : null}
      <div className="ef-stage">
        <Conversation x={x} modeOn={on} onToggle={() => (on ? stop() : (setOn(true), setTarget({id: 'Y05'})))} />
      </div>
      {on ? (
        <div className="ah-explain-ui ah-explain-layer" style={{top: offset}} aria-hidden="true">
          {shown ? <i className={`ah-explain-hole${linger ? ' ah-explain-linger' : ''}`} style={{left: shown.rect.x - 3, top: shown.rect.y - 3 - offset, width: shown.rect.w + 6, height: shown.rect.h + 6}} /> : <i className="ah-explain-veil" />}
        </div>
      ) : null}
      {body}
    </div>
  );
}

/* ---------- B: sending what has gathered, as one prefilled issue ---------- */
function SendSheet({x, l, items, onClose, onSent, say}: {x: Text; l: Lang; items: Report[]; onClose: () => void; onSent: () => void; say: (s: string) => void}) {
  const first = useRef<HTMLButtonElement>(null);
  const {title, body, url} = issueOf(x, l, items);
  useEffect(() => {
    first.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    addEventListener('keydown', key, true);
    return () => removeEventListener('keydown', key, true);
  }, [onClose]);
  return (
    <div className="ef-sheet-back" data-testid="send-back">
      <div className="ef-sheet" role="dialog" aria-modal="true" aria-label={x.sheetTitle} data-testid="send-sheet">
        <header><h2>{x.sheetTitle}</h2><ControlButton size="inline" variant="quiet" aria-label={x.close} onPress={onClose}><Icon name="cross" /></ControlButton></header>
        <p className="ef-muted">{x.sheetLead}</p>
        <div className="ef-issue" data-testid="send-preview">
          <b data-testid="send-title">{title}</b>
          <pre>{body}</pre>
        </div>
        <p className="ef-kept"><Icon name="globe" aria-hidden="true" />{x.sheetPublic}</p>
        <div className="ef-note-row">
          <button ref={first} type="button" className="ef-primary" data-testid="send-github" onClick={() => { onSent(); say(x.openToast); }}><Icon name="github" aria-hidden="true" />{x.sheetOpen}<Icon name="external" aria-hidden="true" /></button>
          <ControlButton size="row" variant="secondary" data-testid="send-copy" onPress={() => say(x.copiedToast)}><Icon name="copy" />{x.copy}</ControlButton>
          <ControlButton size="row" variant="quiet" onPress={onClose}>{x.sheetCancel}</ControlButton>
        </div>
        <p className="ef-url"><span>{x.willOpen}</span> <code data-testid="send-url">{url}</code></p>
        <section className="ef-noacc" data-testid="send-noaccount"><b>{x.noAccountTitle}</b> {x.noAccount}</section>
      </div>
    </div>
  );
}

function Mine({x, l, route, saved, remove, openSend}: {x: Text; l: Lang; route: Route; saved: Report[]; remove: (k: number) => void; openSend: () => void}) {
  const unsent = saved.filter((f) => !f.sent);
  if (route !== 'batch') {
    return (
      <div className="ef-where" data-testid="mine-panel">
        <h1>{x.mineTitle}</h1>
        <p className="ef-lead" data-testid="mine-none">{x.mineNone[route]}</p>
        <p className="ef-never-line" data-testid="fb-never"><Icon name="eyeOff" aria-hidden="true" />{x.never}</p>
      </div>
    );
  }
  return (
    <div className="ef-where" data-testid="mine-panel">
      <h1>{x.mineTitle}</h1>
      <p className="ef-lead">{x.mineLead}</p>
      <div className="ef-note-row ef-send-row">
        <button type="button" className="ef-primary" disabled={!unsent.length} onClick={openSend} data-testid="mine-send"><Icon name="github" aria-hidden="true" />{x.sendAll(unsent.length)}</button>
      </div>
      <section className="ef-box">
        {saved.length ? (
          <ul className="ef-mine">
            {saved.map((f) => (
              <li key={f.key} data-testid={`fb-mine-${f.id}`} data-sent={f.sent ? '' : undefined}>
                <span className="ef-mine-main"><b>{cardText(l, f.id).name} <code>{f.id}</code></b><q>{f.note}</q><small>{x.ago[f.ago]}{f.sent ? ` · ${x.sent}` : ''}</small></span>
                <ControlButton size="inline" variant="quiet" aria-label={x.remove} title={x.remove} onPress={() => remove(f.key)}><Icon name="trash" /></ControlButton>
              </li>
            ))}
          </ul>
        ) : <p className="ef-muted">{x.mineEmpty}</p>}
      </section>
      <p className="ef-never-line" data-testid="fb-never"><Icon name="eyeOff" aria-hidden="true" />{x.never}</p>
    </div>
  );
}

/* ---------- the review page ---------- */
function App({direction}: {direction: number}) {
  const route = ROUTES[direction];
  const [th, setTh] = useState(theme);
  const [language, setLanguage] = useState<Lang>(lang);
  const [v, setV] = useState<View>(view);
  const [s, setS] = useState<Scenario>(scenario);
  const [gen, setGen] = useState(0);
  // Only B keeps anything; A and C remember this page's reports only so the
  // card can say "you reported this just now".
  const initial = (l: Lang, sc: Scenario): Report[] => [
    ...(sc === 'done' ? [{key: 3, id: 'Y05' as CardId, note: NOTE[l], ago: 'now' as const, sent: route !== 'batch'}] : []),
    ...(route === 'batch' ? seed(l) : []),
  ];
  const [saved, setSaved] = useState<Report[]>(() => initial(lang, scenario));
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const x = TEXT[language];
  useEffect(() => { document.documentElement.dataset.theme = th; document.documentElement.style.colorScheme = th === 'light' ? 'light' : 'dark'; }, [th]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 4200); return () => clearTimeout(id); }, [toast]);
  const reset = (nl = language, ns = s) => { lang = nl; scenario = ns; setSaved(initial(nl, ns)); setLanguage(nl); setS(ns); setToast(''); setSending(false); setGen((n) => n + 1); };
  const add = (r: {id: CardId; note: string}, sent: boolean) => setSaved((list) => [{...r, key: reportKey++, ago: 'now', sent}, ...list.filter((o) => !(o.id === r.id && o.ago === 'now' && !o.sent))]);
  const unsent = saved.filter((f) => !f.sent);
  const closeSend = useCallback(() => setSending(false), []);
  return (
    <div className="rq-review ef-review" data-direction={direction} data-view={v}>
      <header className="rq-bar">
        <div className="rq-controls">
          <strong>{x.title}</strong>
          <label>{x.view} <select id="view" value={v} onChange={(e) => { view = e.target.value as View; setV(view); }}>
            {(['mode', 'mine'] as View[]).map((id) => <option key={id} value={id}>{x.views[id]}</option>)}</select></label>
          <label>{x.start} <select id="scenario" value={s} onChange={(e) => { setV('mode'); view = 'mode'; reset(language, e.target.value as Scenario); }}>
            {SCENARIOS.map((id) => <option key={id} value={id}>{x.starts[id]}</option>)}</select></label>
          <label>{x.theme} <select id="theme" value={th} onChange={(e) => { theme = e.target.value; setTh(theme); }}>
            <option value="light">{x.light}</option><option value="dark">{x.dark}</option><option value="contrast">{x.contrast}</option></select></label>
          <label>{x.language} <select id="language" value={language} onChange={(e) => { const nl = e.target.value as Lang; setPersonalLanguage(nl); reset(nl); }}>
            <option value="fi">Suomi</option><option value="en">English</option></select></label>
          <button type="button" data-testid="rq-reset" onClick={() => reset()}>{x.reset}</button>
        </div>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((line, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{line}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <main className="rq-main">
        {v === 'mode'
          ? <Mode key={`${gen}-${direction}-${language}`} dir={direction} x={x} l={language} s={s} paused={sending} saved={saved} add={add} say={setToast}
              openSend={() => setSending(true)} openMine={() => { view = 'mine'; setV('mine'); }} />
          : <Mine x={x} l={language} route={route} saved={saved} remove={(k) => setSaved((list) => list.filter((f) => f.key !== k))} openSend={() => setSending(true)} />}
      </main>
      {sending && unsent.length ? <SendSheet x={x} l={language} items={unsent} onClose={closeSend} say={setToast}
        onSent={() => { setSaved((list) => list.map((f) => ({...f, sent: true}))); setSending(false); }} /> : null}
      {toast ? <div className="ah-explain-toast ef-toast" role="status" data-testid="rq-toast">{toast}</div> : null}
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
