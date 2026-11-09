import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {Icon} from '../../../../web/src/components/Icon';
import {ControlButton, LinkRow, Segmented} from '../../../../web/src/components/ControlElements';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {OfferActions, OfferMark, type OfferKind} from '../../../../web/src/components/OfferCard';
import {type ViewSummary, type ViewVisibility, viewFacts} from '../../../../web/src/components/ViewOffer';
import {offerFacts, offerKind} from '../../../../web/src/components/FileOffer';
import {ImageThumbnail} from '../../../../web/src/components/ImageThumbnail';
import {CopyButton} from '../../../../web/src/components/ViewLink';
import {formatExpiry} from '../../../../web/src/app/viewLinks';
import type {FileOfferManifest, FileOfferSummary, OfferState} from '../../../../web/src/app/fileOffers';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {viewLinksText} from '../../../../web/src/text/viewLinks';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const linkTxt = liveText(viewLinksText);

// proto-shares-own-place, round 3. Jari chose round 1's Oma sivu (a page of
// its own under Etusivu, a view's `</>` mark, no trail of deleted addresses)
// and round 2's B Lista as the base on 9.11.2026: dense rows beside one share
// shown large, its address and expiry visible without hovering. The list
// itself should read like a timeline, as round 2's C did. Host facts and rows
// are the same as in rounds 1-2: the address list (ADR 0035: title, view or
// offer, private/public/expired, public_until, created_at) joined in the
// browser to the person's views and offers (kind, files, size, folder,
// conversation) and conversations (title, workspace, archived); an offered
// image's bounded thumbnail. Controls are the offer card's own icons plus a
// bin that deletes the address for good.
// A Päivät: a heading per day, the row naming its conversation;
// B Keskustelut: conversations on a line by their latest share;
// C Agenda: the date in a column of its own, the day's conversations beside.
// The detail also varies how the address is shown (Jari's open questions):
// A a field and Kopioi linkki, B a field with the link icon, C the button.
const directions = ['A Päivät', 'B Keskustelut', 'C Agenda'];
const LINES = [
  'A Päivät: lista päiväotsikoittain uusin ensin, rivillä keskustelu ja kellonaika. Valitussa jaossa koko osoite kentässä ja erillinen Kopioi linkki -painike.',
  'B Keskustelut: keskustelut pystyviivalla viimeisimmän jaon mukaan ja jaot niiden alla. Valitussa jaossa koko osoite kentässä ja linkkikuvake kentän päässä.',
  'C Agenda: päivämäärä omassa sarakkeessaan ja päivän keskustelut sen vieressä. Valitussa jaossa pelkkä Kopioi linkki -painike, osoitetta ei näytetä.',
];

// ---- The story: Jari's four addresses on 8.11. plus file, image and folder offers and past shares ----
const MAX_DAYS = 90;
const DAY = 86400000;
const at = (s: string) => new Date(s).toISOString();
const b32 = (seed: string) => (seed.toLowerCase().replace(/[^a-z]/g, '') + 'qwertyuiopasdfghjklzxcvbnm').slice(0, 26);
const secret = (seed: string) => (seed.replace(/[^A-Za-z0-9]/g, '') + 'Kx7_Qm2-Lp9vRt4ZnW8sYb3HcJ6dFg1aEe5uTo0iPq').slice(0, 43);

type Conv = {id: string; title: string; ws: string; wsId: string; archived: boolean};
const KIERROS7: Conv = {id: 'pi:kierros7', title: 'Testikierros 7.11.', ws: 'open-habitat', wsId: 'ws_openhabitat01', archived: false};
const KUVAT: Conv = {id: 'pi:kuvat', title: 'Asetusten kuvakaappaukset', ws: 'open-habitat', wsId: 'ws_openhabitat01', archived: false};
const KORTIT: Conv = {id: 'pi:kortit', title: 'Tarjouskorttien kokeilu', ws: 'open-habitat', wsId: 'ws_openhabitat01', archived: true};
const RAPORTTI: Conv = {id: 'pi:raportti', title: 'Raportti /var/tmp:stä', ws: 'fleetrepo', wsId: 'ws_fleetrepo01', archived: true};
const KIERROS5: Conv = {id: 'pi:kierros5', title: 'Testikierros 5.11.', ws: 'open-habitat', wsId: 'ws_openhabitat01', archived: true};

type Item =
  | {kind: 'view'; view: ViewSummary}
  | {kind: 'file'; offer: FileOfferSummary; manifest: FileOfferManifest}
  // The view or offer is gone (the agent removed it); the address stays until deleted.
  | {kind: 'gone'};
type Share = {
  id: string; title: string; item: Item; conv?: Conv; created: string;
  state: 'private' | 'public' | 'expired'; until?: string; url: string;
  /** Synthetic stand-ins for the host's bounded image thumbnails. */
  thumbs?: string[];
};

// Synthetic pictures in place of the host's thumbnails and of the panel's content.
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const shot = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 450"><rect width="720" height="450" fill="#17191d"/><rect x="24" y="24" width="672" height="402" rx="14" fill="#1f2228" stroke="#30343b"/><text x="48" y="70" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#e9e6df">Tili</text><circle cx="66" cy="118" r="18" fill="#59616d"/><rect x="96" y="104" width="170" height="12" rx="6" fill="#e9e6df"/><rect x="96" y="124" width="130" height="9" rx="4" fill="#8b919b"/><rect x="560" y="102" width="112" height="34" rx="8" fill="#30343b"/><line x1="24" y1="160" x2="696" y2="160" stroke="#30343b"/><rect x="48" y="186" width="150" height="12" rx="6" fill="#e9e6df"/><rect x="48" y="208" width="250" height="9" rx="4" fill="#8b919b"/><rect x="520" y="190" width="152" height="34" rx="8" fill="#30343b"/><line x1="24" y1="250" x2="696" y2="250" stroke="#30343b"/><rect x="48" y="276" width="120" height="12" rx="6" fill="#e9e6df"/><rect x="230" y="276" width="190" height="12" rx="6" fill="#e9e6df"/><rect x="230" y="296" width="120" height="9" rx="4" fill="#8b919b"/><rect x="454" y="274" width="64" height="32" rx="8" fill="#30343b"/><rect x="526" y="274" width="146" height="32" rx="8" fill="#30343b"/><rect x="230" y="320" width="64" height="32" rx="8" fill="#e8a58d"/><rect x="230" y="372" width="170" height="12" rx="6" fill="#e9e6df"/><rect x="600" y="368" width="72" height="32" rx="8" fill="#e8a58d"/></svg>`);
const photo = (h: number) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${h},55%,72%)"/><stop offset="1" stop-color="hsl(${h + 30},45%,88%)"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><circle cx="${220 - h % 90}" cy="70" r="26" fill="hsl(${h + 180},70%,92%)"/><path d="M0 190 L70 120 L130 170 L200 100 L320 200 L320 240 L0 240Z" fill="hsl(${h + 200},30%,38%)"/><path d="M0 215 L90 175 L170 210 L260 165 L320 190 L320 240 L0 240Z" fill="hsl(${h + 210},28%,26%)"/></svg>`);
/** What the panel shows when it opens the item itself, as in the conversation. */
const page = (title: string, kind: 'view' | 'pdf' | 'csv') => {
  const bars = [120, 180, 90, 210, 150].map((h, i) => `<rect x="${90 + i * 110}" y="${420 - h}" width="64" height="${h}" rx="4" fill="${i === 3 ? '#3f7d6e' : '#9cb8af'}"/>`).join('');
  const rows = Array.from({length: 9}, (_, i) => `<rect x="60" y="${170 + i * 34}" width="680" height="1" fill="#e3e1db"/><rect x="72" y="${152 + i * 34}" width="${120 + (i * 37) % 90}" height="10" rx="5" fill="#9aa0a8"/><rect x="330" y="${152 + i * 34}" width="60" height="10" rx="5" fill="#c3c7cc"/><rect x="520" y="${152 + i * 34}" width="${50 + (i * 23) % 60}" height="10" rx="5" fill="#c3c7cc"/>`).join('');
  const body = kind === 'csv' ? rows : kind === 'pdf'
    ? `${Array.from({length: 10}, (_, i) => `<rect x="60" y="${150 + i * 26}" width="${640 - (i * 53) % 180}" height="10" rx="5" fill="#c3c7cc"/>`).join('')}<rect x="60" y="440" width="300" height="12" rx="6" fill="#1d2026"/>`
    : `<rect x="60" y="120" width="680" height="1" fill="#e3e1db"/>${bars}<line x1="70" y1="420" x2="730" y2="420" stroke="#c9ccd3"/><rect x="60" y="450" width="420" height="10" rx="5" fill="#c3c7cc"/><rect x="60" y="470" width="300" height="10" rx="5" fill="#c3c7cc"/>`;
  const esc = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><rect width="800" height="520" fill="#fbfaf7"/><text x="60" y="84" font-family="system-ui,sans-serif" font-size="30" font-weight="700" fill="#1d2026">${esc}</text>${body}</svg>`);
};

const view = (seed: string, title: string, entry: string, files: number, bytes: number, created: string, conv: Conv): Item =>
  ({kind: 'view', view: {view_id: `v${b32(seed)}`, title, entry, files, bytes, created_at: at(created), conversation_id: conv.id}});
const offer = (seed: string, title: string, items: FileOfferManifest['items'], created: string, conv: Conv, folder?: string): Item => {
  const summary: FileOfferSummary = {offer_id: `f${b32(seed)}`, title, files: items.length, bytes: items.reduce((n, i) => n + i.bytes, 0), created_at: at(created), conversation_id: conv.id, ...(folder ? {folder} : {})};
  return {kind: 'file', offer: summary, manifest: {offer: summary, items}};
};
const share = (seed: string, title: string, item: Item, conv: Conv | undefined, created: string, state: Share['state'], until?: string, thumbs?: string[]): Share => ({
  id: `a${b32(seed)}`, title, item, conv, created: at(created), state, until: until ? at(until) : undefined,
  url: `https://birch.habitat.example/n/${secret(seed + 'entry')}`, thumbs,
});
const images = ['ranta', 'metsa', 'jarvi', 'tunturi', 'satama', 'pelto'];
// Newest first, as the host lists them.
const SHARES = (): Share[] => [
  share('kuvakaappaus', 'Asetukset › Tili, kuvakaappaus', offer('kuvakaappaus', 'Asetukset › Tili, kuvakaappaus', [{path: 'tili-2026-11-08.png', bytes: 217 * 1024, kind: 'image', width: 1440, height: 900}], '2026-11-08T10:12:00+02:00', KUVAT), KUVAT, '2026-11-08T10:14:00+02:00', 'public', '2026-11-15T10:14:00+02:00', [shot]),
  share('testikuvat', 'Testikuvat', offer('testikuvat', 'Testikuvat', images.map((n, i) => ({path: `testikuvat/${n}.jpg`, bytes: (380 + i * 90) * 1024, kind: 'image' as const, width: 2048, height: 1536})), '2026-11-08T09:30:00+02:00', KUVAT, 'testikuvat'), KUVAT, '2026-11-08T09:31:00+02:00', 'private', undefined, images.map((_, i) => photo(i * 47 + 20))),
  share('testikierros', 'Testikierros 7.11. – tilanne', view('testikierros', 'Testikierros 7.11. – tilanne', 'tilanne/index.html', 4, 186 * 1024, '2026-11-07T18:40:00+02:00', KIERROS7), KIERROS7, '2026-11-07T18:41:00+02:00', 'public', '2026-12-07T18:41:00+02:00'),
  share('myyntitaulukko', 'Myyntitaulukko (testi)', view('myyntitaulukko', 'Myyntitaulukko (testi)', 'myynti.html', 1, 48 * 1024, '2026-11-07T15:02:00+02:00', KORTIT), KORTIT, '2026-11-07T15:03:00+02:00', 'private'),
  share('tarjouskortit', 'Testinäkymä – tarjouskortit', view('tarjouskortit', 'Testinäkymä – tarjouskortit', 'kortit/index.html', 3, 92 * 1024, '2026-11-07T14:20:00+02:00', KORTIT), KORTIT, '2026-11-07T14:21:00+02:00', 'private'),
  share('tarjouspdf', 'Tarjous – Asunto Oy Koivula', offer('tarjouspdf', 'Tarjous – Asunto Oy Koivula', [{path: 'tarjous-koivula.pdf', bytes: 340 * 1024, kind: 'pdf'}], '2026-11-07T13:05:00+02:00', KORTIT), KORTIT, '2026-11-07T13:06:00+02:00', 'private'),
  share('testiraportti', 'Testiraportti /var/tmp:stä', view('testiraportti', 'Testiraportti /var/tmp:stä', 'raportti.html', 1, 22 * 1024, '2026-11-06T16:30:00+02:00', RAPORTTI), RAPORTTI, '2026-11-06T16:31:00+02:00', 'private'),
  share('kierrosviisi', 'Testikierros 5.11. – tilanne', view('kierrosviisi', 'Testikierros 5.11. – tilanne', 'tilanne/index.html', 4, 171 * 1024, '2026-11-05T17:10:00+02:00', KIERROS5), KIERROS5, '2026-11-05T17:11:00+02:00', 'expired', '2026-11-06T17:11:00+02:00'),
  share('vanhakortti', 'Testinäkymä – vanha kortti', {kind: 'gone'}, undefined, '2026-11-04T12:00:00+02:00', 'private'),
  share('tapahtumaloki', 'Pilotin tapahtumaloki', offer('tapahtumaloki', 'Pilotin tapahtumaloki', [{path: 'tapahtumat.csv', bytes: 1260 * 1024, kind: 'csv', lines: 18421, columns: 6}], '2026-10-31T11:00:00+02:00', RAPORTTI), RAPORTTI, '2026-10-31T11:02:00+02:00', 'expired', '2026-11-07T11:02:00+02:00'),
];

const ready = (s: Share): OfferState => s.item.kind === 'file' ? {state: 'ready', manifest: s.item.manifest} : {state: 'removed'};
const kindOf = (s: Share): OfferKind => s.item.kind === 'view' ? 'view' : s.item.kind === 'file' ? offerKind(s.item.offer, ready(s)) : 'file';
const factsOf = (s: Share) => s.item.kind === 'view' ? viewFacts(s.item.view) : s.item.kind === 'file' ? offerFacts(s.item.offer, ready(s)) : [];
const isPub = (s: Share) => s.state === 'public';
const gone = (s: Share) => s.item.kind === 'gone';
type Group = 'public' | 'private' | 'past';
const group = (s: Share): Group => gone(s) || s.state === 'expired' ? 'past' : isPub(s) ? 'public' : 'private';
const day = (iso: string) => formatExpiry(iso);
const weekday = (iso: string) => new Date(iso).toLocaleDateString('fi-FI', {weekday: 'short', day: 'numeric', month: 'numeric'});
/** The row's state in words, from the address and the joined item. */
const stateWords = (s: Share, short: boolean | 'tile' = false) => gone(s) ? (short ? 'Kohde poistettu' : 'Kohde on poistettu; osoite ei avaa enää mitään')
  : s.state === 'expired' ? `Julkisuus päättyi ${day(s.until!)}` : isPub(s) ? (short === 'tile' ? 'Julkinen' : linkTxt.publicUntil(day(s.until!))) : linkTxt.isPrivate;
const counts = (rows: Share[]) => ({
  public: rows.filter((s) => group(s) === 'public').length,
  private: rows.filter((s) => group(s) === 'private').length,
  past: rows.filter((s) => group(s) === 'past').length,
});
const summary = (rows: Share[]) => {
  const c = counts(rows);
  return `${c.public} julkista, ${c.private} vain sinulle, ${c.past} päättynyttä tai poistettua.`;
};

// ---- Pieces every direction shares ----
type Act = {
  publish: (s: Share, on: boolean) => void; duration: (s: Share, days: number) => void;
  open: (s: Share) => void; remove: (s: Share) => void;
};
const visibility = (s: Share, act: Act, copy = true): ViewVisibility => ({
  public: isPub(s), until: isPub(s) ? s.until : undefined, url: isPub(s) && copy ? s.url : undefined, maxDays: MAX_DAYS,
  onPublic: (on) => act.publish(s, on), onDuration: (d) => act.duration(s, d),
});
/** The offer card's own icons, then a bin that deletes the address for good. */
function Icons({s, act, copy = true}: {s: Share; act: Act; copy?: boolean}) {
  return (
    <OfferActions label={s.title} publish={gone(s) ? undefined : visibility(s, act, copy)} onTab={gone(s) ? undefined : () => act.open(s)}>
      <ControlButton size="row" variant="quiet" className="ah-offer-ib jp-bin" data-testid="js-remove"
        aria-label={`Poista osoite: ${s.title}`} title="Poista osoite pysyvästi" onPress={() => act.remove(s)}>
        <Icon name="trash" />
      </ControlButton>
    </OfferActions>
  );
}
function ConvLink({c}: {c: Conv}) {
  return <LinkRow kind="inline" href={`/workspaces/${c.wsId}?conversation=${c.id}`}>{c.title}</LinkRow>;
}
function From({s, when = false}: {s: Share; when?: boolean}) {
  const date = when ? <> · jaettu {day(s.created)}</> : null;
  if (!s.conv) return <span className="jp-from">ei keskustelua: kohde on poistettu{date}</span>;
  return <span className="jp-from"><ConvLink c={s.conv} /> · {s.conv.ws}{s.conv.archived ? <> <span className="jp-tag">arkistoitu</span></> : null}{date}</span>;
}
function StateLine({s, short = false}: {s: Share; short?: boolean | 'tile'}) {
  return (
    <span className="jp-state" data-state={group(s)} data-testid="js-state">
      {gone(s) ? <Icon name="slash" /> : s.state === 'expired' ? <Icon name="clock" /> : <Icon name={isPub(s) ? 'globe' : 'lock'} />}
      <span>{stateWords(s, short)}</span>
    </span>
  );
}
/** A preview from what the host has: an offered image's thumbnail, a
 * folder's first images, a file's kind, a view's mark and start file. */
function Thumb({s, size}: {s: Share; size: 's' | 'l'}) {
  const cls = `jp-thumb jp-thumb-${size}`;
  if (gone(s)) return <span className={`${cls} gone`} aria-hidden="true"><Icon name="slash" /></span>;
  if (s.item.kind === 'view')
    return <span className={`${cls} view`} aria-hidden="true"><OfferMark kind="view" size={size === 's' ? 's' : 'm'} />{size === 'l' ? <small>{s.item.view.entry}</small> : null}</span>;
  const items = s.item.manifest.items;
  if (s.thumbs?.length && items.length > 1) {
    const n = size === 's' ? 1 : 3;
    return (
      <span className={`${cls} mosaic n${n}`} aria-hidden="true">
        {s.thumbs.slice(0, n).map((t, i) => <ImageThumbnail key={i} src={t} />)}
        {s.thumbs.length > n && size !== 's' ? <span className="jp-more">+{s.thumbs.length - n}</span> : null}
      </span>
    );
  }
  if (s.thumbs?.length) return <span className={`${cls} image`} aria-hidden="true"><ImageThumbnail src={s.thumbs[0]} /></span>;
  return <span className={`${cls} file`} aria-hidden="true"><OfferMark kind={kindOf(s)} size={size === 's' ? 's' : 'm'} />{size === 'l' ? <small>{items[0].path}</small> : null}</span>;
}
/** The item itself, as the panel opens it in the conversation. */
function Big({s}: {s: Share}) {
  if (gone(s)) return <p className="jp-big-gone"><Icon name="slash" /> Agentti on poistanut kohteen. Osoite ei avaa enää mitään; poista se, niin se ei vie paikkaa.</p>;
  if (s.thumbs && s.thumbs.length > 1) return <div className="jp-big-grid">{s.thumbs.map((t, i) => <img key={i} src={t} alt="" />)}</div>;
  if (s.thumbs) return <img className="jp-big" src={s.thumbs[0]} alt="" />;
  const kind = s.item.kind === 'view' ? 'view' : s.item.kind === 'file' && s.item.manifest.items[0].kind === 'csv' ? 'csv' : 'pdf';
  return <img className="jp-big" src={page(s.title, kind)} alt="" />;
}
function Empty({children}: {children?: React.ReactNode}) {
  return (
    <div className="jp-empty" data-testid="js-empty">
      <span className="jp-empty-mark" aria-hidden="true"><Icon name="globe" /></span>
      <h2>Et ole jakanut vielä mitään</h2>
      <p>Kun agentti tarjoaa keskustelussa näkymän tai tiedoston, sen kortin maapallo antaa sille oman osoitteen. Osoite näkyy tässä, ja sen voi antaa kenelle tahansa sovitun ajan.</p>
      {children}
    </div>
  );
}
function PageHead({rows, children}: {rows: Share[]; children?: React.ReactNode}) {
  return (
    <header className="jp-head">
      <h1>Jaetut</h1>
      <p>{rows.length ? `Näkymät ja tiedostot, joilla on oma osoite: ${summary(rows)}` : 'Näkymät ja tiedostot, joilla on oma osoite.'}</p>
      {children}
    </header>
  );
}


// ---- The list: B Lista's rows and detail, ordered in time ----
type Filter = 'all' | Group;
const dayKey = (iso: string) => new Date(iso).toDateString();
const longDay = (iso: string) => { const t = new Date(iso).toLocaleDateString('fi-FI', {weekday: 'long', day: 'numeric', month: 'numeric'}); return t[0].toUpperCase() + t.slice(1); };
const time = (iso: string) => new Date(iso).toLocaleTimeString('fi-FI', {hour: 'numeric', minute: '2-digit'});
/** Runs of consecutive items with the same key, in list order. */
function runs<T, K>(items: T[], key: (t: T) => K): {key: K; items: T[]}[] {
  const out: {key: K; items: T[]}[] = [];
  for (const t of items) {
    const k = key(t);
    if (out.length && out[out.length - 1].key === k) out[out.length - 1].items.push(t);
    else out.push({key: k, items: [t]});
  }
  return out;
}
const convKey = (s: Share) => s.conv?.id ?? 'gone';
const convTitle = (s: Share) => s.conv ? s.conv.title : 'Kohde poistettu';
function Row({s, sel, onPick, meta}: {s: Share; sel: boolean; onPick: (s: Share) => void; meta: React.ReactNode}) {
  return (
    <li data-testid="js-row" data-group={group(s)}>
      <button type="button" className="jl-row" data-testid="js-open" aria-current={sel ? 'true' : undefined} onClick={() => onPick(s)}>
        <Thumb s={s} size="s" />
        <span className="jl-text">
          <strong className={gone(s) ? 'jp-gone' : undefined}>{s.title}</strong>
          <span className="jp-facts">{meta}</span>
        </span>
        <StateLine s={s} short />
      </button>
    </li>
  );
}
type ListProps = {shown: Share[]; selId?: string; onPick: (s: Share) => void};
/** A Päivät: a heading for each day, newest first; the row names its conversation. */
function DayList({shown, selId, onPick}: ListProps) {
  return (
    <div className="jl-days">
      {runs(shown, (s) => dayKey(s.created)).map((d) => (
        <section key={d.key} className="jl-day" data-testid="js-day" aria-label={longDay(d.items[0].created)}>
          <h2 className="jl-day-head">{longDay(d.items[0].created)}</h2>
          <ul className="jl-rows">{d.items.map((s) => <Row key={s.id} s={s} sel={selId === s.id} onPick={onPick} meta={<>{convTitle(s)} · {time(s.created)}</>} />)}</ul>
        </section>
      ))}
    </div>
  );
}
/** B Keskustelut: conversations on a line in the order of their latest share. */
function ConvList({shown, selId, onPick}: ListProps) {
  const convs = [...new Set(shown.map(convKey))].map((k) => shown.filter((s) => convKey(s) === k));
  return (
    <ol className="jl-tl">
      {convs.map((mine) => {
        const s0 = mine[0];
        return (
          <li key={convKey(s0)} className="jl-tl-node" data-testid="js-conv">
            <span className="jl-tl-dot" data-state={mine.some(isPub) ? 'public' : mine.every((s) => group(s) === 'past') ? 'past' : 'private'} aria-hidden="true" />
            <h2 className="jl-tl-head">
              <time dateTime={s0.created}>{weekday(s0.created)}</time>
              <span className="jl-tl-conv">{convTitle(s0)}</span>
              {s0.conv ? <span className="jp-ws">{s0.conv.ws}</span> : null}
              {s0.conv?.archived ? <span className="jp-tag">arkistoitu</span> : null}
            </h2>
            <ul className="jl-rows">{mine.map((s) => <Row key={s.id} s={s} sel={selId === s.id} onPick={onPick} meta={<>{dayKey(s.created) === dayKey(s0.created) ? '' : `${weekday(s.created)} `}klo {time(s.created)} · {factsOf(s)[0] ?? 'poistettu'}</>} />)}</ul>
          </li>
        );
      })}
    </ol>
  );
}
/** C Agenda: the date in a column of its own, the day's conversations beside it. */
function AgendaList({shown, selId, onPick}: ListProps) {
  return (
    <div className="jl-ag">
      {runs(shown, (s) => dayKey(s.created)).map((d) => {
        const at0 = new Date(d.items[0].created);
        return (
          <section key={d.key} className="jl-ag-day" data-testid="js-day" aria-label={longDay(d.items[0].created)}>
            <div className="jl-ag-date" aria-hidden="true">
              <b>{at0.getDate()}</b>
              <span>{at0.toLocaleDateString('fi-FI', {weekday: 'short'})}</span>
              <span>{at0.toLocaleDateString('fi-FI', {month: 'short'})}</span>
            </div>
            <div className="jl-ag-body">
              {runs(d.items, convKey).map((c) => (
                <div key={c.key} className="jl-ag-conv" data-testid="js-conv">
                  <h3>{convTitle(c.items[0])}{c.items[0].conv ? <span className="jp-ws">{c.items[0].conv.ws}</span> : null}{c.items[0].conv?.archived ? <span className="jp-tag">arkistoitu</span> : null}</h3>
                  <ul className="jl-rows">{c.items.map((s) => <Row key={s.id} s={s} sel={selId === s.id} onPick={onPick} meta={<>klo {time(s.created)} · {factsOf(s)[0] ?? 'poistettu'}</>} />)}</ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** How the address and its link are shown (Jari's open questions 2-3):
 * A a field and a Kopioi linkki button, B a field with the link icon in it,
 * C the button alone. */
function ShareBox({s, act, variant}: {s: Share; act: Act; variant: number}) {
  return (
    <div className="jl-share" data-group={group(s)} data-variant={variant}>
      <StateLine s={s} />
      <span className="jl-acts"><Icons s={s} act={act} copy={false} /></span>
      {isPub(s) && variant === 0 ? (
        <span className="jl-url">
          <input readOnly value={s.url} aria-label="Osoite" onFocus={(e) => e.currentTarget.select()} />
          <CopyButton text={s.url} data-testid="js-copy" />
        </span>
      ) : null}
      {isPub(s) && variant === 1 ? (
        <span className="jl-url inline">
          <input readOnly value={s.url} aria-label="Osoite" onFocus={(e) => e.currentTarget.select()} />
          <CopyButton iconOnly text={s.url} data-testid="js-copy" />
        </span>
      ) : null}
      {isPub(s) && variant === 2 ? (
        <span className="jl-url solo"><CopyButton text={s.url} data-testid="js-copy" /></span>
      ) : null}
      <p className="jl-hint">{gone(s) ? 'Poistettu osoite ei toimi enää koskaan.'
        : isPub(s) ? 'Kuka tahansa, jolla osoite on, voi avata tämän kirjautumatta. Päivämäärästä vaihdat keston, maapallosta teet jaosta taas vain sinun.'
          : s.state === 'expired' ? 'Osoite on tallessa mutta ei avaudu muille. Maapallo julkaisee sen uudelleen samaan osoitteeseen.'
            : 'Vain sinä näet tämän. Maapallo tekee siitä julkisen oletuskestoksi.'}</p>
    </div>
  );
}

function ListDetail({rows, act, phone, variant}: {rows: Share[]; act: Act; phone: boolean; variant: number}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<string | undefined>();
  const c = counts(rows);
  const shown = rows.filter((s) => filter === 'all' || group(s) === filter);
  // The newest is shown until the person picks one; on a phone the list comes first.
  const sel = rows.find((s) => s.id === picked) ?? (phone ? undefined : shown[0]);
  const detail = !!sel && (!phone || !!picked);
  const List = [DayList, ConvList, AgendaList][variant];
  return (
    <div className="jl" data-testid="js-section" data-detail={detail || undefined} data-variant={variant}>
      <div className="jl-list">
        <PageHead rows={rows} />
        {rows.length ? (
          <>
            <Segmented data-testid="js-filter" label="Näytä" size="row" value={filter} onChange={(v) => setFilter(v as Filter)}
              options={[{id: 'all', label: 'Kaikki', n: rows.length}, {id: 'public', label: 'Julkiset', n: c.public}, {id: 'private', label: 'Vain sinä', n: c.private}, {id: 'past', label: 'Päättyneet', n: c.past}]
                .map((o) => ({id: o.id, label: phone ? o.label : `${o.label} ${o.n}`}))} />
            <List shown={shown} selId={sel?.id} onPick={(s) => setPicked(s.id)} />
          </>
        ) : <Empty />}
      </div>
      <div className="jl-detail">
        {sel ? (
          <section className="jl-pane" data-testid="js-detail" aria-label={sel.title}>
            {phone ? <ControlButton className="jl-back" variant="quiet" size="row" presentation="back" data-testid="js-back" onPress={() => setPicked(undefined)}>Jaetut</ControlButton> : null}
            <header className="jl-pane-head">
              <OfferMark kind={kindOf(sel)} />
              <span>
                <h2 className={gone(sel) ? 'jp-gone' : undefined}>{sel.title}</h2>
                <span className="jp-facts">{[...factsOf(sel), ''].join(' · ')}<From s={sel} when /></span>
              </span>
            </header>
            <ShareBox s={sel} act={act} variant={variant} />
            <div className="jl-big"><Big s={sel} /></div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

// ---- The page in the app shell ----
const noop = () => {};
function Main({direction, phone, empty}: {direction: number; phone: boolean; empty: boolean}) {
  const [rows, setRows] = useState(() => empty ? [] : SHARES());
  const [removing, setRemoving] = useState<Share>();
  const [status, setStatus] = useState('');
  const change = (s: Share, next: Partial<Share>) => setRows((rs) => rs.map((r) => (r.id === s.id ? {...r, ...next} : r)));
  const act: Act = {
    publish: (s, on) => {
      if (on) { const until = new Date(Date.now() + 30 * DAY).toISOString(); change(s, {state: 'public', until}); setStatus(`${s.title} on julkinen ${day(until)} asti. Kopioi linkki ja anna se, kenelle haluat.`); }
      else { change(s, {state: 'private', until: undefined}); setStatus(`${s.title} on nyt vain sinun. Osoite säilyy; julkaisu uudelleen herättää saman linkin.`); }
    },
    duration: (s, d) => { const until = new Date(Date.now() + d * DAY).toISOString(); change(s, {until}); setStatus(`${s.title} on julkinen ${day(until)} asti.`); },
    open: (s) => setStatus(`Avaisi kohteen ${s.title} omalle välilehdelle osoitteessa /n/….`),
    remove: (s) => setRemoving(s),
  };
  const dialog = (
    <ModalOverlay isOpen={!!removing} onOpenChange={(o) => { if (!o) setRemoving(undefined); }} className="ah-overlay" isDismissable>
      <Modal className="ah-modal">
        <AriaDialog className="ah-dialog" role="alertdialog" data-testid="js-remove-dialog" aria-label={linkTxt.removeTitle}>
          <Heading slot="title">{linkTxt.removeTitle}</Heading>
          <p>{removing ? linkTxt.removeDesc(removing.title) : ''}</p>
          <div className="ah-dialog-actions">
            <ControlButton size="page" variant="secondary" slot="close" autoFocus>{linkTxt.cancel}</ControlButton>
            <ControlButton data-testid="js-remove-confirm" size="page" variant="danger" onPress={() => {
              const s = removing!; setRows((rs) => rs.filter((r) => r.id !== s.id)); setRemoving(undefined);
              setStatus(`Osoite poistettu: ${s.title}. Kukaan ei voi enää avata sitä.`);
            }}>{linkTxt.removeConfirm}</ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
  const statusLine = status ? <p role="status" className="jp-status" data-testid="js-status">{status}</p> : null;

  const main = <div className="ah-state jp-state-page"><div className="jp-page jl-page">{statusLine}<ListDetail rows={rows} act={act} phone={phone} variant={direction} /></div></div>;

  const now = Date.now();
  const model = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/ws_openhabitat01?conversation=${m.agentId}`, workspaceId: 'ws_openhabitat01', workspaceName: 'open-habitat', activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: now - 12 * 60000, ...m,
  });
  const running = [model({agentId: 'pi:jaetut', title: 'Jaetut-sivun ulkoasu', detail: 'open-habitat · Odottaa viestiä'}), model({agentId: KUVAT.id, title: KUVAT.title, changedAt: now - 95 * 60000, detail: 'open-habitat · Odottaa viestiä'})];
  const pages = (
    <>
      <div className="ah-rail-home-row">
        <LinkRow href="/shares" data-testid="rail-shares" kind="home" current className="ah-rail-home">
          <Icon name="globe" /><span className="ah-rail-home-label">Jaetut</span>{counts(rows).public ? <span className="ah-rail-count">{counts(rows).public}</span> : null}
        </LinkRow>
      </div>
      <div className="ah-rail-home-row">
        <LinkRow href="/resources" kind="home" className="ah-rail-home">
          <Icon name="shield" /><span className="ah-rail-home-label">Agentin käytössä</span>
        </LinkRow>
      </div>
    </>
  );
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Birch" connectionLabel="Yhdistetty" connectionTone="success"
      homeCurrent={false} pages={pages}
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now" data-testid="rail-running" aria-labelledby="jp-running">
          <h2 className="ah-rail-section-head" id="jp-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
          <ul>{running.map((m) => <AgentNavItem key={m.agentId} {...m} now={now} />)}</ul>
        </section>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_fleetrepo01" />
      <WorkspaceNavRow name="open-habitat" href="/workspaces/ws_openhabitat01" />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle="Jaetut" navigationBadge={0} rail={rail} main={main} />
      {dialog}
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
let reviewEmpty = false;
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [empty, setEmpty] = useState(reviewEmpty);
  const bar = useRef<HTMLElement>(null);
  const phone = window.innerWidth <= 600;
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
        <strong>Jaetut-sivu · kierros 3</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label><input id="empty" type="checkbox" checked={empty} onChange={(e) => { reviewEmpty = e.target.checked; setEmpty(reviewEmpty); }} /> Ei vielä jakoja</label>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter initialEntries={['/shares']}>
          <Main key={String(empty)} direction={direction} phone={phone} empty={empty} />
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
