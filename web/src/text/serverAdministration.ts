import { catalog } from "../i18n";

// Settings › Palvelin and Levytila (app/ServerAdministration.tsx).
const fi = {
  storageUnavailable: "Tallennustietoja ei voitu ladata.",
  settingsUnavailable: "Ylläpitoasetuksia ei voitu ladata.",
  limitUncertain:
    "Muutosta ei voitu vahvistaa. Lataa tiedot uudelleen ennen uutta yritystä.",
  reloadData: "Lataa tiedot uudelleen",
  reload: "Lataa uudelleen",
  serverName: "Palvelimen nimi",
  serverNameDesc:
    "Näkyy kaikille sivupalkissa. Tallentuu, kun poistut kentästä.",
  nameEmpty: "nimi ei voi olla tyhjä.",
  disk: "Levy",
  noLimits:
    "Käyttäjäkohtaisia rajoja ei ole käytössä. Kotihakemistot jakavat tämän levyn, ja kuka tahansa voi täyttää sen.",
  limitsUnknown:
    "Kaikkia rajoja ei tiedetä. Levyn ylivarausta ei voida arvioida.",
  overcommitted:
    "Rajojen summa ylittää levyn koon. Se on sallittua, mutta levy voi täyttyä.",
  homeDisk: "Kotihakemistojen levy.",
  capacity: (total: string, free: string) =>
    `${total} yhteensä · ${free} vapaana`,
  defaultLimit: "Oletusraja",
  defaultLimitDesc: "Uusien käyttäjien raja. Ei muuta nykyisiä.",
  limitInvalid: "anna raja gigatavuina, esim. 8.",
  user: "Käyttäjä",
  storage: "Tallennustila",
  actions: "Toiminnot",
  noLimit: "Ei rajaa",
  unknownUsage: "Tilaa ei tiedetä",
  limitEdit: "Raja…",
  limitField: (user: string) => `${user}: raja (GiB)`,
  saveLimit: "Tallenna raja",
  cancel: "Peruuta",
  loading: "Ladataan ylläpitoasetuksia…",
};

export const serverAdministrationText = catalog(fi, {
  storageUnavailable: "Storage information could not be loaded.",
  settingsUnavailable: "Administration settings could not be loaded.",
  limitUncertain:
    "The change could not be confirmed. Reload the information before trying again.",
  reloadData: "Reload the information",
  reload: "Reload",
  serverName: "Server name",
  serverNameDesc:
    "Shown to everyone in the sidebar. Saved when you leave the field.",
  nameEmpty: "the name cannot be empty.",
  disk: "Disk",
  noLimits:
    "Per-user limits are not in use. The home directories share this disk, and anyone can fill it.",
  limitsUnknown:
    "Not all limits are known. Overcommitment of the disk cannot be assessed.",
  overcommitted:
    "The limits add up to more than the disk. That is allowed, but the disk can fill up.",
  homeDisk: "The disk of the home directories.",
  capacity: (total, free) => `${total} in total · ${free} free`,
  defaultLimit: "Default limit",
  defaultLimitDesc: "The limit for new users. Does not change existing ones.",
  limitInvalid: "give the limit in gigabytes, e.g. 8.",
  user: "User",
  storage: "Storage",
  actions: "Actions",
  noLimit: "No limit",
  unknownUsage: "Usage unknown",
  limitEdit: "Limit…",
  limitField: (user) => `${user}: limit (GiB)`,
  saveLimit: "Save limit",
  cancel: "Cancel",
  loading: "Loading administration settings…",
});
