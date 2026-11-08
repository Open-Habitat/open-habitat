# text/claudeSignIn.ts

Generated from web/src/text/claudeSignIn.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The Claude subscription sign-in: its Settings › Tekoäly row and its
// onboarding step (app/ClaudeSignIn.tsx).
const fi = {
  label: "Claude-kirjautuminen",
  connected: "Claude-tilaus yhdistetty",
  unavailableShort: "Claude-kirjautuminen ei ole käytettävissä",
  preparing: "Valmistellaan kirjautumista",
  accessOnFirst: "Mallin käyttöoikeus selviää ensimmäisessä viestissä.",
  cannot:
    "Tällä palvelimella ei voi nyt kirjautua Claudeen. Valitse toinen tapa tai pyydä ylläpitäjää tarkistamaan palvelin.",
  step1: "Kirjaudu Clauden sivulla",
  openNewTab: "Avaa Claude-kirjautuminen (uusi välilehti)",
  step2: "Liitä Clauden palauttama koodi",
  codeLabel: "Clauden palauttama koodi",
  confirmCode: "Vahvista koodi",
  waitStep: "Odota vahvistusta",
  waiting: "Odotetaan Clauden vahvistusta",
  notResent: "Koodia ei lähetetä uudelleen.",
  cancelAttempt: "Peruuta kirjautumisyritys",
  signInAgainClaude: "Kirjaudu Claudeen uudelleen",
  start: "Aloita kirjautuminen",
  checkState: "Tarkista tila",
  checkFailed:
    "Claude-yhteyden tarkistus epäonnistui. Tarkistetaan tila uudelleen; koodia ei toisteta.",
  ownPage:
    "Kirjautuminen tehdään Clauden omalla sivulla. Salasanaa ei syötetä tänne.",
  subscription: "Claude-tilaus",
  signedInModels: (models: string) =>
    `Kirjautunut. ${models ? `${models} ` : ""}Mallin käyttöoikeus selviää ensimmäisessä viestissä.`,
  unavailableLong:
    "Claude-kirjautuminen ei ole käytettävissä. Tarkista palvelimen runtime ja oman ~/.claude-hakemiston oikeudet.",
  pending: "Claude-kirjautuminen kesken.",
  signedOut:
    "Kirjaudu Claude-tilauksella, niin sen mallit tulevat mallivalitsimeen. Kirjautuminen tallentuu vain omalle käyttäjällesi tällä palvelimella.",
  signedIn: "Kirjautunut",
  notAvailable: "Ei käytettävissä",
  interrupt: "Keskeytä Claude-kirjautuminen",
  signInAgain: "Kirjaudu uudelleen",
  signIn: "Kirjaudu Claudeen",
  check: "Tarkista Claude-kirjautuminen",
  settingsStep1:
    "1. Avaa Clauden sivu ja kirjaudu sisään. Salasanaa ei syötetä tänne.",
  open: "Avaa Claude-kirjautuminen",
  settingsStep2: "2. Clauden palauttama koodi",
  confirmClaudeCode: "Vahvista Claude-koodi",
  waitingLong: "Odotetaan Clauden vahvistusta. Koodia ei lähetetä uudelleen.",
  cancel: "Peruuta",
  refusedRow:
    "Claude hylkäsi tallennetun kirjautumisen, eikä palvelin voi uusia sitä itse. Kirjaudu uudelleen.",
  refused: "Hylätty",
};

export const claudeSignInText = catalog(fi, {
  label: "Claude sign-in",
  connected: "Claude subscription connected",
  unavailableShort: "Claude sign-in is not available",
  preparing: "Preparing the sign-in",
  accessOnFirst: "Access to the model is settled by the first message.",
  cannot:
    "Signing in to Claude is not possible on this server now. Choose another way or ask the administrator to check the server.",
  step1: "Sign in on Claude's page",
  openNewTab: "Open the Claude sign-in (new tab)",
  step2: "Paste the code Claude returns",
  codeLabel: "The code Claude returns",
  confirmCode: "Confirm code",
  waitStep: "Wait for confirmation",
  waiting: "Waiting for Claude's confirmation",
  notResent: "The code is not sent again.",
  cancelAttempt: "Cancel the sign-in attempt",
  signInAgainClaude: "Sign in to Claude again",
  start: "Start signing in",
  checkState: "Check the state",
  checkFailed:
    "Checking the Claude connection failed. The state is checked again; the code is not repeated.",
  ownPage:
    "Signing in happens on Claude's own page. No password is entered here.",
  subscription: "Claude subscription",
  signedInModels: (models) =>
    `Signed in. ${models ? `${models} ` : ""}Access to the model is settled by the first message.`,
  unavailableLong:
    "Claude sign-in is not available. Check the server's runtime and the permissions of your own ~/.claude directory.",
  pending: "Claude sign-in under way.",
  signedOut:
    "Sign in with a Claude subscription to bring its models into the model picker. The sign-in is saved only for your own user on this server.",
  signedIn: "Signed in",
  notAvailable: "Not available",
  interrupt: "Stop the Claude sign-in",
  signInAgain: "Sign in again",
  signIn: "Sign in to Claude",
  check: "Check the Claude sign-in",
  settingsStep1:
    "1. Open Claude's page and sign in. No password is entered here.",
  open: "Open the Claude sign-in",
  settingsStep2: "2. The code Claude returns",
  confirmClaudeCode: "Confirm the Claude code",
  waitingLong: "Waiting for Claude's confirmation. The code is not sent again.",
  cancel: "Cancel",
  refusedRow:
    "Claude refused the stored sign-in, and the server cannot renew it by itself. Sign in again.",
  refused: "Refused",
});

```
