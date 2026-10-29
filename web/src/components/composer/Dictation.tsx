import { useCallback, useEffect, useRef, useState } from "react";
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

/** What the composer needs for speech input. Without it there is no mic. */
export type ComposerSpeech = {
  /** Opens Asetukset › Sanelu, where the person's Soniox key is kept. */
  onOpenSettings: () => void;
  /** The browser's microphone, socket and clock; stories replace them. */
  deps?: DictationDeps;
};

const holdMs = 500;

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

/** One dictation for the composer: the engine, the text it started from,
 * and the press that may be a hold. onEnd receives the field's new text
 * once a dictation that heard something ends. */
export function useDictation(
  speech: ComposerSpeech | undefined,
  csrf: string | undefined,
  onEnd: (text: string) => void,
) {
  const [view, setView] = useState<DictationView | null>(null);
  const [notice, setNotice] = useState<DictationNotice | null>(null);
  const [holding, setHolding] = useState(false);
  const engine = useRef<Dictation | null>(null);
  const base = useRef("");
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
            const joined = `${base.current}${next.final}`;
            ending.current(joined);
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
  const start = useCallback((text: string) => {
    const d = engine.current;
    if (!d || d.active) return;
    // Dictation goes on after what is already written.
    base.current = text && !/\s$/.test(text) ? `${text} ` : text;
    setNotice(null);
    void d.start();
  }, []);
  /** Ends the dictation and resolves with the field's whole text. */
  const stop = useCallback(async () => {
    const d = engine.current;
    if (!d?.active) return null;
    const final = await d.stop();
    return final ? `${base.current}${final}` : null;
  }, []);
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      void engine.current?.stop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
  /** The mic's press: a tap starts, a hold of over half a second ends the
   * dictation when it is let go. */
  const press = useCallback(
    (text: string) => {
      start(text);
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
    base: base.current,
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
  disabled,
}: {
  dictation: DictationState;
  text: string;
  disabled: boolean;
}) {
  const pressed = useRef(false);
  const pill = useRef<HTMLButtonElement>(null);
  const { view, active, holding } = dictation;
  // The pill is a new element in the mic's place, so the click that ends a
  // tap on the mic never lands on it; a keyboard start moves focus to it.
  useEffect(() => {
    if (active && document.activeElement === document.body)
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
        title="Sanele · napauta aloittaaksesi, pidä pohjassa puhuaksesi"
        disabled={disabled}
        onPointerDown={(event) => {
          if (event.button !== 0 || disabled) return;
          pressed.current = true;
          dictation.press(text);
        }}
        onClick={() => {
          // A pointer press already started it; Enter and Space arrive here.
          if (pressed.current) {
            pressed.current = false;
            return;
          }
          dictation.start(text);
        }}
      >
        <Icon name="mic" />
        <span className="ah-crow-lbl">Sanele</span>
      </button>
    );
  }
  const paused = view.phase === "live" && view.quietMs >= 2000;
  const label =
    view.phase === "connecting"
      ? "Yhdistetään…"
      : view.phase === "reconnecting"
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
      className={`ah-dictation-pill${view.phase !== "live" ? " busy" : ""}${paused ? " paused" : ""}${holding ? " hold" : ""}`}
      aria-label={`Lopeta sanelu, ${mmss(view.elapsedMs)}`}
      title="Lopeta sanelu (Esc). Teksti jää kenttään."
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

/** The field while dictating: what was written, the confirmed text and the
 * still-changing guess dimmed after it. */
export function DictationLive({ dictation }: { dictation: DictationState }) {
  const box = useRef<HTMLDivElement>(null);
  const view = dictation.view;
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow new words.
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view?.final, view?.interim]);
  if (!view) return null;
  const empty = !dictation.base && !view.final && !view.interim;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a read-only text box whose guess is styled apart, which a textarea cannot show.
    <div
      ref={box}
      data-testid="dictation-live"
      className={`ah-cbox-field ah-dictation-live${empty ? " empty" : ""}`}
      role="textbox"
      tabIndex={0}
      aria-readonly="true"
      aria-multiline="true"
      aria-label="Sanelu"
      data-placeholder={
        view.phase === "connecting"
          ? "Yhdistetään Sonioxiin…"
          : "Puhu, teksti tulee tähän…"
      }
    >
      {dictation.base}
      <span data-testid="dictation-final">{view.final}</span>
      {view.phase !== "finishing" ? (
        <span data-testid="dictation-interim" className="ah-dictation-interim">
          {view.interim}
        </span>
      ) : null}
      <span className="ah-dictation-caret" aria-hidden="true" />
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
  onOpenSettings,
}: {
  dictation: DictationState;
  text: string;
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
                  } else dictation.start(text);
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
