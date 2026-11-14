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
import {Icon} from '../../../../web/src/components/Icon';
import {Checkbox} from '../../../../web/src/components/Primitives';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings} from '../../../../web/src/components/Account';
import {ConnectDialog} from '../../../../web/src/components/Integrations';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {type Folder, type LoginView, type Provider, gigabytes} from '../../../../web/src/app/integrations';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import integrationsExample from '../../../../contracts/v1/examples/integrations.json';
import {type Lang, TEXT} from './text';
import './round.css';

// microsoft-first-sync-over-quota-and-channel-site-skip, round 1: the
// Microsoft connection's folder step (Settings › Tiedot agenteille › Microsoft
// 365) with sizes, and its refusal after the count. Axis: how the size reaches
// the person before the choice. A is production's FolderStep unchanged, fed a
// Graph estimate per library (the host change only). B opens each library into
// its top-level folders, each with its size. C puts the free space on top as a
// meter the choice fills. The dialog is production's ConnectDialog; B and C
// replace the FolderStep's list, meter and buttons with their own, built from
// production primitives and the step's own classes. Everything is synthetic.

const NAMES = ['A Rivit', 'B Kansiot auki', 'C Tilamittari'];
const A = 0, B = 1, C = 2;
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const GiB = 1024 ** 3;
const g = (n: number) => Math.round(n * GiB);

// ---- The person's Microsoft libraries (synthetic) ----
type Child = {id: string; size: number};
type Root = {id: string; size: number; quotaUsed: number; counted: number; children: Child[]};
const ROOTS: Root[] = [
  {id: 'onedrive', size: g(12.6), quotaUsed: g(16.9), counted: g(12.4), children: [
    {id: 'kuvat', size: g(6.8)}, {id: 'asiakirjat', size: g(2.9)}, {id: 'tallenteet', size: g(2.1)},
    {id: 'tyopoyta', size: g(0.6)}, {id: 'files', size: g(0.2)},
  ]},
  {id: 'myynti', size: g(5.3), quotaUsed: g(8.8), counted: g(5.2), children: [
    {id: 'tarjoukset', size: g(2.4)}, {id: 'sopimukset', size: g(1.7)}, {id: 'esitykset', size: g(1.2)},
  ]},
  {id: 'projektit', size: g(3.8), quotaUsed: g(4.6), counted: g(3.8), children: [
    {id: 'y2026', size: g(2.6)}, {id: 'arkisto', size: g(1.2)},
  ]},
];
const QUOTA = g(20), FREE = g(19.8);
type Kind = 'loading' | 'about' | 'atmost' | 'exact';
type Gone = {id: string; why: 'other' | 'gone'};

// ---- The host, as the round imagines the daemon reports it ----
type Host = {
  phase: 'choose' | 'counting' | 'failed' | 'done';
  kinds: Record<string, Kind>;
  selected: string[];
  /** B: libraries shown open. */
  open: string[];
  unavailable: Gone[];
  counted?: Record<string, number>;
  needed?: number;
  elapsed: number;
};
const kindsAll = (k: Kind) => Object.fromEntries(ROOTS.map((r) => [r.id, k]));
const SCENARIOS: Record<string, () => Host> = {
  ladataan: () => ({phase: 'choose', kinds: kindsAll('loading'), selected: ['onedrive'], open: [], unavailable: [], elapsed: 0}),
  mahtuu: () => ({phase: 'choose', kinds: kindsAll('about'), selected: ['onedrive', 'projektit'], open: [], unavailable: [], elapsed: 0}),
  ylittyy: () => ({phase: 'choose', kinds: kindsAll('about'), selected: ['onedrive', 'myynti', 'projektit'], open: ['onedrive'], unavailable: [], elapsed: 0}),
  arvio: () => ({phase: 'choose', kinds: {onedrive: 'about', myynti: 'atmost', projektit: 'atmost'}, selected: ['onedrive', 'myynti'], open: [], unavailable: [], elapsed: 0}),
  torjuttu: () => ({phase: 'failed', kinds: kindsAll('about'), selected: ['onedrive', 'myynti', 'projektit'], open: [], unavailable: [],
    counted: Object.fromEntries(ROOTS.map((r) => [r.id, r.counted])), needed: ROOTS.reduce((s, r) => s + r.counted, 0), elapsed: 0}),
  sivusto: () => ({phase: 'choose', kinds: kindsAll('about'), selected: ['onedrive'], open: [], unavailable: [{id: 'channel', why: 'other'}, {id: 'intranet', why: 'gone'}], elapsed: 0}),
};
const SCENARIO_IDS = Object.keys(SCENARIOS);
let scenario = new URLSearchParams(location.search).get('s') ?? 'mahtuu';
if (!SCENARIOS[scenario]) scenario = 'mahtuu';
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const set = (next: Partial<Host>) => { host = {...host, ...next}; listeners.forEach((f) => f()); };
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}

// ---- Sizes ----
const root = (id: string) => ROOTS.find((r) => r.id === id)!;
const childOf = (id: string): [Root, Child] | null => {
  const [r, c] = id.split('/');
  if (!c) return null;
  const rr = root(r);
  return [rr, rr.children.find((x) => x.id === c)!];
};
/** The bytes the host would report for a root, in its kind. */
const rootBytes = (h: Host, r: Root): number | undefined => {
  const k = h.kinds[r.id];
  return k === 'loading' ? undefined : k === 'atmost' ? r.quotaUsed : k === 'exact' ? (h.counted?.[r.id] ?? r.counted) : r.size;
};
/** Children are listed with sizes only when the root's own size came from the listing. */
const childKnown = (h: Host, r: Root) => h.kinds[r.id] === 'about' || h.kinds[r.id] === 'exact';
type Total = {bytes: number; unknown: boolean; upper: boolean; approx: boolean};
function total(h: Host, ids = h.selected): Total {
  const out: Total = {bytes: 0, unknown: false, upper: false, approx: false};
  for (const id of ids) {
    const ch = childOf(id);
    const r = ch ? ch[0] : root(id);
    const k = h.kinds[r.id];
    if (ch) {
      if (!childKnown(h, r)) { out.unknown = true; continue; }
      out.bytes += ch[1].size;
    } else {
      const b = rootBytes(h, r);
      if (b === undefined) { out.unknown = true; continue; }
      out.bytes += b;
    }
    out.upper ||= k === 'atmost';
    out.approx ||= k === 'about' || (k === 'exact' && !!ch);
  }
  return out;
}
const sizeText = (k: Kind, bytes?: number) => {
  const x = t();
  if (k === 'loading' || bytes === undefined) return x.loading;
  return k === 'atmost' ? x.atMost(gigabytes(bytes)) : k === 'exact' ? x.counted(gigabytes(bytes)) : x.about(gigabytes(bytes));
};

// ---- Flow: start → count → refuse or done ----
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
let run = 0;
async function start(ids: string[]) {
  const me = ++run;
  set({selected: ids, phase: 'counting', elapsed: 0});
  for (let i = 1; i <= 4; i++) { await later(220); if (me !== run) return; set({elapsed: i * 61}); }
  const counted: Record<string, number> = {...(host.counted ?? {})};
  let needed = 0;
  for (const id of ids) {
    const ch = childOf(id);
    if (ch) needed += ch[1].size;
    else { counted[id] = root(id).counted; needed += root(id).counted; }
  }
  set(needed > FREE ? {phase: 'failed', counted, needed} : {phase: 'done', counted, needed});
}
/** B and C: the refusal goes back to the choice with the counted sizes. */
const chooseAgain = () => {
  const kinds = {...host.kinds};
  for (const id of Object.keys(host.counted ?? {})) kinds[id] = 'exact';
  const big = [...host.selected].filter((id) => !childOf(id)).sort((a, b) => (host.counted?.[b] ?? 0) - (host.counted?.[a] ?? 0))[0];
  set({phase: 'choose', kinds, open: big ? [big] : host.open});
};
const restartA = () => set({...SCENARIOS.mahtuu(), selected: ['onedrive']});

// ---- The fetch stand-in behind production's page ----
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(30);
  if (path === '/api/v1/integrations') return json(integrationsExample);
  if (path === '/api/v1/integrations/login') return json({schema_version: 1, state: 'none'});
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};

const provider = (integrationsExample.providers as Provider[]).find((p) => p.id === 'microsoft')!;
const ADDRESS = 'aino.esimerkki@contoso.example';
const DIRECTORY = '~/cloud/microsoft/aino.esimerkki@contoso.example';

/** Production's login view for the host's state. A is fed it in full. */
function view(h: Host, d: number): LoginView {
  const base = {schema_version: 1, attempt_id: '20261114T082800.000000001', provider: 'microsoft', address: ADDRESS, relogin: false} as const;
  if (h.phase === 'counting')
    return {...base, state: 'completing', progress: {phase: 'inventory', elapsed_seconds: h.elapsed, bytes: 0, total_bytes: 0, files: 0, total_files: 0}} as LoginView;
  if (h.phase === 'failed') return {...base, state: 'failed', failure: 'quota_insufficient'} as LoginView;
  if (h.phase === 'done') return {...base, state: 'completed', directory: DIRECTORY} as LoginView;
  const folders: Folder[] = ROOTS.map((r) => {
    const k = h.kinds[r.id];
    const b = rootBytes(h, r);
    return {id: r.id, name: t().names[r.id], suggested: h.selected.includes(r.id),
      ...(k === 'loading' ? {measuring: true} : {bytes: b, ...(k === 'exact' ? {} : {estimated: true})})} as Folder;
  });
  // A keeps production's notice for unopened sites (its words replaced below).
  const sites = d === A && h.unavailable.length ? {unavailable_sites: h.unavailable.map((u) => t().names[u.id])} : {};
  return {...base, state: 'choose_folders', directory: DIRECTORY, free_bytes: FREE, quota_bytes: QUOTA, folders, ...sites} as LoginView;
}

// ---- Placing the round's pieces in production's dialog ----
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
const flow = () => document.querySelector('[data-testid="integration-dialog"] .ig-flow');
const after = (sel: string) => () => {
  const f = flow(); const el = f?.querySelector(`:scope > ${sel}`);
  return f && el ? {parent: f, before: el.nextSibling} : null;
};
const before = (sel: string) => () => {
  const f = flow(); const el = f?.querySelector(`:scope > ${sel}`);
  return f && el ? {parent: f, before: el} : null;
};

// ---- Shared pieces ----
function NeedLine({h}: {h: Host}) {
  const x = t();
  const needed = h.needed ?? 0;
  return <p className="ig-p rq-need" data-testid="need-line"><b>{x.needLine(gigabytes(needed), gigabytes(FREE), gigabytes(Math.max(0, needed - FREE)))}</b></p>;
}
function CountedList({h}: {h: Host}) {
  const x = t();
  return (
    <div className="rq-counted" data-testid="counted-list">
      <span className="ig-meta">{x.countedTitle}</span>
      <ul>
        {h.selected.map((id) => {
          const ch = childOf(id);
          const name = ch ? `${x.names[ch[0].id]} › ${x.names[ch[1].id] ?? x.rootFiles}` : x.names[id];
          const bytes = ch ? ch[1].size : (h.counted?.[id] ?? root(id).counted);
          return <li key={id}><span>{name}</span><span className="ig-meta">{gigabytes(bytes)}</span></li>;
        })}
      </ul>
    </div>
  );
}
function GoneRows({h}: {h: Host}) {
  const x = t();
  return (
    <>
      {h.unavailable.map((u) => (
        <div key={u.id} className="ig-folder rq-gone" data-testid={`gone-${u.id}`} data-why={u.why}>
          <Checkbox label={x.names[u.id]} checked={false} onChange={() => {}}
            availability={{state: 'unsupported', reason: u.why === 'other' ? x.otherTenant : x.notFound}} />
          <span className="ig-meta"><Icon name="warning" /> {x.notOpen}</span>
        </div>
      ))}
    </>
  );
}
/** B and C's own buttons, in production's row. */
function Buttons({h, ok, onCancel}: {h: Host; ok: boolean; onCancel: () => void}) {
  const x = t();
  const tot = total(h);
  return (
    <div className="ig-row rq-own-row">
      <ControlButton data-testid="rq-cancel" size="page" variant="secondary" onPress={onCancel}>{lang === 'fi' ? 'Peruuta' : 'Cancel'}</ControlButton>
      <ControlButton data-testid="rq-start" size="page" variant="primary" isDisabled={!ok || h.selected.length === 0} onPress={() => void start(h.selected)}>
        <Icon name="refresh" />{tot.upper || tot.unknown ? x.startCount : (lang === 'fi' ? 'Aloita synkronointi' : 'Start synchronization')}
      </ControlButton>
    </div>
  );
}
/** Over by an estimate close to the count, or by the count: not started.
 * Over only by Microsoft's upper bound: the count decides. */
const canStart = (tot: Total) => tot.unknown || tot.bytes <= FREE || tot.upper;

// ---- A: production's folder step, fed Graph's estimate ----
function DirectionA() {
  const h = useHost();
  const x = t();
  const need = useSlot(after('[data-testid="integration-quota-refusal"]'), 'a-need');
  const sites = useSlot(after('[data-testid="integration-unavailable-sites"]'), 'a-sites');
  const other = h.unavailable.find((u) => u.why === 'other');
  const gone = h.unavailable.find((u) => u.why === 'gone');
  return (
    <>
      {need && h.phase === 'failed' ? createPortal(<NeedLine h={h} />, need) : null}
      {sites && other && gone ? createPortal(
        <p className="ig-result bad" role="status" data-testid="rq-sites-notice"><Icon name="warning" />
          <span>{x.sitesNotice(x.names[other.id], x.names[gone.id])}</span></p>, sites) : null}
    </>
  );
}

// ---- B: libraries open into their folders ----
function toggleB(h: Host, id: string, on: boolean) {
  const ch = childOf(id);
  let s = h.selected;
  if (!on) s = s.filter((x) => x !== id);
  else if (ch) s = [...s.filter((x) => x !== ch[0].id), id];
  else s = [...s.filter((x) => !x.startsWith(`${id}/`)), id];
  set({selected: s});
}
function DirectionB({onCancel}: {onCancel: () => void}) {
  const h = useHost();
  const x = t();
  const slot = useSlot(before('.ig-folders'), 'b');
  const refusal = useSlot(after('[data-testid="integration-quota-refusal"]'), 'b-refusal');
  const tot = total(h);
  const over = !tot.unknown && tot.bytes > FREE;
  const toggleOpen = (id: string) => set({open: h.open.includes(id) ? h.open.filter((o) => o !== id) : [...h.open, id]});
  if (h.phase === 'failed')
    return refusal ? createPortal(
      <div className="rq-refusal" data-testid="rq-refusal">
        <NeedLine h={h} />
        <CountedList h={h} />
        <p className="ig-p">{x.keptChoose}</p>
        <div className="ig-row">
          <ControlButton data-testid="rq-close" size="page" variant="secondary" onPress={onCancel}>{x.closeDialog}</ControlButton>
          <ControlButton data-testid="rq-choose-again" size="page" variant="primary" onPress={chooseAgain}>{x.chooseAgain}</ControlButton>
        </div>
      </div>, refusal) : null;
  if (h.phase !== 'choose' || !slot) return null;
  return createPortal(
    <>
      <fieldset className="ig-folders rq-tree" data-testid="rq-folders">
        <legend className="ig-sr">OneDrive · SharePoint</legend>
        {ROOTS.map((r) => {
          const k = h.kinds[r.id];
          const isOpen = h.open.includes(r.id);
          const parts = h.selected.filter((s) => s.startsWith(`${r.id}/`));
          const partBytes = parts.reduce((s, id) => s + childOf(id)![1].size, 0);
          return (
            <div key={r.id} className="rq-lib" data-testid={`rq-lib-${r.id}`} data-open={isOpen || undefined}>
              <div className="ig-folder rq-libhead">
                <ControlButton data-testid={`rq-open-${r.id}`} size="row" variant="quiet" presentation="icon"
                  aria-label={isOpen ? x.close(x.names[r.id]) : x.open(x.names[r.id])} aria-expanded={isOpen}
                  onPress={() => toggleOpen(r.id)}>
                  <Icon name={isOpen ? 'down' : 'forward'} />
                </ControlButton>
                <Checkbox data-testid={`rq-check-${r.id}`} label={x.names[r.id]} checked={h.selected.includes(r.id)}
                  hint={k === 'atmost' ? x.atMostHint : undefined} onChange={(on) => toggleB(h, r.id, on)} />
                <span className="ig-meta" data-testid={`rq-size-${r.id}`} data-kind={k}>
                  {parts.length ? x.partOf(parts.length, r.children.length, x.about(gigabytes(partBytes))) : sizeText(k, rootBytes(h, r))}
                </span>
              </div>
              {isOpen ? (
                <div className="rq-children" data-testid={`rq-children-${r.id}`}>
                  {r.children.map((c) => {
                    const id = `${r.id}/${c.id}`;
                    return (
                      <div key={c.id} className="ig-folder rq-child">
                        <Checkbox data-testid={`rq-check-${r.id}-${c.id}`} label={x.names[c.id] ?? x.rootFiles}
                          checked={h.selected.includes(id) || h.selected.includes(r.id)}
                          onChange={(on) => {
                            if (!on && h.selected.includes(r.id))
                              set({selected: [...h.selected.filter((s) => s !== r.id), ...r.children.filter((o) => o.id !== c.id).map((o) => `${r.id}/${o.id}`)]});
                            else toggleB(h, id, on);
                          }} />
                        <span className="ig-meta">{childKnown(h, r) ? x.about(gigabytes(c.size)) : x.loading}</span>
                      </div>
                    );
                  })}
                  {!childKnown(h, r) && k !== 'loading' ? <p className="ig-meta rq-later">{x.childrenLater}</p> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <GoneRows h={h} />
      </fieldset>
      <Room h={h} tot={tot} over={over} overText={x.overB} />
      <Buttons h={h} ok={canStart(tot)} onCancel={onCancel} />
    </>,
    slot,
  );
}

/** Production's meter line (`ig-room`) in the round's words. */
function Room({h, tot, over, overText, bar = true}: {h: Host; tot: Total; over: boolean; overText: (a: string, b: string) => string; bar?: boolean}) {
  const x = t();
  const hard = over && !tot.upper;
  const text = h.selected.length === 0 ? `${x.nothingChosen} ${x.free(gigabytes(FREE))}`
    : tot.unknown ? x.loadingChosen
    : over && tot.upper ? x.maybe(gigabytes(tot.bytes), gigabytes(FREE))
    : over && !tot.approx ? x.overExact(gigabytes(tot.bytes), gigabytes(FREE))
    : over ? overText(gigabytes(tot.bytes), gigabytes(FREE))
    : x.fits(tot.approx, tot.upper, gigabytes(tot.bytes), gigabytes(FREE), gigabytes(QUOTA));
  return (
    <div data-testid="rq-capacity" data-over={over} data-maybe={over && tot.upper} className={`ig-room${hard ? ' over' : ''}${over && tot.upper ? ' rq-maybe' : ''}`}>
      {bar && !tot.unknown && h.selected.length ? (
        <span className="ig-quota" aria-hidden="true">
          <span className="u" style={{width: `${(100 * (QUOTA - FREE)) / QUOTA}%`}} />
          <span className={`n${tot.upper ? ' rq-hatch' : ''}`} style={{width: `${(100 * Math.min(tot.bytes, FREE)) / QUOTA}%`}} />
        </span>
      ) : null}
      <span role="status">{hard || (over && tot.upper) ? <Icon name={hard ? 'warning' : 'info'} /> : null}<span>{text}</span></span>
    </div>
  );
}

// ---- C: the free space as a meter on top ----
const TONES = ['rq-t1', 'rq-t2', 'rq-t3'];
function Meter({h, counted}: {h: Host; counted?: boolean}) {
  const x = t();
  const tot = counted ? {bytes: h.needed ?? 0, unknown: false, upper: false, approx: false} : total(h);
  const scale = Math.max(QUOTA, (QUOTA - FREE) + tot.bytes);
  const pct = (n: number) => `${(100 * n) / scale}%`;
  const over = tot.bytes > FREE;
  const segs = h.selected.map((id, i) => {
    const r = root(id.split('/')[0]);
    const ch = childOf(id);
    const k = h.kinds[r.id];
    const bytes = counted ? (ch ? ch[1].size : (h.counted?.[id] ?? r.counted)) : ch ? (childKnown(h, r) ? ch[1].size : 0) : (rootBytes(h, r) ?? 0);
    return {id, bytes, hatch: !counted && k === 'atmost', tone: TONES[ROOTS.indexOf(r) % TONES.length], i};
  });
  return (
    <div className={`rq-meter${over ? ' over' : ''}`} data-testid="rq-meter" data-over={over}>
      <div className="rq-meter-bar" aria-hidden="true">
        <span className="rq-m-used" style={{width: pct(QUOTA - FREE)}} />
        {segs.map((s) => <span key={s.id} className={`rq-m-seg ${s.tone}${s.hatch ? ' rq-hatch' : ''}`} style={{width: pct(s.bytes)}} />)}
        <span className="rq-m-limit" style={{left: pct(QUOTA)}} />
      </div>
      <div className="rq-meter-legend">
        <span><i className="rq-m-used" /> {x.meterUsed} {gigabytes(QUOTA - FREE)}</span>
        {segs.map((s) => {
          const ch = childOf(s.id);
          return <span key={s.id}><i className={`rq-m-seg ${s.tone}${s.hatch ? ' rq-hatch' : ''}`} /> {ch ? x.names[ch[1].id] : x.names[s.id]} {tot.unknown && !s.bytes ? '…' : gigabytes(s.bytes)}</span>;
        })}
        <b className={over && !tot.upper ? 'rq-m-overtext' : ''}>{tot.unknown ? '' : over ? (tot.upper ? x.meterMaybeOver(gigabytes(tot.bytes - FREE)) : x.meterOver(gigabytes(tot.bytes - FREE))) : x.meterFree(gigabytes(FREE - tot.bytes))}</b>
      </div>
      {segs.some((s) => s.hatch) ? <p className="ig-meta">{x.meterUncertain}</p> : null}
    </div>
  );
}
function DirectionC({onCancel}: {onCancel: () => void}) {
  const h = useHost();
  const x = t();
  const slot = useSlot(before('.ig-folders'), 'c');
  const refusal = useSlot(after('[data-testid="integration-quota-refusal"]'), 'c-refusal');
  const tot = total(h);
  const over = !tot.unknown && tot.bytes > FREE;
  if (h.phase === 'failed')
    return refusal ? createPortal(
      <div className="rq-refusal" data-testid="rq-refusal">
        <Meter h={h} counted />
        <NeedLine h={h} />
        <p className="ig-p">{x.keptChoose}</p>
        <div className="ig-row">
          <ControlButton data-testid="rq-close" size="page" variant="secondary" onPress={onCancel}>{x.closeDialog}</ControlButton>
          <ControlButton data-testid="rq-choose-again" size="page" variant="primary" onPress={chooseAgain}>{x.chooseAgain}</ControlButton>
        </div>
      </div>, refusal) : null;
  if (h.phase !== 'choose' || !slot) return null;
  const left = FREE - (tot.unknown ? 0 : tot.bytes);
  return createPortal(
    <>
      <Meter h={h} />
      <fieldset className="ig-folders rq-folder-list" data-testid="rq-folders">
        <legend className="ig-sr">OneDrive · SharePoint</legend>
        {ROOTS.map((r) => {
          const k = h.kinds[r.id];
          const b = rootBytes(h, r);
          const on = h.selected.includes(r.id);
          const tooBig = b !== undefined && k !== 'atmost' && b > FREE;
          const noRoom = !on && b !== undefined && k !== 'atmost' && b > left;
          return (
            <div key={r.id} className={`ig-folder${noRoom || tooBig ? ' rq-noroom' : ''}`} data-testid={`rq-lib-${r.id}`}>
              <Checkbox data-testid={`rq-check-${r.id}`} label={x.names[r.id]} checked={on}
                hint={k === 'atmost' ? x.atMostHint : undefined}
                onChange={(v) => set({selected: v ? [...h.selected, r.id] : h.selected.filter((s) => s !== r.id)})} />
              <span className="ig-meta rq-cmeta">
                <span data-testid={`rq-size-${r.id}`} data-kind={k}>{sizeText(k, b)}</span>
                {tooBig ? <span className="rq-chip" data-testid={`rq-noroom-${r.id}`}>{x.aloneTooBig}</span>
                  : noRoom ? <span className="rq-chip" data-testid={`rq-noroom-${r.id}`}>{x.noRoom}</span> : null}
              </span>
            </div>
          );
        })}
        <GoneRows h={h} />
      </fieldset>
      <Room h={h} tot={tot} over={over} overText={x.overC} bar={false} />
      <Buttons h={h} ok={canStart(tot)} onCancel={onCancel} />
    </>,
    slot,
  );
}

// ---- The page ----
function Page({direction}: {direction: number}) {
  const h = useHost();
  const [open, setOpen] = useState(true);
  const rail = (
    <WorkspaceRail>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  const close = () => { run++; setOpen(false); };
  // react-aria portals the dialog to the body: the round's rules key on the root.
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.dataset.rqDirection = String(direction);
    el.dataset.rqPhase = h.phase;
  }, [direction, h.phase]);
  const main = (
    <div className="ah-settings-layer">
      <div className="ah-state">
        <AccountSettings routeSection="tiedot" onNavigate={() => {}}
          profile={{name: 'Aino Esimerkki', email: '', avatar_url: ''}} csrf="prototype"
          nativeState="connected" nativeLogin="aino-esimerkki" onReconnect={() => {}}
          workspaces={[]} onClose={() => {}} />
      </div>
      {open ? (
        <div className={`rq-dialog-root${direction !== A ? ' rq-own' : ''}`} data-phase={h.phase}>
          <ConnectDialog provider={provider} stage={{stage: 'login', view: view(h, direction)}}
            key={`${h.phase}-${JSON.stringify(h.kinds)}`}
            onContinue={() => {}} onPassword={() => {}} onPaste={() => {}}
            onFolders={(ids) => void start(ids)} onSkipFolders={close}
            onRestart={restartA} onClose={close} />
          {direction === A ? <DirectionA /> : direction === B ? <DirectionB onCancel={close} /> : <DirectionC onCancel={close} />}
        </div>
      ) : (
        <button type="button" className="rq-reopen" data-testid="rq-reopen" onClick={() => setOpen(true)}>Microsoft 365 ›</button>
      )}
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
  const restart = (next = s) => { run++; scenario = next; host = SCENARIOS[next](); setS(next); setToast(''); setGeneration((n) => n + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => restart(e.target.value)}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); setGeneration((n) => n + 1);
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// The dialog is modal, and react-aria makes everything outside it inert. The
// review chrome (picker and bar) is not part of the page under review, so it
// stays usable while the dialog is open.
const keepLive = () => document.querySelectorAll('.proto-picker[inert], .rq-bar[inert], .rq-review[inert], #root[inert]').forEach((el) => el.removeAttribute('inert'));
// Its presses are not presses outside the dialog either: react-aria would
// close the dialog and swallow the click. Clicks themselves still arrive.
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'])
  window.addEventListener(type, (e) => { if ((e.target as Element | null)?.closest?.('.proto-picker, .rq-bar')) e.stopPropagation(); }, true);
new MutationObserver(keepLive).observe(document.body, {attributes: true, attributeFilter: ['inert'], subtree: true});
new Function('stage', 'variants', pickerSource)(stageSink, variants);
