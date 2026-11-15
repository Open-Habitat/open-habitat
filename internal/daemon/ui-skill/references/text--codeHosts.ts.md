# text/codeHosts.ts

Generated from web/src/text/codeHosts.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Settings › Koodipalvelut: GitHub's row and the imported workspaces
// (app/CodeHostSettings.tsx).
const fi = {
  connected: "Toimii",
  connectedDesc: "Git ja gh toimivat työtiloissa.",
  disconnected: "Ei yhdistetty",
  disconnectedDesc: "Agentit eivät voi pushata GitHubiin eikä gh toimi.",
  expired: "Ei toimi",
  expiredDesc:
    "GitHub ei enää hyväksy palvelimen valtuutusta. Agentit eivät voi pushata eikä gh toimi.",
  pending: "Yhdistäminen kesken",
  pendingDesc:
    "GitHub-yhteyttä valmistellaan. Odota ennen Git-toimintojen käyttöä.",
  partial: "Osittainen yhteys",
  partialDesc:
    "GitHub-yhteys ei ole vielä kokonaan valmis. Git-toiminnot eivät välttämättä onnistu.",
  unknown: "Tilaa ei tiedetä",
  unknownDesc: "GitHub-yhteyden tilaa ei juuri nyt voitu vahvistaa.",
  checking: "Tarkistetaan",
  checkingDesc:
    "Palvelin kysyy parhaillaan GitHubilta yhteyden tilaa. Tila päivittyy tähän itsestään.",
  timeoutDesc:
    "GitHub tai palvelimen gh ei vastannut ajoissa, joten yhteyttä ei voitu vahvistaa. Palvelin kysyy pian uudelleen.",
  githubErrorDesc:
    "GitHub vastasi tarkistukseen virheellä, esimerkiksi pyyntörajoituksella, joten yhteyttä ei voitu vahvistaa. Palvelin kysyy pian uudelleen.",
  unrecognizedDesc:
    "Palvelimen gh ei antanut vastausta, jonka palvelin tunnistaa, joten yhteyttä ei voitu vahvistaa. Päätteen gh auth status kertoo tarkemmin.",
  unreachable: "GitHub ei vastaa",
  unreachableDesc:
    "Palvelin ei saanut GitHubiin yhteyttä. Valtuutus on tallessa; palvelin yrittää itse uudelleen.",
  verifying: "Tarkistetaan",
  verifyingDesc:
    "GitHub hylkäsi valtuutuksen kerran. Palvelin tarkistaa sen vielä uudelleen.",
  pushBroken:
    "Push ei onnistu ennen kuin GitHub-yhteys on korjattu. Paikallinen työ jatkuu.",
  pushPartial:
    "Push ei välttämättä onnistu ennen kuin GitHub-yhteys on valmis. Paikallinen työ jatkuu.",
  pushWaits: "Push odottaa, kunnes GitHub vastaa taas. Paikallinen työ jatkuu.",
  giteaTrouble: (host: string) =>
    `Pull ja push eivät onnistu ennen kuin ${host}-yhteys on kunnossa. Paikallinen työ jatkuu.`,
  gitlabTrouble: (host: string) =>
    `Pull ja push eivät onnistu ennen kuin GitLab-yhteys palvelimelle ${host} on kunnossa. Paikallinen työ jatkuu.`,
  intro: "Palvelut, joista työtilat kloonataan ja joihin agentit pushaavat.",
  signedInAs: (login: string) => `Tunnus ${login}`,
  logoutKeeps: "Selaimesta uloskirjautuminen ei poista palvelimen valtuutusta.",
  connect: "Yhdistä GitHub",
  reconnect: "Kirjaudu uudelleen GitHubilla",
  disconnectedNotice:
    "Yhteys katkaistu tältä palvelimelta. Lupa jäi GitHub-tilillesi.",
  imported: "Tuodut työtilat",
  importedNote:
    "Työtilat avataan ja poistetaan sivupalkista. Täällä näkyy, minkä palvelun tunnuksella kukin synkronoi.",
  noneImported:
    "Näistä palveluista ei ole vielä tuotu työtiloja. Uusi työtila listaa yllä olevien palvelujen repot.",
  newWorkspace: "Uusi työtila…",
  // The GitHub card's workflow permission (github-workflow-scope, A Rivi).
  wfTitle: "GitHub Actions -työnkulut",
  wfExplain:
    "Agentit eivät voi muuttaa työnkulkuja. Salli vain CI-työhön: työnkulut voivat lukea repon salaisuudet.",
  wfShort:
    "Agentit voivat muuttaa GitHub Actions -työnkulkuja, jotka voivat lukea repon salaisuudet.",
  wfOff: "Ei sallittu",
  wfOn: "Sallittu",
  wfMissing: "Lupa puuttuu",
  wfUnknown: "Ei tiedossa",
  wfPending: "Kesken",
  wfOnDesc:
    "Agentit voivat muuttaa työnkulkuja, ja työnkulut voivat lukea repon salaisuudet.",
  wfPendingDesc: "GitHub-kirjautuminen jäi kesken. Lupaa ei muutettu.",
  wfMissingDesc:
    "Sallit työnkulut, mutta nykyinen valtuutus on ilman lupaa. Työnkulkua muuttava push epäonnistuu.",
  wfUnknownDesc:
    "Valtuutuksen oikeuksia ei voitu lukea, joten ei tiedetä, onko lupa voimassa. gh auth status päätteessä kertoo ne.",
  allow: "Salli GitHubissa",
  allowAgain: "Salli uudelleen",
  keepOff: "Älä salli",
  removePerm: "Poista lupa",
  cancelSignIn: "Peru",
  retry: "Yritä uudelleen",
  scopeNames: {
    repo: "repot",
    "read:org": "organisaatiot (luku)",
    gist: "gistit",
    workflow: "työnkulkujen muutokset",
  },
  scopesLabel: "Oikeudet:",
  scopesUnknown: "Oikeuksia ei voitu lukea.",
  saidKeptOff:
    "Selvä. Työnkulkuja ei sallita, eikä puuttuvasta luvasta enää huomauteta.",
  wfSaveFailed: "Valintaa ei voitu tallentaa. Yritä uudelleen.",
};

export const codeHostsText = catalog(
  fi,
  {
    connected: "Works",
    connectedDesc: "Git and gh work in the workspaces.",
    disconnected: "Not connected",
    disconnectedDesc: "Agents cannot push to GitHub and gh does not work.",
    expired: "Not working",
    expiredDesc:
      "GitHub no longer accepts the server’s authorization. Agents cannot push and gh does not work.",
    pending: "Connecting",
    pendingDesc:
      "The GitHub connection is being prepared. Wait before using Git actions.",
    partial: "Partial connection",
    partialDesc:
      "The GitHub connection is not fully ready yet. Git actions may not succeed.",
    unknown: "State unknown",
    unknownDesc:
      "The GitHub connection's state could not be confirmed just now.",
    checking: "Checking",
    checkingDesc:
      "The server is asking GitHub for the connection's state right now. The state updates here by itself.",
    timeoutDesc:
      "GitHub or the server's gh did not answer in time, so the connection could not be confirmed. The server asks again soon.",
    githubErrorDesc:
      "GitHub answered the check with an error, such as a rate limit, so the connection could not be confirmed. The server asks again soon.",
    unrecognizedDesc:
      "The server's gh gave an answer the server does not recognize, so the connection could not be confirmed. gh auth status in a terminal tells more.",
    unreachable: "GitHub not answering",
    unreachableDesc:
      "The server could not reach GitHub. The authorization is kept; the server tries again by itself.",
    verifying: "Checking",
    verifyingDesc:
      "GitHub refused the authorization once. The server checks it again.",
    pushBroken:
      "Push does not work until the GitHub connection is fixed. Local work continues.",
    pushPartial:
      "Push may not work until the GitHub connection is ready. Local work continues.",
    pushWaits: "Push waits until GitHub answers again. Local work continues.",
    giteaTrouble: (host) =>
      `Pull and push do not work until the ${host} connection is in order. Local work continues.`,
    gitlabTrouble: (host) =>
      `Pull and push do not work until the GitLab connection to ${host} is in order. Local work continues.`,
    intro: "The services workspaces are cloned from and that agents push to.",
    signedInAs: (login) => `Account ${login}`,
    logoutKeeps:
      "Signing out of the browser does not remove the server's authorization.",
    connect: "Connect GitHub",
    reconnect: "Sign in with GitHub again",
    disconnectedNotice:
      "Disconnected from this server. The grant stays on your GitHub account.",
    imported: "Imported workspaces",
    importedNote:
      "Workspaces are opened and removed from the sidebar. Here you see which service's credentials each synchronizes with.",
    noneImported:
      "No workspaces have been imported from these services yet. New workspace lists the repositories of the services above.",
    newWorkspace: "New workspace…",
    wfTitle: "GitHub Actions workflows",
    wfExplain:
      "Agents cannot change workflows. Allow only for CI work: workflows can read the repository’s secrets.",
    wfShort:
      "Agents can change GitHub Actions workflows, which can read the repository’s secrets.",
    wfOff: "Not allowed",
    wfOn: "Allowed",
    wfMissing: "Permission missing",
    wfUnknown: "Not known",
    wfPending: "Unfinished",
    wfOnDesc:
      "Agents can change workflows, and workflows can read the repository’s secrets.",
    wfPendingDesc:
      "The GitHub sign-in was left unfinished. The permission did not change.",
    wfMissingDesc:
      "You allowed workflows, but the current authorization lacks the permission. A push that changes a workflow fails.",
    wfUnknownDesc:
      "The authorization’s permissions could not be read, so it is not known whether the permission holds. gh auth status in a terminal tells them.",
    allow: "Allow on GitHub",
    allowAgain: "Allow again",
    keepOff: "Don’t allow",
    removePerm: "Remove permission",
    cancelSignIn: "Cancel",
    retry: "Try again",
    scopeNames: {
      repo: "repositories",
      "read:org": "organizations (read)",
      gist: "gists",
      workflow: "workflow changes",
    },
    scopesLabel: "Permissions:",
    scopesUnknown: "Permissions could not be read.",
    saidKeptOff:
      "Understood. Workflows are not allowed, and the missing permission is no longer flagged.",
    wfSaveFailed: "The choice could not be saved. Try again.",
  },
  {
    expiredDesc:
      "GitHub no longer accepts the server’s authorisation. Agents cannot push and gh does not work.",
    unreachableDesc:
      "The server could not reach GitHub. The authorisation is kept; the server tries again by itself.",
    verifyingDesc:
      "GitHub refused the authorisation once. The server checks it again.",
    logoutKeeps:
      "Signing out of the browser does not remove the server's authorisation.",
    scopeNames: {
      repo: "repositories",
      "read:org": "organisations (read)",
      gist: "gists",
      workflow: "workflow changes",
    },
    wfMissingDesc:
      "You allowed workflows, but the current authorisation lacks the permission. A push that changes a workflow fails.",
    wfUnknownDesc:
      "The authorisation’s permissions could not be read, so it is not known whether the permission holds. gh auth status in a terminal tells them.",
  },
);

```
