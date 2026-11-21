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
  title: 'Työtilan ääni · kierros 2',
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
  roundLine: 'Työtilan ääni näkyy isona työtilan otsikossa ja vaihtuu sieltä. Sivupalkissa nuottipainike näkyy vain rivin päällä. Valitsimessa kortin painallus valitsee, ja kortin ▶ kuuntelee valitsematta. Asetusten rivit eivät enää hyppää valinnan vaihtuessa.',
  lines: [
    'A Valitsin otsikossa: nimen vieressä iso valitsin, jossa on äänen merkki, nuotti ja nimi (”Kalimba · oletus”).',
    'B Kortti nimen alla: nimen alla leveä äänikortti, jossa on iso merkki, nimi, Kuuntele ja Vaihda ääni.',
    'C Asetusnauha: otsikon alla rivi isoja asetuspainikkeita (Kuvake, Nimi, Ääni), joista ääni on yksi.',
  ],
  recommend: 'Suositus: A Valitsin otsikossa. Yksi iso, selvästi vaihdettava valitsin nimen vieressä, eikä otsikkoon tule uutta riviä yhden harvoin vaihdettavan asetuksen takia.',
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
  cardLead: 'Soi, kun agentti on valmis tai haluaa huomiosi',
  cardOwn: 'Tämän työtilan oma ääni',
  cardDefault: 'Sama kuin oletusäänesi',
  listen: 'Kuuntele',
  change: 'Vaihda ääni',
  stripTitle: 'Työtilan asetukset',
  stripIcon: 'Kuvake', stripIconValue: 'Kirjain', stripName: 'Nimi',
  railNote: (repo: string, name: string, own: boolean) => `Työtilan ${repo} ääni: ${name}${own ? '' : ' (oletus)'}. Vaihda`,

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
  reposDesc: 'Eri ääni eri työtilalle, jotta kuulet, mikä valmistui. Työtila, jolle et valitse ääntä, soittaa oletusäänen. Äänen voi vaihtaa myös työtilan otsikosta.',
};

const en: typeof fi = {
  title: 'Workspace sound · round 2',
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
  roundLine: 'The workspace\'s sound shows large in the workspace header and is changed there. On the sidebar a note button appears only over the row. In the picker a press on a card chooses, and the card\'s ▶ listens without choosing. The Settings rows no longer jump when the choice changes.',
  lines: [
    'A Selector in the header: beside the name a large selector with the sound\'s emblem, a note and its name ("Kalimba · default").',
    'B Card under the name: under the name a wide sound card with a large emblem, the name, Listen and Change sound.',
    'C Settings strip: under the header a row of large setting buttons (Icon, Name, Sound), sound being one of them.',
  ],
  recommend: 'Recommendation: A Selector in the header. One large, obviously changeable selector beside the name, and no new header row for one rarely changed setting.',
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
  cardLead: 'Plays when the agent finishes or wants your attention',
  cardOwn: 'This workspace\'s own sound',
  cardDefault: 'Same as your default sound',
  listen: 'Listen',
  change: 'Change sound',
  stripTitle: 'Workspace settings',
  stripIcon: 'Icon', stripIconValue: 'Letter', stripName: 'Name',
  railNote: (repo: string, name: string, own: boolean) => `Sound of workspace ${repo}: ${name}${own ? '' : ' (default)'}. Change`,

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
  reposDesc: 'A different sound for each workspace, so you hear which one finished. A workspace without its own sound plays the default. A workspace\'s sound can also be changed from its header.',
};

export const TEXT: Record<Lang, typeof fi> = {fi, en};
export const soundText = (lang: Lang, id: SoundId) => SOUND_TEXT[lang].sounds[id];
