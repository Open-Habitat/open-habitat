import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay, Radio, RadioGroup} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, controlClassName} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {TextField} from '../../../../web/src/components/Primitives';
import {ConnectDialog, type ConnectStage, IntegrationsOverview, ProviderMark} from '../../../../web/src/components/Integrations';
import type {Account, IntegrationList, Provider} from '../../../../web/src/app/integrations';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {type Lang, type LevelId, type P, TEXT} from './text';
import './round.css';

// Asetukset › Tiedot agenteille, the Trello and Atlassian connection from the
// dialog to the account card's state afterwards. The page is production's
// IntegrationsOverview unchanged; Nyt also keeps production's ConnectDialog
// and AccountCard. The three directions replace only the dialog and the
// focused provider's card, built from production pieces (ControlButton,
// Icon, StatusMark, TextField, ProviderMark, react-aria) and Integrations.css
// classes. The axis is where the consent page's choices (Workspace or site,
// permissions) are explained: before the page, as a step of their own, or
// afterwards as a receipt. Person, site and Workspaces are synthetic.

const params = new URLSearchParams(location.search);
let lang: Lang = params.get('lang') === 'en' ? 'en' : 'fi';
setPersonalLanguage(lang);
let provider: P = params.get('p') === 'atlassian' ? 'atlassian' : 'trello';
const SCENARIO_IDS = ['uusi-luku', 'uusi-kirjoitus', 'paluuosoite', 'odottaa', 'yhdistetty', 'kapeampi', 'kapeampi-kortti', 'korjaus'] as const;
type S = typeof SCENARIO_IDS[number];
let scenario: S = (SCENARIO_IDS as readonly string[]).includes(params.get('s') ?? '') ? params.get('s') as S : 'uusi-luku';
const NAMES = ['Nyt', 'Esikatselu', 'Vaiheet', 'Kuitti'];
const NOW = Date.parse('2026-11-23T09:15:00Z');
const PREFIX = 'http://127.0.0.1:45678/callback';
const AUTH = {trello: 'https://auth.atlassian.com/authorize?client=pi&resource=mcp.trello.com', atlassian: 'https://auth.atlassian.com/authorize?client=pi&resource=mcp.atlassian.com'};
const WS_OLD = 'Kotiremontti', WS_NEW = 'Contoso Markkinointi', SITE = 'contoso-demo.atlassian.net';
const ADDRESS: Record<P, string> = {trello: 'open_habitat_trello', atlassian: 'open_habitat_atlassian'};

// ---------- Synthetic host ----------

/** The focused connection as the host would report it. where is the
 * Workspace or site the consent chose; only Kuitti shows it (see result.md). */
type Conn = {requested: LevelId; narrowed: boolean; where: string};
const SCOPES = {
  trello: {read: ['read:me', 'read:account', 'offline_access', 'read:board:trello', 'read:organization:trello', 'read:member:trello', 'read:member.inbox:trello', 'read:member.planner:trello'], write: ['write:board:trello', 'write:member.inbox:trello', 'write:member.planner:trello']},
  atlassian: {read: ['read:me', 'read:account', 'offline_access', 'read:jira:agent-interface', 'search:jira:agent-interface', 'read:confluence:agent-interface', 'search:confluence:agent-interface'], write: ['write:jira:agent-interface', 'write:confluence:agent-interface']},
};
function grantOf(p: P, c: Conn) {
  const {read, write} = SCOPES[p];
  if (c.requested === 'read') return {granted: read, not_granted: []};
  if (!c.narrowed) return {granted: [...read, ...write], not_granted: []};
  return p === 'trello' ? {granted: read, not_granted: write} : {granted: [...read, write[0]], not_granted: [write[1]]};
}
/** What each row of the receipt says: asked, granted. */
function rowsOf(p: P, c: Conn): [boolean, boolean][] {
  const w = c.requested === 'full';
  if (p === 'trello') return [[true, true], [w, w && !c.narrowed]];
  return [[true, true], [w, w], [w, w && !c.narrowed]];
}
const grantedLevel = (c: Conn): LevelId => c.requested === 'full' && !(c.narrowed && provider === 'trello') ? 'full' : 'read';
function productionAccount(p: P, c: Conn): Account {
  const grant = grantOf(p, c);
  const services = p === 'trello'
    ? [{id: 'trello' as const, state: 'ok' as const, access: grantedLevel(c) === 'full' ? 'full' as const : 'read' as const}]
    : [{id: 'jira' as const, state: 'ok' as const, access: c.requested === 'full' ? 'full' as const : 'read' as const},
       {id: 'confluence' as const, state: 'ok' as const, access: c.requested === 'full' && !c.narrowed ? 'full' as const : 'read' as const}];
  const level = p === 'atlassian' && c.narrowed ? undefined : grantedLevel(c);
  return {provider: p, address: ADDRESS[p], checked_at: '2026-11-23T09:12:00Z', services, grant, ...(level ? {level} : {})} as Account;
}
const levels = [{id: 'read' as const, available: true}, {id: 'full' as const, available: true}];
const PROVIDERS: Provider[] = [
  {id: 'google', available: true, login: 'pasted_redirect', services: ['mail', 'calendar', 'contacts', 'drive'], levels: [{id: 'full', available: true}, {id: 'drafts', available: true}, {id: 'read', available: true}]},
  {id: 'microsoft', available: true, login: 'device_code', services: ['mail', 'calendar', 'onedrive']},
  {id: 'atlassian', available: true, login: 'pasted_redirect', services: ['jira', 'confluence'], levels},
  {id: 'trello', available: true, login: 'pasted_redirect', services: ['trello'], levels},
  {id: 'imap', available: true, login: 'app_password', services: ['mail']},
] as Provider[];
const GOOGLE = {provider: 'google', address: 'aino.koti@example.test', checked_at: '2026-11-23T09:12:00Z', level: 'drafts',
  services: [{id: 'mail', state: 'ok', access: 'drafts'}, {id: 'calendar', state: 'ok', access: 'read'}, {id: 'contacts', state: 'ok', access: 'read'}]} as Account;
const listOf = (p: P, c: Conn | null): IntegrationList => ({schema_version: 1, providers: PROVIDERS, accounts: c ? [GOOGLE, productionAccount(p, c)] : [GOOGLE], skill: 'current'});

type Step = 'intro' | 'service' | 'paste' | 'result';
type Flow = {mode: 'new' | 'again'; step: Step; level: LevelId; stuck: boolean};
/** Where each situation starts: the connection and the open dialog. */
function initial(s: S): {conn: Conn | null; flow: Flow | null} {
  const flow = (step: Step, level: LevelId, stuck = false): Flow => ({mode: 'new', step, level, stuck});
  const where = provider === 'trello' ? WS_NEW : SITE;
  switch (s) {
    case 'uusi-luku': return {conn: null, flow: flow('intro', 'read')};
    case 'uusi-kirjoitus': return {conn: null, flow: flow('intro', 'full')};
    case 'paluuosoite': return {conn: null, flow: flow('paste', 'full')};
    case 'odottaa': return {conn: null, flow: flow('paste', 'full', true)};
    case 'yhdistetty': return {conn: {requested: 'full', narrowed: false, where}, flow: flow('result', 'full')};
    case 'kapeampi': return {conn: {requested: 'full', narrowed: true, where}, flow: flow('result', 'full')};
    case 'kapeampi-kortti': return {conn: {requested: 'full', narrowed: true, where}, flow: null};
    case 'korjaus': return {conn: {requested: 'full', narrowed: false, where: provider === 'trello' ? WS_OLD : SITE}, flow: null};
  }
}

// ---------- Shared pieces of the directions ----------

const t = () => TEXT[lang];

function Shell({title, step, onClose, children}: {title: string; step: string; onClose: () => void; children: ReactNode}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  return (
    <ModalOverlay className="ah-overlay" isOpen isDismissable={step !== 'paste'} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal ig-dlg">
        <Dialog className="ah-dialog rq-dlg" data-testid="rq-dialog" data-step={step} aria-label={title}>
          <div className="ig-dh">
            <ProviderMark provider={provider} small />
            <Heading slot="title" ref={heading} tabIndex={-1} data-testid="rq-title">{title}</Heading>
            <Button data-testid="rq-close" size="row" variant="quiet" presentation="icon" aria-label={t().close} onPress={onClose}><Icon name="cross" /></Button>
          </div>
          <div className="ig-flow">{children}</div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The level cards: each described once, here and nowhere else. */
function Levels({level, current, onChange}: {level: LevelId; current?: LevelId; onChange: (l: LevelId) => void}) {
  const x = t();
  return (
    <RadioGroup className="ig-levels" aria-label={x.whatMay} value={level} onChange={(v) => onChange(v as LevelId)}>
      {(['read', 'full'] as const).map((l) => (
        <Radio key={l} value={l} className="ig-level" data-testid={`rq-level-${l}`}>
          <span className="ig-level-dot" aria-hidden="true" />
          <span className="ig-level-body">
            <b className="ig-level-name">{x.levels[provider][l].name}{current === l ? <span className="rq-current"> · {x.current}</span> : null}</b>
            <span className="ig-meta">{x.levels[provider][l].sum}</span>
          </span>
        </Radio>
      ))}
    </RadioGroup>
  );
}

function EndPage() {
  return <p className="ig-expect" role="note" data-testid="rq-endpage"><Icon name="info" /><span>{t().endPage}</span></p>;
}

function AgainNote() {
  const x = t();
  return (
    <div className="rq-again" data-testid="rq-again-note">
      <p className="ig-p">{x.againLead(provider)}</p>
      <p className="ig-meta"><Icon name="lock" /> {x.againOld}</p>
    </div>
  );
}

function Buttons({left, right}: {left: ReactNode; right: ReactNode}) {
  return <div className="ig-row">{left}{right}</div>;
}

function AdminRequest({onStartOver}: {onStartOver?: () => void}) {
  const x = t();
  const [copied, setCopied] = useState(false);
  return (
    <section className="rq-admin" data-testid="rq-admin-request">
      <p className="ig-h">{x.adminHead}</p>
      <p className="ig-p">{x.adminHelp}</p>
      <p className="rq-request" data-testid="rq-admin-text">{x.request[provider]}</p>
      <div className="ig-row start">
        <Button data-testid="rq-copy" size="row" variant="secondary" onPress={() => { void navigator.clipboard?.writeText(x.request[provider]).catch(() => {}); setCopied(true); }}>
          <Icon name={copied ? 'check' : 'copy'} />{copied ? x.copied : x.copy}
        </Button>
        {onStartOver ? <Button data-testid="rq-start-over" size="row" variant="quiet" onPress={onStartOver}>{x.startOver}</Button> : null}
      </div>
    </section>
  );
}

function OpenService({onOpen}: {onOpen?: () => void}) {
  const x = t();
  return (
    <a className={`${controlClassName({variant: 'primary', size: 'page', text: true})} ig-open rq-open`} data-testid="rq-open" href={AUTH[provider]} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={onOpen}>
      <Icon name="external" />{x.open(x.name[provider])}
    </a>
  );
}

function PasteStep({flow, set, onCancel, onDone, showOpen = true}: {flow: Flow; set: (f: Flow) => void; onCancel: () => void; onDone: () => void; showOpen?: boolean}) {
  const x = t();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const v = value.trim();
    if (!v) return setError(x.pasteFirst);
    if (!v.startsWith(PREFIX)) return setError(x.notThat(PREFIX));
    setError('');
    onDone();
  };
  return (
    <form className="ig-flow-form" data-testid="rq-paste" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <p className="ig-h">{x.pasteHead(x.name[provider])}</p>
      {showOpen ? <div className="ig-row start rq-open-row"><OpenService /><span className="ig-meta"><Icon name="clock" /> {x.validFor}</span></div> : null}
      <p className="ig-p">{x.pasteHelp}</p>
      <TextField data-testid="rq-redirect" label={x.field} value={value} onChange={(v) => { setValue(v); setError(''); }} mono />
      {error ? <p className="ig-err" role="alert" data-testid="rq-paste-error"><Icon name="warning" /><span>{error}</span></p> : null}
      {flow.stuck
        ? <AdminRequest onStartOver={() => set({...flow, step: 'intro', stuck: false})} />
        : <button type="button" className="ig-link rq-stuck" data-testid="rq-stuck" onClick={() => set({...flow, stuck: true})}>{x.stuck(provider)}</button>}
      <Buttons
        left={<Button data-testid="rq-cancel" size="page" variant="secondary" onPress={onCancel}>{x.cancel}</Button>}
        right={<Button data-testid="rq-connect" size="page" variant="primary" type="submit">{x.connect}</Button>} />
    </form>
  );
}

/** The receipt: requested against granted, row by row, and where the
 * consent chose. */
function Receipt({c, compact}: {c: Conn; compact?: boolean}) {
  const x = t();
  const rows = rowsOf(provider, c);
  return (
    <div className={`rq-receipt${compact ? ' compact' : ''}`} data-testid="rq-receipt">
      <p className="rq-where" data-testid="rq-where"><span className="ig-meta">{x.where[provider]}</span> <code>{c.where}</code> <span className="ig-meta">· {x.chosenAt(provider)}</span></p>
      <table>
        <thead><tr><th scope="col"><span className="rq-sr">{x.perms}</span></th><th scope="col">{x.asked}</th><th scope="col">{x.got(provider)}</th></tr></thead>
        <tbody>
          {x.rows[provider].map((label, i) => {
            const [asked, got] = rows[i];
            const short = asked && !got;
            return (
              <tr key={label} data-short={short || undefined}>
                <th scope="row">{label}</th>
                <td>{asked ? <><Icon name="check" /> {x.yes}</> : <span className="ig-meta">{x.notRequested}</span>}</td>
                <td>{!asked ? <span className="ig-meta">–</span> : got ? <><Icon name="check" /> {x.yes}</> : <b className="rq-no"><Icon name="cross" /> {x.no}</b>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Narrower than requested: the service's own reasons and the fix. */
function Narrowed({onAgain, onKeep, card}: {onAgain: () => void; onKeep?: () => void; card?: boolean}) {
  const x = t();
  const [admin, setAdmin] = useState(false);
  return (
    <div className="rq-narrow" data-testid="rq-narrowed">
      <p className="ig-notice" role="status"><Icon name="warning" /><span><strong>{x.narrowHead(provider)}</strong> {x.narrowWhy(provider)} {x.narrowFix(provider)}</span></p>
      <div className={`ig-row${card ? ' start' : ''}`}>
        <Button data-testid="rq-admin-open" size={card ? 'row' : 'page'} variant="quiet" onPress={() => setAdmin(!admin)}>{x.askAdmin}</Button>
        {onKeep ? <Button data-testid="rq-keep" size={card ? 'row' : 'page'} variant="secondary" onPress={onKeep}>{x.keep}</Button> : null}
        <Button data-testid="rq-choose-again" size={card ? 'row' : 'page'} variant="primary" onPress={onAgain}>{x.chooseAgain}</Button>
      </div>
      {admin ? <AdminRequest /> : null}
    </div>
  );
}

function Result({d, c, onAgain, onClose}: {d: number; c: Conn; onAgain: () => void; onClose: () => void}) {
  const x = t();
  const level = x.levels[provider][grantedLevel(c)].name;
  const ok = !c.narrowed;
  return (
    <>
      {ok || provider === 'atlassian'
        ? <p className="ig-result ok" role="status" data-testid="rq-connected"><Icon name="check" /><span><b>{x.connected(provider === 'atlassian' && c.narrowed ? x.levels.atlassian.full.name : level)}</b> {x.connectedRest}</span></p>
        : null}
      {d === 3 ? <Receipt c={c} /> : null}
      {ok
        ? <Buttons left={null} right={<Button data-testid="rq-done" size="page" variant="primary" onPress={onClose}>{x.done}</Button>} />
        : <Narrowed onAgain={onAgain} onKeep={onClose} />}
    </>
  );
}

/** Direction A's sketch of the consent page: where the choice falls and
 * which permission decides the level. */
function Preview({level}: {level: LevelId}) {
  const x = t();
  const m = x.mock[provider];
  return (
    <section className="rq-preview" data-testid="rq-preview" aria-label={x.asksHead(provider)}>
      <header><b>{x.asksHead(provider)}</b><span className="ig-meta">{x.schematic}</span></header>
      <ol>
        <li><span className="rq-n">1</span><span>{x.asks(provider, level)[0]}</span></li>
        <li><span className="rq-n">2</span><span>{m.where}: <span className="rq-select" aria-hidden="true">{m.pick} ▾</span><span className="ig-meta rq-block">{x.asks(provider, level)[1]}</span></span></li>
        <li><span className="rq-n">3</span><span>{x.perms}
          <span className="rq-perm"><span className="rq-box on" aria-hidden="true"><Icon name="check" /></span>{m.read}</span>
          {level === 'full'
            ? <span className="rq-perm key" data-testid="rq-preview-write"><span className="rq-box on" aria-hidden="true"><Icon name="check" /></span>{m.write}<em>{x.keepSel}</em></span>
            : <span className="rq-perm off"><span className="rq-box" aria-hidden="true" />{m.write}<em>{x.notAsked}</em></span>}
          <span className="ig-meta rq-block">{x.asks(provider, level)[2]}</span></span></li>
      </ol>
    </section>
  );
}

function DirectionDialog({d, flow, set, conn, onClose, onFinish}: {d: number; flow: Flow; set: (f: Flow | null) => void; conn: Conn | null; onClose: () => void; onFinish: (level: LevelId) => void}) {
  const x = t();
  const title = flow.mode === 'again' ? x.titleAgain(x.name[provider]) : x.titleConnect(x.name[provider]);
  const current = flow.mode === 'again' && conn ? conn.requested : undefined;
  const levelPick = <Levels level={flow.level} current={current} onChange={(level) => set({...flow, level})} />;
  const cancel = <Button data-testid="rq-cancel" size="page" variant="secondary" onPress={onClose}>{x.cancel}</Button>;
  const toPaste = () => set({...flow, step: 'paste'});
  const again = () => set({mode: 'again', step: 'intro', level: conn?.requested ?? 'full', stuck: false});
  let body: ReactNode = null;
  const stepIndex = {intro: 0, service: 1, paste: 2, result: 3}[flow.step];
  const steps = d === 2 ? (
    <ol className="ig-steps rq-steps" aria-label={x.stepsLabel} data-testid="rq-steps">
      {x.steps(provider).map((label, i) => (
        <li key={label} className={i < stepIndex ? 'done' : i === stepIndex ? 'now' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
          {i < stepIndex ? <Icon name="check" /> : <span>{i + 1}</span>}<span>{label}</span>
        </li>
      ))}
    </ol>
  ) : null;
  if (flow.step === 'intro') {
    const continueButton = (
      <Button data-testid="rq-continue" size="page" variant="primary" onPress={d === 2 ? () => set({...flow, step: 'service'}) : toPaste}>
        {d === 2 ? x.next : <><Icon name="external" />{x.continueTo(x.name[provider])}</>}
      </Button>
    );
    body = (
      <>
        {flow.mode === 'again' ? <AgainNote /> : null}
        <p className="ig-lead">{x.whatMay}</p>
        {levelPick}
        {d === 1 ? <><Preview level={flow.level} /><EndPage /></> : null}
        {d === 3 ? <p className="ig-p" data-testid="rq-asks-line">{x.asks(provider, flow.level).slice(1).join(' ')} {x.endPage}</p> : null}
        <Buttons left={cancel} right={continueButton} />
      </>
    );
  } else if (flow.step === 'service') {
    body = (
      <>
        <p className="ig-h">{x.inStepLead(provider)}</p>
        <ol className="ig-how rq-how" data-testid="rq-asks">
          {x.asks(provider, flow.level).map((a) => <li key={a}>{a}</li>)}
        </ol>
        <EndPage />
        <Buttons
          left={<Button data-testid="rq-back" size="page" variant="secondary" onPress={() => set({...flow, step: 'intro'})}>{x.back}</Button>}
          right={<OpenService onOpen={toPaste} />} />
      </>
    );
  } else if (flow.step === 'paste') {
    body = <PasteStep flow={flow} set={(f) => set(f)} onCancel={onClose} onDone={() => onFinish(flow.level)} showOpen={d !== 2} />;
  } else if (conn) {
    body = <Result d={d} c={conn} onAgain={again} onClose={onClose} />;
  }
  return <Shell title={title} step={flow.step} onClose={onClose}>{steps}{body}</Shell>;
}

/** The focused provider's card in the directions. */
function RoundCard({d, c, onAgain, onChangeLevel}: {d: number; c: Conn; onAgain: () => void; onChangeLevel: () => void}) {
  const x = t();
  const grant = grantOf(provider, c);
  const level = grantedLevel(c);
  const services = provider === 'trello' ? ['trello'] : ['jira', 'confluence'];
  const access = (id: string) => (id === 'trello' ? level : id === 'jira' ? c.requested : (c.requested === 'full' && !c.narrowed ? 'full' : 'read'));
  const custom = provider === 'atlassian' && c.narrowed;
  return (
    <article className="ig-card rq-card" data-testid="rq-card" data-direction={d} aria-label={`${x.name[provider]} · ${ADDRESS[provider]}`}>
      <div className="ig-acc">
        <ProviderMark provider={provider} />
        <div>
          <span className="ig-rn">{x.name[provider]}</span>
          <span className="ig-meta"><code>{ADDRESS[provider]}</code></span>
        </div>
        <span className={`ig-lv ${level === 'full' && !custom ? 'full' : 'narrow'}`} data-testid="rq-card-level">
          <Icon className="ig-lv-icon" name={level === 'full' && !custom ? 'key' : 'lock'} />
          {custom ? `${x.levels.atlassian.full.name}: Jira` : x.levels[provider][level].name}
        </span>
        {d === 1
          ? <Button data-testid="rq-change" size="row" variant="secondary" onPress={onAgain}>{x.change}</Button>
          : d === 3
            ? <Button data-testid="rq-again" size="row" variant="secondary" onPress={onAgain}>{x.again}</Button>
            : <Button data-testid="rq-change-level" size="row" variant="secondary" onPress={onChangeLevel}>{x.changeLevel}</Button>}
        <Button size="row" variant="quiet"><Icon name="refresh" />{x.check}</Button>
        <Button size="row" variant="quiet">{x.remove}</Button>
      </div>
      {d === 3 ? <Receipt c={c} compact /> : null}
      {c.narrowed ? <Narrowed onAgain={onAgain} card /> : null}
      {d === 2 && !c.narrowed ? (
        <p className="rq-reconsent" data-testid="rq-reconsent"><Icon name="refresh" /><span>{x.reconsentRow(provider)}</span>
          <Button data-testid="rq-again" size="row" variant="secondary" onPress={onAgain}>{x.again}</Button></p>
      ) : null}
      {services.map((id) => (
        <div className="ig-svc" key={id} data-testid={`rq-service-${id}`} data-access={access(id)}>
          <span className="ig-ic sm"><Icon name={id === 'trello' ? 'grid' : id === 'jira' ? 'table' : 'file'} /></span>
          <div><span className="ig-rn">{x.svc[id]}</span><span className="ig-meta">{x.can[access(id)]}</span></div>
          <div className="ig-sv"><StatusMark kind="success" tone="success" label={x.works} /><span className="ig-meta">{x.checkedAt}</span></div>
        </div>
      ))}
      <details className="ig-grant">
        <summary>{x.grantList(grant.granted.length)}</summary>
        <ul>
          {grant.granted.map((s) => <li key={s}><Icon name="check" /><code>{s}</code></li>)}
          {grant.not_granted.map((s) => <li key={s} className="miss"><span aria-hidden="true">–</span><code>{s}</code><span>{x.askedNot}</span></li>)}
        </ul>
      </details>
    </article>
  );
}

/** A display:contents slot after production's card, so the round's card
 * takes its place in production's section. */
function useSlot(selector: string, deps: unknown[]) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const anchor = document.querySelector(selector);
    if (!anchor) { setSlot(null); return; }
    const el = document.createElement('div');
    el.className = 'rq-slot';
    anchor.after(el);
    setSlot(el);
    return () => { el.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return slot;
}

// ---------- The page ----------

function Page({d, s, toast}: {d: number; s: S; toast: (m: string) => void}) {
  const start = initial(s);
  const [conn, setConn] = useState<Conn | null>(start.conn);
  const [flow, setFlow] = useState<Flow | null>(d === 0 ? null : start.flow);
    // Nyt: production's own dialog stages.
  const nytStart = (): ConnectStage | null => {
    if (!start.flow) return null;
    if (start.flow.step === 'intro') return {stage: 'intro'};
    if (start.flow.step === 'paste') return {stage: 'login', view: openView()};
    return {stage: 'login', view: {schema_version: 1, state: 'completed', provider, address: ADDRESS[provider]}};
  };
  const [nyt, setNyt] = useState<ConnectStage | null>(d === 0 ? nytStart() : null);
  const nytLevel = useRef<LevelId>(start.flow?.level ?? 'read');
  const prov = PROVIDERS.find((x) => x.id === provider)!;
  const list = listOf(provider, conn);
  // Nyt starts its situations as production would have reached them.
  useEffect(() => {
    if (d !== 0) return;
    const id = setTimeout(() => {
      if (s === 'uusi-kirjoitus') (document.querySelector('[data-testid="integration-level-full"]') as HTMLElement | null)?.click();
      if (s === 'paluuosoite') (document.querySelector('[data-testid="integration-provider-link"]') as HTMLElement | null)?.click();
    }, 50);
    return () => clearTimeout(id);
  }, [d, s]);
  // A card situation opens with the focused card in view.
  useEffect(() => {
    if (start.flow) return;
    const id = setTimeout(() => {
      const card = document.querySelector(d === 0 ? `[data-testid="integration-account-${provider}"]` : '[data-testid="rq-card"]');
      card?.scrollIntoView({block: 'start'});
      window.scrollBy(0, -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--review-h')) || 0) - 16);
    }, 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** A finished consent gives what was requested: the narrower situations
   * start narrowed, and choosing again with writing kept selected gets it. */
  const finish = (level: LevelId) => setConn({requested: level, narrowed: false, where: provider === 'trello' ? WS_NEW : SITE});
  const slot = useSlot(`[data-testid="integration-account-${provider}"]`, [d, conn === null]);
  const openAgain = () => setFlow({mode: 'again', step: 'intro', level: conn?.requested ?? 'full', stuck: false});
  return (
    <main className="rq-page" data-testid="rq-page">
      <h2 className="rq-h">{lang === 'fi' ? 'Tiedot agenteille' : 'Data for agents'}</h2>
      <div className={d === 0 ? '' : 'rq-replace'}>
        <IntegrationsOverview
          list={list}
          checking={new Set()}
          onCheck={() => {}}
          now={NOW}
          onConnect={(p) => {
            if (p.id !== provider) return toast(lang === 'fi' ? 'Tässä kierroksessa palvelu valitaan yläpalkista.' : 'In this round the service is chosen in the top bar.');
            if (d === 0) setNyt({stage: 'intro'}); else setFlow({mode: 'new', step: 'intro', level: 'read', stuck: false});
          }}
          onSignInAgain={() => {}}
          onChangeLevel={(a) => { if (a.provider === provider && d === 0) setNyt({stage: 'intro', account: a}); }}
          onRemove={() => toast(lang === 'fi' ? 'Poisto ei kuulu tähän kierrokseen.' : 'Removal is not part of this round.')}
        />
      </div>
      {d > 0 && conn && slot ? createPortal(<RoundCard d={d} c={conn} onAgain={openAgain} onChangeLevel={() => setFlow({mode: 'again', step: 'intro', level: conn.requested === 'full' ? 'read' : 'full', stuck: false})} />, slot) : null}
      {d > 0 && flow ? (
        <DirectionDialog d={d} flow={flow} conn={conn}
          set={(f) => setFlow(f)}
          onClose={() => setFlow(null)}
          onFinish={(level) => { finish(level); setFlow({...flow, step: 'result'}); }} />
      ) : null}
      {d === 0 && nyt ? (
        <ConnectDialog
          provider={prov}
          stage={nyt}
          accounts={list.accounts}
          onContinue={(level) => { nytLevel.current = level === 'full' ? 'full' : 'read'; setNyt({stage: 'login', view: openView()}); }}
          onPassword={() => {}}
          onPaste={() => { finish(nytLevel.current); setNyt({stage: 'login', view: {schema_version: 1, state: 'completed', provider, address: ADDRESS[provider]}}); }}
          onFolders={() => {}}
          onRestart={() => setNyt({stage: 'intro'})}
          onClose={() => setNyt(null)}
        />
      ) : null}
    </main>
  );
}
const openView = () => ({schema_version: 1 as const, state: 'open_url' as const, provider, attempt_id: '20261123T091500.000000001', authorization_url: AUTH[provider], redirect_prefix: PREFIX, expires_at: '2099-01-01T00:00:00Z'});

// ---------- Review chrome ----------

let reviewTheme = params.get('theme') === 'dark' ? 'dark' : 'light';
let reviewMotion = 'system';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [motion, setMotion] = useState(reviewMotion);
  const [language, setLanguage] = useState(lang);
  const [p, setP] = useState(provider);
  const [s, setS] = useState(scenario);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState('');
  const bar = useRef<HTMLElement>(null);
  const x = TEXT[language];
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    if (motion === 'reduce') document.documentElement.dataset.motion = 'reduce';
    else delete document.documentElement.dataset.motion;
  }, [motion]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  // A service's page opens in a new tab in production; here it is named.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="https://"]') as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      setMessage(`${x.wouldOpen} ${a.href}`);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, [x]);
  useEffect(() => { if (!message) return; const id = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(id); }, [message]);
  const restart = () => { setMessage(''); setGeneration((g) => g + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={s} data-provider={p}>
      <header className="rq-bar" ref={bar}>
        <strong>{x.title}</strong>
        <label>{x.provider} <select id="provider" value={p} onChange={(e) => { provider = e.target.value as P; setP(provider); restart(); }}>
          {(['trello', 'atlassian'] as const).map((id) => <option key={id} value={id}>{x.providers[id]}</option>)}</select></label>
        <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => { scenario = e.target.value as S; setS(scenario); restart(); }}>
          {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
        <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">{x.light}</option><option value="dark">{x.dark}</option></select></label>
        <label>{x.motion} <select id="motion" value={motion} onChange={(e) => { reviewMotion = e.target.value; setMotion(reviewMotion); }}>
          <option value="system">{x.motionSystem}</option><option value="reduce">{x.motionReduce}</option></select></label>
        <label>{x.language} <select id="language" value={language} onChange={(e) => {
          lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); restart();
        }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={restart}>{x.reset}</button>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <Page key={`${generation}-${p}-${s}-${language}`} d={direction} s={s} toast={setMessage} />
      </div>
      {message ? <p className="rq-toast" role="status" data-testid="rq-toast">{message}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
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
