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
import {ControlButton, Segmented} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {ViewSplit} from '../../../../web/src/components/ViewPanel';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {setWorkPreference} from '../../../../web/src/workPreference';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/ViewPanel.css';
import '../../../../web/src/components/EditorSplit.css';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says, and
// the agent's work is shown as it happens.
setPersonalLanguage('fi');
setWorkPreference('visible');

// proto-remote-browser-session, round 1. Jari (6.11.2026): the person has
// their own browser on the server, opens it as a remote view in Habitat,
// signs in to a service and closes the view; the agent then uses the same
// signed-in browser. The axis is where that browser lives in Habitat: 1
// beside the conversation like the editor, 2 a view of its own in the
// navigation with a log of what the agent did there, 3 nowhere until it is
// needed: a sheet opened from the conversation. The story is the same in all
// three: the agent asks Aino to sign in to Netvisor, she hands the browser
// over, the agent works, Netvisor asks for the code again mid-task, she
// enters it and hands back, and she can take control at any time.
const directions = ['1 Rinnakkain', '2 Oma näkymä', '3 Pyydettäessä'];
const LINES = [
  '1 Rinnakkain: selain avautuu keskustelun viereen kuten editori; yläpalkin Selain-painike, ohjaus ja agentin nykyinen toimi paneelin alalaidassa.',
  '2 Oma näkymä: selain on sivupalkissa omana kohtanaan ja avautuu koko näkymäksi; vieressä Agentin toimet -loki kaikista keskusteluista.',
  '3 Pyydettäessä: selainta ei näy ennen kuin sitä tarvitaan; se avautuu arkkina keskustelun päälle, ja agentin työ näkyy keskustelussa pienenä elävänä kuvana.',
];
const D1 = 0, D2 = 1, D3 = 2;

// ---------- The story: Aino Virtanen, Contoso, "Lokakuun ostolaskut" ----------

type Page = 'login' | 'mfa' | 'home' | 'list' | 'expired';
type Phase = 'signin' | 'working' | 'asking' | 'done';
type Driver = 'person' | 'agent';
const store = {
  open: true, page: 'login' as Page, phase: 'signin' as Phase, driver: 'person' as Driver,
  step: -1, paused: false, code: '', handed: [] as string[], took: '' as string, toast: '',
};
// The check script reads the story's phase from here; nothing in the view does.
(window as unknown as {rbStore: typeof store}).rbStore = store;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
let timer = 0;
function resetStore(open = true) {
  window.clearTimeout(timer);
  Object.assign(store, {open, page: 'login', phase: 'signin', driver: 'person', step: -1, paused: false, code: '', handed: [], took: '', toast: ''});
}
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return store;
}
function toast(text: string) {
  store.toast = text; notify();
  window.setTimeout(() => { if (store.toast === text) { store.toast = ''; notify(); } }, 2600);
}

/** The agent's browser steps. Each is an ordinary tool call in the conversation's native history. */
type Step = {at: string; target: string; said: string; page: Page; got?: number; ask?: boolean};
const STEPS: Step[] = [
  {at: '10.14', target: 'Tarkista kirjautuminen', said: 'Etusivulla lukee Aino Virtanen, joten olet kirjautunut.', page: 'home'},
  {at: '10.14', target: 'Avaa Ostot › Ostolaskut', said: 'Ostolaskujen lista on auki.', page: 'list'},
  {at: '10.15', target: 'Rajaa 1.10.–31.10.2026', said: 'Lokakuulta on 14 ostolaskua.', page: 'list'},
  {at: '10.15', target: 'Lataa laskut 1–6 PDF:nä', said: 'Kuusi laskua ladattu kansioon ostolaskut-10/.', page: 'list', got: 6},
  {at: '10.16', target: 'Lataa laskut 7–14 PDF:nä', said: 'Netvisor pyytää vahvistuskoodia uudelleen. En voi syöttää sitä puolestasi.', page: 'expired', got: 6, ask: true},
  {at: '10.18', target: 'Lataa laskut 7–14 PDF:nä', said: 'Loput kahdeksan laskua ladattu.', page: 'list', got: 14},
  {at: '10.19', target: 'Kirjoita yhteenveto', said: 'ostolaskut-lokakuu.md kirjoitettu.', page: 'list', got: 14},
];
const ASK = 4;
const INVOICES = [
  ['Elisa Oyj', '02.10.', '389,40', 'IT'], ['Telia Finland', '03.10.', '214,90', 'IT'], ['Lyreco Finland', '06.10.', '96,12', 'Toimisto'],
  ['Sponda Oy', '01.10.', '4 820,00', 'Toimitilat'], ['Fennia', '08.10.', '612,00', 'Hallinto'], ['Amazon Web Services', '09.10.', '1 248,37', 'IT'],
  ['Kespro', '13.10.', '183,55', 'Toimisto'], ['HSL', '14.10.', '64,80', 'Matkat'], ['Finnair', '16.10.', '418,00', 'Matkat'],
  ['Atea Finland', '20.10.', '2 109,00', 'IT'], ['Visma Netvisor', '22.10.', '149,00', 'Hallinto'], ['Lassila & Tikanoja', '23.10.', '310,00', 'Toimitilat'],
  ['Google Cloud', '28.10.', '86,20', 'IT'], ['Posti', '30.10.', '42,10', 'Toimisto'],
];
const SUMMARY = `Lokakuun ostolaskut, 14 kpl, yhteensä **10 743,44 €**:

| Kustannuspaikka | Laskuja | Yhteensä |
|---|---|---|
| IT | 6 | 4 047,87 € |
| Toimitilat | 2 | 5 130,00 € |
| Hallinto | 2 | 761,00 € |
| Matkat | 2 | 482,80 € |
| Toimisto | 3 | 321,77 € |

PDF:t ovat kansiossa \`ostolaskut-10/\` ja yhteenveto tiedostossa \`ostolaskut-lokakuu.md\`.`;

const stepNow = () => (store.step >= 0 ? STEPS[store.step] : undefined);
const nowAt = () => stepNow()?.at ?? '10.13';
function advance() {
  window.clearTimeout(timer);
  if (store.phase !== 'working' || store.paused) return;
  timer = window.setTimeout(() => {
    if (store.phase !== 'working' || store.paused) return;
    store.step += 1;
    const s = STEPS[store.step];
    store.page = s.page;
    if (s.ask) { store.phase = 'asking'; store.driver = 'person'; }
    else if (store.step === STEPS.length - 1) { store.phase = 'done'; store.driver = 'person'; }
    notify();
    advance();
  }, 1100);
}

// ---------- Actions: the same in every direction, only their place differs ----------

function openBrowser() { store.open = true; notify(); }
function closeBrowser() { store.open = false; notify(); }
function signIn() { store.page = 'mfa'; notify(); }
function verify() {
  store.page = store.page === 'expired' ? 'list' : 'home'; store.code = ''; notify();
}
/** "Valmis, agentti jatkaa": control goes to the agent, and the conversation says so. */
function handOver(dir: number) {
  const at = store.phase === 'asking' ? '10.18' : store.paused ? nowAt() : '10.14';
  store.handed = [...store.handed, at];
  store.driver = 'agent';
  if (store.paused) store.paused = false;
  else if (store.phase === 'asking') { store.phase = 'working'; }
  else if (store.phase === 'signin') { store.phase = 'working'; store.step = -1; }
  store.took = '';
  if (dir === D3) store.open = false;
  notify();
  advance();
}
function takeControl() {
  window.clearTimeout(timer);
  store.paused = true; store.driver = 'person'; store.took = nowAt(); notify();
}
const signedIn = () => store.page === 'home' || store.page === 'list';

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
/** Who holds the browser now. Words and an icon, never a coloured edge. */
function DriverChip() {
  const s = useStore();
  const agent = s.driver === 'agent';
  const waiting = s.phase === 'asking' || s.paused;
  return (
    <span className={`rb-driver${agent ? ' rb-driver-agent' : ''}`} data-testid="driver" data-driver={s.driver}>
      <Icon name={agent ? 'agent' : 'user'} aria-hidden="true" />
      {agent ? 'Agentti käyttää' : waiting ? 'Sinä ohjaat · agentti odottaa' : 'Sinä ohjaat'}
    </span>
  );
}
/** The one control action that fits the moment: hand over, or take control back. */
function ControlAction({dir, size = 'row'}: {dir: number; size?: 'row' | 'page'}) {
  const s = useStore();
  if (s.phase === 'done') return null;
  if (s.driver === 'agent')
    return <ControlButton data-testid="take-control" size={size} variant="secondary" onPress={takeControl}>Ota ohjaus</ControlButton>;
  const ready = signedIn();
  return (
    <ControlButton data-testid="hand-over" size={size} variant="primary" isDisabled={!ready} onPress={() => handOver(dir)}>
      {s.phase === 'signin' ? 'Valmis, agentti jatkaa' : 'Anna takaisin agentille'}
    </ControlButton>
  );
}
/** What is happening in the browser, in one sentence. */
function nowLine() {
  const s = store, st = stepNow();
  if (s.phase === 'done') return 'Agentti on valmis. Selain on yhä kirjautunut Netvisoriin.';
  if (s.paused) return `Otit ohjauksen klo ${s.took}. Agentti jatkaa, kun annat selaimen takaisin.`;
  if (s.phase === 'asking') return signedIn() ? 'Koodi hyväksytty. Anna selain takaisin, niin agentti jatkaa.' : 'Netvisor pyytää vahvistuskoodia. Agentti odottaa, että syötät sen.';
  if (s.driver === 'agent') return st ? `Agentti: ${st.target.toLowerCase()}` : 'Agentti aloittaa…';
  if (s.page === 'login') return 'Kirjaudu Netvisoriin. Agentti ei näe salasanaasi eikä koodiasi.';
  if (s.page === 'mfa') return 'Syötä tunnistussovelluksen koodi.';
  return 'Olet kirjautunut. Anna selain agentille, kun olet valmis.';
}

// ---------- The remote browser (a mock of the person's server browser) ----------

const URLS: Record<Page, string> = {
  login: 'login.netvisor.fi', mfa: 'login.netvisor.fi/vahvista', home: 'netvisor.fi/etusivu',
  list: 'netvisor.fi/ostot/ostolaskut?alku=1.10.2026&loppu=31.10.2026', expired: 'login.netvisor.fi/vahvista?jatka=ostolaskut',
};
/** The remote page. Its colours are the website's, not Habitat's: a remote browser shows the site as it is. */
function SitePage({live}: {live: boolean}) {
  const s = useStore();
  const st = stepNow();
  const got = st?.got ?? 0;
  const ranged = s.step >= 2;
  if (s.page === 'login')
    return (
      <div className="rb-site-center">
        <div className="rb-site-card">
          <p className="rb-site-brand">netvisor</p>
          <h3>Kirjaudu</h3>
          <label>Sähköposti<span className="rb-site-field">aino.virtanen@contoso.test</span></label>
          <label>Salasana<span className="rb-site-field">••••••••••••</span></label>
          <button type="button" data-testid="site-login" className="rb-site-btn" disabled={!live} onClick={signIn}>Kirjaudu</button>
        </div>
      </div>
    );
  if (s.page === 'mfa' || s.page === 'expired')
    return (
      <div className="rb-site-center">
        <div className="rb-site-card">
          <p className="rb-site-brand">netvisor</p>
          <h3>{s.page === 'expired' ? 'Vahvista uudelleen' : 'Kaksivaiheinen tunnistus'}</h3>
          {s.page === 'expired' ? <p className="rb-site-note">Istuntosi vaatii vahvistuksen ennen kuin voit ladata lisää aineistoa.</p> : null}
          <label>Tunnistussovelluksen koodi
            <input data-testid="site-code" className="rb-site-field" inputMode="numeric" maxLength={6} placeholder="6 numeroa" disabled={!live}
              value={s.code} onChange={(e) => { store.code = e.target.value.replace(/\D/g, ''); notify(); }} />
          </label>
          <button type="button" data-testid="site-verify" className="rb-site-btn" disabled={!live || s.code.length !== 6} onClick={verify}>Vahvista</button>
        </div>
      </div>
    );
  return (
    <div className="rb-site-app">
      <div className="rb-site-top"><span className="rb-site-brand">netvisor</span><span>Contoso Oy</span><span className="rb-site-user">Aino Virtanen</span></div>
      <div className="rb-site-body">
        <nav className="rb-site-nav"><span>Etusivu</span><span>Myynti</span><span className={s.page === 'list' ? 'on' : undefined}>Ostot</span><span>Palkat</span><span>Raportit</span></nav>
        {s.page === 'home' ? (
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
                {INVOICES.slice(0, 9).map(([who, d, sum, cc], i) => (
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
const POINTER: Record<number, [number, number]> = {0: [62, 18], 1: [16, 34], 2: [52, 30], 3: [88, 46], 4: [50, 50], 5: [88, 70], 6: [70, 40]};
function BrowserScreen({dir, small = false}: {dir: number; small?: boolean}) {
  const s = useStore();
  const live = s.driver === 'person' && !small;
  const agent = s.driver === 'agent';
  const [hint, setHint] = useState(false);
  const p = POINTER[Math.max(0, s.step)] ?? [50, 50];
  return (
    <div className={`rb-screen${small ? ' rb-screen-small' : ''}`} data-testid={small ? 'mini-screen' : 'browser-screen'} data-page={s.page}>
      <div className="rb-chrome" aria-hidden={small}>
        <span className="rb-chrome-btns"><Icon name="back" /><Icon name="forward" /><Icon name="refresh" /></span>
        <span className="rb-url"><Icon name="lock" />{URLS[s.page]}</span>
      </div>
      <div className="rb-site" inert={!live}>
        <SitePage live={live} />
      </div>
      {agent && s.phase === 'working' ? (
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

// ---------- The conversation (same content in every direction) ----------

const say = (key: string, text: string): TurnStep => ({kind: 'text', key, text, node: <Markdown text={text} />});
const browserStep = (i: number, state: 'running' | 'succeeded'): TurnStep => {
  const st = STEPS[i];
  return {kind: 'tool', key: `b${i}`, at: T0 + (3 + i) * 60000, node: (
    // A running row would open Pi's live output area, which a browser step does not fill.
    <PiToolUse name="selain" state={state === 'running' ? 'succeeded' : state} targetText={st.target}>
      <p className="rb-step-said">{st.said}</p>
    </PiToolUse>
  )};
};
/** The agent's request for a person, in the conversation where it was made. */
function SignInRequest({dir, again}: {dir: number; again?: boolean}) {
  const s = useStore();
  const open = again ? s.phase === 'asking' : s.phase === 'signin';
  const done = again ? (s.step > ASK || (s.phase !== 'asking' && s.step >= ASK)) : s.phase !== 'signin';
  const at = again ? '10.18' : '10.14';
  if (!open && done)
    return <p className="rb-request-done" data-testid={again ? 'request2-done' : 'request-done'}><Icon name="check" aria-hidden="true" />{again ? `Vahvistit Netvisorin uudelleen klo ${at}.` : `Kirjauduit Netvisoriin ja annoit selaimen agentille klo ${at}.`}</p>;
  const signed = signedIn();
  return (
    <section className="rb-request" data-testid={again ? 'request2' : 'request'} aria-label="Agentti tarvitsee sinua">
      <span className="rb-request-mark"><Globe /></span>
      <div className="rb-request-body">
        <h3>{again ? 'Netvisor pyytää vahvistuskoodia' : 'Kirjaudu Netvisoriin'}</h3>
        <p>{again
          ? 'Agentti on pysähtynyt kesken latauksen. Syötä tunnistussovelluksen koodi omassa selaimessasi, niin agentti jatkaa siitä.'
          : 'Agentti käyttää palvelimella olevaa omaa selaintasi. Kirjaudu siinä itse; agentti ei näe salasanaasi eikä koodiasi.'}</p>
        <div className="rb-request-actions">
          {dir === D1 && s.open ? (signed ? <ControlAction dir={dir} /> : <span className="rb-request-where">Selain on auki oikealla.</span>)
            : dir === D2 && s.open ? null
              : <ControlButton data-testid="request-open" size="row" variant="primary" onPress={openBrowser}><Globe /> {again ? 'Syötä koodi' : 'Avaa selain'}</ControlButton>}
        </div>
      </div>
    </section>
  );
}
/** Direction 3 only: the agent's work as a small live picture in the conversation. */
function LiveCard() {
  const s = useStore();
  if (s.phase !== 'working' && !(s.paused)) return null;
  return (
    <section className="rb-live" data-testid="live-card" aria-label="Agentti käyttää selaintasi">
      <button type="button" className="rb-live-pic" onClick={openBrowser} aria-label="Näytä selain isona"><BrowserScreen dir={D3} small /></button>
      <div className="rb-live-body">
        <DriverChip />
        <p className="rb-live-now" data-testid="now-line">{nowLine()}</p>
        {s.open ? null : (
          <div className="rb-request-actions">
            <ControlButton data-testid="live-watch" size="row" variant="quiet" onPress={openBrowser}>Näytä isona</ControlButton>
            <ControlAction dir={D3} />
          </div>
        )}
      </div>
    </section>
  );
}
/** Direction 2: the conversation names the browser and links to its view. */
function BrowserNote() {
  const s = useStore();
  if (s.phase === 'signin' || s.phase === 'asking') return null;
  return (
    <p className="rb-note" data-testid="browser-note">
      <Globe />
      <span>{s.phase === 'done' ? `Agentti käytti Netvisoria omassa selaimessasi klo 10.14–10.19 (${STEPS.length} tointa).` : s.paused ? 'Sinä ohjaat selainta. Agentti odottaa.' : 'Agentti käyttää omaa selaintasi.'}</span>
      <ControlButton data-testid="note-open" size="row" variant="quiet" onPress={openBrowser}>Avaa selain</ControlButton>
    </p>
  );
}
function timeline(dir: number) {
  const s = store;
  const ask = 'Hae Netvisorista lokakuun ostolaskut ja tee niistä yhteenveto kustannuspaikoittain.';
  const items: {id: string; kind: string; content: React.ReactNode}[] = [
    {id: 'u1', kind: 'user', content: <UserMessage sourceText={ask} onCopy={noop} time="10.11"><Markdown text={ask} /></UserMessage>},
    {id: 'a1', kind: 'assistant', content: <AgentTurn startedAt={T0} duration="12 s" steps={[
      {kind: 'tool', key: 't', at: T0 + 6000, node: <PiToolUse name="bash" state="succeeded" targetText="netvisor-api --check"><p className="rb-step-said">Ei rajapinta-avainta.</p></PiToolUse>},
      say('s', 'Netvisoriin ei ole sinulle rajapinta-avainta, joten haen laskut palvelimen selaimellasi. Kirjaudu siihen ensin.'),
    ]} />},
    {id: 'r1', kind: 'notice', content: <SignInRequest dir={dir} />},
  ];
  if (s.phase === 'signin') return items;
  const last = s.step;
  const shown = STEPS.map((_, i) => i).filter((i) => i <= last);
  const before = shown.filter((i) => i <= ASK);
  const after = shown.filter((i) => i > ASK);
  const working = s.phase === 'working' && !s.paused;
  const running = (i: number) => working && i === last;
  items.push({id: 'a2', kind: 'assistant', content: <AgentTurn key={`a2-${last >= ASK}`} startedAt={T0 + 3 * 60000}
    working={working && last <= ASK - 1} duration={last >= ASK ? '2 min 10 s' : undefined}
    steps={[...before.map((i) => browserStep(i, running(i) ? 'running' : 'succeeded')),
      ...(last >= ASK ? [say('q', 'Netvisor pyytää vahvistuskoodia uudelleen. En voi syöttää sitä puolestasi; jatkan, kun olet syöttänyt sen.')] : [])]} />});
  if (last >= ASK) items.push({id: 'r2', kind: 'notice', content: <SignInRequest dir={dir} again />});
  if (after.length || (s.phase === 'working' && last >= ASK))
    items.push({id: 'a3', kind: 'assistant', content: <AgentTurn key={`a3-${s.phase === 'done'}`} startedAt={T0 + 7 * 60000}
      working={working} duration={s.phase === 'done' ? '1 min 12 s' : undefined}
      steps={[...after.map((i) => browserStep(i, running(i) ? 'running' : 'succeeded')), ...(s.phase === 'done' ? [say('d', SUMMARY)] : [])]} />});
  if (s.paused) items.push({id: 'p', kind: 'notice', content: <p className="rb-request-done" data-testid="paused-line"><Icon name="user" aria-hidden="true" />Otit selaimen klo {s.took}. Agentti odottaa, kunnes annat sen takaisin.</p>});
  if (dir === D3) items.push({id: 'live', kind: 'notice', content: <LiveCard />});
  if (dir === D2) items.push({id: 'note', kind: 'notice', content: <BrowserNote />});
  return items;
}

// ---------- Direction 1: beside the conversation, like the editor ----------

function useSidePane() {
  const s = useStore();
  const [expanded, setExpanded] = useState(false);
  return {
    expanded, setExpanded,
    panel: (
      <section className="ah-view-pane rb-pane" aria-label="Oma selain" data-testid="side-pane">
        <header className="ah-editor-header">
          <h2 className="ah-view-title">Oma selain</h2>
          <DriverChip />
          <span className="ah-editor-controls">
            <ControlButton size="row" variant="quiet" aria-label={expanded ? 'Rinnakkain' : 'Koko leveys'} aria-pressed={expanded} onPress={() => setExpanded(!expanded)}>
              <Icon name={expanded ? 'forward' : 'back'} />
            </ControlButton>
            <ControlButton data-testid="close-browser" size="row" variant="quiet" aria-label="Sulje selain" title="Sulje: selain jää palvelimelle kirjautuneena" onPress={closeBrowser}>
              <Icon name="cross" />
            </ControlButton>
          </span>
        </header>
        <div className="rb-pane-screen"><BrowserScreen dir={D1} /></div>
        <footer className="rb-bar">
          <p className="rb-bar-now" data-testid="now-line">{nowLine()}</p>
          <ControlAction dir={D1} />
        </footer>
      </section>
    ),
    open: s.open,
  };
}

// ---------- Direction 2: a view of its own ----------

function ActionLog() {
  const s = useStore();
  const done = STEPS.filter((_, i) => i <= s.step);
  const earlier = [
    {at: 'eilen 15.02', what: 'Avasi LinkedIn Recruiterin hakutulokset', conv: 'Rekrytointi: myyjä'},
    {at: 'eilen 14.57', what: 'Kirjautui LinkedIniin (sinä)', conv: ''},
  ];
  return (
    <aside className="rb-log" data-testid="action-log" aria-label="Agentin toimet">
      <h3>Agentin toimet selaimessa</h3>
      <p className="rb-log-lead">Kaikista keskusteluista, uusin ensin. Jokainen toimi on myös keskustelussa, josta se tehtiin.</p>
      <ol>
        {done.slice().reverse().map((st, i) => (
          <li key={i} data-testid="log-row"><time>{st.at}</time><span>{st.target}<small>{st.said}</small></span></li>
        ))}
        {s.phase !== 'signin' ? <li className="rb-log-you"><time>10.14</time><span>Kirjauduit Netvisoriin (sinä)</span></li> : null}
        {earlier.map((e) => <li key={e.at} className={e.conv ? undefined : 'rb-log-you'}><time>{e.at}</time><span>{e.what}{e.conv ? <small>Keskustelu: {e.conv}</small> : null}</span></li>)}
      </ol>
      {s.step >= 0 ? <p className="rb-log-conv">Netvisorin toimet: keskustelu <b>Lokakuun ostolaskut</b></p> : null}
    </aside>
  );
}
function BrowserView({onBack}: {onBack: () => void}) {
  const [tab, setTab] = useState<'screen' | 'log'>('screen');
  return (
    <section className="rb-view" data-testid="browser-view" aria-label="Oma selain">
      <header className="rb-view-head">
        <ControlButton data-testid="view-back" size="row" variant="quiet" onPress={onBack}><Icon name="back" /> Keskusteluun</ControlButton>
        <h2>Oma selain</h2>
        <DriverChip />
        <span className="rb-view-tabs">
          <Segmented<'screen' | 'log'> data-testid="view-tabs" label="Näytä" value={tab} onChange={setTab}
            options={[{id: 'screen', label: 'Selain'}, {id: 'log', label: 'Agentin toimet'}]} />
        </span>
      </header>
      <div className={`rb-view-body rb-tab-${tab}`}>
        <div className="rb-view-screen"><BrowserScreen dir={D2} />
          <footer className="rb-bar">
            <p className="rb-bar-now" data-testid="now-line">{nowLine()}</p>
            <ControlAction dir={D2} />
          </footer>
        </div>
        <ActionLog />
      </div>
    </section>
  );
}
function RailBrowserRow({onOpen, current}: {onOpen: () => void; current: boolean}) {
  const s = useStore();
  const state = s.driver === 'agent' ? 'Agentti käyttää' : s.phase === 'asking' ? 'Odottaa sinua' : signedIn() || s.phase !== 'signin' ? 'Netvisor · kirjautunut' : 'Ei kirjautunut';
  return (
    <section className="ah-now rb-rail-browser" aria-label="Oma selain">
      <button type="button" className={`rb-rail-row${current ? ' on' : ''}`} data-testid="rail-browser" aria-current={current ? 'page' : undefined} onClick={onOpen}>
        <span className="rb-rail-mark"><Globe /></span>
        <span className="rb-rail-text"><b>Oma selain</b><small data-testid="rail-browser-state">{state}</small></span>
      </button>
    </section>
  );
}

// ---------- Direction 3: a sheet opened from the conversation ----------

function BrowserSheet() {
  const s = useStore();
  return (
    <ModalOverlay className="ah-overlay rb-sheet-overlay" isOpen={s.open} isDismissable onOpenChange={(o) => { if (!o) closeBrowser(); }}>
      <Modal className="ah-modal rb-sheet">
        <AriaDialog className="rb-sheet-dialog" data-testid="browser-sheet" aria-label="Oma selain">
          <header className="rb-sheet-head">
            <Heading slot="title">Oma selain</Heading>
            <DriverChip />
            <ControlButton data-testid="close-browser" size="row" variant="quiet" aria-label="Sulje" onPress={closeBrowser}><Icon name="cross" /></ControlButton>
          </header>
          <div className="rb-sheet-screen"><BrowserScreen dir={D3} /></div>
          <footer className="rb-bar">
            <p className="rb-bar-now" data-testid="now-line">{nowLine()}</p>
            <ControlAction dir={D3} size="page" />
          </footer>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- The page ----------

function Main({direction}: {direction: number}) {
  const s = useStore();
  const title = 'Lokakuun ostolaskut';
  const now = Date.now();
  const side = direction === D1 ? useSidePane() : null;
  const viewOpen = direction === D2 && s.open;
  const busy = s.phase === 'working' && !s.paused;
  const convs = [{id: 'osto', title, since: 1}, {id: 'rekry', title: 'Rekrytointi: myyjä', since: 1200}];
  const model = (c: {id: string; title: string; since: number}): AgentNavModel => ({
    agentId: c.id, href: `/workspaces/ws_t?conversation=${c.id}`, title: c.title, workspaceId: 'ws_t', workspaceName: 'talous',
    changedAt: now - c.since * 60000, activity: c.id === 'osto' && busy ? 'working' : 'waiting',
    activityLabel: c.id === 'osto' && busy ? 'Työskentelee' : 'Odottaa viestiä', controlLabel: '',
    detail: 'talous', selected: c.id === 'osto' && !viewOpen,
  });
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Contoso" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Aino Virtanen" onSettings={noop} onLogout={noop} />}
      now={
        <>
          {direction === D2 ? <RailBrowserRow current={viewOpen} onOpen={openBrowser} /> : null}
          <section className="ah-now ah-quiet" aria-labelledby="rb-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded="true">
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="rb-quiet">Keskustelut</span><span className="ah-rail-count">{convs.length}</span>
              </button>
            </h2>
            <ul onClickCapture={(e) => { if (direction === D2) { e.preventDefault(); closeBrowser(); } }}>{convs.map((c) => <AgentNavItem key={c.id} {...model(c)} now={now} />)}</ul>
          </section>
        </>
      }>
      <WorkspaceNavRow name="talous" href="/workspaces/ws_t" />
      <WorkspaceNavRow name="rekrytointi" href="/workspaces/ws_r" />
    </WorkspaceRail>
  );
  const toggle = direction === D1 ? (
    <span className="ah-editor-controls">
      <ControlButton data-testid="toggle-browser" size="row" variant="quiet" className={`ah-editor-toggle rb-toggle${s.open ? ' ah-editor-toggle-on' : ''}`}
        aria-label={s.open ? 'Sulje selain' : 'Oma selain'} title={s.open ? 'Sulje selain' : 'Avaa oma selain keskustelun viereen'} aria-pressed={s.open}
        onPress={() => (s.open ? closeBrowser() : openBrowser())}>
        <Globe />{s.driver === 'agent' && s.phase === 'working' ? <span className="rb-toggle-dot" aria-hidden="true" /> : null}
      </ControlButton>
    </span>
  ) : undefined;
  const conversation = (
    <ConversationFrame>
      <AgentHeader title={title} workspaceLabel="talous" workspaceHref="/workspaces/ws_t"
        activityLabel={busy ? 'Käyttää selainta' : s.phase === 'asking' || s.phase === 'signin' ? 'Odottaa sinua' : ''} activityAnimated={busy}
        activityKind={busy ? 'working' : 'neutral'}
        controlLabel="" detailsExpanded={false} onToggleDetails={noop} editorControl={toggle} />
      <ConversationStream>
        <ConversationTimeline state="ready" items={timeline(direction)} historyMode="pagedAccessible" onJumpToLatest={noop} />
      </ConversationStream>
      <Composer value="" onChange={noop} activity={busy ? 'working' : 'idle'} selectedWorkingMode="steer"
        onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} sources={sources} csrf="prototype"
        modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
    </ConversationFrame>
  );
  const main = (
    <div className={`ah-state rb-main${viewOpen ? ' rb-main-view' : ''}`}>
      {side ? (
        <ViewSplit open={side.open} expanded={side.expanded} width={Math.min(760, Math.round(window.innerWidth * 0.5))} min={420} max={1000}
          panel={side.panel} onResize={noop} onReset={noop} onShowConversation={() => side.setExpanded(false)}>
          {conversation}
        </ViewSplit>
      ) : viewOpen ? <BrowserView onBack={closeBrowser} /> : conversation}
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={viewOpen ? 'Oma selain' : title} rail={railView} main={main} />
      {direction === D3 ? <BrowserSheet /> : null}
      {s.toast ? <p className="rb-toast" role="status">{s.toast}</p> : null}
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
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
  return (
    <div className={`rb-review variant-${direction}`} data-direction={direction}>
      <header className="rb-reviewbar" ref={bar}>
        <strong>Oma palvelinselain · kierros 1</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="rb-reset" onClick={() => { resetStore(); setGeneration((g) => g + 1); }}>Alusta</button>
        <button type="button" data-testid="rb-closed" onClick={() => { resetStore(false); setGeneration((g) => g + 1); }}>Alusta suljettuna</button>
        <ol className="rb-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rb-stage">
        <PiModelsProvider key={generation} enabled>
          <MemoryRouter key={generation} initialEntries={['/workspaces/ws_t?conversation=osto']}>
            <Main key={generation} direction={direction} />
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
const variants = directions.map((_, direction) => () => { resetStore(); return <App key={direction} direction={direction} />; });
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
