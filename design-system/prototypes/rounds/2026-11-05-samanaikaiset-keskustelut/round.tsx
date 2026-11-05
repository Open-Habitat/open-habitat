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
import {InlineNotice, StatusMark} from '../../../../web/src/components/Status';
import {WarningBanner} from '../../../../web/src/components/WarningBanner';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings, AccountShelf} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {refusalsText} from '../../../../web/src/text/refusals';
import {pendingConversationText} from '../../../../web/src/text/pendingConversation';
import {statusText} from '../../../../web/src/text/status';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const refusal = liveText(refusalsText);
const pending = liveText(pendingConversationText);
const rail = liveText(statusText).rail;

// proto-live-conversation-limit-setting. Jari 5.11.: the limit on how many
// conversations work at once becomes a setting; where is it and what does it
// look like. Today the daemon's constant (four) refuses a new conversation
// with "Keskustelua ei luotu" and Yritä uudelleen, and nothing says which
// conversations hold the places. The axis is who sets the limit and where
// the person sees what holds a place: A the person's own setting in Settings
// › Tekoäly, with the working list beside it; B the administrator's, a default
// for the installation and a number per person in Ylläpito › Palvelin, the
// person seeing the list in a window; C no number at all, the host refuses
// only when memory runs out, and the refusal itself lists what works now.
// Rail, header, timeline, messages, composer, notices, the settings page and
// its administrator section are production components; the host behind them
// is a fetch stand-in here. Everything is synthetic.
const directions = ['Nyt', 'A Oma', 'B Ylläpitäjä', 'C Ei lukua'];
const LINES = [
  'Nyt: vakio neljä. Uusi keskustelu kieltäytyy, Yritä uudelleen yrittää samaa, eikä mikään kerro, mitkä neljä pitävät paikkaa.',
  'A Oma: raja on henkilön oma asetus Asetukset › Tekoäly -sivulla. Kieltäytyminen vie sinne; asetuksen alla näkyy, mikä työskentelee nyt, ja sen voi pysäyttää.',
  'B Ylläpitäjä: ylläpitäjä asettaa oletuksen koko asennukselle ja tarvittaessa henkilöittäin (Ylläpito › Palvelin). Kieltäytyminen avaa ikkunan, jossa paikkaa pitävät voi pysäyttää.',
  'C Ei lukua: ei asetusta. Palvelin kieltäytyy vain, kun muisti loppuu, ja kieltäytyminen näyttää itse listan siitä, mikä työskentelee nyt.',
];
const NYT = 0, A = 1, B = 2, C = 3;

// ---- Conversations: what holds a place (pi_activity_linux.go) ----
// turn: a turn runs; question: Pi waits for the person's answer; processes:
// a background process Pi started still runs, though the turn has ended.
type Kind = 'turn' | 'question' | 'processes';
type Conv = {id: string; title: string; ws: string; wsName: string; kind?: Kind; since: number; what: string; process?: string};
const CONVS: Conv[] = [
  {id: 'kesa', title: 'Kesäajan virhe', ws: 'ws_a', wsName: 'aurinkokello', kind: 'turn', since: 12, what: 'Ajaa testejä'},
  {id: 'julkaisu', title: 'Julkaisun muistiinpanot', ws: 'ws_k', wsName: 'kotisivu', kind: 'question', since: 48, what: 'Kysyy: julkaistaanko 2.3 vai 2.4?'},
  {id: 'dev', title: 'Kehityspalvelin', ws: 'ws_k', wsName: 'kotisivu', kind: 'processes', since: 130, what: 'Vuoro päättyi, taustalla', process: 'npm run dev'},
  {id: 'svg', title: 'Varjon piirto SVG:ksi', ws: 'ws_a', wsName: 'aurinkokello', kind: 'turn', since: 3, what: 'Piirtää varjoja'},
  {id: 'tunnit', title: 'Viikon tunnit', ws: 'ws_m', wsName: 'muistiinpanot', kind: 'turn', since: 1, what: 'Kirjaa tunteja'},
  {id: 'kuvat', title: 'Kuvien pakkaus', ws: 'ws_k', wsName: 'kotisivu', kind: 'processes', since: 25, what: 'Vuoro päättyi, taustalla', process: 'make images'},
  {id: 'teksti', title: 'Etusivun teksti', ws: 'ws_k', wsName: 'kotisivu', since: 300, what: ''},
  {id: 'kauppa', title: 'Kauppalista', ws: 'ws_m', wsName: 'muistiinpanot', since: 900, what: ''},
];
const byId = new Map(CONVS.map((c) => [c.id, c]));
/** Today's four: the constant fills with these; the other two rest. */
const TODAY_BUSY = ['kesa', 'julkaisu', 'dev', 'svg'];
const NEW_MESSAGE = 'Tee etusivulle tumma teema, joka seuraa järjestelmän asetusta.';
const HOST_CEILING = 30;
const minutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim());

// ---- Host stand-in: who is busy, the limits, one store for the round ----
type Person = {id: string; username: string; administrator: boolean; busy: number; limit: number | null};
const host = {
  busy: new Set<string>(), limit: 6, adminDefault: 6, direction: 0,
  people: [] as Person[],
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
function resetHost(direction = host.direction) {
  host.direction = direction;
  host.busy = new Set(direction === NYT ? TODAY_BUSY : CONVS.filter((c) => c.kind).map((c) => c.id));
  host.limit = direction === NYT ? 4 : 6;
  host.adminDefault = 6;
  host.people = [
    {id: 'u1', username: 'maintainer', administrator: true, busy: 0, limit: null},
    {id: 'u2', username: 'kaisa', administrator: false, busy: 1, limit: null},
    {id: 'u3', username: 'ville', administrator: false, busy: 0, limit: 12},
  ];
}
resetHost(0);
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
/** The limit the person meets: their own (A), the administrator's (B), or
 * the host's memory (C, shown as no number). */
const limitNow = () => (host.direction === B ? (host.people[0].limit ?? host.adminDefault) : host.limit);
const full = () => host.busy.size >= limitNow();
function stop(id: string) { host.busy.delete(id); notify(); }

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GiB = 1024 ** 3;
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(80);
  if (path === '/api/v1/server') return json({schema_version: 1, name: 'Synteettinen', administrator: host.direction === B, version: '0.0.0-proto'});
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
const T0 = Date.UTC(2026, 10, 5, 8, 30);
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'kotisivu',
};

// ---- What holds a place: one row per busy conversation ----
const kindWord = (c: Conv) => (c.kind === 'question' ? rail.asks : c.kind === 'processes' ? rail.background : rail.working);
const stopWord = (c: Conv) => (c.kind === 'processes' ? 'Pysäytä prosessi' : 'Pysäytä vuoro');
function BusyList({onOpen, compact}: {onOpen: (c: Conv) => void; compact?: boolean}) {
  const h = useHost();
  const [stopped, setStopped] = useState<string[]>([]);
  const rows = CONVS.filter((c) => h.busy.has(c.id) || stopped.includes(c.id));
  return (
    <ul className={`rq-busy${compact ? ' compact' : ''}`} data-testid="busy-list">
      {rows.map((c) => {
        const gone = !h.busy.has(c.id);
        return (
          <li key={c.id} data-testid={`busy-${c.id}`} data-state={gone ? 'stopped' : c.kind}>
            <StatusMark label="" tone={gone ? 'neutral' : c.kind === 'question' ? 'warning' : 'info'} animated={!gone && c.kind === 'turn' ? 'running' : false} />
            <div className="rq-busy-text">
              <button type="button" className="rq-busy-title" onClick={() => onOpen(c)}>{c.title}</button>
              <span className="rq-busy-meta">
                {gone ? 'Pysäytetty · paikka vapautui' : (
                  <>{c.wsName} · {kindWord(c)}{c.process ? <> <code>{c.process}</code></> : null} · {minutes(c.since)}</>
                )}
              </span>
            </div>
            {gone ? <Icon name="check" className="rq-busy-ok" /> : (
              <ControlButton data-testid={`stop-${c.id}`} size="row" variant="secondary" onPress={() => { setStopped((s) => [...s, c.id]); stop(c.id); }}>{stopWord(c)}</ControlButton>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Count in words for the card: "Kuusi keskustelua". */
const NUMBERS = ['Nolla', 'Yksi', 'Kaksi', 'Kolme', 'Neljä', 'Viisi', 'Kuusi', 'Seitsemän', 'Kahdeksan', 'Yhdeksän', 'Kymmenen'];
const many = (n: number) => `${NUMBERS[n] ?? n} keskustelu${n === 1 ? '' : 'a'}`;

// ---- The refused new conversation: the moment the limit is met ----
type NewPhase = 'refused' | 'created';
function RefusalCard({direction, phase, tries, onRetry, onEdit, onRaise, onWho, onAdmin, onOpen}: {
  direction: number; phase: NewPhase; tries: number;
  onRetry: () => void; onEdit: () => void; onRaise: () => void; onWho: () => void; onAdmin: () => void; onOpen: (c: Conv) => void;
}) {
  const h = useHost();
  if (phase === 'created') return null;
  const n = h.busy.size, limit = limitNow(), room = n < limit;
  const again = tries > 0 ? ' Yritit uudelleen: yhä täynnä.' : '';
  if (direction === NYT)
    return (
      <InlineNotice data-testid="creation-problem" data-state="refused" title={pending.conversationNotCreated}
        description={refusal.capacity + (tries > 0 ? ` (${tries + 1}. yritys)` : '')} tone="warning"
        actions={[{testId: 'retry', label: pending.retry, onPress: onRetry}, {label: pending.edit, onPress: onEdit}]} />
    );
  if (room)
    return (
      <aside className="ah-notice ah-tone-success rq-room" data-testid="creation-problem" data-state="room">
        <strong>Tilaa on nyt</strong>
        <p>{direction === A ? `Raja on ${limit}, ja ${many(n).toLowerCase()} työskentelee.` : direction === B ? `${many(n)} työskentelee; rajasi on ${limit}.` : 'Paikka vapautui.'} Viestisi on tallessa.</p>
        <div className="ah-actions">
          <ControlButton data-testid="retry" size="row" variant="primary" onPress={onRetry}>Aloita keskustelu</ControlButton>
          <ControlButton size="row" variant="secondary" onPress={onEdit}>{pending.edit}</ControlButton>
        </div>
      </aside>
    );
  if (direction === A)
    return (
      <aside className="ah-notice ah-tone-warning" data-testid="creation-problem" data-state="refused">
        <strong>{pending.conversationNotCreated}</strong>
        <p>{`${many(n)} työskentelee jo, ja asetuksissa rajasi on ${limit}. Nosta rajaa tai pysäytä jokin asetuksista.${again}`}</p>
        <div className="ah-actions">
          <ControlButton data-testid="raise" size="row" variant="primary" onPress={onRaise}>Rajat ja käynnissä olevat</ControlButton>
          <ControlButton data-testid="retry" size="row" variant="secondary" onPress={onRetry}>{pending.retry}</ControlButton>
          <ControlButton size="row" variant="secondary" onPress={onEdit}>{pending.edit}</ControlButton>
        </div>
      </aside>
    );
  if (direction === B) {
    const counts = {turn: 0, question: 0, processes: 0};
    CONVS.forEach((c) => { if (h.busy.has(c.id) && c.kind) counts[c.kind]++; });
    return (
      <aside className="ah-notice ah-tone-warning" data-testid="creation-problem" data-state="refused">
        <strong>{pending.conversationNotCreated}</strong>
        <p>{`Ylläpitäjän asettama raja on ${limit} yhtä aikaa työskentelevää keskustelua, ja ${many(n).toLowerCase()} työskentelee jo.${again}`}</p>
        <div className="rq-kinds" data-testid="busy-kinds">
          {counts.turn ? <StatusMark label={`${counts.turn} vuoro${counts.turn === 1 ? '' : 'a'} käynnissä`} tone="info" animated="running" /> : null}
          {counts.question ? <StatusMark label={`${counts.question} odottaa vastaustasi`} tone="warning" /> : null}
          {counts.processes ? <StatusMark label={`${counts.processes} taustaprosessi${counts.processes === 1 ? '' : 'a'}`} tone="neutral" /> : null}
        </div>
        <div className="ah-actions">
          <ControlButton data-testid="who" size="row" variant="primary" onPress={onWho}>Mitkä pitävät paikkaa?</ControlButton>
          <ControlButton data-testid="retry" size="row" variant="secondary" onPress={onRetry}>{pending.retry}</ControlButton>
          <ControlButton size="row" variant="secondary" onPress={onEdit}>{pending.edit}</ControlButton>
          <ControlButton data-testid="admin-limit" size="row" variant="quiet" onPress={onAdmin}>Muuta rajaa (ylläpito)</ControlButton>
        </div>
      </aside>
    );
  }
  return (
    <aside className="ah-notice ah-tone-warning rq-c-card" data-testid="creation-problem" data-state="refused">
      <strong>{pending.conversationNotCreated}</strong>
      <p>{`Palvelimen muisti ei riitä uuteen keskusteluun juuri nyt. Nämä työskentelevät; pysäytä jokin, niin paikka vapautuu.${again}`}</p>
      <BusyList onOpen={onOpen} compact />
      <div className="ah-actions">
        <ControlButton data-testid="retry" size="row" variant="secondary" onPress={onRetry}>{pending.retry}</ControlButton>
        <ControlButton size="row" variant="secondary" onPress={onEdit}>{pending.edit}</ControlButton>
      </div>
    </aside>
  );
}

/** B: the window the refusal opens. */
function WhoWindow({open, onClose, onOpen}: {open: boolean; onClose: () => void; onOpen: (c: Conv) => void}) {
  const h = useHost();
  return (
    <ModalOverlay className="ah-overlay" isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }} isDismissable>
      <Modal className="ah-modal rq-who-modal">
        <AriaDialog className="ah-dialog" data-testid="who-window" aria-label="Työskentelee nyt">
          <Heading slot="title">Työskentelee nyt · {h.busy.size}/{limitNow()}</Heading>
          <p className="s-desc">Keskustelu pitää paikkaa, kun sen vuoro on kesken, se odottaa vastaustasi tai sen käynnistämä taustaprosessi on yhä käynnissä. Pysäytetty keskustelu jatkuu seuraavasta viestistäsi.</p>
          <BusyList onOpen={(c) => { onClose(); onOpen(c); }} />
          <div className="ah-dialog-actions">
            <ControlButton data-testid="who-close" size="row" variant="primary" onPress={onClose}>Valmis</ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---- Settings: the round's rows placed into the production page ----
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
  return Number.isInteger(n) && n >= 1 && n <= HOST_CEILING ? undefined : `1–${HOST_CEILING}`;
};

/** A: Settings › Tekoäly, a card of its own under the default model. */
function OwnLimitRows({onOpen}: {onOpen: (c: Conv) => void}) {
  const h = useHost();
  return (
    <div className="s-card rq-limit-card" data-testid="own-limit">
      <InlineTextSetting row="live-limit" data-testid="live-limit-input" label="Yhtä aikaa työskentelevät keskustelut"
        description={`Kun näin moni työskentelee, uutta keskustelua ei aloiteta. Oletus 6; palvelin sallii enintään ${HOST_CEILING}.`}
        value={String(h.limit)} unit="enintään" inputMode="decimal" invalid={validLimit}
        onSave={async (next) => { await later(300); host.limit = Number(next); notify(); }} />
      <div className="s-row rq-now-row" data-settings-row="live-now" tabIndex={-1}>
        <div className="s-lbl">
          <strong>Työskentelee nyt · {h.busy.size}/{h.limit}</strong>
          <span className="s-desc">Paikkaa pitää vuoro, kysymys sinulle tai keskustelun käynnistämä taustaprosessi. Pysäytetty keskustelu jatkuu seuraavasta viestistäsi.</span>
        </div>
      </div>
      <div className="rq-now-list"><BusyList onOpen={onOpen} /></div>
    </div>
  );
}

/** B: Ylläpito › Palvelin, a section after the server's own rows. */
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
          description={`Montako keskustelua yksi henkilö voi pitää työssä yhtä aikaa. Yksi työskentelevä keskustelu vie noin 200 Mt muistia; palvelimella on 30 Gt. Enintään ${HOST_CEILING}.`}
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
                        p.limit = draft.trim() === '' ? null : Number(draft);
                        host.people = host.people.map((x) => (x.id === p.id ? {...x, limit: p.limit} : x));
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
  dev: ['Käynnistä kehityspalvelin, niin katson sivua puhelimella.', 'Kehityspalvelin käy taustalla osoitteessa `http://localhost:5173`. Se jatkaa, kunnes pysäytät sen.'],
  svg: ['Piirrä varjon kulku SVG:ksi tunnin välein.', 'Piirrän varjoja klo 6–20…'],
  tunnit: ['Kirjaa tämän viikon tunnit Status.txt:n mukaan.', 'Kirjaan tunteja…'],
  kuvat: ['Pakkaa kuvagallerian kuvat WebP-muotoon.', 'Pakkaus käy taustalla (`make images`), 412 kuvaa. Kerron, kun se on valmis.'],
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
  const [draft, setDraft] = useState('');
  const [given, setGiven] = useState(false);
  const [who, setWho] = useState(false);
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
  const edit = () => { setGiven(true); setDraft(NEW_MESSAGE); };
  const sendNew = (text: string) => {
    if (!text.trim()) return;
    setGiven(false); setDraft('');
    if (full()) { setTries((t) => t + 1); return; }
    host.busy.add('uusi'); setPhase('created'); notify();
  };

  // ---- Rail: today's sections, built from the busy set ----
  const now = Date.now();
  const all: Conv[] = [...CONVS, ...(phase === 'created' ? [{id: 'uusi', title: 'Tumma teema', ws: 'ws_k', wsName: 'kotisivu', kind: 'turn' as Kind, since: 0, what: ''}] : [])];
  const busyHere = (c: Conv) => h.busy.has(c.id);
  const place = (c: Conv) => {
    if (!busyHere(c)) return 'quiet';
    if (c.kind === 'question') return 'yours';
    return 'running';
  };
  const model = (c: Conv): AgentNavModel => {
    const busy = busyHere(c);
    const label = !busy ? 'Odottaa viestiä' : c.kind === 'question' ? rail.asks : c.kind === 'processes' ? rail.background : rail.working;
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
  // A: the person's limit is theirs, so the rail says how full it is.
  const gauge = direction === A ? (
    <button type="button" className={`rq-gauge${h.busy.size >= h.limit ? ' full' : ''}`} data-testid="rail-gauge"
      onClick={() => navigate('/settings/ai#live-limit')} title="Asetukset › Tekoäly">
      {h.busy.size}/{h.limit} paikkaa
    </button>
  ) : null;
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={() => navigate(direction === B ? '/settings/palvelin' : '/settings/ai')} onLogout={noop} />}
      now={
        <>
          <section className="ah-now" data-testid="rail-yours" aria-labelledby="ra-yours">
            <h2 className="ah-rail-section-head" id="ra-yours">Sinun vuorosi{yours.length ? <span className="ah-rail-count ah-rail-count-attention">{yours.length}</span> : null}</h2>
            {yours.length ? <ul>{yours.map(row)}</ul> : <p className="ah-now-empty">Mikään ei odota sinua.</p>}
          </section>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="ra-running">
            <h2 className="ah-rail-section-head" id="ra-running">Käynnissä{running.length ? <span className="ah-rail-count">{running.length}</span> : null}{gauge}</h2>
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
          {direction === A && !admin ? <Into after=".s-main .s-stack > .s-card"><OwnLimitRows onOpen={open} /></Into> : null}
          {direction === B && admin ? <Into after=".s-main > .s-card.ah-administration"><AdminLimitRows /></Into> : null}
        </div>
      </div>
    );
  } else if (isNew) {
    const items: Item[] = [];
    if (phase === 'refused' && !given) items.push({id: 'w', kind: 'user', text: NEW_MESSAGE, time: '', node: <WaitingMessage text={NEW_MESSAGE} state="failed" onCopy={noop} />});
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
            {given && refused ? null : (
              <RefusalCard direction={direction} phase={phase} tries={tries} onRetry={retry} onEdit={edit}
                onRaise={() => navigate('/settings/ai#live-limit')} onWho={() => setWho(true)} onAdmin={() => navigate('/settings/palvelin#live-limit-default')} onOpen={open} />
            )}
          </ConversationStream>
          <Composer value={draft} onChange={setDraft} activity={refused ? 'idle' : 'working'} selectedWorkingMode="steer"
            availability={refused && !given ? {state: 'disabled', reason: pending.notCreatedReason} : undefined}
            onModeChange={noop} onSendNow={(t) => sendNew(t ?? draft)} onSteer={noop} onFollowUp={noop}
            onInterrupt={() => stop('uusi')} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
        </ConversationFrame>
        <WhoWindow open={who} onClose={() => setWho(false)} onOpen={open} />
      </div>
    );
  } else {
    const c = conv!;
    const busy = h.busy.has(c.id);
    const [ask, said] = HISTORY[c.id] ?? ['', ''];
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
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Samanaikaiset keskustelut</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={restart}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
