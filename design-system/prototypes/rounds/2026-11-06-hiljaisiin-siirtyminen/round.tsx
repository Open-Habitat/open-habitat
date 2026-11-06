import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Menu} from '../../../../web/src/components/Overlays';
import {Icon} from '../../../../web/src/components/Icon';
import {Button} from '../../../../web/src/components/Primitives';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-quiet-transition-triggers. Today a finished reply enters Sinun
// vuorosi, and the moment its conversation is shown in a visible tab this
// browser counts it seen and the row drops to Hiljaiset; only a new reply or
// question brings it back. The axis is what moves a conversation between the
// two: A only replying (or Ei nyt) clears it, B only reading clears it, C
// opening clears it as today but an unanswered one comes back after a time.
// One scripted day is replayed under each rule; the strip at the top shows
// where three conversations were at each moment. Rail, rows, header,
// composer and menu are the production components; the reason line under a
// row, the ring ball, the note above the composer and the day strip are the
// round's. Everything is synthetic.
const directions = ['Nyt', 'A Vastaus', 'B Luku', 'C Paluu'];
const LINES = [
  'Nyt: avaaminen kuittaa heti, kun keskustelu näkyy, vaikka vilkaisisit vain sekunnin. Takaisin Sinun vuoroosi vain agentin uudesta vastauksesta tai kysymyksestä.',
  'A Vastaus: Sinun vuorosi pysyy, kunnes vastaat agentille tai valitset Ei nyt. Avaaminen vain sammuttaa pallon renkaaksi (Luettu). Takaisin agentin uudesta vastauksesta.',
  'B Luku: kuittaa vasta luettu: auki 20 s ja vastauksen loppu näkyi. Vilkaisu jää Sinun vuoroosi, ja luettu siirtyy Hiljaisiin vasta kun poistut. Takaisin agentin uudesta vastauksesta.',
  'C Paluu: avaaminen kuittaa kuten nyt, mutta vastaamatta jätetty palaa Sinun vuoroosi 2 tunnin päästä (Palasi). Avoin keskustelu kertoo milloin, ja ajan voi vaihtaa.',
];
const NYT = 0, A = 1, B = 2, C = 3;
const READ_SECONDS = 20;
const RETURN_AFTER = 2 * 60;

const DAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
const at = (h: number, m: number) => DAY + (h * 60 + m) * 60000;
const clock = (t: number) => { const d = new Date(t); return `${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`; };
const later = (t: number) => (t - DAY >= 24 * 3600000 ? `huomenna ${clock(t)}` : clock(t));

type Item = {id: string; kind: 'user' | 'assistant'; text: string; time: string; streaming?: boolean};
type Conv = {id: string; title: string; ws: string; wsName: string; changed: number; history: Item[]};
const u = (id: string, time: string, text: string): Item => ({id, kind: 'user', time, text});
const r = (id: string, time: string, text: string): Item => ({id, kind: 'assistant', time, text});
// Catalog order, which Sinun vuorosi keeps today.
const CONVS: Conv[] = [
  {id: 'kesa', title: 'Kesäajan virhe', ws: 'ws_a', wsName: 'aurinkokello', changed: at(9, 14), history: [
    u('k1', '9.12', 'Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat.'),
    r('k2', '9.14', 'Ajoin testit: 41 läpi, 2 epäonnistui. Molemmat ovat kesäajan testejä.'),
  ]},
  {id: 'nda', title: 'NDA-viestin tarkistus', ws: 'ws_m', wsName: 'muistiinpanot', changed: at(9, 2), history: [
    u('n1', '9.02', 'Lue liitteen NDA ja kerro, mitä siinä pitää muuttaa ennen allekirjoitusta.'),
  ]},
  {id: 'lasku', title: 'Laskun muistutus', ws: 'ws_m', wsName: 'muistiinpanot', changed: at(9, 4), history: [
    u('l1', '9.04', 'Kirjoita kohtelias muistutus erääntyneestä laskusta 2026-114.'),
  ]},
  {id: 'contoso', title: 'Contosoin tapaaminen', ws: 'ws_m', wsName: 'muistiinpanot', changed: at(7, 12), history: [
    u('v1', '7.10', 'Kokoa eilisen Contoso-tapaamisen muistiinpanoista avoimet asiat.'),
    r('v2', '7.12', 'Avoimia on kolme: hinnoittelu pilotin jälkeen, kuka omistaa palvelimen ja milloin seuraava katselmointi on.'),
  ]},
  {id: 'kuvat', title: 'Etusivun kuvat', ws: 'ws_k', wsName: 'kotisivu', changed: at(4, 31), history: [
    u('e1', '4.20', 'Pienennä etusivun kuvat ja lisää niille alt-tekstit.'),
    r('e2', '4.31', 'Pienensin kuusi kuvaa (4,1 Mt → 620 kt) ja kirjoitin alt-tekstit.'),
  ]},
  {id: 'testit', title: 'Testien siivous', ws: 'ws_a', wsName: 'aurinkokello', changed: at(9, 0) - 3 * 86400000, history: [
    u('t1', 'ma', 'Poista testeistä vanhat kiintoarvot.'),
    r('t2', 'ma', 'Poistin 14 kiintoarvoa ja korvasin ne fixtureilla. Testit menevät läpi.'),
  ]},
];
const byId = new Map(CONVS.map((c) => [c.id, c]));
const REPLIES: Record<string, Item> = {
  lasku: r('l2', '9.10', 'Tässä luonnos:\n\n> Hei, muistutamme laskusta 2026-114 (eräpäivä 20.10.). Jos maksu on jo lähtenyt, tämä viesti on aiheeton. Ystävällisin terveisin, Jari\n\nLiitin laskun numeron ja eräpäivän.'),
  nda: r('n2', '9.16', 'Kaksi kohtaa kannattaa muuttaa ennen allekirjoitusta.\n\n1. **Salassapito on ikuinen** (kohta 4). Ehdota viittä vuotta; se on tavallinen ja heidän juristinsa tuskin vastustaa.\n2. **Kohta 7 siirtää kaikki immateriaalioikeudet heille**, myös sinun aiemmat työsi. Rajaa se tähän hankkeeseen tehtyyn.\n\nLuonnos vastaukseksi on valmiina. Lähetänkö sen sinun nimissäsi, vai haluatko muokata sitä ensin?'),
  kesa: r('k4', '9.41', 'Korjasin kesäajan zoneinfolla. Molemmat testit menevät nyt läpi, ja lisäsin testin talviajan siirtymälle. Haluatko, että teen tästä PR:n?'),
};
const SENT: Record<string, string> = {
  kesa: 'Korjaa kesäaika zoneinfolla, älä lisää tunteja käsin.',
  nda: 'Ehdota viittä vuotta ja rajaa kohta 7 tähän hankkeeseen. Lähetä luonnos minulle ensin.',
};

// ---- The rules ----
type Place = 'yours' | 'running' | 'quiet';
/** new: unread reply; read (A): opened, not replied; reading/done (B): open
 * now, under or over the reading time; glanced (B): left before reading;
 * returned (C): back after the time. */
type Mark = 'new' | 'read' | 'reading' | 'done' | 'glanced' | 'returned';
type CS = {place: Place; mark?: Mark; returnAt?: number; never?: boolean; leftAt?: number; glance?: number; changed: number};
type World = {t: number; current: string; visible: boolean; dwell: number; conv: Record<string, CS>; extra: Record<string, Item[]>};
type Ev =
  | {k: 'clock'; t: number}
  | {k: 'reply'; id: string; item?: Item}
  | {k: 'open'; id: string; dwell?: number}
  | {k: 'leave'; dwell: number; end: boolean}
  | {k: 'send'; id: string; text: string; time: string}
  | {k: 'hide'} | {k: 'show'}
  | {k: 'notNow'; id: string}
  | {k: 'returnAt'; id: string; at?: number};

function start(): World {
  return {
    t: at(9, 0), current: 'kesa', visible: true, dwell: 600, extra: {},
    conv: Object.fromEntries(CONVS.map((c) => [c.id, {place: 'quiet', changed: c.changed} as CS])),
  };
}
/** The conversation is in front of the person in a visible tab. */
function see(d: number, w: World, id: string) {
  const c = w.conv[id];
  if (c.place !== 'yours') return;
  if (d === NYT) w.conv[id] = {place: 'quiet', changed: c.changed};
  if (d === A && c.mark !== 'read') w.conv[id] = {...c, mark: 'read'};
  if (d === B) w.conv[id] = {...c, mark: w.dwell >= READ_SECONDS ? 'done' : 'reading'};
  if (d === C) w.conv[id] = {place: 'quiet', changed: c.changed, leftAt: w.t, returnAt: w.t + RETURN_AFTER * 60000};
}
function apply(d: number, w0: World, e: Ev): World {
  const w: World = {...w0, conv: {...w0.conv}, extra: {...w0.extra}};
  const c = e.k === 'reply' || e.k === 'send' || e.k === 'notNow' || e.k === 'returnAt' ? w.conv[e.id] : undefined;
  switch (e.k) {
    case 'clock':
      w.t = e.t;
      if (d === C) for (const [id, x] of Object.entries(w.conv))
        if (x.place === 'quiet' && x.returnAt !== undefined && x.returnAt <= w.t)
          w.conv[id] = {place: 'yours', mark: 'returned', leftAt: x.leftAt, changed: x.changed};
      break;
    case 'reply': {
      const item = e.item ?? REPLIES[e.id];
      if (item) w.extra[e.id] = [...(w.extra[e.id] ?? []), item];
      w.conv[e.id] = {place: 'yours', mark: 'new', changed: w.t};
      if (w.current === e.id && w.visible) see(d, w, e.id);
      break;
    }
    case 'open':
      w.current = e.id; w.visible = true; w.dwell = e.dwell ?? 0;
      see(d, w, e.id);
      break;
    case 'leave': {
      const x = w.conv[w.current];
      if (d === B && (x.mark === 'reading' || x.mark === 'done'))
        w.conv[w.current] = e.dwell >= READ_SECONDS && e.end
          ? {place: 'quiet', changed: x.changed}
          : {...x, mark: 'glanced', glance: e.dwell};
      break;
    }
    case 'send':
      w.extra[e.id] = [...(w.extra[e.id] ?? []), u(`s-${e.id}-${(w.extra[e.id] ?? []).length}`, e.time, e.text)];
      w.conv[e.id] = {place: 'running', changed: w.t};
      break;
    case 'hide': w.visible = false; break;
    case 'show': w.visible = true; see(d, w, w.current); break;
    case 'notNow': w.conv[e.id] = {place: 'quiet', changed: c!.changed}; break;
    case 'returnAt': w.conv[e.id] = {...c!, returnAt: e.at, never: e.at === undefined}; break;
  }
  return w;
}

// ---- The day ----
type Step = {time: string; label: string; scene: string; ev: Ev[]};
const STEPS: Step[] = [
  {time: '9.16', label: 'Kaksi vastausta', scene: 'Agentti valmistui kahdessa keskustelussa: Laskun muistutus ja NDA-viestin tarkistus odottavat sinua. Kesäajan virhe on auki edessäsi.',
    ev: [{k: 'clock', t: at(9, 10)}, {k: 'reply', id: 'lasku'}, {k: 'clock', t: at(9, 16)}, {k: 'reply', id: 'nda'}]},
  {time: '9.20', label: 'Avaat NDA:n', scene: 'Avaat NDA-viestin tarkistuksen ja alat lukea agentin vastausta.',
    ev: [{k: 'clock', t: at(9, 20)}, {k: 'leave', dwell: 600, end: true}, {k: 'open', id: 'nda'}]},
  {time: '9.20', label: 'Kiire muualle', scene: '12 sekunnin päästä puhelin soi. Siirryt kiireesti Kesäajan virheeseen ja lähetät sinne viestin. NDA:han et vastannut etkä lukenut sitä loppuun.',
    ev: [{k: 'leave', dwell: 12, end: false}, {k: 'open', id: 'kesa'}, {k: 'send', id: 'kesa', text: SENT.kesa, time: '9.20'}]},
  {time: '9.25', label: 'Luet Laskun', scene: 'Avaat Laskun muistutuksen ja luet agentin luonnoksen kokonaan (2 min).',
    ev: [{k: 'clock', t: at(9, 25)}, {k: 'leave', dwell: 300, end: true}, {k: 'open', id: 'lasku', dwell: 120}]},
  {time: '9.27', label: 'Takaisin', scene: 'Kopioit luonnoksen sähköpostiin ja palaat Kesäajan virheeseen. Laskun agentille ei tarvitse vastata.',
    ev: [{k: 'clock', t: at(9, 27)}, {k: 'leave', dwell: 120, end: true}, {k: 'open', id: 'kesa'}]},
  {time: '9.30', label: 'Kokoukseen', scene: 'Lähdet kokoukseen. Selain jää auki Kesäajan virheeseen, mutta välilehti ei ole näkyvissä.',
    ev: [{k: 'clock', t: at(9, 30)}, {k: 'hide'}]},
  {time: '11.30', label: 'Yhä kokouksessa', scene: 'Kesäajan virheen agentti valmistui 9.41, kun et ollut paikalla. Olet yhä kokouksessa.',
    ev: [{k: 'clock', t: at(9, 41)}, {k: 'reply', id: 'kesa'}, {k: 'clock', t: at(11, 30)}]},
  {time: '12.40', label: 'Palaat koneelle', scene: 'Palaat koneelle. Kesäajan virhe on yhä auki edessäsi. Mitä sivupalkki muistuttaa aamusta?',
    ev: [{k: 'clock', t: at(12, 40)}, {k: 'show'}]},
  {time: '12.42', label: 'Vastaat NDA:han', scene: 'Luit Kesäajan virheen vastauksen. Avaat NDA-viestin tarkistuksen, luet sen ja vastaat agentille.',
    ev: [{k: 'clock', t: at(12, 42)}, {k: 'leave', dwell: 120, end: true}, {k: 'open', id: 'nda', dwell: 60}, {k: 'send', id: 'nda', text: SENT.nda, time: '12.42'}]},
];
const DEFAULT_STEP = 7;
const TRACKED = ['nda', 'lasku', 'kesa'];
function replay(d: number, upTo: number) {
  let w = start();
  for (let i = 0; i <= upTo; i++) for (const e of STEPS[i].ev) w = apply(d, w, e);
  return w;
}

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'aurinkokello',
};

/** What a row's mark says, under the row and in its tooltip. */
function why(c: CS): string | undefined {
  if (c.place === 'yours') {
    if (c.mark === 'read') return 'Luettu · odottaa vastaustasi';
    if (c.mark === 'reading') return 'Luet nyt';
    if (c.mark === 'done') return 'Luettu · siirtyy Hiljaisiin, kun poistut';
    if (c.mark === 'glanced') return `Vilkaisit ${c.glance} s · ei luettu`;
    if (c.mark === 'returned') return `Palasi · et vastannut ${c.leftAt ? clock(c.leftAt) : ''}`.trim();
  }
  if (c.place === 'quiet' && c.returnAt !== undefined) return `Palaa Sinun vuoroosi ${later(c.returnAt)}`;
  return undefined;
}
/** The day strip's word for a place. */
function word(c: CS): string {
  if (c.place === 'running') return 'Käynnissä';
  if (c.place === 'quiet') return c.returnAt !== undefined ? `Hiljaiset · palaa ${clock(c.returnAt)}` : 'Hiljaiset';
  return {new: 'Uusi vastaus', read: 'Luettu', reading: 'Luet', done: 'Luettu', glanced: 'Vilkaistu', returned: 'Palasi'}[c.mark ?? 'new'];
}
const ring = (c: CS) => c.place === 'yours' && (c.mark === 'read' || c.mark === 'glanced' || c.mark === 'returned');

function Rail({w, act}: {w: World; act: (e: Ev) => void}) {
  const [quietFolded, setQuietFolded] = useState(false);
  const live = CONVS;
  const yours = live.filter((c) => w.conv[c.id].place === 'yours');
  const running = live.filter((c) => w.conv[c.id].place === 'running');
  const quiet = live.filter((c) => w.conv[c.id].place === 'quiet').sort((a, b) => w.conv[b.id].changed - w.conv[a.id].changed);
  const row = (c: Conv, place: Place) => {
    const s = w.conv[c.id];
    const reason = why(s);
    const label = place === 'running' ? 'Työssä' : place === 'yours' ? (reason ?? 'Uusi vastaus') : 'Odottaa viestiä';
    const m: AgentNavModel = {
      agentId: c.id, href: `/workspaces/${c.ws}?conversation=${c.id}`, title: c.title,
      workspaceId: c.ws, workspaceName: c.wsName, changedAt: s.changed,
      activity: place === 'running' ? 'working' : 'waiting', activityLabel: label, controlLabel: '',
      attentionLabel: place === 'yours' ? label : undefined,
      detail: [c.wsName, label, place === 'quiet' ? reason : undefined].filter(Boolean).join(' · '), selected: w.current === c.id,
    };
    return (
      <div key={c.id} className="tq-slot" data-place={place} data-mark={s.mark} data-ring={ring(s) || undefined} data-testid={`slot-${c.id}`}>
        <ul><AgentNavItem {...m} now={w.t} /></ul>
        {reason ? <p className="tq-why" data-testid={`why-${c.id}`}>{reason}</p> : null}
      </div>
    );
  };
  const groups = [...new Set(running.map((c) => c.wsName))].sort((a, b) => a.localeCompare(b, 'fi'));
  const hint = (ws: string) => {
    const n = yours.filter((c) => c.ws === ws).length;
    const k = running.filter((c) => c.ws === ws).length;
    return n ? {kind: 'attention' as const, count: n, text: `${n} odottaa sinua`} : k ? {kind: 'working' as const, count: k, text: `${k} työssä`} : undefined;
  };
  return (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={
        <div className="tq-now">
          <section className="ah-now" data-testid="rail-yours" aria-labelledby="tq-yours">
            <h2 className="ah-rail-section-head" id="tq-yours">
              Sinun vuorosi
              {yours.length ? <span className="ah-rail-count ah-rail-count-attention">{yours.length}</span> : null}
            </h2>
            {yours.length ? <div className="tq-list">{yours.map((c) => row(c, 'yours'))}</div>
              : <p className="ah-now-empty">Mikään ei odota sinua.</p>}
          </section>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="tq-running">
            <h2 className="ah-rail-section-head" id="tq-running">Käynnissä{running.length ? <span className="ah-rail-count">{running.length}</span> : null}</h2>
            {running.length ? null : <p className="ah-now-empty">Mikään ei ole käynnissä.</p>}
            {groups.map((g) => (
              // biome-ignore lint/a11y/useSemanticElements: a list group.
              <div key={g} className="ah-now-group" role="group">
                <h3 className="ah-now-group-head"><span className="ah-now-group-name">{g}</span><span className="ah-rail-count">{running.filter((c) => c.wsName === g).length}</span></h3>
                <div className="tq-list">{running.filter((c) => c.wsName === g).map((c) => row(c, 'running'))}</div>
              </div>
            ))}
          </section>
          <section className="ah-now ah-quiet" data-testid="rail-quiet" data-folded={quietFolded || undefined} aria-labelledby="tq-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded={!quietFolded} onClick={() => setQuietFolded(!quietFolded)}>
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="tq-quiet">Hiljaiset</span>
                {quiet.length ? <span className="ah-rail-count">{quiet.length}</span> : null}
              </button>
            </h2>
            {quietFolded ? null : <div className="tq-list">{quiet.map((c) => row(c, 'quiet'))}</div>}
          </section>
        </div>
      }>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" hint={hint('ws_a')} />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" hint={hint('ws_k')} />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" hint={hint('ws_m')} />
    </WorkspaceRail>
  );
}

function render(item: Item) {
  const content = item.kind === 'user'
    ? <UserMessage sourceText={item.text} onCopy={noop} time={item.time}><Markdown text={item.text} /></UserMessage>
    : <AssistantMessage streamState={item.streaming ? 'streaming' : 'complete'} time={item.time} onCopy={noop}><Markdown text={item.text} /></AssistantMessage>;
  return {id: item.id, kind: item.kind, content: <div data-item={item.id}>{content}</div>};
}

/** Each direction's line above the composer: why the open conversation
 * stays or when it comes back. */
function Note({d, w, act}: {d: number; w: World; act: (e: Ev) => void}) {
  const c = w.conv[w.current];
  let text: string | undefined, icon: 'info' | 'check' | 'clock' = 'info', control: React.ReactNode = null;
  if (d === A && c.place === 'yours' && c.mark === 'read') {
    text = 'Pysyy Sinun vuorosissasi, kunnes vastaat agentille.';
    control = <Button data-testid="note-not-now" label="Ei nyt" variant="quiet" size="row" onPress={() => act({k: 'notNow', id: w.current})} />;
  }
  if (d === B && c.place === 'yours' && c.mark === 'reading') {
    text = `Luet tätä · ${Math.min(w.dwell, READ_SECONDS)}/${READ_SECONDS} s. Vilkaisu ei vielä kuittaa.`;
  }
  if (d === B && c.place === 'yours' && c.mark === 'done') {
    text = 'Luettu. Siirtyy Hiljaisiin, kun poistut.';
    icon = 'check';
  }
  if (d === C && c.place === 'quiet' && (c.returnAt !== undefined || c.never)) {
    text = c.never ? 'Ei palaa Sinun vuoroosi, ellei agentti vastaa.' : `Palaa Sinun vuoroosi ${later(c.returnAt!)}, jos et vastaa.`;
    icon = 'clock';
    control = (
      <Menu label="Muuta" trigger="Muuta" triggerTestId="note-return-menu" placement="top end"
        items={[
          {id: '60', label: 'Tunnin päästä'},
          {id: '120', label: '2 tunnin päästä', description: 'Oletus'},
          {id: 'morning', label: 'Huomenna klo 9'},
          {id: 'never', label: 'Ei palaa'},
        ]}
        onAction={(id) => act({k: 'returnAt', id: w.current, at: id === 'never' ? undefined : id === 'morning' ? at(24 + 9, 0) : w.t + Number(id) * 60000})} />
    );
  }
  if (!text) return null;
  return (
    <div className="tq-note-wrap">
      <p className="tq-note" data-testid="note">
        <Icon name={icon} />
        <span>{text}</span>
        {control}
      </p>
    </div>
  );
}

/** The scripted day: one column per moment, one row per tracked
 * conversation, each cell where that conversation was then. */
function Day({d, step, go}: {d: number; step: number; go: (i: number) => void}) {
  const worlds = useMemo(() => STEPS.map((_, i) => replay(d, i)), [d]);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cell = strip.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (cell && strip.current) strip.current.scrollLeft = Math.max(0, cell.offsetLeft - strip.current.clientWidth / 2 + cell.offsetWidth / 2);
  }, [step]);
  return (
    <div className="tq-day" data-testid="day">
      <div className="tq-day-nav">
        <button type="button" className="tq-step-move" data-testid="step-prev" aria-label="Edellinen hetki" disabled={step <= 0} onClick={() => go(step - 1)}>‹</button>
        <p className="tq-scene" data-testid="scene"><strong>klo {STEPS[step].time}</strong> {STEPS[step].scene}</p>
        <button type="button" className="tq-step-move" data-testid="step-next" aria-label="Seuraava hetki" disabled={step >= STEPS.length - 1} onClick={() => go(step + 1)}>›</button>
      </div>
      <div className="tq-strip" ref={strip}>
        <table className="tq-band">
          <thead>
            <tr>
              <th scope="col" className="tq-band-corner">Päivä</th>
              {STEPS.map((s, i) => (
                <th key={i} scope="col" data-step={i} aria-current={i === step ? 'step' : undefined}>
                  <button type="button" data-testid={`step-${i}`} onClick={() => go(i)}><time>{s.time}</time><span>{s.label}</span></button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRACKED.map((id) => (
              <tr key={id}>
                <th scope="row">{byId.get(id)!.title}</th>
                {worlds.map((w, i) => {
                  const c = w.conv[id];
                  return (
                    <td key={i} data-step={i} data-place={c.place} data-ring={ring(c) || undefined} aria-current={i === step ? 'step' : undefined} data-testid={`cell-${id}-${i}`}>
                      <span className="tq-cell"><span className="tq-ball" aria-hidden="true" /><span className="tq-word">{word(c)}</span></span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

let reviewTheme = 'light';

function Main({d, step}: {d: number; step: number}) {
  const [w, setW] = useState(() => replay(d, step));
  const [draft, setDraft] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const wRef = useRef(w);
  wRef.current = w;
  const act = (e: Ev) => setW((x) => apply(d, x, e));
  const routed = new URLSearchParams(location.search).get('conversation');
  // The script's moment opens its conversation; a click in the rail leaves
  // the current one after the time it was in front of the person.
  useEffect(() => {
    if (!routed || routed === wRef.current.current) return;
    setW((x) => apply(d, apply(d, x, {k: 'leave', dwell: x.dwell, end: true}), {k: 'open', id: routed}));
  }, [routed, d]);
  useEffect(() => {
    const c = byId.get(w.current)!;
    if (routed !== w.current) navigate(`/workspaces/${c.ws}?conversation=${c.id}`, {replace: true});
  }, [w.current]); // eslint-disable-line react-hooks/exhaustive-deps
  // Time in front of the conversation counts toward B's reading.
  useEffect(() => {
    if (d !== B) return;
    const timer = window.setInterval(() => setW((x) => {
      if (!x.visible) return x;
      const next = {...x, dwell: x.dwell + 1, conv: {...x.conv}};
      const c = next.conv[x.current];
      if (c.place === 'yours' && c.mark === 'reading' && next.dwell >= READ_SECONDS) next.conv[x.current] = {...c, mark: 'done'};
      return next;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [d]);
  const conv = byId.get(w.current)!;
  const cs = w.conv[w.current];
  const working = cs.place === 'running';
  const send = (text: string) => {
    if (!text.trim()) return;
    const id = w.current;
    act({k: 'send', id, text, time: clock(w.t)});
    setDraft('');
    // The agent answers a moment later in the review.
    window.setTimeout(() => setW((x) => x.conv[id].place === 'running'
      ? apply(d, x, {k: 'reply', id, item: r(`a${Date.now()}`, clock(x.t), 'Tein sen. Kerro, jos haluat muuttaa jotain.')}) : x), 2500);
  };
  const items = [...conv.history, ...(w.extra[w.current] ?? [])];
  if (working) items.push({id: 'live', kind: 'assistant', time: '', text: 'Katson tätä nyt…', streaming: true});
  const yoursCount = CONVS.filter((c) => w.conv[c.id].place === 'yours').length;
  return (
    <AppShell mobileTitle={conv.title} navigationBadge={yoursCount}
      rail={<Rail w={w} act={act} />}
      main={
        <div className="ah-state">
          <ConversationFrame>
            <AgentHeader title={conv.title} workspaceLabel={conv.wsName} workspaceHref={`/workspaces/${conv.ws}`}
              activityLabel={working ? 'Työssä' : ''} activityAnimated={working} activityKind={working ? 'working' : 'neutral'}
              controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{onSave: async () => {}}} />
            <ConversationStream>
              <ConversationTimeline key={w.current} state="ready" items={items.map(render)} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
            </ConversationStream>
            <Note d={d} w={w} act={act} />
            <Composer value={draft} onChange={setDraft} activity={working ? 'working' : 'idle'} selectedWorkingMode="steer"
              onModeChange={noop} onSendNow={(t) => send(t ?? draft)} onSteer={(t) => send(t ?? draft)} onFollowUp={(t) => send(t ?? draft)}
              onInterrupt={noop} sources={sources} csrf="prototype"
              modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
          </ConversationFrame>
        </div>
      } />
  );
}

function App({d}: {d: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [step, setStep] = useState(DEFAULT_STEP);
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
  const go = (i: number) => { setStep(i); setGeneration((g) => g + 1); };
  const first = byId.get(replay(d, step).current)!;
  return (
    <div className={`tq-review variant-${d}`} data-direction={d} data-step={step}>
      <header className="tq-bar" ref={bar}>
        <div className="tq-bar-top">
          <strong>Sinun vuorosi ↔ Hiljaiset</strong>
          <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
            <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
          <button type="button" data-testid="tq-reset" onClick={() => go(DEFAULT_STEP)}>Alusta</button>
        </div>
        <ol className="tq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === d ? 'true' : undefined}>{l}</li>)}
        </ol>
        <Day d={d} step={step} go={go} />
      </header>
      <div className="tq-stage">
        <MemoryRouter key={generation} initialEntries={[`/workspaces/${first.ws}?conversation=${first.id}`]}>
          <Main d={d} step={step} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, d) => () => <App key={d} d={d} />);
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
