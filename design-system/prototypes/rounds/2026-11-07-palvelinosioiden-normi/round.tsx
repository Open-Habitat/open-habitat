import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AccountSettings} from '../../../../web/src/components/Account';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {shownSettingsSections} from '../../../../web/src/app/settingsIndex';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import {installHost, HOST} from './host';
import {INVENTORY, KIT} from './inventory';
import {NormSection, type Norm} from './norm';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
installHost();

// proto-server-sections-norm. Jari 7.11.2026 on the test server: the server
// settings' Keskustelut and Levytila views must use components that look
// alike; one is polished, the other rough. The axis is which component norm
// every server section follows: A the Keskustelut style (a meter row with a
// legend, steppers, one list row per person with its own control), B the
// Levytila style (a value row with a thin bar, a table with columns, an
// edit button that opens a field), C a combination (Keskustelut's meter,
// rows and person list, Levytila's plain figure line and column header).
// Today shows the production sections unchanged, side by side. The
// directions draw every server section with the same norm on one page, so
// the difference is visible without opening anything. The host is a fetch
// stand-in from contracts/v1/examples; everything is synthetic.
const directions = ['Nyt', 'A Keskustelut', 'B Levytila', 'C Yhdistelmä'];
const LINES = [
  'Nyt: tuotannon kahdeksan palvelinosiota rinnakkain muuttamattomina; jokaisen alla sen komponentit. Keskustelut käyttää mittaria, steppereitä ja henkilörivejä, Levytila taulukkoa, ohutta palkkia ja Raja…-painiketta.',
  'A Keskustelut: jokainen osio on johdanto, kortti nimi–selite–arvo-riveistä, mittari selitteineen ja henkilölista, jossa kullakin rivillä on oma säädin; luvut stepperillä, rajan poikkeus Oletukseen-painikkeella.',
  'B Levytila: jokainen osio on kortti arvoriveistä ja taulukko otsikkosarakkeineen; mittarina ohut palkki lukujen alla, muutos rivin Muuta…-painikkeesta avautuvaan kenttään.',
  'C Yhdistelmä: Keskustelujen rivit, mittari ja henkilölista, mutta listan yllä sarakeotsikot ja jokaisen rivin lukema (käyttö / raja) samassa sarakkeessa; luvut stepperillä kaikkialla.',
];
const NYT = 0;
const NORMS: Norm[] = ['nyt', 'a', 'b', 'c'];

const SERVER = shownSettingsSections('fi').filter((s) => s.admin);
/** Keskustelut and Levytila first, side by side: they are the pair Jari named. */
const ORDER = ['keskustelut', 'levy', 'palvelin', 'kayttajat', 'aiavain', 'saneluavain', 'palvelinintegraatiot', 'kayttoonotto'];
const label = (id: string) => (id === 'palvelin' ? 'Yleiset' : id === 'palvelinintegraatiot' ? 'Integraatiot' : SERVER.find((s) => s.id === id)!.label);

/** One production section as the server area draws it: its heading and
 * content; the area's own list, close button and version line hidden. */
function Production({id}: {id: string}) {
  return (
    <div className="rq-embed" data-section={id}>
      <AccountSettings routeSection={id} onNavigate={() => {}} profile={{name: 'Jari Mustonen', email: '', avatar_url: ''}} csrf="prototype" onClose={() => {}} />
    </div>
  );
}

function Panel({id, direction}: {id: string; direction: number}) {
  const inv = INVENTORY[id];
  return (
    <section className="rq-panel" data-panel={id} data-testid={`panel-${id}`}>
      <div className="rq-panel-body">
        {direction === NYT ? <Production id={id} /> : <NormSection id={id} title={label(id)} norm={NORMS[direction]} />}
      </div>
      <footer className="rq-inv" data-testid={`inventory-${id}`}>
        <strong>{direction === NYT ? 'Komponentit nyt' : 'Normin komponentit'}</strong>
        <ul>{(direction === NYT ? inv.now : inv[NORMS[direction] as 'a' | 'b' | 'c']).map((c) => <li key={c}>{c}</li>)}</ul>
      </footer>
    </section>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [generation, setGeneration] = useState(0);
  const [limits, setLimits] = useState(HOST.limits);
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
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Palvelinosioiden normi</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Levyrajat <select id="limits" data-testid="limits" value={limits} onChange={(e) => { HOST.limits = e.target.value as typeof HOST.limits; setLimits(HOST.limits); setGeneration((g) => g + 1); }}>
          <option value="enforced">käytössä</option><option value="not_in_use">ei käytössä</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => { HOST.reset(); setGeneration((g) => g + 1); }}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <main className="rq-sheet" key={generation}>
        <MemoryRouter initialEntries={['/settings/server']}><PiModelsProvider enabled={false}>
          <h1 className="rq-sheet-title">Palvelimen ylläpito <span>Contoso · koskee kaikkia käyttäjiä</span></h1>
          {direction === NYT ? null : (
            <aside className="rq-kit" data-testid="kit">
              <strong>Uusi palvelinosio (esim. Levyt) kootaan näistä:</strong>
              <ol>{KIT[NORMS[direction] as 'a' | 'b' | 'c'].map((k) => <li key={k}>{k}</li>)}</ol>
            </aside>
          )}
          <div className="rq-grid">
            {ORDER.map((id) => <Panel key={id} id={id} direction={direction} />)}
          </div>
        </PiModelsProvider></MemoryRouter>
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
