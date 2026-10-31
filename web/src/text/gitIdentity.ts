import { catalog } from "../i18n";

// The Git identity row of Settings › Tili and its onboarding step
// (app/GitIdentity.tsx).
const fi = {
  readError: "Git-identiteettiä ei voitu tarkistaa. Yritä uudelleen.",
  uncertain:
    "Tallennuksen tulosta ei saatu varmistettua. Git-asetukset luettiin uudelleen.",
  retry: "Yritä uudelleen",
  label: "Git-identiteetti",
  descBefore: "Commitien tekijä. Tallentuu globaaliin",
  descAfter: "-tiedostoon.",
  nameMissing: "Nimi puuttuu",
  emailMissing: "Sähköposti puuttuu",
  edit: "Muokkaa Git-identiteettiä",
  checking: "Tarkistetaan Git-asetukset…",
  nameField: "Gitissä näkyvä nimi",
  emailField: "Gitissä näkyvä sähköposti",
  cancel: "Peruuta",
  save: "Tallenna Git-identiteetti",
  noSuggestions: "GitHub-ehdotuksia ei saatu. Yritä uudelleen.",
  source: "Lähde:",
  continue: "Jatka repoihin",
  saving: "Tallennetaan…",
  confirm: "Vahvista Git-identiteetti",
  globalSetting: "Gitin globaali asetus",
};

export const gitIdentityText = catalog(fi, {
  readError: "The Git identity could not be checked. Try again.",
  uncertain:
    "The result of saving could not be confirmed. The Git settings were read again.",
  retry: "Try again",
  label: "Git identity",
  descBefore: "The author of commits. Saved in the global",
  descAfter: "file.",
  nameMissing: "Name missing",
  emailMissing: "Email missing",
  edit: "Edit Git identity",
  checking: "Checking the Git settings…",
  nameField: "Name shown in Git",
  emailField: "Email shown in Git",
  cancel: "Cancel",
  save: "Save Git identity",
  noSuggestions: "No suggestions arrived from GitHub. Try again.",
  source: "Source:",
  continue: "Continue to repositories",
  saving: "Saving…",
  confirm: "Confirm Git identity",
  globalSetting: "Git's global setting",
});
