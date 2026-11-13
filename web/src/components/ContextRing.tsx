import { useEffect, useRef, useState } from "react";
import { formatNumber, liveText } from "../i18n";
import { contextRingText } from "../text/contextRing";
import { ControlButton } from "./ControlElements";
import "./ContextRing.css";

const txt = liveText(contextRingText);

// How full the model's context window is (Rengas, Jari 26.10.2026, issue
// proto-context-basic): a ring and percentage in the top bar before the
// model chip, the ring alone on a phone until the attention level.

/** What the application layer read from Pi's native session and catalog. */
export type ContextUsage = {
  /** known: Pi's last recorded usage; compacting: Pi is summarizing;
   * after: compacted, edited: the context was edited; both unknown until
   * Pi's next reply records usage. */
  phase: "known" | "compacting" | "after" | "edited";
  tokens?: number;
  /** The model's window in Pi's registry; unknown omits the percentage. */
  window?: number;
  /** Pi's automatic compaction: on, off, or not known. */
  autoCompaction?: boolean;
  /** Tokens Pi keeps free; it compacts above window − reserve. */
  reserve?: number;
  /** The model's display name. */
  model?: string;
};

export type ContextLevel =
  | "ok"
  | "near"
  | "critical"
  | "nowindow"
  | "compacting"
  | "after";

// Pi's own footer thresholds: attention above 70 %, error above 90 %.
export function contextFacts(usage: ContextUsage) {
  const window = usage.window && usage.window > 0 ? usage.window : undefined;
  const percent =
    usage.phase === "known" && window && usage.tokens !== undefined
      ? (usage.tokens / window) * 100
      : undefined;
  const threshold =
    window && usage.autoCompaction && usage.reserve !== undefined
      ? Math.max(0, window - usage.reserve)
      : undefined;
  const level: ContextLevel =
    usage.phase === "edited"
      ? "after"
      : usage.phase !== "known"
        ? usage.phase
        : percent === undefined
          ? "nowindow"
          : percent >= 90
            ? "critical"
            : percent >= 70
              ? "near"
              : "ok";
  return { window, percent, threshold, level };
}

const full = (n: number) => formatNumber(n);
const short = (n: number) =>
  n >= 1e6
    ? `${formatNumber(n / 1e6, { maximumFractionDigits: 2 })}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}k`
      : String(n);
const pct = (p: number) =>
  txt.percent(p > 0 && p < 1 ? "<1" : String(Math.round(p)));

/** One sentence per state: accessible name, tooltip and the details' lead. */
export function contextSentence(usage: ContextUsage) {
  const { window, percent, threshold, level } = contextFacts(usage);
  if (level === "compacting") return txt.compacting;
  if (usage.phase === "edited") return txt.edited;
  if (level === "after") return txt.after;
  const tokens = usage.tokens ?? 0;
  if (level === "nowindow" || percent === undefined || !window)
    return txt.noWindow(full(tokens));
  const compaction =
    threshold !== undefined
      ? txt.compactsAt(pct((threshold / window) * 100))
      : usage.autoCompaction === false
        ? txt.autoOff
        : "";
  return `${txt.usage(pct(percent), full(tokens), full(window))}${compaction ? ` ${compaction}` : ""}`;
}

export function Ring({
  percent,
  level,
  tick,
}: {
  percent?: number;
  level: ContextLevel;
  tick?: number;
}) {
  const at = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [10 + r * Math.cos(a), 10 + r * Math.sin(a)];
  };
  const [x1, y1] = tick !== undefined ? at(4.6, tick * 3.6) : [0, 0];
  const [x2, y2] = tick !== undefined ? at(9.4, tick * 3.6) : [0, 0];
  return (
    <svg className="ah-ctx-ring" viewBox="0 0 20 20" aria-hidden="true">
      <circle className="ah-ctx-track" cx="10" cy="10" r="7" />
      {level === "compacting" ? (
        <circle
          className="ah-ctx-arc ah-ctx-spin"
          cx="10"
          cy="10"
          r="7"
          pathLength={100}
          strokeDasharray="28 100"
        />
      ) : percent !== undefined ? (
        <circle
          className="ah-ctx-arc"
          cx="10"
          cy="10"
          r="7"
          pathLength={100}
          strokeDasharray={`${Math.min(100, percent).toFixed(1)} 100`}
          transform="rotate(-90 10 10)"
        />
      ) : null}
      {tick !== undefined ? (
        <line className="ah-ctx-tick" x1={x1} y1={y1} x2={x2} y2={y2} />
      ) : null}
    </svg>
  );
}

/** The top-bar indicator; it opens and closes the context page. */
export function ContextRing({
  usage,
  open = false,
  onToggle,
  action,
}: {
  usage: ContextUsage;
  /** What pressing does, when it is not the context page (a worker's ring
   * opens its details). */
  action?: string;
  /** The context page is showing. */
  open?: boolean;
  onToggle?: () => void;
}) {
  const { window, percent, threshold, level } = contextFacts(usage);
  const sentence = contextSentence(usage);
  const tick =
    threshold !== undefined &&
    window &&
    level !== "compacting" &&
    level !== "after"
      ? (threshold / window) * 100
      : undefined;
  // Only changes that matter are spoken: nearing the limit, compaction and
  // its end. The first observation is not a change.
  const [announcement, setAnnouncement] = useState("");
  const previous = useRef<ContextLevel>(undefined);
  useEffect(() => {
    const before = previous.current;
    previous.current = level;
    if (!before || before === level) return;
    if (
      ["near", "critical", "compacting", "after"].includes(level) ||
      before === "after"
    )
      setAnnouncement(sentence);
  }, [level, sentence]);
  const value =
    level === "compacting"
      ? txt.compactingValue
      : level === "after"
        ? "?"
        : percent === undefined
          ? short(usage.tokens ?? 0)
          : pct(percent);
  return (
    <>
      <ControlButton
        data-testid="context-ring"
        data-menu-summary={sentence}
        data-level={level}
        data-tokens={usage.tokens}
        data-window={window}
        data-percent={percent}
        data-tick={tick}
        size="inline"
        presentation="pill"
        variant="quiet"
        className="ah-ctx-chip"
        aria-label={`${sentence} ${action ?? (open ? txt.back : txt.open)}`}
        aria-pressed={action ? undefined : open}
        aria-expanded={action ? open : undefined}
        title={sentence}
        onPress={onToggle}
      >
        <Ring percent={percent} level={level} tick={tick} />
        <span className="ah-ctx-value">{value}</span>
      </ControlButton>
      <span
        className="ah-visually-hidden"
        role="status"
        data-testid="context-announcement"
      >
        {announcement}
      </span>
    </>
  );
}
