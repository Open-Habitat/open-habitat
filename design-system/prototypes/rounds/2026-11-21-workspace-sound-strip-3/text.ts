// The round's own words, Finnish and English. The ten sounds' names and
// one-line descriptions come from emblem round 7
// (../2026-11-21-attention-sound-emblems-7/text.ts), so the rounds agree.
import {type Lang, type Length, SOUND_IDS, type SoundId, TEXT as SOUND_TEXT} from '../2026-11-21-attention-sound-emblems-7/text';

export type {Lang, Length, SoundId};
export {SOUND_IDS};
export type View = 'workspace' | 'settings';
export type Scenario = 'oma' | 'oletus' | 'auki' | 'pitkat' | 'pois';
export const SCENARIO_IDS: Scenario[] = ['oma', 'oletus', 'auki', 'pitkat', 'pois'];

const fi = {
  // Review chrome
  title: 'Työtilan ääni · kierros 3',
  scenario: 'Tilanne',
  view: 'Näkymä', views: {workspace: 'Työtila', settings: 'Asetukset › Äänet'} as Record<View, string>,
  theme: 'Teema', light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti',
  language: 'Kieli',
  reset: 'Alusta',
  simulate: 'Agentti valmis:',
  simRepo: (repo: string) => `työtilassa ${repo}`,
  scenarios: {
    oma: '1 kotisivu: oma ääni Pisara',
    oletus: '2 aurinkokello: oletus (Kalimba)',
    auki: '3 kotisivu: valitsin auki',
    pitkat: '4 Pitkät äänet, valitsin auki',
    pois: '5 Äänet pois, valitsin auki',
  } as Record<Scenario, string>,
  roundLine: 'Työtilan otsikon alla on asetusnauha: Kuvake, Nimi ja Ääni. Kaikki kolme painiketta ovat samankokoisia, eikä mikään liiku, kun arvo vaihtuu. Sivupalkin riveillä ei ole nuottia. Valitsimessa kortin painallus valitsee ja soittaa, ja kortin ▶ kuuntelee valitsematta.',
  lines: [
    'A Ruudut: kolme samankokoista neliötä; ylhäällä sana, keskellä iso kuva, alla arvo. Puhelimessa kolme rinnakkain.',
    'B Leveät painikkeet: kolme yhtä leveää matalaa painiketta, kuva vasemmalla, sana ja arvo oikealla. Puhelimessa allekkain.',
    'C Yhtenäinen nauha: yksi reunustettu nauha, joka on jaettu kolmeen yhtä leveään osaan. Puhelimessa nauha vierii sivulle.',
  ],
  recommend: 'Suositus: A Ruudut. Painikkeet ovat aidosti samankokoisia, merkki näkyy suurimpana, ja puhelimessakin kaikki kolme näkyvät rinnakkain ilman vieritystä.',
  played: (name: string, len: string) => `Soi: ${name} (${len})`,
  previewed: (name: string, len: string) => `Kuunneltu: ${name} (${len}), valinta ei muuttunut`,
  simPlayed: (repo: string, name: string, len: string) => `Agentti valmis työtilassa ${repo} → soi ${name} (${len})`,
  simSilent: (repo: string) => `Agentti valmis työtilassa ${repo} → ei ääntä: äänet ovat pois`,
  notHere: 'Ei tässä kierroksessa',

  // The picker
  pickerTitle: 'Työtilan ääni',
  close: 'Sulje',
  pickerHelp: 'Paina ääntä valitaksesi sen. ▶ soittaa äänen valitsematta.',
  sameAsDefault: 'Sama kuin oletus',
  sameDetail: (name: string) => `${name} · vaihtuu oletuksen mukana`,
  chosen: 'Valittu',
  playing: 'Soi',
  tileLabel: (name: string, desc: string, secs: string) => `${name}. ${desc} ${secs}.`,
  preview: (name: string) => `Kuuntele ${name}`,
  secs: (s: number) => `${s.toFixed(1).replace('.', ',')} s`,
  lengthNote: {short: 'Äänet soivat lyhyinä, kuten agentin valmistuessa.', long: 'Äänet soivat pitkinä, kuten agentin valmistuessa.'} as Record<Length, string>,
  lengthWhere: 'Pituus valitaan kaikille äänille Asetuksissa.',
  offNote: 'Äänet ovat pois kaikilta laitteiltasi. Valinta tallentuu, ja kuuntelu toimii silti.',
  done: 'Valmis',

  // Entry points
  soundWord: 'Ääni',
  defaultWord: 'oletus',
  valueOf: (name: string, own: boolean) => own ? name : `${name} · oletus`,
  entryLabel: (repo: string, name: string, own: boolean) => `Työtilan ${repo} ääni: ${name}${own ? '' : ', sama kuin oletus'}. Vaihda`,
  stripTitle: 'Työtilan asetukset',
  stripIcon: 'Kuvake', stripIconValue: 'Kirjain', stripName: 'Nimi',

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
  repos: 'Työtilojen äänet',
  reposDesc: 'Eri ääni eri työtilalle, jotta kuulet, mikä valmistui. Työtila, jolle et valitse ääntä, soittaa oletusäänen. Äänen voi vaihtaa myös työtilan asetusnauhasta.',
};

const en: typeof fi = {
  title: 'Workspace sound · round 3',
  scenario: 'Situation',
  view: 'View', views: {workspace: 'Workspace', settings: 'Settings › Sounds'},
  theme: 'Theme', light: 'Day', dark: 'Night', contrast: 'High contrast',
  language: 'Language',
  reset: 'Reset',
  simulate: 'Agent finished:',
  simRepo: (repo: string) => `in workspace ${repo}`,
  scenarios: {
    oma: '1 kotisivu: own sound Drop',
    oletus: '2 aurinkokello: default (Kalimba)',
    auki: '3 kotisivu: picker open',
    pitkat: '4 Long sounds, picker open',
    pois: '5 Sounds off, picker open',
  },
  roundLine: 'Under the workspace header is a settings strip: Icon, Name and Sound. All three buttons are the same size, and nothing moves when a value changes. The sidebar rows have no note. In the picker a press on a card chooses and plays, and the card\'s ▶ listens without choosing.',
  lines: [
    'A Tiles: three squares of one size; the word on top, a large picture in the middle, the value below. Three across on a phone.',
    'B Wide buttons: three equally wide low buttons, picture left, word and value right. Stacked on a phone.',
    'C One strip: one bordered strip cut into three equal segments. On a phone the strip scrolls sideways.',
  ],
  recommend: 'Recommendation: A Tiles. The buttons are truly the same size, the emblem shows largest, and on a phone too all three sit side by side without scrolling.',
  played: (name: string, len: string) => `Playing: ${name} (${len})`,
  previewed: (name: string, len: string) => `Listened: ${name} (${len}), choice unchanged`,
  simPlayed: (repo: string, name: string, len: string) => `Agent finished in workspace ${repo} → plays ${name} (${len})`,
  simSilent: (repo: string) => `Agent finished in workspace ${repo} → no sound: sounds are off`,
  notHere: 'Not in this round',

  pickerTitle: 'Workspace sound',
  close: 'Close',
  pickerHelp: 'Press a sound to choose it. ▶ plays a sound without choosing it.',
  sameAsDefault: 'Same as default',
  sameDetail: (name: string) => `${name} · follows the default`,
  chosen: 'Chosen',
  playing: 'Playing',
  tileLabel: (name: string, desc: string, secs: string) => `${name}. ${desc} ${secs}.`,
  preview: (name: string) => `Listen to ${name}`,
  secs: (s: number) => `${s.toFixed(1)} s`,
  lengthNote: {short: 'Sounds play short, as when an agent finishes.', long: 'Sounds play long, as when an agent finishes.'},
  lengthWhere: 'The length for all sounds is chosen in Settings.',
  offNote: 'Sounds are off on all your devices. The choice is saved, and listening still works.',
  done: 'Done',

  soundWord: 'Sound',
  defaultWord: 'default',
  valueOf: (name: string, own: boolean) => own ? name : `${name} · default`,
  entryLabel: (repo: string, name: string, own: boolean) => `Sound of workspace ${repo}: ${name}${own ? '' : ', same as default'}. Change`,
  stripTitle: 'Workspace settings',
  stripIcon: 'Icon', stripIconValue: 'Letter', stripName: 'Name',

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
  repos: 'Workspace sounds',
  reposDesc: 'A different sound for each workspace, so you hear which one finished. A workspace without its own sound plays the default. A workspace\'s sound can also be changed from its settings strip.',
};

export const TEXT: Record<Lang, typeof fi> = {fi, en};
export const soundText = (lang: Lang, id: SoundId) => SOUND_TEXT[lang].sounds[id];
