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
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {clockTime} from '../../../../web/src/app/integrations';
import {integrationsText} from '../../../../web/src/text/integrations';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import integrationsExample from '../../../../contracts/v1/examples/integrations.json';
import {type Counts, type Lang, TEXT} from './text';
import './round.css';

// bisync-force-needs-consent, round 1: two-way cloud sync stops on the
// all-files-changed safety stop and does not continue by itself; the person
// sees what one forced continuation would do (the dry run's counts on each
// side) and consents to exactly that count, or asks the agent. Axis: where
// the stop and the decision sit on the account's card in Settings › Tiedot
// agenteille. A is the OneDrive row itself (production's failure place) with
// the count and consent in a dialog, B a notice at the top of the card with
// the same dialog, C an inline panel under the row where the count fills in
// and a dialog only confirms. The page is production's AccountSettings with
// the Microsoft AccountCard unchanged apart from the stop's status words;
// the round's pieces are production primitives portalled into the real card.
// Everything is synthetic.

const NAMES = ['A Rivi', 'B Ilmoitus', 'C Paneeli'];
const A = 0, B = 1, C = 2;
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];

// Production says today that it checks and continues by itself; in this
// round it stops. Only the status words change, in every catalog language.
for (const [code, cat] of Object.entries(integrationsText) as [string, {failure: Record<string, string>}][])
  cat.failure = {...cat.failure, all_changed: TEXT[code === 'fi' ? 'fi' : 'en'].statusStopped};

// ---- The dry runs the host would report (synthetic) ----
type Data = 'few' | 'many';
type Dry = {up: Counts; down: Counts; total: number; names: string[]};
const DRY: Record<Data, Dry> = {
  // An agent reformatted every note in a small folder and added two.
  few: {up: {changed: 14, added: 2, deleted: 0}, down: {changed: 0, added: 0, deleted: 0}, total: 16, names: []},
  // Most of the folder is gone on this side.
  many: {up: {changed: 3, added: 0, deleted: 212}, down: {changed: 0, added: 1, deleted: 0}, total: 240,
    names: ['Raportit/2025-q1.xlsx', 'Raportit/2025-q2.xlsx', 'Raportit/2025-q3.xlsx', 'Sopimukset/vuokrasopimus.pdf', 'Kokoukset/2026-10-02.md']},
};

// ---- The person's host, as the round imagines the daemon reports it ----
type Phase = 'stopped' | 'counting' | 'counted' | 'running' | 'done' | 'refused' | 'failed';
type Host = {
  phase: Phase;
  data: Data;
  /** A, B: the consent dialog is open. */
  open: boolean;
  /** C: the confirmation dialog is open. */
  confirm: boolean;
  agree: boolean;
  /** A file changed after the count (the review bar's simulation). */
  changed: boolean;
  cancelled: boolean;
  countedAt: string;
  doneAt: string;
};
const base = (): Host => ({phase: 'stopped', data: 'few', open: false, confirm: false, agree: false, changed: false, cancelled: false, countedAt: '', doneAt: ''});
const nowClock = () => clockTime(new Date().toISOString()) ?? '';
const SCENARIOS: Record<string, () => Host> = {
  pysahtyi: () => base(),
  lasketaan: () => ({...base(), phase: 'counting', open: true}),
  eipoistoja: () => ({...base(), phase: 'counted', open: true, countedAt: nowClock()}),
  poistoja: () => ({...base(), phase: 'counted', data: 'many', open: true, countedAt: nowClock()}),
  kaynnissa: () => ({...base(), phase: 'running', countedAt: nowClock()}),
  valmis: () => ({...base(), phase: 'done', countedAt: nowClock(), doneAt: nowClock()}),
  torjuttu: () => ({...base(), phase: 'refused'}),
  epaonnistui: () => ({...base(), phase: 'failed'}),
};
const SCENARIO_IDS = Object.keys(SCENARIOS);
let scenario = new URLSearchParams(location.search).get('s') ?? 'pysahtyi';
if (!SCENARIOS[scenario]) scenario = 'pysahtyi';
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const set = (next: Partial<Host>) => { host = {...host, ...next}; listeners.forEach((f) => f()); };
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stoppedLike = (p: Phase) => p !== 'running' && p !== 'done';

// ---- The fetch stand-in behind production's page ----
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const DIR = '~/cloud/microsoft/person@example.test/onedrive';
function onedrive(h: Host) {
  const d = DRY[h.data];
  if (h.phase === 'running')
    return {id: 'onedrive', state: 'ok', access: 'full', directory: DIR, last_synced_at: ago(14),
      progress: {service: 'onedrive', phase: 'transferring', elapsed_seconds: 4, bytes: 0, total_bytes: 0, files: 5, total_files: d.up.changed + d.up.added + d.down.added || 1}};
  if (h.phase === 'done') return {id: 'onedrive', state: 'ok', access: 'full', directory: DIR, last_synced_at: ago(0)};
  return {id: 'onedrive', state: 'sync_failed', failure: 'all_changed', access: 'full', directory: DIR, last_synced_at: ago(14)};
}
const list = () => ({
  ...integrationsExample,
  accounts: [
    {provider: 'microsoft', address: 'person@example.test', checked_at: ago(0), level: 'full', services: [
      onedrive(host),
      {id: 'mail', state: 'ok', access: 'full'},
      {id: 'calendar', state: 'ok', access: 'full'},
      {id: 'contacts', state: 'ok', access: 'full'},
    ], grant: {granted: ['Calendars.ReadWrite', 'Contacts.ReadWrite', 'Files.ReadWrite.All', 'Mail.ReadWrite', 'Mail.Send', 'Sites.ReadWrite.All', 'User.Read'], not_granted: []}},
  ],
});
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(30);
  if (path === '/api/v1/integrations') return json(list());
  if (path === '/api/v1/integrations/login') return json({schema_version: 1, state: 'none'});
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};
/** Production's card reads the host again the way its own Tarkista does;
 * the live page polls the same list. */
const reread = () => (document.querySelector('[data-testid="integration-account-microsoft"] [data-testid="integration-recheck"]') as HTMLElement | null)?.click();

// ---- Flow: count → consent → one forced pass ----
let run = 0;
async function count() {
  const me = ++run;
  set({phase: 'counting', open: true, confirm: false, agree: false, changed: false, cancelled: false});
  await later(900);
  if (me === run) set({phase: 'counted', countedAt: nowClock()});
}
async function proceed() {
  const me = ++run;
  const changed = host.changed;
  set({open: false, confirm: false});
  // The consent names the count it was shown; a later change is not covered.
  if (changed) { set({phase: 'refused'}); return; }
  set({phase: 'running'});
  reread();
  await later(1600);
  if (me !== run) return;
  set({phase: 'done', doneAt: nowClock()});
  reread();
}
const cancel = () => { ++run; set({phase: 'stopped', open: false, confirm: false, agree: false, cancelled: true}); };
let toastSink: (s: string) => void = () => {};
const askAgent = () => toastSink(t().askToast);

// ---- Placing the round's pieces on production's card ----
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
const card = () => document.querySelector('[data-testid="integration-account-microsoft"]');
const odRow = () => card()?.querySelector(':scope > [data-testid="integration-service-onedrive"]') ?? null;

// ---- Shared pieces ----
function Table({d}: {d: Dry}) {
  const x = t();
  const cell = (v: number, del = false) => <td data-zero={v === 0 || undefined} data-danger={(del && v > 0) || undefined}>{v.toLocaleString(lang === 'fi' ? 'fi-FI' : 'en-GB')}</td>;
  return (
    <table className="rq-table" data-testid="dry-table">
      <caption>{x.tableCaption}</caption>
      <thead><tr><th scope="col"><span className="rq-sr">{x.tableCaption}</span></th><th scope="col">{x.changed}</th><th scope="col">{x.added}</th><th scope="col">{x.deleted}</th></tr></thead>
      <tbody>
        <tr data-side="up"><th scope="row">{x.up}</th>{cell(d.up.changed)}{cell(d.up.added)}{cell(d.up.deleted, true)}</tr>
        <tr data-side="down"><th scope="row">{x.down}</th>{cell(d.down.changed)}{cell(d.down.added)}{cell(d.down.deleted, true)}</tr>
      </tbody>
    </table>
  );
}
/** What the dry run says the forced pass would do, and what the consent covers. */
function Summary({withConsent}: {withConsent: boolean}) {
  const h = useHost();
  const x = t();
  const d = DRY[h.data];
  const many = d.up.deleted + d.down.deleted > 0;
  return (
    <div className="rq-summary" data-testid="dry-summary" data-deletions={many ? 'many' : 'none'}>
      {many ? (
        <div className="ig-warn rq-many" role="alert" data-testid="dry-many">
          <Icon name="warning" />
          <div><strong>{x.manyLead(d.up.deleted, d.total)}</strong> {x.manyBody}</div>
        </div>
      ) : null}
      <p className="rq-would" data-testid="dry-would">{x.would(d.up, d.down, d.total)}</p>
      <Table d={d} />
      {d.names.length ? (
        <details className="ig-grant rq-names" data-testid="dry-names">
          <summary>{x.showDeleted(d.up.deleted)}</summary>
          <ul>{d.names.map((nm) => <li key={nm}><code>{nm}</code></li>)}<li className="miss">{x.andMore(d.up.deleted - d.names.length)}</li></ul>
        </details>
      ) : null}
      <p className="rq-fine">{x.both}</p>
      <p className="rq-fine" data-testid="dry-binding">{x.countedAt(h.countedAt)} {x.binding}</p>
      {withConsent && many ? <Checkbox data-testid="consent-agree" label={x.agree} checked={h.agree} onChange={(v) => set({agree: v})} /> : null}
    </div>
  );
}
function ConfirmButton() {
  const h = useHost();
  const x = t();
  const d = DRY[h.data];
  const many = d.up.deleted + d.down.deleted > 0;
  return (
    <ControlButton data-testid="consent-confirm" size="row" variant={many ? 'danger' : 'primary'} isDisabled={many && !h.agree} onPress={() => void proceed()}>
      {many ? x.confirmDelete(d.up.deleted + d.down.deleted) : x.confirm}
    </ControlButton>
  );
}
function Counting() {
  return <p className="ig-st rq-counting" role="status" data-testid="dry-counting"><span className="ig-spin" aria-hidden="true" />{t().counting}</p>;
}
/** The line after a decision: running, done, refused, failed or cancelled. */
function Outcome() {
  const h = useHost();
  const x = t();
  const d = DRY[h.data];
  const text = h.phase === 'running' ? x.running
    : h.phase === 'done' ? `${x.doneAt(h.doneAt)} ${d.up.deleted ? x.doneMany(d.up) : x.doneFew(d.up)} ${x.doneTail}`
    : h.phase === 'refused' ? x.refused
    : h.phase === 'failed' ? x.failed
    : h.cancelled ? x.cancelled : '';
  if (!text) return null;
  return <p className={`rq-outcome${h.phase === 'refused' || h.phase === 'failed' ? ' rq-bad' : ''}`} role="status" data-testid="sync-outcome" data-phase={h.phase}>{text}</p>;
}
function OpenButton({variant = 'secondary'}: {variant?: 'primary' | 'secondary' | 'quiet'}) {
  const h = useHost();
  const x = t();
  return <ControlButton data-testid="open-consent" size="row" variant={variant} onPress={() => void count()}>{h.phase === 'refused' || h.phase === 'failed' ? x.lookAgain : x.look}</ControlButton>;
}
function AskButton() {
  return <ControlButton data-testid="ask-agent" size="row" variant="quiet" onPress={askAgent}>{t().askAgent}</ControlButton>;
}

/** A and B: the count and the consent in one dialog. */
function ConsentDialog() {
  const h = useHost();
  const x = t();
  return (
    <ModalOverlay className="ah-overlay" isOpen={h.open} onOpenChange={(o) => { if (!o) cancel(); }} isDismissable>
      <Modal className="ah-modal">
        <Dialog className="ah-dialog rq-dialog" data-testid="consent-dialog" aria-label={x.dialogTitle}>
          <Heading slot="title">{x.dialogTitle}</Heading>
          {h.phase === 'counting' ? <Counting /> : h.phase === 'counted' ? <Summary withConsent /> : null}
          <div className="ah-dialog-actions">
            <ControlButton data-testid="consent-cancel" size="row" onPress={cancel}>{x.dontContinue}</ControlButton>
            {h.phase === 'counted' ? <ConfirmButton /> : null}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---- A: in OneDrive's own row ----
/** The Microsoft card is what the round is about: bring it to the top of the
 * settings page once production has drawn it. */
function useCardInView() {
  useEffect(() => {
    let done = false;
    const go = () => {
      const c = card();
      if (done || !c) return;
      done = true;
      c.scrollIntoView({block: 'start'});
      const scroller = c.closest('.ah-settings-layer, .ah-state') as HTMLElement | null;
      if (scroller) scroller.scrollTop -= 16;
    };
    go();
    const o = new MutationObserver(go);
    o.observe(document.body, {childList: true, subtree: true});
    return () => o.disconnect();
  }, []);
}

function DirectionA() {
  const slot = useSlot(() => { const r = odRow(); const col = r?.querySelector(':scope > div:nth-child(2)'); return col ? {parent: col, before: null} : null; }, 'a');
  const h = useHost();
  const x = t();
  return (
    <>
      {slot ? createPortal(
        <div className="rq-a" data-testid="sync-stop" data-place="row" data-phase={h.phase}>
          {stoppedLike(h.phase) ? <span className="rq-a-why">{x.stopShort}</span> : null}
          <Outcome />
          {stoppedLike(h.phase) ? <div className="rq-actions"><OpenButton /><AskButton /></div> : null}
        </div>, slot) : null}
      <ConsentDialog />
    </>
  );
}

// ---- B: a notice at the top of the card ----
function DirectionB() {
  const slot = useSlot(() => { const c = card(); const first = c?.querySelector(':scope > .ig-svc'); return c && first ? {parent: c, before: first} : null; }, 'b');
  const h = useHost();
  const x = t();
  const stopped = stoppedLike(h.phase);
  return (
    <>
      {slot ? createPortal(
        <div className="rq-b-wrap">
          <div className={`${stopped ? 'ig-warn' : 'ig-notice'} rq-b`} data-testid="sync-stop" data-place="notice" data-phase={h.phase}>
            <Icon name={stopped ? 'warning' : h.phase === 'done' ? 'check' : 'refresh'} />
            <div>
              {stopped ? <><strong>{x.stopLead}</strong> {x.stopWhy}</> : null}
              <Outcome />
              {stopped ? <div className="rq-actions"><OpenButton variant="primary" /><AskButton /></div> : null}
            </div>
          </div>
        </div>, slot) : null}
      <ConsentDialog />
    </>
  );
}

// ---- C: an inline panel under OneDrive's row ----
function DirectionC() {
  const slot = useSlot(() => { const r = odRow(); return r?.parentElement ? {parent: r.parentElement, before: r.nextSibling} : null; }, 'c');
  const h = useHost();
  const x = t();
  const stopped = stoppedLike(h.phase);
  return (
    <>
      {slot ? createPortal(
        <section className="rq-c" data-testid="sync-stop" data-place="panel" data-phase={h.phase} aria-label={x.panelTitle}>
          {stopped ? <>
            <h4 className="rq-c-h"><Icon name="warning" />{x.panelTitle}</h4>
            <p className="rq-c-why">{x.stopWhy}</p>
          </> : null}
          <Outcome />
          {h.phase === 'counting' ? <Counting /> : h.phase === 'counted' ? <Summary withConsent={false} /> : null}
          {stopped ? (
            <div className="rq-actions">
              {h.phase === 'counted'
                ? <>
                    <ControlButton data-testid="c-continue" size="row" variant={DRY[h.data].up.deleted ? 'danger-subtle' : 'primary'} onPress={() => set({confirm: true, agree: false})}>{x.continueOnce}</ControlButton>
                    <ControlButton data-testid="c-recount" size="row" variant="secondary" onPress={() => void count()}>{x.countAgain}</ControlButton>
                    <ControlButton data-testid="consent-cancel" size="row" variant="quiet" onPress={cancel}>{x.dontContinue}</ControlButton>
                  </>
                : h.phase === 'counting' ? null
                : <ControlButton data-testid="open-consent" size="row" variant="primary" onPress={() => void count()}>{x.count}</ControlButton>}
              <AskButton />
            </div>
          ) : null}
        </section>, slot) : null}
      <ModalOverlay className="ah-overlay" isOpen={h.confirm} onOpenChange={(o) => { if (!o) set({confirm: false}); }} isDismissable>
        <Modal className="ah-modal">
          <Dialog className="ah-dialog rq-dialog" data-testid="c-confirm-dialog" aria-label={x.confirmTitle}>
            <Heading slot="title">{x.confirmTitle}</Heading>
            <p className="rq-would">{x.would(DRY[h.data].up, DRY[h.data].down, DRY[h.data].total)}</p>
            <p className="rq-fine">{x.countedAt(h.countedAt)} {x.binding}</p>
            {DRY[h.data].up.deleted ? <Checkbox data-testid="consent-agree" label={x.agree} checked={h.agree} onChange={(v) => set({agree: v})} /> : null}
            <div className="ah-dialog-actions">
              <ControlButton data-testid="c-confirm-cancel" size="row" onPress={() => set({confirm: false})}>{x.dontContinue}</ControlButton>
              <ConfirmButton />
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}

// ---- The page ----
function Page({direction}: {direction: number}) {
  useCardInView();
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
        <AccountSettings routeSection="tiedot" onNavigate={() => {}}
          profile={{name: 'Aino Esimerkki', email: '', avatar_url: ''}} csrf="prototype"
          nativeState="connected" nativeLogin="aino-esimerkki" onReconnect={() => {}}
          workspaces={[]} onClose={() => {}} />
      </div>
      {direction === A ? <DirectionA /> : direction === B ? <DirectionB /> : <DirectionC />}
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
  toastSink = setToast;
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
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 7000); return () => clearTimeout(id); }, [toast]);
  const restart = (next = s) => { ++run; scenario = next; host = SCENARIOS[next](); setS(next); setToast(''); setGeneration((g) => g + 1); };
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
        <button type="button" data-testid="rq-change" onClick={() => { set({changed: true}); setToast(x.simulated); }}>{x.simulate}</button>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${generation}-${s}-${language}`} enabled={false}>
          <MemoryRouter key={`${generation}-${s}-${language}`} initialEntries={['/settings/data']}>
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
const stageSink = {set innerHTML(view: ReactNode) { ++run; host = SCENARIOS[scenario](); flushSync(() => root.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((nm, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = nm.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// The dialogs are modal, and react-aria makes everything outside them inert.
// The review chrome (picker and bar, with its change simulation) is not part
// of the page under review, so it stays usable while a dialog is open, and
// its presses are not presses outside the dialog (as 2026-11-14-microsoft-folder-sizes).
const keepLive = () => document.querySelectorAll('.proto-picker[inert], .rq-bar[inert], .rq-review[inert], #root[inert]').forEach((el) => el.removeAttribute('inert'));
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'])
  window.addEventListener(type, (e) => { if ((e.target as Element | null)?.closest?.('.proto-picker, .rq-bar')) e.stopPropagation(); }, true);
new MutationObserver(keepLive).observe(document.body, {attributes: true, attributeFilter: ['inert'], subtree: true});
new Function('stage', 'variants', pickerSource)(stageSink, variants);
