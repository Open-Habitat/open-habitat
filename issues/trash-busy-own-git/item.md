---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: fixed
priority: normal
lane: trash
lane_seq: 1
collision: [internal/daemon/trash]
closed: 2026-10-20
---

# Workspace deletion keeps reporting a git process in the directory

_Source: chat:ville-test-2026-10-20_

## Description

Ville (2026-10-20, pilot.237) deleting a workspace repeatedly got the notice that a git process is running in the directory. Hypothesis (Jari): the deletion itself, or the browser's snapshot polling (the user's daemon logged /api/v1/snapshot every ~1-2 s during the test, which runs git in workspaces), starts the git process that the busy check then sees. Reproduce in the lab with snapshot polling active, find which git process blocks, and make the busy check ignore the daemon's own short-lived inspection processes (or avoid running them on a workspace being deleted) while still blocking on the person's real processes. Done: deleting an idle workspace with the browser open succeeds on first try; a real shell or git in the directory still blocks and is named.

## Comments

### 2026-10-20T06:28:55Z · @agent

Reproduced locally with the production workspaceGitSummary path held in Git configuration loading (synthetic HOME/.gitconfig FIFO): PID 3340566, comm git, snapshot git status. The delete request returned state=blocked with that exact PID as its only blocker. This proves a concurrent snapshot inspection can block deletion; no test-server access was used. The FIFO makes the normal short-lived overlap deterministic. In that initial HTTP reproduction, the synthetic .git directory was removed after the inspection started, so deletion's own Git checks would not wait on the same FIFO before reaching the process check. The final regression keeps the checkout intact and exercises the shared process guard directly, then verifies the deletion request.

## Implementation and review

Read-only snapshot/detail Git commands (including watch-root discovery, worktree reflogs and spinoff checkout identification) share a read lock with the process guard's exclusive lock. The guard waits for existing bounded inspections to finish and prevents new ones from starting during its scan. No PID, command name or process ancestry is ignored. Git writes, terminals and Pi tools remain outside this lock and are inspected normally.

Focused self-review: this changes inspection timing, not UID selection, filesystem authority, gateway/daemon/broker boundaries or installation hardening. All existing process ownership, pinned `/proc`, unreadable-process and busy-session checks are unchanged. Checked all snapshot Git subprocess call sites and retained native timeouts. No UI code changed; visual captures are not applicable.

The regression holds the production snapshot Git command in synthetic configuration loading and confirms the process guard drains it. It then starts an ordinary Git with the same cwd/command from the test process and requires that exact PID and `git` name to remain a blocker, before a first deletion request succeeds. The existing real-cwd sleeper case still verifies person-process blocking through the deletion HTTP handler. This is synthetic native-process evidence, not a browser polling or live-server test; deployment and live verification remain with the conductor.

## Acceptance Criteria

- [x] The process guard waits out snapshot Git inspection instead of reporting its PID as a busy workspace; deletion of that idle workspace succeeds on its first request.
- [x] An ordinary Git process remains a blocker with its exact PID and `git` name; existing shell/cwd blocking remains covered by the daemon suite.

## Validation

Tested daemon source subtree: `94f065f7891647ed62ad582bebae5b6e4578dc49` (base `6d24a029450c182bf3b030bf7b564fa405b052dd`). Only issue evidence/metadata changed after these checks.

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` — passed.
- `umask 0077; TMPDIR=/var/tmp/oh-trash-build ./scripts/test-focused.sh --area go --go-package ./internal/daemon` — passed with race detector, uncached (74.170 s package time).
- `TMPDIR=/var/tmp/oh-trash-build ./scripts/test-focused.sh --area contracts` — passed: generated contracts clean; 54 schemas, 51 fixtures, 36 scenarios and 17 negative checks valid.
- `issuectl doctor --json` and `git diff --check` — passed.

Development failures were resolved: the first regression used the wrong fixture helper; initial synthetic homes were group-writable under inherited umask `0002`; the complete suite also requires private scratch ancestors and the fake editor socket requires `0077`. The final full package run above passed. A foreground three-repeat regression run hit its 10-second command limit after two passes; the final uncached race suite supersedes that partial run. Expected pre-fix red runs identified the inspection's real Git PID, and the post-fix regression passed.

No test-server access or push. No Fleetrepo installation changes needed. The conductor still needs to verify browser polling and deletion after deployment; this run claims native-process regression coverage, not a live browser retest or distinct-UID isolation proof.
