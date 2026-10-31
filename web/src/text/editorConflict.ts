import { catalog } from "../i18n";

// The card over a line both the person and the disk changed
// (components/EditorConflict.tsx).
const fi = {
  agentChanged: "Agentti muutti saman rivin",
  diskChanged: "Sama rivi muuttui levyllä",
  agents: "Agentin",
  disks: "Levyn",
  yoursBelow: "Sinun rivisi on alla punaisella. Valitse, mikä jää.",
  lineDeleted: "(rivi poistettu)",
  yours: "Sinun",
  both: "Molemmat",
};

export const editorConflictText = catalog(fi, {
  agentChanged: "The agent changed the same line",
  diskChanged: "The same line changed on disk",
  agents: "Agent's",
  disks: "Disk's",
  yoursBelow: "Your line is below in red. Choose which one stays.",
  lineDeleted: "(line deleted)",
  yours: "Yours",
  both: "Both",
});
