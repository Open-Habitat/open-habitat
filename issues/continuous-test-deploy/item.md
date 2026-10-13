---
created: 2026-10-13
updated: 2026-10-13
type: improvement
reporter: jari
status: done
priority: high
related: ['@fast-test-release']
lane: release-tooling
preparation: ready
closed: 2026-10-13
closed_by: claude
---

# Deploy to the test server continuously

Jari (2026-10-13): a test release takes about 55 s (pilot.24: prepare 5.4 s,
staging the ten-file closure and archive about 30 s, preflight, stage, switch
and verify 16.2 s). He wants deployment fast enough to be continuous: when the
software changes, for example UI code, a watcher could deploy it to the test
server without anyone running a command.

Test releases no longer need the clean gate (`AGENTS.md`, Jari 2026-10-13);
the release receipt says whether the tree was gated.

## Direction

- Find what the 55 s is spent on and what does not need to happen on each
  deploy: rebuilding and re-transferring the unchanged closure, archive
  creation, a full service switch when only web assets changed.
- An incremental path for the common case: when only `web/` changed, ship only
  the changed assets and make the running host serve them, if that can be done
  without weakening the release's record of which bytes run on the guest.
- A watcher that triggers on new commits of local `main` on alder and runs the
  fast path, serialised so two deploys never overlap. Deploying uncommitted
  worktree state is out of scope: each deploy stays traceable to a commit.

The operator lives in Fleetrepo (`infra/open-habitat-test/`), so part of the
work lands there; its `RELEASE-UPGRADE.md` describes the trust boundaries,
which must not widen.

## Acceptance Criteria

- [ ] A web-only change reaches the test server in seconds rather than a minute, with measured times recorded in `result.md`.
- [ ] A full release (Go changes) is also faster than 55 s, measured.
- [ ] A watcher deploys new `main` commits automatically, one at a time, and every deploy writes a receipt naming the commit and whether the tree was gated.
- [ ] `RELEASE-UPGRADE.md` and `TESTING.md` describe the continuous path and how to stop it.

## Decisions

### 2026-10-13T08:26:46Z · @claude

Jari 2026-10-13: no seconds-scale web path for now. Neither a guest-side web overlay nor a Vite HMR dev loop is built, because UI work currently proceeds through prototypes (design-system/prototypes). The watcher with the ~36-52 s full successor is the delivered continuous path; the web-only seconds criterion is dropped, not met.
