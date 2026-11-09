import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/composerStack.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage, WaitingMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {Button} from '../../../../web/src/components/Button';
import {ControlButton, controlClassName} from '../../../../web/src/components/ControlElements';
import {TooltipButton} from '../../../../web/src/components/QuickTooltip';
import {InlineNotice} from '../../../../web/src/components/Status';
import {WarningBanner, type WarningTone} from '../../../../web/src/components/WarningBanner';
import {StatusBellProvider, type StatusItem} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {ProcessProvider} from '../../../../web/src/components/ProcessTray';
import {BackgroundStrip, type WorkerAsk} from '../../../../web/src/components/BackgroundStrip';
import {SpinoffContext} from '../../../../web/src/components/Spinoffs';
import type {Spinoff} from '../../../../web/src/app/spinoffs';
import {AISignInWarning} from '../../../../web/src/app/AISignIn';
import {enabled, type TimelineItem} from '../../../../web/src/components/types';
import {setPersonalLanguage, textNow} from '../../../../web/src/i18n';
import {browserConversationText} from '../../../../web/src/text/browserConversation';
import {conversationActionsText} from '../../../../web/src/text/conversationActions';
import {conversationText} from '../../../../web/src/text/conversation';
import {attachmentsText} from '../../../../web/src/text/attachments';
import {aiSignInText} from '../../../../web/src/text/aiSignIn';
import {statusText} from '../../../../web/src/text/status';
import {composerText} from '../../../../web/src/text/composer';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-notices-one-system, round 1. Jari 9.11.2026: warnings and notices
// are inconsistent; the same situation can draw a red warning, a bare line,
// a grey line that vanishes after six seconds, a box in the timeline and a
// dashed bubble at once. "Nyt" rebuilds today's markup from the production
// components and catalogs. The three directions share one system (four
// kinds = WarningBanner's four tones, one notice per subject, lifetime =
// the condition) and differ on one axis: where a conversation's notices sit.
const directions = ['Nyt', 'A Kentän yllä', 'B Asian luona', 'C Yksi rivi'];
const LINES = [
  'Nyt: jokainen tilanne omalla tavallaan: punainen varoitus, paljas punainen rivi, harmaa rivi joka katoaa, laatikko aikajanalla, katkoviivakupla.',
  'A Kentän yllä: kaikki tämän keskustelun ilmoitukset yhdessä pinossa viestikentän yllä, vakavin ensin, kaksi näkyvissä; koko tilin asiat palkkina ylhäällä.',
  'B Asian luona: sama varoitus sen vieressä, mitä se koskee: viestin alla, liiterivillä, workerien rivillä; koko tilin asiat palkkina ylhäällä.',
  'C Yksi rivi: viestikentän yllä yksi rivi, vakavin ensin ja montako muuta; Näytä avaa kaikki. Koko tilin asiat ovat kellossa.',
];

type Case = 'kaikki' | 'epavarma' | 'torjuttu' | 'liite' | 'tallennus' | 'tila' | 'kirjautuminen' | 'historia' | 'worker';
const CASES: [Case, string][] = [
  ['kaikki', 'Kaikki kerralla'],
  ['epavarma', 'Lähetys epävarma'],
  ['torjuttu', 'Lähetys torjuttu'],
  ['liite', 'Liite torjuttu'],
  ['tallennus', 'Tallennus katkesi'],
  ['tila', 'Tallennustila täynnä'],
  ['kirjautuminen', 'Kirjautuminen vanhentunut'],
  ['historia', 'Historiaa ei saada'],
  ['worker', 'Worker odottaa'],
];
const has = (c: Case, ...xs: Case[]) => xs.includes(c) || (c === 'kaikki' && xs.some((x) => KAIKKI.includes(x)));
/** The morning of 9.11. at once: the uncertain send with its history, a
 * refused attachment, an expired Claude sign-in and a waiting worker. */
const KAIKKI: Case[] = ['epavarma', 'historia', 'liite', 'kirjautuminen', 'worker'];

// Production strings, read from the catalogs as they are today.
const bc = textNow(browserConversationText);
const ca = textNow(conversationActionsText);
const cv = textNow(conversationText);
const at = textNow(attachmentsText);
const ai = textNow(aiSignInText).services['claude-bridge'];
const st = textNow(statusText);
const cp = textNow(composerText);

// ---- The system: one notice per subject ----
type Place = 'host' | 'conversation' | 'draft';
/** What the notice is about; B draws it beside that. */
type About = 'message' | 'attachments' | 'strip' | 'send' | 'account';
type Note = {
  key: string; tone: WarningTone; place: Place; about: About;
  title: string; body: string; short?: string;
  /** The newest fact merged into the notice; C's line shows it. */
  latest?: string;
  action?: {label: string; testId: string; primary?: boolean; onPress?: () => void};
  dismiss?: () => void;
};
const rank: Record<WarningTone, number> = {danger: 0, neutral: 1, progress: 2, success: 3};
const placeRank: Record<Place, number> = {host: 0, draft: 1, conversation: 2};
const order = (xs: Note[]) => [...xs].sort((a, b) => rank[a.tone] - rank[b.tone] || placeRank[a.place] - placeRank[b.place]);

const MSG = 'Tässä ne isot liitteet. Varoitus toimii.';
const PING = 'ping';
const FILE = 'kokous-2026-11-07.mov';
const UPLOAD = 'raportti.pdf';
const WORKER = 'sharepoint-review';
const ref = (name: string, n: number) => `[${name}](/api/v1/attachments/0f6c1b7e-2a10-4d3c-9e55-3f6c1b7e2a${String(10 + n)})`;
const DRAFT_FILES = `${ref('kuvakaappaus-1.png', 1)}\n${ref('kuvakaappaus-2.png', 2)}`;

type World = {c: Case; ping: boolean; checked: boolean; dismissed: Record<string, boolean>; set: (p: Partial<Omit<World, 'c' | 'set'>>) => void};

/** The notices the system gives for a case. Merging happens here: a later
 * fact about the same subject extends the one notice instead of adding one. */
function notes(w: World): Note[] {
  const {c} = w;
  const out: Note[] = [];
  const check = {label: w.checked ? 'Tarkista uudelleen' : 'Tarkista', testId: 'fix-check', onPress: () => w.set({checked: true})};
  const pingLine = w.ping ? ` Uutta viestiäsi ei lähetetty: ensin pitää selvitä, menikö edellinen perille. Se odottaa kentässä.` : '';
  const pingShort = w.ping ? ' Uutta viestiäsi ei lähetetty; se odottaa kentässä.' : '';
  if (has(c, 'historia')) {
    out.push({key: 'message', tone: 'neutral', place: 'conversation', about: 'message',
      title: 'Keskustelun historiaa ei saada luettua',
      body: (w.checked ? 'Tarkistettu juuri: historiaa ei vieläkään saada. ' : 'Palvelin ei pystynyt lukemaan tallennettua historiaa. ')
        + 'Mitään ei ole kadonnut. Jos sama toistuu, kerro ylläpitäjälle.'
        + (has(c, 'epavarma') ? ' Siksi ei myöskään tiedetä, saiko agentti viimeisen viestisi; sitä ei lähetetä uudelleen itsestään.' : '') + pingLine,
      short: 'Mitään ei ole kadonnut. Jos sama toistuu, kerro ylläpitäjälle.' + pingShort,
      latest: w.ping ? 'uutta viestiäsi ei lähetetty' : undefined,
      action: check});
  } else if (has(c, 'epavarma')) {
    out.push({key: 'message', tone: 'neutral', place: 'conversation', about: 'message',
      title: 'Ei tiedossa, saiko agentti viestisi',
      body: (w.checked
        ? 'Tarkistettu juuri: viesti ei näy keskustelussa, mutta ei myöskään varmistunut, ettei agentti saanut sitä.'
        : 'Yhteys katkesi kesken lähetyksen.')
        + ' Viestiä ei lähetetä uudelleen itsestään. Jos varmistuu, ettei se mennyt perille, se lähetetään kerran uudelleen.' + pingLine,
      short: 'Yhteys katkesi kesken lähetyksen. Viestiä ei lähetetä uudelleen itsestään.' + pingShort,
      latest: w.ping ? 'uutta viestiäsi ei lähetetty' : undefined,
      action: check});
  }
  if (has(c, 'torjuttu') && !w.dismissed.send)
    out.push({key: 'send', tone: 'danger', place: 'draft', about: 'send', title: 'Viestiä ei lähetetty',
      body: 'Agentti ehti aloittaa työn juuri ennen lähetystä. Teksti on taas kentässä: lähetä se uudelleen, niin se menee ohjauksena.',
      dismiss: () => w.set({dismissed: {...w.dismissed, send: true}})});
  if (has(c, 'liite') && !w.dismissed.attachments)
    out.push({key: 'attachments', tone: 'danger', place: 'draft', about: 'attachments', title: `${FILE} on liian suuri`,
      body: 'Tiedosto on 34 Mt, ja liite voi olla enintään 20 Mt. Pienennä tai pakkaa tiedosto, tai jaa se osiin.',
      short: 'Liite voi olla enintään 20 Mt.',
      dismiss: () => w.set({dismissed: {...w.dismissed, attachments: true}})});
  if (has(c, 'tallennus') && !w.dismissed.attachments)
    out.push({key: 'attachments', tone: 'danger', place: 'draft', about: 'attachments', title: `${UPLOAD} jäi tallentamatta`,
      body: 'Yhteys palvelimeen katkesi kesken tallennuksen. Muut liitteet ovat tallessa.',
      action: {label: 'Yritä uudelleen', testId: 'fix-retry', onPress: () => w.set({dismissed: {...w.dismissed, attachments: true}})},
      dismiss: () => w.set({dismissed: {...w.dismissed, attachments: true}})});
  if (has(c, 'tila'))
    out.push({key: 'storage', tone: 'danger', place: 'host', about: 'account', title: 'Tallennustilasi on täynnä',
      body: `Uudet liitteet ja agenttien tallennukset epäonnistuvat, kunnes tilaa vapautuu. ${UPLOAD} jäi siksi liittämättä. Vapauta tilaa roskakorista tai pyydä agenttia siivoamaan tarpeettomia tiedostoja.`,
      short: 'Liitteet ja tallennukset epäonnistuvat.',
      action: {label: st.storageOpen, testId: 'fix-storage'}});
  if (has(c, 'kirjautuminen'))
    out.push({key: 'signin', tone: 'danger', place: 'host', about: 'account', title: ai.title, body: ai.cause, short: ai.short,
      action: {label: ai.fix, testId: 'fix-signin', primary: true}});
  if (has(c, 'worker'))
    out.push({key: 'worker', tone: 'neutral', place: 'conversation', about: 'strip', title: `${WORKER} odottaa sinua`,
      body: 'Worker kysyy, kumpi sivustorakenne otetaan. Vastaa sen omassa keskustelussa.',
      short: 'Worker kysyy sinulta.',
      action: {label: 'Avaa', testId: 'fix-open'}});
  return order(out);
}

/** One notice, one look: the shared warning. */
function NoteView({n, line, extra}: {n: Note; line?: boolean; extra?: React.ReactNode}) {
  return (
    <WarningBanner data-testid={`note-${n.key}`} data-state={n.place} tone={n.tone} title={line ? undefined : n.title} short={line ? undefined : n.short}
      actions={(n.action || n.dismiss || extra) ? <>
        {extra}
        {n.action ? <ControlButton data-testid={n.action.testId} size="row" variant={n.action.primary ? 'primary' : 'secondary'} onPress={n.action.onPress ?? (() => {})}>{n.action.label}</ControlButton> : null}
        {n.dismiss ? <Dismiss onPress={n.dismiss} /> : null}
      </> : undefined}>
      {line ? n.title : n.body}
    </WarningBanner>
  );
}
function Dismiss({onPress, label = 'Sulje ilmoitus'}: {onPress: () => void; label?: string}) {
  return (
    <TooltipButton className={controlClassName({size: 'inline', presentation: 'icon', variant: 'quiet'})}
      data-testid="fix-dismiss" aria-label={label} title={label} onClick={onPress}><Icon name="cross" /></TooltipButton>
  );
}

// ---- The bell: account-wide conditions, the same in every direction ----
const bell = (c: Case): StatusItem[] => [
  ...(has(c, 'kirjautuminen') ? [{key: 'ai-sign-in-claude-bridge', tone: 'danger' as const, icon: 'warning' as const, group: 'own' as const,
    short: ai.bell, title: ai.title, meta: ai.short, body: ai.cause, actions: [{label: ai.fix, primary: true}]}] : []),
  ...(has(c, 'tila') ? [{key: 'storage', tone: 'danger' as const, icon: 'warning' as const, group: 'own' as const,
    short: st.full, title: st.fullTitle(st.yourStorage), body: st.storageBody(false, true, true, false), actions: [{label: st.storageOpen}]}] : []),
  ...(c === 'kaikki' ? [{key: 'storage', tone: 'warning' as const, icon: 'warning' as const, group: 'own' as const,
    short: st.near, title: st.nearTitle(st.yourStorage, false, 86), body: st.storageBody(false, false, false, false), actions: [{label: st.storageOpen}]}] : []),
];

// ---- Workers: one waits for the person ----
const T0 = Date.now();
const ago = (min: number) => new Date(T0 - min * 60000).toISOString();
const PARENT_ID = 'pi:8566f3ca-6a82-41d6-810e-d2c75b8d8a59';
const RUNS: Spinoff[] = [
  {run_id: '01m6wbl1'.padEnd(26, '0'), title: WORKER, created_at: ago(48), state: 'idle', preserved: false, branch: `wt/${WORKER}`,
    worktree: `/home/maintainer/src/open-habitat__worktrees/wt-${WORKER}`, source_branch: 'main', summary: '', harness: 'claude', profile: 'prototype-opus'},
  {run_id: '01m6wbl2'.padEnd(26, '0'), title: 'm365-site-sync', created_at: ago(20), state: 'working', preserved: false, branch: 'wt/m365-site-sync',
    worktree: '/home/maintainer/src/open-habitat__worktrees/wt-m365-site-sync', source_branch: 'main', summary: '', harness: 'pi', profile: 'nopea'},
];
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path.endsWith('/processes'))
    return json({schema_version: 1, owner_generation: 'og_proto', availability: 'available', unavailable_reason: null, processes: [], interrupted: []});
  return new Response('', {status: 404});
};

// ---- The conversation ----
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'open-habitat',
};
type Item = TimelineItem & {kind: string};
const user = (id: string, text: string, time: string, state?: string): Item => ({id, kind: 'user',
  content: <UserMessage sourceText={text} onCopy={noop} time={time} deliveryState={state} deliveryTone={state ? 'warning' : 'neutral'}><Markdown text={text} /></UserMessage>});
const agent = (id: string, text: string, time: string): Item =>
  ({id, kind: 'assistant', content: <AssistantMessage streamState="complete" time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>});
const HISTORY: Item[] = [
  user('u1', 'Tarkista kuvakaappaukset ja kerro, miksi liitteiden varoitus näkyy kahdesti.', '9.31'),
  agent('a1', 'Varoitus näkyy kahdesti, koska yhteisraja tarkistetaan sekä liitettäessä että lähetettäessä. Korjasin sen niin, että raja tarkistetaan vain liitettäessä. Lähetä isot kuvat uudelleen, niin näet, toimiiko.', '9.38'),
];
const TITLE = 'Isot liitteet 9.11.';

function Main({d, c}: {d: number; c: Case}) {
  const uncertain = has(c, 'epavarma');
  const [draft, setDraft] = useState(() => initialDraft(c));
  const [w, setW] = useState<Omit<World, 'c' | 'set'>>({ping: false, checked: false, dismissed: {}});
  const set = (p: Partial<Omit<World, 'c' | 'set'>>) => setW((o) => ({...o, ...p}));
  const world: World = {c, ...w, set};
  const [cOpen, setCOpen] = useState(false);
  const [aMore, setAMore] = useState(false);
  const stream = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const bottom = () => { const el = stream.current; if (el) el.scrollTop = el.scrollHeight; };
    bottom();
    const timers = [0, 80, 250].map((t) => window.setTimeout(bottom, t));
    return () => timers.forEach(clearTimeout);
  }, [w, cOpen, aMore]);

  const all = notes(world);
  const host = all.filter((n) => n.place === 'host');
  const local = all.filter((n) => n.place !== 'host');
  const now = d === 0;

  // The message whose delivery is the subject.
  const sent = uncertain
    ? now
      ? {id: 'u2', kind: 'user', content: <WaitingMessage text={MSG} state="uncertain" onCopy={noop} />}
      : user('u2', MSG, '9.45', cv.deliveryUncertain)
    : user('u2', MSG, '9.45');
  const reply = uncertain ? [] : [agent('a2', 'Sain kaikki kuusi kuvaa. Varoitus näkyy nyt kerran, liitettäessä, ja lähetys menee läpi.', '9.47')];
  const besideMessage = d === 2 ? local.filter((n) => n.about === 'message') : [];
  const items: Item[] = [...HISTORY, sent, ...reply,
    ...besideMessage.map((n) => ({id: `n-${n.key}`, kind: 'notice', content: <div className="nt-beside"><NoteView n={n} /></div>}))];

  // ---- Today's markup, as BrowserConversation and Composer draw it ----
  const nowStack = now ? (
    <>
      <div className="ah-actionable-notices">
        {has(c, 'kirjautuminen') ? <AISignInWarning provider="claude-bridge" onFix={noop} /> : null}
      </div>
      {has(c, 'historia') ? (
        <div className="ah-status-check">
          <WarningBanner data-testid="history-unavailable" tone="danger" title={bc.historyUnavailable}
            actions={<Button data-testid="conversation-recheck" size="row" variant="secondary" label={bc.recheck} onPress={() => set({checked: true})} />}>
            {w.checked ? bc.historyStillUnavailable : bc.historyUnavailableDetail}{uncertain ? ` ${bc.historyUnavailableSend}` : null}
          </WarningBanner>
        </div>
      ) : uncertain ? (
        <div className="ah-status-check">
          <WarningBanner data-testid="send-uncertain" tone="neutral" title={bc.sendUncertain}
            actions={<Button data-testid="conversation-recheck" size="row" variant="secondary" label={bc.recheck} onPress={() => set({checked: true})} />}>
            {w.checked ? bc.sendStillUnknown : bc.sendUncertainDetail}
          </WarningBanner>
        </div>
      ) : null}
      <div className="ah-conversation-notices">
        {has(c, 'torjuttu') ? <InlineNotice data-testid="send-receipt" title={ca.sendRefusal} tone="warning" /> : null}
      </div>
    </>
  ) : null;
  const nowBare = (text: string) => (
    <p role="alert" data-testid="attachment-refusal">
      {text}{' '}
      <TooltipButton className={controlClassName({size: 'inline', presentation: 'icon', variant: 'quiet'})}
        data-testid="attachment-refusal-dismiss" aria-label={cp.dismissAttachmentRefusal} title={cp.dismissAttachmentRefusal}
        onClick={() => set({dismissed: {...w.dismissed, bare: true}})}><Icon name="cross" /></TooltipButton>
    </p>
  );
  const nowDraft = now && !w.dismissed.bare
    ? has(c, 'liite') ? nowBare(at.overLimit(FILE, '34 Mt'))
      : has(c, 'tallennus') ? nowBare('Failed to fetch')
        : has(c, 'tila') ? nowBare(at.refused) : null
    : null;

  // ---- The directions ----
  const draftNotes = local.filter((n) => n.place === 'draft');
  const stripNotes = local.filter((n) => n.about === 'strip');
  let aboveComposer: React.ReactNode = null;
  if (d === 1) {
    const shown = aMore ? local : local.slice(0, 2);
    aboveComposer = local.length ? (
      <div className="ah-actionable-notices nt-stack" data-testid="nt-stack">
        {shown.map((n) => <NoteView key={n.key} n={n} />)}
        {local.length > 2 ? (
          <button type="button" className="nt-more" data-testid="nt-more" onClick={() => setAMore(!aMore)}>
            {aMore ? 'Näytä vähemmän' : local.length - 2 === 1 ? 'Näytä 1 muu ilmoitus' : `Näytä ${local.length - 2} muuta ilmoitusta`}
          </button>
        ) : null}
      </div>
    ) : null;
  }
  if (d === 3) {
    const every = order([...host, ...local]);
    const top = every[0];
    aboveComposer = top ? (
      <div className="ah-actionable-notices nt-stack" data-testid="nt-stack">
        {cOpen ? every.map((n) => <NoteView key={n.key} n={n} />) : (
          <WarningBanner data-testid="nt-line" tone={top.tone}
            actions={<>
              {every.length > 1 ? <span className="nt-count" data-testid="nt-count">+{every.length - 1}</span> : null}
              <ControlButton data-testid="nt-show" size="row" variant="quiet" onPress={() => setCOpen(true)}>Näytä</ControlButton>
            </>}>
            {top.title}{top.latest ? ` · ${top.latest}` : ''}
          </WarningBanner>
        )}
        {cOpen ? <button type="button" className="nt-more" data-testid="nt-less" onClick={() => setCOpen(false)}>Näytä yksi rivi</button> : null}
      </div>
    ) : null;
  }
  const pageStrip = (d === 1 || d === 2) && host.length ? (
    <div className="nt-page" data-testid="nt-page">{host.map((n) => (
      <WarningBanner key={n.key} data-testid={`note-${n.key}`} placement="page" tone={n.tone} title={n.title} short={n.short}
        actions={n.action ? <ControlButton data-testid={n.action.testId} size="row" variant={n.action.primary ? 'primary' : 'secondary'} onPress={noop}>{n.action.label}</ControlButton> : undefined}>
        {n.body}
      </WarningBanner>
    ))}</div>
  ) : null;

  const workers = has(c, 'worker');
  const ask: WorkerAsk = {phases: {}, target: 'here', send: noop,
    ...(now && workers ? {problem: 'Pyyntöä ei lähetetty: Odota vahvistettua joutotilaa.'} : {})};
  const strip = workers ? (
    <SpinoffContext.Provider value={{data: {schema_version: 1, parent_id: PARENT_ID, availability: 'available', runs: RUNS, transcripts: []}, open: noop}}>
      <BackgroundStrip agentIdle ask={ask} />
    </SpinoffContext.Provider>
  ) : null;
  const beforeField = (
    <>
      {strip}
      {d === 2 ? stripNotes.map((n) => <NoteView key={n.key} n={n} />) : null}
      {d === 2 ? draftNotes.map((n) => <NoteView key={n.key} n={n} />) : null}
      {nowDraft}
    </>
  );
  // Today the refused ping is the composer's own six-second line; in the
  // directions it extends the notice about the message it waits for.
  const send = (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t) return;
    if (uncertain) { set({ping: true}); return; }
    if (has(c, 'torjuttu')) { set({dismissed: {...w.dismissed, send: true}}); }
    setDraft('');
  };
  const nowBlocked = now && uncertain ? {state: 'disabled' as const, reason: bc.waitIdleUncertain} : enabled;

  const t = Date.now();
  const nav = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/ws_oh?conversation=${m.agentId}`, workspaceId: 'ws_oh', workspaceName: 'open-habitat', activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: t - 5 * 60000, ...m,
  });
  const running: AgentNavModel[] = [
    nav({agentId: 'isot', title: TITLE, selected: true, detail: 'open-habitat · Odottaa viestiä'}),
    nav({agentId: 'speksit', title: 'Arkistolistan speksit', changedAt: t - 70 * 60000, detail: 'open-habitat · Odottaa viestiä'}),
  ];
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Testipalvelin" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari" onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now" data-testid="rail-running" aria-labelledby="nt-running">
          <h2 className="ah-rail-section-head" id="nt-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
          <ul>{running.map((m) => <AgentNavItem key={m.agentId} {...m} now={t} />)}</ul>
        </section>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_hb" />
      <WorkspaceNavRow name="open-habitat" href="/workspaces/ws_oh" />
    </WorkspaceRail>
  );
  const timelineState = now && has(c, 'historia') ? 'stale' : 'ready';
  const main = (
    <div className="ah-state nt-main">
      <ConversationFrame>
        <AgentHeader title={TITLE} workspaceLabel="open-habitat" workspaceHref="/workspaces/ws_oh"
          activityLabel="Odottaa viestiä" activityKind="neutral" controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
        <ConversationStream streamRef={stream}>
          <ConversationTimeline state={timelineState} items={items} historyMode="pagedAccessible" onJumpToLatest={noop} />
        </ConversationStream>
        <div className="ah-composer-stack">
          {nowStack}
          {aboveComposer}
          <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer"
            availability={nowBlocked} editorAvailability={enabled} suppressAvailabilityReason={now && uncertain}
            onModeChange={noop} onSendNow={send} onSteer={send} onFollowUp={send}
            onInterrupt={noop} sources={sources} csrf="prototype" beforeField={beforeField} />
        </div>
      </ConversationFrame>
    </div>
  );
  return (
    <StatusBellProvider items={bell(c)}>
      <AppShell mobileTitle={TITLE} navigationBadge={0} rail={railView} connection={pageStrip}
        main={<ProcessProvider id={PARENT_ID} csrf="prototype" onLogin={noop} onStatusEvent={() => noop}>{main}</ProcessProvider>} />
    </StatusBellProvider>
  );
}
function initialDraft(c: Case) {
  if (has(c, 'epavarma')) return PING;
  if (has(c, 'torjuttu')) return 'Jatka samalla tavalla toisessa speksissä.';
  if (has(c, 'liite', 'tallennus')) return `Tässä kokouksen aineisto.\n${DRAFT_FILES}`;
  return '';
}

let reviewTheme = 'light';
let reviewCase: Case = 'kaikki';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [c, setC] = useState<Case>(reviewCase);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-case={c}>
      <header className="rq-bar" ref={bar}>
        <strong>Ilmoitukset · kierros 1</strong>
        <label>Tapaus <select id="case" value={c} onChange={(e) => { reviewCase = e.target.value as Case; setC(reviewCase); }}>
          {CASES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter initialEntries={['/workspaces/ws_oh?conversation=isot']}>
          <Main key={c} d={direction} c={c} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(v: React.ReactNode) { flushSync(() => root.render(v === '' ? null : v)); }};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const pickerNav = document.createElement('nav');
pickerNav.className = 'proto-picker'; pickerNav.setAttribute('aria-label', 'Prototype variants');
pickerNav.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  pickerNav.append(button);
});
document.body.append(pickerNav);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
