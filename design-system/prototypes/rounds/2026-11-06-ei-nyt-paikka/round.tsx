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
import {TooltipButton} from '../../../../web/src/components/QuickTooltip';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-quiet-transition-triggers, round 2. Jari 6.11. (round 1): start
// from A Vastaus. A conversation stays in Sinun vuorosi until the person
// replies or chooses Ei nyt; opening only turns its ball into a ring. This
// round riffs where Ei nyt sits. The raise (Quiet → Sinun vuorosi) is as
// decided in proto-raise-quiet-to-your-turn round 3 in every direction:
// Nosta in the composer row's middle slot and ⤒ on the rail row. Ei nyt is
// one control for every conversation in Sinun vuorosi, a new reply and a
// raised one alike, so the two mechanisms stay one. The axis: A in the
// composer's middle slot (Nosta's other state), B on the rail row (⤓
// beside the pencil and archive, where ⤒ raises), C under the agent's last
// reply. Production components; the round's controls are placed into
// production markup by portal. Synthetic.
const directions = ['Nyt', 'A Kenttä', 'B Sivupalkki', 'C Vastaus'];
const LINES = [
  'Nyt: avaaminen siirtää keskustelun heti Hiljaisiin. Ei nyt -painiketta ei tarvita, eikä Hiljaisista voi nostaa.',
  'A Kenttä: Ei nyt on kentän rivin keskipaikalla, samassa kohdassa kuin Hiljaisten keskustelun Nosta: yksi painike, kaksi tilaa.',
  'B Sivupalkki: Ei nyt on Sinun vuorosi -rivillä ⤓-painikkeena kynän ja arkiston vieressä, kuten ⤒ Hiljaisten rivillä; avaamatta.',
  'C Vastaus: Ei nyt on agentin viimeisen vastauksen alla rivillä Odottaa vastaustasi; se katoaa, kun vastaat.',
];
const NYT = 0, A = 1, B = 2, C = 3;

type Item = {id: string; kind: 'user' | 'assistant'; text: string; time: string; streaming?: boolean};
type Conv = {id: string; title: string; ws: string; wsName: string; ago: number; history: Item[]};
const u = (id: string, time: string, text: string): Item => ({id, kind: 'user', time, text});
const r = (id: string, time: string, text: string): Item => ({id, kind: 'assistant', time, text});
// The same conversations as the raise rounds, so the rounds compare directly.
const CONVS: Conv[] = [
  {id: 'kesa', title: 'Kesäajan virhe', ws: 'ws_a', wsName: 'aurinkokello', ago: 0, history: [
    u('k1', '9.12', 'Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat.'),
    r('k2', '9.14', 'Ajoin testit: 41 läpi, 2 epäonnistui. Molemmat ovat kesäajan testejä.'),
    u('k3', '9.20', 'Korjaa kesäaika zoneinfolla, älä lisää tunteja käsin.'),
  ]},
  {id: 'nda', title: 'NDA-viestin tarkistus', ws: 'ws_m', wsName: 'muistiinpanot', ago: 4, history: [
    u('n1', '9.02', 'Lue liitteen NDA ja kerro, mitä siinä pitää muuttaa ennen allekirjoitusta.'),
    r('n2', '9.16', 'Kaksi kohtaa: salassapito on ikuinen (ehdota viittä vuotta), ja kohta 7 siirtää kaikki immateriaalioikeudet heille. Luonnos vastaukseksi on valmiina. Lähetänkö sen?'),
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
// The agent's reply to whatever the person sends, 2.5 s later.
const REPLY_MS = 2500;
const ANSWERS: Record<string, string> = {
  nda: 'Lähetin vastauksen. Pyysin viiden vuoden salassapitoa ja kohtaan 7 rajausta tähän projektiin. Odotetaanko heidän vastaustaan vai muistutanko perjantaina?',
  kuvat: 'Jätin ylemmän kuvan ja poistin toisen. Julkaisenko muutoksen nyt?',
  contoso: 'Luonnos sähköpostiksi on valmis, hinnoittelu ensin. Lähetänkö sen kaikille kolmelle?',
};

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'aurinkokello',
};

type State = {
  /** A reply this browser has not yet shown: the full ball. */
  replies: Set<string>;
  /** Opened but not answered (A Vastaus): the ring, still in Sinun vuorosi. */
  read: Set<string>;
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
    replies: new Set(['nda', 'kuvat']),
    read: new Set(),
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
/** Ei nyt: out of Sinun vuorosi until the agent replies again. A raise and
 * an unanswered reply end the same way. */
const notNow = (set: Set_, id: string) => set((x) => ({...x, raised: without(x.raised, id), read: minus(x.read, id), replies: minus(x.replies, id)}));

const yoursHas = (s: State, id: string) => !s.working.has(id) && !s.archived.has(id) && (s.replies.has(id) || s.read.has(id) || s.raised.has(id));
const isRaised = (s: State, id: string) => s.raised.has(id) && !s.replies.has(id) && !s.read.has(id) && !s.working.has(id);

/** The rail's sections: the newest raise leads Sinun vuorosi, then replies
 * by age, as the raise rounds recommended. */
function lists(s: State) {
  const live = CONVS.filter((c) => !s.archived.has(c.id));
  const running = live.filter((c) => s.working.has(c.id));
  const raised = live.filter((c) => isRaised(s, c.id)).sort((a, b) => (s.raised.get(b.id) ?? 0) - (s.raised.get(a.id) ?? 0));
  const replies = live.filter((c) => !s.working.has(c.id) && (s.replies.has(c.id) || s.read.has(c.id)))
    .sort((a, b) => (s.changed.get(b.id) ?? 0) - (s.changed.get(a.id) ?? 0));
  const quiet = live.filter((c) => !s.working.has(c.id) && !yoursHas(s, c.id))
    .sort((a, b) => (s.changed.get(b.id) ?? 0) - (s.changed.get(a.id) ?? 0));
  return {running, yours: [...raised, ...replies], quiet};
}

const NOT_NOW_TIP = 'Ei nyt: siirrä Hiljaisiin. Palaa, kun agentti vastaa.';

/** The rail row's control, placed into the production row's own button
 * group (the pencil and archive span) so it shows and hides exactly as they
 * do: ⤒ raises a quiet row in every direction (decided); in B a row in
 * Sinun vuorosi has ⤓ Ei nyt in the same place. */
function RowControl({slot, s, set, c, title, direction, demo}: {slot: React.RefObject<HTMLDivElement | null>; s: State; set: Set_; c: Conv; title: string; direction: number; demo: boolean}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  // The row re-creates its group when it moves between sections; look again
  // after that commit too.
  useLayoutEffect(() => {
    const find = () => setHost(slot.current?.querySelector<HTMLElement>('.ah-nav-archive') ?? null);
    find();
    const f = requestAnimationFrame(find);
    return () => cancelAnimationFrame(f);
  });
  if (!host || s.working.has(c.id)) return null;
  const yours = yoursHas(s, c.id);
  if (yours && direction !== B) return null;
  return createPortal(
    <span className="rq-row-raise">
      {yours
        ? <ControlButton data-testid={`notnow-${c.id}`} variant="quiet" size="inline"
            aria-label={`Ei nyt: siirrä ${title} Hiljaisiin`} title={NOT_NOW_TIP}
            onPress={() => notNow(set, c.id)}>
            <Icon name="bottom" />
          </ControlButton>
        : <ControlButton data-testid={`raise-${c.id}`} variant="quiet" size="inline"
            aria-label={`Nosta ${title} Sinun vuoroosi`} title="Nosta Sinun vuoroosi"
            onPress={() => raise(set, c.id)}>
            <Icon name="top" />
          </ControlButton>}
      {demo && yours ? <span className="rq-tip rq-tip-row" aria-hidden="true">Ei nyt</span> : null}
    </span>, host);
}

function Row({c, place, direction, s, set, current, demo}: {c: Conv; place: 'yours' | 'running' | 'quiet'; direction: number; s: State; set: Set_; current: string; demo: boolean}) {
  const slot = useRef<HTMLDivElement>(null);
  const w = s.working.has(c.id), reply = s.replies.has(c.id), read = s.read.has(c.id), up = isRaised(s, c.id);
  const label = w ? 'Työssä' : reply ? 'Uusi vastaus' : read ? 'Luettu · odottaa vastaustasi' : up ? 'Nostit Sinun vuoroosi' : 'Odottaa viestiä';
  const title = s.names.get(c.id) ?? c.title;
  const m: AgentNavModel = {
    agentId: c.id, href: `/workspaces/${c.ws}?conversation=${c.id}`, title,
    workspaceId: c.ws, workspaceName: c.wsName, changedAt: s.changed.get(c.id),
    activity: w ? 'working' : 'waiting', activityLabel: label, controlLabel: '',
    attentionLabel: reply || read || up ? label : undefined,
    detail: [c.wsName, label].join(' · '), selected: current === c.id,
  };
  const archive: RailArchive = {reason: (id) => (s.working.has(id) ? 'Agentti on työssä' : ''), run: (id) => set((x) => ({...x, archived: new Set(x.archived).add(id), raised: without(x.raised, id)}))};
  const rename: RailRename = {reason: () => '', save: async (id, name) => set((x) => ({...x, names: new Map(x.names).set(id, name)}))};
  const showDemo = demo && direction === B && current === c.id && place === 'yours';
  return (
    <div ref={slot} className="rq-slot" data-place={place} data-raised={up ? '' : undefined}
      data-ring={read ? '' : undefined} data-demo={showDemo || undefined} data-testid={`slot-${c.id}`}>
      <ul><AgentNavItem {...m} now={Date.now()} archive={archive} rename={rename} /></ul>
      {direction !== NYT && place !== 'running' ? <RowControl slot={slot} s={s} set={set} c={c} title={title} direction={direction} demo={showDemo} /> : null}
    </div>
  );
}

function Rail({direction, s, set, current, demo}: {direction: number; s: State; set: Set_; current: string; demo: boolean}) {
  const {running, yours, quiet} = lists(s);
  const [quietFolded, setQuietFolded] = useState(false);
  const row = (c: Conv, place: 'yours' | 'running' | 'quiet') =>
    <Row key={c.id} c={c} place={place} direction={direction} s={s} set={set} current={current} demo={demo} />;
  // Käynnissä is grouped by workspace without icons, as in production.
  const groups = [...new Set(running.map((c) => c.wsName))].sort((a, b) => a.localeCompare(b, 'fi'));
  return (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={
        <div className="rq-now">
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

/** The composer row's middle slot (raise round 3 C), placed into the
 * production row by portal; round.css orders it before the divider and
 * Sanele. A quiet conversation shows Nosta in every direction; in A a
 * conversation in Sinun vuorosi shows Ei nyt in the same slot. Ohjaa and
 * Stop take the slot when work starts. */
function MiddleSlot({direction, s, set, id, wrap, demo}: {direction: number; s: State; set: Set_; id: string; wrap: React.RefObject<HTMLDivElement | null>; demo: boolean}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const find = () => setHost(wrap.current?.querySelector<HTMLElement>('.ah-crow') ?? null);
    find();
    const f = requestAnimationFrame(find);
    return () => cancelAnimationFrame(f);
  });
  if (!host || direction === NYT || s.working.has(id)) return null;
  const yours = yoursHas(s, id);
  if (yours && direction !== A) return null;
  const control = yours
    ? <TooltipButton data-testid="composer-notnow" type="button" className="ah-crow-chip rq-c rq-notnow"
        aria-label="Ei nyt: siirrä Hiljaisiin" title={NOT_NOW_TIP} onClick={() => notNow(set, id)}>
        <Icon name="bottom" />
        <span>Ei nyt</span>
      </TooltipButton>
    : <TooltipButton data-testid="composer-raise" type="button" className="ah-crow-chip rq-c"
        aria-label="Nosta Sinun vuoroosi" title="Nosta Sinun vuoroosi. Odottaa siellä, kunnes vastaat." onClick={() => raise(set, id)}>
        <Icon name="top" />
        <span>Nosta</span>
      </TooltipButton>;
  return createPortal(
    <span className="rq-cr rq-cr-c">
      {control}
      <span className="ah-crow-sep" aria-hidden="true" />
      {demo && yours ? <span className="rq-tip" aria-hidden="true">Siirrä Hiljaisiin, palaa kun agentti vastaa</span> : null}
    </span>, host);
}

/** C: the line under the agent's last reply while the conversation waits
 * for the person. Replying removes it, because the conversation moves on. */
function UnderReply({s, set, id, demo}: {s: State; set: Set_; id: string; demo: boolean}) {
  const up = isRaised(s, id);
  return (
    <div className="rq-under" data-testid="under-reply">
      <span className="rq-under-ball" data-raised={up || undefined} aria-hidden="true" />
      <span className="rq-under-text">{up ? 'Nostit tämän Sinun vuoroosi' : 'Odottaa vastaustasi'}</span>
      <span className="rq-under-act">
        <ControlButton data-testid="under-notnow" variant="quiet" size="inline" aria-label="Ei nyt: siirrä Hiljaisiin"
          title={NOT_NOW_TIP} onPress={() => notNow(set, id)}>
          <Icon name="bottom" />
          <span>Ei nyt</span>
        </ControlButton>
        {demo ? <span className="rq-tip rq-tip-under" aria-hidden="true">Siirrä Hiljaisiin, palaa kun agentti vastaa</span> : null}
      </span>
    </div>
  );
}

function render(item: Item, after?: React.ReactNode) {
  const content = item.kind === 'user'
    ? <UserMessage sourceText={item.text} onCopy={noop} time={item.time}><Markdown text={item.text} /></UserMessage>
    : <AssistantMessage streamState={item.streaming ? 'streaming' : 'complete'} time={item.time} onCopy={noop}><Markdown text={item.text} /></AssistantMessage>;
  return {id: item.id, kind: item.kind, content: <div data-item={item.id}>{content}{after}</div>};
}

// The mic as production shows it, with a stream that never opens.
const pending = () => new Promise<never>(() => {});
const speech = {onOpenSettings: noop, deps: {
  mint: pending, microphone: pending, capture: pending,
  socket: () => { throw new Error('no stream in a prototype'); },
  now: () => Date.now(),
  setInterval: (run: () => void, ms: number) => window.setInterval(run, ms),
  clearInterval: (id: number) => window.clearInterval(id),
}};

let reviewTheme = 'light';

function Main({direction}: {direction: number}) {
  const [s, set] = useState(initial);
  const [draft, setDraft] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  // The default view shows where Ei nyt is; the first touch of the page
  // clears the shown tooltip.
  const [demo, setDemo] = useState(direction !== NYT);
  const location = useLocation();
  const navigate = useNavigate();
  const current = new URLSearchParams(location.search).get('conversation') ?? 'nda';
  const conv = byId.get(current)!;
  const currentRef = useRef(current);
  currentRef.current = current;
  // Seeing a reply: today it leaves Sinun vuorosi at once; in A Vastaus it
  // only turns the ball into a ring. Leaving closes the Sillä aikaa row.
  const see = (x: State, id: string): State => {
    if (!x.replies.has(id)) return x;
    return {...x, replies: minus(x.replies, id), read: direction === NYT ? x.read : new Set(x.read).add(id)};
  };
  useEffect(() => {
    set((x) => ({...see(x, current), windowFor: x.windowFor === current ? x.windowFor : null}));
  }, [current]);
  useEffect(() => {
    if (!demo) return;
    const off = () => setDemo(false);
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [demo]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
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
    const id = current;
    set((x) => ({
      ...x,
      sent: {...x.sent, [id]: [...(x.sent[id] ?? []), u(`m${Date.now()}`, '9.40', text)]},
      working: new Set(x.working).add(id),
      raised: without(x.raised, id),
      read: minus(x.read, id),
      replies: minus(x.replies, id),
      changed: new Map(x.changed).set(id, Date.now()),
      windowFor: id,
    }));
    setDraft('');
    // The agent answers; the direction's rule applies to the new reply.
    timers.current.push(window.setTimeout(() => set((x) => {
      const next: State = {
        ...x,
        sent: {...x.sent, [id]: [...(x.sent[id] ?? []), r(`a${Date.now()}`, '9.41', ANSWERS[id] ?? 'Valmis. Katso muutos.')]},
        working: minus(x.working, id),
        replies: new Set(x.replies).add(id),
        changed: new Map(x.changed).set(id, Date.now()),
      };
      return currentRef.current === id ? see(next, id) : next;
    }), REPLY_MS));
  };
  const title = s.names.get(current) ?? conv.title;
  const history = [...conv.history, ...(s.sent[current] ?? [])];
  const lastReply = [...history].reverse().find((i) => i.kind === 'assistant')?.id;
  const under = direction === C && yoursHas(s, current) && !working;
  const items = history.map((i) => render(i, under && i.id === lastReply ? <UnderReply s={s} set={set} id={current} demo={demo} /> : null));
  if (working) items.push(render({id: 'live', kind: 'assistant', time: '', text: 'Katson tätä nyt…', streaming: true}));
  return (
    <AppShell mobileTitle={title} navigationBadge={yours.length}
      rail={<Rail direction={direction} s={s} set={set} current={current} demo={demo} />}
      main={
        <div className="ah-state">
          <ConversationFrame>
            <AgentHeader title={title} workspaceLabel={conv.wsName} workspaceHref={`/workspaces/${conv.ws}`}
              activityLabel={working ? 'Työssä' : ''} activityAnimated={working} activityKind={working ? 'working' : 'neutral'}
              controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{onSave: async () => {}}}
              settings={{model: 'gpt-5.5', thinking: 'medium'}}
              recapAction={{onPress: noop}}
              archive={{state: 'active', eligible: !working, busy: false, onArchive: () => set((x) => ({...x, archived: new Set(x.archived).add(current)})), onRestore: noop}} />
            <ConversationStream>
              <ConversationTimeline key={current} state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
            </ConversationStream>
            {bannerOpen ? <NextWaitingRow waiting={others.map(toModel)} onStart={() => navigate(toModel(first).href)} /> : null}
            <div ref={wrap} className="rq-composer" data-direction={direction}>
              <Composer value={draft} onChange={setDraft} activity={working ? 'working' : 'idle'} selectedWorkingMode="steer"
                onModeChange={noop} onSendNow={(t) => send(t ?? draft)} onSteer={(t) => send(t ?? draft)} onFollowUp={(t) => send(t ?? draft)}
                onInterrupt={working ? noop : undefined} sources={sources} csrf="prototype" speech={speech} />
            </div>
            <MiddleSlot direction={direction} s={s} set={set} id={current} wrap={wrap} demo={demo} />
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
        <strong>Sinun vuorosi ↔ Hiljaiset – kierros 2: Ei nyt -painikkeen paikka</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => setGeneration((g) => g + 1)}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_m?conversation=nda']}>
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
