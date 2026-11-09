import { catalog } from "../i18n";

// The conversation's model and thinking level, shown in its details
// (components/ConversationModelDetails.tsx).
const fi = {
  label: "Keskustelun malli ja ajattelutaso",
  model: "Malli",
  signIn: "Kirjautuminen",
  others: "Samalla kirjautumisella myös",
  unknown: "Ei tiedossa",
  thinking: "Ajattelutaso",
  levels: (model: string, levels: string) =>
    `${model} osaa ajattelutasot ${levels}.`,
  chosenBefore:
    "Selaimessa malli ja ajattelutaso valitaan ennen keskustelun ensimmäistä viestiä.",
};

export const conversationModelDetailsText = catalog(fi, {
  label: "The conversation's model and thinking level",
  model: "Model",
  signIn: "Sign-in",
  others: "Also with the same sign-in",
  unknown: "Not known",
  thinking: "Thinking level",
  levels: (model, levels) => `${model} supports the thinking levels ${levels}.`,
  chosenBefore:
    "In the browser the model and thinking level are chosen before the conversation's first message.",
});
