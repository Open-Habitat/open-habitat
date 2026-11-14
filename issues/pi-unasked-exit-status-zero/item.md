---
created: 2026-11-07
updated: 2026-11-14
type: improvement
status: done
priority: normal
provenance: other
provenance_detail: taskfleet worker finding from Kaisa's journal facts
source_ref: taskfleet:01m6tyjw70920ryv19hn8srmx9/pi-unasked-exit-status-0
originating_run: 01m6tyjw70920ryv19hn8srmx9
originating_run_kind: spinoff
lane: pi-diagnostics
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Pi ends itself (status 0, input open) in an empty browser conversation; the journal cannot say why

## Description

An empty browser conversation was observed ending with conversation_pi_ended outcome=unasked: Pi exited status 0 while Habitat still held input open. Repeated wake-on-typing continues, one conflict response and a held-message cancellation preceded the exit. The old stderr collector only retained storage diagnostics, so the journal could not narrow the cause.

The approved next step was bounded content-free exit diagnostics and an installed-Pi reproduction in a synthetic home, without claiming an upstream cause before it was established.

## Acceptance Criteria

- [x] Bounded fixed stderr classifications and recency accompany the unasked-exit event without native text.
- [x] Attempt the wake/held/cancel sequence with installed Pi in a synthetic home and record its limits.
- [x] Independently review lifecycle/privacy behavior and run focused daemon checks.
- [x] Record the still-unresolved observed bug in a new unlaned intake: pi-silent-zero-exit-cause.

See result.md for evidence and decisions.
