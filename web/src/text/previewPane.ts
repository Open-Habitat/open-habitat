import { catalog, plural } from "../i18n";

// The selected file, folder or command beside the composer's in-field list.
const fi = {
  nothingSelected: "Ei valittua.",
  source: "Lähde",
  runsAtOnce: "Ajetaan heti, kun valitset sen. Ei lähetä mitään agentille.",
  terminalOnly:
    "Tämä laajennuksen komento avaa agentin päätteen valikon, joten selain ei voi ajaa sitä.",
  addsSkill:
    "Lisätään viestin alkuun. Kun lähetät viestin, agentti lataa taidon.",
  addsPrompt:
    "Lisätään viestin alkuun. Kun lähetät viestin, agentti laajentaa pohjan.",
  addsCommand:
    "Lisätään viestin alkuun. Kun lähetät viestin, agentti ajaa komennon.",
  previewFailed: "Esikatselua ei saatu.",
  reading: "Luetaan…",
  binary: "Binääritiedosto: ei esikatselua.",
  changedState: "Muutettu: muutokset viimeisimpään committiin.",
  untrackedState: "Uusi tiedosto, ei vielä Gitissä.",
  changedBeneath: (n: number) =>
    plural("fi", n, {
      one: `${n} muutettu tiedosto`,
      other: `${n} muutettua tiedostoa`,
    }),
  emptyFolder: "Kansio on tyhjä.",
};

export const previewPaneText = catalog(fi, {
  nothingSelected: "Nothing selected.",
  source: "Source",
  runsAtOnce: "Runs as soon as you choose it. Sends nothing to the agent.",
  terminalOnly:
    "This extension command opens a menu in the agent's terminal, so the browser cannot run it.",
  addsSkill:
    "Added at the start of the message. When you send it, the agent loads the skill.",
  addsPrompt:
    "Added at the start of the message. When you send it, the agent expands the template.",
  addsCommand:
    "Added at the start of the message. When you send it, the agent runs the command.",
  previewFailed: "The preview could not be loaded.",
  reading: "Reading…",
  binary: "Binary file: no preview.",
  changedState: "Changed: changes since the last commit.",
  untrackedState: "New file, not yet in Git.",
  changedBeneath: (n) =>
    `${n} changed ${plural("en", n, { one: "file", other: "files" })}`,
  emptyFolder: "The folder is empty.",
});
