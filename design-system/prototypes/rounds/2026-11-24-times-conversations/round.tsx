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
import {type Lang, type Run, TEXT, type Text, type Zone} from './text';
import './round.css';

// times-conversations-prototype, round 1 (Jari 24.11.2026: conversations
// and their messages show no times at all). Axis: how much time the default
// view shows. Now (today), A Days, B Clock, C Gaps. Every time here comes
// from what native history already saves per entry (HistoryEntry.timestamp:
// the moment Pi appended the entry) and is drawn in the device's zone, as
// wakes and night quiet already are. Header, messages, AgentTurn with its
// stage rows and live clock, the composer and the rail row are production,
// unchanged; day separators, gap markers and the turn line are this round's,
// on tokens. AgentTurn's reply card has no time prop, so B and A place the
// saved time into its header from outside; an implementation would pass it.

type Review = {theme: string; lang: Lang; zone: Zone; run: Run};
let review: Review = {theme: 'light', lang: 'fi', zone: 'Europe/Helsinki', run: 'done'};
const listeners = new Set<() => void>();
const setReview = (r: Partial<Review>) => { review = {...review, ...r}; listeners.forEach((l) => l()); };
const useReview = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => review);
const noop = () => {};
setPersonalLanguage('fi');

const A = 1, B = 2, C = 3;
// "Now" is Tuesday 24 Nov 2026 10:12:14 in Helsinki (UTC+2).
const at = (s: string) => Date.parse(`2026-11-${s}+02:00`);
const NOW = at('24T10:12:14');

// ---------- The synthetic conversation, as native history would save it ----------

type Step = {kind: 'tool'; name: string; path: string; at: number; running?: boolean} | {kind: 'text'; at: number; interim?: boolean};
type Exchange = {user: number; steps: Step[]};
const tool = (name: string, path: string, s: string, running = false): Step => ({kind: 'tool', name, path, at: at(s), running});
const text = (s: string, interim = false): Step => ({kind: 'text', at: at(s), interim});

function exchanges(run: Run): Exchange[] {
  const last: Step[] = run === 'done'
    ? [tool('read', 'kuvat/hakemisto.json', '24T09:53:00'), tool('bash', 'cp kuvapankki/tehdas-0{1,2}.tif kuvat/', '24T10:05:00'), tool('bash', 'typst compile vuosikertomus.typ out/vuosikertomus-2026.pdf', '24T10:07:10'), text('24T10:07:30')]
    : [tool('read', 'kuvat/hakemisto.json', '24T09:53:00'), tool('bash', 'cp kuvapankki/tehdas-0{1,2}.tif kuvat/', '24T10:05:00'), tool('bash', 'typst compile vuosikertomus.typ out/vuosikertomus-2026.pdf', '24T10:05:00', true)];
  return [
    {user: at('20T14:02:10'), steps: [tool('read', 'docs/2025.md', '20T14:02:30'), tool('write', 'docs/2026.md', '20T14:02:44'), text('20T14:02:51')]},
    {user: at('20T14:20:05'), steps: [tool('read', 'data/talous.csv', '20T14:20:40'), tool('edit', 'docs/2026.md', '20T14:21:30'), text('20T14:22:10', true),
      tool('write', 'charts/liikevaihto.py', '20T14:24:00'), tool('bash', 'python charts/liikevaihto.py && python charts/kulut.py', '20T14:25:40'), text('20T14:26:20')]},
    {user: at('23T09:15:00'), steps: [tool('bash', 'diff data/talous.csv data/talous-v2.csv', '23T09:15:30'), tool('edit', 'docs/2026.md', '23T09:16:00'), text('23T09:16:10')]},
    {user: at('23T09:18:02'), steps: [text('23T09:18:14')]},
    {user: at('23T16:40:00'), steps: [tool('bash', 'typst compile vuosikertomus.typ out/vuosikertomus-2026.pdf', '23T17:02:30'), tool('bash', 'pdfimages -list out/vuosikertomus-2026.pdf', '23T17:02:50'), text('23T17:03:05')]},
    {user: at('24T09:52:00'), steps: last},
  ];
}

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
const took = (sec: number, t: Text) => { const m = Math.round(sec / 60); return m < 60 ? t.minutes(m) : t.hours(Math.floor(m / 60), m % 60); };

// ---------- This round's pieces ----------

function DaySeparator({ms, zone, t}: {ms: number; zone: Zone; t: Text}) {
  return (
    <div className="tt-day" data-testid="day-separator" role="separator" aria-label={dayLabel(ms, zone, t)}>
      <time dateTime={new Date(ms).toISOString()}>{dayLabel(ms, zone, t)}</time>
    </div>
  );
}

function GapMarker({ms, prev, zone, t}: {ms: number; prev?: number; zone: Zone; t: Text}) {
  const hours = prev === undefined ? 0 : (ms - prev) / 36e5;
  const days = Math.floor(hours / 24);
  const after = prev === undefined ? '' : days >= 1 ? t.gapDays(days) : t.gapHours(Math.floor(hours));
  return (
    <div className="tt-gap" data-testid="gap-marker" role="separator">
      <time dateTime={new Date(ms).toISOString()}>{dayLabel(ms, zone, t)} {clock(ms, zone)}</time>
      {after ? <span> · {after}</span> : null}
    </div>
  );
}

/** AgentTurn draws the reply cards; the saved time goes into their header. */
function TimedTurn({times, children}: {times: string[]; children: ReactNode}) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    box.current?.querySelectorAll('.ah-turn-reply .ah-message > header').forEach((header, i) => {
      let el = header.querySelector('time.tt-time') as HTMLTimeElement | null;
      if (!times[i]) { el?.remove(); return; }
      if (!el) {
        el = document.createElement('time');
        el.className = 'tt-time';
        header.insertBefore(el, header.querySelector('.ah-message-actions'));
      }
      el.textContent = times[i];
    });
  });
  return <div ref={box} className="tt-turn">{children}</div>;
}

// ---------- The conversation ----------

type Row = {id: string; kind: string; content: ReactNode};

function rows(d: number, t: Text, zone: Zone, run: Run): {rows: Row[]; working: boolean} {
  const list = exchanges(run);
  const out: Row[] = [];
  let prev: number | undefined;
  let working = false;
  list.forEach((x, i) => {
    const running = run === 'running' && i === list.length - 1;
    working ||= running;
    if ((d === A || d === B) && (prev === undefined || dayNo(prev, zone) !== dayNo(x.user, zone)))
      out.push({id: `day-${i}`, kind: 'day', content: <DaySeparator ms={x.user} zone={zone} t={t} />});
    if (d === C && (prev === undefined || x.user - prev >= 36e5))
      out.push({id: `gap-${i}`, kind: 'gap', content: <GapMarker ms={x.user} prev={prev} zone={zone} t={t} />});
    const showTime = d === A || d === B;
    out.push({id: `u${i}`, kind: 'user', content: <div data-item={`u${i}`}><UserMessage sourceText={t.u[i]} time={showTime ? clock(x.user, zone) : undefined} onCopy={noop} /></div>});
    const steps: TurnStep[] = x.steps.map((s, k): TurnStep => s.kind === 'tool'
      ? {kind: 'tool', key: `${i}:${k}`, at: s.running ? undefined : s.at,
        node: <ToolRow name={s.name} targetText={s.path} statusLabel={s.running ? t.running : t.done} state={s.running ? 'running' : 'succeeded'} expanded={false} onToggle={noop} />}
      : {kind: 'text', key: `${i}:${k}`, at: s.at, text: s.interim ? t.interim : t.a[i], node: <Markdown text={s.interim ? t.interim : t.a[i]} />});
    const replyTimes = showTime ? x.steps.filter((s) => s.kind === 'text').map((s) => clock(s.at, zone)) : [];
    const end = x.steps.at(-1)!;
    const sec = (end.at - x.user) / 1000;
    const elapsed = Math.floor((NOW - x.user) / 1000);
    out.push({id: `t${i}`, kind: 'turn', content: (
      <div data-item={`t${i}`}>
        <TimedTurn times={replyTimes}>
          <AgentTurn steps={steps} startedAt={x.user} working={running} activity={running ? t.working : undefined}
            duration={running ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : undefined} />
        </TimedTurn>
        {d === C && !running && sec >= 120 ? <p className="tt-turn-line" data-testid="turn-line">{t.turnDone(clock(end.at, zone), took(sec, t))}</p> : null}
      </div>
    )});
    prev = running ? x.user : end.at;
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
  // A: the time is shown on tap too, since a phone has no pointer to hover.
  const tap = (e: React.MouseEvent) => {
    if (d !== A || (e.target as HTMLElement).closest('button, a, input, textarea')) return;
    const msg = (e.target as HTMLElement).closest('.ah-message') as HTMLElement | null;
    if (!msg) return;
    if (msg.dataset.ttShown) delete msg.dataset.ttShown; else msg.dataset.ttShown = 'true';
  };
  return (
    <div className="tt-frame" ref={frame} onClick={tap}>
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
    document.querySelectorAll('.proto-picker-item').forEach((b, i) => { b.textContent = t.picker[i].replaceAll(' ', ' '); });
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
          <span className="tt-hint">{t.hint}{direction === A ? ` ${t.tapHint}` : ''}</span>
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
