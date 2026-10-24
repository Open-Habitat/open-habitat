# Result

GitHub and every Gitea connection now form one common list whose sources
cannot be confused with each other. Each Gitea source says whether its list is
complete and, if not, why, and it lists nothing under an account whose token
now authenticates someone else. The daemon recognises an existing clone by its
origin and tells the browser only the connected base and owner/name. The
browser therefore marks a repository "työtilana" wherever its clone lives, and
it refuses to clone over a directory whose origin is another or unknown.
Nothing new was added: no unit, socket, runtime dependency, store or cache, and
no new Gitea read beyond `/user` and `/user/repos`.

## What changed

- **Bounded, self-checking list** (`internal/nativegitea/repos.go`). Pages are
  always asked for by number under the base. Gitea's `Link: rel="next"` and
  `X-Total-Count` are only checked, never followed. A next link that is not
  exactly page+1 of the same list on the same host, port and base path (no
  userinfo) ends the list as `inconsistent`. So do a repeated id, a total that
  changes or disagrees with what was read, an empty page that still links
  further, and a repository whose clone URL is outside the base. A 401, 403,
  redirect, TLS or destination refusal on any page fails the whole source. A
  later timeout, 5xx or HTML page ends it as `interrupted`. The page, result
  (1000) and byte bounds (1 MiB per page, 8 MiB per list) end it as `limit`.
  The time bound stays 30 s. Every read must answer `application/json`, so a
  login page or another service is `not_gitea`, never an empty list. An empty
  or `null` page never proves completeness (review finding).
- **Source identity** (`internal/daemon/integrations/gitea_linux.go`). Each
  source first reads `/user` with its token. If the login differs from tea's
  `user`, or an owned entry's id differs from the id in its name, the source
  fails with `account_mismatch` and lists nothing. Each repository's `owned`
  compares Gitea's owner id with that account's id.
- **Workspace origin facts** (`internal/nativegitea/origin.go`,
  `internal/daemon/workspace_remote_linux.go`, `snapshot_linux.go`). The
  snapshot's main checkouts carry `gitea_origin {base_url, full_name}` when Git's
  effective origin is exactly `https://<base>/<owner>/<name>[.git]` under the
  base of one of tea's logins as the file says now. The origin is read in the
  same call as `git_remote` and kept in the watch cache, never in the reply.
  SSH, userinfo, query, encoding, dot segments, another port, another base
  path, and an unreadable tea file never match.
- **Contracts**: `gitea-repos.schema.json` gains `owned`, `incomplete`
  (required exactly when an ok source is not complete) and `account_mismatch`.
  `snapshot.schema.json` gains `gitea_origin`, with its patterns inlined so the
  browser's snapshot validator stands alone. Examples and negative cases were
  added in `validate-contracts.py`.
- **Web**: `web/src/app/workspaceMatch.ts` decides `same`, `taken` or `unknown`
  for both providers. A row is `same` when some workspace's origin is this
  repository: GitHub by `github_repo`, Gitea by base plus owner/name compared
  case-insensitively, never by account. If no origin matches and the clone's
  directory exists, the row is `taken` when that directory's origin is known
  to be another (none, another GitHub, another Gitea, or anything non-GitHub
  for a GitHub row). It is `unknown` when the origin cannot be compared, such
  as SSH, unreadable, or a GitHub origin without its summary. Both block the
  clone, with their own explanation. A Gitea row now gets "työtilana" and
  "Avaa työtila" like a GitHub one, and opening writes nothing. "Omat" for
  Gitea follows `owned`. Two accounts of one server show `host (user)`.
  Archived repositories say so. Failed and incomplete sources say why.
  `data-workspace` on rows and `data-state` on the details are the stable test
  hooks.
- **Synthetic host**: the fake Gitea reports real owner ids and Gitea-style
  next links. The browser host's snapshots, including the controller fixture
  snapshot, match origins against its Gitea adapter.

## Validation

All Go runs used `umask 077` and a TMPDIR under `/var/tmp`, with synthetic
homes, tokens and loopback TLS Giteas running real `git http-backend`.

- `TestReposBoundsAndPageConsistency` covers 25 scripted-server cases: small
  pages with links, no headers, the result, page and byte bounds, a timeout
  mid-list, a later 502 or HTML page, a link back, to another host, outside
  the base path and with userinfo, a repeated id, a changing total, an empty
  page before the total, an empty page that links further, an empty first page
  that counts a repository, a total only on the empty page, a null page, 401
  and 403 on the first and on a later page, a later redirect, and a login page.
- `TestMatchOriginNamesOnlyTheExactRepository` and
  `TestGiteaOriginMatchIsPerServer` cover the matching rules.
  `TestWorkspaceRemoteNativeObservation` now also shows that the origin is
  the one after the person's `insteadOf` rewrite.
- `TestGiteaCommonCatalogKeepsSourcesApart` uses two servers with the same
  `ada/notes` and id, and two accounts on one server. It covers per-source
  `owned` and an organisation owner. After a clone it covers the snapshot's
  `gitea_origin` for the clone, a differently named directory with the same
  origin, and a same-named directory from the other server. SSH and userinfo
  origins are unmatched, no address or token appears in the snapshot, and the
  clone's account is unchanged. It also covers a hand-swapped token
  (`account_mismatch`), a token revoked at Gitea (`token_rejected`) beside a
  healthy source, and an origin that still matches after rotation. Two
  mutations (no bases in the snapshot; no account check) failed it.
- The whole `./internal/daemon` package passed, as did `./internal/nativegitea/...`,
  `./internal/daemon/integrations`, `./internal/gateway` and `./test/browser-host`.
- Contracts: `validate-contracts.py`, `go generate ./internal/contracts`,
  `check-generated.sh`.
- Web: `test-focused.sh --area web` passed (115 files, 734 tests), as did
  typecheck and lint. `workspaceMatch.test.ts` and the two new
  `NewWorkspacePage.test.tsx` cases fail when matching ignores the base.
- Browser (Fleetrepo-routed runner): `clone-page.spec.ts` 9/9 plus the opt-in
  visual skip. The Gitea lab walk now also proves that after the clone the
  Gitea row is `same` and its details offer opening. That assertion first
  failed and revealed that the fixture controller's snapshot lacked the
  adapter. `integrations.spec.ts` passed 7/7 and
  `github-first-onboarding.spec.ts` 5/5.
- Review: `/llm-review` used claude-fable-5-1 as finder (clean) and
  gpt-6-astra for one focused false-negative question, followed by
  `/assess-findings`. One must-fix finding was confirmed: an empty first page
  with a positive total, a total only on the terminal empty page, or a `null`
  body ended the list as complete. It was fixed in `fix(gitea): review
  findings…`. Two candidates were dropped. Rule 1b dropped one: an origin
  defined only through an external `[include]` file escapes the snapshot's git
  watch cache. That is a pre-existing gap shared with `github_repo`, and its
  only effect is a stale "työtilana" whose action opens the existing
  directory. Rule 1a dropped the other, which was incorrect: Gitea's
  unit-access filter is on `/users/{u}/repos`, not `/user/repos`. The
  verifier found no path for a PAT to another destination, a reply or a log.
- Full gate (`ci-local.sh --clean --json`) on `e3dd387b` passed clean in one run: web checks, Storybook, Go/contracts, packaging, the ordinary browser suite (370 passed, 3 skipped) and the lab suite (131). Receipt written for tree `5b018e23`.

Not run or not proven: no real Gitea, real tea, distinct kernel UIDs or
installed release.

## Decisions for later review

- **Aggregation stays in the browser.** GitHub's catalog and the Gitea sources
  are separate replies, so a Gitea timeout cannot touch GitHub's list. A daemon
  aggregate would have meant a new contract for no new guarantee.
- **"Omat" versus the rest.** Gitea does not say within `read:repository`
  whether an owner is an organisation or a person, because `/user/orgs`
  needs `read:organization`. So Gitea sections are "Omat" (owner id is the
  account's) or "Yhteistyö". The alternative, asking for a wider PAT scope,
  changes the approved read-only first scope.
- **A mid-list rejection fails the source.** A 401 or 403 on any page (a PAT
  rotated or revoked while listing) makes the source `token_rejected` or
  `insufficient_scope` instead of a partial list. Redirect, TLS and destination
  refusals do the same. Timeouts and 5xx keep what was read as `interrupted`.
- **Account check before listing.** A source whose token authenticates
  another account than tea's entry is `account_mismatch` with no repositories.
  It costs one `/user` read per source per list.
- **Origins are matched per server, never per account.** Two accounts of one
  Gitea both see the clone as their repository's workspace. Which account the
  clone uses stays in its own `credential.<origin>.username`, and opening never
  changes it. The repository's Gitea id is not compared. A renamed repository
  whose clone's origin still names the old name is therefore not "työtilana"
  under its new name, and its new name's directory is free to clone into.
  Gitea redirects old names, but proving that would need a network read per
  workspace.
- **The origin is Git's effective one.** `git remote get-url` reflects the
  person's `insteadOf` rules, so a rewritten remote matches where it actually
  fetches from. Clone and fetch already refuse rewritten Gitea remotes.
- **Bases come from every tea login with a valid URL**, including entries the
  connector cannot use (OAuth, ambiguous). A base names a server the person
  connected, not a credential.
- **GitHub matching also moved to origin anywhere.** A GitHub repository
  cloned under another directory name is now "työtilana". A same-named
  directory whose origin cannot be read is `unknown` instead of `taken`; both
  block the clone.
- **No source-qualified exact Gitea lookup.** A typed owner/name still looks
  up GitHub only, and the Gitea route (`?gitea=<connection>/<id>`) resolves
  from that connection's loaded list. A repository missing from an
  `incomplete` list cannot be selected by URL until the list reads it. A
  Gitea lookup by id would need a new route and query shape. The source
  filter control remains unbuilt, as specified.
- **Two accounts of one server** are labelled `host (user)` on rows. A single
  account per server keeps the plain host.
- **KOKEILTAVAA**: one line for the GitHub side, which is visible on the test
  server now. Gitea stays hidden there until an installation ships tea.
