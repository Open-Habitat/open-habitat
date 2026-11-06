import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, AgentHeader, NowSections, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Menu} from '../../../../web/src/components/Overlays';
import {Icon} from '../../../../web/src/components/Icon';
import {Button, Checkbox, RadioGroup} from '../../../../web/src/components/Primitives';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-rewind-conversation, round 2. Jari chose Palaa tähän (6.11.): no new
// conversation; the replaced continuation stays inside the same conversation
// as Pi's /tree keeps it in the same session file. This round riffs on file
// restore. Pi itself never touches files; checkpoint extensions such as
// raine's better-pi-rewind snapshot a file before the agent's edit/write tool
// first touches it in a turn, and restore per prompt. The axis is how much of
// that the person is offered: nothing (files stay, named), one checkbox with
// the conversation, or a choice of what to restore including files alone.
// Messages, rail, header, menu, checkbox, radio group and composer are the
// production components; the confirmation card, branch row and file list are
// this round's. Everything is synthetic; nothing is sent or restored.
const directions = ['A Vain keskustelu', 'B Tiedostot mukana', 'C Valitse mitä'];
const LINES = [
  'A Vain keskustelu: Palaa tähän siirtää vain keskustelun; vahvistus nimeää tiedostot, jotka jäävät agentin muuttamiksi (Pi:n /tree sellaisenaan).',
  'B Tiedostot mukana: vahvistuksessa Palauta myös tiedostot, oletuksena päällä; aiemman jatkon rivi kertoo palautuksen, ja jatkon vaihto palauttaa sen tiedostot.',
  'C Valitse mitä: vahvistuksessa keskustelu ja tiedostot, vain keskustelu tai vain tiedostot; tiedostojen palautuksen voi perua.',
];
const A = 0, B = 1, C = 2;

type Tool = {name: string; path: string; stat: string; add?: number; del?: number};
type Item = {id: string; kind: 'user' | 'assistant' | 'tools'; text?: string; time: string; tools?: Tool[]};

// The same conversation as round 1: the second request was a wrong turn
// (adding an hour by hand). The third turn also ran a command whose effects a
// per-file checkpoint cannot see.
const CONVO: Item[] = [
  {id: 'u1', kind: 'user', time: '9.12', text: 'Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat.'},
  {id: 't1', kind: 'tools', time: '9.13', tools: [{name: 'bash', path: 'pytest -q', stat: ''}]},
  {id: 'a1', kind: 'assistant', time: '9.14', text: 'Ajoin testit: 41 läpi, 2 epäonnistui.\n\n- `test_dst_march` odottaa varjon kulmaksi 41,2°, mutta saa 26,2°: kesäajan tunti puuttuu laskusta.\n- `test_dst_october` epäonnistuu samasta syystä toiseen suuntaan.'},
  {id: 'u2', kind: 'user', time: '9.20', text: 'Korjaa kesäaika lisäämällä tunti kaikkiin maaliskuun laskuihin.'},
  {id: 't2', kind: 'tools', time: '9.22', tools: [
    {name: 'edit', path: 'src/shadow.py', stat: '+6 −2', add: 6, del: 2},
    {name: 'edit', path: 'src/timezones.py', stat: '+3 −0', add: 3, del: 0},
    {name: 'bash', path: 'pytest -q', stat: ''},
  ]},
  {id: 'a2', kind: 'assistant', time: '9.26', text: 'Lisäsin maaliskuun laskuihin tunnin. `test_dst_march` menee nyt läpi, mutta `test_dst_october` epäonnistuu yhä.'},
  {id: 'u3', kind: 'user', time: '9.28', text: 'Korjaa myös lokakuu samalla tavalla ja päivitä taulukko.'},
  {id: 't3', kind: 'tools', time: '9.30', tools: [
    {name: 'edit', path: 'src/shadow.py', stat: '+4 −1', add: 4, del: 1},
    {name: 'write', path: 'tests/test_shadow.py', stat: '+12 −0', add: 12, del: 0},
    {name: 'bash', path: 'python scripts/taulukko.py', stat: ''},
  ]},
  {id: 'a3', kind: 'assistant', time: '9.31', text: 'Molemmat testit menevät läpi, ja `data/kesaaika.csv` on päivitetty. Huomaa, että korjaus olettaa Suomen aikavyöhykkeen.'},
];
const REPLY = 'Selvä. Lasken paikallisen ajan zoneinfolla aikavyöhykkeen mukaan enkä lisää tunteja käsin. Lisään testit Helsingille ja Sydneylle.';
const DEFAULT_TARGET = 'u2';

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [{path: 'src/shadow.py', git: 'modified'}, {path: 'src/timezones.py', git: 'modified'}], truncated: false}),
  workspaceName: 'aurinkokello',
};

type FileChange = {path: string; add: number; del: number};
/** What going back before `target` leaves behind, and what a restore covers:
 * files the agent's edit and write tools changed, never a command's effects. */
function leftBehind(items: Item[], target: string) {
  const at = items.findIndex((i) => i.id === target);
  const later = items.slice(at);
  const own = later.filter((i) => i.kind === 'user').length;
  const replies = later.filter((i) => i.kind === 'assistant').length;
  const byPath = new Map<string, FileChange>();
  const commands: string[] = [];
  for (const t of later.flatMap((i) => i.tools ?? [])) {
    if (t.name === 'bash') { if (t.path !== 'pytest -q') commands.push(t.path); continue; }
    const f = byPath.get(t.path) ?? {path: t.path, add: 0, del: 0};
    f.add += t.add ?? 0; f.del += t.del ?? 0; byPath.set(t.path, f);
  }
  return {before: items.slice(0, at), later, own, replies, files: [...byPath.values()], commands, text: items[at]?.text ?? '', time: items[at]?.time ?? ''};
}
type Left = ReturnType<typeof leftBehind>;
const viestia = (n: number) => (n === 1 ? '1 viestisi' : `${n} viestiäsi`);
const vastausta = (n: number) => (n === 1 ? '1 vastaus' : `${n} vastausta`);
const counted = (n: {own: number; replies: number}) => (n.own + n.replies ? `${viestia(n.own)} ja ${vastausta(n.replies)}` : 'ei viestejä');
const tiedostoa = (n: number) => (n === 1 ? '1 tiedosto' : `${n} tiedostoa`);

/** Files that stay as the agent left them (A, or restore switched off). */
function FilesStay({files}: {files: FileChange[]}) {
  if (!files.length) return <p className="rw-files">Agentti ei muuttanut tiedostoja tämän jälkeen.</p>;
  return (
    <p className="rw-files" data-testid="files-stay">
      <Icon name="warning" />
      <span>Agentin muutokset tiedostoihin jäävät ennalleen: {files.map((f, i) => <React.Fragment key={f.path}>{i ? ', ' : ''}<code>{f.path}</code></React.Fragment>)}.</span>
    </p>
  );
}

/** Files a restore takes back to how they were before the message. */
function FileList({files, time}: {files: FileChange[]; time: string}) {
  return (
    <div className="rw-restore" data-testid="restore-list">
      <p className="rw-quiet">Palaavat tilaan ennen viestiäsi klo {time}; agentin muutokset perutaan:</p>
      <ul className="rw-filelist">
        {files.map((f) => (
          <li key={f.path}><Icon name="file" /><code>{f.path}</code><span className="rw-stat"><span>+{f.add}</span> <span>−{f.del}</span></span></li>
        ))}
      </ul>
    </div>
  );
}

/** A checkpoint sees only the agent's own edits; a command's effects stay. */
function Coverage({commands}: {commands: string[]}) {
  if (!commands.length) return null;
  return (
    <p className="rw-files" data-testid="coverage">
      <Icon name="info" />
      <span>Komennon {commands.map((c, i) => <React.Fragment key={c}>{i ? ', ' : ''}<code>{c}</code></React.Fragment>)} tekemiä muutoksia ei palauteta. Ne jäävät.</span>
    </p>
  );
}

function BusyNote({busy, what}: {busy: boolean; what: string}) {
  return busy ? <p className="rw-busy">Agentti on vielä työssä. {what} pysäyttää sen ensin.</p> : null;
}

/** One history item through the production components. */
function render(item: Item, opts: {busy?: boolean; last?: boolean; actions?: React.ReactNode; dim?: boolean} = {}) {
  let content: React.ReactNode;
  if (item.kind === 'user') {
    content = (
      <UserMessage sourceText={item.text!} onCopy={noop} time={item.time}>
        <Markdown text={item.text!} />
      </UserMessage>
    );
  } else if (item.kind === 'assistant') {
    const streaming = opts.busy && opts.last;
    content = (
      <AssistantMessage streamState={streaming ? 'streaming' : 'complete'} time={item.time} onCopy={noop}>
        <Markdown text={streaming ? item.text!.split('.')[0] + '…' : item.text!} />
      </AssistantMessage>
    );
  } else {
    content = (
      <div className="rw-tools">
        {item.tools!.map((t, i) => (
          <ToolRow key={i} name={t.name} targetText={t.path} stat={t.stat || undefined} statusLabel="Valmis" state="succeeded" expanded={false} onToggle={noop} />
        ))}
      </div>
    );
  }
  return {
    id: item.id,
    kind: item.kind,
    content: (
      <div className="rw-msg" data-own={item.kind === 'user' || undefined} data-left={opts.dim || undefined} data-item={item.id}>
        {content}
        {opts.actions ? <div className="rw-msg-actions">{opts.actions}</div> : null}
      </div>
    ),
  };
}

type What = 'both' | 'conversation' | 'files';
type Done = {before: Item[]; later: Item[]; own: number; replies: number; files: FileChange[]; restored: boolean; time: string};

/** The confirmation under the chosen message; its file part is the riff. */
function Confirm({mode, lb, busy, onCancel, onGo}: {mode: number; lb: Left; busy: boolean; onCancel: () => void; onGo: (what: What) => void}) {
  const [withFiles, setWithFiles] = useState(true);
  const [what, setWhat] = useState<What>('both');
  const hasFiles = lb.files.length > 0;
  const chosen: What = mode === A ? 'conversation' : mode === B ? (withFiles && hasFiles ? 'both' : 'conversation') : what;
  const restoring = chosen !== 'conversation';
  const label = chosen === 'files' ? (busy ? 'Pysäytä ja palauta tiedostot' : 'Palauta tiedostot')
    : chosen === 'both' ? (busy ? 'Pysäytä, palaa ja palauta' : 'Palaa ja palauta tiedostot')
    : (busy ? 'Pysäytä ja palaa' : 'Palaa tähän');
  return (
    <section className="rw-confirm" data-testid="rewind-confirm" aria-label="Palaa tähän">
      <h2>{chosen === 'files' ? 'Palautetaanko tiedostot tähän kohtaan?' : 'Palaa ennen tätä viestiä?'}</h2>
      {chosen === 'files'
        ? <p>Keskustelu jatkuu ennallaan. Agentille kerrotaan, että tiedostot palautettiin.</p>
        : <p>Keskustelu jatkuu tästä kohdasta. Sen jälkeiset {counted(lb)} jäävät sivuun tähän keskusteluun, ja voit avata ne. Viestisi tulee kenttään muutettavaksi.</p>}
      {mode === B && hasFiles ? (
        <Checkbox data-testid="restore-files" label="Palauta myös tiedostot" hint={`${tiedostoa(lb.files.length)} agentin muokkaamaa`} checked={withFiles} onChange={setWithFiles} />
      ) : null}
      {mode === C && hasFiles ? (
        <RadioGroup label="Mitä palautetaan" value={what} onChange={setWhat} options={[
          {value: 'both', label: 'Keskustelu ja tiedostot', description: 'Kuin et olisi lähettänyt tätä viestiä'},
          {value: 'conversation', label: 'Vain keskustelu', description: 'Tiedostot jäävät agentin muuttamiksi'},
          {value: 'files', label: 'Vain tiedostot', description: 'Keskustelu jatkuu ennallaan'},
        ]} />
      ) : null}
      {restoring ? <><FileList files={lb.files} time={lb.time} /><Coverage commands={lb.commands} /></> : <FilesStay files={lb.files} />}
      <BusyNote busy={busy} what={chosen === 'files' ? 'Palautus' : 'Palaaminen'} />
      <div className="rw-actions">
        <Button data-testid="rewind-cancel" label="Peru" variant="secondary" size="row" onPress={onCancel} />
        <Button data-testid="rewind-go" label={label} variant="primary" size="row" onPress={() => onGo(chosen)} />
      </div>
    </section>
  );
}

/** Every direction is Palaa tähän: the same conversation continues from the
 * earlier point, and the replaced continuation stays in it as one row at the
 * branch point, as it stays in Pi's session tree. */
function Rewind({mode, busy, step, setDraft, onStop}: {mode: number; busy: boolean; step: 'view' | 'choose'; setDraft: (t: string) => void; onStop: () => void}) {
  const [target, setTarget] = useState<string | null>(step === 'choose' ? DEFAULT_TARGET : null);
  const [done, setDone] = useState<Done | null>(null);
  const [filesOnly, setFilesOnly] = useState<{lb: Left; undone: boolean} | null>(null);
  const [sent, setSent] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapFiles, setSwapFiles] = useState(true);
  useSent(setSent);
  const menu = (id: string) => (
    <Menu label="Viestin toiminnot" trigger={<Icon name="more" />} triggerPresentation="icon" triggerClassName="rw-msg-more" triggerTestId={`msg-menu-${id}`} placement="bottom end"
      items={[{id: 'back', label: 'Palaa tähän…', description: mode === A ? 'Jatka ennen tätä viestiä' : 'Jatka ennen tätä viestiä; tiedostot voi palauttaa samalla'}]}
      onAction={() => setTarget(id)} />
  );
  const go = (lb: Left) => (what: What) => {
    onStop(); setTarget(null);
    if (what === 'files') { setFilesOnly({lb, undone: false}); return; }
    setDone({...lb, restored: what === 'both'}); setDraft(lb.text); focusComposer();
  };

  if (done) {
    const swap = () => {
      // The two continuations trade places at the branch point. The one sent
      // after going back changed no files here, so nothing is left to restore.
      setDone({...done, later: sent, own: sent.filter((i) => i.kind === 'user').length, replies: sent.filter((i) => i.kind === 'assistant').length, files: [], restored: false});
      setActive(done.later); setOpen(false); setSwapping(false);
    };
    const fileNote = !done.files.length ? '' : done.restored
      ? ` · ${tiedostoa(done.files.length)} palautettu`
      : mode === A ? '' : ` · tiedostot jäivät`;
    const marker = {id: 'marker', kind: 'marker', content: (
      <section className="rw-branch" data-testid="branch-marker" aria-label="Aiempi jatko">
        <div className="rw-branch-row">
          <Icon name="branch" />
          <span><strong>Aiempi jatko</strong> · {counted(done)}{fileNote}</span>
          <Button data-testid="branch-toggle" label={open ? 'Piilota' : 'Näytä'} variant="quiet" size="row" onPress={() => setOpen(!open)} />
        </div>
        {open ? (
          <div className="rw-branch-body" data-testid="branch-body">
            <p className="rw-quiet">Agentti ei näe tätä jatkoa. {done.restored ? 'Sen tiedostomuutokset on peruttu, ja ne palaavat, jos jatkat siitä.' : 'Voit jatkaa siitä.'}</p>
            <ol className="ah-feed">{done.later.map((i) => <li key={i.id}>{render(i, {dim: true}).content}</li>)}</ol>
            {swapping && done.restored ? (
              <div className="rw-swap" data-testid="swap-confirm">
                <Checkbox data-testid="swap-files" label="Palauta myös sen tiedostot" hint={`${tiedostoa(done.files.length)} palaa tilaan, johon agentti ne jätti`} checked={swapFiles} onChange={setSwapFiles} />
                <div className="rw-actions">
                  <Button label="Peru" variant="secondary" size="row" onPress={() => setSwapping(false)} />
                  <Button data-testid="swap-go" label="Jatka tästä jatkosta" variant="primary" size="row" onPress={swap} />
                </div>
              </div>
            ) : (
              <Button data-testid="branch-switch" label="Jatka tästä jatkosta" variant="secondary" size="row"
                onPress={() => (done.restored ? setSwapping(true) : swap())} />
            )}
          </div>
        ) : null}
      </section>
    )};
    const items = [
      ...done.before.map((i) => render(i, {actions: i.kind === 'user' ? menu(i.id) : undefined})),
      marker,
      ...sent.map((i) => render(i)),
    ];
    return <Timeline items={items} />;
  }

  const at = target ? CONVO.findIndex((i) => i.id === target) : -1;
  const lb = target ? leftBehind(CONVO, target) : null;
  const items: {id: string; kind: string; content: React.ReactNode}[] = CONVO.flatMap((i, n) => {
    const row = render(i, {busy, last: n === CONVO.length - 1, dim: at >= 0 && n >= at, actions: i.kind === 'user' ? menu(i.id) : undefined});
    if (i.id !== target || !lb) return [row];
    return [row, {id: 'confirm', kind: 'confirm', content: <Confirm mode={mode} lb={lb} busy={busy} onCancel={() => setTarget(null)} onGo={go(lb)} />}];
  });
  if (filesOnly) {
    items.push({id: 'restored', kind: 'restored', content: (
      <section className="rw-origin" data-testid="files-restored">
        <Icon name="restore" />
        <span>{filesOnly.undone
          ? <>Tiedostojen palautus peruttu: agentin muutokset ovat taas paikallaan. Agentille kerrottiin.</>
          : <><strong>{tiedostoa(filesOnly.lb.files.length)} palautettu</strong> tilaan ennen viestiäsi klo {filesOnly.lb.time}. Keskustelu jatkuu ennallaan; agentille kerrottiin palautuksesta.</>}</span>
        {filesOnly.undone ? null : <Button data-testid="undo-restore" label="Peru palautus" variant="quiet" size="row" onPress={() => setFilesOnly({...filesOnly, undone: true})} />}
      </section>
    )});
  }
  items.push(...sent.map((i) => render(i)));
  return <Timeline items={items} />;
}

// Switching continuations: the earlier one becomes the active branch again.
let setActive: (later: Item[]) => void = noop;

function Timeline({items}: {items: {id: string; kind: string; content: React.ReactNode}[]}) {
  return <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />;
}

// The composer's send appends the person's message and a reply.
let sendSink: (text: string) => void = noop;
function useSent(set: React.Dispatch<React.SetStateAction<Item[]>>) {
  useEffect(() => {
    sendSink = (text) => {
      set((s) => [...s, {id: `s${s.length}`, kind: 'user', time: '9.40', text}]);
      setTimeout(() => set((s) => [...s, {id: `r${s.length}`, kind: 'assistant', time: '9.41', text: REPLY}]), 700);
    };
    setActive = (later) => set(later);
    return () => { sendSink = noop; setActive = noop; };
  }, [set]);
}
function focusComposer() {
  setTimeout(() => {
    const f = document.querySelector<HTMLTextAreaElement>('.ah-cbox-field');
    f?.focus(); f?.setSelectionRange(f.value.length, f.value.length);
  }, 60);
}

let reviewTheme = 'light';
let reviewBusy = false;
let reviewStep: 'view' | 'choose' = 'choose';

function Main({direction, busy, step, generation}: {direction: number; busy: boolean; step: 'view' | 'choose'; generation: number}) {
  const [draft, setDraft] = useState('');
  const [stopped, setStopped] = useState(false);
  const title = 'Kesäajan virhe';
  const live = busy && !stopped;
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={<NowSections yours={[]} running={[
        {agentId: 'pi:orig', title, href: '/workspaces/ws_a?conversation=pi:orig', activityLabel: live ? 'Työssä' : 'Valmis', activity: live ? 'working' : undefined, controlLabel: '', workspaceName: 'aurinkokello', detail: 'aurinkokello', selected: true},
        {agentId: 'pi:other', title: 'Varjon piirto SVG:ksi', href: '/workspaces/ws_a?conversation=pi:other', activityLabel: 'Valmis', controlLabel: '', workspaceName: 'aurinkokello', detail: 'aurinkokello'},
      ]} />}>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" selected />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  return (
    <AppShell mobileTitle={title} rail={rail} main={
      <div className="ah-state">
        <ConversationFrame>
          <AgentHeader title={title} workspaceLabel="aurinkokello" workspaceHref="/workspaces/ws_a"
            activityLabel={live ? 'Työssä' : ''} activityAnimated={live} activityKind={live ? 'working' : 'neutral'}
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{onSave: async () => {}}} />
          <ConversationStream>
            <Rewind key={generation} mode={direction} busy={live} onStop={() => setStopped(true)} step={step} setDraft={setDraft} />
          </ConversationStream>
          <Composer value={draft} onChange={setDraft} activity={live ? 'working' : 'idle'} selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={(t) => { sendSink(t ?? draft); setDraft(''); }} onSteer={noop} onFollowUp={noop}
            onInterrupt={noop} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
        </ConversationFrame>
      </div>
    } />
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [busy, setBusy] = useState(reviewBusy);
  const [step, setStep] = useState(reviewStep);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const reset = () => setGeneration((g) => g + 1);
  return (
    <div className={`rw-review variant-${direction}`} data-direction={direction}>
      <header className="rw-bar" ref={bar}>
        <strong>Palaa tähän · tiedostot</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Alku <select id="step" value={step} onChange={(e) => { reviewStep = e.target.value as 'view' | 'choose'; setStep(reviewStep); reset(); }}>
          <option value="choose">Vahvistus auki</option><option value="view">Keskustelu</option></select></label>
        <label>Agentti <select id="busy" value={busy ? 'busy' : 'idle'} onChange={(e) => { reviewBusy = e.target.value === 'busy'; setBusy(reviewBusy); reset(); }}>
          <option value="idle">Valmis</option><option value="busy">Työssä</option></select></label>
        <button type="button" data-testid="rw-reset" onClick={reset}>Alusta</button>
        <ol className="rw-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rw-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_a?conversation=pi:orig']}>
          <Main direction={direction} busy={busy} step={step} generation={generation} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
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
