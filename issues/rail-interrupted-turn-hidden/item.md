---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: jari
status: fixed
priority: high
lane: rail-icons-no-grouping
lane_seq: 2
preparation: ready
closed: 2026-10-31
---

# A turn cut by an upgrade is folded away under Hiljaiset instead of shown as interrupted

## Description

Jari 31.10. 19.18 (Birch pilot.17, screenshot in
`rail-icons-no-grouping/attachments/hiljaiset-deutschpad.png`): after the
pilot.17 upgrade only one conversation remained in the rail, folded under
*Hiljaiset · yli tunnin* as `› d deutschpad 1`; the other inactive
conversations (fleetrepo) had left the rail, as finished conversations
whose Pi stopped do.

Conductor's facts (19.25): the deutschpad conversation
`pi:c0202001-3430-42ad-8980-670600a16fbc` was **cut mid-turn by the
upgrade**. Its session ends with an assistant message `stopReason: toolUse`
and the tool result at 10:21:32Z, the minute the daemon restarted for
pilot.17 (activation 10:21Z), then an automatic recap at 10:24Z. No final
assistant message. Its Pi is not running. The daemon now reports `state:
stopped`, `run_active: false`, `turn_settled: null`, `interrupted: false`,
`continuation: unproven`. So the rail kept it (as an ended-unasked
conversation, by design, "not silently gone"), but showed it as a quiet
row inside a workspace fold, with nothing saying its work was cut off.

## Acceptance Criteria

- [x] A conversation whose turn was cut by a daemon restart/upgrade is shown
      as interrupted (in sight, not folded under Hiljaiset), saying the work
      stopped mid-turn and offering to continue; it leaves that state when
      the person continues or dismisses.
- [x] The daemon's status says the turn was interrupted (today
      `interrupted: false`, `turn_settled: null`); name where that fact
      comes from (native session ends without a final assistant message).
- [x] Browser spec with a turn cut by a daemon restart; KOKEILTAVAA line.

## Comments
