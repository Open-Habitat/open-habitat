import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Multiplayer.css';
import {AssistantMessage, Composer, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {Icon} from '../../../../web/src/components/Icon';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader} from '../../../../web/src/components/Navigation';
import '../../../../web/src/components/ReplyQuote.css';
import {quotePlain} from '../../../../web/src/components/ReplyQuote';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {type Copy, excerpt, type Lang, type MsgId, nativeText, type Side, type Step, STEPS, TEXT, type Text} from './text';
import './round.css';

// agent-agent-message, round 4 (Jari 25.11.2026 on round 3: A Mirror, no
// runaway guard and no hop limit). Incoming stays round 2's A Letters and
// outgoing round 3's A Mirror. Axis: how much a message block says besides
// the conversation's name and the message. Now (= round 3's A Mirror as it
// was), A Minimal (icon, name as link, time, text), B Quiet (A plus a
// one-line quote when the agent quoted), C Contextual (B plus the delivery
// state only when it was not "delivered"). The time sits right after the
// name in A–C, as the times prototype decided (A Otsake). Header, messages,
// tool rows, timeline, composer and queue are production.

type Review = {theme: string; lang: Lang; step: Step};
let review: Review = {theme: 'light', lang: 'fi', step: 'quote'};
const listeners = new Set<() => void>();
const setReview = (r: Partial<Review>) => { review = {...review, ...r}; listeners.forEach((l) => l()); };
const useReview = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => review);
const noop = () => {};
setPersonalLanguage('fi');

const NOW = 0;

type Row = {id: string; kind: string; content: ReactNode};
const row = (id: string, kind: string, content: ReactNode): Row => ({id, kind, content: <div data-item={id}>{content}</div>});
type Tool = {name: string; path: string; running?: boolean};

const other = (s: Side): Side => (s === 'sender' ? 'receiver' : 'sender');
const titleOf = (t: Text, s: Side) => (s === 'sender' ? t.senderTitle : t.receiverTitle);

/** What one conversation holds, before a direction decides how its sent
 * messages look. */
type Spec =
  | {k: 'user'; id: string; time: string; text: string}
  | {k: 'asst'; id: string; time: string; text: string; streaming?: boolean}
  | {k: 'tools'; id: string; list: Tool[]}
  | {k: 'msg'; mid: MsgId};

type Ctx = {t: Text; side: Side; d: number; copy: Copy};

/** The state a sent message's result reported, only when it was not
 * "delivered": queued behind a busy target. Now and C show it. */
function stateOf({t, side, copy}: Ctx, id: MsgId): ReactNode {
  const m = t.msgs[id], to = titleOf(t, other(side));
  if (!m.queued || !copy.queued) return null;
  return <span className="aam-state" data-testid="sent-queued" title={copy.queuedTitle?.(to)}>{copy.queued(to)}</span>;
}

// ---------- This round's pieces ----------

function Quote({c, of}: {c: Ctx; of: MsgId}) {
  const {t, side, copy} = c, m = t.msgs[of];
  if (copy.quote === 'none') return null;
  const who = m.from === side ? t.thisAgent : titleOf(t, m.from);
  if (copy.quote === 'line') {
    return (
      <button type="button" className="aam-qline" data-testid="msg-quote" data-quote="line" data-jump={of} aria-label={copy.quoteAria(who, m.time)}>
        <Icon name="reply" /><span className="aam-qline-text">{quotePlain(excerpt(m.text))}</span>
      </button>
    );
  }
  return (
    <button type="button" className="ah-reply-sent aam-quote" data-testid="msg-quote" data-quote="full" data-jump={of} aria-label={copy.quoteAria(who, m.time)}>
      <span className="ah-reply-quote-head"><Icon name="reply" /><span>{copy.quoteLabel}</span><span className="aam-quote-who">{copy.quoteWho!(who, m.time)}</span></span>
      <span className="ah-reply-body">{quotePlain(excerpt(m.text))}</span>
    </button>
  );
}

/** The incoming letter (round 2's A) and the outgoing mirror (round 3's A):
 * the same block; the direction decides its words. */
function Letter({c, id}: {c: Ctx; id: MsgId}) {
  const {t, side, d, copy} = c, m = t.msgs[id];
  const incoming = m.from !== side, peer = other(side), name = titleOf(t, peer);
  const link = <a href={`#oh-${peer}-${id}`} data-testid="peer-link">{name}</a>;
  const time = <time>{m.time}</time>;
  const head = d === NOW
    ? (incoming
      ? <><strong className="aam-from"><Icon name="agent" />{link}<span className="aam-from-kind">{copy.inKind}</span></strong>{time}</>
      : <><strong className="aam-from"><Icon name="agent" /><span>{copy.outLead}</span><Icon name="forward" />{link}</strong>{stateOf(c, id)}{time}</>)
    : <><strong className="aam-from"><Icon name={incoming ? 'agent' : 'arrowUp'} />{link}</strong>{time}{incoming ? null : stateOf(c, id)}</>;
  return (
    <article className={`ah-message ${incoming ? 'aam-in' : 'aam-out aam-mirror'}${d === NOW ? ' aam-now' : ' aam-lean'}`}
      data-testid={incoming ? 'agent-letter' : 'out-mirror'} data-msg={id} aria-label={incoming ? copy.inAria(name) : copy.outAria(name)}>
      <header>{head}</header>
      <div className="ah-prose">
        {m.quote ? <Quote c={c} of={m.quote} /> : null}
        <Markdown text={m.text} />
      </div>
    </article>
  );
}

// ---------- The story ----------

type Built = {specs: Spec[]; working: boolean; queue?: string[]; latestIn?: MsgId};

function senderSpecs(t: Text, i: number, copy: Copy): Built {
  const s = t.s;
  const specs: Spec[] = [{k: 'user', id: 's-u1', time: '9.38', text: s.ask}, {k: 'tools', id: 's-t1', list: [{name: 'bash', path: 'open-habitat agent conversation list'}]},
    {k: 'msg', mid: 'm1'}, {k: 'asst', id: 's-a1', time: '9.39', text: s.sent},
    {k: 'tools', id: 's-t2', list: [{name: 'edit', path: 'report/report.md'}]}, {k: 'asst', id: 's-a2', time: '9.41', text: s.tables}];
  let working = false, queue: string[] | undefined, latestIn: MsgId | undefined;
  if (i >= 1) {
    latestIn = 'm2';
    specs.push({k: 'msg', mid: 'm2'}, {k: 'tools', id: 's-t3', list: [{name: 'edit', path: 'report/report.md'}]}, {k: 'asst', id: 's-a3', time: '9.44', text: s.placed});
  }
  if (i >= 2) {
    specs.push({k: 'user', id: 's-u2', time: '9.45', text: s.intro});
    if (i === 2) {
      specs.push({k: 'tools', id: 's-t4', list: [{name: 'edit', path: 'report/report.md', running: true}]}, {k: 'asst', id: 's-a4s', time: '9.46', text: s.introStreaming, streaming: true});
      queue = [copy.queueFrom(t.receiverTitle) + t.msgs.m3.text];
      working = true;
    } else {
      latestIn = 'm3';
      specs.push({k: 'tools', id: 's-t4', list: [{name: 'edit', path: 'report/report.md'}]}, {k: 'asst', id: 's-a4', time: '9.47', text: s.introDone}, {k: 'msg', mid: 'm3'}, {k: 'asst', id: 's-a5', time: '9.48', text: s.missing});
    }
  }
  if (i >= 4) {
    latestIn = 'm5';
    specs.push({k: 'user', id: 's-u3', time: '9.50', text: s.yes}, {k: 'tools', id: 's-t5', list: [{name: 'edit', path: 'data/q3.csv'}]}, {k: 'msg', mid: 'm4'},
      {k: 'asst', id: 's-a6', time: '9.51', text: s.told}, {k: 'msg', mid: 'm5'},
      {k: 'tools', id: 's-t6', list: [{name: 'edit', path: 'report/report.md'}]}, {k: 'asst', id: 's-a7', time: '9.54', text: s.final});
  }
  return {specs, working, queue, latestIn};
}

function receiverSpecs(t: Text, i: number): Built {
  const r = t.r;
  const specs: Spec[] = [{k: 'user', id: 'r-u0', time: '9.05', text: r.earlierAsk}, {k: 'asst', id: 'r-a0', time: '9.07', text: r.earlierReply}, {k: 'msg', mid: 'm1'}];
  if (i === 0) {
    specs.push({k: 'tools', id: 'r-t1', list: [{name: 'read', path: 'data/q3.csv', running: true}]});
    return {specs, working: true, latestIn: 'm1'};
  }
  specs.push({k: 'tools', id: 'r-t1', list: [{name: 'read', path: 'data/q3.csv'}, {name: 'edit', path: 'charts/chart2.py'}, {name: 'bash', path: 'python charts/chart2.py --out charts/q3.svg'}]}, {k: 'msg', mid: 'm2'});
  if (i === 1) {
    specs.push({k: 'tools', id: 'r-t2', list: [{name: 'bash', path: 'python charts/check.py data/q3.csv', running: true}]});
    return {specs, working: true, latestIn: 'm1'};
  }
  specs.push({k: 'tools', id: 'r-t2', list: [{name: 'bash', path: 'python charts/check.py data/q3.csv'}]}, {k: 'msg', mid: 'm3'}, {k: 'asst', id: 'r-a1', time: '9.46', text: r.told});
  if (i < 4) return {specs, working: false, latestIn: 'm1'};
  specs.push({k: 'msg', mid: 'm4'}, {k: 'tools', id: 'r-t3', list: [{name: 'bash', path: 'python charts/chart2.py --out charts/q3.svg'}]}, {k: 'msg', mid: 'm5'}, {k: 'asst', id: 'r-a2', time: '9.54', text: r.again});
  return {specs, working: false, latestIn: 'm4'};
}

// ---------- Rows ----------

function render(c: Ctx, specs: Spec[]): Row[] {
  const {t, side} = c;
  return specs.map((s) => {
    if (s.k === 'user') return row(s.id, 'user', <UserMessage sourceText={s.text} time={s.time} onCopy={noop} />);
    if (s.k === 'tools') return row(s.id, 'tools', <div className="aam-tools">{s.list.map((x, k) => (
      <ToolRow key={k} name={x.name} targetText={x.path} statusLabel={x.running ? t.running : t.done}
        state={x.running ? 'running' : 'succeeded'} expanded={false} onToggle={noop} />))}</div>);
    if (s.k === 'asst') return row(s.id, 'assistant', (
      <div className="aam-msg"><AssistantMessage streamState={s.streaming ? 'streaming' : 'complete'} time={s.time} onCopy={noop}>
        <Markdown text={s.text} />
      </AssistantMessage></div>));
    const incoming = t.msgs[s.mid].from !== side;
    return row(`${incoming ? 'in' : 'out'}-${s.mid}`, incoming ? 'user' : 'out', <Letter c={c} id={s.mid} />);
  });
}

// ---------- The two conversations ----------

function Pane({side, t, title, ws, built, rows, stamp, children}: {
  side: Side; t: Text; title: string; ws: string; built: Built; rows: Row[]; stamp: string; children?: ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let el: HTMLElement | null = stream.current?.querySelector('[data-testid="conversation-timeline"]') ?? null;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    el?.scrollTo({top: 1e6});
  }, [stamp]);
  return (
    <section className="aam-pane" data-testid={side} aria-label={side === 'sender' ? t.sender : t.receiver}>
      <h2 className="aam-pane-label">{side === 'sender' ? t.sender : t.receiver}</h2>
      <div className="aam-frame" ref={stream}>
        <ConversationFrame>
          <AgentHeader title={title} workspaceLabel={ws} workspaceHref={`/workspaces/ws_${ws}`} activityLabel={built.working ? t.activity.working : t.activity.idle}
            activityKind={built.working ? 'working' : undefined} activityAnimated={built.working} controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          <ConversationStream>
            <ConversationTimeline state="ready" items={rows} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          <Composer value={draft} onChange={setDraft} activity={built.working ? 'working' : 'idle'} selectedWorkingMode="follow_up" onModeChange={noop}
            onSendNow={noop} onSteer={noop} onFollowUp={noop} csrf="prototype" queue={built.queue ? {steering: [], followUp: built.queue} : undefined}
            modelPicker={<button type="button" className="md-pill">medium</button>} />
        </ConversationFrame>
      </div>
      {children}
    </section>
  );
}

function flash(el: HTMLElement) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.closest('.aam-pane')?.scrollIntoView({block: 'nearest', behavior: reduce ? 'auto' : 'smooth'});
  el.scrollIntoView({block: 'center', behavior: reduce ? 'auto' : 'smooth'});
  el.removeAttribute('data-flash');
  void el.offsetWidth;
  el.setAttribute('data-flash', '');
  setTimeout(() => el.removeAttribute('data-flash'), 1800);
}

function Live({d}: {d: number}) {
  const {lang, step} = useReview();
  const t = TEXT[lang];
  const i = STEPS.indexOf(step);
  const scope = useRef<HTMLDivElement>(null);
  // Links between the panes stand in for the app's conversation route.
  useEffect(() => {
    const el = scope.current!;
    const click = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const a = target.closest('a[href^="#oh-"]');
      const jump = target.closest('[data-jump]');
      if (a && el.contains(a)) {
        e.preventDefault();
        const [, side, id] = a.getAttribute('href')!.match(/^#oh-(sender|receiver)-?(m\d+)?$/) ?? [];
        const pane = el.querySelector(`[data-testid="${side}"]`);
        const hit = (id && pane?.querySelector(`[data-msg="${id}"]`)) || [...(pane?.querySelectorAll('[data-msg]') ?? [])].pop();
        if (hit) flash(hit as HTMLElement);
      } else if (jump && el.contains(jump)) {
        const pane = jump.closest('.aam-pane');
        const hit = pane?.querySelector(`[data-msg="${jump.getAttribute('data-jump')}"]`);
        if (hit) flash(hit as HTMLElement);
      }
    };
    el.addEventListener('click', click);
    return () => el.removeEventListener('click', click);
  }, []);
  const copy = t.copy[d];
  const s = senderSpecs(t, i, copy), r = receiverSpecs(t, i);
  const stamp = `${d}-${step}-${lang}`;
  const native = (b: Built) => (
    <figure className="aam-native" data-testid="native">
      <figcaption>{t.receives}</figcaption>
      <pre data-testid="native-text">{b.latestIn ? nativeText(t, b.latestIn) : t.nothingYet}</pre>
    </figure>
  );
  return (
    <div className="aam-live" ref={scope}>
      <Pane side="sender" t={t} title={t.senderTitle} ws={t.senderWs} built={s} rows={render({t, side: 'sender', d, copy}, s.specs)} stamp={stamp}>{native(s)}</Pane>
      <Pane side="receiver" t={t} title={t.receiverTitle} ws={t.receiverWs} built={r} rows={render({t, side: 'receiver', d, copy}, r.specs)} stamp={stamp}>{native(r)}</Pane>
    </div>
  );
}

// ---------- The page ----------

function App({direction}: {direction: number}) {
  const {theme, lang, step} = useReview();
  const t = TEXT[lang];
  const [generation, setGeneration] = useState(0);
  const [all, setAll] = useState(false);
  const i = STEPS.indexOf(step);
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useLayoutEffect(() => {
    setPersonalLanguage(lang);
    document.querySelectorAll('.proto-picker-item').forEach((b, k) => { b.textContent = t.picker[k].replaceAll(' ', ' '); });
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
          <span className="aam-steps">
            <label>{t.step} <select id="step" value={step} onChange={(e) => setReview({step: e.target.value as Step})}>
              {STEPS.map((v) => <option key={v} value={v}>{t.steps[v]}</option>)}</select></label>
            <button type="button" data-testid="prev" disabled={i === 0} onClick={() => setReview({step: STEPS[i - 1]})}>{t.prev}</button>
            <button type="button" data-testid="next" disabled={i === STEPS.length - 1} onClick={() => setReview({step: STEPS[i + 1]})}>{t.next}</button>
          </span>
          <button type="button" data-testid="reset" onClick={() => { setReview({step: 'quote'}); setGeneration((g) => g + 1); }}>{t.reset}</button>
          <span className="aam-hint">{t.hint}</span>
        </div>
        <button type="button" className="aam-all-toggle" data-testid="all" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? t.fewer : t.all}</button>
        <div className="aam-study" data-testid="lines">
          <h2>{t.axis}</h2>
          <ol>{t.lines.map((l, k) => <li key={k} aria-current={k === direction ? 'true' : undefined}>{l}</li>)}</ol>
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
TEXT.fi.picker.forEach((n, k) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (k === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
let memorySearch = '';
const memoryLocation = {get search() { return memorySearch; }, toString: () => `about:blank${memorySearch}`};
const memoryHistory = {replaceState: (_s: unknown, _t: string, url: URL) => { memorySearch = url.search; }};
new Function('stage', 'variants', 'location', 'history', pickerSource)(stageSink, variants, memoryLocation, memoryHistory);
