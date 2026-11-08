import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Menu, MenuTrigger, Popover} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {ControlButton, ControlMenuItem} from '../../../../web/src/components/ControlElements';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {ProcessProvider, useProcessView} from '../../../../web/src/components/ProcessTray';
import {BackgroundStrip, type WorkerAsk} from '../../../../web/src/components/BackgroundStrip';
import {SpinoffContext} from '../../../../web/src/components/Spinoffs';
import {ViewOfferCard, formatViewSize, type ViewSummary} from '../../../../web/src/components/ViewOffer';
import {CopyButton} from '../../../../web/src/components/ViewLink';
import {ViewSplit} from '../../../../web/src/components/ViewPanel';
import {FileOfferCard, fileFacts as itemFacts, formatOfferSize} from '../../../../web/src/components/FileOffer';
import type {FileKind, FileOfferItem, FileOfferSummary, OfferState} from '../../../../web/src/app/fileOffers';
import type {Spinoff} from '../../../../web/src/app/spinoffs';
import type {TimelineItem} from '../../../../web/src/components/types';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import '../../../../web/src/components/EditorSplit.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-conversation-assets, round 3. Jari 8.11.2026 chose round 2's 1 Oma
// siru: its own chip beside Workerit, the list opening above the strip. He
// often opens an item in a tab of its own, so this round riffs on how the
// person reaches an item's actions, in the chip's list and on the opened
// item. The item opens beside, in the right-hand panel (the offer cards'
// round 2 choice), and pressing the same row again closes it, so on the
// desktop the list stays open while an item is open beside. Icons and their
// order follow the offer cards' round 3 (proto-offer-cards-consistent):
// globe (public for 30 days), external (own tab), download; ⋯ for a menu.
// On the default view the CSV is open beside and the newest report's row is
// drawn hovered; a phone draws its touch state.
// A Kuvakkeet: under the pointer, small icons at the row's right end; on
//   touch always there; the panel's top bar has the same row;
// B Valikko: an own-tab arrow always on the row, ⋯ under the pointer holds
//   the rest; on touch ⋯ is always there; the top bar has ↗ and ⋯;
// C Paneeli: the row stays clean; actions only in the panel's top bar, and
//   a ⌘-, Ctrl- or middle-click on a row opens its own tab, as a link does.
const directions = ['A Kuvakkeet', 'B Valikko', 'C Paneeli'];
const LINES = [
  'A Kuvakkeet: hiiren alla rivin oikeaan päähän pienet kuvakkeet (julkinen, oma välilehti, lataus, keskustelussa); kosketuksella aina näkyvissä; paneelin yläpalkissa sama rivi.',
  'B Valikko: rivillä aina oma välilehti -nuoli, hiiren alla ⋯, jonka valikossa loput; kosketuksella ⋯ aina näkyvissä; paneelin yläpalkissa ↗ ja ⋯.',
  'C Paneeli: rivi pysyy puhtaana; toiminnot vain avatun kohteen yläpalkissa, ja ⌘- tai keskipainikkeen klikkaus rivillä avaa oman välilehden kuten linkki.',
];

// ---- The story: a quarterly report, six view offers, four file offers, two workers ----
const PARENT = 'Q3-myyntikatsaus johtoryhmälle';
const CONVO = 'pi:4d1f0b2a-8c3e-4f6a-9b71-2e5d7c9a0f13';
const today = (hm: string) => { const [h, m] = hm.split('.').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const hhmm = (iso: string) => { const d = new Date(iso); return `${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`; };

type Bar = [string, number];
function report(title: string, opts: {dark?: boolean; lead: string; bars: Bar[]; note?: string}) {
  const bg = opts.dark ? '#14171c' : '#fbfaf7', ink = opts.dark ? '#e7e9ee' : '#1d2026', soft = opts.dark ? '#9aa3b2' : '#5b6170', bar = opts.dark ? '#6aa7ff' : '#2f6fdb';
  const max = Math.max(...opts.bars.map((b) => b[1]));
  const rows = opts.bars.map(([k, v]) => `<div class=r><span>${k}</span><i style="width:${Math.round((v / max) * 100)}%"></i><b>${v.toLocaleString('fi-FI')}</b></div>`).join('');
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:28px 32px;background:${bg};color:${ink};font:15px/1.5 system-ui,sans-serif}h1{font-size:22px;margin:0 0 4px}p{color:${soft};margin:0 0 20px}.r{display:grid;grid-template-columns:120px 1fr 80px;align-items:center;gap:10px;margin:8px 0}.r i{display:block;height:14px;border-radius:3px;background:${bar}}.r b{text-align:right;font-weight:600}small{display:block;margin-top:22px;color:${soft}}</style><h1>${title}</h1><p>${opts.lead}</p>${rows}${opts.note ? `<small>${opts.note}</small>` : ''}`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
const MONTHS: Bar[] = [['Heinäkuu', 412000], ['Elokuu', 388500], ['Syyskuu', 455200]];
type View = ViewSummary & {src: string};
const view = (n: number, title: string, entry: string, at: string, src: string, files = 1, bytes = 48000): View =>
  ({view_id: `v${'abcdefghijklmnopqrstuvwxyz'.slice(n, n + 26).padEnd(26, 'q')}`, title, entry, files, bytes, created_at: today(at), conversation_id: CONVO, src});
const V1 = view(1, 'Myynnin kvartaalikatsaus', 'reports/kvartaali.html', '11.15',
  report('Myynnin kvartaalikatsaus Q3', {lead: 'Kuukausimyynti, euroa', bars: [['Heinäkuu', 412000], ['Elokuu', 388500], ['Syyskuu', 545200]]}));
const V2 = view(2, 'Asiakaskysely – yhteenveto', 'reports/kysely.html', '11.48',
  report('Asiakaskysely – yhteenveto', {lead: '212 vastausta · suositteluhalukkuus', bars: [['Suosittelisi', 128], ['Neutraali', 51], ['Ei suosittelisi', 33]]}));
const V3 = view(3, 'Tuotelinjojen vertailu', 'reports/tuotelinjat.html', '12.30',
  report('Tuotelinjojen vertailu Q3', {lead: 'Myynti tuotelinjoittain, euroa', bars: [['Perus', 604000], ['Pro', 451700], ['Palvelut', 200000]]}), 4, 182000);
const V4 = view(4, 'Myynnin kvartaalikatsaus – korjattu', 'reports/kvartaali.html', '12.55',
  report('Myynnin kvartaalikatsaus Q3', {lead: 'Kuukausimyynti, euroa', bars: MONTHS, note: 'Korjattu: syyskuun luku sisälsi lokakuun laskut.'}));
const V5 = view(5, 'Asiakaskysely – yhteenveto', 'reports/kysely.html', '13.20',
  report('Asiakaskysely – yhteenveto', {lead: '252 vastausta · suositteluhalukkuus', bars: [['Suosittelisi', 154], ['Neutraali', 60], ['Ei suosittelisi', 38]]}));
const V6 = view(6, 'Myynnin kvartaalikatsaus – tumma versio', 'reports/kvartaali.html', '13.42',
  report('Myynnin kvartaalikatsaus Q3', {dark: true, lead: 'Kuukausimyynti, euroa', bars: MONTHS, note: 'Näyttöversio johtoryhmän kokoukseen.'}));
const VIEWS = [V6, V5, V4, V3, V2, V1];

type Offer = {offer: FileOfferSummary; state: OfferState};
const offer = (n: number, title: string, at: string, items: FileOfferItem[], folder?: string): Offer => {
  const o: FileOfferSummary = {offer_id: `f${'bcdefghijklmnopqrstuvwxyz2'.slice(n, n + 26).padEnd(26, 'q')}`, title, folder, files: items.length,
    bytes: items.reduce((s, i) => s + i.bytes, 0), created_at: today(at), conversation_id: CONVO};
  return {offer: o, state: {state: 'ready', manifest: {offer: o, items}}};
};
const F1 = offer(1, 'Lähdeaineisto', '11.30', [
  {path: 'lahteet/README.md', bytes: 2100, kind: 'markdown', lines: 48},
  {path: 'lahteet/myynti-heinakuu.csv', bytes: 88400, kind: 'csv', lines: 612, columns: 9},
  {path: 'lahteet/myynti-elokuu.csv', bytes: 81200, kind: 'csv', lines: 571, columns: 9},
  {path: 'lahteet/myynti-syyskuu.csv', bytes: 95100, kind: 'csv', lines: 660, columns: 9},
  {path: 'lahteet/laskutus-q3.pdf', bytes: 412000, kind: 'pdf'},
], 'lahteet');
const F2 = offer(2, 'Kyselyn vastaukset', '12.05', [{path: 'kysely-vastaukset.xlsx', bytes: 64300, kind: 'xlsx'}]);
const F3 = offer(3, 'Myyntidata Q3', '12.40', [{path: 'myynti-q3.csv', bytes: 264700, kind: 'csv', lines: 1843, columns: 9}]);
const F4 = offer(4, 'Kvartaalikatsaus PDF:nä', '13.30', [{path: 'kvartaalikatsaus-q3.pdf', bytes: 238000, kind: 'pdf'}]);
const OFFERS = [F4, F3, F2, F1];
const FILE_COUNT = OFFERS.reduce((n, o) => n + o.offer.files, 0);
const itemsOf = (o: Offer) => (o.state.state === 'ready' ? o.state.manifest.items : []);

// Two workers the agent started at the end: production's strip lists them.
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const run = (id: string, title: string, min: number): Spinoff => ({
  run_id: `01m6ac${id}`.padEnd(26, '0'), title, created_at: ago(min), state: 'working', preserved: false,
  branch: `wt/${title}`, worktree: `/home/maintainer/src/myynti__worktrees/wt-${title}`, source_branch: 'main', summary: '', harness: 'pi', profile: 'nopea',
});
const RUNS: Spinoff[] = [run('w1', 'pdf-luvut-tarkistus', 4), run('w2', 'kysely-avoimet-luokittelu', 3)];
const ask: WorkerAsk = {phases: {}, target: 'here', send: () => {}};

// The offered files' content; every other request 404s.
const CSV_ROWS = [
  ['pvm', 'asiakas', 'tuote', 'määrä', 'euroa'],
  ['2026-09-01', 'Kesko', 'Pro', '12', '4 800'],
  ['2026-09-01', 'Fiskars', 'Perus', '40', '6 000'],
  ['2026-09-02', 'Valio', 'Palvelut', '1', '12 500'],
  ['2026-09-03', 'Kesko', 'Perus', '25', '3 750'],
  ['2026-09-04', 'Marimekko', 'Pro', '6', '2 400'],
  ['2026-09-05', 'Fazer', 'Palvelut', '2', '18 000'],
];
const CSV = CSV_ROWS.map((r) => r.join(';')).join('\n') + '\n';
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path.endsWith('/processes'))
    return new Response(JSON.stringify({schema_version: 1, owner_generation: 'og', availability: 'available', unavailable_reason: null, processes: [], interrupted: []}), {headers: {'content-type': 'application/json'}});
  if (path.includes('/file-offers/') && path.includes('/download/')) {
    const md = path.endsWith('.md');
    return new Response(md ? '# Lähdeaineisto\n\nKuukausittaiset myyntiraportit laskutusjärjestelmästä, ajettu 7.11.2026.\n' : CSV, {headers: {'content-type': md ? 'text/markdown' : 'text/csv'}});
  }
  return new Response('', {status: 404});
};

// ---- The list's entries: one per report (versions of one entry folded) and one per file offer ----
type Entry =
  | {kind: 'view'; key: string; at: string; versions: View[]}
  | {kind: 'file'; key: string; at: string; offer: Offer};
function entries(): Entry[] {
  const byEntry = new Map<string, View[]>();
  for (const v of VIEWS) byEntry.set(v.entry, [...(byEntry.get(v.entry) ?? []), v]);
  const list: Entry[] = [
    ...[...byEntry.values()].map((versions) => ({kind: 'view' as const, key: versions[0].view_id, at: versions[0].created_at, versions})),
    ...OFFERS.map((o) => ({kind: 'file' as const, key: o.offer.offer_id, at: o.offer.created_at, offer: o})),
  ];
  return list.sort((a, b) => b.at.localeCompare(a.at));
}
const ENTRIES = entries();
const REPORTS = ENTRIES.filter((e) => e.kind === 'view').length;

const kindIcon: Record<FileKind, IconName> = {image: 'image', svg: 'image', video: 'film', audio: 'music', markdown: 'file', pdf: 'file',
  docx: 'file', pptx: 'file', xlsx: 'table', csv: 'table', code: 'code', text: 'file', zip: 'package', file: 'file'};
const ext = (p: string) => (/\.([^./]{1,12})$/.exec(p)?.[1] ?? '').toUpperCase();
const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1);

function ViewMark({size}: {size?: 's'}) { return <span className={`ac-mark ac-mark-view${size ? ` ac-mark-${size}` : ''}`} aria-hidden="true">{'</>'}</span>; }
function FileMark({o, size}: {o: Offer; size?: 's'}) {
  const items = itemsOf(o);
  const icon: IconName = items.length === 1 ? kindIcon[items[0].kind] : o.offer.folder ? 'folder' : 'file';
  return <span className={`ac-mark ac-mark-file${size ? ` ac-mark-${size}` : ''}`} aria-hidden="true"><Icon name={icon} /></span>;
}
function fileFacts(o: Offer) {
  const items = itemsOf(o);
  if (items.length === 1) return `${ext(items[0].path)} · ${formatOfferSize(items[0].bytes)}`;
  return `${o.offer.folder ? `${o.offer.folder}/ · ` : ''}${o.offer.files} tiedostoa · ${formatOfferSize(o.offer.bytes)}`;
}


// ---- Who sees it: one public state per item, as the offer cards' round 3 ----
const inDays = (n: number) => new Date(Date.now() + n * 86400000);
const dayLabel = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
type Pub = {until: (id: string) => Date | null; set: (id: string, until: Date | null) => void};
const PubContext = React.createContext<Pub>({until: () => null, set: () => {}});
const usePub = () => React.useContext(PubContext);

// ---- An item: a view version or a file offer (and a file inside a folder offer) ----
type Item = {kind: 'view'; view: View} | {kind: 'file'; offer: Offer; sub?: string};
const itemId = (i: Item) => (i.kind === 'view' ? i.view.view_id : i.offer.offer.offer_id);
const itemTitle = (i: Item) => (i.kind === 'view' ? i.view.title : i.sub ? baseName(i.sub) : i.offer.offer.title);
const isFolder = (i: Item) => i.kind === 'file' && !i.sub && itemsOf(i.offer).length > 1;
// The item's one stable address, the same its own tab opens and a public link shares.
const entryOf = (i: Item) => `${itemId(i).slice(1, 7)}Kq2mRt${itemId(i).slice(7, 13)}`;
const addressOf = (i: Item) => `https://alder.example/n/${entryOf(i)}${i.kind === 'file' && i.sub ? `/${baseName(i.sub)}` : ''}`;
const downloadLabel = (i: Item) => (isFolder(i) ? 'Lataa kaikki (.zip)' : i.kind === 'view' ? 'Lataa (.zip)' : 'Lataa');
const fileName = (i: Item) => (i.kind === 'view' ? `${i.view.title}.zip` : isFolder(i) ? `${i.offer.offer.folder}.zip` : baseName(i.sub ?? itemsOf(i.offer)[0].path));

type Act = {
  d: number;
  touch: boolean;
  openedId?: string;
  hoverId?: string;
  toggle: (i: Item) => void;
  tab: (i: Item) => void;
  download: (i: Item) => void;
  locate: (id: string) => void;
};

/** Who sees it, as a mark: a lock for the person only, a globe and its date while public. */
function Seen({until, words = true}: {until: Date | null; words?: boolean}) {
  const label = until ? `Julkinen ${dayLabel(until)} asti` : 'Vain sinulle';
  return (
    <span className="ac-seen" data-public={until ? 'true' : undefined} title={label} aria-label={words ? undefined : label}>
      <Icon name={until ? 'globe' : 'lock'} />{words ? <span>{label}</span> : null}
    </span>
  );
}

const ib = (testid: string, label: string, icon: IconName, onPress: () => void, extra?: Record<string, unknown>) => (
  <ControlButton size="row" variant="quiet" className="ac-ib" data-testid={testid} aria-label={label} title={label} onPress={onPress} {...extra}>
    <Icon name={icon} />
  </ControlButton>
);

/** A: the icons in the offer cards' order, then the way back to the card.
 * The globe publishes for 30 days at once; while public, Kopioi linkki follows it. */
function IconRow({i, act, label}: {i: Item; act: Act; label?: string}) {
  const p = usePub(), until = p.until(itemId(i));
  const of = label ? `: ${label}` : '';
  return (
    <span className="ac-icons" data-testid="ac-acts">
      {ib('ac-act-public', `${until ? `Julkinen ${dayLabel(until)} asti. Paina, niin vain sinä näet tämän` : 'Vain sinulle. Paina, niin se on julkinen 30 päivää'}${of}`, 'globe',
        () => p.set(itemId(i), until ? null : inDays(30)), {'data-public': until ? 'true' : undefined, 'aria-pressed': !!until})}
      {until ? <CopyButton text={addressOf(i)} data-testid="ac-act-copy" iconOnly /> : null}
      {isFolder(i) ? null : ib('ac-act-tab', `Avaa omalle välilehdelle${of}`, 'external', () => act.tab(i))}
      {ib('ac-act-download', `${downloadLabel(i)}${of}`, 'download', () => act.download(i))}
      {ib('ac-act-locate', `Näytä keskustelussa${of}`, 'message', () => act.locate(itemId(i)))}
    </span>
  );
}

/** B: ⋯ holds what is not the own tab: publishing, the link while public, download, the card. */
function MoreMenu({i, act, label}: {i: Item; act: Act; label?: string}) {
  const p = usePub(), until = p.until(itemId(i));
  return (
    <MenuTrigger>
      <ControlButton size="row" variant="quiet" className="ac-ib ac-more" data-testid="ac-more" aria-label={`Lisää${label ? `: ${label}` : ''}`} title="Lisää">
        <Icon name="more" />
      </ControlButton>
      <Popover placement="bottom end" className="ah-popover ac-more-pop ac-keep">
        <Menu aria-label={`Toiminnot: ${itemTitle(i)}`} data-testid="ac-more-menu"
          onAction={(k) => {
            if (k === 'public') p.set(itemId(i), until ? null : inDays(30));
            else if (k === 'copy') void navigator.clipboard?.writeText(addressOf(i)).catch(() => {});
            else if (k === 'download') act.download(i);
            else if (k === 'locate') act.locate(itemId(i));
          }}>
          <ControlMenuItem id="public" data-testid="ac-act-public" textValue={until ? 'Lopeta julkisuus' : 'Julkinen 30 päivää'}>
            <span className="ac-mi"><Icon name="globe" />{until ? `Lopeta julkisuus (${dayLabel(until)} asti)` : 'Julkinen 30 päivää'}</span>
          </ControlMenuItem>
          {until ? <ControlMenuItem id="copy" data-testid="ac-act-copy" textValue="Kopioi linkki"><span className="ac-mi"><Icon name="copy" />Kopioi linkki</span></ControlMenuItem> : null}
          <ControlMenuItem id="download" data-testid="ac-act-download" textValue={downloadLabel(i)}><span className="ac-mi"><Icon name="download" />{downloadLabel(i)}</span></ControlMenuItem>
          <ControlMenuItem id="locate" data-testid="ac-act-locate" textValue="Näytä keskustelussa"><span className="ac-mi"><Icon name="message" />Näytä keskustelussa</span></ControlMenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
function TabArrow({i, act, label}: {i: Item; act: Act; label?: string}) {
  return isFolder(i) ? <span className="ac-ib-gap" aria-hidden="true" /> : ib('ac-act-tab', `Avaa omalle välilehdelle${label ? `: ${label}` : ''}`, 'external', () => act.tab(i));
}

/** The row's own actions, per riff. C has none: only a hint under the pointer. */
function RowActs({i, act}: {i: Item; act: Act}) {
  const label = itemTitle(i);
  if (act.d === 0) return <IconRow i={i} act={act} label={label} />;
  if (act.d === 1) return <span className="ac-menu-acts" data-testid="ac-acts"><MoreMenu i={i} act={act} label={label} /><TabArrow i={i} act={act} label={label} /></span>;
  return act.touch || isFolder(i) ? null : <span className="ac-hint" aria-hidden="true" data-testid="ac-hint"><kbd>⌘</kbd><Icon name="external" /></span>;
}

/** A row is a link to the item's own address: a plain press opens it beside
 * (or closes it when it is the open one); ⌘, Ctrl, Shift or the middle button
 * leave it to the browser, which opens a tab. Here the tab is drawn. */
function RowLink({i, act, className, children, testid}: {i: Item; act: Act; className: string; children: React.ReactNode; testid: string}) {
  const open = act.openedId === itemId(i);
  const toTab = (e: React.MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1;
  return (
    <a href={addressOf(i)} className={className} data-testid={testid} aria-expanded={open}
      title={open ? 'Sulje paneeli' : act.d === 2 && !act.touch ? 'Avaa viereen · ⌘-klikkaus tai keskipainike: omalle välilehdelle' : 'Avaa viereen'}
      onClick={(e) => { e.preventDefault(); if (toTab(e)) act.tab(i); else act.toggle(i); }}
      onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); act.tab(i); } }}>
      {children}
    </a>
  );
}

/** One list row (rounds 1 and 2): the newest version or the file offer, its
 * time and the riff's actions. Versions unfold under it with the same actions. */
function EntryRow({e, act}: {e: Entry; act: Act}) {
  const [unfolded, setUnfolded] = useState(false);
  const pub = usePub();
  const flag = (id: string) => ({'data-open': act.openedId === id || undefined, 'data-hover': act.hoverId === id || undefined});
  const seen = (id: string) => (pub.until(id) ? <Seen until={pub.until(id)} words={false} /> : null);
  if (e.kind === 'file') {
    const o = e.offer, i: Item = {kind: 'file', offer: o}, id = o.offer.offer_id;
    return (
      <li className="ac-entry" data-testid="ac-entry" data-kind="file" data-id={id}>
        <div className="ac-line-row" {...flag(id)}>
          <RowLink i={i} act={act} className="ac-row" testid="ac-open">
            <FileMark o={o} />
            <span className="ac-text">
              <span className="ac-title">{o.offer.title}</span>
              <span className="ac-meta">{seen(id)}{fileFacts(o)}<span className="ac-meta-time"> · {hhmm(o.offer.created_at)}</span></span>
            </span>
            <span className="ac-time">{hhmm(o.offer.created_at)}</span>
          </RowLink>
          <RowActs i={i} act={act} />
        </div>
      </li>
    );
  }
  const [newest, ...older] = e.versions;
  const i: Item = {kind: 'view', view: newest};
  return (
    <li className="ac-entry" data-testid="ac-entry" data-kind="view" data-id={newest.view_id}>
      <div className="ac-line-row" {...flag(newest.view_id)}>
        <RowLink i={i} act={act} className="ac-row" testid="ac-open">
          <ViewMark />
          <span className="ac-text">
            <span className="ac-title">{newest.title}</span>
            <span className="ac-meta">{seen(newest.view_id)}{newest.entry}<span className="ac-meta-time"> · {hhmm(newest.created_at)}</span></span>
          </span>
          <span className="ac-time">{hhmm(newest.created_at)}</span>
        </RowLink>
        <RowActs i={i} act={act} />
      </div>
      {older.length ? (
        <button type="button" className="ac-versions-toggle" data-testid="ac-versions" aria-expanded={unfolded}
          title={unfolded ? 'Piilota aiemmat versiot' : 'Näytä aiemmat versiot'} onClick={() => setUnfolded(!unfolded)}>
          <span className="ac-versions-stack" aria-hidden="true" />
          {`${e.versions.length} versiota`}
          <Icon name={unfolded ? 'up' : 'down'} className="ac-chev" />
        </button>
      ) : null}
      {unfolded ? (
        <ul className="ac-older" data-testid="ac-older">
          {older.map((v, n) => (
            <li key={v.view_id}>
              <div className="ac-line-row" {...flag(v.view_id)}>
                <RowLink i={{kind: 'view', view: v}} act={act} className="ac-row ac-row-older" testid="ac-open-older">
                  <span className="ac-version-n">{older.length - n}</span>
                  <span className="ac-text"><span className="ac-title">{v.title}</span></span>
                  <span className="ac-time">{hhmm(v.created_at)}</span>
                </RowLink>
                <RowActs i={{kind: 'view', view: v}} act={act} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Both counts: views by their mark, file offers by production's file icon. */
function Counts() {
  return (
    <span className="ac-counts">
      <span className="ac-count-view" aria-hidden="true">{'</>'}</span><span className="ac-n">{REPORTS}</span>
      <Icon name="file" className="ah-bg-kind-ic" /><span className="ac-n">{OFFERS.length}</span>
    </span>
  );
}
const countLabel = `Näkymät ${REPORTS}, tiedostot ${OFFERS.length}`;

// ---- The opened item: the offer card's place, the same for every kind ----
function ItemBody({item, onSub}: {item: Item; onSub: (p: string) => void}) {
  if (item.kind === 'view') return <iframe className="ac-frame" title={item.view.title} src={item.view.src} sandbox="" />;
  const items = itemsOf(item.offer);
  const one = item.sub ? items.find((i) => i.path === item.sub) : items.length === 1 ? items[0] : undefined;
  if (!one)
    return (
      <ul className="ac-folder" data-testid="ac-folder">
        {items.map((i) => (
          <li key={i.path}>
            <button type="button" data-testid="ac-folder-row" onClick={() => onSub(i.path)}>
              <span className="ac-mark ac-mark-file" aria-hidden="true"><Icon name={kindIcon[i.kind]} /></span>
              <span className="ac-text"><span className="ac-title">{baseName(i.path)}</span><span className="ac-meta">{itemFacts(i).join(' · ')}</span></span>
            </button>
          </li>
        ))}
      </ul>
    );
  if (one.kind === 'csv' || one.kind === 'xlsx')
    return (
      <div className="ac-table-wrap">
        <table className="ac-table" data-testid="ac-table">
          <thead><tr>{CSV_ROWS[0].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{CSV_ROWS.slice(1).map((r) => <tr key={r.join()}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
        </table>
        <p className="ac-note">6 ensimmäistä riviä{one.lines ? ` ${one.lines.toLocaleString('fi-FI')}:sta` : ''}</p>
      </div>
    );
  if (one.kind === 'markdown')
    return <div className="ac-md"><Markdown text={'# Lähdeaineisto\n\nKuukausittaiset myyntiraportit laskutusjärjestelmästä, ajettu 7.11.2026. Jokaisessa CSV:ssä on yksi rivi laskua kohden.'} /></div>;
  return (
    <div className="ac-doc" data-testid="ac-doc">
      <article className="ac-page">
        <h1>Myynnin kvartaalikatsaus Q3</h1>
        <p className="ac-sub">Johtoryhmälle · 4 sivua</p>
        <h2>Yhteenveto</h2>
        <p>Kolmannen kvartaalin myynti oli 1,26 miljoonaa euroa, 8 % edellistä kvartaalia enemmän. Syyskuun luku on korjattu: siihen oli osunut 90 000 euroa lokakuun laskuja.</p>
        <h2>Kuukausittain</h2>
        <p>Heinäkuu 412 000 €, elokuu 388 500 €, syyskuu 455 200 €.</p>
      </article>
    </div>
  );
}

function itemFactsLine(item: Item) {
  if (item.kind === 'view') return ['Näkymä', ...(item.view.files > 1 ? [`${item.view.files} tiedostoa`] : []), formatViewSize(item.view.bytes), hhmm(item.view.created_at)];
  if (item.sub) return itemFacts(itemsOf(item.offer).find((i) => i.path === item.sub)!);
  return [fileFacts(item.offer), hhmm(item.offer.offer.created_at)];
}

/** The right-hand panel. Its top bar carries the riff's actions; A and C the
 * whole icon row, B the own-tab arrow and the same ⋯ as the row. */
function ItemPanel({item, act, onSub, onClose}: {item: Item; act: Act; onSub: (p?: string) => void; onClose: () => void}) {
  const until = usePub().until(itemId(item));
  const title = itemTitle(item);
  return (
    <section className="ah-view-pane ac-item ac-keep" data-testid="ac-item" data-kind={item.kind} aria-label={title}>
      {item.kind === 'file' && item.sub ? (
        <button type="button" className="ac-back" data-testid="ac-item-up" onClick={() => onSub(undefined)}><Icon name="back" /> {item.offer.offer.folder}/</button>
      ) : null}
      <header className="ac-item-head">
        {item.kind === 'view' ? <ViewMark size="s" /> : <FileMark o={item.offer} size="s" />}
        <span className="ac-item-title">
          <h2 className="ah-view-title" data-testid="ac-item-title">{title}</h2>
          <span className="ac-meta">{itemFactsLine(item).join(' · ')} · <Seen until={until} /></span>
        </span>
        <span className="ac-item-tools" data-testid="ac-item-tools">
          {act.d === 1 ? <><TabArrow i={item} act={act} /><MoreMenu i={item} act={act} /></> : <IconRow i={item} act={act} />}
          {ib('ac-item-close', 'Sulje', 'cross', onClose)}
        </span>
      </header>
      <div className="ac-item-body"><ItemBody item={item} onSub={(p) => onSub(p)} /></div>
    </section>
  );
}

/** Avaa omalle välilehdelle: the item's stable address in a tab of its own.
 * The browser chrome is drawn; the page under it is what the host shows there. */
function TabMock({item, onClose}: {item: Item; onClose: () => void}) {
  const until = usePub().until(itemId(item));
  return (
    <div className="ac-tabmock ac-keep" data-testid="ac-tab" role="region" aria-label="Uusi välilehti (kuvitettu)">
      <div className="ac-tabmock-strip">
        <button type="button" className="ac-tabmock-tab" data-testid="ac-tab-back" onClick={onClose}>{PARENT} – Open Habitat</button>
        <span className="ac-tabmock-tab" data-active="true">
          {item.kind === 'view' ? <ViewMark size="s" /> : <FileMark o={item.offer} size="s" />}<span className="ac-title">{itemTitle(item)}</span>
          <button type="button" className="ac-tabmock-x" data-testid="ac-tab-close" aria-label="Sulje välilehti" onClick={onClose}><Icon name="cross" /></button>
        </span>
      </div>
      <div className="ac-tabmock-address"><Icon name="lock" /><span>{addressOf(item).replace('https://', '')}</span></div>
      <div className="ac-tabpage">
        <header className="ac-tabpage-head">
          <span className="ac-item-title">
            <h1 className="ah-view-title">{itemTitle(item)}</h1>
            <span className="ac-meta">{itemFactsLine(item).join(' · ')} · <Seen until={until} /></span>
          </span>
        </header>
        <div className="ac-tabpage-body"><ItemBody item={item} onSub={() => {}} /></div>
      </div>
    </div>
  );
}

// ---- The strip by the message field: production's strip and the assets chip ----
const noop = () => {};
const spinoffs = {data: {schema_version: 1 as const, parent_id: CONVO, availability: 'available' as const, runs: RUNS, transcripts: []}, open: noop};

/** Closes on a press outside the strip, the opened item, its menus and its
 * tab, and on Escape, as the strip's own panel does. */
function useDismiss(open: boolean, close: () => void, inside: React.RefObject<HTMLElement | null>) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!inside.current?.contains(t) && !t.closest?.('.ac-keep')) ref.current();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.ac-more-pop, .ac-tabmock')) ref.current(); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open, inside]);
}

function AssetsStrip({act, open, setOpen, onHoverEnd}: {act: Act; open: boolean; setOpen: (v: boolean) => void; onHoverEnd: () => void}) {
  const view = useProcessView();
  const line = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), line);
  // One floating panel at a time: the workers' panel closes the list and back.
  useEffect(() => { if (view?.panel) setOpen(false); }, [view?.panel, setOpen]);
  const toggle = () => { const on = !open; if (on) view?.setPanel(null); setOpen(on); };
  return (
    <section className="ah-bg-strip ac-strip">
      <div className="ac-line" ref={line}>
        <SpinoffContext.Provider value={spinoffs}><BackgroundStrip agentIdle ask={ask} /></SpinoffContext.Provider>
        <ControlButton data-testid="ac-chip" size="inline" presentation="pill" className="ah-bg-badge ac-chip" aria-expanded={open}
          aria-label={countLabel} title="Keskustelun näkymät ja tiedostot" onPress={toggle}>
          <Counts />
        </ControlButton>
        {open ? (
          <div className="ah-bg-pop ac-pop" role="dialog" aria-label="Keskustelun näkymät ja tiedostot" data-testid="ac-pop"
            data-riff={'abc'[act.d]} data-touch={act.touch || undefined} onPointerOver={(e) => { if (e.pointerType === 'mouse') onHoverEnd(); }}>
            <div className="ah-bg-tabs ac-pop-head">
              <span className="ac-pop-title"><span className="ac-count-view" aria-hidden="true">{'</>'}</span> Näkymät ja tiedostot <span className="ah-bg-tab-n">{ENTRIES.length}</span></span>
              <ControlButton className="ah-bg-x" size="inline" variant="quiet" aria-label="Sulje" data-testid="ac-pop-close" onPress={() => setOpen(false)}><Icon name="cross" /></ControlButton>
            </div>
            <div className="ah-bg-pop-body">
              <ul className="ac-list" data-testid="ac-list">{ENTRIES.map((e) => <EntryRow key={e.key} e={e} act={act} />)}</ul>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ---- The conversation ----
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'myynti',
};
const picker = <button type="button" className="md-pill">Claude Opus 5.5 · high</button>;
const userItem = (id: string, text: string, time: string): TimelineItem & {kind: string} => ({id, kind: 'user', content: <UserMessage sourceText={text} onCopy={noop} time={time}><Markdown text={text} /></UserMessage>});
const agentItem = (id: string, text: string, time: string): TimelineItem & {kind: string} =>
  ({id, kind: 'assistant', content: <AssistantMessage streamState="complete" time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>});

const PHONE = 800;
// The default view: on the desktop the list is open, the CSV is open beside
// and the newest report's row is drawn hovered; a phone opens the list only.
const OPEN_FIRST: Item = {kind: 'file', offer: F3};

function Main({direction: d}: {direction: number}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLElement>(null);
  const phone = innerWidth <= PHONE;
  const touch = phone || matchMedia('(hover: none)').matches;
  const [listOpen, setListOpen] = useState(true);
  const [item, setItem] = useState<Item | undefined>(phone ? undefined : OPEN_FIRST);
  const [hoverId, setHoverId] = useState<string | undefined>(touch ? undefined : V6.view_id);
  const [tab, setTab] = useState<Item>();
  const [toast, setToast] = useState<string>();
  const [pub, setPub] = useState<Record<string, Date | null>>({});
  const [width, setWidth] = useState(() => Math.round(Math.max(innerWidth - 300, 0) * 0.46));
  const found = useRef<number>(undefined);
  const locate = (id: string) => {
    setListOpen(false);
    if (phone) setItem(undefined);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const card = stream.current?.querySelector<HTMLElement>(`[data-view-id="${id}"], [data-offer-id="${id}"]`);
      if (!card) return;
      stream.current?.querySelectorAll('.ac-found').forEach((el) => el.classList.remove('ac-found'));
      card.scrollIntoView({block: 'center'});
      card.classList.add('ac-found');
      clearTimeout(found.current);
      found.current = window.setTimeout(() => card.classList.remove('ac-found'), 2400);
    }));
  };
  const openedId = item ? itemId(item) : undefined;
  const act: Act = {
    d, touch, openedId, hoverId,
    // The same row again closes; on a phone the panel covers the list, so it closes.
    toggle: (i) => { setItem(openedId === itemId(i) ? undefined : i); if (phone) setListOpen(false); },
    tab: (i) => setTab(i.kind === 'file' && item?.kind === 'file' && itemId(item) === itemId(i) ? item : i),
    download: (i) => setToast(`Ladataan ${fileName(i)}`),
    locate,
  };
  const pubValue: Pub = {until: (id) => pub[id] ?? null, set: (id, until) => setPub((p) => ({...p, [id]: until}))};
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(undefined), 2400); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!tab) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setTab(undefined); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [tab]);
  useLayoutEffect(() => {
    const el = stream.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const viewCard = (v: View) => ({id: v.view_id, kind: 'notice', content: (
    <ViewOfferCard view={v} state={openedId === v.view_id ? 'open' : 'idle'} onOpen={() => act.toggle({kind: 'view', view: v})} onOpenTab={() => act.tab({kind: 'view', view: v})} />
  )});
  const fileCard = (o: Offer) => ({id: o.offer.offer_id, kind: 'notice', content: (
    <FileOfferCard offer={o.offer} state={o.state} onShowFiles={() => act.toggle({kind: 'file', offer: o})} />
  )});
  const items = [
    userItem('u1', 'Tee Q3-myynnistä katsaus, jonka voin näyttää johtoryhmälle. Data on kansiossa `data/myynti`.', '11.10'),
    agentItem('a1', 'Kokosin katsauksen kolmen kuukauden laskutusraporteista. Kuukausimyynti on pylväinä ja kasvu edelliseen kvartaaliin tekstinä.', '11.15'),
    viewCard(V1),
    agentItem('a1b', 'Laitoin mukaan myös lähdeaineiston, josta luvut on laskettu.', '11.30'),
    fileCard(F1),
    userItem('u2', 'Tee myös yhteenveto syyskuun asiakaskyselystä.', '11.40'),
    agentItem('a2', 'Kyselyyn oli tullut 212 vastausta. Yhteenvedossa on suositteluhalukkuus ja kolme useimmin mainittua kehityskohdetta.', '11.48'),
    viewCard(V2),
    agentItem('a2b', 'Vastaukset taulukkona, jos haluat suodattaa niitä itse:', '12.05'),
    fileCard(F2),
    userItem('u3', 'Vertaile vielä tuotelinjoja keskenään.', '12.20'),
    agentItem('a3', 'Perus-linja myy eniten, mutta Pro kasvaa nopeimmin. Vertailussa on neljä sivua: yhteenveto ja sivu kullekin linjalle.', '12.30'),
    viewCard(V3),
    agentItem('a3b', 'Tässä koko kvartaalin myyntidata yhtenä tiedostona.', '12.40'),
    fileCard(F3),
    userItem('u4', 'Kvartaalikatsauksessa syyskuun luku on liian suuri, tarkista.', '12.50'),
    agentItem('a4', 'Totta: syyskuuhun oli osunut 90 000 euroa lokakuun laskuja. Korjasin luvun ja lisäsin huomautuksen.', '12.55'),
    viewCard(V4),
    userItem('u5', 'Kyselyyn tuli vielä 40 vastausta, päivitä yhteenveto. Ja tee katsauksesta PDF sähköpostiin.', '13.15'),
    agentItem('a5', 'Päivitin yhteenvedon 252 vastaukseen; jakauma ei juuri muuttunut.', '13.20'),
    viewCard(V5),
    agentItem('a5b', 'Ja katsaus PDF:nä:', '13.30'),
    fileCard(F4),
    userItem('u6', 'Tee kvartaalikatsauksesta tumma versio kokoushuoneen näytölle. Tarkistuta myös PDF:n luvut lähdeaineistoa vasten ja luokittele kyselyn avoimet vastaukset.', '13.40'),
    agentItem('a6', 'Tumma versio on valmis, luvut samat kuin korjatussa.', '13.42'),
    viewCard(V6),
    agentItem('a7', 'Käynnistin kaksi workeria: `pdf-luvut-tarkistus` vertaa PDF:n lukuja lähdeaineistoon ja `kysely-avoimet-luokittelu` ryhmittelee avoimet vastaukset. Kerron, kun ne ovat valmiita.', '13.44'),
  ];

  const panel = item ? (
    <ItemPanel key={itemId(item)} item={item} act={act} onClose={() => setItem(undefined)}
      onSub={(p) => setItem(item.kind === 'file' ? {...item, sub: p} : item)} />
  ) : null;

  const t = Date.now();
  const model = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/ws_m?conversation=${m.agentId}`, workspaceId: 'ws_m', workspaceName: 'myynti', activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: t - 5 * 60000, ...m,
  });
  const running: AgentNavModel[] = [
    model({agentId: 'q3', title: PARENT, selected: true, detail: 'myynti · Odottaa viestiä'}),
    model({agentId: 'budjetti', title: 'Budjetti 2027', changedAt: t - 50 * 60000, detail: 'myynti · Odottaa viestiä'}),
    model({agentId: 'crm', title: 'CRM-siivous', workspaceId: 'ws_h', workspaceName: 'fleetrepo', changedAt: t - 90 * 60000, detail: 'fleetrepo · Odottaa viestiä'}),
  ];
  const quiet: AgentNavModel[] = [model({agentId: 'q2', title: 'Q2-katsaus', changedAt: t - 30 * 86400000, detail: 'myynti · Odottaa viestiä'})];
  const row = (m: AgentNavModel) => <AgentNavItem key={m.agentId} {...m} now={t} />;
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Alder" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="ac-running">
            <h2 className="ah-rail-section-head" id="ac-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
            <ul>{running.map(row)}</ul>
          </section>
          <section className="ah-now ah-quiet" data-testid="rail-quiet" aria-labelledby="ac-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded="true">
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="ac-quiet">Hiljaiset</span><span className="ah-rail-count">{quiet.length}</span>
              </button>
            </h2>
            <ul>{quiet.map(row)}</ul>
          </section>
        </>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_h" />
      <WorkspaceNavRow name="myynti" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  const main = (
    <div className="ah-state ac-main">
      <ViewSplit open={!!panel} expanded={false} width={width} min={320} max={Math.max(320, innerWidth - 300 - 360)}
        onResize={setWidth} onReset={noop} onShowConversation={noop} panel={panel}>
        <ConversationFrame>
          <AgentHeader title={PARENT} workspaceLabel="myynti" workspaceHref="/workspaces/ws_m" activityLabel="Odottaa viestiä"
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          <ConversationStream streamRef={stream}>
            <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          <AssetsStrip act={act} open={listOpen} setOpen={setListOpen} onHoverEnd={() => setHoverId(undefined)} />
          <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
            onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={picker} />
        </ConversationFrame>
      </ViewSplit>
    </div>
  );
  return (
    <PubContext.Provider value={pubValue}>
      <StatusBellProvider items={[]}>
        <AppShell mobileTitle={PARENT} navigationBadge={0} rail={railView}
          main={<ProcessProvider id={CONVO} csrf="prototype" onLogin={noop} onStatusEvent={() => noop}>{main}</ProcessProvider>} />
      </StatusBellProvider>
      {tab ? <TabMock item={tab} onClose={() => setTab(undefined)} /> : null}
      {toast ? <div className="ac-toast ac-keep" role="status" data-testid="ac-toast"><Icon name="download" /> {toast}</div> : null}
    </PubContext.Provider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
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
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Keskustelun näkymät ja tiedostot · kierros 3</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter initialEntries={['/workspaces/ws_m?conversation=q3']}>
          <Main direction={direction} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(v: React.ReactNode) { flushSync(() => root.render(v === '' ? null : v)); }};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const pickerNav = document.createElement('nav');
pickerNav.className = 'proto-picker'; pickerNav.setAttribute('aria-label', 'Prototype variants');
pickerNav.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  pickerNav.append(button);
});
document.body.append(pickerNav);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
