import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import skillSource from '../../../../internal/daemon/start-page-skill/SKILL.md?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {SkillInvocation} from '../../../../web/src/components/SkillInvocation';
import {StartHere} from '../../../../web/src/components/StartHere';
import {WorkspaceIntro} from '../../../../web/src/components/WorkspaceIntro';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-start-page-request-presentation. One flow seen as three screens side
// by side: (a) where the request starts, (b) what pressing does, (c) how the
// sent request reads in the history. Two starting points: the workspace page's
// Luo/Päivitä aloitussivu, and the empty new conversation's button (Jari 3.11.:
// it starts at once). "Nyt" is today's behaviour: the workspace page inserts
// the bare text `/open-habitat-start-page `, which Pi does not expand (only
// `/skill:<name>` is a skill call), so the model receives it as an ordinary
// message and the history shows that text. The directions differ in (b) for
// the workspace page and in (c) for both. Built from production components;
// workspace, times and the agent's reply are synthetic.
const directions = ['Nyt', 'Siru', 'Heti, ohje', 'Heti, nimi'];
const LINES = [
  'Nyt: työtilan sivun painike kirjoittaa kenttään komennon, ja historiaan jää sama komento tavallisena viestinä; tyhjässä keskustelussa on vain kehotus.',
  'Siru: työtilan sivun painike vie kenttään sirun Luo aloitussivu ja lähetät itse; historiassa nimi, ja ohje on taitettuna sen taakse.',
  'Heti, ohje: kumpikin painike lähettää pyynnön heti ja agentti aloittaa; historiassa nimi, ja ohje on taitettuna sen taakse.',
  'Heti, nimi: kumpikin painike lähettää pyynnön heti; historiassa pelkkä nimi ilman avattavaa ohjetta.',
];
const NOW = 0, CHIP = 1, FOLDED = 2, LABEL = 3;

const SKILL = 'open-habitat-start-page';
// What Pi records with the call: the skill file's body, exactly as installed.
const SKILL_BODY = skillSource.replace(/^---[\s\S]*?---\s*/, '');
const LEGACY = `/${SKILL} `;
const INVOCATION = `/skill:${SKILL} `;
const EXTRA = 'Korosta viikkoyhteenvetoja.';
const OWN = 'Tee tälle työtilalle aloitussivu.';
const STARTED = 'Luen ensin työtilan rakenteen ja README:n.';
const REPLY = `Luin työtilan rakenteen ja README:n. Ehdotan aloitussivuksi tätä:

**Muistiinpanot**: henkilökohtaiset muistiinpanot Markdownina, viikoittain omissa kansioissaan.

1. **Kirjoita viikon yhteenveto**: kun viikko päättyy.
2. **Etsi vanha muistiinpano**: kun muistat aiheen mutta et paikkaa.
3. **Siivoa keskeneräiset**: kun TODO-rivejä on kertynyt.

Kirjoitanko sivun ja tavoitteiden ohjeet näin? Mitään ei ole vielä kirjoitettu.`;

type Mode = 'absent' | 'update';
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [{path: 'README.md'}], truncated: false}),
  workspaceName: 'muistiinpanot',
};
const words = (mode: Mode) => mode === 'update'
  ? {title: 'Päivitä aloitussivu', description: 'Esittely ja tavoitteet ajan tasalle'}
  : {title: 'Luo aloitussivu', description: 'Esittely ja tavoitteet tälle työtilalle'};
let reviewTheme = 'light';
let reviewMode: Mode = 'absent';

/** One screen of the flow: a caption above a framed piece of the product. */
function Screen({step, caption, id, flash, children}: {step: string; caption: string; id: string; flash?: boolean; children: React.ReactNode}) {
  return (
    <figure className="rq-screen" data-testid={id} data-flash={flash || undefined}>
      <figcaption><b>{step}</b> {caption}</figcaption>
      <div className="rq-frame">{children}</div>
    </figure>
  );
}

function Conversation({title, working, items, empty, draft, goal, placeholder}: {
  title: string; working?: boolean; items?: {id: string; kind: string; content: React.ReactNode}[];
  empty?: React.ReactNode; draft?: string; goal?: {skill: string; title: string; request: string}; placeholder?: string;
}) {
  const [value, setValue] = useState(draft ?? '');
  return (
    <ConversationFrame>
      <AgentHeader title={title} workspaceLabel="muistiinpanot" workspaceHref="/workspaces/ws_m"
        activityLabel={working ? 'Työskentelee' : ''} activityAnimated={false} activityKind={working ? 'working' : 'neutral'}
        controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
      <ConversationStream>
        <ConversationTimeline state={items?.length ? 'ready' : 'empty'} items={items ?? []} historyMode="pagedAccessible" onJumpToLatest={noop}
          emptyLabel={<div className="ah-start rq-empty">{empty}</div>} />
      </ConversationStream>
      <Composer value={value} onChange={setValue} activity={working ? 'working' : 'idle'} selectedWorkingMode="steer"
        onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} sources={sources} goals={goal ? [goal] : []}
        idlePlaceholder={placeholder} modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
    </ConversationFrame>
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [mode, setMode] = useState<Mode>(reviewMode);
  const [flash, setFlash] = useState('');
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
  const w = words(mode);
  const goal = {skill: SKILL, title: w.title, request: SKILL_BODY};
  // Pressing a start button points at the screen that shows its result.
  const press = (target: string) => {
    setFlash(target);
    document.querySelector(`[data-testid="${target}"]`)?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    setTimeout(() => setFlash(''), 1200);
  };

  const user = (text: string, chip: React.ReactNode) => ({id: 'u', kind: 'user', content: (
    <UserMessage sourceText={text} onCopy={noop} time="9.41" skill={chip ?? undefined}>{text ? <Markdown text={text} /> : null}</UserMessage>
  )});
  const assistant = (done: boolean) => ({id: 'a', kind: 'assistant', content: (
    <AssistantMessage streamState={done ? 'complete' : 'streaming'} time="9.41" onCopy={noop}>
      <Markdown text={done ? REPLY : STARTED} />
    </AssistantMessage>
  )});
  // How the sent request reads in the history.
  const chip = direction === LABEL ? (
    <span className="rq-label" data-testid="request-label">{w.title}</span>
  ) : (
    <SkillInvocation name={w.title} description={w.description}><Markdown text={SKILL_BODY} /></SkillInvocation>
  );
  const sent = (extra: string, done: boolean) => [user(extra, chip), assistant(done)];

  const intro = (target: string) => (
    <div className="rq-landing">
      <h1>muistiinpanot</h1>
      <p className="rq-path">~/src/muistiinpanot</p>
      <div onClickCapture={(e) => { if ((e.target as HTMLElement).closest('[data-testid="landing-create"]')) press(target); }}>
        <WorkspaceIntro page={mode === 'update' ? {state: 'needs_update'} : null} state="ready" onRetry={noop} onGoal={noop} onCreatePage={noop} />
      </div>
      <p className="rq-meta">Hakemisto · ei Git-työtilaa</p>
      <h2 className="rq-section">Avoimet <span>0</span></h2>
    </div>
  );
  const line = (target: string) => (
    <div className="ah-workspace-intro-line rq-line" data-testid="empty-invitation">
      <p>{mode === 'update'
        ? 'Aloitussivu tarvitsee päivityksen. Agentti voi päivittää esittelyn ja tavoitteet vastaamaan työtilaa nyt.'
        : 'Tällä työtilalla ei ole vielä aloitussivua. Agentti voi kirjoittaa sen: lyhyen esittelyn ja muutaman tavoitteen uuden keskustelun alkuun.'}</p>
      <ControlButton size="row" variant="secondary" data-testid="empty-create" onPress={() => press(target)}>{w.title}</ControlButton>
    </div>
  );

  const fromPage = direction === NOW ? (
    <>
      <Screen id="page-a" step="a" caption="Työtilan sivu">{intro('page-b')}</Screen>
      <Screen id="page-b" step="b" caption="Painallus avaa uuden keskustelun, ja kentässä on komento" flash={flash === 'page-b'}>
        <Conversation title="Uusi keskustelu" draft={LEGACY} />
      </Screen>
      <Screen id="page-c" step="c" caption="Lähetetty: komento on tavallinen viesti">
        <Conversation title="Uusi keskustelu" items={[user(LEGACY.trim(), null), assistant(true)]} />
      </Screen>
    </>
  ) : direction === CHIP ? (
    <>
      <Screen id="page-a" step="a" caption="Työtilan sivu">{intro('page-b')}</Screen>
      <Screen id="page-b" step="b" caption="Painallus avaa uuden keskustelun, ja kentässä on siru; lähetät itse" flash={flash === 'page-b'}>
        <Conversation title="Uusi keskustelu" draft={INVOCATION} goal={goal} placeholder="Lisää toiveesi tai lähetä sellaisenaan…" />
      </Screen>
      <Screen id="page-c" step="c" caption="Lähetetty toiveen kanssa: nimi, ohje taitettuna">
        <Conversation title={w.title} items={sent(EXTRA, true)} />
      </Screen>
    </>
  ) : (
    <>
      <Screen id="page-a" step="a" caption="Työtilan sivu">{intro('page-b')}</Screen>
      <Screen id="page-b" step="b" caption="Painallus avaa uuden keskustelun, ja agentti aloittaa heti" flash={flash === 'page-b'}>
        <Conversation title={w.title} working items={sent('', false)} />
      </Screen>
      <Screen id="page-c" step="c" caption={direction === LABEL ? 'Myöhemmin historiassa: pelkkä nimi' : 'Myöhemmin historiassa: nimi, ohje taitettuna'}>
        <Conversation title={w.title} items={sent('', true)} />
      </Screen>
    </>
  );

  const fromEmpty = direction === NOW ? (
    <>
      <Screen id="empty-a" step="a" caption="Uusi tyhjä keskustelu: kehotus, ei painiketta">
        <Conversation title="Uusi keskustelu" empty={
          <StartHere page={mode === 'update' ? {state: 'needs_update'} : null} state="ready" onRetry={noop} onGoal={noop} />
        } />
      </Screen>
      <Screen id="empty-b" step="b" caption="Kirjoitat pyynnön itse">
        <Conversation title="Uusi keskustelu" draft={OWN} />
      </Screen>
      <Screen id="empty-c" step="c" caption="Lähetetty: omat sanasi">
        <Conversation title="Uusi keskustelu" items={[user(OWN, null), assistant(true)]} />
      </Screen>
    </>
  ) : (
    <>
      <Screen id="empty-a" step="a" caption="Uusi tyhjä keskustelu: rivi ja painike (päätetty 3.11.)">
        <Conversation title="Uusi keskustelu" empty={line('empty-b')} />
      </Screen>
      <Screen id="empty-b" step="b" caption="Painallus lähettää pyynnön, ja agentti aloittaa heti" flash={flash === 'empty-b'}>
        <Conversation title={w.title} working items={sent('', false)} />
      </Screen>
      <Screen id="empty-c" step="c" caption={direction === LABEL ? 'Myöhemmin historiassa: pelkkä nimi' : 'Myöhemmin historiassa: nimi, ohje taitettuna'}>
        <Conversation title={w.title} items={sent('', true)} />
      </Screen>
    </>
  );

  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Aloitussivupyyntö ennen ja jälkeen lähetyksen</strong>
        <label>Tila <select id="mode" value={mode} onChange={(e) => { reviewMode = e.target.value as Mode; setMode(reviewMode); }}>
          <option value="absent">Ei aloitussivua</option><option value="update">Tarvitsee päivityksen</option></select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <MemoryRouter initialEntries={['/workspaces/ws_m']}>
        <main className="rq-stage">
          <section className="rq-flow" aria-label="Työtilan sivulta" data-testid="flow-page">
            <h2>Työtilan sivulta</h2>
            <div className="rq-screens">{fromPage}</div>
          </section>
          <section className="rq-flow" aria-label="Tyhjästä keskustelusta" data-testid="flow-empty">
            <h2>Tyhjästä keskustelusta</h2>
            <div className="rq-screens">{fromEmpty}</div>
          </section>
        </main>
      </MemoryRouter>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => <App key={`${direction}`} direction={direction} />);
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
