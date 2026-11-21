// The round's own words, Finnish and English. Production pieces (the
// composer, the header, message cards) keep their own catalogs and follow the
// same language choice. The account, people, folders and calendars are
// synthetic.

export type ActionKind = "deleteFolder" | "shareCalendar";
export type IconId = "shieldAsk" | "keyAsk" | "agentAsk" | "hand" | "personCheck";

const fi = {
  title: "Agentti kysyy luvan tilin toimelle",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  iconLabel: "Ikoni",
  lines: [
    "1 Kortti: kysymys on kortti keskustelussa siinä kohdassa, jossa agentti pysähtyi; päätös jää korttiin historiaan.",
    "2 Kenttä: kysymys nousee kirjoituskentän paikalle, keskustelussa on vain rivi; päätöksen jälkeen kenttä palaa.",
    "3 Työkalurivi: kysymys on odottava työkalurivi, jonka alla ovat Salli ja Älä salli; päätös on rivin tila.",
  ],
  recommend:
    "Suositus: 1 Kortti ja ikoni Kilpi ja kysymys. Kortti sanoo toimen ihmisen sanoin ja jää historiaan; kilpi on jo tilien ja oikeuksien merkki asetuksissa.",
  hint: "Synteettinen tili. Tapahtumat: toinen pyyntö.",
  again: "Toinen pyyntö",
  reset: "Alkutila",
  workspace: "kotiasiat",
  convTitle: "Postin ja kalenterin siivous",
  account: "aino.virtanen@contoso.test",
  provider: "Microsoft",
  you: "Sinä",
  composerPlaceholder: "Kirjoita agentille",
  // Header while the agent waits for the answer.
  waiting: "Odottaa lupaasi",
  waitingDetail: (n: number) => (n > 1 ? `${n} kysymystä` : "Agentti on pysähtynyt"),
  working: "Työskentelee",
  // The question.
  asks: "Agentti pyytää lupaa",
  asksShort: "Lupa tilin toimelle",
  onAccount: (acc: string, provider: string) => `${provider}-tilillä ${acc}`,
  allow: "Salli",
  deny: "Älä salli",
  allowed: "Sallit",
  denied: "Et sallinut",
  technical: "Tekninen kutsu",
  inLine: "Agentti odottaa lupaasi",
  inLineDone: (verb: string, what: string) => `${verb}: ${what}`,
  actions: {
    deleteFolder: {
      title: "Poista postikansio ’Laskut 2024’",
      stake: "Kansio ja sen 37 viestiä poistetaan postilaatikosta.",
      short: "postikansion ’Laskut 2024’ poisto",
      tool: "ms-admin · delete-mail-folder",
      args: '{"mailFolderId":"AAMkAGQ5…Laskut2024"}',
    },
    shareCalendar: {
      title: "Jaa kalenteri ’Perhe’ henkilölle Ville Virtanen",
      stake: "ville.virtanen@contoso.test näkee kalenterin tapahtumat ja voi muokata niitä.",
      short: "kalenterin ’Perhe’ jako Villelle",
      tool: "ms-admin · create-calendar-permission",
      args: '{"calendarId":"AAMkAGQ5…Perhe","emailAddress":"ville.virtanen@contoso.test","role":"write"}',
    },
    deleteEvent: {
      title: "Poista tapahtuma ’Hammaslääkäri’ ti 25.11. klo 9.00",
      stake: "Tapahtuma poistuu kalenterista ’Aino’. Siihen ei ole kutsuttu muita.",
      short: "tapahtuman ’Hammaslääkäri’ poisto",
      tool: "ms-calendar · delete-calendar-event",
      args: '{"eventId":"AAMkAGQ5…Hammas"}',
    },
  },
  c: {
    ask: "Poista vanha Laskut 2024 -postikansio, sitä ei enää tarvita. Ja jaa Perhe-kalenteri Villelle niin, että hänkin voi lisätä menoja.",
    lead: "Etsin kansion ja kalenterin.",
    tools: [
      { tool: "ms-mail", target: "list-mail-folders" },
      { tool: "ms-calendar", target: "list-calendars" },
    ],
    toolDone: "valmis",
    toolWaiting: "odottaa lupaa",
    toolDenied: "et sallinut",
    final: (a: boolean, b: boolean) =>
      a && b
        ? "Poistin kansion **Laskut 2024** (37 viestiä) ja jaoin kalenterin **Perhe** Villelle muokattavaksi."
        : a && !b
          ? "Poistin kansion **Laskut 2024**. Perhe-kalenteria en jakanut, koska et sallinut sitä."
          : !a && b
            ? "Jaoin kalenterin **Perhe** Villelle muokattavaksi. Kansiota **Laskut 2024** en poistanut, koska et sallinut sitä."
            : "En tehnyt kumpaakaan, koska et sallinut. Kansio ja kalenteri ovat ennallaan.",
    ask2: "Poista vielä ensi tiistain hammaslääkäri, se on peruttu.",
    final2: (ok: boolean) =>
      ok ? "Poistin tapahtuman **Hammaslääkäri** tiistailta 25.11." : "En poistanut tapahtumaa, koska et sallinut sitä.",
  },
  // Icon sheet.
  sheetTitle: "Ikoniehdokkaat",
  sheetLead: "Jokainen todellisissa koossaan (16, 20 ja 24 px) ja paikoissaan: keskustelun rivi, kortin otsikko ja otsikkopalkin tila.",
  icons: {
    shieldAsk: { name: "Kilpi ja kysymys", why: "Asetusten tilikilven sisarus: sama ääriviiva, huutomerkin tilalla kysymys. Suositus." },
    keyAsk: { name: "Avain ja kysymys", why: "Avain on tunnukset; pieni kysymysmerkki kertoo, että niitä aiotaan käyttää. 16 px:ssä merkki on ahdas." },
    agentAsk: { name: "Agentti kysyy", why: "Agentin pää, silmien paikalla kysymys. Kertoo kuka kysyy, ei mitä on pelissä." },
    hand: { name: "Käsi", why: "Pysähdy-käsi: tunnettu ”odota”, mutta kuulostaa kiellolta eikä kysymykseltä." },
    personCheck: { name: "Sinun hyväksyntäsi", why: "Ihminen ja rasti: korostaa, että päätös on sinun. Lukeutuu helposti ”hyväksytty”-tilaksi." },
  },
  recommended: "Suositus",
};

type Shape = typeof fi;

const en: Shape = {
  title: "The agent asks permission for an account action",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  iconLabel: "Icon",
  lines: [
    "1 Card: the question is a card in the conversation where the agent stopped; the decision stays on the card in history.",
    "2 Field: the question rises where the composer is, the conversation shows one line; after the decision the field returns.",
    "3 Tool row: the question is the waiting tool row with Allow and Don't allow under it; the decision is the row's state.",
  ],
  recommend:
    "Recommendation: 1 Card with the Shield and question icon. The card states the action in plain words and stays in history; the shield already marks accounts and permissions in settings.",
  hint: "Synthetic account. Events: another request.",
  again: "Another request",
  reset: "Start over",
  workspace: "kotiasiat",
  convTitle: "Tidying mail and calendar",
  account: "aino.virtanen@contoso.test",
  provider: "Microsoft",
  you: "You",
  composerPlaceholder: "Write to the agent",
  waiting: "Waiting for your permission",
  waitingDetail: (n: number) => (n > 1 ? `${n} questions` : "The agent has stopped"),
  working: "Working",
  asks: "The agent asks permission",
  asksShort: "Permission for an account action",
  onAccount: (acc: string, provider: string) => `on the ${provider} account ${acc}`,
  allow: "Allow",
  deny: "Don't allow",
  allowed: "You allowed",
  denied: "You didn't allow",
  technical: "Technical call",
  inLine: "The agent is waiting for your permission",
  inLineDone: (verb: string, what: string) => `${verb}: ${what}`,
  actions: {
    deleteFolder: {
      title: "Delete the mail folder ‘Laskut 2024’",
      stake: "The folder and its 37 messages are removed from the mailbox.",
      short: "deleting the mail folder ‘Laskut 2024’",
      tool: "ms-admin · delete-mail-folder",
      args: '{"mailFolderId":"AAMkAGQ5…Laskut2024"}',
    },
    shareCalendar: {
      title: "Share the calendar ‘Perhe’ with Ville Virtanen",
      stake: "ville.virtanen@contoso.test sees the calendar's events and can edit them.",
      short: "sharing the calendar ‘Perhe’ with Ville",
      tool: "ms-admin · create-calendar-permission",
      args: '{"calendarId":"AAMkAGQ5…Perhe","emailAddress":"ville.virtanen@contoso.test","role":"write"}',
    },
    deleteEvent: {
      title: "Delete the event ‘Hammaslääkäri’ Tue 25 Nov at 9:00",
      stake: "The event is removed from the calendar ‘Aino’. Nobody else was invited.",
      short: "deleting the event ‘Hammaslääkäri’",
      tool: "ms-calendar · delete-calendar-event",
      args: '{"eventId":"AAMkAGQ5…Hammas"}',
    },
  },
  c: {
    ask: "Delete the old Laskut 2024 mail folder, it isn't needed any more. And share the Perhe calendar with Ville so he can add things too.",
    lead: "Looking for the folder and the calendar.",
    tools: [
      { tool: "ms-mail", target: "list-mail-folders" },
      { tool: "ms-calendar", target: "list-calendars" },
    ],
    toolDone: "done",
    toolWaiting: "waiting for permission",
    toolDenied: "not allowed",
    final: (a: boolean, b: boolean) =>
      a && b
        ? "I deleted the folder **Laskut 2024** (37 messages) and shared the calendar **Perhe** with Ville for editing."
        : a && !b
          ? "I deleted the folder **Laskut 2024**. I didn't share the Perhe calendar, because you didn't allow it."
          : !a && b
            ? "I shared the calendar **Perhe** with Ville for editing. I didn't delete **Laskut 2024**, because you didn't allow it."
            : "I did neither, because you didn't allow them. The folder and the calendar are unchanged.",
    ask2: "Also delete next Tuesday's dentist, it was cancelled.",
    final2: (ok: boolean) =>
      ok ? "I deleted the event **Hammaslääkäri** on Tuesday 25 Nov." : "I didn't delete the event, because you didn't allow it.",
  },
  sheetTitle: "Icon candidates",
  sheetLead: "Each at its real sizes (16, 20 and 24 px) and in place: the conversation line, the card heading and the header status.",
  icons: {
    shieldAsk: { name: "Shield and question", why: "Sibling of the account shield in settings: same outline, a question instead of the exclamation. Recommended." },
    keyAsk: { name: "Key and question", why: "The key is the credentials; the small question says they are about to be used. Cramped at 16 px." },
    agentAsk: { name: "The agent asks", why: "The agent's head with a question for eyes. Says who asks, not what is at stake." },
    hand: { name: "Hand", why: "A stop hand: a known “wait”, but it reads as a refusal rather than a question." },
    personCheck: { name: "Your approval", why: "A person and a tick: the decision is yours. Easily read as an “approved” state." },
  },
  recommended: "Recommended",
};

export const TEXT = { fi, en };
export type Text = Shape;
