---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: done
priority: normal
preparation: ready
lane: research-decisions-explained
lane_seq: 1
closed: 2026-11-01
---

# Explain the three research decisions: product owner and architect views

Jari 1.11.: the three finished research reports (`research-user-slice-limits`, `research-per-person-gateway`, `research-locked-account`) each end in decisions for him. He wants one separate page that explains, per research, what has to be decided and what doing it would mean, in two views each: a product owner's view (what changes for the people using Open Habitat and for operating it, what it costs, what happens if we do nothing) and a software architect's view (which component would get which authority, what new mechanism or dependency, risks, how reversible). Written in the spirit of the `rethink-document` skill: separate what the research actually found and what is actually up for decision from what an agent added while writing; plain Finnish a person can read. End each with the recommendation and the concrete question for Jari. Not an ADR and not an implementation.

## Acceptance Criteria

- [x] Self-contained Finnish [decision page](index.html) separates findings from proposals and gives both requested views and one question per research.
- [x] Text self-reviewed against sources; offline layout checked at 390 px and 1280 px; view offered to the conductor conversation. Verification and offer identity: [result.md](result.md).
