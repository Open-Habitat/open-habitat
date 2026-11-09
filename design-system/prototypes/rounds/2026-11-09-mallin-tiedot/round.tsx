import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
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
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountShelf} from '../../../../web/src/components/Account';
import {ProcessProvider} from '../../../../web/src/components/ProcessTray';
import {ContextRing, type ContextUsage} from '../../../../web/src/components/ContextRing';
import {ModelChip} from '../../../../web/src/components/ModelChip';
import {type ModelChoice, ModelPicker} from '../../../../web/src/components/ModelPicker';
import {ComposerModelPicker} from '../../../../web/src/components/ComposerModelPicker';
import {SessionSettingsRow} from '../../../../web/src/components/SessionSettingsRow';
import {modelCapabilityRank, modelDisplayName, thinkingDisplayName} from '../../../../web/src/components/modelPresentation';
import type {TimelineItem} from '../../../../web/src/components/types';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-model-details-not-picker, round 1. Kaisa 9.11.2026: the
// popover behind the top bar's model chip lists the models and thinking
// levels as bordered, button-like rows with the current one highlighted, so
// it reads as a picker, yet nothing in it can be pressed. The axis is what
// that popover is: (A) a real picker for this conversation, (B) information
// stated plainly, (C) a short summary that points to where the model is
// actually chosen. The popover is open on every default view.
//
// Host facts. Today: Pi's catalog for the conversation's sign-in (models,
// their thinking levels and context windows), the conversation's model and
// level from Pi's own session (model_change, thinking_level_change),
// Pi's default for new conversations, and the composer's picker that
// chooses the first model before the first message (daemon first_choice:
// set_model and set_thinking_level over Pi's RPC). Natively Pi can change
// both mid-conversation (/model, Ctrl+P, Shift+Tab; RPC set_model,
// set_thinking_level); it writes the change into the session, and the next
// turn sends the whole conversation to the new model. The browser already
// draws such a change as a "Malli vaihtui" row. Only A needs something new:
// the daemon accepting set_model/set_thinking_level for an idle, running
// conversation after its first message.
const directions = ['A Vaihda tässä', 'B Tietona', 'C Lyhyesti ja minne'];
const LINES = [
  'A Vaihda tässä: oikea valitsin tälle keskustelulle. Vaihto koskee seuraavaa viestiä, ja keskusteluun jää rivi "Malli vaihtui".',
  'B Tietona: pelkkä tieto ilman reunuksia: malli, ajattelutaso ja kirjautuminen; muut mallit hiljaisena tekstinä.',
  'C Lyhyesti ja minne: yksi rivi ja kaksi tietä: uusi keskustelu toisella mallilla tai uusien keskustelujen oletus.',
];

// ---- The story: a test round in open-habitat on Jari's Claude subscription ----
const P = 'claude-bridge';
const levels = ['low', 'medium', 'high', 'xhigh', 'max'];
const MODELS: ModelChoice[] = [
  {provider: P, id: 'claude-fable-5-1', name: 'Claude Fable 5.1', thinking_levels: levels, context_window: 1_000_000, compaction_reserve_tokens: 16384},
  {provider: P, id: 'claude-opus-5-5', name: 'Claude Opus 5.5', thinking_levels: levels, context_window: 1_000_000, compaction_reserve_tokens: 16384},
  {provider: P, id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', thinking_levels: levels, context_window: 1_000_000, compaction_reserve_tokens: 16384},
  {provider: P, id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', thinking_levels: ['low', 'medium', 'high'], context_window: 200_000, compaction_reserve_tokens: 16384},
];
const TOKENS = 120_000;
/** Pi's default for new conversations (settings.json). */
const DEFAULT = {model: `${P}/claude-sonnet-5-5`, thinking: 'high'};
const TITLE = 'Testikierros 9.11.';
const WS = 'open-habitat';
const name = (id: string) => modelDisplayName(`${P}/${id}`, MODELS);
const byId = (id: string) => MODELS.find((m) => m.id === id)!;
const ranked = [...MODELS].sort((a, b) => modelCapabilityRank(a) - modelCapabilityRank(b));
const listWords = (xs: string[]) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ja ${xs[xs.length - 1]}`;
const pct = (window: number) => Math.round((TOKENS / window) * 100);

type Setting = {model: string; thinking: string};
type Toast = (s: string) => void;

// ---- A: a real picker for this conversation ----
function PickHere({now, working, onChange, toast}: {now: Setting; working: boolean; onChange: (s: Setting) => void; toast: Toast}) {
  const [pick, setPick] = useState<Setting>(now);
  const changed = pick.model !== now.model || pick.thinking !== now.thinking;
  const m = byId(pick.model);
  return (
    <section className="mi-a" data-testid="mi-pick" aria-label="Tämän keskustelun malli">
      <h2 className="mi-h">Tämän keskustelun malli</h2>
      <ModelPicker models={MODELS} selected={pick.model} thinking={pick.thinking} busy={working}
        onSelect={(id) => setPick((p) => ({model: id, thinking: byId(id).thinking_levels!.includes(p.thinking) ? p.thinking : byId(id).thinking_levels![0]}))}
        onThinking={(level) => setPick((p) => ({...p, thinking: level}))} />
      {working ? (
        <p className="md-note" data-testid="mi-busy">Agentti työskentelee. Mallin ja ajattelutason voi vaihtaa, kun vuoro on päättynyt.</p>
      ) : changed ? (
        <div className="mi-change" data-testid="mi-impact">
          <p className="md-note">
            {pick.model !== now.model
              ? <>Seuraava viesti lähtee mallille {name(pick.model)}, ja se saa koko keskustelun mukaansa. Keskustelu vie {pct(m.context_window!)} % sen kontekstista.</>
              : <>Ajattelutaso vaihtuu seuraavasta viestistä alkaen.</>}
          </p>
          <div className="mi-actions">
            <ControlButton variant="quiet" size="row" data-testid="mi-cancel" onPress={() => setPick(now)}>Peru</ControlButton>
            <ControlButton variant="primary" size="row" data-testid="mi-commit" onPress={() => onChange(pick)}>
              Vaihda: {name(pick.model)} · {thinkingDisplayName(pick.thinking)}
            </ControlButton>
          </div>
        </div>
      ) : (
        <p className="md-note">Vaihto koskee seuraavaa viestiä. Keskusteluun jää siitä rivi.</p>
      )}
      <a className="md-note mi-link" href="#oletus" data-testid="mi-default" onClick={(e) => { e.preventDefault(); toast('Avaisi Asetukset › Tekoäly › Oletusmalli'); }}>
        Uusien keskustelujen oletus: {modelDisplayName(DEFAULT.model, MODELS)} · {thinkingDisplayName(DEFAULT.thinking)}
      </a>
    </section>
  );
}

// ---- B: read-only, read as information ----
function AsInfo({now}: {now: Setting}) {
  const others = ranked.filter((m) => m.id !== now.model).map((m) => name(m.id));
  return (
    <section className="mi-b" data-testid="mi-info" aria-label="Keskustelun malli ja ajattelutaso">
      <dl className="mi-facts">
        <div><dt>Malli</dt><dd><strong data-testid="mi-model">{name(now.model)}</strong> <code>{now.model}</code></dd></div>
        <div><dt>Ajattelutaso</dt><dd><strong>{thinkingDisplayName(now.thinking)}</strong></dd></div>
        <div><dt>Kirjautuminen</dt><dd>Claude-tilaus</dd></div>
      </dl>
      <p className="mi-quiet" data-testid="mi-others">
        Samalla kirjautumisella ovat myös {listWords(others)}. {name(now.model)} osaa ajattelutasot {listWords(byId(now.model).thinking_levels!.map(thinkingDisplayName))}.
      </p>
      <p className="md-note">Selaimessa malli ja ajattelutaso valitaan ennen keskustelun ensimmäistä viestiä.</p>
    </section>
  );
}

// ---- C: a summary and where the model is actually chosen ----
function Pointer({now, onNew, toast}: {now: Setting; onNew: () => void; toast: Toast}) {
  return (
    <section className="mi-c" data-testid="mi-pointer" aria-label="Keskustelun malli ja ajattelutaso">
      <p className="mi-summary"><strong data-testid="mi-model">{name(now.model)}</strong> · ajattelutaso {thinkingDisplayName(now.thinking)}</p>
      <p className="md-note">Malli valitaan keskustelun alussa, viestikentän vasemmasta reunasta.</p>
      <div className="mi-ways">
        <ControlButton variant="secondary" size="row" data-testid="mi-new" onPress={onNew}>
          <Icon name="plus" /> Uusi keskustelu toisella mallilla
        </ControlButton>
        <a className="mi-way" href="#oletus" data-testid="mi-default" onClick={(e) => { e.preventDefault(); toast('Avaisi Asetukset › Tekoäly › Oletusmalli'); }}>
          <span>Uusien keskustelujen oletus</span>
          <span className="md-note">{modelDisplayName(DEFAULT.model, MODELS)} · {thinkingDisplayName(DEFAULT.thinking)}</span>
        </a>
      </div>
    </section>
  );
}

// ---- The conversation ----
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: WS,
};
type Item = TimelineItem & {kind: string};
const userItem = (id: string, text: string, time: string): Item => ({id, kind: 'user', content: <UserMessage sourceText={text} onCopy={noop} time={time}><Markdown text={text} /></UserMessage>});
const agentItem = (id: string, text: string, time: string): Item =>
  ({id, kind: 'assistant', content: <AssistantMessage streamState="complete" time={time} onCopy={noop}><Markdown text={text} /></AssistantMessage>});
const HISTORY: Item[] = [
  userItem('u1', 'Aja testikierros testipalvelimella ja kerro, mitkä selainspeksit kaatuivat.', '9.02'),
  agentItem('a1', 'Kierros on ajettu. 412 speksistä 409 meni läpi. Kaatuneet kolme ovat kaikki arkistolistassa: ne valitsevat keskustelun, joka on jo arkistoitu.', '9.18'),
  userItem('u2', 'Korjaa ne niin, että ne valitsevat arkistoimattoman keskustelun.', '9.20'),
  agentItem('a2', 'Korjattu ja ajettu uudelleen: kaikki kolme menevät läpi. Muutos on kahdessa speksissä, tuotantokoodiin ei tarvinnut koskea.', '9.41'),
];

function Main({direction: d, working}: {direction: number; working: boolean}) {
  const [draft, setDraft] = useState('');
  const stream = useRef<HTMLElement>(null);
  const chip = useRef<HTMLDetailsElement>(null);
  const [now, setNow] = useState<Setting>({model: 'claude-opus-5-5', thinking: 'medium'});
  const [open, setOpen] = useState(true);
  const [markers, setMarkers] = useState<Item[]>([]);
  const [fresh, setFresh] = useState(false);
  const [toastText, setToastText] = useState<string>();
  const toast = (s: string) => setToastText(s);
  useEffect(() => { if (!toastText) return; const t = window.setTimeout(() => setToastText(undefined), 2600); return () => clearTimeout(t); }, [toastText]);
  useLayoutEffect(() => { if (chip.current) chip.current.open = open; }, [open, fresh]);
  useLayoutEffect(() => {
    const bottom = () => { const el = stream.current; if (el) el.scrollTop = el.scrollHeight; };
    bottom();
    const timers = [0, 80, 250].map((t) => window.setTimeout(bottom, t));
    return () => timers.forEach(clearTimeout);
  }, [markers, fresh]);
  // The composer's own picker opens on the new conversation (C's first way).
  useLayoutEffect(() => {
    if (!fresh) return;
    const el = document.querySelector<HTMLDetailsElement>('.md-empty-picker');
    if (el) el.open = true;
  }, [fresh]);

  const change = (next: Setting) => {
    const marker = {
      key: `m${markers.length}`,
      ...(next.model !== now.model ? {oldModel: `${P}/${now.model}`, model: `${P}/${next.model}`} : {}),
      ...(next.thinking !== now.thinking ? {oldThinking: now.thinking, thinking: next.thinking} : {}),
    };
    setMarkers((xs) => [...xs, {id: marker.key, kind: 'notice', content: <SessionSettingsRow marker={marker} />}]);
    setNow(next);
    setOpen(false);
  };
  const current = `${P}/${now.model}`;
  const usage: ContextUsage = {phase: 'known', tokens: fresh ? 0 : TOKENS, window: byId(now.model).context_window, autoCompaction: true, reserve: 16384, model: name(now.model)};
  const body = d === 0 ? <PickHere key={`${now.model}${now.thinking}`} now={now} working={working} onChange={change} toast={toast} />
    : d === 1 ? <AsInfo now={now} />
    : <Pointer now={now} toast={toast} onNew={() => { setToastText(undefined); setOpen(false); setFresh(true); }} />;
  const modelPicker = fresh ? (
    <ModelChip compact model={DEFAULT.model} thinking={DEFAULT.thinking} models={MODELS} />
  ) : (
    <details className="md-chip-picker" ref={chip} onToggle={(e) => setOpen(e.currentTarget.open)}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <ModelChip as="summary" data-testid="conversation-model" compact model={current} thinking={now.thinking} models={MODELS} />
      <div className="md-pop mi-pop" tabIndex={-1} data-testid="mi-pop">{open ? body : null}</div>
    </details>
  );
  const composerPicker = fresh ? (
    <ComposerModelPicker model={DEFAULT.model} thinking={DEFAULT.thinking} models={MODELS}>
      {() => <ModelPicker models={MODELS} selected={DEFAULT.model.split('/')[1]} thinking={DEFAULT.thinking} onSelect={noop} onThinking={noop} />}
    </ComposerModelPicker>
  ) : undefined;

  const t = Date.now();
  const nav = (m: Partial<AgentNavModel> & Pick<AgentNavModel, 'agentId' | 'title'>): AgentNavModel => ({
    href: `/workspaces/ws_oh?conversation=${m.agentId}`, workspaceId: 'ws_oh', workspaceName: WS, activity: 'waiting',
    activityLabel: 'Odottaa viestiä', controlLabel: '', changedAt: t - 5 * 60000, ...m,
  });
  const running: AgentNavModel[] = [
    ...(fresh ? [nav({agentId: 'uusi', title: 'Uusi keskustelu', selected: true, detail: `${WS} · Odottaa viestiä`})] : []),
    nav({agentId: 'kierros', title: TITLE, selected: !fresh, activity: working ? 'working' : 'waiting', activityLabel: working ? 'Työskentelee' : 'Odottaa viestiä', detail: `${WS} · ${working ? 'Työskentelee' : 'Odottaa viestiä'}`}),
    nav({agentId: 'arkisto', title: 'Arkistolistan speksit', changedAt: t - 70 * 60000, detail: `${WS} · Odottaa viestiä`}),
    nav({agentId: 'varmistus', title: 'Varmuuskopion tarkistus', workspaceId: 'ws_hb', workspaceName: 'fleetrepo', changedAt: t - 120 * 60000, detail: 'fleetrepo · Odottaa viestiä'}),
  ];
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Birch" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Kaisa" onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now" data-testid="rail-running" aria-labelledby="mi-running">
          <h2 className="ah-rail-section-head" id="mi-running">Käynnissä<span className="ah-rail-count">{running.length}</span></h2>
          <ul>{running.map((m) => <AgentNavItem key={m.agentId} {...m} now={t} />)}</ul>
        </section>
      }>
      <WorkspaceNavRow name="fleetrepo" href="/workspaces/ws_hb" />
      <WorkspaceNavRow name={WS} href="/workspaces/ws_oh" />
    </WorkspaceRail>
  );
  const items = fresh ? [] : [...HISTORY, ...markers];
  const main = (
    <div className="ah-state mi-main">
      <ConversationFrame>
        <AgentHeader title={fresh ? 'Uusi keskustelu' : TITLE} workspaceLabel={WS} workspaceHref="/workspaces/ws_oh"
          activityLabel={working && !fresh ? 'Työskentelee' : 'Odottaa viestiä'} activityKind={working && !fresh ? 'working' : 'neutral'}
          activityAnimated={working && !fresh}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} emptyConversation={fresh}
          settings={fresh ? DEFAULT : {model: current, thinking: now.thinking}}
          contextIndicator={fresh ? undefined : <ContextRing usage={usage} />} modelPicker={modelPicker} />
        <ConversationStream streamRef={stream}>
          <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop}
            emptyLabel={fresh ? <p className="mi-empty">Kirjoita ensimmäinen viesti. Mallin voi valita viestikentän vasemmasta reunasta.</p> : null} />
        </ConversationStream>
        <Composer value={draft} onChange={setDraft} activity={working && !fresh ? 'working' : 'idle'} selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={() => setDraft('')} onSteer={noop} onFollowUp={noop}
          onInterrupt={noop} sources={sources} csrf="prototype" modelPicker={composerPicker} />
      </ConversationFrame>
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={fresh ? 'Uusi keskustelu' : TITLE} navigationBadge={0} rail={railView}
        main={<ProcessProvider id="pi:kierros" csrf="prototype" onLogin={noop} onStatusEvent={() => noop}>{main}</ProcessProvider>} />
      {toastText ? <div className="mi-toast" role="status" data-testid="mi-toast">{toastText}</div> : null}
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
let reviewWorking = false;
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [working, setWorking] = useState(reviewWorking);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Mallin tiedot · kierros 1</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label><input id="working" type="checkbox" checked={working} onChange={(e) => { reviewWorking = e.target.checked; setWorking(reviewWorking); }} /> Agentti työssä</label>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <MemoryRouter initialEntries={['/workspaces/ws_oh?conversation=kierros']}>
          <Main direction={direction} working={working} />
        </MemoryRouter>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(v: React.ReactNode) { flushSync(() => root.render(v === '' ? null : v)); }};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
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
