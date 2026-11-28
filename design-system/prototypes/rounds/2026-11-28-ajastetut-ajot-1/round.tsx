import {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import {initialTheme} from '../../lib/view-theme.js';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/ScheduledWake.css';
import '../../../../web/src/app/WorkspacePage.css';
import {PLACE_ICONS} from '../../../../web/src/components/AdaptiveRail';
import {AssistantMessage, Composer, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {ControlButton, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader, AppShell, NowSections, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {Menu} from '../../../../web/src/components/Overlays';
import {QuietSection} from '../../../../web/src/components/QuietSection';
import {Badge} from '../../../../web/src/components/Status';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {WarningBanner} from '../../../../web/src/components/WarningBanner';
import {WorkspaceActions} from '../../../../web/src/components/WorkspaceActions';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// scheduled-agent-runs, round 1 (Jari 28.11.2026: concept first, then a
// prototype from it). issues/scheduled-agent-runs/design.md is the concept:
// a schedule is the person's (workspace, prompt, model, cadence, zone,
// notify); each run is a new conversation that rises to Sinun vuorosi like
// any reply; an agent only proposes a schedule on a card the person accepts.
// The picker's axis is where schedules are listed and managed:
//   A · Paikka   a place of its own at the top of the rail, beside
//                Tuotokset, with a list + detail page; the
//                workspace page shows the same list narrowed.
//   B · Työtila  no rail place: schedules live only on their
//                workspace's page, and the detail opens there.
// Everything else is the same in both: the create form, one schedule's page
// with run history, the run in the rail and the conversation, paused /
// failed / missed states and the agent's proposal card.
// Production, unchanged: AppShell, WorkspaceRail (adaptive places),
// NowSections, QuietSection, AgentNavItem, WorkspaceNavRow, AgentHeader,
// ConversationFrame, ConversationTimeline, UserMessage, AssistantMessage,
// Composer, WarningBanner, Badge, Menu, ControlButton, Segmented, Icon,
// WorkspaceActions, WorkspacePage.css and the wake line's CSS. Round's own:
// the Ajastukset place's id and icon (PLACE_ICONS gets a `schedules` entry
// here only), the schedules page, list and detail, the form, Habitat's run
// line and the proposal card. No network, no navigation outside the page.

setPersonalLanguage('fi');
(PLACE_ICONS as Record<string, string>).schedules = 'clock';
const noop = () => {};
const NAMES = ['A · Paikka', 'B · Työtila'];
const LINES = [
  'A · Ajastukset-paikka: sivupalkin yläosassa Tuotokset-paikan vieressä on Ajastukset. Sen sivulla on kaikki ajastukset ja valitun ajastuksen tiedot. Työtilan sivu näyttää saman listan vain siltä työtilalta.',
  'B · Työtilan sivu: sivupalkissa ei ole paikkaa. Ajastukset ovat vain työtilansa sivulla, ja ajastuksen tiedot avautuvat siellä. Epäonnistuneesta ajosta kertoo vain Sinun vuorosi -rivi.',
];
const RECOMMEND = 'Suositus: A. Ajastus toimii henkilön puolesta, kun kukaan ei katso, joten yksi näkymä kaikesta, mitä ajetaan, on se, jonka varassa ominaisuuteen voi luottaa. Työtilan sivulla lista on kummassakin.';

// ---------- Time ----------
// The page's "now" is Monday 30.11.2026 at 9.12 in Helsinki (UTC+2).
const at = (s: string) => Date.parse(`2026-${s}+02:00`);
const NOW = at('11-30T09:12:00');
const WD = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const WD_LONG = ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai'];
const local = (ms: number) => new Date(ms + 2 * 3600e3); // read with getUTC*
const hm = (ms: number) => { const d = local(ms); return `${d.getUTCHours()}.${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const dm = (ms: number) => { const d = local(ms); return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`; };
const day = (ms: number) => `${WD[local(ms).getUTCDay()]} ${dm(ms)}`;
const full = (ms: number) => `${day(ms)} klo ${hm(ms)}`;
const ago = (m: number) => Date.now() - m * 60e3;

// ---------- Schedules ----------
type Cadence = 'daily' | 'weekdays' | 'weekly' | 'monthly';
type RunState = 'done' | 'asks' | 'failed' | 'missed' | 'working';
type Run = {at: number; state: RunState; started?: number; why?: string; summary?: string; conv?: string};
type Schedule = {
  id: string; name: string; ws: string; prompt: string; model: string;
  cadence: Cadence; days: number[]; monthDay: number; time: string; zone: string;
  notify: 'always' | 'attention'; paused?: 'person' | 'failures'; pausedAt?: number;
  createdAt: number; proposed?: boolean; runs: Run[];
};
const ZONES = [{id: 'Europe/Helsinki', label: 'Helsinki (UTC+2, kesällä +3)'}, {id: 'Europe/Stockholm', label: 'Tukholma (UTC+1, kesällä +2)'}, {id: 'UTC', label: 'UTC'}];
const MODELS = ['oletusmalli', 'claude-sonnet-4-5', 'gpt-5-mini'];
const WSS = ['aurinkokello', 'kirjasto-api', 'kotisivu', 'muistiinpanot'];

const README_PROMPT = 'Käy läpi `README.md` ja `docs/kuvat/`. Vertaa niitä sovelluksen nykyiseen käyttöliittymään (`npm run dev`, kuvakaappaukset Playwrightilla). Päivitä vanhentuneet kuvat ja tekstit omaan haaraansa ja kerro, mitä muutit. Älä yhdistä päähaaraan.';
const SEED: Schedule[] = [
  {
    id: 'readme', name: 'README-tarkistus', ws: 'kotisivu', prompt: README_PROMPT, model: 'oletusmalli',
    cadence: 'weekly', days: [1], monthDay: 1, time: '6.00', zone: 'Europe/Helsinki', notify: 'always', createdAt: at('10-29T14:20:00'), proposed: true,
    runs: [
      {at: at('11-30T06:00:00'), state: 'done', summary: 'Kaksi kuvaa päivitetty haaraan readme/30-11', conv: 'run-readme'},
      {at: at('11-23T06:00:00'), state: 'done', summary: 'Ei muutoksia', conv: 'x1'},
      {at: at('11-16T06:00:00'), state: 'asks', summary: 'Kysyi, kuuluuko vanha asetussivu vielä ohjeeseen', conv: 'x2'},
      {at: at('11-09T06:00:00'), state: 'done', summary: 'Asennusohje päivitetty', conv: 'x3'},
      {at: at('11-02T06:00:00'), state: 'done', summary: 'Ei muutoksia', conv: 'x4'},
    ],
  },
  {
    id: 'deps', name: 'Riippuvuuksien päivitys', ws: 'kirjasto-api', model: 'gpt-5-mini',
    prompt: 'Aja `npm outdated`. Päivitä patch- ja minor-versiot omaan haaraansa, aja testit ja kerro tulos. Major-versioista vain lista.',
    cadence: 'weekdays', days: [1, 2, 3, 4, 5], monthDay: 1, time: '7.30', zone: 'Europe/Helsinki', notify: 'attention', createdAt: at('11-10T10:05:00'),
    runs: [
      {at: at('11-30T07:30:00'), state: 'done', summary: 'Ei päivitettävää', conv: 'run-deps'},
      {at: at('11-27T07:30:00'), state: 'done', summary: '3 päivitystä, testit vihreinä', conv: 'x5'},
      {at: at('11-26T07:30:00'), state: 'done', summary: 'Ei päivitettävää', conv: 'x6'},
      {at: at('11-25T07:30:00'), state: 'asks', summary: 'Kysyi, päivitetäänkö express 5:een', conv: 'x7'},
      {at: at('11-24T07:30:00'), state: 'done', started: at('11-24T08:12:00'), summary: 'Myöhässä: ajettiin, kun palvelin palasi', conv: 'run-deps-late'},
      {at: at('11-23T07:30:00'), state: 'missed', why: 'Palvelin ei ollut käynnissä. Väliin jääneistä ajoista tehtiin vain yksi, ti 24.11. klo 8.12.'},
    ],
  },
  {
    id: 'report', name: 'Viikkokooste', ws: 'muistiinpanot', model: 'claude-sonnet-4-5',
    prompt: 'Kokoa tämän viikon muistiinpanoista (`viikot/`) lyhyt kooste: mitä tehtiin, mikä jäi kesken, mitä ensi viikolla. Kirjoita se tiedostoon `koosteet/<vuosi>-<viikko>.md`.',
    cadence: 'weekly', days: [5], monthDay: 1, time: '16.00', zone: 'Europe/Helsinki', notify: 'always', createdAt: at('11-06T12:00:00'),
    runs: [
      {at: at('11-27T16:00:00'), state: 'failed', why: 'Mallin käyttökiintiö oli täynnä (claude-sonnet-4-5). Ajoa ei yritetty uudelleen.', conv: 'run-report'},
      {at: at('11-20T16:00:00'), state: 'done', summary: 'Kooste kirjoitettu', conv: 'x8'},
      {at: at('11-13T16:00:00'), state: 'done', summary: 'Kooste kirjoitettu', conv: 'x9'},
    ],
  },
  {
    id: 'backup', name: 'Varmuuskopioiden tarkistus', ws: 'aurinkokello', model: 'oletusmalli',
    prompt: 'Tarkista, että yön varmuuskopio on syntynyt ja palautuu testikantaan. Kerro vain, jos jokin on vialla.',
    cadence: 'daily', days: [0, 1, 2, 3, 4, 5, 6], monthDay: 1, time: '3.00', zone: 'Europe/Helsinki', notify: 'attention', paused: 'person', pausedAt: at('11-20T18:40:00'), createdAt: at('10-15T09:00:00'),
    runs: [
      {at: at('11-20T03:00:00'), state: 'done', summary: 'Varmuuskopio kunnossa', conv: 'x10'},
      {at: at('11-19T03:00:00'), state: 'done', summary: 'Varmuuskopio kunnossa', conv: 'x11'},
    ],
  },
];
const clone = (): Schedule[] => JSON.parse(JSON.stringify(SEED));

/** The next run from `from`, in Helsinki time; undefined while paused. */
function nextRun(s: Pick<Schedule, 'cadence' | 'days' | 'monthDay' | 'time' | 'paused'>, from = NOW): number | undefined {
  if (s.paused) return undefined;
  const [h, m] = s.time.split('.').map(Number);
  for (let i = 0; i < 62; i++) {
    const d = local(from + i * 86400e3);
    const cand = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m) - 2 * 3600e3;
    if (cand <= from) continue;
    const wd = d.getUTCDay();
    if (s.cadence === 'daily') return cand;
    if (s.cadence === 'weekdays' && wd >= 1 && wd <= 5) return cand;
    if (s.cadence === 'weekly' && s.days.includes(wd)) return cand;
    if (s.cadence === 'monthly' && d.getUTCDate() === s.monthDay) return cand;
  }
  return undefined;
}
function cadenceText(s: Pick<Schedule, 'cadence' | 'days' | 'monthDay' | 'time'>) {
  if (s.cadence === 'daily') return `Joka päivä klo ${s.time}`;
  if (s.cadence === 'weekdays') return `Arkisin klo ${s.time}`;
  if (s.cadence === 'monthly') return `Kuukauden ${s.monthDay}. päivä klo ${s.time}`;
  const names = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WD_LONG[d]);
  return names.length === 1 ? `Joka ${names[0]} klo ${s.time}` : `${names.join(', ')} klo ${s.time}`;
}
const zoneLabel = (z: string) => ZONES.find((x) => x.id === z)?.label ?? z;
const NOTIFY = {always: 'Sinun vuorosi aina, kun ajo valmistuu', attention: 'Hiljaiset, paitsi jos agentti kysyy tai ajo epäonnistuu'};
const RUN_LABEL: Record<RunState, string> = {done: 'Valmis', asks: 'Kysyi sinulta', failed: 'Epäonnistui', missed: 'Ohitettu', working: 'Käynnissä'};
const RUN_TONE = {done: 'success', asks: 'info', failed: 'danger', missed: 'warning', working: 'info'} as const;

type Health = 'ok' | 'paused' | 'failed' | 'missed';
function health(s: Schedule): Health {
  if (s.paused) return 'paused';
  const last = s.runs[0];
  if (last?.state === 'failed') return 'failed';
  return 'ok';
}
const HEALTH: Record<Health, {label: string; tone: 'neutral' | 'success' | 'warning' | 'danger'}> = {
  ok: {label: 'Käytössä', tone: 'success'}, paused: {label: 'Keskeytetty', tone: 'neutral'},
  failed: {label: 'Viimeisin ajo epäonnistui', tone: 'danger'}, missed: {label: 'Ajo jäi väliin', tone: 'warning'},
};

// ---------- Scenarios ----------
type SId = 'lista' | 'tyotila' | 'uusi' | 'ajastus' | 'tauko' | 'virhe' | 'keskeytyi' | 'ohitettu' | 'kaynnissa' | 'ajo' | 'ajovirhe' | 'myohassa' | 'ehdotus';
type Scenario = {label: string; path: (d: number) => string; mutate?: (list: Schedule[]) => void; create?: boolean};
const wsPath = (ws: string) => `/workspaces/ws_${ws}`;
const detailPath = (d: number, id: string, list = SEED) => d === 0 ? `/schedules/${id}` : `${wsPath(list.find((s) => s.id === id)?.ws ?? 'kotisivu')}/schedules/${id}`;
const SCENARIOS: Record<SId, Scenario> = {
  lista: {label: 'Ajastusten lista', path: (d) => d === 0 ? '/schedules' : wsPath('kotisivu')},
  tyotila: {label: 'Työtilan sivu (kotisivu)', path: () => wsPath('kotisivu')},
  uusi: {label: 'Uusi ajastus', path: (d) => d === 0 ? '/schedules' : wsPath('kotisivu'), create: true},
  ajastus: {label: 'Yksi ajastus ja sen ajot', path: (d) => detailPath(d, 'readme')},
  tauko: {label: 'Keskeytetty ajastus', path: (d) => detailPath(d, 'backup')},
  virhe: {label: 'Viimeisin ajo epäonnistui (kiintiö)', path: (d) => detailPath(d, 'report')},
  keskeytyi: {label: 'Keskeytyi kolmen epäonnistumisen jälkeen', path: (d) => detailPath(d, 'report'), mutate: (l) => {
    const r = l.find((s) => s.id === 'report')!;
    r.paused = 'failures'; r.pausedAt = at('11-27T16:01:00');
    r.runs = [r.runs[0], {...r.runs[0], at: at('11-20T16:00:00'), conv: 'x8'}, {...r.runs[0], at: at('11-13T16:00:00'), conv: 'x9'}];
  }},
  ohitettu: {label: 'Väliin jäänyt ajo (palvelin alhaalla)', path: (d) => detailPath(d, 'deps')},
  kaynnissa: {label: 'Ajo käynnissä (Käynnissä-osio)', path: () => '/agents/run-readme', mutate: (l) => { l[0].runs[0] = {...l[0].runs[0], state: 'working', summary: undefined}; }},
  ajo: {label: 'Valmis ajo keskusteluna', path: () => '/agents/run-readme'},
  ajovirhe: {label: 'Epäonnistunut ajo keskusteluna', path: () => '/agents/run-report'},
  myohassa: {label: 'Myöhässä tehty ajo keskusteluna', path: () => '/agents/run-deps-late'},
  ehdotus: {label: 'Agentti ehdottaa ajastusta', path: () => '/agents/proposal'},
};
const SIDS = Object.keys(SCENARIOS) as SId[];
const param = new URLSearchParams(location.search);
let initialScenario: SId = (param.get('s') as SId) in SCENARIOS ? param.get('s') as SId : 'lista';
let reviewTheme = initialTheme(['light', 'dark']) as 'light' | 'dark';
let toast: (s: string) => void = () => {};

// ---------- Shared state ----------
type Store = {
  list: Schedule[];
  set: (fn: (l: Schedule[]) => Schedule[]) => void;
  d: number;
  phone: boolean;
  edit: (s?: Schedule, ws?: string) => void;
};

function StateBadge({s}: {s: Schedule}) {
  const h = HEALTH[health(s)];
  return <span data-testid="schedule-state" data-state={health(s)}><Badge label={h.label} tone={h.tone} /></span>;
}
function RunBadge({r}: {r: Run}) {
  const late = r.started && r.state !== 'missed';
  return <span className="aa-run-badges"><Badge label={RUN_LABEL[r.state]} tone={RUN_TONE[r.state]} />{late ? <Badge label="Myöhässä" tone="warning" /> : null}</span>;
}

// ---------- The list ----------
function ScheduleList({store, ws, current, onOpen}: {store: Store; ws?: string; current?: string; onOpen: (id: string) => void}) {
  const rows = store.list.filter((s) => !ws || s.ws === ws);
  if (!rows.length) return <p className="aa-empty" data-testid="schedules-empty">Ei ajastuksia{ws ? ' tässä työtilassa' : ''}.</p>;
  return (
    <ul className="aa-list" data-testid="schedule-list">
      {rows.map((s) => {
        const next = nextRun(s);
        const last = s.runs[0];
        return (
          <li key={s.id}>
            <button type="button" className="aa-row" data-testid={`schedule-row-${s.id}`} data-state={health(s)} aria-current={current === s.id ? 'true' : undefined} onClick={() => onOpen(s.id)}>
              <span className="aa-row-name">{s.name}</span>
              <span className="aa-row-state"><StateBadge s={s} /></span>
              <span className="aa-row-meta">
                {ws ? null : <><Icon name="folder" /><code>{s.ws}</code><span aria-hidden="true">·</span></>}
                <span>{cadenceText(s)}</span>
              </span>
              <span className="aa-row-meta aa-row-next">
                {next ? <>Seuraava {full(next)}</> : s.paused === 'failures' ? 'Keskeytyi epäonnistumisiin' : 'Keskeytetty'}
                {last ? <><span aria-hidden="true">·</span>Edellinen {day(last.at)} {RUN_LABEL[last.state].toLowerCase()}</> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- One schedule ----------
function ScheduleDetail({store, id, onBack, backLabel}: {store: Store; id: string; onBack: () => void; backLabel: string}) {
  const s = store.list.find((x) => x.id === id);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  if (!s) return <p className="aa-empty" data-testid="schedule-gone">Ajastus on poistettu. Sen aiemmat ajot ovat yhä tavallisina keskusteluina.</p>;
  const next = nextRun(s);
  const update = (fn: (x: Schedule) => Schedule) => store.set((l) => l.map((x) => x.id === s.id ? fn(x) : x));
  const pause = () => { update((x) => ({...x, paused: 'person', pausedAt: NOW})); toast(`${s.name} keskeytetty. Ajoja ei tehdä ennen kuin jatkat.`); };
  const resume = () => { update((x) => ({...x, paused: undefined, pausedAt: undefined})); const n = nextRun({...s, paused: undefined}); toast(`${s.name} jatkuu. Seuraava ajo ${n ? full(n) : '–'}.`); };
  const runNow = () => {
    update((x) => ({...x, runs: [{at: NOW, state: 'working', conv: 'run-now'}, ...x.runs]}));
    toast(`Ajo aloitettu uutena keskusteluna. Se näkyy Käynnissä-osiossa.`);
  };
  const missed = s.runs.find((r) => r.state === 'missed' && r.at > NOW - 8 * 86400e3);
  const running = s.runs[0]?.state === 'working';
  const facts: [string, ReactNode][] = [
    ['Työtila', <code key="w">~/src/{s.ws}</code>],
    ['Malli', <code key="m">{s.model}</code>],
    ['Toistuu', cadenceText(s)],
    ['Aikavyöhyke', zoneLabel(s.zone)],
    ['Seuraava ajo', next ? full(next) : s.paused === 'failures' ? 'Ei ajoja: keskeytyi' : `Ei ajoja: keskeytit ${s.pausedAt ? day(s.pausedAt) : ''}`],
    ['Kun ajo valmistuu', NOTIFY[s.notify]],
    ['Tehty', `${day(s.createdAt)}${s.proposed ? ' agentin ehdotuksesta, jonka hyväksyit' : ''}`],
  ];
  return (
    <article className="aa-detail" data-testid="schedule-detail" data-schedule={s.id} aria-labelledby="aa-detail-title">
      {store.phone || store.d === 1 ? (
        <ControlButton className="aa-back" variant="quiet" size="row" presentation="back" data-testid="schedule-back" onPress={onBack}>{backLabel}</ControlButton>
      ) : null}
      <header className="aa-detail-head">
        <div className="aa-detail-title">
          <h2 id="aa-detail-title" tabIndex={-1}>{s.name}</h2>
          <StateBadge s={s} />
        </div>
        <div className="aa-actions" data-testid="schedule-actions">
          <ControlButton data-testid="schedule-run-now" size="row" variant="secondary" isDisabled={running} onPress={runNow}><Icon name="run" />Aja nyt</ControlButton>
          {s.paused
            ? <ControlButton data-testid="schedule-resume" size="row" variant="secondary" onPress={resume}><Icon name="restore" />Jatka</ControlButton>
            : <ControlButton data-testid="schedule-pause" size="row" variant="secondary" onPress={pause}><Icon name="stop" />Keskeytä</ControlButton>}
          <Menu label={`Ajastuksen ${s.name} toiminnot`} trigger={<Icon name="more" />} triggerPresentation="icon" triggerTestId="schedule-more" placement="bottom end"
            items={[{id: 'edit', label: 'Muokkaa…', icon: <Icon name="pencil" />}, {id: 'delete', label: 'Poista…', icon: <Icon name="trash" />}]}
            onAction={(k) => { setTimeout(() => k === 'edit' ? store.edit(s) : setDeleting(true)); }} />
        </div>
      </header>
      {s.paused === 'failures' ? (
        <WarningBanner data-testid="banner-failures" tone="danger" title="Ajastus keskeytyi kolmen epäonnistuneen ajon jälkeen"
          actions={<ControlButton size="row" variant="secondary" onPress={resume}>Jatka ajastusta</ControlButton>}>
          Kaikki kolme kaatuivat siihen, että mallin <code>{s.model}</code> käyttökiintiö oli täynnä. Vaihda malli tai odota kiintiön palautumista ja jatka sitten.
        </WarningBanner>
      ) : health(s) === 'failed' ? (
        <WarningBanner data-testid="banner-failed" tone="danger" title={`Ajo ${full(s.runs[0].at)} epäonnistui`}
          actions={<ControlButton size="row" variant="secondary" onPress={() => navigate(`/agents/${s.runs[0].conv}`)}>Avaa ajo</ControlButton>}>
          {s.runs[0].why} Ajastus jatkuu: seuraava ajo {next ? full(next) : '–'}. Kolmannen peräkkäisen epäonnistumisen jälkeen se keskeytyy itse.
        </WarningBanner>
      ) : missed ? (
        <WarningBanner data-testid="banner-missed" tone="neutral" title={`Ajo ${full(missed.at)} jäi väliin`}>
          {missed.why}
        </WarningBanner>
      ) : null}
      <dl className="aa-facts" data-testid="schedule-facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <section className="aa-prompt" aria-labelledby="aa-prompt-h">
        <h3 id="aa-prompt-h">Ohje jokaisen ajon alkuun</h3>
        <blockquote data-testid="schedule-prompt"><Markdown text={s.prompt} /></blockquote>
      </section>
      <section className="aa-runs" aria-labelledby="aa-runs-h">
        <h3 id="aa-runs-h">Ajot</h3>
        <p className="aa-note">Jokainen ajo on oma keskustelunsa. Ajastuksen poistaminen ei poista niitä.</p>
        <ol className="aa-run-list" data-testid="run-list">
          {s.runs.map((r, i) => (
            <li key={`${r.at}-${i}`} className="aa-run" data-state={r.state} data-testid={`run-${i}`}>
              <span className="aa-run-when">{full(r.at)}</span>
              <RunBadge r={r} />
              <span className="aa-run-text">
                {r.state === 'working' ? 'Agentti työskentelee.' : r.started ? `${r.summary}, ${full(r.started)}.` : r.summary ?? r.why}
              </span>
              {r.conv ? (
                <ControlButton className="aa-run-open" size="inline" variant="quiet" data-testid={`run-open-${i}`}
                  onPress={() => r.conv?.startsWith('x') ? toast('Vanhemmat ajot eivät ole tässä vedoksessa.') : navigate(`/agents/${r.conv === 'run-now' ? 'run-readme' : r.conv}`)}>
                  Avaa keskustelu
                </ControlButton>
              ) : <span className="aa-run-open aa-note">Ei keskustelua</span>}
            </li>
          ))}
        </ol>
      </section>
      {deleting ? (
        <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) setDeleting(false); }}>
          <Modal className="ah-modal">
            <Dialog className="ah-dialog" role="alertdialog" data-testid="delete-dialog" aria-label={`Poista ${s.name}`}>
              <Heading slot="title">Poistetaanko {s.name}?</Heading>
              <p>Ajastus poistuu, eikä uusia ajoja tehdä. Aiemmat {s.runs.filter((r) => r.conv).length} ajoa jäävät tavallisiksi keskusteluiksi työtilaan <code>{s.ws}</code>; arkistoi ne erikseen, jos et tarvitse niitä.</p>
              <div className="ah-dialog-actions">
                <ControlButton data-testid="delete-cancel" size="page" variant="secondary" autoFocus onPress={() => setDeleting(false)}>Peruuta</ControlButton>
                <ControlButton data-testid="delete-confirm" size="page" variant="danger" onPress={() => {
                  store.set((l) => l.filter((x) => x.id !== s.id)); setDeleting(false); toast(`${s.name} poistettu.`); onBack();
                }}>Poista ajastus</ControlButton>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      ) : null}
    </article>
  );
}

// ---------- The form ----------
type Draft = Omit<Schedule, 'runs' | 'createdAt'>;
const blank = (ws = 'kotisivu'): Draft => ({id: '', name: '', ws, prompt: '', model: 'oletusmalli', cadence: 'weekly', days: [1], monthDay: 1, time: '8.00', zone: 'Europe/Helsinki', notify: 'always'});

function ScheduleForm({initial, editing, onSave, onClose}: {initial: Draft; editing: boolean; onSave: (d: Draft) => void; onClose: () => void}) {
  const [f, setF] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((x) => ({...x, [k]: v}));
  const timeOk = /^([01]?\d|2[0-3])\.[0-5]\d$/.test(f.time);
  const ok = f.name.trim() && f.prompt.trim() && timeOk && (f.cadence !== 'weekly' || f.days.length > 0);
  const next = ok ? nextRun({...f, paused: undefined}) : undefined;
  const toggleDay = (d: number) => set('days', f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d]);
  return (
    <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal aa-form-modal">
        <Dialog className="ah-dialog aa-form" data-testid="schedule-form" aria-labelledby="aa-form-title">
          <Heading slot="title" id="aa-form-title">{editing ? `Muokkaa: ${initial.name}` : 'Uusi ajastus'}</Heading>
          <p className="aa-note">Jokainen ajo aloittaa uuden keskustelun työtilassa ja antaa agentille alla olevan ohjeen. Ajo käyttää valitun mallin kiintiötä kuten tavallinen viesti.{editing ? ' Muutos koskee seuraavasta ajosta alkaen.' : ''}</p>
          <label className="aa-field">Nimi
            <input data-testid="form-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="esim. README-tarkistus" />
          </label>
          <div className="aa-field-row">
            <label className="aa-field">Työtila
              <select data-testid="form-ws" value={f.ws} onChange={(e) => set('ws', e.target.value)}>{WSS.map((w) => <option key={w}>{w}</option>)}</select>
            </label>
            <label className="aa-field">Malli
              <select data-testid="form-model" value={f.model} onChange={(e) => set('model', e.target.value)}>{MODELS.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
          </div>
          <label className="aa-field">Ohje
            <textarea data-testid="form-prompt" rows={4} value={f.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder="Mitä agentin tehdään joka kerta?" />
          </label>
          <div className="aa-field">
            <span>Toistuu</span>
            <Segmented data-testid="form-cadence" label="Toistuu" size="row" value={f.cadence} onChange={(c) => set('cadence', c)}
              options={[{id: 'daily', label: 'Päivittäin'}, {id: 'weekdays', label: 'Arkisin'}, {id: 'weekly', label: 'Viikoittain'}, {id: 'monthly', label: 'Kuukausittain'}]} />
          </div>
          {f.cadence === 'weekly' ? (
            <fieldset className="aa-days" data-testid="form-days" aria-label="Viikonpäivät">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <ControlButton key={d} size="row" variant="quiet" presentation="segment" aria-pressed={f.days.includes(d)} data-testid={`form-day-${d}`} onPress={() => toggleDay(d)}>{WD[d]}</ControlButton>
              ))}
            </fieldset>
          ) : null}
          <div className="aa-field-row">
            {f.cadence === 'monthly' ? (
              <label className="aa-field">Päivä
                <select data-testid="form-monthday" value={f.monthDay} onChange={(e) => set('monthDay', Number(e.target.value))}>{Array.from({length: 28}, (_, i) => <option key={i} value={i + 1}>{i + 1}.</option>)}</select>
              </label>
            ) : null}
            <label className="aa-field">Kellonaika
              <input data-testid="form-time" value={f.time} inputMode="decimal" aria-invalid={!timeOk || undefined} onChange={(e) => set('time', e.target.value)} />
            </label>
            <label className="aa-field aa-grow">Aikavyöhyke
              <select data-testid="form-zone" value={f.zone} onChange={(e) => set('zone', e.target.value)}>{ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}</select>
            </label>
          </div>
          <fieldset className="aa-field aa-radios" data-testid="form-notify">
            <legend>Kun ajo valmistuu</legend>
            {(['always', 'attention'] as const).map((n) => (
              <label key={n}><input type="radio" name="notify" checked={f.notify === n} onChange={() => set('notify', n)} />{NOTIFY[n]}</label>
            ))}
          </fieldset>
          <p className="aa-next" data-testid="form-next">{next ? `Ensimmäinen ajo ${full(next)}.` : timeOk ? 'Täytä nimi ja ohje.' : 'Kirjoita kellonaika muodossa 6.00.'}</p>
          <div className="ah-dialog-actions">
            <ControlButton data-testid="form-cancel" size="page" variant="secondary" onPress={onClose}>Peruuta</ControlButton>
            <ControlButton data-testid="form-save" size="page" variant="primary" isDisabled={!ok} onPress={() => onSave(f)}>{editing ? 'Tallenna' : 'Luo ajastus'}</ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- Pages ----------
function SchedulesPage({store, id}: {store: Store; id?: string}) {
  const navigate = useNavigate();
  const sel = id ?? (store.phone ? undefined : store.list[0]?.id);
  const showList = !store.phone || !id;
  const attention = store.list.filter((s) => health(s) === 'failed' || s.paused === 'failures').length;
  return (
    <section className="aa-page" data-testid="schedules-page" data-detail={id ? '' : undefined}>
      {showList ? (
        <div className="aa-page-list">
          <header className="aa-page-head">
            <div>
              <h1 tabIndex={-1} data-testid="schedules-title">Ajastukset</h1>
              <p className="aa-note">Työ, jonka agentti tekee puolestasi toistuvasti. {store.list.filter((s) => !s.paused).length} käytössä{attention ? `, ${attention} vaatii huomiota` : ''}.</p>
            </div>
            <ControlButton data-testid="schedule-new" size="row" variant="primary" onPress={() => store.edit()}><Icon name="plus" />Uusi ajastus…</ControlButton>
          </header>
          <ScheduleList store={store} current={sel} onOpen={(x) => navigate(`/schedules/${x}`)} />
        </div>
      ) : null}
      {sel && (!store.phone || id) ? (
        <div className="aa-page-detail">
          <ScheduleDetail store={store} id={sel} backLabel="Ajastukset" onBack={() => navigate('/schedules')} />
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceHome({store, ws, id}: {store: Store; ws: string; id?: string}) {
  const navigate = useNavigate();
  // biome-ignore lint/suspicious/noExplicitAny: synthetic workspace with the fields the actions read.
  const workspace = {workspace_id: `ws_${ws}`, name: ws, path: `/home/maija/src/${ws}`, kind: 'git_main_worktree', visibility: 'visible', mutation_state: 'allowed', git_summary: {github_repo: `maija/${ws}`}} as any;
  return (
    <div className="ah-state">
      <div className="ah-workspace-page" data-testid="workspace-page">
        <header className="ah-workspace-page-head">
          <div className="ah-workspace-page-title">
            <h1 data-testid="workspace-title" tabIndex={-1}>{ws}</h1>
            <p><code>~/src/{ws}</code></p>
          </div>
          <WorkspaceActions page workspace={workspace} onNew={() => toast('Uusi keskustelu avautuisi.')} onNewWorktree={noop} />
        </header>
        {id ? (
          <ScheduleDetail store={store} id={id} backLabel={ws} onBack={() => navigate(wsPath(ws))} />
        ) : (
          <section className="aa-ws-section" data-testid="workspace-schedules" aria-labelledby="aa-ws-h">
            <header className="aa-ws-head">
              <h2 id="aa-ws-h"><Icon name="clock" />Ajastetut ajot</h2>
              <div className="aa-ws-actions">
                {store.d === 0 ? <ControlButton data-testid="all-schedules" size="row" variant="quiet" onPress={() => navigate('/schedules')}>Kaikki ajastukset</ControlButton> : null}
                <ControlButton data-testid="schedule-new" size="row" variant="secondary" onPress={() => store.edit(undefined, ws)}><Icon name="plus" />Uusi ajastus…</ControlButton>
              </div>
            </header>
            <ScheduleList store={store} ws={ws} onOpen={(x) => navigate(store.d === 0 ? `/schedules/${x}` : `${wsPath(ws)}/schedules/${x}`)} />
          </section>
        )}
        <p className="aa-note">Työtilan muut osat (keskustelut, worktreet, asetukset) ovat tuotannon työtilasivulla; vedos näyttää vain otsikkorivin ja ajastukset.</p>
      </div>
    </div>
  );
}

// ---------- Run conversations ----------
const MODEL = (m: string) => <ControlButton size="inline" variant="quiet" className="aa-model" onPress={() => toast('Mallin valinta ei ole tässä vedoksessa.')}>{m}</ControlButton>;

function RunLine({s, r, onOpen}: {s: Schedule; r: Run; onOpen: () => void}) {
  return (
    <aside className="ah-wake-line aa-run-line" role="note" data-testid="run-line" data-late={r.started ? '' : undefined}>
      <Icon name="clock" className="ah-wake-icon" aria-hidden="true" />
      <span className="ah-wake-line-who">Open Habitat</span>{' '}
      <span>
        {r.started
          ? <>aloitti ajastetun ajon <strong>{s.name}</strong> vasta {full(r.started)}, vaikka se oli ajastettu {full(r.at)}: palvelin ei ollut käynnissä. Yksi ajo jäi kokonaan väliin.</>
          : <>aloitti ajastetun ajon <strong>{s.name}</strong> {full(r.at)}.</>}
        {' '}<ControlButton size="inline" variant="quiet" className="aa-line-link" data-testid="run-line-schedule" onPress={onOpen}>Avaa ajastus</ControlButton>
      </span>
    </aside>
  );
}

const README_REPLY = 'Kävin läpi README:n ja `docs/kuvat/`-hakemiston ja vertasin niitä sovellukseen.\n\n- **Päivitetty:** `docs/kuvat/etusivu.avif` ja `docs/kuvat/asetukset.avif` (uusi sivupalkki ja Tuotokset-paikka).\n- **Teksti:** asennusohjeen Node-versio 20 → 22.\n- Muutokset ovat haarassa `readme/30-11`. En yhdistänyt sitä päähaaraan.\n\nKatso kuvat ja yhdistä, jos ne näyttävät oikeilta.';
const DEPS_REPLY = 'Ajoin `npm outdated` ja päivitin kaksi patch-versiota haaraan `deps/24-11`. Testit menivät läpi (148/148). Major-päivityksiä odottaa yksi: `express` 4 → 5.';
const REPORT_FAIL = 'Mallin käyttökiintiö on täynnä (claude-sonnet-4-5). Pyyntöä ei käsitelty.';

function RunConversation({store, conv}: {store: Store; conv: string}) {
  const navigate = useNavigate();
  const s = store.list.find((x) => x.runs.some((r) => r.conv === conv)) ?? (conv === 'run-readme' ? store.list.find((x) => x.id === 'readme') : undefined);
  const r = s?.runs.find((x) => x.conv === conv) ?? s?.runs[0];
  const [sent, setSent] = useState<string[]>([]);
  const [field, setField] = useState('');
  if (!s || !r) return <p className="aa-empty">Keskustelua ei löydy.</p>;
  const openSchedule = () => navigate(store.d === 0 ? `/schedules/${s.id}` : `${wsPath(s.ws)}/schedules/${s.id}`);
  const reply = conv === 'run-report' ? REPORT_FAIL : conv === 'run-deps-late' ? DEPS_REPLY : conv === 'run-deps' ? 'Ei päivitettävää: kaikki riippuvuudet ovat ajan tasalla.' : README_REPLY;
  const working = r.state === 'working';
  const failed = r.state === 'failed';
  const time = hm(r.started ?? r.at);
  const items = [
    {id: 'line', content: <RunLine s={s} r={r} onOpen={openSchedule} />},
    {id: 'prompt', content: <UserMessage sourceText={s.prompt} time={time} onCopy={noop}><Markdown text={s.prompt} /></UserMessage>},
    ...(working ? [] : [{id: 'reply', content: (
      <AssistantMessage time={failed ? time : hm((r.started ?? r.at) + 11 * 60e3)} streamState={failed ? 'failed' : 'complete'} onCopy={noop}><Markdown text={reply} /></AssistantMessage>
    )}]),
    ...(failed ? [{id: 'after', content: (
      <aside className="ah-wake-line aa-run-line" role="note" data-testid="run-after" data-late="">
        <Icon name="warning" className="ah-wake-icon" aria-hidden="true" />
        <span className="ah-wake-line-who">Open Habitat</span>{' '}
        <span>Ajoa ei yritetty uudelleen, koska uusi yritys kuluttaisi samaa kiintiötä. Ajastus jatkuu: seuraava ajo {(() => { const n = nextRun(s); return n ? full(n) : '–'; })()}. Voit myös vastata tähän, kun kiintiö on palautunut.</span>
      </aside>
    )}] : []),
    ...sent.map((m, i) => ({id: `s${i}`, content: <UserMessage sourceText={m} time="9.13" delivery="pending" onCopy={noop}><Markdown text={m} /></UserMessage>})),
  ];
  const title = `${s.name} · ${day(r.at)}`;
  return (
    <div className="aa-frame" data-testid="run-conversation" data-run={r.state}>
      <ConversationFrame>
        <AgentHeader title={title} workspaceLabel={s.ws} workspaceHref={wsPath(s.ws)}
          activityLabel={working ? 'Työskentelee' : failed ? 'Epäonnistui' : 'Valmis'} activityKind={working ? 'working' : failed ? 'error' : 'success'} activityAnimated={working}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop}
          detailsFacts={[{label: 'Työtila', value: `~/src/${s.ws}`}, {label: 'Ajastus', value: s.name}]} />
        <ConversationStream>
          <ConversationTimeline state="ready" items={items} latestWorking={working} latestDuration={working ? '2 min' : undefined} onJumpToLatest={noop} />
        </ConversationStream>
        <Composer value={field} onChange={setField} activity={working ? 'working' : 'idle'} selectedWorkingMode="follow_up" onModeChange={noop}
          onSendNow={() => { if (field.trim()) { setSent((x) => [...x, field]); setField(''); } }} onSteer={noop} onFollowUp={noop} onInterrupt={noop} csrf="prototype" modelPicker={MODEL(s.model)} />
      </ConversationFrame>
    </div>
  );
}

function ProposalConversation({store}: {store: Store}) {
  const navigate = useNavigate();
  const [state, setState] = useState<'open' | 'made' | 'no'>('open');
  const [field, setField] = useState('');
  const proposal: Draft = {
    id: 'links', name: 'Rikkinäiset linkit', ws: 'kotisivu', model: 'oletusmalli',
    prompt: 'Käy sivuston kaikki sivut läpi (`npm run build && npx linkinator dist`). Listaa rikkinäiset linkit sivuittain ja korjaa ilmeiset kirjoitusvirheet omaan haaraansa.',
    cadence: 'monthly', days: [1], monthDay: 1, time: '8.00', zone: 'Europe/Helsinki', notify: 'always',
  };
  const made = store.list.find((s) => s.id === 'links' || s.name === proposal.name);
  useEffect(() => { if (made && state === 'open') setState('made'); }, [made, state]);
  const create = (d: Draft) => {
    store.set((l) => [...l, {...d, id: 'links', createdAt: NOW, proposed: true, runs: []}]);
    setState('made'); toast(`${d.name} luotu.`);
  };
  const ask = 'Tarkistaisitko kerran kuussa, onko sivustolla rikkinäisiä linkkejä?';
  const items = [
    {id: 'u', content: <UserMessage sourceText={ask} time="9.02" onCopy={noop}><Markdown text={ask} /></UserMessage>},
    {id: 'a', content: (
      <AssistantMessage time="9.03" streamState="complete" onCopy={noop}>
        <Markdown text="Voin ehdottaa ajastusta. Se aloittaa kuukauden ensimmäisenä päivänä uuden keskustelun tähän työtilaan ja antaa sille alla olevan ohjeen. Ajastus syntyy vasta, kun hyväksyt sen." />
      </AssistantMessage>
    )},
    {id: 'card', content: (
      <section className="aa-proposal" data-testid="proposal-card" data-state={state} aria-labelledby="aa-prop-h">
        <header>
          <Icon name="clock" />
          <h3 id="aa-prop-h">{state === 'made' ? 'Ajastus luotu' : state === 'no' ? 'Ehdotus hylätty' : 'Agentti ehdottaa ajastusta'}</h3>
        </header>
        <dl className="aa-facts aa-facts-compact">
          <div><dt>Nimi</dt><dd>{made?.name ?? proposal.name}</dd></div>
          <div><dt>Työtila</dt><dd><code>{proposal.ws}</code></dd></div>
          <div><dt>Toistuu</dt><dd>{cadenceText(made ?? proposal)}</dd></div>
          <div><dt>Malli</dt><dd><code>{made?.model ?? proposal.model}</code></dd></div>
        </dl>
        <blockquote><Markdown text={made?.prompt ?? proposal.prompt} /></blockquote>
        {state === 'open' ? (
          <>
            <p className="aa-note">Ehdotus ei ole vielä mitään. Kun luot sen, ensimmäinen ajo on {full(nextRun(proposal)!)}.</p>
            <div className="aa-actions" data-testid="proposal-actions">
              <ControlButton data-testid="proposal-create" size="row" variant="primary" onPress={() => create(proposal)}>Luo ajastus</ControlButton>
              <ControlButton data-testid="proposal-edit" size="row" variant="secondary" onPress={() => store.edit({...proposal, createdAt: NOW, runs: [], proposed: true}, undefined)}>Muokkaa…</ControlButton>
              <ControlButton data-testid="proposal-no" size="row" variant="quiet" onPress={() => { setState('no'); toast('Agentille kerrotaan seuraavan viestisi mukana, ettet halunnut ajastusta.'); }}>Ei</ControlButton>
            </div>
          </>
        ) : state === 'made' ? (
          <div className="aa-actions">
            <p className="aa-note">Ensimmäinen ajo {made ? full(nextRun(made) ?? NOW) : ''}.</p>
            <ControlButton data-testid="proposal-open" size="row" variant="secondary" onPress={() => navigate(store.d === 0 ? '/schedules/links' : `${wsPath('kotisivu')}/schedules/links`)}>Avaa ajastus</ControlButton>
          </div>
        ) : <p className="aa-note">Ajastusta ei luotu.</p>}
      </section>
    )},
  ];
  return (
    <div className="aa-frame" data-testid="proposal-conversation">
      <ConversationFrame>
        <AgentHeader title="Sivuston ylläpito" workspaceLabel="kotisivu" workspaceHref={wsPath('kotisivu')} activityLabel="Valmis" activityKind="success"
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} detailsFacts={[{label: 'Työtila', value: '~/src/kotisivu'}]} />
        <ConversationStream>
          <ConversationTimeline state="ready" items={items} onJumpToLatest={noop} />
        </ConversationStream>
        <Composer value={field} onChange={setField} activity="idle" selectedWorkingMode="follow_up" onModeChange={noop}
          onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} csrf="prototype" modelPicker={MODEL('oletusmalli')} />
      </ConversationFrame>
    </div>
  );
}

// ---------- Rail ----------
function Rail({store, path}: {store: Store; path: string}) {
  const navigate = useNavigate();
  const readme = store.list.find((s) => s.id === 'readme');
  const report = store.list.find((s) => s.id === 'report');
  const deps = store.list.find((s) => s.id === 'deps');
  const working = readme?.runs[0]?.state === 'working';
  const base = {controlLabel: '', activity: 'idle'};
  const conv = (id: string) => `/agents/${id}`;
  const runRow = (id: string, s: Schedule, extra: object) => ({
    ...base, agentId: id, href: conv(id), title: `${s.name} · ${day(s.runs.find((r) => r.conv === id)?.at ?? NOW)}`,
    workspaceId: `ws_${s.ws}`, workspaceName: s.ws, selected: path === conv(id), ...extra,
  });
  const yours = [
    ...(readme && !working ? [runRow('run-readme', readme, {activityLabel: 'Uusi vastaus', attentionLabel: 'Uusi', detail: `${readme.ws} · Ajastettu ajo · Uusi vastaus`, changedAt: ago(192)})] : []),
    ...(report?.runs[0]?.state === 'failed' ? [runRow('run-report', report, {activityLabel: 'Epäonnistui', failed: true, detail: `${report.ws} · Ajastettu ajo epäonnistui`, changedAt: ago(3 * 1440)})] : []),
    {...base, agentId: 'proposal', href: conv('proposal'), title: 'Sivuston ylläpito', activityLabel: 'Uusi vastaus', attentionLabel: 'Uusi', workspaceId: 'ws_kotisivu', workspaceName: 'kotisivu', detail: 'kotisivu · Uusi vastaus', selected: path === conv('proposal'), changedAt: ago(9)},
  ];
  const running = [
    ...(readme && working ? [runRow('run-readme', readme, {activity: 'working', activityLabel: 'Työskentelee', detail: `${readme.ws} · Ajastettu ajo · Työskentelee`})] : []),
    {...base, agentId: 'pi:w', href: conv('w'), title: 'Laskutusnäkymän taulukko', activity: 'working', activityLabel: 'Työskentelee', workspaceId: 'ws_aurinkokello', workspaceName: 'aurinkokello', detail: 'aurinkokello · Työskentelee'},
  ];
  const quiet = [
    ...(deps ? [runRow('run-deps', deps, {activity: 'closed', activityLabel: 'Valmis', detail: `${deps.ws} · Ajastettu ajo · Valmis`, changedAt: ago(100)})] : []),
    ...(deps ? [runRow('run-deps-late', deps, {activity: 'closed', activityLabel: 'Valmis', detail: `${deps.ws} · Ajastettu ajo · Valmis`, changedAt: ago(6 * 1440)})] : []),
    {...base, agentId: 'pi:q', href: conv('q'), title: 'Muistiinpanojen haku', activity: 'closed', activityLabel: 'Valmis', workspaceId: 'ws_muistiinpanot', workspaceName: 'muistiinpanot', changedAt: ago(2 * 1440)},
  ];
  const attention = store.list.filter((s) => health(s) === 'failed' || s.paused === 'failures').length;
  const go = (href: string) => navigate(href);
  // biome-ignore lint/suspicious/noExplicitAny: the round's own place id; its icon is patched above.
  const places: any[] = [{id: 'shares', testId: 'rail-shares', label: 'Tuotokset', href: '/shares', onNavigate: () => toast('Tuotokset ei ole tässä vedoksessa.'), current: false}];
  if (store.d === 0) places.push({id: 'schedules', testId: 'rail-schedules', label: 'Ajastukset', href: '/schedules', onNavigate: go, current: path.startsWith('/schedules'), count: attention ? String(attention) : undefined, said: attention ? `Ajastukset, ${attention} vaatii huomiota` : undefined});
  const workspaces = WSS.map((w) => ({id: `ws_${w}`, name: w}));
  const phoneRow = store.d === 0 && store.phone ? (
    <div className="ah-rail-home-row">
      <button type="button" className="ah-rail-home aa-phone-place" data-testid="rail-schedules" aria-current={path.startsWith('/schedules') ? 'page' : undefined} onClick={() => go('/schedules')}>
        <Icon name="clock" /><span className="ah-rail-home-label">Ajastukset</span>
        {attention ? <span className="ah-rail-place-count">{attention}</span> : null}
      </button>
    </div>
  ) : undefined;
  return (
    <WorkspaceRail adaptive={{places, search: {label: 'Hae', keyHint: 'Ctrl K', onOpen: noop}, filter: false}} phoneLayout={store.phone}
      collapsed={false} serverLabel="habitat.example" connectionLabel="Yhteydessä" connectionTone="success" filterValue="" resultSummary="4 työtilaa" listState="ready"
      pages={phoneRow} onToggle={noop} onFilter={noop} onRefresh={noop}
      now={
        // biome-ignore lint/suspicious/noExplicitAny: synthetic rows.
        <NowSections workspaces={workspaces} yours={yours as any} running={running as any}
          quiet={<QuietSection choice={{sort: 'newest', workspace: null}} workspaces={workspaces} rows={quiet as any} />} />
      }>
      {WSS.map((w) => <WorkspaceNavRow key={w} name={w} href={wsPath(w)} selected={path.startsWith(wsPath(w))} />)}
    </WorkspaceRail>
  );
}

// ---------- The page ----------
function Page({store, editing, closeEdit}: {store: Store; editing?: {draft: Draft; edit: boolean}; closeEdit: (saved?: Draft) => void}) {
  const {pathname} = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  let main: ReactNode;
  let title = 'Ajastukset';
  if (parts[0] === 'schedules') main = <SchedulesPage store={store} id={parts[1]} />;
  else if (parts[0] === 'workspaces') {
    const ws = parts[1].replace(/^ws_/, '');
    title = ws;
    main = <WorkspaceHome store={store} ws={ws} id={parts[2] === 'schedules' ? parts[3] : undefined} />;
  } else if (parts[0] === 'agents' && parts[1] === 'proposal') { title = 'Sivuston ylläpito'; main = <ProposalConversation store={store} />; }
  else if (parts[0] === 'agents' && parts[1].startsWith('run-')) { title = 'Ajastettu ajo'; main = <RunConversation key={parts[1]} store={store} conv={parts[1]} />; }
  else main = <p className="aa-empty">Tämä keskustelu ei ole vedoksessa. Valitse ajastettu ajo tai ehdotus Sinun vuorosi -osiosta.</p>;
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} rail={<Rail store={store} path={pathname} />} main={main} />
      {editing ? <ScheduleForm initial={editing.draft} editing={editing.edit} onClose={() => closeEdit()} onSave={(d) => closeEdit(d)} /> : null}
    </StatusBellProvider>
  );
}

function Navigator({to, gen}: {to: string; gen: number}) {
  const navigate = useNavigate();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new target or a remount navigates.
  useEffect(() => { navigate(to); }, [to, gen]);
  return null;
}

// ---------- Review chrome ----------
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};

const phoneQuery = () => matchMedia('(max-width: 800px)').matches;

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [sid, setSid] = useState<SId>(initialScenario);
  const fresh = (id: SId) => { const l = clone(); SCENARIOS[id].mutate?.(l); return l; };
  const [list, setList] = useState<Schedule[]>(() => fresh(initialScenario));
  const [gen, setGen] = useState(0);
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState(phoneQuery());
  const [editing, setEditing] = useState<{draft: Draft; edit: boolean} | undefined>(SCENARIOS[initialScenario].create ? {draft: blank(), edit: false} : undefined);
  const [jump, setJump] = useState<string>();
  const bar = useRef<HTMLElement>(null);
  toast = setNote;
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { const m = matchMedia('(max-width: 800px)'); const f = () => setPhone(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 3600); return () => clearTimeout(id); }, [note]);
  const choose = (next: SId) => {
    initialScenario = next; setSid(next); setList(fresh(next)); setJump(undefined); setNote('');
    setEditing(SCENARIOS[next].create ? {draft: blank(), edit: false} : undefined); setGen((g) => g + 1);
    const url = new URL(location.href); url.searchParams.set('s', next); history.replaceState(null, '', url);
  };
  const store: Store = {
    list, d: direction, phone,
    set: (fn) => setList((l) => fn(l)),
    edit: (s, ws) => setEditing(s ? {draft: {...s}, edit: !!s.id && list.some((x) => x.id === s.id)} : {draft: blank(ws), edit: false}),
  };
  const closeEdit = (d?: Draft) => {
    const was = editing;
    setEditing(undefined);
    if (!d || !was) return;
    if (was.edit) { setList((l) => l.map((x) => x.id === d.id ? {...x, ...d} : x)); toast(`${d.name} tallennettu. Muutos koskee seuraavasta ajosta alkaen.`); return; }
    const id = d.id || `s${Date.now().toString(36)}`;
    setList((l) => [...l, {...d, id, createdAt: NOW, runs: [], proposed: d.id === 'links' || undefined}]);
    const n = nextRun({...d, paused: undefined});
    toast(`${d.name} luotu. Ensimmäinen ajo ${n ? full(n) : '–'}.`);
    setJump(direction === 0 ? `/schedules/${id}` : `${wsPath(d.ws)}/schedules/${id}`);
  };
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={sid}>
      <header className="rq-bar" ref={bar}>
        <strong>Ajastetut ajot 1</strong>
        <label>Tilanne <select id="scenario" value={sid} onChange={(e) => choose(e.target.value as SId)}>
          {SIDS.map((id) => <option key={id} value={id}>{SCENARIOS[id].label}</option>)}</select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
          <option value="light">Päivä</option><option value="dark">Yö</option></select></label>
        <span className="rq-state">Nyt: ma 30.11.2026 klo 9.12</span>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{RECOMMEND}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${gen}-${sid}`} enabled={false}>
          <MemoryRouter key={`${gen}-${sid}`} initialEntries={[SCENARIOS[sid].path(direction)]}>
            {jump ? <Navigator to={jump} gen={gen} /> : null}
            <Page store={store} editing={editing} closeEdit={closeEdit} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {note ? <p className="rq-toast" role="status" data-testid="rq-toast">{note}</p> : null}
    </div>
  );
}

const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { flushSync(() => reactRoot.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
const startAt = Math.max(0, Math.min(NAMES.length - 1, Number(param.get('v') ?? 1) - 1));
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === startAt) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
if (startAt) (picker.children[startAt + 1] as HTMLButtonElement).click();
