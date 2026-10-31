import {
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  browserDictationDeps,
  Dictation,
  type DictationDeps,
  type DictationView,
  stopAtMs,
  warnAtMs,
} from "../../app/dictation";
import { mintSpeechSession, type SpeechFailure } from "../../app/speech";
import { liveText, useLanguage, useText } from "../../i18n";
import { dictationText } from "../../text/dictation";
import { Icon } from "../Icon";
import {
  type DictationShortcut,
  dictationShortcutFor,
  type KeyboardLayout,
  readKeyboardLayout,
} from "./dictationShortcut";

/** What the composer needs for speech input. Without it there is no mic. */
export type ComposerSpeech = {
  /** Opens Asetukset › Sanelu, where the person's Soniox key is kept. */
  onOpenSettings: () => void;
  /** The browser's microphone, socket and clock; stories replace them. */
  deps?: DictationDeps;
};

const holdMs = 500;

const txt = liveText(dictationText);
type Text = typeof dictationText.fi;

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/** The dictation shortcut, named after the key the layout has left of 1
 * once the browser has said what that is. */
export function useDictationShortcut(): DictationShortcut {
  const [layout, setLayout] = useState<KeyboardLayout | null>(null);
  useEffect(() => {
    let live = true;
    void readKeyboardLayout().then((read) => {
      if (live) setLayout(read);
    });
    return () => {
      live = false;
    };
  }, []);
  // The Mac's alternative is named in the interface's language.
  const language = useLanguage();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the language renames the alternative.
  return useMemo(
    () => dictationShortcutFor({ mac: isMac, layout }),
    [layout, language],
  );
}

/** "Enter, Esc tai ⌘§": a list of keys the way the hint reads it. */
function either(keys: string[]) {
  return keys.length < 2
    ? (keys[0] ?? "")
    : txt.or(keys.slice(0, -1).join(", "), keys.at(-1) ?? "");
}

/** Where a dictation writes: the selection it replaces or the caret. */
export type Caret = [start: number, end: number];

/** The field split at the caret; the dictated text goes between. */
function aroundCaret(text: string, caret: Caret | undefined) {
  const end = Math.min(caret?.[1] ?? text.length, text.length);
  const start = Math.min(caret?.[0] ?? end, end);
  const before = text.slice(0, start);
  return {
    // A word said after one written is a word of its own.
    before: before && !/\s$/.test(before) ? `${before} ` : before,
    after: text.slice(end),
  };
}

/** What follows is apart from what was said, unless it is punctuation. */
function gap(said: string, after: string) {
  return said && after && !/\s$/.test(said) && !/^[\s.,;:!?)\]}»”]/.test(after)
    ? " "
    : "";
}

/** The field once the dictated text is in, and the caret right after it. */
function dictatedInto(around: { before: string; after: string }, said: string) {
  const { before, after } = around;
  return {
    text: `${before}${said}${gap(said, after)}${after}`,
    caret: before.length + said.length,
  };
}

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Its words are read when it shows, in the language of that moment. */
export type DictationNotice = {
  id: SpeechFailure | "ceiling" | "dropped" | "cancelled";
  tone: "info" | "danger";
  /** Why a dropped dictation was cut off. */
  failure?: SpeechFailure;
  /** How far a dropped dictation got. */
  elapsedMs?: number;
  actions: ("settings" | "retry" | "resume" | "restore")[];
};

/** A cancelled dictation that heard something: ✕ or Esc keeps the field as
 * it was, and Palauta puts the words back, so a stray Esc loses nothing. */
const cancelledNotice: DictationNotice = {
  id: "cancelled",
  tone: "info",
  actions: ["restore"],
};

/** A notice's title and its text, which is omitted when the title and the
 * action already say it all. */
function noticeWords(
  n: DictationNotice,
  t: Text,
): { title: string; text?: string } {
  switch (n.id) {
    case "cancelled":
      return { title: t.cancelled };
    case "ceiling":
      return { title: t.ceilingTitle, text: t.ceilingText };
    case "dropped":
      return {
        title:
          n.failure === "speech_key_rejected"
            ? t.droppedKey
            : n.failure === "speech_limit_reached"
              ? t.droppedLimit
              : t.droppedConnection,
        text: t.droppedText(mmss(n.elapsedMs ?? 0)),
      };
    case "speech_key_missing":
      return { title: t.keyMissing };
    case "microphone_denied":
      return { title: t.micDenied, text: t.micDeniedText };
    case "speech_key_rejected":
      return { title: t.keyRejected, text: t.keyRejectedText };
    case "speech_limit_reached":
      return { title: t.limitReached, text: t.limitReachedText };
    case "unsupported":
      return { title: t.unsupported, text: t.unsupportedText };
    default:
      return { title: t.unavailable, text: t.unavailableText };
  }
}

function noticeFor(view: DictationView): DictationNotice | null {
  if (
    view.phase !== "idle" ||
    !view.ended ||
    view.ended === "stopped" ||
    view.ended === "cancelled"
  )
    return null;
  if (view.ended === "ceiling")
    return {
      id: "ceiling",
      tone: "info",
      actions: ["resume"],
    };
  if (view.ended === "dropped")
    return {
      id: "dropped",
      tone: "danger",
      failure: view.failure,
      elapsedMs: view.elapsedMs,
      actions: ["resume"],
    };
  switch (view.failure) {
    case "speech_key_missing":
      return {
        id: view.failure,
        tone: "info",
        actions: ["settings"],
      };
    case "microphone_denied":
      return {
        id: view.failure,
        tone: "danger",
        actions: ["retry"],
      };
    case "speech_key_rejected":
      return {
        id: view.failure,
        tone: "danger",
        actions: ["settings"],
      };
    case "speech_limit_reached":
      return {
        id: view.failure,
        tone: "danger",
        actions: ["retry", "settings"],
      };
    case "unsupported":
      return {
        id: view.failure,
        tone: "danger",
        actions: [],
      };
    default:
      return {
        id: "speech_unavailable",
        tone: "danger",
        actions: ["retry"],
      };
  }
}

/** One dictation for the composer: the engine, the text around the caret it
 * started from, and the press that may be a hold. onEnd receives the
 * field's new text and the caret after the dictated words once a dictation
 * that heard something ends. */
export function useDictation(
  speech: ComposerSpeech | undefined,
  csrf: string | undefined,
  onEnd: (text: string, caret: number) => void,
  /** The field's box: Enter there, or on nothing in particular, ends the
   * dictation as Valmis does. */
  scope: RefObject<HTMLElement | null>,
) {
  const [view, setView] = useState<DictationView | null>(null);
  const [notice, setNotice] = useState<DictationNotice | null>(null);
  const [holding, setHolding] = useState(false);
  const engine = useRef<Dictation | null>(null);
  const around = useRef({ before: "", after: "" });
  /** The field a dictation started from, and what a cancel dropped. */
  const started = useRef("");
  const dropped = useRef<{ around: typeof around.current; said: string }>(null);
  const ending = useRef(onEnd);
  ending.current = onEnd;
  const hold = useRef<{ at: number; timer: number } | null>(null);
  const deps = speech?.deps;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new session or microphone makes a new engine.
  useEffect(() => {
    if (!speech || !csrf) return;
    const d = new Dictation(
      deps ?? browserDictationDeps((signal) => mintSpeechSession(csrf, signal)),
      (next) => {
        setView(next);
        if (next.phase === "idle" && next.ended) {
          if (next.final) {
            const done = dictatedInto(around.current, next.final);
            ending.current(done.text, done.caret);
          }
          setNotice(
            next.ended === "cancelled" && dropped.current
              ? cancelledNotice
              : noticeFor(next),
          );
        }
      },
    );
    engine.current = d;
    return () => {
      d.dispose();
      engine.current = null;
      setView(null);
    };
  }, [csrf, deps, !!speech]);
  const active = !!view && view.phase !== "idle";
  const start = useCallback((text: string, caret?: Caret) => {
    const d = engine.current;
    if (!d || d.active) return;
    // Dictation writes at the caret, or in place of the selection.
    around.current = aroundCaret(text, caret);
    started.current = text;
    dropped.current = null;
    setNotice(null);
    void d.start();
  }, []);
  /** Ends the dictation and resolves with the field's whole text. */
  const stop = useCallback(async () => {
    const d = engine.current;
    if (!d?.active) return null;
    const final = await d.stop();
    return final ? dictatedInto(around.current, final).text : null;
  }, []);
  /** Ends the dictation and keeps nothing of it in the field, which stays
   * as it was; what was heard waits for restore. */
  const cancel = useCallback(() => {
    const d = engine.current;
    if (!d?.active) return;
    const said = `${d.view.final}${d.view.interim}`.trim();
    dropped.current = said ? { around: around.current, said } : null;
    d.cancel();
    // Back to the field, which the dictation hid or left read-only.
    window.requestAnimationFrame(() =>
      (
        scope.current?.querySelector("textarea") ??
        scope.current?.querySelector("input")
      )?.focus(),
    );
  }, [scope]);
  /** Puts a cancelled dictation's words back where it was said, or after
   * the text when the field has changed since. */
  const restore = useCallback((text: string) => {
    const was = dropped.current;
    dropped.current = null;
    setNotice(null);
    if (!was) return;
    const done = dictatedInto(
      text === started.current
        ? was.around
        : aroundCaret(text, [text.length, text.length]),
      was.said,
    );
    ending.current(done.text, done.caret);
  }, []);
  const cancelling = useRef(cancel);
  cancelling.current = cancel;
  useEffect(() => {
    if (!active) return;
    // Esc is ✕: Enter is done, Esc cancels, and the notice can restore.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      if (engine.current?.view.phase === "finishing") return;
      cancelling.current();
    };
    // Enter is Valmis: the text stays in the field and nothing is sent. It
    // is taken before the field's own keys, which would send, even from the
    // field the dictation hides, which Safari can leave focused.
    const onEnter = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        event.defaultPrevented
      )
        return;
      // On another of the row's buttons, such as Send, Enter is that
      // button's own.
      const target = event.target as Element | null;
      const control = target?.closest?.(
        'button, a[href], input, select, [role="button"], [role="menuitem"]',
      );
      if (
        target !== document.body &&
        (!scope.current?.contains(target) || control)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      void engine.current?.stop();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keydown", onEnter, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keydown", onEnter, true);
    };
  }, [active, scope]);
  /** The mic's press: a tap starts, a hold of over half a second ends the
   * dictation when it is let go. */
  const press = useCallback(
    (text: string, caret?: Caret) => {
      start(text, caret);
      const at = Date.now();
      const timer = window.setTimeout(() => setHolding(true), holdMs);
      hold.current = { at, timer };
      const release = () => {
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", release);
        const h = hold.current;
        hold.current = null;
        if (!h) return;
        window.clearTimeout(h.timer);
        setHolding(false);
        if (Date.now() - h.at > holdMs) void engine.current?.stop();
      };
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
    },
    [start],
  );
  return {
    view,
    active,
    holding,
    before: around.current.before,
    after: around.current.after,
    notice,
    dismiss: () => setNotice(null),
    start,
    press,
    stop,
    cancel,
    restore,
  };
}

export type DictationState = ReturnType<typeof useDictation>;

/** Sanele at rest: a tap starts, a hold talks until it is let go. Its
 * shortcut is in the app's own tooltip, which appears at once on hover or
 * keyboard focus, where the browser's title would wait seconds. */
function MicButton({
  dictation,
  text,
  caret,
  disabled,
  shortcut,
}: {
  dictation: DictationState;
  text: string;
  caret: () => Caret;
  disabled: boolean;
  shortcut: DictationShortcut;
}) {
  const t = useText(dictationText);
  const pressed = useRef(false);
  const tip = useId();
  return (
    <button
      type="button"
      data-testid="dictation-mic"
      className="ah-crow-btn ah-dictation-mic"
      aria-label={t.dictate}
      aria-keyshortcuts={shortcut.aria}
      aria-describedby={tip}
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button !== 0 || disabled) return;
        pressed.current = true;
        dictation.press(text, caret());
      }}
      onClick={() => {
        // A pointer press already started it; Enter and Space arrive here.
        if (pressed.current) {
          pressed.current = false;
          return;
        }
        dictation.start(text, caret());
      }}
    >
      <Icon name="mic" />
      <span className="ah-crow-lbl">{t.dictate}</span>
      <span
        id={tip}
        role="tooltip"
        data-testid="dictation-mic-tip"
        className="ah-dictation-tip"
      >
        {t.micTip(<kbd>{either(shortcut.labels)}</kbd>)}
      </span>
    </button>
  );
}

/** The control that replaces the mic is a new element in its place, so the
 * click that ends a tap on the mic never lands on it; a keyboard start moves
 * focus to it, also from the field the dictation hides. */
function useFocusOnStart(
  active: boolean,
  target: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    const at = document.activeElement;
    if (
      active &&
      (at === document.body ||
        (at instanceof HTMLElement &&
          at.hidden &&
          !!target.current?.closest(".ah-cbox")?.contains(at)))
    )
      target.current?.focus();
  }, [active, target]);
}

/** What the dictation is doing, in the words of its pill or bar. */
function stateLabel(
  view: DictationView,
  holding: boolean,
  connecting = txt.listeningConnecting,
) {
  const paused = view.phase === "live" && view.quietMs >= 2000;
  return view.phase === "reconnecting"
    ? txt.reconnecting
    : view.phase === "finishing"
      ? txt.finishing
      : holding
        ? txt.letGo
        : paused
          ? txt.pause(mmss(view.quietMs))
          : view.phase === "connecting"
            ? connecting
            : txt.listening;
}

/** The mic at rest, or a recording pill in its place while dictating: the
 * compact control for a one-line field (the workspace icon's wish), where
 * the composer's bar has no row to cover. */
export function DictationControl({
  dictation,
  text,
  caret,
  disabled,
}: {
  dictation: DictationState;
  text: string;
  /** The field's caret or selection, where the dictation writes. */
  caret: () => Caret;
  disabled: boolean;
}) {
  const t = useText(dictationText);
  const shortcut = useDictationShortcut();
  const pill = useRef<HTMLButtonElement>(null);
  const { view, active, holding } = dictation;
  useFocusOnStart(active, pill);
  if (!active || !view)
    return (
      <MicButton
        dictation={dictation}
        text={text}
        caret={caret}
        disabled={disabled}
        shortcut={shortcut}
      />
    );
  // The microphone opens at the press and keeps what is said while the
  // stream to Soniox opens, so the dictation listens from the start.
  const listening = view.phase === "live" || view.phase === "connecting";
  const paused = view.phase === "live" && view.quietMs >= 2000;
  const label = stateLabel(view, holding, t.listening);
  const bars = [0.55, 0.85, 1, 0.75, 0.6];
  return (
    <button
      key="pill"
      ref={pill}
      type="button"
      data-testid="dictation-stop"
      data-phase={view.phase}
      className={`ah-dictation-pill${listening ? "" : " busy"}${paused ? " paused" : ""}${holding ? " hold" : ""}`}
      aria-label={t.stopAt(mmss(view.elapsedMs))}
      aria-keyshortcuts={`Enter ${shortcut.aria}`}
      title={t.stopTip(either(["Enter", ...shortcut.labels]))}
      onClick={() => void dictation.stop()}
    >
      <span className="ah-dictation-dot" aria-hidden="true" />
      <span className="ah-dictation-bars" aria-hidden="true">
        {bars.map((weight, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars.
            key={i}
            style={{
              transform: `scaleY(${Math.max(0.18, Math.min(1, view.level * weight * 1.6)).toFixed(2)})`,
            }}
          />
        ))}
      </span>
      <span className="ah-dictation-time">{mmss(view.elapsedMs)}</span>
      <span className="ah-dictation-state">{label}</span>
      <span className="ah-dictation-done">
        <Icon name="check" />
        <span>{t.done}</span>
      </span>
    </button>
  );
}

/** Bars in the bar's waveform, newest at the right; a narrow bar shows only
 * the newest. */
const waveBars = 90;
const waveMs = 90;

/** While dictating, the row's
 * left part is one listening bar over the aids, which are not for use
 * meanwhile. Its controls sit at its anchored left end, so when the work
 * controls appear beside it only the waveform shortens. */
export function DictationBar({
  dictation,
  onCancel,
}: {
  dictation: DictationState;
  onCancel: () => void;
}) {
  const t = useText(dictationText);
  const { view, holding } = dictation;
  const listening = view?.phase === "live" || view?.phase === "connecting";
  const level = useRef(0);
  level.current = listening ? (view?.level ?? 0) : 0;
  const [wave, setWave] = useState<number[]>(() => Array(waveBars).fill(0));
  useEffect(() => {
    const timer = window.setInterval(
      () => setWave((w) => [...w.slice(1), level.current]),
      waveMs,
    );
    return () => window.clearInterval(timer);
  }, []);
  if (!view) return null;
  const finishing = view.phase === "finishing";
  const paused = view.phase === "live" && view.quietMs >= 2000;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would put a form group's border and legend inside the composer's row.
    <div
      data-testid="dictation-bar"
      data-phase={view.phase}
      className={`ah-dictation-bar${listening ? "" : " busy"}${paused ? " paused" : ""}`}
      role="group"
      aria-label={t.dictationAt(mmss(view.elapsedMs))}
    >
      <button
        type="button"
        data-testid="dictation-cancel"
        className="ah-dictation-cancel"
        aria-label={t.cancel}
        aria-keyshortcuts="Escape"
        title={t.cancelTip}
        disabled={finishing}
        onClick={onCancel}
      >
        <Icon name="cross" />
      </button>
      <span className="ah-dictation-dot" aria-hidden="true" />
      <span className="ah-dictation-time">{mmss(view.elapsedMs)}</span>
      <span className="ah-dictation-state">{stateLabel(view, holding)}</span>
      <span className="ah-dictation-wave" aria-hidden="true">
        {wave.map((h, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars.
            key={i}
            style={{
              transform: `scaleY(${Math.max(0.1, Math.min(1, h * 1.4)).toFixed(2)})`,
            }}
          />
        ))}
      </span>
      <span className="ah-dictation-hint" aria-hidden="true">
        <kbd>Enter</kbd>
        {t.doneKey}
      </span>
    </div>
  );
}

/** The slot beside Send: Sanele at rest and Valmis while dictating,
 * one width, so the finger that started the dictation finishes it in the
 * same place. */
export function DictationSlotControl({
  dictation,
  text,
  caret,
  disabled,
}: {
  dictation: DictationState;
  text: string;
  /** The field's caret or selection, where the dictation writes. */
  caret: () => Caret;
  disabled: boolean;
}) {
  const t = useText(dictationText);
  const shortcut = useDictationShortcut();
  const done = useRef<HTMLButtonElement>(null);
  const { view, active } = dictation;
  useFocusOnStart(active, done);
  if (!active || !view)
    return (
      <MicButton
        dictation={dictation}
        text={text}
        caret={caret}
        disabled={disabled}
        shortcut={shortcut}
      />
    );
  const finishing = view.phase === "finishing";
  return (
    <button
      ref={done}
      type="button"
      data-testid="dictation-stop"
      data-phase={view.phase}
      className="ah-dictation-finish"
      aria-label={t.finish}
      aria-keyshortcuts={`Enter ${shortcut.aria}`}
      aria-busy={finishing || undefined}
      title={t.finishTip(either(["Enter", ...shortcut.labels]))}
      onClick={() => void dictation.stop()}
    >
      {finishing ? (
        <span className="ah-dictation-spin" aria-hidden="true" />
      ) : (
        <Icon name="check" />
      )}
      <span className="ah-crow-lbl">{t.done}</span>
    </button>
  );
}

/** The field while dictating: what was written, with the confirmed text and
 * the still-changing guess dimmed after it at the caret. */
export function DictationLive({ dictation }: { dictation: DictationState }) {
  const t = useText(dictationText);
  const caret = useRef<HTMLSpanElement>(null);
  const view = dictation.view;
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow new words.
  useEffect(() => {
    caret.current?.scrollIntoView?.({ block: "nearest" });
  }, [view?.final, view?.interim]);
  if (!view) return null;
  const empty =
    !dictation.before && !dictation.after && !view.final && !view.interim;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a read-only text box whose guess is styled apart, which a textarea cannot show.
    <div
      data-testid="dictation-live"
      className={`ah-cbox-field ah-dictation-live${empty ? " empty" : ""}`}
      role="textbox"
      tabIndex={0}
      aria-readonly="true"
      aria-multiline="true"
      aria-label={t.dictation}
      data-placeholder={t.speak}
    >
      {dictation.before}
      <span data-testid="dictation-final">{view.final}</span>
      {view.phase !== "finishing" ? (
        <span data-testid="dictation-interim" className="ah-dictation-interim">
          {view.interim}
        </span>
      ) : null}
      <span ref={caret} className="ah-dictation-caret" aria-hidden="true" />
      {gap(`${view.final}${view.interim}`, dictation.after)}
      {dictation.after}
    </div>
  );
}

/** Above the field: the ceiling approaching. */
export function DictationCeiling({ view }: { view: DictationView | null }) {
  const t = useText(dictationText);
  if (
    !view ||
    (view.phase !== "live" && view.phase !== "reconnecting") ||
    view.elapsedMs < warnAtMs
  )
    return null;
  const left = stopAtMs - view.elapsedMs;
  return (
    <div
      data-testid="dictation-ceiling"
      className={`ah-dictation-note${left <= 20_000 ? " urgent" : ""}`}
      role="status"
    >
      <Icon name="clock" />
      <span>
        <strong>{t.endsIn(mmss(left))}</strong>{" "}
        <span className="ah-dictation-sub">{t.allStays}</span>
      </span>
    </div>
  );
}

/** Below the field: why a dictation ended or could not start. */
export function DictationNoticeView({
  dictation,
  text,
  caret,
  onOpenSettings,
}: {
  dictation: DictationState;
  text: string;
  caret: () => Caret;
  onOpenSettings: () => void;
}) {
  const t = useText(dictationText);
  const n = dictation.notice;
  if (!n) return null;
  const labels = t.actions;
  const words = noticeWords(n, t);
  return (
    <div
      data-testid="dictation-notice"
      data-notice={n.id}
      className={`ah-dictation-notice ${n.tone}`}
      role={n.tone === "danger" ? "alert" : "status"}
    >
      <Icon name={n.tone === "danger" ? "warning" : "info"} />
      <div className="ah-dictation-notice-body">
        <strong>{words.title}</strong>
        {words.text ? <p>{words.text}</p> : null}
        {n.actions.length ? (
          <div className="ah-dictation-notice-acts">
            {n.actions.map((action, i) => (
              <button
                key={action}
                type="button"
                data-testid={`dictation-${action}`}
                className={`ah-dictation-act${i === 0 ? " primary" : ""}`}
                onClick={() => {
                  if (action === "settings") {
                    dictation.dismiss();
                    onOpenSettings();
                  } else if (action === "restore") dictation.restore(text);
                  else dictation.start(text, caret());
                }}
              >
                {labels[action]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        data-testid="dictation-dismiss"
        className="ah-dictation-x"
        aria-label={t.closeNotice}
        onClick={dictation.dismiss}
      >
        <Icon name="cross" />
      </button>
    </div>
  );
}
