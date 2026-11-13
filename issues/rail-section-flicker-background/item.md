---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: fixed
priority: normal
preparation: ready
lane: rail-flicker
lane_seq: 1
closed: 2026-11-13
---

# Rail flickers: a conversation with background processes jumps between Your turn and Running

## Observed

In the conversation rail, one conversation kept jumping between the
"Your turn" (Sinun vuorosi) and "Running" (Käynnissä) sections, many times
in quick succession, so the rail flickered. The likely conversation had
finished its turn and still had background processes running (the rail
showed its background-process marker). Seen on one installation 13.11.2026 ~14.38,
pilot.29.

## Expected

A conversation whose turn has ended but whose process-tool processes still
run sits stably in one section (whichever the design says), and changes
section only when its real state changes.

## Leads

`internal/daemon/pi_activity_linux.go` `classify` asks Pi's process bridge
with a 2 s timeout; a timeout or unclear answer is `unknown`, a clear answer
with no running records is idle. If the rail's section is derived from an
answer that alternates (busy / unknown / idle) or from two sources that
disagree (turn state vs background activity), it flickers.

Reported by Jari 13.11.2026.

## Acceptance Criteria

- [x] A conversation stays in one rail section while its status is invalidated and re-read, and changes section only when its turn state changes (`railNow.test.ts` regression test).
