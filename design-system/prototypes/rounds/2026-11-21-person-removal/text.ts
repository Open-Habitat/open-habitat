// The round's own words, Finnish and English. Production words (the access
// list's states and facts, Levytila's meter and columns, the server area's
// navigation) come from production catalogs and follow the same choice.
// Logins, Unix names, workspaces, paths and sizes are synthetic. Stage names
// and periods are placeholders until the architecture decision lands.

export type Step = "archive" | "sessions" | "accounts" | "links" | "home" | "unix";

const fi = {
  title: "Henkilön poisto",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  lines: [
    "1 Armonaika: pääsy loppuu heti ja tiedot poistetaan 7 päivän päästä; rivillä näkyy laskuri ja Peru poisto.",
    "2 Luettelo: ikkuna luettelee tarkalleen, mitä poistetaan, kaksi painallusta poistaa heti eikä sitä voi perua.",
    "3 Arkisto: kotihakemistosta tehdään ensin arkisto palvelimelle, sitten tiedot poistetaan; arkistosta voi palauttaa 30 päivää.",
  ],
  recommend:
    "Suositus: 1 Armonaika ja siihen 2:n luettelo. Virheen voi perua viikon, rajojen summa korjaantuu heti, eikä selain koskaan saa toisen ihmisen tiedostoja.",
  hint: "Aika ja virhe:",
  day1: "+1 pv",
  day7: "+7 pv",
  failNext: "Seuraava poisto keskeytyy",
  reset: "Alkutila",
  clock: (d: string) => `Nyt ${d}`,

  // Rows and stages (placeholder names).
  removePerson: "Poista",
  removePersonNamed: (who: string) => `Poista ${who}`,
  removeData: "Poista tiedot",
  inGrace: (days: number) => `Poistetaan ${days} pv päästä`,
  graceFact: (day: string) => `Tiedot poistetaan ${day}`,
  graceNote: "Pääsy poistettu, tiedot vielä tallessa",
  undo: "Peru poisto",
  undoNamed: (who: string) => `Peru ${who} poisto`,
  running: "Poistetaan…",
  archiving: "Arkistoidaan…",
  failed: "Poisto kesken",
  retry: "Yritä uudelleen",
  removedMark: "Poistettu",
  removedFact: (day: string) => `Henkilö ja tiedot poistettu ${day}`,
  archiveKept: (day: string, size: string) => `Arkisto ${size} säilyy ${day} asti`,
  restoreArchive: "Palauta arkistosta",
  noAccessSince: (day: string) => `Pääsy poistettu ${day}`,
  countedByUse: "Ei varaa rajaa: lasketaan käytön mukaan",
  noLimit: "–",
  stepsDone: (done: number, all: number) => `${done} / ${all} vaihetta tehty`,
  stepFailed: "Kotihakemiston poisto keskeytyi: levy ei vastannut. Kotihakemisto ja Unix-tili ovat yhä palvelimella, eikä henkilö pääse kirjautumaan.",
  interrupted: (step: string) => `${step}: keskeytyi`,
  steps: {
    archive: "Arkisto tehty",
    sessions: "Istunnot ja agentit pysäytetty",
    accounts: "Yhdistetyt tilit irrotettu",
    links: "Julkaistut linkit poistettu",
    home: "Työtilat ja kotihakemisto poistettu",
    unix: "Unix-tili poistettu",
  } satisfies Record<Step, string>,
  stepsRunning: {
    archive: "Tehdään arkistoa",
    sessions: "Pysäytetään istuntoja",
    accounts: "Irrotetaan tilejä",
    links: "Poistetaan linkkejä",
    home: "Poistetaan kotihakemistoa",
    unix: "Poistetaan Unix-tiliä",
  } satisfies Record<Step, string>,

  // What removal deletes (the inventory).
  inventory: "Mitä poistetaan",
  home: (path: string, size: string) => [`Kotihakemisto `, path, ` · ${size}`] as const,
  workspaces: (n: number) => `${n} työtilaa:`,
  conversations: (n: number, live: number) =>
    live ? `${n} keskustelua, joista ${live} käynnissä: ne pysähtyvät` : `${n} keskustelua`,
  accounts: (names: string) => `Yhdistetyt tilit: ${names}. Habitat unohtaa tunnukset; ne perutaan myös palvelun omissa asetuksissa.`,
  links: (n: number) => `${n} julkaistua linkkiä lakkaa toimimasta`,
  unixAccount: "Unix-tili ",
  unixNotReused: " ja sen tunniste, jota ei anneta uudelleen",
  short: (n: { ws: number; conv: number; acc: number; links: number }) =>
    `${n.ws} työtilaa, ${n.conv} keskustelua, ${n.acc} yhdistettyä tiliä, ${n.links} julkaistua linkkiä`,

  // 1 Armonaika.
  graceQuestion: (who: string) => `Poista ${who}?`,
  graceAccess: "Pääsy loppuu heti. Avoimet istunnot ja agentit pysähtyvät.",
  graceAccessGone: "Pääsy on jo poistettu.",
  graceWhen: (day: string, days: number) =>
    `Tiedot poistetaan ${day} (${days} pv). Siihen asti voit perua, ja kaikki palaa ennalleen.`,
  graceDisk: (size: string) =>
    `Raja lakkaa varaamasta levyä heti. Kotihakemiston ${size} vapautuu, kun tiedot poistetaan.`,
  graceConfirm: (days: number) => `Poista ${days} pv päästä`,

  // 2 Yksi ikkuna.
  listQuestion: (who: string) => `Poista ${who} ja kaikki tiedot?`,
  cannotUndo: "Poistoa ei voi perua.",
  accessOnly: "Poista vain pääsy",
  deleteNow: "Poista lopullisesti",
  confirmNow: "Vahvista poisto",
  armed: "Paina uudelleen vahvistaaksesi.",
  progressTitle: (who: string) => `Poistetaan ${who}`,
  doneTitle: (who: string) => `${who} poistettu`,
  failedTitle: (who: string) => `${who}: poisto kesken`,
  close: "Sulje",
  doneFreed: (size: string) => `${size} vapautui levyltä.`,

  // 3 Arkisto ensin.
  archiveQuestion: (who: string) => `Poista ${who}?`,
  archiveLead: "Ennen poistoa kotihakemistosta tehdään arkisto palvelimelle.",
  archiveMake: "Tee arkisto ennen poistoa",
  archivePath: (path: string) => ["Arkisto ", path] as const,
  archiveFacts: (size: string, day: string) =>
    `Arvio ${size} · säilyy ${day} asti · vain palvelimen ylläpitäjä pääsee siihen komentorivillä`,
  archiveConfirm: "Arkistoi ja poista",
  noArchiveConfirm: "Poista ilman arkistoa",
  archives: "Arkistot",
  archivesDesc: "Poistettujen henkilöiden kotihakemistot. Eivät kuulu rajojen summaan, mutta vievät levyä.",
  archiveRow: (n: number, size: string, day: string) =>
    `${n} arkisto · ${size} · vanhenee ${day}`,
  noArchives: "Ei arkistoja",

  // Levytila extras.
  sumNote: (before: string, after: string) => `Rajojen summa ${before} → ${after}`,
};

export type Text = typeof fi;

const en: Text = {
  title: "Removing a person",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  lines: [
    "1 Grace period: access ends now and the data is deleted in 7 days; the row shows a countdown and Undo removal.",
    "2 List: the window lists exactly what is deleted; two presses delete it at once, with no undo.",
    "3 Archive: the home directory is archived on the server first, then the data is deleted; the archive can be restored for 30 days.",
  ],
  recommend:
    "Recommendation: 1 Grace period with 2's list. A mistake can be undone for a week, the sum of limits is right at once, and the browser never receives another person's files.",
  hint: "Time and failure:",
  day1: "+1 day",
  day7: "+7 days",
  failNext: "Next removal is interrupted",
  reset: "Start over",
  clock: (d) => `Now ${d}`,

  removePerson: "Remove",
  removePersonNamed: (who) => `Remove ${who}`,
  removeData: "Delete data",
  inGrace: (days) => `Deleted in ${days} ${days === 1 ? "day" : "days"}`,
  graceFact: (day) => `Data is deleted on ${day}`,
  graceNote: "Access removed, data still kept",
  undo: "Undo removal",
  undoNamed: (who) => `Undo removing ${who}`,
  running: "Deleting…",
  archiving: "Archiving…",
  failed: "Removal unfinished",
  retry: "Try again",
  removedMark: "Removed",
  removedFact: (day) => `Person and data removed on ${day}`,
  archiveKept: (day, size) => `Archive of ${size} kept until ${day}`,
  restoreArchive: "Restore from archive",
  noAccessSince: (day) => `Access removed on ${day}`,
  countedByUse: "Reserves no limit: counted by use",
  noLimit: "–",
  stepsDone: (done, all) => `${done} of ${all} steps done`,
  stepFailed: "Deleting the home directory was interrupted: the disk did not respond. The home directory and the Unix account are still on the server, and the person cannot sign in.",
  interrupted: (step) => `${step}: interrupted`,
  steps: {
    archive: "Archive made",
    sessions: "Sessions and agents stopped",
    accounts: "Connected accounts disconnected",
    links: "Published links removed",
    home: "Workspaces and home directory deleted",
    unix: "Unix account removed",
  },
  stepsRunning: {
    archive: "Making the archive",
    sessions: "Stopping sessions",
    accounts: "Disconnecting accounts",
    links: "Removing links",
    home: "Deleting the home directory",
    unix: "Removing the Unix account",
  },

  inventory: "What is deleted",
  home: (path, size) => [`Home directory `, path, ` · ${size}`] as const,
  workspaces: (n) => `${n} workspaces:`,
  conversations: (n, live) =>
    live ? `${n} conversations, ${live} of them running: they stop` : `${n} conversations`,
  accounts: (names) => `Connected accounts: ${names}. Habitat forgets the credentials; revoke them in each service's own settings too.`,
  links: (n) => `${n} published links stop working`,
  unixAccount: "Unix account ",
  unixNotReused: " and its id, which is not given out again",
  short: (n) => `${n.ws} workspaces, ${n.conv} conversations, ${n.acc} connected accounts, ${n.links} published links`,

  graceQuestion: (who) => `Remove ${who}?`,
  graceAccess: "Access ends now. Open sessions and agents stop.",
  graceAccessGone: "Access has already been removed.",
  graceWhen: (day, days) =>
    `The data is deleted on ${day} (${days} days). Until then you can undo, and everything returns as it was.`,
  graceDisk: (size) =>
    `The limit stops reserving disk now. The home directory's ${size} is freed when the data is deleted.`,
  graceConfirm: (days) => `Remove in ${days} days`,

  listQuestion: (who) => `Remove ${who} and all their data?`,
  cannotUndo: "Removal cannot be undone.",
  accessOnly: "Remove access only",
  deleteNow: "Delete permanently",
  confirmNow: "Confirm deletion",
  armed: "Press again to confirm.",
  progressTitle: (who) => `Removing ${who}`,
  doneTitle: (who) => `${who} removed`,
  failedTitle: (who) => `${who}: removal unfinished`,
  close: "Close",
  doneFreed: (size) => `${size} freed on the disk.`,

  archiveQuestion: (who) => `Remove ${who}?`,
  archiveLead: "Before removal the home directory is archived on the server.",
  archiveMake: "Archive before removal",
  archivePath: (path) => ["Archive ", path] as const,
  archiveFacts: (size, day) =>
    `About ${size} · kept until ${day} · only the server's operator can reach it, on the command line`,
  archiveConfirm: "Archive and remove",
  noArchiveConfirm: "Remove without archive",
  archives: "Archives",
  archivesDesc: "Home directories of removed people. Not part of the sum of limits, but they take disk.",
  archiveRow: (n, size, day) => `${n} archive · ${size} · expires ${day}`,
  noArchives: "No archives",

  sumNote: (before, after) => `Sum of limits ${before} → ${after}`,
};

export const TEXT = { fi, en };
