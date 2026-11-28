import type { ReactNode } from "react";
import { catalog, formatNumber } from "../i18n";

// Conversation links (components/ConversationLink.tsx, app/conversationLink.ts):
// a link `<origin>/new/<workspace>#n=<length>&draft=<message>` opens a new
// conversation in that workspace with the message in its field, unsent, once
// the person has allowed links in Settings › Vaaralliset toiminnot. `n` is
// the message's length in characters (Unicode code points) and the message is
// URL-encoded; a message over 4 000 characters, or one whose length does not
// match `n` (a chat app cut the link), is left out whole. The workspace is
// named as in the sidebar, or by its directory name.
const fi = {
  mark: "Viesti linkistä. Mitään ei ole lähetetty.",
  markGroup: "Viesti linkistä",
  remove: "Poista linkin viesti",
  cardHead:
    "Viesti linkistä. Kentässä on keskeneräinen viestisi, joten tämä ei korvannut sitä.",
  append: "Lisää viestisi perään",
  replace: "Korvaa",
  dismiss: "Hylkää",
  offTitle: "Linkin viestiä ei kirjoitettu kenttään",
  offBody: (workspace: ReactNode): ReactNode => (
    <>
      Keskustelulinkit eivät ole sallittuja, joten linkki avasi vain uuden
      keskustelun työtilassa {workspace}. Jos sallit ne asetuksissa, viesti
      tulee kenttään, kun suljet asetukset.
    </>
  ),
  openSetting: "Avaa asetus",
  hiddenTitle: "Työtila on piilotettu",
  hiddenBody: (workspace: ReactNode): ReactNode => (
    <>
      Linkki osoittaa piilotettuun työtilaan {workspace}. Voit silti aloittaa
      keskustelun; työtila pysyy piilotettuna, ellet palauta sitä.
    </>
  ),
  restore: "Palauta työtila näkyviin",
  droppedTitle: "Linkin viesti jätettiin pois",
  droppedLong: (length: number, limit: number) =>
    `Viesti oli ${formatNumber(length)} merkkiä, ja linkin viestin raja on ${formatNumber(limit)}. Osaakaan ei näytetä, koska katkaistu ohje voi tarkoittaa muuta kuin koko ohje.`,
  droppedCut:
    "Linkki oli katkennut matkalla, joten viesti ei ollut kokonainen. Osaakaan ei näytetä, koska katkaistu ohje voi tarkoittaa muuta kuin koko ohje.",
  missingTitle: "Työtilaa ei löydy",
  missingBody: (workspace: ReactNode, kept: boolean): ReactNode => (
    <>
      Linkki avaisi uuden keskustelun työtilassa {workspace}, mutta sinulla ei
      ole sen nimistä työtilaa.
      {kept ? " Linkin viesti on tallessa alla." : null}
    </>
  ),
  copy: "Kopioi viesti",
  copied: "Viesti kopioitu",
  notCopied: "Viestiä ei voitu kopioida",
  otherWithMessage: "Aloita viestillä toisessa työtilassa",
  other: "Aloita uusi keskustelu toisessa työtilassa",
  noOther: "Sinulla ei ole muita työtiloja.",
  opening: "Avataan linkkiä…",
  signInTitle: "Kirjautumisen jälkeen jatkat linkin kohteeseen",
  signInBody: (workspace: ReactNode): ReactNode => (
    <>
      Uusi keskustelu työtilassa {workspace}. Linkin viesti säilyy tässä
      selaimessa kirjautumisen ajan eikä kulje kirjautumispalvelun kautta.
    </>
  ),
};

export const conversationLinkText = catalog(fi, {
  mark: "Message from a link. Nothing has been sent.",
  markGroup: "Message from a link",
  remove: "Remove the link's message",
  cardHead:
    "Message from a link. The field has your unfinished message, so this did not replace it.",
  append: "Add after your message",
  replace: "Replace",
  dismiss: "Discard",
  offTitle: "The link's message was not put in the field",
  offBody: (workspace) => (
    <>
      Conversation links are not allowed, so the link only opened a new
      conversation in the workspace {workspace}. If you allow them in Settings,
      the message goes into the field when you close Settings.
    </>
  ),
  openSetting: "Open the setting",
  hiddenTitle: "The workspace is hidden",
  hiddenBody: (workspace) => (
    <>
      The link points to the hidden workspace {workspace}. You can still start
      the conversation; the workspace stays hidden unless you restore it.
    </>
  ),
  restore: "Show the workspace again",
  droppedTitle: "The link's message was left out",
  droppedLong: (length, limit) =>
    `The message was ${formatNumber(length)} characters, and a link's message can be at most ${formatNumber(limit)}. None of it is shown, because part of an instruction can mean something other than the whole.`,
  droppedCut:
    "The link was cut short on the way, so the message was not whole. None of it is shown, because part of an instruction can mean something other than the whole.",
  missingTitle: "Workspace not found",
  missingBody: (workspace, kept) => (
    <>
      The link would open a new conversation in the workspace {workspace}, but
      you have no workspace with that name.
      {kept ? " The link's message is kept below." : null}
    </>
  ),
  copy: "Copy message",
  copied: "Message copied",
  notCopied: "The message could not be copied",
  otherWithMessage: "Start with the message in another workspace",
  other: "Start a new conversation in another workspace",
  noOther: "You have no other workspaces.",
  opening: "Opening the link…",
  signInTitle: "After signing in you continue to the link's destination",
  signInBody: (workspace) => (
    <>
      A new conversation in the workspace {workspace}. The link's message stays
      in this browser while you sign in and does not pass through the sign-in
      service.
    </>
  ),
});
