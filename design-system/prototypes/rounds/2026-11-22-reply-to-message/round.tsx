import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
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
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader, AppShell, NowSections, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// reply-to-agent-message (a second person on a household installation, via
// Jari 22.11.2026). A small control in an agent reply's corner starts a reply
// to that message; a quote of it waits above the field like in WhatsApp;
// pressing the quote scrolls to the original and highlights it; ✕ removes it.
// The agent receives the message's native entry id and the quoted excerpt.
//
// The axis is how much of the message the reference carries and how heavy it
// sits in the composer and in the sent message: a quote card above the field
// (the message's start), a quote of a chosen passage (selected text, marked
// in the original), or a one-line tab fused to the field. The corner control,
// the jump and ✕ are the same in all three.
//
// Rail, header, messages, tool rows, timeline, composer and the icon button
// are the production components; the reply control's arrow, the quote, the
// tab and the passage mark are this round's. AssistantMessage does not pass
// `actions` to Message yet, so the corner control is laid over the card.
// Everything is synthetic; nothing is sent.

setPersonalLanguage('fi');

const directions = ['A Lainaus', 'B Kohta', 'C Kieleke'];
const LINES = [
  'A Lainaus: kentän yllä kortti, jossa viestin alku kahdella rivillä; lähetetyn viestin alussa sama lainaus.',
  'B Kohta: valitse tekstiä vastauksesta ja lainaa vain se; kohta pysyy korostettuna alkuperäisessä, kunnes lähetät.',
  'C Kieleke: yksi rivi kiinni kentän yläreunassa; lähetetyn viestin yllä vain linkkirivi “Vastaus viestiin klo …”.',
];
const RECOMMEND = 'Suositus: A. Tuttu WhatsAppista, toimii puhelimessa ilman tekstin valintaa, ja lainaus näkyy myös lähetetyssä. B:n kohdan valinnan voi lisätä myöhemmin samaan korttiin.';
const A = 0, B = 1, C = 2;

type Quote = {target: string; key: string; time: string; excerpt: string; passage: boolean};
type Item =
  | {id: string; kind: 'user'; time: string; text: string; reply?: Quote}
  | {id: string; kind: 'assistant'; time: string; text: string; key: string}
  | {id: string; kind: 'tools'; time: string; tools: {name: string; path: string; stat?: string}[]};

const CONVO: Item[] = [
  {id: 'u1', kind: 'user', time: '9.12', text: 'Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat.'},
  {id: 't1', kind: 'tools', time: '9.13', tools: [{name: 'bash', path: 'pytest -q'}]},
  {id: 'a1', kind: 'assistant', key: '7f3c9a21', time: '9.14', text: 'Ajoin testit: 41 läpi, 2 epäonnistui.\n\n- `test_dst_march` odottaa varjon kulmaksi 41,2°, mutta saa 26,2°: kesäajan tunti puuttuu laskusta.\n- `test_dst_october` epäonnistuu samasta syystä toiseen suuntaan.'},
  {id: 'u2', kind: 'user', time: '9.18', text: 'Ehdota kaksi tapaa korjata tämä.'},
  {id: 'a2', kind: 'assistant', key: 'b81e04d6', time: '9.20', text: 'Kaksi tapaa:\n\n1. **zoneinfo**: lasketaan paikallinen aika aikavyöhykkeen mukaan. Toimii kaikkialla, mutta vaatii tzdata-paketin Windowsissa.\n2. **Kiinteä siirtymä**: lisätään tunti maaliskuun ja lokakuun välille. Yksinkertainen, mutta oikein vain Suomessa.\n\nSuosittelen ensimmäistä.'},
  {id: 'u3', kind: 'user', time: '9.24', text: 'Mitä tzdata tarkoittaa käyttöönotossa?'},
  {id: 'a3', kind: 'assistant', key: '0d55e7b3', time: '9.26', text: 'Se on Pythonin aikavyöhyketietokanta. Linuxissa ja macOS:ssä tieto tulee käyttöjärjestelmästä; Windowsissa lisätään `tzdata` riippuvuudeksi `pyproject.toml`:iin. Muuta käyttöönotossa ei tarvita.'},
  {id: 'u4', kind: 'user', time: '9.29', text: 'Korjaako zoneinfo myös lokakuun tapauksen?', reply: undefined},
  {id: 'a4', kind: 'assistant', key: 'c2a9f810', time: '9.31', text: 'Korjaa. Lokakuussa kello siirtyy taaksepäin, ja zoneinfo tietää senkin päivän. Lisäisin testit Helsingille ja Sydneylle, jotta molemmat pallonpuoliskot tulevat katetuiksi.'},
];
const A1_PASSAGE = 'epäonnistuu samasta syystä toiseen suuntaan.';
const A2_PASSAGE = 'Toimii kaikkialla, mutta vaatii tzdata-paketin Windowsissa.';
const DRAFT = 'Mennään ensimmäisellä. Windows ei ole meillä käytössä.';
const REPLY = 'Selvä: zoneinfo ilman tzdataa. Teen muutoksen `src/shadow.py`:hyn ja ajan testit.';

const assistant = (id: string) => CONVO.find((i) => i.id === id) as Extract<Item, {kind: 'assistant'}>;
/** The message's start as plain text, as the quote shows it. */
function startOf(text: string) {
  return text.replace(/\*\*|`/g, '').replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '').replace(/\s*\n+\s*/g, ' ').trim();
}
function quoteOf(id: string | Extract<Item, {kind: 'assistant'}>, passage?: string): Quote {
  const a = typeof id === 'string' ? assistant(id) : id;
  return {target: a.id, key: a.key, time: a.time, excerpt: passage ?? startOf(a.text), passage: !!passage};
}
/** The history reply u4 and the reply in progress, per direction. */
function start(d: number) {
  const history = CONVO.map((i) => (i.id === 'u4' ? {...i, reply: quoteOf('a1', d === B ? A1_PASSAGE : undefined)} : i));
  return {history, quote: quoteOf('a2', d === B ? A2_PASSAGE : undefined)};
}

/** What the native session would get: see the issue's result.md. */
function payload(text: string, q: Quote) {
  const excerpt = q.excerpt.length > 280 ? `${q.excerpt.slice(0, 279)}…` : q.excerpt;
  return `<reply-to entry="${q.key}" role="assistant"${q.passage ? ' part="passage"' : ''}>\n${excerpt}\n</reply-to>\n\n${text}`;
}

const noop = () => {};

function ReplyGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 7 5 12l5 5" />
      <path d="M5 12h9a5 5 0 0 1 5 5v1" />
    </svg>
  );
}

/** The corner control: same in every direction. */
function ReplyControl({id, time, active, onReply}: {id: string; time: string; active: boolean; onReply: () => void}) {
  return (
    <span className="rp-corner" data-active={active || undefined}>
      <ControlButton data-testid={`reply-${id}`} aria-label={`Vastaa tähän viestiin (klo ${time})`} aria-pressed={active}
        variant="quiet" size="row" presentation="messageIcon" onPress={onReply}>
        <ReplyGlyph />
      </ControlButton>
    </span>
  );
}

/** The quote inside a sent message (A, B) or the link line above it (C). */
function SentQuote({d, q, onJump}: {d: number; q: Quote; onJump: (q: Quote) => void}) {
  if (d === C) {
    return (
      <button type="button" className="rp-sent-link" data-testid="sent-quote" onClick={() => onJump(q)}>
        <ReplyGlyph />
        <span>Vastaus agentin viestiin klo {q.time}</span>
      </button>
    );
  }
  return (
    <button type="button" className="rp-sent-quote" data-testid="sent-quote" data-passage={q.passage || undefined} onClick={() => onJump(q)}
      aria-label={`Siirry agentin viestiin klo ${q.time}`}>
      <span className="rp-quote-head">Agentti · klo {q.time}</span>
      <span className="rp-quote-text">{q.passage ? `”${q.excerpt}”` : q.excerpt}</span>
    </button>
  );
}

/** The reference above the field. */
function ComposerQuote({d, q, onJump, onRemove}: {d: number; q: Quote; onJump: (q: Quote) => void; onRemove: () => void}) {
  const remove = (
    <ControlButton data-testid="quote-remove" aria-label="Poista lainaus" variant="quiet" size="row" presentation="messageIcon" onPress={onRemove}>
      <Icon name="cross" />
    </ControlButton>
  );
  if (d === C) {
    return (
      <div className="rp-tab" data-testid="composer-quote" role="group" aria-label="Vastaat agentin viestiin">
        <button type="button" className="rp-tab-jump" data-testid="quote-jump" onClick={() => onJump(q)}>
          <ReplyGlyph />
          <span className="rp-tab-who">Agentti {q.time}</span>
          <span className="rp-tab-text">{q.excerpt}</span>
        </button>
        {remove}
      </div>
    );
  }
  return (
    <div className="rp-card" data-testid="composer-quote" data-passage={q.passage || undefined} role="group" aria-label="Vastaat agentin viestiin">
      <button type="button" className="rp-card-jump" data-testid="quote-jump" onClick={() => onJump(q)}>
        <span className="rp-quote-head">
          <ReplyGlyph />
          {q.passage ? `Vastaat kohtaan agentin viestissä · klo ${q.time}` : `Vastaat agentin viestiin · klo ${q.time}`}
        </span>
        <span className="rp-quote-text">{q.passage ? `”${q.excerpt}”` : q.excerpt}</span>
      </button>
      {remove}
    </div>
  );
}

/** Text-node range of `passage` inside the message `id`, for the CSS
 * highlight that marks the quoted part without touching React's DOM. */
function passageRange(id: string, passage: string): Range | null {
  const root = document.querySelector(`[data-item="${id}"] .ah-prose`);
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let all = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { nodes.push(n as Text); all += (n as Text).data; }
  const at = all.indexOf(passage);
  if (at < 0) return null;
  const range = document.createRange();
  let pos = 0;
  for (const n of nodes) {
    const end = pos + n.data.length;
    if (at >= pos && at < end) range.setStart(n, at - pos);
    if (at + passage.length >= pos && at + passage.length <= end) { range.setEnd(n, at + passage.length - pos); break; }
    pos = end;
  }
  return range;
}
function setHighlight(name: string, range: Range | null) {
  const reg = (globalThis as unknown as {CSS?: {highlights?: Map<string, unknown>}}).CSS?.highlights;
  const H = (globalThis as unknown as {Highlight?: new (...r: Range[]) => unknown}).Highlight;
  if (!reg || !H) return;
  if (range) reg.set(name, new H(range)); else reg.delete(name);
}

type Floating = {id: string; text: string; x: number; y: number};

function Main({d}: {d: number}) {
  const initial = useRef(start(d)).current;
  const [items, setItems] = useState<Item[]>(initial.history);
  const [quote, setQuote] = useState<Quote | null>(initial.quote);
  const [draft, setDraft] = useState(DRAFT);
  const [flash, setFlash] = useState<{id: string; n: number; passage?: string} | null>(null);
  const [floating, setFloating] = useState<Floating | null>(null);
  const showPayload = usePayloadToggle();

  const focusField = () => setTimeout(() => document.querySelector<HTMLTextAreaElement>('.ah-cbox-field')?.focus(), 30);
  const reply = (a: Extract<Item, {kind: 'assistant'}>) => { setQuote(quoteOf(a)); setFloating(null); focusField(); };
  const jump = (q: Quote) => {
    const el = document.querySelector<HTMLElement>(`[data-item="${q.target}"]`);
    if (!el) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({block: 'center', behavior: smooth ? 'smooth' : 'auto'});
    setFlash((f) => ({id: q.target, n: (f?.n ?? 0) + 1, passage: q.passage ? q.excerpt : undefined}));
  };
  // Open at the latest message, as the product does.
  useEffect(() => {
    let frame = 0, tries = 0;
    const toEnd = () => {
      let el = document.querySelector<HTMLElement>('[data-item="a4"]')?.parentElement ?? null;
      while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
      if (el) el.scrollTop = el.scrollHeight; else if (tries++ < 30) frame = requestAnimationFrame(toEnd);
    };
    frame = requestAnimationFrame(toEnd);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  // B: the quoted passage stays marked in the original while the reply is
  // drafted; a jump flashes it.
  // The timeline mounts its rows after this component's first commit, so a
  // range not found yet is looked for again on the next frames.
  useLayoutEffect(() => {
    let frame = 0, tries = 0;
    const mark = () => {
      const want = d === B && quote?.passage;
      const q = want ? passageRange(quote!.target, quote!.excerpt) : null;
      setHighlight('rp-quote', q);
      setHighlight('rp-flash', flash?.passage ? passageRange(flash.id, flash.passage) : null);
      if (want && !q && tries++ < 30) frame = requestAnimationFrame(mark);
    };
    mark();
    return () => cancelAnimationFrame(frame);
  });
  // A layout cleanup, so a remount's new mark is not deleted by the old one's passive cleanup.
  useLayoutEffect(() => () => { setHighlight('rp-quote', null); setHighlight('rp-flash', null); }, []);

  // B: a selection inside a reply offers "Vastaa tähän kohtaan".
  useEffect(() => {
    if (d !== B) return;
    const pick = () => {
      const sel = getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const host = (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest<HTMLElement>('[data-role="assistant"] .ah-prose');
      const id = host?.closest<HTMLElement>('[data-item]')?.dataset.item;
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      if (!id || !text) return;
      const r = range.getBoundingClientRect();
      setFloating({id, text, x: Math.min(Math.max(r.left + r.width / 2, 90), innerWidth - 90), y: Math.max(r.top, 120)});
    };
    const outside = (e: Event) => { if (!(e.target as Element).closest?.('.rp-float')) setFloating(null); };
    document.addEventListener('mouseup', pick);
    document.addEventListener('keyup', pick);
    document.addEventListener('touchend', pick);
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('mouseup', pick);
      document.removeEventListener('keyup', pick);
      document.removeEventListener('touchend', pick);
      document.removeEventListener('mousedown', outside);
    };
  }, [d]);

  const send = (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body) return;
    const n = items.length;
    setItems((s) => [...s, {id: `s${n}`, kind: 'user', time: '9.40', text: body, reply: quote ?? undefined}]);
    setQuote(null);
    setDraft('');
    setTimeout(() => setItems((s) => [...s, {id: `r${n}`, kind: 'assistant', key: `e${n}7d0c1a`, time: '9.41', text: REPLY}]), 700);
  };

  const rows = items.map((i) => {
    let content: ReactNode;
    if (i.kind === 'tools') {
      content = <div className="rp-tools">{i.tools.map((t, k) => <ToolRow key={k} name={t.name} targetText={t.path} stat={t.stat} statusLabel="Valmis" state="succeeded" expanded={false} onToggle={noop} />)}</div>;
    } else if (i.kind === 'assistant') {
      content = (
        <div className="rp-msg" data-role="assistant" data-quoted={quote?.target === i.id || undefined}>
          <AssistantMessage streamState="complete" time={i.time} onCopy={noop}><Markdown text={i.text} /></AssistantMessage>
          <ReplyControl id={i.id} time={i.time} active={quote?.target === i.id} onReply={() => reply(i)} />
        </div>
      );
    } else {
      content = (
        <div className="rp-msg" data-role="user">
          {i.reply && d === C ? <SentQuote d={d} q={i.reply} onJump={jump} /> : null}
          <UserMessage sourceText={i.text} time={i.time} onCopy={noop}>
            {i.reply && d !== C ? <SentQuote d={d} q={i.reply} onJump={jump} /> : null}
            <Markdown text={i.text} />
          </UserMessage>
          {i.reply && showPayload ? (
            <figure className="rp-payload" data-testid="payload">
              <figcaption>Agentti saa (näkyy vain tässä tarkastelussa)</figcaption>
              <pre>{payload(i.text, i.reply)}</pre>
            </figure>
          ) : null}
        </div>
      );
    }
    const flashing = flash?.id === i.id && !flash.passage;
    return {id: i.id, kind: i.kind, content: <div data-item={i.id} key={flashing ? `${i.id}-${flash!.n}` : i.id} data-flash={flashing || undefined}>{content}</div>};
  });

  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Habitat" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      now={<NowSections yours={[]} running={[
        {agentId: 'pi:orig', title: 'Kesäajan virhe', href: '/workspaces/ws_a?conversation=pi:orig', activityLabel: 'Valmis', controlLabel: '', workspaceName: 'aurinkokello', detail: 'aurinkokello', selected: true},
        {agentId: 'pi:other', title: 'Varjon piirto SVG:ksi', href: '/workspaces/ws_a?conversation=pi:other', activityLabel: 'Valmis', controlLabel: '', workspaceName: 'aurinkokello', detail: 'aurinkokello'},
      ]} />}>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" selected />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle="Kesäajan virhe" rail={rail} main={
        <div className="rp-main" data-testid="conversation">
          <ConversationFrame>
            <AgentHeader title="Kesäajan virhe" workspaceLabel="aurinkokello" workspaceHref="/workspaces/ws_a"
              activityLabel="" controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
            <ConversationStream>
              <ConversationTimeline state="ready" items={rows} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
            </ConversationStream>
            <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer" onModeChange={noop}
              onSendNow={send} onSteer={send} onFollowUp={send} csrf="prototype"
              idlePlaceholder={quote ? 'Kirjoita vastaus…' : undefined}
              beforeField={quote ? <ComposerQuote d={d} q={quote} onJump={jump} onRemove={() => { setQuote(null); focusField(); }} /> : undefined}
              modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
          </ConversationFrame>
          {floating ? (
            <div className="rp-float" style={{left: floating.x, top: floating.y}} data-testid="passage-float">
              <ControlButton data-testid="passage-reply" variant="primary" size="row"
                onPress={() => { setQuote(quoteOf(items.find((i) => i.id === floating.id) as Extract<Item, {kind: 'assistant'}>, floating.text)); setFloating(null); getSelection()?.removeAllRanges(); focusField(); }}>
                Vastaa tähän kohtaan
              </ControlButton>
            </div>
          ) : null}
        </div>
      } />
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
let reviewPayload = false;
const payloadListeners = new Set<(v: boolean) => void>();
function usePayloadToggle() {
  const [v, setV] = useState(reviewPayload);
  useEffect(() => { payloadListeners.add(setV); return () => { payloadListeners.delete(setV); }; }, []);
  return v;
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [payloadOn, setPayloadOn] = useState(reviewPayload);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <div className={`rp-review variant-${direction}`} data-direction={direction}>
      <header className="rp-bar" ref={bar}>
        <div className="rp-controls">
          <strong>Vastaa agentin viestiin</strong>
          <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
            <option value="light">Päivä</option><option value="dark">Yö</option><option value="contrast">Korkea kontrasti</option></select></label>
          <label><input id="payload" type="checkbox" checked={payloadOn}
            onChange={(e) => { reviewPayload = e.target.checked; setPayloadOn(reviewPayload); payloadListeners.forEach((f) => f(reviewPayload)); }} /> Näytä, mitä agentti saa</label>
          <button type="button" data-testid="rp-reset" onClick={() => setGeneration((g) => g + 1)}>Alusta</button>
        </div>
        <ol className="rp-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rp-recommend" data-testid="recommendation">{RECOMMEND}</p>
      </header>
      <div className="rp-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_a?conversation=pi:orig']}>
          <Main key={generation} d={direction} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
