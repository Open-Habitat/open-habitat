// The round's own words, Finnish and English. Production pieces (the
// onboarding frame, the sign-in card, the repository chooser, the AI offer
// list, message cards, tool rows) keep their own catalogs and follow the
// same language choice. The person, the GitHub profile, the repositories
// and the workspace are synthetic.
//
// Round 3 changes only what the person is told and how the finished file is
// shown. The three variants share the same facts, questions and answers;
// each has its own step title, lead, agent turns and reveal.

export type Choice = {
  /** What the person sees on the button, echoed as their message. */
  label: string;
  /** The line the agent writes into the list-shaped file (A1, A2). */
  line: string;
  /** The same thing as a sentence of the letter (A3). */
  prose: string;
};

/** One variant's own words. */
export type Voice = {
  title: string;
  lead: string;
  leadExisting: string;
  /** The agent's first turn; A3 shows the start of the letter in it. */
  hello: string;
  helloExisting: string;
  /** A2 only: the agent checks what it took from GitHub. */
  confirm?: string;
  confirmYes?: string;
  confirmNo?: string;
  askStyle: string;
  askAsk: string;
  /** The turn that hands over to the reveal. */
  ready: string;
  readyExisting: string;
  added: string;
};

const fi = {
  title: "Ohjeet agentille: sanat ja tiedosto",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  scenario: "Tili",
  scenarios: { fresh: "Uusi tili", existing: "Ohjeet jo olemassa" },
  reset: "Alkuun kirjautumisesta",
  jump: "Hyppää valmiiseen tiedostoon",
  hint: "Synteettinen henkilö, agentin vuorot käsikirjoitettu.",
  lines: [
    "A1 Lyhyesti: kaksi kysymystä vähin sanoin; lopuksi ohjeet luettavana listana, jokaisen kohdan alla mitä se tarkoittaa.",
    "A2 Muistilappu: agentti ei muista keskusteluja, joten tehdään muistilappu; se tarkistaa GitHubin tiedon, ja lappu näytetään selityksin, tiedostona vain pyynnöstä.",
    "A3 Esittely: agentti kirjoittaa sinusta lyhyen esittelyn sinun suullasi; lopuksi esittely on tavallista tekstiä, jota voi muokata itse.",
  ],
  recommend:
    "Suositus: A2 Muistilappu. Sana muistilappu selittää, miksi tämä tehdään, ennen yhtäkään kysymystä, ja lappu näyttää, mitä kukin kohta tarkoittaa.",
  person: "Aino Laine",
  first: "Aino",
  login: "ainolaine",
  workspace: "kotikirjasto",
  stepLabel: "Ohjeet agentille",
  simulate: "Prototyyppi: kirjautuminen valmis",
  eyebrow: "Viimeinen vaihe",
  agent: "Agentti",
  send: "Lähetä",
  fieldPlaceholder: "Tai kirjoita omin sanoin",
  voices: [
    {
      title: "Kerro agentille itsestäsi",
      lead: "Kaksi kysymystä. Agentti muistaa vastaukset jokaisessa keskustelussa.",
      leadExisting: "Sinulla on jo omat ohjeet. Agentti ehdottaa vain lisäyksiä, eikä vanhaan tekstiin kosketa.",
      hello: "Hei Aino. Millaisia vastauksia haluat?",
      helloExisting: "Hei Aino. Luin nykyiset ohjeesi. Niistä puuttuu kaksi asiaa. Millaisia vastauksia haluat?",
      askStyle: "",
      askAsk: "Selvä. Mitä en saa tehdä kysymättä?",
      ready: "Kiitos. Tässä ohjeesi. Lue ne läpi ja tallenna, jos ne ovat oikein.",
      readyExisting: "Kiitos. Tässä ohjeesi lisäysten kanssa. Uudet kohdat on merkitty.",
      added: "Lisäsin sen.",
    },
    {
      title: "Muistilappu agentille",
      lead: "Agentti ei muista aiempia keskusteluja. Tehdään sille muistilappu, jonka se lukee aina ensin: kuka olet ja miten haluat apua.",
      leadExisting: "Sinulla on jo muistilappu. Agentti ehdottaa siihen vain lisäyksiä, eikä vanhaan tekstiin kosketa.",
      hello: "Hei Aino. GitHubin mukaan olet kirjastonhoitaja ja opettelet Pythonia iltaisin.",
      helloExisting: "Hei Aino. Luin nykyisen muistilappusi. GitHubin mukaan olet kirjastonhoitaja ja opettelet Pythonia iltaisin.",
      confirm: "Laitanko sen muistilappuun?",
      confirmYes: "Kyllä, laita",
      confirmNo: "Jätä pois",
      askStyle: "Millaisia vastauksia haluat?",
      askAsk: "Entä mitä en saa tehdä kysymättä?",
      ready: "Valmis. Tältä muistilappusi näyttää. Luen sen joka kerta ennen kuin vastaan.",
      readyExisting: "Valmis. Uudet kohdat on merkitty; vanhat pysyvät ennallaan.",
      added: "Lisäsin sen muistilappuun.",
    },
    {
      title: "Esittele itsesi agentille",
      lead: "Agentti kirjoittaa sinusta lyhyen esittelyn, ikään kuin kertoisit itse. Se lukee esittelyn aina ennen kuin vastaa sinulle.",
      leadExisting: "Sinulla on jo omat ohjeet. Agentti kirjoittaa niiden perään lyhyen esittelyn, eikä vanhaan tekstiin kosketa.",
      hello: "Hei Aino. Kirjoitan esittelyn sinun puolestasi. Se alkaa näin:\n\n> Hei, olen Aino. Olen kirjastonhoitaja ja opettelen Pythonia iltaisin.\n\nMillaisia vastauksia haluat minulta?",
      helloExisting: "Hei Aino. Luin nykyiset ohjeesi. Lisään niiden perään esittelyn, joka alkaa näin:\n\n> Hei, olen Aino. Olen kirjastonhoitaja ja opettelen Pythonia iltaisin.\n\nMillaisia vastauksia haluat minulta?",
      askStyle: "",
      askAsk: "Onko jotain, mitä en saa tehdä kysymättä?",
      ready: "Tässä koko esittely. Voit muokata sitä itse ennen kuin tallennat.",
      readyExisting: "Tässä esittely nykyisten ohjeidesi perässä. Voit muokata sitä itse.",
      added: "Lisäsin sen esittelyyn.",
    },
  ] satisfies Voice[],
  choices: {
    style: [
      { label: "Lyhyesti ja suoraan", line: "Vastaa lyhyesti ja suoraan.", prose: "Vastaa minulle lyhyesti ja suoraan." },
      { label: "Selitä, mitä teet", line: "Selitä, mitä teet ja miksi. Opettelen vielä.", prose: "Kerro, mitä teet ja miksi, sillä opettelen vielä." },
      { label: "Kysy, jos epäselvää", line: "Kysy, jos pyyntöni on epäselvä. Älä arvaa.", prose: "Jos pyyntöni on epäselvä, kysy äläkä arvaa." },
    ],
    ask: [
      { label: "Ennen kuin julkaiset jotain", line: "Kysy ennen kuin julkaiset jotain tai lähetät muutoksia GitHubiin.", prose: "Kysy minulta ennen kuin julkaiset jotain tai lähetät muutoksia GitHubiin." },
      { label: "Ennen kuin poistat jotain", line: "Kysy ennen kuin poistat mitään.", prose: "Kysy minulta ennen kuin poistat mitään." },
      { label: "Saat toimia vapaasti", line: "Saat toimia vapaasti, kunhan kerrot jälkeenpäin, mitä teit.", prose: "Saat toimia vapaasti, kunhan kerrot jälkeenpäin, mitä teit." },
    ],
  } satisfies Record<"style" | "ask", Choice[]>,
  // The list-shaped file (A1, A2).
  file: {
    title: (n: string) => `# ${n}`,
    lead: "Ohjeeni agentille. Saat muuttaa näitä milloin vain.",
    who: "Kuka olen",
    lang: "Kieli",
    style: "Miten vastaat",
    ask: "Kysy ensin",
    extra: "Muuta",
    name: (n: string) => `Nimeni on ${n}.`,
    work: "Kirjastonhoitaja. Opettelen Pythonia iltaisin.",
    lang1: "Puhu minulle suomea.",
  },
  // The letter (A3).
  letter: {
    hello: (n: string) => `Hei, olen ${n}.`,
    work: "Olen kirjastonhoitaja ja opettelen Pythonia iltaisin.",
    lang: "Puhu minulle suomea.",
  },
  existing: "# Omat ohjeet\n\n- Vastaa suomeksi.\n- Käytä Pythonissa tyyppivihjeitä.",
  // A1: what each part means, under its heading.
  means: {
    who: "Agentti tietää, kuka olet ja mitä teet. Tiedot tulivat GitHub-profiilistasi.",
    lang: "Agentti vastaa suomeksi, koska käytät Habitatia suomeksi.",
    style: "Näin agentti vastaa sinulle.",
    ask: "Tätä agentti ei tee ilman lupaasi.",
    extra: "Mitä kirjoitit omin sanoin.",
  },
  // A2: the same, as short notes in the margin.
  margin: {
    who: "Siksi agentti tietää, kenen kanssa puhuu. GitHubista.",
    lang: "Siksi vastaukset tulevat suomeksi.",
    style: "Siksi vastaukset ovat tällaisia.",
    ask: "Tähän agentti pyytää aina lupasi.",
    extra: "Omin sanoin.",
  },
  revealDoc: "Ohjeesi",
  revealNote: "Muistilappu",
  revealLetter: "Esittelysi",
  keptLabel: "Nykyiset ohjeesi",
  newMark: "uusi",
  asFile: "Näytä tiedostona",
  asNote: "Näytä muistilappuna",
  edit: "Muokkaa itse",
  editDone: "Valmis",
  letterWhatTitle: "Mitä tämä on?",
  letterWhat:
    "Agentti lukee tämän esittelyn aina ennen kuin vastaa sinulle, joten sinun ei tarvitse kertoa samoja asioita uudelleen. Voit muuttaa sitä milloin vain.",
  later: "Tee myöhemmin",
  keep: "Jätä ennalleen",
  save: "Tallenna",
  saveMerge: "Lisää ohjeisiin",
  // Past the step.
  doneSaved: "Valmis",
  doneMerged: "Ohjeet täydennetty",
  doneSavedLead:
    "Agentti lukee ohjeesi jokaisen keskustelun alussa. Voit muuttaa niitä milloin vain: pyydä agenttia missä tahansa keskustelussa tai avaa Asetukset › Tili › Ohjeet agentille.",
  doneLater: "Voit tehdä tämän myöhemmin",
  doneLaterLead:
    "Mitään ei tallennettu. Kun haluat, pyydä agenttia kirjoittamaan ohjeet missä tahansa keskustelussa tai avaa Asetukset › Tili › Ohjeet agentille.",
  doneKept: "Ohjeesi pysyivät ennallaan",
  doneKeptLead: "Mitään ei muutettu. Voit täydentää ohjeita milloin vain kohdasta Asetukset › Tili › Ohjeet agentille.",
  where: "Missä ohjeet ovat?",
  whereText: "Tiedostossa ~/.pi/agent/AGENTS.md. Claude lukee saman tiedoston, koska ~/.claude/CLAUDE.md viittaa siihen.",
  wrote: "kirjoitettu",
  enter: "Siirry Habitatiin",
  notes: { saved: "Tallennettu", merged: "Täydennetty", later: "Myöhemmin", kept: "Ennallaan" },
  homeTitle: "Työtilat",
  homeMeta: "Kloonattu käyttöönotossa",
};

export type Text = typeof fi;

const en: Text = {
  title: "Agent instructions: the words and the file",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  scenario: "Account",
  scenarios: { fresh: "New account", existing: "Instructions exist" },
  reset: "Restart from sign-in",
  jump: "Jump to the finished file",
  hint: "Synthetic person, the agent's turns are scripted.",
  lines: [
    "A1 Brief: two questions in few words; at the end the instructions as a readable list, what each part means under it.",
    "A2 Note: the agent doesn't remember conversations, so you make it a note; it checks what it took from GitHub, and the note is shown with explanations, as a file only on request.",
    "A3 Introduction: the agent writes a short introduction of you in your own voice; at the end it is plain text you can edit yourself.",
  ],
  recommend:
    "Recommendation: A2 Note. The word note explains why this is done before any question, and the note shows what each part means.",
  person: "Aino Laine",
  first: "Aino",
  login: "ainolaine",
  workspace: "kotikirjasto",
  stepLabel: "Agent instructions",
  simulate: "Prototype: signed in",
  eyebrow: "Last step",
  agent: "Agent",
  send: "Send",
  fieldPlaceholder: "Or write in your own words",
  voices: [
    {
      title: "Tell the agent about yourself",
      lead: "Two questions. The agent remembers the answers in every conversation.",
      leadExisting: "You already have your own instructions. The agent only suggests additions and leaves your text alone.",
      hello: "Hi Aino. What kind of answers do you want?",
      helloExisting: "Hi Aino. I read your current instructions. Two things are missing. What kind of answers do you want?",
      askStyle: "",
      askAsk: "Got it. What must I not do without asking?",
      ready: "Thanks. Here are your instructions. Read them through and save if they're right.",
      readyExisting: "Thanks. Here are your instructions with the additions. The new parts are marked.",
      added: "Added it.",
    },
    {
      title: "A note for your agent",
      lead: "The agent doesn't remember earlier conversations. Let's make it a note it always reads first: who you are and how you want help.",
      leadExisting: "You already have a note. The agent only suggests additions and leaves your text alone.",
      hello: "Hi Aino. According to GitHub you're a librarian learning Python in the evenings.",
      helloExisting: "Hi Aino. I read your current note. According to GitHub you're a librarian learning Python in the evenings.",
      confirm: "Shall I put that on the note?",
      confirmYes: "Yes, put it on",
      confirmNo: "Leave it out",
      askStyle: "What kind of answers do you want?",
      askAsk: "And what must I not do without asking?",
      ready: "Done. This is your note. I read it every time before I answer.",
      readyExisting: "Done. The new parts are marked; the old ones stay as they are.",
      added: "Added it to the note.",
    },
    {
      title: "Introduce yourself to the agent",
      lead: "The agent writes a short introduction of you, as if you told it yourself. It reads it every time before it answers you.",
      leadExisting: "You already have your own instructions. The agent writes a short introduction after them and leaves your text alone.",
      hello: "Hi Aino. I'll write the introduction for you. It starts like this:\n\n> Hi, I'm Aino. I'm a librarian and I'm learning Python in the evenings.\n\nWhat kind of answers do you want from me?",
      helloExisting: "Hi Aino. I read your current instructions. I'll add an introduction after them that starts like this:\n\n> Hi, I'm Aino. I'm a librarian and I'm learning Python in the evenings.\n\nWhat kind of answers do you want from me?",
      askStyle: "",
      askAsk: "Is there anything I must not do without asking?",
      ready: "Here's the whole introduction. You can edit it yourself before you save.",
      readyExisting: "Here's the introduction after your current instructions. You can edit it yourself.",
      added: "Added it to the introduction.",
    },
  ],
  choices: {
    style: [
      { label: "Short and direct", line: "Answer briefly and directly.", prose: "Answer me briefly and directly." },
      { label: "Explain what you do", line: "Explain what you do and why. I'm still learning.", prose: "Tell me what you do and why, because I'm still learning." },
      { label: "Ask when unclear", line: "Ask when my request is unclear. Don't guess.", prose: "If my request is unclear, ask instead of guessing." },
    ],
    ask: [
      { label: "Before publishing anything", line: "Ask before you publish anything or send changes to GitHub.", prose: "Ask me before you publish anything or send changes to GitHub." },
      { label: "Before deleting anything", line: "Ask before you delete anything.", prose: "Ask me before you delete anything." },
      { label: "Act freely", line: "Act freely, as long as you tell me afterwards what you did.", prose: "Act freely, as long as you tell me afterwards what you did." },
    ],
  },
  file: {
    title: (n: string) => `# ${n}`,
    lead: "My instructions for the agent. I may change them any time.",
    who: "Who I am",
    lang: "Language",
    style: "How to answer",
    ask: "Ask first",
    extra: "Other",
    name: (n: string) => `My name is ${n}.`,
    work: "Librarian. Learning Python in the evenings.",
    lang1: "Speak English with me.",
  },
  letter: {
    hello: (n: string) => `Hi, I'm ${n}.`,
    work: "I'm a librarian and I'm learning Python in the evenings.",
    lang: "Speak English with me.",
  },
  existing: "# My instructions\n\n- Answer in English.\n- Use type hints in Python.",
  means: {
    who: "The agent knows who you are and what you do. This came from your GitHub profile.",
    lang: "The agent answers in English, because you use Habitat in English.",
    style: "This is how the agent answers you.",
    ask: "The agent won't do this without your permission.",
    extra: "What you wrote in your own words.",
  },
  margin: {
    who: "So the agent knows who it's talking to. From GitHub.",
    lang: "So the answers come in English.",
    style: "So the answers are like this.",
    ask: "The agent always asks you first.",
    extra: "In your own words.",
  },
  revealDoc: "Your instructions",
  revealNote: "Note",
  revealLetter: "Your introduction",
  keptLabel: "Your current instructions",
  newMark: "new",
  asFile: "Show as a file",
  asNote: "Show as a note",
  edit: "Edit it yourself",
  editDone: "Done",
  letterWhatTitle: "What is this?",
  letterWhat:
    "The agent reads this introduction every time before it answers you, so you don't have to tell it the same things again. You can change it any time.",
  later: "Do this later",
  keep: "Leave as is",
  save: "Save",
  saveMerge: "Add to my instructions",
  doneSaved: "All set",
  doneMerged: "Instructions extended",
  doneSavedLead:
    "The agent reads your instructions at the start of every conversation. Change them any time: ask the agent in any conversation or open Settings › Account › Agent instructions.",
  doneLater: "You can do this later",
  doneLaterLead:
    "Nothing was saved. When you want, ask the agent to write your instructions in any conversation or open Settings › Account › Agent instructions.",
  doneKept: "Your instructions stayed as they were",
  doneKeptLead: "Nothing was changed. You can extend them any time from Settings › Account › Agent instructions.",
  where: "Where are the instructions?",
  whereText: "In the file ~/.pi/agent/AGENTS.md. Claude reads the same file, because ~/.claude/CLAUDE.md points to it.",
  wrote: "written",
  enter: "Go to Habitat",
  notes: { saved: "Saved", merged: "Extended", later: "Later", kept: "Unchanged" },
  homeTitle: "Workspaces",
  homeMeta: "Cloned during onboarding",
};

export const TEXT = { fi, en };
