import React, {type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog as AriaDialog, DialogTrigger, Heading, Modal, ModalOverlay, Popover} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Badge} from '../../../../web/src/components/Status';
import {TextField} from '../../../../web/src/components/Primitives';
import {Modalish} from '../../../../web/src/components/GuideParts';
import {ServerIntegrations} from '../../../../web/src/components/ServerIntegrations';
import {AccountCard, ConnectDialog, type ConnectStage, IntegrationsOverview, ProviderMark} from '../../../../web/src/components/Integrations';
import type {Account, IntegrationList, LoginView, Provider} from '../../../../web/src/app/integrations';
import type {IntegrationApps} from '../../../../web/src/app/serverIntegrations';
import {integrationsText} from '../../../../web/src/text/integrations';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {type Lang, type LevelId, TEXT, type Text} from './text';
import './round.css';

// Microsoft 365 for several Entra organisations, round 2. The
// administrator's organisations belong to the Microsoft row (round 1's A)
// and are collapsed by default; the axis is how the collapsed list opens:
// a summary line with a disclosure that opens the list under the row (A1),
// a row button that opens it in a popover in place (A2), or name chips with
// Manage… opening a dialog (A3). The person's view is its own top-bar view
// and the same in every direction: round 1's C rows, one row per allowed
// organisation. Production components are used unchanged; the round adds
// its parts through portals or builds dialogs from production pieces.
// Every text is terse and the explanations sit behind one "Lisätietoja".
// Every organisation, person and identifier is synthetic.

const params = new URLSearchParams(location.search);
const lang: Lang = params.get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
const T: Text = TEXT[lang];
const itx = liveText(integrationsText);
const ADMIN = ['lista', 'auki', 'lisaa', 'hyvaksynta', 'poisto'] as const;
const PERSON = ['henkilo', 'taso', 'koodi', 'valmis', 'kielto'] as const;
const NOW_ADMIN = ['lista'] as const;
const NOW_PERSON = ['henkilo', 'taso'] as const;
type View = 'admin' | 'person';
const NAMES = ['Nyt', 'A1', 'A2', 'A3'];
const phone = () => window.innerWidth <= 600;

// ---------- Synthetic host ----------
type Org = {id: string; label: string; tenant: string; own?: boolean};
const ORGS0: Org[] = [
  {id: 'own', label: 'Esimerkki Konsultit Oy', tenant: '6d1f0c2a-3b7e-4a51-9c8d-2e4f6a8b0c13', own: true},
  {id: 'c1', label: 'Asiakas Yksi Oy', tenant: '9a4e7b21-5c3d-4f60-8e1a-7b2c9d0e4f35'},
  {id: 'c2', label: 'Asiakas Kaksi Oy', tenant: 'c3b8d5e0-1a2f-4b7c-a6d9-0e5f8a3b2c47'},
];
const PUBLISHER = 'Esimerkki Konsultit Oy';
const ADDRESS = 'henna@konsultit.example';
// The message lists the narrowest level first: a client most often approves read only.
const LEVELS: LevelId[] = ['read', 'drafts', 'nosend', 'full'];
const CLIENT: Record<LevelId, string> = {
  full: '3f2a91c4-7d0e-4b6a-9c15-e8a4b2d7f031',
  nosend: '5b7c02d9-8e1f-4a3b-b6c4-0d9e2f1a7c52',
  drafts: '8d4e16a3-2b5c-4f7d-9e0a-6c1b3d5f8e74',
  read: 'a1c9e7f5-4d3b-4e2a-8f6c-2b0d9e7a5c96',
};
const consentUrl = (tenant: string, l: LevelId) =>
  `https://login.microsoftonline.com/${tenant}/v2.0/adminconsent?client_id=${CLIENT[l]}` +
  '&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default&redirect_uri=https%3A%2F%2Flogin.microsoftonline.com%2Fcommon%2Foauth2%2Fnativeclient';

const prov = (id: Provider['id'], extra: Partial<Provider> = {}): Provider =>
  ({id, available: true, login: 'app_password', services: ['mail'], ...extra}) as Provider;
const SERVER_PROVIDERS: Provider[] = [prov('google'), prov('microsoft'), prov('apple'), prov('imap'), prov('caldav'), prov('carddav'),
  prov('dropbox', {available: false, unavailable_reason: 'app_credentials_required'} as Partial<Provider>)];
const at = '2026-11-12T10:00:00Z';
const msApp = (provider: string, l: LevelId) => ({provider, client_id: CLIENT[l], tenant_id: ORGS0[0].tenant, usable: true, source: 'site_admin', actor: '51234000', at});
const APPS = {schema_version: 1, browser_setup: true, apps: [
  {provider: 'google', client_id: '704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com', usable: true, source: 'site_admin', actor: '51234000', at},
  msApp('microsoft', 'full'), msApp('microsoft_nosend', 'nosend'), msApp('microsoft_drafts', 'drafts'), msApp('microsoft_read', 'read'),
]} as unknown as IntegrationApps;

const MS: Provider = {id: 'microsoft', available: true, login: 'device_code', services: ['onedrive', 'sharepoint', 'mail', 'calendar', 'contacts'],
  levels: (['full', 'nosend', 'drafts', 'read'] as LevelId[]).map((id) => ({id, available: true}))} as Provider;
const GOOGLE: Provider = {id: 'google', available: true, login: 'pasted_redirect', services: ['mail', 'calendar', 'contacts', 'drive']} as Provider;
const IMAP: Provider = prov('imap');
const checked = '2026-11-27T08:10:00Z';
const googleAccount: Account = {provider: 'google', address: 'henna.koti@example.test', checked_at: checked, level: 'full',
  services: [{id: 'mail', state: 'ok', access: 'full'}, {id: 'calendar', state: 'ok', access: 'full'}, {id: 'contacts', state: 'ok', access: 'full'}]} as Account;

type Conn = {org: string; guest: boolean; mailbox: boolean; level: LevelId};
function account(c: Conn): Account {
  const acc = c.level === 'read' ? 'read' : c.level === 'drafts' ? 'drafts' : 'full';
  const files = c.mailbox
    ? [{id: 'onedrive', state: 'ok', access: acc === 'drafts' ? 'read' : acc, directory: `~/cloud/onedrive/${ADDRESS}`, last_synced_at: '2026-11-27T08:02:00Z'}]
    : [];
  const rest = c.mailbox ? [{id: 'mail', state: 'ok', access: acc}, {id: 'calendar', state: 'ok', access: acc === 'full' ? 'full' : 'read'}, {id: 'contacts', state: 'ok', access: acc === 'full' ? 'full' : 'read'}] : [];
  return {provider: 'microsoft', address: ADDRESS, checked_at: checked, level: c.level,
    services: [...files, {id: 'sharepoint', state: 'ok', access: acc === 'drafts' ? 'read' : acc}, ...rest]} as unknown as Account;
}
const OWN: Conn = {org: 'own', guest: false, mailbox: true, level: 'full'};
const C1: Conn = {org: 'c1', guest: true, mailbox: false, level: 'read'};

const soon = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const base = {schema_version: 1 as const, attempt_id: '20261127T091500.000000001', relogin: false};
const DEVICE = {...base, state: 'device_code', login_phase: 'files', provider: 'microsoft', verification_uri: 'https://login.microsoft.com/device', user_code: 'R4TW9KQ2M', expires_at: soon(15)} as LoginView;
const COMPLETED = {...base, state: 'completed', provider: 'microsoft', address: ADDRESS} as LoginView;

// ---------- Shared pieces ----------
let toastSink: (m: string) => void = () => {};
const orgOf = (orgs: Org[], id: string) => orgs.find((o) => o.id === id) ?? ORGS0.find((o) => o.id === id)!;

/** A node created inside production DOM for a portal; `where` places it. */
function useSlot(host: RefObject<HTMLElement | null> | null, selector: string, where: 'append' | 'prepend' | 'after' | 'before', dep: unknown = 0, tag = 'div', className = 'rq-slot') {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let node: HTMLElement | null = null;
    let tries = 0;
    let timer = 0;
    const place = () => {
      const root: ParentNode | null = host ? host.current : document;
      const target = root?.querySelector(selector) as HTMLElement | null;
      if (!target) { if (tries++ < 30) timer = window.setTimeout(place, 16); return; }
      node = document.createElement(tag);
      node.className = className;
      if (where === 'append') target.append(node);
      else if (where === 'prepend') target.prepend(node);
      else if (where === 'after') target.after(node);
      else target.before(node);
      setEl(node);
    };
    place();
    return () => { clearTimeout(timer); node?.remove(); setEl(null); };
  }, [selector, where, dep]);
  return el;
}

function CopyButton({value, label, testId, variant = 'secondary'}: {value: string; label: string; testId: string; variant?: 'secondary' | 'quiet'}) {
  return (
    <Button data-testid={testId} size="row" variant={variant} onPress={() => { void navigator.clipboard?.writeText(value).catch(() => {}); toastSink(T.copied); }}>
      <Icon name="copy" /> {label}
    </Button>
  );
}

/** The one "Lisätietoja" of a view: the explanations moved out of sight. */
function More({lines, testId}: {lines: string[]; testId: string}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rq-more" data-testid={testId}>
      <button type="button" className="ml-disclose" aria-expanded={open} data-testid={`${testId}-toggle`} onClick={() => setOpen(!open)}>
        <Icon name={open ? 'up' : 'info'} />{open ? T.lessMore : T.more}
      </button>
      {open && <div className="rq-morebody" data-testid={`${testId}-body`}>{lines.map((l) => <p key={l}>{l}</p>)}</div>}
    </div>
  );
}

function ConsentBody({org}: {org: Org}) {
  const links = LEVELS.map((l) => ({level: T.levelShort[l], url: consentUrl(org.tenant, l)}));
  const message = T.message({org: org.label, publisher: PUBLISHER, links});
  return (
    <div className="rq-consent" data-testid="rq-consent" data-org={org.id}>
      <p>{org.own ? T.consentOwn : T.consentLead}</p>
      {!org.own && (
        <>
          <pre className="rq-message" data-testid="rq-message">{message}</pre>
          <div className="rq-acts"><CopyButton testId="rq-message-copy" value={message} label={T.messageCopy} /></div>
        </>
      )}
      <div className="rq-links" data-testid="rq-links">
        <span className="rq-linkstitle">{T.linksTitle}</span>
        {LEVELS.map((l) => (
          <CopyButton key={l} testId={`rq-link-${l}`} variant="quiet" value={consentUrl(org.tenant, l)} label={T.levelShort[l]} />
        ))}
      </div>
      <More lines={T.moreConsent} testId="rq-more-consent" />
    </div>
  );
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function AddDialog({orgs, onAdd, onClose}: {orgs: Org[]; onAdd: (o: Org) => void; onClose: () => void}) {
  const [label, setLabel] = useState('');
  const [tenant, setTenant] = useState('');
  const [tried, setTried] = useState(false);
  const dup = orgs.find((o) => o.tenant.toLowerCase() === tenant.trim().toLowerCase());
  const labelErr = tried && (label.trim().length < 1 || label.trim().length > 64) ? T.errLabel : undefined;
  const tenantErr = tried ? (!GUID.test(tenant.trim()) ? T.errTenant : dup ? T.errDuplicate(dup.label) : undefined) : undefined;
  return (
    <Modalish testId="rq-add-dialog" title={T.addTitle} onClose={onClose}>
      <div className="si-stepbody rq-add" data-testid="rq-add">
        <TextField data-testid="rq-add-label" name="organisation-label" label={T.labelField} value={label} onChange={setLabel} hint={T.labelHint} error={labelErr} />
        <TextField data-testid="rq-add-tenant" name="organisation-tenant" label={T.tenantField} value={tenant} onChange={setTenant} error={tenantErr} mono />
        <p className="si-quiet rq-note" data-testid="rq-limit"><Icon name="shield" /><span>{T.limitShort}</span></p>
        <More lines={T.moreAdd} testId="rq-more-add" />
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        <Button size="row" variant="secondary" onPress={onClose}>{T.cancel}</Button>
        <Button data-testid="rq-add-save" size="page" variant="primary" onPress={() => {
          setTried(true);
          const l = label.trim(), t = tenant.trim();
          if (l.length < 1 || l.length > 64 || !GUID.test(t) || orgs.some((o) => o.tenant.toLowerCase() === t.toLowerCase())) return;
          onAdd({id: `n${Date.now()}`, label: l, tenant: t.toLowerCase()});
        }}>{T.addSave}</Button>
      </div>
    </Modalish>
  );
}

function ConsentDialog({org, onClose}: {org: Org; onClose: () => void}) {
  return (
    <Modalish testId="rq-consent-dialog" title={T.consentTitle(org.label)} onClose={onClose}>
      <div className="si-stepbody"><ConsentBody org={org} /></div>
      <div className="si-foot"><span className="si-grow" /><Button data-testid="rq-close" size="page" variant="primary" onPress={onClose}>{T.done}</Button></div>
    </Modalish>
  );
}

function RemoveDialog({org, onConfirm, onClose}: {org: Org; onConfirm: () => void; onClose: () => void}) {
  return (
    <Modalish testId="rq-remove" title={T.removeTitle(org.label)} onClose={onClose}>
      <div className="si-stepbody">
        <p>{T.removeBody}</p>
        {org.own && <p className="si-warn" data-testid="rq-remove-own"><Icon name="warning" /><span>{T.removeOwn}</span></p>}
        <More lines={T.moreRemove} testId="rq-more-remove" />
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        <Button size="row" variant="secondary" onPress={onClose}>{T.cancel}</Button>
        <Button data-testid="rq-remove-confirm" size="page" variant="danger" onPress={onConfirm}>{T.removeConfirm}</Button>
      </div>
    </Modalish>
  );
}

// ---------- Administrator ----------
type Act = null | {k: 'add'} | {k: 'consent'; id: string} | {k: 'remove'; id: string};

/** The opened list, the same in every direction: name, own mark, two actions. */
function OrgList({orgs, onAct}: {orgs: Org[]; onAct: (a: Act) => void}) {
  return (
    <div className="rq-orglist">
      <ul className="rq-orgs" data-testid="rq-orgs">
        {orgs.map((o) => (
          <li key={o.id} data-testid={`rq-org-${o.id}`}>
            <span className="rq-orgname"><span>{o.label}</span>{o.own && <Badge label={T.own} tone="neutral" />}</span>
            <span className="rq-rowacts">
              <Button data-testid={`rq-consent-open-${o.id}`} size="row" variant="quiet" onPress={() => onAct({k: 'consent', id: o.id})}>{T.consentOpen}</Button>
              <Button data-testid={`rq-remove-open-${o.id}`} size="row" variant="quiet" aria-label={`${T.removeOpen}: ${o.label}`} onPress={() => onAct({k: 'remove', id: o.id})}><Icon name="trash" /></Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="rq-listfoot">
        <Button data-testid="rq-add-open" size="row" variant="secondary" onPress={() => onAct({k: 'add'})}><Icon name="plus" /> {T.addOrg}</Button>
        <More lines={T.moreList} testId="rq-more-list" />
      </div>
    </div>
  );
}

/** A1: a summary line in the row and a disclosure that opens the list under it. */
function A1({orgs, open, setOpen, onAct, page}: {orgs: Org[]; open: boolean; setOpen: (v: boolean) => void; onAct: (a: Act) => void; page: RefObject<HTMLDivElement | null>}) {
  const line = useSlot(page, '[data-testid="si-row-microsoft"] .ah-people-person', 'append');
  const under = useSlot(page, '[data-testid="si-row-microsoft"]', 'after', open, 'li', 'ml-cmprow rq-under');
  return (
    <>
      {line && createPortal(
        <span className="rq-sum" data-testid="rq-rowline" data-count={orgs.length}>
          <span className="rq-sumtext"><Icon name="users" />{T.orgsCount(orgs.length)}</span>
          <button type="button" className="ml-disclose" aria-expanded={open} data-testid="rq-orgs-toggle" onClick={() => setOpen(!open)}>
            <Icon name={open ? 'up' : 'down'} />{open ? T.orgsHide : T.orgsShow}
          </button>
        </span>, line)}
      {open && under && createPortal(<div data-testid="rq-orgs-panel"><OrgList orgs={orgs} onAct={onAct} /></div>, under)}
    </>
  );
}

/** A2: a row button beside Levels that opens the list in place (a sheet on a phone). */
function A2({orgs, open, setOpen, onAct, page}: {orgs: Org[]; open: boolean; setOpen: (v: boolean) => void; onAct: (a: Act) => void; page: RefObject<HTMLDivElement | null>}) {
  const end = useSlot(page, '[data-testid="si-row-microsoft"] .ah-people-end', 'prepend');
  const line = useSlot(page, '[data-testid="si-row-microsoft"] .ah-people-person', 'append');
  const content = (
    <AriaDialog className="rq-popdialog" data-testid="rq-orgs-panel" aria-label={`Microsoft 365: ${T.orgsTitle}`}>
      <div className="rq-pophead"><Heading slot="title" className="rq-h3">{T.orgsTitle}</Heading>
        <Button size="row" variant="quiet" presentation="icon" aria-label={T.close} onPress={() => setOpen(false)}><Icon name="cross" /></Button></div>
      <OrgList orgs={orgs} onAct={(a) => { setOpen(false); onAct(a); }} />
    </AriaDialog>
  );
  return (
    <>
      {line && createPortal(<span className="rq-sum" data-testid="rq-rowline" data-count={orgs.length} hidden />, line)}
      {end && createPortal(
        <DialogTrigger isOpen={open} onOpenChange={setOpen}>
          <Button data-testid="rq-orgs-toggle" size="row" variant="secondary"><Icon name="users" /> {T.orgsButton} <span className="rq-count">{orgs.length}</span></Button>
          {phone() ? (
            <ModalOverlay className="ah-overlay rq-sheet" isDismissable><Modal className="ah-modal">{content}</Modal></ModalOverlay>
          ) : (
            <Popover placement="bottom end" className="ah-popover rq-pop">{content}</Popover>
          )}
        </DialogTrigger>, end)}
    </>
  );
}

/** A3: the names as chips in the row and Manage… opening a dialog. */
function A3({orgs, open, setOpen, onAct, page}: {orgs: Org[]; open: boolean; setOpen: (v: boolean) => void; onAct: (a: Act) => void; page: RefObject<HTMLDivElement | null>}) {
  const line = useSlot(page, '[data-testid="si-row-microsoft"] .ah-people-person', 'append');
  return (
    <>
      {line && createPortal(
        <span className="rq-chips" data-testid="rq-rowline" data-count={orgs.length}>
          {orgs.map((o) => <span key={o.id} className="rq-chip" data-testid={`rq-chip-${o.id}`}>{o.label}{o.own && <span className="rq-chipown">{T.own}</span>}</span>)}
          <button type="button" className="ml-disclose" data-testid="rq-orgs-toggle" onClick={() => setOpen(true)}>{T.orgsManage}</button>
        </span>, line)}
      {open && (
        <Modalish testId="rq-orgs-dialog" title={`Microsoft 365: ${T.orgsTitle}`} onClose={() => setOpen(false)}>
          <div className="si-stepbody" data-testid="rq-orgs-panel"><OrgList orgs={orgs} onAct={(a) => { setOpen(false); onAct(a); }} /></div>
          <div className="si-foot"><span className="si-grow" /><Button data-testid="rq-close-list" size="page" variant="primary" onPress={() => setOpen(false)}>{T.done}</Button></div>
        </Modalish>
      )}
    </>
  );
}

function adminInitial(s: string): {open: boolean; act: Act} {
  if (s === 'auki') return {open: true, act: null};
  if (s === 'lisaa') return {open: false, act: {k: 'add'}};
  if (s === 'hyvaksynta') return {open: false, act: {k: 'consent', id: 'c1'}};
  if (s === 'poisto') return {open: false, act: {k: 'remove', id: 'c1'}};
  return {open: false, act: null};
}

function AdminPage({d, s}: {d: number; s: string}) {
  const init = adminInitial(s);
  const [orgs, setOrgs] = useState<Org[]>(ORGS0);
  const [open, setOpen] = useState(init.open);
  const [act, setAct] = useState<Act>(init.act);
  // A2 and A3 close their list for an action and reopen it afterwards; A1's list stays open.
  const [back, setBack] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const onAct = (a: Act) => { if (d !== 1) setBack(true); setAct(a); };
  const finish = () => { setAct(null); if (back) { setOpen(true); setBack(false); } };
  const Dir = d === 1 ? A1 : d === 2 ? A2 : A3;
  return (
    <div className="rq-page" data-testid="rq-page" data-side="admin" ref={page}>
      <p className="rq-kicker">{T.adminKicker}</p>
      <h1 className="rq-h">{T.adminTitle}</h1>
      <ServerIntegrations providers={SERVER_PROVIDERS} apps={APPS} steps={['google', 'microsoft']} names={{'51234000': 'yllapitaja'}}
        onboardingHref="#kayttoonotto" onSave={async () => ({kind: 'changed', view: APPS}) as never}
        onRemove={() => toastSink(T.notInRound)} onRefresh={() => {}} />
      <Dir orgs={orgs} open={open} setOpen={setOpen} onAct={onAct} page={page} />
      {act?.k === 'add' && <AddDialog orgs={orgs} onClose={finish} onAdd={(o) => { setOrgs((x) => [...x, o]); toastSink(T.addedToast(o.label)); setAct({k: 'consent', id: o.id}); }} />}
      {act?.k === 'consent' && <ConsentDialog org={orgOf(orgs, act.id)} onClose={finish} />}
      {act?.k === 'remove' && <RemoveDialog org={orgOf(orgs, act.id)} onClose={finish}
        onConfirm={() => { const o = orgOf(orgs, act.id); setOrgs((x) => x.filter((y) => y.id !== o.id)); toastSink(T.removedToast(o.label)); finish(); }} />}
    </div>
  );
}

// ---------- Person ----------
type Refusal = 'consent_required' | 'not_in_organisation' | 'device_code_blocked' | 'organisation_unavailable' | 'expired';
type POpen = null | {k: 'level'; org: string} | {k: 'device'; org: string} | {k: 'done'; org: string; mailbox: boolean} | {k: 'refused'; org: string; code: Refusal};

function RefusalBody({code, org, level = 'read'}: {code: Refusal; org: Org; level?: LevelId}) {
  const R = T.refusals;
  const ask = R.consent_required.ask(org.label, T.levelShort[level], consentUrl(org.tenant, level));
  const lead = code === 'consent_required' ? R.consent_required.lead(org.label, T.levelShort[level]) : code === 'expired' ? R.expired.lead : R[code].lead(org.label);
  return (
    <div className="rq-refusal" data-testid={`rq-refusal-${code}`}>
      <p className="ig-result bad" role="alert"><Icon name="warning" /><span>{lead}</span></p>
      <p className="ig-p">{R[code].body}</p>
      {code === 'expired' && !org.own && <p className="ig-p si-quiet">{R.expired.client}</p>}
      {(code === 'consent_required' || (code === 'expired' && !org.own)) && (
        <div className="rq-acts"><CopyButton testId="rq-ask-copy" value={ask} label={R.consent_required.askCopy} /></div>
      )}
    </div>
  );
}

/** The connect dialog's frame for the refusal, which production does not have per organisation. */
function Frame({testId, children, onClose}: {testId: string; children: ReactNode; onClose: () => void}) {
  return (
    <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={(o) => !o && onClose()}>
      <Modal className="ah-modal ig-dlg">
        <AriaDialog data-testid={testId} className="ah-dialog" aria-label={itx.titleConnect('Microsoft 365')}>
          <div className="ig-dh">
            <ProviderMark provider="microsoft" small />
            <Heading slot="title">{itx.titleConnect('Microsoft 365')}</Heading>
            <Button size="row" variant="quiet" presentation="icon" aria-label={T.close} onPress={onClose}><Icon name="cross" /></Button>
          </div>
          <div className="ig-flow">{children}</div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function OrgLine({org, guestLine}: {org: Org; guestLine: boolean}) {
  return (
    <p className="rq-orgchosen" data-testid="rq-orgline" data-org={org.id}>
      <Icon name="users" /><strong>{T.orgChosen(org.label)}</strong>
      {guestLine && !org.own && <span className="ig-meta">{T.orgGuestLine}</span>}
    </p>
  );
}

/** Production's connect dialog with the organisation line at the top of its flow. */
function Connect({open, org, onOpen, onDone, onClose}: {open: POpen & {org: string}; org: Org; onOpen: (o: POpen) => void; onDone: (c: Conn) => void; onClose: () => void}) {
  const stage: ConnectStage = open.k === 'level' ? {stage: 'intro'} : open.k === 'device' ? {stage: 'login', view: DEVICE} : {stage: 'login', view: COMPLETED};
  const top = useSlot(null, '[data-testid="integration-dialog"] .ig-flow', 'prepend', open.k);
  const end = useSlot(null, '[data-testid="integration-dialog"] .ig-flow', 'append', open.k);
  const [level, setLevel] = useState<LevelId>('read');
  return (
    <>
      <ConnectDialog provider={MS} stage={stage} onContinue={(l) => { setLevel((l as LevelId) ?? 'read'); onOpen({k: 'device', org: org.id}); }}
        onPassword={() => {}} onPaste={() => {}} onFolders={() => {}} onRestart={() => onOpen({k: 'level', org: org.id})}
        onClose={() => (open.k === 'done' ? onDone({org: org.id, guest: !org.own, mailbox: open.mailbox, level: org.own ? 'full' : level}) : onClose())} />
      {top && createPortal(
        <div className="rq-orgtop">
          <OrgLine org={org} guestLine={open.k !== 'done'} />
          {open.k === 'done' && !open.mailbox && <p className="ig-notice" role="status" data-testid="rq-guest-files"><Icon name="info" /><span>{T.guestFiles}</span></p>}
        </div>, top)}
      {end && open.k === 'device' && createPortal(
        <div className="rq-sim" data-testid="rq-sim">
          <span className="si-quiet">{T.simTitle}</span>
          {org.own
            ? <Button data-testid="rq-sim-ok" size="row" variant="secondary" onPress={() => onOpen({k: 'done', org: org.id, mailbox: true})}>{T.simDone}</Button>
            : <Button data-testid="rq-sim-guest" size="row" variant="secondary" onPress={() => onOpen({k: 'done', org: org.id, mailbox: false})}>{T.simDoneGuest}</Button>}
          {(['consent_required', 'not_in_organisation', 'device_code_blocked', 'expired'] as Refusal[]).map((c) => (
            <Button key={c} data-testid={`rq-sim-${c}`} size="row" variant="quiet" onPress={() => onOpen({k: 'refused', org: org.id, code: c})}>{T.simRefuse}: <code>{c}</code></Button>
          ))}
        </div>, end)}
    </>
  );
}

/** Production's AccountCard with the organisation under the address and, for a guest, one line for the missing services. */
function OrgCard({c}: {c: Conn}) {
  const wrap = useRef<HTMLDivElement>(null);
  const head = useSlot(wrap, '.ig-acc > div', 'append');
  const tail = useSlot(wrap, 'article', 'append');
  const org = orgOf(ORGS0, c.org);
  return (
    <div ref={wrap} className="rq-cardwrap" data-testid={`rq-card-${c.org}`} data-guest={c.guest || undefined}>
      <AccountCard account={account(c)} checking={false} onCheck={() => {}} onSignInAgain={() => toastSink(T.notInRound)} onChangeLevel={() => toastSink(T.notInRound)} onRemove={() => toastSink(T.notInRound)} />
      {head && createPortal(<span className="ig-meta rq-cardorg" data-testid="rq-cardorg">{c.guest ? T.cardOrg(org.label, T.guest) : org.label}</span>, head)}
      {tail && !c.mailbox && createPortal(<p className="ig-meta rq-offnote" data-testid="rq-guest-off">{T.guestOff}</p>, tail)}
    </div>
  );
}

function personInitial(s: string): POpen {
  if (s === 'taso') return {k: 'level', org: 'c2'};
  if (s === 'koodi') return {k: 'device', org: 'c2'};
  if (s === 'valmis') return {k: 'done', org: 'c2', mailbox: false};
  if (s === 'kielto') return {k: 'refused', org: 'c2', code: 'consent_required'};
  return null;
}

function PersonPage({s}: {s: string}) {
  const [conns, setConns] = useState<Conn[]>([OWN, C1]);
  const [open, setOpen] = useState<POpen>(personInitial(s));
  const page = useRef<HTMLDivElement>(null);
  const slot = useSlot(page, '.ig-provider', 'before');
  const list: IntegrationList = {schema_version: 1, providers: [GOOGLE, MS, IMAP], skill: 'current', accounts: [googleAccount]} as IntegrationList;
  return (
    <div className="rq-page rq-person" data-testid="rq-page" data-side="person" ref={page}>
      <p className="rq-kicker">{T.personKicker}</p>
      <h1 className="rq-h">{T.personTitle}</h1>
      <IntegrationsOverview list={list} checking={new Set()} onCheck={() => {}} onConnect={() => toastSink(T.notInRound)}
        onSignInAgain={() => {}} onRemove={() => {}} onChangeLevel={() => {}} />
      {slot && createPortal(
        <section className="ig-provider rq-ms" data-testid="rq-ms" aria-label="Microsoft 365">
          {ORGS0.map((o) => {
            const c = conns.find((x) => x.org === o.id);
            if (c) return <OrgCard key={o.id} c={c} />;
            return (
              <article key={o.id} className="ig-card" data-testid={`rq-row-${o.id}`}>
                <div className="ig-acc">
                  <ProviderMark provider="microsoft" />
                  <div><span className="ig-rn">Microsoft 365</span><span className="ig-meta rq-cardorg">{o.label}</span></div>
                  <span className="ig-meta">{T.rowNot}</span>
                  <Button data-testid={`rq-connect-row-${o.id}`} size="row" variant="secondary" onPress={() => setOpen({k: 'level', org: o.id})}>{T.connectShort}</Button>
                </div>
              </article>
            );
          })}
        </section>, slot)}
      {(open?.k === 'level' || open?.k === 'device' || open?.k === 'done') && (
        <Connect key={open.k} open={open} org={orgOf(ORGS0, open.org)} onOpen={setOpen} onClose={() => setOpen(null)}
          onDone={(c) => { setConns((x) => [...x.filter((y) => y.org !== c.org), c]); setOpen(null); }} />
      )}
      {open?.k === 'refused' && (
        <Frame testId="rq-refused" onClose={() => setOpen(null)}>
          <OrgLine org={orgOf(ORGS0, open.org)} guestLine={false} />
          <RefusalBody code={open.code} org={orgOf(ORGS0, open.org)} />
          <div className="ig-row">
            <Button size="page" variant="secondary" onPress={() => setOpen(null)}>{T.close}</Button>
            <Button data-testid="rq-restart" size="page" variant="primary" onPress={() => setOpen({k: 'level', org: open.org})}>{T.restart}</Button>
          </div>
        </Frame>
      )}
    </div>
  );
}

// ---------- Nyt ----------
function NowPerson({s}: {s: string}) {
  const [stage, setStage] = useState<ConnectStage | null>(s === 'taso' ? {stage: 'intro'} : null);
  const own = account(OWN);
  const list: IntegrationList = {schema_version: 1, providers: [GOOGLE, MS, IMAP], skill: 'current', accounts: [googleAccount, own]} as IntegrationList;
  return (
    <div className="rq-page rq-person" data-testid="rq-page" data-side="person">
      <p className="rq-kicker">{T.personKicker}</p>
      <h1 className="rq-h">{T.personTitle}</h1>
      <IntegrationsOverview list={list} checking={new Set()} onCheck={() => {}} onConnect={(p) => (p.id === 'microsoft' ? setStage({stage: 'intro'}) : toastSink(T.notInRound))}
        onSignInAgain={() => {}} onRemove={() => {}} onChangeLevel={() => setStage({stage: 'intro', account: own})} />
      {stage && (
        <ConnectDialog provider={MS} stage={stage} accounts={list.accounts} onContinue={() => setStage({stage: 'login', view: DEVICE})}
          onPassword={() => {}} onPaste={() => {}} onFolders={() => {}} onRestart={() => setStage({stage: 'intro'})} onClose={() => setStage(null)} />
      )}
    </div>
  );
}
function NowAdmin() {
  return (
    <div className="rq-page" data-testid="rq-page" data-side="admin">
      <p className="rq-kicker">{T.adminKicker}</p>
      <h1 className="rq-h">{T.adminTitle}</h1>
      <ServerIntegrations providers={SERVER_PROVIDERS} apps={APPS} steps={['google', 'microsoft']} names={{'51234000': 'yllapitaja'}}
        onboardingHref="#kayttoonotto" onSave={async () => ({kind: 'changed', view: APPS}) as never} onRemove={() => toastSink(T.notInRound)} onRefresh={() => {}} />
    </div>
  );
}

// ---------- Review chrome ----------
// The view and situation survive switching directions in the picker, so
// Jari can compare the same moment across A1, A2 and A3.
const scenariosOf = (d: number, v: View): readonly string[] => (d === 0 ? (v === 'admin' ? NOW_ADMIN : NOW_PERSON) : v === 'admin' ? ADMIN : PERSON);
const current = {view: (params.get('view') === 'person' ? 'person' : 'admin') as View, s: params.get('s') ?? ''};

function App({direction}: {direction: number}) {
  const [view, setView] = useState<View>(current.view);
  const valid = scenariosOf(direction, view);
  const [s, setS] = useState<string>(valid.includes(current.s) ? current.s : valid[0]);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState('');
  const bar = useRef<HTMLElement>(null);
  toastSink = setMessage;
  useEffect(() => { current.view = view; current.s = s; }, [view, s]);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = params.get('theme') === 'dark' ? 'dark' : 'light'; document.documentElement.lang = lang; }, []);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="https://"], a[href^="#kayttoonotto"]') as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      setMessage(`${T.wouldOpen} ${a.href}`);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);
  useEffect(() => { if (!message) return; const id = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(id); }, [message]);
  const relaunch = (key: string, value: string) => {
    const p = new URLSearchParams(location.search);
    p.set(key, value); p.set('v', String(direction + 1)); p.set('view', view); p.set('s', s);
    location.search = p.toString();
  };
  const switchView = (v: View) => { setView(v); setS(scenariosOf(direction, v)[0]); setGeneration((g) => g + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-view={view} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong className="rq-title">{T.title}</strong>
        <div className="rq-views" role="group" aria-label={T.view} data-testid="rq-views">
          {(['admin', 'person'] as View[]).map((v) => (
            <button key={v} type="button" data-testid={`rq-view-${v}`} aria-pressed={view === v} onClick={() => switchView(v)}>
              <Icon name={v === 'admin' ? 'shield' : 'user'} />{T.views[v]}
            </button>
          ))}
        </div>
        <label>{T.show} <select data-testid="rq-scenario" value={s} onChange={(e) => { setS(e.target.value); setGeneration((g) => g + 1); }}>
          {valid.map((id) => <option key={id} value={id}>{T.scenarios[id]}</option>)}
        </select></label>
        <label>{T.language} <select data-testid="rq-lang" value={lang} onChange={(e) => relaunch('lang', e.target.value)}>
          <option value="fi">suomi</option><option value="en">English</option></select></label>
        <label>{T.theme} <select data-testid="rq-theme" value={params.get('theme') === 'dark' ? 'dark' : 'light'} onChange={(e) => relaunch('theme', e.target.value)}>
          <option value="light">{T.themes.light}</option><option value="dark">{T.themes.dark}</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => setGeneration((g) => g + 1)}>{T.reset}</button>
        <p className="rq-line" data-testid="direction-line">{T.lines[direction]}{direction > 0 && view === 'person' ? ` ${T.personSame}` : ''}</p>
      </header>
      <div className="rq-stage">
        {direction === 0
          ? (view === 'person' ? <NowPerson key={`${generation}-${s}`} s={s} /> : <NowAdmin key={generation} />)
          : view === 'person' ? <PersonPage key={`${generation}-${s}`} s={s} /> : <AdminPage key={`${generation}-${s}`} d={direction} s={s} />}
      </div>
      {message ? <p className="rq-toast" role="status" data-testid="rq-toast">{message}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
const stageSink = {set innerHTML(view: ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n;
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
