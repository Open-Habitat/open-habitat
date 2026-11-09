---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
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
