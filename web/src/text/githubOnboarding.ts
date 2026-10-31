import { catalog, plural } from "../i18n";

// Onboarding's GitHub, Git identity and repository steps and the route's
// notes (app/GitHubOnboarding.tsx).
const fi = {
  errors: {
    login: "Istunto päättyi. Kirjaudu uudelleen.",
    auth: "GitHub-valtuutusta ei voitu vahvistaa.",
    denied: "Haku estettiin. Tarkista istunto ja oikeudet.",
    conflict: "Kohteessa on eri repo. Tarkista se koneella.",
    storage:
      "Tallennustila on täynnä. Pyydä ylläpitäjää nostamaan tallennusrajaa.",
    busy: "Toinen kloonaus on käynnissä. Odota, että se valmistuu.",
  } as Record<string, string>,
  unconfirmed:
    "Tilan vahvistaminen ei onnistunut. Tarkista yhteys ja yritä uudelleen.",
  sessionFailed: "Istuntoa ei voitu vahvistaa. Lataa sivu uudelleen.",
  cannotStart:
    "Repojen hakua ei voi aloittaa juuri nyt. Jatka ilman repoja tai lataa sivu uudelleen.",
  siteFetchingPercent: (n: number) => `Sivusto hakee · ${n} %`,
  siteFetching: "Sivusto hakee",
  siteQueued: "Sivusto hakee · jonossa",
  siteFailed: "Sivuston haku epäonnistui",
  fetched: "Haettu",
  notConfirmed: "Tila ei varmistunut",
  checking: "Tilaa tarkistetaan",
  signedIn: "Kirjautunut",
  siteFetchingN: (n: number) =>
    `Sivusto hakee ${n} ${n === 1 ? "repo" : "repoa"}`,
  fetchFailed: "Haku epäonnistui",
  noRepos: "Ei repoja",
  inProgress: (n: number) => `${n} ${n === 1 ? "repo" : "repoa"} haussa`,
  connected: "Yhdistetty",
  skipped: "Ohitettu",
  abort: "Keskeytä käyttöönotto ja kirjaudu ulos",
  finishing: "Viimeistellään käyttöönottoa…",
  sessionUnconfirmed: "Istuntoa ei ole vahvistettu.",
  identityTitle: "Git-identiteetti",
  identityText:
    "Vahvista nimi ja sähköposti ennen repoja. Olemassa olevia Git-asetuksia ei muuteta.",
  backToRepos: "Takaisin repoihin",
  back: "Takaisin",
  checkingIntegrations: "Tarkistetaan integraatioita…",
  confirmingSession: "Varmistetaan istunto…",
  noticeTitle: "Haun tila vaatii tarkistusta",
  recheckRepos: "Tarkista repot uudelleen",
  reload: "Lataa sivu uudelleen",
};

const repos = (n: number) =>
  `${n} ${plural("en", n, { one: "repository", other: "repositories" })}`;

export const githubOnboardingText = catalog(fi, {
  errors: {
    login: "The session ended. Sign in again.",
    auth: "The GitHub authorization could not be confirmed.",
    denied: "The fetch was blocked. Check the session and permissions.",
    conflict:
      "A different repository is at the destination. Check it on the machine.",
    storage:
      "Storage is full. Ask the administrator to raise the storage limit.",
    busy: "Another clone is running. Wait for it to finish.",
  },
  unconfirmed:
    "The state could not be confirmed. Check the connection and try again.",
  sessionFailed: "The session could not be confirmed. Reload the page.",
  cannotStart:
    "Fetching repositories cannot start just now. Continue without repositories or reload the page.",
  siteFetchingPercent: (n) => `The site is fetching · ${n}%`,
  siteFetching: "The site is fetching",
  siteQueued: "The site is fetching · queued",
  siteFailed: "The site's fetch failed",
  fetched: "Fetched",
  notConfirmed: "State not confirmed",
  checking: "Checking the state",
  signedIn: "Signed in",
  siteFetchingN: (n) => `The site is fetching ${repos(n)}`,
  fetchFailed: "The fetch failed",
  noRepos: "No repositories",
  inProgress: (n) => `Fetching ${repos(n)}`,
  connected: "Connected",
  skipped: "Skipped",
  abort: "Stop getting started and sign out",
  finishing: "Finishing getting started…",
  sessionUnconfirmed: "The session has not been confirmed.",
  identityTitle: "Git identity",
  identityText:
    "Confirm your name and email before the repositories. Existing Git settings are not changed.",
  backToRepos: "Back to repositories",
  back: "Back",
  checkingIntegrations: "Checking integrations…",
  confirmingSession: "Confirming the session…",
  noticeTitle: "The fetch needs checking",
  recheckRepos: "Check the repositories again",
  reload: "Reload the page",
});
