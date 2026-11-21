// The round's own words, Finnish and English. Production pieces (the
// onboarding frame, the composer, the header, message cards) keep their own
// catalogs and follow the same language choice. The person, the GitHub
// profile and the workspace are synthetic.

export type Chip = {
  /** What the person sees on the button and what is echoed as their message. */
  label: string;
  /** The line the agent writes into the file; undefined skips the question. */
  line?: string;
  /** Not an answer: ends the interview or the round. */
  action?: "draft" | "later" | "save";
};

export type QuestionId = "name" | "lang" | "work" | "style" | "ask" | "extra";

const fi = {
  title: "Ensimmäinen keskustelu: omat ohjeet agentille",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  scenario: "Tili",
  scenarios: { fresh: "Uusi tili", existing: "Ohjeet jo olemassa" },
  reset: "Alkuun käyttöönoton lopusta",
  hint: "Synteettinen henkilö, vuorot käsikirjoitettu.",
  lines: [
    "1 Haastattelu: agentti kysyy kuusi lyhyttä kysymystä yksi kerrallaan (pikavastaukset tai omin sanoin) ja näyttää sitten luonnoksen.",
    "2 Luonnos ensin: agentti kertoo, mitä se jo tietää (nimi, kieli, GitHub-kuvaus), näyttää heti luonnoksen ja kysyy vain puuttuvat kaksi asiaa.",
    "3 Lomake: agentti antaa keskusteluun lomakekortin, joka täytetään kerralla; vastauksista syntyy luonnos.",
  ],
  recommend:
    "Suositus: 2 Luonnos ensin. Ihminen näkee heti oikean tiedoston, agentti näyttää rehellisesti mistä tieto tuli, ja kysymyksiä on vain kaksi; muutokset käyvät napilla tai omin sanoin.",
  // People and places.
  person: "Aino Laine",
  first: "Aino",
  login: "ainolaine",
  bio: "Kirjastonhoitaja. Opettelen Pythonia iltaisin.",
  workspace: "kotikirjasto",
  convTitle: "Omat ohjeet agentille",
  home: "~",
  you: "Sinä",
  habitat: "Open Habitat",
  // Landing: the end of the onboarding route.
  landTitle: "Agentti on valmis",
  landLead:
    "Viimeiseksi agentti kysyy sinulta muutaman asian ja kirjoittaa niistä omat ohjeesi. Pi ja Claude lukevat ne jokaisen keskustelun alussa, joten samoja asioita ei tarvitse kertoa uudelleen.",
  landExisting:
    "Sinulla on jo omat ohjeet (~/.pi/agent/AGENTS.md). Agentti lukee ne ja ehdottaa vain lisäyksiä; mitään ei kirjoiteta päälle.",
  landTime: "Vie muutaman minuutin. Voit muuttaa ohjeita milloin tahansa.",
  landStart: "Aloita keskustelu",
  landStartExisting: "Täydennä ohjeita keskustellen",
  landLater: "Tee myöhemmin",
  // The onboarding band above the field.
  bandLabel: "Käyttöönotto",
  bandStep: (n: number, of: number) => `kysymys ${n}/${of}`,
  bandDraft: "luonnos",
  bandForm: "lomake",
  bandSaved: "tallennettu",
  bandLater: "Tee myöhemmin",
  composerPlaceholder: "Vastaa omin sanoin tai valitse yllä",
  // Agent turns.
  hello:
    "Hei Aino. Tässä keskustelussa kirjoitamme sinulle omat ohjeet: lyhyen tiedoston, jonka Pi ja Claude lukevat jokaisen keskustelun alussa. Siihen tulee vain sinusta kertovaa. Open Habitat kertoo minulle ympäristöstä itse, joten sitä ei tarvitse kirjoittaa.",
  helloExisting:
    "Hei Aino. Sinulla on jo omat ohjeet tiedostossa `~/.pi/agent/AGENTS.md`. Luin ne. En kirjoita niiden päälle: kysyn vain sen, mitä niistä puuttuu, ja ehdotan lisäyksiä.",
  qIntro: (n: number) =>
    `Kysyn ${n === 6 ? "kuusi" : "viisi"} lyhyttä asiaa. Valitse vastaus tai kirjoita omin sanoin; kysymyksen voi myös ohittaa.`,
  questions: {
    name: "Miten haluat, että sinua puhutellaan?",
    lang: "Millä kielellä vastaan?",
    work: "Mitä teet, ja mihin aiot käyttää agenttia? Omin sanoin kertominen auttaa eniten.",
    style: "Millaisia vastauksia haluat?",
    ask: "Onko jotain, mitä en saa tehdä kysymättä?",
    extra: "Vielä jotain muuta, mitä minun on hyvä tietää?",
  } satisfies Record<QuestionId, string>,
  langKnown: "Ohjeissasi lukee jo, millä kielellä vastaan, joten ohitan sen.",
  chips: {
    name: [
      { label: "Aino", line: "Puhuttele minua nimellä Aino." },
      { label: "Aino Laine", line: "Puhuttele minua nimellä Aino Laine." },
    ],
    lang: [
      { label: "Suomeksi", line: "Vastaa suomeksi." },
      {
        label: "Suomeksi, tekniset termit englanniksi",
        line: "Vastaa suomeksi. Koodi, komennot, commit-viestit ja tekniset termit englanniksi.",
      },
      { label: "Englanniksi", line: "Vastaa englanniksi." },
    ],
    work: [
      { label: "Ohjelmointi ja omat projektit", line: "Käytän agenttia ohjelmointiin ja omiin projekteihini." },
      { label: "Tekstit ja selvitykset", line: "Käytän agenttia tekstien kirjoittamiseen ja asioiden selvittämiseen." },
      { label: "Arjen asiat", line: "Käytän agenttia arjen asioihin." },
    ],
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
    extra: [{ label: "Ei muuta, näytä luonnos", action: "draft" }],
  } satisfies Record<QuestionId, Chip[]>,
  skipChip: "Ohita",
  // Direction 2.
  known:
    "Hei Aino. Kirjoitan sinulle omat ohjeet: lyhyen tiedoston, jonka Pi ja Claude lukevat jokaisen keskustelun alussa. Tiedän sinusta jo nämä:\n\n- nimi **Aino Laine** GitHubista\n- kieli **suomi**, koska käytät Habitatia suomeksi\n- GitHub-kuvauksesi: *Kirjastonhoitaja. Opettelen Pythonia iltaisin.*\n\nYhdistettyjä tilejä ja työtiloja en kirjoita ohjeisiin, koska näen ne aina ajantasaisina. Tein näistä luonnoksen.",
  knownExisting:
    "Hei Aino. Sinulla on jo omat ohjeet tiedostossa `~/.pi/agent/AGENTS.md`, ja luin ne. En kirjoita niiden päälle. Kieli on jo ohjeissasi; GitHubista tiedän nimesi ja kuvauksesi (*Kirjastonhoitaja. Opettelen Pythonia iltaisin.*). Ehdotan niistä lisäyksen.",
  twoMissing:
    "Kaksi asiaa en tiedä: millaisia vastauksia haluat ja mitä en saa tehdä kysymättä. Valitse alta tai kirjoita omin sanoin. Kun luonnos on hyvä, tallenna se.",
  tweaked: "Lisäsin sen. Tässä päivitetty luonnos.",
  // Direction 3.
  formLead: "Hei Aino. Täytä alla oleva kortti, niin teen siitä omat ohjeesi: lyhyen tiedoston, jonka Pi ja Claude lukevat jokaisen keskustelun alussa. Kaikki kentät ovat vapaaehtoisia.",
  formLeadExisting:
    "Hei Aino. Sinulla on jo omat ohjeet tiedostossa `~/.pi/agent/AGENTS.md`. En kirjoita niiden päälle: täytä kortista se, mitä haluat lisätä.",
  form: {
    title: "Omat ohjeet",
    name: "Nimi, jolla sinua puhutellaan",
    lang: "Vastausten kieli",
    langHas: "Ohjeissasi on jo kieli.",
    work: "Mihin käytät agenttia",
    workFree: "Omin sanoin (vapaaehtoinen)",
    style: "Vastaukset",
    ask: "Kysy ensin",
    extra: "Muuta, mitä agentin on hyvä tietää",
    submit: "Tee luonnos",
    sent: "Lähetetty",
    sentSummary: (n: number) => `Vastasit lomakkeella (${n} kohtaa).`,
  },
  freeNoted: "Otin tämän mukaan. Täytä loput kortista, tai tee luonnos jo nyt.",
  // The draft.
  draftReady: "Tässä luonnos. Tallennanko sen?",
  draftReadyExisting: "Tässä ehdotus. Nykyiset ohjeesi pysyvät ennallaan; lisään vain merkityt rivit.",
  draftNew: "Uusi tiedosto",
  draftMerge: "Lisäys nykyiseen",
  draftReplaced: "Korvattu uudemmalla luonnoksella",
  draftSavedTag: "Tallennettu",
  claudeNew: "Claude lukee saman tiedoston: luon tiedoston ~/.claude/CLAUDE.md, jossa on vain viittaus tähän.",
  claudeExisting:
    "Claude lukee saman tiedoston: lisään tiedoston ~/.claude/CLAUDE.md alkuun rivin @~/.pi/agent/AGENTS.md. Sen muu sisältö säilyy.",
  safeNote: "Kirjoitan vain, jos tiedosto on yhä sama kuin luin sen.",
  save: "Tallenna",
  saveMerge: "Lisää ohjeisiin",
  change: "Muuta vielä",
  whatChange: "Mitä muutan? Valitse alta tai kirjoita omin sanoin.",
  changeChips: [
    { label: "Vastaa lyhyemmin", line: "Vastaa lyhyesti ja suoraan. Perustele, kun teet valinnan puolestani." },
    { label: "Kysy ennen pushia", line: "Kysy ennen kuin julkaiset jotain tai pushaat GitHubiin." },
    { label: "Selitä vaiheet", line: "Selitä mitä teet ja miksi; opettelen vielä näitä työkaluja." },
    { label: "Näyttää hyvältä, tallenna", action: "save" },
  ] as Chip[],
  // After saving.
  saved:
    "Tallennettu. Ohjeet ovat käytössä seuraavasta keskustelusta alkaen, myös Claudessa. Löydät ne kohdasta **Asetukset → Tili → Ohjeet agentille**, ja voit milloin tahansa pyytää minua muuttamaan niitä.",
  savedAgain: "Tallensin muutoksen.",
  doneLine: "Käyttöönotto on valmis.",
  toWorkspaces: "Siirry työtiloihin",
  openSettings: "Näytä ohjeet asetuksissa",
  later:
    "Selvä, jätetään myöhemmäksi. En kirjoittanut mitään. Voit palata tähän kohdasta **Asetukset → Tili → Ohjeet agentille**.",
  // Home and settings.
  homeTitle: "Työtilat",
  homeEmpty: "1 työtila · ei avointa työtä",
  remindTitle: "Ohjeet agentille puuttuvat",
  remindLead: "Agentti voi kirjoittaa ne kanssasi muutamassa minuutissa. Niiden avulla sinun ei tarvitse kertoa samoja asioita jokaisessa keskustelussa.",
  remindStart: "Aloita keskustelu",
  settingsCrumb: "Asetukset · Tili",
  settingsTitle: "Ohjeet agentille",
  settingsLead:
    "Pi lukee tämän tiedoston jokaisen keskustelun alussa, ja Claude lukee sen ~/.claude/CLAUDE.md:n kautta. Open Habitatin oma ympäristökuvaus tulee erikseen, joten sitä ei tarvitse kirjoittaa tähän.",
  settingsUpdated: "Päivitetty tänään klo",
  settingsChat: "Muuta keskustelemalla",
  settingsEdit: "Muokkaa tekstinä",
  settingsSave: "Tallenna",
  settingsCancel: "Peru",
  settingsBack: "Takaisin keskusteluun",
  settingsEditing: "Tallennus kirjoittaa tiedoston vain, jos sitä ei ole muutettu sillä välin muualla.",
  // The template.
  draft: {
    title: (name: string) => `# ${name}`,
    lead: "Omat ohjeeni agenteille. Pi lukee tämän tiedoston, ja Claude lukee sen ~/.claude/CLAUDE.md:n kautta. Muokkaa vapaasti.",
    who: "## Kuka olen",
    lang: "## Kieli",
    style: "## Miten vastaat",
    ask: "## Kysy ensin",
    extra: "## Muuta",
    added: "## Lisätty 21.11.2026",
  },
  existing: "# Omat ohjeet\n\n- Vastaa suomeksi.\n- Käytä Pythonissa tyyppivihjeitä.",
};

export type Text = typeof fi;

const en: Text = {
  title: "First conversation: your own agent instructions",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  scenario: "Account",
  scenarios: { fresh: "New account", existing: "Instructions exist" },
  reset: "Start from the end of onboarding",
  hint: "Synthetic person, scripted turns.",
  lines: [
    "1 Interview: the agent asks six short questions one at a time (quick replies or own words), then shows a draft.",
    "2 Draft first: the agent says what it already knows (name, language, GitHub bio), shows a draft at once and asks only the two missing things.",
    "3 Form: the agent puts a form card in the conversation, filled in one go; the answers become a draft.",
  ],
  recommend:
    "Recommendation: 2 Draft first. The person sees the real file at once, the agent shows honestly where each fact came from, and there are only two questions; changes take a button or own words.",
  person: "Aino Laine",
  first: "Aino",
  login: "ainolaine",
  bio: "Librarian. Learning Python in the evenings.",
  workspace: "kotikirjasto",
  convTitle: "Your agent instructions",
  home: "~",
  you: "You",
  habitat: "Open Habitat",
  landTitle: "Your agent is ready",
  landLead:
    "Last, the agent asks you a few things and writes your own instructions from them. Pi and Claude read them at the start of every conversation, so you need not repeat yourself.",
  landExisting:
    "You already have instructions (~/.pi/agent/AGENTS.md). The agent reads them and only suggests additions; nothing is overwritten.",
  landTime: "Takes a few minutes. You can change the instructions at any time.",
  landStart: "Start the conversation",
  landStartExisting: "Add to them in a conversation",
  landLater: "Do this later",
  bandLabel: "Getting started",
  bandStep: (n, of) => `question ${n}/${of}`,
  bandDraft: "draft",
  bandForm: "form",
  bandSaved: "saved",
  bandLater: "Do this later",
  composerPlaceholder: "Answer in your own words or choose above",
  hello:
    "Hi Aino. In this conversation we write your own instructions: a short file Pi and Claude read at the start of every conversation. Only things about you go in it. Open Habitat tells me about the environment itself, so that need not be written.",
  helloExisting:
    "Hi Aino. You already have instructions in `~/.pi/agent/AGENTS.md`. I read them. I won't overwrite them: I'll only ask what they leave out and suggest additions.",
  qIntro: (n) =>
    `I'll ask ${n === 6 ? "six" : "five"} short things. Choose an answer or write your own; you can skip a question too.`,
  questions: {
    name: "What should I call you?",
    lang: "Which language should I answer in?",
    work: "What do you do, and what will you use the agent for? Your own words help most.",
    style: "What kind of answers do you want?",
    ask: "Is there anything I must not do without asking?",
    extra: "Anything else I should know?",
  },
  langKnown: "Your instructions already say which language to use, so I'll skip that.",
  chips: {
    name: [
      { label: "Aino", line: "Call me Aino." },
      { label: "Aino Laine", line: "Call me Aino Laine." },
    ],
    lang: [
      { label: "Finnish", line: "Answer in Finnish." },
      {
        label: "Finnish, technical terms in English",
        line: "Answer in Finnish. Code, commands, commit messages and technical terms in English.",
      },
      { label: "English", line: "Answer in English." },
    ],
    work: [
      { label: "Programming and own projects", line: "I use the agent for programming and my own projects." },
      { label: "Writing and research", line: "I use the agent for writing and finding things out." },
      { label: "Everyday things", line: "I use the agent for everyday things." },
    ],
    style: [
      { label: "Short and direct", line: "Answer briefly and directly. Give the reason when you choose for me." },
      { label: "Explain the steps", line: "Explain what you do and why; I'm still learning these tools." },
      { label: "Ask when unclear", line: "Ask when my request is unclear instead of guessing." },
    ],
    ask: [
      { label: "Before publishing or pushing", line: "Ask before you publish anything or push to GitHub." },
      { label: "Before deleting anything", line: "Ask before you delete files." },
      { label: "No limits", line: "You may act on your own as long as you tell me what you did." },
    ],
    extra: [{ label: "Nothing else, show the draft", action: "draft" }],
  },
  skipChip: "Skip",
  known:
    "Hi Aino. I'll write your own instructions: a short file Pi and Claude read at the start of every conversation. I already know this about you:\n\n- name **Aino Laine** from GitHub\n- language **English**, because you use Habitat in English\n- your GitHub bio: *Librarian. Learning Python in the evenings.*\n\nI don't write connected accounts or workspaces into the instructions, because I always see them as they are now. I made a draft from these.",
  knownExisting:
    "Hi Aino. You already have instructions in `~/.pi/agent/AGENTS.md`, and I read them. I won't overwrite them. The language is already there; from GitHub I know your name and bio (*Librarian. Learning Python in the evenings.*). I suggest an addition from those.",
  twoMissing:
    "Two things I don't know: what kind of answers you want, and what I must not do without asking. Choose below or write your own. When the draft is right, save it.",
  tweaked: "Added. Here is the updated draft.",
  formLead: "Hi Aino. Fill in the card below and I'll make your own instructions from it: a short file Pi and Claude read at the start of every conversation. Every field is optional.",
  formLeadExisting:
    "Hi Aino. You already have instructions in `~/.pi/agent/AGENTS.md`. I won't overwrite them: fill in what you want to add.",
  form: {
    title: "Your instructions",
    name: "Name to call you by",
    lang: "Answer language",
    langHas: "Your instructions already set a language.",
    work: "What you use the agent for",
    workFree: "In your own words (optional)",
    style: "Answers",
    ask: "Ask first",
    extra: "Anything else the agent should know",
    submit: "Make the draft",
    sent: "Sent",
    sentSummary: (n) => `You answered with the form (${n} items).`,
  },
  freeNoted: "Noted. Fill in the rest of the card, or make the draft now.",
  draftReady: "Here is the draft. Shall I save it?",
  draftReadyExisting: "Here is my suggestion. Your current instructions stay as they are; I only add the marked lines.",
  draftNew: "New file",
  draftMerge: "Addition to yours",
  draftReplaced: "Replaced by a newer draft",
  draftSavedTag: "Saved",
  claudeNew: "Claude reads the same file: I create ~/.claude/CLAUDE.md holding only a reference to it.",
  claudeExisting:
    "Claude reads the same file: I add the line @~/.pi/agent/AGENTS.md to the top of ~/.claude/CLAUDE.md. The rest of it stays.",
  safeNote: "I write only if the file is still as I read it.",
  save: "Save",
  saveMerge: "Add to instructions",
  change: "Change something",
  whatChange: "What should I change? Choose below or write your own.",
  changeChips: [
    { label: "Shorter answers", line: "Answer briefly and directly. Give the reason when you choose for me." },
    { label: "Ask before pushing", line: "Ask before you publish anything or push to GitHub." },
    { label: "Explain the steps", line: "Explain what you do and why; I'm still learning these tools." },
    { label: "Looks good, save", action: "save" },
  ],
  saved:
    "Saved. The instructions apply from your next conversation, in Claude too. You'll find them under **Settings → Account → Agent instructions**, and you can ask me to change them at any time.",
  savedAgain: "I saved the change.",
  doneLine: "Getting started is complete.",
  toWorkspaces: "Go to workspaces",
  openSettings: "Show the instructions in settings",
  later:
    "Fine, let's leave it for later. I wrote nothing. You can come back to this under **Settings → Account → Agent instructions**.",
  homeTitle: "Workspaces",
  homeEmpty: "1 workspace · no open work",
  remindTitle: "No agent instructions yet",
  remindLead: "The agent can write them with you in a few minutes. With them you need not repeat yourself in every conversation.",
  remindStart: "Start the conversation",
  settingsCrumb: "Settings · Account",
  settingsTitle: "Agent instructions",
  settingsLead:
    "Pi reads this file at the start of every conversation, and Claude reads it through ~/.claude/CLAUDE.md. Open Habitat's own environment description comes separately, so it need not be written here.",
  settingsUpdated: "Updated today at",
  settingsChat: "Change in a conversation",
  settingsEdit: "Edit as text",
  settingsSave: "Save",
  settingsCancel: "Cancel",
  settingsBack: "Back to the conversation",
  settingsEditing: "Saving writes the file only if nothing else changed it in the meantime.",
  draft: {
    title: (name) => `# ${name}`,
    lead: "My own instructions for agents. Pi reads this file, and Claude reads it through ~/.claude/CLAUDE.md. Edit freely.",
    who: "## Who I am",
    lang: "## Language",
    style: "## How you answer",
    ask: "## Ask first",
    extra: "## Other",
    added: "## Added 21 Nov 2026",
  },
  existing: "# My instructions\n\n- Answer in Finnish.\n- Use type hints in Python.",
};

// Direction 2 in English knows the language from Habitat's language: English.
export const TEXT = { fi, en };
