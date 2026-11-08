import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/Settings.css';
import {AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {Icon} from '../../../../web/src/components/Icon';
import {ControlButton, LinkRow, Segmented} from '../../../../web/src/components/ControlElements';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {OfferActions, OfferCard, OfferMark, OfferSeen, type OfferKind} from '../../../../web/src/components/OfferCard';
import {type ViewSummary, type ViewVisibility, viewFacts} from '../../../../web/src/components/ViewOffer';
import {OfferThumb, offerFacts, offerKind} from '../../../../web/src/components/FileOffer';
import {ImageThumbnail} from '../../../../web/src/components/ImageThumbnail';
import {CopyButton} from '../../../../web/src/components/ViewLink';
import {ViewSplit} from '../../../../web/src/components/ViewPanel';
import {HomeWorkspaces, type HomeConversation} from '../../../../web/src/components/HomeWorkspaces';
import {ViewLinkSettings} from '../../../../web/src/app/ViewLinkSettings';
import {formatExpiry, resetViewLinks} from '../../../../web/src/app/viewLinks';
import {shownSettingsSections} from '../../../../web/src/app/settingsIndex';
import type {FileOfferManifest, FileOfferSummary, OfferState} from '../../../../web/src/app/fileOffers';
import type {Workspace} from '../../../../web/src/app/snapshot';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {viewLinksText} from '../../../../web/src/text/viewLinks';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const linkTxt = liveText(viewLinksText);

// proto-shares-own-place, round 1. Jari 8.11.2026 (pilot.657): the person's
// view and file addresses, public or private, sit as a cramped block on
// Settings › Tili beside sign-out and the Git identity. The axis is where
// shares live and how a row presents itself. Every direction uses only what
// the host already has: the address list (ADR 0035: title, view or offer,
// state private/public/expired, public_until, created_at) joined in the
// browser to the person's views and offers (kind, files, size, folder,
// conversation) and the conversation list (title, workspace, archived);
// an offered image's bounded thumbnail. Every row carries the offer card's
// own icons (proto-offer-cards-consistent r3 A Kulma): the globe publishes
// for the site's default length, the date changes it, the link icon copies,
// the arrow opens the own tab; a bin deletes the address for good.
// 1 Asetukset: an own Settings section, grouped by state, small preview;
// 2 Alkulehti: the home page's band of what is public now, large previews;
// 3 Oma sivu: a page of its own under Etusivu, the conversation's cards
//   grouped by conversation, the card opening a preview beside.
const directions = ['Nyt', '1 Asetukset', '2 Alkulehti', '3 Oma sivu'];
const LINES = [
  'Nyt: tuotanto tänään. Osoitteet ovat Asetukset › Tili -sivulla uloskirjautumisen ja Git-identiteetin alla: otsikko, tila ja tekstipainikkeet.',
  '1 Asetukset: oma Jaetut-osio asetuksissa. Rivit ryhmissä Julkiset nyt, Vain sinä ja Päättyneet; pieni esikatselu ja kortin kuvakkeet aina näkyvissä.',
  '2 Alkulehti: etusivulla työtilojen alla Jaetut nyt -kortit isolla esikatselulla ja Kopioi linkki -painikkeella; yksityiset ja päättyneet yhden rivin takana.',
  '3 Oma sivu: Jaetut on oma sivu sivupalkissa Etusivun alla. Samat kortit kuin keskustelussa, keskusteluittain; kortti avaa esikatselun oikealle.',
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
  state: 'private' | 'public' | 'expired'; until?: string; url: string; contentUrl: string;
  /** Synthetic stand-ins for the host's bounded image thumbnails. */
  thumbs?: string[];
};

// Synthetic pictures in place of the host's thumbnails and of the panel's content.
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const shot = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 450"><rect width="720" height="450" fill="#17191d"/><rect x="24" y="24" width="672" height="402" rx="14" fill="#1f2228" stroke="#30343b"/><text x="48" y="70" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#e9e6df">Tili</text><circle cx="66" cy="118" r="18" fill="#59616d"/><rect x="96" y="104" width="170" height="12" rx="6" fill="#e9e6df"/><rect x="96" y="124" width="130" height="9" rx="4" fill="#8b919b"/><rect x="560" y="102" width="112" height="34" rx="8" fill="#30343b"/><line x1="24" y1="160" x2="696" y2="160" stroke="#30343b"/><rect x="48" y="186" width="150" height="12" rx="6" fill="#e9e6df"/><rect x="48" y="208" width="250" height="9" rx="4" fill="#8b919b"/><rect x="520" y="190" width="152" height="34" rx="8" fill="#30343b"/><line x1="24" y1="250" x2="696" y2="250" stroke="#30343b"/><rect x="48" y="276" width="120" height="12" rx="6" fill="#e9e6df"/><rect x="230" y="276" width="190" height="12" rx="6" fill="#e9e6df"/><rect x="230" y="296" width="120" height="9" rx="4" fill="#8b919b"/><rect x="454" y="274" width="64" height="32" rx="8" fill="#30343b"/><rect x="526" y="274" width="146" height="32" rx="8" fill="#30343b"/><rect x="230" y="320" width="64" height="32" rx="8" fill="#e8a58d"/><rect x="230" y="372" width="170" height="12" rx="6" fill="#e9e6df"/><rect x="600" y="368" width="72" height="32" rx="8" fill="#e8a58d"/></svg>`);
const photo = (h: number) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${h},55%,72%)"/><stop offset="1" stop-color="hsl(${h + 30},45%,88%)"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><circle cx="${220 - h % 90}" cy="70" r="26" fill="hsl(${h + 180},70%,92%)"/><path d="M0 190 L70 120 L130 170 L200 100 L320 200 L320 240 L0 240Z" fill="hsl(${h + 200},30%,38%)"/><path d="M0 215 L90 175 L170 210 L260 165 L320 190 L320 240 L0 240Z" fill="hsl(${h + 210},28%,26%)"/></svg>`);
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
let host = 'habitat.example';
const share = (seed: string, title: string, item: Item, conv: Conv | undefined, created: string, state: Share['state'], until?: string, thumbs?: string[]): Share => ({
  id: `a${b32(seed)}`, title, item, conv, created: at(created), state, until: until ? at(until) : undefined,
  url: `https://${host}/n/${secret(seed + 'entry')}`, contentUrl: `https://v-${b32(seed).slice(0, 8)}.views.example/${secret(seed + 'content')}/`, thumbs,
});
const images = ['ranta', 'metsa', 'jarvi', 'tunturi', 'satama', 'pelto'];
const SHARES = (): Share[] => [
  share('kuvakaappaus', 'Asetukset › Tili, kuvakaappaus', offer('kuvakaappaus', 'Asetukset › Tili, kuvakaappaus', [{path: 'tili-2026-11-08.png', bytes: 217 * 1024, kind: 'image', width: 1440, height: 900}], '2026-11-08T10:12:00+02:00', KUVAT), KUVAT, '2026-11-08T10:14:00+02:00', 'public', '2026-11-15T10:14:00+02:00', [shot]),
  share('testikierros', 'Testikierros 7.11. – tilanne', view('testikierros', 'Testikierros 7.11. – tilanne', 'tilanne/index.html', 4, 186 * 1024, '2026-11-07T18:40:00+02:00', KIERROS7), KIERROS7, '2026-11-07T18:41:00+02:00', 'public', '2026-12-07T18:41:00+02:00'),
  share('testikuvat', 'Testikuvat', offer('testikuvat', 'Testikuvat', images.map((n, i) => ({path: `testikuvat/${n}.jpg`, bytes: (380 + i * 90) * 1024, kind: 'image' as const, width: 2048, height: 1536})), '2026-11-08T09:30:00+02:00', KUVAT, 'testikuvat'), KUVAT, '2026-11-08T09:31:00+02:00', 'private', undefined, images.map((_, i) => photo(i * 47 + 20))),
  share('myyntitaulukko', 'Myyntitaulukko (testi)', view('myyntitaulukko', 'Myyntitaulukko (testi)', 'myynti.html', 1, 48 * 1024, '2026-11-07T15:02:00+02:00', KORTIT), KORTIT, '2026-11-07T15:03:00+02:00', 'private'),
  share('tarjouskortit', 'Testinäkymä – tarjouskortit', view('tarjouskortit', 'Testinäkymä – tarjouskortit', 'kortit/index.html', 3, 92 * 1024, '2026-11-07T14:20:00+02:00', KORTIT), KORTIT, '2026-11-07T14:21:00+02:00', 'private'),
  share('tarjouspdf', 'Tarjous – Asunto Oy Koivula', offer('tarjouspdf', 'Tarjous – Asunto Oy Koivula', [{path: 'tarjous-koivula.pdf', bytes: 340 * 1024, kind: 'pdf'}], '2026-11-07T13:05:00+02:00', KORTIT), KORTIT, '2026-11-07T13:06:00+02:00', 'private'),
  share('testiraportti', 'Testiraportti /var/tmp:stä', view('testiraportti', 'Testiraportti /var/tmp:stä', 'raportti.html', 1, 22 * 1024, '2026-11-06T16:30:00+02:00', RAPORTTI), RAPORTTI, '2026-11-06T16:31:00+02:00', 'private'),
  share('tapahtumaloki', 'Pilotin tapahtumaloki', offer('tapahtumaloki', 'Pilotin tapahtumaloki', [{path: 'tapahtumat.csv', bytes: 1260 * 1024, kind: 'csv', lines: 18421, columns: 6}], '2026-10-31T11:00:00+02:00', RAPORTTI), RAPORTTI, '2026-10-31T11:02:00+02:00', 'expired', '2026-11-07T11:02:00+02:00'),
  share('kierrosviisi', 'Testikierros 5.11. – tilanne', view('kierrosviisi', 'Testikierros 5.11. – tilanne', 'tilanne/index.html', 4, 171 * 1024, '2026-11-05T17:10:00+02:00', KIERROS5), KIERROS5, '2026-11-05T17:11:00+02:00', 'expired', '2026-11-06T17:11:00+02:00'),
  share('vanhakortti', 'Testinäkymä – vanha kortti', {kind: 'gone'}, undefined, '2026-11-04T12:00:00+02:00', 'private'),
];

const kindOf = (s: Share): OfferKind => s.item.kind === 'view' ? 'view' : s.item.kind === 'file' ? offerKind(s.item.offer, ready(s)) : 'file';
const ready = (s: Share): OfferState => s.item.kind === 'file' ? {state: 'ready', manifest: s.item.manifest} : {state: 'removed'};
const factsOf = (s: Share) => s.item.kind === 'view' ? viewFacts(s.item.view) : s.item.kind === 'file' ? offerFacts(s.item.offer, ready(s)) : [];
const isPub = (s: Share) => s.state === 'public';
const group = (s: Share): 'public' | 'private' | 'past' => s.item.kind === 'gone' || s.state === 'expired' ? 'past' : isPub(s) ? 'public' : 'private';
const day = (iso: string) => formatExpiry(iso);
/** The row's state in words, from the address and the joined item. */
const stateWords = (s: Share) => s.item.kind === 'gone' ? 'Kohde on poistettu; osoite ei avaa enää mitään'
  : s.state === 'expired' ? `Julkisuus päättyi ${day(s.until!)}` : isPub(s) ? linkTxt.publicUntil(day(s.until!)) : linkTxt.isPrivate;

// ---- Actions every direction shares ----
type Act = {
  publish: (s: Share, on: boolean) => void; duration: (s: Share, days: number) => void;
  open: (s: Share) => void; remove: (s: Share) => void; preview?: (s: Share) => void;
};
const visibility = (s: Share, act: Act, copy = true): ViewVisibility => ({
  public: isPub(s), until: isPub(s) ? s.until : undefined, url: isPub(s) && copy ? s.url : undefined, maxDays: MAX_DAYS,
  onPublic: (on) => act.publish(s, on), onDuration: (d) => act.duration(s, d),
});
/** The offer card's own icons, then a bin that deletes the address for good. */
function Icons({s, act, copy = true}: {s: Share; act: Act; copy?: boolean}) {
  const gone = s.item.kind === 'gone';
  return (
    <OfferActions label={s.title} publish={gone ? undefined : visibility(s, act, copy)} onTab={gone ? undefined : () => act.open(s)}>
      <ControlButton size="row" variant="quiet" className="ah-offer-ib js-bin" data-testid="js-remove"
        aria-label={`Poista osoite: ${s.title}`} title="Poista osoite pysyvästi" onPress={() => act.remove(s)}>
        <Icon name="trash" />
      </ControlButton>
    </OfferActions>
  );
}
function ConvLink({c}: {c: Conv}) {
  return <LinkRow kind="inline" href={`/workspaces/${c.wsId}?conversation=${c.id}`}>{c.title}</LinkRow>;
}
function From({s}: {s: Share}) {
  if (!s.conv) return <span className="js-from">ei keskustelua: kohde on poistettu</span>;
  return <span className="js-from">keskustelusta <ConvLink c={s.conv} /> · {s.conv.ws}{s.conv.archived ? <> <span className="js-tag">arkistoitu</span></> : null}</span>;
}
/** A preview from what the host has: an offered image's thumbnail, a
 * folder's first images, a file's extension, a view's mark (views have no
 * picture of their own on the host). */
function Thumb({s, size}: {s: Share; size: 's' | 'm' | 'l'}) {
  const cls = `js-thumb js-thumb-${size}`;
  if (s.item.kind === 'gone') return <span className={`${cls} gone`} aria-hidden="true"><Icon name="slash" /></span>;
  if (s.item.kind === 'view')
    return <span className={`${cls} view`} aria-hidden="true"><OfferMark kind="view" size={size === 's' ? 's' : 'm'} />{size !== 's' ? <small>{s.item.view.entry.split('/').pop()}</small> : null}</span>;
  const items = s.item.manifest.items;
  if (s.thumbs?.length && items.length > 1) {
    const n = size === 's' ? 1 : size === 'm' ? 3 : 4;
    return (
      <span className={`${cls} mosaic n${Math.min(n, s.thumbs.length)}`} aria-hidden="true">
        {s.thumbs.slice(0, n).map((t, i) => <ImageThumbnail key={i} src={t} />)}
        {s.thumbs.length > n && size !== 's' ? <span className="js-more">+{s.thumbs.length - n}</span> : null}
      </span>
    );
  }
  if (s.thumbs?.length) return <span className={`${cls} image`} aria-hidden="true"><ImageThumbnail src={s.thumbs[0]} /></span>;
  return <span className={`${cls} file`} aria-hidden="true"><OfferThumb offerId={s.item.offer.offer_id} item={items[0]} /></span>;
}
function StateLine({s}: {s: Share}) {
  return (
    <span className="js-state" data-state={group(s)}>
      {s.item.kind === 'gone' ? <Icon name="slash" /> : s.state === 'expired' ? <Icon name="clock" /> : <Icon name={isPub(s) ? 'globe' : 'lock'} />}
      <span>{stateWords(s)}</span>
    </span>
  );
}
const counts = (rows: Share[]) => ({
  public: rows.filter((s) => group(s) === 'public').length,
  private: rows.filter((s) => group(s) === 'private').length,
  past: rows.filter((s) => group(s) === 'past').length,
});

// ---- 1 Asetukset: own section ----
const GROUPS = [
  {key: 'public', head: 'Julkiset nyt', empty: 'Mikään ei ole nyt julkinen.'},
  {key: 'private', head: 'Vain sinä', empty: ''},
  {key: 'past', head: 'Päättyneet ja poistetut', empty: ''},
] as const;
function SettingsShares({rows, act}: {rows: Share[]; act: Act}) {
  return (
    <div className="s-stack js1" data-testid="js-section">
      <p className="s-intro">Näkymät ja tiedostot, joille olet avannut oman osoitteen. Julkisen voi avata kuka tahansa, jolla osoite on, kirjautumatta. Poistettu osoite ei toimi enää koskaan; kohde itse säilyy keskustelussa.</p>
      {GROUPS.map((g) => {
        const mine = rows.filter((s) => group(s) === g.key);
        if (!mine.length && !g.empty) return null;
        return (
          <section key={g.key} className="js1-group" data-testid="js-group" data-group={g.key} aria-label={g.head}>
            <h3 className="s-h3">{g.head} <span className="js-count">{mine.length}</span></h3>
            {mine.length ? (
              <ul className="s-card js1-list">
                {mine.map((s) => (
                  <li key={s.id} className="js1-row" data-testid="js-row" data-group={g.key}>
                    <Thumb s={s} size="s" />
                    <span className="js1-text">
                      <strong className={s.item.kind === 'gone' ? 'js-gone' : undefined}>{s.title}</strong>
                      <span className="js-facts">{[...factsOf(s), ''].join(' · ')}<From s={s} /></span>
                      <StateLine s={s} />
                    </span>
                    <span className="js1-acts"><Icons s={s} act={act} /></span>
                  </li>
                ))}
              </ul>
            ) : <p className="s-desc">{g.empty}</p>}
          </section>
        );
      })}
    </div>
  );
}

// ---- 2 Alkulehti: what is public now ----
function HomeShares({rows, act}: {rows: Share[]; act: Act}) {
  const [all, setAll] = useState(false);
  const c = counts(rows);
  const shown = rows.filter((s) => group(s) === 'public');
  const rest = rows.filter((s) => group(s) !== 'public');
  const Tile = ({s, small}: {s: Share; small?: boolean}) => (
    <li className={`js2-tile${small ? ' small' : ''}`} data-testid="js-row" data-group={group(s)}>
      <Thumb s={s} size={small ? 'm' : 'l'} />
      <span className="js2-body">
        <strong className={s.item.kind === 'gone' ? 'js-gone' : undefined}>{s.title}</strong>
        <StateLine s={s} />
        <span className="js-facts">{[...factsOf(s), ''].join(' · ')}<From s={s} /></span>
      </span>
      <span className="js2-acts">
        {isPub(s) ? <CopyButton text={s.url} data-testid="js-copy" /> : null}
        <Icons s={s} act={act} copy={false} />
      </span>
    </li>
  );
  return (
    <section className="ah-home-section js2" data-testid="js-section" aria-label="Jaetut">
      <header className="ah-home-workspace-head js2-head">
        <h2><Icon name="globe" /> Jaetut nyt</h2>
        <span>{c.public ? `${c.public} julkista` : 'ei mitään julkista'}</span>
        <span className="ah-home-grow" />
      </header>
      {shown.length ? <ul className="js2-grid">{shown.map((s) => <Tile key={s.id} s={s} />)}</ul>
        : <p className="js-empty">Mikään näkymä tai tiedosto ei ole nyt julkinen.</p>}
      <button type="button" className="js2-rest" aria-expanded={all} data-testid="js-rest" onClick={() => setAll(!all)}>
        <span className="js-chev" aria-hidden="true" />
        <span><b>Muut osoitteet {rest.length}</b> · vain sinä {c.private} · päättyneet ja poistetut {c.past}</span>
      </button>
      {all ? <ul className="js2-grid small">{rest.map((s) => <Tile key={s.id} s={s} small />)}</ul> : null}
    </section>
  );
}

// ---- 3 Oma sivu: the conversation's cards, by conversation ----
type Filter = 'all' | 'public' | 'private' | 'past';
function SharesPage({rows, act, openId, phone}: {rows: Share[]; act: Act; openId?: string; phone: boolean}) {
  const [filter, setFilter] = useState<Filter>('all');
  const c = counts(rows);
  const shown = rows.filter((s) => filter === 'all' || group(s) === filter);
  const convs = [...new Set(shown.map((s) => s.conv))];
  return (
    <div className="js3" data-testid="js-section">
      <header className="js3-head">
        <h1>Jaetut</h1>
        <p>Näkymät ja tiedostot, joilla on oma osoite: {c.public} julkista, {c.private} vain sinulle, {c.past} päättynyttä tai poistettua.</p>
      </header>
      <Segmented data-testid="js-filter" label="Näytä" size="row" value={filter} onChange={(v) => setFilter(v as Filter)}
        options={[{id: 'all', label: `Kaikki ${rows.length}`}, {id: 'public', label: `Julkiset ${c.public}`}, {id: 'private', label: `Vain sinä ${c.private}`}, {id: 'past', label: `Päättyneet ${c.past}`}]} />
      {convs.map((conv) => {
        const mine = shown.filter((s) => s.conv === conv);
        return (
          <section key={conv?.id ?? 'gone'} className="js3-group" data-testid="js-group" aria-label={conv?.title ?? 'Poistetut kohteet'}>
            <h2 className="js3-conv">
              {conv ? <><Icon name="agent" /> <ConvLink c={conv} /> <span className="js3-ws">{conv.ws}</span>{conv.archived ? <span className="js-tag">arkistoitu</span> : null}</>
                : <><Icon name="slash" /> <span>Kohde poistettu</span></>}
            </h2>
            <div className="js3-cards">
              {mine.map((s) => (
                <div key={s.id} className="js3-card" data-testid="js-row" data-group={group(s)}>
                  <OfferCard kind={kindOf(s)} title={s.title} facts={factsOf(s)} until={isPub(s) ? s.until : undefined}
                    open={openId === s.id} inert={s.item.kind === 'gone'}
                    onToggle={s.item.kind === 'gone' ? undefined : () => act.preview?.(s)}
                    media={s.thumbs ? <Thumb s={s} size="m" /> : null}
                    status={s.state === 'expired' || s.item.kind === 'gone' ? <span className="js3-status"><StateLine s={s} /></span> : null}
                    actions={<Icons s={s} act={act} />}
                    aria-label={s.title} data-testid="js-card" data-touch={phone ? 'true' : undefined} />
                  {s.item.kind === 'gone' ? <span className="js3-gone-acts"><Icons s={s} act={act} /></span> : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
function PreviewPane({s, act, onClose}: {s: Share; act: Act; onClose: () => void}) {
  const big = s.item.kind === 'view' ? page(s.title, 'view') : s.item.kind === 'file' && !s.thumbs
    ? page(s.title, s.item.manifest.items[0].kind === 'csv' ? 'csv' : 'pdf') : undefined;
  return (
    <section className="ah-view-pane js3-pane" data-testid="js-pane" aria-label={s.title}>
      <header className="js3-pane-head">
        <OfferMark kind={kindOf(s)} size="s" />
        <strong>{s.title}</strong>
        <Icons s={s} act={act} />
        <ControlButton size="row" variant="quiet" className="ah-offer-ib" aria-label="Sulje" title="Sulje" data-testid="js-pane-close" onPress={onClose}><Icon name="cross" /></ControlButton>
      </header>
      <div className="js3-pane-body">
        {big ? <img src={big} alt="" /> : s.thumbs && s.thumbs.length > 1 ? <div className="js3-pane-grid">{s.thumbs.map((t, i) => <img key={i} src={t} alt="" />)}</div>
          : s.thumbs ? <img src={s.thumbs[0]} alt="" /> : null}
        <p className="js3-pane-note">{s.item.kind === 'view' ? 'Näkymä avautuu tähän kuten keskustelussa.' : 'Tiedosto avautuu tähän kuten keskustelussa.'} <StateLine s={s} /></p>
      </div>
    </section>
  );
}

// ---- Nyt: production's Tili block with the same addresses from the host ----
const toAddress = (s: Share) => ({
  address_id: s.id, ...(s.item.kind === 'file' ? {offer_id: s.item.offer.offer_id} : s.item.kind === 'view' ? {view_id: s.item.view.view_id} : {view_id: `v${b32('vanhakortti')}`}),
  title: s.title, url: s.url, content_url: s.contentUrl, state: s.state, created_at: s.created, ...(s.state !== 'private' ? {public_until: s.until} : {}),
});
let hostRows: Share[] = [];
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), {status, headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (path === '/api/v1/view-addresses') return json({schema_version: 1, max_days: MAX_DAYS, addresses: hostRows.map(toAddress)});
  if (path.startsWith('/api/v1/view-addresses/')) {
    const body = JSON.parse(String(init?.body ?? '{}'));
    const s = hostRows.find((r) => r.id === body.address_id);
    if (path.endsWith('/delete')) { hostRows = hostRows.filter((r) => r !== s); return new Response(null, {status: 204}); }
    if (s && path.endsWith('/private')) { s.state = 'private'; s.until = undefined; }
    return json({schema_version: 1, address: s && toAddress(s)});
  }
  if (/^\/api\/v1\/agents\/.*\/recap$/.test(path)) return json({schema_version: 1, recap: null, latest_message: 'Valmis.', latest_message_at: new Date(Date.now() - 40 * 60000).toISOString()});
  if (path.startsWith('/api/')) return json({}, 200);
  return realFetch(input, init);
};
function NowTili() {
  const [ready, setReady] = useState(false);
  useEffect(() => { host = window.location.host || host; hostRows = SHARES(); resetViewLinks(); setReady(true); }, []);
  return (
    <div className="s-card">
      <div className="s-row" data-settings-row="account">
        <span className="js-person"><span className="js-avatar" aria-hidden="true">JM</span><span><strong>Jari Mustonen</strong><span className="s-desc">maintainer@example.org</span></span></span>
        <div className="s-val"><ControlButton size="row" variant="secondary">Kirjaudu ulos…</ControlButton></div>
      </div>
      <div className="s-row" data-settings-row="git-identity">
        <div className="s-lbl"><strong>Git-identiteetti</strong><span className="s-desc">Commitien tekijä. Tallentuu globaaliin <code>~/.gitconfig</code>-tiedostoon.</span></div>
        <div className="s-val"><ControlButton size="row" variant="secondary">Muokkaa Git-identiteettiä</ControlButton></div>
      </div>
      {ready ? <ViewLinkSettings csrf="prototype" /> : null}
    </div>
  );
}

// ---- The pages ----
const noop = () => {};
const WS: Workspace[] = ['fleetrepo', 'open-habitat'].map((n) => ({
  workspace_id: n === 'fleetrepo' ? 'ws_fleetrepo01' : 'ws_openhabitat01', name: n, path: `/home/maintainer/src/${n}`,
  presence: 'present', kind: 'git_main_worktree', visibility: 'visible', mutation_state: 'allowed', facts: [], git_summary: {branch: 'main', dirty_count: 0},
} as unknown as Workspace));
const HOME: HomeConversation[] = [
  {id: 'pi:jaetut', workspaceId: 'ws_openhabitat01', href: '/agents/pi:jaetut', title: 'Jaetut omalle paikalleen', workspace: 'open-habitat', browserSession: false, process: 'not_observed', command: 'idle'},
  {id: KUVAT.id, workspaceId: 'ws_openhabitat01', href: `/agents/${KUVAT.id}`, title: KUVAT.title, workspace: 'open-habitat', browserSession: false, process: 'not_observed', command: 'idle'},
  {id: KIERROS7.id, workspaceId: 'ws_openhabitat01', href: `/agents/${KIERROS7.id}`, title: KIERROS7.title, workspace: 'open-habitat', browserSession: false, process: 'not_observed', command: 'idle'},
] as HomeConversation[];

type Removing = Share | undefined;
function Main({direction, phone}: {direction: number; phone: boolean}) {
  const [rows, setRows] = useState(SHARES);
  const [removing, setRemoving] = useState<Removing>();
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState<string | undefined>();
  const [width, setWidth] = useState(380);
  const change = (s: Share, next: Partial<Share>) => setRows((rs) => rs.map((r) => (r.id === s.id ? {...r, ...next} : r)));
  const act: Act = {
    publish: (s, on) => {
      if (on) { const until = new Date(Date.now() + 30 * DAY).toISOString(); change(s, {state: 'public', until}); setStatus(`${s.title} on julkinen ${day(until)} asti. Kopioi linkki ja anna se, kenelle haluat.`); }
      else { change(s, {state: 'private', until: undefined}); setStatus(`${s.title} on nyt vain sinun. Osoite säilyy; julkaisu uudelleen herättää saman linkin.`); }
    },
    duration: (s, d) => { const until = new Date(Date.now() + d * DAY).toISOString(); change(s, {until}); setStatus(`${s.title} on julkinen ${day(until)} asti.`); },
    open: (s) => setStatus(`Avaisi kohteen ${s.title} omalle välilehdelle osoitteessa /n/….`),
    remove: (s) => setRemoving(s),
    preview: (s) => setOpenId(openId === s.id ? undefined : s.id),
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
              if (openId === s.id) setOpenId(undefined);
              setStatus(`Osoite poistettu: ${s.title}. Kukaan ei voi enää avata sitä.`);
            }}>{linkTxt.removeConfirm}</ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
  const statusLine = status ? <p role="status" className="js-status" data-testid="js-status">{status}</p> : null;

  const settings = (current: 'tili' | 'jaetut', body: React.ReactNode) => {
    const own = shownSettingsSections('fi').filter((e) => !('admin' in e) || !e.admin);
    const nav = direction === 1 ? own.flatMap((e) => e.id === 'tili' ? [e, {id: 'jaetut', label: 'Jaetut', icon: 'globe' as const}] : [e]) : own;
    return (
      <section className="ah-account-settings s-page detail js-settings">
        <nav className="s-nav" aria-label="Asetusten osiot">
          <h1>Asetukset</h1>
          {nav.map((e) => <span key={e.id} className="s-nav-i" data-testid={`settings-${e.id}`} aria-current={e.id === current ? 'page' : undefined}><Icon name={e.icon} />{e.label}</span>)}
        </nav>
        <div className="s-main">
          <ControlButton className="s-back" variant="quiet" size="row" presentation="back">Asetukset</ControlButton>
          <h2 data-testid={`settings-section-${current}`}>{current === 'tili' ? 'Tili' : 'Jaetut'}</h2>
          {statusLine}
          {body}
        </div>
      </section>
    );
  };
  let main: React.ReactNode;
  if (direction === 0) main = <div className="ah-state js-page">{settings('tili', <NowTili />)}</div>;
  else if (direction === 1) main = <div className="ah-state js-page">{settings('jaetut', <SettingsShares rows={rows} act={act} />)}</div>;
  else if (direction === 2) main = (
    <div className="ah-state js-page js-home">
      <HomeWorkspaces workspaces={WS} conversations={HOME} onCreate={noop} />
      <div className="ah-home js2-wrap">{statusLine}<HomeShares rows={rows} act={act} /></div>
    </div>
  );
  else {
    const open = rows.find((s) => s.id === openId);
    main = (
      <div className="ah-state js-split">
        <ViewSplit open={!!open} expanded={false} width={width} min={320} max={Math.max(320, innerWidth - 300 - 420)}
          onResize={setWidth} onReset={noop} onShowConversation={() => setOpenId(undefined)}
          panel={open ? <PreviewPane key={open.id} s={open} act={act} onClose={() => setOpenId(undefined)} /> : null}>
          <div className="js-page">{statusLine}<SharesPage rows={rows} act={act} openId={openId} phone={phone} /></div>
        </ViewSplit>
      </div>
    );
  }

  const now = Date.now();
  const model = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/ws_openhabitat01?conversation=${m.agentId}`, workspaceId: 'ws_openhabitat01', workspaceName: 'open-habitat', activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: now - 12 * 60000, ...m,
  });
  const running = [model({agentId: 'pi:jaetut', title: 'Jaetut omalle paikalleen', detail: 'open-habitat · Odottaa viestiä'}), model({agentId: KUVAT.id, title: KUVAT.title, changedAt: now - 95 * 60000, detail: 'open-habitat · Odottaa viestiä'})];
  const pages = direction === 3 ? (
    <div className="ah-rail-home-row">
      <LinkRow href="/shares" data-testid="rail-shares" kind="home" current className="ah-rail-home">
        <Icon name="globe" /><span className="ah-rail-home-label">Jaetut</span><span className="ah-rail-count js-rail-count">{counts(rows).public}</span>
      </LinkRow>
    </div>
  ) : undefined;
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Birch" connectionLabel="Yhdistetty" connectionTone="success"
      homeCurrent={direction === 2} pages={pages}
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now" data-testid="rail-running" aria-labelledby="js-running">
          <h2 className="ah-rail-section-head" id="js-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
          <ul>{running.map((m) => <AgentNavItem key={m.agentId} {...m} now={now} />)}</ul>
        </section>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_fleetrepo01" />
      <WorkspaceNavRow name="open-habitat" href="/workspaces/ws_openhabitat01" />
    </WorkspaceRail>
  );
  const title = direction === 2 ? 'Etusivu' : direction === 3 ? 'Jaetut' : 'Asetukset';
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} navigationBadge={0} rail={rail} main={main} />
      {dialog}
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
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
        <strong>Jaetut · kierros 1</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter initialEntries={[direction === 2 ? '/workspaces' : direction === 3 ? '/shares' : '/settings']}>
          <Main direction={direction} phone={phone} />
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  pickerNav.append(button);
});
document.body.append(pickerNav);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
