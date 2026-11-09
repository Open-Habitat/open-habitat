---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-09
---

# Recap bar disappears after a host update or restart

## Description

Jari 9.11.2026: when the server was updated (the agent installed a new
release, i.e. the daemon/gateway restarted), the conversations' recap bars
(*Tilannekatsaus*) were reset: after the reload the recap bar was gone instead
of returning. Most likely the test server, which updates on every push to
`main` (two pushes 9.11. morning), possibly also Birch after pilot.23.

The recap itself is a native Pi history entry (`recap_linux.go`
`nativeRecap` / `scanNativeRecap`), so it should survive any restart. Candidates
to check: the scan returns nothing when the session file changes during the
read (size/mtime guard) and the browser then keeps the empty answer; after a
restart the conversation is not under daemon control and the recap is not read
for it; the browser drops the recap on reconnect; or a restart-triggered
automatic recap attempt replaces the shown recap with a failure/empty state.

## Acceptance Criteria

- [x] Cause found and recorded here (reproduced on a disposable host or explained from the journal).
- [x] A conversation that had a recap shows the same recap after daemon/gateway restart and browser reload, without new activity.
- [x] A regression test that restarts (or re-creates) the daemon side with a recap in native history and asserts it is served and rendered.

## Cause

The clarified report concerns an in-flight recap, not persisted native data.
A restart destroys the browser's pending request and the daemon's attempt/failure
state. Startup already reconstructs owed automatic recaps from native history
(latest assistant message not covered by a recap, completed-turn threshold,
active browser origin and configured delay). An interrupted generation normally
re-runs successfully through that path.

The reproduced gap is a refused recovery: `recapResting` returned after capacity,
ownership/proof or launch refusal with only a journal line. There was no handle
on which `recordRecapOutcome` could put a failure, and `stoppedStatus` returned no
recap outcome. A startup child that failed readiness similarly rested without a
card. Thus the pending card disappeared and no recap or explanation replaced it.

A regression first failed with a fresh controller, native unrecapped history and
a one-Pi capacity limit: recovery logged `capacity`, but status had no
`recap_failure`. Browser tests now interrupt an actual fake-model call and cover
both successful recovery and that refusal. This establishes a real failure path,
not proof that capacity was the exact refusal in Jari's original test-server
incident; its earlier journal did not establish that.

## Investigation evidence

- Installed the pinned Pi test SDK and web dependencies. The existing
  `recap-resting.spec.ts` passed all three cases through the real synthetic
  gateway/controller/history path. Its first case creates a recap, recreates
  the daemon, reloads the browser and sees the automatic card without waking
  Pi. Command: `OH_PORT_BASE=15400 ./scripts/test-focused.sh --area browser
  --spec recap-resting.spec.ts` (umask 077, private TMPDIR).
- A temporary extension of that first case also restarted the gateway before
  reload and compared the entire recap API reply before and after both
  restarts. All three cases passed again. The experimental test edits were
  reverted: the brief calls for issue-only delivery when no defect reproduces.
  These are synthetic same-UID/fake-Pi checks, not an installed upgrade.
- `go test -v ./internal/daemon -run 'Recap'` passed, including pinned-native-Pi
  persistence, native branch selection, settings and owed-recap tests. Used a
  private venv with `requirements-ci.txt` on PATH and
  `TMPDIR=$HOME/.local/state/r6`.
- `go test ./internal/daemon/...` did not pass in this environment. An initial
  run exceeded the command time budget. The completed retry exposed Unix socket
  path-length failures and missing Python `referencing`; after installing the
  requirements in the private venv and shortening TMPDIR, remaining failures
  were two overlong socket paths, three editor child-lifecycle tests and
  `TestSnapshotDiscoveryAndSchema` rejecting a temporary path below the real
  home. Integrations passed. No full-package pass is claimed.
- Read the test guest's daemon journal as root through Alder's pinned SSH route,
  for 06:30–09:00 UTC on 2026-11-09. It confirms restarts at 06:44, 07:29,
  07:30, 07:46, 07:51 and 08:11 UTC. The four recap events are successful
  automatic generations at 07:22, 07:46 and 08:13 and a resting pass skipped
  because the conversation was controlled at 07:35. There is no recap-read
  response or browser-presentation evidence explaining the loss. No service
  was restarted and no live history was changed or used as test input.
- Logs are private on Birch under
  `~/.local/state/recap-lost-after-restart-01m6znw3vjbesrasd0h9nhdv6m/`:
  `journal.txt`, `browser.log`, `browser-both.log`, `recap-go.log` and
  `go-short.log`. No live journal contents are committed.

## Implementation Notes

Recovery refusals now produce the existing `not_written` card, tied to the
candidate's native `through`, and invalidate browser status. Outcomes with an
existing handle use its existing failure field; pre-launch startup refusals use
bounded daemon-lifetime failure memory (at most the eight selected startup
candidates), retired when a handle takes ownership. Nothing is persisted and no
new retry scheduler, history cache or read-triggered Pi start is introduced.

Disabled recaps, archive, cancellation and takeover are not failures. Successful
recovery, completed recaps and configured eligibility remain unchanged. See
[result.md](result.md) for checks, review and evidence limits.

## Jari 9.11.2026 (answer to the investigation)

Test server. What disappeared was not the recap itself but the waiting card
(*odotuskortti*), i.e. the pending/in-progress state shown while a recap was
being made, at the moment the host updated. So the question is what happens
to a recap that was in progress (or its failure card) when the daemon
restarts: the in-memory state is forgotten, the card vanishes and, unless
something retries, the recap never arrives.
