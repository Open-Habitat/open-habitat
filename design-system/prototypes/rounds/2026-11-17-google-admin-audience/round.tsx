import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {ControlButton, ExternalLink, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {TextField} from '../../../../web/src/components/Primitives';
import {ServerIntegrations} from '../../../../web/src/components/ServerIntegrations';
import {Badge} from '../../../../web/src/components/Status';
import type {Provider, ProviderId} from '../../../../web/src/app/integrations';
import type {IntegrationApps} from '../../../../web/src/app/serverIntegrations';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import {type Audience, type Lang, type Publish, type Scenario, type StepId, TEXT} from './text';
import './round.css';

// google-personal-accounts, round 1: the server administrator's Google
// guide (Settings › server integrations › Google) when personal Gmail
// accounts may connect too (Jari 16.11.2026: staging and one pilot switch to
// External, published and unverified). Axis: how the guide presents the
// audience choice and its consequences. A asks it as the stepper's first
// step, B lays the whole guide on one page with the audience as a switch, C
// opens with both options' consequences side by side and carries the chosen
// one's in a side column. Same in every direction: the steps' content, the
// states the research lists (new project and existing client, Testing and
// In production, brand and privacy, a Workspace block, ready to try) and
// what stays unconfirmed (Finnish Google labels, token survival across
// Internal → External, the identifier on Google's warning). The list behind
// the guide is production's ServerIntegrations; the guide is the round's,
// built from production's primitives and the .si-* rules of production's
// guide. Habitat never learns Google's audience or publishing status, so the
// guide asks the administrator what Google shows rather than displaying a
// status. Everything is synthetic.

const NAMES = ['A Kysymys ensin', 'B Yksi sivu', 'C Vertailu ensin'];
const A = 0, B = 1, C = 2;
const params = new URLSearchParams(location.search);
let lang: Lang = params.get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);

const CLIENT_ID = '704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com';
const AUTH = 'https://console.cloud.google.com/auth';
const APIS: [string, string][] = [
  ['Gmail API', 'gmail.googleapis.com'], ['Google Calendar API', 'calendar-json.googleapis.com'],
  ['Google Drive API', 'drive.googleapis.com'], ['People API', 'people.googleapis.com'],
  ['Google Sheets API', 'sheets.googleapis.com'], ['Google Docs API', 'docs.googleapis.com'],
  ['Google Slides API', 'slides.googleapis.com'],
];
const SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/contacts.readonly'];

type St = {scenario: Scenario; audience: Audience | null; step: StepId; publish: Publish; saved: boolean; open: boolean};
const initial = (): St => ({
  scenario: params.get('s') === 'existing' ? 'existing' : 'new',
  audience: params.get('a') === 'org' ? 'org' : params.get('a') === 'personal' ? 'personal' : null,
  step: (params.get('step') as StepId) || 'audience', publish: params.get('p') === 'production' ? 'production' : 'testing',
  saved: false, open: true,
});

/** The guide's steps for a situation. Until the audience is chosen, the
 * longer path is shown so the progress does not shrink under the reader. */
function stepsOf(s: Scenario, a: Audience | null): StepId[] {
  if (s === 'existing') return a === 'org' ? ['audience', 'ready'] : ['audience', 'brand', 'publish', 'workspace', 'ready'];
  return a === 'org' ? ['audience', 'apis', 'brand', 'scopes', 'client', 'ready']
    : ['audience', 'apis', 'brand', 'scopes', 'publish', 'client', 'workspace', 'ready'];
}
const afterSave = (id: StepId) => id === 'workspace' || id === 'ready';

let toastSink: (s: string) => void = () => {};

// ---------- Production guide pieces, as ServerIntegrations.tsx draws them ----------

function Copy({value, label}: {value: string; label: string}) {
  const [done, setDone] = useState(false);
  return (
    <ControlButton data-testid="si-copy" size="row" variant="quiet" aria-label={`${lang === 'fi' ? 'Kopioi' : 'Copy'} ${label}`}
      onPress={() => { void navigator.clipboard?.writeText(value).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1400); }}>
      <Icon name={done ? 'check' : 'copy'} />
    </ControlButton>
  );
}
const Val = ({k, v, copy = true}: {k: string; v: string; copy?: boolean}) => (
  <div className="si-val"><span className="si-k">{k}</span><code>{v}</code>{copy && <Copy value={v} label={k} />}</div>
);
const Path = ({p, href}: {p: string; href?: string}) => (
  <div className="si-where">
    <p className="si-path"><Icon name="forward" /><span>{p}</span></p>
    {href && <p className="si-open"><ExternalLink href={href} target="_blank" rel="noreferrer" data-testid="si-console-link">{lang === 'fi' ? 'Avaa sivu' : 'Open page'} <Icon name="external" /></ExternalLink></p>}
  </div>
);
const Unconfirmed = ({id}: {id: string}) => (
  <span className="ga-unconfirmed" data-testid={`unconfirmed-${id}`}><Badge label={TEXT[lang].unconfirmed} tone="warning" /></span>
);

// ---------- Step bodies, shared by all directions ----------

function Choice({st, set}: {st: St; set: (p: Partial<St>) => void}) {
  const t = TEXT[lang];
  return (
    <div className="ga-choice" role="radiogroup" aria-label={t.question} data-testid="ga-choice">
      {(['org', 'personal'] as Audience[]).map((a) => {
        const o = t[a];
        const on = st.audience === a;
        return (
          <button key={a} type="button" role="radio" aria-checked={on} className="ga-option" data-testid={`choose-${a}`} onClick={() => set({audience: a})}>
            <span className="ga-option-head"><span className="ga-radio" aria-hidden="true" /><strong>{o.name}</strong></span>
            <span className="ga-option-body">{o.body}</span>
            <ul className="ga-facts">{o.facts.map((f) => <li key={f}>{f}</li>)}</ul>
            <span className="ga-google">Google: <code>{o.google}</code></span>
          </button>
        );
      })}
    </div>
  );
}

function Compare({st, set}: {st: St; set: (p: Partial<St>) => void}) {
  const t = TEXT[lang];
  return (
    <div className="ga-compare-wrap">
      <table className="ga-compare" data-testid="ga-compare">
        <caption>{t.compare.caption}</caption>
        <thead>
          <tr><td />
            {(['org', 'personal'] as Audience[]).map((a) => (
              <th key={a} scope="col" data-chosen={st.audience === a || undefined}>
                <span className="ga-colname">{t[a].name}</span>
                <ControlButton data-testid={`choose-${a}`} size="row" variant={st.audience === a ? 'primary' : 'secondary'} aria-pressed={st.audience === a} onPress={() => set({audience: a})}>
                  {st.audience === a ? <><Icon name="check" /> {t.compare.chosen}</> : t.compare.choose}
                </ControlButton>
              </th>))}
          </tr>
        </thead>
        <tbody>
          {t.compare.rows.map(([k, o, p]) => (
            <tr key={k}><th scope="row">{k}</th><td data-chosen={st.audience === 'org' || undefined}>{o}</td><td data-chosen={st.audience === 'personal' || undefined}>{p}</td></tr>))}
        </tbody>
      </table>
    </div>
  );
}

function AudienceStep({d, st, set}: {d: number; st: St; set: (p: Partial<St>) => void}) {
  const t = TEXT[lang];
  return (
    <>
      {st.scenario === 'existing' && (
        <div className="ga-existing" data-testid="ga-existing">
          <p>{t.existingNote}</p>
          <Path p="Google Auth platform › Audience" href={`${AUTH}/audience`} />
          <p className="si-quiet" data-testid="ga-keep">{t.keepConnections}</p>
        </div>
      )}
      {d === B ? (
        <>
          <Segmented data-testid="ga-audience-switch" label={t.question} value={st.audience ?? undefined} onChange={(a) => set({audience: a})}
            options={(['org', 'personal'] as Audience[]).map((a) => ({id: a, label: t[a].name}))} />
          {st.audience && (
            <div className="ga-chosen" data-testid="ga-chosen">
              <p>{t[st.audience].body}</p>
              <ul className="ga-facts">{t[st.audience].facts.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
        </>
      ) : (
        <>
          {d === A && <p className="ga-question">{t.question}</p>}
          {d === A ? <Choice st={st} set={set} /> : <Compare st={st} set={set} />}
        </>
      )}
      {st.audience === 'personal' && <p className="si-quiet" data-testid="ga-small-group">{t.smallGroup}</p>}
      {st.scenario === 'existing' && st.audience === 'org' && <p className="si-effect" data-testid="ga-org-already">{t.orgAlready}</p>}
    </>
  );
}

function WarningPreview() {
  const t = TEXT[lang];
  return (
    <figure className="ga-preview" data-testid="ga-preview">
      <figcaption><strong>{t.previewTitle}</strong> <Unconfirmed id="preview" /></figcaption>
      <div className="ga-mock" aria-label={t.previewTitle} role="img">
        <p className="ga-mock-head"><Icon name="warning" /> Google hasn&rsquo;t verified this app</p>
        <p className="ga-mock-line">…</p>
        <p className="ga-mock-link">Advanced</p>
        <p className="ga-mock-link">Go to <span className="ga-ident" data-testid="ga-ident">{t.identifier}</span> (unsafe)</p>
      </div>
      <p className="si-quiet">{t.previewNote}</p>
    </figure>
  );
}

function Publishing({st, set}: {st: St; set: (p: Partial<St>) => void}) {
  const t = TEXT[lang];
  return (
    <>
      <Path p="Google Auth platform › Audience" href={`${AUTH}/audience`} />
      {st.scenario === 'existing' && <p className="si-quiet" data-testid="ga-make-external">{t.makeExternal} <code>Make external</code></p>}
      <p>{t.publishWhere}</p>
      <Segmented data-testid="ga-publish" label={t.publishWhere} value={st.publish} onChange={(p) => set({publish: p})}
        options={(['testing', 'production'] as Publish[]).map((p) => ({id: p, label: t.publishes[p]}))} />
      {st.publish === 'testing' ? (
        <div className="ga-state" data-testid="ga-testing">
          <p className="si-warn"><Icon name="warning" /><span>{t.testingWarn}</span></p>
          <Path p="Google Auth platform › Audience › Publishing status › Publish app" />
          <p className="si-quiet">{t.publishNow}</p>
        </div>
      ) : (
        <div className="ga-state" data-testid="ga-production">
          <p className="ga-ok"><Icon name="check" /><span>{t.productionOk}</span></p>
        </div>
      )}
      <div className="ga-cap" data-testid="ga-cap">
        <p><strong>{t.capTitle}</strong></p>
        <p>{t.cap}</p>
        <Path p="Google Auth platform › Audience › OAuth user cap" />
        <p className="si-quiet">{t.capWhere}</p>
      </div>
      <p className="si-quiet">{t.noVerification} {t.smallGroup}</p>
      <p className="si-effect" data-testid="ga-publish-google">{t.publishInGoogle}</p>
    </>
  );
}

function Fields({onSave}: {onSave?: () => void}) {
  const t = TEXT[lang];
  const [id, setId] = useState('');
  return (
    <div className="si-fields">
      <TextField data-testid="si-field-client_id" label="Client ID" mono value={id} onChange={setId} hint="…apps.googleusercontent.com" />
      <label className="s-field si-secret"><span>Client secret</span>
        <input type="password" data-testid="si-field-client_secret" name="google-client_secret" autoComplete="new-password" defaultValue="" /></label>
      <p className="si-warn" data-testid="si-secret-once"><Icon name="warning" /><span>{t.secretOnce}</span></p>
      {onSave && <ControlButton data-testid="ga-save-inline" size="page" variant="primary" onPress={onSave}>{t.save}</ControlButton>}
    </div>
  );
}

function ConsoleClient() {
  const t = TEXT[lang];
  return (
    <>
      <Path p="Google Auth platform › Clients › Create Client" href={`${AUTH}/clients/create`} />
      <Val k="Application type" v="Desktop app" copy={false} />
      <Val k="Name" v="Open Habitat" />
      <Val k="Use this client for an AI-powered agent" v={lang === 'fi' ? 'valittu' : 'selected'} copy={false} />
      <p className="si-effect">{t.agentClient}</p>
      <p className="si-quiet">{t.noRedirect} <code>http://localhost</code>.</p>
      <p className="si-quiet">{t.chooseCreate}</p>
    </>
  );
}

function body(id: StepId, d: number, st: St, set: (p: Partial<St>) => void): ReactNode {
  const t = TEXT[lang];
  const personal = st.audience !== 'org';
  switch (id) {
    case 'audience': return <AudienceStep d={d} st={st} set={set} />;
    case 'apis': return (
      <>
        <p>{personal ? t.apisPersonal : t.apisOrg}</p>
        <ul className="si-list">{APIS.map(([n]) => <li key={n}>{n}</li>)}</ul>
        <ExternalLink href={`https://console.cloud.google.com/apis/enableflow?apiid=${APIS.map((a) => a[1]).join(',')}`} target="_blank" rel="noreferrer" data-testid="si-console-link">
          {lang === 'fi' ? 'Ota käyttöön Google Cloudissa' : 'Enable in Google Cloud'} <Icon name="external" /></ExternalLink>
        {personal && <p className="si-quiet" data-testid="ga-own-project">{t.ownProject}</p>}
      </>
    );
    case 'brand': return personal ? (
      <>
        <Path p="Google Auth platform › Branding" href={`${AUTH}/branding`} />
        <Val k="App name" v="Open Habitat" />
        <Val k="User support email" v={t.supportEmail} copy={false} />
        <p className="si-quiet">{t.supportNote}</p>
        <Val k="Audience" v="External" copy={false} />
        <p className="si-effect" data-testid="si-audience">{t.externalEffect}</p>
        <Val k="Developer contact information" v={t.supportEmail} copy={false} />
        <div className="ga-subhead">App domain</div>
        <Val k="Application home page" v={t.homepage} copy={false} />
        <Val k="Application privacy policy link" v={t.privacy} copy={false} />
        <p className="si-warn" data-testid="ga-privacy"><Icon name="shield" /><span>{t.privacyNote}</span></p>
        <Val k="Application terms of service link" v={t.terms} copy={false} />
        <p className="si-quiet">{t.termsNote}</p>
        <Val k="Authorized domains" v={t.domain} copy={false} />
        <p className="si-quiet" data-testid="ga-domain">{t.domainNote}</p>
        <WarningPreview />
      </>
    ) : (
      <>
        <Path p="Google Auth platform › Branding › Get started" href={`${AUTH}/branding`} />
        <Val k="App name" v="Open Habitat" />
        <Val k="Audience" v="Internal" copy={false} />
        <p className="si-effect" data-testid="si-audience">{t.internalEffect}</p>
      </>
    );
    case 'scopes': return (
      <>
        <Path p="Google Auth platform › Data Access › Add or Remove Scopes" href={`${AUTH}/scopes`} />
        <div className="si-block" data-testid="si-scopes"><pre className="si-cmd">{SCOPES.join('\n')}</pre><Copy value={SCOPES.join(',')} label="scopes" /></div>
        {personal && <p className="si-effect" data-testid="ga-restricted">{t.scopesPersonal}</p>}
      </>
    );
    case 'publish': return <Publishing st={st} set={set} />;
    case 'client': return <ConsoleClient />;
    case 'workspace': return (
      <>
        <p data-testid="ga-workspace-lead">{t.workspaceLead}</p>
        <div className="si-handoff" data-testid="ga-handoff">
          <p className="si-side">{t.workspaceMsgTitle}</p>
          <div className="si-block"><pre className="si-cmd" data-testid="ga-handoff-msg">{t.workspaceMsg(CLIENT_ID)}</pre><Copy value={t.workspaceMsg(CLIENT_ID)} label={t.workspaceMsgTitle} /></div>
          <Val k="Client ID" v={CLIENT_ID} />
        </div>
        <p className="si-quiet si-role"><Icon name="user" /><span>{t.workspaceRole}</span></p>
        <p className="si-effect" data-testid="ga-trusted">{t.trustedNote}</p>
        <p className="si-quiet ga-inline">{t.trustedWarning} <Unconfirmed id="trusted" /></p>
        <p className="si-quiet">{t.workspaceLater}</p>
      </>
    );
    case 'ready': {
      const list = st.scenario === 'existing' ? (personal ? t.readyExisting : []) : personal ? t.readyNew : t.readyOrg;
      return (
        <>
          {st.scenario === 'new' && <p className="ga-ok" data-testid="ga-saved"><Icon name="info" /><span>{t.savedNote}</span></p>}
          {st.scenario === 'existing' && personal && <p className="si-warn ga-inline" data-testid="ga-migration"><Icon name="warning" /><span>{t.migrationNote}</span> <Unconfirmed id="migration" /></p>}
          {st.scenario === 'existing' && !personal && <p className="si-effect" data-testid="ga-org-already">{t.orgAlready}</p>}
          {list.length > 0 && <ol className="ga-try" data-testid="ga-try">{list.map((l) => <li key={l}>{l}</li>)}</ol>}
        </>
      );
    }
  }
}

// ---------- The three frames ----------

function Shell({title, size, onClose, children}: {title: string; size: string; onClose: () => void; children: ReactNode}) {
  return (
    <ModalOverlay className="ah-overlay ga-overlay" isOpen isDismissable onOpenChange={(o) => !o && onClose()}>
      <Modal className={`ah-modal si-modal ${size}`}>
        <Dialog className="ah-dialog si-dialog" data-testid="ga-guide" aria-label={title}>
          <Heading slot="title">{title}</Heading>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function Summary({st, set}: {st: St; set: (p: Partial<St>) => void}) {
  const t = TEXT[lang];
  const items = st.audience === 'org' ? t.summaryOrg : t.summaryPersonal;
  return (
    <aside className="ga-summary" data-testid="ga-summary">
      <p className="si-side">{t.summary}</p>
      <ul>{items.map((i, n) => <li key={i} data-first={n === 0 || undefined}>{i}</li>)}</ul>
      <ControlButton data-testid="ga-change" size="row" variant="quiet" onPress={() => set({step: 'audience'})}>{t.change}</ControlButton>
    </aside>
  );
}

function Stepper({d, st, set}: {d: number; st: St; set: (p: Partial<St>) => void}) {
  const t = TEXT[lang];
  const steps = stepsOf(st.scenario, st.audience);
  const i = Math.max(0, steps.indexOf(st.step));
  const id = steps[i];
  const last = i === steps.length - 1;
  const isClient = id === 'client';
  const title = st.scenario === 'new' ? t.titleNew : t.titleExisting;
  const name = id === 'brand' && st.audience === 'org' ? t.brandOrg : t.stepNames[id];
  const go = (n: number) => set({step: steps[n]});
  const content = isClient ? (
    <div className="si-cols" data-testid="si-split">
      <div className="si-col"><p className="si-side">{t.inGoogle}</p><ConsoleClient /></div>
      <div className="si-col si-get" data-testid="si-get"><p className="si-side">{t.here}</p><p className="si-quiet">{t.googleShows}</p><Fields /></div>
    </div>
  ) : body(id, d, st, set);
  const wide = isClient || d === C;
  return (
    <Shell title={title} size={wide ? 'si-split' : 'si-wide'} onClose={() => set({open: false})}>
      <div className="si-progress" data-testid="si-progress" role="img" aria-label={t.stepOf(i + 1, steps.length)}>
        {steps.map((s, j) => <span key={s} data-done={j < i || undefined} data-current={j === i || undefined} />)}
      </div>
      <p className="si-stepname" data-testid="si-stepname" data-step={id}><span className="si-muted">{i + 1}/{steps.length}</span> {name}</p>
      <div className={`si-stepbody${d === C && id !== 'audience' ? ' ga-with-summary' : ''}`} data-testid={`si-step-${id}`}>
        {d === C && id !== 'audience' && st.audience ? <><div className="ga-main">{content}</div><Summary st={st} set={set} /></> : content}
      </div>
      <div className="si-foot">
        {st.scenario === 'new' && i === 0 && st.audience && (
          <ControlButton data-testid="si-skip" size="row" variant="quiet" onPress={() => set({step: 'client'})}>{t.haveClient}</ControlButton>
        )}
        <span className="si-grow" />
        {i > 0 && !afterSave(id) || (afterSave(id) && st.scenario === 'existing') ? (
          <ControlButton data-testid="si-back" size="row" variant="secondary" onPress={() => go(i - 1)}>{t.back}</ControlButton>
        ) : !afterSave(id) ? (
          <ControlButton size="row" variant="secondary" onPress={() => set({open: false})}>{t.cancel}</ControlButton>
        ) : null}
        {last ? (
          <ControlButton data-testid="ga-done" size="page" variant="primary" onPress={() => set({open: false})}>{t.done}</ControlButton>
        ) : isClient ? (
          <ControlButton data-testid="si-save" size="page" variant="primary" onPress={() => { toastSink(t.saved); set({saved: true, step: steps[i + 1]}); }}>{t.save}</ControlButton>
        ) : (
          <ControlButton data-testid="si-next" size="page" variant="primary" isDisabled={id === 'audience' && !st.audience} onPress={() => go(i + 1)}>{t.next}</ControlButton>
        )}
      </div>
    </Shell>
  );
}

function OnePage({st, set}: {st: St; set: (p: Partial<St>) => void}) {
  const t = TEXT[lang];
  const steps = st.audience ? stepsOf(st.scenario, st.audience) : ['audience' as StepId];
  const scroller = useRef<HTMLDivElement>(null);
  const title = st.scenario === 'new' ? t.titleNew : t.titleExisting;
  const saveAt = steps.indexOf('client');
  useEffect(() => {
    const el = scroller.current?.querySelector(`[data-section="${st.step}"]`) as HTMLElement | null;
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop;
  }, [st.step, st.audience, st.scenario]);
  return (
    <Shell title={title} size="si-split ga-page" onClose={() => set({open: false})}>
      <div className="ga-onepage">
        <nav className="ga-toc" data-testid="ga-toc" aria-label={t.onThisPage}>
          <p className="si-side">{t.onThisPage}</p>
          <ol>{steps.map((s, n) => (
            <li key={s}>{n === saveAt + 1 && saveAt >= 0 && <span className="ga-toc-after">{t.after}</span>}
              <button type="button" data-testid={`toc-${s}`} aria-current={st.step === s ? 'true' : undefined} onClick={() => set({step: s})}>
                <span className="si-muted">{n + 1}</span> {s === 'brand' && st.audience === 'org' ? t.brandOrg : t.stepNames[s]}</button></li>))}
          </ol>
        </nav>
        <div className="ga-sections" ref={scroller} data-testid="ga-sections">
          {steps.map((s, n) => (
            <section key={s} className="ga-section" data-section={s} data-testid={`si-step-${s}`} data-current={st.step === s || undefined}>
              {n === saveAt + 1 && saveAt >= 0 && <p className="ga-after" data-testid="ga-after">{t.after}</p>}
              <h3><span className="si-muted">{n + 1}</span> {s === 'brand' && st.audience === 'org' ? t.brandOrg : t.stepNames[s]}</h3>
              <div className="si-stepbody">
                {s === 'client' ? (
                  <div className="si-cols"><div className="si-col"><ConsoleClient /></div>
                    <div className="si-col si-get" data-testid="si-get"><p className="si-side">{t.here}</p><p className="si-quiet">{t.googleShows}</p>
                      <Fields onSave={() => { toastSink(t.saved); set({saved: true, step: steps[n + 1]}); }} /></div></div>
                ) : body(s, B, st, set)}
              </div>
            </section>))}
        </div>
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        <ControlButton data-testid="ga-done" size="page" variant={st.saved || st.scenario === 'existing' ? 'primary' : 'secondary'} onPress={() => set({open: false})}>{st.saved || st.scenario === 'existing' ? t.done : t.close}</ControlButton>
      </div>
    </Shell>
  );
}

// ---------- The page behind the guide: production's list ----------

const provider = (id: ProviderId, available: boolean): Provider => ({id, available, login: 'app_password', services: ['mail'], ...(available ? {} : {unavailable_reason: 'app_credentials_required' as const})});
const providersOf = (google: boolean): Provider[] => (['google', 'microsoft', 'apple', 'imap', 'caldav', 'carddav', 'dropbox'] as ProviderId[])
  .map((p) => provider(p, p === 'google' ? google : !['microsoft', 'dropbox'].includes(p)));
const appsOf = (google: boolean): IntegrationApps => ({schema_version: 1, browser_setup: true,
  apps: google ? [{provider: 'google', client_id: CLIENT_ID, usable: true, source: 'site_admin', actor: '51234000', at: '2026-10-24T12:00:00Z'}] : []});

function Page({d, st, set}: {d: number; st: St; set: (p: Partial<St>) => void}) {
  const google = st.scenario === 'existing' || st.saved;
  return (
    <main className="ga-page-bg" data-testid="ga-settings">
      <h1 className="ga-h1">{lang === 'fi' ? 'Palvelinintegraatiot' : 'Server integrations'}</h1>
      <ServerIntegrations providers={providersOf(google)} apps={appsOf(google)} steps={['google']} names={{'51234000': 'kaisa-admin'}}
        onboardingHref="#" onSave={async () => ({kind: 'saved'} as never)} onRemove={() => {}} onRefresh={() => {}} />
      {st.open ? (d === B ? <OnePage st={st} set={set} /> : <Stepper d={d} st={st} set={set} />) : null}
    </main>
  );
}

// ---------- Review chrome ----------

const PRESETS: Partial<St>[] = [
  {scenario: 'new', audience: null, step: 'audience', saved: false},
  {scenario: 'existing', audience: 'personal', step: 'audience', saved: false},
  {scenario: 'new', audience: 'personal', step: 'publish', publish: 'testing', saved: false},
  {scenario: 'new', audience: 'personal', step: 'brand', saved: false},
  {scenario: 'new', audience: 'personal', step: 'workspace', saved: true},
  {scenario: 'new', audience: 'personal', step: 'ready', saved: true},
];
let shared: St = initial();
let reviewTheme = params.get('theme') === 'dark' ? 'dark' : 'light';

function App({d}: {d: number}) {
  const [st, setSt] = useState<St>(shared);
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
  const [gen, setGen] = useState(0);
  const [toast, setToast] = useState('');
  const bar = useRef<HTMLElement>(null);
  const x = TEXT[language];
  toastSink = setToast;
  const set = (p: Partial<St>) => setSt((s) => {
    const n = {...s, ...p};
    const steps = stepsOf(n.scenario, n.audience);
    if (!steps.includes(n.step)) n.step = 'audience';
    shared = n; return n;
  });
  useLayoutEffect(() => {
    const el = bar.current; if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update(); const o = new ResizeObserver(update); o.observe(el); return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 6000); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    // Production's Google row opens the round's guide instead of production's.
    const opener = (e: Event) => {
      const el = e.target as Element | null;
      if (el?.closest?.('[data-testid="si-setup-google"], [data-testid="si-menu-google"]')) {
        e.preventDefault(); e.stopPropagation();
        if (e.type === 'click') set({open: true, step: 'audience'});
        return;
      }
      if (e.type !== 'click' || el?.closest?.('.proto-picker, .rq-bar')) return;
      const a = el?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (a) { e.preventDefault(); e.stopPropagation(); setToast(`${TEXT[lang].away} ${a.getAttribute('href')}`); }
    };
    const types = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'keydown'];
    types.forEach((ty) => document.addEventListener(ty, opener, true));
    return () => types.forEach((ty) => document.removeEventListener(ty, opener, true));
  });
  const steps = stepsOf(st.scenario, st.audience);
  const active = PRESETS.findIndex((p) => Object.entries(p).every(([k, v]) => (st as Record<string, unknown>)[k] === v));
  return (
    <div className={`rq-review variant-${d}`} data-direction={d} data-scenario={st.scenario} data-audience={st.audience ?? 'none'}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.scenario} <select id="scenario" value={st.scenario} onChange={(e) => set({scenario: e.target.value as Scenario, step: 'audience', saved: false, open: true})}>
          {(['new', 'existing'] as Scenario[]).map((s) => <option key={s} value={s}>{x.scenarios[s]}</option>)}</select></label>
        <label>{x.audienceLabel} <select id="audience" value={st.audience ?? ''} onChange={(e) => set({audience: (e.target.value || null) as Audience | null, open: true})}>
          <option value="">—</option>{(['org', 'personal'] as Audience[]).map((a) => <option key={a} value={a}>{x.audiences[a]}</option>)}</select></label>
        <label>{x.stepLabel} <select id="step" value={st.step} onChange={(e) => { const s = e.target.value as StepId; set({step: s, saved: afterSave(s) && st.scenario === 'new' ? true : st.saved, open: true}); }}>
          {steps.map((s) => <option key={s} value={s}>{x.stepNames[s]}</option>)}</select></label>
        <label>{x.publishLabel} <select id="publish" value={st.publish} onChange={(e) => set({publish: e.target.value as Publish})}>
          {(['testing', 'production'] as Publish[]).map((p) => <option key={p} value={p}>{x.publishes[p]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); setGen((g) => g + 1);
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-open" onClick={() => set({open: true})}>{x.openGuide}</button>
        <button type="button" data-testid="rq-reset" onClick={() => { const n = {...initial(), audience: null, scenario: 'new' as Scenario, step: 'audience' as StepId}; shared = n; setSt(n); }}>{x.reset}</button>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === d ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
        <div className="rq-presets" role="group" aria-label={x.presetsLabel}>
          <span className="rq-presets-label">{x.presetsLabel}</span>
          <ol>{x.presets.map(([name, line], i) => (
            <li key={i}>
              <button type="button" data-testid={`preset-${i + 1}`} aria-pressed={active === i} onClick={() => set({...PRESETS[i], open: true})}>{i + 1} {name}</button>
              <span className="rq-preset-line" data-testid={`preset-line-${i + 1}`}>{line}</span>
            </li>))}
          </ol>
        </div>
      </header>
      <div className="rq-stage" key={`${gen}-${language}`}>
        <Page d={d} st={st} set={set} />
      </div>
      {toast ? <p className="rq-toast" role="status" data-testid="rq-toast">{toast}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
const stageSink = {set innerHTML(view: ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, d) => () => <App key={d} d={d} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((nm, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = nm.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// The guide is modal and react-aria makes everything outside it inert; the
// review chrome is not part of the page under review, so it stays usable.
const keepLive = () => document.querySelectorAll('.proto-picker[inert], .rq-bar[inert], .rq-review[inert], #root[inert]').forEach((el) => el.removeAttribute('inert'));
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'])
  window.addEventListener(type, (e) => { if ((e.target as Element | null)?.closest?.('.proto-picker, .rq-bar')) e.stopPropagation(); }, true);
new MutationObserver(keepLive).observe(document.body, {attributes: true, attributeFilter: ['inert'], subtree: true});
new Function('stage', 'variants', pickerSource)(stageSink, variants);

export type {React};
