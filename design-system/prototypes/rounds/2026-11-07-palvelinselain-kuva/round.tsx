import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFloatingAction, ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {AgentTurn, type TurnStep} from '../../../../web/src/components/AgentTurn';
import {PiToolUse} from '../../../../web/src/components/PiBlocks';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {setWorkPreference} from '../../../../web/src/workPreference';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says, and
// the agent's work is shown as it happens.
setPersonalLanguage('fi');
setWorkPreference('visible');

// proto-remote-browser-session, round 2. Jari (7.11.2026) chose direction 3
// "Pyydettäessä" of round 1: the person's server browser appears only when it
// is needed, as a sheet over the conversation. This round riffs the picture of
// the agent's browser work while the sheet is closed: what it shows, how big
// it is, how it opens the sheet, how it looks when the agent has finished or
// waits for the person (the code again mid-task), and how the person sees which
// conversation drives the shared browser when another conversation wants it.
// Host facts (research-remote-browser-session): one browser per person, shared
// by all their conversations; one client drives at a time and the host refuses
// the rest; the person can take control; the browser stops after 24 h unused.
const directions = ['1 Kuva', '2 Palkki', '3 Ikkuna'];
const LINES = [
  '1 Kuva keskustelussa: iso elävä kuva keskustelun lopussa; kun agentti odottaa sinua, kuva on itse pyyntö, ja toisen keskustelun kuva kertoo, kuka selainta käyttää.',
  '2 Palkki kentän yllä: kapea palkki pienellä kuvalla kirjoituskentän yllä kaikissa keskusteluissa; se nimeää keskustelun, joka selainta käyttää, ja sen, joka odottaa.',
  '3 Kelluva ikkuna: pieni ikkuna keskustelun nurkassa seuraa sinua keskustelusta toiseen; otsikko on selainta käyttävä keskustelu, ja valmiina ikkuna kutistuu napiksi.',
];
const R1 = 0, R2 = 1, R3 = 2;

// ---------- The story: Aino Virtanen, Contoso, two conversations, one browser ----------

type Conv = 'osto' | 'rekry';
type Page = 'mfa' | 'home' | 'list' | 'expired' | 'li-home' | 'li-results';
/** What a conversation's agent is doing with the browser. */
type AgentState = 'working' | 'queued' | 'asking' | 'paused' | 'done';
type Holder = Conv | 'person' | null;
const TITLE: Record<Conv, string> = {osto: 'Lokakuun ostolaskut', rekry: 'Rekrytointi: myyjä'};
const other = (c: Conv): Conv => (c === 'osto' ? 'rekry' : 'osto');
type Agent = {step: number; state: AgentState; took: string; page: Page; movedTo: string};
const store = {
  view: 'osto' as Conv, sheet: false, page: 'list' as Page, code: '',
  holder: 'osto' as Holder, personFor: null as Conv | null, pipMin: false, pipGone: false,
  osto: {step: 1, state: 'working', took: '', page: 'list', movedTo: ''} as Agent,
  rekry: {step: -1, state: 'queued', took: '', page: 'list', movedTo: ''} as Agent,
};
// The check script reads the story's state from here; nothing in the view does.
(window as unknown as {rbStore: typeof store}).rbStore = store;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
let timer = 0;
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return store;
}

/** Each step is an ordinary `selain` tool call in its own conversation's native history. */
type Step = {at: string; target: string; said: string; page: Page; ask?: boolean; got?: number};
const STEPS: Record<Conv, Step[]> = {
  osto: [
    {at: '10.14', target: 'Tarkista kirjautuminen', said: 'Etusivulla lukee Aino Virtanen, joten olet kirjautunut.', page: 'home'},
    {at: '10.14', target: 'Avaa Ostot › Ostolaskut', said: 'Ostolaskujen lista on auki.', page: 'list'},
    {at: '10.15', target: 'Rajaa 1.10.–31.10.2026', said: 'Lokakuulta on 14 ostolaskua.', page: 'list'},
    {at: '10.15', target: 'Lataa laskut 1–6 PDF:nä', said: 'Kuusi laskua ladattu kansioon ostolaskut-10/.', page: 'list', got: 6},
    {at: '10.16', target: 'Lataa laskut 7–14 PDF:nä', said: 'Netvisor pyytää vahvistuskoodia uudelleen. En voi syöttää sitä puolestasi.', page: 'expired', got: 6, ask: true},
    {at: '10.18', target: 'Lataa laskut 7–14 PDF:nä', said: 'Loput kahdeksan laskua ladattu.', page: 'list', got: 14},
    {at: '10.19', target: 'Kirjoita yhteenveto', said: 'ostolaskut-lokakuu.md kirjoitettu.', page: 'list', got: 14},
  ],
  rekry: [
    {at: '10.19', target: 'Avaa LinkedIn Recruiter', said: 'Haku on auki.', page: 'li-home'},
    {at: '10.20', target: 'Hae: myyjä, Helsinki, B2B', said: 'Hakuun osui 23 profiilia.', page: 'li-results'},
    {at: '10.21', target: 'Kirjoita ehdokaslista', said: 'myyja-ehdokkaat.md kirjoitettu.', page: 'li-results'},
  ],
};
const ASK = 4;
const TICK = 2000;
const stepOf = (c: Conv) => (store[c].step >= 0 ? STEPS[c][store[c].step] : undefined);
const nowAt = (c: Conv) => stepOf(c)?.at ?? '10.14';
const lastStep = (c: Conv) => STEPS[c].length - 1;

function advance() {
  window.clearTimeout(timer);
  const c = store.holder;
  if (c !== 'osto' && c !== 'rekry' || store[c].state !== 'working') return;
  timer = window.setTimeout(() => {
    if (store.holder !== c || store[c].state !== 'working') return;
    const a = store[c];
    a.step += 1;
    const s = STEPS[c][a.step];
    store.page = s.page; a.page = s.page;
    if (s.ask) { a.state = 'asking'; store.holder = 'person'; store.personFor = c; }
    else if (a.step === lastStep(c)) { a.state = 'done'; release(); return; }
    notify();
    advance();
  }, TICK);
}
/** The driving client let go: the next conversation waiting for the browser gets it. */
function release() {
  store.holder = null; store.personFor = null;
  const next = (['osto', 'rekry'] as Conv[]).find((c) => store[c].state === 'queued');
  if (next) { store.holder = next; store[next].state = 'working'; store[next].movedTo = ''; store.pipGone = false; }
  notify();
  advance();
}

// ---------- Actions: the same in every riff, only their place differs ----------

function openSheet() { store.sheet = true; notify(); }
function closeSheet() { store.sheet = false; notify(); }
function goTo(c: Conv) { store.view = c; notify(); }
function verify() { store.page = store.page === 'expired' ? 'list' : 'home'; store.code = ''; notify(); }
const signedIn = () => store.page === 'home' || store.page === 'list' || store.page.startsWith('li-');
/** The person takes the browser from the conversation that drives it; its agent waits. */
function takeControl() {
  const c = store.holder;
  if (c !== 'osto' && c !== 'rekry') return;
  window.clearTimeout(timer);
  store[c].state = 'paused'; store[c].took = nowAt(c); store.holder = 'person'; store.personFor = c; notify();
}
/** "Anna takaisin agentille": the browser goes back to the conversation it was taken from. */
function handBack() {
  const c = store.personFor;
  if (!c) return;
  store[c].state = 'working'; store.holder = c; store.personFor = null; store.sheet = false;
  notify();
  advance();
}
/** The person gives the browser to this conversation; the one driving it waits for its turn. */
function moveHere(c: Conv) {
  const from = store.holder;
  if (from !== other(c)) return;
  window.clearTimeout(timer);
  store[from].state = 'queued'; store[from].movedTo = nowAt(from);
  store.holder = c; store[c].state = 'working'; store[c].movedTo = '';
  notify();
  advance();
}

type Scene = 'working' | 'asking' | 'done';
function resetStore(scene: Scene = 'working', view: Conv = 'osto') {
  window.clearTimeout(timer);
  const fresh = (step: number, state: AgentState, page: Page): Agent => ({step, state, took: '', page, movedTo: ''});
  Object.assign(store, {view, sheet: false, code: '', personFor: null, pipMin: false, pipGone: false, rekry: fresh(-1, 'queued', 'list')});
  if (scene === 'working') Object.assign(store, {page: 'list', holder: 'osto', osto: fresh(1, 'working', 'list')});
  if (scene === 'asking') Object.assign(store, {page: 'expired', holder: 'person', personFor: 'osto', osto: fresh(ASK, 'asking', 'expired')});
  if (scene === 'done') {
    // The purchase invoices are done and the browser went to the waiting conversation.
    Object.assign(store, {page: 'li-home', holder: 'rekry', osto: fresh(lastStep('osto'), 'done', 'list'), rekry: fresh(0, 'working', 'li-home')});
  }
}

// ---------- Small pieces ----------

const noop = () => {};
const T0 = Date.UTC(2026, 10, 6, 8, 11);
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'talous',
};
/** A globe; the production icon set has none yet. Drawn like Icon: 24-px grid, stroke. */
function Globe(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" />
    </svg>
  );
}
/** Who holds the browser, seen from conversation `c`. Words and an icon, never a coloured edge. */
function DriverChip({c}: {c: Conv}) {
  const s = useStore();
  const h = s.holder;
  const label = h === null ? 'Vapaa'
    : h === 'person' ? (s[s.personFor!].state === 'asking' ? 'Odottaa sinua' : 'Sinä ohjaat')
      : h === c ? 'Agentti käyttää' : `${TITLE[h]} käyttää`;
  const tone = h === 'person' && s[s.personFor!].state === 'asking' ? ' rb-driver-ask' : h === c ? ' rb-driver-agent' : '';
  return (
    <span className={`rb-driver${tone}`} data-testid="driver" data-holder={String(h)}>
      <Icon name={h === 'person' || h === null ? 'user' : 'agent'} aria-hidden="true" />{label}
    </span>
  );
}
/** One sentence about the browser, seen from conversation `c`. */
function nowLine(c: Conv) {
  const s = store, h = s.holder, a = s[c];
  if (h === 'person' && s.personFor === c) {
    if (a.state === 'asking') return signedIn() ? 'Koodi hyväksytty. Anna selain takaisin, niin agentti jatkaa.' : 'Netvisor pyytää vahvistuskoodia. Agentti odottaa, että syötät sen.';
    return `Otit ohjauksen klo ${a.took}. Agentti jatkaa, kun annat selaimen takaisin.`;
  }
  if (h === c) return stepOf(c) ? `${stepOf(c)!.target}` : 'Agentti aloittaa…';
  if (h === 'person') return `${TITLE[s.personFor!]} odottaa sinua.`;
  if (h) return `${TITLE[h]}: ${stepOf(h) ? stepOf(h)!.target.toLowerCase() : 'aloittaa'}`;
  return 'Selain on vapaa ja yhä kirjautunut.';
}
/** Who else waits for the browser, seen from conversation `c`; empty when nobody. */
function waitLine(c: Conv) {
  const o = other(c);
  if (store[o].state === 'queued') return `${TITLE[o]} odottaa vuoroaan`;
  if (store[c].state === 'queued') return 'Tämä keskustelu odottaa vuoroaan';
  return '';
}

// ---------- The remote browser (a mock of the person's server browser) ----------

const URLS: Record<Page, string> = {
  mfa: 'login.netvisor.fi/vahvista', home: 'netvisor.fi/etusivu',
  list: 'netvisor.fi/ostot/ostolaskut?alku=1.10.2026&loppu=31.10.2026', expired: 'login.netvisor.fi/vahvista?jatka=ostolaskut',
  'li-home': 'linkedin.com/talent/search', 'li-results': 'linkedin.com/talent/search?q=myyj%C3%A4&sijainti=Helsinki',
};
const INVOICES = [
  ['Elisa Oyj', '02.10.', '389,40', 'IT'], ['Telia Finland', '03.10.', '214,90', 'IT'], ['Lyreco Finland', '06.10.', '96,12', 'Toimisto'],
  ['Sponda Oy', '01.10.', '4 820,00', 'Toimitilat'], ['Fennia', '08.10.', '612,00', 'Hallinto'], ['Amazon Web Services', '09.10.', '1 248,37', 'IT'],
  ['Kespro', '13.10.', '183,55', 'Toimisto'], ['HSL', '14.10.', '64,80', 'Matkat'], ['Finnair', '16.10.', '418,00', 'Matkat'],
];
const PEOPLE = [['Laura K.', 'Myyntipäällikkö, SaaS', 'Helsinki'], ['Mikko R.', 'Account Executive', 'Espoo'], ['Sanna V.', 'B2B-myyjä', 'Helsinki'], ['Joonas P.', 'Key Account Manager', 'Vantaa'], ['Elina H.', 'Myyjä, ohjelmistot', 'Helsinki']];
/** The remote page. Its colours are the website's, not Habitat's: a remote browser shows the site as it is. */
function SitePage({page, live, got}: {page: Page; live: boolean; got: number}) {
  const s = useStore();
  if (page === 'mfa' || page === 'expired')
    return (
      <div className="rb-site-center">
        <div className="rb-site-card">
          <p className="rb-site-brand">netvisor</p>
          <h3>{page === 'expired' ? 'Vahvista uudelleen' : 'Kaksivaiheinen tunnistus'}</h3>
          {page === 'expired' ? <p className="rb-site-note">Istuntosi vaatii vahvistuksen ennen kuin voit ladata lisää aineistoa.</p> : null}
          <label>Tunnistussovelluksen koodi
            <input data-testid={live ? 'site-code' : undefined} className="rb-site-field" inputMode="numeric" maxLength={6} placeholder="6 numeroa" disabled={!live} tabIndex={live ? 0 : -1}
              value={live ? s.code : ''} onChange={(e) => { store.code = e.target.value.replace(/\D/g, ''); notify(); }} />
          </label>
          <button type="button" data-testid={live ? 'site-verify' : undefined} className="rb-site-btn" disabled={!live || s.code.length !== 6} onClick={verify}>Vahvista</button>
        </div>
      </div>
    );
  if (page.startsWith('li-'))
    return (
      <div className="rb-site-app rb-site-li">
        <div className="rb-site-top"><span className="rb-site-brand">Recruiter</span><span className="rb-site-search">myyjä · Helsinki · B2B</span><span className="rb-site-user">Aino Virtanen</span></div>
        <div className="rb-site-main">
          {page === 'li-home' ? <h3>Haku</h3> : <><h3>23 profiilia</h3>
            <ul className="rb-site-people">{PEOPLE.map(([n, r, w]) => <li key={n}><span className="rb-site-face" aria-hidden="true">{n[0]}</span><span><b>{n}</b><small>{r} · {w}</small></span></li>)}</ul></>}
        </div>
      </div>
    );
  const ranged = s.osto.step >= 2;
  return (
    <div className="rb-site-app">
      <div className="rb-site-top"><span className="rb-site-brand">netvisor</span><span>Contoso Oy</span><span className="rb-site-user">Aino Virtanen</span></div>
      <div className="rb-site-body">
        <nav className="rb-site-nav"><span>Etusivu</span><span>Myynti</span><span className={page === 'list' ? 'on' : undefined}>Ostot</span><span>Palkat</span><span>Raportit</span></nav>
        {page === 'home' ? (
          <div className="rb-site-main">
            <h3>Tervetuloa, Aino Virtanen</h3>
            <div className="rb-site-tiles"><div><b>14</b> uutta ostolaskua</div><div><b>3</b> hyväksyttävää</div><div><b>2</b> myyntilaskua erääntyy</div></div>
          </div>
        ) : (
          <div className="rb-site-main">
            <h3>Ostolaskut</h3>
            <p className="rb-site-filter">Laskun päivä <span className="rb-site-field">{ranged ? '1.10.2026 – 31.10.2026' : 'Kaikki'}</span> {ranged ? <b>14 laskua</b> : null}</p>
            <table className="rb-site-table">
              <tbody>
                {INVOICES.map(([who, d, sum, cc], i) => (
                  <tr key={who}><td>{who}</td><td>{d}</td><td className="n">{sum}</td><td>{cc}</td><td className="dl">{i < got ? 'Ladattu' : ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
/** Where the agent's pointer is on each step, as a share of the screen. */
const POINTER: Record<Conv, [number, number][]> = {
  osto: [[62, 18], [16, 34], [52, 30], [88, 46], [50, 50], [88, 70], [70, 40]],
  rekry: [[40, 22], [60, 12], [50, 60]],
};
/**
 * The person's browser. `small` is the picture in the conversation: it never
 * takes input. `frozen` shows a conversation's last page after its agent let go.
 */
function BrowserScreen({small = false, frozen}: {small?: boolean; frozen?: Conv}) {
  const s = useStore();
  const page = frozen ? s[frozen].page : s.page;
  const live = !small && !frozen && (s.holder === 'person' || s.holder === null);
  const driving = !frozen && (s.holder === 'osto' || s.holder === 'rekry') ? s.holder : null;
  const [hint, setHint] = useState(false);
  const p = driving ? POINTER[driving][Math.max(0, s[driving].step)] ?? [50, 50] : null;
  const got = (frozen === 'osto' ? STEPS.osto[lastStep('osto')].got : stepOf('osto')?.got) ?? 0;
  return (
    <div className={`rb-screen${small ? ' rb-screen-small' : ''}`} data-testid={small ? 'mini-screen' : 'browser-screen'} data-page={page}>
      <div className="rb-chrome" aria-hidden={small}>
        <span className="rb-chrome-btns"><Icon name="back" /><Icon name="forward" /><Icon name="refresh" /></span>
        <span className="rb-url"><Icon name="lock" />{URLS[page]}</span>
      </div>
      <div className="rb-site" inert={!live}>
        <SitePage page={page} live={live} got={got} />
      </div>
      {p ? (
        <>
          <span className="rb-pointer" style={{left: `${p[0]}%`, top: `${p[1]}%`}} aria-hidden="true"><span>Agentti</span></span>
          {!small ? (
            <button type="button" className="rb-viewonly" data-testid="view-only" aria-label="Agentti käyttää selainta. Ota ohjaus, jos haluat käyttää sitä itse." onClick={() => setHint(true)}>
              {hint ? <span className="rb-viewonly-hint">Agentti käyttää selainta. Ota ohjaus, jos haluat käyttää sitä itse.</span> : null}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
/** The picture as a button that opens the sheet. */
function Picture({className, frozen, label = 'Näytä selain isona'}: {className: string; frozen?: Conv; label?: string}) {
  return (
    <button type="button" className={`rb-pic ${className}`} data-testid="picture" onClick={openSheet} aria-label={label}>
      <BrowserScreen small frozen={frozen} />
    </button>
  );
}

/** The action that fits the moment, seen from conversation `c`. */
function MainAction({c, size = 'row'}: {c: Conv; size?: 'row' | 'page'}) {
  const s = useStore();
  const h = s.holder;
  if (h === 'person' && s.personFor === c) {
    if (s[c].state === 'asking' && !s.sheet)
      return <ControlButton data-testid="enter-code" size={size} variant="primary" onPress={openSheet}><Globe /> Syötä koodi</ControlButton>;
    return <ControlButton data-testid="hand-back" size={size} variant="primary" isDisabled={!signedIn()} onPress={handBack}>Anna takaisin agentille</ControlButton>;
  }
  if (h === c) return <ControlButton data-testid="take-control" size={size} variant="secondary" onPress={takeControl}>Ota ohjaus</ControlButton>;
  if (h === other(c) && s[c].state === 'queued')
    return <ControlButton data-testid="move-here" size={size} variant="secondary" onPress={() => moveHere(c)}>Siirrä tälle</ControlButton>;
  if (h === other(c) || (h === 'person' && s.personFor === other(c)))
    return <ControlButton data-testid="go-driver" size={size} variant="quiet" onPress={() => goTo(other(c))}>Siirry keskusteluun</ControlButton>;
  return null;
}

// ---------- Riff 1: a large live picture at the end of the conversation ----------

function InlinePicture({c}: {c: Conv}) {
  const s = useStore();
  const a = s[c], h = s.holder;
  const asking = h === 'person' && s.personFor === c && a.state === 'asking';
  const mine = h === c || (h === 'person' && s.personFor === c);
  if (a.state === 'done') {
    const n = STEPS[c].length;
    return (
      <section className="rb-inline rb-inline-done" data-testid="thumb" data-state="done" aria-label="Agentin selaintyö">
        <Picture className="rb-pic-done" frozen={c} label="Avaa selain" />
        <div className="rb-inline-body">
          <p className="rb-inline-head"><Icon name="check" aria-hidden="true" />Valmis klo {STEPS[c][lastStep(c)].at} · {n} tointa selaimessa</p>
          <p className="rb-inline-now">{h && h !== c ? `${h === 'person' ? 'Sinä käytät' : `${TITLE[h]} käyttää`} selainta nyt.` : 'Selain jäi kirjautuneena palvelimelle.'}</p>
          <ControlButton data-testid="open-browser" size="row" variant="quiet" onPress={openSheet}>Avaa selain</ControlButton>
        </div>
      </section>
    );
  }
  if (a.state === 'queued') {
    // This conversation waits; the picture shows what the driving conversation does.
    return (
      <section className="rb-inline rb-inline-other" data-testid="thumb" data-state="queued" aria-label="Selain on toisen keskustelun käytössä">
        <Picture className="rb-pic-other" />
        <div className="rb-inline-body">
          <DriverChip c={c} />
          <p className="rb-inline-now">{a.movedTo ? `Annoit selaimen toiselle keskustelulle klo ${a.movedTo}. ` : ''}Agentti jatkaa tästä, kun selain vapautuu.</p>
          <p className="rb-inline-meta" data-testid="now-line">{nowLine(c)}</p>
          <div className="rb-actions"><MainAction c={c} />{h === other(c) ? <ControlButton size="row" variant="quiet" onPress={() => goTo(other(c))}>Siirry keskusteluun</ControlButton> : null}</div>
        </div>
      </section>
    );
  }
  if (!mine) return null;
  return (
    <section className={`rb-inline${asking ? ' rb-inline-ask' : ''}`} data-testid="thumb" data-state={a.state} aria-label={asking ? 'Agentti tarvitsee sinua' : 'Agentti käyttää selaintasi'}>
      <Picture className="rb-pic-live" />
      <div className="rb-inline-body">
        {asking ? <h3 className="rb-inline-title"><Icon name="user" aria-hidden="true" />Netvisor pyytää vahvistuskoodia</h3> : <DriverChip c={c} />}
        <p className="rb-inline-now" data-testid="now-line">{asking ? 'Agentti on pysähtynyt kesken latauksen. Syötä koodi omassa selaimessasi, niin agentti jatkaa siitä.' : nowLine(c)}</p>
        <div className="rb-actions">
          {!asking ? <ControlButton data-testid="show-big" size="row" variant="quiet" onPress={openSheet}>Näytä isona</ControlButton> : null}
          <MainAction c={c} />
        </div>
        {waitLine(c) ? <p className="rb-inline-meta" data-testid="wait-line"><Icon name="agent" aria-hidden="true" />{waitLine(c)} · <button type="button" className="rb-link" onClick={() => goTo(other(c))}>Siirry</button></p> : null}
      </div>
    </section>
  );
}

// ---------- Riff 2: a strip above the composer in every conversation ----------

function DockStrip({c}: {c: Conv}) {
  const s = useStore();
  const h = s.holder;
  if (h === null) return null;
  const asking = h === 'person' && s[s.personFor!].state === 'asking';
  const head = h === c ? 'Agentti käyttää selaintasi'
    : h === 'person' ? (s.personFor === c ? (asking ? 'Odottaa sinua' : 'Sinä ohjaat · agentti odottaa') : `${TITLE[s.personFor!]} odottaa sinua`)
      : `${TITLE[h]} käyttää selaintasi`;
  const sub = h === 'person' && s.personFor === c ? nowLine(c) : [h === c ? nowLine(c) : h !== 'person' ? stepOf(h)?.target ?? '' : 'Netvisor pyytää vahvistuskoodia', waitLine(c)].filter(Boolean).join(' · ');
  return (
    <section className={`rb-strip${asking && s.personFor === c ? ' rb-strip-ask' : ''}`} data-testid="thumb" data-state={h === c ? 'working' : String(h)} aria-label="Oma selain">
      <Picture className="rb-pic-strip" />
      <div className="rb-strip-text">
        <b>{asking && s.personFor === c ? <Icon name="user" aria-hidden="true" /> : null}{head}</b>
        <span data-testid="now-line">{sub}</span>
      </div>
      <div className="rb-actions">
        {h === c || (h === 'person' && s.personFor === c && !asking) ? <ControlButton data-testid="show-big" size="row" variant="quiet" onPress={openSheet}>Näytä</ControlButton> : null}
        <MainAction c={c} />
      </div>
    </section>
  );
}
/** Riff 2: once the agent lets go, the strip leaves a line in the conversation. */
function DoneLine({c}: {c: Conv}) {
  const s = useStore();
  if (s[c].state !== 'done') return null;
  const n = STEPS[c].length, first = STEPS[c][0].at, last = STEPS[c][lastStep(c)].at;
  return (
    <p className="rb-note" data-testid="done-line">
      <Globe />
      <span>Agentti käytti selaintasi klo {first}–{last} ({n} tointa). Selain jäi kirjautuneena.</span>
      <ControlButton data-testid="open-browser" size="row" variant="quiet" onPress={openSheet}>Avaa selain</ControlButton>
    </p>
  );
}

// ---------- Riff 3: a small floating window that follows the person ----------

function FloatWindow({c}: {c: Conv}) {
  const s = useStore();
  const h = s.holder;
  if (s.pipGone) return null;
  if (h === null) {
    // Nobody drives: the window folds into a button that still opens the browser.
    return (
      <ConversationFloatingAction>
        <div className="rb-float-pill" data-testid="thumb" data-state="free">
          <ControlButton data-testid="open-browser" size="row" variant="secondary" onPress={openSheet}><Icon name="check" aria-hidden="true" /> Selain vapaa · kirjautunut</ControlButton>
          <ControlButton size="row" variant="quiet" aria-label="Piilota" onPress={() => { store.pipGone = true; notify(); }}><Icon name="cross" /></ControlButton>
        </div>
      </ConversationFloatingAction>
    );
  }
  const asking = h === 'person' && s[s.personFor!].state === 'asking';
  const driver = h === 'person' ? s.personFor! : h;
  const title = TITLE[driver];
  if (s.pipMin && !asking) {
    return (
      <ConversationFloatingAction>
        <div className="rb-float-pill" data-testid="thumb" data-state="min">
          <ControlButton data-testid="float-restore" size="row" variant="secondary" onPress={() => { store.pipMin = false; notify(); }}><Globe /> {title} käyttää selainta</ControlButton>
        </div>
      </ConversationFloatingAction>
    );
  }
  return (
    <ConversationFloatingAction>
      <section className={`rb-float${asking ? ' rb-float-ask' : ''}`} data-testid="thumb" data-state={asking ? 'asking' : String(h)} aria-label="Oma selain">
        <header className="rb-float-head">
          <Globe />
          {driver === c ? <b>{title}</b> : <button type="button" className="rb-link rb-float-title" data-testid="float-title" onClick={() => goTo(driver)}>{title}</button>}
          <ControlButton size="row" variant="quiet" aria-label="Pienennä" isDisabled={asking} onPress={() => { store.pipMin = true; notify(); }}><Icon name="down" /></ControlButton>
        </header>
        <Picture className="rb-pic-float" />
        <div className="rb-float-body">
          <DriverChip c={c} />
          <p className="rb-float-now" data-testid="now-line">{asking ? (s.personFor === c ? 'Netvisor pyytää vahvistuskoodia.' : nowLine(c)) : nowLine(c)}</p>
          {waitLine(c) ? <p className="rb-float-wait" data-testid="wait-line">{waitLine(c)}</p> : null}
          <div className="rb-actions"><MainAction c={c} /></div>
        </div>
      </section>
    </ConversationFloatingAction>
  );
}

// ---------- The sheet (round 1, direction 3) ----------

function BrowserSheet() {
  const s = useStore();
  const c = s.view;
  return (
    <ModalOverlay className="ah-overlay rb-sheet-overlay" isOpen={s.sheet} isDismissable onOpenChange={(o) => { if (!o) closeSheet(); }}>
      <Modal className="ah-modal rb-sheet">
        <AriaDialog className="rb-sheet-dialog" data-testid="browser-sheet" aria-label="Oma selain">
          <header className="rb-sheet-head">
            <Heading slot="title">Oma selain</Heading>
            <DriverChip c={c} />
            <ControlButton data-testid="close-browser" size="row" variant="quiet" aria-label="Sulje" onPress={closeSheet}><Icon name="cross" /></ControlButton>
          </header>
          <div className="rb-sheet-screen"><BrowserScreen /></div>
          <footer className="rb-bar">
            <p className="rb-bar-now">{nowLine(c)}</p>
            <MainAction c={c} size="page" />
          </footer>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- The conversations ----------

const say = (key: string, text: string): TurnStep => ({kind: 'text', key, text, node: <Markdown text={text} />});
const browserStep = (c: Conv, i: number): TurnStep => {
  const st = STEPS[c][i];
  return {kind: 'tool', key: `${c}${i}`, at: T0 + (3 + i) * 60000, node: (
    <PiToolUse name="selain" state="succeeded" targetText={st.target}><p className="rb-step-said">{st.said}</p></PiToolUse>
  )};
};
const line = (id: string, icon: 'check' | 'user' | 'agent', text: string, testid?: string) =>
  ({id, kind: 'notice', content: <p className="rb-request-done" data-testid={testid}><Icon name={icon} aria-hidden="true" />{text}</p>});
const OSTO_SUMMARY = `Lokakuun ostolaskut, 14 kpl, yhteensä **10 743,44 €**:

| Kustannuspaikka | Laskuja | Yhteensä |
|---|---|---|
| IT | 6 | 4 047,87 € |
| Toimitilat | 2 | 5 130,00 € |
| Hallinto | 2 | 761,00 € |
| Matkat | 2 | 482,80 € |
| Toimisto | 3 | 321,77 € |

PDF:t ovat kansiossa \`ostolaskut-10/\` ja yhteenveto tiedostossa \`ostolaskut-lokakuu.md\`.`;
type Item = {id: string; kind: string; content: React.ReactNode};

function ostoTimeline(): Item[] {
  const a = store.osto, ask = 'Hae Netvisorista lokakuun ostolaskut ja tee niistä yhteenveto kustannuspaikoittain.';
  const working = store.holder === 'osto';
  const items: Item[] = [
    {id: 'u1', kind: 'user', content: <UserMessage sourceText={ask} onCopy={noop} time="10.11"><Markdown text={ask} /></UserMessage>},
    {id: 'a1', kind: 'assistant', content: <AgentTurn startedAt={T0} duration="12 s" steps={[
      {kind: 'tool', key: 't', at: T0 + 6000, node: <PiToolUse name="bash" state="succeeded" targetText="netvisor-api --check"><p className="rb-step-said">Ei rajapinta-avainta.</p></PiToolUse>},
      say('s', 'Netvisoriin ei ole sinulle rajapinta-avainta, joten haen laskut palvelimen selaimellasi. Kirjaudu siihen ensin.'),
    ]} />},
    line('r1', 'check', 'Kirjauduit Netvisoriin ja annoit selaimen agentille klo 10.14.'),
  ];
  const shown = STEPS.osto.map((_, i) => i).filter((i) => i <= a.step);
  const before = shown.filter((i) => i <= ASK), after = shown.filter((i) => i > ASK);
  items.push({id: 'a2', kind: 'assistant', content: <AgentTurn key={`a2-${a.step >= ASK}`} startedAt={T0 + 3 * 60000}
    working={working && a.step < ASK} duration={a.step >= ASK ? '2 min 10 s' : undefined}
    steps={[...before.map((i) => browserStep('osto', i)),
      ...(a.step >= ASK ? [say('q', 'Netvisor pyytää vahvistuskoodia uudelleen. En voi syöttää sitä puolestasi; jatkan, kun olet syöttänyt sen.')] : [])]} />});
  if (a.step >= ASK && a.state !== 'asking') items.push(line('r2', 'check', 'Vahvistit Netvisorin uudelleen klo 10.18.', 'request2-done'));
  if (after.length || (working && a.step >= ASK))
    items.push({id: 'a3', kind: 'assistant', content: <AgentTurn key={`a3-${a.state === 'done'}`} startedAt={T0 + 7 * 60000}
      working={working} duration={a.state === 'done' ? '1 min 12 s' : undefined}
      steps={[...after.map((i) => browserStep('osto', i)), ...(a.state === 'done' ? [say('d', OSTO_SUMMARY)] : [])]} />});
  return items;
}
function rekryTimeline(): Item[] {
  const a = store.rekry, ask = 'Etsi LinkedIn Recruiterista myyjäehdokkaita Helsingistä ja tee lista.';
  const items: Item[] = [
    {id: 'u1', kind: 'user', content: <UserMessage sourceText={ask} onCopy={noop} time="10.15"><Markdown text={ask} /></UserMessage>},
    {id: 'a1', kind: 'assistant', content: <AgentTurn startedAt={T0 + 4 * 60000} duration="4 s" steps={[
      {kind: 'tool', key: 'busy', at: T0 + 4 * 60000, node: <PiToolUse name="selain" state="failed" targetText="Avaa LinkedIn Recruiter"><p className="rb-step-said">Selain on toisen keskustelun käytössä.</p></PiToolUse>},
      say('w', 'Selaintasi käyttää nyt toinen keskustelu. Jatkan heti, kun se vapautuu.'),
    ]} />},
  ];
  if (a.step >= 0 || a.state === 'working')
    items.push({id: 'a2', kind: 'assistant', content: <AgentTurn key={`r2-${a.state === 'done'}`} startedAt={T0 + 8 * 60000}
      working={a.state === 'working'} duration={a.state === 'done' ? '1 min 40 s' : undefined}
      steps={[...STEPS.rekry.map((_, i) => i).filter((i) => i <= a.step).map((i) => browserStep('rekry', i)),
        ...(a.state === 'done' ? [say('d', 'Löysin 23 ehdokasta; viisi lupaavinta ovat tiedoston `myyja-ehdokkaat.md` alussa.')] : [])]} />});
  return items;
}
function timeline(c: Conv, riff: number): Item[] {
  const s = store, a = s[c];
  const items = c === 'osto' ? ostoTimeline() : rekryTimeline();
  if (a.state === 'paused') items.push(line('p', 'user', `Otit selaimen klo ${a.took}. Agentti odottaa, kunnes annat sen takaisin.`, 'paused-line'));
  if (a.movedTo && a.state === 'queued') items.push(line('m', 'agent', `Annoit selaimen keskustelulle ${TITLE[other(c)]} klo ${a.movedTo}. Agentti jatkaa, kun selain vapautuu.`, 'moved-line'));
  if (riff === R1) items.push({id: 'thumb', kind: 'notice', content: <InlinePicture c={c} />});
  if (riff === R2) items.push({id: 'done', kind: 'notice', content: <DoneLine c={c} />});
  return items;
}

// ---------- The page ----------

const activity = (c: Conv): Pick<AgentNavModel, 'activity' | 'activityLabel'> => {
  const st = store[c].state;
  if (st === 'working') return {activity: 'working', activityLabel: 'Käyttää selainta'};
  if (st === 'asking') return {activity: 'waiting', activityLabel: 'Odottaa sinua'};
  if (st === 'paused') return {activity: 'waiting', activityLabel: 'Sinä ohjaat selainta'};
  if (st === 'queued') return {activity: 'waiting', activityLabel: 'Odottaa selainta'};
  return {activity: 'waiting', activityLabel: 'Valmis'};
};
function Main({riff}: {riff: number}) {
  const s = useStore();
  const c = s.view;
  const now = Date.now();
  const model = (k: Conv): AgentNavModel => ({
    agentId: k, href: `/workspaces/ws_t?conversation=${k}`, title: TITLE[k], workspaceId: 'ws_t', workspaceName: k === 'osto' ? 'talous' : 'rekrytointi',
    changedAt: now - (k === 'osto' ? 1 : 4) * 60000, ...activity(k), controlLabel: '', detail: k === 'osto' ? 'talous' : 'rekrytointi', selected: k === c,
  });
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Contoso" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Aino Virtanen" onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now ah-quiet" aria-labelledby="rb-quiet">
          <h2 className="ah-rail-section-head ah-quiet-head">
            <button type="button" className="ah-quiet-fold" aria-expanded="true">
              <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
              <span id="rb-quiet">Keskustelut</span><span className="ah-rail-count">2</span>
            </button>
          </h2>
          <ul data-testid="rail-convs" onClickCapture={(e) => {
            const href = (e.target as HTMLElement).closest('a')?.getAttribute('href') ?? '';
            const k = href.includes('rekry') ? 'rekry' : href.includes('osto') ? 'osto' : null;
            if (k) { e.preventDefault(); e.stopPropagation(); goTo(k); }
          }}>{(['osto', 'rekry'] as Conv[]).map((k) => <AgentNavItem key={k} {...model(k)} now={now} />)}</ul>
        </section>
      }>
      <WorkspaceNavRow name="talous" href="/workspaces/ws_t" />
      <WorkspaceNavRow name="rekrytointi" href="/workspaces/ws_r" />
    </WorkspaceRail>
  );
  const busy = s.holder === c;
  const header = activity(c).activityLabel;
  const conversation = (
    <ConversationFrame key={c}>
      <AgentHeader title={TITLE[c]} workspaceLabel={c === 'osto' ? 'talous' : 'rekrytointi'} workspaceHref="/workspaces/ws_t"
        activityLabel={header === 'Valmis' ? '' : header} activityAnimated={busy} activityKind={busy ? 'working' : 'neutral'}
        controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
      <ConversationStream>
        <ConversationTimeline state="ready" items={timeline(c, riff)} historyMode="pagedAccessible" onJumpToLatest={noop} />
      </ConversationStream>
      {riff === R2 ? <DockStrip c={c} /> : null}
      {riff === R3 ? <FloatWindow c={c} /> : null}
      <Composer value="" onChange={noop} activity={busy ? 'working' : 'idle'} selectedWorkingMode="steer"
        onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} sources={sources} csrf="prototype"
        modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
    </ConversationFrame>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={TITLE[c]} rail={railView} main={<div className="ah-state rb-main">{conversation}</div>} />
      <BrowserSheet />
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({riff}: {riff: number}) {
  const s = useStore();
  const [theme, setTheme] = useState(reviewTheme);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
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
  useEffect(() => { advance(); return () => window.clearTimeout(timer); }, [generation]);
  const scene = (sc: Scene) => { resetStore(sc, store.view); setGeneration((g) => g + 1); };
  return (
    <div className={`rb-review variant-${riff}`} data-direction={riff}>
      <header className="rb-reviewbar" ref={bar}>
        <strong>Oma palvelinselain · kierros 2</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Keskustelu <select id="conv" value={s.view} onChange={(e) => goTo(e.target.value as Conv)}>
          <option value="osto">{TITLE.osto}</option><option value="rekry">{TITLE.rekry} (odottaa selainta)</option></select></label>
        <span className="rb-scenes">
          <button type="button" data-testid="rb-reset" onClick={() => scene('working')}>Alusta</button>
          <button type="button" data-testid="rb-asking" onClick={() => scene('asking')}>Odottaa sinua</button>
          <button type="button" data-testid="rb-done" onClick={() => scene('done')}>Valmis</button>
        </span>
        <ol className="rb-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === riff ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rb-stage">
        <PiModelsProvider key={generation} enabled>
          <MemoryRouter key={generation} initialEntries={['/workspaces/ws_t?conversation=osto']}>
            <Main key={generation} riff={riff} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
    </div>
  );
}

// ---------- Host stand-in: only what the production shell asks for ----------

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path === '/api/v1/server') return json({schema_version: 1, name: 'Contoso', administrator: false, version: '0.0.0-proto'});
  if (path === '/api/v1/pi/models')
    return json({schema_version: 1, default_provider: 'anthropic', default_model: 'claude-sonnet-5', default_thinking: 'medium', catalog_status: 'native_cached',
      models: [{id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'anthropic'}]});
  return new Response('', {status: 404});
};

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { resetStore(); flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, riff) => () => { resetStore(); return <App key={riff} riff={riff} />; });
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
