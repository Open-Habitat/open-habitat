import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
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

// reply-to-agent-message, round 2 (Jari 23.11.2026): round 1's A (a quote
// card above the field) is the base, drawn in the design system's own
// language with no coloured bar on the left or other styling foreign to
// design-system/. Each direction borrows an existing surface for the quote
// and pairs it with a placement for the reply control and a way of marking
// the original:
//
//   A Liite: the quote is drawn like a draft's attachment chip (the chip's
//     line, radius and surface), above the field where chips sit. The control
//     is in the card's top-right `actions` slot, where Palaa tähän's ⋯ is;
//     a jump washes the original briefly.
//   B Kentän sisällä: the quote is the first row inside the field box, a
//     sunken block like the Markdown frontmatter. The control sits beside
//     Kopioi in the reply's header. The original wears the same sunken
//     surface while the reply is drafted, so the two read as one pair.
//   C Jonon rivi: the quote is the queue's own heading and row
//     (.ah-queue-heading, .ah-queue-items), one line. The control is a quiet
//     "Vastaa" text button under the reply. The original keeps the queue
//     row's accent-soft surface while the reply is drafted.
//
// Rail, header, messages, tool rows, timeline, composer, buttons and the queue
// classes are production; the reply glyph and the round's quote rules are
// this round's. AssistantMessage does not take `actions` yet, so the control
// is portalled into the rendered card where production would pass it.
// Everything is synthetic; nothing is sent.

setPersonalLanguage('fi');

const directions = ['A Liite', 'B Kentän sisällä', 'C Jonon rivi'];
const LINES = [
  'A Liite: lainaus on liitekortin näköinen kortti kentän yllä; ↩ viestin oikeassa yläkulmassa (kuten Palaa tähän); hyppy välähdyttää alkuperäisen.',
  'B Kentän sisällä: lainaus on kentän laatikon ensimmäinen rivi, upotettu pinta; ↩ Kopioi-painikkeen vieressä; alkuperäinen on samaa upotettua pintaa niin kauan kuin vastaus on kesken.',
  'C Jonon rivi: lainaus on jonon otsake ja yksi rivi; Vastaa-tekstipainike viestin alla; alkuperäinen pysyy jonon rivin sävyssä niin kauan kuin vastaus on kesken.',
];
const RECOMMEND = 'Suositus: B. Lainaus on osa kenttää eikä uusi kortti sen päällä, ↩ on samassa paikassa kuin Kopioi, ja sama upotettu pinta alkuperäisessä näyttää ilman hyppyä, mihin vastaat.';
const A = 0, B = 1, C = 2;

type Quote = {target: string; key: string; time: string; excerpt: string};
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
  {id: 'u4', kind: 'user', time: '9.29', text: 'Korjaako zoneinfo myös lokakuun tapauksen?'},
  {id: 'a4', kind: 'assistant', key: 'c2a9f810', time: '9.31', text: 'Korjaa. Lokakuussa kello siirtyy taaksepäin, ja zoneinfo tietää senkin päivän. Lisäisin testit Helsingille ja Sydneylle, jotta molemmat pallonpuoliskot tulevat katetuiksi.'},
];
const DRAFT = 'Mennään ensimmäisellä. Windows ei ole meillä käytössä.';
const REPLY = 'Selvä: zoneinfo ilman tzdataa. Teen muutoksen `src/shadow.py`:hyn ja ajan testit.';

const assistant = (id: string) => CONVO.find((i) => i.id === id) as Extract<Item, {kind: 'assistant'}>;
/** The message's start as plain text, as the quote shows it. */
function startOf(text: string) {
  return text.replace(/\*\*|`/g, '').replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '').replace(/\s*\n+\s*/g, ' ').trim();
}
const quoteOf = (a: Extract<Item, {kind: 'assistant'}>): Quote => ({target: a.id, key: a.key, time: a.time, excerpt: startOf(a.text)});
function start() {
  const history = CONVO.map((i) => (i.id === 'u4' ? {...i, reply: quoteOf(assistant('a1'))} : i));
  return {history, quote: quoteOf(assistant('a2'))};
}

/** What the native session records, per the recommended option (result.md, Vaihtoehto 1). */
function payload(text: string, q: Quote) {
  const cut = q.excerpt.length > 280 ? `${q.excerpt.slice(0, q.excerpt.lastIndexOf(' ', 279))} …` : q.excerpt;
  return `<reply-to entry="${q.key}" time="${q.time}">\n${cut}\n</reply-to>\n\n${text}`;
}

const noop = () => {};

function ReplyGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 7 5 12l5 5" />
      <path d="M5 12h9a5 5 0 0 1 5 5v1" />
    </svg>
  );
}

/** The element `selector` inside this row's rendered card, found after mount. */
function useCardPart(selector: string) {
  const probe = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let frame = 0, tries = 0;
    const find = () => {
      const el = probe.current?.parentElement?.querySelector<HTMLElement>(selector) ?? null;
      if (el) setHost(el); else if (tries++ < 30) frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, [selector]);
  return {probe, host};
}

/** The reply control. Production would pass it as AssistantMessage's
 * `actions` (A), beside the copy button (B) or below the prose (C). */
function ReplyControl({d, id, time, active, onReply}: {d: number; id: string; time: string; active: boolean; onReply: () => void}) {
  const {probe, host} = useCardPart('.ah-message header');
  const label = `Vastaa tähän viestiin (klo ${time})`;
  if (d === C) {
    return (
      <div className="rp-c-actions">
        <ControlButton data-testid={`reply-${id}`} aria-label={label} aria-pressed={active} variant="quiet" size="row" onPress={onReply}>
          <ReplyGlyph /> Vastaa
        </ControlButton>
      </div>
    );
  }
  const control = (
    <span className={d === A ? 'ah-message-actions rp-a-corner' : 'rp-b-beside'} data-active={active || undefined}>
      <ControlButton data-testid={`reply-${id}`} aria-label={label} aria-pressed={active} variant="quiet" size="row" presentation="messageIcon" onPress={onReply}>
        <ReplyGlyph />
      </ControlButton>
    </span>
  );
  return <><span ref={probe} hidden />{host ? createPortal(control, host) : null}</>;
}

/** The quote inside a sent message: the same surface as in the field. */
function SentQuote({d, q, onJump}: {d: number; q: Quote; onJump: (q: Quote) => void}) {
  const label = `Siirry agentin viestiin klo ${q.time}`;
  if (d === C) {
    return (
      <button type="button" className="rp-c-sent" data-testid="sent-quote" aria-label={label} onClick={() => onJump(q)}>
        <span className="rp-c-time">↩ {q.time}</span>
        <span className="rp-c-text">{q.excerpt}</span>
      </button>
    );
  }
  return (
    <button type="button" className={d === A ? 'rp-a-sent' : 'rp-b-sent'} data-testid="sent-quote" aria-label={label} onClick={() => onJump(q)}>
      <span className="rp-head"><ReplyGlyph /><span>Agentin viesti</span><time>{q.time}</time></span>
      <span className="rp-text">{q.excerpt}</span>
    </button>
  );
}

function RemoveQuote({onRemove}: {onRemove: () => void}) {
  return (
    <ControlButton data-testid="quote-remove" aria-label="Poista lainaus" variant="quiet" size="row" presentation="messageIcon" onPress={onRemove}>
      <Icon name="cross" />
    </ControlButton>
  );
}

/** A: the chip-like card above the field; C: the queue heading and row. */
function ComposerQuote({d, q, onJump, onRemove}: {d: number; q: Quote; onJump: (q: Quote) => void; onRemove: () => void}) {
  if (d === C) {
    return (
      <section className="ah-queue rp-c-quote" data-testid="composer-quote" aria-label="Vastaat agentin viestiin">
        <div className="ah-queue-heading">
          <h2>Vastaat agentin viestiin</h2>
          <RemoveQuote onRemove={onRemove} />
        </div>
        <ol className="ah-queue-items">
          <li>
            <button type="button" className="rp-c-jump" data-testid="quote-jump" onClick={() => onJump(q)} aria-label={`Siirry agentin viestiin klo ${q.time}`}>
              <span>{q.time}</span>
              <span className="rp-c-text">{q.excerpt}</span>
            </button>
          </li>
        </ol>
      </section>
    );
  }
  return (
    <div className={d === A ? 'rp-a-card' : 'rp-b-card'} data-testid="composer-quote" role="group" aria-label="Vastaat agentin viestiin">
      <button type="button" className="rp-jump" data-testid="quote-jump" onClick={() => onJump(q)} aria-label={`Vastaat agentin viestiin klo ${q.time}. Siirry viestiin.`}>
        <span className="rp-head"><ReplyGlyph /><span>Vastaat agentin viestiin</span><time>{q.time}</time></span>
        <span className="rp-text">{q.excerpt}</span>
      </button>
      <RemoveQuote onRemove={onRemove} />
    </div>
  );
}

/** B: the quote is the field box's first row. */
function InFieldQuote(props: {q: Quote; onJump: (q: Quote) => void; onRemove: () => void}) {
  const [box, setBox] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let frame = 0, tries = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>('.rp-stage .ah-cbox');
      if (el) setBox(el); else if (tries++ < 30) frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, []);
  return box ? createPortal(<ComposerQuote d={B} {...props} />, box) : null;
}

function Main({d}: {d: number}) {
  const initial = useRef(start()).current;
  const [items, setItems] = useState<Item[]>(initial.history);
  const [quote, setQuote] = useState<Quote | null>(initial.quote);
  const [draft, setDraft] = useState(DRAFT);
  const [flash, setFlash] = useState<{id: string; n: number} | null>(null);
  const showPayload = usePayloadToggle();

  const focusField = () => setTimeout(() => document.querySelector<HTMLTextAreaElement>('.ah-cbox-field')?.focus(), 30);
  const reply = (a: Extract<Item, {kind: 'assistant'}>) => { setQuote(quoteOf(a)); focusField(); };
  const jump = (q: Quote) => {
    const el = document.querySelector<HTMLElement>(`[data-item="${q.target}"]`);
    if (!el) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({block: 'center', behavior: smooth ? 'smooth' : 'auto'});
    setFlash((f) => ({id: q.target, n: (f?.n ?? 0) + 1}));
  };
  const remove = () => { setQuote(null); focusField(); };
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
      const quoted = quote?.target === i.id;
      content = (
        <div className="rp-msg" data-role="assistant" data-quoted={quoted || undefined}>
          <AssistantMessage streamState="complete" time={i.time} onCopy={noop}><Markdown text={i.text} /></AssistantMessage>
          <ReplyControl d={d} id={i.id} time={i.time} active={quoted} onReply={() => reply(i)} />
        </div>
      );
    } else {
      content = (
        <div className="rp-msg" data-role="user">
          <UserMessage sourceText={i.text} time={i.time} onCopy={noop}>
            {i.reply ? <SentQuote d={d} q={i.reply} onJump={jump} /> : null}
            <Markdown text={i.text} />
          </UserMessage>
          {i.reply && showPayload ? (
            <figure className="rp-payload" data-testid="payload">
              <figcaption>Natiivi istunto kirjaa (näkyy vain tässä tarkastelussa)</figcaption>
              <pre>{payload(i.text, i.reply)}</pre>
            </figure>
          ) : null}
        </div>
      );
    }
    const flashing = flash?.id === i.id;
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
              beforeField={quote && d !== B ? <ComposerQuote d={d} q={quote} onJump={jump} onRemove={remove} /> : undefined}
              modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
            {quote && d === B ? <InFieldQuote key={quote.target} q={quote} onJump={jump} onRemove={remove} /> : null}
          </ConversationFrame>
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
          <strong>Vastaa agentin viestiin · kierros 2</strong>
          <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
            <option value="light">Päivä</option><option value="dark">Yö</option><option value="contrast">Korkea kontrasti</option></select></label>
          <label><input id="payload" type="checkbox" checked={payloadOn}
            onChange={(e) => { reviewPayload = e.target.checked; setPayloadOn(reviewPayload); payloadListeners.forEach((f) => f(reviewPayload)); }} /> Näytä, mitä natiivi istunto kirjaa</label>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
