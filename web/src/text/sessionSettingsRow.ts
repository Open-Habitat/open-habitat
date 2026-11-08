import { catalog } from "../i18n";

// A change of the conversation's settings in its history, and the mark a
// compaction leaves there (components/SessionSettingsRow.tsx). `when` arrives
// formatted: "klo 20.44", "7.11. klo 9.05" ("at 20:44" in English).
const fi = {
  label: "Keskustelun asetukset",
  compacted: (when: string) =>
    when ? `Keskustelu tiivistettiin ${when}` : "Keskustelu tiivistettiin",
  summary: "Yhteenveto",
  modelChanged: "Malli vaihtui:",
  thinkingChanged: "Ajattelu vaihtui:",
};

export const sessionSettingsRowText = catalog(fi, {
  label: "Conversation settings",
  compacted: (when) =>
    when
      ? `The conversation was compacted ${when}`
      : "The conversation was compacted",
  summary: "Summary",
  modelChanged: "Model changed:",
  thinkingChanged: "Thinking changed:",
});
