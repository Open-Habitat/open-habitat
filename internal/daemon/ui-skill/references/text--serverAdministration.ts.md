# text/serverAdministration.ts

Generated from web/src/text/serverAdministration.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Settings › Palvelimen ylläpito › Yleiset and the lead of Käyttäjät ja pääsy
// (app/ServerAdministration.tsx).
const fi = {
  lead: "Palvelimen nimi ja kieli näkyvät kaikille sen käyttäjille.",
  accessLead: "Kuka saa kirjautua palvelimelle ja kuka sitä ylläpitää.",
  settingsUnavailable: "Ylläpitoasetuksia ei voitu ladata.",
  reloadData: "Lataa tiedot uudelleen",
  serverName: "Palvelimen nimi",
  serverNameDesc:
    "Näkyy kaikille sivupalkissa. Tallentuu, kun poistut kentästä.",
  nameEmpty: "nimi ei voi olla tyhjä.",
  loading: "Ladataan ylläpitoasetuksia…",
};

export const serverAdministrationText = catalog(fi, {
  lead: "The server's name and language are shown to everyone who uses it.",
  accessLead: "Who may sign in to the server and who administers it.",
  settingsUnavailable: "Administration settings could not be loaded.",
  reloadData: "Reload the information",
  serverName: "Server name",
  serverNameDesc:
    "Shown to everyone in the sidebar. Saved when you leave the field.",
  nameEmpty: "the name cannot be empty.",
  loading: "Loading administration settings…",
});

```
