# Result

## Cause

Most of the `/var/tmp` growth did not come from the scripts' own
directories, which `ci-local.sh` and the release scripts already removed in
traps. It came from their test children. `test-focused.sh` and
`browser-focused.py` forced `TMPDIR=/var/tmp`, which overrode the short
agent-scratch TMPDIR that workers were told to use. `ci-local.sh` passed
`/var/tmp` on to its children in the same way. Every killed browser host,
daemon (`oh-process-*`), Chromium profile or Go test directory then stayed
directly in `/var/tmp`. `finnishScan.test.ts` also left one `finnish-scan-*`
directory on every web run (429 of them).

## Change

- `scripts/scratch.sh` (new, sourced) chooses the scratch root:
  `OH_SCRATCH_ROOT`, else `/var/tmp/agent-scratch` when it exists and is
  writable, else `/var/tmp`. `oh_scratch_dir VAR PREFIX` creates a private
  directory there and holds the root's `.lease` with a shared flock when the
  root has one. `oh_short_scratch_dir` is for Go test runs. Go tests bind
  sockets under `t.TempDir()` with long test names, reaching 85 bytes below
  TMPDIR out of 107 usable, so their TMPDIR may be at most 21 bytes, and
  `/var/tmp/agent-scratch` alone is 22. That variant therefore falls back to
  a short `/var/tmp/ohX.XXXXXX` (19 bytes) that only the EXIT trap removes.
  Measured: with a 31-byte TMPDIR, about 30 daemon, gateway and provision tests
  failed with `bind: invalid argument`.
- `ci-local.sh` and `test-focused.sh` (go/web/contracts) use the short
  variant, while `browser-focused.py` (`ohb.*`) and `browser-stress.sh`
  (`ohs.*`) use agent-scratch, where the browser specs pass. Each creates a
  per-run directory, exports it as TMPDIR for every child, and removes it on
  exit. Bash runs the EXIT trap on TERM as
  well, and `browser-focused.py` turns TERM/HUP into `SystemExit` so that its
  `finally` runs.
- `lab.sh`: the detached lab host gets its own `ohl.*` TMPDIR, recorded in
  `.cache/lab/tmpdir` and removed by the next `stop`/`start`. Before this it
  used a shared, never-cleaned `/var/tmp/open-habitat-build`.
- `build-profile-runtime.sh` work directories, plus the TMPDIR of
  `build-core-runtime.sh`, `runtime-builder-image.sh` and `vm-test.sh`
  (Podman/QEMU), now use the scratch root.
- `inspect-trace.sh` without TMPDIR extracts under the scratch root.
- `finnishScan.test.ts` removes its fixture directory.
- `TESTING.md` has a short "Scratch directories" section, including the Go
  limit. `AGENTS-WORKFLOW.md` now says that Go goes through `test-focused.sh`
  and never gets an agent-scratch TMPDIR. The brief template's
  `TMPDIR=$(mktemp -d /var/tmp/agent-scratch/oh-XXXX)` for Go would fail
  those socket tests with a direct `go test`; until now `test-focused.sh`
  hid the problem by overriding TMPDIR with `/var/tmp`. Its trace and
  integration-profile examples, `web/AGENTS.md` (catalog review output goes to
  `.cache/`) and `private-dev/docs/AGENTS.md` no longer point at a bare
  `/var/tmp`.

Gate receipts and release evidence did not move.

## Evidence

- `python3 scripts/test-test-focused.py` (11 tests). New cases cover the
  browser and Go areas: the private TMPDIR is removed after exit 0, exit 7 and
  SIGTERM sent to the entry script alone (as `timeout` sends it), and nothing
  else is left in the scratch root. The scratch root also rejects a relative
  or missing `OH_SCRATCH_ROOT`, and the lease is held while the directory
  exists (an exclusive `flock -n` fails).
- `python3 scripts/test-inspect-trace.py`, `vitest run
  src/i18n/finnishScan.test.ts`, `biome check`, `bash -n` on every script,
  `validate-project-view.py` (public and private).
- Real runs: `test-focused.sh --area go` (full `go test -race ./internal/...`)
  passes everything except 13 daemon tests. Those fail with
  `ModuleNotFoundError: No module named 'referencing'` (system python3 lacks
  jsonschema; ci-local supplies a venv). Two of them fail the same way with
  `TMPDIR=/var/tmp` and no change of mine, so the failure predates this
  work; it is filed as intake `reasonably-alive-detail`. The run's `/var/tmp/ohf.*`
  was removed;
  `test-focused.sh --area browser --spec host-lifetime.spec.ts` 2/2 and
  `--spec lab-conversation.spec.ts` 15/15 (real controller, fake Pi, bridge
  socket under `oh-process-*`), each leaving no `ohb.*` behind.
- `ci-local.sh` was not run (not required). It uses the same helper and trap
  pattern that the tests exercise.

## One-time cleanup on Birch (2026-11-12)

`cleanup-list.txt` lists the 714 entries removed (1.38 GiB) with their
sizes. Selection: name `oh-*`, `oh?*.*`, `pilot*-*`, `open-habitat-build` or
`finnish-scan-*`; owner `maintainer`; newest mtime anywhere in the tree
older than 24 h; not a registered git worktree or Taskfleet run path; not
open by any process (cwd, fd and maps under `/proc`). Each entry was removed
by its exact path, after its owner and mtime were checked again. 47 recent and
13 foreign-owned matches were kept.

`df -h /var`: before 67G used of 98G (72 %), after 65G (70 %).

The space is elsewhere. About 2,600 entries owned by this account remain
directly in `/var/tmp`, roughly 20 GiB. The largest are `birch-conductor`
(2.4 GiB), `agent-keep` (1.7 GiB, deliberate), `pi-state-*-clone` (1.3 GiB),
`skill-reader-evidence`, `playwright-transform-cache-32000`,
`agent-scratch-c2f7a3nk9z`, `bridge-pr-*`, `oss-*`, `node-compile-cache`, plus
383 empty `playwright_chromiumdev_profile-*` and many random-named Go temp
directories. None is clearly Open Habitat scratch by name, so all were left
alone; Jari can decide on `birch-conductor` and the clones.

## Decisions for later review

- **Release scripts unchanged.** `prepare-release.sh`, `package-release.sh`
  and `verify-release.sh` keep `TMPDIR=${TMPDIR:-/var/tmp}`. They already
  remove their staging in EXIT traps, a release runs from a worker whose TMPDIR
  is already agent-scratch, and `test-prepare-release.py` copies
  `prepare-release.sh` alone, so sourcing the helper would need a fixture
  change for little gain. Alternative: source `scratch.sh` there as well.
- **Python `TemporaryDirectory(dir='/var/tmp')` unchanged** in
  `go-binary-notices.py`, `cloud-qualify.py` and the test scripts. These are
  context-managed and only a SIGKILL leaves them behind. Sharing the root
  logic with Python would mean an importable module, which `-I` runs and the
  spec-file loading in tests make fragile. `browser-focused.py` and
  `inspect-trace.sh` carry their own five-line copy instead.
- **`finnish-scan-*` counted as Open Habitat** in the cleanup (this repo's
  unit-test prefix), although the brief's list did not name it.
  `playwright_chromiumdev_profile-*` and random-named Go directories were not
  removed, because their names don't prove which project made them.
- **No HUP/INT/TERM traps in the shell entries.** Bash 5.2 runs the EXIT
  trap on TERM by itself (checked), and an explicit trap would instead wait
  for the foreground child before cleaning up.
- **Lab TMPDIR lifetime** follows the host's: it is removed on `stop` or the
  next `start`, not when the launcher exits, because the host outlives the
  launcher.
