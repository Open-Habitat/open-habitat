import React, {Fragment, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {appErrors, type AppChange, type AppFields} from '../../../../web/src/app/serverIntegrations';
import {ControlButton, ExternalLink} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Checkbox, TextField} from '../../../../web/src/components/Primitives';
import {AppSetupDialog} from '../../../../web/src/components/ServerIntegrations';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// Microsoft 365: aseta tunnukset (proto-m365-setup-flow, absorbing
// setup-console-path-too-small and ms-permissions-copy-one-by-one).
// Nyt is the production AppSetupDialog as it ships. The directions keep the
// production dialog shell, primitives and values (the permission lists and
// redirect are copies of ServerIntegrations.tsx, which mirrors
// internal/daemon/integrations/microsoft_linux.go) and change how the Entra
// work is told. Entra's own words stay in English, as in production. All of
// it is synthetic: nothing leaves the page, copies go to the clipboard only.
const directions = ['Nyt', 'A Lista', 'B Rinnakkain', 'C Kolme'];
const LINES = [
  'Nyt: tuotannon neljä vaihetta; polut pienellä ja himmeinä, oikeudet yhtenä listana yhdellä kopiolla.',
  'A Lista: samat neljä vaihetta luettavana listana; polku leipätekstinä, jokainen Entran kenttä omana rivinään, oikeudet yksitellen rasteineen ja joka vaiheessa "Valmis, kun".',
  'B Rinnakkain: jokaisen ohjeen vieressä pienoiskuva Entran sivusta, ja arvo kopiointeineen on siinä kentässä, johon se kuuluu.',
  'C Kolme: oikeusvaihe pois; tunnukset ensin, sitten hyväksyntälinkki, joka antaa oikeudet sovellukselle kerralla.',
];
const NOW = 0, A = 1, B = 2, C = 3;

type Section = 'microsoft' | 'microsoft_drafts' | 'microsoft_read';
const LEVELS: {id: Section; label: string; app: string}[] = [
  {id: 'microsoft', label: 'Täysi pääsy', app: 'Open Habitat'},
  {id: 'microsoft_drafts', label: 'Luonnokset', app: 'Open Habitat – luonnokset'},
  {id: 'microsoft_read', label: 'Vain luku', app: 'Open Habitat – vain luku'},
];
const IDENTITY = ['openid', 'profile', 'User.Read', 'offline_access'];
const PERMS: Record<Section, string[]> = {
  microsoft: [...IDENTITY, 'Files.ReadWrite.All', 'Sites.ReadWrite.All', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite', 'Contacts.ReadWrite'],
  microsoft_drafts: [...IDENTITY, 'Files.Read.All', 'Sites.Read.All', 'Mail.ReadWrite', 'Calendars.Read', 'Contacts.Read'],
  microsoft_read: [...IDENTITY, 'Files.Read.All', 'Sites.Read.All', 'Mail.Read', 'Calendars.Read', 'Contacts.Read'],
};
// What Microsoft's consent page and the Delegated permissions picker show
// beside each name (Graph's admin consent descriptions).
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
const ENTRA_LIST = 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade';
const ENTRA_NEW = 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade/quickStartType~/null/isMSAApp~/false';
const ORG = 'Esimerkki Oy';
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The daemon's own consent link (microsoftConsent in microsoft_linux.go):
// v2.0 with the level's permissions named, so it grants them whether or not
// the registration lists them. Production's wizard links the v1 form, which
// grants only what API permissions lists.
const consentV2 = (section: Section, tenant: string, client: string) => {
  const named = PERMS[section].filter(p => !['openid', 'profile', 'offline_access'].includes(p));
  return `https://login.microsoftonline.com/${tenant}/v2.0/adminconsent?${new URLSearchParams({client_id: client, scope: `openid profile offline_access ${named.join(' ')}`, redirect_uri: REDIRECT})}`;
};
const consentV1 = (tenant: string, client: string) => `https://login.microsoftonline.com/${tenant}/adminconsent?client_id=${client}`;

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
  const done = () => { setOpen(false); setSaved(true); };
  const close = () => setOpen(false);
  const props = {section, onSaved: done, onClose: close};
  let dialog: React.ReactNode = null;
  if (open) {
    if (direction === NOW)
      dialog = <AppSetupDialog key={run} provider={section} onClose={close}
        onSave={() => new Promise<AppChange>(r => setTimeout(() => { done(); r({kind: 'changed', view: {} as any}); }, 500))} />;
    else dialog = <Wizard key={run} direction={direction} {...props} />;
  }
  return (
    <div className={`m-review variant-${direction}`} data-direction={direction} data-section={section}>
      <header className="m-bar" ref={bar} data-react-aria-top-layer="true">
        <strong>Microsoft 365: aseta tunnukset</strong>
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
      {dialog}
    </div>
  );
}

/* ---------- shared pieces ---------- */

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

/** Where in Entra, in Entra's words at reading size, and the page link. */
function Where({crumbs, href, pick}: {crumbs: string[]; href?: string; pick?: React.ReactNode}) {
  return (
    <div className="m-where" data-testid="m-where">
      <p className="m-path">
        {crumbs.map((c, i) => <Fragment key={i}>{i > 0 && <span className="m-sep" aria-hidden="true">›</span>}<span className="m-crumb">{c}</span></Fragment>)}
      </p>
      {href && (
        <p className="m-open">
          <ExternalLink href={href} target="_blank" rel="noreferrer" data-testid="m-console-link">Avaa sivu <Icon name="external" /></ExternalLink>
          {pick && <span className="m-quiet">{pick}</span>}
        </p>
      )}
    </div>
  );
}
const pickApp = (app: string) => <>Valitse sovellus <em>{app}</em>.</>;

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
function Done({children}: {children: React.ReactNode}) {
  return <p className="m-done" data-testid="m-done"><Icon name="check" /><span><strong>Valmis, kun </strong>{children}</span></p>;
}
const Role = ({children}: {children: React.ReactNode}) => <p className="m-quiet m-role" data-testid="m-role"><Icon name="user" /><span>{children}</span></p>;
const ROLE_DEV = 'Vaatii vähintään roolin Application Developer.';
const ROLE_ADMIN = 'Vaatii roolin Cloud Application Administrator, Application Administrator tai Privileged Role Administrator.';
const LEVEL_APP = 'Oma sovellus tälle tasolle: Microsoft antaa sovelluksen tunnukselle kaikki sovellukselle hyväksytyt oikeudet, joten taso on raja vain omana sovelluksenaan.';

/** The permissions as Entra's picker takes them: one name at a time. */
function PermList({section, ticks, setTicks, current, onPick}: {
  section: Section; ticks: Set<string>; setTicks: (t: Set<string>) => void; current?: string; onPick?: (p: string) => void;
}) {
  const list = PERMS[section].filter(p => p !== 'User.Read');
  return (
    <>
      <ol className="m-perms" data-testid="m-perms">
        {list.map(p => (
          <li key={p} className="m-perm" data-ticked={ticks.has(p) || undefined} data-current={current === p || undefined}
            onClick={onPick ? () => onPick(p) : undefined}>
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

/* ---------- the wizard shell (production dialog classes) ---------- */

type Step = {id: string; title: string; body: React.ReactNode; size?: 'wide' | 'split'};

function Wizard({direction, section, onSaved, onClose}: {direction: number; section: Section; onSaved: () => void; onClose: () => void}) {
  const app = LEVELS.find(l => l.id === section)!.app;
  const [at, setAt] = useState(0);
  const [skip, setSkip] = useState(false);
  const [values, setValues] = useState<AppFields>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  const [sub, setSub] = useState(0);
  const [consented, setConsented] = useState(false);
  const client = (values.client_id ?? '').trim(), tenant = (values.tenant_id ?? '').trim();
  const idsOk = guid.test(client) && guid.test(tenant) && client.toLowerCase() !== tenant.toLowerCase();
  const fields = <Fields values={values} errors={errors} onChange={(f, v) => { setValues(x => ({...x, [f]: v})); setErrors(x => ({...x, [f]: undefined})); }} />;
  const ctx: Ctx = {section, app, ticks, setTicks, sub, setSub, fields, idsOk, client, tenant, consented, setConsented};
  const all = direction === A ? stepsA(ctx) : direction === B ? stepsB(ctx) : stepsC(ctx);
  const steps = skip ? [enterOnly(ctx, direction)] : all;
  const i = Math.min(at, steps.length - 1);
  const step = steps[i];
  const last = i === steps.length - 1;
  const go = (n: number) => { setAt(n); setSub(0); setErrors({}); };
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

type Ctx = {
  section: Section; app: string; ticks: Set<string>; setTicks: (t: Set<string>) => void;
  sub: number; setSub: (n: number) => void; fields: React.ReactNode; idsOk: boolean;
  client: string; tenant: string; consented: boolean; setConsented: (v: boolean) => void;
};

function Fields({values, errors, onChange}: {values: AppFields; errors: Partial<Record<string, string>>; onChange: (f: string, v: string) => void}) {
  return (
    <div className="si-fields">
      <TextField data-testid="m-field-client_id" label="Application (client) ID" mono value={values.client_id ?? ''} onChange={v => onChange('client_id', v)} error={errors.client_id} />
      <TextField data-testid="m-field-tenant_id" label="Directory (tenant) ID" mono value={values.tenant_id ?? ''} onChange={v => onChange('tenant_id', v)} error={errors.tenant_id} />
    </div>
  );
}

/** Production's consent hand-off, the v1 link filled from the typed ids. */
function Handoff({ctx, v2 = false}: {ctx: Ctx; v2?: boolean}) {
  const url = ctx.idsOk ? (v2 ? consentV2(ctx.section, ctx.tenant, ctx.client) : consentV1(ctx.tenant, ctx.client)) : null;
  return (
    <div className="si-handoff" data-testid="m-handoff" data-filled={url ? '' : undefined}>
      <span className="m-quiet">Jos rooli puuttuu, lähetä linkki sille, jolla se on.{url ? '' : ' Linkki täyttyy, kun arvot on liitetty.'}</span>
      {url && (v2
        // The v2 link names every permission and runs to six lines; C copies it without showing it.
        ? <span className="m-linkcopy" data-testid="m-link-copy"><Copy value={url} label="hyväksyntälinkki" /><span>Kopioi hyväksyntälinkki</span><pre hidden>{url}</pre></span>
        : <div className="si-block"><pre className="si-cmd">{url}</pre><Copy value={url} label="hyväksyntälinkki" /></div>)}
    </div>
  );
}

function enterOnly(ctx: Ctx, direction: number): Step {
  return {
    id: 'enter', title: 'Tunnukset', body: (
      <>
        <Where crumbs={['App registrations', ctx.app, 'Overview']} href={ENTRA_LIST} pick={pickApp(ctx.app)} />
        {ctx.fields}
        <p className="m-quiet">Salaisuutta ei tarvita.</p>
        <Handoff ctx={ctx} v2={direction === C} />
      </>
    ),
  };
}

/* ---------- A: readable checklist ---------- */

function registerBody(ctx: Ctx) {
  return (
    <>
      <Where crumbs={['Entra ID', 'App registrations', 'New registration']} href={ENTRA_NEW} />
      <ol className="m-fields">
        <Field name="Name" act="Kirjoita" value={ctx.app} />
        <Field name="Supported account types" act="Valitse pudotusvalikosta" value={`Single tenant only - ${ORG}`} copy={false} />
        <Field name="Redirect URI" act="Jätä tyhjäksi." />
        <Field name="Register" act="Valitse." />
      </ol>
      {ctx.section !== 'microsoft' && <p className="si-effect" data-testid="m-level-app">{LEVEL_APP}</p>}
      <p className="m-quiet">Vain organisaation työtilit voivat yhdistää; henkilökohtaiset Microsoft-tilit eivät.</p>
      <Done>Entra avaa sovelluksen <em>{ctx.app}</em> Overview-sivun.</Done>
      <Role>{ROLE_DEV}</Role>
    </>
  );
}
function authBody(ctx: Ctx) {
  return (
    <>
      <Where crumbs={['Authentication', 'Settings']} href={ENTRA_LIST} pick={pickApp(ctx.app)} />
      <ol className="m-fields">
        <Field name="Allow public client flows" act="Valitse Enabled ja Save. Henkilöt kirjautuvat laitekoodilla, joten client secretiä ei luoda." />
      </ol>
      <Where crumbs={['Authentication', 'Redirect URI configuration', 'Add Redirect URI', 'Mobile and desktop applications']} />
      <ol className="m-fields">
        <Field name="Redirect URIs" act="Rastita ehdotetuista tämä osoite ja valitse Configure." value={REDIRECT} />
      </ol>
      <Done>Redirect URI configuration -välilehdellä lukee Mobile and desktop applications ja tämä osoite.</Done>
    </>
  );
}

function stepsA(ctx: Ctx): Step[] {
  const n = PERMS[ctx.section].length;
  return [
    {id: 'register', title: 'Rekisteröi sovellus', body: registerBody(ctx)},
    {id: 'public', title: 'Julkinen asiakas', body: authBody(ctx)},
    {
      id: 'permissions', title: 'Käyttöoikeudet', body: (
        <>
          <Where crumbs={['API permissions', 'Add a permission', 'Microsoft Graph', 'Delegated permissions']} href={ENTRA_LIST} pick={pickApp(ctx.app)} />
          <p className="m-lead">Entran hakukenttä löytää yhden oikeuden kerrallaan. Kopioi oikeus, liitä se kenttään <em>Select permissions</em> ja rastita se Entrassa. Rastit säilyvät, kun haet seuraavaa.</p>
          <PermList section={ctx.section} ticks={ctx.ticks} setTicks={ctx.setTicks} />
          <ol className="m-fields"><Field name="Add permissions" act="Valitse, kun kaikki on rastitettu." /></ol>
          <Done>Configured permissions -taulukossa on {n} riviä Microsoft Graphin alla.</Done>
        </>
      ),
    },
    {
      id: 'consent', title: 'Hyväksyntä ja tunnukset', size: 'split', body: (
        <div className="si-cols">
          <div className="si-col">
            <p className="si-side">Microsoft Entrassa</p>
            <Where crumbs={['API permissions', `Grant admin consent for ${ORG}`, 'Yes']} href={ENTRA_LIST} pick={pickApp(ctx.app)} />
            <p className="m-quiet">Henkilöiltä ei kysytä hyväksyntää.</p>
            <Done>Status-sarakkeessa lukee jokaisella rivillä <em>Granted for {ORG}</em>.</Done>
            <Role>{ROLE_ADMIN}</Role>
          </div>
          <div className="si-col si-get">
            <p className="si-side">Tähän</p>
            <Where crumbs={['Overview']} />
            <p className="m-quiet">Kopioi kummankin arvon vieressä olevalla kopiointinapilla.</p>
            {ctx.fields}
            <p className="m-quiet">Salaisuutta ei tarvita.</p>
            <Handoff ctx={ctx} />
          </div>
        </div>
      ),
    },
  ];
}

/* ---------- B: side by side with Entra ---------- */

const NAV = ['Overview', 'Quickstart', 'Integration assistant', 'Branding & properties', 'Authentication', 'Certificates & secrets', 'Token configuration', 'API permissions', 'Expose an API', 'App roles', 'Owners'];

/** A sketch of the Entra page, not a copy: where the value goes. */
function Entra({crumbs, nav, children}: {crumbs: string[]; nav?: string; children: React.ReactNode}) {
  return (
    <figure className="m-entra" data-testid="m-entra" aria-label="Mitä näet Entrassa">
      <figcaption className="m-entra-top"><span>Microsoft Entra admin center</span></figcaption>
      <p className="m-entra-crumbs">{crumbs.join('  ›  ')}</p>
      <div className="m-entra-body">
        {nav && (
          <ul className="m-entra-nav" aria-hidden="true">
            {NAV.map(n => <li key={n} data-on={n === nav || undefined}>{n}</li>)}
          </ul>
        )}
        <div className="m-entra-main">{children}</div>
      </div>
    </figure>
  );
}
function EField({label, children, on}: {label: string; children: React.ReactNode; on?: boolean}) {
  return <div className="m-ef" data-on={on || undefined}><span className="m-ef-label">{label}</span><div className="m-ef-input">{children}</div></div>;
}
function EButton({children, on}: {children: React.ReactNode; on?: boolean}) {
  return <span className="m-eb" data-on={on || undefined}>{children}</span>;
}
/** The value as it sits in the Entra field, with its copy. */
function EValue({v, label}: {v: string; label: string}) {
  return <span className="m-ev"><code>{v}</code><Copy value={v} label={label} /></span>;
}

function Subs({items, sub, setSub}: {items: React.ReactNode[]; sub: number; setSub: (n: number) => void}) {
  return (
    <ol className="m-subs" data-testid="m-subs">
      {items.map((it, j) => (
        <li key={j}>
          <button type="button" data-testid={`m-sub-${j}`} aria-current={j === sub ? 'step' : undefined} onClick={() => setSub(j)}>
            <span className="m-subn">{j + 1}</span><span>{it}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
function Beside({left, right}: {left: React.ReactNode; right: React.ReactNode}) {
  return <div className="m-beside"><div className="m-beside-l">{left}</div><div className="m-beside-r">{right}</div></div>;
}

function stepsB(ctx: Ctx): Step[] {
  const {sub, setSub, app, section} = ctx;
  const list = PERMS[section].filter(p => p !== 'User.Read');
  const cur = list[Math.min(sub, list.length - 1)];
  return [
    {
      id: 'register', title: 'Rekisteröi sovellus', size: 'split', body: (
        <Beside
          left={<>
            <Where crumbs={['Entra ID', 'App registrations', 'New registration']} href={ENTRA_NEW} />
            <Subs sub={sub} setSub={setSub} items={[<>Nimeksi <strong>{app}</strong></>, <>Tilityypiksi <strong>Single tenant only</strong></>, <>Redirect URI tyhjäksi, sitten <strong>Register</strong></>]} />
            {section !== 'microsoft' && <p className="si-effect" data-testid="m-level-app">{LEVEL_APP}</p>}
            <Role>{ROLE_DEV}</Role>
          </>}
          right={
            <Entra crumbs={['Home', 'App registrations', 'Register an application']}>
              <EField label="Name" on={sub === 0}>{sub === 0 ? <EValue v={app} label="Name" /> : <span>{app}</span>}</EField>
              <EField label="Supported account types" on={sub === 1}><span className="m-select">Single tenant only - {ORG}</span></EField>
              <EField label="Redirect URI (optional)" on={sub === 2}><span className="m-empty">tyhjä</span></EField>
              <div className="m-ebar"><EButton on={sub === 2}>Register</EButton></div>
            </Entra>
          } />
      ),
    },
    {
      id: 'public', title: 'Julkinen asiakas', size: 'split', body: (
        <Beside
          left={<>
            <Where crumbs={['Authentication']} href={ENTRA_LIST} pick={pickApp(app)} />
            <Subs sub={sub} setSub={setSub} items={[
              <>Välilehti <strong>Settings</strong>: Allow public client flows <strong>Enabled</strong>, Save</>,
              <>Välilehti <strong>Redirect URI configuration</strong>: Add Redirect URI › Mobile and desktop applications</>,
              <>Rastita <strong>nativeclient</strong>-osoite, Configure</>,
            ]} />
            <p className="m-quiet">Henkilöt kirjautuvat laitekoodilla, joten client secretiä ei luoda.</p>
          </>}
          right={
            <Entra crumbs={['Home', 'App registrations', app, 'Authentication']} nav="Authentication">
              <div className="m-tabs"><span data-on={sub > 0 || undefined}>Redirect URI configuration</span><span>Supported accounts</span><span data-on={sub === 0 || undefined}>Settings</span></div>
              {sub === 0 ? (
                <>
                  <EField label="Allow public client flows" on><span className="m-toggle"><i data-on="" />Enabled</span><span className="m-toggle"><i />Disabled</span></EField>
                  <div className="m-ebar"><EButton on>Save</EButton></div>
                </>
              ) : sub === 1 ? (
                <div className="m-tiles">
                  {['Web', 'Single-page application', 'iOS / macOS', 'Android', 'Mobile and desktop applications'].map(t => <span key={t} className="m-tile" data-on={t.startsWith('Mobile') || undefined}>{t}</span>)}
                </div>
              ) : (
                <>
                  <p className="m-epane">Configure Desktop + devices</p>
                  <EField label="Redirect URIs" on>
                    <label className="m-ecb" data-on=""><i data-on="" /><EValue v={REDIRECT} label="Redirect URI" /></label>
                    <label className="m-ecb"><i /><code>https://login.live.com/oauth20_desktop.srf</code></label>
                    <label className="m-ecb"><i /><code>msal…://auth</code></label>
                  </EField>
                  <div className="m-ebar"><EButton on>Configure</EButton></div>
                </>
              )}
            </Entra>
          } />
      ),
    },
    {
      id: 'permissions', title: 'Käyttöoikeudet', size: 'split', body: (
        <Beside
          left={<>
            <Where crumbs={['API permissions', 'Add a permission', 'Microsoft Graph', 'Delegated permissions']} href={ENTRA_LIST} pick={pickApp(app)} />
            <p className="m-lead">Yksi oikeus kerrallaan: kopioi, liitä hakuun, rastita. Lopuksi <strong>Add permissions</strong>.</p>
            <PermList section={section} ticks={ctx.ticks} setTicks={ctx.setTicks} current={cur}
              onPick={p => setSub(list.indexOf(p))} />
          </>}
          right={
            <Entra crumbs={['Home', 'App registrations', app, 'API permissions']} nav="API permissions">
              <p className="m-epane">Request API permissions · Microsoft Graph · Delegated permissions</p>
              <EField label="Select permissions" on><EValue v={cur} label={cur} /></EField>
              <label className="m-ecb m-result" data-on={ctx.ticks.has(cur) || undefined}><i data-on={ctx.ticks.has(cur) || undefined} /><span><code>{cur}</code><small>{SAYS[cur]}</small></span></label>
              <p className="m-quiet m-esel">Valittuna: {ctx.ticks.size}</p>
              <div className="m-ebar"><EButton on={ctx.ticks.size === list.length}>Add permissions</EButton></div>
            </Entra>
          } />
      ),
    },
    {
      id: 'consent', title: 'Hyväksyntä ja tunnukset', size: 'split', body: (
        <Beside
          left={<>
            <Subs sub={sub} setSub={setSub} items={[
              <>API permissions: <strong>Grant admin consent for {ORG}</strong>, Yes</>,
              <>Overview: kopioi kaksi tunnusta tähän</>,
            ]} />
            {sub === 0 ? <Role>{ROLE_ADMIN}</Role> : null}
            <div className="m-get">
              {ctx.fields}
              <p className="m-quiet">Salaisuutta ei tarvita.</p>
              <Handoff ctx={ctx} />
            </div>
          </>}
          right={sub === 0 ? (
            <Entra crumbs={['Home', 'App registrations', app, 'API permissions']} nav="API permissions">
              <div className="m-ebar m-ebar-top"><EButton>Add a permission</EButton><EButton on>Grant admin consent for {ORG}</EButton></div>
              <table className="m-etable"><thead><tr><th>API / Permissions name</th><th>Status</th></tr></thead>
                <tbody>{PERMS[section].map(p => <tr key={p}><td><code>{p}</code></td><td className="m-granted"><Icon name="check" />Granted for {ORG}</td></tr>)}</tbody></table>
            </Entra>
          ) : (
            <Entra crumbs={['Home', 'App registrations', app]} nav="Overview">
              <p className="m-epane">Essentials</p>
              <EField label="Application (client) ID" on><code className="m-eid">4f2c9a1e-…-5d6e7f8a9b0c</code><span className="m-ecopy"><Icon name="copy" /></span></EField>
              <EField label="Directory (tenant) ID" on><code className="m-eid">9a8b7c6d-…-1e0f9a8b7c6d</code><span className="m-ecopy"><Icon name="copy" /></span></EField>
              <EField label="Object ID"><code className="m-eid m-dim">…</code></EField>
              <p className="m-quiet">Entran oma kopiointinappi on arvon vieressä. Object ID ei ole kumpikaan.</p>
            </Entra>
          )} />
      ),
    },
  ];
}

/* ---------- C: three steps, consent by link ---------- */

function Consent({ctx}: {ctx: Ctx}) {
  const [phase, setPhase] = useState<'idle' | 'ask' | 'blank'>('idle');
  const named = PERMS[ctx.section];
  if (phase === 'ask') return (
    <div className="m-ms" data-testid="m-ms-consent" role="group" aria-label="Microsoftin hyväksyntäsivu (simuloitu)">
      <p className="m-ms-brand">Microsoft</p>
      <p className="m-ms-who">admin@esimerkki.fi</p>
      <h3>Permissions requested</h3>
      <p className="m-ms-app"><strong>{ctx.app}</strong> · unverified · {ORG}</p>
      <p>This app would like to:</p>
      <ul>{named.map(p => <li key={p}>{SAYS[p]}</li>)}</ul>
      <p className="m-ms-note">If you accept, this app will get access to the specified resources for all users in your organization.</p>
      <div className="m-ms-btns">
        <ControlButton size="row" variant="secondary" onPress={() => setPhase('idle')}>Cancel</ControlButton>
        <ControlButton data-testid="m-ms-accept" size="row" variant="primary" onPress={() => setPhase('blank')}>Accept</ControlButton>
      </div>
    </div>
  );
  if (phase === 'blank') return (
    <div className="m-ms m-ms-blank" data-testid="m-ms-blank">
      <p className="m-ms-url"><code>…/oauth2/nativeclient?admin_consent=True&amp;tenant=…</code></p>
      <p className="m-ms-empty">(tyhjä sivu)</p>
      <ControlButton data-testid="m-ms-return" size="row" variant="secondary" onPress={() => { ctx.setConsented(true); setPhase('idle'); }}>Palaa tänne</ControlButton>
    </div>
  );
  return (
    <div className="m-consent" data-testid="m-consent">
      <ControlButton data-testid="m-consent-open" size="page" variant={ctx.consented ? 'secondary' : 'primary'} isDisabled={!ctx.idsOk}
        onPress={() => setPhase('ask')}>
        Hyväksy oikeudet Microsoftilla <Icon name="external" />
      </ControlButton>
      {ctx.consented
        ? <p className="m-ok" data-testid="m-consented"><Icon name="check" />Hyväksyntä tehty. Tallenna.</p>
        : <p className="m-quiet">{ctx.idsOk ? `Microsoft näyttää ${PERMS[ctx.section].length} oikeutta. Valitse Accept. Sen jälkeen näkyy tyhjä sivu: se tarkoittaa, että hyväksyntä meni läpi.` : 'Nappi aukeaa, kun molemmat tunnukset on liitetty.'}</p>}
    </div>
  );
}

function stepsC(ctx: Ctx): Step[] {
  return [
    {id: 'register', title: 'Rekisteröi sovellus', body: registerBody(ctx)},
    {id: 'public', title: 'Julkinen asiakas', body: authBody(ctx)},
    {
      id: 'consent', title: 'Tunnukset ja hyväksyntä', body: (
        <>
          <Where crumbs={['Overview']} href={ENTRA_LIST} pick={pickApp(ctx.app)} />
          <p className="m-lead">Kopioi kaksi tunnusta Entran Overview-sivulta. Salaisuutta ei tarvita.</p>
          {ctx.fields}
          <Consent ctx={ctx} />
          <Role>{ROLE_ADMIN}</Role>
          <Handoff ctx={ctx} v2 />
          <p className="m-quiet" data-testid="m-other">Oikeuksia ei lisätä Entrassa käsin: hyväksyntä antaa ne. Entran API permissions -sivulla ne näkyvät kohdassa <em>Other permissions granted for {ORG}</em>.</p>
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
