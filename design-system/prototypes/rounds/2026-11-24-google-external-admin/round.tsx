import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Badge} from '../../../../web/src/components/Status';
import {Copy, Modalish, Path, Progress} from '../../../../web/src/components/GuideParts';
import {GoogleAudienceDialog, GoogleShot, googleAuth, workspaceStep} from '../../../../web/src/components/GoogleGuide';
import {GoogleNote} from '../../../../web/src/components/GoogleConnectHelp';
import {ServerIntegrations} from '../../../../web/src/components/ServerIntegrations';
import type {Provider} from '../../../../web/src/app/integrations';
import type {IntegrationApps} from '../../../../web/src/app/serverIntegrations';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/ServerIntegrations.css';
import '../../../../web/src/components/GoogleGuide.css';
import '../../../../web/src/components/ShotBand.css';
import '../../../../web/src/components/Integrations.css';
import '../../../../web/src/components/GoogleConnectHelp.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {type CaseId, type Gs, T} from './text';
import './round.css';

// Palvelimen ylläpito › Integraatiot › Google, for an installation whose
// Google app may be Internal, External in Testing or External in
// production. Nyt is the shipped flows captured from the synthetic lab
// (embedded by build.mjs, not committed). The directions keep production's
// ServerIntegrations page unchanged and add one line under the Google row
// (a portal into the row's name cell) and their own dialogs, built from
// production pieces (Modalish, Progress, Path, Copy, Segmented, Badge,
// GoogleShot, workspaceStep, GoogleAudienceDialog, GoogleNote). The axis is
// where the knowledge of Google's audience comes from: asked each time (A),
// declared and stored by the administrator (B), or read from the
// administrator's own test connection (C). Everything is synthetic.

setPersonalLanguage('fi');
const params = new URLSearchParams(location.search);
const SCENARIOS = ['rivi', 'julkaisu', 'org-internal', 'testing', 'uusi-henkilo', 'henkilo'] as const;
type S = typeof SCENARIOS[number];
let scenario: S = (SCENARIOS as readonly string[]).includes(params.get('s') ?? '') ? params.get('s') as S : 'rivi';
const NAMES = ['Nyt', 'A', 'B', 'C'];
const CLIENT = '915508263417-a8d2kq0zr7m3vh1ts9pe5wybc6lfnjxu.apps.googleusercontent.com';
const CASES: CaseId[] = ['org_internal', 'access_denied', 'expired', 'admin_policy', 'cap', 'rate', 'warning'];

// ---------- Synthetic host ----------
const prov = (id: Provider['id'], available: boolean, extra: Partial<Provider> = {}): Provider =>
  ({id, available, login: 'app_password', services: ['mail'], ...extra}) as Provider;
const PROVIDERS: Provider[] = [
  prov('google', true), prov('microsoft', false, {unavailable_reason: 'app_credentials_required'} as Partial<Provider>),
  prov('apple', true), prov('imap', true), prov('caldav', true), prov('carddav', true),
  prov('dropbox', false, {unavailable_reason: 'app_credentials_required'} as Partial<Provider>),
];
const APPS: IntegrationApps = {schema_version: 1, browser_setup: true, apps: [
  {provider: 'google', client_id: CLIENT, usable: true, source: 'site_admin', actor: '51234000', at: '2026-09-02T12:00:00Z'},
]} as IntegrationApps;

// ---------- Shared pieces ----------

/** Google's audience asked in Google's own words; no default. */
function StateQuestion({value, onChange}: {value: Gs | null; onChange: (g: Gs) => void}) {
  const type = value === null ? undefined : value === 'internal' ? 'internal' : 'external';
  const [ext, setExt] = useState(type === 'external');
  return (
    <div className="rq-q" data-testid="rq-state-q">
      <Segmented data-testid="rq-usertype" label={T.a.userType} value={value === null && !ext ? undefined : ext ? 'external' : 'internal'}
        onChange={(v) => { if (v === 'internal') { setExt(false); onChange('internal'); } else setExt(true); }}
        options={[{id: 'internal', label: 'Internal'}, {id: 'external', label: 'External'}]} />
      {ext && (
        <Segmented data-testid="rq-publishing" label={T.a.publishing}
          value={value === 'testing' || value === 'production' ? value : undefined}
          onChange={(v) => onChange(v as Gs)}
          options={[{id: 'testing', label: 'Testing'}, {id: 'production', label: 'In production'}]} />
      )}
    </div>
  );
}

/** What a state means, with the new-person answer and the way out of Internal. */
function StateAnswer({g, onAllow, person = true}: {g: Gs; onAllow?: () => void; person?: boolean}) {
  return (
    <div className="rq-answer" data-testid="rq-answer" data-state={g}>
      <p className={g === 'production' ? 'gg-ok' : 'si-warn'}>
        <Icon name={g === 'production' ? 'check' : 'warning'} />
        <span><strong>{T.gs[g]}.</strong> {T.gsMeans[g]}</span>
      </p>
      {g === 'testing' && <p className="si-quiet">{T.publishNow.split('.')[0]}.</p>}
      {person && (
        <div className="gg-cap" data-testid="rq-new-person">
          <p><strong>{T.newPersonTitle}</strong></p>
          <p>{T.newPerson[g]}</p>
        </div>
      )}
      {g === 'internal' && onAllow && (
        <div><Button data-testid="rq-allow" size="row" variant="secondary" onPress={onAllow}>{T.allowPersonal}</Button></div>
      )}
    </div>
  );
}

/** One refusal case: cause, what the administrator does, and the message back. */
function CaseBody({id, onAllow}: {id: CaseId; onAllow: () => void}) {
  const c = T.cases[id];
  return (
    <div className="rq-case" data-testid={`rq-case-${id}`}>
      <p><strong>{T.cause}.</strong> {c.cause}</p>
      <p><strong>{T.fix}.</strong> {c.fix}</p>
      {id === 'org_internal' && <div><Button data-testid="rq-allow" size="row" variant="secondary" onPress={onAllow}>{T.allowPersonal}</Button></div>}
      {id === 'admin_policy' && <div className="rq-embed">{workspaceStep(CLIENT).body}</div>}
      <div className="si-handoff">
        <p className="si-side">{T.toPerson}</p>
        <div className="si-block"><pre className="si-cmd">{c.person}</pre><Copy value={c.person} label={T.toPerson} /></div>
      </div>
    </div>
  );
}

/** What Google said: the same list in every direction. */
function TroubleDialog({start, lead, onAllow, onClose}: {start?: CaseId; lead?: ReactNode; onAllow: () => void; onClose: () => void}) {
  const [open, setOpen] = useState<CaseId | undefined>(start);
  return (
    <Modalish testId="rq-trouble" title={T.troubleTitle} size="wide" onClose={onClose}>
      <div className="si-stepbody">
        {lead}
        <p>{T.troubleLead}</p>
        <ul className="gc-cases rq-cases">
          {CASES.map((id) => (
            <li key={id} className="gc-case">
              <button type="button" className="gc-case-head" data-testid={`rq-said-${id}`} aria-expanded={open === id} onClick={() => setOpen(open === id ? undefined : id)}>
                <Icon name={open === id ? 'down' : 'forward'} />
                <span><code>{T.cases[id].said}</code></span>
              </button>
              {open === id && <CaseBody id={id} onAllow={onAllow} />}
            </li>
          ))}
        </ul>
      </div>
      <div className="si-foot"><span className="si-grow" /><Button data-testid="rq-close" size="page" variant="primary" onPress={onClose}>{T.done}</Button></div>
    </Modalish>
  );
}

/** The guide's publishing step without a default, then the direction's end. */
function GuideDialog({d, onClose, onSaved}: {d: number; onClose: () => void; onSaved: (g: Gs) => void}) {
  const [publish, setPublish] = useState<'testing' | 'production' | undefined>();
  const [kept, setKept] = useState(false);
  const [at, setAt] = useState(4);
  const [g, setG] = useState<Gs | null>(null);
  const [tried, setTried] = useState<'ok' | 'stop' | undefined>();
  const ids = ['audience', 'apis', 'brand', 'scopes', 'publish', 'client', 'end'];
  const titles = ['', '', '', '', T.publishTitle, T.stepClient, d === 1 ? T.stepCheck : d === 3 ? T.stepTry : T.saved];
  const canNext = at === 4 ? publish === 'production' || (publish === 'testing' && kept) : true;
  const declared: Gs = publish === 'production' ? 'production' : 'testing';
  return (
    <Modalish testId="rq-guide" title={T.guideTitle} size="wide" onClose={onClose}>
      <Progress ids={ids} at={at} title={titles[at]} />
      <div className="si-stepbody" data-testid={`rq-step-${ids[at]}`}>
        {at === 4 && (
          <>
            <Path p="Google Auth platform › Audience" href={`${googleAuth}/audience`} />
            <Segmented data-testid="rq-publish" label={T.publishWhere} value={publish} onChange={(v) => { setPublish(v); setKept(false); }}
              options={[{id: 'testing', label: 'Testing'}, {id: 'production', label: 'In production'}]} />
            {!publish && <p className="si-quiet" data-testid="rq-publish-none">{T.publishNone}</p>}
            {publish === 'testing' && (
              <div className="gg-state" data-testid="rq-testing">
                <p className="si-warn"><Icon name="warning" /><span>{T.testingStop}</span></p>
                <GoogleShot name="audience" t="publish" alt="Kuvituskuva Audience-sivusta" caption="Kuvituskuva, ei Googlen oikea näkymä." />
                <p className="si-quiet">{T.publishNow}</p>
                {kept ? <p className="si-quiet" data-testid="rq-kept">{T.keptTesting}</p>
                  : <button type="button" className="ig-link gc-linkbtn" data-testid="rq-keep-testing" onClick={() => setKept(true)}>{T.keepTesting}</button>}
              </div>
            )}
            {publish === 'production' && <p className="gg-ok" data-testid="rq-production"><Icon name="check" /><span>{T.production}</span></p>}
            {d === 2 && publish && (
              <p className="si-effect" data-testid="rq-will-save">{T.b.willSave} <strong>{T.gs[declared]}</strong> <span className="gg-google">Google: <code>{T.gsGoogle[declared]}</code></span></p>
            )}
          </>
        )}
        {at === 5 && <p className="si-quiet">{T.clientFields}</p>}
        {at === 6 && d === 1 && (
          <>
            <p className="gg-ok"><Icon name="check" /><span>{T.saved}</span></p>
            <p>{T.a.afterSave}</p>
            <Path p="Google Auth platform › Audience" href={`${googleAuth}/audience`} />
            <StateQuestion value={g} onChange={setG} />
            {g ? <StateAnswer g={g} /> : <p className="si-quiet">{T.a.pickFirst}</p>}
          </>
        )}
        {at === 6 && d === 2 && (
          <>
            <p className="gg-ok" data-testid="rq-declared-saved"><Icon name="check" /><span>{T.b.declaredSaved}</span></p>
            <StateAnswer g={declared} />
            <p className="si-quiet">{T.b.stale}</p>
          </>
        )}
        {at === 6 && d === 3 && <TryBody tried={tried} setTried={setTried} onAllow={() => {}} />}
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        {at > 4 && <Button size="row" variant="secondary" onPress={() => setAt(at - 1)}>{T.back}</Button>}
        {at === 5 ? <Button data-testid="rq-save" size="page" variant="primary" onPress={() => { setAt(6); if (d === 2) onSaved(declared); }}>{T.save}</Button>
          : at === 6 ? <Button data-testid="rq-done" size="page" variant="primary" onPress={onClose}>{T.done}</Button>
          : <Button data-testid="rq-next" size="page" variant="primary" isDisabled={!canNext} onPress={() => setAt(at + 1)}>{T.next}</Button>}
      </div>
    </Modalish>
  );
}

/** C: the administrator's own test, with the outcome chosen in the round. */
function TryBody({tried, setTried, start, onAllow}: {tried?: 'ok' | 'stop'; setTried: (t: 'ok' | 'stop') => void; start?: CaseId; onAllow: () => void}) {
  const [none, setNone] = useState(false);
  const [g, setG] = useState<Gs | null>(null);
  const [open, setOpen] = useState<CaseId | undefined>(start);
  return (
    <div className="rq-try" data-testid="rq-try">
      <p>{T.c.tryLead}</p>
      <div><Button data-testid="rq-try-open" size="row" variant="secondary" onPress={() => {}}><Icon name="external" /> {T.c.open}</Button></div>
      <div className="rq-sim" data-testid="rq-sim">
        <span className="si-quiet">{T.c.sim}</span>
        <Button data-testid="rq-sim-ok" size="row" variant={tried === 'ok' ? 'primary' : 'secondary'} onPress={() => setTried('ok')}>{T.c.simOk}</Button>
        <Button data-testid="rq-sim-stop" size="row" variant={tried === 'stop' ? 'primary' : 'secondary'} onPress={() => setTried('stop')}>{T.c.simStop}</Button>
      </div>
      {tried === 'ok' && <p className="gg-ok" data-testid="rq-try-ok"><Icon name="check" /><span>{T.c.okResult}</span></p>}
      {tried === 'stop' && (
        <>
          <p><strong>{T.c.stopLead}</strong></p>
          <ul className="gc-cases rq-cases">
            {CASES.filter((c) => c !== 'expired').map((id) => (
              <li key={id} className="gc-case">
                <button type="button" className="gc-case-head" data-testid={`rq-said-${id}`} aria-expanded={open === id} onClick={() => setOpen(open === id ? undefined : id)}>
                  <Icon name={open === id ? 'down' : 'forward'} /><span><code>{T.cases[id].said}</code></span>
                </button>
                {open === id && <CaseBody id={id} onAllow={onAllow} />}
              </li>
            ))}
          </ul>
        </>
      )}
      {!tried && (
        none ? (
          <>
            <p className="si-quiet">{T.c.noPersonalBody}</p>
            <Path p="Google Auth platform › Audience" href={`${googleAuth}/audience`} />
            <StateQuestion value={g} onChange={setG} />
            {g && <StateAnswer g={g} onAllow={onAllow} />}
          </>
        ) : <button type="button" className="ig-link gc-linkbtn" data-testid="rq-no-personal" onClick={() => setNone(true)}>{T.c.noPersonal}</button>
      )}
    </div>
  );
}

// ---------- The page ----------

type Open = null | 'check' | 'declare' | 'trouble' | 'guide' | 'try' | 'audience' | 'person';
type Own = 'none' | 'stopped' | 'broke' | 'ok';

function initial(d: number, s: S) {
  const declared: Gs = s === 'testing' ? 'testing' : 'internal';
  const own: Own = s === 'org-internal' ? 'stopped' : s === 'testing' ? 'broke' : s === 'uusi-henkilo' ? 'ok' : 'none';
  let open: Open = null;
  let start: CaseId | undefined;
  if (s === 'julkaisu') open = 'guide';
  if (s === 'org-internal') { open = d === 3 ? 'try' : 'trouble'; start = 'org_internal'; }
  if (s === 'testing' && d === 1) { open = 'trouble'; start = 'expired'; }
  if (s === 'uusi-henkilo') open = d === 1 ? 'check' : d === 2 ? 'person' : null;
  return {declared, own, open, start};
}

function RowLine({d, declared, own, onOpen}: {d: number; declared: Gs; own: Own; onOpen: (o: Open) => void}) {
  if (d === 1) return (
    <span className="rq-rowline" data-testid="rq-rowline">
      <span className="si-quiet">{T.a.rowLine}</span>
      <button type="button" className="ig-link gc-linkbtn" data-testid="rq-check" onClick={() => onOpen('check')}>{T.a.check}</button>
      <button type="button" className="ig-link gc-linkbtn" data-testid="rq-trouble-open" onClick={() => onOpen('trouble')}>{T.troubleOpen}</button>
    </span>
  );
  if (d === 2) return (
    <span className="rq-rowline" data-testid="rq-rowline" data-declared={declared}>
      <span className="rq-rowhead">
        <Badge label={T.gs[declared]} tone={declared === 'production' ? 'success' : 'warning'} />
        <span className="si-quiet">{T.b.declared('2.9.2026')}</span>
      </span>
      <span className="rq-rowtext">{declared === 'internal' ? T.b.rowInternal : declared === 'testing' ? T.b.rowTesting : T.b.rowProduction}</span>
      <span className="rq-rowacts">
        <button type="button" className="ig-link gc-linkbtn" data-testid="rq-declare" onClick={() => onOpen('declare')}>{declared === 'testing' ? T.b.published : T.b.change}</button>
        <button type="button" className="ig-link gc-linkbtn" data-testid="rq-new-person-open" onClick={() => onOpen('person')}>{T.b.newPerson}</button>
        <button type="button" className="ig-link gc-linkbtn" data-testid="rq-trouble-open" onClick={() => onOpen('trouble')}>{T.troubleOpen}</button>
      </span>
    </span>
  );
  const text = own === 'ok' ? T.c.worked(T.c.ownAccount, 12) : own === 'stopped' ? T.c.stopped : own === 'broke' ? T.c.brokeSeven(T.c.ownAccount) : T.c.notTried;
  return (
    <span className="rq-rowline" data-testid="rq-rowline" data-own={own}>
      <span className={own === 'ok' ? 'rq-ok' : own === 'none' ? 'si-quiet' : 'rq-warnline'}>
        <Icon name={own === 'ok' ? 'check' : own === 'none' ? 'info' : 'warning'} /> {text}
      </span>
      {own === 'ok' && <span className="si-quiet">{T.c.workedNote} {T.newPerson.production}</span>}
      <span className="rq-rowacts">
        <button type="button" className="ig-link gc-linkbtn" data-testid="rq-try-row" onClick={() => onOpen('try')}>{T.c.tryOwn}</button>
        <button type="button" className="ig-link gc-linkbtn" data-testid="rq-trouble-open" onClick={() => onOpen(own === 'broke' ? 'trouble' : 'trouble')}>{T.troubleOpen}</button>
      </span>
    </span>
  );
}

function DeclareDialog({declared, onSave, onAllow, onClose}: {declared: Gs; onSave: (g: Gs) => void; onAllow: () => void; onClose: () => void}) {
  const [g, setG] = useState<Gs | null>(null);
  return (
    <Modalish testId="rq-declare-dialog" title={T.b.declareTitle} size="wide" onClose={onClose}>
      <div className="si-stepbody">
        <p>{T.b.declareLead}</p>
        <p className="si-quiet">{T.b.declared('2.9.2026')}: <strong>{T.gs[declared]}</strong> <span className="gg-google">Google: <code>{T.gsGoogle[declared]}</code></span></p>
        <Path p="Google Auth platform › Audience" href={`${googleAuth}/audience`} />
        <StateQuestion value={g} onChange={setG} />
        {g && <StateAnswer g={g} onAllow={onAllow} person={false} />}
        <p className="si-quiet">{T.b.unverified} {T.b.stale}</p>
      </div>
      <div className="si-foot"><span className="si-grow" />
        <Button size="row" variant="secondary" onPress={onClose}>{T.cancel}</Button>
        <Button data-testid="rq-declare-save" size="page" variant="primary" isDisabled={!g} onPress={() => { if (g) onSave(g); }}>{T.b.declareSave}</Button>
      </div>
    </Modalish>
  );
}

function Page({d, s, toast}: {d: number; s: S; toast: (m: string) => void}) {
  const init = initial(d, s);
  const [open, setOpen] = useState<Open>(init.open);
  const [declared, setDeclared] = useState<Gs>(init.declared);
  const [own, setOwn] = useState<Own>(init.own);
  const [g, setG] = useState<Gs | null>(null);
  const [tried, setTried] = useState<'ok' | 'stop' | undefined>(s === 'org-internal' ? 'stop' : undefined);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const page = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const main = page.current?.querySelector('[data-testid="si-row-google"] .si-main');
    if (!main) return;
    const el = document.createElement('span');
    el.className = 'rq-slot';
    main.append(el);
    setSlot(el);
    return () => el.remove();
  }, []);
  const allow = () => setOpen('audience');
  if (s === 'henkilo') return <PersonSketch d={d} />;
  return (
    <div className="rq-page" data-testid="rq-page" ref={page}>
      <p className="rq-kicker">{T.pageLead}</p>
      <h1 className="rq-h">{T.pageTitle}</h1>
      <ServerIntegrations providers={PROVIDERS} apps={APPS} steps={['google']} names={{'51234000': 'yllapitaja'}}
        onboardingHref="#kayttoonotto" onSave={async () => ({kind: 'changed', view: APPS}) as never}
        onRemove={() => toast('Poisto ei kuulu tähän kierrokseen.')} onRefresh={() => {}} />
      {slot && createPortal(<RowLine d={d} declared={declared} own={own} onOpen={setOpen} />, slot)}
      {open === 'guide' && <GuideDialog d={d} onClose={() => setOpen(null)} onSaved={setDeclared} />}
      {open === 'trouble' && (
        <TroubleDialog start={init.start ?? (d === 3 && own === 'broke' ? 'expired' : undefined)} onAllow={allow} onClose={() => setOpen(null)}
          lead={d === 2 ? <p className="si-effect" data-testid="rq-explains">{T.b.explains} <strong>{T.gs[declared]}</strong>. {T.gsMeans[declared]}</p> : undefined} />
      )}
      {open === 'check' && (
        <Modalish testId="rq-check-dialog" title={T.a.checkTitle} size="wide" onClose={() => setOpen(null)}>
          <div className="si-stepbody">
            <p>{T.a.checkLead}</p>
            <Path p="Google Auth platform › Audience" href={`${googleAuth}/audience`} />
            <StateQuestion value={g} onChange={setG} />
            {g ? <StateAnswer g={g} onAllow={allow} /> : <p className="si-quiet">{T.a.pickFirst}</p>}
          </div>
          <div className="si-foot"><span className="si-grow" /><Button data-testid="rq-close" size="page" variant="primary" onPress={() => setOpen(null)}>{T.done}</Button></div>
        </Modalish>
      )}
      {open === 'declare' && <DeclareDialog declared={declared} onAllow={allow} onClose={() => setOpen(null)} onSave={(x) => { setDeclared(x); setOpen(null); toast(T.b.declaredSaved); }} />}
      {open === 'person' && (
        <Modalish testId="rq-person-dialog" title={T.newPersonTitle} size="wide" onClose={() => setOpen(null)}>
          <div className="si-stepbody">
            <p className="si-quiet">{T.b.declared('2.9.2026')}: <strong>{T.gs[declared]}</strong></p>
            <StateAnswer g={declared} onAllow={allow} />
          </div>
          <div className="si-foot"><span className="si-grow" /><Button data-testid="rq-close" size="page" variant="primary" onPress={() => setOpen(null)}>{T.done}</Button></div>
        </Modalish>
      )}
      {open === 'try' && (
        <Modalish testId="rq-try-dialog" title={T.c.tryTitle} size="wide" onClose={() => setOpen(null)}>
          <div className="si-stepbody">
            <TryBody tried={tried} start={init.start} onAllow={allow} setTried={(t) => { setTried(t); setOwn(t === 'ok' ? 'ok' : 'stopped'); }} />
          </div>
          <div className="si-foot"><span className="si-grow" /><Button data-testid="rq-close" size="page" variant="primary" onPress={() => setOpen(null)}>{T.done}</Button></div>
        </Modalish>
      )}
      {open === 'audience' && (
        <GoogleAudienceDialog clientID={CLIENT} onClose={() => { setOpen(null); if (d === 2) setOpen('declare'); }} />
      )}
    </div>
  );
}

/** What each direction means on the person's side: production's note today
 * beside the direction's change. */
function PersonSketch({d}: {d: number}) {
  const lines = d === 1 ? T.p.a : d === 2 ? T.p.b : T.p.c;
  return (
    <div className="rq-page" data-testid="rq-page">
      <p className="rq-kicker">Asetukset › Tiedot agenteille</p>
      <h1 className="rq-h">{T.p.title}</h1>
      <p className="si-quiet">{T.p.lead}</p>
      <div className="rq-two" data-testid="rq-person">
        <section className="ah-dialog rq-card">
          <h2 className="rq-h2">{T.p.today}</h2>
          <GoogleNote authorizationUrl={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT}`} host="habitat.example.test" />
        </section>
        <section className="ah-dialog rq-card" data-testid="rq-person-change">
          <h2 className="rq-h2">{T.p.change}</h2>
          {d === 1 && (
            <div className="gc-panel">
              <p className="ig-meta gc-group">Google pysäytti</p>
              <ul className="gc-cases"><li className="gc-case"><span className="gc-case-head"><Icon name="down" /><span><code>{T.cases.org_internal.said}</code></span></span>
                <div className="rq-case"><p>Palvelimen Google-sovellus hyväksyy nyt vain organisaation tilit. Henkilökohtainen Gmail ei käy, ennen kuin ylläpitäjä sallii sen.</p>
                  <div className="si-block"><pre className="si-cmd">Hei! Yritin yhdistää Gmail-tilini Habitatiin, mutta Google sanoi "Pääsy estetty · org_internal". Voisitko sallia myös henkilökohtaiset tilit?</pre></div></div></li></ul>
            </div>
          )}
          {d === 2 && (
            <>
              <div className="ig-notice" role="note" data-testid="rq-person-declared">
                <Icon name="warning" />
                <div><strong>{T.p.bInternal}</strong><p className="ig-meta">{T.p.bInternalSub}</p></div>
              </div>
              <div className="rq-acts">
                <Button size="row" variant="secondary" onPress={() => {}}><Icon name="copy" /> {T.p.bAsk}</Button>
                <Button size="row" variant="quiet" onPress={() => {}}>{T.p.bContinue}</Button>
              </div>
            </>
          )}
          {d === 3 && (
            <>
              <div className="ig-notice" role="note"><Icon name="question" /><div><strong>{T.p.cOrphan}</strong><p className="ig-meta">{T.p.cOrphanSub}</p></div></div>
              <div className="ig-notice" role="note"><Icon name="warning" /><div>{T.p.cBroke}</div></div>
            </>
          )}
          <ul className="rq-list">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}

// ---------- Nyt: the captures ----------

type Shot = {name: string; src: string};
const CAPTURES: Shot[] = (window as unknown as {CAPTURES?: Shot[]}).CAPTURES ?? [];
const CAPTION: Record<string, string> = {
  'a01-integrations-empty': 'Integraatiot ennen Googlen tunnuksia',
  'a02-whose': 'Ohjeen 1. vaihe: kenen tilit (ei oletusta)',
  'a03-whose-personal': 'Myös henkilökohtaiset tilit valittuna',
  'a04-personal-apis': 'Rajapinnat',
  'a04-personal-brand': 'Nimi ja tietosuoja (External), varoituksen kuvitus',
  'a04-personal-scopes': 'Oikeudet',
  'a04-personal-publish': 'Julkaisu: Testing on valmiiksi valittu',
  'a05-personal-publish-production': 'Julkaisu: In production',
  'a06-personal-client': 'Asiakas: Client ID ja secret',
  'a07-personal-workspace': 'Tallennuksen jälkeen: viesti työtilin ylläpitäjälle',
  'a08-personal-try': 'Kokeile: tallennettu ei ole vielä kokeiltu',
  'a09-integrations-configured': 'Asetettu: rivi sanoo vain "Tarjolla"',
  'a10-row-menu': 'Rivin valikko: Kenen tilit…',
  'a11-audience-item': 'Kenen tilit… olemassa olevalle asiakkaalle',
  'a12-audience-item-org': 'Kenen tilit…: Vain organisaation tilit (Internal riittää)',
  'a13-audience-item-1-brand': 'Kenen tilit…: nimi ja tietosuoja',
  'a13-audience-item-2-publish': 'Kenen tilit…: Make external ja julkaisu',
  'a13-audience-item-3-workspace': 'Kenen tilit…: työtilit',
  'a13-audience-item-4-ready': 'Kenen tilit…: tarkistukset vaihdon jälkeen',
  'b01-whose-org': 'Organisaation polku: vain organisaation tilit',
  'b02-org-1-apis': 'Organisaation polku: rajapinnat',
  'b02-org-2-brand': 'Organisaation polku: sovelluksen nimi, Internal',
  'b02-org-3-scopes': 'Organisaation polku: oikeudet',
  'b03-org-try': 'Organisaation polku: kokeile',
  'b04-integrations-internal-configured': 'Internal-sovellus asetettu: rivi on sama kuin Externalilla',
  'p01-agent-data': 'Henkilö: Tiedot agenteille',
  'p02-level': 'Henkilö: taso (sama Internal- ja External-sovelluksella)',
  'p03-before-google': 'Ennen Googlea: yksi ehdollinen huomautus',
  'p04-help-panel': 'Ohje: varoitus ja viisi pysäytystä',
  'p05-help-internal': 'Ohje: "Sovellus on vain sen organisaation tileille" (org_internal)',
  'p06-help-warning': 'Ohje: Googlen varoitus ja kaksi kuvituskaistaa',
  'p07-waiting': 'Paluuosoitetta odotetaan',
  'p08-stopped-at-google': 'Keskeytit Googlessa: kirjautuminen pysyy auki',
  'p09-error-org-internal-pasted': 'Keinotekoinen: org_internal paluuosoitteessa. Oikeasti Google ei palaa, vaan jää 403-sivulle.',
  'p10-folders': 'Kansiot (Drive)',
  'p11-connected-granted': 'Yhdistetty: myönnetyt palvelut',
  'p12-agent-data-connected': 'Henkilö: yhdistetty tili kortilla',
};
function Captures() {
  const [w, setW] = useState<'1440' | '390'>('1440');
  const shots = CAPTURES.filter((c) => c.name.endsWith(`-${w}`));
  const group = (p: string) => shots.filter((c) => p.includes(c.name[0]));
  return (
    <div className="rq-page rq-captures" data-testid="rq-page">
      <h1 className="rq-h">Nyt: tuotannon Google-näkymät</h1>
      <p className="si-quiet">Synteettinen lab, tuotannon koodi (v0.1.5 jälkeen), suomeksi, vaalea teema. Henkilöt, palvelin ja client ID ovat keksittyjä. Googlen omat sivut eivät ole mukana: Habitat ei näe niitä.</p>
      <Segmented data-testid="rq-width" label="Leveys" value={w} onChange={setW} options={[{id: '1440', label: '1440'}, {id: '390', label: '390'}]} />
      {!CAPTURES.length && <p className="si-warn" data-testid="rq-no-captures"><Icon name="warning" /><span>Kuvat puuttuvat: rakenna build.mjs:llä kaappaushakemiston kanssa.</span></p>}
      {[['a', 'Ylläpitäjä: Myös henkilökohtaiset tilit ja Kenen tilit…'], ['b', 'Ylläpitäjä: Vain organisaation tilit (Internal)'], ['p', 'Henkilö: Yhdistä tili: Google']].map(([k, h]) => (
        <section key={k}>
          <h2 className="rq-h2">{h}</h2>
          <div className={`rq-shots rq-w${w}`}>
            {group(k).map((c) => (
              <figure key={c.name} data-testid="rq-shot"><img src={c.src} alt={CAPTION[c.name.replace(/-(1440|390)$/, '')] ?? c.name} loading="lazy" />
                <figcaption><code>{c.name}</code> {CAPTION[c.name.replace(/-(1440|390)$/, '')]}</figcaption></figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------- Review chrome ----------

function App({direction}: {direction: number}) {
  const [s, setS] = useState(scenario);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState('');
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = params.get('theme') === 'dark' ? 'dark' : 'light'; document.documentElement.lang = 'fi'; }, []);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="https://"], a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      setMessage(`${T.wouldOpen} ${a.href}`);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);
  useEffect(() => { if (!message) return; const id = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(id); }, [message]);
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong>{T.title}</strong>
        {direction > 0 && (
          <label>{T.scenario} <select id="scenario" value={s} onChange={(e) => { scenario = e.target.value as S; setS(scenario); setGeneration((g) => g + 1); }}>
            {SCENARIOS.map((id) => <option key={id} value={id}>{T.scenarios[id]}</option>)}</select></label>
        )}
        {direction > 0 && <button type="button" data-testid="rq-reset" onClick={() => setGeneration((g) => g + 1)}>{T.reset}</button>}
        <p className="rq-round" data-testid="round-line">{T.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {T.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        {direction === 0 ? <Captures /> : <Page key={`${generation}-${s}`} d={direction} s={s} toast={setMessage} />}
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
