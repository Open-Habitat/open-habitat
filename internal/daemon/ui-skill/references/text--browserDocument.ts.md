# text/browserDocument.ts

Generated from web/src/text/browserDocument.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// The open document's own messages (app/BrowserDocument.tsx): reading,
// saving and what a save did to changes made on disk.
const fi = {
  leaveConflict: (file: string, agent: boolean) =>
    agent
      ? `Agentti muutti samaa kohtaa tiedostossa ${file}. Oma teksti säilyy editorissa, kunnes hylkäät sen.`
      : `Tiedostoa ${file} muutettiin samasta kohdasta muualla. Oma teksti säilyy editorissa, kunnes hylkäät sen.`,
  unsupported: "Tiedoston tyyppiä, merkistöä tai suojausmetadataa ei tueta.",
  tooLarge: "Tiedosto on liian suuri. Enimmäiskoko on 1 MiB.",
  unreadable: "Tiedostoa ei voitu lukea työtilasta.",
  savedMerged: (agent: boolean) =>
    `Tallennettu. Tiedostossa ovat nyt sekä sinun että ${agent ? "agentin" : "levyllä tehdyt"} muutokset.`,
  savedReplacedAgent: (n: number, noted: boolean) =>
    `Tallennettu. ${n} ${n === 1 ? "agentin muutos korvattiin" : "agentin muutosta korvattiin"} sinun tekstilläsi${noted ? "; keskustelussa on siitä merkintä" : ""}.`,
  savedReplacedDisk: (n: number) =>
    `Tallennettu. ${n} ${n === 1 ? "levyllä tehty muutos korvattiin" : "levyllä tehtyä muutosta korvattiin"} sinun tekstilläsi.`,
  noSaveReply:
    "Tallennuksen tulosta ei saatu. Levyllä ei ole tekstiäsi; oma teksti säilyy editorissa.",
  saveUnknown:
    "Tallennuksen tulos ei ole tiedossa. Oma teksti säilyy. Tiedosto tarkistetaan uudelleen, kun palaat ikkunaan.",
  invalidText: "Teksti sisältää merkkejä, joita ei voida tallentaa.",
  saveFailed: "Tallennus ei onnistunut. Oma teksti säilyy.",
  keptChanging:
    "Tiedosto muuttui levyllä tallennuksen aikana useita kertoja. Oma teksti säilyy; yritä hetken päästä uudelleen.",
};

export const browserDocumentText = catalog(fi, {
  leaveConflict: (file, agent) =>
    agent
      ? `The agent changed the same place in ${file}. Your text stays in the editor until you discard it.`
      : `${file} was changed in the same place elsewhere. Your text stays in the editor until you discard it.`,
  unsupported:
    "The file's type, character encoding or protection metadata is not supported.",
  tooLarge: "The file is too large. The maximum size is 1 MiB.",
  unreadable: "The file could not be read from the workspace.",
  savedMerged: (agent) =>
    `Saved. The file now has both your changes and ${agent ? "the agent's" : "those made on disk"}.`,
  savedReplacedAgent: (n, noted) =>
    `Saved. ${n} ${plural("en", n, { one: "change", other: "changes" })} by the agent ${plural("en", n, { one: "was", other: "were" })} replaced with your text${noted ? "; the conversation has a note about it" : ""}.`,
  savedReplacedDisk: (n) =>
    `Saved. ${n} ${plural("en", n, { one: "change", other: "changes" })} made on disk ${plural("en", n, { one: "was", other: "were" })} replaced with your text.`,
  noSaveReply:
    "No reply to the save arrived. Your text is not on disk; it stays in the editor.",
  saveUnknown:
    "Whether the save went through is not known. Your text stays. The file is checked again when you return to the window.",
  invalidText: "The text contains characters that cannot be saved.",
  saveFailed: "Saving failed. Your text stays.",
  keptChanging:
    "The file changed on disk several times during the save. Your text stays; try again in a moment.",
});

```
