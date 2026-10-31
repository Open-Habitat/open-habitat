import { catalog, plural } from "../i18n";

// A shell command the agent ran (components/BashToolCard.tsx).
const fi = {
  lines: (n: number) => `${n} riviä`,
  firstLineOnly: "Vain ensimmäinen rivi",
  showAll: "Näytä koko komento",
  copied: "Komento kopioitu",
  copy: "Kopioi komento",
};

export const bashToolCardText = catalog(fi, {
  lines: (n) => `${n} ${plural("en", n, { one: "line", other: "lines" })}`,
  firstLineOnly: "First line only",
  showAll: "Show the whole command",
  copied: "Command copied",
  copy: "Copy command",
});
