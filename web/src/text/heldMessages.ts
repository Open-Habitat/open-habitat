import { catalog } from "../i18n";

// Messages held while the agent is busy or starting (app/heldMessages.ts):
// what became of them when they were returned, stopped or restarted.
const fi = {
  notSent: "Viestiä ei lähetetty. Teksti palautettiin kenttään.",
  rejected: "Agentti hylkäsi viestin. Teksti palautettiin kenttään.",
  notDelivered: "Viesti ei lähtenyt. Se on taas kentässä.",
  manyNotDelivered: "Viestit eivät lähteneet. Ne ovat taas kentässä.",
  alreadyTaken: "Agentti ehti jo ottaa viestin.",
  stopUncertain:
    "Pysäytyksen tulos on epävarma. Viestejä ei palautettu ilman daemonin kuittausta.",
  restartFailed:
    "Agenttia ei voitu käynnistää uudelleen. Viestit ovat tallessa.",
};

export const heldMessagesText = catalog(fi, {
  notSent: "The message was not sent. The text is back in the field.",
  rejected: "The agent declined the message. The text is back in the field.",
  notDelivered: "The message did not go out. It is back in the field.",
  manyNotDelivered: "The messages did not go out. They are back in the field.",
  alreadyTaken: "The agent had already taken the message.",
  stopUncertain:
    "It is unclear whether stopping worked. The messages stay held until the server confirms.",
  restartFailed: "The agent could not be restarted. Your messages are safe.",
});
