import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AccountShelf} from '../../../../web/src/components/Account';
import {AgentTurn, ThinkingRow, type TurnStep} from '../../../../web/src/components/AgentTurn';
import {BashToolCard} from '../../../../web/src/components/BashToolCard';
import {ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {FileToolCard, fileStat} from '../../../../web/src/components/FileToolCard';
import {Icon} from '../../../../web/src/components/Icon';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {PiToolUse} from '../../../../web/src/components/PiBlocks';
import {Checkbox} from '../../../../web/src/components/Primitives';
import {StatusBellProvider, type StatusItem} from '../../../../web/src/components/StatusBell';
import {TurnChanges} from '../../../../web/src/components/TurnChanges';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {type ToolStep, turnChanges} from '../../../../web/src/app/turnChanges';
import {clockTime} from '../../../../web/src/app/integrations';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Integrations.css';
import {type Dry, type Lang, TEXT} from './text';
import './round.css';

// bisync-force-needs-consent, round 3. Jari 16.11.2026 on round 2: direction
// A Kortti (Habitat's own card in the conversation right after the turn whose
// edits stopped sync), consent only through the card's button and bound to
// the count; the agent may bring the same card with a command
// (open-habitat agent sync request-consent) but never consents, and a yes
// typed to the agent is not consent; bell and Settings card when no
// conversation caused the stop; the too-many-deletions stop gets the same
// card. This round makes the card concrete. Axis: how the card gets from the
// stop to the consent. A counts on request and folds to an openable receipt,
// B arrives with the count and a button that names the action, C counts on
// request and names the files. Same in every direction: who brings the card
// (Habitat, the agent, the agent after a yes), the stop kind, and question 4
// (a forced pass whose count had no deletions cannot delete). The view is
// production's conversation as in round 2. Everything is synthetic.

const NAMES = ['A Pyynnöstä', 'B Valmiina', 'C Nimeltä'];
const A = 0, B = 1, C = 2;
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const fmt = (v: number) => v.toLocaleString(lang === 'fi' ? 'fi-FI' : 'en-GB');

// ---- The stops and what the agents did (synthetic) ----
type Data = 'few' | 'mixed' | 'moved';
type Origin = 'habitat' | 'agent' | 'yes';
const DRY: Record<Data, Dry> = {
  // Every note's heading was edited and two templates were added.
  few: {stop: 'changed', up: {changed: 14, added: 2, deleted: 0}, down: {changed: 0, added: 0, deleted: 0}, total: 16},
  // Every heading edited and three old drafts deleted: still all-files-changed.
  mixed: {stop: 'changed', up: {changed: 13, added: 0, deleted: 3}, down: {changed: 0, added: 0, deleted: 0}, total: 16},
  // 212 of 240 files moved inside the folder: the cloud sees 212 deletions,
  // more than half, so bisync stops on too many deletes before anything else.
  moved: {stop: 'deletes', up: {changed: 4, added: 212, deleted: 212}, down: {changed: 0, added: 1, deleted: 0}, total: 240},
};
const NOTES = [
  ['2026-08-21', 'Syyskauden suunnittelu'], ['2026-08-28', 'Budjetti'], ['2026-09-04', 'Tiimipalaveri'],
  ['2026-09-11', 'Asiakastapaaminen'], ['2026-09-18', 'Tiimipalaveri'], ['2026-09-25', 'Julkaisu'],
  ['2026-10-02', 'Tiimipalaveri'], ['2026-10-09', 'Retrospektiivi'], ['2026-10-16', 'Tiimipalaveri'],
  ['2026-10-23', 'Rekrytointi'], ['2026-10-30', 'Tiimipalaveri'], ['2026-11-04', 'Hallitus'],
  ['2026-11-05', 'Tiimipalaveri'], ['2026-11-10', 'Vuosisuunnitelma'],
];
const noteFile = ([d, x]: string[]) => `Muistiinpanot/${d}-${x.toLowerCase().replaceAll(' ', '-')}.md`;
const DRAFTS = ['Muistiinpanot/luonnos-budjetti.md', 'Muistiinpanot/luonnos-julkaisu.md', 'Muistiinpanot/luonnos-strategia.md'];
const INDEXES = ['Raportit/README.md', 'Arkisto/README.md', 'Muistiinpanot/hakemisto.md', 'Kokoukset/hakemisto.md'];
const REPORTS = Array.from({length: 212}, (_, i) => `2025-${String(1 + Math.floor(i / 18)).padStart(2, '0')}-${String(1 + (i % 18)).padStart(2, '0')}-raportti.md`);
type Groups = {upDeleted: string[]; upChanged: string[]; upAdded: string[]; downAdded: string[]};
const FILES: Record<Data, Groups> = {
  few: {upDeleted: [], upChanged: NOTES.map(noteFile), upAdded: ['Muistiinpanot/2026-11-06-tiimipalaveri.md', 'Muistiinpanot/2026-11-13-tiimipalaveri.md'], downAdded: []},
  mixed: {upDeleted: DRAFTS, upChanged: NOTES.slice(0, 13).map(noteFile), upAdded: [], downAdded: []},
  moved: {upDeleted: REPORTS.map((r) => `Raportit/${r}`), upChanged: INDEXES, upAdded: REPORTS.map((r) => `Arkisto/2025/${r}`), downAdded: ['Kokoukset/2026-11-14-hallitus.docx']},
};
const oldHeading = (d: string, topic: string) => {
  const [, m, day] = d.split('-');
  return `# ${topic} ${Number(day)}.${Number(m)}.`;
};
const T0 = Date.UTC(2026, 10, 16, 9, 12);
function toolSteps(data: Data): ToolStep[] {
  const edits = (list: string[][]) => list.map(([d, x], i): ToolStep => ({callId: `e${i}`, tool: 'edit', failed: false, at: T0 + 9000 + i * 3000, output: 'Successfully replaced text.',
    args: JSON.stringify({path: noteFile([d, x]), edits: [{oldText: oldHeading(d, x), newText: `# ${d} – ${x}`}]})}));
  if (data === 'few')
    return [
      {callId: 'ls', tool: 'bash', args: JSON.stringify({command: 'ls Muistiinpanot'}), output: NOTES.map((x) => noteFile(x).slice(14)).join('\n'), failed: false, at: T0 + 4000},
      ...edits(NOTES),
      ...['2026-11-06', '2026-11-13'].map((d, i): ToolStep => ({callId: `w${i}`, tool: 'write', failed: false, at: T0 + 60000 + i * 3000, output: 'Wrote file.',
        args: JSON.stringify({path: `Muistiinpanot/${d}-tiimipalaveri.md`, content: `# ${d} – Tiimipalaveri\n\n## Osallistujat\n\n## Asiat\n\n## Päätökset\n`})})),
    ];
  if (data === 'mixed')
    return [
      ...edits(NOTES.slice(0, 13)),
      {callId: 'rm', tool: 'bash', args: JSON.stringify({command: 'rm -v Muistiinpanot/luonnos-*.md'}), output: DRAFTS.map((p) => `removed '${p}'`).join('\n'), failed: false, at: T0 + 60000},
    ];
  return [
    {callId: 'mv', tool: 'bash', args: JSON.stringify({command: 'mkdir -p Arkisto/2025 && mv Raportit/2025-* Arkisto/2025/ && ls Arkisto/2025 | wc -l'}), output: '212', failed: false, at: T0 + 6000},
    ...INDEXES.map((p, i): ToolStep => ({callId: `e${i}`, tool: 'edit', failed: false, at: T0 + 14000 + i * 4000, output: 'Successfully replaced text.',
      args: JSON.stringify({path: p, edits: [{oldText: '[Vuoden 2025 raportit](../Raportit/)', newText: '[Vuoden 2025 raportit](../Arkisto/2025/)'}]})})),
  ];
}
function bashStep(key: string, at: number, command: string, output: string): TurnStep {
  return {kind: 'tool', key, at, node: (
    <div className="ah-ordered-blocks"><PiToolUse name="bash" state="succeeded" targetText={command} keepMounted>
      <BashToolCard command={command} output={output} running={false} />
    </PiToolUse></div>)};
}
// Production's history wraps each work block in .ah-ordered-blocks, which puts
// it in the turn's content column; a bare block falls into the rail column.
function stepNodes(steps: ToolStep[]): TurnStep[] {
  return steps.map((s): TurnStep => {
    const args = JSON.parse(s.args) as {command?: string; path?: string};
    if (s.tool === 'bash') return bashStep(s.callId, s.at, args.command ?? '', s.output ?? '');
    return {kind: 'tool', key: s.callId, at: s.at, node: (
      <div className="ah-ordered-blocks"><PiToolUse name={s.tool} state="succeeded" targetText={args.path} stat={fileStat(s.tool, s.args, s.output)}>
        <FileToolCard name={s.tool} argumentsText={s.args} output={s.output} />
      </PiToolUse></div>)};
  });
}
const WS_ROOT = '/home/aino/cloud/microsoft/aino@example.test/onedrive';
const CONSENT_CMD = 'open-habitat agent sync request-consent onedrive --current';
// The command's JSON envelope (AI-first CLI canon): it shows the card, it does not consent.
const CONSENT_OUT = JSON.stringify({result: {folder: 'onedrive', conversation: 'pi:3f0c9a2e-…', card: 'shown', consent: 'person_only', sync: 'stopped'}}, null, 1);

// ---- The person's host, as the round imagines the daemon reports it ----
type Phase = 'stopped' | 'counting' | 'counted' | 'running' | 'done' | 'refused' | 'failed';
/** here: the conversation that caused the stop is open; elsewhere: another
 * conversation is open; none: no conversation caused the stop. */
type Where = 'here' | 'elsewhere' | 'none';
type Host = {phase: Phase; where: Where; open: boolean; agree: boolean; changed: boolean; slipNext: boolean; slip: boolean;
  cancelled: boolean; countedAt: string; doneAt: string; detail: boolean; receipt: boolean};
const nowClock = () => clockTime(new Date().toISOString()) ?? '';
/** B arrives with the count made at the moment of the stop. */
const base = (): Host => ({phase: 'stopped', where: 'here', open: false, agree: false, changed: false, slipNext: false, slip: false,
  cancelled: false, countedAt: direction === B ? nowClock() : '', doneAt: '', detail: false, receipt: false});
const SCENARIOS: Record<string, () => Host> = {
  pysahtyi: () => base(),
  lasketaan: () => ({...base(), phase: 'counting'}),
  laskettu: () => ({...base(), phase: 'counted', countedAt: nowClock()}),
  kaynnissa: () => ({...base(), phase: 'running', countedAt: nowClock()}),
  valmis: () => ({...base(), phase: 'done', countedAt: nowClock(), doneAt: nowClock()}),
  peruttu: () => ({...base(), cancelled: true, countedAt: nowClock()}),
  torjuttu: () => ({...base(), phase: 'refused', countedAt: nowClock()}),
  epaonnistui: () => ({...base(), phase: 'failed'}),
  livahti: () => ({...base(), phase: 'done', countedAt: nowClock(), doneAt: nowClock(), slip: true}),
  muualla: () => ({...base(), where: 'elsewhere'}),
  eikeskustelua: () => ({...base(), where: 'none'}),
};
const SCENARIO_IDS = Object.keys(SCENARIOS);
const params = new URLSearchParams(location.search);
let scenario = params.get('s') ?? 'pysahtyi';
if (!SCENARIOS[scenario]) scenario = 'pysahtyi';
let data: Data = (['few', 'mixed', 'moved'] as const).find((v) => v === params.get('data')) ?? 'few';
let origin: Origin = (['habitat', 'agent', 'yes'] as const).find((v) => v === params.get('origin')) ?? 'habitat';
/** Question 4: a forced pass whose count had no deletions cannot delete. */
let safe = params.get('q4') !== 'open';
let direction = 0;
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const set = (next: Partial<Host>) => { host = {...host, ...next}; listeners.forEach((f) => f()); };
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stoppedLike = (p: Phase) => p !== 'running' && p !== 'done';
const dry = () => DRY[data];
const deletions = () => dry().up.deleted + dry().down.deleted;
/** The guard only protects a count that had no deletions. */
const guarded = () => safe && deletions() === 0;
/** What the person sees in the card: B shows its count while stopped. */
const showsCount = (h: Host) => h.phase === 'counted' || (direction === B && (h.phase === 'stopped' || h.phase === 'refused') && !h.cancelled);

// ---- Flow: count -> consent -> one forced pass ----
let run = 0;
async function count(open = false) {
  const me = ++run;
  set({phase: 'counting', open: open || host.open, agree: false, changed: false, cancelled: false});
  await later(900);
  if (me === run) set({phase: 'counted', countedAt: nowClock()});
}
async function proceed() {
  const me = ++run;
  const {changed, slipNext} = host;
  set({open: false});
  // The consent names the count it was shown; a later change is not covered.
  // B recounts by itself and shows the new count with the refusal.
  if (changed) { set({phase: 'refused', changed: false, agree: false, countedAt: direction === B ? nowClock() : host.countedAt}); return; }
  set({phase: 'running'});
  await later(1600);
  if (me !== run) return;
  set({phase: 'done', doneAt: nowClock(), slip: slipNext, slipNext: false});
}
const cancel = () => { ++run; set({phase: 'stopped', open: false, agree: false, cancelled: true}); };
let toastSink: (s: string) => void = () => {};
let draftSink: (s: string) => void = () => {};
let goSink: (s: string) => void = () => {};

// ---- The count ----
function Table() {
  const x = t();
  const d = dry();
  const cell = (v: number, del = false) => <td data-zero={v === 0 || undefined} data-danger={(del && v > 0) || undefined}>{fmt(v)}</td>;
  return (
    <table className="rq-table" data-testid="dry-table">
      <caption>{x.tableCaption}</caption>
      <thead><tr><th scope="col"><span className="rq-sr">{x.tableCaption}</span></th><th scope="col">{x.changed}</th><th scope="col">{x.added}</th><th scope="col">{x.deleted}</th></tr></thead>
      <tbody>
        <tr data-side="up"><th scope="row">{x.up}</th>{cell(d.up.changed)}{cell(d.up.added)}{cell(d.up.deleted, true)}</tr>
        <tr data-side="down"><th scope="row">{x.down}</th>{cell(d.down.changed)}{cell(d.down.added)}{cell(d.down.deleted, true)}</tr>
      </tbody>
    </table>
  );
}
/** C: the files by name, deletions first, five of each and the rest on request. */
function Names() {
  const x = t();
  const g = FILES[data];
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups: [keyof Groups, string][] = [['upDeleted', x.groupUpDeleted], ['upChanged', x.groupUpChanged], ['upAdded', x.groupUpAdded], ['downAdded', x.groupDownAdded]];
  return (
    <div className="rq-names" data-testid="dry-names">
      {groups.filter(([k]) => g[k].length).map(([k, label]) => {
        const all = g[k];
        const shown = open[k] ? all : all.slice(0, 5);
        return (
          <section key={k} className="rq-group" data-group={k}>
            <h4 className={k === 'upDeleted' ? 'rq-del' : undefined}>{label} <span className="rq-num">{fmt(all.length)}</span></h4>
            <ul className={open[k] && all.length > 12 ? 'rq-scroll' : undefined}>{shown.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
            {all.length > 5 ? (
              <button type="button" className="rq-link" data-testid={`more-${k}`} aria-expanded={!!open[k]} onClick={() => setOpen({...open, [k]: !open[k]})}>
                {open[k] ? x.hideFiles : x.more(all.length - 5)}
              </button>) : null}
          </section>
        );
      })}
    </div>
  );
}
function Deletions() {
  const x = t();
  const d = dry();
  if (!deletions()) return null;
  if (d.stop === 'deletes')
    return (
      <div className="ig-warn rq-many" role="alert" data-testid="dry-many">
        <Icon name="warning" />
        <div><strong>{x.manyLead(d)}</strong> {x.manyBody}</div>
      </div>);
  return <p className="ig-warn rq-few-del" data-testid="dry-few-del"><Icon name="trash" /><span>{x.fewDel(d)}</span></p>;
}
function Summary() {
  const h = useHost();
  const x = t();
  const d = dry();
  const binding = direction === B ? x.bindingB(h.countedAt) : x.bindingA(h.countedAt);
  return (
    <div className="rq-summary" data-testid="dry-summary" data-deletions={d.stop === 'deletes' ? 'many' : deletions() ? 'few' : 'none'} data-guarded={guarded() ? 'true' : 'false'}>
      <Deletions />
      <p className="rq-would" data-testid="dry-would">{x.would(d, safe)}</p>
      {direction === C ? <Names /> : direction === B ? (
        <>
          <button type="button" className="rq-link" data-testid="show-detail" aria-expanded={h.detail} onClick={() => set({detail: !h.detail})}>
            <Icon name={h.detail ? 'up' : 'down'} />{h.detail ? x.hideDetail : x.showDetail}
          </button>
          {h.detail ? <><Table /><p className="rq-fine">{x.both}</p></> : null}
        </>
      ) : <><Table /><p className="rq-fine">{x.both}</p></>}
      <p className="rq-fine" data-testid="dry-binding">{binding}</p>
      {d.stop === 'deletes' ? <Checkbox data-testid="consent-agree" label={x.agree} checked={h.agree} onChange={(v) => set({agree: v})} /> : null}
    </div>
  );
}
function ConfirmButton() {
  const h = useHost();
  const x = t();
  const d = dry();
  const del = deletions();
  const label = del ? x.confirmDelete(del) : direction === B ? x.confirmNamed(d) : x.confirm;
  return (
    <ControlButton data-testid="consent-confirm" size="row" variant={d.stop === 'deletes' ? 'danger' : 'primary'} isDisabled={d.stop === 'deletes' && !h.agree} onPress={() => void proceed()}>
      {label}
    </ControlButton>
  );
}
function CancelButton() {
  return <ControlButton data-testid="consent-cancel" size="row" variant="secondary" onPress={cancel}>{t().dontContinue}</ControlButton>;
}
function Counting({arrive = false}: {arrive?: boolean}) {
  return <p className="ig-st rq-counting" role="status" data-testid="dry-counting"><span className="ig-spin" aria-hidden="true" />{arrive ? t().countingArrive : t().counting}</p>;
}
function LookButton() {
  const h = useHost();
  const x = t();
  const again = h.phase === 'refused' || h.phase === 'failed';
  return <ControlButton data-testid="open-consent" size="row" variant={again ? 'secondary' : 'primary'} onPress={() => void count()}>{again ? x.lookAgain : x.look}</ControlButton>;
}
function AskButton() {
  return <ControlButton data-testid="ask-agent" size="row" variant="quiet" onPress={() => draftSink(t().askDraft)}><Icon name="message" />{t().askAgent}</ControlButton>;
}
function Outcome() {
  const h = useHost();
  const x = t();
  const text = h.phase === 'running' ? x.running(safe, dry())
    : h.phase === 'refused' ? (direction === B ? x.refusedB : x.refused)
    : h.phase === 'failed' ? x.failed
    : h.cancelled && h.phase === 'stopped' ? x.cancelled : '';
  if (!text) return null;
  return <p className={`rq-outcome${h.phase === 'refused' || h.phase === 'failed' ? ' rq-bad' : ''}`} role="status" data-testid="sync-outcome" data-phase={h.phase}>{text}</p>;
}

/** Done: the card folds to one line. A opens the counts, C the files, B nothing. */
function Receipt() {
  const h = useHost();
  const x = t();
  const slipBad = h.slip && !guarded();
  return (
    <>
      <div className="rq-receipt-line">
        <Icon name="check" />
        <p className="rq-outcome" role="status" data-testid="sync-outcome" data-phase="done">{x.done(dry(), h.doneAt)} {x.doneTail}</p>
        {direction !== B ? (
          <button type="button" className="rq-link" data-testid="receipt-toggle" aria-expanded={h.receipt} onClick={() => set({receipt: !h.receipt})}>
            {h.receipt ? x.receiptHide : x.receiptShow}
          </button>) : null}
      </div>
      {h.receipt && direction === A ? <Table /> : null}
      {h.receipt && direction === C ? <Names /> : null}
      {h.slip ? <p className={`rq-slip${slipBad ? ' rq-bad' : ''}`} role="status" data-testid="slip" data-slip={slipBad ? 'deleted' : 'held'}>
        <Icon name={slipBad ? 'warning' : 'shield'} />{slipBad ? x.slipOpen : x.slipSafe}</p> : null}
    </>
  );
}

/** The card's body, the same in the timeline and in the fallback's dialog. */
function CardBody({dialog = false}: {dialog?: boolean}) {
  const h = useHost();
  const x = t();
  const d = dry();
  if (h.phase === 'done') return <Receipt />;
  const ownLead = origin === 'habitat' && !dialog;
  const lead = <p className="rq-lead">{ownLead ? x.leadHere(d) : x.leadAny(d)}</p>;
  if (h.phase === 'running') return <Outcome />;
  // B, cancelled: one line and the count on request.
  if (direction === B && h.cancelled && h.phase === 'stopped')
    return (
      <div className="rq-receipt-line">
        <p className="rq-outcome" role="status" data-testid="sync-outcome" data-phase="stopped">{x.cancelledShort}</p>
        <button type="button" className="rq-link" data-testid="show-count" onClick={() => set({cancelled: false})}>{x.showCount}</button>
      </div>);
  const cause = ownLead ? <p className="rq-fine" data-testid="sync-cause">{x.cause[data]}</p> : null;
  if (h.phase === 'counting') return <>{lead}<Counting arrive={direction === B} /></>;
  if (showsCount(h))
    return (
      <>
        {lead}
        {direction === B ? cause : null}
        <Outcome />
        <Summary />
        <div className="rq-actions"><CancelButton /><ConfirmButton /></div>
      </>);
  return (
    <>
      {lead}
      {h.phase === 'stopped' && !h.cancelled ? <p className="rq-fine">{x.why(d)}</p> : null}
      {cause}
      <Outcome />
      <div className="rq-actions"><LookButton />{origin === 'habitat' && !dialog && h.phase === 'stopped' ? <AskButton /> : null}</div>
    </>
  );
}
function Card() {
  const h = useHost();
  const x = t();
  const done = h.phase === 'done';
  const icon = stoppedLike(h.phase) ? 'warning' : done ? 'check' : 'refresh';
  return (
    <aside className="rq-card" data-testid="sync-stop" data-place="card" data-direction={direction} data-phase={h.phase}
      data-collapsed={done || (direction === B && h.cancelled && h.phase === 'stopped') ? 'true' : undefined} aria-label={x.syncLabel}>
      {done ? null : <header className="rq-card-head"><Icon name={icon} /><span>{x.habitat} · {x.syncLabel}{origin !== 'habitat' ? ` · ${x.byAgent}` : ''}</span></header>}
      <CardBody />
    </aside>
  );
}
/** No conversation caused the stop: the bell opens the same card in a dialog. */
function CardDialog() {
  const h = useHost();
  const x = t();
  return (
    <ModalOverlay className="ah-overlay" isOpen={h.open} onOpenChange={(o) => { if (!o) set({open: false}); }} isDismissable>
      <Modal className="ah-modal">
        <Dialog className="ah-dialog rq-dialog" aria-label={x.dialogTitle}>
          <Heading slot="title">{x.dialogTitle}</Heading>
          <div className="rq-dialog-card" data-testid="sync-stop" data-place="dialog" data-phase={h.phase}><CardBody dialog /></div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---- The page ----
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'onedrive',
};
const noop = () => {};

function useBell(h: Host, title: string, scrollToCard: () => void): StatusItem[] {
  const x = t();
  // Question 4: the guarded pass left the late cloud deletion to the next
  // normal pass, which stopped on too many deletes with no conversation behind it.
  if (h.phase === 'done' && h.slip && guarded())
    return [{key: 'sync-onedrive-2', tone: 'warning', icon: 'warning', group: 'own', short: x.railMark, title: x.bellTitle, meta: x.bellMeta,
      body: x.bellSlip, actions: [{testId: 'bell-settings', label: x.bellSettings, onPress: () => toastSink(x.settingsToast)}], data: {where: 'none', slip: 'held'}}];
  if (h.where === 'none' && (h.phase === 'running' || h.phase === 'done'))
    return [{key: 'sync-onedrive', tone: 'info', icon: h.phase === 'done' ? 'check' : 'refresh', group: 'own', short: x.syncLabel, title: x.syncLabel, meta: x.bellMeta,
      body: h.phase === 'running' ? x.running(safe, dry()) : `${x.done(dry(), h.doneAt)} ${x.doneTail}`, actions: [], data: {phase: h.phase}}];
  if (!stoppedLike(h.phase)) return [];
  const look = () => { if (direction === B && h.phase === 'stopped') set({open: true, cancelled: false}); else void count(true); };
  const actions = h.where === 'none'
    ? [{testId: 'bell-look', label: x.bellLook, primary: true, onPress: look}, {testId: 'bell-settings', label: x.bellSettings, onPress: () => toastSink(x.settingsToast)}]
    : h.where === 'elsewhere'
      ? [{testId: 'bell-open', label: x.bellOpenConversation, primary: true, onPress: () => goSink('pysahtyi')}]
      : [{testId: 'bell-show', label: x.bellShowHere, primary: true, onPress: scrollToCard}];
  return [{key: 'sync-onedrive', tone: 'warning', icon: 'warning', group: 'own', short: x.railMark, title: x.bellTitle, meta: x.bellMeta,
    body: h.where === 'none' ? x.bellBodyElsewhere(dry()) : x.bellBodyHere(title), actions, data: {where: h.where}}];
}

function Main() {
  const h = useHost();
  const x = t();
  const [draft, setDraft] = useState('');
  draftSink = (s) => { setDraft(s); requestAnimationFrame(() => (document.querySelector('.ah-composer textarea, [data-testid="composer-input"]') as HTMLElement | null)?.focus()); };
  const caused = h.where === 'here';
  const syncTitle = x.conv[data];
  const title = caused ? syncTitle : x.convOther;
  const steps = toolSteps(data);
  const files = turnChanges(steps, WS_ROOT);
  const d = dry();
  const status = JSON.stringify({result: {folder: 'onedrive', state: 'stopped', reason: d.stop === 'changed' ? 'all_files_changed' : 'delete_limit', stopped_at: '2026-11-16T09:14:05Z', resume: 'person_consent'}}, null, 1);
  const scrollToCard = () => document.querySelector('[data-testid="sync-stop"]')?.scrollIntoView({block: 'center'});
  const work = [
    {id: 'u1', kind: 'user', content: <UserMessage sourceText={x.ask[data]} onCopy={noop} time="11.12"><Markdown text={x.ask[data]} /></UserMessage>},
    {id: 'a1', kind: 'assistant', content: (
      <AgentTurn startedAt={T0} steps={[...stepNodes(steps), {kind: 'text', key: 'reply', at: T0 + 70000, text: x.reply[data], node: <Markdown text={x.reply[data]} />}]}
        changes={<TurnChanges files={files} start={T0} end={T0 + 70000} />} />)},
  ];
  // The agent explains in its own words and brings Habitat's card by command;
  // the command only shows the card, it does not continue sync.
  const agentTurns = origin === 'habitat' ? [] : [
    {id: 'u2', kind: 'user', content: <UserMessage sourceText={x.askWhy} onCopy={noop} time="11.20"><Markdown text={x.askWhy} /></UserMessage>},
    {id: 'a2', kind: 'assistant', content: (
      <AgentTurn startedAt={T0 + 480000} steps={[
        {kind: 'thinking', key: 'th', at: T0 + 481000, node: <div className="ah-ordered-blocks"><ThinkingRow text={x.thinking} /></div>},
        bashStep('st', T0 + 483000, 'open-habitat agent sync status onedrive', status),
        bashStep('rc', T0 + 489000, CONSENT_CMD, CONSENT_OUT),
        {kind: 'text', key: 'r', at: T0 + 494000, text: x.agentExplain[data], node: <Markdown text={x.agentExplain[data]} />},
      ]} />)},
    ...(origin === 'yes' ? [
      {id: 'u3', kind: 'user', content: <UserMessage sourceText={x.yes} onCopy={noop} time="11.22"><Markdown text={x.yes} /></UserMessage>},
      {id: 'a3', kind: 'assistant', content: (
        <AgentTurn startedAt={T0 + 600000} steps={[
          bashStep('rc2', T0 + 602000, CONSENT_CMD, CONSENT_OUT),
          {kind: 'text', key: 'r', at: T0 + 604000, text: x.agentYes, node: <Markdown text={x.agentYes} />},
        ]} />)},
    ] : []),
  ];
  const items: {id: string; kind: string; content: ReactNode}[] = caused
    ? [...work, ...agentTurns, {id: 'sync', kind: 'sync-stop', content: <Card />}]
    : [
      {id: 'u1', kind: 'user', content: <UserMessage sourceText={x.askOther} onCopy={noop} time="11.30"><Markdown text={x.askOther} /></UserMessage>},
      {id: 'a1', kind: 'assistant', content: <AgentTurn startedAt={T0 + 1080000} steps={[{kind: 'text', key: 'r', at: T0 + 1100000, text: x.replyOther, node: <Markdown text={x.replyOther} />}]} />},
    ];
  // The page opens on the end of the conversation with the card in view; when
  // the agent brought it, its last reply starts the view if the card still fits.
  // The agent's turns about the stop open their work, as a reader would, so
  // the request-consent command shows (production folds tools by default).
  useEffect(() => {
    if (origin === 'habitat' || !caused) return;
    const turns = [...document.querySelectorAll<HTMLElement>('.ah-feed > li[data-kind="assistant"]')].slice(1);
    for (const turn of turns)
      turn.querySelectorAll<HTMLElement>('[data-testid="history-stage-toggle"][aria-expanded="false"]').forEach((b) => b.click());
  }, [caused]);
  useLayoutEffect(() => {
    const id = window.setTimeout(() => {
      const stream = document.querySelector<HTMLElement>('.ah-conversation-stream');
      if (!stream) return;
      stream.scrollTop = stream.scrollHeight;
      const reply = origin !== 'habitat' ? [...stream.querySelectorAll<HTMLElement>('.ah-feed > li[data-kind="assistant"]')].at(-1) : null;
      const card = stream.querySelector<HTMLElement>('[data-testid="sync-stop"]');
      if (reply && card) {
        const top = reply.getBoundingClientRect().top - stream.getBoundingClientRect().top + stream.scrollTop - 16;
        const bottom = card.getBoundingClientRect().bottom - stream.getBoundingClientRect().top + stream.scrollTop + 16;
        if (bottom - top <= stream.clientHeight) stream.scrollTop = top;
      }
    }, 120);
    return () => window.clearTimeout(id);
  }, [h.phase, h.where, h.countedAt]);
  const now0 = Date.now();
  const nav = (id: string, name: string, ws: string, selected: boolean, mark: boolean): AgentNavModel => ({
    agentId: id, href: `/workspaces/ws_${ws}?conversation=${id}`, title: name, workspaceId: `ws_${ws}`, workspaceName: ws,
    changedAt: now0 - (id === 'sync' ? 3 : 20) * 60000, activity: 'waiting', activityLabel: x.waiting, controlLabel: '',
    attentionLabel: mark ? x.railMark : undefined, detail: `${ws} · ${mark ? x.railMark : x.waiting}`, selected,
  });
  const mark = h.where !== 'none' && stoppedLike(h.phase);
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Habitat" connectionLabel={lang === 'fi' ? 'Yhdistetty' : 'Connected'} connectionTone="success"
      filterValue="" resultSummary="2" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Aino Esimerkki" onSettings={noop} onLogout={noop} />}
      now={<section className="ah-now"><ul>
        {h.where !== 'none' ? <AgentNavItem {...nav('sync', syncTitle, 'onedrive', caused, mark)} now={now0} /> : null}
        <AgentNavItem {...nav('other', x.convOther, 'kotisivu', !caused, false)} now={now0} />
      </ul></section>}>
      <WorkspaceNavRow name="onedrive" href="/workspaces/ws_onedrive" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_kotisivu" />
    </WorkspaceRail>
  );
  const bell = useBell(h, syncTitle, scrollToCard);
  const main = (
    <div className="rq-main">
      <ConversationFrame>
        <AgentHeader title={title} workspaceLabel={caused ? 'onedrive' : 'kotisivu'} workspaceHref="/workspaces/ws_onedrive"
          activityLabel="" activityAnimated={false} activityKind="neutral" controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
        <ConversationStream>
          <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} />
        </ConversationStream>
        <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} sources={sources} csrf="prototype"
          modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
      </ConversationFrame>
      {h.where === 'none' ? <CardDialog /> : null}
    </div>
  );
  return (
    <StatusBellProvider items={bell}>
      <AppShell mobileTitle={title} rail={rail} main={main} />
    </StatusBellProvider>
  );
}

// Presets: the four things this round shows, one press each.
const PRESETS: {s: string; data: Data; origin: Origin}[] = [
  {s: 'pysahtyi', data: 'few', origin: 'habitat'},
  {s: 'pysahtyi', data: 'few', origin: 'agent'},
  {s: 'laskettu', data: 'moved', origin: 'habitat'},
  {s: 'livahti', data: 'few', origin: 'habitat'},
];

let reviewTheme = params.get('theme') === 'dark' ? 'dark' : 'light';
function App({d}: {d: number}) {
  direction = d;
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
  const [s, setS] = useState(scenario);
  const [dt, setDt] = useState(data);
  const [og, setOg] = useState(origin);
  const [q4, setQ4] = useState(safe);
  const [generation, setGeneration] = useState(0);
  const [toast, setToast] = useState('');
  const bar = useRef<HTMLElement>(null);
  const x = TEXT[language];
  toastSink = setToast;
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
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 7000); return () => clearTimeout(id); }, [toast]);
  const restart = (next = s) => { ++run; scenario = next; host = SCENARIOS[next](); setS(next); setToast(''); setGeneration((g) => g + 1); };
  goSink = restart;
  const preset = (i: number) => { const p = PRESETS[i]; data = p.data; origin = p.origin; setDt(data); setOg(origin); restart(p.s); };
  const activePreset = PRESETS.findIndex((p) => p.s === s && p.data === dt && p.origin === og);
  // The rail's row of the conversation that caused the stop opens it.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.('.proto-picker, .rq-bar')) return;
      const a = el?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      if (a.closest('[data-testid="agent-item-sync"]')) { e.preventDefault(); e.stopPropagation(); if (host.where === 'elsewhere') restart('pysahtyi'); return; }
      e.preventDefault(); e.stopPropagation();
      setToast(`${TEXT[lang].away} ${a.getAttribute('href')}`);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  });
  return (
    <div className={`rq-review variant-${d}`} data-direction={d} data-scenario={s} data-data={dt} data-origin={og} data-q4={q4 ? 'safe' : 'open'}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => restart(e.target.value)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.data} <select id="data" value={dt} onChange={(e) => { data = e.target.value as Data; setDt(data); restart(); }}>
          <option value="few">{x.dataFew}</option><option value="mixed">{x.dataMixed}</option><option value="moved">{x.dataMoved}</option></select></label>
        <label>{x.origin} <select id="origin" value={og} onChange={(e) => { origin = e.target.value as Origin; setOg(origin); restart(); }}>
          <option value="habitat">{x.originHabitat}</option><option value="agent">{x.originAgent}</option><option value="yes">{x.originYes}</option></select></label>
        <label>{x.q4} <select id="q4" value={q4 ? 'safe' : 'open'} onChange={(e) => { safe = e.target.value === 'safe'; setQ4(safe); setGeneration((g) => g + 1); }}>
          <option value="safe">{x.q4Safe}</option><option value="open">{x.q4Open}</option></select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); setGeneration((g) => g + 1);
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => restart()}>{x.reset}</button>
        <button type="button" data-testid="rq-change" onClick={() => { set({changed: true}); setToast(x.simulated); }}>{x.simulate}</button>
        <button type="button" data-testid="rq-slip" onClick={() => { set({slipNext: true}); setToast(x.slipSimulated); }}>{x.slipSimulate}</button>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === d ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
        <div className="rq-presets" role="group" aria-label={x.presetsLabel}>
          <span className="rq-presets-label">{x.presetsLabel}</span>
          <ol>
            {x.presets.map(([name, line], i) => (
              <li key={i}>
                <button type="button" data-testid={`preset-${i + 1}`} aria-pressed={activePreset === i} onClick={() => preset(i)}>{i + 1} {name}</button>
                <span className="rq-preset-line" data-testid={`preset-line-${i + 1}`}>{line}</span>
              </li>))}
          </ol>
        </div>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${s}-${language}-${dt}-${og}`} enabled={false}>
          <MemoryRouter key={`${generation}-${s}-${language}-${dt}-${og}`} initialEntries={['/workspaces/ws_onedrive?conversation=sync']}>
            <Main />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {toast ? <p className="rq-toast" role="status" data-testid="rq-toast">{toast}</p> : null}
    </div>
  );
}

// ---- Host stand-in: only what the production shell asks for ----
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path === '/api/v1/server') return json({schema_version: 1, name: 'Habitat', administrator: false, version: '0.0.0-proto'});
  return new Response('', {status: 404});
};

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { ++run; flushSync(() => root.render(view === '' ? null : view)); host = SCENARIOS[scenario](); listeners.forEach((f) => f()); }};
const variants = NAMES.map((_, d) => () => <App key={d} d={d} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((nm, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = nm.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// The dialog is modal, and react-aria makes everything outside it inert. The
// review chrome is not part of the page under review, so it stays usable
// while a dialog is open (as rounds 1 and 2).
const keepLive = () => document.querySelectorAll('.proto-picker[inert], .rq-bar[inert], .rq-review[inert], #root[inert]').forEach((el) => el.removeAttribute('inert'));
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'])
  window.addEventListener(type, (e) => { if ((e.target as Element | null)?.closest?.('.proto-picker, .rq-bar')) e.stopPropagation(); }, true);
new MutationObserver(keepLive).observe(document.body, {attributes: true, attributeFilter: ['inert'], subtree: true});
new Function('stage', 'variants', pickerSource)(stageSink, variants);

export type {React};
