import React, {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import {
  type Attachment,
  AttachmentChips,
} from "../../../../web/src/components/AttachmentChips";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import {
  HabitatMark,
  type MarkState,
} from "../../../../web/src/components/HabitatMark";
import { Icon } from "../../../../web/src/components/Icon";
import { WorkingProgress } from "../../../../web/src/components/WorkingProgress";
import { AttachmentRefusal } from "../../../../web/src/components/composer/AttachmentRefusal";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { attachmentChipsText } from "../../../../web/src/text/attachmentChips";
import "../../../../web/src/components/components.css";
import { TEXT } from "./text";
import "./round.css";

// upload-animation-uses-mark, round 1. Jari 14.11.2026: the attachment upload
// should use the Open Habitat mark properly in its animation. One view, the
// composer's attachment chips while uploading, built from production's
// pieces: Composer (field, paperclip, Send), AttachmentRefusal (the failed
// upload's banner with Yritä uudelleen) and WorkingProgress (the agent's own
// mark above the field). Nyt is production's AttachmentChips unchanged; the
// directions replace only the chip's visual with the round-own UploadChips,
// which keeps AttachmentChips' markup, classes and progressbar.
setPersonalLanguage("fi");

const directions = ["Nyt", "1 Täyttyy", "2 Palkki", "3 Kehys"];
const params = new URLSearchParams(location.search);

// HabitatMark's ring, which the component does not export (NOTES.md).
const RING =
  "M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z";
/** The open ring's share of the path; the rest is the door. */
const OPEN = 81.3;

// ---------- The synthetic uploads ----------

const thumb = (a: string, b: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${a}"/><rect x="10" y="14" width="76" height="14" rx="3" fill="${b}"/><rect x="10" y="36" width="46" height="46" rx="4" fill="#fff"/><circle cx="72" cy="58" r="12" fill="${b}"/></svg>`,
  )}`;

type Item = {
  name: string;
  size: number;
  thumb?: string;
  /** Seconds to send the bytes and for the host to save them. */
  up: number;
  save: number;
  /** The connection breaks at this share of `up`. */
  fail?: number;
  /** The bytes stall for a while on a slow connection. */
  stall?: boolean;
};
type Phase =
  | { kind: "waiting" }
  | { kind: "uploading"; p: number }
  | { kind: "saving" }
  | { kind: "done" }
  | { kind: "settled" }
  | { kind: "failed"; p: number };

/** How long the saved mark shows before the chip settles into the file. */
const FLASH = 1.2;
const curve = (x: number, stall?: boolean) =>
  !stall
    ? x
    : x < 0.3
      ? (x / 0.3) * 0.36
      : x < 0.55
        ? 0.36 + ((x - 0.3) / 0.25) * 0.02
        : 0.38 + ((x - 0.55) / 0.45) * 0.62;

/** Production uploads one file at a time, the next once the host saved the
 * previous; a failure holds the rest until it is retried or removed. */
function phases(items: Item[], t: number, failOn: boolean): Phase[] {
  let cursor = 0;
  let blocked = false;
  return items.map((it) => {
    const start = cursor;
    cursor = start + it.up + it.save;
    if (blocked || t < start) return { kind: "waiting" };
    const local = t - start;
    if (failOn && it.fail !== undefined && local >= it.fail * it.up) {
      blocked = true;
      return { kind: "failed", p: curve(it.fail, it.stall) };
    }
    if (local < it.up) return { kind: "uploading", p: curve(local / it.up, it.stall) };
    if (local < it.up + it.save) return { kind: "saving" };
    if (local < it.up + it.save + FLASH) return { kind: "done" };
    return { kind: "settled" };
  });
}

type SceneId = keyof typeof TEXT.scenes;
type Scene = { id: SceneId; items: Item[]; t0: number; working?: boolean };

const SCENES: Scene[] = [
  {
    id: "small",
    items: [{ name: "muistio.md", size: 14_000, up: 0.5, save: 0.4 }],
    t0: 1.3,
  },
  {
    id: "large",
    items: [
      { name: "retkikartta.tif", size: 18_400_000, up: 16, save: 0.8, stall: true },
    ],
    t0: 6.9,
  },
  {
    id: "many",
    working: true,
    items: [
      { name: "kuvakaappaus.png", size: 640_000, thumb: thumb("#dfe7e4", "#7fa69a"), up: 0.8, save: 0.3 },
      { name: "mittaukset.csv", size: 96_000, up: 0.3, save: 0.3 },
      { name: "esittely.mp4", size: 12_600_000, up: 9, save: 0.8 },
      { name: "raportti.pdf", size: 2_100_000, up: 1.5, save: 0.4 },
      { name: "muistiinpanot.md", size: 8_000, up: 0.3, save: 0.3 },
    ],
    t0: 7.5,
  },
  {
    id: "saving",
    items: [{ name: "aineisto.zip", size: 19_200_000, up: 6, save: 30 }],
    t0: 8,
  },
  {
    id: "failed",
    items: [
      { name: "luonnos.pdf", size: 9_600_000, up: 8, save: 0.6, fail: 0.62 },
      { name: "kansikuva.png", size: 1_200_000, thumb: thumb("#e8e1d4", "#b38b5d"), up: 1, save: 0.3 },
    ],
    t0: 6,
  },
];
const total = (s: Scene) =>
  s.items.reduce((sum, it) => sum + it.up + it.save, 0) + FLASH + 0.2;

const pct = (p: number) => Math.floor(p * 100);

// ---------- Nyt: production's chips ----------

function NowChips({ items, ph }: { items: Item[]; ph: Phase[] }) {
  const attachments: Attachment[] = items.map((it, i) => {
    const p = ph[i];
    if (p.kind === "settled" || p.kind === "done")
      return {
        image: !!it.thumb,
        name: it.name,
        // A data URL's fragment swallows production's `/thumbnail` suffix.
        url: it.thumb
          ? `${it.thumb}#`
          : `/api/v1/attachments/00000000-0000-4000-8000-00000000000${i}`,
        source: "",
      };
    return {
      image: false,
      name: it.name,
      url: `pending-${i}`,
      source: "",
      pending: true,
      progress:
        p.kind === "uploading" || p.kind === "failed"
          ? p.p
          : p.kind === "saving"
            ? 1
            : 0,
      failed: p.kind === "failed",
    };
  });
  return <AttachmentChips attachments={attachments} onRemove={() => {}} />;
}

// ---------- The directions' chips ----------

/** 1 Merkki täyttyy: the ring is drawn from the door as the bytes go. */
function FillMark({ phase }: { phase: Phase }) {
  const p = phase.kind === "uploading" || phase.kind === "failed" ? phase.p : 0;
  return (
    <svg
      className="oh-mark um-fill"
      data-testid="upload-mark"
      data-phase={phase.kind}
      data-state={phase.kind === "done" ? "done" : undefined}
      viewBox="-12 -12 24 24"
      width={24}
      height={24}
      aria-hidden="true"
      focusable="false"
    >
      <path className="um-track" pathLength={100} d={RING} />
      <path
        className="oh-ring um-progress"
        pathLength={100}
        d={RING}
        style={
          phase.kind === "uploading" || phase.kind === "failed"
            ? { strokeDasharray: `${(p * OPEN).toFixed(2)} 100` }
            : undefined
        }
      />
      <circle className="oh-dot" r={2.5} />
    </svg>
  );
}

/** 2 Merkki ja palkki: production's mark states; progress is the bar. */
const barMark = (phase: Phase): MarkState =>
  phase.kind === "done"
    ? "done"
    : phase.kind === "failed"
      ? "error"
      : phase.kind === "waiting"
        ? "idle"
        : "loading";

/** 3 Merkki kehyksenä: the resident walks in from the door. */
function FrameMark({ phase, thumb }: { phase: Phase; thumb?: string }) {
  const p =
    phase.kind === "uploading" || phase.kind === "failed"
      ? phase.p
      : phase.kind === "waiting"
        ? 0
        : 1;
  // From the door's mouth (inside the chip) to the middle.
  const away = (1 - p) * 8.5;
  return (
    <span className="um-frame" data-phase={phase.kind}>
      <svg
        className="oh-mark um-frame-mark"
        data-testid="upload-mark"
        data-phase={phase.kind}
        data-state={phase.kind === "done" ? "done" : undefined}
        viewBox="-12 -12 24 24"
        width={28}
        height={28}
        aria-hidden="true"
        focusable="false"
      >
        <path className="oh-ring" pathLength={100} d={RING} />
        <circle
          className="oh-dot"
          r={2.5}
          style={{ transform: `translate(${away.toFixed(2)}px, ${(-away).toFixed(2)}px)` }}
        />
      </svg>
      {phase.kind === "done" && thumb ? (
        <img className="um-frame-thumb" src={thumb} alt="" />
      ) : null}
    </span>
  );
}

function UploadChips({ d, items, ph }: { d: number; items: Item[]; ph: Phase[] }) {
  const t = useText(attachmentChipsText);
  return (
    <ul
      data-testid="attachment-chips"
      className="ah-attachment-chips ah-attachment-chips-draft um-chips"
      data-direction={d}
      aria-label={t.attachments}
    >
      {items.map((it, i) => {
        const phase = ph[i];
        const settled = phase.kind === "settled";
        const pending = !settled && phase.kind !== "done";
        const p =
          phase.kind === "uploading" || phase.kind === "failed"
            ? phase.p
            : phase.kind === "saving"
              ? 1
              : 0;
        const visual = settled ? (
          it.thumb ? (
            <img className="um-settled" src={it.thumb} alt="" />
          ) : (
            <span className="um-settled">
              <Icon name="file" />
            </span>
          )
        ) : d === 1 ? (
          <FillMark phase={phase} />
        ) : d === 2 ? (
          <HabitatMark
            state={barMark(phase)}
            size={20}
            className={phase.kind === "waiting" ? "um-quiet" : undefined}
            data-testid="upload-mark"
          />
        ) : (
          <FrameMark phase={phase} thumb={it.thumb} />
        );
        return (
          <li
            key={it.name}
            data-testid="attachment-chip"
            data-phase={phase.kind}
            data-attachment-kind={it.thumb ? "image" : "file"}
            className="ah-attachment-chip um-chip"
            style={{ "--p": p } as CSSProperties}
          >
            <ControlButton
              data-testid="attachment-open"
              className="ah-attachment-open"
              variant="quiet"
              size="inline"
              aria-label={t.open(it.name)}
              isDisabled={pending}
            >
              {visual}
              <span className="ah-attachment-name">{it.name}</span>
            </ControlButton>
            {pending ? (
              <span
                data-testid="attachment-progress"
                role="progressbar"
                aria-label={it.name}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct(p)}
                aria-valuetext={
                  phase.kind === "failed"
                    ? t.failed
                    : phase.kind === "saving"
                      ? t.saving
                      : phase.kind === "waiting"
                        ? t.waiting
                        : undefined
                }
              >
                {phase.kind === "failed"
                  ? `${t.failed} ${pct(p)} %`
                  : phase.kind === "saving"
                    ? t.saving
                    : phase.kind === "waiting"
                      ? t.waiting
                      : `${pct(p)} %`}
              </span>
            ) : phase.kind === "done" ? (
              <span className="um-done-word" data-testid="attachment-saved">
                Tallessa
              </span>
            ) : null}
            {d !== 1 && pending ? (
              <span className="um-bar" aria-hidden="true">
                <span />
              </span>
            ) : null}
            <ControlButton
              data-testid={pending ? "attachment-cancel" : "attachment-remove"}
              className="ah-attachment-remove"
              variant="quiet"
              size="inline"
              presentation="icon"
              aria-label={pending ? t.cancel(it.name) : t.remove(it.name)}
            >
              <Icon name="cross" />
            </ControlButton>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- A scene: one composer with its uploads ----------

const noop = () => {};

function SceneView({ d, scene }: { d: number; scene: Scene }) {
  const words = TEXT.scenes[scene.id];
  const [clock, setClock] = useState({ t: scene.t0, failOn: true, playing: false });
  const [draft, setDraft] = useState(TEXT.drafts[scene.id]);
  useEffect(() => {
    if (!clock.playing) return;
    let frame = 0;
    const began = performance.now() - clock.t * 1000;
    const end = total(scene);
    const tick = (now: number) => {
      const t = (now - began) / 1000;
      if (t >= end) {
        setClock((c) => ({ ...c, t: end, playing: false }));
        return;
      }
      setClock((c) => ({ ...c, t }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // biome-ignore lint/correctness/useExhaustiveDependencies: a run starts once per play.
  }, [clock.playing]);
  const ph = phases(scene.items, clock.t, clock.failOn);
  const failedAt = ph.findIndex((p) => p.kind === "failed");
  const failed = failedAt >= 0 ? scene.items[failedAt] : undefined;
  const failedPhase = ph[failedAt] as { p: number } | undefined;
  const chips =
    d === 0 ? (
      <NowChips items={scene.items} ph={ph} />
    ) : (
      <UploadChips d={d} items={scene.items} ph={ph} />
    );
  const banner = failed ? (
    <AttachmentRefusal
      refused={[
        {
          id: failed.name,
          file: { name: failed.name, size: failed.size } as File,
          reason: "failed",
          loaded: (failedPhase?.p ?? 0) * failed.size,
          waiting: ph.filter((p) => p.kind === "waiting").length,
        },
      ]}
      onRetry={() => setClock({ t: 0, failOn: false, playing: true })}
    />
  ) : null;
  return (
    <section className="um-scene" data-testid={`scene-${scene.id}`}>
      <header className="um-scene-head">
        <h2>{words.title}</h2>
        <button
          type="button"
          className="um-replay"
          data-testid={`replay-${scene.id}`}
          onClick={() => setClock({ t: 0, failOn: true, playing: true })}
        >
          {TEXT.replay}
        </button>
      </header>
      <p className="um-caption">{words.caption}</p>
      {scene.working ? (
        <WorkingProgress
          state="accepted"
          events={[{ type: "tool_execution_start", toolName: "read" }]}
        />
      ) : null}
      <div className="um-composer">
        <Composer
          value={draft}
          onChange={setDraft}
          activity={scene.working ? "working" : "idle"}
          selectedWorkingMode="steer"
          onModeChange={noop}
          onSendNow={noop}
          onSteer={noop}
          onFollowUp={noop}
          csrf="prototype"
          beforeField={
            <>
              {chips}
              {banner}
            </>
          }
        />
      </div>
    </section>
  );
}

// ---------- The page ----------

let reviewTheme =
  (params.get("theme") as "light" | "dark" | "contrast") || "light";

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const bar = useRef<HTMLElement>(null);
  const t = TEXT;
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty(
        "--review-h",
        `${el.getBoundingClientRect().height}px`,
      );
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <div className="um-review" data-direction={direction}>
      <header className="um-bar-head" ref={bar}>
        <div className="um-controls">
          <strong>{t.title}</strong>
          <label>
            {t.theme}{" "}
            <select
              id="theme"
              value={theme}
              onChange={(e) => {
                reviewTheme = e.target.value as typeof reviewTheme;
                setTheme(reviewTheme);
              }}
            >
              {(["light", "dark", "contrast"] as const).map((k) => (
                <option key={k} value={k}>
                  {t.themes[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ol className="um-lines" data-testid="direction-lines">
          {t.lines.map((l, i) => (
            <li key={l} aria-current={i === direction ? "true" : undefined}>
              {l}
            </li>
          ))}
        </ol>
        <p className="um-recommend" data-testid="recommendation">
          {t.recommend}
        </p>
      </header>
      <main className="um-stage">
        {SCENES.map((s) => (
          <SceneView key={`${direction}-${s.id}`} d={direction} scene={s} />
        ))}
      </main>
    </div>
  );
}

// ---------- Host stand-in: the field asks for nothing it needs here ----------

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);
  return new Response("", { status: 404 });
};

const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
  set innerHTML(view: ReactNode) {
    flushSync(() => root.render(view === "" ? null : view));
  },
};
const variants = directions.map((_, direction) => () => (
  <App key={direction} direction={direction} />
));
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML =
  '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement("button");
  button.className = "proto-picker-item";
  button.textContent = n;
  if (i === 0) {
    button.setAttribute("data-active", "");
    button.setAttribute("aria-current", "true");
  }
  picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);

export type { React };
