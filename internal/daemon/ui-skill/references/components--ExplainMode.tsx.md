# components/ExplainMode.tsx

Generated from web/src/components/ExplainMode.tsx; do not edit.

```tsx
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useExperimentalFeature } from "../app/accountPreferences";
import { useText } from "../i18n";
import { explainModeText } from "../text/explainMode";
import { ControlButton } from "./ControlElements";
import { type CardId, hoverOnly, parts, waiting } from "./explainParts";
import { Icon } from "./Icon";
import "./ExplainMode.css";
import {
  hideState,
  showState,
  start,
  stop,
  toggle,
  useExplainState,
} from "./explainModeState";
import { suppressNativeTitles } from "./suppressNativeTitles";
import { WorkerMark, type WorkerMarkKind } from "./WorkerMark";

/* The explain mode (proto-explain-mode-r6, rounds 6–9): the screen dims and
 * whatever the pointer is on explains itself in a card beside it. Pointing
 * works as it does outside the mode, so a row still shows its hidden
 * buttons, and a press does what it always does; only presses whose effect
 * lasts wait (explainParts.ts). A touch screen has no pointer: the first tap
 * on a part explains it and a second tap does it. In a conversation the mode
 * opens at the state card, and the bar's state brings it back. The layer
 * lets the pointer through, so production's own hover rules and presses
 * need nothing from it. */

const workerKinds: WorkerMarkKind[] = [
  "working",
  "idle",
  "waiting_parent",
  "unknown",
  "merged",
  "unfinished",
  "failed",
  "unmerged",
  "checking",
  "answer",
  "reported",
];
function WorkerLegend() {
  const t = useText(explainModeText).workerLegend;
  return (
    <table className="ah-worker-legend" data-testid="worker-legend">
      <caption>{t.caption}</caption>
      <tbody>
        {workerKinds.map((kind) => (
          <tr key={kind}>
            <td>
              <WorkerMark kind={kind} />
            </td>
            <th scope="row">{t[kind]}</th>
          </tr>
        ))}
        <tr>
          <td>
            <WorkerMark kind="working" waited />
          </td>
          <th scope="row">{t.waited}</th>
        </tr>
        <tr>
          <td>
            <Icon name="check" className="ah-bg-gone" aria-hidden="true" />
          </td>
          <th scope="row">{t.gone}</th>
        </tr>
      </tbody>
    </table>
  );
}

export type Situation =
  | "notStarted"
  | "working"
  | "yourTurn"
  | "stopped"
  | "failed"
  | "background";

/** The dot the state card and the bar show for each situation. */
const dots: Record<Situation, "idle" | "running" | "waiting" | "failed"> = {
  notStarted: "idle",
  working: "running",
  yourTurn: "waiting",
  stopped: "waiting",
  failed: "failed",
  background: "waiting",
};

const LAST_TURN =
  '.ah-feed > li[data-kind="assistant"] [data-testid="agent-turn"]';
/** The part that carries each situation on screen; of several, the last
 * (the latest turn). The state card stays clear of it. */
const anchors: Record<Situation, string> = {
  notStarted: '[data-testid="start-here"]',
  working: '[data-testid="turn-progress"]',
  yourTurn: '.ah-feed [data-testid="stage-reply"]:not(.ah-turn-interim)',
  stopped: `${LAST_TURN} [data-testid="turn-stage"]`,
  failed: LAST_TURN,
  background: '[data-testid="background-work"]',
};

/** The conversation's situation as the screen already shows it: the
 * header's state and the latest turn. Reading the rendered view rather than
 * the host facts keeps the state card telling the same story as the header,
 * never a second one. Null outside a conversation, or while its state is
 * unknown. */
export function readSituation(root: ParentNode = document): Situation | null {
  const header = root.querySelector<HTMLElement>(".ah-agent-header");
  if (!header) return null;
  if (root.querySelector('[data-testid="conversation-empty"]'))
    return "notStarted";
  if (header.dataset.activity === "working") return "working";
  if (header.dataset.activity === "unknown") return null;
  if (
    header.querySelector(
      '[data-testid="process-waiting"], [data-testid="spinoff-waiting"]',
    )
  )
    return "background";
  const turns = root.querySelectorAll(LAST_TURN);
  const last = turns[turns.length - 1];
  if (last?.querySelector('[data-reply-kind="failed"]')) return "failed";
  if (
    last?.querySelector('[data-testid="turn-stage"]') &&
    !last.querySelector('[data-testid="stage-reply"]:not(.ah-turn-interim)')
  )
    return "stopped";
  return "yourTurn";
}

type Mode = {
  on: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  /** The state card is showing (where the view has a state). */
  stateShown: boolean;
  showState: () => void;
};

/** The mode for an entry point: undefined while the feature is off. */
export function useExplainMode(): Mode | undefined {
  const available = useExperimentalFeature("explain-mode");
  const state = useExplainState();
  return useMemo(
    () =>
      available
        ? {
            on: state.on,
            start,
            stop,
            toggle,
            stateShown: state.on && state.stateShown,
            showState,
          }
        : undefined,
    [available, state],
  );
}

/** The mode itself, above the whole app: its bar, which takes room rather
 * than covering the top bar it explains too, and the layer over the view.
 * In a conversation the bar's state is the button that brings the state
 * card back. */
export function ExplainMode() {
  const mode = useExplainMode();
  const on = !!mode?.on;
  const [situation, setSituation] = useState<Situation | null>(null);
  useEffect(() => {
    // Turning the feature off ends the mode.
    if (!mode) stop();
  }, [mode]);
  useLayoutEffect(() => {
    if (!on) return;
    document.documentElement.setAttribute("data-explain-mode", "");
    const restoreTitles = suppressNativeTitles(document.body);
    return () => {
      document.documentElement.removeAttribute("data-explain-mode");
      restoreTitles();
    };
  }, [on]);
  // The bar names the situation and follows it while the mode is on.
  useEffect(() => {
    if (!on) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setSituation(readSituation());
    };
    read();
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(read);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-activity", "data-reply-kind"],
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      setSituation(null);
    };
  }, [on]);
  if (!mode?.on) return null;
  const state = situation;
  const stateShown = mode.stateShown && !!state;
  return (
    <>
      <ExplainBar situation={state} stateShown={stateShown} />
      <ExplainLayer situation={state} stateShown={stateShown} />
    </>
  );
}

/** The menus' row (Tilivalikko, and ⋯ on a phone): Selitä tämä näkymä. */
export function useExplainEntry():
  | { id: "explain"; label: string; run: () => void }
  | undefined {
  const mode = useExplainMode();
  const t = useText(explainModeText);
  return mode ? { id: "explain", label: t.entry, run: mode.start } : undefined;
}

/** Selitä in the conversation's top bar: opens the mode at the state card;
 * a second press ends it. */
export function ExplainToggle() {
  const mode = useExplainMode();
  const t = useText(explainModeText);
  if (!mode) return null;
  return (
    <ControlButton
      data-testid="explain-toggle"
      data-explain-own=""
      size="row"
      variant="quiet"
      className="ah-topbar-icon ah-explain-toggle"
      aria-label={t.toggle}
      aria-pressed={mode.on}
      title={t.toggle}
      onPress={mode.toggle}
    >
      <span className="ah-explain-q" aria-hidden="true">
        ?
      </span>
    </ControlButton>
  );
}

const stripKey = "nah:explain-strip-closed";

/** The start page's strip (Mitä näytöllä on? · Selitä nämä mulle), until the
 * person closes it in this browser. */
export function ExplainStrip() {
  const mode = useExplainMode();
  const t = useText(explainModeText);
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(stripKey) === "1";
    } catch {
      return false;
    }
  });
  if (!mode || closed) return null;
  return (
    <section
      className="ah-explain-strip"
      data-testid="explain-strip"
      aria-label={t.strip.title}
    >
      <div>
        <b>{t.strip.title}</b>
        <span className="ah-explain-pointer">{t.strip.text}</span>
        <span className="ah-explain-touch">{t.strip.textTouch}</span>
      </div>
      <ControlButton
        data-testid="explain-strip-go"
        data-explain-own=""
        size="row"
        variant="primary"
        onPress={mode.toggle}
      >
        {mode.on ? t.strip.end : t.strip.go}
      </ControlButton>
      <ControlButton
        data-testid="explain-strip-close"
        data-explain-own=""
        size="row"
        variant="quiet"
        aria-label={t.strip.close}
        title={t.strip.close}
        onPress={() => {
          try {
            localStorage.setItem(stripKey, "1");
          } catch {
            // Without storage the strip closes for this page only.
          }
          setClosed(true);
        }}
      >
        <span aria-hidden="true">×</span>
      </ControlButton>
    </section>
  );
}

function ExplainBar({
  situation,
  stateShown,
}: {
  situation: Situation | null;
  stateShown: boolean;
}) {
  const t = useText(explainModeText);
  return (
    <div className="ah-explain-bar" data-testid="explain-bar">
      <b>{t.bar.title}</b>
      {situation ? (
        <button
          type="button"
          className="ah-explain-now"
          data-testid="explain-state"
          data-explain-own=""
          data-situation={situation}
          aria-pressed={stateShown}
          title={t.bar.showState}
          onClick={showState}
        >
          <i data-dot={dots[situation]} aria-hidden="true" />
          <span>
            <em className="ah-explain-prefix">{t.bar.now}: </em>
            {t.states[situation].name}
          </span>
          <em aria-hidden="true">›</em>
        </button>
      ) : null}
      <span className="ah-explain-hint">{t.bar.hint}</span>
      <button
        type="button"
        className="ah-explain-stop"
        data-testid="explain-stop"
        data-explain-own=""
        onClick={stop}
      >
        {t.bar.stop} <kbd>Esc</kbd>
      </button>
    </div>
  );
}

type Rect = { x: number; y: number; w: number; h: number };
type Target = { id: CardId; el: Element; rect: Rect };

const OWN = "[data-explain-own], .ah-explain-ui";
/** Fields where Enter does what a waiting button does. */
const SUBMITS =
  '[data-testid="message-input"], [data-testid="workspace-icon-wish"], [data-testid="workspace-icon-letters-input"], [data-testid="workspace-icon-own"], [data-testid="directory-name"]';
// A control keeps its whole box, because a press anywhere on it acts.
const CONTROL =
  'button, a, input, textarea, select, summary, label, [role="button"], [role="menuitem"], [role="option"], [role="tab"], [role="switch"]';
const VISUAL =
  'button, a, input, textarea, select, img, svg, canvas, kbd, hr, [role="button"]';
const entries = Object.entries(parts) as [CardId, (typeof parts)[CardId]][];

function opacity(el: Element | null, memo: Map<Element, number>): number {
  if (!el || el === document.documentElement) return 1;
  const known = memo.get(el);
  if (known !== undefined) return known;
  const style = getComputedStyle(el);
  const value =
    style.visibility === "hidden"
      ? 0
      : Number(style.opacity) * opacity(el.parentElement, memo);
  memo.set(el, value);
  return value;
}

/** Where a part shows something: a wide, mostly empty band answers only
 * over its text, pictures and controls, plus a little room. */
function contentBox(el: Element, memo: Map<Element, number>): DOMRect | Rect {
  const box = el.getBoundingClientRect();
  if (el.matches(CONTROL) || box.width * box.height < 6000) return box;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const add = (q: DOMRect) => {
    if (q.width < 1 || q.height < 1) return;
    left = Math.min(left, q.left);
    top = Math.min(top, q.top);
    right = Math.max(right, q.right);
    bottom = Math.max(bottom, q.bottom);
  };
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!n.nodeValue?.trim() || !parent || parent.closest("svg")) continue;
    if (opacity(parent, memo) < 0.15) continue;
    range.selectNodeContents(n);
    for (const q of range.getClientRects()) add(q);
  }
  for (const v of el.querySelectorAll(VISUAL))
    if (!v.closest("svg svg") && opacity(v, memo) >= 0.15)
      add(v.getBoundingClientRect());
  if (left === Infinity) return box;
  const pad = 4;
  return {
    x: Math.max(box.left, left - pad),
    y: Math.max(box.top, top - pad),
    w: Math.min(box.right, right + pad) - Math.max(box.left, left - pad),
    h: Math.min(box.bottom, bottom + pad) - Math.max(box.top, top - pad),
  };
}

/** The part's visible box, clipped by its scrolling ancestors; null when it
 * is invisible. */
function visibleRect(el: Element, memo: Map<Element, number>): Rect | null {
  const outer = el.getBoundingClientRect();
  if (outer.width < 3 || outer.height < 3) return null;
  if (opacity(el, memo) < 0.15) return null;
  const c = contentBox(el, memo);
  const r = "w" in c ? c : { x: c.left, y: c.top, w: c.width, h: c.height };
  let left = r.x;
  let top = r.y;
  let right = r.x + r.w;
  let bottom = r.y + r.h;
  for (
    let p = el.parentElement;
    p && p !== document.body;
    p = p.parentElement
  ) {
    const style = getComputedStyle(p);
    if (style.display === "none") return null;
    if (/(auto|scroll|hidden|clip)/.test(style.overflow)) {
      const q = p.getBoundingClientRect();
      left = Math.max(left, q.left);
      top = Math.max(top, q.top);
      right = Math.min(right, q.right);
      bottom = Math.min(bottom, q.bottom);
    }
  }
  left = Math.max(left, 0);
  top = Math.max(top, 0);
  right = Math.min(right, window.innerWidth);
  bottom = Math.min(bottom, window.innerHeight);
  if (right - left < 3 || bottom - top < 3) return null;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Which card an element is, if any: the first part whose selector it
 * matches. */
function cardOf(el: Element): CardId | undefined {
  for (const [id, part] of entries) if (el.matches(part.sel)) return id;
  return undefined;
}

/** The part under (x, y): of the parts around what the eye sees there, the
 * smallest that shows something at that point. A part under an open list or
 * menu is covered, as a press there would close the list. */
function hit(x: number, y: number): Target | "own" | null {
  const memo = new Map<Element, number>();
  const top = document
    .elementsFromPoint(x, y)
    .find((n) => n.closest(OWN) || opacity(n, memo) >= 0.15);
  if (!top) return null;
  // The bar's own buttons and the cards are the mode's, not parts it
  // explains: pressing the bar's state must not put its card away.
  if (top.closest(".ah-explain-ui, .ah-explain-bar [data-explain-own]"))
    return "own";
  let best: Target | null = null;
  for (
    let n: Element | null = top;
    n && n !== document.body;
    n = n.parentElement
  ) {
    const id = cardOf(n);
    if (!id) continue;
    const rect = visibleRect(n, memo);
    if (!rect) continue;
    if (x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h)
      continue;
    if (!best || rect.w * rect.h < best.rect.w * best.rect.h)
      best = { id, el: n, rect };
  }
  return best;
}

/** A part's element on screen now: the given one while it stays, else the
 * last visible element of that card. */
function find(id: CardId, el?: Element): Target | null {
  const memo = new Map<Element, number>();
  if (el?.isConnected) {
    const rect = visibleRect(el, memo);
    if (rect) return { id, el, rect };
  }
  const all = [...document.querySelectorAll(parts[id].sel)].reverse();
  for (const candidate of all) {
    if (candidate.closest(".ah-explain-ui")) continue;
    const rect = visibleRect(candidate, memo);
    if (rect) return { id, el: candidate, rect };
  }
  return null;
}

function anchorRect(situation: Situation): Rect | null {
  const all = document.querySelectorAll(anchors[situation]);
  const el = all[all.length - 1];
  return el ? visibleRect(el, new Map()) : null;
}

/** Does what a press on the part does: a field takes focus, anything else
 * is clicked. */
function press(el: Element) {
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
    el.focus();
  else if (el instanceof HTMLElement) el.click();
}

function isTyping(el: Element | null) {
  return (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && !["checkbox", "radio"].includes(el.type))
  );
}

const barBottom = () =>
  Math.max(
    0,
    document.querySelector(".ah-explain-bar")?.getBoundingClientRect().bottom ??
      0,
  );

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function ExplainLayer({
  situation,
  stateShown,
}: {
  situation: Situation | null;
  stateShown: boolean;
}) {
  const t = useText(explainModeText);
  const [target, setTarget] = useState<Target | null>(null);
  // Over empty space the last card stays, quieter, so it does not flicker
  // while the pointer crosses the gaps between parts.
  const [linger, setLinger] = useState(false);
  const [ring, setRing] = useState<Target | null>(null);
  const [flash, setFlash] = useState<Rect | null>(null);
  const [toast, setToast] = useState<string>();
  const [touch, setTouch] = useState(
    () => window.matchMedia?.("(hover: none)").matches ?? false,
  );
  const [pointer, setPointer] = useState<number>();
  const [, setTick] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const live = useRef({ target, stateShown, touch });
  live.current = { target, stateShown, touch };

  const showState = stateShown && !!situation && !target;
  // The state card comes back when the bar asks for it…
  useEffect(() => {
    if (stateShown) {
      setTarget(null);
      setLinger(false);
    }
  }, [stateShown]);
  // …and goes when a part is pointed at.
  const pointAt = useCallback((found: Target) => {
    setTarget(found);
    setLinger(false);
    if (live.current.stateShown) hideState();
  }, []);

  const say = useCallback((text: string, at?: Rect) => {
    setToast(text);
    if (at) setFlash(at);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    let frame = 0;
    let at: { x: number; y: number } | null = null;
    const move = () => {
      frame = 0;
      if (!at) return;
      const found = hit(at.x, at.y);
      if (found === "own") return;
      if (found) {
        if (live.current.target?.el !== found.el) pointAt(found);
        else setLinger(false);
        setPointer(at.x);
      } else if (live.current.target) setLinger(true);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      setTouch(false);
      at = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(move);
    };
    // A press decides once, at its start, what the whole gesture does:
    // pass (it acts as always), wait (a lasting effect), or explain (a
    // touch screen's first tap).
    let gesture: { block: boolean; apply?: () => void } | null = null;
    const block = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const onDown = (event: PointerEvent) => {
      gesture = null;
      const touchPress = event.pointerType === "touch";
      setTouch(touchPress);
      if (!(event.target instanceof Element) || event.target.closest(OWN))
        return;
      const found = hit(event.clientX, event.clientY);
      if (!found || found === "own") return;
      const current = live.current.target;
      if (touchPress && current?.el !== found.el) {
        gesture = {
          block: true,
          apply: () => pointAt(found),
        };
      } else if (waiting.has(found.id)) {
        gesture = {
          block: true,
          apply: () => say(t.card.waited, found.rect),
        };
      }
      if (gesture?.block) block(event);
    };
    const onUp = (event: PointerEvent) => {
      if (!gesture?.block) return;
      block(event);
      gesture.apply?.();
      gesture.apply = undefined;
    };
    const onCancel = () => {
      gesture = null;
    };
    const swallow = (event: Event) => {
      if (gesture?.block) block(event);
    };
    const onClick = (event: MouseEvent) => {
      if (!gesture?.block) return;
      block(event);
      gesture = null;
    };
    const onKey = (event: KeyboardEvent) => {
      const focused = document.activeElement;
      if (event.key === "Escape") {
        // An open menu or dialog takes its own Esc first.
        if (
          focused?.closest(
            '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]',
          ) &&
          !focused.closest(".ah-explain-ui")
        )
          return;
        block(event);
        stop();
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!focused || focused.closest(OWN)) return;
      // Enter in these fields sends or saves (a message, a wish to the
      // model, a workspace icon, a new workspace), and those wait.
      const sends =
        event.key === "Enter" && !event.shiftKey && focused.matches(SUBMITS);
      const id = isTyping(focused) && !sends ? undefined : cardOf(focused);
      if (sends || (id && waiting.has(id))) {
        block(event);
        say(t.card.waited, visibleRect(focused, new Map()) ?? undefined);
      }
    };
    // What moves under the card (a scroll, a list that opens) moves it.
    const remeasure = () => setTick((n) => n + 1);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    window.addEventListener("mousedown", swallow, true);
    window.addEventListener("mouseup", swallow, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
      window.removeEventListener("mousedown", swallow, true);
      window.removeEventListener("mouseup", swallow, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [say, t, pointAt]);

  // The views change under the mode (a press opened the work, a list): the
  // pointed part follows its element, or goes when the element goes.
  useEffect(() => {
    let frame = 0;
    const observer = new MutationObserver((records) => {
      if (
        records.every((r) => (r.target as Element).closest?.(".ah-explain-ui"))
      )
        return;
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          setTick((n) => n + 1);
        });
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Re-measure on every render the tick or a change asked for.
  const shown = target ? find(target.id, target.el) : null;
  useLayoutEffect(() => {
    if (target && !shown) setTarget(null);
  });
  const anchor = showState && situation ? anchorRect(situation) : null;

  const rows =
    showState && situation
      ? (Object.entries(t.states[situation].can) as [CardId, string][]).flatMap(
          ([id, text]) => {
            const part = find(id);
            return part ? [{ id, text, part }] : [];
          },
        )
      : [];

  // Place the card once its size is known: a part's card below the part
  // at the pointer (above it when there is no room); the state card where
  // it covers neither its anchor nor the parts its rows point at.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Below the mode's bar, which the card must not cover.
    const top = barBottom() + 8;
    let x: number;
    let y: number;
    if (shown) {
      const gap = 10;
      const r = shown.rect;
      const cx =
        !live.current.touch && pointer !== undefined ? pointer : r.x + r.w / 2;
      x = Math.min(Math.max(8, cx - w / 2), vw - w - 8);
      y = r.y + r.h + gap;
      if (y + h > vh - 8) y = r.y - h - gap;
      if (y < top) y = Math.min(vh - h - 8, Math.max(top, r.y + r.h + gap));
    } else {
      const keep = [anchor, ...rows.map((row) => row.part.rect)].filter(
        (k): k is Rect => !!k,
      );
      const r = anchor;
      const cx = r ? r.x + r.w / 2 : vw / 2;
      const cy = r ? r.y + r.h / 2 : vh / 2;
      const gap = 12;
      const xs = r
        ? [r.x + r.w + gap, r.x - w - gap, cx - w / 2, r.x, r.x + r.w - w]
        : [cx - w / 2];
      const ys = r ? [r.y - h - gap, r.y + r.h + gap, r.y, r.y + r.h - h] : [];
      for (let y0 = top; y0 < vh - h; y0 += 16) ys.push(y0);
      let best = { x: 8, y: top, score: Infinity };
      for (const x0 of xs)
        for (const y0 of ys) {
          const px = Math.min(Math.max(8, x0), vw - w - 8);
          const py = Math.min(Math.max(top, y0), vh - h - 8);
          let cover = 0;
          for (const k of keep)
            cover +=
              Math.max(
                0,
                Math.min(px + w, k.x + k.w + 4) - Math.max(px, k.x - 4),
              ) *
              Math.max(
                0,
                Math.min(py + h, k.y + k.h + 4) - Math.max(py, k.y - 4),
              );
          const score =
            cover * 1000 + Math.hypot(px + w / 2 - cx, py + h / 2 - cy);
          if (score < best.score) best = { x: px, y: py, score };
        }
      x = best.x;
      y = best.y;
    }
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(Math.max(top, y))}px`;
  });

  // The layer starts below the bar and clips what would dim it.
  const offset = barBottom();
  const hole = (r: Rect, className = "ah-explain-hole") => (
    <i
      className={className}
      style={{
        left: r.x - 3,
        top: r.y - 3 - offset,
        width: r.w + 6,
        height: r.h + 6,
      }}
    />
  );

  let body: ReactNode = null;
  let dim: ReactNode = <i className="ah-explain-veil" />;
  if (shown) {
    const part = parts[shown.id];
    const text: {
      name: string;
      lead: string;
      know?: string;
      try?: string;
      grey?: string;
      menu?: string;
    } = t.cards[shown.id];
    const el = shown.el;
    const disabled =
      el.matches('[disabled], [aria-disabled="true"], [data-disabled]') ||
      !!el.closest('[aria-disabled="true"]');
    const inMenu = !!el.closest('[role="menu"]');
    const waits = waiting.has(shown.id);
    const acts = !!text.try || !!part.opens;
    let foot: ReactNode = null;
    if (waits) foot = <p className="ah-explain-wait">{t.card.waits}</p>;
    else if (acts && !disabled)
      foot = touch ? (
        <div className="ah-explain-foot">
          <ControlButton
            data-testid="explain-do"
            size="row"
            variant="primary"
            onPress={() => press(el)}
          >
            {text.try ?? t.card.open}
          </ControlButton>
          <span>{t.card.tapAgain}</span>
        </div>
      ) : (
        <p className="ah-explain-foot">
          {text.try ? t.card.clickHint(lower(text.try)) : t.card.clickOpens}
        </p>
      );
    dim = hole(
      shown.rect,
      `ah-explain-hole${linger ? " ah-explain-linger" : ""}`,
    );
    body = (
      <div
        ref={card}
        className={`ah-explain-ui ah-explain-card${linger ? " ah-explain-linger" : ""}`}
        data-testid="explain-card"
        data-card={shown.id}
        data-touch={touch || undefined}
        aria-live="polite"
      >
        <div className="ah-explain-top">
          <span className="ah-explain-kind">{t.kinds[part.kind]}</span>
          {part.key ? <kbd>{part.key}</kbd> : null}
          {touch ? (
            <ControlButton
              data-testid="explain-close"
              size="inline"
              variant="quiet"
              className="ah-explain-x"
              aria-label={t.card.close}
              onPress={() => setTarget(null)}
            >
              <span aria-hidden="true">×</span>
            </ControlButton>
          ) : null}
        </div>
        <h2>{text.name}</h2>
        <p>{text.lead}</p>
        {text.know ? <p className="ah-explain-know">{text.know}</p> : null}
        {part.workerLegend ? <WorkerLegend /> : null}
        {disabled && text.grey ? (
          <p className="ah-explain-note">{text.grey}</p>
        ) : null}
        {inMenu && text.menu ? (
          <p className="ah-explain-note">{text.menu}</p>
        ) : null}
        {!touch && el.closest(hoverOnly) ? (
          <p className="ah-explain-note">{t.card.onlyHover}</p>
        ) : null}
        {foot}
      </div>
    );
  } else if (showState && situation) {
    const state = t.states[situation];
    dim = (
      <>
        {anchor ? hole(anchor) : <i className="ah-explain-dim" />}
        {ring ? hole(ring.rect, "ah-explain-ring") : null}
      </>
    );
    body = (
      <div
        ref={card}
        className="ah-explain-ui ah-explain-card ah-explain-state"
        data-testid="explain-state-card"
        data-situation={situation}
        role="dialog"
        aria-label={t.card.now}
      >
        <div className="ah-explain-top">
          <span className="ah-explain-kind ah-explain-kind-now">
            {t.card.now}
          </span>
          <i className="ah-explain-dot" data-dot={dots[situation]} />
          {touch ? (
            <ControlButton
              data-testid="explain-close"
              size="inline"
              variant="quiet"
              className="ah-explain-x"
              aria-label={t.card.close}
              onPress={hideState}
            >
              <span aria-hidden="true">×</span>
            </ControlButton>
          ) : null}
        </div>
        <h2>{state.name}</h2>
        <p>{state.lead}</p>
        <p className="ah-explain-know">{state.know}</p>
        {rows.length ? (
          <div className="ah-explain-can">
            <span>{t.card.can}</span>
            <ul>
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    data-testid={`explain-can-${row.id}`}
                    onPointerEnter={() => setRing(row.part)}
                    onPointerLeave={() => setRing(null)}
                    onFocus={() => setRing(row.part)}
                    onBlur={() => setRing(null)}
                    onClick={() => {
                      setRing(null);
                      const now = find(row.id, row.part.el);
                      if (!now) return;
                      // A touch screen explains the part first, as a tap
                      // on it would.
                      if (touch) pointAt(now);
                      else if (waiting.has(row.id))
                        say(t.card.waited, now.rect);
                      else press(now.el);
                    }}
                  >
                    {row.text}
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  // Above everything the view puts on top of itself (menus, lists), so a
  // menu row's card is not hidden under its menu; below the bar, which
  // stays undimmed.
  return createPortal(
    <>
      <div
        className="ah-explain-ui ah-explain-layer"
        style={{ top: offset }}
        aria-hidden="true"
      >
        {dim}
        {flash ? hole(flash, "ah-explain-flash") : null}
      </div>
      {body}
      {toast ? (
        <div className="ah-explain-ui ah-explain-toast" role="status">
          {toast}
        </div>
      ) : null}
    </>,
    document.body,
  );
}

```
