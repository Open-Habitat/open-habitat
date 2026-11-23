import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/PiOnboarding.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton, ExternalLink} from '../../../../web/src/components/ControlElements';
import {Modalish} from '../../../../web/src/components/GuideParts';
import {Icon} from '../../../../web/src/components/Icon';
import {LetterMark} from '../../../../web/src/components/Integrations';
import {Menu} from '../../../../web/src/components/Overlays';
import {Badge, StatusMark} from '../../../../web/src/components/Status';
import {PeopleRow} from '../../../../web/src/components/ServerSection';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import integrationsExample from '../../../../contracts/v1/examples/integrations.json';
import serverIntegrationsExample from '../../../../contracts/v1/examples/server-integrations.json';
import onboardingExample from '../../../../contracts/v1/examples/server-onboarding-site-key.json';
import copiesExample from '../../../../contracts/v1/examples/server-onboarding-site-key-copies.json';
import speechKeyExample from '../../../../contracts/v1/examples/server-speech-key.json';
import {type Backend, backendName, type Lang, TEXT} from './text';
import './round.css';

// proto-web-search-key, round 3. Jari 23.11.2026 on round 2 chose B: the
// administrator gives the shared search key on the server's Integrations
// page and the person's row is on Settings › Data for agents. Round 2's
// search block was far bigger than its neighbours there. This round shows
// both whole pages with realistic neighbours and varies one thing: how
// search sits among the other services. A: Brave and Staan are each a
// service row of their own, like Google and Dropbox, keyed in a dialog.
// B: one Web search service row, its dialog choosing the service. C: one
// compact row in the same spot whose form opens in place, as in round 2.
// The key's behaviour is round 2's (the speech key's) in all three; A's
// shape forces one change, one search service at a time. Production's
// AccountSettings is unchanged over a fetch stand-in; the round's rows are
// production primitives and classes portalled onto the real page.
// Everything is synthetic.

const NAMES = ['0 Nyt', 'A Palvelu kerrallaan', 'B Yksi Verkkohaku-rivi', 'C Tiivis rivi paikallaan'];
const A = 1, B = 2, C = 3;
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const params = new URLSearchParams(location.search);
const BACKENDS: Backend[] = ['brave', 'staan'];
const other = (b: Backend): Backend => (b === 'brave' ? 'staan' : 'brave');

// ---- The host, as the round imagines the gateway and the daemon read it ----
type View = 'admin' | 'person';
type Key = {backend: Backend; suffix: string; source: 'own' | 'site'; refused?: boolean};
type SiteKey = {backend: Backend; suffix: string; setAt: string};
type Given = Partial<Record<'seeded' | 'replaced' | 'already_current' | 'kept' | 'not_reached' | 'unknown', number>>;
type Host = {
  /** ChatGPT subscription (openai-codex) signed in. */
  chatgpt: boolean;
  /** Claude subscription (claude-bridge) signed in. */
  claude: boolean;
  /** A DeepSeek API key: a provider without its own web search. */
  deepseek: boolean;
  /** The person's ~/.config/web-search/key.json, with its source marker. */
  key: Key | null;
  /** The gateway's shared key and the last giving's outcome words. */
  site: SiteKey | null;
  given: Given;
};
const SITE: SiteKey = {backend: 'brave', suffix: 'k7q2', setAt: '2026-11-03T09:00:00Z'};
const PERSON: Record<string, () => Host> = {
  yllapitaja: () => ({chatgpt: false, claude: true, deepseek: true, key: {backend: 'brave', suffix: 'k7q2', source: 'site'}, site: SITE, given: {}}),
  oma: () => ({chatgpt: true, claude: false, deepseek: true, key: {backend: 'brave', suffix: 'a1b2', source: 'own'}, site: null, given: {}}),
  molemmat: () => ({chatgpt: true, claude: false, deepseek: true, key: {backend: 'staan', suffix: 'e5f8', source: 'own'}, site: SITE, given: {}}),
  'ei-avainta': () => ({chatgpt: false, claude: false, deepseek: true, key: null, site: null, given: {}}),
  natiivi: () => ({chatgpt: true, claude: true, deepseek: false, key: null, site: null, given: {}}),
  torjuttu: () => ({chatgpt: false, claude: false, deepseek: true, key: {backend: 'brave', suffix: 'a1b2', source: 'own', refused: true}, site: null, given: {}}),
};
const ADMIN: Record<string, () => Host> = {
  'ei-avainta': () => ({chatgpt: true, claude: false, deepseek: false, key: null, site: null, given: {}}),
  avain: () => ({chatgpt: true, claude: false, deepseek: false, key: {backend: 'brave', suffix: 'k7q2', source: 'site'}, site: SITE, given: {seeded: 4, kept: 1}}),
};
const scenariosOf = (v: View) => (v === 'admin' ? ADMIN : PERSON);
const REFUSED_DAY = {fi: '9.11.', en: '9 November'};

let view: View = params.get('view') === 'person' ? 'person' : 'admin';
let scenario = params.get('s') ?? '';
if (!scenariosOf(view)[scenario]) scenario = Object.keys(scenariosOf(view))[0];
let host: Host = scenariosOf(view)[scenario]();
/** The administrator's last removal, said on the row until the next change. */
let siteNote = '';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
/** Which sign-ins search on their own, and which need the key. In
 * production the search extension says which providers it serves. */
const natives = (h: Host) => [h.chatgpt && 'ChatGPT', h.claude && 'Claude'].filter(Boolean) as string[];
const needers = (h: Host) => [h.deepseek && 'DeepSeek'].filter(Boolean) as string[];
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const keyShape = /^[A-Za-z0-9_-]{20,128}$/;
/** In the round a key starting "huono" or "bad" fails the trial search. */
const fails = (key: string) => /^(huono|bad)/i.test(key);

/** The person's save: their daemon tries the key with one search first. */
async function saveOwn(backend: Backend, key: string): Promise<'ok' | 'rejected'> {
  await later(600);
  if (fails(key)) return 'rejected';
  host = {...host, key: {backend, suffix: key.slice(-4), source: 'own'}};
  notify();
  return 'ok';
}
/** Removing, as with the speech key, leaves nothing until the administrator
 * saves a key again; it never fetches the site's copy on its own. */
async function removeOwn() {
  await later(250);
  host = {...host, key: null};
  notify();
}
/** The administrator's save: their own daemon tries the key, the gateway
 * stores it, then every joined person's daemon decides on its copy. */
async function saveSite(backend: Backend, key: string): Promise<'ok' | 'rejected'> {
  await later(900);
  if (fails(key)) return 'rejected';
  const earlier = !!host.site;
  siteNote = '';
  host = {...host, site: {backend, suffix: key.slice(-4), setAt: new Date().toISOString()},
    given: earlier ? {replaced: 4, kept: 1} : {seeded: 4, kept: 1, not_reached: 1}};
  notify();
  return 'ok';
}
async function removeSite() {
  await later(250);
  siteNote = t().siteRemoved;
  host = {...host, site: null, given: {}};
  notify();
}

// ---- The fetch stand-in behind production's pages ----
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
function models() {
  const seen = new Date(Date.now() - 60000).toISOString();
  const list = [
    ...(host.claude ? [{id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'claude-bridge', outcome: 'answered', observed_at: seen}, {id: 'claude-opus-5-5', name: 'Claude Opus 5.5', provider: 'claude-bridge'}] : []),
    ...(host.chatgpt ? [{id: 'gpt-6-astra', name: 'GPT-6 Astra', provider: 'openai-codex', outcome: 'answered', observed_at: seen}] : []),
    ...(host.deepseek ? [{id: 'deepseek-v4', name: 'DeepSeek V4', provider: 'deepseek', outcome: 'answered', observed_at: seen}, {id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek'}] : []),
  ];
  const first = list[0];
  return {schema_version: 1, default_provider: first?.provider, default_model: first?.id, default_thinking: 'medium', catalog_status: 'native_cached', models: list};
}
// Realistic neighbours. The administrator's catalog: most services offered,
// Microsoft still waiting for its applications. The person: mail, Dropbox and
// Trello connected; Google and Microsoft still to add.
const adminProviders = () => [
  ...integrationsExample.providers.map((p) =>
    p.id === 'google' ? {id: p.id, available: true, login: p.login, services: p.services}
      : p.id === 'microsoft' ? {...p, available: false, unavailable_reason: 'app_credentials_required'} : p),
  {id: 'apple', available: true, login: 'app_password', services: ['mail', 'calendar', 'contacts']},
  {id: 'caldav', available: true, login: 'app_password', services: ['calendar']},
  {id: 'carddav', available: true, login: 'app_password', services: ['contacts']},
];
const personProviders = integrationsExample.providers.map((p) =>
  p.id === 'google' ? {id: p.id, available: true, login: p.login, services: p.services} : p);
const personAccounts = () => {
  const now = new Date(Date.now() - 4 * 60000).toISOString();
  return integrationsExample.accounts
    .filter((a) => ['imap', 'dropbox', 'trello'].includes(a.provider))
    .map((a) => ({...a, checked_at: now, services: a.services.map((s) => ('last_synced_at' in s ? {...s, last_synced_at: now} : s))}));
};
const copies = () => ({...copiesExample, site_key: {...copiesExample.site_key, set_at: '2026-11-02T09:00:00Z'}, people: [
  {id: '1001', login_hint: 'aino-contoso', username: 'aino'},
  {id: '1002', login_hint: 'anna-contoso', username: 'anna', copy: {provider: 'anthropic', suffix: 'Xa1b', at: '2026-11-02T09:05:00Z', current: true}},
], waiting: 0});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(50);
  if (path === '/api/v1/server') return json({schema_version: 1, name: 'Contoso', administrator: view === 'admin', version: '0.48.0', commit: '1def125b6d0c4e2f9a8b7c6d5e4f3a2b1c0d9e8f'});
  if (path === '/api/v1/pi/models') return json(models());
  if (path.startsWith('/api/v1/pi/credentials')) return json({
    schema_version: 1, openai: {present: false, suffix: null}, anthropic: {present: false, suffix: null},
    deepseek: host.deepseek ? {present: true, suffix: 'd3e4'} : {present: false, suffix: null}, subscription: {present: host.chatgpt},
  });
  if (path === '/api/v1/pi/claude-login') return json({schema_version: 1, state: host.claude ? 'completed' : 'missing'});
  if (path === '/api/v1/speech/key') return json({schema_version: 1, present: true, suffix: 'Kq7Z', region: 'eu', source: 'site'});
  if (path === '/api/v1/server/speech-key') return json(speechKeyExample);
  if (path === '/api/v1/server/integrations') return json({...serverIntegrationsExample});
  if (path === '/api/v1/integrations') return json(view === 'admin'
    ? {...integrationsExample, providers: adminProviders(), accounts: []}
    : {...integrationsExample, providers: personProviders, accounts: personAccounts()});
  if (path === '/api/v1/server/onboarding') return json({...onboardingExample, integrations: []});
  if (path === '/api/v1/server/onboarding/ai-key/copies') return json(copies());
  if (path === '/api/v1/server/access') return json({schema_version: 1, entries: []});
  return new Response('', {status: 404});
};

// ---- Placing the round's rows on production's page ----
/** A display:contents element kept at the spot `find` names; portals render
 * into it. Production's rows arrive after their reads, so it waits for them. */
function useSlot(find: () => {parent: Element; before: Node | null} | null, id: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const slot = document.createElement('div');
    slot.className = 'rq-slot';
    slot.dataset.slot = id;
    const place = () => {
      const at = find();
      if (!at) { if (slot.isConnected) slot.remove(); return; }
      if (at.before === slot) return;
      if (slot.parentElement !== at.parent || slot.nextSibling !== at.before) at.parent.insertBefore(slot, at.before);
    };
    place();
    const o = new MutationObserver(place);
    o.observe(document.body, {childList: true, subtree: true});
    setEl(slot);
    return () => { o.disconnect(); slot.remove(); };
  }, [id]);
  return el;
}
/** Production's own element, never one of the round's inside a slot. */
const q = (s: string) => [...document.querySelectorAll(s)].find((el) => !el.closest('.rq-slot')) ?? null;
const qa = (s: string) => [...document.querySelectorAll(s)].filter((el) => !el.closest('.rq-slot'));
const formatDay = (iso: string) => new Date(iso).toLocaleDateString(lang === 'fi' ? 'fi-FI' : 'en-GB', {day: 'numeric', month: 'numeric', year: 'numeric'});
const keyLink: Record<Backend, string> = {brave: 'https://brave.com/search/api/', staan: 'https://staan.ai/'};
const BackendMark = ({b, small}: {b: Backend; small?: boolean}) => <LetterMark mark={b === 'brave' ? 'Br' : 'St'} tone={b === 'brave' ? 3 : 1} small={small} />;
/** One Web search service (B and C): the globe on the neutral tile. */
const SearchMark = ({small}: {small?: boolean}) => (
  <span className={`ig-mark ig-tone-0 rq-globe${small ? ' sm' : ''}`} aria-hidden="true"><Icon name="globe" /></span>
);

// ---- Shared: the service choice, the key form, its lines ----
function BackendChoice({value, onChange}: {value: Backend; onChange: (b: Backend) => void}) {
  const x = t();
  return (
    <fieldset className="s-prov-opts" data-testid="search-backends">
      <legend className="ah-visually-hidden">{x.service}</legend>
      {BACKENDS.map((b) => (
        <button type="button" key={b} className="s-prov-opt" data-testid={`search-backend-${b}`} aria-pressed={value === b} onClick={() => onChange(b)}>
          <BackendMark b={b} />
          <span className="s-lbl">
            <strong className="s-key-name">{backendName[b]} <Badge label={b === 'brave' ? x.defaultTag : x.euTag} /></strong>
            <span className="s-desc">{b === 'brave' ? x.braveDesc : x.staanDesc}</span>
          </span>
        </button>
      ))}
    </fieldset>
  );
}

/** The speech key's form. The service is chosen first (round 2's deviation
 * 1), unless the row already names it (A). */
function KeyForm({busy, initial, fixed, note, warn, className, onSave, onCancel, onRetype}: {
  busy: boolean; initial: Backend; fixed?: boolean; note: string; warn?: string; className: string;
  onSave: (backend: Backend, key: string) => void; onCancel?: () => void; onRetype: () => void;
}) {
  const x = t();
  const [backend, setBackend] = useState<Backend>(initial);
  const [key, setKey] = useState('');
  const wrong = key.length > 0 && !keyShape.test(key.trim());
  const name = backendName[backend];
  return (
    <form className={`rq-key-form ${className}`} data-testid="search-key-form" data-backend={backend} onSubmit={(e) => { e.preventDefault(); if (keyShape.test(key.trim())) onSave(backend, key.trim()); }}>
      {fixed ? null : <BackendChoice value={backend} onChange={(b) => { setBackend(b); onRetype(); }} />}
      {warn ? <p className="s-desc rq-warn" data-testid="search-key-replaces"><Icon name="info" />{warn}</p> : null}
      <label className="s-field">
        {x.apiKey(name)}
        <input data-testid="search-key-input" type="password" autoComplete="off" spellCheck={false} maxLength={128} value={key}
          aria-invalid={wrong || undefined} onChange={(e) => { setKey(e.target.value); onRetype(); }} />
      </label>
      <p className={`s-desc${wrong ? ' s-bad' : ''}`}>
        {wrong ? <span role="alert">{x.notKey}</span>
          : <>{note} <ExternalLink href={keyLink[backend]} target="_blank" rel="noopener noreferrer">{x.getKey(name)}</ExternalLink></>}
      </p>
      <div className="s-actions">
        {onCancel ? <ControlButton data-testid="search-key-cancel" size="row" variant="quiet" onPress={onCancel}>{x.cancel}</ControlButton> : null}
        <ControlButton data-testid="search-key-save" size="row" variant="primary" type="submit" isDisabled={busy || !keyShape.test(key.trim())}>{x.save}</ControlButton>
      </div>
    </form>
  );
}
function More({admin}: {admin: boolean}) {
  const x = t();
  return (
    <details className="s-more rq-more" data-testid="search-key-more">
      <summary>{x.more}</summary>
      <ul>
        {admin ? <><li>{x.siteNative}</li><li>{x.siteCopy}</li><li>{x.siteJoined}</li><li>{x.siteLimit}</li></>
          : <><li>{x.usedFor}</li><li>{x.goesTo}</li><li>{x.stored} <code>~/.config/web-search/key.json</code>{x.storedTail}</li></>}
      </ul>
    </details>
  );
}
function Line({id, bad, alert, children}: {id: string; bad?: boolean; alert?: boolean; children: ReactNode}) {
  return children ? <p className={`s-desc rq-line${bad ? ' s-bad' : ''}`} role={alert ? 'alert' : 'status'} data-testid={id}>{children}</p> : null;
}
const givenText = (h: Host) => {
  const x = t();
  const given = Object.entries(h.given).filter(([, n]) => n);
  if (!given.length) return '';
  return `${given.map(([w, n]) => `${n} ${x.given[w] ?? w}`).join(', ')}.${h.given.not_reached || h.given.unknown ? x.missed : ''}`;
};

/** The key's dialog (A and B). Saving tries the key first, as in round 2;
 * a refused key keeps the dialog open with the reason. */
function KeyDialog({admin, fixed, initial, onClose}: {admin: boolean; fixed?: Backend; initial: Backend; onClose: () => void}) {
  const x = t();
  const h = useHost();
  const [busy, setBusy] = useState<Backend | null>(null);
  const [refused, setRefused] = useState('');
  // A: a key for the other service replaces the one in use.
  const inUse = admin ? h.site?.backend : h.key?.source === 'own' ? h.key.backend : undefined;
  const warn = fixed && inUse && inUse !== fixed ? (admin ? x.replacesSite : x.replacesOwn)(backendName[inUse]) : undefined;
  const save = async (b: Backend, key: string) => {
    setBusy(b); setRefused('');
    const outcome = await (admin ? saveSite : saveOwn)(b, key);
    setBusy(null);
    if (outcome === 'ok') onClose(); else setRefused(x.rejected(backendName[b]));
  };
  const title = admin ? x.siteDialog(fixed && backendName[fixed]) : x.personDialog(fixed && backendName[fixed]);
  return (
    <Modalish testId="search-key-dialog" title={title} dismissable={!busy} onClose={() => { if (!busy) onClose(); }}>
      <p className="s-desc rq-dialog-lead">{admin ? x.siteIntro : x.usedFor}</p>
      <KeyForm className="rq-dialog-form" busy={!!busy} initial={fixed ?? initial} fixed={!!fixed} warn={warn}
        note={admin ? x.siteSaveNote : x.saveNote} onSave={(b, key) => void save(b, key)} onRetype={() => setRefused('')}
        onCancel={busy ? undefined : onClose} />
      <Line id="search-key-checking">{busy ? (admin ? x.giving : x.checking(backendName[busy])) : ''}</Line>
      <Line id="search-key-rejected" bad alert>{refused}</Line>
      <More admin={admin} />
    </Modalish>
  );
}

// ---- The administrator: rows among the server's services ----
/** The row's key menu, as Tunnukset is for Google and Dropbox: the key and
 * its day on top, as AppLine says who set the credentials, then change and
 * remove. Who got a copy stays on the row. */
function SiteMenu({name, onChange}: {name: string; onChange: () => void}) {
  const x = t();
  const h = useHost();
  return (
    <span data-testid="site-search-menu">
      <Menu label={x.keyMenuOf(name)} trigger={<span>{x.keyMenu}</span>} placement="bottom end"
        heading={<span className="si-app rq-menu-head" data-testid="site-search-menu-given">{x.siteKeyState(backendName[h.site!.backend], h.site!.suffix, formatDay(h.site!.setAt))}</span>}
        items={[{id: 'replace', label: x.changeKeyDots}, {id: 'remove', label: x.removeKey, danger: true}]}
        onAction={(k) => (k === 'replace' ? onChange() : void removeSite())} />
    </span>
  );
}
function SiteDetail({backend}: {backend?: Backend}) {
  const x = t();
  const h = useHost();
  const s = h.site;
  const mine = s && (!backend || s.backend === backend);
  return (
    <>
      <span className="ml-provnote" data-testid={`site-search-detail${backend ? `-${backend}` : ''}`}>
        {mine ? (backend ? x.siteRow(s.suffix, formatDay(s.setAt)) : x.siteRowOne(backendName[s.backend], s.suffix, formatDay(s.setAt)))
          : s && backend ? x.serviceOther(backendName[s.backend])
            : backend ? `${x.search} · ${backend === 'brave' ? x.defaultTag : x.euTag}. ${x.siteRowNone}` : x.siteRowChoice}
      </span>
      {mine ? <span className="ml-provnote" data-testid="site-search-given">{givenText(h)}</span> : null}
      {siteNote && (!backend || backend === 'brave') ? <span className="ml-provnote" role="status" data-testid="site-search-key-saved">{siteNote}</span> : null}
    </>
  );
}
function siteState(backend?: Backend) {
  const x = t();
  const s = host.site;
  if (s && (!backend || s.backend === backend)) return <StatusMark kind="success" tone="success" label={x.offered} data-testid="site-search-status" />;
  if (s && backend) return <StatusMark label={x.notInUse} />;
  return <StatusMark tone="warning" label={x.notOffered} data-testid="site-search-status" />;
}
/** A: one row per search service, like Google and Dropbox. */
function SiteRowsA() {
  const x = t();
  const h = useHost();
  const [open, setOpen] = useState<Backend | null>(null);
  return (
    <>
      {BACKENDS.map((b) => (
        <PeopleRow key={b} className="si-row" testId={`site-search-row-${b}`} data-site={h.site?.backend === b ? 'set' : 'none'}
          mark={<BackendMark b={b} small />} name={<span className="si-main"><span className="si-name">{backendName[b]}</span></span>}
          detail={<SiteDetail backend={b} />} cells={[<React.Fragment key="s">{siteState(b)}</React.Fragment>]}
          end={h.site?.backend === b ? <SiteMenu name={backendName[b]} onChange={() => setOpen(b)} />
            : <ControlButton data-testid={`site-search-set-${b}`} size="row" variant={h.site ? 'quiet' : 'secondary'} onPress={() => setOpen(b)}>{x.setKey}</ControlButton>} />
      ))}
      {open ? <KeyDialog admin fixed={open} initial={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
/** B: one Web search row; the dialog chooses the service. */
function SiteRowB() {
  const x = t();
  const h = useHost();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PeopleRow className="si-row" testId="site-search-row" data-site={h.site?.backend ?? 'none'}
        mark={<SearchMark small />} name={<span className="si-main"><span className="si-name">{x.search}</span></span>}
        detail={<SiteDetail />} cells={[<React.Fragment key="s">{siteState()}</React.Fragment>]}
        end={h.site ? <SiteMenu name={x.search} onChange={() => setOpen(true)} />
          : <ControlButton data-testid="site-search-set" size="row" variant="secondary" onPress={() => setOpen(true)}>{x.setKey}</ControlButton>} />
      {open ? <KeyDialog admin initial={h.site?.backend ?? 'brave'} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
/** C: the same row, its form open under it while there is no key or while
 * changing, as Saneluavain and round 2 have it. */
function SiteRowC() {
  const x = t();
  const h = useHost();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const s = h.site;
  const save = async (b: Backend, key: string) => {
    setBusy(true); setProblem('');
    const outcome = await saveSite(b, key);
    setBusy(false);
    if (outcome === 'ok') setEditing(false); else setProblem(x.rejected(backendName[b]));
  };
  return (
    <>
      <PeopleRow className="si-row" testId="site-search-row" data-site={s?.backend ?? 'none'}
        mark={<SearchMark small />} name={<span className="si-main"><span className="si-name">{x.search}</span></span>}
        detail={<SiteDetail />} cells={[<React.Fragment key="s">{siteState()}</React.Fragment>]}
        end={s && !editing ? (
          <span className="rq-ends">
            <ControlButton data-testid="site-search-key-replace" size="row" isDisabled={busy} onPress={() => setEditing(true)}>{x.replace}</ControlButton>
            <ControlButton data-testid="site-search-key-remove" size="row" variant="quiet" isDisabled={busy} onPress={() => { setProblem(''); void removeSite(); }}>{x.remove}</ControlButton>
          </span>
        ) : null} />
      {!s || editing ? (
        <li className="ml-cmprow rq-inline" data-testid="site-search-inline">
          <KeyForm className="rq-inline-form" busy={busy} initial={s?.backend ?? 'brave'} note={x.siteSaveNote}
            onSave={(b, key) => void save(b, key)} onRetype={() => setProblem('')}
            onCancel={editing ? () => { setEditing(false); setProblem(''); } : undefined} />
          <Line id="search-key-checking">{busy ? x.giving : ''}</Line>
          <Line id="search-key-rejected" bad alert>{problem}</Line>
          <More admin />
        </li>
      ) : null}
    </>
  );
}

// ---- The person: a connected service's card, or a tile to add ----
function sourceText(h: Host) {
  const x = t();
  const k = h.key!;
  return (k.source === 'site' ? x.admins(backendName[k.backend], k.suffix) : x.own(backendName[k.backend], k.suffix)).replace(/\.$/, '');
}
/** The card a connected account has: its key on the top line, the one
 * thing it gives (web search) as the service row, as mail or Dropbox. */
function PersonCard({single, onEdit}: {single: boolean; onEdit: (b: Backend) => void}) {
  const x = t();
  const h = useHost();
  const k = h.key!;
  const need = needers(h), nat = natives(h);
  return (
    <section className="ig-provider" data-settings-row="web-search" tabIndex={-1} aria-label={single ? x.search : backendName[k.backend]}>
      <article className="ig-card" data-testid="search-key" data-source={k.source} data-backend={k.backend}>
        <div className="ig-acc">
          {single ? <SearchMark /> : <BackendMark b={k.backend} />}
          <div>
            <span className="ig-rn">{single ? x.search : backendName[k.backend]}</span>
            <span className="ig-meta" data-testid="search-key-source">{single ? sourceText(h) : (k.source === 'site' ? x.admins('', k.suffix) : x.own('', k.suffix)).replace(/ +…/, ' …').replace(/\.$/, '')}</span>
          </div>
          <ControlButton data-testid="search-key-replace" size="row" variant={k.refused ? 'primary' : 'secondary'} onPress={() => onEdit(k.backend)}>
            {k.source === 'site' ? x.addOwn : x.replace}
          </ControlButton>
          <ControlButton data-testid="search-key-remove" size="row" variant="quiet" onPress={() => void removeOwn()}>{x.remove}</ControlButton>
        </div>
        {k.refused ? (
          <p className="ig-notice" role="status" data-testid="search-key-refused"><Icon name="warning" /><span>{x.refused(backendName[k.backend], REFUSED_DAY[lang]).trim()}</span></p>
        ) : null}
        <div className="ig-svc" data-testid="search-key-service">
          <span className="ig-ic sm"><Icon name="globe" /></span>
          <div>
            <span className="ig-rn">{x.search}</span>
            <span className="ig-meta" data-testid="search-key-users">{x.users(need, nat)}</span>
          </div>
          <div className="ig-sv">
            {k.refused ? <StatusMark tone="danger" kind="error" label={x.notAnswering} /> : <StatusMark tone="success" kind="success" label={x.inUse} />}
          </div>
        </div>
      </article>
    </section>
  );
}
function tileMeta(h: Host, b?: Backend) {
  const x = t();
  const need = needers(h), nat = natives(h);
  if (b && h.key?.source === 'own' && h.key.backend !== b) return {text: x.tileReplaces(backendName[h.key.backend]), bad: false};
  // A: the warning and the reason are said once, on Brave's tile.
  if (b === 'staan') return {text: x.staanTile, bad: false};
  if (!h.key && need.length) return {text: x.tileNeed(need), bad: true};
  if (!h.key && nat.length) return {text: x.tileCovered(nat), bad: false};
  return {text: b ? (b === 'brave' ? x.braveTile : x.staanTile) : x.tileChoice, bad: false};
}
function PersonTile({b, onAdd}: {b?: Backend; onAdd: () => void}) {
  const x = t();
  const h = useHost();
  const m = tileMeta(h, b);
  const bad = m.bad;
  return (
    <div className="ig-tile" data-testid={`search-tile${b ? `-${b}` : ''}`} data-settings-row={b ? undefined : 'web-search'} tabIndex={-1}>
      {b ? <BackendMark b={b} /> : <SearchMark />}
      <div>
        <span className="ig-rn">{b ? backendName[b] : x.search}</span>
        <span className={`ig-meta${bad ? ' rq-bad' : ''}`} data-testid="search-tile-meta">
          {bad ? <Icon name="warning" /> : null}{m.text}
        </span>
      </div>
      <ControlButton data-testid={`search-add${b ? `-${b}` : ''}`} size="row" variant={bad ? 'primary' : 'secondary'} onPress={onAdd}>{x.addKeyDots}</ControlButton>
    </div>
  );
}
/** Where a connected card goes: after the last connected account, before
 * Lisää tili, as a newly connected account would. */
const afterConnected = () => {
  const list = qa('.ig-main > .ig-provider');
  const last = list[list.length - 1];
  return last ? {parent: last.parentElement!, before: last.nextSibling} : null;
};
const intoTiles = () => { const g = q('.ig-main > .ig-tiles'); return g ? {parent: g, before: null} : null; };
function PersonA() {
  const h = useHost();
  const [open, setOpen] = useState<Backend | null>(null);
  const card = useSlot(afterConnected, 'pa-card');
  const tiles = useSlot(intoTiles, 'pa-tiles');
  const k = h.key;
  return (
    <>
      {card && k ? createPortal(<div data-testid="search-place" data-place="services"><PersonCard single={false} onEdit={setOpen} /></div>, card) : null}
      {tiles ? createPortal(<>{BACKENDS.filter((b) => b !== k?.backend).map((b) => <PersonTile key={b} b={b} onAdd={() => setOpen(b)} />)}</>, tiles) : null}
      {!k && tiles ? createPortal(<span data-testid="search-place" data-place="services" hidden />, tiles) : null}
      {open ? <KeyDialog admin={false} fixed={open} initial={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
function PersonB() {
  const h = useHost();
  const [open, setOpen] = useState(false);
  const card = useSlot(afterConnected, 'pb-card');
  const tiles = useSlot(intoTiles, 'pb-tiles');
  const k = h.key;
  return (
    <>
      {card && k ? createPortal(<div data-testid="search-place" data-place="service"><PersonCard single onEdit={() => setOpen(true)} /></div>, card) : null}
      {tiles && !k ? createPortal(<div className="rq-contents" data-testid="search-place" data-place="service"><PersonTile onAdd={() => setOpen(true)} /></div>, tiles) : null}
      {open ? <KeyDialog admin={false} initial={k?.source === 'own' ? k.backend : 'brave'} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
/** C: one compact card at the top of the connected services, whatever the
 * state, its form opening inside it as in round 2. */
function PersonC() {
  const x = t();
  const h = useHost();
  const slot = useSlot(() => { const f = q('.ig-main > .ig-provider'); return f ? {parent: f.parentElement!, before: f} : null; }, 'pc');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<Backend | null>(null);
  const [refused, setRefused] = useState('');
  const k = h.key;
  const need = needers(h), nat = natives(h);
  const formOpen = editing || (!k && need.length > 0);
  const save = async (b: Backend, key: string) => {
    setBusy(b); setRefused('');
    const outcome = await saveOwn(b, key);
    setBusy(null);
    if (outcome === 'ok') setEditing(false); else setRefused(x.rejected(backendName[b]));
  };
  if (!slot) return null;
  return createPortal(
    <section className="ig-provider" data-testid="search-place" data-place="compact" data-settings-row="web-search" tabIndex={-1} aria-label={x.search}>
      <article className="ig-card" data-testid="search-key" data-source={k?.source ?? 'none'}>
        <div className="ig-acc">
          <SearchMark />
          <div>
            <span className="ig-rn">{x.search}</span>
            <span className={`ig-meta${k?.refused || (!k && need.length) ? ' rq-bad' : ''}`} data-testid="search-key-source">
              {!k ? (need.length ? x.none(need) : x.noneCovered(nat))
                : `${sourceText(h)}. ${x.users(need, nat)}`}
            </span>
          </div>
          {k?.refused ? <StatusMark tone="danger" kind="error" label={x.notAnswering} /> : null}
          {k && !editing ? (
            <>
              <ControlButton data-testid="search-key-replace" size="row" variant={k.refused ? 'primary' : 'secondary'} isDisabled={!!busy} onPress={() => setEditing(true)}>
                {k.source === 'site' ? x.addOwn : x.replace}
              </ControlButton>
              <ControlButton data-testid="search-key-remove" size="row" variant="quiet" isDisabled={!!busy} onPress={() => void removeOwn()}>{x.remove}</ControlButton>
            </>
          ) : !k && !formOpen ? (
            <ControlButton data-testid="search-add" size="row" onPress={() => setEditing(true)}><Icon name="plus" />{x.add}</ControlButton>
          ) : null}
        </div>
        {k?.refused ? <p className="ig-notice" role="status" data-testid="search-key-refused"><Icon name="warning" /><span>{x.refused(backendName[k.backend], REFUSED_DAY[lang]).trim()}</span></p> : null}
        {formOpen ? (
          <div className="rq-card-form">
            <KeyForm className="rq-inline-form" busy={!!busy} initial={k?.source === 'own' ? k.backend : 'brave'} note={x.saveNote}
              onSave={(b, key) => void save(b, key)} onRetype={() => setRefused('')}
              onCancel={editing ? () => { setEditing(false); setRefused(''); } : undefined} />
            <Line id="search-key-checking">{busy ? x.checking(backendName[busy]) : ''}</Line>
            <Line id="search-key-rejected" bad alert>{refused}</Line>
            <More admin={false} />
          </div>
        ) : null}
      </article>
    </section>,
    slot,
  );
}

function AdminRows({direction}: {direction: number}) {
  const slot = useSlot(() => { const l = q('[data-testid="si-rows"]'); return l ? {parent: l, before: null} : null; }, `admin-${direction}`);
  if (!slot) return null;
  return createPortal(
    <>
      <li className="rq-marker" data-testid="search-place" data-place={direction === A ? 'services' : direction === B ? 'service' : 'compact'} hidden />
      {direction === A ? <SiteRowsA /> : direction === B ? <SiteRowB /> : <SiteRowC />}
    </>,
    slot,
  );
}

// ---- The page ----
function Page({direction}: {direction: number}) {
  const section = view === 'admin' ? 'palvelinintegraatiot' : 'tiedot';
  const rail = (
    <WorkspaceRail>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  const main = (
    <div className="ah-settings-layer">
      <div className="ah-state">
        <AccountSettings routeSection={section} onNavigate={() => {}}
          profile={{name: view === 'admin' ? 'Aino Admin' : 'Anna Esimerkki', email: '', avatar_url: ''}} csrf="prototype"
          onPiSignIn={() => {}} modelSelector={<button type="button" className="md-pill">{models().models[0]?.name ?? '—'} · medium</button>}
          onClose={() => {}} />
      </div>
      {direction === 0 ? null : view === 'admin' ? <AdminRows direction={direction} />
        : direction === A ? <PersonA /> : direction === B ? <PersonB /> : <PersonC />}
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={lang === 'fi' ? 'Asetukset' : 'Settings'} rail={rail} main={main} />
    </StatusBellProvider>
  );
}

let reviewTheme = params.get('theme') === 'dark' ? 'dark' : 'light';
let reviewMotion = 'system';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [motion, setMotion] = useState(reviewMotion);
  const [language, setLanguage] = useState(lang);
  const [v, setV] = useState<View>(view);
  const [s, setS] = useState(scenario);
  const [generation, setGeneration] = useState(0);
  const [toast, setToast] = useState('');
  const bar = useRef<HTMLElement>(null);
  const x = TEXT[language];
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
  useEffect(() => {
    if (motion === 'reduce') document.documentElement.dataset.motion = 'reduce';
    else delete document.documentElement.dataset.motion;
  }, [motion]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  // A service's page opens in a new tab in production; here it is named.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="https://"]') as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      setToast(`${x.newTab} ${a.href}`);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, [x]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 5000); return () => clearTimeout(id); }, [toast]);
  const restart = (nextView = v, next = s) => {
    if (!scenariosOf(nextView)[next]) next = Object.keys(scenariosOf(nextView))[0];
    view = nextView; scenario = next; host = scenariosOf(nextView)[next](); siteNote = '';
    setV(nextView); setS(next); setToast(''); setGeneration((g) => g + 1);
  };
  const options = v === 'admin' ? x.adminScenarios : x.personScenarios;
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-view={v} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.view} <select id="view" value={v} onChange={(e) => restart(e.target.value as View)}>
          <option value="admin">{x.admin}</option><option value="person">{x.person}</option></select></label>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => restart(v, e.target.value)}>
          {Object.keys(scenariosOf(v)).map((id) => <option key={id} value={id}>{options[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.motion} <select id="motion" value={motion} onChange={(e) => { reviewMotion = e.target.value; setMotion(reviewMotion); }}>
          <option value="system">{x.motionSystem}</option><option value="reduce">{x.motionReduce}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); setGeneration((g) => g + 1);
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => restart()}>{x.reset}</button>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${v}-${s}-${language}`} enabled>
          <MemoryRouter key={`${generation}-${v}-${s}-${language}`} initialEntries={['/settings']}>
            <Page direction={direction} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {toast ? <p className="rq-toast" role="status" data-testid="rq-toast">{toast}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(next: ReactNode) { host = scenariosOf(view)[scenario](); siteNote = ''; flushSync(() => root.render(next === '' ? null : next)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
