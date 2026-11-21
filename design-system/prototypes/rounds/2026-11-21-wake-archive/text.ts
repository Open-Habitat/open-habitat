// The round's own words, Finnish and English. Production pieces (section
// headings, Hiljaiset, the row's states, the archive notice, the archived
// foot) keep their own catalogs and follow the same language choice.
// Titles, workspaces, notes and times are synthetic.

type Conv = "backup" | "order" | "lease" | "release" | "a11y" | "receipts";

const fi = {
  title: "Arkistointi, kun herätys odottaa",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  lines: [
    "1 Rivillä: arkistointipainikkeen paikalle avautuu pieni vahvistus, joka kertoo perutut herätykset. Ei ikkunaa.",
    "2 Ikkuna: vahvistusikkuna nimeää jokaisen herätyksen ajan, asettajan ja muistiinpanon ja kertoo, ettei palautus tuo niitä takaisin.",
    "3 Heti: arkistoi kysymättä kuten nyt; ilmoitus kertoo, että herätys peruttiin, ja Palauta tuo myös herätyksen takaisin.",
  ],
  recommend:
    "Suositus: 2 Ikkuna. Se on Jarin päättämä vahvistus, ja vain se näyttää, mikä katoaa: ajan ja muistiinpanon. Samaa ikkunaa käyttää jo arkistointi, jossa on avustajia.",
  hint: "Arkistoi rivin painikkeesta (osoitin rivin päällä) tai yläpalkista.",
  reset: "Alkutila",
  conv: {
    backup: "Varakopion poisto",
    order: "Tilauksen seuranta",
    lease: "Vuokrasopimuksen irtisanominen",
    release: "Kevään julkaisu",
    a11y: "Saavutettavuuskatselmointi",
    receipts: "Kuittien nimeäminen",
  } satisfies Record<Conv, string>,
  // Row words (round 1's direction 1, Aika rivillä).
  waitsWake: (at: string) => `Odottaa herätystä ${at}`,
  waitsWakes: (n: number, at: string) => `${n} herätystä, seuraava ${at}`,
  quietReason: "Hiljaisissa pyynnöstäsi",
  // The pending wake below the reply (round 1, direction 1).
  habitat: "Open Habitat",
  wakeSet: (at: string) => `Herätys ${at}`,
  setBy: { person: "pyysit", agent: "agentin oma seuranta" },
  // The confirmations.
  archive: "Arkistoi",
  keep: "Älä arkistoi",
  inlineOne: (at: string) => `Herätys ${at} perutaan.`,
  inlineMany: (n: number, at: string) => `${n} herätystä perutaan, seuraava ${at}.`,
  dialogTitle: "Arkistoi keskustelu",
  dialogLeadOne: "Keskustelussa on odottava herätys. Arkistointi perii sen:",
  dialogLeadMany: (n: number) =>
    `Keskustelussa on ${n} odottavaa herätystä. Arkistointi perii ne:`,
  dialogRule:
    "Agentti ei herää arkistoituun keskusteluun. Jos palautat keskustelun myöhemmin, herätykset eivät palaa; pyydä agenttia asettamaan uusi.",
  dialogConfirm: "Arkistoi ja peru herätys",
  dialogConfirmMany: "Arkistoi ja peru herätykset",
  dialogCancel: "Älä arkistoi",
  // The archive notice's detail.
  noticeOne: (at: string) => `herätys ${at} peruttu`,
  noticeMany: (n: number) => `${n} herätystä peruttu`,
  // Habitat's line in the history and what the agent hears.
  cancelledLine: (list: string) =>
    `Herätys ${list} peruttiin, kun arkistoit keskustelun.`,
  cancelledLineMany: (list: string) =>
    `Herätykset ${list} peruttiin, kun arkistoit keskustelun.`,
  agentHears: "Agentti kuulee sen seuraavan viestisi mukana:",
  agentMessage: (list: string, at: string) =>
    `[Open Habitat] Ajastettu herätys ${list} peruttiin ${at}, kun henkilö arkistoi keskustelun. Keskustelu on palautettu.`,
  agentMessageMany: (list: string, at: string) =>
    `[Open Habitat] Ajastetut herätykset ${list} peruttiin ${at}, kun henkilö arkistoi keskustelun. Keskustelu on palautettu.`,
  activity: { waiting: "Odottaa herätystä", read: "Luettu", done: "Valmis", working: "Työskentelee", archived: "Arkistoitu" },
  weekdays: ["su", "ma", "ti", "ke", "to", "pe", "la"],
  at: "klo",
  and: "ja",
  history: {
    backup: {
      ask: "Muistuta torstaina klo 9 poistamaan vanha varakopio `backup-2024` levyltä.",
      reply:
        "Selvä. Herätän tämän keskustelun torstaina 19.11. klo 9.00 ja muistutan silloin. Siihen asti keskustelu odottaa Hiljaisissa.",
    },
    order: {
      ask: "Tilasin uuden reitittimen. Seuraa, milloin se lähtee liikkeelle.",
      reply:
        "Tilaus on vasta vastaanotettu, seurantakoodia ei vielä ole. Katson huomenna klo 14 uudelleen ja kerron, onko lähetys liikkeellä.",
    },
    lease: {
      ask: "Muistuta 1.12. irtisanomaan varaston vuokrasopimus, irtisanomisaika on kuukausi.",
      reply:
        "Herätän tämän keskustelun 1.12. klo 10.00 ja teen silloin irtisanomisviestin luonnoksen. Katson vielä 4.1., että vuokranantaja on vahvistanut irtisanomisen.",
    },
    release: {
      ask: "Kirjoita kevään julkaisun muutosloki.",
      reply: "Kokoan muutoslokia viimeisistä yhdistämisistä…",
    },
    a11y: {
      ask: "Katso etusivun saavutettavuus.",
      reply:
        "Kaksi korjattavaa: hakukentältä puuttuu nimi ja kontrasti on liian pieni alatunnisteessa.",
    },
    receipts: {
      ask: "Nimeä lokakuun kuitit.",
      reply: "Nimesin 14 kuittia. Siirsin tämän keskustelun Hiljaisiin, kuten pyysit.",
    },
  },
  notes: {
    backup: "Muistuta poistamaan backup-2024",
    order: "Katso, onko lähetys liikkeellä",
    lease1: "Irtisanomisviestin luonnos",
    lease2: "Tarkista, että irtisanominen on vahvistettu",
  },
  toolStatus: "Valmis",
};

export type Text = typeof fi;

const en: Text = {
  title: "Archiving with a pending wake",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  lines: [
    "1 On the row: a small confirmation opens where the archive button was and names the wakes it cancels. No window.",
    "2 Window: a confirmation window names each wake's time, who set it and its note, and says restoring does not bring them back.",
    "3 At once: archives without asking, as today; the notice says the wake was cancelled, and Restore brings the wake back too.",
  ],
  recommend:
    "Recommendation: 2 Window. It is the confirmation Jari decided on, and only it shows what is lost: the time and the note. Archiving with helpers already uses the same window.",
  hint: "Archive from the row's button (pointer over the row) or from the top bar.",
  reset: "Start over",
  conv: {
    backup: "Backup removal",
    order: "Order tracking",
    lease: "Lease termination",
    release: "Spring release",
    a11y: "Accessibility review",
    receipts: "Receipt naming",
  },
  waitsWake: (at) => `Waiting to wake ${at}`,
  waitsWakes: (n, at) => `${n} wakes, next ${at}`,
  quietReason: "In Quiet at your request",
  habitat: "Open Habitat",
  wakeSet: (at) => `Wake ${at}`,
  setBy: { person: "you asked", agent: "the agent's own follow-up" },
  archive: "Archive",
  keep: "Don't archive",
  inlineOne: (at) => `The wake ${at} is cancelled.`,
  inlineMany: (n, at) => `${n} wakes are cancelled, next ${at}.`,
  dialogTitle: "Archive conversation",
  dialogLeadOne: "This conversation has a pending wake. Archiving cancels it:",
  dialogLeadMany: (n) => `This conversation has ${n} pending wakes. Archiving cancels them:`,
  dialogRule:
    "The agent does not wake in an archived conversation. If you restore the conversation later, the wakes do not come back; ask the agent to set a new one.",
  dialogConfirm: "Archive and cancel the wake",
  dialogConfirmMany: "Archive and cancel the wakes",
  dialogCancel: "Don't archive",
  noticeOne: (at) => `wake ${at} cancelled`,
  noticeMany: (n) => `${n} wakes cancelled`,
  cancelledLine: (list) => `The wake ${list} was cancelled when you archived the conversation.`,
  cancelledLineMany: (list) => `The wakes ${list} were cancelled when you archived the conversation.`,
  agentHears: "The agent hears of it with your next message:",
  agentMessage: (list, at) =>
    `[Open Habitat] The scheduled wake ${list} was cancelled ${at}, when the person archived the conversation. The conversation has been restored.`,
  agentMessageMany: (list, at) =>
    `[Open Habitat] The scheduled wakes ${list} were cancelled ${at}, when the person archived the conversation. The conversation has been restored.`,
  activity: { waiting: "Waiting to wake", read: "Read", done: "Done", working: "Working", archived: "Archived" },
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  at: "at",
  and: "and",
  history: {
    backup: {
      ask: "Remind me on Thursday at 9 to delete the old backup `backup-2024` from the disk.",
      reply:
        "Sure. I will wake this conversation on Thursday 19 Nov at 9:00 and remind you then. Until then it waits in Quiet.",
    },
    order: {
      ask: "I ordered a new router. Follow when it ships.",
      reply:
        "The order has only been received; there is no tracking code yet. I will look again tomorrow at 14:00 and tell you whether it has shipped.",
    },
    lease: {
      ask: "Remind me on 1 Dec to terminate the storage lease; the notice period is a month.",
      reply:
        "I will wake this conversation on 1 Dec at 10:00 and draft the notice then. I will also check on 4 Jan that the landlord has confirmed the termination.",
    },
    release: {
      ask: "Write the spring release changelog.",
      reply: "Collecting the changelog from the latest merges…",
    },
    a11y: {
      ask: "Look at the front page's accessibility.",
      reply: "Two fixes: the search field has no name and the footer's contrast is too low.",
    },
    receipts: {
      ask: "Name the October receipts.",
      reply: "I named 14 receipts. I moved this conversation to Quiet, as you asked.",
    },
  },
  notes: {
    backup: "Remind to delete backup-2024",
    order: "See whether it has shipped",
    lease1: "Draft of the termination notice",
    lease2: "Check that the termination is confirmed",
  },
  toolStatus: "Done",
};

export const TEXT = { fi, en };
export type { Conv };
