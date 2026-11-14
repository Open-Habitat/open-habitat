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

// storage-warning-no-breakdown, round 1: Settings › Tallennustila, where
// the over-85 % warning leads. Axis: how the breakdown leads to clean-up.
// A splits production's usage bar into groups that open, B puts a freeable
// checklist first and builds the request from what is selected, C is one
// folder table sorted by size. The page around them is production's
// AccountSettings Storage section (Worktrees, Trash) unchanged over
// synthetic replies; the round's card replaces only its usage card. The new
// conversation is a labelled stand-in. Everything is synthetic.

const NAMES = ['A Pylväs', 'B Vapautettavissa', 'C Kansioittain'];
const A = 0, B = 1;
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
/** B's selection: by default everything regenerable that no worker uses. */
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

// ---- Words for items ----
const itemLabel = (i: Item) => t().items[i.label] ?? (i.group === 'trash' ? t().groups.trash : i.group === 'history' ? t().groups.history : i.group === 'other' ? t().groups.other : i.label);
const itemTag = (i: Item) => {
  const x = t();
  if (i.group === 'live') return x.runLive(i.run ?? '');
  if (i.group === 'finished') return i.merged ? x.merged : x.runEnded;
  if (i.group === 'own') return x.ownCheckout;
  return undefined;
};
const ORDER: Group[] = ['caches', 'finished', 'live', 'own', 'trash', 'workspaces', 'history', 'other'];
const groupBytes = (h: Host, g: Group) => total(h.breakdown?.items.filter((i) => i.group === g) ?? []);

/** The prepared request: what is listed, what is left alone. */
function requestText(h: Host, items: Item[]) {
  const x = t();
  return x.requestText({
    percent: percentOf(h), used: bytes(h.used), bound: bytes(h.bound), shared: h.shared, measured: !!h.breakdown,
    items: items.map((i) => ({label: itemLabel(i), path: i.path, size: bytes(i.bytes), clean: i.clean ? i.clean : x.cleanRm})),
    live: h.breakdown?.items.filter((i) => i.group === 'live').map((i) => i.path) ?? [],
  });
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

function Warning() {
  const h = useHost();
  const x = t();
  const p = percentOf(h);
  if (p < NEAR) return null;
  const free = bytes(total(freeableItems(h)));
  return (
    <WarningBannerView data-testid="storage-warning" tone="danger" icon="disk"
      title={h.shared ? x.warnTitleShared(p) : x.warnTitle(p)}
      actions={<ControlButton data-testid="warning-ask" size="row" variant="primary" onPress={() => openConversation(freeableItems(h))}>{x.askAgent}</ControlButton>}>
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
        <><StatusMark kind="working" tone="info" label={h.breakdown ? x.measuring : x.measuringFirst} /></>
      ) : (
        <>
          <span>{x.measuredAt(x.today(h.breakdown?.measuredAt ?? ''))}</span>
          <ControlButton data-testid="remeasure" size="inline" variant="quiet" onPress={() => void remeasure()}><Icon name="refresh" />{x.remeasure}</ControlButton>
        </>
      )}
    </p>
  );
}

/** Production's usage line, or on a shared disk the disk and the person's share. */
function UsageHead() {
  const h = useHost();
  const x = t();
  return h.shared ? (
    <div className="rq-head">
      <span>{x.sharedOf(bytes(h.used), bytes(h.bound), bytes(h.bound - h.used))}</span>
      <span className="s-desc">{x.yourShare(bytes(h.own))}</span>
    </div>
  ) : (
    <div className="rq-head"><span><strong>{bytes(h.used)}</strong> / {bytes(h.bound)}</span><span className="s-desc">{percentOf(h)} %</span></div>
  );
}

/** The usage bar, split into groups (production's ah-trash-bar). */
function Bar({split = true}: {split?: boolean}) {
  const h = useHost();
  const base = h.shared ? h.own : h.bound;
  const pct = (n: number) => `${Math.min(100, (100 * n) / base).toFixed(2)}%`;
  return (
    <span className="ah-trash-bar rq-bar-split" data-testid="usage-bar" role="img"
      aria-label={`${bytes(h.shared ? h.own : h.used)} / ${bytes(base)}`}>
      {split && h.breakdown
        ? ORDER.map((g) => <span key={g} className={`rq-g-${g}`} style={{width: pct(groupBytes(h, g))}} />)
        : <span className="other" style={{width: pct(h.shared ? h.own : h.used)}} />}
    </span>
  );
}

function ItemRow({i}: {i: Item}) {
  const tag = itemTag(i);
  return (
    <li data-item={i.id} data-group={i.group}>
      <span className="rq-item-name">{itemLabel(i)}{tag ? <span className={`rq-tag rq-tag-${i.group}`}>{tag}</span> : null}</span>
      <code className="rq-path">{i.path}</code>
      <code className="rq-size">{bytes(i.bytes)}</code>
    </li>
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

// ---- A: production's bar split into groups that open ----
function DirectionA() {
  const h = useHost();
  const x = t();
  const [open, setOpen] = useState<Set<Group>>(new Set(['caches']));
  const toggle = (g: Group) => setOpen((o) => { const n = new Set(o); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  return (
    <div className="s-card rq-card" data-testid="breakdown" data-direction-card="a">
      <section className="ah-trash-usage">
        <UsageHead />
        <Bar />
        <Measured />
        {h.breakdown ? (
          <ul className="rq-groups">
            {ORDER.filter((g) => groupBytes(h, g) > 0).map((g) => {
              const items = h.breakdown!.items.filter((i) => i.group === g);
              const many = items.length > 1;
              const isOpen = open.has(g);
              return (
                <li key={g} data-group-row={g} data-open={isOpen || undefined}>
                  <div className="rq-group-head">
                    <span className={`ah-trash-swatch rq-g-${g}`} />
                    <span className="rq-group-name">{x.groups[g]}</span>
                    <code className="rq-size">{bytes(groupBytes(h, g))}</code>
                    {many ? (
                      <ControlButton data-testid={`open-${g}`} size="inline" variant="quiet" presentation="icon"
                        aria-label={`${isOpen ? x.close : x.open}: ${x.groups[g]}`} aria-expanded={isOpen} onPress={() => toggle(g)}>
                        <Icon name={isOpen ? 'up' : 'down'} />
                      </ControlButton>
                    ) : <span />}
                  </div>
                  {isOpen && many ? (
                    <>
                      <p className="s-desc rq-group-note">{x.groupNotes[g]}</p>
                      <ul className="rq-items">{items.map((i) => <ItemRow key={i.id} i={i} />)}</ul>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="rq-actions">
          <ControlButton data-testid="ask-agent" size="row" variant={percentOf(h) >= NEAR ? 'primary' : 'secondary'} onPress={() => openConversation(freeableItems(h))}>{x.askAgent}</ControlButton>
        </div>
      </section>
    </div>
  );
}

// ---- B: what can go first, as a checklist ----
function DirectionB() {
  const h = useHost();
  const x = t();
  const items = h.breakdown?.items ?? [];
  const pickable = items.filter((i) => i.group === 'caches' || i.group === 'finished' || i.group === 'own');
  const chosen = pickable.filter((i) => selected.has(i.id));
  const freeable = total(freeableItems(h));
  const toggle = (id: string, on: boolean) => { const n = new Set(selected); if (on) n.add(id); else n.delete(id); setSelected(n); };
  const section = (g: Group) => {
    const list = items.filter((i) => i.group === g);
    if (!list.length) return null;
    return (
      <div className="rq-pick-group" data-pick-group={g}>
        <h4>{x.groups[g]} <code className="rq-size">{bytes(total(list))}</code></h4>
        <p className="s-desc">{x.groupNotes[g]}</p>
        <ul className="rq-pick">
          {list.map((i) => {
            const tag = itemTag(i);
            return (
              <li key={i.id} data-item={i.id} data-group={i.group}>
                <Checkbox data-testid={`pick-${i.id}`} label={itemLabel(i)} checked={g !== 'live' && selected.has(i.id)}
                  onChange={(on) => toggle(i.id, on)}
                  availability={g === 'live' ? {state: 'disabled', reason: tag ?? x.inUse} : undefined} />
                {tag && g !== 'live' ? <span className={`rq-tag rq-tag-${i.group}`}>{tag}</span> : <span />}
                <code className="rq-path">{i.path}</code>
                <code className="rq-size">{bytes(i.bytes)}</code>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };
  return (
    <>
      <div className="s-card rq-card" data-testid="breakdown" data-direction-card="b">
        <section className="rq-freeable">
          <div className="rq-freeable-head">
            <h3>{x.freeable}</h3>
            <strong className="rq-big" data-testid="freeable-total">{h.breakdown ? bytes(freeable) : '…'}</strong>
          </div>
          {h.breakdown ? <p className="s-desc">{x.freeableNow(bytes(freeable))}</p> : null}
          <Measured />
          {h.breakdown ? (
            <>
              {section('caches')}
              {section('finished')}
              {section('own')}
              {section('live')}
              {groupBytes(h, 'trash') ? (
                <div className="rq-pick-group rq-trash-line" data-pick-group="trash">
                  <h4>{x.groups.trash} <code className="rq-size">{bytes(groupBytes(h, 'trash'))}</code></h4>
                  <ControlButton size="inline" variant="quiet" onPress={() => document.querySelector('[data-settings-row="trash"]')?.scrollIntoView({block: 'start'})}>{x.emptyTrashBelow}</ControlButton>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="rq-actions">
            {h.breakdown ? (
              <span className="s-desc" data-testid="selected-total">{x.selected(bytes(total(chosen)), bytes(freeable))}</span>
            ) : <span />}
            <ControlButton data-testid="ask-agent" size="row" variant={percentOf(h) >= NEAR ? 'primary' : 'secondary'}
              isDisabled={!!h.breakdown && !chosen.length}
              onPress={() => openConversation(h.breakdown ? chosen : [])}>
              {h.breakdown ? x.askAgentSelected(bytes(total(chosen))) : x.askAgent}
            </ControlButton>
          </div>
        </section>
      </div>
      <div className="s-card rq-card" data-testid="rest-of-usage">
        <section className="ah-trash-usage">
          <h4 className="rq-rest-h">{x.restOfUsage}</h4>
          <UsageHead />
          <Bar />
          {h.breakdown ? (
            <ul className="ah-trash-legend">
              {ORDER.filter((g) => groupBytes(h, g) > 0).map((g) => (
                <li key={g}><span className={`ah-trash-swatch rq-g-${g}`} /><span>{x.groups[g]}</span><code>{bytes(groupBytes(h, g))}</code></li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </>
  );
}

// ---- C: one folder table, largest first ----
function DirectionC() {
  const h = useHost();
  const x = t();
  const [all, setAll] = useState(false);
  const kindOf = (i: Item) => (i.group === 'caches' ? 'cache' : i.group === 'workspaces' ? 'workspace' : i.group);
  const rows = [...(h.breakdown?.items ?? [])].sort((a, b) => b.bytes - a.bytes);
  const shown = all ? rows : rows.slice(0, 10);
  return (
    <div className="s-card rq-card" data-testid="breakdown" data-direction-card="c">
      <section className="ah-trash-usage">
        <UsageHead />
        <Bar split={false} />
        <div className="rq-actions rq-actions-top">
          <Measured />
          <ControlButton data-testid="ask-agent" size="row" variant={percentOf(h) >= NEAR ? 'primary' : 'secondary'} onPress={() => openConversation(freeableItems(h))}>{x.askAgent}</ControlButton>
        </div>
        {h.breakdown ? (
          <>
            <table className="rq-table" data-testid="folder-table">
              <thead><tr><th>{x.colPath}</th><th>{x.colKind}</th><th className="rq-num">{x.colSize}</th></tr></thead>
              <tbody>
                {shown.map((i) => {
                  const k = kindOf(i);
                  return (
                    <tr key={i.id} data-item={i.id} data-group={i.group}>
                      <td><code className="rq-path">{i.path}</code>{i.group === 'live' ? <span className="s-desc rq-run">{x.runLive(i.run ?? '')}</span> : null}</td>
                      <td><span className={`rq-kind rq-tag-${i.group}`}><span className={`ah-trash-swatch rq-g-${i.group}`} />{x.kinds[k]}</span></td>
                      <td className="rq-num"><code>{bytes(i.bytes)}</code></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 10 ? (
              <ControlButton data-testid="show-all" size="inline" variant="quiet" onPress={() => setAll((a) => !a)}>{all ? x.showFewer : x.showAll(rows.length)}</ControlButton>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
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
          {direction === A ? <DirectionA /> : direction === B ? <DirectionB /> : <DirectionC />}
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
