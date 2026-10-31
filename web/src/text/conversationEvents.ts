import { catalog } from "../i18n";

// Live conversation events folded into turns (app/conversationEvents.ts):
// a tool call's placeholder and the states of a running tool.
const fi = {
  toolCall: "Työkalukutsu",
  toolStates: {
    running: "Käynnissä",
    succeeded: "Valmis",
    failed: "Epäonnistui",
    cancelled: "Keskeytetty",
  },
  toolStateUnknown: "Tila ei tiedossa",
};

export const conversationEventsText = catalog(fi, {
  toolCall: "Tool call",
  toolStates: {
    running: "Running",
    succeeded: "Done",
    failed: "Failed",
    cancelled: "Interrupted",
  },
  toolStateUnknown: "Status unknown",
});
