# text/account.ts

Generated from web/src/text/account.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The account menu, Settings' frame and the sections drawn in
// components/Account.tsx itself (Tili, Tekoäly, Ulkoasu), and the sign-out
// dialog.
const fi = {
  ownAccount: "Oma tili",
  themeSystem: "Järjestelmä",
  themeLight: "Vaalea",
  themeDark: "Tumma",
  accountMenu: "Tilivalikko",
  accountMenuOf: (name: string) => `${name}, Tilivalikko`,
  theme: "Teema",
  agentWork: "Agentin työ",
  hidden: "Piilossa",
  visible: "Näkyvissä",
  settings: "Asetukset",
  administration: "Palvelimen ylläpito",
  logout: "Kirjaudu ulos…",
  closeSettings: "Sulje asetukset",
  sections: "Asetusten osiot",
  backToResults: "← Hakutulokset",
  backToSettings: "← Asetukset",
  aiIntro:
    "Mallit, joita agentit käyttävät, ja tilaukset tai avaimet, joilla ne saadaan.",
  agentWorkDesc: "Ajattelu ja työkalut keskustelussa oletuksena.",
  subscriptions: "Tilaukset",
  chatgpt: "ChatGPT-tilaus",
  chatgptSignedIn: (models: string) => `Kirjautunut. ${models}`,
  chatgptChecking: "Tarkistetaan ChatGPT-kirjautumista…",
  chatgptUnknown: "ChatGPT-kirjautumista ei voitu vahvistaa.",
  chatgptSignedOut:
    "Kirjaudu ChatGPT-tilauksella (Codex), niin sen mallit tulevat mallivalitsimeen. Kirjautuminen tallentuu vain omalle käyttäjällesi tällä palvelimella.",
  signedIn: "Kirjautunut",
  signInAgain: "Kirjaudu uudelleen",
  signInChatgpt: "Kirjaudu ChatGPT:hen",
  themeDesc: "Järjestelmä seuraa laitteen asetusta. Koskee tätä selainta.",
  checkingAdmin: "Tarkistetaan ylläpito-oikeutta…",
  adminOnly: "Ylläpito on vain ylläpitäjille.",
  adminUnknown: "Ylläpito-oikeutta ei voitu vahvistaa.",
  logoutQuestion: "Kirjaudutaanko ulos tästä selaimesta?",
  leavesBrowser: "Poistuu selaimesta",
  browserSession: "Selainistunto",
  drafts: "Luonnokset",
  readContent: "Luettu sisältö",
  staysOnServer: "Säilyy palvelimella",
  workspaces: "Työtilat",
  serverCredentials: "Palvelimen tunnukset",
  runningWork: "Agenttien käynnissä oleva työ",
  cancel: "Peruuta",
  logoutConfirm: "Kirjaudu ulos",
};

export const accountText = catalog(fi, {
  ownAccount: "Your account",
  themeSystem: "System",
  themeLight: "Light",
  themeDark: "Dark",
  accountMenu: "Account menu",
  accountMenuOf: (name) => `${name}, Account menu`,
  theme: "Theme",
  agentWork: "Agent's work",
  hidden: "Hidden",
  visible: "Visible",
  settings: "Settings",
  administration: "Server administration",
  logout: "Sign out…",
  closeSettings: "Close settings",
  sections: "Settings sections",
  backToResults: "← Search results",
  backToSettings: "← Settings",
  aiIntro:
    "The models your agents use, and the subscriptions or keys that provide them.",
  agentWorkDesc: "Thinking and tools in the conversation by default.",
  subscriptions: "Subscriptions",
  chatgpt: "ChatGPT subscription",
  chatgptSignedIn: (models) => `Signed in. ${models}`,
  chatgptChecking: "Checking the ChatGPT sign-in…",
  chatgptUnknown: "The ChatGPT sign-in could not be confirmed.",
  chatgptSignedOut:
    "Sign in with a ChatGPT subscription (Codex) to bring its models into the model picker. The sign-in is saved only for your own user on this server.",
  signedIn: "Signed in",
  signInAgain: "Sign in again",
  signInChatgpt: "Sign in to ChatGPT",
  themeDesc: "System follows the device's setting. Applies to this browser.",
  checkingAdmin: "Checking administrator rights…",
  adminOnly: "Administration is for administrators only.",
  adminUnknown: "Administrator rights could not be confirmed.",
  logoutQuestion: "Sign out of this browser?",
  leavesBrowser: "Leaves the browser",
  browserSession: "Browser session",
  drafts: "Drafts",
  readContent: "Content read",
  staysOnServer: "Stays on the server",
  workspaces: "Workspaces",
  serverCredentials: "Server credentials",
  runningWork: "Agents' running work",
  cancel: "Cancel",
  logoutConfirm: "Sign out",
});

```
