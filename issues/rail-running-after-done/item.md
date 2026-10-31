---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: jari
status: fixed
priority: high
lane: rail-running-after-done
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Finished conversation stays under Käynnissä in the rail (Birch)

## Description

Jari 31.10. ~10.20 local (Birch, pilot.16): conversation
`pi:7eaa52a7-91ee-4a49-b5a4-7cdb467773b8` in workspace
`ws_6pm41eaZaiJXaFLmYecY1EHb` (`~/src/fleetrepo`) is listed under
*Käynnissä* in the rail although it is finished.

Facts (conductor, 08:20Z): the session file
`~/.pi/agent/sessions/--home-maintainer-src-fleetrepo--/2026-10-31T07-59-24-145Z_7eaa52a7-….jsonl`
ends with an agent file offer + notice (08:07:48Z, notice persistence
`unknown`), the assistant's final message with `stopReason: stop`
(08:08:03Z), and an automatic `conversation-recap` entry (08:12:27Z, daemon
journal `conversation_recap outcome=done trigger=automatic
model=claude-bridge/claude-sonnet-5-5`). No other daemon journal line names
the agent since 09:55 local.

Suspects to check: the automatic recap (it may leave the agent marked
working, or the recap's own Pi run is counted as the conversation working),
the file offer/notice path, a background process or wait the rail counts as
work, or a status read that never settled after the turn.

## Acceptance Criteria

- [x] Cause named from code and live state.
- [x] A conversation whose turn has ended leaves *Käynnissä* (with its
      recap, file offer or notice), and returns only when its agent works;
      browser spec reproducing the situation.

## Comments
