import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {BackgroundStrip, backgroundFacts, type SpinoffItem, stateWord, type WorkerAsk} from '../../../../web/src/components/BackgroundStrip';
import {ProcessProvider, useProcessView} from '../../../../web/src/components/ProcessTray';
import {SpinoffContext} from '../../../../web/src/components/Spinoffs';
import type {Spinoff} from '../../../../web/src/app/spinoffs';
import type {ProcessRecord} from '../../../../web/src/app/processes';
import type {RequestPhase} from '../../../../web/src/app/workerRequests';
import type {TimelineItem} from '../../../../web/src/components/types';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {statusText} from '../../../../web/src/text/status';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const rail = liveText(statusText).rail;

// proto-worker-badges, round 1. Jari 7.11.2026 (pilot.612): a worker the
// agent waited on carried the dashed "nobody waits" mark. He asked to rethink
// the whole set of worker marks: what the Workerit pill, the panel row and the
// rail say about a worker's own state and about whether anyone waits for it.
// The axis is the badge set. "Nyt" is production as it is today, unchanged;
// the three directions re-mark the same production strip, panel and rail
// with the same story, so only the marks differ:
// 1 Pallot takes the rail's ball vocabulary for the worker's own state and
// puts an accent halo round a waited one; 2 Kotelo keeps state-only marks and
// gathers the waited ones into one capsule led by the top bar's wait mark;
// 3 Täyttö makes today's rings consistent: a live worker is always a ring,
// a filled core is a wait, an empty one is not.
const directions = ['Nyt', '1 Pallot', '2 Kotelo', '3 Täyttö'];
const LINES = [
  'Nyt: tuotanto tänään. Odotettu = rengas ja keskus, ei odotettu = katkoviivarengas; muut tilat omilla merkeillään, sivupalkki ei erota odotusta.',
  '1 Pallot: workerin merkki on sivupalkin pallo (työ sykkii, vuorosi keltainen, valmis vihreä, kesken punainen salmiakki); odotettu saa ympärilleen kehän.',
  '2 Kotelo: merkki kertoo vain workerin tilan; odotetut kootaan sirussa, paneelissa ja sivupalkissa yhteen koteloon, jonka alussa on yläpalkin odotusmerkki.',
  '3 Täyttö: elävä worker on aina rengas (pyörii = työssä, keltainen = vuorosi, ohut = odottaa pääagenttia); täytetty keskus = agentti odottaa, tyhjä = ei.',
];

// ---- The story: one conversation, five live workers, eight ended ----
const PARENT = 'Rupeama 7.11.';
const PARENT_ID = 'pi:0b5c6a62-6f2e-4f43-9d55-3f6c1b7e2a10';
const T0 = Date.now();
const ago = (min: number) => new Date(T0 - min * 60000).toISOString();
const run = (id: string, title: string, state: Spinoff['state'], extra: Partial<Spinoff> = {}): Spinoff => ({
  run_id: `01m6wb${id}`.padEnd(26, '0'), title, created_at: ago(20), state, preserved: false,
  branch: `wt/${title}`, worktree: `/home/maintainer/src/open-habitat__worktrees/wt-${title}`, source_branch: 'main', summary: '',
  harness: 'pi', profile: 'nopea', ...extra,
});
const RUNS: Spinoff[] = [
  run('l1', 'worker-badge-wait', 'working', {created_at: ago(12)}),
  run('l2', 'proto-worker-badges', 'working', {created_at: ago(25), harness: 'claude', profile: 'prototype-opus'}),
  run('l3', 'sharepoint-review', 'idle', {created_at: ago(48), harness: 'claude', profile: 'prototype-opus'}),
  run('l4', 'm365-site-sync', 'waiting_parent', {created_at: ago(31)}),
  run('l5', 'fleet-check', 'unknown', {created_at: ago(64)}),
  run('e1', 'context-page-compact', 'merged', {ended_at: ago(70)}),
  run('e2', 'explain-mode-dim', 'merged', {preserved: true, ended_at: ago(95)}),
  run('e3', 'gate-flake-r64', 'failed', {preserved: true, ended_at: ago(40)}),
  run('e4', 'remote-browser-chip', 'unmerged', {preserved: true, ended_at: ago(55)}),
  run('e5', 'lab-port-probe', 'failed', {ended_at: ago(80)}),
  run('e6', 'agent-resources-kinds', 'unmerged', {preserved: true, ended_at: ago(58)}),
  run('e7', 'header-split', 'unmerged', {preserved: true, ended_at: ago(62)}),
  run('e8', 'old-scratch', 'unmerged', {ended_at: ago(120)}),
];
const id = (title: string) => RUNS.find((r) => r.title === title)!.run_id;
const PHASES: Record<string, RequestPhase> = {[id('agent-resources-kinds')]: 'checking', [id('header-split')]: 'answer'};
const WAITED = [id('worker-badge-wait'), id('m365-site-sync')];

/** The agent's waking `taskfleet run wait`. "read": the daemon joined it to
 * its run ids; "unread": the ids came from the shell and were not read (the
 * 7.11. case), so production lists it as a plain process. */
type WaitRead = 'read' | 'unread';
let waitRead: WaitRead = 'read';
const waitRecord = (): ProcessRecord => ({
  id: 'proc_wait', name: 'taskfleet run wait', process_token: 'pt_wait', status: 'running', started_at: T0 - 9 * 60000,
  command_preview: waitRead === 'read' ? `taskfleet run wait ${WAITED.join(' ')} --any` : "taskfleet run wait $(tr '\\n' ' ' < active.txt) --any",
  ended_at: null, exit_code: null, signal: null, end_reason: null, wakes_agent: true,
  run_ids: waitRead === 'read' ? WAITED : [],
});
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path.endsWith('/processes'))
    return json({schema_version: 1, owner_generation: 'og_proto', availability: 'available', unavailable_reason: null, processes: [waitRecord()], interrupted: []});
  return new Response('', {status: 404});
};

// ---- One key per mark, shared by the sheet and the strip ----
type K = 'work-w' | 'work' | 'you' | 'you-w' | 'parent-w' | 'parent' | 'unknown' | 'unread'
  | 'merged' | 'mergedkept' | 'unfinished' | 'failedkept' | 'failed' | 'unmergedgone' | 'checking' | 'answer' | 'gone';
type Place = 'chip' | 'row' | 'rail';
const LIVE: K[] = ['work-w', 'work', 'unread', 'you', 'you-w', 'parent-w', 'parent', 'unknown'];
const isWaited = (k: K) => k.endsWith('-w');

function keyOf(i: SpinoffItem, phase: RequestPhase | undefined, unreadWait: boolean): K {
  const r = i.run;
  if (phase) return phase === 'answer' ? 'answer' : 'checking';
  if (i.live) {
    const w = i.waited ? '-w' : '';
    if (r.state === 'idle') return `you${w}` as K;
    if (r.state === 'working') return i.waited ? 'work-w' : unreadWait ? 'unread' : 'work';
    if (r.state === 'waiting_parent') return `parent${w}` as K;
    return i.waited ? 'parent-w' : 'unknown';
  }
  if (r.state === 'merged') return r.preserved ? 'mergedkept' : 'merged';
  if (r.state === 'failed') return r.preserved ? 'failedkept' : 'failed';
  return r.preserved ? 'unfinished' : 'unmergedgone';
}

/** Today's production marks, by the classes the strip itself uses. */
function NowMark({k, place}: {k: K; place: Place}) {
  if (place === 'rail') return null;
  switch (k) {
    case 'work-w': case 'parent-w': return <span className="ah-bg-wait-dot ah-background-dot" />;
    case 'work': case 'unread': return <span className="ah-bg-wait-dot nowait" />;
    case 'you': case 'you-w': case 'answer': return <span className="ah-bg-ring still" />;
    case 'parent': case 'unknown': return <span className="ah-bg-dot unknown" />;
    case 'checking': return <span className="ah-bg-ring" />;
    case 'unfinished': case 'failedkept': return <span className="ah-bg-ball" />;
    case 'merged': case 'mergedkept': return place === 'chip' ? null : <Icon name="merge" />;
    case 'failed': return place === 'chip' ? null : <Icon name="cross" />;
    case 'unmergedgone': return place === 'chip' ? null : <Icon name="warning" />;
    case 'gone': return place === 'chip' ? null : <Icon name="check" className="ah-bg-gone" />;
  }
}
/** A direction's mark: a span its CSS draws, or an icon where it keeps one. */
function DirMark({d, k, place}: {d: number; k: K; place: Place}) {
  const ended = !LIVE.includes(k) && k !== 'checking' && k !== 'answer';
  // Kotelo and every direction's chip list only the ended rows that need the person.
  if (place === 'chip' && ended && !['unfinished', 'failedkept'].includes(k)) return null;
  if (k === 'gone') return <Icon name="check" className="ah-bg-gone wb-ic" />;
  if (d === 2 && (k === 'merged' || k === 'mergedkept')) return <Icon name="merge" className="wb-ic wb-ok" />;
  if ((d === 2 || d === 3) && k === 'failed') return <Icon name="cross" className="wb-ic wb-err" />;
  return <span className="wb-m" data-d={d} data-k={k} data-place={place} />;
}
function Mark({d, k, place}: {d: number; k: K; place: Place}) {
  return d === 0 ? <NowMark k={k} place={place} /> : <DirMark d={d} k={k} place={place} />;
}
/** Kotelo's capsule: the top bar's wait mark, then what is waited. */
function Capsule({children, place}: {children: React.ReactNode; place: Place}) {
  return (
    <span className="wb-cap" data-place={place} data-testid="wb-capsule">
      <span className="ah-background-dot wb-cap-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
/** The rail's own worker mark, in place of production's pulsing branch. */
function RailMark({d, k}: {d: number; k: K}) {
  const branch = (
    <svg className="wb-branch" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" data-k={k}>
      <circle cx="7" cy="6" r="2" /><path d="M7 8v10" /><path d="M7 12c0 3 3 4 7 4" />
      <circle className="wb-branch-end" cx="17" cy="16" r={d === 3 ? 3 : 2} />
    </svg>
  );
  if (d === 1) return <span className="wb-rail" data-d={d}>{branch}<DirMark d={1} k={k} place="rail" /></span>;
  if (d === 2) return <span className="wb-rail" data-d={d}>{isWaited(k) ? <Capsule place="rail">{branch}</Capsule> : branch}{k.startsWith('you') ? <DirMark d={2} k="you" place="rail" /> : null}</span>;
  return <span className="wb-rail" data-d={d}>{branch}</span>;
}

// ---- The sheet: every state, side by side in its three places ----
const SHEET: {k: K; label: string; run?: Partial<Spinoff>; waited?: boolean; phase?: RequestPhase; railK?: K; railNow?: string}[] = [
  {k: 'work-w', label: 'Työskentelee, agentti odottaa', run: {state: 'working'}, waited: true, railK: 'work-w', railNow: 'branch'},
  {k: 'work', label: 'Työskentelee, agentti ei odota', run: {state: 'working'}, railK: 'work', railNow: 'branch'},
  {k: 'unread', label: 'Agentti odottaa jotain, kohde ei luettavissa', run: {state: 'working'}, railK: 'work', railNow: 'branch'},
  {k: 'you', label: 'Odottaa sinua omassa kehotteessaan', run: {state: 'idle'}, railK: 'you', railNow: 'none'},
  {k: 'you-w', label: 'Odottaa sinua, ja agentti odottaa sitä', run: {state: 'idle'}, waited: true, railK: 'you-w', railNow: 'none'},
  {k: 'parent-w', label: 'Odottaa pääagenttia, agentti odottaa', run: {state: 'waiting_parent'}, waited: true},
  {k: 'parent', label: 'Odottaa pääagenttia', run: {state: 'waiting_parent'}},
  {k: 'unknown', label: 'Tila ei tiedossa', run: {state: 'unknown'}},
  {k: 'merged', label: 'Laskeutui', run: {state: 'merged'}},
  {k: 'mergedkept', label: 'Mergetty, worktree jäljellä', run: {state: 'merged', preserved: true}},
  {k: 'unfinished', label: 'Ei mergetty, työ tallessa', run: {state: 'unmerged', preserved: true}},
  {k: 'failedkept', label: 'Epäonnistui, työ tallessa', run: {state: 'failed', preserved: true}, railNow: 'fail'},
  {k: 'failed', label: 'Epäonnistui, ei mitään tallessa', run: {state: 'failed'}, railNow: 'fail'},
  {k: 'unmergedgone', label: 'Ei mergetty, ei mitään tallessa', run: {state: 'unmerged'}},
  {k: 'checking', label: 'Pyyntö: agentti tarkistaa', phase: 'checking'},
  {k: 'answer', label: 'Pyyntö: odottaa vastaustasi', phase: 'answer'},
  {k: 'gone', label: 'Haara ja worktree poistettu'},
];
const PHASE_WORD: Record<string, string> = {checking: 'agentti tarkistaa · tässä keskustelussa', answer: 'odottaa vastaustasi · tässä keskustelussa'};
function sheetWord(s: (typeof SHEET)[number]) {
  if (s.k === 'gone') return 'haara ja worktree poistettu';
  if (s.phase) return PHASE_WORD[s.phase];
  const r = {...RUNS[0], ...s.run} as Spinoff;
  const live = ['working', 'idle', 'waiting_parent', 'unknown'].includes(r.state);
  return stateWord({run: r, live, waited: !!s.waited, attention: false}).text;
}
function NowRail({kind}: {kind?: string}) {
  if (kind === 'branch')
    return (
      <span className="wb-rail" data-d={0}>
        <svg className="ah-nav-spinoff" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="7" cy="6" r="2" /><path d="M7 8v10" />
          <g className="ah-nav-spinoff-branch"><path d="M7 12c0 3 3 4 7 4" /><circle cx="17" cy="16" r="2" /></g>
        </svg>
      </span>
    );
  if (kind === 'fail') return <span className="wb-rball wb-rball-fail" title="Keskustelun pallo: Worker epäonnistui" />;
  return <span className="wb-none">–</span>;
}
function Sheet({d}: {d: number}) {
  return (
    <aside className="wb-sheet" data-testid="wb-sheet" aria-label="Merkistö">
      <h2>Merkistö · {directions[d]}</h2>
      <table>
        <thead><tr><th>Tila</th><th>Siru</th><th>Paneelin rivi</th><th>Sivupalkki</th></tr></thead>
        <tbody>
          {SHEET.map((s) => {
            const chip = <Mark d={d} k={s.k} place="chip" />;
            const chipCell = d === 2 && isWaited(s.k) ? <Capsule place="chip">{chip}</Capsule> : chip;
            return (
              <tr key={s.k} data-k={s.k}>
                <th scope="row">{s.label}</th>
                <td><span className="ah-bg-marks wb-cell">{chipCell ?? <span className="wb-none">–</span>}</span></td>
                <td>
                  <span className={`wb-rowcell${d === 2 && isWaited(s.k) ? ' wb-rowcap' : ''}`}>
                    <span data-state={s.run?.state}><span className="ah-bg-mark"><Mark d={d} k={s.k} place="row" /></span></span>
                    <span className="wb-word">{sheetWord(s)}</span>
                  </span>
                </td>
                <td>{d === 0 ? <NowRail kind={s.railNow} /> : s.railK ? <RailMark d={d} k={s.railK} /> : s.railNow === 'fail' ? <NowRail kind="fail" /> : <span className="wb-none">–</span>}</td>
              </tr>
            );
          })}
          <tr data-k="many">
            <th scope="row">Yli viisi elävää workeria</th>
            <td colSpan={3}><span className="ah-bg-marks wb-cell"><Many d={d} /></span></td>
          </tr>
        </tbody>
      </table>
      <p className="wb-sheet-note">
        {d === 0
          ? 'Sivupalkin keskustelurivillä on haaraikoni aina, kun sen worker työskentelee tai agentti odottaa workeria; odotettu ja odottamaton näyttävät samalta. Pallo kertoo keskustelun, ei workerin tilan.'
          : 'Sivupalkin sarake on keskustelurivin merkki sen pallon ja otsikon jälkeen. Keskustelun oma pallo pysyy tuotannon pallona.'}
      </p>
    </aside>
  );
}
/** More than five live workers: one mark per kind with its count. */
function Many({d}: {d: number}) {
  const groups: [K, number][] = [['work-w', 2], ['work', 4], ['you', 1]];
  if (d === 2)
    return (<><Capsule place="chip"><Mark d={2} k="work-w" place="chip" />2</Capsule><Mark d={2} k="work" place="chip" />4<Mark d={2} k="you" place="chip" />1</>);
  if (d === 0)
    return (<><Mark d={0} k="work-w" place="chip" />2<Mark d={0} k="work" place="chip" />4<span className="ah-bg-dot unknown" />1</>);
  return <>{groups.map(([k, n]) => <React.Fragment key={k}><Mark d={d} k={k} place="chip" />{n}</React.Fragment>)}</>;
}

// ---- Re-marking the production strip in place ----
function useNodes(selector: string) {
  const [nodes, setNodes] = useState<Element[]>([]);
  useLayoutEffect(() => {
    const find = () => {
      const next = [...document.querySelectorAll(selector)];
      setNodes((old) => (old.length === next.length && old.every((n, i) => n === next[i]) ? old : next));
    };
    find();
    const o = new MutationObserver(find);
    o.observe(document.getElementById('root')!, {childList: true, subtree: true});
    return () => o.disconnect();
  }, [selector]);
  return nodes;
}
const NONE: Element[] = [];
/** One container the round owns at the end (or start) of each production node. */
function useSlots(parents: Element[], className: string, where: 'first' | 'last' = 'last') {
  const [slots, setSlots] = useState<Map<Element, HTMLElement>>(new Map());
  useLayoutEffect(() => {
    const made = new Map<Element, HTMLElement>();
    for (const p of parents) {
      const el = document.createElement(p.tagName === 'DIV' || p.tagName === 'LI' ? 'div' : 'span');
      el.className = className;
      if (where === 'first') p.prepend(el); else p.append(el);
      made.set(p, el);
    }
    setSlots(made);
    return () => { made.forEach((el) => el.remove()); };
  }, [parents, className, where]);
  return slots;
}

function useFacts() {
  const facts = backgroundFacts({
    runs: RUNS, spinoffsStale: false, processes: [waitRecord()], interrupted: 0, availability: 'available', failed: false, agentIdle: true,
  });
  const unreadWait = waitRead === 'unread';
  const k = (i: SpinoffItem) => keyOf(i, i.live ? undefined : PHASES[i.run.run_id], unreadWait);
  return {facts, k};
}

/** The direction's marks in the pill, the rows and the rail, over production's. */
function Remark({d}: {d: number}) {
  const {facts, k} = useFacts();
  const pills = useNodes('[data-testid="background-spinoffs"]');
  const pillSlots = useSlots(pills, 'ah-bg-marks wb-pill-marks');
  const marks = useNodes('.ah-bg-row[data-kind="spin"] .ah-bg-mark');
  const markSlots = useSlots(marks, 'wb-row-mark');
  const groups = useNodes('.ah-bg-pop-body .ah-bg-group[aria-label="Workerit: käynnissä"]');
  const groupSlots = useSlots(d === 2 ? groups : NONE, 'wb-group-head', 'first');
  const railRows = useNodes('.ah-rail li[data-testid^="agent-item-"] .ah-list-row');
  const railSlots = useSlots(railRows, 'wb-rail-slot');
  const byTitle = new Map(facts.spin.items.map((i) => [i.run.title, i]));
  const live = facts.spin.marks;
  const waited = live.filter((i) => i.waited);
  const others = live.filter((i) => !i.waited);
  const endedNeed = facts.spin.ended.filter((i) => i.attention || PHASES[i.run.run_id]);
  // Waiting rows first, then the ones being handled (production's order).
  endedNeed.sort((a, b) => Number(!!PHASES[a.run.run_id]) - Number(!!PHASES[b.run.run_id]));
  const chipMark = (i: SpinoffItem) => <DirMark key={i.run.run_id} d={d} k={k(i)} place="chip" />;
  const pill = (
    <>
      {d === 2 && waited.length ? <Capsule place="chip">{waited.map(chipMark)}</Capsule> : (d === 2 ? null : waited.map(chipMark))}
      {others.map(chipMark)}
      {endedNeed.length ? <span className="wb-sep" aria-hidden="true" /> : null}
      {endedNeed.map(chipMark)}
    </>
  );
  const railK: Record<string, K> = {rupeama: waitRead === 'read' ? 'work-w' : 'work', kirjasto: 'work', sharepoint: 'you'};
  return (
    <>
      {[...pillSlots.values()].map((slot) => createPortal(pill, slot, 'pill'))}
      {[...markSlots.entries()].map(([node, slot]) => {
        const title = node.closest('.ah-bg-row')?.querySelector('[data-testid^="spinoff-"]')?.getAttribute('data-testid')?.slice('spinoff-'.length);
        const i = title ? byTitle.get(title) : undefined;
        return i ? createPortal(<DirMark d={d} k={k(i)} place="row" />, slot, i.run.run_id) : null;
      })}
      {[...groupSlots.values()].map((slot) => createPortal(
        waited.length ? <><span className="ah-background-dot wb-cap-dot" aria-hidden="true" /><span>Agentti odottaa näitä</span><span className="wb-group-n">{waited.length}</span></> : null, slot, 'gh'))}
      {[...railSlots.entries()].map(([node, slot]) => {
        const agent = node.closest('li')?.getAttribute('data-testid')?.slice('agent-item-'.length) ?? '';
        const rk = railK[agent];
        return rk ? createPortal(<RailMark d={d} k={rk} />, slot, agent) : null;
      })}
    </>
  );
}

/** The panel is open on the default view, so every row's mark shows at once. */
function OpenPanel() {
  const view = useProcessView();
  const done = useRef(false);
  useEffect(() => {
    if (!done.current && view?.setPanel) { done.current = true; view.setPanel('spin'); }
  }, [view]);
  return null;
}

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'open-habitat',
};
const picker = <button type="button" className="md-pill">Claude Opus 5.5 · high</button>;
type Item = TimelineItem & {kind: 'user' | 'assistant'};
const userItem = (id: string, text: string, time: string): Item => ({id, kind: 'user', content: <UserMessage sourceText={text} onCopy={noop} time={time}><Markdown text={text} /></UserMessage>});
const agentItem = (id: string, text: string, time: string): Item =>
  ({id, kind: 'assistant', content: <AssistantMessage streamState="complete" time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>});
const EVENTS: Item[] = [
  userItem('u1', 'Korjaa workerin odotusmerkki ja tarkista m365-synkka, odota molempia.', '10.20'),
  agentItem('a1', 'Käynnistin **worker-badge-wait**-workerin ja annoin **m365-site-syncille** jatko-ohjeen. Odotan molempia; herään, kun jompikumpi valmistuu.\n\n`proto-worker-badges` jatkaa omaa kierrostaan, sitä en odota.', '10.21'),
];

function Main({direction, read}: {direction: number; read: WaitRead}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLElement>(null);
  const now = Date.now();
  const model = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/ws_o?conversation=${m.agentId}`, workspaceId: 'ws_o', workspaceName: 'open-habitat', activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: T0 - 5 * 60000, ...m,
  });
  const waits = read === 'read';
  const running: AgentNavModel[] = [
    model({agentId: 'rupeama', title: PARENT, selected: true, spinoffWorking: true,
      activity: waits ? 'waiting_background' : 'waiting', activityLabel: waits ? rail.background : rail.workerWorking,
      detail: ['open-habitat', waits ? rail.background : rail.workerWorking, waits ? 'worker-badge-wait, m365-site-sync' : ''].filter(Boolean).join(' · ')}),
    model({agentId: 'kirjasto', title: 'Kirjaston päivitys', workspaceId: 'ws_h', workspaceName: 'fleetrepo', spinoffWorking: true,
      activityLabel: rail.workerWorking, detail: `fleetrepo · ${rail.workerWorking}`, changedAt: T0 - 14 * 60000}),
    model({agentId: 'sharepoint', title: 'SharePoint-katselmointi', activityLabel: rail.workerWaiting, detail: `open-habitat · ${rail.workerWaiting}`, changedAt: T0 - 30 * 60000}),
    model({agentId: 'm365', title: 'M365-asetukset', failed: true, activityLabel: rail.workerFailed, detail: `open-habitat · ${rail.workerFailed}`, changedAt: T0 - 40 * 60000}),
  ];
  const quiet: AgentNavModel[] = [
    model({agentId: 'q1', title: 'Fleet-päivitys', workspaceId: 'ws_h', workspaceName: 'fleetrepo', changedAt: T0 - 140 * 60000, detail: 'fleetrepo · Odottaa viestiä'}),
  ];
  const row = (m: AgentNavModel) => <AgentNavItem key={m.agentId} {...m} now={now} />;
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Alder" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="wb-running">
            <h2 className="ah-rail-section-head" id="wb-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
            <ul>{running.map(row)}</ul>
          </section>
          <section className="ah-now ah-quiet" data-testid="rail-quiet" aria-labelledby="wb-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded="true">
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="wb-quiet">Hiljaiset</span><span className="ah-rail-count">{quiet.length}</span>
              </button>
            </h2>
            <ul>{quiet.map(row)}</ul>
          </section>
        </>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_h" />
      <WorkspaceNavRow name="open-habitat" href="/workspaces/ws_o" />
    </WorkspaceRail>
  );
  const ask: WorkerAsk = {phases: PHASES, target: 'here', send: noop};
  const main = (
    <div className="ah-state wb-main">
      <ConversationFrame>
        <AgentHeader title={PARENT} workspaceLabel="open-habitat" workspaceHref="/workspaces/ws_o"
          activityLabel={waits ? rail.background : 'Odottaa viestiä'} activityKind={waits ? 'background' : 'neutral'}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
        <ConversationStream streamRef={stream}>
          <ConversationTimeline state="ready" items={EVENTS} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
        </ConversationStream>
        <SpinoffContext.Provider value={{data: {schema_version: 1, parent_id: PARENT_ID, availability: 'available', runs: RUNS, transcripts: []}, open: noop}}>
          <BackgroundStrip agentIdle ask={ask} />
        </SpinoffContext.Provider>
        <OpenPanel />
        {direction ? <Remark d={direction} /> : null}
        <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
          onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={picker} />
      </ConversationFrame>
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={PARENT} navigationBadge={0} rail={railView}
        main={<ProcessProvider key={read} id={PARENT_ID} csrf="prototype" onLogin={noop} onStatusEvent={() => noop}>{main}</ProcessProvider>} />
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [read, setRead] = useState<WaitRead>(waitRead);
  const [sheet, setSheet] = useState(false);
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
    <div className={`rq-review variant-${direction}${sheet ? ' wb-sheet-open' : ''}`} data-direction={direction} data-wait={read}>
      <header className="rq-bar" ref={bar}>
        <strong>Workerien merkit · kierros 1</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label title="7.11.: agentti odotti tunnuksilla, jotka komentotulkki laajensi tiedostosta">Odotus <select id="wait" value={read} onChange={(e) => { waitRead = e.target.value as WaitRead; setRead(waitRead); }}>
          <option value="read">tunnistettu</option><option value="unread">kohde ei luettavissa (7.11.)</option></select></label>
        <button type="button" className="wb-sheet-toggle" data-testid="wb-sheet-toggle" aria-expanded={sheet} onClick={() => setSheet((s) => !s)}>{sheet ? 'Paikallaan' : 'Merkistö'}</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter key={read} initialEntries={['/workspaces/ws_o?conversation=rupeama']}>
          <Main direction={direction} read={read} />
        </MemoryRouter>
      </div>
      <Sheet d={direction} />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
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
