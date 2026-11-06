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
import {ControlButton, Segmented} from '../../../../web/src/components/ControlElements';
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

// proto-conversation-context-view, round 2. Jari (6.11.2026) chose round 1's
// B Koko (the production context page grows a "where the context goes" list),
// but its controls promised what Pi cannot do: drop one item from the context.
// This round uses only what exists or can be built on Pi's own mechanisms
// (result.md, round 2): Pi's estimate of every tool output in the projection,
// Pi's own compaction cut forecast, RPC `compact` with custom instructions,
// a message draft asking the agent to read again, the editor for text files,
// and the agreed "Palaa tähän" rewind (rewind-conversation; Pi's navigateTree)
// as the only way to take a recent output out of the model's view. Every riff
// has a "Vain tiedostot" filter. The three riffs differ in how the steering is
// offered: B1 tells each row's fate in a compaction now, B2 writes the
// compaction's instruction from the rows, B3 splits the list at Pi's cut.
const directions = ['Nyt', 'B1 Ennuste', 'B2 Ohje riviltä', 'B3 Raja'];
const LINES = [
  'Nyt: tuotannon Konteksti-sivu renkaasta: osat, tiivistykset ja vuorot. Ei tiedostolistaa eikä ohjausta.',
  'B1 Ennuste: jokaisella osalla on sarake "Jos tiivistät nyt" (tiivistyy, säilyy, osin), ja ainoa ohjaus on listan alla Tiivistä nyt vapaalla ohjeella. Suodatin: vain tiedostot.',
  'B2 Ohje riviltä: seuraavaksi tiivistyvillä riveillä on Mainitse ja Ohita, jotka kirjoittavat yhteenvedon ohjetta listan yllä olevaan laatikkoon; säilyvillä riveillä ei ole nappeja. Suodatin: vain tiedostot.',
  'B3 Raja: lista on jaettu Pi:n tiivistysrajalla (tiivistyy seuraavaksi, säilyy, aina mukana, jo tiivistetty). Säilyvältä riviltä voi palata keskustelussa sitä edeltävään kohtaan. Suodatin: vain tiedostot.',
];
const NOW = 0, B1 = 1, B2 = 2, B3 = 3;

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
type Verb = 'Luki' | 'Muokkasi' | 'Loi' | 'Ajoi';
/**
 * One tool call on the item. `cmd`: the shell command it was recognised from
 * (a known reader such as docx2txt), not a read/write/edit call. `lines`: what
 * Pi's write or edit result says about the change.
 */
type Op = {verb: Verb; turn: number; at: string; tokens: number; cmd?: string; lines?: string};
/** `file`: a path in the person's home (cloud folders are mounted there). */
type Item = {id: string; src: Src; name: string; place: string; file: boolean; text?: boolean; ops: Op[]};
const KESKO = 'Asiakasprojektit › Kesko – kassajärjestelmä';
const ITEMS: Item[] = [
  {id: 'plan', src: 'sp', file: true, name: 'Projektisuunnitelma.docx', place: KESKO, ops: [{verb: 'Luki', turn: 1, at: '10.02', tokens: 3400, cmd: 'docx2txt'}, {verb: 'Luki', turn: 8, at: '10.20', tokens: 3400, cmd: 'docx2txt'}]},
  {id: 'vko44', src: 'sp', file: true, name: 'Viikkoraportti vko 44.docx', place: `${KESKO} › Viikkoraportit`, ops: [{verb: 'Luki', turn: 1, at: '10.02', tokens: 2100, cmd: 'docx2txt'}]},
  {id: 'pk', src: 'sp', file: true, name: 'Ohjausryhmän pöytäkirjat 2026.pdf', place: `${KESKO} › Kokousmuistiot`, ops: [{verb: 'Luki', turn: 2, at: '10.05', tokens: 96400, cmd: 'pdftotext'}]},
  {id: 'hinnasto', src: 'sp', file: true, name: 'Hinnasto 2026.xlsx', place: 'Myynti › Jaetut asiakirjat', ops: [{verb: 'Luki', turn: 3, at: '10.08', tokens: 18400, cmd: 'xlsx2csv'}]},
  {id: 'script', src: 'ws', file: true, text: true, name: 'make_report.py', place: 'Työtila raportit', ops: [{verb: 'Loi', turn: 4, at: '10.11', tokens: 100, lines: '42 riviä'}, {verb: 'Muokkasi', turn: 5, at: '10.15', tokens: 100, lines: '+6 −2'}]},
  {id: 'run0', src: 'cmd', file: false, name: 'python3 make_report.py --template vko44', place: 'Työtila raportit', ops: [{verb: 'Ajoi', turn: 5, at: '10.14', tokens: 12600}]},
  {id: 'mail1', src: 'mail', file: false, name: 'Re: Varmenteiden vaihto', place: 'Keskon IT · 5.11.', ops: [{verb: 'Luki', turn: 6, at: '10.16', tokens: 2600, cmd: 'himalaya'}]},
  {id: 'cal', src: 'cal', file: false, name: 'Pilotti, Prisma Kannelmäki', place: 'vko 47 · ma–pe', ops: [{verb: 'Luki', turn: 7, at: '10.18', tokens: 600, cmd: 'kalenteri'}]},
  {id: 'loki', src: 'ws', file: true, text: true, name: 'Kuormitustesti-loki.csv', place: 'Työtila raportit', ops: [{verb: 'Luki', turn: 9, at: '10.31', tokens: 31200}]},
  {id: 'yht', src: 'ws', file: true, text: true, name: 'Kuormitustesti-yhteenveto.md', place: 'Työtila raportit', ops: [{verb: 'Loi', turn: 10, at: '10.35', tokens: 200, lines: '38 riviä'}]},
  {id: 'aq', src: 'sp', file: true, text: true, name: 'Avoimet kysymykset.md', place: KESKO, ops: [{verb: 'Luki', turn: 11, at: '10.39', tokens: 1100}, {verb: 'Muokkasi', turn: 13, at: '10.43', tokens: 100, lines: '+4'}]},
  {id: 'muist', src: 'od', file: true, text: true, name: 'Kesko-palaveri 4.11.md', place: 'OneDrive › Omat muistiinpanot', ops: [{verb: 'Luki', turn: 11, at: '10.39', tokens: 900}]},
  {id: 'vko45', src: 'sp', file: true, name: 'Viikkoraportti vko 45.docx', place: `${KESKO} › Viikkoraportit`, ops: [{verb: 'Luki', turn: 12, at: '10.42', tokens: 2300, cmd: 'docx2txt'}]},
  {id: 'run1', src: 'cmd', file: false, name: 'python3 make_report.py --out "…vko 45.docx"', place: 'Työtila raportit', ops: [{verb: 'Ajoi', turn: 12, at: '10.42', tokens: 800}]},
  {id: 'mail2', src: 'mail', file: false, name: 'Varmenteet: aikataulu', place: 'Keskon IT · tänään 10.46', ops: [{verb: 'Luki', turn: 14, at: '10.47', tokens: 2900, cmd: 'himalaya'}]},
  {id: 'test', src: 'cmd', file: false, name: 'python3 load_test.py --kassat 60', place: 'Työtila raportit', ops: [{verb: 'Ajoi', turn: 15, at: '10.50', tokens: 24800}]},
  {id: 'run2', src: 'cmd', file: false, name: 'python3 make_report.py --out "…vko 45.docx"', place: 'Työtila raportit', ops: [{verb: 'Ajoi', turn: 16, at: '10.55', tokens: 700}]},
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

// ---------- Store: the compaction, the instruction, the rewind ----------

type Phase = 'known' | 'compacting' | 'after';
type Mark = 'keep' | 'skip';
const store = {
  phase: 'known' as Phase, keptFrom: 8, instruction: '', marks: {} as Record<string, Mark>,
  rewound: 0, draft: '', toast: '',
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
let timer = 0;
function resetStore() {
  window.clearTimeout(timer);
  Object.assign(store, {phase: 'known', keptFrom: 8, instruction: '', marks: {}, rewound: 0, draft: '', toast: ''});
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

/** The active branch: after a rewind before turn n, turns n… are on the other branch. */
const lastTurn = () => (store.rewound ? store.rewound - 1 : 16);
const turnsNow = () => TURNS.filter((t) => t.n <= lastTurn());
const opsNow = (it: Item) => it.ops.filter((o) => o.turn <= lastTurn());
const onBranch = (it: Item) => opsNow(it).length > 0;
/** What the model sees of the item now: its outputs on or after the kept turn. */
const inContext = (it: Item) => opsNow(it).filter((o) => o.turn >= store.keptFrom).reduce((a, o) => a + o.tokens, 0);
const wasTokens = (it: Item) => opsNow(it).reduce((a, o) => a + o.tokens, 0);
const isIn = (it: Item) => opsNow(it).some((o) => o.turn >= store.keptFrom);
const turnsOf = (it: Item) => opsNow(it).map((o) => o.turn).filter((v, i, a) => a.indexOf(v) === i);
/**
 * Pi's own cut (prepareCompaction with keepRecentTokens 20 000): what a
 * compaction now would summarize and keep. None right after a compaction:
 * Pi refuses with "Already compacted" until the conversation continues.
 */
const next = () => store.phase !== 'known' ? null
  : store.rewound ? {from: 8, through: 11, keptFrom: 12, tokens: 48600}
    : {from: 8, through: 14, keptFrom: 15, tokens: 61800};
type Fate = 'gone' | 'next' | 'kept';
function fate(it: Item): Fate {
  const n = next();
  if (!isIn(it)) return 'gone';
  if (!n) return 'kept';
  return opsNow(it).some((o) => o.turn >= n.keptFrom) ? 'kept' : 'next';
}

const fmt = (n: number) => formatNumber(Math.round(n));
const short = (n: number) => (n >= 1000 ? `${formatNumber(n / 1000, {maximumFractionDigits: n >= 100000 ? 0 : 1})}k` : String(n));
const pct = (n: number, of: number) => { const p = (n / of) * 100; return `${p > 0 && p < 1 ? '<1' : Math.round(p)} %`; };

// Pi's own numbers for the session as the detail page reads it.
const SYS = 19200, TOOLS = 2400, REST = 2200;
const measured = () => (store.rewound ? 93600 : 124900);
const summaryTokens = () => (store.phase === 'after' ? 6900 : 5800);
const conversationNow = () => (store.phase === 'after' ? {user: 200, assistant: 1600, thinking: 2100, tool_calls: 400}
  : store.rewound ? {user: 1200, assistant: 7600, thinking: 9900, tool_calls: 2400}
    : {user: 1400, assistant: 9800, thinking: 12600, tool_calls: 3100});
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const toolOutput = () => ITEMS.reduce((a, it) => a + inContext(it), 0);
const total = () => (store.phase === 'known' ? measured() : SYS + TOOLS + summaryTokens() + sum(conversationNow()) + toolOutput());
/** Helsinki 10.02 on 6.11. is 08.02 UTC. */
const utc = (hm: string) => { const [h, m] = hm.split('.'); return `2026-11-06T${String(Number(h) - 2).padStart(2, '0')}:${m}:00.000Z`; };
const callLabel = (it: Item, o: Op) => (o.cmd ? `bash ${o.cmd} ${it.name}` : it.src === 'cmd' ? `bash ${it.name}` : `${o.verb === 'Luki' ? 'read' : o.verb === 'Loi' ? 'write' : 'edit'} ${it.name}`);
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
    next_compaction: n ? {from_turn: n.from, through_turn: n.through, kept_from_turn: n.keptFrom, split_turn: false, summarized_tokens: n.tokens} : null,
    turns, turns_omitted: 0,
  };
}
const usage = (): ContextUsage => store.phase === 'known'
  ? {phase: 'known', tokens: measured(), window: WINDOW, autoCompaction: true, reserve: RESERVE, model: 'Claude Sonnet 5'}
  : {phase: store.phase, window: WINDOW, autoCompaction: true, reserve: RESERVE, model: 'Claude Sonnet 5'};

/** B2: the instruction written from the rows, until the person edits it. */
function marksText() {
  const names = (m: Mark) => ITEMS.filter((it) => store.marks[it.id] === m).map((it) => it.name);
  const keep = names('keep'), skip = names('skip');
  return [keep.length ? `Kerro yhteenvedossa olennainen näistä: ${keep.join(', ')}.` : '', skip.length ? `Näistä riittää maininta, sisältöä ei tarvita: ${skip.join(', ')}.` : ''].filter(Boolean).join('\n');
}
function compactNow() {
  store.phase = 'compacting'; notify();
  timer = window.setTimeout(() => {
    store.phase = 'after'; store.keptFrom = 15; store.marks = {}; notify();
  }, 2500);
}
function askToRead(it: Item) {
  store.draft = it.src === 'mail' ? `Lue uudelleen viesti "${it.name}".` : it.src === 'cal' ? `Katso uudelleen kalenterista ${it.name}.` : `Lue uudelleen ${it.name}.`;
  notify();
  toast('Pyyntö on viestikentässä; agentti lukee sen, kun lähetät.');
}

// ---------- Shared pieces ----------

const noop = () => {};
const T0 = Date.UTC(2026, 10, 6, 8, 0);
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'raportit',
};
function opsText(it: Item) {
  const ops = opsNow(it);
  const verbs = ops.map((o) => `${o.verb}${o.cmd ? ' komennolla' : ''}${o.lines ? ` ${o.lines}` : ''}`).filter((v, i, a) => a.indexOf(v) === i);
  return `${verbs.join(', ')} · vuoro${turnsOf(it).length > 1 ? 't' : ''} ${turnsOf(it).join(', ')}`;
}
function ItemIcon({it}: {it: Item}) {
  return <span className="cx-src" data-src={it.src} aria-hidden="true"><Icon name={SRC[it.src].icon} /></span>;
}
const FATE: Record<Fate | 'always' | 'mixed' | 'summary', string> = {
  gone: 'Jo tiivistetty', next: 'Tiivistyy', kept: 'Säilyy', always: 'Säilyy', mixed: 'Osin', summary: 'Päivittyy',
};

/** One row of "where the context goes": an item the agent touched, or a production part. */
type Row = {id: string; name: string; meta: string; tokens: number; k: string; item?: Item; fate: Fate | 'always' | 'mixed' | 'summary'};
function partRows(): Row[] {
  const c = conversationNow();
  const n = next();
  const talk = n ? 'mixed' : 'kept';
  const after = store.phase === 'after';
  return [
    {id: 'thinking', name: 'Agentin ajattelu', meta: 'Keskustelu', tokens: c.thinking, k: 'talk', fate: talk},
    {id: 'replies', name: 'Agentin vastaukset', meta: 'Keskustelu', tokens: c.assistant, k: 'talk', fate: talk},
    {id: 'calls', name: 'Työkalukutsut', meta: 'Keskustelu', tokens: c.tool_calls, k: 'talk', fate: talk},
    {id: 'you', name: 'Viestisi', meta: 'Keskustelu', tokens: c.user, k: 'talk', fate: talk},
    {id: 'skills', name: 'Skillit', meta: 'Ohjeet', tokens: 10700, k: 'sys', fate: 'always'},
    {id: 'agents', name: 'AGENTS.md ja projektin ohjeet', meta: 'Ohjeet', tokens: 4800, k: 'sys', fate: 'always'},
    {id: 'otherSys', name: 'Muut ohjeet', meta: 'Ohjeet', tokens: 3700, k: 'sys', fate: 'always'},
    {id: 'sum', name: 'Tiivistelmä', meta: after ? 'Vuorot 1–14' : 'Vuorot 1–7', tokens: summaryTokens(), k: 'sum', fate: n ? 'summary' : 'kept'},
    {id: 'tools', name: 'Työkalujen kuvaukset', meta: 'Ohjeet', tokens: TOOLS, k: 'tools', fate: 'always'},
    ...(store.phase === 'known' ? [{id: 'rest', name: 'Erittelemätön', meta: 'Mitatun ja arvioidun ero', tokens: REST, k: 'rest', fate: 'always' as const}] : []),
  ];
}
function itemRow(it: Item): Row {
  return {id: it.id, name: it.name, meta: `${SRC[it.src].label} · ${opsText(it)}`, tokens: inContext(it), k: 'out', item: it, fate: fate(it)};
}
/** Everything in the context now, largest first. */
const allRows = () => [...ITEMS.filter(isIn).map(itemRow), ...partRows()].filter((r) => r.tokens > 0).sort((x, y) => y.tokens - x.tokens);
/** Only files: every file the agent read or changed on this branch, also those only the summary has. */
const fileRows = () => ITEMS.filter((it) => it.file && onBranch(it)).map(itemRow).sort((x, y) => (y.tokens - x.tokens) || (wasTokens(y.item!) - wasTokens(x.item!)));

function SizeBar({rows}: {rows: Row[]}) {
  const order = ['out', 'talk', 'sum', 'sys', 'tools', 'rest'];
  const list = [...rows].filter((r) => r.tokens > 0).sort((x, y) => order.indexOf(x.k) - order.indexOf(y.k) || y.tokens - x.tokens);
  return (
    <div className="cx-blockbar" aria-hidden="true">
      {list.map((b) => <i key={b.id} data-k={b.k} style={{width: `${(b.tokens / WINDOW) * 100}%`}} />)}
      <b style={{left: `${(THRESHOLD / WINDOW) * 100}%`}} />
    </div>
  );
}
function Filter({value, onChange}: {value: 'all' | 'files'; onChange: (v: 'all' | 'files') => void}) {
  const files = ITEMS.filter((it) => it.file && onBranch(it)).length;
  return (
    <Segmented data-testid="files-filter" label="Näytä" value={value} onChange={onChange} size="row"
      options={[{id: 'all', label: 'Kaikki osat'}, {id: 'files', label: `Vain tiedostot ${files}`}]} />
  );
}
function FilesNote() {
  return <p className="ah-cd-fine" data-testid="files-note">Tiedostot, jotka agentti luki tai muutti tässä keskustelussa. "Komennolla" tarkoittaa, että tiedosto tunnistettiin lukukomennosta (docx2txt, pdftotext, xlsx2csv); komennolla tehtyjä muutoksia ei tunnisteta.</p>;
}
/** The size cell: tokens now, or that only the summary has it. */
function Size({r}: {r: Row}) {
  const s = useStore();
  if (s.phase === 'compacting' && r.fate === 'next') return <span className="cx-tag" data-st="busy">Tiivistyy…</span>;
  if (r.item && !isIn(r.item)) return <span className="cx-tag" data-st="sum" data-testid="tag-sum">Tiivistetty · oli {short(wasTokens(r.item))}</span>;
  return <span className="cx-num">{fmt(r.tokens)}</span>;
}
function RowName({r}: {r: Row}) {
  return (
    <span className="cx-rowname">
      <span className="cx-bname"><span className="ah-cd-sw" aria-hidden="true" />{r.item ? <ItemIcon it={r.item} /> : null}<span className={r.item?.src === 'cmd' ? 'mono' : undefined}>{r.name}</span></span>
      <span className="cx-meta">{r.meta}</span>
    </span>
  );
}
/** What every riff may offer on an item: open a text file, ask to read a summarized item again. */
function ItemActions({it}: {it: Item}) {
  return (
    <>
      {it.text ? <ControlButton data-testid={`open-${it.id}`} size="inline" variant="quiet" onPress={() => toast(`${it.name} avautuu työtilan editoriin.`)}><Icon name="editor" />Avaa</ControlButton> : null}
      {!isIn(it) && it.src !== 'cmd' ? <ControlButton data-testid={`reread-${it.id}`} size="inline" variant="quiet" onPress={() => askToRead(it)}><Icon name="refresh" />Lue uudelleen</ControlButton> : null}
    </>
  );
}

/** The confirm before Pi's compaction: what Pi's cut summarizes, what stays, the instruction. */
function CompactDialog({open, editable, onClose}: {open: boolean; editable: boolean; onClose: () => void}) {
  const s = useStore();
  const n = next();
  if (!n) return null;
  const stays = ITEMS.filter((it) => opsNow(it).some((o) => o.turn >= n.keptFrom));
  const after = SYS + TOOLS + 6900 + 4300 + stays.reduce((a, it) => a + opsNow(it).filter((o) => o.turn >= n.keptFrom).reduce((x, o) => x + o.tokens, 0), 0);
  return (
    <ModalOverlay className="ah-overlay" isOpen={open} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal cx-modal">
        <AriaDialog className="ah-dialog" data-testid="compact-dialog" aria-label="Tiivistä nyt">
          <Heading slot="title">Tiivistä nyt</Heading>
          <p className="s-desc">Vuorot {n.from}–{n.through} (noin {fmt(n.tokens)} tokenia) korvautuvat yhteenvedolla, joka jatkaa edellistä tiivistelmää. Pi valitsee rajan itse: uusimmat noin {fmt(KEEP)} tokenia säilyvät sellaisinaan. Vuorot {n.keptFrom}–{lastTurn()} säilyvät, myös niissä luettu:</p>
          <ul className="cx-stay">{stays.map((it) => <li key={it.id}><ItemIcon it={it} /><span className={it.src === 'cmd' ? 'mono' : undefined}>{it.name}</span><span className="cx-num">{short(opsNow(it).filter((o) => o.turn >= n.keptFrom).reduce((a, o) => a + o.tokens, 0))}</span></li>)}</ul>
          {editable ? (
            <TextArea data-testid="compact-instruction-field" label="Ohje yhteenvedolle (valinnainen)" rows={3} value={s.instruction}
              onChange={(v) => { store.instruction = v; notify(); }} placeholder="Esim. säilytä kuormitustestin luvut tarkkoina" />
          ) : (
            <>
              <p className="cx-label">Ohje yhteenvedolle</p>
              <p className="cx-instruction" data-testid="compact-instruction">{s.instruction || 'Ei ohjetta: agentti päättää itse, mitä yhteenvetoon jää.'}</p>
            </>
          )}
          <p className="cx-fine">Ohje vaikuttaa vain yhteenvedon sisältöön, ei siihen, mitkä vuorot tiivistyvät. Konteksti on tiivistyksen jälkeen noin {fmt(after)} tokenia. Tiivistetyt vuorot jäävät keskusteluun luettaviksi.</p>
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" onPress={onClose}>Peruuta</ControlButton>
            <ControlButton data-testid="compact-confirm" size="row" variant="primary" onPress={() => { onClose(); compactNow(); }}>Tiivistä</ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
/** Compaction status, or the button and why it is not available. */
function CompactState({children}: {children?: React.ReactNode}) {
  const s = useStore();
  if (s.phase === 'compacting') return <p className="cx-marksbar" data-testid="compacting" role="status"><span className="cx-spin" aria-hidden="true" />Agentti tiivistää keskustelua…</p>;
  if (s.phase === 'after') return <p className="cx-marksbar done" data-testid="compacted" role="status"><Icon name="check" />Tiivistetty. Seuraavan tiivistyksen voi tehdä, kun keskustelu jatkuu; tarkka koko näkyy agentin seuraavan vastauksen jälkeen.</p>;
  return <>{children}</>;
}

// ---------- B1: each row's fate in a compaction now ----------

function B1Section({onCompact}: {onCompact: () => void}) {
  const s = useStore();
  const [filter, setFilter] = useState<'all' | 'files'>('all');
  const rows = filter === 'files' ? fileRows() : allRows();
  const n = next();
  return (
    <section className="cx-b" data-testid="b1-section" aria-labelledby="cx-b-h">
      <h3 id="cx-b-h">Mihin konteksti kuluu</h3>
      <SizeBar rows={allRows()} />
      <div className="cx-tools"><Filter value={filter} onChange={setFilter} /></div>
      {filter === 'files' ? <FilesNote /> : null}
      <ul className="cx-rows" data-cols="fate" data-testid="b-rows">
        <li className="cx-rowhead" aria-hidden="true"><span>Osa</span><span className="num">Tokenia</span><span>Jos tiivistät nyt</span><span /></li>
        {rows.map((r) => (
          <li key={r.id} className="cx-row" data-k={r.k} data-fate={r.fate} data-testid={`row-${r.id}`}>
            <RowName r={r} />
            <Size r={r} />
            <span className="cx-fate" data-fate={r.fate}>{n || r.fate === 'gone' ? FATE[r.fate] : '—'}</span>
            <span className="cx-rowact">{r.item ? <ItemActions it={r.item} /> : null}</span>
          </li>
        ))}
      </ul>
      <CompactState>
        <div className="cx-compactform" data-testid="b1-form">
          <p className="cx-fine">{n ? <>Pi tiivistää aina vanhimmat vuorot ja pitää uusimmat noin {fmt(KEEP)} tokenia sellaisinaan: nyt tiivistyisi vuorot {n.from}–{n.through} ({fmt(n.tokens)} tokenia). Automaattisesti tämä tapahtuu, kun käyttö ylittää {fmt(THRESHOLD)} tokenia.</> : null}</p>
          <TextArea data-testid="b1-instruction" label="Ohje yhteenvedolle (valinnainen)" rows={2} value={s.instruction}
            onChange={(v) => { store.instruction = v; notify(); }} placeholder="Esim. säilytä kuormitustestin luvut tarkkoina" />
          <ControlButton data-testid="compact-open" size="row" variant="secondary" onPress={onCompact}>Tiivistä nyt…</ControlButton>
        </div>
      </CompactState>
    </section>
  );
}

// ---------- B2: the compaction's instruction written from the rows ----------

function B2Section({onCompact}: {onCompact: () => void}) {
  const s = useStore();
  const [filter, setFilter] = useState<'all' | 'files'>('all');
  const [edited, setEdited] = useState(false);
  const rows = filter === 'files' ? fileRows() : allRows();
  const n = next();
  const setMark = (it: Item, m: Mark) => {
    if (store.marks[it.id] === m) delete store.marks[it.id]; else store.marks[it.id] = m;
    if (!edited) store.instruction = marksText();
    notify();
  };
  return (
    <section className="cx-b" data-testid="b2-section" aria-labelledby="cx-b-h">
      <h3 id="cx-b-h">Mihin konteksti kuluu</h3>
      <SizeBar rows={allRows()} />
      <CompactState>
        <div className="cx-ibox" data-testid="b2-box">
          <TextArea data-testid="b2-instruction" label={n ? `Ohje seuraavalle tiivistykselle · vuorot ${n.from}–${n.through}` : 'Ohje seuraavalle tiivistykselle'} rows={3} value={s.instruction}
            onChange={(v) => { store.instruction = v; setEdited(true); notify(); }}
            placeholder="Valitse alta, mitä yhteenvedossa mainitaan tai ohitetaan, tai kirjoita itse." />
          <div className="cx-ibox-foot">
            <p className="cx-fine">Ohje vaikuttaa vain siihen, mitä yhteenvetoon kirjoitetaan. Vuorot {n ? `${n.keptFrom}–${lastTurn()}` : ''} säilyvät sellaisinaan, joten niiden riveillä ei ole valintoja.</p>
            <ControlButton data-testid="compact-open" size="row" variant={s.instruction ? 'primary' : 'secondary'} onPress={onCompact}>Tiivistä nyt…</ControlButton>
          </div>
        </div>
      </CompactState>
      <div className="cx-tools"><Filter value={filter} onChange={setFilter} /></div>
      {filter === 'files' ? <FilesNote /> : null}
      <ul className="cx-rows" data-cols="marks" data-testid="b-rows">
        <li className="cx-rowhead" aria-hidden="true"><span>Osa</span><span className="num">Tokenia</span><span>Yhteenvedossa</span></li>
        {rows.map((r) => (
          <li key={r.id} className="cx-row" data-k={r.k} data-fate={r.fate} data-mark={r.item ? s.marks[r.item.id] : undefined} data-testid={`row-${r.id}`}>
            <RowName r={r} />
            <Size r={r} />
            <span className="cx-rowact">
              {r.item && r.fate === 'next' && s.phase === 'known' ? (
                <span className="cx-marks" role="group" aria-label={`Yhteenvedossa: ${r.name}`}>
                  <ControlButton data-testid={`keep-${r.id}`} size="inline" variant="secondary" aria-pressed={s.marks[r.id] === 'keep'} onPress={() => setMark(r.item!, 'keep')}>Mainitse</ControlButton>
                  <ControlButton data-testid={`skip-${r.id}`} size="inline" variant="secondary" aria-pressed={s.marks[r.id] === 'skip'} onPress={() => setMark(r.item!, 'skip')}>Ohita</ControlButton>
                </span>
              ) : r.fate === 'kept' && r.item && s.phase === 'known' ? <span className="cx-meta">Säilyy sellaisenaan</span> : null}
              {r.item ? <ItemActions it={r.item} /> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- B3: the list split at Pi's cut ----------

function B3Section({onCompact, onRewind}: {onCompact: () => void; onRewind: (n: number) => void}) {
  const s = useStore();
  const [filter, setFilter] = useState<'all' | 'files'>('all');
  const n = next();
  const files = filter === 'files';
  const items = ITEMS.filter((it) => onBranch(it) && (!files || it.file));
  const of = (f: Fate) => items.filter((it) => fate(it) === f).map(itemRow).sort((x, y) => (y.tokens - x.tokens) || (wasTokens(y.item!) - wasTokens(x.item!)));
  const c = conversationNow(), talk = sum(c);
  // Pi's forecast splits the conversation's own messages at the same cut.
  const talkNext = n ? n.tokens - of('next').reduce((a, r) => a + r.tokens, 0) : 0;
  const bands: {id: string; title: string; note: string; rows: Row[]; extra?: Row[]; action?: React.ReactNode}[] = [
    ...(n ? [{id: 'next', title: `Tiivistyy seuraavaksi · vuorot ${n.from}–${n.through} · ${fmt(n.tokens)}`, note: `Pi tiivistää aina vanhimmat vuorot. Automaattisesti, kun käyttö ylittää ${fmt(THRESHOLD)} tokenia, tai heti napista.`,
      rows: of('next'), extra: files ? [] : [{id: 'talk-next', name: 'Keskustelu näissä vuoroissa', meta: 'Viestisi, vastaukset, ajattelu ja työkalukutsut', tokens: talkNext, k: 'talk', fate: 'next' as const}],
      action: <ControlButton data-testid="compact-open" size="inline" variant="secondary" onPress={onCompact}>Tiivistä nyt…</ControlButton>}] : []),
    {id: 'kept', title: n ? `Säilyy sellaisenaan · vuorot ${n.keptFrom}–${lastTurn()}` : `Agentti näkee sellaisenaan · vuorot ${store.keptFrom}–${lastTurn()}`,
      note: n ? `Uusimmat noin ${fmt(KEEP)} tokenia jäävät tiivistyksessä ennalleen. Tältä listalta kohteen saa pois vain palaamalla keskustelussa sitä edeltävään kohtaan.` : 'Juuri tiivistetty. Nämä agentti näkee sellaisinaan; seuraava tiivistys on mahdollinen, kun keskustelu jatkuu.',
      rows: of('kept'), extra: files ? [] : [{id: 'talk-kept', name: 'Keskustelu näissä vuoroissa', meta: 'Viestisi, vastaukset, ajattelu ja työkalukutsut', tokens: n ? talk - talkNext : talk, k: 'talk', fate: 'kept' as const}]},
    ...(files ? [] : [{id: 'always', title: `Aina mukana · ${fmt(SYS + TOOLS + summaryTokens())}`, note: 'Ohjeet ja työkalujen kuvaukset ovat jokaisessa pyynnössä; tiivistelmä päivittyy tiivistyksessä.', rows: [],
      extra: partRows().filter((r) => r.k === 'sys' || r.k === 'tools' || r.k === 'sum')}]),
    {id: 'gone', title: `Jo tiivistetty · vuorot 1–${store.keptFrom - 1}`, note: 'Agentti luki nämä aiemmin ja näkee ne nyt vain tiivistelmän kautta.', rows: of('gone')},
  ];
  return (
    <section className="cx-b" data-testid="b3-section" aria-labelledby="cx-b-h">
      <h3 id="cx-b-h">Mihin konteksti kuluu</h3>
      <SizeBar rows={allRows()} />
      <div className="cx-tools"><Filter value={filter} onChange={setFilter} /></div>
      {files ? <FilesNote /> : null}
      {s.rewound ? <p className="cx-marksbar done" data-testid="rewound" role="status"><Icon name="restore" /><span>Palattu ennen vuoroa {s.rewound}. Vuorot {s.rewound}–16 ovat tallessa keskustelun toisessa haarassa.</span></p> : null}
      <CompactState />
      {bands.map((b) => (
        <div key={b.id} className="cx-band" data-band={b.id} data-testid={`band-${b.id}`}>
          <div className="cx-band-head">
            <span className="cx-cut-line" aria-hidden="true" />
            <h4>{b.title}</h4>
            {b.action && s.phase === 'known' ? b.action : null}
          </div>
          <p className="cx-fine">{b.note}</p>
          <ul className="cx-rows" data-cols="band">
            {[...b.rows, ...(b.extra ?? [])].filter((r) => r.tokens > 0 || r.item).map((r) => (
              <li key={r.id} className="cx-row" data-k={r.k} data-fate={r.fate} data-testid={`row-${r.id}`}>
                <RowName r={r} />
                <Size r={r} />
                <span className="cx-rowact">
                  {r.item && b.id === 'kept' && n && r.tokens >= 5000 ? (
                    <ControlButton data-testid={`rewind-${r.id}`} size="inline" variant="secondary" onPress={() => onRewind(Math.min(...turnsOf(r.item!)))}><Icon name="restore" />Palaa ennen vuoroa {Math.min(...turnsOf(r.item))}…</ControlButton>
                  ) : null}
                  {r.item ? <ItemActions it={r.item} /> : null}
                </span>
              </li>
            ))}
            {![...b.rows, ...(b.extra ?? [])].length ? <li className="cx-row cx-empty"><span className="cx-fine">Ei tiedostoja tässä osassa.</span></li> : null}
          </ul>
        </div>
      ))}
    </section>
  );
}
/** The agreed rewind (rewind-conversation, C Pieni arkki), opened from B3's kept rows. */
function RewindDialog({turn, onClose, onRewind}: {turn: number; onClose: () => void; onRewind: () => void}) {
  const t = TURNS.find((x) => x.n === turn);
  const gone = ITEMS.filter((it) => it.ops.some((o) => o.turn >= turn));
  return (
    <ModalOverlay className="ah-overlay" isOpen={!!turn} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal cx-modal">
        <AriaDialog className="ah-dialog" data-testid="rewind-dialog" aria-label="Palaa tähän">
          <Heading slot="title">Palaa ennen vuoroa {turn}</Heading>
          {t ? <p className="s-desc">Keskustelu jatkuu vuoron {turn - 1} jälkeen, ja vuoron {turn} viesti tulee viestikenttään. Vuorot {turn}–16 jäävät tallessa toiseen haaraan, eikä agentti enää näe niiden tulosteita:</p> : null}
          <ul className="cx-stay">{gone.map((it) => <li key={it.id}><ItemIcon it={it} /><span className={it.src === 'cmd' ? 'mono' : undefined}>{it.name}</span><span className="cx-num">{short(it.ops.filter((o) => o.turn >= turn).reduce((a, o) => a + o.tokens, 0))}</span></li>)}</ul>
          <p className="cx-fine">Konteksti on palaamisen jälkeen {fmt(TURNS.find((x) => x.n === turn - 1)?.ctx ?? 0)} tokenia (vuoron {turn - 1} mittaus). Tiedostot pysyvät nykyisinä; palautus valitaan Palaa tähän -arkissa keskustelun puolella.</p>
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

// ---------- The conversation ----------

const tool = (key: string, name: string, target: string, body: React.ReactNode): TurnStep => ({kind: 'tool', key, node: <PiToolUse name={name} state="succeeded" targetText={target}>{body}</PiToolUse>});
const say = (key: string, text: string): TurnStep => ({kind: 'text', key, text, node: <Markdown text={text} />});
const LOAD = 'kassat=60 kesto=600s\nvaste_ka=1,12s p95=1,84s virheet=0\n…\n(tuloste 4 812 riviä)';
const VKO45 = `${'~/cloud/sharepoint/contoso/asiakasprojektit/jaetut-asiakirjat/Kesko – kassajärjestelmä/Viikkoraportit'}/Viikkoraportti vko 45.docx`;
function turnItems() {
  const out: {id: string; kind: string; content: React.ReactNode}[] = [];
  for (const t of turnsNow().slice(-3)) {
    out.push({id: `u${t.n}`, kind: 'user', content: <UserMessage sourceText={t.ask} onCopy={noop} time={t.at}><Markdown text={t.ask} /></UserMessage>});
    const steps: TurnStep[] =
      t.n === 14 ? [tool('m', 'bash', 'himalaya message read 4127', <BashToolCard command="himalaya message read 4127" output={'Lähettäjä: Keskon IT\nAihe: Varmenteet: aikataulu\n\nVaihto tehdään 2.12. klo 6–8…'} />), say('s', 'Keskon IT vaihtaa varmenteet **2.12. klo 6–8**. Omistajaksi on nimetty Petri Saarinen.')]
        : t.n === 15 ? [tool('t', 'bash', 'python3 load_test.py --kassat 60', <BashToolCard command="python3 load_test.py --kassat 60" output={LOAD} />), say('s', '60 kassalla keskimääräinen vasteaika on **1,12 s** (p95 1,84 s), virheitä ei ollut. Tavoite 1,0 s ylittyy hieman.')]
          : t.n === 16 ? [tool('w', 'bash', `python3 make_report.py --template vko44 --out "${VKO45}"`, <BashToolCard command="python3 make_report.py --template vko44 --out …vko 45.docx" output="Kirjoitettu: Viikkoraportti vko 45.docx (40 kt)" />), say('s', 'Päivitin raporttiin 60 kassan tuloksen ja huomion, että tavoite ylittyy 0,12 sekunnilla.')]
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
  const convs = [
    {id: 'kesko', title, since: 3},
    {id: 'valio', title: 'Valion vaatimukset', since: 1500},
  ];
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
    <div className="ah-state cx-main">
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
      {page && direction === B1 ? <Into after=".ah-cd-top"><B1Section onCompact={() => setCompactOpen(true)} /></Into> : null}
      {page && direction === B2 ? <Into after=".ah-cd-top"><B2Section onCompact={() => setCompactOpen(true)} /></Into> : null}
      {page && direction === B3 ? <Into after=".ah-cd-top"><B3Section onCompact={() => setCompactOpen(true)} onRewind={setRewindTurn} /></Into> : null}
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} rail={railView} main={main} />
      <CompactDialog open={compactOpen} editable={direction === B3} onClose={() => setCompactOpen(false)} />
      <RewindDialog turn={rewindTurn} onClose={() => setRewindTurn(0)} onRewind={() => {
        const t = TURNS.find((x) => x.n === rewindTurn)!;
        store.rewound = rewindTurn; store.draft = t.ask; setRewindTurn(0); notify();
        toast(`Vuoron ${t.n} viesti on viestikentässä muokattavaksi.`);
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
        <strong>Keskustelun konteksti · kierros 2</strong>
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
