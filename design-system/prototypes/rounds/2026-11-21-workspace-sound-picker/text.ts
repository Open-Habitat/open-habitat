// The round's own words, Finnish and English. The ten sounds' names and
// one-line descriptions come from round 6 (../2026-11-21-attention-sound-icons/text.ts),
// so both rounds say the same thing about each sound.
import {type Lang, type Length, type SoundId, TEXT as SOUND_TEXT} from '../2026-11-21-attention-sound-icons/text';

export type {Lang, Length, SoundId};
export type View = 'workspace' | 'settings';
export type Scenario = 'oma' | 'oletus' | 'valittu' | 'pitkat' | 'pois';
export const SCENARIO_IDS: Scenario[] = ['oma', 'oletus', 'valittu', 'pitkat', 'pois'];

const fi = {
  // Review chrome
  title: 'Työtilan ääni · valitsin',
  scenario: 'Tilanne',
  view: 'Näkymä', views: {workspace: 'Työtila', settings: 'Asetukset › Äänet'} as Record<View, string>,
  theme: 'Teema', light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti',
  language: 'Kieli',
  reset: 'Alusta',
  simulate: 'Agentti valmis:',
  simRepo: (repo: string) => `työtilassa ${repo}`,
  scenarios: {
    oma: '1 kotisivu: oma ääni Pisara, valitsin auki',
    oletus: '2 aurinkokello: sama kuin oletus, valitsin auki',
    valittu: '3 Valinnan jälkeen: valitsin kiinni',
    pitkat: '4 Pitkät äänet valittuna',
    pois: '5 Äänet pois',
  } as Record<Scenario, string>,
  roundLine: 'Missä työtilan oma ääni valitaan ja miten valinta näkyy sen jälkeen. Valitsin on sama kaikissa: Sama kuin oletus ensin, sitten kymmenen B Väreilyn muoto -merkkiä. Paina merkkiä: se soi ja valitaan, ja valitsin jää auki kokeiltavaksi.',
  lines: [
    'A Otsikossa: työtilan otsikon toimintoriviin äänipainike, jossa on valitun äänen merkki; oma ääni näkyy myös sivupalkin rivillä. Sama valitsin Asetuksissa.',
    'B Nimen alla: työtilan nimen alla merkki ja äänen nimi, ”Pisara” tai ”Kalimba · oletus”; sitä painamalla valitsin aukeaa. Sama valitsin Asetuksissa.',
    'C Asetuksissa: Asetukset › Äänet listaa työtilat, ja rivin painike avaa valitsimen. Työtilassa itsessään ei ole ääntä.',
  ],
  recommend: 'Suositus: B Nimen alla ja sama valitsin Asetuksissa. Työtilan ääni näkyy sanoin ja merkkinä siellä, missä työtilaa katsotaan, eikä sivupalkki saa uutta merkkiä.',
  played: (name: string, len: string) => `Soi: ${name} (${len})`,
  simPlayed: (repo: string, name: string, len: string) => `Agentti valmis työtilassa ${repo} → soi ${name} (${len})`,
  simSilent: (repo: string) => `Agentti valmis työtilassa ${repo} → ei ääntä: äänet ovat pois`,

  // The picker
  pickerTitle: 'Työtilan ääni',
  close: 'Sulje',
  pickerHelp: 'Paina ääntä kuullaksesi sen. Painettu ääni valitaan heti, ja voit kokeilla muita ennen kuin suljet.',
  sameAsDefault: 'Sama kuin oletus',
  sameDetail: (name: string) => `${name} · vaihtuu oletuksen mukana`,
  sounds: 'Äänet',
  chosen: 'Valittu',
  playing: 'Soi',
  tileLabel: (name: string, desc: string, secs: string) => `${name}. ${desc} ${secs}.`,
  secs: (s: number) => `${s.toFixed(1).replace('.', ',')} s`,
  lengthNote: {short: 'Äänet soivat lyhyinä, kuten agentin valmistuessa.', long: 'Äänet soivat pitkinä, kuten agentin valmistuessa.'} as Record<Length, string>,
  lengthWhere: 'Pituus valitaan kaikille äänille Asetuksissa.',
  offNote: 'Äänet ovat pois kaikilta laitteiltasi. Valinta tallentuu, ja kuuntelu toimii silti.',
  done: 'Valmis',
  openSettings: 'Äänet-asetukset',

  // Entry points
  headButton: (repo: string, name: string, own: boolean) => `Työtilan ${repo} ääni: ${name}${own ? '' : ' (oletus)'}`,
  chipDefault: 'oletus',
  chipLabel: (repo: string, name: string, own: boolean) => `Ääni: ${name}${own ? '' : ', sama kuin oletus'}. Vaihda työtilan ${repo} ääni`,
  railOwn: (name: string) => `oma ääni ${name}`,

  // Workspace page (synthetic)
  conversations: 'Keskustelut',
  convs: ['Etusivun kuvat pienemmiksi', 'Yhteystietolomakkeen tarkistus', 'Saavutettavuuskorjaukset'],
  convMeta: ['valmis', 'odottaa sinua', 'eilen'],
  copyPath: 'Kopioi polku', rename: 'Nimeä uudelleen', archive: 'Arkistoi', newConv: 'Uusi keskustelu',

  // Settings section
  section: 'Äänet',
  sectionKw: ['ääni', 'äänimerkki', 'työtila', 'työtilan ääni', 'oletus'],
  intro: 'Habitat soittaa lyhyen äänen, kun agentti on valmis tai haluaa huomiosi.',
  defaultSound: 'Oletusääni', defaultDesc: 'Valitaan laatoista (kierros 6). Työtilan oma ääni korvaa tämän.',
  length: 'Äänten pituus', lengthDesc: 'Yksi valinta kaikille äänille, myös työtilojen.',
  lengthNames: {short: 'Lyhyet', long: 'Pitkät'} as Record<Length, string>,
  lengthOne: {short: 'lyhyt', long: 'pitkä'} as Record<Length, string>,
  on: 'Äänet', off: 'Pois', onLabel: 'Päällä',
  repos: 'Työtilojen äänet',
  reposDesc: 'Eri ääni eri työtilalle, jotta kuulet, mikä valmistui. Työtila, jolle et valitse ääntä, soittaa oletusäänen.',
  reposDescWs: 'Työtilan äänen voi vaihtaa myös työtilan otsikosta.',
  repoButton: (repo: string, name: string) => `Työtilan ${repo} ääni: ${name}. Vaihda`,
  repoDefaultValue: (name: string) => `Sama kuin oletus (${name})`,
};

const en: typeof fi = {
  title: 'Workspace sound · picker',
  scenario: 'Situation',
  view: 'View', views: {workspace: 'Workspace', settings: 'Settings › Sounds'},
  theme: 'Theme', light: 'Day', dark: 'Night', contrast: 'High contrast',
  language: 'Language',
  reset: 'Reset',
  simulate: 'Agent finished:',
  simRepo: (repo: string) => `in workspace ${repo}`,
  scenarios: {
    oma: '1 kotisivu: own sound Drop, picker open',
    oletus: '2 aurinkokello: same as default, picker open',
    valittu: '3 After choosing: picker closed',
    pitkat: '4 Long sounds chosen',
    pois: '5 Sounds off',
  },
  roundLine: 'Where a workspace\'s own sound is chosen and how the choice shows afterwards. The picker is the same in all three: Same as default first, then the ten B Ripple shape emblems. Press an emblem: it plays and is chosen, and the picker stays open for trying others.',
  lines: [
    'A In the header: a sound button with the chosen sound\'s emblem in the workspace header\'s action row; an own sound also shows on the sidebar row. Same picker in Settings.',
    'B Under the name: under the workspace name an emblem and the sound\'s name, "Drop" or "Kalimba · default"; pressing it opens the picker. Same picker in Settings.',
    'C In Settings: Settings › Sounds lists the workspaces, and a row\'s button opens the picker. The workspace itself shows no sound.',
  ],
  recommend: 'Recommendation: B Under the name, with the same picker in Settings. The workspace\'s sound shows in words and as an emblem where the workspace is looked at, and the sidebar gets no new mark.',
  played: (name: string, len: string) => `Playing: ${name} (${len})`,
  simPlayed: (repo: string, name: string, len: string) => `Agent finished in workspace ${repo} → plays ${name} (${len})`,
  simSilent: (repo: string) => `Agent finished in workspace ${repo} → no sound: sounds are off`,

  pickerTitle: 'Workspace sound',
  close: 'Close',
  pickerHelp: 'Press a sound to hear it. The sound you press is chosen at once, and you can try others before closing.',
  sameAsDefault: 'Same as default',
  sameDetail: (name: string) => `${name} · follows the default`,
  sounds: 'Sounds',
  chosen: 'Chosen',
  playing: 'Playing',
  tileLabel: (name: string, desc: string, secs: string) => `${name}. ${desc} ${secs}.`,
  secs: (s: number) => `${s.toFixed(1)} s`,
  lengthNote: {short: 'Sounds play short, as when an agent finishes.', long: 'Sounds play long, as when an agent finishes.'},
  lengthWhere: 'The length for all sounds is chosen in Settings.',
  offNote: 'Sounds are off on all your devices. The choice is saved, and listening still works.',
  done: 'Done',
  openSettings: 'Sound settings',

  headButton: (repo: string, name: string, own: boolean) => `Sound of workspace ${repo}: ${name}${own ? '' : ' (default)'}`,
  chipDefault: 'default',
  chipLabel: (repo: string, name: string, own: boolean) => `Sound: ${name}${own ? '' : ', same as default'}. Change the sound of workspace ${repo}`,
  railOwn: (name: string) => `own sound ${name}`,

  conversations: 'Conversations',
  convs: ['Smaller front page images', 'Contact form validation', 'Accessibility fixes'],
  convMeta: ['finished', 'waiting for you', 'yesterday'],
  copyPath: 'Copy path', rename: 'Rename', archive: 'Archive', newConv: 'New conversation',

  section: 'Sounds',
  sectionKw: ['sound', 'chime', 'workspace', 'workspace sound', 'default'],
  intro: 'Habitat plays a short sound when the agent finishes or wants your attention.',
  defaultSound: 'Default sound', defaultDesc: 'Chosen from the tiles (round 6). A workspace\'s own sound replaces it.',
  length: 'Sound length', lengthDesc: 'One choice for all sounds, workspaces\' too.',
  lengthNames: {short: 'Short', long: 'Long'},
  lengthOne: {short: 'short', long: 'long'},
  on: 'Sounds', off: 'Off', onLabel: 'On',
  repos: 'Workspace sounds',
  reposDesc: 'A different sound for each workspace, so you hear which one finished. A workspace without its own sound plays the default.',
  reposDescWs: 'A workspace\'s sound can also be changed from its header.',
  repoButton: (repo: string, name: string) => `Sound of workspace ${repo}: ${name}. Change`,
  repoDefaultValue: (name: string) => `Same as default (${name})`,
};

export const TEXT: Record<Lang, typeof fi> = {fi, en};
export const soundText = (lang: Lang, id: SoundId) => SOUND_TEXT[lang].sounds[id];
