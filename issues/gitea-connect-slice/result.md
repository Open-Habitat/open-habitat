# Result

The first Gitea slice works end to end on synthetic HTTPS with real Git. A
person types an address and a personal access token into the approved form.
Their daemon validates the token at `/user` and writes it only into tea's own
file, then registers the secretless Git helper. The connection's repositories
appear in the existing Uusi työtila list beside GitHub's, a selected private
repository is cloned by the existing clone jobs into `~/src`, and the
workspace's ordinary fetch is answered by the same tea entry. GitHub
onboarding, `gh` and Pi readiness are untouched.

## What exists

- **Contracts** (`contracts/v1/`): `integrations.schema.json` gains the
  `gitea` provider (`personal_token`, service `git`, missing tool `tea`) and an
  optional `gitea` section. That section lists tea's logins read from its file
  alone, each with a daemon-derived id, kind, owned/ambiguous flags and a `git`
  readiness observed from Git's configuration. `gitea-connection.schema.json` is
  the request (`connect`/`replace` carry the token; `check`/`repair`/`disconnect`
  name a connection id). `gitea-connection-change.schema.json` is the reply.
  It never carries a token, and `api` (the `/user` answer) is kept apart from
  `connection.git`. `gitea-repos.schema.json` gives one source per connection,
  with its own state, failure and completeness. `github-clone.schema.json` adds
  the Gitea start (`source`, `connection_id`, `repository_id`, full only) and a
  job's `source`.
- **Daemon** (`internal/daemon/integrations/gitea_linux.go`): one
  `GiteaAdapter` with one `nativegitea.Store`, shared by the integrations routes
  and CloneJobs. A clone holds the login with `Store.Hold`, so disconnect
  answers `clone_running` until the job settles. Connect, replace, check, repair
  and disconnect take a non-blocking write lock. A lost or 5xx reply is
  uncertain: the page rereads the list and never resends. Disconnect removes the
  helper registration only when no other login on that base remains.
- **Native reads** (`internal/nativegitea/repos.go`): `/repositories/{id}` and
  `/user/repos`. The list pages until an empty page within page, result, byte
  and time bounds; a shortened page does not end it. A repository whose
  `clone_url` is not exactly the expected path under the connected base is
  dropped, and the list then says it is incomplete. Addresses are derived from
  the base, never taken from the server's URL fields. `Store.Token` reads a PAT
  for the fixed reads only.
- **Clone jobs** (`gitea_clone_linux.go`, `github_jobs_linux.go`): admission
  is split into provider resolution plus the shared reservation. A Gitea start
  rereads the connection and the repository by id with that connection's token.
  It refuses an empty repository before reserving anything and requires the
  helper to be registered. The clone runs with HTTPS only, the base's helper
  chain pinned at the command line, and verified TLS and no redirects pinned to
  the exact remote. The clone's own configuration names the account
  (`credential.<remote>.username`), so later fetches select it with no mapping
  of ours.
- **Gateway** (`internal/gateway/integrations_linux.go`, `proxy_linux.go`):
  two exact routes, session, CSRF and Origin on writes, a 4 KiB request body,
  and replies capped at 64 KiB (change) and 4 MiB (repos). The body is never
  parsed or logged, and the gateway never contacts Gitea.
- **Web**: `GiteaConnection.tsx` holds the approved form ("Yläreunassa"). The
  error sits under the title, outside the scrolling body, and takes focus; the
  field gets `aria-invalid`. `https://` is added only on blur or submit, and a
  host:port is not read as a scheme. Inputs have no ligatures. The form also
  carries the agent-access note and the token help. Fields are kept on a
  refusal and the token is dropped once a write answers otherwise. Connection
  cards offer check, replace, Git repair and disconnect, with a disconnect
  confirmation that says the token is not revoked at Gitea. `NewWorkspacePage`
  merges each Gitea source into the same list and search. Rows and owner
  sections show the server, the route is `?gitea=<connection>/<id>`, and failed
  or incomplete sources are noted separately. Writes go through `mutations.ts`
  (`integrations.gitea`, `github.clone`), replies are validated against the
  schemas, and a reply after a session change is dropped.
- **Synthetic host**: `internal/nativegitea/giteafake` is a TLS Gitea on
  loopback with real `git http-backend`. The browser host runs it, trusts its
  certificate per synthetic home and acts as the registered helper by
  dispatching to the real `cli.Run`. `/fixture/gitea` enables it, adds an
  upstream commit and names the synthetic token.

## Validation

All runs used `umask 077` and `TMPDIR` under `/var/tmp`.

- Go: `./internal/nativegitea/...`, `./internal/daemon/integrations`,
  `./internal/gateway`, `./internal/cli`, `./test/browser-host` passed.
  `TestGiteaConnectListCloneFetch` is the walking path with real Git and the
  helper. It covers refusals that write nothing, https inference, two accounts
  on one base, the token only in tea's file, separate repository lists, an
  empty-repository refusal, another account's repository id, disconnect refused
  during a held clone, and the clone's remote, account and HTTP policy. It also
  covers no `.git-credentials` despite a storing conditional include, a
  same-name conflict, a fetch of an upstream commit authenticated as the right
  user, rotation (`check` says `token_rejected`, fetch fails, a cross-account
  replacement is refused byte-for-byte, the replacement fetches), disconnect
  without falling back to the other account, and helper removal after the
  base's last account. `TestGiteaReposSourcesFailIndependently` covers one
  failing source beside a healthy one and an unsafe tea file being unavailable,
  never empty. `TestGatewayGiteaRoutesBoundAndRouteToTheSessionsDaemon` covers
  401/403, a previous session's CSRF refused on the next session, framing, body
  and reply caps, routing to each session's own socket, and no token in logs.
  Two mutations (wrong account username; no helper-chain pin) failed the walk
  test as intended.
- Whole `./internal/daemon` package: everything passed except
  `TestAgentConversationControls` once under load (`control_uncertain`). It
  passed 5/5 in isolation and is untouched by this change.
- Contracts: `validate-contracts.py` (new examples and negative cases: token in
  a reply, userinfo in a base, a check with a token, a failed source with
  repositories, a blobless Gitea start) and `check-generated.sh` passed.
- Web: `test-focused.sh --area web` passed (113 files, 721 tests).
- Browser (documented runner): `integrations.spec.ts` 7/7, including the Gitea
  form at 390×568 with help open. The error box is measured inside the viewport
  and above the scrolled body, with focus, field preservation, ligatures,
  check, Bob not seeing Alice's connection, and disconnect. `clone-page.spec.ts`
  8/8 plus the opt-in visual skip, including the lab walking path: connect →
  two `fixture/first` rows by source → empty repository disabled → clone of a
  private Gitea repository → open the workspace → upstream commit → fetch →
  `data-upstream-behind=1`.
- Review: independent `/llm-review` (gpt-6-astra finder, claude-fable-5-1
  verifier), then `/assess-findings`. 4 FIX were applied in `fix(gitea): review
  findings…` and 1 was dropped (rule 1b). The verifier found no path for the
  PAT into a log, reply, argv, another file or another host beyond the fixed
  conditional-include case.
- Whole browser suite (`npm run test:browser`) found two failures this change
  caused: Ajv format warnings in the console, and the site-onboarding spec
  walking every provider. Both were fixed and their specs pass.
- Full gate (`ci-local.sh --clean`) ran once on `4aefccfd`: web
  checks, Storybook, Go/contracts, packaging and the ordinary browser suite
  (371) passed. The lab suite had 130/131; `lab-conversation.spec.ts` "slow turn
  explains work and stops in one calm step" failed once and passed alone, an
  untouched conversation spec. No receipt was written.

Not run or not proven: no real Gitea, real tea binary, distinct kernel UIDs or
installed release (§6). The same-UID browser host proves routing and the
contract, not Unix isolation.

## Decisions for later review

- **Gitea is offered only where the installation ships tea.** Availability is
  `tools["tea"]` in the integrations file, the same rule as the other tools.
  Production profiles do not ship tea yet, so the tile is hidden and the routes
  answer `provider_unavailable`. Nothing changes on the test server until
  runtime qualification adds tea, so there is no KOKEILTAVAA line. The
  alternative was a tile that says "not available on this server", which looked
  like a dead feature. Disconnect stays possible without tea.
- **Helper path** is the daemon's `os.Executable()`, which resolves to the
  release-specific binary. Upgrade stability belongs to runtime qualification
  (§6) and is a precondition of publishing.
- **Repository list aggregation happens in the browser** (GitHub's catalog plus
  each Gitea source), not in a daemon aggregate. Sources fail independently on
  either side; a daemon aggregate remains the common-catalog unit's choice.
- **"Already a workspace" for Gitea** is proven only by a confirmed job of that
  repository. Otherwise a same-name directory is "taken", the conservative
  reading until origin matching (common catalog).
- **Gitea owner sections are "Omat" or "Yhteistyö"**: the API gives no owner
  type here, and organisations are left to the common catalog.
- **Interrupted Gitea clones** are not recognised (the recogniser is
  github.com-only). A leftover directory stays an ordinary directory and a new
  start refuses it as existing. Restart and remove belong to clone hardening.
- **The token is kept in the form after a refusal** (the approved round
  preserves fields) and dropped as soon as a write succeeds or is uncertain, or
  the dialog closes.
- **Disconnect accepts any PAT entry**, owned or external, as an explicit
  target. OAuth, SSH, insecure and invalid entries are shown without actions.
- **Residual for clone hardening**: the daemon's later workspace fetch is not
  pinned against personal helper or HTTP overrides as the clone is, and
  `insteadOf` rewrites are not refused before transfer. The helper's exact
  host:port match keeps the token on its host meanwhile.
