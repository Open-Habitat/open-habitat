# text/speechSettings.tsx

Generated from web/src/text/speechSettings.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Settings › Sanelu and the administrator's Saneluavain
// (app/SpeechSettings.tsx).
const fi = {
  savedEu: "Avain tallennettu. Soniox hyväksyi sen EU-alueella.",
  savedUs:
    "Avain tallennettu. Soniox hyväksyi sen USA-alueella, ei oletuksena olevalla EU-alueella.",
  fromConsole: "Soniox-konsolista",
  rejected: (link: ReactNode): ReactNode => (
    <>
      Avainta ei tallennettu: Soniox ei tunne sitä EU- eikä USA-alueella, joten
      se on väärä tai peruttu. Hae uusi avain {link}.
    </>
  ),
  unavailable:
    "Avainta ei tallennettu, koska Sonioxiin ei saatu yhteyttä. Yritä hetken päästä uudelleen.",
  limit:
    "Avainta ei tallennettu, koska Sonioxin käyttöraja tuli vastaan. Yritä hetken päästä uudelleen.",
  apiKey: "Soniox API-avain",
  notKey: "Tämä ei näytä Soniox-avaimelta.",
  cancel: "Peruuta",
  save: "Tallenna",
  more: "Oikeudet ja säilytys",
  permissions:
    "Soniox-konsolissa avaimelle riittävät oikeudet Temporary API keys ja Speech-to-text, real-time.",
  reading: "Luetaan Soniox-avainta…",
  readFailed: "Soniox-avainta ei voitu lukea.",
  reload: "Lataa uudelleen",
  key: "Soniox-avain",
  none: "Ei avainta. Sanelu tarvitsee sen.",
  admins: (suffix: string, region: string) =>
    `Ylläpitäjän avain …${suffix} (${region}).`,
  own: (suffix: string, region: string) => `Oma avain …${suffix} (${region}).`,
  addOwn: "Lisää oma avain",
  replace: "Vaihda avain",
  remove: "Poista",
  saveNote:
    "Tallennus tarkistaa avaimen Sonioxilta ja tunnistaa sen alueen. Tallennettua avainta ei näytetä uudelleen.",
  uncertain: "Muutoksen tulos ei varmistunut. Tila luettiin uudelleen.",
  stored: (file: ReactNode): ReactNode => (
    <>Avain tallentuu tiedostoon {file}, ja agenttisi voivat käyttää sitä.</>
  ),
  given: {
    seeded: "sai avaimen",
    replaced: "sai uuden avaimen aiemman tilalle",
    already_current: "oli jo saanut sen",
    kept: "käyttää omaa avaintaan",
    not_reached: "ei tavoitettu",
    unknown: "tulos ei varmistunut",
  } as Record<string, string>,
  siteReading: "Luetaan saneluavainta…",
  siteReadFailed: "Saneluavainta ei voitu lukea.",
  siteIntro:
    "Kaikki, joilla ei ole omaa avainta, sanelevat tällä. Käyttö laskutetaan sinulta.",
  siteKey: "Yhteinen Soniox-avain",
  siteKeyState: (suffix: string, region: string, date: string) =>
    `…${suffix} (${region}), otettu käyttöön ${date}.`,
  siteNone: "Ei yhteistä avainta.",
  giving: "Tarkistetaan avainta ja annetaan sitä jo liittyneille…",
  missed: " Tavoittamattomat saavat avaimen, kun tallennat sen uudelleen.",
  siteCopy:
    "Jokainen saa avaimesta kopion kotihakemistoonsa, ja hänen agenttinsa voivat käyttää sitä. Kopiota ei voi perua kuin vaihtamalla avain Soniox-konsolissa.",
  siteJoined:
    "Jo liittyneet saavat avaimen heti, uudet ensimmäisellä kirjautumisellaan.",
  siteLimit: "Kaikki jakavat avaimen samanaikaisten sanelujen rajan.",
};

export const speechSettingsText = catalog(fi, {
  savedEu: "Key saved. Soniox accepted it in the EU region.",
  savedUs:
    "Key saved. Soniox accepted it in the US region, not in the default EU region.",
  fromConsole: "from the Soniox console",
  rejected: (link) => (
    <>
      The key was not saved: Soniox does not know it in the EU or the US region,
      so it is wrong or revoked. Get a new key {link}.
    </>
  ),
  unavailable:
    "The key was not saved because Soniox could not be reached. Try again in a moment.",
  limit:
    "The key was not saved because Soniox's usage limit was reached. Try again in a moment.",
  apiKey: "Soniox API key",
  notKey: "This does not look like a Soniox key.",
  cancel: "Cancel",
  save: "Save",
  more: "Permissions and storage",
  permissions:
    "In the Soniox console the key needs only the permissions Temporary API keys and Speech-to-text, real-time.",
  reading: "Reading the Soniox key…",
  readFailed: "The Soniox key could not be read.",
  reload: "Reload",
  key: "Soniox key",
  none: "No key. Dictation needs one.",
  admins: (suffix, region) => `The administrator's key …${suffix} (${region}).`,
  own: (suffix, region) => `Your own key …${suffix} (${region}).`,
  addOwn: "Add your own key",
  replace: "Change key",
  remove: "Remove",
  saveNote:
    "Saving checks the key with Soniox and finds its region. A saved key is not shown again.",
  uncertain:
    "The result of the change was not confirmed. The state was read again.",
  stored: (file) => (
    <>The key is saved in the file {file}, and your agents can use it.</>
  ),
  given: {
    seeded: "received the key",
    replaced: "received a new key in place of the earlier one",
    already_current: "already had it",
    kept: "use their own key",
    not_reached: "not reached",
    unknown: "result not confirmed",
  },
  siteReading: "Reading the dictation key…",
  siteReadFailed: "The dictation key could not be read.",
  siteIntro:
    "Everyone without a key of their own dictates with this. Use is billed to you.",
  siteKey: "Shared Soniox key",
  siteKeyState: (suffix, region, date) =>
    `…${suffix} (${region}), taken into use ${date}.`,
  siteNone: "No shared key.",
  giving: "Checking the key and giving it to those who have already joined…",
  missed: " Those not reached receive the key when you save it again.",
  siteCopy:
    "Everyone gets a copy of the key in their home directory, and their agents can use it. A copy cannot be revoked except by changing the key in the Soniox console.",
  siteJoined:
    "Those already joined receive the key at once, new people at their first sign-in.",
  siteLimit: "Everyone shares the key's limit of simultaneous dictations.",
});

```
