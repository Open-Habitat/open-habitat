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
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
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

// proto-remote-browser-session, round 3. Jari (7.11.2026, round 2): a chip in
// the conversation opens a strip of small pictures like round 2's direction 2;
// the agent may have several browser windows open at once, so the chip and the
// strip carry several; the agent's pointer and clicks must show, on the
// pictures and in the sheet; and the person's browser is one row in the left
// rail (state, which conversation drives, opens the sheet). Kept from earlier
// rounds: the "Pyydettäessä" sheet, one browser per person shared by their
// conversations, "Siirrä tälle" when another conversation wants it.
// Host fact this round settles: an agent drives the browser over CDP, and
// Input.dispatchMouseEvent never moves the X pointer, so the pointer drawn here
// comes from the agent's input events, which the browser host relays anyway.
const directions = ['1 Vuorossa', '2 Kentän yllä', '3 Otsikossa'];
const LINES = [
  '1 Siru vuorossa: siru agentin vuoron lopussa avaa palkin keskusteluun; osoitin on nimetty piste, ja selain on sivupalkin ylin rivi.',
  '2 Siru kentän yllä: siru kirjoituskentän yllä kaikissa keskusteluissa avaa palkin kentän päälle; osoitin on nuoli, jonka perässä näkyvät viimeiset klikkaukset, ja sivupalkin rivillä on pieni kuva.',
  '3 Siru otsikossa: siru otsikkorivillä avaa palkin otsikon alle, ja ikkuna, jossa agentti toimii, on siinä isona; osoittimessa lukee keskustelun nimi, ja selain on sivupalkin alin rivi.',
];
const R1 = 0, R2 = 1, R3 = 2;
let riffNow = R1;

// ---------- The story: Aino Virtanen, Contoso, two conversations, one browser ----------

type Conv = 'osto' | 'rekry';
type Page = 'home' | 'list' | 'expired' | 'cc' | 'pdf' | 'li-home' | 'li-results' | 'li-profile';
/** What a conversation's agent is doing with the browser. */
type AgentState = 'working' | 'queued' | 'asking' | 'paused' | 'done';
type Holder = Conv | 'person' | null;
/** One browser window the conversation's agent has open; the host lists them from CDP targets. */
type Win = {id: string; title: string; page: Page};
/** The agent's pointer: the last Input.dispatchMouseEvent the host relayed, in one window. */
type Ptr = {win: number; x: number; y: number};
type Click = {win: number; x: number; y: number; n: number};
type Agent = {step: number; state: AgentState; took: string; movedTo: string; wins: Win[]; ptr: Ptr | null; clicks: Click[]; closed: number};
const TITLE: Record<Conv, string> = {osto: 'Lokakuun ostolaskut', rekry: 'Rekrytointi: myyjä'};
const SHORT: Record<Conv, string> = {osto: 'Ostolaskut', rekry: 'Rekrytointi'};
const other = (c: Conv): Conv => (c === 'osto' ? 'rekry' : 'osto');
const fresh = (): Agent => ({step: -1, state: 'queued', took: '', movedTo: '', wins: [], ptr: null, clicks: [], closed: 0});
const store = {
  view: 'osto' as Conv, sheet: false, sheetWin: -1, code: '', strip: true,
  holder: 'osto' as Holder, personFor: null as Conv | null, last: 'osto' as Conv, clickN: 0,
  osto: fresh(), rekry: fresh(),
};
// The check script reads the story's state from here; nothing in the view does.
(window as unknown as {rbStore: typeof store}).rbStore = store;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
let timer = 0;
let moveTimers: number[] = [];
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return store;
}

/** A pointer move in window `win` at (x %, y %) of its page; `1` marks a click. */
type Move = [number, number, number, 1?];
/** Each step is an ordinary `selain` tool call in its own conversation's native history. */
type Step = {at: string; target: string; said: string; win: number; page: Page; open?: Omit<Win, 'page'>; close?: boolean; moves: Move[]; ask?: boolean; got?: number};
const STEPS: Record<Conv, Step[]> = {
  osto: [
    {at: '10.14', target: 'Tarkista kirjautuminen', said: 'Etusivulla lukee Aino Virtanen, joten olet kirjautunut.', win: 0, page: 'home', open: {id: 'nv', title: 'Netvisor'}, moves: [[0, 82, 13]]},
    {at: '10.14', target: 'Avaa Ostot › Ostolaskut', said: 'Ostolaskujen lista on auki.', win: 0, page: 'list', moves: [[0, 10, 30], [0, 10, 34, 1]]},
    {at: '10.15', target: 'Rajaa 1.10.–31.10.2026', said: 'Lokakuulta on 14 ostolaskua.', win: 0, page: 'list', moves: [[0, 44, 27, 1], [0, 58, 27, 1]]},
    {at: '10.15', target: 'Avaa kustannuspaikat uuteen ikkunaan', said: 'Kustannuspaikkaraportti on auki toisessa ikkunassa.', win: 1, page: 'cc', open: {id: 'cc', title: 'Kustannuspaikat'}, moves: [[1, 30, 30], [1, 30, 46, 1]]},
    {at: '10.15', target: 'Avaa AWS:n lasku uuteen ikkunaan', said: 'AWS:n lasku on auki kolmannessa ikkunassa.', win: 2, page: 'pdf', open: {id: 'pdf', title: 'AWS-lasku'}, moves: [[2, 46, 36], [2, 70, 62, 1]]},
    {at: '10.16', target: 'Lataa laskut 1–6 PDF:nä', said: 'Kuusi laskua ladattu kansioon ostolaskut-10/.', win: 0, page: 'list', got: 6, moves: [[0, 90, 40, 1], [0, 90, 49, 1], [0, 90, 58, 1]]},
    {at: '10.16', target: 'Tarkista AWS:n kustannuspaikka', said: 'AWS kuuluu IT:hen, ja kustannuspaikkaraportti täsmää.', win: 1, page: 'cc', got: 6, moves: [[2, 40, 70], [1, 62, 40, 1]]},
    {at: '10.17', target: 'Lataa laskut 7–14 PDF:nä', said: 'Netvisor pyytää vahvistuskoodia uudelleen. En voi syöttää sitä puolestasi.', win: 0, page: 'expired', got: 6, ask: true, moves: [[0, 90, 66, 1]]},
    {at: '10.18', target: 'Lataa laskut 7–14 PDF:nä', said: 'Loput kahdeksan laskua ladattu.', win: 0, page: 'list', got: 14, moves: [[0, 90, 70, 1], [0, 90, 79, 1]]},
    {at: '10.19', target: 'Sulje ylimääräiset ikkunat', said: 'Kustannuspaikat ja AWS-lasku suljettu; ostolaskut-lokakuu.md kirjoitettu.', win: 0, page: 'list', got: 14, close: true, moves: []},
  ],
  rekry: [
    {at: '10.19', target: 'Avaa LinkedIn Recruiter', said: 'Haku on auki.', win: 0, page: 'li-home', open: {id: 'li', title: 'Recruiter'}, moves: [[0, 40, 12, 1]]},
    {at: '10.20', target: 'Hae: myyjä, Helsinki, B2B', said: 'Hakuun osui 23 profiilia.', win: 0, page: 'li-results', moves: [[0, 50, 12, 1], [0, 30, 36]]},
    {at: '10.20', target: 'Avaa Laura K:n profiili uuteen ikkunaan', said: 'Profiili on auki toisessa ikkunassa.', win: 1, page: 'li-profile', open: {id: 'lp', title: 'Laura K.'}, moves: [[1, 50, 30], [1, 26, 62, 1]]},
    {at: '10.21', target: 'Kirjoita ehdokaslista', said: 'myyja-ehdokkaat.md kirjoitettu; profiilin ikkuna suljettu.', win: 0, page: 'li-results', close: true, moves: []},
  ],
};
const ASK = 7;
const START = 4;
const TICK = 2400;
const stepOf = (c: Conv) => (store[c].step >= 0 ? STEPS[c][store[c].step] : undefined);
const nowAt = (c: Conv) => stepOf(c)?.at ?? '10.14';
const lastStep = (c: Conv) => STEPS[c].length - 1;

/** Applies step i's window changes; the pointer moves are played separately. */
function applyStep(c: Conv, i: number) {
  const a = store[c], s = STEPS[c][i];
  a.step = i;
  if (s.open) a.wins = [...a.wins, {...s.open, page: s.page}];
  a.wins = a.wins.map((w, k) => (k === s.win ? {...w, page: s.page} : w));
  if (s.close) { a.closed = a.wins.length - 1; a.wins = a.wins.slice(0, 1); a.ptr = null; a.clicks = []; }
}
function pointTo(c: Conv, [win, x, y, click]: Move) {
  const a = store[c];
  a.ptr = {win, x, y};
  if (click) { store.clickN += 1; a.clicks = [...a.clicks.filter((k) => k.win === win), {win, x, y, n: store.clickN}].slice(-3); }
}
function playMoves(c: Conv, i: number) {
  moveTimers.forEach((t) => window.clearTimeout(t));
  const moves = STEPS[c][i].moves, gap = TICK / (moves.length + 1);
  moveTimers = moves.map((m, k) => window.setTimeout(() => {
    if (store.holder !== c) return;
    pointTo(c, m); notify();
  }, gap * (k + 0.5)));
}
function stopAll() { window.clearTimeout(timer); moveTimers.forEach((t) => window.clearTimeout(t)); moveTimers = []; }

function advance() {
  window.clearTimeout(timer);
  const c = store.holder;
  if (c !== 'osto' && c !== 'rekry' || store[c].state !== 'working') return;
  timer = window.setTimeout(() => {
    if (store.holder !== c || store[c].state !== 'working') return;
    const a = store[c];
    applyStep(c, a.step + 1);
    const s = STEPS[c][a.step];
    if (s.ask) { pointTo(c, s.moves[0]); a.state = 'asking'; store.holder = 'person'; store.personFor = c; store.sheetWin = 0; notify(); return; }
    if (a.step === lastStep(c)) { a.state = 'done'; release(); return; }
    playMoves(c, a.step);
    notify();
    advance();
  }, TICK);
}
/** The driving client let go: the next conversation waiting for the browser gets it. */
function release() {
  const was = store.holder;
  if (was === 'osto' || was === 'rekry') store.last = was;
  store.holder = null; store.personFor = null;
  const next = (['osto', 'rekry'] as Conv[]).find((c) => store[c].state === 'queued');
  if (next) { store.holder = next; store.last = next; store[next].state = 'working'; store[next].movedTo = ''; }
  notify();
  advance();
}

// ---------- Actions: the same in every riff, only their place differs ----------

function openSheet(win = -1) { store.sheet = true; store.sheetWin = win; notify(); }
function closeSheet() { store.sheet = false; notify(); }
function goTo(c: Conv) { store.view = c; notify(); }
function toggleStrip() { store.strip = !store.strip; notify(); }
/** The conversation whose windows the browser shows now. */
const shown = (): Conv => (store.holder === 'osto' || store.holder === 'rekry' ? store.holder : store.personFor ?? store.last);
function verify() {
  const c = shown(), w = store[c].wins[0];
  if (w && w.page === 'expired') store[c].wins = store[c].wins.map((x, k) => (k === 0 ? {...x, page: 'list'} : x));
  store.code = ''; notify();
}
const signedIn = () => store[shown()].wins[0]?.page !== 'expired';
/** The person takes the browser from the conversation that drives it; its agent waits. */
function takeControl() {
  const c = store.holder;
  if (c !== 'osto' && c !== 'rekry') return;
  stopAll();
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
  stopAll();
  store[from].state = 'queued'; store[from].movedTo = nowAt(from);
  store.holder = c; store.last = c; store[c].state = 'working'; store[c].movedTo = '';
  notify();
  advance();
}

type Scene = 'working' | 'asking' | 'done';
function resetStore(scene: Scene = 'working', view: Conv = 'osto') {
  stopAll();
  Object.assign(store, {view, sheet: false, sheetWin: -1, code: '', strip: true, personFor: null, clickN: 0, osto: fresh(), rekry: fresh()});
  const upTo = (c: Conv, n: number) => {
    for (let i = 0; i <= n; i++) {
      applyStep(c, i);
      for (const m of STEPS[c][i].moves) pointTo(c, m);
    }
  };
  if (scene === 'working') { upTo('osto', START); store.osto.state = 'working'; Object.assign(store, {holder: 'osto', last: 'osto'}); }
  if (scene === 'asking') { upTo('osto', ASK); store.osto.state = 'asking'; Object.assign(store, {holder: 'person', personFor: 'osto', last: 'osto'}); }
  if (scene === 'done') {
    // The purchase invoices are done and the browser went to the waiting conversation.
    upTo('osto', lastStep('osto')); store.osto.state = 'done';
    upTo('rekry', 0); store.rekry.state = 'working';
    Object.assign(store, {holder: 'rekry', last: 'rekry'});
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
const windows = (n: number) => (n === 1 ? '1 ikkuna' : `${n} ikkunaa`);
/** Who holds the browser, seen from conversation `c`, in words. */
function holderLabel(c: Conv) {
  const s = store, h = s.holder;
  if (h === null) return 'Vapaa · kirjautunut';
  if (h === 'person') return s[s.personFor!].state === 'asking' ? (s.personFor === c ? 'Odottaa sinua' : `${TITLE[s.personFor!]} odottaa sinua`) : 'Sinä ohjaat';
  return h === c ? 'Agentti käyttää' : `${TITLE[h]} käyttää`;
}
/** Who holds the browser, seen from conversation `c`. Words and an icon, never a coloured edge. */
function DriverChip({c}: {c: Conv}) {
  const s = useStore();
  const h = s.holder;
  const asking = h === 'person' && s[s.personFor!].state === 'asking';
  const tone = asking ? ' rb-driver-ask' : h === c ? ' rb-driver-agent' : '';
  return (
    <span className={`rb-driver${tone}`} data-testid="driver" data-holder={String(h)}>
      <Icon name={h === 'person' || h === null ? 'user' : 'agent'} aria-hidden="true" />{holderLabel(c)}
    </span>
  );
}
const lower = (t: string) => t[0].toLowerCase() + t.slice(1);
/** One sentence about the browser, seen from conversation `c`. */
function nowLine(c: Conv) {
  const s = store, h = s.holder, a = s[c];
  if (h === 'person' && s.personFor === c) {
    if (a.state === 'asking') return signedIn() ? 'Koodi hyväksytty. Anna selain takaisin, niin agentti jatkaa.' : 'Netvisor pyytää vahvistuskoodia. Agentti odottaa, että syötät sen.';
    return `Otit ohjauksen klo ${a.took}. Agentti jatkaa, kun annat selaimen takaisin.`;
  }
  if (h === c) return stepOf(c) ? stepOf(c)!.target : 'Agentti aloittaa…';
  if (h === 'person') return `${TITLE[s.personFor!]} odottaa sinua.`;
  if (h) return `${TITLE[h]}: ${stepOf(h) ? lower(stepOf(h)!.target) : 'aloittaa'}`;
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
  home: 'netvisor.fi/etusivu', list: 'netvisor.fi/ostot/ostolaskut?alku=1.10.2026&loppu=31.10.2026',
  expired: 'login.netvisor.fi/vahvista?jatka=ostolaskut', cc: 'netvisor.fi/raportit/kustannuspaikat?kausi=10-2026',
  pdf: 'netvisor.fi/ostot/lasku/48213/kuva.pdf',
  'li-home': 'linkedin.com/talent/search', 'li-results': 'linkedin.com/talent/search?q=myyj%C3%A4&sijainti=Helsinki',
  'li-profile': 'linkedin.com/talent/profile/laura-k',
};
const INVOICES = [
  ['Elisa Oyj', '02.10.', '389,40', 'IT'], ['Telia Finland', '03.10.', '214,90', 'IT'], ['Lyreco Finland', '06.10.', '96,12', 'Toimisto'],
  ['Sponda Oy', '01.10.', '4 820,00', 'Toimitilat'], ['Fennia', '08.10.', '612,00', 'Hallinto'], ['Amazon Web Services', '09.10.', '1 248,37', 'IT'],
  ['Kespro', '13.10.', '183,55', 'Toimisto'], ['HSL', '14.10.', '64,80', 'Matkat'], ['Finnair', '16.10.', '418,00', 'Matkat'],
];
const CENTERS = [['IT', '6', '4 047,87'], ['Toimitilat', '2', '5 130,00'], ['Hallinto', '2', '761,00'], ['Matkat', '2', '482,80'], ['Toimisto', '3', '321,77']];
const PEOPLE = [['Laura K.', 'Myyntipäällikkö, SaaS', 'Helsinki'], ['Mikko R.', 'Account Executive', 'Espoo'], ['Sanna V.', 'B2B-myyjä', 'Helsinki'], ['Joonas P.', 'Key Account Manager', 'Vantaa'], ['Elina H.', 'Myyjä, ohjelmistot', 'Helsinki']];
/** The remote page. Its colours are the website's, not Habitat's: a remote browser shows the site as it is. */
function SitePage({page, live, got}: {page: Page; live: boolean; got: number}) {
  const s = useStore();
  if (page === 'expired')
    return (
      <div className="rb-site-center">
        <div className="rb-site-card">
          <p className="rb-site-brand">netvisor</p>
          <h3>Vahvista uudelleen</h3>
          <p className="rb-site-note">Istuntosi vaatii vahvistuksen ennen kuin voit ladata lisää aineistoa.</p>
          <label>Tunnistussovelluksen koodi
            <input data-testid={live ? 'site-code' : undefined} className="rb-site-field" inputMode="numeric" maxLength={6} placeholder="6 numeroa" disabled={!live} tabIndex={live ? 0 : -1}
              value={live ? s.code : ''} onChange={(e) => { store.code = e.target.value.replace(/\D/g, ''); notify(); }} />
          </label>
          <button type="button" data-testid={live ? 'site-verify' : undefined} className="rb-site-btn" disabled={!live || s.code.length !== 6} onClick={verify}>Vahvista</button>
        </div>
      </div>
    );
  if (page === 'pdf')
    return (
      <div className="rb-site-pdf">
        <div className="rb-site-sheet">
          <p className="rb-site-brand rb-site-aws">Amazon Web Services EMEA SARL</p>
          <h3>Lasku 48213</h3>
          <p>Contoso Oy · laskun päivä 9.10.2026 · eräpäivä 23.10.2026</p>
          <table className="rb-site-table"><tbody>
            <tr><td>Amazon EC2</td><td className="n">812,40</td></tr><tr><td>Amazon S3</td><td className="n">201,15</td></tr>
            <tr><td>AWS Support</td><td className="n">234,82</td></tr><tr><td><b>Yhteensä</b></td><td className="n"><b>1 248,37 €</b></td></tr>
          </tbody></table>
        </div>
      </div>
    );
  if (page.startsWith('li-'))
    return (
      <div className="rb-site-app rb-site-li">
        <div className="rb-site-top"><span className="rb-site-brand">Recruiter</span><span className="rb-site-search">myyjä · Helsinki · B2B</span><span className="rb-site-user">Aino Virtanen</span></div>
        <div className="rb-site-main">
          {page === 'li-home' ? <h3>Haku</h3> : page === 'li-profile' ? (
            <div className="rb-site-profile"><span className="rb-site-face rb-site-face-big" aria-hidden="true">L</span><h3>Laura K.</h3><p>Myyntipäällikkö, SaaS · Helsinki</p><p>8 vuotta B2B-myyntiä ohjelmistoyrityksissä. Avoin uusille tehtäville.</p></div>
          ) : <><h3>23 profiilia</h3>
            <ul className="rb-site-people">{PEOPLE.map(([n, r, w]) => <li key={n}><span className="rb-site-face" aria-hidden="true">{n[0]}</span><span><b>{n}</b><small>{r} · {w}</small></span></li>)}</ul></>}
        </div>
      </div>
    );
  const ranged = s.osto.step >= 2;
  return (
    <div className="rb-site-app">
      <div className="rb-site-top"><span className="rb-site-brand">netvisor</span><span>Contoso Oy</span><span className="rb-site-user">Aino Virtanen</span></div>
      <div className="rb-site-body">
        <nav className="rb-site-nav"><span>Etusivu</span><span>Myynti</span><span className={page === 'list' ? 'on' : undefined}>Ostot</span><span>Palkat</span><span className={page === 'cc' ? 'on' : undefined}>Raportit</span></nav>
        {page === 'home' ? (
          <div className="rb-site-main">
            <h3>Tervetuloa, Aino Virtanen</h3>
            <div className="rb-site-tiles"><div><b>14</b> uutta ostolaskua</div><div><b>3</b> hyväksyttävää</div><div><b>2</b> myyntilaskua erääntyy</div></div>
          </div>
        ) : page === 'cc' ? (
          <div className="rb-site-main">
            <h3>Kustannuspaikat · lokakuu 2026</h3>
            <table className="rb-site-table"><tbody>
              {CENTERS.map(([n, k, sum]) => <tr key={n}><td>{n}</td><td className="n">{k} laskua</td><td className="n">{sum}</td></tr>)}
            </tbody></table>
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

/** An arrow like the system pointer, so the person reads it as a pointer. */
function Arrow() {
  return <svg className="rb-arrow" viewBox="0 0 16 22" aria-hidden="true"><path d="M1 1v17l4.6-4.3 3.1 7 3-1.4-3.1-6.8H15Z" /></svg>;
}
/**
 * The agent's pointer and its clicks, drawn over one window. The host knows
 * them from the Input.dispatchMouseEvent calls it relays to Chrome; nothing
 * moves on the X display, so the remote picture alone would show no pointer.
 * Each riff draws it its own way.
 */
function AgentPointer({c, win, small}: {c: Conv; win: number; small: boolean}) {
  const a = store[c];
  if (store.holder !== c || !a.ptr || a.ptr.win !== win) return null;
  const clicks = a.clicks.filter((k) => k.win === win);
  const last = clicks[clicks.length - 1];
  const kind = ['dot', 'trail', 'named'][riffNow];
  return (
    <span className={`rb-ptr rb-ptr-${kind}${small ? ' rb-ptr-small' : ''}`} aria-hidden="true">
      {riffNow === R2 ? clicks.slice(0, -1).map((k, i) => <span key={k.n} className="rb-trail" data-age={clicks.length - 1 - i} style={{left: `${k.x}%`, top: `${k.y}%`}} />) : null}
      {last ? <span key={last.n} className="rb-click" data-testid="agent-click" style={{left: `${last.x}%`, top: `${last.y}%`}} /> : null}
      <span className="rb-ptr-at" data-testid="agent-pointer" style={{left: `${a.ptr.x}%`, top: `${a.ptr.y}%`}}>
        {riffNow === R1 ? <i className="rb-ptr-dot-mark" /> : <Arrow />}
        {riffNow === R1 ? <span className="rb-ptr-label" data-flip={a.ptr.x > 70 || undefined}>Agentti</span> : riffNow === R3 ? <span className="rb-ptr-label" data-flip={a.ptr.x > 70 || undefined}>{SHORT[c]}</span> : null}
      </span>
    </span>
  );
}
/**
 * One window of the person's browser. `small` is a picture: it never takes
 * input. Input reaches the sheet's window only while the person holds the
 * browser or nobody does.
 */
function BrowserScreen({c, win, small = false}: {c: Conv; win: number; small?: boolean}) {
  const s = useStore();
  const w = s[c].wins[win] ?? s[c].wins[0];
  const page = w?.page ?? 'list';
  const live = !small && (s.holder === 'person' || s.holder === null);
  const driving = s.holder === c;
  const [hint, setHint] = useState(false);
  const got = (c === 'osto' ? stepOf('osto')?.got : 0) ?? 0;
  return (
    <div className={`rb-screen${small ? ' rb-screen-small' : ''}`} data-testid={small ? 'mini-screen' : 'browser-screen'} data-page={page}>
      <div className="rb-chrome" aria-hidden={small}>
        <span className="rb-chrome-btns"><Icon name="back" /><Icon name="forward" /><Icon name="refresh" /></span>
        <span className="rb-url"><Icon name="lock" />{URLS[page]}</span>
      </div>
      <div className="rb-site" inert={!live}>
        <SitePage page={page} live={live} got={got} />
      </div>
      <AgentPointer c={c} win={win} small={small} />
      {driving && !small ? (
        <button type="button" className="rb-viewonly" data-testid="view-only" aria-label="Agentti käyttää selainta. Ota ohjaus, jos haluat käyttää sitä itse." onClick={() => setHint(true)}>
          {hint ? <span className="rb-viewonly-hint">Agentti käyttää selainta. Ota ohjaus, jos haluat käyttää sitä itse.</span> : null}
        </button>
      ) : null}
    </div>
  );
}
/** The window the agent acts in now, or -1. */
const activeWin = (c: Conv) => (store.holder === c && store[c].ptr ? store[c].ptr!.win : store.personFor === c ? 0 : -1);

/** One window as a picture that opens the sheet on it. */
function WinPicture({c, win, size}: {c: Conv; win: number; size: string}) {
  const w = store[c].wins[win];
  const here = activeWin(c) === win;
  return (
    <figure className={`rb-win rb-win-${size}`} data-active={here || undefined}>
      <button type="button" className="rb-pic" data-testid="win-pic" data-active={here || undefined} onClick={() => openSheet(win)} aria-label={`Näytä ikkuna ${w.title} isona`}>
        <BrowserScreen c={c} win={win} small />
      </button>
      <figcaption>
        <span className="rb-win-title">{w.title}</span>
        {here && store.holder === c ? <span className="rb-win-here"><Arrow />agentti tässä</span> : null}
      </figcaption>
    </figure>
  );
}

/** The action that fits the moment, seen from conversation `c`. */
function MainAction({c, size = 'row'}: {c: Conv; size?: 'row' | 'page'}) {
  const s = useStore();
  const h = s.holder;
  if (h === 'person' && s.personFor === c) {
    if (s[c].state === 'asking' && !s.sheet)
      return <ControlButton data-testid="enter-code" size={size} variant="primary" onPress={() => openSheet(0)}><Globe /> Syötä koodi</ControlButton>;
    return <ControlButton data-testid="hand-back" size={size} variant="primary" isDisabled={!signedIn()} onPress={handBack}>Anna takaisin agentille</ControlButton>;
  }
  if (h === c) return <ControlButton data-testid="take-control" size={size} variant="secondary" onPress={takeControl}>Ota ohjaus</ControlButton>;
  if (h === other(c) && s[c].state === 'queued')
    return <ControlButton data-testid="move-here" size={size} variant="secondary" onPress={() => moveHere(c)}>Siirrä tälle</ControlButton>;
  if (h === other(c) || (h === 'person' && s.personFor === other(c)))
    return <ControlButton data-testid="go-driver" size={size} variant="quiet" onPress={() => goTo(other(c))}>Siirry keskusteluun</ControlButton>;
  return null;
}

// ---------- The chip and its strip, the same pieces in every riff ----------

/**
 * The conversation whose windows conversation `c`'s chip shows. Riff 1 keeps
 * the chip with the conversation's own work, so a finished conversation keeps
 * its last pictures; riffs 2 and 3 show the shared browser as it is now.
 */
function stripConv(c: Conv): Conv {
  const s = store;
  if (riffNow !== R1) return shown();
  if (s[c].state === 'done' || s[c].state === 'paused' || s[c].state === 'asking' || s.holder === c) return c;
  return shown();
}
/** Riff 1 only: the conversation's own browser work has finished. */
const ownDone = (c: Conv) => riffNow === R1 && store[c].state === 'done';
/** The chip: the browser, how many windows, and who holds it; it opens and closes the strip. */
function Chip({c, place}: {c: Conv; place: 'turn' | 'dock' | 'head'}) {
  const s = useStore();
  const k = stripConv(c), a = s[k];
  const done = ownDone(c);
  const n = a.wins.length;
  const asking = s.holder === 'person' && s.personFor === c && s[c].state === 'asking';
  const state = done ? `Valmis klo ${STEPS[c][lastStep(c)].at}` : holderLabel(c);
  return (
    <button type="button" className={`rb-chip rb-chip-${place}${asking ? ' rb-chip-ask' : ''}`} data-testid="chip" data-state={done ? 'done' : String(s.holder)}
      aria-expanded={s.strip} onClick={toggleStrip}>
      {asking ? <Icon name="user" aria-hidden="true" /> : <Globe />}
      <b>Selain</b>
      <span className="rb-chip-faces" aria-hidden="true">{a.wins.map((w, i) => <i key={w.id} data-active={activeWin(k) === i || undefined} />)}</span>
      <span className="rb-chip-n">{windows(n)}</span>
      <span className="rb-chip-count" aria-hidden="true">{n}</span>
      <span className="rb-chip-state">{state}</span>
      <Icon name="down" className="rb-chip-fold" aria-hidden="true" />
    </button>
  );
}
/** The strip: one small picture per window, the sentence, and the one action. */
function Strip({c, layout}: {c: Conv; layout: 'row' | 'focus'}) {
  const s = useStore();
  if (!s.strip) return null;
  const k = stripConv(c), a = s[k];
  const done = ownDone(c);
  const active = Math.max(0, activeWin(k));
  const order = !a.wins.length ? [] : layout === 'focus' ? [active, ...a.wins.map((_, i) => i).filter((i) => i !== active)] : a.wins.map((_, i) => i);
  const asking = s.holder === 'person' && s.personFor === c && s[c].state === 'asking';
  const sentence = done
    ? `Valmis klo ${STEPS[c][lastStep(c)].at} · ${STEPS[c].length} tointa selaimessa${a.closed ? ` · agentti sulki ${a.closed} ylimääräistä ikkunaa` : ''}.`
    : asking ? 'Agentti on pysähtynyt kesken latauksen. Syötä koodi omassa selaimessasi, niin agentti jatkaa siitä.'
      : s[c].state === 'queued' && s.holder ? `${s[c].movedTo ? `Annoit selaimen toiselle keskustelulle klo ${s[c].movedTo}. ` : ''}${nowLine(c)}. Agentti jatkaa tästä, kun selain vapautuu.`
        : s.holder === null ? `Selain on vapaa ja yhä kirjautunut. Viimeksi sitä käytti ${TITLE[k]} klo ${STEPS[k][lastStep(k)].at}.`
          : nowLine(c);
  return (
    <section className={`rb-strip rb-strip-${layout}${k !== c ? ' rb-strip-other' : ''}${asking ? ' rb-strip-ask' : ''}`} data-testid="strip" aria-label="Selaimen ikkunat">
      {asking ? <h3 className="rb-strip-title"><Icon name="user" aria-hidden="true" />Netvisor pyytää vahvistuskoodia</h3> : null}
      <div className="rb-strip-pics">
        {!order.length ? <p className="rb-strip-empty">Agentti avaa ensimmäistä ikkunaa…</p> : null}
        {order.map((i, pos) => <WinPicture key={a.wins[i].id} c={k} win={i} size={layout === 'focus' && pos === 0 ? 'big' : 'small'} />)}
      </div>
      <div className="rb-strip-foot">
        <p className="rb-strip-now" data-testid="now-line">{sentence}</p>
        <div className="rb-actions">
          <MainAction c={c} />
          {k === c && !asking ? <ControlButton data-testid="show-big" size="row" variant="quiet" onPress={() => openSheet(-1)}>{done ? 'Avaa selain' : 'Näytä isona'}</ControlButton> : null}
        </div>
        {waitLine(c) && s[c].state !== 'queued' ? <p className="rb-strip-wait" data-testid="wait-line"><Icon name="agent" aria-hidden="true" />{waitLine(c)} · <button type="button" className="rb-link" onClick={() => goTo(other(c))}>Siirry</button></p> : null}
      </div>
    </section>
  );
}

// ---------- The person's browser as one row in the left rail ----------

function RailRow({withPicture}: {withPicture: boolean}) {
  const s = useStore();
  const h = s.holder, k = shown(), n = s[k].wins.length;
  const who = h === null ? 'Vapaa · kirjautunut'
    : h === 'person' ? (s[s.personFor!].state === 'asking' ? `Odottaa sinua · ${TITLE[s.personFor!]}` : 'Sinä ohjaat')
      : `${TITLE[h]} käyttää`;
  return (
    <section className="rb-railrow-wrap" aria-label="Oma selain">
      <button type="button" className="rb-railrow" data-testid="rail-browser" data-holder={String(h)} onClick={() => openSheet(-1)}>
        {withPicture && n ? (
          <span className="rb-pic rb-pic-rail" aria-hidden="true"><BrowserScreen c={k} win={Math.max(0, activeWin(k))} small /></span>
        ) : <span className="rb-railrow-mark"><Globe /></span>}
        <span className="rb-railrow-text">
          <b>Oma selain</b>
          <small>{who}{h && h !== 'person' ? ` · ${windows(n)}` : ''}</small>
        </span>
      </button>
    </section>
  );
}

// ---------- The sheet (round 1, direction 3), now with the windows ----------

/**
 * The remote display scaled uniformly into the sheet, as noVNC does, so the
 * pointer's page coordinates land on the same spot as in the small pictures.
 */
function FitScreen({children}: {children: React.ReactNode}) {
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setK(Math.min(el.clientWidth / 800, el.clientHeight / 500));
    fit();
    const o = new ResizeObserver(fit);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return (
    <div className="rb-sheet-screen" ref={box}>
      <div className="rb-fit" style={{'--pic-scale': k, width: 800 * k, height: 500 * k} as React.CSSProperties}>{children}</div>
    </div>
  );
}

function BrowserSheet() {
  const s = useStore();
  const c = s.view, k = shown(), a = s[k];
  const win = s.sheetWin >= 0 && s.sheetWin < a.wins.length ? s.sheetWin : Math.max(0, activeWin(k));
  const following = s.sheetWin < 0;
  return (
    <ModalOverlay className="ah-overlay rb-sheet-overlay" isOpen={s.sheet} isDismissable onOpenChange={(o) => { if (!o) closeSheet(); }}>
      <Modal className="ah-modal rb-sheet">
        <AriaDialog className="rb-sheet-dialog" data-testid="browser-sheet" aria-label="Oma selain">
          <header className="rb-sheet-head">
            <Heading slot="title">Oma selain</Heading>
            <DriverChip c={c} />
            {k !== c && s.holder ? <ControlButton size="row" variant="quiet" onPress={() => { closeSheet(); goTo(k); }}>Siirry: {TITLE[k]}</ControlButton> : null}
            <ControlButton data-testid="close-browser" size="row" variant="quiet" aria-label="Sulje" onPress={closeSheet}><Icon name="cross" /></ControlButton>
          </header>
          <div className="rb-sheet-tabs" data-testid="sheet-tabs">
            {a.wins.map((w, i) => (
              <button key={w.id} type="button" className="rb-tab" aria-pressed={i === win} data-testid="sheet-tab" onClick={() => { store.sheetWin = i; notify(); }}>
                <Globe /><span>{w.title}</span>{activeWin(k) === i && s.holder === k ? <span className="rb-tab-here"><Arrow />agentti</span> : null}
              </button>
            ))}
            {s.holder === k && a.wins.length > 1 ? (
              <label className="rb-follow"><input type="checkbox" checked={following} onChange={() => { store.sheetWin = following ? win : -1; notify(); }} /> Seuraa agenttia</label>
            ) : null}
          </div>
          <FitScreen><BrowserScreen c={k} win={win} /></FitScreen>
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
  const done = STEPS.osto.map((_, i) => i).filter((i) => i <= a.step);
  const before = done.filter((i) => i <= ASK), after = done.filter((i) => i > ASK);
  items.push({id: 'a2', kind: 'assistant', content: <AgentTurn key={`a2-${a.step >= ASK}`} startedAt={T0 + 3 * 60000}
    working={working && a.step < ASK} duration={a.step >= ASK ? '3 min 10 s' : undefined}
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
  if (riff === R1) items.push({id: 'chip', kind: 'notice', content: <div className="rb-turnchip"><Chip c={c} place="turn" /><Strip c={c} layout="row" /></div>});
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
      sessionActions={<>{riff === R3 ? <RailRow withPicture={false} /> : null}<AccountShelf name="Aino Virtanen" onSettings={noop} onLogout={noop} /></>}
      now={
        <>
          {riff !== R3 ? <RailRow withPicture={riff === R2} /> : null}
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
        </>
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
        controlLabel="" detailsExpanded={false} onToggleDetails={noop}
        editorControl={riff === R3 ? <Chip c={c} place="head" /> : undefined} />
      {riff === R3 ? <div className="rb-drop"><Strip c={c} layout="focus" /></div> : null}
      <ConversationStream>
        <ConversationTimeline state="ready" items={timeline(c, riff)} historyMode="pagedAccessible" onJumpToLatest={noop} />
      </ConversationStream>
      {riff === R2 ? <div className="rb-dock"><Strip c={c} layout="row" /><Chip c={c} place="dock" /></div> : null}
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
  riffNow = riff;
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
  useEffect(() => {
    const c = store.holder;
    if ((c === 'osto' || c === 'rekry') && store[c].step >= 0) playMoves(c, store[c].step);
    advance();
    return () => stopAll();
  }, [generation]);
  const scene = (sc: Scene) => { resetStore(sc, store.view); setGeneration((g) => g + 1); };
  return (
    <div className={`rb-review variant-${riff}`} data-direction={riff}>
      <header className="rb-reviewbar" ref={bar}>
        <strong>Oma palvelinselain · kierros 3</strong>
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
const variants = directions.map((_, riff) => () => { resetStore(); riffNow = riff; return <App key={riff} riff={riff} />; });
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
