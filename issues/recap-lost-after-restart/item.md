---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: pending
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

- [ ] Cause found and recorded here (reproduced on a disposable host or explained from the journal).
- [ ] A conversation that had a recap shows the same recap after daemon/gateway restart and browser reload, without new activity.
- [ ] A regression test that restarts (or re-creates) the daemon side with a recap in native history and asserts it is served and rendered.

## Cause

Not established. Investigation on 2026-11-09 at
`52ea19c4e49e0dff6b9b40e1cfa89937492df2ff` did not reproduce a lost persisted
recap. No product change is justified yet; preparation is pending.

The recap GET uses native session discovery and `latestNativeRecap`, not the
controller's in-memory conversation ownership. A changed-file scan fails with
503, not a successful empty recap. The browser preserves an already-read recap
on a failed read, but a fresh page has no previous value. This leaves a transient
read failure as a possibility, not a demonstrated cause. Failure cards are
in-memory and differ from persisted recap entries; the report does not yet
identify which kind of card disappeared.

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

## Next evidence needed

Identify one affected conversation and installation, and whether the missing
card contained an actual summary or an error/pending message. On the next
occurrence, capture the recap GET's HTTP status and the presence/currentness of
`recap.through` versus `latest_message`, before sending or typing anything.
That distinguishes missing native data, an unavailable read, a stale recap and
browser-only hiding without guessing a change to visible behaviour.

Review choice: source inspection and existing regressions only; no LLM diff
review or assessment was needed because no product/contract/history-reader
change is being delivered. The issue remains open and its acceptance criteria
are not marked complete.
