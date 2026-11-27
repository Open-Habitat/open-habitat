import { catalog } from "../i18n";

// Replying to one agent message or offer card (components/ReplyQuote.tsx,
// reply-to-message, experimental): the corner control on an agent message
// and on a view or file card, the quote in the message field and the quote
// on the person's sent message. The agent receives the message's first
// sentence, at most 160 characters, or the offer's id and source; the quote
// of an offer shows its title only (Jari 27.11.2026).
type OfferKind = "view" | "file" | "files";

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
  replyOffer: (title: string) => `Vastaa: ${title}`,
  replyingOffer: (kind: OfferKind): string =>
    kind === "view"
      ? "Vastaat näkymään"
      : kind === "files"
        ? "Vastaat tiedostopakettiin"
        : "Vastaat tiedostoon",
  repliedToOffer: (kind: OfferKind): string =>
    kind === "view"
      ? "Agentin näkymä"
      : kind === "files"
        ? "Agentin tiedostopaketti"
        : "Agentin tiedosto",
  jumpOffer: (title: string) => `Siirry korttiin: ${title}`,
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
  replyOffer: (title: string) => `Reply: ${title}`,
  replyingOffer: (kind: OfferKind): string =>
    kind === "view"
      ? "Replying to the view"
      : kind === "files"
        ? "Replying to the file package"
        : "Replying to the file",
  repliedToOffer: (kind: OfferKind): string =>
    kind === "view"
      ? "Agent's view"
      : kind === "files"
        ? "Agent's file package"
        : "Agent's file",
  jumpOffer: (title: string) => `Go to the card: ${title}`,
});
