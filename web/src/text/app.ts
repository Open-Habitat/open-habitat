import { catalog } from "../i18n";

// The application frame's own states (app/App.tsx): page titles, the home
// page's catalog states and the views for a missing target.
const fi = {
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
  closeRefused: (reason: string) =>
    `Sulkemista ei tehty: ${reason} Keskustelussa voi olla sisältöä.`,
  closeReverted: "Sulkeminen ei tallentunut. Keskustelu on yhä listassa.",
  archiveWorkspaceRefused: (reason: string) =>
    `Arkistointia ei tehty: ${reason} Työtila näkyy taas.`,
  restoreRefused: (reason: string) => `Palautusta ei tehty: ${reason}`,
  archiveWorkspaceReverted: "Arkistointi ei tallentunut. Työtila näkyy taas.",
  restoreWorkspaceReverted:
    "Palautus ei tallentunut. Työtila on yhä arkistossa.",
  renameRefused: (reason: string) => `Nimeä ei vaihdettu: ${reason}`,
  turnRefused: (reason: string) => `Ei siirretty: ${reason}`,
  renameReverted: "Uusi nimi ei tallentunut. Aiempi nimi palautettiin.",
  archiveConversationRefused: (reason: string) =>
    `Arkistointia ei tehty: ${reason} Keskustelu palautettiin listaan.`,
  archiveConversationReverted:
    "Arkistointi ei tallentunut. Keskustelu on yhä listassa.",
  restoreConversationReverted:
    "Palautus ei tallentunut. Keskustelu on yhä arkistossa.",
  createNeedsConnection: "Päivitä yhteys ennen uuden keskustelun luontia.",
  createPending: "Luonti on käynnissä.",
  createUncertain:
    "Luonnin tulos epävarma. Tarkista keskustelulista ja natiivi historia ennen uutta yritystä.",
  loadingDefaultAgent: "Ladataan oletusagentin tietoja.",
  modelsUnconfirmed:
    "Agentin malliluetteloa ei voitu vahvistaa. Tarkista kirjautuminen.",
  createRefused: (reason: string) => `Uutta keskustelua ei luotu: ${reason}`,
  createUncertainNoResend:
    "Luonnin tulos epävarma. Tarkista tiedot ennen uutta yritystä; pyyntöä ei lähetetä automaattisesti uudelleen.",
  createSessionUnconfirmed:
    "Istuntoa ei voitu vahvistaa. Luontia ei lähetetty.",
  closing: "Suljetaan…",
  archiveUnavailable: "Arkistointi ei ole käytettävissä.",
  closingInProgress: "Sulkeminen kesken.",
  archiveStateUnconfirmed: "Arkiston tilaa ei voida vahvistaa.",
  writerRunning: "Kirjoittaja on käynnissä.",
  waitBackgroundAndTurn:
    "Odota taustatyön valmistumista ja agentin vuoron päättymistä.",
  waitTurn: "Odota agentin vuoron päättymistä.",
  processUnconfirmed: "Prosessin tilaa ei voitu vahvistaa.",
  renameUnavailable: "Nimeäminen ei ole käytettävissä.",
  conversationNotFound: "Keskustelua ei löydy.",
  closeFailed: "Sulkeminen epäonnistui",
  archiveChangeFailed: "Arkiston muutosta ei tehty",
  workspaceNeedsConnection: "Yhteys pitää vahvistaa ennen työtilan luontia.",
  serverReadOnly: "Palvelin on vain luku -tilassa.",
  workspacesUnchecked:
    "Työtiloja ei voitu tarkistaa. Päivitä tiedot ennen työtilan luontia.",
  checkCreation: "Tarkista luonnin tulos",
  creationUnconfirmed:
    "Luonnin tilaa ei voida vahvistaa. Tarkista keskustelulista ja natiivi historia.",
  dismissNotice: "Sulje ilmoitus",
  archive: "Arkisto",
  workspaceArchive: "Työtilan arkisto",
  archiveMarksUnreadRefresh:
    "Keskustelujen arkistomerkintöjä ei voitu lukea. Emme voi näyttää, mitkä keskustelut on arkistoitu. Päivitä tiedot.",
  archiveMaybeIncomplete:
    "Arkisto voi olla puutteellinen: keskustelujen agenttihistoriaa puuttuu tai sitä ei voitu lukea. Osa keskusteluista voi puuttua arkistosta. Päivitä tiedot.",
  historyUnreadable: "Historia ei ole luettavissa.",
  restoreVisible: "Palauta näkyviin",
  historyUnconfirmed: "Historiaa ei voitu vahvistaa",
  restoreNeedsConnection: "Päivitä yhteys ennen palautusta",
  loadingCatalog: "Ladataan katalogia",
  railCreateUncertain: "Keskustelun luonnin tulos epävarma",
  disconnected: "Yhteys poikki.",
  readOnly: "Vain luku.",
};

export const appText = catalog(fi, {
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
  closeRefused: (reason) =>
    `Not closed: ${reason} The conversation may have content.`,
  closeReverted: "Closing was not saved. The conversation is still listed.",
  archiveWorkspaceRefused: (reason) =>
    `Not archived: ${reason} The workspace is shown again.`,
  restoreRefused: (reason) => `Not restored: ${reason}`,
  archiveWorkspaceReverted:
    "Archiving was not saved. The workspace is shown again.",
  restoreWorkspaceReverted:
    "Restoring was not saved. The workspace is still in the archive.",
  renameRefused: (reason) => `Not renamed: ${reason}`,
  turnRefused: (reason) => `Not moved: ${reason}`,
  renameReverted: "The new name was not saved. The previous name is back.",
  archiveConversationRefused: (reason) =>
    `Not archived: ${reason} The conversation is back in the list.`,
  archiveConversationReverted:
    "Archiving was not saved. The conversation is still listed.",
  restoreConversationReverted:
    "Restoring was not saved. The conversation is still in the archive.",
  createNeedsConnection:
    "Refresh the connection before starting a new conversation.",
  createPending: "A conversation is being started.",
  createUncertain:
    "Whether the conversation started is uncertain. Check the conversation list and the native history before trying again.",
  loadingDefaultAgent: "Loading the default agent.",
  modelsUnconfirmed:
    "The agent's model list could not be confirmed. Check the sign-in.",
  createRefused: (reason) => `No new conversation was started: ${reason}`,
  createUncertainNoResend:
    "Whether the conversation started is uncertain. Check before trying again; the request is not resent automatically.",
  createSessionUnconfirmed:
    "The session could not be confirmed. Nothing was sent.",
  closing: "Closing…",
  archiveUnavailable: "Archiving is not available.",
  closingInProgress: "Closing in progress.",
  archiveStateUnconfirmed: "The archive state cannot be confirmed.",
  writerRunning: "A writer is running.",
  waitBackgroundAndTurn:
    "Wait for the background work to finish and the agent's turn to end.",
  waitTurn: "Wait for the agent's turn to end.",
  processUnconfirmed: "The process state could not be confirmed.",
  renameUnavailable: "Renaming is not available.",
  conversationNotFound: "Conversation not found.",
  closeFailed: "Closing failed",
  archiveChangeFailed: "The archive was not changed",
  workspaceNeedsConnection:
    "The connection must be confirmed before creating a workspace.",
  serverReadOnly: "The server is read-only.",
  workspacesUnchecked:
    "Workspaces could not be checked. Refresh before creating a workspace.",
  checkCreation: "Check whether it started",
  creationUnconfirmed:
    "Whether the conversation started cannot be confirmed. Check the conversation list and the native history.",
  dismissNotice: "Dismiss notice",
  archive: "Archive",
  workspaceArchive: "Workspace archive",
  archiveMarksUnreadRefresh:
    "The conversations' archive marks could not be read. We cannot show which conversations are archived. Refresh.",
  archiveMaybeIncomplete:
    "The archive may be incomplete: some of the conversations' agent history is missing or could not be read. Some conversations may be missing from it. Refresh.",
  historyUnreadable: "History is not readable.",
  restoreVisible: "Restore",
  historyUnconfirmed: "The history could not be confirmed",
  restoreNeedsConnection: "Refresh the connection before restoring",
  loadingCatalog: "Loading the catalog",
  railCreateUncertain: "Whether the conversation started is uncertain",
  disconnected: "Disconnected.",
  readOnly: "Read-only.",
});
