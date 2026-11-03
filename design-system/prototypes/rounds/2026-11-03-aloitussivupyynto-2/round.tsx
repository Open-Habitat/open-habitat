import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import skillSource from '../../../../internal/daemon/start-page-skill/SKILL.md?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {SkillInvocation} from '../../../../web/src/components/SkillInvocation';
import {WorkspaceIntro} from '../../../../web/src/components/WorkspaceIntro';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// proto-start-page-request-presentation, round 2 (Jari 3.11.): both start
// buttons put a template prompt in the message field instead of sending: a
// sentence for the agent in the person's language that gets the start-page
// skill invoked, a line break, and a bracketed placeholder already selected
// so typing replaces it. One flow as three screens: (a) where the request
// starts, (b) the field with the template, (c) how the sent request reads in
// the history. The directions differ in how the skill shows in the field and
// the history, and in what an untouched placeholder does on send.
// Pi expands `/skill:<name>` only at the very start of a message
// (AgentSession._expandSkillCommand), so direction 1, which only names the
// skill in the sentence, relies on the model loading the listed skill itself.
// Built from production components; workspace, times and replies are synthetic.
const directions = ['Nimi lauseessa', 'Siru ja lause', 'Komento näkyvissä'];
const LINES = [
  'Nimi lauseessa: kentässä pelkkä lause, joka nimeää taidon; koskematon [anna lisäohjeita] jää lähtiessä pois huomaamatta, ja historiassa on sama lause tavallisena viestinä.',
  'Siru ja lause: kentässä siru Luo aloitussivu ja lause; vihje kertoo, että koskematon rivi jää pois, ja historiassa siru, jonka takana taidon ohje.',
  'Komento näkyvissä: kentässä Pi:n oma /skill:-komento tekstinä ja lause; hakasulkeinen rivi lähtee sellaisenaan, ja historiassa taidon natiivinimi.',
];
const NAME = 0, CHIP = 1, RAW = 2;

const SKILL = 'open-habitat-start-page';
const FRONT = /^---\n([\s\S]*?)\n---\s*/.exec(skillSource);
// What Pi records with the call: the skill file's body, exactly as installed.
const SKILL_BODY = skillSource.slice(FRONT?.[0].length ?? 0);
const SKILL_DESCRIPTION = /^description: (.*)$/m.exec(FRONT?.[1] ?? '')?.[1] ?? '';
const INVOKE = `/skill:${SKILL} `;

type Mode = 'absent' | 'update';
type Lang = 'fi' | 'en';
// Every word the round shows besides the production components, both languages.
const TEXT = {
  fi: {
    title: {absent: 'Luo aloitussivu', update: 'Päivitä aloitussivu'},
    description: {absent: 'Esittely ja tavoitteet tälle työtilalle', update: 'Esittely ja tavoitteet ajan tasalle'},
    sentence: [
      {absent: `Luodaan aloitussivu käyttäen ${SKILL}-taitoa.`, update: `Päivitetään aloitussivu käyttäen ${SKILL}-taitoa.`},
      {absent: 'Luodaan tälle työtilalle aloitussivu.', update: 'Päivitetään aloitussivu vastaamaan työtilaa.'},
      {absent: 'Luo tälle työtilalle aloitussivu.', update: 'Päivitä aloitussivu vastaamaan työtilaa.'},
    ],
    placeholder: ['[anna lisäohjeita]', '[anna lisäohjeita]', '[lisäohjeet, jos on]'],
    hint: 'Jos et kirjoita mitään, hakasulkeinen rivi jää pois.',
    extra: 'Korosta viikkoyhteenvetoja.',
    line: {
      absent: 'Tällä työtilalla ei ole vielä aloitussivua. Agentti voi kirjoittaa sen: lyhyen esittelyn ja muutaman tavoitteen uuden keskustelun alkuun.',
      update: 'Aloitussivu tarvitsee päivityksen. Agentti voi päivittää esittelyn ja tavoitteet vastaamaan työtilaa nyt.',
    },
    newConversation: 'Uusi keskustelu',
    reply: `Luin työtilan rakenteen ja README:n. Ehdotan aloitussivuksi tätä:

**Muistiinpanot**: henkilökohtaiset muistiinpanot Markdownina, viikoittain omissa kansioissaan.

1. **Kirjoita viikon yhteenveto**: kun viikko päättyy.
2. **Etsi vanha muistiinpano**: kun muistat aiheen mutta et paikkaa.
3. **Siivoa keskeneräiset**: kun TODO-rivejä on kertynyt.

Kirjoitanko sivun ja tavoitteiden ohjeet näin? Mitään ei ole vielä kirjoitettu.`,
  },
  en: {
    title: {absent: 'Create start page', update: 'Update start page'},
    description: {absent: 'Introduction and goals for this workspace', update: 'Bring the introduction and goals up to date'},
    sentence: [
      {absent: `Let's create the start page using the ${SKILL} skill.`, update: `Let's update the start page using the ${SKILL} skill.`},
      {absent: 'Create a start page for this workspace.', update: 'Update the start page to match the workspace.'},
      {absent: 'Create a start page for this workspace.', update: 'Update the start page to match the workspace.'},
    ],
    placeholder: ['[add instructions]', '[add instructions]', '[further instructions, if any]'],
    hint: 'If you write nothing, the bracketed line is left out.',
    extra: 'Highlight the weekly summaries.',
    line: {
      absent: 'This workspace has no start page yet. The agent can write one: a short introduction and a few goals for the start of a new conversation.',
      update: 'The start page needs an update. The agent can bring the introduction and goals in line with the workspace now.',
    },
    newConversation: 'New conversation',
    reply: `I read the workspace structure and the README. I suggest this start page:

**Notes**: personal notes in Markdown, one folder per week.

1. **Write the weekly summary**: when a week ends.
2. **Find an old note**: when you remember the topic but not the place.
3. **Tidy up open items**: when TODO lines have piled up.

Shall I write the page and the goals' instructions like this? Nothing has been written yet.`,
  },
};

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [{path: 'README.md'}], truncated: false}),
  workspaceName: 'muistiinpanot',
};
let reviewTheme = 'light';
let reviewMode: Mode = 'absent';
let reviewLang: Lang = 'fi';

/** The template the button puts in the field, as the draft Pi would receive. */
function template(direction: number, lang: Lang, mode: Mode) {
  const t = TEXT[lang];
  const body = `${t.sentence[direction][mode]}\n${t.placeholder[direction]}`;
  return direction === NAME ? body : `${INVOKE}${body}`;
}

/** What leaves on Send: directions 1 and 2 drop an untouched placeholder line. */
function outgoing(direction: number, lang: Lang, text: string) {
  const ph = TEXT[lang].placeholder[direction];
  if (direction === RAW) return text;
  return text.split('\n').filter((l) => l.trim() !== ph).join('\n').trimEnd();
}

/** One screen of the flow: a caption above a framed piece of the product. */
function Screen({step, caption, id, flash, children}: {step: string; caption: string; id: string; flash?: boolean; children: React.ReactNode}) {
  return (
    <figure className="rq-screen" data-testid={id} data-flash={flash || undefined}>
      <figcaption><b>{step}</b> {caption}</figcaption>
      <div className="rq-frame">{children}</div>
    </figure>
  );
}

const MIRRORED = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
  'borderLeftWidth', 'boxSizing', 'textIndent', 'tabSize'] as const;

/**
 * Review aid, not a product proposal: a browser hides a field's selection
 * while the field is unfocused, and the page shows two prepared fields at
 * once. A mirror over the textarea paints the selected placeholder; focusing
 * the field makes the selection real, so typing replaces it as it would.
 */
function useShownSelection(box: React.RefObject<HTMLDivElement | null>, placeholder: string, value: string) {
  const touched = useRef(false);
  useLayoutEffect(() => {
    const ta = box.current?.querySelector('textarea');
    if (!ta) return;
    let mirror: HTMLDivElement | null = null;
    const clear = () => { mirror?.remove(); mirror = null; };
    const paint = () => {
      clear();
      const at = ta.value.lastIndexOf(placeholder);
      if (touched.current || at < 0 || !ta.offsetParent) return;
      const cs = getComputedStyle(ta);
      mirror = document.createElement('div');
      mirror.className = 'rq-selection';
      mirror.setAttribute('aria-hidden', 'true');
      for (const p of MIRRORED) mirror.style[p] = cs[p];
      Object.assign(mirror.style, {left: `${ta.offsetLeft}px`, top: `${ta.offsetTop}px`, width: `${ta.offsetWidth}px`, height: `${ta.offsetHeight}px`});
      const mark = document.createElement('mark');
      mark.textContent = placeholder;
      mirror.append(ta.value.slice(0, at), mark, ta.value.slice(at + placeholder.length));
      ta.offsetParent.append(mirror);
      mirror.scrollTop = ta.scrollTop;
    };
    const focus = () => {
      const at = ta.value.lastIndexOf(placeholder);
      if (!touched.current && at >= 0) requestAnimationFrame(() => ta.setSelectionRange(at, at + placeholder.length));
      touched.current = true;
      clear();
    };
    paint();
    const o = new ResizeObserver(paint);
    o.observe(ta);
    document.fonts?.ready.then(paint);
    ta.addEventListener('focus', focus);
    return () => { o.disconnect(); ta.removeEventListener('focus', focus); clear(); };
  }, [box, placeholder, value]);
}

function Conversation({title, working, items, empty, draft, goals, placeholder, hint, onSend}: {
  title: string; working?: boolean; items?: {id: string; kind: string; content: React.ReactNode}[];
  empty?: React.ReactNode; draft?: string; goals?: {skill: string; title: string; request: string}[];
  placeholder?: string; hint?: string; onSend?: (text: string) => void;
}) {
  const [value, setValue] = useState(draft ?? '');
  useEffect(() => setValue(draft ?? ''), [draft]);
  const box = useRef<HTMLDivElement>(null);
  useShownSelection(box, placeholder ?? '\u0000', value);
  return (
    <div className="rq-conversation" ref={box}>
      <ConversationFrame>
        <AgentHeader title={title} workspaceLabel="muistiinpanot" workspaceHref="/workspaces/ws_m"
          activityLabel={working ? 'Työskentelee' : ''} activityAnimated={false} activityKind={working ? 'working' : 'neutral'}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
        <ConversationStream>
          <ConversationTimeline state={items?.length ? 'ready' : 'empty'} items={items ?? []} historyMode="pagedAccessible" onJumpToLatest={noop}
            emptyLabel={<div className="ah-start rq-empty">{empty}</div>} />
        </ConversationStream>
        <Composer value={value} onChange={setValue} activity={working ? 'working' : 'idle'} selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={(text) => { onSend?.(text ?? value); setValue(''); }} onSteer={noop} onFollowUp={noop} sources={sources} goals={goals ?? []}
          modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
        {hint && placeholder && value.includes(placeholder) ? <p className="rq-hint" data-testid="placeholder-hint">{hint}</p> : null}
      </ConversationFrame>
    </div>
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [mode, setMode] = useState<Mode>(reviewMode);
  const [lang, setLang] = useState<Lang>(reviewLang);
  const [flash, setFlash] = useState('');
  const t = TEXT[lang];
  const draft = template(direction, lang, mode);
  const ph = t.placeholder[direction];
  // The c screens start from one typed wish (workspace page) and one untouched
  // placeholder (empty conversation); sending from b replaces them.
  const [sent, setSent] = useState<Record<string, string>>({});
  useEffect(() => setSent({}), [lang, mode]);
  const pageSent = sent.page ?? outgoing(direction, lang, draft.replace(ph, t.extra));
  const untouched = outgoing(direction, lang, draft);
  const emptySent = sent.empty ?? untouched;
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
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { setPersonalLanguage(lang); document.documentElement.lang = lang; }, [lang]);
  const title = t.title[mode];
  const goals = direction === CHIP ? [{skill: SKILL, title, request: SKILL_BODY}] : [];
  const point = (target: string) => {
    setFlash(target);
    document.querySelector(`[data-testid="${target}"]`)?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    setTimeout(() => setFlash(''), 1200);
  };
  const send = (row: string) => (text: string) => { setSent((s) => ({...s, [row]: outgoing(direction, lang, text)})); point(`${row}-c`); };

  // How a sent request reads in the history: Pi records a `/skill:` message as
  // the skill call followed by the person's text.
  const history = (text: string) => {
    const skill = text.startsWith(INVOKE);
    const rest = skill ? text.slice(INVOKE.length) : text;
    const chip = !skill ? undefined : direction === CHIP ? (
      <SkillInvocation name={title} description={t.description[mode]}><Markdown text={SKILL_BODY} /></SkillInvocation>
    ) : (
      <SkillInvocation name={SKILL} description={SKILL_DESCRIPTION}><Markdown text={SKILL_BODY} /></SkillInvocation>
    );
    return [
      {id: 'u', kind: 'user', content: (
        <UserMessage sourceText={text} onCopy={noop} time="9.41" skill={chip}>
          {rest ? <div className="rq-sent"><Markdown text={rest.replaceAll('\n', '  \n')} /></div> : null}
        </UserMessage>
      )},
      {id: 'a', kind: 'assistant', content: (
        <AssistantMessage streamState="complete" time="9.42" onCopy={noop}><Markdown text={t.reply} /></AssistantMessage>
      )},
    ];
  };
  const named = direction === NAME ? t.newConversation : title;

  const intro = (
    <div className="rq-landing">
      <h1>muistiinpanot</h1>
      <p className="rq-path">~/src/muistiinpanot</p>
      <div onClickCapture={(e) => { if ((e.target as HTMLElement).closest('[data-testid="landing-create"]')) point('page-b'); }}>
        <WorkspaceIntro page={mode === 'update' ? {state: 'needs_update'} : null} state="ready" onRetry={noop} onGoal={noop} onCreatePage={noop} />
      </div>
      <p className="rq-meta">Hakemisto · ei Git-työtilaa</p>
      <h2 className="rq-section">Avoimet <span>0</span></h2>
    </div>
  );
  const line = (
    <div className="ah-workspace-intro-line rq-line" data-testid="empty-invitation">
      <p>{t.line[mode]}</p>
      <ControlButton size="row" variant="secondary" data-testid="empty-create" onPress={() => point('empty-b')}>{title}</ControlButton>
    </div>
  );
  const field = (row: string) => (
    <Conversation key={draft} title={t.newConversation} draft={draft} goals={goals} placeholder={ph}
      hint={direction === CHIP ? t.hint : undefined} onSend={send(row)} />
  );
  const sentCaption = (typed: boolean) => typed
    ? 'Lähetetty lisäohjeen kanssa'
    : ['Lähetetty koskematta: rivi jäi pois', 'Lähetetty koskematta: rivi jäi pois, kuten vihje kertoi', 'Lähetetty koskematta: rivi lähti sellaisenaan'][direction];

  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Aloitussivupyyntö mallikehotteena</strong>
        <label>Tila <select id="mode" value={mode} onChange={(e) => { reviewMode = e.target.value as Mode; setMode(reviewMode); }}>
          <option value="absent">Ei aloitussivua</option><option value="update">Tarvitsee päivityksen</option></select></label>
        <label>Kieli <select id="lang" value={lang} onChange={(e) => { reviewLang = e.target.value as Lang; setLang(reviewLang); }}>
          <option value="fi">suomi</option><option value="en">English</option></select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <MemoryRouter initialEntries={['/workspaces/ws_m']}>
        <main className="rq-stage">
          <section className="rq-flow" aria-label="Työtilan sivulta" data-testid="flow-page">
            <h2>Työtilan sivulta</h2>
            <div className="rq-screens">
              <Screen id="page-a" step="a" caption="Työtilan sivu">{intro}</Screen>
              <Screen id="page-b" step="b" caption="Painallus avaa uuden keskustelun, ja kentässä on mallikehote; hakasulkeet valittuna" flash={flash === 'page-b'}>{field('page')}</Screen>
              <Screen id="page-c" step="c" caption={sentCaption(pageSent !== untouched)} flash={flash === 'page-c'}>
                <Conversation key={pageSent} title={named} items={history(pageSent)} />
              </Screen>
            </div>
          </section>
          <section className="rq-flow" aria-label="Tyhjästä keskustelusta" data-testid="flow-empty">
            <h2>Tyhjästä keskustelusta</h2>
            <div className="rq-screens">
              <Screen id="empty-a" step="a" caption="Uusi tyhjä keskustelu: rivi ja painike">
                <Conversation title={t.newConversation} empty={line} />
              </Screen>
              <Screen id="empty-b" step="b" caption="Painallus vie saman mallikehotteen kenttään; mitään ei lähetetä" flash={flash === 'empty-b'}>{field('empty')}</Screen>
              <Screen id="empty-c" step="c" caption={sentCaption(emptySent !== untouched)} flash={flash === 'empty-c'}>
                <Conversation key={emptySent} title={named} items={history(emptySent)} />
              </Screen>
            </div>
          </section>
        </main>
      </MemoryRouter>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => <App key={`${direction}`} direction={direction} />);
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
