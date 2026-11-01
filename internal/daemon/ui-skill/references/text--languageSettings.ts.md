# text/languageSettings.ts

Generated from web/src/text/languageSettings.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The language rows of Settings: the person's own choice and the server's
// default. A language's own name is always written in that language.
const fi = {
  label: "Kieli",
  desc: "Käyttöliittymän kieli. Koskee kaikkia laitteitasi. Järjestelmä seuraa palvelimen oletusta ja sen jälkeen selaimen kieltä.",
  system: "Järjestelmä",
  systemNote: "Palvelimen oletus, sitten selaimen kieli.",
  serverSystemNote: "Seuraa kunkin selaimen kieltä.",
  fiNote: "Suomenkielinen käyttöliittymä.",
  usNote: "Amerikanenglannin kirjoitusasu ja lukumuodot.",
  ukNote: "Brittienglannin kirjoitusasu ja lukumuodot.",
  error:
    "Kielivalintaa ei voitu vahvistaa. Lue tallennettu valinta uudelleen ennen uutta yritystä.",
  reload: "Lue tallennettu valinta",
  serverLabel: "Oletuskieli",
  serverDesc:
    "Kieli niille, jotka eivät ole valinneet omaansa, ja kirjautumissivu. Järjestelmä seuraa kunkin selaimen kieltä: suomenkielinen selain saa suomen, muut englannin.",
  serverError: "Oletuskieltä ei voitu tallentaa. Yritä uudelleen.",
};

export const languageSettingsText = catalog(fi, {
  label: "Language",
  desc: "The interface language. Applies to all your devices. System follows the server's default and then the browser's language.",
  system: "System",
  systemNote: "Server default, then browser language.",
  serverSystemNote: "Follow each browser's language.",
  fiNote: "Finnish interface.",
  usNote: "US English spelling and number formats.",
  ukNote: "UK English spelling and number formats.",
  error:
    "The language choice could not be confirmed. Read the saved choice again before trying again.",
  reload: "Read the saved choice",
  serverLabel: "Default language",
  serverDesc:
    "The language for people who have not chosen their own, and for the sign-in page. System follows each browser's language: a Finnish browser gets Finnish, others English.",
  serverError: "The default language could not be saved. Try again.",
});

```
