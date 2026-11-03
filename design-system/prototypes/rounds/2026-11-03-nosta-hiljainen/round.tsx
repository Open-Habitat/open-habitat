import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {Dialog as AriaDialog, DialogTrigger, Popover} from 'react-aria-components';
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
import {Menu} from '../../../../web/src/components/Overlays';
import {Icon} from '../../../../web/src/components/Icon';
import {Button, Checkbox, TextField} from '../../../../web/src/components/Primitives';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-raise-quiet-to-your-turn. Today a conversation reaches Sinun vuorosi
// only when its agent finishes a turn (or asks), and leaves it when the
// person opens it in this browser. The axis is how the person raises a
// Hiljaiset conversation there by hand and what the raised row then is:
// A the same as a finished turn, raised from the row's ball and gone when
// opened; B a marked reminder from the ⋯ menus, first in line and kept until
// the person replies or says Ei nyt; C a list of its own under the replies,
// picked from the section's +, counted apart in the Sillä aikaa row.
// Rail rows, sections, header, menu, checkbox, composer and the Sillä aikaa
// row are the production components; the raise controls, the raised mark, the
// swipe and C's own row text are this round's. Everything is synthetic.
const directions = ['Nyt', 'A Pallosta', 'B Valikosta', 'C Nostamasi'];
const LINES = [
  'Nyt: Hiljaisista ei voi nostaa. Sinun vuoroosi ja Sillä aikaa -riville tulee vain agentin valmis vuoro, ja avaaminen kuittaa sen.',
  'A Pallosta: Hiljaisen rivin pallo muuttuu osoittimen alla nostonapiksi (puhelimessa pyyhkäisy oikealle). Nostettu näyttää valmiilta vuorolta ja poistuu, kun avaat sen.',
  'B Valikosta: rivin ja keskustelun ⋯-valikossa Nosta Sinun vuoroosi. Nostettu on merkitty nuolella, menee jonon kärkeen ja pysyy, kunnes vastaat tai valitset Ei nyt.',
  'C Nostamasi: Sinun vuorosi -otsikon + valitsee Hiljaisista. Nostetut ovat omana ryhmänään vastausten jälkeen, Sillä aikaa laskee ne erikseen, ja ✕ laskee takaisin.',
];
const NYT = 0, A = 1, B = 2, C = 3;

type Item = {id: string; kind: 'user' | 'assistant'; text: string; time: string; streaming?: boolean};
type Conv = {id: string; title: string; ws: string; wsName: string; ago: number; history: Item[]};
const u = (id: string, time: string, text: string): Item => ({id, kind: 'user', time, text});
const r = (id: string, time: string, text: string): Item => ({id, kind: 'assistant', time, text});
// Catalog order, which Sinun vuorosi keeps today.
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
const phone = () => window.matchMedia('(max-width: 800px)').matches;

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
function initial(direction: number): State {
  return {
    replies: new Set(['nda']),
    raised: direction === NYT ? new Map() : new Map([['contoso', T0 - 3 * 60000]]),
    working: new Set(['kesa', 'svg']),
    archived: new Set(),
    names: new Map(),
    changed: new Map(CONVS.map((c) => [c.id, T0 - c.ago * 60000])),
    sent: {},
    windowFor: 'kesa',
  };
}
const without = <K, V>(m: Map<K, V>, k: K) => { const n = new Map(m); n.delete(k); return n; };
const minus = <K,>(s: Set<K>, k: K) => { const n = new Set(s); n.delete(k); return n; };

/** The rail's sections as each direction orders them. */
function lists(direction: number, s: State) {
  const live = CONVS.filter((c) => !s.archived.has(c.id));
  const running = live.filter((c) => s.working.has(c.id));
  const idle = live.filter((c) => !s.working.has(c.id));
  const replies = idle.filter((c) => s.replies.has(c.id));
  const raised = idle.filter((c) => !s.replies.has(c.id) && s.raised.has(c.id));
  const byRaise = (later: boolean) => (a: Conv, b: Conv) => (later ? -1 : 1) * ((s.raised.get(a.id) ?? 0) - (s.raised.get(b.id) ?? 0));
  const quiet = idle.filter((c) => !s.replies.has(c.id) && !s.raised.has(c.id))
    .sort((a, b) => (s.changed.get(b.id) ?? 0) - (s.changed.get(a.id) ?? 0));
  // A keeps catalog order like a finished turn; B puts the newest raise
  // first; C lists raises after the replies, in the order raised.
  const yours = direction === B ? [...[...raised].sort(byRaise(true)), ...replies]
    : direction === C ? replies
      : idle.filter((c) => s.replies.has(c.id) || s.raised.has(c.id));
  const raisedList = direction === C ? [...raised].sort(byRaise(false)) : [];
  const queue = [...yours, ...raisedList];
  return {running, yours, raisedList, quiet, queue};
}

function Rail({direction, s, set, current, demoHover, clearDemo}: {direction: number; s: State; set: React.Dispatch<React.SetStateAction<State>>; current: string; demoHover: boolean; clearDemo: () => void}) {
  const {running, yours, raisedList, quiet} = lists(direction, s);
  const [quietFolded, setQuietFolded] = useState(false);
  const now = Date.now();
  const raise = (id: string) => set((x) => ({...x, raised: new Map(x.raised).set(id, Date.now())}));
  const lower = (id: string) => set((x) => ({...x, raised: without(x.raised, id), replies: minus(x.replies, id)}));
  const archive: RailArchive = {reason: () => '', run: (id) => set((x) => ({...x, archived: new Set(x.archived).add(id), raised: without(x.raised, id)}))};
  const rename: RailRename = {reason: () => '', save: async (id, name) => set((x) => ({...x, names: new Map(x.names).set(id, name)}))};
  const model = (c: Conv): AgentNavModel => {
    const w = s.working.has(c.id), reply = s.replies.has(c.id), up = s.raised.has(c.id) && !reply;
    const label = w ? 'Työssä' : reply ? 'Uusi vastaus' : up ? 'Nostit Sinun vuoroosi' : 'Odottaa viestiä';
    return {
      agentId: c.id, href: `/workspaces/${c.ws}?conversation=${c.id}`, title: s.names.get(c.id) ?? c.title,
      workspaceId: c.ws, workspaceName: c.wsName, changedAt: s.changed.get(c.id),
      activity: w ? 'working' : 'waiting', activityLabel: label, controlLabel: '',
      attentionLabel: reply || (up && direction !== NYT) ? label : undefined,
      detail: [c.wsName, label].join(' · '), selected: current === c.id,
    };
  };
  const plain = direction === NYT || direction === A || direction === C;
  const row = (c: Conv, place: 'yours' | 'raised' | 'running' | 'quiet') => {
    const m = model(c);
    const up = s.raised.has(c.id) && !s.replies.has(c.id);
    const item = <ul><AgentNavItem key={c.id} {...m} now={now} archive={plain && place !== 'raised' ? archive : undefined} rename={plain && place !== 'raised' ? rename : undefined} /></ul>;
    let extra: React.ReactNode = null;
    let swipe: {dir: 'right' | 'left'; label: string; run: () => void} | undefined;
    if (direction === A && place === 'quiet') {
      extra = (
        <span className="rq-ball-slot" data-demo={demoHover && c.id === 'kuvat' ? '' : undefined}>
          <ControlButton data-testid={`raise-${c.id}`} size="inline" variant="quiet" className="rq-ball-btn" aria-label={`Nosta ${m.title} Sinun vuoroosi`} title="Nosta Sinun vuoroosi" onPress={() => raise(c.id)}>
            <Icon name="up" />
          </ControlButton>
          {demoHover && c.id === 'kuvat' ? <span className="rq-tip" aria-hidden="true">Nosta Sinun vuoroosi</span> : null}
        </span>
      );
      swipe = {dir: 'right', label: 'Nosta', run: () => raise(c.id)};
    }
    if (direction === A && place === 'yours') {
      extra = (
        <span className="rq-ball-slot">
          <ControlButton data-testid={`lower-${c.id}`} size="inline" variant="quiet" className="rq-ball-btn" aria-label={`Laske ${m.title} Hiljaisiin`} title="Ei nyt: laske Hiljaisiin" onPress={() => lower(c.id)}>
            <Icon name="down" />
          </ControlButton>
        </span>
      );
      swipe = {dir: 'left', label: 'Ei nyt', run: () => lower(c.id)};
    }
    if (direction === B && place !== 'running') {
      const items = place === 'quiet'
        ? [{id: 'raise', label: 'Nosta Sinun vuoroosi', description: 'Odottaa siellä, kunnes vastaat'}]
        : [{id: 'lower', label: 'Ei nyt', description: 'Takaisin Hiljaisiin'}];
      extra = (
        <span className="rq-row-menu">
          <Menu label={`${m.title}: toiminnot`} trigger={<Icon name="more" />} triggerPresentation="icon" triggerClassName="rq-more" triggerTestId={`row-menu-${c.id}`} placement="bottom end"
            items={[...items, {id: 'rename', label: 'Nimeä uudelleen'}, {id: 'archive', label: 'Arkistoi'}]}
            onAction={(id) => {
              if (id === 'raise') raise(c.id);
              if (id === 'lower') lower(c.id);
              if (id === 'archive') archive.run(c.id);
            }} />
        </span>
      );
    }
    if (direction === C && place === 'raised') {
      extra = (
        <span className="rq-row-x">
          <ControlButton data-testid={`unraise-${c.id}`} size="inline" variant="quiet" aria-label={`Ei nyt: laske ${m.title} Hiljaisiin`} title="Ei nyt: laske Hiljaisiin" onPress={() => lower(c.id)}>
            <Icon name="cross" />
          </ControlButton>
        </span>
      );
    }
    return (
      <div key={c.id} className="rq-slot" data-place={place} data-raised={direction === B && up ? '' : undefined} data-testid={`slot-${c.id}`}>
        {swipe ? <Swipe {...swipe}>{item}</Swipe> : item}
        {extra}
      </div>
    );
  };
  // Käynnissä is grouped by workspace without icons, as in production.
  const groups = [...new Set(running.map((c) => c.wsName))].sort((a, b) => a.localeCompare(b, 'fi'));
  const yoursCount = yours.length + raisedList.length;
  return (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={
        <div className="rq-now" onPointerEnter={clearDemo}>
          <section className="ah-now" data-testid="rail-yours" aria-labelledby="rq-yours">
            <h2 className="ah-rail-section-head rq-yours-head" id="rq-yours">
              Sinun vuorosi
              {yoursCount ? <span className="ah-rail-count ah-rail-count-attention">{yoursCount}</span> : null}
              {direction === C ? <PickRaised s={s} set={set} quiet={[...quiet, ...lists(direction, s).raisedList]} /> : null}
            </h2>
            {yours.length ? <div className="rq-list">{yours.map((c) => row(c, 'yours'))}</div>
              : !raisedList.length ? <p className="ah-now-empty">Mikään ei odota sinua.</p> : null}
            {raisedList.length ? (
              // biome-ignore lint/a11y/useSemanticElements: a list group.
              <div className="ah-now-group rq-raised-group" role="group" aria-label="Nostamasi" data-testid="raised-group">
                <h3 className="ah-now-group-head rq-raised-head"><span className="ah-now-group-name">Nostamasi</span><span className="ah-rail-count">{raisedList.length}</span></h3>
                <div className="rq-list">{raisedList.map((c) => row(c, 'raised'))}</div>
              </div>
            ) : null}
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
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" hint={running.length ? {kind: 'working', count: 2, text: '2 työssä'} : undefined} />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" hint={yoursCount ? {kind: 'attention', count: yoursCount, text: `${yoursCount} odottaa sinua`} : undefined} />
    </WorkspaceRail>
  );
}

/** A's phone gesture: drag the row sideways past the threshold. Capture
 * phase, because the row's press handling stops pointer events. */
function Swipe({dir, label, run, children}: {dir: 'right' | 'left'; label: string; run: () => void; children: React.ReactNode}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{x: number; y: number} | null>(null);
  const moved = useRef(false);
  const past = Math.abs(dx) > 72;
  return (
    <div className="rq-swipe" data-dir={dir} data-past={past || undefined}
      onPointerDownCapture={(e) => { if (!phone()) return; start.current = {x: e.clientX, y: e.clientY}; moved.current = false; }}
      onPointerMoveCapture={(e) => {
        if (!start.current) return;
        const d = e.clientX - start.current.x;
        if (!moved.current && Math.abs(e.clientY - start.current.y) > Math.abs(d)) { start.current = null; return; }
        if (Math.abs(d) > 8) moved.current = true;
        if (moved.current) setDx(dir === 'right' ? Math.max(0, Math.min(140, d)) : Math.min(0, Math.max(-140, d)));
      }}
      onPointerUpCapture={() => { if (start.current && past) run(); start.current = null; setDx(0); }}
      onPointerCancelCapture={() => { start.current = null; setDx(0); }}
      onClickCapture={(e) => { if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; } }}>
      {dx ? <span className="rq-swipe-under" aria-hidden="true"><Icon name={dir === 'right' ? 'up' : 'down'} />{label}</span> : null}
      <div className="rq-swipe-row" style={{transform: dx ? `translateX(${dx}px)` : undefined}}>{children}</div>
    </div>
  );
}

/** C's + in the Sinun vuorosi heading: tick quiet conversations to raise. */
function PickRaised({s, set, quiet}: {s: State; set: React.Dispatch<React.SetStateAction<State>>; quiet: Conv[]}) {
  const head = useRef<HTMLSpanElement>(null);
  const [term, setTerm] = useState('');
  const shown = quiet.filter((c) => c.title.toLocaleLowerCase('fi').includes(term.toLocaleLowerCase('fi')));
  return (
    <span className="rq-pick" ref={head}>
      <DialogTrigger>
        <ControlButton data-testid="raise-pick" size="inline" variant="quiet" presentation="pill" aria-label="Nosta Hiljaisista" title="Nosta Hiljaisista">
          <Icon name="plus" />
        </ControlButton>
        <Popover triggerRef={head} placement="bottom end" offset={4} className="ah-popover rq-pick-popover">
          <AriaDialog className="rq-pick-dialog" data-testid="raise-dialog" aria-label="Nosta Hiljaisista">
            {({close}) => (
              <>
                <p className="rq-pick-title">Nosta Hiljaisista</p>
                <TextField label="Hae" value={term} onChange={setTerm} />
                <div className="rq-pick-list">
                  {shown.map((c) => (
                    <Checkbox key={c.id} data-testid={`pick-${c.id}`} label={s.names.get(c.id) ?? c.title} hint={c.wsName}
                      checked={s.raised.has(c.id)}
                      onChange={(on) => set((x) => ({...x, raised: on ? new Map(x.raised).set(c.id, Date.now()) : without(x.raised, c.id)}))} />
                  ))}
                  {!shown.length ? <p className="ah-now-empty">Ei hiljaisia keskusteluja.</p> : null}
                </div>
                <div className="rq-pick-foot">
                  <Button data-testid="raise-done" label="Valmis" variant="secondary" size="row" onPress={close} />
                </div>
              </>
            )}
          </AriaDialog>
        </Popover>
      </DialogTrigger>
    </span>
  );
}

/** C counts the raised apart in the same production row's markup. */
function CountedRow({replies, raised, onStart}: {replies: AgentNavModel[]; raised: AgentNavModel[]; onStart: () => void}) {
  if (!replies.length && !raised.length) return null;
  const title = [replies.length ? `${replies.length} odottaa sinua` : '', raised.length ? `${raised.length} ${raised.length === 1 ? 'nostamasi' : 'nostamaasi'}` : ''].filter(Boolean).join(' · ');
  return (
    <div className="ah-next-waiting" data-testid="next-waiting" data-waiting={replies.length + raised.length}>
      <button type="button" className="ah-next-open" data-testid="next-open" onClick={onStart} title="Avaa seuraava (Alt+↓)">
        <span className="ah-next-label">Sillä aikaa</span>
        <span className="ah-next-ball" aria-hidden="true" />
        <span className="ah-next-title">{title}</span>
        <span className="ah-next-det">{[...replies, ...raised].map((a) => a.title).join(', ')}</span>
        <span className="ah-next-go">Avaa seuraava <kbd>⌥↓</kbd></span>
      </button>
    </div>
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
  const [s, set] = useState(() => initial(direction));
  const [draft, setDraft] = useState('');
  const [demoHover, setDemoHover] = useState(direction === A);
  const location = useLocation();
  const navigate = useNavigate();
  const current = new URLSearchParams(location.search).get('conversation') ?? 'kesa';
  const conv = byId.get(current)!;
  // Opening is seeing: a reply is handled, and in A (like a reply) so is a
  // raise. Leaving the conversation closes the Sillä aikaa row.
  useEffect(() => {
    set((x) => ({
      ...x,
      replies: minus(x.replies, current),
      raised: direction === A ? without(x.raised, current) : x.raised,
      windowFor: x.windowFor === current ? x.windowFor : null,
    }));
  }, [current, direction]);
  const {queue, yours, raisedList} = lists(direction, s);
  const toModel = (c: Conv): AgentNavModel => ({agentId: c.id, href: `/workspaces/${c.ws}?conversation=${c.id}`, title: s.names.get(c.id) ?? c.title, activityLabel: '', controlLabel: ''});
  const others = queue.filter((c) => c.id !== current);
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
  const up = s.raised.has(current) && !s.replies.has(current);
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
  const headerMenu = direction === B ? (
    <Menu label="Keskustelun toiminnot" trigger={<Icon name="more" />} triggerPresentation="icon" triggerClassName="ah-header-more rq-header-more" triggerTestId="rq-conversation-menu" placement="bottom end"
      heading={<p className="ah-header-full-title">{title}</p>}
      items={[
        {id: 'rename', label: 'Nimeä uudelleen'},
        up ? {id: 'lower', label: 'Ei nyt', description: 'Takaisin Hiljaisiin'}
          : {id: 'raise', label: 'Nosta Sinun vuoroosi', description: 'Odottaa siellä, kunnes vastaat',
            availability: working ? {state: 'disabled', reason: 'Agentti on työssä'} : s.replies.has(current) ? {state: 'disabled', reason: 'Odottaa jo sinua'} : undefined},
        {id: 'details', label: 'Tiedot'},
      ]}
      onAction={(id) => {
        if (id === 'raise') set((x) => ({...x, raised: new Map(x.raised).set(current, Date.now())}));
        if (id === 'lower') set((x) => ({...x, raised: without(x.raised, current)}));
      }} />
  ) : undefined;
  const banner = !bannerOpen ? null : direction === C
    ? <CountedRow replies={yours.filter((c) => c.id !== current).map(toModel)} raised={raisedList.filter((c) => c.id !== current).map(toModel)} onStart={() => navigate(toModel(first).href)} />
    : <NextWaitingRow waiting={others.map(toModel)} onStart={() => navigate(toModel(first).href)} />;
  // B and C keep a raised conversation while it is open; say so there.
  const note = (direction === B || direction === C) && up && !working ? (
    <div className="rq-note-wrap">
      <p className="rq-note" data-testid="raised-note">
        <Icon name="up" />
        <span>Nostit tämän Sinun vuoroosi. Se odottaa siellä, kunnes vastaat.</span>
        <Button data-testid="note-lower" label="Ei nyt" variant="quiet" size="row" onPress={() => set((x) => ({...x, raised: without(x.raised, current)}))} />
      </p>
    </div>
  ) : null;
  return (
    <AppShell mobileTitle={title} navigationBadge={yours.length + raisedList.length}
      rail={<Rail direction={direction} s={s} set={set} current={current} demoHover={demoHover} clearDemo={() => setDemoHover(false)} />}
      main={
        <div className="ah-state">
          <ConversationFrame>
            <AgentHeader title={title} workspaceLabel={conv.wsName} workspaceHref={`/workspaces/${conv.ws}`}
              activityLabel={working ? 'Työssä' : ''} activityAnimated={working} activityKind={working ? 'working' : 'neutral'}
              controlLabel="" detailsExpanded={false} onToggleDetails={noop} terminal={headerMenu} rename={{onSave: async () => {}}} />
            <ConversationStream>
              <ConversationTimeline key={current} state="ready" items={items.map(render)} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
            </ConversationStream>
            {note}
            {banner}
            <Composer value={draft} onChange={setDraft} activity={working ? 'working' : 'idle'} selectedWorkingMode="steer"
              onModeChange={noop} onSendNow={(t) => send(t ?? draft)} onSteer={(t) => send(t ?? draft)} onFollowUp={(t) => send(t ?? draft)}
              onInterrupt={noop} sources={sources} csrf="prototype"
              modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
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
        <strong>Nosta Hiljaisista</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => setGeneration((g) => g + 1)}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_a?conversation=kesa']}>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
