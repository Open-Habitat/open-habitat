import { catalog } from "../i18n";

// Creating a conversation, sending, queueing and clearing the queue
// (app/ConversationActions.tsx): receipts and refusals.
const fi = {
  dismissNotice: "Sulje ilmoitus",
  // Why the host refused a message and what the person can do. A refusal
  // means nothing was written: the text is back in the field.
  readOnlyRefusal:
    "Viestiä ei lähetetty, koska tätä keskustelua voi nyt vain lukea. Teksti on kentässä: jatka keskustelua tai aloita uusi.",
  sendRefusal:
    "Viestiä ei lähetetty, koska keskustelun tila muuttui, esimerkiksi agentti ehti aloittaa työn. Teksti on kentässä: lähetä se uudelleen. Jos agentti työskentelee, viesti menee ohjauksena tai jonoon.",
  queueRefusal:
    "Viestiä ei lähetetty, koska agentin vuoro ehti päättyä tai keskustelun tila muuttui. Teksti on kentässä: lähetä se uudelleen.",
  creating: "Luodaan · tulos odottaa",
  closeEmptyFailed:
    "Edellistä tyhjää keskustelua ei voitu sulkea. Sulje se erikseen listasta.",
  createRefused: (reason: string) => `Uutta keskustelua ei luotu: ${reason}`,
  createUncertain:
    "Luonnin tulos epävarma. Päivitä tiedot ennen uutta yritystä; pyyntöä ei lähetetä automaattisesti uudelleen.",
  createUnconfirmed: "Istuntoa ei voitu vahvistaa. Luontia ei lähetetty.",
  awaitingAck: "Viesti odottaa kuittausta",
  awaitingNative: "Viesti odottaa natiivia hyväksyntää",
  sendError:
    "Lähetysvirhe. Tarkistetaan alkuperäisen viestin kuittaus automaattisesti.",
  queueRestored: "Jonosta poistetut viestit palautettiin kirjoituskenttään.",
  queueEmpty: "Jono oli jo tyhjä.",
  clearUncertain:
    "Jonon tyhjennyksen tulos epävarma. Tarkista tila; viestejä ei palautettu ilman kuittausta.",
  sessionUnconfirmed: "Istuntoa ei voitu vahvistaa.",
};

export const conversationActionsText = catalog(fi, {
  dismissNotice: "Dismiss notice",
  readOnlyRefusal:
    "The message was not sent because this conversation can only be read now. The text is back in the field: continue the conversation or start a new one.",
  sendRefusal:
    "The message was not sent because the conversation's state changed, for example the agent had already started working. The text is back in the field: send it again. If the agent is working, the message goes in as steering or into the queue.",
  queueRefusal:
    "The message was not sent because the agent's turn had already ended or the conversation's state changed. The text is back in the field: send it again.",
  creating: "Creating · waiting for the result",
  closeEmptyFailed:
    "The previous empty conversation could not be closed. Close it separately from the list.",
  createRefused: (reason) => `No new conversation was created: ${reason}`,
  createUncertain:
    "It is unclear whether the conversation was created. Refresh before trying again; the request is not resent automatically.",
  createUnconfirmed:
    "Your session could not be confirmed. Nothing was created.",
  awaitingAck: "The message is waiting to be acknowledged",
  awaitingNative: "The message is waiting for the agent to accept it",
  sendError:
    "Sending failed. Checking automatically whether the original message was acknowledged.",
  queueRestored: "The messages removed from the queue are back in the field.",
  queueEmpty: "The queue was already empty.",
  clearUncertain:
    "It is unclear whether the queue was cleared. Check the status; the messages were not returned without an acknowledgement.",
  sessionUnconfirmed: "Your session could not be confirmed.",
});
