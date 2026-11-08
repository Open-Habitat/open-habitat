import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/WorkspacePage.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {ControlButton, LinkRow} from '../../../../web/src/components/ControlElements';
import {Button} from '../../../../web/src/components/Primitives';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {ProcessProvider} from '../../../../web/src/components/ProcessTray';
import {BackgroundStrip} from '../../../../web/src/components/BackgroundStrip';
import {SpinoffContext} from '../../../../web/src/components/Spinoffs';
import {ArchiveNotice} from '../../../../web/src/components/ArchiveNotice';
import {WorkerMark, type WorkerMarkKind} from '../../../../web/src/components/WorkerMark';
import {CopyButton} from '../../../../web/src/components/ViewLink';
import {helpersArchiveDetail} from '../../../../web/src/app/helpersArchive';
import type {Spinoff} from '../../../../web/src/app/spinoffs';
import type {TimelineItem} from '../../../../web/src/components/types';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-helper-archive-notice, round 1. Jari 8.11.2026 accepted the archive
// rule for named workers (named-workers-in-habitat): archiving merges
// nothing; finished rounds are already merged; an unfinished round stays on
// the helper's branch; archived helpers come back with the parent when it is
// restored, unstarted. This round shows how that is told. The axis is when
// and where the person learns it:
// Nyt: production: one long notice row after the fact, gone in 8 s;
// 1 Vahvistus: before: the archive press asks, listing the helpers and what
//   stays on a branch; after it, the ordinary short notice;
// 2 Ilmoitus: after: a short notice that stays while work waits on a branch,
//   with Avaa haara beside Palauta;
// 3 Arkistossa: where it is kept: the archive shows the helpers as rows of
//   their own under the conversation, and the notice points there.
const directions = ['Nyt', '1 Vahvistus', '2 Ilmoitus', '3 Arkistossa'];
const LINES = [
  'Nyt: tuotanto tänään. Arkistointi tapahtuu heti, ja yläpalkin ilmoitus kertoo yhdellä pitkällä rivillä avustajat ja keskeneräisen kierroksen; ilmoitus häviää 8 sekunnissa.',
  '1 Vahvistus: arkistointi kysyy ensin ja luettelee avustajat tiloineen ja sen, mikä jää haaraan; sen jälkeen tavallinen lyhyt ilmoitus.',
  '2 Ilmoitus: arkistointi tapahtuu heti; lyhyt ilmoitus pysyy, kunnes suljet sen, kun työtä on haarassa, ja siinä on Avaa haara ja Palauta.',
  '3 Arkistossa: arkisto näyttää avustajat keskustelun alla omina riveinään tiloineen; ilmoitus vie arkistoon, ja palautus kertoo keskustelussa, mitä sillä välin tapahtui.',
];

// ---- The story ----
const PARENT = 'Kotisivun uudistus';
const PARENT_ID = 'pi:4b1e7f20-9c3a-4d5e-8f61-2a7c9e0b3d11';
const WS = 'kotisivu';
const BRANCH = 'wt/katselmoija-saavutettavuus';
const minutesAgo = (n: number) => new Date(Date.now() - n * 60000).toISOString();
const helper = (id: string, name: string, title: string, state: Spinoff['state'], resident: Spinoff['resident'], branch: string): Spinoff => ({
  run_id: id, title, created_at: minutesAgo(180), state, preserved: false, branch, worktree: `/home/maintainer/src/kotisivu__worktrees/${branch.replace('wt/', 'wt-')}`,
  source_branch: 'main', summary: '', harness: 'claude', profile: 'prototype-opus', resident,
});
// Before archiving: Prototyyppari waits with all three rounds landed;
// Katselmoija is in the middle of its second round.
const PROTO = helper('01m6xq1proto0000000000000a', 'Prototyyppari', 'Etusivun suunnat', 'waiting_parent',
  {name: 'Prototyyppari', round_state: 'waiting', rounds: 3, landed_round: 3, report: 'Kierros 3 valmis: Hero-riffit oikeilla kuvilla. Suosittelen B:tä.', reported_at: minutesAgo(40)}, 'wt/prototyyppari-etusivu');
const REVIEW = helper('01m6xq1review000000000000a', 'Katselmoija', 'Saavutettavuuskatselmointi', 'working',
  {name: 'Katselmoija', round_state: 'working', rounds: 1, landed_round: 1, report: 'Kierros 1 valmis: 7 löydöstä, kontrastit ja otsikkojärjestys.', reported_at: minutesAgo(90)}, BRANCH);
// After restoring: Katselmoija finished round 2 meanwhile; nobody landed it.
const REVIEW_AFTER: Spinoff = {...REVIEW, state: 'waiting_parent',
  resident: {name: 'Katselmoija', round_state: 'waiting', rounds: 2, landed_round: 1, unlanded: true, report: 'Kierros 2 valmis: korjasin kontrastit ja otsikot haarassa; 12 tiedostoa.', reported_at: minutesAgo(2)}};
const BEFORE = [PROTO, REVIEW];
const AFTER = [PROTO, REVIEW_AFTER];

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path.endsWith('/processes'))
    return new Response(JSON.stringify({schema_version: 1, owner_generation: 'og', availability: 'available', unavailable_reason: null, processes: [], interrupted: []}), {headers: {'content-type': 'application/json'}});
  return new Response('', {status: 404});
};

// ---- What each helper's row says: Pallot mark, name · task, where it stands ----
type HelperFact = {run: Spinoff; mark: WorkerMarkKind; line: string; branch?: boolean};
function facts(runs: Spinoff[], restored = false): HelperFact[] {
  return runs.map((r) => {
    const res = r.resident!;
    if (res.round_state === 'working')
      return {run: r, mark: 'working', line: `kierros ${res.rounds + 1} kesken · jää haaraan, ei yhdistetä`, branch: true};
    if (res.unlanded)
      return {run: r, mark: restored ? 'reported' : 'waiting_parent', line: `kierros ${res.rounds} raportoitu · ei yhdistetty, haarassa`, branch: true};
    return {run: r, mark: 'waiting_parent', line: `odottaa · ${res.rounds} kierrosta, kaikki yhdistetty`};
  });
}
function HelperRow({f, testid = 'aa-helper-row'}: {f: HelperFact; testid?: string}) {
  return (
    <li className="aa-helper" data-testid={testid} data-branch={f.branch || undefined}>
      <span className="aa-helper-mark"><WorkerMark kind={f.mark} /></span>
      <span className="aa-helper-lines">
        <span className="aa-helper-name"><b>{f.run.resident!.name}</b><span> · {f.run.title}</span></span>
        <span className="aa-helper-line">
          {f.branch ? <Icon name="branch" /> : <Icon name="check" />}
          <span>{f.line}</span>
          {f.branch ? <code>{f.run.branch}</code> : null}
        </span>
      </span>
    </li>
  );
}

/** A dialog over the main column, as the app's own: Esc or the scrim closes. */
function Popup({label, testid, onClose, children}: {label: string; testid: string; onClose: () => void; children: React.ReactNode}) {
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    box.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="aa-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="aa-dialog" data-testid={testid}>{children}</section>
    </div>
  );
}

function Confirm({onArchive, onCancel}: {onArchive: () => void; onCancel: () => void}) {
  return (
    <Popup label={`Arkistoi ${PARENT}`} testid="aa-confirm" onClose={onCancel}>
      <h2 className="aa-dialog-title"><Icon name="archive" /> Arkistoi <b>{PARENT}</b></h2>
      <p className="aa-dialog-lead">Avustajat arkistoidaan keskustelun mukana:</p>
      <ul className="aa-helpers">{facts(BEFORE).map((f) => <HelperRow key={f.run.run_id} f={f} />)}</ul>
      <p className="aa-dialog-note"><Icon name="info" /> Arkistointi ei yhdistä mitään. Kun palautat keskustelun, avustajat palaavat sen mukana käynnistämättä.</p>
      <div className="aa-dialog-actions">
        <ControlButton size="row" variant="quiet" data-testid="aa-cancel" onPress={onCancel}>Peruuta</ControlButton>
        <ControlButton size="row" variant="primary" data-testid="aa-confirm-archive" autoFocus onPress={onArchive}>Arkistoi</ControlButton>
      </div>
    </Popup>
  );
}

function BranchSheet({after, onClose}: {after: boolean; onClose: () => void}) {
  const r = after ? REVIEW_AFTER : REVIEW;
  return (
    <Popup label="Avustajan haara" testid="aa-branch" onClose={onClose}>
      <h2 className="aa-dialog-title"><Icon name="branch" /> Haara, jota ei ole yhdistetty</h2>
      <ul className="aa-helpers">{facts([r], after).map((f) => <HelperRow key={f.run.run_id} f={f} />)}</ul>
      <dl className="aa-branch-facts">
        <dt>Haara</dt><dd><code data-testid="aa-branch-name">{r.branch}</code> → <code>main</code></dd>
        <dt>Työpuu</dt><dd><code>{r.worktree}</code></dd>
        <dt>Muutokset</dt><dd>{after ? '12 tiedostoa · 3 committia' : 'kierros on vielä käynnissä'}</dd>
      </dl>
      <p className="aa-dialog-note"><Icon name="info" /> Haara säilyy. Yhdistäminen kulkee pääagentin kautta, kun palautat keskustelun.</p>
      <div className="aa-dialog-actions">
        <CopyButton text={r.branch} data-testid="aa-copy-branch" label="Kopioi haaran nimi" />
        <ControlButton size="row" variant="quiet" data-testid="aa-branch-close" onPress={onClose}>Sulje</ControlButton>
      </div>
    </Popup>
  );
}

// ---- The conversation ----
const noop = () => {};
const sources: ComposerSources = {commands: async () => ({commands: [], truncated: false}) as never, files: async () => ({files: [], truncated: false}), workspaceName: WS};
const picker = <button type="button" className="md-pill">Claude Opus 5.5 · high</button>;
const userItem = (id: string, text: string, time: string): TimelineItem & {kind: string} => ({id, kind: 'user', content: <UserMessage sourceText={text} onCopy={noop} time={time}><Markdown text={text} /></UserMessage>});
const agentItem = (id: string, text: string, time: string): TimelineItem & {kind: string} =>
  ({id, kind: 'assistant', content: <AssistantMessage streamState="complete" time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>});
const STORY = [
  userItem('u1', 'Etusivu uusiksi: Prototyyppari tekee suunnat, Katselmoija käy saavutettavuuden läpi samalla.', '11.02'),
  agentItem('a1', 'Käynnistin kaksi avustajaa: **Prototyyppari** (etusivun suunnat) ja **Katselmoija** (saavutettavuus). Kerron, kun kierrokset tulevat.', '11.04'),
  userItem('u2', 'B näyttää parhaalta. Pyydä Prototyyppariltä vielä riffi B:stä oikeilla kuvilla.', '12.20'),
  agentItem('a2', 'Prototyyppari raportoi kierroksen 3 ja yhdistin sen main-haaraan. Katselmoija tekee kierrosta 2: korjaa kontrastit ja otsikkojärjestyksen omassa haarassaan.', '13.05'),
  userItem('u3', 'Hyvä. Jatketaan huomenna, arkistoin tämän nyt.', '13.08'),
];

type Stage = 'conversation' | 'confirm' | 'workspace' | 'restored';
type Note = {kind: 'archived' | 'restored'; id: number};

function Main({direction, reset}: {direction: number; reset: number}) {
  const startArchived = direction !== 1;
  const [stage, setStage] = useState<Stage>(startArchived ? 'workspace' : 'confirm');
  const [note, setNote] = useState<Note | undefined>(startArchived ? {kind: 'archived', id: 1} : undefined);
  const [archiveOpen, setArchiveOpen] = useState(direction === 3);
  const [branch, setBranch] = useState(false);
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLElement>(null);
  const userClose = useRef(false);
  // The review bar's Alusta starts again from the conversation before archiving.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStage('conversation'); setNote(undefined); setArchiveOpen(false); setBranch(false);
  }, [reset]);
  useLayoutEffect(() => {
    const bottom = () => { const el = stream.current; if (el) el.scrollTop = el.scrollHeight; };
    bottom();
    const timers = [0, 80, 250].map((t) => window.setTimeout(bottom, t));
    return () => timers.forEach(clearTimeout);
  }, [stage]);
  // 2 Ilmoitus keeps its notice until the person closes it: only the close
  // button's own press ends it, not the notice's clock.
  useEffect(() => {
    const mark = (e: Event) => { if ((e.target as Element).closest?.('[data-testid="notice-close"]')) userClose.current = true; };
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('keydown', mark, true);
    return () => { document.removeEventListener('pointerdown', mark, true); document.removeEventListener('keydown', mark, true); };
  }, []);

  const archived = stage === 'workspace';
  const restored = stage === 'restored';
  const archive = () => {
    setStage('workspace'); setNote({kind: 'archived', id: Date.now()});
    if (direction === 3) setArchiveOpen(true);
  };
  const restore = () => {
    setBranch(false); setArchiveOpen(false); setStage('restored');
    setNote(direction === 0 || direction === 3 ? undefined : {kind: 'restored', id: Date.now()});
  };
  const closeNote = () => {
    if (direction === 2 && note?.kind === 'archived' && !userClose.current) return;
    userClose.current = false; setNote(undefined);
  };

  // ---- The notice row: production's ArchiveNotice with each direction's words ----
  let notice: React.ReactNode = null;
  if (note?.kind === 'archived') {
    const common = {kind: 'archive' as const, busy: false, title: PARENT, onRestore: restore, onClose: closeNote};
    if (direction === 0)
      notice = <ArchiveNotice key={note.id} {...common} detail={helpersArchiveDetail(BEFORE)} wrap />;
    else if (direction === 1)
      notice = <ArchiveNotice key={note.id} {...common} />;
    else if (direction === 2)
      notice = <ArchiveNotice key={note.id} {...common} wrap detail="2 avustajaa mukana · 1 kierros jää haaraan" link={{label: 'Avaa haara', onPress: () => setBranch(true)}} />;
    else
      notice = <ArchiveNotice key={note.id} {...common} wrap detail="2 avustajaa mukana" link={{label: 'Näytä arkistossa', onPress: () => {
        setArchiveOpen(true); requestAnimationFrame(() => document.querySelector('[data-testid="aa-archive"]')?.scrollIntoView({block: 'nearest'}));
      }}} />;
  } else if (note?.kind === 'restored') {
    const common = {kind: 'archive' as const, busy: false, title: PARENT, message: 'Palautettu', onClose: closeNote};
    notice = direction === 1
      ? <ArchiveNotice key={note.id} {...common} detail="avustajat palasivat odottamaan" />
      : <ArchiveNotice key={note.id} {...common} wrap detail="Katselmoija raportoi kierroksen 2 arkistoinnin aikana; työ on haarassa, ei yhdistetty" link={{label: 'Avaa haara', onPress: () => setBranch(true)}} />;
  }

  // ---- The conversation view, before archiving and after restoring ----
  const runs = restored ? AFTER : BEFORE;
  const items = [...STORY];
  if (restored && direction === 3)
    items.push({id: 'restored', kind: 'notice', content: (
      <aside className="aa-restored" data-testid="aa-restored" role="note">
        <p className="aa-restored-head"><Icon name="restore" /> <b>Palautettu arkistosta</b> · avustajat palasivat käynnistämättä</p>
        <ul className="aa-helpers">{facts(AFTER, true).map((f) => <HelperRow key={f.run.run_id} f={f} testid="aa-restored-row" />)}</ul>
      </aside>
    )});
  const archiveProps = {state: 'active' as const, eligible: true, busy: false, onArchive: () => (direction === 1 ? setStage('confirm') : archive()), onRestore: noop};
  const conversation = (
    <div className="ah-state aa-main">
      <ConversationFrame>
        <AgentHeader title={PARENT} workspaceLabel={WS} workspaceHref={`/workspaces/ws_${WS}`} activityLabel="Odottaa viestiä"
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} archive={archiveProps} />
        <ConversationStream streamRef={stream}>
          <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
        </ConversationStream>
        <SpinoffContext.Provider value={{data: {schema_version: 1, parent_id: PARENT_ID, availability: 'available', runs, transcripts: []}, open: noop,
          helpers: true, helpersSeen: new Map([[PROTO.run_id, 3], [REVIEW.run_id, 1]])}}>
          <BackgroundStrip agentIdle />
        </SpinoffContext.Provider>
        <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
          onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={picker} />
      </ConversationFrame>
      {stage === 'confirm' ? <Confirm onArchive={archive} onCancel={() => setStage('conversation')} /> : null}
    </div>
  );

  // ---- The workspace page after archiving: its archive section ----
  const others = ['Lomakkeen validointi', 'Uutiskirjeen pohja'];
  const workspace = (
    <div className="ah-state aa-page">
      <div className="ah-workspace-page">
        <header className="ah-workspace-page-head">
          <div className="ah-workspace-page-title"><h1 data-testid="workspace-title">{WS}</h1><p><code>~/src/{WS}</code></p></div>
        </header>
        <section aria-label="Avoimet keskustelut">
          <h2>Avoimet <span>{others.length}</span></h2>
          <ul className="aa-open">{others.map((t) => <li key={t}><LinkRow href={`/workspaces/ws_${WS}`}>{t}</LinkRow><span>Odottaa viestiä</span></li>)}</ul>
        </section>
      </div>
      <details className="ah-workspace-archive" data-testid="aa-archive" open={archiveOpen} onToggle={(e) => setArchiveOpen((e.target as HTMLDetailsElement).open)}>
        <summary data-testid="aa-archive-summary">Arkisto · {archived ? 2 : 1}</summary>
        <section data-testid="workspace-archive-panel" aria-label="Työtilan arkisto" className="aa-archive-panel">
          <h2 data-testid="archive-title">Arkisto</h2>
          {archived ? (
            <div className={`aa-archive-entry${direction === 3 ? ' aa-archive-entry-new' : ''}`} data-testid="aa-archive-entry">
              <p>
                <LinkRow href={`/workspaces/ws_${WS}?conversation=kotisivu`} kind="inline">{PARENT}</LinkRow>{' '}
                {direction === 3 ? <span className="aa-archive-count">+ 2 avustajaa</span> : null}
                <Button data-testid="restore-conversation" size="row" label={direction === 3 ? 'Palauta avustajineen' : 'Palauta näkyviin'} variant="quiet" onPress={restore} />
              </p>
              {direction === 3 ? <ul className="aa-helpers aa-archive-helpers">{facts(BEFORE).map((f) => <HelperRow key={f.run.run_id} f={f} testid="aa-archive-helper" />)}</ul> : null}
            </div>
          ) : null}
          <p><LinkRow href={`/workspaces/ws_${WS}`} kind="inline">Vanha navigaatio</LinkRow>{' '}<Button size="row" label={direction === 3 ? 'Palauta' : 'Palauta näkyviin'} variant="quiet" onPress={noop} /></p>
        </section>
      </details>
    </div>
  );

  const now = Date.now();
  const model = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/ws_${WS}?conversation=${m.agentId}`, workspaceId: `ws_${WS}`, workspaceName: WS, activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: now - 5 * 60000, ...m,
  });
  const running: AgentNavModel[] = [
    ...(archived ? [] : [model({agentId: 'kotisivu', title: PARENT, selected: true, detail: `${WS} · Odottaa viestiä`})]),
    model({agentId: 'lomake', title: 'Lomakkeen validointi', changedAt: now - 50 * 60000, detail: `${WS} · Odottaa viestiä`}),
    model({agentId: 'uutiskirje', title: 'Uutiskirjeen pohja', changedAt: now - 90 * 60000, detail: `${WS} · Odottaa viestiä`}),
  ];
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Alder" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now" data-testid="rail-running" aria-labelledby="aa-running">
          <h2 className="ah-rail-section-head" id="aa-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
          <ul>{running.map((m) => <AgentNavItem key={m.agentId} {...m} now={now} />)}</ul>
        </section>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_h" />
      <WorkspaceNavRow name={WS} href={`/workspaces/ws_${WS}`} selected={archived} />
    </WorkspaceRail>
  );
  const main = (
    <div className="aa-stage" data-stage={stage}>
      {archived ? workspace : conversation}
      {notice}
      {branch ? <BranchSheet after={restored} onClose={() => setBranch(false)} /> : null}
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={archived ? WS : PARENT} navigationBadge={0} rail={railView}
        main={<ProcessProvider id={PARENT_ID} csrf="prototype" onLogin={noop} onStatusEvent={() => noop}>{main}</ProcessProvider>} />
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [reset, setReset] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Avustajien arkistointi · kierros 1</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" className="rq-reset" data-testid="rq-reset" onClick={() => setReset((n) => n + 1)}>↺ Alusta keskustelusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter initialEntries={[`/workspaces/ws_${WS}`]}>
          <Main direction={direction} reset={reset} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(v: React.ReactNode) { flushSync(() => root.render(v === '' ? null : v)); }};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const pickerNav = document.createElement('nav');
pickerNav.className = 'proto-picker'; pickerNav.setAttribute('aria-label', 'Prototype variants');
pickerNav.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  pickerNav.append(button);
});
document.body.append(pickerNav);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
