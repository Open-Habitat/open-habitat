# text/siteKey.ts

Generated from web/src/text/siteKey.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// Settings › AI-avain: the site's AI key, its removal and the copies given
// to people who joined earlier (components/SiteKeySettings.tsx,
// components/SiteKeyCopies.tsx, app/SiteKeyAdministration.tsx).
const fi = {
  and: " ja ",
  github: (id: string) => `GitHub ${id}`,
  apiKey: (name: string, replacing: boolean) =>
    `${replacing ? "Uusi " : ""}${name} API-avain`,
  replace: "Vaihda avain…",
  remove: "Poista avain…",
  provider: "Avaimen palvelu",
  replaceKey: "Vaihda avain",
  useKey: "Ota avain käyttöön",
  cancel: "Peruuta",
  notKey: (name: string, prefix: string) =>
    `Tämä ei näytä ${name}-avaimelta (${prefix}).`,
  sentOnce: "Avain lähetetään kerran eikä sitä näytetä uudelleen.",
  removeQuestion: "Poistetaanko sivuston avain?",
  removeEffect: "Uudet henkilöt valitsevat AI-tilin taas itse.",
  copiesStay: (name: string) =>
    `Jo jaetut kopiot jäävät. Niiden käytön estää vain avaimen mitätöinti palvelussa${name}.`,
  holders: (n: number, people: string, name: string) =>
    `Sivusto on antanut avaimen ${n} henkilölle: ${people}. Kopiot jäävät heille. Niiden käytön estää vain avaimen mitätöinti palvelussa${name}. Seuraava avain vaihtaa ne.`,
  noHolders: "Avainta ei ole annettu kenellekään jo liittyneelle.",
  removeKey: "Poista avain",
  terms:
    "Uusi henkilö saa avaimesta kopion omiin tunnuksiinsa, jos hänellä ei ole omaa, eikä näe AI-vaihetta. Käyttö laskutetaan avaimen tililtä. Jo liittyneille annat avaimen alta. Kun vaihdat avaimen, sivuston antamat kopiot vaihtuvat uuteen. Jaettua kopiota ei voi perua.",
  check: {
    absent: {
      label: (name: string) => `Ei ${name}-tunnusta`,
      effect: "Saa avaimen",
    },
    earlier: {
      label: () => "Sivuston aiempi avain",
      effect: "Kopio vaihtuu uuteen",
    },
    current: { label: () => "On jo tämä avain", effect: "Ei muutosta" },
    own: {
      label: (name: string) => `Oma ${name}-tunnus`,
      effect: "Ei koskaan korvata",
    },
    unknown: { label: () => "Ei vastausta", effect: "Ei tarkistettu" },
  },
  outcome: {
    seeded: "Avain kirjoitettu",
    replaced: "Kopio vaihdettu uuteen",
    already_current: "Oli jo tämä avain",
    kept: "Oma tunnus, ei muutettu",
    not_reached: "Ei tavoitettu, ei kirjoitettu",
    unknown: "Ei vastausta, tulos ei varmistunut",
  } as Record<string, string>,
  joined: "Jo liittyneet",
  person: "Henkilö",
  copy: "Avain",
  joinedDesc:
    "Henkilöt, jotka liittyivät ennen avainta tai saivat aiemman avaimen. Lista kertoo, mitä sivusto on antanut. Mitä heidän Pi:llään nyt on, tarkistetaan vasta antaessa.",
  giveAll: "Anna avain liittyneille…",
  given: (day: string) => `Annettu ${day}`,
  earlierKey: (suffix: string) => `(aiempi avain …${suffix})`,
  notGiven: "Ei annettu",
  waiting: (n: number) =>
    `${n} sallittua ei ole vielä kirjautunut; he saavat avaimen ensimmäisellä kirjautumisella. `,
  removedNotListed: "Poistetut eivät ole mukana.",
  setFirst: " Aseta avain ensin.",
  giveOne: (who: string) => `Anna sivuston AI-avain ${who}:lle`,
  giveMany: "Anna sivuston AI-avain liittyneille",
  checking: "Tarkistetaan henkilön omasta palvelusta, mitä hänen Pi:llään on…",
  done: "Valmis.",
  checked:
    "Tarkistettu henkilön omasta palvelusta juuri nyt. Kirjoitushetkellä tarkistus tehdään uudelleen.",
  writing: "Kirjoitetaan…",
  checkingShort: "Tarkistetaan…",
  writesOwn: (one: boolean, name: string) =>
    `Kirjoitat toisen henkilön omiin tunnuksiin. Avain menee ${one ? "hänen" : "heidän"} Pi:hinsä, ${one ? "hänen" : "heidän"} agenttinsa käyttävät sitä, ja ${name} laskuttaa sivuston tiliä.`,
  copyTheirs: (one: boolean, name: string) =>
    `Kopio on ${one ? "hänen" : "heidän"}. ${one ? "Hän ja hänen" : "He ja heidän"} agenttinsa voivat lukea avaimen. Kopiota ei voi perua täältä; käytön estää vain avaimen mitätöinti palvelussa ${name}.`,
  neverReplaced:
    "Oma avain tai tilaus ei koskaan korvaudu. Aiemmin annettu sivuston kopio vaihtuu uuteen.",
  theySee: (one: boolean) =>
    `${one ? "Hän näkee" : "He näkevät"} kohdassa Asetukset › Tekoäly, että avain on ylläpitäjän antama, ja ${one ? "voi" : "voivat"} vaihtaa sen omaansa.`,
  close: "Sulje",
  writeOne: (who: string) => `Kirjoita avain ${who}:n tunnuksiin`,
  writeMany: (n: number) => `Kirjoita avain ${n} henkilölle`,
  rotated: "Avain vaihdettu.",
  replacedFor: (n: number, people: string) =>
    ` Sivuston aiempi kopio vaihdettiin uuteen ${n} henkilöltä: ${people}.`,
  missed: (people: string) =>
    ` Ei tavoitettu: ${people}. Heille ei kirjoitettu nyt mitään; anna uusi avain, kun heidän palvelunsa vastaa.`,
  unconfirmed: (people: string) =>
    ` Tulos ei varmistunut: ${people}. Kopio on voinut vaihtua; tarkista antamalla avain uudelleen.`,
  taken: "Avain otettu käyttöön.",
  newGet: "Uudet henkilöt saavat siitä kopion.",
  joinedDontGet: (n: number) =>
    ` ${n} jo liittynyttä eivät saa sitä itsestään; anna se heille alta.`,
  readFailed: "AI-avainta ei voitu lukea.",
  reload: "Lataa uudelleen",
  loading: "Ladataan AI-avainta…",
  giveNew: "Anna uusi avain heille…",
  removed:
    "Avain poistettu. Uudet henkilöt valitsevat AI-tilin itse. Annetut kopiot jäivät.",
  uncertain: "Muutoksen tulos ei varmistunut.",
  oldCopies: (n: number, people: string) =>
    `Sivuston aiemman avaimen kopio on ${n} henkilöllä: ${people}.`,
  joinedFailed: "Jo liittyneitä ei voitu lukea.",
};

export const siteKeyText = catalog(fi, {
  and: " and ",
  github: (id) => `GitHub ${id}`,
  apiKey: (name, replacing) => `${replacing ? "New " : ""}${name} API key`,
  replace: "Change key…",
  remove: "Remove key…",
  provider: "Key's service",
  replaceKey: "Change key",
  useKey: "Take the key into use",
  cancel: "Cancel",
  notKey: (name, prefix) =>
    `This does not look like a ${name} key (${prefix}).`,
  sentOnce: "The key is sent once and not shown again.",
  removeQuestion: "Remove the site's key?",
  removeEffect: "New people choose their AI account themselves again.",
  copiesStay: (name) =>
    `Copies already given stay. Only invalidating the key at${name || " the service"} stops their use.`,
  holders: (n, people, name) =>
    `The site has given the key to ${n} ${plural("en", n, { one: "person", other: "people" })}: ${people}. The copies stay with them. Only invalidating the key at${name || " the service"} stops their use. The next key replaces them.`,
  noHolders: "The key has not been given to anyone who already joined.",
  removeKey: "Remove key",
  terms:
    "A new person gets a copy of the key in their own credentials if they have none of their own, and does not see the AI step. Use is billed to the key's account. You give the key to those already joined below. When you change the key, the copies the site gave are replaced with the new one. A copy given cannot be revoked.",
  check: {
    absent: {
      label: (name) => `No ${name} credential`,
      effect: "Gets the key",
    },
    earlier: {
      label: () => "The site's earlier key",
      effect: "The copy is replaced",
    },
    current: { label: () => "Already has this key", effect: "No change" },
    own: {
      label: (name) => `Own ${name} credential`,
      effect: "Never replaced",
    },
    unknown: { label: () => "No answer", effect: "Not checked" },
  },
  outcome: {
    seeded: "Key written",
    replaced: "Copy replaced",
    already_current: "Already had this key",
    kept: "Own credential, not changed",
    not_reached: "Not reached, not written",
    unknown: "No answer, result not confirmed",
  },
  joined: "Already joined",
  person: "Person",
  copy: "Key",
  joinedDesc:
    "People who joined before the key or received an earlier key. The list tells what the site has given. What their Pi has now is checked only when giving.",
  giveAll: "Give the key to those joined…",
  given: (day) => `Given ${day}`,
  earlierKey: (suffix) => `(earlier key …${suffix})`,
  notGiven: "Not given",
  waiting: (n) =>
    `${n} allowed ${plural("en", n, { one: "person has", other: "people have" })} not signed in yet; they get the key at their first sign-in. `,
  removedNotListed: "Removed people are not included.",
  setFirst: " Set the key first.",
  giveOne: (who) => `Give the site's AI key to ${who}`,
  giveMany: "Give the site's AI key to those joined",
  checking: "Checking with the person's own service what their Pi has…",
  done: "Done.",
  checked:
    "Checked with the person's own service just now. The check is made again at the moment of writing.",
  writing: "Writing…",
  checkingShort: "Checking…",
  writesOwn: (one, name) =>
    `You write into another person's own credentials. The key goes to ${one ? "their" : "their"} Pi, ${one ? "their" : "their"} agents use it, and ${name} bills the site's account.`,
  copyTheirs: (one, name) =>
    `The copy is ${one ? "theirs" : "theirs"}. They and their agents can read the key. The copy cannot be revoked from here; only invalidating the key at ${name} stops its use.`,
  neverReplaced:
    "An own key or subscription is never replaced. A site copy given earlier is replaced with the new one.",
  theySee: (one) =>
    `${one ? "They see" : "They see"} under Settings › AI that the key was given by the administrator, and can change it to their own.`,
  close: "Close",
  writeOne: (who) => `Write the key into ${who}'s credentials`,
  writeMany: (n) =>
    `Write the key for ${n} ${plural("en", n, { one: "person", other: "people" })}`,
  rotated: "Key changed.",
  replacedFor: (n, people) =>
    ` The site's earlier copy was replaced for ${n} ${plural("en", n, { one: "person", other: "people" })}: ${people}.`,
  missed: (people) =>
    ` Not reached: ${people}. Nothing was written for them now; give the new key when their service answers.`,
  unconfirmed: (people) =>
    ` Result not confirmed: ${people}. The copy may have been replaced; check by giving the key again.`,
  taken: "Key taken into use.",
  newGet: "New people get a copy of it.",
  joinedDontGet: (n) =>
    ` ${n} already joined ${plural("en", n, { one: "does", other: "do" })} not get it by themselves; give it to them below.`,
  readFailed: "The AI key could not be read.",
  reload: "Reload",
  loading: "Loading the AI key…",
  giveNew: "Give the new key to them…",
  removed:
    "Key removed. New people choose their AI account themselves. The copies given stayed.",
  uncertain: "The result of the change was not confirmed.",
  oldCopies: (n, people) =>
    `${n} ${plural("en", n, { one: "person has", other: "people have" })} a copy of the site's earlier key: ${people}.`,
  joinedFailed: "Those already joined could not be read.",
});

```
