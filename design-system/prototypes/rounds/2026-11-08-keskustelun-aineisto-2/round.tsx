import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Switch, Tab, TabList, TabPanel, Tabs} from 'react-aria-components';
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
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {ProcessProvider, useProcessView} from '../../../../web/src/components/ProcessTray';
import {BackgroundStrip, type WorkerAsk} from '../../../../web/src/components/BackgroundStrip';
import {SpinoffContext} from '../../../../web/src/components/Spinoffs';
import {ViewOfferCard, formatViewSize, type ViewSummary} from '../../../../web/src/components/ViewOffer';
import {ViewPanel, ViewSplit} from '../../../../web/src/components/ViewPanel';
import {FileOfferCard, FileShelf, fileFacts as itemFacts, formatOfferSize} from '../../../../web/src/components/FileOffer';
import type {FileKind, FileOfferItem, FileOfferSummary, OfferState} from '../../../../web/src/app/fileOffers';
import type {Spinoff} from '../../../../web/src/app/spinoffs';
import type {TimelineItem} from '../../../../web/src/components/types';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import '../../../../web/src/components/EditorSplit.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-conversation-assets, round 2. Jari 8.11.2026 chose round 1's Siru
// (a chip with counts opening a list of the conversation's views and files)
// and asked whether it should live by the message field, in the strip where
// the Workerit chip and the other background chips are. The axis is how the
// chip lives in that strip. "Nyt" is production: the strip has only Workerit
// and the header's file button opens the Tiedostot panel. All three riffs
// list the same six view offers and four file offers as round 1 did, open
// the list as the strip's floating panel above the chips, and open a pressed
// item in the offer card's place (proto-offer-cards-consistent round 2):
// the right-hand panel, or a window over the conversation from the review
// bar's switch.
// 1 Oma siru: its own chip with both counts beside Workerit;
// 2 Yhteinen: one chip for the workers and the assets, its panel in tabs;
// 3 Kasvava: a small symbol-only chip that grows to name a new item.
const directions = ['Nyt', '1 Oma siru', '2 Yhteinen', '3 Kasvava'];
const LINES = [
  'Nyt: tuotanto tänään. Kentän yllä on vain Workerit-siru; yläpalkin tiedostopainike avaa Tiedostot-paneelin, näkymillä ei ole listaa.',
  '1 Oma siru: Workerit-sirun vieressä on oma siru, jossa näkymien ja tiedostojen määrät; se avaa listan kenttää kohti samaan paikkaan kuin Workerit-paneeli.',
  '2 Yhteinen: workerit ja aineisto ovat yhdessä sirussa; sen paneelissa on välilehdet Workerit ja Näkymät ja tiedostot.',
  '3 Kasvava: pieni siru pelkin merkein; kun agentti tarjoaa uuden, siru kasvaa ja näyttää sen nimen hetken, sitten jää pisteeksi kunnes katsot.',
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

type Act = {
  openView: (v: View) => void;
  openFile: (o: Offer) => void;
  locate: (id: string) => void;
  openedId?: string;
};

/** One list row (round 1 unchanged): the newest version or the file offer,
 * its time, and the way back to its card. Versions unfold under it. */
function EntryRow({e, act}: {e: Entry; act: Act}) {
  const [unfolded, setUnfolded] = useState(false);
  if (e.kind === 'file') {
    const o = e.offer;
    return (
      <li className="ac-entry" data-testid="ac-entry" data-kind="file" data-id={o.offer.offer_id} data-open={act.openedId === o.offer.offer_id || undefined}>
        <button type="button" className="ac-row" data-testid="ac-open" onClick={() => act.openFile(o)}>
          <FileMark o={o} />
          <span className="ac-text">
            <span className="ac-title">{o.offer.title}</span>
            <span className="ac-meta">{fileFacts(o)}</span>
          </span>
          <span className="ac-time">{hhmm(o.offer.created_at)}</span>
        </button>
        <ControlButton size="row" variant="quiet" className="ac-locate" data-testid="ac-locate" aria-label={`Näytä keskustelussa: ${o.offer.title}`} title="Näytä keskustelussa" onPress={() => act.locate(o.offer.offer_id)}>
          <Icon name="message" />
        </ControlButton>
      </li>
    );
  }
  const [newest, ...older] = e.versions;
  return (
    <li className="ac-entry" data-testid="ac-entry" data-kind="view" data-id={newest.view_id} data-open={act.openedId === newest.view_id || undefined}>
      <button type="button" className="ac-row" data-testid="ac-open" onClick={() => act.openView(newest)}>
        <ViewMark />
        <span className="ac-text">
          <span className="ac-title">{newest.title}</span>
          <span className="ac-meta">{newest.entry}</span>
        </span>
        <span className="ac-time">{hhmm(newest.created_at)}</span>
      </button>
      <ControlButton size="row" variant="quiet" className="ac-locate" data-testid="ac-locate" aria-label={`Näytä keskustelussa: ${newest.title}`} title="Näytä keskustelussa" onPress={() => act.locate(newest.view_id)}>
        <Icon name="message" />
      </ControlButton>
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
          {older.map((v, i) => (
            <li key={v.view_id} data-open={act.openedId === v.view_id || undefined}>
              <button type="button" className="ac-row ac-row-older" data-testid="ac-open-older" onClick={() => act.openView(v)}>
                <span className="ac-version-n">{older.length - i}</span>
                <span className="ac-text"><span className="ac-title">{v.title}</span></span>
                <span className="ac-time">{hhmm(v.created_at)}</span>
              </button>
              <ControlButton size="row" variant="quiet" className="ac-locate" data-testid="ac-locate-older" aria-label={`Näytä keskustelussa: ${v.title} ${hhmm(v.created_at)}`} title="Näytä keskustelussa" onPress={() => act.locate(v.view_id)}>
                <Icon name="message" />
              </ControlButton>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
function EntryList({act}: {act: Act}) {
  return <ul className="ac-list" data-testid="ac-list">{ENTRIES.map((e) => <EntryRow key={e.key} e={e} act={act} />)}</ul>;
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
type Item = {kind: 'view'; view: View} | {kind: 'file'; offer: Offer; sub?: string};
const itemId = (i: Item) => (i.kind === 'view' ? i.view.view_id : i.offer.offer.offer_id);

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

/** The offer card's place (proto-offer-cards-consistent): one top bar for
 * every kind, with own tab, download, public switch and the way back to the
 * card in the conversation. */
function ItemPanel({item, onSub, onClose, onLocate}: {item: Item; onSub: (p?: string) => void; onClose: () => void; onLocate: () => void}) {
  const [pub, setPub] = useState(false);
  const folderRoot = item.kind === 'file' && !item.sub && itemsOf(item.offer).length > 1;
  const title = item.kind === 'view' ? item.view.title : item.sub ? baseName(item.sub) : item.offer.offer.title;
  const facts = item.kind === 'view'
    ? ['Näkymä', ...(item.view.files > 1 ? [`${item.view.files} tiedostoa`] : []), formatViewSize(item.view.bytes), hhmm(item.view.created_at)]
    : item.sub ? itemFacts(itemsOf(item.offer).find((i) => i.path === item.sub)!) : [fileFacts(item.offer), hhmm(item.offer.offer.created_at)];
  return (
    <section className="ah-view-pane ac-item" data-testid="ac-item" data-kind={item.kind} aria-label={title}>
      {item.kind === 'file' && item.sub ? (
        <button type="button" className="ac-back" data-testid="ac-item-up" onClick={() => onSub(undefined)}><Icon name="back" /> {item.offer.offer.folder}/</button>
      ) : null}
      <header className="ac-item-head">
        {item.kind === 'view' ? <ViewMark size="s" /> : <FileMark o={item.offer} size="s" />}
        <span className="ac-item-title">
          <h2 className="ah-view-title" data-testid="ac-item-title">{title}</h2>
          <span className="ac-meta">{facts.join(' · ')}</span>
        </span>
        <span className="ac-item-tools">
          <ControlButton size="row" variant="quiet" data-testid="ac-item-locate" aria-label="Näytä keskustelussa" title="Näytä keskustelussa" onPress={onLocate}><Icon name="message" /></ControlButton>
          {folderRoot ? null : <ControlButton size="row" variant="quiet" aria-label="Avaa omalle välilehdelle" title="Avaa omalle välilehdelle" onPress={() => {}}><Icon name="external" /></ControlButton>}
          <ControlButton size="row" variant="quiet" aria-label="Lataa" title={folderRoot ? 'Lataa kaikki (.zip)' : 'Lataa'} onPress={() => {}}><Icon name="download" /></ControlButton>
          <ControlButton size="row" variant="quiet" data-testid="ac-item-close" aria-label="Sulje" title="Sulje" onPress={onClose}><Icon name="cross" /></ControlButton>
        </span>
      </header>
      <div className="ac-item-share">
        <Switch className="ah-view-offer-switch" data-testid="ac-public" isSelected={pub} onChange={setPub}>
          <span>Julkinen</span><span className="ah-view-offer-track" aria-hidden="true" />
        </Switch>
        <span className="ac-seen" data-public={pub || undefined}><Icon name={pub ? 'globe' : 'lock'} />{pub ? 'Kaikki, joilla on linkki' : 'Vain sinulle'}</span>
      </div>
      <div className="ac-item-body"><ItemBody item={item} onSub={(p) => onSub(p)} /></div>
    </section>
  );
}

// ---- The strip by the message field ----
const noop = () => {};
const spinoffs = {data: {schema_version: 1 as const, parent_id: CONVO, availability: 'available' as const, runs: RUNS, transcripts: []}, open: noop};

/** Closes on a press outside the strip and on Escape, as the strip's own panel does. */
function useDismiss(open: boolean, close: () => void, inside: React.RefObject<HTMLElement | null>) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!inside.current?.contains(e.target as Node)) ref.current(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current(); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open, inside]);
}

function AssetsPop({act, onClose}: {act: Act; onClose: () => void}) {
  return (
    <div className="ah-bg-pop ac-pop" role="dialog" aria-label="Keskustelun näkymät ja tiedostot" data-testid="ac-pop">
      <div className="ah-bg-tabs ac-pop-head">
        <span className="ac-pop-title"><span className="ac-count-view" aria-hidden="true">{'</>'}</span> Näkymät ja tiedostot <span className="ah-bg-tab-n">{ENTRIES.length}</span></span>
        <ControlButton className="ah-bg-x" size="inline" variant="quiet" aria-label="Sulje" data-testid="ac-pop-close" onPress={onClose}><Icon name="cross" /></ControlButton>
      </div>
      <div className="ah-bg-pop-body"><EntryList act={act} /></div>
    </div>
  );
}

/** 1 Oma siru and 3 Kasvava: production's strip unchanged, the assets chip beside it. */
function SideBySide({grow, act, open, setOpen, fresh, setFresh}: {grow: boolean; act: Act; open: boolean; setOpen: (v: boolean) => void; fresh: number; setFresh: (v: number) => void}) {
  const view = useProcessView();
  const line = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), line);
  // One floating panel at a time: the workers' panel closes the list and back.
  useEffect(() => { if (view?.panel) setOpen(false); }, [view?.panel, setOpen]);
  // Kasvava: a new item names itself for a moment, then leaves a dot until looked at.
  const [grown, setGrown] = useState(true);
  useEffect(() => {
    if (!grow) return;
    if (!fresh) { setGrown(false); return; }
    setGrown(true);
    const t = window.setTimeout(() => setGrown(false), 6000);
    return () => window.clearTimeout(t);
  }, [grow, fresh]);
  const toggle = () => { const on = !open; if (on) { view?.setPanel(null); setFresh(0); } setOpen(on); };
  const unseen = grow && fresh > 0;
  const chip = grow ? (
    <ControlButton data-testid="ac-chip" data-grown={grown || undefined} data-unseen={unseen || undefined} size="inline" presentation="pill"
      className={`ah-bg-badge ac-chip ac-grow${grown ? ' grown' : ''}`} aria-expanded={open}
      aria-label={`${countLabel}${unseen ? `, uusi: ${V6.title}` : ''}`} title={`Keskustelun näkymät ja tiedostot${unseen ? ` – uusi: ${V6.title}` : ''}`} onPress={toggle}>
      <span className="ac-count-view" aria-hidden="true">{'</>'}</span>
      <Icon name="file" className="ah-bg-kind-ic" />
      <span className="ac-grow-name" aria-hidden="true"><span className="ac-grow-new">Uusi</span> {V6.title}</span>
      {unseen && !grown ? <span className="ac-dot" aria-hidden="true" /> : null}
    </ControlButton>
  ) : (
    <ControlButton data-testid="ac-chip" size="inline" presentation="pill" className="ah-bg-badge ac-chip" aria-expanded={open}
      aria-label={countLabel} title="Keskustelun näkymät ja tiedostot" onPress={toggle}>
      <Counts />
    </ControlButton>
  );
  return (
    <section className="ah-bg-strip ac-strip">
      <div className="ac-line" ref={line}>
        <SpinoffContext.Provider value={spinoffs}><BackgroundStrip agentIdle ask={ask} /></SpinoffContext.Provider>
        {chip}
        {open ? <AssetsPop act={act} onClose={() => setOpen(false)} /> : null}
      </div>
    </section>
  );
}

/** 2 Yhteinen: one chip; its panel has the workers' tab (production's own
 * panel body) and the assets' tab. */
function Merged({act, open, setOpen}: {act: Act; open: boolean; setOpen: (v: boolean) => void}) {
  const view = useProcessView();
  const line = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'spin' | 'assets'>('assets');
  const close = () => { setOpen(false); view?.setPanel(null); };
  useDismiss(open, close, line);
  // The workers' tab shows production's panel, which needs its own panel state.
  useEffect(() => { if (open && tab === 'spin' && view && view.panel !== 'spin') view.setPanel('spin'); }, [open, tab, view]);
  return (
    <section className="ah-bg-strip ac-strip">
      <div className="ac-line" ref={line}>
        <ControlButton data-testid="ac-chip" size="inline" presentation="pill" className="ah-bg-badge ac-chip ac-merged-chip" aria-expanded={open}
          aria-label={`Workerit ${RUNS.length} työskentelee, ${countLabel}`} title="Taustatyö ja keskustelun aineisto" onPress={() => (open ? close() : setOpen(true))}>
          <Icon name="branch" className="ah-bg-kind-ic" /><span className="ah-bg-n">{RUNS.length}</span>
          <span className="ac-sep" aria-hidden="true" />
          <Counts />
        </ControlButton>
        {open ? (
          <div className="ah-bg-pop ac-pop ac-tabbed" data-testid="ac-pop">
            <Tabs selectedKey={tab} onSelectionChange={(k) => { const t = String(k) as 'spin' | 'assets'; setTab(t); view?.setPanel(t === 'spin' ? 'spin' : null); }}>
              <div className="ah-bg-tabs">
                <TabList aria-label="Taustatyö ja aineisto" className="ah-bg-tablist">
                  <Tab id="spin" className="ah-bg-tab" data-testid="ac-tab-workers"><Icon name="branch" className="ah-bg-kind-ic" />Workerit<span className="ah-bg-tab-n">{RUNS.length}</span></Tab>
                  <Tab id="assets" className="ah-bg-tab" data-testid="ac-tab-assets"><span className="ac-count-view" aria-hidden="true">{'</>'}</span>Näkymät ja tiedostot<span className="ah-bg-tab-n">{ENTRIES.length}</span></Tab>
                </TabList>
                <ControlButton className="ah-bg-x" size="inline" variant="quiet" aria-label="Sulje" data-testid="ac-pop-close" onPress={close}><Icon name="cross" /></ControlButton>
              </div>
              <TabPanel id="spin" className="ah-bg-pop-body ac-tab-workers">
                <SpinoffContext.Provider value={spinoffs}><BackgroundStrip agentIdle ask={ask} /></SpinoffContext.Provider>
              </TabPanel>
              <TabPanel id="assets" className="ah-bg-pop-body"><EntryList act={act} /></TabPanel>
            </Tabs>
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

type OpenAt = 'beside' | 'window';
let reviewOpenAt: OpenAt = 'beside';

function Main({direction, openAt, fresh, setFresh}: {direction: number; openAt: OpenAt; fresh: number; setFresh: (v: number) => void}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLElement>(null);
  const [listOpen, setListOpen] = useState(false);
  const [item, setItem] = useState<Item>();
  // Nyt: production's own places.
  const [nowView, setNowView] = useState<View>();
  const [nowShelf, setNowShelf] = useState<{at?: string}>();
  const [width, setWidth] = useState(() => Math.round(Math.max(innerWidth - 300, 0) * 0.46));
  const phone = () => innerWidth <= 800;
  const found = useRef<number>(undefined);
  const locate = (id: string) => {
    setListOpen(false);
    if (phone() || openAt === 'window') setItem(undefined);
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
  const act: Act = {
    openedId: item ? itemId(item) : undefined,
    openView: (v) => { setItem({kind: 'view', view: v}); setListOpen(false); },
    openFile: (o) => { setItem({kind: 'file', offer: o}); setListOpen(false); },
    locate,
  };
  useLayoutEffect(() => {
    const el = stream.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => {
    if (!item || openAt !== 'window') return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setItem(undefined); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [item, openAt]);

  const now = direction === 0;
  const viewCard = (v: View) => ({id: v.view_id, kind: 'notice', content: (
    <ViewOfferCard view={v} state={(now ? nowView : item?.kind === 'view' ? item.view : undefined)?.view_id === v.view_id ? 'open' : 'idle'}
      onOpen={() => (now ? (setNowShelf(undefined), setNowView(v)) : act.openView(v))} onOpenTab={noop} />
  )});
  const fileCard = (o: Offer) => ({id: o.offer.offer_id, kind: 'notice', content: (
    <FileOfferCard offer={o.offer} state={o.state} onShowFiles={(id) => (now ? (setNowView(undefined), setNowShelf({at: id})) : act.openFile(o))} />
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

  // Today's header control, as FilesHeaderControl draws it.
  const nowFiles = now ? (
    <ControlButton data-testid="toggle-file-shelf" size="row" variant="quiet" className="ah-files-toggle" aria-label={`Tiedostot: ${FILE_COUNT}`}
      title="Keskustelun tiedostot" aria-pressed={!!nowShelf && !nowView} onPress={() => { setNowView(undefined); setNowShelf(nowShelf ? undefined : {}); }}>
      <Icon name="file" /> <span>{FILE_COUNT}</span>
    </ControlButton>
  ) : null;

  let panel: React.ReactNode = null;
  if (now && nowView)
    panel = <ViewPanel title={`${nowView.title} · ${hhmm(nowView.created_at)}`} src={nowView.src} expanded={false} onToggleExpanded={noop} onOpenTab={noop} onClose={() => setNowView(undefined)} />;
  else if (now && nowShelf)
    panel = <FileShelf offers={OFFERS} scrollTo={nowShelf.at} onClose={() => setNowShelf(undefined)} />;
  const itemPanel = item ? (
    <ItemPanel key={itemId(item)} item={item} onClose={() => setItem(undefined)} onLocate={() => locate(itemId(item))}
      onSub={(p) => setItem(item.kind === 'file' ? {...item, sub: p} : item)} />
  ) : null;
  if (!now && openAt === 'beside') panel = itemPanel;

  const strip = now ? (
    <SpinoffContext.Provider value={spinoffs}><BackgroundStrip agentIdle ask={ask} /></SpinoffContext.Provider>
  ) : direction === 2 ? (
    <Merged act={act} open={listOpen} setOpen={setListOpen} />
  ) : (
    <SideBySide grow={direction === 3} act={act} open={listOpen} setOpen={setListOpen} fresh={fresh} setFresh={setFresh} />
  );

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
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} filesControl={nowFiles} />
          <ConversationStream streamRef={stream}>
            <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          {strip}
          <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
            onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={picker} />
        </ConversationFrame>
      </ViewSplit>
      {!now && openAt === 'window' && itemPanel ? (
        <div className="ac-window" data-testid="ac-window" onPointerDown={(e) => { if (e.target === e.currentTarget) setItem(undefined); }}>
          {itemPanel}
        </div>
      ) : null}
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={PARENT} navigationBadge={0} rail={railView}
        main={<ProcessProvider id={CONVO} csrf="prototype" onLogin={noop} onStatusEvent={() => noop}>{main}</ProcessProvider>} />
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [openAt, setOpenAt] = useState<OpenAt>(reviewOpenAt);
  // Kasvava's arrival: 1 = the dark version just arrived (the story's last offer).
  const [fresh, setFresh] = useState(1);
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
        <strong>Keskustelun näkymät ja tiedostot · kierros 2</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        {direction ? (
          <label>Kohde avautuu <select id="openat" value={openAt} onChange={(e) => { reviewOpenAt = e.target.value as OpenAt; setOpenAt(reviewOpenAt); }}>
            <option value="beside">viereen</option><option value="window">ikkunaan</option></select></label>
        ) : null}
        {direction === 3 ? <button type="button" className="rq-replay" data-testid="replay" onClick={() => setFresh(fresh + 1)}>Uusi kohde saapuu</button> : null}
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter initialEntries={['/workspaces/ws_m?conversation=q3']}>
          <Main key={openAt} direction={direction} openAt={openAt} fresh={fresh} setFresh={setFresh} />
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
