import React, { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import pickerSource from "../../lib/picker.js?raw";
import { initialTheme } from "../../lib/view-theme.js";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import "../../../../web/src/components/components.css";
import "../../../../web/src/components/SoundEmblem.css";
import { renderSound, type SoundId, type SoundLength, soundIds, soundStrikes, type Strike, volumeGain } from "../../../../web/src/app/soundSynth";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { SoundEmblem } from "../../../../web/src/components/SoundEmblem";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import { attentionSoundText } from "../../../../web/src/text/attentionSound";
import { LENGTHS, SETS, candidateStrikes, renderCandidate } from "./candidates.mjs";
import "./round.css";

// Attention-sound quality, round 1 (28.11.2026). The ten production sounds
// as they are now ("Nykyinen", rendered by production's soundSynth.ts) beside
// one candidate set per direction, with the other two a press away. Every
// sound is rendered on the page from its recipe; no audio file ships. Both
// columns are normalised by the same meter (−17 LUFS momentary maximum,
// −3 dBFS peak ceiling), so the comparison is loudness-matched. Production
// components: SoundEmblem, ControlButton, Icon, the sound names and
// descriptions, the volume curve. The round's own: the review bar, the rows
// and the waveforms. Synthetic; no host data.
setPersonalLanguage("fi");

type SetId = "current" | "A" | "B" | "C";
const sets = SETS as { id: Exclude<SetId, "current">; name: string; line: string }[];
const directions = sets.map((s) => `${s.id} ${s.name}`);

const T = {
  title: "Huomioäänten laatu · kierros 1",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö" },
  length: "Pituus",
  lengths: { short: "Lyhyt", long: "Pitkä" } as Record<SoundLength, string>,
  volume: "Äänenvoimakkuus",
  current: "Nykyinen",
  play: (what: string) => `Soita ${what}`,
  compare: "Vertaa",
  compareHelp: "Soittaa nykyisen ja heti perään ehdotuksen",
  playColumn: (what: string) => `Soita kaikki: ${what}`,
  others: "Muut ehdotukset",
  axis: "Akseli: kuinka paljon äänet muuttuvat. Kaikki on tasattu samaan äänekkyyteen (−17 LUFS, huippu alle −3 dBFS).",
  recommend:
    "Suosittelen B Kirkasta: se korjaa mitatut viat (tumma ja kapea yläpää, vaimennuskäyrällä katkaistu häntä) ja tuo lasin ja metallin kimalluksen, mutta pitää jokaisen äänen eleen, joten työtilojen äänet erottuvat yhä toisistaan ja Tunnus puu on yhä Habitatin aihe.",
  unlock: "Ääni käynnistyy ensimmäisestä painalluksesta.",
};

const text = attentionSoundText.fi;
const params = new URLSearchParams(location.search);
let reviewTheme = initialTheme(["light", "dark"]) as "light" | "dark";

// ---------- Renders, cached, made one at a time so the page stays responsive ----------

type Render = { left: Float32Array; right: Float32Array };
const renders = new Map<string, Render>();
const keyOf = (set: SetId, id: SoundId, length: SoundLength) => `${set}/${id}/${length}`;
function render(set: SetId, id: SoundId, length: SoundLength): Render {
  const k = keyOf(set, id, length);
  let r = renders.get(k);
  if (!r) {
    r = set === "current" ? renderSound(id, length) : (renderCandidate(set, id, length) as Render);
    renders.set(k, r);
  }
  return r;
}
const strikesOf = (set: SetId, id: SoundId, length: SoundLength): Strike[] =>
  set === "current" ? soundStrikes(id, length) : (candidateStrikes(set, id, length) as Strike[]);

// ---------- Playback: production's chain (buffer → gain at the volume curve) ----------

let audio: AudioContext | undefined;
type Play = { set: SetId; id: SoundId; length: SoundLength; frames: number; checksum: number; gain: number; at: number };
const plays: Play[] = [];
(window as unknown as { __plays: Play[] }).__plays = plays;
(window as unknown as { __render: typeof render }).__render = render;
let volume = Number(params.get("volume") ?? 70);
let playing: { key: string; n: number; strikes: Strike[] } | null = null;
let playN = 0;
const events = new EventTarget();
const subscribe = (cb: () => void) => { events.addEventListener("change", cb); return () => events.removeEventListener("change", cb); };
let stopTimer: ReturnType<typeof setTimeout> | undefined;
const queue: ReturnType<typeof setTimeout>[] = [];

function play(set: SetId, id: SoundId, length: SoundLength) {
  const r = render(set, id, length);
  const gain = volumeGain(volume);
  let checksum = 0;
  for (let i = 0; i < r.left.length; i += 97) checksum += r.left[i] + r.right[i];
  plays.push({ set, id, length, frames: r.left.length, checksum, gain, at: performance.now() });
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const buffer = audio.createBuffer(2, r.left.length, 48000);
    buffer.copyToChannel(r.left as Float32Array<ArrayBuffer>, 0);
    buffer.copyToChannel(r.right as Float32Array<ArrayBuffer>, 1);
    const source = audio.createBufferSource();
    const g = audio.createGain();
    source.buffer = buffer;
    g.gain.value = gain;
    source.connect(g).connect(audio.destination);
    source.start();
  } catch {
    // No audio output: the emblem still ripples.
  }
  playing = { key: keyOf(set, id, length), n: ++playN, strikes: strikesOf(set, id, length) };
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => { playing = null; events.dispatchEvent(new Event("change")); }, (r.left.length / 48000) * 1000 + 300);
  events.dispatchEvent(new Event("change"));
}
/** Plays a list one after another, each after the previous has ended. */
function playSeq(list: [SetId, SoundId, SoundLength][]) {
  for (const t of queue.splice(0)) clearTimeout(t);
  let at = 0;
  for (const item of list) {
    queue.push(setTimeout(() => play(...item), at));
    at += (render(...item).left.length / 48000) * 1000 + 250;
  }
}
const usePlaying = () => useSyncExternalStore(subscribe, () => playing);

// ---------- Waveform ----------

function Wave({ set, id, length }: { set: SetId; id: SoundId; length: SoundLength }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  useEffect(() => {
    const o = new MutationObserver(() => setTheme(document.documentElement.dataset.theme));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      const c = ref.current;
      if (!c || cancelled) return;
      const r = render(set, id, length);
      const dpr = devicePixelRatio || 1;
      const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
      c.width = w; c.height = h;
      const g = c.getContext("2d")!;
      const css = getComputedStyle(c);
      g.clearRect(0, 0, w, h);
      // Shared time scale: the longest length, so lengths and sets line up.
      const total = LENGTHS.long * 48000;
      g.fillStyle = css.getPropertyValue("--al-axis").trim() || "#888";
      g.fillRect(0, Math.round(h / 2), w, Math.max(1, Math.round(dpr / 2)));
      g.fillStyle = css.color;
      const per = total / w;
      for (let x = 0; x < w; x++) {
        const a = Math.floor(x * per), b = Math.min(r.left.length, Math.floor((x + 1) * per));
        if (a >= r.left.length) break;
        let lo = 0, hi = 0;
        for (let i = a; i < b; i++) { const v = 0.5 * (r.left[i] + r.right[i]); if (v < lo) lo = v; if (v > hi) hi = v; }
        // Scaled to the −3 dBFS ceiling: a full-height trace is at the ceiling.
        const y0 = h / 2 - (hi / 0.708) * (h / 2), y1 = h / 2 - (lo / 0.708) * (h / 2);
        g.fillRect(x, y0, 1, Math.max(dpr, y1 - y0));
      }
      setReady(true);
    };
    const t = setTimeout(draw, 0);
    const ro = new ResizeObserver(() => draw());
    if (ref.current) ro.observe(ref.current);
    return () => { cancelled = true; clearTimeout(t); ro.disconnect(); };
  }, [set, id, length, theme]);
  return <canvas ref={ref} className="al-wave" data-wave={keyOf(set, id, length)} data-ready={ready ? "" : undefined} aria-hidden="true" />;
}

// ---------- Rows ----------

const setName = (s: SetId) => (s === "current" ? T.current : `${s} ${sets.find((x) => x.id === s)!.name}`);

function Cell({ set, id, length }: { set: SetId; id: SoundId; length: SoundLength }) {
  const now = usePlaying();
  const on = now?.key === keyOf(set, id, length);
  return (
    <div className="al-cell" data-set={set} data-playing={on ? "" : undefined}>
      <span className="al-cell-name">{setName(set)}</span>
      <div className="al-cell-body">
        <ControlButton size="row" variant="secondary" presentation="icon" aria-label={`${T.play(setName(set))}: ${text.sounds[id][0]}`} onPress={() => play(set, id, length)} data-testid={`play-${set}-${id}`}>
          <Icon name="run" />
        </ControlButton>
        <Wave set={set} id={id} length={length} />
      </div>
    </div>
  );
}

function Row({ id, set, length }: { id: SoundId; set: Exclude<SetId, "current">; length: SoundLength }) {
  const now = usePlaying();
  const mine = now && now.key.endsWith(`/${id}/${length}`) ? now : null;
  const [name, desc] = text.sounds[id];
  return (
    <li className="al-row" data-sound={id}>
      <div className="al-id">
        <span className="al-emblem"><SoundEmblem id={id} size="strip" play={mine ? { key: mine.n, strikes: mine.strikes } : null} /></span>
        <span className="al-names"><strong>{name}</strong><span>{desc}</span></span>
      </div>
      <Cell set="current" id={id} length={length} />
      <Cell set={set} id={id} length={length} />
      <div className="al-actions">
        <ControlButton size="row" variant="quiet" title={T.compareHelp} onPress={() => playSeq([["current", id, length], [set, id, length]])} data-testid={`compare-${id}`}>
          {T.compare}
        </ControlButton>
        <span className="al-others" role="group" aria-label={T.others}>
          {sets.filter((s) => s.id !== set).map((s) => (
            <ControlButton key={s.id} size="inline" variant="quiet" aria-label={`${T.play(setName(s.id))}: ${name}`} onPress={() => play(s.id, id, length)} data-testid={`other-${s.id}-${id}`}>
              <Icon name="run" />{s.id}
            </ControlButton>
          ))}
        </span>
      </div>
    </li>
  );
}

function App({ direction }: { direction: number }) {
  const set = sets[direction].id;
  const [theme, setTheme] = useState(reviewTheme);
  const [length, setLength] = useState<SoundLength>(params.get("length") === "long" ? "long" : "short");
  const [vol, setVol] = useState(volume);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <div className="al-page" data-direction={direction} data-set={set}>
      <header className="al-bar">
        <div className="al-controls">
          <h1>{T.title}</h1>
          <label>{T.theme}{" "}
            <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
              <option value="light">{T.themes.light}</option>
              <option value="dark">{T.themes.dark}</option>
            </select>
          </label>
          <span className="al-seg" role="group" aria-label={T.length}>{T.length}
            {(["short", "long"] as SoundLength[]).map((l) => (
              <button key={l} type="button" aria-pressed={l === length} data-length={l} onClick={() => setLength(l)}>{T.lengths[l]} {String(LENGTHS[l]).replace(".", ",")} s</button>
            ))}
          </span>
          <label className="al-volume">{T.volume}{" "}
            <input type="range" min={0} max={100} step={5} value={vol} data-testid="volume" onChange={(e) => { volume = Number(e.target.value); setVol(volume); }} />
            <output>{vol} %</output>
          </label>
        </div>
        <p className="al-axis">{T.axis}</p>
        <ol className="al-lines" data-testid="direction-lines">
          {sets.map((s, i) => <li key={s.id} aria-current={i === direction ? "true" : undefined}><strong>{s.id} {s.name}:</strong> {s.line}</li>)}
        </ol>
        <p className="al-reco" data-testid="recommendation">{T.recommend}</p>
      </header>
      <main className="al-main">
        <div className="al-columns">
          <ControlButton size="row" variant="secondary" onPress={() => playSeq(soundIds.map((id) => ["current", id, length]))} data-testid="column-current">
            <Icon name="run" />{T.playColumn(T.current)}
          </ControlButton>
          <ControlButton size="row" variant="secondary" onPress={() => playSeq(soundIds.map((id) => [set, id, length]))} data-testid={`column-${set}`}>
            <Icon name="run" />{T.playColumn(setName(set))}
          </ControlButton>
          <span className="al-faint">{T.unlock}</span>
        </div>
        <ul className="al-rows">
          {soundIds.map((id) => <Row key={id} id={id} set={set} length={length} />)}
        </ul>
      </main>
    </div>
  );
}

const reactRoot = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = { set innerHTML(view: ReactNode) { flushSync(() => reactRoot.render(view === "" ? null : view)); } };
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement("button");
  button.className = "proto-picker-item";
  button.textContent = n.replaceAll(" ", " ");
  if (i === 0) { button.setAttribute("data-active", ""); button.setAttribute("aria-current", "true"); }
  picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);
