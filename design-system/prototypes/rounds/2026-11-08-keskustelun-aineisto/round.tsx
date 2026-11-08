import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
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
import {ProcessProvider} from '../../../../web/src/components/ProcessTray';
import {ViewOfferCard, type ViewSummary} from '../../../../web/src/components/ViewOffer';
import {ViewPanel, ViewSplit} from '../../../../web/src/components/ViewPanel';
import {FileOfferCard, FileShelf, OfferedFilePreview, formatOfferSize} from '../../../../web/src/components/FileOffer';
import type {FileKind, FileOfferItem, FileOfferSummary, OfferState} from '../../../../web/src/app/fileOffers';
import type {TimelineItem} from '../../../../web/src/components/types';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import '../../../../web/src/components/EditorSplit.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-conversation-assets, round 1. Jari 8.11.2026: the views and files an
// agent offers are hard to find later; an old card means scrolling far up.
// Before deciding whether a new version updates its card
// (view-new-version-same-card), find a place where a conversation's assets
// are listed, newest first, each opened without scrolling. The axis is where
// that list lives. "Nyt" is production: cards in the transcript and the
// header's file button opening the Tiedostot panel, files only. The three
// directions list the same six view offers (three reports, versions of the
// same entry folded together) and four file offers:
// 1 Siru: a header chip with both counts opens a list under it;
// 2 Paneeli: the right-hand file panel becomes "Näkymät ja tiedostot", views
//   above production's file rows, and a view opens in the same panel;
// 3 Sivupalkki: the conversation's row in the rail carries its assets.
const directions = ['Nyt', '1 Siru', '2 Paneeli', '3 Sivupalkki'];
const LINES = [
  'Nyt: tuotanto tänään. Kortit vain keskustelussa; yläpalkin tiedostopainike avaa Tiedostot-paneelin, jossa on vain tiedostot. Näkymillä ei ole listaa.',
  '1 Siru: yläpalkin siru näyttää näkymien ja tiedostojen määrän ja avaa sen alle listan, uusin ylimpänä; saman raportin versiot yhdellä rivillä.',
  '2 Paneeli: oikean reunan tiedostopaneeli on Näkymät ja tiedostot: näkymät ylimpänä, tiedostot tuotannon riveinä alla; näkymä avautuu samaan paneeliin.',
  '3 Sivupalkki: keskustelun rivin alla sivupalkissa on sen näkymät ja tiedostot, uusimmat neljä ja loput yhden painalluksen takana.',
];

// ---- The story: a quarterly report, six view offers, four file offers ----
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

// The offered files' content for the preview dialog; every other request 404s.
const CSV = 'pvm;asiakas;tuote;määrä;euroa\n2026-09-01;Kesko;Pro;12;4800\n2026-09-01;Fiskars;Perus;40;6000\n2026-09-02;Valio;Palvelut;1;12500\n';
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

function ViewMark() { return <span className="ac-mark ac-mark-view" aria-hidden="true">{'</>'}</span>; }
function FileMark({o}: {o: Offer}) {
  const items = o.state.state === 'ready' ? o.state.manifest.items : [];
  const icon: IconName = items.length === 1 ? kindIcon[items[0].kind] : o.offer.folder ? 'folder' : 'file';
  return <span className="ac-mark ac-mark-file" aria-hidden="true"><Icon name={icon} /></span>;
}
function fileFacts(o: Offer) {
  const items = o.state.state === 'ready' ? o.state.manifest.items : [];
  if (items.length === 1) return `${ext(items[0].path)} · ${formatOfferSize(items[0].bytes)}`;
  return `${o.offer.folder ? `${o.offer.folder}/ · ` : ''}${o.offer.files} tiedostoa · ${formatOfferSize(o.offer.bytes)}`;
}

type Act = {
  openView: (v: View) => void;
  openFile: (o: Offer) => void;
  locate: (id: string) => void;
  openedId?: string;
};

/** One list row: the newest version or the file offer, its time, and the
 * way back to its card in the conversation. Versions unfold under it. */
function EntryRow({e, act, compact}: {e: Entry; act: Act; compact?: boolean}) {
  const [unfolded, setUnfolded] = useState(false);
  if (e.kind === 'file') {
    const o = e.offer;
    return (
      <li className="ac-entry" data-testid="ac-entry" data-kind="file" data-id={o.offer.offer_id}>
        <button type="button" className="ac-row" data-testid="ac-open" onClick={() => act.openFile(o)}>
          <FileMark o={o} />
          <span className="ac-text">
            <span className="ac-title">{o.offer.title}</span>
            {compact ? null : <span className="ac-meta">{fileFacts(o)}</span>}
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
          {compact ? null : <span className="ac-meta">{newest.entry}</span>}
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
          {compact ? e.versions.length : `${e.versions.length} versiota`}
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

function EntryList({list, act, compact}: {list: Entry[]; act: Act; compact?: boolean}) {
  return <ul className="ac-list" data-compact={compact || undefined}>{list.map((e) => <EntryRow key={e.key} e={e} act={act} compact={compact} />)}</ul>;
}

/** The header's counts: views by their mark, files by production's icon. */
function Counts() {
  return (
    <>
      <span className="ac-count-view" aria-hidden="true">{'</>'}</span><span>{REPORTS}</span>
      <Icon name="file" /><span>{OFFERS.length}</span>
    </>
  );
}

// ---- 1 Siru: the list under the header chip ----
function SiruPop({act, onClose}: {act: Act; onClose: () => void}) {
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!pop.current?.contains(t) && !t.closest('[data-testid="ac-chip"]')) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);
  return (
    <div className="ac-pop ah-popover" ref={pop} role="dialog" aria-label="Keskustelun näkymät ja tiedostot" data-testid="ac-list">
      <p className="ac-pop-head">Näkymät ja tiedostot <span className="ah-file-offer-count">{ENTRIES.length}</span></p>
      <EntryList list={ENTRIES} act={act} />
    </div>
  );
}

// ---- 2 Paneeli: the file panel holds the views too ----
function AssetPane({act, onClose}: {act: Act; onClose: () => void}) {
  const views = ENTRIES.filter((e) => e.kind === 'view');
  return (
    <section className="ah-view-pane ac-pane" aria-label="Keskustelun näkymät ja tiedostot" data-testid="ac-list">
      <header className="ah-editor-header">
        <h2 className="ah-view-title" tabIndex={-1}>Näkymät ja tiedostot</h2>
        <span className="ah-editor-controls">
          <ControlButton size="row" variant="quiet" aria-label="Sulje" title="Sulje" data-testid="ac-pane-close" onPress={onClose}><Icon name="cross" /></ControlButton>
        </span>
      </header>
      <div className="ac-pane-scroll">
        <h3 className="ac-pane-section"><ViewMark />Näkymät <span className="ah-file-offer-count">{VIEWS.length}</span></h3>
        <EntryList list={views} act={act} />
        <h3 className="ac-pane-section"><span className="ac-mark ac-mark-file" aria-hidden="true"><Icon name="file" /></span>Tiedostot <span className="ah-file-offer-count">{FILE_COUNT}</span></h3>
        <div className="ac-pane-shelf">
          <FileShelf offers={OFFERS} onClose={onClose} />
        </div>
      </div>
    </section>
  );
}

// ---- 3 Sivupalkki: the conversation's assets under its rail row ----
function RailAssets({act}: {act: Act}) {
  const [all, setAll] = useState(false);
  const shown = all ? ENTRIES : ENTRIES.slice(0, 4);
  return (
    <li className="ac-rail" data-testid="ac-list" aria-label="Keskustelun näkymät ja tiedostot">
      <EntryList list={shown} act={act} compact />
      {ENTRIES.length > 4 ? (
        <button type="button" className="ac-rail-more" data-testid="ac-rail-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Vähemmän' : `${ENTRIES.length - 4} lisää`}
          <Icon name={all ? 'up' : 'down'} className="ac-chev" />
        </button>
      ) : null}
    </li>
  );
}

// ---- The conversation ----
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'myynti',
};
const picker = <button type="button" className="md-pill">Claude Opus 5.5 · high</button>;
const userItem = (id: string, text: string, time: string): TimelineItem & {kind: string} => ({id, kind: 'user', content: <UserMessage sourceText={text} onCopy={noop} time={time}><Markdown text={text} /></UserMessage>});
const agentItem = (id: string, text: string, time: string): TimelineItem & {kind: string} =>
  ({id, kind: 'assistant', content: <AssistantMessage streamState="complete" time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>});

function Main({direction}: {direction: number}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLElement>(null);
  // Every direction opens with its list showing; Nyt with its file panel.
  const [listOpen, setListOpen] = useState(true);
  const [opened, setOpened] = useState<View>();
  const [previewing, setPreviewing] = useState<Offer>();
  const [shelfAt, setShelfAt] = useState<string>();
  const [width, setWidth] = useState(() => Math.round(Math.max(innerWidth - 300, 0) * 0.46));
  const phone = () => innerWidth <= 800;
  const found = useRef<number>(undefined);
  const act: Act = {
    openedId: opened?.view_id,
    openView: (v) => {
      setOpened(v);
      if (direction === 1) setListOpen(false);
      if (direction === 3 && phone()) window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    },
    openFile: (o) => {
      if (o.offer.files === 1) { setPreviewing(o); return; }
      // A package opens production's file panel at it, as its card does.
      setOpened(undefined); setShelfAt(o.offer.offer_id);
      if (direction === 1) setListOpen(false);
      if (direction === 3 && phone()) window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    },
    locate: (id) => {
      if (direction === 1 || phone()) setListOpen(false);
      if (phone()) { setOpened(undefined); setShelfAt(undefined); }
      if (direction === 3 && phone()) window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const card = stream.current?.querySelector<HTMLElement>(`[data-view-id="${id}"], [data-offer-id="${id}"]`);
        if (!card) return;
        stream.current?.querySelectorAll('.ac-found').forEach((el) => el.classList.remove('ac-found'));
        card.scrollIntoView({block: 'center'});
        card.classList.add('ac-found');
        clearTimeout(found.current);
        found.current = window.setTimeout(() => card.classList.remove('ac-found'), 2400);
      }));
    },
  };
  useLayoutEffect(() => {
    const el = stream.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const viewCard = (v: View) => ({id: v.view_id, kind: 'notice', content: <ViewOfferCard view={v} state={opened?.view_id === v.view_id ? 'open' : 'idle'} onOpen={() => setOpened(v)} onOpenTab={noop} />});
  const fileCard = (o: Offer) => ({id: o.offer.offer_id, kind: 'notice', content: <FileOfferCard offer={o.offer} state={o.state} onShowFiles={(id) => { setOpened(undefined); setShelfAt(id); if (direction !== 2) setListOpen(false); else setListOpen(true); }} />});
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
    userItem('u6', 'Tee kvartaalikatsauksesta tumma versio kokoushuoneen näytölle.', '13.40'),
    agentItem('a6', 'Tumma versio on valmis, luvut samat kuin korjatussa.', '13.42'),
    viewCard(V6),
  ];

  // Today's header control, as FilesHeaderControl draws it.
  const nowFiles = (
    <ControlButton data-testid="toggle-file-shelf" size="row" variant="quiet" className="ah-files-toggle" aria-label={`Tiedostot: ${FILE_COUNT}`}
      title="Keskustelun tiedostot" aria-pressed={listOpen && !opened} onPress={() => { setOpened(undefined); setShelfAt(undefined); setListOpen(!(listOpen && !opened)); }}>
      <Icon name="file" /> <span>{FILE_COUNT}</span>
    </ControlButton>
  );
  const chip = (
    <ControlButton data-testid="ac-chip" size="row" variant="quiet" className="ac-chip" aria-label={`Näkymät ${REPORTS}, tiedostot ${OFFERS.length}`}
      title="Keskustelun näkymät ja tiedostot" aria-expanded={listOpen} onPress={() => setListOpen(!listOpen)}>
      <Counts />
    </ControlButton>
  );
  const paneToggle = (
    <ControlButton data-testid="ac-chip" size="row" variant="quiet" className="ac-chip" aria-label={`Näkymät ${REPORTS}, tiedostot ${OFFERS.length}`}
      title="Keskustelun näkymät ja tiedostot" aria-pressed={listOpen && !opened && !shelfAt}
      onPress={() => { const on = !(listOpen && !opened && !shelfAt); setOpened(undefined); setShelfAt(undefined); setListOpen(on); }}>
      <Counts />
    </ControlButton>
  );
  const filesControl = direction === 0 ? nowFiles : direction === 1 ? chip : direction === 2 ? paneToggle : null;

  // The right-hand panel: an opened view first, then a package's shelf, then the direction's own list.
  const back = direction === 2 ? (
    <button type="button" className="ac-back" data-testid="ac-back" onClick={() => { setOpened(undefined); setShelfAt(undefined); setListOpen(true); }}>
      <Icon name="back" /> Näkymät ja tiedostot
    </button>
  ) : null;
  const closeAll = () => { setOpened(undefined); setShelfAt(undefined); if (direction === 0 || direction === 2) setListOpen(false); };
  let panel: React.ReactNode = null;
  if (opened)
    panel = (
      <div className={`ah-view-pane ac-panel-wrap${back ? ' ac-has-back' : ''}`}>
        {back}
        <ViewPanel title={`${opened.title} · ${hhmm(opened.created_at)}`} src={opened.src} expanded={false} onToggleExpanded={noop} onOpenTab={noop} onClose={closeAll} />
      </div>
    );
  else if (shelfAt || (direction === 0 && listOpen))
    panel = (
      <div className={`ah-view-pane ac-panel-wrap${back ? ' ac-has-back' : ''}`}>
        {back}
        <FileShelf offers={OFFERS} scrollTo={shelfAt} onClose={closeAll} />
      </div>
    );
  else if (direction === 2 && listOpen) panel = <AssetPane act={act} onClose={closeAll} />;

  const now = Date.now();
  const model = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/ws_m?conversation=${m.agentId}`, workspaceId: 'ws_m', workspaceName: 'myynti', activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: now - 5 * 60000, ...m,
  });
  const running: AgentNavModel[] = [
    model({agentId: 'q3', title: PARENT, selected: true, detail: 'myynti · Odottaa viestiä'}),
    model({agentId: 'budjetti', title: 'Budjetti 2027', changedAt: now - 50 * 60000, detail: 'myynti · Odottaa viestiä'}),
    model({agentId: 'crm', title: 'CRM-siivous', workspaceId: 'ws_h', workspaceName: 'fleetrepo', changedAt: now - 90 * 60000, detail: 'fleetrepo · Odottaa viestiä'}),
  ];
  const quiet: AgentNavModel[] = [
    model({agentId: 'q2', title: 'Q2-katsaus', changedAt: now - 30 * 86400000, detail: 'myynti · Odottaa viestiä'}),
  ];
  const row = (m: AgentNavModel) => <AgentNavItem key={m.agentId} {...m} now={now} />;
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Alder" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="ac-running">
            <h2 className="ah-rail-section-head" id="ac-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
            <ul>
              {running.map((m) => (
                <React.Fragment key={m.agentId}>
                  {row(m)}
                  {direction === 3 && m.selected ? <RailAssets act={act} /> : null}
                </React.Fragment>
              ))}
            </ul>
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
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} filesControl={filesControl} />
          {direction === 1 && listOpen ? <SiruPop act={act} onClose={() => setListOpen(false)} /> : null}
          <ConversationStream streamRef={stream}>
            <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
            onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={picker} />
        </ConversationFrame>
      </ViewSplit>
      {previewing && previewing.state.state === 'ready' ? (
        <OfferedFilePreview offerId={previewing.offer.offer_id} item={previewing.state.manifest.items[0]} onClose={() => setPreviewing(undefined)} />
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
        <strong>Keskustelun näkymät ja tiedostot · kierros 1</strong>
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
