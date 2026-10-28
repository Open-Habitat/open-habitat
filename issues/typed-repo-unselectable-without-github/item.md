---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: taskfleet:01m60hjy6bp0w3rj69711a1736/typed-repo-unselectable
originating_run: 01m60hjy6bp0w3rj69711a1736
originating_run_kind: spinoff
---

# Typed owner/repo cannot be chosen when the GitHub repository list failed

## Description

# Typed owner/repo cannot be chosen when the GitHub list failed

Jari 2026-10-28 (Northwind, pilot.13): Asetukset › Käyttöönotto › Lisää oletusrepo
said "Repolistaa ei saatu GitHubista. Voit silti kirjoittaa repon nimen muodossa
omistaja/repo.", but no typed name could be chosen, so no default repository
could be set. The cause was his broken GitHub connection.

## Why

The finder's rows are links; a typed exact name becomes a row only when the
lookup `GET /api/v1/onboarding/github/repository` answers `found`
(`web/src/app/OnboardingAdministration.tsx` around line 108; the same in
`NewWorkspacePage.tsx` around line 270). The daemon's lookup first runs
`boundGitHubUser` with the same gh credentials as the catalog
(`internal/daemon/github_repos_linux.go:317`), so whenever the catalog failed
because of the connection (`409 github_auth_unavailable`, line 215) the lookup
fails the same way. The browser turns every failure into `failed`, and
`RepoFinder` then shows "GitHubiin ei saatu yhteyttä. Yritä hetken päästä
uudelleen." with nothing to pick (`web/src/components/ClonePage.tsx:195`, `:244`).
The hint promises a route that can only work when the list failed for some
other reason (a 503 while paging).

## Effect

- Lisää oletusrepo: the administrator cannot add a default at all, although
  saving needs no GitHub (`internal/gateway/onboarding.go` checks only the name's
  form; access is checked at each new person's sign-in).
- Uusi työtila: the same false hint; cloning needs the connection anyway, so
  there the fault is the wording, not a missing path.

## Fix direction

See `issues/proto-github-connection-warning/result.md` (the prototype round
whose chosen direction becomes the implementation). At minimum: do not
promise the typed route when the failure is the connection (the browser
already maps 409 `github_auth_unavailable` to `GitHubError("auth")`, but
both callers drop the code), and in Lisää oletusrepo let a typed exact name
be added unchecked.
