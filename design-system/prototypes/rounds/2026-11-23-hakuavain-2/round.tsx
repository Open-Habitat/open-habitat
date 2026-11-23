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
import {Icon} from '../../../../web/src/components/Icon';
import {LetterMark} from '../../../../web/src/components/Integrations';
import {Badge, StatusMark} from '../../../../web/src/components/Status';
import {SectionLead, ServerSection} from '../../../../web/src/components/ServerSection';
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

// proto-web-search-key, round 2. Jari 23.11.2026: the search key is first
// of all a server-level setting and works the same way as the Soniox
// speech key: the administrator's shared key is copied into each person's
// native config (ADR 0030, SpeechKeyAdministration, GiveSiteKey), and the
// person's view follows the speech key's. Both key rows here are the speech
// key's rows with the search key's two real differences (the service is
// chosen, and only models without their own search use the key) and the
// later refusal an unattended agent meets. Axis: which family the key
// belongs to, so where it sits for the administrator and for the person
// alike. 0 is today's speech key, which the search key follows. A gives it
// a section of its own beside dictation on both sides; B treats it as an
// integration (Palvelinintegraatiot › Tiedot agenteille); C as part of the
// AI (AI-avain › Tekoäly). Production's AccountSettings is unchanged over a
// fetch stand-in; the round's rows are composed of production primitives
// and classes and portalled onto the real page. Everything is synthetic.

const NAMES = ['0 Nyt', 'A Oma osio', 'B Tiedot agenteille', 'C Tekoäly'];
const NOW = 0, A = 1, B = 2, C = 3;
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const params = new URLSearchParams(location.search);

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
  host = {...host, site: {backend, suffix: key.slice(-4), setAt: new Date().toISOString()},
    given: earlier ? {replaced: 4, kept: 1} : {seeded: 4, kept: 1, not_reached: 1}};
  notify();
  return 'ok';
}
async function removeSite() {
  await later(250);
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
const providers = integrationsExample.providers.map((p) =>
  p.id === 'google' ? {id: p.id, available: true, login: p.login, services: p.services} : p);
const copies = () => ({...copiesExample, site_key: {...copiesExample.site_key, set_at: '2026-11-02T09:00:00Z'}, people: [
  {id: '1001', login_hint: 'aino-contoso', username: 'aino'},
  {id: '1002', login_hint: 'anna-contoso', username: 'anna', copy: {provider: 'anthropic', suffix: 'Xa1b', at: '2026-11-02T09:05:00Z', current: true}},
  {id: '1003', login_hint: 'mikkok', username: 'mikko', copy: {provider: 'anthropic', suffix: 'Xa1b', at: '2026-11-02T09:05:00Z', current: true}},
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
  if (path === '/api/v1/integrations') return json({...integrationsExample, providers, accounts: []});
  if (path === '/api/v1/server/onboarding') return json({...onboardingExample, integrations: []});
  if (path === '/api/v1/server/onboarding/ai-key/copies') return json(copies());
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
const formatDay = (iso: string) => new Date(iso).toLocaleDateString(lang === 'fi' ? 'fi-FI' : 'en-GB', {day: 'numeric', month: 'numeric', year: 'numeric'});
const keyLink: Record<Backend, string> = {brave: 'https://brave.com/search/api/', staan: 'https://staan.ai/'};

// ---- Shared by both rows: the service choice and the key form ----
function BackendChoice({value, onChange}: {value: Backend; onChange: (b: Backend) => void}) {
  const x = t();
  return (
    <fieldset className="s-prov-opts" data-testid="search-backends">
      <legend className="ah-visually-hidden">{x.service}</legend>
      {(['brave', 'staan'] as Backend[]).map((b) => (
        <button type="button" key={b} className="s-prov-opt" data-testid={`search-backend-${b}`} aria-pressed={value === b} onClick={() => onChange(b)}>
          <LetterMark mark={b === 'brave' ? 'Br' : 'St'} tone={b === 'brave' ? 3 : 1} />
          <span className="s-lbl">
            <strong className="s-key-name">{backendName[b]} <Badge label={b === 'brave' ? x.defaultTag : x.euTag} /></strong>
            <span className="s-desc">{b === 'brave' ? x.braveDesc : x.staanDesc}</span>
          </span>
        </button>
      ))}
    </fieldset>
  );
}

/** The speech key's form with the service chosen first: a search key's
 * service cannot be found by trying it, because trying a key at the wrong
 * service hands it to a party it was not meant for. */
function KeyForm({busy, initial, note, onSave, onCancel, onRetype}: {
  busy: boolean; initial: Backend; note: string;
  onSave: (backend: Backend, key: string) => void; onCancel?: () => void; onRetype: () => void;
}) {
  const x = t();
  const [backend, setBackend] = useState<Backend>(initial);
  const [key, setKey] = useState('');
  const wrong = key.length > 0 && !keyShape.test(key.trim());
  const name = backendName[backend];
  return (
    <form className="s-editor rq-key-form" data-testid="search-key-form" onSubmit={(e) => { e.preventDefault(); if (keyShape.test(key.trim())) onSave(backend, key.trim()); }}>
      <BackendChoice value={backend} onChange={(b) => { setBackend(b); onRetype(); }} />
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
function More({children}: {children: ReactNode}) {
  return (
    <div className="s-editor">
      <details className="s-more" data-testid="search-key-more">
        <summary>{t().more}</summary>
        <ul>{children}</ul>
      </details>
    </div>
  );
}
function Line({id, bad, alert, children}: {id: string; bad?: boolean; alert?: boolean; children: ReactNode}) {
  return children ? <p className={`s-editor s-desc${bad ? ' s-bad' : ''}`} role={alert ? 'alert' : 'status'} data-testid={id}>{children}</p> : null;
}

// ---- The person's row: Settings › Sanelu's row for the search key ----
function PersonSearchKey() {
  const x = t();
  const h = useHost();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<Backend | null>(null);
  const [refused, setRefused] = useState('');
  const [saved, setSaved] = useState('');
  const k = h.key;
  const need = needers(h), nat = natives(h);
  // As in Sanelu the form stands open while there is no key, unless every
  // model searches on its own and the key is only something to add.
  const formOpen = editing || (!k && need.length > 0);
  const save = async (backend: Backend, key: string) => {
    setBusy(backend); setRefused(''); setSaved('');
    const outcome = await saveOwn(backend, key);
    setBusy(null);
    if (outcome === 'ok') { setEditing(false); setSaved(x.saved(backendName[backend])); } else setRefused(x.rejected(backendName[backend]));
  };
  return (
    <div className="s-row s-marked" data-testid="search-key" data-settings-row="web-search" tabIndex={-1} data-source={k?.source ?? 'none'}>
      <Icon name="globe" />
      <div className="s-lbl">
        <strong>{x.key}</strong>
        <span className={`s-desc${k?.refused ? ' s-bad' : ''}`} data-testid="search-key-source">
          {!k ? (need.length ? x.none(need) : x.noneCovered(nat))
            : (k.source === 'site' ? x.admins(backendName[k.backend], k.suffix) : x.own(backendName[k.backend], k.suffix))
              + (k.refused ? x.refused(backendName[k.backend], REFUSED_DAY[lang]) : '')}
        </span>
        {k ? <span className="s-desc" data-testid="search-key-users">{x.users(need, nat)}</span> : null}
      </div>
      <div className="s-val">
        {k?.refused ? <StatusMark tone="danger" kind="error" label={x.notAnswering} /> : null}
        {!k && need.length && !formOpen ? <StatusMark tone="warning" kind="error" label={x.noSearch} /> : null}
        {k && !editing ? (
          <>
            <ControlButton data-testid="search-key-replace" size="row" variant={k.refused ? 'primary' : undefined} isDisabled={!!busy} onPress={() => { setSaved(''); setEditing(true); }}>
              {k.source === 'site' ? x.addOwn : x.replace}
            </ControlButton>
            <ControlButton data-testid="search-key-remove" size="row" variant="quiet" isDisabled={!!busy} onPress={() => { setSaved(''); void removeOwn(); }}>{x.remove}</ControlButton>
          </>
        ) : !k && !formOpen ? (
          <ControlButton data-testid="search-key-add" size="row" onPress={() => { setSaved(''); setEditing(true); }}><Icon name="plus" />{x.add}</ControlButton>
        ) : null}
      </div>
      {formOpen ? (
        <KeyForm busy={!!busy} initial={k?.source === 'own' ? k.backend : 'brave'} note={x.saveNote}
          onSave={(b, key) => void save(b, key)} onRetype={() => setRefused('')}
          onCancel={editing ? () => { setEditing(false); setRefused(''); } : undefined} />
      ) : null}
      <Line id="search-key-checking">{busy ? x.checking(backendName[busy]) : ''}</Line>
      <Line id="search-key-saved">{saved}</Line>
      <Line id="search-key-rejected" bad alert>{refused}</Line>
      <More>
        <li>{x.usedFor}</li>
        <li>{x.goesTo}</li>
        <li>{x.stored} <code>~/.config/web-search/key.json</code>{x.storedTail}</li>
      </More>
    </div>
  );
}

// ---- The administrator's row: Saneluavain's row for the search key ----
function SiteSearchKey() {
  const x = t();
  const h = useHost();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState('');
  const s = h.site;
  const given = Object.entries(h.given).filter(([, n]) => n);
  const missed = !!(h.given.not_reached || h.given.unknown);
  const save = async (backend: Backend, key: string) => {
    setBusy(true); setProblem(''); setSaved('');
    const outcome = await saveSite(backend, key);
    setBusy(false);
    if (outcome === 'ok') { setEditing(false); setSaved(x.siteSaved(backendName[backend])); } else setProblem(x.rejected(backendName[backend]));
  };
  return (
    <div className="s-row s-marked" data-testid="site-search-key" data-settings-row="site-search-key" tabIndex={-1} data-site={s ? s.backend : 'none'}>
      <Icon name="globe" />
      <div className="s-lbl">
        <strong>{x.siteKey}</strong>
        <span className="s-desc" data-testid="site-search-key-state">{s ? x.siteKeyState(backendName[s.backend], s.suffix, formatDay(s.setAt)) : x.siteNone}</span>
      </div>
      <div className="s-val">
        {s && !editing ? (
          <>
            <ControlButton data-testid="site-search-key-replace" size="row" isDisabled={busy} onPress={() => { setSaved(''); setEditing(true); }}>{x.replace}</ControlButton>
            <ControlButton data-testid="site-search-key-remove" size="row" variant="quiet" isDisabled={busy}
              onPress={() => { setProblem(''); void removeSite().then(() => setSaved(x.siteRemoved)); }}>{x.remove}</ControlButton>
          </>
        ) : null}
      </div>
      {!s || editing ? (
        <KeyForm busy={busy} initial={s?.backend ?? 'brave'} note={x.siteSaveNote}
          onSave={(b, key) => void save(b, key)} onRetype={() => setProblem('')}
          onCancel={editing ? () => { setEditing(false); setProblem(''); } : undefined} />
      ) : null}
      <Line id="site-search-key-giving">{busy ? x.giving : ''}</Line>
      <Line id="site-search-key-saved">{saved}</Line>
      <Line id="site-search-given">{given.length ? `${given.map(([w, n]) => `${n} ${x.given[w] ?? w}`).join(', ')}.${missed ? x.missed : ''}` : ''}</Line>
      <Line id="site-search-key-problem" bad alert>{problem}</Line>
      <More>
        <li>{x.siteNative}</li>
        <li>{x.siteCopy}</li>
        <li>{x.siteJoined}</li>
        <li>{x.siteLimit}</li>
      </More>
    </div>
  );
}

// ---- A: a section of its own beside dictation, on both sides ----
/** The section is not in production's list, so A stands on the dictation
 * section's route: its own link goes in after dictation's and takes the
 * current mark, and production's page under it is set aside. */
function DirectionA() {
  const admin = view === 'admin';
  const after = admin ? 'saneluavain' : 'sanelu';
  const x = t();
  const nav = useSlot(() => { const l = q(`[data-testid="settings-${after}"]`); return l ? {parent: l.parentElement!, before: l.nextSibling} : null; }, 'a-nav');
  const page = useSlot(() => { const m = q('.s-main'); return m ? {parent: m, before: null} : null; }, 'a-page');
  useLayoutEffect(() => {
    const unmark = () => q(`[data-testid="settings-${after}"][aria-current]`)?.removeAttribute('aria-current');
    unmark();
    const o = new MutationObserver(unmark);
    o.observe(document.body, {childList: true, attributes: true, subtree: true, attributeFilter: ['aria-current']});
    return () => o.disconnect();
  }, [after]);
  const label = admin ? x.siteSection : x.webSearch;
  return (
    <>
      {nav ? createPortal(
        <a className="s-nav-i" data-testid="settings-hakuavain" href="#" aria-current="page" onClick={(e) => e.preventDefault()}>
          <Icon name="globe" />{label}
        </a>, nav) : null}
      {page ? createPortal(
        <div className="rq-a-page" data-testid="search-place" data-place="own">
          <h2 data-testid="settings-section-hakuavain">{label}</h2>
          {admin ? (
            <ServerSection>
              <SectionLead>{x.siteIntro}</SectionLead>
              <div className="s-card ah-administration"><SiteSearchKey /></div>
            </ServerSection>
          ) : (
            <div className="s-stack"><div className="s-card"><PersonSearchKey /></div></div>
          )}
        </div>, page) : null}
    </>
  );
}

// ---- B: an integration, top of Palvelinintegraatiot and Tiedot agenteille ----
function DirectionB() {
  const admin = view === 'admin';
  const x = t();
  // The administrator's card opens the page; the person's comes after the
  // page's own intro, before the accounts and their warning.
  const slot = useSlot(() => {
    if (admin) { const h2 = q('.s-main > h2'); return h2 ? {parent: h2.parentElement!, before: h2.nextSibling} : null; }
    const warn = q('.ig-main > .ig-warn');
    return warn ? {parent: warn.parentElement!, before: warn} : null;
  }, 'b');
  if (!slot) return null;
  return createPortal(
    <section className="s-keys rq-b" data-testid="search-place" data-place="integrations" aria-labelledby="rq-b-h">
      <h3 className="s-h3" id="rq-b-h">{x.webSearch}</h3>
      {admin ? <p className="s-desc rq-lead">{x.siteIntro}</p> : null}
      <div className={`s-card${admin ? ' ah-administration' : ''}`}>{admin ? <SiteSearchKey /> : <PersonSearchKey />}</div>
    </section>,
    slot,
  );
}

// ---- C: part of the AI, under the AI key and the API keys ----
function DirectionC() {
  const admin = view === 'admin';
  const x = t();
  const slot = useSlot(() => {
    if (admin) {
      // After the AI key page's own content, before the version line.
      const line = q('.s-main > .s-version-line');
      return line ? {parent: line.parentElement!, before: line} : null;
    }
    const keys = q('.s-keys');
    return keys ? {parent: keys.parentElement!, before: keys.nextSibling} : null;
  }, 'c');
  // Production lands on rows it lists; the round's row is landed on here.
  useEffect(() => {
    if (!slot || !admin) return;
    const id = setTimeout(() => slot.querySelector('[data-settings-row]')?.scrollIntoView({block: 'center'}), 400);
    return () => clearTimeout(id);
  }, [slot, admin]);
  if (!slot) return null;
  return createPortal(
    <section className="s-keys rq-c" data-testid="search-place" data-place="ai" aria-labelledby="rq-c-h">
      <h3 className="s-h3" id="rq-c-h">{admin ? x.siteSection : x.webSearch}</h3>
      {admin ? <p className="s-desc rq-lead">{x.siteIntro}</p> : null}
      <div className={`s-card${admin ? ' ah-administration' : ''}`}>{admin ? <SiteSearchKey /> : <PersonSearchKey />}</div>
    </section>,
    slot,
  );
}

// ---- The page ----
/** Where each direction opens, per view: today on dictation. */
const ROUTE: Record<View, {section: string; row?: string}[]> = {
  admin: [{section: 'saneluavain'}, {section: 'saneluavain'}, {section: 'palvelinintegraatiot'}, {section: 'aiavain', row: 'site-search-key'}],
  person: [{section: 'sanelu'}, {section: 'sanelu'}, {section: 'tiedot'}, {section: 'tekoaly', row: 'web-search'}],
};
function Page({direction}: {direction: number}) {
  const route = ROUTE[view][direction];
  const rail = (
    <WorkspaceRail>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  const main = (
    <div className={`ah-settings-layer${direction === A ? ' rq-a' : ''}`}>
      <div className="ah-state">
        <AccountSettings routeSection={route.section} routeRow={route.row} onNavigate={() => {}}
          profile={{name: view === 'admin' ? 'Aino Admin' : 'Anna Esimerkki', email: '', avatar_url: ''}} csrf="prototype"
          onPiSignIn={() => {}} modelSelector={<button type="button" className="md-pill">{models().models[0]?.name ?? '—'} · medium</button>}
          onClose={() => {}} />
      </div>
      {direction === A ? <DirectionA /> : direction === B ? <DirectionB /> : direction === C ? <DirectionC /> : null}
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
    view = nextView; scenario = next; host = scenariosOf(nextView)[next]();
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
const stageSink = {set innerHTML(next: ReactNode) { host = scenariosOf(view)[scenario](); flushSync(() => root.render(next === '' ? null : next)); }};
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
void NOW;
