# text/githubRepoChooser.ts

Generated from web/src/text/githubRepoChooser.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// Onboarding's GitHub repository step (components/GitHubRepoChooser.tsx).
const fi = {
  eyebrow: "Käyttöönotto",
  title: "Valitse GitHub-repot haettaviksi",
  instructions:
    "Valitse repot, joita haluat käyttää täällä. Ne haetaan työtiloiksi taustalla, kun jatkat AI-tilin kirjautumiseen. Voit myös jatkaa ilman repoja ja hakea niitä myöhemmin työtilanäkymästä.",
  loading: "Haetaan GitHub-repoja…",
  noAuthTitle: "GitHub-kirjautuminen puuttuu",
  noAuth:
    "Repoja ei voi näyttää ennen GitHub-kirjautumista. Voit jatkaa ilman repoja.",
  unavailableTitle: "Repoja ei voitu hakea",
  unavailable:
    "Tarkista yhteys ja yritä uudelleen, tai jatka ilman repoja ja hae ne myöhemmin.",
  recheck: "Tarkista uudelleen",
  filter: "Etsi repoa nimellä",
  updated: "Päivitetty",
  range: "Aikaväli",
  anyTime: "Milloin tahansa",
  week: "Viimeisen viikon aikana",
  month: "Viimeisen kuukauden aikana",
  quarter: "Viimeisen kolmen kuukauden aikana",
  year: "Viimeisen vuoden aikana",
  hidden: (n: number) => `Piilotettu ${n}`,
  unselectVisible: "Poista näkyvien valinnat",
  selectVisible: "Valitse kaikki näkyvät",
  movingOn: "Siirrytään eteenpäin.",
  none: "Repoja ei löytynyt. Voit jatkaa ilman repoja.",
  noMatches: "Hakua vastaavia repoja ei löytynyt.",
  listLabel: "GitHub-repot",
  private: "Yksityinen",
  noOtherMatches: "Hakua vastaavia muita repoja ei löytynyt.",
  lastUpdated: "Viimeksi päivitetty:",
  unknown: "Ei tiedossa",
  selected: (n: number) => `Valittu ${n} ${n === 1 ? "repo" : "repoa"}.`,
  alsoSite: (n: number) => ` Sivusto hakee lisäksi ${n}.`,
  fetchMore: (n: number) =>
    `Hae ${n} ${n === 1 ? "repo" : "repoa"} lisää ja jatka`,
  fetchBackground: (n: number) =>
    `Hae ${n} ${n === 1 ? "repo" : "repoa"} taustalla ja jatka`,
  continue: "Jatka",
  continueWithout: "Jatka ilman repoja",
};

const repos = (n: number) =>
  `${n} ${plural("en", n, { one: "repository", other: "repositories" })}`;

export const githubRepoChooserText = catalog(fi, {
  eyebrow: "Getting started",
  title: "Choose GitHub repositories to fetch",
  instructions:
    "Choose the repositories you want to use here. They are fetched as workspaces in the background while you go on to sign in to an AI account. You can also continue without repositories and fetch them later from the workspace view.",
  loading: "Fetching GitHub repositories…",
  noAuthTitle: "GitHub sign-in is missing",
  noAuth:
    "Repositories cannot be shown before you sign in to GitHub. You can continue without repositories.",
  unavailableTitle: "The repositories could not be fetched",
  unavailable:
    "Check the connection and try again, or continue without repositories and fetch them later.",
  recheck: "Check again",
  filter: "Find a repository by name",
  updated: "Updated",
  range: "Time range",
  anyTime: "Any time",
  week: "In the last week",
  month: "In the last month",
  quarter: "In the last three months",
  year: "In the last year",
  hidden: (n) => `${n} hidden`,
  unselectVisible: "Clear the visible selections",
  selectVisible: "Select all visible",
  movingOn: "Moving on.",
  none: "No repositories were found. You can continue without repositories.",
  noMatches: "No repositories match the search.",
  listLabel: "GitHub repositories",
  private: "Private",
  noOtherMatches: "No other repositories match the search.",
  lastUpdated: "Last updated:",
  unknown: "Not known",
  selected: (n) => `${repos(n)} selected.`,
  alsoSite: (n) => ` The site also fetches ${n}.`,
  fetchMore: (n) => `Fetch ${repos(n)} more and continue`,
  fetchBackground: (n) => `Fetch ${repos(n)} in the background and continue`,
  continue: "Continue",
  continueWithout: "Continue without repositories",
});

```
