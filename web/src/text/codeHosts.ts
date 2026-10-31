import { catalog } from "../i18n";

// Settings › Koodipalvelut: GitHub's row and the imported workspaces
// (app/CodeHostSettings.tsx).
const fi = {
  connected: "Yhdistetty",
  connectedDesc: "Git ja gh toimivat työtiloissa.",
  disconnected: "Ei yhdistetty",
  disconnectedDesc:
    "GitHub-yhteyttä ei löytynyt, joten git push ja gh eivät toimi. Yhdistä kirjautumalla GitHubilla.",
  expired: "Vanhentunut",
  expiredDesc:
    "GitHub ei enää hyväksy palvelimelle tallennettua valtuutusta, joten git push ja gh eivät toimi. Yhdistä uudelleen kirjautumalla GitHubilla.",
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
  signedInAs: (login: string) => `Kirjautunut käyttäjänä ${login}. `,
  logoutKeeps: "Selaimesta uloskirjautuminen ei poista palvelimen valtuutusta.",
  connect: "Yhdistä GitHub",
  reconnect: "Yhdistä GitHub uudelleen",
  disconnectedNotice:
    "Paikallinen gh-valtuutus poistettu. GitHubin OAuth-lupaa ei peruttu.",
  imported: "Tuodut työtilat",
  importedNote:
    "Työtilat avataan ja poistetaan sivupalkista. Täällä näkyy, minkä palvelun tunnuksella kukin synkronoi.",
  noneImported:
    "Näistä palveluista ei ole vielä tuotu työtiloja. Uusi työtila listaa yllä olevien palvelujen repot.",
  newWorkspace: "Uusi työtila…",
};

export const codeHostsText = catalog(
  fi,
  {
    connected: "Connected",
    connectedDesc: "Git and gh work in the workspaces.",
    disconnected: "Not connected",
    disconnectedDesc:
      "No GitHub connection was found, so git push and gh do not work. Connect by signing in with GitHub.",
    expired: "Expired",
    expiredDesc:
      "GitHub no longer accepts the authorization saved on the server, so git push and gh do not work. Reconnect by signing in with GitHub.",
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
    signedInAs: (login) => `Signed in as ${login}. `,
    logoutKeeps:
      "Signing out of the browser does not remove the server's authorization.",
    connect: "Connect GitHub",
    reconnect: "Reconnect GitHub",
    disconnectedNotice:
      "The local gh authorization was removed. GitHub's OAuth grant was not revoked.",
    imported: "Imported workspaces",
    importedNote:
      "Workspaces are opened and removed from the sidebar. Here you see which service's credentials each synchronizes with.",
    noneImported:
      "No workspaces have been imported from these services yet. New workspace lists the repositories of the services above.",
    newWorkspace: "New workspace…",
  },
  {
    expiredDesc:
      "GitHub no longer accepts the authorisation saved on the server, so git push and gh do not work. Reconnect by signing in with GitHub.",
    unreachableDesc:
      "The server could not reach GitHub. The authorisation is kept; the server tries again by itself.",
    verifyingDesc:
      "GitHub refused the authorisation once. The server checks it again.",
    logoutKeeps:
      "Signing out of the browser does not remove the server's authorisation.",
    disconnectedNotice:
      "The local gh authorisation was removed. GitHub's OAuth grant was not revoked.",
  },
);
