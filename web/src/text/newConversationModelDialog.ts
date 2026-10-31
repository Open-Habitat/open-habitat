import { catalog } from "../i18n";

// The model choice when the agent's default is refused
// (app/NewConversationModelDialog.tsx).
const fi = {
  title: "Malli uudelle keskustelulle",
  defaultUnavailable:
    "Agentin oletusmalli ei ole käytettävissä. Valitse toinen malli. Oletusta ei muuteta.",
  cancel: "Peruuta",
  start: "Aloita keskustelu valitulla mallilla",
};

export const newConversationModelDialogText = catalog(fi, {
  title: "Model for the new conversation",
  defaultUnavailable:
    "The agent's default model is not available. Choose another model. The default is not changed.",
  cancel: "Cancel",
  start: "Start the conversation with this model",
});
