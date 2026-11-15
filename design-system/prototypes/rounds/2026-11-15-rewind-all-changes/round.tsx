import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/Rewind.css';
import {AppShell, AgentHeader, NowSections, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFloatingAction, ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {Button, Checkbox} from '../../../../web/src/components/Primitives';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

setPersonalLanguage('fi');

// rewind-tracks-all-changes. With a snapshot of the workspace at each turn's
// start and end, Palaa tähän can restore what commands changed, not only the
// edit and write tools' files. The sheet is production's (Rewind.tsx, C Pieni
// arkki); this round riffs on one thing: how much the Tiedostot choice puts
// back and who decides. Shell, messages, header, checkbox, buttons and
// composer are production components and the sheet uses production's own
// classes; the file list's tags, the "stays" lines and the third choice are
// this round's. Everything is synthetic; nothing is sent or restored.
const directions = ['A Kaikki takaisin', 'B Agentin vuorot', 'C Valitse itse'];
const LINES = [
  'A Kaikki takaisin: työtila palaa kokonaan viestiä edeltävään tilaan, myös tiedostot, joita vain sinä muutit vuorojen välissä.',
  'B Agentin vuorot: palautuvat tiedostot, jotka muuttuivat agentin vuorojen aikana (muokkaus tai komento). Vain vuorojen välissä muuttuneet jäävät ja ne nimetään.',
  'C Valitse itse: kuten B, ja kolmas valinta ottaa vuorojen välissä muuttuneet mukaan.',
];
const A = 0, C = 2;

type Tool = {name: string; path: string; stat: string};
type Item = {id: string; kind: 'user' | 'assistant' | 'tools'; text?: string; time: string; tools?: Tool[]};
const CONVO: Item[] = [
  {id: 'u1', kind: 'user', time: '9.12', text: 'Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat.'},
  {id: 'a1', kind: 'assistant', time: '9.14', text: 'Ajoin testit: 41 läpi, 2 epäonnistui. Kesäajan tunti puuttuu laskusta.'},
  {id: 'u2', kind: 'user', time: '9.20', text: 'Korjaa kesäaika lisäämällä tunti kaikkiin maaliskuun laskuihin.'},
  {id: 't2', kind: 'tools', time: '9.22', tools: [
    {name: 'edit', path: 'src/shadow.py', stat: '+6 −2'},
    {name: 'edit', path: 'src/timezones.py', stat: '+3 −0'},
    {name: 'bash', path: 'ruff format src/', stat: ''},
  ]},
  {id: 'a2', kind: 'assistant', time: '9.26', text: 'Lisäsin maaliskuun laskuihin tunnin ja muotoilin lähdekoodin.'},
  {id: 'u3', kind: 'user', time: '9.41', text: 'Korjaa myös lokakuu samalla tavalla ja päivitä taulukko.'},
  {id: 't3', kind: 'tools', time: '9.43', tools: [
    {name: 'edit', path: 'src/shadow.py', stat: '+4 −1'},
    {name: 'write', path: 'tests/test_shadow.py', stat: '+12 −0'},
    {name: 'bash', path: 'python scripts/taulukko.py', stat: ''},
    {name: 'bash', path: 'rm docs/vanha-taulukko.md', stat: ''},
    {name: 'bash', path: 'git commit -am "Kesäaika"', stat: ''},
  ]},
  {id: 'a3', kind: 'assistant', time: '9.45', text: 'Molemmat testit menevät läpi, `data/kesaaika.csv` on päivitetty ja vanha taulukko poistettu. Commitoin muutokset.'},
];
const TARGET = 'u2';

// What changed in the workspace since the chosen message. `by` is how the
// snapshots place a change: an edit tool, inside a turn by something else (a
// command), or only between turns (the person or another program).
type By = 'edit' | 'command' | 'between';
type F = {path: string; by: By; change?: 'uusi' | 'poistettu'; stat?: string};
const FILES: F[] = [
  {path: 'src/shadow.py', by: 'edit', stat: '+10 −3'},
  {path: 'src/timezones.py', by: 'edit', stat: '+3 −0'},
  {path: 'tests/test_shadow.py', by: 'edit', change: 'uusi', stat: '+12 −0'},
  {path: 'src/clock.py', by: 'command', stat: '+8 −8'},
  {path: 'data/kesaaika.csv', by: 'command', stat: '+24 −24'},
  {path: 'docs/vanha-taulukko.md', by: 'command', change: 'poistettu', stat: '+0 −31'},
  {path: 'README.md', by: 'between', stat: '+2 −0'},
  {path: 'muistiinpanot.txt', by: 'between', change: 'uusi', stat: '+5 −0'},
];
const tiedostoa = (n: number) => (n === 1 ? '1 tiedosto' : `${n} tiedostoa`);
type Case = 'normal' | 'branch' | 'none';
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'aurinkokello',
};

function Sheet({mode, situation, onCancel, onGo}: {mode: number; situation: Case; onCancel: () => void; onGo: (n: number | null) => void}) {
  const [conv, setConv] = useState(true);
  const [files, setFiles] = useState(situation !== 'branch');
  const [between, setBetween] = useState(false);
  const [open, setOpen] = useState(false);
  // Without a snapshot only the edit tools' copies exist, as today.
  const known = situation === 'none' ? FILES.filter((f) => f.by === 'edit') : FILES;
  const agent = known.filter((f) => f.by !== 'between');
  const others = known.filter((f) => f.by === 'between');
  const all = mode === A || (mode === C && between);
  const going = all ? known : agent;
  const staying = all ? [] : others;
  const what = conv && files ? 'both' : files ? 'files' : conv ? 'conversation' : 'none';
  const go = what === 'files' ? 'Palauta tiedostot' : what === 'both' ? 'Palaa ja palauta' : 'Palaa tähän';
  return (
    <ConversationFloatingAction>
      <section className="ah-rewind-sheet" role="dialog" aria-label="Palaa tähän" data-testid="rewind-sheet" data-what={what}>
        <header className="ah-rewind-head">
          <h2>Palaa ennen viestiäsi klo 9.20</h2>
          <Button data-testid="rewind-close" label="Sulje" ariaLabel="Sulje" icon="cross" variant="quiet" size="row" onPress={onCancel} />
        </header>
        <div className="ah-rewind-toggles">
          <Checkbox data-testid="rewind-conversation" label="Keskustelu" hint={conv ? '2 viestiäsi ja 2 vastausta sivuun' : 'Jatkuu ennallaan'} checked={conv} onChange={setConv} />
          <Checkbox data-testid="rewind-files" label="Tiedostot" checked={files} onChange={setFiles}
            hint={files ? `${tiedostoa(going.length)} palautuu` : situation === 'branch' ? 'Haara on vaihtunut; katso alla' : `${tiedostoa(going.length)} jää ennalleen`} />
          {mode === C && situation !== 'none' && files ? (
            <Checkbox data-testid="rewind-between" label="Myös vuorojen välissä muuttuneet" hint={`${tiedostoa(others.length)}, ei agentin muuttamia`} checked={between} onChange={setBetween} />
          ) : null}
        </div>
        <div className="ah-rewind-foot">
          <div className="ah-rewind-notes">
            {situation === 'branch' ? (
              <p className="ah-rewind-meta rac-strong" data-testid="branch-note">Agentti vaihtoi haaran main → korjaus/kesaaika. Tiedostojen palautus toisi haaran main tiedostot tämän haaran päälle.</p>
            ) : null}
            {files ? (
              <p className="ah-rewind-meta" data-testid="restore-warning">
                {all && situation !== 'none'
                  ? 'Työtilan kaikki myöhemmät muutokset korvataan, myös omasi. Nykyinen sisältö tallennetaan ensin, jotta voit perua palautuksen.'
                  : 'Näiden tiedostojen kaikki myöhemmät muutokset korvataan, myös omasi. Nykyinen sisältö tallennetaan ensin, jotta voit perua palautuksen.'}
              </p>
            ) : null}
            {files && staying.length ? (
              <p className="ah-rewind-meta" data-testid="staying">{tiedostoa(staying.length)} muutettu vain vuorojen välissä; {staying.length === 1 ? 'se jää' : 'ne jäävät'} ennalleen.</p>
            ) : null}
            {files ? (
              <p className="ah-rewind-meta" data-testid="not-restored">
                {situation === 'none'
                  ? 'Tästä viestistä on vain muokkaustyökalujen kopiot: komennoilla muutetut tiedostot jäävät ennalleen.'
                  : 'Ei palaudu: agentin 1 commit, ohitetut tiedostot (esim. build, .venv) ja työtilan ulkopuoliset muutokset.'}
              </p>
            ) : null}
            <p className="ah-rewind-meta">
              <button type="button" className="ah-rewind-link" data-testid="rewind-files-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Piilota tiedostot' : 'Näytä tiedostot'}</button>
            </p>
            {open ? (
              <ul className="ah-rewind-files" data-testid="rewind-file-list">
                {going.map((f) => (
                  <li key={f.path} data-by={f.by}>
                    <code>{f.path}</code>
                    <span className="ah-rewind-stat">
                      {f.by === 'command' ? <span className="rac-tag">komento</span> : null}
                      {f.by === 'between' ? <span className="rac-tag">vuorojen välissä</span> : null}
                      {f.change ? `${f.change} ` : null}{f.stat}
                    </span>
                  </li>
                ))}
                {files ? staying.map((f) => (
                  <li key={f.path} className="ah-rewind-quiet" data-by="between">
                    <code>{f.path}</code>
                    <span className="ah-rewind-stat"><span className="rac-tag">vuorojen välissä</span>jää</span>
                  </li>
                )) : null}
                {situation === 'none' && files ? ['ruff format src/', 'python scripts/taulukko.py', 'rm docs/vanha-taulukko.md'].map((c) => (
                  <li key={c} className="ah-rewind-quiet"><code>{c}</code><span className="ah-rewind-stat">jää</span></li>
                )) : null}
              </ul>
            ) : null}
          </div>
          <div className="ah-rewind-actions">
            <Button data-testid="rewind-cancel" label="Peru" variant="quiet" size="row" onPress={onCancel} />
            <Button data-testid="rewind-go" label={go} variant="primary" size="row" onPress={() => onGo(files ? going.length : null)}
              availability={what === 'none' ? {state: 'disabled', reason: 'Valitse ainakin toinen'} : undefined} />
          </div>
        </div>
      </section>
    </ConversationFloatingAction>
  );
}

function render(item: Item, dim: boolean) {
  let content: React.ReactNode;
  if (item.kind === 'user') content = <UserMessage sourceText={item.text!} onCopy={noop} time={item.time}><Markdown text={item.text!} /></UserMessage>;
  else if (item.kind === 'assistant') content = <AssistantMessage streamState="complete" time={item.time} onCopy={noop}><Markdown text={item.text!} /></AssistantMessage>;
  else content = (
    <div className="rac-tools">
      {item.tools!.map((t, i) => <ToolRow key={i} name={t.name} targetText={t.path} stat={t.stat || undefined} statusLabel="Valmis" state="succeeded" expanded={false} onToggle={noop} />)}
    </div>
  );
  return {id: item.id, kind: item.kind, content: <div className="rac-msg" data-left={dim || undefined} data-item={item.id}>{content}</div>};
}

function Stream({mode, situation, setDraft}: {mode: number; situation: Case; setDraft: (t: string) => void}) {
  const [state, setState] = useState<'choose' | 'closed' | {restored: number | null}>('choose');
  const at = CONVO.findIndex((i) => i.id === TARGET);
  useEffect(() => {
    if (state === 'choose') document.querySelector(`[data-item="${TARGET}"]`)?.scrollIntoView({block: 'start'});
  }, [state]);
  let items: {id: string; kind: string; content: React.ReactNode}[];
  if (typeof state === 'object') {
    items = [...CONVO.slice(0, at).map((i) => render(i, false)), {id: 'marker', kind: 'marker', content: (
      <section className="rac-branch" data-testid="branch-marker" aria-label="Aiempi jatko">
        <Icon name="branch" />
        <span><strong>Aiempi jatko</strong> · 2 viestiäsi ja 2 vastausta{state.restored === null ? ' · tiedostot jäivät' : ` · ${tiedostoa(state.restored)} palautettu`}</span>
      </section>
    )}];
  } else {
    items = CONVO.map((i, n) => render(i, state === 'choose' && n >= at));
    if (state === 'choose') items.push({id: 'sheet', kind: 'sheet', content: (
      <Sheet mode={mode} situation={situation} onCancel={() => setState('closed')}
        onGo={(n) => { setState({restored: n}); setDraft(CONVO[at].text!); }} />
    )});
  }
  return <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />;
}

let reviewTheme = 'light';
let reviewCase: Case = 'normal';

function Main({direction, situation, generation}: {direction: number; situation: Case; generation: number}) {
  const [draft, setDraft] = useState('');
  const title = 'Kesäajan virhe';
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={<NowSections yours={[]} running={[
        {agentId: 'pi:orig', title, href: '/workspaces/ws_a?conversation=pi:orig', activityLabel: 'Valmis', controlLabel: '', workspaceName: 'aurinkokello', detail: 'aurinkokello', selected: true},
      ]} />}>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" selected />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
    </WorkspaceRail>
  );
  return (
    <AppShell mobileTitle={title} rail={rail} main={
      <div className="ah-state">
        <ConversationFrame>
          <AgentHeader title={title} workspaceLabel="aurinkokello" workspaceHref="/workspaces/ws_a"
            activityLabel="" activityAnimated={false} activityKind="neutral"
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{onSave: async () => {}}} />
          <ConversationStream>
            <Stream key={generation} mode={direction} situation={situation} setDraft={setDraft} />
          </ConversationStream>
          <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
            onInterrupt={noop} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
        </ConversationFrame>
      </div>
    } />
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [situation, setSituation] = useState<Case>(reviewCase);
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
    <div className={`rac-review variant-${direction}`} data-direction={direction}>
      <header className="rac-bar" ref={bar}>
        <strong>Palaa tähän · kaikki muutokset</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Tilanne <select id="case" value={situation} onChange={(e) => { reviewCase = e.target.value as Case; setSituation(reviewCase); reset(); }}>
          <option value="normal">Tilannekuva on</option><option value="branch">Agentti vaihtoi haaraa</option><option value="none">Ei tilannekuvaa (vanha viesti)</option></select></label>
        <button type="button" data-testid="rac-reset" onClick={reset}>Alusta</button>
        <ol className="rac-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rac-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_a?conversation=pi:orig']}>
          <Main direction={direction} situation={situation} generation={generation} />
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
