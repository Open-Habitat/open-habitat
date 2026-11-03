import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, AgentHeader, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {COMMANDS, FILES, WORKSPACE, previewOf} from './data';
import {InfieldComposer, type Load} from './infield';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-composer-popover-placement, round 2. Jari chose Kentän sisällä
// (3.11.): the list opens inside the field box, between the text and the
// button row. This round riffs how that list works when it keeps everything
// today's caret list, button lists and Ctrl/⌘+P palette do (search, folders,
// keys, several files, what is inserted, empty and loading states), with no
// dialog in between. The axis is how that whole set is laid out in the field.
// Nyt is the production Composer unchanged, palette included.
const directions = ['Nyt', 'Hakulista', 'Kansiopuu', 'Välilehdet'];
const LINES = [
  'Nyt: lista avautuu kentän yläpuolelle; useamman tiedoston valinta, muutetut ja esikatselu ovat vain Ctrl/⌘+P-valitsimessa koko näkymän päällä.',
  'Hakulista: yksi sarake kuten nyt, mutta kentän sisällä; kansiot tulevat hakuun riveinä ja rajaavat haun, ympyrä merkitsee useamman, Muutetut on siru.',
  'Kansiopuu: lista selaa kansioita polkurivillä (aurinkokello › src); Muutetut on ensimmäinen kansio, valintaruutu joka rivillä, haku koko kansiosta.',
  'Välilehdet: Ctrl/⌘+P-valitsin siirtyy kenttään: Tiedostot · Muutetut · Komennot ja esikatselu listan vieressä.',
];

const SHORT = 'Tee tästä lyhyt yhteenveto ja ';
const TALL = `Katsoin eilisen ajon lokit. Kolme asiaa:

1. Varjon kulma lasketaan väärin kesäajan vaihtuessa; tunti heittää maaliskuun lopussa.
2. Testit eivät kata eteläistä pallonpuoliskoa lainkaan.
3. README:n asennusohje viittaa vanhaan Python-versioon.

Korjaa ensin kesäaika ja lisää sille testi. Kerro sitten, miten testit kannattaisi laajentaa etelään, ennen kuin teet mitään muuta.

Katso myös `;
const SHELL = '!pytest -q ';
type Draft = 'tall' | 'short' | 'shell';
const DRAFTS: Record<Draft, string> = {tall: TALL, short: SHORT, shell: SHELL};

const noop = () => {};
const wait = (load: Load, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const id = setTimeout(() => (load === 'failed' ? reject(new Error('failed')) : resolve()), load === 'slow' ? 1600 : 60);
  signal.addEventListener('abort', () => { clearTimeout(id); reject(new Error('aborted')); });
});
/** The production composer's sources over the same synthetic workspace. */
const sourcesFor = (load: Load): ComposerSources => ({
  commands: async (signal) => { await wait(load, signal); return {answered_by: 'running', commands: COMMANDS}; },
  files: async (query, signal) => {
    await wait(load, signal);
    const terms = query.split(/\s+/).filter(Boolean);
    const files = FILES.filter((f) => terms.every((t) => {
      let at = 0;
      for (const ch of t.toLowerCase()) { const j = f.path.toLowerCase().indexOf(ch, at); if (j < 0) return false; at = j + 1; }
      return true;
    }));
    return {files, truncated: false};
  },
  preview: async (path, signal) => {
    await wait(load, signal);
    const p = previewOf(path);
    return {path, kind: p.kind === 'dir' ? 'text' : p.kind, text: p.text, truncated: false};
  },
  workspaceName: WORKSPACE,
});

let reviewTheme = 'light';
let reviewDraft: Draft = 'tall';
let reviewLoad: Load = 'ready';

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [length, setLength] = useState<Draft>(reviewDraft);
  const [load, setLoad] = useState<Load>(reviewLoad);
  const [draft, setDraft] = useState(DRAFTS[reviewDraft]);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
  const sources = useMemo(() => sourcesFor(load), [load]);
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
  // Nyt's default view: Tiedosto opened from its button, the caret at the end.
  useEffect(() => {
    if (direction !== 0) return;
    const id = setTimeout(() => {
      const field = document.querySelector<HTMLTextAreaElement>('.ah-cbox-field');
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
      field.scrollTop = field.scrollHeight;
      field.blur();
      document.querySelector<HTMLButtonElement>('[data-testid="file-picker"]')?.click();
    }, 80);
    return () => clearTimeout(id);
  }, [generation, direction]);
  const reset = (to = length, l = load) => {
    reviewDraft = to; reviewLoad = l;
    setLength(to); setLoad(l);
    setDraft(DRAFTS[to]);
    setGeneration((g) => g + 1);
  };

  const items = [
    {id: 'u1', kind: 'user', content: (
      <UserMessage sourceText="Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat." onCopy={noop} time="9.12">
        <Markdown text="Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat." />
      </UserMessage>
    )},
    {id: 'a1', kind: 'assistant', content: (
      <AssistantMessage streamState="complete" time="9.14" onCopy={noop}>
        <Markdown text={'Ajoin testit: 41 läpi, 2 epäonnistui.\n\n- `test_dst_march` odottaa varjon kulmaksi 41,2°, mutta saa 26,2°: kesäajan tunti puuttuu laskusta.\n- `test_readme_example` epäonnistuu, koska esimerkki käyttää poistettua funktiota.\n\nLokit ovat tiedostossa `notes/2026-11-02-ajo.md`.'} />
      </AssistantMessage>
    )},
  ];

  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="4 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" selected />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
      <WorkspaceNavRow name="reseptikirja" href="/workspaces/ws_r" />
    </WorkspaceRail>
  );
  const model = <button type="button" className="md-pill">Agentin oletus · medium</button>;

  return (
    <div className={`cl-review variant-${direction}`} data-direction={direction}>
      <header className="cl-bar" ref={bar}>
        <strong>Kentän listat 2</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Luonnos <select id="draft" value={length} onChange={(e) => reset(e.target.value as Draft)}>
          <option value="tall">Pitkä</option><option value="short">Lyhyt</option><option value="shell">Komento !</option></select></label>
        <label>Lista <select id="load" value={load} onChange={(e) => reset(length, e.target.value as Load)}>
          <option value="ready">Valmis</option><option value="slow">Hidas haku</option><option value="failed">Ei saatu</option></select></label>
        <button type="button" data-testid="cl-reset" onClick={() => reset()}>Alusta</button>
        <ol className="cl-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} value={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="cl-stage">
        <MemoryRouter initialEntries={['/workspaces/ws_a?conversation=pi:c1']}>
          <AppShell mobileTitle="Kesäajan virhe" rail={rail} main={
            <div className="ah-state">
              <ConversationFrame>
                <AgentHeader title="Kesäajan virhe" workspaceLabel={WORKSPACE} workspaceHref="/workspaces/ws_a"
                  activityLabel="" activityAnimated={false} activityKind="neutral"
                  controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
                <ConversationStream>
                  <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
                </ConversationStream>
                {direction === 0 ? (
                  <Composer key={generation} value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
                    onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} sources={sources} csrf="prototype"
                    shell={{workspaceLabel: `~/src/${WORKSPACE}`, onRun: noop, onStop: noop}}
                    modelPicker={model} />
                ) : (
                  <InfieldComposer key={generation} dir={direction} value={draft} onChange={setDraft} load={load}
                    modelPicker={model} autoOpen="file" />
                )}
              </ConversationFrame>
            </div>
          } />
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
  button.className = 'proto-picker-item'; button.textContent = n;
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
