import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {AgentTurn, type TurnStep} from '../../../../web/src/components/AgentTurn';
import {PiToolUse} from '../../../../web/src/components/PiBlocks';
import {BashToolCard} from '../../../../web/src/components/BashToolCard';
import {FileToolCard} from '../../../../web/src/components/FileToolCard';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton, ExternalLink, LinkRow, Segmented} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {ViewSplit} from '../../../../web/src/components/ViewPanel';
import {AccountSettings, AccountShelf} from '../../../../web/src/components/Account';
import {levelName} from '../../../../web/src/components/Integrations';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/ViewPanel.css';
import '../../../../web/src/components/EditorSplit.css';
import '../../../../web/src/components/FileOffer.css';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-browse-what-agent-sees-m365. Aino (Contoso, 6.11.2026) wants to see
// what the agent sees in his SharePoint and OneDrive through the Microsoft
// integration, and later what the agent changed there. The agent reaches
// those files only as the daemon's local mirror of the chosen roots
// (~/cloud/onedrive/<address>/, ~/cloud/sharepoint/<org>/<site>/<library>/,
// microsoft_files_linux.go): two-way at the full level, a one-way read-only
// mirror at drafts and read. Only followed sites and chosen libraries are
// there. The axis is where browsing lives: A under the account in Settings ›
// Tiedot agenteille, B its own Tiedostot view beside the workspaces, C a side
// panel of the conversation that starts from what the agent read and wrote
// in it. Content, levels, changes and giving are the same in all three.
// Rail, header, timeline, turn, tool rows, composer, the settings page and
// its account card are production components; the host behind them is a
// fetch stand-in. Everything is synthetic.
const directions = ['A Asetukset', 'B Tiedostot', 'C Paneeli'];
const LINES = [
  'A Asetukset: selaus asuu Microsoft-tilin kortin alla (Asetukset › Tiedot agenteille); agentin muutokset ovat lista kortissa ja merkki tiedoston kohdalla.',
  'B Tiedostot: oma Tiedostot-näkymä sivupalkissa työtilojen yllä; kolme saraketta, Agentin muutokset -välilehti ja keskustelun vuorosta linkki muutettuun tiedostoon.',
  'C Paneeli: keskustelun sivupaneeli alkaa siitä, mitä agentti luki ja muutti tässä keskustelussa; samasta paneelista selataan ja annetaan tiedosto agentille.',
];
const A = 0, B = 1, C = 2;

// ---------- Synthetic tenant: Contoso, Aino Virtanen's sign-in ----------

const ME = 'aino.virtanen@contoso.example';
const SP = 'https://contoso.sharepoint.example';
type Level = 'full' | 'drafts' | 'read';
type Ext = 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'md';
type F = {n: string; ext?: Ext; kids?: F[]; at: string; by: string; size?: string; body?: string; table?: string[][]; change?: string};
type Root = {id: string; service: 'onedrive' | 'sharepoint'; site?: string; library: string; chosen: boolean; web: string; files: F[]};

const doc = (n: string, at: string, by: string, size: string, body?: string, change?: string): F => ({n, ext: n.endsWith('.md') ? 'md' : (n.split('.').pop() as Ext), at, by, size, body, change});
const dir = (n: string, at: string, kids: F[]): F => ({n, at, by: '', kids});

const VKO44 = `# Kesko – kassajärjestelmä · viikkoraportti vko 44

**Tila:** aikataulussa · **Budjetti:** 62 % käytetty

## Tehty
- Kassapäätteiden rajapinnan testiympäristö pystyssä (Prisma Kannelmäki)
- Kuittitulostuksen muutos hyväksytty ohjausryhmässä 29.10.

## Seuraavaksi
- Kuormitustesti 40 kassalle
- Varmenteiden vaihto ennen joulukuuta`;
const VKO45 = `# Kesko – kassajärjestelmä · viikkoraportti vko 45

**Tila:** aikataulussa · **Budjetti:** 68 % käytetty

## Tehty
- Kuormitustesti 40 kassalle ajettu; vasteaika 0,8 s (tavoite 1,0 s)
- Varmenteiden vaihdon aikataulu sovittu Keskon IT:n kanssa

## Seuraavaksi
- Pilotti kolmessa myymälässä vko 47
- Kuittitulostuksen muutos tuotantoon`;
const QUESTIONS_BEFORE = `# Avoimet kysymykset

1. Kuka hyväksyy kassapäätteiden ohjelmistopäivitykset myymälöissä?
2. Tarvitaanko varakassajärjestelmä pilotin ajaksi?`;
const QUESTIONS_AFTER = `${QUESTIONS_BEFORE}
3. Kuka Keskolla omistaa varmenteiden vaihdon joulukuussa?
4. Mitkä kolme myymälää ovat pilotissa vko 47?`;
const PLAN = `# Projektisuunnitelma: kassajärjestelmän uusiminen

Asiakas: Kesko Oyj · Projektipäällikkö: Mikko Laine · Kesto 9/2026–2/2027

## Tavoite
Uusi kassajärjestelmä 40 myymälään. Pilotti kolmessa myymälässä ennen joulua.

## Vaiheet
1. Rajapinnat ja testiympäristö (9–10/2026)
2. Kuormitus- ja varmennetestit (11/2026)
3. Pilotti (vko 47–50)`;

const ROOTS: Root[] = [
  {id: 'od', service: 'onedrive', library: 'OneDrive', chosen: true, web: 'https://contoso-my.sharepoint.example/personal/aino_virtanen', files: [
    dir('Omat muistiinpanot', '4.11.', [doc('Kesko-palaveri 4.11.md', '4.11.', 'Aino Virtanen', '1 kt', '# Kesko-palaveri 4.11.\n\n- Pilotti kolmessa myymälässä vko 47\n- Varmenteet vaihdettava ennen joulukuuta – kuka Keskolla?\n- Kuormitustesti ajetaan tällä viikolla')]),
    dir('Matkalaskut', '1.11.', [doc('Matkalasku lokakuu.xlsx', '1.11.', 'Aino Virtanen', '18 kt')]),
    doc('Esitys johtoryhmälle.pptx', '30.10.', 'Aino Virtanen', '2,4 Mt'),
    doc('CV Aino Virtanen.pdf', '12.9.', 'Aino Virtanen', '210 kt'),
  ]},
  {id: 'proj', service: 'sharepoint', site: 'Asiakasprojektit', library: 'Jaetut asiakirjat', chosen: true, web: `${SP}/sites/asiakasprojektit/Shared%20Documents`, files: [
    dir('Kesko – kassajärjestelmä', 'tänään 10.43', [
      dir('Viikkoraportit', 'tänään 10.42', [
        doc('Viikkoraportti vko 43.docx', '24.10.', 'Aino Virtanen', '36 kt'),
        doc('Viikkoraportti vko 44.docx', '31.10.', 'Aino Virtanen', '38 kt', VKO44),
        doc('Viikkoraportti vko 45.docx', 'tänään 10.42', 'Aino Virtanen', '39 kt', VKO45, 'r'),
      ]),
      dir('Kokousmuistiot', '29.10.', [doc('Ohjausryhmä 29.10.docx', '29.10.', 'Mikko Laine', '41 kt')]),
      doc('Projektisuunnitelma.docx', '28.10.', 'Mikko Laine', '84 kt', PLAN),
      doc('Avoimet kysymykset.md', 'tänään 10.43', 'Aino Virtanen', '1 kt', QUESTIONS_AFTER, 'q'),
    ]),
    dir('Valio – raportointi', '3.11.', [
      doc('Vaatimukset.docx', '3.11.', 'Sanna Heikkinen', '57 kt'),
      doc('Aikataulu.xlsx', '2.11.', 'Sanna Heikkinen', '22 kt'),
    ]),
    dir('Projektipohjat', '2.9.', [doc('Viikkoraporttipohja.docx', '2.9.', 'Mikko Laine', '31 kt')]),
  ]},
  {id: 'tarjoukset', service: 'sharepoint', site: 'Myynti', library: 'Tarjoukset', chosen: true, web: `${SP}/sites/myynti/Tarjoukset`, files: [
    dir('2026', '5.11.', [
      doc('Kesko – kassajärjestelmän laajennus.docx', '5.11.', 'Juha Mäkelä', '112 kt'),
      doc('Valio – raportoinnin jatko.docx', '22.10.', 'Juha Mäkelä', '96 kt'),
    ]),
    dir('Pohjat', '14.8.', [doc('Tarjouspohja 2026.docx', '14.8.', 'Juha Mäkelä', '64 kt')]),
  ]},
  {id: 'myynti', service: 'sharepoint', site: 'Myynti', library: 'Jaetut asiakirjat', chosen: true, web: `${SP}/sites/myynti/Shared%20Documents`, files: [
    {...doc('Hinnasto 2026.xlsx', '2.11.', 'Juha Mäkelä', '44 kt'), table: [['Palvelu', 'Yksikkö', 'Hinta'], ['Asiantuntijatyö', 'h', '128 €'], ['Projektinhallinta', 'h', '115 €'], ['Ylläpito', 'kk', '1 900 €']]},
    doc('Asiakaslista.xlsx', '30.10.', 'Juha Mäkelä', '31 kt'),
  ]},
  {id: 'yleinen', service: 'sharepoint', site: 'Contoso yleinen', library: 'Jaetut asiakirjat', chosen: false, web: `${SP}/sites/yleinen/Shared%20Documents`, files: []},
];
const rootOf = (id?: string) => ROOTS.find((r) => r.id === id);
const rootName = (r: Root) => (r.service === 'onedrive' ? 'OneDrive' : `${r.site} › ${r.library}`);
const SITES = [...new Set(ROOTS.filter((r) => r.site).map((r) => r.site!))];
/** A followed site whose libraries the person may not read (403 at discovery). */
const DENIED = ['Johtoryhmä'];

/** What the agent did in "Keskon viikkoraportti", from Pi's own history. */
type Change = {id: string; root: string; path: string[]; file: string; verb: 'Loi' | 'Muokkasi'; at: string; synced: string};
const CHANGES: Change[] = [
  {id: 'r', root: 'proj', path: ['Kesko – kassajärjestelmä', 'Viikkoraportit'], file: 'Viikkoraportti vko 45.docx', verb: 'Loi', at: '10.42', synced: '10.44'},
  {id: 'q', root: 'proj', path: ['Kesko – kassajärjestelmä'], file: 'Avoimet kysymykset.md', verb: 'Muokkasi', at: '10.43', synced: '10.48'},
];
type Read = {root: string; path: string[]; file: string; at: string};
const READS: Read[] = [
  {root: 'proj', path: ['Kesko – kassajärjestelmä'], file: 'Projektisuunnitelma.docx', at: '10.39'},
  {root: 'proj', path: ['Kesko – kassajärjestelmä', 'Viikkoraportit'], file: 'Viikkoraportti vko 44.docx', at: '10.39'},
  {root: 'proj', path: ['Kesko – kassajärjestelmä'], file: 'Avoimet kysymykset.md', at: '10.40'},
  {root: 'od', path: ['Omat muistiinpanot'], file: 'Kesko-palaveri 4.11.md', at: '10.40'},
];

// ---------- Store: the level, the sync of the last change, what was given ----------

type Given = {root: string; path: string[]; file: string};
const store = {
  direction: 0, level: 'full' as Level, pending: true, toast: '',
  given: null as Given | null, sent: null as Given | null, sentText: '',
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
let syncTimer = 0;
function resetStore(direction = store.direction) {
  Object.assign(store, {direction, pending: true, toast: '', given: null, sent: null, sentText: ''});
  window.clearTimeout(syncTimer);
  // The edit made at 10.43 reaches SharePoint with the next sync pass.
  syncTimer = window.setTimeout(() => { store.pending = false; notify(); }, 6000);
}
resetStore(0);
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return store;
}
const writable = () => store.level === 'full';
/** The agent's changes reach Microsoft only at the full level. */
const changes = () => (writable() ? CHANGES : []);
const changeOf = (f: F) => (f.change && writable() ? CHANGES.find((c) => c.id === f.change) : undefined);
function toast(text: string) {
  store.toast = text; notify();
  window.setTimeout(() => { if (store.toast === text) { store.toast = ''; notify(); } }, 2600);
}

/** The listing as the agent sees it: an agent-created file exists only where it could write. */
function listing(root: Root, path: string[]): F[] | undefined {
  let files = root.files;
  for (const p of path) {
    const next = files.find((f) => f.n === p && f.kids);
    if (!next) return undefined;
    files = next.kids!;
  }
  return files.filter((f) => !(f.change === 'r' && !writable()));
}
function fileAt(root: Root, path: string[], name: string): F | undefined {
  return listing(root, path)?.find((f) => f.n === name);
}
/** The content the agent reads now: before its edit when it could not write. */
const bodyOf = (f: F) => (f.change === 'q' && !writable() ? QUESTIONS_BEFORE : f.body);
const metaOf = (f: F) => (f.change === 'q' && !writable() ? {at: '5.11.', by: 'Aino Virtanen'} : {at: f.at, by: f.by});
const iconOf = (f: F): IconName => (f.kids ? 'folder' : f.ext === 'xlsx' ? 'table' : f.ext === 'pptx' ? 'image' : 'file');
const placeOf = (root: Root, path: string[]) => [root.service === 'onedrive' ? 'OneDrive' : root.site!, ...(root.service === 'onedrive' ? [] : [root.library]), ...path].join(' › ');
const where = (r: Root) => (r.service === 'onedrive' ? 'OneDrivessa' : 'SharePointissa');

// ---------- Host stand-in ----------

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(60);
  if (path === '/api/v1/integrations') {
    const level = store.level, files = level === 'full' ? 'full' : 'read';
    return json({schema_version: 1, skill: 'current',
      providers: [{id: 'microsoft', available: true, login: 'device_code', services: ['onedrive', 'sharepoint', 'mail', 'calendar', 'contacts'],
        levels: [{id: 'full', available: true}, {id: 'drafts', available: true}, {id: 'read', available: true}]}],
      accounts: [{provider: 'microsoft', address: ME, checked_at: '2026-11-06T08:50:00Z', level,
        services: [
          {id: 'onedrive', state: 'ok', access: files, directory: `~/cloud/onedrive/${ME}`, last_synced_at: '2026-11-06T08:48:00Z'},
          {id: 'sharepoint', state: 'ok', access: files, directory: `~/cloud/sharepoint/contoso-sharepoint-example-3fa2c1--${ME}`, last_synced_at: '2026-11-06T08:48:00Z'},
          {id: 'mail', state: 'ok', access: level === 'full' ? 'full' : level === 'drafts' ? 'drafts' : 'read'},
          {id: 'calendar', state: 'ok', access: level === 'full' ? 'full' : 'read'},
          {id: 'contacts', state: 'ok', access: level === 'full' ? 'full' : 'read'},
        ]}]});
  }
  if (path === '/api/v1/server') return json({schema_version: 1, name: 'Contoso', administrator: false, version: '0.0.0-proto'});
  if (path === '/api/v1/pi/models')
    return json({schema_version: 1, default_provider: 'claude-bridge', default_model: 'claude-sonnet-5', default_thinking: 'medium', catalog_status: 'native_cached',
      models: [{id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'claude-bridge'}]});
  return new Response('', {status: 404});
};

const noop = () => {};
const T0 = Date.UTC(2026, 10, 6, 9, 0);
const sources: ComposerSources = {
  commands: async () => ({commands: [], truncated: false}) as never,
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'raportit',
};
function useNarrow() {
  const q = '(max-width: 760px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setNarrow(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return narrow;
}

// ---------- Shared pieces: level, badge, changes, what the agent does not see ----------

/** What the level lets the agent do with these files, said once above them. */
function LevelNote({compact}: {compact?: boolean}) {
  const s = useStore();
  const full = s.level === 'full';
  return (
    <p className={`mb-level${full ? '' : ' read'}${compact ? ' compact' : ''}`} data-testid="level-note" data-level={s.level}>
      <Icon name={full ? 'pencil' : 'lock'} />
      <span>
        <strong>{levelName('microsoft', s.level)}.</strong>{' '}
        {full
          ? 'Agentti lukee ja voi muuttaa näitä tiedostoja. Muutos siirtyy Microsoftiin muutamassa minuutissa, ja siellä muokkaajaksi näkyy sinun nimesi.'
          : 'Agentti lukee näitä tiedostoja, mutta ei voi muuttaa niitä Microsoftissa. Mitä se kirjoittaa, se tallentaa työtilaan.'}
      </span>
    </p>
  );
}
function AgentBadge({change}: {change: Change}) {
  return <span className="mb-badge" data-testid="agent-badge"><Icon name="agent" />Agentti {change.verb.toLowerCase()} {change.at}</span>;
}
function SyncMark({change}: {change: Change}) {
  const s = useStore();
  const pending = change.id === 'q' && s.pending;
  return pending
    ? <StatusMark data-testid="sync-pending" label="Siirtyy Microsoftiin…" kind="working" animated="running" />
    : <StatusMark data-testid="sync-done" label={`Microsoftissa ${change.synced}`} kind="success" tone="success" />;
}
/** The agent's changes: file, what, when, the conversation, and whether it reached Microsoft. */
function ChangeList({onOpenFile, onOpenConversation, empty = true}: {onOpenFile: (c: Change) => void; onOpenConversation?: () => void; empty?: boolean}) {
  const s = useStore();
  const list = changes();
  if (!list.length)
    return empty ? <p className="mb-empty" data-testid="changes-empty">{s.level === 'full' ? 'Agentti ei ole muuttanut näitä tiedostoja.' : 'Agentti ei voi muuttaa näitä tiedostoja tällä tasolla. Keskustelussa Keskon viikkoraportti se tallensi raportin työtilaan raportit.'}</p> : null;
  return (
    <ul className="mb-changes" data-testid="change-list">
      {list.map((c) => {
        const root = rootOf(c.root)!;
        return (
          <li key={c.id} data-testid={`change-${c.id}`}>
            <Icon name="file" className="mb-row-icon" />
            <div className="mb-change-text">
              <button type="button" className="mb-link-strong" data-testid={`change-open-${c.id}`} onClick={() => onOpenFile(c)}>{c.file}</button>
              <span className="mb-meta">{c.verb} tänään {c.at} · {placeOf(root, c.path)}</span>
              {onOpenConversation ? <span className="mb-meta">Keskustelussa <button type="button" className="mb-link" data-testid={`change-conv-${c.id}`} onClick={onOpenConversation}>Keskon viikkoraportti</button></span> : null}
            </div>
            <SyncMark change={c} />
          </li>
        );
      })}
    </ul>
  );
}
/** What the agent does not see, and why: each line says what the person can do about it. */
function HiddenList() {
  return (
    <div className="mb-hidden" data-testid="hidden-list">
      <h3 className="mb-h3"><Icon name="eyeOff" />Agentti ei näe</h3>
      <ul>
        <li><strong>Contoso yleinen › Jaetut asiakirjat</strong><span className="mb-meta">Et ole valinnut tätä kirjastoa agentille.</span>
          <ControlButton data-testid="choose-libraries" size="row" variant="quiet" onPress={() => toast('Kirjastojen valinta avautuisi tästä (tuotannon kansiovalinta).')}>Valitse kirjastot</ControlButton></li>
        {DENIED.map((d) => <li key={d}><strong>{d}</strong><span className="mb-meta">Seuraat sivustoa, mutta sen ylläpitäjä ei ole antanut sinulle pääsyä kirjastoihin.</span></li>)}
        <li><strong>Muut SharePoint-sivustot</strong><span className="mb-meta">Agentti näkee vain sivustot, joita seuraat SharePointissa. Seuraa sivustoa ja tarkista tili uudelleen, niin se tulee tähän.</span></li>
      </ul>
    </div>
  );
}

// ---------- Browser: sources, a folder's files, a file ----------

type Loc = {root?: string; path: string[]; file?: string};
const HOME: Loc = {path: []};

function Sources({loc, onPick, hidden = true}: {loc: Loc; onPick: (l: Loc) => void; hidden?: boolean}) {
  const chosen = ROOTS.filter((r) => r.chosen);
  const row = (r: Root) => (
    <li key={r.id}>
      <button type="button" className="mb-source" data-testid={`source-${r.id}`} aria-current={loc.root === r.id ? 'true' : undefined} onClick={() => onPick({root: r.id, path: []})}>
        <Icon name={r.service === 'onedrive' ? 'user' : 'folder'} />
        <span>{r.service === 'onedrive' ? 'OneDrive' : r.library}</span>
        {changes().some((c) => c.root === r.id) ? <span className="mb-dot" aria-label="Agentti muutti täällä" title="Agentti muutti täällä" /> : null}
      </button>
    </li>
  );
  return (
    <div className="mb-sources" data-testid="sources">
      <h3 className="mb-h3">OneDrive</h3>
      <ul>{chosen.filter((r) => r.service === 'onedrive').map(row)}</ul>
      <h3 className="mb-h3">SharePoint</h3>
      {SITES.map((site) => {
        const libs = chosen.filter((r) => r.site === site);
        if (!libs.length) return null;
        return (
          <div className="mb-site" key={site}>
            <span className="mb-site-name">{site}</span>
            <ul>{libs.map(row)}</ul>
          </div>
        );
      })}
      {hidden ? <HiddenList /> : null}
    </div>
  );
}

function Crumbs({loc, onGo}: {loc: Loc; onGo: (l: Loc) => void}) {
  const root = rootOf(loc.root);
  if (!root) return null;
  const parts = [{label: rootName(root), l: {root: root.id, path: []} as Loc}, ...loc.path.map((p, i) => ({label: p, l: {root: root.id, path: loc.path.slice(0, i + 1)} as Loc}))];
  return (
    <nav className="mb-crumbs" aria-label="Sijainti" data-testid="crumbs">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i ? <span aria-hidden="true">›</span> : null}
          {i === parts.length - 1 ? <span aria-current="page">{p.label}</span> : <button type="button" className="mb-link" onClick={() => onGo(p.l)}>{p.label}</button>}
        </React.Fragment>
      ))}
    </nav>
  );
}

function Files({loc, onGo, onGive}: {loc: Loc; onGo: (l: Loc) => void; onGive: (g: Given) => void}) {
  useStore();
  const root = rootOf(loc.root);
  if (!root) return <p className="mb-empty">Valitse OneDrive tai SharePoint-kirjasto.</p>;
  const files = listing(root, loc.path) ?? [];
  const folders = files.filter((f) => f.kids), docs = files.filter((f) => !f.kids);
  return (
    <ul className="mb-files" data-testid="files">
      {[...folders, ...docs].map((f) => {
        const change = changeOf(f);
        const meta = metaOf(f);
        return (
          <li key={f.n} className="mb-file" data-selected={loc.file === f.n || undefined}>
            <button type="button" className="mb-file-row" data-testid={`file-${f.n}`}
              onClick={() => onGo(f.kids ? {root: root.id, path: [...loc.path, f.n]} : {...loc, file: f.n})}>
              <Icon name={iconOf(f)} className="mb-row-icon" />
              <span className="mb-file-text">
                <span className="mb-file-name">{f.n}</span>
                <span className="mb-meta">{f.kids ? `Muokattu ${meta.at}` : `${meta.at} · ${meta.by} · ${f.size}`}</span>
              </span>
              {change ? <AgentBadge change={change} /> : null}
            </button>
            {f.kids ? null : (
              <ControlButton className="mb-give-icon" data-testid={`give-row-${f.n}`} size="row" variant="quiet" aria-label={`Anna agentille: ${f.n}`} title="Anna agentille"
                onPress={() => onGive({root: root.id, path: loc.path, file: f.n})}><Icon name="agent" /></ControlButton>
            )}
          </li>
        );
      })}
      {!files.length ? <li className="mb-empty">Kansio on tyhjä.</li> : null}
    </ul>
  );
}

/** One file: where it is, what the agent did to it, its content, and the two ways onward. */
function Preview({loc, onBack, onGive, onOpenConversation, give}: {loc: Loc; onBack?: () => void; onGive: (g: Given) => void; onOpenConversation: () => void; give: React.ReactNode}) {
  const s = useStore();
  const root = rootOf(loc.root);
  const f = root && loc.file ? fileAt(root, loc.path, loc.file) : undefined;
  if (!root || !f) return null;
  const change = changeOf(f);
  const meta = metaOf(f);
  const body = bodyOf(f);
  const edited = change?.id === 'q';
  return (
    <article className="mb-preview" data-testid="preview" aria-label={f.n}>
      <header className="mb-preview-head">
        {onBack ? <ControlButton data-testid="preview-back" size="row" variant="quiet" aria-label="Takaisin" onPress={onBack}><Icon name="back" /></ControlButton> : null}
        <Icon name={iconOf(f)} className="mb-row-icon" />
        <div className="mb-preview-title">
          <h2>{f.n}</h2>
          <span className="mb-meta">{placeOf(root, loc.path)}</span>
        </div>
      </header>
      <p className="mb-meta">{edited || change ? `Muokattu tänään ${change!.at} · ${s.level === 'full' ? 'agentti sinun tunnuksillasi' : meta.by}` : `Muokattu ${meta.at} · ${meta.by}`} · {f.size}</p>
      {change ? (
        <section className="mb-did" data-testid="agent-did">
          <div className="mb-did-head"><AgentBadge change={change} /><SyncMark change={change} /></div>
          <p>{change.verb === 'Loi' ? 'Agentti loi tämän tiedoston' : 'Agentti lisäsi kaksi kysymystä'} keskustelussa <button type="button" className="mb-link" data-testid="did-conversation" onClick={onOpenConversation}>Keskon viikkoraportti</button>. {root.service === 'onedrive' ? 'OneDrivessa' : 'SharePointissa'} muokkaajaksi näkyy Aino Virtanen.</p>
          {edited ? <FileToolCard name="edit" argumentsText={JSON.stringify({path: f.n, edits: [{oldText: QUESTIONS_BEFORE.split('\n').slice(-1)[0], newText: QUESTIONS_AFTER.split('\n').slice(-3).join('\n')}]})} /> : null}
        </section>
      ) : null}
      {!writable() ? <p className="mb-meta mb-lock-line" data-testid="cannot-change"><Icon name="lock" />Agentti ei voi muuttaa tätä tiedostoa.</p> : null}
      <div className="mb-actions">
        {give}
        <ExternalLink className="mb-ext" href={root.web} target="_blank" rel="noreferrer"><Icon name="external" />Avaa {where(root)}</ExternalLink>
      </div>
      <div className={`mb-paper${f.ext === 'md' ? ' md' : ''}`} data-testid="preview-content">
        {body ? <Markdown text={body} /> : f.table ? (
          <table><tbody>{f.table.map((r, i) => <tr key={i}>{r.map((c, j) => (i ? <td key={j}>{c}</td> : <th key={j}>{c}</th>))}</tr>)}</tbody></table>
        ) : <p className="mb-meta">Tästä tiedostosta ei ole esikatselua. Agentti lukee sen silti.</p>}
      </div>
    </article>
  );
}
const GiveButton = ({onPress, label = 'Anna agentille'}: {onPress: () => void; label?: string}) => (
  <ControlButton data-testid="give" size="row" variant="primary" onPress={onPress}><Icon name="agent" />{label}</ControlButton>
);

// ---------- The conversation the agent worked in ----------

const ORG = 'contoso-sharepoint-example-3fa2c1--aino.virtanen@contoso.example';
const LIB = `~/cloud/sharepoint/${ORG}/asiakasprojektit-8d1e20b4c7a1/jaetut-asiakirjat-b77a03e19f20`;
const localPath = (g: Given) => {
  const r = rootOf(g.root)!;
  const base = r.service === 'onedrive' ? `~/cloud/onedrive/${ME}` : r.id === 'proj' ? LIB : `~/cloud/sharepoint/${ORG}/${r.site!.toLowerCase()}-…/${r.library.toLowerCase().replaceAll(' ', '-')}-…`;
  return [base, ...g.path, g.file].join('/');
};
const ASK = 'Tee Keskon viikkoraportti vko 45 samaan pohjaan kuin vko 44. Käytä projektisuunnitelmaa ja tiistain palaverimuistiinpanojani, ja lisää avoimiin kysymyksiin, mitä niistä puuttuu.';
const tool = (key: string, name: string, target: string, body: React.ReactNode): TurnStep => ({kind: 'tool', key, node: <PiToolUse name={name} state="succeeded" targetText={target}>{body}</PiToolUse>});
const say = (key: string, text: string): TurnStep => ({kind: 'text', key, text, node: <Markdown text={text} />});
function turnSteps(level: Level): TurnStep[] {
  const kesko = `${LIB}/Kesko – kassajärjestelmä`;
  const reads: TurnStep[] = [
    tool('r1', 'bash', `python3 -m docx2txt "${kesko}/Projektisuunnitelma.docx"`, <BashToolCard command={`python3 -m docx2txt "${kesko}/Projektisuunnitelma.docx"`} output={PLAN} />),
    tool('r2', 'bash', `python3 -m docx2txt "${kesko}/Viikkoraportit/Viikkoraportti vko 44.docx"`, <BashToolCard command="python3 -m docx2txt …vko 44.docx" output={VKO44} />),
    tool('r3', 'read', `${kesko}/Avoimet kysymykset.md`, <FileToolCard name="read" argumentsText={JSON.stringify({path: `${kesko}/Avoimet kysymykset.md`})} output={QUESTIONS_BEFORE} />),
    tool('r4', 'read', `~/cloud/onedrive/${ME}/Omat muistiinpanot/Kesko-palaveri 4.11.md`, <FileToolCard name="read" argumentsText="{}" output="# Kesko-palaveri 4.11." />),
  ];
  if (level === 'full')
    return [...reads,
      tool('w1', 'bash', `python3 make_report.py --template vko44 --out "${kesko}/Viikkoraportit/Viikkoraportti vko 45.docx"`, <BashToolCard command="python3 make_report.py --template vko44 --out …vko 45.docx" output="Kirjoitettu: Viikkoraportti vko 45.docx (39 kt)" />),
      tool('w2', 'edit', `${kesko}/Avoimet kysymykset.md`, <FileToolCard name="edit" argumentsText={JSON.stringify({path: `${kesko}/Avoimet kysymykset.md`, edits: [{oldText: '2. Tarvitaanko varakassajärjestelmä pilotin ajaksi?', newText: QUESTIONS_AFTER.split('\n').slice(-3).join('\n')}]})} />),
      say('f', 'Raportti on valmis: **Viikkoraportti vko 45.docx** on Asiakasprojektit-kirjastossa vko 44:n vieressä, samassa pohjassa. Kuormitustestin tulos (0,8 s) ja pilotin aikataulu tulivat palaverimuistiinpanoistasi.\n\nLisäsin **Avoimiin kysymyksiin** kaksi kohtaa: kuka Keskolla omistaa varmenteiden vaihdon, ja mitkä kolme myymälää ovat pilotissa.')];
  return [...reads,
    tool('w1', 'bash', 'python3 make_report.py --template vko44 --out "Viikkoraportti vko 45.docx"', <BashToolCard command='python3 make_report.py --template vko44 --out "Viikkoraportti vko 45.docx"' output="Kirjoitettu: Viikkoraportti vko 45.docx (39 kt)" />),
    say('f', 'SharePoint on tälle tilille vain luku, joten tallensin raportin työtilaan: `Viikkoraportti vko 45.docx`. Voit siirtää sen Asiakasprojektit-kirjastoon itse.\n\nAvoimista kysymyksistä puuttuu kaksi kohtaa, jotka lisäisin:\n\n3. Kuka Keskolla omistaa varmenteiden vaihdon joulukuussa?\n4. Mitkä kolme myymälää ovat pilotissa vko 47?')];
}

/** The given file as the composer and the sent message show it. */
function GivenChip({g, onRemove}: {g: Given; onRemove?: () => void}) {
  const r = rootOf(g.root)!;
  return (
    <span className="mb-given" data-testid="given-chip" title={placeOf(r, g.path)}>
      <Icon name={r.service === 'onedrive' ? 'user' : 'folder'} />
      <span className="mb-given-text"><strong>{g.file}</strong><span>{r.service === 'onedrive' ? 'OneDrive' : r.site}</span></span>
      {onRemove ? <ControlButton data-testid="given-remove" size="inline" variant="quiet" aria-label={`Poista ${g.file}`} onPress={onRemove}><Icon name="cross" /></ControlButton> : null}
    </span>
  );
}

let reviewTheme = 'light';

function Main({direction}: {direction: number}) {
  const s = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const narrow = useNarrow();
  const params = new URLSearchParams(location.search);
  const settings = location.pathname.startsWith('/settings');
  const filesPage = location.pathname.startsWith('/files');
  const current = params.get('conversation');
  const isNew = params.get('new') === '1';
  const [draft, setDraft] = useState('');
  const [panel, setPanel] = useState(direction === C);
  const [panelWidth, setPanelWidth] = useState(460);
  const [bTab, setBTab] = useState<'browse' | 'changes'>('browse');
  const [loc, setLoc] = useState<Loc>(() => direction === B ? {root: 'proj', path: ['Kesko – kassajärjestelmä']} : direction === A ? {root: 'proj', path: ['Kesko – kassajärjestelmä']} : HOME);
  const [cTab, setCTab] = useState<'here' | 'browse'>('here');
  const [dialog, setDialog] = useState(false);
  const [giveFor, setGiveFor] = useState<Given | null>(null);
  const openConversation = () => { setDialog(false); navigate('/workspaces/ws_r?conversation=kesko'); };
  const openChange = (c: Change) => {
    const l = {root: c.root, path: c.path, file: c.file};
    setLoc(l);
    if (direction === A) { setDialog(true); navigate('/settings/tiedot?tili=microsoft'); }
    if (direction === B) { setBTab('browse'); navigate('/files'); }
    if (direction === C) { setCTab('browse'); setPanel(true); }
  };
  const give = (g: Given, to: 'new' | 'kesko' = direction === C ? 'kesko' : 'new') => {
    store.given = g; setDialog(false); setGiveFor(null); notify();
    if (to === 'new') navigate('/workspaces/ws_r?new=1');
    else { navigate('/workspaces/ws_r?conversation=kesko'); if (narrow) setPanel(false); }
  };
  // B and C ask where the file goes when there is a conversation to add it to.
  const askGive = (g: Given) => (direction === B ? setGiveFor(g) : give(g));
  const send = (text: string) => {
    if (!store.given && !text.trim()) return;
    store.sent = store.given; store.sentText = text; store.given = null; setDraft(''); notify();
  };

  // ---- Rail ----
  const now = Date.now();
  const convs = [
    {id: 'kesko', title: 'Keskon viikkoraportti', since: 14},
    {id: 'valio', title: 'Valion vaatimukset', since: 1500},
  ];
  const model = (c: {id: string; title: string; since: number}): AgentNavModel => ({
    agentId: c.id, href: `/workspaces/ws_r?conversation=${c.id}`, title: c.title, workspaceId: 'ws_r', workspaceName: 'raportit',
    changedAt: T0 - c.since * 60000, activity: 'waiting', activityLabel: 'Odottaa viestiä', controlLabel: '',
    detail: 'raportit · Odottaa viestiä', selected: current === c.id && !settings && !filesPage,
  });
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Contoso" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Aino Virtanen" onSettings={() => navigate('/settings/tiedot')} onLogout={noop} />}
      now={
        <>
          {direction === B ? (
            <div className="mb-rail-files" data-testid="rail-files">
              <LinkRow href="/files" current={filesPage} data-testid="rail-files-link">
                <Icon name="folder" /><span>Tiedostot</span>
                {changes().length ? <span className="ah-rail-count">{changes().length}</span> : null}
              </LinkRow>
              <span className="mb-meta">OneDrive ja SharePoint</span>
            </div>
          ) : null}
          <section className="ah-now ah-quiet" data-testid="rail-quiet" aria-labelledby="ra-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded="true">
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="ra-quiet">Hiljaiset</span><span className="ah-rail-count">{convs.length}</span>
              </button>
            </h2>
            <ul>{convs.map((c) => <AgentNavItem key={c.id} {...model(c)} now={now} />)}</ul>
          </section>
        </>
      }>
      <WorkspaceNavRow name="raportit" href="/workspaces/ws_r" />
      <WorkspaceNavRow name="tarjoukset" href="/workspaces/ws_t" />
    </WorkspaceRail>
  );

  // ---- Where the given file goes (B) ----
  const giveDialog = (
    <ModalOverlay className="ah-overlay" isOpen={!!giveFor} isDismissable onOpenChange={(o) => { if (!o) setGiveFor(null); }}>
      <Modal className="ah-modal mb-give-modal">
        <AriaDialog className="ah-dialog" data-testid="give-dialog" aria-label="Anna agentille">
          <Heading slot="title">Anna agentille</Heading>
          {giveFor ? <p className="s-desc"><strong>{giveFor.file}</strong> lisätään viestiisi. Agentti lukee sen suoraan {where(rootOf(giveFor.root)!)}; tiedostoa ei kopioida.</p> : null}
          <div className="mb-give-choices">
            <ControlButton data-testid="give-new" size="row" variant="primary" onPress={() => give(giveFor!, 'new')}>Uusi keskustelu työtilassa raportit</ControlButton>
            <ControlButton data-testid="give-kesko" size="row" variant="secondary" onPress={() => give(giveFor!, 'kesko')}>Keskusteluun Keskon viikkoraportti</ControlButton>
          </div>
          <div className="ah-dialog-actions"><ControlButton size="row" variant="quiet" onPress={() => setGiveFor(null)}>Peruuta</ControlButton></div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );

  // ---- A: the account card's own section and its preview dialog ----
  const libraries = ROOTS.filter((r) => r.chosen && r.site).length;
  const aEntry = (
    <div className="s-card mb-a-entry" data-testid="a-entry">
      <Icon name="eye" className="mb-row-icon" />
      <div className="mb-change-text">
        <strong>Mitä agentti näkee</strong>
        <span className="mb-meta">OneDrive ja {libraries} SharePoint-kirjastoa{changes().length ? ` · agentti muutti ${changes().length} tiedostoa tänään` : ''}</span>
      </div>
      <ControlButton data-testid="a-open" size="row" variant="secondary" onPress={() => navigate('/settings/tiedot?tili=microsoft')}>Selaa</ControlButton>
    </div>
  );
  const aSection = (
    <section className="mb-a" data-testid="a-section" aria-labelledby="mb-a-title">
      <ControlButton data-testid="a-back" className="mb-a-back" size="row" variant="quiet" onPress={() => navigate('/settings/tiedot')}><Icon name="back" />Tiedot agenteille</ControlButton>
      <div className="mb-a-head">
        <span className="mb-a-mark" aria-hidden="true">M</span>
        <div className="mb-change-text">
          <h2 id="mb-a-title" className="mb-a-title">Microsoft 365 · mitä agentti näkee</h2>
          <span className="mb-meta">{ME} · synkronoitu 10.48 · OneDrive ja {libraries} SharePoint-kirjastoa</span>
        </div>
      </div>
      <LevelNote />
      <h4 className="mb-h3">Agentin muutokset</h4>
      <ChangeList onOpenFile={openChange} onOpenConversation={openConversation} />
      <div className={`mb-a-browser${narrow ? ' stack' : ''}`}>
        {narrow && loc.root ? null : <Sources loc={loc} onPick={setLoc} hidden={false} />}
        {narrow && !loc.root ? null : (
          <div className="mb-a-files">
            {narrow ? <ControlButton size="row" variant="quiet" data-testid="files-back" onPress={() => setLoc(loc.path.length ? {root: loc.root, path: loc.path.slice(0, -1)} : HOME)}><Icon name="back" />Takaisin</ControlButton> : null}
            <Crumbs loc={loc} onGo={setLoc} />
            <Files loc={loc} onGo={(l) => { setLoc(l); if (l.file) setDialog(true); }} onGive={give} />
          </div>
        )}
      </div>
      <HiddenList />
    </section>
  );
  const aDialog = (
    <ModalOverlay className="ah-overlay" isOpen={dialog && direction === A} isDismissable onOpenChange={(o) => { if (!o) setDialog(false); }}>
      <Modal className="ah-modal mb-preview-modal">
        <AriaDialog className="ah-dialog" aria-label={loc.file ?? 'Tiedosto'}>
          <Preview loc={loc} onBack={() => setDialog(false)} onGive={give} onOpenConversation={openConversation}
            give={<GiveButton onPress={() => give({root: loc.root!, path: loc.path, file: loc.file!})} label="Anna agentille uudessa keskustelussa" />} />
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );

  // ---- B: the Tiedostot view ----
  const bPage = () => {
    const back = () => setLoc(loc.file ? {root: loc.root, path: loc.path} : loc.path.length ? {root: loc.root, path: loc.path.slice(0, -1)} : HOME);
    const preview = loc.file ? <Preview loc={loc} onBack={narrow ? back : () => setLoc({root: loc.root, path: loc.path})} onGive={askGive} onOpenConversation={openConversation}
      give={<GiveButton onPress={() => askGive({root: loc.root!, path: loc.path, file: loc.file!})} />} /> : null;
    return (
      <div className="ah-state mb-page" data-testid="files-page">
        <header className="mb-page-head">
          <div>
            <h1>Tiedostot</h1>
            <span className="mb-meta">Microsoft 365 · {ME} · synkronoitu 10.48</span>
          </div>
          <Segmented data-testid="b-tabs" label="Näytä" value={bTab} onChange={setBTab} size="row"
            options={[{id: 'browse', label: 'Selaa'}, {id: 'changes', label: `Agentin muutokset${changes().length ? ` (${changes().length})` : ''}`}]} />
        </header>
        <LevelNote />
        {bTab === 'changes' ? (
          <div className="mb-page-changes"><ChangeList onOpenFile={openChange} onOpenConversation={openConversation} /></div>
        ) : narrow ? (
          <div className="mb-stack">
            {!loc.root ? <Sources loc={loc} onPick={setLoc} /> : loc.file ? preview : (
              <>
                <ControlButton size="row" variant="quiet" data-testid="files-back" onPress={back}><Icon name="back" />Takaisin</ControlButton>
                <Crumbs loc={loc} onGo={setLoc} />
                <Files loc={loc} onGo={setLoc} onGive={askGive} />
              </>
            )}
          </div>
        ) : (
          <div className={`mb-columns${loc.file ? ' with-preview' : ''}`}>
            <Sources loc={loc} onPick={setLoc} />
            <div className="mb-col-files"><Crumbs loc={loc} onGo={setLoc} /><Files loc={loc} onGo={setLoc} onGive={askGive} /></div>
            {preview ? <div className="mb-col-preview">{preview}</div> : null}
          </div>
        )}
        {giveDialog}
      </div>
    );
  };

  // ---- C: the conversation's panel ----
  const cPanel = () => {
    const back = () => setLoc(loc.file ? {root: loc.root, path: loc.path} : loc.path.length ? {root: loc.root, path: loc.path.slice(0, -1)} : HOME);
    const fromHere = (l: Loc) => { setLoc(l); setCTab('browse'); };
    const giveHere = <GiveButton onPress={() => give({root: loc.root!, path: loc.path, file: loc.file!})} label="Lisää viestiin" />;
    return (
      <section className="ah-view-pane ah-file-shelf mb-panel" data-testid="c-panel" aria-label="Microsoft 365">
        <header className="ah-editor-header">
          <h2 className="ah-view-title">Microsoft 365</h2>
          <span className="ah-editor-controls">
            <ControlButton data-testid="c-panel-close" size="row" variant="quiet" aria-label="Sulje" title="Sulje" onPress={() => setPanel(false)}><Icon name="cross" /></ControlButton>
          </span>
        </header>
        <div className="ah-file-shelf-scroll mb-panel-scroll">
          <Segmented data-testid="c-tabs" label="Näytä" value={cTab} onChange={(t) => { setCTab(t); if (t === 'browse') setLoc(HOME); }} size="row"
            options={[{id: 'here', label: 'Tässä keskustelussa'}, {id: 'browse', label: 'Selaa'}]} />
          <LevelNote compact />
          {cTab === 'here' ? (
            <div className="mb-here" data-testid="c-here">
              <h3 className="mb-h3">Agentti muutti</h3>
              <ChangeList onOpenFile={(c) => fromHere({root: c.root, path: c.path, file: c.file})} />
              <h3 className="mb-h3">Agentti luki</h3>
              <ul className="mb-changes" data-testid="read-list">
                {READS.map((r) => (
                  <li key={r.file}>
                    <Icon name="eye" className="mb-row-icon" />
                    <div className="mb-change-text">
                      <button type="button" className="mb-link-strong" data-testid={`read-${r.file}`} onClick={() => fromHere({root: r.root, path: r.path, file: r.file})}>{r.file}</button>
                      <span className="mb-meta">{r.at} · {placeOf(rootOf(r.root)!, r.path)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : !loc.root ? <Sources loc={loc} onPick={setLoc} /> : loc.file ? (
            <Preview loc={loc} onBack={back} onGive={give} onOpenConversation={noop} give={giveHere} />
          ) : (
            <>
              <ControlButton size="row" variant="quiet" data-testid="files-back" onPress={back}><Icon name="back" />Takaisin</ControlButton>
              <Crumbs loc={loc} onGo={setLoc} />
              <Files loc={loc} onGo={setLoc} onGive={give} />
            </>
          )}
        </div>
      </section>
    );
  };

  // ---- Conversation: the worked one, or a new one with a given file ----
  const conversation = (newOne: boolean) => {
    const items: {id: string; kind: string; content: React.ReactNode}[] = [];
    if (!newOne) {
      items.push({id: 'u1', kind: 'user', content: <UserMessage sourceText={ASK} onCopy={noop} time="10.38"><Markdown text={ASK} /></UserMessage>});
      items.push({id: 'a1', kind: 'assistant', content: (
        <div>
          <AgentTurn key={s.level} steps={turnSteps(s.level).map((x, i) => ({...x, at: T0 + 38 * 60000 + i * 40000}))} startedAt={T0 + 38 * 60000} duration="5 min 12 s" />
          {direction === B && changes().length ? (
            <p className="mb-turn-links" data-testid="turn-links">
              <Icon name="folder" />Muutti Microsoftissa:{' '}
              {changes().map((c, i) => <React.Fragment key={c.id}>{i ? ', ' : ''}<button type="button" className="mb-link" data-testid={`turn-link-${c.id}`} onClick={() => openChange(c)}>{c.file}</button></React.Fragment>)}
            </p>
          ) : null}
        </div>
      )});
    }
    if (s.sent && (newOne || direction === C || current === 'kesko')) {
      items.push({id: 'u2', kind: 'user', content: (
        <UserMessage sourceText={s.sentText} onCopy={noop} time="10.52">
          <div className="mb-sent"><GivenChip g={s.sent} />{s.sentText ? <Markdown text={s.sentText} /> : null}</div>
        </UserMessage>
      )});
      items.push({id: 'a2', kind: 'assistant', content: <AssistantMessage streamState="streaming" onCopy={noop}><Markdown text={`Luen tiedoston ${s.sent.file}…`} /></AssistantMessage>});
    }
    return (
      <div className="ah-state mb-main">
        <ConversationFrame>
          <AgentHeader title={newOne ? 'Uusi keskustelu' : 'Keskon viikkoraportti'} workspaceLabel="raportit" workspaceHref="/workspaces/ws_r"
            activityLabel={s.sent ? 'Työskentelee' : ''} activityAnimated={!!s.sent} activityKind={s.sent ? 'working' : 'neutral'} controlLabel="" detailsExpanded={false} onToggleDetails={noop}
            filesControl={direction === C && !newOne ? (
              <ControlButton data-testid="c-toggle" size="row" variant="quiet" className="ah-files-toggle" aria-pressed={panel}
                aria-label="Microsoft 365 -tiedostot tässä keskustelussa" title="Microsoft 365 -tiedostot tässä keskustelussa" onPress={() => setPanel(!panel)}>
                <Icon name="folder" /> <span>{READS.length + changes().length}</span>
              </ControlButton>
            ) : undefined} />
          <ConversationStream>
            <ConversationTimeline key={`${newOne}-${s.level}`} state={items.length ? 'ready' : 'empty'} items={items} historyMode="pagedAccessible" onJumpToLatest={noop}
              emptyLabel={newOne ? 'Uusi keskustelu työtilassa raportit.' : null} />
          </ConversationStream>
          {s.given ? (
            <div className="mb-given-row" data-testid="given-row">
              <GivenChip g={s.given} onRemove={() => { store.given = null; notify(); }} />
              <span className="mb-meta">Agentti saa tiedoston sijainnin ja lukee sen itse.</span>
            </div>
          ) : null}
          <Composer value={draft} onChange={setDraft} activity={s.sent ? 'working' : 'idle'} selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={(t) => send(t ?? draft)} onSteer={noop} onFollowUp={noop} onInterrupt={noop} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
        </ConversationFrame>
      </div>
    );
  };

  // ---- Main ----
  let main: React.ReactNode;
  if (settings) {
    main = (
      <div className="ah-settings-layer">
        <div className="ah-state">
          <AccountSettings routeSection="tiedot" routeRow={undefined} onNavigate={(p) => navigate(p)}
            profile={{name: 'Aino Virtanen', email: ME, avatar_url: ''}} csrf="prototype"
            modelSelector={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>}
            onClose={() => navigate('/workspaces/ws_r?conversation=kesko')} />
          {direction === A && params.get('tili') !== 'microsoft' ? <Into after='[data-testid="integration-account-microsoft"]'>{aEntry}</Into> : null}
          {direction === A && params.get('tili') === 'microsoft' ? <IntoMain>{aSection}</IntoMain> : null}
          {aDialog}
        </div>
      </div>
    );
  } else if (filesPage && direction === B) {
    main = bPage();
  } else if (isNew) {
    main = conversation(true);
  } else if (direction === C) {
    main = (
      <ViewSplit open={panel} expanded={false} width={panelWidth} min={360} max={720} panel={panel ? cPanel() : null}
        onResize={(w) => setPanelWidth(Math.min(720, Math.max(360, w)))} onReset={() => setPanelWidth(460)} onShowConversation={noop}>
        {conversation(false)}
      </ViewSplit>
    );
  } else {
    main = conversation(false);
  }
  const title = settings ? 'Asetukset' : filesPage ? 'Tiedostot' : isNew ? 'Uusi keskustelu' : 'Keskon viikkoraportti';
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} rail={railView} main={main} />
      {s.toast ? <p className="mb-toast" role="status">{s.toast}</p> : null}
    </StatusBellProvider>
  );
}

/** Put the round's section after an element of the production settings page. */
function Into({after, children}: {after: string; children: React.ReactNode}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let el: HTMLElement | null = null;
    const place = () => {
      const anchor = document.querySelector(after);
      if (!anchor || (el && el.isConnected && el.previousElementSibling === anchor)) return;
      el ??= document.createElement('div');
      el.className = 'mb-into';
      anchor.after(el);
      setSlot(el);
    };
    place();
    const o = new MutationObserver(place);
    o.observe(document.querySelector('.ah-settings-layer') ?? document.body, {childList: true, subtree: true});
    return () => { o.disconnect(); el?.remove(); };
  }, [after]);
  return slot ? createPortal(children, slot) : null;
}

/** A's account page: the round's section takes the settings column, which
 * widens as Käyttöönotto's does; the section list stays beside it. */
function IntoMain({children}: {children: React.ReactNode}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let el: HTMLElement | null = null;
    const place = () => {
      const main = document.querySelector<HTMLElement>('.s-main');
      const heading = main?.querySelector(':scope > h2');
      if (!main || !heading) return;
      main.parentElement?.classList.add('wide', 'mb-sub');
      if (el && el.isConnected && el.previousElementSibling === heading) return;
      el ??= document.createElement('div');
      el.className = 'mb-into-main';
      heading.after(el);
      setSlot(el);
    };
    place();
    const o = new MutationObserver(place);
    o.observe(document.querySelector('.ah-settings-layer') ?? document.body, {childList: true, subtree: true});
    return () => { o.disconnect(); el?.remove(); document.querySelector('.s-page')?.classList.remove('wide', 'mb-sub'); };
  }, []);
  return slot ? createPortal(children, slot) : null;
}

const START = ['/settings/tiedot?tili=microsoft', '/files', '/workspaces/ws_r?conversation=kesko'];

function App({direction}: {direction: number}) {
  const s = useStore();
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
  const restart = () => { resetStore(direction); setGeneration((g) => g + 1); };
  return (
    <div className={`mb-review variant-${direction}`} data-direction={direction}>
      <header className="mb-bar" ref={bar}>
        <strong>Mitä agentti näkee Microsoft 365:ssä</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Taso <select id="level" value={s.level} onChange={(e) => { store.level = e.target.value as Level; notify(); setGeneration((g) => g + 1); }}>
          <option value="full">Täysi</option><option value="drafts">Luonnokset</option><option value="read">Vain luku</option></select></label>
        <button type="button" data-testid="mb-reset" onClick={restart}>Alusta</button>
        <ol className="mb-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="mb-stage">
        <PiModelsProvider key={generation} enabled>
          <MemoryRouter key={generation} initialEntries={[START[direction]]}>
            <Main direction={direction} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
let pickedDirection = 0;
const stageSink = {set innerHTML(view: React.ReactNode) { resetStore(pickedDirection); flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => { pickedDirection = direction; resetStore(direction); return <App key={direction} direction={direction} />; });
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
