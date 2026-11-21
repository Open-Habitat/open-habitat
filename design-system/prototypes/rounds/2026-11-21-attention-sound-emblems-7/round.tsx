import React, {type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton, IconButton, Segmented} from '../../../../web/src/components/ControlElements';
import {ChoiceMenu} from '../../../../web/src/components/ChoiceMenu';
import {ScaleSlider} from '../../../../web/src/components/ScaleSlider';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {type ShownSection, shownSettingsSections} from '../../../../web/src/app/settingsIndex';
import {setPersonalLanguage} from '../../../../web/src/i18n';
// Round 5's final sounds, unchanged: both lengths of each recipe.
// @ts-expect-error plain ES module without types
import {SOUNDS as SYNTH, SAMPLE_RATE, renderSound, volumeGain} from '../2026-11-21-attention-sounds-4/synth.mjs';
import {EmblemSvg, RECOMMENDED, type Strike, TRIO, VARIANTS} from './emblems';
import {type Lang, type Length, SCENARIO_IDS, SOUND_IDS, type Scenario, type SoundId, TEXT} from './text';
import './round.css';

// attention-sound, round 7: Jari chose round 6's B Väreilyn muoto (no
// picture, the rings' shape tells the object) and asked for three variants of
// every emblem, each trio following a stated idea, with the boldest
// alternatives for Kalimba and Kulho. The first view is the ten sounds as rows
// of the current emblem and its three variants, each playable at tile and
// workspace-row size; a radio on each puts it into the second view, round 6's
// Settings › Äänet with the tiles, so the chosen set can be compared where it
// will live. Sounds are round 5's, unchanged; Lyhyet is the default length.

const NAMES = ['Vertailurivit', 'Asetuksissa'];
let lang: Lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const name = (id: SoundId) => t().sounds[id][0];
const DEFAULT_SOUND: SoundId = 'kalimba';

type Variant = {dur: number; voices: {at: number; amp?: number}[]};
type Synth = {id: string; variants: Record<Length, Variant>};
const RECIPES = Object.fromEntries((SYNTH as Synth[]).filter((s) => (SOUND_IDS as readonly string[]).includes(s.id)).map((s) => [s.id, s.variants])) as Record<SoundId, Record<Length, Variant>>;
if (Object.keys(RECIPES).length !== 10) throw new Error('round 5 no longer has the ten sounds');
/** A strike per voice: its onset in the chosen length, strength, and how long its ripple runs. */
const strikesOf = (id: SoundId, len: Length): Strike[] => {
  const v = RECIPES[id][len];
  return v.voices.map((x) => ({at: x.at, amp: x.amp ?? 1, ring: Math.max(0.5, (v.dur - x.at) * (len === 'short' ? 1.1 : 0.85))}));
};

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
      {id: 'attention-sound-length', label: x.length, kw: ['lyhyt', 'pitkä', 'short', 'long'], desc: x.lengthDesc},
      {id: 'attention-sound-night', label: x.night, kw: ['yö', 'night'], desc: x.nightDesc},
      {id: 'attention-sound-repos', label: x.repos, kw: ['työtila', 'workspace', 'repository'], desc: x.reposDesc},
      {id: 'attention-sound-device', label: x.device, kw: ['mykistä', 'mute', 'voimakkuus', 'volume'], desc: x.deviceDesc},
    ],
  } as ShownSection);
}

// ---- State: personal (the person's file), this device, and the review ----
const REPOS = ['aurinkokello', 'kotisivu', 'muistiinpanot'] as const;
type Repo = typeof REPOS[number];
type Host = {
  on: boolean; sound: SoundId; length: Length; inViewQuiet: boolean; night: boolean; deviceDark: boolean;
  repos: Record<Repo, SoundId | 'default'>; muted: boolean; volume: number;
};
const base: Host = {
  on: true, sound: DEFAULT_SOUND, length: 'short', inViewQuiet: true, night: true, deviceDark: false,
  repos: {aurinkokello: 'default', kotisivu: 'pisara', muistiinpanot: 'default'}, muted: false, volume: 70,
};
const SCENARIOS: Record<Scenario, () => Host> = {
  oletus: () => ({...base, repos: {...base.repos}}),
  pitkat: () => ({...base, repos: {...base.repos}, length: 'long'}),
  yo: () => ({...base, repos: {...base.repos}, deviceDark: true}),
  pois: () => ({...base, repos: {...base.repos}, on: false}),
  mykistetty: () => ({...base, repos: {...base.repos}, muted: true}),
};
let scenario: Scenario = (new URLSearchParams(location.search).get('s') as Scenario) ?? 'oletus';
if (!SCENARIOS[scenario]) scenario = 'oletus';
let host: Host = SCENARIOS[scenario]();
type Playing = {id: SoundId; where: string; len: Length; n: number} | null;
let playing: Playing = null, playCount = 0;
/** Which variant of each emblem goes into the Settings view: `?valinta=` ten digits 0–3, else the recommendation. */
const pickParam = new URLSearchParams(location.search).get('valinta') ?? '';
let picks = Object.fromEntries(SOUND_IDS.map((id, k) => [id, /^[0-3]{10}$/.test(pickParam) ? +pickParam[k] : RECOMMENDED[id]])) as Record<SoundId, number>;
const setPicks = (next: Partial<Record<SoundId, number>>) => { picks = {...picks, ...next}; notify(); };
let reducedReview = new URLSearchParams(location.search).get('motion') === 'reduced';
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reducedReview || reducedQuery.matches;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const set = (next: Partial<Host>) => { host = {...host, ...next}; notify(); };
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const fn = () => tick((x) => x + 1); listeners.add(fn); return () => { listeners.delete(fn); }; }, []);
  return host;
}
const nightNow = (h = host) => h.night && h.deviceDark;
const repoSound = (r: Repo, h = host): SoundId => h.repos[r] === 'default' ? h.sound : h.repos[r] as SoundId;

declare global { interface Window { __rqPlays: {sound: string; length: Length; dur: number; samples: number; volume: number; why: string}[]; __rqSim: {where: string; played: boolean; sound?: string; why?: string}[] } }
window.__rqPlays = []; window.__rqSim = [];
let audio: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let playTimer: ReturnType<typeof setTimeout> | undefined;
/** Plays the chosen length of a sound through one gain node at this device's volume. */
function play(id: SoundId, why: string, where = 'tiles') {
  const len = host.length, v = RECIPES[id][len];
  let samples = 0;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const key = `${id}/${len}`;
    if (!buffers.has(key)) {
      const r = renderSound(v) as {left: Float32Array; right: Float32Array};
      const b = audio.createBuffer(2, r.left.length, SAMPLE_RATE);
      b.copyToChannel(r.left, 0); b.copyToChannel(r.right, 1);
      buffers.set(key, b);
    }
    const src = audio.createBufferSource(), g = audio.createGain();
    src.buffer = buffers.get(key)!;
    samples = src.buffer.length;
    g.gain.value = volumeGain(host.volume, false);
    src.connect(g).connect(audio.destination);
    src.start();
  } catch { /* no audio device: the tile still shows the play */ }
  window.__rqPlays.push({sound: id, length: len, dur: v.dur, samples, volume: host.volume, why});
  playing = {id, where, len, n: ++playCount};
  clearTimeout(playTimer);
  playTimer = setTimeout(() => { playing = null; notify(); }, v.dur * 1000 + 450);
  notify();
}
let toast: (s: string) => void = () => {};
/** An explicit press: plays even when off, muted or at night. */
const listen = (id: SoundId, where = 'tiles') => { play(id, 'press', where); toast(t().played(name(id), t().lengthOne[host.length])); };
/** The review's "agent finished": the rules the app layer would apply. */
function simulate(where: 'other' | 'repo' | 'inView') {
  const x = t(), h = host;
  const why = !h.on ? x.why.off : h.muted ? x.why.muted : nightNow(h) ? x.why.night : where === 'inView' && h.inViewQuiet ? x.why.inView : undefined;
  const sound = where === 'repo' ? repoSound('kotisivu') : repoSound('aurinkokello');
  window.__rqSim.push({where, played: !why, sound: why ? undefined : sound, why});
  if (why) { toast(x.simSilent(why)); return; }
  play(sound, 'agent', where === 'repo' ? 'repo-kotisivu' : 'tiles'); toast(x.simPlayed(name(sound), x.lengthOne[h.length]));
}

// ---- Tiles ----
function usePlay(id: SoundId, where = 'tiles') {
  useStore();
  const on = playing?.id === id && playing.where === where;
  return on && playing ? {active: true, play: reduced() ? null : {key: playing.n, strikes: strikesOf(id, playing.len)}} : {active: false, play: null};
}
function Tile({id, off}: {id: SoundId; off: boolean}) {
  const h = useStore(), x = t(), {active, play: p} = usePlay(id);
  const selected = h.sound === id;
  const [nm, desc] = x.sounds[id];
  const secs = x.secs(RECIPES[id][h.length].dur);
  const state = active ? <span className="rq-tile-state" data-state="playing"><Icon name="music" />{x.playing}</span>
    : selected ? <span className="rq-tile-state" data-state="selected"><Icon name="check" />{x.selected}</span> : null;
  return (
    <button type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1} disabled={off}
      aria-label={x.tileLabel(nm, desc, secs)} data-testid={`pick-${id}`} data-sound={id}
      data-playing={active || undefined} className="rq-tile"
      onClick={() => { set({sound: id}); listen(id); }}>
      <EmblemSvg id={id} v={picks[id]} play={p} />
      <span className="rq-tile-text">
        <span className="rq-tile-name">{nm}</span>
        <span className="rq-tile-foot"><span className="rq-secs" data-testid={`secs-${id}`}>{secs}</span>{state}</span>
      </span>
    </button>
  );
}
function Tiles() {
  const h = useStore(), x = t();
  const off = !h.on;
  const onKey = (e: KeyboardEvent) => {
    const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
    const i = SOUND_IDS.indexOf(h.sound);
    const next = step ? (i + step + SOUND_IDS.length) % SOUND_IDS.length : e.key === 'Home' ? 0 : e.key === 'End' ? SOUND_IDS.length - 1 : -1;
    if (next < 0 || off) return;
    // The review picker also listens for arrows on the document; inside the tiles they belong to the radio group.
    e.preventDefault(); e.stopPropagation();
    const id = SOUND_IDS[next];
    set({sound: id}); listen(id);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="pick-${id}"]`)?.focus());
  };
  return (
    <div role="radiogroup" aria-label={x.sound} className="rq-tiles" data-testid="sound-tiles"
      data-settings-row="attention-sound-default" onKeyDown={onKey}>
      {SOUND_IDS.map((id) => <Tile key={id} id={id} off={off} />)}
    </div>
  );
}

// ---- Rows (production s-card/s-row with production controls) ----
function Row({id, label, desc, children, testid}: {id?: string; label: string; desc?: string; children: ReactNode; testid?: string}) {
  return (
    <div className="s-row" data-settings-row={id} data-testid={testid} tabIndex={id ? -1 : undefined}>
      <div className="s-lbl"><strong>{label}</strong>{desc ? <span className="s-desc">{desc}</span> : null}</div>
      <div className="s-val">{children}</div>
    </div>
  );
}
function OnRow() {
  const h = useStore(), x = t();
  return (
    <Row id="attention-sound" label={x.on} desc={x.onDesc}>
      <Segmented size="row" data-testid="sound-on" label={x.on}
        options={[{id: 'off', label: x.off}, {id: 'on', label: x.onLabel}]}
        value={h.on ? 'on' : 'off'} onChange={(v) => set({on: v === 'on'})} />
    </Row>
  );
}
function LengthRow() {
  const h = useStore(), x = t();
  return (
    <Row id="attention-sound-length" label={x.length} desc={x.lengthDesc}>
      <Segmented size="row" data-testid="sound-length" label={x.length} isDisabled={!h.on}
        options={(['short', 'long'] as Length[]).map((id) => ({id, label: x.lengthNames[id]}))}
        value={h.length} onChange={(v) => { set({length: v}); listen(h.sound); }} />
    </Row>
  );
}
function WhenRows() {
  const h = useStore(), x = t();
  const off = !h.on;
  return (
    <>
      <Row label={x.inView} desc={x.inViewDesc} testid="in-view-row">
        <Segmented size="row" data-testid="in-view" label={x.inView} isDisabled={off}
          options={[{id: 'quiet', label: x.inViewQuiet}, {id: 'plays', label: x.inViewPlays}]}
          value={h.inViewQuiet ? 'quiet' : 'plays'} onChange={(v) => set({inViewQuiet: v === 'quiet'})} />
      </Row>
      <Row id="attention-sound-night" label={x.night} desc={x.nightDesc}>
        <Segmented size="row" data-testid="night" label={x.night} isDisabled={off}
          options={[{id: 'off', label: x.off}, {id: 'on', label: x.onLabel}]}
          value={h.night ? 'on' : 'off'} onChange={(v) => set({night: v === 'on'})} />
      </Row>
      {h.night && !off ? (
        <div className="rq-notes">
          <p className="rq-now" data-testid="night-now" data-night={nightNow(h) || undefined}>
            <Icon name={nightNow(h) ? 'moon' : 'sun'} />{nightNow(h) ? x.nowNight : x.nowDay}
          </p>
        </div>
      ) : null}
    </>
  );
}
function RepoRow({repo}: {repo: Repo}) {
  const h = useStore(), x = t();
  const sound = repoSound(repo, h), where = `repo-${repo}`, {play: p} = usePlay(sound, where);
  return (
    <div className="s-row rq-repo" data-testid={`repo-${repo}`}>
      <div className="s-lbl rq-repo-lbl">
        <EmblemSvg id={sound} v={picks[sound]} play={p} small />
        <code className="rq-repo-name">{repo}</code>
      </div>
      <div className="s-val">
        <ChoiceMenu data-testid={`repo-sound-${repo}`} label={x.repoLabel(repo)} value={h.repos[repo]} isDisabled={!h.on}
          options={[{id: 'default' as const, label: x.repoDefault(name(h.sound))}, ...SOUND_IDS.map((id) => ({id, label: name(id), description: x.sounds[id][1]}))]}
          onChange={(v) => { set({repos: {...host.repos, [repo]: v}}); listen(repoSound(repo), where); }} />
        <IconButton data-testid={`repo-listen-${repo}`} size="row" variant="secondary" aria-label={x.repoListen(repo)} onPress={() => listen(sound, where)}>
          <Icon name="run" />
        </IconButton>
      </div>
    </div>
  );
}
function Notes() {
  const h = useStore(), x = t();
  return (
    <>
      {h.muted ? <p className="rq-note" data-testid="note-muted"><Icon name="slash" />{x.mutedNote}</p> : null}
      {h.on && !h.muted && nightNow(h) ? <p className="rq-note" data-testid="note-night"><Icon name="moon" />{x.nightNote}</p> : null}
      {!h.on ? <p className="rq-note" data-testid="note-off"><Icon name="slash" />{x.offNote}</p> : null}
    </>
  );
}
function DeviceRows() {
  const h = useStore(), x = t();
  return (
    <>
      <Row id="attention-sound-device" label={x.mute} desc={x.muteDesc}>
        <Segmented size="row" data-testid="device-mute" label={x.mute}
          options={[{id: 'plays', label: x.plays}, {id: 'muted', label: x.muted}]}
          value={h.muted ? 'muted' : 'plays'} onChange={(v) => set({muted: v === 'muted'})} />
      </Row>
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
function Body() {
  const x = t();
  return (
    <div className="s-stack rq-body" data-testid="settings-view">
      <p className="s-intro">{x.intro}</p>
      <div className="s-card"><OnRow /></div>
      <h3 className="s-h3">{x.sound}</h3>
      <p className="s-desc rq-lead">{x.soundDesc}</p>
      <Tiles />
      <div className="s-card"><LengthRow /></div>
      <h3 className="s-h3">{x.when}</h3>
      <div className="s-card"><WhenRows /></div>
      <h3 className="s-h3">{x.repos}</h3>
      <div className="s-card" data-settings-row="attention-sound-repos"><p className="s-desc rq-pad">{x.reposDesc}</p>
        {REPOS.map((r) => <RepoRow key={r} repo={r} />)}
      </div>
      <h3 className="s-h3">{x.device}</h3>
      <div className="s-card"><p className="s-desc rq-pad">{x.deviceDesc}</p><DeviceRows /></div>
    </div>
  );
}

// ---- The comparison rows: current + three variants of each emblem ----
function Cell({id, v}: {id: SoundId; v: number}) {
  useStore();
  const x = t(), variant = VARIANTS[id][v], where = `cell-${v}`, {active, play: p} = usePlay(id, where);
  const chosen = picks[id] === v, vname = variant.name[lang];
  return (
    <div className="rq-cell" data-testid={`cell-${id}-${v}`} data-chosen={chosen || undefined} data-playing={active || undefined}>
      <button type="button" className="rq-cell-play" data-testid={`play-${id}-${v}`} aria-label={x.listenVariant(name(id), vname)} onClick={() => listen(id, where)}>
        <EmblemSvg id={id} v={v} play={p} />
        <span className="rq-cell-small" aria-hidden="true"><EmblemSvg id={id} v={v} play={null} small /><code>{REPOS[0]}</code></span>
      </button>
      <div className="rq-cell-text">
        <strong>{v ? `${v} · ${vname}` : vname}{RECOMMENDED[id] === v ? <span className="rq-badge" data-testid={`rec-${id}`}>{x.recBadge}</span> : null}</strong>
        <span className="rq-cell-idea">{variant.idea[lang]}</span>
      </div>
      <label className="rq-use">
        <input type="radio" name={`use-${id}`} data-testid={`use-${id}-${v}`} checked={chosen} onChange={() => setPicks({[id]: v})} />
        {chosen ? x.inSettings : x.use}
      </label>
    </div>
  );
}
function Rows() {
  const h = useStore(), x = t();
  return (
    <div className="rq-rows" data-testid="rows-view">
      <div className="rq-rows-head">
        <p className="s-desc">{x.rowsIntro}</p>
        <div className="rq-rows-tools">
          <Segmented size="row" data-testid="rows-length" label={x.length}
            options={(['short', 'long'] as Length[]).map((id) => ({id, label: x.lengthNames[id]}))}
            value={h.length} onChange={(v) => set({length: v})} />
          <ControlButton data-testid="picks-current" size="row" variant="secondary" onPress={() => setPicks(Object.fromEntries(SOUND_IDS.map((id) => [id, 0])))}>{x.allCurrent}</ControlButton>
          <ControlButton data-testid="picks-recommended" size="row" variant="secondary" onPress={() => setPicks({...RECOMMENDED})}>{x.allRecommended}</ControlButton>
        </div>
      </div>
      {SOUND_IDS.map((id) => (
        <section key={id} className="rq-srow" data-testid={`row-${id}`} aria-labelledby={`rq-h-${id}`}>
          <header className="rq-srow-head">
            <h3 id={`rq-h-${id}`}>{name(id)}</h3>
            <p className="rq-trio" data-testid={`trio-${id}`}>{TRIO[id][lang]}</p>
          </header>
          <div className="rq-cells" role="radiogroup" aria-label={x.useIn(name(id))}>
            {VARIANTS[id].map((_, v) => <Cell key={v} id={id} v={v} />)}
          </div>
        </section>
      ))}
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
function Page() {
  const slot = useMain();
  const rail = (
    <WorkspaceRail>
      {REPOS.map((r) => <WorkspaceNavRow key={r} name={r} href={`/workspaces/ws_${r}`} />)}
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
      {slot ? createPortal(<Body />, slot) : null}
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
          <button type="button" data-testid="sim-other" onClick={() => simulate('other')}>{x.simOther}</button>
          <button type="button" data-testid="sim-repo" onClick={() => simulate('repo')}>{x.simRepo}</button>
          <button type="button" data-testid="sim-in-view" onClick={() => simulate('inView')}>{x.simInView}</button>
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
            {direction === 0 ? <Rows /> : <Page />}
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {note ? <p className="rq-toast" role="status" data-testid="rq-toast">{note}</p> : null}
    </div>
  );
}

const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { host = SCENARIOS[scenario](); playing = null; flushSync(() => reactRoot.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
