import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import {AssistantMessage, Composer, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader} from '../../../../web/src/components/Navigation';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {WorkspaceIcon, type WorkspaceIconModel} from '../../../../web/src/components/WorkspaceIcon';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {IDS, type Lang, nativeText, type Step, type Target, TEXT, type Text} from './text';
import './round.css';

// agent-agent-message, round 1 (Jari 24.11.2026: "send that agent this
// message"). The host can already do it (open-habitat agent message create);
// what is missing is how the exchange looks. Axis: how much of the exchange
// each side shows. Now (today), A Letter, B Line, C Round trip. Both
// conversations are on the page side by side, as Jari has them; the
// recipient's state (idle, busy, stopped, archived) and the step (sent,
// answered) are review controls. Header, messages, tool rows, timeline,
// composer, its queue and the workspace icon are production; the incoming
// card, the Habitat lines and the sent card are this round's, on tokens only.

type Review = {theme: string; lang: Lang; target: Target; step: Step};
let review: Review = {theme: 'light', lang: 'fi', target: 'idle', step: 'answered'};
const listeners = new Set<() => void>();
const setReview = (r: Partial<Review>) => { review = {...review, ...r}; listeners.forEach((l) => l()); };
const useReview = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => review);
const noop = () => {};
setPersonalLanguage('fi');

const NOW = 0, A = 1, B = 2, C = 3;
const senderIcon: WorkspaceIconModel = {name: 'raportit', glyph: {letters: 'Ra', hue: 3}, show: {kind: 'glyph'}, source: 'derived'};

type Row = {id: string; kind: string; content: ReactNode};
const row = (id: string, kind: string, content: ReactNode): Row => ({id, kind, content: <div data-item={id}>{content}</div>});
const assistant = (id: string, time: string, text: string, extra?: ReactNode, streaming = false) =>
  row(id, 'assistant', <div className="aam-msg">{extra}<AssistantMessage streamState={streaming ? 'streaming' : 'complete'} time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage></div>);
const user = (id: string, time: string, text: string, waiting?: 'waiting') =>
  row(id, 'user', <UserMessage sourceText={text} time={time} waiting={waiting} onCopy={noop} />);
const tools = (id: string, list: {name: string; path: string; state?: string; label: string; error?: string}[]) =>
  row(id, 'tools', <div className="aam-tools">{list.map((x, k) => <ToolRow key={k} name={x.name} targetText={x.path} statusLabel={x.label} state={x.state ?? 'succeeded'} errorSummary={x.error} expanded={false} onToggle={noop} />)}</div>);

// ---------- This round's pieces ----------

function Letter({t, time, waiting, flash}: {t: Text; time: string; waiting?: boolean; flash: number}) {
  return (
    <article className="aam-letter" data-testid="agent-letter" data-flash={flash || undefined} key={flash} aria-label={`${t.letterFrom} ${t.senderTitle}`}>
      <header>
        <WorkspaceIcon icon={senderIcon} size="m" />
        <span className="aam-letter-from">{t.letterFrom} <a href="#oh-sender" data-testid="letter-link">{t.senderTitle}</a></span>
        <time>{time}</time>
        {waiting ? <span className="aam-state" data-testid="letter-waiting">{t.letterWaiting}</span> : null}
      </header>
      <div className="ah-prose"><Markdown text={t.msg} /></div>
      <p className="aam-letter-note">{t.letterNote}</p>
    </article>
  );
}

function IncomingLine({t, time, waiting, flash}: {t: Text; time: string; waiting?: boolean; flash: number}) {
  return (
    <div className="aam-in-line" data-testid="agent-line" data-flash={flash || undefined} key={flash}>
      <p className="ah-mp-line" role="note">
        <span className="ah-mp-line-mark" aria-hidden="true" />
        <span>{t.lineFrom[0]}<a href="#oh-sender" data-testid="letter-link">{t.senderTitle}</a>{t.lineFrom[1]} · <time>{time}</time>{waiting ? ` · ${t.letterWaiting}` : ''}</span>
      </p>
      <blockquote className="ah-prose"><Markdown text={t.msg} /></blockquote>
    </div>
  );
}

function SentLine({t, target}: {t: Text; target: Target}) {
  const state = target === 'busy' ? t.lineQueued : target === 'stopped' ? t.lineHeld : t.lineTaken;
  return (
    <p className="ah-mp-line aam-sent-line" role="note" data-testid="sent-line">
      <span className="ah-mp-line-mark" aria-hidden="true" />
      <span>{t.lineSent[0]}<a href="#oh-receiver" data-testid="sent-link">{t.receiverTitle}</a>{t.lineSent[1]} · {state}</span>
    </p>
  );
}

function SentCard({t, target, step}: {t: Text; target: Target; step: Step}) {
  const answered = step === 'answered';
  const state = answered ? t.cardStates.answered(target === 'busy' ? '9.44' : '9.42')
    : target === 'busy' ? t.cardStates.queued : target === 'stopped' ? t.cardStates.pending : t.cardStates.taken;
  return (
    <article className="aam-card" data-testid="sent-card" data-answered={answered || undefined}>
      <header>
        <span className="aam-card-to">{t.cardTo} <a href="#oh-receiver" data-testid="sent-link">{t.receiverTitle}</a></span>
        <span className="aam-state" data-testid="sent-state" data-tone={answered ? 'ok' : undefined}>{state}</span>
      </header>
      <p className="aam-card-text">{t.msg.replace(/`/g, '')}</p>
      {answered ? (
        <div className="aam-card-reply" data-testid="sent-reply">
          <strong>{t.cardAnswered(t.receiverTitle)}</strong>
          <p>{t.replyShort}</p>
          <a href="#oh-receiver">{t.cardOpen}</a>
        </div>
      ) : null}
    </article>
  );
}

// ---------- The two conversations ----------

function senderRows(d: number, t: Text, target: Target, step: Step): Row[] {
  const delivery = target === 'busy' ? 'follow-up' : 'send';
  const refused = target === 'archived';
  const cmd = `open-habitat agent message create --conversation ${IDS.receiver} --delivery ${delivery} --text-file -`;
  const rows = [user('s-u1', '9.38', t.ask)];
  if (d !== B) rows.push(tools('s-t1', [
    {name: 'bash', path: 'open-habitat agent conversation list', label: t.done},
    {name: 'bash', path: cmd, label: refused ? t.failed : t.done, state: refused ? 'failed' : 'succeeded', error: refused ? '409 control_uncertain' : undefined},
  ]));
  else rows.push(tools('s-t1', [{name: 'bash', path: 'open-habitat agent conversation list', label: t.done}]));
  if (d === B && !refused) rows.push(row('s-line', 'line', <SentLine t={t} target={target} />));
  if (d === B && refused) rows.push(tools('s-t2', [{name: 'bash', path: cmd, label: t.failed, state: 'failed', error: '409 control_uncertain'}]));
  if (d === C && !refused) rows.push(row('s-card', 'card', <SentCard t={t} target={target} step={step} />));
  rows.push(assistant('s-a1', '9.39', d === NOW ? t.sentToday[target] : t.sent[target]));
  return rows;
}

function receiverRows(d: number, t: Text, target: Target, step: Step, flash: number): {rows: Row[]; working: boolean; queue?: string[]} {
  const rows = [user('r-u0', '9.05', t.earlierAsk), assistant('r-a0', '9.07', t.earlierReply)];
  if (target === 'archived') return {rows, working: false};
  const answered = step === 'answered';
  const at = target === 'busy' ? '9.41' : '9.39';
  if (target === 'busy') {
    rows.push(user('r-u1', '9.36', t.busyAsk));
    if (!answered) {
      rows.push(tools('r-t0', [{name: 'edit', path: 'charts/chart1.py', label: t.running, state: 'running'}]));
      rows.push(assistant('r-a1s', '9.39', t.busyStreaming, undefined, true));
      // Pi's queue shows the text; with the design the daemon gives the sender too.
      return {rows, working: true, queue: [d === NOW ? t.msg : t.queuedFrom(t.senderTitle) + t.msg]};
    }
    rows.push(tools('r-t0', [{name: 'edit', path: 'charts/chart1.py', label: t.done}]));
    rows.push(assistant('r-a1', '9.40', t.busyReply));
  }
  const waiting = target === 'stopped' && !answered;
  if (d === NOW) rows.push(user('r-in', at, t.msg, waiting ? 'waiting' : undefined));
  else if (d === B) rows.push(row('r-in', 'agent', <IncomingLine t={t} time={at} waiting={waiting} flash={flash} />));
  else rows.push(row('r-in', 'agent', <Letter t={t} time={at} waiting={waiting} flash={flash} />));
  if (!answered) return {rows, working: target !== 'stopped'};
  const done = target === 'busy' ? '9.44' : '9.42';
  rows.push(tools('r-t1', [
    {name: 'read', path: 'data/q3.csv', label: t.done},
    {name: 'edit', path: 'charts/chart2.py', label: t.done},
    {name: 'bash', path: 'python charts/chart2.py --out charts/q3.svg', label: t.done},
  ]));
  rows.push(assistant('r-a2', done, d === NOW ? t.replyToday : t.reply,
    d === C ? <p className="aam-reply-tag" data-testid="reply-tag">{t.replyTag(t.senderTitle)}</p> : undefined));
  return {rows, working: false};
}

function Pane({side, t, title, ws, activity, kind, rows, queue, working, children}: {
  side: 'sender' | 'receiver'; t: Text; title: string; ws: string; activity: string; kind?: 'working' | 'read-only';
  rows: Row[]; queue?: string[]; working?: boolean; children?: ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Open at the latest entry, as the app does.
    const box = stream.current?.querySelector('.ah-stream, [class*="stream"]') as HTMLElement | null;
    let el: HTMLElement | null = stream.current?.querySelector('[data-testid="conversation-timeline"]') ?? null;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    (el ?? box)?.scrollTo({top: 1e6});
  });
  return (
    <section className="aam-pane" data-testid={side} aria-label={side === 'sender' ? t.sender : t.receiver}>
      <h2 className="aam-pane-label">{side === 'sender' ? t.sender : t.receiver}</h2>
      <div className="aam-frame" ref={stream}>
        <ConversationFrame>
          <AgentHeader title={title} workspaceLabel={ws} workspaceHref={`/workspaces/ws_${ws}`} activityLabel={activity}
            activityKind={kind} activityAnimated={kind === 'working'} controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          <ConversationStream>
            <ConversationTimeline state="ready" items={rows} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          <Composer value={draft} onChange={setDraft} activity={working ? 'working' : 'idle'} selectedWorkingMode="follow_up" onModeChange={noop}
            onSendNow={noop} onSteer={noop} onFollowUp={noop} csrf="prototype" queue={queue ? {steering: [], followUp: queue} : undefined}
            modelPicker={<button type="button" className="md-pill">medium</button>} />
        </ConversationFrame>
      </div>
      {children}
    </section>
  );
}

function Live({d}: {d: number}) {
  const {lang, target, step} = useReview();
  const t = TEXT[lang];
  const [flash, setFlash] = useState({to: '', n: 0});
  const scope = useRef<HTMLDivElement>(null);
  // Links between the panes: the round's stand-in for the app's
  // conversation route. Nothing navigates; the other pane scrolls and flashes.
  useEffect(() => {
    const el = scope.current!;
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#oh-"]');
      if (!a || !el.contains(a)) return;
      e.preventDefault();
      const to = a.getAttribute('href') === '#oh-receiver' ? 'receiver' : 'sender';
      setFlash((f) => ({to, n: f.n + 1}));
    };
    el.addEventListener('click', click);
    return () => el.removeEventListener('click', click);
  }, []);
  useEffect(() => {
    if (!flash.n) return;
    const pane = scope.current!.querySelector(`[data-testid="${flash.to}"]`) as HTMLElement;
    const hit = (flash.to === 'receiver' ? pane.querySelector('[data-item="r-in"]') : pane.querySelector('[data-item="s-t1"]')) as HTMLElement | null;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    pane.scrollIntoView({block: 'nearest', behavior: reduce ? 'auto' : 'smooth'});
    hit?.scrollIntoView({block: 'center', behavior: reduce ? 'auto' : 'smooth'});
    pane.dataset.flash = String(flash.n);
    const timer = setTimeout(() => { delete pane.dataset.flash; }, 1800);
    return () => clearTimeout(timer);
  }, [flash]);
  const r = receiverRows(d, t, target, step, flash.to === 'receiver' ? flash.n : 0);
  const recvActivity = target === 'archived' ? t.activity.archived : r.working ? t.activity.working
    : target === 'stopped' && step === 'sent' ? t.activity.starting : t.activity.idle;
  return (
    <div className="aam-live" ref={scope}>
      <Pane side="sender" t={t} title={t.senderTitle} ws={t.senderWs} activity={t.activity.idle} rows={senderRows(d, t, target, step)} />
      <Pane side="receiver" t={t} title={t.receiverTitle} ws={t.receiverWs} activity={recvActivity}
        kind={r.working ? 'working' : target === 'archived' ? 'read-only' : undefined} rows={r.rows} queue={r.queue} working={r.working} />
      <figure className="aam-native" data-testid="native">
        <figcaption>{t.receives(t.receiverTitle)}</figcaption>
        <pre data-testid="native-text">{target === 'archived' ? t.nothing : nativeText(t, d !== NOW)}</pre>
      </figure>
    </div>
  );
}

// ---------- The page ----------

function App({direction}: {direction: number}) {
  const {theme, lang, target, step} = useReview();
  const t = TEXT[lang];
  const [generation, setGeneration] = useState(0);
  const [all, setAll] = useState(false);
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useLayoutEffect(() => {
    setPersonalLanguage(lang);
    document.querySelectorAll('.proto-picker-item').forEach((b, i) => { b.textContent = t.picker[i].replaceAll(' ', ' '); });
  }, [lang]);
  return (
    <div className={`aam-review variant-${direction}`} data-direction={direction}>
      <header className="aam-bar" data-all={all || undefined}>
        <div className="aam-controls">
          <strong>{t.title}</strong>
          <label>{t.theme} <select id="theme" value={theme} onChange={(e) => setReview({theme: e.target.value})}>
            {(['light', 'dark', 'contrast'] as const).map((v) => <option key={v} value={v}>{t.themes[v]}</option>)}</select></label>
          <label>{t.language} <select id="lang" value={lang} onChange={(e) => setReview({lang: e.target.value as Lang})}>
            <option value="fi">suomi</option><option value="en">English</option></select></label>
          <label>{t.target} <select id="target" value={target} onChange={(e) => setReview({target: e.target.value as Target})}>
            {(['idle', 'busy', 'stopped', 'archived'] as const).map((v) => <option key={v} value={v}>{t.targets[v]}</option>)}</select></label>
          <label>{t.step} <select id="step" value={step} onChange={(e) => setReview({step: e.target.value as Step})}>
            {(['sent', 'answered'] as const).map((v) => <option key={v} value={v}>{t.steps[v]}</option>)}</select></label>
          <button type="button" data-testid="reset" onClick={() => { setReview({target: 'idle', step: 'answered'}); setGeneration((g) => g + 1); }}>{t.reset}</button>
          <span className="aam-hint">{t.hint}</span>
        </div>
        <button type="button" className="aam-all-toggle" data-testid="all" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? t.fewer : t.all}</button>
        <div className="aam-study" data-testid="lines">
          <h2>{t.axis}</h2>
          <ol>{t.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}</ol>
          <p className="aam-recommend">{t.recommend}</p>
        </div>
      </header>
      <StatusBellProvider items={[]}>
        <MemoryRouter key={`${generation}-${lang}`} initialEntries={['/workspaces/ws_raportit?conversation=pi:sender']}>
          <Live key={`${generation}-${direction}-${lang}`} d={direction} />
        </MemoryRouter>
      </StatusBellProvider>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// The shared picker wiring unchanged: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = TEXT.fi.picker.map((_, direction) => () => <App key="app" direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
TEXT.fi.picker.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// A Habitat view is an opaque-origin sandbox: ?v= bookkeeping stays in memory.
let memorySearch = '';
const memoryLocation = {get search() { return memorySearch; }, toString: () => `about:blank${memorySearch}`};
const memoryHistory = {replaceState: (_s: unknown, _t: string, url: URL) => { memorySearch = url.search; }};
new Function('stage', 'variants', 'location', 'history', pickerSource)(stageSink, variants, memoryLocation, memoryHistory);
