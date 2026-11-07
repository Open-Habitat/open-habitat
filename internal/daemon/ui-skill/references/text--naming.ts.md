# text/naming.ts

Generated from web/src/text/naming.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Why the host did not name a conversation (app/namingRefusal.ts). A
// refusal is definite, so nothing was written. The host sends codes.
const fi = {
  titlePending:
    "Automaattinen otsikko on juuri tekeillä. Odota hetki, niin se ilmestyy; sen jälkeen voit luoda uuden, jos se ei sovi.",
  writerElsewhere:
    "Keskustelua kirjoittaa juuri toinen Pi, esimerkiksi päätteessä. Yritä uudelleen, kun se on päättynyt.",
  notNow:
    "Keskustelu oli juuri käynnistymässä tai pysähtymässä, tai sen tila muuttui kesken. Mitään ei muutettu. Odota hetki ja yritä uudelleen.",
  nameRefused: (reason: string) => `Nimeä ei vaihdettu. ${reason}`,
  // No model could make the title: none of the person's sign-ins reaches a
  // model the title helper can use.
  modelUnavailable:
    "Otsikkoa ei luotu, koska otsikointiin ei saatu käyttöön mallia. Voit nimetä keskustelun itse tai tarkistaa tekoälypalvelun kirjautumisen asetuksista.",
};

export const namingText = catalog(fi, {
  titlePending:
    "An automatic title is being made right now. Wait a moment for it to appear; afterwards you can make a new one if it does not fit.",
  writerElsewhere:
    "Another Pi, for example in a terminal, is writing the conversation right now. Try again once it has finished.",
  notNow:
    "The conversation was starting or stopping, or its state changed meanwhile. Nothing was changed. Wait a moment and try again.",
  nameRefused: (reason) => `The name was not changed. ${reason}`,
  modelUnavailable:
    "No title was made, because no model could be used for titling. You can name the conversation yourself or check your AI service sign-in in Settings.",
});

```
