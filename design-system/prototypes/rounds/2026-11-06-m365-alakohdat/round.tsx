import React, {Fragment, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {appErrors, type AppFields} from '../../../../web/src/app/serverIntegrations';
import {ControlButton, ExternalLink} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {TextField} from '../../../../web/src/components/Primitives';
// The production wizard's dialog classes (si-*); the component itself is not used.
import '../../../../web/src/components/ServerIntegrations.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
// Round 3's masked crops and their record, reused as they are: crops.py
// there is the only writer, and check.mjs here verifies the same files.
import record from '../2026-11-06-m365-leikkeet/crops.json';
import registerImg from '../2026-11-06-m365-leikkeet/crops/register.avif';
import listImg from '../2026-11-06-m365-leikkeet/crops/list.avif';
import overviewImg from '../2026-11-06-m365-leikkeet/crops/overview.avif';
import authImg from '../2026-11-06-m365-leikkeet/crops/auth.avif';
import permsImg from '../2026-11-06-m365-leikkeet/crops/perms.avif';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// Microsoft 365: aseta tunnukset, round 4 (proto-m365-setup-flow). Jari chose
// round 3's A1b Kaistale: a dialog-wide band of the real Entra crop with one
// target lit. Its rows had to be scrolled, so here a step shows one sub-item
// at a time, and the band follows it. The three riffs differ in how the
// sub-items are reached: tabs the reader picks freely, a stepper the one
// primary button walks, or numbered segments with arrows on the band itself.
// The band keeps one height inside a step, so nothing below it jumps.
const directions = ['A1b1 Välilehdet', 'A1b2 Askeleet', 'A1b3 Nuolet'];
const LINES = [
  'A1b1 Välilehdet: kaistaleen alla välilehti jokaiselle alakohdalle Entran nimellä; valittu välilehti siirtää kohdevalon. Seuraava vie seuraavaan vaiheeseen.',
  'A1b2 Askeleet: alakohdat numeroituna askelrivinä, ja yksi Seuraava-nappi kulkee alakohta kerrallaan läpi koko ohjeen. Edistymispalkki täyttyy alakohdittain.',
  'A1b3 Nuolet: kaistaleen päällä nuolet ja sen yllä numeroidut segmentit; alla vain valitun alakohdan ohje. Seuraava vie seuraavaan vaiheeseen.',
];
const TABS = 0, STEPPER = 1, ARROWS = 2;

type Section = 'microsoft' | 'microsoft_drafts' | 'microsoft_read';
const LEVELS: {id: Section; label: string; app: string}[] = [
  {id: 'microsoft', label: 'Täysi pääsy', app: 'Open Habitat'},
  {id: 'microsoft_drafts', label: 'Luonnokset', app: 'Open Habitat – luonnokset'},
  {id: 'microsoft_read', label: 'Vain luku', app: 'Open Habitat – vain luku'},
];
// Copies of ServerIntegrations.tsx, which mirrors the daemon's level scopes.
const IDENTITY = ['openid', 'profile', 'User.Read', 'offline_access'];
const PERMS: Record<Section, string[]> = {
  microsoft: [...IDENTITY, 'Files.ReadWrite.All', 'Sites.ReadWrite.All', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite', 'Contacts.ReadWrite'],
  microsoft_drafts: [...IDENTITY, 'Files.Read.All', 'Sites.Read.All', 'Mail.ReadWrite', 'Calendars.Read', 'Contacts.Read'],
  microsoft_read: [...IDENTITY, 'Files.Read.All', 'Sites.Read.All', 'Mail.Read', 'Calendars.Read', 'Contacts.Read'],
};
// What the Delegated permissions picker shows beside each name.
const SAYS: Record<string, string> = {
  openid: 'Sign users in',
  profile: "View users' basic profile",
  offline_access: 'Maintain access to data you have given it access to',
  'Files.ReadWrite.All': 'Have full access to all files user can access',
  'Files.Read.All': 'Read all files that user can access',
  'Sites.ReadWrite.All': 'Edit or delete items in all site collections',
  'Sites.Read.All': 'Read items in all site collections',
  'Mail.ReadWrite': 'Read and write access to user mail',
  'Mail.Read': 'Read user mail',
  'Mail.Send': 'Send mail as a user',
  'Calendars.ReadWrite': 'Have full access to user calendars',
  'Calendars.Read': 'Read user calendars',
  'Contacts.ReadWrite': 'Have full access to user contacts',
  'Contacts.Read': 'Read user contacts',
};
const REDIRECT = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
// The one link: it opens App registrations › All applications whatever deeper
// blade it names (Jari and Aino, 2026-11-06), so it names that page.
const ENTRA_LIST = 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade';
// Entra names the tenant by its domain. The host does not know it, so the
// guide says <domain>, and the crops have it masked.
const ORG = '<domain>';
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const consentV1 = (tenant: string, client: string) => `https://login.microsoftonline.com/${tenant}/adminconsent?client_id=${client}`;
const AUTH = 'Authentication (Preview)';

/* ---------- the band ---------- */

type Box = [number, number, number, number];
type CropName = 'register' | 'list' | 'overview' | 'auth' | 'perms';
type CropRec = {box: Box; size: [number, number]; targets: Record<string, Box>};
const CROPS = (record as unknown as {crops: Record<CropName, CropRec>}).crops;
const SRC: Record<CropName, string> = {register: registerImg, list: listImg, overview: overviewImg, auth: authImg, perms: permsImg};
const ALT: Record<CropName, string> = {
  register: 'Entra: Register an application',
  list: 'Entra: App registrations, All applications',
  overview: 'Entra: sovelluksen Overview',
  auth: 'Entra: sovelluksen Authentication (Preview)',
  perms: 'Entra: sovelluksen API permissions',
};

/**
 * The part of a crop the band shows around a target, at the band's fixed
 * aspect. On a desktop it starts at the crop's left edge, so the app's menu
 * stays in view, and is about 1500 screenshot pixels wide, which puts the
 * text near Entra's own size (the shots are 2x). On a phone it is the
 * target's neighbourhood. A target too big for that grows the view.
 */
function bandOf(crop: CropName, t: string, aspect: number, narrow: boolean): Box {
  const c = CROPS[crop], tg = c.targets[t];
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

function Band({crop, t, narrow, children}: {crop: CropName; t: string; narrow: boolean; children?: React.ReactNode}) {
  const c = CROPS[crop];
  const aspect = narrow ? 2.3 : 3.7;
  const v = bandOf(crop, t, aspect, narrow);
  const w = v[2] - v[0], h = v[3] - v[1];
  const pct = (b: Box) => ({left: `${(b[0] - v[0]) / w * 100}%`, top: `${(b[1] - v[1]) / h * 100}%`, width: `${(b[2] - b[0]) / w * 100}%`, height: `${(b[3] - b[1]) / h * 100}%`});
  return (
    <figure className="m-shot m-band" data-testid="m-strip" data-crop={crop}>
      <div className="m-shot-frame" style={{aspectRatio: `${aspect}`}}>
        <img src={SRC[crop]} alt={ALT[crop]} draggable={false} style={pct(c.box)} />
        <span className="m-mark" data-testid="m-mark" data-target={`${crop}.${t}`} style={pct(c.targets[t])} />
        {children}
      </div>
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

/* ---------- review chrome and page ---------- */

let reviewTheme = 'light';
let reviewSection: Section = 'microsoft';
const copied: string[] = [];
(window as any).__copied = copied;

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [section, setSection] = useState<Section>(reviewSection);
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [run, setRun] = useState(0);
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
  const restart = () => { setSaved(false); setOpen(true); setRun(r => r + 1); };
  const level = LEVELS.find(l => l.id === section)!;
  return (
    <div className={`m-review variant-${direction}`} data-direction={direction} data-section={section}>
      <header className="m-bar" ref={bar} data-react-aria-top-layer="true">
        <strong>Microsoft 365: aseta tunnukset · kierros 4</strong>
        <label>Taso <select id="level" value={section} onChange={e => { reviewSection = e.target.value as Section; setSection(reviewSection); restart(); }}>
          {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
        <label>Teema <select id="theme" value={theme} onChange={e => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="m-reset" onClick={restart}>Alusta</button>
        <ol className="m-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <main className="m-page">
        <h1>Palvelinintegraatiot</h1>
        <div className="m-row" data-testid="m-row">
          <span className="m-row-name"><Icon name="mail" />Microsoft 365 · {level.label}</span>
          {saved
            ? <span className="m-row-state" data-testid="m-saved"><Icon name="check" />Tunnukset asetettu. Henkilöt voivat yhdistää Microsoft 365 -tilinsä.</span>
            : <span className="m-row-state m-quiet">Ei tarjota: tunnukset puuttuvat</span>}
          <ControlButton data-testid="m-open" size="row" variant="secondary" onPress={restart}>
            {saved ? 'Aloita alusta' : 'Aseta tunnukset…'}
          </ControlButton>
        </div>
      </main>
      {open && <Wizard key={run} direction={direction} section={section}
        onSaved={() => { setOpen(false); setSaved(true); }} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ---------- the pieces of a sub-item ---------- */

function Copy({value, label}: {value: string; label: string}) {
  const [done, setDone] = useState(false);
  return (
    <ControlButton data-testid="m-copy" size="row" variant="quiet" aria-label={`Kopioi ${label}`}
      onPress={() => {
        copied.push(value);
        void navigator.clipboard?.writeText(value).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}>
      <Icon name={done ? 'check' : 'copy'} />
    </ControlButton>
  );
}

/** Where in Entra, in Entra's words at reading size; only the first step links. */
function Where({crumbs, link}: {crumbs: string[]; link?: boolean}) {
  return (
    <div className="m-where" data-testid="m-where">
      <p className="m-path">
        {crumbs.map((c, i) => <Fragment key={i}>{i > 0 && <span className="m-sep" aria-hidden="true">›</span>}<span className="m-crumb">{c}</span></Fragment>)}
      </p>
      {link && (
        <p className="m-open">
          <ExternalLink href={ENTRA_LIST} target="_blank" rel="noreferrer" data-testid="m-console-link">Avaa App registrations <Icon name="external" /></ExternalLink>
        </p>
      )}
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
const Note = ({children, icon}: {children: React.ReactNode; icon?: 'user'}) => (
  <p className="m-quiet m-note">{icon && <Icon name={icon} />}<span>{children}</span></p>
);
const ROLE_DEV = 'Vaatii vähintään roolin Application Developer.';
const ROLE_ADMIN = 'Vaatii roolin Cloud Application Administrator, Application Administrator tai Privileged Role Administrator.';
const LEVEL_APP = 'Oma sovellus tälle tasolle: Microsoft antaa sovelluksen tunnukselle kaikki sovellukselle hyväksytyt oikeudet, joten taso on raja vain omana sovelluksenaan.';
const Reopen = ({app}: {app: string}) => (
  <Note>Jos sivu ehti sulkeutua: <em>App registrations</em> › <em>All applications</em>, kirjoita <em>{app}</em> hakukenttään ja valitse täsmälleen tämä nimi.</Note>
);

/** A permission chip is one button: the whole name is the target, so it fits two to a row on a phone. */
function PermCopy({name}: {name: string}) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="m-perm-btn" data-testid="m-copy" data-done={done || undefined} aria-label={`Kopioi ${name}`}
      onClick={() => {
        copied.push(name);
        void navigator.clipboard?.writeText(name).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}>
      <code className="m-perm-name">{name}</code>
      <Icon name={done ? 'check' : 'copy'} />
    </button>
  );
}

/** The permissions as Entra's picker takes them: one name per chip, one copy each, no ticks. */
function PermGrid({section}: {section: Section}) {
  const list = PERMS[section].filter(p => p !== 'User.Read');
  return (
    <>
      <ol className="m-perms" data-testid="m-perms">
        {list.map(p => <li key={p} className="m-perm" title={SAYS[p]}><PermCopy name={p} /></li>)}
      </ol>
      <p className="m-count" data-testid="m-count">{list.length} oikeutta · User.Read on taulukossa valmiina</p>
    </>
  );
}

type Ctx = {
  section: Section; app: string;
  values: AppFields; errors: Partial<Record<string, string>>; setField: (f: string, v: string) => void;
  idsOk: boolean; client: string; tenant: string;
};

const IdField = ({ctx, f}: {ctx: Ctx; f: 'client_id' | 'tenant_id'}) => (
  <div className="m-idfield">
    <TextField data-testid={`m-field-${f}`} label={f === 'client_id' ? 'Application (client) ID' : 'Directory (tenant) ID'} mono
      value={ctx.values[f] ?? ''} onChange={v => ctx.setField(f, v)} error={ctx.errors[f]} />
  </div>
);

/** Production's consent hand-off, the v1 link filled from the typed ids. */
function Handoff({ctx, role}: {ctx: Ctx; role?: boolean}) {
  const url = ctx.idsOk ? consentV1(ctx.tenant, ctx.client) : null;
  return (
    <div className="si-handoff m-handoff" data-testid="m-handoff" data-filled={url ? '' : undefined}>
      <span className="m-quiet m-note">{role && <Icon name="user" />}<span>{role && `${ROLE_ADMIN} `}Jos rooli puuttuu, lähetä hyväksyntälinkki sille, jolla se on.{url ? '' : ' Linkki täyttyy, kun tunnukset on liitetty.'}</span></span>
      {url && <div className="si-block"><pre className="si-cmd">{url}</pre><Copy value={url} label="hyväksyntälinkki" /></div>}
    </div>
  );
}

/* A step is a list of sub-items in Entra's order. Each has one place on one
   crop, which the band lights, and its own short instruction. Rows that had
   no place of their own in round 3 (the redirect value, Allow public client
   flows, the permission list) join the sub-item whose page they are on. */
type Part = {id: string; name: string; at: [CropName, string]; field?: 'client_id' | 'tenant_id'; body: React.ReactNode};
type Step = {id: string; title: string; parts: Part[]};

function steps(ctx: Ctx): Step[] {
  const {app, section} = ctx;
  return [
    {id: 'register', title: 'Rekisteröi sovellus', parts: [
      {id: 'new', name: 'New registration', at: ['list', 'new'], body: <>
        <Where crumbs={['App registrations', 'All applications']} link />
        <Act>Valitse listan yläpuolelta <em>New registration</em>.</Act>
        <Note icon="user">{ROLE_DEV}</Note>
      </>},
      {id: 'name', name: 'Name', at: ['register', 'name'], body: <>
        <Act>Kirjoita nimeksi</Act>
        <Value value={app} label="Name" />
        {section !== 'microsoft' && <p className="si-effect" data-testid="m-level-app">{LEVEL_APP}</p>}
      </>},
      {id: 'accounts', name: 'Supported account types', at: ['register', 'accounts'], body: <>
        <Act>Valitse, jos ei ole jo valittuna</Act>
        <Value value={`Single tenant only - ${ORG}`} label="Supported account types" copy={false} />
        <Note>{ORG} on organisaatiosi domain; kuvissa se on peitetty. Vain organisaation työtilit voivat yhdistää.</Note>
      </>},
      {id: 'redirect', name: 'Redirect URI', at: ['register', 'redirect'], body: <>
        <Act>Jätä <em>Redirect URI (optional)</em> tyhjäksi. Osoite lisätään seuraavassa vaiheessa.</Act>
      </>},
      {id: 'register', name: 'Register', at: ['register', 'register'], body: <>
        <Act>Valitse sivun alareunasta <em>Register</em>.</Act>
      </>},
      {id: 'done', name: 'Valmis', at: ['overview', 'menu'], body: <>
        <Done>Entra avaa sovelluksen <em>{app}</em>: otsikkona sen nimi, vasemmalla sen oma valikko ja siinä <em>Overview</em> valittuna.</Done>
      </>},
    ]},
    {id: 'public', title: 'Julkinen asiakas', parts: [
      {id: 'auth', name: AUTH, at: ['auth', 'menu'], body: <>
        <Where crumbs={[AUTH, 'Redirect URI configuration']} />
        <Act>Valitse sovelluksen vasemmasta valikosta <em>{AUTH}</em>. Sivu aukeaa välilehdelle <em>Redirect URI configuration</em>.</Act>
        <Reopen app={app} />
      </>},
      {id: 'add', name: 'Add Redirect URI', at: ['auth', 'add'], body: <>
        <Act>Valitse <em>Add Redirect URI</em>, sitten <em>Mobile and desktop applications</em>. Rastita ehdotuksista tämä osoite ja valitse <em>Configure</em>.</Act>
        <Value value={REDIRECT} label="Redirect URI" />
      </>},
      {id: 'settings', name: 'Settings', at: ['auth', 'settings'], body: <>
        <Where crumbs={[AUTH, 'Settings']} />
        <Act>Valitse välilehti <em>Settings</em>. Kohdassa <em>Allow public client flows</em> valitse <em>Enabled</em> ja <em>Save</em>.</Act>
        <Note>Henkilöt kirjautuvat laitekoodilla, joten client secretiä ei luoda.</Note>
      </>},
      {id: 'done', name: 'Valmis', at: ['auth', 'tabs'], body: <>
        <Done><em>Redirect URI configuration</em> -välilehdellä näkyy Mobile and desktop applications ja tämä osoite, ja <em>Settings</em>-välilehdellä Allow public client flows on Enabled.</Done>
      </>},
    ]},
    {id: 'permissions', title: 'Käyttöoikeudet', parts: [
      {id: 'menu', name: 'API permissions', at: ['perms', 'menu'], body: <>
        <Act>Valitse sovelluksen vasemmasta valikosta <em>API permissions</em>.</Act>
        <Reopen app={app} />
      </>},
      {id: 'add', name: 'Add a permission', at: ['perms', 'add'], body: <>
        <Act>Valitse <em>Add a permission</em>, sitten <em>Microsoft Graph</em> ja <em>Delegated permissions</em>.</Act>
      </>},
      {id: 'perms', name: `Oikeudet (${PERMS[section].length - 1})`, at: ['perms', 'configured'], body: <>
        <Act>Haku <em>Select permissions</em> löytää yhden kerrallaan: kopioi, liitä ja rastita. Rastit säilyvät. Lopuksi <em>Add permissions</em>; ne tulevat kuvan taulukkoon.</Act>
        <PermGrid section={section} />
      </>},
      {id: 'done', name: 'Valmis', at: ['perms', 'graph'], body: <>
        <Done>ryhmärivillä lukee <em>Microsoft Graph ({PERMS[section].length})</em>. Kuvassa lukee vielä (1), koska valmiina on vain User.Read.</Done>
      </>},
    ]},
    {id: 'consent', title: 'Hyväksyntä ja tunnukset', parts: [
      {id: 'grant', name: 'Grant admin consent', at: ['perms', 'grant'], body: <>
        <Act>Valitse samalla sivulla <em>Grant admin consent for {ORG}</em>, sitten <em>Yes</em>.</Act>
        <Done>Status-sarakkeessa lukee jokaisella rivillä <em>Granted for {ORG}</em>.</Done>
        <Handoff ctx={ctx} role />
      </>},
      {id: 'overview', name: 'Overview', at: ['overview', 'menu'], body: <>
        <Act>Valitse vasemmasta valikosta <em>Overview</em>. Sieltä kopioidaan kaksi tunnusta: vie osoitin arvon päälle, niin sen perään tulee kopiointinappi.</Act>
      </>},
      {id: 'client', name: 'Application (client) ID', at: ['overview', 'client'], field: 'client_id', body: <>
        <Act>Kopioi <em>Application (client) ID</em> ja liitä se tähän.</Act>
        <IdField ctx={ctx} f="client_id" />
      </>},
      {id: 'tenant', name: 'Directory (tenant) ID', at: ['overview', 'tenant'], field: 'tenant_id', body: <>
        <Act>Kopioi <em>Directory (tenant) ID</em> ja liitä se tähän. <em>Object ID</em> niiden välissä on eri tunnus, sitä ei tarvita.</Act>
        <IdField ctx={ctx} f="tenant_id" />
        <Note>Salaisuutta ei tarvita.</Note>
      </>},
    ]},
  ];
}

function enterOnly(ctx: Ctx): Step {
  return {id: 'enter', title: 'Tunnukset', parts: [
    {id: 'search', name: 'Hakukenttä', at: ['list', 'search'], body: <>
      <Where crumbs={['App registrations', 'All applications']} link />
      <Act>Kirjoita sovelluksen nimi hakukenttään ja valitse se listasta. Entra avaa sen Overview-sivun.</Act>
    </>},
    {id: 'client', name: 'Application (client) ID', at: ['overview', 'client'], field: 'client_id', body: <>
      <Act>Kopioi <em>Application (client) ID</em> ja liitä se tähän.</Act>
      <IdField ctx={ctx} f="client_id" />
    </>},
    {id: 'tenant', name: 'Directory (tenant) ID', at: ['overview', 'tenant'], field: 'tenant_id', body: <>
      <Act>Kopioi <em>Directory (tenant) ID</em> ja liitä se tähän.</Act>
      <IdField ctx={ctx} f="tenant_id" />
      <Note>Salaisuutta ei tarvita.</Note>
      <Handoff ctx={ctx} />
    </>},
  ]};
}

/* ---------- the three ways to reach a sub-item ---------- */

/** A1b1: a tab list in Entra's words; arrow keys move along it as in any tab list. */
function Tabs({step, sub, setSub}: {step: Step; sub: number; setSub: (n: number) => void}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') e.stopPropagation();
    const n = e.key === 'ArrowRight' ? sub + 1 : e.key === 'ArrowLeft' ? sub - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? step.parts.length - 1 : -1;
    if (n < 0 || n >= step.parts.length) return;
    // The review picker also listens to the arrow keys; the tab list keeps them.
    e.preventDefault(); e.stopPropagation(); setSub(n); refs.current[n]?.focus();
  };
  return (
    <div className="m-tabs" role="tablist" aria-label={`${step.title}: kohdat`} onKeyDown={key} data-testid="m-tabs">
      {step.parts.map((p, j) => (
        <button key={p.id} ref={el => { refs.current[j] = el; }} type="button" role="tab" id={`m-tab-${step.id}-${p.id}`}
          aria-selected={j === sub} aria-controls="m-panel" tabIndex={j === sub ? 0 : -1} data-testid="m-tab"
          className="m-tab" data-done-tab={p.id === 'done' || undefined} onClick={() => setSub(j)}>
          {p.id === 'done' && <Icon name="check" />}
          <span className="m-tab-n">{j + 1}</span><span className="m-tab-name">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

/** A1b2: the sub-items as a numbered line; passed ones carry a tick. The footer walks it. */
function Stepper({step, sub, setSub}: {step: Step; sub: number; setSub: (n: number) => void}) {
  return (
    <ol className="m-stepper" aria-label={`${step.title}: kohdat`} data-testid="m-stepper">
      {step.parts.map((p, j) => (
        <li key={p.id} data-passed={j < sub || undefined} aria-current={j === sub ? 'step' : undefined}>
          <button type="button" className="m-dot-btn" data-testid="m-dot" onClick={() => setSub(j)} aria-label={`${j + 1}. ${p.name}`}>
            <span className="m-dot">{j < sub ? <Icon name="check" /> : j + 1}</span>
            <span className="m-dot-name">{p.name}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** A1b3: numbered segments above the band; the arrows sit on the band itself. */
function Segments({step, sub, setSub}: {step: Step; sub: number; setSub: (n: number) => void}) {
  return (
    <div className="m-seg-row">
      <div className="m-seg" role="radiogroup" aria-label={`${step.title}: kohdat`} data-testid="m-seg">
        {step.parts.map((p, j) => (
          <button key={p.id} type="button" role="radio" aria-checked={j === sub} aria-label={`${j + 1}. ${p.name}`}
            className="m-seg-item" data-testid="m-segment" onClick={() => setSub(j)}>
            {p.id === 'done' ? <Icon name="check" /> : j + 1}
          </button>
        ))}
      </div>
      <p className="m-seg-name" data-testid="m-panel-head">{step.parts[sub].name}</p>
    </div>
  );
}

function StepBody({step, sub, setSub, direction}: {step: Step; sub: number; setSub: (n: number) => void; direction: number}) {
  const narrow = useNarrow();
  const part = step.parts[sub];
  const n = step.parts.length;
  const panel = (
    <div className="m-panel" id="m-panel" data-testid="m-panel" data-part={`${step.id}.${part.id}`} data-target={`${part.at[0]}.${part.at[1]}`}
      role={direction === TABS ? 'tabpanel' : 'group'} aria-labelledby={direction === TABS ? `m-tab-${step.id}-${part.id}` : undefined}
      aria-label={direction === TABS ? undefined : part.name}>
      {part.body}
    </div>
  );
  const band = (
    <Band crop={part.at[0]} t={part.at[1]} narrow={narrow}>
      {direction === ARROWS && <span className="m-band-arrows">
        <ControlButton className="m-band-arrow" data-testid="m-strip-prev" size="row" variant="secondary"
          aria-label="Edellinen kohta" isDisabled={sub === 0} onPress={() => setSub(sub - 1)}><Icon name="back" /></ControlButton>
        <ControlButton className="m-band-arrow" data-testid="m-strip-next" size="row" variant="secondary"
          aria-label="Seuraava kohta" isDisabled={sub >= n - 1} onPress={() => setSub(sub + 1)}><Icon name="forward" /></ControlButton>
      </span>}
    </Band>
  );
  if (direction === TABS) return <>{band}<Tabs step={step} sub={sub} setSub={setSub} />{panel}</>;
  if (direction === STEPPER) return <>{band}<Stepper step={step} sub={sub} setSub={setSub} />{panel}</>;
  return <><Segments step={step} sub={sub} setSub={setSub} />{band}{panel}</>;
}

/* ---------- the dialog shell (production dialog classes) ---------- */

function Wizard({direction, section, onSaved, onClose}: {direction: number; section: Section; onSaved: () => void; onClose: () => void}) {
  const app = LEVELS.find(l => l.id === section)!.app;
  const [at, setAt] = useState(0);
  const [sub, setSub] = useState(0);
  const [skip, setSkip] = useState(false);
  const [values, setValues] = useState<AppFields>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const client = (values.client_id ?? '').trim(), tenant = (values.tenant_id ?? '').trim();
  const idsOk = guid.test(client) && guid.test(tenant) && client.toLowerCase() !== tenant.toLowerCase();
  const setField = (f: string, v: string) => { setValues(x => ({...x, [f]: v})); setErrors(x => ({...x, [f]: undefined})); };
  const ctx: Ctx = {section, app, values, errors, setField, idsOk, client, tenant};
  const list = skip ? [enterOnly(ctx)] : steps(ctx);
  const i = Math.min(at, list.length - 1);
  const step = list[i];
  const s = Math.min(sub, step.parts.length - 1);
  const last = i === list.length - 1;
  const lastPart = s === step.parts.length - 1;
  const go = (n: number, toSub = 0) => { setAt(n); setSub(toSub); setErrors({}); };
  const submit = () => {
    const e = appErrors(section, {client_id: client, tenant_id: tenant});
    setErrors(e);
    if (Object.keys(e).length) {
      // The field with the error may be on another sub-item: open it.
      const j = step.parts.findIndex(p => p.field && e[p.field]);
      if (j >= 0) setSub(j);
      return;
    }
    setSaving(true);
    setTimeout(() => { setSaving(false); onSaved(); }, 500);
  };
  // A1b2 walks sub-items with the footer; the others move whole steps.
  const walk = direction === STEPPER;
  const next = () => walk && !lastPart ? setSub(s + 1) : go(i + 1);
  const back = () => {
    if (walk && s > 0) return setSub(s - 1);
    if (skip) { setSkip(false); return go(0); }
    go(i - 1, walk ? list[i - 1].parts.length - 1 : 0);
  };
  const nextLabel = walk ? (lastPart ? `Seuraava vaihe` : `Seuraava: ${step.parts[s + 1].name}`) : 'Seuraava';
  const showSave = walk ? last && lastPart : last;
  const title = `Microsoft 365${section === 'microsoft' ? '' : ` (${LEVELS.find(l => l.id === section)!.label.toLowerCase()})`}: aseta tunnukset`;
  const canBack = i > 0 || skip || (walk && s > 0);
  return (
    <ModalOverlay className="ah-overlay m-overlay" isOpen isDismissable={false} onOpenChange={o => !o && onClose()}>
      <Modal className={`ah-modal si-modal si-split m-modal m-d${direction}`}>
        <Dialog className="ah-dialog si-dialog m-dialog" data-testid="m-dialog" aria-label={title}>
          <Heading slot="title">{title}</Heading>
          {list.length > 1 && (
            <div className="m-stephead">
              <div className="si-progress" data-testid="m-progress" role="img" aria-label={`Vaihe ${i + 1}/${list.length}`}>
                {list.map((st, j) => (
                  <span key={st.id} data-done={j < i || undefined} data-current={(j === i && !walk) || undefined}>
                    {walk && j === i && <i className="m-progress-fill" style={{width: `${(s + 1) / st.parts.length * 100}%`}} />}
                  </span>
                ))}
              </div>
              <p className="si-stepname" data-testid="m-stepname" data-step={step.id}>
                <span className="si-muted">{i + 1}/{list.length}</span> {step.title}
              </p>
            </div>
          )}
          <div className="si-stepbody m-stepbody" data-testid={`m-step-${step.id}`}>
            <StepBody key={`${step.id}-${skip}`} step={step} sub={s} setSub={setSub} direction={direction} />
          </div>
          <div className="si-foot">
            {i === 0 && !skip && !(walk && s > 0) && (
              <ControlButton data-testid="m-skip" size="row" variant="quiet" onPress={() => { setSkip(true); setSub(0); setErrors({}); }}>Minulla on jo sovellus</ControlButton>
            )}
            <span className="si-grow" />
            {canBack ? (
              <ControlButton data-testid="m-back" size="row" variant="secondary" isDisabled={saving} onPress={back}>Takaisin</ControlButton>
            ) : (
              <ControlButton size="row" variant="secondary" onPress={onClose}>Peruuta</ControlButton>
            )}
            {showSave ? (
              <ControlButton data-testid="m-save" size="page" variant="primary" isDisabled={saving} onPress={submit}>
                {saving ? 'Tallennetaan…' : 'Tallenna'}
              </ControlButton>
            ) : (
              <ControlButton data-testid="m-next" size="page" variant="primary" onPress={next}>{nextLabel}</ControlButton>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
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
