import React, {useLayoutEffect, useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/WorkspacePage.css';
import {AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {Icon} from '../../../../web/src/components/Icon';
import {ControlButton, LinkRow} from '../../../../web/src/components/ControlElements';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {WorkerMark, type WorkerMarkKind} from '../../../../web/src/components/WorkerMark';
import {WorktreeRemoveDialog} from '../../../../web/src/components/WorktreeList';
import {WorktreeCleanup} from '../../../../web/src/app/WorktreeCleanup';
import type {Worktree} from '../../../../web/src/app/workspaceWorktrees';
import {bytes} from '../../../../web/src/app/trashText';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-worktree-list-meaning, round 1. Jari 8.11.2026: the workspace page's
// Worktreet section lists Git directories (wt-d0qmfx5v37-testaaja …) with
// paths, branches and "Taskfleet-ajo … omistaa tämän worktreen", almost every
// button disabled. The axis is how the section reads and what the person can
// do: every direction names a row by what it is for the person (a helper and
// its conversation, a worker's task, a leftover), says what keeps it and
// leads to where it is handled. Habitat itself stops no run (Jari 6.11.).
// They differ in how the list is organised and what shows by default:
// 1 Huomio: only rows that need the person; the rest is one line;
// 2 Keskustelut: grouped under their conversation, one action per group;
// 3 Yhteenveto: a few sentences with their actions; the rows behind a toggle.
const directions = ['Nyt', '1 Huomio', '2 Keskustelut', '3 Yhteenveto'];
const LINES = [
  'Nyt: tuotanto tänään. Gitin hakemistonimet, polut ja haarat; omistettu rivi sanoo "Taskfleet-ajo … omistaa", ja vain jäänteellä on painike.',
  '1 Huomio: näkyvissä vain rivit, jotka tarvitsevat sinua (jäänne, päätöstä odottava worker); itsestään hoituvat ovat yhdellä rivillä alla.',
  '2 Keskustelut: rivit ryhmitelty keskustelunsa alle; ryhmällä on yksi toiminto (avaa, palauta arkistosta), ja itsestään hoituva ryhmä on suljettu.',
  '3 Yhteenveto: muutama lause tilasta toimintoineen ja levyn käyttö palkkina; yksittäiset worktreet vasta Näytä kaikki -valinnan takana.',
];

// ---- The story: Jari's four rows on 8.11. plus the worker of his one running conversation ----
const WS = 'open-habitat';
const WSID = 'ws_openhabitat01';
const MiB = 1024 * 1024;
const now = Date.now();
const at = (min: number) => new Date(now + min * 60000);
const clock = (d: Date) => {
  const today = new Date(now).toDateString() === d.toDateString();
  return `${today ? 'tänään' : 'huomenna'} klo ${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`;
};

type Conv = {id: string; title: string; archived: boolean};
const LIVE: Conv = {id: 'lista', title: 'Worktree-lista selväksi', archived: false};
const TRIALS: Conv = {id: 'kokeilu', title: 'Avustajien kokeilu', archived: true};
const HELPER: Conv = {id: 'testi', title: 'Tee meille testiavustaja', archived: true};

const wt = (name: string, runId: string | undefined, over: Partial<Worktree>): Worktree => ({
  workspace_id: WSID, workspace_name: WS, entry: name, name, path: `~/src/open-habitat__worktrees/${name}`,
  state: 'merged', branch: name.replace(/^wt-/, 'wt/'), base: 'main', changed: 0, untracked: 0, ignored: 0, ignored_paths: [],
  unreachable_head: false, size_bytes: 445 * MiB, size_complete: true,
  blockers: runId ? [{kind: 'taskfleet_run', run_id: runId}] : [], actions: runId ? [] : ['remove'],
  observation_token: `wt_${name.replace(/[^A-Za-z0-9]/g, '').padEnd(24, 'x').slice(0, 24)}`, ...over,
});

// What a row is for the person, from facts the host already reads (Taskfleet's
// run list: kind, title, resident name, lifecycle, creator session, idle
// expiry; the conversation list: title, archived) joined to Git's worktree.
type Need = 'you' | 'self' | 'working';
type Row = {
  w: Worktree; kind: 'helper' | 'worker' | 'leftover'; label: string; mark: WorkerMarkKind;
  conv: Conv; need: Need; state: string; keeper: string; releaseAt?: Date; runId?: string;
};
const ROWS: Row[] = [
  {w: wt('wt-ej30796brt-r69-wtlist', '01m6y6gz4t8962hvej30796brt', {state: 'dirty', changed: 4, ahead: 2, size_bytes: 452 * MiB}),
    kind: 'worker', label: 'Worktree-listan prototyyppi', mark: 'working', conv: LIVE, need: 'working', runId: '01m6y6gz4t8962hvej30796brt',
    state: 'työssä', keeper: 'Worker tekee tässä tehtäväänsä. Pääagentti yhdistää työn, kun se on valmis.'},
  {w: wt('wt-vwek5m102j-testi-interaktiivinen-odottaa', '01m6y3dvjm9a5e9evwek5m102j', {state: 'unmerged', ahead: 1}),
    kind: 'worker', label: 'Testi: interaktiivinen odottaa', mark: 'answer', conv: TRIALS, need: 'you', runId: '01m6y3dvjm9a5e9evwek5m102j',
    state: 'odottaa päätöstä', keeper: 'Worker on valmis ja odottaa, että agentti yhdistää tai hylkää sen. Keskustelu on arkistoitu, joten kukaan ei tee sitä ennen kuin palautat sen.'},
  {w: wt('wt-wn4g5vgp8d-testi-headless-p-ttyy-merge-m-tt', undefined, {state: 'unmerged', ahead: 1}),
    kind: 'leftover', label: 'Testi: headless päättyy merge-mättä', mark: 'unmerged', conv: TRIALS, need: 'you',
    state: 'jäänne', keeper: 'Worker päättyi yhdistämättä, eikä kukaan käytä tätä enää. Sen 1 muutos jää haaraan, jos poistat työkopion.'},
  {w: wt('wt-d0qmfx5v37-testaaja', '01m6y4rzfh5yk0j6d0qmfx5v37', {}),
    kind: 'helper', label: 'testaaja', mark: 'waiting_parent', conv: HELPER, need: 'self', runId: '01m6y4rzfh5yk0j6d0qmfx5v37', releaseAt: at(7 * 60 + 25),
    state: 'odottaa', keeper: 'Avustaja pitää työkopion seuraavaa kierrosta varten. Kaikki kierrokset on yhdistetty.'},
  {w: wt('wt-hw4ctnr0kf-testi-avustaja', '01m6y3dkm0dhhfq5hw4ctnr0kf', {}),
    kind: 'helper', label: 'testi-avustaja', mark: 'waiting_parent', conv: TRIALS, need: 'self', runId: '01m6y3dkm0dhhfq5hw4ctnr0kf', releaseAt: at(2 * 60 + 50),
    state: 'odottaa', keeper: 'Avustaja pitää työkopion seuraavaa kierrosta varten. Kaikki kierrokset on yhdistetty.'},
];
const kindWord = {helper: 'avustaja', worker: 'worker', leftover: 'worker, päättynyt'} as const;
const release = (r: Row) => (r.releaseAt ? `vapautuu itsestään ${clock(r.releaseAt)}` : '');
const total = (rows: Row[]) => bytes(rows.reduce((n, r) => n + (r.w.size_bytes ?? 0), 0));

// ---- Nyt: production's WorktreeCleanup with the same rows from the host ----
const listing = (rows: Row[]) => ({
  schema_version: 1, state: 'listed', workspace_id: WSID, worktrees: rows.map((r) => r.w),
  truncated: false, complete: true, listing_token: 'a'.repeat(64),
});
let hostRows = ROWS.slice(1).concat(ROWS[0]);
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (path !== '/api/v1/workspaces') return realFetch(input, init);
  const body = JSON.parse(String(init?.body ?? '{}'));
  if (body.action === 'worktree_remove') {
    hostRows = hostRows.filter((r) => r.w.entry !== body.entry);
    return new Response(JSON.stringify({schema_version: 1, state: 'removed', workspace_id: WSID, entry: body.entry, branch: body.entry.replace(/^wt-/, 'wt/'), branch_kept: 'not_merged'}), {headers: {'content-type': 'application/json'}});
  }
  return new Response(JSON.stringify(listing(hostRows)), {headers: {'content-type': 'application/json'}});
};

// ---- Shared pieces of the directions ----
function Who({r}: {r: Row}) {
  return (
    <span className="wl-who">
      <span className="wl-mark"><WorkerMark kind={r.mark} /></span>
      <span className="wl-lines">
        <span className="wl-name">
          <b>{r.label}</b>
          <span className="wl-kind">{kindWord[r.kind]}</span>
        </span>
        <span className="wl-from">
          keskustelusta <ConvLink c={r.conv} /> {r.conv.archived ? <span className="wl-tag">arkistoitu</span> : <span className="wl-tag live">käynnissä</span>}
        </span>
      </span>
    </span>
  );
}
function ConvLink({c}: {c: Conv}) {
  return <LinkRow kind="inline" href={`/workspaces/${WSID}?conversation=${c.id}`}>{c.title}</LinkRow>;
}
/** Git's names for the person who compares with a terminal: never the row's name. */
function GitFacts({r}: {r: Row}) {
  return (
    <dl className="wl-git" data-testid="wl-git">
      <dt>Hakemisto</dt><dd><code>{r.w.path}</code></dd>
      <dt>Haara</dt><dd><code>{r.w.branch}</code> → <code>{r.w.base}</code>{r.w.ahead ? ` · ${r.w.ahead} ${r.w.ahead === 1 ? 'commit' : 'committia'}, joita ei ole haarassa main` : ' · yhdistetty'}</dd>
      <dt>Koko</dt><dd>{bytes(r.w.size_bytes ?? 0)}</dd>
      {r.runId ? <><dt>Taskfleet-ajo</dt><dd><code>{r.runId}</code></dd></> : null}
    </dl>
  );
}
type Act = {open: (c: Conv) => void; remove: (r: Row) => void};
/** Where the row is handled. Habitat stops nothing; it leads to the conversation. */
function RowAction({r, act}: {r: Row; act: Act}) {
  if (r.kind === 'leftover')
    return <ControlButton data-testid="wl-remove" size="row" variant="secondary" onPress={() => act.remove(r)}>Poista…</ControlButton>;
  if (r.need === 'you')
    return <ControlButton data-testid="wl-open" size="row" variant="secondary" onPress={() => act.open(r.conv)}>{r.conv.archived ? 'Palauta keskustelu' : 'Avaa keskustelu'}</ControlButton>;
  return null;
}

// ---- 1 Huomio ----
function AttentionFirst({rows, act}: {rows: Row[]; act: Act}) {
  const you = rows.filter((r) => r.need === 'you');
  const rest = rows.filter((r) => r.need !== 'you');
  const [git, setGit] = useState<string>();
  const [more, setMore] = useState(false);
  const restLine = [
    rest.filter((r) => r.need === 'self').map((r) => r.label).join(' ja ') + (rest.some((r) => r.need === 'self') ? ' vapautuvat itsestään' : ''),
    ...rest.filter((r) => r.need === 'working').map((r) => `${r.label} on työssä`),
  ].filter((s) => s.trim()).join(', ');
  const Line = ({r, quiet}: {r: Row; quiet?: boolean}) => (
    <li className={`wl-row${quiet ? ' quiet' : ''}`} data-testid="wl-row" data-need={r.need}>
      <div className="wl-row-main">
        <Who r={r} />
        <p className="wl-keeper">{r.keeper}{r.releaseAt ? <> <b>Vapautuu itsestään {clock(r.releaseAt)}.</b></> : null}</p>
        <button type="button" className="wl-disclose" aria-expanded={git === r.w.entry} data-testid="wl-git-toggle"
          onClick={() => setGit(git === r.w.entry ? undefined : r.w.entry)}>
          <Icon name="branch" /> Git-tiedot
        </button>
        {git === r.w.entry ? <GitFacts r={r} /> : null}
      </div>
      <span className="wl-row-actions"><RowAction r={r} act={act} /></span>
    </li>
  );
  return (
    <section className="wl-section" data-testid="wl-section">
      <div className="wl-head">
        <h3>Worktreet <span className="wl-count">{rows.length} · {total(rows)}</span></h3>
      </div>
      <p className="wl-intro">Agenttien työkopiot tässä työtilassa. Näkyvissä ovat ne, jotka tarvitsevat sinua.</p>
      {you.length ? <ul className="wl-list">{you.map((r) => <Line key={r.w.entry} r={r} />)}</ul>
        : <p className="wl-empty"><Icon name="check" /> Mikään ei tarvitse sinua.</p>}
      {rest.length ? (
        <div className="wl-rest">
          <button type="button" className="wl-rest-toggle" aria-expanded={more} data-testid="wl-rest" onClick={() => setMore(!more)}>
            <span className="wl-chev" aria-hidden="true" />
            <span><b>{rest.length} muuta hoituu ilman sinua</b> · {restLine}</span>
          </button>
          {more ? <ul className="wl-list">{rest.map((r) => <Line key={r.w.entry} r={r} quiet />)}</ul> : null}
        </div>
      ) : null}
    </section>
  );
}

// ---- 2 Keskustelut ----
function ByConversation({rows, act}: {rows: Row[]; act: Act}) {
  const convs = [LIVE, TRIALS, HELPER].filter((c) => rows.some((r) => r.conv === c));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [git, setGit] = useState<string>();
  return (
    <section className="wl-section" data-testid="wl-section">
      <div className="wl-head">
        <h3>Worktreet <span className="wl-count">{rows.length} · {total(rows)}</span></h3>
      </div>
      <p className="wl-intro">Agenttien työkopiot keskusteluittain. Agentti yhdistää tai lopettaa työn omassa keskustelussaan.</p>
      <div className="wl-groups">
        {convs.map((c) => {
          const mine = rows.filter((r) => r.conv === c);
          const needs = mine.some((r) => r.need === 'you');
          const isOpen = open[c.id] ?? (needs || !c.archived);
          const helpers = mine.filter((r) => r.kind === 'helper');
          const summary = [
            helpers.length ? `${helpers.length === 1 ? 'avustaja' : `${helpers.length} avustajaa`} ${helpers.length === 1 ? 'vapautuu' : 'vapautuvat'} itsestään ${clock(helpers.map((h) => h.releaseAt!).sort((a, b) => +b - +a)[0])}` : '',
            mine.some((r) => r.need === 'working') ? 'worker työssä' : '',
            mine.some((r) => r.kind === 'worker' && r.need === 'you') ? 'worker odottaa päätöstä' : '',
            mine.some((r) => r.kind === 'leftover') ? '1 jäänne' : '',
          ].filter(Boolean).join(' · ');
          return (
            <div key={c.id} className="wl-group" data-testid="wl-group" data-open={isOpen || undefined} data-needs={needs || undefined}>
              <div className="wl-group-head">
                <button type="button" className="wl-group-toggle" aria-expanded={isOpen} onClick={() => setOpen({...open, [c.id]: !isOpen})}>
                  <span className="wl-chev" aria-hidden="true" />
                </button>
                <span className="wl-group-title">
                  <span><Icon name="agent" /> <ConvLink c={c} /> {c.archived ? <span className="wl-tag">arkistoitu</span> : <span className="wl-tag live">käynnissä</span>}</span>
                  <span className="wl-group-sum">{mine.length} {mine.length === 1 ? 'työkopio' : 'työkopiota'} · {total(mine)} · {summary}</span>
                </span>
                <span className="wl-group-action">
                  {needs && c.archived ? <ControlButton data-testid="wl-open" size="row" variant="secondary" onPress={() => act.open(c)}>Palauta keskustelu</ControlButton>
                    : !c.archived ? <ControlButton data-testid="wl-open" size="row" variant="quiet" onPress={() => act.open(c)}>Avaa</ControlButton> : null}
                </span>
              </div>
              {isOpen ? (
                <ul className="wl-compact">
                  {mine.map((r) => (
                    <li key={r.w.entry} data-testid="wl-row" data-need={r.need}>
                      <span className="wl-mark"><WorkerMark kind={r.mark} /></span>
                      <span className="wl-compact-text">
                        <b>{r.label}</b> <span className="wl-kind">{kindWord[r.kind]}</span>
                        <span className={`wl-state ${r.need}`}>{r.need === 'self' ? release(r) : r.state}</span>
                        <button type="button" className="wl-disclose" aria-expanded={git === r.w.entry} data-testid="wl-git-toggle" onClick={() => setGit(git === r.w.entry ? undefined : r.w.entry)}>Git</button>
                        {r.need === 'you' ? <span className="wl-why">{r.keeper}</span> : null}
                        {git === r.w.entry ? <GitFacts r={r} /> : null}
                      </span>
                      <span className="wl-row-actions">{r.kind === 'leftover' ? <RowAction r={r} act={act} /> : null}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {isOpen && c.archived && helpers.length ? (
                <p className="wl-group-note"><Icon name="info" /> Avustajat odottavat keskustelun mukana. Niiden työkopiot vapautuvat itsestään, ja seuraava viesti tekee uuden.</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- 3 Yhteenveto ----
function Summary({rows, act}: {rows: Row[]; act: Act}) {
  const [all, setAll] = useState(false);
  const self = rows.filter((r) => r.need === 'self');
  const waiting = rows.filter((r) => r.kind === 'worker' && r.need === 'you');
  const left = rows.filter((r) => r.kind === 'leftover');
  const working = rows.filter((r) => r.need === 'working');
  const sum = (rs: Row[]) => rs.reduce((n, r) => n + (r.w.size_bytes ?? 0), 0);
  const whole = sum(rows) || 1;
  const parts = [
    {key: 'left', rs: left, label: 'jäänteet'},
    {key: 'you', rs: waiting, label: 'odottaa päätöstä'},
    {key: 'self', rs: self, label: 'vapautuu itsestään'},
    {key: 'working', rs: working, label: 'työssä'},
  ].filter((p) => p.rs.length);
  const latest = self.map((r) => r.releaseAt!).sort((a, b) => +b - +a)[0];
  return (
    <section className="wl-section" data-testid="wl-section">
      <div className="wl-head">
        <h3>Worktreet</h3>
        <button type="button" className="wl-all" aria-expanded={all} data-testid="wl-all" onClick={() => setAll(!all)}>
          {all ? 'Piilota' : `Näytä kaikki ${rows.length}`}
        </button>
      </div>
      <p className="wl-total"><b>{rows.length} työkopiota vie {total(rows)}.</b></p>
      <div className="wl-bar" role="img" aria-label={parts.map((p) => `${p.label} ${bytes(sum(p.rs))}`).join(', ')}>
        {parts.map((p) => <span key={p.key} className={`wl-bar-part ${p.key}`} style={{flexGrow: sum(p.rs) / whole}} />)}
      </div>
      <ul className="wl-sentences" data-testid="wl-sentences">
        {left.length ? (
          <li className="left" data-testid="wl-sentence">
            <span className="wl-dot left" /><span><b>{left.length} jäänne</b>, jota kukaan ei käytä: {left.map((r) => r.label).join(', ')}. Sen muutos jää haaraan.</span>
            <ControlButton data-testid="wl-remove" size="row" variant="secondary" onPress={() => act.remove(left[0])}>Siivoa jäänteet ({left.length})…</ControlButton>
          </li>
        ) : null}
        {waiting.map((r) => (
          <li key={r.w.entry} className="you" data-testid="wl-sentence">
            <span className="wl-dot you" /><span><b>{r.label}</b> odottaa, että agentti yhdistää tai hylkää sen keskustelussa <ConvLink c={r.conv} />{r.conv.archived ? ' (arkistoitu)' : ''}.</span>
            <ControlButton data-testid="wl-open" size="row" variant="secondary" onPress={() => act.open(r.conv)}>{r.conv.archived ? 'Palauta keskustelu' : 'Avaa keskustelu'}</ControlButton>
          </li>
        ))}
        {self.length ? (
          <li className="self" data-testid="wl-sentence">
            <span className="wl-dot self" /><span><b>{self.length} {self.length === 1 ? 'avustaja' : 'avustajaa'}</b> arkistoiduista keskusteluista ({self.map((r) => r.label).join(', ')}) {self.length === 1 ? 'vapautuu' : 'vapautuvat'} itsestään viimeistään {clock(latest)}.</span>
          </li>
        ) : null}
        {working.map((r) => (
          <li key={r.w.entry} className="working" data-testid="wl-sentence">
            <span className="wl-dot working" /><span><b>{r.label}</b> on työssä keskustelussa <ConvLink c={r.conv} />.</span>
          </li>
        ))}
      </ul>
      {all ? (
        <table className="wl-table" data-testid="wl-table">
          <thead><tr><th>Mikä</th><th>Tila</th><th>Git</th><th>Koko</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.w.entry} data-testid="wl-row">
                <td><b>{r.label}</b><br /><span className="wl-kind">{kindWord[r.kind]} · {r.conv.title}</span></td>
                <td>{r.need === 'self' ? release(r) : r.state}</td>
                <td><code>{r.w.name}</code></td>
                <td>{bytes(r.w.size_bytes ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

// ---- The workspace page ----
const noop = () => {};
function Main({direction}: {direction: number}) {
  const [rows, setRows] = useState(ROWS);
  const [removing, setRemoving] = useState<Row>();
  const [status, setStatus] = useState('');
  const act: Act = {
    open: (c) => setStatus(c.archived ? `Palauttaisi keskustelun ${c.title} arkistosta ja avaisi sen; siellä agentti yhdistää tai lopettaa workerin.` : `Avaisi keskustelun ${c.title}.`),
    remove: (r) => setRemoving(r),
  };
  const section = direction === 0 ? <WorktreeCleanup csrf="prototype" workspaceId={WSID} hideWhenEmpty />
    : direction === 1 ? <AttentionFirst rows={rows} act={act} />
      : direction === 2 ? <ByConversation rows={rows} act={act} />
        : <Summary rows={rows} act={act} />;
  const open = [{t: LIVE.title, s: 'Työskentelee'}];
  const page = (
    <div className="ah-state wl-page" data-direction={direction}>
      <div className="ah-workspace-page">
        <header className="ah-workspace-page-head">
          <div className="ah-workspace-page-title"><h1 data-testid="workspace-title">{WS}</h1><p><code>~/src/{WS}</code></p></div>
        </header>
        <section aria-label="Avoimet keskustelut">
          <h2>Avoimet <span>{open.length}</span></h2>
          <ul className="wl-open">{open.map((o) => <li key={o.t}><LinkRow href={`/workspaces/${WSID}`}>{o.t}</LinkRow><span>{o.s}</span></li>)}</ul>
        </section>
        <div className="ah-workspace-git"><span className="ah-workspace-summary">main · ajan tasalla</span></div>
        {status ? <p role="status" className="wl-status" data-testid="wl-status">{status}</p> : null}
        {section}
      </div>
      <details className="ah-workspace-archive">
        <summary>Arkisto · 6</summary>
      </details>
      {removing ? (
        <WorktreeRemoveDialog worktree={removing.w} disposal="remove" busy={false}
          onConfirm={() => { setRows(rows.filter((r) => r !== removing)); setStatus(`${removing.label} poistettu. Haara ${removing.w.branch} säilyy.`); setRemoving(undefined); }}
          onClose={() => setRemoving(undefined)} />
      ) : null}
    </div>
  );
  const model = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/${WSID}?conversation=${m.agentId}`, workspaceId: WSID, workspaceName: WS, activity: 'working',
    activityLabel: 'Työskentelee', controlLabel: '', changedAt: now - 3 * 60000, ...m,
  });
  const running = [model({agentId: LIVE.id, title: LIVE.title, detail: `${WS} · Työskentelee`})];
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Birch" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now" data-testid="rail-running" aria-labelledby="wl-running">
          <h2 className="ah-rail-section-head" id="wl-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
          <ul>{running.map((m) => <AgentNavItem key={m.agentId} {...m} now={now} />)}</ul>
        </section>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_fleetrepo01" />
      <WorkspaceNavRow name={WS} href={`/workspaces/${WSID}`} selected />
      <WorkspaceNavRow name="taskfleet" href="/workspaces/ws_taskfleet01" />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={WS} navigationBadge={0} rail={rail} main={page} />
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
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
        <strong>Worktree-lista · kierros 1</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter initialEntries={[`/workspaces/${WSID}`]}>
          <Main direction={direction} />
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  pickerNav.append(button);
});
document.body.append(pickerNav);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
