import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Menu, MenuTrigger, Popover, Switch} from 'react-aria-components';
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
import {ViewOfferCard, formatViewSize, type ViewSummary, type ViewVisibility} from '../../../../web/src/components/ViewOffer';
import {ViewPanel, ViewSplit} from '../../../../web/src/components/ViewPanel';
import {FileOfferCard, FileShelf, fileFacts, formatOfferSize} from '../../../../web/src/components/FileOffer';
import type {FileKind, FileOfferItem, FileOfferSummary, OfferState} from '../../../../web/src/app/fileOffers';
import type {TimelineItem} from '../../../../web/src/components/types';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import '../../../../web/src/components/EditorSplit.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-offer-cards-consistent, round 1. Jari 8.11.2026: the cards an agent
// offers look and behave differently by content type and open in different
// places. "Nyt" is production: the view card opens beside the conversation,
// a file card's second button opens a dialog over it, a folder card opens the
// file panel. The three directions give views, tables, images, documents and
// folders one card shape and one opening place: the right-hand panel that
// proto-conversation-assets recommends for the conversation's list of views
// and files. The axis is how much the card itself carries:
// 1 Kortti: the whole card is one press; download and sharing live in the panel;
// 2 Rivi: a one-line row whose only button is Avaa, the rest behind ⋯;
// 3 Otsake: a shared facts line (kind · size · who sees it) and the same two
//   buttons on every card, Avaa and Lataa.
const directions = ['Nyt', '1 Kortti', '2 Rivi', '3 Otsake'];
const LINES = [
  'Nyt: tuotanto tänään. Näkymä avautuu viereen, tiedosto ikkunaan keskustelun päälle, kansio Tiedostot-paneeliin; kortit ja painikkeet vaihtelevat lajin mukaan.',
  '1 Kortti: koko kortti on yksi painallus, joka avaa kohteen oikeaan paneeliin; lataus ja jakaminen ovat paneelin yläpalkissa.',
  '2 Rivi: jokainen tarjous on yksi rivi, jonka ainoa painike on Avaa (oikea paneeli); lataus ja jakaminen ⋯-valikossa.',
  '3 Otsake: jokaisella kortilla sama tietorivi (laji · koko · kuka näkee) ja samat kaksi painiketta: Avaa (oikea paneeli) ja Lataa.',
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

/** Who sees it: a lock for the person only, a globe while a view is public. */
function Seen({a, words = true, until: shown}: {a: Asset; words?: boolean; until?: Date | null}) {
  const until = shown === undefined ? (a.type === 'view' ? a.view.publicUntil : undefined) : shown ?? undefined;
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

type Opener = {open: (a: Asset) => void; openedId?: string};

// ---- 1 Kortti: one press per card ----
function CardWhole({a, o}: {a: Asset; o: Opener}) {
  return (
    <button type="button" className="oc-card oc1" data-testid="oc-card" data-kind={a.kind} data-asset={a.id}
      data-open={o.openedId === a.id || undefined} aria-label={`Avaa: ${a.title}`} onClick={() => o.open(a)}>
      <Mark a={a} />
      <span className="oc-body">
        <strong className="oc-title">{a.title}</strong>
        <span className="oc-facts">{facts(a).join(' · ')} · <Seen a={a} words={false} /></span>
        {a.kind === 'image' ? <Thumb a={a} /> : null}
        {a.kind === 'folder' ? (
          <span className="oc-strip">{itemsOf((a as Extract<Asset, {type: 'file'}>).offer).slice(0, 5).map((i) => <img key={i.path} src={CHARTS[i.path]} alt="" />)}</span>
        ) : null}
      </span>
      <Icon name="forward" className="oc-chev" />
    </button>
  );
}

// ---- 2 Rivi: one line, Avaa, the rest behind ⋯ ----
function MoreMenu({a}: {a: Asset}) {
  return (
    <MenuTrigger>
      <ControlButton size="row" variant="quiet" className="oc-more" data-testid="oc-more" aria-label={`Lisää: ${a.title}`} title="Lataa, jaa, avaa välilehdelle">
        <Icon name="more" />
      </ControlButton>
      <Popover placement="bottom end" className="ah-popover oc-menu">
        <Menu aria-label={a.title} onAction={() => {}}>
          <ControlMenuItem id="download" textValue="Lataa"><Icon name="download" /> {a.kind === 'folder' || a.type === 'view' ? 'Lataa (.zip)' : 'Lataa'}</ControlMenuItem>
          {a.kind !== 'folder' ? <ControlMenuItem id="tab" textValue="Avaa omalle välilehdelle"><Icon name="external" /> Avaa omalle välilehdelle</ControlMenuItem> : null}
          {a.type === 'view' ? (
            <ControlMenuItem id="share" textValue="Julkinen"><Icon name="globe" /> {a.view.publicUntil ? 'Lopeta julkisuus' : 'Tee julkiseksi'}</ControlMenuItem>
          ) : null}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
function CardRow({a, o}: {a: Asset; o: Opener}) {
  return (
    <div className="oc-card oc2" data-testid="oc-card" data-kind={a.kind} data-asset={a.id} data-open={o.openedId === a.id || undefined}>
      <button type="button" className="oc2-hit" aria-label={`Avaa: ${a.title}`} tabIndex={-1} onClick={() => o.open(a)} />
      <Mark a={a} size="s" />
      <strong className="oc-title">{a.title}</strong>
      <span className="oc-facts">{facts(a).join(' · ')}</span>
      <Seen a={a} words={false} />
      <ControlButton size="row" variant="primary" className="oc-open" data-testid="oc-open" onPress={() => o.open(a)}>Avaa</ControlButton>
      <MoreMenu a={a} />
    </div>
  );
}

// ---- 3 Otsake: the shared facts line and the same two buttons ----
function CardHead({a, o}: {a: Asset; o: Opener}) {
  return (
    <aside className="oc-card oc3" data-testid="oc-card" data-kind={a.kind} data-asset={a.id} data-open={o.openedId === a.id || undefined}>
      <span className="oc3-head"><Mark a={a} size="xs" /><span>{facts(a).join(' · ')}</span><span aria-hidden="true">·</span><Seen a={a} /></span>
      <strong className="oc-title">{a.title}</strong>
      {a.kind === 'image' ? <button type="button" className="oc-thumb-button" aria-label={`Avaa: ${a.title}`} onClick={() => o.open(a)}><Thumb a={a} /></button> : null}
      <span className="oc3-actions">
        <ControlButton size="row" variant="primary" data-testid="oc-open" onPress={() => o.open(a)}>Avaa</ControlButton>
        <ControlButton size="row" data-testid="oc-download" onPress={() => {}}>
          <Icon name="download" /> {a.kind === 'folder' || a.type === 'view' ? 'Lataa (.zip)' : 'Lataa'}
        </ControlButton>
      </span>
    </aside>
  );
}

// ---- The shared opening place: the right-hand panel ----
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

function AssetPanel({a, sub, onSub, onBack, onClose}: {a: Asset; sub?: string; onSub: (p?: string) => void; onBack: () => void; onClose: () => void}) {
  const [pub, setPub] = useState(a.type === 'view' && !!a.view.publicUntil);
  const isView = a.type === 'view';
  return (
    <section className="ah-view-pane oc-pane" data-testid="oc-panel" data-kind={a.kind} aria-label={a.title}>
      <button type="button" className="oc-back" data-testid="oc-back" onClick={sub ? () => onSub(undefined) : onBack}>
        <Icon name="back" /> {sub ? `${(a as Extract<Asset, {type: 'file'}>).offer.offer.folder}/` : 'Näkymät ja tiedostot'}
      </button>
      <header className="oc-pane-head">
        <Mark a={a} size="s" />
        <span className="oc-pane-title">
          <h2 className="ah-view-title" data-testid="oc-panel-title">{sub ? baseName(sub) : a.title}</h2>
          <span className="oc-facts">{facts(a).join(' · ')} · {hhmm(a.at)}</span>
        </span>
        <span className="oc-pane-tools">
          {a.kind !== 'folder' || sub ? (
            <ControlButton size="row" variant="quiet" aria-label="Avaa omalle välilehdelle" title="Avaa omalle välilehdelle" onPress={() => {}}><Icon name="external" /></ControlButton>
          ) : null}
          <ControlButton size="row" variant="quiet" data-testid="oc-panel-download" aria-label="Lataa" title={a.kind === 'folder' && !sub ? 'Lataa kaikki (.zip)' : isView ? 'Lataa (.zip)' : 'Lataa'} onPress={() => {}}><Icon name="download" /></ControlButton>
          <ControlButton size="row" variant="quiet" data-testid="oc-panel-close" aria-label="Sulje" title="Sulje" onPress={onClose}><Icon name="cross" /></ControlButton>
        </span>
      </header>
      <div className="oc-pane-share">
        {isView ? (
          <Switch className="ah-view-offer-switch" data-testid="oc-public" isSelected={pub} onChange={setPub}>
            <span>Julkinen</span><span className="ah-view-offer-track" aria-hidden="true" />
          </Switch>
        ) : null}
        <Seen a={a} until={isView ? (pub ? (a.view.publicUntil ?? inDays(14)) : null) : undefined} />
        {isView && pub ? <ControlButton size="row" variant="quiet" className="oc-copy"><Icon name="copy" /> Kopioi linkki</ControlButton> : null}
      </div>
      <div className="oc-pane-body">
        <Body a={a} sub={sub} onSub={onSub} />
      </div>
    </section>
  );
}

/** The conversation's views and files, as proto-conversation-assets lists them. */
function ListPanel({o, onClose}: {o: Opener; onClose: () => void}) {
  return (
    <section className="ah-view-pane oc-pane" data-testid="oc-list" aria-label="Keskustelun näkymät ja tiedostot">
      <header className="oc-pane-head">
        <span className="oc-pane-title"><h2 className="ah-view-title">Näkymät ja tiedostot</h2></span>
        <span className="oc-pane-tools">
          <ControlButton size="row" variant="quiet" aria-label="Sulje" title="Sulje" onPress={onClose}><Icon name="cross" /></ControlButton>
        </span>
      </header>
      <ul className="oc-list">
        {NEWEST.map((a) => (
          <li key={a.id}>
            <button type="button" data-testid="oc-list-row" onClick={() => o.open(a)}>
              <Mark a={a} size="s" />
              <span className="oc-text"><span className="oc-name">{a.title}</span><span className="oc-facts">{kindWord(a)}</span></span>
              <span className="oc-facts">{hhmm(a.at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
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
const visibility = (v: View): ViewVisibility => ({public: !!v.publicUntil, until: v.publicUntil?.toISOString(), url: v.publicUntil ? 'https://alder.example/v/kiitos-vastaajille' : undefined,
  maxDays: 30, onPublic: noop, onDuration: noop});

type Open = {kind: 'asset'; id: string; sub?: string} | {kind: 'list'} | {kind: 'now-view'; view: View} | {kind: 'now-shelf'; at?: string};

function Main({direction}: {direction: number}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<Open>();
  const [width, setWidth] = useState(() => Math.round(Math.max(innerWidth - 300, 0) * 0.46));
  const o: Opener = {open: (a) => setOpen({kind: 'asset', id: a.id}), openedId: open?.kind === 'asset' ? open.id : undefined};
  // Start at the newest card; the drawn images settle the height a moment later.
  useLayoutEffect(() => {
    const bottom = () => { const el = stream.current; if (el) el.scrollTop = el.scrollHeight; };
    bottom();
    const timers = [0, 80, 250].map((t) => window.setTimeout(bottom, t));
    return () => timers.forEach(clearTimeout);
  }, []);

  const card = (a: Asset) => {
    if (direction === 0) {
      if (a.type === 'view') {
        const v = a.view;
        return <ViewOfferCard view={v} visibility={visibility(v)} state={open?.kind === 'now-view' && open.view.view_id === v.view_id ? 'open' : 'idle'} onOpen={() => setOpen({kind: 'now-view', view: v})} onOpenTab={noop} />;
      }
      return <FileOfferCard offer={a.offer.offer} state={a.offer.state} onShowFiles={(id) => setOpen({kind: 'now-shelf', at: id})} />;
    }
    return direction === 1 ? <CardWhole a={a} o={o} /> : direction === 2 ? <CardRow a={a} o={o} /> : <CardHead a={a} o={o} />;
  };
  const notice = (a: Asset) => ({id: a.id, kind: 'notice', content: card(a)});
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

  // Today's header control, as FilesHeaderControl draws it; the directions' chip opens the list.
  const nowFiles = (
    <ControlButton data-testid="toggle-file-shelf" size="row" variant="quiet" className="ah-files-toggle" aria-label={`Tiedostot: ${FILE_COUNT}`}
      title="Keskustelun tiedostot" aria-pressed={open?.kind === 'now-shelf'} onPress={() => setOpen(open?.kind === 'now-shelf' ? undefined : {kind: 'now-shelf'})}>
      <Icon name="file" /> <span>{FILE_COUNT}</span>
    </ControlButton>
  );
  const chip = (
    <ControlButton data-testid="oc-chip" size="row" variant="quiet" className="oc-chip" aria-label={`Näkymät 2, tiedostot ${OFFERS.length}`}
      title="Keskustelun näkymät ja tiedostot" aria-pressed={open?.kind === 'list'} onPress={() => setOpen(open?.kind === 'list' ? undefined : {kind: 'list'})}>
      <span className="oc-count-view" aria-hidden="true">{'</>'}</span><span>2</span><Icon name="file" /><span>{OFFERS.length}</span>
    </ControlButton>
  );

  const close = () => setOpen(undefined);
  let panel: React.ReactNode = null;
  if (open?.kind === 'now-view')
    panel = <ViewPanel title={open.view.title} src={open.view.src} expanded={false} onToggleExpanded={noop} onOpenTab={noop} onClose={close} />;
  else if (open?.kind === 'now-shelf') panel = <FileShelf offers={OFFERS} scrollTo={open.at} onClose={close} />;
  else if (open?.kind === 'list') panel = <ListPanel o={o} onClose={close} />;
  else if (open?.kind === 'asset') {
    const a = ASSETS.find((x) => x.id === open.id)!;
    panel = <AssetPanel key={a.id} a={a} sub={open.sub} onSub={(p) => setOpen({kind: 'asset', id: a.id, sub: p})} onBack={() => setOpen({kind: 'list'})} onClose={close} />;
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
      <ViewSplit open={!!panel} expanded={false} width={width} min={320} max={Math.max(320, innerWidth - 300 - 360)}
        onResize={setWidth} onReset={noop} onShowConversation={noop} panel={panel}>
        <ConversationFrame>
          <AgentHeader title={PARENT} workspaceLabel="kysely" workspaceHref="/workspaces/ws_k" activityLabel="Odottaa viestiä"
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} filesControl={direction === 0 ? nowFiles : chip} />
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
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Tarjouskortit · kierros 1</strong>
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
