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
import record from './crops.json';
import registerImg from './crops/register.avif';
import listImg from './crops/list.avif';
import overviewImg from './crops/overview.avif';
import authImg from './crops/auth.avif';
import permsImg from './crops/perms.avif';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// Microsoft 365: aseta tunnukset, round 3 (proto-m365-setup-flow). Jari chose
// round 2's A1 Valikkopala: A's four steps with a piece of the real Entra page
// at each. Two changes in all three riffs: the pieces are real crops of Jari's
// screenshots (crops.py masks every id and the domain before anything is
// written; check.mjs verifies the committed crops), and the permissions have
// no checkboxes, each stays its own row with its own copy. The riffs differ in
// crop size and placement, in how the exact row or button is highlighted, and
// in how the dark theme frames a light screenshot. Synthetic throughout.
const directions = ['A1a Vieressä', 'A1b Kaistale', 'A1c Rivissä'];
const LINES = [
  'A1a Vieressä: koko Entran sivun leike ohjeen vieressä, tehtävät kohdat numeroitu kehyksin samoin numeroin kuin ohjeen rivit; tummassa teemassa leike on valkoisella paspiksella.',
  'A1b Kaistale: leveä kaistale Entran sivua ohjeen yläpuolella ja kohdevalo yhdellä kohdalla kerrallaan; ohjeen rivin Näytä-nappi siirtää valon, tummassa teemassa kuva on himmennetty.',
  'A1c Rivissä: ei koko sivua, vaan jokaisessa ohjeen rivissä täsmälleen sen napin tai kentän leike luonnollisessa koossa; koko sivu avautuu pyydettäessä.',
];
const A1A = 0, A1B = 1, A1C = 2;

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
  'User.Read': 'Sign in and read user profile',
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

/* ---------- the crops ---------- */

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
// The part of each crop A1a shows beside the steps: the menu and the area
// worked in, without the far right that only shrinks the text.
const SIDE_VIEW: Record<CropName, Box> = {
  register: [0, 0, 1660, 1420],
  list: [0, 0, 1260, 1050],
  overview: [0, 0, 1160, 800],
  auth: [0, 0, 1400, 750],
  perms: [0, 0, 1340, 1130],
};

type Spot = {crop: CropName; t: string; n: number};
const pad = ([l, t, r, b]: Box, p: number, c: Box): Box => [Math.max(c[0], l - p), Math.max(c[1], t - p), Math.min(c[2], r + p), Math.min(c[3], b + p)];

/**
 * A view of one crop in original-screenshot pixels. The image is scaled so
 * the view fills the frame; marks are placed in the same coordinates.
 */
function Shot({crop, view, marks = [], mode = 'outline', active, label, testid = 'm-shot'}: {
  crop: CropName; view?: Box; marks?: Spot[]; mode?: 'outline' | 'spot' | 'none'; active?: Spot | null; label?: string; testid?: string;
}) {
  const c = CROPS[crop];
  const v = view ?? c.box;
  const w = v[2] - v[0], h = v[3] - v[1];
  const pct = (b: Box) => ({left: `${(b[0] - v[0]) / w * 100}%`, top: `${(b[1] - v[1]) / h * 100}%`, width: `${(b[2] - b[0]) / w * 100}%`, height: `${(b[3] - b[1]) / h * 100}%`});
  const shown = mode === 'spot' ? (active ? [active] : []) : mode === 'outline' ? marks : [];
  return (
    <figure className={`m-shot m-shot-${mode}`} data-testid={testid} data-crop={crop}>
      <div className="m-shot-frame" style={{aspectRatio: `${w} / ${h}`}}>
        <img src={SRC[crop]} alt={label ?? ALT[crop]} draggable={false} style={pct(c.box)} />
        {shown.map(s => (
          <span key={`${s.crop}-${s.t}`} className="m-mark" data-testid="m-mark" data-target={`${s.crop}.${s.t}`} style={pct(c.targets[s.t])}>
            {mode === 'outline' && <b>{s.n}</b>}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** A1c: exactly one control, cut tight, at Entra's own size (the shots are 2x). */
function Cut({spot}: {spot: Spot}) {
  const c = CROPS[spot.crop];
  const v = pad(c.targets[spot.t], 10, c.box);
  return (
    <span className="m-cut" style={{width: `${(v[2] - v[0]) / 2}px`}}>
      <Shot crop={spot.crop} view={v} mode="none" label={`${ALT[spot.crop]}, kohta`} testid="m-cut" />
    </span>
  );
}

/** A1b: a band of the crop around the lit target, full dialog width. */
function bandOf(s: Spot, narrow: boolean): Box {
  const c = CROPS[s.crop], tg = c.targets[s.t];
  const cw = c.box[2] - c.box[0];
  // Wide enough that the text shows near Entra's own size (the shots are 2x)
  // with the menu or toolbar around the target; on a phone, only the
  // target's neighbourhood. No taller than a third of the width.
  const wide = Math.min(cw, narrow ? Math.max(720, tg[2] - tg[0] + 120) : Math.max(1500, tg[2] + 120));
  const left = narrow ? Math.max(c.box[0], Math.min(c.box[2] - wide, tg[0] - 60)) : c.box[0];
  const tall = Math.min(c.box[3] - c.box[1], Math.max(tg[3] - tg[1] + 200, Math.round(wide / 3)));
  const mid = (tg[1] + tg[3]) / 2;
  const top = Math.max(c.box[1], Math.min(c.box[3] - tall, Math.round(mid - tall / 2)));
  return [left, top, left + wide, top + tall];
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
        <strong>Microsoft 365: aseta tunnukset · kierros 3</strong>
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

/* ---------- A's pieces ---------- */

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

/* A step is data: rows in Entra's order, some tied to a target on a crop.
   Each riff lays the same rows and crops out its own way. */
type Row =
  | {k: 'where'; crumbs: string[]; link?: boolean}
  | {k: 'field'; name: string; act: React.ReactNode; value?: string; copy?: boolean; at?: [CropName, string]}
  | {k: 'done'; text: React.ReactNode; at?: [CropName, string]}
  | {k: 'node'; node: React.ReactNode};
type Step = {id: string; title: string; rows: Row[]};

function Done({children}: {children: React.ReactNode}) {
  return <span className="m-done-in"><Icon name="check" /><span><strong>Valmis, kun </strong>{children}</span></span>;
}
const Role = ({children}: {children: React.ReactNode}) => <p className="m-quiet m-role" data-testid="m-role"><Icon name="user" /><span>{children}</span></p>;
const ROLE_DEV = 'Vaatii vähintään roolin Application Developer.';
const ROLE_ADMIN = 'Vaatii roolin Cloud Application Administrator, Application Administrator tai Privileged Role Administrator.';
const LEVEL_APP = 'Oma sovellus tälle tasolle: Microsoft antaa sovelluksen tunnukselle kaikki sovellukselle hyväksytyt oikeudet, joten taso on raja vain omana sovelluksenaan.';
const Reopen = ({app}: {app: string}) => (
  <p className="m-quiet" data-testid="m-reopen">Jos sivu ehti sulkeutua: <em>App registrations</em> › <em>All applications</em>, kirjoita <em>{app}</em> hakukenttään ja valitse täsmälleen tämä nimi.</p>
);

/** The permissions as Entra's picker takes them: one name per row, one copy each, no ticks. */
function PermList({section}: {section: Section}) {
  const list = PERMS[section].filter(p => p !== 'User.Read');
  return (
    <>
      <ol className="m-perms" data-testid="m-perms">
        {list.map(p => (
          <li key={p} className="m-perm">
            <code className="m-perm-name">{p}</code>
            <span className="m-says">{SAYS[p]}</span>
            <Copy value={p} label={p} />
          </li>
        ))}
      </ol>
      <p className="m-count" data-testid="m-count">{list.length} oikeutta · User.Read on siellä valmiina</p>
    </>
  );
}

type Ctx = {
  direction: number; section: Section; app: string;
  values: AppFields; errors: Partial<Record<string, string>>; setField: (f: string, v: string) => void;
  idsOk: boolean; client: string; tenant: string;
};

function Fields({ctx}: {ctx: Ctx}) {
  return (
    <div className="si-fields m-idfields">
      <TextField data-testid="m-field-client_id" label="Application (client) ID" mono value={ctx.values.client_id ?? ''} onChange={v => ctx.setField('client_id', v)} error={ctx.errors.client_id} />
      <TextField data-testid="m-field-tenant_id" label="Directory (tenant) ID" mono value={ctx.values.tenant_id ?? ''} onChange={v => ctx.setField('tenant_id', v)} error={ctx.errors.tenant_id} />
    </div>
  );
}

/** Production's consent hand-off, the v1 link filled from the typed ids. */
function Handoff({ctx}: {ctx: Ctx}) {
  const url = ctx.idsOk ? consentV1(ctx.tenant, ctx.client) : null;
  return (
    <div className="si-handoff" data-testid="m-handoff" data-filled={url ? '' : undefined}>
      <span className="m-quiet">Jos rooli puuttuu, lähetä hyväksyntälinkki sille, jolla se on.{url ? '' : ' Linkki täyttyy, kun tunnukset on liitetty.'}</span>
      {url && <div className="si-block"><pre className="si-cmd">{url}</pre><Copy value={url} label="hyväksyntälinkki" /></div>}
    </div>
  );
}

function steps(ctx: Ctx): Step[] {
  const {app, section} = ctx;
  return [
    {id: 'register', title: 'Rekisteröi sovellus', rows: [
      {k: 'where', crumbs: ['App registrations', 'All applications'], link: true},
      {k: 'field', name: 'New registration', act: 'Valitse listan yläpuolelta.', at: ['list', 'new']},
      {k: 'field', name: 'Name', act: 'Kirjoita', value: app, at: ['register', 'name']},
      {k: 'field', name: 'Supported account types', act: 'Valitse, jos ei ole jo valittuna', value: `Single tenant only - ${ORG}`, copy: false, at: ['register', 'accounts']},
      {k: 'field', name: 'Redirect URI (optional)', act: 'Jätä tyhjäksi.', at: ['register', 'redirect']},
      {k: 'field', name: 'Register', act: 'Valitse sivun alareunasta.', at: ['register', 'register']},
      {k: 'node', node: <>
        {section !== 'microsoft' && <p className="si-effect" data-testid="m-level-app">{LEVEL_APP}</p>}
        <p className="m-quiet">{ORG} on organisaatiosi domain; kuvissa se on peitetty. Vain organisaation työtilit voivat yhdistää.</p>
      </>},
      {k: 'done', text: <>Entra avaa sovelluksen <em>{app}</em>: otsikkona sen nimi, vasemmalla sen oma valikko ja siinä Overview valittuna.</>},
      {k: 'node', node: <Role>{ROLE_DEV}</Role>},
    ]},
    {id: 'public', title: 'Julkinen asiakas', rows: [
      {k: 'field', name: AUTH, act: 'Valitse sovelluksen vasemmasta valikosta. Sivu aukeaa välilehdelle Redirect URI configuration.', at: ['auth', 'menu']},
      {k: 'where', crumbs: [AUTH, 'Redirect URI configuration']},
      {k: 'field', name: 'Add Redirect URI', act: 'Valitse, sitten Mobile and desktop applications.', at: ['auth', 'add']},
      {k: 'field', name: 'Redirect URIs', act: 'Rastita ehdotuksista tämä osoite ja valitse Configure.', value: REDIRECT},
      {k: 'where', crumbs: [AUTH, 'Settings']},
      {k: 'field', name: 'Settings', act: 'Valitse välilehti samalta sivulta.', at: ['auth', 'settings']},
      {k: 'field', name: 'Allow public client flows', act: 'Valitse Enabled ja Save. Henkilöt kirjautuvat laitekoodilla, joten client secretiä ei luoda.'},
      {k: 'done', text: <><em>Redirect URI configuration</em> -välilehdellä näkyy Mobile and desktop applications ja tämä osoite, ja <em>Settings</em>-välilehdellä Allow public client flows on Enabled.</>},
      {k: 'node', node: <Reopen app={app} />},
    ]},
    {id: 'permissions', title: 'Käyttöoikeudet', rows: [
      {k: 'field', name: 'API permissions', act: 'Valitse sovelluksen vasemmasta valikosta.', at: ['perms', 'menu']},
      {k: 'field', name: 'Add a permission', act: 'Valitse, sitten Microsoft Graph ja Delegated permissions.', at: ['perms', 'add']},
      {k: 'node', node: <>
        <p className="m-lead">Entran hakukenttä <em>Select permissions</em> löytää yhden oikeuden kerrallaan. Kopioi oikeus, liitä se hakuun ja valitse se Entrassa; valinnat säilyvät, kun haet seuraavaa.</p>
        <PermList section={section} />
      </>},
      {k: 'field', name: 'Add permissions', act: 'Valitse, kun kaikki on valittu.'},
      {k: 'done', text: <>ryhmärivillä lukee <em>Microsoft Graph ({PERMS[section].length})</em>. Kuvassa lukee vielä (1), koska valmiina on vain User.Read.</>, at: ['perms', 'graph']},
    ]},
    {id: 'consent', title: 'Hyväksyntä ja tunnukset', rows: [
      {k: 'field', name: `Grant admin consent for ${ORG}`, act: 'Valitse samalla sivulla Add a permissionin vierestä, sitten Yes.', at: ['perms', 'grant']},
      {k: 'done', text: <>Status-sarakkeessa lukee jokaisella rivillä <em>Granted for {ORG}</em>.</>},
      {k: 'node', node: <Role>{ROLE_ADMIN}</Role>},
      {k: 'field', name: 'Overview', act: 'Valitse vasemmasta valikosta. Kopioi kaksi tunnusta: vie osoitin arvon päälle, niin sen perään tulee kopiointinappi.', at: ['overview', 'menu']},
      {k: 'field', name: 'Application (client) ID', act: 'Liitä alle ensimmäiseen kenttään.', at: ['overview', 'client']},
      {k: 'field', name: 'Directory (tenant) ID', act: 'Liitä alle toiseen kenttään. Object ID niiden välissä on eri tunnus, sitä ei tarvita.', at: ['overview', 'tenant']},
      {k: 'node', node: <>
        <Fields ctx={ctx} />
        <p className="m-quiet">Salaisuutta ei tarvita.</p>
        <Handoff ctx={ctx} />
      </>},
    ]},
  ];
}

function enterOnly(): Step {
  return {id: 'enter', title: 'Tunnukset', rows: [
    {k: 'where', crumbs: ['App registrations', 'All applications'], link: true},
    {k: 'field', name: 'Hakukenttä', act: 'Kirjoita sovelluksen nimi ja valitse se listasta. Entra avaa sen Overview-sivun.', at: ['list', 'search']},
    {k: 'field', name: 'Application (client) ID', act: 'Liitä alle ensimmäiseen kenttään.', at: ['overview', 'client']},
    {k: 'field', name: 'Directory (tenant) ID', act: 'Liitä alle toiseen kenttään.', at: ['overview', 'tenant']},
  ]};
}

/* ---------- laying a step out, per riff ---------- */

function numbered(rows: Row[]): (Spot | null)[] {
  let n = 0;
  return rows.map(r => ('at' in r && r.at) ? {crop: r.at[0], t: r.at[1], n: ++n} : null);
}

function RowView({row, spot, direction, lit, onLight, tail}: {
  row: Row; spot: Spot | null; direction: number; lit?: boolean; onLight?: () => void; tail?: React.ReactNode;
}) {
  if (row.k === 'where') return <Where crumbs={row.crumbs} link={row.link} />;
  if (row.k === 'node') return <>{row.node}</>;
  const badge = spot && direction === A1A ? <b className="m-num" aria-label={`kohta ${spot.n} kuvassa`}>{spot.n}</b> : null;
  const show = spot && direction === A1B ? (
    <ControlButton data-testid="m-light" size="row" variant="quiet" aria-pressed={lit} aria-label={`Näytä kuvassa: ${row.k === 'field' ? row.name : 'valmis'}`} onPress={onLight}>
      <Icon name="eye" />
    </ControlButton>
  ) : null;
  const cut = spot && direction === A1C ? <Cut spot={spot} /> : null;
  if (row.k === 'done') {
    return (
      <div className="m-done" data-testid="m-done" data-lit={lit || undefined}>
        {badge}<Done>{row.text}</Done>{show}{cut && <span className="m-done-cut">{cut}</span>}
      </div>
    );
  }
  return (
    <div className="m-field" data-testid="m-field" data-lit={lit || undefined} data-has-spot={spot ? '' : undefined}>
      <span className="m-fname">{badge}{row.name}</span>
      <span className="m-act">{row.act}</span>
      {show && <span className="m-show">{show}</span>}
      {row.value && <span className="m-value"><code>{row.value}</code>{row.copy !== false && <Copy value={row.value} label={row.name} />}</span>}
      {cut && <span className="m-cutrow">{cut}</span>}
      {tail}
    </div>
  );
}

function StepBody({step, direction}: {step: Step; direction: number}) {
  const spots = numbered(step.rows);
  const lit = spots.filter(Boolean) as Spot[];
  const [on, setOn] = useState(0);
  const [whole, setWhole] = useState(false);
  const narrow = useNarrow();
  const rows = (
    <div className="m-rows">
      {step.rows.map((r, i) => {
        const s = spots[i];
        return <RowView key={i} row={r} spot={s} direction={direction}
          lit={direction === A1B && !!s && lit[on] === s} onLight={() => s && setOn(lit.indexOf(s))} />;
      })}
    </div>
  );
  const crops = [...new Set(lit.map(s => s.crop))];
  if (direction === A1A) {
    return (
      <div className="m-beside">
        <div className="m-beside-l">{rows}</div>
        <div className="m-beside-r" data-testid="m-side">
          {crops.map(c => <Shot key={c} crop={c} view={SIDE_VIEW[c]} marks={lit.filter(s => s.crop === c)} />)}
          <p className="m-shot-note">Jarin kuvakaappauksia Entrasta; tunnukset ja domain peitetty.</p>
        </div>
      </div>
    );
  }
  if (direction === A1B) {
    const s = lit[on];
    return (
      <>
        {s && (
          <div className="m-strip" data-testid="m-strip">
            <Shot crop={s.crop} view={bandOf(s, narrow)} mode="spot" active={s} />
            <div className="m-strip-foot">
              <span className="m-quiet">Kuvassa {on + 1}/{lit.length}: <strong>{rowName(step.rows[spots.indexOf(s)])}</strong></span>
              <span className="si-grow" />
              <ControlButton data-testid="m-strip-prev" size="row" variant="quiet" aria-label="Edellinen kohta kuvassa" isDisabled={on === 0} onPress={() => setOn(on - 1)}><Icon name="back" /></ControlButton>
              <ControlButton data-testid="m-strip-next" size="row" variant="quiet" aria-label="Seuraava kohta kuvassa" isDisabled={on >= lit.length - 1} onPress={() => setOn(on + 1)}><Icon name="forward" /></ControlButton>
            </div>
          </div>
        )}
        {rows}
      </>
    );
  }
  return (
    <>
      {rows}
      {crops.length > 0 && (
        <div className="m-whole">
          <ControlButton data-testid="m-whole" size="row" variant="secondary" aria-expanded={whole} onPress={() => setWhole(!whole)}>
            <Icon name="image" />{whole ? 'Piilota koko sivu' : `Näytä koko sivu (${crops.length === 1 ? '1 kuva' : `${crops.length} kuvaa`})`}
          </ControlButton>
          {whole && crops.map(c => <Shot key={c} crop={c} view={SIDE_VIEW[c]} marks={lit.filter(s => s.crop === c)} mode="outline" />)}
        </div>
      )}
    </>
  );
}
const rowName = (r: Row) => r.k === 'field' ? r.name : 'Valmis, kun';

/* ---------- the dialog shell (production dialog classes) ---------- */

function Wizard({direction, section, onSaved, onClose}: {direction: number; section: Section; onSaved: () => void; onClose: () => void}) {
  const app = LEVELS.find(l => l.id === section)!.app;
  const [at, setAt] = useState(0);
  const [skip, setSkip] = useState(false);
  const [values, setValues] = useState<AppFields>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const client = (values.client_id ?? '').trim(), tenant = (values.tenant_id ?? '').trim();
  const idsOk = guid.test(client) && guid.test(tenant) && client.toLowerCase() !== tenant.toLowerCase();
  const setField = (f: string, v: string) => { setValues(x => ({...x, [f]: v})); setErrors(x => ({...x, [f]: undefined})); };
  const ctx: Ctx = {direction, section, app, values, errors, setField, idsOk, client, tenant};
  const all = steps(ctx);
  const list = skip ? [enterOnly()] : all;
  const i = Math.min(at, list.length - 1);
  const step = list[i];
  const last = i === list.length - 1;
  const go = (n: number) => { setAt(n); setErrors({}); };
  const submit = () => {
    const e = appErrors(section, {client_id: client, tenant_id: tenant});
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setTimeout(() => { setSaving(false); onSaved(); }, 500);
  };
  const title = `Microsoft 365${section === 'microsoft' ? '' : ` (${LEVELS.find(l => l.id === section)!.label.toLowerCase()})`}: aseta tunnukset`;
  return (
    <ModalOverlay className="ah-overlay m-overlay" isOpen isDismissable={false} onOpenChange={o => !o && onClose()}>
      <Modal className={`ah-modal si-modal si-split m-modal m-d${direction}`}>
        <Dialog className="ah-dialog si-dialog m-dialog" data-testid="m-dialog" aria-label={title}>
          <Heading slot="title">{title}</Heading>
          {list.length > 1 && (
            <>
              <div className="si-progress" data-testid="m-progress" role="img" aria-label={`Vaihe ${i + 1}/${list.length}`}>
                {list.map((s, j) => <span key={s.id} data-done={j < i || undefined} data-current={j === i || undefined} />)}
              </div>
              <p className="si-stepname" data-testid="m-stepname" data-step={step.id}>
                <span className="si-muted">{i + 1}/{list.length}</span> {step.title}
              </p>
            </>
          )}
          <div className="si-stepbody m-stepbody" data-testid={`m-step-${step.id}`}>
            <StepBody key={`${step.id}-${skip}`} step={step} direction={direction} />
            {skip && <><Fields ctx={ctx} /><p className="m-quiet">Salaisuutta ei tarvita.</p><Handoff ctx={ctx} /></>}
          </div>
          <div className="si-foot">
            {i === 0 && !skip && (
              <ControlButton data-testid="m-skip" size="row" variant="quiet" onPress={() => { setSkip(true); setErrors({}); }}>Minulla on jo sovellus</ControlButton>
            )}
            <span className="si-grow" />
            {i > 0 || skip ? (
              <ControlButton data-testid="m-back" size="row" variant="secondary" isDisabled={saving}
                onPress={() => { if (skip) { setSkip(false); go(0); } else go(i - 1); }}>Takaisin</ControlButton>
            ) : (
              <ControlButton size="row" variant="secondary" onPress={onClose}>Peruuta</ControlButton>
            )}
            {last ? (
              <ControlButton data-testid="m-save" size="page" variant="primary" isDisabled={saving} onPress={submit}>
                {saving ? 'Tallennetaan…' : 'Tallenna'}
              </ControlButton>
            ) : (
              <ControlButton data-testid="m-next" size="page" variant="primary" onPress={() => go(i + 1)}>Seuraava</ControlButton>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
