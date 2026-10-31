import { catalog } from "../i18n";

// A notice an agent's extension sent (components/AgentNotice.tsx).
const fi = {
  label: "Agentin ilmoitus",
  close: "Sulje ilmoitus",
  notPersisted: "Ilmoitusta ei tallennettu historiaan.",
  persistenceUnknown: "Tallennusta historiaan ei voitu varmistaa.",
  temporary: "Tämä ilmoitus on väliaikainen.",
};

export const agentNoticeText = catalog(fi, {
  label: "Notice from the agent",
  close: "Dismiss notice",
  notPersisted: "The notice was not saved to the history.",
  persistenceUnknown: "Saving to the history could not be confirmed.",
  temporary: "This notice is temporary.",
});
