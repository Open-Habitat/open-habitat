// The round's own words, Finnish and English. Production's own words for the
// rest of the page come from web/src/text/attentionSound.ts.
export type Lang = "fi" | "en";
export type Scenario = "night" | "darkday" | "day";
export type Device = "both" | "desktop" | "phone";
export const DIRECTIONS = ["A Tilarivi", "B Pääkytkin", "C Kello"];

const fi = {
  title: "Yöhiljaisuus näkyviin: Asetukset › Äänet",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö" },
  language: "Kieli",
  scenario: "Tilanne",
  scenarios: {
    night: "Klo 23.40, laite tummassa tilassa",
    darkday: "Klo 14.10, laite tummassa tilassa koko päivän",
    day: "Klo 14.10, laite vaaleassa tilassa",
  } as Record<Scenario, string>,
  device: "Laite",
  devices: { both: "Molemmat", desktop: "Työpöytä", phone: "Puhelin" } as Record<Device, string>,
  reset: "Alusta",
  phoneCaption: "Puhelin, 390 px",
  menuCaption: "Tilivalikko auki: sama tila Äänet-rivillä",
  lines: [
    "A Tilarivi: sivun ylimpänä rivi \"Äänet ovat nyt hiljaa: on yö\", syy ja Soita silti; yö on edelleen laitteen tumma tila.",
    "B Pääkytkin: Äänet-kytkin itse kertoo \"Päällä, nyt hiljaa: yö\", ja Hiljennä yöllä nousee samaan korttiin sen alle.",
    "C Kello: sama tilarivi, mutta yö on muokattava kellonaika (22–7) eikä tumma tila, joten koko päivän tumma laite soi päivällä.",
  ],
  recommend:
    "Suositus: C. Tumma tila on teema, ei vuorokaudenaika; kello tekee yöstä ennustettavan, ja tilarivi kertoo sen silloin, kun se vaikuttaa.",
  rounds: "Kierros 2026-11-22-night-quiet · synteettinen sisältö",
  // Page words
  settings: "Asetukset",
  back: "Asetukset",
  section: "Äänet",
  // A and C: the status line at the top
  quietNow: "Äänet ovat nyt hiljaa: on yö",
  whyDark: "Laite on tummassa tilassa, ja Hiljennä yöllä on päällä. Äänet soivat taas, kun laite vaihtaa vaaleaan tilaan.",
  whyClock: (start: string, end: string) =>
    `Yöhiljaisuus on klo ${start}–${end} tämän laitteen kellon mukaan. Äänet soivat taas klo ${end}.`,
  quietUntil: (end: string) => `Äänet ovat hiljaa klo ${end} asti: on yö`,
  playAnyway: "Soita silti",
  playAnywayTonight: "Soita silti tänä yönä",
  playAnywayHintDark: "Kunnes laite seuraavan kerran siirtyy yöhön.",
  nightSettings: "Yön asetukset",
  overridden: "Äänet soivat tämän yön, vaikka on yö.",
  overriddenDark: "Äänet soivat, vaikka laite on tummassa tilassa. Hiljaisuus palaa, kun laite seuraavan kerran siirtyy yöhön.",
  overriddenClock: (start: string) => `Hiljaisuus palaa huomenna klo ${start}.`,
  quietAgain: "Hiljennä taas",
  // B: the master row
  onNight: "Päällä, mutta nyt hiljaa: on yö",
  onNightWhy: "Laite on tummassa tilassa. Äänet soivat taas, kun laite vaihtaa vaaleaan tilaan.",
  onDay: "Päällä: ääni soi nyt. Yöllä hiljaa, kun laite on tummassa tilassa.",
  onOverride: "Päällä: soi tämän yön, vaikka on yö.",
  onOff: "Pois kaikilla laitteillasi.",
  nightTag: "Yö",
  nightSub: "Hiljennä yöllä",
  nightSubDesc: "Ei ääntä, kun laite on tummassa tilassa (Järjestelmä-teeman rytmi).",
  // C: the clock
  nightClockDesc: "Ei ääntä näinä tunteina tämän laitteen kellon mukaan. Laitteen tumma tila ei vaikuta.",
  from: "Alkaa",
  to: "Päättyy",
  clockNow: (now: string, start: string, end: string, night: boolean) =>
    night ? `Nyt klo ${now}: yö (${start}–${end}), ääni on hiljaa.` : `Nyt klo ${now}: päivä, ääni soi.`,
  // The preview's honest note
  previewBypass: "Kuuntelu soi silti: laatan painallus ja Testaa ääni ohittavat yöhiljaisuuden. Agentin äänet pysyvät hiljaa.",
  testBypass: "Testi soi myös yöllä.",
  // The menu
  menuNightA: "Hiljaa yön takia: laite on tummassa tilassa",
  menuNightB: "Nyt yö: hiljaa, kunnes laite vaihtaa päivään",
  menuNightC: (end: string) => `Yö: hiljaa klo ${end} asti`,
  menuOverride: "Soi tämän yön, vaikka on yö",
  menuPlays: "Vain tämä laite",
  menuTheme: "Teema",
  menuWork: "Agentin työ",
  hidden: "Piilossa",
  visible: "Näkyvissä",
  toastOverride: "Prototyyppi: ohitus koskee tätä laitetta tämän yön.",
};
type Text = typeof fi;

const en: Text = {
  title: "Night quiet made visible: Settings › Sounds",
  theme: "Theme",
  themes: { light: "Day", dark: "Night" },
  language: "Language",
  scenario: "Situation",
  scenarios: {
    night: "23:40, device in dark mode",
    darkday: "14:10, device in dark mode all day",
    day: "14:10, device in light mode",
  },
  device: "Device",
  devices: { both: "Both", desktop: "Desktop", phone: "Phone" },
  reset: "Reset",
  phoneCaption: "Phone, 390 px",
  menuCaption: "Account menu open: the same state on the Sounds row",
  lines: [
    "A Status line: the page's top line says \"Sounds are quiet now: it is night\", why, and Play anyway; night is still the device's dark mode.",
    "B Master switch: the Sounds switch itself says \"On, quiet now: night\", and Quiet at night moves into its card right below it.",
    "C Clock: the same status line, but night is an editable clock window (22–7) instead of dark mode, so a device dark all day plays by day.",
  ],
  recommend:
    "Recommended: C. Dark mode is a theme, not a time of day; a clock makes night predictable, and the status line says so when it matters.",
  rounds: "Round 2026-11-22-night-quiet · synthetic content",
  settings: "Settings",
  back: "Settings",
  section: "Sounds",
  quietNow: "Sounds are quiet now: it is night",
  whyDark: "The device is in dark mode and Quiet at night is on. Sounds play again when the device switches to light mode.",
  whyClock: (start, end) => `Night quiet is ${start}–${end} by this device's clock. Sounds play again at ${end}.`,
  quietUntil: (end) => `Sounds are quiet until ${end}: it is night`,
  playAnyway: "Play anyway",
  playAnywayTonight: "Play anyway tonight",
  playAnywayHintDark: "Until the device next turns to night.",
  nightSettings: "Night settings",
  overridden: "Sounds play tonight even though it is night.",
  overriddenDark: "Sounds play even though the device is in dark mode. The quiet returns when the device next turns to night.",
  overriddenClock: (start) => `The quiet returns tomorrow at ${start}.`,
  quietAgain: "Quiet again",
  onNight: "On, but quiet now: it is night",
  onNightWhy: "The device is in dark mode. Sounds play again when the device switches to light mode.",
  onDay: "On: the sound plays now. Quiet at night while the device is in dark mode.",
  onOverride: "On: playing tonight even though it is night.",
  onOff: "Off on all your devices.",
  nightTag: "Night",
  nightSub: "Quiet at night",
  nightSubDesc: "No sound while the device is in dark mode (the System theme's rhythm).",
  nightClockDesc: "No sound during these hours by this device's clock. The device's dark mode has no effect.",
  from: "Starts",
  to: "Ends",
  clockNow: (now, start, end, night) =>
    night ? `Now ${now}: night (${start}–${end}), the sound is quiet.` : `Now ${now}: day, the sound plays.`,
  previewBypass: "Listening still plays: pressing a tile and Test sound skip night quiet. The agent's sounds stay quiet.",
  testBypass: "The test plays at night too.",
  menuNightA: "Quiet for the night: the device is in dark mode",
  menuNightB: "Night now: quiet until the device turns to day",
  menuNightC: (end) => `Night: quiet until ${end}`,
  menuOverride: "Playing tonight even though it is night",
  menuPlays: "This device only",
  menuTheme: "Theme",
  menuWork: "Agent work",
  hidden: "Hidden",
  visible: "Visible",
  toastOverride: "Prototype: the override applies to this device for tonight.",
};

export const TEXT: Record<Lang, Text> = { fi, en };
export type { Text };
