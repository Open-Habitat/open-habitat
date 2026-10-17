# Result

The host side of the Kloonaussivulla flow is in place, and the existing dialog
and onboarding run on it. The decision is recorded in
[ADR 0024](../../docs/decisions/adr-0024-clone-jobs.md), which replaces the
completion rules of ADR 0005; [Workspaces](../../docs/architecture/workspaces.md)
and [HTTP API](../../docs/architecture/http-api.md) describe the result.

## What changed

- **Whole catalog.** `GET /api/v1/onboarding/github/repos` takes no query. The
  daemon reads `/user/repos` (owner, collaborator, organisation member) with
  `sort=pushed`, up to 10 pages of 100, and returns the whole list newest push
  first with `size_kib`, `default_branch` and `owner_type`, plus `complete`
  (false when the bound was reached). A push during the read that moves a
  repository between pages is de-duplicated; a bot-owned repository is
  skipped; control characters in a description are replaced instead of
  failing the whole read.
- **Exact lookup.** `GET /api/v1/onboarding/github/repository?full_name=` runs
  `gh api --include /repos/<owner>/<repo>` as the user after the usual `/user`
  binding check. GitHub's 404 (and 403/451) is `not_found`; any other status or
  failure is an error, never `not_found`.
- **Clone jobs.** `GET`/`POST /api/v1/onboarding/github/clones` and
  `GET …/clones/events?job_id=` replace `POST …/clone` and `…/clone/stream`. The
  daemon admits a start as before (bound identity, GitHub facts, quota, absent
  destination, case-insensitive), reserves the directory and hands the writer
  lock, descriptors and `git` process to a job whose lifetime is the daemon's,
  bounded to 45 minutes. Subscriptions start with the job's current state and
  are coalesced to one frame a second; closing one changes nothing. One job
  runs at a time; a second start is `clone_running`. The last 16 jobs are kept
  in memory; `dismiss` forgets a finished one.
- **Light clone** is `mode: "blobless"` (`--filter=blob:none`) on start or
  restart; `full` is what the dialog sends.
- **Cleanup.** Cancel, native failure, deadline and verification failure remove
  the directory the job reserved, by descriptor, only while the name still
  refers to that inode, never following symlinks or crossing filesystems. The
  terminal frame and job say `leftover: removed|kept`.
- **Interrupted clones.** A daemon stopping mid-clone keeps the directory
  (`daemon_stopping`, `kept`). It is recognised from the filesystem alone:
  nothing but `.git`, HEAD naming a branch, no index, no ref (loose or packed,
  no reftable), exactly one origin `https://github.com/<owner>/<name>.git`. That
  cheap reading hides it (and a running clone) from workspace discovery. Before
  anything is reported or acted on, Git must agree (`rev-parse` exit 1,
  `for-each-ref` empty, canonical origin) and no process of the user may be
  inside it. `observe` reports `interrupted` with `size_bytes`, and `cloning`
  while this daemon's job writes the name. The clones list carries
  `interrupted[]` with sizes. Only `restart` (remove, then start, full or
  light) and `remove` act on it.
- **Free quota** for the details pane is the existing
  `GET /api/v1/account/storage` (`web/src/app/storageQuota.ts`); no new host
  read was needed.
- **Browser.** `github.ts` validates the new schemas and adds `lookup`,
  `cloneJobs`, `startClone`, `subscribeClone` and `observeSettled`.
  `cloneStream` now starts a job and follows it, resubscribing when a stream
  ends without a result. The dialog, onboarding and the workspace import keep
  their behaviour. The dialog's "keep the window open" sentence was removed
  because it is no longer true, and the dialog gained one explicit
  **Aloita alusta** when its clone finds an interrupted leftover, because
  daemon restarts on the test server (each deploy) would otherwise leave a
  hidden directory that blocks the name with no way out from the browser.

## Evidence

- `go test ./internal/daemon` and `./internal/gateway` (focused script, Go
  1.27.1, `umask 077`, `/var/tmp` TMPDIR) pass. New host-backed cases run the
  real `/usr/bin/git` against a local bare repository through the real HTTP
  handlers:
  `TestCloneJobOutlivesItsStream` (the stream is dropped mid-receive, the job
  completes, a resubscription starts at sequence 1 and sees `confirmed`;
  observe says `cloning`, discovery hides it; light clone passes the filter),
  `TestCloneJobCancelAndFailureCleanUp` (cancel and an early-EOF failure both
  remove the directory, a second start while running is `clone_running`, the
  retry succeeds),
  `TestCloneInterruptedAfterRestartAndExplicitActions` (the daemon stops
  mid-clone, a new daemon reports the leftover as interrupted with its size,
  hides it, restarts nothing by itself, refuses a plain start, and then
  `remove` and `restart` each work), and
  `TestCloneRemoveRefusesAnythingButAnInterruptedClone` (a checkout with an
  uncommitted file, a symlink and path-shaped bodies are refused and nothing
  is touched). `TestRepoCatalogReadsBeyondFirstPage` covers an organisation
  repository on page 2; `TestRepoLookupExactName` and the subprocess case in
  `TestRepoCatalogSyntheticGHProcess` cover `raine/workmux` found, not found
  (gh exiting 1 with the included 404) and failures. The gateway integration
  test starts a job for each of two identities through the real gateway and
  daemon handlers.
- `./scripts/test-repo-catalog-uids.sh` (three kernel UIDs in a rootless
  container) passes with the job API: a forged identity header reaches only its
  socket's daemon, which knows no such job.
- `--area contracts` passes (validator with new fixtures and negative cases;
  generated packages regenerated).
- `--area web` passes. Browser specs pass: github-first-onboarding,
  github-denied, github-session, github-slow, github-observation,
  onboarding-notices, home-workspace-sections (including the new interrupted
  restart case through the dialog) and lab-onboarding.

Limits: no live GitHub was called; `gh api --include` output on a 404 was
reproduced from gh's documented behaviour, not observed against github.com.
The browser fixture's `git` is synthetic. A real multi-gigabyte clone and a
real systemd stop were not exercised; the daemon-stop case cancels the jobs'
context in-process.

## Decisions for later review

- **Routes.** One `POST /clones` with `action` (start, restart, remove, cancel,
  dismiss), like `POST /api/v1/workspaces`, rather than one route per action;
  `GET /clones/events?job_id=` for subscriptions. The old `POST …/clone` and
  `…/clone/stream` were removed rather than kept beside the jobs.
- **One job at a time**, under the existing `cloneWriter` lock, as before. The
  prototype's page lists several clones, but only one runs; parallel clones
  would also let workspace create/delete race a running clone.
- **No automatic retry and no cleanup on daemon stop.** A stopping daemon keeps
  the directory so that the person sees it as interrupted, as in the
  prototype's 910 MiB case. Cancel, failure, deadline and verification failure
  clean up.
- **Interrupted rule tightened** beyond the issue text: besides `.git`, origin
  and no HEAD commit, the directory must hold nothing but `.git`, have no
  index and no ref at all. Without that, an orphan branch or a repository whose
  HEAD branch is unborn but which has other branches and work would be
  removable. Consequence: a shell-made `git init` with only a matching GitHub
  origin is treated as an interrupted clone; a browser-created workspace has
  `.agent-host/` and is never affected. `workspace_remote_linux_test.go` got a
  file in its fixture for this reason. An empty GitHub repository clones into
  the same shape and so never confirms (as before) and shows as interrupted.
- **Hidden in discovery by the cheap reading only** (no process scan or Git
  call per snapshot). A running clone disappears from the workspace list only
  until checkout starts writing files.
- **Lookup not-found** covers GitHub's 404, 403 and 451, which all mean "not
  reachable for this user"; GitHub does not distinguish private from missing.
- **Catalog bound** 10 × 100 with `complete: false`, and a 2 MiB reply bound at
  gateway and browser. Descriptions are cleaned rather than rejected so one
  odd repository cannot empty a thousand-repository catalog.
- **Observe while another writer runs** stays `unavailable`, except
  `cloning` for the running job's own name.
- **Frame pacing.** At most one progress frame a second per subscription,
  heartbeat every 20 s, and a subscription ends without a terminal after 2048
  frames so the 4096-frame and 512 KiB bounds are never reached; the browser
  resubscribes.
- **Dialog Aloita alusta** added (see above) although the page is a later
  issue; the page will replace it.
