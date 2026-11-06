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
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {ViewSplit} from '../../../../web/src/components/ViewPanel';
import {AccountShelf} from '../../../../web/src/components/Account';
import {ContextRing, type ContextUsage} from '../../../../web/src/components/ContextRing';
import {ContextPage} from '../../../../web/src/components/ContextPage';
import type {ContextDetail} from '../../../../web/src/app/contextDetail';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {formatNumber, setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/ViewPanel.css';
import '../../../../web/src/components/EditorSplit.css';
import '../../../../web/src/components/FileOffer.css';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-conversation-context-view, round 1. Jari (6.11.2026) liked direction
// C of proto-browse-what-agent-sees-m365: the conversation's log of what the
// agent read and changed. This round grows it into an analysis of what the
// conversation's context holds now: files and integration items read, tool
// calls, files changed, the context's size and where it goes, compactions,
// and how the person sees and steers it. "Nyt" is production as it is: the
// context ring opens ContextPage. The axis of the three directions is what
// organises the analysis: A the items the agent touched (a side panel grown
// from round 1's C), B where the size goes (the production page grown), C
// time, turn by turn (the production page's turn table grown). Everything
// comes from Pi's native session; the steering is Pi's own: compaction with
// instructions, a fork from a turn, and a message asking the agent to read
// again. Rail, header, ring, page, timeline, turn, tool rows and composer are
// production components; everything is synthetic.
const directions = ['Nyt', 'A Kohteet', 'B Koko', 'C Aikajana'];
const LINES = [
  'Nyt: tuotannon Konteksti-sivu renkaasta. Osat, tiivistykset ja vuorot; luetut ja muutetut tiedostot näkyvät vain tiivistyksen kohdalla.',
  'A Kohteet: renkaasta aukeaa sivupaneeli, jossa jokainen luettu tai muutettu tiedosto, viesti ja komento on rivi: koko nyt ja onko se mallilla vai vain tiivistelmässä. Rivin voi merkitä tärkeäksi tai tarpeettomaksi ja pyytää luettavaksi uudelleen.',
  'B Koko: tuotannon sivu alkaa siitä, mihin konteksti kuluu. Jokainen luettu tiedosto ja tuloste on oma palansa palkissa ja listassa suurimmasta pienimpään; valitut voi tiivistää pois.',
  'C Aikajana: tuotannon sivu alkaa vuoroista. Jokainen vuoro näyttää, mitä se luki ja muutti ja paljonko konteksti kasvoi; tiivistyksen raja kulkee aikajanan poikki, ja vuorosta voi haarautua.',
];
const NOW = 0, A = 1, B = 2, C = 3;

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
/** One tool call on the item; `cmd`: recognised from a shell command, not a read/write/edit call. */
type Op = {verb: Verb; turn: number; at: string; tokens: number; cmd?: boolean};
type Item = {id: string; src: Src; name: string; place: string; ops: Op[]};
const KESKO = 'Asiakasprojektit › Kesko – kassajärjestelmä';
const ITEMS: Item[] = [
  {id: 'plan', src: 'sp', name: 'Projektisuunnitelma.docx', place: KESKO, ops: [{verb: 'Luki', turn: 1, at: '10.02', tokens: 3400, cmd: true}, {verb: 'Luki', turn: 8, at: '10.20', tokens: 3400, cmd: true}]},
  {id: 'vko44', src: 'sp', name: 'Viikkoraportti vko 44.docx', place: `${KESKO} › Viikkoraportit`, ops: [{verb: 'Luki', turn: 1, at: '10.02', tokens: 2100, cmd: true}]},
  {id: 'pk', src: 'sp', name: 'Ohjausryhmän pöytäkirjat 2026.pdf', place: `${KESKO} › Kokousmuistiot`, ops: [{verb: 'Luki', turn: 2, at: '10.05', tokens: 96400, cmd: true}]},
  {id: 'hinnasto', src: 'sp', name: 'Hinnasto 2026.xlsx', place: 'Myynti › Jaetut asiakirjat', ops: [{verb: 'Luki', turn: 3, at: '10.08', tokens: 18400, cmd: true}]},
  {id: 'script', src: 'ws', name: 'make_report.py', place: 'Työtila raportit', ops: [{verb: 'Loi', turn: 4, at: '10.11', tokens: 100}, {verb: 'Muokkasi', turn: 5, at: '10.15', tokens: 100}]},
  {id: 'run0', src: 'cmd', name: 'python3 make_report.py --template vko44', place: 'Työtila raportit', ops: [{verb: 'Ajoi', turn: 5, at: '10.14', tokens: 12600}]},
  {id: 'mail1', src: 'mail', name: 'Re: Varmenteiden vaihto', place: 'Keskon IT · 5.11.', ops: [{verb: 'Luki', turn: 6, at: '10.16', tokens: 2600, cmd: true}]},
  {id: 'cal', src: 'cal', name: 'Pilotti, Prisma Kannelmäki', place: 'vko 47 · ma–pe', ops: [{verb: 'Luki', turn: 7, at: '10.18', tokens: 600, cmd: true}]},
  {id: 'loki', src: 'ws', name: 'Kuormitustesti-loki.csv', place: 'Työtila raportit', ops: [{verb: 'Luki', turn: 9, at: '10.31', tokens: 31200}]},
  {id: 'yht', src: 'ws', name: 'Kuormitustesti-yhteenveto.md', place: 'Työtila raportit', ops: [{verb: 'Loi', turn: 10, at: '10.35', tokens: 200}]},
  {id: 'aq', src: 'sp', name: 'Avoimet kysymykset.md', place: KESKO, ops: [{verb: 'Luki', turn: 11, at: '10.39', tokens: 1100}, {verb: 'Muokkasi', turn: 13, at: '10.43', tokens: 100}]},
  {id: 'muist', src: 'od', name: 'Kesko-palaveri 4.11.md', place: 'OneDrive › Omat muistiinpanot', ops: [{verb: 'Luki', turn: 11, at: '10.39', tokens: 900}]},
  {id: 'vko45', src: 'sp', name: 'Viikkoraportti vko 45.docx', place: `${KESKO} › Viikkoraportit`, ops: [{verb: 'Loi', turn: 12, at: '10.42', tokens: 800, cmd: true}, {verb: 'Luki', turn: 12, at: '10.42', tokens: 2300, cmd: true}, {verb: 'Muokkasi', turn: 16, at: '10.55', tokens: 700, cmd: true}]},
  {id: 'mail2', src: 'mail', name: 'Varmenteet: aikataulu', place: 'Keskon IT · tänään 10.46', ops: [{verb: 'Luki', turn: 14, at: '10.47', tokens: 2900, cmd: true}]},
  {id: 'test', src: 'cmd', name: 'python3 load_test.py --kassat 60', place: 'Työtila raportit', ops: [{verb: 'Ajoi', turn: 15, at: '10.50', tokens: 24800}]},
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

// ---------- Store: the compaction, the person's marks, the fork ----------

type Phase = 'known' | 'compacting' | 'after';
type Mark = 'keep' | 'drop';
const store = {
  phase: 'known' as Phase, keptFrom: 8, marks: {} as Record<string, Mark>, instruction: '',
  draft: '', toast: '', forked: 0,
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
let timer = 0;
function resetStore() {
  window.clearTimeout(timer);
  Object.assign(store, {phase: 'known', keptFrom: 8, marks: {}, instruction: '', draft: '', toast: '', forked: 0});
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

/** What the model sees of the item now: its outputs on or after the kept turn. */
const inContext = (it: Item) => it.ops.filter((o) => o.turn >= store.keptFrom).reduce((a, o) => a + o.tokens, 0);
const wasTokens = (it: Item) => it.ops.reduce((a, o) => a + o.tokens, 0);
const isIn = (it: Item) => it.ops.some((o) => o.turn >= store.keptFrom);
const lastOp = (it: Item) => it.ops[it.ops.length - 1];
const changed = (it: Item) => it.ops.some((o) => o.verb === 'Loi' || o.verb === 'Muokkasi');
/** Pi lists a file in the compaction's own file lists only when a read, write or edit call named it. */
const listedBySummary = (it: Item) => it.ops.some((o) => !o.cmd && o.verb !== 'Ajoi');

const NEXT = {from: 8, through: 14, keptFrom: 15};
const fmt = (n: number) => formatNumber(Math.round(n));
const short = (n: number) => (n >= 1000 ? `${formatNumber(n / 1000, {maximumFractionDigits: n >= 100000 ? 0 : 1})}k` : String(n));
const pct = (n: number, of: number) => { const p = (n / of) * 100; return `${p > 0 && p < 1 ? '<1' : Math.round(p)} %`; };

// Pi's own numbers for the session as the detail page reads it.
const PARTS = {instructions: 19200, tools: 2400, summary: 5800, conversation: 26900, attachments: 0};
const MEASURED = 124900;
const AFTER_ESTIMATE = 58300;
/** Helsinki 10.02 on 6.11. is 08.02 UTC. */
const utc = (hm: string) => { const [h, m] = hm.split('.'); return `2026-11-06T${String(Number(h) - 2).padStart(2, '0')}:${m}:00.000Z`; };
const toolOutput = () => ITEMS.reduce((a, it) => a + inContext(it), 0);
function detail(): ContextDetail {
  const after = store.phase === 'after';
  const turns = TURNS.map((t) => ({n: t.n, at: utc(t.at), request: t.ask, replies: 2, context_tokens: t.ctx, input: 600, output: 1400, cache_read: t.ctx - 3000, cache_write: 2400, cost: 0}));
  const comp1 = {at: '2026-11-06T08:21:00.000Z', after_turn: 8, kept_from_turn: 8, tokens_before: 184900, summary: SUMMARY1, summary_truncated: false, summary_tokens: 5800,
    read_files: [] as string[], modified_files: ['make_report.py'], tokens_after: 34100};
  const comp2 = {at: '2026-11-06T08:58:00.000Z', after_turn: 16, kept_from_turn: 15, tokens_before: MEASURED, summary: `${SUMMARY1}\n- Kuormitustesti 40 kassalle: 0,8 s; raportti vko 45 kirjoitettu\n${store.instruction ? `\n(ohjeesi: ${store.instruction})` : ''}`, summary_truncated: false, summary_tokens: 6900,
    read_files: ['Kuormitustesti-loki.csv', 'Kesko-palaveri 4.11.md'], modified_files: ['make_report.py', 'Kuormitustesti-yhteenveto.md', 'Avoimet kysymykset.md']};
  const out = toolOutput();
  return {
    schema_version: 1, agent_id: 'pi:kesko', harness: 'pi', model: 'anthropic/claude-sonnet-5',
    ...(after ? {} : {measured_tokens: MEASURED}),
    estimated_tokens: after ? AFTER_ESTIMATE : MEASURED, trailing_tokens: 0,
    settings: {enabled: true, reserve_tokens: RESERVE, keep_recent_tokens: KEEP},
    parts: {...PARTS, summary: after ? 6900 : PARTS.summary, conversation: after ? 4300 : PARTS.conversation, tool_output: out},
    instructions: [{name: 'skills', tokens: 10700}, {name: 'project_context', tokens: 4800}, {name: 'open_habitat', tokens: 2100}, {name: 'rules', tokens: 900}, {name: 'preamble', tokens: 400}, {name: 'prompt', tokens: 300}],
    tools: [{name: 'bash', tokens: 620}, {name: 'edit', tokens: 520}, {name: 'read', tokens: 480}, {name: 'process', tokens: 400}, {name: 'write', tokens: 380}],
    conversation: after ? {user: 200, assistant: 1600, thinking: 2100, tool_calls: 400, other: 0} : {user: 1400, assistant: 9800, thinking: 12600, tool_calls: 3100, other: 0},
    largest_outputs: after ? [{name: 'bash python3 load_test.py --kassat 60', turn: 15, tokens: 24800}] : [
      {name: 'read Kuormitustesti-loki.csv', turn: 9, tokens: 31200},
      {name: 'bash python3 load_test.py --kassat 60', turn: 15, tokens: 24800},
      {name: 'bash docx2txt Projektisuunnitelma.docx', turn: 8, tokens: 3400},
      {name: 'bash himalaya message read 4127', turn: 14, tokens: 2900},
      {name: 'bash docx2txt Viikkoraportti vko 45.docx', turn: 12, tokens: 2300},
    ],
    compactions: after ? [comp1, comp2] : [comp1],
    next_compaction: after ? null : {from_turn: NEXT.from, through_turn: NEXT.through, kept_from_turn: NEXT.keptFrom, split_turn: false, summarized_tokens: 61800},
    turns, turns_omitted: 0,
  };
}
const usage = (): ContextUsage => store.phase === 'known'
  ? {phase: 'known', tokens: MEASURED, window: WINDOW, autoCompaction: true, reserve: RESERVE, model: 'Claude Sonnet 5'}
  : {phase: store.phase, window: WINDOW, autoCompaction: true, reserve: RESERVE, model: 'Claude Sonnet 5'};

/** The instruction sent with Pi's compaction, written from the person's marks. */
function instructionText() {
  const names = (m: Mark) => ITEMS.filter((it) => store.marks[it.id] === m).map((it) => it.name);
  const keep = names('keep'), drop = names('drop');
  return [keep.length ? `Säilytä yhteenvedossa olennainen näistä: ${keep.join(', ')}.` : '', drop.length ? `Näitä ei tarvita jatkossa: ${drop.join(', ')}.` : ''].filter(Boolean).join(' ');
}
function compactNow() {
  store.instruction = instructionText();
  store.phase = 'compacting'; notify();
  timer = window.setTimeout(() => {
    store.phase = 'after'; store.keptFrom = NEXT.keptFrom; store.marks = {}; notify();
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
function useNarrow() {
  const q = '(max-width: 760px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setNarrow(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return narrow;
}
const verbText = (o: Op) => `${o.verb}${o.cmd && o.verb !== 'Ajoi' ? ' komennolla' : ''}`;
function ItemIcon({it}: {it: Item}) {
  return <span className="cx-src" data-src={it.src} aria-hidden="true"><Icon name={SRC[it.src].icon} /></span>;
}
function StateTag({it}: {it: Item}) {
  const s = useStore();
  if (s.phase === 'compacting') return <span className="cx-tag" data-st="busy">Tiivistyy…</span>;
  return isIn(it)
    ? <span className="cx-tag" data-st="in" data-testid="tag-in">{short(inContext(it))}</span>
    : <span className="cx-tag" data-st="sum" data-testid="tag-sum">Tiivistetty</span>;
}
function MarkButtons({it}: {it: Item}) {
  const s = useStore();
  const m = s.marks[it.id];
  const set = (v: Mark) => { if (m === v) delete store.marks[it.id]; else store.marks[it.id] = v; notify(); };
  return (
    <span className="cx-marks" role="group" aria-label={`Merkitse ${it.name}`}>
      <ControlButton data-testid={`keep-${it.id}`} size="inline" variant="secondary" aria-pressed={m === 'keep'} onPress={() => set('keep')}><Icon name="check" />Tärkeä</ControlButton>
      <ControlButton data-testid={`drop-${it.id}`} size="inline" variant="secondary" aria-pressed={m === 'drop'} onPress={() => set('drop')}><Icon name="cross" />Ei tarvita</ControlButton>
    </span>
  );
}

/** The confirm before Pi's compaction: what is summarized, what stays, the instruction. */
function CompactDialog({open, onClose}: {open: boolean; onClose: () => void}) {
  useStore();
  const text = instructionText();
  const stays = ITEMS.filter((it) => it.ops.some((o) => o.turn >= NEXT.keptFrom));
  return (
    <ModalOverlay className="ah-overlay" isOpen={open} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal cx-modal">
        <AriaDialog className="ah-dialog" data-testid="compact-dialog" aria-label="Tiivistä nyt">
          <Heading slot="title">Tiivistä nyt</Heading>
          <p className="s-desc">Vuorot {NEXT.from}–{NEXT.through} (noin {fmt(61800)} tokenia) korvautuvat yhteenvedolla, joka päivittää edellisen tiivistelmän. Vuorot {NEXT.keptFrom}–16 säilyvät sellaisinaan, myös niissä luettu:</p>
          <ul className="cx-stay">{stays.map((it) => <li key={it.id}><ItemIcon it={it} /><span>{it.name}</span><span className="cx-num">{short(it.ops.filter((o) => o.turn >= NEXT.keptFrom).reduce((a, o) => a + o.tokens, 0))}</span></li>)}</ul>
          <p className="cx-label">Ohje yhteenvedolle</p>
          <p className="cx-instruction" data-testid="compact-instruction">{text || 'Ei ohjetta: agentti päättää itse, mitä yhteenvetoon jää.'}</p>
          <p className="cx-fine">Konteksti on tiivistyksen jälkeen noin {fmt(AFTER_ESTIMATE)} tokenia. Tiivistetyt vuorot jäävät keskusteluun luettaviksi, mutta agentti ei enää näe niitä sellaisinaan.</p>
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" onPress={onClose}>Peruuta</ControlButton>
            <ControlButton data-testid="compact-confirm" size="row" variant="primary" onPress={() => { onClose(); compactNow(); }}>Tiivistä</ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
function MarksBar({onCompact}: {onCompact: () => void}) {
  const s = useStore();
  const keep = Object.values(s.marks).filter((m) => m === 'keep').length;
  const drop = Object.values(s.marks).filter((m) => m === 'drop').length;
  if (s.phase === 'compacting') return <p className="cx-marksbar" data-testid="compacting" role="status"><span className="cx-spin" aria-hidden="true" />Agentti tiivistää keskustelua…</p>;
  if (s.phase === 'after') return <p className="cx-marksbar done" data-testid="compacted" role="status"><Icon name="check" />Tiivistetty. Tarkka koko näkyy agentin seuraavan vastauksen jälkeen.</p>;
  return (
    <div className="cx-marksbar" data-testid="marks-bar">
      <span>{keep || drop ? [keep ? `${keep} tärkeää` : '', drop ? `${drop} ei tarvita` : ''].filter(Boolean).join(' · ') : `Tilaa ennen automaattista tiivistystä ${fmt(THRESHOLD - MEASURED)} tokenia.`}</span>
      <ControlButton data-testid="compact-open" size="row" variant={keep || drop ? 'primary' : 'secondary'} onPress={onCompact}>Tiivistä nyt…</ControlButton>
    </div>
  );
}

// ---------- A: the items panel ----------

function ItemRow({it, open, onToggle}: {it: Item; open: boolean; onToggle: () => void}) {
  const s = useStore();
  const last = lastOp(it);
  return (
    <li className="cx-item" data-open={open || undefined} data-in={isIn(it) || undefined} data-mark={s.marks[it.id]}>
      <button type="button" className="cx-item-row" data-testid={`item-${it.id}`} aria-expanded={open} onClick={onToggle}>
        <ItemIcon it={it} />
        <span className="cx-item-text">
          <span className="cx-item-name">{it.name}</span>
          <span className="cx-meta">{verbText(last)} vuorossa {last.turn} · {SRC[it.src].label}</span>
        </span>
        {s.marks[it.id] ? <span className="cx-markdot" data-m={s.marks[it.id]}>{s.marks[it.id] === 'keep' ? 'Tärkeä' : 'Ei tarvita'}</span> : null}
        <StateTag it={it} />
      </button>
      {open ? (
        <div className="cx-item-more" data-testid={`more-${it.id}`}>
          <p className="cx-meta">{it.place}</p>
          <ol className="cx-ops">
            {it.ops.map((o, i) => <li key={i}><span>{o.at}</span><span>{verbText(o)} · vuoro {o.turn}</span><span className="cx-num">{o.turn >= s.keptFrom ? short(o.tokens) : <s>{short(o.tokens)}</s>}</span></li>)}
          </ol>
          <p className="cx-fine">{isIn(it)
            ? `Agentti näkee tämän sellaisenaan. ${it.ops.some((o) => o.turn < NEXT.keptFrom) && s.phase === 'known' ? `Seuraava tiivistys korvaa vuoron ${it.ops.filter((o) => o.turn < NEXT.keptFrom).map((o) => o.turn).join(' ja ')} sisällön yhteenvedolla.` : 'Säilyy seuraavassa tiivistyksessä.'}`
            : `Agentti ei enää näe tätä sellaisenaan. ${listedBySummary(it) ? 'Nimi on tiivistelmän tiedostolistassa.' : 'Tiivistelmässä on vain se, mitä yhteenveto siitä kertoo.'}`}</p>
          <div className="cx-actions">
            {isIn(it) && s.phase === 'known' ? <MarkButtons it={it} /> : null}
            {!isIn(it) && it.src !== 'cmd' ? <ControlButton data-testid={`reread-${it.id}`} size="inline" variant="secondary" onPress={() => askToRead(it)}><Icon name="refresh" />Pyydä lukemaan uudelleen</ControlButton> : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
function APanel({onClose, onCompact, onFull}: {onClose: () => void; onCompact: () => void; onFull: () => void}) {
  const s = useStore();
  const [filter, setFilter] = useState<'in' | 'sum' | 'all'>('in');
  const [open, setOpen] = useState<string | null>(null);
  const shown = ITEMS.filter((it) => filter === 'all' || (filter === 'in' ? isIn(it) : !isIn(it)));
  const groups: [string, Item[]][] = [
    ['Muutti', shown.filter(changed)],
    ['Luki', shown.filter((it) => !changed(it) && it.src !== 'cmd')],
    ['Ajoi', shown.filter((it) => it.src === 'cmd')],
  ];
  const nIn = ITEMS.filter(isIn).length;
  const out = toolOutput();
  const total = s.phase === 'after' ? AFTER_ESTIMATE : MEASURED;
  return (
    <section className="ah-view-pane ah-file-shelf cx-panel" data-testid="a-panel" aria-label="Konteksti">
      <header className="ah-editor-header">
        <h2 className="ah-view-title">Konteksti</h2>
        <span className="ah-editor-controls">
          <ControlButton data-testid="a-close" size="row" variant="quiet" aria-label="Sulje" title="Sulje" onPress={onClose}><Icon name="cross" /></ControlButton>
        </span>
      </header>
      <div className="ah-file-shelf-scroll cx-panel-scroll">
        <div className="cx-sum" data-testid="a-summary">
          <p className="cx-big">{s.phase === 'known' ? pct(MEASURED, WINDOW) : '?'} <span>{s.phase === 'known' ? `${fmt(MEASURED)} / ${fmt(WINDOW)} tokenia` : `noin ${fmt(total)} tokenia`}</span></p>
          <div className="cx-minibar" aria-hidden="true">
            <i data-k="base" style={{width: `${((total - out) / WINDOW) * 100}%`}} />
            <i data-k="items" style={{width: `${(out / WINDOW) * 100}%`}} />
            <b style={{left: `${(THRESHOLD / WINDOW) * 100}%`}} />
          </div>
          <p className="cx-meta"><span className="cx-key" data-k="items" />Luettu ja ajettu {short(out)} · <span className="cx-key" data-k="base" />ohjeet, keskustelu ja tiivistelmä {short(total - out)}</p>
        </div>
        <Segmented data-testid="a-filter" label="Näytä" value={filter} onChange={(v) => { setFilter(v); setOpen(null); }} size="row"
          options={[{id: 'in', label: `Agentilla nyt ${nIn}`}, {id: 'sum', label: `Tiivistetty ${ITEMS.length - nIn}`}, {id: 'all', label: 'Kaikki'}]} />
        {groups.map(([h, list]) => list.length ? (
          <div key={h} className="cx-group">
            <h3 className="cx-h3">{h}</h3>
            <ul className="cx-items" data-testid={`group-${h}`}>
              {list.map((it) => <ItemRow key={it.id} it={it} open={open === it.id} onToggle={() => setOpen(open === it.id ? null : it.id)} />)}
            </ul>
          </div>
        ) : null)}
        {!shown.length ? <p className="cx-fine">Ei mitään tässä näkymässä.</p> : null}
        <MarksBar onCompact={onCompact} />
        <button type="button" className="cx-link" data-testid="a-full" onClick={onFull}>Koko erittely: ohjeet, vuorot ja tiivistykset</button>
      </div>
    </section>
  );
}

// ---------- B: where the size goes, inside the production page ----------

type Block = {id: string; name: string; meta: string; tokens: number; k: string; item?: Item};
function blocks(): Block[] {
  const after = store.phase === 'after';
  const d = detail();
  const items = ITEMS.filter(isIn).map((it) => ({id: it.id, name: it.name, meta: `${SRC[it.src].label} · ${verbText(lastOp(it)).toLowerCase()} vuorossa ${lastOp(it).turn}`, tokens: inContext(it), k: 'out', item: it}));
  return [
    ...items,
    {id: 'thinking', name: 'Agentin ajattelu', meta: 'Keskustelu', tokens: d.conversation.thinking, k: 'talk'},
    {id: 'replies', name: 'Agentin vastaukset', meta: 'Keskustelu', tokens: d.conversation.assistant, k: 'talk'},
    {id: 'calls', name: 'Työkalukutsut', meta: 'Keskustelu', tokens: d.conversation.tool_calls, k: 'talk'},
    {id: 'you', name: 'Viestisi', meta: 'Keskustelu', tokens: d.conversation.user, k: 'talk'},
    {id: 'skills', name: 'Skillit', meta: 'Ohjeet', tokens: 10700, k: 'sys'},
    {id: 'agents', name: 'AGENTS.md ja projektin ohjeet', meta: 'Ohjeet', tokens: 4800, k: 'sys'},
    {id: 'otherSys', name: 'Muut ohjeet', meta: 'Ohjeet', tokens: 3700, k: 'sys'},
    {id: 'sum', name: 'Tiivistelmä', meta: after ? 'Vuorot 1–14' : 'Vuorot 1–7', tokens: d.parts.summary, k: 'sum'},
    {id: 'tools', name: 'Työkalujen kuvaukset', meta: 'Ohjeet', tokens: 2400, k: 'tools'},
    ...(after ? [] : [{id: 'rest', name: 'Erittelemätön', meta: 'Mitatun ja arvioidun ero', tokens: MEASURED - 122700, k: 'rest'}]),
  ].filter((b) => b.tokens > 0).sort((x, y) => y.tokens - x.tokens);
}
function BSection({onCompact}: {onCompact: () => void}) {
  const s = useStore();
  const [hover, setHover] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const list = blocks();
  const total = s.phase === 'after' ? AFTER_ESTIMATE : MEASURED;
  const top = list[0];
  const gone = ITEMS.filter((it) => !isIn(it)).sort((x, y) => wasTokens(y) - wasTokens(x));
  const order = ['out', 'talk', 'sum', 'sys', 'tools', 'rest'];
  const barList = [...list].sort((x, y) => order.indexOf(x.k) - order.indexOf(y.k) || y.tokens - x.tokens);
  return (
    <section className="cx-b" data-testid="b-section" aria-labelledby="cx-b-h">
      <h3 id="cx-b-h">Mihin konteksti kuluu</h3>
      <div className="cx-blockbar" aria-hidden="true">
        {barList.map((b) => <i key={b.id} data-k={b.k} data-hover={hover === b.id || undefined} style={{width: `${(b.tokens / WINDOW) * 100}%`}} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} />)}
        <b style={{left: `${(THRESHOLD / WINDOW) * 100}%`}} />
      </div>
      {s.phase === 'known' && top?.item ? (
        <p className="ah-cd-text" data-testid="b-lead">Suurin yksittäinen osa on <strong>{top.name}</strong>: {pct(top.tokens, total)} kontekstista, {verbText(lastOp(top.item)).toLowerCase()} vuorossa {lastOp(top.item).turn}. Luetut tiedostot, viestit ja komentojen tulosteet vievät yhteensä {pct(toolOutput(), total)}.</p>
      ) : null}
      <table className="ah-cd-table cx-blocks" data-testid="b-blocks">
        <thead><tr><th scope="col">Osa</th><th scope="col" className="num">Tokenia</th><th scope="col" className="num">Osuus</th><th scope="col"><span className="ah-visually-hidden">Merkintä</span></th></tr></thead>
        <tbody>
          {(all ? list : list.slice(0, 9)).map((b) => (
            <tr key={b.id} data-k={b.k} data-hover={hover === b.id || undefined} data-mark={b.item ? s.marks[b.item.id] : undefined} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)}>
              <th scope="row">
                <span className="cx-bname"><span className="ah-cd-sw" aria-hidden="true" />{b.item ? <ItemIcon it={b.item} /> : null}<span className={b.item?.src === 'cmd' ? 'mono' : undefined}>{b.name}</span></span>
                <span className="cx-meta">{b.meta}</span>
              </th>
              <td className="num">{fmt(b.tokens)}</td>
              <td className="num">{pct(b.tokens, total)}</td>
              <td className="cx-bmark">{b.item && s.phase === 'known' ? (
                <ControlButton data-testid={`bdrop-${b.item.id}`} size="inline" variant="secondary" aria-pressed={s.marks[b.item.id] === 'drop'}
                  onPress={() => { if (store.marks[b.item!.id] === 'drop') delete store.marks[b.item!.id]; else store.marks[b.item!.id] = 'drop'; notify(); }}>
                  {s.marks[b.item.id] === 'drop' ? <><Icon name="check" />Ei tarvita</> : 'Ei tarvita'}
                </ControlButton>
              ) : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length > 9 ? <button type="button" className="cx-link" data-testid="b-more" onClick={() => setAll(!all)}>{all ? 'Näytä vähemmän' : `Näytä kaikki ${list.length} osaa`}</button> : null}
      <MarksBar onCompact={onCompact} />
      <h3>Tiivistetty pois</h3>
      <p className="ah-cd-fine">Agentti luki nämä aiemmin, mutta näkee ne nyt vain tiivistelmän kautta.</p>
      <ul className="cx-gone" data-testid="b-gone">
        {gone.map((it) => (
          <li key={it.id}>
            <ItemIcon it={it} />
            <span className="cx-item-text"><span className={`cx-item-name${it.src === 'cmd' ? ' mono' : ''}`}>{it.name}</span><span className="cx-meta">{SRC[it.src].label} · vuoro {it.ops.map((o) => o.turn).filter((v, i, a) => a.indexOf(v) === i).join(', ')} · oli {short(wasTokens(it))}</span></span>
            {it.src !== 'cmd' ? <ControlButton data-testid={`breread-${it.id}`} size="inline" variant="quiet" onPress={() => askToRead(it)}><Icon name="refresh" />Lue uudelleen</ControlButton> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- C: turn by turn, inside the production page ----------

function CSection({onCompact, onFork}: {onCompact: () => void; onFork: (n: number) => void}) {
  const s = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const top = Math.max(...TURNS.map((t) => t.ctx));
  const rows: React.ReactNode[] = [];
  let prev = 0;
  // Newest first: what the agent sees now is on top and each cut sits
  // below the turn it kept from.
  const groups: React.ReactNode[][] = [];
  for (const t of TURNS) {
    const pre: React.ReactNode[] = [];
    const touched = ITEMS.flatMap((it) => it.ops.filter((o) => o.turn === t.n).map((o) => ({it, o})));
    const st = t.n < s.keptFrom ? 'gone' : s.phase === 'known' && t.n <= NEXT.through ? 'next' : 'kept';
    const delta = t.n === 9 ? undefined : t.ctx - prev;
    prev = t.ctx;
    if (t.n === 9) pre.push(<li key="c1" className="cx-cut" data-testid="c-cut-1"><span className="cx-cut-line" /><span>Tiivistys 1 · 10.21 · vuorot 1–7 yhteenvedoksi · {fmt(184900)} → {fmt(34100)}</span></li>);
    if (s.phase === 'after' && t.n === NEXT.keptFrom) pre.push(<li key="c2" className="cx-cut" data-testid="c-cut-2"><span className="cx-cut-line" /><span>Tiivistys 2 · juuri nyt · vuorot 8–14 yhteenvedoksi{s.instruction ? ' ohjeesi mukaan' : ''}</span></li>);
    if (s.phase === 'known' && t.n === NEXT.keptFrom) pre.push(<li key="cn" className="cx-cut next" data-testid="c-cut-next"><span className="cx-cut-line" /><span>Seuraava tiivistys kulkisi tästä: kun käyttö ylittää {fmt(THRESHOLD)} tokenia, vuorot 8–14 korvautuvat yhteenvedolla.</span><ControlButton data-testid="c-compact" size="inline" variant="secondary" onPress={onCompact}>Tiivistä nyt…</ControlButton></li>);
    pre.unshift(
      <li key={t.n} className="cx-turn" data-st={st} data-open={open === t.n || undefined}>
        <span className="cx-tn">{t.n}</span>
        <div className="cx-turn-main">
          <button type="button" className="cx-turn-ask" data-testid={`turn-${t.n}`} aria-expanded={open === t.n} onClick={() => setOpen(open === t.n ? null : t.n)}>
            <span className="cx-meta">{t.at}</span><span className="cx-ask">{t.ask}</span>
          </button>
          {touched.length ? (
            <ul className="cx-chips">
              {touched.map(({it, o}, i) => (
                <li key={i} className="cx-chip" data-verb={o.verb} data-in={o.turn >= s.keptFrom || undefined} title={`${verbText(o)} · ${it.place}`}>
                  <ItemIcon it={it} /><span className="cx-chip-verb">{o.verb === 'Ajoi' ? 'Ajoi' : o.verb}</span><span className={`cx-chip-name${it.src === 'cmd' ? ' mono' : ''}`}>{it.name}</span><span className="cx-num">{short(o.tokens)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {open === t.n ? (
            <div className="cx-turn-more" data-testid={`turn-more-${t.n}`}>
              <p className="cx-fine">{st === 'gone' ? 'Agentti näkee tämän vuoron vain tiivistelmän kautta.' : st === 'next' ? 'Agentti näkee tämän vuoron sellaisenaan; seuraava tiivistys korvaa sen yhteenvedolla.' : 'Agentti näkee tämän vuoron sellaisenaan.'}</p>
              <div className="cx-actions">
                <ControlButton data-testid={`fork-${t.n}`} size="inline" variant="secondary" onPress={() => onFork(t.n)}><Icon name="branch" />Haaraudu tästä vuorosta</ControlButton>
                {touched.filter(({it}) => !isIn(it) && it.src !== 'cmd').slice(0, 1).map(({it}) => <ControlButton key={it.id} data-testid={`creread-${it.id}`} size="inline" variant="quiet" onPress={() => askToRead(it)}><Icon name="refresh" />Pyydä lukemaan {it.name} uudelleen</ControlButton>)}
              </div>
            </div>
          ) : null}
        </div>
        <span className="cx-growth">
          <span className="cx-growbar" aria-hidden="true"><i style={{width: `${(t.ctx / top) * 100}%`}} /></span>
          <span className="cx-num">{short(t.ctx)}</span>
          <span className="cx-num cx-delta">{delta === undefined ? '' : `${delta >= 0 ? '+' : '−'}${short(Math.abs(delta))}`}</span>
        </span>
      </li>,
    );
    groups.push(pre);
  }
  rows.push(...groups.reverse().flat());
  return (
    <section className="cx-c" data-testid="c-section" aria-labelledby="cx-c-h">
      <h3 id="cx-c-h">Vuorot ja mitä ne toivat kontekstiin</h3>
      <p className="ah-cd-keys cx-ckeys"><span><i data-st="gone" />Vain tiivistelmässä</span>{s.phase === 'known' ? <span><i data-st="next" />Tiivistyy seuraavaksi</span> : null}<span><i data-st="kept" />Agentti näkee sellaisenaan</span></p>
      <ol className="cx-turns" data-testid="c-turns">{rows}</ol>
    </section>
  );
}
function ForkDialog({turn, onClose, onFork}: {turn: number; onClose: () => void; onFork: () => void}) {
  const t = TURNS.find((x) => x.n === turn);
  return (
    <ModalOverlay className="ah-overlay" isOpen={!!turn} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal cx-modal">
        <AriaDialog className="ah-dialog" data-testid="fork-dialog" aria-label="Haaraudu tästä vuorosta">
          <Heading slot="title">Haaraudu vuorosta {turn}</Heading>
          {t ? <p className="s-desc">Uusi keskustelu sisältää vuorot 1–{turn - 1} ja niiden tiivistelmän. Vuoron {turn} viesti tulee viestikenttään muokattavaksi; mitä vuorossa {turn} ja sen jälkeen luettiin, ei tule mukaan. Tämä keskustelu jää ennalleen.</p> : null}
          {t ? <p className="cx-instruction">{t.ask}</p> : null}
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" onPress={onClose}>Peruuta</ControlButton>
            <ControlButton data-testid="fork-confirm" size="row" variant="primary" onPress={onFork}>Haaraudu</ControlButton>
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
function turnItems(forked: number) {
  const out: {id: string; kind: string; content: React.ReactNode}[] = [];
  const shown = forked ? TURNS.filter((t) => t.n >= forked - 2 && t.n < forked) : TURNS.slice(-3);
  for (const t of shown) {
    out.push({id: `u${t.n}`, kind: 'user', content: <UserMessage sourceText={t.ask} onCopy={noop} time={t.at}><Markdown text={t.ask} /></UserMessage>});
    const steps: TurnStep[] =
      t.n === 14 ? [tool('m', 'bash', 'himalaya message read 4127', <BashToolCard command="himalaya message read 4127" output={'Lähettäjä: Keskon IT\nAihe: Varmenteet: aikataulu\n\nVaihto tehdään 2.12. klo 6–8…'} />), say('s', 'Keskon IT vaihtaa varmenteet **2.12. klo 6–8**. Omistajaksi on nimetty Petri Saarinen.')]
        : t.n === 15 ? [tool('t', 'bash', 'python3 load_test.py --kassat 60', <BashToolCard command="python3 load_test.py --kassat 60" output={LOAD} />), say('s', '60 kassalla keskimääräinen vasteaika on **1,12 s** (p95 1,84 s), virheitä ei ollut. Tavoite 1,0 s ylittyy hieman.')]
          : t.n === 16 ? [tool('w', 'bash', `python3 make_report.py --template vko44 --out "${VKO45}"`, <BashToolCard command="python3 make_report.py --template vko44 --out …vko 45.docx" output="Kirjoitettu: Viikkoraportti vko 45.docx (40 kt)" />), say('s', 'Päivitin raporttiin 60 kassan tuloksen ja huomion, että tavoite ylittyy 0,12 sekunnilla.')]
            : [tool('r', 'read', 'Avoimet kysymykset.md', <FileToolCard name="read" argumentsText="{}" output="# Avoimet kysymykset" />), say('s', 'Selvä.')];
    out.push({id: `a${t.n}`, kind: 'assistant', content: <AgentTurn steps={steps.map((x, i) => ({...x, at: T0 + i * 30000}))} startedAt={T0} duration="1 min 4 s" />});
  }
  return out;
}

function Main({direction}: {direction: number}) {
  const s = useStore();
  const narrow = useNarrow();
  // Nyt, B and C open the production page from the ring; A opens its panel.
  const [page, setPage] = useState(direction !== A);
  const [panel, setPanel] = useState(direction === A && !narrow);
  const [panelWidth, setPanelWidth] = useState(440);
  const [compactOpen, setCompactOpen] = useState(false);
  const [forkTurn, setForkTurn] = useState(0);
  useEffect(() => { if (direction === A && narrow) setPanel(true); }, [direction, narrow]);
  const toggle = () => (direction === A ? setPanel(!panel) : setPage(!page));
  const forked = s.forked;
  const title = forked ? 'Keskon viikkoraportti (haara)' : 'Keskon viikkoraportti';

  const now = Date.now();
  const convs = [
    ...(forked ? [{id: 'fork', title: 'Keskon viikkoraportti (haara)', since: 0}] : []),
    {id: 'kesko', title: 'Keskon viikkoraportti', since: 3},
    {id: 'valio', title: 'Valion vaatimukset', since: 1500},
  ];
  const model = (c: {id: string; title: string; since: number}): AgentNavModel => ({
    agentId: c.id, href: `/workspaces/ws_r?conversation=${c.id}`, title: c.title, workspaceId: 'ws_r', workspaceName: 'raportit',
    changedAt: now - c.since * 60000, activity: 'waiting', activityLabel: 'Odottaa viestiä', controlLabel: '',
    detail: 'raportit · Odottaa viestiä', selected: c.id === (forked ? 'fork' : 'kesko'),
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

  const showPage = page && !forked;
  const conversation = (
    <div className="ah-state cx-main">
      <ConversationFrame className={showPage ? 'ah-frame-context' : undefined}>
        <AgentHeader title={title} workspaceLabel="raportit" workspaceHref="/workspaces/ws_r"
          activityLabel={s.phase === 'compacting' ? 'Tiivistää' : ''} activityAnimated={s.phase === 'compacting'} activityKind={s.phase === 'compacting' ? 'working' : 'neutral'}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop}
          contextIndicator={forked ? undefined : <ContextRing usage={usage()} open={direction === A ? panel : page} onToggle={toggle} />} />
        {showPage ? <ContextPage detail={{state: 'ready', detail: detail()}} usage={usage()} title={title} onClose={() => setPage(false)} /> : null}
        <ConversationStream>
          <ConversationTimeline key={`${forked}-${s.phase}`} state="ready" items={turnItems(forked)} historyMode="pagedAccessible" onJumpToLatest={noop} />
        </ConversationStream>
        <Composer value={s.draft} onChange={(v) => { store.draft = v; notify(); }} activity="idle" selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} sources={sources} csrf="prototype"
          modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
      </ConversationFrame>
      {showPage && direction === B ? <Into after=".ah-cd-top"><BSection onCompact={() => setCompactOpen(true)} /></Into> : null}
      {showPage && direction === C ? <Into after=".ah-cd-top"><CSection onCompact={() => setCompactOpen(true)} onFork={setForkTurn} /></Into> : null}
    </div>
  );
  const main = direction === A && !forked ? (
    <ViewSplit open={panel} expanded={false} width={panelWidth} min={360} max={640}
      panel={panel ? <APanel onClose={() => setPanel(false)} onCompact={() => setCompactOpen(true)} onFull={() => { setPanel(false); setPage(true); }} /> : null}
      onResize={(w) => setPanelWidth(Math.min(640, Math.max(360, w)))} onReset={() => setPanelWidth(440)} onShowConversation={() => setPanel(false)}>
      {conversation}
    </ViewSplit>
  ) : conversation;
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} rail={railView} main={main} />
      <CompactDialog open={compactOpen} onClose={() => setCompactOpen(false)} />
      <ForkDialog turn={forkTurn} onClose={() => setForkTurn(0)} onFork={() => {
        const t = TURNS.find((x) => x.n === forkTurn)!;
        store.forked = forkTurn; store.draft = t.ask; setForkTurn(0); setPage(false); notify();
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
        <strong>Keskustelun konteksti</strong>
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
            <Main direction={direction} />
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
