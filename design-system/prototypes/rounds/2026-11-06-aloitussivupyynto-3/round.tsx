import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import skillSource from '../../../../internal/daemon/start-page-skill/SKILL.md?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import type {StartGoal, StartPage} from '../../../../web/src/app/composerReads';
import {AgentHeader} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import {SkillInvocation} from '../../../../web/src/components/SkillInvocation';
import {goalDraft, goalRequest} from '../../../../web/src/components/StartHere';
import {WorkspaceIntro} from '../../../../web/src/components/WorkspaceIntro';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// proto-start-page-request-presentation, round 3 (Jari 6.11.): Siru ja lause
// is chosen, without the hint under the field. Open question (b): what an
// untouched placeholder does on Send, and whether a goal's `[kysymys]` does
// the same. Each riff walks both through the same steps: (a) where the
// request starts, (b) the field with the placeholder selected, (c) the
// history after sending it untouched, with the exact text the agent got
// beneath it. The riffs differ only in that rule.
// Pi expands `/skill:<name>` with or without text after it
// (AgentSession._expandSkillCommand), so a goal sent with its placeholder
// dropped is still the goal's skill call, with no text of the person's.
// Built from production components; workspace, times and replies are synthetic.
const directions = ['Aina pois', 'Aina mukaan', 'Eri sääntö'];
const LINES = [
  'Aina pois: koskematon paikkamerkki jää lähtiessä pois sekä aloitussivupyynnöstä että tavoitteen [kysymys]-riviltä; agentti saa pelkän ohjeen, ja historiassa ei näy hakasulkeita.',
  'Aina mukaan: hakasulkeinen rivi lähtee aina sellaisenaan, kuten tavoitteissa nyt; historiassa näkyvät [anna lisäohjeita] ja [kysymys].',
  'Eri sääntö: aloitussivun lisäohje on vapaaehtoinen ja jää pois, mutta tavoitteen [kysymys] lähtee sellaisenaan, jotta agentti näkee, mitä jäi kertomatta.',
];
type Row = 'page' | 'goal';
/** Whether a riff drops an untouched placeholder, per row. */
const DROPS: Record<Row, boolean>[] = [
  {page: true, goal: true},
  {page: false, goal: false},
  {page: true, goal: false},
];

const SKILL = 'open-habitat-start-page';
const FRONT = /^---\n([\s\S]*?)\n---\s*/.exec(skillSource);
// What Pi records with the call: the skill file's body, exactly as installed.
const SKILL_BODY = skillSource.slice(FRONT?.[0].length ?? 0);
const GOAL_SKILL = 'kysy-muistiinpanoista';

type Lang = 'fi' | 'en';
// Every word the round shows besides the production components, both languages.
const TEXT = {
  fi: {
    title: 'Luo aloitussivu',
    description: 'Esittely ja tavoitteet tälle työtilalle',
    sentence: 'Luodaan tälle työtilalle aloitussivu.',
    placeholder: '[anna lisäohjeita]',
    newConversation: 'Uusi keskustelu',
    page: {
      title: 'Muistiinpanot',
      body: 'Henkilökohtaiset muistiinpanot Markdownina, viikoittain omissa kansioissaan.',
      goals: [
        {title: 'Kysy muistiinpanoista', when: 'Kun muistat aiheen mutta et paikkaa.', what: 'Saat vastauksen ja tiedoston, josta se löytyi.',
          steps: ['Kirjoita kysymys.', 'Lue vastaus ja avaa lähde.'],
          prompt: 'Etsi vastaus tämän työtilan muistiinpanoista. Kerro, missä tiedostossa ja millä viikolla asia on, ja lainaa olennainen kohta.\n\n[kysymys]',
          skill: GOAL_SKILL},
        {title: 'Kirjoita viikon yhteenveto', when: 'Kun viikko päättyy.', what: 'Saat luonnoksen viikon yhteenvedoksi.', steps: ['Lue luonnos.'], prompt: 'Kirjoita tämän viikon yhteenveto.'},
        {title: 'Siivoa keskeneräiset', when: 'Kun TODO-rivejä on kertynyt.', what: 'Saat listan avoimista riveistä.', steps: ['Valitse poistettavat.'], prompt: 'Listaa avoimet TODO-rivit.'},
      ] as StartGoal[],
    },
    pageReply: `Luin työtilan rakenteen ja README:n. Ehdotan aloitussivuksi tätä:

**Muistiinpanot**: henkilökohtaiset muistiinpanot Markdownina, viikoittain omissa kansioissaan.

1. **Kirjoita viikon yhteenveto**: kun viikko päättyy.
2. **Kysy muistiinpanoista**: kun muistat aiheen mutta et paikkaa.

Kirjoitanko sivun näin? Mitään ei ole vielä kirjoitettu.`,
    goalReply: 'Mitä haluat etsiä muistiinpanoista? Kerro aihe tai muutama sana, niin etsin tiedoston ja viikon.',
    typedReply: 'Etsin muistiinpanoista. Hetki.',
    rows: {page: 'Aloitussivu työtilan sivulta', goal: 'Tavoite Kysy muistiinpanoista'},
    caption: {
      a: {page: 'Työtilan sivu, Luo aloitussivu', goal: 'Aloitussivun tavoitteet'},
      b: {page: 'Kenttä: siru, lause ja [anna lisäohjeita] valittuna', goal: 'Kenttä: siru ja [kysymys] valittuna'},
      typed: 'Lähetetty kirjoitetun kanssa',
      dropped: 'Lähetetty koskematta: rivi jäi pois',
      kept: 'Lähetetty koskematta: rivi lähti sellaisenaan',
    },
    sent: 'Agentille lähti',
    left: 'jäi pois',
    nothing: '(ei omaa tekstiä)',
    reset: 'Palauta koskematon lähetys',
  },
  en: {
    title: 'Create start page',
    description: 'Introduction and goals for this workspace',
    sentence: 'Create a start page for this workspace.',
    placeholder: '[add instructions]',
    newConversation: 'New conversation',
    page: {
      title: 'Notes',
      body: 'Personal notes in Markdown, one folder per week.',
      goals: [
        {title: 'Ask the notes', when: 'When you remember the topic but not the place.', what: 'You get an answer and the file it came from.',
          steps: ['Write the question.', 'Read the answer and open the source.'],
          prompt: 'Find the answer in this workspace\'s notes. Say which file and week it is in, and quote the relevant part.\n\n[question]',
          skill: GOAL_SKILL},
        {title: 'Write the weekly summary', when: 'When a week ends.', what: 'You get a draft summary.', steps: ['Read the draft.'], prompt: 'Write this week\'s summary.'},
        {title: 'Tidy up open items', when: 'When TODO lines have piled up.', what: 'You get a list of open lines.', steps: ['Pick the ones to remove.'], prompt: 'List the open TODO lines.'},
      ] as StartGoal[],
    },
    pageReply: `I read the workspace structure and the README. I suggest this start page:

**Notes**: personal notes in Markdown, one folder per week.

1. **Write the weekly summary**: when a week ends.
2. **Ask the notes**: when you remember the topic but not the place.

Shall I write the page like this? Nothing has been written yet.`,
    goalReply: 'What would you like to find in the notes? Give a topic or a few words and I will find the file and the week.',
    typedReply: 'Searching the notes. One moment.',
    rows: {page: 'Start page from the workspace page', goal: 'Goal Ask the notes'},
    caption: {
      a: {page: 'Workspace page, Create start page', goal: 'The start page\'s goals'},
      b: {page: 'Field: chip, sentence and [add instructions] selected', goal: 'Field: chip and [question] selected'},
      typed: 'Sent with typed text',
      dropped: 'Sent untouched: the line was left out',
      kept: 'Sent untouched: the line went as it is',
    },
    sent: 'Sent to the agent',
    left: 'left out',
    nothing: '(no text of the person\'s)',
    reset: 'Reset to the untouched send',
  },
};

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [{path: 'README.md'}], truncated: false}),
  workspaceName: 'muistiinpanot',
};
let reviewTheme = 'light';
let reviewLang: Lang = 'fi';

/** The rule the riff proposes: an untouched placeholder still at the end of
 * the draft is cut on Send, with the line break or space before it. */
function outgoing(drop: boolean, text: string, placeholder: string) {
  return drop && text.endsWith(placeholder) ? text.slice(0, -placeholder.length).trimEnd() : text;
}

/** One screen of the flow: a caption above a framed piece of the product. */
function Screen({step, caption, id, flash, children, below}: {step: string; caption: string; id: string; flash?: boolean; children: React.ReactNode; below?: React.ReactNode}) {
  return (
    <figure className="rq-screen" data-testid={id} data-flash={flash || undefined}>
      <figcaption><b>{step}</b> {caption}</figcaption>
      <div className="rq-frame">{children}</div>
      {below}
    </figure>
  );
}

/** Review aid, not product: the exact text Send gave Pi, with a dropped
 * placeholder struck through where it was. */
function Sent({label, raw, out, left, nothing}: {label: string; raw: string; out: string; left: string; nothing: string}) {
  const cut = raw.slice(out.length);
  const gap = cut.slice(0, cut.length - cut.trimStart().length);
  return (
    <div className="rq-sent-aid" data-testid="sent-aid">
      <span className="rq-sent-label">{label}</span>
      <pre data-testid="sent-text">{out}{cut ? <>{gap}<del data-testid="sent-dropped">{cut.trimStart()}</del> <em>{left}</em></> : null}</pre>
      {out.replace(/^\/skill:\S+ ?/, '') ? null : <span className="rq-sent-note">{nothing}</span>}
    </div>
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

function Conversation({title, items, empty, draft, goals, placeholder, onSend}: {
  title: string; items?: {id: string; kind: string; content: React.ReactNode}[];
  empty?: React.ReactNode; draft?: string; goals?: {skill: string; title: string; request: string}[];
  placeholder?: string; onSend?: (text: string) => void;
}) {
  const [value, setValue] = useState(draft ?? '');
  useEffect(() => setValue(draft ?? ''), [draft]);
  const box = useRef<HTMLDivElement>(null);
  useShownSelection(box, placeholder ?? '\u0000', value);
  return (
    <div className="rq-conversation" ref={box}>
      <ConversationFrame>
        <AgentHeader title={title} workspaceLabel="muistiinpanot" workspaceHref="/workspaces/ws_m"
          activityLabel="" activityAnimated={false} activityKind="neutral"
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
        <ConversationStream>
          <ConversationTimeline state={items?.length ? 'ready' : 'empty'} items={items ?? []} historyMode="pagedAccessible" onJumpToLatest={noop}
            emptyLabel={<div className="ah-start rq-empty">{empty}</div>} />
        </ConversationStream>
        <Composer value={value} onChange={setValue} activity="idle" selectedWorkingMode="steer"
          onModeChange={noop} onSendNow={(text) => { onSend?.(text ?? value); setValue(''); }} onSteer={noop} onFollowUp={noop} sources={sources} goals={goals ?? []}
          modelPicker={<button type="button" className="md-pill">Agentin oletus · medium</button>} />
      </ConversationFrame>
    </div>
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [lang, setLang] = useState<Lang>(reviewLang);
  const [flash, setFlash] = useState('');
  const t = TEXT[lang];
  const drops = DROPS[direction];
  const goal = t.page.goals[0];
  const {request: goalBody, placeholder: goalPh = ''} = goalRequest(goal);
  // The goal's own skill carries its request, so the field holds only the
  // invocation and the placeholder (goalDraft with carried).
  const drafts: Record<Row, string> = {
    page: `/skill:${SKILL} ${t.sentence}\n${t.placeholder}`,
    goal: goalDraft(goal, '', true).text,
  };
  const ph: Record<Row, string> = {page: t.placeholder, goal: goalPh};
  const chips: Record<Row, {skill: string; title: string; request: string}[]> = {
    page: [{skill: SKILL, title: t.title, request: SKILL_BODY}],
    goal: [{skill: GOAL_SKILL, title: goal.title, request: goalBody}],
  };
  // c starts from the untouched send; sending from b replaces it.
  const [typed, setTyped] = useState<Partial<Record<Row, string>>>({});
  useEffect(() => setTyped({}), [lang]);
  const sentOf = (row: Row) => typed[row] ?? drafts[row];
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
  const point = (target: string) => {
    setFlash(target);
    document.querySelector(`[data-testid="${target}"]`)?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    setTimeout(() => setFlash(''), 1200);
  };
  const send = (row: Row) => (text: string) => { setTyped((s) => ({...s, [row]: text})); point(`${row}-c`); };

  // How a sent request reads in the history: Pi records a `/skill:` message as
  // the skill call followed by the person's text, if any. The start page's
  // chip carries the host's title (Siru ja lause); a goal's is production's.
  const history = (row: Row, text: string) => {
    const m = /^\/skill:(\S+)(?: |$)/.exec(text);
    const rest = m ? text.slice(m[0].length) : text;
    const chip = !m ? undefined : row === 'page' ? (
      <span className="rq-host-skill"><SkillInvocation name={t.title} description={t.description}><Markdown text={SKILL_BODY} /></SkillInvocation></span>
    ) : (
      <SkillInvocation name={GOAL_SKILL} description={goal.title}><Markdown text={goalBody} /></SkillInvocation>
    );
    const untouched = text === drafts[row] || text === outgoing(true, drafts[row], ph[row]);
    const reply = row === 'page' ? t.pageReply : untouched ? t.goalReply : t.typedReply;
    return [
      {id: 'u', kind: 'user', content: (
        <UserMessage sourceText={text} onCopy={noop} time="9.41" skill={chip}>
          {/* A skill call without text of the person's shows only the chip, as HistoryView does. */}
          {rest ? <div className="rq-sent"><Markdown text={rest.replaceAll('\n', '  \n')} /></div> : <></>}
        </UserMessage>
      )},
      {id: 'a', kind: 'assistant', content: (
        <AssistantMessage streamState="complete" time="9.42" onCopy={noop}><Markdown text={reply} /></AssistantMessage>
      )},
    ];
  };

  const landing = (row: Row) => (
    <div className="rq-landing">
      <h1>muistiinpanot</h1>
      <p className="rq-path">~/src/muistiinpanot</p>
      <div onClickCapture={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest('[data-testid="landing-create"]')) point('page-b');
        if (el.closest('[data-testid="starting-goal"]')?.textContent?.startsWith(goal.title)) point('goal-b');
      }}>
        <WorkspaceIntro page={row === 'page' ? null : (t.page as StartPage)} state="ready" onRetry={noop} onGoal={noop} onCreatePage={noop} />
      </div>
      <p className="rq-meta">Hakemisto · ei Git-työtilaa</p>
    </div>
  );
  const flow = (row: Row) => {
    const raw = sentOf(row);
    const wasTyped = typed[row] !== undefined && raw !== drafts[row];
    const out = outgoing(drops[row], raw, ph[row]);
    const dropped = out !== raw ? ph[row] : undefined;
    const caption = wasTyped ? t.caption.typed : dropped ? t.caption.dropped : t.caption.kept;
    const named = row === 'page' ? t.title : goal.title;
    return (
      <section className="rq-flow" aria-label={t.rows[row]} data-testid={`flow-${row}`}>
        <h2>{t.rows[row]}</h2>
        <div className="rq-screens">
          <Screen id={`${row}-a`} step="a" caption={t.caption.a[row]}>{landing(row)}</Screen>
          <Screen id={`${row}-b`} step="b" caption={t.caption.b[row]} flash={flash === `${row}-b`}>
            <Conversation key={drafts[row]} title={t.newConversation} draft={drafts[row]} goals={chips[row]} placeholder={ph[row]} onSend={send(row)} />
          </Screen>
          <Screen id={`${row}-c`} step="c" caption={caption} flash={flash === `${row}-c`}
            below={<Sent label={t.sent} raw={raw} out={out} left={t.left} nothing={t.nothing} />}>
            <Conversation key={out} title={named} items={history(row, out)} />
          </Screen>
        </div>
      </section>
    );
  };

  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Koskematon paikkamerkki lähtiessä</strong>
        <label>Kieli <select id="lang" value={lang} onChange={(e) => { reviewLang = e.target.value as Lang; setLang(reviewLang); }}>
          <option value="fi">suomi</option><option value="en">English</option></select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" id="reset" onClick={() => setTyped({})}>{t.reset}</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <MemoryRouter initialEntries={['/workspaces/ws_m']}>
        <main className="rq-stage">
          {flow('page')}
          {flow('goal')}
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
