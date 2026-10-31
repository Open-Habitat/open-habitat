import { catalog } from "../i18n";

const fi = {
  welcome: "Tervetuloa Open Habitatiin",
  intro:
    "Kirjaudu GitHub-tililläsi. Pääset omiin työtiloihisi ja voit työskennellä niissä agenttien kanssa. Kirjautumisen jälkeen voit valita työtilasi ja yhdistää OpenAI-tilisi.",
  signIn: "Kirjaudu GitHubilla",
  errorTitle: "Kirjautumisessa tapahtui virhe",
  errorDetail:
    "Yritä kirjautua uudelleen. Jos virhe toistuu, ota yhteyttä palvelun ylläpitäjään. Älä lähetä tunnuksia tai kirjautumislinkkejä.",
  logoutUncertainTitle: "Uloskirjautumista ei voitu vahvistaa",
  logoutUncertainDetail:
    "Istunto voi olla edelleen voimassa. Kun yhteys toimii, yritä uloskirjautumista uudelleen.",
  logoutRetry: "Yritä uloskirjautumista uudelleen",
};

export const signInText = catalog(fi, {
  welcome: "Welcome to Open Habitat",
  intro:
    "Sign in with your GitHub account. You reach your own workspaces and can work in them with agents. After signing in you can choose your workspaces and connect your OpenAI account.",
  signIn: "Sign in with GitHub",
  errorTitle: "Signing in failed",
  errorDetail:
    "Try signing in again. If the error repeats, contact the service's administrator. Do not send credentials or sign-in links.",
  logoutUncertainTitle: "Signing out could not be confirmed",
  logoutUncertainDetail:
    "The session may still be valid. When the connection works, try signing out again.",
  logoutRetry: "Try signing out again",
});
