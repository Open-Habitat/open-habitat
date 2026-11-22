// The round's own words, Finnish and English. Production's own words for the
// rest of the page come from web/src/text/attentionSound.ts.
export type Lang = "fi" | "en";
export type Device = "both" | "desktop" | "phone";
/** Which silences are on when the situation starts. */
export type Scenario = "normal" | "night" | "muted" | "off" | "nightMuted" | "all";
export const SCENARIOS: Scenario[] = ["nightMuted", "night", "muted", "off", "all", "normal"];
export const DIRECTIONS = ["A Vahvin syy", "B Kaikki syyt", "C Vain yö"];

const fi = {
  title: "Hiljaisuuden syy yhdellä rivillä: Asetukset › Äänet",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö" },
  language: "Kieli",
  scenario: "Tilanne",
  scenarios: {
    nightMuted: "Klo 23.40, tämä laite mykistetty",
    night: "Klo 23.40, kaikki muu päällä",
    muted: "Klo 14.10, tämä laite mykistetty",
    off: "Klo 14.10, äänet pois kaikilta",
    all: "Klo 23.40, pois kaikilta ja mykistetty",
    normal: "Klo 14.10, kaikki soi",
  } as Record<Scenario, string>,
  device: "Laite",
  devices: { both: "Molemmat", desktop: "Työpöytä", phone: "Puhelin" } as Record<Device, string>,
  reset: "Alusta",
  phoneCaption: "Puhelin, 390 px",
  menuCaption: "Tilivalikko auki: sama tila Äänet-rivillä",
  lines: [
    "A Vahvin syy: yksi rivi nimeää aina vahvimman syyn (pois kaikilta › mykistetty › yö) ja sen yhden korjauksen; korjattu paljastaa seuraavan.",
    "B Kaikki syyt: yksi rivi luettelee kaikki voimassa olevat syyt, ja jokaisella on oma korjauksensa.",
    "C Vain yö: tilarivi kertoo vain kellon tuoman yön; mykistys ja Pois kaikilta näkyvät omissa kontrolleissaan kuten nyt.",
  ],
  recommend:
    "Suositus: A. Jokainen hiljaisuus kuulostaa samalta, rivi on aina yksi lause ja yksi painike, ja se kertoo juuri sen, mikä estää äänen nyt.",
  // Page words
  settings: "Asetukset",
  back: "Asetukset",
  section: "Äänet",
  // The reasons, strongest first
  offTitle: "Äänet ovat pois kaikilta laitteilta",
  offWhy: "Mikään laitteesi ei soita agentin ääntä. Kuuntelu toimii silti.",
  offFix: "Laita äänet päälle",
  mutedTitle: "Tämä laite on mykistetty",
  mutedWhy: "Muut laitteesi soivat edelleen. Sama mykistys on tilivalikon Äänet-rivillä.",
  mutedFix: "Poista mykistys",
  nightTitle: (end: string) => `Äänet ovat hiljaa klo ${end} asti: on yö`,
  nightWhy: (start: string, end: string) => `Yöhiljaisuus on klo ${start}–${end} tämän laitteen kellon mukaan.`,
  nightFix: "Ota yöhiljaisuus pois",
  nightEdit: "Muuta aikaa",
  // B: the list
  quietHere: "Äänet ovat hiljaa tällä laitteella",
  quietReasons: (n: number) => (n === 1 ? "Yksi syy:" : `${n} syytä; ääni soi, kun kaikki on korjattu:`),
  offShort: "Pois kaikilta laitteilta",
  mutedShort: "Tämä laite on mykistetty",
  nightShort: (start: string, end: string) => `Yö, hiljaa klo ${start}–${end}`,
  offRedundant: "ei vaikuta, ennen kuin äänet ovat päällä",
  // C: night only
  clockNow: (now: string, start: string, end: string, night: boolean) =>
    night ? `Nyt klo ${now}: yö (${start}–${end}), ääni on hiljaa.` : `Nyt klo ${now}: päivä, ääni soi.`,
  nightClockDesc: "Ei ääntä näinä tunteina tämän laitteen kellon mukaan.",
  from: "Alkaa",
  to: "Päättyy",
  // Toasts: the fix is a setting change, not an override
  toastOff: "Äänet ovat nyt päällä kaikilla laitteillasi.",
  toastMuted: "Tämän laitteen mykistys poistettu.",
  toastNight: "Yöhiljaisuus on nyt pois. Voit ottaa sen takaisin Milloin soi -kohdasta.",
  // The menu
  menuNightC: (end: string) => `Yö: hiljaa klo ${end} asti`,
  menuPlays: "Vain tämä laite",
  menuTheme: "Teema",
  menuWork: "Agentin työ",
  hidden: "Piilossa",
  visible: "Näkyvissä",
};
type Text = typeof fi;

const en: Text = {
  title: "The reason for silence on one line: Settings › Sounds",
  theme: "Theme",
  themes: { light: "Day", dark: "Night" },
  language: "Language",
  scenario: "Situation",
  scenarios: {
    nightMuted: "23:40, this device muted",
    night: "23:40, everything else on",
    muted: "14:10, this device muted",
    off: "14:10, sounds off everywhere",
    all: "23:40, off everywhere and muted",
    normal: "14:10, everything plays",
  },
  device: "Device",
  devices: { both: "Both", desktop: "Desktop", phone: "Phone" },
  reset: "Reset",
  phoneCaption: "Phone, 390 px",
  menuCaption: "Account menu open: the same state on the Sounds row",
  lines: [
    "A Strongest reason: one line always names the strongest reason (off everywhere › muted › night) and its one fix; fixing it reveals the next.",
    "B All reasons: one line lists every active reason, each with its own fix.",
    "C Night only: the status line tells only the clock's night; mute and Off everywhere show in their own controls as today.",
  ],
  recommend:
    "Recommended: A. Every silence reads the same, the line is always one sentence and one button, and it names exactly what stops the sound now.",
  settings: "Settings",
  back: "Settings",
  section: "Sounds",
  offTitle: "Sounds are off on all devices",
  offWhy: "None of your devices plays the agent's sound. Listening still works.",
  offFix: "Turn sounds on",
  mutedTitle: "This device is muted",
  mutedWhy: "Your other devices still play. The same mute is on the account menu's Sounds row.",
  mutedFix: "Unmute",
  nightTitle: (end) => `Sounds are quiet until ${end}: it is night`,
  nightWhy: (start, end) => `Night quiet is ${start}–${end} by this device's clock.`,
  nightFix: "Turn night quiet off",
  nightEdit: "Change hours",
  quietHere: "Sounds are quiet on this device",
  quietReasons: (n) => (n === 1 ? "One reason:" : `${n} reasons; the sound plays once all are fixed:`),
  offShort: "Off on all devices",
  mutedShort: "This device is muted",
  nightShort: (start, end) => `Night, quiet ${start}–${end}`,
  offRedundant: "no effect until sounds are on",
  clockNow: (now, start, end, night) =>
    night ? `Now ${now}: night (${start}–${end}), the sound is quiet.` : `Now ${now}: day, the sound plays.`,
  nightClockDesc: "No sound during these hours by this device's clock.",
  from: "Starts",
  to: "Ends",
  toastOff: "Sounds are now on for all your devices.",
  toastMuted: "This device is no longer muted.",
  toastNight: "Night quiet is now off. You can turn it back on under When it plays.",
  menuNightC: (end) => `Night: quiet until ${end}`,
  menuPlays: "This device only",
  menuTheme: "Theme",
  menuWork: "Agent work",
  hidden: "Hidden",
  visible: "Visible",
};

export const TEXT: Record<Lang, Text> = { fi, en };
export type { Text };
