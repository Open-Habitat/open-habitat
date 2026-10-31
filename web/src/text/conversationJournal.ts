import { catalog } from "../i18n";

// The conversation's event stream (app/conversationJournal.ts): why it
// could not be opened or recovered.
const fi = {
  unreachable:
    "Tapahtumayhteyttä ei saatu. Tarkista verkkoyhteys tai yritä uudelleen.",
  forbidden: "Palvelin ei sallinut tapahtumayhteyttä.",
  serverDown:
    "Palvelimen tapahtumayhteys ei ole käytettävissä. Yritä uudelleen.",
  recoveryFailed: "Palvelimen tilaa ei saatu tarkistettua. Yritä uudelleen.",
};

export const conversationJournalText = catalog(fi, {
  unreachable:
    "Could not connect to the event stream. Check your network connection or try again.",
  forbidden: "The server did not allow the event stream.",
  serverDown: "The server's event stream is not available. Try again.",
  recoveryFailed: "Could not check the server's state. Try again.",
});
