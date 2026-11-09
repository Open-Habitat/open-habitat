# text/useConversation.ts

Generated from web/src/text/useConversation.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// One conversation's read model and journal recovery
// (app/useConversation.ts): load and send problems and receipts.
const fi = {
  loadFailed: "Keskustelua ei voitu ladata. Yritä uudelleen.",
  rejected:
    "Agentti ei ottanut viestiä vastaan. Teksti on kentässä: lähetä se uudelleen.",
  // Pi never received the message whole: handing it over was cut off,
  // usually because a very large image batch outlasted its budget, but also
  // when Pi ended meanwhile. Nothing of it ran.
  undelivered:
    "Agentti ei saanut viestiä: sen siirtäminen agentille keskeytyi. Teksti ja liitteet ovat taas kentässä. Isojen liitteiden siirto voi kestää liian kauan; lähetä silloin vähemmän kerrallaan.",
  pending: "Viesti odottaa kuittausta. Tarkistetaan uudelleen.",
  uncertain:
    "Lähetyksen tulos on yhä epävarma. Viesti lähetetään uudelleen vain, jos varmistuu, ettei agentti saanut sitä.",
  // A lost message proven undelivered is not sent again when the
  // conversation has moved on meanwhile (another message or turn).
  movedOn:
    "Viestiä ei lähetetty uudelleen, koska keskustelu on sillä välin jatkunut. Teksti on kentässä: lähetä se, jos se on yhä ajankohtainen.",
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
  undelivered:
    "The agent did not get the message: handing it over was cut off. The text and attachments are back in the field. Large attachments can take too long to hand over; if so, send fewer at a time.",
  pending: "The message is waiting to be acknowledged. Checking again.",
  uncertain:
    "It is still unclear whether the message was sent. It is sent again only if it turns out the agent did not get it.",
  movedOn:
    "The message was not sent again because the conversation has moved on in the meantime. The text is in the field: send it if it still applies.",
  continued:
    "Continuing was acknowledged. The outcome of the previous turn is unclear; check the native history.",
  controlGone:
    "This conversation can no longer be controlled from here. It is unclear whether the message was sent.",
  disconnected: "The connection was lost. Showing the last known state.",
});

```
