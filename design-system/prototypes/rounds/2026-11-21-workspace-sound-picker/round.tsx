import React, {type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog, DialogTrigger, Heading, Popover} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/WorkspacePage.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {type ShownSection, shownSettingsSections} from '../../../../web/src/app/settingsIndex';
import {setPersonalLanguage} from '../../../../web/src/i18n';
// Round 5's final sounds, unchanged: both lengths of each recipe.
// @ts-expect-error plain ES module without types
import {SOUNDS as SYNTH, SAMPLE_RATE, renderSound, volumeGain} from '../2026-11-21-attention-sounds-4/synth.mjs';
// Round 6's emblems and their styles; Jari chose B Väreilyn muoto (`ripple`).
import {EmblemSvg, type Strike} from '../2026-11-21-attention-sound-icons/emblems';
import {SOUND_IDS} from '../2026-11-21-attention-sound-icons/text';
import '../2026-11-21-attention-sound-icons/round.css';
import {type Lang, type Length, SCENARIO_IDS, type Scenario, type SoundId, TEXT, type View, soundText} from './text';
import './round.css';

// attention-sound, workspace sounds: where a workspace's own sound is chosen
// and how the choice shows afterwards (Jari 21.11. on round 6: in Settings or
// in the workspace itself, probably both; the pop-up could show the emblems).
// The pop-up is the same in all three directions: "Sama kuin oletus" first,
// then round 6's ten B emblems; a press plays the sound in the person's length
// (Lyhyet by default) and chooses it, and the pop-up stays open for trying
// others. The axis is the entry point and the afterglow:
//   A  (Otsikossa) a sound button in the workspace head's action row, plus a small emblem
//      on the rail row for a workspace that has its own sound;
//   B  (Nimen alla) an emblem chip with the sound's name under the workspace name;
//   C  (Asetuksissa) Settings › Äänet only; the workspace shows nothing.
// A and B also have the Settings rows that open the same pop-up.

const NAMES = ['A Otsikossa', 'B Nimen alla', 'C Asetuksissa'];
const DIR_KEYS = ['head', 'chip', 'settings'] as const;
type DirKey = typeof DIR_KEYS[number];
let lang: Lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const name = (id: SoundId) => soundText(lang, id)[0];
const DIR = 'ripple' as const;

type Variant = {dur: number; voices: {at: number; amp?: number}[]};
type Synth = {id: string; variants: Record<Length, Variant>};
const RECIPES = Object.fromEntries((SYNTH as Synth[]).filter((s) => (SOUND_IDS as readonly string[]).includes(s.id)).map((s) => [s.id, s.variants])) as Record<SoundId, Record<Length, Variant>>;
if (Object.keys(RECIPES).length !== 10) throw new Error('round 5 no longer has the ten sounds');
const strikesOf = (id: SoundId, len: Length): Strike[] => {
  const v = RECIPES[id][len];
  return v.voices.map((x) => ({at: x.at, amp: x.amp ?? 1, ring: Math.max(0.5, (v.dur - x.at) * (len === 'short' ? 1.1 : 0.85))}));
};
const IDENTITY = Object.fromEntries(SOUND_IDS.map((id) => [id, strikesOf(id, 'short')])) as Record<SoundId, Strike[]>;

// ---- The Sounds section in production's own section list ----
for (const l of ['fi', 'en'] as const) {
  const list = shownSettingsSections(l) as ShownSection[];
  const x = TEXT[l];
  const at = list.findIndex((s) => s.id === 'ulkoasu') + 1;
  list.splice(at, 0, {
    id: 'aanet' as ShownSection['id'], label: x.section, icon: 'music', kw: x.sectionKw,
    rows: [
      {id: 'attention-sound-default', label: x.defaultSound, kw: [], desc: x.defaultDesc},
      {id: 'attention-sound-length', label: x.length, kw: ['lyhyt', 'pitkä', 'short', 'long'], desc: x.lengthDesc},
      {id: 'attention-sound-repos', label: x.repos, kw: ['työtila', 'workspace'], desc: x.reposDesc},
    ],
  } as ShownSection);
}

// ---- State ----
const REPOS = ['aurinkokello', 'kotisivu', 'muistiinpanot'] as const;
type Repo = typeof REPOS[number];
type Choice = SoundId | 'default';
type Host = {on: boolean; sound: SoundId; length: Length; repos: Record<Repo, Choice>};
type Open = {repo: Repo; where: DirKey} | null;
const base = (): Host => ({on: true, sound: 'kalimba', length: 'short', repos: {aurinkokello: 'default', kotisivu: 'pisara', muistiinpanot: 'default'}});
const SCENARIOS: Record<Scenario, {host: () => Host; repo: Repo; open: boolean}> = {
  oma: {host: base, repo: 'kotisivu', open: true},
  oletus: {host: base, repo: 'aurinkokello', open: true},
  valittu: {host: base, repo: 'kotisivu', open: false},
  pitkat: {host: () => ({...base(), length: 'long'}), repo: 'kotisivu', open: true},
  pois: {host: () => ({...base(), on: false}), repo: 'kotisivu', open: true},
};
let scenario: Scenario = (new URLSearchParams(location.search).get('s') as Scenario) ?? 'oma';
if (!SCENARIOS[scenario]) scenario = 'oma';
let host: Host = SCENARIOS[scenario].host();
let open: Open = null;
type Playing = {id: SoundId; where: string; len: Length; n: number} | null;
let playing: Playing = null, playCount = 0;
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const set = (next: Partial<Host>) => { host = {...host, ...next}; notify(); };
const setOpen = (next: Open) => { open = next; notify(); };
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const fn = () => tick((x) => x + 1); listeners.add(fn); return () => { listeners.delete(fn); }; }, []);
  return host;
}
const repoSound = (r: Repo, h = host): SoundId => h.repos[r] === 'default' ? h.sound : h.repos[r] as SoundId;
const own = (r: Repo, h = host) => h.repos[r] !== 'default';

declare global { interface Window { __rqPlays: {sound: string; length: Length; samples: number; where: string}[]; __rqSim: {repo: string; played: boolean; sound?: string}[] } }
window.__rqPlays = []; window.__rqSim = [];
let audio: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let playTimer: ReturnType<typeof setTimeout> | undefined;
/** Plays the person's length of a sound. `where` says which emblems ripple. */
function play(id: SoundId, where: string) {
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
    g.gain.value = volumeGain(70, false);
    src.connect(g).connect(audio.destination);
    src.start();
  } catch { /* no audio device: the emblem still shows the play */ }
  window.__rqPlays.push({sound: id, length: len, samples, where});
  playing = {id, where, len, n: ++playCount};
  clearTimeout(playTimer);
  playTimer = setTimeout(() => { playing = null; notify(); }, v.dur * 1000 + 450);
  notify();
}
let toast: (s: string) => void = () => {};
function simulate(repo: Repo) {
  const x = t(), id = repoSound(repo);
  window.__rqSim.push({repo, played: host.on, sound: host.on ? id : undefined});
  if (!host.on) { toast(x.simSilent(repo)); return; }
  play(id, `repo-${repo}`); toast(x.simPlayed(repo, name(id), x.lengthOne[host.length]));
}

/** An emblem that ripples while its sound plays at `where`. */
function Emblem({id, where, size}: {id: SoundId; where: string; size: 'tile' | 'small' | 'tiny'}) {
  useStore();
  const p = playing && playing.id === id && playing.where === where && !reducedQuery.matches ? {key: playing.n, strikes: strikesOf(id, playing.len)} : null;
  return <span className={`wq-emblem wq-emblem-${size}`}><EmblemSvg dir={DIR} id={id} identity={IDENTITY[id]} play={p} small={size !== 'tile'} /></span>;
}

// ---- The pop-up (same in every direction) ----
const OPTIONS: Choice[] = ['default', ...SOUND_IDS];
function PickerBody({repo, close, onSettings}: {repo: Repo; close: () => void; onSettings?: () => void}) {
  const h = useStore(), x = t();
  const value = h.repos[repo];
  const where = 'picker';
  const choose = (c: Choice) => {
    set({repos: {...host.repos, [repo]: c}});
    const id = c === 'default' ? host.sound : c;
    play(id, `${where}-${c}`);
    toast(x.played(name(id), x.lengthOne[host.length]));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
    const i = OPTIONS.indexOf(value);
    const next = step ? (i + step + OPTIONS.length) % OPTIONS.length : e.key === 'Home' ? 0 : e.key === 'End' ? OPTIONS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); e.stopPropagation();
    const c = OPTIONS[next];
    choose(c);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="wpick-${c}"]`)?.focus());
  };
  const isPlaying = (c: Choice) => playing?.where === `${where}-${c}`;
  const state = (c: Choice) => isPlaying(c)
    ? <span className="rq-tile-state" data-state="playing"><Icon name="music" />{x.playing}</span>
    : value === c ? <span className="rq-tile-state" data-state="selected"><Icon name="check" />{x.chosen}</span> : null;
  return (
    <div className="wq-picker" data-testid="sound-picker" data-repo={repo}>
      <header className="wq-picker-top">
        <Heading slot="title" level={2}>{x.pickerTitle} <code>{repo}</code></Heading>
        <ControlButton size="inline" variant="quiet" aria-label={x.close} onPress={close} data-testid="picker-close"><Icon name="cross" /></ControlButton>
      </header>
      <p className="wq-picker-help">{x.pickerHelp}</p>
      {!h.on ? <p className="rq-note" data-testid="picker-off"><Icon name="slash" />{x.offNote}</p> : null}
      <div role="radiogroup" aria-label={x.pickerTitle} className="wq-options" onKeyDown={onKey}>
        <button type="button" role="radio" aria-checked={value === 'default'} tabIndex={value === 'default' ? 0 : -1}
          className="wq-default" data-testid="wpick-default" data-playing={isPlaying('default') || undefined}
          onClick={() => choose('default')}>
          <Emblem id={h.sound} where={`${where}-default`} size="small" />
          <span className="wq-default-text"><b>{x.sameAsDefault}</b><small>{x.sameDetail(name(h.sound))}</small></span>
          <span className="wq-default-state">{state('default')}</span>
        </button>
        <div className="wq-grid">
          {SOUND_IDS.map((id) => {
            const [nm, desc] = soundText(lang, id);
            const secs = x.secs(RECIPES[id][h.length].dur);
            return (
              <button key={id} type="button" role="radio" aria-checked={value === id} tabIndex={value === id ? 0 : -1}
                aria-label={x.tileLabel(nm, desc, secs)} className="wq-tile" data-testid={`wpick-${id}`} data-sound={id}
                data-playing={isPlaying(id) || undefined} onClick={() => choose(id)}>
                <Emblem id={id} where={`${where}-${id}`} size="tile" />
                <span className="wq-tile-name">{nm}</span>
                <span className="wq-tile-foot">{state(id) ?? <span className="rq-secs" data-testid={`wsecs-${id}`}>{secs}</span>}</span>
              </button>
            );
          })}
        </div>
      </div>
      <footer className="wq-picker-foot">
        <p data-testid="picker-length"><Icon name="music" /><span>{x.lengthNote[h.length]} {onSettings ? <button type="button" className="rq-link" data-testid="picker-settings" onClick={onSettings}>{x.lengthWhere}</button> : x.lengthWhere}</span></p>
        <ControlButton size="row" variant="primary" onPress={close} data-testid="picker-done">{x.done}</ControlButton>
      </footer>
    </div>
  );
}
/** The pop-up around any trigger; a sheet from the bottom edge on a phone. */
function SoundPopover({repo, where, trigger, placement, onSettings}: {repo: Repo; where: DirKey; trigger: ReactNode; placement: 'bottom start' | 'bottom end' | 'left'; onSettings?: () => void}) {
  useStore();
  const isOpen = open?.repo === repo && open.where === where;
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(next) => setOpen(next ? {repo, where} : null)}>
      {trigger}
      <Popover placement={placement} offset={6} className="ah-popover wq-popover">
        <Dialog className="wq-dialog" aria-label={t().pickerTitle} data-testid="sound-dialog">
          {({close}) => <PickerBody repo={repo} close={close} onSettings={onSettings ? () => { close(); onSettings(); } : undefined} />}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

// ---- Entry points ----
function HeadButton({repo, onSettings}: {repo: Repo; onSettings: () => void}) {
  const h = useStore(), x = t(), id = repoSound(repo, h);
  return (
    <SoundPopover repo={repo} where="head" placement="bottom end" onSettings={onSettings} trigger={
      <ControlButton size="row" variant="quiet" presentation="icon" className="wq-head-button" data-testid="head-sound"
        data-own={own(repo, h) || undefined} aria-label={x.headButton(repo, name(id), own(repo, h))} title={x.headButton(repo, name(id), own(repo, h))}>
        <Emblem id={id} where={`repo-${repo}`} size="tiny" />
      </ControlButton>
    } />
  );
}
function Chip({repo, onSettings}: {repo: Repo; onSettings: () => void}) {
  const h = useStore(), x = t(), id = repoSound(repo, h), mine = own(repo, h);
  return (
    <SoundPopover repo={repo} where="chip" placement="bottom start" onSettings={onSettings} trigger={
      <ControlButton size="inline" variant="quiet" className="wq-chip" data-testid="chip-sound" data-own={mine || undefined}
        aria-label={x.chipLabel(repo, name(id), mine)}>
        <Emblem id={id} where={`repo-${repo}`} size="tiny" />
        <span className="wq-chip-name">{name(id)}</span>
        {mine ? null : <span className="wq-chip-default">· {x.chipDefault}</span>}
        <Icon name="down" />
      </ControlButton>
    } />
  );
}
function RailMark({repo}: {repo: Repo}) {
  const h = useStore(), x = t();
  if (!own(repo, h)) return null;
  const id = repoSound(repo, h);
  return (
    <span className="wq-rail-mark" data-testid={`rail-sound-${repo}`} data-sound={id} title={x.railOwn(name(id))}>
      <Emblem id={id} where={`repo-${repo}`} size="tiny" />
      <span className="ah-visually-hidden">{x.railOwn(name(id))}</span>
    </span>
  );
}

// ---- The workspace page (production head classes, synthetic content) ----
function WorkspaceView({repo, dir, onSettings}: {repo: Repo; dir: DirKey; onSettings: () => void}) {
  const x = t();
  return (
    <div className="ah-workspace-page wq-page" data-testid="workspace-view">
      <header className="ah-workspace-page-head">
        <div className="ah-workspace-page-title">
          <h1 data-testid="workspace-title" tabIndex={-1}>{repo}</h1>
          <p><code>~/src/{repo}</code></p>
          {dir === 'chip' ? <div className="wq-chip-line"><Chip repo={repo} onSettings={onSettings} /></div> : null}
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: action group, as in production */}
        <div className="ah-workspace-icon-row" role="group" aria-label={repo}>
          <ControlButton size="row" variant="quiet" presentation="icon" aria-label={x.copyPath} title={x.copyPath}><Icon name="copy" /></ControlButton>
          <ControlButton size="row" variant="quiet" presentation="icon" aria-label={x.rename} title={x.rename}><Icon name="pencil" /></ControlButton>
          <ControlButton size="row" variant="quiet" presentation="icon" aria-label={x.archive} title={x.archive}><Icon name="eyeOff" /></ControlButton>
          {dir === 'head' ? <HeadButton repo={repo} onSettings={onSettings} /> : null}
          <span className="ah-workspace-action-divider" aria-hidden="true" />
          <ControlButton size="row" variant="primary" presentation="icon" className="ah-workspace-plus" aria-label={x.newConv} title={x.newConv}><Icon name="plus" /></ControlButton>
        </div>
      </header>
      <h2>{x.conversations}</h2>
      <ul className="wq-convs">
        {x.convs.map((c, i) => <li key={c}><strong>{c}</strong><span>{x.convMeta[i]}</span></li>)}
      </ul>
    </div>
  );
}

// ---- Settings › Äänet ----
function SettingsBody({dir}: {dir: DirKey}) {
  const h = useStore(), x = t();
  return (
    <div className="s-stack rq-body" data-testid="settings-body">
      <p className="s-intro">{x.intro}</p>
      <div className="s-card">
        <div className="s-row" data-settings-row="attention-sound-default">
          <div className="s-lbl"><strong>{x.defaultSound}</strong><span className="s-desc">{x.defaultDesc}</span></div>
          <div className="s-val wq-default-val"><Emblem id={h.sound} where="default" size="small" /><span>{name(h.sound)}</span></div>
        </div>
        <div className="s-row" data-settings-row="attention-sound-length">
          <div className="s-lbl"><strong>{x.length}</strong><span className="s-desc">{x.lengthDesc}</span></div>
          <div className="s-val">
            <Segmented size="row" data-testid="sound-length" label={x.length}
              options={(['short', 'long'] as Length[]).map((id) => ({id, label: x.lengthNames[id]}))}
              value={h.length} onChange={(v) => set({length: v})} />
          </div>
        </div>
      </div>
      <h3 className="s-h3">{x.repos}</h3>
      <div className="s-card" data-settings-row="attention-sound-repos">
        <p className="s-desc rq-pad">{x.reposDesc}{dir === 'settings' ? '' : ` ${x.reposDescWs}`}</p>
        {REPOS.map((r) => {
          const id = repoSound(r, h), value = own(r, h) ? name(id) : x.repoDefaultValue(name(h.sound));
          return (
            <div key={r} className="s-row rq-repo" data-testid={`repo-${r}`}>
              <div className="s-lbl rq-repo-lbl">
                <Emblem id={id} where={`repo-${r}`} size="small" />
                <code className="rq-repo-name">{r}</code>
              </div>
              <div className="s-val">
                <SoundPopover repo={r} where="settings" placement="left" trigger={
                  <ControlButton size="row" variant="secondary" className="wq-row-button" data-testid={`repo-sound-${r}`}
                    data-own={own(r, h) || undefined} aria-label={x.repoButton(r, value)}>
                    <span className="wq-row-value">{value}</span><Icon name="down" />
                  </ControlButton>
                } />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useMain(active: boolean) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!active) { setEl(null); return; }
    const id = setInterval(() => {
      const main = document.querySelector<HTMLElement>('.s-main');
      if (!main) return;
      let slot = main.querySelector<HTMLElement>(':scope > .rq-section');
      if (!slot) { slot = document.createElement('div'); slot.className = 'rq-section'; main.insertBefore(slot, main.querySelector(':scope > .s-version-line')); }
      setEl(slot); clearInterval(id);
    }, 10);
    return () => clearInterval(id);
  }, [active]);
  return el;
}
function Page({dir, view, repo, setView}: {dir: DirKey; view: View; repo: Repo; setView: (v: View) => void}) {
  const slot = useMain(view === 'settings');
  const toSettings = () => setView('settings');
  const rail = (
    <WorkspaceRail>
      {REPOS.map((r) => <WorkspaceNavRow key={r} name={r} href={`/workspaces/ws_${r}`} selected={view === 'workspace' && r === repo}
        workspaceMenu={dir === 'head' ? <RailMark repo={r} /> : undefined} />)}
    </WorkspaceRail>
  );
  const main = view === 'workspace' ? <WorkspaceView repo={repo} dir={dir} onSettings={toSettings} /> : (
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
      <AppShell mobileTitle={view === 'workspace' ? repo : t().section} rail={rail} main={main} />
      {slot ? createPortal(<SettingsBody dir={dir} />, slot) : null}
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
const defaultView = (dir: DirKey): View => dir === 'settings' ? 'settings' : 'workspace';
function App({direction}: {direction: number}) {
  const dir = DIR_KEYS[direction];
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
  const [s, setS] = useState(scenario);
  const [view, setViewState] = useState<View>(defaultView(dir));
  const [generation, setGeneration] = useState(0);
  const [note, setNote] = useState('');
  const bar = useRef<HTMLElement>(null);
  const x = TEXT[language];
  const repo = SCENARIOS[s].repo;
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
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 2600); return () => clearTimeout(id); }, [note]);
  // The scenario's pop-up opens in the direction's own entry point once the view has painted.
  const openFor = (next: Scenario, v: View) => {
    open = null;
    if (!SCENARIOS[next].open) return;
    const where: DirKey = v === 'settings' ? 'settings' : dir;
    setTimeout(() => setOpen({repo: SCENARIOS[next].repo, where}), 60);
  };
  useEffect(() => { openFor(s, view); }, []);
  const reset = (next = s, v = defaultView(dir), reopen = true) => {
    scenario = next; if (reopen) host = SCENARIOS[next].host(); playing = null; open = null;
    setS(next); setViewState(v); setNote(''); setGeneration((n) => n + 1); if (reopen) openFor(next, v);
  };
    return (
    <div className={`rq-review wq-review variant-${direction}`} data-direction={direction} data-scenario={s} data-view={view}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario, view)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.view} <select id="view" value={view} onChange={(e) => reset(s, e.target.value as View)}>
          {(['workspace', 'settings'] as View[]).map((v) => <option key={v} value={v}>{x.views[v]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option><option value="contrast">{x.contrast}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); reset(s, view);
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => reset()}>{x.reset}</button>
        <span className="rq-sim">{x.simulate}
          {(['kotisivu', 'aurinkokello'] as Repo[]).map((r) => <button key={r} type="button" data-testid={`sim-${r}`} onClick={() => simulate(r)}>{x.simRepo(r)}</button>)}
        </span>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${s}-${language}-${view}`} enabled={false}>
          <MemoryRouter key={`${generation}-${s}-${language}-${view}`} initialEntries={[view === 'settings' ? '/settings/aanet' : `/workspaces/ws_${repo}`]}>
            <Page dir={dir} view={view} repo={repo} setView={(v) => reset(s, v, false)} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {note ? <p className="rq-toast" role="status" data-testid="rq-toast">{note}</p> : null}
    </div>
  );
}

const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { host = SCENARIOS[scenario].host(); playing = null; open = null; flushSync(() => reactRoot.render(view === '' ? null : view)); }};
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
