---
created: 2026-11-12
updated: 2026-11-14
type: feature
reporter: jari
status: done
priority: normal
lane: start-page
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Start page goal option: start immediately when the request has no placeholder

## Description

Jari (12.11.2026, kunnollavauhtiin-monorepo): an *Aloita tästä* goal such as "Käsittele tehtäväpalautukset" has a complete request with no placeholder, so there is nothing for the person to add. Today choosing it only prepares the draft (skill chip) and waits for a separate Send; Jari wants that kind of goal to start the work immediately with one press.

Proposal: an optional goal field (e.g. `start: immediate`) in `.agents/start-page.md`. When set and the prepared request has no placeholder, choosing the goal sends it at once into the new or empty conversation and opens the guide beside it as now. Goals with a placeholder, or a nonblank existing draft, keep today's prepare-and-wait behaviour. The start-page format, its validator and the `open-habitat-start-page` skill text ("it never sends") change together.

## Acceptance Criteria

- [x] A goal marked for immediate start, chosen from the workspace page or an empty conversation, sends its request once without a second press; the conversation shows the goal chip and guide as today
- [x] Goals with a placeholder or an existing nonblank draft are unchanged
- [x] Format, validation, start-page skill and UI guide document the field; browser test covers both paths
