import { catalog } from "../i18n";

// Importing a GitHub repository and publishing a workspace to GitHub
// (app/WorkspaceGitHub.tsx). Stage codes, names and byte counts come in as
// arguments.
const fi = {
  reasons: {
    origin_conflict:
      "Origin osoittaa toiseen repoon. Tarkista paikallinen Git ennen julkaisemista.",
    remote_conflict:
      "GitHub-repo on jo käytössä, väärällä näkyvyydellä tai sitä ei voitu varmistaa tyhjäksi.",
    github_auth_unavailable:
      "Paikallinen GitHub-valtuutus ei vastaa tätä käyttäjää.",
    workspace_changed: "Työtila muuttui havainnon jälkeen. Päivitä työtilat.",
  } as Record<string, string>,
  unconfirmed: "GitHubin tai Gitin tilaa ei voitu vahvistaa.",
  invalidObservation: "Havainto ei kelpaa.",
  catalogFailed: "Repojen hakua ei voitu vahvistaa. Yritä myöhemmin uudelleen.",
  importing: "Tuonti käynnissä…",
  notFree: "Kohde ei ole vahvistetusti vapaa. Tarkista työtilat.",
  progress: (stage: string, percent?: number, bytes?: number) =>
    `Tuonti: ${stage}${percent === undefined ? "" : ` ${percent} %`}${bytes === undefined ? "" : ` · ${bytes} tavua`}`,
  importUncertain:
    "Tuonnin tulos on epävarma. Tarkista paikallinen Git ennen uutta yritystä.",
  imported: "Repo tuotu työtilaksi.",
  observationFailed: "Havainto epäonnistui. Mitään ei muutettu.",
  stageRunning: "Vaihe käynnissä…",
  stageUncertain:
    "Vaiheen tulos on epävarma. Älä toista kirjoitusta; tarkista GitHub ja Git uudella havainnolla.",
  replyUnconfirmed:
    "Vastausta ei voitu vahvistaa. Tarkista tila ennen jatkamista.",
  stageDone: {
    create: "GitHub-repo luotu. Tarkista seuraava vaihe uudella havainnolla.",
    origin: "Origin asetettu. Tarkista seuraava vaihe uudella havainnolla.",
    push: "Push vahvistettu. Tarkista seuraava vaihe uudella havainnolla.",
  },
  uncertain: "Tulos on epävarma.",
  label: "GitHub-työtilat",
  importTitle: "Tuo GitHub-repo",
  showRepos: "Näytä repot",
  searchRepos: "Hae repoja",
  repo: "Repo",
  chooseRepo: "Valitse repo",
  import: "Tuo työtilaksi",
  continueTitle: "Jatka GitHub-julkaisua",
  publishTitle: "Julkaise GitHubiin",
  continueText:
    "GitHub-originilla ei näy haettuja haaroja. Tarkista omistaja, repo ja näkyvyys ennen mahdollista push-vaihetta.",
  publishText:
    "Jokainen vaihe (luonti, origin, push) vaatii uuden havainnon. Epävarmaa vaihetta ei toisteta automaattisesti.",
  owner: "Omistaja",
  visibility: "Näkyvyys",
  private: "Yksityinen",
  public: "Julkinen",
  inspect: "Tarkista GitHub ja Git",
  next: (stage: string, name: string, visibility: string) =>
    `Seuraava vaihe: ${stage}. Kohde: ${name} (${visibility}). Kirjoita tarkka nimi vahvistaaksesi.`,
  localGit: "Paikallinen Git:",
  clean: "puhdas",
  changes: "muutoksia",
  stateUnknown: "tila tuntematon",
  head: (head?: string) => `; HEAD ${head ?? "tuntematon"}.`,
  confirm: "Vahvista owner/repository",
  run: (stage: string) => `Suorita ${stage}`,
  otherRemote:
    "Työtilalla on toinen etärepo. Julkaiseminen vaatii työtilan ilman etärepoa.",
  remoteUnknown:
    "Gitin etärepoa ei voitu tarkistaa. Päivitä tiedot ennen julkaisemista.",
};

export const workspaceGitHubText = catalog(
  fi,
  {
    reasons: {
      origin_conflict:
        "The origin points to another repository. Check the local Git before publishing.",
      remote_conflict:
        "The GitHub repository is already in use, has the wrong visibility, or could not be confirmed empty.",
      github_auth_unavailable:
        "The local GitHub authorization does not match this user.",
      workspace_changed:
        "The workspace changed after the observation. Refresh the workspaces.",
    },
    unconfirmed: "The state of GitHub or Git could not be confirmed.",
    invalidObservation: "The observation is not valid.",
    catalogFailed:
      "Fetching the repositories could not be confirmed. Try again later.",
    importing: "Import in progress…",
    notFree:
      "The destination is not confirmed to be free. Check the workspaces.",
    progress: (stage, percent, bytes) =>
      `Import: ${stage}${percent === undefined ? "" : ` ${percent}%`}${bytes === undefined ? "" : ` · ${bytes} bytes`}`,
    importUncertain:
      "The import's result is uncertain. Check the local Git before trying again.",
    imported: "The repository was imported as a workspace.",
    observationFailed: "The observation failed. Nothing was changed.",
    stageRunning: "Step in progress…",
    stageUncertain:
      "The step's result is uncertain. Do not repeat the write; check GitHub and Git with a new observation.",
    replyUnconfirmed:
      "The reply could not be confirmed. Check the state before continuing.",
    stageDone: {
      create:
        "GitHub repository created. Check the next step with a new observation.",
      origin: "Origin set. Check the next step with a new observation.",
      push: "Push confirmed. Check the next step with a new observation.",
    },
    uncertain: "The result is uncertain.",
    label: "GitHub workspaces",
    importTitle: "Import a GitHub repository",
    showRepos: "Show repositories",
    searchRepos: "Search repositories",
    repo: "Repository",
    chooseRepo: "Choose a repository",
    import: "Import as workspace",
    continueTitle: "Continue publishing to GitHub",
    publishTitle: "Publish to GitHub",
    continueText:
      "The GitHub origin shows no fetched branches. Check the owner, repository and visibility before any push step.",
    publishText:
      "Each step (create, origin, push) needs a new observation. An uncertain step is not repeated automatically.",
    owner: "Owner",
    visibility: "Visibility",
    private: "Private",
    public: "Public",
    inspect: "Check GitHub and Git",
    next: (stage, name, visibility) =>
      `Next step: ${stage}. Destination: ${name} (${visibility}). Type the exact name to confirm.`,
    localGit: "Local Git:",
    clean: "clean",
    changes: "changes",
    stateUnknown: "state unknown",
    head: (head) => `; HEAD ${head ?? "unknown"}.`,
    confirm: "Confirm owner/repository",
    run: (stage) => `Run ${stage}`,
    otherRemote:
      "The workspace has another remote. Publishing needs a workspace without a remote.",
    remoteUnknown:
      "Git's remote could not be checked. Refresh the information before publishing.",
  },
  {
    reasons: {
      github_auth_unavailable:
        "The local GitHub authorisation does not match this user.",
    },
  },
);
