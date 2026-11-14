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
import {type Counts, type Lang, TEXT} from './text';
import './round.css';

// bisync-force-needs-consent, round 2. Jari 14.11.2026 on round 1: a person
// will not find the stop on the integrations card; it belongs where the
// agent started the work and caused the change, the conversation. Round 1's
// binding of the consent to the dry run's counts stays. Axis: where in the
// conversation the stop and the consent sit. A is Habitat's card in the
// timeline right after the turn whose edits stopped sync, B has Habitat tell
// the agent, which explains and counts, with Habitat's consent card under
// its reply, C is a fixed line above the message field with round 1's
// dialog. Common to all: the rail marks the conversation that caused the
// stop, the bell carries it for the whole account, and when no conversation
// caused it the bell is the place (with round 1's account card behind it).
// The view is production's conversation: AppShell, WorkspaceRail and
// AgentNavItem, AgentHeader with its StatusBell, ConversationTimeline,
// AgentTurn with PiToolUse/FileToolCard/BashToolCard, TurnChanges and the
// Composer. Everything is synthetic.

const NAMES = ['A Kortti', 'B Agentti kertoo', 'C Kentän yllä'];
const A = 0, B = 1, C = 2;
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const fmt = (v: number) => v.toLocaleString(lang === 'fi' ? 'fi-FI' : 'en-GB');

// ---- The conversations and what their agents did (synthetic) ----
type Data = 'few' | 'many';
type Dry = {up: Counts; down: Counts; total: number};
const DRY: Record<Data, Dry> = {
  // Every note's heading was edited and two templates were added.
  few: {up: {changed: 14, added: 2, deleted: 0}, down: {changed: 0, added: 0, deleted: 0}, total: 16},
  // 212 reports moved inside the folder: OneDrive sees deletions and new files.
  many: {up: {changed: 4, added: 212, deleted: 212}, down: {changed: 0, added: 1, deleted: 0}, total: 216},
};
const NOTES = [
  ['2026-08-21', 'Syyskauden suunnittelu'], ['2026-08-28', 'Budjetti'], ['2026-09-04', 'Tiimipalaveri'],
  ['2026-09-11', 'Asiakastapaaminen'], ['2026-09-18', 'Tiimipalaveri'], ['2026-09-25', 'Julkaisu'],
  ['2026-10-02', 'Tiimipalaveri'], ['2026-10-09', 'Retrospektiivi'], ['2026-10-16', 'Tiimipalaveri'],
  ['2026-10-23', 'Rekrytointi'], ['2026-10-30', 'Tiimipalaveri'], ['2026-11-04', 'Hallitus'],
  ['2026-11-05', 'Tiimipalaveri'], ['2026-11-10', 'Vuosisuunnitelma'],
];
const oldHeading = (d: string, topic: string) => {
  const [, m, day] = d.split('-');
  return `# ${topic} ${Number(day)}.${Number(m)}.`;
};
const T0 = Date.UTC(2026, 10, 14, 9, 12);
function toolSteps(data: Data): ToolStep[] {
  if (data === 'few')
    return [
      {callId: 'ls', tool: 'bash', args: JSON.stringify({command: 'ls Muistiinpanot'}), output: NOTES.map(([d, x]) => `${d}-${x.toLowerCase()}.md`).join('\n'), failed: false, at: T0 + 4000},
      ...NOTES.map(([d, x], i): ToolStep => ({callId: `e${i}`, tool: 'edit', failed: false, at: T0 + 9000 + i * 3000, output: 'Successfully replaced text.',
        args: JSON.stringify({path: `Muistiinpanot/${d}-${x.toLowerCase()}.md`, edits: [{oldText: oldHeading(d, x), newText: `# ${d} – ${x}`}]})})),
      ...['2026-11-06', '2026-11-13'].map((d, i): ToolStep => ({callId: `w${i}`, tool: 'write', failed: false, at: T0 + 60000 + i * 3000, output: 'Wrote file.',
        args: JSON.stringify({path: `Muistiinpanot/${d}-tiimipalaveri.md`, content: `# ${d} – Tiimipalaveri\n\n## Osallistujat\n\n## Asiat\n\n## Päätökset\n`})})),
    ];
  return [
    {callId: 'mv', tool: 'bash', args: JSON.stringify({command: 'mkdir -p Arkisto/2025 && mv Raportit/2025-* Arkisto/2025/ && ls Arkisto/2025 | wc -l'}), output: '212', failed: false, at: T0 + 6000},
    ...['Raportit/README.md', 'Arkisto/README.md', 'Muistiinpanot/hakemisto.md', 'Kokoukset/hakemisto.md'].map((p, i): ToolStep => ({callId: `e${i}`, tool: 'edit', failed: false, at: T0 + 14000 + i * 4000, output: 'Successfully replaced text.',
      args: JSON.stringify({path: p, edits: [{oldText: '[Vuoden 2025 raportit](../Raportit/)', newText: '[Vuoden 2025 raportit](../Arkisto/2025/)'}]})})),
  ];
}
function stepNodes(steps: ToolStep[]): TurnStep[] {
  return steps.map((s): TurnStep => {
    const args = JSON.parse(s.args) as {command?: string; path?: string};
    if (s.tool === 'bash')
      return {kind: 'tool', key: s.callId, at: s.at, node: (
        <PiToolUse name="bash" state="succeeded" targetText={args.command} keepMounted>
          <BashToolCard command={args.command ?? ''} output={s.output ?? ''} running={false} />
        </PiToolUse>)};
    return {kind: 'tool', key: s.callId, at: s.at, node: (
      <PiToolUse name={s.tool} state="succeeded" targetText={args.path} stat={fileStat(s.tool, s.args, s.output)}>
        <FileToolCard name={s.tool} argumentsText={s.args} output={s.output} />
      </PiToolUse>)};
  });
}
const WS_ROOT = '/home/aino/cloud/microsoft/aino@example.test/onedrive';

// ---- The person's host, as the round imagines the daemon reports it ----
type Phase = 'stopped' | 'counting' | 'counted' | 'running' | 'done' | 'refused' | 'failed';
/** here: the conversation that caused the stop is open; elsewhere: another
 * conversation is open; none: no conversation caused the stop. */
type Where = 'here' | 'elsewhere' | 'none';
/** acted: the person has looked or decided (B: the agent's own turn is over). */
type Host = {phase: Phase; where: Where; acted: boolean; open: boolean; agree: boolean; changed: boolean; cancelled: boolean; countedAt: string; doneAt: string};
const base = (): Host => ({phase: 'stopped', where: 'here', acted: false, open: false, agree: false, changed: false, cancelled: false, countedAt: '', doneAt: ''});
const nowClock = () => clockTime(new Date().toISOString()) ?? '';
const SCENARIOS: Record<string, () => Host> = {
  pysahtyi: () => base(),
  lasketaan: () => ({...base(), phase: 'counting'}),
  laskettu: () => ({...base(), phase: 'counted', countedAt: nowClock()}),
  kaynnissa: () => ({...base(), phase: 'running', countedAt: nowClock()}),
  valmis: () => ({...base(), phase: 'done', countedAt: nowClock(), doneAt: nowClock()}),
  torjuttu: () => ({...base(), phase: 'refused'}),
  epaonnistui: () => ({...base(), phase: 'failed'}),
  muualla: () => ({...base(), where: 'elsewhere'}),
  eikeskustelua: () => ({...base(), where: 'none'}),
};
const SCENARIO_IDS = Object.keys(SCENARIOS);
const params = new URLSearchParams(location.search);
let scenario = params.get('s') ?? 'pysahtyi';
if (!SCENARIOS[scenario]) scenario = 'pysahtyi';
let data: Data = params.get('data') === 'many' ? 'many' : 'few';
let direction = 0;
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const set = (next: Partial<Host>) => { host = {...host, ...next}; listeners.forEach((f) => f()); };
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
/** The count and the consent sit in a dialog in C and in the fallback. */
const inDialog = (h: Host) => direction === C || h.where === 'none';
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stoppedLike = (p: Phase) => p !== 'running' && p !== 'done';
const many = () => DRY[data].up.deleted + DRY[data].down.deleted > 0;

// ---- Flow: count -> consent -> one forced pass ----
let run = 0;
async function count() {
  const me = ++run;
  set({phase: 'counting', acted: true, open: inDialog(host), agree: false, changed: false, cancelled: false});
  await later(900);
  if (me === run) set({phase: 'counted', countedAt: nowClock()});
}
async function proceed() {
  const me = ++run;
  const changed = host.changed;
  set({open: false});
  // The consent names the count it was shown; a later change is not covered.
  if (changed) { set({phase: 'refused'}); return; }
  set({phase: 'running'});
  await later(1600);
  if (me !== run) return;
  set({phase: 'done', doneAt: nowClock()});
}
const cancel = () => { ++run; set({phase: 'stopped', acted: true, open: false, agree: false, cancelled: true}); };
let toastSink: (s: string) => void = () => {};
let draftSink: (s: string) => void = () => {};
let goSink: (s: string) => void = () => {};

// ---- The count, shared by every direction ----
function Table({d}: {d: Dry}) {
  const x = t();
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
function Summary() {
  const h = useHost();
  const x = t();
  const d = DRY[data];
  const m = many();
  return (
    <div className="rq-summary" data-testid="dry-summary" data-deletions={m ? 'many' : 'none'}>
      {m ? (
        <div className="ig-warn rq-many" role="alert" data-testid="dry-many">
          <Icon name="warning" />
          <div><strong>{x.manyLead(d.up.deleted, d.total)}</strong> {x.manyBody}</div>
        </div>
      ) : null}
      <p className="rq-would" data-testid="dry-would">{x.would(d.up, d.down, d.total)}</p>
      <Table d={d} />
      <p className="rq-fine">{x.both}</p>
      <p className="rq-fine" data-testid="dry-binding">{x.countedAt(h.countedAt)} {x.binding}</p>
      {m ? <Checkbox data-testid="consent-agree" label={x.agree} checked={h.agree} onChange={(v) => set({agree: v})} /> : null}
    </div>
  );
}
function ConfirmButton() {
  const h = useHost();
  const x = t();
  const d = DRY[data];
  const m = many();
  return (
    <ControlButton data-testid="consent-confirm" size="row" variant={m ? 'danger' : 'primary'} isDisabled={m && !h.agree} onPress={() => void proceed()}>
      {m ? x.confirmDelete(d.up.deleted + d.down.deleted) : x.confirm}
    </ControlButton>
  );
}
function CancelButton() {
  return <ControlButton data-testid="consent-cancel" size="row" variant="secondary" onPress={cancel}>{t().dontContinue}</ControlButton>;
}
function Counting() {
  return <p className="ig-st rq-counting" role="status" data-testid="dry-counting"><span className="ig-spin" aria-hidden="true" />{t().counting}</p>;
}
function Outcome() {
  const h = useHost();
  const x = t();
  const d = DRY[data];
  const text = h.phase === 'running' ? x.running
    : h.phase === 'done' ? `${x.doneAt(h.doneAt)} ${d.up.deleted ? x.doneMany(d.up) : x.doneFew(d.up)} ${x.doneTail}`
    : h.phase === 'refused' ? x.refused
    : h.phase === 'failed' ? x.failed
    : h.cancelled && h.phase === 'stopped' ? x.cancelled : '';
  if (!text) return null;
  return <p className={`rq-outcome${h.phase === 'refused' || h.phase === 'failed' ? ' rq-bad' : ''}`} role="status" data-testid="sync-outcome" data-phase={h.phase}>{text}</p>;
}
function LookButton({dialog = false, variant = 'primary'}: {dialog?: boolean; variant?: 'primary' | 'secondary'}) {
  const h = useHost();
  const x = t();
  const again = h.phase === 'refused' || h.phase === 'failed';
  return <ControlButton data-testid="open-consent" size="row" variant={variant} onPress={() => void count()}>{again ? x.lookAgain : dialog ? x.lookDialog : x.look}</ControlButton>;
}
function AskButton() {
  return <ControlButton data-testid="ask-agent" size="row" variant="quiet" onPress={() => draftSink(t().askDraft)}><Icon name="message" />{t().askAgent}</ControlButton>;
}
/** In place: counting, the count with its consent, or the outcome. */
function InPlace({ask}: {ask: boolean}) {
  const h = useHost();
  if (h.phase === 'counting') return <Counting />;
  if (h.phase === 'counted') return <><Summary /><div className="rq-actions"><CancelButton /><ConfirmButton /></div></>;
  return (
    <>
      <Outcome />
      {stoppedLike(h.phase) ? <div className="rq-actions"><LookButton />{ask ? <AskButton /> : null}</div> : null}
    </>
  );
}

/** C and the fallback: round 1's dialog. */
function ConsentDialog() {
  const h = useHost();
  const x = t();
  return (
    <ModalOverlay className="ah-overlay" isOpen={h.open} onOpenChange={(o) => { if (!o) cancel(); }} isDismissable>
      <Modal className="ah-modal">
        <Dialog className="ah-dialog rq-dialog" data-testid="consent-dialog" aria-label={x.dialogTitle}>
          <Heading slot="title">{x.dialogTitle}</Heading>
          {h.phase === 'counting' ? <Counting /> : h.phase === 'counted' ? <Summary /> : null}
          <div className="ah-dialog-actions">
            <CancelButton />
            {h.phase === 'counted' ? <ConfirmButton /> : null}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---- A: Habitat's card after the turn ----
function CardA() {
  const h = useHost();
  const x = t();
  const stopped = stoppedLike(h.phase);
  return (
    <aside className="rq-card" data-testid="sync-stop" data-place="card" data-phase={h.phase} aria-label={x.syncLabel}>
      <header className="rq-card-head"><Icon name={stopped ? 'warning' : h.phase === 'done' ? 'check' : 'refresh'} /><span>{x.habitat} · {x.syncLabel}</span></header>
      {stopped ? <>
        <p className="rq-lead">{x.leadHere}</p>
        {h.phase === 'stopped' && !h.cancelled ? <p className="rq-fine">{x.why}</p> : null}
        <p className="rq-fine" data-testid="sync-cause">{data === 'few' ? x.causeFew : x.causeMany}</p>
      </> : null}
      <InPlace ask />
    </aside>
  );
}

// ---- B: the agent tells; Habitat's consent under its reply ----
function ToldAgent() {
  return <p className="rq-told" data-testid="told-agent"><Icon name="info" />{t().toldAgent}</p>;
}
function AgentReply() {
  const h = useHost();
  const x = t();
  const thinking: TurnStep = {kind: 'thinking', key: 'th', at: T0 + 120000, node: <ThinkingRow text={lang === 'fi' ? 'Habitat kertoi, että synkronointi pysähtyi. Katson, mitä muutin, ja lasken, mitä jatkaminen tekisi.' : 'Habitat says sync stopped. I will look at what I changed and count what continuing would do.'} />};
  const check = (state: 'running' | 'succeeded'): TurnStep => ({kind: 'tool', key: 'chk', at: T0 + 125000, node: (
    <PiToolUse name="bash" state={state} targetText="habitat sync check onedrive" keepMounted>
      <BashToolCard command="habitat sync check onedrive" running={state === 'running'}
        output={state === 'running' ? '' : JSON.stringify({check_id: 'chk_7f3a', path1: DRY[data].up, path2: DRY[data].down, total_files: DRY[data].total}, null, 1)} />
    </PiToolUse>)});
  const reply = data === 'few' ? x.agentReplyFew : x.agentReplyMany;
  if (h.phase === 'stopped' && !h.acted)
    return <AgentTurn steps={[thinking]} startedAt={T0 + 118000} working activity={x.agentChecking} />;
  if (h.phase === 'counting' && !h.acted)
    return <AgentTurn steps={[thinking, check('running')]} startedAt={T0 + 118000} working activity={x.agentChecking} />;
  return <AgentTurn steps={[thinking, check('succeeded'), {kind: 'text', key: 'r', at: T0 + 131000, text: reply, node: <Markdown text={reply} />}]} startedAt={T0 + 118000} />;
}
function CardB() {
  const h = useHost();
  const x = t();
  // The agent's own count stands until the person acts; then Habitat's card
  // works as A's does.
  if (!h.acted && (h.phase === 'stopped' || h.phase === 'counting')) return null;
  return (
    <aside className="rq-card rq-card-b" data-testid="sync-stop" data-place="consent" data-phase={h.phase} aria-label={x.consentLabel}>
      <header className="rq-card-head"><Icon name="lock" /><span>{x.consentLabel} · {x.syncLabel}</span></header>
      <InPlace ask={false} />
    </aside>
  );
}

// ---- C: above the field ----
function StripC() {
  const h = useHost();
  const x = t();
  const stopped = stoppedLike(h.phase);
  return (
    <div className={`rq-strip${stopped ? ' rq-strip-stop' : ''}`} data-testid="sync-stop" data-place="strip" data-phase={h.phase}>
      <Icon name={stopped ? 'warning' : h.phase === 'done' ? 'check' : 'refresh'} />
      <div className="rq-strip-body">
        {stopped ? <p className="rq-strip-lead"><span className="rq-long">{x.stripLead}</span><span className="rq-short">{x.stripShort}</span></p> : null}
        <Outcome />
      </div>
      {stopped ? <LookButton dialog variant="secondary" /> : null}
    </div>
  );
}

// ---- The page ----
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'onedrive',
};
const noop = () => {};

function useBell(h: Host, title: string, scrollToPiece: () => void): StatusItem[] {
  const x = t();
  if (h.where === 'none' && (h.phase === 'running' || h.phase === 'done'))
    return [{key: 'sync-onedrive', tone: 'info', icon: h.phase === 'done' ? 'check' : 'refresh', group: 'own', short: x.syncLabel, title: x.syncLabel, meta: x.bellMeta,
      body: h.phase === 'running' ? x.running : `${x.doneAt(h.doneAt)} ${x.doneTail}`, actions: [], data: {phase: h.phase}}];
  if (!stoppedLike(h.phase)) return [];
  const actions = h.where === 'none'
    ? [{testId: 'bell-look', label: x.lookDialog, primary: true, onPress: () => void count()}, {testId: 'bell-settings', label: x.bellSettings, onPress: () => toastSink(x.settingsToast)}]
    : h.where === 'elsewhere'
      ? [{testId: 'bell-open', label: x.bellOpenConversation, primary: true, onPress: () => goSink('pysahtyi')}]
      : [{testId: 'bell-show', label: direction === C ? x.lookDialog : x.bellShowHere, primary: true, onPress: direction === C ? () => void count() : scrollToPiece}];
  return [{key: 'sync-onedrive', tone: 'warning', icon: 'warning', group: 'own', short: x.railMark, title: x.bellTitle, meta: x.bellMeta,
    body: h.where === 'none' ? x.bellBodyElsewhere : x.bellBodyHere(title), actions, data: {where: h.where}}];
}

function Main() {
  const h = useHost();
  const x = t();
  const [draft, setDraft] = useState('');
  draftSink = (s) => { setDraft(s); requestAnimationFrame(() => (document.querySelector('.ah-composer textarea, [data-testid="composer-input"]') as HTMLElement | null)?.focus()); };
  const caused = h.where === 'here';
  const syncTitle = data === 'few' ? x.convFew : x.convMany;
  const title = caused ? syncTitle : x.convOther;
  const steps = toolSteps(data);
  const files = turnChanges(steps, WS_ROOT);
  const reply = data === 'few' ? x.replyFew : x.replyMany;
  const ask = data === 'few' ? x.askFew : x.askMany;
  const scrollToPiece = () => document.querySelector('[data-testid="sync-stop"]')?.scrollIntoView({block: 'center'});
  const items: {id: string; kind: string; content: ReactNode}[] = caused ? [
    {id: 'u1', kind: 'user', content: <UserMessage sourceText={ask} onCopy={noop} time="11.12"><Markdown text={ask} /></UserMessage>},
    {id: 'a1', kind: 'assistant', content: (
      <AgentTurn startedAt={T0} steps={[...stepNodes(steps), {kind: 'text', key: 'reply', at: T0 + 70000, text: reply, node: <Markdown text={reply} />}]}
        changes={<TurnChanges files={files} start={T0} end={T0 + 70000} />} />)},
    ...(direction === A ? [{id: 'sync', kind: 'sync-stop', content: <CardA />}] : []),
    ...(direction === B ? [
      {id: 'told', kind: 'habitat', content: <ToldAgent />},
      {id: 'a2', kind: 'assistant', content: <div className="rq-b-turn"><AgentReply /><CardB /></div>},
    ] : []),
  ] : [
    {id: 'u1', kind: 'user', content: <UserMessage sourceText={x.askOther} onCopy={noop} time="11.30"><Markdown text={x.askOther} /></UserMessage>},
    {id: 'a1', kind: 'assistant', content: <AgentTurn startedAt={T0 + 1080000} steps={[{kind: 'text', key: 'r', at: T0 + 1100000, text: x.replyOther, node: <Markdown text={x.replyOther} />}]} />},
  ];
  // The page opens on the end of the conversation, the direction's piece in view.
  useLayoutEffect(() => {
    const id = window.setTimeout(() => {
      const stream = document.querySelector<HTMLElement>('.ah-conversation-stream');
      if (!stream) return;
      // B: the agent's explanation is the direction, so its start stays in view.
      const told = direction === B ? stream.querySelector<HTMLElement>('[data-testid="told-agent"]') : null;
      stream.scrollTop = told
        ? Math.min(stream.scrollHeight, told.getBoundingClientRect().top - stream.getBoundingClientRect().top + stream.scrollTop - 24)
        : stream.scrollHeight;
    }, 60);
    return () => window.clearTimeout(id);
  }, [h.phase, h.where, h.countedAt]);
  const now0 = Date.now();
  const agentWorking = direction === B && caused && !h.acted && (h.phase === 'stopped' || h.phase === 'counting');
  const nav = (id: string, name: string, ws: string, selected: boolean, mark: boolean, working = false): AgentNavModel => ({
    agentId: id, href: `/workspaces/ws_${ws}?conversation=${id}`, title: name, workspaceId: `ws_${ws}`, workspaceName: ws,
    changedAt: now0 - (id === 'sync' ? 3 : 20) * 60000, activity: working ? 'working' : 'waiting',
    activityLabel: working ? x.working : x.waiting, controlLabel: '',
    attentionLabel: mark ? x.railMark : undefined,
    detail: `${ws} · ${mark ? x.railMark : working ? x.working : x.waiting}`, selected,
  });
  const mark = h.where !== 'none' && stoppedLike(h.phase);
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Habitat" connectionLabel={lang === 'fi' ? 'Yhdistetty' : 'Connected'} connectionTone="success"
      filterValue="" resultSummary="2" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Aino Esimerkki" onSettings={noop} onLogout={noop} />}
      now={<section className="ah-now"><ul>
        {h.where !== 'none' ? <AgentNavItem {...nav('sync', syncTitle, 'onedrive', caused, mark, agentWorking)} now={now0} /> : null}
        <AgentNavItem {...nav('other', x.convOther, 'kotisivu', !caused, false)} now={now0} />
      </ul></section>}>
      <WorkspaceNavRow name="onedrive" href="/workspaces/ws_onedrive" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_kotisivu" />
    </WorkspaceRail>
  );
  const bell = useBell(h, syncTitle, scrollToPiece);
  const main = (
    <div className="rq-main">
      <ConversationFrame>
        <AgentHeader title={title} workspaceLabel={caused ? 'onedrive' : 'kotisivu'} workspaceHref="/workspaces/ws_onedrive"
          activityLabel={agentWorking ? x.working : ''} activityAnimated={agentWorking} activityKind={agentWorking ? 'working' : 'neutral'}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
        <ConversationStream>
          <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} />
        </ConversationStream>
        <Composer value={draft} onChange={setDraft} activity={agentWorking ? 'working' : 'idle'} selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} sources={sources} csrf="prototype"
          beforeField={direction === C && caused ? <StripC /> : null}
          modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
      </ConversationFrame>
      {inDialog(h) ? <ConsentDialog /> : null}
    </div>
  );
  return (
    <StatusBellProvider items={bell}>
      <AppShell mobileTitle={title} rail={rail} main={main} />
    </StatusBellProvider>
  );
}

let reviewTheme = params.get('theme') === 'dark' ? 'dark' : 'light';
function App({d}: {d: number}) {
  direction = d;
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
  const [s, setS] = useState(scenario);
  const [dt, setData] = useState(data);
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
    <div className={`rq-review variant-${d}`} data-direction={d} data-scenario={s} data-data={dt}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => restart(e.target.value)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.data} <select id="data" value={dt} onChange={(e) => { data = e.target.value as Data; setData(data); restart(); }}>
          <option value="few">{x.dataFew}</option><option value="many">{x.dataMany}</option></select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); setGeneration((g) => g + 1);
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => restart()}>{x.reset}</button>
        <button type="button" data-testid="rq-change" onClick={() => { set({changed: true}); setToast(x.simulated); }}>{x.simulate}</button>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === d ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${s}-${language}-${dt}`} enabled={false}>
          <MemoryRouter key={`${generation}-${s}-${language}-${dt}`} initialEntries={['/workspaces/ws_onedrive?conversation=sync']}>
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
const stageSink = {set innerHTML(view: ReactNode) { ++run; host = SCENARIOS[scenario](); flushSync(() => root.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, d) => () => <App key={d} d={d} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((nm, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = nm.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// The dialog is modal, and react-aria makes everything outside it inert. The
// review chrome is not part of the page under review, so it stays usable
// while a dialog is open (as round 1).
const keepLive = () => document.querySelectorAll('.proto-picker[inert], .rq-bar[inert], .rq-review[inert], #root[inert]').forEach((el) => el.removeAttribute('inert'));
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'])
  window.addEventListener(type, (e) => { if ((e.target as Element | null)?.closest?.('.proto-picker, .rq-bar')) e.stopPropagation(); }, true);
new MutationObserver(keepLive).observe(document.body, {attributes: true, attributeFilter: ['inert'], subtree: true});
new Function('stage', 'variants', pickerSource)(stageSink, variants);

export type {React};
