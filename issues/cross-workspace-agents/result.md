# Cross-workspace agents — result

Implementation uses native creator-session attribution instead of requiring the
child's source repository to match its parent's cwd. The daemon's spinoff read,
process enrichment and working count, and Pi's restart catch-up all use that
same rule. Workspace/worktree placement still follows Git's registry and the
run's native worktree path. No agent CLI, registry or new authority was added.

The browser journey uses a synthetic Taskfleet-shaped creation receipt and a
real Git-linked checkout in B, through production handlers without response
interception. The native Pi restart test uses the pinned Pi/process extension,
a sibling file and a synthetic native Taskfleet wait. These are synthetic
same-UID evidence, not live Taskfleet creation or distinct-UID isolation proof.

Focused self-review is proportionate: this changes attribution within one Unix
user's already-readable native inventory, not the Unix-user boundary, gateway,
broker, peer checks, transcript confinement or installation. Another session's,
nested, caller-owned and malformed runs remain excluded. Removed checkout test
previously rejected an attributed sibling worktree; that expectation is now
intentionally obsolete. The attribution table still rejects relative source
paths; working-count/catch-up cases cover own and sibling sources.

Lab before/after captures are deferred: this host's policy routes maintained
checks remotely and does not permit a local specialist lab/capture run. No live
host was touched. No Fleetrepo installation change is needed.

Validation (remote ARM64 runner, synthetic data; no clean-gate receipt):

- `./scripts/test-focused.sh --area contracts`: passed, job
  `822c5b435c088a4128d6aa351884045bdc519df0290412bebb1fe83195f26375`.
- `./scripts/test-focused.sh --area browser --spec cross-workspace-agents.spec.ts`:
  passed including Axe, job
  `b969de5eb39511b07141455261f0338a705fdada90bdd2edefcf662c3a5e9a6a`.
- `./scripts/test-focused.sh --area browser --spec spinoffs.spec.ts`:
  all four passed including existing accessibility cases, job
  `f7529bbf89e5e58a8fda74704d91febfb7d57c98483140dc6abfa72313e6956b`.
- `./scripts/test-focused.sh --area web`: format/lint/types and unit/component
  checks passed, including the final run after correcting the new test's host
  origin (`792a55bff053e13eb02e472c7e2ce772499160258a509cb6e9427104fc4d4a32`).
- Direct dependency-free `node --test internal/daemon/pi-device-test/catch-up.test.mjs`:
  five passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  final job `37b5c5602a564cc9b1af2e3acdfbfc575fbd1a1192b45186d3b15a11d86e722d`
  ran `go vet` and the race-enabled package suite after the runner installed the
  pinned Pi fixture with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`.
  All affected tests passed, including the native sibling read, restart catch-up,
  rearmed completion wake, host guidance and the five catch-up logic cases.
  The package command exited nonzero **only** for
  `TestTerminalNewShellFindsInstalledToolWithOldServerPath`: TempDir cleanup
  `directory not empty`. The same command on unchanged main (below) failed in
  the identical test with the identical cleanup error. This is the task brief's
  pre-existing-failure exception, not a claim that the whole package passed.
  Captured source: base `fae07aecfa626e3729f8ea41995514c6ce66fd46`, dirty tree
  identified in the job's source metadata; only issue/result prose changed
  after this final runnable-source capture.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check`: passed.

Failed/superseded attempts: the first daemon run hit an archive-test shared-map
race, recorded as unlaned intake @mildly-itchy-top. The same required daemon
command on an unchanged disposable copy of main
`fae07aecfa626e3729f8ea41995514c6ce66fd46` instead hit the known
`TestTerminalNewShellFindsInstalledToolWithOldServerPath` TempDir cleanup flake
(job `4bbcec2fff87f9e9de85ad03397a0984a3b909e573f0bb6afb7a612fdac3398e`).
The first new browser attempt used Vite's base URL instead of the synthetic
host; corrected to `hostOrigin`. One queued browser attempt with the old setup
was deliberately cancelled. A newly wired catch-up unit test initially placed
its expected cross-repo result outside the existing newest-20 read budget;
its creation timestamp now puts it inside that budget. That standalone test
passes. One queued Go attempt using the stale fixture was deliberately cancelled.
A transient `git diff --check` trailing-blank-line error in this result prose was corrected and the check rerun. No failed attempt is claimed as passing evidence.
