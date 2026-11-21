// The round's own words, Finnish and English. Production pieces (message
// headers, tool rows, the composer, the rail) keep their own catalogs and
// follow the same language choice. People, workspaces, files and times are
// synthetic.
//
// Shared vocabulary with the owner's-view round
// (2026-11-21-multiplayer-owner; record any change in both): Omistaja /
// Owner, Osallistuja / Participant, Luotettu / Trusted, the text-only state
// Vain teksti / Text only, the full state Työkalut käytössä / Tools on, the
// owner's release Voit jatkaa / Go ahead and Hyväksy yksitellen / Approve
// one by one. This view adds the waiting action's Odottaa Ainoa / Waiting
// for Aino.

export type Op = "edit" | "deploy";

const fi = {
  title: "Moninpeli: osallistujan näkymä",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  lines: [
    "1 Kaista: kentän yllä oleva kaista kertoo ennen lähettämistä, mitä agentti saa tehdä seuraavalla vuorolla, ja odottavat toimet.",
    "2 Merkki: jokaisen agentin vastauksen otsikossa on merkki, joka kertoo, kenen viestistä vuoro alkoi ja oliko työkaluja.",
    "3 Kortti: siihen kohtaan, jossa agentti pysähtyi, tulee kortti, jossa jokaisella toimella on oma tilansa. Omistaja näkee saman kortin painikkeineen.",
  ],
  recommend:
    "Suositus: 3 Kortti. Pysähdys näkyy siellä, missä keskustelu on, ja jokainen toimi kertoo oman tilansa. Sama kortti on omistajan hyväksyntäikkunan kohde, joten molemmat puhuvat samasta asiasta.",
  stepsLabel: "Tila",
  steps: { invite: "Kutsu", pending: "Odottaa", continued: "Voit jatkaa", perOp: "Yksitellen", trusted: "Luotettu" },
  events: "Aino:",
  evContinue: "Voit jatkaa",
  evPerOp: "Hyväksyy yksitellen",
  evTrust: "Merkitsee luotetuksi",
  // People.
  you: "Sinä",
  roles: { owner: "Omistaja", trusted: "Luotettu", participant: "Osallistuja" },
  people: "Keskustelussa",
  // Rail.
  shared: "Jaettu kanssasi",
  invited: "Kutsu",
  ownWs: "Omat työtilat",
  convTitle: "Kevään julkaisu",
  byOwner: "Ainon keskustelu",
  // Invite.
  inviteHead: "Aino kutsui sinut keskusteluun",
  inviteFacts: [
    "Agentti on Ainon: se käyttää Ainon mallia, kiintiötä ja yhteyksiä.",
    "Kun sinä kirjoitat, agentti vastaa sinulle vain tekstillä. Toimet tehdään vasta, kun Aino vahvistaa ne.",
    "Näet keskustelun ja sen, mitä agentti teki. Et näe tiedostojen sisältöä etkä komentojen tulosteita.",
  ],
  inviteModel: "Malli",
  join: "Liity",
  notNow: "Ei nyt",
  declined: "Et liittynyt. Kutsu pysyy täällä, kunnes Aino peruu sen.",
  joinedLine: "Liityit keskusteluun.",
  // Thread.
  habitat: "Open Habitat",
  history: {
    aino1: "Päivitetään seuran sivut kevääseen. Ville ja Sanna, kertokaa mitä puuttuu.",
    reply1:
      "Etusivulla on vielä syksyn ohjelma, ja yhteystiedoissa on edellisen sihteerin osoite. Kerro, mitä kevääseen tulee.",
    sanna: "Vaihda yhteystiedoiksi sihteeri@esimerkki.fi.",
    reply2: "Vaihdoin yhteystiedot tiedostoon `src/data/yhteys.json`.",
    ville:
      "Lisää etusivulle kevään tapahtumat: talkoot la 12.4. ja kevätkokous la 26.4. Julkaise sitten sivut.",
    textOnly:
      "Voin tehdä tämän, kun Aino vahvistaa. Tekisin näin:\n\n1. Lisäisin talkoot ja kevätkokouksen tiedostoon `src/data/tapahtumat.json`.\n2. Rakentaisin ja julkaisisin sivut komennolla `npm run deploy`.\n\nTällä vuorolla minulla ei ole työkaluja, koska viimeisin viesti on sinulta.",
    ainoGo: "Voit jatkaa.",
    replyGo: "Lisäsin tapahtumat ja julkaisin sivut. Ne näkyvät nyt etusivulla.",
    replyPerOp:
      "Lisäsin tapahtumat tiedostoon `src/data/tapahtumat.json`. Julkaisu jäi tekemättä, koska Aino ei hyväksynyt sitä tällä kertaa.",
    villeTrusted: "Lisää vielä kevätkokouksen esityslista linkiksi tapahtumaan.",
    replyTrusted: "Lisäsin esityslistan linkin kevätkokouksen tapahtumaan.",
  },
  ops: {
    edit: { verb: "Muokkaa", target: "src/data/tapahtumat.json" },
    deploy: { verb: "Aja", target: "npm run deploy" },
  } satisfies Record<Op, { verb: string; target: string }>,
  opState: {
    waiting: "Odottaa Ainoa",
    approved: "Aino hyväksyi",
    declined: "Aino hylkäsi",
    done: "Tehty",
  },
  hiddenOutput: "Tuloste näkyy vain omistajalle.",
  toolOk: "Valmis",
  // Habitat lines.
  perOpLine: "Aino hyväksyi muokkauksen ja hylkäsi julkaisun.",
  trustedLine: "Aino merkitsi sinut luotetuksi. Viestisi saavat nyt agentin käyttämään työkaluja kuten Ainon viestit.",
  // The tool mode words.
  textOnly: "Vain teksti",
  toolsOn: "Työkalut käytössä",
  pending: "Odottaa omistajan vahvistusta",
  pendingN: (n: number) => (n === 1 ? "1 toimi odottaa Ainon vahvistusta" : `${n} tointa odottaa Ainon vahvistusta`),
  // 1 Kaista.
  stripTextOnly: "Agentti vastaa sinulle tekstillä. Toimet odottavat Ainon vahvistusta.",
  stripTrusted: "Olet luotettu. Agentti käyttää työkaluja myös sinun viesteistäsi.",
  // 2 Merkki.
  badgeTextOnly: (who: string) => `Vain teksti · ${who}`,
  badgeTools: (who: string) => `Työkalut · ${who}`,
  // 3 Kortti.
  cardHead: "Agentti pysähtyi tähän",
  cardLead: "Aino on saanut pyynnön. Toimet tehdään, kun hän vahvistaa ne.",
  cardDone: "Aino vastasi.",
  // Composer.
  placeholderGuest: "Kirjoita Ainon agentille. Se vastaa sinulle tekstillä.",
  placeholderTrusted: "Kirjoita Ainon agentille",
  hint: "Liity kutsusta, kirjoita viesti ja vastaa Ainon puolesta yläpalkista.",
  reset: "Alkutila",
  activity: { waiting: "Odottaa Ainoa", working: "Työskentelee", done: "Valmis" },
  noWorkspace: "Ainon työtila. Tiedostot, editori ja pääte ovat vain Ainolla.",
};

export type Text = typeof fi;

const en: Text = {
  title: "Multiplayer: the participant's view",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  lines: [
    "1 Strip: a strip above the field says before you send what the agent may do on its next turn, and what waits.",
    "2 Badge: every agent reply carries a badge in its header saying whose message started the turn and whether it had tools.",
    "3 Card: where the agent stopped, a card lists each action with its own state. The owner sees the same card with buttons.",
  ],
  recommend:
    "Recommendation: 3 Card. The stop shows where the conversation is, and each action tells its own state. The owner's approval dialog acts on the same card, so both views talk about one thing.",
  stepsLabel: "State",
  steps: { invite: "Invite", pending: "Waiting", continued: "Go ahead", perOp: "One by one", trusted: "Trusted" },
  events: "Aino:",
  evContinue: "Go ahead",
  evPerOp: "Approves one by one",
  evTrust: "Marks you trusted",
  you: "You",
  roles: { owner: "Owner", trusted: "Trusted", participant: "Participant" },
  people: "In this conversation",
  shared: "Shared with you",
  invited: "Invite",
  ownWs: "Your workspaces",
  convTitle: "Spring release",
  byOwner: "Aino's conversation",
  inviteHead: "Aino invited you to a conversation",
  inviteFacts: [
    "The agent is Aino's: it uses Aino's model, quota and connections.",
    "When you write, the agent answers you with text only. Actions happen once Aino confirms them.",
    "You see the conversation and what the agent did. You do not see file contents or command output.",
  ],
  inviteModel: "Model",
  join: "Join",
  notNow: "Not now",
  declined: "You did not join. The invite stays here until Aino withdraws it.",
  joinedLine: "You joined the conversation.",
  habitat: "Open Habitat",
  history: {
    aino1: "Let's update the club's site for spring. Ville and Sanna, tell me what is missing.",
    reply1:
      "The front page still shows the autumn programme, and the contact details have the previous secretary's address. Tell me what spring brings.",
    sanna: "Change the contact to sihteeri@esimerkki.fi.",
    reply2: "I changed the contact details in `src/data/yhteys.json`.",
    ville:
      "Add the spring events to the front page: the work day on Sat 12 Apr and the spring meeting on Sat 26 Apr. Then publish the site.",
    textOnly:
      "I can do this once Aino confirms. This is what I would do:\n\n1. Add the work day and the spring meeting to `src/data/tapahtumat.json`.\n2. Build and publish the site with `npm run deploy`.\n\nI have no tools on this turn because the latest message is yours.",
    ainoGo: "Go ahead.",
    replyGo: "I added the events and published the site. They are on the front page now.",
    replyPerOp:
      "I added the events to `src/data/tapahtumat.json`. Publishing was not done because Aino did not approve it this time.",
    villeTrusted: "Also link the spring meeting's agenda from its event.",
    replyTrusted: "I linked the agenda from the spring meeting's event.",
  },
  ops: {
    edit: { verb: "Edit", target: "src/data/tapahtumat.json" },
    deploy: { verb: "Run", target: "npm run deploy" },
  },
  opState: {
    waiting: "Waiting for Aino",
    approved: "Aino approved",
    declined: "Aino declined",
    done: "Done",
  },
  hiddenOutput: "Only the owner sees the output.",
  toolOk: "Done",
  perOpLine: "Aino approved the edit and declined the publish.",
  trustedLine: "Aino marked you trusted. Your messages now let the agent use tools, as Aino's do.",
  textOnly: "Text only",
  toolsOn: "Tools on",
  pending: "Waiting for the owner",
  pendingN: (n: number) => (n === 1 ? "1 action waits for Aino" : `${n} actions wait for Aino`),
  stripTextOnly: "The agent answers you with text. Actions wait for Aino to confirm.",
  stripTrusted: "You are trusted. The agent uses tools on your messages too.",
  badgeTextOnly: (who: string) => `Text only · ${who}`,
  badgeTools: (who: string) => `Tools · ${who}`,
  cardHead: "The agent stopped here",
  cardLead: "Aino has the request. The actions happen once Aino confirms them.",
  cardDone: "Aino answered.",
  placeholderGuest: "Write to Aino's agent. It answers you with text.",
  placeholderTrusted: "Write to Aino's agent",
  hint: "Join from the invite, write a message, and answer for Aino from the bar.",
  reset: "Reset",
  activity: { waiting: "Waiting for Aino", working: "Working", done: "Done" },
  noWorkspace: "Aino's workspace. Files, editor and terminal are Aino's only.",
};

export const TEXT = { fi, en };
