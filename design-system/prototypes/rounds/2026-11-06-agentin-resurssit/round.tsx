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
import {ControlButton, ExternalLink, LinkRow} from '../../../../web/src/components/ControlElements';
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

// proto-agent-resources-view, round 1. Jari (6.11.2026) liked round 1's
// direction B of proto-browse-what-agent-sees-m365, a browsable view of the
// Microsoft files the agent sees, and asked for it to cover every
// integration with its level and limits, and to lead to each integration's
// settings and to connecting more. The view lives where B's Tiedostot did,
// a rail entry above the workspaces, and every direction has the same list
// beside the same browser. The axis is how the list is organised: A by
// account (as Settings is), B by kind of thing (files, mail, calendar,
// contacts, code, machines), C by what the agent may do (change, read,
// does not see). Content, levels and limits come from what the daemon
// already knows: the integration catalog (provider, account, level,
// services' access), tea's and glab's logins, gh's login and the own-machines
// lines. The rail, the settings page with its account cards and the
// controls are production components; the host behind them is a fetch
// stand-in. Everything is synthetic.
const directions = ['A Tileittäin', 'B Lajeittain', 'C Oikeuksittain'];
const LINES = [
  'A Tileittäin: lista on tilit kuten asetuksissa, jokaisen tilin alla sen palvelut; taso ja rajat tilin rivillä.',
  'B Lajeittain: lista on lajit (tiedostot, posti, kalenteri, yhteystiedot, koodi, koneet), joiden alla kaikkien tilien lähteet tasoineen.',
  'C Oikeuksittain: lista on kolme ryhmää, Voi muuttaa, Lukee ja Ei näe; tason vaihto siirtää lähteen ryhmästä toiseen.',
];
const A = 0, B = 1, C = 2;

// ---------- Synthetic person: Aino Virtanen at Contoso ----------

const ME = 'aino.virtanen@contoso.example';
const GMAIL = 'aino.virtanen@gmail.example';
const SP = 'https://contoso.sharepoint.example';
type Level = 'full' | 'drafts' | 'read';
type Kind = 'files' | 'mail' | 'calendar' | 'contacts' | 'code' | 'machine';
type Can = 'change' | 'read';
type AccId = 'ms' | 'g' | 'db' | 'gh' | 'gt' | 'mac';

const store = {level: 'full' as Level, sel: '' as string, loc: {path: [] as string[], item: '' as string}, folder: '', toast: ''};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return store;
}
function toast(text: string) {
  store.toast = text; notify();
  window.setTimeout(() => { if (store.toast === text) { store.toast = ''; notify(); } }, 2600);
}
const msFull = () => store.level === 'full';

type Acc = {id: AccId; mark: string; tone: 0 | 1 | 2 | 3; name: string; who: string; settings: string; pill: () => {text: string; wide: boolean}};
const ACCOUNTS: Acc[] = [
  {id: 'ms', mark: 'M', tone: 2, name: 'Microsoft 365', who: ME, settings: '/settings/tiedot#microsoft', pill: () => ({text: levelName('microsoft', store.level), wide: store.level === 'full'})},
  {id: 'g', mark: 'G', tone: 1, name: 'Google', who: GMAIL, settings: '/settings/tiedot#google', pill: () => ({text: levelName('google', 'read'), wide: false})},
  {id: 'db', mark: 'D', tone: 3, name: 'Dropbox', who: ME, settings: '/settings/tiedot#dropbox', pill: () => ({text: levelName('dropbox', 'app_folder'), wide: false})},
  {id: 'gh', mark: 'GH', tone: 0, name: 'GitHub', who: 'aino-virtanen', settings: '/settings/koodipalvelut#github', pill: () => ({text: 'Kaikki repot', wide: true})},
  {id: 'gt', mark: 'Gt', tone: 3, name: 'Gitea', who: 'aino · git.contoso.example', settings: '/settings/koodipalvelut#gitea', pill: () => ({text: 'Luku ja push', wide: true})},
  {id: 'mac', mark: 'K', tone: 0, name: 'Omat koneet', who: 'aino-mbp · käyttäjä aino', settings: '/settings/omatkoneet#own-machines', pill: () => ({text: 'Päättyy 4.12.', wide: true})},
];
const accOf = (id: AccId) => ACCOUNTS.find((a) => a.id === id)!;

/** What the agent does not see, and what the person can do about it. */
type Hidden = {id: string; what: string; why: string; action?: {label: string; to: string}};
type Src = {
  id: string; acc: AccId; kind: Kind; name: string; place?: string;
  can: () => Can; ability: () => string; limits?: () => string[]; hidden?: Hidden[];
  web?: {href: string; label: string};
};

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
  {id: 'ms-mail', acc: 'ms', kind: 'mail', name: 'Outlook-posti', can: () => (store.level === 'read' ? 'read' : 'change'),
    ability: () => (store.level === 'full' ? 'Lukee, järjestelee, kirjoittaa luonnoksia ja lähettää sinun nimissäsi.' : store.level === 'drafts' ? 'Lukee, järjestelee ja kirjoittaa luonnoksia. Ei voi lähettää.' : 'Lukee. Ei voi muuttaa eikä lähettää mitään.'),
    web: {href: 'https://outlook.office.example/mail/', label: 'Avaa Outlookissa'}},
  {id: 'ms-cal', acc: 'ms', kind: 'calendar', name: 'Outlook-kalenteri', can: () => (msFull() ? 'change' : 'read'),
    ability: () => (msFull() ? 'Lukee ja muokkaa tapahtumia.' : 'Lukee. Ei voi luoda tapahtumia eikä lähettää kutsuja.'),
    limits: () => (msFull() ? ['Tapahtuma osallistujineen lähettää aina kutsut.'] : []),
    web: {href: 'https://outlook.office.example/calendar/', label: 'Avaa Outlookissa'}},
  {id: 'ms-contacts', acc: 'ms', kind: 'contacts', name: 'Yhteystiedot', place: 'Outlook', can: () => (msFull() ? 'change' : 'read'),
    ability: () => (msFull() ? 'Lukee ja muokkaa.' : 'Lukee.'), web: {href: 'https://outlook.office.example/people/', label: 'Avaa Outlookissa'}},
  {id: 'g-drive', acc: 'g', kind: 'files', name: 'Google Drive', place: 'Kansio Kuitit 2026', can: () => 'read',
    ability: () => 'Lukee valitsemaasi kansiota. Ei voi muuttaa tiedostoja Drivessa.',
    hidden: [{id: 'h-drive', what: 'Muu Google Drive', why: 'Valitsit agentille vain kansion Kuitit 2026.', action: {label: 'Valitse kansiot', to: '/settings/tiedot#google'}}],
    web: {href: 'https://drive.google.example/', label: 'Avaa Drivessa'}},
  {id: 'g-mail', acc: 'g', kind: 'mail', name: 'Gmail', can: () => 'read', ability: () => 'Lukee. Ei voi muuttaa eikä lähettää mitään.', web: {href: 'https://mail.google.example/', label: 'Avaa Gmailissa'}},
  {id: 'g-cal', acc: 'g', kind: 'calendar', name: 'Google-kalenteri', can: () => 'read', ability: () => 'Lukee. Ei voi luoda tapahtumia eikä lähettää kutsuja.', web: {href: 'https://calendar.google.example/', label: 'Avaa kalenterissa'}},
  {id: 'db-app', acc: 'db', kind: 'files', name: 'Dropbox', place: 'Apps › Open Habitat', can: () => 'change',
    ability: () => 'Lukee ja muuttaa vain sovelluksen omaa kansiota Apps › Open Habitat.',
    hidden: [{id: 'h-dropbox', what: 'Muu Dropbox', why: 'Tasolla Vain sovelluskansio agentti ei näe muita kansioitasi.', action: {label: 'Vaihda taso', to: '/settings/tiedot#dropbox'}}],
    web: {href: 'https://www.dropbox.example/home/Apps/Open%20Habitat', label: 'Avaa Dropboxissa'}},
  {id: 'gh-repos', acc: 'gh', kind: 'code', name: 'GitHub-repot', can: () => 'change',
    ability: () => 'Lukee ja pushaa kaikkiin repoihin, joihin sinulla on kirjoitusoikeus. Issuet, pull requestit ja kommentit tehdään sinun nimissäsi.',
    limits: () => ['GitHub ei anna rajata yksittäisiä repoja.'],
    hidden: [{id: 'h-kesko', what: 'kesko-digital', why: 'Organisaatio ei salli Habitatin pääsyä repoihinsa. Sen omistaja voi hyväksyä Habitatin GitHubissa.'}],
    web: {href: 'https://github.com/aino-virtanen', label: 'Avaa GitHubissa'}},
  {id: 'gt-repos', acc: 'gt', kind: 'code', name: 'Gitea-repot', place: 'git.contoso.example', can: () => 'change',
    ability: () => 'Lukee ja pushaa repoihin, joihin käyttäjä aino pääsee palvelimella git.contoso.example.',
    web: {href: 'https://git.contoso.example/aino', label: 'Avaa Giteassa'}},
  {id: 'mac', acc: 'mac', kind: 'machine', name: 'aino-mbp', place: 'MacBook Pro · macOS 15', can: () => 'change',
    ability: () => 'Kaikki, mitä käyttäjä aino saa koneella, kysymättä lupaa jokaiseen komentoon. Pääsy päättyy 4.12.2026.',
    limits: () => ['Palvelimen ylläpitäjä pääsee samaa reittiä koneellesi.'],
    hidden: [{id: 'h-mac', what: 'Työpöytä, Dokumentit ja Mail', why: 'macOS suojaa ne, koska agentille ei annettu täyttä levyn käyttöoikeutta.'}]},
];
const srcOf = (id: string) => SRC.find((s) => s.id === id);

/** Integrations with no account yet: each leads to its own connect step. */
type Offer = {id: string; mark: string; tone: 0 | 1 | 2 | 3; name: string; what: string; kinds: Kind[]; to: string};
const OFFERS: Offer[] = [
  {id: 'apple', mark: 'iC', tone: 3, name: 'Apple (iCloud)', what: 'Posti, kalenteri ja yhteystiedot', kinds: ['mail', 'calendar', 'contacts'], to: '/settings/tiedot#apple'},
  {id: 'imap', mark: '@', tone: 3, name: 'Sähköposti (IMAP)', what: 'Muu postilaatikko', kinds: ['mail'], to: '/settings/tiedot#imap'},
  {id: 'gitlab', mark: 'GL', tone: 2, name: 'GitLab', what: 'gitlab.com tai yrityksen oma GitLab', kinds: ['code'], to: '/settings/koodipalvelut#gitlab'},
  {id: 'machine', mark: '+', tone: 0, name: 'Toinen kone', what: 'Oma kone Tailscalen kautta', kinds: ['machine'], to: '/settings/omatkoneet#own-machines'},
];

const KINDS: {id: Kind; label: string; icon: IconName}[] = [
  {id: 'files', label: 'Tiedostot', icon: 'folder'},
  {id: 'mail', label: 'Posti', icon: 'mail'},
  {id: 'calendar', label: 'Kalenteri', icon: 'calendar'},
  {id: 'contacts', label: 'Yhteystiedot', icon: 'contacts'},
  {id: 'code', label: 'Koodi', icon: 'repo'},
  {id: 'machine', label: 'Koneet', icon: 'laptop'},
];
const kindIcon = (k: Kind) => KINDS.find((x) => x.id === k)!.icon;

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

type Msg = {id: string; from: string; to?: string; subject: string; at: string; preview: string; body?: string; agent?: string};
const MAIL: Record<string, {name: string; msgs: Msg[]}[]> = {
  'ms-mail': [
    {name: 'Saapuneet', msgs: [
      {id: 'm1', from: 'Mikko Laine', subject: 'Re: Kassajärjestelmän pilotti vko 47', at: '10.12', preview: 'Myymälät on nyt sovittu: Prisma Kannelmäki, K-Citymarket Iso Omena ja…',
        body: 'Hei Aino,\n\nmyymälät on nyt sovittu: Prisma Kannelmäki, K-Citymarket Iso Omena ja K-Supermarket Kamppi. Pilotti alkaa maanantaina 16.11.\n\nVoitko päivittää viikkoraporttiin aikataulun?\n\nMikko'},
      {id: 'm2', from: 'Keskon IT-tuki', subject: 'Varmenteiden vaihto: aikataulu', at: 'eilen', preview: 'Ehdotamme vaihtoa viikolla 49 yöajossa. Vahvistakaa sopiiko…'},
      {id: 'm3', from: 'Sanna Heikkinen', subject: 'Valion vaatimukset, versio 3', at: '3.11.', preview: 'Liitteenä päivitetty vaatimusdokumentti. Muutokset merkitty keltaisella.'},
      {id: 'm4', from: 'Juha Mäkelä', subject: 'Tarjous: kassajärjestelmän laajennus', at: '2.11.', preview: 'Kävisitkö tarjouksen teknisen osuuden läpi ennen perjantaita?'},
    ]},
    {name: 'Luonnokset', msgs: [
      {id: 'd1', from: 'Aino Virtanen', to: 'Mikko Laine', subject: 'Re: Kassajärjestelmän pilotti vko 47', at: '10.44', preview: 'Kiitos! Päivitin viikkoraportin vko 45: pilotti alkaa 16.11. kolmessa…', agent: 'Agentti kirjoitti 10.44',
        body: 'Kiitos! Päivitin viikkoraportin vko 45: pilotti alkaa 16.11. kolmessa myymälässä. Raportti on Asiakasprojektit-kirjastossa.\n\nAino'},
    ]},
    {name: 'Lähetetyt', msgs: [{id: 's1', from: 'Aino Virtanen', to: 'Keskon IT-tuki', subject: 'Re: Testiympäristön tunnukset', at: '30.10.', preview: 'Tunnukset toimivat, kiitos.'}]},
  ],
  'g-mail': [
    {name: 'Saapuneet', msgs: [
      {id: 'g1', from: 'VR', subject: 'Matkalippusi Helsinki–Tampere 3.11.', at: '1.11.', preview: 'Kiitos ostoksestasi. Lippu on liitteenä.'},
      {id: 'g2', from: 'Uimaseura Delfiini', subject: 'Syyskauden harjoitusvuorot', at: '28.10.', preview: 'Tiistain vuoro siirtyy Itäkeskuksen uimahalliin.'},
      {id: 'g3', from: 'Taloyhtiö As Oy Kuusikko', subject: 'Saunavuorojen varaus', at: '20.10.', preview: 'Uudet saunavuorot voi varata 1.11. alkaen.'},
    ]},
  ],
};
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
const CONTACTS: Record<string, {count: number; rows: {name: string; mail: string; org: string}[]}> = {
  'ms-contacts': {count: 214, rows: [
    {name: 'Mikko Laine', mail: 'mikko.laine@contoso.example', org: 'Contoso'},
    {name: 'Sanna Heikkinen', mail: 'sanna.heikkinen@contoso.example', org: 'Contoso'},
    {name: 'Juha Mäkelä', mail: 'juha.makela@contoso.example', org: 'Contoso'},
    {name: 'Keskon IT-tuki', mail: 'it-tuki@kesko.example', org: 'Kesko'},
    {name: 'Petri Nieminen', mail: 'petri.nieminen@valio.example', org: 'Valio'},
  ]},
};
type Repo = {name: string; push: boolean; desc: string; at: string; workspace?: string};
const REPOS: Record<string, Repo[]> = {
  'gh-repos': [
    {name: 'contoso/kassa-api', push: true, desc: 'Kassapäätteiden rajapinta Keskon kassajärjestelmään', at: 'tänään', workspace: 'kassa-api'},
    {name: 'contoso/raportointi', push: true, desc: 'Valion raportoinnin ETL ja kojelauta', at: '3.11.'},
    {name: 'contoso/verkkosivut', push: false, desc: 'contoso.example', at: '28.10.'},
    {name: 'aino-virtanen/muistiinpanot', push: true, desc: 'Omat muistiinpanot', at: '1.11.'},
  ],
  'gt-repos': [
    {name: 'contoso/infra', push: true, desc: 'Palvelimien asetukset', at: '4.11.', workspace: 'infra'},
    {name: 'contoso/asennusskriptit', push: true, desc: 'Myymälöiden kassapäätteiden asennus', at: '2.11.'},
  ],
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
      peers: [{name: 'aino-mbp', dns_name: 'aino-mbp.tail3fa2.ts.net', os: 'macOS', address: '100.101.7.22', online: true, last_seen: '2026-11-06T08:40:00Z', ssh: 'possible'}],
      machines: [{name: 'aino-mbp', user: 'aino', address: '100.101.7.22', expires: '2026-12-04', expired: false, in_tailnet: true, online: true, last_seen: '2026-11-06T08:40:00Z', os: 'macOS', host_key: 'SHA256:3fa2c1b77a03e19f208d1e20b4c7a1aBcDeFgHiJkLmNoP', connection_open: false}],
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

/** The account's level as the settings card shows it: production's pill. */
function Pill({acc}: {acc: Acc}) {
  const p = acc.pill();
  return <span className={`ig-lv ${p.wide ? 'full' : 'narrow'}`} data-testid={`pill-${acc.id}`}><Icon className="ig-lv-icon" name={p.wide ? 'key' : 'lock'} />{p.text}</span>;
}
const CanMark = ({src}: {src: Src}) => (
  <Icon name={src.can() === 'change' ? 'pencil' : 'eye'} className="rv-can" aria-label={src.can() === 'change' ? 'Voi muuttaa' : 'Lukee'} />
);

/** What the agent may do with this source, its limits, and the two ways onward. */
function SourceHead({src, onSettings}: {src: Src; onSettings: (to: string) => void}) {
  useStore();
  const acc = accOf(src.acc);
  const change = src.can() === 'change';
  const limits = src.limits?.() ?? [];
  return (
    <header className="rv-head" data-testid="source-head">
      <div className="rv-head-title">
        <LetterMark mark={acc.mark} tone={acc.tone} />
        <div className="rv-text">
          <h2>{src.name}</h2>
          <span className="rv-meta">{acc.name} · {acc.who}{src.place ? ` · ${src.place}` : ''}</span>
        </div>
      </div>
      <div className={`rv-ability${change ? '' : ' read'}`} data-testid="ability" data-can={src.can()}>
        <Icon name={change ? 'pencil' : 'lock'} />
        <div>
          <p><strong>{acc.pill().text}.</strong> {src.ability()}</p>
          {limits.length ? (
            <p className="rv-limits" data-testid="limits"><Icon name="warning" /><span><strong>Ei voi estää:</strong> {limits.join(' ')}</span></p>
          ) : null}
        </div>
      </div>
      <div className="rv-actions">
        <ControlButton data-testid="open-settings" size="row" variant="secondary" onPress={() => onSettings(acc.settings)}><Icon name="gear" />{acc.id === 'mac' ? 'Koneen asetukset' : `${acc.name}-asetukset`}</ControlButton>
        {src.web ? <ExternalLink className="rv-ext" href={src.web.href} target="_blank" rel="noreferrer"><Icon name="external" />{src.web.label}</ExternalLink> : null}
      </div>
    </header>
  );
}

function HiddenList({items, onSettings}: {items: Hidden[]; onSettings: (to: string) => void}) {
  if (!items.length) return null;
  return (
    <section className="rv-hidden" data-testid="hidden-list">
      <h3 className="rv-h3"><Icon name="eyeOff" />Agentti ei näe</h3>
      <ul>
        {items.map((h) => (
          <li key={h.id} data-testid={h.id}>
            <strong>{h.what}</strong><span className="rv-meta">{h.why}</span>
            {h.action ? <ControlButton size="row" variant="quiet" onPress={() => onSettings(h.action!.to)}>{h.action.label}</ControlButton> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Crumbs({root, path, item, onGo}: {root: string; path: string[]; item?: string; onGo: (path: string[]) => void}) {
  const parts = [root, ...path];
  return (
    <nav className="rv-crumbs" aria-label="Sijainti" data-testid="crumbs">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i ? <span aria-hidden="true">›</span> : null}
          {i === parts.length - 1 && !item ? <span aria-current="page">{p}</span> : <button type="button" className="rv-link" onClick={() => onGo(path.slice(0, i))}>{p}</button>}
        </React.Fragment>
      ))}
      {item ? <><span aria-hidden="true">›</span><span aria-current="page">{item}</span></> : null}
    </nav>
  );
}

/** Files: the folder's rows, or one file with its content. */
function FilesView({src}: {src: Src}) {
  const s = useStore();
  const go = (path: string[], item = '') => { store.loc = {path, item}; notify(); };
  const files = listing(src.id, s.loc.path);
  const open = s.loc.item ? files.find((f) => f.n === s.loc.item) : undefined;
  return (
    <div className="rv-content" data-testid="files">
      <Crumbs root={src.place?.replace(/^SharePoint · /, `${src.name} › `).replace(/^Kansio /, `${src.name} › `) ?? src.name} path={s.loc.path} item={open?.n} onGo={(p) => go(p)} />
      {open ? (
        <article className="rv-paper-wrap" data-testid="preview" aria-label={open.n}>
          <p className="rv-meta">Muokattu {open.at} · {open.agent && msFull() ? 'agentti sinun tunnuksillasi' : open.by} · {open.size}</p>
          {open.agent ? <span className="rv-badge" data-testid="agent-badge"><Icon name="agent" />{open.agent}</span> : null}
          {src.can() === 'read' ? <p className="rv-meta rv-lock-line" data-testid="cannot-change"><Icon name="lock" />Agentti ei voi muuttaa tätä tiedostoa.</p> : null}
          <div className="rv-paper">{open.body ? <Markdown text={open.body} /> : <p className="rv-meta">Tästä tiedostosta ei ole esikatselua. Agentti lukee sen silti.</p>}</div>
        </article>
      ) : (
        <ul className="rv-rows">
          {files.map((f) => (
            <li key={f.n}>
              <button type="button" className="rv-row" data-testid={`file-${f.n}`} onClick={() => (f.kids ? go([...s.loc.path, f.n]) : go(s.loc.path, f.n))}>
                <Icon name={fileIcon(f)} className="rv-row-icon" />
                <span className="rv-text"><span className="rv-name">{f.n}</span><span className="rv-meta">{f.kids ? `Muokattu ${f.at}` : `${f.at} · ${f.by} · ${f.size}`}</span></span>
                {f.agent ? <span className="rv-badge" data-testid="agent-badge"><Icon name="agent" />{f.agent}</span> : null}
              </button>
            </li>
          ))}
          {!files.length ? <li className="rv-empty">Kansio on tyhjä.</li> : null}
        </ul>
      )}
    </div>
  );
}

function MailView({src}: {src: Src}) {
  const s = useStore();
  const folders = (MAIL[src.id] ?? []).filter((f) => f.name !== 'Luonnokset' || store.level !== 'read' || src.acc !== 'ms');
  const folder = folders.find((f) => f.name === s.folder) ?? folders[0];
  const drafts = (m: Msg) => !(m.agent && store.level === 'read');
  const open = folder?.msgs.find((m) => m.id === s.loc.item);
  const go = (item = '') => { store.loc = {path: [], item}; notify(); };
  return (
    <div className="rv-content" data-testid="mail">
      <div className="rv-folders" role="tablist" aria-label="Kansiot">
        {folders.map((f) => (
          <button key={f.name} type="button" role="tab" className="rv-chip" aria-selected={f === folder} data-testid={`folder-${f.name}`}
            onClick={() => { store.folder = f.name; go(); }}>{f.name}<span className="rv-meta">{f.msgs.filter(drafts).length}</span></button>
        ))}
      </div>
      {open ? (
        <article className="rv-paper-wrap" data-testid="message" aria-label={open.subject}>
          <button type="button" className="rv-link" data-testid="message-back" onClick={() => go()}>‹ {folder.name}</button>
          <h3 className="rv-msg-subject">{open.subject}</h3>
          <p className="rv-meta">{open.to ? `Vastaanottaja ${open.to}` : `Lähettäjä ${open.from}`} · {open.at}</p>
          {open.agent ? <span className="rv-badge" data-testid="agent-badge"><Icon name="agent" />{open.agent} · ei lähetetty</span> : null}
          <div className="rv-paper"><Markdown text={open.body ?? open.preview} /></div>
        </article>
      ) : (
        <ul className="rv-rows">
          {folder?.msgs.filter(drafts).map((m) => (
            <li key={m.id}>
              <button type="button" className="rv-row" data-testid={`msg-${m.id}`} onClick={() => go(m.id)}>
                <Icon name="mail" className="rv-row-icon" />
                <span className="rv-text"><span className="rv-name">{m.subject}</span><span className="rv-meta">{m.to ? `→ ${m.to}` : m.from} · {m.at} · {m.preview}</span></span>
                {m.agent ? <span className="rv-badge" data-testid="agent-badge"><Icon name="agent" />{m.agent}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CalendarView({src}: {src: Src}) {
  const days = [...new Set((CAL[src.id] ?? []).map((e) => e.day))];
  return (
    <div className="rv-content" data-testid="calendar">
      <p className="rv-meta">Tämä ja ensi viikko</p>
      {days.map((d) => (
        <section key={d} className="rv-day">
          <h3 className="rv-h3">{d}</h3>
          <ul className="rv-rows">
            {CAL[src.id].filter((e) => e.day === d).map((e) => (
              <li key={e.title} className="rv-row static">
                <span className="rv-time">{e.time}</span>
                <span className="rv-text"><span className="rv-name">{e.title}</span><span className="rv-meta">{[e.where, e.who].filter(Boolean).join(' · ')}</span></span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ContactsView({src}: {src: Src}) {
  const c = CONTACTS[src.id] ?? {count: 0, rows: []};
  return (
    <div className="rv-content" data-testid="contacts">
      <p className="rv-meta">{c.count} yhteystietoa</p>
      <ul className="rv-rows">
        {c.rows.map((r) => (
          <li key={r.mail} className="rv-row static"><Icon name="user" className="rv-row-icon" />
            <span className="rv-text"><span className="rv-name">{r.name}</span><span className="rv-meta">{r.mail} · {r.org}</span></span></li>
        ))}
      </ul>
    </div>
  );
}

function CodeView({src}: {src: Src}) {
  return (
    <div className="rv-content" data-testid="code">
      <ul className="rv-rows">
        {(REPOS[src.id] ?? []).map((r) => (
          <li key={r.name} className="rv-row static" data-testid={`repo-${r.name}`}>
            <Icon name="repo" className="rv-row-icon" />
            <span className="rv-text"><span className="rv-name rv-mono">{r.name}</span><span className="rv-meta">{r.desc} · päivitetty {r.at}{r.workspace ? ` · työtila ${r.workspace}` : ''}</span></span>
            <span className={`rv-access${r.push ? '' : ' read'}`}>{r.push ? 'Luku ja push' : 'Vain luku'}</span>
          </li>
        ))}
      </ul>
      <p className="rv-meta">Repo, jota ei ole tuotu työtilaksi, on agentin käytössä komennoilla. Tuo se työtilaksi, kun haluat seurata työtä täällä.</p>
    </div>
  );
}

function MachineView() {
  return (
    <div className="rv-content" data-testid="machine">
      <dl className="rv-facts">
        <dt>Tila</dt><dd><StatusMark label="Yhdistetty" kind="success" tone="success" /></dd>
        <dt>Käyttäjä</dt><dd><code>aino</code></dd>
        <dt>Verkko</dt><dd>Tailscale, nähty 10.40</dd>
        <dt>Pääsy päättyy</dt><dd>4.12.2026</dd>
      </dl>
      <p className="rv-meta">Habitat ei selaa koneen tiedostoja. Agentti käyttää konetta etäyhteydellä, kun pyydät sitä keskustelussa.</p>
    </div>
  );
}

/** One source: the head, its content, and what the agent does not see there. */
function SourceView({src, onSettings, onBack}: {src: Src; onSettings: (to: string) => void; onBack?: () => void}) {
  useStore();
  return (
    <article className="rv-detail" data-testid="source-view" data-source={src.id}>
      {onBack ? <ControlButton data-testid="detail-back" size="row" variant="quiet" onPress={onBack}><Icon name="back" />Agentin käytössä</ControlButton> : null}
      <SourceHead src={src} onSettings={onSettings} />
      {src.kind === 'files' ? <FilesView src={src} /> : src.kind === 'mail' ? <MailView src={src} /> : src.kind === 'calendar' ? <CalendarView src={src} />
        : src.kind === 'contacts' ? <ContactsView src={src} /> : src.kind === 'code' ? <CodeView src={src} /> : <MachineView />}
      <HiddenList items={src.hidden ?? []} onSettings={onSettings} />
    </article>
  );
}

// ---------- The three lists ----------

type ListProps = {sel: string; onPick: (id: string) => void; onSettings: (to: string) => void};

function SrcRow({src, sel, onPick, show}: {src: Src; sel: string; onPick: (id: string) => void; show: 'account' | 'kind' | 'ability'}) {
  useStore();
  const acc = accOf(src.acc);
  return (
    <li>
      <button type="button" className="rv-src" data-testid={`src-${src.id}`} aria-current={sel === src.id ? 'true' : undefined} onClick={() => onPick(src.id)}>
        {show === 'account' ? <Icon name={kindIcon(src.kind)} className="rv-row-icon" /> : <LetterMark mark={acc.mark} tone={acc.tone} small />}
        <span className="rv-text">
          <span className="rv-name">{src.name}</span>
          {show === 'account' ? (src.place ? <span className="rv-meta">{src.place}</span> : null)
            : show === 'kind' ? <span className="rv-meta">{acc.name}{src.place ? ` · ${src.place}` : ''}</span>
              : <span className="rv-meta">{acc.name} · {src.ability().split('. ')[0].replace(/\.$/, '')}</span>}
        </span>
        {show === 'kind' ? <Pill acc={acc} /> : show === 'account' ? <CanMark src={src} /> : null}
      </button>
    </li>
  );
}
function OfferRow({o, onSettings}: {o: Offer; onSettings: (to: string) => void}) {
  return (
    <li className="rv-offer" data-testid={`offer-${o.id}`}>
      <LetterMark mark={o.mark} tone={o.tone} small />
      <span className="rv-text"><span className="rv-name">{o.name}</span><span className="rv-meta">{o.what}</span></span>
      <ControlButton data-testid={`connect-${o.id}`} size="row" variant="quiet" onPress={() => onSettings(o.to)}>{o.id === 'machine' ? 'Lisää' : 'Yhdistä'}</ControlButton>
    </li>
  );
}

/** A: accounts as Settings lists them, each with its services. */
function ByAccount({sel, onPick, onSettings}: ListProps) {
  useStore();
  return (
    <div className="rv-list" data-testid="list-accounts">
      {ACCOUNTS.map((a) => (
        <section key={a.id} className="rv-acc" data-testid={`acc-${a.id}`}>
          <div className="rv-acc-head">
            <LetterMark mark={a.mark} tone={a.tone} />
            <span className="rv-text"><strong>{a.name}</strong><span className="rv-meta">{a.who}</span></span>
            <Pill acc={a} />
          </div>
          <ul>{SRC.filter((s) => s.acc === a.id).map((s) => <SrcRow key={s.id} src={s} sel={sel} onPick={onPick} show="account" />)}</ul>
        </section>
      ))}
      <section className="rv-acc rv-offers" data-testid="offers">
        <h3 className="rv-h3"><Icon name="plug" />Ei yhdistetty</h3>
        <ul>{OFFERS.map((o) => <OfferRow key={o.id} o={o} onSettings={onSettings} />)}</ul>
      </section>
    </div>
  );
}

/** B: kinds of thing, with every account's sources under each. */
function ByKind({sel, onPick, onSettings}: ListProps) {
  useStore();
  return (
    <div className="rv-list" data-testid="list-kinds">
      {KINDS.map((k) => (
        <section key={k.id} className="rv-kind" data-testid={`kind-${k.id}`}>
          <h3 className="rv-h3 rv-kind-head"><Icon name={k.icon} />{k.label}</h3>
          <ul>
            {SRC.filter((s) => s.kind === k.id).map((s) => <SrcRow key={s.id} src={s} sel={sel} onPick={onPick} show="kind" />)}
            {OFFERS.filter((o) => o.kinds.includes(k.id)).map((o) => <OfferRow key={o.id} o={o} onSettings={onSettings} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** C: what the agent may do, and what it does not see at all. */
function ByAbility({sel, onPick, onSettings}: ListProps) {
  useStore();
  const hidden = SRC.flatMap((s) => (s.hidden ?? []).map((h) => ({h, s})));
  const band = (can: Can, title: string, desc: string, icon: IconName) => (
    <section className="rv-band" data-testid={`band-${can}`}>
      <h3 className="rv-h3 rv-band-head"><Icon name={icon} />{title}<span className="ah-rail-count">{SRC.filter((s) => s.can() === can).length}</span></h3>
      <p className="rv-meta rv-band-desc">{desc}</p>
      <ul>{SRC.filter((s) => s.can() === can).map((s) => <SrcRow key={s.id} src={s} sel={sel} onPick={onPick} show="ability" />)}</ul>
    </section>
  );
  return (
    <div className="rv-list" data-testid="list-abilities">
      {band('change', 'Voi muuttaa', 'Agentti lukee ja muuttaa. Muutos tehdään sinun nimissäsi.', 'pencil')}
      {band('read', 'Lukee, ei muuta', 'Palvelu ei anna agentin muuttaa mitään.', 'eye')}
      <section className="rv-band" data-testid="band-hidden">
        <h3 className="rv-h3 rv-band-head"><Icon name="eyeOff" />Ei näe<span className="ah-rail-count">{hidden.length + OFFERS.length}</span></h3>
        <p className="rv-meta rv-band-desc">Rajattu pois tai ei yhdistetty.</p>
        <ul>
          {hidden.map(({h, s}) => (
            <li key={h.id}>
              <button type="button" className="rv-src" data-testid={`hidden-${h.id}`} onClick={() => onPick(s.id)}>
                <LetterMark mark={accOf(s.acc).mark} tone={accOf(s.acc).tone} small />
                <span className="rv-text"><span className="rv-name">{h.what}</span><span className="rv-meta">{h.why}</span></span>
              </button>
            </li>
          ))}
          {OFFERS.map((o) => <OfferRow key={o.id} o={o} onSettings={onSettings} />)}
        </ul>
      </section>
    </div>
  );
}

// ---------- The page ----------

function ResourcesPage({direction}: {direction: number}) {
  const s = useStore();
  const navigate = useNavigate();
  const narrow = useNarrow();
  const src = srcOf(s.sel);
  const pick = (id: string) => { store.sel = id; store.loc = {path: [], item: ''}; store.folder = ''; notify(); };
  const settings = (to: string) => navigate(to);
  const List = [ByAccount, ByKind, ByAbility][direction];
  const connected = ACCOUNTS.length, changing = SRC.filter((x) => x.can() === 'change').length;
  return (
    <div className="ah-state rv-page" data-testid="resources-page">
      {narrow && src ? null : (
        <header className="rv-page-head">
          <div className="rv-text">
            <h1>Agentin käytössä</h1>
            <span className="rv-meta" data-testid="summary">{connected} yhteyttä, {SRC.length} lähdettä. Agentti voi muuttaa {changing} lähdettä, ja kaikki tehdään sinun tunnuksillasi.</span>
          </div>
          <ControlButton data-testid="connect-more" size="row" variant="secondary" onPress={() => navigate('/settings/tiedot')}><Icon name="plus" />Yhdistä palvelu</ControlButton>
        </header>
      )}
      {narrow ? (
        src ? <SourceView src={src} onSettings={settings} onBack={() => { store.sel = ''; notify(); }} /> : <List sel={s.sel} onPick={pick} onSettings={settings} />
      ) : (
        <div className="rv-cols">
          <List sel={s.sel} onPick={pick} onSettings={settings} />
          {src ? <SourceView src={src} onSettings={settings} /> : <p className="rv-empty">Valitse lähde.</p>}
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
          <span className="rv-meta">Tilit, tiedostot, koodi ja koneet</span>
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
  // The phone starts from the list, so every account is on the first screen.
  Object.assign(store, {level: store.level, sel: window.matchMedia('(max-width: 760px)').matches ? '' : 'ms-proj', loc: {path: ['Kesko – kassajärjestelmä'], item: ''}, folder: '', toast: ''});
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
        <strong>Agentin käytössä</strong>
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
