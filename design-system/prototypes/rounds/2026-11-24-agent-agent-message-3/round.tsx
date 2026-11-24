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
import {excerpt, GUARD_N, LOOP, type Lang, type MsgId, nativeText, type Side, type Step, STEPS, TEXT, type Text} from './text';
import './round.css';

// agent-agent-message, round 3 (Jari 24.11.2026 on round 2: A Letters). The
// incoming side stays round 2's A. Axis: the outgoing message on the
// sender's side, whether it is always its own bubble or only when the
// agent's text does not say it sent one, and its shape. Now (= round 2's A,
// dashed bubble), A Mirror (the incoming letter mirrored), B Line (a compact
// line under the agent's reply), C Folded (a quote block inside the reply
// that links it; its own row only when no reply mentions it). Steps 6–7 run
// the exchange on until the proposed runaway guard holds the 11th message in
// a row and the person continues; Now shows round 2's hop limit there.
// Header, messages, tool rows, timeline, composer and queue are production.

type Review = {theme: string; lang: Lang; step: Step; discarded: boolean};
let review: Review = {theme: 'light', lang: 'fi', step: 'quote', discarded: false};
const listeners = new Set<() => void>();
const setReview = (r: Partial<Review>) => { review = {...review, discarded: false, ...r}; listeners.forEach((l) => l()); };
const useReview = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => review);
const noop = () => {};
setPersonalLanguage('fi');

const NOW = 0, A = 1, B = 2, C = 3;
const GUARD = STEPS.indexOf('guard'), CONT = STEPS.indexOf('continued');

type Row = {id: string; kind: string; content: ReactNode};
const row = (id: string, kind: string, content: ReactNode): Row => ({id, kind, content: <div data-item={id}>{content}</div>});
type Tool = {name: string; path: string; running?: boolean; refused?: string};

const other = (s: Side): Side => (s === 'sender' ? 'receiver' : 'sender');
const titleOf = (t: Text, s: Side) => (s === 'sender' ? t.senderTitle : t.receiverTitle);

/** What one conversation holds, before a direction decides how its sent
 * messages look. */
type Spec =
  | {k: 'user'; id: string; time: string; text: string}
  | {k: 'asst'; id: string; time: string; text: string; streaming?: boolean}
  | {k: 'tools'; id: string; list: Tool[]}
  | {k: 'msg'; mid: MsgId}
  | {k: 'guard'};

type Ctx = {t: Text; side: Side; i: number; discarded: boolean};

/** The state a sent message's result reported: queued behind a busy target,
 * or held by the guard until the person continues. */
function stateOf({t, side, i, discarded}: Ctx, id: MsgId): ReactNode {
  const m = t.msgs[id];
  if (m.queued) return <span className="aam-state" data-testid="sent-queued">{t.outQueued(titleOf(t, other(side)))}</span>;
  if (m.held && i === GUARD) return <span className="aam-state aam-state-held" data-testid="sent-held">{discarded ? t.notSent : t.outHeld}</span>;
  return null;
}

// ---------- This round's pieces ----------

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

/** Round 2's A, kept: the incoming letter on the person's side. */
function InLetter({t, id, side}: {t: Text; id: MsgId; side: Side}) {
  const m = t.msgs[id], from = other(side);
  return (
    <article className="ah-message aam-in" data-testid="agent-letter" data-msg={id} aria-label={t.inLabel(titleOf(t, from))}>
      <header>
        <strong className="aam-from"><Icon name="agent" /><a href={`#oh-${from}-${id}`}>{titleOf(t, from)}</a><span className="aam-from-kind">· {t.agentWord}</span></strong>
        <time>{m.time}</time>
      </header>
      <div className="ah-prose">
        {m.quote ? <Quote t={t} of={m.quote} side={side} /> : null}
        <Markdown text={m.text} />
      </div>
    </article>
  );
}

/** Now (round 2's A) and A Mirror share the letter body; the shape differs. */
function OutLetter({c, id, mirror}: {c: Ctx; id: MsgId; mirror: boolean}) {
  const {t, side} = c, m = t.msgs[id], to = other(side);
  return (
    <article className={`ah-message aam-out ${mirror ? 'aam-mirror' : 'aam-dashed'}`} data-testid={mirror ? 'out-mirror' : 'out-dashed'} data-msg={id}>
      <header>
        {mirror
          ? <strong className="aam-from"><Icon name="agent" /><span>{t.thisAgent}</span><Icon name="forward" /><a href={`#oh-${to}-${id}`}>{titleOf(t, to)}</a></strong>
          : <strong className="aam-from"><Icon name="arrowUp" /><span>{t.outTo}</span><a href={`#oh-${to}-${id}`}>{titleOf(t, to)}</a></strong>}
        {stateOf(c, id)}
        <time>{m.time}</time>
      </header>
      <div className="ah-prose">
        {m.quote ? <Quote t={t} of={m.quote} side={side} /> : null}
        <Markdown text={m.text} />
      </div>
    </article>
  );
}

/** B: one compact line under the reply; it opens in place. */
function OutLine({c, id}: {c: Ctx; id: MsgId}) {
  const [open, setOpen] = useState(false);
  const {t, side} = c, m = t.msgs[id], to = other(side);
  return (
    <div className="aam-line" data-msg={id} data-open={open || undefined} data-testid="out-line">
      <div className="aam-line-head">
        <Icon name="arrowUp" />
        <span className="aam-line-who"><span className="aam-line-to">{t.msgTo} </span><a href={`#oh-${to}-${id}`}>{titleOf(t, to)}</a></span>
        {m.quote ? <span className="aam-line-ref" title={excerpt(t.msgs[m.quote].text)}><Icon name="reply" />{t.msgs[m.quote].time}</span> : null}
        {open ? <span className="aam-line-gap" /> : <span className="aam-line-text">{quotePlain(m.text)}</span>}
        {stateOf(c, id)}
        <time>{m.time}</time>
        <button type="button" className="aam-line-toggle" data-testid="line-toggle" aria-expanded={open} aria-label={open ? t.collapse : t.expand} onClick={() => setOpen((v) => !v)}><Icon name={open ? 'up' : 'down'} /></button>
      </div>
      {open ? (
        <div className="aam-line-body">
          {m.quote ? <Quote t={t} of={m.quote} side={side} /> : null}
          <div className="ah-prose"><Markdown text={m.text} /></div>
        </div>
      ) : null}
    </div>
  );
}

/** C: the message as a quote block, inside the reply that links it, or on
 * its own row when no reply mentions it. */
function Fold({c, id, alone}: {c: Ctx; id: MsgId; alone: boolean}) {
  const {t, side} = c, m = t.msgs[id], to = other(side);
  return (
    <blockquote className="aam-fold" data-msg={id} data-alone={alone || undefined} data-testid={alone ? 'fold-alone' : 'fold'}>
      <header>
        <strong className="aam-from"><Icon name="arrowUp" /><span>{t.msgTo}</span><a href={`#oh-${to}-${id}`}>{titleOf(t, to)}</a></strong>
        {stateOf(c, id)}
        <time>{m.time}</time>
      </header>
      {m.quote ? <Quote t={t} of={m.quote} side={side} /> : null}
      <div className="ah-prose"><Markdown text={m.text} /></div>
    </blockquote>
  );
}

/** The runaway guard: the same card in both conversations, one click to go on. */
function Guard({c}: {c: Ctx}) {
  const {t, side, i, discarded} = c;
  const a = t.senderTitle, b = t.receiverTitle, holder = side === 'sender';
  if (i === CONT || discarded) {
    return (
      <p className="ah-mp-line aam-guard-line" role="note" data-testid="guard-line">
        <span className="ah-mp-line-mark" aria-hidden="true" />
        <span>{discarded ? `${t.notSent}. ` : ''}{i === CONT ? (holder ? t.continued(t.continueTime, GUARD_N) : t.continuedThere(t.continueTime, a)) : t.guardWhy(a, b, GUARD_N)}</span>
      </p>
    );
  }
  return (
    <section className="ah-mp-card aam-guard" data-testid="guard" data-msg={holder ? undefined : 'm14'} aria-label={t.guardHead}>
      <header className="aam-guard-head"><Icon name="clock" /><strong>{t.guardHead}</strong></header>
      <p>{t.guardWhy(a, b, GUARD_N)} {holder ? t.guardHere(b) : t.guardThere(a)}</p>
      <div className="aam-guard-actions">
        <button type="button" className="aam-btn aam-btn-primary" data-testid="continue" onClick={() => setReview({step: 'continued'})}>{t.continueLabel}</button>
        {holder
          ? <button type="button" className="aam-btn" data-testid="discard" onClick={() => setReview({discarded: true})}>{t.discard}</button>
          : <a className="aam-btn" href="#oh-sender-m14" data-testid="guard-show">{t.guardShow}</a>}
      </div>
    </section>
  );
}

// ---------- The story ----------

const NOW_TOOL = (t: Text, id: MsgId, side: Side) => {
  const to = side === 'sender' ? 'pi:7d2e41c0' : 'pi:3b9f0a62';
  return `open-habitat agent message create --conversation ${to} --delivery ${t.msgs[id].queued ? 'follow-up' : 'send'} --text-file -`;
};

type Built = {specs: Spec[]; working: boolean; queue?: string[]; latestIn?: MsgId; released?: boolean};

function senderSpecs(d: number, t: Text, i: number): Built {
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
      queue = [t.queuedFrom(t.receiverTitle) + t.msgs.m3.text];
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
  if (i >= GUARD) {
    if (d === NOW) {
      // Round 2's hop limit: Charts' message m5 was hop 2, so this turn may not send.
      specs.push({k: 'tools', id: 's-t7', list: [{name: 'bash', path: NOW_TOOL(t, 'm6', 'sender'), refused: '409 agent_message_chain'}]}, {k: 'asst', id: 's-a8', time: '9.55', text: s.hopRefused});
    } else {
      latestIn = 'm13';
      specs.push({k: 'tools', id: 's-t7', list: [{name: 'read', path: 'charts/q3.svg'}]}, {k: 'msg', mid: 'm6'}, {k: 'asst', id: 's-a8', time: '9.55', text: s.selite});
      for (const id of ['m7', 'm9', 'm11', 'm13'] as MsgId[]) {
        const next = `m${Number(id.slice(1)) + 1}` as MsgId;
        specs.push({k: 'msg', mid: id}, {k: 'tools', id: `s-t-${id}`, list: [{name: 'edit', path: 'report/report.md'}]}, {k: 'msg', mid: next},
          {k: 'asst', id: `s-a-${next}`, time: t.msgs[next].time, text: next === 'm14' ? s.held(GUARD_N) : s.loop(next)});
      }
      specs.push({k: 'guard'});
    }
  }
  return {specs, working, queue, latestIn};
}

function receiverSpecs(d: number, t: Text, i: number): Built {
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
  if (i < GUARD || d === NOW) return {specs, working: false, latestIn: 'm4'};
  for (const id of ['m6', 'm8', 'm10', 'm12'] as MsgId[]) {
    const next = `m${Number(id.slice(1)) + 1}` as MsgId;
    specs.push({k: 'msg', mid: id}, {k: 'tools', id: `r-t-${id}`, list: [{name: 'edit', path: 'charts/chart2.py'}]}, {k: 'msg', mid: next}, {k: 'asst', id: `r-a-${next}`, time: t.msgs[next].time, text: r.loop(next)});
  }
  specs.push({k: 'guard'});
  if (i === CONT && !review.discarded) {
    specs.push({k: 'msg', mid: 'm14'}, {k: 'tools', id: 'r-t-m14', list: [{name: 'read', path: 'report/report.md', running: true}]});
    return {specs, working: true, latestIn: 'm14', released: true};
  }
  return {specs, working: false, latestIn: 'm12'};
}

// ---------- Directions: how a sent message is drawn and where ----------

const linkRe = /#oh-(sender|receiver)-(m\d+)/g;

function render(d: number, c: Ctx, specs: Spec[]): Row[] {
  const {t, side} = c;
  const out = (id: MsgId) => t.msgs[id].from === side;
  const user = (s: Extract<Spec, {k: 'user'}>) => row(s.id, 'user', <UserMessage sourceText={s.text} time={s.time} onCopy={noop} />);
  const tools = (s: Extract<Spec, {k: 'tools'}>) => row(s.id, 'tools', <div className="aam-tools">{s.list.map((x, k) => (
    <ToolRow key={k} name={x.name} targetText={x.path} statusLabel={x.refused ? t.refused : x.running ? t.running : t.done}
      state={x.refused ? 'failed' : x.running ? 'running' : 'succeeded'} errorSummary={x.refused} expanded={false} onToggle={noop} />))}</div>);
  const asst = (s: Extract<Spec, {k: 'asst'}>, folds: MsgId[] = []) => row(s.id, 'assistant', (
    <div className="aam-msg"><AssistantMessage streamState={s.streaming ? 'streaming' : 'complete'} time={s.time} onCopy={noop}>
      <Markdown text={s.text} />
      {folds.map((id) => <Fold key={id} c={c} id={id} alone={false} />)}
    </AssistantMessage></div>));
  const incoming = (id: MsgId) => row(`in-${id}`, 'user', <InLetter t={t} id={id} side={side} />);
  const guard = () => row('guard', 'line', <Guard c={c} />);

  if (d === NOW || d === A) {
    return specs.map((s) => s.k === 'user' ? user(s) : s.k === 'tools' ? tools(s) : s.k === 'asst' ? asst(s) : s.k === 'guard' ? guard()
      : out(s.mid) ? row(`out-${s.mid}`, 'out', <OutLetter c={c} id={s.mid} mirror={d === A} />) : incoming(s.mid));
  }
  if (d === B) {
    // The turn's sent messages gather under its next reply; before the reply,
    // at the end of the turn so far.
    const rows: Row[] = [];
    let pending: MsgId[] = [];
    const flush = () => { for (const id of pending) rows.push(row(`out-${id}`, 'out', <OutLine c={c} id={id} />)); pending = []; };
    for (const s of specs) {
      if (s.k === 'msg' && out(s.mid)) { pending.push(s.mid); continue; }
      if (s.k === 'asst') { rows.push(asst(s)); flush(); continue; }
      if (s.k === 'tools') { rows.push(tools(s)); continue; }
      flush();
      rows.push(s.k === 'user' ? user(s) : s.k === 'guard' ? guard() : incoming(s.mid));
    }
    flush();
    return rows;
  }
  // C: a reply that links a sent message carries it; otherwise it stands alone.
  const folded = new Map<string, MsgId[]>();
  const linked = new Set<MsgId>();
  for (const s of specs) {
    if (s.k !== 'asst') continue;
    const ids = [...s.text.matchAll(linkRe)].filter(([, to]) => to === other(side)).map(([, , id]) => id as MsgId).filter((id) => out(id));
    if (ids.length) folded.set(s.id, ids);
    ids.forEach((id) => linked.add(id));
  }
  return specs.flatMap((s) => {
    if (s.k === 'user') return [user(s)];
    if (s.k === 'tools') return [tools(s)];
    if (s.k === 'asst') return [asst(s, folded.get(s.id))];
    if (s.k === 'guard') return [guard()];
    if (!out(s.mid)) return [incoming(s.mid)];
    return linked.has(s.mid) ? [] : [row(`out-${s.mid}`, 'out', <Fold c={c} id={s.mid} alone />)];
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
  const {lang, step, discarded} = useReview();
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
  const s = senderSpecs(d, t, i), r = receiverSpecs(d, t, i);
  const stamp = `${d}-${step}-${lang}-${discarded}`;
  const native = (b: Built) => (
    <figure className="aam-native" data-testid="native">
      <figcaption>{t.receives}</figcaption>
      <pre data-testid="native-text">{b.latestIn ? nativeText(t, b.latestIn, b.released, d === NOW ? 'hop' : 'count') : t.nothingYet}</pre>
    </figure>
  );
  return (
    <div className="aam-live" ref={scope}>
      <Pane side="sender" t={t} title={t.senderTitle} ws={t.senderWs} built={s} rows={render(d, {t, side: 'sender', i, discarded}, s.specs)} stamp={stamp}>{native(s)}</Pane>
      <Pane side="receiver" t={t} title={t.receiverTitle} ws={t.receiverWs} built={r} rows={render(d, {t, side: 'receiver', i, discarded}, r.specs)} stamp={stamp}>{native(r)}</Pane>
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

void LOOP;
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
