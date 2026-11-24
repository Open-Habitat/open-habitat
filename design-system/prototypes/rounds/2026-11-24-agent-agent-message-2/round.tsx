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
import {Icon} from '../../../../web/src/components/Icon';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader} from '../../../../web/src/components/Navigation';
import '../../../../web/src/components/ReplyQuote.css';
import {quotePlain} from '../../../../web/src/components/ReplyQuote';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {excerpt, IDS, type Lang, type MsgId, nativeText, type Side, type Step, STEPS, TEXT, type Text} from './text';
import './round.css';

// agent-agent-message, round 2 (Jari 24.11.2026 on round 1). No
// request/answer protocol: two agents exchange equal messages, as two people
// talk. The receiving side keeps round 1's A Letter model (looks like the
// person's message, another sender, agent icon, link to the sending
// conversation); the sending side is rethought as a flow over time. Axis: how
// a back-and-forth looks over several exchanges on both sides. Now (today),
// A Letters, B Thread, C Strip. One cumulative story in five steps: the
// message goes, one comes back, one arrives mid-turn, several have come
// back, and a quote of an earlier message. Header, messages, tool rows,
// timeline, composer and its queue are production; the letters, thread,
// strip rows and quotes are this round's, on tokens and production classes.

type Review = {theme: string; lang: Lang; step: Step};
let review: Review = {theme: 'light', lang: 'fi', step: 'quote'};
const listeners = new Set<() => void>();
const setReview = (r: Partial<Review>) => { review = {...review, ...r}; listeners.forEach((l) => l()); };
const useReview = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => review);
const noop = () => {};
setPersonalLanguage('fi');

const NOW = 0, A = 1, B = 2, C = 3;

type Row = {id: string; kind: string; content: ReactNode};
const row = (id: string, kind: string, content: ReactNode): Row => ({id, kind, content: <div data-item={id}>{content}</div>});
const assistant = (id: string, time: string, text: string, streaming = false) =>
  row(id, 'assistant', <div className="aam-msg"><AssistantMessage streamState={streaming ? 'streaming' : 'complete'} time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage></div>);
const user = (id: string, time: string, text: string) =>
  row(id, 'user', <UserMessage sourceText={text} time={time} onCopy={noop} />);
type Tool = {name: string; path: string; running?: boolean};
const tools = (id: string, t: Text, list: Tool[]) =>
  row(id, 'tools', <div className="aam-tools">{list.map((x, k) => <ToolRow key={k} name={x.name} targetText={x.path} statusLabel={x.running ? t.running : t.done} state={x.running ? 'running' : 'succeeded'} expanded={false} onToggle={noop} />)}</div>);

const other = (s: Side): Side => (s === 'sender' ? 'receiver' : 'sender');
const titleOf = (t: Text, s: Side) => (s === 'sender' ? t.senderTitle : t.receiverTitle);

// ---------- This round's pieces ----------

/** The quote of an earlier message: production's sent-quote surface, with
 * who wrote the original. Pressing it shows the original in this
 * conversation, where both sides have it (one sent it, one received it). */
function Quote({t, of, side}: {t: Text; of: MsgId; side: Side}) {
  const m = t.msgs[of];
  const who = m.from === side ? t.thisAgent : titleOf(t, m.from);
  return (
    <button type="button" className="ah-reply-sent aam-quote" data-testid="msg-quote" data-jump={of} aria-label={t.quoteJump(m.time)}>
      <span className="ah-reply-quote-head"><Icon name="reply" /><span>{t.quoteLabel}</span><span className="aam-quote-who">{t.quoteOf(who, m.time)}</span></span>
      <span className="ah-reply-body">{quotePlain(excerpt(m.text))}</span>
    </button>
  );
}

/** A: an incoming message is the person's message geometry with another
 * sender: the agent icon, the sending conversation as a link. */
function InLetter({t, id, side}: {t: Text; id: MsgId; side: Side}) {
  const m = t.msgs[id], from = other(side);
  return (
    <article className="ah-message aam-in" data-testid="agent-letter" data-msg={id} aria-label={t.inLabel(titleOf(t, from))}>
      <header>
        <strong className="aam-from"><Icon name="agent" /><a href={`#oh-${from}-${id}`} data-testid="letter-link">{titleOf(t, from)}</a><span className="aam-from-kind">· {t.agentWord}</span></strong>
        <time>{m.time}</time>
      </header>
      <div className="ah-prose">
        {m.quote ? <Quote t={t} of={m.quote} side={side} /> : null}
        <Markdown text={m.text} />
      </div>
    </article>
  );
}

/** A: what this conversation's agent sent, on the agent's side. */
function OutLetter({t, id, side}: {t: Text; id: MsgId; side: Side}) {
  const m = t.msgs[id], to = other(side);
  return (
    <article className="ah-message aam-out" data-testid="agent-sent" data-msg={id}>
      <header>
        <strong className="aam-from"><Icon name="arrowUp" /><span>{t.outTo}</span><a href={`#oh-${to}-${id}`} data-testid="sent-link">{titleOf(t, to)}</a></strong>
        {m.queued ? <span className="aam-state" data-testid="sent-queued">{t.outQueued(titleOf(t, to))}</span> : null}
        <time>{m.time}</time>
      </header>
      <div className="ah-prose">
        {m.quote ? <Quote t={t} of={m.quote} side={side} /> : null}
        <Markdown text={m.text} />
      </div>
    </article>
  );
}

/** B: the whole exchange with one conversation, where it began. */
function Thread({t, ids, side}: {t: Text; ids: MsgId[]; side: Side}) {
  const peer = other(side);
  return (
    <section className="aam-thread" data-testid="thread" aria-label={t.thread(titleOf(t, peer), ids.length)}>
      <header className="aam-thread-head">
        <Icon name="swap" />
        <span>{t.thread(titleOf(t, peer), ids.length).split(titleOf(t, peer))[0]}<a href={`#oh-${peer}-${ids[ids.length - 1]}`} data-testid="thread-link">{titleOf(t, peer)}</a>{t.thread(titleOf(t, peer), ids.length).split(titleOf(t, peer))[1]}</span>
      </header>
      <ol className="aam-thread-list">
        {ids.map((id) => {
          const m = t.msgs[id], out = m.from === side;
          return (
            <li key={id} className="aam-trow" data-msg={id} data-dir={out ? 'out' : 'in'} data-testid="thread-row">
              <header>
                <strong className="aam-from">
                  <Icon name={out ? 'arrowUp' : 'agent'} />
                  {out ? <span>{t.thisAgent}</span> : <><a href={`#oh-${peer}-${id}`}>{titleOf(t, peer)}</a><span className="aam-from-kind">· {t.agentWord}</span></>}
                </strong>
                {m.queued && out ? <span className="aam-state">{t.outQueued(titleOf(t, peer))}</span> : null}
                <time>{m.time}</time>
              </header>
              {m.quote ? <Quote t={t} of={m.quote} side={side} /> : null}
              <div className="ah-prose"><Markdown text={m.text} /></div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** B: a later message leaves a line where it happened, leading to the thread. */
function Pointer({t, id, side}: {t: Text; id: MsgId; side: Side}) {
  const m = t.msgs[id], out = m.from === side, peer = titleOf(t, other(side));
  return (
    <p className="ah-mp-line aam-pointer" role="note" data-testid="pointer" data-pointer={id}>
      <span className="ah-mp-line-mark" aria-hidden="true" />
      <span className="aam-pointer-text">
        <strong>{out ? t.pointerOut(peer) : t.pointerIn(peer)}</strong> · <time>{m.time}</time> · <span className="aam-pointer-excerpt">{quotePlain(excerpt(m.text))}</span>
      </span>
      <button type="button" className="aam-linkish" data-jump={id} data-testid="pointer-jump">{t.inThread}</button>
    </p>
  );
}

/** C: one compact row per message; it opens in place. */
function StripRow({t, id, side}: {t: Text; id: MsgId; side: Side}) {
  const [open, setOpen] = useState(false);
  const m = t.msgs[id], out = m.from === side, peer = other(side);
  return (
    <div className="aam-strip" data-msg={id} data-dir={out ? 'out' : 'in'} data-open={open || undefined} data-testid="strip-row">
      <div className="aam-strip-line">
        <Icon name={out ? 'arrowUp' : 'agent'} />
        <span className="aam-strip-who">{out ? <span className="aam-strip-to">{t.outTo} </span> : null}<a href={`#oh-${peer}-${id}`}>{titleOf(t, peer)}</a></span>
        {m.quote ? <span className="aam-strip-ref" title={excerpt(t.msgs[m.quote].text)}><Icon name="reply" />{t.msgs[m.quote].time}</span> : null}
        {open ? <span className="aam-strip-gap" /> : <span className="aam-strip-text">{quotePlain(m.text)}</span>}
        {m.queued && out ? <span className="aam-state">{t.outQueued(titleOf(t, peer))}</span> : null}
        <time>{m.time}</time>
        <button type="button" className="aam-strip-toggle" data-testid="strip-toggle" aria-expanded={open} aria-label={open ? t.collapse : t.expand} onClick={() => setOpen((v) => !v)}><Icon name={open ? 'up' : 'down'} /></button>
      </div>
      {open ? (
        <div className="aam-strip-body">
          {m.quote ? <Quote t={t} of={m.quote} side={side} /> : null}
          <div className="ah-prose"><Markdown text={m.text} /></div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- The story ----------

/** Which messages a conversation holds at step i: what it sent, and what was
 * delivered to it. m3 waits in the sender's queue at step 3. */
function visible(side: Side, i: number): MsgId[] {
  const all: [MsgId, number, number][] = [['m1', 0, 0], ['m2', 1, 1], ['m3', 3, 2], ['m4', 4, 4], ['m5', 4, 4]];
  // [id, step it reaches the sender pane, step it reaches the receiver pane]
  return all.filter(([, s, r]) => i >= (side === 'sender' ? s : r)).map(([id]) => id);
}

function exchange(d: number, t: Text, side: Side, i: number) {
  const ids = visible(side, i);
  return (id: MsgId): Row[] => {
    const m = t.msgs[id], out = m.from === side;
    if (d === NOW) {
      if (!out) return [user(`in-${id}`, m.time, m.text)];
      const to = side === 'sender' ? IDS.receiver : IDS.sender;
      return [tools(`out-${id}`, t, [{name: 'bash', path: `open-habitat agent message create --conversation ${to} --delivery ${m.queued ? 'follow-up' : 'send'} --text-file -`}])];
    }
    if (d === A) return [out ? row(`out-${id}`, 'out', <OutLetter t={t} id={id} side={side} />) : row(`in-${id}`, 'user', <InLetter t={t} id={id} side={side} />)];
    if (d === B) return [id === ids[0] ? row('thread', 'thread', <Thread t={t} ids={ids} side={side} />) : row(`ptr-${id}`, 'line', <Pointer t={t} id={id} side={side} />)];
    return [row(`${out ? 'out' : 'in'}-${id}`, out ? 'out' : 'user', <StripRow t={t} id={id} side={side} />)];
  };
}

type Built = {rows: Row[]; working: boolean; queue?: string[]; latestIn?: MsgId};

function senderRows(d: number, t: Text, i: number): Built {
  const ex = exchange(d, t, 'sender', i), s = t.s, now = d === NOW;
  const rows = [user('s-u1', '9.38', s.ask), tools('s-t1', t, [{name: 'bash', path: 'open-habitat agent conversation list'}]), ...ex('m1'),
    assistant('s-a1', '9.39', now ? s.sentToday : s.sent),
    tools('s-t2', t, [{name: 'edit', path: 'report/report.md'}]), assistant('s-a2', '9.41', s.tables)];
  let working = false, queue: string[] | undefined, latestIn: MsgId | undefined;
  if (i >= 1) {
    latestIn = 'm2';
    rows.push(...ex('m2'), tools('s-t3', t, [{name: 'edit', path: 'report/report.md'}]), assistant('s-a3', '9.44', now ? s.placedToday : s.placed));
  }
  if (i >= 2) {
    rows.push(user('s-u2', '9.45', s.intro));
    if (i === 2) {
      rows.push(tools('s-t4', t, [{name: 'edit', path: 'report/report.md', running: true}]), assistant('s-a4s', '9.46', s.introStreaming, true));
      // Pi's queue holds the message; with the design the queue item names its sender.
      queue = [(now ? '' : t.queuedFrom(t.receiverTitle)) + t.msgs.m3.text];
      working = true;
    } else {
      latestIn = 'm3';
      rows.push(tools('s-t4', t, [{name: 'edit', path: 'report/report.md'}]), assistant('s-a4', '9.47', s.introDone), ...ex('m3'), assistant('s-a5', '9.48', now ? s.missingToday : s.missing));
    }
  }
  if (i >= 4) {
    latestIn = 'm5';
    rows.push(user('s-u3', '9.50', s.yes), tools('s-t5', t, [{name: 'edit', path: 'data/q3.csv'}]), ...ex('m4'),
      assistant('s-a6', '9.51', now ? s.toldToday : s.told), ...ex('m5'),
      tools('s-t6', t, [{name: 'edit', path: 'report/report.md'}]), assistant('s-a7', '9.54', now ? s.finalToday : s.final));
  }
  return {rows, working, queue, latestIn};
}

function receiverRows(d: number, t: Text, i: number): Built {
  const ex = exchange(d, t, 'receiver', i), r = t.r, now = d === NOW;
  const rows = [user('r-u0', '9.05', r.earlierAsk), assistant('r-a0', '9.07', r.earlierReply), ...ex('m1')];
  if (i === 0) {
    rows.push(tools('r-t1', t, [{name: 'read', path: 'data/q3.csv', running: true}]));
    return {rows, working: true, latestIn: 'm1'};
  }
  rows.push(tools('r-t1', t, [{name: 'read', path: 'data/q3.csv'}, {name: 'edit', path: 'charts/chart2.py'}, {name: 'bash', path: 'python charts/chart2.py --out charts/q3.svg'}]), ...ex('m2'));
  if (i === 1) {
    rows.push(tools('r-t2', t, [{name: 'bash', path: 'python charts/check.py data/q3.csv', running: true}]));
    return {rows, working: true, latestIn: 'm1'};
  }
  rows.push(tools('r-t2', t, [{name: 'bash', path: 'python charts/check.py data/q3.csv'}]), ...ex('m3'), assistant('r-a1', '9.46', now ? r.toldToday : r.told));
  if (i < 4) return {rows, working: false, latestIn: 'm1'};
  rows.push(...ex('m4'), tools('r-t3', t, [{name: 'bash', path: 'python charts/chart2.py --out charts/q3.svg'}]), ...ex('m5'), assistant('r-a2', '9.54', now ? r.againToday : r.again));
  return {rows, working: false, latestIn: 'm4'};
}

// ---------- The two conversations ----------

function Pane({side, t, title, ws, built, stamp, children}: {
  side: Side; t: Text; title: string; ws: string; built: Built; stamp: string; children?: ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Open at the latest entry, as the app does, whenever the story moves.
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
            <ConversationTimeline state="ready" items={built.rows} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
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
  // Links between the panes stand in for the app's conversation route:
  // nothing navigates; the other pane shows the same message and flashes it.
  // A quote or a thread pointer shows its original in the same pane.
  useEffect(() => {
    const el = scope.current!;
    const click = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const a = target.closest('a[href^="#oh-"]');
      const jump = target.closest('[data-jump]');
      if (a && el.contains(a)) {
        e.preventDefault();
        const [, side, id] = a.getAttribute('href')!.match(/^#oh-(sender|receiver)-?(m\d)?$/) ?? [];
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
  const s = senderRows(d, t, i), r = receiverRows(d, t, i);
  const stamp = `${d}-${step}-${lang}`;
  const native = (b: Built) => (
    <figure className="aam-native" data-testid="native">
      <figcaption>{t.receives}</figcaption>
      <pre data-testid="native-text">{b.latestIn ? (d === NOW ? t.msgs[b.latestIn].text : nativeText(t, b.latestIn)) : t.nothingYet}</pre>
    </figure>
  );
  return (
    <div className="aam-live" ref={scope}>
      <Pane side="sender" t={t} title={t.senderTitle} ws={t.senderWs} built={s} stamp={stamp}>{native(s)}</Pane>
      <Pane side="receiver" t={t} title={t.receiverTitle} ws={t.receiverWs} built={r} stamp={stamp}>{native(r)}</Pane>
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
    document.querySelectorAll('.proto-picker-item').forEach((b, k) => { b.textContent = t.picker[k].replaceAll(' ', '\u00a0'); });
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (k === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// A Habitat view is an opaque-origin sandbox: ?v= bookkeeping stays in memory.
let memorySearch = '';
const memoryLocation = {get search() { return memorySearch; }, toString: () => `about:blank${memorySearch}`};
const memoryHistory = {replaceState: (_s: unknown, _t: string, url: URL) => { memorySearch = url.search; }};
new Function('stage', 'variants', 'location', 'history', pickerSource)(stageSink, variants, memoryLocation, memoryHistory);
