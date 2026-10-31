import { catalog } from "../i18n";

// Asking the agent about workers through a new conversation
// (app/newConversationAsk.ts).
const fi = {
  refused: (reason: string) => `Pyyntöä ei lähetetty: ${reason}`,
  uncertain:
    "Pyynnön tulos epävarma. Tarkista keskustelulista; pyyntöä ei lähetetä uudelleen automaattisesti.",
  sending: "Pyyntö on lähdössä.",
};

export const newConversationAskText = catalog(fi, {
  refused: (reason) => `The request was not sent: ${reason}`,
  uncertain:
    "The request's outcome is uncertain. Check the conversation list; the request is not sent again automatically.",
  sending: "The request is being sent.",
});
