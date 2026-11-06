import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Menu, MenuTrigger, Popover} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, AgentHeader, NowSections, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {OutputBox} from '../../../../web/src/components/OutputBox';
import {EditorSplit} from '../../../../web/src/components/EditorSplit';
import {EditorHeaderActions} from '../../../../web/src/components/EditorHeader';
import {BrowserEditor} from '../../../../web/src/components/BrowserEditor';
import {ControlButton, ControlMenuItem, IconButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Button, TextField} from '../../../../web/src/components/Primitives';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-markdown-block-preview, round 2. Round 1 settled the place: the
// action lives in the block itself, among the production OutputBox's
// right-edge controls, right under copy. This round riffs that one control
// and what it does: (1) a toggle that draws the block rendered in place and
// back to source, (2) a button that opens the block in the workspace
// editor's own Markdown preview as an unsaved draft, (3) one button that
// opens a small menu offering both. Messages, rail, header, OutputBox,
// EditorSplit, BrowserEditor, menu items and composer are the production
// components; the extra rail control, the rendered surface inside the box and
// the save card are this round's. Synthetic content; nothing is written.
const directions = ['Nyt', '1 Paikallaan', '2 Editoriin', '3 Valikko'];
const LINES = [
  'Nyt: Markdown-lohko on koodilaatikko; oikeassa reunassa kopiointi, näkymän valinta ja oma ikkuna, kielimerkintä yläkulmassa.',
  '1 Paikallaan: kopioinnin alla silmä, joka vaihtaa lohkon renderöidyksi samaan kohtaan ja painettuna takaisin lähteeksi.',
  '2 Editoriin: kopioinnin alla editoripainike, joka avaa lohkon editorin Markdown-esikatseluun tallentamattomana luonnoksena.',
  '3 Valikko: kopioinnin alla silmä, joka avaa pienen valikon: esikatsele tässä tai avaa editorin esikatselussa.',
];
const NOW = 0, INPLACE = 1, EDITOR = 2, MENU = 3;

const SHORT = `# Kaarinan pyöräseura

Seuran kotisivu: tapahtumat, reitit ja jäsenasiat.
Julkaisuohje: [docs/julkaisu.md](docs/julkaisu.md)
`;

const DRAFT = `# Sivuston julkaisu

Tämä ohje kertoo, miten pyöräseuran sivuston uusi versio julkaistaan. Julkaisu tehdään **GitHub Actionsilla**; palvelimelle ei kopioida mitään käsin.

## Ennen julkaisua

- [ ] Muutokset on yhdistetty \`main\`-haaraan.
- [ ] Esikatselu on tarkistettu Netlifyssä.
- [ ] Tapahtumakalenterin päivämäärät on tarkistettu.

## Julkaisu

1. Avaa *Actions*-välilehti ja valitse **Julkaise sivusto**.
2. Paina **Run workflow** ja valitse haara \`main\`.
3. Odota, että kaikki vaiheet ovat vihreinä (noin 3 minuuttia).

Saman voi ajaa omalla koneella:

\`\`\`bash
npm ci
npm run build
npm run deploy -- --prod
\`\`\`

## Kuka saa julkaista

| Rooli | Julkaisu | Peruminen |
| --- | --- | --- |
| Hallitus | kyllä | kyllä |
| Viestintävastaava | kyllä | ei |
| Muut jäsenet | ei | ei |

> Jos julkaisu epäonnistuu, edellinen versio jää näkyviin. Kerro siitä kanavalla #sivusto.
`;

type Seg = {kind: 'prose'; text: string} | {kind: 'md'; id: string; text: string};
type Item = {id: string; kind: 'user' | 'assistant' | 'tools'; time: string; text?: string; segs?: Seg[]; tools?: {name: string; path: string}[]};

const fence = (body: string, ticks: string) => `${ticks}markdown\n${body}${ticks}`;
const CONVO: Item[] = [
  {id: 'u1', kind: 'user', time: '10.31', text: 'Mitä README:n alkuun kannattaisi lisätä?'},
  {id: 'a1', kind: 'assistant', time: '10.32', segs: [
    {kind: 'prose', text: 'README alkaa nyt suoraan asennusohjeella. Ehdotan alkuun lyhyen kuvauksen ja linkin julkaisuohjeeseen:'},
    {kind: 'md', id: 'readme', text: SHORT},
  ]},
  {id: 'u2', kind: 'user', time: '10.38', text: 'Kirjoita luonnos julkaisuohjeeksi. Näytä se ensin tässä, älä vielä kirjoita tiedostoon.'},
  {id: 't2', kind: 'tools', time: '10.39', tools: [{name: 'read', path: '.github/workflows/deploy.yml'}, {name: 'read', path: 'netlify.toml'}]},
  {id: 'a2', kind: 'assistant', time: '10.42', segs: [
    {kind: 'prose', text: 'Tässä luonnos tiedostoksi `docs/julkaisu.md`. Se olettaa, että julkaisu tehdään GitHub Actionsilla ja esikatselu on Netlifyssä, kuten `deploy.yml` ja `netlify.toml` kertovat.'},
    {kind: 'md', id: 'draft', text: DRAFT},
    {kind: 'prose', text: 'Kirjoitanko sen tiedostoon sellaisenaan, vai muutetaanko ensin roolitaulukkoa?'},
  ]},
];
// Today's reply source: the same segments as one Markdown text.
const sourceOf = (segs: Seg[]) => segs.map((s) => (s.kind === 'prose' ? s.text : fence(s.text, s.text.includes('```') ? '````' : '```'))).join('\n\n');
const lineCount = (text: string) => text.replace(/\n$/, '').split('\n').length;

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [{path: 'README.md', git: 'modified'}], truncated: false}),
  workspaceName: 'pyoraseura',
};

/** Rendered Markdown inside the box, where the source was; long text is clipped. */
function Rendered({text}: {text: string}) {
  const [all, setAll] = useState(false);
  const long = lineCount(text) > 10;
  return (
    <div className={`mdp-rendered${long && !all ? ' mdp-rendered-clipped' : ''}`} data-testid="md-rendered">
      <Markdown text={text} />
      {long ? (
        <div className="mdp-rendered-more">
          <ControlButton size="inline" variant="quiet" data-testid="md-all" onPress={() => setAll(!all)}>
            {all ? 'Näytä vähemmän' : `Näytä kaikki ${lineCount(text)} riviä`}
          </ControlButton>
        </div>
      ) : null}
    </div>
  );
}

/** The production fenced block: the figure MarkdownRenderer draws around
    OutputBox, with one more rail group under copy and, when rendered, the
    document in the box's content column instead of the source. */
function CodeFigure({text, extra, rendered}: {text: string; extra?: React.ReactNode; rendered?: boolean}) {
  const figure = useRef<HTMLElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!extra) return;
    const copyGroup = figure.current?.querySelector('.ah-bash-rail > .ah-output-group');
    if (!copyGroup) return;
    const el = document.createElement('div');
    el.className = 'ah-output-group mdp-rail-group';
    copyGroup.after(el);
    setSlot(el);
    return () => el.remove();
  }, [!!extra]);
  useLayoutEffect(() => {
    if (!rendered) return;
    const rail = figure.current?.querySelector('.ah-bash-window > .ah-bash-rail');
    if (!rail) return;
    const el = document.createElement('div');
    el.className = 'mdp-rendered-slot';
    rail.before(el);
    setBody(el);
    return () => { el.remove(); setBody(null); };
  }, [rendered]);
  return (
    <figure className="ah-markdown-code" ref={figure} data-rendered={rendered ? 'true' : undefined}>
      <OutputBox text={text} language="markdown" copyLabel="Kopioi koodi" complete />
      {slot && extra ? createPortal(extra, slot) : null}
      {body && rendered ? createPortal(<Rendered text={text} />, body) : null}
    </figure>
  );
}

/** 1: one toggle; pressed means the block shows rendered. */
function ToggleControl({rendered, onToggle}: {rendered: boolean; onToggle: () => void}) {
  const label = rendered ? 'Näytä Markdown-lähde' : 'Näytä renderöitynä';
  return (
    <IconButton size="inline" variant="quiet" data-testid="md-toggle" aria-label={label} title={label} aria-pressed={rendered} onPress={onToggle}>
      <Icon name="eye" />
    </IconButton>
  );
}

/** 2: one button; pressed while the draft is open in the editor. */
function EditorControl({opened, onOpen}: {opened: boolean; onOpen: () => void}) {
  const label = opened ? 'Esikatselu on auki editorissa' : 'Avaa editorin esikatselussa';
  return (
    <IconButton size="inline" variant="quiet" data-testid="md-editor" aria-label={label} title={label} aria-pressed={opened} onPress={onOpen}>
      <Icon name="editor" />
    </IconButton>
  );
}

/** 3: one button and a small menu with both actions. */
function MenuControl({rendered, opened, startOpen, onToggle, onOpen}: {rendered: boolean; opened: boolean; startOpen: boolean; onToggle: () => void; onOpen: () => void}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // The default view opens the menu once the block has been scrolled to it.
  useEffect(() => {
    if (!startOpen) return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [startOpen]);
  return (
    <MenuTrigger isOpen={open} onOpenChange={(next) => { setOpen(next); if (!next) queueMicrotask(() => trigger.current?.focus()); }}>
      <IconButton ref={trigger} size="inline" variant="quiet" data-testid="md-menu" aria-label="Esikatselu" title="Esikatselu"
        aria-pressed={rendered || opened}>
        <Icon name="eye" />
      </IconButton>
      <Popover placement="left top" offset={6} className="ah-popover mdp-menu" data-testid="md-menu-popover">
        <Menu aria-label="Esikatselu" onAction={(key) => (key === 'here' ? onToggle() : onOpen())}>
          <ControlMenuItem id="here" data-testid="md-menu-here" textValue={rendered ? 'Näytä lähde' : 'Esikatsele tässä'}>
            <span>{rendered ? 'Näytä lähde' : 'Esikatsele tässä'}</span>
            <small>{rendered ? 'Lohko näkyy taas koodina' : 'Renderöitynä keskustelussa'}</small>
          </ControlMenuItem>
          <ControlMenuItem id="editor" data-testid="md-menu-editor" textValue="Avaa editorin esikatselussa">
            <span>{opened ? 'Esikatselu on auki editorissa' : 'Avaa editorin esikatselussa'}</span>
            <small>Luonnoksena, jonka voi muokata ja tallentaa</small>
          </ControlMenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

type BlockState = {rendered: string[]; opened: string | null; menuOpen: string | null; toggle: (id: string) => void; open: (id: string) => void};

/** One history item through the production components. */
function render(item: Item, mode: number, st: BlockState) {
  let content: React.ReactNode;
  if (item.kind === 'user') {
    content = (
      <UserMessage sourceText={item.text!} onCopy={noop} time={item.time}>
        <Markdown text={item.text!} breaks />
      </UserMessage>
    );
  } else if (item.kind === 'tools') {
    content = (
      <div className="mdp-tools">
        {item.tools!.map((t, i) => (
          <ToolRow key={i} name={t.name} targetText={t.path} statusLabel="Valmis" state="succeeded" expanded={false} onToggle={noop} />
        ))}
      </div>
    );
  } else {
    const segs = item.segs!;
    const control = (id: string) => {
      const rendered = st.rendered.includes(id), opened = st.opened === id;
      if (mode === INPLACE) return <ToggleControl rendered={rendered} onToggle={() => st.toggle(id)} />;
      if (mode === EDITOR) return <EditorControl opened={opened} onOpen={() => st.open(id)} />;
      return <MenuControl rendered={rendered} opened={opened} startOpen={st.menuOpen === id} onToggle={() => st.toggle(id)} onOpen={() => st.open(id)} />;
    };
    content = (
      <AssistantMessage streamState="complete" time={item.time} onCopy={noop}>
        {mode === NOW ? <Markdown text={sourceOf(segs)} /> : (
          <div className="mdp-reply">
            {segs.map((s, i) => s.kind === 'prose' ? <Markdown key={i} text={s.text} />
              : <CodeFigure key={i} text={s.text} rendered={st.rendered.includes(s.id)} extra={control(s.id)} />)}
          </div>
        )}
      </AssistantMessage>
    );
  }
  return {id: item.id, kind: item.kind, content: <div className="mdp-msg" data-item={item.id}>{content}</div>};
}

const blockText = (id: string) => (id === 'readme' ? SHORT : DRAFT);
const draftName = (id: string) => (id === 'readme' ? 'luonnos-readme.md' : 'luonnos-julkaisu.md');
const savePath = (id: string) => (id === 'readme' ? 'README.md' : 'docs/julkaisu.md');
const replyTime = (id: string) => (id === 'readme' ? '10.32' : '10.42');

type Draft = {id: string; path: string; content: string; saved?: string; dirty: boolean; revision: number};

/** The editor's save asks where the draft goes in the workspace. */
function SaveCard({draft, onCancel, onSave}: {draft: Draft; onCancel: () => void; onSave: (path: string) => void}) {
  const [path, setPath] = useState(savePath(draft.id));
  return (
    <section className="mdp-save" data-testid="md-save" aria-label="Tallenna työtilaan">
      <h2>Tallenna työtilaan</h2>
      <p>Luonnos on vain tässä välilehdessä. Tallennus tekee siitä tiedoston, jonka myös agentti näkee.</p>
      <TextField data-testid="md-save-path" label="Tiedosto" mono value={path} onChange={setPath} />
      <div className="mdp-actions">
        <Button label="Peru" variant="secondary" size="row" onPress={onCancel} />
        <Button data-testid="md-save-go" label="Tallenna" variant="primary" size="row" onPress={() => onSave(path)} />
      </div>
    </section>
  );
}

/** The production browser editor with the block as an unsaved draft. */
function DraftEditor({draft, onChange, onClose, collapsed, onToggleCollapsed}: {draft: Draft; onChange: (d: Draft) => void; onClose: () => void; collapsed: boolean; onToggleCollapsed: () => void}) {
  const host = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  // A block opens in the preview; the text is one press away in the editor's own toggle.
  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      const toggle = host.current?.querySelector<HTMLElement>('[data-testid="editor-preview-toggle"]');
      if (toggle?.getAttribute('aria-pressed') === 'true' || ++tries > 80) { clearInterval(t); return; }
      if (host.current?.querySelector('.cm-content')) toggle?.click();
    }, 50);
    return () => clearInterval(t);
  }, [draft.id, draft.revision]);
  return (
    <div className="mdp-editor" ref={host} data-draft={draft.saved ? 'saved' : 'draft'}>
      <BrowserEditor
        engine="codemirror6"
        document={{path: draft.saved ?? draft.path, content: draft.content, revision: draft.revision}}
        directories={{'': {entries: [{name: 'docs', kind: 'directory'}, {name: 'README.md', kind: 'file'}, {name: 'netlify.toml', kind: 'file'}]}}}
        onLoadDirectory={noop} picker={false} onPicker={noop} onOpen={noop}
        dirty={draft.dirty} saving={false} loading={false}
        notice={draft.saved ? `Tallennettu tiedostoon ${draft.saved}.` : `Luonnos agentin vastauksesta klo ${replyTime(draft.id)} · ei vielä työtilassa`}
        onChange={(content) => onChange({...draft, content, dirty: true})}
        onSave={() => setSaving(true)} onReload={noop} onImportNow={noop} onUndoImport={noop} onReimport={noop}
        toolbarActions={<EditorHeaderActions collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} onClose={onClose} />}
      />
      {saving ? <SaveCard draft={draft} onCancel={() => setSaving(false)} onSave={(path) => { setSaving(false); onChange({...draft, saved: path, dirty: false, revision: draft.revision + 1}); }} /> : null}
    </div>
  );
}

let reviewTheme = 'light';
let reviewStart: 'open' | 'closed' = 'open';
function Main({direction, start}: {direction: number; start: 'open' | 'closed'}) {
  const [draft, setDraft] = useState('');
  const shown = start === 'open';
  // The default view shows what each riff does: 1 the long draft rendered in
  // place, 2 the draft open in the editor, 3 the menu open on the draft with
  // the short block already rendered from it.
  const [rendered, setRendered] = useState<string[]>(shown ? (direction === INPLACE ? ['draft'] : direction === MENU ? ['readme'] : []) : []);
  const [opened, setOpened] = useState<string | null>(shown && direction === EDITOR ? 'draft' : null);
  const [doc, setDoc] = useState<Draft | null>(shown && direction === EDITOR ? {id: 'draft', path: draftName('draft'), content: DRAFT, dirty: true, revision: 0} : null);
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(480);
  // The default view brings the draft block to the reader before anything else.
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => {
      const block = document.querySelector('[data-item="a2"] .mdp-reply > .ah-markdown-code');
      const target = direction === INPLACE ? block : block?.querySelector('.mdp-rail-group');
      target?.scrollIntoView({block: direction === INPLACE ? 'start' : 'center'});
    }, 350);
    return () => clearTimeout(t);
  }, []);
  const toggle = (id: string) => setRendered((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const open = (id: string) => {
    if (doc?.id !== id) setDoc({id, path: draftName(id), content: blockText(id), dirty: true, revision: (doc?.revision ?? 0) + 1});
    setOpened(id); setCollapsed(false);
  };
  const close = () => { setOpened(null); setDoc(null); };
  const title = 'Julkaisuohje';
  const st: BlockState = {rendered, opened, menuOpen: shown && direction === MENU ? 'draft' : null, toggle, open};
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={<NowSections yours={[]} running={[
        {agentId: 'pi:doc', title, href: '/workspaces/ws_p?conversation=pi:doc', activityLabel: 'Valmis', controlLabel: '', workspaceName: 'pyoraseura', detail: 'pyoraseura', selected: true},
        {agentId: 'pi:cal', title: 'Tapahtumakalenteri', href: '/workspaces/ws_p?conversation=pi:cal', activityLabel: 'Valmis', controlLabel: '', workspaceName: 'pyoraseura', detail: 'pyoraseura'},
      ]} />}>
      <WorkspaceNavRow name="pyoraseura" href="/workspaces/ws_p" selected />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  const conversation = (
    <div className="ah-state">
      <ConversationFrame>
        <AgentHeader title={title} workspaceLabel="pyoraseura" workspaceHref="/workspaces/ws_p"
          activityLabel="" activityAnimated={false} activityKind="neutral"
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{onSave: async () => {}}} />
        <ConversationStream>
          <ConversationTimeline state="ready" historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null}
            items={CONVO.map((i) => render(i, direction, st))} />
        </ConversationStream>
        <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
          onInterrupt={noop} sources={sources} csrf="prototype"
          modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
      </ConversationFrame>
    </div>
  );
  const main = direction === EDITOR || direction === MENU ? (
    <EditorSplit open={!!opened && !!doc} collapsed={collapsed} width={width} min={320} max={880}
      editor={doc ? <DraftEditor draft={doc} onChange={setDoc} onClose={close} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} /> : null}
      strip={{label: title, working: false, unread: false}}
      onResize={(w) => setWidth(Math.min(880, Math.max(320, w)))} onCollapse={setCollapsed}
      onReset={() => { setCollapsed(false); setWidth(480); }} onShowConversation={() => setCollapsed(false)}>
      {conversation}
    </EditorSplit>
  ) : conversation;
  return <AppShell mobileTitle={title} rail={rail} main={main} />;
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [start, setStart] = useState(reviewStart);
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
    <div className={`mdp-review variant-${direction}`} data-direction={direction}>
      <header className="mdp-bar" ref={bar}>
        <strong>Markdown-lohkon esikatselu · kierros 2</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Alku <select id="start" value={start} onChange={(e) => { reviewStart = e.target.value as 'open' | 'closed'; setStart(reviewStart); reset(); }}>
          <option value="open">Toiminto käytetty</option><option value="closed">Ennen painallusta</option></select></label>
        <button type="button" data-testid="mdp-reset" onClick={reset}>Alusta</button>
        <ol className="mdp-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="mdp-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_p?conversation=pi:doc']}>
          <Main key={`${direction}-${start}-${generation}`} direction={direction} start={start} />
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
