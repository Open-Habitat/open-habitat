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

// proto-remote-browser-session, round 4. Jari (7.11.2026, round 3): the chip
// sits above the composer (round 3 riff 2). When the agent has several windows
// and one of them needs the person (feedback, sign-in, MFA), the request must
// belong to that window, not read as text under all of them. Looking closer (a
// larger picture or the sheet) is only watching: the agent keeps control until
// the person explicitly takes it, and gives it back explicitly. Kept fixed in
// every riff: the chip above the composer, the arrow pointer with its click
// trail (round 3 riff 2) and the browser as the top text row of the rail
// (round 3 riff 1). The axis: where the request lives and how far taking
// control reaches.
// Host fact this round leans on: noVNC has a view-only mode (`viewOnly`), and
// the browser host already refuses agent input while the person holds control,
// so watching costs the agent nothing and taking control is one host switch.
const directions = ['1 Alla', '2 Esiin', '3 Ikkunalle'];
const LINES = [
  '1 Pyyntö ikkunan alla: pyyntö on sen ikkunan kuvan alla, joka tarvitsee sinua; painallus avaa arkin katseltavaksi, ja ohjaus otetaan arkissa erikseen koko selaimelle.',
  '2 Ikkuna esiin: sinua tarvitseva ikkuna nousee palkissa isoksi ja pyyntö on sen vieressä; kuvaa voi katsoa isompana, ja Ota ohjaus ja syötä koodi on yksi nimetty painallus.',
  '3 Ohjaus ikkunalle: pyyntö on ikkunan kuvassa, ja ohjaus otetaan vain siihen ikkunaan; agentti jatkaa muissa ikkunoissa, ja jokainen ikkuna kertoo, kuka sitä ohjaa.',
];
const R1 = 0, R2 = 1, R3 = 2;
let riffNow = R1;

// ---------- The story: Aino Virtanen, Contoso, two conversations, one browser ----------

type Conv = 'osto' | 'rekry';
type Page = 'home' | 'list' | 'expired' | 'cc' | 'pdf' | 'li-home' | 'li-results' | 'li-profile';
/** What a conversation's agent is doing with the browser. `asking`: one window waits for the person. */
type AgentState = 'working' | 'queued' | 'asking' | 'done';
/** One browser window the conversation's agent has open; the host lists them from CDP targets. */
type Win = {id: string; title: string; page: Page};
/** The agent's pointer: the last Input.dispatchMouseEvent the host relayed, in one window. */
type Ptr = {win: number; x: number; y: number};
type Click = {win: number; x: number; y: number; n: number};
type Agent = {step: number; state: AgentState; movedTo: string; wins: Win[]; ptr: Ptr | null; clicks: Click[]; closed: number; side: number};
/** What the person controls in the browser: nothing (watching), all of it, or one window (riff 3). */
type Person = null | 'all' | number;
const TITLE: Record<Conv, string> = {osto: 'Lokakuun ostolaskut', rekry: 'Rekrytointi: myyjä'};
const other = (c: Conv): Conv => (c === 'osto' ? 'rekry' : 'osto');
const fresh = (): Agent => ({step: -1, state: 'queued', movedTo: '', wins: [], ptr: null, clicks: [], closed: 0, side: 0});
const store = {
  view: 'osto' as Conv, sheet: false, sheetWin: -1, code: '', strip: true, big: -1,
  holder: 'osto' as Conv | null, person: null as Person, took: '', verified: '', last: 'osto' as Conv, clickN: 0,
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
/**
 * Riff 3 only: what the purchase-invoice agent does in its other windows while
 * one window is the person's. Each item is one tick of pointer moves.
 */
const SIDE: {target: string; moves: Move[]}[] = [
  {target: 'Vertaa AWS-laskun rivejä kustannuspaikkoihin', moves: [[2, 30, 58], [2, 72, 58, 1]]},
  {target: 'Vertaa AWS-laskun rivejä kustannuspaikkoihin', moves: [[2, 72, 66, 1], [2, 72, 74, 1]]},
  {target: 'Tarkista IT:n kustannuspaikan summa', moves: [[1, 40, 34], [1, 80, 34, 1]]},
  {target: 'Tarkista Toimitilojen kustannuspaikan summa', moves: [[1, 40, 41], [1, 80, 41, 1]]},
];
const ASK = 7;
const ASK_WIN = 0;
const START = 4;
const TICK = 2400;
const stepOf = (c: Conv) => (store[c].step >= 0 ? STEPS[c][store[c].step] : undefined);
const nowAt = (c: Conv) => stepOf(c)?.at ?? '10.14';
const lastStep = (c: Conv) => STEPS[c].length - 1;
/** The person controls window `win` of the browser now. */
const personHas = (win: number) => store.person === 'all' || store.person === win;
const asking = (c: Conv) => store[c].state === 'asking';

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
function playList(c: Conv, moves: Move[]) {
  moveTimers.forEach((t) => window.clearTimeout(t));
  const gap = TICK / (moves.length + 1);
  moveTimers = moves.map((m, k) => window.setTimeout(() => {
    if (store.holder !== c || personHas(m[0])) return;
    pointTo(c, m); notify();
  }, gap * (k + 0.5)));
}
const playMoves = (c: Conv, i: number) => playList(c, STEPS[c][i].moves);
function stopAll() { window.clearTimeout(timer); moveTimers.forEach((t) => window.clearTimeout(t)); moveTimers = []; }
/** Riff 3: the agent works on in the windows the person does not hold. */
const sideWork = (c: Conv) => riffNow === R3 && c === 'osto' && store.person !== 'all' && store.osto.wins.length > 2 && (asking(c) || store.person !== null);

function advance() {
  window.clearTimeout(timer);
  const c = store.holder;
  if (!c || store[c].state === 'done' || store[c].state === 'queued') return;
  timer = window.setTimeout(() => {
    if (store.holder !== c) return;
    const a = store[c];
    const next = STEPS[c][a.step + 1];
    if (a.state === 'working' && next && !personHas(next.win)) {
      applyStep(c, a.step + 1);
      if (next.ask) { pointTo(c, next.moves[0]); a.state = 'asking'; notify(); advance(); return; }
      if (a.step === lastStep(c)) { a.state = 'done'; release(); return; }
      playMoves(c, a.step);
    } else if (sideWork(c)) {
      a.side = (a.side + 1) % SIDE.length;
      playList(c, SIDE[a.side].moves);
    } else return;
    notify();
    advance();
  }, TICK);
}
/** The driving client let go: the next conversation waiting for the browser gets it. */
function release() {
  const was = store.holder;
  if (was) store.last = was;
  store.holder = null; store.person = null;
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
const shown = (): Conv => store.holder ?? store.last;
function verify() {
  const c = shown(), w = store[c].wins[ASK_WIN];
  if (w && w.page === 'expired') store[c].wins = store[c].wins.map((x, k) => (k === ASK_WIN ? {...x, page: 'list'} : x));
  if (asking(c)) { store[c].state = 'working'; store.verified = '10.18'; }
  store.code = ''; notify();
  advance();
}
const signedIn = () => store[shown()].wins[ASK_WIN]?.page !== 'expired';
/**
 * The person takes control: in riffs 1 and 2 of the whole browser, and the
 * agent waits; in riff 3 of one window, and the agent works on in the others.
 * Only this action takes control; watching never does.
 */
function takeControl(win?: number) {
  const c = store.holder;
  if (!c) return;
  const w = win ?? (store.sheetWin >= 0 ? store.sheetWin : Math.max(0, activeWin(c)));
  store.person = riffNow === R3 ? w : 'all';
  store.took = nowAt(c);
  if (riffNow !== R3) stopAll();
  notify();
  advance();
}
/** "Anna takaisin agentille": the agent drives again and carries on where it stopped. */
function handBack() {
  store.person = null;
  notify();
  advance();
}
/** The person gives the browser to this conversation; the one driving it waits for its turn. */
function moveHere(c: Conv) {
  const from = store.holder;
  if (from !== other(c) || store.person !== null) return;
  stopAll();
  store[from].state = 'queued'; store[from].movedTo = nowAt(from);
  store.holder = c; store.last = c; store[c].state = 'working'; store[c].movedTo = '';
  notify();
  advance();
}

type Scene = 'asking' | 'working' | 'done';
function resetStore(scene: Scene = 'asking', view: Conv = 'osto') {
  stopAll();
  Object.assign(store, {view, sheet: false, sheetWin: -1, code: '', strip: true, big: -1, person: null, took: '', verified: '', clickN: 0, osto: fresh(), rekry: fresh()});
  const upTo = (c: Conv, n: number) => {
    for (let i = 0; i <= n; i++) {
      applyStep(c, i);
      for (const m of STEPS[c][i].moves) pointTo(c, m);
    }
  };
  if (scene === 'working') { upTo('osto', START); store.osto.state = 'working'; Object.assign(store, {holder: 'osto', last: 'osto'}); }
  if (scene === 'asking') { upTo('osto', ASK); store.osto.state = 'asking'; Object.assign(store, {holder: 'osto', last: 'osto'}); }
  if (scene === 'done') {
    // The purchase invoices are done and the browser went to the waiting conversation.
    upTo('osto', lastStep('osto')); store.osto.state = 'done'; store.verified = '10.18';
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
const winTitle = (c: Conv, w: number) => store[c].wins[w]?.title ?? '';
/** Who holds the browser, seen from conversation `c`, in words. */
function holderLabel(c: Conv) {
  const s = store, h = s.holder;
  if (h === null) return 'Vapaa · kirjautunut';
  if (h !== c) return asking(h) && !personHas(ASK_WIN) ? `${TITLE[h]} odottaa sinua` : s.person !== null ? 'Sinä ohjaat' : `${TITLE[h]} käyttää`;
  if (s.person === 'all') return 'Sinä ohjaat';
  if (typeof s.person === 'number') return `Sinä ohjaat: ${winTitle(c, s.person)}`;
  if (asking(c)) return `${winTitle(c, ASK_WIN)} odottaa sinua`;
  return 'Agentti käyttää';
}
/** Who holds the browser, seen from conversation `c`. Words and an icon, never a coloured edge. */
function DriverChip({c}: {c: Conv}) {
  const s = useStore();
  const mine = s.person !== null || s.holder === null;
  return (
    <span className={`rb-driver${mine ? '' : ' rb-driver-agent'}`} data-testid="driver" data-person={String(s.person)}>
      <Icon name={mine ? 'user' : 'agent'} aria-hidden="true" />{holderLabel(c)}
    </span>
  );
}
const lower = (t: string) => t[0].toLowerCase() + t.slice(1);
/** What the agent does now, seen from conversation `c`. Never repeats a window's request. */
function nowLine(c: Conv) {
  const s = store, h = s.holder;
  if (h === c) {
    if (s.person === 'all') return `Otit ohjauksen klo ${s.took}. Agentti odottaa, kunnes annat selaimen takaisin.`;
    if (sideWork(c)) return `Agentti jatkaa muissa ikkunoissa: ${lower(SIDE[s[c].side].target)}.`;
    if (asking(c)) return 'Agentti on pysähtynyt ja odottaa sinua.';
    return stepOf(c) ? stepOf(c)!.target : 'Agentti aloittaa…';
  }
  if (h) return asking(h) ? `${TITLE[h]} odottaa sinua.` : `${TITLE[h]}: ${stepOf(h) ? lower(stepOf(h)!.target) : 'aloittaa'}`;
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
/** The window the agent acts in now, or -1. */
const activeWin = (c: Conv) => (store.holder === c && store[c].ptr && !personHas(store[c].ptr!.win) ? store[c].ptr!.win : -1);
/**
 * The agent's pointer and its last clicks, drawn over one window (round 3
 * riff 2). The host knows them from the Input.dispatchMouseEvent calls it
 * relays to Chrome; nothing moves on the X display. Hidden in a window the
 * person controls: there the pointer is the person's own.
 */
function AgentPointer({c, win, small}: {c: Conv; win: number; small: boolean}) {
  const a = store[c];
  if (activeWin(c) !== win || !a.ptr) return null;
  const clicks = a.clicks.filter((k) => k.win === win);
  const last = clicks[clicks.length - 1];
  return (
    <span className={`rb-ptr rb-ptr-trail${small ? ' rb-ptr-small' : ''}`} aria-hidden="true">
      {clicks.slice(0, -1).map((k, i) => <span key={k.n} className="rb-trail" data-age={clicks.length - 1 - i} style={{left: `${k.x}%`, top: `${k.y}%`}} />)}
      {last ? <span key={last.n} className="rb-click" data-testid="agent-click" style={{left: `${last.x}%`, top: `${last.y}%`}} /> : null}
      <span className="rb-ptr-at" data-testid="agent-pointer" style={{left: `${a.ptr.x}%`, top: `${a.ptr.y}%`}}><Arrow /></span>
    </span>
  );
}
/**
 * One window of the person's browser. `small` is a picture: it never takes
 * input. The sheet's window takes input only where the person holds control
 * or nobody holds the browser; otherwise it is watched, as noVNC's view-only.
 */
function BrowserScreen({c, win, small = false}: {c: Conv; win: number; small?: boolean}) {
  const s = useStore();
  const w = s[c].wins[win] ?? s[c].wins[0];
  const page = w?.page ?? 'list';
  const live = !small && (personHas(win) || s.holder === null);
  const watched = !small && !live;
  const [hint, setHint] = useState(false);
  const got = (c === 'osto' ? stepOf('osto')?.got : 0) ?? 0;
  return (
    <div className={`rb-screen${small ? ' rb-screen-small' : ''}`} data-testid={small ? 'mini-screen' : 'browser-screen'} data-page={page} data-live={live || undefined}>
      <div className="rb-chrome" aria-hidden={small}>
        <span className="rb-chrome-btns"><Icon name="back" /><Icon name="forward" /><Icon name="refresh" /></span>
        <span className="rb-url"><Icon name="lock" />{URLS[page]}</span>
      </div>
      <div className="rb-site" inert={!live}>
        <SitePage page={page} live={live} got={got} />
      </div>
      <AgentPointer c={c} win={win} small={small} />
      {watched ? (
        <button type="button" className="rb-viewonly" data-testid="view-only" aria-label="Katselet. Ota ohjaus, jos haluat käyttää selainta itse." onClick={() => setHint(true)}>
          {hint ? <span className="rb-viewonly-hint">Katselet. Ota ohjaus, jos haluat käyttää selainta itse.</span> : null}
        </button>
      ) : null}
    </div>
  );
}

/** Who acts in window `win`, in a few words under its picture or on its tab. */
function WhoTag({c, win}: {c: Conv; win: number}) {
  const s = store;
  if (s.holder !== c) return null;
  if (personHas(win)) return <span className="rb-who rb-who-you" data-testid="who-you"><Icon name="user" aria-hidden="true" />sinä ohjaat</span>;
  if (asking(c) && win === ASK_WIN) return <span className="rb-who rb-who-ask"><Icon name="user" aria-hidden="true" />odottaa sinua</span>;
  if (activeWin(c) === win) return <span className="rb-who rb-who-agent"><Arrow />agentti tässä</span>;
  return null;
}
/** The window waits for the person: its request has not been answered and the person has not taken it. */
const waitsHere = (c: Conv, win: number) => asking(c) && win === ASK_WIN && store.holder === c;

/**
 * The request, attached to the one window that needs the person. Each riff
 * words its action differently: riff 1 only opens the window to look at it,
 * riff 2 names the taking of control in the button, riff 3 takes this window.
 */
function Request({c, place}: {c: Conv; place: 'under' | 'beside' | 'on'}) {
  const s = useStore();
  const taken = personHas(ASK_WIN);
  const title = `${winTitle(c, ASK_WIN)} pyytää vahvistuskoodia`;
  if (place === 'under')
    return (
      <div className="rb-ask rb-ask-under" data-testid="win-ask">
        <p><Icon name="user" aria-hidden="true" /><span>{title}</span></p>
        <ControlButton data-testid="ask-action" size="row" variant="primary" onPress={() => openSheet(ASK_WIN)}>{taken ? 'Jatka koodin syöttämistä' : 'Syötä koodi'}</ControlButton>
      </div>
    );
  if (place === 'beside')
    return (
      <div className="rb-ask rb-ask-beside" data-testid="win-ask">
        <h3><Icon name="user" aria-hidden="true" />{title}</h3>
        <p>Agentti pysähtyi lataamaan laskuja 7–14 tässä ikkunassa. Kun otat ohjauksen, agentti odottaa, kunnes annat selaimen takaisin.</p>
        <div className="rb-actions">
          {taken
            ? <ControlButton data-testid="ask-action" size="row" variant="primary" onPress={() => openSheet(ASK_WIN)}>Jatka koodin syöttämistä</ControlButton>
            : <ControlButton data-testid="ask-action" size="row" variant="primary" onPress={() => { takeControl(ASK_WIN); openSheet(ASK_WIN); }}>Ota ohjaus ja syötä koodi</ControlButton>}
          {!taken ? <ControlButton data-testid="ask-watch" size="row" variant="quiet" onPress={() => openSheet(ASK_WIN)}><Icon name="eye" aria-hidden="true" /> Katso ensin</ControlButton> : null}
        </div>
      </div>
    );
  return (
    <div className="rb-ask rb-ask-on" data-testid="win-ask">
      <p className="rb-ask-text">{title}</p>
      <ControlButton data-testid="ask-action" size="row" variant="primary" onPress={() => { if (!taken) takeControl(ASK_WIN); openSheet(ASK_WIN); }}>{taken ? 'Jatka' : 'Ota tämä ikkuna'}</ControlButton>
    </div>
  );
}

/** One window as a picture; pressing it only looks closer, it never takes control. */
function WinPicture({c, win, size, onLook}: {c: Conv; win: number; size: string; onLook: () => void}) {
  const s = store;
  const w = s[c].wins[win];
  const here = activeWin(c) === win;
  const wait = waitsHere(c, win);
  return (
    <figure className={`rb-win rb-win-${size}`} data-win={win} data-active={here || undefined} data-ask={wait || undefined} data-mine={(s.holder === c && personHas(win)) || undefined}>
      <button type="button" className="rb-pic" data-testid="win-pic" data-active={here || undefined} onClick={onLook}
        aria-label={size === 'small' && riffNow === R2 ? `Näytä ikkuna ${w.title} isompana` : `Katso ikkunaa ${w.title} isona`}>
        <BrowserScreen c={c} win={win} small />
        {wait && riffNow === R3 ? <span className="rb-pic-badge" aria-hidden="true"><Icon name="user" />Odottaa sinua</span> : null}
      </button>
      <figcaption>
        <span className="rb-win-title">{w.title}</span>
        {wait && riffNow !== R2 ? null : <WhoTag c={c} win={win} />}
      </figcaption>
      {wait && riffNow === R1 ? <Request c={c} place="under" /> : null}
      {wait && riffNow === R3 ? <Request c={c} place="on" /> : null}
      {riffNow === R3 && s.holder === c && s.person === win ? (
        <div className="rb-win-mine">
          <ControlButton data-testid="hand-back-win" size="row" variant="secondary" isDisabled={win === ASK_WIN && !signedIn()} onPress={handBack}>Anna takaisin</ControlButton>
        </div>
      ) : null}
    </figure>
  );
}

/** The action that fits the moment, seen from conversation `c`; riff 3 keeps control on the windows. */
function MainAction({c, size = 'row'}: {c: Conv; size?: 'row' | 'page'}) {
  const s = useStore();
  const h = s.holder;
  if (h === c && s.person === 'all')
    return <ControlButton data-testid="hand-back" size={size} variant="primary" isDisabled={!signedIn()} onPress={handBack}>Anna takaisin agentille</ControlButton>;
  if (h === c && s.person === null && riffNow !== R3 && !asking(c))
    return <ControlButton data-testid="take-control" size={size} variant="secondary" onPress={() => takeControl()}>Ota ohjaus</ControlButton>;
  if (h === other(c) && s[c].state === 'queued' && s.person === null && !asking(h))
    return <ControlButton data-testid="move-here" size={size} variant="secondary" onPress={() => moveHere(c)}>Siirrä tälle</ControlButton>;
  if (h === other(c))
    return <ControlButton data-testid="go-driver" size={size} variant="quiet" onPress={() => goTo(other(c))}>Siirry keskusteluun</ControlButton>;
  return null;
}

// ---------- The chip and its strip above the composer (round 3 riff 2) ----------

/** The chip: the browser, its windows, and who holds it; it opens and closes the strip. */
function Chip({c}: {c: Conv}) {
  const s = useStore();
  const k = shown(), a = s[k];
  const n = a.wins.length;
  const wait = s.holder === k && asking(k) && !personHas(ASK_WIN);
  return (
    <button type="button" className={`rb-chip rb-chip-dock${wait ? ' rb-chip-ask' : ''}`} data-testid="chip" data-state={String(s.holder)}
      aria-expanded={s.strip} onClick={toggleStrip}>
      {wait || s.person !== null ? <Icon name="user" aria-hidden="true" /> : <Globe />}
      <b>Selain</b>
      <span className="rb-chip-faces" aria-hidden="true">{a.wins.map((w, i) => (
        <i key={w.id} data-active={activeWin(k) === i || undefined} data-ask={(wait && i === ASK_WIN) || undefined} data-mine={(s.holder === k && personHas(i)) || undefined} />
      ))}</span>
      <span className="rb-chip-n">{windows(n)}</span>
      <span className="rb-chip-state">{holderLabel(c)}</span>
      <Icon name="down" className="rb-chip-fold" aria-hidden="true" />
    </button>
  );
}
/** Riff 2: the window shown large in the strip; a smaller one pressed is shown large instead. */
function bigWin(k: Conv) {
  const n = store[k].wins.length;
  if (store.big >= 0 && store.big < n) return store.big;
  if (asking(k) && store.holder === k) return ASK_WIN;
  return Math.max(0, activeWin(k));
}
/** Riff 2: beside the large picture, what you are looking at and who drives it. */
function Beside({k, win}: {k: Conv; win: number}) {
  const s = useStore();
  if (waitsHere(k, win) && !(personHas(win) && signedIn())) return <Request c={k} place="beside" />;
  const mine = s.holder === k && personHas(win);
  const agentHere = activeWin(k) === win;
  return (
    <div className="rb-beside" data-testid="beside">
      <h3>{winTitle(k, win)}</h3>
      <p className="rb-beside-state">
        {mine ? <><Icon name="user" aria-hidden="true" />Sinä ohjaat. Agentti odottaa.</>
          : s.holder === k ? <><Icon name="eye" aria-hidden="true" />Katselet. {agentHere ? 'Agentti toimii tässä ikkunassa.' : 'Agentti toimii toisessa ikkunassa.'}</>
            : <><Icon name="eye" aria-hidden="true" />Katselet.</>}
      </p>
      {s.big >= 0 && s.holder === k && !mine ? <button type="button" className="rb-link" data-testid="follow-agent" onClick={() => { store.big = -1; notify(); }}>Seuraa agenttia</button> : null}
    </div>
  );
}
/** The strip: the windows as pictures, the sentence, and the one action. */
function Strip({c}: {c: Conv}) {
  const s = useStore();
  if (!s.strip) return null;
  const k = shown(), a = s[k];
  const queued = s[c].state === 'queued' && s.holder;
  const sentence = queued ? `${s[c].movedTo ? `Annoit selaimen toiselle keskustelulle klo ${s[c].movedTo}. ` : ''}${nowLine(c)} Agentti jatkaa tästä, kun selain vapautuu.`
    : s.holder === null ? `Selain on vapaa ja yhä kirjautunut. Viimeksi sitä käytti ${TITLE[k]} klo ${STEPS[k][lastStep(k)].at}.`
      : nowLine(c);
  const big = riffNow === R2 && a.wins.length ? bigWin(k) : -1;
  const order = a.wins.map((_, i) => i).filter((i) => i !== big);
  return (
    <section className={`rb-strip${riffNow === R2 ? ' rb-strip-focus' : ' rb-strip-row'}${k !== c ? ' rb-strip-other' : ''}`} data-testid="strip" aria-label="Selaimen ikkunat">
      {big >= 0 ? (
        <div className="rb-strip-lead" data-win={big}>
          <WinPicture c={k} win={big} size="big" onLook={() => openSheet(big)} />
          <Beside k={k} win={big} />
        </div>
      ) : null}
      <div className="rb-strip-pics">
        {!a.wins.length ? <p className="rb-strip-empty">Agentti avaa ensimmäistä ikkunaa…</p> : null}
        {order.map((i) => <WinPicture key={a.wins[i].id} c={k} win={i} size="small" onLook={riffNow === R2 ? () => { store.big = i; notify(); } : () => openSheet(i)} />)}
      </div>
      <div className="rb-strip-foot">
        <p className="rb-strip-now" data-testid="now-line">{sentence}</p>
        <div className="rb-actions">
          <MainAction c={c} />
          {k === c && a.wins.length ? <ControlButton data-testid="show-big" size="row" variant="quiet" onPress={() => openSheet(riffNow === R2 && s.big >= 0 ? s.big : -1)}><Icon name="eye" aria-hidden="true" /> Katso isona</ControlButton> : null}
        </div>
        {waitLine(c) && s[c].state !== 'queued' ? <p className="rb-strip-wait" data-testid="wait-line"><Icon name="agent" aria-hidden="true" />{waitLine(c)} · <button type="button" className="rb-link" onClick={() => goTo(other(c))}>Siirry</button></p> : null}
      </div>
    </section>
  );
}

// ---------- The person's browser as the top text row of the rail (round 3 riff 1) ----------

function RailRow() {
  const s = useStore();
  const h = s.holder, k = shown(), n = s[k].wins.length;
  const who = h === null ? 'Vapaa · kirjautunut'
    : s.person !== null ? `Sinä ohjaat · ${TITLE[h]}`
      : asking(h) ? `Odottaa sinua · ${TITLE[h]}` : `${TITLE[h]} käyttää · ${windows(n)}`;
  return (
    <section className="rb-railrow-wrap" aria-label="Oma selain">
      <button type="button" className="rb-railrow" data-testid="rail-browser" onClick={() => openSheet(-1)}>
        <span className="rb-railrow-mark">{h && (asking(h) || s.person !== null) ? <Icon name="user" aria-hidden="true" /> : <Globe />}</span>
        <span className="rb-railrow-text">
          <b>Oma selain</b>
          <small>{who}</small>
        </span>
      </button>
    </section>
  );
}

// ---------- The sheet: watching, or the person in control ----------

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
/** One sentence about window `win` as the sheet shows it, and whether it is watched. */
function sheetLine(c: Conv, k: Conv, win: number) {
  const s = store;
  if (s.holder === null) return 'Selain on vapaa. Voit käyttää sitä itse.';
  if (k !== c) return `Katselet. ${nowLine(c)}`;
  if (personHas(win)) {
    if (waitsHere(k, win) || !signedIn()) return 'Sinä ohjaat. Syötä Netvisorin koodi; agentti odottaa.';
    if (riffNow === R3) return `Sinä ohjaat tätä ikkunaa. Agentti jatkaa muissa ikkunoissa.`;
    return s.verified && s.osto.step === ASK ? 'Koodi hyväksytty. Anna selain takaisin, niin agentti jatkaa siitä, mihin jäi.' : 'Sinä ohjaat. Agentti odottaa, kunnes annat selaimen takaisin.';
  }
  if (waitsHere(k, win)) return riffNow === R3 ? 'Katselet. Tämä ikkuna odottaa sinua; ota se, niin voit syöttää koodin. Agentti jatkaa muissa ikkunoissa.' : 'Katselet. Netvisor pyytää koodia; ota ohjaus, niin voit syöttää sen.';
  if (riffNow === R3 && typeof s.person === 'number') return `Katselet. Agentti toimii tässä ikkunassa; sinä ohjaat ikkunaa ${winTitle(k, s.person)}.`;
  return activeWin(k) === win ? 'Katselet. Agentti ohjaa, eikä katselu keskeytä sitä.' : 'Katselet. Agentti toimii toisessa ikkunassa.';
}
/** The sheet's one control action for window `win`. */
function SheetAction({c, k, win, size}: {c: Conv; k: Conv; win: number; size: 'row' | 'page'}) {
  const s = useStore();
  if (k !== c || s.holder !== k) return <MainAction c={c} size={size} />;
  if (personHas(win)) return <ControlButton data-testid="hand-back" size={size} variant="primary" isDisabled={!signedIn()} onPress={handBack}>{riffNow === R3 ? 'Anna ikkuna takaisin' : 'Anna takaisin agentille'}</ControlButton>;
  if (riffNow === R3 && s.person !== null) return null;
  return <ControlButton data-testid="take-control" size={size} variant={waitsHere(k, win) ? 'primary' : 'secondary'} onPress={() => takeControl(win)}>{riffNow === R3 ? 'Ota tämä ikkuna' : 'Ota ohjaus'}</ControlButton>;
}

function BrowserSheet() {
  const s = useStore();
  const c = s.view, k = shown(), a = s[k];
  const win = s.sheetWin >= 0 && s.sheetWin < a.wins.length ? s.sheetWin : Math.max(0, activeWin(k));
  const following = s.sheetWin < 0;
  const mine = s.holder === k && personHas(win) || s.holder === null;
  const line = sheetLine(c, k, win);
  return (
    <ModalOverlay className="ah-overlay rb-sheet-overlay" isOpen={s.sheet} isDismissable onOpenChange={(o) => { if (!o) closeSheet(); }}>
      <Modal className="ah-modal rb-sheet">
        <AriaDialog className="rb-sheet-dialog" data-testid="browser-sheet" data-mode={mine ? 'control' : 'watch'} aria-label="Oma selain">
          <header className="rb-sheet-head">
            <Heading slot="title">Oma selain</Heading>
            {riffNow === R1 ? <DriverChip c={c} /> : null}
            {k !== c && s.holder ? <ControlButton size="row" variant="quiet" onPress={() => { closeSheet(); goTo(k); }}>Siirry: {TITLE[k]}</ControlButton> : null}
            <ControlButton data-testid="close-browser" size="row" variant="quiet" aria-label="Sulje" onPress={closeSheet}><Icon name="cross" /></ControlButton>
          </header>
          <div className="rb-sheet-tabs" data-testid="sheet-tabs">
            {a.wins.map((w, i) => (
              <button key={w.id} type="button" className="rb-tab" aria-pressed={i === win} data-testid="sheet-tab" onClick={() => { store.sheetWin = i; notify(); }}>
                <Globe /><span>{w.title}</span><WhoTag c={k} win={i} />
              </button>
            ))}
            {s.holder === k && a.wins.length > 1 && activeWin(k) >= 0 ? (
              <label className="rb-follow"><input type="checkbox" checked={following} onChange={() => { store.sheetWin = following ? win : -1; notify(); }} /> Seuraa agenttia</label>
            ) : null}
          </div>
          {riffNow !== R1 ? (
            <div className="rb-band" data-testid="sheet-band" data-mode={mine ? 'control' : 'watch'}>
              <Icon name={mine ? 'user' : 'eye'} aria-hidden="true" />
              <p data-testid="sheet-line">{line}</p>
              <SheetAction c={c} k={k} win={win} size="row" />
            </div>
          ) : null}
          <FitScreen><BrowserScreen c={k} win={win} /></FitScreen>
          {riffNow === R1 ? (
            <footer className="rb-bar">
              <p className="rb-bar-now" data-testid="sheet-line">{line}</p>
              <SheetAction c={c} k={k} win={win} size="page" />
            </footer>
          ) : null}
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
  const waitWord = riffNow === R3
    ? 'Netvisor pyytää vahvistuskoodia Netvisor-ikkunassa. En voi syöttää sitä puolestasi; tarkistan sillä välin AWS-laskua ja kustannuspaikkoja muissa ikkunoissa.'
    : 'Netvisor pyytää vahvistuskoodia Netvisor-ikkunassa. En voi syöttää sitä puolestasi; jatkan, kun olet syöttänyt sen ja antanut selaimen takaisin.';
  items.push({id: 'a2', kind: 'assistant', content: <AgentTurn key={`a2-${a.step >= ASK}`} startedAt={T0 + 3 * 60000}
    working={working && a.step < ASK} duration={a.step >= ASK ? '3 min 10 s' : undefined}
    steps={[...before.map((i) => browserStep('osto', i)), ...(a.step >= ASK ? [say('q', waitWord)] : [])]} />});
  if (store.took && store.person !== null && working) items.push(line('p', 'user', riffNow === R3
    ? `Otit ikkunan ${winTitle('osto', store.person as number)} klo ${store.took}. Agentti jatkaa muissa ikkunoissa.`
    : `Otit selaimen ohjauksen klo ${store.took}. Agentti odottaa, kunnes annat sen takaisin.`, 'took-line'));
  if (store.verified) items.push(line('r2', 'check', `Vahvistit Netvisorin uudelleen klo ${store.verified}.`, 'request2-done'));
  if (after.length || (store.verified && working && store.person === null))
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
function timeline(c: Conv): Item[] {
  const a = store[c];
  const items = c === 'osto' ? ostoTimeline() : rekryTimeline();
  if (a.movedTo && a.state === 'queued') items.push(line('m', 'agent', `Annoit selaimen keskustelulle ${TITLE[other(c)]} klo ${a.movedTo}. Agentti jatkaa, kun selain vapautuu.`, 'moved-line'));
  return items;
}

// ---------- The page ----------

const activity = (c: Conv): Pick<AgentNavModel, 'activity' | 'activityLabel'> => {
  const st = store[c].state, mine = store.holder === c ? store.person : null;
  if (st === 'asking' && mine === null) return {activity: 'waiting', activityLabel: 'Odottaa sinua'};
  if (mine === 'all' || (mine !== null && st === 'asking')) return {activity: 'waiting', activityLabel: 'Sinä ohjaat selainta'};
  if (st === 'working' || st === 'asking') return {activity: 'working', activityLabel: 'Käyttää selainta'};
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
        <>
          <RailRow />
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
  const header = activity(c).activityLabel;
  const busy = s.holder === c && header === 'Käyttää selainta';
  const conversation = (
    <ConversationFrame key={c}>
      <AgentHeader title={TITLE[c]} workspaceLabel={c === 'osto' ? 'talous' : 'rekrytointi'} workspaceHref="/workspaces/ws_t"
        activityLabel={header === 'Valmis' ? '' : header} activityAnimated={busy} activityKind={busy ? 'working' : 'neutral'}
        controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
      <ConversationStream>
        <ConversationTimeline state="ready" items={timeline(c)} historyMode="pagedAccessible" onJumpToLatest={noop} />
      </ConversationStream>
      <div className="rb-dock"><Strip c={c} /><Chip c={c} /></div>
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
    if (c && store[c].state === 'working' && store[c].step >= 0) playMoves(c, store[c].step);
    advance();
    return () => stopAll();
  }, [generation]);
  const scene = (sc: Scene) => { resetStore(sc, store.view); setGeneration((g) => g + 1); };
  return (
    <div className={`rb-review variant-${riff}`} data-direction={riff}>
      <header className="rb-reviewbar" ref={bar}>
        <strong>Oma palvelinselain · kierros 4</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Keskustelu <select id="conv" value={s.view} onChange={(e) => goTo(e.target.value as Conv)}>
          <option value="osto">{TITLE.osto}</option><option value="rekry">{TITLE.rekry} (odottaa selainta)</option></select></label>
        <span className="rb-scenes">
          <button type="button" data-testid="rb-asking" onClick={() => scene('asking')}>Odottaa sinua</button>
          <button type="button" data-testid="rb-working" onClick={() => scene('working')}>Agentti työssä</button>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
