import React, {type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {initialTheme} from '../../lib/view-theme.js';
import {ControlButton, IconButton, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {TextArea, TextField} from '../../../../web/src/components/Primitives';
import {InlineNotice} from '../../../../web/src/components/Status';
import {AssistantMessage, UserMessage} from '../../../../web/src/components/Conversation';
import {Markdown} from '../../../../web/src/components/Markdown';
import {InstructionsEditor} from '../../../../web/src/components/InstructionsEditor';
import {OnboardingFrame, OnboardingRoute} from '../../../../web/src/components/OnboardingFrame';
import {OnboardingSettings, type OnboardingStep, type ProviderAvailability} from '../../../../web/src/components/OnboardingSettings';
import type {OnboardingDocument} from '../../../../web/src/app/onboardingConfig';
import {tidyOwnWords} from '../../../../web/src/components/agentNote';
import {agentNoteText} from '../../../../web/src/text/agentNote';
import {agentInstructionsText} from '../../../../web/src/text/agentInstructions';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/AgentNoteStep.css';
import '../../../../web/src/app/AgentInstructions.css';
import './round.css';

// Administrator-defined questions for the agent note, round 1. One axis:
// what the administrator edits. 1 Lisäkysymykset: the site's own questions
// as a list in Asetukset › Käyttöönotto, asked after Habitat's fixed
// questions and before "omin sanoin" (the issue's proposal). 2 Koko
// keskustelu: the whole conversation as the person sees it, Habitat's
// questions included; the administrator can hide and reorder them and edits
// the site's questions in place. The person's side is the same in both and
// follows from the list: onboarding's last step and Settings › Tili ›
// Ohjeet agentille, where a question the note does not answer yet waits.
// Production components are used unchanged; the round adds its route row
// and panel to production's Käyttöönotto through portals and builds the
// conversation from production's pieces, as AgentNoteStep does. Finnish
// only, every name and organisation synthetic.

setPersonalLanguage('fi');
const params = new URLSearchParams(location.search);
const theme = initialTheme(['light', 'dark']) as 'light' | 'dark';
const note = liveText(agentNoteText);
const ai = liveText(agentInstructionsText);
const NAMES = ['1 Lisäkysymykset', '2 Koko keskustelu'];
const PERSON_NAME = 'Aino Laine';
const MAX_QUESTIONS = 5;
const MAX_CHOICES = 4;

const T = {
  title: 'Ylläpitäjän kysymykset muistilappuun · kierros 1',
  views: {admin: 'Ylläpitäjä', person: 'Henkilö'},
  view: 'Näkymä',
  show: 'Tilanne',
  theme: 'Teema',
  themes: {light: 'Päivä', dark: 'Yö'},
  reset: 'Alusta',
  scenarios: {
    lista: 'Kolme omaa kysymystä',
    tyhja: 'Ei omia kysymyksiä',
    muokkaa: 'Kysymys auki muokattavana',
    lisaa: 'Uusi kysymys',
    kaytto: 'Käyttöönoton viimeinen vaihe',
    uusi: 'Asetukset: uusi kysymys odottaa',
  } as Record<string, string>,
  lines: [
    'Ylläpitäjä kirjoittaa sivuston omat kysymykset listaksi. Habitatin omat kysymykset pysyvät, ja omat kysytään niiden jälkeen ennen omin sanoin -kohtaa.',
    'Ylläpitäjä muokkaa koko keskustelua sellaisena kuin henkilö sen näkee: Habitatin kysymykset voi piilottaa ja siirtää, omat kirjoitetaan paikalleen.',
  ],
  personSame: 'Henkilön puoli seuraa ylläpitäjän listaa; vaihda Ylläpitäjä-näkymään ja takaisin nähdäksesi muutoksen.',
  adminKicker: 'Asetukset › Palvelin',
  adminTitle: 'Käyttöönotto',
  step: 'Ohjeet agentille',
  hintNone: 'Habitatin kysymykset',
  hintSite: (n: number) => `${n} ${n === 1 ? 'oma kysymys' : 'omaa kysymystä'}`,
  hintAll: (n: number, hidden: number) => `${n} kysymystä${hidden ? ` · ${hidden} piilotettu` : ''}`,
  yourSettings: 'Sinun asetuksesi',
  panelLead:
    'Viimeinen vaihe on lyhyt keskustelu, jossa agentti tekee henkilölle muistilapun. Lappu tallentuu henkilön kotihakemistoon vasta, kun hän on nähnyt koko tekstin ja painanut Tallenna.',
  panelLead2:
    'Kysymykset kuvaavat koko keskustelun. Habitatin omat kysymykset voi piilottaa tai siirtää; omat kysymykset kirjoitetaan paikalleen.',
  listLabel: 'Kysymykset siinä järjestyksessä, jossa agentti ne kysyy',
  habitat: 'Habitatin kysymys',
  alwaysLast: 'Habitatin kysymys · aina viimeisenä',
  hidden: 'Piilotettu · ei kysytä',
  siteQ: 'Ylläpitäjän kysymys',
  modeSummary: (q: SiteQ) =>
    q.mode === 'free' ? 'Omin sanoin' : `${q.choices.length} vaihtoehtoa${q.mode === 'both' ? ' tai omin sanoin' : ''}`,
  noneYet: 'Omia kysymyksiä ei ole. Uusi henkilö näkee Habitatin kysymykset.',
  add: 'Lisää kysymys',
  max: `Kysymyksiä voi olla enintään ${MAX_QUESTIONS}.`,
  up: 'Siirrä ylemmäs',
  down: 'Siirrä alemmas',
  edit: 'Muokkaa',
  hide: 'Piilota',
  showQ: 'Näytä',
  after:
    'Muutos koskee lappuja, jotka tehdään tästä eteenpäin; valmiisiin lappuihin ei kosketa. Kun lisäät kysymyksen tai muutat sen sanoja, jo liittyneet näkevät sen kohdassa Asetukset › Tili › Ohjeet agentille ja voivat vastata, jos haluavat.',
  formText: 'Kysymys',
  formHint: 'Lisätieto henkilölle (valinnainen)',
  formMode: 'Vastaustapa',
  modes: {choice: 'Vaihtoehdot', free: 'Omin sanoin', both: 'Molemmat'},
  choicesLabel: 'Vaihtoehdot: painike ja lause, jonka se lisää lappuun',
  choiceLabel: (i: number) => `Painike ${i + 1}`,
  choiceProse: 'Lappuun tulee',
  removeChoice: (i: number) => `Poista vaihtoehto ${i + 1}`,
  addChoice: 'Lisää vaihtoehto',
  freeLands: 'Vastaus tulee lappuun kysymyksen otsikon alle:',
  personSees: 'Henkilö näkee',
  lands: 'Lappuun tulee:',
  removeQ: 'Poista kysymys',
  done: 'Valmis',
  ownWordsChip: 'Omin sanoin…',
  skip: 'Ohita',
  skipped: 'Ohitetaan',
  answerLabel: 'Vastauksesi',
  added: 'Laitoin sen lappuun.',
  readyBubble: 'Valmis. Tältä muistilappusi näyttää…',
  newPerson: 'Uusi henkilö',
  personKicker: 'Asetukset › Tili',
  waiting: (n: number) => (n === 1 ? 'Ylläpitäjä on lisännyt kysymyksen, johon lapussasi ei ole vielä vastausta' : `Ylläpitäjä on lisännyt ${n} kysymystä, joihin lapussasi ei ole vielä vastausta`),
  answer: 'Vastaa',
  helloMissing: (first: string, n: number) =>
    `Hei ${first}. Luin muistilappusi. Ylläpitäjä on lisännyt ${n === 1 ? 'kysymyksen' : `${n} kysymystä`}, joihin siinä ei vielä ole vastausta. Lisään vastauksesi loppuun; vanhaan tekstiin en koske.`,
  saved: 'Prototyyppi: lappu tallentuisi nyt henkilön tiedostoon ~/.pi/agent/AGENTS.md.',
  later: 'Prototyyppi: mitään ei kirjoitettu.',
  notInRound: 'Ei tällä kierroksella.',
};

// ---------- The questions ----------
type Mode = 'choice' | 'free' | 'both';
type Choice = {label: string; prose: string};
type SiteQ = {id: string; text: string; hint: string; mode: Mode; choices: Choice[]};
type Builtin = 'lang' | 'style' | 'ask' | 'own';
type Item = {kind: 'builtin'; id: Builtin; on: boolean} | {kind: 'site'; q: SiteQ};

const SAMPLE: SiteQ[] = [
  {id: 'team', text: 'Missä tiimissä työskentelet?', hint: '', mode: 'both', choices: [
    {label: 'Tuotekehitys', prose: 'Työskentelen tuotekehitystiimissä.'},
    {label: 'Asiakastuki', prose: 'Työskentelen asiakastuessa. Kirjoita vastaukset niin, että voin välittää ne asiakkaalle.'},
    {label: 'Hallinto', prose: 'Työskentelen hallinnossa enkä ohjelmoi. Selitä tekniset asiat arkikielellä.'},
  ]},
  {id: 'publish', text: 'Saako agentti viedä muutoksia suoraan päähaaraan?', hint: 'Talon sääntö on, että muutokset kulkevat katselmoinnin kautta.', mode: 'choice', choices: [
    {label: 'Ei, aina katselmoinnin kautta', prose: 'Älä koskaan vie muutoksia suoraan päähaaraan. Tee oma haara ja avaa pull request katselmoitavaksi.'},
    {label: 'Omissa kokeiluissani saa', prose: 'Omissa kokeilurepoissani saat viedä muutokset suoraan päähaaraan. Muualla aina pull requestin kautta.'},
  ]},
  {id: 'projects', text: 'Mitä projekteja teet juuri nyt?', hint: 'Agentti osaa silloin etsiä oikeasta paikasta.', mode: 'free', choices: []},
];
const clone = <X,>(x: X): X => JSON.parse(JSON.stringify(x));
const builtinItem = (id: Builtin): Item => ({kind: 'builtin', id, on: true});
const initialItems = (site: SiteQ[]): Item[] => [
  builtinItem('lang'), builtinItem('style'), builtinItem('ask'),
  ...site.map((q) => ({kind: 'site' as const, q: clone(q)})),
  builtinItem('own'),
];
const builtinText = (id: Builtin) =>
  id === 'lang' ? note.askLang(note.langName.fi) : id === 'style' ? note.askStyle : id === 'ask' ? note.askAsk : note.askOwn;
const builtinChips = (id: Builtin) =>
  id === 'lang' ? ['fi', 'en', 'sv'].map((l) => note.langChip[l as 'fi']) : id === 'style' ? note.choices.style.map((c) => c.label) : id === 'ask' ? note.choices.ask.map((c) => c.label) : [];
const siteQs = (items: Item[]) => items.flatMap((i) => (i.kind === 'site' ? [i.q] : []));
const proseOf = (q: SiteQ, i: number) => q.choices[i]?.prose.trim() || `${q.text.trim().replace(/\?$/, '')}: ${q.choices[i]?.label ?? ''}.`;
/** The note itself is the record: an answer is there when its heading or one of its sentences is. */
const answered = (text: string, q: SiteQ) =>
  text.includes(`## ${q.text.trim()}`) || q.choices.some((c) => c.prose.trim() && text.includes(c.prose.trim()));

// The round's store per direction, so the person's side follows the
// administrator's edits when the view is switched.
const store: Item[][] = [initialItems(SAMPLE), initialItems(SAMPLE)];

// ---------- The note ----------
type SiteAnswer = {choice?: number; text?: string};
type Answers = {lang?: 'fi' | 'en' | 'sv'; style?: number; ask?: number; own?: string; site: Record<string, SiteAnswer>};

/** As production's noteText, with the site's answers between "kysy ensin" and
 * "omin sanoin": the chosen sentences first, then each free answer under its
 * question as a heading. */
function noteOf(a: Answers, questions: SiteQ[], name: string, existing?: string): string {
  const w = note.note;
  const chosen = questions.flatMap((q) => (a.site[q.id]?.choice !== undefined ? [proseOf(q, a.site[q.id].choice!)] : []));
  const free = questions.flatMap((q) => (a.site[q.id]?.text ? [`## ${q.text.trim()}\n\n${a.site[q.id].text}`] : []));
  const lines = [
    existing === undefined && name ? w.me(name) : '',
    [existing === undefined && a.lang ? note.langLine[a.lang] : '', a.style === undefined ? '' : note.choices.style[a.style].prose].filter(Boolean).join(' '),
    a.ask === undefined ? '' : note.choices.ask[a.ask].prose,
    chosen.join(' '),
    ...free,
    a.own ? `${w.own}\n\n${a.own}` : '',
  ].filter(Boolean);
  if (existing === undefined) return `${[w.title, ...lines].join('\n\n')}\n`;
  if (!lines.length) return existing;
  const gap = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${gap}${[w.titleAdded, ...lines].join('\n\n')}\n`;
}

/** The note an earlier member made before the site's last question existed. */
const earlierNote = () =>
  noteOf({lang: 'fi', style: 0, ask: 0, own: 'Teen tuotteen verkkosivuja ja opettelen Go-kieltä.', site: {team: {choice: 0}, publish: {choice: 0}}}, SAMPLE.slice(0, 2), PERSON_NAME);

// ---------- Shared pieces ----------
let toastSink: (m: string) => void = () => {};

function Bubble({who, text}: {who: 'agent' | 'me'; text: string}) {
  return who === 'agent' ? (
    <div data-testid="agent-reply">
      <AssistantMessage streamState="complete" sourceText={text} onCopy={() => {}}>
        <Markdown text={text} />
      </AssistantMessage>
    </div>
  ) : (
    <div data-testid="person-message">
      <UserMessage sourceText={text} onCopy={() => {}}>
        <Markdown text={text} breaks />
      </UserMessage>
    </div>
  );
}
const Asker = () => (
  <p className="rq-asker" data-testid="rq-asker"><Icon name="shield" aria-hidden="true" />{T.siteQ}</p>
);
const askText = (q: SiteQ) => (q.hint.trim() ? `${q.text}\n\n${q.hint}` : q.text);

function useSlot(host: RefObject<HTMLElement | null>, selector: string, tag: string, className: string, dep: unknown) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const target = host.current?.querySelector(selector);
    if (!target) return;
    const e = document.createElement(tag);
    e.className = className;
    target.append(e);
    setEl(e);
    return () => { e.remove(); setEl(null); };
  }, [dep]);
  return el;
}

// ---------- Administrator ----------
const DOC: OnboardingDocument = {
  repositories: {mode: 'preselected', defaults: ['example-org/product', 'example-org/handbook']},
  integrations: [{provider: 'google', required: false}],
  ai_account: {offer: 'chatgpt'},
};
const AVAILABILITY: ProviderAvailability = {google: true, microsoft: true, imap: true, caldav: true, carddav: true, dropbox: false};
// A step id no row carries: production then marks no row current while the round's row is selected.
const NO_STEP: OnboardingStep = 'integration:imap';

/** The selected question's preview: the bubble and answers as the person sees them. */
function Preview({q}: {q: SiteQ}) {
  const [picked, setPicked] = useState<number>();
  const [free, setFree] = useState('');
  const chips = q.mode === 'free' ? [] : q.choices.filter((c) => c.label.trim());
  return (
    <div className="rq-preview" data-testid="rq-preview">
      <p className="ob-lbl"><Icon name="eye" width={14} height={14} aria-hidden="true" />&nbsp;{T.personSees}</p>
      <div className="an-chat rq-mini">
        <Asker />
        <Bubble who="agent" text={q.text.trim() ? askText(q) : '…'} />
        {chips.length ? (
          <div className="an-chips" data-testid="rq-preview-chips">
            {chips.map((c, i) => (
              <ControlButton key={i} size="row" variant={picked === i ? 'primary' : 'secondary'} onPress={() => setPicked(i)}>{c.label}</ControlButton>
            ))}
            {q.mode === 'both' ? <ControlButton size="row" variant="secondary" onPress={() => setPicked(-1)}>{T.ownWordsChip}</ControlButton> : null}
          </div>
        ) : null}
        {q.mode === 'free' || picked === -1 ? (
          <TextArea label={T.answerLabel} rows={2} value={free} onChange={setFree} />
        ) : null}
      </div>
      {picked !== undefined && picked >= 0 ? (
        <p className="rq-lands" data-testid="rq-lands"><strong>{T.lands}</strong> {proseOf(q, picked)}</p>
      ) : q.mode !== 'choice' ? (
        <p className="rq-lands"><strong>{T.freeLands}</strong> <code>## {q.text.trim() || '…'}</code></p>
      ) : null}
    </div>
  );
}

function QuestionForm({q, onChange, onDone, onRemove}: {q: SiteQ; onChange: (q: SiteQ) => void; onDone: () => void; onRemove: () => void}) {
  const set = (patch: Partial<SiteQ>) => onChange({...q, ...patch});
  const setChoice = (i: number, patch: Partial<Choice>) => set({choices: q.choices.map((c, j) => (j === i ? {...c, ...patch} : c))});
  return (
    <div className="rq-form" data-testid="rq-form" data-question={q.id}>
      <TextField data-testid="rq-form-text" label={T.formText} value={q.text} onChange={(text) => set({text})} />
      <TextField data-testid="rq-form-hint" label={T.formHint} value={q.hint} onChange={(hint) => set({hint})} />
      <div className="rq-mode"><p className="ob-lbl">{T.formMode}</p>
      <Segmented data-testid="rq-form-mode" label={T.formMode} size="row" value={q.mode}
        options={(['choice', 'free', 'both'] as Mode[]).map((id) => ({id, label: T.modes[id]}))}
        onChange={(mode) => set({mode, choices: mode !== 'free' && q.choices.length === 0 ? [{label: '', prose: ''}, {label: '', prose: ''}] : q.choices})} /></div>
      {q.mode !== 'free' ? (
        <fieldset className="rq-choices" data-testid="rq-choices">
          <legend className="ob-lbl">{T.choicesLabel}</legend>
          {q.choices.map((c, i) => (
            <div className="rq-choice" key={i} data-testid="rq-choice">
              <TextField label={T.choiceLabel(i)} value={c.label} onChange={(label) => setChoice(i, {label})} />
              <TextField label={T.choiceProse} value={c.prose} onChange={(prose) => setChoice(i, {prose})} />
              <IconButton size="row" variant="quiet" className="rq-destructive" aria-label={T.removeChoice(i)} isDisabled={q.choices.length <= 1}
                onPress={() => set({choices: q.choices.filter((_, j) => j !== i)})}><Icon name="trash" aria-hidden="true" /></IconButton>
            </div>
          ))}
          <div>
            <ControlButton data-testid="rq-add-choice" size="row" variant="secondary" isDisabled={q.choices.length >= MAX_CHOICES}
              onPress={() => set({choices: [...q.choices, {label: '', prose: ''}]})}><Icon name="plus" aria-hidden="true" />{T.addChoice}</ControlButton>
          </div>
        </fieldset>
      ) : null}
      <Preview key={`${q.mode}`} q={q} />
      <div className="rq-form-acts">
        <ControlButton data-testid="rq-remove" size="row" variant="quiet" className="rq-destructive" onPress={onRemove}><Icon name="trash" aria-hidden="true" />{T.removeQ}</ControlButton>
        <ControlButton data-testid="rq-done" size="row" variant="primary" onPress={onDone}>{T.done}</ControlButton>
      </div>
    </div>
  );
}

function Mover({items, i, setItems, lo, hi, name}: {items: Item[]; i: number; setItems: (x: Item[]) => void; lo: number; hi: number; name: string}) {
  const move = (to: number) => { const x = [...items]; const [it] = x.splice(i, 1); x.splice(to, 0, it); setItems(x); };
  return (
    <>
      <IconButton data-testid="rq-up" size="row" variant="quiet" aria-label={`${T.up}: ${name}`} isDisabled={i <= lo} onPress={() => move(i - 1)}><Icon name="arrowUp" aria-hidden="true" /></IconButton>
      <IconButton data-testid="rq-down" size="row" variant="quiet" aria-label={`${T.down}: ${name}`} isDisabled={i >= hi} onPress={() => move(i + 1)}><Icon name="arrowDown" aria-hidden="true" /></IconButton>
    </>
  );
}

type EditProps = {items: Item[]; setItems: (x: Item[]) => void; editing?: string; setEditing: (id?: string) => void};

/** Finalises a question when its form closes: empty choices go, and a question with no words goes. */
function closeForm({items, setItems, setEditing}: EditProps, id: string) {
  setItems(items.flatMap((it) => {
    if (it.kind !== 'site' || it.q.id !== id) return [it];
    if (!it.q.text.trim()) return [];
    const choices = it.q.choices.filter((c) => c.label.trim());
    return [{...it, q: {...it.q, choices, mode: it.q.mode !== 'free' && !choices.length ? 'free' : it.q.mode}}];
  }));
  setEditing(undefined);
}
function addQuestion({items, setItems, setEditing}: EditProps, before: number) {
  const id = `q${Date.now() % 100000}`;
  const x = [...items];
  x.splice(before, 0, {kind: 'site', q: {id, text: '', hint: '', mode: 'choice', choices: [{label: '', prose: ''}, {label: '', prose: ''}]}});
  setItems(x);
  setEditing(id);
}
const formFor = (p: EditProps, q: SiteQ) => (
  <QuestionForm q={q}
    onChange={(nq) => p.setItems(p.items.map((it) => (it.kind === 'site' && it.q.id === q.id ? {...it, q: nq} : it)))}
    onDone={() => closeForm(p, q.id)}
    onRemove={() => { p.setItems(p.items.filter((it) => !(it.kind === 'site' && it.q.id === q.id))); p.setEditing(undefined); }} />
);

/** 1 Lisäkysymykset: Habitat's questions fixed and plain, the site's own in their place between them. */
function ListEditor(p: EditProps) {
  const {items} = p;
  const sites = items.map((it, i) => (it.kind === 'site' ? i : -1)).filter((i) => i >= 0);
  const lo = sites[0] ?? 0, hi = sites.at(-1) ?? 0;
  const ownAt = items.findIndex((it) => it.kind === 'builtin' && it.id === 'own');
  let n = 0;
  return (
    <>
      <p className="ob-lbl">{T.listLabel}</p>
      <ol className="rq-qlist" data-testid="rq-qlist">
        {items.map((it, i) => {
          n += 1;
          if (it.kind === 'builtin')
            return (
              <li key={it.id} className="rq-q rq-q-fixed" data-testid={`rq-q-${it.id}`} data-kind="builtin">
                <span className="rq-qnum" aria-hidden="true">{n}</span>
                <span className="rq-qtext"><strong>{builtinText(it.id)}</strong><small>{it.id === 'own' ? T.alwaysLast : T.habitat}</small></span>
              </li>
            );
          if (p.editing === it.q.id) return <li key={it.q.id} className="rq-q rq-q-edit" data-kind="site">{formFor(p, it.q)}</li>;
          return (
            <li key={it.q.id} className="rq-q" data-testid={`rq-q-${it.q.id}`} data-kind="site">
              <span className="rq-qnum" aria-hidden="true">{n}</span>
              <span className="rq-qtext"><strong>{it.q.text}</strong><small><Icon name="shield" width={12} height={12} aria-hidden="true" /> {T.modeSummary(it.q)}</small></span>
              <span className="rq-qacts">
                <Mover items={items} i={i} setItems={p.setItems} lo={lo} hi={hi} name={it.q.text} />
                <ControlButton data-testid="rq-edit" size="row" variant="secondary" onPress={() => p.setEditing(it.q.id)}>{T.edit}</ControlButton>
              </span>
            </li>
          );
        })}
      </ol>
      {sites.length === 0 ? <p className="ob-muted" data-testid="rq-none">{T.noneYet}</p> : null}
      <div className="rq-addrow">
        <ControlButton data-testid="rq-add" size="row" variant="secondary" isDisabled={sites.length >= MAX_QUESTIONS || p.editing !== undefined}
          onPress={() => addQuestion(p, ownAt)}><Icon name="plus" aria-hidden="true" />{T.add}</ControlButton>
        {sites.length >= MAX_QUESTIONS ? <span className="ob-muted">{T.max}</span> : null}
      </div>
    </>
  );
}

/** 2 Koko keskustelu: the conversation as the person sees it; every question is a turn the administrator can move. */
function ConversationEditor(p: EditProps) {
  const {items} = p;
  const ownAt = items.findIndex((it) => it.kind === 'builtin' && it.id === 'own');
  const sites = siteQs(items).length;
  return (
    <>
      <p className="ob-muted">{T.panelLead2}</p>
      <div className="an-chat rq-convo" data-testid="rq-convo">
        <Bubble who="agent" text={note.hello('Aino')} />
        {items.map((it, i) => {
          const id = it.kind === 'site' ? it.q.id : it.id;
          const off = it.kind === 'builtin' && !it.on;
          if (it.kind === 'site' && p.editing === it.q.id)
            return <div key={id} className="rq-turn rq-turn-edit" data-kind="site">{formFor(p, it.q)}</div>;
          const text = it.kind === 'site' ? askText(it.q) : builtinText(it.id);
          const chips = it.kind === 'site' ? (it.q.mode === 'free' ? [] : [...it.q.choices.map((c) => c.label), ...(it.q.mode === 'both' ? [T.ownWordsChip] : [])]) : builtinChips(it.id);
          const isOwn = it.kind === 'builtin' && it.id === 'own';
          return (
            <div key={id} className="rq-turn" data-testid={`rq-q-${id}`} data-kind={it.kind} data-off={off || undefined}>
              {it.kind === 'site' ? <Asker /> : <p className="rq-asker rq-asker-habitat">{off ? T.hidden : isOwn ? T.alwaysLast : T.habitat}</p>}
              <div className="rq-turn-body">
                <Bubble who="agent" text={text} />
                {chips.length ? <div className="rq-pills" aria-hidden="true">{chips.map((c) => <span key={c} className="rq-pill">{c}</span>)}</div> : null}
                {isOwn || (it.kind === 'site' && it.q.mode === 'free') ? <div className="rq-pills" aria-hidden="true"><span className="rq-pill rq-pill-field">{T.answerLabel}…</span></div> : null}
              </div>
              <div className="rq-turn-acts">
                {isOwn ? null : <Mover items={items} i={i} setItems={p.setItems} lo={0} hi={ownAt - 1} name={it.kind === 'site' ? it.q.text : builtinText(it.id)} />}
                {it.kind === 'site' ? (
                  <ControlButton data-testid="rq-edit" size="row" variant="secondary" onPress={() => p.setEditing(it.q.id)}>{T.edit}</ControlButton>
                ) : (
                  <ControlButton data-testid="rq-toggle" size="row" variant="quiet" onPress={() => p.setItems(items.map((x, j) => (j === i && x.kind === 'builtin' ? {...x, on: !x.on} : x)))}>
                    <Icon name={off ? 'eye' : 'eyeOff'} aria-hidden="true" />{off ? T.showQ : T.hide}
                  </ControlButton>
                )}
              </div>
              {i === ownAt - 1 ? (
                <div className="rq-addrow rq-addrow-convo">
                  <ControlButton data-testid="rq-add" size="row" variant="secondary" isDisabled={sites >= MAX_QUESTIONS || p.editing !== undefined}
                    onPress={() => addQuestion(p, ownAt)}><Icon name="plus" aria-hidden="true" />{T.add}</ControlButton>
                  {sites >= MAX_QUESTIONS ? <span className="ob-muted">{T.max}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <Bubble who="agent" text={T.readyBubble} />
      </div>
    </>
  );
}

function NotePanel({d, ...p}: EditProps & {d: number}) {
  return (
    <section className="ob-config rq-cfg" data-step="instructions" data-testid="rq-note-panel" aria-label={`${T.step}: asetukset`}>
      <p className="ob-eyebrow">{T.yourSettings}</p>
      <h3>{T.step}</h3>
      <p className="ob-muted">{T.panelLead}</p>
      {d === 0 ? <ListEditor {...p} /> : <ConversationEditor {...p} />}
      <p className="rq-after" data-testid="rq-after"><Icon name="info" width={14} height={14} aria-hidden="true" /><span>{T.after}</span></p>
    </section>
  );
}

function routeNumber(doc: OnboardingDocument) {
  return 1 + (doc.repositories.mode === 'skip' ? 0 : 1) + doc.integrations.filter((i) => AVAILABILITY[i.provider] === true).length + (doc.ai_account.offer === 'site_key' ? 0 : 1) + 1;
}

function AdminPage({d, s}: {d: number; s: string}) {
  const [items, setItemsState] = useState<Item[]>(store[d]);
  const setItems = (x: Item[]) => { store[d] = x; setItemsState(x); };
  const [editing, setEditing] = useState<string | undefined>(s === 'muokkaa' ? 'team' : undefined);
  const [sel, setSel] = useState(true);
  const [step, setStep] = useState<OnboardingStep>(NO_STEP);
  const [doc, setDoc] = useState(DOC);
  const [preview, setPreview] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const row = useSlot(page, '.ob-steplist', 'li', 'rq-row', 0);
  const card = useSlot(page, '.ob-cfg-card', 'div', 'rq-slot', preview);
  useEffect(() => { if (s === 'lisaa') addQuestion({items, setItems, editing, setEditing}, items.findIndex((it) => it.kind === 'builtin' && it.id === 'own')); }, []);
  const sites = siteQs(items).length;
  const asked = items.filter((it) => it.kind === 'site' || it.on).length;
  const hidden = items.length - asked;
  const hint = d === 0 ? (sites ? T.hintSite(sites) : T.hintNone) : T.hintAll(asked, hidden);
  return (
    <div className="rq-page rq-admin" data-testid="rq-page" data-side="admin" data-rq-note={sel || undefined} ref={page}>
      <p className="rq-kicker">{T.adminKicker}</p>
      <h1 className="rq-h">{T.adminTitle}</h1>
      <OnboardingSettings doc={doc} availability={AVAILABILITY} step={step}
        onStep={(x) => { setSel(false); setStep(x); }} onChange={setDoc}
        onAddRepository={() => toastSink(T.notInRound)} save={{kind: 'idle'}} onReload={() => {}}
        preview={preview} onPreview={setPreview} host="habitat.example" />
      {row && createPortal(
        <button type="button" data-testid="onboarding-route-instructions" data-shown="true" aria-current={sel ? 'step' : undefined}
          onClick={() => { setSel(true); setStep(NO_STEP); }}>
          <span className="ob-num" aria-hidden="true">{routeNumber(doc)}</span>
          <span className="ob-txt"><strong>{T.step}</strong><small data-testid="onboarding-route-instructions-hint">{hint}</small></span>
        </button>, row)}
      {card && sel && !preview && createPortal(<NotePanel d={d} items={items} setItems={setItems} editing={editing} setEditing={setEditing} />, card)}
    </div>
  );
}

// ---------- Person ----------
type Q = {k: 'lang' | 'style' | 'ask' | 'own' | 'tidy'} | {k: 'site'; q: SiteQ};
type Msg = {id: number; who: 'agent' | 'me'; text: string; site?: boolean};

function queueOf(items: Item[], existing?: string, onlyMissing = false): Q[] {
  return items.flatMap((it): Q[] => {
    if (it.kind === 'site') return existing !== undefined && answered(existing, it.q) ? [] : [{k: 'site', q: it.q}];
    if (!it.on || onlyMissing) return [];
    if (existing !== undefined && it.id === 'lang') return [];
    return [{k: it.id}];
  });
}

function FreeAnswer({label, hint, onSubmit, onSkip}: {label: string; hint?: string; onSubmit: (s: string) => void; onSkip: () => void}) {
  const [v, setV] = useState('');
  return (
    <div className="an-own" data-testid="own-step">
      <TextArea data-testid="own-field" label={label} hint={hint} placeholder={label === note.ownTitle ? note.ownPlaceholder : undefined} rows={3} value={v} onChange={setV} />
      <div className="an-own-actions">
        <ControlButton size="row" variant="quiet" data-testid="own-skip" onPress={onSkip}>{note.ownSkip}</ControlButton>
        <ControlButton size="row" variant="primary" data-testid="own-submit" isDisabled={!v.trim()} onPress={() => v.trim() && onSubmit(v.trim())}>{note.ownAdd}</ControlButton>
      </div>
    </div>
  );
}

/** The note conversation, built as production's AgentNoteStep with the site's questions in it. */
function NoteChat({queue0, existing, settings, hello, questions, onSaved, onLater}: {
  queue0: Q[]; existing?: string; settings?: boolean; hello: string; questions: SiteQ[]; onSaved: (text: string) => void; onLater: () => void;
}) {
  const has = existing !== undefined;
  const [answers, setAnswers] = useState<Answers>({site: {}});
  const [queue, setQueue] = useState<Q[]>(queue0);
  const [pendingOwn, setPendingOwn] = useState<string>();
  const [freeOpen, setFreeOpen] = useState(false);
  const seq = useRef(2);
  const [msgs, setMsgs] = useState<Msg[]>([{id: 1, who: 'agent', text: hello}]);
  const say = (...m: Omit<Msg, 'id'>[]) => setMsgs((old) => [...old, ...m.map((x) => ({...x, id: seq.current++}))]);
  const q = queue[0];
  const done = queue.length === 0;
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = thread.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, q]);
  const advance = (rest: Q[], extra: Omit<Msg, 'id'>[] = []) => {
    setQueue(rest); setFreeOpen(false);
    say(...extra, ...(rest.length === 0 ? [{who: 'agent' as const, text: has ? note.readyExisting : note.ready}] : []));
  };
  const langs = ['fi', 'en', 'sv'] as const;
  const site = (id: string, a: SiteAnswer) => setAnswers((o) => ({...o, site: {...o.site, [id]: a}}));
  const choose = (i: number) => {
    const rest = queue.slice(1);
    if (!q) return;
    if (q.k === 'lang') { setAnswers((o) => ({...o, lang: langs[i]})); return advance(rest, [{who: 'me', text: note.langChip[langs[i]]}]); }
    if (q.k === 'style') { setAnswers((o) => ({...o, style: i})); return advance(rest, [{who: 'me', text: note.choices.style[i].label}]); }
    if (q.k === 'ask') { setAnswers((o) => ({...o, ask: i})); return advance(rest, [{who: 'me', text: note.choices.ask[i].label}]); }
    if (q.k === 'site') { site(q.q.id, {choice: i}); return advance(rest, [{who: 'me', text: q.q.choices[i].label}]); }
    if (q.k === 'tidy') {
      const use = i === 1;
      if (use && pendingOwn) setAnswers((o) => ({...o, own: pendingOwn}));
      setPendingOwn(undefined);
      return advance(rest, [{who: 'me', text: use ? note.tidyUse : note.tidyKeep}, {who: 'agent', text: use ? note.tidyUsed : note.tidyKept}]);
    }
  };
  const ownArrives = (raw: string) => {
    const rest = queue.slice(1);
    setAnswers((o) => ({...o, own: raw}));
    const fixed = tidyOwnWords(raw);
    if (fixed !== raw) { setPendingOwn(fixed); setQueue([{k: 'tidy'}, ...rest]); say({who: 'me', text: raw}); }
    else advance(rest, [{who: 'me', text: raw}, {who: 'agent', text: note.ownAdded}]);
  };
  const ask = (x: Q): string =>
    x.k === 'site' ? askText(x.q) : x.k === 'tidy' ? `${note.tidy}\n\n> ${(pendingOwn ?? '').replace(/\n/g, '\n> ')}` : builtinText(x.k);
  const chips = (x: Q): {label: string; primary?: boolean}[] =>
    x.k === 'lang' ? langs.map((l, i) => ({label: note.langChip[l], primary: i === 0}))
      : x.k === 'tidy' ? [{label: note.tidyKeep}, {label: note.tidyUse}]
        : x.k === 'style' ? note.choices.style.map((c) => ({label: c.label}))
          : x.k === 'ask' ? note.choices.ask.map((c) => ({label: c.label}))
            : x.k === 'site' && x.q.mode !== 'free' ? x.q.choices.map((c) => ({label: c.label})) : [];
  const text = noteOf(answers, questions, PERSON_NAME, existing);
  const later = <ControlButton data-testid="step-later" size="row" variant="quiet" onPress={onLater}>{has ? note.keep : note.later}</ControlButton>;
  const freeHere = q && (q.k === 'own' || (q.k === 'site' && (q.q.mode === 'free' || freeOpen)));
  return (
    <section className="ah-onboarding-step an-step" data-testid="instructions-step" data-revealed={done} aria-labelledby="an-step-title">
      <header>
        {settings ? null : <p className="ah-eyebrow">{note.eyebrow}</p>}
        <h1 id="an-step-title" data-testid="instructions-title" tabIndex={-1}>{settings ? note.titleSettings : note.title}</h1>
        <p>{has ? note.leadExisting : note.lead}</p>
      </header>
      <div className="an-chat" data-testid="step-chat">
        <div className="an-thread" ref={thread} data-testid="step-thread" role="log" aria-label={note.thread}>
          {msgs.map((m) => <div key={m.id}>{m.site ? <Asker /> : null}<Bubble who={m.who} text={m.text} /></div>)}
          {q ? <div data-testid="current-question" data-kind={q.k}>{q.k === 'site' ? <Asker /> : null}<Bubble who="agent" text={ask(q)} /></div> : null}
        </div>
        {q && !freeHere && chips(q).length ? (
          <fieldset className="an-chips" aria-label={note.replies} data-testid="quick-replies" data-question={q.k === 'site' ? q.q.id : q.k}>
            {chips(q).map((c, i) => (
              <ControlButton key={c.label} size="row" variant={c.primary ? 'primary' : 'secondary'} data-testid="quick-reply" onPress={() => choose(i)}>{c.label}</ControlButton>
            ))}
            {q.k === 'site' && q.q.mode === 'both' ? <ControlButton size="row" variant="secondary" data-testid="quick-own" onPress={() => setFreeOpen(true)}>{T.ownWordsChip}</ControlButton> : null}
            {q.k === 'site' ? <ControlButton size="row" variant="quiet" data-testid="quick-skip" onPress={() => advance(queue.slice(1), [{who: 'me', text: T.skipped}])}>{T.skip}</ControlButton> : null}
          </fieldset>
        ) : null}
        {q && freeHere ? (
          q.k === 'own'
            ? <FreeAnswer key="own" label={note.ownTitle} hint={note.ownLead} onSubmit={ownArrives} onSkip={() => advance(queue.slice(1), [{who: 'me', text: note.ownSkipped}])} />
            : q.k === 'site' ? <FreeAnswer key={q.q.id} label={T.answerLabel} onSubmit={(v) => { site(q.q.id, {text: v}); advance(queue.slice(1), [{who: 'me', text: v}, {who: 'agent', text: T.added}]); }}
                onSkip={() => advance(queue.slice(1), [{who: 'me', text: T.skipped}])} /> : null
        ) : null}
      </div>
      {done ? (
        <div className="an-reveal" data-testid="reveal">
          <p className="an-reveal-label"><Icon name="paperclip" aria-hidden="true" />{note.noteLabel}</p>
          <InstructionsEditor value={text} origin={existing ?? ''} label={note.editorLabel} keptPrefix={existing} alwaysSavable
            saveLabel={has ? note.saveMerge : note.save} onSave={async (t) => { onSaved(t); return {ok: true}; }} secondary={later} />
        </div>
      ) : (
        <div className="ah-onboarding-actions">{later}<span /></div>
      )}
    </section>
  );
}

function PersonOnboarding({d}: {d: number}) {
  const items = store[d];
  return (
    <div className="rq-person-onb" data-testid="rq-page" data-side="person">
      <OnboardingRoute steps={[{id: 'github', note: 'Kirjautunut'}, {id: 'repositories', note: '2 repoa'}, {id: 'ai', note: 'ChatGPT'}, {id: 'instructions'}]}>
        <OnboardingFrame step="instructions">
          <NoteChat queue0={queueOf(items)} hello={note.hello('Aino')} questions={siteQs(items)}
            onSaved={() => toastSink(T.saved)} onLater={() => toastSink(T.later)} />
        </OnboardingFrame>
      </OnboardingRoute>
    </div>
  );
}

function PersonSettings({d}: {d: number}) {
  const items = store[d];
  const [file, setFile] = useState(earlierNote);
  const [chat, setChat] = useState<'missing' | 'all' | null>(null);
  const missing = siteQs(items).filter((q) => !answered(file, q));
  if (chat)
    return (
      <div className="rq-page" data-testid="rq-page" data-side="person">
        <p className="rq-kicker">{T.personKicker}</p>
        <div className="ai-settings">
          <NoteChat settings existing={file} questions={siteQs(items)}
            queue0={queueOf(items, file, chat === 'missing')}
            hello={chat === 'missing' ? T.helloMissing('Aino', missing.length) : note.helloExisting('Aino')}
            onSaved={(t) => { setFile(t); toastSink(T.saved); setChat(null); }} onLater={() => setChat(null)} />
        </div>
      </div>
    );
  return (
    <div className="rq-page" data-testid="rq-page" data-side="person">
      <p className="rq-kicker">{T.personKicker}</p>
      <h1 className="rq-h">{ai.heading}</h1>
      <div className="ai-settings" data-testid="agent-instructions-settings">
        <p className="s-intro">{ai.intro}</p>
        {missing.length ? (
          <div data-testid="rq-waiting">
            <InlineNotice tone="info" title={T.waiting(missing.length)} description={missing.map((q) => q.text).join(' · ')}
              actions={[{label: T.answer, onPress: () => setChat('missing')}]} />
          </div>
        ) : null}
        <InstructionsEditor data-testid="instructions-editor" value={file} label={ai.editorLabel}
          onSave={async (t) => { setFile(t); return {ok: true}; }}
          secondary={<ControlButton data-testid="instructions-with-agent" size="row" variant="secondary" onPress={() => setChat('all')}>{ai.editWithAgent}</ControlButton>} />
      </div>
    </div>
  );
}

// ---------- Review chrome ----------
type View = 'admin' | 'person';
const SCEN: Record<View, string[]> = {admin: ['lista', 'tyhja', 'muokkaa', 'lisaa'], person: ['kaytto', 'uusi']};
const current = {view: (params.get('view') === 'person' ? 'person' : 'admin') as View, s: params.get('s') ?? ''};
function resetStore(d: number, s: string) { store[d] = initialItems(s === 'tyhja' ? [] : SAMPLE); }
if (current.view === 'admin' && current.s === 'tyhja') { resetStore(0, 'tyhja'); resetStore(1, 'tyhja'); }

function App({direction}: {direction: number}) {
  const [view, setView] = useState<View>(current.view);
  const [s, setS] = useState<string>(SCEN[current.view].includes(current.s) ? current.s : SCEN[current.view][0]);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState('');
  const bar = useRef<HTMLElement>(null);
  toastSink = setMessage;
  useEffect(() => { current.view = view; current.s = s; }, [view, s]);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.lang = 'fi'; }, []);
  useEffect(() => { if (!message) return; const id = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(id); }, [message]);
  const relaunch = (key: string, value: string) => {
    const p = new URLSearchParams(location.search);
    p.set(key, value); p.set('v', String(direction + 1)); p.set('view', view); p.set('s', s);
    location.search = p.toString();
  };
  const pickScenario = (x: string) => { if (view === 'admin') resetStore(direction, x); setS(x); setGeneration((g) => g + 1); };
  const switchView = (v: View) => { setView(v); setS(SCEN[v][0]); setGeneration((g) => g + 1); };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-view={view} data-scenario={s}>
      <header className="rq-bar" ref={bar}>
        <strong className="rq-title">{T.title}</strong>
        <div className="rq-views" role="group" aria-label={T.view} data-testid="rq-views">
          {(['admin', 'person'] as View[]).map((v) => (
            <button key={v} type="button" data-testid={`rq-view-${v}`} aria-pressed={view === v} onClick={() => switchView(v)}>
              <Icon name={v === 'admin' ? 'shield' : 'user'} />{T.views[v]}
            </button>
          ))}
        </div>
        <label>{T.show} <select data-testid="rq-scenario" value={s} onChange={(e) => pickScenario(e.target.value)}>
          {SCEN[view].map((id) => <option key={id} value={id}>{T.scenarios[id]}</option>)}
        </select></label>
        <label>{T.theme} <select data-testid="rq-theme" value={theme} onChange={(e) => relaunch('theme', e.target.value)}>
          <option value="light">{T.themes.light}</option><option value="dark">{T.themes.dark}</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => pickScenario(s)}>{T.reset}</button>
        <p className="rq-line" data-testid="direction-line">{T.lines[direction]}{view === 'person' ? ` ${T.personSame}` : ''}</p>
      </header>
      <div className="rq-stage">
        {view === 'admin' ? <AdminPage key={`${generation}-${s}`} d={direction} s={s} />
          : s === 'kaytto' ? <PersonOnboarding key={`${generation}-${s}`} d={direction} />
            : <PersonSettings key={`${generation}-${s}`} d={direction} />}
      </div>
      {message ? <p className="rq-toast" role="status" data-testid="rq-toast">{message}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
const stageSink = {set innerHTML(view: ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
const startAt = Math.max(0, Math.min(NAMES.length - 1, Number(params.get('v') ?? 1) - 1 || 0));
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n;
  if (i === startAt) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
