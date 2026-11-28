// The round's own words. Production words come from web/src/text/multiplayer.ts
// through the production components; these are the new ones the direction
// "own kind of conversation, started with Moninpeli +, always on an API-key
// model" needs. Finnish only: the round is reviewed in Finnish.

export type Who =
  | "aino"
  | "ville"
  | "maija"
  | "pekka"
  | "sanna"
  | "juha"
  | "liisa"
  | "mikko"
  | "tiina"
  | "antti"
  | "elina"
  | "kalle";

export const NAMES: Record<Who, string> = {
  aino: "Aino Laine",
  ville: "Ville Virtanen",
  maija: "Maija Koski",
  pekka: "Pekka Korhonen",
  sanna: "Sanna Niemi",
  juha: "Juha Mäkelä",
  liisa: "Liisa Heikkinen",
  mikko: "Mikko Salo",
  tiina: "Tiina Lehto",
  antti: "Antti Rantanen",
  elina: "Elina Järvinen",
  kalle: "Kalle Kinnunen",
};
export const first = (w: Who) => NAMES[w].split(" ")[0];

export const T = {
  title: "Moninpeli 1",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  scene: "Näkymä",
  scenes: {
    config: "1 Asetukset",
    start: "2 Aloitus",
    owner: "3 Omistaja",
    guest: "4 Osallistuja",
    corner: "5 Kulmat",
  },
  keyState: "AI-avain",
  keyStates: {
    own: "Oma avain",
    server: "Palvelimen avain",
    none: "Ei avainta",
  },
  corner: "Tapaus",
  corners: {
    removed: "Poistettu, pyyntö odottaa",
    away: "Omistaja poissa",
    nokey: "Avain lakkasi toimimasta",
    crowd: "Monta osallistujaa",
    archived: "Arkistoitu",
  },
  viewAs: "Kenen silmin",
  viewAsOwner: "Aino (omistaja)",
  viewAsGuest: "Ville (osallistuja)",
  reset: "Alusta",
  villeWrites: "Ville kirjoittaa",
  maijaWrites: "Maija kirjoittaa",
  ainoAllows: "Aino sallii",
  ainoDeclines: "Aino ei salli",
  lines: [
    "1 Nimetty painike: työtilan otsikossa Uusi keskustelu ja Moninpeli vierekkäin; tavallisen keskustelun otsikossa Moninpeli.",
    "2 Ikoni rivissä: työtilan ikonirivissä + ja ihmiset+ vierekkäin; keskustelun otsikossa sama ikoni.",
    "3 Tyhjässä keskustelussa: Uusi keskustelu avaa tyhjän keskustelun, jonka alussa valitaan Tavallinen tai Moninpeli; myöhemmin otsikon Moninpeli.",
  ],
  hint: "Sama sisältö kaikissa suunnissa; Näkymä valitsee alueen.",

  workspace: "yhdistys-sivut",
  workspacePath: "~/src/yhdistys-sivut",
  // The conversations.
  mpTitle: "Kevätkokouksen sivu",
  ordinaryTitle: "Jäsenrekisterin siivous",
  newMpTitle: "Uusi moninpeli",

  // Moninpeli +.
  mpButton: "Moninpeli",
  mpButtonLabel: "Aloita moninpeli",
  mpButtonConvert: "Tee tästä moninpeli",
  newConversation: "Uusi keskustelu",
  mpMark: "Moninpeli",
  railDetail: (n: number) => `Moninpeli · ${n} ihmistä`,
  railOrdinary: "Valmis",

  // The start choice inside an empty conversation (direction 3).
  emptyKind: "Millainen keskustelu?",
  kindOrdinary: "Tavallinen",
  kindOrdinaryDesc: "Vain sinä ja agentti. Malli on se, jota yleensä käytät.",
  kindMp: "Moninpeli",
  kindMpDesc:
    "Kutsu muita palvelimen ihmisiä. Agentti vastaa jokaiselle, ja sinä päätät, mitä se saa tehdä heidän pyynnöistään.",

  // Start dialog.
  startTitle: "Aloita moninpeli",
  convertTitle: "Tehdäänkö tästä moninpeli?",
  startLead:
    "Moninpelissä kuka tahansa kutsuttu voi kirjoittaa, ja agentti vastaa. Muiden pyynnöistä agentti vastaa ilman työkaluja, kunnes sallit sen jatkaa.",
  convertLead:
    "Keskustelu jatkuu moninpelinä. Historia säilyy, ja kutsutut näkevät sen liityttyään. Tavalliseksi keskusteluksi ei palata.",
  convertModel: (from: string, to: string) =>
    `Malli vaihtuu: ${from} → ${to}. Seuraava vastaus lukee koko historian kerran uudelleen.`,
  nameLabel: "Nimi",
  namePlaceholder: "Nimetön moninpeli",
  modelLabel: "Malli",
  modelHelp:
    "Moninpeli käyttää API-avainta, ei tilaustasi, koska muiden viestit kuluttavat sitä.",
  inviteLabel: "Kutsu",
  inviteLater: "Voit kutsua myös myöhemmin.",
  cancel: "Peruuta",
  start: "Aloita moninpeli",
  convert: "Tee moninpeli",

  // No key.
  noKeyTitle: "Moninpeli tarvitsee API-avaimen",
  noKeyBody:
    "Moninpeliä ei voi ajaa tilauksella, koska muiden viestit kuluttaisivat sitä. Lisää oma API-avain AI-asetuksiin tai pyydä ylläpitäjää sallimaan palvelimen avain moninpeleihin.",
  openAiSettings: "Avaa AI-asetukset",

  // Models (API-key routes only).
  models: {
    "gpt-own": "GPT-5.5 · oma avain",
    "mini-own": "GPT-5.5 mini · oma avain",
    "claude-server": "Claude Sonnet 5.5 · palvelimen avain",
  },
  modelShort: {
    "gpt-own": "GPT-5.5",
    "mini-own": "GPT-5.5 mini",
    "claude-server": "Claude Sonnet 5.5",
  },
  ordinaryModel: "gpt-5.5-codex",

  // Settings.
  settings: "Asetukset",
  aiPage: "AI",
  serverPage: "Palvelin · AI",
  asPerson: "Aino",
  asAdmin: "Ylläpitäjä",
  perspective: "Kenen asetukset",
  credTitle: "AI-tunnukset",
  credSub: "ChatGPT-tilaus",
  credSubDesc: "Tavallisissa keskusteluissa. Ei moninpeleissä.",
  credSubVal: "Yhdistetty",
  credOwn: "Oma OpenAI-avain",
  credOwnDesc: "Tavallisissa keskusteluissa ja moninpeleissä.",
  credOwnVal: "sk-…4f2a",
  credOwnNone: "Ei avainta",
  addKey: "Lisää avain",
  removeKey: "Poista",
  credServer: "Palvelimen avain",
  credServerAllowed: "Ylläpitäjä on sallinut sen moninpeleihin.",
  credServerNot: "Ylläpitäjä ei ole sallinut sitä moninpeleihin.",
  mpTitleSettings: "Moninpeli",
  mpDefault: "Uuden moninpelin malli",
  mpDefaultDesc:
    "Moninpeli käyttää aina API-avainta: omaasi tai palvelimen. Voit valita mallin myös aloittaessa.",
  mpUnavailable: "Moninpeli ei ole käytettävissä",
  mpUnavailableDesc:
    "Lisää oma API-avain tai pyydä ylläpitäjää sallimaan palvelimen avain moninpeleihin.",
  serverKeyTitle: "Palvelimen yhteinen avain",
  serverKey: "Anthropic",
  serverKeyVal: "sk-ant-…91c0",
  serverAllow: "Käyttäjät saavat käyttää tätä avainta moninpeleissä",
  serverAllowDesc:
    "Kulut tulevat palvelimen avaimelle. Jokainen kirjautunut voi aloittaa moninpelin, vaikka hänellä ei ole omaa avainta.",
  serverRunning: "Moninpelejä palvelimen avaimella",
  serverRunningVal: (n: number) => `${n} käynnissä`,
  serverOffNote:
    "Jos poistat luvan, palvelimen avainta käyttävät moninpelit pysähtyvät, kunnes niiden omistaja valitsee toisen avaimen.",

  // Owner's view.
  you: "Sinä",
  owner: "Omistaja",
  present: (n: number) => `${n} paikalla`,
  more: (n: number) => `+${n}`,
  invite: "Kutsu",
  peopleTitle: "Keskustelun ihmiset",
  peopleLead:
    "Agentti, kiintiö ja yhteydet ovat sinun. Osallistujan viesteihin agentti vastaa ilman työkaluja, kunnes sallit sen jatkaa tai annat hänelle täydet oikeudet.",
  here: "Paikalla",
  away: "Poissa",
  invited: "Kutsuttu, ei vielä liittynyt",
  removeFrom: "Poista keskustelusta",
  close: "Sulje",
  placeholder: "Kirjoita viesti agentille",
  ownerDraft: "Lisää sivulle myös kokouksen esityslista.",
  waitingTitle: "Agentti pysähtyi: pyyntö tarvitsee työkaluja",
  requester: (n: string) => `Pyytäjä: ${n}`,
  waitingLead:
    "Agentti vastasi vain tekstillä. Päätä, saako se jatkaa sinun työkaluillasi.",
  waitedFor: (s: string) => `Odottanut ${s}`,
  removedNote: (n: string) =>
    `${n} ei ole enää keskustelussa. Pyyntö odottaa silti päätöstäsi: voit sallia sen tai jättää sikseen.`,
  allowAll: "Salli kaikki",
  approveEach: "Hyväksy yksitellen",
  decline: "Älä salli",
  allow: "Salli",
  deny: "Älä salli",
  allowed: "Sallittu",
  denied: "Et sallinut",
  tool: "Tehty",

  // Habitat lines.
  lineStarted: (m: string) => `Aloitit moninpelin. Malli: ${m}.`,
  lineStartedGuest: (o: string, m: string) =>
    `${o} aloitti moninpelin. Malli: ${m}.`,
  lineConverted: (from: string, to: string) =>
    `Teit keskustelusta moninpelin. Malli vaihtui: ${from} → ${to}.`,
  lineInvited: (n: string) => `Kutsuit: ${n}.`,
  lineArchived: "Arkistoit moninpelin.",

  // Participant's view.
  sharedWithYou: "Jaettu kanssasi",
  invitedBy: (n: string) => `${n} kutsui sinut moninpeliin`,
  inviteWhose: (o: string) =>
    `Agentti on ${o}n. Se vastaa kaikille, jotka kirjoittavat. ${o} päättää, mitä agentti saa tehdä sinun pyyntöjesi pohjalta.`,
  inviteNothing: "Näet keskustelun vasta liityttyäsi.",
  ownerLine: (n: string) => `Omistaja: ${n}`,
  workspaceLine: (n: string) => `Työtila: ${n}`,
  join: "Liity",
  notNow: "Ei nyt",
  stripText: (o: string) =>
    `Agentti vastaa sinulle tekstillä. Työkaluja vaativat toimet odottavat, kunnes ${o} sallii ne.`,
  stripWaiting: (n: number, o: string) =>
    `${n} ${n === 1 ? "pyyntösi odottaa" : "pyyntöäsi odottaa"}: ${o} päättää`,
  stripAway: (o: string) =>
    `${o} ei ole nyt paikalla. Agentti vastaa silti, ja pyyntösi odottaa, kunnes ${o} palaa.`,
  stripNoKey: (o: string) =>
    `Agentti ei voi vastata juuri nyt. Viestisi odottaa, ja ${o} on saanut tiedon.`,
  heldTitle: "Odottaa, kunnes agentti voi vastata",
  cancelHeld: "Peru",
  guestDraft: "Voisitko lisätä myös kartan kokouspaikasta?",
  unavailable: "Keskustelu ei ole saatavilla",
  unavailableRemoved: (o: string) =>
    `${o} poisti sinut keskustelusta. Jo lähettämäsi pyynnöt jäivät hänen päätettävikseen.`,
  unavailableArchived: (o: string) =>
    `${o} arkistoi keskustelun. Se näkyy sinulle taas, jos hän palauttaa sen.`,
  toAll: "Kaikki työtilat",

  // Corner cases.
  noKeyOwnerTitle: "Agentti ei voi vastata: moninpelin avain ei toimi",
  noKeyOwnerDesc:
    "Avain on poistettu tai vanhentunut. Viestit odottavat, ja agentti vastaa niihin, kun valitset toimivan avaimen. Tilaukseesi moninpeli ei siirry.",
  chooseModel: "Valitse malli",
  keyFixed: "Avain vaihdettu",
  archivedTitle: "Arkistoit tämän moninpelin",
  archivedDesc:
    "Muut eivät näe sitä, eikä kukaan voi kirjoittaa. Odottava pyyntö säilyy, ja palautettuna keskustelu jatkuu entisillä ihmisillä.",
  restore: "Palauta",
  awayOwnerNote: (s: string) => `Ville kirjoitti, kun olit poissa · ${s} sitten`,

  // Conversation contents.
  c: {
    a1: "Tehdään kevätkokoukselle oma sivu: aika 14.3. klo 18, paikka seurantalo.",
    r1: "Lisäsin sivun `content/events/kevatkokous.md` ja tarkistin, että sivusto rakentuu.",
    v1: "Lisätkää ilmoittautumislinkki ja julkaiskaa sivu.",
    rv1: "Linkin lisäys ja julkaisu tarvitsevat työkaluja, joten kirjasin ne Ainolle hyväksyttäviksi:\n\n1. lisätä ilmoittautumislinkin sivulle\n2. julkaista sivuston (`npm run deploy`)",
    m1: "Mihin aikaan ovet aukeavat?",
    rm1: "Sivun mukaan kokous alkaa klo 18. Ovien aukeamisaikaa siinä ei vielä ole.",
    released:
      "Lisäsin ilmoittautumislinkin ja julkaisin sivuston. Sivu on nyt osoitteessa `/tapahtumat/kevatkokous`.",
    partial:
      "Lisäsin ilmoittautumislinkin. Julkaisua en tehnyt, koska sitä ei sallittu.",
    ownerReply: "Lisäsin esityslistan sivun loppuun omaksi osiokseen.",
    guestReply:
      "Kartan lisäys tarvitsee työkaluja, joten kirjasin sen Ainolle hyväksyttäväksi.",
    v2: "Voisitko lisätä myös kartan kokouspaikasta?",
    o1: "Siivotaan jäsenrekisteristä kaksoiskappaleet.",
    ro1: "Löysin 14 kaksoiskappaletta ja yhdistin ne. Muutokset ovat tiedostossa `data/jasenet.csv`.",
    crowd: [
      "Kuka hoitaa kahvit?",
      "Voinko tuoda pullaa?",
      "Lisätkää kokouksen esityslista sivulle.",
      "Onko etäosallistuminen mahdollista?",
    ],
    crowdReply:
      "Vastasin kysymyksiin tekstillä. Esityslistan lisäys tarvitsee työkaluja, joten se odottaa Ainoa.",
  },
};
