// The round's own words, Finnish and English. Production pieces (the
// onboarding frame, the sign-in card, the repository chooser, the AI offer
// list, message cards, tool rows) keep their own catalogs and follow the
// same language choice. The person, the GitHub profile, the repositories
// and the workspace are synthetic.

export type Choice = {
  /** What the person sees on the button, echoed as their message in a chat. */
  label: string;
  /** The line the agent writes into the file. */
  line: string;
};

const fi = {
  title: "Käyttöönoton viimeinen vaihe: ohjeet agentille",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  scenario: "Tili",
  scenarios: { fresh: "Uusi tili", existing: "Ohjeet jo olemassa" },
  reset: "Alkuun kirjautumisesta",
  hint: "Synteettinen henkilö, agentin vuorot käsikirjoitettu.",
  lines: [
    "A Keskustelu: vaiheessa on pieni keskustelu, jossa agentti näyttää luonnoksen siitä, mitä jo tietää, ja kysyy kaksi puuttuvaa asiaa.",
    "B Tiedosto: vaihe näyttää luonnostiedoston, jonka puuttuvat kohdat valitaan suoraan tiedostosta; agentin keskustelu on pienenä vieressä.",
    "C Lomake: lyhyt ohjattu lomake valmiiksi täytetyin kentin; jokaisessa kentässä on Kysy agentilta -apu.",
  ],
  recommend:
    "Suositus: B Tiedosto. Ihminen näkee koko ajan oikean tiedoston ja sen, mistä kukin rivi tuli; kaksi valintaa riittää, ja agentti on vieressä, kun haluaa sanoa jotain omin sanoin.",
  // People and places.
  person: "Aino Laine",
  first: "Aino",
  login: "ainolaine",
  bio: "Kirjastonhoitaja. Opettelen Pythonia iltaisin.",
  workspace: "kotikirjasto",
  // The route.
  stepLabel: "Ohjeet agentille",
  // The earlier steps, quick to click through.
  simulate: "Prototyyppi: kirjautuminen valmis",
  // The instructions step.
  eyebrow: "Viimeinen vaihe",
  stepTitle: "Ohjeet agentille",
  lead: "Agentti kirjoittaa sinulle lyhyet omat ohjeet. Pi ja Claude lukevat ne jokaisen keskustelun alussa, joten samoja asioita ei tarvitse kertoa uudelleen.",
  leadExisting:
    "Sinulla on jo omat ohjeet. Agentti luki ne ja ehdottaa vain lisäyksiä; nykyiseen tekstiin ei kosketa.",
  later: "Tee myöhemmin",
  keep: "Jätä ennalleen",
  save: "Tallenna ohjeet",
  saveMerge: "Lisää ehdotukset",
  saving: "Agentti kirjoittaa…",
  agent: "Agentti",
  send: "Lähetä",
  fieldPlaceholder: "Kirjoita omin sanoin",
  sources: { github: "GitHubista", habitat: "Habitatin kielestä", bio: "GitHub-kuvauksesta", you: "sinulta" },
  // What the agent knows and asks.
  known:
    "Hei Aino. Tiedän sinusta jo nimen GitHubista, kielen siitä, että käytät Habitatia suomeksi, ja GitHub-kuvauksesi. Tein niistä luonnoksen. Yhdistettyjä tilejä ja työtiloja en kirjoita ohjeisiin, koska näen ne aina ajantasaisina.",
  knownExisting:
    "Hei Aino. Luin nykyiset ohjeesi tiedostosta `~/.pi/agent/AGENTS.md`. En kirjoita niiden päälle. Kieli on jo niissä; GitHubista tiedän nimesi ja kuvauksesi, ja ehdotan niistä lisäyksen.",
  askStyle: "Millaisia vastauksia haluat?",
  askAsk: "Entä onko jotain, mitä en saa tehdä kysymättä?",
  ready: "Siinä kaikki. Tallennan luonnoksen, kun painat Tallenna ohjeet. Voit vielä kirjoittaa, jos haluat muuttaa jotain.",
  readyExisting: "Siinä kaikki. Lisään merkityt rivit, kun painat Lisää ehdotukset. Nykyinen tekstisi pysyy ennallaan.",
  added: "Lisäsin sen kohtaan Muuta.",
  sideHello: "Täytin sen, minkä tiesin. Valitse kaksi puuttuvaa kohtaa tiedostosta, tai kirjoita minulle omin sanoin.",
  sideHelloExisting: "Nykyiset ohjeesi ovat ylimpänä harmaina, enkä muuta niitä. Valitse lisäykset tiedostosta, tai kirjoita minulle.",
  sideReady: "Hyvä. Tiedosto on valmis tallennettavaksi.",
  pick: "Valitse",
  choices: {
    style: [
      { label: "Lyhyesti ja suoraan", line: "Vastaa lyhyesti ja suoraan. Perustele, kun teet valinnan puolestani." },
      { label: "Selitä vaiheet", line: "Selitä mitä teet ja miksi; opettelen vielä näitä työkaluja." },
      { label: "Kysy, jos epäselvää", line: "Kysy, jos pyyntöni on epäselvä, äläkä arvaa." },
    ],
    ask: [
      { label: "Ennen julkaisua tai pushia", line: "Kysy ennen kuin julkaiset jotain tai pushaat GitHubiin." },
      { label: "Ennen kuin poistat mitään", line: "Kysy ennen kuin poistat tiedostoja." },
      { label: "Ei rajoituksia", line: "Voit toimia itsenäisesti, kunhan kerrot mitä teit." },
    ],
  } satisfies Record<"style" | "ask", Choice[]>,
  // The template.
  draft: {
    title: (name: string) => `# ${name}`,
    lead: "Omat ohjeeni agenteille. Pi lukee tämän tiedoston, ja Claude lukee sen ~/.claude/CLAUDE.md:n kautta. Muokkaa vapaasti.",
    who: "## Kuka olen",
    lang: "## Kieli",
    style: "## Miten vastaat",
    ask: "## Kysy ensin",
    extra: "## Muuta",
    call: (n: string) => `Puhuttele minua nimellä ${n}.`,
    langLine: "Vastaa suomeksi.",
  },
  existing: "# Omat ohjeet\n\n- Vastaa suomeksi.\n- Käytä Pythonissa tyyppivihjeitä.",
  newFile: "Uusi tiedosto",
  mergeFile: "Lisäys nykyiseen",
  claudeNew: "Claude lukee saman tiedoston: ~/.claude/CLAUDE.md saa rivin @~/.pi/agent/AGENTS.md.",
  claudeExisting: "~/.claude/CLAUDE.md on olemassa; sen alkuun lisätään vain rivi @~/.pi/agent/AGENTS.md.",
  safe: "Mitään ei kirjoiteta ennen tallennusta, eikä olemassa olevan tiedoston päälle koskaan.",
  // C: the form.
  form: {
    call: "Miten sinua puhutellaan",
    work: "Mitä teet ja mihin käytät agenttia",
    style: "Millaisia vastauksia haluat",
    ask: "Mitä agentti ei saa tehdä kysymättä",
    extra: "Muuta, mitä agentin on hyvä tietää",
    optional: "Kaikki kentät ovat vapaaehtoisia; tyhjä kohta jää pois.",
    helper: "Kysy agentilta",
    use: "Käytä",
    preview: "Näytä tiedosto",
    hidePreview: "Piilota tiedosto",
    langHas: "Kieli on jo ohjeissasi, joten sitä ei kysytä.",
  },
  helperSays: {
    call: "GitHubissa nimesi on Aino Laine. Useimmat haluavat etunimen: ehdotan ”Aino”.",
    work: "GitHub-kuvauksesi perusteella ehdotan: ”Kirjastonhoitaja. Opettelen Pythonia iltaisin; käytän agenttia oppimiseen ja pieniin omiin projekteihin.”",
    style: "Koska opettelet vielä, ehdotan ”Selitä vaiheet”. Voit vaihtaa sen myöhemmin.",
    ask: "Turvallinen alku on kysyä ennen pushia ja ennen poistoja.",
    extra: "Tähän sopii esimerkiksi aikavyöhyke, työajat tai lempityökalut. Jätän tyhjäksi, jos ei tule mieleen.",
  },
  helperValue: {
    call: "Aino",
    work: "Kirjastonhoitaja. Opettelen Pythonia iltaisin; käytän agenttia oppimiseen ja pieniin omiin projekteihin.",
  },
  // Saved and later.
  doneSaved: "Ohjeet tallennettu",
  doneMerged: "Ohjeet täydennetty",
  doneSavedLead:
    "Pi lukee ohjeet tiedostosta ~/.pi/agent/AGENTS.md, ja Claude saa ne ~/.claude/CLAUDE.md:n tuontirivin kautta. Voit muuttaa niitä milloin tahansa: Asetukset → Tili → Ohjeet agentille.",
  doneLater: "Ohjeet voi tehdä myöhemmin",
  doneLaterLead: "Mitään ei kirjoitettu. Asetukset → Tili → Ohjeet agentille avaa saman vaiheen.",
  doneKept: "Ohjeesi pysyivät ennallaan",
  doneKeptLead: "Mitään ei kirjoitettu. Voit täydentää ohjeita myöhemmin: Asetukset → Tili → Ohjeet agentille.",
  wrote: "kirjoitettu",
  enter: "Siirry Habitatiin",
  notes: { saved: "Tallennettu", merged: "Täydennetty", later: "Myöhemmin", kept: "Ennallaan" },
  // Habitat after the route.
  homeTitle: "Työtilat",
  homeMeta: "Kloonattu käyttöönotossa",
  remindTitle: "Ohjeet agentille",
  remindLead: "Kerro agentille muutama asia itsestäsi, niin sen ei tarvitse kysyä niitä joka keskustelussa.",
  remindStart: "Tee nyt",
  settingsCrumb: "Asetukset › Tili",
  settingsTitle: "Ohjeet agentille",
  back: "Takaisin työtiloihin",
};

export type Text = typeof fi;

const en: Text = {
  title: "Onboarding's last step: instructions for the agent",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  scenario: "Account",
  scenarios: { fresh: "New account", existing: "Instructions exist" },
  reset: "Restart from sign-in",
  hint: "Synthetic person, the agent's turns are scripted.",
  lines: [
    "A Chat: the step holds a small chat where the agent shows a draft of what it already knows and asks the two missing things.",
    "B File: the step shows the draft file and the missing parts are chosen inside it; a small chat with the agent sits beside it.",
    "C Form: a short guided form with prefilled fields; every field has an Ask the agent helper.",
  ],
  recommend:
    "Recommendation: B File. The person always sees the real file and where each line came from; two choices are enough, and the agent is beside it for anything said in their own words.",
  person: "Aino Laine",
  first: "Aino",
  login: "ainolaine",
  bio: "Librarian. Learning Python in the evenings.",
  workspace: "kotikirjasto",
  stepLabel: "Agent instructions",
  simulate: "Prototype: signed in",
  eyebrow: "Last step",
  stepTitle: "Instructions for your agent",
  lead: "The agent writes your own short instructions. Pi and Claude read them at the start of every conversation, so you don't have to repeat the same things.",
  leadExisting:
    "You already have your own instructions. The agent read them and only suggests additions; your current text is not touched.",
  later: "Do this later",
  keep: "Leave as is",
  save: "Save instructions",
  saveMerge: "Add the suggestions",
  saving: "The agent is writing…",
  agent: "Agent",
  send: "Send",
  fieldPlaceholder: "Write in your own words",
  sources: { github: "from GitHub", habitat: "from Habitat's language", bio: "from your GitHub bio", you: "from you" },
  known:
    "Hi Aino. I already know your name from GitHub, your language because you use Habitat in English, and your GitHub bio. I made a draft from them. I don't write connected accounts or workspaces into the instructions, because I always see them as they are now.",
  knownExisting:
    "Hi Aino. I read your current instructions in `~/.pi/agent/AGENTS.md`. I won't overwrite them. The language is already there; from GitHub I know your name and bio, and I suggest an addition from those.",
  askStyle: "What kind of answers do you want?",
  askAsk: "And is there anything I must not do without asking?",
  ready: "That's all. I'll save the draft when you press Save instructions. You can still write if you want to change something.",
  readyExisting: "That's all. I'll add the marked lines when you press Add the suggestions. Your current text stays as it is.",
  added: "Added it under Other.",
  sideHello: "I filled in what I knew. Choose the two missing parts in the file, or write to me in your own words.",
  sideHelloExisting: "Your current instructions are at the top in grey and I won't change them. Choose the additions in the file, or write to me.",
  sideReady: "Good. The file is ready to save.",
  pick: "Choose",
  choices: {
    style: [
      { label: "Short and direct", line: "Answer briefly and directly. Give your reason when you choose for me." },
      { label: "Explain the steps", line: "Explain what you do and why; I'm still learning these tools." },
      { label: "Ask when unclear", line: "Ask when my request is unclear instead of guessing." },
    ],
    ask: [
      { label: "Before publishing or pushing", line: "Ask before you publish anything or push to GitHub." },
      { label: "Before deleting anything", line: "Ask before you delete files." },
      { label: "No limits", line: "You may act on your own as long as you tell me what you did." },
    ],
  },
  draft: {
    title: (name: string) => `# ${name}`,
    lead: "My own instructions for agents. Pi reads this file, and Claude reads it through ~/.claude/CLAUDE.md. Edit freely.",
    who: "## Who I am",
    lang: "## Language",
    style: "## How to answer",
    ask: "## Ask first",
    extra: "## Other",
    call: (n: string) => `Call me ${n}.`,
    langLine: "Answer in English.",
  },
  existing: "# My instructions\n\n- Answer in English.\n- Use type hints in Python.",
  newFile: "New file",
  mergeFile: "Addition to current",
  claudeNew: "Claude reads the same file: ~/.claude/CLAUDE.md gets the line @~/.pi/agent/AGENTS.md.",
  claudeExisting: "~/.claude/CLAUDE.md exists; only the line @~/.pi/agent/AGENTS.md is added at its top.",
  safe: "Nothing is written before you save, and an existing file is never overwritten.",
  form: {
    call: "What should the agent call you",
    work: "What you do and what you use the agent for",
    style: "What kind of answers you want",
    ask: "What the agent must not do without asking",
    extra: "Anything else the agent should know",
    optional: "Every field is optional; an empty one is left out.",
    helper: "Ask the agent",
    use: "Use",
    preview: "Show the file",
    hidePreview: "Hide the file",
    langHas: "Your instructions already name a language, so it isn't asked.",
  },
  helperSays: {
    call: "On GitHub your name is Aino Laine. Most people prefer their first name: I suggest “Aino”.",
    work: "From your GitHub bio I suggest: “Librarian. Learning Python in the evenings; I use the agent for learning and small projects of my own.”",
    style: "As you are still learning, I suggest “Explain the steps”. You can change it later.",
    ask: "A safe start is to ask before pushing and before deleting.",
    extra: "Your time zone, working hours or favourite tools fit here. I'll leave it empty if nothing comes to mind.",
  },
  helperValue: {
    call: "Aino",
    work: "Librarian. Learning Python in the evenings; I use the agent for learning and small projects of my own.",
  },
  doneSaved: "Instructions saved",
  doneMerged: "Instructions extended",
  doneSavedLead:
    "Pi reads the instructions from ~/.pi/agent/AGENTS.md, and Claude gets them through the import line in ~/.claude/CLAUDE.md. Change them any time: Settings → Account → Agent instructions.",
  doneLater: "You can write the instructions later",
  doneLaterLead: "Nothing was written. Settings → Account → Agent instructions opens the same step.",
  doneKept: "Your instructions stayed as they were",
  doneKeptLead: "Nothing was written. You can extend them later: Settings → Account → Agent instructions.",
  wrote: "written",
  enter: "Go to Habitat",
  notes: { saved: "Saved", merged: "Extended", later: "Later", kept: "Unchanged" },
  homeTitle: "Workspaces",
  homeMeta: "Cloned during onboarding",
  remindTitle: "Agent instructions",
  remindLead: "Tell the agent a few things about yourself, so it doesn't have to ask them in every conversation.",
  remindStart: "Do it now",
  settingsCrumb: "Settings › Account",
  settingsTitle: "Agent instructions",
  back: "Back to workspaces",
};

export const TEXT = { fi, en };
