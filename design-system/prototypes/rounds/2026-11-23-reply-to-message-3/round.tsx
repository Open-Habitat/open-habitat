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
import {AgentHeader} from '../../../../web/src/components/Navigation';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// reply-to-agent-message, round 3 (Jari 23.11.2026). Settled: the reply
// control sits in the agent message's top-right corner, the quote sits inside
// the composer (round 2 B), and the daemon builds `<reply-to entry="…">` from
// the native session (architecture option 1). This round riffs three things:
//
//   1. the corner control's shape, size, border and tint (A, B, C), at rest,
//      under the pointer, in focus, while replied to and on touch;
//   2. how a long message's quote sits inside the composer (A, B, C);
//   3. the excerpt the agent receives: (a) 280 characters, (b) the first
//      sentence, (c) the start with its structure kept.
//
// The picker's direction applies 1 and 2 together to the live conversation;
// the sections below it show every variation side by side, so a control from
// one direction can be read beside a quote from another. The page is one
// document for a Habitat view: no iframes, no navigation, no network. The
// phone column in each section applies the touch rules to a phone-wide
// column; the real phone layout is the same page at phone width.
//
// Messages, header, tool rows, timeline, composer and buttons are production;
// the reply glyph and the quote rules are this round's, on tokens only.
// AssistantMessage does not take `actions` yet, so the control is portalled
// into the card's header where production's `actions` slot renders.

setPersonalLanguage('fi');

const directions = ['A', 'B', 'C'];
const CONTROL_LINES = [
  'A Kopioin pari: neliö kuten Kopioi (32 px, ei reunaa eikä sävyä, korostuksen väri), aina näkyvissä; puhelimessa 40 px.',
  'B Rajattu ja hiljainen: pienempi neliö (26 px), ohut reuna, vaimea väri; työpöydällä näkyy osoittimen alla tai fokuksessa kuten Palaa tähän, puhelimessa aina (32 px).',
  'C Sävytetty pilleri: ↩ ja sana Vastaa korostuksen vaaleassa sävyssä, aina näkyvissä; puhelimessa pelkkä ↩ samassa sävyssä (32 px).',
];
const QUOTE_LINES = [
  'A Kaksi riviä: viestin alku kahdella rivillä, loppu katkeaa kolmeen pisteeseen; napautus vie alkuperäiseen. Kenttä kasvaa aina saman verran.',
  'B Avattava viesti: kolme riviä, loppu häivytetään; Näytä koko viesti avaa koko viestin kentän sisään (enintään kolmannes kentän tilasta, vierii).',
  'C Sama kuin agentille: lainaus on täsmälleen agentille lähtevä ote rakenteineen (koodi tasalevyisenä, lista listana), neljä riviä ja häivytys; Näytä koko ote avaa loput otteesta.',
];
const EXCERPT_LINES = [
  'a 280 merkkiä: viestin teksti yhdeksi riviksi, katkaistu sanan kohdalta 280 merkkiin.',
  'b Ensimmäinen virke: teksti ensimmäiseen pisteeseen, huutomerkkiin tai kysymysmerkkiin (enintään 280 merkkiä).',
  'c Alku rakenteineen: viestin oma Markdown kokonaisina riveinä noin 280 merkkiin, viimeinen rivi virkkeen tai sanan kohdalta, koodilohko suljettuna.',
];
const RECOMMEND = {
  control: 'Suositus A: sama painike kuin Kopioi, joten viestin toiminnot näyttävät yhdeltä perheeltä; aina näkyvä painike löytyy ilman osoitinta ja toimii samoin kosketuksella.',
  quote: 'Suositus C: kentässä näkyy juuri se, mitä agentti saa, eikä mitään piilossa olevaa lähde; kenttä kasvaa enintään neljä riviä, ja koko viestiin pääsee napauttamalla.',
  excerpt: 'Suositus c: se on yhtä lyhyt kuin a, mutta lista pysyy listana ja koodi koodina, ja se ei katkea lyhenteeseen tai pelkkään johdantoon kuten b.',
};
const A = 0, B = 1, C = 2;
type Excerpt = 'a' | 'b' | 'c';
const EXCERPTS: Excerpt[] = ['a', 'b', 'c'];
const EXCERPT_NAMES: Record<Excerpt, string> = {a: '280 merkkiä', b: 'Ensimmäinen virke', c: 'Alku rakenteineen'};

// ---------- The conversation (synthetic) ----------

type AssistantItem = {id: string; kind: 'assistant'; time: string; text: string; key: string; sample?: string};
type Quote = {target: string; key: string; time: string; text: string};
type Item =
  | {id: string; kind: 'user'; time: string; text: string; reply?: Quote; excerpt?: Excerpt}
  | AssistantItem
  | {id: string; kind: 'tools'; time: string; tools: {name: string; path: string}[]};

const LONG = [
  'Kesäajan virhe johtuu siitä, että `shadow.py` laskee paikallisen ajan kiinteästä UTC+2-siirtymästä, esim. maaliskuun viimeisen sunnuntain jälkeen se on tunnin jäljessä. Siksi varjon kulma on maalis–lokakuussa 15° pielessä, mikä on täsmälleen tunnin kierto.',
  '',
  'Korjaus on siirtyä aikavyöhykkeeseen, joka tietää siirtymäpäivät itse. Pythonin `zoneinfo` tekee tämän ilman uusia riippuvuuksia Linuxissa ja macOS:ssä; Windowsissa tarvitaan `tzdata`-paketti.',
  '',
  '```python',
  'from zoneinfo import ZoneInfo',
  '',
  'def local(ts: datetime, place: str) -> datetime:',
  '    return ts.astimezone(ZoneInfo(place))',
  '```',
  '',
  'Muutokset:',
  '',
  '- `local()` korvaa `utc_plus_two()`-funktion kaikissa kolmessa kutsussa.',
  '- Testeihin tulee Helsinki ja Sydney, jotta molemmat pallonpuoliskot katetaan.',
  '- `README.md` mainitsee `tzdata`n Windows-käyttäjille.',
  '',
  'Aloitanko?',
].join('\n');
const CODE_FIRST = [
  '```python',
  'def test_dst_march():',
  '    ts = datetime(2026, 3, 29, 12, tzinfo=UTC)',
  '    assert shadow_angle(ts, "Europe/Helsinki") == pytest.approx(41.2)',
  '```',
  '',
  'Tämä testi epäonnistuu nyt, koska laskenta ei tiedä kesäajasta. Lisäsin sen ensin, jotta korjaus näkyy punaisesta vihreäksi.',
].join('\n');
const LIST = [
  'Kaksi tapaa:',
  '',
  '1. **zoneinfo**: lasketaan paikallinen aika aikavyöhykkeen mukaan. Toimii kaikkialla, mutta vaatii tzdata-paketin Windowsissa.',
  '2. **Kiinteä siirtymä**: lisätään tunti maaliskuun ja lokakuun välille. Yksinkertainen, mutta oikein vain Suomessa.',
  '',
  'Suosittelen ensimmäistä.',
].join('\n');
const SHORT = 'Korjaa. Lokakuussa kello siirtyy taaksepäin, ja zoneinfo tietää senkin päivän.';

const CONVO: Item[] = [
  {id: 'u1', kind: 'user', time: '9.12', text: 'Ehdota kaksi tapaa korjata kesäajan virhe.'},
  {id: 'a1', kind: 'assistant', key: '7f3c9a21', time: '9.14', text: LIST, sample: 'Lista'},
  {id: 'u2', kind: 'user', time: '9.16', text: 'Kirjoita ensin testi, joka näyttää virheen.'},
  {id: 't1', kind: 'tools', time: '9.17', tools: [{name: 'edit', path: 'tests/test_shadow.py'}, {name: 'bash', path: 'pytest -q tests/test_shadow.py'}]},
  {id: 'a2', kind: 'assistant', key: '3e90b4c7', time: '9.18', text: CODE_FIRST, sample: 'Alkaa koodilla'},
  {id: 'u3', kind: 'user', time: '9.19', text: 'Selitä, mistä virhe johtuu, ja ehdota korjaus.'},
  {id: 'a3', kind: 'assistant', key: 'b81e04d6', time: '9.20', text: LONG, sample: 'Pitkä'},
  {id: 'u4', kind: 'user', time: '9.29', text: 'Korjaako zoneinfo myös lokakuun tapauksen?'},
  {id: 'a4', kind: 'assistant', key: 'c2a9f810', time: '9.31', text: SHORT, sample: 'Lyhyt'},
];
const SAMPLES = ['a4', 'a3', 'a2', 'a1'].map((id) => CONVO.find((i) => i.id === id) as AssistantItem);
const DRAFT = 'Aloita. Windows ei ole meillä käytössä, joten tzdataa ei tarvita.';
const REPLY = 'Selvä: zoneinfo ilman tzdataa. Teen muutoksen `src/shadow.py`:hyn ja ajan testit.';
const assistant = (id: string) => CONVO.find((i) => i.id === id) as AssistantItem;
const quoteOf = (a: AssistantItem): Quote => ({target: a.id, key: a.key, time: a.time, text: a.text});

// ---------- The excerpt rules (what the daemon would build) ----------

const LIMIT = 280;
/** The block must not end early: the daemon removes the closing sequence. */
const guard = (s: string) => s.replace(/<\/reply-to/gi, '');
function wordCut(s: string, n: number) {
  if (s.length <= n) return s;
  const at = s.lastIndexOf(' ', n);
  return s.slice(0, at > n / 2 ? at : n).replace(/[\s,;:–-]+$/, '');
}
/** (a) Whitespace normalised, cut at a word to 280 characters. */
function excerptA(md: string) {
  const flat = guard(md).replace(/\s+/g, ' ').trim();
  return flat.length <= LIMIT ? flat : `${wordCut(flat, LIMIT - 2)} …`;
}
/** (b) Up to the first full stop, exclamation or question mark. */
function excerptB(md: string) {
  const flat = guard(md).replace(/\s+/g, ' ').trim();
  const m = flat.match(/^.*?[.!?](?=\s|$)/);
  const s = m ? m[0] : flat;
  if (s.length > LIMIT) return `${wordCut(s, LIMIT - 2)} …`;
  return s.length < flat.length ? `${s} …` : s;
}
/** (c) The message's own Markdown as whole lines up to about 280
 * characters; the last prose line is cut at a sentence (or a word), an open
 * code fence is closed, and a lone … line says that more follows. */
function excerptC(md: string) {
  const lines = guard(md).replace(/\n{3,}/g, '\n\n').trim().split('\n');
  const out: string[] = [];
  let len = 0, fence = false, cut = false;
  for (const line of lines) {
    const add = (out.length ? 1 : 0) + line.length;
    if (len + add > LIMIT) {
      const room = LIMIT - len - (out.length ? 1 : 0);
      if (!fence && room > 60) {
        const part = line.slice(0, room);
        const sentence = part.match(/^.*[.!?](?=\s)/);
        out.push(sentence && sentence[0].length > room / 2 ? sentence[0] : `${wordCut(part, room)} …`);
      }
      cut = true;
      break;
    }
    out.push(line);
    len += add;
    if (/^\s*```/.test(line)) fence = !fence;
  }
  while (out.length && !out[out.length - 1].trim()) out.pop();
  if (fence) out.push('```');
  if (cut && !out[out.length - 1].endsWith('…')) out.push('…');
  return out.join('\n');
}
const EXCERPT_FN: Record<Excerpt, (md: string) => string> = {a: excerptA, b: excerptB, c: excerptC};
const block = (key: string, excerpt: string) => `<reply-to entry="${key}">\n${excerpt}\n</reply-to>`;
/** The literal text Pi receives in the RPC prompt. */
const payload = (key: string, excerpt: string, text: string) => `${block(key, excerpt)}\n\n${text}`;

/** Markdown read as plain text: markers dropped, one paragraph. */
function plain(md: string) {
  return md.replace(/```[a-z]*\n?/g, '').replace(/\*\*|`/g, '').replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '').replace(/\s*\n+\s*/g, ' ').trim();
}

// ---------- Shared state for the review chrome ----------

const listeners = new Set<() => void>();
const review = {theme: 'light', excerpt: 'c' as Excerpt};
function useReview() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return review;
}
function setReview(patch: Partial<typeof review>) { Object.assign(review, patch); listeners.forEach((f) => f()); }

const noop = () => {};

function ReplyGlyph() {
  return (
    <svg className="rp-glyph" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

// ---------- 1. The corner control ----------

type Forced = 'hover' | 'focus' | undefined;
/** The reply control in the card's top-right `actions` slot. */
function ReplyControl({d, id, time, active, forced, onReply}: {d: number; id: string; time: string; active: boolean; forced?: Forced; onReply: () => void}) {
  const {probe, host} = useCardPart('.ah-message header');
  const label = `Vastaa tähän viestiin (klo ${time})`;
  const state = forced ? {'data-ah-state': forced} : {};
  const control = (
    <span className={`ah-message-actions rp-ctl rp-ctl-${'abc'[d]}`} data-active={active || undefined} data-forced={forced}>
      {d === C ? (
        <ControlButton data-testid={`reply-${id}`} aria-label={label} aria-pressed={active} variant="quiet" size="inline" onPress={onReply} {...state}>
          <ReplyGlyph /><span className="rp-ctl-label">Vastaa</span>
        </ControlButton>
      ) : (
        <ControlButton data-testid={`reply-${id}`} aria-label={label} aria-pressed={active} variant={d === B ? 'secondary' : 'quiet'} size={d === B ? 'inline' : 'row'} presentation="messageIcon" onPress={onReply} {...state}>
          <ReplyGlyph />
        </ControlButton>
      )}
    </span>
  );
  return <><span ref={probe} hidden />{host ? createPortal(control, host) : null}</>;
}

const STATES: {name: string; forced?: Forced; active?: boolean; touch?: boolean}[] = [
  {name: 'Levossa'},
  {name: 'Osoitin'},
  {name: 'Fokus', forced: 'focus'},
  {name: 'Vastataan', active: true},
  {name: 'Puhelin', touch: true},
  {name: 'Puhelin, vastataan', touch: true, active: true},
];

function ControlMatrix({current}: {current: number}) {
  return (
    <section className="rp-section" aria-labelledby="rp-s1" data-testid="section-control">
      <h2 id="rp-s1">1 Kulmapainike</h2>
      <p className="rp-lead">Sama viesti eri tiloissa Päivä- ja Yö-teemassa. <em>Osoitin</em> näyttää kortin osoittimen alla ja painikkeen sen omassa hover-tilassa; <em>Puhelin</em> käyttää kosketuksen sääntöjä puhelimen levyisessä sarakkeessa.</p>
      {(['light', 'dark'] as const).map((theme) => (
        <div key={theme} className="rp-themed" data-theme={theme} data-testid={`matrix-${theme}`}>
          <h3>{theme === 'light' ? 'Päivä' : 'Yö'}</h3>
          <div className="rp-matrix">
            {directions.map((dn, d) => (
              <div key={dn} className="rp-matrix-row" aria-current={d === current ? 'true' : undefined} data-direction={dn}>
                <h4>{CONTROL_LINES[d].split(':')[0]}</h4>
                <div className="rp-cells">
                  {STATES.map((s, k) => (
                    <figure key={k} className={`rp-cell${s.touch ? ' rp-touch' : ''}${s.name === 'Osoitin' ? ' rp-show' : ''}`} data-state={s.name}>
                      <figcaption>{s.name}</figcaption>
                      <div className="rp-msg" data-role="assistant">
                        <AssistantMessage streamState="complete" time="9.31" onCopy={noop}><Markdown text={SHORT} /></AssistantMessage>
                        <ReplyControl d={d} id={`m-${theme}-${d}-${k}`} time="9.31" active={!!s.active}
                          forced={s.name === 'Osoitin' ? 'hover' : s.forced} onReply={noop} />
                      </div>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="rp-recommend">{RECOMMEND.control}</p>
    </section>
  );
}

// ---------- 2. The quote inside the composer ----------

/** Excerpt lines as the composer shows them: code in mono, list markers kept. */
function ExcerptLines({text}: {text: string}) {
  const rows: ReactNode[] = [];
  let fence = false, code: string[] = [];
  text.split('\n').forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      if (fence) { rows.push(<code key={i} className="rp-q-code">{code.join('\n')}</code>); code = []; }
      fence = !fence;
      return;
    }
    if (fence) { code.push(line); return; }
    if (!line.trim()) return;
    rows.push(<span key={i} className="rp-q-line">{line.replace(/\*\*|`/g, '')}</span>);
  });
  if (code.length) rows.push(<code key="end" className="rp-q-code">{code.join('\n')}</code>);
  return <>{rows}</>;
}

function QuoteBody({d, q, excerpt}: {d: number; q: Quote; excerpt: Excerpt}) {
  if (d === A) return <span className="rp-q-body rp-q-plain">{plain(q.text)}</span>;
  if (d === B) return <span className="rp-q-body rp-q-md"><Markdown text={q.text} /></span>;
  const ex = EXCERPT_FN[excerpt](q.text);
  return <span className="rp-q-body rp-q-ex">{excerpt === 'c' ? <ExcerptLines text={ex} /> : <span className="rp-q-line">{plain(ex)}</span>}</span>;
}

/** The quote: the field box's first row, the sunken surface of round 2 B. */
function FieldQuote({d, q, excerpt, initiallyOpen = false, onJump, onRemove}: {d: number; q: Quote; excerpt: Excerpt; initiallyOpen?: boolean; onJump: (q: Quote) => void; onRemove: () => void}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [overflows, setOverflows] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = body.current?.querySelector<HTMLElement>('.rp-q-body');
    if (!el) return;
    const measure = () => setOverflows(open || el.scrollHeight > el.clientHeight + 1);
    measure();
    const o = new ResizeObserver(measure);
    o.observe(el);
    return () => o.disconnect();
  }, [open, q, excerpt, d]);
  const more = d === B ? 'Näytä koko viesti' : 'Näytä koko ote';
  return (
    <div className={`rp-q rp-q-${'abc'[d]}`} data-testid="composer-quote" data-open={open || undefined} data-overflow={overflows || undefined} role="group" aria-label={`Vastaat agentin viestiin klo ${q.time}`}>
      <div className="rp-q-head">
        <ReplyGlyph /><span>Vastaat agentin viestiin</span><time>{q.time}</time>
        <span className="rp-q-tools">
          <ControlButton data-testid="quote-remove" aria-label="Poista lainaus" variant="quiet" size="row" presentation="messageIcon" onPress={onRemove}>
            <Icon name="cross" />
          </ControlButton>
        </span>
      </div>
      <div ref={body}>
        <button type="button" className="rp-q-jump" data-testid="quote-jump" onClick={() => onJump(q)} aria-label={`Siirry agentin viestiin klo ${q.time}`}>
          <QuoteBody d={d} q={q} excerpt={excerpt} />
        </button>
      </div>
      {d !== A && overflows ? (
        <div className="rp-q-more">
          <ControlButton data-testid="quote-more" variant="quiet" size="inline" aria-expanded={open} onPress={() => setOpen((o) => !o)}>
            {open ? 'Näytä vähemmän' : more}
          </ControlButton>
        </div>
      ) : null}
    </div>
  );
}

/** Portals the quote into the composer box found under `scope`. */
function InField({scope, children}: {scope: React.RefObject<HTMLElement | null>; children: ReactNode}) {
  const [box, setBox] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let frame = 0, tries = 0;
    const find = () => {
      const el = scope.current?.querySelector<HTMLElement>('.ah-cbox') ?? null;
      if (el) setBox(el); else if (tries++ < 30) frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, [scope]);
  return box ? createPortal(children, box) : null;
}

function StaticComposer({d, q, open, excerpt}: {d: number; q: Quote; open?: boolean; excerpt: Excerpt}) {
  const scope = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(DRAFT);
  const [quote, setQuote] = useState<Quote | null>(q);
  return (
    <div ref={scope} className="rp-static-composer">
      <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer" onModeChange={noop}
        onSendNow={noop} onSteer={noop} onFollowUp={noop} csrf="prototype" idlePlaceholder="Kirjoita vastaus…"
        modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
      {quote ? <InField scope={scope}><FieldQuote d={d} q={quote} excerpt={excerpt} initiallyOpen={open} onJump={noop} onRemove={() => setQuote(null)} /></InField> : null}
    </div>
  );
}

function QuoteMatrix({current}: {current: number}) {
  const {excerpt} = useReview();
  const q = quoteOf(assistant('a3'));
  return (
    <section className="rp-section" aria-labelledby="rp-s2" data-testid="section-quote">
      <h2 id="rp-s2">2 Pitkän viestin lainaus kentässä</h2>
      <p className="rp-lead">Lainattuna klo 9.20 viesti: kaksi kappaletta, koodilohko ja lista. Kenttä kasvaa lainauksen verran; luonnos on kentässä lainauksen alla. Napautus lainauksen tekstiin vie alkuperäiseen kaikissa suunnissa. C:n ote seuraa osion 3 valintaa (nyt <strong>{excerpt}</strong>).</p>
      {directions.map((dn, d) => (
        <div key={`${dn}-${excerpt}`} className="rp-quote-row" aria-current={d === current ? 'true' : undefined} data-direction={dn}>
          <h4>{QUOTE_LINES[d].split(':')[0]}</h4>
          <div className="rp-quote-cells">
            <figure className="rp-cell rp-wide"><figcaption>Työpöytä</figcaption><StaticComposer d={d} q={q} excerpt={excerpt} /></figure>
            {d !== A ? <figure className="rp-cell rp-wide"><figcaption>Työpöytä, avattu</figcaption><StaticComposer d={d} q={q} open excerpt={excerpt} /></figure> : null}
            <figure className="rp-cell rp-touch rp-phone"><figcaption>Puhelin</figcaption><StaticComposer d={d} q={q} excerpt={excerpt} /></figure>
          </div>
        </div>
      ))}
      <p className="rp-recommend">{RECOMMEND.quote}</p>
    </section>
  );
}

// ---------- 3. Excerpt length ----------

function ExcerptQuote({q, ex, excerpt}: {q: Quote; ex: string; excerpt: Excerpt}) {
  return (
    <div className="rp-q rp-q-c rp-q-mini" aria-label={`Kentässä: lainaus klo ${q.time}`}>
      <div className="rp-q-head"><ReplyGlyph /><span>Vastaat agentin viestiin</span><time>{q.time}</time></div>
      <span className="rp-q-body rp-q-ex">{excerpt === 'c' ? <ExcerptLines text={ex} /> : <span className="rp-q-line">{plain(ex)}</span>}</span>
    </div>
  );
}

function ExcerptTable() {
  const {excerpt: chosen} = useReview();
  return (
    <section className="rp-section" aria-labelledby="rp-s3" data-testid="section-excerpt">
      <h2 id="rp-s3">3 Otteen pituus: mitä agentti saa</h2>
      <p className="rp-lead">Neljä viestiä ja kolme sääntöä. <em>Agentti saa</em> on lohko täsmälleen sellaisena kuin se lähtee Pi:lle ennen kirjoitettua vastausta ja jää natiiviin istuntoon; <em>Kentässä</em> on lainaus, jonka ihminen näkee (suunta C). Malli näkee alkuperäisen yleensä yhä kontekstissaan; ote ratkaisee silloin, kun alkuperäinen on tiivistetty pois, ja kun keskustelua luetaan myöhemmin terminaalista.</p>
      <fieldset className="rp-excerpt-pick">
        <legend>Ote elävässä keskustelussa ja suunnassa C</legend>
        {EXCERPTS.map((e) => (
          <label key={e}><input type="radio" name="rp-excerpt" value={e} checked={chosen === e} onChange={() => setReview({excerpt: e})} /> {e} {EXCERPT_NAMES[e]}</label>
        ))}
      </fieldset>
      <div className="rp-excerpts">
        <div className="rp-ex-head" aria-hidden="true">
          <span>Viesti</span>{EXCERPTS.map((e) => <span key={e} data-chosen={e === chosen || undefined}>{e} {EXCERPT_NAMES[e]}</span>)}
        </div>
        {SAMPLES.map((s) => {
          const q = quoteOf(s);
          return (
            <div key={s.id} className="rp-ex-row" data-testid={`excerpt-${s.id}`}>
              <div className="rp-ex-orig">
                <h4>{s.sample} · {s.text.length} merkkiä</h4>
                <div className="rp-ex-msg"><Markdown text={s.text} /></div>
              </div>
              {EXCERPTS.map((e) => {
                const ex = EXCERPT_FN[e](s.text);
                return (
                  <div key={e} className="rp-ex-cell" data-excerpt={e} data-chosen={e === chosen || undefined}>
                    <h4><span className="rp-ex-tag">{e} {EXCERPT_NAMES[e]}</span> · {ex.length} merkkiä</h4>
                    <span className="rp-ex-label">Agentti saa</span>
                    <pre data-testid={`agent-${s.id}-${e}`}>{block(s.key, ex)}</pre>
                    <span className="rp-ex-label">Kentässä</span>
                    <ExcerptQuote q={q} ex={ex} excerpt={e} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="rp-recommend">{RECOMMEND.excerpt}</p>
    </section>
  );
}

// ---------- The live conversation ----------

/** Scrolls `el` to the middle of its own scrolling ancestor only. */
function scrollWithin(el: HTMLElement, smooth: boolean) {
  let box = el.parentElement;
  while (box && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
  if (!box) return;
  const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - (box.clientHeight - Math.min(el.offsetHeight, box.clientHeight)) / 2;
  box.scrollTo({top, behavior: smooth ? 'smooth' : 'auto'});
}

function SentQuote({q, excerpt, onJump}: {q: Quote; excerpt: Excerpt; onJump: (q: Quote) => void}) {
  const ex = EXCERPT_FN[excerpt](q.text);
  return (
    <button type="button" className="rp-sent" data-testid="sent-quote" aria-label={`Siirry agentin viestiin klo ${q.time}`} onClick={() => onJump(q)}>
      <span className="rp-q-head"><ReplyGlyph /><span>Agentin viesti</span><time>{q.time}</time></span>
      <span className="rp-q-body rp-q-plain">{plain(ex)}</span>
    </button>
  );
}

function Live({d}: {d: number}) {
  const {excerpt} = useReview();
  const scope = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Item[]>(CONVO);
  const [quote, setQuote] = useState<Quote | null>(quoteOf(assistant('a3')));
  const [draft, setDraft] = useState(DRAFT);
  const [flash, setFlash] = useState<{id: string; n: number} | null>(null);
  const focusField = () => setTimeout(() => scope.current?.querySelector<HTMLTextAreaElement>('.ah-cbox-field')?.focus(), 30);
  const reply = (a: AssistantItem) => { setQuote(quoteOf(a)); focusField(); };
  const jump = (q: Quote) => {
    const el = scope.current?.querySelector<HTMLElement>(`[data-item="${q.target}"]`);
    if (!el) return;
    scrollWithin(el, !matchMedia('(prefers-reduced-motion: reduce)').matches);
    setFlash((f) => ({id: q.target, n: (f?.n ?? 0) + 1}));
  };
  const remove = () => { setQuote(null); focusField(); };
  useEffect(() => {
    let frame = 0, tries = 0;
    // Open at the latest message, as the product does; Markdown and code
    // settle over a few frames, so follow the end until they have.
    const toEnd = () => {
      let box = scope.current?.querySelector<HTMLElement>('[data-item="a4"]')?.parentElement ?? null;
      while (box && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      if (box) box.scrollTop = box.scrollHeight;
      if (tries++ < 20) frame = requestAnimationFrame(toEnd);
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
    setItems((s) => [...s, {id: `s${n}`, kind: 'user', time: '9.40', text: body, reply: quote ?? undefined, excerpt}]);
    setQuote(null);
    setDraft('');
    setTimeout(() => setItems((s) => [...s, {id: `r${n}`, kind: 'assistant', key: `e${n}7d0c1a`, time: '9.41', text: REPLY}]), 700);
  };
  const rows = items.map((i) => {
    let content: ReactNode;
    if (i.kind === 'tools') {
      content = <div className="rp-tools">{i.tools.map((t, k) => <ToolRow key={k} name={t.name} targetText={t.path} statusLabel="Valmis" state="succeeded" expanded={false} onToggle={noop} />)}</div>;
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
            {i.reply ? <SentQuote q={i.reply} excerpt={i.excerpt ?? excerpt} onJump={jump} /> : null}
            <Markdown text={i.text} />
          </UserMessage>
        </div>
      );
    }
    const flashing = flash?.id === i.id;
    return {id: i.id, kind: i.kind, content: <div data-item={i.id} key={flashing ? `${i.id}-${flash!.n}` : i.id} data-flash={flashing || undefined}>{content}</div>};
  });
  const lastSent = [...items].reverse().find((i): i is Extract<Item, {kind: 'user'}> => i.kind === 'user' && !!i.reply);
  const shown = quote ?? lastSent?.reply ?? null;
  const text = quote ? (draft.trim() || '…') : lastSent?.text ?? '';
  return (
    <div className="rp-live-grid">
      <div className="rp-live" ref={scope} data-testid="conversation">
        <ConversationFrame>
          <AgentHeader title="Kesäajan virhe" workspaceLabel="aurinkokello" workspaceHref="/workspaces/ws_a"
            activityLabel="" controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          <ConversationStream>
            <ConversationTimeline state="ready" items={rows} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer" onModeChange={noop}
            onSendNow={send} onSteer={send} onFollowUp={send} csrf="prototype"
            idlePlaceholder={quote ? 'Kirjoita vastaus…' : undefined}
            modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
          {quote ? <InField scope={scope}><FieldQuote key={`${quote.target}-${d}-${excerpt}`} d={d} q={quote} excerpt={excerpt} onJump={jump} onRemove={remove} /></InField> : null}
        </ConversationFrame>
      </div>
      <aside className="rp-side" data-testid="agent-receives" aria-label="Mitä agentti saa">
        <h2>Mitä agentti saa {quote ? 'tästä vastauksesta' : 'viimeisestä vastauksesta'}</h2>
        {shown ? EXCERPTS.map((e) => (
          <figure key={e} data-excerpt={e} data-chosen={e === (quote ? excerpt : lastSent?.excerpt ?? excerpt) || undefined}>
            <figcaption>{e} {EXCERPT_NAMES[e]}{e === (quote ? excerpt : lastSent?.excerpt ?? excerpt) ? ' · käytössä' : ''}</figcaption>
            <pre data-testid={`side-${e}`}>{payload(shown.key, EXCERPT_FN[e](shown.text), text)}</pre>
          </figure>
        )) : <p className="rp-lead">Paina viestin ↩-painiketta.</p>}
      </aside>
    </div>
  );
}

// ---------- The page ----------

function Lines({title, lines, current, rec, id}: {title: string; lines: string[]; current?: number; rec: string; id: string}) {
  return (
    <div className="rp-study" data-testid={`lines-${id}`}>
      <h2>{title}</h2>
      <ol className="rp-lines">{lines.map((l, i) => <li key={i} aria-current={i === current ? 'true' : undefined}>{l}</li>)}</ol>
      <p className="rp-recommend">{rec}</p>
    </div>
  );
}

function App({direction}: {direction: number}) {
  const {theme, excerpt} = useReview();
  const [generation, setGeneration] = useState(0);
  const [all, setAll] = useState(false);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--rp-bar-h', `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return (
    <div className={`rp-review variant-${direction}`} data-direction={direction}>
      <header className="rp-bar" ref={bar} data-all={all || undefined}>
        <div className="rp-controls">
          <strong>Vastaa agentin viestiin · kierros 3</strong>
          <label>Teema <select id="theme" value={theme} onChange={(e) => setReview({theme: e.target.value})}>
            <option value="light">Päivä</option><option value="dark">Yö</option><option value="contrast">Korkea kontrasti</option></select></label>
          <button type="button" data-testid="rp-reset" onClick={() => setGeneration((g) => g + 1)}>Alusta</button>
          <span className="rp-hint">Valitsin (alhaalla) vaihtaa keskustelun painikkeen ja lainauksen suuntaa; osiot alla vertaavat kaikkia.</span>
        </div>
        <div className="rp-all">
          <button type="button" className="rp-all-toggle" data-testid="rp-all" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? 'Näytä vain valitut' : 'Näytä kaikki suunnat ja suositukset'}</button>
          <div className="rp-studies" data-testid="direction-lines">
            <Lines id="control" title="1 Kulmapainike" lines={CONTROL_LINES} current={direction} rec={RECOMMEND.control} />
            <Lines id="quote" title="2 Pitkä lainaus kentässä" lines={QUOTE_LINES} current={direction} rec={RECOMMEND.quote} />
            <Lines id="excerpt" title="3 Otteen pituus" lines={EXCERPT_LINES} current={EXCERPTS.indexOf(excerpt)} rec={RECOMMEND.excerpt} />
          </div>
        </div>
      </header>
      <StatusBellProvider items={[]}>
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_a?conversation=pi:orig']}>
          <Live key={`${generation}-${direction}`} d={direction} />
          <ControlMatrix current={direction} />
          <QuoteMatrix current={direction} />
          <ExcerptTable />
        </MemoryRouter>
      </StatusBellProvider>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => <App key="app" direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = `${n} ${['Kopioin pari', 'Rajattu', 'Sävytetty'][i]}`.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// A Habitat view is an opaque-origin sandbox: the picker's URL bookkeeping
// (?v=) is kept in memory, so nothing in the view rewrites its address.
let memorySearch = '';
const memoryLocation = {get search() { return memorySearch; }, toString: () => `about:blank${memorySearch}`};
const memoryHistory = {replaceState: (_s: unknown, _t: string, url: URL) => { memorySearch = url.search; }};
new Function('stage', 'variants', 'location', 'history', pickerSource)(stageSink, variants, memoryLocation, memoryHistory);
