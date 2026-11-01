---
created: 2026-11-01
updated: 2026-11-01
type: task
status: open
priority: normal
provenance: other
provenance_detail: Implementation proposal from ADR 0035 awaiting Jari review
source_ref: taskfleet:01m6btshefrtxw97thtw5qxjqx/implementation:view-address-reservations
originating_run: 01m6btshefrtxw97thtw5qxjqx
originating_run_kind: technical-decision
preparation: ready
blocked_by: ['@decide-view-stable-address']
lane: decide-view-stable-address
lane_seq: 1
---

# Persist one bounded address reservation per view

## Description

## Problem

(`view-address-reservations`). Extend the gateway store and contract with
   private/public state, unique lazy reservation, separate limits and explicit
   deletion. Implement owner/session checks and restart/corruption/concurrent
   ensure tests. Include the approved one-time legacy reset and upgrade notice;
   never grant public access merely by creating a reservation. Keep intermediate
   commits usable: every changed wire interface includes its generated types,
   client validator and affected callers in the same unit, not the later redesign.

Implements proposed ADR 0035 (docs/decisions/adr-0035-view-stable-address.md). Await Jari approval before implementation; entry/address-bar semantics, frozen-version identity, administrative deletion and legacy reset remain recommendations.

## Acceptance Criteria

- [ ] Implement this unit under the approved ADR, including the checks named above.
- [ ] Keep changed contracts, generated types and current callers coherent in each landed unit.
- [ ] Record focused tests and remaining environment gaps in result.md.
