---
created: 2026-11-14
updated: 2026-11-14
type: feature
status: open
priority: normal
preparation: ready
lane: background-slot
lane_seq: 1
---

# A reserved background slot for recaps and other system work

## Observed

When a person's live-conversation limit is reached (by default 32 live Pi per person, adjustable by the administrator), starting another conversation stops an idle one to make room (`makeRoom` in `internal/daemon/pi_activity_linux.go`). A recap that idle conversation still owed is then never made, while the ordinary idle stop (`stopExpiredIdlePi`) hands the owed recap on (`recapAfterIdleStop`). So a finished task's summary can go missing exactly when the person is busiest.

## Expected

Stopping to make room hands on an owed recap the same way the idle stop does. Found in the review of the 31.10.2026 decisions; Jari 14.11.2026: fix it.

## Agreed design (Jari 14.11.2026)

Replace the symptom fix with a reserved background slot. A person's limit
becomes N conversations (default 32) **plus one** slot reserved for the
system's own work that nobody is waiting for right now: today the automatic
recaps, later similar background jobs. Such work goes into a queue served
one at a time by that slot; it never stops a person's conversation and never
competes with them for a place.

- Stopping an idle conversation to make room hands its owed recap to the
  queue; the idle stop's recap goes to the same queue, so both paths are one.
- Wakes that resume a person's conversation (a finished process or worker)
  are not background work: they use ordinary slots.
- Pending recaps survive a daemon restart by being derivable from the
  conversations' own native state, not from a new store.
- Cost accepted: one at a time, so a burst of finished conversations can
  delay the last recap by minutes. At most about 200 MiB more per person,
  and only while the queue has work. No contract, UI or installation change
  expected; record any that turns out necessary under "Decisions for later
  review".
