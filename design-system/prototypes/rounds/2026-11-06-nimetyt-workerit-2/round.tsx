import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {BackgroundStrip} from '../../../../web/src/components/BackgroundStrip';
import {ProcessProvider, useProcessView} from '../../../../web/src/components/ProcessTray';
import {SpinoffContext, WorkerBrief, WorkerView} from '../../../../web/src/components/Spinoffs';
import {PiBoundary} from '../../../../web/src/components/PiBlocks';
import type {Spinoff, WorkerTranscript} from '../../../../web/src/app/spinoffs';
import type {TimelineItem} from '../../../../web/src/components/types';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {statusText} from '../../../../web/src/text/status';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const rail = liveText(statusText).rail;

// proto-named-workers, round 2. Jari 6.11.: round 1 went the wrong way. A
// named worker (here "avustaja") belongs in the existing Workers pill by the
// composer, or as a second pill beside it; no panel above the composer, no
// rail rows, no worker replies in the main conversation, and no field that
// writes to a worker: the main agent relays (design-named-workers). Taskfleet
// owns the worker; each round lands on main, and main is rebased into the
// worker before each message. The axis is where the named workers sit
// relative to the production Workers pill: 1 inside it, with their own marks
// and a group of their own in its panel; 2 a chip per named worker beside it;
// 3 one Avustajat chip beside it that opens their list. The production
// BackgroundStrip is drawn unchanged; the round adds its pieces into the
// strip's own row and panel. Opening a named worker shows production's
// WorkerView, which is read only and says "kysy pääagentin kautta".
const directions = ['1 Pallossa', '2 Sirut', '3 Avustajat'];
const LINES = [
  '1 Pallossa: avustajat ovat Workerit-pallossa omina merkkeinään, ja pallon paneelissa niillä on oma ryhmä kertaworkerien yllä.',
  '2 Sirut: jokainen avustaja on oma sirunsa pallon vieressä nimellä ja tilamerkillä; siru avaa kortin, jossa ovat kierrokset.',
  '3 Avustajat: yksi Avustajat-siru pallon vieressä kertoo kaikkien tilan merkein ja avaa niiden listan.',
];
const ONE = 0, CHIPS = 1, GROUP = 2;

const PARENT = 'Rupeama 6.11.';

// ---- The named workers: state, rounds and the exchange the worker view reads ----
// relaying: the main agent is passing a message on (main is rebased into the
// worker first); working: a round is under way; waiting: its round report is
// in and it waits for the next message (fresh until the person looks);
// stopping/stopped: the person ended it, its worktree and branch go away.
type Phase = 'relaying' | 'working' | 'waiting' | 'stopping' | 'stopped';
type WMsg = {id: string; from: 'parent' | 'worker' | 'mark'; text: string; time: string};
type RoundFact = {n: number; line: string; commit?: string; time: string};
type Named = {
  id: string; name: string; task: string; phase: Phase; fresh: boolean;
  rounds: RoundFact[]; asked?: {text: string; time: string}; log: WMsg[]; harness: 'claude' | 'pi'; profile: string;
};
type PEvent = {id: string; kind: 'user' | 'agent'; text: string; time: string};

const BRIEF1 = 'Tee issueen `proto-m365-setup-flow` kierros 1: kolme suuntaa M365-asetuksen ohjaukseen. Raportoi kierroksen lopuksi ja jää odottamaan.';
const REPORT1 = '**Kierros 1 valmis**: A Lista, B Opastettu, C Tarkistuslista. Suosittelen A:ta. 18 kuvaa, kierros `rounds/2026-11-06-m365-asetus`.';
const MSG2 = 'Jari valitsi A Listan. Tee kolme riffiä: ainoa linkki ensimmäisessä vaiheessa, rekisteröinnin jälkeen ei linkkejä, järjestys Entran oma.';
const REPORT2 = '**Kierros 2 valmis**: kolme riffiä A Listasta.\n\n- **A1 Valikkopala**: jokaisen vaiheen vieressä pala Entran sivua.\n- **A2 Valikon järjestyksessä**: yksi tarkistuslista.\n- **A3 Olet nyt**: vaihe alkaa Entran sivun otsikosta.\n\nSuositus **A1**. Valikkopalat ovat piirroksia.';
const MSG3 = 'Jari valitsi A1:n. Riffaa A1:tä oikeilla kuvakaappauksilla testitenantin Entrasta; peitä tenantin nimi ja tunnisteet. Muuten kuten kierroksessa 2.';
const REPORT3 = '**Kierros 3 valmis**: A1 oikeilla kuvakaappauksilla.\n\n- Valikkopalat ovat nyt rajattuja kuvakaappauksia testitenantin Entrasta, korostus kuvan päällä.\n- Tenantin nimi ja tunnisteet on peitetty.\n\n12 uutta kuvaa. Kysymys: peitetäänkö myös sovelluksen nimi *Open Habitat (testi)*?';
const REVIEW_BRIEF = 'Katselmoi haara `wt/sharepoint-site-id` (`/llm-review`). Raportoi löydökset ja jää odottamaan: tarkistat korjaukset myöhemmin.';
const REVIEW1 = '**Kierros 1 valmis**: kaksi löydöstä. Sivuston tunniste luetaan ennen kuin oikeudet on tarkistettu, ja ohitettujen sivustojen lista katoaa uudelleenkäynnistyksessä.';

const host = {
  direction: 0, clock: 0, events: [] as PEvent[], named: [] as Named[], timers: [] as number[],
  parentWorking: false, view: null as string | null,
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
let seq = 0;
const nid = () => `e${++seq}`;
const TIMES = ['10.31', '10.32', '10.48', '10.49', '10.52', '10.53'];
const tick = () => TIMES[Math.min(host.clock++, TIMES.length - 1)];

function resetHost(direction = host.direction) {
  host.timers.forEach((t) => clearTimeout(t));
  host.timers = []; host.direction = direction; host.clock = 0; host.parentWorking = false; host.view = null;
  host.named = [
    {id: 'proto', name: 'Prototyyppari', task: 'M365-asetus', phase: 'waiting', fresh: false, harness: 'claude', profile: 'prototype-opus',
      rounds: [
        {n: 1, line: 'A Lista, B Opastettu, C Tarkistuslista; suosittelee A:ta.', commit: '9f2c41e', time: '8.40'},
        {n: 2, line: 'Kolme riffiä A Listasta; suosittelee A1:tä.', commit: '2b511e1', time: '9.41'},
      ],
      asked: {text: MSG2, time: '9.13'},
      log: [
        {id: 'l1', from: 'parent', text: BRIEF1, time: '8.21'},
        {id: 'l2', from: 'worker', text: REPORT1, time: '8.40'},
        {id: 'l3', from: 'mark', text: 'Kierros 1 yhdistetty main-haaraan · 9f2c41e', time: '8.40'},
        {id: 'l4', from: 'mark', text: 'main päivitetty haaraan ennen viestiä · 4 uutta committia', time: '9.13'},
        {id: 'l5', from: 'parent', text: MSG2, time: '9.13'},
        {id: 'l6', from: 'worker', text: REPORT2, time: '9.41'},
        {id: 'l7', from: 'mark', text: 'Kierros 2 yhdistetty main-haaraan · 2b511e1', time: '9.41'},
      ]},
    {id: 'review', name: 'Katselmoija', task: 'SharePoint-korjaus', phase: 'waiting', fresh: false, harness: 'pi', profile: 'capable-openai',
      rounds: [{n: 1, line: 'Kaksi löydöstä; ei muutoksia haaraan.', time: '9.05'}],
      asked: {text: REVIEW_BRIEF, time: '8.52'},
      log: [
        {id: 'r1', from: 'parent', text: REVIEW_BRIEF, time: '8.52'},
        {id: 'r2', from: 'worker', text: REVIEW1, time: '9.05'},
      ]},
  ];
  host.events = [
    {id: 'p1', kind: 'user', time: '9.12', text: 'Valitsen A Listan. Pyydä prototypparilta kolme riffiä siitä, havaintojeni mukaan.'},
    {id: 'p2', kind: 'agent', time: '9.13', text: 'Välitin pyynnön **Prototyypparille**. Se jatkaa kierroksesta 1, saa ensin mainin uusimmat muutokset ja raportoi, kun kierros 2 on valmis.'},
    {id: 'p3', kind: 'agent', time: '9.42', text: 'Prototyyppari toimitti kierroksen 2, ja se on yhdistetty main-haaraan: **A1 Valikkopala**, **A2 Valikon järjestyksessä** ja **A3 Olet nyt**. Se suosittelee A1:tä ja huomauttaa, että valikkopalat ovat vielä piirroksia.\n\nKatselmoija odottaa SharePoint-korjausta; pyydän sitä tarkistamaan, kun korjaus on haarassa.'},
  ];
}
resetHost(0);
function useHost() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const later = (ms: number, f: () => void) => { host.timers.push(window.setTimeout(() => { f(); notify(); }, ms)); };
const RELAY_MS = 1400, WORK_MS = 2600, STOP_MS = 1200, LEAVE_MS = 1500;
const named = (id: string) => host.named.find((n) => n.id === id)!;

/** The person writes to the main agent; it relays to the prototyper. */
function sendParent(text: string) {
  const w = named('proto');
  if (!text.trim() || !w || w.phase !== 'waiting') return;
  const time = tick();
  host.events.push({id: nid(), kind: 'user', time, text});
  host.parentWorking = true;
  w.phase = 'relaying'; w.fresh = false;
  w.log.push({id: nid(), from: 'mark', text: 'main päivitetty haaraan ennen viestiä · 3 uutta committia', time});
  notify();
  later(RELAY_MS, () => {
    host.parentWorking = false;
    host.events.push({id: nid(), kind: 'agent', time, text: `Välitin Prototyypparille:\n\n> ${MSG3}\n\nSe jatkaa kierroksesta 2. Kerron, kun kierros 3 on valmis.`});
    w.asked = {text: MSG3, time}; w.phase = 'working';
    w.log.push({id: nid(), from: 'parent', text: MSG3, time});
    later(WORK_MS, () => {
      const t = tick();
      w.phase = 'waiting'; w.fresh = true;
      w.rounds.push({n: 3, line: 'A1 oikeilla kuvakaappauksilla; kysyy, peitetäänkö sovelluksen nimi.', commit: '7c3e90d', time: t});
      w.log.push({id: nid(), from: 'worker', text: REPORT3, time: t});
      w.log.push({id: nid(), from: 'mark', text: 'Kierros 3 yhdistetty main-haaraan · 7c3e90d', time: t});
      host.parentWorking = true;
      later(700, () => {
        host.parentWorking = false;
        host.events.push({id: nid(), kind: 'agent', time: tick(), text: 'Prototyyppari toimitti kierroksen 3, ja se on yhdistetty main-haaraan: A1 käyttää nyt rajattuja kuvakaappauksia testitenantin Entrasta, tunnisteet peitettyinä.\n\nSe kysyy sinulta: **peitetäänkö myös sovelluksen nimi *Open Habitat (testi)*?** Prototyyppari odottaa vastaustasi.'});
      });
    });
  });
}

/** Stop: every round is already on main, so only the worktree and branch go. */
function stopNamed(id: string) {
  const w = named(id);
  if (!w || w.phase !== 'waiting') return;
  w.phase = 'stopping'; w.fresh = false;
  notify();
  later(STOP_MS, () => {
    w.phase = 'stopped';
    later(LEAVE_MS, () => { host.named = host.named.filter((n) => n.id !== id); });
  });
}
function openNamed(id: string) {
  const w = named(id);
  if (!w) return;
  w.fresh = false; host.view = id;
  notify();
}

// ---- Words and marks, one place for every riff ----
function word(w: Named): {text: string; tone: 'wait' | 'busy' | 'ok' | 'muted'} {
  const last = w.rounds.at(-1);
  if (w.phase === 'relaying') return {text: 'Pääagentti välittää viestiä', tone: 'busy'};
  if (w.phase === 'working') return {text: `Kierros ${(last?.n ?? 0) + 1} työn alla`, tone: 'busy'};
  if (w.phase === 'stopping') return {text: 'Lopetetaan…', tone: 'busy'};
  if (w.phase === 'stopped') return {text: 'Lopetettu · kaikki kierrokset mainissa', tone: 'ok'};
  return {text: w.fresh ? `Kierros ${last?.n} raportoitu` : 'Odottaa pääagenttia', tone: w.fresh ? 'wait' : 'muted'};
}
/** After the state word: what it last reported, or what it was last sent. */
function detail(w: Named) {
  const last = w.rounds.at(-1);
  if (w.phase === 'relaying') return 'main päivitetään haaraan';
  if (w.phase === 'working' && w.asked) return `sai ${w.asked.time}: ${w.asked.text}`;
  if (w.phase === 'stopped') return 'worktree ja haara poistettu';
  if (w.phase === 'stopping') return '';
  return last ? `${last.n}. kierros: ${last.line}` : '';
}
function NamedMark({w, small = false}: {w: Named; small?: boolean}) {
  const cls = small ? ' nw-small' : '';
  if (w.phase === 'stopped') return <Icon name="check" className={`ah-bg-gone nw-check${cls}`} />;
  if (w.phase === 'relaying' || w.phase === 'stopping') return <span className={`ah-bg-ring${cls}`} />;
  if (w.phase === 'working') return <span className={`ah-bg-dot run${cls}`} />;
  return <span className={`ah-bg-ring still${w.fresh ? ' nw-fresh' : ''}${cls}`} />;
}
const summary = (list: Named[]) => list.map((w) => `${w.name}: ${word(w).text.toLowerCase()}`).join(', ');

/** Stop, refused with its reason while the worker or the main agent has it. */
function StopNamed({w}: {w: Named}) {
  if (w.phase === 'stopped') return <span className="ah-bg-gap" aria-hidden="true" />;
  const why = w.phase === 'working' ? `${w.name} työskentelee. Lopeta, kun se on raportoinut.`
    : w.phase === 'relaying' ? 'Pääagentti välittää sille viestiä.' : w.phase === 'stopping' ? 'Lopetetaan.' : undefined;
  return (
    <ControlButton data-testid={`stop-${w.id}`} className="ah-bg-tell nw-stop" size="inline" variant="quiet"
      aria-label={`Lopeta ${w.name}`} title={why ?? 'Kierrokset ovat jo main-haarassa. Lopetus poistaa avustajan worktreen ja haaran.'}
      isDisabled={!!why} onPress={() => stopNamed(w.id)}>
      <Icon name="stop" /><span className="ah-bg-wide">Lopeta</span>
    </ControlButton>
  );
}

/** One named worker as a production worker row: two lines and a trailing control. */
function NamedRow({w}: {w: Named}) {
  const s = word(w);
  const d = detail(w);
  const last = w.rounds.at(-1);
  return (
    <div className="ah-bg-row nw-row" data-kind="spin" data-testid={`named-${w.id}`} data-phase={w.phase} data-fresh={w.fresh || undefined}
      data-leaving={w.phase === 'stopped' || undefined}>
      <button type="button" className="ah-bg-main" data-testid={`named-open-${w.id}`} onClick={() => openNamed(w.id)} title="Avaa avustajan keskustelu">
        <span className="ah-bg-mark" aria-hidden="true"><NamedMark w={w} /></span>
        <span className="ah-bg-lines">
          <span className="ah-bg-line">
            <span className="ah-bg-name">{w.name}<span className="nw-task"> · {w.task}</span></span>
            {last ? <span className="ah-bg-meta">{last.n} {last.n === 1 ? 'kierros' : 'kierrosta'}</span> : null}
          </span>
          <span className="ah-bg-sub">
            <span className="ah-bg-word" data-tone={s.tone}>{s.text}</span>
            {d ? <><span className="ah-bg-sep" aria-hidden="true">·</span><span className="nw-detail">{d}</span></> : null}
          </span>
        </span>
      </button>
      <StopNamed w={w} />
    </div>
  );
}

// ---- The strip's own nodes, found after each production render ----
function useStripNodes() {
  const [nodes, setNodes] = useState<{pill?: Element; badges?: Element; wrap?: Element; body?: Element}>({});
  useLayoutEffect(() => {
    const find = () => {
      const strip = document.querySelector('[data-testid="background-work"]');
      const next = {
        pill: strip?.querySelector('[data-testid="background-spinoffs"]') ?? undefined,
        badges: strip?.querySelector('[data-testid="background-badges"]') ?? undefined,
        wrap: strip?.querySelector('.ah-bg-wrap') ?? undefined,
        body: strip?.querySelector('.ah-bg-pop-body') ?? undefined,
      };
      setNodes((old) => (old.pill === next.pill && old.badges === next.badges && old.wrap === next.wrap && old.body === next.body ? old : next));
    };
    find();
    const o = new MutationObserver(find);
    o.observe(document.getElementById('root')!, {childList: true, subtree: true});
    return () => o.disconnect();
  }, []);
  return nodes;
}
/** A container the round owns inside a production node: first or last child. */
function useSlot(parent: Element | undefined, where: 'first' | 'last', className: string) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!parent) { setSlot(null); return; }
    const el = document.createElement(parent.tagName === 'BUTTON' ? 'span' : 'div');
    el.className = className;
    if (where === 'first') parent.prepend(el); else parent.append(el);
    setSlot(el);
    return () => { el.remove(); };
  }, [parent, where, className]);
  return slot;
}

// ---- 1: inside the production pill and its panel ----
function InsidePill() {
  const h = useHost();
  const nodes = useStripNodes();
  const marks = useSlot(nodes.pill, 'last', 'nw-pill-marks');
  const group = useSlot(nodes.body, 'first', 'nw-panel-group');
  useEffect(() => {
    // The pill's name says the named workers too.
    const pill = nodes.pill as HTMLElement | undefined;
    if (!pill || !h.named.length) return;
    const base = pill.getAttribute('aria-label')?.split(' · Avustajat: ')[0] ?? '';
    const label = `${base} · Avustajat: ${summary(h.named)}`;
    pill.setAttribute('aria-label', label); pill.setAttribute('title', label);
  });
  return (
    <>
      {marks && h.named.length ? createPortal(
        <span className="ah-bg-marks nw-marks" data-testid="pill-named-marks" aria-hidden="true">
          <span className="nw-divider" />
          {h.named.map((w) => <NamedMark key={w.id} w={w} />)}
        </span>, marks) : null}
      {group && h.named.length ? createPortal(
        // biome-ignore lint/a11y/useSemanticElements: A labelled group of rows, as production's.
        <div className="ah-bg-group nw-group" role="group" aria-label="Avustajat" data-testid="named-group">
          <p className="nw-group-head"><Icon name="agent" />Avustajat<span className="ah-bg-tab-n">{h.named.length}</span>
            <span className="nw-group-note">jäävät odottamaan; viestit pääagentin kautta</span></p>
          {h.named.map((w) => <NamedRow key={w.id} w={w} />)}
          <p className="nw-group-head nw-group-head2"><Icon name="branch" />Kertaworkerit</p>
        </div>, group) : null}
    </>
  );
}

/** A floating card in the production panel's place, closed by Escape or its cross. */
function Pop({label, onClose, children, testId}: {label: string; onClose: () => void; children: React.ReactNode; testId: string}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="ah-bg-pop nw-pop" role="dialog" aria-label={label} data-testid={testId}>
      <div>
        <div className="ah-bg-tabs nw-pop-head">
          <span className="ah-bg-tab nw-pop-title" data-selected="">{label}</span>
          <ControlButton data-testid="nw-close" className="ah-bg-x" size="inline" variant="quiet" aria-label="Sulje" onPress={onClose}><Icon name="cross" /></ControlButton>
        </div>
        <div className="ah-bg-pop-body">{children}</div>
      </div>
    </div>
  );
}

/** Opens one popover at a time with production's panel. */
function useOwnPop() {
  const view = useProcessView();
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (view?.panel) setOpen(null); }, [view?.panel]);
  const toggle = (k: string) => { view?.setPanel(null); setOpen((o) => (o === k ? null : k)); };
  return {open, toggle, close: () => setOpen(null)};
}

// ---- 2: a chip per named worker beside the pill ----
function ChipPerWorker() {
  const h = useHost();
  const nodes = useStripNodes();
  const chips = useSlot(nodes.badges, 'last', 'nw-chips');
  const pop = useSlot(nodes.wrap, 'first', 'nw-pop-slot');
  const {open, toggle, close} = useOwnPop();
  const w = open ? h.named.find((n) => n.id === open) : undefined;
  useEffect(() => { if (open && !w) close(); });
  return (
    <>
      {chips ? createPortal(h.named.map((n) => (
        <ControlButton key={n.id} data-testid={`chip-${n.id}`} size="inline" presentation="pill" className={`ah-bg-badge nw-chip${n.phase === 'waiting' && !n.fresh ? ' idle' : ''}`}
          data-phase={n.phase} data-fresh={n.fresh || undefined} aria-expanded={open === n.id} aria-label={`${n.name}: ${word(n).text}`} title={`${n.name} · ${n.task}: ${word(n).text}`}
          onPress={() => toggle(n.id)}>
          <NamedMark w={n} small /><span className="nw-chip-name">{n.name}</span>
          {n.fresh ? <span className="nw-chip-news">kierros {n.rounds.at(-1)?.n}</span> : null}
        </ControlButton>
      )), chips) : null}
      {pop && w ? createPortal(<Pop label={`${w.name} · ${w.task}`} onClose={close} testId="named-card"><NamedCard w={w} /></Pop>, pop) : null}
    </>
  );
}
/** 2: the card a chip opens: state, the rounds and what it was last sent. */
function NamedCard({w}: {w: Named}) {
  const s = word(w);
  const live = w.phase === 'working' || w.phase === 'relaying';
  return (
    <div className="nw-card" data-phase={w.phase}>
      <p className="nw-card-state"><span className="ah-bg-mark" aria-hidden="true"><NamedMark w={w} /></span>
        <span className="ah-bg-word" data-tone={s.tone}>{s.text}</span>
        <span className="nw-card-agent">{w.harness === 'claude' ? 'Claude' : 'Pi'} · {w.profile}</span></p>
      <ol className="nw-rounds" aria-label="Kierrokset">
        {w.rounds.map((r) => (
          <li key={r.n}><span className="nw-round-n">{r.n}</span><span className="nw-round-line">{r.line}</span>
            <span className="nw-round-land">{r.commit ? <><Icon name="merge" />mainissa <code>{r.commit}</code></> : 'ei muutoksia'}</span></li>
        ))}
        {live ? <li className="nw-round-live"><span className="nw-round-n">{(w.rounds.at(-1)?.n ?? 0) + 1}</span><span className="nw-round-line">{s.text}</span><span className="nw-round-land">{detail(w).startsWith('sai') ? '' : detail(w)}</span></li> : null}
      </ol>
      {w.asked ? <p className="nw-asked"><span className="nw-asked-who">Pääagentti {w.asked.time}</span><q>{w.asked.text}</q></p> : null}
      <div className="nw-card-actions">
        <ControlButton data-testid={`named-open-${w.id}`} size="row" variant="secondary" onPress={() => openNamed(w.id)}><Icon name="message" />Näytä keskustelu</ControlButton>
        <StopNamed w={w} />
      </div>
      <p className="nw-card-note">Avustajalle kirjoitetaan pääagentin kautta.</p>
    </div>
  );
}

// ---- 3: one Avustajat chip beside the pill ----
function GroupChip() {
  const h = useHost();
  const nodes = useStripNodes();
  const chips = useSlot(nodes.badges, 'last', 'nw-chips');
  const pop = useSlot(nodes.wrap, 'first', 'nw-pop-slot');
  const {open, toggle, close} = useOwnPop();
  const quiet = h.named.every((n) => n.phase === 'waiting' && !n.fresh);
  useEffect(() => { if (open && !h.named.length) close(); });
  return (
    <>
      {chips && h.named.length ? createPortal(
        <ControlButton data-testid="chip-group" size="inline" presentation="pill" className={`ah-bg-badge nw-chip${quiet ? ' idle' : ''}`}
          aria-expanded={open === 'all'} aria-label={`Avustajat: ${summary(h.named)}`} title={`Avustajat: ${summary(h.named)}`} onPress={() => toggle('all')}>
          <Icon name="agent" className="ah-bg-kind-ic" /><span className="nw-chip-name">Avustajat</span>
          <span className="ah-bg-marks" aria-hidden="true">{h.named.map((w) => <NamedMark key={w.id} w={w} small />)}</span>
        </ControlButton>, chips) : null}
      {pop && open === 'all' && h.named.length ? createPortal(
        <Pop label={`Avustajat · ${h.named.length}`} onClose={close} testId="named-list">
          {/* biome-ignore lint/a11y/useSemanticElements: A labelled group of rows, as production's. */}
          <div className="ah-bg-group" role="group" aria-label="Avustajat">{h.named.map((w) => <NamedRow key={w.id} w={w} />)}</div>
          <p className="ah-bg-notice nw-list-note">Avustajat jäävät odottamaan kierroksen jälkeen. Viestit kulkevat pääagentin kautta; jokainen kierros yhdistetään main-haaraan.</p>
        </Pop>, pop) : null}
    </>
  );
}

// ---- Host stand-ins for the production strip: one one-shot worker, no processes ----
const PARENT_ID = 'pi:0b5c6a62-6f2e-4f43-9d55-3f6c1b7e2a10';
const ONE_SHOT: Spinoff = {
  run_id: '01m6r1q934veb852ke10x2r3aa', title: 'sharepoint-skipped-sites-recover', created_at: new Date(Date.now() - 7 * 60000).toISOString(), state: 'working',
  preserved: false, branch: 'wt/sharepoint-skipped-sites', worktree: '/home/maintainer/src/open-habitat__worktrees/wt-sharepoint-skipped-sites',
  source_branch: 'main', summary: '', harness: 'pi', profile: 'nopea',
};
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path.endsWith('/processes'))
    return json({schema_version: 1, owner_generation: 'og_proto', availability: 'available', unavailable_reason: null, processes: [], interrupted: []});
  return new Response('', {status: 404});
};

const noop = () => {};
const T0 = Date.UTC(2026, 10, 6, 9, 42);
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'open-habitat',
};
const picker = <button type="button" className="md-pill">Claude Opus 5.5 · high</button>;

type Item = TimelineItem & {kind: 'user' | 'assistant' | 'marker'};
const userItem = (id: string, text: string, time: string): Item => ({id, kind: 'user', content: <UserMessage sourceText={text} onCopy={noop} time={time}><Markdown text={text} /></UserMessage>});
const agentItem = (id: string, text: string, time: string, state: 'complete' | 'streaming' = 'complete'): Item =>
  ({id, kind: 'assistant', content: <AssistantMessage streamState={state} time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>});

/** The named worker's own conversation, as production's worker view reads it. */
function namedItems(w: Named): Item[] {
  return w.log.map((m) => m.from === 'parent'
    ? {id: m.id, kind: 'user', content: <WorkerBrief text={m.text} />}
    : m.from === 'mark'
      ? {id: m.id, kind: 'marker', content: <PiBoundary>{m.text} · {m.time}</PiBoundary>}
      : {id: m.id, kind: 'assistant', content: <AssistantMessage streamState="complete" time={m.time} onCopy={noop}><Markdown text={m.text} /></AssistantMessage>});
}
const namedRun = (w: Named): Spinoff => ({
  run_id: `01m6rnamed${w.id}0000000000`.slice(0, 26), title: `${w.name} · ${w.task}`, created_at: new Date(T0 - 80 * 60000).toISOString(),
  state: w.phase === 'working' || w.phase === 'relaying' ? 'working' : 'waiting_parent', preserved: false,
  branch: `wt/${w.id}-named`, worktree: `/home/maintainer/src/open-habitat__worktrees/wt-${w.id}-named`, source_branch: 'main', summary: '', harness: w.harness, profile: w.profile,
});

let reviewTheme = 'light';

function Main({direction}: {direction: number}) {
  const h = useHost();
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLElement>(null);
  useLayoutEffect(() => { const el = stream.current; if (el) el.scrollTop = el.scrollHeight; });
  const proto = h.named.find((n) => n.id === 'proto');
  const protoBusy = proto?.phase === 'working';

  // ---- Rail: only conversations; named workers are never rail rows ----
  const now = Date.now();
  const parentModel: AgentNavModel = {
    agentId: 'rupeama', href: '/workspaces/ws_o?conversation=rupeama', title: PARENT, workspaceId: 'ws_o', workspaceName: 'open-habitat',
    changedAt: T0, activity: h.parentWorking ? 'working' : 'waiting', activityLabel: h.parentWorking ? rail.working : 'Odottaa viestiä', controlLabel: '',
    detail: ['open-habitat', h.parentWorking ? rail.working : 'Odottaa viestiä'].join(' · '), selected: true, spinoffWorking: true,
  };
  const quiet: AgentNavModel[] = [
    {agentId: 'q1', href: '/workspaces/ws_o?conversation=q1', title: 'SharePoint-sivuston tunniste', workspaceId: 'ws_o', workspaceName: 'open-habitat', changedAt: T0 - 50 * 60000, activity: 'waiting', activityLabel: 'Odottaa viestiä', controlLabel: '', detail: 'open-habitat · Odottaa viestiä'},
    {agentId: 'q2', href: '/workspaces/ws_h?conversation=q2', title: 'Fleet-päivitys', workspaceId: 'ws_h', workspaceName: 'fleetrepo', changedAt: T0 - 140 * 60000, activity: 'waiting', activityLabel: 'Odottaa viestiä', controlLabel: '', detail: 'fleetrepo · Odottaa viestiä'},
  ];
  const row = (m: AgentNavModel) => <AgentNavItem key={m.agentId} {...m} now={now} />;
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Alder" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="ra-running">
            <h2 className="ah-rail-section-head" id="ra-running">Käynnissä<span className="ah-rail-count">1</span></h2>
            <ul>{row(parentModel)}</ul>
          </section>
          <section className="ah-now ah-quiet" data-testid="rail-quiet" aria-labelledby="ra-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded="true">
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="ra-quiet">Hiljaiset</span><span className="ah-rail-count">{quiet.length}</span>
              </button>
            </h2>
            <ul data-testid="rail-quiet-list">{quiet.map(row)}</ul>
          </section>
        </>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_h" />
      <WorkspaceNavRow name="open-habitat" href="/workspaces/ws_o" />
    </WorkspaceRail>
  );

  const viewing = h.view ? h.named.find((n) => n.id === h.view) : undefined;
  let main: React.ReactNode;
  if (viewing) {
    const transcript: WorkerTranscript = {node_id: 'n-0001', harness: viewing.harness, availability: 'available', truncated: false, entries: []};
    main = (
      <div className="ah-state nw-main" data-testid="named-view">
        <WorkerView run={namedRun(viewing)} transcript={transcript} items={namedItems(viewing)} stale={false} parentTitle={PARENT}
          workspaceLabel="open-habitat" workspaceHref="/workspaces/ws_o" onParent={() => { host.view = null; notify(); }} />
      </div>
    );
  } else {
    const items: Item[] = h.events.map((e) => (e.kind === 'user' ? userItem(e.id, e.text, e.time) : agentItem(e.id, e.text, e.time)));
    if (h.parentWorking) items.push(agentItem('thinking', proto?.phase === 'relaying' ? 'Välitän viestiä prototypparille…' : 'Luen raporttia…', '', 'streaming'));
    main = (
      <div className="ah-state nw-main">
        <ConversationFrame>
          <AgentHeader title={PARENT} workspaceLabel="open-habitat" workspaceHref="/workspaces/ws_o"
            activityLabel={h.parentWorking ? rail.working : protoBusy ? rail.background : 'Odottaa viestiä'}
            activityAnimated={h.parentWorking} activityKind={h.parentWorking ? 'working' : 'neutral'}
            controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          <ConversationStream streamRef={stream}>
            <ConversationTimeline key={`p-${direction}`} state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
          </ConversationStream>
          <SpinoffContext.Provider value={{data: {schema_version: 1, parent_id: PARENT_ID, availability: 'available', runs: [ONE_SHOT], transcripts: []}, open: noop}}>
            <BackgroundStrip agentIdle={protoBusy} />
          </SpinoffContext.Provider>
          {direction === ONE ? <InsidePill /> : direction === CHIPS ? <ChipPerWorker /> : <GroupChip />}
          <Composer value={draft} onChange={setDraft} activity={h.parentWorking ? 'working' : 'idle'} selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={(t) => { sendParent(t ?? draft); setDraft(''); }} onSteer={noop} onFollowUp={noop}
            onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={picker} />
        </ConversationFrame>
      </div>
    );
  }
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={viewing ? `${viewing.name} · ${viewing.task}` : PARENT} navigationBadge={0} rail={railView}
        main={<ProcessProvider id={PARENT_ID} csrf="prototype" onLogin={noop} onStatusEvent={() => noop}>{main}</ProcessProvider>} />
    </StatusBellProvider>
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const restart = () => { resetHost(direction); setGeneration((g) => g + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Nimetyt workerit · kierros 2</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={restart}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter key={generation} initialEntries={['/workspaces/ws_o?conversation=rupeama']}>
          <Main direction={direction} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
let pickedDirection = 0;
const stageSink = {set innerHTML(view: React.ReactNode) { resetHost(pickedDirection); flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => { pickedDirection = direction; resetHost(direction); return <App key={direction} direction={direction} />; });
const pickerNav = document.createElement('nav');
pickerNav.className = 'proto-picker'; pickerNav.setAttribute('aria-label', 'Prototype variants');
pickerNav.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  pickerNav.append(button);
});
document.body.append(pickerNav);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
