# Result

## Writer

At 05:33:23Z (07:33:23 +0200) the `gate-red-r70b` worker ran, in its linked
worktree, `git bisect run bis.sh worker-badges.spec.ts`, where `bis.sh` called
`scripts/test-focused.sh --area browser`. `git bisect run` exports
`GIT_DIR=<main>/.git/worktrees/<wt>` to its command. Playwright started the
browser host, whose lab/fixture seeding runs `/usr/bin/git -C <home>/src/<name>
init` with the inherited environment (`test/browser-host/lab.go` `seedLab`;
also the clone and Gitea fixtures). `git init` with `GIT_DIR` set reinitialises
that repository, and because the path does not end in `/.git` it guesses a bare
repository and writes `core.bare = true` to the common config: ten seconds
later, at 07:33:33, the shared config changed.

Reproduced on a fresh clone with a linked worktree (git 2.43.0):
`git bisect run sh -c 'go test -run TestLabArchiveMarksAreReadable ./test/browser-host'`
flipped the clone's `core.bare` false → true. The same run with this change
leaves it false, also for `internal/gateway`, `internal/nativeforge`,
`scripts/test-gate-receipt.py` and `scripts/test-prepare-test-release.py`,
which had the same exposure (non-bare `git init`/`git -C <scratch> init`
inheriting the environment).

## Fix

- `internal/testgitenv.Scrub` drops the variables `git rev-parse
  --local-env-vars` lists (a test pins the list to git's); called from the
  TestMain of every Go test package that runs git with an inherited
  environment (daemon, cli, gateway, nativeforge, browser host) and from the
  browser host's `main`.
- `ci-local.sh`, `test-focused.sh`, `native-fixture.sh`, `browser-focused.py`
  and the Python tests that run `git init` unset the same variables.
- `ci-local.sh` records the shared config's `core.*` entries at entry and fails
  (before the receipt and again on any exit) if they changed.

## Decisions for later review

- The gate guard compares the `core` section of the common config, not the
  whole file. Alternatives: the file's hash or mtime. Parallel workers add
  `branch.*` and worktree entries to the same file during a gate, so a
  whole-file check would fail gates falsely; the `core` section holds `bare`,
  `worktree` and `hooksPath`, which are what break every checkout.
- Scrubbing happens at test entry points (TestMain, scripts, the fixture
  binary) rather than in each of ~40 git call sites. A new Go test package that
  runs git needs its own TestMain call; `scripts/AGENTS.md` says so.
