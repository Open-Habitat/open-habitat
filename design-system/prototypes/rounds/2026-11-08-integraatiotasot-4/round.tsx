import React, {Fragment, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {appErrors} from '../../../../web/src/app/serverIntegrations';
import {ControlButton as Button, ExternalLink} from '../../../../web/src/components/ControlElements';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {TextField} from '../../../../web/src/components/Primitives';
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

// Integration access levels, round 4 (proto-integration-levels). Jari chose
// round 3's "app by app" walk for Microsoft's four Entra applications, and
// its Cloud Shell sibling is gone: Cloud Shell needs an Azure subscription,
// which a plain Microsoft 365 tenant lacks. So the guide is a clicking path
// only, over the real masked Entra crops; a screen nobody captured is named
// as missing rather than drawn. The riffs are three ways to walk the four
// applications by clicking, all with A1b5's single button (the stepper only
// shows where you are): every application in full, the walk shortening
// after the first, or a checklist with one application open. The table
// (open before setup, behind a disclosure after) is round 3's. Synthetic.
const directions = ['Jokainen kokonaan', 'Lyhenevä toisto', 'Tarkistuslista'];
const LINES = [
  'Jokainen kokonaan: kierroksen 3 Sovellus kerrallaan ilman Cloud Shelliä; jokainen neljästä sovelluksesta käydään läpi samat 17 kohtaa, ja tunnukset tallentuvat kunkin lopussa.',
  'Lyhenevä toisto: ensimmäinen sovellus kohta kohdalta, sen jälkeen jokainen vaihe on yksi sivu, jossa korostuu vain se, mikä eroaa edellisestä (nimi, oikeudet, tunnus).',
  'Tarkistuslista: dialogin vasemmassa reunassa neljä sovellusta vaiheineen listana, vain meneillään oleva auki; rasti kertoo, mikä on tehty ja tallennettu.',
];
const COMMON = 'Kaikissa: vain klikkauspolku Entrassa, ei Cloud Shelliä. Oikeat Entra-leikkeet; näkymä, josta ei ole kuvaa, on merkitty puuttuvaksi. Ennen asetusta tasojen vertailutaulukko on auki, asetuksen jälkeen Mitä tasot sallivat -painikkeen takana.';
const FULL = 0, SHORT = 1, LIST = 2;

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

/** The provider's levels side by side, ✓ Kyllä or ✕ Ei in every cell. */
function Compare({p, state, testid}: {p: Prov; state?: (l: Level) => string; testid: string}) {
  const ls = levels(p);
  return (
    <div className="il-cmp-wrap"><table className={`il-cmp cols-${ls.length}`} data-testid={testid}>
      <thead><tr><th scope="col" className="il-cmp-corner"><span className="sr">Oikeus</span></th>
        {ls.map(l => <th scope="col" key={l.id} data-testid={`col-${l.id}`}><span className="il-cmp-name">{soft(l.name)}</span>
          {state && <span className="il-cmp-state" data-testid={`col-state-${l.id}`}>{soft(state(l))}</span>}</th>)}</tr></thead>
      {SVCS[p].map(s => <tbody key={s}>
        {SVCS[p].length > 1 && <tr className="il-cmp-svc"><th scope="colgroup" colSpan={ls.length + 1}><Icon name={SICON[s]} />{SNAME[p][s]}</th></tr>}
        {rows(p, s).map(r => <tr key={r.ab}>
          <th scope="row"><span>{r.label}</span>{r.warn && <span className="il-cmp-warn"><Icon name="warning" />{r.warn}</span>}</th>
          {ls.map(l => {
            const g = grants(r, l.combo[s] ?? 'read');
            return <td key={l.id} className={g === 'yes' ? 'on' : g === 'part' ? 'part' : 'off'} data-on={g}>
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
type Ctx = {riff: number; fields: Fields; errors: Errors; setClient: (k: number, v: string) => void; setTenant: (v: string) => void;
  /** The tenant is asked in the first application saved, then shown. */
  asksTenant: (k: number) => boolean; narrow: boolean};
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
      <Where crumbs={['App registrations', 'All applications']} link={k === 0} />
      <Act>{k === 0 ? 'Valitse listan yläpuolelta ' : 'Palaa listaan App registrations › All applications ja valitse '}<em>New registration</em>.</Act>
      {k === 0 && <Note icon="user">{ROLE_DEV}</Note>}
    </>},
    {id: 'name', name: 'Name', at: ['register', 'name'], body: <>
      <Act>Kirjoita nimeksi</Act>
      <Value value={MS[k].app} label="Name" />
      {k === 0 && <p className="si-effect">Jokainen taso on oma sovelluksensa, koska Microsoft antaa kirjautumiselle aina kaikki sovellukselle hyväksytyt oikeudet.</p>}
    </>},
    {id: 'accounts', name: 'Supported account types', at: ['register', 'accounts'], body: <>
      <Act>Valitse, jos ei ole jo valittuna</Act>
      <Value value={`Single tenant only - ${ORG}`} label="Supported account types" copy={false} />
      {k === 0 && <Note>{ORG} on organisaatiosi domain; kuvissa se on peitetty.</Note>}
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
      <Act>Directory (tenant) ID on kaikille neljälle sama. Se on jo tallennettu, joten sitä ei tarvitse kopioida.</Act>
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

/* Lyhenevä toisto: after the first application, a step is one page. What
   is the same as before is a short recap line; what differs is the content. */
const Same = ({items}: {items: React.ReactNode[]}) => (
  <ol className="il-same" data-testid="il-same">{items.map((x, i) => <li key={i}><Icon name="check" /><span>{x}</span></li>)}</ol>
);
function PermDiff({k}: {k: number}) {
  const now = permsOf(k), was = permsOf(k - 1);
  const plus = now.filter(p => !was.includes(p)), minus = was.filter(p => !now.includes(p));
  return (
    <p className="il-diff" data-testid="il-diff"><span className="m-quiet">Erona sovellukseen {MS[k - 1].short}:</span>
      {minus.map(p => <span key={p} className="il-diff-out" title="pois"><span aria-hidden="true">−</span><code>{p}</code></span>)}
      {plus.map(p => <span key={p} className="il-diff-in" title="uusi"><span aria-hidden="true">+</span><code>{p}</code></span>)}
    </p>
  );
}
function shortRegister(_ctx: Ctx, k: number): Part[] {
  return [{id: 'register', name: 'Rekisteröi', at: ['register', 'name'], body: <>
    <Act>Palaa listaan App registrations › All applications, valitse <em>New registration</em> ja kirjoita nimeksi</Act>
    <Value value={MS[k].app} label="Name" />
    <Same items={[<>Supported account types: <em>Single tenant only</em></>, <>Redirect URI tyhjäksi</>, <><em>Register</em></>]} />
  </>}];
}
function shortPublic(_ctx: Ctx, _k: number): Part[] {
  return [{id: 'public', name: 'Julkinen asiakas', at: ['auth', 'add'], missing: MISSING.platform, body: <>
    <Act><em>{AUTH}</em> › <em>Add Redirect URI</em> › <em>Mobile and desktop applications</em>, rastita sama osoite ja <em>Configure</em>.</Act>
    <Value value={REDIRECT} label="Redirect URI" />
    <Same items={[<><em>Settings</em> › Allow public client flows <em>Enabled</em> › <em>Save</em></>]} />
  </>}];
}
function shortPermissions(_ctx: Ctx, k: number): Part[] {
  return [{id: 'perms', name: `Oikeudet (${permsOf(k).length - 1})`, at: ['perms', 'configured'], missing: MISSING.select, body: <>
    <Act><em>API permissions</em> › <em>Add a permission</em> › <em>Microsoft Graph</em> › <em>Delegated permissions</em>. Kopioi, liitä ja rastita, lopuksi <em>Add permissions</em>.</Act>
    <PermGrid k={k} prev={k - 1} />
    <PermDiff k={k} />
  </>}];
}
function shortConsent(ctx: Ctx, k: number): Part[] {
  return [
    {id: 'grant', name: 'Hyväksyntä ja client ID', at: ['overview', 'client'], missing: MISSING.consent, fields: [`client-${k}`], body: <>
      <Same items={[<><em>Grant admin consent for {ORG}</em> › <em>Yes</em></>]} />
      <Act>Sitten <em>Overview</em>: kopioi <em>Application (client) ID</em> ja liitä se tähän.</Act>
      <ClientField ctx={ctx} k={k} />
    </>},
    ...(ctx.asksTenant(k) ? [tenantPart(ctx, k)] : []),
  ];
}

const STEP_TITLES = ['Rekisteröi sovellus', 'Julkinen asiakas', 'Käyttöoikeudet', 'Hyväksyntä ja tunnukset'];
const STEP_SHORT = ['Rekisteröi', 'Julkinen', 'Oikeudet', 'Tunnukset'];
const STEP_IDS = ['register', 'public', 'permissions', 'consent'];
function groups(ctx: Ctx): Group[] {
  const full = [register, publicClient, permissions, consent];
  const short = [shortRegister, shortPublic, shortPermissions, shortConsent];
  const out: Group[] = [];
  MS.forEach((_, k) => (ctx.riff === SHORT && k > 0 ? short : full)
    .forEach((f, n) => out.push({step: STEP_IDS[n], title: STEP_TITLES[n], n, k, parts: f(ctx, k)})));
  return out;
}

/** The four applications in a row: which one is under way, which are done. */
/** count: how many sub-items each application takes, so the walk's length
 * shows before it starts. */
function AppRail({k, done, label, onPick, count}: {k: number; done: boolean[]; label: string; onPick?: (k: number) => void; count?: string[]}) {
  return (
    <ol className="il-rail" aria-label={label} data-testid="il-rail">
      {MS.map((m, j) => {
        const inner = <><span className="il-rail-n">{done[j] ? <Icon name="check" /> : j + 1}</span><span className="il-rail-name">{m.short}</span>{count && <span className="il-rail-count" data-testid="il-rail-count">{count[j]}</span>}</>;
        return <li key={m.id} aria-current={j === k ? 'step' : undefined} data-done={done[j] || undefined} data-testid={`il-rail-${m.id}`}>
          {onPick ? <button type="button" className="il-rail-btn" onClick={() => onPick(j)} aria-label={`${j + 1}. ${m.app}${done[j] ? ', valmis' : ''}`}>{inner}</button>
            : <span className="il-rail-btn" aria-label={`${j + 1}. ${m.app}${done[j] ? ', valmis' : ''}`}>{inner}</span>}
        </li>;
      })}
    </ol>
  );
}

/** Tarkistuslista: the four applications with their steps, one open. */
function Checklist({k, n, done, onPick, narrow}: {k: number; n: number; done: boolean[]; onPick: (k: number) => void; narrow: boolean}) {
  return (
    <ol className="il-check" aria-label="Sovellukset" data-testid="il-check">
      {MS.map((m, j) => {
        const open = j === k;
        return <li key={m.id} data-testid={`il-check-${m.id}`} aria-current={open ? 'step' : undefined} data-done={done[j] || undefined}>
          <button type="button" className="il-check-app" onClick={() => onPick(j)} aria-expanded={open}>
            <span className="il-rail-n">{done[j] ? <Icon name="check" /> : j + 1}</span>
            <span className="il-check-name">{narrow ? m.short : m.app}</span>
            <span className="il-check-state">{done[j] ? 'Tallennettu' : open ? `${n + 1}/4` : ''}</span>
          </button>
          {open && <ol className="il-check-steps" data-testid="il-check-steps">
            {STEP_TITLES.map((t, i) => <li key={t} data-passed={i < n || undefined} aria-current={i === n ? 'step' : undefined}>
              <span className="il-check-tick">{i < n ? <Icon name="check" /> : null}</span><span>{narrow ? STEP_SHORT[i] : t}</span></li>)}
          </ol>}
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

const emptyFields = (): Fields => ({client: ['', '', '', ''], tenant: ''});
type Saved = Record<MsId, boolean>;
const noneSaved = (): Saved => ({full: false, nosend: false, drafts: false, read: false});
const allSaved = (): Saved => ({full: true, nosend: true, drafts: true, read: true});

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

/** The one walk, A1b5's single button, in the riff's arrangement. */
function Walk({riff, saved, onSave, fields, setFields}: {riff: number; saved: Saved; onSave: (ids: MsId[], close: boolean) => void; fields: Fields; setFields: React.Dispatch<React.SetStateAction<Fields>>}) {
  const narrow = useNarrow();
  const firstOpen = Math.max(0, MS.findIndex(m => !saved[m.id]));
  const [errors, setErrors] = useState<Errors>({});
  const ctx: Ctx = {
    riff, fields, errors, narrow,
    asksTenant: k => !MS.some((m, j) => j !== k && saved[m.id]),
    setClient: (k, v) => { setFields(f => ({...f, client: f.client.map((c, j) => j === k ? v : c)})); setErrors(e => ({...e, [`client-${k}`]: undefined})); },
    setTenant: v => { setFields(f => ({...f, tenant: v})); setErrors(e => ({...e, tenant: undefined})); },
  };
  const list = groups(ctx);
  const [at, setAt] = useState(() => list.findIndex(g => g.k === firstOpen));
  const [sub, setSub] = useState(0);
  const g = list[at], part = g.parts[Math.min(sub, g.parts.length - 1)], s = g.parts.indexOf(part);
  const lastPart = s === g.parts.length - 1;
  const appEnd = g.step === 'consent' && lastPart;
  const go = (n: number, toSub = 0) => { setAt(n); setSub(toSub); };
  const pick = (j: number) => go(list.findIndex(x => x.k === j));
  const nextApp = MS.findIndex((m, j) => j !== g.k && !saved[m.id]);
  const save = () => {
    const e = idErrors(fields, [g.k]);
    setErrors(e);
    if (Object.keys(e).length) {
      // The field with the error may be on another sub-item: open it.
      const j = g.parts.findIndex(p => p.fields?.some(f => e[f]));
      if (j >= 0) setSub(j);
      return;
    }
    onSave([MS[g.k].id], nextApp < 0);
    if (nextApp >= 0) pick(nextApp);
  };
  const next = () => appEnd ? save() : lastPart ? go(at + 1) : setSub(s + 1);
  const back = () => s > 0 ? setSub(s - 1) : at > 0 && go(at - 1, list[at - 1].parts.length - 1);
  const nextLabel = appEnd ? (nextApp < 0 ? 'Tallenna' : narrow ? 'Tallenna ja jatka' : `Tallenna ja jatka: ${MS[nextApp].short}`)
    : lastPart ? (narrow ? 'Seuraava vaihe' : `Seuraava vaihe: ${list[at + 1].title}`)
    // A phone has the stepper's next number right above; the name would wrap the footer.
    : narrow ? 'Seuraava' : `Seuraava: ${g.parts[s + 1].name}`;
  const done = MS.map(m => saved[m.id]);
  const sizes = MS.map((_, j) => list.filter(x => x.k === j).reduce((a, x) => a + x.parts.length, 0));
  // A phone shows only the current application's count; Lyhenevä toisto's
  // shorter later walks are then said beside the first.
  const counts = sizes.map((c, j) => narrow && riff === SHORT && j === 0 && sizes[1] < c ? `${c} · muut ${sizes[1]}` : narrow ? `${c}` : `${c} kohtaa`);
  const fill = (s + 1) / g.parts.length;
  const progress = (
    <div className="si-progress" data-testid="m-progress" role="img" aria-label={`Vaihe ${g.n + 1}/4`}>
      {[0, 1, 2, 3].map(j => <span key={j} data-done={j < g.n || undefined}>{j === g.n && <i className="m-progress-fill" style={{width: `${fill * 100}%`}} />}</span>)}
    </div>
  );
  const stepname = <p className="si-stepname" data-testid="m-stepname" data-step={g.step} data-app={g.k}>
    <span className="si-muted">{g.n + 1}/4</span> {g.title}{riff === LIST && <span className="il-stepapp"> · {MS[g.k].short}</span>}
  </p>;
  const body = (
    <div className="si-stepbody m-stepbody" data-testid={`m-step-${g.step}`}>
      {part.at && <Band crop={part.at[0]} t={part.at[1]} narrow={narrow} missing={part.missing} />}
      {g.parts.length > 1 && <Stepper parts={g.parts} sub={s} label={`${g.title}: kohdat`} />}
      <div className="m-panel" data-testid="m-panel" data-part={`${g.step}.${g.k}.${part.id}`} data-target={part.at ? `${part.at[0]}.${part.at[1]}` : ''} role="group" aria-label={part.name}>{part.body}</div>
    </div>
  );
  const foot = <Foot canBack={at > 0 || s > 0} onBack={back} onNext={next} nextLabel={nextLabel} save={appEnd} />;
  if (riff === LIST) return (
    <>
      <div className="il-split">
        <Checklist k={g.k} n={g.n} done={done} onPick={pick} narrow={narrow} />
        <div className="il-split-main">{narrow ? null : <div className="m-stephead">{progress}{stepname}</div>}{body}</div>
      </div>
      {foot}
    </>
  );
  return (
    <>
      <div className="m-stephead">
        <AppRail k={g.k} done={done} label="Sovellukset" onPick={pick} count={counts} />
        {progress}{stepname}
      </div>
      {body}
      {foot}
    </>
  );
}

function Foot({canBack, onBack, onNext, nextLabel, save}: {canBack: boolean; onBack: () => void; onNext: () => void; nextLabel: string; save: boolean}) {
  const close = React.useContext(CloseCtx);
  return (
    <div className="si-foot">
      {canBack && <Button data-testid="il-close" size="row" variant="quiet" onPress={close}>Sulje</Button>}
      <span className="si-grow" />
      {canBack ? <Button data-testid="m-back" size="row" variant="secondary" onPress={onBack}>Takaisin</Button>
        : <Button size="row" variant="secondary" onPress={close}>Peruuta</Button>}
      <Button data-testid={save ? 'm-save' : 'm-next'} size="page" variant="primary" onPress={onNext}>{nextLabel}</Button>
    </div>
  );
}
const CloseCtx = React.createContext<() => void>(() => {});

function Wizard({riff, saved, onSave, onClose, fields, setFields}: {riff: number; saved: Saved; onSave: (ids: MsId[], close: boolean) => void; onClose: () => void; fields: Fields; setFields: React.Dispatch<React.SetStateAction<Fields>>}) {
  const title = 'Microsoft 365: luo sovellukset';
  return (
    <ModalOverlay className="ah-overlay m-overlay" isOpen isDismissable={false} onOpenChange={o => !o && onClose()}>
      <Modal className={`ah-modal si-modal si-split m-modal m-r${riff}`}>
        <Dialog className="ah-dialog si-dialog m-dialog" data-testid="m-dialog" aria-label={title}>
          <CloseCtx.Provider value={onClose}>
            <Heading slot="title">{title}</Heading>
            <Walk riff={riff} saved={saved} onSave={onSave} fields={fields} setFields={setFields} />
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

function MicrosoftRows({saved, onStart}: {saved: Saved; onStart: () => void}) {
  const n = MS.filter(m => saved[m.id]).length;
  const [open, setOpen] = useState(false);
  const set = n === 4;
  // Until every level has credentials, the table is the row's content: it is
  // what the administrator needs before starting. After that it opens on demand.
  const showTable = !set || open;
  return <>
    <li className="si-row il-prow" data-testid="row-microsoft" data-state={set ? 'set' : n ? 'partial' : 'before'}>
      <ProviderMark provider="microsoft" small />
      <span className="si-main il-main"><span className="si-name">Microsoft 365</span>
        <span className="il-provnote">{set ? `${MS.length} tasoa: ${MS.map(m => m.name).join(' · ')}` : 'Neljä tasoa. Jokainen on Entrassa oma sovelluksensa, ja ne luodaan yhdellä kertaa.'}</span>
        {set && <Disclose open={open} onToggle={() => setOpen(!open)} testid="open-microsoft" />}
      </span>
      <span className="si-state">{set ? <StatusMark kind="success" tone="success" label="Tarjolla" /> : n ? <StatusMark tone="warning" label={`${n}/4 tasoa tarjolla`} /> : <StatusMark tone="warning" label="Ei tarjolla" />}</span>
      <span className="si-act">{set ? <Button size="row" variant="quiet">Tunnukset</Button>
        : <Button data-testid="start-microsoft" size="row" variant="primary" onPress={onStart}>{n ? 'Jatka asetusta…' : 'Luo sovellukset…'}</Button>}</span>
    </li>
    {showTable && <li className="si-row si-level il-cmprow" data-testid="compare-microsoft">
      <div className="il-cmpbox"><b className="il-cmp-title">Mitä tasot sallivat</b>
        <Compare p="microsoft" testid="cmp-microsoft" state={l => saved[l.id as MsId] ? 'Tarjolla' : 'Ei tunnuksia'} />
        {!set && <p className="m-quiet il-cmp-foot">Henkilö valitsee tason yhdistäessään tilinsä. Tasoja, joilla ei ole tunnuksia, ei tarjota.</p>}
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
const SAMPLE: Fields = {tenant: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', client: ['4f2c9a1e-7b3d-4e8a-9c21-5d6e7f8a9b0c', '1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b', 'c0ffee00-1234-4abc-8def-0123456789ab', '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918']};
const ownNav: [string, IconName][] = [['Tili', 'user'], ['Laitteet', 'devices'], ['Agentit', 'agent'], ['Yhteydet', 'link'], ['Integraatiot', 'plug']];
const adminNav: [string, IconName][] = [['Palvelin', 'server'], ['Palvelinintegraatiot', 'plug'], ['AI-avain', 'key'], ['Käyttöönotto', 'steer'], ['Käyttäjät ja pääsy', 'users'], ['Levytila', 'disk']];

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [saved, setSaved] = useState<Saved>(noneSaved);
  const [open, setOpen] = useState(true);
  const [run, setRun] = useState(0);
  const [fields, setFields] = useState<Fields>(emptyFields);
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
  const reset = () => { setSaved(noneSaved()); setFields(emptyFields()); setOpen(true); setRun(r => r + 1); };
  return (
    <div className={`m-review variant-${direction}`} data-direction={direction}>
      <header className="m-bar" ref={bar} data-react-aria-top-layer="true">
        <strong>Integraatioiden tasot · kierros 4</strong>
        <label><span className="m-bar-label">Teema</span> <select id="theme" value={theme} onChange={e => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="r-reset" onClick={reset}>Alusta</button>
        <button type="button" data-testid="r-fill" onClick={() => setFields({...SAMPLE, client: [...SAMPLE.client]})}>Täytä tunnukset</button>
        <button type="button" data-testid="r-done" onClick={() => { setSaved(allSaved()); setOpen(false); setRun(r => r + 1); }}>Näytä asetettu</button>
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
            <MicrosoftRows saved={saved} onStart={() => setOpen(true)} />
            <OtherRows p="google" /><OtherRows p="dropbox" />
          </ul></div>
        </main></section>
      </div>
      {open && <Wizard key={run} riff={direction} saved={saved} fields={fields} setFields={setFields} onClose={() => setOpen(false)}
        onSave={(ids, close) => { setSaved(s => ({...s, ...Object.fromEntries(ids.map(i => [i, true]))})); if (close) setOpen(false); }} />}
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
