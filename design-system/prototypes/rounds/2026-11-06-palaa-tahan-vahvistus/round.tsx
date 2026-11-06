import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, AgentHeader, NowSections, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFloatingAction, ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Menu} from '../../../../web/src/components/Overlays';
import {Icon} from '../../../../web/src/components/Icon';
import {ChoiceMenu} from '../../../../web/src/components/ChoiceMenu';
import {Button, Checkbox, RadioGroup} from '../../../../web/src/components/Primitives';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-rewind-conversation, round 3. Jari chose round 2's C (6.11.): going
// back offers conversation and files, conversation only, or files only, as
// raine's better-pi-rewind does in its /rewind select. Round 2's confirmation
// card looked big. This round riffs on a compact confirmation with the same
// three choices: a popover at the message, a slim bar under it, and a small
// sheet above the composer. Each can start with file restore on or off (the
// review bar's Tiedostot select). Messages, rail, header, menu, radio group,
// choice menu, checkbox, floating action slot and composer are production
// components; the three confirmations, file list and branch row are this
// round's. Everything is synthetic; nothing is sent or restored.
const directions = ['A Ponnahdus', 'B Ohut palkki', 'C Pieni arkki'];
const LINES = [
  'A Ponnahdus: pieni ikkuna viestin ⋯-painikkeen alla, kolme valintaa allekkain ilman selitteitä; tiedostot yhdellä rivillä, lista Näytä-painikkeen takana.',
  'B Ohut palkki: yksi rivi viestin alla: Palaa tähän, valikko mitä palautetaan ja painikkeet; määrät ja tiedostot pienellä toisella rivillä.',
  'C Pieni arkki: matala paneeli kentän yllä, kaksi valintaa Keskustelu ja Tiedostot rinnakkain; viesti ja sen jälkeinen osa himmenevät keskustelussa.',
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


type What = 'both' | 'conversation' | 'files';
const CHOICES: {value: What; label: string; description: string}[] = [
  {value: 'both', label: 'Keskustelu ja tiedostot', description: 'Kuin et olisi lähettänyt tätä viestiä'},
  {value: 'conversation', label: 'Vain keskustelu', description: 'Tiedostot jäävät agentin muuttamiksi'},
  {value: 'files', label: 'Vain tiedostot', description: 'Keskustelu jatkuu ennallaan'},
];
const goLabel = (what: What, busy: boolean) => what === 'files' ? (busy ? 'Pysäytä ja palauta' : 'Palauta tiedostot')
  : what === 'both' ? (busy ? 'Pysäytä ja palaa' : 'Palaa ja palauta')
  : (busy ? 'Pysäytä ja palaa' : 'Palaa tähän');
const leaveLine = (lb: Left, what: What) => what === 'files' ? 'Keskustelu jatkuu ennallaan.' : `${counted(lb)} jäävät sivuun.`;

/** One line about files, the list behind Näytä. A checkpoint covers only the
 * agent's edit and write tools; a command's effects stay, so the line says so. */
function FilesLine({lb, restoring, icon = true, brief = false}: {lb: Left; restoring: boolean; icon?: boolean; brief?: boolean}) {
  const [open, setOpen] = useState(false);
  if (!lb.files.length) return <p className="rw-meta">Agentti ei muuttanut tiedostoja tämän jälkeen.</p>;
  return (
    <div className="rw-fileline" data-testid="file-line">
      <p className="rw-meta">
        {icon ? <Icon name={restoring ? 'restore' : 'file'} /> : null}
        {brief
          ? (restoring && lb.commands.length ? <span>Komennon muutokset jäävät.</span> : null)
          : <span>{restoring
            ? <>{tiedostoa(lb.files.length)} palautuu{lb.commands.length ? ', komennon muutokset jäävät' : ''}</>
            : <>{tiedostoa(lb.files.length)} jää agentin muuttamiksi</>}</span>}
        <button type="button" className="rw-link" data-testid="files-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Piilota tiedostot' : brief ? 'Näytä tiedostot' : 'Näytä'}</button>
      </p>
      {open ? (
        <ul className="rw-filelist" data-testid="file-list">
          {lb.files.map((f) => (
            <li key={f.path}><code>{f.path}</code><span className="rw-stat">+{f.add} −{f.del}</span></li>
          ))}
          {restoring ? lb.commands.map((c) => <li key={c} className="rw-cmd"><code>{c}</code><span className="rw-stat">jää</span></li>) : null}
        </ul>
      ) : null}
    </div>
  );
}

function Actions({what, busy, onCancel, onGo, disabled}: {what: What; busy: boolean; onCancel: () => void; onGo: () => void; disabled?: boolean}) {
  return (
    <div className="rw-actions">
      <Button data-testid="rewind-cancel" label="Peru" variant="quiet" size="row" onPress={onCancel} />
      <Button data-testid="rewind-go" label={goLabel(what, busy)} variant="primary" size="row" onPress={onGo}
        availability={disabled ? {state: 'disabled', reason: 'Valitse ainakin toinen'} : undefined} />
    </div>
  );
}
const BusyNote = ({busy}: {busy: boolean}) => (busy ? <p className="rw-meta rw-busy">Agentti on työssä; se pysäytetään ensin.</p> : null);

type ConfirmProps = {lb: Left; busy: boolean; initial: What; onCancel: () => void; onGo: (what: What) => void};

/** A: a small window under the message's ⋯, over the later part. */
function Popover({lb, busy, initial, onCancel, onGo}: ConfirmProps) {
  const [what, setWhat] = useState<What>(initial);
  return (
    <section className="rw-pop" role="dialog" aria-label="Palaa tähän" data-testid="rewind-confirm" data-what={what}>
      <h2>Palaa ennen tätä viestiä</h2>
      <RadioGroup label="Mitä palautetaan" value={what} onChange={setWhat} options={CHOICES.map(({value, label}) => ({value, label}))} />
      <p className="rw-meta">{leaveLine(lb, what)}</p>
      <FilesLine lb={lb} restoring={what !== 'conversation'} />
      <BusyNote busy={busy} />
      <Actions what={what} busy={busy} onCancel={onCancel} onGo={() => onGo(what)} />
    </section>
  );
}

/** B: one row under the message; counts and files on a quiet second line. */
function SlimBar({lb, busy, initial, onCancel, onGo}: ConfirmProps) {
  const [what, setWhat] = useState<What>(initial);
  return (
    <section className="rw-slim" aria-label="Palaa tähän" data-testid="rewind-confirm" data-what={what}>
      <div className="rw-slim-row">
        <span className="rw-slim-title"><Icon name="restore" />Palaa tähän</span>
        <ChoiceMenu data-testid="rewind-what" label="Mitä palautetaan" value={what} onChange={setWhat}
          options={CHOICES.map(({value, label, description}) => ({id: value, label, description}))} />
        <Actions what={what} busy={busy} onCancel={onCancel} onGo={() => onGo(what)} />
      </div>
      <div className="rw-slim-sub">
        <p className="rw-meta">{leaveLine(lb, what)}{busy ? ' Agentti pysäytetään ensin.' : ''}</p>
        <FilesLine lb={lb} restoring={what !== 'conversation'} icon={false} />
      </div>
    </section>
  );
}

/** C: a low panel above the composer; two toggles express the three choices. */
function Sheet({lb, busy, initial, onCancel, onGo}: ConfirmProps) {
  const [conv, setConv] = useState(initial !== 'files');
  const [files, setFiles] = useState(initial !== 'conversation');
  const what: What = conv && files ? 'both' : files ? 'files' : 'conversation';
  const n = lb.files.length;
  // Match the field box under the sheet, whatever padding the frame gives it.
  useLayoutEffect(() => {
    const box = document.querySelector('.ah-cbox');
    if (!box) return;
    const set = () => document.documentElement.style.setProperty('--rw-field-w', `${box.getBoundingClientRect().width}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(box);
    return () => o.disconnect();
  }, []);
  return (
    <ConversationFloatingAction>
      <section className="rw-sheet" role="dialog" aria-label="Palaa tähän" data-testid="rewind-confirm" data-what={conv || files ? what : 'none'}>
        <header className="rw-sheet-head">
          <h2>Palaa ennen viestiäsi klo {lb.time}</h2>
          <Button data-testid="sheet-close" label="Sulje" icon="cross" variant="quiet" size="row" onPress={onCancel} />
        </header>
        <div className="rw-sheet-toggles">
          <Checkbox data-testid="sheet-conversation" label="Keskustelu" hint={conv ? `${counted(lb)} sivuun` : 'Jatkuu ennallaan'} checked={conv} onChange={setConv} />
          <Checkbox data-testid="sheet-files" label="Tiedostot" hint={files ? `${tiedostoa(n)} palautuu` : `${tiedostoa(n)} jää ennalleen`} checked={files} onChange={setFiles} />
        </div>
        <div className="rw-sheet-foot">
          <FilesLine lb={lb} restoring={files} icon={false} brief />
          <BusyNote busy={busy} />
          <Actions what={what} busy={busy} onCancel={onCancel} onGo={() => onGo(what)} disabled={!conv && !files} />
        </div>
      </section>
    </ConversationFloatingAction>
  );
}

/** One history item through the production components. */
function render(item: Item, opts: {busy?: boolean; last?: boolean; actions?: React.ReactNode; dim?: boolean; open?: boolean; extra?: React.ReactNode} = {}) {
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
      <div className="rw-msg" data-own={item.kind === 'user' || undefined} data-left={opts.dim || undefined} data-open={opts.open || undefined} data-item={item.id}>
        {content}
        {opts.actions ? <div className="rw-msg-actions">{opts.actions}</div> : null}
        {opts.extra}
      </div>
    ),
  };
}

type Done = {before: Item[]; later: Item[]; own: number; replies: number; files: FileChange[]; restored: boolean; time: string};

/** Every riff is round 2's C: the same conversation continues from the earlier
 * point, the replaced continuation stays as one row at the branch point as it
 * stays in Pi's session tree, and files alone can be restored and undone. */
function Rewind({mode, busy, step, filesOn, setDraft, onStop}: {mode: number; busy: boolean; step: 'view' | 'choose'; filesOn: boolean; setDraft: (t: string) => void; onStop: () => void}) {
  const [target, setTarget] = useState<string | null>(step === 'choose' ? DEFAULT_TARGET : null);
  const [done, setDone] = useState<Done | null>(null);
  const [filesOnly, setFilesOnly] = useState<{lb: Left; undone: boolean} | null>(null);
  const [sent, setSent] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapFiles, setSwapFiles] = useState(filesOn);
  useSent(setSent);
  const initial: What = filesOn ? 'both' : 'conversation';
  const menu = (id: string) => (
    <Menu label="Viestin toiminnot" trigger={<Icon name="more" />} triggerPresentation="icon" triggerClassName="rw-msg-more" triggerTestId={`msg-menu-${id}`} placement="bottom end"
      items={[{id: 'back', label: 'Palaa tähän…', description: 'Keskustelu, tiedostot tai molemmat'}]}
      onAction={() => setTarget(id)} />
  );
  const go = (lb: Left) => (what: What) => {
    onStop(); setTarget(null);
    if (what === 'files') { setFilesOnly({lb, undone: false}); return; }
    setDone({...lb, restored: what === 'both'}); setDraft(lb.text); focusComposer();
  };
  // Bring the chosen message into view when the confirmation is elsewhere.
  useEffect(() => {
    if (!target) return;
    document.querySelector(`[data-item="${target}"]`)?.scrollIntoView({block: mode === C ? 'start' : 'center'});
    // The popover and the bar sit below the message, so they are what must fit.
    if (mode !== C) document.querySelector('.rw-pop, .rw-slim')?.scrollIntoView({block: 'nearest'});
  }, [target, mode]);

  if (done) {
    const swap = () => {
      // The two continuations trade places at the branch point. The one sent
      // after going back changed no files here, so nothing is left to restore.
      setDone({...done, later: sent, own: sent.filter((i) => i.kind === 'user').length, replies: sent.filter((i) => i.kind === 'assistant').length, files: [], restored: false});
      setActive(done.later); setOpen(false); setSwapping(false);
    };
    const fileNote = !done.files.length ? '' : done.restored ? ` · ${tiedostoa(done.files.length)} palautettu` : ' · tiedostot jäivät';
    const marker = {id: 'marker', kind: 'marker', content: (
      <section className="rw-branch" data-testid="branch-marker" aria-label="Aiempi jatko">
        <div className="rw-branch-row">
          <Icon name="branch" />
          <span><strong>Aiempi jatko</strong> · {counted(done)}{fileNote}</span>
          <Button data-testid="branch-toggle" label={open ? 'Piilota' : 'Näytä'} variant="quiet" size="row" onPress={() => setOpen(!open)} />
        </div>
        {open ? (
          <div className="rw-branch-body" data-testid="branch-body">
            <p className="rw-meta">Agentti ei näe tätä jatkoa. {done.restored ? 'Sen tiedostomuutokset on peruttu, ja ne palaavat, jos jatkat siitä.' : 'Voit jatkaa siitä.'}</p>
            <ol className="ah-feed">{done.later.map((i) => <li key={i.id}>{render(i, {dim: true}).content}</li>)}</ol>
            {swapping && done.restored ? (
              <div className="rw-swap" data-testid="swap-confirm">
                <Checkbox data-testid="swap-files" label="Palauta myös sen tiedostot" hint={`${tiedostoa(done.files.length)} palaa tilaan, johon agentti ne jätti`} checked={swapFiles} onChange={setSwapFiles} />
                <div className="rw-actions">
                  <Button label="Peru" variant="quiet" size="row" onPress={() => setSwapping(false)} />
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
    return <Timeline items={[
      ...done.before.map((i) => render(i, {actions: i.kind === 'user' ? menu(i.id) : undefined})),
      marker,
      ...sent.map((i) => render(i)),
    ]} />;
  }

  const at = target ? CONVO.findIndex((i) => i.id === target) : -1;
  const lb = target ? leftBehind(CONVO, target) : null;
  const props = lb ? {lb, busy, initial, onCancel: () => setTarget(null), onGo: go(lb)} : null;
  const items: {id: string; kind: string; content: React.ReactNode}[] = CONVO.flatMap((i, n) => {
    const chosen = i.id === target && props;
    const row = render(i, {busy, last: n === CONVO.length - 1, dim: at >= 0 && n >= at, open: Boolean(chosen),
      actions: i.kind === 'user' ? menu(i.id) : undefined,
      extra: chosen && mode === A ? <Popover {...props} /> : null});
    if (!chosen || mode === A) return [row];
    if (mode === B) return [row, {id: 'confirm', kind: 'confirm', content: <SlimBar {...props} />}];
    return [row, {id: 'confirm', kind: 'confirm', content: <Sheet {...props} />}];
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
let reviewFiles = 'on';

function Main({direction, busy, step, filesOn, generation}: {direction: number; busy: boolean; step: 'view' | 'choose'; filesOn: boolean; generation: number}) {
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
            <Rewind key={generation} mode={direction} busy={live} onStop={() => setStopped(true)} step={step} filesOn={filesOn} setDraft={setDraft} />
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
  const [files, setFiles] = useState(reviewFiles);
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
        <strong>Palaa tähän · vahvistus</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Tiedostot <select id="files" value={files} onChange={(e) => { reviewFiles = e.target.value; setFiles(reviewFiles); reset(); }}>
          <option value="on">Oletuksena mukana</option><option value="off">Oletuksena pois</option></select></label>
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
          <Main direction={direction} busy={busy} step={step} filesOn={files === 'on'} generation={generation} />
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
