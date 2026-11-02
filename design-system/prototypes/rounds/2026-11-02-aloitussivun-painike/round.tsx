import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, AgentHeader, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Markdown} from '../../../../web/src/components/Markdown';
import {SkillInvocation} from '../../../../web/src/components/SkillInvocation';
import '../../../../web/src/components/StartHere.css';
import '../../../../web/src/components/WorkspaceIntro.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// The empty new conversation of a workspace without a start page
// (proto-empty-conversation-start-page). Today it says "Luo aloitussivu
// kirjoittamalla viestikenttään /open-habitat-start-page."; Jari wants a
// Luo aloitussivu button instead. The axis is where the invitation sits in the
// empty space and what pressing it does. The workspace page's existing button
// prepares the field and lets the person send (WorkspaceLanding.tsx); the card
// direction instead sends at once. Built from production components; the
// conversation, the workspaces and the agent's reply are synthetic.
const directions = ['Rivi ja painike', 'Kortti, alkaa heti', 'Kentän yllä'];
const LINES = [
  'Rivi ja painike: hiljainen katkoviivarivi kuten työtilan sivulla; painike vie pyynnön kenttään, ja lähetät itse.',
  'Kortti, alkaa heti: kortti kertoo, mitä sivulle tulee; painike lähettää pyynnön, ja agentti aloittaa heti tässä keskustelussa.',
  'Kentän yllä: tyhjä tila pysyy tyhjänä; ehdotus on kentän yläpuolella, ja painallus vie pyynnön kenttään.',
];
const LINE = 0, CARD = 1, FIELD = 2;

// The embedded skill the button invokes. The composer shows a draft that
// begins with `/skill:<name> ` as a chip with this title (GoalChip).
const SKILL = 'open-habitat-start-page';
const GOAL = {
  skill: SKILL,
  title: 'Luo aloitussivu',
  request: 'Lue työtilan ohjeet ja tarkoitus ja ehdota sille aloitussivu: lyhyt esittely ja muutama tavoite, joista uusi keskustelu voi alkaa. Kirjoita sivu ja tavoitteiden ohjeet vasta, kun olen hyväksynyt ehdotuksen. Älä commitoi.',
};
const INVOCATION = `/skill:${SKILL} `;
const REPLY = `Luin työtilan rakenteen ja README:n. Ehdotan aloitussivuksi tätä:

**Muistiinpanot**: henkilökohtaiset muistiinpanot Markdownina, viikoittain omissa kansioissaan.

Mitä haluat tehdä?

1. **Kirjoita viikon yhteenveto**: kun viikko päättyy.
2. **Etsi vanha muistiinpano**: kun muistat aiheen mutta et paikkaa.
3. **Siivoa keskeneräiset**: kun TODO-rivejä on kertynyt.

Kirjoitanko sivun ja tavoitteiden ohjeet näin? Voit myös pyytää muutoksia. Mitään ei ole vielä kirjoitettu.`;

type Phase = 'empty' | 'filled' | 'sent' | 'replied';
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [{path: 'README.md'}, {path: '2026/viikko-44.md'}], truncated: false}),
  workspaceName: 'muistiinpanot',
};
let reviewTheme = 'light';

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [phase, setPhase] = useState<Phase>('empty');
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState(0);
  const [extra, setExtra] = useState('');
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
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  // The agent's proposal streams in; the reduced-motion check finishes at once.
  useEffect(() => {
    if (phase !== 'sent') return;
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (fast) { setShown(REPLY.length); setPhase('replied'); return; }
    let n = 0;
    const id = setInterval(() => {
      n = Math.min(REPLY.length, n + 18);
      setShown(n);
      if (n >= REPLY.length) { clearInterval(id); setPhase('replied'); }
    }, 40);
    return () => clearInterval(id);
  }, [phase]);
  const reset = () => { setPhase('empty'); setDraft(''); setShown(0); setExtra(''); };
  const fill = () => {
    if (!draft.startsWith(INVOCATION)) setDraft(INVOCATION + draft);
    setPhase('filled');
  };
  // As on the workspace page: the field is focused with the caret after the
  // invocation, once the chip has replaced it in the field.
  useEffect(() => {
    if (phase !== 'filled') return;
    const id = setTimeout(() => {
      const field = document.querySelector<HTMLTextAreaElement>('.ah-composer textarea');
      field?.focus();
      field?.setSelectionRange(field.value.length, field.value.length);
    }, 60);
    return () => clearTimeout(id);
  }, [phase]);
  const send = (text?: string) => {
    const value = text ?? draft;
    if (!value.startsWith(INVOCATION)) return;
    setExtra(value.slice(INVOCATION.length).trim());
    setDraft('');
    setPhase('sent');
  };
  const hasGoal = draft.startsWith(INVOCATION);

  const invitation =
    direction === LINE ? (
      <div className="ah-workspace-intro-line sp-line" data-testid="sp-line">
        {hasGoal ? (
          <p data-testid="sp-filled-note">Pyyntö on viestikentässä. Lisää halutessasi toiveesi ja lähetä.</p>
        ) : (
          <>
            <p>Tällä työtilalla ei ole vielä aloitussivua. Agentti voi kirjoittaa sen: lyhyen esittelyn ja muutaman tavoitteen uuden keskustelun alkuun.</p>
            <ControlButton size="row" variant="secondary" data-testid="sp-create" onPress={fill}>Luo aloitussivu</ControlButton>
          </>
        )}
      </div>
    ) : direction === CARD ? (
      <section className="sp-card" data-testid="sp-card" aria-labelledby="sp-card-title">
        <h2 id="sp-card-title">Tällä työtilalla ei ole vielä aloitussivua</h2>
        <p>Agentti lukee työtilan ja ehdottaa sille aloitussivun:</p>
        <ul>
          <li>lyhyen esittelyn siitä, mitä täällä on</li>
          <li>muutaman tavoitteen, joista uusi keskustelu voi alkaa</li>
          <li>jokaiselle tavoitteelle ohjeen, jonka agentti saa</li>
        </ul>
        <p>Mitään ei kirjoiteta ennen kuin hyväksyt ehdotuksen. Sivu näkyy sitten täällä ja työtilan sivulla.</p>
        <div className="sp-card-actions">
          <ControlButton size="row" variant="primary" data-testid="sp-create" onPress={() => send(INVOCATION)}>Luo aloitussivu</ControlButton>
          <span>Agentti aloittaa heti tässä keskustelussa.</span>
        </div>
      </section>
    ) : null;

  const items = phase === 'sent' || phase === 'replied' ? [
    {id: 'u', kind: 'user', content: (
      <UserMessage sourceText={extra} onCopy={noop} time="9.41" skill={
        <SkillInvocation name="Luo aloitussivu" description="Esittely ja tavoitteet tälle työtilalle">
          <Markdown text={GOAL.request} />
        </SkillInvocation>
      }>{extra ? <Markdown text={extra} /> : null}</UserMessage>
    )},
    {id: 'a', kind: 'assistant', content: (
      <div data-testid="sp-reply">
        <AssistantMessage streamState={phase === 'replied' ? 'complete' : 'streaming'} time="9.41" onCopy={noop}>
          <Markdown text={REPLY.slice(0, shown)} />
        </AssistantMessage>
      </div>
    )},
  ] : [];

  const suggestion = direction === FIELD && phase === 'empty' && !hasGoal ? (
    <div className="sp-suggest" data-testid="sp-suggest">
      <ControlButton size="row" variant="secondary" data-testid="sp-create" onPress={fill}>
        <Icon name="plus" />Luo aloitussivu
      </ControlButton>
      <span>Esittely ja tavoitteet tälle työtilalle</span>
    </div>
  ) : null;

  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="4 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" selected />
      <WorkspaceNavRow name="reseptikirja" href="/workspaces/ws_r" />
    </WorkspaceRail>
  );

  return (
    <div className={`sp-review variant-${direction}`} data-direction={direction}>
      <header className="sp-bar" ref={bar}>
        <strong>Luo aloitussivu tyhjässä keskustelussa</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" className="sp-reset" data-testid="sp-reset" onClick={reset}>Alusta</button>
        <ol className="sp-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="sp-stage">
        <MemoryRouter initialEntries={['/workspaces/ws_m?conversation=pi:new']}>
          <AppShell mobileTitle="Uusi keskustelu" rail={rail} main={
            <div className="ah-state">
              <ConversationFrame>
                <AgentHeader title="Uusi keskustelu" workspaceLabel="muistiinpanot" workspaceHref="/workspaces/ws_m"
                  activityLabel={phase === 'sent' ? 'Työskentelee' : ''} activityAnimated={phase === 'sent'} activityKind={phase === 'sent' ? 'working' : 'neutral'}
                  controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
                <ConversationStream>
                  <ConversationTimeline state={items.length ? 'ready' : 'empty'} items={items} historyMode="pagedAccessible" onJumpToLatest={noop}
                    emptyLabel={<div className="ah-start sp-empty" data-testid="start-here">{invitation}</div>} />
                </ConversationStream>
                {suggestion}
                <Composer value={draft} onChange={setDraft} activity={phase === 'sent' ? 'working' : 'idle'} selectedWorkingMode="steer"
                  onModeChange={noop} onSendNow={send} onSteer={send} onFollowUp={send} sources={sources} goals={[GOAL]}
                  idlePlaceholder={hasGoal ? 'Lisää toiveesi tai lähetä sellaisenaan…' : undefined}
                  modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
              </ConversationFrame>
            </div>
          } />
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
