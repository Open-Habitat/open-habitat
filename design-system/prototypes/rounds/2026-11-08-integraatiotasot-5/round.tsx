import React, {Fragment, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {appErrors, shortClientID} from '../../../../web/src/app/serverIntegrations';
import {ControlButton as Button, ExternalLink} from '../../../../web/src/components/ControlElements';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {Checkbox, TextField} from '../../../../web/src/components/Primitives';
import {StatusMark} from '../../../../web/src/components/Status';
import {ProviderMark} from '../../../../web/src/components/Integrations';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/ServerIntegrations.css';
import '../../../../web/src/components/Integrations.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
// The masked Entra crops of proto-m365-setup-flow round 3, reused as they are:
// crops.py there is the only writer, and check.mjs here verifies the same
// files. This round holds no image and draws no Entra screen.
import record from '../2026-11-06-m365-leikkeet/crops.json';
import registerImg from '../2026-11-06-m365-leikkeet/crops/register.avif';
import listImg from '../2026-11-06-m365-leikkeet/crops/list.avif';
import overviewImg from '../2026-11-06-m365-leikkeet/crops/overview.avif';
import authImg from '../2026-11-06-m365-leikkeet/crops/auth.avif';
import permsImg from '../2026-11-06-m365-leikkeet/crops/perms.avif';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// Integration access levels, round 5 (proto-integration-levels). Jari chose
// round 4's "every application in full" walk, but the guide has to skip
// what is already done, or let the administrator choose at the start which
// of the four levels (four Entra applications) to set up now, with the
// comparison table at the start. The riffs are three start pages: the table
// with a checkbox per level, the table itself as the chooser (a level's
// column starts that level), and a status list with Aseta per row and the
// table behind Mitä tasot sallivat. A level counts as set when root's
// integrations file has a usable section for it, which the browser already
// reads (GET /api/v1/server/integrations: client id, tenant, source, actor,
// at); the start says where that knowledge comes from. The chosen levels
// then walk in full, round 4's clicking path over the real masked Entra
// crops, without the done ones. Synthetic.
const directions = ['Rastit taulukossa', 'Taulukko valitsimena', 'Tilalista'];
const LINES = [
  'Rastit taulukossa: aloitus on vertailutaulukko, jonka jokaisen asettamattoman tason sarakkeessa on rasti Aseta nyt; asetetuissa lukee Asetettu ja taulukon alla, mistä se tiedetään. Aloita käy rastitetut läpi.',
  'Taulukko valitsimena: sama taulukko, mutta asettamattoman tason sarake on itse painike; sen painaminen aloittaa juuri sen tason, ja tallennuksen jälkeen palataan taulukkoon.',
  'Tilalista: aloitus on neljän tason lista (asetettu / ei asetettu, kenen ja milloin) ja jokaisella puuttuvalla rivillä Aseta; taulukko on Mitä tasot sallivat -painikkeen takana.',
];
const COMMON = 'Kaikissa: taso on asetettu, kun palvelimen integraatiotiedostossa on sille käytettävät tunnukset (selain lukee ne jo nyt). Asetettu taso ohitetaan, ja valitut tasot käydään läpi kokonaan kierroksen 4 klikkauspolkuna. Tenant ID otetaan jo tallennetulta tasolta.';
const CHECKS = 0, TABLE = 1, LIST = 2;

/* ---------- what each level allows (round 2's comparison table) ---------- */

type Prov = 'microsoft' | 'google' | 'dropbox';
type Svc = 'mail' | 'calendar' | 'contacts' | 'files';
/** read; drafts = mail organised and drafted; edit = changed without
 * sending or sharing; full = changed and sent or shared; app = Dropbox app folder. */
type Ab = 'read' | 'drafts' | 'edit' | 'full' | 'app';
type Combo = Partial<Record<Svc, Ab>>;
const PNAME: Record<Prov, string> = {microsoft: 'Microsoft 365', google: 'Google', dropbox: 'Dropbox'};
const SVCS: Record<Prov, Svc[]> = {microsoft: ['mail', 'calendar', 'contacts', 'files'], google: ['mail', 'calendar', 'contacts', 'files'], dropbox: ['files']};
const SNAME: Record<Prov, Record<Svc, string>> = {
  microsoft: {mail: 'Outlook-posti', calendar: 'Outlook-kalenteri', contacts: 'Yhteystiedot', files: 'OneDrive ja SharePoint'},
  google: {mail: 'Gmail', calendar: 'Google-kalenteri', contacts: 'Google-yhteystiedot', files: 'Google Drive'},
  dropbox: {mail: '', calendar: '', contacts: '', files: 'Dropbox'},
};
const SICON: Record<Svc, IconName> = {mail: 'mail', calendar: 'calendar', contacts: 'contacts', files: 'folder'};

/** One row of the table: an ability, the level it needs, and what the
 * provider cannot prevent once it is granted. */
type Row = {ab: Ab; label: string; warn?: string};
function rows(p: Prov, s: Svc): Row[] {
  const r: Row = {ab: 'read', label: s === 'calendar' || s === 'contacts' ? 'Näkee' : 'Lukee'};
  if (s === 'mail') return p === 'microsoft'
    ? [r, {ab: 'drafts', label: 'Järjestelee ja luonnostelee'}, {ab: 'full', label: 'Lähettää'}]
    : [r, {ab: 'full', label: 'Muuttaa ja lähettää', warn: 'Gmail ei erota muutoksia lähettämisestä'}];
  if (s === 'calendar') return [r, {ab: 'full', label: 'Muokkaa tapahtumia', warn: p === 'microsoft' ? 'Osallistujat saavat aina kutsun' : 'Voi lähettää osallistujille kutsun'}];
  if (s === 'contacts') return [r, {ab: 'edit', label: 'Muokkaa'}];
  if (p === 'dropbox') return [r, {ab: 'edit', label: 'Muokkaa'}, {ab: 'full', label: 'Jakaa'}];
  return [r, {ab: 'full', label: 'Muokkaa ja voi jakaa', warn: p === 'microsoft' ? 'Jakolinkki voi avautua kenelle tahansa, jos organisaatio sallii' : 'Jakaminen sisältyy muokkaukseen'}];
}
const rank: Record<Ab, number> = {read: 0, drafts: 1, edit: 1, app: 1, full: 2};
const grants = (row: Row, a: Ab) => a === 'app' ? (row.ab === 'full' ? 'no' : 'part') : rank[a] >= rank[row.ab] ? 'yes' : 'no';

type LevelId = 'full' | 'nosend' | 'drafts' | 'read' | 'app' | 'gnomail';
type Level = {id: LevelId; name: string; combo: Combo};
const C = {
  full: {mail: 'full', calendar: 'full', contacts: 'edit', files: 'full'} as Combo,
  nosend: {mail: 'drafts', calendar: 'full', contacts: 'edit', files: 'full'} as Combo,
  drafts: {mail: 'drafts', calendar: 'read', contacts: 'read', files: 'read'} as Combo,
  read: {mail: 'read', calendar: 'read', contacts: 'read', files: 'read'} as Combo,
};
function levels(p: Prov): Level[] {
  if (p === 'dropbox') return [
    {id: 'full', name: 'Koko Dropbox', combo: {files: 'full'}},
    {id: 'nosend', name: 'Kaikki paitsi jakaminen', combo: {files: 'edit'}},
    {id: 'app', name: 'Vain sovelluskansio', combo: {files: 'app'}},
    {id: 'read', name: 'Vain luku', combo: {files: 'read'}},
  ];
  if (p === 'google') return [
    {id: 'full', name: 'Täysi', combo: C.full},
    {id: 'gnomail', name: 'Kaikki paitsi Gmailin muutokset', combo: {mail: 'read', calendar: 'full', contacts: 'edit', files: 'full'}},
    {id: 'read', name: 'Vain luku', combo: C.read},
  ];
  return MS.map(m => ({id: m.id, name: m.name, combo: C[m.id]}));
}
// Column headers break at syllables on a phone, not mid-letter.
const SOFT: Record<string, string> = {Luonnokset: 'Luon\u00adnok\u00adset', sovelluskansio: 'sovellus\u00adkansio', jakaminen: 'jaka\u00adminen', muutokset: 'muu\u00adtok\u00adset', tunnuksia: 'tun\u00adnuk\u00adsia', luonnostelee: 'luonnos\u00adtelee', Järjestelee: 'Järjes\u00adtelee', lähetys: 'lähe\u00adtys'};
const soft = (t: string) => t.replace(/[A-Za-zÄÖäö]+/g, w => SOFT[w] ?? w);

/** The provider's levels side by side, ✓ Kyllä or ✕ Ei in every cell.
 * head adds a level's own header content (state, checkbox, button); pick
 * makes a level's whole column a target, its header carrying the button. */
function Compare({p, state, head, pick, chosen, testid}: {p: Prov; state?: (l: Level) => string; head?: (l: Level) => React.ReactNode;
  pick?: (l: Level) => boolean; chosen?: (l: Level) => boolean; testid: string}) {
  const ls = levels(p);
  const [hot, setHot] = useState<string | null>(null);
  const forward = (e: React.MouseEvent<HTMLElement>, l: Level) =>
    (e.currentTarget.closest('table')?.querySelector(`[data-testid="col-${l.id}"] button`) as HTMLElement | null)?.click();
  const col = (l: Level) => ({'data-hot': hot === l.id || undefined, 'data-pick': pick?.(l) || undefined, 'data-chosen': chosen?.(l) || undefined});
  return (
    <div className="il-cmp-wrap"><table className={`il-cmp cols-${ls.length}`} data-testid={testid}>
      <thead><tr><th scope="col" className="il-cmp-corner"><span className="sr">Oikeus</span></th>
        {ls.map(l => <th scope="col" key={l.id} data-testid={`col-${l.id}`} {...col(l)}
          onMouseEnter={pick?.(l) ? () => setHot(l.id) : undefined} onMouseLeave={pick?.(l) ? () => setHot(null) : undefined}
          onClick={pick?.(l) ? e => { if (!(e.target as HTMLElement).closest('button')) forward(e, l); } : undefined}>
          <span className="il-cmp-name">{soft(l.name)}</span>
          {state && <span className="il-cmp-state" data-testid={`col-state-${l.id}`}>{soft(state(l))}</span>}
          {head?.(l)}</th>)}</tr></thead>
      {SVCS[p].map(s => <tbody key={s}>
        {SVCS[p].length > 1 && <tr className="il-cmp-svc"><th scope="colgroup" colSpan={ls.length + 1}><Icon name={SICON[s]} />{SNAME[p][s]}</th></tr>}
        {rows(p, s).map(r => <tr key={r.ab}>
          <th scope="row"><span>{r.label}</span>{r.warn && <span className="il-cmp-warn"><Icon name="warning" />{r.warn}</span>}</th>
          {ls.map(l => {
            const g = grants(r, l.combo[s] ?? 'read');
            // The column's cells forward a click to its header button; the
            // button is the one control a keyboard or screen reader meets.
            return <td key={l.id} className={g === 'yes' ? 'on' : g === 'part' ? 'part' : 'off'} data-on={g} {...col(l)}
              onMouseEnter={pick?.(l) ? () => setHot(l.id) : undefined} onMouseLeave={pick?.(l) ? () => setHot(null) : undefined}
              onClick={pick?.(l) ? e => forward(e, l) : undefined}>
              <span className="il-cmp-val"><Icon name={g === 'no' ? 'cross' : 'check'} /><span>{g === 'part' ? 'Vain sovelluskansio' : g === 'yes' ? 'Kyllä' : 'Ei'}</span></span></td>;
          })}
        </tr>)}
      </tbody>)}
    </table></div>
  );
}

/* ---------- Microsoft's four applications ---------- */

type MsId = 'full' | 'nosend' | 'drafts' | 'read';
const IDENTITY = ['openid', 'profile', 'User.Read', 'offline_access'];
// The four levels' delegated scopes: production's three
// (ServerIntegrations.tsx, mirroring microsoftLevelScopes) and the new
// "everything but sending" level of round 1, which drops only Mail.Send.
const MS: {id: MsId; name: string; short: string; app: string; perms: string[]}[] = [
  {id: 'full', name: 'Täysi', short: 'Täysi', app: 'Open Habitat – täysi', perms: ['Files.ReadWrite.All', 'Sites.ReadWrite.All', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite', 'Contacts.ReadWrite']},
  {id: 'nosend', name: 'Kaikki paitsi postin lähetys', short: 'Ei lähetystä', app: 'Open Habitat – ei lähetystä', perms: ['Files.ReadWrite.All', 'Sites.ReadWrite.All', 'Mail.ReadWrite', 'Calendars.ReadWrite', 'Contacts.ReadWrite']},
  {id: 'drafts', name: 'Luonnokset, muu vain luku', short: 'Luonnokset', app: 'Open Habitat – luonnokset', perms: ['Files.Read.All', 'Sites.Read.All', 'Mail.ReadWrite', 'Calendars.Read', 'Contacts.Read']},
  {id: 'read', name: 'Vain luku', short: 'Vain luku', app: 'Open Habitat – vain luku', perms: ['Files.Read.All', 'Sites.Read.All', 'Mail.Read', 'Calendars.Read', 'Contacts.Read']},
];
const permsOf = (k: number) => [...IDENTITY, ...MS[k].perms];
const SAYS: Record<string, string> = {
  openid: 'Sign users in', profile: "View users' basic profile", offline_access: 'Maintain access to data you have given it access to',
  'Files.ReadWrite.All': 'Have full access to all files user can access', 'Files.Read.All': 'Read all files that user can access',
  'Sites.ReadWrite.All': 'Edit or delete items in all site collections', 'Sites.Read.All': 'Read items in all site collections',
  'Mail.ReadWrite': 'Read and write access to user mail', 'Mail.Read': 'Read user mail', 'Mail.Send': 'Send mail as a user',
  'Calendars.ReadWrite': 'Have full access to user calendars', 'Calendars.Read': 'Read user calendars',
  'Contacts.ReadWrite': 'Have full access to user contacts', 'Contacts.Read': 'Read user contacts',
};
const REDIRECT = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
const ENTRA_LIST = 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade';
const ORG = '<domain>';
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTH = 'Authentication (Preview)';
const ROLE_DEV = 'Vaatii vähintään roolin Application Developer.';
const ROLE_ADMIN = 'Vaatii roolin Cloud Application Administrator, Application Administrator tai Privileged Role Administrator.';

/* ---------- the band (proto-m365-setup-flow round 4's) ---------- */

type Box = [number, number, number, number];
type CropName = 'register' | 'list' | 'overview' | 'auth' | 'perms';
type CropRec = {box: Box; size: [number, number]; targets: Record<string, Box>};
const CROPS = (record as unknown as {crops: Record<CropName, CropRec>}).crops;
const SRC: Record<CropName, string> = {register: registerImg, list: listImg, overview: overviewImg, auth: authImg, perms: permsImg};
const ALT: Record<CropName, string> = {
  register: 'Entra: Register an application', list: 'Entra: App registrations, All applications',
  overview: 'Entra: sovelluksen Overview', auth: 'Entra: sovelluksen Authentication (Preview)', perms: 'Entra: sovelluksen API permissions',
};
const target = (crop: CropName, t: string): Box => CROPS[crop].targets[t];

function bandOf(crop: CropName, t: string, aspect: number, narrow: boolean): Box {
  const c = CROPS[crop], tg = target(crop, t);
  const cw = c.box[2] - c.box[0], ch = c.box[3] - c.box[1];
  let wide = narrow ? Math.max(720, tg[2] - tg[0] + 120) : Math.max(1500, tg[2] + 120);
  wide = Math.max(wide, (tg[3] - tg[1] + 80) * aspect);
  wide = Math.min(cw, wide, ch * aspect);
  const tall = Math.round(wide / aspect);
  const left = narrow ? Math.max(c.box[0], Math.min(c.box[2] - wide, tg[0] - 60)) : c.box[0];
  const mid = (tg[1] + tg[3]) / 2;
  const top = Math.max(c.box[1], Math.min(c.box[3] - tall, Math.round(mid - tall / 2)));
  return [left, top, left + wide, top + tall];
}

function Band({crop, t, narrow, missing}: {crop: CropName; t: string; narrow: boolean; missing?: string}) {
  const c = CROPS[crop];
  // A missing screen's line under the band takes its height from the band.
  const aspect = missing ? (narrow ? 3 : 4.4) : narrow ? 2.3 : 3.7;
  const v = bandOf(crop, t, aspect, narrow);
  const w = v[2] - v[0], h = v[3] - v[1];
  const pct = (b: Box) => ({left: `${(b[0] - v[0]) / w * 100}%`, top: `${(b[1] - v[1]) / h * 100}%`, width: `${(b[2] - b[0]) / w * 100}%`, height: `${(b[3] - b[1]) / h * 100}%`});
  return (
    <figure className="m-shot m-band" data-testid="m-strip" data-crop={crop}>
      <div className="m-shot-frame" style={{aspectRatio: `${aspect}`}}>
        <img src={SRC[crop]} alt={ALT[crop]} draggable={false} style={pct(c.box)} />
        <span className="m-mark" data-testid="m-mark" data-target={`${crop}.${t}`} style={pct(target(crop, t))} />
      </div>
      {missing && <figcaption className="il-nocap" data-testid="il-nocap"><Icon name="image" /><span><strong>Kuva puuttuu:</strong> {missing}.{!narrow && " Kuvassa sivu, josta se avautuu."}</span></figcaption>}
    </figure>
  );
}

function useNarrow() {
  const q = '(max-width: 640px)';
  const [narrow, setNarrow] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q), on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

/* ---------- the small pieces of a sub-item (round 4's) ---------- */

const copied: string[] = [];
(window as any).__copied = copied;
function useCopy(value: string) {
  const [done, setDone] = useState(false);
  return [done, () => {
    copied.push(value);
    void navigator.clipboard?.writeText(value).catch(() => {});
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  }] as const;
}
function Copy({value, label}: {value: string; label: string}) {
  const [done, press] = useCopy(value);
  return <Button data-testid="m-copy" size="row" variant="quiet" aria-label={`Kopioi ${label}`} onPress={press}><Icon name={done ? 'check' : 'copy'} /></Button>;
}
function Where({crumbs, link}: {crumbs: string[]; link?: boolean}) {
  return (
    <div className="m-where" data-testid="m-where">
      <p className="m-path">{crumbs.map((c, i) => <Fragment key={i}>{i > 0 && <span className="m-sep" aria-hidden="true">›</span>}<span className="m-crumb">{c}</span></Fragment>)}</p>
      {link && <p className="m-open"><ExternalLink href={ENTRA_LIST} target="_blank" rel="noreferrer" data-testid="m-console-link">Avaa App registrations <Icon name="external" /></ExternalLink></p>}
    </div>
  );
}
const Act = ({children}: {children: React.ReactNode}) => <p className="m-act">{children}</p>;
const Value = ({value, label, copy = true}: {value: string; label: string; copy?: boolean}) => (
  <p className="m-value"><code>{value}</code>{copy && <Copy value={value} label={label} />}</p>
);
const Done = ({children}: {children: React.ReactNode}) => (
  <p className="m-done" data-testid="m-done"><Icon name="check" /><span><strong>Valmis, kun </strong>{children}</span></p>
);
const Note = ({children, icon}: {children: React.ReactNode; icon?: 'user' | 'warning'}) => (
  <p className="m-quiet m-note">{icon && <Icon name={icon} />}<span>{children}</span></p>
);
function PermCopy({name}: {name: string}) {
  const [done, press] = useCopy(name);
  return (
    <button type="button" className="m-perm-btn" data-testid="m-copy" data-done={done || undefined} aria-label={`Kopioi ${name}`} onClick={press}>
      <code className="m-perm-name">{name}</code><Icon name={done ? 'check' : 'copy'} />
    </button>
  );
}
function PermGrid({k, prev}: {k: number; prev?: number}) {
  const list = permsOf(k).filter(p => p !== 'User.Read');
  const was = prev === undefined ? null : permsOf(prev);
  return <>
    <ol className="m-perms" data-testid="m-perms">{list.map(p => <li key={p} className="m-perm" title={SAYS[p]} data-new={was && !was.includes(p) || undefined}><PermCopy name={p} /></li>)}</ol>
    <p className="m-count" data-testid="m-count">{list.length} oikeutta · User.Read on taulukossa valmiina</p>
  </>;
}

/* ---------- the walk: sub-items grouped by step and application ---------- */

type Fields = {client: string[]; tenant: string};
type Errors = Partial<Record<string, string>>;
type Ctx = {riff: number; /** The first application of this walk: it carries the one-time notes. */ first: number; fields: Fields; errors: Errors; setClient: (k: number, v: string) => void; setTenant: (v: string) => void;
  /** The tenant is asked in the first application saved, then shown. */
  asksTenant: (k: number) => boolean; /** The level whose saved section already has the tenant. */ tenantFrom: () => number; narrow: boolean};
/** missing: the Entra screen this sub-item happens on, when nobody has
 * captured it. The band then shows the captured page the step starts from,
 * and the gap is said, not drawn. */
type Part = {id: string; name: string; at?: [CropName, string]; missing?: string; fields?: string[]; body: React.ReactNode};
/** A run of sub-items under one step heading, for one application. */
type Group = {step: string; title: string; n: number; k: number; parts: Part[]};

const ClientField = ({ctx, k, label}: {ctx: Ctx; k: number; label?: string}) => (
  <div className="m-idfield"><TextField data-testid={`m-field-client-${k}`} label={label ?? 'Application (client) ID'} mono
    value={ctx.fields.client[k]} onChange={v => ctx.setClient(k, v)} error={ctx.errors[`client-${k}`]} /></div>
);
const TenantField = ({ctx}: {ctx: Ctx}) => (
  <div className="m-idfield"><TextField data-testid="m-field-tenant" label="Directory (tenant) ID" mono
    value={ctx.fields.tenant} onChange={ctx.setTenant} error={ctx.errors.tenant} /></div>
);
const MISSING = {
  platform: 'Add Redirect URI › Mobile and desktop applications -paneeli',
  request: 'Request API permissions -paneeli (Microsoft Graph › Delegated permissions)',
  select: 'Select permissions -haku ja Add permissions',
  consent: 'Grant admin consent -vahvistus (Yes)',
};

function register(ctx: Ctx, k: number): Part[] {
  return [
    {id: 'new', name: 'New registration', at: ['list', 'new'], body: <>
      <Where crumbs={['App registrations', 'All applications']} link={ctx.first === k} />
      <Act>{ctx.first === k ? 'Valitse listan yläpuolelta ' : 'Palaa listaan App registrations › All applications ja valitse '}<em>New registration</em>.</Act>
      {ctx.first === k && <Note icon="user">{ROLE_DEV}</Note>}
    </>},
    {id: 'name', name: 'Name', at: ['register', 'name'], body: <>
      <Act>Kirjoita nimeksi</Act>
      <Value value={MS[k].app} label="Name" />
      {ctx.first === k && <p className="si-effect">Jokainen taso on oma sovelluksensa, koska Microsoft antaa kirjautumiselle aina kaikki sovellukselle hyväksytyt oikeudet.</p>}
    </>},
    {id: 'accounts', name: 'Supported account types', at: ['register', 'accounts'], body: <>
      <Act>Valitse, jos ei ole jo valittuna</Act>
      <Value value={`Single tenant only - ${ORG}`} label="Supported account types" copy={false} />
      {ctx.first === k && <Note>{ORG} on organisaatiosi domain; kuvissa se on peitetty.</Note>}
    </>},
    {id: 'redirect', name: 'Redirect URI', at: ['register', 'redirect'], body: <>
      <Act>Jätä <em>Redirect URI (optional)</em> tyhjäksi. Osoite lisätään seuraavassa vaiheessa.</Act>
    </>},
    {id: 'register', name: 'Register', at: ['register', 'register'], body: <Act>Valitse sivun alareunasta <em>Register</em>.</Act>},
    {id: 'done', name: 'Valmis', at: ['overview', 'menu'], body: <>
      <Done>Entra avaa sovelluksen <em>{MS[k].app}</em>: otsikkona sen nimi ja vasemmalla sen oma valikko.</Done>
    </>},
  ];
}
function publicClient(_ctx: Ctx, _k: number): Part[] {
  return [
    {id: 'auth', name: AUTH, at: ['auth', 'menu'], body: <>
      <Where crumbs={[AUTH, 'Redirect URI configuration']} />
      <Act>Valitse sovelluksen vasemmasta valikosta <em>{AUTH}</em>.</Act>
    </>},
    {id: 'add', name: 'Add Redirect URI', at: ['auth', 'add'], missing: MISSING.platform, body: <>
      <Act>Valitse <em>Add Redirect URI</em>, sitten <em>Mobile and desktop applications</em>. Rastita ehdotuksista tämä osoite ja valitse <em>Configure</em>.</Act>
      <Value value={REDIRECT} label="Redirect URI" />
    </>},
    {id: 'settings', name: 'Settings', at: ['auth', 'settings'], body: <>
      <Where crumbs={[AUTH, 'Settings']} />
      <Act>Valitse välilehti <em>Settings</em>. Kohdassa <em>Allow public client flows</em> valitse <em>Enabled</em> ja <em>Save</em>.</Act>
    </>},
    {id: 'done', name: 'Valmis', at: ['auth', 'tabs'], body: <>
      <Done>Redirect URI configuration -välilehdellä näkyy tämä osoite, ja Settings-välilehdellä Allow public client flows on Enabled.</Done>
    </>},
  ];
}
function permissions(_ctx: Ctx, k: number): Part[] {
  return [
    {id: 'menu', name: 'API permissions', at: ['perms', 'menu'], body: <Act>Valitse sovelluksen vasemmasta valikosta <em>API permissions</em>.</Act>},
    {id: 'add', name: 'Add a permission', at: ['perms', 'add'], missing: MISSING.request, body: <Act>Valitse <em>Add a permission</em>, sitten <em>Microsoft Graph</em> ja <em>Delegated permissions</em>.</Act>},
    {id: 'perms', name: `Oikeudet (${permsOf(k).length - 1})`, at: ['perms', 'configured'], missing: MISSING.select, body: <>
      <Act>Haku <em>Select permissions</em> löytää yhden kerrallaan: kopioi, liitä ja rastita. Lopuksi <em>Add permissions</em>.</Act>
      <PermGrid k={k} />
    </>},
    {id: 'done', name: 'Valmis', at: ['perms', 'graph'], body: <Done>ryhmärivillä lukee <em>Microsoft Graph ({permsOf(k).length})</em>.</Done>},
  ];
}
function tenantPart(ctx: Ctx, k: number): Part {
  return ctx.asksTenant(k)
    ? {id: 'tenant', name: 'Directory (tenant) ID', at: ['overview', 'tenant'], fields: ['tenant'], body: <>
      <Act>Kopioi <em>Directory (tenant) ID</em> ja liitä se tähän. Se on kaikille neljälle sama, joten sitä ei kysytä uudelleen.</Act>
      <TenantField ctx={ctx} />
      <Note>Salaisuutta ei tarvita.</Note>
    </>}
    : {id: 'tenant', name: 'Directory (tenant) ID', at: ['overview', 'tenant'], body: <>
      <Act>Directory (tenant) ID on kaikille neljälle sama. Se on jo tallennettu tasolle <em>{MS[ctx.tenantFrom()]?.short ?? ''}</em>, joten sitä ei tarvitse kopioida.</Act>
      <p className="m-value" data-testid="m-tenant-known"><code>{ctx.fields.tenant || '–'}</code></p>
    </>};
}
/** Consent and the ids at the end of each application; the tenant only for
 * the first saved, since all four live in the same one. */
function consent(ctx: Ctx, k: number): Part[] {
  return [
    {id: 'grant', name: 'Grant admin consent', at: ['perms', 'grant'], missing: MISSING.consent, body: <>
      <Act>Valitse samalla sivulla <em>Grant admin consent for {ORG}</em>, sitten <em>Yes</em>.</Act>
      <Done>Status-sarakkeessa lukee jokaisella rivillä <em>Granted for {ORG}</em>.</Done>
      <Note icon="user">{ROLE_ADMIN}</Note>
    </>},
    {id: 'client', name: 'Application (client) ID', at: ['overview', 'client'], fields: [`client-${k}`], body: <>
      <Act>Valitse vasemmasta valikosta <em>Overview</em>, kopioi <em>Application (client) ID</em> ja liitä se tähän.</Act>
      <ClientField ctx={ctx} k={k} />
    </>},
    tenantPart(ctx, k),
  ];
}

const STEP_TITLES = ['Rekisteröi sovellus', 'Julkinen asiakas', 'Käyttöoikeudet', 'Hyväksyntä ja tunnukset'];
const STEP_IDS = ['register', 'public', 'permissions', 'consent'];
/** The chosen levels, broadest first, each in full. */
function groups(ctx: Ctx, order: number[]): Group[] {
  const full = [register, publicClient, permissions, consent];
  return order.flatMap(k => full.map((f, n) => ({step: STEP_IDS[n], title: STEP_TITLES[n], n, k, parts: f(ctx, k)})));
}

/** The applications of this walk in a row: which one is under way, which
 * are saved. A level that was set before is not in it. */
function AppRail({order, k, done, onPick, count}: {order: number[]; k: number; done: boolean[]; onPick: (k: number) => void; count: string[]}) {
  return (
    <ol className="il-rail" aria-label="Sovellukset tässä asetuksessa" data-testid="il-rail">
      {order.map((j, i) => {
        const m = MS[j];
        return <li key={m.id} aria-current={j === k ? 'step' : undefined} data-done={done[j] || undefined} data-testid={`il-rail-${m.id}`}>
          <button type="button" className="il-rail-btn" onClick={() => onPick(j)} aria-label={`${i + 1}. ${m.app}${done[j] ? ', tallennettu' : ''}`}>
            <span className="il-rail-n">{done[j] ? <Icon name="check" /> : i + 1}</span><span className="il-rail-name">{m.short}</span>
            <span className="il-rail-count" data-testid="il-rail-count">{count[i]}</span></button>
        </li>;
      })}
    </ol>
  );
}

/** A1b5: the sub-items only show the position; the footer button walks them. */
function Stepper({parts, sub, label}: {parts: Part[]; sub: number; label: string}) {
  return (
    <ol className="m-stepper" aria-label={label} data-testid="m-stepper">
      {parts.map((p, j) => <li key={p.id} data-passed={j < sub || undefined} aria-current={j === sub ? 'step' : undefined}>
        <span className="m-dot-btn" data-testid="m-dot">
          <span className="m-dot">{j < sub ? <Icon name="check" /> : j + 1}</span><span className="m-dot-name">{p.name}</span>
        </span>
      </li>)}
    </ol>
  );
}

/* ---------- what the host knows: root's integrations file ---------- */

/** One Microsoft section as GET /api/v1/server/integrations lists it
 * (microsoft, microsoft_nosend, microsoft_drafts, microsoft_read). */
type HostApp = {client_id?: string; tenant_id?: string; usable: boolean; source: 'site_admin' | 'operator'; actor?: string; at?: string};
type Apps = Partial<Record<MsId, HostApp>>;
const SECTION: Record<MsId, string> = {full: 'microsoft', nosend: 'microsoft_nosend', drafts: 'microsoft_drafts', read: 'microsoft_read'};
const isSet = (apps: Apps, id: MsId) => Boolean(apps[id]?.usable);
// The gateway names a GitHub id by its login when it knows the person.
const NAMES: Record<string, string> = {'4721983': 'kaisa-admin'};
const ME = '4721983';
const TENANT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const SAMPLE: Fields = {tenant: TENANT, client: ['4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c', '1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b', 'c0ffee00-1234-4abc-8def-0123456789ab', '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918']};
type Preset = 'two' | 'none' | 'all';
function preset(p: Preset): Apps {
  const full: HostApp = {client_id: SAMPLE.client[0], tenant_id: TENANT, usable: true, source: 'site_admin', actor: ME, at: '2026-11-07T14:12:00Z'};
  const read: HostApp = {client_id: SAMPLE.client[3], tenant_id: TENANT, usable: true, source: 'operator'};
  if (p === 'none') return {};
  if (p === 'two') return {full, read};
  return {full, read, nosend: {...full, client_id: SAMPLE.client[1], at: '2026-11-08T09:40:00Z'}, drafts: {...full, client_id: SAMPLE.client[2], at: '2026-11-08T09:52:00Z'}};
}
const day = (iso?: string) => iso ? new Date(iso).toLocaleDateString('fi-FI', {day: 'numeric', month: 'numeric', year: 'numeric'}) : '';
/** Production's AppLine for a section: where, the short client id, who and when. */
function Prov({id, app}: {id: MsId; app: HostApp}) {
  const by = app.source === 'operator' ? 'asetettu palvelimella' : `${day(app.at)} · ${NAMES[app.actor ?? ''] ? `@${NAMES[app.actor ?? '']}` : `GitHub-id ${app.actor}`}`;
  return <span className="si-app il-prov" data-testid="il-prov" data-section={SECTION[id]}>Microsoft Entra{app.client_id && <> · client id <code>{shortClientID('microsoft', app.client_id)}</code></>} · {by}</span>;
}
/** What each level allows in one line, for the status list. */
const GIST: Record<MsId, string> = {
  full: 'Lukee, muokkaa ja lähettää postia. Muokkaa kalenteria, yhteystietoja ja tiedostoja.',
  nosend: 'Kuten Täysi, mutta ei lähetä postia.',
  drafts: 'Järjestelee ja luonnostelee postia. Kalenteri, yhteystiedot ja tiedostot vain luetaan.',
  read: 'Lukee kaiken, ei muuta mitään.',
};

function idErrors(fields: Fields, ks: number[]): Errors {
  // Production's checks for one application, each field on its own.
  const a = '00000000-0000-4000-8000-00000000000a', b = '00000000-0000-4000-8000-00000000000b';
  const e: Errors = {};
  const tenant = fields.tenant.trim();
  const t = appErrors('microsoft', {client_id: a, tenant_id: tenant}).tenant_id;
  if (t) e.tenant = t;
  for (const k of ks) {
    const c = fields.client[k].trim();
    const r = appErrors('microsoft', {client_id: c, tenant_id: b}).client_id ?? (!t ? appErrors('microsoft', {client_id: c, tenant_id: tenant}).tenant_id : undefined);
    if (r) e[`client-${k}`] = r;
  }
  // Four applications, four ids: the same one pasted twice is the likeliest slip.
  const seen = new Map<string, number>();
  fields.client.forEach((c, k) => {
    const v = c.trim().toLowerCase();
    if (!guid.test(v)) return;
    if (seen.has(v)) { if (ks.includes(k) && !e[`client-${k}`]) e[`client-${k}`] = `Sama tunnus kuin sovelluksella ${MS[seen.get(v)!].app}. Jokaisella tasolla on oma sovelluksensa ja oma tunnuksensa.`; }
    else seen.set(v, k);
  });
  return e;
}

/* ---------- the walk: round 4's Jokainen kokonaan, over the chosen levels ---------- */

function Walk({riff, order, apps, onSave, onStart, onDone, fields, setFields}: {riff: number; order: number[]; apps: Apps; onSave: (k: number) => void;
  onStart: () => void; onDone: () => void; fields: Fields; setFields: React.Dispatch<React.SetStateAction<Fields>>}) {
  const narrow = useNarrow();
  const [errors, setErrors] = useState<Errors>({});
  const saved = (j: number) => isSet(apps, MS[j].id);
  const ctx: Ctx = {
    riff, first: order[0], fields, errors, narrow,
    asksTenant: k => !MS.some((m, j) => j !== k && saved(j)),
    tenantFrom: () => MS.findIndex((m, j) => saved(j)),
    setClient: (k, v) => { setFields(f => ({...f, client: f.client.map((c, j) => j === k ? v : c)})); setErrors(e => ({...e, [`client-${k}`]: undefined})); },
    setTenant: v => { setFields(f => ({...f, tenant: v})); setErrors(e => ({...e, tenant: undefined})); },
  };
  const list = groups(ctx, order);
  const [at, setAt] = useState(0);
  const [sub, setSub] = useState(0);
  const g = list[at], part = g.parts[Math.min(sub, g.parts.length - 1)], s = g.parts.indexOf(part);
  const lastPart = s === g.parts.length - 1;
  const appEnd = g.step === 'consent' && lastPart;
  const go = (n: number, toSub = 0) => { setAt(n); setSub(toSub); };
  const pick = (j: number) => go(list.findIndex(x => x.k === j));
  const nextApp = order.find(j => j !== g.k && !saved(j)) ?? -1;
  const save = () => {
    const e = idErrors(fields, [g.k]);
    setErrors(e);
    if (Object.keys(e).length) {
      // The field with the error may be on another sub-item: open it.
      const j = g.parts.findIndex(p => p.fields?.some(f => e[f]));
      if (j >= 0) setSub(j);
      return;
    }
    onSave(g.k);
    if (nextApp >= 0) pick(nextApp); else onDone();
  };
  const next = () => appEnd ? save() : lastPart ? go(at + 1) : setSub(s + 1);
  // Back from the very first sub-item is back to the start page.
  const back = () => s > 0 ? setSub(s - 1) : at > 0 ? go(at - 1, list[at - 1].parts.length - 1) : onStart();
  const nextLabel = appEnd ? (nextApp < 0 ? 'Tallenna' : narrow ? 'Tallenna ja jatka' : `Tallenna ja jatka: ${MS[nextApp].short}`)
    : lastPart ? (narrow ? 'Seuraava vaihe' : `Seuraava vaihe: ${list[at + 1].title}`)
    // A phone has the stepper's next number right above; the name would wrap the footer.
    : narrow ? 'Seuraava' : `Seuraava: ${g.parts[s + 1].name}`;
  const done = MS.map((_, j) => saved(j));
  const counts = order.map(j => list.filter(x => x.k === j).reduce((a, x) => a + x.parts.length, 0));
  const skipped = MS.filter((m, j) => !order.includes(j));
  const fill = (s + 1) / g.parts.length;
  return (
    <>
      <div className="m-stephead">
        <div className="il-railrow">
          <AppRail order={order} k={g.k} done={done} onPick={pick} count={counts.map(c => narrow ? `${c}` : `${c} kohtaa`)} />
          {skipped.length > 0 && <p className="il-skipped" data-testid="il-skipped" aria-label={`Ei tässä asetuksessa: ${skipped.map(m => m.short).join(', ')}`}>
            {/* A phone keeps the rail on one line: the count, the names in the label. */}
            {narrow ? `+${skipped.length} ohitetaan` : `Ei tässä asetuksessa: ${skipped.map(m => m.short).join(', ')}`}</p>}
        </div>
        <div className="si-progress" data-testid="m-progress" role="img" aria-label={`Vaihe ${g.n + 1}/4`}>
          {[0, 1, 2, 3].map(j => <span key={j} data-done={j < g.n || undefined}>{j === g.n && <i className="m-progress-fill" style={{width: `${fill * 100}%`}} />}</span>)}
        </div>
        <p className="si-stepname" data-testid="m-stepname" data-step={g.step} data-app={g.k}><span className="si-muted">{g.n + 1}/4</span> {g.title}</p>
      </div>
      <div className="si-stepbody m-stepbody" data-testid={`m-step-${g.step}`}>
        {part.at && <Band crop={part.at[0]} t={part.at[1]} narrow={narrow} missing={part.missing} />}
        {g.parts.length > 1 && <Stepper parts={g.parts} sub={s} label={`${g.title}: kohdat`} />}
        <div className="m-panel" data-testid="m-panel" data-part={`${g.step}.${g.k}.${part.id}`} data-target={part.at ? `${part.at[0]}.${part.at[1]}` : ''} role="group" aria-label={part.name}>{part.body}</div>
      </div>
      <div className="si-foot">
        <CloseButton testid="il-close" label="Sulje" />
        <span className="si-grow" />
        <Button data-testid="m-back" size="row" variant="secondary" onPress={back}>Takaisin</Button>
        <Button data-testid={appEnd ? 'm-save' : 'm-next'} size="page" variant="primary" onPress={next}>{nextLabel}</Button>
      </div>
    </>
  );
}

const CloseCtx = React.createContext<() => void>(() => {});
function CloseButton({testid, label, variant = 'quiet'}: {testid?: string; label: string; variant?: 'quiet' | 'secondary'}) {
  const close = React.useContext(CloseCtx);
  return <Button data-testid={testid} size="row" variant={variant} onPress={close}>{label}</Button>;
}

/* ---------- the start page, three ways ---------- */

type StartProps = {riff: number; apps: Apps; justSaved: MsId[]; start: (order: number[]) => void};
const missingOf = (apps: Apps) => MS.map((m, j) => j).filter(j => !isSet(apps, MS[j].id));
const asMs = (l: Level) => MS.findIndex(m => m.id === l.id);

function Lead({apps, justSaved, hint}: {apps: Apps; justSaved: MsId[]; hint: string}) {
  const n = MS.filter(m => isSet(apps, m.id)).length;
  return <div className="il-lead2">
    {justSaved.length > 0 && <p className="m-done" data-testid="il-just"><Icon name="check" /><span><strong>Tallennettu: </strong>{justSaved.map(id => MS.find(m => m.id === id)!.short).join(', ')}.</span></p>}
    <p className="m-act">{n === 4 ? 'Kaikilla neljällä tasolla on tunnukset.' : hint}</p>
    <p className="m-quiet il-how" data-testid="il-how"><Icon name="server" /><span>Jokainen taso on Entrassa oma sovelluksensa. Taso on asetettu, kun sen tunnukset on tallennettu palvelimelle; sitä ei tehdä uudelleen.</span></p>
  </div>;
}
/** Under the table: the set levels, as the host knows them. */
function Known({apps}: {apps: Apps}) {
  const set = MS.filter(m => isSet(apps, m.id));
  if (!set.length) return null;
  return <ul className="il-known" data-testid="il-known">{set.map(m => <li key={m.id}><Icon name="check" /><span><strong>{m.short}</strong> <Prov id={m.id} app={apps[m.id]!} /></span></li>)}</ul>;
}
const SetMark = () => <span className="il-colset" data-testid="il-colset"><Icon name="check" />Asetettu</span>;

/** Rastit taulukossa: a checkbox in every level's column that still lacks credentials. */
function StartChecks({apps, justSaved, start, chosen, setChosen}: StartProps & {chosen: Set<MsId>; setChosen: (s: Set<MsId>) => void}) {
  const toggle = (id: MsId, on: boolean) => { const n = new Set(chosen); if (on) n.add(id); else n.delete(id); setChosen(n); };
  const order = MS.map((_, j) => j).filter(j => chosen.has(MS[j].id) && !isSet(apps, MS[j].id));
  const left = missingOf(apps).length;
  return <>
    <div className="il-start" data-testid="il-start">
      <Lead apps={apps} justSaved={justSaved} hint="Rastita tasot, jotka asetat nyt. Jokainen rastitettu käydään läpi kokonaan." />
      <Known apps={apps} />
      <Compare p="microsoft" testid="cmp-microsoft" chosen={l => chosen.has(l.id as MsId) && !isSet(apps, l.id as MsId)}
        head={l => isSet(apps, l.id as MsId) ? <SetMark /> : <span className="il-colpick"><Checkbox data-testid={`pick-${l.id}`} label="Aseta nyt" checked={chosen.has(l.id as MsId)} onChange={on => toggle(l.id as MsId, on)} /></span>} />
    </div>
    <div className="si-foot">
      <span className="si-grow" />
      {left ? <><CloseButton label="Peruuta" variant="secondary" />
        <Button data-testid="il-begin" size="page" variant="primary" isDisabled={!order.length} onPress={() => start(order)}>{order.length ? `Aloita: ${order.length} ${order.length === 1 ? 'taso' : 'tasoa'}` : 'Valitse taso'}</Button></>
        : <CloseButton testid="il-finish" label="Valmis" variant="secondary" />}
    </div>
  </>;
}

/** Taulukko valitsimena: a missing level's column is the button that starts it. */
function StartTable({apps, justSaved, start}: StartProps) {
  const left = missingOf(apps).length;
  return <>
    <div className="il-start" data-testid="il-start">
      <Lead apps={apps} justSaved={justSaved} hint="Valitse taso, jonka asetat seuraavaksi. Tallennuksen jälkeen palaat tähän." />
      <Known apps={apps} />
      <Compare p="microsoft" testid="cmp-microsoft" pick={l => !isSet(apps, l.id as MsId)}
        head={l => isSet(apps, l.id as MsId) ? <SetMark />
          : <Button data-testid={`pick-${l.id}`} size="row" variant="secondary" aria-label={`Aseta taso ${MS[asMs(l)].name}`} onPress={() => start([asMs(l)])}><Icon name="plus" />Aseta</Button>} />
    </div>
    <div className="si-foot"><span className="si-grow" /><CloseButton testid={left ? undefined : 'il-finish'} label={left ? 'Sulje' : 'Valmis'} variant="secondary" /></div>
  </>;
}

/** Tilalista: the four levels with their state; the table opens on demand. */
function StartList({apps, justSaved, start}: StartProps) {
  const [open, setOpen] = useState(false);
  const missing = missingOf(apps);
  return <>
    <div className="il-start" data-testid="il-start">
      <Lead apps={apps} justSaved={justSaved} hint="Aseta puuttuvat tasot yksi kerrallaan tai kaikki kerralla." />
      <ul className="il-levels" data-testid="il-levels">{MS.map((m, j) => {
        const app = apps[m.id], on = isSet(apps, m.id);
        return <li key={m.id} data-testid={`il-level-${m.id}`} data-set={on || undefined}>
          <span className="il-lv-main"><span className="il-lv-name">{m.name}</span><span className="il-lv-gist">{GIST[m.id]}</span>
            {on && <Prov id={m.id} app={app!} />}</span>
          <span className="il-lv-state">{on ? <StatusMark kind="success" tone="success" label="Asetettu" /> : <StatusMark tone="warning" label="Ei asetettu" />}</span>
          <span className="il-lv-act">{!on && <Button data-testid={`pick-${m.id}`} size="row" variant="secondary" aria-label={`Aseta taso ${m.name}`} onPress={() => start([j])}>Aseta</Button>}</span>
        </li>;
      })}</ul>
      <Disclose open={open} onToggle={() => setOpen(!open)} testid="il-open-table" />
      {open && <Compare p="microsoft" testid="cmp-microsoft" state={l => isSet(apps, l.id as MsId) ? 'Asetettu' : 'Ei asetettu'} />}
    </div>
    <div className="si-foot">
      <span className="si-grow" />
      {missing.length ? <><CloseButton label="Sulje" variant="secondary" />
        <Button data-testid="il-begin" size="page" variant="primary" onPress={() => start(missing)}>{missing.length === 1 ? 'Aseta puuttuva' : `Aseta puuttuvat (${missing.length})`}</Button></>
        : <CloseButton testid="il-finish" label="Valmis" variant="secondary" />}
    </div>
  </>;
}

function Wizard({riff, apps, onSave, onClose, fields, setFields}: {riff: number; apps: Apps; onSave: (k: number) => void; onClose: () => void; fields: Fields; setFields: React.Dispatch<React.SetStateAction<Fields>>}) {
  const title = 'Microsoft 365: tasojen sovellukset';
  const [order, setOrder] = useState<number[] | null>(null);
  const [run, setRun] = useState(0);
  const [justSaved, setJustSaved] = useState<MsId[]>([]);
  // Every missing level is ticked at first; the administrator unticks what waits.
  const [chosen, setChosen] = useState<Set<MsId>>(() => new Set(MS.filter(m => !isSet(apps, m.id)).map(m => m.id)));
  const start = (o: number[]) => { setJustSaved([]); setOrder(o); setRun(r => r + 1); };
  const sp: StartProps = {riff, apps, justSaved, start};
  return (
    <ModalOverlay className="ah-overlay m-overlay" isOpen isDismissable={false} onOpenChange={o => !o && onClose()}>
      <Modal className={`ah-modal si-modal si-split m-modal m-r${riff}`}>
        <Dialog className="ah-dialog si-dialog m-dialog" data-testid="m-dialog" data-page={order ? 'walk' : 'start'} aria-label={title}>
          <CloseCtx.Provider value={onClose}>
            <Heading slot="title">{title}</Heading>
            {order ? <Walk key={run} riff={riff} order={order} apps={apps} fields={fields} setFields={setFields}
              onSave={k => { onSave(k); setJustSaved(j => [...j, MS[k].id]); }} onStart={() => { setJustSaved([]); setOrder(null); }} onDone={() => setOrder(null)} />
              : riff === CHECKS ? <StartChecks {...sp} chosen={chosen} setChosen={setChosen} />
              : riff === TABLE ? <StartTable {...sp} /> : <StartList {...sp} />}
          </CloseCtx.Provider>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/* ---------- the administrator's page ---------- */

function Disclose({open, onToggle, testid}: {open: boolean; onToggle: () => void; testid: string}) {
  return <button type="button" className="il-disclose" aria-expanded={open} data-testid={testid} onClick={onToggle}>
    <Icon name={open ? 'up' : 'down'} />{open ? 'Piilota tasot' : 'Mitä tasot sallivat'}</button>;
}

function MicrosoftRows({apps, onStart}: {apps: Apps; onStart: () => void}) {
  const set = MS.filter(m => isSet(apps, m.id));
  const n = set.length;
  const [open, setOpen] = useState(false);
  // The table is the dialog's start now; on the page it opens on demand.
  return <>
    <li className="si-row il-prow" data-testid="row-microsoft" data-state={n === 4 ? 'set' : n ? 'partial' : 'before'}>
      <ProviderMark provider="microsoft" small />
      <span className="si-main il-main"><span className="si-name">Microsoft 365</span>
        <span className="il-provnote">{n ? `${n}/4 tasoa asetettu: ${set.map(m => m.short).join(' · ')}` : 'Neljä tasoa. Jokainen on Entrassa oma sovelluksensa.'}</span>
        <Disclose open={open} onToggle={() => setOpen(!open)} testid="open-microsoft" />
      </span>
      <span className="si-state">{n === 4 ? <StatusMark kind="success" tone="success" label="Tarjolla" /> : n ? <StatusMark tone="warning" label={`${n}/4 tasoa tarjolla`} /> : <StatusMark tone="warning" label="Ei tarjolla" />}</span>
      <span className="si-act"><Button data-testid="start-microsoft" size="row" variant={n === 4 ? 'quiet' : 'primary'} onPress={onStart}>{n === 4 ? 'Tasot' : n ? 'Aseta puuttuvat…' : 'Luo sovellukset…'}</Button></span>
    </li>
    {open && <li className="si-row si-level il-cmprow" data-testid="compare-microsoft">
      <div className="il-cmpbox"><b className="il-cmp-title">Mitä tasot sallivat</b>
        <Compare p="microsoft" testid="cmp-microsoft-page" state={l => isSet(apps, l.id as MsId) ? 'Tarjolla' : 'Ei tunnuksia'} />
      </div></li>}
  </>;
}

function OtherRows({p}: {p: 'google' | 'dropbox'}) {
  const [open, setOpen] = useState(false);
  return <>
    <li className="si-row il-prow" data-testid={`row-${p}`}>
      <ProviderMark provider={p} small />
      <span className="si-main il-main"><span className="si-name">{PNAME[p]}</span>
        <span className="il-provnote">{levels(p).length} tasoa: {levels(p).map(l => l.name).join(' · ')}</span>
        <Disclose open={open} onToggle={() => setOpen(!open)} testid={`open-${p}`} />
      </span>
      <span className="si-state"><StatusMark kind="success" tone="success" label="Tarjolla" /></span>
      <span className="si-act"><Button size="row" variant="quiet">Tunnukset</Button></span>
    </li>
    {open && <li className="si-row si-level il-cmprow" data-testid={`compare-${p}`}>
      <div className="il-cmpbox"><b className="il-cmp-title">Mitä tasot sallivat</b><Compare p={p} testid={`cmp-${p}`} /></div></li>}
  </>;
}

/* ---------- review chrome and page ---------- */

let reviewTheme = 'light';
const ownNav: [string, IconName][] = [['Tili', 'user'], ['Laitteet', 'devices'], ['Agentit', 'agent'], ['Yhteydet', 'link'], ['Integraatiot', 'plug']];
const adminNav: [string, IconName][] = [['Palvelin', 'server'], ['Palvelinintegraatiot', 'plug'], ['AI-avain', 'key'], ['Käyttöönotto', 'steer'], ['Käyttäjät ja pääsy', 'users'], ['Levytila', 'disk']];
/** The page's fields start from what the host already has: the saved
 * levels' client ids (for the duplicate check) and their tenant. */
function fieldsOf(apps: Apps): Fields {
  const known = MS.map(m => apps[m.id]?.client_id ?? '');
  return {client: known, tenant: Object.values(apps).find(a => a?.tenant_id)?.tenant_id ?? ''};
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [apps, setApps] = useState<Apps>(() => preset('two'));
  const [open, setOpen] = useState(true);
  const [run, setRun] = useState(0);
  const [fields, setFields] = useState<Fields>(() => fieldsOf(preset('two')));
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const load = (p: Preset, show = true) => { const a = preset(p); setApps(a); setFields(fieldsOf(a)); setOpen(show); setRun(r => r + 1); };
  return (
    <div className={`m-review variant-${direction}`} data-direction={direction}>
      <header className="m-bar" ref={bar} data-react-aria-top-layer="true">
        <strong>Integraatioiden tasot · kierros 5</strong>
        <label><span className="m-bar-label">Teema</span> <select id="theme" value={theme} onChange={e => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="r-reset" onClick={() => load('two')}>Alusta (2/4)</button>
        <button type="button" data-testid="r-none" onClick={() => load('none')}>Ei tunnuksia</button>
        <button type="button" data-testid="r-fill" onClick={() => setFields(f => ({tenant: f.tenant || SAMPLE.tenant, client: f.client.map((c, k) => c || SAMPLE.client[k])}))}>Täytä tunnukset</button>
        <button type="button" data-testid="r-done" onClick={() => load('all', false)}>Näytä asetettu</button>
        <span className="m-bar-note">Synteettinen palvelin. Mitään ei lähetetä.</span>
        <ol className="m-lines" data-testid="direction-lines">{LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}</ol>
        <p className="m-common">{COMMON}</p>
      </header>
      <div className="shell">
        <div className="hostbar"><strong>Open Habitat</strong><span>Kaisa Admin · ylläpitäjä</span><Icon name="user" /></div>
        <section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>
          {ownNav.map(([n, i]) => <span className="s-nav-i" key={n}><Icon name={i} />{n}</span>)}
          <span className="s-nav-h">Palvelimen ylläpito</span>{adminNav.map(([n, i]) => <span className="s-nav-i" key={n} aria-current={n === 'Palvelinintegraatiot' ? 'page' : undefined}><Icon name={i} />{n}</span>)}
        </nav><main className="s-main">
          <p className="m-quiet mobilecrumb">Asetukset › Palvelinintegraatiot</p>
          <h2>Palvelinintegraatiot</h2>
          <p className="m-quiet il-lead">Palvelut, joihin henkilöt voivat yhdistää tilinsä, ja tasot, joista he valitsevat, mitä agentit saavat tehdä.</p>
          <div className="s-card si"><ul className="si-rows" data-testid="admin-list" key={run}>
            <MicrosoftRows apps={apps} onStart={() => { setOpen(true); setRun(r => r + 1); }} />
            <OtherRows p="google" /><OtherRows p="dropbox" />
          </ul></div>
        </main></section>
      </div>
      {open && <Wizard key={run} riff={direction} apps={apps} fields={fields} setFields={setFields} onClose={() => setOpen(false)}
        onSave={k => setApps(a => ({...a, [MS[k].id]: {client_id: fields.client[k].trim(), tenant_id: fields.tenant.trim(), usable: true, source: 'site_admin', actor: ME, at: '2026-11-08T10:05:00Z'}}))} />}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
// The review chrome stays usable while a react-aria modal is open.
picker.setAttribute('data-react-aria-top-layer', 'true');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
