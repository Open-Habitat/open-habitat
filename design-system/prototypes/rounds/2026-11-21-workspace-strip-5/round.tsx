import React, {type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Button, Dialog, DialogTrigger, Heading, Popover} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/WorkspacePage.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {TextField} from '../../../../web/src/components/Primitives';
import {WorkspaceIcon} from '../../../../web/src/components/WorkspaceIcon';
import {WorkspaceIconPicker} from '../../../../web/src/components/WorkspaceIconPicker';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {iconPicker, workspaceIcons} from '../../../../web/src/app/workspaceIcons';
import type {Workspace} from '../../../../web/src/app/snapshot';
import {workspacePageText} from '../../../../web/src/text/workspacePage';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
// Round 5's final sounds, unchanged: both lengths of each recipe.
// @ts-expect-error plain ES module without types
import {SOUNDS as SYNTH, SAMPLE_RATE, renderSound, volumeGain} from '../2026-11-21-attention-sounds-4/synth.mjs';
import {EmblemSvg, type Strike} from '../2026-11-21-attention-sound-emblems-7/emblems';
import '../2026-11-21-attention-sound-emblems-7/round.css';
import {type IconKind, type Lang, type Length, SCENARIO_IDS, SOUND_IDS, type Scenario, type SoundId, TEXT, soundText} from './text';
import './round.css';

// attention-sound, workspace strip round 5 (Jari 21.11. on strip round 4 and
// emblem round 7): strip A Yksi rivi, now with all three buttons working.
// Kuvake opens production's WorkspaceIconPicker (its own trigger stretched
// over the square), Nimi opens production's display-name change, Ääni opens
// the sound picker of rounds 2-4. The emblems are the final ones. The axis is
// how Nimi edits, the only one of the three with a real alternative:
//   A  (Ponnahdus) a pop-up under the button, like Kuvake and Ääni, holding
//      production's rename form (Näyttönimi, Tallenna);
//   B  (Paikallaan) the name becomes a field inside its own box.

const NAMES = ['A Ponnahdus', 'B Paikallaan'];
type Mode = 'popup' | 'inline';
const MODES: Mode[] = ['popup', 'inline'];
let lang: Lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const pageText = liveText(workspacePageText);
const name = (id: SoundId) => soundText(lang, id)[0];

/** Jari 21.11. on emblem round 7: Tunnus puu current, Lasit Lasin reuna,
 * Kuplat current, Kulho Huojunta, Jääpuikot Helähdys, the rest as round 7
 * recommended. Indexes into emblems.tsx's VARIANTS (0 = round 6's). */
export const FINAL: Record<SoundId, number> = {
  kalimba: 2, marimba: 1, vibrafoni: 2, 'tunnus-puu': 0, pisara: 0, lasit: 2, tuulikello: 0, kuplat: 0, kulho: 2, jaapuikot: 3,
};

type Variant = {dur: number; voices: {at: number; amp?: number}[]};
type Synth = {id: string; variants: Record<Length, Variant>};
const RECIPES = Object.fromEntries((SYNTH as Synth[]).filter((s) => (SOUND_IDS as readonly string[]).includes(s.id)).map((s) => [s.id, s.variants])) as Record<SoundId, Record<Length, Variant>>;
if (Object.keys(RECIPES).length !== 10) throw new Error('round 5 no longer has the ten sounds');
const strikesOf = (id: SoundId, len: Length): Strike[] => {
  const v = RECIPES[id][len];
  return v.voices.map((x) => ({at: x.at, amp: x.amp ?? 1, ring: Math.max(0.5, (v.dur - x.at) * (len === 'short' ? 1.1 : 0.85))}));
};

// ---- State ----
const REPOS = ['aurinkokello', 'kotisivu', 'muistiinpanot'] as const;
type Repo = typeof REPOS[number];
type Choice = SoundId | 'default';
/** Per workspace: the sound choice, the display name (undefined = the
 * folder's name) and the config's flat `icon` value (undefined = none). */
type Host = {on: boolean; sound: SoundId; length: Length; repos: Record<Repo, Choice>; names: Record<Repo, string | undefined>; icons: Record<Repo, string | undefined>};
type Open = 'icon' | 'name' | 'sound' | null;
const base = (): Host => ({
  on: true, sound: 'kalimba', length: 'short',
  repos: {aurinkokello: 'default', kotisivu: 'pisara', muistiinpanot: 'default'},
  names: {aurinkokello: undefined, kotisivu: undefined, muistiinpanot: undefined},
  icons: {aurinkokello: undefined, kotisivu: '🌻', muistiinpanot: 'MP'},
});
const SCENARIOS: Record<Scenario, {host: () => Host; repo: Repo; open: Open}> = {
  oma: {host: base, repo: 'kotisivu', open: null},
  oletus: {host: base, repo: 'aurinkokello', open: null},
  kuvake: {host: base, repo: 'kotisivu', open: 'icon'},
  nimi: {host: base, repo: 'kotisivu', open: 'name'},
  aani: {host: base, repo: 'kotisivu', open: 'sound'},
  pitka: {host: () => ({...base(), names: {...base().names, kotisivu: 'Asiakkaan verkkokauppa'}}), repo: 'kotisivu', open: null},
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
const display = (r: Repo, h = host) => h.names[r] ?? r;

/** A synthetic snapshot workspace, as much as production's icon chain reads. */
function workspaceOf(r: Repo, h = host): Workspace {
  const v = h.icons[r];
  const icon = v === undefined || v === 'auto' ? undefined
    : /^[A-Z0-9ÅÄÖ]{1,3}$/.test(v) ? {kind: 'letters', value: v, source: 'config'} : {kind: 'emoji', value: v, source: 'config'};
  return {workspace_id: `ws_${r}`, name: r, display_name: h.names[r], path: `/home/aino/src/${r}`, kind: 'git_main_worktree',
    icon, icon_auto: v === 'auto' || undefined} as unknown as Workspace;
}
const iconKind = (r: Repo, h = host): IconKind => {
  const v = h.icons[r];
  return v === undefined || v === 'auto' ? 'derived' : /^[A-Z0-9ÅÄÖ]{1,3}$/.test(v) ? 'letters' : 'emoji';
};

declare global { interface Window { __rqPlays: {sound: string; length: Length; samples: number; where: string}[]; __rqSim: {repo: string; played: boolean; sound?: string}[]; __rqHost: () => Host } }
window.__rqPlays = []; window.__rqSim = []; window.__rqHost = () => host;
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
function Emblem({id, where, size}: {id: SoundId; where: string; size: 'tile' | 'small'}) {
  useStore();
  const p = playing && playing.id === id && playing.where === where && !reducedQuery.matches ? {key: playing.n, strikes: strikesOf(id, playing.len)} : null;
  return <span className={`wq-emblem wq-emblem-${size}`}><EmblemSvg id={id} v={FINAL[id]} play={p} small={size === 'small'} /></span>;
}

// ---- Ääni: the sound picker (round 4's, unchanged but for the emblems) ----
const OPTIONS: Choice[] = ['default', ...SOUND_IDS];
function PickerBody({repo, close}: {repo: Repo; close: () => void}) {
  const h = useStore(), x = t();
  const value = h.repos[repo];
  const soundOf = (c: Choice) => c === 'default' ? host.sound : c;
  const choose = (c: Choice) => {
    set({repos: {...host.repos, [repo]: c}});
    const id = soundOf(c);
    play(id, `picker-${c}`);
    toast(x.played(name(id), x.lengthOne[host.length]));
  };
  const preview = (c: Choice) => {
    const id = soundOf(c);
    play(id, `picker-${c}`);
    toast(x.previewed(name(id), x.lengthOne[host.length]));
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).getAttribute('role') !== 'radio') return;
    const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
    const i = OPTIONS.indexOf(value);
    const next = step ? (i + step + OPTIONS.length) % OPTIONS.length : e.key === 'Home' ? 0 : e.key === 'End' ? OPTIONS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); e.stopPropagation();
    const c = OPTIONS[next];
    choose(c);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="wpick-${c}"]`)?.focus());
  };
  const isPlaying = (c: Choice) => playing?.where === `picker-${c}`;
  const state = (c: Choice) => isPlaying(c)
    ? <span className="rq-tile-state" data-state="playing"><Icon name="music" />{x.playing}</span>
    : value === c ? <span className="rq-tile-state" data-state="selected"><Icon name="check" />{x.chosen}</span> : null;
  const previewButton = (c: Choice, label: string) => (
    <button type="button" className="wq-preview" data-testid={`wpreview-${c}`} aria-label={x.preview(label)} title={x.preview(label)}
      data-playing={isPlaying(c) || undefined} onClick={() => preview(c)}><Icon name="run" /></button>
  );
  return (
    <div className="wq-picker" data-testid="sound-picker" data-repo={repo}>
      <header className="wq-picker-top">
        <Heading slot="title" level={2}><Icon name="music" />{x.pickerTitle} <code>{repo}</code></Heading>
        <ControlButton size="inline" variant="quiet" aria-label={x.close} onPress={close} data-testid="picker-close"><Icon name="cross" /></ControlButton>
      </header>
      <p className="wq-picker-help">{x.pickerHelp}</p>
      {!h.on ? <p className="rq-note" data-testid="picker-off"><Icon name="slash" />{x.offNote}</p> : null}
      <div role="radiogroup" aria-label={x.pickerTitle} className="wq-options" onKeyDown={onKey}>
        <div className="wq-default-row" data-checked={value === 'default' || undefined} data-playing={isPlaying('default') || undefined}>
          <button type="button" role="radio" aria-checked={value === 'default'} tabIndex={value === 'default' ? 0 : -1}
            className="wq-default" data-testid="wpick-default" onClick={() => choose('default')}>
            <Emblem id={h.sound} where="picker-default" size="small" />
            <span className="wq-default-text"><b>{x.sameAsDefault}</b><small>{x.sameDetail(name(h.sound))}</small></span>
            <span className="wq-default-state">{state('default')}</span>
          </button>
          {previewButton('default', `${x.sameAsDefault} (${name(h.sound)})`)}
        </div>
        <div className="wq-grid">
          {SOUND_IDS.map((id) => {
            const [nm, desc] = soundText(lang, id);
            const secs = x.secs(RECIPES[id][h.length].dur);
            return (
              <div key={id} className="wq-card" data-checked={value === id || undefined} data-playing={isPlaying(id) || undefined}>
                <button type="button" role="radio" aria-checked={value === id} tabIndex={value === id ? 0 : -1}
                  aria-label={x.tileLabel(nm, desc, secs)} className="wq-tile" data-testid={`wpick-${id}`} data-sound={id}
                  onClick={() => choose(id)}>
                  <Emblem id={id} where={`picker-${id}`} size="tile" />
                  <span className="wq-tile-name">{nm}</span>
                  <span className="wq-tile-foot">{state(id) ?? <span className="rq-secs" data-testid={`wsecs-${id}`}>{secs}</span>}</span>
                </button>
                {previewButton(id, nm)}
              </div>
            );
          })}
        </div>
      </div>
      <footer className="wq-picker-foot">
        <p data-testid="picker-length"><Icon name="music" /><span>{x.lengthNote[h.length]}</span></p>
        <ControlButton size="row" variant="primary" onPress={close} data-testid="picker-done">{x.done}</ControlButton>
      </footer>
    </div>
  );
}

// ---- The strip ----
/** A strip button. Its kind (square or flat), never its value, sets its size. */
function StripItem({testid, kind, label, icon, picture, value, ...rest}: {testid: string; kind: 'square' | 'flat'; label: string; icon: 'image' | 'pencil' | 'music'; picture: ReactNode; value?: ReactNode} & Record<string, unknown>) {
  return (
    <Button className={`wq-strip-item wq-strip-${kind}`} data-testid={testid} data-kind={kind} {...rest}>
      <span className="wq-strip-label"><Icon name={icon} />{label}</span>
      <span className="wq-strip-box">{picture}</span>
      {value}
    </Button>
  );
}
const valueBox = (text: ReactNode) => <span className="wq-strip-value"><span className="wq-stable-value" data-testid="stable-value">{text}</span></span>;

/** Kuvake: production's icon picker. Its trigger is stretched over the whole
 * square (round.css), so the square's label and value sit on top of the real
 * button and its pop-up anchors to the square. A choice is written at once,
 * as in production (Jari 2026-10-30). */
function IconSquare({repo}: {repo: Repo}) {
  const h = useStore(), x = t();
  const w = workspaceOf(repo, h);
  const icon = workspaceIcons(REPOS.map((r) => workspaceOf(r, h))).get(w.workspace_id)!;
  // The popover opens through the production trigger; a scenario opens it by
  // pressing that trigger once the page has painted.
  return (
    <div className="wq-strip-item wq-strip-square wq-icon-square" data-testid="strip-icon" data-kind="square" data-icon-kind={iconKind(repo, h)}>
      <span className="wq-strip-label"><Icon name="image" />{x.stripIcon}</span>
      <span className="wq-strip-box">
        <WorkspaceIconPicker key={`${repo}-${h.icons[repo]}`} model={iconPicker(icon, w)}
          onChoose={(value) => { set({icons: {...host.icons, [repo]: value}}); toast(x.iconChosen(value)); }}
          footer={(close) => (
            <ControlButton data-testid="workspace-icon-ask-model" size="row" variant="quiet" onPress={() => { close(); toast(x.notHere); }}>
              <Icon name="spark" /> {pageText.askModel}
            </ControlButton>
          )} />
      </span>
      {valueBox(x.iconKind[iconKind(repo, h)])}
    </div>
  );
}

/** Production's rename form: Näyttönimi and Tallenna. An empty name clears
 * the display name, so the folder's name shows again. */
function saveName(repo: Repo, value: string) {
  const x = t(), v = value.trim();
  set({names: {...host.names, [repo]: v && v !== repo ? v : undefined}});
  toast(v ? x.renamed(v) : x.renamedBack(repo));
}
const nameText = (repo: Repo, h: Host) => <code className="wq-name-value" data-testid="name-value" title={display(repo, h)}>{display(repo, h)}</code>;

/** A Ponnahdus: the name in a pop-up anchored to Nimi, a sheet on a phone. */
function NamePopup({repo}: {repo: Repo}) {
  const h = useStore(), x = t();
  const isOpen = open === 'name';
  const [draft, setDraft] = useState(display(repo, h));
  useEffect(() => {
    if (!isOpen) return;
    setDraft(display(repo));
    const id = requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-testid="workspace-name"]')?.select());
    return () => cancelAnimationFrame(id);
  }, [isOpen, repo]);
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(next) => setOpen(next ? 'name' : null)}>
      <StripItem testid="strip-name" kind="flat" label={x.stripName} icon="pencil" aria-label={x.nameLabel(display(repo, h))}
        picture={nameText(repo, h)} />
      <Popover placement="bottom start" offset={6} className="ah-popover wq-name-popover">
        <Dialog className="wq-dialog" aria-label={pageText.renameTitle} data-testid="rename-dialog">
          {({close}) => (
            <form className="wq-rename" onSubmit={(e) => { e.preventDefault(); saveName(repo, draft); close(); }}>
              <header className="wq-picker-top">
                <Heading slot="title" level={2}><Icon name="pencil" />{pageText.renameTitle}</Heading>
                <ControlButton size="inline" variant="quiet" aria-label={x.close} onPress={close} data-testid="rename-close"><Icon name="cross" /></ControlButton>
              </header>
              <TextField data-testid="workspace-name" label={pageText.displayName} value={draft} onChange={setDraft} hint={x.folderStays(repo)} />
              <div className="wq-rename-actions">
                <ControlButton size="row" variant="secondary" onPress={close} data-testid="rename-cancel">{x.cancel}</ControlButton>
                <ControlButton size="row" variant="primary" type="submit" data-testid="save-workspace-name">{pageText.save}</ControlButton>
              </div>
            </form>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/** B Paikallaan: the name turns into a field in the same box. Enter and a
 * click elsewhere save, Esc cancels; focus returns to Nimi. */
function NameInline({repo}: {repo: Repo}) {
  const h = useStore(), x = t();
  const editing = open === 'name';
  const [draft, setDraft] = useState(display(repo, h));
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    if (!editing) return;
    done.current = false;
    setDraft(display(repo));
    requestAnimationFrame(() => input.current?.select());
  }, [editing, repo]);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save) saveName(repo, input.current?.value ?? draft);
    setOpen(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="strip-name"]')?.focus());
  };
  if (!editing)
    return <StripItem testid="strip-name" kind="flat" label={x.stripName} icon="pencil" aria-label={x.nameLabel(display(repo, h))}
      onPress={() => setOpen('name')} picture={nameText(repo, h)} />;
  return (
    <form className="wq-strip-item wq-strip-flat wq-name-editing" data-testid="strip-name" data-kind="flat" data-editing="true"
      onSubmit={(e) => { e.preventDefault(); finish(true); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) finish(true); }}>
      <span className="wq-strip-label">
        <Icon name="pencil" /><label htmlFor="wq-inline-name" aria-label={pageText.displayName}>{x.stripName}</label>
        <span className="wq-inline-actions">
          <button type="button" className="wq-inline-button" data-testid="rename-cancel" aria-label={x.cancel} title={x.cancel}
            onMouseDown={(e) => e.preventDefault()} onClick={() => finish(false)}><Icon name="cross" /></button>
          <button type="submit" className="wq-inline-button" data-testid="save-workspace-name" aria-label={pageText.save} title={pageText.save}
            onMouseDown={(e) => e.preventDefault()}><Icon name="check" /></button>
        </span>
      </span>
      <span className="wq-strip-box">
        <input id="wq-inline-name" ref={input} className="wq-name-value wq-name-input" data-testid="workspace-name" value={draft}
          aria-describedby="wq-inline-hint" autoComplete="off" spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } }} />
      </span>
      <span id="wq-inline-hint" className="ah-visually-hidden">{x.folderStays(repo)}</span>
    </form>
  );
}

function SoundSquare({repo}: {repo: Repo}) {
  const h = useStore(), x = t(), id = repoSound(repo, h), mine = own(repo, h);
  return (
    <DialogTrigger isOpen={open === 'sound'} onOpenChange={(next) => setOpen(next ? 'sound' : null)}>
      <StripItem testid="entry-strip-sound" kind="square" label={x.soundWord} icon="music" data-own={mine || undefined}
        aria-label={x.entryLabel(repo, name(id), mine)}
        picture={<Emblem id={id} where={`repo-${repo}`} size="tile" />}
        value={valueBox(<><span className="wq-v-name">{name(id)}</span>{mine ? null : <>{' '}<span className="wq-v-suffix">· {x.defaultWord}</span></>}</>)} />
      <Popover placement="bottom end" offset={6} className="ah-popover wq-popover">
        <Dialog className="wq-dialog" aria-label={x.pickerTitle} data-testid="sound-dialog">
          {({close}) => <PickerBody repo={repo} close={close} />}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function SettingsStrip({repo, mode}: {repo: Repo; mode: Mode}) {
  return (
    <section className="wq-strip wq-strip-line" data-testid="entry-strip" data-mode={mode} aria-label={t().stripTitle}>
      <div className="wq-strip-items">
        <IconSquare repo={repo} />
        {mode === 'popup' ? <NamePopup repo={repo} /> : <NameInline repo={repo} />}
        <SoundSquare repo={repo} />
      </div>
    </section>
  );
}

// ---- The workspace page (production head classes, synthetic content) ----
function WorkspaceView({repo, mode}: {repo: Repo; mode: Mode}) {
  const h = useStore(), x = t();
  const icon = workspaceIcons(REPOS.map((r) => workspaceOf(r, h))).get(`ws_${repo}`)!;
  return (
    <div className="ah-workspace-page wq-page" data-testid="workspace-view">
      <header className="ah-workspace-page-head">
        <span className="wq-head-icon"><WorkspaceIcon icon={icon} size="l" /></span>
        <div className="ah-workspace-page-title">
          <h1 data-testid="workspace-title" tabIndex={-1}>{display(repo, h)}</h1>
          <p><code>~/src/{repo}</code></p>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: action group, as in production */}
        <div className="ah-workspace-icon-row" role="group" aria-label={repo}>
          <ControlButton size="row" variant="quiet" presentation="icon" aria-label={x.copyPath} title={x.copyPath}><Icon name="copy" /></ControlButton>
          <ControlButton size="row" variant="quiet" presentation="icon" aria-label={x.archive} title={x.archive}><Icon name="eyeOff" /></ControlButton>
          <span className="ah-workspace-action-divider" aria-hidden="true" />
          <ControlButton size="row" variant="primary" presentation="icon" className="ah-workspace-plus" aria-label={x.newConv} title={x.newConv}><Icon name="plus" /></ControlButton>
        </div>
      </header>
      <SettingsStrip repo={repo} mode={mode} />
      <div>
        <h2>{x.conversations}</h2>
        <ul className="wq-convs">
          {x.convs.map((c, i) => <li key={c}><strong>{c}</strong><span>{x.convMeta[i]}</span></li>)}
        </ul>
      </div>
    </div>
  );
}

function Page({mode, repo}: {mode: Mode; repo: Repo}) {
  const h = useStore();
  const icons = workspaceIcons(REPOS.map((r) => workspaceOf(r, h)));
  const rail = (
    <WorkspaceRail>
      {REPOS.map((r) => <WorkspaceNavRow key={r} name={display(r, h)} icon={icons.get(`ws_${r}`)} href={`/workspaces/ws_${r}`} selected={r === repo} />)}
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={display(repo, h)} rail={rail} main={<WorkspaceView repo={repo} mode={mode} />} />
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
  const mode = MODES[direction];
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
  const [s, setS] = useState(scenario);
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
  // The scenario's editor opens once the view has painted. The icon picker
  // owns its open state, so it is opened by pressing its real trigger.
  const openFor = (next: Scenario) => {
    open = null;
    const o = SCENARIOS[next].open;
    if (!o) return;
    setTimeout(() => {
      if (o === 'icon') document.querySelector<HTMLElement>('[data-testid="workspace-icon-picker"]')?.click();
      else setOpen(o);
    }, 80);
  };
  useEffect(() => { openFor(s); }, []);
  const reset = (next = s) => {
    scenario = next; host = SCENARIOS[next].host(); playing = null; open = null;
    setS(next); setNote(''); setGeneration((n) => n + 1); openFor(next);
  };
  return (
    <div className={`rq-review wq-review variant-${direction}`} data-direction={direction} data-scenario={s} data-mode={mode}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option><option value="contrast">{x.contrast}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); reset(s);
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
        <PiModelsProvider key={`${generation}-${s}-${language}`} enabled={false}>
          <MemoryRouter key={`${generation}-${s}-${language}`} initialEntries={[`/workspaces/ws_${repo}`]}>
            <Page mode={mode} repo={repo} />
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
