import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/Settings.css';
import {ServerStorage} from '../../../../web/src/app/ServerStorage';
import {ServerConversations} from '../../../../web/src/app/ServerConversations';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {installHost, HOST} from './host';
import {PLACE, type Place} from './section';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
installHost();

// proto-limit-reset-placement. Jari 7.11.2026 (pilot.619, Levytila, dark):
// a person's Oletukseen sits as its own button under the usage bar, though
// the stepper is at the row's right edge, so rows with an own limit are
// taller than rows without. The axis is where resetting a person's own
// limit to the default sits on the row, with every row the same height:
// A beside the stepper, B in the row's own line under the name, C in a row
// menu. Today is production unchanged. Levytila and Keskustelut are the
// production sections against a host stand-in; only PeopleRow's placement
// of the LimitReset it is given differs (section.tsx).
const directions = ['Nyt', 'A Säädin', 'B Linkki', 'C Valikko'];
const LINES = [
  'Nyt: tuotanto muuttamattomana; Oletukseen on oma painikkeensa rivin lopussa, kapeassa paneelissa käyttöpalkin alla, joten rivit, joilla on oma raja, ovat korkeampia.',
  'A Säädin: pieni palautuskuvake heti − n + -säätimen oikealla puolella; riveillä ilman omaa rajaa sama tyhjä tila, joten säätimet pysyvät linjassa.',
  'B Linkki: nimen alla oleva rivi sanoo »oma raja · Oletukseen«, ja Oletukseen on linkki; riveillä ilman omaa rajaa siinä lukee »oletus«.',
  'C Valikko: jokaisen rivin lopussa sama ⋯-valikko, jossa »Palauta oletusrajaan«; se on harmaana, kun henkilö jo käyttää oletusta.',
];
const PLACES: Place[] = ['nyt', 'a', 'b', 'c'];

let reviewTheme = 'light';
let reviewPane = '440';
function App({direction}: {direction: number}) {
  PLACE.current = PLACES[direction];
  const [theme, setTheme] = useState(reviewTheme);
  const [pane, setPane] = useState(reviewPane);
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
  return (
    <div className={`rq-review variant-${direction}`} data-place={PLACES[direction]} style={{'--rq-pane': `${pane}px`} as React.CSSProperties}>
      <header className="rq-bar" ref={bar}>
        <strong>Oletukseen henkilörivillä</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label className="rq-pane-width">Paneeli <select id="pane" data-testid="pane" value={pane} onChange={(e) => { reviewPane = e.target.value; setPane(reviewPane); }}>
          <option value="440">kapea, 440 px (sivupalkit auki)</option><option value="720">leveä, 720 px</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => { HOST.reset(); setGeneration((g) => g + 1); }}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <main className="rq-sheet" key={generation}>
        <h1 className="rq-sheet-title">Palvelimen ylläpito <span>Contoso · omat rajat: levytila aino, maintainer ja sanna; keskustelut aino, mikko ja liisa</span></h1>
        <div className="rq-grid">
          <section className="s-main" data-testid="pane-levy"><h2>Levytila</h2><ServerStorage csrf="prototype" /></section>
          <section className="s-main" data-testid="pane-keskustelut"><h2>Keskustelut</h2><ServerConversations csrf="prototype" /></section>
        </div>
      </main>
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
