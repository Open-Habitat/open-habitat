import { catalog } from "../i18n";

// One conversation's read model and journal recovery
// (app/useConversation.ts): load and send problems and receipts.
const fi = {
  loadFailed: "Keskustelua ei voitu ladata. Yritä uudelleen.",
  rejected:
    "Agentti ei ottanut viestiä vastaan. Teksti on kentässä: lähetä se uudelleen.",
  pending: "Viesti odottaa kuittausta. Tarkistetaan uudelleen.",
  uncertain: "Lähetyksen tulos on yhä epävarma. Viestiä ei lähetetä uudelleen.",
  continued:
    "Jatkaminen kuitattiin. Aiemman vuoron tulos on epävarma; tarkista natiivi historia.",
  controlGone:
    "Ohjaus ei ole enää käytettävissä. Lähetyksen tulos on epävarma.",
  disconnected: "Yhteys katkesi. Näytetään viimeisin tunnettu tila.",
};

export const useConversationText = catalog(fi, {
  loadFailed: "The conversation could not be loaded. Try again.",
  rejected:
    "The agent did not accept the message. The text is back in the field: send it again.",
  pending: "The message is waiting to be acknowledged. Checking again.",
  uncertain:
    "It is still unclear whether the message was sent. It will not be sent again.",
  continued:
    "Continuing was acknowledged. The outcome of the previous turn is unclear; check the native history.",
  controlGone:
    "This conversation can no longer be controlled from here. It is unclear whether the message was sent.",
  disconnected: "The connection was lost. Showing the last known state.",
});
