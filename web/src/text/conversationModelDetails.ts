import { catalog } from "../i18n";

// The conversation's model and thinking level, shown in its details
// (components/ConversationModelDetails.tsx).
const fi = {
  label: "Keskustelun malli ja ajattelutaso",
  model: "Malli",
  options: "Malli ja vaihtoehdot",
  current: " (käytössä)",
  unknownModel: "Mallia ei tiedetä.",
  thinking: "Ajattelutaso",
  thinkingLevels: "Ajattelutasot",
  unknown: "Ei tiedossa",
};

export const conversationModelDetailsText = catalog(fi, {
  label: "The conversation's model and thinking level",
  model: "Model",
  options: "Model and alternatives",
  current: " (in use)",
  unknownModel: "The model is not known.",
  thinking: "Thinking level",
  thinkingLevels: "Thinking levels",
  unknown: "Not known",
});
