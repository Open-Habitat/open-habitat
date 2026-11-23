import { catalog } from "../i18n";

// Replying to one agent message (components/ReplyQuote.tsx,
// reply-to-message, experimental): the corner control on an agent message,
// the quote in the message field and the quote on the person's sent message.
// The agent receives the message's first sentence, at most 160 characters.
const fi = {
  reply: (time?: string) =>
    time ? `Vastaa tähän viestiin (klo ${time})` : "Vastaa tähän viestiin",
  replying: "Vastaat agentin viestiin",
  repliedTo: "Agentin viesti",
  remove: "Poista lainaus",
  jump: (time?: string) =>
    time ? `Siirry agentin viestiin klo ${time}` : "Siirry agentin viestiin",
  // The search band's line when a quote's original is no longer loaded or
  // was set aside with Palaa tähän.
  missing: "Viesti ei ole enää tässä jatkossa.",
};

export const replyQuoteText = catalog(fi, {
  reply: (time?: string) =>
    time ? `Reply to this message (${time})` : "Reply to this message",
  replying: "Replying to the agent's message",
  repliedTo: "Agent's message",
  remove: "Remove quote",
  jump: (time?: string) =>
    time ? `Go to the agent's message at ${time}` : "Go to the agent's message",
  missing: "The message is no longer in this continuation.",
});
