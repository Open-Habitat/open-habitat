import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
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
import {BashToolCard} from '../../../../web/src/components/BashToolCard';
import {FileToolCard} from '../../../../web/src/components/FileToolCard';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton, DisclosureButton, Segmented} from '../../../../web/src/components/ControlElements';
import {TextArea} from '../../../../web/src/components/Primitives';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {ContextRing, type ContextUsage} from '../../../../web/src/components/ContextRing';
import {ContextPage} from '../../../../web/src/components/ContextPage';
import type {ContextDetail} from '../../../../web/src/app/contextDetail';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {formatNumber, setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/ViewPanel.css';
import '../../../../web/src/components/QuietSection.css';
import './round.css';


// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-conversation-context-view, round 3. Jari (6.11.2026) found round 2's
// B riffs confusing: it was unclear what each button really does, where the
// "forecasts" came from and what "Ohje riviltä" meant. This round keeps B
// Koko's list and the files-only filter, but every fact and button on the
// page says in plain words what it is and what pressing it does, and
// anything that needs more than one sentence is left out: no forecast
// column, no turn numbers (times instead), no second size bar, no reserve or
// keep-recent jargon. The source of every fact and button is named in the
// issue's result.md, round 3. The axis is how much stays on the page: 1 keeps
// all four real actions, each with its sentence, and folds Pi's own numbers
// (the production sections) below; 2 keeps only compaction and opening a
// text file; 3 is the list with one compact button and no instruction.
const directions = ['1 Selitetty', '2 Lista ja tiivistys', '3 Pelkkä lista'];
const LINES = [
  '1 Selitetty: neljä toimintoa (Tiivistä nyt ohjeella, Palaa ennen tätä, Lue uudelleen, Avaa), jokaisen vieressä lause siitä, mitä se tekee; Pi:n omat luvut avattavina lopussa.',
  '2 Lista ja tiivistys: sama lista, mutta toimintoina vain Tiivistä nyt ohjeella ja tekstitiedoston Avaa; ei Pi:n omia lukuja.',
  '3 Pelkkä lista: luku ja lista; ainoa nappi on Tiivistä nyt ilman ohjetta, eikä riveillä ole nappeja.',
];
const D1 = 0, D2 = 1, D3 = 2;

// ---------- Synthetic conversation: Aino Virtanen, Contoso, "Keskon viikkoraportti" ----------

const WINDOW = 200000, RESERVE = 16384, KEEP = 20000;
const THRESHOLD = WINDOW - RESERVE;
type Src = 'sp' | 'od' | 'ws' | 'mail' | 'cal' | 'cmd';
const SRC: Record<Src, {label: string; icon: IconName}> = {
  sp: {label: 'SharePoint', icon: 'folder'},
  od: {label: 'OneDrive', icon: 'user'},
  ws: {label: 'Työtila raportit', icon: 'file'},
  mail: {label: 'Sähköposti', icon: 'mail'},
  cal: {label: 'Kalenteri', icon: 'calendar'},
  cmd: {label: 'Komento', icon: 'terminal'},
};
type Verb = 'luki' | 'muutti' | 'loi' | 'ajoi';
/** One tool call on the item; `lines` is what Pi's write or edit result says about the change. */
type Op = {verb: Verb; turn: number; at: string; tokens: number; lines?: string};
type Item = {id: string; src: Src; name: string; file: boolean; text?: boolean; ops: Op[]};
const ITEMS: Item[] = [
  {id: 'plan', src: 'sp', file: true, name: 'Projektisuunnitelma.docx', ops: [{verb: 'luki', turn: 1, at: '10.02', tokens: 3400}, {verb: 'luki', turn: 8, at: '10.20', tokens: 3400}]},
  {id: 'vko44', src: 'sp', file: true, name: 'Viikkoraportti vko 44.docx', ops: [{verb: 'luki', turn: 1, at: '10.02', tokens: 2100}]},
  {id: 'pk', src: 'sp', file: true, name: 'Ohjausryhmän pöytäkirjat 2026.pdf', ops: [{verb: 'luki', turn: 2, at: '10.05', tokens: 96400}]},
  {id: 'hinnasto', src: 'sp', file: true, name: 'Hinnasto 2026.xlsx', ops: [{verb: 'luki', turn: 3, at: '10.08', tokens: 18400}]},
  {id: 'script', src: 'ws', file: true, text: true, name: 'make_report.py', ops: [{verb: 'loi', turn: 4, at: '10.11', tokens: 100}, {verb: 'muutti', turn: 5, at: '10.15', tokens: 100, lines: '+6 −2 riviä'}]},
  {id: 'run0', src: 'cmd', file: false, name: 'python3 make_report.py --template vko44', ops: [{verb: 'ajoi', turn: 5, at: '10.14', tokens: 12600}]},
  {id: 'mail1', src: 'mail', file: false, name: 'Re: Varmenteiden vaihto', ops: [{verb: 'luki', turn: 6, at: '10.16', tokens: 2600}]},
  {id: 'cal', src: 'cal', file: false, name: 'Pilotti, Prisma Kannelmäki', ops: [{verb: 'luki', turn: 7, at: '10.18', tokens: 600}]},
  {id: 'loki', src: 'ws', file: true, text: true, name: 'Kuormitustesti-loki.csv', ops: [{verb: 'luki', turn: 9, at: '10.31', tokens: 31200}]},
  {id: 'yht', src: 'ws', file: true, text: true, name: 'Kuormitustesti-yhteenveto.md', ops: [{verb: 'loi', turn: 10, at: '10.35', tokens: 200, lines: '38 riviä'}]},
  {id: 'aq', src: 'sp', file: true, text: true, name: 'Avoimet kysymykset.md', ops: [{verb: 'luki', turn: 11, at: '10.39', tokens: 1100}, {verb: 'muutti', turn: 13, at: '10.43', tokens: 100, lines: '+4 riviä'}]},
  {id: 'muist', src: 'od', file: true, text: true, name: 'Kesko-palaveri 4.11.md', ops: [{verb: 'luki', turn: 11, at: '10.39', tokens: 900}]},
  {id: 'vko45', src: 'sp', file: true, name: 'Viikkoraportti vko 45.docx', ops: [{verb: 'luki', turn: 12, at: '10.42', tokens: 2300}]},
  {id: 'run1', src: 'cmd', file: false, name: 'python3 make_report.py --out "…vko 45.docx"', ops: [{verb: 'ajoi', turn: 12, at: '10.42', tokens: 800}]},
  {id: 'mail2', src: 'mail', file: false, name: 'Varmenteet: aikataulu', ops: [{verb: 'luki', turn: 14, at: '10.47', tokens: 2900}]},
  {id: 'test', src: 'cmd', file: false, name: 'python3 load_test.py --kassat 60', ops: [{verb: 'ajoi', turn: 15, at: '10.50', tokens: 24800}]},
  {id: 'run2', src: 'cmd', file: false, name: 'python3 make_report.py --out "…vko 45.docx"', ops: [{verb: 'ajoi', turn: 16, at: '10.55', tokens: 700}]},
];
const TURNS: {n: number; at: string; ask: string; ctx: number}[] = [
  {n: 1, at: '10.02', ask: 'Tee Keskon viikkoraportti vko 45 samaan pohjaan kuin vko 44.', ctx: 34400},
  {n: 2, at: '10.05', ask: 'Mitä ohjausryhmä päätti pilotista? Pöytäkirjat ovat Kokousmuistioissa.', ctx: 130800},
  {n: 3, at: '10.08', ask: 'Hae hinnastosta kuormitustestin työmäärän hinta.', ctx: 151300},
  {n: 4, at: '10.11', ask: 'Tee raportille skripti, joka täyttää pohjan.', ctx: 155900},
  {n: 5, at: '10.14', ask: 'Aja skripti vko 44:n tiedoilla testiksi.', ctx: 171200},
  {n: 6, at: '10.16', ask: 'Lue Keskon IT:n viesti varmenteista.', ctx: 175600},
  {n: 7, at: '10.18', ask: 'Lisää kalenterista pilotin päivät.', ctx: 177100},
  {n: 8, at: '10.20', ask: 'Tarkista projektisuunnitelman vaiheet vielä kerran.', ctx: 184900},
  {n: 9, at: '10.31', ask: 'Kuormitustesti ajettiin eilen, lue tulokset lokista.', ctx: 67400},
  {n: 10, at: '10.35', ask: 'Tee tuloksista lyhyt yhteenveto työtilaan.', ctx: 72100},
  {n: 11, at: '10.39', ask: 'Lue avoimet kysymykset ja tiistain palaverimuistiinpanoni.', ctx: 77900},
  {n: 12, at: '10.42', ask: 'Kirjoita vko 45:n raportti.', ctx: 86300},
  {n: 13, at: '10.43', ask: 'Lisää avoimiin kysymyksiin, mitä niistä puuttuu.', ctx: 88200},
  {n: 14, at: '10.47', ask: 'Hae Keskon IT:n viimeisin viesti varmenteista.', ctx: 93600},
  {n: 15, at: '10.50', ask: 'Aja kuormitustesti uudelleen 60 kassalla.', ctx: 121700},
  {n: 16, at: '10.55', ask: 'Päivitä raporttiin 60 kassan tulos.', ctx: 124900},
];
const at = (n: number) => TURNS.find((t) => t.n === n)!.at;
const SUMMARY1 = `## Tavoite
Keskon kassajärjestelmäprojektin viikkoraportti vko 45 samaan pohjaan kuin vko 44.

## Tehty
- Ohjausryhmä 29.10.: pilotti kolmessa myymälässä vko 47, varakassa tarpeen
- Kuormitustestin työmäärä hinnastosta: 18 h asiantuntijatyötä
- make_report.py täyttää pohjan; testattu vko 44:n tiedoilla
- Keskon IT: varmenteiden vaihto ennen joulukuuta, omistaja auki
- Pilotti kalenterissa: Prisma Kannelmäki vko 47 ma–pe

## Seuraavaksi
- Kuormitustestin tulokset raporttiin`;

// ---------- Store: the compaction, the rewind, the composer draft ----------

type Phase = 'known' | 'compacting' | 'after';
const store = {phase: 'known' as Phase, keptFrom: 8, instruction: '', rewound: 0, draft: '', toast: '', details: false};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
let timer = 0;
function resetStore() {
  window.clearTimeout(timer);
  Object.assign(store, {phase: 'known', keptFrom: 8, instruction: '', rewound: 0, draft: '', toast: '', details: false});
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

/** After a rewind before turn n, turns n… are no longer on the conversation's active line. */
const lastTurn = () => (store.rewound ? store.rewound - 1 : 16);
const turnsNow = () => TURNS.filter((t) => t.n <= lastTurn());
const opsNow = (it: Item) => it.ops.filter((o) => o.turn <= lastTurn());
const onBranch = (it: Item) => opsNow(it).length > 0;
/** What the model sees of the item now: its outputs on or after the first kept turn. */
const inContext = (it: Item) => opsNow(it).filter((o) => o.turn >= store.keptFrom).reduce((a, o) => a + o.tokens, 0);
const isIn = (it: Item) => opsNow(it).some((o) => o.turn >= store.keptFrom);
/**
 * Pi's own cut (prepareCompaction with keepRecentTokens 20 000): which turns
 * a compaction now would summarize. None right after a compaction, when Pi
 * refuses with "Already compacted" until the conversation continues.
 */
const next = () => store.phase !== 'known' ? null
  : store.rewound ? {from: 8, through: 11, keptFrom: 12} : {from: 8, through: 14, keptFrom: 15};
const lastCompaction = () => (store.phase === 'after' ? '10.58' : '10.21');

const fmt = (n: number) => formatNumber(Math.round(n));
const SYS = 19200, TOOLS = 2400;
const measured = () => (store.rewound ? 93600 : 124900);
const summaryTokens = () => (store.phase === 'after' ? 6900 : 5800);
const conversationNow = () => (store.phase === 'after' ? {user: 200, assistant: 1600, thinking: 2100, tool_calls: 400}
  : store.rewound ? {user: 1200, assistant: 7600, thinking: 9900, tool_calls: 2400}
    : {user: 1400, assistant: 9800, thinking: 12600, tool_calls: 3100});
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const toolOutput = () => ITEMS.reduce((a, it) => a + inContext(it), 0);
/** Pi's estimate after a compaction, until the next reply measures it. */
const estimate = () => SYS + TOOLS + summaryTokens() + sum(conversationNow()) + toolOutput();
const total = () => (store.phase === 'known' ? measured() : estimate());

// ---------- What the production page reads (shown in direction 1 under "Pi:n omat luvut") ----------

/** Helsinki 10.02 on 6.11. is 08.02 UTC. */
const utc = (hm: string) => { const [h, m] = hm.split('.'); return `2026-11-06T${String(Number(h) - 2).padStart(2, '0')}:${m}:00.000Z`; };
const callLabel = (it: Item, o: Op) => (it.src === 'cmd' ? `bash ${it.name}` : o.verb === 'luki' ? `read ${it.name}` : o.verb === 'loi' ? `write ${it.name}` : `edit ${it.name}`);
function detail(): ContextDetail {
  const after = store.phase === 'after';
  const turns = turnsNow().map((t) => ({n: t.n, at: utc(t.at), request: t.ask, replies: 2, context_tokens: t.ctx, input: 600, output: 1400, cache_read: t.ctx - 3000, cache_write: 2400, cost: 0}));
  const comp1 = {at: '2026-11-06T08:21:00.000Z', after_turn: 8, kept_from_turn: 8, tokens_before: 184900, summary: SUMMARY1, summary_truncated: false, summary_tokens: 5800,
    read_files: [] as string[], modified_files: ['make_report.py'], tokens_after: 34100};
  const comp2 = {at: '2026-11-06T08:58:00.000Z', after_turn: 16, kept_from_turn: 15, tokens_before: 124900, summary: `${SUMMARY1}\n- Kuormitustesti 40 kassalle: 0,8 s; raportti vko 45 kirjoitettu`, summary_truncated: false, summary_tokens: 6900,
    read_files: ['Kuormitustesti-loki.csv', 'Kesko-palaveri 4.11.md'], modified_files: ['make_report.py', 'Kuormitustesti-yhteenveto.md', 'Avoimet kysymykset.md']};
  const outputs = ITEMS.flatMap((it) => opsNow(it).filter((o) => o.turn >= store.keptFrom).map((o) => ({name: callLabel(it, o), turn: o.turn, tokens: o.tokens}))).sort((a, b) => b.tokens - a.tokens).slice(0, 5);
  const n = next();
  return {
    schema_version: 1, agent_id: 'pi:kesko', harness: 'pi', model: 'anthropic/claude-sonnet-5',
    ...(after ? {} : {measured_tokens: measured()}),
    estimated_tokens: total(), trailing_tokens: 0,
    settings: {enabled: true, reserve_tokens: RESERVE, keep_recent_tokens: KEEP},
    parts: {instructions: SYS, tools: TOOLS, summary: summaryTokens(), conversation: sum(conversationNow()), tool_output: toolOutput(), attachments: 0},
    instructions: [{name: 'skills', tokens: 10700}, {name: 'project_context', tokens: 4800}, {name: 'open_habitat', tokens: 2100}, {name: 'rules', tokens: 900}, {name: 'preamble', tokens: 400}, {name: 'prompt', tokens: 300}],
    tools: [{name: 'bash', tokens: 620}, {name: 'edit', tokens: 520}, {name: 'read', tokens: 480}, {name: 'process', tokens: 400}, {name: 'write', tokens: 380}],
    conversation: {...conversationNow(), other: 0},
    largest_outputs: outputs,
    compactions: after ? [comp1, comp2] : [comp1],
    next_compaction: n ? {from_turn: n.from, through_turn: n.through, kept_from_turn: n.keptFrom, split_turn: false, summarized_tokens: n.keptFrom === 15 ? 61800 : 48600} : null,
    turns, turns_omitted: 0,
  };
}
const usage = (): ContextUsage => store.phase === 'known'
  ? {phase: 'known', tokens: measured(), window: WINDOW, autoCompaction: true, reserve: RESERVE, model: 'Claude Sonnet 5'}
  : {phase: store.phase, window: WINDOW, autoCompaction: true, reserve: RESERVE, model: 'Claude Sonnet 5'};

function compactNow() {
  store.phase = 'compacting'; notify();
  timer = window.setTimeout(() => { store.phase = 'after'; store.keptFrom = 15; notify(); }, 2500);
}
function askToRead(it: Item) {
  store.draft = it.src === 'mail' ? `Lue uudelleen viesti "${it.name}".` : it.src === 'cal' ? `Katso uudelleen kalenterista ${it.name}.` : `Lue uudelleen ${it.name}.`;
  notify();
  toast('Pyyntö on viestikentässä. Mitään ei lähetetä ennen kuin painat Lähetä.');
}

// ---------- The rows ----------

const noop = () => {};
const T0 = Date.UTC(2026, 10, 6, 8, 0);
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'raportit',
};
const times = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ja ${xs[xs.length - 1]}` : xs[0]);
/** "luki klo 10.02 ja 10.20, muutti klo 10.43 (+4 riviä)": what the agent did with it and when. */
function didText(it: Item) {
  const ops = opsNow(it);
  const verbs = ops.map((o) => o.verb).filter((v, i, a) => a.indexOf(v) === i);
  return verbs.map((v) => {
    const os = ops.filter((o) => o.verb === v);
    const lines = os.map((o) => o.lines).filter(Boolean).join(', ');
    return `${v} klo ${times(os.map((o) => o.at))}${lines ? ` (${lines})` : ''}`;
  }).join(', ');
}
type Row = {id: string; name: string; meta: string; tokens: number; item?: Item; mono?: boolean};
function itemRow(it: Item): Row {
  const where = it.src === 'cmd' ? `Komennon tuloste · ${didText(it)}` : `${SRC[it.src].label} · ${didText(it)}`;
  return {id: it.id, name: it.name, meta: where, tokens: inContext(it), item: it, mono: it.src === 'cmd'};
}
function partRows(): Row[] {
  const after = store.phase === 'after';
  return [
    {id: 'talk', name: 'Viestit ja agentin ajattelu', meta: `Viestisi, agentin vastaukset ja ajattelu klo ${at(store.keptFrom)} alkaen`, tokens: sum(conversationNow())},
    {id: 'sys', name: 'Agentin ohjeet ja työkalut', meta: 'AGENTS.md, skillit ja työkalujen kuvaukset; mukana aina', tokens: SYS + TOOLS},
    {id: 'sum', name: 'Yhteenveto aiemmista viesteistä', meta: `Kirjoitettu klo ${lastCompaction()}; korvaa viestit klo 10.02–${after ? '10.47' : '10.18'}`, tokens: summaryTokens()},
  ];
}
const bySize = (x: Row, y: Row) => y.tokens - x.tokens;
const seenRows = (files: boolean) => [...ITEMS.filter((it) => isIn(it) && (!files || it.file)).map(itemRow), ...(files ? [] : partRows())].sort(bySize);
const summaryOnlyRows = (files: boolean) => ITEMS.filter((it) => onBranch(it) && !isIn(it) && (!files || it.file)).map(itemRow);

function ItemIcon({it}: {it: Item}) {
  return <span className="cx-src" aria-hidden="true"><Icon name={SRC[it.src].icon} /></span>;
}
function Filter({value, onChange}: {value: 'all' | 'files'; onChange: (v: 'all' | 'files') => void}) {
  const files = ITEMS.filter((it) => it.file && onBranch(it)).length;
  return (
    <Segmented data-testid="files-filter" label="Näytä" value={value} onChange={onChange} size="row"
      options={[{id: 'all', label: 'Kaikki'}, {id: 'files', label: `Vain tiedostot ${files}`}]} />
  );
}

/** The row's own buttons; which exist depends on the direction. */
function RowActions({r, dir, onRewind}: {r: Row; dir: number; onRewind: (n: number) => void}) {
  const it = r.item;
  const n = next();
  if (!it || dir === D3) return null;
  const first = Math.min(...opsNow(it).map((o) => o.turn));
  return (
    <>
      {dir === D1 && isIn(it) && n && first >= n.keptFrom && r.tokens >= 5000 && !store.rewound ? (
        <ControlButton data-testid={`rewind-${it.id}`} size="inline" variant="secondary" onPress={() => onRewind(first)}><Icon name="restore" />Palaa ennen tätä…</ControlButton>
      ) : null}
      {dir === D1 && !isIn(it) && it.src !== 'cmd' ? (
        <ControlButton data-testid={`reread-${it.id}`} size="inline" variant="quiet" onPress={() => askToRead(it)}><Icon name="refresh" />Lue uudelleen</ControlButton>
      ) : null}
      {it.text ? <ControlButton data-testid={`open-${it.id}`} size="inline" variant="quiet" onPress={() => toast(`${it.name} avautuu työtilan editoriin.`)}><Icon name="editor" />Avaa</ControlButton> : null}
    </>
  );
}
function Rows({rows, dir, onRewind, testid}: {rows: Row[]; dir: number; onRewind: (n: number) => void; testid: string}) {
  return (
    <ul className="cx3-rows" data-testid={testid}>
      {rows.map((r) => (
        <li key={r.id} className="cx3-row" data-testid={`row-${r.id}`} data-in={r.item ? String(isIn(r.item)) : 'true'}>
          <span className="cx3-name">
            <span className="cx-bname">{r.item ? <ItemIcon it={r.item} /> : <span className="cx-src cx-src-part" aria-hidden="true"><Icon name={r.id === 'sys' ? 'gear' : r.id === 'sum' ? 'recap' : 'message'} /></span>}<span className={r.mono ? 'mono' : undefined}>{r.name}</span></span>
            <span className="cx-meta">{r.meta}</span>
          </span>
          <span className="cx3-size">{r.item && !isIn(r.item) ? '' : fmt(r.tokens)}</span>
          <span className="cx3-act"><RowActions r={r} dir={dir} onRewind={onRewind} /></span>
        </li>
      ))}
      {!rows.length ? <li className="cx3-row cx3-empty"><span className="cx-fine">Ei tiedostoja tässä ryhmässä.</span></li> : null}
    </ul>
  );
}

// ---------- The section: the number, the list, the buttons ----------

function Section({dir, onCompact, onRewind}: {dir: number; onCompact: () => void; onRewind: (n: number) => void}) {
  const s = useStore();
  const [filter, setFilter] = useState<'all' | 'files'>('all');
  const files = filter === 'files';
  const t = total(), estimated = s.phase !== 'known';
  const seen = seenRows(files), gone = summaryOnlyRows(files);
  return (
    <section className="cx3" data-testid="cx3-section" aria-label="Mihin konteksti kuluu">
      <p className="cx3-lead">Konteksti on kaikki, mitä agentti näkee joka kerta, kun se vastaa viestiisi.</p>
      <p className="cx3-big" data-testid="cx3-total">
        {estimated ? <>noin {fmt(t)} <span>/ {fmt(WINDOW)} tokenia</span></> : <>{Math.round((t / WINDOW) * 100)} % <span>{fmt(t)} / {fmt(WINDOW)} tokenia</span></>}
      </p>
      <div className="cx3-bar" aria-hidden="true"><i style={{width: `${(t / WINDOW) * 100}%`}} /><b style={{left: `${(THRESHOLD / WINDOW) * 100}%`}} /></div>
      <p className="cx-fine">
        Token on noin neljä merkkiä tekstiä. Kun käyttö ylittää viivan ({fmt(THRESHOLD)} tokenia), agentti tiivistää keskustelun itse.
        {estimated && s.phase === 'after' ? ' Luku on arvio, kunnes agentti vastaa seuraavan kerran.' : ''}
      </p>

      {s.rewound ? <p className="cx-marksbar done" data-testid="rewound" role="status"><Icon name="restore" /><span>Palattu ennen klo {at(s.rewound)} viestiä. Myöhemmät viestit ovat tallessa keskustelussa yhtenä rivinä.</span></p> : null}
      {s.phase === 'compacting' ? <p className="cx-marksbar" data-testid="compacting" role="status"><span className="cx-spin" aria-hidden="true" />Agentti tiivistää keskustelua…</p>
        : s.phase === 'after' ? <p className="cx-marksbar done" data-testid="compacted" role="status"><Icon name="check" /><span>Tiivistetty klo 10.58. Uuden tiivistyksen voi pyytää, kun keskustelu on jatkunut.</span></p>
          : (
            <div className="cx3-compact" data-testid="compact-row">
              <ControlButton data-testid="compact-open" size="row" variant="secondary" onPress={onCompact}>Tiivistä nyt…</ControlButton>
              <p className="cx-fine">Agentti kirjoittaa vanhimmista viesteistä yhteenvedon ja vapauttaa niiden tilan. Uusimmat viestit jäävät ennalleen.</p>
            </div>
          )}

      <div className="cx3-head">
        <h3>Mihin tila kuluu</h3>
        <Filter value={filter} onChange={setFilter} />
      </div>
      {files ? <p className="cx-fine" data-testid="files-note">Tiedostot, jotka agentti luki tai muutti tässä keskustelussa. Agentin skriptillä kirjoittama tiedosto ei näy muutettuna.</p> : null}
      {dir === D1 ? (
        <dl className="cx3-legend" data-testid="legend">
          <div><dt>Palaa ennen tätä</dt><dd>Keskustelu palaa kohtaan ennen tätä viestiä, jolloin sen tuloste lähtee agentin näkyvistä.</dd></div>
          <div><dt>Lue uudelleen</dt><dd>Kirjoittaa viestikenttään pyynnön lukea tämä uudelleen; mitään ei lähetetä ennen kuin painat Lähetä.</dd></div>
          <div><dt>Avaa</dt><dd>Avaa tiedoston työtilan editoriin.</dd></div>
        </dl>
      ) : dir === D2 ? (
        <dl className="cx3-legend" data-testid="legend"><div><dt>Avaa</dt><dd>Avaa tiedoston työtilan editoriin.</dd></div></dl>
      ) : null}

      <div className="cx3-group" data-testid="group-seen">
        <h4><span>Agentti näkee kokonaan</span><span className="cx3-tok">Tokenia</span></h4>
        <p className="cx-fine">Nämä agentti näkee sanasta sanaan joka kerta, kun se vastaa.</p>
        <Rows rows={seen} dir={dir} onRewind={onRewind} testid="rows-seen" />
      </div>
      <div className="cx3-group" data-testid="group-summary">
        <h4><span>Vain yhteenvedossa</span></h4>
        <p className="cx-fine">Agentti luki nämä ennen klo {lastCompaction()} tehtyä tiivistystä. Ne eivät enää vie tilaa, ja agentti tietää niistä vain sen, mitä yhteenvetoon kirjoitettiin.</p>
        <Rows rows={gone} dir={dir} onRewind={onRewind} testid="rows-summary" />
      </div>
      <p className="cx-fine">Rivien koot ovat arvioita, joten ne eivät laske yhteen tarkalleen kokonaislukuun.</p>

      {dir === D1 ? (
        <div className="cx3-details">
          <DisclosureButton data-testid="details-toggle" aria-expanded={s.details} onPress={() => { store.details = !store.details; notify(); }}>
            <Icon name={s.details ? 'down' : 'forward'} />{s.details ? 'Piilota Pi:n omat luvut' : 'Näytä Pi:n omat luvut'}
          </DisclosureButton>
          <p className="cx-fine">Pi:n tekninen erittely samasta kontekstista: osat, tiivistykset ja vuorot.</p>
        </div>
      ) : null}
    </section>
  );
}

/** Before Pi's compaction: what it summarizes, what stays, and (1, 2) what the summary must keep. */
function CompactDialog({open, dir, onClose}: {open: boolean; dir: number; onClose: () => void}) {
  const s = useStore();
  const n = next();
  if (!n) return null;
  const stays = ITEMS.filter((it) => opsNow(it).some((o) => o.turn >= n.keptFrom));
  const keptTokens = (it: Item) => opsNow(it).filter((o) => o.turn >= n.keptFrom).reduce((a, o) => a + o.tokens, 0);
  const after = SYS + TOOLS + 6900 + 4300 + stays.reduce((a, it) => a + keptTokens(it), 0);
  return (
    <ModalOverlay className="ah-overlay" isOpen={open} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal cx-modal">
        <AriaDialog className="ah-dialog" data-testid="compact-dialog" aria-label="Tiivistä keskustelu nyt">
          <Heading slot="title">Tiivistä keskustelu nyt</Heading>
          <p className="s-desc">Agentti kirjoittaa viesteistä klo {at(n.from)}–{at(n.through)} yhteenvedon, ja niiden sisältö lähtee sen näkyvistä.</p>
          <p className="s-desc">Viestit klo {at(n.keptFrom)} alkaen jäävät ennalleen, koska agentti jättää aina uusimmat noin {fmt(KEEP)} tokenia. Niissä on myös:</p>
          <ul className="cx-stay">{stays.map((it) => <li key={it.id}><ItemIcon it={it} /><span className={it.src === 'cmd' ? 'mono' : undefined}>{it.name}</span><span className="cx-num">{fmt(keptTokens(it))}</span></li>)}</ul>
          {dir !== D3 ? (
            <TextArea data-testid="compact-instruction-field" label="Mitä yhteenvedossa pitää säilyttää? (valinnainen)" rows={2} value={s.instruction}
              onChange={(v) => { store.instruction = v; notify(); }} placeholder="Esim. kuormitustestin luvut tarkkoina" />
          ) : null}
          <p className="cx-fine">Tiivistyksen jälkeen konteksti on noin {fmt(after)} tokenia. Vanhat viestit jäävät keskusteluun luettaviksi.</p>
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" onPress={onClose}>Peruuta</ControlButton>
            <ControlButton data-testid="compact-confirm" size="row" variant="primary" onPress={() => { onClose(); compactNow(); }}>Tiivistä</ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
/** The agreed rewind (rewind-conversation), opened from a large recent output in direction 1. */
function RewindDialog({turn, onClose, onRewind}: {turn: number; onClose: () => void; onRewind: () => void}) {
  const t = TURNS.find((x) => x.n === turn);
  const gone = ITEMS.filter((it) => it.ops.some((o) => o.turn >= turn));
  return (
    <ModalOverlay className="ah-overlay" isOpen={!!turn} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal cx-modal">
        <AriaDialog className="ah-dialog" data-testid="rewind-dialog" aria-label="Palaa ennen tätä">
          <Heading slot="title">Palaa ennen klo {t?.at} viestiä</Heading>
          {t ? <p className="s-desc">Viestisi "{t.ask}" palaa viestikenttään muokattavaksi, ja agentti lakkaa näkemästä tätä ja myöhempiä tulosteita:</p> : null}
          <ul className="cx-stay">{gone.map((it) => <li key={it.id}><ItemIcon it={it} /><span className={it.src === 'cmd' ? 'mono' : undefined}>{it.name}</span><span className="cx-num">{fmt(it.ops.filter((o) => o.turn >= turn).reduce((a, o) => a + o.tokens, 0))}</span></li>)}</ul>
          <p className="cx-fine">Myöhemmät viestit eivät katoa: ne jäävät keskusteluun yhdeksi riviksi, josta niihin voi palata. Konteksti on sen jälkeen {fmt(TURNS.find((x) => x.n === turn - 1)?.ctx ?? 0)} tokenia.</p>
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" onPress={onClose}>Peruuta</ControlButton>
            <ControlButton data-testid="rewind-confirm" size="row" variant="primary" onPress={onRewind}>Palaa</ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Put the round's section after an element of the production page. */
function Into({after, children}: {after: string; children: React.ReactNode}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let el: HTMLElement | null = null;
    const place = () => {
      const anchor = document.querySelector(after);
      if (!anchor || (el && el.isConnected && el.previousElementSibling === anchor)) return;
      el ??= document.createElement('div');
      el.className = 'cx-into';
      anchor.after(el);
      setSlot(el);
    };
    place();
    const o = new MutationObserver(place);
    o.observe(document.querySelector('.cx-stage') ?? document.body, {childList: true, subtree: true});
    return () => { o.disconnect(); el?.remove(); };
  }, [after]);
  return slot ? createPortal(children, slot) : null;
}

// ---------- The conversation behind the page ----------

const tool = (key: string, name: string, target: string, body: React.ReactNode): TurnStep => ({kind: 'tool', key, node: <PiToolUse name={name} state="succeeded" targetText={target}>{body}</PiToolUse>});
const say = (key: string, text: string): TurnStep => ({kind: 'text', key, text, node: <Markdown text={text} />});
const LOAD = 'kassat=60 kesto=600s\nvaste_ka=1,12s p95=1,84s virheet=0\n…\n(tuloste 4 812 riviä)';
function turnItems() {
  const out: {id: string; kind: string; content: React.ReactNode}[] = [];
  for (const t of turnsNow().slice(-3)) {
    out.push({id: `u${t.n}`, kind: 'user', content: <UserMessage sourceText={t.ask} onCopy={noop} time={t.at}><Markdown text={t.ask} /></UserMessage>});
    const steps: TurnStep[] =
      t.n === 14 ? [tool('m', 'bash', 'himalaya message read 4127', <BashToolCard command="himalaya message read 4127" output={'Lähettäjä: Keskon IT\nAihe: Varmenteet: aikataulu\n\nVaihto tehdään 2.12. klo 6–8…'} />), say('s', 'Keskon IT vaihtaa varmenteet **2.12. klo 6–8**.')]
        : t.n === 15 ? [tool('t', 'bash', 'python3 load_test.py --kassat 60', <BashToolCard command="python3 load_test.py --kassat 60" output={LOAD} />), say('s', '60 kassalla keskimääräinen vasteaika on **1,12 s** (p95 1,84 s).')]
          : t.n === 16 ? [tool('w', 'bash', 'python3 make_report.py --out …vko 45.docx', <BashToolCard command="python3 make_report.py --out …vko 45.docx" output="Kirjoitettu: Viikkoraportti vko 45.docx (40 kt)" />), say('s', 'Päivitin raporttiin 60 kassan tuloksen.')]
            : t.n === 13 ? [tool('e', 'edit', 'Avoimet kysymykset.md', <FileToolCard name="edit" argumentsText="{}" output="+4 riviä" />), say('s', 'Lisäsin neljä puuttuvaa kohtaa.')]
              : [tool('r', 'read', 'Avoimet kysymykset.md', <FileToolCard name="read" argumentsText="{}" output="# Avoimet kysymykset" />), say('s', 'Selvä.')];
    out.push({id: `a${t.n}`, kind: 'assistant', content: <AgentTurn steps={steps.map((x, i) => ({...x, at: T0 + i * 30000}))} startedAt={T0} duration="1 min 4 s" />});
  }
  return out;
}

function Main({direction}: {direction: number}) {
  const s = useStore();
  const [page, setPage] = useState(true);
  const [compactOpen, setCompactOpen] = useState(false);
  const [rewindTurn, setRewindTurn] = useState(0);
  const title = 'Keskon viikkoraportti';
  const now = Date.now();
  const convs = [{id: 'kesko', title, since: 3}, {id: 'valio', title: 'Valion vaatimukset', since: 1500}];
  const model = (c: {id: string; title: string; since: number}): AgentNavModel => ({
    agentId: c.id, href: `/workspaces/ws_r?conversation=${c.id}`, title: c.title, workspaceId: 'ws_r', workspaceName: 'raportit',
    changedAt: now - c.since * 60000, activity: 'waiting', activityLabel: 'Odottaa viestiä', controlLabel: '',
    detail: 'raportit · Odottaa viestiä', selected: c.id === 'kesko',
  });
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Contoso" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Aino Virtanen" onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now ah-quiet" aria-labelledby="cx-quiet">
          <h2 className="ah-rail-section-head ah-quiet-head">
            <button type="button" className="ah-quiet-fold" aria-expanded="true">
              <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
              <span id="cx-quiet">Hiljaiset</span><span className="ah-rail-count">{convs.length}</span>
            </button>
          </h2>
          <ul>{convs.map((c) => <AgentNavItem key={c.id} {...model(c)} now={now} />)}</ul>
        </section>
      }>
      <WorkspaceNavRow name="raportit" href="/workspaces/ws_r" />
      <WorkspaceNavRow name="tarjoukset" href="/workspaces/ws_t" />
    </WorkspaceRail>
  );
  const main = (
    <div className="ah-state cx-main" data-details={s.details ? 'open' : undefined}>
      <ConversationFrame className={page ? 'ah-frame-context' : undefined}>
        <AgentHeader title={title} workspaceLabel="raportit" workspaceHref="/workspaces/ws_r"
          activityLabel={s.phase === 'compacting' ? 'Tiivistää' : ''} activityAnimated={s.phase === 'compacting'} activityKind={s.phase === 'compacting' ? 'working' : 'neutral'}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop}
          contextIndicator={<ContextRing usage={usage()} open={page} onToggle={() => setPage(!page)} />} />
        {page ? <ContextPage detail={{state: 'ready', detail: detail()}} usage={usage()} title={title} onClose={() => setPage(false)} /> : null}
        <ConversationStream>
          <ConversationTimeline key={`${s.rewound}-${s.phase}`} state="ready" items={turnItems()} historyMode="pagedAccessible" onJumpToLatest={noop} />
        </ConversationStream>
        <Composer value={s.draft} onChange={(v) => { store.draft = v; notify(); }} activity="idle" selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} sources={sources} csrf="prototype"
          modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
      </ConversationFrame>
      {page ? <Into after="#ah-cd-title"><Section dir={direction} onCompact={() => setCompactOpen(true)} onRewind={setRewindTurn} /></Into> : null}
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} rail={railView} main={main} />
      <CompactDialog open={compactOpen} dir={direction} onClose={() => setCompactOpen(false)} />
      <RewindDialog turn={rewindTurn} onClose={() => setRewindTurn(0)} onRewind={() => {
        const t = TURNS.find((x) => x.n === rewindTurn)!;
        store.rewound = rewindTurn; store.draft = t.ask; setRewindTurn(0); notify();
        toast(`Klo ${t.at} viestisi on viestikentässä muokattavaksi.`);
      }} />
      {s.toast ? <p className="cx-toast" role="status">{s.toast}</p> : null}
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
    <div className={`cx-review variant-${direction}`} data-direction={direction}>
      <header className="cx-bar" ref={bar}>
        <strong>Keskustelun konteksti · kierros 3</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="cx-reset" onClick={() => { resetStore(); setGeneration((g) => g + 1); }}>Alusta</button>
        <ol className="cx-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="cx-stage">
        <PiModelsProvider key={generation} enabled>
          <MemoryRouter key={generation} initialEntries={['/workspaces/ws_r?conversation=kesko']}>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
