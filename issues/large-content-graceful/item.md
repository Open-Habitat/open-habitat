---
created: 2026-11-08
updated: 2026-11-08
type: feature
reporter: jari
status: done
priority: normal
lane: large-content-proto
lane_seq: 2
blocked_by: ['@session-over-512mib-stuck']
preparation: ready
closed: 2026-11-08
---

# Implement graceful large content: exact message at the limit, pre-send size check, history from the tail

## Description

Jari accepted 8.11.2026 direction **C Vasta rajalla plus A's pre-send check**
from `proto-large-content-graceful` round 1 (its `prototype/index.html` and
`result.md` are the specification, including the step-1 limits table):

- no standing size meters; an exact, correct message at the point where
  something stops (attachment refused, entry too large, history too large),
  naming what happened and what the person can do;
- the browser computes the combined size of attachments before *Lähetä* and
  refuses or warns there, before anything is sent;
- one warning when a conversation approaches the history limit;
- a too-large conversation opens from its newest messages and offers to
  continue in a new conversation; a huge single entry shows as a collapsed
  placeholder and the rest of history still loads;
- no folder hand-off of large image batches (direction B was not chosen).

Builds on `session-over-512mib-stuck` (tail reads in the daemon).

## Acceptance Criteria

- [x] Each of the prototype's four moments works as in direction C (+ pre-send check), fi and en, 1440 and 390.
- [x] Explain-mode cards for the new controls; touched specs green; KOKEILTAVAA line.
