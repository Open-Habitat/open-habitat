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
import {Checkbox, Select, TextArea} from '../../../../web/src/components/Primitives';
import {StatusMark} from '../../../../web/src/components/Status';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {WarningBannerView} from '../../../../web/src/components/WarningBanner';
import {AccountSettings} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {bytes} from '../../../../web/src/app/storageQuota';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {type Lang, TEXT} from './text';
import './round.css';

// storage-warning-no-breakdown, round 2: Settings › Tallennustila, where
// the over-85 % warning leads. Jari chose round 1's B (a freeable checklist
// that builds the request) and asked for plain-language groups with paths
// behind "Näytä tarkemmin", and a bar that shows what the selection frees
// against the limit and the 85 % line. Axis: how the bar and the checklist
// combine. B1 previews the selection in one bar above an ordinary list, B2
// makes the bar's parts the selection, B3 is a compact before/after summary
// that stays in view above the list. The page around them is production's
// AccountSettings Storage section (Worktrees, Trash) unchanged over
// synthetic replies; the round's card replaces only its usage card. The new
// conversation is a labelled stand-in. Everything is synthetic.

const NAMES = ['B1 Esikatselu', 'B2 Palkkivalinta', 'B3 Ennen ja jälkeen'];
let lang: Lang = 'fi';
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const G = 1024 ** 3;
const gib = (n: number) => Math.round(n * G);

// ---- The breakdown, as the round imagines the daemon measures it (NOTES) ----
type Group = 'caches' | 'finished' | 'live' | 'own' | 'trash' | 'workspaces' | 'history' | 'other';
type Item = {
  id: string;
  group: Group;
  /** A key into TEXT.items, or a workspace name. */
  label: string;
  path: string;
  bytes: number;
  /** The tool's own clean command; absent: remove the directory. */
  clean?: string;
  /** The worktree's run: title while running, '' once finished. */
  run?: string;
  merged?: boolean;
};
type Breakdown = {items: Item[]; measuredAt: string};
type Host = {
  shared: boolean;
  used: number;
  bound: number;
  /** The person's own files; on a shared disk, less than `used`. */
  own: number;
  breakdown: Breakdown | null;
  measuring: boolean;
};
const CACHES: Item[] = [
  {id: 'go-build', group: 'caches', label: 'go-build', path: '~/.cache/go-build', bytes: gib(21.8), clean: 'go clean -cache'},
  {id: 'npm', group: 'caches', label: 'npm', path: '~/.npm/_cacache', bytes: gib(3.1), clean: 'npm cache clean --force'},
  {id: 'cargo', group: 'caches', label: 'cargo', path: '~/.cargo/registry', bytes: gib(1.9)},
  {id: 'go-mod', group: 'caches', label: 'go-mod', path: '~/go/pkg/mod', bytes: gib(1.6), clean: 'go clean -modcache'},
  {id: 'playwright', group: 'caches', label: 'playwright', path: '~/.cache/ms-playwright', bytes: gib(1.6), clean: 'npx playwright uninstall --all'},
  {id: 'uv', group: 'caches', label: 'uv', path: '~/.cache/uv', bytes: gib(1.0), clean: 'uv cache clean'},
  {id: 'pip', group: 'caches', label: 'pip', path: '~/.cache/pip', bytes: gib(0.4), clean: 'pip cache purge'},
];
const LIVE: Item[] = [
  {id: 'wt-kalenteri', group: 'live', label: 'target', path: '~/src/aurinkokello__worktrees/wt-kalenteri/target', bytes: gib(14.6), run: 'Kalenterinäkymä'},
  {id: 'wt-haku-nopeus', group: 'live', label: 'target', path: '~/src/aurinkokello__worktrees/wt-haku-nopeus/target', bytes: gib(11.4), run: 'Haun nopeutus'},
];
const FINISHED: Item[] = [
  {id: 'wt-vanha-haku', group: 'finished', label: 'target', path: '~/src/aurinkokello__worktrees/wt-vanha-haku/target', bytes: gib(8.9), clean: 'cargo clean', run: ''},
  {id: 'wt-otsikko', group: 'finished', label: 'node_modules', path: '~/src/kotisivu__worktrees/wt-otsikko/node_modules', bytes: gib(0.6), merged: true},
];
const OWN: Item[] = [
  {id: 'own-aurinkokello', group: 'own', label: 'target', path: '~/src/aurinkokello/target', bytes: gib(2.4), clean: 'cargo clean'},
  {id: 'own-kotisivu', group: 'own', label: 'node_modules', path: '~/src/kotisivu/node_modules', bytes: gib(0.5)},
];
const REST = (trash: number): Item[] => [
  {id: 'ws-aurinkokello', group: 'workspaces', label: 'aurinkokello', path: '~/src/aurinkokello', bytes: gib(18.2)},
  {id: 'ws-kotisivu', group: 'workspaces', label: 'kotisivu', path: '~/src/kotisivu', bytes: gib(7.5)},
  {id: 'ws-muistiinpanot', group: 'workspaces', label: 'muistiinpanot', path: '~/src/muistiinpanot', bytes: gib(4.3)},
  ...(trash ? [{id: 'trash', group: 'trash' as const, label: 'trash', path: '~/.local/share/Trash', bytes: gib(trash)}] : []),
  {id: 'history', group: 'history', label: 'history', path: '~/.pi', bytes: gib(2.9)},
  {id: 'other', group: 'other', label: 'other', path: '~', bytes: gib(6.7)},
];
const total = (items: Item[]) => items.reduce((s, i) => s + i.bytes, 0);
const full = [...CACHES, ...FINISHED, ...LIVE, ...OWN, ...REST(4.2)];
const cleaned = [
  {...CACHES[0], bytes: gib(0.4)}, {...CACHES[1], bytes: gib(0.2)}, CACHES[2], CACHES[3], CACHES[4], {...CACHES[5], bytes: gib(0.1)},
  ...LIVE, ...OWN, ...REST(0),
];
const LIMIT = gib(128);
const SCENARIOS: Record<string, () => Host> = {
  varoitus: () => ({shared: false, used: total(full), bound: LIMIT, own: total(full), breakdown: {items: full, measuredAt: '9.12'}, measuring: false}),
  normaali: () => ({shared: false, used: total(cleaned), bound: LIMIT, own: total(cleaned), breakdown: {items: cleaned, measuredAt: '11.40'}, measuring: false}),
  mitataan: () => ({shared: false, used: total(full), bound: LIMIT, own: total(full), breakdown: null, measuring: true}),
  jaettu: () => ({shared: true, used: gib(1720), bound: gib(1843), own: total(full), breakdown: {items: full, measuredAt: '9.12'}, measuring: false}),
};
const SCENARIO_IDS = Object.keys(SCENARIOS);
let scenario = new URLSearchParams(location.search).get('s') ?? 'varoitus';
if (!SCENARIOS[scenario]) scenario = 'varoitus';
let host: Host = SCENARIOS[scenario]();
const freeableItems = (h: Host) => h.breakdown?.items.filter((i) => i.group === 'caches' || i.group === 'finished') ?? [];
/** The default selection: everything regenerable that no worker and no main checkout uses. */
let selected = new Set(freeableItems(host).map((i) => i.id));
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const set = (next: Partial<Host>) => { host = {...host, ...next}; emit(); };
const setSelected = (next: Set<string>) => { selected = next; emit(); };
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const percentOf = (h: Host) => Math.floor((100 * h.used) / h.bound);
const NEAR = 85;
async function remeasure() {
  const before = host.breakdown;
  set({measuring: true});
  await later(1200);
  const now = new Date();
  const items = before?.items ?? SCENARIOS.varoitus().breakdown!.items;
  set({measuring: false, breakdown: {items, measuredAt: `${now.getHours()}.${String(now.getMinutes()).padStart(2, '0')}`}});
  if (!before) setSelected(new Set(freeableItems(host).map((i) => i.id)));
}

// ---- The fetch stand-in behind production's Storage section ----
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const wt = (name: string, ws: string, wsId: string, state: string, size: number, ignored: string[], extra: Record<string, unknown>, token: string) => ({
  workspace_id: wsId, workspace_name: ws, entry: name, name, path: `~/src/${ws}__worktrees/${name}`, state,
  branch: name, head: '0123456789abcdef0123456789abcdef01234567', base: 'main', ahead: state === 'merged' ? 0 : 4,
  changed: 0, untracked: 0, ignored: ignored.length, ignored_paths: ignored, unreachable_head: false,
  size_bytes: size, size_complete: true, observation_token: `wt_${token.repeat(24)}`, ...extra,
});
const worktrees = () => ({
  schema_version: 1, state: 'listed', truncated: false, complete: true, listing_token: '0'.repeat(64),
  worktrees: [
    wt('wt-kalenteri', 'aurinkokello', 'ws_aurinkokello', 'unmerged', gib(15.1), ['target/'], {
      blockers: [{kind: 'taskfleet_run', run_id: '01m7aaaaaaaaaaaaaaaaaaaaaa'}], actions: [],
      owner: {run_id: '01m7aaaaaaaaaaaaaaaaaaaaaa', role: 'worker', title: 'Kalenterinäkymä', state: 'working'}}, 'A'),
    wt('wt-haku-nopeus', 'aurinkokello', 'ws_aurinkokello', 'unmerged', gib(11.8), ['target/'], {
      blockers: [{kind: 'taskfleet_run', run_id: '01m7bbbbbbbbbbbbbbbbbbbbbb'}], actions: [],
      owner: {run_id: '01m7bbbbbbbbbbbbbbbbbbbbbb', role: 'worker', title: 'Haun nopeutus', state: 'working'}}, 'B'),
    ...(scenario === 'normaali' ? [] : [
      wt('wt-vanha-haku', 'aurinkokello', 'ws_aurinkokello', 'merged', gib(9.3), ['target/'], {
        blockers: [], actions: ['remove'], conversations: 1,
        owner: {run_id: '01m7cccccccccccccccccccccc', role: 'ended', title: 'Vanha haku', state: 'ended'}}, 'C'),
      wt('wt-otsikko', 'kotisivu', 'ws_kotisivu01', 'merged', gib(0.7), ['node_modules/'], {blockers: [], actions: ['remove']}, 'D'),
    ]),
  ],
});
const trash = () => ({
  schema_version: 1, state: 'listed', truncated: false,
  entries: scenario === 'normaali' ? [] : [
    {entry: 'vanha-demo', kind: 'workspace', name: 'vanha-demo', deleted_at: '2026-11-02T10:05:00Z', restore: 'available', conversations: 3, size_bytes: gib(3.9), size_complete: true},
    {entry: 'lokit', kind: 'directory', name: 'lokit', original_path: '~/lokit', deleted_at: '2026-11-10T08:30:00Z', restore: 'available', size_bytes: gib(0.3), size_complete: true},
  ],
});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(40);
  if (path === '/api/v1/account/storage') return json(host.shared
    ? {schema_version: 1, limits: 'not_in_use', filesystem: {capacity_bytes: host.bound, free_bytes: host.bound - host.used}}
    : {schema_version: 1, limits: 'enforced', usage_bytes: host.used, limit_bytes: host.bound});
  if (path === '/api/v1/workspaces' && init?.body) {
    const action = JSON.parse(String(init.body)).action;
    if (action === 'trash_list') return json(trash());
    if (action === 'worktree_list') return json(worktrees());
  }
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};

// ---- Placing the round's card where production's usage card is ----
function useSlot() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const slot = document.createElement('div');
    slot.className = 'rq-slot';
    const place = () => {
      const card = document.querySelector('[data-settings-row="usage"]')?.closest('.s-card');
      if (!card?.parentElement) return;
      if (slot.nextSibling !== card) card.parentElement.insertBefore(slot, card);
    };
    place();
    const o = new MutationObserver(place);
    o.observe(document.body, {childList: true, subtree: true});
    setEl(slot);
    return () => { o.disconnect(); slot.remove(); };
  }, []);
  return el;
}

// ---- Shared pieces ----
let openConversation: (items: Item[]) => void = () => {};

// ---- Words for items ----
const itemLabel = (i: Item) => t().items[i.label] ?? i.label;
const itemTag = (i: Item) => {
  const x = t();
  if (i.group === 'live') return x.runLive(i.run ?? '');
  if (i.group === 'finished') return i.merged ? x.merged : x.runEnded;
  if (i.group === 'own') return x.ownCheckout;
  return undefined;
};
const groupItems = (h: Host, g: Group) => h.breakdown?.items.filter((i) => i.group === g) ?? [];
const groupBytes = (h: Host, g: Group) => total(groupItems(h, g));
/** The groups a person can choose from, in the order of the list. */
const PICK: Group[] = ['caches', 'finished', 'own'];
const pickable = (h: Host) => PICK.flatMap((g) => groupItems(h, g));
const chosenItems = (h: Host) => pickable(h).filter((i) => selected.has(i.id));
const toggleItem = (id: string, on: boolean) => { const n = new Set(selected); if (on) n.add(id); else n.delete(id); setSelected(n); };
/** A group's state: all, some or none of its items selected. */
const groupState = (h: Host, g: Group) => {
  const list = groupItems(h, g);
  const n = list.filter((i) => selected.has(i.id)).length;
  return n === 0 ? 'none' : n === list.length ? 'all' : 'some';
};
/** Partly selected selects all; fully selected clears. */
const toggleGroup = (h: Host, g: Group) => {
  const all = groupState(h, g) === 'all';
  const n = new Set(selected);
  for (const i of groupItems(h, g)) { if (all) n.delete(i.id); else n.add(i.id); }
  setSelected(n);
};

/** The prepared request: what is listed, what is left alone. */
function requestText(h: Host, items: Item[]) {
  const x = t();
  return x.requestText({
    percent: percentOf(h), used: bytes(h.used), bound: bytes(h.bound), shared: h.shared, measured: !!h.breakdown,
    items: items.map((i) => ({label: itemLabel(i), path: i.path, size: bytes(i.bytes), clean: i.clean ? i.clean : x.cleanRm})),
    live: groupItems(h, 'live').map((i) => i.path),
  });
}

// ---- The preview: what the selection does to the whole ----
type Preview = {chosen: number; after: number; pctNow: number; pctAfter: number};
const preview = (h: Host): Preview => {
  const chosen = h.breakdown ? total(chosenItems(h)) : 0;
  const after = h.used - chosen;
  return {chosen, after, pctNow: percentOf(h), pctAfter: Math.floor((100 * after) / h.bound)};
};
/** The bar's parts, in order from the start: what stays, then what can go, the chosen part last. */
type Part = {key: string; bytes: number; group?: Group};
const parts = (h: Host): Part[] => {
  if (!h.breakdown) return [{key: 'kept', bytes: h.used}];
  const freeable = pickable(h);
  const chosen = total(chosenItems(h));
  const live = groupBytes(h, 'live');
  const trashB = groupBytes(h, 'trash');
  const kept = h.own - total(freeable) - live - trashB;
  return [
    ...(h.shared ? [{key: 'others', bytes: h.used - h.own}] : []),
    {key: 'kept', bytes: kept},
    {key: 'trash', bytes: trashB},
    {key: 'live', bytes: live},
    {key: 'freeable', bytes: total(freeable) - chosen},
    {key: 'chosen', bytes: chosen},
  ].filter((p) => p.bytes > 0);
};
const pctOf = (h: Host, n: number) => `${Math.min(100, (100 * n) / h.bound).toFixed(2)}%`;

function Warning() {
  const h = useHost();
  const x = t();
  const p = percentOf(h);
  if (p < NEAR) return null;
  const free = bytes(total(pickable(h).filter((i) => i.group !== 'own')));
  return (
    <WarningBannerView data-testid="storage-warning" tone="danger" icon="disk"
      title={h.shared ? x.warnTitleShared(p) : x.warnTitle(p)}
      actions={<ControlButton data-testid="warning-ask" size="row" variant="primary" onPress={() => openConversation(h.breakdown ? chosenItems(h) : [])}>{x.askAgent}</ControlButton>}>
      <p>{!h.breakdown ? x.warnBodyUnmeasured : h.shared ? x.warnBodyShared(free) : x.warnBody(free)}</p>
    </WarningBannerView>
  );
}

function Measured() {
  const h = useHost();
  const x = t();
  return (
    <p className="rq-measured s-desc" data-testid="measured">
      {h.measuring ? (
        <StatusMark kind="working" tone="info" label={h.breakdown ? x.measuring : x.measuringFirst} />
      ) : (
        <>
          <span>{x.measuredAt(x.today(h.breakdown?.measuredAt ?? ''))}</span>
          <ControlButton data-testid="remeasure" size="inline" variant="quiet" onPress={() => void remeasure()}><Icon name="refresh" />{x.remeasure}</ControlButton>
        </>
      )}
    </p>
  );
}

/** The 85 % line and the limit, laid over a bar. */
function Marks({at = `${NEAR}%`, label = true}: {at?: string; label?: boolean}) {
  const x = t();
  return (
    <span className="rq-warnline" style={{left: at}} data-testid="warn-line" aria-hidden="true">
      {label ? <span className="rq-warnline-label">{x.warnLine}</span> : null}
    </span>
  );
}

/** One verdict line: below the warning line after the selection, or still over. */
function Verdict({p}: {p: Preview}) {
  const x = t();
  const h = useHost();
  if (!h.breakdown) return null;
  if (!p.chosen) return <p className="s-desc rq-verdict" data-testid="verdict">{x.nothingChosen}</p>;
  const ok = p.pctAfter < NEAR;
  return <p className={`rq-verdict ${ok ? 'rq-verdict-ok' : 'rq-verdict-over'}`} data-testid="verdict" data-ok={ok || undefined}>
    <Icon name={ok ? 'check' : 'disk'} /> {ok ? x.belowWarn : x.stillOver}</p>;
}

/** "Näytä tarkemmin": the folders behind a group, each selectable. */
function Details({g}: {g: Group}) {
  const h = useHost();
  const x = t();
  const [open, setOpen] = useState(false);
  const list = groupItems(h, g);
  if (!list.length) return null;
  return (
    <div className="rq-details" data-details={g}>
      <ControlButton data-testid={`more-${g}`} size="inline" variant="quiet" aria-expanded={open} onPress={() => setOpen((o) => !o)}>
        <Icon name={open ? 'up' : 'down'} />{open ? x.less : x.more}
      </ControlButton>
      {open ? (
        <div className="rq-details-panel">
          <p className="s-desc">{x.detailsNote}</p>
          <ul className="rq-pick">
            {list.map((i) => {
              const tag = itemTag(i);
              return (
                <li key={i.id} data-item={i.id} data-group={i.group}>
                  {g === 'live'
                    ? <span className="rq-item-name">{itemLabel(i)}</span>
                    : <Checkbox data-testid={`pick-${i.id}`} label={itemLabel(i)} checked={selected.has(i.id)} onChange={(on) => toggleItem(i.id, on)} />}
                  {tag ? <span className={`rq-tag rq-tag-${i.group}`}>{tag}</span> : <span />}
                  <code className="rq-path">{i.path}</code>
                  <code className="rq-size">{bytes(i.bytes)}</code>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The checklist shared by B1 and B3: one plain-language row per group. */
function GroupList() {
  const h = useHost();
  const x = t();
  if (!h.breakdown) return null;
  return (
    <ul className="rq-glist" data-testid="group-list">
      {[...PICK, 'live' as Group].map((g) => {
        const list = groupItems(h, g);
        if (!list.length) return null;
        const state = g === 'live' ? 'none' : groupState(h, g);
        const chosen = total(list.filter((i) => selected.has(i.id)));
        return (
          <li key={g} data-group-row={g} data-state={state}>
            <div className="rq-grow">
              <span className={`ah-trash-swatch rq-sw-${g === 'live' ? 'live' : state === 'none' ? 'freeable' : 'chosen'}`} />
              <Checkbox data-testid={`group-${g}`} label={x.groups[g]} checked={state !== 'none'}
                hint={state === 'some' ? `${x.groupNotes[g]} (${x.partial(bytes(chosen), bytes(total(list)))})` : x.groupNotes[g]}
                onChange={() => toggleGroup(h, g)}
                availability={g === 'live' ? {state: 'disabled', reason: ''} : undefined} />
              <code className="rq-size">{bytes(total(list))}</code>
            </div>
            <Details g={g} />
          </li>
        );
      })}
      <TrashRow />
    </ul>
  );
}

function TrashRow() {
  const h = useHost();
  const x = t();
  const b = groupBytes(h, 'trash');
  if (!b) return null;
  return (
    <li data-group-row="trash" className="rq-trash-row">
      <div className="rq-grow">
        <span className="ah-trash-swatch rq-sw-trash" />
        <span className="rq-trash-name"><span>{x.groups.trash}</span><small className="s-desc">{x.groupNotes.trash}</small></span>
        <code className="rq-size">{bytes(b)}</code>
      </div>
      <ControlButton size="inline" variant="quiet" data-testid="trash-below"
        onPress={() => document.querySelector('[data-settings-row="trash"]')?.scrollIntoView({block: 'start'})}>{x.emptyTrashBelow}</ControlButton>
    </li>
  );
}

function Legend({keys}: {keys: string[]}) {
  const h = useHost();
  const x = t();
  const present = new Set(parts(h).map((p) => p.key));
  return (
    <ul className="ah-trash-legend rq-legend">
      {keys.filter((k) => present.has(k)).map((k) => (
        <li key={k}><span className={`ah-trash-swatch rq-sw-${k}`} /><span>{x.legend[k]}</span></li>
      ))}
    </ul>
  );
}

function AskRow() {
  const h = useHost();
  const x = t();
  const chosen = chosenItems(h);
  return (
    <div className="rq-actions">
      <Measured />
      <ControlButton data-testid="ask-agent" size="row" variant={percentOf(h) >= NEAR ? 'primary' : 'secondary'}
        isDisabled={!!h.breakdown && !chosen.length}
        onPress={() => openConversation(h.breakdown ? chosen : [])}>
        {h.breakdown ? x.askAgentSelected(bytes(total(chosen))) : x.askAgent}
      </ControlButton>
    </div>
  );
}

function Numbers({p}: {p: Preview}) {
  const h = useHost();
  const x = t();
  const line = h.shared ? x.diskOf : x.ofBound;
  return (
    <div className="rq-numbers" data-testid="numbers">
      <div><span className="s-desc">{x.now}</span><strong data-testid="now">{line(bytes(h.used), bytes(h.bound), p.pctNow)}</strong></div>
      {h.breakdown ? (
        <>
          <Icon name="forward" />
          <div data-testid="after-block"><span className="s-desc">{x.afterShort}</span>
            <strong data-testid="after" className={p.pctAfter < NEAR ? 'rq-ok-ink' : undefined}>{line(bytes(p.after), bytes(h.bound), p.pctAfter)}</strong></div>
          <span className="rq-frees" data-testid="frees">{x.freesUp(bytes(p.chosen))}</span>
        </>
      ) : null}
      {h.shared ? <span className="s-desc rq-share">{x.yourShare(bytes(h.own))}</span> : null}
    </div>
  );
}

// ---- B1: one large bar above the list, the selection highlighted in it ----
function VariantB1() {
  const h = useHost();
  const x = t();
  const p = preview(h);
  return (
    <div className="s-card rq-card" data-testid="breakdown" data-direction-card="b1">
      <section className="rq-freeable">
        <h3>{x.freeable}</h3>
        <Numbers p={p} />
        <div className="rq-bigbar-wrap">
          <span className="rq-bigbar" data-testid="usage-bar" role="img"
            aria-label={`${x.now} ${bytes(h.used)}, ${x.afterShort} ${bytes(p.after)} / ${bytes(h.bound)}`}>
            {parts(h).map((part) => <span key={part.key} data-part={part.key} className={`rq-sw-${part.key}`} style={{width: pctOf(h, part.bytes)}} />)}
          </span>
          <Marks />
          {h.breakdown && p.chosen ? <span className="rq-aftertick" style={{left: pctOf(h, p.after)}} data-testid="after-tick" aria-hidden="true" /> : null}
        </div>
        <Legend keys={['others', 'kept', 'trash', 'live', 'freeable', 'chosen']} />
        <Verdict p={p} />
        <GroupList />
        <AskRow />
      </section>
    </div>
  );
}

// ---- B2: the bar's parts are the checklist ----
/** Width per part: to scale, but every tappable part gets at least `min` %. */
function layout(list: {key: string; bytes: number; tap: boolean}[], bound: number, min: number) {
  const raw = list.map((s) => (100 * s.bytes) / bound);
  const grow = raw.map((r, i) => (list[i].tap ? Math.max(r, min) : r));
  const extra = grow.reduce((a, b) => a + b, 0) - raw.reduce((a, b) => a + b, 0);
  const shrinkable = raw.reduce((a, r, i) => a + (list[i].tap && r <= min ? 0 : r), 0);
  const k = shrinkable ? Math.max(0, (shrinkable - extra) / shrinkable) : 1;
  const w = grow.map((g, i) => (list[i].tap && raw[i] <= min ? g : g * k));
  return {w, enlarged: raw.some((r, i) => list[i].tap && r < min)};
}
/** Where a byte count falls on the laid-out bar (for the 85 % line). */
function position(list: {bytes: number}[], w: number[], bound: number, at: number) {
  let b = 0, x = 0;
  for (let i = 0; i < list.length; i++) {
    if (at <= b + list[i].bytes) return x + (w[i] * (at - b)) / list[i].bytes;
    b += list[i].bytes; x += w[i];
  }
  const restB = bound - b;
  return x + ((100 - x) * (at - b)) / (restB || 1);
}
function VariantB2() {
  const h = useHost();
  const x = t();
  const p = preview(h);
  const phone = useNarrow();
  const segs = h.breakdown ? [
    ...(h.shared ? [{key: 'others', bytes: h.used - h.own, tap: false}] : []),
    {key: 'kept', bytes: h.own - total(pickable(h)) - groupBytes(h, 'live'), tap: false},
    {key: 'live', bytes: groupBytes(h, 'live'), tap: false},
    ...PICK.map((g) => ({key: g, bytes: groupBytes(h, g), tap: true})),
  ].filter((s) => s.bytes > 0) : [{key: 'kept', bytes: h.used, tap: false}];
  const {w, enlarged} = layout(segs, h.bound, phone ? 19 : 12);
  const warnAt = position(segs, w, h.bound, h.bound * NEAR / 100);
  return (
    <div className="s-card rq-card" data-testid="breakdown" data-direction-card="b2">
      <section className="rq-freeable">
        <h3>{x.freeable}</h3>
        <Numbers p={p} />
        {h.breakdown ? <p className="s-desc rq-taphint">{x.tapHint}</p> : null}
        <div className="rq-bigbar-wrap rq-segbar-wrap">
          <div className="rq-segbar" data-testid="usage-bar" role="group" aria-label={x.freeable}>
            {segs.map((s, i) => {
              const g = s.key as Group;
              const state = s.tap ? groupState(h, g) : 'none';
              const style = {width: `${w[i].toFixed(2)}%`};
              const name = x.short[s.key] ?? x.legend[s.key];
              if (!s.tap) return (
                <span key={s.key} className={`rq-seg rq-seg-fixed rq-sw-${s.key}`} style={style} data-part={s.key} title={`${name} ${bytes(s.bytes)}`}>
                  {w[i] > (phone ? 19 : 10) ? <span className="rq-seg-label">{phone ? null : name}<small>{phone ? roundG(s.bytes) : bytes(s.bytes)}</small></span> : null}
                </span>
              );
              return (
                <button key={s.key} type="button" className={`rq-seg rq-seg-tap rq-sw-${state === 'none' ? 'freeable' : 'chosen'}`} style={style}
                  data-testid={`seg-${g}`} data-part={g} data-state={state} aria-pressed={state === 'all' ? true : state === 'some' ? 'mixed' : false}
                  aria-label={`${x.groups[g]}, ${bytes(s.bytes)}, ${state === 'none' ? x.segNot : x.segPressed}`}
                  onClick={() => toggleGroup(h, g)}>
                  <span className="rq-seg-label">{state !== 'none' ? <Icon name="check" /> : null}{phone ? null : x.short[g]}<small>{phone ? roundG(s.bytes) : bytes(s.bytes)}</small></span>
                </button>
              );
            })}
          </div>
          <Marks at={`${warnAt.toFixed(2)}%`} />
        </div>
        {enlarged && h.breakdown ? <p className="s-desc rq-enlarged">{x.enlarged}{phone ? ` ${x.phoneKey}` : ''}</p> : null}
        <Verdict p={p} />
        {h.breakdown ? (
          <ul className="rq-key" data-testid="group-list">
            {[...PICK, 'live' as Group].map((g) => {
              const list = groupItems(h, g);
              if (!list.length) return null;
              const state = g === 'live' ? 'none' : groupState(h, g);
              return (
                <li key={g} data-group-row={g} data-state={state}>
                  <div className="rq-grow">
                    <span className={`ah-trash-swatch rq-sw-${g === 'live' ? 'live' : state === 'none' ? 'freeable' : 'chosen'}`} />
                    <span className="rq-key-name"><span>{x.groups[g]}</span>
                      <small className="s-desc">{g === 'live' ? x.groupNotes.live : state === 'none' ? x.segNot : state === 'all' ? x.segPressed : x.partial(bytes(total(list.filter((i) => selected.has(i.id)))), bytes(total(list)))}</small></span>
                    <code className="rq-size">{bytes(total(list))}</code>
                  </div>
                  <Details g={g} />
                </li>
              );
            })}
            <TrashRow />
          </ul>
        ) : null}
        <AskRow />
      </section>
    </div>
  );
}
/** Phone bar parts are narrow: whole GiB, the exact size is in the key below. */
const roundG = (n: number) => `${Math.max(1, Math.round(n / G))} G`;
function useNarrow() {
  const q = '(max-width: 600px)';
  const [n, setN] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return n;
}

// ---- B3: a compact before/after summary that stays in view, then the list ----
function VariantB3() {
  const h = useHost();
  const x = t();
  const p = preview(h);
  const row = (label: string, used: number, pct: number, id: string, chosen = 0) => (
    <div className="rq-cmp-row" data-testid={`cmp-${id}`}>
      <span className="rq-cmp-label">{label}</span>
      <span className="rq-cmp-bar">
        <span className="rq-thinbar">
          <span className="rq-sw-kept" style={{width: pctOf(h, used - chosen)}} />
          {chosen ? <span className="rq-sw-chosen" style={{width: pctOf(h, chosen)}} /> : null}
        </span>
        <Marks label={false} />
      </span>
      <code className={`rq-cmp-num ${id === 'after' && pct < NEAR ? 'rq-ok-ink' : ''}`}>{bytes(used)} · {pct} %</code>
    </div>
  );
  return (
    <div className="s-card rq-card" data-testid="breakdown" data-direction-card="b3">
      <section className="rq-freeable">
        <div className="rq-cmp" data-testid="summary">
          <div className="rq-cmp-head">
            <h3>{x.freeable}</h3>
            {h.breakdown ? <strong className="rq-frees" data-testid="frees">{x.freesUp(bytes(p.chosen))}</strong> : null}
          </div>
          {row(x.now, h.used, p.pctNow, 'now', p.chosen)}
          {h.breakdown ? row(x.after, p.after, p.pctAfter, 'after') : null}
          <div className="rq-cmp-foot s-desc">
            <span><span className="rq-warnline-key" aria-hidden="true" /> {x.warnLine}</span>
            <span>{x.limit} {bytes(h.bound)}{h.shared ? ` · ${x.yourShare(bytes(h.own))}` : ''}</span>
          </div>
        </div>
        <Verdict p={p} />
        <GroupList />
        <AskRow />
      </section>
    </div>
  );
}

/** The new conversation, as a labelled stand-in: the request in the field. */
function ConversationStandIn({items, onClose, onSent}: {items: Item[] | null; onClose: () => void; onSent: (ws: string) => void}) {
  const x = t();
  const h = useHost();
  const [ws, setWs] = useState('aurinkokello');
  const [text, setText] = useState('');
  useEffect(() => { if (items) setText(requestText(h, items)); }, [items]);
  return (
    <ModalOverlay className="ah-overlay" isOpen={!!items} onOpenChange={(o) => { if (!o) onClose(); }} isDismissable>
      <Modal className="ah-modal rq-conv-modal">
        <Dialog className="ah-dialog rq-conv" data-testid="conversation-standin" aria-label={x.convTitle}>
          <Heading slot="title"><Icon name="message" /> {x.convTitle}</Heading>
          <p className="s-desc rq-standin-note">{x.standIn}</p>
          <Select label={x.convIn} value={ws} onChange={setWs}
            options={['aurinkokello', 'kotisivu', 'muistiinpanot'].map((v) => ({value: v, label: v}))} />
          <p className="s-desc">{x.convInNote}</p>
          <TextArea data-testid="request-text" label={x.request} value={text} onChange={setText} rows={12} />
          <div className="ah-dialog-actions">
            <ControlButton data-testid="conversation-cancel" size="row" onPress={onClose}>{x.cancel}</ControlButton>
            <ControlButton data-testid="conversation-send" size="row" variant="primary" onPress={() => onSent(ws)}>{x.send}</ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---- The page ----
function Round({direction, onToast}: {direction: number; onToast: (s: string) => void}) {
  const slot = useSlot();
  const [items, setItems] = useState<Item[] | null>(null);
  openConversation = (list) => setItems(list);
  return (
    <>
      {slot ? createPortal(
        <>
          <Warning />
          {direction === 0 ? <VariantB1 /> : direction === 1 ? <VariantB2 /> : <VariantB3 />}
        </>, slot) : null}
      <ConversationStandIn items={items} onClose={() => setItems(null)} onSent={(ws) => { setItems(null); onToast(t().sent(ws)); }} />
    </>
  );
}

function Page({direction, onToast}: {direction: number; onToast: (s: string) => void}) {
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
        <AccountSettings routeSection="tila" onNavigate={() => {}}
          profile={{name: 'Aino Esimerkki', email: '', avatar_url: ''}} csrf="prototype"
          nativeState="connected" nativeLogin="aino-esimerkki" onReconnect={() => {}}
          workspaces={[]} onClose={() => {}} />
      </div>
      <Round direction={direction} onToast={onToast} />
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
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 6000); return () => clearTimeout(id); }, [toast]);
  const restart = (next = s) => {
    scenario = next; host = SCENARIOS[next](); selected = new Set(freeableItems(host).map((i) => i.id));
    setS(next); setToast(''); setGeneration((g) => g + 1);
  };
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
          <MemoryRouter key={`${generation}-${s}-${language}`} initialEntries={['/settings/storage']}>
            <Page direction={direction} onToast={setToast} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {toast ? <p className="rq-toast" role="status" data-testid="rq-toast">{toast}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) {
  host = SCENARIOS[scenario](); selected = new Set(freeableItems(host).map((i) => i.id));
  flushSync(() => root.render(view === '' ? null : view));
}};
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
new Function('stage', 'variants', pickerSource)(stageSink, variants);
