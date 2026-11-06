import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage, WaitingMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {InlineTextSetting} from '../../../../web/src/components/InlineTextSetting';
import {NumberStepper} from '../../../../web/src/components/NumberStepper';
import {Select} from '../../../../web/src/components/Primitives';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {WarningBanner} from '../../../../web/src/components/WarningBanner';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings, AccountShelf} from '../../../../web/src/components/Account';
import {AccountPreferencesProvider} from '../../../../web/src/app/accountPreferences';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {pendingConversationText} from '../../../../web/src/text/pendingConversation';
import {statusText} from '../../../../web/src/text/status';
import settingsPaths from '../../../../internal/uiroutes/settings.json';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const pending = liveText(pendingConversationText);
const rail = liveText(statusText).rail;

// proto-live-conversation-limit-setting, round 3. Jari 6.11. chose round 2's
// Työtiloittain list and asked for Muuta rajaa greyed out for ordinary users
// and marked "(ylläpitäjä)" for the administrator, and for the
// administrator's server view: an installation-wide limit that may go above
// the daemon's own 32, and per-person exceptions. The refusal card is now one
// design; the axis is the administrator's section in the server area
// (production behind its experiment, server-settings-own-area): every person
// in a table as Levytila has it, only the exceptions, or memory first with
// steppers. Rail, header, timeline, composer, the settings page and its
// server area are production components; the round adds the Keskustelut
// link and section into that area. The host is a fetch stand-in.
const directions = ['1 Kaikki henkilöt', '2 Vain poikkeukset', '3 Muisti edellä'];
const LINES = [
  '1 Kaikki henkilöt: raja kentässä ja taulukko kaikista henkilöistä kuten Levytila: työssä nyt, raja (oletus tai oma) ja Muuta riviltä.',
  '2 Vain poikkeukset: raja kentässä ja lista vain niistä, joilla on oma raja; Lisää poikkeus valitsee henkilön. Ei henkilökohtaista käyttöä.',
  '3 Muisti edellä: ylhäällä palvelimen muisti nyt ja jos jokainen käyttää koko rajansa; raja ja jokaisen henkilön raja säätimillä, jotka päivittävät arvion heti.',
];
const COMMON = 'Kaikissa: kortti on kierroksen 2 Työtiloittain; Muuta rajaa (ylläpitäjä) vie Ylläpito › Keskustelut -osioon, tavalliselle käyttäjälle Muuta rajaa on harmaana. Raja saa olla yli 32 (enintään 128).';
type Viewer = 'admin' | 'person';

// ---- Conversations: what holds a place (pi_activity_linux.go) ----
// turn: a turn runs; question: Pi waits for the person's answer; processes:
// a background process Pi started still runs, though the turn has ended.
// since: minutes in that state; wrote: minutes since the person last wrote.
type Kind = 'turn' | 'question' | 'processes';
type Conv = {id: string; title: string; ws: string; wsName: string; kind?: Kind; since: number; wrote: number; process?: string};
const CONVS: Conv[] = [
  {id: 'dev', title: 'Kehityspalvelin', ws: 'ws_k', wsName: 'kotisivu', kind: 'processes', since: 130, wrote: 132, process: 'npm run dev'},
  {id: 'kuvat', title: 'Kuvien pakkaus', ws: 'ws_k', wsName: 'kotisivu', kind: 'processes', since: 25, wrote: 27, process: 'make images'},
  {id: 'julkaisu', title: 'Julkaisun muistiinpanot', ws: 'ws_k', wsName: 'kotisivu', kind: 'question', since: 48, wrote: 52},
  {id: 'saavutettavuus', title: 'Saavutettavuustarkistus', ws: 'ws_k', wsName: 'kotisivu', kind: 'turn', since: 6, wrote: 6},
  {id: 'lomake', title: 'Lomakkeen validointi', ws: 'ws_k', wsName: 'kotisivu', kind: 'turn', since: 2, wrote: 2},
  {id: 'tahdet', title: 'Tähtikartan data', ws: 'ws_a', wsName: 'aurinkokello', kind: 'processes', since: 220, wrote: 225, process: 'python fetch_stars.py'},
  {id: 'ruotsi', title: 'Käännökset ruotsiksi', ws: 'ws_a', wsName: 'aurinkokello', kind: 'question', since: 65, wrote: 70},
  {id: 'kesa', title: 'Kesäajan virhe', ws: 'ws_a', wsName: 'aurinkokello', kind: 'turn', since: 12, wrote: 14},
  {id: 'svg', title: 'Varjon piirto SVG:ksi', ws: 'ws_a', wsName: 'aurinkokello', kind: 'turn', since: 3, wrote: 3},
  {id: 'varmuus', title: 'Varmuuskopio', ws: 'ws_m', wsName: 'muistiinpanot', kind: 'processes', since: 55, wrote: 58, process: 'rsync -a kuvat/ nas:kuvat/'},
  {id: 'lukulista', title: 'Lukulista', ws: 'ws_m', wsName: 'muistiinpanot', kind: 'turn', since: 8, wrote: 9},
  {id: 'tunnit', title: 'Viikon tunnit', ws: 'ws_m', wsName: 'muistiinpanot', kind: 'turn', since: 1, wrote: 1},
  {id: 'teksti', title: 'Etusivun teksti', ws: 'ws_k', wsName: 'kotisivu', since: 300, wrote: 300},
  {id: 'kauppa', title: 'Kauppalista', ws: 'ws_m', wsName: 'muistiinpanot', since: 900, wrote: 900},
];
const byId = new Map(CONVS.map((c) => [c.id, c]));
const NEW_MESSAGE = 'Tee etusivulle tumma teema, joka seuraa järjestelmän asetusta.';
const HERE = 'kotisivu';
// The daemon's own default (pi_activity_linux.go), the ceiling the round
// assumes (create's 128-session bound), and the synthetic host's memory.
const HOST_DEFAULT = 32;
const MAX_LIMIT = 128;
const MIB_PER_CHILD = 210;
const SERVER_GIB = 16;
const minutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim());

// ---- Host stand-in: who is busy, the limits, one store for the round ----
type Person = {id: string; username: string; administrator: boolean; busy: number; limit: number | null};
const host = {
  busy: new Set<string>(), stopped: [] as string[], adminDefault: 12, direction: 0, viewer: 'admin' as Viewer,
  people: [] as Person[],
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
function resetHost(direction = host.direction) {
  host.direction = direction;
  host.busy = new Set(CONVS.filter((c) => c.kind).map((c) => c.id));
  host.stopped = [];
  host.adminDefault = 12;
  host.people = [
    {id: 'u1', username: 'maintainer', administrator: true, busy: 5, limit: null},
    {id: 'u2', username: 'kaisa', administrator: false, busy: 3, limit: null},
    {id: 'u3', username: 'ville', administrator: false, busy: 27, limit: 40},
    {id: 'u4', username: 'aino', administrator: false, busy: 1, limit: 4},
    {id: 'u5', username: 'mikko', administrator: false, busy: 0, limit: null},
    {id: 'u6', username: 'sanna', administrator: false, busy: 2, limit: null},
  ];
}
resetHost(0);
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const isAdmin = () => host.viewer === 'admin';
/** The person looking: maintainer as the administrator, kaisa otherwise. */
const me = () => host.people[isAdmin() ? 0 : 1];
/** The person's own number from the administrator, or the installation's. */
const limitOf = (p: Person) => p.limit ?? host.adminDefault;
const busyOf = (p: Person) => (p.id === me().id ? host.busy.size : p.busy);
const limitNow = () => limitOf(me());
const full = () => host.busy.size >= limitNow();
function stop(id: string) { host.busy.delete(id); if (!host.stopped.includes(id)) host.stopped.push(id); notify(); }
function setPersonLimit(id: string, limit: number | null) {
  host.people = host.people.map((x) => (x.id === id ? {...x, limit} : x));
  notify();
}

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GiB = 1024 ** 3;
const IDENTITY = 'wid_prototype';
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(60);
  // The server area is behind its experiment; the round turns it on.
  if (path === '/api/v1/account/preferences')
    return json({schema_version: 1, web_identity_id: IDENTITY, engine: 'codemirror6', language: 'fi', quiet_sort: 'newest', quiet_workspace: null,
      experimental: {'server-settings-own-area': true}});
  if (path === '/api/v1/server') return json({schema_version: 1, name: 'Synteettinen', administrator: isAdmin(), version: '0.0.0-proto'});
  if (path === '/api/v1/server/administration')
    return json({schema_version: 1, name: 'Synteettinen', default_language: 'fi', default_limit_bytes: 50 * GiB,
      users: host.people.map(({id, username, administrator}) => ({id, username, administrator}))});
  if (path === '/api/v1/server/storage')
    return json({schema_version: 1, limits: 'not_in_use', overcommitted: null,
      filesystem: {state: 'available', capacity_bytes: 500 * GiB, free_bytes: 320 * GiB, source: 'linux_statfs'}, users: []});
  if (path === '/api/v1/pi/models')
    return json({schema_version: 1, default_provider: 'claude-bridge', default_model: 'claude-sonnet-5', default_thinking: 'medium', catalog_status: 'native_cached',
      models: [{id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'claude-bridge'}]});
  if (path === '/api/v1/pi/credentials')
    return json({schema_version: 1, openai: {present: false, suffix: null}, anthropic: {present: false, suffix: null}, deepseek: {present: false, suffix: null}, subscription: {present: false}});
  if (path === '/api/v1/pi/claude-login') return json({schema_version: 1, state: 'completed'});
  return new Response('', {status: 404});
};

const noop = () => {};
const T0 = Date.UTC(2026, 10, 6, 8, 30);
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'kotisivu',
};

// ---- What holds a place: round 2's Työtiloittain, chosen ----
const kindWord = (c: Conv) => (c.kind === 'question' ? rail.asks : c.kind === 'processes' ? rail.background : rail.working);
const stopWord = (c: Conv) => (c.kind === 'processes' ? 'Pysäytä prosessi' : 'Pysäytä vuoro');
const kindTone = (k: Kind) => (k === 'question' ? 'warning' : k === 'turn' ? 'info' : 'neutral') as 'warning' | 'info' | 'neutral';
/** Rows still holding a place, plus the ones stopped in this view so the
 * person sees what they did. */
const shown = () => CONVS.filter((c) => host.busy.has(c.id) || host.stopped.includes(c.id));
const holding = () => CONVS.filter((c) => host.busy.has(c.id));
const workspaces = () => {
  const names = [...new Set(holding().map((c) => c.wsName))];
  const count = (w: string) => holding().filter((c) => c.wsName === w).length;
  return names.sort((a, b) => (a === HERE ? -1 : b === HERE ? 1 : count(b) - count(a)));
};

/** One row: what it is, what holds the place, the stop that frees it. */
function BusyRow({c, meta, onOpen}: {c: Conv; meta: React.ReactNode; onOpen: (c: Conv) => void}) {
  const gone = !host.busy.has(c.id);
  return (
    <li data-testid={`busy-${c.id}`} data-state={gone ? 'stopped' : c.kind}>
      <StatusMark label="" tone={gone ? 'neutral' : kindTone(c.kind!)} animated={!gone && c.kind === 'turn' ? 'running' : false} />
      <div className="rq-busy-text">
        <button type="button" className="rq-busy-title" onClick={() => onOpen(c)}>{c.title}</button>
        <span className="rq-busy-meta">{gone ? 'Pysäytetty · paikka vapautui' : meta}</span>
      </div>
      {gone ? <Icon name="check" className="rq-busy-ok" /> : (
        <ControlButton data-testid={`stop-${c.id}`} size="row" variant="secondary" onPress={() => stop(c.id)}>{stopWord(c)}</ControlButton>
      )}
    </li>
  );
}
const what = (c: Conv) => <>{kindWord(c)}{c.process ? <> <code>{c.process}</code></> : null}</>;
const ago = (m: number) => `kirjoitit ${minutes(m)} sitten`;

/** By workspace, this one first; within it the longest untouched first. */
function GroupedList({onOpen}: {onOpen: (c: Conv) => void}) {
  useHost();
  const rows = shown();
  const groups = [...new Set([...workspaces(), ...rows.map((c) => c.wsName)])].map((w) => ({
    id: w, head: `${w}${w === HERE ? ' (tämä työtila)' : ''} · ${rows.filter((c) => c.wsName === w && host.busy.has(c.id)).length}`,
    rows: rows.filter((c) => c.wsName === w).sort((a, b) => b.wrote - a.wrote)}));
  return (
    <div className="rq-groups" data-testid="busy-list">
      {groups.filter((g) => g.rows.length).map((g) => (
        <section key={g.id} className="rq-group" data-group={g.id}>
          <h3 className="rq-group-head">{g.head}</h3>
          <ul className="rq-busy">
            {g.rows.map((c) => <BusyRow key={c.id} c={c} onOpen={onOpen} meta={<>{what(c)} · {ago(c.wrote)}</>} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Count in words for the card: "Kaksitoista keskustelua". */
const NUMBERS = ['Nolla', 'Yksi', 'Kaksi', 'Kolme', 'Neljä', 'Viisi', 'Kuusi', 'Seitsemän', 'Kahdeksan', 'Yhdeksän', 'Kymmenen', 'Yksitoista', 'Kaksitoista'];
const many = (n: number) => `${NUMBERS[n] ?? n} keskustelu${n === 1 ? '' : 'a'}`;

/** Muuta rajaa: the administrator's, marked as such; greyed out for anyone
 * else, whom the card's sentence already tells who sets the limit. */
function AdminLimitButton({onAdmin}: {onAdmin: () => void}) {
  const h = useHost();
  if (h.viewer === 'admin')
    return <ControlButton data-testid="admin-limit" size="row" variant="quiet" onPress={onAdmin}>Muuta rajaa (ylläpitäjä)</ControlButton>;
  return <ControlButton data-testid="admin-limit" size="row" variant="quiet" isDisabled aria-describedby="rq-limit-sentence">Muuta rajaa</ControlButton>;
}

// ---- The refused new conversation: the moment the limit is met ----
type NewPhase = 'refused' | 'created';
function RefusalCard({phase, tries, onRetry, onWho, onAdmin}: {
  phase: NewPhase; tries: number; onRetry: () => void; onWho: (group?: string) => void; onAdmin: () => void;
}) {
  const h = useHost();
  if (phase === 'created') return null;
  const n = h.busy.size, limit = limitNow(), room = n < limit;
  const again = tries > 0 ? ' Yritit uudelleen: yhä täynnä.' : '';
  if (room)
    return (
      <aside className="ah-notice ah-tone-success rq-room" data-testid="creation-problem" data-state="room">
        <strong>Tilaa on nyt</strong>
        <p>{`${many(n)} työskentelee; rajasi on ${limit}. Viestisi on tallessa.`}</p>
        <div className="ah-actions">
          <ControlButton data-testid="retry" size="row" variant="primary" onPress={onRetry}>Aloita keskustelu</ControlButton>
        </div>
      </aside>
    );
  const busy = holding();
  const whose = me().limit === null ? `Ylläpitäjän asettama raja on ${limit}` : `Ylläpitäjä on antanut sinulle rajan ${limit}`;
  return (
    <aside className="ah-notice ah-tone-warning" data-testid="creation-problem" data-state="refused">
      <strong>{pending.conversationNotCreated}</strong>
      <p id="rq-limit-sentence">{`${whose} yhtä aikaa työskentelevää keskustelua, ja ${many(n).toLowerCase()} työskentelee jo.${again}`}</p>
      <div className="rq-kinds" data-testid="busy-kinds">
        {workspaces().map((w) => (
          <button key={w} type="button" className="rq-chip" data-testid={`chip-${w}`} onClick={() => onWho(w)}>
            <Icon name="folder" className="rq-chip-icon" /><span className="rq-chip-name">{w}</span><span className="ah-rail-count">{busy.filter((c) => c.wsName === w).length}</span>
          </button>
        ))}
      </div>
      <div className="ah-actions">
        <ControlButton data-testid="who" size="row" variant="primary" onPress={() => onWho()}>Mitkä pitävät paikkaa?</ControlButton>
        <ControlButton data-testid="retry" size="row" variant="secondary" onPress={onRetry}>{pending.retry}</ControlButton>
        <AdminLimitButton onAdmin={onAdmin} />
      </div>
    </aside>
  );
}

/** The window the refusal opens, at the workspace the person chose. */
function WhoWindow({open, group, onClose, onOpen}: {open: boolean; group?: string; onClose: () => void; onOpen: (c: Conv) => void}) {
  const h = useHost();
  useEffect(() => {
    if (!open || !group) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-testid="who-window"] [data-group="${group}"]`);
      el?.scrollIntoView({block: 'start'});
      el?.setAttribute('data-target', '');
    }, 30);
    return () => clearTimeout(t);
  }, [open, group]);
  return (
    <ModalOverlay className="ah-overlay" isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }} isDismissable>
      <Modal className="ah-modal rq-who-modal">
        <AriaDialog className="ah-dialog" data-testid="who-window" aria-label="Työskentelee nyt">
          <Heading slot="title">Työskentelee nyt · {h.busy.size}/{limitNow()}</Heading>
          <p className="s-desc">Keskustelu pitää paikkaa, kun sen vuoro on kesken, se odottaa vastaustasi tai sen käynnistämä taustaprosessi on yhä käynnissä. Pysäytetty keskustelu jatkuu seuraavasta viestistäsi.</p>
          <div className="rq-who-scroll"><GroupedList onOpen={(c) => { onClose(); onOpen(c); }} /></div>
          <div className="ah-dialog-actions">
            <ControlButton data-testid="who-close" size="row" variant="primary" onPress={onClose}>Valmis</ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---- The server area: the round's Keskustelut link and section ----
/** A slot the round owns inside the production settings page: placed
 * before `before`, or as the first child of `into`. */
function Slot({into, before, className, children}: {into: string; before?: string; className: string; children: React.ReactNode}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let el: HTMLElement | null = null;
    const place = () => {
      const parent = document.querySelector(into);
      if (!parent) return;
      const next = before ? parent.querySelector(before) : parent.firstElementChild;
      if (el && el.isConnected && el.parentElement === parent && (before ? el.nextElementSibling === next : parent.firstElementChild === el)) return;
      el ??= document.createElement('span');
      el.className = className;
      parent.insertBefore(el, next && next !== el ? next : null);
      setSlot(el);
    };
    place();
    const o = new MutationObserver(place);
    o.observe(document.querySelector('.ah-settings-layer') ?? document.body, {childList: true, subtree: true});
    return () => { o.disconnect(); el?.remove(); };
  }, [into, before, className]);
  return slot ? createPortal(children, slot) : null;
}

/** The round's section is drawn over the production Yleiset section, so its
 * link must not also say it is the page. */
function useOwnCurrent(own: boolean) {
  useLayoutEffect(() => {
    if (!own) return;
    const fix = () => document.querySelector('[data-testid="settings-palvelin"][aria-current]')?.removeAttribute('aria-current');
    fix();
    const o = new MutationObserver(fix);
    o.observe(document.querySelector('.ah-settings-layer') ?? document.body, {subtree: true, attributes: true, attributeFilter: ['aria-current'], childList: true});
    return () => o.disconnect();
  }, [own]);
}

const validLimit = (draft: string) => {
  const n = Number(draft.trim());
  return Number.isInteger(n) && n >= 1 && n <= MAX_LIMIT ? undefined : `Kokonaisluku 1–${MAX_LIMIT}`;
};
const gb = (n: number) => `${((n * MIB_PER_CHILD) / 1024).toFixed(1).replace('.', ',')} Gt`;
const plural = (n: number) => `${n} keskustelu${n === 1 ? '' : 'a'}`;
const over32 = (n: number) => (n > HOST_DEFAULT ? ` Yli palvelimen oman oletuksen ${HOST_DEFAULT}: varmista, että muisti riittää.` : '');

/** The installation's limit, as a text field (1 and 2). */
function DefaultField() {
  const h = useHost();
  return (
    <InlineTextSetting row="live-limit-default" data-testid="admin-default" label="Raja henkilöä kohden"
      description={`Montako keskustelua yksi henkilö voi pitää työssä yhtä aikaa, ellei hänellä ole omaa rajaa. ${plural(h.adminDefault)} vie enintään noin ${gb(h.adminDefault)} henkilöä kohden.${over32(h.adminDefault)}`}
      value={String(h.adminDefault)} unit="keskustelua" inputMode="decimal" invalid={validLimit}
      onSave={async (next) => { await later(250); host.adminDefault = Number(next); notify(); }} />
  );
}
const memoryFact = <p className="s-desc rq-fact">{`Palvelimella on ${SERVER_GIB} Gt muistia. Yksi työskentelevä keskustelu vie noin ${MIB_PER_CHILD} Mt.`}</p>;

/** One person's own number: a small form in place (1 and 2). */
function LimitForm({person, onDone, empty}: {person: Person; onDone: () => void; empty: string}) {
  const [draft, setDraft] = useState(person.limit === null ? '' : String(person.limit));
  const bad = draft.trim() !== '' && validLimit(draft);
  return (
    <form className="rq-admin-edit" onSubmit={(e) => {
      e.preventDefault();
      if (bad) return;
      setPersonLimit(person.id, draft.trim() === '' ? null : Number(draft));
      onDone();
    }}>
      <label className="s-field">{`Raja: ${person.username}${empty}`}
        <input data-testid="person-limit-input" inputMode="numeric" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={bad ? true : undefined} />
      </label>
      <ControlButton data-testid="person-limit-save" size="row" variant="primary" type="submit">Tallenna</ControlButton>
      <ControlButton size="row" onPress={onDone}>Peruuta</ControlButton>
      {bad ? <span className="rq-reason">{bad}</span> : null}
    </form>
  );
}

/** 1: every person, as Levytila lists them. */
function EveryoneSection() {
  const h = useHost();
  const [editing, setEditing] = useState('');
  return (
    <>
      <div className="s-card ah-administration"><DefaultField /></div>
      <h3 className="s-h3">Henkilöt</h3>
      <div className="s-card ah-administration">
        <table className="s-table" data-settings-row="live-limit-people">
          <thead><tr><th>Käyttäjä</th><th>Työssä nyt</th><th>Raja</th><th>Toiminnot</th></tr></thead>
          <tbody>
            {h.people.map((p) => {
              const limit = limitOf(p), busy = busyOf(p);
              return (
                <tr key={p.id} data-testid={`admin-person-${p.username}`}>
                  <td><strong>{p.username}</strong></td>
                  <td className="s-storage">
                    <span className="s-storage-value">{busy} / {limit}</span>
                    <div className="s-bar" role="img" aria-label={`${busy} / ${limit}`}><span style={{width: `${Math.min(100, (100 * busy) / limit)}%`}} /></div>
                  </td>
                  <td>{p.limit === null ? `Oletus (${h.adminDefault})` : `Oma: ${p.limit}`}</td>
                  <td>
                    {editing === p.id ? <LimitForm person={p} empty=" (tyhjä = oletus)" onDone={() => setEditing('')} /> : (
                      <ControlButton data-testid={`person-limit-edit-${p.username}`} size="row" onPress={() => setEditing(p.id)}>Muuta</ControlButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {memoryFact}
    </>
  );
}

/** 2: only the people with their own number. */
function ExceptionsSection() {
  const h = useHost();
  const [editing, setEditing] = useState('');
  const [adding, setAdding] = useState(false);
  const own = h.people.filter((p) => p.limit !== null);
  const rest = h.people.filter((p) => p.limit === null);
  const [who, setWho] = useState('');
  const [draft, setDraft] = useState('');
  const bad = draft.trim() === '' ? 'Anna raja' : validLimit(draft);
  const total = h.people.reduce((sum, p) => sum + busyOf(p), 0);
  return (
    <>
      <div className="s-card ah-administration"><DefaultField /></div>
      <h3 className="s-h3">Poikkeukset</h3>
      <p className="s-desc rq-fact">{`Henkilöt, joilla on oma raja. Muut ${rest.length} käyttävät rajaa ${h.adminDefault}.`}</p>
      <div className="s-card ah-administration" data-settings-row="live-limit-exceptions">
        {own.length ? (
          <ul className="rq-exceptions">
            {own.map((p) => (
              <li key={p.id} data-testid={`admin-person-${p.username}`}>
                {editing === p.id ? <LimitForm person={p} empty="" onDone={() => setEditing('')} /> : (
                  <>
                    <strong>{p.username}</strong>
                    <span className="rq-exception-value">{`${plural(p.limit!)}${p.limit! > HOST_DEFAULT ? ' · yli 32' : ''}`}</span>
                    <span className="rq-row-actions">
                      <ControlButton data-testid={`person-limit-edit-${p.username}`} size="row" onPress={() => setEditing(p.id)}>Muuta</ControlButton>
                      <ControlButton data-testid={`person-limit-remove-${p.username}`} size="row" variant="quiet" onPress={() => setPersonLimit(p.id, null)}>Poista</ControlButton>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="s-row">Ei poikkeuksia: kaikki käyttävät rajaa {h.adminDefault}.</p>}
        <div className="rq-add">
          {adding ? (
            <form className="rq-admin-edit" data-testid="exception-form" onSubmit={(e) => {
              e.preventDefault();
              if (bad || !who) return;
              setPersonLimit(who, Number(draft)); setAdding(false);
            }}>
              <Select label="Henkilö" value={who} onChange={setWho} options={rest.map((p) => ({value: p.id, label: p.username}))} />
              <label className="s-field">Raja
                <input data-testid="exception-input" inputMode="numeric" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
              </label>
              <ControlButton data-testid="exception-save" size="row" variant="primary" type="submit" isDisabled={Boolean(bad)}>Tallenna</ControlButton>
              <ControlButton size="row" onPress={() => setAdding(false)}>Peruuta</ControlButton>
            </form>
          ) : (
            <ControlButton data-testid="exception-add" size="row" variant="secondary" isDisabled={!rest.length}
              onPress={() => { setWho(rest[0]?.id ?? ''); setDraft(''); setAdding(true); }}>
              <Icon name="plus" />Lisää poikkeus
            </ControlButton>
          )}
        </div>
      </div>
      <p className="s-desc rq-fact">{`Työssä nyt koko palvelimella ${plural(total)}. Palvelimella on ${SERVER_GIB} Gt muistia; yksi työskentelevä keskustelu vie noin ${MIB_PER_CHILD} Mt.`}</p>
    </>
  );
}

/** 3: memory first; every number a stepper that moves the estimate. */
function MemorySection() {
  const h = useHost();
  const now = h.people.reduce((sum, p) => sum + busyOf(p), 0);
  const worst = h.people.reduce((sum, p) => sum + limitOf(p), 0);
  const nowGb = (now * MIB_PER_CHILD) / 1024, worstGb = (worst * MIB_PER_CHILD) / 1024;
  const pct = (g: number) => `${Math.min(100, (100 * g) / SERVER_GIB)}%`;
  const tooMuch = worstGb > SERVER_GIB;
  return (
    <>
      <div className="s-card ah-administration">
        <div className="s-row rq-memory" data-settings-row="live-limit-memory" data-testid="memory-meter">
          <div className="s-lbl">
            <span>Muisti</span>
            <span className="s-desc">{`Palvelimella ${SERVER_GIB} Gt. Yksi työskentelevä keskustelu vie noin ${MIB_PER_CHILD} Mt.`}</span>
          </div>
          <div className="rq-meter" role="img" aria-label={`Nyt ${gb(now)}, enintään ${gb(worst)} / ${SERVER_GIB} Gt`}>
            <span className="rq-meter-worst" data-over={tooMuch ? '' : undefined} style={{width: pct(worstGb)}} />
            <span className="rq-meter-now" style={{width: pct(nowGb)}} />
          </div>
          <dl className="rq-meter-legend">
            <div><dt><span className="rq-key rq-key-now" />Työssä nyt</dt><dd>{`${plural(now)} · ${gb(now)}`}</dd></div>
            <div data-testid="memory-worst"><dt><span className="rq-key rq-key-worst" data-over={tooMuch ? '' : undefined} />Jos jokainen käyttää koko rajansa</dt><dd>{`${plural(worst)} · ${gb(worst)}`}</dd></div>
          </dl>
          {tooMuch ? <p className="rq-over" data-testid="memory-over"><Icon name="warning" />{`Rajat yhteensä ylittävät palvelimen muistin. Keskustelut eivät ole kaikki yhtä aikaa työssä, mutta jos ovat, muisti loppuu.`}</p> : null}
        </div>
        <div className="s-row" data-settings-row="live-limit-default">
          <div className="s-lbl">
            <span>Raja henkilöä kohden</span>
            <span className="s-desc">{`Ellei henkilöllä ole omaa rajaa.${over32(h.adminDefault)}`}</span>
          </div>
          <NumberStepper label="Raja henkilöä kohden" testId="admin-default" value={h.adminDefault} min={1} max={MAX_LIMIT} unit="keskustelua"
            onChange={(n) => { host.adminDefault = n; notify(); }} />
        </div>
      </div>
      <h3 className="s-h3">Henkilöt</h3>
      <div className="s-card ah-administration">
        <ul className="rq-people" data-settings-row="live-limit-people">
          {h.people.map((p) => (
            <li key={p.id} data-testid={`admin-person-${p.username}`} data-own={p.limit === null ? undefined : ''}>
              <span className="rq-person">
                <strong>{p.username}</strong>
                <span className="s-desc">{`työssä nyt ${busyOf(p)} · ${p.limit === null ? 'oletus' : 'oma raja'}`}</span>
              </span>
              <NumberStepper label={`Raja: ${p.username}`} testId={`person-${p.username}`} value={limitOf(p)} min={1} max={MAX_LIMIT}
                onChange={(n) => setPersonLimit(p.id, n === h.adminDefault ? null : n)} />
              {p.limit === null ? <span className="rq-reset-slot" /> : (
                <ControlButton data-testid={`person-limit-reset-${p.username}`} size="row" variant="quiet" onPress={() => setPersonLimit(p.id, null)}>Oletukseen</ControlButton>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** Ylläpito › Keskustelut. */
function ConversationsSection({direction}: {direction: number}) {
  return (
    <div className="rq-own-section" data-testid="admin-limit-section" data-direction={direction}>
      <h2 data-testid="settings-section-keskustelut">Samanaikaiset keskustelut</h2>
      <p className="s-desc rq-lead">Keskustelu pitää paikkaa, kun sen vuoro on kesken, se odottaa vastausta tai sen käynnistämä taustaprosessi on käynnissä. Rajaan törmäävä näkee, mitkä pitävät paikkaa, ja voi pysäyttää jonkin.</p>
      {direction === 0 ? <EveryoneSection /> : direction === 1 ? <ExceptionsSection /> : <MemorySection />}
    </div>
  );
}

// ---- A busy conversation, opened from the rail or a list ----
type Item = {id: string; kind: 'user' | 'assistant'; text: string; time: string; state?: 'streaming' | 'complete' | 'failed'; node?: React.ReactNode};
function render(item: Item) {
  const content = item.kind === 'user'
    ? <UserMessage sourceText={item.text} onCopy={noop} time={item.time}><Markdown text={item.text} /></UserMessage>
    : <AssistantMessage streamState={item.state} time={item.time} onCopy={noop}>{item.node ?? <Markdown text={item.text} />}</AssistantMessage>;
  return {id: item.id, kind: item.kind, content: <div data-item={item.id}>{item.node && item.kind === 'user' ? item.node : content}</div>};
}
const HISTORY: Record<string, [string, string]> = {
  kesa: ['Aja aurinkokellon testit ja korjaa kesäajan virhe.', 'Ajan testejä uudelleen korjauksen jälkeen…'],
  julkaisu: ['Kirjoita julkaisun muistiinpanot viime viikon muutoksista.', 'Muistiinpanot ovat valmiina luonnoksena. **Julkaistaanko versiona 2.3 vai 2.4?** Muutoksissa on yksi rajapinnan muutos, joten 2.4 olisi rehellisempi.'],
  ruotsi: ['Käännä käyttöliittymän tekstit ruotsiksi.', 'Käänsin 140 tekstiä. **Käytetäänkö sinuttelua vai teitittelyä?**'],
  dev: ['Käynnistä kehityspalvelin, niin katson sivua puhelimella.', 'Kehityspalvelin käy taustalla osoitteessa `http://localhost:5173`. Se jatkaa, kunnes pysäytät sen.'],
  kuvat: ['Pakkaa kuvagallerian kuvat WebP-muotoon.', 'Pakkaus käy taustalla (`make images`), 412 kuvaa. Kerron, kun se on valmis.'],
  tahdet: ['Hae tähtikartan data uudelleen.', 'Haku käy taustalla (`python fetch_stars.py`); lähde on hidas.'],
  varmuus: ['Kopioi kuvat NAS:lle.', 'Kopiointi käy taustalla (`rsync`).'],
  teksti: ['Lyhennä etusivun esittelyteksti kahteen kappaleeseen.', 'Lyhensin tekstin kahteen kappaleeseen.'],
  kauppa: ['Lisää listaan maito ja kahvi.', 'Lisäsin maidon ja kahvin.'],
};

const OWN_PATH = '/settings/conversations';
const NEW_PATH = '/workspaces/ws_k?new=1';
const paths = settingsPaths as Record<string, string>;
const sectionOf = (pathname: string) => Object.keys(paths).find((id) => pathname === `/settings/${paths[id]}`);
let reviewTheme = 'light';

function Main({direction}: {direction: number}) {
  const h = useHost();
  const location = useLocation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<NewPhase>('refused');
  const [tries, setTries] = useState(0);
  const [who, setWho] = useState<{open: boolean; group?: string}>({open: false});
  const params = new URLSearchParams(location.search);
  const settings = location.pathname.startsWith('/settings');
  const own = location.pathname === OWN_PATH;
  useOwnCurrent(own && isAdmin());
  const current = params.get('conversation');
  const isNew = !current;
  const conv = current ? byId.get(current)! : undefined;
  const back = useRef(NEW_PATH);
  if (!settings) back.current = `${location.pathname}${location.search}`;
  const open = (c: Conv) => navigate(`/workspaces/${c.ws}?conversation=${c.id}`);

  const retry = () => {
    if (full()) { setTries((t) => t + 1); return; }
    host.busy.add('uusi'); setPhase('created'); notify();
  };

  // ---- Rail: today's sections, built from the busy set ----
  const now = Date.now();
  const all: Conv[] = [...CONVS, ...(phase === 'created' ? [{id: 'uusi', title: 'Tumma teema', ws: 'ws_k', wsName: 'kotisivu', kind: 'turn' as Kind, since: 0, wrote: 0}] : [])];
  const busyHere = (c: Conv) => h.busy.has(c.id);
  const place = (c: Conv) => (!busyHere(c) ? 'quiet' : c.kind === 'question' ? 'yours' : 'running');
  const model = (c: Conv): AgentNavModel => {
    const busy = busyHere(c);
    const label = !busy ? 'Odottaa viestiä' : kindWord(c);
    return {
      agentId: c.id, href: `/workspaces/${c.ws}?conversation=${c.id}`, title: c.title, workspaceId: c.ws, workspaceName: c.wsName,
      changedAt: T0 - c.since * 60000, activity: busy && c.kind === 'turn' ? 'working' : busy && c.kind === 'processes' ? 'waiting_background' : 'waiting',
      activityLabel: label, controlLabel: '', question: busy && c.kind === 'question' ? true : undefined,
      detail: [c.wsName, label].join(' · '), selected: current === c.id && !settings,
    };
  };
  const rowsIn = (p: string) => all.filter((c) => place(c) === p);
  const row = (c: Conv) => <AgentNavItem key={c.id} {...model(c)} now={now} />;
  const yours = rowsIn('yours'), running = rowsIn('running'), quiet = rowsIn('quiet');
  const groups = [...new Set(running.map((c) => c.wsName))].sort();
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name={isAdmin() ? 'Jari Mustonen' : 'Kaisa'} onSettings={() => navigate(isAdmin() ? OWN_PATH : '/settings/ai')} onLogout={noop} />}
      now={
        <>
          <section className="ah-now" data-testid="rail-yours" aria-labelledby="ra-yours">
            <h2 className="ah-rail-section-head" id="ra-yours">Sinun vuorosi{yours.length ? <span className="ah-rail-count ah-rail-count-attention">{yours.length}</span> : null}</h2>
            {yours.length ? <ul>{yours.map(row)}</ul> : <p className="ah-now-empty">Mikään ei odota sinua.</p>}
          </section>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="ra-running">
            <h2 className="ah-rail-section-head" id="ra-running">Käynnissä{running.length ? <span className="ah-rail-count">{running.length}</span> : null}</h2>
            {groups.map((g) => (
              // biome-ignore lint/a11y/useSemanticElements: a list group.
              <div key={g} className="ah-now-group" role="group">
                <h3 className="ah-now-group-head"><span className="ah-now-group-name">{g}</span><span className="ah-rail-count">{running.filter((c) => c.wsName === g).length}</span></h3>
                <ul>{running.filter((c) => c.wsName === g).map(row)}</ul>
              </div>
            ))}
          </section>
          <section className="ah-now ah-quiet" data-testid="rail-quiet" aria-labelledby="ra-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded="true">
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="ra-quiet">Hiljaiset</span><span className="ah-rail-count">{quiet.length}</span>
              </button>
            </h2>
            <ul>{quiet.map(row)}</ul>
          </section>
        </>
      }>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );

  // ---- Main ----
  let main: React.ReactNode;
  if (settings) {
    const section = own ? 'palvelin' : sectionOf(location.pathname) ?? 'tekoaly';
    main = (
      <div className={`ah-settings-layer${own ? ' rq-own' : ''}`}>
        <div className="ah-state">
          <AccountSettings routeSection={section} routeRow={location.hash.slice(1) || undefined} onNavigate={(p) => navigate(p)}
            profile={{name: isAdmin() ? 'Jari Mustonen' : 'Kaisa', email: '', avatar_url: ''}} csrf="prototype"
            modelSelector={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>}
            onClose={() => navigate(back.current)} />
          {isAdmin() ? (
            <Slot into='[data-testid="server-section-links"]' before='[data-testid="settings-levy"]' className="rq-nav-slot">
              <a className="s-nav-i" data-testid="settings-keskustelut" href={OWN_PATH} aria-current={own ? 'page' : undefined}
                // On the phone the links are a tab row; bring the current one into view.
                ref={(el) => { if (el && own) el.scrollIntoView({block: 'nearest', inline: 'nearest'}); }}
                onClick={(e) => { e.preventDefault(); navigate(OWN_PATH); }}>
                <Icon name="agent" />Keskustelut
              </a>
            </Slot>
          ) : null}
          {own && isAdmin() ? <Slot into=".s-main" className="rq-own-slot"><ConversationsSection direction={direction} /></Slot> : null}
        </div>
      </div>
    );
  } else if (isNew) {
    const items: Item[] = [];
    if (phase === 'refused') items.push({id: 'w', kind: 'user', text: NEW_MESSAGE, time: '', node: <WaitingMessage text={NEW_MESSAGE} state="failed" onCopy={noop} />});
    if (phase === 'created') {
      items.push({id: 'n1', kind: 'user', text: NEW_MESSAGE, time: '10.31'});
      items.push({id: 'n2', kind: 'assistant', text: 'Katson etusivun tyylejä…', time: '', state: 'streaming'});
    }
    const refused = phase === 'refused';
    main = (
      <div className="ah-state rq-main">
        <ConversationFrame>
          <AgentHeader title={refused ? pending.newConversation : 'Tumma teema'} workspaceLabel="kotisivu" workspaceHref="/workspaces/ws_k"
            activityLabel={refused ? pending.notCreated : rail.working} activityAnimated={!refused} activityKind={refused ? 'neutral' : 'working'}
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          <ConversationStream>
            <ConversationTimeline key={phase} state="ready" items={items.map(render)} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
            <RefusalCard phase={phase} tries={tries} onRetry={retry}
              onWho={(group) => setWho({open: true, group})} onAdmin={() => navigate(OWN_PATH)} />
          </ConversationStream>
          <Composer value="" onChange={noop} activity={refused ? 'idle' : 'working'} selectedWorkingMode="steer"
            availability={refused ? {state: 'disabled', reason: pending.notCreatedReason} : undefined}
            onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop}
            onInterrupt={() => stop('uusi')} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
        </ConversationFrame>
        <WhoWindow open={who.open} group={who.group} onClose={() => setWho({open: false})} onOpen={open} />
      </div>
    );
  } else {
    const c = conv!;
    const busy = h.busy.has(c.id);
    const [ask, said] = HISTORY[c.id] ?? [`${c.title}.`, 'Työskentelen…'];
    const items: Item[] = [{id: `${c.id}-1`, kind: 'user', text: ask, time: '9.40'}];
    const streaming = busy && c.kind === 'turn';
    items.push({id: `${c.id}-2`, kind: 'assistant', text: streaming ? said : busy || !c.kind ? said : `${said}\n\n*Pysäytit tämän keskustelun.*`, time: streaming ? '' : '9.42', state: streaming ? 'streaming' : 'complete'});
    const notice = busy && c.kind === 'processes' ? (
      <WarningBanner data-testid="process-notice" tone="neutral" title="Taustalla käynnissä" short={c.process}
        actions={<ControlButton data-testid="process-stop" size="row" variant="secondary" onPress={() => stop(c.id)}>Pysäytä prosessi</ControlButton>}>
        <>Keskustelun käynnistämä <code>{c.process}</code> on käynnissä {minutes(c.since)}. Se pitää keskustelun paikan varattuna.</>
      </WarningBanner>
    ) : busy && c.kind === 'question' ? (
      <WarningBanner data-testid="question-notice" tone="warning" title="Agentti odottaa vastaustasi"
        actions={<ControlButton data-testid="question-stop" size="row" variant="secondary" onPress={() => stop(c.id)}>Pysäytä vuoro</ControlButton>}>
        Vastaa kentässä, tai pysäytä vuoro, niin keskustelu vapauttaa paikkansa.
      </WarningBanner>
    ) : null;
    main = (
      <div className="ah-state rq-main">
        <ConversationFrame>
          <AgentHeader title={c.title} workspaceLabel={c.wsName} workspaceHref={`/workspaces/${c.ws}`}
            activityLabel={busy ? kindWord(c) : ''} activityAnimated={streaming} activityKind={streaming ? 'working' : 'neutral'}
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          <ConversationStream>
            <ConversationTimeline key={c.id} state="ready" items={items.map(render)} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          <div className="ah-actionable-notices">{notice}</div>
          <Composer value="" onChange={noop} activity={streaming ? 'working' : 'idle'} selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop}
            onInterrupt={() => stop(c.id)} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
        </ConversationFrame>
      </div>
    );
  }
  const title = settings ? 'Asetukset' : conv ? conv.title : pending.newConversation;
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} navigationBadge={yours.length} rail={railView} main={main} />
    </StatusBellProvider>
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [viewer, setViewer] = useState<Viewer>(host.viewer);
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
  const restart = () => { resetHost(direction); setGeneration((g) => g + 1); };
  // The administrator starts in the server area, where the riffs differ;
  // anyone else can only meet the limit, so they start at the refusal.
  const start = viewer === 'admin' ? OWN_PATH : NEW_PATH;
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-viewer={viewer}>
      <header className="rq-bar" ref={bar}>
        <strong>Samanaikaiset keskustelut 3</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Katsoja <select id="viewer" value={viewer} onChange={(e) => {
          host.viewer = e.target.value as Viewer; setViewer(host.viewer); restart();
        }}>
          <option value="admin">Ylläpitäjä (maintainer)</option><option value="person">Tavallinen käyttäjä (kaisa)</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={restart}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
          <li className="rq-common">{COMMON}</li>
        </ol>
      </header>
      <div className="rq-stage">
        <AccountPreferencesProvider identity={IDENTITY} csrf="prototype">
          <PiModelsProvider key={generation} enabled>
            <MemoryRouter key={generation} initialEntries={[start]}>
              <Main direction={direction} />
            </MemoryRouter>
          </PiModelsProvider>
        </AccountPreferencesProvider>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
let pickedDirection = 0;
const stageSink = {set innerHTML(view: React.ReactNode) { resetHost(pickedDirection); flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => { pickedDirection = direction; resetHost(direction); return <App key={direction} direction={direction} />; });
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
