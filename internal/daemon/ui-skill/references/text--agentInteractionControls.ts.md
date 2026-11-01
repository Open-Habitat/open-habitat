# text/agentInteractionControls.ts

Generated from web/src/text/agentInteractionControls.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Sending to and stopping an agent (components/AgentInteractionControls.tsx).
const fi = {
  controls: "Agentin ohjaus",
  noHandler: "Ohjausta ei ole kytketty agenttiin.",
  sendPending: "Lähetyksen kuittausta odotetaan.",
  sendUncertainReason:
    "Edellisen lähetyksen tulos on epävarma. Tarkista tila ennen uutta lähetystä.",
  writeFirst: "Kirjoita viesti ennen lähetystä.",
  interruptPending: "Keskeytyksen kuittausta odotetaan.",
  interruptUncertainReason:
    "Keskeytyksen tulos on epävarma. Tarkista tila ennen uutta yritystä.",
  message: "Viesti agentille",
  send: "Lähetä",
  interrupt: "Keskeytä vuoro",
  messagePending: "Viesti odottaa kuittausta. Älä lähetä uudelleen.",
  messageAccepted: "Viesti hyväksyttiin. Tämä ei vahvista sen suorittamista.",
  rejectedTitle: "Viesti hylättiin",
  rejectedDetail:
    "Luonnos säilyy. Korjaa syy ja lähetä uudelleen vain tarkoituksella.",
  uncertainTitle: "Lähetyksen tulos on epävarma",
  uncertainDetail:
    "Viesti on voitu hyväksyä. Tarkista tila; tätä viestiä ei lähetetä automaattisesti uudelleen. Luonnos säilyy.",
  interruptWaiting: "Keskeytys odottaa kuittausta.",
  interruptAccepted:
    "Keskeytyspyyntö hyväksyttiin. Vuoron päättymistä ei ole vahvistettu.",
  interruptRejected: "Keskeytys hylättiin",
  interruptUncertainTitle: "Keskeytyksen tulos on epävarma",
  interruptUncertainDetail: "Tarkista tila ennen uutta yritystä.",
};

export const agentInteractionControlsText = catalog(fi, {
  controls: "Agent controls",
  noHandler: "No control is connected to the agent.",
  sendPending: "Waiting for the send to be acknowledged.",
  sendUncertainReason:
    "It is unclear whether the previous message was sent. Check the status before sending again.",
  writeFirst: "Write a message before sending.",
  interruptPending: "Waiting for the stop to be acknowledged.",
  interruptUncertainReason:
    "It is unclear whether the stop worked. Check the status before trying again.",
  message: "Message to the agent",
  send: "Send",
  interrupt: "Stop turn",
  messagePending:
    "The message is waiting to be acknowledged. Do not send it again.",
  messageAccepted:
    "The message was accepted. This does not confirm that it was carried out.",
  rejectedTitle: "The message was declined",
  rejectedDetail:
    "Your draft is kept. Fix the cause and send again only if you mean to.",
  uncertainTitle: "It is unclear whether the message was sent",
  uncertainDetail:
    "The message may have been accepted. Check the status; it will not be resent automatically. Your draft is kept.",
  interruptWaiting: "The stop is waiting to be acknowledged.",
  interruptAccepted:
    "The stop request was accepted. It is not yet confirmed that the turn ended.",
  interruptRejected: "The stop was declined",
  interruptUncertainTitle: "It is unclear whether the stop worked",
  interruptUncertainDetail: "Check the status before trying again.",
});

```
