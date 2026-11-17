import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
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
import {type Lang, SCENARIO_IDS, type Scenario, SOUND_IDS, type SoundId, TEXT, type Watch} from './text';
import './round.css';

// attention-sound, round 2: the person's default attention sound in
// Settings. Axis: how the default sound is chosen and how much of the
// setting is on the first view. A lists every sound as a row with a listen
// button; B is one compact card with the sound in a menu; C shows the sounds
// as tiles with a diagram of which sound plays where. The same facts in all
// three: on/off (personal), default sound, the two events, the "conversation
// in view" rule (personal), this device's mute and volume (per browser), a
// test button, the browser's autoplay gate, and how workspace and
// conversation sounds override the default (referred to only; later
// rounds). The page is production's AccountSettings with a Sounds section
// added to its section list at load; the section's body is the round's.

const NAMES = ['A Lista', 'B Valikko', 'C Laatat'];
const A = 0, B = 1, C = 2;
let lang: Lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];

// ---- A Sounds section in production's own section list ----
// The lists are built at module load; the round adds its entry after
// Ulkoasu so the sidebar, the h2 and the search all know it.
for (const l of ['fi', 'en'] as const) {
  const list = shownSettingsSections(l) as ShownSection[];
  const x = TEXT[l];
  const at = list.findIndex((s) => s.id === 'ulkoasu') + 1;
  list.splice(at, 0, {
    id: 'aanet' as ShownSection['id'], label: x.section, icon: 'music', kw: x.sectionKw,
    rows: [
      {id: 'attention-sound', label: x.on, kw: x.sectionKw, desc: x.onDesc},
      {id: 'attention-sound-default', label: x.sound, kw: [], desc: x.soundDesc},
      {id: 'attention-sound-device', label: x.device, kw: ['mykistä', 'mute', 'voimakkuus', 'volume'], desc: x.deviceDesc},
    ],
  } as ShownSection);
}

// ---- Placeholder sounds (Web Audio) ----
// Obviously placeholder: each is one to three plain oscillator notes with an
// exponential decay. The parallel round designs the real set.
type Note = [freq: number, at: number, dur: number, type: OscillatorType, gain: number];
const SYNTH: Record<SoundId, Note[]> = {
  s1: [[1320, 0, 0.35, 'sine', 0.5]],
  s2: [[880, 0, 0.9, 'sine', 0.45], [1760, 0, 0.5, 'sine', 0.15]],
  s3: [[1200, 0, 0.12, 'sine', 0.5], [800, 0.06, 0.25, 'sine', 0.35]],
  s4: [[520, 0, 0.12, 'triangle', 0.6], [390, 0.11, 0.14, 'triangle', 0.5]],
  s5: [[2093, 0, 0.6, 'sine', 0.3], [3136, 0, 0.4, 'sine', 0.12]],
  s6: [[660, 0, 0.5, 'triangle', 0.4], [990, 0.18, 0.5, 'triangle', 0.3]],
  s7: [[740, 0, 0.3, 'sine', 0.4], [740, 0.25, 0.3, 'sine', 0.2], [740, 0.5, 0.3, 'sine', 0.1]],
  s8: [[523, 0, 0.18, 'sine', 0.4], [659, 0.12, 0.18, 'sine', 0.4], [784, 0.24, 0.35, 'sine', 0.4]],
};
let audio: AudioContext | null = null;
declare global { interface Window { __rqPlays: {sound: SoundId; volume: number}[] } }
window.__rqPlays = [];
function play(sound: SoundId, volume: number) {
  window.__rqPlays.push({sound, volume});
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const master = audio.createGain();
    master.gain.value = volume / 100;
    master.connect(audio.destination);
    const now = audio.currentTime + 0.02;
    for (const [freq, at, dur, type, gain] of SYNTH[sound]) {
      const osc = audio.createOscillator(), env = audio.createGain();
      osc.type = type; osc.frequency.value = freq;
      env.gain.setValueAtTime(gain, now + at);
      env.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(env).connect(master);
      osc.start(now + at); osc.stop(now + at + dur + 0.05);
    }
  } catch { /* no audio device: the review still records the press */ }
}
/** A small drawing of the sound's notes for C's tiles: decoration only. */
function Shape({sound}: {sound: SoundId}) {
  const notes = SYNTH[sound];
  const max = Math.max(...notes.map(([, at, dur]) => at + dur));
  return (
    <svg className="rq-shape" viewBox="0 0 60 24" aria-hidden="true">
      {notes.map(([freq, at, dur, , gain], i) => {
        const x = (at / max) * 56 + 2, w = Math.max(4, (dur / max) * 56);
        const y = 22 - Math.min(18, (Math.log2(freq / 300) / 3.5) * 18);
        return <path key={i} d={`M${x} ${y} L${x + w} ${Math.min(22, y + 14 * gain + 4)}`} />;
      })}
    </svg>
  );
}

// ---- State: personal (the person's file) and this device (the browser) ----
type Own = {kind: 'workspace' | 'conversation'; name: string; where?: string; sound: SoundId | null};
type Host = {
  on: boolean; sound: SoundId; done: boolean; asks: boolean; watch: Watch;
  muted: boolean; volume: number; blocked: boolean; allowedNow: boolean;
  own: Own[]; readError: boolean; ownOpen: boolean;
};
const OWN: Own[] = [
  {kind: 'workspace', name: 'aurinkokello', sound: 's4'},
  {kind: 'workspace', name: 'kotisivu', sound: null},
  {kind: 'conversation', name: 'Julkaisun tarkistus', where: 'aurinkokello', sound: 's5'},
];
const base: Host = {on: true, sound: 's3', done: true, asks: true, watch: 'away', muted: false, volume: 70, blocked: false, allowedNow: false, own: OWN, readError: false, ownOpen: false};
const SCENARIOS: Record<Scenario, () => Host> = {
  oletus: () => ({...base}),
  pois: () => ({...base, on: false}),
  mykistetty: () => ({...base, muted: true}),
  estetty: () => ({...base, blocked: true}),
  'ei-omia': () => ({...base, own: []}),
  lukuvirhe: () => ({...base, readError: true}),
};
let scenario: Scenario = (new URLSearchParams(location.search).get('s') as Scenario) ?? 'oletus';
if (!SCENARIOS[scenario]) scenario = 'oletus';
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const set = (next: Partial<Host>) => { host = {...host, ...next}; listeners.forEach((f) => f()); };
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
let toast: (s: string) => void = () => {};
/** Listening is an explicit press: it plays even when the sound is off or
 * the device is muted, and it is the press that unlocks the browser. */
const listen = (sound: SoundId) => { play(sound, host.volume); toast(t().played(t().sounds[sound])); if (host.blocked) set({blocked: false, allowedNow: true}); };

// ---- Shared pieces ----
function OnRow() {
  const h = useHost(), x = t();
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
// Disabled while the sound is off; the page's own note says why, so the
// checkbox's reason line stays blank (a non-empty reason is what disables).
const OFF = {state: 'disabled', reason: '\u00a0'} as const;
function EventsRow({compact = false}: {compact?: boolean}) {
  const h = useHost(), x = t();
  const off = !h.on || h.readError;
  return (
    <div className="s-row rq-events" data-testid="sound-events">
      <div className="s-lbl"><strong>{x.events}</strong></div>
      <div className="rq-checks">
        <Checkbox data-testid="event-done" label={x.eventDone} hint={compact ? undefined : x.eventDoneHint} checked={h.done}
          availability={off ? OFF : undefined} onChange={(v) => set({done: v})} />
        <Checkbox data-testid="event-asks" label={x.eventAsks} hint={compact ? undefined : x.eventAsksHint} checked={h.asks}
          availability={off ? OFF : undefined} onChange={(v) => set({asks: v})} />
      </div>
    </div>
  );
}
function WatchRow() {
  const h = useHost(), x = t();
  return (
    <div className="s-row" data-testid="sound-watch-row">
      <div className="s-lbl"><strong>{x.watch}</strong><span className="s-desc">{x.watchDesc}</span></div>
      <div className="s-val">
        <ChoiceMenu data-testid="sound-watch" label={x.watch} value={h.watch} isDisabled={!h.on || h.readError}
          options={(['always', 'away', 'hidden'] as Watch[]).map((id) => ({id, label: x.watchOpts[id][0], description: x.watchOpts[id][1]}))}
          onChange={(v) => set({watch: v})} />
      </div>
    </div>
  );
}
function ListenButton({sound}: {sound: SoundId}) {
  const x = t();
  return (
    <ControlButton data-testid={`listen-${sound}`} size="row" variant="quiet" presentation="icon"
      aria-label={x.listen(x.sounds[sound])} onPress={() => listen(sound)}><Icon name="run" /></ControlButton>
  );
}
function Notes() {
  const h = useHost(), x = t();
  return (
    <>
      {h.blocked ? <p className="rq-note" role="status" data-testid="note-blocked"><Icon name="warning" />{x.blockedNote}</p> : null}
      {h.allowedNow ? <p className="rq-note rq-ok" role="status" data-testid="note-allowed"><Icon name="check" />{x.allowedNote}</p> : null}
      {(h.on || h.readError) && h.muted ? <p className="rq-note" data-testid="note-muted"><Icon name="slash" />{x.mutedNote}</p> : null}
      {!h.on && !h.readError ? <p className="rq-note" data-testid="note-off"><Icon name="slash" />{x.offNote}</p> : null}
    </>
  );
}
function DeviceRows() {
  const h = useHost(), x = t();
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
        <div className="s-lbl"><strong>{x.volume}</strong><span className="s-desc">{x.volumeDesc}</span></div>
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
const ownSound = (o: Own) => (o.sound ? t().sounds[o.sound] : t().silent);
function OwnList() {
  const h = useHost(), x = t();
  return (
    <ul className="rq-own" data-testid="own-list">
      {h.own.map((o) => (
        <li key={o.name} data-kind={o.kind}>
          <Icon name={o.kind === 'workspace' ? 'folder' : 'message'} />
          <span className="rq-own-name">
            {o.kind === 'workspace' ? <code>{o.name}</code> : <>{o.name} <span className="s-desc">· <code>{o.where}</code></span></>}
          </span>
          <span className="rq-own-sound" data-silent={o.sound ? undefined : ''}>{o.sound ? <Icon name="music" /> : <Icon name="slash" />}{ownSound(o)}</span>
          {o.sound ? <ListenButton sound={o.sound} /> : <span className="rq-own-gap" />}
          <button type="button" className="rq-link" data-testid={`own-open-${o.kind}`} onClick={() => toast(x.toastLater)}>
            {o.kind === 'workspace' ? x.openWorkspace : x.openConversation}
          </button>
        </li>
      ))}
    </ul>
  );
}
function OwnBody() {
  const h = useHost(), x = t();
  return (
    <>
      {!h.on ? <p className="s-desc rq-pad" data-testid="own-off">{x.ownOff}</p> : null}
      {h.own.length ? <OwnList /> : <p className="rq-pad" data-testid="own-empty">{x.ownEmpty}</p>}
      <p className="s-desc rq-pad" data-testid="own-how">{x.ownHow}</p>
    </>
  );
}
function Head({children, aside}: {children: ReactNode; aside?: ReactNode}) {
  return <h3 className="s-h3 rq-h3">{children}{aside}</h3>;
}
function Placeholder() {
  return <span className="rq-placeholder" data-testid="placeholder-tag">{t().placeholder}</span>;
}

// ---- A Lista ----
function DirectionA() {
  const h = useHost(), x = t();
  const off = !h.on || h.readError;
  return (
    <div className="s-stack rq-a" data-testid="direction-a">
      <p className="s-intro">{x.intro}</p>
      {h.readError ? <ReadError /> : null}
      <div className="s-card"><OnRow /></div>
      <Head aside={<Placeholder />}>{x.sound}</Head>
      <div className="s-card" data-settings-row="attention-sound-default" tabIndex={-1}>
        <p className="s-desc rq-pad">{x.soundDesc}</p>
        <div role="radiogroup" aria-label={x.sound} className="rq-list" data-testid="sound-list">
          {SOUND_IDS.map((id) => (
            <div key={id} className="rq-list-row" data-selected={h.sound === id || undefined}>
              <button type="button" role="radio" aria-checked={h.sound === id} disabled={off} data-testid={`pick-${id}`}
                className="rq-pick" onClick={() => { set({sound: id}); listen(id); }}>
                <span className="ah-radio-dot" aria-hidden="true" data-on={h.sound === id || undefined} />
                <span>{x.sounds[id]}</span>
              </button>
              <ListenButton sound={id} />
            </div>
          ))}
        </div>
      </div>
      <div className="s-card"><EventsRow /><WatchRow /></div>
      <Head>{x.device}</Head>
      <div className="s-card"><p className="s-desc rq-pad">{x.deviceDesc}</p><DeviceRows /></div>
      <Head>{x.own}</Head>
      <div className="s-card" data-testid="own-card"><p className="s-desc rq-pad">{x.ownDesc}</p><OwnBody /></div>
    </div>
  );
}

// ---- B Valikko ----
function DirectionB() {
  const h = useHost(), x = t();
  const off = !h.on || h.readError;
  const w = h.own.filter((o) => o.kind === 'workspace').length, c = h.own.length - w;
  return (
    <div className="s-stack rq-b" data-testid="direction-b">
      <p className="s-intro">{x.intro}</p>
      {h.readError ? <ReadError /> : null}
      <div className="s-card">
        <OnRow />
        <div className="s-row" data-settings-row="attention-sound-default" tabIndex={-1}>
          <div className="s-lbl"><strong>{x.sound}</strong><span className="s-desc">{x.soundDesc}</span><Placeholder /></div>
          <div className="s-val rq-menu-val">
            <ChoiceMenu data-testid="sound-menu" label={x.sound} value={h.sound} isDisabled={off}
              options={SOUND_IDS.map((id) => ({id, label: x.sounds[id]}))} onChange={(v) => { set({sound: v}); listen(v); }} />
            <ListenButton sound={h.sound} />
          </div>
        </div>
        <EventsRow compact />
        <WatchRow />
        <div className="rq-band"><span className="s-h3">{x.device}</span><span className="s-desc">{x.deviceDesc}</span></div>
        <DeviceRows />
        <div className="rq-band rq-own-band" data-testid="own-card">
          <span className="s-h3">{x.own}</span>
          {h.own.length ? (
            <span className="rq-own-line">
              <span data-testid="own-summary">{x.ownSummary(w, c)}</span>
              <button type="button" className="rq-link" data-testid="own-toggle" aria-expanded={h.ownOpen} onClick={() => set({ownOpen: !h.ownOpen})}>
                {h.ownOpen ? x.hide : x.show}
              </button>
            </span>
          ) : <span data-testid="own-empty">{x.ownEmpty}</span>}
          {h.ownOpen && h.own.length ? <><span className="s-desc">{x.ownDesc}</span><OwnList /></> : null}
          {!h.on ? <span className="s-desc" data-testid="own-off">{x.ownOff}</span> : null}
          <span className="s-desc" data-testid="own-how">{x.ownHow}</span>
        </div>
      </div>
    </div>
  );
}

// ---- C Laatat ----
function Ladder() {
  const h = useHost(), x = t();
  const ws = h.own.find((o) => o.kind === 'workspace' && o.sound);
  const cv = h.own.find((o) => o.kind === 'conversation');
  return (
    <div className="rq-ladder" data-testid="ladder" data-off={!h.on || undefined}>
      <p className="rq-ladder-lead"><strong>{x.ladderLead}</strong> <span className="s-desc">{x.ownDesc}</span></p>
      <ol>
        <li data-step="default"><span className="rq-step">{x.defaultStep}</span><span className="rq-step-sound"><Icon name="music" />{x.sounds[h.sound]}</span></li>
        <li data-step="workspace"><span className="rq-step">{x.workspace}</span>
          {ws ? <><code>{ws.name}</code><span className="rq-step-sound"><Icon name="music" />{ownSound(ws)}</span></> : <span className="s-desc">{x.defaultStep}</span>}
          <button type="button" className="rq-link" data-testid="own-open-workspace" onClick={() => toast(x.toastLater)}>{x.openWorkspace}</button>
        </li>
        <li data-step="conversation"><span className="rq-step">{x.conversation}</span>
          {cv ? <><span>{cv.name}</span><span className="rq-step-sound"><Icon name="music" />{ownSound(cv)}</span></> : <span className="s-desc">{x.defaultStep}</span>}
          <button type="button" className="rq-link" data-testid="own-open-conversation" onClick={() => toast(x.toastLater)}>{x.openConversation}</button>
        </li>
      </ol>
      {h.own.length ? <OwnList /> : <p data-testid="own-empty">{x.ownEmpty}</p>}
      {!h.on ? <p className="s-desc" data-testid="own-off">{x.ownOff}</p> : null}
      <p className="s-desc" data-testid="own-how">{x.ownHow}</p>
    </div>
  );
}
function DirectionC() {
  const h = useHost(), x = t();
  const off = !h.on || h.readError;
  return (
    <div className="s-stack rq-c" data-testid="direction-c">
      <p className="s-intro">{x.intro}</p>
      {h.readError ? <ReadError /> : null}
      <div className="s-card"><OnRow /></div>
      <Head aside={<Placeholder />}>{x.sound}</Head>
      <div role="radiogroup" aria-label={x.sound} className="rq-tiles" data-testid="sound-list" data-settings-row="attention-sound-default" tabIndex={-1}>
        {SOUND_IDS.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={h.sound === id} disabled={off} data-testid={`pick-${id}`}
            className="rq-tile" onClick={() => { set({sound: id}); listen(id); }}>
            <Shape sound={id} />
            <span className="rq-tile-name">{x.sounds[id]}</span>
            {h.sound === id ? <Icon name="check" /> : <Icon name="run" />}
          </button>
        ))}
      </div>
      <div className="s-card"><EventsRow compact /><WatchRow /></div>
      <Head>{x.own}</Head>
      <div className="s-card" data-testid="own-card"><Ladder /></div>
      <Head>{x.device}</Head>
      <div className="s-card"><p className="s-desc rq-pad">{x.deviceDesc}</p><DeviceRows /></div>
    </div>
  );
}

// ---- The page ----
/** Puts the direction's body into production's .s-main after the h2, above
 * the server version line every section ends with. */
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
      {slot ? createPortal(direction === A ? <DirectionA /> : direction === B ? <DirectionB /> : <DirectionC />, slot) : null}
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

let reviewTheme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
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
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 2500); return () => clearTimeout(id); }, [note]);
  const reset = (next = s) => { scenario = next; host = SCENARIOS[next](); setS(next); setNote(''); setGeneration((n) => n + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); reset();
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => reset()}>{x.reset}</button>
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

const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { host = SCENARIOS[scenario](); flushSync(() => reactRoot.render(view === '' ? null : view)); }};
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
