# text/inlineSettings.ts

Generated from web/src/text/inlineSettings.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The shared inline text field of Settings (components/InlineTextSetting.tsx)
// and GitHub's local disconnect (components/NativeDisconnect.tsx).
const fi = {
  unconfirmed: "muutosta ei voitu vahvistaa.",
  saving: "Tallennetaan…",
  saved: "Tallennettu",
  failed: (reason: string) =>
    `Ei tallennettu: ${reason} Teksti säilyi; yritä uudelleen Enterillä.`,
  invalid: (reason: string) => `Ei tallennettu: ${reason}`,
  reauth:
    "Kirjaudu ulos ja uudelleen GitHubilla ennen katkaisua (5 minuutin sisällä).",
  stateUnknown: "Paikallisen valtuutuksen tilaa ei voitu vahvistaa.",
  disconnected:
    "Paikallinen gh-valtuutus poistettu. GitHubin OAuth-lupaa ei peruttu.",
  uncertain:
    "Katkaisun tulos on epävarma tai osittainen. Tarkista tilanne uudelleen; älä toista automaattisesti.",
  note: "Katkaisu poistaa tämän käyttäjän paikallisen gh-valtuutuksen, ei GitHubin OAuth-lupaa. Vaatii uuden kirjautumisen.",
  check: "Tarkista katkaisu",
  question: "Irrotetaanko GitHub-yhteys?",
  effect:
    "Paikallinen gh-valtuutus poistuu. Työtilat ja keskustelut säilyvät. GitHubin OAuth-lupaa ei peruta; uudelleen kirjautuminen palauttaa yhteyden.",
  cancel: "Peruuta",
  confirm: "Katkaise paikallinen GitHub-yhteys",
};

export const inlineSettingsText = catalog(
  fi,
  {
    unconfirmed: "the change could not be confirmed.",
    saving: "Saving…",
    saved: "Saved",
    failed: (reason) =>
      `Not saved: ${reason} The text was kept; try again with Enter.`,
    invalid: (reason) => `Not saved: ${reason}`,
    reauth:
      "Sign out and in again with GitHub before disconnecting (within 5 minutes).",
    stateUnknown: "The local authorization's state could not be confirmed.",
    disconnected:
      "The local gh authorization was removed. GitHub's OAuth grant was not revoked.",
    uncertain:
      "The result of disconnecting is uncertain or partial. Check the situation again; do not repeat it automatically.",
    note: "Disconnecting removes this user's local gh authorization, not GitHub's OAuth grant. It needs a new sign-in.",
    check: "Check the disconnection",
    question: "Disconnect GitHub?",
    effect:
      "The local gh authorization is removed. Workspaces and conversations stay. GitHub's OAuth grant is not revoked; signing in again restores the connection.",
    cancel: "Cancel",
    confirm: "Disconnect the local GitHub connection",
  },
  {
    stateUnknown: "The local authorisation's state could not be confirmed.",
    disconnected:
      "The local gh authorisation was removed. GitHub's OAuth grant was not revoked.",
    note: "Disconnecting removes this user's local gh authorisation, not GitHub's OAuth grant. It needs a new sign-in.",
    effect:
      "The local gh authorisation is removed. Workspaces and conversations stay. GitHub's OAuth grant is not revoked; signing in again restores the connection.",
  },
);

```
