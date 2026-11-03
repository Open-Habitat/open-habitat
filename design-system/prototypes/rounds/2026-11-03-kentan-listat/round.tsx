import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
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
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-composer-popover-placement. Today the Komennot (/) and Tiedosto (@)
// lists open above the whole field box (composer.css: .ah-choice-pop,
// bottom: calc(100% + 6px)). With a tall draft the button at the bottom of the
// box and the list above its top are far apart (Jari 3.11.). Liitä opens the
// system file picker directly and has no list. The axis is where a list
// opens relative to its button and the text. Every direction is the
// production Composer unchanged in behaviour (keys, Esc, focus, insertion);
// a direction changes only where the list sits, through round.css and the
// placement effect below. The conversation and the lists are synthetic.
const directions = ['Nyt', 'Napin luona', 'Kentän sisällä', 'Napit ylhäällä'];
const LINES = [
  'Nyt: lista avautuu koko kentän yläpuolelle; pitkällä luonnoksella nappi ja lista ovat kaukana toisistaan.',
  'Napin luona: lista avautuu heti napin yläpuolelle kentän päälle ja peittää tekstin alaosan; Esc palaa tekstiin.',
  'Kentän sisällä: lista avautuu kentän sisään tekstin ja nappirivin väliin; teksti tiivistyy kursorin riveiksi, mitään ei peity.',
  'Napit ylhäällä: Komennot ja Tiedosto ovat kentän yläreunassa, joten lista avautuu niiden viereen; Lähetä jää alas oikealle.',
];
const NOW = 0, AT_BUTTON = 1, INSIDE = 2, TOP = 3;

const SHORT = 'Tee tästä lyhyt yhteenveto ja ';
const TALL = `Katsoin eilisen ajon lokit. Kolme asiaa:

1. Varjon kulma lasketaan väärin kesäajan vaihtuessa; tunti heittää maaliskuun lopussa.
2. Testit eivät kata eteläistä pallonpuoliskoa lainkaan.
3. README:n asennusohje viittaa vanhaan Python-versioon.

Korjaa ensin kesäaika ja lisää sille testi. Kerro sitten, miten testit kannattaisi laajentaa etelään, ennen kuin teet mitään muuta.

Katso myös `;

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: [
    {name: 'skill:git-commit', description: 'Stage and commit working-tree changes as well-formed commits.', source: 'skill', scope: 'user', terminal_only: false},
    {name: 'skill:llm-review', description: 'Evidence-gated review of code, a diff, a plan or a document.', source: 'skill', scope: 'user', terminal_only: false},
    {name: 'skill:test-guide', description: 'Which tests to run and what each result proves.', source: 'skill', scope: 'project', terminal_only: false},
    {name: 'review', description: 'Review the working-tree diff before committing', source: 'prompt', scope: 'user', terminal_only: false},
    {name: 'changelog', description: 'Draft a changelog entry from recent commits', source: 'prompt', scope: 'project', terminal_only: false},
    {name: 'compact', description: 'Tiivistä keskustelu ja jatka', source: 'extension', scope: 'builtin', terminal_only: false},
    {name: 'mcp', description: 'Manage MCP servers', source: 'extension', scope: 'builtin', terminal_only: true},
  ]}),
  files: async () => ({files: [
    {path: 'src/shadow.py', git: 'modified'},
    {path: 'tests/test_shadow.py', git: 'modified'},
    {path: 'notes/2026-11-02-ajo.md', git: 'untracked'},
    {path: 'README.md'},
    {path: 'pyproject.toml'},
    {path: 'src/sun.py'},
    {path: 'src/timezones.py'},
    {path: 'tests/test_sun.py'},
  ], truncated: false}),
  workspaceName: 'aurinkokello',
};

/** The caret's line top within the field box, as the field shows it now. */
function caretTop(field: HTMLTextAreaElement, pos: number) {
  const style = getComputedStyle(field);
  const mirror = document.createElement('div');
  for (const k of ['font', 'letterSpacing', 'padding', 'border', 'boxSizing', 'lineHeight'] as const) mirror.style[k] = style[k];
  Object.assign(mirror.style, {position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
    width: `${field.clientWidth}px`, top: '0', left: '0'});
  mirror.textContent = field.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = '\u200b';
  mirror.appendChild(mark);
  field.parentElement?.appendChild(mirror);
  const y = mark.offsetTop;
  mirror.remove();
  return {inField: y, inBox: field.offsetTop + y - field.scrollTop, line: parseFloat(style.lineHeight) || 22};
}

/** The direction's placement: production places the list itself; this only
 * moves it. Runs every frame while the page is open, writing only changes. */
function usePlacement(direction: number) {
  useEffect(() => {
    let raf = 0, was = false, last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const box = document.querySelector<HTMLElement>('.ah-cbox');
      const field = box?.querySelector<HTMLTextAreaElement>('.ah-cbox-field');
      const pop = box?.querySelector<HTMLElement>('.ah-choice-pop');
      if (!box || !field) return;
      const fromButton = !!pop?.querySelector('.ah-choice-search');
      box.dataset.list = pop ? (fromButton ? 'button' : 'caret') : '';
      const caret = field.selectionStart;
      if (direction === AT_BUTTON && pop) {
        const row = box.querySelector<HTMLElement>('.ah-crow')!;
        const bottom = fromButton ? row.offsetHeight + 2 : box.clientHeight - caretTop(field, caret).inBox + 2;
        const value = `${Math.round(bottom)}px`;
        if (value !== last) { box.style.setProperty('--pop-bottom', value); last = value; }
      }
      // Inside: the text shrinks to the caret's lines while a list is open.
      if (direction === INSIDE && pop && !was) {
        requestAnimationFrame(() => {
          const c = caretTop(field, caret);
          field.scrollTop = Math.max(0, c.inField - c.line - parseFloat(getComputedStyle(field).paddingTop));
        });
      }
      if (direction === INSIDE && !pop && was) {
        const c = caretTop(field, caret);
        field.scrollTop = Math.max(0, c.inField - field.clientHeight + 2 * c.line);
      }
      was = !!pop;
    };
    raf = requestAnimationFrame(tick);
    // Over the text a button's list is a popover: a press in the text closes
    // it and returns there, as Esc does.
    const down = (e: MouseEvent) => {
      if (direction !== AT_BUTTON) return;
      const t = e.target as HTMLElement;
      if (!t.closest?.('.ah-cbox-field')) return;
      const search = document.querySelector<HTMLInputElement>('.ah-choice-pop .ah-choice-search-input');
      search?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    };
    document.addEventListener('mousedown', down, true);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('mousedown', down, true); };
  }, [direction]);
}

let reviewTheme = 'light';
let reviewDraft: 'short' | 'tall' = 'tall';

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [length, setLength] = useState(reviewDraft);
  const [draft, setDraft] = useState(reviewDraft === 'tall' ? TALL : SHORT);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
  usePlacement(direction);
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
  // The default view: the caret at the end of the draft, the field scrolled
  // to it, and Komennot opened from its button.
  useEffect(() => {
    const id = setTimeout(() => {
      const field = document.querySelector<HTMLTextAreaElement>('.ah-cbox-field');
      if (!field) return;
      field.setSelectionRange(field.value.length, field.value.length);
      field.scrollTop = field.scrollHeight;
      document.querySelector<HTMLButtonElement>('[data-testid="command-palette"]')?.click();
    }, 80);
    return () => clearTimeout(id);
  }, [generation]);
  const reset = (to = length) => {
    reviewDraft = to; setLength(to);
    setDraft(to === 'tall' ? TALL : SHORT);
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

  return (
    <div className={`cl-review variant-${direction}`} data-direction={direction}>
      <header className="cl-bar" ref={bar}>
        <strong>Kentän listat</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Luonnos <select id="draft" value={length} onChange={(e) => reset(e.target.value as 'short' | 'tall')}>
          <option value="tall">Pitkä</option><option value="short">Lyhyt</option></select></label>
        <button type="button" data-testid="cl-reset" onClick={() => reset()}>Alusta</button>
        <ol className="cl-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="cl-stage">
        <MemoryRouter initialEntries={['/workspaces/ws_a?conversation=pi:c1']}>
          <AppShell mobileTitle="Kesäajan virhe" rail={rail} main={
            <div className="ah-state">
              <ConversationFrame>
                <AgentHeader title="Kesäajan virhe" workspaceLabel="aurinkokello" workspaceHref="/workspaces/ws_a"
                  activityLabel="" activityAnimated={false} activityKind="neutral"
                  controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
                <ConversationStream>
                  <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
                </ConversationStream>
                <Composer key={generation} value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
                  onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} sources={sources} csrf="prototype"
                  modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
