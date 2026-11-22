# text/attentionSound.ts

Generated from web/src/text/attentionSound.ts; do not edit.

```tsx
import type { SoundId } from "../app/soundSynth";
import { catalog } from "../i18n";

// The attention sound (attention-sound, experimental): Settings › Äänet
// (components/SoundSettings.tsx), the account menu's Äänet row
// (components/Account.tsx), the workspace strip and its sound picker
// (components/WorkspaceStrip.tsx). Workspace names come in as arguments.
// The sound plays once when a conversation moves to Sinun vuorosi; mute and
// volume are this browser's own, every other choice follows the person.
const fi = {
  sounds: {
    kalimba: ["Kalimba", "Peukalopianon kolme kieltä."],
    marimba: ["Marimba", "Kolme lyöntiä puulaattoihin."],
    vibrafoni: ["Vibrafoni", "Kaksi metallilaattaa, pehmeä värinä."],
    "tunnus-puu": ["Tunnus puu", "Habitatin sävelaihe marimballa."],
    pisara: ["Pisara", "Pisarat tippuvat veteen."],
    lasit: ["Lasit", "Kaksi lasia kilahtaa."],
    tuulikello: ["Tuulikello", "Viisi putkea tuulessa."],
    kuplat: ["Kuplat", "Kuplia nousee pintaan."],
    kulho: ["Kulho", "Matala laulava kulho."],
    jaapuikot: ["Jääpuikot", "Kolme jääpuikkoa helähtää."],
  } as Record<SoundId, [string, string]>,
  // Settings › Äänet
  intro:
    "Habitat soittaa lyhyen äänen, kun agentti on valmis tai haluaa huomiosi. Ääni soi avoimessa Habitat-välilehdessä; suljettu selain ei soi.",
  on: "Äänet",
  onDesc: "Oletuksena päällä. Koskee kaikkia laitteitasi.",
  off: "Pois",
  onLabel: "Päällä",
  sound: "Ääni",
  soundDesc:
    "Paina ääntä kuullaksesi sen; painettu ääni valitaan. Työtilan oma ääni korvaa tämän.",
  playing: "Soi",
  selected: "Valittu",
  tileLabel: (name: string, desc: string) => `${name}. ${desc}`,
  length: "Äänten pituus",
  lengthDesc:
    "Yksi valinta kaikille äänille. Lyhyt soi noin 0,7 sekuntia, pitkä noin 1,4 sekuntia ja jää soimaan.",
  short: "Lyhyet",
  long: "Pitkät",
  when: "Milloin soi",
  inView: "Keskustelu, jota katsot",
  inViewDesc:
    "Ei ääntä, kun keskustelu on jo edessäsi. Soi, kun toinen keskustelu on auki tai Habitat on taustalla.",
  inViewQuiet: "Hiljaa",
  inViewPlays: "Soi silti",
  night: "Hiljennä yöllä",
  nightDesc:
    "Äänet ovat hiljaa valitsemanasi aikana laitteen paikallisen kellon mukaan. Tumma teema ei vaikuta ääniin.",
  nightStart: "Alkaa",
  nightEnd: "Päättyy",
  clockHour: (time: string) => `klo ${time}`,
  quietHere: "Äänet ovat hiljaa tällä laitteella",
  quietReasons: (n: number) =>
    n === 1 ? "Yksi syy:" : `${n} syytä; ääni soi, kun kaikki on korjattu:`,
  offReason: "Pois kaikilta laitteilta",
  mutedReason: "Tämä laite on mykistetty",
  nightReason: (start: string, end: string) => `Yö, hiljaa klo ${start}–${end}`,
  offRedundant: "ei vaikuta, ennen kuin äänet ovat päällä",
  enableSounds: "Laita äänet päälle",
  unmute: "Poista mykistys",
  nightOff: "Ota yöhiljaisuus pois",
  nightSettings: "Muuta aikaa",
  previewNight:
    "Kuuntelu ohittaa yöhiljaisuuden. Agenttien äänet pysyvät hiljaa.",
  testNight: "Testi soi myös yöllä.",
  workspaces: "Työtilojen äänet",
  workspacesDesc:
    "Eri ääni eri työtilalle, jotta kuulet, mikä valmistui. Valitaan samoista kymmenestä äänestä.",
  noWorkspaces: "Ei vielä työtiloja.",
  sameAsDefault: (name: string) => `Sama kuin yllä (${name})`,
  workspaceLabel: (workspace: string) => `Työtilan ${workspace} ääni`,
  listenWorkspace: (workspace: string) => `Kuuntele työtilan ${workspace} ääni`,
  device: "Tällä laitteella",
  deviceDesc:
    "Koskee vain tätä selainta. Sama mykistys on tilivalikon Äänet-rivillä.",
  mute: "Tämän laitteen äänet",
  muteDesc:
    "Mykistä esimerkiksi puhelin, kun sama keskustelu on auki koneella.",
  plays: "Soi",
  quiet: "Hiljaa",
  volume: "Voimakkuus",
  test: "Testaa ääni",
  mutedNote: "Tämä laite on mykistetty. Muut laitteesi soivat edelleen.",
  offNote: "Äänet ovat pois kaikilta laitteiltasi. Kuuntelu toimii silti.",
  readError: "Ääniasetuksia ei voitu lukea. Yritä uudelleen.",
  writeError: "Valintaa ei voitu tallentaa. Yritä uudelleen.",
  retry: "Yritä uudelleen",
  // The account menu's row
  menuRow: "Äänet",
  menuScope: "Vain tämä laite",
  stateMuted: "Hiljaa tällä laitteella",
  stateOff: "Pois kaikilla laitteilla",
  stateOffWhy: "Huomioääni on pois Asetuksista.",
  stateNight: (time: string) => `Yö: hiljaa klo ${time} asti`,
  menuOf: (account: string, state: string) => `${account}, ${state}`,
  // The workspace strip and its sound picker
  strip: "Työtilan asetukset",
  stripIcon: "Kuvake",
  stripName: "Nimi",
  stripSound: "Ääni",
  iconFrom: {
    derived: "Nimestä",
    letters: "Kirjaimet",
    emoji: "Emoji",
    logo: "Logo",
  },
  nameLabel: (name: string) => `Näyttönimi: ${name}. Muuta`,
  nameField: "Näyttönimi",
  nameHint: (folder: string) =>
    `Kansio ${folder} pysyy samana. Tyhjä nimi palauttaa kansion nimen.`,
  cancel: "Peru",
  save: "Tallenna",
  defaultWord: "oletus",
  soundLabel: (name: string, own: boolean) =>
    `Työtilan ääni: ${name}${own ? "" : ", sama kuin oletus"}. Vaihda`,
  pickerTitle: "Työtilan ääni",
  pickerHelp: "Paina ääntä valitaksesi sen. ▶ soittaa äänen valitsematta.",
  pickerDefault: "Sama kuin oletus",
  pickerDefaultDetail: (name: string) => `${name} · vaihtuu oletuksen mukana`,
  preview: (name: string) => `Kuuntele ${name}`,
  close: "Sulje",
  done: "Valmis",
  lengthNote: {
    short:
      "Äänet soivat lyhyinä, kuten agentin valmistuessa. Pituus valitaan kaikille äänille Asetuksissa.",
    long: "Äänet soivat pitkinä, kuten agentin valmistuessa. Pituus valitaan kaikille äänille Asetuksissa.",
  },
};

export const attentionSoundText = catalog(fi, {
  sounds: {
    kalimba: ["Kalimba", "Three tines of a thumb piano."],
    marimba: ["Marimba", "Three strokes on wooden bars."],
    vibrafoni: ["Vibraphone", "Two metal bars, a soft vibrato."],
    "tunnus-puu": ["Motif, wood", "Habitat's motif on a marimba."],
    pisara: ["Drop", "Drops falling into water."],
    lasit: ["Glasses", "Two glasses clink."],
    tuulikello: ["Wind chime", "Five tubes in the wind."],
    kuplat: ["Bubbles", "Bubbles rising to the surface."],
    kulho: ["Bowl", "A low singing bowl."],
    jaapuikot: ["Icicles", "Three icicles ring."],
  },
  intro:
    "Habitat plays a short sound when the agent finishes or wants your attention. The sound plays in an open Habitat tab; a closed browser stays silent.",
  on: "Sounds",
  onDesc: "On by default. Applies to all your devices.",
  off: "Off",
  onLabel: "On",
  sound: "Sound",
  soundDesc:
    "Press a sound to hear it; the sound you press is chosen. A workspace's own sound replaces this one.",
  playing: "Playing",
  selected: "Chosen",
  tileLabel: (name: string, desc: string) => `${name}. ${desc}`,
  length: "Sound length",
  lengthDesc:
    "One choice for all sounds. Short plays for about 0.7 seconds, long for about 1.4 seconds and rings on.",
  short: "Short",
  long: "Long",
  when: "When it plays",
  inView: "Conversation you are looking at",
  inViewDesc:
    "No sound when the conversation is already in front of you. Plays when another conversation is open or Habitat is in the background.",
  inViewQuiet: "Quiet",
  inViewPlays: "Play anyway",
  night: "Quiet at night",
  nightDesc:
    "Sounds stay quiet during your chosen hours by the device's local clock. A dark theme does not affect sounds.",
  nightStart: "Starts",
  nightEnd: "Ends",
  clockHour: (time: string) => `at ${time}`,
  quietHere: "Sounds are quiet on this device",
  quietReasons: (n: number) =>
    n === 1
      ? "One reason:"
      : `${n} reasons; the sound plays once all are fixed:`,
  offReason: "Off on all devices",
  mutedReason: "This device is muted",
  nightReason: (start: string, end: string) => `Night, quiet ${start}–${end}`,
  offRedundant: "no effect until sounds are on",
  enableSounds: "Turn sounds on",
  unmute: "Unmute",
  nightOff: "Turn off night quiet",
  nightSettings: "Change hours",
  previewNight: "Listening skips night quiet. Agents' sounds stay quiet.",
  testNight: "The test plays at night too.",
  workspaces: "Workspace sounds",
  workspacesDesc:
    "A different sound for each workspace, so you hear which one finished. Chosen from the same ten sounds.",
  noWorkspaces: "No workspaces yet.",
  sameAsDefault: (name: string) => `Same as above (${name})`,
  workspaceLabel: (workspace: string) => `Sound of workspace ${workspace}`,
  listenWorkspace: (workspace: string) =>
    `Listen to the sound of workspace ${workspace}`,
  device: "On this device",
  deviceDesc:
    "Applies to this browser only. The same mute is on the Sounds row of the account menu.",
  mute: "Sounds on this device",
  muteDesc:
    "Mute your phone, for example, when the same conversation is open on your computer.",
  plays: "Play",
  quiet: "Quiet",
  volume: "Volume",
  test: "Test sound",
  mutedNote: "This device is muted. Your other devices still play.",
  offNote: "Sounds are off on all your devices. Listening still works.",
  readError: "The sound settings could not be read. Try again.",
  writeError: "The choice could not be saved. Try again.",
  retry: "Try again",
  menuRow: "Sounds",
  menuScope: "This device only",
  stateMuted: "Quiet on this device",
  stateOff: "Off on every device",
  stateOffWhy: "The attention sound is off in Settings.",
  stateNight: (time: string) => `Night: quiet until ${time}`,
  menuOf: (account: string, state: string) => `${account}, ${state}`,
  strip: "Workspace settings",
  stripIcon: "Icon",
  stripName: "Name",
  stripSound: "Sound",
  iconFrom: {
    derived: "From name",
    letters: "Letters",
    emoji: "Emoji",
    logo: "Logo",
  },
  nameLabel: (name: string) => `Display name: ${name}. Change`,
  nameField: "Display name",
  nameHint: (folder: string) =>
    `The folder ${folder} stays the same. An empty name brings back the folder's name.`,
  cancel: "Cancel",
  save: "Save",
  defaultWord: "default",
  soundLabel: (name: string, own: boolean) =>
    `Workspace sound: ${name}${own ? "" : ", same as the default"}. Change`,
  pickerTitle: "Workspace sound",
  pickerHelp: "Press a sound to choose it. ▶ plays a sound without choosing.",
  pickerDefault: "Same as the default",
  pickerDefaultDetail: (name: string) => `${name} · changes with the default`,
  preview: (name: string) => `Listen to ${name}`,
  close: "Close",
  done: "Done",
  lengthNote: {
    short:
      "Sounds play short, as when an agent finishes. The length is chosen for all sounds in Settings.",
    long: "Sounds play long, as when an agent finishes. The length is chosen for all sounds in Settings.",
  },
});

```
