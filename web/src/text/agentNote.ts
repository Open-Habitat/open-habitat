import { catalog } from "../i18n";

// The note for the agent (components/AgentNoteStep.tsx): onboarding's last
// step and Settings' "Kirjoita agentin kanssa". Accepted wording: issue
// new-user-agent-instructions-template, round 4, A4.1 Keskustelu.
type Choice = { label: string; prose: string };
type Answer = { fi: string; en: string; sv: string };

const fi = {
  stepLabel: "Ohjeet agentille",
  eyebrow: "Viimeinen vaihe",
  title: "Muistilappu agentille",
  titleSettings: "Kirjoita muistilappu agentin kanssa",
  lead: "Agentti ei muista aiempia keskusteluja. Tehdään sille muistilappu, jonka se lukee aina ensin: kuka olet ja miten haluat apua.",
  leadExisting:
    "Sinulla on jo muistilappu. Agentti ehdottaa siihen vain lisäyksiä, eikä vanhaan tekstiin kosketa.",
  hello: (first: string) =>
    first
      ? `Hei ${first}. Teen sinulle muistilapun.`
      : "Hei. Teen sinulle muistilapun.",
  helloExisting: (first: string) =>
    `${first ? `Hei ${first}. ` : "Hei. "}Luin nykyisen muistilappusi. Lisään siihen vain uutta.`,
  askLang: (ui: string) =>
    `Millä kielellä vastaan sinulle? Ehdotan kieltä ${ui}.`,
  askStyle: "Millaisia vastauksia haluat?",
  askAsk: "Entä mitä en saa tehdä kysymättä?",
  askOwn:
    "Kerro vielä omin sanoin, mitä minun pitäisi tietää sinusta. Laitan sen lappuun sinun sanoillasi.",
  ready:
    "Valmis. Tältä muistilappusi näyttää. Luen sen joka kerta ennen kuin vastaan. Voit muokata sitä itse ennen tallennusta.",
  readyExisting:
    "Valmis. Uusi osa on merkitty; vanha teksti pysyy ennallaan. Voit muokata uutta osaa itse.",
  langChip: { fi: "Suomeksi", en: "Englanniksi", sv: "Ruotsiksi" } as Answer,
  langName: { fi: "suomi", en: "englanti", sv: "ruotsi" } as Answer,
  langLine: {
    fi: "Vastaa minulle suomeksi.",
    en: "Vastaa minulle englanniksi.",
    sv: "Vastaa minulle ruotsiksi.",
  } as Answer,
  ownTitle: "Mitä agentin pitäisi tietää sinusta?",
  ownLead:
    "Kirjoita omin sanoin. Agentti voi korjata kirjoitusvirheet, mutta sanat pysyvät sinun.",
  ownPlaceholder:
    "Esimerkiksi mitä teet, mitä opettelet tai mikä ärsyttää vastauksissa.",
  ownAdd: "Lisää lappuun",
  ownSkip: "Ohita",
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
      {
        label: "Selitä, mitä teet",
        prose: "Kerro, mitä teet ja miksi, sillä opettelen vielä.",
      },
      {
        label: "Kysy, jos epäselvää",
        prose: "Jos pyyntöni on epäselvä, kysy äläkä arvaa.",
      },
    ] as Choice[],
    ask: [
      {
        label: "Ennen kuin julkaiset jotain",
        prose:
          "Kysy minulta ennen kuin julkaiset jotain tai lähetät muutoksia GitHubiin.",
      },
      {
        label: "Ennen kuin poistat jotain",
        prose: "Kysy minulta ennen kuin poistat mitään.",
      },
      {
        label: "Saat toimia vapaasti",
        prose: "Saat toimia vapaasti, kunhan kerrot jälkeenpäin, mitä teit.",
      },
    ] as Choice[],
  },
  note: {
    title: "# Muistilappu agentille",
    titleAdded: "## Muistilappu agentille",
    me: (name: string) => `Olen ${name}.`,
    own: "## Omin sanoin",
  },
  thread: "Keskustelu muistilapusta",
  replies: "Vastausvaihtoehdot",
  noteLabel: "Muistilappu",
  editorLabel: "Muistilapun teksti",
  later: "Tee myöhemmin",
  keep: "Jätä ennalleen",
  save: "Tallenna",
  saveMerge: "Lisää ohjeisiin",
  copied: "Kopioitu",
};

export const agentNoteText = catalog(fi, {
  stepLabel: "Agent instructions",
  eyebrow: "Last step",
  title: "A note for your agent",
  titleSettings: "Write the note with the agent",
  lead: "The agent doesn't remember earlier conversations. Let's make it a note it always reads first: who you are and how you want help.",
  leadExisting:
    "You already have a note. The agent only suggests additions and leaves your text alone.",
  hello: (first: string) =>
    first ? `Hi ${first}. Let's make your note.` : "Hi. Let's make your note.",
  helloExisting: (first: string) =>
    `${first ? `Hi ${first}. ` : "Hi. "}I read your current note. I'll only add to it.`,
  askLang: (ui: string) =>
    `Which language shall I answer you in? I suggest ${ui}.`,
  askStyle: "What kind of answers do you want?",
  askAsk: "And what must I not do without asking?",
  askOwn:
    "Last, tell me in your own words what I should know about you. I'll put it on the note in your words.",
  ready:
    "Done. This is your note. I read it every time before I answer. You can edit it yourself before you save.",
  readyExisting:
    "Done. The new part is marked; the old text stays as it is. You can edit the new part yourself.",
  langChip: { fi: "In Finnish", en: "In English", sv: "In Swedish" },
  langName: { fi: "Finnish", en: "English", sv: "Swedish" },
  langLine: {
    fi: "Answer me in Finnish.",
    en: "Answer me in English.",
    sv: "Answer me in Swedish.",
  },
  ownTitle: "What should the agent know about you?",
  ownLead:
    "Write in your own words. The agent may fix typos, but the words stay yours.",
  ownPlaceholder:
    "For example what you do, what you're learning or what annoys you in answers.",
  ownAdd: "Add to the note",
  ownSkip: "Skip",
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
      {
        label: "Explain what you do",
        prose: "Tell me what you do and why, because I'm still learning.",
      },
      {
        label: "Ask when unclear",
        prose: "If my request is unclear, ask instead of guessing.",
      },
    ],
    ask: [
      {
        label: "Before publishing anything",
        prose: "Ask me before you publish anything or send changes to GitHub.",
      },
      {
        label: "Before deleting anything",
        prose: "Ask me before you delete anything.",
      },
      {
        label: "Act freely",
        prose: "Act freely, as long as you tell me afterwards what you did.",
      },
    ],
  },
  note: {
    title: "# A note for my agent",
    titleAdded: "## A note for my agent",
    me: (name: string) => `I'm ${name}.`,
    own: "## In my own words",
  },
  thread: "Conversation about the note",
  replies: "Answer choices",
  noteLabel: "Note",
  editorLabel: "The note's text",
  later: "Do this later",
  keep: "Leave as is",
  save: "Save",
  saveMerge: "Add to my instructions",
  copied: "Copied",
});
