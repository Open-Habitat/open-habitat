import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/PiOnboarding.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton, ExternalLink} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {Button} from '../../../../web/src/components/Primitives';
import {StatusMark} from '../../../../web/src/components/Status';
import {WarningBanner} from '../../../../web/src/components/WarningBanner';
import {type StatusItem, StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {PiDeviceSignIn, type PiDeviceSignInView, SignInStep, SignInSteps} from '../../../../web/src/components/PiDeviceSignIn';
import {AccountSettings, AccountShelf} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {claudeSignInText} from '../../../../web/src/text/claudeSignIn';
import {piCredentialsText} from '../../../../web/src/text/piCredentials';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const claudeTxt = liveText(claudeSignInText);
const keyTxt = liveText(piCredentialsText);

// proto-ai-sign-in-expired, round 2. Jari 6.11. chose round 1's B Kenttä:
// the GitHub warning's pattern, above the composer of every conversation on
// that provider and in the bell. New in every riff and on the default view:
// the message waits in the field and goes by itself as soon as the agent is
// back online (the sign-in repaired, or the provider answering again); the
// person can still edit or empty the field meanwhile. The riffs vary two
// things Jari left open: (a) where the sign-in is repaired, Settings ›
// Tekoäly with a return (B1) or a window over the conversation (B2, B3), and
// (c) what the failed turn says, a short line (B1, B2) or the whole
// explanation with the provider's raw message openable (B3). B1–B2 answer
// (a), B2–B3 answer (c). Rail, header, bell, timeline, messages, composer,
// warning, Settings › Tekoäly (with its real Claude, ChatGPT and key rows)
// and the sign-in steps are production components; the host behind them is
// a fetch stand-in here. Everything is synthetic.
const directions = ['B1 Asetukset', 'B2 Ikkuna', 'B3 Selitys'];
const LINES = [
  'B1 Asetukset: Kirjaudu uudelleen vie Asetukset › Tekoäly -sivulle, josta palataan itse keskusteluun. Epäonnistunut vuoro on lyhyt rivi.',
  'B2 Ikkuna: kirjautuminen aukeaa ikkunaan keskustelun päälle, eikä keskustelusta poistuta. Epäonnistunut vuoro on lyhyt rivi.',
  'B3 Selitys: ikkuna kuten B2, mutta epäonnistunut vuoro kertoo koko syyn, ja palvelun oman viestin saa auki.',
];
const ROUND_LINE = 'Uutta kaikissa: viesti odottaa kentässä ja lähtee itse heti, kun agentti on taas linjoilla.';
const B1 = 0, B3 = 2;

// ---- What failed: four host situations the round covers ----
type Kind = 'claude' | 'device' | 'key' | 'outage';
type Scenario = {
  id: string; kind: Kind; label: string;
  /** The provider's own words, as they reached the history. */
  raw: string;
  /** Today's turn: Pi's error stop (Epäonnistui), or the bridge's text as an answer. */
  todayCard: 'complete' | 'failed';
  /** Today's daemon classifies it as pi_auth_failed (its 401/403 words). */
  todayBanner: boolean;
  model: string;
  service: string;
  title: string; text: string; short: string; turn: string;
  fix: string; done: string; bell: string; settingsRow: 'claude' | 'chatgpt' | 'api-keys';
};
const SCENARIOS: Scenario[] = [
  {
    id: 'claude', kind: 'claude', label: 'Claude-tilaus vanhentunut', todayCard: 'complete', todayBanner: false,
    raw: 'Failed to authenticate: OAuth session expired and could not be refreshed',
    model: 'Claude Sonnet 5 · medium', service: 'Claude',
    title: 'Claude-kirjautuminen on vanhentunut',
    text: 'Claude ei enää hyväksy tilauksesi kirjautumista, eikä palvelin voi uusia sitä itse. Kirjaudu uudelleen; viestisi on tallessa.',
    short: 'Claude-keskustelut eivät vastaa ennen uutta kirjautumista.',
    turn: 'Claude-kirjautumisesi on vanhentunut, eikä palvelin voi uusia sitä itse. Viestiäsi ei käsitelty.',
    fix: 'Kirjaudu Claudeen', done: 'Claude-tilaus kirjautunut.', bell: 'Claude poikki', settingsRow: 'claude',
  },
  {
    id: 'chatgpt', kind: 'device', label: 'ChatGPT-tilaus vanhentunut', todayCard: 'failed', todayBanner: true,
    raw: '401 Your authentication token has expired. Please try signing in again.',
    model: 'GPT-6 Astra · medium', service: 'ChatGPT',
    title: 'ChatGPT-kirjautuminen on vanhentunut',
    text: 'OpenAI ei enää hyväksy ChatGPT-tilauksesi kirjautumista, eikä palvelin voi uusia sitä itse. Kirjaudu uudelleen; viestisi on tallessa.',
    short: 'ChatGPT-keskustelut eivät vastaa ennen uutta kirjautumista.',
    turn: 'ChatGPT-kirjautumisesi on vanhentunut, eikä palvelin voi uusia sitä itse. Viestiäsi ei käsitelty.',
    fix: 'Kirjaudu ChatGPT:hen', done: 'ChatGPT-tilaus kirjautunut.', bell: 'ChatGPT poikki', settingsRow: 'chatgpt',
  },
  {
    id: 'key', kind: 'key', label: 'OpenAI-avain peruttu', todayCard: 'failed', todayBanner: true,
    raw: '401 Incorrect API key provided: sk-proj-…a1b2. You can find your API key at https://platform.openai.com/account/api-keys.',
    model: 'GPT-5.5 · medium', service: 'OpenAI',
    title: 'OpenAI hylkäsi API-avaimesi',
    text: 'Avain sk-…a1b2 ei enää kelpaa: se on ehkä peruttu tai sen kiintiö on täynnä. Palvelin ei voi korjata sitä itse. Vaihda avain; viestisi on tallessa.',
    short: 'OpenAI-avaimen keskustelut eivät vastaa ennen avaimen vaihtoa.',
    turn: 'OpenAI hylkäsi API-avaimesi sk-…a1b2: se on ehkä peruttu tai sen kiintiö on täynnä. Viestiäsi ei käsitelty.',
    fix: 'Vaihda avain', done: 'Uusi OpenAI-avain tallennettu.', bell: 'OpenAI-avain', settingsRow: 'api-keys',
  },
  {
    id: 'outage', kind: 'outage', label: 'Claude ei vastaa (ei kirjautumisvika)', todayCard: 'failed', todayBanner: false,
    raw: '529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
    model: 'Claude Sonnet 5 · medium', service: 'Claude',
    title: 'Claude ei vastaa juuri nyt',
    text: 'Clauden palvelu oli ylikuormittunut. Kirjautumisesi on kunnossa, eikä sinun tarvitse korjata mitään.',
    short: 'Kirjautuminen on kunnossa. Yritä hetken päästä.',
    turn: 'Claude ei vastannut, koska sen palvelu oli juuri nyt ylikuormittunut. Kirjautumisesi on kunnossa, eikä sinun tarvitse korjata mitään. Viestiäsi ei käsitelty.',
    fix: 'Yritä uudelleen', done: 'Claude vastaa taas.', bell: 'Claude', settingsRow: 'claude',
  },
];
/** What the field says while the message waits there. */
const waitLine = (s: Scenario) => s.kind === 'outage' ? `Odottaa kentässä · lähtee itse, kun ${s.service} vastaa taas.`
  : s.kind === 'key' ? 'Odottaa kentässä · lähtee itse, kun uusi avain on tallessa.'
  : 'Odottaa kentässä · lähtee itse heti, kun olet kirjautunut.';
/** The fault without its call to act, for places that carry their own action. */
const cause = (s: Scenario) => s.text.replace(/ [^.]*; viestisi on tallessa\.$/, '');
let scenarioIndex = 0;
const sc = () => SCENARIOS[scenarioIndex];

// ---- The host behind production components: a fetch stand-in ----
// Settings › Tekoäly reads and writes through fetch; these answers follow
// the contracts (claude-login, pi-credentials, pi-models) so the real rows
// render and their buttons do what they do. Today's Claude row says
// Kirjautunut while the token has expired: `claude auth status` reads the
// stored login and does not try it.
const host = {ok: false, claude: {state: 'completed', attempt: '', putAt: 0}, suffix: 'a1b2', events: 0};
const listeners = new Set<() => void>();
const notify = () => { host.events++; listeners.forEach((f) => f()); };
function resetHost() { host.ok = false; host.claude = {state: 'completed', attempt: '', putAt: 0}; host.suffix = 'a1b2'; }
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const repair = () => { if (!host.ok) { host.ok = true; notify(); } };
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
function models() {
  const refused = sc().kind === 'key' && !host.ok;
  const seen = new Date(Date.now() - 60000).toISOString();
  return {
    schema_version: 1, default_provider: 'claude-bridge', default_model: 'claude-sonnet-5', default_thinking: 'medium', catalog_status: 'native_cached',
    models: [
      {id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'claude-bridge', outcome: 'answered', observed_at: seen},
      {id: 'claude-opus-5-5', name: 'Claude Opus 5.5', provider: 'claude-bridge'},
      {id: 'gpt-6-astra', name: 'GPT-6 Astra', provider: 'openai-codex'},
      {id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai', outcome: refused ? 'refused' : 'answered', observed_at: seen},
      {id: 'gpt-5.5-mini', name: 'GPT-5.5 mini', provider: 'openai', outcome: refused ? 'refused' : 'answered', observed_at: seen},
    ],
  };
}
const credentials = () => ({
  schema_version: 1, openai: {present: true, suffix: host.suffix}, anthropic: {present: false, suffix: null},
  deepseek: {present: false, suffix: null}, subscription: {present: true},
});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  const method = (init?.method ?? 'GET').toUpperCase();
  await later(120);
  if (path === '/api/v1/pi/models') return json(models());
  if (path === '/api/v1/pi/credentials') {
    if (method === 'POST') {
      const key = String(JSON.parse(String(init?.body ?? '{}')).key ?? '');
      host.suffix = key.slice(-4).replace(/[^A-Za-z0-9_-]/g, 'x').padStart(4, 'x');
      if (sc().kind === 'key') repair();
      else notify();
    }
    return json(credentials());
  }
  if (path === '/api/v1/pi/claude-login') {
    const c = host.claude;
    if (method === 'POST') { c.state = 'code'; c.attempt = '20261104T094100.000000001'; }
    if (method === 'PUT') { c.state = 'pending'; c.putAt = Date.now(); }
    if (method === 'DELETE') { c.state = 'completed'; c.attempt = ''; }
    if (method === 'GET' && c.state === 'pending' && Date.now() - c.putAt > 1000) {
      c.state = 'completed';
      if (sc().kind === 'claude') repair();
    }
    return json({
      schema_version: 1, state: c.state, ...(c.attempt ? {attempt_id: c.attempt} : {}),
      ...(c.state === 'code' ? {verification_uri: 'https://claude.com/cai/oauth/authorize?code=true&client_id=prototype'} : {}),
    });
  }
  return new Response('', {status: 404});
};

// A provider page opens in a new tab in production. Here the round stands in
// for the person there: Claude hands back a code, OpenAI confirms the device.
const CLAUDE_CODE = 'proto-7f3a9c2e';
const external = new Set<(href: string) => void>();
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('a[href^="https://"]') as HTMLAnchorElement | null;
  if (!a || a.closest('.rq-bar')) return;
  e.preventDefault();
  external.forEach((f) => f(a.href));
}, true);
function useExternal(f: (href: string) => void) {
  const ref = useRef(f); ref.current = f;
  useEffect(() => { const g = (h: string) => ref.current(h); external.add(g); return () => { external.delete(g); }; }, []);
}

// ---- Conversations ----
type Item = {id: string; kind: 'user' | 'assistant'; text: string; time: string; state?: 'streaming' | 'complete' | 'failed'; node?: React.ReactNode};
type Conv = {id: string; title: string; ws: string; wsName: string; ago: number; same: boolean; history: Item[]};
const u = (id: string, time: string, text: string): Item => ({id, kind: 'user', time, text});
const r = (id: string, time: string, text: string): Item => ({id, kind: 'assistant', time, text, state: 'complete'});
const MESSAGE = 'Tapaaminen oli. Tästä tunnin tapaamisesta ja siihen olleesta 30 min valmistautumisesta pitää kanssa merkitä tunnit.';
const ANSWER = 'Merkitsin torstaille 3.11. tapaamisen 1 h ja valmistautumisen 0,5 h projektille Contoso. Viikon tunnit ovat nyt 31,5 h. Ajankäyttöarvio on yhä auki.';
const CONVS: Conv[] = [
  {id: 'tunnit', title: 'Viikon tunnit', ws: 'ws_m', wsName: 'muistiinpanot', ago: 0, same: true, history: [
    u('t1', '9.02', 'Kirjaa tämän viikon tunnit Status.txt:n mukaan ja kerro, mitä puuttuu.'),
    r('t2', '9.05', 'Kirjasin maanantain ja tiistain, yhteensä 30 h.\n\n- **Ajankäyttöarvio ei tullut** tililistan mukana. Se on vielä auki.'),
  ]},
  {id: 'svg', title: 'Varjon piirto SVG:ksi', ws: 'ws_a', wsName: 'aurinkokello', ago: 1, same: false, history: [
    u('s1', '9.30', 'Piirrä varjon kulku SVG:ksi tunnin välein.'),
  ]},
  {id: 'kesa', title: 'Kesäajan virhe', ws: 'ws_a', wsName: 'aurinkokello', ago: 40, same: true, history: [
    u('k1', '8.40', 'Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat.'),
    r('k2', '8.44', 'Ajoin testit: 41 läpi, 2 epäonnistui. Molemmat ovat kesäajan testejä.'),
  ]},
  {id: 'nda', title: 'NDA-viestin tarkistus', ws: 'ws_m', wsName: 'muistiinpanot', ago: 130, same: true, history: [
    u('n1', '7.02', 'Lue liitteen NDA ja kerro, mitä siinä pitää muuttaa.'),
    r('n2', '7.16', 'Kaksi kohtaa: salassapito on ikuinen (ehdota viittä vuotta), ja kohta 7 siirtää kaikki oikeudet heille.'),
  ]},
  {id: 'lasku', title: 'Laskun muistutus', ws: 'ws_k', wsName: 'kotisivu', ago: 1500, same: false, history: [
    u('l1', 'eilen', 'Kirjoita kohtelias muistutus erääntyneestä laskusta.'),
    r('l2', 'eilen', 'Tässä luonnos. Liitin laskun numeron ja eräpäivän.'),
  ]},
];
const byId = new Map(CONVS.map((c) => [c.id, c]));
const T0 = Date.now();
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'muistiinpanot',
};

/** Where the failed send is. failed: as it came back, the message waiting
 * in the field; sending and answered: it went by itself once the agent was
 * back online. */
type Phase = 'failed' | 'sending' | 'answered';
type State = {
  phase: Phase;
  drafts: Record<string, string>;
  /** Conversations whose field holds a message that goes once the agent is back. */
  waiting: Record<string, boolean>;
  /** The message went by itself after the repair; says so above the field. */
  recovered: boolean;
  /** Messages other conversations sent once the agent was back. */
  extra: Record<string, string[]>;
  /** The text that went again, as the field held it then. */
  sent: string;
};
const initial = (): State => ({phase: 'failed', drafts: {tunnit: MESSAGE}, waiting: {tunnit: true}, recovered: false, extra: {}, sent: ''});

// ---- The sign-in where the person is: A's card and C's window ----
/** The provider's own sign-in, the steps Settings and onboarding already
 * use, started at once because the person asked for it by pressing. */
function SignInHere({onDone, onCancel, compact}: {onDone: () => void; onCancel: () => void; compact?: boolean}) {
  const s = sc();
  const [code, setCode] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [device, setDevice] = useState<PiDeviceSignInView>({phase: 'pending', verificationUri: 'https://auth.openai.com/codex/device', userCode: 'K7QD-9MXP'});
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  useExternal((href) => {
    if (href.startsWith('https://claude.com')) setCode(CLAUDE_CODE);
    if (href.startsWith('https://auth.openai.com')) setTimeout(() => setDevice({phase: 'connected'}), 900);
  });
  useEffect(() => {
    if (device.phase !== 'connected') return;
    const t = setTimeout(() => { repair(); onDone(); }, 700);
    return () => clearTimeout(t);
  }, [device.phase]);
  if (s.kind === 'claude')
    return (
      <div className="rq-signin" data-testid="sign-in-here" data-kind="claude">
        <SignInSteps>
          <SignInStep number={1} title={claudeTxt.step1}>
            <ExternalLink data-testid="claude-sign-in-link" href="https://claude.com/cai/oauth/authorize?code=true&client_id=prototype" target="_blank" rel="noopener noreferrer">
              {claudeTxt.openNewTab}
            </ExternalLink>
          </SignInStep>
          {!waiting ? (
            <SignInStep number={2} title={claudeTxt.step2}>
              <form className="ah-inline-field" onSubmit={(e) => {
                e.preventDefault();
                setWaiting(true); setCode('');
                setTimeout(() => { repair(); onDone(); }, 1100);
              }}>
                <input type="password" data-testid="claude-code-input" aria-label={claudeTxt.codeLabel} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
                <ControlButton data-testid="claude-code-confirm" size="row" variant="primary" type="submit" isDisabled={code.trim().length < 8}>
                  {claudeTxt.confirmCode}
                </ControlButton>
              </form>
            </SignInStep>
          ) : (
            <SignInStep number={2} title={claudeTxt.waitStep} status>
              <StatusMark label={claudeTxt.waiting} tone="info" animated="running" />
            </SignInStep>
          )}
        </SignInSteps>
        <div className="rq-signin-foot">
          <p className="ah-sign-in-hint">{claudeTxt.ownPage}</p>
          {compact ? <Button data-testid="sign-in-cancel" label="Peruuta" variant="quiet" size="row" onPress={onCancel} /> : null}
        </div>
      </div>
    );
  if (s.kind === 'device')
    return (
      <div className="rq-signin" data-testid="sign-in-here" data-kind="device">
        <PiDeviceSignIn embedded view={device} onCancel={compact ? onCancel : undefined} />
      </div>
    );
  // An API key: the same field and words as Settings' change dialog.
  const fits = /^sk-[A-Za-z0-9_-]{20,}$/.test(key.trim());
  return (
    <form className="rq-signin s-editor" data-testid="sign-in-here" data-kind="key" onSubmit={(e) => {
      e.preventDefault();
      if (!fits) return;
      setSaving(true);
      setTimeout(() => { host.suffix = key.trim().slice(-4); repair(); onDone(); }, 800);
    }}>
      <label className="s-field">
        {keyTxt.apiKey('OpenAI', true)}
        <input data-testid="api-key-input" type="password" autoComplete="off" spellCheck={false} value={key} placeholder="sk-…" onChange={(e) => setKey(e.target.value)} />
      </label>
      <p className="s-desc">{keyTxt.newReplaces('sk-…a1b2')}</p>
      <div className="ah-dialog-actions">
        {compact ? <ControlButton data-testid="sign-in-cancel" size="row" onPress={onCancel}>{keyTxt.cancel}</ControlButton> : null}
        <ControlButton data-testid="api-key-save" size="row" variant="primary" type="submit" isDisabled={!fits || saving}>
          {saving ? keyTxt.checking : keyTxt.saveKey}
        </ControlButton>
      </div>
    </form>
  );
}

function SignInWindow({open, onClose, onDone}: {open: boolean; onClose: () => void; onDone: () => void}) {
  const s = sc();
  return (
    <ModalOverlay className="ah-overlay" isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }} isDismissable>
      <Modal className="ah-modal rq-signin-modal">
        <AriaDialog className="ah-dialog" data-testid="sign-in-window" aria-label={s.fix}>
          <Heading slot="title">{s.kind === 'key' ? keyTxt.replaceTitle('OpenAI') : s.fix}</Heading>
          <p className="s-desc">{s.kind === 'key' ? `${cause(s)} Viestisi lähtee, kun uusi avain on tallessa.` : 'Viestisi lähtee, kun kirjautuminen on valmis.'}</p>
          <SignInHere compact onDone={onDone} onCancel={onClose} />
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Today's full-page AI step (`?pi_sign_in=1`), drawn with its ChatGPT
 * card: the existing warning's Kirjaudu uudelleen leads here. */
function DevicePage({onBack}: {onBack: () => void}) {
  const [view, setView] = useState<PiDeviceSignInView>({phase: 'start'});
  useExternal((href) => { if (href.startsWith('https://auth.openai.com')) setTimeout(() => setView({phase: 'connected'}), 900); });
  useEffect(() => { if (view.phase === 'connected' && sc().kind === 'device') repair(); }, [view.phase]);
  return (
    <div className="rq-device-page" data-testid="device-page">
      <PiDeviceSignIn view={view}
        onRetry={() => { setView({phase: 'waiting'}); setTimeout(() => setView({phase: 'pending', verificationUri: 'https://auth.openai.com/codex/device', userCode: 'K7QD-9MXP'}), 600); }}
        onCancel={() => setView({phase: 'start'})} />
      <div className="rq-device-back"><Button data-testid="device-back" label="← Takaisin keskusteluun" variant="quiet" size="row" onPress={onBack} /></div>
    </div>
  );
}

function render(item: Item) {
  const content = item.kind === 'user'
    ? <UserMessage sourceText={item.text} onCopy={noop} time={item.time}><Markdown text={item.text} /></UserMessage>
    : <AssistantMessage streamState={item.state} time={item.time} onCopy={noop}>{item.node ?? <Markdown text={item.text} />}</AssistantMessage>;
  return {id: item.id, kind: item.kind, content: <div data-item={item.id}>{item.node && item.kind === 'user' ? item.node : content}</div>};
}

let reviewTheme = 'light';

function Main({direction}: {direction: number}) {
  const s = sc();
  const h = useHost();
  const [st, set] = useState(initial);
  const [win, setWin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const settings = location.pathname.startsWith('/settings');
  const deviceOpen = params.has('pi_sign_in');
  const current = params.get('conversation') ?? 'tunnit';
  const conv = byId.get(current)!;
  const back = useRef('/workspaces/ws_m?conversation=tunnit');
  if (!settings && !deviceOpen) back.current = `${location.pathname}${location.search}`;
  const outage = s.kind === 'outage';
  // The provider does not answer until repaired (or, in an outage, until it
  // recovers); only a sign-in fault is the person's to fix.
  const down = !h.ok;
  const broken = !outage && down;
  const inWindow = direction !== B1;
  // A conversation on the failed provider: its field holds a send while down.
  const onProvider = (id: string) => byId.get(id)!.same && (s.kind !== 'key' || id === 'tunnit');

  // Back online: every waiting field goes by itself, as it is now. B1 first
  // returns from Settings to the conversation it left.
  const latest = useRef({st, back: back.current});
  latest.current = {st, back: back.current};
  const wasDown = useRef(down);
  useEffect(() => {
    if (wasDown.current && !down) {
      setWin(false);
      if (settings || deviceOpen) navigate(latest.current.back);
      const {drafts, waiting} = latest.current.st;
      const going = Object.keys(waiting).filter((id) => waiting[id] && drafts[id]?.trim());
      if (going.length) {
        set((x) => {
          const next = {...x, waiting: {}, drafts: {...x.drafts}, extra: {...x.extra}};
          for (const id of going) {
            next.drafts[id] = '';
            if (id === 'tunnit') { next.phase = 'sending'; next.recovered = true; next.sent = drafts[id]; }
            else next.extra[id] = [...(next.extra[id] ?? []), drafts[id]];
          }
          return next;
        });
        if (going.includes('tunnit')) answerSoon();
      } else set((x) => ({...x, waiting: {}}));
    }
    wasDown.current = down;
  });
  const sending = useRef<ReturnType<typeof setTimeout>>();
  function answerSoon() {
    clearTimeout(sending.current);
    sending.current = setTimeout(() => set((x) => ({...x, phase: 'answered'})), 1400);
  }
  const send = (text: string) => {
    if (!text.trim()) return;
    // While the provider is down the message stays in the field and waits.
    if (down && onProvider(current)) { set((x) => ({...x, waiting: {...x.waiting, [current]: true}})); return; }
    if (current !== 'tunnit') { set((x) => ({...x, drafts: {...x.drafts, [current]: ''}, extra: {...x.extra, [current]: [...(x.extra[current] ?? []), text]}})); return; }
    set((x) => ({...x, phase: 'sending', recovered: false, sent: text, drafts: {...x.drafts, tunnit: ''}}));
    answerSoon();
  };

  // ---- The failed conversation's timeline ----
  const items: Item[] = [...conv.history];
  if (current === 'tunnit') {
    items.push(u('t3', '9.38', MESSAGE));
    const node = direction === B3 ? (
      <div className="rq-turn-fix" data-testid="turn-explained">
        <p>{s.turn}</p>
        <details className="rq-raw" data-testid="turn-raw">
          <summary>Palvelun oma viesti</summary>
          <code>{s.raw}</code>
        </details>
      </div>
    ) : (
      <p className="rq-turn-short" data-testid="turn-short">{outage ? `${s.service} ei vastannut. Viestiäsi ei käsitelty.` : `${s.title}. Viestiäsi ei käsitelty.`}</p>
    );
    items.push({id: 't4', kind: 'assistant', time: '9.38', text: '', state: 'failed', node});
    if (st.phase !== 'failed') items.push(u('t5', '9.44', st.sent));
    if (st.phase === 'sending') items.push({id: 't6', kind: 'assistant', time: '', text: 'Kirjaan tunteja…', state: 'streaming'});
    if (st.phase === 'answered') items.push({id: 't6', kind: 'assistant', time: '9.44', text: ANSWER, state: 'complete'});
  }
  (st.extra[current] ?? []).forEach((text, i) => {
    items.push(u(`x${i}`, '9.45', text));
    items.push({id: `xa${i}`, kind: 'assistant', time: '9.45', text: 'Selvä, katson.', state: 'complete'});
  });
  const working = current === 'svg' || (current === 'tunnit' && st.phase === 'sending');
  const draft = st.drafts[current] ?? '';
  const waitingHere = down && !!st.waiting[current] && !!draft.trim();

  // ---- Notices ----
  function goFix() {
    if (inWindow) { setWin(true); return; }
    if (s.kind === 'device') navigate(`${back.current}&pi_sign_in=1`);
    else navigate(`/settings/ai#${s.settingsRow}`);
  }
  const fixLabel = s.kind === 'key' ? s.fix : 'Kirjaudu uudelleen';
  const after = s.kind === 'key' ? 'kun uusi avain on tallessa' : 'kun olet kirjautunut';
  let notice: React.ReactNode = null;
  if (st.recovered && current === 'tunnit')
    notice = <WarningBanner data-testid="ai-sign-in-ok" tone="success">{`${s.done} Viestisi lähti.`}</WarningBanner>;
  else if (broken && onProvider(current))
    notice = (
      <WarningBanner data-testid="ai-sign-in-warning" tone="danger" icon="warning" title={s.title} short={s.short}
        actions={<ControlButton data-testid="ai-sign-in-fix" size="row" variant="primary" onPress={goFix}>{fixLabel}</ControlButton>}>
        {`${cause(s)}${inWindow ? '' : ` ${s.kind === 'device' ? 'Kirjautuminen' : 'Asetukset'} palauttaa sinut tähän.`}${waitingHere ? ` Viestisi lähtee heti, ${after}.` : ''}`}
      </WarningBanner>
    );
  else if (outage && down && current === 'tunnit')
    notice = (
      <WarningBanner data-testid="ai-outage" tone="neutral" title={s.title} short={s.short}>
        {`${s.text}${waitingHere ? ' Viestisi lähtee itse, kun Claude vastaa taas.' : ''}`}
      </WarningBanner>
    );

  // ---- The bell: the account-wide condition while it holds ----
  const bell: StatusItem[] = broken ? [{
    key: 'ai-sign-in', tone: 'danger', icon: 'warning', group: 'own', short: s.bell, title: s.title, meta: s.short,
    body: cause(s),
    actions: [{label: fixLabel, testId: 'status-ai-fix', primary: true, onPress: () => goFix()}],
  }] : [];

  // ---- Rail ----
  const tunnitState = st.phase === 'sending' ? 'working' : st.phase === 'answered' ? 'done' : 'held';
  const now = Date.now();
  const model = (c: Conv): AgentNavModel => {
    const t = c.id === 'tunnit' ? tunnitState : c.id === 'svg' ? 'working' : 'done';
    const label = t === 'working' ? 'Työssä' : t === 'held' ? (outage ? `Viesti odottaa: ${s.service} ei vastaa` : 'Viesti odottaa kirjautumista') : 'Odottaa viestiä';
    return {
      agentId: c.id, href: `/workspaces/${c.ws}?conversation=${c.id}`, title: c.title, workspaceId: c.ws, workspaceName: c.wsName,
      changedAt: T0 - c.ago * 60000, activity: t === 'working' ? 'working' : 'waiting', activityLabel: label, controlLabel: '',
      failed: t === 'held' && !outage ? true : undefined,
      detail: [c.wsName, label].join(' · '), selected: current === c.id && !settings,
    };
  };
  // An outage needs nothing from the person, so its waiting row stays in Käynnissä.
  const place = (c: Conv) => {
    if (c.id === 'svg') return 'running';
    if (c.id === 'tunnit') return tunnitState === 'working' || (tunnitState === 'held' && outage) ? 'running' : tunnitState === 'done' ? 'quiet' : 'yours';
    return 'quiet';
  };
  const rowsIn = (p: string) => CONVS.filter((c) => place(c) === p);
  const row = (c: Conv) => <AgentNavItem key={c.id} {...model(c)} now={now} />;
  const yours = rowsIn('yours'), running = rowsIn('running'), quiet = rowsIn('quiet');
  const groups = [...new Set(running.map((c) => c.wsName))].sort();
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={() => navigate('/settings/ai')} onLogout={noop} />}
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
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" hint={{kind: 'working', count: 1, text: '1 työssä'}} />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" hint={yours.length ? {kind: 'attention', count: yours.length, text: `${yours.length} odottaa sinua`} : undefined} />
    </WorkspaceRail>
  );

  // The waiting line sits where the composer's own reason line would, as
  // the last row of the composer, so it shares the field's column.
  const [composerEl, setComposerEl] = useState<Element | null>(null);
  useLayoutEffect(() => { setComposerEl(document.querySelector('.rq-composer .ah-composer')); });
  const setDraft = (v: string) => set((x) => ({...x, drafts: {...x.drafts, [current]: v}}));
  const main = deviceOpen ? (
    <DevicePage onBack={() => { const p = new URLSearchParams(location.search); p.delete('pi_sign_in'); navigate(`${location.pathname}?${p}`); }} />
  ) : settings ? (
    <div className="ah-settings-layer">
      <div className="ah-state">
        <AccountSettings routeSection="tekoaly" routeRow={location.hash.slice(1) || undefined} onNavigate={(p) => navigate(p)}
          profile={{name: 'Jari Mustonen', email: '', avatar_url: ''}} csrf="prototype"
          onPiSignIn={() => navigate('/settings/ai?pi_sign_in=1')}
          modelSelector={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>}
          onClose={() => navigate(back.current)} />
      </div>
    </div>
  ) : (
    <div className="ah-state rq-main">
      <ConversationFrame>
        <AgentHeader title={conv.title} workspaceLabel={conv.wsName} workspaceHref={`/workspaces/${conv.ws}`}
          activityLabel={working ? 'Työssä' : ''} activityAnimated={working} activityKind={working ? 'working' : 'neutral'}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{onSave: async () => {}}} />
        <ConversationStream>
          <ConversationTimeline key={current} state="ready" items={items.map(render)} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
        </ConversationStream>
        <div className="ah-actionable-notices">{notice}</div>
        <div className={`rq-composer${waitingHere ? ' rq-waiting' : ''}`} data-testid="rq-composer" data-waiting={waitingHere ? 'true' : undefined}>
          <Composer value={draft} onChange={setDraft} activity={working ? 'working' : 'idle'} selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={(t) => send(t ?? draft)} onSteer={(t) => send(t ?? draft)} onFollowUp={(t) => send(t ?? draft)}
            onInterrupt={noop} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">{conv.same ? s.model : 'GPT-6 Astra · medium'}</button>} />
          {waitingHere && composerEl ? createPortal(
            <p className="ah-control-reason ah-composer-reason rq-wait" data-testid="composer-waiting" role="status"><Icon name="clock" width={13} height={13} />{waitLine(s)}</p>,
            composerEl) : null}
        </div>
      </ConversationFrame>
      <SignInWindow open={win} onClose={() => setWin(false)} onDone={() => setWin(false)} />
    </div>
  );
  return (
    <StatusBellProvider items={bell}>
      <AppShell mobileTitle={settings ? 'Asetukset' : conv.title} navigationBadge={yours.length} rail={deviceOpen ? undefined : rail} main={main} />
    </StatusBellProvider>
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [scenario, setScenario] = useState(scenarioIndex);
  const [generation, setGeneration] = useState(0);
  const [toast, setToast] = useState('');
  const h = useHost();
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
  useExternal((href) => {
    setToast(href.startsWith('https://claude.com')
      ? `Clauden sivu avautuisi uuteen välilehteen. Kirjautumisen jälkeen se antaa koodin: ${CLAUDE_CODE}`
      : 'OpenAI:n sivu avautuisi uuteen välilehteen. Simuloitu: hyväksyt laitteen, ja palvelin näkee sen.');
  });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t); }, [toast]);
  const restart = (next = scenario) => { scenarioIndex = next; resetHost(); setScenario(next); setToast(''); setGeneration((g) => g + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={SCENARIOS[scenario].id}>
      <header className="rq-bar" ref={bar}>
        <strong>Tekoälyn kirjautuminen vanhentui · kierros 2</strong>
        <label>Tilanne <select id="scenario" value={scenario} onChange={(e) => restart(Number(e.target.value))}>
          {SCENARIOS.map((x, i) => <option key={x.id} value={i}>{x.label}</option>)}</select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        {SCENARIOS[scenario].kind === 'outage' && !h.ok
          ? <button type="button" data-testid="rq-recover" onClick={repair}>Simuloi: Claude vastaa taas</button> : null}
        <button type="button" data-testid="rq-reset" onClick={() => restart()}>Alusta</button>
        <p className="rq-round" data-testid="round-line">{ROUND_LINE}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={generation} enabled>
          <MemoryRouter key={generation} initialEntries={['/workspaces/ws_m?conversation=tunnit']}>
            <Main direction={direction} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {toast ? <p className="rq-toast" role="status" data-testid="rq-toast">{toast}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { resetHost(); flushSync(() => root.render(view === '' ? null : view)); }};
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
