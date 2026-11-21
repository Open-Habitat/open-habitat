import { catalog } from "../i18n";

// Settings › Tili › Ohjeet agentille and the onboarding step's outcome
// (app/AgentInstructions*.tsx). Accepted wording: issue
// new-user-agent-instructions-template, Settings round 2 (B1) and round 4.
const fi = {
  heading: "Ohjeet agentille",
  intro:
    "Muistilappu, jonka agentti lukee jokaisen keskustelun alussa, joten samoja asioita ei tarvitse kertoa uudelleen.",
  file: "Tiedosto",
  pi: "Pi lukee tämän tiedoston.",
  claudeImports: "Claude lukee sen tiedoston ~/.claude/CLAUDE.md kautta.",
  claudeOwn:
    "Claude ei lue tätä: tiedostossa ~/.claude/CLAUDE.md on omia ohjeita eikä viittausta tähän.",
  claudeNone: "Claude lukee sen, kun tiedosto on luotu.",
  claudeUnknown:
    "Tiedostoa ~/.claude/CLAUDE.md ei voitu lukea, joten ei tiedetä, lukeeko Claude tätä.",
  notYet: "ei vielä olemassa",
  modified: (d: string) => `Muokattu ${d}`,
  ownNote:
    "Agentti ei kirjoita olemassa olevan tekstin päälle, vaan lisää muutokset loppuun.",
  editWithAgent: "Muokkaa agentin kanssa",
  writeWithAgent: "Kirjoita agentin kanssa",
  emptyTitle: "Sinulla ei ole vielä muistilappua.",
  emptyLead:
    "Agentti kysyy pari asiaa ja kirjoittaa sen. Voit myös kirjoittaa itse Muokkaa-välilehdellä.",
  editorLabel: "Ohjeet agentille",
  loading: "Luetaan ohjeita",
  readError: "Ohjeita ei voitu lukea juuri nyt.",
  retry: "Yritä uudelleen",
  unsupported:
    "Tiedostoa ~/.pi/agent/AGENTS.md ei voi muokata täällä: se on linkki, sillä on useampi nimi tai se ei ole tavallista tekstiä. Muokkaa sitä itse tai pyydä agenttia.",
  tooLarge:
    "Tiedosto ~/.pi/agent/AGENTS.md on liian suuri muokattavaksi täällä (yli 256 KiB).",
  saveUncertain:
    "Tallennuksen tulos jäi epävarmaksi. Lataa sivu uudelleen ja tarkista ohjeet ennen kuin tallennat uudelleen.",
  saveLogin: "Istunto on päättynyt. Kirjaudu uudelleen ja tallenna sitten.",
  saveRefused: "Ohjeita ei tallennettu. Yritä hetken päästä uudelleen.",
  back: "Takaisin ohjeisiin",
  // The onboarding step's outcome.
  doneSaved: "Valmis",
  doneMerged: "Muistilappu täydennetty",
  doneSavedLead:
    "Agentti lukee muistilappusi jokaisen keskustelun alussa. Voit muuttaa sitä milloin vain: pyydä agenttia missä tahansa keskustelussa tai avaa Asetukset › Tili › Ohjeet agentille.",
  doneLater: "Voit tehdä tämän myöhemmin",
  doneLaterLead:
    "Mitään ei tallennettu. Kun haluat, pyydä agenttia kirjoittamaan muistilappu missä tahansa keskustelussa tai avaa Asetukset › Tili › Ohjeet agentille.",
  doneKept: "Muistilappusi pysyi ennallaan",
  doneKeptLead:
    "Mitään ei muutettu. Voit täydentää sitä milloin vain kohdasta Asetukset › Tili › Ohjeet agentille.",
  where: "Missä ohjeet ovat?",
  whereText:
    "Tiedostossa ~/.pi/agent/AGENTS.md. Claude lukee saman tiedoston, kun ~/.claude/CLAUDE.md viittaa siihen.",
  enter: "Siirry Habitatiin",
  notes: {
    saved: "Tallennettu",
    merged: "Täydennetty",
    later: "Myöhemmin",
    kept: "Ennallaan",
  },
};

export const agentInstructionsText = catalog(fi, {
  heading: "Agent instructions",
  intro:
    "The note the agent reads at the start of every conversation, so you don't need to repeat yourself.",
  file: "File",
  pi: "Pi reads this file.",
  claudeImports: "Claude reads it through ~/.claude/CLAUDE.md.",
  claudeOwn:
    "Claude doesn't read this: ~/.claude/CLAUDE.md has instructions of its own and no reference to this file.",
  claudeNone: "Claude reads it once the file exists.",
  claudeUnknown:
    "~/.claude/CLAUDE.md could not be read, so whether Claude reads this is not known.",
  notYet: "doesn't exist yet",
  modified: (d: string) => `Modified ${d}`,
  ownNote:
    "The agent doesn't write over the existing text; it adds changes at the end.",
  editWithAgent: "Edit with the agent",
  writeWithAgent: "Write with the agent",
  emptyTitle: "You don't have a note yet.",
  emptyLead:
    "The agent asks a couple of things and writes it. You can also write it yourself on the Edit tab.",
  editorLabel: "Agent instructions",
  loading: "Reading the instructions",
  readError: "The instructions could not be read right now.",
  retry: "Try again",
  unsupported:
    "~/.pi/agent/AGENTS.md can't be edited here: it is a link, has more than one name or isn't plain text. Edit it yourself or ask the agent.",
  tooLarge: "~/.pi/agent/AGENTS.md is too large to edit here (over 256 KiB).",
  saveUncertain:
    "Whether the save went through is not known. Reload the page and check the instructions before saving again.",
  saveLogin: "Your session ended. Sign in again, then save.",
  saveRefused: "The instructions were not saved. Try again in a moment.",
  back: "Back to the instructions",
  doneSaved: "All set",
  doneMerged: "Note extended",
  doneSavedLead:
    "The agent reads your note at the start of every conversation. Change it any time: ask the agent in any conversation or open Settings › Account › Agent instructions.",
  doneLater: "You can do this later",
  doneLaterLead:
    "Nothing was saved. When you want, ask the agent to write your note in any conversation or open Settings › Account › Agent instructions.",
  doneKept: "Your note stayed as it was",
  doneKeptLead:
    "Nothing was changed. You can extend it any time from Settings › Account › Agent instructions.",
  where: "Where are the instructions?",
  whereText:
    "In the file ~/.pi/agent/AGENTS.md. Claude reads the same file when ~/.claude/CLAUDE.md points to it.",
  enter: "Go to Habitat",
  notes: {
    saved: "Saved",
    merged: "Extended",
    later: "Later",
    kept: "Unchanged",
  },
});
