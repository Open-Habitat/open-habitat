import { catalog } from "../i18n";

// The application frame's own states (app/App.tsx): page titles, the home
// page's catalog states and the views for a missing target.
const fi = {
  onlyWorkspace: (name: string) =>
    `${name} on ainoa työtilasi, joten näkymä keskittyy siihen. Sivupalkki tulee esiin, kun lisäät toisen työtilan.`,
  oneLeft: "Jäljellä on yksi työtila, joten näkymä keskittyy siihen.",
  manyNow: (count: number) =>
    `Työtiloja on nyt ${count === 2 ? "kaksi" : count}, joten sivupalkki näyttää ne ryhminä.`,
  conversationUncertain: "Keskustelun tilaa ei voitu tarkistaa",
  conversationMissing: "Keskustelua ei löydy",
  checkAgain: "Tarkista tiedot uudelleen",
  chooseAnother: "Valitse toinen keskustelu",
  conversationUncertainDetail:
    "Kaikkia tietoja ei saatu. Keskustelua ei voi vielä todeta poistuneeksi.",
  conversationMissingDetail:
    "Se ei näy työtiloissasi. Palaa työtiloihin tai tarkista tiedot uudelleen.",
  retry: "Yritä uudelleen",
  allWorkspaces: "Kaikki työtilat",
  catalogPartialTitle: "Kaikkia työtiloja ei voitu tarkistaa",
  catalogPartialDetail:
    "Kaikkia työtiloja ei voitu tarkistaa. Näet vain löytyneet työtilat; kokeile päivittää tiedot myöhemmin.",
  targetUncertain: "Kohteen tilaa ei voida vahvistaa",
  targetMissing: "Kohdetta ei enää löydy",
  targetUncertainDetail:
    "Kaikkia työtiloja ei voitu tarkistaa. Tätä työtilaa ei löytynyt saaduista tiedoista. Yritä uudelleen.",
  targetMissingDetail:
    "Tätä työtilaa ei enää löydy. Voit valita toisen työtilan.",
  whatNow: "Mitä voit tehdä?",
  archiveIncompleteTitle: "Arkistoa ei voitu kokonaan tarkistaa",
  archiveMarksUnread:
    "Keskustelujen arkistomerkintöjä ei voitu lukea. Emme voi näyttää, mitkä keskustelut on arkistoitu.",
  archiveHistoryUnread:
    "Keskustelujen agenttihistoriaa puuttuu tai sitä ei voitu lukea. Osa keskusteluista voi puuttua arkistosta.",
  refreshData: "Päivitä tiedot.",
  catalogMissingTitle: "Työtilakansiota ei löydy",
  catalogMissingDetail:
    "Työtilakansiota ei löydy. Jos loit sen juuri, kokeile päivittää tiedot.",
  workspacesPartialTitle: "Työtiloja ei voitu vahvistaa",
  workspacesPartialDetail:
    "Kaikkia työtiloja ei voitu tarkistaa. Näet vain löytyneet työtilat.",
  workspacesEmptyTitle: "Työtiloja ei vielä ole",
  workspacesEmptyDetail:
    "Työtilakansiossa ei ole vielä näkyviä työtiloja. Jos loit sellaisen juuri, päivitä tiedot.",
  refreshAction: "Päivitä tiedot",
  settings: "Asetukset",
  newWorkspace: "Uusi työtila",
  home: "Etusivu",
};

export const appText = catalog(fi, {
  onlyWorkspace: (name) =>
    `${name} is your only workspace, so the view centres on it. The sidebar appears when you add a second workspace.`,
  oneLeft: "One workspace is left, so the view centres on it.",
  manyNow: (count) =>
    `You now have ${count === 2 ? "two" : count} workspaces, so the sidebar shows them in groups.`,
  conversationUncertain: "The conversation's state could not be checked",
  conversationMissing: "Conversation not found",
  checkAgain: "Check again",
  chooseAnother: "Choose another conversation",
  conversationUncertainDetail:
    "Not all information arrived. The conversation cannot yet be said to be gone.",
  conversationMissingDetail:
    "It is not in your workspaces. Go back to your workspaces or check again.",
  retry: "Try again",
  allWorkspaces: "All workspaces",
  catalogPartialTitle: "Not all workspaces could be checked",
  catalogPartialDetail:
    "Not all workspaces could be checked. You see only the ones found; try refreshing later.",
  targetUncertain: "The target's state cannot be confirmed",
  targetMissing: "The target no longer exists",
  targetUncertainDetail:
    "Not all workspaces could be checked. This workspace was not among those found. Try again.",
  targetMissingDetail:
    "This workspace no longer exists. You can choose another workspace.",
  whatNow: "What can you do?",
  archiveIncompleteTitle: "The archive could not be fully checked",
  archiveMarksUnread:
    "The conversations' archive marks could not be read. We cannot show which conversations are archived.",
  archiveHistoryUnread:
    "Some of the conversations' agent history is missing or could not be read. Some conversations may be missing from the archive.",
  refreshData: "Refresh.",
  catalogMissingTitle: "Workspace folder not found",
  catalogMissingDetail:
    "The workspace folder was not found. If you just created it, try refreshing.",
  workspacesPartialTitle: "Workspaces could not be confirmed",
  workspacesPartialDetail:
    "Not all workspaces could be checked. You see only the ones found.",
  workspacesEmptyTitle: "No workspaces yet",
  workspacesEmptyDetail:
    "The workspace folder has no visible workspaces yet. If you just created one, refresh.",
  refreshAction: "Refresh",
  settings: "Settings",
  newWorkspace: "New workspace",
  home: "Home",
});
