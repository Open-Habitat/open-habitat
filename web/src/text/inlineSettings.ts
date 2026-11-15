import { catalog } from "../i18n";

// The shared inline text field of Settings (components/InlineTextSetting.tsx)
// and GitHub's local disconnect (components/NativeDisconnect.tsx).
const fi = {
  unconfirmed: "muutosta ei voitu vahvistaa.",
  saving: "Tallennetaan…",
  saved: "Tallennettu",
  failed: (reason: string) =>
    `Ei tallennettu: ${reason} Teksti säilyi; yritä uudelleen Enterillä.`,
  invalid: (reason: string) => `Ei tallennettu: ${reason}`,
  reauth: "Vahvista ensin kirjautumalla GitHubilla. Palaat tähän ikkunaan.",
  stateUnknown: "Paikallisen valtuutuksen tilaa ei voitu vahvistaa.",
  disconnected:
    "Yhteys katkaistu tältä palvelimelta. Lupa jäi GitHub-tilillesi.",
  uncertain:
    "Katkaisun tulos on epävarma tai osittainen. Tarkista tilanne uudelleen; älä toista automaattisesti.",
  note: "Open Habitatin lupa jää GitHub-tilillesi. Sen voi poistaa GitHubin asetuksista.",
  grantSettings: "GitHubin asetukset",
  verify: "Vahvista GitHubilla",
  verified: "Kirjauduit juuri GitHubilla. Voit nyt katkaista yhteyden.",
  checking: "Tarkistetaan…",
  retry: "Tarkista uudelleen",
  check: "Katkaise yhteys…",
  question: "Katkaistaanko GitHub-yhteys?",
  effect:
    "Palvelin poistaa GitHub-valtuutuksesi. Sen jälkeen agentit eivät voi pushata eikä gh toimi. Työtilat ja keskustelut säilyvät, ja yhteyden saa takaisin kirjautumalla GitHubilla.",
  cancel: "Peruuta",
  confirm: "Katkaise yhteys",
};

export const inlineSettingsText = catalog(
  fi,
  {
    unconfirmed: "the change could not be confirmed.",
    saving: "Saving…",
    saved: "Saved",
    failed: (reason) =>
      `Not saved: ${reason} The text was kept; try again with Enter.`,
    invalid: (reason) => `Not saved: ${reason}`,
    reauth:
      "First confirm by signing in with GitHub. You come back to this dialog.",
    stateUnknown: "The local authorization's state could not be confirmed.",
    disconnected:
      "Disconnected from this server. The grant stays on your GitHub account.",
    uncertain:
      "The result of disconnecting is uncertain or partial. Check the situation again; do not repeat it automatically.",
    note: "Open Habitat’s grant stays on your GitHub account. You can remove it in GitHub’s settings.",
    grantSettings: "GitHub settings",
    verify: "Confirm with GitHub",
    verified: "You just signed in with GitHub. You can disconnect now.",
    checking: "Checking…",
    retry: "Check again",
    check: "Disconnect…",
    question: "Disconnect GitHub?",
    effect:
      "The server removes your GitHub authorization. After that agents cannot push and gh does not work. Workspaces and conversations stay, and signing in with GitHub brings the connection back.",
    cancel: "Cancel",
    confirm: "Disconnect",
  },
  {
    stateUnknown: "The local authorisation's state could not be confirmed.",
    effect:
      "The server removes your GitHub authorisation. After that agents cannot push and gh does not work. Workspaces and conversations stay, and signing in with GitHub brings the connection back.",
  },
);
