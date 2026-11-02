import { catalog } from "../i18n";

const fi = {
  welcome: "Tervetuloa Open Habitatiin",
  intro:
    "Kirjaudu GitHub-tililläsi. Pääset omiin työtiloihisi ja voit työskennellä niissä agenttien kanssa. Kirjautumisen jälkeen voit valita työtilasi ja yhdistää OpenAI-tilisi.",
  signIn: "Kirjaudu GitHubilla",
  errorTitle: "Kirjautumisessa tapahtui virhe",
  errorDetail:
    "Yritä kirjautua uudelleen. Jos virhe toistuu, ota yhteyttä palvelun ylläpitäjään. Älä lähetä tunnuksia tai kirjautumislinkkejä.",
  deniedTitle: "Kirjautuminen ei onnistunut",
  deniedDetail:
    "Tunnuksellasi ei ehkä ole pääsyä tälle palvelimelle. Pyydä palvelimen ylläpitäjää sallimaan se. Jos pääsysi tulee GitHub-organisaation kautta, tarkista, että kirjauduit oikealla GitHub-tilillä.",
  membershipTitle: "Jäsenyyttäsi ei voitu tarkistaa",
  membershipDetail:
    "GitHub ei vastannut, kun palvelin tarkisti pääsysi. Yritä hetken päästä uudelleen. Jos tämä toistuu, organisaatio ei ehkä ole hyväksynyt Open Habitatia; kerro siitä palvelimen ylläpitäjälle.",
  logoutUncertainTitle: "Uloskirjautumista ei voitu vahvistaa",
  logoutUncertainDetail:
    "Istunto voi olla edelleen voimassa. Kun yhteys toimii, yritä uloskirjautumista uudelleen.",
  logoutRetry: "Yritä uloskirjautumista uudelleen",
};

export const signInText = catalog(
  fi,
  {
    welcome: "Welcome to Open Habitat",
    intro:
      "Sign in with your GitHub account. You reach your own workspaces and can work in them with agents. After signing in you can choose your workspaces and connect your OpenAI account.",
    signIn: "Sign in with GitHub",
    errorTitle: "Signing in failed",
    errorDetail:
      "Try signing in again. If the error repeats, contact the service's administrator. Do not send credentials or sign-in links.",
    deniedTitle: "Signing in did not succeed",
    deniedDetail:
      "Your account may not have access to this server. Ask the server's administrator to allow it. If your access comes through a GitHub organization, check that you signed in with the right GitHub account.",
    membershipTitle: "Your membership could not be checked",
    membershipDetail:
      "GitHub did not answer when the server checked your access. Try again in a moment. If this repeats, the organization may not have approved Open Habitat; tell the server's administrator.",
    logoutUncertainTitle: "Signing out could not be confirmed",
    logoutUncertainDetail:
      "The session may still be valid. When the connection works, try signing out again.",
    logoutRetry: "Try signing out again",
  },
  {
    deniedDetail:
      "Your account may not have access to this server. Ask the server's administrator to allow it. If your access comes through a GitHub organisation, check that you signed in with the right GitHub account.",
    membershipDetail:
      "GitHub did not answer when the server checked your access. Try again in a moment. If this repeats, the organisation may not have approved Open Habitat; tell the server's administrator.",
  },
);
