import React, {type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Badge} from '../../../../web/src/components/Status';
import {TextField} from '../../../../web/src/components/Primitives';
import {Copy, Modalish, Progress, Val} from '../../../../web/src/components/GuideParts';
import {PeopleList, PeopleRow, SectionCard, SectionLead} from '../../../../web/src/components/ServerSection';
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

// Microsoft 365 for several Entra organisations on one server (direction B
// of the design): the administrator's organisations list, add dialog,
// consent panel with the message to a client's administrator, the honest
// limitation and removal; the person's organisation choice, cards with the
// organisation, the files-only guest card and the refusals.
//
// Nyt renders production's ServerIntegrations, MicrosoftLevelsDialog (from
// the row's button), IntegrationsOverview, ConnectDialog and AccountCard
// unchanged with one organisation. The directions keep those components
// unchanged and add their parts beside them: through portals into the
// Microsoft row, the connect dialog's flow and each card, or as their own
// dialogs built from production pieces (Modalish, Progress, Val, Copy,
// TextField, PeopleList, SectionCard, Badge). The axis is where the
// organisations appear: inside the Microsoft row and as a connect step (A),
// their own section and tabs (B), a dialog and per-organisation rows (C).
// Every organisation, person and identifier is synthetic.

const params = new URLSearchParams(location.search);
const lang: Lang = params.get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
const T: Text = TEXT[lang];
const itx = liveText(integrationsText);
const ADMIN = ['lista', 'opas', 'lisaa', 'hyvaksynta', 'poisto'] as const;
const PERSON = ['henkilo', 'organisaatio', 'koodi', 'yhdistetty', 'kiellot'] as const;
const NOW = ['yllapito', 'henkilo'] as const;
type S = typeof ADMIN[number] | typeof PERSON[number];
const NAMES = ['Nyt', 'A', 'B', 'C'];
const isPerson = (s: string) => (PERSON as readonly string[]).includes(s);

// ---------- Synthetic host ----------
type Org = {id: string; label: string; tenant: string; own?: boolean; by: string; at: string};
const ORGS0: Org[] = [
  {id: 'own', label: 'Esimerkki Konsultit Oy', tenant: '6d1f0c2a-3b7e-4a51-9c8d-2e4f6a8b0c13', own: true, by: 'yllapitaja', at: '12.11.2026'},
  {id: 'c1', label: 'Asiakas Yksi Oy', tenant: '9a4e7b21-5c3d-4f60-8e1a-7b2c9d0e4f35', by: 'yllapitaja', at: '20.11.2026'},
  {id: 'c2', label: 'Asiakas Kaksi Oy', tenant: 'c3b8d5e0-1a2f-4b7c-a6d9-0e5f8a3b2c47', by: 'yllapitaja', at: '26.11.2026'},
];
const PUBLISHER = 'Esimerkki Konsultit Oy';
const ADDRESS = 'henna@konsultit.example';
const LEVELS: LevelId[] = ['full', 'nosend', 'drafts', 'read'];
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
  levels: LEVELS.map((id) => ({id, available: true}))} as Provider;
const GOOGLE: Provider = {id: 'google', available: true, login: 'pasted_redirect', services: ['mail', 'calendar', 'contacts', 'drive']} as Provider;
const IMAP: Provider = prov('imap');
const checked = '2026-11-27T08:10:00Z';
const googleAccount: Account = {provider: 'google', address: 'henna.koti@example.test', checked_at: checked, level: 'full',
  services: [{id: 'mail', state: 'ok', access: 'full'}, {id: 'calendar', state: 'ok', access: 'full'}, {id: 'contacts', state: 'ok', access: 'full'}]} as Account;

type Problem = 'consent_withdrawn' | 'guest_removed' | 'tenant_removed';
type Conn = {org: string; guest: boolean; mailbox: boolean; level: LevelId; problem?: Problem};
function account(c: Conn): Account {
  const st = c.problem === 'tenant_removed' ? 'unknown' : c.problem ? 'login_expired' : 'ok';
  const failure = c.problem === 'guest_removed' ? {failure: 'outside_tenant'} : {};
  const acc = c.level === 'read' ? 'read' : c.level === 'drafts' ? 'drafts' : 'full';
  const files = c.mailbox
    ? [{id: 'onedrive', state: st, access: acc === 'drafts' ? 'read' : acc, directory: `~/cloud/onedrive/${ADDRESS}`, last_synced_at: '2026-11-27T08:02:00Z', ...failure}]
    : [];
  const rest = c.mailbox ? [{id: 'mail', state: st, access: acc, ...failure}, {id: 'calendar', state: st, access: acc === 'full' ? 'full' : 'read', ...failure}, {id: 'contacts', state: st, access: acc === 'full' ? 'full' : 'read', ...failure}] : [];
  return {provider: 'microsoft', address: ADDRESS, checked_at: checked, level: c.level,
    services: [...files, {id: 'sharepoint', state: st, access: acc === 'drafts' ? 'read' : acc, ...failure}, ...rest]} as unknown as Account;
}
const OWN: Conn = {org: 'own', guest: false, mailbox: true, level: 'full'};
const C1: Conn = {org: 'c1', guest: true, mailbox: false, level: 'read'};
const C2: Conn = {org: 'c2', guest: true, mailbox: false, level: 'read'};

const soon = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const base = {schema_version: 1 as const, attempt_id: '20261127T091500.000000001', relogin: false};
const DEVICE = {...base, state: 'device_code', login_phase: 'files', provider: 'microsoft', verification_uri: 'https://login.microsoft.com/device', user_code: 'R4TW9KQ2M', expires_at: soon(15)} as LoginView;
const COMPLETED = {...base, state: 'completed', provider: 'microsoft', address: ADDRESS} as LoginView;

// ---------- Shared pieces ----------
let toastSink: (m: string) => void = () => {};
const orgOf = (orgs: Org[], id: string) => orgs.find((o) => o.id === id) ?? ORGS0.find((o) => o.id === id)!;

/** A node created inside production DOM for a portal; `where` places it. */
function useSlot(host: RefObject<HTMLElement | null> | null, selector: string, where: 'append' | 'prepend' | 'after' | 'before', dep: unknown = 0) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let node: HTMLElement | null = null;
    let tries = 0;
    let timer = 0;
    const place = () => {
      const root: ParentNode | null = host ? host.current : document;
      const target = root?.querySelector(selector) as HTMLElement | null;
      if (!target) { if (tries++ < 30) timer = window.setTimeout(place, 16); return; }
      node = document.createElement('div');
      node.className = 'rq-slot';
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

function CopyButton({value, label, testId}: {value: string; label: string; testId: string}) {
  return (
    <Button data-testid={testId} size="row" variant="secondary" onPress={() => { void navigator.clipboard?.writeText(value).catch(() => {}); toastSink(T.copied); }}>
      <Icon name="copy" /> {label}
    </Button>
  );
}

function Limit({open: start = false}: {open?: boolean}) {
  const [open, setOpen] = useState(start);
  return (
    <div className="rq-limit" data-testid="rq-limit">
      <p className="rq-limitline"><Icon name="shield" /><span>{T.limitShort}</span></p>
      {open ? (
        <div className="rq-limitbody" data-testid="rq-limit-body">
          <p className="rq-limittitle"><strong>{T.limitTitle}</strong></p>
          {T.limit.map((l) => <p key={l}>{l}</p>)}
        </div>
      ) : (
        <button type="button" className="ig-link rq-linkbtn" data-testid="rq-limit-more" onClick={() => setOpen(true)}>{T.limitMore}</button>
      )}
    </div>
  );
}

function ConsentBody({org}: {org: Org}) {
  const links = LEVELS.map((l) => ({level: T.levelShort[l], says: T.levelSays[l], url: consentUrl(org.tenant, l)}));
  const message = T.message({org: org.label, publisher: PUBLISHER, links});
  return (
    <div className="rq-consent" data-testid="rq-consent" data-org={org.id}>
      <p>{T.consentLead(org.label)}</p>
      <p className="si-quiet rq-note" data-testid="rq-consent-unknown"><Icon name="info" /><span>{org.own ? T.consentOwn : T.consentUnknown}</span></p>
      <h3 className="rq-h3">{T.levelLinks}</h3>
      <ul className="rq-levels">
        {LEVELS.map((l) => (
          <li key={l} data-testid={`rq-link-${l}`}>
            <div className="rq-levelhead"><strong>{T.levelShort[l]}</strong><span className="si-quiet">{T.levelSays[l]}</span></div>
            <div className="rq-linkrow"><code>{consentUrl(org.tenant, l)}</code><Copy value={consentUrl(org.tenant, l)} label={T.linkCopy(T.levelShort[l])} /></div>
          </li>
        ))}
      </ul>
      {!org.own && (
        <>
          <h3 className="rq-h3">{T.messageTitle}</h3>
          <pre className="rq-message" data-testid="rq-message">{message}</pre>
          <div className="rq-acts"><CopyButton testId="rq-message-copy" value={message} label={T.messageCopy} /></div>
        </>
      )}
      <p className="si-quiet rq-note"><Icon name="user" /><span>{T.role}</span></p>
    </div>
  );
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function AddForm({orgs, onAdd, onCancel}: {orgs: Org[]; onAdd: (o: Org) => void; onCancel: () => void}) {
  const [label, setLabel] = useState('');
  const [tenant, setTenant] = useState('');
  const [tried, setTried] = useState(false);
  const dup = orgs.find((o) => o.tenant.toLowerCase() === tenant.trim().toLowerCase());
  const labelErr = tried && (label.trim().length < 1 || label.trim().length > 64) ? T.errLabel : undefined;
  const tenantErr = tried ? (!GUID.test(tenant.trim()) ? T.errTenant : dup ? T.errDuplicate(dup.label) : undefined) : undefined;
  return (
    <div className="rq-add" data-testid="rq-add">
      <p>{T.addLead}</p>
      <TextField data-testid="rq-add-label" name="organisation-label" label={T.labelField} value={label} onChange={setLabel} hint={T.labelHint} error={labelErr} />
      <TextField data-testid="rq-add-tenant" name="organisation-tenant" label={T.tenantField} value={tenant} onChange={setTenant} hint={T.tenantHint} error={tenantErr} mono />
      <div className="si-foot">
        <span className="si-grow" />
        <Button size="row" variant="secondary" onPress={onCancel}>{T.cancel}</Button>
        <Button data-testid="rq-add-save" size="page" variant="primary" onPress={() => {
          setTried(true);
          const l = label.trim(), t = tenant.trim();
          if (l.length < 1 || l.length > 64 || !GUID.test(t) || orgs.some((o) => o.tenant.toLowerCase() === t.toLowerCase())) return;
          onAdd({id: `n${Date.now()}`, label: l, tenant: t.toLowerCase(), by: 'yllapitaja', at: '27.11.2026'});
        }}>{T.addSave}</Button>
      </div>
    </div>
  );
}

function RemoveDialog({org, onConfirm, onClose}: {org: Org; onConfirm: () => void; onClose: () => void}) {
  return (
    <Modalish testId="rq-remove" title={T.removeTitle(org.label)} onClose={onClose}>
      <div className="si-stepbody">
        <ul className="rq-list">{T.removeDoes.map((f, i) => <li key={i}>{f(org.label)}</li>)}</ul>
        {org.own && <p className="si-warn" data-testid="rq-remove-own"><Icon name="warning" /><span>{T.removeOwn}</span></p>}
        <p className="si-quiet rq-note"><Icon name="shield" /><span>{T.removeLimit}</span></p>
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        <Button size="row" variant="secondary" onPress={onClose}>{T.cancel}</Button>
        <Button data-testid="rq-remove-confirm" size="page" variant="danger" onPress={onConfirm}>{T.removeConfirm}</Button>
      </div>
    </Modalish>
  );
}

/** The guide's first choice and, for several organisations, the points
 * that differ from today's walk. "Own organisation only" hands over to
 * production's MicrosoftLevelsDialog unchanged (the row's own button). */
function GuideDialog({onOne, onClose, onSaved}: {onOne: () => void; onClose: () => void; onSaved: () => void}) {
  const [who, setWho] = useState<'one' | 'many' | undefined>();
  const [at, setAt] = useState(0);
  const [ownLabel, setOwnLabel] = useState(PUBLISHER);
  const ids = ['who', 'accounts', 'publisher', 'same', 'save'];
  const titles = [T.whoTitle, T.stepAccounts, T.stepPublisher, T.stepSame, T.stepSave];
  return (
    <Modalish testId="rq-guide" title={T.guideTitle} size="wide" onClose={onClose}>
      <Progress ids={ids} at={at} title={titles[at]} />
      <div className="si-stepbody" data-testid={`rq-step-${ids[at]}`}>
        {at === 0 && (
          <>
            <p>{T.whoLead}</p>
            <div className="rq-choices" role="radiogroup" aria-label={T.whoTitle}>
              {(['one', 'many'] as const).map((w) => (
                <label key={w} className="rq-choice" data-testid={`rq-who-${w}`} data-checked={who === w || undefined}>
                  <input type="radio" name="who" checked={who === w} onChange={() => setWho(w)} />
                  <span><strong>{w === 'one' ? T.whoOne : T.whoMany}</strong><span className="si-quiet">{w === 'one' ? T.whoOneSub : T.whoManySub}</span></span>
                </label>
              ))}
            </div>
            {who === 'many' && <p className="si-quiet">{T.whoManyNote}</p>}
          </>
        )}
        {at === 1 && (
          <>
            <p>{T.accountsAct}</p>
            <Val k="Supported account types" v={T.accountsValue} copy={false} />
            <p className="si-warn"><Icon name="warning" /><span>{T.accountsNot}</span></p>
            <p className="si-quiet">{T.accountsWording}</p>
          </>
        )}
        {at === 2 && (
          <>
            <p>{T.publisherLead}</p>
            <Val k="Name" v={`${PUBLISHER.replace(' Oy', '')} · Habitat · ${T.levelShort.full}`} />
            <figure className="rq-mock" data-testid="rq-publisher-mock">
              <div className="rq-mockcard">
                <span className="si-quiet">{T.publisherName}</span>
                <strong>{`${PUBLISHER.replace(' Oy', '')} · Habitat · ${T.levelShort.full}`}</strong>
                <span className="si-quiet">{T.publisherBy}</span>
                <span className="rq-pub">{PUBLISHER} <Badge label={T.publisherUnverified} tone="warning" /></span>
              </div>
              <figcaption className="si-quiet">{lang === 'fi' ? 'Kuvitus, ei Microsoftin oikea näkymä.' : 'Illustration, not Microsoft’s actual page.'}</figcaption>
            </figure>
            <p className="si-quiet">{T.publisherVerify}</p>
          </>
        )}
        {at === 3 && <ul className="rq-list">{T.sameList.map((x) => <li key={x}>{x}</li>)}</ul>}
        {at === 4 && (
          <>
            <p>{T.saveLead}</p>
            <ul className="rq-list">{T.saveWhat.map((x) => <li key={x}>{x}</li>)}</ul>
            <TextField data-testid="rq-own-label" name="own-label" label={T.ownLabel} value={ownLabel} onChange={setOwnLabel} hint={T.labelHint} />
            <div className="rq-box" data-testid="rq-shortcut">
              <p><strong>{T.shortcutTitle}</strong></p>
              <p className="si-quiet">{T.shortcut}</p>
            </div>
          </>
        )}
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        {at > 0 && <Button size="row" variant="secondary" onPress={() => setAt(at - 1)}>{T.back}</Button>}
        {at === 4
          ? <Button data-testid="rq-guide-save" size="page" variant="primary" onPress={onSaved}>{T.save}</Button>
          : <Button data-testid="rq-guide-next" size="page" variant="primary" isDisabled={at === 0 && !who} onPress={() => (at === 0 && who === 'one' ? onOne() : setAt(at + 1))}>{T.next}</Button>}
      </div>
    </Modalish>
  );
}

// ---------- Administrator ----------
type AOpen = null | {k: 'guide'} | {k: 'add'} | {k: 'consent'; id: string} | {k: 'remove'; id: string} | {k: 'orgs'; id?: string; add?: boolean};

function adminInitial(d: number, s: S): AOpen {
  if (s === 'opas') return {k: 'guide'};
  if (s === 'lisaa') return d === 3 ? {k: 'orgs', add: true} : {k: 'add'};
  if (s === 'hyvaksynta') return d === 3 ? {k: 'orgs', id: 'c1'} : {k: 'consent', id: 'c1'};
  if (s === 'poisto') return {k: 'remove', id: 'c1'};
  return null;
}

function OrgActions({o, onOpen}: {o: Org; onOpen: (x: AOpen) => void}) {
  return (
    <span className="rq-rowacts">
      <button type="button" className="ig-link rq-linkbtn" data-testid={`rq-consent-open-${o.id}`} onClick={() => onOpen({k: 'consent', id: o.id})}>{T.consentOpen}</button>
      <button type="button" className="ig-link rq-linkbtn" data-testid={`rq-remove-open-${o.id}`} onClick={() => onOpen({k: 'remove', id: o.id})}>{T.removeOpen}</button>
    </span>
  );
}

function OrgName({o}: {o: Org}) {
  return <span className="rq-orgname"><strong>{o.label}</strong>{o.own && <Badge label={T.own} tone="neutral" />}</span>;
}

/** A: the list inside the Microsoft row. */
function RowListA({orgs, onOpen}: {orgs: Org[]; onOpen: (x: AOpen) => void}) {
  return (
    <span className="rq-rowline" data-testid="rq-rowline" data-count={orgs.length}>
      <span className="rq-rowtitle">{T.orgsTitle}</span>
      <ul className="rq-inrow" data-testid="rq-orgs">
        {orgs.map((o) => (
          <li key={o.id} data-testid={`rq-org-${o.id}`}>
            <OrgName o={o} />
            <code className="rq-guid">{o.tenant}</code>
            <OrgActions o={o} onOpen={onOpen} />
          </li>
        ))}
      </ul>
      <span><button type="button" className="ig-link rq-linkbtn" data-testid="rq-add-open" onClick={() => onOpen({k: 'add'})}><Icon name="plus" /> {T.addOrg}</button></span>
      <span className="si-quiet">{T.labelsPublic}</span>
      <Limit />
    </span>
  );
}

/** B: the organisations' own section under the rows. */
function SectionB({orgs, onOpen}: {orgs: Org[]; onOpen: (x: AOpen) => void}) {
  return (
    <section className="rq-section" id="rq-orgs-section" data-testid="rq-orgs-section">
      <h2 className="s-h3 rq-sectionh">{T.msGroup}: {T.orgsTitle}</h2>
      <SectionLead>{T.orgsLead}</SectionLead>
      <SectionCard testId="rq-orgs">
        <PeopleList columns={[T.colOrg, T.colTenant, T.colAdded]} actions>
          {orgs.map((o) => (
            <PeopleRow key={o.id} testId={`rq-org-${o.id}`} name={<OrgName o={o} />}
              cells={[<code key="t" className="rq-guid">{o.tenant}</code>, <span key="a" className="si-quiet">{T.added(o.by, o.at)}</span>]}
              end={<OrgActions o={o} onOpen={onOpen} />} />
          ))}
        </PeopleList>
        <div className="s-row rq-addrow">
          <Button data-testid="rq-add-open" size="row" variant="secondary" onPress={() => onOpen({k: 'add'})}><Icon name="plus" /> {T.addOrg}</Button>
          <span className="si-quiet">{T.labelsPublic}</span>
        </div>
      </SectionCard>
      <SectionCard testId="rq-limit-card">
        <div className="rq-limitcard">
          <p className="rq-limittitle"><Icon name="shield" /><strong>{T.limitTitle}</strong></p>
          {T.limit.map((l) => <p key={l}>{l}</p>)}
        </div>
      </SectionCard>
    </section>
  );
}

/** C: one dialog for the list, adding and consent. */
function OrgsDialog({orgs, start, add: startAdd, onAdd, onRemove, onClose}: {orgs: Org[]; start?: string; add?: boolean; onAdd: (o: Org) => void; onRemove: (id: string) => void; onClose: () => void}) {
  const [id, setId] = useState<string | undefined>(start);
  const [adding, setAdding] = useState(Boolean(startAdd));
  const org = orgs.find((o) => o.id === id);
  return (
    <Modalish testId="rq-orgs-dialog" title={`${T.msGroup}: ${T.orgsTitle}`} size="wide" onClose={onClose}>
      <div className="si-stepbody rq-split">
        <div className="rq-master">
          <p className="si-quiet">{T.orgsLead}</p>
          <ul className="rq-pick" data-testid="rq-orgs">
            {orgs.map((o) => (
              <li key={o.id}>
                <button type="button" data-testid={`rq-org-${o.id}`} aria-current={!adding && id === o.id ? 'true' : undefined} onClick={() => { setAdding(false); setId(o.id); }}>
                  <OrgName o={o} /><code className="rq-guid">{o.tenant}</code>
                </button>
              </li>
            ))}
          </ul>
          <Button data-testid="rq-add-open" size="row" variant="secondary" onPress={() => setAdding(true)}><Icon name="plus" /> {T.addOrg}</Button>
          <p className="si-quiet">{T.labelsPublic}</p>
          <Limit />
        </div>
        <div className="rq-detail">
          {adding ? (
            <>
              <h3 className="rq-h3">{T.addTitle}</h3>
              <AddForm orgs={orgs} onCancel={() => setAdding(false)} onAdd={(o) => { onAdd(o); setAdding(false); setId(o.id); }} />
            </>
          ) : org ? (
            <>
              <h3 className="rq-h3">{T.consentTitle(org.label)}</h3>
              <ConsentBody org={org} />
              <div className="rq-acts"><Button data-testid={`rq-remove-open-${org.id}`} size="row" variant="quiet" onPress={() => onRemove(org.id)}><Icon name="trash" /> {T.removeOpen}</Button></div>
            </>
          ) : <p className="si-quiet" data-testid="rq-none-chosen">{T.noneChosen}</p>}
        </div>
      </div>
      <div className="si-foot"><span className="si-grow" /><Button data-testid="rq-close" size="page" variant="primary" onPress={onClose}>{T.done}</Button></div>
    </Modalish>
  );
}

function RowLineB({orgs}: {orgs: Org[]}) {
  return (
    <span className="rq-rowline" data-testid="rq-rowline" data-count={orgs.length}>
      <span className="rq-rowhead"><Icon name="users" /> {T.orgsCount(orgs.length)}</span>
      <span><a className="ig-link" href="#rq-orgs-section" data-testid="rq-show-section" onClick={(e) => { e.preventDefault(); e.stopPropagation(); document.getElementById('rq-orgs-section')?.scrollIntoView({block: 'start'}); }}>{T.showSection}</a></span>
    </span>
  );
}
function RowLineC({orgs, onOpen}: {orgs: Org[]; onOpen: (x: AOpen) => void}) {
  return (
    <span className="rq-rowline" data-testid="rq-rowline" data-count={orgs.length}>
      <span className="si-quiet">{T.orgsNames(orgs.map((o) => o.label).join(', '))}</span>
      <span><Button data-testid="rq-orgs-open" size="row" variant="secondary" onPress={() => onOpen({k: 'orgs'})}><Icon name="users" /> {T.orgsDialogOpen}</Button></span>
    </span>
  );
}

function AdminPage({d, s}: {d: number; s: S}) {
  const [orgs, setOrgs] = useState<Org[]>(ORGS0);
  const [open, setOpen] = useState<AOpen>(adminInitial(d, s));
  const [behind, setBehind] = useState<AOpen>(null);
  const page = useRef<HTMLDivElement>(null);
  const slot = useSlot(page, '[data-testid="si-row-microsoft"] .si-main', 'append');
  const add = (o: Org) => { setOrgs((x) => [...x, o]); toastSink(T.addedToast(o.label)); };
  const remove = (id: string) => { const o = orgOf(orgs, id); setOrgs((x) => x.filter((y) => y.id !== id)); toastSink(T.removedToast(o.label)); };
  const openOne = () => {
    setOpen(null);
    (page.current?.querySelector('[data-testid="si-setup-microsoft"]') as HTMLElement | null)?.click();
  };
  return (
    <div className="rq-page" data-testid="rq-page" data-side="admin" ref={page}>
      <p className="rq-kicker">{T.adminKicker}</p>
      <h1 className="rq-h">{T.adminTitle}</h1>
      <ServerIntegrations providers={SERVER_PROVIDERS} apps={APPS} steps={['google', 'microsoft']} names={{'51234000': 'yllapitaja'}}
        onboardingHref="#kayttoonotto" onSave={async () => ({kind: 'changed', view: APPS}) as never}
        onRemove={() => toastSink(T.notInRound)} onRefresh={() => {}} />
      {d > 0 && slot && createPortal(
        d === 1 ? <RowListA orgs={orgs} onOpen={setOpen} /> : d === 2 ? <RowLineB orgs={orgs} /> : <RowLineC orgs={orgs} onOpen={setOpen} />, slot)}
      {d === 2 && <SectionB orgs={orgs} onOpen={setOpen} />}
      {d > 0 && (
        <p className="rq-guide-entry">
          <button type="button" className="ig-link rq-linkbtn" data-testid="rq-guide-open" onClick={() => setOpen({k: 'guide'})}>
            {lang === 'fi' ? 'Avaa sovellusten luonti alusta (kierroksen oikopolku)' : 'Open app creation from the start (round shortcut)'}
          </button>
        </p>
      )}
      {open?.k === 'guide' && <GuideDialog onOne={openOne} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); toastSink(T.savedToast); }} />}
      {open?.k === 'add' && (
        <Modalish testId="rq-add-dialog" title={T.addTitle} onClose={() => setOpen(null)}>
          <div className="si-stepbody"><AddForm orgs={orgs} onCancel={() => setOpen(null)} onAdd={(o) => { add(o); setOpen({k: 'consent', id: o.id}); }} /></div>
        </Modalish>
      )}
      {open?.k === 'consent' && (() => {
        const o = orgOf(orgs, open.id);
        return (
          <Modalish testId="rq-consent-dialog" title={T.consentTitle(o.label)} size="wide" onClose={() => setOpen(null)}>
            <div className="si-stepbody"><ConsentBody org={o} /></div>
            <div className="si-foot"><span className="si-grow" /><Button data-testid="rq-close" size="page" variant="primary" onPress={() => setOpen(null)}>{T.done}</Button></div>
          </Modalish>
        );
      })()}
      {open?.k === 'orgs' && <OrgsDialog orgs={orgs} start={open.id} add={open.add} onAdd={add} onClose={() => setOpen(null)}
        onRemove={(id) => { setBehind(open); setOpen({k: 'remove', id}); }} />}
      {open?.k === 'remove' && (
        <RemoveDialog org={orgOf(orgs, open.id)} onClose={() => { setOpen(behind); setBehind(null); }}
          onConfirm={() => { remove(open.id); setOpen(behind ? {k: 'orgs'} : null); setBehind(null); }} />
      )}
    </div>
  );
}

// ---------- Person ----------
type Refusal = 'consent_required' | 'not_in_organisation' | 'device_code_blocked' | 'organisation_unavailable' | 'expired';
type POpen = null | {k: 'org'} | {k: 'level'; org: string} | {k: 'device'; org: string} | {k: 'done'; org: string; mailbox: boolean} | {k: 'refused'; org: string; code: Refusal};

function RefusalBody({code, org, level = 'read'}: {code: Refusal; org: Org; level?: LevelId}) {
  const R = T.refusals;
  const url = consentUrl(org.tenant, level);
  if (code === 'consent_required') {
    const ask = R.consent_required.ask(org.label, T.levelShort[level], url);
    return (
      <div className="rq-refusal" data-testid="rq-refusal-consent_required">
        <p className="ig-result bad" role="alert"><Icon name="warning" /><span>{R.consent_required.lead(org.label, T.levelShort[level])}</span></p>
        <p className="ig-p">{R.consent_required.body}</p>
        <div className="rq-linkrow"><code>{url}</code><Copy value={url} label={T.consentLinkLabel} /></div>
        <div className="rq-acts"><CopyButton testId="rq-ask-copy" value={ask} label={R.consent_required.askCopy} /></div>
        <p className="ig-p si-quiet">{R.consent_required.after}</p>
      </div>
    );
  }
  if (code === 'expired') {
    return (
      <div className="rq-refusal" data-testid="rq-refusal-expired">
        <p className="ig-result bad" role="alert"><Icon name="warning" /><span>{R.expired.lead}</span></p>
        <p className="ig-p">{R.expired.body}</p>
        {!org.own && (
          <>
            <p className="ig-p" data-testid="rq-expired-client">{R.expired.client}</p>
            <div className="rq-linkrow"><code>{url}</code><Copy value={url} label={T.consentLinkLabel} /></div>
          </>
        )}
      </div>
    );
  }
  const r = R[code];
  return (
    <div className="rq-refusal" data-testid={`rq-refusal-${code}`}>
      <p className="ig-result bad" role="alert"><Icon name="warning" /><span>{r.lead(org.label)}</span></p>
      <p className="ig-p">{r.body}</p>
    </div>
  );
}

/** The connect dialog's frame, for the steps production does not have. */
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

function OrgStep({orgs, conns, onPick, onClose}: {orgs: Org[]; conns: Conn[]; onPick: (id: string) => void; onClose: () => void}) {
  const [id, setId] = useState<string | undefined>();
  const option = (o: Org) => {
    const c = conns.find((x) => x.org === o.id);
    return (
      <label key={o.id} className="rq-choice" data-testid={`rq-pick-${o.id}`} data-checked={id === o.id || undefined}>
        <input type="radio" name="organisation" checked={id === o.id} onChange={() => setId(o.id)} />
        <span><strong>{o.label}</strong>{c && <span className="si-quiet">{T.orgConnected(ADDRESS)}</span>}</span>
      </label>
    );
  };
  return (
    <Frame testId="rq-org-step" onClose={onClose}>
      <h3 className="rq-h3">{T.orgStepTitle}</h3>
      <p className="ig-p">{T.orgStepLead}</p>
      <div className="rq-choices" role="radiogroup" aria-label={T.orgStepTitle}>
        <p className="ig-meta rq-group">{T.orgOwnGroup}</p>
        {orgs.filter((o) => o.own).map(option)}
        <p className="ig-meta rq-group">{T.orgClientGroup}</p>
        {orgs.filter((o) => !o.own).map(option)}
        <p className="si-quiet rq-note"><Icon name="info" /><span>{T.orgGuestHint}</span></p>
      </div>
      <div className="ig-row">
        <Button size="page" variant="secondary" onPress={onClose}>{T.cancel}</Button>
        <Button data-testid="rq-org-continue" size="page" variant="primary" isDisabled={!id} onPress={() => id && onPick(id)}>{T.orgContinue}</Button>
      </div>
    </Frame>
  );
}

/** Production's connect dialog with the organisation line in its flow. */
function Connect({d, open, org, onOpen, onDone, onClose}: {d: number; open: POpen & {org: string}; org: Org; onOpen: (o: POpen) => void; onDone: (c: Conn) => void; onClose: () => void}) {
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
        <div className="rq-orgline" data-testid="rq-orgline" data-org={org.id}>
          <p className="rq-orgchosen"><Icon name="users" /><strong>{open.k === 'device' ? T.deviceOrg(org.label) : T.orgChosen(org.label)}</strong>
            {open.k === 'level' && d === 1 && <button type="button" className="ig-link rq-linkbtn" data-testid="rq-org-change" onClick={() => onOpen({k: 'org'})}>{T.orgChange}</button>}
          </p>
          {!org.own && open.k !== 'done' && <p className="ig-meta">{T.orgGuestLine}</p>}
          {!org.own && open.k === 'level' && <p className="ig-meta">{T.orgUnknownLevels}</p>}
          {open.k === 'done' && !open.mailbox && <p className="ig-notice" role="status" data-testid="rq-guest-files"><Icon name="info" /><span>{T.guestFiles(org.label)}</span></p>}
        </div>, top)}
      {end && open.k === 'device' && createPortal(
        <div className="rq-sim" data-testid="rq-sim">
          <span className="si-quiet">{T.simTitle}</span>
          {org.own && <Button data-testid="rq-sim-ok" size="row" variant="secondary" onPress={() => onOpen({k: 'done', org: org.id, mailbox: true})}>{T.simDone}</Button>}
          {!org.own && <Button data-testid="rq-sim-guest" size="row" variant="secondary" onPress={() => onOpen({k: 'done', org: org.id, mailbox: false})}>{T.simDoneGuest}</Button>}
          {(['consent_required', 'not_in_organisation', 'device_code_blocked', 'expired'] as Refusal[]).map((c) => (
            <Button key={c} data-testid={`rq-sim-${c}`} size="row" variant="quiet" onPress={() => onOpen({k: 'refused', org: org.id, code: c})}>{T.simRefuse}: <code>{c}</code></Button>
          ))}
        </div>, end)}
    </>
  );
}

const SERVICE_OFF = (): [string, 'mail' | 'calendar' | 'contacts'][] => [[T.svcMail, 'mail'], [T.svcCalendar, 'calendar'], [T.svcContacts, 'contacts']];

/** Production's AccountCard with the organisation under the address, the
 * guest's services that do not exist, and a refusal on the card. */
function OrgCard({c, orgs}: {c: Conn; orgs: Org[]}) {
  const wrap = useRef<HTMLDivElement>(null);
  const head = useSlot(wrap, '.ig-acc > div', 'append');
  const after = useSlot(wrap, '.ig-acc', 'after');
  const tail = useSlot(wrap, 'article', 'append');
  const org = orgOf(orgs, c.org);
  const R = T.refusals;
  return (
    <div ref={wrap} className="rq-cardwrap" data-testid={`rq-card-${c.org}`} data-guest={c.guest || undefined} data-mailbox={c.mailbox || undefined} data-problem={c.problem}>
      <AccountCard account={account(c)} checking={false} onCheck={() => {}} onSignInAgain={() => toastSink(T.notInRound)} onChangeLevel={() => toastSink(T.notInRound)} onRemove={() => toastSink(T.notInRound)} />
      {head && createPortal(<span className="ig-meta rq-cardorg" data-testid="rq-cardorg">{T.cardOrg(org.label, org.own ? T.own.toLowerCase() : c.guest ? T.guest : T.member)}</span>, head)}
      {after && c.problem && createPortal(
        <p className="ig-notice" role="status" data-testid={`rq-card-problem-${c.problem}`}>
          <Icon name="warning" /><span><strong>{R[c.problem].lead(org.label)}</strong> {R[c.problem].body}</span>
        </p>, after)}
      {tail && !c.mailbox && createPortal(
        <>
          {SERVICE_OFF().map(([name, id]) => (
            <div key={id} className="ig-svc rq-off" data-testid={`rq-off-${id}`}>
              <span className="ig-ic sm"><Icon name={id} /></span>
              <div><span className="ig-rn">{name}</span><span className="ig-meta">{T.guestOff}</span></div>
            </div>
          ))}
          <p className="ig-meta rq-offnote">{T.guestOffNote(org.label)}</p>
        </>, tail)}
    </div>
  );
}

function personInitial(d: number, s: S): {conns: Conn[]; open: POpen; tab: string} {
  const conns = s === 'yhdistetty' ? [OWN, C1] : [OWN, C1];
  if (s === 'organisaatio') return {conns, open: d === 1 ? {k: 'org'} : {k: 'level', org: 'c2'}, tab: 'c2'};
  if (s === 'koodi') return {conns, open: {k: 'device', org: 'c2'}, tab: 'c2'};
  if (s === 'yhdistetty') return {conns, open: {k: 'done', org: 'c2', mailbox: false}, tab: 'c2'};
  return {conns, open: null, tab: 'own'};
}

function MsSection({d, orgs, conns, tab, setTab, onConnect}: {d: number; orgs: Org[]; conns: Conn[]; tab: string; setTab: (t: string) => void; onConnect: (org?: string) => void}) {
  if (d === 1) return (
    <section className="ig-provider rq-ms" data-testid="rq-ms" aria-label="Microsoft 365">
      {conns.map((c) => <OrgCard key={c.org} c={c} orgs={orgs} />)}
      <div className="ig-another"><Button data-testid="rq-connect-another" size="row" variant="quiet" onPress={() => onConnect()}><Icon name="plus" /> {T.connectAnotherOrg}</Button></div>
    </section>
  );
  if (d === 2) {
    const mine = conns.filter((c) => c.org === tab);
    const org = orgOf(orgs, tab);
    return (
      <section className="ig-provider rq-ms" data-testid="rq-ms" aria-label="Microsoft 365">
        <div className="rq-tabs" role="tablist" aria-label={`${T.msGroup}: ${T.tabsLabel}`} data-testid="rq-tabs">
          {orgs.map((o) => {
            const n = conns.filter((c) => c.org === o.id).length;
            return (
              <button key={o.id} type="button" role="tab" aria-selected={tab === o.id} data-testid={`rq-tab-${o.id}`} onClick={() => setTab(o.id)}>
                <span>{o.label}</span><span className="rq-tabn" aria-label={n ? T.orgConnected(ADDRESS) : T.rowNot}>{n ? <Icon name="check" /> : '–'}</span>
              </button>
            );
          })}
        </div>
        <div role="tabpanel" className="rq-tabpanel" data-testid="rq-tabpanel" data-org={tab}>
          {mine.map((c) => <OrgCard key={c.org} c={c} orgs={orgs} />)}
          {!mine.length && <p className="ig-meta" data-testid="rq-tab-empty">{T.tabEmpty(org.label)}</p>}
          {!mine.length && <div><Button data-testid="rq-connect-tab" size="row" variant="secondary" onPress={() => onConnect(tab)}><Icon name="plus" /> {T.connectOrg(org.label)}</Button></div>}
        </div>
      </section>
    );
  }
  return (
    <section className="ig-provider rq-ms" data-testid="rq-ms" aria-label="Microsoft 365">
      {orgs.map((o) => {
        const mine = conns.filter((c) => c.org === o.id);
        if (mine.length) return mine.map((c) => <OrgCard key={c.org} c={c} orgs={orgs} />);
        return (
          <article key={o.id} className="ig-card rq-orgrow" data-testid={`rq-row-${o.id}`}>
            <div className="ig-acc">
              <ProviderMark provider="microsoft" />
              <div><span className="ig-rn">Microsoft 365</span><span className="ig-meta rq-cardorg">{o.label}</span></div>
              <span className="ig-meta">{T.rowNot}</span>
              <Button data-testid={`rq-connect-row-${o.id}`} size="row" variant="secondary" onPress={() => onConnect(o.id)}>{T.connectShort}</Button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function PersonPage({d, s}: {d: number; s: S}) {
  const init = personInitial(d, s);
  const [conns, setConns] = useState<Conn[]>(init.conns);
  const [open, setOpen] = useState<POpen>(init.open);
  const [tab, setTab] = useState(init.tab);
  const page = useRef<HTMLDivElement>(null);
  const slot = useSlot(page, '.ig-provider', 'before');
  const orgs = ORGS0;
  const list: IntegrationList = {schema_version: 1, providers: [GOOGLE, MS, IMAP], skill: 'current', accounts: [googleAccount]} as IntegrationList;
  if (s === 'kiellot') return <Refusals d={d} />;
  const connect = (org?: string) => setOpen(org ? {k: 'level', org} : {k: 'org'});
  return (
    <div className="rq-page rq-person" data-testid="rq-page" data-side="person" data-d={d} ref={page}>
      <p className="rq-kicker">{T.personKicker}</p>
      <h1 className="rq-h">{T.personTitle}</h1>
      <IntegrationsOverview list={list} checking={new Set()} onCheck={() => {}} onConnect={(p) => (p.id === 'microsoft' ? connect(d === 2 ? tab : undefined) : toastSink(T.notInRound))}
        onSignInAgain={() => {}} onRemove={() => {}} onChangeLevel={() => {}} />
      {slot && createPortal(<MsSection d={d} orgs={orgs} conns={conns} tab={tab} setTab={setTab} onConnect={connect} />, slot)}
      {open?.k === 'org' && <OrgStep orgs={orgs} conns={conns} onClose={() => setOpen(null)} onPick={(id) => setOpen({k: 'level', org: id})} />}
      {(open?.k === 'level' || open?.k === 'device' || open?.k === 'done') && (
        <Connect key={open.k} d={d} open={open} org={orgOf(orgs, open.org)} onOpen={setOpen} onClose={() => setOpen(null)}
          onDone={(c) => { setConns((x) => [...x.filter((y) => y.org !== c.org), c]); setTab(c.org); setOpen(null); }} />
      )}
      {open?.k === 'refused' && (
        <Frame testId="rq-refused" onClose={() => setOpen(null)}>
          <p className="rq-orgchosen"><Icon name="users" /><strong>{T.orgChosen(orgOf(orgs, open.org).label)}</strong></p>
          <RefusalBody code={open.code} org={orgOf(orgs, open.org)} />
          <div className="ig-row">
            <Button size="page" variant="secondary" onPress={() => setOpen(null)}>{T.close}</Button>
            <Button data-testid="rq-restart" size="page" variant="primary" onPress={() => setOpen({k: 'level', org: open.org})}>{T.restart}</Button>
          </div>
        </Frame>
      )}
    </div>
  );
}

function Refusals({d}: {d: number}) {
  const [c1, c2] = [ORGS0[1], ORGS0[2]];
  const panels: [Refusal, Org][] = [['consent_required', c1], ['not_in_organisation', c2], ['device_code_blocked', c1], ['organisation_unavailable', c2], ['expired', c1]];
  return (
    <div className="rq-page rq-person" data-testid="rq-page" data-side="person" data-d={d}>
      <p className="rq-kicker">{T.personKicker} › {T.personTitle}</p>
      <h1 className="rq-h">{T.refusalsTitle}</h1>
      <p className="si-quiet">{T.refusalsLead}</p>
      <h2 className="rq-h2">{T.atConnect}</h2>
      <div className="rq-gallery">
        {panels.map(([code, org]) => (
          <section key={code} className="ah-dialog rq-inline" data-testid={`rq-panel-${code}`}>
            <div className="ig-dh"><ProviderMark provider="microsoft" small /><h3 className="rq-h3">{itx.titleConnect('Microsoft 365')}</h3><code className="rq-code">{code}</code></div>
            <p className="rq-orgchosen"><Icon name="users" /><strong>{T.orgChosen(org.label)}</strong></p>
            <RefusalBody code={code} org={org} />
          </section>
        ))}
      </div>
      <h2 className="rq-h2">{T.onCard}</h2>
      <div className="ig-provider rq-ms">
        <OrgCard c={{...C1, problem: 'consent_withdrawn'}} orgs={ORGS0} />
        <OrgCard c={{...C2, problem: 'guest_removed'}} orgs={ORGS0} />
        <OrgCard c={{...C1, problem: 'tenant_removed'}} orgs={ORGS0} />
      </div>
    </div>
  );
}

// ---------- Nyt ----------
function NowPerson() {
  const [stage, setStage] = useState<ConnectStage | null>(null);
  const own = account(OWN);
  const list: IntegrationList = {schema_version: 1, providers: [GOOGLE, MS, IMAP], skill: 'current', accounts: [googleAccount, own]} as IntegrationList;
  const end = useSlot(null, '[data-testid="integration-dialog"] .ig-flow', 'append', stage?.stage === 'login' ? (stage.view.state) : stage?.stage);
  return (
    <div className="rq-page rq-person" data-testid="rq-page" data-side="person" data-d={0}>
      <p className="rq-kicker">{T.personKicker}</p>
      <h1 className="rq-h">{T.personTitle}</h1>
      <IntegrationsOverview list={list} checking={new Set()} onCheck={() => {}} onConnect={(p) => (p.id === 'microsoft' ? setStage({stage: 'intro'}) : toastSink(T.notInRound))}
        onSignInAgain={() => {}} onRemove={() => {}} onChangeLevel={() => setStage({stage: 'intro', account: own})} />
      {stage && (
        <ConnectDialog provider={MS} stage={stage} accounts={list.accounts} onContinue={() => setStage({stage: 'login', view: DEVICE})}
          onPassword={() => {}} onPaste={() => {}} onFolders={() => {}} onRestart={() => setStage({stage: 'intro'})} onClose={() => setStage(null)} />
      )}
      {end && stage?.stage === 'login' && stage.view.state === 'device_code' && createPortal(
        <div className="rq-sim" data-testid="rq-sim"><span className="si-quiet">{T.simTitle}</span>
          <Button data-testid="rq-sim-ok" size="row" variant="secondary" onPress={() => setStage({stage: 'login', view: COMPLETED})}>{T.simDone}</Button></div>, end)}
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
const startS = params.get('s') ?? '';
function App({direction}: {direction: number}) {
  const valid = direction === 0 ? (NOW as readonly string[]) : [...ADMIN, ...PERSON];
  const [s, setS] = useState<string>(valid.includes(startS) ? startS : valid[0]);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState('');
  const bar = useRef<HTMLElement>(null);
  toastSink = setMessage;
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
  useEffect(() => { if (!message) return; const id = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(id); }, [message]);
  const relaunch = (key: string, value: string) => {
    const p = new URLSearchParams(location.search);
    p.set(key, value); p.set('v', String(direction + 1)); p.set('s', s);
    location.search = p.toString();
  };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>{T.title}</strong>
        <label>{T.scenario} <select id="scenario" data-testid="rq-scenario" value={s} onChange={(e) => { setS(e.target.value); setGeneration((g) => g + 1); }}>
          {direction === 0 ? NOW.map((id) => <option key={id} value={id}>{T.nowScenarios[id]}</option>) : (
            <>
              <optgroup label={T.sides.admin}>{ADMIN.map((id) => <option key={id} value={id}>{T.scenarios[id]}</option>)}</optgroup>
              <optgroup label={T.sides.person}>{PERSON.map((id) => <option key={id} value={id}>{T.scenarios[id]}</option>)}</optgroup>
            </>
          )}
        </select></label>
        <label>{T.language} <select data-testid="rq-lang" value={lang} onChange={(e) => relaunch('lang', e.target.value)}>
          <option value="fi">suomi</option><option value="en">English</option></select></label>
        <label>{T.theme} <select data-testid="rq-theme" value={params.get('theme') === 'dark' ? 'dark' : 'light'} onChange={(e) => relaunch('theme', e.target.value)}>
          <option value="light">{T.themes.light}</option><option value="dark">{T.themes.dark}</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => setGeneration((g) => g + 1)}>{T.reset}</button>
        <p className="rq-round" data-testid="round-line">{T.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {T.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        {direction === 0
          ? (s === 'henkilo' ? <NowPerson key={generation} /> : <NowAdmin key={generation} />)
          : isPerson(s) ? <PersonPage key={`${generation}-${s}`} d={direction} s={s as S} /> : <AdminPage key={`${generation}-${s}`} d={direction} s={s as S} />}
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
