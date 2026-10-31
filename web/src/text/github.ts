import { catalog } from "../i18n";

// GitHub's connection faults, in the bell and where GitHub is used
// (app/githubConnection.ts).
const fi = {
  expired: {
    title: "GitHub-yhteys on vanhentunut tai peruttu",
    text: "GitHub ei enää hyväksy palvelimen valtuutusta, eikä palvelin voi uusia sitä itse. Yhdistä uudelleen: GitHub palauttaa sinut tänne, yleensä kysymättä mitään.",
    short: "Push ja gh eivät toimi. Palvelin ei voi uusia valtuutusta itse.",
    place:
      "GitHub ei enää hyväksy palvelimelle tallennettua valtuutusta: se on vanhentunut tai peruttu. Repolistaa ei voi hakea eikä repoja kloonata.",
    fix: "Yhdistä uudelleen",
  },
  disconnected: {
    title: "GitHubia ei ole yhdistetty",
    text: "Palvelimella ei ole GitHub-kirjautumistasi, joten push, kloonaus ja gh eivät toimi. Paikallinen työ ja keskustelut toimivat.",
    short: "Push ja gh eivät toimi ennen yhdistämistä.",
    place:
      "Repolistaa ei voi hakea, koska palvelimella ei ole GitHub-kirjautumistasi.",
    fix: "Yhdistä GitHub",
  },
  unreachable: {
    title: "GitHub ei vastaa",
    text: "Palvelin ei ole saanut GitHubiin yhteyttä. Valtuutuksesi on tallessa, eikä sinun tarvitse tehdä mitään: palvelin yrittää puolen minuutin välein, ja ilmoitus poistuu itsestään. Push, kloonaus ja gh odottavat; paikallinen työ toimii.",
    short: "Push ja gh odottavat. Palvelin yrittää itse uudelleen.",
    place:
      "GitHub ei juuri nyt vastaa palvelimelle. Palvelin yrittää itse uudelleen; repolista tulee, kun yhteys palaa.",
  },
  oauthTitle: (owner: string) =>
    `Organisaatio ${owner} ei ole hyväksynyt palvelimen GitHub-sovellusta`,
  oauthText: (owner: string) =>
    `Organisaatio ${owner} rajoittaa ulkopuolisten sovellusten pääsyä, joten push, kloonaus ja gh eivät toimi sen repoissa. Pyydä hyväksyntää GitHubin asetuksista (Authorized OAuth Apps): omistaja saa pyynnöstä ilmoituksen, ja varoitus poistuu itsestään hyväksynnän jälkeen.`,
  oauthShort: (owner: string) =>
    `Organisaation ${owner} omistajan pitää hyväksyä sovellus.`,
  oauthPlace: (owner: string) =>
    `Organisaatio ${owner} rajoittaa ulkopuolisten sovellusten pääsyä, joten palvelin ei näe sen repoja. Pyydä hyväksyntää GitHubin asetuksista; organisaation omistaja saa pyynnöstä ilmoituksen.`,
  oauthFix: "Pyydä hyväksyntää GitHubissa",
  samlTitle: (owner: string) =>
    `Organisaatio ${owner} vaatii kertakirjautumisen`,
  samlText: (owner: string) =>
    `Organisaatio ${owner} käyttää SAML-kertakirjautumista, eikä palvelimen GitHub-valtuutusta ole hyväksytty sille, joten push, kloonaus ja gh eivät toimi sen repoissa. Kirjaudu organisaation kertakirjautumiseen GitHubissa ja yhdistä sitten uudelleen.`,
  samlShort: (owner: string) =>
    `Kirjaudu organisaation ${owner} kertakirjautumiseen ja yhdistä uudelleen.`,
  samlPlace: (owner: string) =>
    `Organisaatio ${owner} vaatii SAML-kertakirjautumisen, jota palvelimen GitHub-valtuutukselle ei ole tehty. Kirjaudu organisaation kertakirjautumiseen GitHubissa ja yhdistä sitten uudelleen.`,
  reconnect: "Yhdistä uudelleen",
};

export const githubText = catalog(fi, {
  expired: {
    title: "The GitHub connection has expired or been revoked",
    text: "GitHub no longer accepts the server's authorization, and the server cannot renew it itself. Reconnect: GitHub brings you back here, usually without asking anything.",
    short:
      "Push and gh do not work. The server cannot renew the authorization itself.",
    place:
      "GitHub no longer accepts the authorization saved on the server: it has expired or been revoked. The repository list cannot be fetched and repositories cannot be cloned.",
    fix: "Reconnect",
  },
  disconnected: {
    title: "GitHub is not connected",
    text: "The server has no GitHub sign-in of yours, so push, cloning and gh do not work. Local work and conversations work.",
    short: "Push and gh do not work until connected.",
    place:
      "The repository list cannot be fetched because the server has no GitHub sign-in of yours.",
    fix: "Connect GitHub",
  },
  unreachable: {
    title: "GitHub does not answer",
    text: "The server has not reached GitHub. Your authorization is kept, and you need not do anything: the server tries every half minute, and the notice goes away by itself. Push, cloning and gh wait; local work works.",
    short: "Push and gh wait. The server tries again by itself.",
    place:
      "GitHub does not answer the server just now. The server tries again by itself; the repository list comes when the connection returns.",
  },
  oauthTitle: (owner) =>
    `The organisation ${owner} has not approved the server's GitHub app`,
  oauthText: (owner) =>
    `The organisation ${owner} restricts third-party apps' access, so push, cloning and gh do not work in its repositories. Request approval in GitHub's settings (Authorized OAuth Apps): the owner is notified of the request, and the warning goes away by itself after approval.`,
  oauthShort: (owner) =>
    `An owner of the organisation ${owner} has to approve the app.`,
  oauthPlace: (owner) =>
    `The organisation ${owner} restricts third-party apps' access, so the server does not see its repositories. Request approval in GitHub's settings; an owner of the organisation is notified of the request.`,
  oauthFix: "Request approval in GitHub",
  samlTitle: (owner) => `The organisation ${owner} requires single sign-on`,
  samlText: (owner) =>
    `The organisation ${owner} uses SAML single sign-on, and the server's GitHub authorization has not been approved for it, so push, cloning and gh do not work in its repositories. Sign in to the organisation's single sign-on on GitHub and then reconnect.`,
  samlShort: (owner) =>
    `Sign in to the single sign-on of the organisation ${owner} and reconnect.`,
  samlPlace: (owner) =>
    `The organisation ${owner} requires SAML single sign-on, which has not been done for the server's GitHub authorization. Sign in to the organisation's single sign-on on GitHub and then reconnect.`,
  reconnect: "Reconnect",
});
