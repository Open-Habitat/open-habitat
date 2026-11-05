import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AccountShelf} from '../../../../web/src/components/Account';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Landing, LandingMark} from '../../../../web/src/components/Landing';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// The loading landing when the first read fails (proto-landing-connection-status).
// Today it always says "Palvelin ei vastannut" and recovers by itself only on
// the browser's `online` event (App.tsx). The analysis in
// issues/landing-server-did-not-answer/result.md lists what the browser can
// actually tell apart: a browser-reported offline state (a hint, not proof), a
// fetch rejection or deadline (no usable answer, cause unknown), an HTTP error
// or unusable body (something answered), and a session/snapshot identity
// disagreement (fail-closed). The axis is how the failure speaks and how the
// automatic read retry shows itself. Nyt is the production Landing; the
// directions reuse its markup and classes. Everything here is synthetic: no
// request leaves the page, and the clock is a simulated one.
const directions = ['Nyt', 'A Neutraali', 'B Laskuri', 'C Tarkista'];
const LINES = [
  'Nyt: "Palvelin ei vastannut" joka tilanteessa; palaa itse vain, kun selain ilmoittaa verkon palanneen.',
  'A Neutraali: "Yhteyttä ei saatu" ilman väitettä palvelimesta; offline vain vihjeenä; uusi yritys hiljaa taustalla.',
  'B Laskuri: sama tila, ja seuraava yritys näkyy laskurina palkissa; Yritä nyt ohittaa odotuksen.',
  'C Tarkista: kertoo, mitä voit itse tarkistaa (verkko, VPN); uusi yritys taustalla yhdellä rivillä.',
];
const NOW = 0, A = 1, B = 2, C = 3;
type Scenario = 'network' | 'offline' | 'answer' | 'identity';
const SCENARIOS: {id: Scenario; label: string}[] = [
  {id: 'network', label: 'Yhteys ei toimi, laite on verkossa (VPN)'},
  {id: 'offline', label: 'Laite ilmoittaa olevansa offline'},
  {id: 'answer', label: 'Palvelin vastasi virheellä'},
  {id: 'identity', label: 'Kirjautuminen ei täsmää kolmesti'},
];
// Proposed automatic read retry: growing intervals, capped at a minute, and
// no more automatic tries once 15 minutes have passed since the failure. Only
// reads; never writes, device-link redemption or sign-in.
const DELAYS = [5, 10, 20, 40, 60];
const GIVE_UP = 15 * 60;
const SERVER = 'habitat.example.fi';
const PROFILE = {name: 'Aino Virtanen', email: 'aino@example.fi', avatar_url: ''};
const noop = () => {};

type Phase = 'connecting' | 'failed' | 'trying' | 'signing' | 'recovered' | 'app';

// A simulated clock: the review bar can run it ten times faster or skip
// ahead, so the retry series and its end can be seen without waiting.
const clock = {base: performance.now(), sim: 0, speed: 1};
const simNow = () => clock.sim + (performance.now() - clock.base) * clock.speed;
const setSpeed = (speed: number) => { clock.sim = simNow(); clock.base = performance.now(); clock.speed = speed; };
const skip = (seconds: number) => { clock.sim += seconds * 1000; };
let reviewTheme = 'light';
let reviewScenario: Scenario = 'network';
let reviewSpeed = 1;

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [scenario, setScenario] = useState<Scenario>(reviewScenario);
  const [speed, setSpeedState] = useState(reviewSpeed);
  const [down, setDown] = useState(true);
  const [phase, setPhase] = useState<Phase>('failed');
  const [, setTick] = useState(0);
  const run = useRef({until: 0, failedAt: simNow(), tries: 0, nextAt: null as number | null, delay: 0, exhausted: false});
  const bar = useRef<HTMLElement>(null);
  const downRef = useRef(down);
  downRef.current = down;
  const automatic = direction !== NOW && scenario !== 'identity';
  const offline = scenario === 'offline' && down;

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

  // After a failed read: the next automatic try, unless the browser says it
  // is offline (its `online` event tries at once) or the 15 minutes are up.
  const schedule = (automaticNow = automatic, offlineNow = offline) => {
    const r = run.current;
    r.nextAt = null;
    if (!automaticNow || offlineNow || r.exhausted) return;
    const delay = DELAYS[Math.min(r.tries, DELAYS.length - 1)];
    if ((simNow() - r.failedAt) / 1000 + delay > GIVE_UP) { r.exhausted = true; return; }
    r.delay = delay;
    r.nextAt = simNow() + delay * 1000;
    r.tries++;
  };
  const fresh = (first: Phase, sc = scenario) => {
    run.current = {until: simNow() + 1500, failedAt: simNow(), tries: 0, nextAt: null, delay: 0, exhausted: false};
    setDown(true);
    setPhase(first);
    if (first === 'failed') schedule(direction !== NOW && sc !== 'identity', sc === 'offline');
  };
  useEffect(() => { fresh('failed'); }, []);
  const attempt = () => {
    run.current.nextAt = null;
    run.current.until = simNow() + 800;
    setPhase('trying');
  };
  // One ticking clock drives countdowns and simulated request durations.
  useEffect(() => {
    const id = setInterval(() => {
      const r = run.current, now = simNow();
      setTick(now);
      setPhase(p => {
        if (p === 'connecting' && now >= r.until) { r.failedAt = now; queueMicrotask(() => schedule()); return 'failed'; }
        if (p === 'failed' && r.nextAt !== null && now >= r.nextAt) { r.nextAt = null; r.until = now + 800; return 'trying'; }
        if ((p === 'trying' || p === 'signing') && now >= r.until) {
          if (p === 'signing' || !downRef.current) { r.until = now + 1000; return 'recovered'; }
          queueMicrotask(() => schedule());
          return 'failed';
        }
        if (p === 'recovered' && now >= r.until) return 'app';
        return p;
      });
    }, 100);
    return () => clearInterval(id);
  }, [automatic, offline]);
  (window as any).__proto = {skip: (s: number) => skip(s)};

  const toggleNet = () => {
    const next = !down;
    setDown(next);
    downRef.current = next;
    // A restored network after a browser-reported offline state fires
    // `online`, which already refreshes in production; a VPN route that comes
    // back fires nothing, so only a timer or the button notices it.
    if (!next && scenario === 'offline' && phase === 'failed') attempt();
    else if (next && phase === 'failed' && scenario === 'offline') run.current.nextAt = null;
  };
  const manual = () => { attempt(); };
  const signIn = () => { setDown(false); downRef.current = false; run.current.until = simNow() + 1200; setPhase('signing'); };
  const reset = () => fresh('connecting');
  const changeScenario = (sc: Scenario) => { reviewScenario = sc; setScenario(sc); run.current.exhausted = false; fresh('failed', sc); };

  const r = run.current;
  const left = r.nextAt === null ? 0 : Math.max(0, Math.ceil((r.nextAt - simNow()) / 1000));
  const progress = r.nextAt === null || !r.delay ? 0 : Math.min(1, 1 - (r.nextAt - simNow()) / (r.delay * 1000));

  const failedLike = phase === 'failed' || phase === 'trying';
  let main: React.ReactNode;
  if (phase === 'app') main = <Home />;
  else if (phase === 'connecting' || phase === 'recovered' || phase === 'signing' || (direction === NOW && phase === 'trying'))
    main = <Landing state="connecting" name={phase === 'recovered' ? 'Aino' : undefined} server={SERVER} revealed slow={false} />;
  else if (direction === NOW) main = <Landing state="failed" server={SERVER} revealed slow={false} onRetry={manual} />;
  else main = (
    <Proposed direction={direction} scenario={scenario} trying={phase === 'trying'} offline={offline}
      exhausted={r.exhausted} left={left} progress={progress} onRetry={manual} onSignIn={signIn} />
  );

  // The fallback account appears only when the session read named a person.
  const profileKnown = scenario === 'answer' || scenario === 'identity';
  const shell = phase === 'app' ? (
    <AppShell mobileTitle="Etusivu" rail={<Rail />} main={main} />
  ) : (
    <AppShell mobileTitle="Etusivu" main={<div className="ah-state">{main}</div>}
      fallbackAccount={profileKnown && failedLike ? <AccountShelf profile={PROFILE} onSettings={noop} onLogout={noop} /> : undefined} />
  );

  return (
    <div className={`cs-review variant-${direction}`} data-direction={direction} data-scenario={scenario} data-phase={phase}>
      <header className="cs-bar" ref={bar}>
        <strong>Aloitussivu, kun yhteyttä ei saada</strong>
        <label>Tilanne <select id="scenario" value={scenario} onChange={e => changeScenario(e.target.value as Scenario)}>
          {SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <button type="button" data-testid="cs-net" onClick={toggleNet}>
          {scenario === 'identity' ? (down ? 'Poista ristiriita' : 'Palauta ristiriita') : down ? 'Palauta yhteys' : 'Katkaise yhteys'}
        </button>
        <span className="cs-net-state" data-testid="cs-net-state">{down ? (scenario === 'identity' ? 'Ristiriita jatkuu' : 'Yhteys poikki') : 'Kunnossa'}</span>
        <label>Aika <select id="speed" value={speed} onChange={e => { const v = Number(e.target.value); reviewSpeed = v; setSpeed(v); setSpeedState(v); }}>
          <option value={1}>1×</option><option value={10}>10×</option></select></label>
        <button type="button" data-testid="cs-skip" onClick={() => skip(GIVE_UP)}>Kelaa 15 min</button>
        <label>Teema <select id="theme" value={theme} onChange={e => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="cs-reset" onClick={reset}>Alusta</button>
        <ol className="cs-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="cs-stage">
        <MemoryRouter initialEntries={['/workspaces']}>{shell}</MemoryRouter>
      </div>
    </div>
  );
}

const TEXT = {
  networkTitle: 'Yhteyttä ei saatu',
  answerTitle: 'Työtiloja ei saatu luettua',
  identityTitle: 'Kirjautumista ei saatu varmistettua',
  network: 'Sivu ei saanut yhteyttä palvelimeen. Tämä ei tarkoita, että työtilasi olisivat kadonneet.',
  networkC: 'Yhteys voi katketa matkalla, vaikka palvelin olisi kunnossa.',
  answer: 'Yhteys palvelimeen toimi, mutta työtilojen tietoja ei saatu. Tämä ei tarkoita, että työtilasi olisivat kadonneet.',
  answerC: 'Yhteys palvelimeen toimi, mutta työtilojen tietoja ei saatu. Vika ei ole sinun yhteydessäsi. Jos tämä jatkuu, kerro palvelimen ylläpitäjälle.',
  identity: 'Sivu ei saanut varmistettua, kenen työtilat se näyttää, joten se ei näytä mitään. Näin voi käydä, jos toisessa välilehdessä kirjauduttiin toisella tilillä.',
  offlineHint: 'Laitteesi ilmoittaa, ettei se ole verkossa.',
};

function Proposed({direction, scenario, trying, offline, exhausted, left, progress, onRetry, onSignIn}: {
  direction: number; scenario: Scenario; trying: boolean; offline: boolean; exhausted: boolean;
  left: number; progress: number; onRetry: () => void; onSignIn: () => void;
}) {
  const identity = scenario === 'identity';
  const title = identity ? TEXT.identityTitle : scenario === 'answer' ? TEXT.answerTitle : TEXT.networkTitle;
  const retry = (label = 'Yritä uudelleen', variant: 'primary' | 'secondary' = 'primary') => (
    <ControlButton data-testid="retry" size="page" variant={variant} onPress={onRetry} isDisabled={trying}>
      <Icon name="refresh" />{label}
    </ControlButton>
  );
  const hint = offline ? <p className="cs-hint" data-testid="cs-offline-hint"><Icon name="info" />{TEXT.offlineHint}</p> : null;

  let body: React.ReactNode;
  if (identity) {
    // Fail-closed: no automatic retry, and nothing of anyone is shown.
    body = (
      <>
        <p data-testid="landing-failure-detail">{TEXT.identity}</p>
        <div className="cs-actions">
          <ControlButton data-testid="cs-sign-in" size="page" variant="primary" onPress={onSignIn}>Kirjaudu uudelleen</ControlButton>
          {retry('Yritä uudelleen', 'secondary')}
        </div>
        <p className="cs-quiet" data-testid="cs-auto">{trying ? 'Yritetään…' : 'Sivu ei yritä tätä itse uudelleen.'}</p>
      </>
    );
  } else if (direction === A) {
    body = (
      <>
        <p data-testid="landing-failure-detail">{scenario === 'answer' ? TEXT.answer : TEXT.network}</p>
        {hint}
        {retry()}
        <p className="cs-quiet" data-testid="cs-auto">
          {trying ? 'Yritetään…' : exhausted ? 'Sivu ei enää yritä itse. Yritä uudelleen, kun yhteys toimii.'
            : offline ? 'Jatketaan, kun laite on taas verkossa.' : 'Sivu yrittää myös itse uudelleen.'}
        </p>
      </>
    );
  } else if (direction === B) {
    body = (
      <>
        <p data-testid="landing-failure-detail">{scenario === 'answer' ? TEXT.answer : TEXT.network}</p>
        {hint}
        <p className="cs-count" data-testid="cs-auto">
          {trying ? 'Yritetään nyt…' : exhausted ? 'Automaattiset yritykset lopetettiin.'
            : offline ? 'Odotetaan, että laite on taas verkossa.'
            : <>Yritetään uudelleen <span className="cs-num">{left}</span> s kuluttua</>}
        </p>
        {retry(exhausted || offline ? 'Yritä uudelleen' : 'Yritä nyt')}
      </>
    );
  } else {
    const answer = scenario === 'answer';
    body = (
      <>
        <p data-testid="landing-failure-detail">{answer ? TEXT.answerC : TEXT.networkC}</p>
        {answer ? null : (
          <section className="cs-check" aria-labelledby="cs-check-title" data-testid="cs-check">
            <h3 id="cs-check-title">Voit tarkistaa</h3>
            <ul>
              {offline ? (
                <li className="cs-check-known" data-testid="cs-offline-hint"><Icon name="info" /><span><strong>{TEXT.offlineHint}</strong> Tarkista wifi tai mobiilidata.</span></li>
              ) : (
                <li><Icon name="search" /><span>Onko laite verkossa? Kokeile avata jokin muu sivu.</span></li>
              )}
              <li><Icon name="shield" /><span>Jos käytät VPN:ää, onko se päällä ja yhdistetty?</span></li>
              <li><Icon name="phone" /><span>Toimiiko sivu toisessa verkossa, esimerkiksi mobiilidatalla?</span></li>
            </ul>
          </section>
        )}
        {retry()}
        <p className="cs-quiet cs-auto-line" data-testid="cs-auto">
          <span className="cs-dot" data-active={trying || (!offline && !exhausted) ? '' : undefined} aria-hidden="true" />
          {trying ? 'Yritetään…' : exhausted ? 'Sivu lopetti yrittämisen itse. Yritä uudelleen, kun yhteys toimii.'
            : offline ? 'Sivu jatkaa itse, kun laite on taas verkossa.' : 'Sivu yrittää itse uudelleen ja jatkaa, kun yhteys toimii.'}
        </p>
      </>
    );
  }

  // B turns the failed bar into the countdown to the next try; while a try
  // runs every direction shows the production sliding bar and pulsing dot.
  const countdown = direction === B && !identity && !trying && !exhausted && !offline;
  return (
    <div className={`ah-landing cs-landing cs-d${direction}`} data-revealed="" data-failed={trying ? undefined : ''}
      data-testid="cs-landing">
      <div className="ah-landing-in">
        <LandingMark />
        <h1 data-testid="landing-heading" className="ah-landing-word">Open Habitat</h1>
        <p className="ah-landing-server">{SERVER}</p>
        {countdown ? (
          <div className="ah-landing-bar cs-countdown" aria-hidden="true"><i style={{width: `${progress * 100}%`}} /></div>
        ) : (
          <div className="ah-landing-bar" aria-hidden="true"><span /></div>
        )}
        <h2 data-testid="workspaces-unavailable-title" className="ah-landing-say cs-title">{title}</h2>
        <div className="ah-landing-more">{body}</div>
      </div>
    </div>
  );
}

const WORKSPACES = ['aurinkokello', 'kotisivu', 'muistiinpanot', 'reseptikirja'];
function Rail() {
  return (
    <WorkspaceRail collapsed={false} serverLabel={SERVER} connectionLabel="Yhdistetty" connectionTone="success"
      homeCurrent filterValue="" resultSummary="4 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}>
      {WORKSPACES.map(w => <WorkspaceNavRow key={w} name={w} href={`/workspaces/ws_${w}`} />)}
    </WorkspaceRail>
  );
}
// The recovered app, only far enough to show the landing gave way to it.
function Home() {
  return (
    <div className="ah-state cs-home" data-testid="cs-home">
      <h1>Hei Aino</h1>
      <p>Työtilasi ovat tässä. Valitse, mihin jatkat.</p>
      <ul>{WORKSPACES.map(w => <li key={w}><Icon name="folder" />{w}</li>)}</ul>
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
