// The round's own words, Finnish and English. The ten sounds' names and
// one-line descriptions come from emblem round 7
// (../2026-11-21-attention-sound-emblems-7/text.ts), and the rename and icon
// editor words are production's own (web/src/text/workspacePage.ts,
// web/src/text/workspaceIconPicker.tsx), so the rounds and the product agree.
import {type Lang, type Length, SOUND_IDS, type SoundId, TEXT as SOUND_TEXT} from '../2026-11-21-attention-sound-emblems-7/text';

export type {Lang, Length, SoundId};
export {SOUND_IDS};
export type Scenario = 'oma' | 'oletus' | 'kuvake' | 'nimi' | 'aani' | 'pitka';
export const SCENARIO_IDS: Scenario[] = ['oma', 'oletus', 'kuvake', 'nimi', 'aani', 'pitka'];
/** What the Kuvake square says under the icon: where the icon comes from. */
export type IconKind = 'derived' | 'letters' | 'emoji';

const fi = {
  // Review chrome
  title: 'Työtilan asetusnauha · kierros 5',
  scenario: 'Tilanne',
  theme: 'Teema', light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti',
  language: 'Kieli',
  reset: 'Alusta',
  simulate: 'Agentti valmis:',
  simRepo: (repo: string) => `työtilassa ${repo}`,
  scenarios: {
    oma: '1 kotisivu: emoji, oma ääni Pisara',
    oletus: '2 aurinkokello: nimestä, oletusääni',
    kuvake: '3 Kuvake auki',
    nimi: '4 Nimi auki',
    aani: '5 Ääni auki',
    pitka: '6 Pitkä näyttönimi',
  } as Record<Scenario, string>,
  roundLine: 'Nauha A Yksi rivi, ja nyt kaikki kolme toimivat: Kuvake avaa tuotannon kuvake-editorin, Nimi tuotannon näyttönimen muutoksen ja Ääni äänivalitsimen. Kukin aukeaa nauhan painikkeesta ponnahdusikkunana (puhelimessa alalaitaan), eikä mikään nauhassa liiku, kun arvo vaihtuu. Merkit ovat lopulliset.',
  lines: [
    'A Ponnahdus: Nimi avaa ponnahdusikkunan nauhan alle kuten Kuvake ja Ääni; kentässä näyttönimi ja Tallenna.',
    'B Paikallaan: Nimi muuttuu kentäksi omassa ruudussaan; Enter tallentaa, Esc peruu, muualle klikkaus tallentaa.',
  ],
  recommend: 'Suositus: A Ponnahdus. Kaikki kolme painiketta toimivat samoin, puhelimessa kaikki ovat alalaidan arkkeja, ja nimen voi kirjoittaa täysleveään kenttään myös kapealla ruudulla.',
  played: (name: string, len: string) => `Soi: ${name} (${len})`,
  previewed: (name: string, len: string) => `Kuunneltu: ${name} (${len}), valinta ei muuttunut`,
  simPlayed: (repo: string, name: string, len: string) => `Agentti valmis työtilassa ${repo} → soi ${name} (${len})`,
  simSilent: (repo: string) => `Agentti valmis työtilassa ${repo} → ei ääntä: äänet ovat pois`,
  renamed: (name: string) => `Näyttönimi: ${name}`,
  renamedBack: (dir: string) => `Näyttönimi tyhjennetty: näkyy kansion nimi ${dir}`,
  iconChosen: (v: string) => `Kuvake: ${v}`,
  notHere: 'Ehdotukset mallilta eivät ole tässä kierroksessa',

  // The sound picker
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
  lengthNote: {short: 'Äänet soivat lyhyinä, kuten agentin valmistuessa. Pituus valitaan kaikille äänille Asetuksissa.', long: 'Äänet soivat pitkinä, kuten agentin valmistuessa. Pituus valitaan kaikille äänille Asetuksissa.'} as Record<Length, string>,
  offNote: 'Äänet ovat pois kaikilta laitteiltasi. Valinta tallentuu, ja kuuntelu toimii silti.',
  done: 'Valmis',
  lengthOne: {short: 'lyhyt', long: 'pitkä'} as Record<Length, string>,

  // The strip
  stripTitle: 'Työtilan asetukset',
  soundWord: 'Ääni',
  defaultWord: 'oletus',
  entryLabel: (repo: string, name: string, own: boolean) => `Työtilan ${repo} ääni: ${name}${own ? '' : ', sama kuin oletus'}. Vaihda`,
  stripIcon: 'Kuvake',
  iconKind: {derived: 'Nimestä', letters: 'Kirjaimet', emoji: 'Emoji'} as Record<IconKind, string>,
  stripName: 'Nimi',
  nameLabel: (name: string) => `Näyttönimi: ${name}. Muuta`,
  // Rename (production's words are used for the title, field and Tallenna)
  folderStays: (dir: string) => `Kansio ~/src/${dir} pysyy samana. Tyhjä nimi palauttaa kansion nimen.`,
  cancel: 'Peru',

  // Workspace page (synthetic)
  conversations: 'Keskustelut',
  convs: ['Etusivun kuvat pienemmiksi', 'Yhteystietolomakkeen tarkistus', 'Saavutettavuuskorjaukset'],
  convMeta: ['valmis', 'odottaa sinua', 'eilen'],
  copyPath: 'Kopioi polku', archive: 'Arkistoi', newConv: 'Uusi keskustelu',
};

const en: typeof fi = {
  title: 'Workspace settings strip · round 5',
  scenario: 'Situation',
  theme: 'Theme', light: 'Day', dark: 'Night', contrast: 'High contrast',
  language: 'Language',
  reset: 'Reset',
  simulate: 'Agent finished:',
  simRepo: (repo: string) => `in workspace ${repo}`,
  scenarios: {
    oma: '1 kotisivu: emoji, own sound Drop',
    oletus: '2 aurinkokello: from name, default sound',
    kuvake: '3 Icon open',
    nimi: '4 Name open',
    aani: '5 Sound open',
    pitka: '6 Long display name',
  },
  roundLine: 'Strip A One row, and now all three work: Icon opens production\'s icon editor, Name production\'s display-name change and Sound the sound picker. Each opens from its strip button as a pop-up (a bottom sheet on a phone), and nothing in the strip moves when a value changes. The emblems are final.',
  lines: [
    'A Pop-up: Name opens a pop-up under the strip like Icon and Sound; a display-name field and Save.',
    'B In place: Name turns into a field in its own box; Enter saves, Esc cancels, a click elsewhere saves.',
  ],
  recommend: 'Recommendation: A Pop-up. All three buttons work the same way, on a phone all are bottom sheets, and the name gets a full-width field even on a narrow screen.',
  played: (name: string, len: string) => `Playing: ${name} (${len})`,
  previewed: (name: string, len: string) => `Listened: ${name} (${len}), choice unchanged`,
  simPlayed: (repo: string, name: string, len: string) => `Agent finished in workspace ${repo} → plays ${name} (${len})`,
  simSilent: (repo: string) => `Agent finished in workspace ${repo} → no sound: sounds are off`,
  renamed: (name: string) => `Display name: ${name}`,
  renamedBack: (dir: string) => `Display name cleared: the folder name ${dir} shows`,
  iconChosen: (v: string) => `Icon: ${v}`,
  notHere: 'Model suggestions are not part of this round',

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
  lengthNote: {short: 'Sounds play short, as when an agent finishes. The length for all sounds is chosen in Settings.', long: 'Sounds play long, as when an agent finishes. The length for all sounds is chosen in Settings.'},
  offNote: 'Sounds are off on all your devices. The choice is saved, and listening still works.',
  done: 'Done',
  lengthOne: {short: 'short', long: 'long'},

  stripTitle: 'Workspace settings',
  soundWord: 'Sound',
  defaultWord: 'default',
  entryLabel: (repo: string, name: string, own: boolean) => `Sound of workspace ${repo}: ${name}${own ? '' : ', same as default'}. Change`,
  stripIcon: 'Icon',
  iconKind: {derived: 'From name', letters: 'Letters', emoji: 'Emoji'},
  stripName: 'Name',
  nameLabel: (name: string) => `Display name: ${name}. Change`,
  folderStays: (dir: string) => `The folder ~/src/${dir} stays the same. An empty name brings back the folder name.`,
  cancel: 'Cancel',

  conversations: 'Conversations',
  convs: ['Smaller front page images', 'Contact form validation', 'Accessibility fixes'],
  convMeta: ['finished', 'waiting for you', 'yesterday'],
  copyPath: 'Copy path', archive: 'Archive', newConv: 'New conversation',
};

export const TEXT: Record<Lang, typeof fi> = {fi, en};
export const soundText = (lang: Lang, id: SoundId) => SOUND_TEXT[lang].sounds[id];
