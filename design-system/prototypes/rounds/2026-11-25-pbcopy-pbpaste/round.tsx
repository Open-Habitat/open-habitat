import React, {type ReactNode, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
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
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {WarningBannerView} from '../../../../web/src/components/WarningBanner';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {type Browser, EXPIRES, type Lang, lineCount, looksSecret, nativeText, REPLY, SECRET, size, type Step, STEPS, TEXT, type Text, TRACE} from './text';
import './round.css';

// pbcopy-pbpaste-every, round 1. Axis: where the agent's copy (pbcopy) and
// its request to read the person's clipboard (pbpaste) appear. Now (no
// commands; the agent writes the text into its reply and the person pastes
// a message), A Card (a Habitat card in the turn right after the command),
// B By the field (copy straight to the clipboard where the browser allows,
// the request docked above the composer, the pasted text editable before
// it is given), C Notice (a page notice, the timeline keeps only the command
// row). In every direction reading needs a press, and what would be given
// is shown before it leaves. Header, messages, tool rows, timeline,
// composer and the page notice are production; the cards are this round's.

type Review = {theme: string; lang: Lang; step: Step; browser: Browser};
let review: Review = {theme: 'light', lang: 'fi', step: 'copy', browser: 'chromium'};
const listeners = new Set<() => void>();
const setReview = (r: Partial<Review>) => { review = {...review, ...r}; listeners.forEach((l) => l()); };
const useReview = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => review);
const noop = () => {};
setPersonalLanguage('fi');

const NOW = 0, A = 1, B = 2, C = 3;
const at = (s: Step) => STEPS.indexOf(s);
const pasteStep = (s: Step) => at(s) >= at('ask');
/** The clipboard the person has, per step: the traceback, or the demo key. */
const clipOf = (s: Step) => (s === 'secret' || s === 'declined' ? SECRET : TRACE);
const outcome = (s: Step): 'open' | 'preview' | 'given' | 'declined' | 'expired' =>
  s === 'ask' ? 'open' : s === 'preview' || s === 'secret' ? 'preview' : s === 'given' ? 'given' : s === 'declined' ? 'declined' : 'expired';
// Writing to the real clipboard where the page may; the review sandbox
// usually refuses, and that is fine: the story goes on either way.
const tryCopy = (text: string) => { try { void navigator.clipboard?.writeText(text).catch(noop); } catch { /* sandboxed */ } };

type Row = {id: string; kind: string; content: ReactNode};
const row = (id: string, kind: string, content: ReactNode): Row => ({id, kind, content: <div data-item={id}>{content}</div>});

// ---------- This round's pieces ----------

function Clip({text, lines, testid}: {text: string; lines?: number; testid: string}) {
  const t = TEXT[review.lang];
  const all = text.split('\n');
  const shown = lines && all.length > lines ? all.slice(0, lines) : all;
  return (
    <div className="pbc-clip" data-testid={testid}>
      <pre>{shown.join('\n')}</pre>
      {shown.length < all.length ? <p className="pbc-clip-more">{t.more(all.length - shown.length)}</p> : null}
    </div>
  );
}

function Btn({primary, onClick, testid, children}: {primary?: boolean; onClick: () => void; testid: string; children: ReactNode}) {
  return <button type="button" className={`pbc-btn${primary ? ' pbc-btn-primary' : ''}`} data-testid={testid} onClick={onClick}>{children}</button>;
}

function Kind({cmd}: {cmd: string}) { return <code className="pbc-kind">{cmd}</code>; }

/** A: the copy card in the turn. */
function CopyCard({t, step, lang}: {t: Text; step: Step; lang: Lang}) {
  const reply = REPLY[lang];
  const done = step !== 'copy';
  return (
    <section className="ah-mp-card pbc-card" data-testid="copy-card" data-done={done || undefined} aria-label={t.copyHead}>
      <header className="pbc-card-head"><Icon name="copy" /><strong>{t.copyHead}</strong><Kind cmd={t.copyKind} /></header>
      <Clip text={reply} lines={4} testid="copy-preview" />
      <div className="pbc-card-foot">
        <Btn primary={!done} testid="copy" onClick={() => { tryCopy(reply); setReview({step: 'copied'}); }}>{done ? t.copyAgain : t.copy}</Btn>
        <span className="pbc-meta" role="status">{done ? t.copiedAt('10.14') : t.linesOf(lineCount(reply), size(reply, lang))}</span>
      </div>
    </section>
  );
}

/** A: the request card; it becomes a one-line record once settled. */
function AskCard({t, step, lang, browser}: {t: Text; step: Step; lang: Lang; browser: Browser}) {
  const o = outcome(step), clip = clipOf(step);
  if (o === 'given' || o === 'declined' || o === 'expired') return <SettledLine t={t} step={step} />;
  return (
    <section className="ah-mp-card pbc-card" data-tone="attention" data-testid="ask-card" aria-label={t.askHead}>
      <header className="pbc-card-head"><Icon name="paperclip" /><strong>{o === 'open' ? t.askHead : t.previewHead}</strong><Kind cmd={t.askKind} /></header>
      {o === 'open' ? (
        <>
          <p>{t.askWhy}</p>
          <div className="pbc-card-foot">
            <Btn primary testid="paste" onClick={() => setReview({step: 'preview'})}>{t.pasteFrom}</Btn>
            <Btn testid="dont-give" onClick={() => setReview({step: 'declined'})}>{t.dontGive}</Btn>
            <span className="pbc-meta">{t.pasteKey}</span>
          </div>
          <p className="pbc-meta pbc-wait" data-testid="waiting">{t.waiting(EXPIRES)}</p>
        </>
      ) : (
        <Preview t={t} clip={clip} lang={lang} browser={browser} />
      )}
    </section>
  );
}

function Preview({t, clip, lang, browser, editable}: {t: Text; clip: string; lang: Lang; browser: Browser; editable?: boolean}) {
  const secret = looksSecret(clip);
  return (
    <>
      <p className="pbc-meta">{t.browserHint[browser]}</p>
      {editable
        ? <textarea className="pbc-field" data-testid="paste-field" aria-label={t.pasteFieldLabel} defaultValue={clip} rows={Math.min(lineCount(clip), 7)} />
        : <Clip text={clip} lines={7} testid="paste-preview" />}
      <p className="pbc-meta" data-testid="paste-size">{t.previewOf(lineCount(clip), size(clip, lang))}{editable ? ` · ${t.editable}` : ''}</p>
      {secret ? <p className="pbc-warn" data-testid="secret-warn" role="note"><Icon name="key" /><span>{t.secretWarn}</span></p> : null}
      <div className="pbc-card-foot">
        <Btn primary={!secret} testid="give" onClick={() => setReview({step: 'given'})}>{t.give}</Btn>
        <Btn primary={secret} testid="cancel" onClick={() => setReview({step: 'declined'})}>{t.dontGive}</Btn>
      </div>
    </>
  );
}

function SettledLine({t, step}: {t: Text; step: Step}) {
  const o = outcome(step);
  return (
    <p className="ah-mp-line pbc-line" role="note" data-testid="settled" data-outcome={o}>
      <span className="ah-mp-line-mark" aria-hidden="true" />
      <span>{o === 'given' ? t.givenLine('10.16', lineCount(TRACE)) : o === 'declined' ? t.declinedLine('10.16') : t.expiredLine(EXPIRES)}</span>
    </p>
  );
}

/** B: a direct copy where the browser lets it, else the same line with Copy. */
function CopyLine({t, step, lang, browser}: {t: Text; step: Step; lang: Lang; browser: Browser}) {
  const [open, setOpen] = useState(false);
  const reply = REPLY[lang], n = lineCount(reply);
  const direct = browser === 'chromium' || step !== 'copy';
  return (
    <div className="pbc-copyline" data-testid="copy-line" data-direct={browser === 'chromium' || undefined}>
      <p className="ah-mp-line">
        <span className="ah-mp-line-mark" aria-hidden="true" />
        <span role="status">{direct ? t.copiedDirect(n, '10.14') : t.copyWaits(n)}</span>
        <Kind cmd={t.copyKind} />
        {!direct ? <Btn primary testid="copy" onClick={() => { tryCopy(reply); setReview({step: 'copied'}); }}>{t.copy}</Btn> : null}
        <button type="button" className="pbc-linkish" data-testid="copy-show" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? t.hide : t.show}</button>
      </p>
      {open ? <Clip text={reply} testid="copy-preview" /> : null}
    </div>
  );
}

/** B: the request docked above the composer, with an editable paste field. */
function Dock({t, step, lang, browser}: {t: Text; step: Step; lang: Lang; browser: Browser}) {
  const o = outcome(step);
  if (o !== 'open' && o !== 'preview') return null;
  return (
    <div className="pbc-dock-wrap"><section className="pbc-dock" data-testid="ask-dock" aria-label={t.askHead}>
      <header className="pbc-card-head"><Icon name="paperclip" /><strong>{t.askHead}</strong><Kind cmd={t.askKind} /><span className="pbc-meta pbc-push" data-testid="waiting">{t.waiting(EXPIRES)}</span></header>
      {o === 'open' ? (
        <>
          <p className="pbc-meta">{t.askWhy}</p>
          <textarea className="pbc-field" data-testid="paste-field" aria-label={t.pasteFieldLabel} placeholder={t.pasteField} rows={2}
            onPaste={(e) => { e.preventDefault(); setReview({step: 'preview'}); }} />
          <div className="pbc-card-foot">
            <Btn primary testid="paste" onClick={() => setReview({step: 'preview'})}>{t.pasteFrom}</Btn>
            <Btn testid="dont-give" onClick={() => setReview({step: 'declined'})}>{t.dontGive}</Btn>
          </div>
        </>
      ) : <Preview key={step} t={t} clip={clipOf(step)} lang={lang} browser={browser} editable />}
    </section></div>
  );
}

/** C: page notices from the production banner. */
function Notices({t, step, lang, browser}: {t: Text; step: Step; lang: Lang; browser: Browser}) {
  const reply = REPLY[lang];
  const o = outcome(step);
  const out: ReactNode[] = [];
  if (!pasteStep(step)) {
    const done = step === 'copied';
    out.push(
      <WarningBannerView key="copy" data-testid="copy-notice" tone={done ? 'success' : 'neutral'} icon="copy" placement="page"
        title={done ? t.copyNoticeDone(t.convTitle, '10.14') : t.copyNotice(t.convTitle, lineCount(reply))}
        actions={done ? undefined : <><Btn primary testid="copy" onClick={() => { tryCopy(reply); setReview({step: 'copied'}); }}>{t.copy}</Btn></>}>
        {done ? null : <Clip text={reply} lines={2} testid="copy-preview" />}
      </WarningBannerView>);
  } else if (o === 'open' || o === 'preview') {
    out.push(
      <WarningBannerView key="ask" data-testid="ask-notice" tone="neutral" icon="paperclip" placement="page" title={t.askNotice(t.convTitle)}
        actions={o === 'open' ? <><Btn primary testid="paste" onClick={() => setReview({step: 'preview'})}>{t.pasteFrom}</Btn><Btn testid="dont-give" onClick={() => setReview({step: 'declined'})}>{t.dontGive}</Btn></> : undefined}>
        {o === 'open' ? <span>{t.askWhy} <span className="pbc-meta" data-testid="waiting">{t.waiting(EXPIRES)}</span></span>
          : <div className="pbc-sheet"><Preview t={t} clip={clipOf(step)} lang={lang} browser={browser} /></div>}
      </WarningBannerView>);
  }
  return <div className="pbc-notices" data-testid="notices">{out}</div>;
}

// ---------- The story ----------

type Tool = {name: string; path: string; state: 'succeeded' | 'running' | 'failed'; error?: string};
type Spec =
  | {k: 'user'; id: string; time: string; text: string; givenAs?: boolean}
  | {k: 'asst'; id: string; time: string; text: string}
  | {k: 'tools'; id: string; list: Tool[]}
  | {k: 'piece'; id: string; kind: string; node: ReactNode};

function specs(d: number, t: Text, step: Step, lang: Lang, browser: Browser): {list: Spec[]; working: boolean; waiting: boolean; draft?: string} {
  const reply = REPLY[lang];
  const file = `drafts/${lang === 'fi' ? 'vastaus-aino' : 'reply-aino'}.txt`;
  const list: Spec[] = [
    {k: 'user', id: 'u1', time: '10.12', text: t.askCopy},
    {k: 'tools', id: 't1', list: [{name: 'write', path: file, state: 'succeeded'}]},
    {k: 'asst', id: 'a1', time: '10.13', text: t.wroteReply},
  ];
  const copyFailed = d === NOW;
  list.push({k: 'tools', id: 't2', list: [{name: 'bash', path: `pbcopy < ${file}`, state: copyFailed ? 'failed' : 'succeeded', error: copyFailed ? 'exit 127' : undefined}]});
  if (d === NOW) list.push({k: 'asst', id: 'a2', time: '10.13', text: `${t.nowReply}\n\n\`\`\`text\n${reply}\n\`\`\``});
  else if (d === A) list.push({k: 'piece', id: 'copy', kind: 'line', node: <CopyCard t={t} step={step} lang={lang} />}, {k: 'asst', id: 'a2', time: '10.13', text: t.copiedReply});
  else if (d === B) list.push({k: 'piece', id: 'copy', kind: 'line', node: <CopyLine t={t} step={step} lang={lang} browser={browser} />},
    {k: 'asst', id: 'a2', time: '10.13', text: browser === 'chromium' ? t.copiedReplyB : t.copiedReplyBAsk});
  else list.push({k: 'asst', id: 'a2', time: '10.13', text: t.copiedReplyC});
  if (!pasteStep(step)) return {list, working: false, waiting: false};

  const o = outcome(step), clip = clipOf(step);
  list.push({k: 'user', id: 'u2', time: '10.15', text: t.askPaste});
  if (d === NOW) {
    list.push({k: 'tools', id: 't3', list: [{name: 'bash', path: 'pbpaste', state: 'failed', error: 'exit 127'}]}, {k: 'asst', id: 'a3', time: '10.15', text: t.nowPaste});
    // Today the person pastes it as their own message; nothing warns.
    if (o === 'preview') return {list, working: false, waiting: false, draft: clip};
    if (o === 'given' || o === 'declined') list.push({k: 'user', id: 'u3', time: '10.16', text: clip});
    return {list, working: false, waiting: false};
  }
  const settled = o === 'given' || o === 'declined' || o === 'expired';
  const toolState = !settled ? 'running' : o === 'given' ? 'succeeded' : 'failed';
  list.push({k: 'tools', id: 't3', list: [{name: 'bash', path: 'pbpaste', state: toolState, error: o === 'declined' ? 'exit 1 clipboard_declined' : o === 'expired' ? 'exit 4 clipboard_timeout' : undefined}]});
  if (d === A) list.push({k: 'piece', id: 'ask', kind: 'line', node: <AskCard t={t} step={step} lang={lang} browser={browser} />});
  if ((d === B || d === C) && settled) list.push({k: 'piece', id: 'settled', kind: 'line', node: <SettledLine t={t} step={step} />});
  if (!settled) return {list, working: true, waiting: true};
  list.push({k: 'asst', id: 'a3', time: o === 'expired' ? EXPIRES : '10.16', text: o === 'given' ? t.gotPaste : o === 'declined' ? t.declinedPaste : t.timeoutPaste});
  return {list, working: false, waiting: false};
}

function rows(t: Text, list: Spec[]): Row[] {
  return list.map((s) => {
    if (s.k === 'user') return row(s.id, 'user', <UserMessage sourceText={s.text} time={s.time} onCopy={noop} />);
    if (s.k === 'asst') return row(s.id, 'assistant', <div className="pbc-msg"><AssistantMessage streamState="complete" time={s.time} onCopy={noop}><Markdown text={s.text} /></AssistantMessage></div>);
    if (s.k === 'piece') return row(s.id, s.kind, s.node);
    return row(s.id, 'tools', <div className="pbc-tools">{s.list.map((x, k) => (
      <ToolRow key={k} name={x.name} targetText={x.path} state={x.state} errorSummary={x.error} expanded={false} onToggle={noop}
        statusLabel={x.state === 'running' ? (x.path === 'pbpaste' ? t.waitingTool : t.running) : x.state === 'failed' ? t.failed : t.done} />))}</div>);
  });
}

function Live({d}: {d: number}) {
  const {lang, step, browser} = useReview();
  const t = TEXT[lang];
  const s = specs(d, t, step, lang, browser);
  const [draft, setDraft] = useState('');
  const frame = useRef<HTMLDivElement>(null);
  const stamp = `${d}-${step}-${lang}-${browser}`;
  useLayoutEffect(() => {
    setDraft(s.draft ?? '');
    let el: HTMLElement | null = frame.current?.querySelector('[data-testid="conversation-timeline"]') ?? null;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    el?.scrollTo({top: 1e6});
  }, [stamp]);
  return (
    <div className="pbc-live">
      <div className="pbc-frame" ref={frame} data-testid="frame">
        <ConversationFrame>
          <AgentHeader title={t.convTitle} workspaceLabel={t.ws} workspaceHref={`/workspaces/ws_${t.ws}`}
            activityLabel={s.waiting ? t.activity.waiting : s.working ? t.activity.working : t.activity.idle}
            activityKind={s.waiting ? 'neutral' : s.working ? 'working' : undefined} activityAnimated={s.working && !s.waiting}
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          {d === C ? <Notices t={t} step={step} lang={lang} browser={browser} /> : null}
          <ConversationStream>
            <ConversationTimeline state="ready" items={rows(t, s.list)} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          {d === B ? <Dock t={t} step={step} lang={lang} browser={browser} /> : null}
          <Composer value={draft} onChange={setDraft} activity={s.working ? 'working' : 'idle'} selectedWorkingMode="follow_up" onModeChange={noop}
            onSendNow={() => { if (d === NOW && step === 'preview') setReview({step: 'given'}); }} onSteer={noop} onFollowUp={noop} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">medium</button>} />
        </ConversationFrame>
      </div>
      <figure className="pbc-native" data-testid="native">
        <figcaption>{t.receives}</figcaption>
        <pre data-testid="native-text">{nativeText(t, lang, d, step, browser)}</pre>
        {d === C ? <p className="pbc-meta">{t.notInC}</p> : null}
      </figure>
    </div>
  );
}

// ---------- The page ----------

function App({direction}: {direction: number}) {
  const {theme, lang, step, browser} = useReview();
  const t = TEXT[lang];
  const [generation, setGeneration] = useState(0);
  const [all, setAll] = useState(false);
  const i = STEPS.indexOf(step);
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useLayoutEffect(() => {
    setPersonalLanguage(lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('.proto-picker-item').forEach((b, k) => { b.textContent = t.picker[k].replaceAll(' ', '\u00a0'); });
  }, [lang]);
  return (
    <div className={`pbc-review variant-${direction}`} data-direction={direction}>
      <header className="pbc-bar" data-all={all || undefined}>
        <div className="pbc-controls">
          <strong>{t.title}</strong>
          <label>{t.theme} <select id="theme" value={theme} onChange={(e) => setReview({theme: e.target.value})}>
            {(['light', 'dark', 'contrast'] as const).map((v) => <option key={v} value={v}>{t.themes[v]}</option>)}</select></label>
          <label>{t.language} <select id="lang" value={lang} onChange={(e) => setReview({lang: e.target.value as Lang})}>
            <option value="fi">suomi</option><option value="en">English</option></select></label>
          <label>{t.browser} <select id="browser" value={browser} onChange={(e) => setReview({browser: e.target.value as Browser})}>
            {(['chromium', 'gesture'] as const).map((v) => <option key={v} value={v}>{t.browsers[v]}</option>)}</select></label>
          <span className="pbc-steps">
            <label>{t.step} <select id="step" value={step} onChange={(e) => setReview({step: e.target.value as Step})}>
              {STEPS.map((v) => <option key={v} value={v}>{t.steps[v]}</option>)}</select></label>
            <button type="button" data-testid="prev" disabled={i === 0} onClick={() => setReview({step: STEPS[i - 1]})}>{t.prev}</button>
            <button type="button" data-testid="next" disabled={i === STEPS.length - 1} onClick={() => setReview({step: STEPS[i + 1]})}>{t.next}</button>
          </span>
          <button type="button" data-testid="reset" onClick={() => { setReview({step: 'copy'}); setGeneration((g) => g + 1); }}>{t.reset}</button>
          <span className="pbc-hint">{t.hint}</span>
        </div>
        <button type="button" className="pbc-all-toggle" data-testid="all" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? t.fewer : t.all}</button>
        <div className="pbc-study" data-testid="lines">
          <h2>{t.axis}</h2>
          <ol>{t.lines.map((l, k) => <li key={k} aria-current={k === direction ? 'true' : undefined}>{l}</li>)}</ol>
          <p className="pbc-recommend">{t.recommend}</p>
        </div>
      </header>
      <StatusBellProvider items={[]}>
        <MemoryRouter key={`${generation}-${lang}`} initialEntries={['/workspaces/ws_raportit?conversation=pi:demo']}>
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
let memorySearch = '';
const memoryLocation = {get search() { return memorySearch; }, toString: () => `about:blank${memorySearch}`};
const memoryHistory = {replaceState: (_s: unknown, _t: string, url: URL) => { memorySearch = url.search; }};
new Function('stage', 'variants', 'location', 'history', pickerSource)(stageSink, variants, memoryLocation, memoryHistory);
