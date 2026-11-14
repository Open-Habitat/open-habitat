---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: fixed
priority: normal
preparation: ready
lane: restart-honesty
lane_seq: 1
closed: 2026-11-14
commits:
- hash: b9df61fd
  summary: Count a turn the daemon's restart aborted as cut
- hash: e8387b49
  summary: Say the server restart cut a turn
- hash: d899623a
  summary: Keep the restart mark to the run it cut
---

# A turn cut by a daemon restart says 'Keskeytit' and the conversation drops to Hiljaiset

## Observed (14.11.2026)

After the person's daemon was restarted by the operating system (see
`needrestart-restarts-daemons`), every conversation whose turn was running
showed "Keskeytit" (You interrupted), although the person did nothing, and
the conversations dropped into the rail's "Hiljaiset" section, including
ones whose agent had just answered ("nyt").

## Expected

A turn cut short by a daemon restart says so honestly (the server
restarted, not the person), as a process cut off by a restart already does,
and the conversation sits in the section the design gives a reply that
needs the person's attention, not among quiet conversations. A
conversation whose agent had already answered before the restart keeps its
section.

## Resolution

### 2026-11-14T04:51:50Z · @issuectl

Fixed: the daemon's restart now marks a running turn in native history, so its abort counts as cut (Käynnissä, failed) and the history says the server restart cut it. Cause, decisions and Live check in result.md.
