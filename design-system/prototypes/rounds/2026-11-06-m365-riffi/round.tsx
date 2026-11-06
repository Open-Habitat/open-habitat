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
import {Checkbox, TextField} from '../../../../web/src/components/Primitives';
// The production wizard's dialog classes (si-*); the component itself is not used.
import '../../../../web/src/components/ServerIntegrations.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// Microsoft 365: aseta tunnukset, round 2 (proto-m365-setup-flow). Jari chose
// round 1's A Lista; these are three riffs on it. All keep A's readable rows
// (one Entra field per row, its value and copy) and its one-permission-at-a-
// time list. What Jari and Aino found on a real tenant, and his Entra
// screenshots, changed the instructions in all three: the console link lands
// on App registrations › All applications, so only the first step links and
// it says where to go from that list; after Register everything happens in
// the same app's view, so later steps name the app's left-menu item and the
// Authentication (Preview) tabs. The Entra pieces are redrawn from those
// screenshots, never copied: no tenant, client or object id, and the
// organisation is the placeholder domain esimerkki.fi. Synthetic throughout.
const directions = ['A1 Valikkopala', 'A2 Valikon järjestyksessä', 'A3 Olet nyt'];
const LINES = [
  'A1 Valikkopala: A:n neljä vaihetta, ja jokaisen vieressä pala Entran oikeaa sivua, jossa tehtävän valikkorivi tai välilehti on korostettu.',
  'A2 Valikon järjestyksessä: yksi jatkuva tarkistuslista, joka kulkee sovelluksen vasemman valikon kohdat ylhäältä alas; auki on yksi kohta kerrallaan.',
  'A3 Olet nyt: jokainen vaihe alkaa Entran sivun otsikosta ja siitä, mihin siirrytään; tunnukset liitetään heti rekisteröinnin jälkeen Overview-sivulta.',
];
const A1 = 0, A2 = 1, A3 = 2;

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
// The one link left: it opens App registrations › All applications whatever
// deeper blade it names (Jari and Aino, 2026-11-06), so it names that page.
const ENTRA_LIST = 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade';
// Entra shows the tenant by its domain ("Single tenant only - <domain>",
// "Grant admin consent for <domain>"); a placeholder stands in for Jari's.
const ORG = 'esimerkki.fi';
const MASK = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const consentV1 = (tenant: string, client: string) => `https://login.microsoftonline.com/${tenant}/adminconsent?client_id=${client}`;

// The app's left menu, in the order and words of Jari's screenshot.
const MENU: (string | {group: string})[] = [
  'Overview', 'Quickstart', 'Integration assistant', 'Diagnose and solve problems',
  {group: 'Manage'}, 'Branding & properties', 'Authentication (Preview)', 'Certificates & secrets', 'Token configuration',
  'API permissions', 'Expose an API', 'App roles', 'Owners', 'Roles and administrators', 'Manifest',
];
const AUTH = 'Authentication (Preview)';
const AUTH_TABS = ['Redirect URI configuration', 'Supported accounts', 'Settings'];

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
        <strong>Microsoft 365: aseta tunnukset · kierros 2</strong>
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

/* ---------- A's pieces, shared by all three ---------- */

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

/** One Entra field: its name, what to do there, and the value. */
function Field({name, act, value, copy = true}: {name: string; act: React.ReactNode; value?: string; copy?: boolean}) {
  return (
    <li className="m-field" data-testid="m-field">
      <span className="m-fname">{name}</span>
      <span className="m-act">{act}</span>
      {value && <span className="m-value"><code>{value}</code>{copy && <Copy value={value} label={name} />}</span>}
    </li>
  );
}
const Rows = ({children}: {children: React.ReactNode}) => <ol className="m-fields">{children}</ol>;
function Done({children}: {children: React.ReactNode}) {
  return <p className="m-done" data-testid="m-done"><Icon name="check" /><span><strong>Valmis, kun </strong>{children}</span></p>;
}
const Role = ({children}: {children: React.ReactNode}) => <p className="m-quiet m-role" data-testid="m-role"><Icon name="user" /><span>{children}</span></p>;
const ROLE_DEV = 'Vaatii vähintään roolin Application Developer.';
const ROLE_ADMIN = 'Vaatii roolin Cloud Application Administrator, Application Administrator tai Privileged Role Administrator.';
const LEVEL_APP = 'Oma sovellus tälle tasolle: Microsoft antaa sovelluksen tunnukselle kaikki sovellukselle hyväksytyt oikeudet, joten taso on raja vain omana sovelluksenaan.';
/** How to get back into the app from the list the link opens. */
const Reopen = ({app}: {app: string}) => (
  <p className="m-quiet" data-testid="m-reopen">Jos sivu ehti sulkeutua: <em>App registrations</em> › <em>All applications</em>, kirjoita <em>{app}</em> hakukenttään ja valitse täsmälleen tämä nimi.</p>
);

/** The permissions as Entra's picker takes them: one name at a time. */
function PermList({section, ticks, setTicks}: {section: Section; ticks: Set<string>; setTicks: (t: Set<string>) => void}) {
  const list = PERMS[section].filter(p => p !== 'User.Read');
  return (
    <>
      <ol className="m-perms" data-testid="m-perms">
        {list.map(p => (
          <li key={p} className="m-perm" data-ticked={ticks.has(p) || undefined}>
            <Checkbox data-testid={`m-tick-${p}`} label={p} checked={ticks.has(p)}
              onChange={v => { const n = new Set(ticks); v ? n.add(p) : n.delete(p); setTicks(n); }} />
            <span className="m-says">{SAYS[p]}</span>
            <Copy value={p} label={p} />
          </li>
        ))}
      </ol>
      <p className="m-count" data-testid="m-count">{ticks.size}/{list.length} rastitettu Entrassa · User.Read on siellä valmiina</p>
    </>
  );
}

/* The step contents in Entra's real order. Each takes the opening it needs:
   A1 and A2 a menu path, A3 its own "Olet nyt" heading instead. */

function registerRows(ctx: Ctx) {
  return (
    <>
      <Rows>
        <Field name="New registration" act="Valitse listan yläpuolelta." />
        <Field name="Name" act="Kirjoita" value={ctx.app} />
        <Field name="Supported account types" act="Valitse, jos ei ole jo valittuna" value={`Single tenant only - ${ORG}`} copy={false} />
        <Field name="Redirect URI (optional)" act="Jätä tyhjäksi." />
        <Field name="Register" act="Valitse sivun alareunasta." />
      </Rows>
      {ctx.section !== 'microsoft' && <p className="si-effect" data-testid="m-level-app">{LEVEL_APP}</p>}
      <p className="m-quiet">Vain organisaation työtilit voivat yhdistää; henkilökohtaiset Microsoft-tilit eivät.</p>
      <Done>Entra avaa sovelluksen <em>{ctx.app}</em>: otsikkona sen nimi, vasemmalla sen oma valikko ja siinä Overview valittuna.</Done>
      <Role>{ROLE_DEV}</Role>
    </>
  );
}
function redirectRows() {
  return (
    <Rows>
      <Field name="Add Redirect URI" act="Valitse, sitten Mobile and desktop applications." />
      <Field name="Redirect URIs" act="Rastita ehdotuksista tämä osoite ja valitse Configure." value={REDIRECT} />
    </Rows>
  );
}
function settingsRows() {
  return (
    <Rows>
      <Field name="Allow public client flows" act="Valitse Enabled ja Save. Henkilöt kirjautuvat laitekoodilla, joten client secretiä ei luoda." />
    </Rows>
  );
}
const authDone = <Done><em>Redirect URI configuration</em> -välilehdellä näkyy Mobile and desktop applications ja tämä osoite, ja <em>Settings</em>-välilehdellä Allow public client flows on Enabled.</Done>;
function permRows(ctx: Ctx) {
  return (
    <>
      <Rows><Field name="Add a permission" act="Valitse, sitten Microsoft Graph ja Delegated permissions." /></Rows>
      <p className="m-lead">Entran hakukenttä <em>Select permissions</em> löytää yhden oikeuden kerrallaan. Kopioi oikeus, liitä se hakuun ja rastita se Entrassa. Rastit säilyvät, kun haet seuraavaa.</p>
      <PermList section={ctx.section} ticks={ctx.ticks} setTicks={ctx.setTicks} />
      <Rows><Field name="Add permissions" act="Valitse, kun kaikki on rastitettu." /></Rows>
      <Done>Configured permissions -kohdassa lukee <em>Microsoft Graph ({PERMS[ctx.section].length})</em>.</Done>
    </>
  );
}
function consentRows() {
  return (
    <>
      <Rows>
        <Field name={`Grant admin consent for ${ORG}`} act="Valitse samalla sivulla Add a permissionin vierestä, sitten Yes." />
      </Rows>
      <p className="m-quiet">Henkilöiltä ei kysytä hyväksyntää.</p>
      <Done>Status-sarakkeessa lukee jokaisella rivillä <em>Granted for {ORG}</em>.</Done>
      <Role>{ROLE_ADMIN}</Role>
    </>
  );
}
const idsLead = <p className="m-lead">Vie osoitin arvon päälle; sen perään tulee Entran kopiointinappi. Object ID on eri tunnus, sitä ei tarvita.</p>;

/* ---------- Entra fragments (A1, A3), redrawn from Jari's screenshots ---------- */

/** A crop of the app's left menu around one item, with the page title. */
function MenuCrop({app, on, tabs, tab, tool, caption}: {app: string; on: string; tabs?: string[]; tab?: string; tool?: string[]; caption?: string}) {
  const at = MENU.findIndex(m => m === on);
  const from = Math.max(0, at - 2), to = Math.min(MENU.length, at + 3);
  return (
    <figure className="m-frag" data-testid="m-frag" aria-label={`Entrassa: ${app}, vasen valikko, ${on}`}>
      <p className="m-frag-crumbs">Home › App registrations{on === 'Overview' ? '' : ` › ${app}`}</p>
      <p className="m-frag-title">{app}{on === 'Overview' ? '' : <span> | {on}</span>}</p>
      <div className="m-frag-body">
        <ul className="m-frag-menu" data-cut-top={from > 0 || undefined} data-cut-bottom={to < MENU.length || undefined}>
          {MENU.slice(from, to).map((m, i) => typeof m === 'string'
            ? <li key={i} data-on={m === on || undefined}><i aria-hidden="true" />{m}</li>
            : <li key={i} className="m-frag-group">{m.group}</li>)}
        </ul>
        {(tabs || tool) && (
          <div className="m-frag-main">
            {tool && <p className="m-frag-tool">{tool.map((t, i) => <span key={t} data-on={i === 0 || undefined}>{t}</span>)}</p>}
            {tabs && <p className="m-frag-tabs">{tabs.map(t => <span key={t} data-on={t === tab || undefined}>{t}</span>)}</p>}
          </div>
        )}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
/** The page the link opens: App registrations with All applications. */
function ListCrop({app}: {app: string}) {
  return (
    <figure className="m-frag" data-testid="m-frag" aria-label="Entrassa: App registrations">
      <p className="m-frag-crumbs">Home</p>
      <p className="m-frag-title">App registrations</p>
      <p className="m-frag-tool"><span data-on="">+ New registration</span><span>Endpoints</span><span>Troubleshoot</span></p>
      <p className="m-frag-tabs"><span data-on="">All applications</span><span>Owned applications</span><span>Deleted applications</span></p>
      <p className="m-frag-search">Start typing a display name or application (client) ID…</p>
      <ul className="m-frag-apps" aria-hidden="true"><li><b>OH</b>{app}</li><li><b>··</b>…</li></ul>
      <figcaption>Linkin avaama sivu. Muiden sovellusten nimet peitetty.</figcaption>
    </figure>
  );
}
/** Overview's Essentials with the ids masked. */
function EssentialsCrop({app}: {app: string}) {
  return (
    <figure className="m-frag" data-testid="m-frag" aria-label="Entrassa: Overview, Essentials">
      <p className="m-frag-title">{app}</p>
      <dl className="m-frag-ess">
        <dt>Display name</dt><dd className="m-frag-link">{app}</dd>
        <dt data-on="">Application (client) ID</dt><dd data-on=""><code>{MASK}</code></dd>
        <dt>Object ID</dt><dd className="m-frag-dim"><code>{MASK}</code></dd>
        <dt data-on="">Directory (tenant) ID</dt><dd data-on=""><code>{MASK}</code></dd>
        <dt>Supported account types</dt><dd className="m-frag-link">My organization only</dd>
      </dl>
      <figcaption>Tunnukset peitetty.</figcaption>
    </figure>
  );
}
function Beside({frag, children}: {frag: React.ReactNode; children: React.ReactNode}) {
  return <div className="m-beside"><div className="m-beside-l">{children}</div><div className="m-beside-r">{frag}</div></div>;
}

/* ---------- the dialog shell (production dialog classes) ---------- */

type Step = {id: string; title: string; body: React.ReactNode; size?: 'wide' | 'split'};
type Ctx = {
  direction: number; section: Section; app: string; ticks: Set<string>; setTicks: (t: Set<string>) => void;
  values: AppFields; errors: Partial<Record<string, string>>; setField: (f: string, v: string) => void;
  idsOk: boolean; client: string; tenant: string;
  open: number; setOpen: (n: number) => void; done: Set<number>; setDone: (d: Set<number>) => void;
};

function Wizard({direction, section, onSaved, onClose}: {direction: number; section: Section; onSaved: () => void; onClose: () => void}) {
  const app = LEVELS.find(l => l.id === section)!.app;
  const [at, setAt] = useState(0);
  const [skip, setSkip] = useState(false);
  const [values, setValues] = useState<AppFields>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const client = (values.client_id ?? '').trim(), tenant = (values.tenant_id ?? '').trim();
  const idsOk = guid.test(client) && guid.test(tenant) && client.toLowerCase() !== tenant.toLowerCase();
  const setField = (f: string, v: string) => { setValues(x => ({...x, [f]: v})); setErrors(x => ({...x, [f]: undefined})); };
  const ctx: Ctx = {direction, section, app, ticks, setTicks, values, errors, setField, idsOk, client, tenant, open, setOpen, done, setDone};
  const all = direction === A1 ? stepsA1(ctx) : direction === A2 ? stepsA2(ctx) : stepsA3(ctx);
  const steps = skip ? [enterOnly(ctx)] : all;
  const i = Math.min(at, steps.length - 1);
  const step = steps[i];
  const last = i === steps.length - 1;
  const go = (n: number) => { setAt(n); setErrors({}); };
  const submit = () => {
    const e = appErrors(section, {client_id: client, tenant_id: tenant});
    setErrors(e);
    if (Object.keys(e).length) { if (direction === A2 && !skip) setOpen(1); return; }
    setSaving(true);
    setTimeout(() => { setSaving(false); onSaved(); }, 500);
  };
  const title = `Microsoft 365${section === 'microsoft' ? '' : ` (${LEVELS.find(l => l.id === section)!.label.toLowerCase()})`}: aseta tunnukset`;
  return (
    <ModalOverlay className="ah-overlay m-overlay" isOpen isDismissable={false} onOpenChange={o => !o && onClose()}>
      <Modal className={`ah-modal si-modal si-${step.size ?? 'wide'} m-modal m-d${direction}`}>
        <Dialog className="ah-dialog si-dialog m-dialog" data-testid="m-dialog" aria-label={title}>
          <Heading slot="title">{title}</Heading>
          {steps.length > 1 && (
            <>
              <div className="si-progress" data-testid="m-progress" role="img" aria-label={`Vaihe ${i + 1}/${steps.length}`}>
                {steps.map((s, j) => <span key={s.id} data-done={j < i || undefined} data-current={j === i || undefined} />)}
              </div>
              <p className="si-stepname" data-testid="m-stepname" data-step={step.id}>
                <span className="si-muted">{i + 1}/{steps.length}</span> {step.title}
              </p>
            </>
          )}
          <div className="si-stepbody m-stepbody" data-testid={`m-step-${step.id}`}>{step.body}</div>
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

function Fields({ctx}: {ctx: Ctx}) {
  return (
    <div className="si-fields">
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
      <span className="m-quiet">Jos rooli puuttuu, lähetä linkki sille, jolla se on.{url ? '' : ' Linkki täyttyy, kun tunnukset on liitetty.'}</span>
      {url && <div className="si-block"><pre className="si-cmd">{url}</pre><Copy value={url} label="hyväksyntälinkki" /></div>}
    </div>
  );
}

function enterOnly(ctx: Ctx): Step {
  return {
    id: 'enter', title: 'Tunnukset', body: (
      <>
        {ctx.direction === A3
          ? <Here now="App registrations" crumbs="Home" note="Linkki avaa tämän sivun." go={<>Kirjoita <em>{ctx.app}</em> hakukenttään ja valitse nimi. Entra avaa sovelluksen Overview-sivun.</>} link />
          : <>
            <Where crumbs={['App registrations', 'All applications']} link />
            <Rows><Field name="Hakukenttä" act={<>Kirjoita sovelluksen nimi ja valitse se listasta. Entra avaa sen Overview-sivun.</>} /></Rows>
          </>}
        {ctx.direction === A3 ? <Pairs ctx={ctx} /> : <>{idsLead}<Fields ctx={ctx} /></>}
        <p className="m-quiet">Salaisuutta ei tarvita.</p>
        <Handoff ctx={ctx} />
      </>
    ),
  };
}

/* ---------- A1: a piece of the real page beside each step ---------- */

function stepsA1(ctx: Ctx): Step[] {
  const {app} = ctx;
  return [
    {
      id: 'register', title: 'Rekisteröi sovellus', size: 'split', body: (
        <Beside frag={<ListCrop app={app} />}>
          <Where crumbs={['App registrations', 'All applications']} link />
          {registerRows(ctx)}
        </Beside>
      ),
    },
    {
      id: 'public', title: 'Julkinen asiakas', size: 'split', body: (
        <Beside frag={<MenuCrop app={app} on={AUTH} tabs={AUTH_TABS} tab="Redirect URI configuration" caption="Sovelluksen vasen valikko. Välilehdet ovat sivun yläosassa." />}>
          <p className="m-lead">Valitse sovelluksen vasemmasta valikosta <strong>{AUTH}</strong>. Se aukeaa välilehdelle Redirect URI configuration.</p>
          <Where crumbs={[AUTH, 'Redirect URI configuration']} />
          {redirectRows()}
          <Where crumbs={[AUTH, 'Settings']} />
          {settingsRows()}
          {authDone}
          <Reopen app={app} />
        </Beside>
      ),
    },
    {
      id: 'permissions', title: 'Käyttöoikeudet', size: 'split', body: (
        <Beside frag={<MenuCrop app={app} on="API permissions" tool={['+ Add a permission', `Grant admin consent for ${ORG}`]} caption="Valmiina on User.Read." />}>
          <p className="m-lead">Valitse sovelluksen vasemmasta valikosta <strong>API permissions</strong>.</p>
          {permRows(ctx)}
        </Beside>
      ),
    },
    {
      id: 'consent', title: 'Hyväksyntä ja tunnukset', size: 'split', body: (
        <div className="si-cols">
          <div className="si-col">
            <p className="si-side">Microsoft Entrassa</p>
            <MenuCrop app={app} on="API permissions" tool={[`Grant admin consent for ${ORG}`, '+ Add a permission']} />
            <Where crumbs={['API permissions', `Grant admin consent for ${ORG}`]} />
            {consentRows()}
          </div>
          <div className="si-col si-get">
            <p className="si-side">Tähän</p>
            <EssentialsCrop app={app} />
            <Where crumbs={['Overview', 'Essentials']} />
            {idsLead}
            <Fields ctx={ctx} />
            <p className="m-quiet">Salaisuutta ei tarvita.</p>
            <Handoff ctx={ctx} />
          </div>
        </div>
      ),
    },
  ];
}

/* ---------- A2: one checklist down the app's menu ---------- */

type Item = {id: string; menu: string[]; sum: string; body: React.ReactNode};

function stepsA2(ctx: Ctx): Step[] {
  const {app} = ctx;
  const items: Item[] = [
    {id: 'register', menu: ['App registrations', 'New registration'], sum: `Nimeksi ${app}, sitten Register`, body: (
      <>
        <p className="m-open"><ExternalLink href={ENTRA_LIST} target="_blank" rel="noreferrer" data-testid="m-console-link">Avaa App registrations <Icon name="external" /></ExternalLink><span className="m-quiet">Linkki avaa listan All applications.</span></p>
        {registerRows(ctx)}
      </>
    )},
    {id: 'overview', menu: ['Overview'], sum: 'Kaksi tunnusta tähän', body: (
      <>
        <p className="m-quiet">Entra avasi tämän sivun rekisteröinnin jälkeen.</p>
        {idsLead}
        <Fields ctx={ctx} />
        <p className="m-quiet">Salaisuutta ei tarvita.</p>
      </>
    )},
    {id: 'redirect', menu: [AUTH, 'Redirect URI configuration'], sum: 'nativeclient-osoite', body: redirectRows()},
    {id: 'settings', menu: [AUTH, 'Settings'], sum: 'Allow public client flows: Enabled', body: (
      <>{settingsRows()}{authDone}</>
    )},
    {id: 'permissions', menu: ['API permissions', 'Add a permission'], sum: `${PERMS[ctx.section].length - 1} oikeutta yksi kerrallaan`, body: permRows(ctx)},
    {id: 'consent', menu: ['API permissions', `Grant admin consent for ${ORG}`], sum: 'Yes', body: (
      <>{consentRows()}<Handoff ctx={ctx} /></>
    )},
  ];
  const finish = (k: number) => {
    const d = new Set(ctx.done); d.add(k); ctx.setDone(d);
    const next = items.findIndex((_, j) => j > k && !d.has(j));
    ctx.setOpen(next < 0 ? -1 : next);
  };
  const row = (it: Item, k: number) => {
    const isOpen = ctx.open === k, isDone = ctx.done.has(k);
    return (
      <li key={it.id} className="m-item" data-testid={`m-item-${it.id}`} data-open={isOpen || undefined} data-done={isDone || undefined}>
        <button type="button" className="m-item-head" aria-expanded={isOpen} data-testid={`m-item-head-${it.id}`} onClick={() => ctx.setOpen(isOpen ? -1 : k)}>
          <span className="m-item-mark" aria-hidden="true">{isDone ? <Icon name="check" /> : k + 1}</span>
          <span className="m-path m-item-path">
            {it.menu.map((c, i) => <Fragment key={i}>{i > 0 && <span className="m-sep" aria-hidden="true">›</span>}<span className="m-crumb">{c}</span></Fragment>)}
          </span>
          {!isOpen && <span className="m-item-sum">{isDone ? 'Tehty' : it.sum}</span>}
        </button>
        {isOpen && (
          <div className="m-item-body">
            {it.body}
            <ControlButton data-testid={`m-item-done-${it.id}`} size="row" variant="secondary" onPress={() => finish(k)}>
              {k === items.length - 1 ? 'Tehty' : 'Tehty, seuraava kohta'}
            </ControlButton>
          </div>
        )}
      </li>
    );
  };
  return [{
    id: 'list', title: 'Tarkistuslista', body: (
      <>
        <p className="m-lead">Tee kohdat ylhäältä alas. Rekisteröinnin jälkeen kaikki tapahtuu sovelluksen <em>{app}</em> sivulla: kohdat ovat sen vasemman valikon järjestyksessä.</p>
        <ol className="m-items" data-testid="m-items">
          {row(items[0], 0)}
          <li className="m-items-group" aria-hidden="true">Sovelluksen {app} vasen valikko</li>
          {items.slice(1).map((it, j) => row(it, j + 1))}
        </ol>
        <p className="m-count" data-testid="m-items-count">{ctx.done.size}/{items.length} tehty · rastit eivät tallennu</p>
        <Reopen app={app} />
      </>
    ),
  }];
}

/* ---------- A3: where you are now, ids straight from Overview ---------- */

/** The Entra page the administrator should be looking at, in its own heading. */
function Here({now, crumbs, menu, note, go, link}: {now: string; crumbs: string; menu?: string; note?: React.ReactNode; go?: React.ReactNode; link?: boolean}) {
  return (
    <div className="m-here" data-testid="m-here">
      <p className="m-here-label">Olet nyt Entrassa</p>
      <p className="m-here-crumbs">{crumbs}</p>
      <p className="m-here-title">{now}</p>
      {menu && <p className="m-here-menu">Vasemmassa valikossa valittuna <strong>{menu}</strong></p>}
      {note && <p className="m-quiet">{note}</p>}
      {link && <p className="m-open"><ExternalLink href={ENTRA_LIST} target="_blank" rel="noreferrer" data-testid="m-console-link">Avaa App registrations <Icon name="external" /></ExternalLink></p>}
      {go && <p className="m-here-go"><Icon name="forward" /><span>{go}</span></p>}
    </div>
  );
}

/** Overview's two ids, each beside the field it goes into. */
function Pairs({ctx}: {ctx: Ctx}) {
  const pair = (f: 'client_id' | 'tenant_id', label: string) => {
    const v = (ctx.values[f] ?? '').trim();
    const other = (ctx.values[f === 'client_id' ? 'tenant_id' : 'client_id'] ?? '').trim();
    const state = !v ? null : !guid.test(v) ? 'Ei näytä tunnukselta: kopioi koko arvo.' : other && other.toLowerCase() === v.toLowerCase() ? 'Sama kuin toinen tunnus.' : 'Muoto kunnossa.';
    return (
      <div className="m-pair" data-testid={`m-pair-${f}`}>
        <div className="m-pair-entra" aria-hidden="true">
          <span className="m-pair-label">{label}</span>
          <code>{MASK}</code>
        </div>
        <Icon name="forward" />
        <div className="m-pair-field">
          <TextField data-testid={`m-field-${f}`} label={label} mono value={ctx.values[f] ?? ''} onChange={x => ctx.setField(f, x)} error={ctx.errors[f]} />
          {state && !ctx.errors[f] && <p className="m-pair-state" data-ok={state === 'Muoto kunnossa.' || undefined}>{state === 'Muoto kunnossa.' && <Icon name="check" />}{state}</p>}
        </div>
      </div>
    );
  };
  return (
    <div className="m-pairs" data-testid="m-pairs">
      <p className="m-pairs-head" aria-hidden="true"><span>Entran Essentials</span><span>Tähän</span></p>
      {pair('client_id', 'Application (client) ID')}
      <div className="m-pair m-pair-skip" aria-hidden="true">
        <div className="m-pair-entra"><span className="m-pair-label">Object ID</span><code>{MASK}</code></div>
        <span />
        <p className="m-quiet">Ei tarvita.</p>
      </div>
      {pair('tenant_id', 'Directory (tenant) ID')}
    </div>
  );
}

function stepsA3(ctx: Ctx): Step[] {
  const {app} = ctx;
  return [
    {
      id: 'register', title: 'Rekisteröi sovellus', body: (
        <>
          <Here now="App registrations" crumbs="Home" note="Linkki avaa tämän sivun ja sen listan All applications." link
            go={<>Valitse listan yläpuolelta <strong>New registration</strong>. Otsikoksi vaihtuu Register an application.</>} />
          {registerRows(ctx)}
        </>
      ),
    },
    {
      id: 'ids', title: 'Tunnukset', body: (
        <>
          <Here now={app} crumbs="Home › App registrations" menu="Overview" note="Entra avasi tämän sivun itse rekisteröinnin jälkeen." />
          {idsLead}
          <Pairs ctx={ctx} />
          <p className="m-quiet">Salaisuutta ei tarvita. Tallennus tapahtuu viimeisessä vaiheessa.</p>
          <Reopen app={app} />
        </>
      ),
    },
    {
      id: 'public', title: 'Julkinen asiakas', body: (
        <>
          <Here now={app} crumbs="Home › App registrations" menu="Overview"
            go={<>Valitse vasemmasta valikosta <strong>{AUTH}</strong>. Otsikoksi vaihtuu <em>{app} | {AUTH}</em>, ja auki on välilehti Redirect URI configuration.</>} />
          <Where crumbs={['Redirect URI configuration']} />
          {redirectRows()}
          <Where crumbs={['Settings']} />
          {settingsRows()}
          {authDone}
        </>
      ),
    },
    {
      id: 'permissions', title: 'Käyttöoikeudet', body: (
        <>
          <Here now={`${app} | ${AUTH}`} crumbs={`Home › App registrations › ${app}`} menu={AUTH}
            go={<>Valitse vasemmasta valikosta <strong>API permissions</strong>. Otsikoksi vaihtuu <em>{app} | API permissions</em>.</>} />
          {permRows(ctx)}
        </>
      ),
    },
    {
      id: 'consent', title: 'Hyväksyntä', body: (
        <>
          <Here now={`${app} | API permissions`} crumbs={`Home › App registrations › ${app}`} menu="API permissions" note="Pysy tällä sivulla." />
          {consentRows()}
          <Handoff ctx={ctx} />
          {!ctx.idsOk && <p className="m-quiet" data-testid="m-ids-missing">Tunnukset puuttuvat vielä: ne liitetään vaiheessa 2.</p>}
        </>
      ),
    },
  ];
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
