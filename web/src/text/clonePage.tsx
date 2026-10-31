import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// The clone page (components/ClonePage.tsx): the repository finder, a
// repository's details, the clone cards and the clones of onboarding.
// Sizes, paths and names come in already formatted, paths as nodes where
// they are set in monospace.
const fi = {
  private: "Yksityinen",
  archived: "arkistoitu",
  empty: "tyhjä",
  sizeUnknown: "koko ei tiedossa",
  large: "suuri",
  // The finder.
  hiddenByTime: (n: number) => `${n} ei päivitetty valitulla aikavälillä`,
  searchLabel: "Hae repoa",
  searchPlaceholder: "Hae nimellä tai kirjoita omistaja/repo",
  updated: "Päivitetty",
  loading: "Haetaan repoja GitHubista…",
  listFailed:
    "Repolistaa ei saatu GitHubista. Voit silti kirjoittaa repon nimen muodossa omistaja/repo.",
  lookupLabel: "GitHub-haku",
  fromGitHub: "GitHubista",
  selected: "✓ valittu",
  unchecked: "ei tarkistettu",
  searching: "Haetaan GitHubista…",
  notFound: "Repoa ei ole, tai sinulla ei ole siihen pääsyä.",
  lookupFailed: "GitHubiin ei saatu yhteyttä. Yritä hetken päästä uudelleen.",
  results: "Hakutulokset",
  noHits: (query: ReactNode, hidden: number): ReactNode => (
    <>
      Ei osumia haulle {query}
      {hidden
        ? ` valitulla aikavälillä. ${hidden} vanhempaa osumaa piilossa.`
        : "."}{" "}
      Kirjoita omistaja/repo, niin haemme sen GitHubista.
    </>
  ),
  recent: "Viimeksi päivitetyt",
  kinds: {
    Omat: "Omat",
    Organisaatio: "Organisaatio",
    Ryhmä: "Ryhmä",
    Aliryhmä: "Aliryhmä",
    Yhteistyö: "Yhteistyö",
  },
  showLess: "Näytä vähemmän",
  showAll: (n: number) => `Näytä kaikki ${n}`,
  truncated:
    "Lista on katkaistu tuhanteen repoon. Kirjoita muun repon nimi muodossa omistaja/repo.",
  // The clone mode.
  cloning: "Kloonataan",
  full: "Koko historia",
  fullAbout: (size: string) => `noin ${size}. `,
  fullText: "Kaikki tiedostoversiot heti levylle.",
  blobless: "Kevyt klooni",
  bloblessText: (filter: ReactNode, log: ReactNode, blame: ReactNode) => (
    <>
      Kaikki commitit, mutta vanhat tiedostoversiot haetaan GitHubista vasta,
      kun niitä tarvitaan ({filter}). Nopeampi ja pienempi; {log} ja {blame}{" "}
      vaativat yhteyden.
    </>
  ),
  push: {
    yes: "Toimii",
    no: "Ei toimi: tunnukselta puuttuu write_repository",
    unknown: "Ei tiedossa",
    expired: "Ei toimi: tunnus vanhentunut",
  },
  // A repository's details.
  details: "Repon tiedot",
  choose: "Valitse repo nähdäksesi sen tiedot ennen kloonausta.",
  allRepos: "Kaikki repot",
  source: "Lähde",
  group: "Ryhmä",
  visibility: "Näkyvyys",
  internal: "Sisäinen: kaikki palvelimen kirjautuneet",
  public: "Julkinen",
  state: "Tila",
  archivedIn: (gitlab: boolean) =>
    `Arkistoitu: vain luku ${gitlab ? "GitLabissa" : "Giteassa"}`,
  defaultBranch: "Oletushaara",
  noBranch: "ei haaraa",
  lastActivity: "Viimeisin toiminta",
  lastPush: "Viimeisin push",
  size: "Koko",
  unknown: "Ei tiedossa",
  gitlabSizeRole: "GitLab kertoo koon vain Reporter-roolille tai ylemmälle",
  gitlabSize: "GitLabin ilmoittama koko",
  giteaSize: "Gitean ilmoittama koko",
  githubSize: "GitHubin arvio pakatusta historiasta",
  pushLabel: "Push",
  target: "Kohde",
  free: "Vapaata",
  sharedDisk: "palvelimen yhteisellä levyllä",
  ofQuota: (size: string) => `kiintiöstä ${size}`,
  alreadyWorkspace: (path: ReactNode): ReactNode => (
    <>Repo on jo työtilana {path}.</>
  ),
  openWorkspace: "Avaa työtila",
  takenUnknown: (path: ReactNode): ReactNode => (
    <>
      Hakemisto {path} on jo olemassa, eikä sen originista voi todeta, onko se
      tämä repo (esimerkiksi SSH-osoite). Sinne ei kloonata. Avaa se
      työtilalistasta, tai nimeä tai poista se ensin.
    </>
  ),
  taken: (path: ReactNode): ReactNode => (
    <>
      Hakemisto {path} on jo olemassa, joten tätä repoa ei voi kloonata sinne.
      Nimeä tai poista nykyinen työtila ensin.
    </>
  ),
  jobShown: "Tämän repon kloonaus näkyy sivun yläosassa.",
  bigTitle: "Suuri repo.",
  big: (size: string, percent?: number) =>
    ` Täysi klooni vie noin ${size}${percent === undefined ? "" : `, ${percent} % vapaasta tilasta`}, ja haku kestää yhteydestä riippuen kymmeniä minuutteja.`,
  clone: "Kloonaa työtilaksi",
  viaGitLab:
    "Kloonataan tämän GitLab-yhteyden tunnuksella. Kloonaus jatkuu palvelimella, vaikka poistut sivulta.",
  viaGitea:
    "Kloonataan tämän Gitea-yhteyden tunnuksella. Kloonaus jatkuu palvelimella, vaikka poistut sivulta.",
  viaGitHub:
    "Kloonataan sinun GitHub-tunnuksillasi. Kloonaus jatkuu palvelimella, vaikka poistut sivulta.",
  // Why a clone failed, by the job's reason code.
  reasons: {
    native_failure:
      "Git keskeytti kloonauksen, esimerkiksi koska palvelin katkaisi yhteyden.",
    auth_refused:
      "Palvelin ei hyväksynyt Gitin kirjautumista. Tunnus voi olla vanhentunut tai peruttu, tai ryhmä voi vaatia voimassa olevan SSO-istunnon: kirjaudu selaimessa ryhmän kertakirjautumisella ja yritä uudelleen.",
    deadline_exceeded: "Kloonaus ei valmistunut 45 minuutissa.",
    verification_failed:
      "Git valmistui, mutta kloonia ei voitu vahvistaa (esimerkiksi tyhjä repo).",
    destination_exists: "Kohdehakemisto ilmestyi kloonauksen aikana.",
    source_unavailable: "Repoa ei saatu luettua GitHubista.",
    daemon_stopping: "Palvelin pysähtyi kesken kloonauksen.",
    cancelled: "Kloonaus keskeytettiin.",
  } as Record<string, string>,
  // A clone card.
  progressOf: (name: string) => `Kloonauksen ${name} edistyminen`,
  continuesOnServer:
    "Kloonaus jatkuu palvelimella, vaikka poistut sivulta tai suljet selaimen.",
  cancelQuestion: (received?: string) =>
    `Keskeytetäänkö? ${received ? `Vastaanotetut ${received} poistetaan` : "Mitään ei ole vielä vastaanotettu"}, eikä keskeneräistä jää levylle.`,
  continueClone: "Jatka kloonausta",
  cancel: "Keskeytä",
  done: (dest: ReactNode): ReactNode => (
    <>Valmis. Repo on kloonattu hakemistoon {dest}.</>
  ),
  close: "Sulje",
  waitingList: "Odotetaan työtilalistaa…",
  cancelled: "Kloonaus keskeytettiin",
  failed: "Kloonaus epäonnistui",
  kept: (dest: string) => `Hakemisto ${dest} jäi levylle.`,
  removed:
    "Keskeneräinen hakemisto poistettiin, joten levylle ei jäänyt mitään ja uusi yritys alkaa puhtaalta pöydältä.",
  dismiss: "Poista ilmoitus",
  retry: "Yritä uudelleen",
  queued: "Jonossa. Alkaa, kun edellinen kloonaus valmistuu.",
  notStarted: "Kloonaus ei alkanut",
  nothingWritten: " Levylle ei kirjoitettu mitään.",
  unqueue: "Poista jonosta",
  interrupted: "Kloonaus keskeytyi",
  interruptedText: (dest: ReactNode, git: ReactNode, size: string) => (
    <>
      Hakemistossa {dest} on keskeneräinen {git} ({size}) ilman yhtään committia
      tai tiedostoa, esimerkiksi koska palvelin käynnistyi uudelleen kesken
      kloonauksen. Git ei osaa jatkaa keskeytynyttä kloonausta, joten uusi
      yritys alkaa alusta.
    </>
  ),
  newAttempt: "Uusi yritys",
  removePartial: (size: string) => `Poista keskeneräinen (${size})`,
  restart: "Aloita alusta",
  cloneOf: (name: string) => `Kloonaus ${name}`,
  modeBlobless: "kevyt klooni",
  modeFull: "koko historia",
  modePartial: "keskeneräinen",
  // The rail and onboarding.
  railLabel: (items: string) => `Kloonaukset: ${items}`,
  routeQueued: "jonossa",
  routePresent: "oli jo haettu",
  routeDone: "valmis",
  routeFailed: "epäonnistui",
  onboardingLabel: "Repojen haku",
  fetchOf: (name: string) => `Repon ${name} haku`,
  problemsTitle: (n: number) =>
    n === 1 ? "Repon haku epäonnistui" : `${n} repon haku epäonnistui`,
  fetchInterrupted:
    "Haku keskeytyi, ja keskeneräinen hakemisto jäi levylle. Jatka tai poista se myöhemmin kloonaussivulla.",
  fetchFailed: "Haku ei onnistunut.",
  leftNothing: " Levylle ei jäänyt mitään.",
  leftDirectory:
    " Hakemisto jäi levylle; tarkista se myöhemmin kloonaussivulla.",
  othersBackground:
    "Muut repot haetaan taustalla. Valmiit repot näkyvät työtiloina.",
};

export const clonePageText = catalog(fi, {
  private: "Private",
  archived: "archived",
  empty: "empty",
  sizeUnknown: "size unknown",
  large: "large",
  hiddenByTime: (n) => `${n} not updated in the chosen period`,
  searchLabel: "Search repositories",
  searchPlaceholder: "Search by name or type owner/repo",
  updated: "Updated",
  loading: "Fetching repositories from GitHub…",
  listFailed:
    "The repository list could not be fetched from GitHub. You can still type a repository's name as owner/repo.",
  lookupLabel: "GitHub lookup",
  fromGitHub: "from GitHub",
  selected: "✓ selected",
  unchecked: "not checked",
  searching: "Searching GitHub…",
  notFound: "The repository does not exist, or you have no access to it.",
  lookupFailed: "GitHub could not be reached. Try again in a moment.",
  results: "Search results",
  noHits: (query, hidden) => (
    <>
      No matches for {query}
      {hidden
        ? ` in the chosen period. ${hidden} older ${plural("en", hidden, { one: "match is", other: "matches are" })} hidden.`
        : "."}{" "}
      Type owner/repo and we will look it up on GitHub.
    </>
  ),
  recent: "Recently updated",
  kinds: {
    Omat: "Yours",
    Organisaatio: "Organisation",
    Ryhmä: "Group",
    Aliryhmä: "Subgroup",
    Yhteistyö: "Collaboration",
  },
  showLess: "Show less",
  showAll: (n) => `Show all ${n}`,
  truncated:
    "The list stops at a thousand repositories. Type any other repository's name as owner/repo.",
  cloning: "Cloning",
  full: "Full history",
  fullAbout: (size) => `About ${size}. `,
  fullText: "Every file version on disk at once.",
  blobless: "Light clone",
  bloblessText: (filter, log, blame) => (
    <>
      Every commit, but old file versions are fetched from GitHub only when they
      are needed ({filter}). Faster and smaller; {log} and {blame} need a
      connection.
    </>
  ),
  push: {
    yes: "Works",
    no: "Does not work: the token lacks write_repository",
    unknown: "Not known",
    expired: "Does not work: the token has expired",
  },
  details: "Repository details",
  choose: "Choose a repository to see its details before cloning.",
  allRepos: "All repositories",
  source: "Source",
  group: "Group",
  visibility: "Visibility",
  internal: "Internal: everyone signed in to the server",
  public: "Public",
  state: "State",
  archivedIn: (gitlab) =>
    `Archived: read only on ${gitlab ? "GitLab" : "Gitea"}`,
  defaultBranch: "Default branch",
  noBranch: "no branch",
  lastActivity: "Last activity",
  lastPush: "Last push",
  size: "Size",
  unknown: "Not known",
  gitlabSizeRole: "GitLab tells the size only to the Reporter role or above",
  gitlabSize: "size reported by GitLab",
  giteaSize: "size reported by Gitea",
  githubSize: "GitHub's estimate of the packed history",
  pushLabel: "Push",
  target: "Destination",
  free: "Free",
  sharedDisk: "on the server's shared disk",
  ofQuota: (size) => `of a ${size} quota`,
  alreadyWorkspace: (path) => (
    <>The repository is already the workspace {path}.</>
  ),
  openWorkspace: "Open workspace",
  takenUnknown: (path) => (
    <>
      The directory {path} already exists, and its origin does not tell whether
      it is this repository (an SSH address, for example). Nothing is cloned
      there. Open it from the workspace list, or rename or remove it first.
    </>
  ),
  taken: (path) => (
    <>
      The directory {path} already exists, so this repository cannot be cloned
      there. Rename or remove the current workspace first.
    </>
  ),
  jobShown: "This repository's clone is shown at the top of the page.",
  bigTitle: "Large repository.",
  big: (size, percent) =>
    ` A full clone takes about ${size}${percent === undefined ? "" : `, ${percent}% of the free space`}, and the fetch can take tens of minutes depending on the connection.`,
  clone: "Clone as workspace",
  viaGitLab:
    "Cloned with this GitLab connection's token. The clone continues on the server even if you leave the page.",
  viaGitea:
    "Cloned with this Gitea connection's token. The clone continues on the server even if you leave the page.",
  viaGitHub:
    "Cloned with your GitHub credentials. The clone continues on the server even if you leave the page.",
  reasons: {
    native_failure:
      "Git stopped the clone, for example because the server closed the connection.",
    auth_refused:
      "The server did not accept Git's sign-in. The token may have expired or been revoked, or the group may require a valid SSO session: sign in to the group's single sign-on in the browser and try again.",
    deadline_exceeded: "The clone did not finish in 45 minutes.",
    verification_failed:
      "Git finished, but the clone could not be verified (an empty repository, for example).",
    destination_exists: "The destination directory appeared during the clone.",
    source_unavailable: "The repository could not be read from GitHub.",
    daemon_stopping: "The server stopped in the middle of the clone.",
    cancelled: "The clone was cancelled.",
  },
  progressOf: (name) => `Progress of cloning ${name}`,
  continuesOnServer:
    "The clone continues on the server even if you leave the page or close the browser.",
  cancelQuestion: (received) =>
    `Cancel? ${received ? `The ${received} received is deleted` : "Nothing has been received yet"}, and nothing unfinished is left on disk.`,
  continueClone: "Keep cloning",
  cancel: "Cancel",
  done: (dest) => <>Done. The repository is cloned into {dest}.</>,
  close: "Close",
  waitingList: "Waiting for the workspace list…",
  cancelled: "The clone was cancelled",
  failed: "The clone failed",
  kept: (dest) => `The directory ${dest} was left on disk.`,
  removed:
    "The unfinished directory was removed, so nothing was left on disk and a new attempt starts from a clean slate.",
  dismiss: "Dismiss",
  retry: "Try again",
  queued: "Queued. Starts when the previous clone finishes.",
  notStarted: "The clone did not start",
  nothingWritten: " Nothing was written to disk.",
  unqueue: "Remove from queue",
  interrupted: "The clone was interrupted",
  interruptedText: (dest, git, size) => (
    <>
      The directory {dest} has an unfinished {git} ({size}) without a single
      commit or file, for example because the server restarted in the middle of
      the clone. Git cannot resume an interrupted clone, so a new attempt starts
      from the beginning.
    </>
  ),
  newAttempt: "New attempt",
  removePartial: (size) => `Remove the unfinished clone (${size})`,
  restart: "Start over",
  cloneOf: (name) => `Clone ${name}`,
  modeBlobless: "light clone",
  modeFull: "full history",
  modePartial: "unfinished",
  railLabel: (items) => `Clones: ${items}`,
  routeQueued: "queued",
  routePresent: "already fetched",
  routeDone: "done",
  routeFailed: "failed",
  onboardingLabel: "Fetching repositories",
  fetchOf: (name) => `Fetching the repository ${name}`,
  problemsTitle: (n) =>
    n === 1
      ? "Fetching a repository failed"
      : `Fetching ${n} repositories failed`,
  fetchInterrupted:
    "The fetch was interrupted, and the unfinished directory was left on disk. Resume or remove it later on the clone page.",
  fetchFailed: "The fetch did not succeed.",
  leftNothing: " Nothing was left on disk.",
  leftDirectory:
    " The directory was left on disk; check it later on the clone page.",
  othersBackground:
    "The other repositories are fetched in the background. Finished ones show as workspaces.",
});
