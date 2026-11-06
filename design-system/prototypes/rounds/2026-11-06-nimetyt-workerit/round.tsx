import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {BackgroundStrip} from '../../../../web/src/components/BackgroundStrip';
import {ProcessCompletion, ProcessProvider} from '../../../../web/src/components/ProcessTray';
import {SpinoffContext, WorkerBrief, WorkerVoice} from '../../../../web/src/components/Spinoffs';
import type {Spinoff} from '../../../../web/src/app/spinoffs';
import type {ProcessEvent, ProcessRecord} from '../../../../web/src/app/processes';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {statusText} from '../../../../web/src/text/status';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const rail = liveText(statusText).rail;

// proto-named-workers. Jari 6.11.: a named support worker does its work,
// its messages come to the main conversation, it waits quietly, and the main
// agent or the person can send it the next message. The mechanism is being
// designed beside this round (design-named-workers); the page assumes only a
// worker that reports, waits idle and takes the next message. The axis is
// where a named worker lives in Habitat: A as a row in the Workers panel with
// its state and last message; B as its own small conversation under the
// parent in the rail; C inline in the parent conversation, with the composer
// able to address it. Today (Nyt) has one-shot runs only: the next request
// starts a new worker that reads everything again. Rail, header, timeline,
// messages, composer and today's Workers strip and wait completion are
// production components over a fetch stand-in. Everything is synthetic.
const directions = ['Nyt', 'A Rivit', 'B Omat keskustelut', 'C Keskustelussa'];
const LINES = [
  'Nyt: kertaworkerit. Kierroksen 2 worker laskeutui ja poistui; seuraava pyyntö käynnistää uuden workerin, joka lukee kaiken alusta.',
  'A Rivit: nimetty worker on rivi Workerit-paneelissa: tila, viimeisin viesti, Kirjoita ja Lopeta ja yhdistä. Keskustelussa raportti on tiivis kortti.',
  'B Omat keskustelut: worker on oma pieni keskustelunsa sivupalkissa pääkeskustelun alla. Raportti on keskustelussa linkkinä, ja workerille kirjoitetaan sen omassa näkymässä.',
  'C Keskustelussa: workerin vastaukset tulevat kokonaisina pääkeskusteluun, ja kentän Kenelle-valinta lähettää viestin workerille.',
];
const NYT = 0, A = 1, B = 2, C = 3;

const WORKER = 'Prototyyppari: M365-asetus';
const SHORT = 'Prototyyppari';
const PARENT = 'Rupeama 6.11.';
const RIFF = 'riffaa A1:tä oikeilla kuvakaappauksilla';
const BRANCH = 'wt/prototyyppari-m365';

// ---- What the worker said: round 2 is delivered when the page opens ----
const BRIEF2 = 'Tee issueen `proto-m365-setup-flow` kierros 2: kolme riffiä suunnasta A Lista. Jarin havainnot mukaan: ainoa linkki on ensimmäisessä vaiheessa, rekisteröinnin jälkeen ei linkkejä, järjestys on Entran oma. Raportoi tänne, kun kierros on valmis.';
const REPORT2 = '**Kierros 2 valmis**: kolme riffiä A Listasta.\n\n- **A1 Valikkopala**: jokaisen vaiheen vieressä pala Entran sivua, valikkorivi korostettuna.\n- **A2 Valikon järjestyksessä**: yksi tarkistuslista Entran vasemman valikon järjestyksessä.\n- **A3 Olet nyt**: vaihe alkaa Entran sivun otsikosta.\n\nSuositus **A1**. Valikkopalat ovat piirroksia; oikeat kuvakaappaukset tarvitsisivat testitenantin. 24 kuvaa, kierros `rounds/2026-11-06-m365-riffi`.';
const REPORT2_LINE = 'Kierros 2 valmis: kolme riffiä A Listasta. Suositus A1.';
const REPORT3 = '**Kierros 3 valmis**: A1 oikeilla kuvakaappauksilla.\n\n- Valikkopalat ovat nyt rajattuja kuvakaappauksia testitenantin Entrasta: *App registrations*, *Authentication (Preview)* ja *API permissions*. Korostus on piirretty kuvan päälle.\n- Tenantin nimi ja tunnisteet on peitetty.\n- Tummassa teemassa samat kuvat himmennettyinä.\n\n12 uutta kuvaa. Kysymys: peitetäänkö myös sovelluksen nimi *Open Habitat (testi)*?';
const REPORT3_LINE = 'Kierros 3 valmis: A1 oikeilla kuvakaappauksilla. Kysyy, peitetäänkö sovelluksen nimi.';

// ---- One store for the round: the worker's phase and both conversations ----
// waiting: delivered and idle; working: took a message; merging/merged: the
// person stopped it and its branch is being merged.
type Phase = 'waiting' | 'working' | 'merging' | 'merged';
type Who = 'parent' | 'person' | 'worker';
/** A line in the worker's own exchange. */
type WMsg = {id: string; from: Who; text: string; time: string};
/** A line in the parent conversation. */
type PEvent =
  | {id: string; kind: 'user' | 'agent'; text: string; time: string}
  | {id: string; kind: 'toworker'; by: 'parent' | 'person'; text: string; time: string}
  | {id: string; kind: 'report'; round: number; text: string; line: string; time: string}
  | {id: string; kind: 'stopped'; time: string}
  | {id: string; kind: 'completion'; round: number; time: string};

const host = {
  direction: 0, phase: 'waiting' as Phase, round: 2, clock: 0,
  events: [] as PEvent[], log: [] as WMsg[], timers: [] as number[],
  /** Today: the one-shot run of the current round, absent once merged away. */
  run: null as Spinoff | null,
  parentWorking: false,
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
let seq = 0;
const nid = () => `e${++seq}`;
const TIMES = ['10.05', '10.31', '10.32', '10.40', '10.41', '10.50'];
const tick = () => TIMES[Math.min(host.clock++, TIMES.length - 1)];

function resetHost(direction = host.direction) {
  host.timers.forEach((t) => clearTimeout(t));
  host.timers = [];
  host.direction = direction; host.phase = direction === NYT ? 'merged' : 'waiting'; host.round = 2; host.clock = 0;
  host.parentWorking = false; host.run = null;
  const named = direction !== NYT;
  host.events = [
    {id: 'p1', kind: 'user', time: '9.12', text: 'Tee M365-asetuksesta kierros 2: kolme riffiä A Listasta, havaintoni mukaan. Anna se prototypparille.'},
    {id: 'p2', kind: 'agent', time: '9.13', text: named
      ? `Annoin kierroksen nimetylle workerille **${WORKER}**. Se raportoi tänne, kun kierros on valmis, ja jää sitten odottamaan.`
      : 'Käynnistin workerin **proto-m365-setup-flow: kierros 2** ja odotan, että se valmistuu.'},
    ...(named ? [{id: 'p3', kind: 'toworker' as const, by: 'parent' as const, time: '9.13', text: BRIEF2}] : []),
    named ? {id: 'p4', kind: 'report', round: 2, text: REPORT2, line: REPORT2_LINE, time: '9.41'} : {id: 'p4', kind: 'completion', round: 2, time: '9.41'},
    {id: 'p5', kind: 'agent', time: '9.42', text: named
      ? `${SHORT} toimitti kierroksen 2. Se suosittelee A1:tä ja huomauttaa, että valikkopalat ovat piirroksia. ${SHORT} odottaa; voit kirjoittaa sille suoraan tai pyytää minua.`
      : 'Kierros 2 on valmis ja laskeutui main-haaraan: A1 Valikkopala, A2 Valikon järjestyksessä ja A3 Olet nyt. Worker suosittelee A1:tä. Valikkopalat ovat piirroksia.'},
  ];
  host.log = [
    {id: 'w1', from: 'parent', time: '9.13', text: BRIEF2},
    {id: 'w2', from: 'worker', time: '9.41', text: REPORT2},
  ];
}
resetHost(0);
function useHost() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const later = (ms: number, f: () => void) => { host.timers.push(window.setTimeout(() => { f(); notify(); }, ms)); };
const WORK_MS = 2600, MERGE_MS = 1200;

/** The worker takes a message, from the person directly or through the main agent. */
function sendToWorker(text: string, by: 'parent' | 'person') {
  if (host.phase !== 'waiting' || !text.trim()) return;
  const time = tick();
  if (by === 'parent') {
    host.events.push({id: nid(), kind: 'user', time, text});
    host.events.push({id: nid(), kind: 'agent', time, text: `Välitän tämän ${SHORT.toLowerCase()}lle.`});
  }
  host.events.push({id: nid(), kind: 'toworker', by, time, text});
  host.log.push({id: nid(), from: by, time, text});
  host.phase = 'working';
  notify();
  later(WORK_MS, () => {
    const t = tick();
    host.round = 3;
    host.events.push({id: nid(), kind: 'report', round: 3, text: REPORT3, line: REPORT3_LINE, time: t});
    host.log.push({id: nid(), from: 'worker', time: t, text: REPORT3});
    host.phase = 'waiting';
    host.parentWorking = true;
    later(700, () => {
      host.parentWorking = false;
      host.events.push({id: nid(), kind: 'agent', time: tick(), text: `${SHORT} toimitti kierroksen 3: A1 nyt oikeilla Entran kuvakaappauksilla. Sen kysymys sinulle: peitetäänkö sovelluksen nimi *Open Habitat (testi)*? ${SHORT} odottaa. Kun kierros on hyväksytty, lopeta se, niin sen työ yhdistetään.`});
    });
  });
}

/** Today: the main agent starts a new one-shot worker for the next round. */
function sendToday(text: string) {
  if (host.phase === 'working' || !text.trim()) return;
  host.events.push({id: nid(), kind: 'user', time: tick(), text});
  host.events.push({id: nid(), kind: 'agent', time: host.events.at(-1)!.time, text: 'Kierroksen 2 worker on jo poistunut, joten käynnistän uuden workerin **proto-m365-setup-flow: kierros 3**. Se lukee issuen, kierrokset 1–2 ja niiden muistiinpanot alusta ennen kuin aloittaa. Odotan sitä.'});
  host.run = run('working');
  host.phase = 'working';
  notify();
  later(WORK_MS, () => {
    host.run = null; // merged; its branch and worktree are gone
    host.round = 3;
    host.events.push({id: nid(), kind: 'completion', round: 3, time: tick()});
    host.events.push({id: nid(), kind: 'agent', time: tick(), text: 'Kierros 3 on valmis ja laskeutui main-haaraan: A1 käyttää nyt rajattuja kuvakaappauksia testitenantin Entrasta, tunnisteet peitettyinä. Worker kysyy, peitetäänkö myös sovelluksen nimi *Open Habitat (testi)*. Worker on poistunut; seuraava kierros alkaa taas uudella workerilla.'});
    host.phase = 'merged';
  });
}

function stopWorker() {
  if (host.phase !== 'waiting') return;
  host.phase = 'merging';
  notify();
  later(MERGE_MS, () => {
    host.phase = 'merged';
    host.events.push({id: nid(), kind: 'stopped', time: tick()});
  });
}

// ---- Today's host facts for the production strip and completion ----
const RUN_ID = '01m6r1q934veb852ke10x2r3aa';
const PARENT_ID = 'pi:0b5c6a62-6f2e-4f43-9d55-3f6c1b7e2a10';
const run = (state: Spinoff['state']): Spinoff => ({
  run_id: RUN_ID, title: 'proto-m365-setup-flow: kierros 3', created_at: new Date(Date.now() - 2 * 60000).toISOString(), state,
  preserved: false, branch: 'wt/proto-m365-r3', worktree: '/home/maintainer/src/open-habitat__worktrees/wt-proto-m365-r3',
  source_branch: 'main', summary: '', harness: 'claude', profile: 'prototype-opus',
});
const waitProcess = (): ProcessRecord => ({
  id: 'proc_wait', name: 'odota kierros 3', command_preview: `taskfleet run wait ${RUN_ID}`, process_token: 'pt_wait',
  status: 'running', started_at: Date.now() - 2 * 60000, ended_at: null, exit_code: null, signal: null, end_reason: null,
  wakes_agent: true, run_ids: [RUN_ID],
});
const completion = (round: number): ProcessEvent => ({
  kind: 'success', process_id: `proc_wait_${round}`, process_name: `odota kierros ${round}`,
  command_preview: `taskfleet run wait ${RUN_ID}`, exit_code: 0, signal: null, end_reason: 'exited', delivery: 'wake',
  run_ids: [RUN_ID], summary: `Kierros ${round} valmis.`,
  spinoff: [{run_id: RUN_ID, title: `proto-m365-setup-flow: kierros ${round}`, status: 'done', landed: true, commit: round === 2 ? '2b511e17a1' : '7c3e90d4f2', state: 'merged'}],
});

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path.endsWith('/processes'))
    return json({schema_version: 1, owner_generation: 'og_proto', availability: 'available', unavailable_reason: null,
      processes: host.run ? [waitProcess()] : [], interrupted: []});
  return new Response('', {status: 404});
};

const noop = () => {};
const T0 = Date.UTC(2026, 10, 6, 9, 42);
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'open-habitat',
};
const picker = <button type="button" className="md-pill">Claude Opus 5.5 · high</button>;

// ---- The worker's state in words, one place for every direction ----
function stateOf(phase: Phase): {label: string; tone: 'info' | 'neutral' | 'success'; animated: boolean} {
  if (phase === 'working') return {label: 'Työskentelee', tone: 'info', animated: true};
  if (phase === 'merging') return {label: 'Yhdistetään työtä…', tone: 'info', animated: true};
  if (phase === 'merged') return {label: 'Lopetettu · työ yhdistetty', tone: 'success', animated: false};
  return {label: 'Odottaa viestiä', tone: 'neutral', animated: false};
}
function WorkerState({phase}: {phase: Phase}) {
  const s = stateOf(phase);
  return <StatusMark label={s.label} tone={s.tone} animated={s.animated ? 'running' : false} />;
}
const fromWord = (w: Who) => (w === 'person' ? 'Sinä' : w === 'parent' ? 'Pääagentti' : SHORT);
const firstLine = (t: string) => t.replace(/\*\*|`|\*/g, '').split('\n')[0];

/** Stop and merge, the same action in every direction; refused while it works. */
function StopButton({phase, size = 'row', testId = 'stop-worker'}: {phase: Phase; size?: 'row' | 'inline'; testId?: string}) {
  if (phase === 'merged') return null;
  return (
    <ControlButton data-testid={testId} size={size} variant="secondary" onPress={stopWorker}
      availability={phase === 'waiting' ? undefined : {state: 'disabled', reason: phase === 'working' ? `${SHORT} työskentelee. Lopeta, kun se on raportoinut.` : 'Työtä yhdistetään.'}}>
      <Icon name="merge" />Lopeta ja yhdistä
    </ControlButton>
  );
}

/** A small form that writes to the worker directly (A's row, C has the composer). */
function WriteToWorker({onDone}: {onDone: () => void}) {
  const [text, setText] = useState('');
  const send = () => { if (!text.trim()) return; sendToWorker(text, 'person'); setText(''); onDone(); };
  return (
    <form className="ww-write" data-testid="worker-write" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <label className="ww-write-label" htmlFor="ww-write-input">Viesti workerille {SHORT}</label>
      <textarea id="ww-write-input" data-testid="worker-write-input" rows={2} value={text} placeholder={`Viesti ${SHORT.toLowerCase()}lle…`}
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
      <div className="ww-write-actions">
        <ControlButton data-testid="worker-write-send" size="row" variant="primary" type="submit">Lähetä workerille</ControlButton>
        <ControlButton size="row" variant="quiet" onPress={onDone}>Peruuta</ControlButton>
      </div>
      <p className="ww-hint">Pääagentti näkee viestin ja workerin vastauksen tässä keskustelussa.</p>
    </form>
  );
}

// ---- A: the Workers panel with the named worker as a row ----
function WorkersPanelA() {
  const h = useHost();
  const [open, setOpen] = useState(true);
  const [writing, setWriting] = useState(false);
  const [messages, setMessages] = useState(false);
  const last = h.log.at(-1)!;
  const lastLine = h.phase === 'working'
    ? <>Sai {last.time} {fromWord(last.from).toLowerCase() === 'sinä' ? 'sinulta' : 'pääagentilta'}: <q>{firstLine(last.text)}</q></>
    : h.phase === 'merged'
      ? <>Haara <code>{BRANCH}</code> yhdistetty main-haaraan · 5 committia</>
      : <>{last.time}: {firstLine(last.text)}</>;
  return (
    <section className={`ww-panel${open ? ' open' : ''}`} data-testid="workers-panel" aria-label="Workerit">
      <button type="button" className="ww-panel-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="branch" />
        <strong>Workerit</strong>
        <span className="ww-panel-sum">{h.phase === 'merged' ? 'ei nimettyjä' : `1 nimetty · ${stateOf(h.phase).label.toLowerCase()}`}</span>
        <Icon name="down" className="ww-chevron" />
      </button>
      {open ? (
        <div className="ww-panel-body">
          <div className={`ww-row${h.phase === 'merged' ? ' ended' : ''}`} data-testid="worker-row" data-phase={h.phase}>
            <div className="ww-row-main">
              <span className="ww-row-name"><Icon name="agent" /><strong>{WORKER}</strong></span>
              <WorkerState phase={h.phase} />
            </div>
            <p className="ww-row-last" data-testid="worker-last">{lastLine}</p>
            {h.phase !== 'merged' ? (
              <div className="ww-row-actions">
                <ControlButton data-testid="worker-write-open" size="row" variant="secondary" onPress={() => setWriting(!writing)}
                  availability={h.phase === 'waiting' ? undefined : {state: 'disabled', reason: `${SHORT} työskentelee. Kirjoita, kun se odottaa.`}}>
                  <Icon name="message" />Kirjoita
                </ControlButton>
                <ControlButton data-testid="worker-messages" size="row" variant="quiet" aria-expanded={messages} onPress={() => setMessages(!messages)}>
                  {messages ? 'Piilota viestit' : `Viestit (${h.log.length})`}
                </ControlButton>
                <StopButton phase={h.phase} />
              </div>
            ) : null}
            {writing && h.phase === 'waiting' ? <WriteToWorker onDone={() => setWriting(false)} /> : null}
            {messages ? (
              <ol className="ww-exchange" data-testid="worker-exchange">
                {h.log.map((m) => (
                  <li key={m.id}><span className="ww-ex-who">{fromWord(m.from)} · {m.time}</span><span className="ww-ex-text">{firstLine(m.text)}</span></li>
                ))}
              </ol>
            ) : null}
          </div>
          <p className="ww-panel-note">Kertaworkerit: ei työskentele.</p>
        </div>
      ) : null}
    </section>
  );
}

// ---- Parent conversation lines, drawn per direction ----
type Item = {id: string; kind: 'user' | 'assistant' | 'system'; content: React.ReactNode};
const userItem = (id: string, text: string, time: string): Item => ({id, kind: 'user', content: <UserMessage sourceText={text} onCopy={noop} time={time}><Markdown text={text} /></UserMessage>});
const agentItem = (id: string, text: string, time: string, state: 'complete' | 'streaming' = 'complete'): Item =>
  ({id, kind: 'assistant', content: <AssistantMessage streamState={state} time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>});

/** A: the report as a compact card; the panel row carries the rest. */
function ReportCardA({e}: {e: Extract<PEvent, {kind: 'report'}>}) {
  const [open, setOpen] = useState(false);
  return (
    <aside className="ww-card" data-testid={`report-${e.round}`} aria-label={`${WORKER}: raportti`}>
      <header>
        <Icon name="agent" />
        <strong>{WORKER}</strong><span className="ww-card-what">raportoi</span>
        <time>{e.time}</time>
      </header>
      {open ? <div className="ah-prose"><Markdown text={e.text} /></div> : <p className="ww-card-line">{e.line}</p>}
      <ControlButton data-testid={`report-toggle-${e.round}`} size="inline" variant="quiet" aria-expanded={open} onPress={() => setOpen(!open)}>
        {open ? 'Piilota raportti' : 'Näytä raportti'}
      </ControlButton>
    </aside>
  );
}

/** A and B: a sent message as one quiet line. */
function SentLine({e, onOpen}: {e: Extract<PEvent, {kind: 'toworker'}>; onOpen?: () => void}) {
  return (
    <p className="ww-sent" data-testid="sent-line" data-by={e.by}>
      <Icon name="message" />
      <span><strong>{e.by === 'person' ? 'Sinä' : 'Pääagentti'} → {SHORT}</strong> <span className="ww-sent-text">{firstLine(e.text)}</span></span>
      {onOpen ? <button type="button" className="ww-link" onClick={onOpen}>Avaa</button> : null}
      <time>{e.time}</time>
    </p>
  );
}

/** B: the report as a link to the worker's own conversation. */
function ReportLinkB({e, onOpen}: {e: Extract<PEvent, {kind: 'report'}>; onOpen: () => void}) {
  return (
    <aside className="ww-card ww-card-link" data-testid={`report-${e.round}`} aria-label={`${WORKER}: raportti`}>
      <header>
        <Icon name="agent" />
        <strong>{WORKER}</strong><span className="ww-card-what">vastasi omassa keskustelussaan</span>
        <time>{e.time}</time>
      </header>
      <p className="ww-card-line">{e.line}</p>
      <ControlButton data-testid={`report-open-${e.round}`} size="row" variant="secondary" onPress={onOpen}>Avaa {SHORT.toLowerCase()}n keskustelu</ControlButton>
    </aside>
  );
}

/** C: the worker's reply, whole, in the parent conversation. */
function WorkerMessageC({e, last, onReply}: {e: Extract<PEvent, {kind: 'report'}>; last: boolean; onReply: () => void}) {
  const h = useHost();
  return (
    <article className="ww-voice" data-testid={`report-${e.round}`} aria-label={`${WORKER}: vastaus`}>
      <header>
        <Icon name="agent" />
        <strong>{WORKER}</strong>
        <time>{e.time}</time>
      </header>
      <div className="ah-prose"><Markdown text={e.text} /></div>
      {last && h.phase !== 'merged' ? (
        <div className="ww-voice-actions">
          <ControlButton data-testid="reply-worker" size="row" variant="secondary" onPress={onReply}
            availability={h.phase === 'waiting' ? undefined : {state: 'disabled', reason: `${SHORT} työskentelee.`}}>
            <Icon name="message" />Vastaa {SHORT.toLowerCase()}lle
          </ControlButton>
          <StopButton phase={h.phase} />
        </div>
      ) : null}
    </article>
  );
}
/** C: a message to the worker in the parent, as the person's or the main agent's bubble. */
function ToWorkerC({e}: {e: Extract<PEvent, {kind: 'toworker'}>}) {
  return (
    <article className={`ww-to-msg${e.by === 'person' ? ' mine' : ''}`} data-testid="sent-line" data-by={e.by}>
      <header><strong>{e.by === 'person' ? 'Sinä' : 'Pääagentti'} → {WORKER}</strong><time>{e.time}</time></header>
      <div className="ah-prose"><Markdown text={e.text} /></div>
    </article>
  );
}

function StoppedLine() {
  return (
    <p className="ww-stopped" data-testid="stopped-line" role="note">
      <Icon name="merge" />
      <span><strong>{WORKER}</strong> lopetettu · haara <code>{BRANCH}</code> yhdistetty main-haaraan (5 committia), worktree poistettu.</span>
    </p>
  );
}

function parentItems(direction: number, onOpenWorker: () => void, onReplyC: () => void): Item[] {
  const lastReport = host.events.filter((e) => e.kind === 'report').at(-1)?.id;
  const items: Item[] = [];
  for (const e of host.events) {
    if (e.kind === 'user') items.push(userItem(e.id, e.text, e.time));
    else if (e.kind === 'agent') items.push(agentItem(e.id, e.text, e.time));
    else if (e.kind === 'completion') items.push({id: e.id, kind: 'system', content: <ProcessCompletion event={completion(e.round)} />});
    else if (e.kind === 'stopped') items.push({id: e.id, kind: 'system', content: <StoppedLine />});
    else if (e.kind === 'toworker') {
      // The main agent's first brief is long; A and B fold it to its first line.
      items.push({id: e.id, kind: 'system', content: direction === C ? <ToWorkerC e={e} /> : <SentLine e={e} onOpen={direction === B ? onOpenWorker : undefined} />});
    } else if (e.kind === 'report') {
      items.push({id: e.id, kind: 'system', content: direction === A ? <ReportCardA e={e} /> : direction === B ? <ReportLinkB e={e} onOpen={onOpenWorker} /> : <WorkerMessageC e={e} last={e.id === lastReport} onReply={onReplyC} />});
    }
  }
  if (host.parentWorking) items.push(agentItem('thinking', 'Luen raporttia…', '', 'streaming'));
  return items;
}

// ---- B: the worker's own conversation ----
function workerItems(): Item[] {
  return host.log.map((m, i) => {
    if (m.from === 'parent')
      return {id: m.id, kind: 'user', content: i === 0
        ? <WorkerBrief text={m.text} />
        : <WorkerVoice><UserMessage sourceText={m.text} onCopy={noop} time={m.time}><Markdown text={m.text} /></UserMessage></WorkerVoice>};
    if (m.from === 'person') return userItem(m.id, m.text, m.time);
    return {id: m.id, kind: 'assistant', content: <WorkerVoice><AssistantMessage streamState="complete" time={m.time} onCopy={noop}><Markdown text={m.text} /></AssistantMessage></WorkerVoice>};
  });
}

let reviewTheme = 'light';

function Main({direction}: {direction: number}) {
  const h = useHost();
  const location = useLocation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [workerDraft, setWorkerDraft] = useState('');
  const [to, setTo] = useState<'parent' | 'worker'>('parent');
  // The stream follows the newest line, as the production conversation does.
  const stream = useRef<HTMLElement>(null);
  const params = new URLSearchParams(location.search);
  const inWorker = direction === B && params.get('conversation') === 'worker';
  const openWorker = () => navigate('/workspaces/ws_o?conversation=worker');
  const openParent = () => navigate('/workspaces/ws_o?conversation=rupeama');
  const replyC = () => { setTo('worker'); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.ah-composer textarea')?.focus()); };
  // C: once the worker is gone, the composer talks to the main agent again.
  useEffect(() => { if (h.phase === 'merged') setTo('parent'); }, [h.phase]);

  const sendParent = (text: string) => {
    if (!text.trim()) return;
    setDraft('');
    if (direction === NYT) sendToday(text);
    else if (direction === C && to === 'worker') sendToWorker(text, 'person');
    else if (h.phase === 'waiting') sendToWorker(text, 'parent');
  };

  useLayoutEffect(() => {
    const el = stream.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  // ---- Rail ----
  const now = Date.now();
  const named = direction !== NYT && h.phase !== 'merged';
  const workerBusy = direction === NYT ? h.phase === 'working' : h.phase === 'working' || h.phase === 'merging';
  const parentModel: AgentNavModel = {
    agentId: 'rupeama', href: '/workspaces/ws_o?conversation=rupeama', title: PARENT, workspaceId: 'ws_o', workspaceName: 'open-habitat',
    changedAt: T0, activity: h.parentWorking ? 'working' : 'waiting', activityLabel: h.parentWorking ? rail.working : 'Odottaa viestiä', controlLabel: '',
    detail: ['open-habitat', h.parentWorking ? rail.working : 'Odottaa viestiä'].join(' · '),
    selected: !inWorker, spinoffWorking: workerBusy && direction !== B,
  };
  const s = stateOf(h.phase);
  const workerModel: AgentNavModel = {
    agentId: 'worker', href: '/workspaces/ws_o?conversation=worker', title: WORKER, workspaceId: 'ws_o', workspaceName: 'open-habitat',
    changedAt: T0, activity: h.phase === 'working' || h.phase === 'merging' ? 'working' : 'waiting', activityLabel: s.label, controlLabel: '',
    detail: s.label, selected: inWorker, depth: 1,
  };
  const quiet: AgentNavModel[] = [
    {agentId: 'q1', href: '/workspaces/ws_o?conversation=q1', title: 'SharePoint-sivuston tunniste', workspaceId: 'ws_o', workspaceName: 'open-habitat', changedAt: T0 - 50 * 60000, activity: 'waiting', activityLabel: 'Odottaa viestiä', controlLabel: '', detail: 'open-habitat · Odottaa viestiä'},
    {agentId: 'q2', href: '/workspaces/ws_h?conversation=q2', title: 'Fleet-päivitys', workspaceId: 'ws_h', workspaceName: 'fleetrepo', changedAt: T0 - 140 * 60000, activity: 'waiting', activityLabel: 'Odottaa viestiä', controlLabel: '', detail: 'fleetrepo · Odottaa viestiä'},
  ];
  const row = (m: AgentNavModel) => <AgentNavItem key={m.agentId} {...m} now={now} />;
  const running = workerBusy && direction !== B ? [parentModel] : [];
  const rest = workerBusy ? [] : [parentModel];
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Alder" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="ra-running">
            <h2 className="ah-rail-section-head" id="ra-running">Käynnissä{running.length || (direction === B && workerBusy) ? <span className="ah-rail-count">1</span> : null}</h2>
            {running.length ? <ul>{running.map(row)}</ul> : null}
            {direction === B && workerBusy ? <ul>{row({...parentModel, spinoffWorking: false})}{row(workerModel)}</ul> : null}
            {!running.length && !(direction === B && workerBusy) ? <p className="ah-now-empty">Mikään ei ole käynnissä.</p> : null}
          </section>
          <section className="ah-now ah-quiet" data-testid="rail-quiet" aria-labelledby="ra-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded="true">
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="ra-quiet">Hiljaiset</span><span className="ah-rail-count">{quiet.length + (direction === B && workerBusy ? 0 : rest.length)}</span>
              </button>
            </h2>
            <ul data-testid="rail-quiet-list">
              {direction === B && !workerBusy ? <>{rest.map(row)}{named ? row(workerModel) : null}</> : rest.map(row)}
              {quiet.map(row)}
            </ul>
          </section>
        </>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_h" />
      <WorkspaceNavRow name="open-habitat" href="/workspaces/ws_o" />
    </WorkspaceRail>
  );

  // ---- Main ----
  let main: React.ReactNode;
  if (inWorker) {
    const merged = h.phase === 'merged';
    main = (
      <div className="ah-state ww-main">
        <ConversationFrame>
          <AgentHeader title={WORKER} workspaceLabel="open-habitat" workspaceHref="/workspaces/ws_o"
            activityLabel={s.label} activityAnimated={s.animated} activityKind={h.phase === 'working' || h.phase === 'merging' ? 'working' : merged ? 'success' : 'neutral'}
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          <nav className="ww-band" data-testid="worker-band" aria-label="Pääkeskustelu">
            <Icon name="back" />
            <span>Nimetty worker keskustelussa</span>
            <button type="button" className="ww-link" data-testid="back-to-parent" onClick={openParent}>{PARENT}</button>
            <span className="ww-band-note">Viestisi näkyvät myös pääagentille.</span>
            <StopButton phase={h.phase} />
          </nav>
          <ConversationStream streamRef={stream}>
            <ConversationTimeline key={`w-${h.log.length}`} state="ready" items={workerItems().map((i) => ({...i, kind: i.kind === 'system' ? 'assistant' : i.kind}))} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
            {h.phase === 'working' ? <div className="ww-working"><StatusMark label={`${SHORT} työskentelee`} tone="info" animated="running" /></div> : null}
            {merged ? <StoppedLine /> : null}
          </ConversationStream>
          <Composer value={workerDraft} onChange={setWorkerDraft} activity={h.phase === 'working' ? 'working' : 'idle'} selectedWorkingMode="steer"
            idlePlaceholder={`Viesti ${SHORT.toLowerCase()}lle…`}
            availability={merged ? {state: 'disabled', reason: 'Worker on lopetettu, ja sen työ on yhdistetty.'} : h.phase === 'merging' ? {state: 'disabled', reason: 'Työtä yhdistetään.'} : undefined}
            onModeChange={noop} onSendNow={(t) => { sendToWorker(t ?? workerDraft, 'person'); setWorkerDraft(''); }} onSteer={noop} onFollowUp={noop}
            onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={picker} />
        </ConversationFrame>
      </div>
    );
  } else {
    const items = parentItems(direction, openWorker, replyC);
    const toWorker = direction === C && to === 'worker' && h.phase !== 'merged';
    const placeholder = toWorker ? `Viesti ${SHORT.toLowerCase()}lle…` : direction === NYT || h.phase === 'merged' ? undefined : `Viesti pääagentille, tai pyydä sitä kirjoittamaan ${SHORT.toLowerCase()}lle…`;
    const strip = direction === NYT ? (
      <SpinoffContext.Provider value={{data: {schema_version: 1, parent_id: PARENT_ID, availability: 'available', runs: h.run ? [h.run] : [], transcripts: []}, open: noop}}>
        <BackgroundStrip agentIdle={h.phase === 'working'} />
      </SpinoffContext.Provider>
    ) : null;
    main = (
      <div className="ah-state ww-main">
        <ConversationFrame>
          <AgentHeader title={PARENT} workspaceLabel="open-habitat" workspaceHref="/workspaces/ws_o"
            activityLabel={h.parentWorking ? rail.working : direction === NYT && h.phase === 'working' ? rail.background : 'Odottaa viestiä'}
            activityAnimated={h.parentWorking} activityKind={h.parentWorking ? 'working' : 'neutral'}
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          {direction === C ? (
            <div className="ww-chips" data-testid="worker-chips" aria-label="Nimetyt workerit">
              <span className="ww-chips-label">Workerit</span>
              {h.phase === 'merged' ? <span className="ww-chip ended">{WORKER} · lopetettu</span> : (
                <span className="ww-chip"><Icon name="agent" />{WORKER} · <WorkerState phase={h.phase} /></span>
              )}
            </div>
          ) : null}
          <ConversationStream streamRef={stream}>
            <ConversationTimeline key={`p-${direction}`} state="ready" items={items.map((i) => ({...i, kind: i.kind === 'system' ? 'assistant' : i.kind}))} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
            {direction !== NYT && h.phase === 'working' ? (
              <div className="ww-working" data-testid="worker-working"><StatusMark label={`${WORKER} työskentelee`} tone="info" animated="running" /></div>
            ) : null}
            {direction !== NYT && h.phase === 'merging' ? <div className="ww-working"><StatusMark label="Yhdistetään workerin työtä…" tone="info" animated="running" /></div> : null}
          </ConversationStream>
          {direction === A ? <div className="ww-dock"><WorkersPanelA /></div> : null}
          {strip}
          {direction === C && h.phase !== 'merged' ? (
            <div className="ww-dock"><div className="ww-to" role="radiogroup" aria-label="Kenelle" data-testid="recipient">
              <span className="ww-to-label">Kenelle</span>
              {(['parent', 'worker'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={to === k} data-testid={`to-${k}`} className="ww-to-opt" onClick={() => setTo(k)}>
                  {k === 'parent' ? 'Pääagentti' : <>{SHORT}<span className="ww-to-state"> · {stateOf(h.phase).label.toLowerCase()}</span></>}
                </button>
              ))}
            </div></div>
          ) : null}
          <Composer value={draft} onChange={setDraft} activity={h.parentWorking ? 'working' : 'idle'} selectedWorkingMode="steer"
            idlePlaceholder={placeholder}
            availability={toWorker && h.phase !== 'waiting' ? {state: 'disabled', reason: `${SHORT} työskentelee. Kirjoita, kun se odottaa.`}
              : direction === NYT && h.phase === 'working' ? undefined : undefined}
            onModeChange={noop} onSendNow={(t) => sendParent(t ?? draft)} onSteer={noop} onFollowUp={noop}
            onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={picker} />
        </ConversationFrame>
      </div>
    );
  }
  const body = direction === NYT ? (
    <ProcessProvider key={`proc-${h.run ? 'run' : 'none'}`} id={PARENT_ID} csrf="prototype" onLogin={noop} onStatusEvent={() => noop}>{main}</ProcessProvider>
  ) : main;
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={inWorker ? WORKER : PARENT} navigationBadge={0} rail={railView} main={body} />
    </StatusBellProvider>
  );
}

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
  const restart = () => { resetHost(direction); setGeneration((g) => g + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Nimetyt workerit</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={restart}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_o?conversation=rupeama']}>
          <Main direction={direction} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
let pickedDirection = 0;
const stageSink = {set innerHTML(view: React.ReactNode) { resetHost(pickedDirection); flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => { pickedDirection = direction; resetHost(direction); return <App key={direction} direction={direction} />; });
const pickerNav = document.createElement('nav');
pickerNav.className = 'proto-picker'; pickerNav.setAttribute('aria-label', 'Prototype variants');
pickerNav.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  pickerNav.append(button);
});
document.body.append(pickerNav);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
