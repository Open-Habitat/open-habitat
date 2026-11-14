---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: open
priority: normal
preparation: ready
lane: recap-room
lane_seq: 1
---

# Starting a conversation at the live limit drops the stopped conversation's owed recap

## Observed

When a person's live-conversation limit is reached (by default 32 live Pi per person, adjustable by the administrator), starting another conversation stops an idle one to make room (`makeRoom` in `internal/daemon/pi_activity_linux.go`). A recap that idle conversation still owed is then never made, while the ordinary idle stop (`stopExpiredIdlePi`) hands the owed recap on (`recapAfterIdleStop`). So a finished task's summary can go missing exactly when the person is busiest.

## Expected

Stopping to make room hands on an owed recap the same way the idle stop does. Found in the review of the 31.10.2026 decisions; Jari 14.11.2026: fix it.
