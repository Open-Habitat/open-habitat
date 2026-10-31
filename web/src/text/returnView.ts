import { catalog } from "../i18n";

// "Pick up where you left off" (components/ReturnView.tsx): conversations
// grouped by what they wait for.
const fi = {
  inTerminal: "Käynnissä terminaalissa",
  processRunning: "Prosessi käynnissä",
  historyUnchecked: "Historiaa ei voitu tarkistaa",
  historyUnreadable: "Historia ei luettavissa",
  new: "Uusi",
  readOnly: "Vain luku",
  heading: "Jatka siitä, mihin jäit",
  intro:
    "Selainikkunan sulkeminen ei pysäytä käynnissä olevaa agenttia. Keskustelun avaaminen näyttää historian käynnistämättä agenttia. Selainistunnon ohjaus riippuu sen nykyisestä tilasta.",
  waitingForYou: "Odottaa sinua",
  running: "Käynnissä",
  conversations: "Keskustelut",
  otherConversations: "Muut keskustelut",
  emptyWorkspace: "Tässä työtilassa ei ole vielä keskusteluja.",
  empty: "Keskusteluja ei vielä näy. Valitse työtila vasemmalta.",
};

export const returnViewText = catalog(fi, {
  inTerminal: "Running in a terminal",
  processRunning: "Process running",
  historyUnchecked: "History could not be checked",
  historyUnreadable: "History not readable",
  new: "New",
  readOnly: "Read only",
  heading: "Pick up where you left off",
  intro:
    "Closing the browser window does not stop a running agent. Opening a conversation shows its history without starting the agent. Whether you can control a browser session depends on its current state.",
  waitingForYou: "Waiting for you",
  running: "Running",
  conversations: "Conversations",
  otherConversations: "Other conversations",
  emptyWorkspace: "This workspace has no conversations yet.",
  empty: "No conversations to show yet. Choose a workspace on the left.",
});
