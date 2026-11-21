import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AccountIdentity, accountLabel} from '../../../../web/src/components/Account';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton, Segmented} from '../../../../web/src/components/ControlElements';
import {Menu} from '../../../../web/src/components/Overlays';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {setPersonalLanguage, useText} from '../../../../web/src/i18n';
import {accountText} from '../../../../web/src/text/account';
import {getThemeChoice, setThemeChoice, type ThemeChoice} from '../../../../web/src/theme';
import {getWorkPreference, setWorkPreference} from '../../../../web/src/workPreference';
import {type Lang, SCENARIO_IDS, type Scenario, TEXT} from './text';
import './round.css';

// attention-sound, round 5: muting this device from the account menu.
// Axis: how close to hand "mute this device" is, and what it is next to.
// A puts a Sounds row in the menu beside Theme and Agent's work (both are
// already this device's choices). B puts a speaker button beside the account
// button: one press, no menu. C offers a timed quiet in the menu: an hour on
// every device (personal, the host's preferences file) or this device until
// restored (the browser). Same facts in all three: the personal off switch
// in Settings silences every device and the menu says so; Quiet at night
// (personal, follows the device's day/night appearance) silences at night
// and a device unmute does not override it; a muted device shows on the
// account button so a forgotten mute is visible.
//
// The shelf is production's AccountShelf rebuilt from the same parts
// (Menu, AccountIdentity, Segmented, the theme and work preferences); only
// the sound row, the speaker button and the mark on the avatar are the
// round's. Production has no speaker icon yet; Speaker below is the round's.

const NAMES = ['A Rivi valikossa', 'B Kaiutin', 'C Hiljennä hetkeksi'];
const A = 0, B = 1, C = 2;
let lang: Lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const time = (s: string) => (lang === 'en' ? s.replace('.', ':') : s);

// ---- The default sound (round 1's Ovi, simplified) ----
declare global { interface Window { __smPlays: string[] } }
window.__smPlays = [];
let audio: AudioContext | null = null;
function chime() {
  window.__smPlays.push('ovi');
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const now = audio.currentTime + 0.02;
    for (const [f, at] of [[587.33, 0], [880, 0.14]] as const) {
      for (const [mult, g] of [[1, 0.35], [2.76, 0.06]] as const) {
        const o = audio.createOscillator(), e = audio.createGain();
        o.frequency.value = f * mult;
        e.gain.setValueAtTime(0.0001, now + at);
        e.gain.exponentialRampToValueAtTime(g, now + at + 0.008);
        e.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.7);
        o.connect(e).connect(audio.destination);
        o.start(now + at); o.stop(now + at + 0.75);
      }
    }
  } catch { /* no audio device: the review still records it */ }
}

// ---- State ----
// off: the personal switch in Settings (host). muted: this device (browser).
// snooze: C's hour on every device (host). nightOn: Quiet at night (host);
// isNight: the device's appearance rhythm currently says night.
type Host = {off: boolean; muted: boolean; snooze: boolean; nightOn: boolean; isNight: boolean; clock: string};
const base: Host = {off: false, muted: false, snooze: false, nightOn: true, isNight: false, clock: '14.40'};
const SCENARIOS: Record<Scenario, () => Host> = {
  oletus: () => ({...base}),
  laite: () => ({...base, muted: true}),
  kaikkialla: () => ({...base, off: true}),
  yo: () => ({...base, isNight: true, clock: '23.10'}),
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
const snoozeUntil = (h: Host) => { const [hh, mm] = h.clock.split('.').map(Number); return `${(hh + 1) % 24}.${String(mm).padStart(2, '0')}`; };
type Status = 'on' | 'off' | 'snooze' | 'device' | 'night';
/** What silences this device now, the strongest reason first. */
function status(h: Host): Status {
  if (h.off) return 'off';
  if (h.snooze) return 'snooze';
  if (h.muted) return 'device';
  if (h.nightOn && h.isNight) return 'night';
  return 'on';
}
function statusText(h: Host) {
  const x = t(), s = status(h);
  return s === 'off' ? x.stOff : s === 'snooze' ? x.stSnooze(time(snoozeUntil(h))) : s === 'device' ? x.stDevice : s === 'night' ? x.stNight : x.stOn;
}
const mutedHere = (h: Host) => h.muted || h.snooze;
const setMuted = (muted: boolean) => { set({muted}); toast(muted ? t().toastMuted : t().toastUnmuted); };

// ---- Pieces ----
/** Speaker drawn in production's icon stroke; slashed when quiet. */
function Speaker({muted}: {muted?: boolean}) {
  return (
    <svg className="sm-speaker" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
      {muted ? <path d="M10.5 6l3.5 4M14 6l-3.5 4" /> : <path d="M10.6 5.6a3.2 3.2 0 0 1 0 4.8M12.4 4a5.6 5.6 0 0 1 0 8" />}
    </svg>
  );
}
/** The mark on the account picture while this device is muted or snoozed:
 * a forgotten mute shows without opening anything. Night and off are
 * standing choices and get no mark. */
function Badge() {
  const h = useHost();
  if (!mutedHere(h) || h.off) return null;
  return <span className="sm-badge" data-testid="avatar-badge" title={statusText(h)}><Speaker muted /></span>;
}
/** The state under the row. scope: A says "this device only" while it plays,
 * so the reach of Quiet is read before pressing it. */
function StateLine({scope = false}: {scope?: boolean}) {
  const h = useHost(), x = t(), s = status(h);
  return (
    <p className="sm-state" data-testid="sound-state" data-status={s}>
      {s === 'night' ? <Icon name="moon" /> : <Speaker muted={s !== 'on'} />}
      <span>
        <span data-testid="sound-state-text">{s === 'on' && scope ? x.scopeHere : statusText(h)}</span>
        {s === 'off' ? <span className="sm-why"> · {x.stOffWhy}</span> : null}
        {s === 'on' || s === 'device' || s === 'off' ? (
          <> · <button type="button" className="sm-link" data-testid="sound-settings" onClick={() => toast(x.toastSettings)}>{x.settingsLink}</button></>
        ) : null}
      </span>
    </p>
  );
}
// ---- Direction rows inside the menu ----
function SoundRowA() {
  const h = useHost(), x = t();
  return (
    <>
      <div className="ah-account-menu-theme-row" data-testid="sound-row">
        <span>{x.sound}</span>
        <Segmented data-testid="device-mute" label={`${x.sound}, ${x.scopeHere}`} className="ah-account-menu-theme"
          isDisabled={h.off}
          options={[{id: 'plays', label: x.plays}, {id: 'quiet', label: x.quiet}]}
          value={h.off ? undefined : h.muted ? 'quiet' : 'plays'} onChange={(v) => setMuted(v === 'quiet')} />
      </div>
      <StateLine scope />
    </>
  );
}
function SoundRowB() {
  const x = t();
  return (
    <>
      <div className="ah-account-menu-theme-row" data-testid="sound-row"><span>{x.sound}</span></div>
      <StateLine />
    </>
  );
}
function SoundRowC() {
  const h = useHost(), x = t(), s = status(h);
  return (
    <>
      <div className="ah-account-menu-theme-row" data-testid="sound-row">
        <span>{x.sound}</span>
        <span className="sm-c-actions">
          {s === 'snooze' || s === 'device' ? (
            <ControlButton size="row" variant="secondary" data-testid="sound-restore" aria-label={x.restoreLabel}
              onPress={() => { set({snooze: false, muted: false}); toast(x.toastUnmuted); }}>{x.restore}</ControlButton>
          ) : (
            <>
              <ControlButton size="row" variant="secondary" data-testid="snooze-hour" aria-label={x.oneHourLabel} title={x.oneHourLabel}
                isDisabled={h.off} onPress={() => { set({snooze: true}); toast(x.toastSnooze(time(snoozeUntil(host)))); }}>{x.oneHour}</ControlButton>
              <ControlButton size="row" variant="secondary" data-testid="device-mute-c" aria-label={x.thisDeviceLabel} title={x.thisDeviceLabel}
                isDisabled={h.off} onPress={() => setMuted(true)}>{x.thisDevice}</ControlButton>
            </>
          )}
        </span>
      </div>
      <StateLine />
    </>
  );
}

/** Production's AccountShelf, rebuilt from its parts with the round's row. */
function Shelf({direction}: {direction: number}) {
  const h = useHost();
  const a = useText(accountText), x = t();
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice);
  const [work, setWork] = useState(getWorkPreference);
  useEffect(() => {
    const sync = () => setTheme(getThemeChoice());
    const syncWork = () => setWork(getWorkPreference());
    window.addEventListener('nah:theme-change', sync);
    window.addEventListener('nah:work-change', syncWork);
    return () => { window.removeEventListener('nah:theme-change', sync); window.removeEventListener('nah:work-change', syncWork); };
  }, []);
  const person = {name: 'Aino Esimerkki', email: 'aino@example.test', avatar_url: ''};
  const compactName = accountLabel(person.name).split(/\s+/)[0];
  const themes = [
    {id: 'system', label: a.themeSystem, icon: 'system'},
    {id: 'light', label: a.themeLight, icon: 'sun'},
    {id: 'dark', label: a.themeDark, icon: 'moon'},
    {id: 'contrast', label: a.themeContrast, icon: 'contrast'},
  ] as const;
  const s = status(h);
  const speakerLabel = s === 'off' ? x.stOff : h.muted ? `${x.speakerMuted}. ${x.unmuteDevice}` : s === 'night' ? `${x.stNight}. ${x.muteDevice}` : x.muteDevice;
  return (
    <div className="ah-account-shelf sm-shelf" data-account-controls>
      <Menu
        label={a.accountMenu}
        triggerLabel={mutedHere(h) && !h.off ? `${a.accountMenuOf(compactName)}, ${statusText(h)}` : a.accountMenuOf(compactName)}
        triggerPresentation="account"
        trigger={<span className="ah-account-trigger sm-trigger"><AccountIdentity profile={person} compact />{direction === B ? null : <Badge />}</span>}
        heading={<AccountIdentity profile={person} />}
        betweenItems={
          <>
            <div className="ah-account-menu-theme-row">
              <span>{a.theme}</span>
              <Segmented data-testid="theme-choice" label={a.theme} className="ah-account-menu-theme"
                options={themes.map(({id, label, icon}) => ({id, label, icon: <Icon name={icon} />, iconOnly: true}))}
                value={theme} onChange={setThemeChoice} />
            </div>
            <div className="ah-account-menu-theme-row">
              <span>{a.agentWork}</span>
              <Segmented label={a.agentWork} className="ah-account-menu-theme"
                options={[{id: 'hidden', label: a.hidden}, {id: 'visible', label: a.visible}]}
                value={work} onChange={setWorkPreference} />
            </div>
            <div className="sm-sound" data-direction={direction}>
              {direction === A ? <SoundRowA /> : direction === B ? <SoundRowB /> : <SoundRowC />}
            </div>
          </>
        }
        popoverClassName="ah-account-menu sm-menu"
        placement="top start"
        items={[{id: 'settings', label: a.settings}, {id: 'logout', label: a.logout, danger: true}]}
        onAction={(id) => { if (id === 'settings') toast(x.toastSettings); }}
      />
      {direction === B ? (
        <ControlButton size="row" variant="quiet" presentation="icon" data-testid="speaker" data-status={s}
          className="sm-speaker-button" aria-label={speakerLabel} aria-pressed={h.muted} isDisabled={h.off}
          onPress={() => setMuted(!h.muted)}>
          {s === 'night' ? <span className="sm-night"><Speaker /><Icon name="moon" /></span> : <Speaker muted={s !== 'on'} />}
        </ControlButton>
      ) : null}
    </div>
  );
}

// ---- Review aid in the main area ----
function Aid() {
  const h = useHost(), x = t();
  const [fired, setFired] = useState('');
  const s = status(h);
  const why = (st: Status) => (st === 'off' ? x.whyOff : st === 'snooze' ? x.whySnooze : st === 'device' ? x.whyDevice : x.whyNight);
  const phone: Status = h.off ? 'off' : h.snooze ? 'snooze' : h.nightOn && h.isNight ? 'night' : 'on';
  const cell = (st: Status) => (st === 'on' ? x.aidPlays : x.aidSilent(why(st)));
  return (
    <section className="sm-aid" data-testid="aid">
      <h2>{x.aidTitle}</h2>
      <p className="sm-aid-desc">{x.aidDesc} {x.clock(time(h.clock))}</p>
      <dl>
        <div data-testid="aid-here" data-plays={s === 'on' || undefined}><dt>{x.aidHere}</dt><dd>{cell(s)}</dd></div>
        <div data-testid="aid-other" data-plays={phone === 'on' || undefined}><dt>{x.aidOther}</dt><dd>{cell(phone)}</dd></div>
      </dl>
      <ControlButton size="row" variant="secondary" data-testid="aid-fire" onPress={() => {
        if (status(host) === 'on') chime();
        setFired(x.aidFired(cell(status(host))));
      }}><Icon name="run" />{x.aidFire}</ControlButton>
      {fired ? <p role="status" data-testid="aid-fired">{fired}</p> : null}
    </section>
  );
}

function Page({direction}: {direction: number}) {
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Habitat" connectionLabel="" filterValue="" resultSummary="3"
      listState="ready" onToggle={() => {}} onFilter={() => {}} onRefresh={() => {}}
      sessionActions={<Shelf direction={direction} />}>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle="Habitat" rail={rail} main={<div className="sm-main"><Aid /></div>} />
    </StatusBellProvider>
  );
}

/** Opens the menu (and on the phone the drawer) so the direction shows. */
function openMenu() {
  const phone = innerWidth < 800;
  if (phone && !document.querySelector('.ah-shell-body.ah-mobile-open')) document.querySelector<HTMLElement>('[data-testid="navigation-open"]')?.click();
  // A pointer press, not el.click(): a virtual click opens the menu as the
  // keyboard does, with focus rings on its items.
  setTimeout(() => {
    const b = document.querySelector<HTMLElement>('[data-testid="account-menu-trigger"]');
    if (!b) return;
    const o = {bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, detail: 1};
    b.dispatchEvent(new PointerEvent('pointerdown', o));
    b.dispatchEvent(new PointerEvent('pointerup', {...o, buttons: 0}));
    b.dispatchEvent(new MouseEvent('click', o));
  }, phone ? 300 : 50);
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(getThemeChoice() === 'dark' ? 'dark' : 'light');
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
    const sync = () => { const c = getThemeChoice(); if (c === 'light' || c === 'dark') setTheme(c); };
    window.addEventListener('nah:theme-change', sync);
    return () => window.removeEventListener('nah:theme-change', sync);
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 2500); return () => clearTimeout(id); }, [note]);
  useEffect(() => { openMenu(); }, [generation]);
  const reset = (next = s) => { scenario = next; host = SCENARIOS[next](); setS(next); setNote(''); setGeneration((n) => n + 1); };
  return (
    <div className={`sm-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="sm-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => setThemeChoice(e.target.value as ThemeChoice)}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); reset();
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="sm-reset" onClick={() => reset()}>{x.reset}</button>
        <p className="sm-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="sm-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="sm-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="sm-stage">
        <MemoryRouter key={`${generation}-${s}-${language}`} initialEntries={['/workspaces']}>
          <Page direction={direction} />
        </MemoryRouter>
      </div>
      {note ? <p className="sm-toast" role="status" data-testid="sm-toast">{note}</p> : null}
    </div>
  );
}

if (new URLSearchParams(location.search).get('theme') === 'dark') setThemeChoice('dark');
else setThemeChoice('light');
const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared picker wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { host = SCENARIOS[scenario](); flushSync(() => reactRoot.render(view === '' ? null : view)); }};
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
