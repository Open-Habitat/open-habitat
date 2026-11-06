import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, type RailArchive, type RailRename, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {NextWaitingRow} from '../../../../web/src/components/NextWaitingRow';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-raise-quiet-to-your-turn, round 2. Jari 6.11.: the raise is a
// button among the conversation's other buttons, not a menu item. The axis
// is which buttons it joins and how it looks there: A an icon among the
// header's icons (Kooste, Arkistoi, Tiedot), B a labelled button on the
// composer's lower row beside the model, C an icon among the rail row's
// pencil and archive, so it also raises without opening. What a raise then
// is stays the same in all three (round 1's recommended B): an arrow in the
// ball, newest raise first in Sinun vuorosi and in Sillä aikaa, kept until
// the person replies or presses the button again. Rows, sections, header,
// composer and the Sillä aikaa row are the production components; the raise
// buttons, the arrow and the demo tooltip are this round's. Synthetic.
const directions = ['Nyt', 'A Yläpalkissa', 'B Kentän luona', 'C Rivillä'];
const LINES = [
  'Nyt: Hiljaisista ei voi nostaa. Sinun vuoroosi tulee vain agentin valmis vuoro, ja avaaminen kuittaa sen.',
  'A Yläpalkissa: ↑-kuvake yläpalkin painikkeiden joukossa Koosteen ja Arkistoi-painikkeen vieressä. Nostettuna se on oranssi ja laskee painettaessa.',
  'B Kentän luona: tekstipainike Palaan tähän kentän alarivillä mallin vieressä. Nostettuna siinä lukee Sinun vuorossasi ja ✕ laskee.',
  'C Rivillä: ↑ sivupalkin rivillä kynän ja arkiston rinnalla, joten nostaa voi avaamatta. Nostetulla rivillä samassa kohdassa on ↓.',
];
const NYT = 0, A = 1, B = 2, C = 3;

type Item = {id: string; kind: 'user' | 'assistant'; text: string; time: string; streaming?: boolean};
type Conv = {id: string; title: string; ws: string; wsName: string; ago: number; history: Item[]};
const u = (id: string, time: string, text: string): Item => ({id, kind: 'user', time, text});
const r = (id: string, time: string, text: string): Item => ({id, kind: 'assistant', time, text});
// The same conversations as round 1, so the two rounds compare directly.
const CONVS: Conv[] = [
  {id: 'kesa', title: 'Kesäajan virhe', ws: 'ws_a', wsName: 'aurinkokello', ago: 0, history: [
    u('k1', '9.12', 'Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat.'),
    r('k2', '9.14', 'Ajoin testit: 41 läpi, 2 epäonnistui. Molemmat ovat kesäajan testejä.'),
    u('k3', '9.20', 'Korjaa kesäaika zoneinfolla, älä lisää tunteja käsin.'),
  ]},
  {id: 'nda', title: 'NDA-viestin tarkistus', ws: 'ws_m', wsName: 'muistiinpanot', ago: 4, history: [
    u('n1', '9.02', 'Lue liitteen NDA ja kerro, mitä siinä pitää muuttaa ennen allekirjoitusta.'),
    r('n2', '9.16', 'Kaksi kohtaa: salassapito on ikuinen (ehdota viittä vuotta), ja kohta 7 siirtää kaikki immateriaalioikeudet heille. Luonnos vastaukseksi on valmiina.'),
  ]},
  {id: 'svg', title: 'Varjon piirto SVG:ksi', ws: 'ws_a', wsName: 'aurinkokello', ago: 1, history: [
    u('s1', '9.05', 'Piirrä varjon kulku SVG:ksi tunnin välein.'),
  ]},
  {id: 'contoso', title: 'Contosoin tapaaminen', ws: 'ws_m', wsName: 'muistiinpanot', ago: 130, history: [
    u('v1', '7.10', 'Kokoa eilisen Contoso-tapaamisen muistiinpanoista avoimet asiat.'),
    r('v2', '7.12', 'Avoimia on kolme: hinnoittelu pilotin jälkeen, kuka omistaa palvelimen ja milloin seuraava katselmointi on. Vastaanko näihin sähköpostilla?'),
  ]},
  {id: 'kuvat', title: 'Etusivun kuvat', ws: 'ws_k', wsName: 'kotisivu', ago: 300, history: [
    u('e1', '4.20', 'Pienennä etusivun kuvat ja lisää niille alt-tekstit.'),
    r('e2', '4.31', 'Pienensin kuusi kuvaa (yhteensä 4,1 Mt → 620 kt) ja kirjoitin alt-tekstit. Kaksi kuvaa näyttää samalta; kumpi jätetään?'),
  ]},
  {id: 'lasku', title: 'Laskun muistutus', ws: 'ws_m', wsName: 'muistiinpanot', ago: 1500, history: [
    u('l1', 'eilen', 'Kirjoita kohtelias muistutus erääntyneestä laskusta.'),
    r('l2', 'eilen', 'Tässä luonnos. Liitin laskun numeron ja eräpäivän.'),
  ]},
  {id: 'testit', title: 'Testien siivous', ws: 'ws_a', wsName: 'aurinkokello', ago: 2900, history: [
    u('t1', 'ma', 'Poista testeistä vanhat kiintoarvot.'),
    r('t2', 'ma', 'Poistin 14 kiintoarvoa ja korvasin ne fixtureilla. Testit menevät läpi.'),
  ]},
  {id: 'suku', title: 'Sukuseuran kirje', ws: 'ws_m', wsName: 'muistiinpanot', ago: 4400, history: [
    u('g1', 'la', 'Tee sukuseuran kesäkirjeestä lyhyempi.'),
    r('g2', 'la', 'Lyhensin kirjeen puoleen. Jätin ilmoittautumisen päivämäärän ennalleen.'),
  ]},
];
const byId = new Map(CONVS.map((c) => [c.id, c]));
const T0 = Date.now();

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'aurinkokello',
};

type State = {
  replies: Set<string>;
  /** Raised by hand, with when. */
  raised: Map<string, number>;
  working: Set<string>;
  archived: Set<string>;
  names: Map<string, string>;
  changed: Map<string, number>;
  sent: Record<string, Item[]>;
  /** The conversation whose accepted send opened the Sillä aikaa row. */
  windowFor: string | null;
};
function initial(): State {
  return {
    replies: new Set(['nda']),
    raised: new Map(),
    working: new Set(['kesa', 'svg']),
    archived: new Set(),
    names: new Map(),
    changed: new Map(CONVS.map((c) => [c.id, T0 - c.ago * 60000])),
    sent: {},
    windowFor: null,
  };
}
type Set_ = React.Dispatch<React.SetStateAction<State>>;
const without = <K, V>(m: Map<K, V>, k: K) => { const n = new Map(m); n.delete(k); return n; };
const minus = <K,>(s: Set<K>, k: K) => { const n = new Set(s); n.delete(k); return n; };
const raise = (set: Set_, id: string) => set((x) => ({...x, raised: new Map(x.raised).set(id, Date.now())}));
const lower = (set: Set_, id: string) => set((x) => ({...x, raised: without(x.raised, id)}));

/** The rail's sections: the newest raise leads Sinun vuorosi in every
 * direction, as round 1 recommended. */
function lists(s: State) {
  const live = CONVS.filter((c) => !s.archived.has(c.id));
  const running = live.filter((c) => s.working.has(c.id));
  const idle = live.filter((c) => !s.working.has(c.id));
  const replies = idle.filter((c) => s.replies.has(c.id));
  const raised = idle.filter((c) => !s.replies.has(c.id) && s.raised.has(c.id))
    .sort((a, b) => (s.raised.get(b.id) ?? 0) - (s.raised.get(a.id) ?? 0));
  const quiet = idle.filter((c) => !s.replies.has(c.id) && !s.raised.has(c.id))
    .sort((a, b) => (s.changed.get(b.id) ?? 0) - (s.changed.get(a.id) ?? 0));
  const yours = [...raised, ...replies];
  return {running, yours, quiet};
}

/** Why the conversation cannot be raised now, if it cannot. */
function blocked(s: State, id: string) {
  if (s.working.has(id)) return 'Agentti on työssä. Keskustelu tulee Sinun vuoroosi, kun se valmistuu.';
  if (s.replies.has(id)) return 'Odottaa jo sinua Sinun vuorossasi.';
  return '';
}
const isRaised = (s: State, id: string) => s.raised.has(id) && !s.replies.has(id) && !s.working.has(id);

/** C's button, placed into the production row's own button group (the
 * pencil and archive span) so it shows and hides exactly as they do. */
function RowRaise({slot, s, set, c, title}: {slot: React.RefObject<HTMLDivElement | null>; s: State; set: Set_; c: Conv; title: string}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  // The row re-creates its group when it moves between sections; look again
  // after that commit too.
  useLayoutEffect(() => {
    const find = () => setHost(slot.current?.querySelector<HTMLElement>('.ah-nav-archive') ?? null);
    find();
    const f = requestAnimationFrame(find);
    return () => cancelAnimationFrame(f);
  });
  const up = isRaised(s, c.id);
  // A row that already waits has nothing to raise; it shows no button.
  if (!host || (!up && blocked(s, c.id))) return null;
  const why = '';
  return createPortal(
    <span className="rq-row-raise">
      <ControlButton data-testid={`${up ? 'lower' : 'raise'}-${c.id}`} variant="quiet" size="inline"
        aria-label={up ? `Laske ${title} Hiljaisiin` : `Nosta ${title} Sinun vuoroosi`}
        title={why || (up ? 'Laske Hiljaisiin' : 'Nosta Sinun vuoroosi')}
        isDisabled={!!why} onPress={() => (up ? lower : raise)(set, c.id)}>
        <Icon name={up ? 'down' : 'up'} />
      </ControlButton>
    </span>, host);
}

function Row({c, place, direction, s, set, current, demo}: {c: Conv; place: 'yours' | 'running' | 'quiet'; direction: number; s: State; set: Set_; current: string; demo: boolean}) {
  const slot = useRef<HTMLDivElement>(null);
  const w = s.working.has(c.id), reply = s.replies.has(c.id), up = direction !== NYT && isRaised(s, c.id);
  const label = w ? 'Työssä' : reply ? 'Uusi vastaus' : up ? 'Nostit Sinun vuoroosi' : 'Odottaa viestiä';
  const title = s.names.get(c.id) ?? c.title;
  const m: AgentNavModel = {
    agentId: c.id, href: `/workspaces/${c.ws}?conversation=${c.id}`, title,
    workspaceId: c.ws, workspaceName: c.wsName, changedAt: s.changed.get(c.id),
    activity: w ? 'working' : 'waiting', activityLabel: label, controlLabel: '',
    attentionLabel: reply || up ? label : undefined,
    detail: [c.wsName, label].join(' · '), selected: current === c.id,
  };
  const archive: RailArchive = {reason: (id) => (s.working.has(id) ? 'Agentti on työssä' : ''), run: (id) => set((x) => ({...x, archived: new Set(x.archived).add(id), raised: without(x.raised, id)}))};
  const rename: RailRename = {reason: () => '', save: async (id, name) => set((x) => ({...x, names: new Map(x.names).set(id, name)}))};
  return (
    <div ref={slot} className="rq-slot" data-place={place} data-raised={up ? '' : undefined} data-demo={demo ? '' : undefined} data-testid={`slot-${c.id}`}>
      <ul><AgentNavItem {...m} now={Date.now()} archive={archive} rename={rename} /></ul>
      {direction === C && place !== 'running' ? <RowRaise slot={slot} s={s} set={set} c={c} title={title} /> : null}
      {demo ? <span className="rq-tip rq-tip-row" aria-hidden="true">Nosta Sinun vuoroosi</span> : null}
    </div>
  );
}

function Rail({direction, s, set, current, demo, clearDemo}: {direction: number; s: State; set: Set_; current: string; demo: boolean; clearDemo: () => void}) {
  const {running, yours, quiet} = lists(s);
  const [quietFolded, setQuietFolded] = useState(false);
  const row = (c: Conv, place: 'yours' | 'running' | 'quiet') =>
    <Row key={c.id} c={c} place={place} direction={direction} s={s} set={set} current={current} demo={demo && direction === C && c.id === current} />;
  // Käynnissä is grouped by workspace without icons, as in production.
  const groups = [...new Set(running.map((c) => c.wsName))].sort((a, b) => a.localeCompare(b, 'fi'));
  return (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={
        <div className="rq-now" onPointerEnter={clearDemo}>
          <section className="ah-now" data-testid="rail-yours" aria-labelledby="rq-yours">
            <h2 className="ah-rail-section-head" id="rq-yours">
              Sinun vuorosi
              {yours.length ? <span className="ah-rail-count ah-rail-count-attention">{yours.length}</span> : null}
            </h2>
            {yours.length ? <div className="rq-list">{yours.map((c) => row(c, 'yours'))}</div>
              : <p className="ah-now-empty">Mikään ei odota sinua.</p>}
          </section>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="rq-running">
            <h2 className="ah-rail-section-head" id="rq-running">Käynnissä{running.length ? <span className="ah-rail-count">{running.length}</span> : null}</h2>
            {groups.map((g) => (
              // biome-ignore lint/a11y/useSemanticElements: a list group.
              <div key={g} className="ah-now-group" role="group">
                <h3 className="ah-now-group-head"><span className="ah-now-group-name">{g}</span><span className="ah-rail-count">{running.filter((c) => c.wsName === g).length}</span></h3>
                <div className="rq-list">{running.filter((c) => c.wsName === g).map((c) => row(c, 'running'))}</div>
              </div>
            ))}
          </section>
          <section className="ah-now ah-quiet" data-testid="rail-quiet" data-folded={quietFolded || undefined} aria-labelledby="rq-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded={!quietFolded} onClick={() => setQuietFolded(!quietFolded)}>
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="rq-quiet">Hiljaiset</span>
                {quiet.length ? <span className="ah-rail-count">{quiet.length}</span> : null}
              </button>
            </h2>
            {quietFolded ? null : <div className="rq-list">{quiet.map((c) => row(c, 'quiet'))}</div>}
          </section>
        </div>
      }>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" hint={running.length ? {kind: 'working', count: running.length, text: `${running.length} työssä`} : undefined} />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" hint={yours.length ? {kind: 'attention', count: yours.length, text: `${yours.length} odottaa sinua`} : undefined} />
    </WorkspaceRail>
  );
}

/** A: one more icon in the header's row of icons. */
function HeaderRaise({s, set, id, demo}: {s: State; set: Set_; id: string; demo: boolean}) {
  const up = isRaised(s, id);
  const why = up ? '' : blocked(s, id);
  return (
    <span className="rq-head-raise" data-on={up || undefined}>
      <ControlButton data-testid="head-raise" data-on={up || undefined} size="row" variant="quiet" className="ah-topbar-icon"
        aria-label={up ? 'Laske Hiljaisiin' : 'Nosta Sinun vuoroosi'} aria-pressed={up}
        title={why || (up ? 'Sinun vuorossasi. Laske Hiljaisiin' : 'Nosta Sinun vuoroosi')}
        isDisabled={!!why} onPress={() => (up ? lower : raise)(set, id)}>
        <Icon name="up" />
      </ControlButton>
      {demo ? <span className="rq-tip rq-tip-head" aria-hidden="true">Nosta Sinun vuoroosi</span> : null}
    </span>
  );
}

/** B: a labelled button beside the model, where the person decides
 * whether to reply now. */
function ComposerRaise({s, set, id}: {s: State; set: Set_; id: string}) {
  const up = isRaised(s, id);
  const why = up ? '' : blocked(s, id);
  if (s.working.has(id)) return null;
  return (
    <ControlButton data-testid="composer-raise" data-on={up || undefined} size="inline" presentation="pill" variant="quiet"
      className="rq-pill" aria-pressed={up}
      aria-label={up ? 'Sinun vuorossasi. Laske Hiljaisiin' : 'Palaan tähän: nosta Sinun vuoroosi'}
      title={why || (up ? 'Laske Hiljaisiin' : 'Nosta Sinun vuoroosi. Odottaa siellä, kunnes vastaat.')}
      isDisabled={!!why} onPress={() => (up ? lower : raise)(set, id)}>
      <Icon name="up" />
      <span>{up ? 'Sinun vuorossasi' : 'Palaan tähän'}</span>
      {up ? <Icon name="cross" className="rq-pill-x" /> : null}
    </ControlButton>
  );
}

function render(item: Item) {
  const content = item.kind === 'user'
    ? <UserMessage sourceText={item.text} onCopy={noop} time={item.time}><Markdown text={item.text} /></UserMessage>
    : <AssistantMessage streamState={item.streaming ? 'streaming' : 'complete'} time={item.time} onCopy={noop}><Markdown text={item.text} /></AssistantMessage>;
  return {id: item.id, kind: item.kind, content: <div data-item={item.id}>{content}</div>};
}

let reviewTheme = 'light';

function Main({direction}: {direction: number}) {
  const [s, set] = useState(initial);
  const [draft, setDraft] = useState('');
  // The default view shows where the button is; the first touch of the
  // page clears the shown tooltip.
  const [demo, setDemo] = useState(direction === A || direction === C);
  const location = useLocation();
  const navigate = useNavigate();
  const current = new URLSearchParams(location.search).get('conversation') ?? 'contoso';
  const conv = byId.get(current)!;
  // Opening is seeing a reply; a raise stays until a reply or the button.
  // Leaving the conversation closes the Sillä aikaa row.
  useEffect(() => {
    set((x) => ({...x, replies: minus(x.replies, current), windowFor: x.windowFor === current ? x.windowFor : null}));
  }, [current]);
  useEffect(() => {
    if (!demo) return;
    const off = () => setDemo(false);
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [demo]);
  const {yours} = lists(s);
  const toModel = (c: Conv): AgentNavModel => ({agentId: c.id, href: `/workspaces/${c.ws}?conversation=${c.id}`, title: s.names.get(c.id) ?? c.title, activityLabel: '', controlLabel: ''});
  const others = yours.filter((c) => c.id !== current);
  const working = s.working.has(current);
  const bannerOpen = s.windowFor === current && working && others.length > 0;
  const first = others[0];
  useEffect(() => {
    if (!bannerOpen || !first) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'ArrowDown') { e.preventDefault(); navigate(toModel(first).href); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  const send = (text: string) => {
    if (!text.trim()) return;
    set((x) => ({
      ...x,
      sent: {...x.sent, [current]: [...(x.sent[current] ?? []), u(`m${Date.now()}`, '9.40', text)]},
      working: new Set(x.working).add(current),
      raised: without(x.raised, current),
      replies: minus(x.replies, current),
      changed: new Map(x.changed).set(current, Date.now()),
      windowFor: current,
    }));
    setDraft('');
  };
  const title = s.names.get(current) ?? conv.title;
  const items = [...conv.history, ...(s.sent[current] ?? [])];
  if (working) items.push({id: 'live', kind: 'assistant', time: '', text: 'Katson tätä nyt…', streaming: true});
  const model = <button type="button" className="md-pill">Agentin oletus · medium</button>;
  return (
    <AppShell mobileTitle={title} navigationBadge={yours.length}
      rail={<Rail direction={direction} s={s} set={set} current={current} demo={demo} clearDemo={() => setDemo(false)} />}
      main={
        <div className="ah-state">
          <ConversationFrame>
            <AgentHeader title={title} workspaceLabel={conv.wsName} workspaceHref={`/workspaces/${conv.ws}`}
              activityLabel={working ? 'Työssä' : ''} activityAnimated={working} activityKind={working ? 'working' : 'neutral'}
              controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{onSave: async () => {}}}
              terminal={direction === A ? <HeaderRaise s={s} set={set} id={current} demo={demo} /> : undefined}
              recapAction={{onPress: noop}}
              archive={{state: 'active', eligible: !working, busy: false, onArchive: () => set((x) => ({...x, archived: new Set(x.archived).add(current)})), onRestore: noop}} />
            <ConversationStream>
              <ConversationTimeline key={current} state="ready" items={items.map(render)} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
            </ConversationStream>
            {bannerOpen ? <NextWaitingRow waiting={others.map(toModel)} onStart={() => navigate(toModel(first).href)} /> : null}
            <Composer value={draft} onChange={setDraft} activity={working ? 'working' : 'idle'} selectedWorkingMode="steer"
              onModeChange={noop} onSendNow={(t) => send(t ?? draft)} onSteer={(t) => send(t ?? draft)} onFollowUp={(t) => send(t ?? draft)}
              onInterrupt={noop} sources={sources} csrf="prototype"
              modelPicker={direction === B ? <span className="rq-model-row">{model}<ComposerRaise s={s} set={set} id={current} /></span> : model} />
          </ConversationFrame>
        </div>
      } />
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
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
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Nosta Hiljaisista – kierros 2: painike</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => setGeneration((g) => g + 1)}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_m?conversation=contoso']}>
          <Main direction={direction} />
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
