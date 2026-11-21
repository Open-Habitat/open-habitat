// Explain mode feedback (issue explain-mode-feedback). One axis: where the
// person gives feedback on an explanation. The cards, the bar, the layer and
// their CSS are production's (ExplainMode.css, text/explainMode.ts); the
// conversation under the mode is a small synthetic view, and the explain
// layer is a simplified copy of ExplainLayer (no waiting presses, no state
// card), because the feedback is the only thing that differs.
import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/ExplainMode.css';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {explainModeText} from '../../../../web/src/text/explainMode';
import {CHOICES, type Choice, type Lang, NAMES, SCENARIO_IDS, type Scenario, TEXT, type Text, type View} from './text';
import './round.css';

type CardId = 'X05' | 'Y03' | 'Y04' | 'Y05' | 'Y06' | 'V01' | 'V02' | 'V06';
type Fb = {key: number; id: CardId; choice: Choice; note: string; ago: 'now' | 'd1' | 'd3'};
type Rect = {x: number; y: number; w: number; h: number};

const params = new URLSearchParams(location.search);
let lang: Lang = params.get('lang') === 'en' ? 'en' : 'fi';
let scenario: Scenario = SCENARIO_IDS.includes(params.get('s') as Scenario) ? params.get('s') as Scenario : 'giving';
let view: View = params.get('view') === 'where' ? 'where' : 'mode';
let theme = ['dark', 'contrast'].includes(params.get('theme') ?? '') ? params.get('theme')! : 'light';
setPersonalLanguage(lang);

const cards = (l: Lang) => explainModeText[l].cards as Record<CardId, {name: string; lead: string; know?: string; try?: string}>;
const kinds = (l: Lang) => explainModeText[l].kinds as Record<string, string>;
const KIND: Record<CardId, string> = {X05: 'once', Y03: 'info', Y04: 'panel', Y05: 'panel', Y06: 'menu', V01: 'input', V02: 'once', V06: 'once'};
const KEY: Partial<Record<CardId, string>> = {V06: 'Enter'};
let fbKey = 10;
const seed = (): Fb[] => [
  {key: 1, id: 'V02', choice: 'wrong', note: lang === 'fi' ? 'Puhelimella tiedostoja ei voi vetää kenttään.' : 'On a phone you cannot drag files into the field.', ago: 'd1'},
  {key: 2, id: 'X05', choice: 'helped', note: '', ago: 'd3'},
];
const NOTE: Record<Lang, string> = {
  fi: 'Kauanko tiivistys kestää, ja huomaanko sen keskustelussa?',
  en: 'How long does compaction take, and will I notice it in the conversation?',
};

/* ---------- the synthetic conversation under the mode ---------- */
function Conversation({x, onToggle, modeOn}: {x: Text; onToggle: () => void; modeOn: boolean}) {
  return (
    <div className="ef-conv">
      <header className="ef-head">
        <span className="ef-title"><b>{x.convTitle}</b><code>{x.workspace}</code></span>
        <span className="ef-dot" data-card="Y03" title="" aria-label="●"><i /></span>
        <span className="ef-chip" data-card="Y04"><Icon name="branch" /><code>main</code> ↑1 · 3</span>
        <span className="ef-ring" data-card="Y05" aria-label="42 %"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><circle cx="10" cy="10" r="7.5" className="ef-ring-fill" pathLength="100" strokeDasharray="42 100" /></svg><span>42 %</span></span>
        <span className="ef-chip ef-model" data-card="Y06">{x.model}</span>
        <button type="button" className="ef-q ah-explain-toggle" data-card="X05" data-testid="explain-toggle" aria-pressed={modeOn} onClick={onToggle}><span className="ah-explain-q">?</span></button>
      </header>
      <ol className="ef-feed">
        <li className="ef-user">{x.user}</li>
        <li className="ef-agent">{x.agent}</li>
      </ol>
      <div className="ef-composer">
        <div className="ef-field" data-card="V01" data-testid="message-input">{x.placeholder}</div>
        <div className="ef-tools">
          <button type="button" className="ef-tool" data-card="V02" aria-label="📎"><Icon name="paperclip" /></button>
          <button type="button" className="ef-send" data-card="V06" aria-label="↑"><Icon name="arrowUp" /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------- feedback pieces ---------- */
function Choices({x, value, onPick, testid}: {x: Text; value?: Choice; onPick: (c: Choice) => void; testid: string}) {
  return (
    <div className="ef-choices" role="radiogroup" aria-label={x.ask} data-testid={testid}>
      {CHOICES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className="ef-choice" data-choice={c} data-testid={`${testid}-${c}`} onClick={() => onPick(c)}>
          <Icon name={c === 'helped' ? 'check' : c === 'wrong' ? 'cross' : 'plus'} aria-hidden="true" />{x.choice[c]}
        </button>
      ))}
    </div>
  );
}

function NoteForm({x, choice, note, setNote, onSave, onCancel, testid}: {x: Text; choice: Choice; note: string; setNote: (s: string) => void; onSave: () => void; onCancel?: () => void; testid: string}) {
  return (
    <div className="ef-note" data-testid={testid}>
      <textarea aria-label={x.noteLabel} placeholder={x.notePlaceholder[choice]} value={note} rows={2} maxLength={280} onChange={(e) => setNote(e.target.value)} data-testid={`${testid}-text`} />
      <div className="ef-note-row">
        <ControlButton size="row" variant="primary" onPress={onSave} data-testid={`${testid}-save`}>{x.save}</ControlButton>
        {onCancel ? <ControlButton size="row" variant="quiet" onPress={onCancel} data-testid={`${testid}-cancel`}>{x.cancel}</ControlButton> : null}
      </div>
      <p className="ef-kept"><Icon name="lock" aria-hidden="true" />{x.keptHere}</p>
    </div>
  );
}

function WhereLink({x, go}: {x: Text; go: () => void}) {
  return <button type="button" className="ef-link" data-testid="where-link" onClick={go}>{x.whereLink}</button>;
}

/* ---------- the mode: layer, card, bar ---------- */
type ModeProps = {
  dir: number; x: Text; l: Lang; s: Scenario;
  saved: Fb[]; add: (f: Omit<Fb, 'key' | 'ago'>) => void;
  say: (t: string) => void; goWhere: () => void;
};

const rectOf = (el: Element): Rect => { const r = el.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; };

function Mode({dir, x, l, s, saved, add, say, goWhere}: ModeProps) {
  const initialOn = !(dir === 2 && s === 'done');
  const [on, setOn] = useState(initialOn);
  const [target, setTarget] = useState<CardId | null>(dir === 2 && s === 'giving' ? null : initialOn ? (dir === 1 && s === 'giving' ? null : 'Y05') : null);
  const [seen, setSeen] = useState<CardId[]>(s === 'giving' ? (dir === 2 ? ['V06', 'V01', 'Y04', 'Y05'] : ['V01', 'Y04', 'Y05']).reverse() : s === 'pointing' || s === 'done' ? ['Y05'] : []);
  // A: the card's own form; B: the bar's sheet; C: the end sheet.
  const [aChoice, setAChoice] = useState<Choice | undefined>(dir === 0 && s === 'giving' ? 'missing' : undefined);
  const [aNote, setANote] = useState(dir === 0 && s === 'giving' ? NOTE[l] : '');
  const [aEdit, setAEdit] = useState(false);
  const [thanks, setThanks] = useState<CardId | null>(dir === 0 && s === 'done' ? 'Y05' : null);
  const [sheet, setSheet] = useState(dir === 1 && s === 'giving');
  const [bCard, setBCard] = useState<CardId | undefined>(dir === 1 && s === 'giving' ? 'Y05' : undefined);
  const [bChoice, setBChoice] = useState<Choice | undefined>(dir === 1 && s === 'giving' ? 'missing' : undefined);
  const [bNote, setBNote] = useState(dir === 1 && s === 'giving' ? NOTE[l] : '');
  const [session, setSession] = useState(s === 'done' ? 1 : 0);
  const [end, setEnd] = useState(dir === 2 && s === 'giving');
  const [marks, setMarks] = useState<Partial<Record<CardId, Choice>>>(dir === 2 && s === 'giving' ? {Y05: 'missing', V06: 'helped'} : {});
  const [endNote, setEndNote] = useState(dir === 2 && s === 'giving' ? NOTE[l] : '');
  const [never, setNever] = useState(false);
  const [touch, setTouch] = useState(() => matchMedia('(hover: none)').matches);
  const [, tick] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const pinned = (dir === 0 && !!aChoice && aChoice !== 'helped') || sheet || end;
  const live = useRef({pinned, target});
  live.current = {pinned, target};

  useEffect(() => {
    if (s === 'done' && dir !== 0) say(x.savedToast(1));
  }, []);
  const point = (id: CardId | null) => {
    if (id === live.current.target) return;
    setTarget(id); setThanks(null); setAEdit(false);
    if (dir === 0) { setAChoice(undefined); setANote(''); }
    if (id) setSeen((v) => [id, ...v.filter((k) => k !== id)].slice(0, 6));
  };
  // Pointing: a simplified ExplainLayer.hit. A card that takes the pointer
  // (A on a desktop, every card on a touch screen) keeps itself shown.
  useEffect(() => {
    if (!on) return;
    const partAt = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el || el.closest('.ah-explain-ui, [data-explain-own], .rq-bar, .proto-picker')) return 'own';
      return (el.closest('.ef-stage [data-card]')?.getAttribute('data-card') as CardId) ?? null;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || live.current.pinned) return;
      setTouch(false);
      const id = partAt(e);
      if (id && id !== 'own') point(id);
    };
    const down = (e: PointerEvent) => {
      const t = e.pointerType === 'touch';
      setTouch(t);
      if (!t || live.current.pinned) return;
      const id = partAt(e);
      if (id === 'own') return;
      if (id) { e.preventDefault(); point(id); }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (live.current.pinned) { setAChoice(undefined); setSheet(false); return; }
      stop();
    };
    const re = () => tick((n) => n + 1);
    addEventListener('pointermove', move, {passive: true});
    addEventListener('pointerdown', down, true);
    addEventListener('keydown', key);
    addEventListener('resize', re);
    addEventListener('scroll', re, true);
    return () => {
      removeEventListener('pointermove', move); removeEventListener('pointerdown', down, true);
      removeEventListener('keydown', key); removeEventListener('resize', re); removeEventListener('scroll', re, true);
    };
  }, [on, dir]);

  const reallyStop = () => { setOn(false); setTarget(null); setEnd(false); };
  const stop = () => {
    if (dir === 2 && seen.length && !never) { setTarget(null); setEnd(true); return; }
    reallyStop();
  };
  const start = () => { setOn(true); setSeen([]); setMarks({}); setEndNote(''); };

  const el = target ? document.querySelector(`.ef-stage [data-card="${target}"]`) : null;
  const rect = el ? rectOf(el) : null;
  const top = bar.current ? bar.current.getBoundingClientRect().bottom : 0;
  useLayoutEffect(() => {
    tick((n) => n + 1);
  }, [on]);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--ef-bar-bottom', `${top}px`);
  });
  useLayoutEffect(() => {
    const c = card.current;
    if (!c || !rect) return;
    const w = c.offsetWidth, h = c.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 10;
    let x0 = Math.min(Math.max(8, rect.x + rect.w / 2 - w / 2), vw - w - 8);
    let y0 = rect.y + rect.h + gap;
    if (y0 + h > vh - 8) y0 = rect.y - h - gap;
    if (y0 < top + 8) y0 = Math.min(vh - h - 8, Math.max(top + 8, rect.y + rect.h + gap));
    c.style.left = `${Math.round(x0)}px`; c.style.top = `${Math.round(y0)}px`;
  });

  const mine = (id: CardId) => saved.find((f) => f.id === id && f.ago === 'now');
  const saveA = (choice: Choice, note: string) => {
    if (!target) return;
    add({id: target, choice, note: note.trim()});
    setAChoice(undefined); setANote(''); setAEdit(false); setThanks(target); setSession((n) => n + 1);
  };
  const saveB = () => {
    if (!bCard || !bChoice) return;
    add({id: bCard, choice: bChoice, note: bChoice === 'helped' ? '' : bNote.trim()});
    setSheet(false); setBChoice(undefined); setBNote(''); setSession((n) => n + 1); say(x.savedToast(1));
  };
  const saveC = () => {
    // The one note goes with the first card that is not "helped" (else the
    // first marked card); a note without marks is "missing" on the latest card.
    const entries = (Object.entries(marks) as [CardId, Choice | undefined][]).filter((e): e is [CardId, Choice] => !!e[1]);
    const note = endNote.trim();
    if (note && !entries.length) entries.push([seen[0], 'missing']);
    const carrier = entries.find(([, c]) => c !== 'helped')?.[0] ?? entries[0]?.[0];
    entries.forEach(([id, choice]) => add({id, choice, note: id === carrier ? note : ''}));
    const n = entries.length;
    reallyStop();
    say(n ? x.savedToast(n) : x.stopped);
  };

  let body: ReactNode = null;
  if (on && rect && target) {
    const c = cards(l)[target];
    const given = mine(target);
    let fb: ReactNode = null;
    if (dir === 0) {
      if (thanks === target) fb = <p className="ef-thanks" data-testid="fb-thanks"><Icon name="check" aria-hidden="true" />{x.thanks} <WhereLink x={x} go={goWhere} /></p>;
      else if (given && !aEdit) fb = <p className="ef-given" data-testid="fb-given">{x.marked(x.choice[given.choice])} · <button type="button" className="ef-link" onClick={() => setAEdit(true)}>{x.change}</button></p>;
      else fb = (
        <>
          <span className="ef-ask">{x.ask}</span>
          <Choices x={x} value={aChoice} testid="fb-card" onPick={(ch) => { if (ch === 'helped') saveA(ch, ''); else setAChoice(ch); }} />
          {aChoice && aChoice !== 'helped' ? <NoteForm x={x} choice={aChoice} note={aNote} setNote={setANote} testid="fb-card-note" onSave={() => saveA(aChoice, aNote)} onCancel={() => { setAChoice(undefined); setANote(''); }} /> : null}
        </>
      );
    }
    body = (
      <div ref={card} className={`ah-explain-ui ah-explain-card ef-card${dir === 0 ? ' ef-card-a' : ''}`} data-testid="explain-card" data-card={target} data-touch={touch || undefined} data-pinned={pinned || undefined} aria-live="polite">
        <div className="ah-explain-top">
          <span className="ah-explain-kind">{kinds(l)[KIND[target]]}</span>
          {KEY[target] && !touch ? <kbd>{KEY[target]}</kbd> : null}
          {touch ? <ControlButton size="inline" variant="quiet" className="ah-explain-x" aria-label={x.close} onPress={() => point(null)}><span aria-hidden="true">×</span></ControlButton> : null}
        </div>
        <h2>{c.name}</h2>
        <p>{c.lead}</p>
        {c.know ? <p className="ah-explain-know">{c.know}</p> : null}
        {fb ? <div className="ef-fb" data-testid="fb-row">{fb}</div> : null}
      </div>
    );
  }

  const bSheet = sheet ? (
    <div className="ah-explain-ui ef-sheet ef-bar-sheet" role="dialog" aria-label={x.barButton} data-testid="fb-bar-sheet">
      <header><b>{x.whichCard}</b><ControlButton size="inline" variant="quiet" aria-label={x.close} onPress={() => setSheet(false)}><Icon name="cross" /></ControlButton></header>
      {seen.length ? (
        <ul className="ef-which" role="radiogroup" aria-label={x.whichCard}>
          {seen.slice(0, 4).map((id, i) => (
            <li key={id}><button type="button" role="radio" aria-checked={bCard === id} data-testid={`fb-which-${id}`} onClick={() => setBCard(id)}>
              <i aria-hidden="true" />{cards(l)[id].name}{i === 0 ? <em>{x.latest}</em> : null}
            </button></li>
          ))}
        </ul>
      ) : <p className="ef-muted">{x.noneSeen}</p>}
      {bCard ? <>
        <span className="ef-ask">{x.ask}</span>
        <Choices x={x} value={bChoice} testid="fb-bar" onPick={setBChoice} />
        {bChoice && bChoice !== 'helped' ? <NoteForm x={x} choice={bChoice} note={bNote} setNote={setBNote} testid="fb-bar-note" onSave={saveB} /> : null}
        {bChoice === 'helped' ? <div className="ef-note-row"><ControlButton size="row" variant="primary" onPress={saveB} data-testid="fb-bar-save">{x.save}</ControlButton></div> : null}
      </> : null}
    </div>
  ) : null;

  const endSheet = end ? (
    <div className="ef-end-back">
      <div className="ah-explain-ui ef-sheet ef-end" role="dialog" aria-label={x.endTitle(seen.length)} data-testid="fb-end">
        <h2>{x.endTitle(seen.length)}</h2>
        <p className="ef-muted">{x.endHelp}</p>
        <ul className="ef-end-list">
          {seen.map((id) => (
            <li key={id} data-testid={`fb-end-${id}`}>
              <span>{cards(l)[id].name}</span>
              <Choices x={x} value={marks[id]} testid={`fb-end-${id}`} onPick={(ch) => setMarks((m) => ({...m, [id]: m[id] === ch ? undefined : ch}))} />
            </li>
          ))}
        </ul>
        <textarea aria-label={x.noteLabel} placeholder={x.endNote} rows={2} maxLength={280} value={endNote} onChange={(e) => setEndNote(e.target.value)} data-testid="fb-end-note" />
        <label className="ef-never"><input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />{x.endNever}</label>
        <div className="ef-note-row">
          <ControlButton size="row" variant="primary" onPress={saveC} data-testid="fb-end-save">{x.endSave}</ControlButton>
          <ControlButton size="row" variant="quiet" onPress={() => { reallyStop(); say(x.stopped); }} data-testid="fb-end-skip">{x.endSkip}</ControlButton>
        </div>
        <p className="ef-kept"><Icon name="lock" aria-hidden="true" />{x.keptHere} <WhereLink x={x} go={goWhere} /></p>
      </div>
    </div>
  ) : null;

  const t = explainModeText[l];
  const offset = top;
  return (
    <div className="ef-mode" data-on={on || undefined}>
      {on ? (
        <div className="ah-explain-bar ef-xbar" data-testid="explain-bar" ref={bar}>
          <b>{t.bar.title}</b>
          <span className="ah-explain-hint">{touch ? t.bar.hintTouch : t.bar.hint}</span>
          {dir === 1 ? (
            <button type="button" className="ah-explain-now ef-fb-button" data-explain-own="" data-testid="fb-bar-button" aria-expanded={sheet} onClick={() => { if (!sheet && !bCard) setBCard(seen[0]); setSheet((v) => !v); }}>
              <Icon name="message" aria-hidden="true" /><span>{session ? x.barSaved(session) : x.barButton}</span>
            </button>
          ) : null}
          <button type="button" className="ah-explain-stop" data-testid="explain-stop" data-explain-own="" onClick={stop}>{t.bar.stop} <kbd>Esc</kbd></button>
        </div>
      ) : null}
      <div className="ef-stage">
        <Conversation x={x} modeOn={on} onToggle={() => (on ? stop() : start())} />
      </div>
      {on ? (
        <div className="ah-explain-ui ah-explain-layer" style={{top: offset}} aria-hidden="true">
          {rect ? <i className="ah-explain-hole" style={{left: rect.x - 3, top: rect.y - 3 - offset, width: rect.w + 6, height: rect.h + 6}} /> : <i className="ah-explain-veil" />}
        </div>
      ) : null}
      {body}
      {bSheet}
      {endSheet}
      {dir === 1 && session && !sheet && on ? <div className="ef-bar-after" data-testid="fb-bar-after"><WhereLink x={x} go={goWhere} /></div> : null}
    </div>
  );
}

/* ---------- where the feedback goes ---------- */
function Where({x, l, saved, remove, say}: {x: Text; l: Lang; saved: Fb[]; remove: (k: number) => void; say: (t: string) => void}) {
  const [open, setOpen] = useState(false);
  const c = cards(l);
  const issue = [
    `# ${x.issueTitle(saved.length)}`, '',
    ...saved.map((f) => `- ${c[f.id].name} (${f.id}): ${x.choice[f.choice]}${f.note ? ` — "${f.note}"` : ''}`),
    '', x.issueVersion,
  ].join('\n');
  return (
    <div className="ef-where" data-testid="where-panel">
      <h1>{x.whereTitle}</h1>
      <p className="ef-lead">{x.whereLead}</p>
      <section className="ef-box" data-testid="fb-mine">
        <h2>{x.mineTitle}</h2>
        {saved.length ? (
          <ul className="ef-mine">
            {saved.map((f) => (
              <li key={f.key} data-testid={`fb-mine-${f.id}`} data-choice={f.choice}>
                <span className="ef-mine-choice" data-choice={f.choice}><Icon name={f.choice === 'helped' ? 'check' : f.choice === 'wrong' ? 'cross' : 'plus'} aria-hidden="true" />{x.choice[f.choice]}</span>
                <span className="ef-mine-main"><b>{c[f.id].name}</b>{f.note ? <q>{f.note}</q> : null}<small>{x.view1} · {x.ago[f.ago]}</small></span>
                <ControlButton size="inline" variant="quiet" aria-label={x.remove} title={x.remove} onPress={() => remove(f.key)}><Icon name="trash" /></ControlButton>
              </li>
            ))}
          </ul>
        ) : <p className="ef-muted">{x.mineEmpty}</p>}
      </section>
      <section className="ef-box" data-testid="fb-send">
        <h2>{x.sendTitle}</h2>
        <p>{x.sendLead}</p>
        {!open ? <ControlButton size="row" variant="secondary" isDisabled={!saved.length} onPress={() => setOpen(true)} data-testid="fb-send-open">{x.sendOpen}</ControlButton> : (
          <>
            <pre className="ef-issue" data-testid="fb-issue-preview">{issue}</pre>
            <p className="ef-kept"><Icon name="globe" aria-hidden="true" />{x.sendPublic}</p>
            <div className="ef-note-row">
              <ControlButton size="row" variant="primary" onPress={() => say(x.sentToast)} data-testid="fb-send-github"><Icon name="github" />{x.sendIssue}</ControlButton>
              <ControlButton size="row" variant="secondary" onPress={() => say(x.copiedToast)}><Icon name="copy" />{x.sendCopy}</ControlButton>
            </div>
          </>
        )}
      </section>
      <section className="ef-box" data-testid="fb-compare">
        <h2>{x.compareTitle}</h2>
        <div className="ef-compare" role="table">
          <div role="row" className="ef-compare-head">{x.compareCols.map((h) => <span role="columnheader" key={h}>{h}</span>)}</div>
          {x.compare.map((r) => (
            <div role="row" key={r.id} data-testid={`fb-dest-${r.id}`} data-recommended={r.tag ? '' : undefined}>
              <span role="cell"><b>{r.name}</b>{r.tag ? <em>{r.tag}</em> : null}</span>
              <span role="cell">{r.who}</span>
              <span role="cell">{r.needs}</span>
            </div>
          ))}
        </div>
        <p className="ef-never-line" data-testid="fb-never"><Icon name="eyeOff" aria-hidden="true" />{x.never}</p>
      </section>
    </div>
  );
}

/* ---------- the review page ---------- */
let toastSet: (s: string) => void = () => {};
function App({direction}: {direction: number}) {
  const [th, setTh] = useState(theme);
  const [language, setLanguage] = useState<Lang>(lang);
  const [s, setS] = useState<Scenario>(scenario);
  const [v, setV] = useState<View>(view);
  const [gen, setGen] = useState(0);
  const [saved, setSaved] = useState<Fb[]>(() => [...(scenario === 'done' ? [{key: 3, id: 'Y05' as CardId, choice: 'missing' as Choice, note: NOTE[lang], ago: 'now' as const}] : []), ...seed()]);
  const [toast, setToast] = useState('');
  const x = TEXT[language];
  toastSet = setToast;
  useEffect(() => { document.documentElement.dataset.theme = th; document.documentElement.style.colorScheme = th === 'light' ? 'light' : 'dark'; }, [th]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3200); return () => clearTimeout(id); }, [toast]);
  const reset = (next = s, nv: View = v, nl = language) => {
    scenario = next; view = nv; lang = nl;
    setSaved([...(next === 'done' ? [{key: 3, id: 'Y05' as CardId, choice: 'missing' as Choice, note: NOTE[nl], ago: 'now' as const}] : []), ...seed()]);
    setS(next); setV(nv); setLanguage(nl); setToast(''); setGen((n) => n + 1);
  };
  const add = (f: Omit<Fb, 'key' | 'ago'>) => setSaved((list) => [{...f, key: fbKey++, ago: 'now'}, ...list.filter((o) => !(o.id === f.id && o.ago === 'now'))]);
  return (
    <div className="rq-review ef-review" data-direction={direction} data-scenario={s} data-view={v}>
      <header className="rq-bar">
        <div className="rq-controls">
          <strong>{x.title}</strong>
          <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario, 'mode')}>
            {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
          <label>{x.view} <select id="view" value={v} onChange={(e) => { view = e.target.value as View; setV(view); }}>
            {(['mode', 'where'] as View[]).map((id) => <option key={id} value={id}>{x.views[id]}</option>)}</select></label>
          <label>{x.theme} <select id="theme" value={th} onChange={(e) => { theme = e.target.value; setTh(theme); }}>
            <option value="light">{x.light}</option><option value="dark">{x.dark}</option><option value="contrast">{x.contrast}</option></select></label>
          <label>{x.language} <select id="language" value={language} onChange={(e) => { const nl = e.target.value as Lang; setPersonalLanguage(nl); reset(s, v, nl); }}>
            <option value="fi">Suomi</option><option value="en">English</option></select></label>
          <button type="button" data-testid="rq-reset" onClick={() => reset()}>{x.reset}</button>
        </div>
        <p className="rq-round" data-testid="round-line">{x.roundLine}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {x.lines.map((line, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{line}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <main className="rq-main">
        {v === 'mode'
          ? <Mode key={`${gen}-${direction}-${language}`} dir={direction} x={x} l={language} s={s} saved={saved} add={add} say={setToast} goWhere={() => { view = 'where'; setV('where'); }} />
          : <Where x={x} l={language} saved={saved} remove={(k) => setSaved((list) => list.filter((f) => f.key !== k))} say={setToast} />}
      </main>
      {toast ? <div className="ah-explain-toast ef-toast" role="status" data-testid="rq-toast">{toast}</div> : null}
    </div>
  );
}

const reactRoot = createRoot(document.getElementById('root')!);
document.documentElement.dataset.theme = theme;
const stageSink = {set innerHTML(node: ReactNode) { flushSync(() => reactRoot.render(node === '' ? null : node)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
