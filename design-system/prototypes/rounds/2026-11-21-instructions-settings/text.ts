// The round's own words, Finnish and English. Production pieces (Settings,
// message cards, tool rows, the composer) keep their own catalogs and follow
// the same language choice. The person, her GitHub profile and her files are
// synthetic.

export type Lang = "fi" | "en";
export type Scenario = "habitat" | "missing" | "own";
export const SCENARIO_IDS: Scenario[] = ["habitat", "missing", "own"];
export type Choice = { label: string; line: string };
/** The file's sections, in the onboarding template's order. */
export type SectionId = "who" | "lang" | "style" | "ask" | "extra";
export const SECTION_IDS: SectionId[] = ["who", "lang", "style", "ask", "extra"];

const fi = {
  title: "Asetukset › Tili › Ohjeet agentille",
  scenario: "Tilanne",
  scenarios: {
    habitat: "Käyttöönotossa kirjoitetut",
    missing: "Ei vielä ohjeita",
    own: "Itse kirjoitetut",
  } satisfies Record<Scenario, string>,
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö" },
  language: "Kieli",
  reset: "Alkuun",
  lines: [
    "A Luku: ohjeet luettavana tekstinä ja yksi painike, Muokkaa agentin kanssa.",
    "B Teksti: tiedosto sellaisenaan, ja sen voi muokata itse (Muokkaa tekstinä) tai agentin kanssa.",
    "C Osiot: ohjeet osioina (Kuka olen, Kieli, Miten vastaat, Kysy ensin); jokaisen osion voi muuttaa agentin kanssa.",
  ],
  recommend:
    "Suositus: A Luku. Ohjeet näkyvät sellaisina kuin agentti ne lukee, ja muutokset tehdään samalla tavalla kuin käyttöönotossa: agentin kanssa.",
  person: "Aino Laine",
  first: "Aino",
  // The Settings block.
  heading: "Ohjeet agentille",
  rowDesc: "Mitä agentti tietää sinusta jokaisen keskustelun alussa. Pi ja Claude lukevat saman tiedoston.",
  rowKw: ["ohjeet", "instructions", "agents.md", "claude.md", "muisti", "memory", "persoona", "omat ohjeet"],
  intro: "Agentti lukee nämä jokaisen keskustelun alussa, joten samoja asioita ei tarvitse kertoa uudelleen.",
  source: {
    file: "Tiedosto",
    pi: "Pi lukee tämän tiedoston.",
    claudeImports: "Claude lukee sen tiedoston ~/.claude/CLAUDE.md kautta.",
    claudeOwn: "Claude ei lue tätä: tiedostossa ~/.claude/CLAUDE.md on omia ohjeita eikä viittausta tähän.",
    claudeNone: "Claude lukee sen, kun ohjeet on kirjoitettu.",
    modified: (d: string) => `Muokattu ${d}`,
    updatedNow: "Päivitetty juuri",
  },
  dateHabitat: "21.11.2026",
  dateOwn: "3.9.2026",
  dateNow: "tänään",
  ownNote: "Kirjoitit nämä itse. Agentti ei kirjoita niiden päälle: muutokset tulevat lisäyksinä.",
  anywhere: "Voit myös sanoa agentille missä tahansa keskustelussa: ”Lisää ohjeisiini, että…”.",
  editWithAgent: "Muokkaa agentin kanssa",
  writeWithAgent: "Kirjoita agentin kanssa",
  editAsText: "Muokkaa tekstinä",
  writeYourself: "Kirjoita itse",
  missingTitle: "Sinulla ei ole vielä omia ohjeita.",
  missingLead: "Agentti kysyy pari asiaa ja kirjoittaa ne. Nimesi ja kielesi se tietää jo.",
  // B: editing as text.
  editorLabel: "Ohjeet tekstinä",
  save: "Tallenna",
  cancel: "Peru",
  editorNote: "Tallennetaan vain, jos tiedosto ei ole muuttunut sillä välin.",
  savedToast: "Ohjeet tallennettu.",
  // C: sections.
  sectionNames: {
    who: "Kuka olen",
    lang: "Kieli",
    style: "Miten vastaat",
    ask: "Kysy ensin",
    extra: "Muuta",
  } satisfies Record<SectionId, string>,
  notYet: "Ei vielä",
  change: "Muuta",
  add: "Lisää",
  showFile: "Näytä koko tiedosto",
  hideFile: "Piilota tiedosto",
  noSections: "Tiedostossa ei ole osioita, joten se näytetään sellaisenaan.",
  // The conversation.
  convTitle: "Ohjeet agentille",
  home: "Koti",
  composerPlaceholder: "Kirjoita omin sanoin",
  backToSettings: "Takaisin asetuksiin",
  opener: "Haluan muokata ohjeitani.",
  openerSection: (s: string) => `Haluan muuttaa kohtaa ${s}.`,
  openerMissing: "Kirjoitetaan ohjeeni.",
  helloHabitat:
    "Luin ohjeesi. Mitä haluat muuttaa? Valitse alta tai kirjoita omin sanoin.",
  helloOwn:
    "Luin ohjeesi. Kirjoitit ne itse, joten en muuta olemassa olevaa tekstiä; lisään vain uutta loppuun. Huomasin myös, että Claude ei lue niitä nyt. Mitä tehdään?",
  helloMissing:
    "Hei Aino. Tiedän nimesi ja kuvauksesi GitHubista ja kielen siitä, että käytät Habitatia suomeksi. Millaisia vastauksia haluat?",
  helloSection: (s: string, now: string) =>
    now ? `Kohdassa ${s} lukee nyt: ”${now}”. Miten haluat muuttaa sitä?` : `Kohta ${s} on vielä tyhjä. Mitä siihen kirjoitetaan?`,
  proposal: "Tässä muutos. Tallennan sen, kun sanot.",
  proposalNew: "Tässä ohjeesi. Tallennan ne, kun sanot.",
  proposalClaude: "Lisään tämän rivin Clauden tiedoston alkuun. Omiin ohjeisiisi en koske.",
  saveChip: "Tallenna",
  cancelChip: "Älä muuta",
  savedReply: "Tallennettu. Uudet keskustelut käyttävät näitä ohjeita.",
  cancelledReply: "Selvä, en muuttanut mitään.",
  extraReply: "Lisäsin sen kohtaan Muuta.",
  claudeChip: "Lisää viittaus Claudelle",
  newFile: "Uusi tiedosto",
  changeFile: "Muutos",
  saved: "tallennettu",
  choices: {
    style: [
      { label: "Lyhyesti ja suoraan", line: "Vastaa lyhyesti ja suoraan." },
      { label: "Selitä vaiheet", line: "Selitä mitä teet ja miksi; opettelen vielä näitä työkaluja." },
    ],
    ask: [
      { label: "Kysy ennen pushia", line: "Kysy ennen kuin pushaat GitHubiin." },
      { label: "Kysy ennen poistoa", line: "Kysy ennen kuin poistat tiedostoja." },
    ],
  } satisfies Record<"style" | "ask", Choice[]>,
  file: {
    title: "# Aino Laine",
    lead: "Omat ohjeeni agenteille. Muokkaa vapaasti.",
    call: "Puhuttele minua nimellä Aino.",
    bio: "Kirjastonhoitaja. Opettelen Pythonia iltaisin.",
    lang: "Vastaa suomeksi.",
  },
  own: "Olen Aino. Kirjoita lyhyesti.\n\n- Python-koodissa käytä tyyppivihjeitä.\n- Älä koskaan pushaa mainiin.\n- Kirjastotyön termit suomeksi, ohjelmointitermit englanniksi.",
  claudeOwn: "# Clauden ohjeet\n\nKäytä Pythonissa uv:tä.",
};

export type Text = typeof fi;

const en: Text = {
  title: "Settings › Account › Agent instructions",
  scenario: "Situation",
  scenarios: { habitat: "Written in onboarding", missing: "No instructions yet", own: "Written yourself" },
  theme: "Theme",
  themes: { light: "Day", dark: "Night" },
  language: "Language",
  reset: "Start over",
  lines: [
    "A Read: the instructions as readable text and one button, Edit with the agent.",
    "B Text: the file as it is; edit it yourself (Edit as text) or with the agent.",
    "C Sections: the instructions as sections (About me, Language, How to answer, Ask first); change any section with the agent.",
  ],
  recommend:
    "Recommendation: A Read. The instructions appear as the agent reads them, and changes are made the same way as in onboarding: with the agent.",
  person: "Aino Laine",
  first: "Aino",
  heading: "Agent instructions",
  rowDesc: "What the agent knows about you at the start of every conversation. Pi and Claude read the same file.",
  rowKw: fi.rowKw,
  intro: "The agent reads these at the start of every conversation, so you don't need to repeat yourself.",
  source: {
    file: "File",
    pi: "Pi reads this file.",
    claudeImports: "Claude reads it through ~/.claude/CLAUDE.md.",
    claudeOwn: "Claude doesn't read this: ~/.claude/CLAUDE.md has instructions of its own and no reference to this file.",
    claudeNone: "Claude reads it once the instructions are written.",
    modified: (d: string) => `Changed ${d}`,
    updatedNow: "Just updated",
  },
  dateHabitat: "21 Nov 2026",
  dateOwn: "3 Sep 2026",
  dateNow: "today",
  ownNote: "You wrote these yourself. The agent doesn't write over them: changes come as additions.",
  anywhere: "You can also tell the agent in any conversation: “Add to my instructions that…”.",
  editWithAgent: "Edit with the agent",
  writeWithAgent: "Write with the agent",
  editAsText: "Edit as text",
  writeYourself: "Write yourself",
  missingTitle: "You don't have instructions of your own yet.",
  missingLead: "The agent asks a couple of things and writes them. It already knows your name and language.",
  editorLabel: "Instructions as text",
  save: "Save",
  cancel: "Cancel",
  editorNote: "Saved only if the file hasn't changed in the meantime.",
  savedToast: "Instructions saved.",
  sectionNames: { who: "About me", lang: "Language", style: "How to answer", ask: "Ask first", extra: "Other" },
  notYet: "Not yet",
  change: "Change",
  add: "Add",
  showFile: "Show the whole file",
  hideFile: "Hide the file",
  noSections: "The file has no sections, so it is shown as it is.",
  convTitle: "Agent instructions",
  home: "Home",
  composerPlaceholder: "Write in your own words",
  backToSettings: "Back to Settings",
  opener: "I want to edit my instructions.",
  openerSection: (s: string) => `I want to change ${s}.`,
  openerMissing: "Let's write my instructions.",
  helloHabitat: "I read your instructions. What would you like to change? Pick below or write in your own words.",
  helloOwn:
    "I read your instructions. You wrote them yourself, so I won't change the existing text; I only add new things at the end. I also noticed Claude doesn't read them right now. What shall we do?",
  helloMissing:
    "Hi Aino. I know your name and description from GitHub, and your language from using Habitat in English. What kind of answers do you want?",
  helloSection: (s: string, now: string) =>
    now ? `${s} currently says: “${now}”. How would you like to change it?` : `${s} is still empty. What should go there?`,
  proposal: "Here's the change. I'll save it when you say so.",
  proposalNew: "Here are your instructions. I'll save them when you say so.",
  proposalClaude: "I'll add this line at the top of Claude's file. I won't touch your own instructions.",
  saveChip: "Save",
  cancelChip: "Don't change",
  savedReply: "Saved. New conversations use these instructions.",
  cancelledReply: "All right, I didn't change anything.",
  extraReply: "I added it under Other.",
  claudeChip: "Add a reference for Claude",
  newFile: "New file",
  changeFile: "Change",
  saved: "saved",
  choices: {
    style: [
      { label: "Short and direct", line: "Answer briefly and directly." },
      { label: "Explain the steps", line: "Explain what you do and why; I'm still learning these tools." },
    ],
    ask: [
      { label: "Ask before pushing", line: "Ask before you push to GitHub." },
      { label: "Ask before deleting", line: "Ask before you delete files." },
    ],
  },
  file: {
    title: "# Aino Laine",
    lead: "My own instructions for agents. Edit freely.",
    call: "Call me Aino.",
    bio: "Librarian. Learning Python in the evenings.",
    lang: "Answer in English.",
  },
  own: "I'm Aino. Keep it short.\n\n- Use type hints in Python code.\n- Never push to main.\n- Library terms in Finnish, programming terms in English.",
  claudeOwn: "# Claude instructions\n\nUse uv for Python.",
};

export const TEXT: Record<Lang, Text> = { fi, en };
