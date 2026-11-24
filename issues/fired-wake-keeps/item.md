---
created: 2026-11-24
updated: 2026-11-24
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# A fired wake keeps a clock on the rail row, and the conversation does not say it woke

## Observed (Jari 24.11.2026, v0.1.8)

A rail row in Sinun vuorosi showed an amber clock and "21.20" in the time slot at 21.46.
The conversation's scheduled wake had fired at 21.20. Jari:
- the explanation is only a hover tooltip, and hovering the row shows its action buttons
  instead, so nothing tells him what the clock means;
- a wake that has already fired should not be shown in the time slot at all;
- opening the conversation shows nothing about a wake either.

## Done when

- The time slot shows a clock only for a pending (future) wake; a fired wake no longer takes
  the slot (the row shows its ordinary age).
- The conversation itself says when Habitat woke the agent (a quiet Habitat line at the
  turn the wake started, e.g. "Habitat herätti agentin klo 21.20: <the wake's note>"), if
  that line does not exist or is not visible today.
- A pending wake's meaning is reachable without hover (e.g. the row's accessible name and
  the conversation header or a line), checked on phone width too.
