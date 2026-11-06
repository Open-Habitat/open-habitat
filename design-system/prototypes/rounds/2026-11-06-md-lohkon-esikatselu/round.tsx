import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
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
import {OutputBox} from '../../../../web/src/components/OutputBox';
import {EditorSplit} from '../../../../web/src/components/EditorSplit';
import {EditorHeaderActions} from '../../../../web/src/components/EditorHeader';
import {BrowserEditor} from '../../../../web/src/components/BrowserEditor';
import {ViewSplit} from '../../../../web/src/components/ViewPanel';
import {ControlButton, IconButton, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Button, TextField} from '../../../../web/src/components/Primitives';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-markdown-block-preview, round 1. A ```markdown fence in a reply is a
// production OutputBox today: "markdown · 34 riviä", the first three and last
// seven lines, copy and view controls. The axis is where the rendered block
// opens: in the workspace editor's own Markdown preview as an unsaved draft
// (A), in a read-only panel beside the conversation (B), or in place with a
// preview/source toggle as mermaid fences already are (C). Messages, rail,
// header, OutputBox, EditorSplit, BrowserEditor, ViewSplit and composer are
// the production components; the block's extra control, the panel's content,
// the in-place card and the save card are this round's. Synthetic content;
// nothing is written anywhere.
const directions = ['Nyt', 'A Editorissa', 'B Paneelissa', 'C Paikallaan'];
const LINES = [
  'Nyt: Markdown-lohko on koodilaatikko: kielimerkintä, rivimäärä, alku ja loppu, kopiointi ja näkymän valinta. Renderöityä näkymää ei ole.',
  'A Editorissa: lohkon Esikatselu avaa sen editorin Markdown-esikatseluun tallentamattomana luonnoksena keskustelun viereen (puhelimessa yläpuolelle); Tallenna vie sen työtilan tiedostoksi.',
  'B Paneelissa: lohkon Esikatselu avaa renderöidyn luonnoksen lukupaneeliin keskustelun viereen (puhelimessa koko näytölle); paneelista voi vain kopioida.',
  'C Paikallaan: lohko näkyy keskustelussa valmiiksi renderöitynä; Esikatselu | Lähde vaihtaa koodiin, ja pitkä luonnos avautuu Näytä kaikki -painikkeesta.',
];
const NOW = 0, A = 1, B = 2, C = 3;

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
const titleOf = (text: string) => /^# (.+)$/m.exec(text)?.[1] ?? 'Luonnos';
const lineCount = (text: string) => text.replace(/\n$/, '').split('\n').length;

const noop = () => {};
const copy = (text: string) => { void navigator.clipboard?.writeText(text).catch(noop); };
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [{path: 'README.md', git: 'modified'}], truncated: false}),
  workspaceName: 'pyoraseura',
};

/** The production fenced block: the figure MarkdownRenderer draws around OutputBox. */
function CodeFigure({text, extra}: {text: string; extra?: React.ReactNode}) {
  const figure = useRef<HTMLElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // The round's control sits in the box's own action rail, right under copy,
  // so it has the place and look of the controls already there.
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
  return (
    <figure className="ah-markdown-code" ref={figure}>
      <OutputBox text={text} language="markdown" copyLabel="Kopioi koodi" complete />
      {slot && extra ? createPortal(extra, slot) : null}
    </figure>
  );
}

/** A and B: one more control on the block, its state shown while open. */
function OpenControl({mode, opened, onOpen}: {mode: number; opened: boolean; onOpen: () => void}) {
  const label = mode === A ? (opened ? 'Esikatselu on auki editorissa' : 'Esikatselu editorissa') : (opened ? 'Esikatselu on auki paneelissa' : 'Esikatselu paneelissa');
  return (
    <IconButton size="inline" variant="quiet" data-testid="md-open" aria-label={label} title={label} aria-pressed={opened} onPress={onOpen}>
      <Icon name="eye" />
    </IconButton>
  );
}

/** C: the block drawn as its document, with the source one toggle away. */
function InPlace({text}: {text: string}) {
  const [view, setView] = useState<'preview' | 'source'>('preview');
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const long = lineCount(text) > 10;
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1200); return () => clearTimeout(t); }, [copied]);
  return (
    <figure className="ah-markdown-code mdp-inplace" data-testid="md-inplace" data-view={view}>
      <div className="mdp-inplace-head">
        <small className="mdp-meta">markdown{long ? ` · ${lineCount(text)} riviä` : ''}</small>
        <Segmented data-testid="md-view" label="Näkymä" size="inline" value={view} onChange={setView}
          options={[{id: 'preview', label: 'Esikatselu'}, {id: 'source', label: 'Lähde'}]} />
        {view === 'preview' ? (
          <IconButton size="inline" variant="quiet" data-testid="md-copy" aria-label={copied ? 'Koodi kopioitu' : 'Kopioi koodi'} title={copied ? 'Koodi kopioitu' : 'Kopioi koodi'} onPress={() => { copy(text); setCopied(true); }}>
            <Icon name={copied ? 'check' : 'copy'} />
          </IconButton>
        ) : null}
      </div>
      {view === 'source' ? (
        <OutputBox text={text} language="markdown" copyLabel="Kopioi koodi" complete />
      ) : (
        <div className={`mdp-doc${long && !all ? ' mdp-doc-clipped' : ''}`} data-testid="md-rendered">
          <Markdown text={text} />
          {long ? (
            <div className="mdp-doc-more">
              <ControlButton size="inline" variant="quiet" data-testid="md-all" onPress={() => setAll(!all)}>
                {all ? 'Näytä vähemmän' : `Näytä kaikki ${lineCount(text)} riviä`}
              </ControlButton>
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}

/** One history item through the production components. */
function render(item: Item, mode: number, opened: string | null, onOpen: (id: string) => void) {
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
    content = (
      <AssistantMessage streamState="complete" time={item.time} onCopy={noop}>
        {mode === NOW ? <Markdown text={sourceOf(segs)} /> : (
          <div className="mdp-reply">
            {segs.map((s, i) => s.kind === 'prose' ? <Markdown key={i} text={s.text} />
              : mode === C ? <InPlace key={i} text={s.text} />
              : <CodeFigure key={i} text={s.text} extra={<OpenControl mode={mode} opened={opened === s.id} onOpen={() => onOpen(s.id)} />} />)}
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

type Draft = {id: string; path: string; content: string; saved?: string; dirty: boolean; revision: number};

/** A: the editor's save asks where the draft goes in the workspace. */
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

/** A: the production browser editor with the block as an unsaved draft. */
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
        notice={draft.saved ? `Tallennettu tiedostoon ${draft.saved}.` : 'Luonnos agentin vastauksesta klo 10.42 · ei vielä työtilassa'}
        onChange={(content) => onChange({...draft, content, dirty: true})}
        onSave={() => setSaving(true)} onReload={noop} onImportNow={noop} onUndoImport={noop} onReimport={noop}
        toolbarActions={<EditorHeaderActions collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} onClose={onClose} />}
      />
      {saving ? <SaveCard draft={draft} onCancel={() => setSaving(false)} onSave={(path) => { setSaving(false); onChange({...draft, saved: path, dirty: false, revision: draft.revision + 1}); }} /> : null}
    </div>
  );
}

/** B: the rendered block in a reading panel beside the conversation. */
function ReadPanel({id, expanded, onExpand, onClose}: {id: string; expanded: boolean; onExpand: () => void; onClose: () => void}) {
  const text = blockText(id);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1200); return () => clearTimeout(t); }, [copied]);
  return (
    <section className="ah-view-pane mdp-panel" data-testid="md-panel" aria-label={`Esikatselu: ${titleOf(text)}`}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <header className="ah-editor-header">
        <h2 className="ah-view-title">{titleOf(text)}</h2>
        <span className="ah-editor-controls">
          <ControlButton data-testid="md-panel-copy" size="row" variant="quiet" aria-label={copied ? 'Koodi kopioitu' : 'Kopioi Markdown'} title={copied ? 'Koodi kopioitu' : 'Kopioi Markdown'} onPress={() => { copy(text); setCopied(true); }}>
            <Icon name={copied ? 'check' : 'copy'} />
          </ControlButton>
          <ControlButton data-testid="md-panel-expand" size="row" variant="quiet" aria-pressed={expanded} aria-label={expanded ? 'Palauta keskustelu viereen' : 'Laajenna'} title={expanded ? 'Palauta keskustelu viereen' : 'Laajenna'} onPress={onExpand}>
            <Icon name={expanded ? 'forward' : 'back'} />
          </ControlButton>
          <ControlButton data-testid="md-panel-close" size="row" variant="quiet" aria-label="Sulje" title="Sulje" onPress={onClose}>
            <Icon name="cross" />
          </ControlButton>
        </span>
      </header>
      <p className="mdp-panel-from">Agentin vastauksesta klo {id === 'readme' ? '10.32' : '10.42'} · markdown · {lineCount(text)} riviä</p>
      <div className="mdp-panel-doc" tabIndex={0}>
        <Markdown text={text} />
      </div>
    </section>
  );
}

let reviewTheme = 'light';
let reviewStart: 'open' | 'closed' = 'open';
function Main({direction, start}: {direction: number; start: 'open' | 'closed'}) {
  const [draft, setDraft] = useState('');
  const initial = start === 'open' && (direction === A || direction === B) ? 'draft' : null;
  const [opened, setOpened] = useState<string | null>(initial);
  const [doc, setDoc] = useState<Draft | null>(initial && direction === A ? {id: 'draft', path: draftName('draft'), content: DRAFT, dirty: true, revision: 0} : null);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(440);
  const open = (id: string) => {
    if (direction === A && doc?.id !== id) setDoc({id, path: draftName(id), content: blockText(id), dirty: true, revision: (doc?.revision ?? 0) + 1});
    setOpened(id); setCollapsed(false); setExpanded(false);
  };
  const close = () => { setOpened(null); setDoc(null); setExpanded(false); };
  const title = 'Julkaisuohje';
  const editorShown = direction === A && !!opened && !!doc;
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
            items={CONVO.map((i) => render(i, direction, opened, open))} />
        </ConversationStream>
        <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
          onInterrupt={noop} sources={sources} csrf="prototype"
          modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
      </ConversationFrame>
    </div>
  );
  let main: React.ReactNode = conversation;
  if (direction === A) {
    main = (
      <EditorSplit open={editorShown} collapsed={collapsed} width={width} min={320} max={880}
        editor={doc ? <DraftEditor draft={doc} onChange={setDoc} onClose={close} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} /> : null}
        strip={{label: title, working: false, unread: false}}
        onResize={(w) => setWidth(Math.min(880, Math.max(320, w)))} onCollapse={setCollapsed}
        onReset={() => { setCollapsed(false); setWidth(440); }} onShowConversation={() => setCollapsed(false)}>
        {conversation}
      </EditorSplit>
    );
  } else if (direction === B) {
    main = (
      <ViewSplit open={!!opened} expanded={expanded} width={width + 120} min={360} max={760}
        panel={opened ? <ReadPanel id={opened} expanded={expanded} onExpand={() => setExpanded(!expanded)} onClose={close} /> : null}
        onResize={(w) => setWidth(Math.min(640, Math.max(240, w - 120)))} onReset={() => setWidth(440)} onShowConversation={() => setExpanded(false)}>
        {conversation}
      </ViewSplit>
    );
  }
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
        <strong>Markdown-lohkon esikatselu</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Alku <select id="start" value={start} onChange={(e) => { reviewStart = e.target.value as 'open' | 'closed'; setStart(reviewStart); reset(); }}>
          <option value="open">Esikatselu auki</option><option value="closed">Keskustelu</option></select></label>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
