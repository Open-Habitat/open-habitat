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
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {WarningBanner} from '../../../../web/src/components/WarningBanner';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings, AccountShelf} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {pendingConversationText} from '../../../../web/src/text/pendingConversation';
import {statusText} from '../../../../web/src/text/status';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const pending = liveText(pendingConversationText);
const rail = liveText(statusText).rail;

// proto-live-conversation-limit-setting, round 2. Jari 6.11. chose round 1's
// B: the administrator sets the limit for the installation and per person,
// and the refusal says which conversations hold the places. This round riffs
// on B: Muokkaa is gone, Yritä uudelleen stays, "Muuta rajaa (ylläpitäjä)"
// works only for the administrator (the Katsoja choice shows it hidden or
// disabled for others), and the axis is the list of what holds a place: by
// kind in a window, in the card itself with the forgotten first, or by
// workspace in a window. The daemon's own cap is now 32 (b340d017); here the
// administrator has set 12 for the installation, so the list is long enough
// to show how each variant scales. Rail, header, timeline, messages,
// composer, the settings page and its administrator section are production
// components; the host behind them is a fetch stand-in. Everything is synthetic.
const directions = ['1 Lajeittain', '2 Kortissa', '3 Työtiloittain'];
const LINES = [
  '1 Lajeittain: kortissa lajit painikkeina (taustaprosessit, odottaa vastaustasi, vuoro käynnissä); painike avaa ikkunan sen lajin kohdalta, taustaprosessit ensin.',
  '2 Kortissa: lista on kortissa itsessään, unohdetuin ensin (milloin kirjoitit viimeksi); kolme näkyy, loput Näytä kaikki -painikkeen takana. Ei ikkunaa.',
  '3 Työtiloittain: kortissa työtilat painikkeina, tämä työtila ensin; ikkunan lista ryhmittyy työtiloittain kuten sivupalkin Käynnissä.',
];
const COMMON = 'Kaikissa (ero kierrokseen 1): Muokkaa poistettu, Yritä uudelleen jää, Muuta rajaa (ylläpitäjä). Katsoja näyttää, miltä kortti näyttää muulle kuin ylläpitäjälle.';
const KIND = 0, CARD = 1, WS = 2;
type Viewer = 'admin' | 'hidden' | 'disabled';

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
const HOST_DEFAULT = 32;
const MIB_PER_CHILD = 210;
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
    {id: 'u1', username: 'maintainer', administrator: true, busy: 0, limit: null},
    {id: 'u2', username: 'kaisa', administrator: false, busy: 2, limit: null},
    {id: 'u3', username: 'ville', administrator: false, busy: 0, limit: 20},
  ];
}
resetHost(0);
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const isAdmin = () => host.viewer === 'admin';
/** The limit the person meets: their own number from the administrator, or
 * the installation's default. */
const limitNow = () => host.people[isAdmin() ? 0 : 1].limit ?? host.adminDefault;
const full = () => host.busy.size >= limitNow();
function stop(id: string) { host.busy.delete(id); if (!host.stopped.includes(id)) host.stopped.push(id); notify(); }

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GiB = 1024 ** 3;
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(80);
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

// ---- What holds a place ----
const kindWord = (c: Conv) => (c.kind === 'question' ? rail.asks : c.kind === 'processes' ? rail.background : rail.working);
const stopWord = (c: Conv) => (c.kind === 'processes' ? 'Pysäytä prosessi' : 'Pysäytä vuoro');
const KIND_ORDER: Kind[] = ['processes', 'question', 'turn'];
const kindCount = (k: Kind, n: number) =>
  k === 'processes' ? `${n} taustaprosessi${n === 1 ? '' : 'a'}` : k === 'question' ? `${n} odottaa vastaustasi` : `${n} vuoro${n === 1 ? '' : 'a'} käynnissä`;
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

/** 1: by kind, background processes first; 3: by workspace, this one first. */
function GroupedList({by, onOpen}: {by: 'kind' | 'ws'; onOpen: (c: Conv) => void}) {
  useHost();
  const rows = shown();
  const groups = by === 'kind'
    ? KIND_ORDER.map((k) => ({id: k, head: kindCount(k, rows.filter((c) => c.kind === k && host.busy.has(c.id)).length), rows: rows.filter((c) => c.kind === k).sort((a, b) => b.since - a.since)}))
    : [...new Set([...workspaces(), ...rows.map((c) => c.wsName)])].map((w) => ({
      id: w, head: `${w}${w === HERE ? ' (tämä työtila)' : ''} · ${rows.filter((c) => c.wsName === w && host.busy.has(c.id)).length}`,
      rows: rows.filter((c) => c.wsName === w).sort((a, b) => b.wrote - a.wrote)}));
  return (
    <div className="rq-groups" data-testid="busy-list">
      {groups.filter((g) => g.rows.length).map((g) => (
        <section key={g.id} className="rq-group" data-group={g.id}>
          <h3 className="rq-group-head">{g.head}</h3>
          <ul className="rq-busy">
            {g.rows.map((c) => (
              <BusyRow key={c.id} c={c} onOpen={onOpen}
                meta={by === 'kind' ? <>{c.wsName}{c.process ? <> · <code>{c.process}</code></> : null} · {minutes(c.since)}</> : <>{what(c)} · {ago(c.wrote)}</>} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** 2: the list in the card, the longest untouched first, three at a time. */
function InlineList({onOpen}: {onOpen: (c: Conv) => void}) {
  useHost();
  const [all, setAll] = useState(false);
  const rows = shown().sort((a, b) => b.wrote - a.wrote);
  const visible = all ? rows : rows.slice(0, 3);
  return (
    <div className="rq-inline">
      <ul className="rq-busy compact" data-testid="busy-list">
        {visible.map((c) => <BusyRow key={c.id} c={c} onOpen={onOpen} meta={<>{c.wsName} · {c.process ? <code>{c.process}</code> : kindWord(c)} · {ago(c.wrote)}</>} />)}
      </ul>
      {rows.length > 3 ? (
        <ControlButton data-testid="show-all" size="row" variant="quiet" onPress={() => setAll((x) => !x)}>
          {all ? 'Näytä vähemmän' : `Näytä kaikki ${rows.length}`}
        </ControlButton>
      ) : null}
    </div>
  );
}

/** Count in words for the card: "Kaksitoista keskustelua". */
const NUMBERS = ['Nolla', 'Yksi', 'Kaksi', 'Kolme', 'Neljä', 'Viisi', 'Kuusi', 'Seitsemän', 'Kahdeksan', 'Yhdeksän', 'Kymmenen', 'Yksitoista', 'Kaksitoista'];
const many = (n: number) => `${NUMBERS[n] ?? n} keskustelu${n === 1 ? '' : 'a'}`;

/** Muuta rajaa: the administrator's own, absent or disabled with its reason
 * for anyone else. */
function AdminLimitButton({onAdmin}: {onAdmin: () => void}) {
  const h = useHost();
  if (h.viewer === 'hidden') return null;
  if (h.viewer === 'admin')
    return <ControlButton data-testid="admin-limit" size="row" variant="quiet" onPress={onAdmin}>Muuta rajaa (ylläpitäjä)</ControlButton>;
  return (
    <span className="rq-disabled">
      <ControlButton data-testid="admin-limit" size="row" variant="quiet" isDisabled aria-describedby="rq-admin-reason">Muuta rajaa (ylläpitäjä)</ControlButton>
      <span className="rq-reason" id="rq-admin-reason">Vain ylläpitäjä voi muuttaa rajaa.</span>
    </span>
  );
}

// ---- The refused new conversation: the moment the limit is met ----
type NewPhase = 'refused' | 'created';
function RefusalCard({direction, phase, tries, onRetry, onWho, onAdmin, onOpen}: {
  direction: number; phase: NewPhase; tries: number;
  onRetry: () => void; onWho: (group?: string) => void; onAdmin: () => void; onOpen: (c: Conv) => void;
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
  const summary = direction === KIND ? (
    <div className="rq-kinds" data-testid="busy-kinds">
      {KIND_ORDER.map((k) => {
        const count = busy.filter((c) => c.kind === k).length;
        return count ? (
          <button key={k} type="button" className="rq-chip" data-testid={`chip-${k}`} onClick={() => onWho(k)}>
            <StatusMark label={kindCount(k, count)} tone={kindTone(k)} animated={k === 'turn' ? 'running' : false} />
          </button>
        ) : null;
      })}
    </div>
  ) : direction === WS ? (
    <div className="rq-kinds" data-testid="busy-kinds">
      {workspaces().map((w) => (
        <button key={w} type="button" className="rq-chip" data-testid={`chip-${w}`} onClick={() => onWho(w)}>
          <Icon name="folder" className="rq-chip-icon" /><span className="rq-chip-name">{w}</span><span className="ah-rail-count">{busy.filter((c) => c.wsName === w).length}</span>
        </button>
      ))}
    </div>
  ) : <InlineList onOpen={onOpen} />;
  return (
    <aside className={`ah-notice ah-tone-warning${direction === CARD ? ' rq-wide' : ''}`} data-testid="creation-problem" data-state="refused">
      <strong>{pending.conversationNotCreated}</strong>
      <p>{`Ylläpitäjän asettama raja on ${limit} yhtä aikaa työskentelevää keskustelua, ja ${many(n).toLowerCase()} työskentelee jo.${direction === CARD ? ' Pysäytä jokin, niin paikka vapautuu.' : ''}${again}`}</p>
      {summary}
      <div className="ah-actions">
        {direction === CARD ? null : <ControlButton data-testid="who" size="row" variant="primary" onPress={() => onWho()}>Mitkä pitävät paikkaa?</ControlButton>}
        <ControlButton data-testid="retry" size="row" variant="secondary" onPress={onRetry}>{pending.retry}</ControlButton>
        <AdminLimitButton onAdmin={onAdmin} />
      </div>
    </aside>
  );
}

/** 1 and 3: the window the refusal opens, at the group the person chose. */
function WhoWindow({by, open, group, onClose, onOpen}: {by: 'kind' | 'ws'; open: boolean; group?: string; onClose: () => void; onOpen: (c: Conv) => void}) {
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
          <div className="rq-who-scroll"><GroupedList by={by} onOpen={(c) => { onClose(); onOpen(c); }} /></div>
          <div className="ah-dialog-actions">
            <ControlButton data-testid="who-close" size="row" variant="primary" onPress={onClose}>Valmis</ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---- Settings: the administrator's section placed into the production page ----
/** Put the round's rows after an element of the production settings page. */
function Into({after, children}: {after: string; children: React.ReactNode}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let el: HTMLElement | null = null;
    const place = () => {
      const anchor = document.querySelector(after);
      if (!anchor || (el && el.isConnected && el.previousElementSibling === anchor)) return;
      el ??= document.createElement('div');
      el.className = 'rq-into';
      anchor.after(el);
      setSlot(el);
    };
    place();
    const o = new MutationObserver(place);
    o.observe(document.querySelector('.s-main') ?? document.body, {childList: true, subtree: true});
    return () => { o.disconnect(); el?.remove(); };
  }, [after]);
  return slot ? createPortal(children, slot) : null;
}

const validLimit = (draft: string) => {
  const n = Number(draft.trim());
  return Number.isInteger(n) && n >= 1 && n <= HOST_DEFAULT ? undefined : `1–${HOST_DEFAULT}`;
};
const memory = (n: number) => `${((n * MIB_PER_CHILD) / 1024).toFixed(1).replace('.', ',')} Gt`;

/** Ylläpito › Palvelin, a section after the server's own rows. */
function AdminLimitRows() {
  const h = useHost();
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState('');
  const people = h.people.map((p, i) => (i === 0 ? {...p, busy: h.busy.size} : p));
  return (
    <div className="rq-admin" data-testid="admin-limit-section">
      <h3 className="s-h3">Samanaikaiset keskustelut</h3>
      <div className="s-card ah-administration">
        <InlineTextSetting row="live-limit-default" data-testid="admin-default-input" label="Oletusraja henkilöä kohden"
          description={`Montako keskustelua yksi henkilö voi pitää työssä yhtä aikaa. Yksi työskentelevä keskustelu vie noin ${MIB_PER_CHILD} Mt muistia, joten ${h.adminDefault} vie enintään noin ${memory(h.adminDefault)} henkilöä kohden. Palvelimen oma oletus ja yläraja on ${HOST_DEFAULT}.`}
          value={String(h.adminDefault)} unit="keskustelua" inputMode="decimal" invalid={validLimit}
          onSave={async (next) => { await later(300); host.adminDefault = Number(next); notify(); }} />
        <table className="s-table rq-admin-table" data-settings-row="live-limit-people" tabIndex={-1}>
          <thead><tr><th>Käyttäjä</th><th>Työskentelee nyt</th><th>Raja</th><th>Toiminnot</th></tr></thead>
          <tbody>
            {people.map((p) => {
              const limit = p.limit ?? h.adminDefault;
              return (
                <tr key={p.id} data-testid={`admin-person-${p.username}`}>
                  <td><strong>{p.username}</strong></td>
                  <td className="s-storage">
                    <span className="s-storage-value">{p.busy} / {limit}</span>
                    <div className="s-bar" role="img" aria-label={`${p.busy} / ${limit}`}><span style={{width: `${Math.min(100, (100 * p.busy) / limit)}%`}} /></div>
                  </td>
                  <td>{p.limit === null ? `Oletus (${h.adminDefault})` : `Oma: ${p.limit}`}</td>
                  <td>
                    {editing === p.id ? (
                      <form className="rq-admin-edit" onSubmit={(e) => {
                        e.preventDefault();
                        if (draft.trim() !== '' && validLimit(draft)) return;
                        const next = draft.trim() === '' ? null : Number(draft);
                        host.people = host.people.map((x) => (x.id === p.id ? {...x, limit: next} : x));
                        setEditing(''); notify();
                      }}>
                        <label className="s-field">{`Raja: ${p.username} (tyhjä = oletus)`}
                          <input data-testid="person-limit-input" inputMode="numeric" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
                        </label>
                        <ControlButton data-testid="person-limit-save" size="row" variant="primary" type="submit">Tallenna</ControlButton>
                        <ControlButton size="row" onPress={() => setEditing('')}>Peruuta</ControlButton>
                      </form>
                    ) : (
                      <ControlButton data-testid={`person-limit-edit-${p.username}`} size="row" onPress={() => { setEditing(p.id); setDraft(p.limit === null ? '' : String(p.limit)); }}>Muuta</ControlButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  const current = params.get('conversation');
  const isNew = !current;
  const conv = current ? byId.get(current)! : undefined;
  const back = useRef('/workspaces/ws_k?new=1');
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
      sessionActions={<AccountShelf name={isAdmin() ? 'Jari Mustonen' : 'Kaisa'} onSettings={() => navigate(isAdmin() ? '/settings/palvelin' : '/settings/ai')} onLogout={noop} />}
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
    const admin = location.pathname.startsWith('/settings/palvelin');
    main = (
      <div className="ah-settings-layer">
        <div className="ah-state">
          <AccountSettings routeSection={admin ? 'palvelin' : 'tekoaly'} routeRow={location.hash.slice(1) || undefined} onNavigate={(p) => navigate(p)}
            profile={{name: 'Jari Mustonen', email: '', avatar_url: ''}} csrf="prototype"
            modelSelector={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>}
            onClose={() => navigate(back.current)} />
          {admin && isAdmin() ? <Into after=".s-main > .s-card.ah-administration"><AdminLimitRows /></Into> : null}
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
            <RefusalCard direction={direction} phase={phase} tries={tries} onRetry={retry}
              onWho={(group) => setWho({open: true, group})} onAdmin={() => navigate('/settings/palvelin#live-limit-default')} onOpen={open} />
          </ConversationStream>
          <Composer value="" onChange={noop} activity={refused ? 'idle' : 'working'} selectedWorkingMode="steer"
            availability={refused ? {state: 'disabled', reason: pending.notCreatedReason} : undefined}
            onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop}
            onInterrupt={() => stop('uusi')} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
        </ConversationFrame>
        {direction === CARD ? null : <WhoWindow by={direction === KIND ? 'kind' : 'ws'} open={who.open} group={who.group} onClose={() => setWho({open: false})} onOpen={open} />}
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
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-viewer={viewer}>
      <header className="rq-bar" ref={bar}>
        <strong>Samanaikaiset keskustelut 2</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Katsoja <select id="viewer" value={viewer} onChange={(e) => {
          host.viewer = e.target.value as Viewer; setViewer(host.viewer); restart();
        }}>
          <option value="admin">Ylläpitäjä</option><option value="hidden">Muu · nappi piilossa</option><option value="disabled">Muu · nappi pois käytöstä</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={restart}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
          <li className="rq-common">{COMMON}</li>
        </ol>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={generation} enabled>
          <MemoryRouter key={generation} initialEntries={['/workspaces/ws_k?new=1']}>
            <Main direction={direction} />
          </MemoryRouter>
        </PiModelsProvider>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
