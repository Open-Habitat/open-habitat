---
created: 2026-10-28
updated: 2026-10-28
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: focused test run by a taskfleet worker
source_ref: taskfleet:01m60r1c8x04g79g3yqtkd9a2y/test-failure:TestProcessCatchUpLogic
originating_run: 01m60r1c8x04g79g3yqtkd9a2y
originating_run_kind: spinoff
lane: agent-lifecycle
preparation: ready
closed: 2026-10-28
---

# Pi catch-up test: an ordinary first start gets a crash/interrupted-turn notice (TestProcessCatchUpLogic fails on main)

## Description

`go test ./internal/daemon -run TestProcessCatchUpLogic` fails on main (db3fbe08, Birch, 2026-10-28), also in a clean detached worktree of main.

`internal/daemon/pi-device-test/catch-up.test.mjs` subtest 5, "the first run after Pi starts gets one context message, and only when there is news", expects `before_agent_start` to return `undefined` after a `session_start` whose branch shows a process that started and ended. Instead the companion returns an `oh-resume-catch-up` message saying Pi "stopped at <now> unexpectedly … The turn it was working on was cut off", with `details.stopped.cause: "crash"`, `interrupted_turn: true` and empty processes/spinoffs.

So either the companion now reports a crash stop and interrupted turn for a branch with no unfinished turn (product behaviour: a person would see a false "Pi stopped unexpectedly" notice on an ordinary start), or the test's synthetic branch no longer matches what the stop-cause detection reads and the test needs updating. The stop time is the current time, which suggests the stop record is derived from the test's own environment rather than from the branch.

Found by the onboarding-git-identity-stuck-while-cloning worker while running the focused daemon package; it does not touch this code.
