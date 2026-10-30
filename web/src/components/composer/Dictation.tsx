import {
  type RefObject,
  useCallback,
  useEffect,
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
  return useMemo(() => dictationShortcutFor({ mac: isMac, layout }), [layout]);
}

/** "Enter, Esc tai ⌘§": a list of keys the way the hint reads it. */
function either(keys: string[]) {
  return keys.length < 2
    ? (keys[0] ?? "")
    : `${keys.slice(0, -1).join(", ")} tai ${keys.at(-1)}`;
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

export type DictationNotice = {
  id: SpeechFailure | "ceiling" | "dropped";
  tone: "info" | "danger";
  title: string;
  /** Omitted when the title and the action already say it all. */
  text?: string;
  actions: ("settings" | "retry" | "resume")[];
};

function noticeFor(view: DictationView): DictationNotice | null {
  if (view.phase !== "idle" || !view.ended || view.ended === "stopped")
    return null;
  if (view.ended === "ceiling")
    return {
      id: "ceiling",
      tone: "info",
      title: "Sanelu päättyi 10 minuutin kattoon",
      text: "Kaikki sanottu on kentässä.",
      actions: ["resume"],
    };
  if (view.ended === "dropped")
    return {
      id: "dropped",
      tone: "danger",
      title:
        view.failure === "speech_key_rejected"
          ? "Sanelu katkesi: Soniox ei enää hyväksy avainta"
          : view.failure === "speech_limit_reached"
            ? "Sanelu katkesi: Soniox-avaimen käyttöraja täyttyi"
            : "Sanelu katkesi: yhteys Sonioxiin ei palannut",
      text: `Teksti ${mmss(view.elapsedMs)} asti on kentässä. Viimeiset sanat voivat olla epätarkkoja.`,
      actions: ["resume"],
    };
  switch (view.failure) {
    case "speech_key_missing":
      return {
        id: view.failure,
        tone: "info",
        title: "Sanelu tarvitsee Soniox-avaimen",
        actions: ["settings"],
      };
    case "microphone_denied":
      return {
        id: view.failure,
        tone: "danger",
        title: "Selain ei antanut mikrofonia",
        text: "Salli mikrofoni osoiterivin lukkokuvakkeesta ja yritä uudelleen.",
        actions: ["retry"],
      };
    case "speech_key_rejected":
      return {
        id: view.failure,
        tone: "danger",
        title: "Soniox ei hyväksy avainta",
        text: "Avain on väärä tai peruttu. Tallenna uusi avain asetuksissa.",
        actions: ["settings"],
      };
    case "speech_limit_reached":
      return {
        id: view.failure,
        tone: "danger",
        title: "Soniox-avaimen käyttöraja on täynnä",
        text: "Yritä hetken päästä uudelleen tai lisää oma avain asetuksissa.",
        actions: ["retry", "settings"],
      };
    case "unsupported":
      return {
        id: view.failure,
        tone: "danger",
        title: "Tämä selain ei pysty saneluun",
        text: "Kokeile toista selainta.",
        actions: [],
      };
    default:
      return {
        id: "speech_unavailable",
        tone: "danger",
        title: "Soniox ei vastaa",
        text: "Sanelu ei alkanut. Yritä hetken päästä uudelleen.",
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
          setNotice(noticeFor(next));
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
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      void engine.current?.stop();
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
        (!scope.current?.contains(target) ||
          (control && !control.classList.contains("ah-dictation-pill")))
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
  };
}

export type DictationState = ReturnType<typeof useDictation>;

/** The mic at rest, or the recording pill in its place while dictating. */
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
  const shortcut = useDictationShortcut();
  const pressed = useRef(false);
  const pill = useRef<HTMLButtonElement>(null);
  const { view, active, holding } = dictation;
  // The pill is a new element in the mic's place, so the click that ends a
  // tap on the mic never lands on it; a keyboard start moves focus to it,
  // also from the field the dictation hides.
  useEffect(() => {
    const at = document.activeElement;
    if (
      active &&
      (at === document.body ||
        (at instanceof HTMLElement &&
          at.hidden &&
          !!pill.current?.closest(".ah-cbox")?.contains(at)))
    )
      pill.current?.focus();
  }, [active]);
  if (!active || !view) {
    return (
      <button
        key="mic"
        type="button"
        data-testid="dictation-mic"
        className="ah-crow-btn ah-dictation-mic"
        aria-label="Sanele"
        aria-keyshortcuts={shortcut.aria}
        title={`Sanele (${either(shortcut.labels)}) · napauta aloittaaksesi, pidä pohjassa puhuaksesi`}
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
        <span className="ah-crow-lbl">Sanele</span>
      </button>
    );
  }
  // The microphone opens at the press and keeps what is said while the
  // stream to Soniox opens, so the dictation listens from the start.
  const listening = view.phase === "live" || view.phase === "connecting";
  const paused = view.phase === "live" && view.quietMs >= 2000;
  const label =
    view.phase === "reconnecting"
      ? "Yhdistetään uudelleen…"
      : view.phase === "finishing"
        ? "Viimeistellään…"
        : holding
          ? "päästä irti, niin sanelu loppuu"
          : paused
            ? `tauko ${mmss(view.quietMs)}`
            : "kuuntelee";
  const bars = [0.55, 0.85, 1, 0.75, 0.6];
  return (
    <button
      key="pill"
      ref={pill}
      type="button"
      data-testid="dictation-stop"
      data-phase={view.phase}
      className={`ah-dictation-pill${listening ? "" : " busy"}${paused ? " paused" : ""}${holding ? " hold" : ""}`}
      aria-label={`Lopeta sanelu, ${mmss(view.elapsedMs)}`}
      aria-keyshortcuts={`Enter Escape ${shortcut.aria}`}
      title={`Lopeta sanelu (${either(["Enter", "Esc", ...shortcut.labels])}). Teksti jää kenttään.`}
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
        <span>Valmis</span>
      </span>
    </button>
  );
}

/** The field while dictating: what was written, with the confirmed text and
 * the still-changing guess dimmed after it at the caret. */
export function DictationLive({ dictation }: { dictation: DictationState }) {
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
      aria-label="Sanelu"
      data-placeholder="Puhu, teksti tulee tähän…"
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
        <strong>Sanelu päättyy {mmss(left)} kuluttua</strong>{" "}
        <span className="ah-dictation-sub">Kaikki sanottu jää kenttään.</span>
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
  const n = dictation.notice;
  if (!n) return null;
  const labels = {
    settings: "Avaa asetukset",
    retry: "Yritä uudelleen",
    resume: "Jatka sanelua",
  };
  return (
    <div
      data-testid="dictation-notice"
      data-notice={n.id}
      className={`ah-dictation-notice ${n.tone}`}
      role={n.tone === "danger" ? "alert" : "status"}
    >
      <Icon name={n.tone === "danger" ? "warning" : "info"} />
      <div className="ah-dictation-notice-body">
        <strong>{n.title}</strong>
        {n.text ? <p>{n.text}</p> : null}
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
                  } else dictation.start(text, caret());
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
        aria-label="Sulje ilmoitus"
        onClick={dictation.dismiss}
      >
        <Icon name="cross" />
      </button>
    </div>
  );
}
