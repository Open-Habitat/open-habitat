// The round's own words, Finnish and English. Production pieces (the
// onboarding frame, the sign-in card, the repository chooser, the AI offer
// list, message cards, tool rows, tabs) keep their own catalogs and follow
// the same language choice; the shared editor's words are in
// ../2026-11-21-instructions-settings-2/editor.tsx. The person, the GitHub
// profile, the repositories and the workspace are synthetic.
//
// Round 4: the words are round 3's A2 Muistilappu, the file is round 3's A3
// free-form text the person can edit, and two things are new: a step for the
// person's own words and a choice of the language the agent answers in.

export type Choice = {
  /** What the person sees on the button, echoed as their message. */
  label: string;
  /** The same thing as a sentence of the note. */
  prose: string;
};
export type AnswerLang = "fi" | "en" | "sv";
export const ANSWER_LANGS: AnswerLang[] = ["fi", "en", "sv"];

const fi = {
  title: "Ohjeet agentille: muistilappu omin sanoin",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  scenario: "Tili",
  scenarios: { fresh: "Uusi tili", existing: "Ohjeet jo olemassa" },
  reset: "Alkuun kirjautumisesta",
  jump: "Hyppää valmiiseen lappuun",
  hint: "Synteettinen henkilö, agentin vuorot käsikirjoitettu.",
  lines: [
    "A4.1 Keskustelu: kieli on agentin ensimmäinen kysymys ja omat sanat viimeinen; lappu näytetään lopuksi editorissa.",
    "A4.2 Ensin itse: ensin kirjoitat itse ja valitset kielen, sitten agentti kysyy vain sen, mitä tekstistäsi puuttuu.",
    "A4.3 Vieressä: lappu näkyy koko ajan keskustelun vieressä; kieli on lapun yläreunassa ja omat sanat sen alla.",
  ],
  recommend:
    "Suositus: A4.1 Keskustelu. Yksi suora polku: kieli on valmiiksi valittu yhdellä napautuksella, omat sanat kysytään, kun ihminen jo tietää mistä on kyse, ja lappu näytetään kerran, kokonaisena.",
  person: "Aino Laine",
  first: "Aino",
  workspace: "kotikirjasto",
  stepLabel: "Ohjeet agentille",
  simulate: "Prototyyppi: kirjautuminen valmis",
  eyebrow: "Viimeinen vaihe",
  // A2's words, the same in every variant.
  stepTitle: "Muistilappu agentille",
  lead: "Agentti ei muista aiempia keskusteluja. Tehdään sille muistilappu, jonka se lukee aina ensin: kuka olet ja miten haluat apua.",
  leadExisting: "Sinulla on jo muistilappu. Agentti ehdottaa siihen vain lisäyksiä, eikä vanhaan tekstiin kosketa.",
  helloExisting: "Hei Aino. Luin nykyisen muistilappusi. Lisään siihen vain uutta.",
  helloFirst: "Hei Aino. Teen sinulle muistilapun.",
  helloAfterOwn: "Kiitos, Aino. Laitoin tekstisi lappuun.",
  confirmGitHub: "GitHubin mukaan olet kirjastonhoitaja ja opettelet Pythonia iltaisin. Laitanko sen muistilappuun?",
  confirmYes: "Kyllä, laita",
  confirmNo: "Jätä pois",
  askStyle: "Millaisia vastauksia haluat?",
  askAsk: "Entä mitä en saa tehdä kysymättä?",
  ready: "Valmis. Tältä muistilappusi näyttää. Luen sen joka kerta ennen kuin vastaan. Voit muokata sitä itse ennen tallennusta.",
  readyExisting: "Valmis. Uusi osa on merkitty; vanha teksti pysyy ennallaan. Voit muokata uutta osaa itse.",
  readySide: "Valmis. Lappu on vieressä. Voit nyt muokata sitä itse ja tallentaa.",
  // The language the agent answers in.
  askLang: (ui: string) => `Millä kielellä vastaan sinulle? Habitat on ${ui}, joten ehdotan sitä.`,
  langLabel: "Agentti vastaa sinulle",
  langDefault: (ui: string) => `Habitatin kielen mukaan: ${ui}`,
  langExisting: "Nykyisissä ohjeissasi lukee jo kieli, joten sitä ei lisätä.",
  langChip: { fi: "Suomeksi", en: "Englanniksi", sv: "Ruotsiksi" } satisfies Record<AnswerLang, string>,
  langName: { fi: "suomeksi", en: "englanniksi", sv: "ruotsiksi" } satisfies Record<AnswerLang, string>,
  langLine: { fi: "Vastaa minulle suomeksi.", en: "Vastaa minulle englanniksi.", sv: "Vastaa minulle ruotsiksi." } satisfies Record<AnswerLang, string>,
  langOther: "Muun kielen voit kirjoittaa lappuun itse.",
  // The person's own words.
  askOwn: "Kerro vielä omin sanoin, mitä minun pitäisi tietää sinusta. Laitan sen lappuun sinun sanoillasi.",
  ownTitle: "Mitä agentin pitäisi tietää sinusta?",
  ownLead: "Kirjoita omin sanoin. Agentti voi korjata kirjoitusvirheet, mutta sanat pysyvät sinun.",
  ownSideTitle: "Omin sanoin",
  ownSideLead: "Mitä agentin pitäisi vielä tietää? Teksti menee lappuun sinun sanoillasi.",
  ownPlaceholder: "Esimerkiksi mitä teet, mitä opettelet tai mikä ärsyttää vastauksissa.",
  ownAdd: "Lisää lappuun",
  ownContinue: "Jatka",
  ownSkip: "Ohita",
  ownSkipFirst: "En keksi nyt, kysy sinä",
  ownSkipped: "Ohitetaan",
  tidy: "Korjasin vain isot alkukirjaimet ja välimerkit. Sanat ovat sinun:",
  tidyKeep: "Pidä omani",
  tidyUse: "Käytä korjattua",
  tidyKept: "Pidin tekstisi sellaisenaan.",
  tidyUsed: "Laitoin korjatun lappuun.",
  ownAdded: "Laitoin sen lappuun sellaisenaan.",
  choices: {
    style: [
      { label: "Lyhyesti ja suoraan", prose: "Vastaa lyhyesti ja suoraan." },
      { label: "Selitä, mitä teet", prose: "Kerro, mitä teet ja miksi, sillä opettelen vielä." },
      { label: "Kysy, jos epäselvää", prose: "Jos pyyntöni on epäselvä, kysy äläkä arvaa." },
    ],
    ask: [
      { label: "Ennen kuin julkaiset jotain", prose: "Kysy minulta ennen kuin julkaiset jotain tai lähetät muutoksia GitHubiin." },
      { label: "Ennen kuin poistat jotain", prose: "Kysy minulta ennen kuin poistat mitään." },
      { label: "Saat toimia vapaasti", prose: "Saat toimia vapaasti, kunhan kerrot jälkeenpäin, mitä teit." },
    ],
  } satisfies Record<"style" | "ask", Choice[]>,
  // The note: free-form Markdown the person can edit.
  note: {
    title: "# Muistilappu agentille",
    titleAdded: "## Muistilappu agentille",
    me: (n: string) => `Olen ${n}.`,
    work: "Olen kirjastonhoitaja ja opettelen Pythonia iltaisin.",
    own: "## Omin sanoin",
  },
  existing: "# Omat ohjeet\n\n- Vastaa suomeksi.\n- Käytä Pythonissa tyyppivihjeitä.",
  sampleOwn: "asun tampereella ja mulla on kaks kissaa. en tykkää pitkistä selityksistä",
  revealLabel: "Muistilappu",
  editorLabel: "Muistilappu agentille",
  sideLocked: "Voit muokata lappua itse, kun agentti on kysynyt kysymyksensä.",
  sideEmpty: "Lappu täyttyy, kun vastaat.",
  later: "Tee myöhemmin",
  keep: "Jätä ennalleen",
  save: "Tallenna",
  saveMerge: "Lisää ohjeisiin",
  // Past the step.
  doneSaved: "Valmis",
  doneMerged: "Muistilappu täydennetty",
  doneSavedLead:
    "Agentti lukee muistilappusi jokaisen keskustelun alussa. Voit muuttaa sitä milloin vain: pyydä agenttia missä tahansa keskustelussa tai avaa Asetukset › Tili › Ohjeet agentille.",
  doneLater: "Voit tehdä tämän myöhemmin",
  doneLaterLead:
    "Mitään ei tallennettu. Kun haluat, pyydä agenttia kirjoittamaan muistilappu missä tahansa keskustelussa tai avaa Asetukset › Tili › Ohjeet agentille.",
  doneKept: "Muistilappusi pysyi ennallaan",
  doneKeptLead: "Mitään ei muutettu. Voit täydentää sitä milloin vain kohdasta Asetukset › Tili › Ohjeet agentille.",
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
  title: "Agent instructions: a note in your own words",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  scenario: "Account",
  scenarios: { fresh: "New account", existing: "Instructions exist" },
  reset: "Restart from sign-in",
  jump: "Jump to the finished note",
  hint: "Synthetic person, the agent's turns are scripted.",
  lines: [
    "A4.1 Conversation: the language is the agent's first question and your own words the last; the note is shown at the end in the editor.",
    "A4.2 Yourself first: you write first and pick the language, then the agent asks only what your text is missing.",
    "A4.3 Alongside: the note is on screen beside the conversation the whole time; the language sits at its top and your own words under it.",
  ],
  recommend:
    "Recommendation: A4.1 Conversation. One straight path: the language is preselected and takes one tap, your own words are asked once you know what this is about, and the note is shown once, whole.",
  person: "Aino Laine",
  first: "Aino",
  workspace: "kotikirjasto",
  stepLabel: "Agent instructions",
  simulate: "Prototype: signed in",
  eyebrow: "Last step",
  stepTitle: "A note for your agent",
  lead: "The agent doesn't remember earlier conversations. Let's make it a note it always reads first: who you are and how you want help.",
  leadExisting: "You already have a note. The agent only suggests additions and leaves your text alone.",
  helloExisting: "Hi Aino. I read your current note. I'll only add to it.",
  helloFirst: "Hi Aino. Let's make your note.",
  helloAfterOwn: "Thanks, Aino. I put your text on the note.",
  confirmGitHub: "According to GitHub you're a librarian learning Python in the evenings. Shall I put that on the note?",
  confirmYes: "Yes, put it on",
  confirmNo: "Leave it out",
  askStyle: "What kind of answers do you want?",
  askAsk: "And what must I not do without asking?",
  ready: "Done. This is your note. I read it every time before I answer. You can edit it yourself before you save.",
  readyExisting: "Done. The new part is marked; the old text stays as it is. You can edit the new part yourself.",
  readySide: "Done. The note is alongside. You can edit it yourself now and save.",
  askLang: (ui: string) => `Which language shall I answer you in? Habitat is in ${ui}, so I suggest that.`,
  langLabel: "The agent answers you",
  langDefault: (ui: string) => `From Habitat's language: ${ui}`,
  langExisting: "Your current instructions already name a language, so none is added.",
  langChip: { fi: "In Finnish", en: "In English", sv: "In Swedish" },
  langName: { fi: "Finnish", en: "English", sv: "Swedish" },
  langLine: { fi: "Answer me in Finnish.", en: "Answer me in English.", sv: "Answer me in Swedish." },
  langOther: "Any other language you can write on the note yourself.",
  askOwn: "Last, tell me in your own words what I should know about you. I'll put it on the note in your words.",
  ownTitle: "What should the agent know about you?",
  ownLead: "Write in your own words. The agent may fix typos, but the words stay yours.",
  ownSideTitle: "In your own words",
  ownSideLead: "What else should the agent know? The text goes on the note in your words.",
  ownPlaceholder: "For example what you do, what you're learning or what annoys you in answers.",
  ownAdd: "Add to the note",
  ownContinue: "Continue",
  ownSkip: "Skip",
  ownSkipFirst: "Nothing comes to mind, you ask",
  ownSkipped: "Let's skip it",
  tidy: "I only fixed capitals and punctuation. The words are yours:",
  tidyKeep: "Keep mine",
  tidyUse: "Use the fixed one",
  tidyKept: "I kept your text as it was.",
  tidyUsed: "I put the fixed one on the note.",
  ownAdded: "I put it on the note as it is.",
  choices: {
    style: [
      { label: "Short and direct", prose: "Answer briefly and directly." },
      { label: "Explain what you do", prose: "Tell me what you do and why, because I'm still learning." },
      { label: "Ask when unclear", prose: "If my request is unclear, ask instead of guessing." },
    ],
    ask: [
      { label: "Before publishing anything", prose: "Ask me before you publish anything or send changes to GitHub." },
      { label: "Before deleting anything", prose: "Ask me before you delete anything." },
      { label: "Act freely", prose: "Act freely, as long as you tell me afterwards what you did." },
    ],
  },
  note: {
    title: "# A note for my agent",
    titleAdded: "## A note for my agent",
    me: (n: string) => `I'm ${n}.`,
    work: "I'm a librarian and I'm learning Python in the evenings.",
    own: "## In my own words",
  },
  existing: "# My instructions\n\n- Answer in English.\n- Use type hints in Python.",
  sampleOwn: "i live in tampere and have two cats. i dont like long explanations",
  revealLabel: "Note",
  editorLabel: "A note for your agent",
  sideLocked: "You can edit the note yourself once the agent has asked its questions.",
  sideEmpty: "The note fills in as you answer.",
  later: "Do this later",
  keep: "Leave as is",
  save: "Save",
  saveMerge: "Add to my instructions",
  doneSaved: "All set",
  doneMerged: "Note extended",
  doneSavedLead:
    "The agent reads your note at the start of every conversation. Change it any time: ask the agent in any conversation or open Settings › Account › Agent instructions.",
  doneLater: "You can do this later",
  doneLaterLead:
    "Nothing was saved. When you want, ask the agent to write your note in any conversation or open Settings › Account › Agent instructions.",
  doneKept: "Your note stayed as it was",
  doneKeptLead: "Nothing was changed. You can extend it any time from Settings › Account › Agent instructions.",
  where: "Where are the instructions?",
  whereText: "In the file ~/.pi/agent/AGENTS.md. Claude reads the same file, because ~/.claude/CLAUDE.md points to it.",
  wrote: "written",
  enter: "Go to Habitat",
  notes: { saved: "Saved", merged: "Extended", later: "Later", kept: "Unchanged" },
  homeTitle: "Workspaces",
  homeMeta: "Cloned during onboarding",
};

export const TEXT = { fi, en };
