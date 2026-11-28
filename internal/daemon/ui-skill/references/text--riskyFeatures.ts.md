# text/riskyFeatures.ts

Generated from web/src/text/riskyFeatures.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Settings › Vaaralliset toiminnot (components/RiskyFeatures.tsx). Each
// member is off until the person allows it here after reading its warning;
// turning one off is immediate. The agent cannot allow one: no
// `open-habitat agent` command writes these, so an instruction that reached
// the agent is not offered a way to open the route for itself.
const fi = {
  intro:
    "Nämä ovat oletuksena pois. Jokainen antaa jonkin Habitatin ulkopuolisen vaikuttaa siihen, mitä agenttisi tekee, joten salli vain se, mitä käytät. Käytöstä poistaminen on aina turvallista ja tapahtuu heti.",
  allowed: "Sallittu",
  notAllowed: "Ei sallittu",
  allow: "Salli…",
  disable: "Poista käytöstä",
  allowsLabel: "Sallii:",
  since: (date: string, time: string) =>
    `Sallit tämän ${date} klo ${time}. Koskee tiliäsi kaikilla laitteilla.`,
  whenOn: "Kun tämä on päällä:",
  neverLabel: "Ei koskaan:",
  scope:
    "Asetus koskee tiliäsi kaikilla laitteilla. Voit poistaa sen käytöstä täältä milloin tahansa.",
  cancel: "Peru",
  readError: "Asetuksia ei saatu luettua.",
  writeError: "Muutosta ei saatu tallennettua.",
  reload: "Lue uudelleen",
  features: {
    "conversation-links": {
      name: "Keskustelulinkit",
      desc: "Linkki avaa uuden keskustelun työtilaasi ja kirjoittaa kenttään valmiin viestin.",
      allows:
        "Kuka tahansa, joka saa sinut painamaan linkkiä, voi kirjoittaa viestin, jonka annat agentille. Viesti voi pyytää mitä tahansa, mihin agentillasi on oikeus.",
      never:
        "Linkki ei lähetä mitään: viesti lähtee vasta, kun luet sen ja painat Lähetä. Linkki toimii vain omassa Habitatissasi kirjautuneena.",
      ask: "Sallitaanko keskustelulinkit?",
      confirm: "Salli keskustelulinkit",
    },
  },
};

export const riskyFeaturesText = catalog(fi, {
  intro:
    "These are off by default. Each one lets something outside Habitat influence what your agent does, so allow only what you use. Turning one off is always safe and happens at once.",
  allowed: "Allowed",
  notAllowed: "Not allowed",
  allow: "Allow…",
  disable: "Turn off",
  allowsLabel: "Allows:",
  since: (date: string, time: string) =>
    `You allowed this on ${date} at ${time}. Applies to your account on all devices.`,
  whenOn: "While this is on:",
  neverLabel: "Never:",
  scope:
    "The setting applies to your account on all devices. You can turn it off here at any time.",
  cancel: "Cancel",
  readError: "The settings could not be read.",
  writeError: "The change could not be saved.",
  reload: "Read again",
  features: {
    "conversation-links": {
      name: "Conversation links",
      desc: "A link opens a new conversation in your workspace and writes a prepared message in the field.",
      allows:
        "Anyone who gets you to press a link can write the message you give your agent. The message can ask for anything your agent is allowed to do.",
      never:
        "A link sends nothing: the message goes only when you have read it and pressed Send. A link works only in your own Habitat while you are signed in.",
      ask: "Allow conversation links?",
      confirm: "Allow conversation links",
    },
  },
});

```
