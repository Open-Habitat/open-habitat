import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {Icon} from '../../../../web/src/components/Icon';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {Composer as Fork, type AtVariant} from './forkComposer';
import {COMMANDS, WORKSPACE, filesOf, previewOf, treeOf} from './data';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-at-file-list, round 1. Jari 8.11.2026 on the test server: typing @
// and pressing the file button open slightly different lists. Every
// direction shows both openings side by side with the same draft: on the
// left the file button pressed, on the right @ typed, and in both `sha`
// typed after it. Nyt and Vanha are the production Composer unchanged
// (composer-lists-in-field on and off); the three directions are the
// round's copy of it (forkComposer.tsx), which differs only where marked.
const directions = ['Nyt', 'Vanha', 'Hakuun', 'Kenttään', 'Yhteinen'];
const VARIANTS: (AtVariant | 'on' | 'off')[] = ['on', 'off', 'search', 'field', 'shared'];
const LINES = [
  'Nyt: nappi avaa listan omalla hakurivillä, jossa Tab merkitsee ja → näyttää kansiossa; kirjoitettu @ suodattaa tekstistä, Tab lisää ylimmän ja Ctrl+P siirtää napin listaan.',
  'Vanha (kokeilu pois päältä): napin lista kentän yllä omalla haullaan, @-lista kursorin kohdalla ilman hakua ja puuta; useampi ja esikatselu vain Ctrl+P-valitsimessa.',
  'Hakuun: kirjoitettu @ avaa napin listan ja kirjoitus jatkuu sen hakuun; @ odottaa tekstissä valintaa, Esc jättää sen ja askelpalautin tyhjässä haussa poistaa sen.',
  'Kenttään: nappi kirjoittaa @:n tekstiin ja teksti suodattaa; molemmat avaavat nykyisen @-listan, jossa Tab lisää ylimmän ja useampi merkitään vain ruuduista.',
  'Yhteinen: kuten Kenttään, mutta listassa on napin hakurivi ja näppäimet; haku on tekstin @-sana, Tab merkitsee ja → näyttää kansiossa.',
];

const DRAFT = 'Varjon kulma heittää tunnin kesäajan vaihtuessa. Korjaa se ja lisää testi maaliskuun lopulle. Katso ';
const TYPED = 'sha';
type Shown = 'typed' | 'esc' | 'picked';

const noop = () => {};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wait = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const id = setTimeout(resolve, 40);
  signal.addEventListener('abort', () => { clearTimeout(id); reject(new Error('aborted')); });
});
const sources: ComposerSources = {
  commands: async (signal) => { await wait(signal); return {answered_by: 'running', commands: COMMANDS}; },
  files: async (query, signal, rank) => { await wait(signal); return filesOf(query, rank); },
  preview: async (path, signal) => {
    await wait(signal);
    const p = previewOf(path);
    return {path, kind: p.kind === 'dir' ? 'text' : p.kind, text: p.text, truncated: false};
  },
  tree: async (folder, signal) => { await wait(signal); return treeOf(folder); },
  workspaceName: WORKSPACE,
};

/** Typing as a person does: into whatever has the focus, through the
 * browser's own insertText so React and the undo history see it. */
async function type(text: string) {
  for (const ch of text) {
    document.execCommand('insertText', false, ch);
    await pause(30);
  }
}
const key = (el: Element | null, k: string) =>
  el?.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}));
/** Where a panel's keys go now: its list's search when it has one. */
const keysOf = (panel: Element) => panel.querySelector('[data-testid="command-search"]') ?? panel.querySelector('.ah-cbox-field');

/** The default view: the file button pressed on the left and @ typed on
 * the right, and `sha` typed after each; then Esc or Enter in both. */
async function play(shown: Shown, alive: () => boolean) {
  const [left, right] = [...document.querySelectorAll('.at-panel')];
  if (!left || !right) return;
  const caretAtEnd = (panel: Element) => {
    const f = panel.querySelector<HTMLTextAreaElement>('.ah-cbox-field')!;
    f.focus();
    f.setSelectionRange(f.value.length, f.value.length);
    f.scrollTop = f.scrollHeight;
  };
  caretAtEnd(left);
  left.querySelector<HTMLTextAreaElement>('.ah-cbox-field')!.blur();
  left.querySelector<HTMLButtonElement>('[data-testid="file-picker"]')?.click();
  await pause(160); if (!alive()) return;
  await type(TYPED); if (!alive()) return;
  await pause(120);
  caretAtEnd(right);
  await type('@'); await pause(160); if (!alive()) return;
  await type(TYPED); await pause(200); if (!alive()) return;
  if (shown === 'typed') return;
  // The right first: a typed list in production closes when its field
  // loses the focus to the left one.
  for (const panel of [right, left]) {
    key(keysOf(panel), shown === 'esc' ? 'Escape' : 'Enter');
    await pause(160); if (!alive()) return;
  }
}

let reviewTheme = 'light';
let reviewShown: Shown = 'typed';

function Panel({side, variant}: {side: 'button' | 'typed'; variant: (typeof VARIANTS)[number]}) {
  const [draft, setDraft] = useState(DRAFT);
  const common = {
    value: draft, onChange: setDraft, activity: 'idle' as const, selectedWorkingMode: 'steer' as const,
    onModeChange: noop, onSendNow: noop, onSteer: noop, onFollowUp: noop, sources, csrf: 'prototype',
    modelPicker: <button type="button" className="md-pill">Agentin oletus · medium</button>,
  };
  return (
    <section className="at-panel" data-side={side} aria-label={side === 'button' ? 'Tiedosto-napista' : 'Kirjoitettu @'}>
      <h2 className="at-panel-head">
        {side === 'button' ? <><span className="at-chip"><Icon name="at" />Tiedosto</span> painettu</> : <><kbd className="at-kbd">@</kbd> kirjoitettu</>}
      </h2>
      <div className="at-panel-room">
        {variant === 'on' || variant === 'off' ? (
          <Composer {...common} inFieldLists={variant === 'on'} />
        ) : (
          <Fork {...common} inFieldLists variant={variant} holdOnBlur />
        )}
      </div>
    </section>
  );
}

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [shown, setShown] = useState<Shown>(reviewShown);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
  const variant = VARIANTS[direction];
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
  useEffect(() => {
    let live = true;
    document.documentElement.dataset.played = 'no';
    const id = setTimeout(() => play(shown, () => live).then(() => { if (live) document.documentElement.dataset.played = 'yes'; }), 120);
    return () => { live = false; clearTimeout(id); };
  }, [generation, shown]);
  const panels = useMemo(() => (
    <div className="at-stage" key={`${generation}-${shown}`}>
      <Panel side="button" variant={variant} />
      <Panel side="typed" variant={variant} />
    </div>
  ), [generation, shown, variant]);

  return (
    <div className={`at-review variant-${direction}`} data-direction={direction}>
      <header className="cl-bar" ref={bar}>
        <strong>@ ja Tiedosto-nappi</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Tila <select id="shown" value={shown} onChange={(e) => { reviewShown = e.target.value as Shown; setShown(reviewShown); }}>
          <option value="typed">sha kirjoitettu</option><option value="esc">sitten Esc</option><option value="picked">sitten Enter</option></select></label>
        <button type="button" data-testid="at-reset" onClick={() => setGeneration((g) => g + 1)}>Alusta</button>
        <ol className="cl-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} value={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      {panels}
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
  button.className = 'proto-picker-item'; button.textContent = n;
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
