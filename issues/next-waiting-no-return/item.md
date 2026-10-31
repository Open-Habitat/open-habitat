---
created: 2026-10-31
updated: 2026-10-31
type: improvement
reporter: jari
status: done
priority: normal
lane: next-waiting
lane_seq: 2
preparation: ready
closed: 2026-10-31
---

# Next-waiting: hidden while this conversation awaits you; a round without the way back

## Description

Jari 31.10. (Birch, screenshot `attachments/sillä-aikaa.png`): the row
*Sillä aikaa · 1 odottaa sinua · … · Käy läpi Alt+↓* was shown above the
composer while the conversation at hand had something for him to do.

1. **The row is not shown when this conversation's own agent is waiting for
   the person** (its turn has ended and it is his turn to write, or it asks
   something). It is meant for the time the agent here works, not as a
   general tracker of other conversations. Check also that the row never
   lists the conversation it is shown in.
2. **Try a round without a way back.** Jari: this is not meant to be a
   tracking tool. The round should not automatically offer the route back to
   the conversation it started from (the origin step / return at the end);
   going through the waiting ones simply moves forward, and the person
   returns through the rail like anywhere else.

Both stay within the existing experimental Jono (`next-waiting-row`)
feature.

## Acceptance Criteria

- [x] The row is hidden whenever this conversation's agent waits for the
      person and appears again when it works; it never lists itself.
- [x] A round offers no automatic return to the origin; what the round's end
      shows instead is recorded under Decisions for later review.
- [x] Browser specs for both; KOKEILTAVAA line.

## Comments
