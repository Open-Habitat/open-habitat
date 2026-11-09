---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: conductor
status: fixed
priority: high
lane: unlaned
preparation: ready
closed: 2026-11-09
---

# Something set core.bare=true on the main checkout, blocking every worker's merge

## Description

9.11.2026 on Birch, `~/src/open-habitat/.git/config` was rewritten at
07:33:33 +0200 with `core.bare = true`, so the main checkout became "bare":
`git status` failed (`this operation must be run in a work tree`), `git
worktree list` showed it as `(bare)` and the `gate-red-r70b` worker's
`run merge` waited for half an hour ("main not checked out"). The conductor
restored `core.bare=false`; the tree was clean and on 832002220.

At that time the conductor ran `scripts/test-focused.sh --area browser`
(`worker-badges.spec.ts`, lab `lab-onboarding.spec.ts`) from a linked
worktree (`~/src/open-habitat__worktrees/gate-r70`) at 832002220, which
includes the new `test-focused.sh` runner tests (`test-focused-repeated-spec`),
and the `gate-red-r70b` worker had just started. A classic cause is a test
or fixture running `git init --bare <path>` or `git config` with an
inherited `GIT_DIR`/`GIT_COMMON_DIR` or from inside the repository so it
reinitialises the shared repository instead of a scratch one (candidates:
`test/browser-host/lab.go` bare remotes, `scripts/test-prepare-test-release.py`,
the new runner tests). Find what wrote it, reproduce, and make every test
and script that runs git isolate itself (scrub `GIT_*` env, explicit
scratch dirs).

## Acceptance Criteria

- [x] The writer is identified and reproduced; fixed so no test or script can change the shared repository's config.
- [x] A guard (for example a gate check that `core.bare` is false before and after) catches a recurrence.
