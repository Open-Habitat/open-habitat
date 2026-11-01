# text/apple.tsx

Generated from web/src/text/apple.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// The Apple (iCloud) guide and its removal (components/AppleIntegration.tsx).
// Apple's own menu names stay in English, as Apple shows them.
const fi = {
  short: { mail: "posti", calendar: "kalenteri", contacts: "yhteystiedot" },
  failure: {
    credentials_rejected: "Apple ei hyväksynyt tunnusta ja salasanaa.",
    server_unreachable: "Appleen ei saatu yhteyttä.",
    endpoint_rejected: "iCloud ei kertonut palvelun osoitetta.",
    account_exists: "Oli jo yhdistetty.",
  } as Record<string, string>,
  and: " ja ",
  steps: {
    choose: "Palvelut",
    password: "Sovellussalasana",
    enter: "Tunnukset",
  },
  copy: (value: string) => `Kopioi ${value}`,
  renewWhy: (all: boolean, services: string) =>
    `Apple mitätöi sovellussalasanat, kun Apple-tilin salasana vaihdetaan. Luo uusi; se vaihtuu ${all ? `kaikkiin: ${services}` : `palveluun ${services}`}.`,
  signIn: "Kirjaudu:",
  generate: "Generate an app-specific password. Nimeksi",
  copyLooks: "Kopioi salasana, joka näyttää tältä:",
  twoFactor:
    "Vaatii kaksivaiheisen tunnistuksen. Jos vaihdat myöhemmin Apple-tilin salasanan, tämä salasana lakkaa toimimasta.",
  titleRenew: "Apple: uusi sovellussalasana",
  titleAdd: (services: string) => `Apple: lisää ${services}`,
  titleConnect: "Yhdistä Apple (iCloud)",
  whatGet: "Mitä agentit saavat käyttöönsä?",
  mailHint: " Lukeminen ja luonnokset.",
  otherHint: " Lukeminen ja muokkaus.",
  appleIdHint: "Sähköpostiosoite, jolla kirjaudut Appleen.",
  mailAddress: "iCloud Mail -osoite",
  mailAddressHint: "…@icloud.com, @me.com tai @mac.com. Posti tarvitsee sen.",
  reuse: (services: string) =>
    `Käyttää samaa sovellussalasanaa kuin ${services}.`,
  appPassword: "Sovellussalasana",
  looksWrong:
    "Ei näytä sovellussalasanalta. Älä anna Apple-tilin omaa salasanaa.",
  savedWhere: (hosts: string, mail: boolean) =>
    `Yhdistää ${hosts}. Salasana tallentuu vain kotihakemistosi ${mail ? "himalaya- ja curl-asetuksiin" : "curl-asetuksiin"}.`,
  uncertain:
    "Yhteys palvelimeen katkesi, eikä tiedetä, tallentuiko muutos. Tarkista tilanne Tiedot agenteille -sivulta ennen kuin yrität uudelleen.",
  close: "Sulje",
  notConnectedRetry: "Ei yhdistetty. Yritä myöhemmin uudelleen.",
  works: "Toimii",
  notConnected: "Ei yhdistetty",
  done: "Valmis",
  stepOf: (n: number, total: number) => `Vaihe ${n}/${total}`,
  havePassword: "Minulla on jo sovellussalasana",
  back: "Takaisin",
  cancel: "Peruuta",
  connecting: "Yhdistetään…",
  changePassword: "Vaihda salasana",
  connect: "Yhdistä",
  next: "Seuraava",
  removeQuestion: (id: string) => `Poistetaanko ${id}?`,
  removeTitle: (id: string) => `Poistetaanko Apple-tili ${id}?`,
  removeBody: (services: string, path: ReactNode): ReactNode => (
    <>
      Agentit eivät enää pääse palveluihin {services}. Kirjautuminen poistetaan
      tältä palvelimelta. Sovellussalasana pysyy voimassa Applella, kunnes
      poistat sen: {path}.
    </>
  ),
  remove: "Poista",
};

export const appleText = catalog(fi, {
  short: { mail: "mail", calendar: "calendar", contacts: "contacts" },
  failure: {
    credentials_rejected: "Apple did not accept the username and password.",
    server_unreachable: "Apple could not be reached.",
    endpoint_rejected: "iCloud did not tell the service's address.",
    account_exists: "Was already connected.",
  },
  and: " and ",
  steps: {
    choose: "Services",
    password: "App-specific password",
    enter: "Credentials",
  },
  copy: (value) => `Copy ${value}`,
  renewWhy: (all, services) =>
    `Apple invalidates app-specific passwords when the Apple account's password is changed. Create a new one; it replaces the password ${all ? `of all: ${services}` : `of ${services}`}.`,
  signIn: "Sign in:",
  generate: "Generate an app-specific password. Name it",
  copyLooks: "Copy the password, which looks like this:",
  twoFactor:
    "Needs two-factor authentication. If you later change the Apple account's password, this password stops working.",
  titleRenew: "Apple: new app-specific password",
  titleAdd: (services) => `Apple: add ${services}`,
  titleConnect: "Connect Apple (iCloud)",
  whatGet: "What do agents get to use?",
  mailHint: " Reading and drafts.",
  otherHint: " Reading and editing.",
  appleIdHint: "The email address you sign in to Apple with.",
  mailAddress: "iCloud Mail address",
  mailAddressHint: "…@icloud.com, @me.com or @mac.com. Mail needs it.",
  reuse: (services) => `Uses the same app-specific password as ${services}.`,
  appPassword: "App-specific password",
  looksWrong:
    "Does not look like an app-specific password. Do not give the Apple account's own password.",
  savedWhere: (hosts, mail) =>
    `Connects ${hosts}. The password is saved only in your home directory's ${mail ? "himalaya and curl settings" : "curl settings"}.`,
  uncertain:
    "The connection to the server broke, and it is not known whether the change was saved. Check the situation on the Data for agents page before you try again.",
  close: "Close",
  notConnectedRetry: "Not connected. Try again later.",
  works: "Works",
  notConnected: "Not connected",
  done: "Done",
  stepOf: (n, total) => `Step ${n}/${total}`,
  havePassword: "I already have an app-specific password",
  back: "Back",
  cancel: "Cancel",
  connecting: "Connecting…",
  changePassword: "Change password",
  connect: "Connect",
  next: "Next",
  removeQuestion: (id) => `Remove ${id}?`,
  removeTitle: (id) => `Remove the Apple account ${id}?`,
  removeBody: (services, path) => (
    <>
      Agents can no longer reach {services}. The sign-in is removed from this
      server. The app-specific password stays valid at Apple until you remove
      it: {path}.
    </>
  ),
  remove: "Remove",
});

```
