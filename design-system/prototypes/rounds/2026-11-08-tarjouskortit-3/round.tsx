import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog, DialogTrigger, Menu, MenuTrigger, Popover, Switch} from 'react-aria-components';
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
import {ProcessProvider} from '../../../../web/src/components/ProcessTray';
import {formatViewSize, type ViewSummary} from '../../../../web/src/components/ViewOffer';
import {CopyButton} from '../../../../web/src/components/ViewLink';
import {ViewSplit} from '../../../../web/src/components/ViewPanel';
import {fileFacts, formatOfferSize} from '../../../../web/src/components/FileOffer';
import type {FileKind, FileOfferItem, FileOfferSummary, OfferState} from '../../../../web/src/app/fileOffers';
import type {TimelineItem} from '../../../../web/src/components/types';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import '../../../../web/src/components/EditorSplit.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-offer-cards-consistent, round 3. Jari 8.11.2026 chose round 2's
// A Viereen: the card opens its item in the right-hand panel. Pressing the
// same card again closes the panel, and the open card shows it is open.
// The riffs vary where the card's own actions live (publishing with its
// duration and Kopioi linkki, own tab, download), what replaces hover on a
// touch screen and what the panel's top bar keeps. On the default view one
// card is open and another is drawn hovered (a phone draws its touch state):
// A Kulma: small icon buttons in the card's top-right corner on hover; on
//   touch always visible; the panel's top bar has the same row;
// B Palkki: a bar with short labels along the card's bottom edge on hover,
//   pinned on the open card; long press on touch; the top bar has only ✕;
// C Jako: a lock or globe always on the card opens sharing, ⋯ on hover holds
//   own tab and download; on touch ⋯ moves to the panel's top bar.
const directions = ['A Kulma', 'B Palkki', 'C Jako'];
const LINES = [
  'A Kulma: hiiren alla kortin oikeaan yläkulmaan pienet kuvakkeet (julkinen, välilehti, lataus); kosketuksella aina näkyvissä; paneelin yläpalkissa sama rivi.',
  'B Palkki: hiiren alla kortin alareunaan palkki lyhyin sanoin, avatussa kortissa pysyvästi; kosketuksella pitkä painallus; paneelissa vain ✕.',
  'C Jako: kortissa aina lukko tai maapallo, joka avaa jakamisen; ⋯ hiiren alla (välilehti, lataus); kosketuksella ⋯ on paneelin yläpalkissa.',
];


// ---- The story: a customer survey, two views and four file offers ----
const PARENT = 'Asiakaskysely syksy 2026';
const CONVO = 'pi:7a2c9e10-3b4d-4f5e-8a61-0c9d2e7b4f21';
const today = (hm: string) => { const [h, m] = hm.split('.').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const hhmm = (iso: string) => { const d = new Date(iso); return `${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`; };
const inDays = (n: number) => { const d = new Date(Date.now() + n * 86400000); return d; };
const dayLabel = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;

type Bar = [string, number];
const css = (dark: boolean) => {
  const bg = dark ? '#14171c' : '#fbfaf7', ink = dark ? '#e7e9ee' : '#1d2026', soft = dark ? '#9aa3b2' : '#5b6170', bar = dark ? '#6aa7ff' : '#2f6fdb';
  return {bg, ink, soft, bar};
};
function report(title: string, lead: string, bars: Bar[], note: string) {
  const c = css(false), max = Math.max(...bars.map((b) => b[1]));
  const rows = bars.map(([k, v]) => `<div class=r><span>${k}</span><i style="width:${Math.round((v / max) * 100)}%"></i><b>${v}</b></div>`).join('');
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:28px 32px;background:${c.bg};color:${c.ink};font:15px/1.5 system-ui,sans-serif}h1{font-size:22px;margin:0 0 4px}p{color:${c.soft};margin:0 0 20px}.r{display:grid;grid-template-columns:150px 1fr 60px;align-items:center;gap:10px;margin:8px 0}.r i{display:block;height:14px;border-radius:3px;background:${c.bar}}.r b{text-align:right;font-weight:600}small{display:block;margin-top:22px;color:${c.soft}}</style><h1>${title}</h1><p>${lead}</p>${rows}<small>${note}</small>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
function chart(title: string, bars: Bar[], hue: string) {
  const max = Math.max(...bars.map((b) => b[1]));
  const w = 800, h = 450, bw = Math.floor(560 / bars.length);
  const cols = bars.map(([k, v], i) => {
    const bh = Math.round((v / max) * 290), x = 150 + i * bw;
    return `<rect x="${x}" y="${380 - bh}" width="${bw - 24}" height="${bh}" rx="4" fill="${hue}"/><text x="${x + (bw - 24) / 2}" y="406" text-anchor="middle" font-size="16" fill="#5b6170">${k}</text><text x="${x + (bw - 24) / 2}" y="${370 - bh}" text-anchor="middle" font-size="16" font-weight="600" fill="#1d2026">${v}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fbfaf7"/><text x="40" y="52" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#1d2026">${title}</text><g font-family="system-ui,sans-serif">${cols}</g><line x1="130" y1="380" x2="760" y2="380" stroke="#c9ccd3"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const CHARTS: Record<string, string> = {
  'suosittelu.png': chart('Suosittelisitko meitä? (n = 212)', [['Kyllä', 128], ['Ehkä', 51], ['Ei', 33]], '#2f6fdb'),
  'kaaviot/suosittelu.png': chart('Suosittelisitko meitä? (n = 212)', [['Kyllä', 128], ['Ehkä', 51], ['Ei', 33]], '#2f6fdb'),
  'kaaviot/tyytyvaisyys.png': chart('Tyytyväisyys palveluun', [['1', 8], ['2', 14], ['3', 41], ['4', 92], ['5', 57]], '#2a9d8f'),
  'kaaviot/kehityskohteet.png': chart('Useimmin mainitut kehityskohteet', [['Toimitus', 74], ['Hinta', 52], ['Tuki', 39]], '#e07a5f'),
  'kaaviot/kanavat.png': chart('Mistä kuulit meistä?', [['Suositus', 88], ['Haku', 61], ['Some', 40], ['Messut', 23]], '#8d6cc8'),
  'kaaviot/alueet.png': chart('Vastaajat alueittain', [['Uusimaa', 97], ['Pirkanmaa', 44], ['V-Suomi', 38], ['Muu', 33]], '#3d8b5a'),
};

type View = ViewSummary & {src: string; publicUntil?: Date};
const view = (n: number, title: string, entry: string, at: string, src: string, files: number, bytes: number, publicUntil?: Date): View =>
  ({view_id: `v${'abcdefghijklmnopqrstuvwxyz'.slice(n, n + 26).padEnd(26, 'q')}`, title, entry, files, bytes, created_at: today(at), conversation_id: CONVO, src, publicUntil});
const V1 = view(1, 'Asiakaskyselyn yhteenveto', 'reports/yhteenveto.html', '11.20',
  report('Asiakaskyselyn yhteenveto', '212 vastausta · suositteluhalukkuus', [['Suosittelisi', 128], ['Neutraali', 51], ['Ei suosittelisi', 33]], 'Kolme useimmin mainittua kehityskohdetta: toimitusaika, hinta, tuen tavoitettavuus.'), 1, 48000);
const V2 = view(2, 'Tulokset asiakkaille', 'reports/asiakkaille.html', '12.40',
  report('Kiitos vastauksistanne!', 'Näin kehitämme palvelua syksyn kyselyn perusteella', [['Nopeampi toimitus', 74], ['Selkeämpi hinnasto', 52], ['Chat-tuki', 39]], 'Julkinen sivu, jonka linkki lähetetään vastaajille.'), 3, 126000, inDays(14));

type Offer = {offer: FileOfferSummary; state: OfferState};
const offer = (n: number, title: string, at: string, items: FileOfferItem[], folder?: string): Offer => {
  const o: FileOfferSummary = {offer_id: `f${'bcdefghijklmnopqrstuvwxyz2'.slice(n, n + 26).padEnd(26, 'q')}`, title, folder, files: items.length,
    bytes: items.reduce((s, i) => s + i.bytes, 0), created_at: today(at), conversation_id: CONVO};
  return {offer: o, state: {state: 'ready', manifest: {offer: o, items}}};
};
const F1 = offer(1, 'Vastaukset siivottuina', '11.35', [{path: 'kysely-siivottu.csv', bytes: 31400, kind: 'csv', lines: 213, columns: 14}]);
const F2 = offer(2, 'Suositteluhalukkuus kaaviona', '12.05', [{path: 'suosittelu.png', bytes: 84200, kind: 'image', width: 1600, height: 900}]);
const F3 = offer(3, 'Kyselyraportti', '13.10', [{path: 'kyselyraportti.pdf', bytes: 412000, kind: 'pdf'}]);
const F4 = offer(4, 'Kaaviot esitykseen', '13.25', [
  {path: 'kaaviot/suosittelu.png', bytes: 84200, kind: 'image', width: 1600, height: 900},
  {path: 'kaaviot/tyytyvaisyys.png', bytes: 79100, kind: 'image', width: 1600, height: 900},
  {path: 'kaaviot/kehityskohteet.png', bytes: 72800, kind: 'image', width: 1600, height: 900},
  {path: 'kaaviot/kanavat.png', bytes: 75400, kind: 'image', width: 1600, height: 900},
  {path: 'kaaviot/alueet.png', bytes: 70300, kind: 'image', width: 1600, height: 900},
], 'kaaviot');
const OFFERS = [F4, F3, F2, F1];
const FILE_COUNT = OFFERS.reduce((n, o) => n + o.offer.files, 0);
const itemsOf = (o: Offer) => (o.state.state === 'ready' ? o.state.manifest.items : []);

// Offered images load through the offer's inline route, which this page has
// no host for: point those addresses at the drawn charts as they appear.
const drawn = (src: string | null) => {
  const at = src?.indexOf('/inline/') ?? -1;
  return src && at >= 0 ? CHARTS[decodeURIComponent(src.slice(at + 8))] : undefined;
};
const redraw = (img: Element) => { const d = drawn(img.getAttribute('src')); if (d) img.setAttribute('src', d); };
new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'attributes') redraw(r.target as Element);
    r.addedNodes.forEach((n) => { if (n instanceof Element) { if (n.tagName === 'IMG') redraw(n); n.querySelectorAll('img').forEach(redraw); } });
  }
}).observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['src']});

// The offered files' content for production's preview dialog; every other request 404s.
const CSV_ROWS = [
  ['vastaus', 'pvm', 'alue', 'asiakkuus', 'suosittelisi', 'tyytyväisyys', 'kehityskohde'],
  ['1', '2026-09-02', 'Uusimaa', 'yli 3 v', 'kyllä', '5', 'toimitusaika'],
  ['2', '2026-09-02', 'Pirkanmaa', '1–3 v', 'ehkä', '4', 'hinta'],
  ['3', '2026-09-03', 'Uusimaa', 'alle 1 v', 'kyllä', '4', '—'],
  ['4', '2026-09-03', 'Varsinais-Suomi', 'yli 3 v', 'ei', '2', 'tuen tavoitettavuus'],
  ['5', '2026-09-04', 'Uusimaa', '1–3 v', 'kyllä', '5', 'toimitusaika'],
  ['6', '2026-09-04', 'Muu', 'alle 1 v', 'ehkä', '3', 'hinta'],
  ['7', '2026-09-05', 'Pirkanmaa', 'yli 3 v', 'kyllä', '4', 'chat-tuki'],
  ['8', '2026-09-05', 'Uusimaa', '1–3 v', 'kyllä', '5', '—'],
];
const CSV = CSV_ROWS.map((r) => r.join(';')).join('\n') + '\n';
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path.endsWith('/processes'))
    return new Response(JSON.stringify({schema_version: 1, owner_generation: 'og', availability: 'available', unavailable_reason: null, processes: [], interrupted: []}), {headers: {'content-type': 'application/json'}});
  if (path.includes('/file-offers/') && path.endsWith('.csv')) return new Response(CSV, {headers: {'content-type': 'text/csv'}});
  return new Response('', {status: 404});
};

// ---- One offer, whatever its kind: what the directions' cards and panel show ----
type Kind = 'view' | FileKind | 'folder';
type Asset =
  | {type: 'view'; id: string; title: string; at: string; kind: 'view'; view: View}
  | {type: 'file'; id: string; title: string; at: string; kind: Kind; offer: Offer};
const asView = (v: View): Asset => ({type: 'view', id: v.view_id, title: v.title, at: v.created_at, kind: 'view', view: v});
const asFile = (o: Offer): Asset => {
  const items = itemsOf(o);
  return {type: 'file', id: o.offer.offer_id, title: o.offer.title, at: o.offer.created_at, kind: items.length === 1 ? items[0].kind : 'folder', offer: o};
};
const ASSETS: Asset[] = [asView(V1), asFile(F1), asFile(F2), asView(V2), asFile(F3), asFile(F4)];
const NEWEST = [...ASSETS].sort((a, b) => b.at.localeCompare(a.at));

const kindIcon: Record<FileKind, IconName> = {image: 'image', svg: 'image', video: 'film', audio: 'music', markdown: 'file', pdf: 'file',
  docx: 'file', pptx: 'file', xlsx: 'table', csv: 'table', code: 'code', text: 'file', zip: 'package', file: 'file'};
const kindGroup = (k: Kind) => (k === 'image' || k === 'svg' || k === 'video' || k === 'audio' ? 'media'
  : k === 'markdown' || k === 'pdf' || k === 'docx' || k === 'pptx' ? 'document'
  : k === 'xlsx' || k === 'csv' || k === 'code' || k === 'text' ? 'data' : 'other');
const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** The production marks: `</>` for a view, the file kind's icon otherwise. */
function Mark({a, size = 'm'}: {a: Asset; size?: 'm' | 's' | 'xs'}) {
  if (a.type === 'view') return <span className={`ah-view-offer-mark oc-mark-${size}`} aria-hidden="true">{'</>'}</span>;
  const icon: IconName = a.kind === 'folder' ? 'folder' : kindIcon[a.kind as FileKind];
  return <span className={`ah-file-offer-mark oc-mark-${size}`} data-group={kindGroup(a.kind)} aria-hidden="true"><Icon name={icon} /></span>;
}

/** Kind and size, the same words production's cards use. */
function facts(a: Asset): string[] {
  if (a.type === 'view') {
    const v = a.view;
    return ['Näkymä', ...(v.files > 1 ? [`${v.files} tiedostoa`] : []), formatViewSize(v.bytes)];
  }
  const items = itemsOf(a.offer);
  if (items.length === 1) return fileFacts(items[0]);
  return [`Kansio ${a.offer.offer.folder}/`, `${a.offer.offer.files} tiedostoa`, formatOfferSize(a.offer.offer.bytes)];
}
const kindWord = (a: Asset) => facts(a)[0];

/** Who sees it: a lock for the person only, a globe while it is public. */
function Seen({until, words = true}: {until?: Date | null; words?: boolean}) {
  const label = until ? `Julkinen ${dayLabel(until)} asti` : 'Vain sinulle';
  return (
    <span className="oc-seen" data-public={until ? 'true' : undefined} title={label} aria-label={words ? undefined : label}>
      <Icon name={until ? 'globe' : 'lock'} />{words ? <span>{label}</span> : null}
    </span>
  );
}

function Thumb({a, path}: {a: Asset; path?: string}) {
  if (a.type !== 'file') return null;
  const p = path ?? itemsOf(a.offer)[0]?.path;
  return CHARTS[p] ? <img className="oc-thumb" src={CHARTS[p]} alt="" /> : null;
}

// ---- What an opened item shows, wherever it opens ----
function Body({a, sub, onSub}: {a: Asset; sub?: string; onSub: (p: string) => void}) {
  if (a.type === 'view') return <iframe className="oc-frame" title={a.title} src={a.view.src} sandbox="" />;
  const items = itemsOf(a.offer);
  const item = sub ? items.find((i) => i.path === sub) : items.length === 1 ? items[0] : undefined;
  if (!item)
    return (
      <ul className="oc-folder" data-testid="oc-folder">
        {items.map((i) => (
          <li key={i.path}>
            <button type="button" data-testid="oc-folder-row" onClick={() => onSub(i.path)}>
              <img src={CHARTS[i.path]} alt="" />
              <span className="oc-text"><span className="oc-name">{baseName(i.path)}</span><span className="oc-facts">{fileFacts(i).slice(1).join(' · ')}</span></span>
            </button>
          </li>
        ))}
      </ul>
    );
  if (item.kind === 'image') return <div className="oc-image"><img src={CHARTS[item.path]} alt={baseName(item.path)} /></div>;
  if (item.kind === 'csv')
    return (
      <div className="oc-table-wrap">
        <table className="oc-table" data-testid="oc-table">
          <thead><tr>{CSV_ROWS[0].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{CSV_ROWS.slice(1).map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
        </table>
        <p className="oc-note">8 ensimmäistä riviä 212:sta</p>
      </div>
    );
  return (
    <div className="oc-doc" data-testid="oc-doc">
      <article className="oc-page">
        <h1>Asiakaskysely syksy 2026</h1>
        <p className="oc-sub">Raportti johtoryhmälle · 6 sivua</p>
        <h2>Yhteenveto</h2>
        <p>Kyselyyn vastasi 212 asiakasta 2.–20.9.2026. Vastaajista 60 % suosittelisi palvelua, 24 % on neutraaleja ja 16 % ei suosittelisi. Suositteluindeksi on +44, kuusi pistettä keväästä.</p>
        <img src={CHARTS['suosittelu.png']} alt="" />
        <h2>Kehityskohteet</h2>
        <p>Useimmin mainittiin toimitusaika (74 mainintaa), hinnaston selkeys (52) ja tuen tavoitettavuus (39).</p>
      </article>
      <article className="oc-page">
        <h2>Suositukset</h2>
        <p>1. Lyhennetään toimitusaikaa pääkaupunkiseudulla. 2. Yksinkertaistetaan hinnasto kolmeen tasoon. 3. Avataan chat-tuki arkipäivisin.</p>
      </article>
    </div>
  );
}

// ---- Who sees it: one public state per item, the same for every kind ----
// The switch publishes at once for 30 days, as the view card does today;
// the date opens the durations. The address is the item's one stable
// address, the same one its own tab opens.
type Pub = {until: (id: string) => Date | null; set: (id: string, until: Date | null) => void};
const PubContext = React.createContext<Pub>({until: () => null, set: () => {}});
const usePub = () => React.useContext(PubContext);
const DURATIONS: [number, string][] = [[1, '1 päivä'], [7, '1 viikko'], [14, '2 viikkoa'], [30, '30 päivää']];
const entryOf = (a: Asset) => `${a.id.slice(1, 7)}Kq2mRt${a.id.slice(7, 13)}`;
const addressOf = (a: Asset) => `https://alder.example/n/${entryOf(a)}`;

function UntilMenu({a, until, short = false}: {a: Asset; until: Date; short?: boolean}) {
  const p = usePub();
  return (
    <MenuTrigger>
      <ControlButton size="row" variant="quiet" className="ah-view-offer-until" data-testid="oc-until" title="Muuta, kuinka kauan se on julkinen">
        {dayLabel(until)}{short ? '' : ' asti'}<span aria-hidden="true" className="ah-menu-chevron" />
      </ControlButton>
      <Popover placement="bottom end" className="ah-popover ah-view-offer-durations">
        <Menu aria-label="Julkisuuden kesto" onAction={(k) => p.set(a.id, inDays(Number(k)))}>
          {DURATIONS.map(([n, label]) => (
            <ControlMenuItem key={n} id={String(n)} className="ah-single-choice-item" textValue={label}>
              <span className="ah-single-choice-mark" aria-hidden="true" />
              <span className="ah-view-offer-duration">{label}</span>
              <span className="ah-view-offer-duration-ends">{dayLabel(inDays(n))} asti</span>
            </ControlMenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** The view card's sharing today, for every kind: Julkinen, its date, Kopioi linkki. */
function ShareControls({a}: {a: Asset}) {
  const p = usePub(), until = p.until(a.id);
  return (
    <span className="oc-share" data-testid="oc-share" data-public={until ? 'true' : undefined}>
      <Switch className="ah-view-offer-switch" data-testid="oc-public" isSelected={!!until} onChange={(on) => p.set(a.id, on ? inDays(30) : null)}>
        <span title={until ? 'Kuka tahansa linkin saanut voi avata' : 'Vain sinä näet tämän'}>Julkinen</span>
        <span className="ah-view-offer-track" aria-hidden="true" />
      </Switch>
      {until ? (
        <>
          <UntilMenu a={a} until={until} />
          <CopyButton text={addressOf(a)} data-testid="oc-copy" />
        </>
      ) : <Seen until={null} />}
    </span>
  );
}

/** C: the card's own mark, a lock or a globe and its date, opens the same controls. */
function SharePill({a}: {a: Asset}) {
  const until = usePub().until(a.id);
  const label = until ? `Julkinen ${dayLabel(until)} asti` : 'Vain sinulle';
  return (
    <DialogTrigger>
      <ControlButton size="row" variant="quiet" className="oc-pill" data-testid="oc-pill" data-public={until ? 'true' : undefined} aria-label={`${label}. Jakaminen`}>
        <Icon name={until ? 'globe' : 'lock'} />{until ? <span>{dayLabel(until)} asti</span> : null}
      </ControlButton>
      <Popover placement="bottom end" className="ah-popover oc-share-pop">
        <Dialog className="oc-share-dialog" data-testid="oc-share-pop" aria-label={`Jakaminen: ${a.title}`}>
          <span className="oc-share-head"><Mark a={a} size="xs" /><strong>{a.title}</strong></span>
          <ShareControls a={a} />
          {until ? <span className="oc-address">{addressOf(a).replace('https://', '')}</span> : null}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}


// ---- What the card and the panel can do with an item ----
type Opener = {toggle: (a: Asset) => void; openedId?: string; tab: (a: Asset) => void; download: (a: Asset) => void};
const downloadLabel = (a: Asset) => (a.kind === 'folder' ? 'Lataa kaikki (.zip)' : a.type === 'view' ? 'Lataa (.zip)' : 'Lataa');
const fileName = (a: Asset) => (a.type === 'view' ? `${a.title}.zip` : a.kind === 'folder' ? `${a.offer.offer.folder}.zip` : baseName(itemsOf(a.offer)[0].path));

/** A: small icon buttons. The globe publishes for 30 days at once, as the
 * Julkinen switch does; while public the date opens the durations and the
 * link icon copies the address. */
function IconRow({a, o}: {a: Asset; o: Opener}) {
  const p = usePub(), until = p.until(a.id);
  return (
    <span className="oc-icons" data-testid="oc-acts">
      <ControlButton size="row" variant="quiet" className="oc-ib" data-testid="oc-public" data-public={until ? 'true' : undefined} aria-pressed={!!until}
        aria-label="Julkinen" title={until ? `Julkinen ${dayLabel(until)} asti. Paina, niin vain sinä näet tämän.` : 'Vain sinulle. Paina, niin se on julkinen 30 päivää.'}
        onPress={() => p.set(a.id, until ? null : inDays(30))}>
        <Icon name="globe" />
      </ControlButton>
      {until ? <><UntilMenu a={a} until={until} short /><CopyButton text={addressOf(a)} data-testid="oc-copy" iconOnly /></> : null}
      <ControlButton size="row" variant="quiet" className="oc-ib" data-testid="oc-act-tab" aria-label="Avaa omalle välilehdelle" title="Avaa omalle välilehdelle" onPress={() => o.tab(a)}>
        <Icon name="external" />
      </ControlButton>
      <ControlButton size="row" variant="quiet" className="oc-ib" data-testid="oc-act-download" aria-label={downloadLabel(a)} title={downloadLabel(a)} onPress={() => o.download(a)}>
        <Icon name="download" />
      </ControlButton>
    </span>
  );
}

/** B: the same actions with short words: round 2's sharing control, Välilehti and Lataa. */
function Bar({a, o}: {a: Asset; o: Opener}) {
  return (
    <span className="oc-bar" data-testid="oc-acts">
      <ShareControls a={a} />
      <span className="oc-bar-end">
        <ControlButton size="row" variant="quiet" className="oc-lb" data-testid="oc-act-tab" title="Avaa omalle välilehdelle" onPress={() => o.tab(a)}>
          <Icon name="external" /> Välilehti
        </ControlButton>
        <ControlButton size="row" variant="quiet" className="oc-lb" data-testid="oc-act-download" title={downloadLabel(a)} onPress={() => o.download(a)}>
          <Icon name="download" /> Lataa
        </ControlButton>
      </span>
    </span>
  );
}

/** C: ⋯ holds what is not sharing: own tab, download, and the link while public. */
function MoreMenu({a, o}: {a: Asset; o: Opener}) {
  const until = usePub().until(a.id);
  return (
    <MenuTrigger>
      <ControlButton size="row" variant="quiet" className="oc-ib oc-more" data-testid="oc-more" aria-label={`Lisää: ${a.title}`} title="Lisää">
        <Icon name="more" />
      </ControlButton>
      <Popover placement="bottom end" className="ah-popover oc-more-pop">
        <Menu aria-label={`Toiminnot: ${a.title}`} data-testid="oc-more-menu"
          onAction={(k) => (k === 'tab' ? o.tab(a) : k === 'download' ? o.download(a) : void navigator.clipboard?.writeText(addressOf(a)).catch(() => {}))}>
          <ControlMenuItem id="tab" data-testid="oc-act-tab" textValue="Avaa omalle välilehdelle"><span className="oc-mi"><Icon name="external" /> Avaa omalle välilehdelle</span></ControlMenuItem>
          <ControlMenuItem id="download" data-testid="oc-act-download" textValue={downloadLabel(a)}><span className="oc-mi"><Icon name="download" /> {downloadLabel(a)}</span></ControlMenuItem>
          {until ? <ControlMenuItem id="copy" textValue="Kopioi linkki"><span className="oc-mi"><Icon name="copy" /> Kopioi linkki</span></ControlMenuItem> : null}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

// ---- The card: round 2's A, one press opens beside and the same press closes ----
type CardState = {hovered: boolean; pressed: boolean; touch: boolean};
function Card({a, o, d, st, onLongPress, onHoverEnd}: {a: Asset; o: Opener; d: number; st: CardState; onLongPress: (id: string) => void; onHoverEnd: () => void}) {
  const until = usePub().until(a.id);
  const open = o.openedId === a.id;
  const timer = useRef<number>();
  const longed = useRef(false);
  const strip = a.kind === 'folder' ? (
    <span className="oc-strip">{itemsOf((a as Extract<Asset, {type: 'file'}>).offer).slice(0, 5).map((i) => <img key={i.path} src={CHARTS[i.path]} alt="" />)}</span>
  ) : null;
  // B on touch: a long press shows the bar in place; the press that follows does not open.
  const long = d === 1 && st.touch ? {
    onPointerDown: () => { longed.current = false; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { longed.current = true; onLongPress(a.id); }, 450); },
    onPointerUp: () => window.clearTimeout(timer.current),
    onPointerCancel: () => window.clearTimeout(timer.current),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  } : {};
  const acts = d === 0 ? <IconRow a={a} o={o} />
    : d === 1 ? <Bar a={a} o={o} />
    : <span className="oc-cside"><SharePill a={a} />{st.touch ? null : <MoreMenu a={a} o={o} />}</span>;
  return (
    <div className={`oc-card oc3 oc3-${'abc'[d]}`} data-testid="oc-card" data-kind={a.kind} data-asset={a.id}
      data-open={open || undefined} data-hover={st.hovered || undefined} data-pressed={st.pressed || undefined} data-touch={st.touch || undefined}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') onHoverEnd(); }}>
      <button type="button" className="oc-hit" data-testid="oc-hit" aria-expanded={open}
        aria-label={open ? `Sulje: ${a.title}` : `Avaa: ${a.title}`} title={open ? 'Sulje paneeli' : 'Avaa viereen'}
        onClick={() => { if (longed.current) { longed.current = false; return; } o.toggle(a); }} {...long} />
      <Mark a={a} />
      <span className="oc-body">
        <strong className="oc-title">{a.title}</strong>
        <span className="oc-facts">{facts(a).join(' · ')}{d === 2 ? null : <> · <Seen until={until} words={false} /></>}</span>
        {a.kind === 'image' ? <Thumb a={a} /> : null}
        {strip}
      </span>
      {acts}
      <span className="oc-chev" aria-hidden="true"><Icon name="forward" className="oc-chev-go" /><Icon name="cross" className="oc-chev-x" /></span>
    </div>
  );
}

// ---- The panel's top bar: what each riff keeps there ----
type Shown = {a: Asset; sub?: string};
function TopBar({s, d, o, phone, onSub, onBack, onClose}: {s: Shown; d: number; o: Opener; phone: boolean; onSub: (p?: string) => void; onBack: () => void; onClose: () => void}) {
  const {a, sub} = s;
  const close = (
    <ControlButton size="row" variant="quiet" className="oc-ib" data-testid="oc-panel-close" aria-label="Sulje" title="Sulje" onPress={onClose}><Icon name="cross" /></ControlButton>
  );
  return (
    <>
      <button type="button" className="oc-back" data-testid="oc-back" onClick={sub ? () => onSub(undefined) : onBack}>
        <Icon name="back" /> {sub ? `${(a as Extract<Asset, {type: 'file'}>).offer.offer.folder}/` : 'Näkymät ja tiedostot'}
      </button>
      <header className="oc-pane-head" data-riff={'abc'[d]}>
        <Mark a={a} size="s" />
        <span className="oc-pane-title">
          <h2 className="ah-view-title" data-testid="oc-panel-title">{sub ? baseName(sub) : a.title}</h2>
          <span className="oc-facts">{facts(a).join(' · ')} · {hhmm(a.at)}</span>
        </span>
        <span className="oc-pane-tools" data-testid="oc-panel-tools">
          {d === 0 ? <IconRow a={a} o={o} /> : d === 2 ? <><SharePill a={a} /><MoreMenu a={a} o={o} /></> : null}
          {close}
        </span>
      </header>
      {d === 1 && phone ? <div className="oc-pane-bar"><Bar a={a} o={o} /></div> : null}
    </>
  );
}

function ItemPane({s, d, o, phone, onSub, onBack, onClose}: {s: Shown; d: number; o: Opener; phone: boolean; onSub: (p?: string) => void; onBack: () => void; onClose: () => void}) {
  return (
    <section className="ah-view-pane oc-pane" data-testid="oc-panel" data-kind={s.a.kind} aria-label={s.a.title}>
      <TopBar s={s} d={d} o={o} phone={phone} onSub={onSub} onBack={onBack} onClose={onClose} />
      <div className="oc-pane-body"><Body a={s.a} sub={s.sub} onSub={onSub} /></div>
    </section>
  );
}

/** The conversation's views and files, as proto-conversation-assets lists them. */
function ListPane({o, onClose}: {o: Opener; onClose: () => void}) {
  const pub = usePub();
  return (
    <section className="ah-view-pane oc-pane" data-testid="oc-list" aria-label="Keskustelun näkymät ja tiedostot">
      <header className="oc-pane-head">
        <span className="oc-pane-title"><h2 className="ah-view-title">Näkymät ja tiedostot</h2></span>
        <span className="oc-pane-tools">
          <ControlButton size="row" variant="quiet" className="oc-ib" aria-label="Sulje" title="Sulje" onPress={onClose}><Icon name="cross" /></ControlButton>
        </span>
      </header>
      <ul className="oc-list">
        {NEWEST.map((a) => (
          <li key={a.id}>
            <button type="button" data-testid="oc-list-row" onClick={() => o.toggle(a)}>
              <Mark a={a} size="s" />
              <span className="oc-text"><span className="oc-name">{a.title}</span><span className="oc-facts">{kindWord(a)}</span></span>
              <Seen until={pub.until(a.id)} words={false} />
              <span className="oc-facts">{hhmm(a.at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Avaa omalle välilehdelle, for every kind: the item's stable address in a
 * tab of its own. The browser chrome is drawn; the page under it is what
 * the host would show there, and to anyone while the item is public. */
function TabMock({s, onClose}: {s: Shown; onClose: () => void}) {
  const {a, sub} = s;
  return (
    <div className="oc-tabmock" data-testid="oc-tab" data-kind={a.kind} role="region" aria-label="Uusi välilehti (kuvitettu)">
      <div className="oc-tabmock-strip">
        <button type="button" className="oc-tabmock-tab" data-testid="oc-tab-back" onClick={onClose}>{PARENT} – Open Habitat</button>
        <span className="oc-tabmock-tab" data-active="true">
          <Mark a={a} size="xs" /><span className="oc-name">{sub ? baseName(sub) : a.title}</span>
          <button type="button" className="oc-tabmock-x" data-testid="oc-tab-close" aria-label="Sulje välilehti" onClick={onClose}><Icon name="cross" /></button>
        </span>
      </div>
      <div className="oc-tabmock-address"><Icon name="lock" /><span>alder.example/n/<b>{entryOf(a)}</b>{sub ? `/${baseName(sub)}` : ''}</span></div>
      <div className="oc-tabpage">
        <header className="oc-tabpage-head">
          <Mark a={a} size="s" />
          <span className="oc-pane-title">
            <h1 className="ah-view-title">{sub ? baseName(sub) : a.title}</h1>
            <span className="oc-facts">{facts(a).join(' · ')}</span>
          </span>
          <ShareControls a={a} />
          <ControlButton size="row" variant="quiet" aria-label="Lataa" title="Lataa" onPress={() => {}}><Icon name="download" /></ControlButton>
        </header>
        <div className="oc-tabpage-body"><Body a={a} sub={sub} onSub={() => {}} /></div>
      </div>
    </div>
  );
}

// ---- The conversation ----
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'kysely',
};
const picker = <button type="button" className="md-pill">Claude Opus 5.5 · high</button>;
const userItem = (id: string, text: string, time: string): TimelineItem & {kind: string} => ({id, kind: 'user', content: <UserMessage sourceText={text} onCopy={noop} time={time}><Markdown text={text} /></UserMessage>});
const agentItem = (id: string, text: string, time: string): TimelineItem & {kind: string} =>
  ({id, kind: 'assistant', content: <AssistantMessage streamState="complete" time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>});

type Open = {kind: 'asset'; id: string; sub?: string} | {kind: 'list'};
const PHONE = 760;
function usePhone() {
  const [phone, setPhone] = useState(() => innerWidth <= PHONE);
  useEffect(() => { const on = () => setPhone(innerWidth <= PHONE); addEventListener('resize', on); return () => removeEventListener('resize', on); }, []);
  return phone;
}

// The default view: on desktop the PDF is open and the public thank-you view
// is drawn hovered; a phone opens nothing and draws its touch state (B: the
// long-pressed bar on the PDF card, the one in view).
const OPEN_FIRST = F3.offer.offer_id;
const HOVER_FIRST = V2.view_id;

function Main({direction: d}: {direction: number}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLElement>(null);
  const phone = usePhone();
  const touch = phone || matchMedia('(hover: none)').matches;
  const [open, setOpen] = useState<Open | undefined>(phone ? undefined : {kind: 'asset', id: OPEN_FIRST});
  const [demo, setDemo] = useState<string | undefined>(touch ? undefined : HOVER_FIRST);
  const [pressed, setPressed] = useState<string | undefined>(touch && d === 1 ? OPEN_FIRST : undefined);
  const [tab, setTab] = useState<Shown>();
  const [toast, setToast] = useState<string>();
  const [width, setWidth] = useState(() => Math.round(Math.max(innerWidth - 300, 0) * 0.46));
  const openedId = open?.kind === 'asset' ? open.id : undefined;
  const o: Opener = {
    toggle: (a) => { setPressed(undefined); setOpen(openedId === a.id ? undefined : {kind: 'asset', id: a.id}); },
    openedId,
    tab: (a) => setTab({a, sub: open?.kind === 'asset' && open.id === a.id ? open.sub : undefined}),
    download: (a) => setToast(`Ladataan ${fileName(a)}`),
  };
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(undefined), 2400); return () => clearTimeout(t); }, [toast]);
  // A long-pressed bar stays until a press lands elsewhere.
  useEffect(() => {
    if (!pressed) return;
    const away = (e: PointerEvent) => { if (!(e.target as Element).closest?.(`[data-asset="${pressed}"], .ah-popover`)) setPressed(undefined); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [pressed]);
  useLayoutEffect(() => {
    const bottom = () => { const el = stream.current; if (el) el.scrollTop = el.scrollHeight; };
    bottom();
    const timers = [0, 80, 250].map((t) => window.setTimeout(bottom, t));
    return () => timers.forEach(clearTimeout);
  }, []);

  const notice = (a: Asset) => ({id: a.id, kind: 'notice', content: (
    <Card a={a} o={o} d={d} st={{hovered: demo === a.id, pressed: pressed === a.id, touch}} onLongPress={setPressed} onHoverEnd={() => setDemo(undefined)} />
  )});
  const [A1, A2, A3, A4, A5, A6] = ASSETS;
  const items = [
    userItem('u1', 'Syksyn asiakaskyselyn vastaukset ovat tiedostossa `data/kysely-2026.xlsx`. Tee niistä yhteenveto.', '11.12'),
    agentItem('a1', 'Vastauksia on 212. Yhteenvedossa on suositteluhalukkuus ja kolme useimmin mainittua kehityskohdetta.', '11.20'),
    notice(A1),
    agentItem('a1b', 'Siivosin samalla vastaukset: poistin tuplat ja yhtenäistin aluenimet. Tässä siivottu taulukko:', '11.35'),
    notice(A2),
    userItem('u2', 'Tarvitsen suositteluhalukkuudesta kaavion maanantain esitykseen.', '12.00'),
    agentItem('a2', 'Tässä kaavio 16:9-kokoisena, sopii suoraan diaan.', '12.05'),
    notice(A3),
    userItem('u3', 'Tee vastaajille julkinen kiitossivu, jossa kerrotaan mitä muutamme. Linkki lähtee sähköpostissa.', '12.30'),
    agentItem('a3', 'Kiitossivu on valmis ja julkinen kaksi viikkoa. Siinä ei ole yksittäisiä vastauksia eikä vastaajien tietoja.', '12.40'),
    notice(A4),
    userItem('u4', 'Kokoa vielä raportti johtoryhmälle PDF:nä ja anna kaikki kaaviot erikseen.', '13.00'),
    agentItem('a4', 'Raportissa on kuusi sivua: yhteenveto, kaaviot, kehityskohteet ja suositukset.', '13.10'),
    notice(A5),
    agentItem('a4b', 'Ja kaikki viisi kaaviota yhdessä kansiossa:', '13.25'),
    notice(A6),
  ];

  const chip = (
    <ControlButton data-testid="oc-chip" size="row" variant="quiet" className="oc-chip" aria-label={`Näkymät 2, tiedostot ${OFFERS.length}`}
      title="Keskustelun näkymät ja tiedostot" aria-pressed={open?.kind === 'list'} onPress={() => setOpen(open?.kind === 'list' ? undefined : {kind: 'list'})}>
      <span className="oc-count-view" aria-hidden="true">{'</>'}</span><span>2</span><Icon name="file" /><span>{OFFERS.length}</span>
    </ControlButton>
  );

  const close = () => setOpen(undefined);
  let pane: React.ReactNode = null;
  if (open?.kind === 'list') pane = <ListPane o={o} onClose={close} />;
  else if (open?.kind === 'asset') {
    const a = ASSETS.find((x) => x.id === open.id)!;
    pane = <ItemPane key={a.id} s={{a, sub: open.sub}} d={d} o={o} phone={phone} onSub={(p) => setOpen({kind: 'asset', id: a.id, sub: p})}
      onBack={() => setOpen({kind: 'list'})} onClose={close} />;
  }

  const now = Date.now();
  const model = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/ws_k?conversation=${m.agentId}`, workspaceId: 'ws_k', workspaceName: 'kysely', activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: now - 5 * 60000, ...m,
  });
  const running: AgentNavModel[] = [
    model({agentId: 'syksy', title: PARENT, selected: true, detail: 'kysely · Odottaa viestiä'}),
    model({agentId: 'uutiskirje', title: 'Marraskuun uutiskirje', changedAt: now - 50 * 60000, detail: 'kysely · Odottaa viestiä'}),
    model({agentId: 'crm', title: 'CRM-siivous', workspaceId: 'ws_h', workspaceName: 'fleetrepo', changedAt: now - 90 * 60000, detail: 'fleetrepo · Odottaa viestiä'}),
  ];
  const quiet: AgentNavModel[] = [model({agentId: 'kevat', title: 'Asiakaskysely kevät 2026', changedAt: now - 180 * 86400000, detail: 'kysely · Odottaa viestiä'})];
  const row = (m: AgentNavModel) => <AgentNavItem key={m.agentId} {...m} now={now} />;
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Alder" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="oc-running">
            <h2 className="ah-rail-section-head" id="oc-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
            <ul>{running.map(row)}</ul>
          </section>
          <section className="ah-now ah-quiet" data-testid="rail-quiet" aria-labelledby="oc-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded="true">
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="oc-quiet">Hiljaiset</span><span className="ah-rail-count">{quiet.length}</span>
              </button>
            </h2>
            <ul>{quiet.map(row)}</ul>
          </section>
        </>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_h" />
      <WorkspaceNavRow name="kysely" href="/workspaces/ws_k" />
    </WorkspaceRail>
  );
  const main = (
    <div className="ah-state oc-main">
      <ViewSplit open={!!pane} expanded={false} width={width} min={320} max={Math.max(320, innerWidth - 300 - 360)}
        onResize={setWidth} onReset={noop} onShowConversation={noop} panel={pane}>
        <ConversationFrame>
          <AgentHeader title={PARENT} workspaceLabel="kysely" workspaceHref="/workspaces/ws_k" activityLabel="Odottaa viestiä"
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} filesControl={chip} />
          <ConversationStream streamRef={stream}>
            <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
            onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={picker} />
        </ConversationFrame>
      </ViewSplit>
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={PARENT} navigationBadge={0} rail={railView}
        main={<ProcessProvider id={CONVO} csrf="prototype" onLogin={noop} onStatusEvent={() => noop}>{main}</ProcessProvider>} />
      {tab ? <TabMock s={tab} onClose={() => setTab(undefined)} /> : null}
      {toast ? <div className="oc-toast" role="status" data-testid="oc-toast"><Icon name="download" /> {toast}</div> : null}
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [pub, setPubs] = useState<Record<string, Date | null>>(() => ({[V2.view_id]: inDays(14)}));
  const pubValue: Pub = {until: (id) => pub[id] ?? null, set: (id, until) => setPubs((p) => ({...p, [id]: until}))};
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <PubContext.Provider value={pubValue}>
      <div className={`rq-review variant-${direction}`} data-direction={direction}>
        <header className="rq-bar" ref={bar}>
          <strong>Tarjouskortit · kierros 3</strong>
          <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
            <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
          <ol className="rq-lines" data-testid="direction-lines">
            {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
          </ol>
        </header>
        <div className="rq-stage">
          <MemoryRouter initialEntries={['/workspaces/ws_k?conversation=syksy']}>
            <Main direction={direction} />
          </MemoryRouter>
        </div>
      </div>
    </PubContext.Provider>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  pickerNav.append(button);
});
document.body.append(pickerNav);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
