import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Checkbox} from '../../../../web/src/components/Primitives';
import {StatusMark} from '../../../../web/src/components/Status';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import integrationsExample from '../../../../contracts/v1/examples/integrations.json';
import {type Lang, TEXT} from './text';
import './round.css';

// github-workflow-scope-from-settings, round 1: where the opt-in for the
// GitHub `workflow` scope lives on Settings › Koodipalvelut's GitHub card.
// Jari 13.11.2026: off by default; turned on only from this card, which runs
// the GitHub sign-in again with the added scope; the card shows the scopes
// the current token has. Axis: where the opt-in sits. A is a row of its own
// in the card, B a plain-words list of every scope with workflow last, C a
// checkbox in a reconnect dialog. The page around them is production's
// AccountSettings (CodeHostSettings) unchanged; the round's pieces are
// production primitives and Settings classes portalled into the real card.
// github.com is a labelled stand-in dialog. Everything is synthetic.

const NAMES = ['A Rivi', 'B Luettelo', 'C Ikkuna'];
const A = 0, B = 1, C = 2;
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];

// ---- The person's host, as the round imagines the daemon reads it ----
const BASE = ['repo', 'read:org', 'gist'];
const ALL = [...BASE, 'workflow'];
type Flow = {scopes: string[]; why: 'on' | 'reconnect'};
type Host = {
  /** The scopes of the token gh holds now; null when they could not be read. */
  scopes: string[] | null;
  /** The person's opt-in, remembered beside the token (NOTES: the host). */
  wanted: boolean;
  /** A GitHub sign-in the card started and has not come back from. */
  flow: Flow | null;
  /** The card's last outcome sentence. */
  said: string;
};
const SCENARIOS: Record<string, () => Host> = {
  pois: () => ({scopes: BASE, wanted: false, flow: null, said: ''}),
  kaynnistyy: () => ({scopes: BASE, wanted: false, flow: {scopes: ALL, why: 'on'}, said: ''}),
  paalla: () => ({scopes: ALL, wanted: true, flow: null, said: ''}),
  kadonnut: () => ({scopes: BASE, wanted: true, flow: null, said: ''}),
  tuntematon: () => ({scopes: null, wanted: false, flow: null, said: ''}),
};
const SCENARIO_IDS = Object.keys(SCENARIOS);
let scenario = new URLSearchParams(location.search).get('s') ?? 'pois';
if (!SCENARIOS[scenario]) scenario = 'pois';
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const set = (next: Partial<Host>) => { host = {...host, ...next}; listeners.forEach((f) => f()); };
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
type Wf = 'off' | 'pending' | 'on' | 'missing' | 'unknown';
const wfState = (h: Host): Wf =>
  h.flow?.why === 'on' ? 'pending' : h.scopes === null ? 'unknown' : h.scopes.includes('workflow') ? 'on' : h.wanted ? 'missing' : 'off';
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Turn on: the gateway's sign-in with the workflow scope added. */
const startOn = () => set({flow: {scopes: ALL, why: 'on'}, said: ''});
/** Production's own Reconnect keeps the opt-in: it asks what the person wants. */
const startReconnect = (workflow = host.wanted) => set({flow: {scopes: workflow ? ALL : BASE, why: 'reconnect'}, said: ''});
/** Turn off: a reconnect for the base scopes. The round assumes GitHub asks
 * nothing for a subset and comes straight back (NOTES: unverified). */
async function turnOff() {
  set({said: ''});
  await later(400);
  set({scopes: BASE, wanted: false, said: t().saidOff});
}
const keepOff = () => set({wanted: false, said: t().saidKeptOff});
function authorize() {
  const f = host.flow;
  if (!f) return;
  const had = host.scopes?.includes('workflow') ?? false;
  const has = f.scopes.includes('workflow');
  const x = t();
  set({scopes: f.scopes, wanted: has, flow: null, said: has && !had ? x.saidOn : !has && had ? x.saidOff : has ? x.saidOn : x.saidReconnected});
}
const cancelFlow = () => set({flow: null, said: t().saidCancelled});

// ---- The fetch stand-in behind production's page ----
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(40);
  if (path === '/api/v1/integrations') return json(integrationsExample);
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};

// ---- Placing the round's pieces on production's card ----
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
const ghRow = () => [...document.querySelectorAll('[data-settings-row="github"]')].find((el) => !el.closest('.rq-slot')) ?? null;
const inRow = (sel: string) => { const r = ghRow(); return r?.querySelector(`:scope > ${sel}`) ?? null; };

// ---- Shared pieces ----
function WfMark({s}: {s: Wf}) {
  const x = t();
  return s === 'on' ? <StatusMark data-testid="wf-mark" kind="success" tone="success" label={x.wfOn} />
    : s === 'pending' ? <StatusMark data-testid="wf-mark" kind="working" tone="info" label={x.wfPending} />
    : s === 'missing' ? <StatusMark data-testid="wf-mark" kind="error" tone="warning" label={x.wfMissing} />
    : s === 'unknown' ? <StatusMark data-testid="wf-mark" kind="unknown" tone="neutral" label={x.wfUnknown} />
    : <StatusMark data-testid="wf-mark" tone="neutral" label={x.wfOff} />;
}
function wfDesc(s: Wf, full: boolean) {
  const x = t();
  return s === 'on' ? x.wfOnDesc : s === 'pending' ? x.wfPendingDesc : s === 'missing' ? x.wfMissingDesc
    : s === 'unknown' ? `${x.wfUnknownDesc} ${full ? x.wfShort : ''}`.trim() : full ? x.wfExplain : x.wfShort;
}
/** The buttons of the opt-in, the same in A and B. */
function WfActions({s}: {s: Wf}) {
  const x = t();
  if (s === 'pending') return <ControlButton data-testid="wf-cancel" size="row" variant="quiet" onPress={cancelFlow}>{x.cancelSignIn}</ControlButton>;
  if (s === 'on') return <ControlButton data-testid="wf-remove" size="row" variant="secondary" onPress={() => void turnOff()}>{x.removePerm}</ControlButton>;
  if (s === 'missing') return (
    <>
      <ControlButton data-testid="wf-keep-off" size="row" variant="quiet" onPress={keepOff}>{x.keepOff}</ControlButton>
      <ControlButton data-testid="wf-allow" size="row" variant="primary" onPress={startOn}>{x.allowAgain}</ControlButton>
    </>
  );
  return <ControlButton data-testid="wf-allow" size="row" variant="secondary" onPress={startOn}>{x.allow}<Icon name="external" /></ControlButton>;
}
function Said() {
  const h = useHost();
  return h.said ? <p className="s-editor s-desc" role="status" data-testid="wf-said">{h.said}</p> : null;
}
/** The token's scopes as chips, in the sign-in row's words. */
function ScopeChips({struck}: {struck?: boolean}) {
  const h = useHost();
  const x = t();
  if (h.scopes === null) return <span className="s-desc rq-scopes" data-testid="scope-chips" data-unknown="">{x.scopesUnknown}</span>;
  const shown = struck ? ALL : h.scopes;
  return (
    <span className="rq-scopes" data-testid="scope-chips">
      <span className="s-desc">{x.scopesLabel}</span>
      <ul className="s-model-chips">
        {shown.map((s) => {
          const missing = !h.scopes!.includes(s);
          return <li key={s} data-scope={s} data-refused={missing || undefined}><code>{s}</code></li>;
        })}
      </ul>
    </span>
  );
}
function ChipsInRow({struck}: {struck?: boolean}) {
  const slot = useSlot(() => { const l = inRow('.s-lbl'); return l ? {parent: l, before: null} : null; }, 'chips');
  return slot ? createPortal(<ScopeChips struck={struck} />, slot) : null;
}

/** github.com, as a labelled stand-in: what the sign-in asks for. */
function GitHubStandIn() {
  const h = useHost();
  const x = t();
  return (
    <ModalOverlay className="ah-overlay" isOpen={!!h.flow} onOpenChange={(o) => { if (!o) cancelFlow(); }} isDismissable>
      <Modal className="ah-modal">
        <Dialog className="ah-dialog rq-gh" data-testid="github-standin" aria-label={x.ghTitle}>
          <Heading slot="title"><Icon name="github" /> {x.ghTitle}</Heading>
          <p className="s-desc">{x.ghAsks}</p>
          <ul className="rq-gh-scopes" data-testid="github-scopes">
            {(h.flow?.scopes ?? []).map((s) => (
              <li key={s} data-scope={s} className={s === 'workflow' ? 'rq-gh-new' : undefined}><code>{s}</code> <span>{x.scopeWords[s]}</span></li>
            ))}
          </ul>
          <p className="s-desc">{x.ghNote}</p>
          <div className="ah-dialog-actions">
            <ControlButton data-testid="github-cancel" size="row" onPress={cancelFlow}>{x.ghCancel}</ControlButton>
            <ControlButton data-testid="github-authorize" size="row" variant="primary" onPress={authorize}>{x.ghAuthorize}</ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---- A: a row of its own in the GitHub card ----
function DirectionA() {
  const slot = useSlot(() => { const r = ghRow(); return r?.parentElement ? {parent: r.parentElement, before: r.nextSibling} : null; }, 'a');
  const h = useHost();
  const s = wfState(h);
  return (
    <>
      <ChipsInRow />
      {slot ? createPortal(
        <div className="s-row s-marked rq-wf-row" data-testid="wf-row" data-settings-row="github-workflow" data-wf={s} tabIndex={-1}>
          <span className="rq-wf-icon"><Icon name="shield" /></span>
          <div className="s-lbl">
            <strong>{t().wfTitle}</strong>
            <span className={`s-desc${s === 'missing' ? ' s-bad' : ''}`} data-testid="wf-desc">{wfDesc(s, true)}</span>
          </div>
          <div className="s-val"><WfMark s={s} /><WfActions s={s} /></div>
          <Said />
        </div>,
        slot,
      ) : null}
    </>
  );
}

// ---- B: every scope in plain words, workflow last ----
function DirectionB() {
  const slot = useSlot(() => { const r = ghRow(); return r ? {parent: r, before: r.querySelector(':scope > .s-editor')} : null; }, 'b');
  const h = useHost();
  const s = wfState(h);
  const x = t();
  if (!slot) return null;
  return createPortal(
    <div className="rq-list" data-testid="scope-list">
      <h4 className="rq-list-h">{x.listTitle}</h4>
      {h.scopes === null ? <p className="s-desc" data-testid="scope-chips" data-unknown="">{x.scopesUnknown}</p> : (
        <ul className="rq-list-items" data-testid="scope-chips">
          {BASE.map((sc) => {
            const has = h.scopes!.includes(sc);
            return (
              <li key={sc} data-scope={sc} data-refused={has ? undefined : ''}>
                <Icon name={has ? 'check' : 'cross'} />
                <span>{x.scopeWords[sc]} <code>{sc}</code></span>
                <span className="s-desc">{has ? x.granted : x.notGranted}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="rq-list-wf" data-testid="wf-row" data-wf={s}>
        <div className="s-lbl">
          <strong>{x.scopeWords.workflow} <code>workflow</code></strong>
          <span className={`s-desc${s === 'missing' ? ' s-bad' : ''}`} data-testid="wf-desc">{wfDesc(s, true)}</span>
        </div>
        <div className="s-val"><WfMark s={s} /><WfActions s={s} /></div>
      </div>
      <Said />
    </div>,
    slot,
  );
}

// ---- C: a checkbox in the reconnect dialog ----
function DirectionC() {
  const lbl = useSlot(() => { const l = inRow('.s-lbl'); return l ? {parent: l, before: null} : null; }, 'c-lbl');
  const val = useSlot(() => { const v = inRow('.s-val'); return v ? {parent: v, before: null} : null; }, 'c-val');
  const editor = useSlot(() => { const r = ghRow(); return r ? {parent: r, before: r.querySelector(':scope > .s-editor')} : null; }, 'c-said');
  const h = useHost();
  const s = wfState(h);
  const x = t();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(h.wanted);
  const show = () => { setChecked(s === 'missing' || h.wanted); setOpen(true); };
  const line = s === 'missing' ? x.wfMissingDesc : s === 'unknown' ? x.wfUnknownDesc : s === 'pending' ? x.wfPendingDesc : x.cLine(s === 'on');
  return (
    <>
      {lbl ? createPortal(
        <>
          <ScopeChips struck />
          <span className={`s-desc${s === 'missing' ? ' s-bad' : ''}`} data-testid="wf-row" data-wf={s}>
            <span data-testid="wf-desc">{line}</span>
          </span>
        </>, lbl) : null}
      {val ? createPortal(
        <ControlButton data-testid="c-reconnect" size="row" variant={s === 'missing' ? 'primary' : 'secondary'} onPress={show}>{x.cReconnect}</ControlButton>,
        val) : null}
      {editor ? createPortal(<Said />, editor) : null}
      <ModalOverlay className="ah-overlay" isOpen={open} onOpenChange={setOpen} isDismissable>
        <Modal className="ah-modal">
          <Dialog className="ah-dialog" data-testid="c-dialog" aria-label={x.cDialogTitle}>
            <Heading slot="title">{x.cDialogTitle}</Heading>
            <p className="s-desc">{x.cDialogIntro}</p>
            <Checkbox data-testid="c-workflow" label={x.cCheckbox} hint={x.wfExplain} checked={checked} onChange={setChecked} />
            <div className="ah-dialog-actions">
              <ControlButton data-testid="c-cancel" size="row" onPress={() => setOpen(false)}>{x.cancel}</ControlButton>
              <ControlButton data-testid="c-continue" size="row" variant="primary" onPress={() => { setOpen(false); startReconnect(checked); }}>{x.cContinue}</ControlButton>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}

// ---- The page ----
function Page({direction}: {direction: number}) {
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
        <AccountSettings routeSection="koodipalvelut" routeRow="github" onNavigate={() => {}}
          profile={{name: 'Aino Esimerkki', email: '', avatar_url: ''}} csrf="prototype"
          nativeState="connected" nativeLogin="aino-esimerkki" onReconnect={() => startReconnect()}
          workspaces={[]} onClose={() => {}} />
      </div>
      {direction === A ? <DirectionA /> : direction === B ? <DirectionB /> : <DirectionC />}
      <GitHubStandIn />
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={lang === 'fi' ? 'Asetukset' : 'Settings'} rail={rail} main={main} />
    </StatusBellProvider>
  );
}

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
      setToast(`${TEXT[lang].away} ${a.href}`);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 5000); return () => clearTimeout(id); }, [toast]);
  const restart = (next = s) => { scenario = next; host = SCENARIOS[next](); setS(next); setToast(''); setGeneration((g) => g + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => restart(e.target.value)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); setGeneration((g) => g + 1);
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => restart()}>{x.reset}</button>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${s}-${language}`} enabled={false}>
          <MemoryRouter key={`${generation}-${s}-${language}`} initialEntries={['/settings/code-hosts']}>
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
const stageSink = {set innerHTML(view: ReactNode) { host = SCENARIOS[scenario](); flushSync(() => root.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
