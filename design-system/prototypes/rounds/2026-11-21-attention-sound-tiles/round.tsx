import React, {type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton, Segmented} from '../../../../web/src/components/ControlElements';
import {ChoiceMenu} from '../../../../web/src/components/ChoiceMenu';
import {Checkbox} from '../../../../web/src/components/Primitives';
import {ScaleSlider} from '../../../../web/src/components/ScaleSlider';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {type ShownSection, shownSettingsSections} from '../../../../web/src/app/settingsIndex';
import {setPersonalLanguage} from '../../../../web/src/i18n';
// Round 1's sound recipes, unchanged: the placeholders this round draws.
// @ts-expect-error plain ES module without types
import {SOUNDS, renderSound, volumeGain} from '../2026-11-17-attention-sounds/synth.mjs';
import {type Family, type Lang, type Night, SCENARIO_IDS, type Scenario, TEXT} from './text';
import './round.css';

// attention-sound, round 3: Settings › Äänet with the default sound chosen
// from tiles (Jari 21.11.: direction C of round 2, but with "sound-like"
// visuals). Axis: how a tile shows its sound. A draws the sound's own
// envelope, B draws each strike as a ring that spreads while it plays, C
// shows the family's picture and a level meter that follows the loudness.
// Every picture comes from the sound itself: each recipe is rendered through
// an OfflineAudioContext at load, and the envelope, loudness and strike
// onsets are read from that render. The rest of the section is the same in
// all three: on by default, events, the personal "conversation you are
// looking at" rule, "Hiljennä yöllä" with what counts as night, this
// device's mute and volume, the browser's autoplay gate and the read error.

const NAMES = ['A Aaltomuoto', 'B Renkaat', 'C Kuva ja taso'];
type Kind = 'wave' | 'rings' | 'picture';
const KINDS: Kind[] = ['wave', 'rings', 'picture'];
let lang: Lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];

type Voice = {at: number; amp?: number; f: number; decay?: number; modes?: [number, number, number][]};
type Sound = {id: string; family: Family; dur: number; voices: Voice[]};
const ALL: Sound[] = SOUNDS;
const FAMILIES: Family[] = ['A', 'B', 'C'];
const name = (id: string) => t().sounds[id][0];
const DEFAULT_SOUND = 'c1';

// ---- The Sounds section in production's own section list ----
for (const l of ['fi', 'en'] as const) {
  const list = shownSettingsSections(l) as ShownSection[];
  const x = TEXT[l];
  const at = list.findIndex((s) => s.id === 'ulkoasu') + 1;
  list.splice(at, 0, {
    id: 'aanet' as ShownSection['id'], label: x.section, icon: 'music', kw: x.sectionKw,
    rows: [
      {id: 'attention-sound', label: x.on, kw: x.sectionKw, desc: x.onDesc},
      {id: 'attention-sound-default', label: x.sound, kw: [], desc: x.soundDesc},
      {id: 'attention-sound-night', label: x.night, kw: ['yö', 'night', 'hiljaiset tunnit', 'quiet hours'], desc: x.nightDesc},
      {id: 'attention-sound-device', label: x.device, kw: ['mykistä', 'mute', 'voimakkuus', 'volume'], desc: x.deviceDesc},
    ],
  } as ShownSection);
}

// ---- What each tile draws, read from an offline render ----
const SR = 48000, SPAN = 1.0, BINS = 72, FRAME = 0.016;
type Analysis = {dur: number; env: number[]; rms: number[]; strikes: {at: number; amp: number; ring: number}[]};
const analysis: Record<string, Analysis> = {};
declare global { interface Window { __rqPlays: {sound: string; volume: number; why: string}[]; __rqAnalysed: number; __rqSim: {inView: boolean; played: boolean; why?: string}[] } }
window.__rqPlays = []; window.__rqAnalysed = 0; window.__rqSim = [];
async function analyse(s: Sound): Promise<Analysis> {
  const samples: Float32Array = renderSound(s, SR);
  const off = new OfflineAudioContext(1, samples.length, SR);
  const buffer = off.createBuffer(1, samples.length, SR);
  buffer.copyToChannel(samples, 0);
  const src = off.createBufferSource();
  src.buffer = buffer; src.connect(off.destination); src.start();
  const out = (await off.startRendering()).getChannelData(0);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  // Envelope: the peak per bin over one second, so every sound shares one time scale.
  const per = SR * SPAN / BINS, env: number[] = [];
  for (let b = 0; b < BINS; b++) {
    let m = 0;
    for (let i = Math.floor(b * per); i < Math.min(out.length, Math.floor((b + 1) * per)); i++) m = Math.max(m, Math.abs(out[i]));
    env.push(peak ? m / peak : 0);
  }
  // Loudness for the level meter: RMS per 16 ms frame, scaled to the sound's own loudest frame.
  const n = Math.round(FRAME * SR), rms: number[] = [];
  for (let i = 0; i < out.length; i += n) {
    let sum = 0;
    for (let j = i; j < Math.min(out.length, i + n); j++) sum += out[j] * out[j];
    rms.push(Math.sqrt(sum / n));
  }
  const top = Math.max(...rms) || 1;
  // Strikes for the rings: each voice's onset, its strength and how long it rings.
  const strikes = s.voices.map((v) => ({
    at: v.at, amp: v.amp ?? 1,
    ring: v.modes ? Math.max(...v.modes.map((m) => m[2])) : (v.decay ?? 0.25),
  }));
  return {dur: s.dur, env, rms: rms.map((r) => r / top), strikes};
}

// ---- State: personal (the person's file), this device, and the review ----
type Host = {
  on: boolean; sound: string; done: boolean; asks: boolean; inViewQuiet: boolean;
  night: boolean; rhythm: Night; deviceDark: boolean; hour: number;
  muted: boolean; volume: number; blocked: boolean; allowedNow: boolean; readError: boolean;
};
const base: Host = {
  on: true, sound: DEFAULT_SOUND, done: true, asks: true, inViewQuiet: true,
  night: true, rhythm: 'device', deviceDark: false, hour: 14,
  muted: false, volume: 70, blocked: false, allowedNow: false, readError: false,
};
const SCENARIOS: Record<Scenario, () => Host> = {
  oletus: () => ({...base}),
  yo: () => ({...base, deviceDark: true, hour: 23}),
  'aina-tumma': () => ({...base, deviceDark: true, hour: 13}),
  pois: () => ({...base, on: false}),
  mykistetty: () => ({...base, muted: true}),
  estetty: () => ({...base, blocked: true}),
  lukuvirhe: () => ({...base, readError: true}),
};
let scenario: Scenario = (new URLSearchParams(location.search).get('s') as Scenario) ?? 'oletus';
if (!SCENARIOS[scenario]) scenario = 'oletus';
let host: Host = SCENARIOS[scenario]();
type Playing = {id: string; t0: number; n: number} | null;
let playing: Playing = null, playCount = 0;
let reducedReview = new URLSearchParams(location.search).get('motion') === 'reduced';
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reducedReview || reducedQuery.matches;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
const set = (next: Partial<Host>) => { host = {...host, ...next}; notify(); };
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const isNight = (h = host) => h.rhythm === 'device' ? h.deviceDark : h.hour >= 22 || h.hour < 7;
const nightNow = (h = host) => h.night && isNight(h);
// A device that is dark at midday is probably dark all the time.
const looksAlwaysDark = (h = host) => h.night && h.rhythm === 'device' && h.deviceDark && h.hour >= 9 && h.hour < 17;

let audio: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let playTimer: ReturnType<typeof setTimeout> | undefined;
function play(id: string, why: string) {
  window.__rqPlays.push({sound: id, volume: host.volume, why});
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const key = `${id}@${audio.sampleRate}`;
    if (!buffers.has(key)) {
      const samples: Float32Array = renderSound(ALL.find((s) => s.id === id), audio.sampleRate);
      const b = audio.createBuffer(1, samples.length, audio.sampleRate);
      b.copyToChannel(samples, 0);
      buffers.set(key, b);
    }
    const src = audio.createBufferSource(), g = audio.createGain();
    src.buffer = buffers.get(key)!;
    g.gain.value = volumeGain(host.volume, false);
    src.connect(g).connect(audio.destination);
    src.start();
  } catch { /* no audio device: the tile still shows the play */ }
  playing = {id, t0: performance.now(), n: ++playCount};
  clearTimeout(playTimer);
  const dur = ALL.find((s) => s.id === id)!.dur;
  playTimer = setTimeout(() => { playing = null; notify(); }, Math.max(700, dur * 1000 + 120));
  notify();
}
let toast: (s: string) => void = () => {};
/** An explicit press: plays even when off, muted or at night, and it is the
 * press that unlocks the browser's sound. */
const listen = (id: string) => { play(id, 'press'); toast(t().played(name(id))); if (host.blocked) set({blocked: false, allowedNow: true}); };
/** The review's "agent finished": the rules the app layer would apply. */
function simulate(inView: boolean) {
  const x = t(), h = host;
  const why = !h.on ? x.why.off : !h.done ? x.why.event : h.muted ? x.why.muted : nightNow(h) ? x.why.night
    : inView && h.inViewQuiet ? x.why.inView : h.blocked ? x.why.blocked : undefined;
  window.__rqSim.push({inView, played: !why, why});
  if (why) { toast(x.simSilent(why)); return; }
  play(h.sound, 'agent'); toast(x.simPlayed(name(h.sound)));
}

// ---- Tile pictures ----
/** Runs a frame loop while this tile plays; `draw(progress)` writes to the DOM directly. */
function useFrames(active: boolean, n: number, dur: number, draw: (p: number, elapsed: number) => void) {
  useEffect(() => {
    if (!active || reduced()) { draw(active ? 1 : 0, active ? dur : 0); return; }
    let raf = 0;
    const t0 = playing?.t0 ?? performance.now();
    const step = () => {
      const e = (performance.now() - t0) / 1000;
      draw(Math.min(1, e / dur), e);
      if (e < dur) raf = requestAnimationFrame(step);
    };
    step();
    return () => { cancelAnimationFrame(raf); draw(0, 0); };
  }, [active, n]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** A: the envelope, mirrored about a time axis; one second spans the width. */
function Wave({id, active, n}: {id: string; active: boolean; n: number}) {
  const a = analysis[id];
  const clip = useRef<SVGRectElement>(null), head = useRef<SVGLineElement>(null);
  const span = a ? a.dur / SPAN : 1;
  useFrames(active, n, a?.dur ?? 1, (p) => {
    const x = p * span * BINS;
    clip.current?.setAttribute('width', String(x));
    if (head.current) { head.current.setAttribute('x1', String(x)); head.current.setAttribute('x2', String(x)); head.current.style.opacity = active && p < 1 && !reduced() ? '1' : '0'; }
  });
  if (!a) return <svg className="rq-wave" viewBox={`0 0 ${BINS} 40`} aria-hidden="true" />;
  // A gentle power curve keeps quiet tails visible beside the loud strike.
  const ys = a.env.map((v) => Math.pow(v, 0.6) * 17);
  const top = ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${i + 0.5} ${(20 - y).toFixed(2)}`).join(' ');
  const bottom = ys.map((y, i) => `L${BINS - i - 0.5} ${(20 + ys[BINS - 1 - i]).toFixed(2)}`).join(' ');
  const d = `${top} ${bottom} Z`;
  return (
    <svg className="rq-wave" viewBox={`0 0 ${BINS} 40`} preserveAspectRatio="none" aria-hidden="true">
      <defs><clipPath id={`rq-clip-${id}`}><rect ref={clip} x="0" y="0" width="0" height="40" /></clipPath></defs>
      <line className="rq-wave-axis" x1="0" x2={BINS} y1="20" y2="20" />
      <path className="rq-wave-base" d={d} />
      <path className="rq-wave-fill" d={d} clipPath={`url(#rq-clip-${id})`} />
      <line ref={head} className="rq-wave-head" x1="0" x2="0" y1="1" y2="39" style={{opacity: 0}} />
    </svg>
  );
}

/** B: each strike a ring around a dot, nearest ring first; a ring that rings
 * longer gets a soft halo. While it plays, each strike spreads at its own onset. */
function Rings({id, active, n}: {id: string; active: boolean; n: number}) {
  const a = analysis[id];
  if (!a) return <svg className="rq-rings" viewBox="-32 -32 64 64" aria-hidden="true" />;
  const motion = active && !reduced();
  return (
    <svg className="rq-rings" viewBox="-32 -32 64 64" aria-hidden="true" data-active={active || undefined}>
      {a.strikes.map((s, i) => {
        const r = 10 + i * 5 + s.at * 30;
        return (
          <g key={i}>
            {s.ring > 0.25 ? <circle className="rq-ring-halo" r={r + 3.5} /> : null}
            <circle className="rq-ring" r={r} style={{strokeWidth: 1 + s.amp * 1.4}} />
          </g>
        );
      })}
      <circle className="rq-ring-dot" r={a.strikes.length > 2 ? 4 : 5} />
      {motion ? (
        <g key={n}>
          {a.strikes.map((s, i) => (
            <circle key={i} className="rq-ripple" r="30"
              style={{animationDelay: `${s.at}s`, animationDuration: `${Math.min(1.3, Math.max(0.45, s.ring * 2.6))}s`, opacity: 0, ['--amp' as string]: String(0.45 + s.amp * 0.55)}} />
          ))}
        </g>
      ) : null}
    </svg>
  );
}

/** C: the family's picture. Decoration; the tile's name says the sound. */
function FamilyPicture({family}: {family: Family}) {
  return (
    <span className="rq-pic" data-family={family} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        {family === 'A' ? <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 21a2 2 0 0 0 4 0" /><path d="M12 3V5" /></>
          : family === 'B' ? <><path d="M7.5 3h9l-1.2 7.2a3.4 3.4 0 0 1-6.6 0z" /><path d="M12 13.6V20M8.5 20.5h7" /><path d="M19 9.5c1 .8 1.6 2 1.6 3.3M4 9.5c-1 .8-1.6 2-1.6 3.3" /></>
            : <><path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" /><path d="M8.5 19.5a6.5 6.5 0 0 1 13 0" /><circle cx="12" cy="5.5" r="2.4" /></>}
      </svg>
    </span>
  );
}
const SEGMENTS = 14;
function Meter({id, active, n}: {id: string; active: boolean; n: number}) {
  const a = analysis[id];
  const el = useRef<HTMLSpanElement>(null);
  useFrames(active, n, a?.dur ?? 1, (_p, e) => {
    const box = el.current;
    if (!box || !a) return;
    // Reduced motion: a still bar at the sound's typical level while it plays.
    const lvl = !active ? 0 : reduced() ? 0.7 : a.rms[Math.min(a.rms.length - 1, Math.floor(e / FRAME))] ?? 0;
    const k = Math.round(Math.pow(lvl, 0.5) * SEGMENTS);
    Array.from(box.children).forEach((c, i) => { (c as HTMLElement).dataset.on = i < k ? 'true' : 'false'; });
  });
  return <span className="rq-meter" ref={el} aria-hidden="true">{Array.from({length: SEGMENTS}, (_, i) => <i key={i} data-on="false" />)}</span>;
}

function usePlay(id: string) {
  useStore();
  return {active: playing?.id === id, n: playing?.id === id ? playing.n : 0};
}
function Tile({s, kind, off}: {s: Sound; kind: Kind; off: boolean}) {
  const h = useStore(), x = t(), {active, n} = usePlay(s.id);
  const selected = h.sound === s.id;
  const [nm, desc] = x.sounds[s.id];
  const secs = x.secs(s.dur);
  const state = active ? <span className="rq-tile-state" data-state="playing"><Icon name="music" />{x.playing}</span>
    : selected ? <span className="rq-tile-state" data-state="selected"><Icon name="check" />{x.selected}</span> : null;
  return (
    <button type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1} disabled={off}
      aria-label={x.tileLabel(nm, desc, secs)} data-testid={`pick-${s.id}`} data-sound={s.id}
      data-playing={active || undefined} className={`rq-tile rq-tile-${kind}`}
      onClick={() => { set({sound: s.id}); listen(s.id); }}>
      {kind === 'wave' ? (
        <>
          <span className="rq-tile-head"><span className="rq-tile-name">{nm}</span><span className="rq-secs">{secs}</span></span>
          <Wave id={s.id} active={active} n={n} />
          <span className="rq-tile-foot">{state}</span>
        </>
      ) : kind === 'rings' ? (
        <>
          <Rings id={s.id} active={active} n={n} />
          <span className="rq-tile-text">
            <span className="rq-tile-name">{nm}</span>
            <span className="rq-tile-foot"><span className="rq-secs">{secs}</span>{state}</span>
          </span>
        </>
      ) : (
        <>
          <span className="rq-tile-head"><FamilyPicture family={s.family} />{state}</span>
          <span className="rq-tile-name">{nm}</span>
          <span className="rq-tile-desc">{desc}</span>
          <Meter id={s.id} active={active} n={n} />
        </>
      )}
    </button>
  );
}
function Tiles({kind}: {kind: Kind}) {
  const h = useStore(), x = t();
  const off = !h.on || h.readError;
  const onKey = (e: KeyboardEvent) => {
    const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
    const i = ALL.findIndex((s) => s.id === h.sound);
    const next = step ? (i + step + ALL.length) % ALL.length : e.key === 'Home' ? 0 : e.key === 'End' ? ALL.length - 1 : -1;
    if (next < 0 || off) return;
    // The review picker also listens for arrows on the document; inside the
    // tiles they belong to the radio group.
    e.preventDefault(); e.stopPropagation();
    const id = ALL[next].id;
    set({sound: id}); listen(id);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="pick-${id}"]`)?.focus());
  };
  return (
    <div role="radiogroup" aria-label={x.sound} className={`rq-tiles rq-tiles-${kind}`} data-testid="sound-tiles"
      data-settings-row="attention-sound-default" onKeyDown={onKey}>
      {FAMILIES.map((f) => (
        <div key={f} className="rq-family" data-family={f}>
          <span className="rq-family-name" aria-hidden="true">{x.families[f]}</span>
          <div className="rq-family-tiles">
            {ALL.filter((s) => s.family === f).map((s) => <Tile key={s.id} s={s} kind={kind} off={off} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Rows (production s-card/s-row with production controls) ----
const OFF = {state: 'disabled', reason: ' '} as const;
function OnRow() {
  const h = useStore(), x = t();
  return (
    <div className="s-row" data-settings-row="attention-sound" tabIndex={-1}>
      <div className="s-lbl"><strong>{x.on}</strong><span className="s-desc">{x.onDesc}</span></div>
      <div className="s-val">
        <Segmented size="row" data-testid="sound-on" label={x.on} isDisabled={h.readError}
          options={[{id: 'off', label: x.off}, {id: 'on', label: x.onLabel}]}
          value={h.readError ? undefined : h.on ? 'on' : 'off'} onChange={(v) => set({on: v === 'on'})} />
      </div>
    </div>
  );
}
function WhenRows() {
  const h = useStore(), x = t();
  const off = !h.on || h.readError;
  const nightOff = off || !h.night;
  const status = !h.night ? null : nightNow(h) ? (h.rhythm === 'device' ? x.nowNightDevice : x.nowNightClock) : x.nowDay;
  return (
    <>
      <div className="s-row rq-events" data-testid="sound-events">
        <div className="s-lbl"><strong>{x.events}</strong></div>
        <div className="rq-checks">
          <Checkbox data-testid="event-done" label={x.eventDone} checked={h.done} availability={off ? OFF : undefined} onChange={(v) => set({done: v})} />
          <Checkbox data-testid="event-asks" label={x.eventAsks} checked={h.asks} availability={off ? OFF : undefined} onChange={(v) => set({asks: v})} />
        </div>
      </div>
      <div className="s-row" data-testid="in-view-row">
        <div className="s-lbl"><strong>{x.inView}</strong><span className="s-desc">{x.inViewDesc}</span></div>
        <div className="s-val">
          <Segmented size="row" data-testid="in-view" label={x.inView} isDisabled={off}
            options={[{id: 'quiet', label: x.inViewQuiet}, {id: 'plays', label: x.inViewPlays}]}
            value={h.inViewQuiet ? 'quiet' : 'plays'} onChange={(v) => set({inViewQuiet: v === 'quiet'})} />
        </div>
      </div>
      <div className="s-row" data-settings-row="attention-sound-night" tabIndex={-1}>
        <div className="s-lbl"><strong>{x.night}</strong><span className="s-desc">{x.nightDesc}</span></div>
        <div className="s-val">
          <Segmented size="row" data-testid="night" label={x.night} isDisabled={off}
            options={[{id: 'off', label: x.off}, {id: 'on', label: x.onLabel}]}
            value={h.night ? 'on' : 'off'} onChange={(v) => set({night: v === 'on'})} />
        </div>
      </div>
      <div className="s-row rq-rhythm" data-testid="night-rhythm-row">
        <div className="s-lbl"><strong>{x.nightRhythm}</strong><span className="s-desc">{x.nightOpts[h.rhythm][1]}</span></div>
        <div className="s-val">
          <ChoiceMenu data-testid="night-rhythm" label={x.nightRhythm} value={h.rhythm} isDisabled={nightOff}
            options={(['device', 'clock'] as Night[]).map((id) => ({id, label: x.nightOpts[id][0], description: x.nightOpts[id][1]}))}
            onChange={(v) => set({rhythm: v})} />
        </div>
      </div>
      {status && !off ? (
        <div className="rq-notes">
          <p className="rq-now" data-testid="night-now" data-night={nightNow(h) || undefined}>
            <Icon name={nightNow(h) ? 'moon' : 'sun'} />{status}
          </p>
          {looksAlwaysDark(h) ? (
            <p className="rq-note" data-testid="note-always-dark"><Icon name="info" />
              <span>{x.alwaysDark} <button type="button" className="rq-link" data-testid="use-clock" onClick={() => set({rhythm: 'clock'})}>{x.useClock}</button></span>
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
function Notes() {
  const h = useStore(), x = t();
  return (
    <>
      {h.blocked ? <p className="rq-note" role="status" data-testid="note-blocked"><Icon name="warning" />{x.blockedNote}</p> : null}
      {h.allowedNow ? <p className="rq-note rq-ok" role="status" data-testid="note-allowed"><Icon name="check" />{x.allowedNote}</p> : null}
      {(h.on || h.readError) && h.muted ? <p className="rq-note" data-testid="note-muted"><Icon name="slash" />{x.mutedNote}</p> : null}
      {h.on && !h.readError && !h.muted && nightNow(h) ? <p className="rq-note" data-testid="note-night"><Icon name="moon" />{x.nightNote}</p> : null}
      {!h.on && !h.readError ? <p className="rq-note" data-testid="note-off"><Icon name="slash" />{x.offNote}</p> : null}
    </>
  );
}
function DeviceRows() {
  const h = useStore(), x = t();
  return (
    <>
      <div className="s-row" data-settings-row="attention-sound-device" tabIndex={-1}>
        <div className="s-lbl"><strong>{x.mute}</strong><span className="s-desc">{x.muteDesc}</span></div>
        <div className="s-val">
          <Segmented size="row" data-testid="device-mute" label={x.mute}
            options={[{id: 'plays', label: x.plays}, {id: 'muted', label: x.muted}]}
            value={h.muted ? 'muted' : 'plays'} onChange={(v) => set({muted: v === 'muted'})} />
        </div>
      </div>
      <div className="s-row rq-volume">
        <div className="s-lbl"><strong>{x.volume}</strong></div>
        <div className="s-val">
          <ScaleSlider testId="device-volume" label={x.volume} value={h.volume} stops={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            format={(v) => `${v} %`} disabled={h.muted} onChange={(v) => set({volume: v})} />
          <ControlButton data-testid="sound-test" size="row" variant="secondary" onPress={() => listen(h.sound)}>
            <Icon name="run" />{x.test}
          </ControlButton>
        </div>
      </div>
      <div className="rq-notes"><Notes /></div>
    </>
  );
}
function ReadError() {
  const x = t();
  return (
    <div className="s-card">
      <div className="s-row ex-alert">
        <p role="alert" data-testid="sound-read-error">{x.readError}</p>
        <ControlButton data-testid="sound-read-error-reload" size="row" onPress={() => set({readError: false})}>{x.reload}</ControlButton>
      </div>
    </div>
  );
}
function Body({direction}: {direction: number}) {
  const h = useStore(), x = t();
  const kind = KINDS[direction];
  return (
    <div className={`s-stack rq-body rq-dir-${kind}`} data-testid={`direction-${kind}`}>
      <p className="s-intro">{x.intro}</p>
      {h.readError ? <ReadError /> : null}
      <div className="s-card"><OnRow /></div>
      <h3 className="s-h3 rq-h3">{x.sound}<span className="rq-placeholder" data-testid="placeholder-tag">{x.placeholder}</span></h3>
      <p className="s-desc rq-lead">{x.soundDesc}</p>
      <Tiles kind={kind} />
      <h3 className="s-h3">{x.when}</h3>
      <div className="s-card"><WhenRows /></div>
      <h3 className="s-h3">{x.device}</h3>
      <div className="s-card"><p className="s-desc rq-pad">{x.deviceDesc}</p><DeviceRows /></div>
    </div>
  );
}

// ---- The page ----
function useMain() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const id = setInterval(() => {
      const main = document.querySelector<HTMLElement>('.s-main');
      if (!main) return;
      let slot = main.querySelector<HTMLElement>(':scope > .rq-section');
      if (!slot) { slot = document.createElement('div'); slot.className = 'rq-section'; main.insertBefore(slot, main.querySelector(':scope > .s-version-line')); }
      setEl(slot); clearInterval(id);
    }, 10);
    return () => clearInterval(id);
  }, []);
  return el;
}
function Page({direction}: {direction: number}) {
  const slot = useMain();
  const rail = (
    <WorkspaceRail>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  const main = (
    <div className="ah-settings-layer">
      <div className="ah-state">
        <AccountSettings routeSection="aanet" onNavigate={() => {}}
          profile={{name: 'Aino Esimerkki', email: '', avatar_url: ''}} csrf="prototype"
          nativeState="connected" nativeLogin="aino-esimerkki" onReconnect={() => {}}
          workspaces={[]} onClose={() => {}} />
      </div>
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={t().section} rail={rail} main={main} />
      {slot ? createPortal(<Body direction={direction} />, slot) : null}
    </StatusBellProvider>
  );
}

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};

const themeParam = new URLSearchParams(location.search).get('theme');
let reviewTheme = themeParam === 'dark' || themeParam === 'contrast' ? themeParam : 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [motion, setMotion] = useState(reducedReview ? 'reduced' : 'full');
  const [language, setLanguage] = useState(lang);
  const [s, setS] = useState(scenario);
  const [generation, setGeneration] = useState(0);
  const [note, setNote] = useState('');
  const bar = useRef<HTMLElement>(null);
  const x = TEXT[language];
  toast = setNote;
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  }, [theme]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { reducedReview = motion === 'reduced'; document.documentElement.dataset.motion = motion; notify(); }, [motion]);
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 2600); return () => clearTimeout(id); }, [note]);
  const reset = (next = s) => { scenario = next; host = SCENARIOS[next](); playing = null; setS(next); setNote(''); setGeneration((n) => n + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option><option value="contrast">{x.contrast}</option></select></label>
        <label>{x.motion} <select id="motion" value={motion} onChange={(e) => setMotion(e.target.value)}>
          <option value="full">{x.motionFull}</option><option value="reduced">{x.motionReduced}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); reset();
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => reset()}>{x.reset}</button>
        <span className="rq-sim">{x.simulate}
          <button type="button" data-testid="sim-other" onClick={() => simulate(false)}>{x.simOther}</button>
          <button type="button" data-testid="sim-in-view" onClick={() => simulate(true)}>{x.simInView}</button>
        </span>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${s}-${language}`} enabled={false}>
          <MemoryRouter key={`${generation}-${s}-${language}`} initialEntries={['/settings/aanet']}>
            <Page direction={direction} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {note ? <p className="rq-toast" role="status" data-testid="rq-toast">{note}</p> : null}
    </div>
  );
}

void Promise.all(ALL.map(async (s) => { analysis[s.id] = await analyse(s); window.__rqAnalysed++; notify(); }));

const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { host = SCENARIOS[scenario](); playing = null; flushSync(() => reactRoot.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
