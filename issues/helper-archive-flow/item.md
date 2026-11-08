---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: done
priority: normal
lane: helper-archive-proto
lane_seq: 2
closed: 2026-11-08
preparation: ready
---

# Archiving a conversation with helpers: confirmation and helper rows in the archive

## Description

Implementation of Jari's decision on `proto-helper-archive-notice` (round 1,
8.11.2026): **1 Vahvistus** then **3 Arkistossa**. The prototype is the
specification: `design-system/prototypes/rounds/2026-11-08-avustajien-arkistointi/`
directions 1 and 3 and `issues/proto-helper-archive-notice/evidence/r1-1-*`,
`r1-3-*`.

- Archiving a conversation that has helpers asks first: the helpers with
  their states and what stays on a branch (an unfinished round). Archiving a
  conversation without helpers stays one press.
- In the archive, the conversation's helpers are rows under it with their
  states (Pallot marks).
- Restoring tells in the conversation, as a line at its end, what happened
  meanwhile, with *Avaa haara* for an unfinished round; no change count.
- Archive rule unchanged (`named-workers-in-habitat` decision): nothing is
  merged; helpers archive and restore with the parent, restored helpers stay
  archived until started.

Part of the experimental *Avustajat* feature; gate with it.

## Acceptance Criteria

- [x] Confirmation lists helpers and branch work; archive rows; restore line with Avaa haara.
- [x] Touched specs green; screenshots; `KOKEILTAVAA.md` line.
