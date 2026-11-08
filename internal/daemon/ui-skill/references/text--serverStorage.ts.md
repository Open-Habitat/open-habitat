# text/serverStorage.ts

Generated from web/src/text/serverStorage.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Settings › Palvelimen ylläpito › Levytila (app/ServerStorage.tsx). A
// person's limit is called their own when it differs from the default limit;
// the host keeps one limit per person, and the default applies to new users.
const fi = {
  lead: "Henkilöiden kotihakemistot jakavat yhden levyn. Raja koskee yhden henkilön kotihakemistoa.",
  leadNoLimits:
    "Henkilöiden kotihakemistot jakavat yhden levyn. Käyttäjäkohtaisia rajoja ei ole käytössä, joten kuka tahansa voi täyttää sen.",
  storageUnavailable: "Tallennustietoja ei voitu ladata.",
  settingsUnavailable: "Ylläpitoasetuksia ei voitu ladata.",
  limitUncertain:
    "Muutosta ei voitu vahvistaa. Lataa tiedot uudelleen ennen uutta yritystä.",
  defaultUncertain:
    "Oletusrajan muutosta ei voitu vahvistaa. Näkyvä raja on luettu palvelimelta uudelleen.",
  reloadData: "Lataa tiedot uudelleen",
  reload: "Lataa uudelleen",
  disk: "Levy",
  limitsUnknown:
    "Kaikkia rajoja ei tiedetä. Levyn ylivarausta ei voida arvioida.",
  overcommitted:
    "Rajojen summa ylittää levyn koon. Se on sallittua, mutta levy voi täyttyä.",
  capacity: (total: string, free: string) =>
    `${total} yhteensä · ${free} vapaana`,
  meter: (used: string, worst: string, total: string) =>
    worst
      ? `Käytössä nyt ${used}, jos jokainen täyttää rajansa ${worst} / ${total}`
      : `Käytössä nyt ${used} / ${total}`,
  usedNow: "Käytössä nyt",
  worst: "Jos jokainen täyttää rajansa",
  defaultLimit: "Oletusraja",
  defaultLimitDesc: "Uusien käyttäjien raja. Ei muuta nykyisiä.",
  people: "Henkilöt",
  person: "Henkilö",
  used: "Käytössä",
  limit: "Raja",
  noLimit: "Ei rajaa",
  unknownUsage: "Tilaa ei tiedetä",
  usesDefault: "oletus",
  ownLimit: "oma raja",
  personLimit: (name: string) => `Raja: ${name}`,
  // The reset beside a person's stepper is an icon; its tooltip and its
  // accessible name say what it restores to.
  toDefault: (limit: string) => `Palauta oletukseen (${limit})`,
  toDefaultFor: (name: string, limit: string) =>
    `Palauta oletukseen (${limit}): ${name}`,
  saving: "Tallennetaan…",
  loading: "Ladataan levytilaa…",
};

export const serverStorageText = catalog(fi, {
  lead: "People's home directories share one disk. A limit applies to one person's home directory.",
  leadNoLimits:
    "People's home directories share one disk. Per-user limits are not in use, so anyone can fill it.",
  storageUnavailable: "Storage information could not be loaded.",
  settingsUnavailable: "Administration settings could not be loaded.",
  limitUncertain:
    "The change could not be confirmed. Reload the information before trying again.",
  defaultUncertain:
    "The change to the default limit could not be confirmed. The limit shown has been read from the server again.",
  reloadData: "Reload the information",
  reload: "Reload",
  disk: "Disk",
  limitsUnknown:
    "Not all limits are known. Overcommitment of the disk cannot be assessed.",
  overcommitted:
    "The limits add up to more than the disk. That is allowed, but the disk can fill up.",
  capacity: (total, free) => `${total} in total · ${free} free`,
  meter: (used, worst, total) =>
    worst
      ? `In use now ${used}, if everyone filled their limit ${worst} / ${total}`
      : `In use now ${used} / ${total}`,
  usedNow: "In use now",
  worst: "If everyone filled their limit",
  defaultLimit: "Default limit",
  defaultLimitDesc: "The limit for new users. Does not change existing ones.",
  people: "People",
  person: "Person",
  used: "In use",
  limit: "Limit",
  noLimit: "No limit",
  unknownUsage: "Usage unknown",
  usesDefault: "default",
  ownLimit: "own limit",
  personLimit: (name) => `Limit: ${name}`,
  toDefault: (limit) => `Reset to default (${limit})`,
  toDefaultFor: (name, limit) => `Reset to default (${limit}): ${name}`,
  saving: "Saving…",
  loading: "Loading disk space…",
});

```
