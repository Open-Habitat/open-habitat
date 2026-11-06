import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings, AccountShelf} from '../../../../web/src/components/Account';
import {SettingsSearchField} from '../../../../web/src/components/SettingsSearch';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {shownSettingsSections} from '../../../../web/src/app/settingsIndex';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import integrationsExample from '../../../../contracts/v1/examples/integrations.json';
import serverIntegrationsExample from '../../../../contracts/v1/examples/server-integrations.json';
import onboardingExample from '../../../../contracts/v1/examples/server-onboarding-site-key.json';
import copiesExample from '../../../../contracts/v1/examples/server-onboarding-site-key-copies.json';
import viewAddressesExample from '../../../../contracts/v1/examples/view-addresses.json';
import publicationsExample from '../../../../contracts/v1/examples/server-view-publications.json';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-server-settings-overview. Jari 6.11., Contoso's setup with Aino: an
// administrator who opens the server settings finds the left list still at
// the person's own sections, and there are so many that the server's lower
// sections (integrations, for one) are out of sight. The axis is where the
// server's sections live and how many of them the administrator sees at
// once: A one server entry whose page is an overview of every section and
// its state; B a server area of its own with only the server's seven
// sections in its navigation; C the left list folds into groups and the
// right side shows every section of the chosen group one after another.
// Today is the production AccountSettings unchanged. The directions use the
// same production section content (AccountSettings drawing one section, its
// own list hidden) inside the round's navigation. The host behind them is a
// fetch stand-in built from contracts/v1/examples. Everything is synthetic.
const directions = ['Nyt', 'A Yleiskuva', 'B Oma alue', 'C Ryhmät'];
const LINES = [
  'Nyt: henkilön 13 osiota ja palvelimen 7 samassa listassa. Palvelimen asetukset avautuvat Palvelin-osioon, lista on alussa ja integraatiot ovat näkymän alapuolella.',
  'A Yleiskuva: palvelin on listassa yksi rivi heti haun alla. Sen sivu luettelee kaikki seitsemän osiota ja kunkin tilan; osio avautuu riviltä ja palaa yleiskuvaan.',
  'B Oma alue: Palvelimen ylläpito on oma alueensa, jonka lyhyt lista sisältää vain palvelimen seitsemän osiota. Omat asetukset ovat alueen yläreunan linkin takana.',
  'C Ryhmät: vasen lista on kuusi ryhmää. Oikealla näkyvät ryhmän kaikki osiot peräkkäin, ja yläreunan pikalinkit vievät osioon, esimerkiksi integraatioihin.',
];
const NYT = 0, A = 1, B = 2, C = 3;

// ---- Sections: production ids, names and icons ----
const ALL = shownSettingsSections('fi');
type Sec = (typeof ALL)[number];
const byId = new Map(ALL.map((s) => [s.id as string, s]));
const PERSONAL = ALL.filter((s) => !s.admin);
const SERVER = ALL.filter((s) => s.admin);
const sec = (id: string) => byId.get(id)!;
/** C: the person's thirteen sections in five groups and the server's seven in one. */
const GROUPS: {id: string; label: string; icon: Sec['icon']; sections: string[]}[] = [
  {id: 'tili', label: 'Tili ja laitteet', icon: 'user', sections: ['tili', 'laitteet', 'avaimet']},
  {id: 'tekoaly', label: 'Tekoäly', icon: 'agent', sections: ['tekoaly', 'tilannekatsaus', 'sanelu']},
  {id: 'yhteydet', label: 'Yhteydet', icon: 'plug', sections: ['koodipalvelut', 'tiedot', 'omatkoneet']},
  {id: 'ulkoasu', label: 'Ulkoasu ja editori', icon: 'eye', sections: ['ulkoasu', 'editori', 'kokeelliset']},
  {id: 'tila', label: 'Tallennustila', icon: 'disk', sections: ['tila']},
  {id: 'palvelin', label: 'Palvelimen ylläpito', icon: 'server', sections: SERVER.map((s) => s.id)},
];
const groupOf = (id: string) => GROUPS.find((g) => g.sections.includes(id))!;
/** Shorter names inside the server's own lists, where "Palvelin" is the context. */
const SHORT: Record<string, string> = {palvelin: 'Yleiset', palvelinintegraatiot: 'Integraatiot'};
const shortLabel = (id: string) => SHORT[id] ?? sec(id).label;

// ---- Host stand-in: a company installation in its first week ----
const GiB = 1024 ** 3;
const PEOPLE = [
  {id: '1000', username: 'aino', hint: 'aino-contoso', admin: true, source: 'operator', state: 'joined', usage: 14.2},
  {id: '1001', username: 'maintainer', hint: 'maintainer', admin: true, source: 'site_admin', state: 'joined', usage: 6.8},
  {id: '1002', username: 'anna', hint: 'anna-contoso', admin: false, source: 'site_admin', state: 'joined', usage: 3.1},
  {id: '1003', username: 'mikko', hint: 'mikkok', admin: false, source: 'site_admin', state: 'joined', usage: 1.4},
  {id: '1004', username: 'sanna', hint: 'sanna-l', admin: false, source: 'site_admin', state: 'joined', usage: 0.6},
  {id: '1005', username: '', hint: 'liisa-contoso', admin: false, source: 'site_admin', state: 'allowed', usage: 0},
];
const at = '2026-11-06T09:30:00Z';
const access = () => ({
  schema_version: 1, mode: 'allowlist', runtime_admission: true, teams: [],
  entries: PEOPLE.map((p) => ({
    id: p.id, source: p.source, state: p.state, ...(p.username ? {username: p.username} : {}), login_hint: p.hint,
    ...(p.source === 'site_admin' ? {actor: '1000', at} : {}), ...(p.state === 'joined' ? {last_seen: at} : {}),
    administrator: p.admin, denied: false,
    ...(p.admin ? {administrator_role: {source: p.source === 'operator' ? 'operator' : 'site_admin', state: 'granted', ...(p.source === 'operator' ? {} : {actor: '1000', at})}} : {}),
  })),
});
const integrationApps = {...serverIntegrationsExample};
// Google set in the browser, Dropbox by the operator, Microsoft 365 not yet.
const providers = integrationsExample.providers.map((p) =>
  p.id === 'google' ? {id: p.id, available: true, login: p.login, services: p.services}
  : p.id === 'microsoft' ? {id: p.id, available: false, unavailable_reason: 'app_credentials_required', login: p.login, services: p.services}
  : p);
const storage = {
  schema_version: 1, limits: 'not_in_use', overcommitted: null, users: [],
  filesystem: {capacity_bytes: 500 * GiB, free_bytes: 312 * GiB},
};
const copies = {...copiesExample, people: PEOPLE.filter((p) => p.state === 'joined').map((p, i) => ({
  id: p.id, login_hint: p.hint, username: p.username,
  ...(i < 4 ? {copy: {provider: 'anthropic', suffix: 'Xa1b', at: '2026-11-04T09:05:00Z', current: true}} : {}),
})), waiting: 1};

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(60);
  if (path === '/api/v1/server') return json({schema_version: 1, name: 'Contoso', administrator: true, version: '0.42.0', commit: '1def125b6d0c4e2f9a8b7c6d5e4f3a2b1c0d9e8f'});
  if (path === '/api/v1/server/administration')
    return json({schema_version: 1, name: 'Contoso', default_language: 'fi', default_limit_bytes: 50 * GiB,
      users: PEOPLE.filter((p) => p.username).map(({id, username, admin}) => ({id, username, administrator: admin}))});
  if (path === '/api/v1/server/storage') return json(storage);
  if (path === '/api/v1/server/access') return json(access());
  if (path === '/api/v1/server/view-publications') return json({...publicationsExample, publications: publicationsExample.publications.map((p) => ({...p, username: 'anna', title: 'Tarjouslaskuri'}))});
  if (path === '/api/v1/server/integrations') return json(integrationApps);
  if (path === '/api/v1/integrations') return json({...integrationsExample, providers, accounts: []});
  if (path === '/api/v1/server/onboarding') return json({...onboardingExample, repositories: {mode: 'preselected', defaults: ['contoso/tarjoukset', 'contoso/ohjeet']}, integrations: [{provider: 'google', required: false}]});
  if (path === '/api/v1/server/onboarding/ai-key/copies') return json(copies);
  if (path === '/api/v1/account/git-identity')
    return json({schema_version: 1, name: 'Jari Mustonen', email: 'jari@example.test', source: '~/.gitconfig', suggested_name: 'Jari Mustonen', suggested_email: 'jari@example.test', emails: ['jari@example.test']});
  if (path === '/api/v1/view-addresses') return json(viewAddressesExample);
  if (path === '/api/v1/server/speech-key') return json({schema_version: 1});
  if (path === '/api/v1/pi/models')
    return json({schema_version: 1, default_provider: 'claude-bridge', default_model: 'claude-sonnet-5', default_thinking: 'medium', catalog_status: 'native_cached',
      models: [{id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'claude-bridge'}]});
  if (path === '/api/v1/pi/credentials')
    return json({schema_version: 1, openai: {present: false, suffix: null}, anthropic: {present: true, suffix: 'Xa1b'}, deepseek: {present: false, suffix: null}, subscription: {present: false}});
  return new Response('', {status: 404});
};

// Several sections drawn on one page each move focus to their heading when
// they open; on the stacked page (C) that would scroll to the last one.
const focus = HTMLElement.prototype.focus;
HTMLElement.prototype.focus = function (options?: FocusOptions) {
  return focus.call(this, this.closest?.('.rq-stack') ? {...options, preventScroll: true} : options);
};

// ---- What the overview (A) says about each server section ----
/** One line per section: what an administrator needs to know before
 * opening it. Read from the same stand-in the sections themselves read. */
const STATE: Record<string, {text: string; tone?: 'warning' | 'success'}> = {
  palvelin: {text: 'Contoso · oletuskieli suomi · versio 0.42.0'},
  palvelinintegraatiot: {text: 'Google ja Dropbox käytössä · Microsoft 365 ei asetettu', tone: 'warning'},
  aiavain: {text: 'Anthropic-avain …Xa1b · annettu 4 henkilölle, 1 odottaa', tone: 'success'},
  saneluavain: {text: 'Ei asetettu: jokainen tarvitsee oman Soniox-avaimen'},
  kayttoonotto: {text: 'Uudet saavat 2 työtilaa ja tekoälyn sivuston avaimella'},
  kayttajat: {text: '6 henkilöä · 2 ylläpitäjää · 1 ei ole vielä kirjautunut'},
  levy: {text: '312 Gt vapaana 500 Gt:sta · henkilöillä ei rajoja'},
};

// ---- Settings frame ----
const noop = () => {};
const href = (id: string) => `/settings/${id}`;
/** Routes inside the round: /settings (the list on the phone), /settings/<id>,
 * /settings/admin (A's overview, B's area list on the phone) and
 * /settings/group/<id> (C). */
function parse(path: string) {
  const [, , a, b] = path.split('/');
  if (!a) return {kind: 'list' as const};
  if (a === 'admin') return {kind: 'admin' as const};
  if (a === 'group') return {kind: 'group' as const, id: b};
  return {kind: 'section' as const, id: a};
}

/** One production section, its own list, close and back hidden. */
function One({id, onNavigate, onClose}: {id: string; onNavigate: (p: string) => void; onClose: () => void}) {
  return (
    <div className="rq-embed" data-section={id}>
      <AccountSettings routeSection={id} onNavigate={(p) => onNavigate(p.replace(/^\/settings\/([^#]+).*/, (_, slug) => href(slugToId(slug))))}
        profile={{name: 'Jari Mustonen', email: '', avatar_url: ''}} csrf="prototype"
        modelSelector={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>}
        onClose={onClose} />
    </div>
  );
}
const SLUGS: Record<string, string> = {tili: 'account', laitteet: 'devices', avaimet: 'keys', tekoaly: 'ai', tilannekatsaus: 'recap', koodipalvelut: 'code-hosts', tiedot: 'agent-data', omatkoneet: 'machines', ulkoasu: 'appearance', editori: 'editor', sanelu: 'speech', tila: 'storage', kokeelliset: 'experimental', palvelin: 'server', palvelinintegraatiot: 'server-integrations', aiavain: 'ai-key', saneluavain: 'speech-key', kayttoonotto: 'onboarding', kayttajat: 'users', levy: 'disk'};
const slugToId = (slug: string) => Object.keys(SLUGS).find((k) => SLUGS[k] === slug) ?? slug;
const idToSlug = (id: string) => SLUGS[id] ?? id;

function NavItem({id, label, icon, current, onGo, testid}: {id: string; label: string; icon: Sec['icon']; current: boolean; onGo: () => void; testid?: string}) {
  return (
    <button type="button" className="s-nav-i" data-testid={testid ?? `nav-${id}`} aria-current={current ? 'page' : undefined} onClick={onGo}>
      <Icon name={icon} />{label}
    </button>
  );
}

function Search() {
  // The production field stays in its place; the round does not search.
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  return <SettingsSearchField inputRef={ref} query={q} hits={[]} selected={0} onQuery={setQ} onKeyDown={noop} />;
}

function Frame({direction, onClose}: {direction: number; onClose: () => void}) {
  const location = useLocation();
  const navigate = useNavigate();
  const route = parse(location.pathname);
  const go = (p: string) => navigate(p);
  // A new place opens at its top, as a page would.
  useLayoutEffect(() => { const layer = document.querySelector('.ah-settings-layer'); if (layer) layer.scrollTop = 0; }, [location.pathname]);
  const one = (id: string) => <One key={id} id={id} onNavigate={go} onClose={onClose} />;
  const close = (
    <ControlButton data-testid="settings-close" className="rq-close" size="row" variant="quiet" presentation="icon" aria-label="Sulje asetukset" onPress={onClose}>
      <Icon name="cross" />
    </ControlButton>
  );
  const back = (label: string, to: string, testid = 'back') => (
    <button type="button" className="rq-back" data-testid={testid} onClick={() => go(to)}><Icon name="back" />{label}</button>
  );
  const detail = route.kind !== 'list';

  if (direction === A) {
    const inServer = route.kind === 'admin' || (route.kind === 'section' && sec(route.id)?.admin);
    const nav = (
      <nav className="s-nav rq-nav" data-testid="settings-navigation" aria-label="Asetusten osiot">
        <h1>Asetukset</h1>
        <Search />
        <NavItem id="admin" label="Palvelimen ylläpito" icon="server" current={!!inServer} onGo={() => go('/settings/admin')} />
        <span className="s-nav-h">Omat asetukset</span>
        {PERSONAL.map((s) => <NavItem key={s.id} id={s.id} label={s.label} icon={s.icon} current={route.kind === 'section' && route.id === s.id} onGo={() => go(href(s.id))} />)}
      </nav>
    );
    let main: React.ReactNode = null;
    if (route.kind === 'admin') main = (
      <>
        {back('Asetukset', '/settings', 'list-back')}
        <h2 data-testid="overview-title">Palvelimen ylläpito</h2>
        <p className="s-intro">Contosoin asetukset koskevat kaikkia sen käyttäjiä. Jokainen osio ja sen tila yhdellä silmäyksellä.</p>
        <ul className="s-card rq-overview" data-testid="server-overview">
          {SERVER.map((s) => {
            const st = STATE[s.id];
            return (
              <li key={s.id}>
                <button type="button" className="rq-ov-row" data-testid={`overview-${s.id}`} onClick={() => go(href(s.id))}>
                  <Icon name={s.icon} />
                  <span className="rq-ov-text"><strong>{shortLabel(s.id)}</strong><span className="s-desc">{st.text}</span></span>
                  {st.tone ? <StatusMark label={st.tone === 'warning' ? 'Kesken' : 'Kunnossa'} tone={st.tone} kind={st.tone === 'success' ? 'success' : 'neutral'} /> : <span />}
                  <Icon name="forward" className="rq-chev" />
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );
    else if (route.kind === 'section') main = (
      <>
        {sec(route.id).admin ? (
          <div className="rq-crumb">{back('Palvelimen ylläpito', '/settings/admin', 'overview-back')}</div>
        ) : back('Asetukset', '/settings', 'list-back')}
        {one(route.id)}
      </>
    );
    return <div className={`rq-frame${detail ? ' detail' : ''}`}>{close}{nav}<div className="rq-main">{main}</div></div>;
  }

  if (direction === B) {
    const area = route.kind === 'admin' || (route.kind === 'section' && sec(route.id)?.admin);
    const current = route.kind === 'section' ? route.id : '';
    const nav = area ? (
      <nav className="s-nav rq-nav rq-area-nav" data-testid="settings-navigation" aria-label="Palvelimen ylläpito">
        {back('Omat asetukset', href('tili'), 'own-settings')}
        <h1 className="rq-area-title"><Icon name="server" />Palvelimen ylläpito</h1>
        <p className="rq-area-sub">Contoso · koskee kaikkia käyttäjiä</p>
        {SERVER.map((s) => <NavItem key={s.id} id={s.id} label={shortLabel(s.id)} icon={s.icon} current={current === s.id} onGo={() => go(href(s.id))} />)}
      </nav>
    ) : (
      <nav className="s-nav rq-nav" data-testid="settings-navigation" aria-label="Asetusten osiot">
        <h1>Asetukset</h1>
        <Search />
        {PERSONAL.map((s) => <NavItem key={s.id} id={s.id} label={s.label} icon={s.icon} current={current === s.id} onGo={() => go(href(s.id))} />)}
        <button type="button" className="rq-area-link" data-testid="to-admin" onClick={() => go(href('palvelin'))}>
          <Icon name="server" /><span>Palvelimen ylläpito</span><Icon name="forward" />
        </button>
      </nav>
    );
    // On the phone the area's seven sections are tabs above the section.
    const tabs = area && route.kind === 'section' ? (
      <div className="rq-tabs" role="tablist" aria-label="Palvelimen ylläpito" data-testid="area-tabs">
        {SERVER.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={current === s.id} data-testid={`tab-${s.id}`} onClick={() => go(href(s.id))}>{shortLabel(s.id)}</button>
        ))}
      </div>
    ) : null;
    const main = route.kind === 'section' ? (
      <>
        {area ? <div className="rq-phone-only">{back('Omat asetukset', '/settings', 'own-settings-phone')}<div className="rq-area-title rq-phone-title"><Icon name="server" />Palvelimen ylläpito</div></div> : back('Asetukset', '/settings', 'list-back')}
        {tabs}
        {one(route.id)}
      </>
    ) : null;
    return <div className={`rq-frame${detail ? ' detail' : ''}${area ? ' area' : ''}`}>{close}{nav}<div className="rq-main">{main}</div></div>;
  }

  if (direction === C) {
    const gid = route.kind === 'group' ? route.id : route.kind === 'section' ? groupOf(route.id).id : '';
    const group = GROUPS.find((g) => g.id === gid);
    const nav = (
      <nav className="s-nav rq-nav" data-testid="settings-navigation" aria-label="Asetusten ryhmät">
        <h1>Asetukset</h1>
        <Search />
        {GROUPS.map((g) => (
          <React.Fragment key={g.id}>
            {g.id === 'palvelin' ? <span className="s-nav-h">Ylläpito</span> : null}
            <NavItem id={g.id} testid={`group-${g.id}`} label={g.label} icon={g.icon} current={gid === g.id} onGo={() => go(`/settings/group/${g.id}`)} />
            {g.sections.length > 1 ? <span className="rq-group-sub">{g.sections.map((s) => sec(s).label).join(' · ')}</span> : null}
          </React.Fragment>
        ))}
      </nav>
    );
    const main = group ? <Stack key={group.id} group={group} go={go} one={one} /> : null;
    return <div className={`rq-frame${detail ? ' detail' : ''}`}>{close}{nav}<div className="rq-main">{main}</div></div>;
  }
  return null;
}

/** C: every section of a group one after another, with jump links that
 * follow the reader. */
function Stack({group, go, one}: {group: (typeof GROUPS)[number]; go: (p: string) => void; one: (id: string) => React.ReactNode}) {
  const [here, setHere] = useState(group.sections[0]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    const scroller = root?.closest('.ah-settings-layer');
    if (!root || !scroller) return;
    scroller.scrollTop = 0;
    const spy = () => {
      const top = scroller.getBoundingClientRect().top + 120;
      let cur = group.sections[0];
      for (const el of root.querySelectorAll<HTMLElement>('[data-stack]')) if (el.getBoundingClientRect().top <= top) cur = el.dataset.stack!;
      setHere(cur);
    };
    scroller.addEventListener('scroll', spy, {passive: true});
    return () => scroller.removeEventListener('scroll', spy);
  }, [group]);
  const jump = (id: string) => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-stack="${id}"]`);
    const scroller = ref.current?.closest('.ah-settings-layer');
    if (!el || !scroller) return;
    const bar = ref.current!.querySelector<HTMLElement>('.rq-jumps')!.getBoundingClientRect().height;
    scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - bar - 8;
    setHere(id);
  };
  const server = group.id === 'palvelin';
  return (
    <div className="rq-stack" ref={ref} data-testid={`stack-${group.id}`}>
      <button type="button" className="rq-back" data-testid="list-back" onClick={() => go('/settings')}><Icon name="back" />Asetukset</button>
      <h2 data-testid="group-title">{group.label}</h2>
      {server ? <p className="s-intro">Contosoin asetukset koskevat kaikkia sen käyttäjiä.</p> : null}
      {group.sections.length > 1 ? (
        <div className="rq-jumps" data-testid="jumps">
          {group.sections.map((s) => (
            <button key={s} type="button" data-testid={`jump-${s}`} aria-current={here === s ? 'location' : undefined} onClick={() => jump(s)}>{sec(s).label}</button>
          ))}
        </div>
      ) : null}
      {group.sections.map((s) => <section key={s} data-stack={s} className="rq-stack-sec">{one(s)}</section>)}
      {group.sections.length > 1 ? <button type="button" className="rq-top" data-testid="to-top" onClick={() => jump(group.sections[0])}><Icon name="up" />Ryhmän alkuun</button> : null}
    </div>
  );
}

// ---- Shell ----
function Main({direction}: {direction: number}) {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = location.pathname.startsWith('/settings');
  // Where the account menu's Palvelimen ylläpito lands in each direction.
  const adminHome = direction === A ? '/settings/admin' : direction === C ? '/settings/group/palvelin' : href('palvelin');
  const toSettings = direction === C ? '/settings/group/tili' : href('tili');
  const close = () => navigate('/workspaces/ws_t');
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Contoso" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={() => navigate(direction === NYT ? `/settings/${idToSlug('tili')}` : toSettings)} onAdministration={() => navigate(direction === NYT ? `/settings/${idToSlug('palvelin')}` : adminHome)} onLogout={noop} />}>
      <WorkspaceNavRow name="tarjoukset" href="/workspaces/ws_t" />
      <WorkspaceNavRow name="ohjeet" href="/workspaces/ws_o" />
      <WorkspaceNavRow name="kayttoonotto" href="/workspaces/ws_k" />
    </WorkspaceRail>
  );
  let main: React.ReactNode;
  if (settings && direction === NYT) {
    const slug = location.pathname.split('/')[2];
    main = (
      <div className="ah-settings-layer">
        <div className="ah-state">
          <AccountSettings routeSection={slug ? slugToId(slug) : null} routeRow={location.hash.slice(1) || undefined} onNavigate={(p) => navigate(p)}
            profile={{name: 'Jari Mustonen', email: '', avatar_url: ''}} csrf="prototype"
            modelSelector={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>}
            onClose={close} />
        </div>
      </div>
    );
  } else if (settings) {
    main = (
      <div className="ah-settings-layer">
        <div className="ah-state rq-state"><Frame direction={direction} onClose={close} /></div>
      </div>
    );
  } else {
    main = (
      <div className="ah-state rq-closed" data-testid="closed">
        <p>Asetukset suljettu. Avaa ne sivupalkin tilivalikosta.</p>
        <ControlButton data-testid="reopen" size="row" variant="secondary" onPress={() => navigate(direction === NYT ? `/settings/${idToSlug('palvelin')}` : adminHome)}>Palvelimen ylläpito</ControlButton>
      </div>
    );
  }
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={settings ? 'Asetukset' : 'tarjoukset'} navigationBadge={0} rail={railView} main={main} />
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
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
  // The default view: the administrator has just chosen Palvelimen ylläpito
  // from the account menu.
  const start = direction === NYT ? `/settings/${idToSlug('palvelin')}` : direction === A ? '/settings/admin' : direction === C ? '/settings/group/palvelin' : href('palvelin');
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction}>
      <header className="rq-bar" ref={bar}>
        <strong>Palvelimen asetukset</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => setGeneration((g) => g + 1)}>Alusta</button>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={generation} enabled>
          <MemoryRouter key={generation} initialEntries={[start]}>
            <Main direction={direction} />
          </MemoryRouter>
        </PiModelsProvider>
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
