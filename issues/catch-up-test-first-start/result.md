# Result

**Verdict: both.** The test fixture was stale in one respect, and a product
leak sat behind it. A false "Pi stopped unexpectedly … cut off" notice could
reach a person.

## Why the test failed

The test did not set `OPEN_HABITAT_STOP_CAUSE` / `OPEN_HABITAT_STOPPED_AT`
itself. It inherited them from the runner's environment. On Birch that
runner is a Taskfleet worker started from a Habitat Pi conversation, so its
environment held `OPEN_HABITAT_STOP_CAUSE=crash` and
`OPEN_HABITAT_STOPPED_AT=2026-10-28T07:03:43Z`. That was the conductor's own
stop, not something the test chose. The fixture's last turn message is the
process tool's `toolResult`, so the branch read as a cut turn. A stop plus a
cut turn is news, so the companion wrote the crash catch-up.

## The product defect

The daemon passes the rest to the Pi it starts through those two variables
(`restEnv`, rest_linux.go). The companion read them but left them in
`process.env`. Pi's bash tool spawns with `{...process.env}`, so every tool
command, tmux window, Taskfleet worker and nested Pi that this Pi started
inherited the stop. Any such Pi that opened a non-empty branch would claim
that crash as its own. If the branch ended in an unanswered tool step, it
would also report the turn as cut. The person would then see a false
"stopped unexpectedly" catch-up in that conversation's history.

The daemon's choice of cause is sound. It records `crash` only for an exit
that nobody asked for (`watch`, conversation_linux.go). The notice the
conductor saw in its own conversation came from that conversation's own
recorded unasked exit at 07:03:43Z, which is the value this worker inherited.
The journals do not say why that Pi exited, so this result does not call
that notice false. Only its inheritance by children was.

## Fix

- `process-extension.mjs`: the companion takes the stop once, when the
  extension loads, and deletes both variables from `process.env`. Only the
  first session this Pi opens receives the stop.
- `catch-up.test.mjs`: the tests own the launch variables and do not inherit
  them. A new test checks three things: the variables are gone after load,
  the first session still gets the crash and cut-turn catch-up, and a later
  session in the same Pi does not. This test fails on the old companion.

## Evidence

- `go test ./internal/daemon -run TestProcessCatchUpLogic` passes. The whole
  `./internal/daemon` package passes (needs Python `referencing` from
  `requirements-ci.txt`).
- `rest-card.spec.ts` passes (3) on Birch with `OH_BROWSER_WORKERS=2`.
- Review: `/llm-review` with gpt-6-astra as finder found nothing. No
  verifier was called, because the surface is session state and not an auth
  boundary.

## Decisions for later review

1. **The stop applies only to the first session the Pi opens.** Alternative:
   re-read it on every `session_start`. Why not: a Pi that switches sessions
   (`/new`, `/resume`) did not wake that other session from the rest.
2. **Only the two stop variables are removed.** `OPEN_HABITAT_CONVERSATION_ID`
   and `OPEN_HABITAT_LAUNCH_GENERATION` also pass to children. The
   history-write check compares them with the live session ID, so a nested
   Pi with a different session fails that check. Removing them would change
   other code paths, which is beyond this bug.
