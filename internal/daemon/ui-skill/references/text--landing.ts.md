# text/landing.ts

Generated from web/src/text/landing.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// public/landing-bootstrap.js paints `connecting` and `slow` before the
// bundle runs; keep its copies the same.
const fi = {
  connecting: "Yhdistetään palvelimeen…",
  greeting: (name: string) => `Hei ${name}. Haetaan työtilojasi…`,
  slow: "Yhdistäminen kestää tavallista pidempään. Odotetaan yhä; voit jättää sivun auki.",
  failedTitle: "Yhteyttä ei saatu",
  failedDetail:
    "Työtilojasi ei saatu vielä näkyviin. Tämä ei tarkoita, että ne olisivat kadonneet.",
  answerTitle: "Työtiloja ei saatu luettua",
  answerDetail:
    "Vika ei ole sinun yhteydessäsi. Jos tämä jatkuu, kerro palvelimen ylläpitäjälle.",
  identityTitle: "Kirjautumista ei saatu varmistettua",
  identityDetail:
    "Sivu ei saanut varmistettua, kenen työtilat se näyttää, joten se ei näytä mitään. Näin voi käydä, jos toisessa välilehdessä kirjauduttiin toisella tilillä.",
  offline: "Laitteesi ilmoittaa, ettei se ole verkossa.",
  waiting: "Odotetaan, että laite on taas verkossa.",
  stopped: "Automaattiset yritykset on lopetettu. Voit yrittää uudelleen itse.",
  countdown: (seconds: number) => `Yritetään uudelleen ${seconds} s kuluttua`,
  trying: "Yritetään nyt…",
  signIn: "Kirjaudu uudelleen",
  retry: "Yritä nyt",
};

export const landingText = catalog(fi, {
  connecting: "Connecting to the server…",
  greeting: (name) => `Hi ${name}. Fetching your workspaces…`,
  slow: "Connecting is taking longer than usual. Still waiting; you can leave the page open.",
  failedTitle: "Could not connect",
  failedDetail:
    "Your workspaces could not be shown yet. This does not mean they are gone.",
  answerTitle: "Your workspaces could not be read",
  answerDetail:
    "The problem is not your connection. If this continues, tell the server administrator.",
  identityTitle: "Could not confirm your sign-in",
  identityDetail:
    "This page could not confirm whose workspaces to show, so it shows none. This can happen if another tab signed in with a different account.",
  offline: "Your device reports that it is offline.",
  waiting: "Waiting for your device to be online again.",
  stopped: "Automatic attempts have stopped. You can try again yourself.",
  countdown: (seconds) => `Trying again in ${seconds} s`,
  trying: "Trying now…",
  signIn: "Sign in again",
  retry: "Try now",
});

```
