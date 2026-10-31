import { catalog } from "../i18n";

// The server's version in Settings (app/ServerVersion.tsx).
const fi = {
  missing: "ei saatu",
  older: "Tämä välilehti käyttää vanhempaa versiota.",
  reload: "Lataa uudelleen",
  current: "Tämä välilehti on ajan tasalla.",
  unchecked: "Välilehden versiota ei ole vielä tarkistettu.",
  version: "Versio",
  desc: "Palvelimella nyt käynnissä oleva versio.",
  line: "Palvelimen versio:",
};

export const serverVersionText = catalog(fi, {
  missing: "not received",
  older: "This tab runs an older version.",
  reload: "Reload",
  current: "This tab is up to date.",
  unchecked: "The tab's version has not been checked yet.",
  version: "Version",
  desc: "The version now running on the server.",
  line: "Server version:",
});
