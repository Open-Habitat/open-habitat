# text/conversationWeight.ts

Generated from web/src/text/conversationWeight.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The one warning about a conversation's size (components/ConversationWeight.tsx):
// once as it nears the size where a new conversation is advised, and past it
// with the offer to continue in a new one. Nothing stops at either size; the
// numbers are in app/largeContent.ts. Source note for agents: the size is the
// Pi session file's, which grows with every picture and never shrinks.
const fi = {
  nearTitle: "Keskustelu on kasvamassa suureksi",
  near: (size: string) =>
    `Keskustelussa on jo ${size}, ja kokoa kertyy lähinnä kuvista. Yli 512 Mt:n keskustelun vanhat viestit latautuvat hitaasti, ja agentin herääminen kestää kauemmin.`,
  nearShort: (size: string) =>
    `Keskustelussa on jo ${size}. Yli 512 Mt:n keskustelu on hidas.`,
  heavyTitle: "Keskustelu on hyvin suuri",
  heavy: (size: string) =>
    `Keskustelussa on ${size}, joten se aukeaa uusimmista viesteistä, vanhemmat latautuvat hitaasti ja agentin herääminen kestää kauemmin. Jatka uudessa keskustelussa; tämä jää luettavaksi ja arkistoitavaksi.`,
  heavyShort: (size: string) =>
    `${size}: vanhat viestit latautuvat hitaasti. Jatka uudessa keskustelussa.`,
  newConversation: "Uusi keskustelu",
  dismiss: "Selvä",
};

export const conversationWeightText = catalog(fi, {
  nearTitle: "This conversation is getting large",
  near: (size) =>
    `The conversation already holds ${size}, mostly from pictures. Past 512 MB, older messages load slowly and the agent takes longer to wake.`,
  nearShort: (size) =>
    `The conversation already holds ${size}. Past 512 MB it gets slow.`,
  heavyTitle: "This conversation is very large",
  heavy: (size) =>
    `The conversation holds ${size}, so it opens from the newest messages, older ones load slowly and the agent takes longer to wake. Continue in a new conversation; this one stays readable and can be archived.`,
  heavyShort: (size) =>
    `${size}: older messages load slowly. Continue in a new conversation.`,
  newConversation: "New conversation",
  dismiss: "Got it",
});

```
