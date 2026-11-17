import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings} from '../../../../web/src/components/Account';
import {type ConnectStage, ConnectDialog} from '../../../../web/src/components/Integrations';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import type {Account, IntegrationList, LoginView, Provider} from '../../../../web/src/app/integrations';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import integrationsExample from '../../../../contracts/v1/examples/integrations.json';
import {type HelpId, HELP_IDS, type Lang, REFUSALS, TEXT, WHO} from './text';
import './round.css';

// google-personal-accounts, round 2: the person's Google connect flow
// (Settings › Tiedot agenteille › Google), once the server's Google app may
// be External, published and unverified. Axis: where the help for Google's
// own screens (the unverified-app warning and the hard refusals) lives in
// Habitat's dialog. A adds one note and a help link to production's
// PasteStep. B turns the existing "error page is expected" note into the
// whole route through Google's tab, with the refusals as a branch. C puts a
// check card before Google with stopping as its own choice, and a chooser
// for what Google showed while waiting. The dialog is production's
// ConnectDialog; the round's pieces sit in it through portal slots.
// Habitat cannot detect Google's warning or refusals (they happen in
// Google's tab), so the help is conditional in every direction. Synthetic.

const NAMES = ['A Muistutus', 'B Reitti', 'C Tarkistus'];
const A = 0, B = 1, C = 2;
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];

const ADDRESS = 'aino.esimerkki@gmail.example';
const CLIENT_ID = '123456789012-exampleclientid0000000000000000.apps.googleusercontent.com';
const PREFIX = 'http://localhost';
const AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(PREFIX)}&response_type=code&access_type=offline&prompt=consent&state=prototype-state&code_challenge=prototype&code_challenge_method=S256&scope=openid%20email`;
/** The browser already holds the client ID: it is in the sign-in address the
 * daemon gives (`authorization_url`). No new host field is needed for it. */
const clientIdOf = (href: string) => { try { return new URL(href).searchParams.get('client_id') ?? ''; } catch { return ''; } };

// ---- Host state, as the round imagines it ----
type Phase = 'intro' | 'change' | 'open' | 'completing' | 'done' | 'failed';
type Host = {
  phase: Phase;
  /** The person opened Google's tab (PasteStep's own state, mirrored). */
  opened: boolean;
  help: HelpId | null;
  /** A's help panel or B's warning step detail is open. */
  expanded: boolean;
  /** C: "I don't recognise the server" chosen. */
  stopped: boolean;
  failure?: 'cancelled' | 'expired' | 'nothing_granted';
  atGoogle?: boolean;
  partial: boolean;
  relogin: boolean;
  dialog: boolean;
  /** The Google account already exists (level change, relogin, after connect). */
  account: boolean;
};
const base: Host = {phase: 'open', opened: false, help: null, expanded: false, stopped: false, partial: false, relogin: false, dialog: true, account: false};
const opened = (help: HelpId | null = null): Host => ({...base, opened: true, help, expanded: !!help});
const SCENARIOS: Record<string, () => Host> = {
  taso: () => ({...base, phase: 'intro'}),
  ennen: () => ({...base}),
  odottaa: () => opened(),
  varoitus: () => opened('warning'),
  tuntematon: () => opened('unfamiliar'),
  'esto-org': () => opened('org'),
  'esto-sisainen': () => opened('internal'),
  'esto-testi': () => opened('testing'),
  'esto-raja': () => opened('cap'),
  'esto-tahti': () => opened('rate'),
  peruttu: () => ({...base, phase: 'failed', failure: 'cancelled', atGoogle: true}),
  vanhentui: () => ({...base, phase: 'failed', failure: 'expired'}),
  yhdistetty: () => ({...base, phase: 'done', account: true}),
  osittain: () => ({...base, phase: 'done', partial: true, account: true}),
  'ei-mitaan': () => ({...base, phase: 'failed', failure: 'nothing_granted'}),
  tasonvaihto: () => ({...base, phase: 'change', account: true}),
  uudelleen: () => ({...base, relogin: true, account: true}),
};
const SCENARIO_IDS = Object.keys(SCENARIOS);
let scenario = new URLSearchParams(location.search).get('s') ?? 'ennen';
if (!SCENARIOS[scenario]) scenario = 'ennen';
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const set = (next: Partial<Host>) => { host = {...host, ...next}; listeners.forEach((f) => f()); };
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}

// ---- Fixtures behind production's page ----
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GOOGLE: Provider = {id: 'google', available: true, login: 'pasted_redirect', services: ['mail', 'calendar', 'contacts', 'drive'],
  levels: [{id: 'full', available: true}, {id: 'drafts', available: false, reason: 'not_offered'}, {id: 'read', available: true}]};
const SCOPE = (s: string) => `https://www.googleapis.com/auth/${s}`;
function account(h: Host): Account {
  const partial = h.partial;
  return {provider: 'google', address: ADDRESS, checked_at: '2026-11-17T08:30:00Z', level: partial ? undefined : 'full',
    grant: {granted: ['openid', 'email', SCOPE('gmail.modify'), SCOPE('drive'), ...(partial ? [] : [SCOPE('calendar'), SCOPE('contacts')])],
      not_granted: partial ? [SCOPE('calendar'), SCOPE('contacts')] : []},
    services: [
      {id: 'mail', state: 'ok', access: 'full'},
      {id: 'calendar', state: 'ok', access: partial ? 'none' : 'full'},
      {id: 'contacts', state: 'ok', access: partial ? 'none' : 'full'},
      {id: 'drive', state: 'ok', access: 'full', directory: `~/cloud/google-drive/${ADDRESS}`, last_synced_at: '2026-11-17T08:31:00Z'},
    ]} as Account;
}
function integrations(h: Host): IntegrationList {
  const ex = integrationsExample as unknown as IntegrationList;
  return {...ex, providers: ex.providers.map((p) => (p.id === 'google' ? GOOGLE : p)),
    accounts: [...ex.accounts.filter((a) => a.provider !== 'google'), ...(h.account && h.phase !== 'change' ? [account(h)] : h.phase === 'change' || h.relogin ? [account({...h, partial: false})] : [])]};
}
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(30);
  if (path === '/api/v1/integrations') return json(integrations(host));
  if (path === '/api/v1/integrations/login') return json({schema_version: 1, state: 'none'});
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};

// Fixed per page load so the countdown is stable while reviewing.
const EXPIRES = new Date(Date.now() + 5 * 60_000).toISOString();
function stage(h: Host): ConnectStage {
  const v = {schema_version: 1, attempt_id: '20261117T083000.000000001', provider: 'google', relogin: h.relogin} as const;
  if (h.phase === 'intro') return {stage: 'intro'};
  if (h.phase === 'change') return {stage: 'intro', account: account({...h, partial: false})};
  if (h.phase === 'open')
    return {stage: 'login', view: {...v, state: 'open_url', authorization_url: AUTH_URL, redirect_prefix: PREFIX, expires_at: EXPIRES, ...(h.relogin ? {address: ADDRESS} : {})} as LoginView};
  if (h.phase === 'completing') return {stage: 'login', view: {...v, state: 'completing'} as LoginView};
  if (h.phase === 'failed') return {stage: 'login', view: {...v, state: 'failed', failure: h.failure} as LoginView};
  return {stage: 'login', view: {...v, state: 'completed', address: ADDRESS, directory: `~/cloud/google-drive/${ADDRESS}`} as LoginView};
}

let run = 0;
async function paste(url: string) {
  const me = ++run;
  // Proposed: a pasted return address that carries Google's error= says the
  // person stopped at Google, instead of production's redirect_rejected.
  if (/[?&]error=/.test(url)) { set({phase: 'failed', failure: 'cancelled', atGoogle: true}); return; }
  set({phase: 'completing'});
  await later(500);
  if (me !== run) return;
  set({phase: 'done', account: true});
}
const restart = () => { run++; set({...SCENARIOS.ennen(), relogin: host.relogin, account: host.account}); };

// ---- Placing the round's pieces in production's dialog ----
// A slot sits right after (or before) its anchor. Several slots may share an
// anchor; each accepts the others beside it, so they never chase each other.
type Anchor = {parent: Element; anchor: Element; after: boolean};
function useSlot(find: () => Anchor | null, id: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const slot = document.createElement('div');
    slot.className = 'rq-slot';
    slot.dataset.slot = id;
    const isSlot = (n: Node | null): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('rq-slot');
    const place = () => {
      const at = find();
      if (!at) { if (slot.isConnected) slot.remove(); return; }
      let n: Node | null = at.after ? at.anchor.nextSibling : at.anchor.previousSibling;
      while (isSlot(n)) { if (n === slot) return; n = at.after ? n.nextSibling : n.previousSibling; }
      at.parent.insertBefore(slot, at.after ? n : (n ? n.nextSibling : at.parent.firstChild));
    };
    place();
    const o = new MutationObserver(place);
    o.observe(document.body, {childList: true, subtree: true});
    setEl(slot);
    return () => { o.disconnect(); slot.remove(); };
  }, [id]);
  return el;
}
const flow = () => document.querySelector('[data-testid="integration-dialog"] .ig-flow');
const form = () => flow()?.querySelector(':scope > form.ig-flow-form') ?? null;
/** Before Google opens: production's heading, siteAsks and notes, no form. */
const preOpen = (sel: string) => (): Anchor | null => {
  const f = flow();
  if (!f || form() || !f.querySelector(':scope > .ig-row.start')) return null;
  const el = f.querySelector(`:scope > ${sel}`);
  return el ? {parent: f, anchor: el, after: true} : null;
};
/** While waiting for the return address, inside production's form. */
const inForm = (sel: string) => (): Anchor | null => {
  const f = form(); const el = f?.querySelector(`:scope > ${sel}`);
  return f && el ? {parent: f, anchor: el, after: true} : null;
};
const afterIn = (sel: string) => (): Anchor | null => {
  const f = flow(); const el = f?.querySelector(`:scope > ${sel}`);
  return f && el ? {parent: f, anchor: el, after: true} : null;
};

// ---- Shared help pieces ----
function Chip({id}: {id: HelpId}) {
  const who = WHO[id];
  const icon: IconName = who === 'self' ? 'check' : who === 'wait' ? 'clock' : who === 'org' ? 'users' : 'server';
  return <span className={`rq-who rq-who-${who}`} data-testid="help-who" data-who={who}><Icon name={icon} />{t().who[who]}</span>;
}
function Path() {
  const x = t();
  return (
    <span className="rq-path" data-testid="help-path">
      <kbd>{x.pathAdvanced}</kbd><span aria-hidden="true">→</span><kbd>{x.pathGo}</kbd>
    </span>
  );
}
function CopyId() {
  const x = t();
  const [done, setDone] = useState(false);
  const id = clientIdOf(AUTH_URL);
  return (
    <div className="ig-url rq-client" data-testid="help-client-id">
      <span className="ig-meta">{x.clientId}</span>
      <code title={id}>{id}</code>
      <ControlButton size="row" variant="secondary" aria-label={`${x.copy}: ${x.clientId}`}
        onPress={() => { void navigator.clipboard?.writeText(id).catch(() => {}); setDone(true); }}>
        <Icon name={done ? 'check' : 'copy'} />{done ? x.copied : x.copy}
      </ControlButton>
    </div>
  );
}
/** One case's answer. The same words in every direction. */
function HelpBody({id, title = true}: {id: HelpId; title?: boolean}) {
  const x = t();
  const body: ReactNode = (() => {
    switch (id) {
      case 'warning': return (
        <>
          <p>{x.warningWhy(x.server)}</p>
          <p><b>{x.warningCheck} <code>https://accounts.google.com</code>.</b></p>
          <p>{x.pathLead} <Path /></p>
          <p className="ig-meta">{x.pathNote}</p>
          <p>{x.warningAfter} {x.noWarning}</p>
        </>);
      case 'unfamiliar': return (<><p><b>{x.unfamiliarBody}</b></p><p className="ig-meta">{x.noShare}</p></>);
      case 'org': return (<><p>{x.orgBody}</p><CopyId /><p className="ig-meta">{x.orgPersonal}</p></>);
      case 'internal': return (<><p>{x.internalBody}</p><p className="ig-meta">{x.internalCode} <code>org_internal</code>. {x.retryNoHelp}</p></>);
      case 'testing': return (<><p>{x.testingBody}</p><p className="ig-meta">{x.retryNoHelp}</p></>);
      case 'cap': return <p>{x.capBody}</p>;
      case 'rate': return (<><p>{x.rateBody}</p><p className="ig-meta">{x.rateCode} <code>rate_limit_exceeded</code>.</p></>);
    }
  })();
  return (
    <div className="rq-answer" data-testid="help-answer" data-help={id}>
      {title ? <p className="rq-answer-title"><b>{x.help[id]}</b></p> : null}
      <Chip id={id} />
      {body}
    </div>
  );
}
/** A row that opens one case; the case's body follows when open. */
function CaseRow({id, open, onToggle, label}: {id: HelpId; open: boolean; onToggle: () => void; label?: string}) {
  return (
    <li className="rq-case" data-open={open || undefined}>
      <button type="button" className="rq-case-head" data-testid={`help-${id}`} aria-expanded={open} onClick={onToggle}>
        <Icon name={open ? 'down' : 'forward'} /><span>{label ?? t().help[id]}</span>
      </button>
      {open ? <HelpBody id={id} title={false} /> : null}
    </li>
  );
}
const toggleHelp = (id: HelpId) => set({help: host.help === id ? null : id});

// ---- A: one note, help behind a link ----
function HelpPanel() {
  const h = useHost();
  const x = t();
  return (
    <div className="rq-a-panel" data-testid="help-panel">
      <ul className="rq-cases">
        {(['warning', 'unfamiliar'] as HelpId[]).map((id) => <CaseRow key={id} id={id} open={h.help === id} onToggle={() => toggleHelp(id)} />)}
      </ul>
      <p className="ig-meta rq-group">{x.aStopped}</p>
      <ul className="rq-cases">
        {REFUSALS.map((id) => <CaseRow key={id} id={id} open={h.help === id} onToggle={() => toggleHelp(id)} />)}
      </ul>
    </div>
  );
}
function DirectionA() {
  const h = useHost();
  const x = t();
  const pre = useSlot(preOpen('.ig-p'), 'a-pre');
  const wait = useSlot(inForm('.ig-how'), 'a-wait');
  const more = (
    <button type="button" className="ig-link rq-linkbtn" data-testid="a-more" aria-expanded={h.expanded}
      onClick={() => set({expanded: !h.expanded, help: h.expanded ? null : h.help})}>
      {h.expanded ? x.aLess : pre && !form() ? x.aMore : x.aWaitLink}
    </button>
  );
  return (
    <>
      {pre ? createPortal(
        <>
          <div className="ig-notice rq-a-note" role="note" data-testid="a-note">
            <Icon name="info" />
            <div><b>{x.aNoteLead}</b> {x.aNoteBody(x.server)} {more}</div>
          </div>
          {h.expanded ? <HelpPanel /> : null}
        </>, pre) : null}
      {wait ? createPortal(<div className="rq-a-wait" data-testid="a-wait">{more}{h.expanded ? <HelpPanel /> : null}</div>, wait) : null}
    </>
  );
}

// ---- B: the route through Google's tab ----
function Route({waiting}: {waiting: boolean}) {
  const h = useHost();
  const x = t();
  const stopOpen = !!h.help && h.help !== 'warning' && h.help !== 'unfamiliar';
  const warnOpen = h.expanded && (h.help === 'warning' || h.help === 'unfamiliar' || h.help === null);
  const step = (n: number, icon: IconName, title: string, meta: ReactNode, extra?: ReactNode, cls = '') => (
    <li className={`rq-step ${cls}`} data-testid={`route-${n}`}>
      <span className="rq-step-n" aria-hidden="true"><Icon name={icon} /></span>
      <div className="rq-step-body"><b>{title}</b><span className="ig-meta">{meta}</span>{extra}</div>
    </li>
  );
  return (
    <div className="rq-route" data-testid="route" data-waiting={waiting || undefined}>
      <p className="ig-meta rq-route-label">{x.bRouteLabel}</p>
      <ol>
        {step(1, 'user', x.bAccount, x.bAccountMeta)}
        {step(2, 'shield', x.bWarning, <>{x.bWarningMeta(x.server)} <Path /></>, (
          <>
            <span className="rq-step-actions">
              <button type="button" className="ig-link rq-linkbtn" data-testid="b-more" aria-expanded={warnOpen}
                onClick={() => set(warnOpen ? {expanded: false, help: null} : {expanded: true, help: 'warning'})}>{warnOpen ? x.bLess : x.bMore}</button>
              <button type="button" className="ig-link rq-linkbtn" data-testid="b-unfamiliar" aria-pressed={h.help === 'unfamiliar'}
                onClick={() => set(h.help === 'unfamiliar' ? {help: null, expanded: false} : {help: 'unfamiliar', expanded: true})}>{x.bUnfamiliar}</button>
            </span>
            {warnOpen && h.help ? <HelpBody id={h.help} title={false} /> : null}
          </>
        ), 'maybe')}
        {step(3, 'lock', x.bConsent, x.bConsentMeta)}
        {step(4, 'external', x.bReturn, <>{x.bReturnMeta(PREFIX)}</>, waiting ? <span className="rq-here" data-testid="route-here"><Icon name="back" />{x.bHere}</span> : null, 'last')}
      </ol>
      <div className="rq-branch" data-testid="route-branch" data-open={stopOpen || undefined}>
        <button type="button" className="rq-case-head" data-testid="b-stop" aria-expanded={stopOpen}
          onClick={() => set({help: stopOpen ? null : 'org', expanded: false})}>
          <Icon name={stopOpen ? 'down' : 'forward'} /><span>{x.bStop}</span>
        </button>
        {stopOpen ? (
          <>
            <p className="ig-meta">{x.bStopLead}</p>
            <div className="rq-tabs" role="group" aria-label={x.bStop}>
              {REFUSALS.map((id) => (
                <button key={id} type="button" className="rq-tab" data-testid={`help-${id}`} aria-pressed={h.help === id}
                  onClick={() => set({help: id})}>{x.short[id]}</button>
              ))}
            </div>
            <HelpBody id={h.help!} />
          </>
        ) : null}
      </div>
    </div>
  );
}
function DirectionB() {
  const pre = useSlot(preOpen('.ig-p'), 'b-pre');
  const wait = useSlot(inForm('.ig-h'), 'b-wait');
  return (
    <>
      {pre ? createPortal(<Route waiting={false} />, pre) : null}
      {wait ? createPortal(<Route waiting />, wait) : null}
    </>
  );
}

// ---- C: a check before Google; a chooser while waiting ----
function Chooser() {
  const h = useHost();
  const x = t();
  return (
    <div className="rq-chooser" data-testid="chooser">
      <p className="ig-meta">{x.cChoose}</p>
      <div className="rq-tiles" role="group" aria-label={x.cChoose}>
        {HELP_IDS.map((id) => (
          <button key={id} type="button" className="rq-tile" data-testid={`help-${id}`} data-who={WHO[id]} aria-pressed={h.help === id}
            onClick={() => toggleHelp(id)}>
            <Icon name={id === 'warning' ? 'shield' : id === 'unfamiliar' ? 'question' : 'stop'} /><span>{x.short[id]}</span>
          </button>
        ))}
      </div>
      {h.help ? <HelpBody id={h.help} /> : null}
    </div>
  );
}
function DirectionC({onClose}: {onClose: () => void}) {
  const h = useHost();
  const x = t();
  const pre = useSlot(preOpen('.ig-p'), 'c-pre');
  const wait = useSlot(inForm('.ig-how'), 'c-wait');
  return (
    <>
      {pre ? createPortal(h.stopped ? (
        <div className="rq-check rq-stopped" data-testid="c-stopped">
          <p className="ig-result"><Icon name="stop" /><span><b>{x.cStoppedLead}</b> {x.cStoppedBody}</span></p>
          <p className="ig-meta">{x.noShare}</p>
          <div className="ig-row">
            <ControlButton data-testid="c-back" size="page" variant="secondary" onPress={() => set({stopped: false})}>{x.cBack}</ControlButton>
            <ControlButton data-testid="c-close" size="page" variant="primary" onPress={onClose}>{x.close}</ControlButton>
          </div>
        </div>
      ) : (
        <section className="rq-check" data-testid="c-check" aria-label={x.cLead}>
          <p className="rq-check-lead"><b>{x.cLead}</b></p>
          <ul>
            <li><Icon name="server" /><span>{x.cServer(x.server)}</span></li>
            <li><Icon name="globe" /><span>{x.cAddress} <code>https://accounts.google.com</code>.</span></li>
            <li><Icon name="shield" /><span>{x.cWarn} <Path /></span></li>
          </ul>
          <p className="rq-check-decide">{x.cDecide}</p>
          <ControlButton data-testid="c-notsure" size="page" variant="secondary" onPress={() => set({stopped: true})}>
            <Icon name="stop" />{x.cNotSure}
          </ControlButton>
        </section>
      ), pre) : null}
      {wait ? createPortal(
        <div className="rq-c-wait" data-testid="c-wait">
          <button type="button" className="ig-link rq-linkbtn" data-testid="c-other" aria-expanded={h.expanded}
            onClick={() => set({expanded: !h.expanded, help: h.expanded ? null : h.help})}>{x.cOther}</button>
          {h.expanded ? <Chooser /> : null}
        </div>, wait) : null}
    </>
  );
}

// ---- Shared outcome pieces (same in every direction) ----
function Outcome() {
  const h = useHost();
  const x = t();
  const cancelled = useSlot(afterIn('.ig-result:not([data-testid="integration-connected"])'), 'cancelled');
  const granted = useSlot(afterIn('[data-testid="integration-connected"]'), 'granted');
  const acc = account(h);
  return (
    <>
      {cancelled && h.phase === 'failed' && h.atGoogle ? createPortal(
        <p className="ig-p" data-testid="cancelled-at-google">{x.cancelledAtGoogle} {x.cancelledRetry}</p>, cancelled) : null}
      {granted && h.phase === 'done' ? createPortal(
        <div className="rq-granted" data-testid="grant-summary" data-partial={h.partial || undefined}>
          <p className="ig-meta">{x.grantLead}</p>
          <ul>
            {acc.services.map((s) => (
              <li key={s.id} data-access={s.access}>
                <Icon name={s.access === 'none' ? 'slash' : 'check'} />
                <span>{x.services[s.id]}</span>
                {s.access === 'none' ? <span className="ig-meta">{x.grantNo}</span> : null}
              </li>
            ))}
          </ul>
          {h.partial ? <p className="ig-meta">{x.grantPartial}</p> : null}
        </div>, granted) : null}
    </>
  );
}

// ---- The page ----
function Page({direction}: {direction: number}) {
  const h = useHost();
  const close = () => { run++; set({dialog: false}); };
  // PasteStep keeps "opened" to itself; a scenario that starts in Google's
  // tab presses production's own link once (the click guard keeps it here).
  useEffect(() => {
    if (!h.opened || h.phase !== 'open') return;
    const id = setInterval(() => {
      const link = document.querySelector<HTMLAnchorElement>('[data-testid="integration-provider-link"]');
      if (form()) { clearInterval(id); return; }
      if (link) { autoOpen = true; link.click(); autoOpen = false; }
    }, 20);
    return () => clearInterval(id);
  }, [h.opened, h.phase]);
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.dataset.rqDirection = String(direction);
    el.dataset.rqPhase = h.phase;
    el.dataset.rqStopped = String(h.stopped);
  }, [direction, h.phase, h.stopped]);
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
        <AccountSettings key={`${h.dialog}-${h.account}-${h.partial}`} routeSection="tiedot" onNavigate={() => {}}
          profile={{name: 'Aino Esimerkki', email: '', avatar_url: ''}} csrf="prototype"
          nativeState="connected" nativeLogin="aino-esimerkki" onReconnect={() => {}}
          workspaces={[]} onClose={() => {}} />
      </div>
      {h.dialog ? (
        <div className="rq-dialog-root" data-phase={h.phase}>
          <ConnectDialog provider={GOOGLE} stage={stage(h)}
            key={`${h.phase}-${h.relogin}`}
            onContinue={() => set({phase: 'open', opened: false})} onPassword={() => {}} onPaste={(u) => void paste(u)}
            onFolders={() => {}} onSkipFolders={close} onRestart={restart} onClose={close} />
          {direction === A ? <DirectionA /> : direction === B ? <DirectionB /> : <DirectionC onClose={close} />}
          <Outcome />
        </div>
      ) : (
        <button type="button" className="rq-reopen" data-testid="rq-reopen" onClick={() => { run++; set({...SCENARIOS[scenario](), dialog: true}); }}>{t().reopen}</button>
      )}
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={lang === 'fi' ? 'Asetukset' : 'Settings'} rail={rail} main={main} />
    </StatusBellProvider>
  );
}

let autoOpen = false;
let reviewTheme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
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
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="https://"]') as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      if (a.dataset.testid === 'integration-provider-link') set({opened: true});
      if (!autoOpen) setToast(`${TEXT[lang].away} ${a.href.split('?')[0]}`);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 4000); return () => clearTimeout(id); }, [toast]);
  const reset = (next = s) => { run++; scenario = next; host = SCENARIOS[next](); setS(next); setToast(''); setGeneration((n) => n + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => reset(e.target.value)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); reset();
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => reset()}>{x.reset}</button>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${s}-${language}`} enabled={false}>
          <MemoryRouter key={`${generation}-${s}-${language}`} initialEntries={['/settings/tiedot']}>
            <Page direction={direction} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {toast ? <p className="rq-toast" role="status" data-testid="rq-toast">{toast}</p> : null}
    </div>
  );
}

const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { run++; host = SCENARIOS[scenario](); flushSync(() => reactRoot.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// The dialog is modal, and react-aria makes everything outside it inert. The
// review chrome (picker and bar) is not part of the page under review.
const keepLive = () => document.querySelectorAll('.proto-picker[inert], .rq-bar[inert], .rq-review[inert], #root[inert]').forEach((el) => el.removeAttribute('inert'));
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'])
  window.addEventListener(type, (e) => { if ((e.target as Element | null)?.closest?.('.proto-picker, .rq-bar')) e.stopPropagation(); }, true);
new MutationObserver(keepLive).observe(document.body, {attributes: true, attributeFilter: ['inert'], subtree: true});
new Function('stage', 'variants', pickerSource)(stageSink, variants);
