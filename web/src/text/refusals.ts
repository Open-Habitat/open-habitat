import { catalog } from "../i18n";

// Why a write was refused or a conversation did not start, by the host's
// code (app/mutations.ts). The host sends codes; the words are the browser's.
const fi = {
  capacity:
    "Liian monta keskustelua työskentelee jo yhtä aikaa — odota, että jokin vuoro päättyy, tai pysäytä jokin.",
  historyDamaged:
    "Keskustelun historiatiedostossa on vioittunut rivi, joten Habitat ei näytä historiaa eikä käynnistä agenttia sen päälle. Tiedosto on tallella muuttamattomana kotihakemistosi .pi/agent/sessions-kansiossa; jatka uudessa keskustelussa tai pyydä agenttia tarkistamaan tiedosto toisessa keskustelussa.",
  quotaFull:
    "Tallennustilasi on täynnä, eikä keskeneräistä historiariviä voitu siirtää talteen. Vapauta tilaa ja yritä uudelleen.",
  storageFull:
    "Palvelimen levy on täynnä, eikä keskeneräistä historiariviä voitu siirtää talteen. Vapauta tilaa ja yritä uudelleen.",
  writerPresent: "Keskustelua kirjoittaa toinen Pi, esimerkiksi päätteessä.",
  readOnlyStart:
    "Keskustelua ei aloitettu selaimesta, joten se on vain luettavissa.",
  sourceUnavailable: "Pi:n asennusta tai historiaa ei voitu lukea juuri nyt.",
  startFailed: "Pi pysähtyi käynnistyessään.",
  startUnknown:
    "Habitat ei voinut varmistaa, ettei keskustelua kirjoiteta muualla.",
  cloneRunning:
    "GitHub-repositorion tuonti tai sen valmistelu on kesken. Odota sen valmistumista ja yritä uudelleen.",
  checkoutCheck:
    "GitHub-työkopion tarkistus on kesken. Odota hetki ja yritä uudelleen.",
  worktreeCreate:
    "Toisen worktree-agentin luonti on kesken. Odota sen valmistumista ja yritä uudelleen.",
  worktreeCleanup:
    "Worktree-siivous on kesken. Odota sen valmistumista ja yritä uudelleen.",
  deletionRunning:
    "Työtilan poisto tai palautus on kesken. Odota sen valmistumista ja yritä uudelleen.",
  archiveRunning:
    "Keskustelun arkistointi tai palautus on kesken. Odota hetki ja yritä uudelleen.",
  settingsRunning:
    "Työtilan luonti tai asetusten muutos on kesken. Odota hetki ja yritä uudelleen.",
  identityRunning:
    "Git-tekijätietojen tallennus on kesken. Odota hetki ja yritä uudelleen.",
  publishRunning:
    "Työtilan julkaisu GitHubiin on kesken. Odota sen valmistumista ja yritä uudelleen.",
  disconnectRunning:
    "GitHub-yhteyden katkaisun käsittely on kesken. Odota hetki ja yritä uudelleen.",
  busy: "Toinen muutos oli juuri kesken. Yritä uudelleen.",
  writerConflict:
    "Agentti kirjoittaa keskustelua toisaalla, esimerkiksi päätteessä.",
  changed: "Tila muuttui toisaalla. Päivitä tiedot ennen uutta yritystä.",
  workspaceMissing: "Työtilaa ei enää löytynyt.",
  workspaceExists: "Samanniminen työtila on jo olemassa.",
  workspaceUncertain: "Työtilojen tilaa ei voitu lukea varmasti.",
  readOnly: "Historia on vain luettavissa.",
  worktreeBase:
    "Työtilassa ei ole haaraa, josta worktree tehtäisiin (irrotettu HEAD tai ei vielä committeja).",
  worktreeUnavailable:
    "Worktreetä ja haaraa ei voitu luoda. Tarkista työtilan Git-tila.",
  session: "Istunto ei sallinut muutosta. Päivitä sivu tai kirjaudu uudelleen.",
  wait: "Palvelin pyysi odottamaan hetken.",
  refused: "Palvelin ei hyväksynyt muutosta.",
  reverted: "Muutos ei tallentunut. Aiempi tila palautettiin.",
};

export const refusalsText = catalog(fi, {
  capacity:
    "Too many conversations are already working at once — wait until a turn ends, or stop one.",
  historyDamaged:
    "The conversation's history file has a damaged line, so Habitat does not show the history or start an agent on top of it. The file is kept unchanged in the .pi/agent/sessions folder of your home directory; continue in a new conversation or ask an agent to check the file in another conversation.",
  quotaFull:
    "Your storage is full, and the unfinished history line could not be set aside. Free some space and try again.",
  storageFull:
    "The server's disk is full, and the unfinished history line could not be set aside. Free some space and try again.",
  writerPresent:
    "Another Pi is writing the conversation, for example in a terminal.",
  readOnlyStart:
    "The conversation was not started from the browser, so it is read only.",
  sourceUnavailable: "Pi's installation or history could not be read just now.",
  startFailed: "Pi stopped while starting.",
  startUnknown:
    "Habitat could not make sure the conversation is not being written elsewhere.",
  cloneRunning:
    "Importing a GitHub repository, or preparing it, is under way. Wait for it to finish and try again.",
  checkoutCheck:
    "Checking the GitHub working copy is under way. Wait a moment and try again.",
  worktreeCreate:
    "Creating another worktree agent is under way. Wait for it to finish and try again.",
  worktreeCleanup:
    "A worktree cleanup is under way. Wait for it to finish and try again.",
  deletionRunning:
    "Deleting or restoring a workspace is under way. Wait for it to finish and try again.",
  archiveRunning:
    "Archiving or restoring a conversation is under way. Wait a moment and try again.",
  settingsRunning:
    "Creating a workspace or changing its settings is under way. Wait a moment and try again.",
  identityRunning:
    "Saving the Git author details is under way. Wait a moment and try again.",
  publishRunning:
    "Publishing the workspace to GitHub is under way. Wait for it to finish and try again.",
  disconnectRunning:
    "Disconnecting GitHub is under way. Wait a moment and try again.",
  busy: "Another change was just under way. Try again.",
  writerConflict:
    "An agent is writing the conversation elsewhere, for example in a terminal.",
  changed: "The state changed elsewhere. Refresh before trying again.",
  workspaceMissing: "The workspace was no longer found.",
  workspaceExists: "A workspace with the same name already exists.",
  workspaceUncertain: "The workspaces' state could not be read reliably.",
  readOnly: "The history is read only.",
  worktreeBase:
    "The workspace has no branch to make a worktree from (a detached HEAD or no commits yet).",
  worktreeUnavailable:
    "The worktree and branch could not be created. Check the workspace's Git state.",
  session:
    "The session did not allow the change. Reload the page or sign in again.",
  wait: "The server asked to wait a moment.",
  refused: "The server did not accept the change.",
  reverted: "The change was not saved. The previous state was restored.",
});
