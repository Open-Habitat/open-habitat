# Result

Implemented in the tree based on `cf7f0846`, committed with this result.

The host and fake Pi now watch their owner process identity (PID plus start time,
including zombie detection) and the worktree directory inode every 200 ms.
Owner loss or worktree removal sends TERM, with KILL after two seconds if normal
shutdown is stuck. The fake Pi watches the host rather than inheriting the
launcher's owner. This complements the controller's existing Pdeathsig/group
handling without changing production daemon code.

Playwright records its worker as owner; the detached lab records the invoking
shell, not the short-lived Python launcher. `host-build.ts` builds the guard
into the shared binary; teardown retains safe cleanup of synthetic homes left
by forced exits. The gate preflight runs `scripts/browser-hosts.py --json` in
report-only mode, and its Go/contracts phase runs the cleanup-tool tests.
`TESTING.md` names both the diagnostic/explicit `--kill` operation and tests.
Cleanup inspects same-UID `.cache/browser-host` executables, includes synthetic
Pi descendants, excludes live owned labs, and uses pidfds plus start-time
revalidation rather than killing a potentially unrelated process group.

## Validation

All required focused checks passed locally on Linux with synthetic data:

- `go test -race -count=1 ./test/browser-host` under `umask 077` and a short
  disk-backed `/var/tmp/oh-XXXX` TMPDIR. Includes worktree rename/replacement
  while the helper ignores TERM, proving the KILL fallback ends it within
  three seconds.
- `python3 scripts/test-browser-hosts.py`: two integration tests pass. A fake
  orphan is reported without being killed, its missing worktree is detected,
  and `--kill` ends it; a live owned process is not killed.
- `./scripts/test-focused.sh --area contracts`: generated output and contract
  validation pass.
- `./scripts/test-web-fast.sh`: formatting, lint, typecheck, unit and component
  suites pass (249 unit tests; full component suite green).
- `OH_PORT_BASE=24600 PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"
  npm run test:browser --prefix web -- tests/host-lifetime.spec.ts
  tests/browser-conversation.spec.ts --grep '@host-lifetime|new controller stays calm'
  --workers=2`: three cases pass, including a normal conversation host lifecycle.
  Each SIGKILL case starts a real host from a child Node launcher, signs in,
  sends through the production conversation controller, observes the actual
  synthetic Pi child, then kills either launcher or host. No live host/Pi
  remains within five seconds. Rerun after the final executable changes passed.
- Bounded Python lab harness with `OH_PORT_BASE=24800`: `lab.sh start` followed
  by `stop` leaves no live host; a detached lab with a live caller is excluded
  from stray reports; SIGKILL of that caller ends the lab within five seconds.
- `bash -n scripts/ci-local.sh scripts/lab.sh` and `git diff --check` pass.
- Focused self-review checked parent-death startup races, fake-Pi ownership,
  directory replacement, PID reuse and same-UID cleanup targeting. No outstanding
  defect identified in the changed behavior.

The full clean gate was deliberately not run, per the worker brief. Shared
remote execution and the live test server were not exercised; the lifetime
logic is inside the binary and launcher ownership rather than a local runner.
No production process/session authority changed. No push or deployment.

## Failed attempts and limits

- The first two cleanup-tool test attempts used copied `/bin/sleep`; Alder's
  uutils multicall binary rejects the renamed executable. Replaced the fake
  with a copied Python interpreter; no missing dependency remains.
- The next attempt expected a renamed-but-existing worktree to be reported as
  missing. Linux updates `/proc/<pid>/exe` on rename, so that expectation was
  wrong. The test now unlinks its disposable fake executable and removes its
  exact empty worktree. Both tests then passed, including the final rerun.
- An initial Biome invocation from the repository root rejected nested root
  configuration. Running from `web/` fixed it; the fast-web format check passes.
- Exploratory lookups for nonexistent `conversation*.spec.ts`, `helpers*`,
  `pi-live.spec.ts`, `test/browser-host/*test*`, and `.tools/go/bin/go` found
  nothing. Actual specs and the installed `go` were used; no check was omitted.
- Vite emitted existing PostCSS `from` and large-chunk warnings; builds and all
  selected browser cases passed. No external review was requested or claimed.
- A report-only scan observed two legacy browser-host/Pi processes from another
  worktree (PIDs 1378598 and 1386607). They were not killed: this run does not
  dispose of another worker's processes. Existing binaries must be rebuilt to
  gain the guard; the explicit cleanup tool handles older strays.

## Decisions for later review

- Use a binary-local polling watchdog rather than setting PR_SET_PDEATHSIG on
  the host's Go thread: Linux associates that signal with the creating thread,
  not the lifetime of an arbitrary multithreaded parent. Polling also catches
  missing/replaced worktrees and works after launcher SIGKILL. Existing
  production Pi Pdeathsig/group handling remains unchanged.
- A detached manual lab belongs to the invoking shell. Keeping it permanently
  detached would preserve the reported leak; tying it to `lab.sh` or its Python
  launcher would end it immediately after `start`. This is documented in
  `TESTING.md` and checked with an actual lab start/stop/caller-kill harness.
- Cleanup is report-only by default and restricted to same-UID browser-host
  executables; only explicit `--kill` destroys them. It does not signal broad
  process groups or clean someone else's lab as a gate side effect.
