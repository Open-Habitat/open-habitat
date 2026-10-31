import { catalog } from "../i18n";

// A change of the conversation's settings in its history
// (components/SessionSettingsRow.tsx).
const fi = {
  label: "Keskustelun asetukset",
  compaction: "Tiivistys",
  modelChanged: "Malli vaihtui:",
  thinkingChanged: "Ajattelu vaihtui:",
};

export const sessionSettingsRowText = catalog(fi, {
  label: "Conversation settings",
  compaction: "Compaction",
  modelChanged: "Model changed:",
  thinkingChanged: "Thinking changed:",
});
