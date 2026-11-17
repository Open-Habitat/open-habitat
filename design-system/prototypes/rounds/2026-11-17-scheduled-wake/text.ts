// The round's own words, Finnish and English. Production pieces (section
// headings, Hiljaiset, the row's states) keep their own catalogs and follow
// the same language choice. Titles, workspaces, commands and times are
// synthetic.

type Conv =
  | "backup"
  | "order"
  | "lease"
  | "invoices"
  | "release"
  | "a11y"
  | "receipts";

const fi = {
  title: "Ajastettu herätys",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  lines: [
    "Nyt: agentti voi siirtää keskustelun Hiljaisiin, mutta ei herätä sitä. Muistutus jää ihmisen muistettavaksi.",
    "1 Aika rivillä: odottava rivi pysyy Hiljaisissa, ja sen lopussa näkyy herätysaika iän paikalla. Herätystä muutetaan tai se perutaan keskustelussa agentin vastauksen alla.",
    "2 Herätykset-osio: ajastetut keskustelut kootaan Hiljaisten yläpuolelle omaan osioonsa herätysajan mukaan. Odottava herätys on keskustelun alareunassa kiinnitettynä palkkina.",
    "3 Kello merkissä: rivi näyttää muilta hiljaisilta, mutta merkin asukas on kellon viisari. Aika ja muutokset ovat keskustelun yläpalkissa, tilan vieressä.",
  ],
  recommend:
    "Suositus: 1 Aika rivillä. Aika on se, mitä ihminen haluaa tietää, ja se luetaan suoraan rivistä myös puhelimessa ilman hoveria. Muutos ja peruminen ovat siellä, missä herätys asetettiin, joten keskustelu kertoo koko tarinan.",
  clockLabel: "Kello",
  advance: "Seuraava herätys",
  noMore: "Ei odottavia herätyksiä",
  serverDown: "Palvelin pois 7.40–10.35",
  reset: "Alkutila",
  conv: {
    backup: "Varakopion poisto",
    order: "Tilauksen seuranta",
    lease: "Vuokrasopimuksen irtisanominen",
    invoices: "Laskujen eräpäivät",
    release: "Kevään julkaisu",
    a11y: "Saavutettavuuskatselmointi",
    receipts: "Kuittien nimeäminen",
  } satisfies Record<Conv, string>,
  // Row and header words.
  waitsWake: (at: string) => `Odottaa herätystä ${at}`,
  wokeAt: (at: string) => `Herätetty ${at}`,
  wokeLate: (due: string, at: string) =>
    `Herätys ${due} myöhästyi, herätetty ${at}`,
  wakeSection: "Herätykset",
  quietReason: "Hiljaisissa pyynnöstäsi",
  // The conversation.
  habitat: "Open Habitat",
  wakeSet: (at: string) => `Herätys ${at}`,
  wakeSetBy: { person: "pyysit", agent: "agentin oma seuranta" },
  change: "Muuta",
  cancel: "Peru herätys",
  save: "Tallenna",
  keep: "Älä muuta",
  newTime: "Uusi herätysaika",
  cancelled: (at: string) =>
    `Peruit herätyksen ${at}. Agentti kuulee sen seuraavalla kerralla, kun kirjoitat.`,
  changed: (from: string, to: string) =>
    `Siirsit herätyksen ${from} → ${to}. Agentti kuulee sen herätessään.`,
  woke: (at: string, set: string) =>
    `Ajastettu herätys ${at}. Herätys asetettiin ${set}.`,
  wokeLateLine: (due: string, at: string, down: string) =>
    `Ajastettu herätys ${due} tapahtui vasta ${at}, koska palvelin oli poissa käytöstä ${down}.`,
  menuLabel: "Herätys",
  menuChange: "Muuta aikaa…",
  menuCancel: "Peru herätys",
  activity: {
    waiting: "Odottaa herätystä",
    reply: "Uusi vastaus",
    read: "Luettu",
    done: "Valmis",
    working: "Työskentelee",
  },
  weekdays: ["su", "ma", "ti", "ke", "to", "pe", "la"],
  tomorrow: "huomenna",
  today: "tänään",
  at: "klo",
  history: {
    backup: {
      ask: "Muistuta torstaina klo 9 poistamaan vanha varakopio `backup-2024` levyltä.",
      reply:
        "Selvä. Herätän tämän keskustelun torstaina 19.11. klo 9.00 ja muistutan silloin. Siihen asti keskustelu odottaa Hiljaisissa.",
      replyNow:
        "En pysty herättämään itseäni myöhemmin, joten en voi muistuttaa torstaina. Laita muistutus kalenteriin, niin hoidan poiston, kun kirjoitat.",
      woke: "Muistutus: vanha varakopio `backup-2024` on yhä levyllä (412 Gt). Tarkistin, että uusin kopio `backup-2026-11-18` on ehjä. Poistetaanko vanha nyt?",
    },
    order: {
      ask: "Tilasin uuden reitittimen. Seuraa, milloin se lähtee liikkeelle.",
      reply:
        "Tilaus on vasta vastaanotettu, seurantakoodia ei vielä ole. Katson huomenna klo 14 uudelleen ja kerron, onko lähetys liikkeellä.",
      woke: "Lähetys on liikkeellä: seurantakoodi `JJFI6402…`, arvioitu toimitus pe 20.11. Laitanko muistutuksen noutoon?",
    },
    lease: {
      ask: "Muistuta 1.12. irtisanomaan varaston vuokrasopimus, irtisanomisaika on kuukausi.",
      reply:
        "Herätän tämän keskustelun 1.12. klo 10.00. Silloin teen irtisanomisviestin luonnoksen valmiiksi.",
      woke: "Irtisanomisviestin luonnos on valmis tiedostossa `irtisanominen.md`. Lähetätkö sen itse vai lähetänkö?",
    },
    invoices: {
      ask: "Tarkista aamulla klo 8, onko marraskuun laskuissa erääntyviä.",
      reply: "Herätän tämän keskustelun tänään klo 8.00 ja käyn laskut läpi.",
      woke: "Kaksi laskua erääntyy tällä viikolla: sähkö 64,20 € (to) ja vakuutus 212,00 € (pe). Muut on maksettu.",
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
      reply:
        "Nimesin 14 kuittia. Siirsin tämän keskustelun Hiljaisiin, kuten pyysit.",
    },
  },
  toolStatus: "Valmis",
  phoneMenu: "Puhelimessa sivupalkki aukeaa valikosta.",
};

export type Text = typeof fi;

const en: Text = {
  title: "Scheduled wake",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  lines: [
    "Now: the agent can move the conversation to Quiet but cannot wake it. The person has to remember the reminder.",
    "1 Time on the row: the waiting row stays in Quiet and shows its wake time where its age would be. The wake is changed or cancelled in the conversation, below the agent's reply.",
    "2 Wakes section: scheduled conversations gather above Quiet in a section of their own, ordered by wake time. A pending wake is a bar pinned at the conversation's foot.",
    "3 Clock in the mark: the row looks like any quiet row, but the mark's resident is a clock hand. The time and its changes are in the conversation's header, beside the state.",
  ],
  recommend:
    "Recommendation: 1 Time on the row. The time is what the person wants to know, and it reads straight off the row, on a phone too, without hover. Change and cancel sit where the wake was set, so the conversation tells the whole story.",
  clockLabel: "Clock",
  advance: "Next wake",
  noMore: "No pending wakes",
  serverDown: "Server off 7:40–10:35",
  reset: "Start over",
  conv: {
    backup: "Backup removal",
    order: "Order tracking",
    lease: "Lease termination",
    invoices: "Invoice due dates",
    release: "Spring release",
    a11y: "Accessibility review",
    receipts: "Receipt naming",
  },
  waitsWake: (at) => `Waiting to wake ${at}`,
  wokeAt: (at) => `Woken ${at}`,
  wokeLate: (due, at) => `Wake ${due} was late, woken ${at}`,
  wakeSection: "Wakes",
  quietReason: "In Quiet at your request",
  habitat: "Open Habitat",
  wakeSet: (at) => `Wake ${at}`,
  wakeSetBy: { person: "you asked", agent: "the agent's own follow-up" },
  change: "Change",
  cancel: "Cancel wake",
  save: "Save",
  keep: "Keep",
  newTime: "New wake time",
  cancelled: (at) =>
    `You cancelled the wake ${at}. The agent hears of it the next time you write.`,
  changed: (from, to) =>
    `You moved the wake ${from} → ${to}. The agent hears of it when it wakes.`,
  woke: (at, set) => `Scheduled wake ${at}. The wake was set ${set}.`,
  wokeLateLine: (due, at, down) =>
    `Scheduled wake ${due} happened only ${at}, because the server was off ${down}.`,
  menuLabel: "Wake",
  menuChange: "Change time…",
  menuCancel: "Cancel wake",
  activity: {
    waiting: "Waiting to wake",
    reply: "New reply",
    read: "Read",
    done: "Done",
    working: "Working",
  },
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  tomorrow: "tomorrow",
  today: "today",
  at: "at",
  history: {
    backup: {
      ask: "Remind me on Thursday at 9 to delete the old backup `backup-2024` from the disk.",
      reply:
        "Sure. I will wake this conversation on Thursday 19 Nov at 9:00 and remind you then. Until then it waits in Quiet.",
      replyNow:
        "I cannot wake myself later, so I cannot remind you on Thursday. Put a reminder in your calendar and I will delete it when you write.",
      woke: "Reminder: the old backup `backup-2024` is still on the disk (412 GB). I checked that the newest copy `backup-2026-11-18` is intact. Delete the old one now?",
    },
    order: {
      ask: "I ordered a new router. Follow when it ships.",
      reply:
        "The order has only been received; there is no tracking code yet. I will look again tomorrow at 14:00 and tell you whether it has shipped.",
      woke: "It has shipped: tracking code `JJFI6402…`, expected Fri 20 Nov. Shall I set a reminder for the pickup?",
    },
    lease: {
      ask: "Remind me on 1 Dec to terminate the storage lease; the notice period is a month.",
      reply:
        "I will wake this conversation on 1 Dec at 10:00 and have a draft of the notice ready then.",
      woke: "The draft notice is ready in `irtisanominen.md`. Will you send it, or shall I?",
    },
    invoices: {
      ask: "Check in the morning at 8 whether any November invoices fall due.",
      reply: "I will wake this conversation today at 8:00 and go through the invoices.",
      woke: "Two invoices fall due this week: electricity €64.20 (Thu) and insurance €212.00 (Fri). The rest are paid.",
    },
    release: {
      ask: "Write the spring release changelog.",
      reply: "Collecting the changelog from the latest merges…",
    },
    a11y: {
      ask: "Look at the front page's accessibility.",
      reply:
        "Two fixes: the search field has no name and the footer's contrast is too low.",
    },
    receipts: {
      ask: "Name the October receipts.",
      reply:
        "I named 14 receipts. I moved this conversation to Quiet, as you asked.",
    },
  },
  toolStatus: "Done",
  phoneMenu: "On a phone the rail opens from the menu.",
};

export const TEXT = { fi, en };
export type { Conv };
