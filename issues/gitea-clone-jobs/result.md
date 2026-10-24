# Result

A Gitea clone and the later workspace fetch now go only to the address the
daemon validated, with the transfer policy the connection needs, whatever the
person's Git configuration says. An interrupted Gitea clone is handled like
GitHub's: it is recognised after a daemon restart, never touched by itself,
and restarted or removed only when the person asks. Everything stays inside
the existing CloneJobs and fetch handler. No new job system, store, unit,
socket or runtime dependency was added.

## What changed

- **Transfer policy** (`internal/daemon/gitea_transfer_linux.go`). Clone and
  managed fetch use the same command-line pins: HTTPS only, verified TLS, no
  redirects, no saved cookies, no personal `curloptResolve` (global or
  exact-remote), and no submodule recursion. The helper chain is reset to the
  registered helper alone (base scope for the clone, server scope for the
  fetch), so no personal helper, even one added in the registration's own
  scope, is handed the token to store.
- **Rewrite refusal before transfer.** After the destination is reserved and
  before Git runs, the clone reads the rewrite rules the new repository will
  see. `ls-remote --get-url` and `git config` run with `--git-dir` at the
  future gitdir and `-c remote.origin.url=…`, which evaluates `gitdir:` and
  `hasconfig:remote.*.url:` includes as the clone will. Any `insteadOf` or
  `pushInsteadOf` whose value prefixes the address refuses the start with
  `remote_rewritten`; the reserved directory is removed again and Git never
  contacts the server. Rules only the finished repository can show
  (`onbranch:`, or a `gitdir:`-only push rule) fail the clone's verification,
  and the download is kept.
- **Managed fetch** (`workspace_git_fetch_linux.go`). A remote is managed
  when its configured or effective address is on the host:port of any tea
  login. It must have exactly one address, equal to the effective one, with
  no rewrite rule applying (`remote_rewritten` otherwise, before any
  request). It then runs with the pins. Other remotes, rewritten or not, keep
  the person's configuration.
- **Interrupted Gitea clones** (`github_interrupted_linux.go`,
  `github_jobs_linux.go`). Recognised from the filesystem alone: only `.git`,
  no refs or index, origin `https://<base>/<owner>/<name>.git`, and exactly
  one `credential.<origin>.username`, which the clone job writes before any
  transfer. Real Git then confirms the same origin and account. The list
  names the connection only when exactly one usable login matches.
  `restart` (connection + repository id, full) resolves the repository again
  and replaces only an unfinished download of exactly that address. `remove`
  (owner/name) needs no connection. A directory that holds less (empty, no
  origin yet, no account yet, a file beside `.git`) stays an existing
  destination: never recognised, removed or given an owner.
- **Contract** (`github-clone.schema.json`): a Gitea `restart`, a Gitea
  `remove` by owner/name, and an interrupted item with an optional Gitea
  `source` (and `connection_id`). Examples and negative cases were added in
  `validate-contracts.py`.
- **Web**: an interrupted Gitea card always offers remove, and offers restart
  (full only) while that connection's list holds the repository. Its own
  progress and refusal show on it. `remote_rewritten` is explained on start
  and fetch.
- **Synthetic Gitea**: a cross-host `clone_url`, redirects of authenticated
  Git requests, and a request log. The browser host can leave an interrupted
  Gitea clone (`/fixture/checkout?mode=gitea-interrupted`).

## Validation

All runs used `umask 077` and a TMPDIR under `/var/tmp`, with synthetic homes,
tokens and a loopback TLS Gitea running real `git http-backend`.

- New Go tests with real Git and the native helper
  (`gitea_clone_jobs_linux_test.go`):
  - `TestGiteaCloneJobOutlivesItsStream`
  - `TestGiteaCloneInterruptedAfterRestartAndExplicitActions` covers daemon
    stop mid-transfer, the list with its connection, no workspace, nothing
    restarted by itself, and wrong-target actions refused. It also covers
    restart → confirmed, and remove after disconnect.
  - `TestGiteaAmbiguousLeftoverStaysAConflict`
  - `TestGiteaCloneJobVerificationFailureKeepsTheDownload`: the `onbranch:`
    rewrite and the `gitdir:` push rewrite.
  - `TestGiteaCloneRefusalsAndCancel` covers quota, a case-insensitive name,
    a symlink in `~/src`, a linked `~/src`, and a cross-host `clone_url`. It
    also covers global, self, push, `gitdir:` and `hasconfig:` rewrites, each
    with no Git request and no directory left, then cancel and disconnect.
  - `TestGiteaTransfersRefuseRedirects`: the person's exact-remote
    `followRedirects=true`; the target never sees a request.
  - `TestGiteaFetchIsPinnedToItsRemote` covers a storing helper inside
    `~/src`, a foreign registration, five rewrite and extra-address forms,
    no fallback to bob's store or account after ada's disconnect, and an
    ordinary rewritten remote still fetching.
  - `TestGiteaHelperAnswersInEveryNativeEnvironment` covers
    cloneProgressCommand, nativeCommandInput, Pi's env (`agentPath`, `HOME`,
    no XDG) and `terminalHost.env`. None carries `SSH_AUTH_SOCK` or a token
    even when the test process has them.

  The slice's walk test now keeps its storing include through the fetches.
  Mutations (fetch pins removed, helper pin removed, clone effective-URL
  check removed, rule listing removed, URL-equality removed, rule prefix
  check removed, post-clone recheck removed) each fail a test.
- Go packages `./internal/nativegitea/...`, `./internal/daemon/...`,
  `./internal/cli` and `./test/browser-host` passed.
- Contracts: `test-focused.sh --area contracts` passed (generation clean,
  71 schemas, new negative cases).
- Web: `test-focused.sh --area web` passed (114 files, 729 tests).
- Browser (Fleetrepo-routed runner): `clone-page.spec.ts` 9/9 plus the opt-in
  visual skip, including the new interrupted-Gitea case.
  `github-first-onboarding.spec.ts` passed 5/5.
- Review: independent `/llm-review` (gpt-6-astra finder, claude-fable-5-1
  verifier), then `/assess-findings`. Four findings, all confirmed and fixed
  in `fix(gitea): review findings…`:
  - the fetch helper chain was unpinned under a foreign registration;
  - a URL-scoped `curloptResolve` survived the reset;
  - a `gitdir:`-only `pushInsteadOf` passed admission;
  - the restart card used the wrong UI key.

  The third was rule-derived DROP 1b and kept because this issue requires
  refusing push rewrites.
- Full gate (`ci-local.sh --clean --json`) on `16d39c1d`, run twice. Web
  checks, Storybook, Go/contracts and packaging passed both times, and the
  ordinary browser suite passed 370/370 on the second run. Both times the
  Fleetrepo `npx` dispatcher refused the browser step it routes to Cedar
  ("Fresh Cedar pressure/inference admission required; no fallback"): the
  ordinary and lab suites on the first run, the lab suite on the second. No
  receipt was written. The lab suite, run alone right after, passed 131/131.
  Every part has passed on this tree, but not within one gate run.

Not run or not proven: no real Gitea, real tea, distinct kernel UIDs or
installed release. A mount crossing under `~/src` cannot be created
unprivileged; reservation and removal are the shared GitHub code (device
checks in `walkRemove`), proven in the VM tests rather than here.

## Decisions for later review

- **Any rewrite rule that prefixes the Gitea address refuses**, including one
  that rewrites it to itself and `pushInsteadOf` (the browser never pushes).
  The alternative, comparing only the effective fetch URL, would let a push
  rewrite or a no-op rule through silently. Refusing is the conservative
  reading of "refuse alternate authenticated endpoints".
- **A remote is managed by server, not by exact base**: any tea login on the
  same host:port makes a remote's fetch pinned. The helper matches by host
  and port too, so this is where a token could be handed out. After the last
  login on that server is disconnected, the clone is an ordinary remote again
  and the person's own helpers apply.
- **The fetch always pins our helper for a managed remote**, even when the
  person's registration is foreign or absent. The other choice, respecting a
  foreign registration, let a personal storing helper receive the PAT
  (review finding 1).
- **Rules visible only in the finished repository** (`onbranch:`, a
  `gitdir:`-only push rule) fail verification after the transfer instead of
  refusing before it. Seeing them earlier would need an initialised
  repository before `git clone`. The transfer itself still went only to the
  validated address, and the helper still matches the exact host.
- **The interrupted list names a connection only while exactly one usable
  login** has the recorded base and account. Restart needs that connection
  and the repository's id from its list. Remove needs only the owner/name the
  origin records, so a clone of a removed connection can still be cleaned
  up.
- **Recognition requires the clone job's own `credential.<origin>.username`.**
  A person's manual clone of a Gitea repository that was interrupted is not
  recognised and stays an ordinary directory.
- **No KOKEILTAVAA line**: Gitea is offered only where the installation
  ships tea, and no production profile does yet (slice decision), so nothing
  changes on the test server.
