import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
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
import {Button, RadioGroup, TextArea} from '../../../../web/src/components/Primitives';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-rewind-conversation. Habitat has no way to take a conversation back
// to an earlier message; Pi has three (/tree in place, /fork to a new session,
// /clone). The axis is where the action lives and what the result is: the
// same conversation continued from the earlier point (Pi's tree, in place),
// a new conversation in the rail (Pi's fork), or the message edited in place
// with its versions (Pi's tree, edited message). Every direction tells before
// confirming what is left behind and that the agent's file changes stay.
// Messages, rail, header, menu, dialog, radio group, text area and composer
// are the production components; the inline confirmation, branch marker and
// version switch are this round's. Everything is synthetic; nothing is sent.
const directions = ['A Palaa tähän', 'B Uusi alku', 'C Muokkaa'];
const LINES = [
  'A Palaa tähän: oman viestin ⋯-valikosta palataan ennen viestiä; sama keskustelu jatkuu, ja jätetty osa jää taitetuksi riviksi, jonka voi avata.',
  'B Uusi alku: otsakkeen ⋯ › Palaa aiempaan avaa listan omista viesteistä; valinnasta alkaa uusi keskustelu sivupalkkiin, ja alkuperäinen jää ennalleen.',
  'C Muokkaa: oman viestin kynästä viesti muuttuu kentäksi paikallaan; muutettu lähetys jatkaa siitä, ja viestissä on versiot ‹ 1/2 ›.',
];
const A = 0, B = 1, C = 2;

type Tool = {name: string; path: string; stat: string};
type Item = {id: string; kind: 'user' | 'assistant' | 'tools'; text?: string; time: string; tools?: Tool[]};

// The conversation: the second request was a wrong turn (adding an hour by
// hand), and the person wants to go back before it.
const CONVO: Item[] = [
  {id: 'u1', kind: 'user', time: '9.12', text: 'Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat.'},
  {id: 't1', kind: 'tools', time: '9.13', tools: [{name: 'bash', path: 'pytest -q', stat: ''}]},
  {id: 'a1', kind: 'assistant', time: '9.14', text: 'Ajoin testit: 41 läpi, 2 epäonnistui.\n\n- `test_dst_march` odottaa varjon kulmaksi 41,2°, mutta saa 26,2°: kesäajan tunti puuttuu laskusta.\n- `test_dst_october` epäonnistuu samasta syystä toiseen suuntaan.'},
  {id: 'u2', kind: 'user', time: '9.20', text: 'Korjaa kesäaika lisäämällä tunti kaikkiin maaliskuun laskuihin.'},
  {id: 't2', kind: 'tools', time: '9.22', tools: [
    {name: 'edit', path: 'src/shadow.py', stat: '+6 −2'},
    {name: 'edit', path: 'src/timezones.py', stat: '+3 −0'},
    {name: 'bash', path: 'pytest -q', stat: ''},
  ]},
  {id: 'a2', kind: 'assistant', time: '9.26', text: 'Lisäsin maaliskuun laskuihin tunnin. `test_dst_march` menee nyt läpi, mutta `test_dst_october` epäonnistuu yhä.'},
  {id: 'u3', kind: 'user', time: '9.28', text: 'Korjaa myös lokakuu samalla tavalla.'},
  {id: 't3', kind: 'tools', time: '9.30', tools: [
    {name: 'edit', path: 'src/shadow.py', stat: '+4 −1'},
    {name: 'edit', path: 'tests/test_shadow.py', stat: '+12 −0'},
  ]},
  {id: 'a3', kind: 'assistant', time: '9.31', text: 'Molemmat testit menevät läpi. Huomaa, että korjaus olettaa Suomen aikavyöhykkeen: muualla kesäaika vaihtuu eri päivinä.'},
];
const EDITED = 'Korjaa kesäaika käyttämällä zoneinfoa, älä lisää tunteja käsin. Testaa myös eteläinen pallonpuolisko.';
const REPLY = 'Selvä. Lasken paikallisen ajan zoneinfolla aikavyöhykkeen mukaan enkä lisää tunteja käsin. Lisään testit Helsingille ja Sydneylle.';
const DEFAULT_TARGET = 'u2';

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [{path: 'src/shadow.py', git: 'modified'}, {path: 'src/timezones.py', git: 'modified'}], truncated: false}),
  workspaceName: 'aurinkokello',
};

/** What going back before `target` leaves behind. */
function leftBehind(items: Item[], target: string) {
  const at = items.findIndex((i) => i.id === target);
  const later = items.slice(at);
  const own = later.filter((i) => i.kind === 'user').length;
  const replies = later.filter((i) => i.kind === 'assistant').length;
  const files = [...new Set(later.flatMap((i) => (i.tools ?? []).filter((t) => t.name === 'edit').map((t) => t.path)))];
  return {before: items.slice(0, at), later, own, replies, files, text: items[at]?.text ?? ''};
}
const viestia = (n: number) => (n === 1 ? '1 viestisi' : `${n} viestiäsi`);
const vastausta = (n: number) => (n === 1 ? '1 vastaus' : `${n} vastausta`);
const counted = (n: {own: number; replies: number}) => `${viestia(n.own)} ja ${vastausta(n.replies)}`;

function Files({files}: {files: string[]}) {
  if (!files.length) return <p className="rw-files">Agentti ei muuttanut tiedostoja tämän jälkeen.</p>;
  return (
    <p className="rw-files">
      <Icon name="warning" />
      <span>Agentin muutokset tiedostoihin jäävät ennalleen: {files.map((f, i) => <React.Fragment key={f}>{i ? ', ' : ''}<code>{f}</code></React.Fragment>)}.</span>
    </p>
  );
}

function BusyNote({busy, what}: {busy: boolean; what: string}) {
  return busy ? <p className="rw-busy">Agentti on vielä työssä. {what} pysäyttää sen ensin.</p> : null;
}

/** One history item through the production components. */
function render(item: Item, opts: {busy?: boolean; last?: boolean; actions?: React.ReactNode; dim?: boolean; text?: string} = {}) {
  let content: React.ReactNode;
  if (item.kind === 'user') {
    const text = opts.text ?? item.text!;
    content = (
      <UserMessage sourceText={text} onCopy={noop} time={item.time}>
        <Markdown text={text} />
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

type Sent = Item[];

/** A: the same conversation continues from the earlier point; the abandoned
 * part folds into one row at the branch point. */
function DirectionA({busy, step, setDraft, onStop}: {busy: boolean; step: 'view' | 'choose'; setDraft: (t: string) => void; onStop: () => void}) {
  const [target, setTarget] = useState<string | null>(step === 'choose' ? DEFAULT_TARGET : null);
  const [done, setDone] = useState<{before: Item[]; later: Item[]; own: number; replies: number; files: string[]} | null>(null);
  const [sent, setSent] = useState<Sent>([]);
  const [open, setOpen] = useState(false);
  useSent(setSent);
  const menu = (id: string) => (
    <Menu label="Viestin toiminnot" trigger={<Icon name="more" />} triggerPresentation="icon" triggerClassName="rw-msg-more" triggerTestId={`msg-menu-${id}`} placement="bottom end"
      items={[
        {id: 'back', label: 'Palaa tähän', description: 'Jatka ennen tätä viestiä; viesti tulee kenttään muutettavaksi'},
      ]}
      onAction={() => setTarget(id)} />
  );
  if (done) {
    const marker = {id: 'marker', kind: 'marker', content: (
      <section className="rw-branch" data-testid="branch-marker" aria-label="Aiempi jatko">
        <div className="rw-branch-row">
          <Icon name="branch" />
          <span><strong>Aiempi jatko</strong> · {counted(done)}{done.files.length ? ` · ${done.files.length} tiedostoa muutettu` : ''}</span>
          <Button data-testid="branch-toggle" label={open ? 'Piilota' : 'Näytä'} variant="quiet" size="row" onPress={() => setOpen(!open)} />
        </div>
        {open ? (
          <div className="rw-branch-body" data-testid="branch-body">
            <p className="rw-quiet">Agentti ei näe tätä osaa. Voit palata siihen.</p>
            <ol className="ah-feed">{done.later.map((i) => <li key={i.id}>{render(i, {dim: true}).content}</li>)}</ol>
            <Button data-testid="branch-switch" label="Jatka tästä jatkosta" variant="secondary" size="row"
              onPress={() => { setDone({...done, before: [...done.before, ...done.later], later: sent, own: sent.filter((i) => i.kind === 'user').length, replies: sent.filter((i) => i.kind === 'assistant').length, files: []}); setSent([]); setOpen(false); }} />
          </div>
        ) : null}
      </section>
    )};
    const items = [...done.before.map((i) => render(i, {actions: i.kind === 'user' ? menu(i.id) : undefined})), marker, ...sent.map((i, n) => render(i, {busy: false, last: n === sent.length - 1}))];
    return <Timeline items={items} />;
  }
  const lb = target ? leftBehind(CONVO, target) : null;
  const at = target ? CONVO.findIndex((i) => i.id === target) : -1;
  const items = CONVO.flatMap((i, n) => {
    const row = render(i, {busy, last: n === CONVO.length - 1, dim: at >= 0 && n >= at, actions: i.kind === 'user' ? menu(i.id) : undefined});
    if (i.id !== target || !lb) return [row];
    const confirm = {id: 'confirm', kind: 'confirm', content: (
      <section className="rw-confirm" data-testid="rewind-confirm" aria-label="Palaa tähän">
        <h2>Palaa ennen tätä viestiä?</h2>
        <p>Keskustelu jatkuu tästä kohdasta. Sen jälkeiset {counted(lb)} siirtyvät sivuun, ja voit avata ne myöhemmin. Viestisi tulee kenttään, jotta voit muuttaa sen.</p>
        <Files files={lb.files} />
        <BusyNote busy={busy} what="Palaaminen" />
        <div className="rw-actions">
          <Button data-testid="rewind-cancel" label="Peru" variant="secondary" size="row" onPress={() => setTarget(null)} />
          <Button data-testid="rewind-go" label={busy ? 'Pysäytä ja palaa' : 'Palaa tähän'} variant="primary" size="row"
            onPress={() => { onStop(); setDone(lb); setDraft(lb.text); setTarget(null); focusComposer(); }} />
        </div>
      </section>
    )};
    return [row, confirm];
  });
  return <Timeline items={items} />;
}

/** B: header ⋯ › Palaa aiempaan lists own messages; the choice starts a new
 * conversation (Pi's fork) and leaves the original untouched. */
function DirectionB({busy, step, setDraft, forked, setForked}: {busy: boolean; step: 'view' | 'choose'; setDraft: (t: string) => void; forked: string | null; setForked: (t: string | null) => void}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sent, setSent] = useState<Sent>([]);
  useSent(setSent);
  const showing = new URLSearchParams(location.search).get('conversation') === 'pi:fork' ? 'fork' : 'orig';
  if (forked && showing === 'fork') {
    const lb = leftBehind(CONVO, forked);
    const origin = {id: 'origin', kind: 'origin', content: (
      <section className="rw-origin" data-testid="fork-origin">
        <Icon name="branch" />
        <span>Jatkoa keskustelusta <strong>Kesäajan virhe</strong> ennen viestiäsi klo {CONVO.find((i) => i.id === forked)!.time}.</span>
        <Button data-testid="open-original" label="Avaa alkuperäinen" variant="quiet" size="row" onPress={() => navigate('/workspaces/ws_a?conversation=pi:orig')} />
      </section>
    )};
    return <Timeline items={[...lb.before.map((i) => render(i)), origin, ...sent.map((i) => render(i))]} />;
  }
  const at = forked ? CONVO.findIndex((i) => i.id === forked) : -1;
  const items = CONVO.flatMap((i, n) => {
    const row = render(i, {busy, last: n === CONVO.length - 1});
    if (n !== at) return [row];
    return [{id: 'child', kind: 'child', content: (
      <section className="rw-origin" data-testid="fork-child">
        <Icon name="branch" />
        <span>Tästä kohdasta jatkettiin uudessa keskustelussa <strong>Kesäajan virhe (uusi alku)</strong>.</span>
        <Button label="Avaa" variant="quiet" size="row" onPress={() => navigate('/workspaces/ws_a?conversation=pi:fork')} />
      </section>
    )}, row];
  });
  return (
    <>
      <Timeline items={items} />
      <ForkDialog open={step === 'choose' && !forked} busy={busy}
        onFork={(id) => { setForked(id); setDraft(leftBehind(CONVO, id).text); navigate('/workspaces/ws_a?conversation=pi:fork'); focusComposer(); }} />
    </>
  );
}

let openForkDialog: (open: boolean) => void = noop;
function ForkDialog({open: initial, busy, onFork}: {open: boolean; busy: boolean; onFork: (id: string) => void}) {
  const [open, setOpen] = useState(initial);
  const [choice, setChoice] = useState(DEFAULT_TARGET);
  openForkDialog = setOpen;
  const own = CONVO.filter((i) => i.kind === 'user');
  const lb = leftBehind(CONVO, choice);
  return (
    <ModalOverlay className="ah-overlay" isDismissable isOpen={open} onOpenChange={setOpen}>
      <Modal className="ah-modal">
        <AriaDialog className="ah-dialog rw-fork-dialog" data-testid="fork-dialog" aria-label="Palaa aiempaan">
          <Heading slot="title">Palaa aiempaan</Heading>
          <p>Valitse viestisi. Uusi keskustelu alkaa sitä ennen, ja viesti tulee kenttään muutettavaksi.</p>
          <RadioGroup label="Viestisi" value={choice} onChange={setChoice}
            options={own.map((i) => ({value: i.id, label: i.text!, description: `klo ${i.time}`}))} />
          <div className="rw-fork-preview" data-testid="fork-preview">
            <p>Uudessa keskustelussa on {lb.before.length ? counted({own: lb.before.filter((i) => i.kind === 'user').length, replies: lb.before.filter((i) => i.kind === 'assistant').length}) : 'ei vielä viestejä'}. Tämä keskustelu jää sivupalkkiin ennalleen, myös {counted(lb)} valitusta eteenpäin.</p>
            <Files files={lb.files} />
            <BusyNote busy={busy} what="Uuden aloittaminen" />
          </div>
          <div className="ah-dialog-actions">
            <Button data-testid="fork-cancel" label="Peru" variant="secondary" size="page" onPress={() => setOpen(false)} />
            <Button data-testid="fork-go" label={busy ? 'Pysäytä ja aloita uusi' : 'Aloita uusi keskustelu'} variant="primary" size="page" onPress={() => { setOpen(false); onFork(choice); }} />
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** C: the pencil turns the message into a field in place; a changed send
 * continues from there, and the message keeps its versions. */
function DirectionC({busy, step, onStop}: {busy: boolean; step: 'view' | 'choose'; onStop: () => void}) {
  const [editing, setEditing] = useState<string | null>(step === 'choose' ? DEFAULT_TARGET : null);
  const [value, setValue] = useState(EDITED);
  const [edit, setEdit] = useState<{target: string; text: string; reply: Item[]} | null>(null);
  const [version, setVersion] = useState(2);
  const pencil = (id: string) => (
    <Button data-testid={`msg-edit-${id}`} label="Muokkaa" ariaLabel="Muokkaa viestiä" icon="pencil" presentation="messageIcon" variant="quiet" size="row"
      onPress={() => { setEditing(id); setValue(CONVO.find((i) => i.id === id)!.text!); }} />
  );
  const pager = (
    <span className="rw-pager" data-testid="version-pager">
      <Button data-testid="version-prev" label="Edellinen versio" ariaLabel="Edellinen versio" icon="back" presentation="messageIcon" variant="quiet" size="row"
        availability={version === 1 ? {state: 'disabled', reason: ''} : undefined} onPress={() => setVersion(1)} />
      <span aria-live="polite">{version}/2</span>
      <Button data-testid="version-next" label="Seuraava versio" ariaLabel="Seuraava versio" icon="forward" presentation="messageIcon" variant="quiet" size="row"
        availability={version === 2 ? {state: 'disabled', reason: ''} : undefined} onPress={() => setVersion(2)} />
    </span>
  );
  if (edit) {
    const lb = leftBehind(CONVO, edit.target);
    const t = CONVO.find((i) => i.id === edit.target)!;
    const items = [
      ...lb.before.map((i) => render(i, {actions: i.kind === 'user' ? pencil(i.id) : undefined})),
      render(t, {text: version === 2 ? edit.text : t.text, actions: pager}),
      ...(version === 2 ? edit.reply.map((i) => render(i)) : [
        ...lb.later.slice(1).map((i) => render(i, {dim: true})),
        {id: 'old', kind: 'old', content: (
          <section className="rw-origin" data-testid="old-version">
            <Icon name="branch" />
            <span>Aiempi versio. Agentti ei näe sitä.</span>
            <Button data-testid="version-back" label="Takaisin uusimpaan" variant="quiet" size="row" onPress={() => setVersion(2)} />
          </section>
        )},
      ]),
    ];
    return <Timeline items={items} />;
  }
  const at = editing ? CONVO.findIndex((i) => i.id === editing) : -1;
  const lb = editing ? leftBehind(CONVO, editing) : null;
  const items = CONVO.map((i, n) => {
    if (i.id === editing && lb) {
      return {id: i.id, kind: 'edit', content: (
        <section className="rw-edit" data-testid="edit-message" aria-label="Muokkaa viestiä">
          <TextArea data-testid="edit-field" label="Muokkaa viestiäsi" value={value} onChange={setValue} rows={3} />
          <p>Lähetät muutetun viestin tästä kohdasta. Aiempi jatko ({counted({own: lb.own - 1, replies: lb.replies})}) jää talteen versioksi 1.</p>
          <Files files={lb.files} />
          <BusyNote busy={busy} what="Lähettäminen" />
          <div className="rw-actions">
            <Button data-testid="edit-cancel" label="Peru" variant="secondary" size="row" onPress={() => setEditing(null)} />
            <Button data-testid="edit-send" label={busy ? 'Pysäytä ja lähetä' : 'Lähetä muutettu'} variant="primary" size="row"
              availability={value.trim() ? undefined : {state: 'disabled', reason: 'Kirjoita viesti'}}
              onPress={() => {
                const target = editing!;
                onStop();
                setEdit({target, text: value, reply: []}); setEditing(null); setVersion(2);
                setTimeout(() => setEdit((e) => e && {...e, reply: [{id: 'r-c', kind: 'assistant', time: '9.41', text: REPLY}]}), 700);
              }} />
          </div>
        </section>
      )};
    }
    return render(i, {busy, last: n === CONVO.length - 1, dim: at >= 0 && n > at, actions: i.kind === 'user' ? pencil(i.id) : undefined});
  });
  return <Timeline items={items} />;
}

function Timeline({items}: {items: {id: string; kind: string; content: React.ReactNode}[]}) {
  return <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />;
}

// The composer's send in A and B appends the person's message and a reply.
let sendSink: (text: string) => void = noop;
function useSent(set: React.Dispatch<React.SetStateAction<Sent>>) {
  useEffect(() => {
    sendSink = (text) => {
      set((s) => [...s, {id: `s${s.length}`, kind: 'user', time: '9.40', text}]);
      setTimeout(() => set((s) => [...s, {id: `r${s.length}`, kind: 'assistant', time: '9.41', text: REPLY}]), 700);
    };
    return () => { sendSink = noop; };
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
  const [forked, setForked] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const onStop = () => setStopped(true);
  const location = useLocation();
  const inFork = direction === B && !!forked && location.search.includes('pi:fork');
  const title = inFork ? 'Kesäajan virhe (uusi alku)' : 'Kesäajan virhe';
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={<NowSections yours={[]} running={[
        ...(direction === B && forked ? [{agentId: 'pi:fork', title: 'Kesäajan virhe (uusi alku)', href: '/workspaces/ws_a?conversation=pi:fork', activityLabel: 'Odottaa viestiä', controlLabel: '', workspaceName: 'aurinkokello', detail: 'aurinkokello', selected: inFork}] : []),
        {agentId: 'pi:orig', title: 'Kesäajan virhe', href: '/workspaces/ws_a?conversation=pi:orig', activityLabel: busy ? 'Työssä' : 'Valmis', activity: busy ? 'working' : undefined, controlLabel: '', workspaceName: 'aurinkokello', detail: 'aurinkokello', selected: !inFork},
        {agentId: 'pi:other', title: 'Varjon piirto SVG:ksi', href: '/workspaces/ws_a?conversation=pi:other', activityLabel: 'Valmis', controlLabel: '', workspaceName: 'aurinkokello', detail: 'aurinkokello'},
      ]} />}>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" selected />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  // B's own ⋯ stands in for the production menu with one item added; on a
  // desktop the production menu shows only when the row has shortened.
  const headerMenu = direction === B ? (
    <Menu label="Keskustelun toiminnot" trigger={<Icon name="more" />} triggerPresentation="icon" triggerClassName="ah-header-more rw-header-more" triggerTestId="rw-conversation-menu" placement="bottom end"
      heading={<p className="ah-header-full-title">{title}</p>}
      items={[
        {id: 'rename', label: 'Nimeä uudelleen'},
        {id: 'rewind', label: 'Palaa aiempaan…', description: 'Aloita uusi keskustelu aiemmasta viestistä', availability: inFork ? {state: 'disabled', reason: 'Tässä keskustelussa ei ole vielä omia viestejä tämän jälkeen'} : undefined},
        {id: 'details', label: 'Tiedot'},
      ]}
      onAction={(id) => { if (id === 'rewind') setTimeout(() => openForkDialog(true)); }} />
  ) : undefined;
  const live = busy && !stopped && !(direction === B && inFork);
  return (
    <AppShell mobileTitle={title} rail={rail} main={
      <div className="ah-state">
        <ConversationFrame>
          <AgentHeader title={title} workspaceLabel="aurinkokello" workspaceHref="/workspaces/ws_a"
            activityLabel={live ? 'Työssä' : ''} activityAnimated={live} activityKind={live ? 'working' : 'neutral'}
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} terminal={headerMenu}
            rename={{onSave: async () => {}}} />
          <ConversationStream>
            {direction === A ? <DirectionA key={generation} busy={live} onStop={onStop} step={step} setDraft={setDraft} /> : null}
            {direction === B ? <DirectionB key={generation} busy={live} step={step} setDraft={setDraft} forked={forked} setForked={setForked} /> : null}
            {direction === C ? <DirectionC key={generation} busy={live} onStop={onStop} step={step} /> : null}
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
        <strong>Palaa aiempaan</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Alku <select id="step" value={step} onChange={(e) => { reviewStep = e.target.value as 'view' | 'choose'; setStep(reviewStep); reset(); }}>
          <option value="choose">Valinta auki</option><option value="view">Keskustelu</option></select></label>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
