import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import {AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {ConversationTimeline} from '../../../../web/src/components/Conversation';
import {AgentHeader} from '../../../../web/src/components/Navigation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton, ExternalLink, IconButton, LinkRow} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {AccountSettings, AccountShelf} from '../../../../web/src/components/Account';
import {LetterMark, levelName} from '../../../../web/src/components/Integrations';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Integrations.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// proto-agent-resources-view, round 2. Jari (6.11.2026) chose round 1's B,
// the list by kind of thing, and asked whether every kind gets its own
// round. This round designs every kind's section together so that they stay
// consistent: files (OneDrive, SharePoint, Google Drive, Dropbox), mail,
// calendar, contacts, code (GitHub, Gitea) and own machines. Every kind's
// section says what is listed, what can be browsed, the level and its
// limits, what the agent does not see, and leads to the settings. The page
// is the same in every riff: B's kinds on the left, the chosen kind's
// section on the right. The riff is the shared section pattern, how the
// level and the content meet: A one source at a time behind tabs, B every
// account's content together under a small level table, C one card per
// source with the content folded behind Selaa. Content, levels and limits
// come from what the daemon already knows (the integration catalog, tea's
// and gh's logins, the own-machines lines) or reads with the person's own
// credentials. The rail, the settings page with its account cards and the
// controls are production components; the host is a fetch stand-in.
// Everything is synthetic.
const directions = ['A Välilehdet', 'B Yhdessä', 'C Kortit'];
const LINES = [
  'A Välilehdet: lajin osio näyttää yhden lähteen välilehtenä; taso ja rajat sen yllä, Ei näe sen alla.',
  'B Yhdessä: kaikkien tilien sisältö yhtenä listana (posti yhdessä, kalenteri yhdessä); tasot pienenä taulukkona yllä, Ei näe koko lajista alla.',
  'C Kortit: jokainen lähde on kortti, jossa taso, rajat ja Ei näe; sisältö avautuu kortin Selaa-painikkeesta.',
];

// ---------- Synthetic person: Aino Virtanen at Contoso ----------

const ME = 'aino.virtanen@contoso.example';
const GMAIL = 'aino.virtanen@gmail.example';
const SP = 'https://contoso.sharepoint.example';
type Level = 'full' | 'drafts' | 'read';
type Kind = 'files' | 'mail' | 'calendar' | 'contacts' | 'code' | 'machine';
type Can = 'change' | 'read' | 'none';
type AccId = 'ms' | 'g' | 'db' | 'gh' | 'gt' | 'own';
type Loc = {path: string[]; item: string; folder: string};

const store = {
  level: 'full' as Level, kind: '' as Kind | '', tab: {} as Partial<Record<Kind, string>>,
  open: {} as Record<string, boolean>, locs: {} as Record<string, Loc>, toast: '',
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return store;
}
const loc = (key: string): Loc => (store.locs[key] ??= {path: [], item: '', folder: ''});
const setLoc = (key: string, patch: Partial<Loc>) => { store.locs[key] = {...loc(key), ...patch}; notify(); };
const msFull = () => store.level === 'full';

type Acc = {id: AccId; mark: string; tone: 0 | 1 | 2 | 3; name: string; who: string; settings: string; level: () => {text: string; wide: boolean}};
const ACCOUNTS: Acc[] = [
  {id: 'ms', mark: 'M', tone: 2, name: 'Microsoft 365', who: ME, settings: '/settings/tiedot#microsoft', level: () => ({text: levelName('microsoft', store.level), wide: store.level === 'full'})},
  {id: 'g', mark: 'G', tone: 1, name: 'Google', who: GMAIL, settings: '/settings/tiedot#google', level: () => ({text: levelName('google', 'read'), wide: false})},
  {id: 'db', mark: 'D', tone: 3, name: 'Dropbox', who: ME, settings: '/settings/tiedot#dropbox', level: () => ({text: levelName('dropbox', 'app_folder'), wide: false})},
  {id: 'gh', mark: 'GH', tone: 0, name: 'GitHub', who: 'aino-virtanen', settings: '/settings/koodipalvelut#github', level: () => ({text: 'Kaikki repot', wide: true})},
  {id: 'gt', mark: 'Gt', tone: 3, name: 'Gitea', who: 'aino · git.contoso.example', settings: '/settings/koodipalvelut#gitea', level: () => ({text: 'Luku ja push', wide: true})},
  {id: 'own', mark: 'K', tone: 0, name: 'Omat koneet', who: 'Tailscale', settings: '/settings/omatkoneet#own-machines', level: () => ({text: '', wide: true})},
];
const accOf = (id: AccId) => ACCOUNTS.find((a) => a.id === id)!;
/** "Microsoft 365 -asetukset", "GitHub-asetukset". */
const settingsLabel = (a: Acc) => (a.id === 'own' ? 'Koneen asetukset' : a.name.includes(' ') ? `${a.name} -asetukset` : `${a.name}-asetukset`);

/** What the agent does not see, and what the person can do about it. */
type Hidden = {id: string; what: string; why: string; action?: {label: string; to: string}};
type Src = {
  id: string; acc: AccId; kind: Kind; name: string; place?: string;
  can: () => Can; ability: () => string; limits?: () => string[]; hidden?: Hidden[];
  level?: () => {text: string; wide: boolean};
  web?: {href: string; label: string};
};
const levelOf = (s: Src) => (s.level ?? accOf(s.acc).level)();

const SRC: Src[] = [
  {id: 'ms-od', acc: 'ms', kind: 'files', name: 'OneDrive', can: () => (msFull() ? 'change' : 'read'),
    ability: () => (msFull() ? 'Lukee ja muuttaa. Muutos siirtyy OneDriveen muutamassa minuutissa, ja siellä muokkaajaksi näkyy sinun nimesi.' : 'Lukee. Ei voi muuttaa tiedostoja OneDrivessa.'),
    limits: () => (msFull() ? ['Tiedostolle voi luoda jakolinkin.'] : []),
    web: {href: 'https://contoso-my.sharepoint.example/personal/aino_virtanen', label: 'Avaa OneDrivessa'}},
  {id: 'ms-proj', acc: 'ms', kind: 'files', name: 'Asiakasprojektit', place: 'SharePoint · Jaetut asiakirjat', can: () => (msFull() ? 'change' : 'read'),
    ability: () => (msFull() ? 'Lukee ja muuttaa. Muutos siirtyy SharePointiin muutamassa minuutissa, ja siellä muokkaajaksi näkyy sinun nimesi.' : 'Lukee. Ei voi muuttaa tiedostoja SharePointissa.'),
    limits: () => (msFull() ? ['Tiedostolle voi luoda jakolinkin.'] : []),
    hidden: [
      {id: 'h-yleinen', what: 'Contoso yleinen › Jaetut asiakirjat', why: 'Et ole valinnut tätä kirjastoa agentille.', action: {label: 'Valitse kirjastot', to: '/settings/tiedot#microsoft'}},
      {id: 'h-johto', what: 'Johtoryhmä', why: 'Seuraat sivustoa, mutta sinulla ei ole pääsyä sen kirjastoihin.'},
      {id: 'h-muut', what: 'Muut SharePoint-sivustot', why: 'Vain seuraamasi sivustot tulevat mukaan.'},
    ],
    web: {href: `${SP}/sites/asiakasprojektit/Shared%20Documents`, label: 'Avaa SharePointissa'}},
  {id: 'ms-myynti', acc: 'ms', kind: 'files', name: 'Myynti', place: 'SharePoint · Tarjoukset', can: () => (msFull() ? 'change' : 'read'),
    ability: () => (msFull() ? 'Lukee ja muuttaa. Muutos siirtyy SharePointiin muutamassa minuutissa.' : 'Lukee. Ei voi muuttaa tiedostoja SharePointissa.'),
    limits: () => (msFull() ? ['Tiedostolle voi luoda jakolinkin.'] : []),
    web: {href: `${SP}/sites/myynti/Tarjoukset`, label: 'Avaa SharePointissa'}},
  {id: 'g-drive', acc: 'g', kind: 'files', name: 'Google Drive', place: 'Kansio Kuitit 2026', can: () => 'read',
    ability: () => 'Lukee valitsemaasi kansiota. Ei voi muuttaa tiedostoja Drivessa.',
    hidden: [{id: 'h-drive', what: 'Muu Google Drive', why: 'Valitsit agentille vain kansion Kuitit 2026.', action: {label: 'Valitse kansiot', to: '/settings/tiedot#google'}}],
    web: {href: 'https://drive.google.example/', label: 'Avaa Drivessa'}},
  {id: 'db-app', acc: 'db', kind: 'files', name: 'Dropbox', place: 'Apps › Open Habitat', can: () => 'change',
    ability: () => 'Lukee ja muuttaa vain sovelluksen omaa kansiota Apps › Open Habitat.',
    hidden: [{id: 'h-dropbox', what: 'Muu Dropbox', why: 'Tasolla Vain sovelluskansio agentti ei näe muita kansioitasi.', action: {label: 'Vaihda taso', to: '/settings/tiedot#dropbox'}}],
    web: {href: 'https://www.dropbox.example/home/Apps/Open%20Habitat', label: 'Avaa Dropboxissa'}},
  {id: 'ms-mail', acc: 'ms', kind: 'mail', name: 'Outlook-posti', place: ME, can: () => (store.level === 'read' ? 'read' : 'change'),
    ability: () => (store.level === 'full' ? 'Lukee, järjestelee, kirjoittaa luonnoksia ja lähettää sinun nimissäsi.' : store.level === 'drafts' ? 'Lukee, järjestelee ja kirjoittaa luonnoksia. Ei voi lähettää.' : 'Lukee. Ei voi muuttaa eikä lähettää mitään.'),
    limits: () => (store.level === 'full' ? ['Lähetetty viesti lähtee heti; sitä ei voi perua.'] : []),
    hidden: [{id: 'h-shared-mail', what: 'Jaettu postilaatikko myynti@contoso.example', why: 'Yhteys kattaa vain oman postilaatikkosi.'}],
    web: {href: 'https://outlook.office.example/mail/', label: 'Avaa Outlookissa'}},
  {id: 'g-mail', acc: 'g', kind: 'mail', name: 'Gmail', place: GMAIL, can: () => 'read', ability: () => 'Lukee. Ei voi muuttaa eikä lähettää mitään.', web: {href: 'https://mail.google.example/', label: 'Avaa Gmailissa'}},
  {id: 'ms-cal', acc: 'ms', kind: 'calendar', name: 'Outlook-kalenteri', can: () => (msFull() ? 'change' : 'read'),
    ability: () => (msFull() ? 'Lukee ja muokkaa tapahtumia.' : 'Lukee. Ei voi luoda tapahtumia eikä lähettää kutsuja.'),
    limits: () => (msFull() ? ['Tapahtuma osallistujineen lähettää aina kutsut.'] : []),
    hidden: [{id: 'h-cal-shared', what: 'Mikko Lainen kalenteri ja kokoushuoneet', why: 'Näet ne Outlookissa, mutta yhteys kattaa vain omat kalenterisi.'}],
    web: {href: 'https://outlook.office.example/calendar/', label: 'Avaa Outlookissa'}},
  {id: 'g-cal', acc: 'g', kind: 'calendar', name: 'Google-kalenteri', can: () => 'read', ability: () => 'Lukee. Ei voi luoda tapahtumia eikä lähettää kutsuja.', web: {href: 'https://calendar.google.example/', label: 'Avaa kalenterissa'}},
  {id: 'ms-contacts', acc: 'ms', kind: 'contacts', name: 'Outlook-yhteystiedot', can: () => (msFull() ? 'change' : 'read'),
    ability: () => (msFull() ? 'Lukee ja muokkaa.' : 'Lukee.'),
    hidden: [{id: 'h-gal', what: 'Contosoin osoitteisto', why: 'Yhteys kattaa vain omat yhteystietosi, ei organisaation osoitteistoa.'}],
    web: {href: 'https://outlook.office.example/people/', label: 'Avaa Outlookissa'}},
  {id: 'g-contacts', acc: 'g', kind: 'contacts', name: 'Google-yhteystiedot', can: () => 'read', ability: () => 'Lukee.', web: {href: 'https://contacts.google.example/', label: 'Avaa Googlessa'}},
  {id: 'gh-repos', acc: 'gh', kind: 'code', name: 'GitHub-repot', can: () => 'change',
    ability: () => 'Lukee ja pushaa kaikkiin repoihin, joihin sinulla on kirjoitusoikeus. Issuet, pull requestit ja kommentit tehdään sinun nimissäsi.',
    limits: () => ['GitHub ei anna rajata yksittäisiä repoja.'],
    hidden: [{id: 'h-kesko', what: 'kesko-digital', why: 'Organisaatio ei salli Habitatin pääsyä repoihinsa. Sen omistaja voi hyväksyä Habitatin GitHubissa.'}],
    web: {href: 'https://github.com/aino-virtanen', label: 'Avaa GitHubissa'}},
  {id: 'gt-repos', acc: 'gt', kind: 'code', name: 'Gitea-repot', place: 'git.contoso.example', can: () => 'change',
    ability: () => 'Lukee ja pushaa repoihin, joihin käyttäjä aino pääsee palvelimella git.contoso.example.',
    web: {href: 'https://git.contoso.example/aino', label: 'Avaa Giteassa'}},
  {id: 'mac', acc: 'own', kind: 'machine', name: 'aino-mbp', place: 'MacBook Pro · macOS', can: () => 'change',
    level: () => ({text: 'Päättyy 4.12.', wide: true}),
    ability: () => 'Kaikki, mitä käyttäjä aino saa koneella, kysymättä lupaa jokaiseen komentoon. Pääsy päättyy 4.12.2026.',
    limits: () => ['Palvelimen ylläpitäjä pääsee samaa reittiä koneellesi.'],
    hidden: [{id: 'h-mac', what: 'Työpöytä, Dokumentit ja Mail', why: 'macOS suojaa ne, koska agentille ei annettu täyttä levyn käyttöoikeutta.'}]},
  {id: 'pc', acc: 'own', kind: 'machine', name: 'aino-pc', place: 'Windows 11', can: () => 'none',
    level: () => ({text: 'Päättyi 1.11.', wide: false}),
    ability: () => 'Pääsy päättyi 1.11.2026. Agentti ei pääse koneelle ennen kuin lisäät pääsyn uudelleen.'},
];
const srcOf = (id: string) => SRC.find((s) => s.id === id);
const srcsOf = (k: Kind) => SRC.filter((s) => s.kind === k);

/** Integrations with no account yet: each leads to its own connect step. */
type Offer = {id: string; mark: string; tone: 0 | 1 | 2 | 3; name: string; what: string; kinds: Kind[]; to: string};
const OFFERS: Offer[] = [
  {id: 'apple', mark: 'iC', tone: 3, name: 'Apple (iCloud)', what: 'iCloud-posti, kalenteri ja yhteystiedot', kinds: ['mail', 'calendar', 'contacts'], to: '/settings/tiedot#apple'},
  {id: 'imap', mark: '@', tone: 3, name: 'Sähköposti (IMAP)', what: 'Muu postilaatikko', kinds: ['mail'], to: '/settings/tiedot#imap'},
  {id: 'gitlab', mark: 'GL', tone: 2, name: 'GitLab', what: 'gitlab.com tai yrityksen oma GitLab', kinds: ['code'], to: '/settings/koodipalvelut#gitlab'},
  {id: 'machine', mark: '+', tone: 0, name: 'Toinen kone', what: 'Oma kone Tailscalen kautta', kinds: ['machine'], to: '/settings/omatkoneet#own-machines'},
];

const KINDS: {id: Kind; label: string; icon: IconName; listed: string}[] = [
  {id: 'files', label: 'Tiedostot', icon: 'folder', listed: 'Kansiot ja tiedostot sellaisina kuin agentti ne näkee. Agentin luomat ja muuttamat on merkitty.'},
  {id: 'mail', label: 'Posti', icon: 'mail', listed: 'Postilaatikon kansiot ja viestit. Agentin kirjoittamat luonnokset on merkitty.'},
  {id: 'calendar', label: 'Kalenteri', icon: 'calendar', listed: 'Tämän ja ensi viikon tapahtumat.'},
  {id: 'contacts', label: 'Yhteystiedot', icon: 'contacts', listed: 'Yhteystiedot nimen mukaan.'},
  {id: 'code', label: 'Koodi', icon: 'repo', listed: 'Repot, joihin agentti pääsee, ja voiko se pushata niihin.'},
  {id: 'machine', label: 'Koneet', icon: 'laptop', listed: 'Koneet, joille agentti saa yhteyden. Koneen tiedostoja ei selata täällä.'},
];
const kindOf = (k: Kind) => KINDS.find((x) => x.id === k)!;
const DEFAULT_TAB: Record<Kind, string> = {files: 'ms-proj', mail: 'ms-mail', calendar: 'ms-cal', contacts: 'ms-contacts', code: 'gh-repos', machine: 'mac'};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** One sentence a kind's section opens with, the same in every riff. */
function summary(k: Kind) {
  const srcs = srcsOf(k);
  const accs = new Set(srcs.map((s) => s.acc)).size;
  const c = srcs.filter((s) => s.can() === 'change').length, r = srcs.filter((s) => s.can() === 'read').length, n = srcs.filter((s) => s.can() === 'none').length;
  const where = k === 'machine' ? plural(srcs.length, 'kone', 'konetta') : `${plural(srcs.length, 'lähde', 'lähdettä')} ${plural(accs, 'tililtä', 'tililtä')}`;
  const parts = [c ? (k === 'machine' ? `pääsee ${c}` : `voi muuttaa ${c}`) : '', r ? `lukee ${r}` : '', n ? `ei pääse ${n}` : ''].filter(Boolean);
  return `${where}. Agentti ${parts.join(', ')}.`;
}

// ---------- Content the agent reaches ----------

type Ext = 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'md' | 'png';
type F = {n: string; ext?: Ext; kids?: F[]; at: string; by: string; size?: string; body?: string; agent?: string};
const doc = (n: string, at: string, by: string, size: string, body?: string, agent?: string): F => ({n, ext: n.split('.').pop() as Ext, at, by, size, body, agent});
const dir = (n: string, at: string, kids: F[]): F => ({n, at, by: '', kids});
const VKO45 = `# Kesko – kassajärjestelmä · viikkoraportti vko 45

**Tila:** aikataulussa · **Budjetti:** 68 % käytetty

## Tehty
- Kuormitustesti 40 kassalle ajettu; vasteaika 0,8 s (tavoite 1,0 s)
- Varmenteiden vaihdon aikataulu sovittu Keskon IT:n kanssa

## Seuraavaksi
- Pilotti kolmessa myymälässä vko 47`;
const PLAN = `# Projektisuunnitelma: kassajärjestelmän uusiminen

Asiakas: Kesko Oyj · Projektipäällikkö: Mikko Laine · Kesto 9/2026–2/2027

## Tavoite
Uusi kassajärjestelmä 40 myymälään. Pilotti kolmessa myymälässä ennen joulua.`;
const FILES: Record<string, F[]> = {
  'ms-od': [
    dir('Omat muistiinpanot', '4.11.', [doc('Kesko-palaveri 4.11.md', '4.11.', 'Aino Virtanen', '1 kt', '# Kesko-palaveri 4.11.\n\n- Pilotti kolmessa myymälässä vko 47\n- Varmenteet vaihdettava ennen joulukuuta')]),
    dir('Matkalaskut', '1.11.', [doc('Matkalasku lokakuu.xlsx', '1.11.', 'Aino Virtanen', '18 kt')]),
    doc('Esitys johtoryhmälle.pptx', '30.10.', 'Aino Virtanen', '2,4 Mt'),
    doc('CV Aino Virtanen.pdf', '12.9.', 'Aino Virtanen', '210 kt'),
  ],
  'ms-proj': [
    dir('Kesko – kassajärjestelmä', 'tänään 10.42', [
      dir('Viikkoraportit', 'tänään 10.42', [
        doc('Viikkoraportti vko 44.docx', '31.10.', 'Aino Virtanen', '38 kt'),
        doc('Viikkoraportti vko 45.docx', 'tänään 10.42', 'Aino Virtanen', '39 kt', VKO45, 'Agentti loi 10.42'),
      ]),
      doc('Projektisuunnitelma.docx', '28.10.', 'Mikko Laine', '84 kt', PLAN),
      doc('Avoimet kysymykset.md', '5.11.', 'Aino Virtanen', '1 kt', '# Avoimet kysymykset\n\n1. Kuka hyväksyy kassapäätteiden ohjelmistopäivitykset myymälöissä?\n2. Tarvitaanko varakassajärjestelmä pilotin ajaksi?'),
    ]),
    dir('Valio – raportointi', '3.11.', [doc('Vaatimukset.docx', '3.11.', 'Sanna Heikkinen', '57 kt')]),
    dir('Projektipohjat', '2.9.', [doc('Viikkoraporttipohja.docx', '2.9.', 'Mikko Laine', '31 kt')]),
  ],
  'ms-myynti': [
    dir('2026', '5.11.', [doc('Kesko – kassajärjestelmän laajennus.docx', '5.11.', 'Juha Mäkelä', '112 kt'), doc('Valio – raportoinnin jatko.docx', '22.10.', 'Juha Mäkelä', '96 kt')]),
    doc('Tarjouspohja 2026.docx', '14.8.', 'Juha Mäkelä', '64 kt'),
  ],
  'g-drive': [
    dir('Lokakuu', '31.10.', [doc('Taksi 14.10.pdf', '14.10.', 'Aino Virtanen', '88 kt'), doc('Hotelli Tampere 22.10.pdf', '23.10.', 'Aino Virtanen', '140 kt')]),
    doc('Junaliput VR 3.11.pdf', '3.11.', 'Aino Virtanen', '64 kt'),
    doc('Lounas asiakkaan kanssa 5.11.png', '5.11.', 'Aino Virtanen', '1,1 Mt'),
  ],
  'db-app': [
    dir('Keskolle toimitettavat', '4.11.', [doc('Kuormitustestin tulokset.pdf', '4.11.', 'Aino Virtanen', '420 kt'), doc('Asennusohje myymälöille.docx', '2.11.', 'Aino Virtanen', '73 kt')]),
    doc('Kuvakaappaus 2026-11-05 kello 14.12.png', '5.11.', 'Aino Virtanen', '620 kt'),
  ],
};
/** At a narrower level the agent's report could not be written, so it is not there. */
const listing = (src: string, path: string[]) => {
  let files = FILES[src] ?? [];
  for (const p of path) files = files.find((f) => f.n === p && f.kids)?.kids ?? [];
  return files.filter((f) => !(f.agent && !msFull()));
};
const fileIcon = (f: F): IconName => (f.kids ? 'folder' : f.ext === 'xlsx' ? 'table' : f.ext === 'pptx' || f.ext === 'png' ? 'image' : 'file');

// `o` orders the messages of every mailbox together, newest first.
type Msg = {id: string; o: number; from: string; to?: string; subject: string; at: string; preview: string; body?: string; agent?: string};
const MAIL: Record<string, {name: string; msgs: Msg[]}[]> = {
  'ms-mail': [
    {name: 'Saapuneet', msgs: [
      {id: 'm1', o: 90, from: 'Mikko Laine', subject: 'Re: Kassajärjestelmän pilotti vko 47', at: '10.12', preview: 'Myymälät on nyt sovittu: Prisma Kannelmäki, K-Citymarket Iso Omena ja…',
        body: 'Hei Aino,\n\nmyymälät on nyt sovittu: Prisma Kannelmäki, K-Citymarket Iso Omena ja K-Supermarket Kamppi. Pilotti alkaa maanantaina 16.11.\n\nVoitko päivittää viikkoraporttiin aikataulun?\n\nMikko'},
      {id: 'm2', o: 80, from: 'Keskon IT-tuki', subject: 'Varmenteiden vaihto: aikataulu', at: 'eilen', preview: 'Ehdotamme vaihtoa viikolla 49 yöajossa. Vahvistakaa sopiiko…'},
      {id: 'm3', o: 60, from: 'Sanna Heikkinen', subject: 'Valion vaatimukset, versio 3', at: '3.11.', preview: 'Liitteenä päivitetty vaatimusdokumentti. Muutokset merkitty keltaisella.'},
      {id: 'm4', o: 55, from: 'Juha Mäkelä', subject: 'Tarjous: kassajärjestelmän laajennus', at: '2.11.', preview: 'Kävisitkö tarjouksen teknisen osuuden läpi ennen perjantaita?'},
    ]},
    {name: 'Luonnokset', msgs: [
      {id: 'd1', o: 95, from: 'Aino Virtanen', to: 'Mikko Laine', subject: 'Re: Kassajärjestelmän pilotti vko 47', at: '10.44', preview: 'Kiitos! Päivitin viikkoraportin vko 45: pilotti alkaa 16.11. kolmessa…', agent: 'Agentti kirjoitti 10.44',
        body: 'Kiitos! Päivitin viikkoraportin vko 45: pilotti alkaa 16.11. kolmessa myymälässä. Raportti on Asiakasprojektit-kirjastossa.\n\nAino'},
    ]},
    {name: 'Lähetetyt', msgs: [{id: 's1', o: 40, from: 'Aino Virtanen', to: 'Keskon IT-tuki', subject: 'Re: Testiympäristön tunnukset', at: '30.10.', preview: 'Tunnukset toimivat, kiitos.'}]},
  ],
  'g-mail': [
    {name: 'Saapuneet', msgs: [
      {id: 'g1', o: 57, from: 'VR', subject: 'Matkalippusi Helsinki–Tampere 3.11.', at: '1.11.', preview: 'Kiitos ostoksestasi. Lippu on liitteenä.'},
      {id: 'g2', o: 45, from: 'Uimaseura Delfiini', subject: 'Syyskauden harjoitusvuorot', at: '28.10.', preview: 'Tiistain vuoro siirtyy Itäkeskuksen uimahalliin.'},
      {id: 'g3', o: 30, from: 'Taloyhtiö As Oy Kuusikko', subject: 'Saunavuorojen varaus', at: '20.10.', preview: 'Uudet saunavuorot voi varata 1.11. alkaen.'},
    ]},
    {name: 'Lähetetyt', msgs: [{id: 'gs1', o: 35, from: 'Aino Virtanen', to: 'Uimaseura Delfiini', subject: 'Re: Syyskauden harjoitusvuorot', at: '28.10.', preview: 'Kiitos tiedosta, Leo tulee tiistaina.'}]},
  ],
};
const DAYS = ['Tänään pe 6.11.', 'La 7.11.', 'Ma 9.11.', 'Ti 10.11.'];
type Ev = {day: string; time: string; title: string; where?: string; who?: string};
const CAL: Record<string, Ev[]> = {
  'ms-cal': [
    {day: 'Tänään pe 6.11.', time: '13.00–13.30', title: 'Kesko: viikkopalaveri', where: 'Teams', who: 'Mikko Laine, Keskon IT-tuki'},
    {day: 'Tänään pe 6.11.', time: '15.00–16.00', title: 'Tarjouksen läpikäynti', where: 'Neuvotteluhuone Pikkulaiva', who: 'Juha Mäkelä'},
    {day: 'Ma 9.11.', time: '9.00–9.15', title: 'Tiimin aamupalaveri', where: 'Teams'},
    {day: 'Ma 9.11.', time: '10.00–12.00', title: 'Valio: vaatimustyöpaja', where: 'Valio, Pasila', who: 'Sanna Heikkinen'},
    {day: 'Ti 10.11.', time: '14.00–15.00', title: 'Kuormitustestin katselmointi', where: 'Teams', who: 'Mikko Laine'},
  ],
  'g-cal': [
    {day: 'La 7.11.', time: '10.00–11.30', title: 'Uintikilpailu, Leo', where: 'Itäkeskuksen uimahalli'},
    {day: 'Ti 10.11.', time: '18.00–19.00', title: 'Hammaslääkäri', where: 'Oral Hammaslääkärit Kamppi'},
  ],
};
type Person = {name: string; mail: string; org: string};
const CONTACTS: Record<string, {count: number; rows: Person[]}> = {
  'ms-contacts': {count: 214, rows: [
    {name: 'Juha Mäkelä', mail: 'juha.makela@contoso.example', org: 'Contoso'},
    {name: 'Keskon IT-tuki', mail: 'it-tuki@kesko.example', org: 'Kesko'},
    {name: 'Mikko Laine', mail: 'mikko.laine@contoso.example', org: 'Contoso'},
    {name: 'Petri Nieminen', mail: 'petri.nieminen@valio.example', org: 'Valio'},
    {name: 'Sanna Heikkinen', mail: 'sanna.heikkinen@contoso.example', org: 'Contoso'},
  ]},
  'g-contacts': {count: 86, rows: [
    {name: 'As Oy Kuusikko, isännöitsijä', mail: 'isannointi@kuusikko.example', org: ''},
    {name: 'Matti Virtanen', mail: 'matti.virtanen@gmail.example', org: ''},
    {name: 'Uimaseura Delfiini', mail: 'valmennus@delfiini.example', org: ''},
  ]},
};
type Repo = {name: string; push: boolean; desc: string; at: string; o: number; workspace?: string};
const REPOS: Record<string, Repo[]> = {
  'gh-repos': [
    {name: 'contoso/kassa-api', push: true, desc: 'Kassapäätteiden rajapinta Keskon kassajärjestelmään', at: 'tänään', o: 9, workspace: 'kassa-api'},
    {name: 'contoso/raportointi', push: true, desc: 'Valion raportoinnin ETL ja kojelauta', at: '3.11.', o: 6},
    {name: 'contoso/verkkosivut', push: false, desc: 'contoso.example', at: '28.10.', o: 3},
    {name: 'aino-virtanen/muistiinpanot', push: true, desc: 'Omat muistiinpanot', at: '1.11.', o: 4},
  ],
  'gt-repos': [
    {name: 'contoso/infra', push: true, desc: 'Palvelimien asetukset', at: '4.11.', o: 7, workspace: 'infra'},
    {name: 'contoso/asennusskriptit', push: true, desc: 'Myymälöiden kassapäätteiden asennus', at: '2.11.', o: 5},
  ],
};
type Machine = {state: 'on' | 'expired'; user: string; seen: string; until: string};
const MACHINES: Record<string, Machine> = {
  mac: {state: 'on', user: 'aino', seen: 'tänään 10.40', until: '4.12.2026'},
  pc: {state: 'expired', user: 'aino', seen: '31.10.', until: '1.11.2026'},
};

// ---------- Host stand-in ----------

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const realFetch = window.fetch.bind(window);
const checked = '2026-11-06T08:50:00Z';
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  await later(60);
  if (path === '/api/v1/integrations') {
    const level = store.level, files = level === 'full' ? 'full' : 'read';
    const three = [{id: 'full', available: true}, {id: 'drafts', available: true}, {id: 'read', available: true}];
    return json({schema_version: 1, skill: 'current',
      providers: [
        {id: 'google', available: true, login: 'pasted_redirect', services: ['drive', 'mail', 'calendar', 'contacts'], levels: [{id: 'full', available: true}, {id: 'drafts', available: false, reason: 'not_offered'}, {id: 'read', available: true}]},
        {id: 'microsoft', available: true, login: 'device_code', services: ['onedrive', 'sharepoint', 'mail', 'calendar', 'contacts'], levels: three},
        {id: 'apple', available: true, login: 'app_password', services: ['mail', 'calendar', 'contacts']},
        {id: 'dropbox', available: true, login: 'pasted_redirect', services: ['dropbox'], levels: [{id: 'full', available: true}, {id: 'app_folder', available: true}, {id: 'read', available: true}]},
        {id: 'imap', available: true, login: 'app_password', services: ['mail']},
        {id: 'caldav', available: true, login: 'app_password', services: ['calendar']},
        {id: 'carddav', available: true, login: 'app_password', services: ['contacts']},
        {id: 'gitea', available: true, login: 'personal_token', services: ['git']},
        {id: 'gitlab', available: true, login: 'personal_token', services: ['git']},
      ],
      accounts: [
        {provider: 'microsoft', address: ME, checked_at: checked, level, services: [
          {id: 'onedrive', state: 'ok', access: files, directory: `~/cloud/onedrive/${ME}`, last_synced_at: '2026-11-06T08:48:00Z'},
          {id: 'sharepoint', state: 'ok', access: files, directory: `~/cloud/sharepoint/contoso-sharepoint-example-3fa2c1--${ME}`, last_synced_at: '2026-11-06T08:48:00Z'},
          {id: 'mail', state: 'ok', access: level},
          {id: 'calendar', state: 'ok', access: files},
          {id: 'contacts', state: 'ok', access: files},
        ]},
        {provider: 'google', address: GMAIL, checked_at: checked, level: 'read', services: [
          {id: 'drive', state: 'ok', access: 'read', directory: `~/cloud/google/${GMAIL}`, last_synced_at: '2026-11-06T08:30:00Z'},
          {id: 'mail', state: 'ok', access: 'read'}, {id: 'calendar', state: 'ok', access: 'read'}, {id: 'contacts', state: 'ok', access: 'read'},
        ]},
        {provider: 'dropbox', address: ME, checked_at: checked, level: 'app_folder', services: [
          {id: 'dropbox', state: 'ok', access: 'full', directory: `~/cloud/dropbox/${ME}`, last_synced_at: '2026-11-06T08:45:00Z'},
        ]},
      ],
      gitea: {state: 'ok', connections: [{id: 'gitea_3fa2c1b77a03e19f208d1e20', base_url: 'https://git.contoso.example', user: 'aino', kind: 'pat', owned: true, ambiguous: false, git: 'registered'}]},
      gitlab: {state: 'ok', connections: []},
    });
  }
  if (path === '/api/v1/own-machines')
    return json({schema_version: 1, web_identity_id: 'gh:4412093',
      tailscale: {state: 'on', node: {name: 'habitat-aino', dns_name: 'habitat-aino.tail3fa2.ts.net', address: '100.88.12.4', tailnet: 'aino.virtanen@contoso.example', login: 'aino.virtanen@contoso.example', shields_up: true}},
      peers: [
        {name: 'aino-mbp', dns_name: 'aino-mbp.tail3fa2.ts.net', os: 'macOS', address: '100.101.7.22', online: true, last_seen: '2026-11-06T08:40:00Z', ssh: 'possible'},
        {name: 'aino-pc', dns_name: 'aino-pc.tail3fa2.ts.net', os: 'windows', address: '100.101.7.31', online: false, last_seen: '2026-10-31T15:10:00Z', ssh: 'possible'},
      ],
      machines: [
        {name: 'aino-mbp', user: 'aino', address: '100.101.7.22', expires: '2026-12-04', expired: false, in_tailnet: true, online: true, last_seen: '2026-11-06T08:40:00Z', os: 'macOS', host_key: 'SHA256:3fa2c1b77a03e19f208d1e20b4c7a1aBcDeFgHiJkLmNoP', connection_open: false},
        {name: 'aino-pc', user: 'aino', address: '100.101.7.31', expires: '2026-11-01', expired: true, in_tailnet: true, online: false, last_seen: '2026-10-31T15:10:00Z', os: 'windows', host_key: 'SHA256:9b1e77c2a03e19f208d1e20b4c7a1aBcDeFgHiJkLmNoQ', connection_open: false},
      ],
      ssh_include: true, remove_command: "sed -i '' '/habitat-aino/d' ~/.ssh/authorized_keys",
      windows_remove_command: 'notepad $env:USERPROFILE\\.ssh\\authorized_keys', windows_admin_remove_command: 'notepad C:\\ProgramData\\ssh\\administrators_authorized_keys'});
  if (path === '/api/v1/server') return json({schema_version: 1, name: 'Contoso', administrator: false, version: '0.0.0-proto'});
  if (path === '/api/v1/pi/models')
    return json({schema_version: 1, default_provider: 'claude-bridge', default_model: 'claude-sonnet-5', default_thinking: 'medium', catalog_status: 'native_cached',
      models: [{id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'claude-bridge'}]});
  return new Response('', {status: 404});
};

const noop = () => {};
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

// ---------- Shared pieces ----------

type Go = (to: string) => void;

/** The source's level as the settings card shows it: production's pill. */
function Pill({src}: {src: Src}) {
  const p = levelOf(src);
  return <span className={`ig-lv ${p.wide ? 'full' : 'narrow'}`} data-testid={`pill-${src.id}`}><Icon className="ig-lv-icon" name={p.wide ? 'key' : 'lock'} />{p.text}</span>;
}
const canIcon = (c: Can): IconName => (c === 'change' ? 'pencil' : c === 'read' ? 'eye' : 'slash');

/** The level in words, and what it cannot prevent. */
function Ability({src, compact}: {src: Src; compact?: boolean}) {
  const limits = src.limits?.() ?? [];
  return (
    <div className={`rv-ability${compact ? ' compact' : ''}`} data-testid={`ability-${src.id}`} data-can={src.can()}>
      <Icon name={src.can() === 'change' ? 'pencil' : src.can() === 'read' ? 'lock' : 'slash'} />
      <div>
        <p><strong>{levelOf(src).text.replace(/\.$/, '')}.</strong> {src.ability()}</p>
        {limits.length ? <p className="rv-limits" data-testid={`limits-${src.id}`}><Icon name="warning" /><span><strong>Ei voi estää:</strong> {limits.join(' ')}</span></p> : null}
      </div>
    </div>
  );
}
function SettingsButton({src, onSettings, quiet}: {src: Src; onSettings: Go; quiet?: boolean}) {
  const acc = accOf(src.acc);
  return <ControlButton data-testid={`settings-${src.id}`} size="row" variant={quiet ? 'quiet' : 'secondary'} onPress={() => onSettings(acc.settings)}><Icon name="gear" />{settingsLabel(acc)}</ControlButton>;
}
const WebLink = ({src}: {src: Src}) => (src.web ? <ExternalLink className="rv-ext" href={src.web.href} target="_blank" rel="noreferrer"><Icon name="external" />{src.web.label}</ExternalLink> : null);
const SrcTitle = ({src, h = 'h3'}: {src: Src; h?: 'h3' | 'h4'}) => {
  const acc = accOf(src.acc), H = h;
  return (
    <div className="rv-head-title">
      <LetterMark mark={acc.mark} tone={acc.tone} />
      <div className="rv-text"><H className="rv-src-title">{src.name}</H><span className="rv-meta">{acc.id === 'own' ? src.place : `${acc.name} · ${acc.who}${src.place && src.place !== acc.who ? ` · ${src.place}` : ''}`}</span></div>
    </div>
  );
};

function HiddenList({items, onSettings, title = 'Agentti ei näe', testid = 'hidden-list', offers = []}: {items: {h: Hidden; src?: Src}[]; onSettings: Go; title?: string; testid?: string; offers?: Offer[]}) {
  if (!items.length && !offers.length) return null;
  return (
    <section className="rv-hidden" data-testid={testid}>
      <h4 className="rv-h3"><Icon name="eyeOff" />{title}</h4>
      <ul>
        {items.map(({h, src}) => (
          <li key={h.id} data-testid={h.id}>
            <span className="rv-hidden-what">{src ? <LetterMark mark={accOf(src.acc).mark} tone={accOf(src.acc).tone} small /> : null}<strong>{h.what}</strong></span>
            <span className="rv-meta">{h.why}</span>
            {h.action ? <ControlButton size="row" variant="quiet" onPress={() => onSettings(h.action!.to)}>{h.action.label}</ControlButton> : null}
          </li>
        ))}
        {offers.map((o) => (
          <li key={o.id} data-testid={`hidden-offer-${o.id}`}>
            <span className="rv-hidden-what"><LetterMark mark={o.mark} tone={o.tone} small /><strong>{o.name}</strong></span>
            <span className="rv-meta">Ei yhdistetty. {o.what}.</span>
            <ControlButton data-testid={`connect-${o.id}`} size="row" variant="quiet" onPress={() => onSettings(o.to)}>{o.id === 'machine' ? 'Lisää' : 'Yhdistä'}</ControlButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
function Offers({kind, onSettings, cards}: {kind: Kind; onSettings: Go; cards?: boolean}) {
  const offers = OFFERS.filter((o) => o.kinds.includes(kind));
  if (!offers.length) return null;
  return (
    <section className={cards ? 'rv-offers cards' : 'rv-offers'} data-testid="offers">
      {cards ? null : <h4 className="rv-h3"><Icon name="plug" />Yhdistä lisää</h4>}
      <ul>
        {offers.map((o) => (
          <li key={o.id} className={cards ? 'rv-card rv-offer' : 'rv-offer'} data-testid={`offer-${o.id}`}>
            <LetterMark mark={o.mark} tone={o.tone} small={!cards} />
            <span className="rv-text"><span className="rv-name">{o.name}</span><span className="rv-meta">{cards ? `Ei yhdistetty. ${o.what}.` : o.what}</span></span>
            <ControlButton data-testid={`connect-${o.id}`} size="row" variant={cards ? 'secondary' : 'quiet'} onPress={() => onSettings(o.to)}>{o.id === 'machine' ? 'Lisää' : 'Yhdistä'}</ControlButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Crumbs({parts, item, onGo}: {parts: {label: string; to: () => void}[]; item?: string; onGo?: never}) {
  return (
    <nav className="rv-crumbs" aria-label="Sijainti" data-testid="crumbs">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i ? <span aria-hidden="true">›</span> : null}
          {i === parts.length - 1 && !item ? <span aria-current="page">{p.label}</span> : <button type="button" className="rv-link" onClick={p.to}>{p.label}</button>}
        </React.Fragment>
      ))}
      {item ? <><span aria-hidden="true">›</span><span aria-current="page">{item}</span></> : null}
    </nav>
  );
}

function FileRows({files, onOpen, mark}: {files: F[]; onOpen: (f: F) => void; mark?: Src}) {
  return (
    <ul className="rv-rows">
      {files.map((f) => (
        <li key={f.n}>
          <button type="button" className="rv-row" data-testid={`file-${f.n}`} onClick={() => onOpen(f)}>
            <Icon name={fileIcon(f)} className="rv-row-icon" />
            <span className="rv-text"><span className="rv-name">{f.n}</span><span className="rv-meta">{f.kids ? `Muokattu ${f.at}` : `${f.at} · ${f.by} · ${f.size}`}</span></span>
            {f.agent ? <span className="rv-badge" data-testid="agent-badge"><Icon name="agent" />{f.agent}</span> : null}
          </button>
        </li>
      ))}
      {!files.length ? <li className="rv-empty">Kansio on tyhjä.</li> : null}
    </ul>
  );
}
function FilePreview({f, src}: {f: F; src: Src}) {
  return (
    <article className="rv-paper-wrap" data-testid="preview" aria-label={f.n}>
      <p className="rv-meta">Muokattu {f.at} · {f.agent && msFull() ? 'agentti sinun tunnuksillasi' : f.by} · {f.size}</p>
      {f.agent ? <span className="rv-badge" data-testid="agent-badge"><Icon name="agent" />{f.agent}</span> : null}
      {src.can() === 'read' ? <p className="rv-meta rv-lock-line" data-testid="cannot-change"><Icon name="lock" />Agentti ei voi muuttaa tätä tiedostoa.</p> : null}
      <div className="rv-paper">{f.body ? <Markdown text={f.body} /> : <p className="rv-meta">Tästä tiedostosta ei ole esikatselua. Agentti lukee sen silti.</p>}</div>
    </article>
  );
}
const rootName = (src: Src) => src.place?.replace(/^SharePoint · /, `${src.name} › `).replace(/^Kansio /, `${src.name} › `) ?? src.name;

/** Files of one source: the folder's rows, or one file with its content. */
function FilesView({src, lk}: {src: Src; lk: string}) {
  useStore();
  const l = loc(lk);
  const files = listing(src.id, l.path);
  const open = l.item ? files.find((f) => f.n === l.item) : undefined;
  const parts = [rootName(src), ...l.path].map((label, i) => ({label, to: () => setLoc(lk, {path: l.path.slice(0, i), item: ''})}));
  return (
    <div className="rv-content" data-testid="files">
      <Crumbs parts={parts} item={open?.n} />
      {open ? <FilePreview f={open} src={src} /> : <FileRows files={files} onOpen={(f) => (f.kids ? setLoc(lk, {path: [...l.path, f.n]}) : setLoc(lk, {item: f.n}))} />}
    </div>
  );
}

function MsgRows({msgs, onOpen, marks}: {msgs: {m: Msg; src: Src}[]; onOpen: (m: Msg) => void; marks?: boolean}) {
  return (
    <ul className="rv-rows">
      {msgs.map(({m, src}) => (
        <li key={m.id}>
          <button type="button" className="rv-row" data-testid={`msg-${m.id}`} onClick={() => onOpen(m)}>
            {marks ? <LetterMark mark={accOf(src.acc).mark} tone={accOf(src.acc).tone} small /> : <Icon name="mail" className="rv-row-icon" />}
            <span className="rv-text"><span className="rv-name">{m.subject}</span><span className="rv-meta">{m.to ? `→ ${m.to}` : m.from} · {m.at} · {m.preview}</span></span>
            {m.agent ? <span className="rv-badge" data-testid="agent-badge"><Icon name="agent" />{m.agent}</span> : null}
          </button>
        </li>
      ))}
      {!msgs.length ? <li className="rv-empty">Ei viestejä.</li> : null}
    </ul>
  );
}
function Message({m, src, back, onBack}: {m: Msg; src?: Src; back: string; onBack: () => void}) {
  return (
    <article className="rv-paper-wrap" data-testid="message" aria-label={m.subject}>
      <button type="button" className="rv-link" data-testid="message-back" onClick={onBack}>‹ {back}</button>
      <h4 className="rv-msg-subject">{m.subject}</h4>
      <p className="rv-meta">{src ? `${src.name} · ` : ''}{m.to ? `Vastaanottaja ${m.to}` : `Lähettäjä ${m.from}`} · {m.at}</p>
      {m.agent ? <span className="rv-badge" data-testid="agent-badge"><Icon name="agent" />{m.agent} · ei lähetetty</span> : null}
      <div className="rv-paper"><Markdown text={m.body ?? m.preview} /></div>
    </article>
  );
}
/** The agent's draft is not there at read only: it could not have been written. */
const draftOk = (m: Msg) => !(m.agent && store.level === 'read');
function Folders({names, current, counts, onPick}: {names: string[]; current: string; counts: number[]; onPick: (n: string) => void}) {
  return (
    <div className="rv-folders" role="tablist" aria-label="Kansiot">
      {names.map((n, i) => (
        <button key={n} type="button" role="tab" className="rv-chip" aria-selected={n === current} data-testid={`folder-${n}`} onClick={() => onPick(n)}>{n}<span className="rv-meta">{counts[i]}</span></button>
      ))}
    </div>
  );
}
function MailView({src, lk}: {src: Src; lk: string}) {
  useStore();
  const l = loc(lk);
  const folders = MAIL[src.id] ?? [];
  const folder = folders.find((f) => f.name === l.folder) ?? folders[0];
  const msgs = folder.msgs.filter(draftOk);
  const open = msgs.find((m) => m.id === l.item);
  return (
    <div className="rv-content" data-testid="mail">
      <Folders names={folders.map((f) => f.name)} current={folder.name} counts={folders.map((f) => f.msgs.filter(draftOk).length)} onPick={(n) => setLoc(lk, {folder: n, item: ''})} />
      {open ? <Message m={open} back={folder.name} onBack={() => setLoc(lk, {item: ''})} /> : <MsgRows msgs={msgs.map((m) => ({m, src}))} onOpen={(m) => setLoc(lk, {item: m.id})} />}
    </div>
  );
}

function Agenda({events}: {events: {e: Ev; src: Src}[]; }) {
  const days = DAYS.filter((d) => events.some(({e}) => e.day === d));
  const marks = new Set(events.map(({src}) => src.id)).size > 1;
  return (
    <div className="rv-content" data-testid="calendar">
      <p className="rv-meta">Tämä ja ensi viikko</p>
      {days.map((d) => (
        <section key={d} className="rv-day">
          <h4 className="rv-h3">{d}</h4>
          <ul className="rv-rows">
            {events.filter(({e}) => e.day === d).sort((a, b) => a.e.time.localeCompare(b.e.time, 'fi', {numeric: true})).map(({e, src}) => (
              <li key={e.title} className="rv-row static" data-testid={`event-${e.title}`}>
                <span className="rv-time">{e.time}</span>
                <span className="rv-text"><span className="rv-name">{e.title}</span><span className="rv-meta">{[e.where, e.who].filter(Boolean).join(' · ')}</span></span>
                {marks ? <LetterMark mark={accOf(src.acc).mark} tone={accOf(src.acc).tone} small /> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
function People({rows, count}: {rows: {p: Person; src: Src}[]; count: string}) {
  const marks = new Set(rows.map(({src}) => src.id)).size > 1;
  return (
    <div className="rv-content" data-testid="contacts">
      <p className="rv-meta">{count}</p>
      <ul className="rv-rows">
        {rows.map(({p, src}) => (
          <li key={p.mail} className="rv-row static" data-testid={`person-${p.name}`}>
            {marks ? <LetterMark mark={accOf(src.acc).mark} tone={accOf(src.acc).tone} small /> : <Icon name="user" className="rv-row-icon" />}
            <span className="rv-text"><span className="rv-name">{p.name}</span><span className="rv-meta">{[p.mail, p.org].filter(Boolean).join(' · ')}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function Repos({rows}: {rows: {r: Repo; src: Src}[]}) {
  const marks = new Set(rows.map(({src}) => src.id)).size > 1;
  return (
    <div className="rv-content" data-testid="code">
      <ul className="rv-rows">
        {rows.map(({r, src}) => (
          <li key={src.id + r.name} className="rv-row static" data-testid={`repo-${r.name}`}>
            {marks ? <LetterMark mark={accOf(src.acc).mark} tone={accOf(src.acc).tone} small /> : <Icon name="repo" className="rv-row-icon" />}
            <span className="rv-text"><span className="rv-name rv-mono">{r.name}</span><span className="rv-meta">{r.desc} · päivitetty {r.at}{r.workspace ? ` · työtila ${r.workspace}` : ''}</span></span>
            <span className={`rv-access${r.push ? '' : ' read'}`}>{r.push ? 'Luku ja push' : 'Vain luku'}</span>
          </li>
        ))}
      </ul>
      <p className="rv-meta">Repo, jota ei ole tuotu työtilaksi, on agentin käytössä komennoilla. Tuo se työtilaksi, kun haluat seurata työtä täällä.</p>
    </div>
  );
}
function MachineFacts({src}: {src: Src}) {
  const m = MACHINES[src.id];
  return (
    <dl className="rv-facts" data-testid={`machine-${src.id}`}>
      <dt>Tila</dt><dd>{m.state === 'on' ? <StatusMark label="Yhdistetty" kind="success" tone="success" /> : <StatusMark label="Pääsy päättynyt" kind="warning" tone="warning" />}</dd>
      <dt>Käyttäjä</dt><dd><code>{m.user}</code></dd>
      <dt>Verkko</dt><dd>Tailscale, nähty {m.seen}</dd>
      <dt>{m.state === 'on' ? 'Pääsy päättyy' : 'Pääsy päättyi'}</dt><dd>{m.until}</dd>
    </dl>
  );
}
function MachineView({src}: {src: Src}) {
  return (
    <div className="rv-content" data-testid="machine">
      <MachineFacts src={src} />
      <p className="rv-meta">Habitat ei selaa koneen tiedostoja. Agentti käyttää konetta etäyhteydellä, kun pyydät sitä keskustelussa.</p>
    </div>
  );
}

/** One source's content, the same browser in A and C. */
function SourceContent({src}: {src: Src}) {
  const lk = src.id;
  switch (src.kind) {
    case 'files': return <FilesView src={src} lk={lk} />;
    case 'mail': return <MailView src={src} lk={lk} />;
    case 'calendar': return <Agenda events={(CAL[src.id] ?? []).map((e) => ({e, src}))} />;
    case 'contacts': return <People rows={(CONTACTS[src.id]?.rows ?? []).map((p) => ({p, src}))} count={`${CONTACTS[src.id]?.count ?? 0} yhteystietoa`} />;
    case 'code': return <Repos rows={(REPOS[src.id] ?? []).map((r) => ({r, src}))} />;
    default: return <MachineView src={src} />;
  }
}

// ---------- B: every account's content together ----------

function MergedFiles({onSettings}: {onSettings: Go}) {
  useStore();
  const lk = 'merged-files', l = loc(lk);
  const src = l.path.length ? srcOf(l.path[0]) : undefined;
  if (!src) {
    return (
      <div className="rv-content" data-testid="files">
        <Crumbs parts={[{label: 'Kaikki tiedostot', to: noop}]} />
        <ul className="rv-rows">
          {srcsOf('files').map((s) => (
            <li key={s.id}>
              <button type="button" className="rv-row" data-testid={`root-${s.id}`} onClick={() => setLoc(lk, {path: [s.id], item: ''})}>
                <LetterMark mark={accOf(s.acc).mark} tone={accOf(s.acc).tone} small />
                <span className="rv-text"><span className="rv-name">{rootName(s)}</span><span className="rv-meta">{accOf(s.acc).name} · {plural(listing(s.id, []).length, 'kohde', 'kohdetta')}</span></span>
                <Icon name={canIcon(s.can())} className="rv-can" aria-label={s.can() === 'change' ? 'Voi muuttaa' : 'Lukee'} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const path = l.path.slice(1);
  const files = listing(src.id, path);
  const open = l.item ? files.find((f) => f.n === l.item) : undefined;
  const parts = [{label: 'Kaikki tiedostot', to: () => setLoc(lk, {path: [], item: ''})},
    ...[rootName(src), ...path].map((label, i) => ({label, to: () => setLoc(lk, {path: [src.id, ...path.slice(0, i)], item: ''})}))];
  return (
    <div className="rv-content" data-testid="files">
      <Crumbs parts={parts} item={open?.n} />
      {src.can() === 'read' && !open ? <p className="rv-meta rv-lock-line"><Icon name="lock" />{src.name}: agentti lukee, ei muuta.</p> : null}
      {open ? <FilePreview f={open} src={src} /> : <FileRows files={files} onOpen={(f) => (f.kids ? setLoc(lk, {path: [...l.path, f.n]}) : setLoc(lk, {item: f.n}))} />}
    </div>
  );
}
function MergedMail() {
  useStore();
  const lk = 'merged-mail', l = loc(lk);
  const srcs = srcsOf('mail');
  const names = ['Saapuneet', 'Luonnokset', 'Lähetetyt'];
  const inFolder = (n: string) => srcs.flatMap((src) => (MAIL[src.id] ?? []).filter((f) => f.name === n).flatMap((f) => f.msgs.filter(draftOk).map((m) => ({m, src})))).sort((a, b) => b.m.o - a.m.o);
  const folder = l.folder || 'Saapuneet';
  const msgs = inFolder(folder);
  const open = msgs.find(({m}) => m.id === l.item);
  return (
    <div className="rv-content" data-testid="mail">
      <Folders names={names} current={folder} counts={names.map((n) => inFolder(n).length)} onPick={(n) => setLoc(lk, {folder: n, item: ''})} />
      {open ? <Message m={open.m} src={open.src} back={folder} onBack={() => setLoc(lk, {item: ''})} /> : <MsgRows marks msgs={msgs} onOpen={(m) => setLoc(lk, {item: m.id})} />}
    </div>
  );
}
function MergedContent({kind, onSettings}: {kind: Kind; onSettings: Go}) {
  const srcs = srcsOf(kind);
  switch (kind) {
    case 'files': return <MergedFiles onSettings={onSettings} />;
    case 'mail': return <MergedMail />;
    case 'calendar': return <Agenda events={srcs.flatMap((src) => (CAL[src.id] ?? []).map((e) => ({e, src})))} />;
    case 'contacts': {
      const rows = srcs.flatMap((src) => (CONTACTS[src.id]?.rows ?? []).map((p) => ({p, src}))).sort((a, b) => a.p.name.localeCompare(b.p.name, 'fi'));
      return <People rows={rows} count={`${srcs.reduce((n, s) => n + (CONTACTS[s.id]?.count ?? 0), 0)} yhteystietoa kahdelta tililtä`} />;
    }
    case 'code': return <Repos rows={srcs.flatMap((src) => (REPOS[src.id] ?? []).map((r) => ({r, src}))).sort((a, b) => b.r.o - a.r.o)} />;
    default: return (
      <div className="rv-content" data-testid="machine">
        {srcs.map((s) => <div key={s.id} className="rv-machine-row"><strong className="rv-mono">{s.name}</strong><span className="rv-meta">{s.place}</span><MachineFacts src={s} /></div>)}
        <p className="rv-meta">Habitat ei selaa koneiden tiedostoja. Agentti käyttää konetta etäyhteydellä, kun pyydät sitä keskustelussa.</p>
      </div>
    );
  }
}

// ---------- The three section patterns ----------

type SectionProps = {kind: Kind; onSettings: Go};

/** A: one source at a time, as round 1's source view, behind tabs. */
function SectionTabs({kind, onSettings}: SectionProps) {
  const s = useStore();
  const srcs = srcsOf(kind);
  const src = srcOf(s.tab[kind] ?? DEFAULT_TAB[kind]) ?? srcs[0];
  return (
    <div className="rv-pattern-a">
      <div className="rv-tabs" role="tablist" aria-label="Lähteet">
        {srcs.map((x) => (
          <button key={x.id} type="button" role="tab" className="rv-tab" aria-selected={x === src} data-testid={`tab-${x.id}`} onClick={() => { store.tab[kind] = x.id; notify(); }}>
            <LetterMark mark={accOf(x.acc).mark} tone={accOf(x.acc).tone} small /><span>{x.name}</span>
          </button>
        ))}
      </div>
      <article className="rv-source" data-testid="source-view" data-source={src.id}>
        <SrcTitle src={src} />
        <Ability src={src} />
        <div className="rv-actions"><SettingsButton src={src} onSettings={onSettings} /><WebLink src={src} /></div>
        <SourceContent src={src} />
        <HiddenList items={(src.hidden ?? []).map((h) => ({h}))} onSettings={onSettings} />
      </article>
      <Offers kind={kind} onSettings={onSettings} />
    </div>
  );
}

/** B: a small table of levels, then every account's content as one list. */
function SectionTogether({kind, onSettings}: SectionProps) {
  useStore();
  const srcs = srcsOf(kind);
  const hidden = srcs.flatMap((src) => (src.hidden ?? []).map((h) => ({h, src})));
  return (
    <div className="rv-pattern-b">
      <section className="rv-levels" data-testid="levels" aria-label="Tasot">
        <ul>
          {srcs.map((x) => {
            const limits = x.limits?.() ?? [];
            return (
              <li key={x.id} className="rv-level-row" data-testid={`lvl-${x.id}`} data-can={x.can()}>
                <LetterMark mark={accOf(x.acc).mark} tone={accOf(x.acc).tone} small />
                <span className="rv-text">
                  <span className="rv-name">{x.name}<span className="rv-meta"> · {accOf(x.acc).id === 'own' ? x.place : accOf(x.acc).name}</span></span>
                  <span className="rv-meta" data-testid={`ability-${x.id}`} data-can={x.can()}>{x.ability()}</span>
                  {limits.length ? <span className="rv-meta rv-limit-line" data-testid={`limits-${x.id}`}><Icon name="warning" />Ei voi estää: {limits.join(' ')}</span> : null}
                </span>
                <Pill src={x} />
                <IconButton data-testid={`settings-${x.id}`} size="row" variant="quiet" aria-label={settingsLabel(accOf(x.acc))} onPress={() => onSettings(accOf(x.acc).settings)}><Icon name="gear" /></IconButton>
              </li>
            );
          })}
        </ul>
      </section>
      <MergedContent kind={kind} onSettings={onSettings} />
      <HiddenList items={hidden} offers={OFFERS.filter((o) => o.kinds.includes(kind))} onSettings={onSettings} title={`Agentti ei näe: ${kindOf(kind).label.toLowerCase()}`} />
    </div>
  );
}

/** C: one card per source, with the level first and the content folded. */
function SectionCards({kind, onSettings}: SectionProps) {
  const s = useStore();
  return (
    <div className="rv-pattern-c">
      <ul className="rv-cards">
        {srcsOf(kind).map((x) => {
          const open = !!s.open[x.id];
          return (
            <li key={x.id} className="rv-card" data-testid={`card-${x.id}`} data-open={open || undefined}>
              <div className="rv-card-head"><SrcTitle src={x} /><Pill src={x} /></div>
              <Ability src={x} compact />
              <HiddenList items={(x.hidden ?? []).map((h) => ({h}))} onSettings={onSettings} testid={`hidden-${x.id}`} />
              <div className="rv-actions">
                <ControlButton data-testid={`browse-${x.id}`} size="row" variant={open ? 'quiet' : 'secondary'} aria-expanded={open} onPress={() => { store.open[x.id] = !open; notify(); }}>
                  <Icon name={open ? 'up' : 'down'} />{open ? 'Piilota' : x.kind === 'machine' ? 'Näytä yhteys' : 'Selaa'}
                </ControlButton>
                <SettingsButton src={x} onSettings={onSettings} quiet />
                <WebLink src={x} />
              </div>
              {open ? <SourceContent src={x} /> : null}
            </li>
          );
        })}
      </ul>
      <Offers kind={kind} onSettings={onSettings} cards />
    </div>
  );
}

// ---------- The page ----------

function KindNav({sel, onPick}: {sel: Kind | ''; onPick: (k: Kind) => void}) {
  useStore();
  return (
    <nav className="rv-list" data-testid="list-kinds" aria-label="Lajit">
      <ul>
        {KINDS.map((k) => {
          const srcs = srcsOf(k.id);
          const accs = [...new Set(srcs.map((x) => x.acc))].map(accOf);
          return (
            <li key={k.id}>
              <button type="button" className="rv-src" data-testid={`kind-${k.id}`} aria-current={sel === k.id ? 'true' : undefined} onClick={() => onPick(k.id)}>
                <Icon name={k.icon} className="rv-row-icon" />
                <span className="rv-text"><span className="rv-name">{k.label}</span><span className="rv-meta">{k.id === 'machine' ? srcs.map((x) => x.name).join(', ') : accs.map((a) => a.name).join(', ')}</span></span>
                <span className="ah-rail-count">{srcs.length}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function KindSection({direction, kind, onSettings, onBack}: {direction: number; kind: Kind; onSettings: Go; onBack?: () => void}) {
  useStore();
  const k = kindOf(kind);
  const Pattern = [SectionTabs, SectionTogether, SectionCards][direction];
  return (
    <article className="rv-detail" data-testid="kind-section" data-kind={kind}>
      {onBack ? <ControlButton data-testid="detail-back" size="row" variant="quiet" onPress={onBack}><Icon name="back" />Agentin käytössä</ControlButton> : null}
      <header className="rv-kind-head">
        <h2><Icon name={k.icon} />{k.label}</h2>
        <p className="rv-summary" data-testid="kind-summary">{summary(kind)}</p>
        <p className="rv-meta">{k.listed}</p>
      </header>
      <Pattern kind={kind} onSettings={onSettings} />
    </article>
  );
}

function ResourcesPage({direction}: {direction: number}) {
  const s = useStore();
  const navigate = useNavigate();
  const narrow = useNarrow();
  const pick = (k: Kind) => { store.kind = k; notify(); document.querySelector('.rv-detail')?.scrollTo?.(0, 0); };
  const settings = (to: string) => navigate(to);
  const kind = s.kind || undefined;
  return (
    <div className="ah-state rv-page" data-testid="resources-page">
      {narrow && kind ? null : (
        <header className="rv-page-head">
          <div className="rv-text">
            <h1>Agentin käytössä</h1>
            <span className="rv-meta" data-testid="summary">{ACCOUNTS.length - 1} tiliä ja {srcsOf('machine').length} konetta. Kaikki tehdään sinun tunnuksillasi.</span>
          </div>
          <ControlButton data-testid="connect-more" size="row" variant="secondary" onPress={() => navigate('/settings/tiedot')}><Icon name="plus" />Yhdistä palvelu</ControlButton>
        </header>
      )}
      {narrow ? (
        kind ? <KindSection direction={direction} kind={kind} onSettings={settings} onBack={() => { store.kind = ''; notify(); }} /> : <KindNav sel="" onPick={pick} />
      ) : (
        <div className="rv-cols">
          <KindNav sel={s.kind} onPick={pick} />
          {kind ? <KindSection direction={direction} kind={kind} onSettings={settings} /> : <p className="rv-empty">Valitse laji.</p>}
        </div>
      )}
    </div>
  );
}

function Main({direction}: {direction: number}) {
  const s = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const settings = location.pathname.startsWith('/settings');
  const resources = location.pathname.startsWith('/resources');
  const section = settings ? location.pathname.split('/')[2] || 'tili' : '';
  const railView = (
    <WorkspaceRail collapsed={false} serverLabel="Contoso" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="2 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Aino Virtanen" onSettings={() => navigate('/settings/tiedot')} onLogout={noop} />}
      now={
        <div className="rv-rail" data-testid="rail-resources">
          <LinkRow href="/resources" current={resources} data-testid="rail-resources-link">
            <Icon name="shield" /><span>Agentin käytössä</span><span className="ah-rail-count">{SRC.length}</span>
          </LinkRow>
          <span className="rv-meta">Tiedostot, posti, koodi ja koneet</span>
        </div>
      }>
      <WorkspaceNavRow name="raportit" href="/workspaces/ws_r" />
      <WorkspaceNavRow name="kassa-api" href="/workspaces/ws_k" />
    </WorkspaceRail>
  );
  let main: React.ReactNode;
  if (settings) {
    main = (
      <div className="ah-settings-layer">
        <div className="ah-state">
          <AccountSettings routeSection={section} routeRow={location.hash.slice(1) || undefined} onNavigate={(p) => navigate(p)}
            profile={{name: 'Aino Virtanen', email: ME, avatar_url: ''}} csrf="prototype" nativeState="connected" nativeLogin="aino-virtanen"
            modelSelector={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>}
            onClose={() => navigate('/resources')} />
        </div>
      </div>
    );
  } else if (resources) {
    main = <ResourcesPage direction={direction} />;
  } else {
    main = (
      <div className="ah-state rv-main">
        <ConversationFrame>
          <AgentHeader title="Uusi keskustelu" workspaceLabel="raportit" workspaceHref="/workspaces/ws_r" activityLabel="" activityAnimated={false} activityKind="neutral" controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
          <ConversationStream>
            <ConversationTimeline state="empty" items={[]} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel="Uusi keskustelu työtilassa raportit." />
          </ConversationStream>
          <Composer value="" onChange={noop} activity="idle" selectedWorkingMode="steer" onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} onInterrupt={noop} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">Claude Sonnet 5 · medium</button>} />
        </ConversationFrame>
      </div>
    );
  }
  const title = settings ? 'Asetukset' : resources ? 'Agentin käytössä' : 'Uusi keskustelu';
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} rail={railView} main={main} />
      {s.toast ? <p className="rv-toast" role="status">{s.toast}</p> : null}
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';
function resetStore() {
  // The phone starts from the kinds, so every kind is on the first screen.
  const narrow = window.matchMedia('(max-width: 760px)').matches;
  Object.assign(store, {
    level: store.level, kind: narrow ? '' : 'files', tab: {}, open: {}, toast: '',
    locs: {'ms-proj': {path: ['Kesko – kassajärjestelmä', 'Viikkoraportit'], item: '', folder: ''}},
  });
}

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
  return (
    <div className={`rv-review variant-${direction}`} data-direction={direction}>
      <header className="rv-bar" ref={bar}>
        <strong>Agentin käytössä · kierros 2</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <label>Microsoft 365 -taso <select id="level" value={s.level} onChange={(e) => { store.level = e.target.value as Level; notify(); }}>
          <option value="full">Täysi</option><option value="drafts">Luonnokset, ei lähetystä</option><option value="read">Vain luku</option></select></label>
        <button type="button" data-testid="rv-reset" onClick={() => { store.level = 'full'; resetStore(); setGeneration((g) => g + 1); }}>Alusta</button>
        <ol className="rv-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="rv-stage">
        <PiModelsProvider key={generation} enabled>
          <MemoryRouter key={generation} initialEntries={['/resources']}>
            <Main direction={direction} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { resetStore(); flushSync(() => root.render(view === '' ? null : view)); }};
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
