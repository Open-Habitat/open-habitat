# Result: English for home, workspaces and cloning

## What landed

Every module the issue lists reads its text from its own catalog in
`web/src/text/` (`homeWorkspaces`, `workspacePage`, `newWorkspacePage`,
`clonePage`, `cloneProgress`, `repoCatalog`, `githubRepoChooser`,
`workspaceGitHub`, `githubOnboarding`, `githubConnectionNotice`,
`integrationOnboarding`, `workspaceActions`, `workspaceDeletion`,
`trashNotice`, `startHere` (StartHere and WorkspaceIntro share it),
`gitStatus`, `workspaceGit`, `archiveControls`, `workspaceIconPicker` (picker
and suggestion row), `workspaceIcons`, `workspaceIconWrite`). No helper in
`src/i18n` changed.

Along the way:

- Dates, times and sizes on these views go through `formatDate` /
  `formatNumber` (the clone page's push times and sizes, the Git layer's
  clock, the onboarding chooser's dates); none hard-codes `fi-FI` any more.
- A sentence that was built from a verb phrase plus "ei onnistunut" on the
  clone page is now chosen by an action identifier, because English needs a
  different sentence, not a translated fragment.
- Lookups of refusal and reason codes in catalog tables use `Object.hasOwn`,
  so a code such as `constructor` cannot read a prototype member.
- The copy-path button keeps a state identifier instead of comparing its
  displayed Finnish word.

Checks: `tsc`, `biome`, `vitest` (159 files, 1091 tests, Finnish) pass. The new
lab spec `web/tests/lab-en-workspaces.spec.ts` (`@ui-language`) signs in from
an `en-GB` browser and checks home, the workspace page, its Git layer and the
clone page in English with none of their Finnish words left. These Finnish
specs pass unchanged: clone-page, home-workspace-sections,
github-first-onboarding, gitlab, lab-git-status, lab-workspace-page,
lab-workspace-icon-setting, lab-workspace-icon-suggestions,
lab-workspace-trash, lab-workspace-landing, start-here, workspace-archive,
onboarding-default-repos, single-workspace-mode, github-connection-warning.

English screenshots at device scale factor 2 are in `evidence/` (home, the
workspace page, its Git details, the icon picker, the delete check, the clone
page, a repository's details, the new-directory form), made with
`web/lab/en-workspaces-shots.mjs`. As with `ui-language-choice`, only the PNGs
are committed; the script writes the HTML twins beside them for checking.

## Still Finnish on these views, from elsewhere

Not this unit's modules, seen on the screenshots or in the code:

- From the host and the model: the repository's start page and goal cards,
  conversation titles and recaps, the icon model's reply and its reasons
  ("Synteettinen malli ehdottaa", "suunta"), GitHub refusals that carry their
  own message (`GitHubError` with code `storage` shows `e.message`), and the
  stage name in the old import notice (shown as the daemon sends it).
- Other modules, owned by `en-shell-editor`'s catch-all or `en-composer`:
  `app/WorkspaceLanding.tsx` (the start-page wrapper's disabled reason and
  the single-workspace hint), `components/ArchiveNotice.tsx` (show/hide other
  notices, close), `components/PendingNote.tsx`, `app/cloneJobs.ts`
  (`cloneLabel`, the clone's state word on a catalog row), and the composer's
  dictation button ("Sanele") in the icon suggestion row.

## Decisions for later review

- **Section kinds stay Finnish identifiers.** `repoCatalog` sorts and tests by
  "Omat", "Organisaatio" and so on; the clone page maps them to labels
  (Yours, Organisation, Group, Subgroup, Collaboration). Alternative: rename
  the identifiers to English codes; not done because nothing visible needs it
  and the tests name them.
- **Quick wishes are sent in the interface's language.** The suggestion
  row's quick wishes are the wish text the model receives, so English sends
  "more playful", "more businesslike", "letters", "something else". The daemon
  passes the wish through unchanged; a model answers either language.
- **"repo" became "repository"** in running English text, and Finnish
  "etärepo" became "remote", following the Trash catalog. Short chips keep
  their terse form ("no push", "size unknown").
- **"Push" and "pull --rebase" stay as Git words**, as in Finnish.
- **The clone page's "tämän GitLab-yhteyden tunnuksella"** is "with this
  GitLab connection's token"; Code hosts is the Settings page's English name.
- **"Käyttöönotto"** (onboarding eyebrow) is "Getting started", and
  aborting it is "Stop getting started and sign out".
