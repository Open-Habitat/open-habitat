// The round's own words, Finnish and English. Production pieces (Settings,
// message cards, tool rows, the composer, tabs, the conflict card) keep their
// own catalogs and follow the same language choice; the shared editor's
// words are in editor.tsx. The person and her files are synthetic.

export type Lang = "fi" | "en";
export type Scenario = "habitat" | "missing" | "own" | "changed";
export const SCENARIO_IDS: Scenario[] = ["habitat", "missing", "own", "changed"];

const fi = {
  title: "Asetukset › Tili › Ohjeet agentille (kierros 2)",
  scenario: "Tilanne",
  scenarios: {
    habitat: "Käyttöönotossa kirjoitettu",
    missing: "Ei vielä ohjeita",
    own: "Itse kirjoitetut",
    changed: "Muuttuu sillä välin",
  } satisfies Record<Scenario, string>,
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  reset: "Alkuun",
  lines: [
    "B1 Editori ja agentti: muistilappu editorissa (Esikatselu, Muokkaa, Tallenna, Peru); vieressä toissijainen Muokkaa agentin kanssa.",
    "B2 Pelkkä editori: sama editori ilman agentin painiketta; agenttia pyydetään missä tahansa keskustelussa.",
  ],
  recommend:
    "Suositus: B1. Editori riittää omaan tekstiin, mutta tyhjä tiedosto ja Clauden puuttuva viittaus ratkeavat vain agentin kanssa, ja painike ei vaadi hostilta mitään uutta.",
  person: "Aino Laine",
  heading: "Ohjeet agentille",
  rowDesc: "Muistilappu, jonka agentti lukee jokaisen keskustelun alussa. Pi ja Claude lukevat saman tiedoston.",
  rowKw: ["ohjeet", "muistilappu", "instructions", "agents.md", "claude.md", "muisti", "memory", "omat ohjeet"],
  intro: "Muistilappu, jonka agentti lukee jokaisen keskustelun alussa, joten samoja asioita ei tarvitse kertoa uudelleen.",
  source: {
    file: "Tiedosto",
    pi: "Pi lukee tämän tiedoston.",
    claudeImports: "Claude lukee sen tiedoston ~/.claude/CLAUDE.md kautta.",
    claudeOwn: "Claude ei lue tätä: tiedostossa ~/.claude/CLAUDE.md on omia ohjeita eikä viittausta tähän.",
    claudeNone: "Claude lukee sen, kun tiedosto on luotu.",
    notYet: "ei vielä olemassa",
    modified: (d: string) => `Muokattu ${d}`,
    updatedNow: "Päivitetty juuri",
  },
  dateHabitat: "21.11.2026",
  dateOwn: "3.9.2026",
  dateNow: "tänään",
  ownNote: "Kirjoitit nämä itse. Agentti ei kirjoita niiden päälle, vaan lisää muutokset loppuun.",
  claudeFixB2: "Jos haluat, että myös Claude lukee nämä, pyydä agenttia lisäämään viittaus.",
  anywhere: "Voit myös sanoa agentille missä tahansa keskustelussa: ”Lisää muistilappuuni, että…”.",
  editWithAgent: "Muokkaa agentin kanssa",
  writeWithAgent: "Kirjoita agentin kanssa",
  emptyTitle: "Sinulla ei ole vielä muistilappua.",
  emptyLeadB1: "Agentti kysyy pari asiaa ja kirjoittaa sen. Voit myös kirjoittaa itse Muokkaa-välilehdellä.",
  emptyLeadB2: "Kirjoita se Muokkaa-välilehdellä, tai pyydä agenttia kirjoittamaan se missä tahansa keskustelussa.",
  editorLabel: "Ohjeet agentille",
  // The conversation.
  convTitle: "Ohjeet agentille",
  home: "Koti",
  composerPlaceholder: "Kirjoita omin sanoin",
  backToSettings: "Takaisin asetuksiin",
  opener: "Haluan muokata muistilappuani.",
  openerMissing: "Kirjoitetaan muistilappuni.",
  helloHabitat: "Luin muistilappusi. Mitä haluat muuttaa? Valitse alta tai kirjoita omin sanoin.",
  helloOwn:
    "Luin ohjeesi. Kirjoitit ne itse, joten en muuta olemassa olevaa tekstiä; lisään vain uutta loppuun. Huomasin myös, että Claude ei lue niitä nyt. Mitä tehdään?",
  helloMissing: "Hei Aino. Tiedän nimesi ja kuvauksesi GitHubista. Millaisia vastauksia haluat?",
  proposal: "Tässä muutos. Tallennan sen, kun sanot.",
  proposalNew: "Tässä muistilappusi. Tallennan sen, kun sanot.",
  proposalClaude: "Lisään tämän rivin Clauden tiedoston alkuun. Omiin ohjeisiisi en koske.",
  saveChip: "Tallenna",
  cancelChip: "Älä muuta",
  savedReply: "Tallennettu. Uudet keskustelut käyttävät tätä muistilappua.",
  cancelledReply: "Selvä, en muuttanut mitään.",
  claudeChip: "Lisää viittaus Claudelle",
  newFile: "Uusi tiedosto",
  changeFile: "Muutos",
  saved: "tallennettu",
  chips: {
    shorter: { label: "Vastaa lyhyemmin", line: "Vastaa lyhyesti ja suoraan." },
    delete: { label: "Kysy ennen poistoa", line: "Kysy minulta ennen kuin poistat mitään." },
    explain: { label: "Selitä, mitä teet", line: "Kerro, mitä teet ja miksi, sillä opettelen vielä." },
  },
  // The files.
  habitat:
    "# Muistilappu agentille\n\nOlen Aino Laine. Olen kirjastonhoitaja ja opettelen Pythonia iltaisin.\n\nVastaa minulle suomeksi. Kerro, mitä teet ja miksi, sillä opettelen vielä.\n\nKysy minulta ennen kuin julkaiset jotain tai lähetät muutoksia GitHubiin.\n\n## Omin sanoin\n\nAsun Tampereella ja mulla on kaks kissaa. En tykkää pitkistä selityksistä.",
  /** "Muuttuu sillä välin": what the agent wrote in another conversation
   * while the page was open — one line reworded, one added at the end. */
  habitatTheirs:
    "# Muistilappu agentille\n\nOlen Aino Laine. Olen kirjastonhoitaja ja opettelen Pythonia iltaisin.\n\nVastaa minulle suomeksi. Kerro, mitä teet ja miksi, sillä opettelen vielä.\n\nKysy minulta ennen kuin julkaiset jotain, lähetät muutoksia GitHubiin tai poistat tiedostoja.\n\n## Omin sanoin\n\nAsun Tampereella ja mulla on kaks kissaa. En tykkää pitkistä selityksistä.\n\nKäytä Pythonissa uv:tä.",
  newNote: (line: string) => `# Muistilappu agentille\n\nOlen Aino Laine. Olen kirjastonhoitaja ja opettelen Pythonia iltaisin.\n\nVastaa minulle suomeksi. ${line}`,
  own: "Olen Aino. Kirjoita lyhyesti.\n\n- Python-koodissa käytä tyyppivihjeitä.\n- Älä koskaan pushaa mainiin.\n- Kirjastotyön termit suomeksi, ohjelmointitermit englanniksi.",
  claudeOwn: "# Clauden ohjeet\n\nKäytä Pythonissa uv:tä.",
};

export type Text = typeof fi;

const en: Text = {
  title: "Settings › Account › Agent instructions (round 2)",
  scenario: "Situation",
  scenarios: { habitat: "Written in onboarding", missing: "No instructions yet", own: "Written yourself", changed: "Changes meanwhile" },
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  reset: "Start over",
  lines: [
    "B1 Editor and agent: the note in the editor (Preview, Edit, Save, Cancel); beside it a secondary Edit with the agent.",
    "B2 Editor only: the same editor without the agent button; you ask the agent in any conversation.",
  ],
  recommend:
    "Recommendation: B1. The editor is enough for your own text, but an empty file and Claude's missing reference are only solved with the agent, and the button asks nothing new of the host.",
  person: "Aino Laine",
  heading: "Agent instructions",
  rowDesc: "The note the agent reads at the start of every conversation. Pi and Claude read the same file.",
  rowKw: fi.rowKw,
  intro: "The note the agent reads at the start of every conversation, so you don't need to repeat yourself.",
  source: {
    file: "File",
    pi: "Pi reads this file.",
    claudeImports: "Claude reads it through ~/.claude/CLAUDE.md.",
    claudeOwn: "Claude doesn't read this: ~/.claude/CLAUDE.md has instructions of its own and no reference to this file.",
    claudeNone: "Claude reads it once the file exists.",
    notYet: "doesn't exist yet",
    modified: (d: string) => `Changed ${d}`,
    updatedNow: "Just updated",
  },
  dateHabitat: "21 Nov 2026",
  dateOwn: "3 Sep 2026",
  dateNow: "today",
  ownNote: "You wrote these yourself. The agent doesn't write over them; it adds changes at the end.",
  claudeFixB2: "If you want Claude to read these too, ask the agent to add a reference.",
  anywhere: "You can also tell the agent in any conversation: “Add to my note that…”.",
  editWithAgent: "Edit with the agent",
  writeWithAgent: "Write with the agent",
  emptyTitle: "You don't have a note yet.",
  emptyLeadB1: "The agent asks a couple of things and writes it. You can also write it yourself on the Edit tab.",
  emptyLeadB2: "Write it on the Edit tab, or ask the agent to write it in any conversation.",
  editorLabel: "Agent instructions",
  convTitle: "Agent instructions",
  home: "Home",
  composerPlaceholder: "Write in your own words",
  backToSettings: "Back to Settings",
  opener: "I want to edit my note.",
  openerMissing: "Let's write my note.",
  helloHabitat: "I read your note. What would you like to change? Pick below or write in your own words.",
  helloOwn:
    "I read your instructions. You wrote them yourself, so I won't change the existing text; I only add new things at the end. I also noticed Claude doesn't read them right now. What shall we do?",
  helloMissing: "Hi Aino. I know your name and description from GitHub. What kind of answers do you want?",
  proposal: "Here's the change. I'll save it when you say so.",
  proposalNew: "Here's your note. I'll save it when you say so.",
  proposalClaude: "I'll add this line at the top of Claude's file. I won't touch your own instructions.",
  saveChip: "Save",
  cancelChip: "Don't change",
  savedReply: "Saved. New conversations use this note.",
  cancelledReply: "All right, I didn't change anything.",
  claudeChip: "Add a reference for Claude",
  newFile: "New file",
  changeFile: "Change",
  saved: "saved",
  chips: {
    shorter: { label: "Answer more briefly", line: "Answer briefly and directly." },
    delete: { label: "Ask before deleting", line: "Ask me before you delete anything." },
    explain: { label: "Explain what you do", line: "Tell me what you do and why, because I'm still learning." },
  },
  habitat:
    "# A note for my agent\n\nI'm Aino Laine. I'm a librarian and I'm learning Python in the evenings.\n\nAnswer me in English. Tell me what you do and why, because I'm still learning.\n\nAsk me before you publish anything or send changes to GitHub.\n\n## In my own words\n\nI live in Tampere and have two cats. I don't like long explanations.",
  habitatTheirs:
    "# A note for my agent\n\nI'm Aino Laine. I'm a librarian and I'm learning Python in the evenings.\n\nAnswer me in English. Tell me what you do and why, because I'm still learning.\n\nAsk me before you publish anything, send changes to GitHub or delete files.\n\n## In my own words\n\nI live in Tampere and have two cats. I don't like long explanations.\n\nUse uv for Python.",
  newNote: (line: string) => `# A note for my agent\n\nI'm Aino Laine. I'm a librarian and I'm learning Python in the evenings.\n\nAnswer me in English. ${line}`,
  own: "I'm Aino. Keep it short.\n\n- Use type hints in Python code.\n- Never push to main.\n- Library terms in Finnish, programming terms in English.",
  claudeOwn: "# Claude instructions\n\nUse uv for Python.",
};

export const TEXT: Record<Lang, Text> = { fi, en };
