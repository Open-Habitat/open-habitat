import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// The new-workspace page (app/NewWorkspacePage.tsx): refusals of clone
// actions, what each Gitea and GitLab list says, and the new directory form.
// Hosts, users and repository names come in as arguments.
type Action = "start" | "retry" | "cancel" | "dismiss" | "remove";

const actionsFi: Record<Action, string> = {
  start: "Kloonauksen aloitus",
  retry: "Uusi yritys",
  cancel: "Keskeytys",
  dismiss: "Ilmoituksen poisto",
  remove: "Poisto",
};
const actionsEn: Record<Action, string> = {
  start: "Starting the clone",
  retry: "The new attempt",
  cancel: "Cancelling",
  dismiss: "Dismissing the notice",
  remove: "Removing",
};

const fi = {
  partial: "Osa keskeneräisestä hakemistosta jäi poistamatta. Yritä uudelleen.",
  refusals: {
    busy: "Toinen kloonaus on jo käynnissä. Odota, että se valmistuu.",
    conflict: "Kohdehakemisto on jo olemassa. Tarkista työtilalista.",
    empty: "Repo on tyhjä, joten sitä ei voi vielä kloonata työtilaksi.",
    gitea:
      "Gitea-yhteys ei ole nyt käytettävissä. Tarkista se kohdassa Asetukset › Koodipalvelut.",
    gitlab:
      "GitLab-yhteys ei ole nyt käytettävissä: tunnus voi olla vanhentunut tai Git-asetus kesken. Tarkista se kohdassa Asetukset › Koodipalvelut.",
    rewritten:
      "Git-asetuksesi (url.insteadOf) ohjaavat tämän repon osoitteen muualle, joten kloonausta ei aloitettu. Poista ohjaus palvelimen osoitteelta ja yritä uudelleen.",
    auth: "GitHub-tunnukset eivät ole käytettävissä. Yhdistä GitHub kohdassa Asetukset › Koodipalvelut.",
    login: "Kirjaudu uudelleen ja yritä sitten.",
  } as Record<string, string>,
  failed: (action: Action) =>
    `${actionsFi[action]} ei onnistunut. Tarkista tilanne yltä ennen uutta yritystä.`,
  giteaFailure: {
    token_rejected: "Gitea hylkäsi tunnuksen",
    insufficient_scope: "tunnukselta puuttuu repojen lukuoikeus",
    unreachable: "palvelin ei vastaa",
    tls_untrusted: "palvelimen varmennetta ei voitu tarkistaa",
    redirect_refused: "palvelin ohjasi toiseen osoitteeseen",
    forbidden_destination: "osoitteeseen ei voi yhdistää",
    not_gitea: "palvelin ei vastannut odotetusti",
    native_unavailable: "tea-asetuksia ei voitu lukea",
    account_mismatch: "tunnus kuuluu nyt toiselle Gitea-tilille",
  } as Record<string, string>,
  gitlabFailure: {
    token_rejected: "GitLab hylkäsi tunnuksen",
    token_expired: "tunnus on vanhentunut, joten projekteja ei näytetä",
    insufficient_scope: "tunnukselta puuttuu read_api",
    unreachable: "palvelin ei vastaa",
    tls_untrusted: "palvelimen varmennetta ei voitu tarkistaa",
    redirect_refused: "palvelin ohjasi toiseen osoitteeseen",
    forbidden_destination: "osoitteeseen ei voi yhdistää",
    not_gitlab: "palvelin ei vastannut odotetusti",
    native_unavailable: "glab-asetuksia ei voitu lukea",
    account_mismatch: "tunnus kuuluu nyt toiselle GitLab-tilille",
  } as Record<string, string>,
  incomplete: {
    limit: "repoja on enemmän kuin kerralla luetaan",
    interrupted: "lukeminen keskeytyi",
    inconsistent: "lista muuttui kesken lukemisen",
  } as Record<string, string>,
  lookupAuth:
    "Repoa ei voi hakea eikä kloonata ennen kuin GitHub-yhteys toimii.",
  asWorkspace: "työtilana",
  cannotStart: "Kloonausta ei voi aloittaa juuri nyt.",
  oneAtATime: (name: string) =>
    `Kloonaus ${name} on käynnissä. Yksi kloonaus kerrallaan.`,
  emptyRepo: "Repo on tyhjä, joten sitä ei voi vielä kloonata työtilaksi.",
  gitlabExpired:
    "GitLab-tunnus on vanhentunut. Vaihda se Koodipalveluissa ennen kloonausta.",
  checkConnection: "Tarkista yhteys",
  codeHosts: "Koodipalvelut",
  giteaFailed: "Gitea-repoja ei saatu juuri nyt. Muut repot näkyvät silti.",
  giteaSourceFailed: (host: string, user: string, why?: string) =>
    `Gitean ${host} (${user}) repoja ei saatu: ${why ?? "tuntematon syy"}.`,
  giteaIncomplete: (host: string, user: string, why?: string) =>
    `Gitean ${host} (${user}) lista on vajaa: ${why ?? "kaikkia repoja ei saatu luettua"}.`,
  gitlabFailed:
    "GitLab-projekteja ei saatu juuri nyt. Muut repot näkyvät silti.",
  gitlabSourceFailed: (host: string, why?: string) =>
    `GitLab ${host}: ${why ?? "projekteja ei saatu"}. Tarkista yhteys:`,
  gitlabElsewhere: (host: string, count: number, origin?: string) =>
    `GitLab ${host}: ${count} projektia jäi pois, koska palvelin ilmoittaa niiden osoitteeksi ${origin ?? "toisen osoitteen"}, eikä Habitat lähetä tunnusta sinne. GitLabin ylläpitäjän pitää korjata external_url.`,
  gitlabIncomplete: (host: string, why?: string) =>
    `GitLabin ${host} lista on vajaa: ${why ?? "kaikkia projekteja ei saatu luettua"}.`,
  title: "Uusi työtila",
  intro: (sources: "all" | "gitlab" | "gitea" | "github", src: ReactNode) => (
    <>
      {sources === "all"
        ? "Kloonaa repo GitHubista, Giteasta tai GitLabista"
        : sources === "gitlab"
          ? "Kloonaa repo GitHubista tai GitLabista"
          : sources === "gitea"
            ? "Kloonaa repo GitHubista tai Giteasta"
            : "Kloonaa GitHub-repo"}{" "}
      tai luo tyhjä hakemisto kotihakemistosi {src}-kansioon.
    </>
  ),
  clones: "Kloonaukset",
  clonesFailed:
    "Kloonausten tilaa ei juuri nyt saatu. Näkyvä tila voi olla vanha.",
  source: "Työtilan lähde",
  cloneRepo: "Kloonaa repo",
  cloneGitHub: "Kloonaa GitHubista",
  newDirectory: "Uusi hakemisto",
  details: "Repon tiedot",
  gitlabLoading: "Haetaan projektia GitLabista…",
  gitlabMissing: "Projektia ei löytynyt tämän GitLab-yhteyden projekteista.",
  giteaLoading: "Haetaan repoa Giteasta…",
  giteaMissing: "Repoa ei löytynyt tämän Gitea-yhteyden repoista.",
  searching: (name: string) => `Haetaan ${name}…`,
  notFound: (name: string) =>
    `Repoa ${name} ei ole, tai sinulla ei ole siihen pääsyä.`,
  needsGitHub: (fix: string) =>
    `Kloonaus tarvitsee GitHub-yhteyden. ${fix} ilmoituksesta.`,
  unreachable: "GitHubiin ei saatu yhteyttä. Yritä hetken päästä uudelleen.",
  // The new directory.
  invalidName: "Tarkista nimi: pienet kirjaimet, numerot sekä . _ -",
  workspacesUnknown: "Työtiloja ei voitu tarkistaa. Päivitä näkymä.",
  createUncertain:
    "Luontia ei voitu vahvistaa. Tarkista työtilalista ennen uutta yritystä.",
  name: "Nimi",
  namePlaceholder: "uusi-projekti",
  nameSlot: "nimi",
  createHint: (path: ReactNode): ReactNode => (
    <>Luodaan {path} ja alustetaan Git-repoksi.</>
  ),
  creating: "Luodaan…",
  create: "Luo työtila",
};

export const newWorkspacePageText = catalog(fi, {
  partial: "Part of the unfinished directory was not removed. Try again.",
  refusals: {
    busy: "Another clone is already running. Wait for it to finish.",
    conflict:
      "The destination directory already exists. Check the workspace list.",
    empty:
      "The repository is empty, so it cannot be cloned as a workspace yet.",
    gitea:
      "The Gitea connection is not available now. Check it in Settings › Code hosts.",
    gitlab:
      "The GitLab connection is not available now: the token may have expired or the Git setup may be unfinished. Check it in Settings › Code hosts.",
    rewritten:
      "Your Git settings (url.insteadOf) redirect this repository's address elsewhere, so the clone was not started. Remove the redirect from the server's address and try again.",
    auth: "GitHub credentials are not available. Connect GitHub in Settings › Code hosts.",
    login: "Sign in again and then try again.",
  },
  failed: (action) =>
    `${actionsEn[action]} did not succeed. Check the situation above before trying again.`,
  giteaFailure: {
    token_rejected: "Gitea rejected the token",
    insufficient_scope: "the token lacks read access to repositories",
    unreachable: "the server does not answer",
    tls_untrusted: "the server's certificate could not be verified",
    redirect_refused: "the server redirected to another address",
    forbidden_destination: "the address cannot be connected to",
    not_gitea: "the server did not answer as expected",
    native_unavailable: "the tea settings could not be read",
    account_mismatch: "the token now belongs to another Gitea account",
  },
  gitlabFailure: {
    token_rejected: "GitLab rejected the token",
    token_expired: "the token has expired, so no projects are shown",
    insufficient_scope: "the token lacks read_api",
    unreachable: "the server does not answer",
    tls_untrusted: "the server's certificate could not be verified",
    redirect_refused: "the server redirected to another address",
    forbidden_destination: "the address cannot be connected to",
    not_gitlab: "the server did not answer as expected",
    native_unavailable: "the glab settings could not be read",
    account_mismatch: "the token now belongs to another GitLab account",
  },
  incomplete: {
    limit: "there are more repositories than are read at once",
    interrupted: "reading was interrupted",
    inconsistent: "the list changed while it was read",
  },
  lookupAuth:
    "The repository cannot be looked up or cloned until the GitHub connection works.",
  asWorkspace: "workspace",
  cannotStart: "A clone cannot be started just now.",
  oneAtATime: (name) => `The clone of ${name} is running. One clone at a time.`,
  emptyRepo:
    "The repository is empty, so it cannot be cloned as a workspace yet.",
  gitlabExpired:
    "The GitLab token has expired. Replace it in Code hosts before cloning.",
  checkConnection: "Check the connection",
  codeHosts: "Code hosts",
  giteaFailed:
    "The Gitea repositories could not be fetched just now. The other repositories still show.",
  giteaSourceFailed: (host, user, why) =>
    `The repositories of Gitea ${host} (${user}) could not be fetched: ${why ?? "unknown reason"}.`,
  giteaIncomplete: (host, user, why) =>
    `The list of Gitea ${host} (${user}) is incomplete: ${why ?? "not every repository could be read"}.`,
  gitlabFailed:
    "The GitLab projects could not be fetched just now. The other repositories still show.",
  gitlabSourceFailed: (host, why) =>
    `GitLab ${host}: ${why ?? "the projects could not be fetched"}. Check the connection:`,
  gitlabElsewhere: (host, count, origin) =>
    `GitLab ${host}: ${count} ${plural("en", count, { one: "project was", other: "projects were" })} left out, because the server gives ${origin ?? "another address"} as their address, and Habitat does not send the token there. The GitLab administrator needs to fix external_url.`,
  gitlabIncomplete: (host, why) =>
    `The list of GitLab ${host} is incomplete: ${why ?? "not every project could be read"}.`,
  title: "New workspace",
  intro: (sources, src) => (
    <>
      {sources === "all"
        ? "Clone a repository from GitHub, Gitea or GitLab"
        : sources === "gitlab"
          ? "Clone a repository from GitHub or GitLab"
          : sources === "gitea"
            ? "Clone a repository from GitHub or Gitea"
            : "Clone a GitHub repository"}{" "}
      or create an empty directory in the {src} folder of your home directory.
    </>
  ),
  clones: "Clones",
  clonesFailed:
    "The state of the clones could not be fetched just now. What is shown may be old.",
  source: "Workspace source",
  cloneRepo: "Clone a repository",
  cloneGitHub: "Clone from GitHub",
  newDirectory: "New directory",
  details: "Repository details",
  gitlabLoading: "Fetching the project from GitLab…",
  gitlabMissing:
    "The project was not found among this GitLab connection's projects.",
  giteaLoading: "Fetching the repository from Gitea…",
  giteaMissing:
    "The repository was not found among this Gitea connection's repositories.",
  searching: (name) => `Looking up ${name}…`,
  notFound: (name) =>
    `The repository ${name} does not exist, or you have no access to it.`,
  needsGitHub: (fix) =>
    `Cloning needs the GitHub connection. Use ${fix} in the notice.`,
  unreachable: "GitHub could not be reached. Try again in a moment.",
  invalidName: "Check the name: lowercase letters, digits and . _ -",
  workspacesUnknown: "The workspaces could not be checked. Refresh the view.",
  createUncertain:
    "Creating could not be confirmed. Check the workspace list before trying again.",
  name: "Name",
  namePlaceholder: "new-project",
  nameSlot: "name",
  createHint: (path) => (
    <>Creates {path} and initializes it as a Git repository.</>
  ),
  creating: "Creating…",
  create: "Create workspace",
});
