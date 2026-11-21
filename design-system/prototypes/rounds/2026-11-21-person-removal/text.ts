// The round's own words, Finnish and English. Production words (the access
// list's states and facts, Levytila's meter and columns, the server area's
// navigation) come from production catalogs and follow the same choice.
// Logins, Unix names and sizes are synthetic. The stage names and the 14-day
// period follow ADR 0037 (proposed) and are still placeholders.

export type Step = "close" | "services" | "links" | "home" | "space" | "unix";

const fi = {
  title: "Henkilön poisto",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  lines: [
    "1 Armonaika: Poista henkilö -ikkunassa valitaan 14 pv tai heti; rivillä näkyy Poistetaan 5.12. ja Peru poisto.",
    "2 Heti: ei armonaikaa; ikkuna kertoo seuraukset, kirjoitettu tunnus vahvistaa ja poisto etenee ikkunassa. Ei peruutusta.",
    "3 Vaiheittain: ensin tuttu Poista pääsy, sitten Ei pääsyä -rivin Poista henkilö ajastaa poiston 14 päivän päähän.",
  ],
  recommend:
    "Suositus: 1 Armonaika. Virheen voi perua kaksi viikkoa, Poista heti on samassa ikkunassa, kun tilaa tarvitaan nyt, ja rajojen summa korjaantuu heti.",
  hint: "Aika ja virhe:",
  day1: "+1 pv",
  day14: "+14 pv",
  failNext: "Seuraava poisto keskeytyy",
  reset: "Alkutila",
  clock: (d: string) => `Nyt ${d} klo 10.00`,

  // Row actions and stages.
  removePerson: "Poista henkilö",
  removePersonNamed: (who: string) => `Poista henkilö ${who}`,
  removeAccess: "Poista pääsy",
  scheduledMark: (day: string) => `Poistetaan ${day}`,
  daysLeft: (days: number) => `${days} pv jäljellä`,
  scheduledNote: "Pääsy suljettu, palvelut irrotettu. Kotihakemisto on vielä tallessa.",
  cancel: "Peru poisto",
  cancelNamed: (who: string) => `Peru henkilön ${who} poisto`,
  running: "Poistetaan…",
  failed: "Poisto kesken",
  retry: "Yritä nyt",
  retryHourly: "Palvelin yrittää uudelleen tunnin välein.",
  failedReason:
    "Levytilaa ei voitu todeta vapaaksi: henkilön Unix-tunnisteella on yhä tiedostoja (files_remain).",
  removedMark: "Poistettu",
  removedFact: (day: string) => `Poistettu ${day}`,
  servicesFact: (revoked: number, local: number) =>
    `Palvelut: ${revoked} peruttu palvelussa, ${local} poistettu vain Habitatista`,
  noAccessSince: (day: string) => `Pääsy poistettu ${day}`,
  countedByUse: "Ei varaa rajaa: lasketaan käytön mukaan",
  stepsDone: (done: number, all: number) => `${done} / ${all} vaihetta tehty`,
  steps: {
    close: "Kirjautuminen estetty ja prosessit pysäytetty",
    services: "Yhdistetyt palvelut irrotettu",
    links: "Jaetut linkit lakkasivat toimimasta",
    home: "Kotihakemisto poistettu",
    space: "Levytila todettu vapaaksi",
    unix: "Unix-tili poistettu",
  } satisfies Record<Step, string>,
  stepsRunning: {
    close: "Estetään kirjautuminen",
    services: "Irrotetaan palveluja",
    links: "Poistetaan jaettuja linkkejä",
    home: "Poistetaan kotihakemistoa",
    space: "Todetaan levytila vapaaksi",
    unix: "Poistetaan Unix-tiliä",
  } satisfies Record<Step, string>,
  interrupted: (step: string) => `${step}: keskeytyi`,

  // The removal dialog (ADR 0037 section 2).
  question: (who: string) => `Poista henkilö ${who}?`,
  accessNow: "Pääsy loppuu nyt, ja henkilö kirjataan ulos kaikkialta.",
  accessGone: "Pääsy on jo poistettu. Henkilö kirjataan ulos kaikkialta.",
  servicesNow: "Yhdistetyt palvelut irrotetaan nyt. Jos poiston perut, henkilö yhdistää ne uudelleen.",
  linksNow: "Henkilön jakamat linkit lakkaavat toimimasta nyt.",
  homeOn: (day: string, size: string) =>
    `${day} kotihakemisto (${size}) poistetaan pysyvästi. Sen jälkeen mitään ei voi palauttaa.`,
  homeNow: (size: string) =>
    `Kotihakemisto (${size}) poistetaan pysyvästi heti. Mitään ei voi palauttaa.`,
  tellThem:
    "Habitat ei ilmoita henkilölle. Jos hän tarvitsee tietonsa, peru poisto ja palauta pääsy, niin hän voi ottaa ne itse.",
  when: "Milloin",
  whenGrace: (days: number, day: string) => `${days} päivän päästä, ${day} – voit perua siihen asti`,
  whenNow: "Heti – tilaa tarvitaan nyt",
  typeLogin: (login: string) => `Vahvista kirjoittamalla ${login}`,
  confirmOn: (day: string) => `Poista ${day}`,
  confirmNow: "Poista heti",
  confirmPermanent: "Poista pysyvästi",
  progressTitle: (who: string) => `Poistetaan ${who}`,
  doneTitle: (who: string) => `${who} poistettu`,
  failedTitle: (who: string) => `${who}: poisto kesken`,
  close: "Sulje",
  doneFreed: (size: string) => `${size} vapautui levyltä.`,

  // 3 Vaiheittain: the withdrawal step.
  accessQuestion: (who: string) => `Poista henkilön ${who} pääsy?`,
  accessStays:
    "Kotihakemisto ja tiedostot jäävät, ja pääsyn voi palauttaa. Henkilön voi sen jälkeen poistaa rivin Poista henkilö -painikkeella.",
};

export type Text = typeof fi;

const en: Text = {
  title: "Removing a person",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  lines: [
    "1 Grace period: the Remove person window offers 14 days or now; the row shows Removed on 5 Dec and Undo removal.",
    "2 Now: no grace period; the window states the consequences, the typed login confirms and the removal runs in the window. No undo.",
    "3 In steps: first the familiar Remove access, then the No access row's Remove person schedules removal in 14 days.",
  ],
  recommend:
    "Recommendation: 1 Grace period. A mistake can be undone for two weeks, Remove now is in the same window when space is needed now, and the sum of limits is right at once.",
  hint: "Time and failure:",
  day1: "+1 day",
  day14: "+14 days",
  failNext: "Next removal is interrupted",
  reset: "Start over",
  clock: (d) => `Now ${d} 10:00`,

  removePerson: "Remove person",
  removePersonNamed: (who) => `Remove person ${who}`,
  removeAccess: "Remove access",
  scheduledMark: (day) => `Removed on ${day}`,
  daysLeft: (days) => `${days} ${days === 1 ? "day" : "days"} left`,
  scheduledNote: "Access closed, services disconnected. The home directory is still kept.",
  cancel: "Undo removal",
  cancelNamed: (who) => `Undo removing ${who}`,
  running: "Removing…",
  failed: "Removal unfinished",
  retry: "Try now",
  retryHourly: "The server tries again every hour.",
  failedReason:
    "The space could not be shown free: files still belong to the person's Unix id (files_remain).",
  removedMark: "Removed",
  removedFact: (day) => `Removed on ${day}`,
  servicesFact: (revoked, local) =>
    `Services: ${revoked} revoked at the service, ${local} deleted from Habitat only`,
  noAccessSince: (day) => `Access removed on ${day}`,
  countedByUse: "Reserves no limit: counted by use",
  stepsDone: (done, all) => `${done} of ${all} steps done`,
  steps: {
    close: "Sign-in blocked and processes stopped",
    services: "Connected services disconnected",
    links: "Shared links stopped working",
    home: "Home directory deleted",
    space: "Space shown free",
    unix: "Unix account removed",
  },
  stepsRunning: {
    close: "Blocking sign-in",
    services: "Disconnecting services",
    links: "Removing shared links",
    home: "Deleting the home directory",
    space: "Showing the space free",
    unix: "Removing the Unix account",
  },
  interrupted: (step) => `${step}: interrupted`,

  question: (who) => `Remove person ${who}?`,
  accessNow: "Access ends now, and the person is signed out everywhere.",
  accessGone: "Access has already been removed. The person is signed out everywhere.",
  servicesNow: "Connected services are disconnected now. If you undo the removal, the person connects them again.",
  linksNow: "Links the person shared stop working now.",
  homeOn: (day, size) =>
    `On ${day} the home directory (${size}) is deleted for good. Nothing can be recovered after that.`,
  homeNow: (size) => `The home directory (${size}) is deleted for good now. Nothing can be recovered.`,
  tellThem:
    "Habitat does not tell the person. If they need their data, undo the removal and restore access so they can take it themselves.",
  when: "When",
  whenGrace: (days, day) => `In ${days} days, on ${day} – you can undo until then`,
  whenNow: "Now – the space is needed now",
  typeLogin: (login) => `Type ${login} to confirm`,
  confirmOn: (day) => `Remove on ${day}`,
  confirmNow: "Remove now",
  confirmPermanent: "Remove for good",
  progressTitle: (who) => `Removing ${who}`,
  doneTitle: (who) => `${who} removed`,
  failedTitle: (who) => `${who}: removal unfinished`,
  close: "Close",
  doneFreed: (size) => `${size} freed on the disk.`,

  accessQuestion: (who) => `Remove ${who}'s access?`,
  accessStays:
    "The home directory and files stay, and access can be restored. You can then remove the person with the row's Remove person.",
};

export const TEXT = { fi, en };
