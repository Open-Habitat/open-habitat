import React, {type ReactNode, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import {AgentTurn, type TurnStep} from '../../../../web/src/components/AgentTurn';
import {Composer, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader, AgentNavItem} from '../../../../web/src/components/Navigation';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {formatDate, setPersonalLanguage} from '../../../../web/src/i18n';
import {agentTurnText} from '../../../../web/src/text/agentTurn';
import {conversationEventsText} from '../../../../web/src/text/conversationEvents';
import {type Lang, type Run, TEXT, type Text, type Zone} from './text';
import './round.css';

// times-conversations-prototype, round 3. Jari 25.11.2026 chose round 2's
// A Header (the time right after the name on both sides) on top of round 1's
// B Clock and day separators. This round riffs on when the turn's duration
// shows and how a stopped turn says how long it ran. Now (= round 2 A),
// A Every long turn, B Only new information, C End row; the threshold is
// 5 min in all of them. The conversation is round 2's plus a turn with four
// stages, a turn the person stopped mid-tool, a multi-stage turn the person
// stopped and a turn a server restart cut. Header, messages, AgentTurn with
// its work rows, stopped row and live clock, the composer and the rail row
// are production, unchanged. AgentTurn's reply card has no time prop and its
// stopped row has no duration, so the round places the time, the duration
// and the restated stopped row from outside; an implementation would pass
// them as props.

type Review = {theme: string; lang: Lang; zone: Zone; run: Run};
let review: Review = {theme: 'light', lang: 'fi', zone: 'Europe/Helsinki', run: 'done'};
const listeners = new Set<() => void>();
// The zone control stands for the device's zone. Production formats in the
// browser's default zone (the stopped row's time), so the page makes the
// chosen zone that default rather than changing production.
const NativeFormat = Intl.DateTimeFormat;
const DeviceFormat = function (locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
  return new NativeFormat(locales, {timeZone: review.zone, ...options});
} as unknown as typeof Intl.DateTimeFormat;
Object.assign(DeviceFormat, {supportedLocalesOf: NativeFormat.supportedLocalesOf});
DeviceFormat.prototype = NativeFormat.prototype;
Intl.DateTimeFormat = DeviceFormat;
const setReview = (r: Partial<Review>) => { review = {...review, ...r}; listeners.forEach((l) => l()); };
const useReview = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => review);
const noop = () => {};
setPersonalLanguage('fi');

const NOW_D = 0, A = 1, B = 2, C = 3;
const LONG = 300;
// "Now" is Tuesday 24 Nov 2026 10:12:14 in Helsinki (UTC+2).
const at = (s: string) => Date.parse(`2026-11-${s}+02:00`);
const NOW = at('24T10:12:14');

// ---------- The synthetic conversation, as native history would save it ----------

type ToolState = 'succeeded' | 'running' | 'cancelled';
type Step = {kind: 'tool'; name: string; path: string; at: number; state: ToolState} | {kind: 'text'; at: number; say: string};
/** `stopped`: the turn ended in an aborted reply saved at `at`; `by` a restart. */
type Exchange = {user: number; steps: Step[]; stopped?: {at: number; by?: 'restart'}};
const tool = (name: string, path: string, s: string, state: ToolState = 'succeeded'): Step => ({kind: 'tool', name, path, at: at(s), state});
const text = (s: string, say: string): Step => ({kind: 'text', at: at(s), say});

function exchanges(run: Run): Exchange[] {
  const last: Step[] = run === 'done'
    ? [tool('read', 'kuvat/hakemisto.json', '24T09:53:00'), tool('bash', 'cp kuvapankki/tehdas-0{1,2}.tif kuvat/', '24T10:05:00'), tool('bash', 'typst compile vuosikertomus.typ out/vuosikertomus-2026.pdf', '24T10:07:10'), text('24T10:07:30', 't9')]
    : [tool('read', 'kuvat/hakemisto.json', '24T09:53:00'), tool('bash', 'cp kuvapankki/tehdas-0{1,2}.tif kuvat/', '24T10:05:00'), tool('bash', 'typst compile vuosikertomus.typ out/vuosikertomus-2026.pdf', '24T10:05:00', 'running')];
  return [
    // 0: 41 s, one stage.
    {user: at('20T14:02:10'), steps: [tool('read', 'docs/2025.md', '20T14:02:30'), tool('write', 'docs/2026.md', '20T14:02:44'), text('20T14:02:51', 't0')]},
    // 1: 6 min 15 s, two stages.
    {user: at('20T14:20:05'), steps: [tool('read', 'data/talous.csv', '20T14:20:40'), tool('edit', 'docs/2026.md', '20T14:21:30'), text('20T14:22:10', 't1i'),
      tool('write', 'charts/liikevaihto.py', '20T14:24:00'), tool('bash', 'python charts/liikevaihto.py && python charts/kulut.py', '20T14:25:40'), text('20T14:26:20', 't1')]},
    // 2: stopped by the person mid-tool after 12 min 31 s, one stage.
    {user: at('20T14:40:00'), steps: [tool('bash', 'python charts/render.py --dpi 600', '20T14:52:30', 'cancelled')], stopped: {at: at('20T14:52:31')}},
    // 3: 1 min 10 s.
    {user: at('23T09:15:00'), steps: [tool('bash', 'diff data/talous.csv data/talous-v2.csv', '23T09:15:30'), tool('edit', 'docs/2026.md', '23T09:16:00'), text('23T09:16:10', 't3')]},
    // 4: 12 s, no work.
    {user: at('23T09:18:02'), steps: [text('23T09:18:14', 't4')]},
    // 5: 48 min 40 s, four stages.
    {user: at('23T09:30:00'), steps: [
      tool('read', 'docs/2026.md', '23T09:30:20'), tool('edit', 'docs/2026.md', '23T09:41:10'), text('23T09:42:40', 't5a'),
      tool('edit', 'docs/2026.md', '23T09:51:00'), tool('edit', 'docs/2026.md', '23T09:55:30'), text('23T09:56:00', 't5b'),
      tool('edit', 'docs/2026.md', '23T10:06:00'), text('23T10:06:30', 't5c'),
      tool('bash', 'vale docs/2026.md', '23T10:17:50'), text('23T10:18:40', 't5')]},
    // 6: stopped by the person after 8 min 20 s, two stages (an interim reply, then more work).
    {user: at('23T13:10:00'), steps: [tool('read', 'docs/2026.md', '23T13:10:30'), tool('write', 'docs/2026-en.md', '23T13:13:40'), text('23T13:14:00', 't6i'),
      tool('edit', 'docs/2026-en.md', '23T13:17:10')], stopped: {at: at('23T13:18:20')}},
    // 7: 23 min 05 s, one stage.
    {user: at('23T16:40:00'), steps: [tool('bash', 'typst compile vuosikertomus.typ out/vuosikertomus-2026.pdf', '23T17:02:30'), tool('bash', 'pdfimages -list out/vuosikertomus-2026.pdf', '23T17:02:50'), text('23T17:03:05', 't7')]},
    // 8: cut by a server restart after 11 min 10 s, one stage.
    {user: at('23T17:30:00'), steps: [tool('bash', 'mogrify -resize 1600x kuvat/*.tif', '23T17:38:40'), tool('bash', 'zip -r out/kuvat.zip kuvat/', '23T17:41:10', 'cancelled')], stopped: {at: at('23T17:41:10'), by: 'restart'}},
    // 9: 15 min 30 s, one stage; can be switched to running.
    {user: at('24T09:52:00'), steps: last},
  ];
}

/** Stages as production counts them: one per text, plus trailing work. */
const stageCount = (steps: Step[]) => steps.filter((s) => s.kind === 'text').length + (steps.at(-1)?.kind === 'tool' ? 1 : 0);

// ---------- Time in the device's zone ----------

const clock = (ms: number, zone: Zone) => formatDate(ms, {hour: 'numeric', minute: '2-digit', timeZone: zone});
const dayNo = (ms: number, zone: Zone) => {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(ms).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 864e5;
};
function dayLabel(ms: number, zone: Zone, t: Text) {
  const diff = dayNo(NOW, zone) - dayNo(ms, zone);
  if (diff === 0) return t.today;
  if (diff === 1) return t.yesterday;
  const s = formatDate(ms, {weekday: 'short', day: 'numeric', month: t.lang === 'fi' ? 'numeric' : 'short', timeZone: zone}).replace(',', '');
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
// Floored, so it never reads past the work row ("15 min 30 s" → "15 min").
const took = (sec: number, t: Text) => { const m = Math.floor(sec / 60); return m < 60 ? t.minutes(m) : t.hours(Math.floor(m / 60), m % 60); };

// ---------- The direction's rule ----------

type Where = 'header' | 'stop' | 'end' | undefined;
/**
 * Where a turn's duration goes, if anywhere. Every direction uses 5 min.
 * Now: finished turns in the header, stopped never. A: finished in the
 * header, stopped on their row. B: only multi-stage turns, whose sum no work
 * row shows. C: every long turn in an end row (stopped: their own row).
 */
function durationAt(d: number, sec: number, stages: number, stopped: boolean): Where {
  if (sec < LONG) return undefined;
  if (d === B && stages < 2) return undefined;
  if (stopped) return d === NOW_D ? undefined : 'stop';
  return d === C ? 'end' : 'header';
}

// ---------- This round's pieces ----------

function DaySeparator({ms, zone, t}: {ms: number; zone: Zone; t: Text}) {
  return (
    <div className="tt-day" data-testid="day-separator" role="separator" aria-label={dayLabel(ms, zone, t)}>
      <time dateTime={new Date(ms).toISOString()}>{dayLabel(ms, zone, t)}</time>
    </div>
  );
}

type Mark = {time: string; iso: string};
type Close = {where: Where; took?: string; stop?: {verb: string; time: string; iso: string}};

/**
 * Places the saved times and the duration on production's turn from outside:
 * each reply's time right after its name (round 2 A), the duration in the
 * last reply's header or in an end row, and, outside Now, the stopped row
 * restated with its time after the verb ("Keskeytit 14.52 · vuoro kesti
 * 12 min"). Production's own stopped text stays in the DOM, hidden, so React
 * keeps owning its nodes.
 */
function Timed({marks, close, t, children}: {marks: Mark[]; close: Close; t: Text; children: ReactNode}) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    root.querySelectorAll('.tt-mark, .tt-end, .tt-stop').forEach((e) => e.remove());
    const cards = [...root.querySelectorAll('.ah-turn-reply .ah-message')];
    cards.forEach((card, i) => {
      const m = marks[i];
      if (!m) return;
      const header = card.querySelector(':scope > header')!;
      const el = document.createElement('span');
      el.className = 'tt-mark';
      const last = i === cards.length - 1;
      el.innerHTML = `<time class="tt-time" datetime="${m.iso}">${m.time}</time>`
        + (last && close.where === 'header' ? `<span class="tt-took" data-testid="took"> · ${t.turnTook(close.took!)}</span>` : '');
      header.insertBefore(el, header.querySelector('.ah-message-actions'));
    });
    const turn = root.querySelector('.ah-agent-turn');
    const stopped = root.querySelector<HTMLElement>('.ah-turn-stopped');
    if (stopped && close.stop) {
      stopped.classList.add('tt-restated');
      const span = document.createElement('span');
      span.className = 'ah-turn-stopped-text tt-stop';
      span.dataset.testid = 'stop-line';
      span.innerHTML = `${close.stop.verb} <time datetime="${close.stop.iso}">${close.stop.time}</time>`
        + (close.where === 'stop' ? `<span class="tt-took" data-testid="took"> · ${t.turnTook(close.took!)}</span>` : '');
      stopped.append(span);
    }
    if (turn && close.where === 'end') {
      const row = document.createElement('div');
      row.className = 'ah-turn-stopped tt-end';
      row.dataset.testid = 'turn-end';
      row.innerHTML = `<span class="ah-turn-stopped-text"><span class="tt-took" data-testid="took">${t.endTook(close.took!)}</span></span>`;
      turn.append(row);
    }
  });
  return <div ref={box} className="tt-timed">{children}</div>;
}

// ---------- The conversation ----------

type Row = {id: string; kind: string; content: ReactNode};

function rows(d: number, t: Text, zone: Zone, run: Run): {rows: Row[]; working: boolean} {
  const list = exchanges(run);
  const out: Row[] = [];
  let prev: number | undefined;
  let working = false;
  const mark = (ms: number): Mark => ({time: clock(ms, zone), iso: new Date(ms).toISOString()});
  // Production's own words for tool states and the stopped row.
  const stateLabel = conversationEventsText[t.lang].toolStates;
  const turnWords = agentTurnText[t.lang];
  list.forEach((x, i) => {
    const running = run === 'running' && i === list.length - 1;
    working ||= running;
    if (prev === undefined || dayNo(prev, zone) !== dayNo(x.user, zone))
      out.push({id: `day-${i}`, kind: 'marker', content: <DaySeparator ms={x.user} zone={zone} t={t} />});
    out.push({id: `u${i}`, kind: 'user', content: (
      <div data-item={`u${i}`} className="tt-user">
        <UserMessage sourceText={t.u[i]} time={clock(x.user, zone)} onCopy={noop} />
      </div>
    )});
    const steps: TurnStep[] = x.steps.map((s, k): TurnStep => s.kind === 'tool'
      ? {kind: 'tool', key: `${i}:${k}`, at: s.state === 'running' ? undefined : s.at,
        // Wrapped as HistoryView's OrderedBlocks wraps a saved tool block.
        node: <div className="ah-ordered-blocks"><div><ToolRow name={s.name} targetText={s.path} statusLabel={stateLabel[s.state]} state={s.state} expanded={false} onToggle={noop} /></div></div>}
      : {kind: 'text', key: `${i}:${k}`, at: s.at, text: t.r[s.say], node: <Markdown text={t.r[s.say]} />});
    const endAt = x.stopped?.at ?? x.steps.at(-1)!.at;
    const sec = (endAt - x.user) / 1000;
    const stages = stageCount(x.steps);
    const where = running ? undefined : durationAt(d, sec, stages, !!x.stopped);
    const marks = x.steps.filter((s) => s.kind === 'text').map((s) => mark(s.at));
    const close: Close = {where, took: where ? took(sec, t) : undefined,
      stop: x.stopped && d !== NOW_D ? {verb: x.stopped.by === 'restart' ? turnWords.stoppedRestart : turnWords.stopped, ...mark(x.stopped.at)} : undefined};
    const elapsed = Math.floor((NOW - x.user) / 1000);
    out.push({id: `t${i}`, kind: 'assistant', content: (
      <div data-item={`t${i}`} data-took={where} data-stages={stages} data-seconds={Math.round(sec)}>
        <Timed marks={marks} close={close} t={t}>
          <AgentTurn steps={steps} startedAt={x.user} working={running} activity={running ? t.working : undefined}
            stopped={x.stopped ? {at: x.stopped.at, by: x.stopped.by} : undefined}
            duration={running ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : undefined} />
        </Timed>
      </div>
    )});
    prev = running ? x.user : endAt;
  });
  return {rows: out, working};
}

function Conversation({d}: {d: number}) {
  const {lang, zone, run} = useReview();
  const t = TEXT[lang];
  const [draft, setDraft] = useState('');
  const frame = useRef<HTMLDivElement>(null);
  const r = rows(d, t, zone, run);
  useLayoutEffect(() => {
    // Open at the latest entry, as the app does.
    let el: HTMLElement | null = frame.current?.querySelector('[data-testid="conversation-timeline"]') ?? null;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    el?.scrollTo({top: 1e6});
  });
  return (
    <div className="tt-frame" ref={frame}>
      <ConversationFrame>
        <AgentHeader title={t.convTitle} workspaceLabel={t.ws} workspaceHref={`/workspaces/ws_${t.ws}`}
          activityLabel={r.working ? t.activityWorking : t.activityIdle} activityKind={r.working ? 'working' : undefined}
          activityAnimated={r.working} controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
        <ConversationStream>
          <ConversationTimeline state="ready" items={r.rows} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
        </ConversationStream>
        <Composer value={draft} onChange={setDraft} activity={r.working ? 'working' : 'idle'} selectedWorkingMode="follow_up" onModeChange={noop}
          onSendNow={noop} onSteer={noop} onFollowUp={noop} csrf="prototype" modelPicker={<button type="button" className="md-pill">medium</button>} />
      </ConversationFrame>
    </div>
  );
}

function Rail() {
  const {lang, run} = useReview();
  const t = TEXT[lang];
  const last = exchanges(run).at(-1)!;
  const changed = run === 'running' ? at('24T10:12:00') : last.steps.at(-1)!.at;
  const base = {controlLabel: '', activityLabel: t.activityIdle};
  const items = [
    {agentId: 'pi:1', href: '/c/1', title: t.convTitle, changedAt: changed, selected: true,
      activity: run === 'running' ? 'working' : 'idle', activityLabel: run === 'running' ? t.activityWorking : t.activityIdle},
    {agentId: 'pi:2', href: '/c/2', title: t.rail[0], changedAt: at('24T07:05:00'), activity: 'idle'},
    {agentId: 'pi:3', href: '/c/3', title: t.rail[1], changedAt: at('23T17:10:00'), activity: 'idle'},
    {agentId: 'pi:4', href: '/c/4', title: t.rail[2], changedAt: at('22T20:00:00'), activity: 'idle'},
  ];
  return (
    <aside className="tt-rail" data-testid="rail">
      <section className="ah-now">
        <h2 className="ah-rail-section-head">{t.railHead}</h2>
        {/* biome-ignore lint/suspicious/noExplicitAny: synthetic models. */}
        <ul>{items.map((m) => <AgentNavItem key={m.agentId} {...base} {...(m as any)} now={NOW} />)}</ul>
      </section>
      <p className="tt-rail-note">{t.railNote}</p>
    </aside>
  );
}

// ---------- The page ----------

function App({direction}: {direction: number}) {
  const {theme, lang, zone, run} = useReview();
  const t = TEXT[lang];
  const [generation, setGeneration] = useState(0);
  const [all, setAll] = useState(false);
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useLayoutEffect(() => {
    setPersonalLanguage(lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('.proto-picker-item').forEach((b, i) => { b.textContent = t.picker[i].replaceAll(' ', '\u00a0'); });
  }, [lang]);
  return (
    <div className={`tt-review variant-${direction}`} data-direction={direction}>
      <header className="tt-bar" data-all={all || undefined}>
        <div className="tt-controls">
          <strong>{t.title}</strong>
          <label>{t.theme} <select id="theme" value={theme} onChange={(e) => setReview({theme: e.target.value})}>
            {(['light', 'dark', 'contrast'] as const).map((v) => <option key={v} value={v}>{t.themes[v]}</option>)}</select></label>
          <label>{t.language} <select id="lang" value={lang} onChange={(e) => setReview({lang: e.target.value as Lang})}>
            <option value="fi">suomi</option><option value="en">English</option></select></label>
          <label>{t.zone} <select id="zone" value={zone} onChange={(e) => setReview({zone: e.target.value as Zone})}>
            {(['Europe/Helsinki', 'America/New_York'] as const).map((v) => <option key={v} value={v}>{t.zones[v]}</option>)}</select></label>
          <label>{t.run} <select id="run" value={run} onChange={(e) => setReview({run: e.target.value as Run})}>
            {(['done', 'running'] as const).map((v) => <option key={v} value={v}>{t.runs[v]}</option>)}</select></label>
          <button type="button" data-testid="reset" onClick={() => { setReview({zone: 'Europe/Helsinki', run: 'done'}); setGeneration((g) => g + 1); }}>{t.reset}</button>
          <span className="tt-hint">{t.hint}</span>
        </div>
        <button type="button" className="tt-all-toggle" data-testid="all" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? t.fewer : t.all}</button>
        <div className="tt-study" data-testid="lines">
          <h2>{t.axis}</h2>
          <ol>{t.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}</ol>
          <p className="tt-recommend">{t.recommend}</p>
        </div>
      </header>
      <StatusBellProvider items={[]}>
        <MemoryRouter key={`${generation}-${lang}`} initialEntries={['/c/1']}>
          <div className="tt-live" key={`${generation}-${direction}-${lang}-${zone}-${run}`}>
            <Rail />
            <Conversation d={direction} />
          </div>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// A Habitat view is an opaque-origin sandbox: ?v= bookkeeping stays in memory.
let memorySearch = '';
const memoryLocation = {get search() { return memorySearch; }, toString: () => `about:blank${memorySearch}`};
const memoryHistory = {replaceState: (_s: unknown, _t: string, url: URL) => { memorySearch = url.search; }};
new Function('stage', 'variants', 'location', 'history', pickerSource)(stageSink, variants, memoryLocation, memoryHistory);
