---
created: 2026-11-01
updated: 2026-11-01
type: task
status: done
priority: normal
provenance: other
provenance_detail: Implementation proposal from ADR 0035 awaiting Jari review
source_ref: taskfleet:01m6btshefrtxw97thtw5qxjqx/implementation:view-address-entry-route
originating_run: 01m6btshefrtxw97thtw5qxjqx
originating_run_kind: technical-decision
preparation: ready
blocked_by: ['@decide-view-stable-address', '@view-address-publication-lifecycle']
lane: decide-view-stable-address
lane_seq: 3
closed: 2026-11-01
---

# Open stable view addresses privately or publicly

## Description

## Problem

(`view-address-entry-route`, after 2). Add the entry route and browser owner
   frame, bounded sign-in return and public redirect. Apply log/header secrecy
   and wrong-owner non-disclosure, with focused route and browser tests. Keep
   private opens usable with sharing disabled and preserve relative assets.

Implements proposed ADR 0035 (docs/decisions/adr-0035-view-stable-address.md). Await Jari approval before implementation; entry/address-bar semantics, frozen-version identity, administrative deletion and legacy reset remain recommendations.

## Acceptance Criteria

- [x] Implement this unit under the approved ADR, including the checks named above.
- [x] Keep changed contracts, generated types and current callers coherent in each landed unit.
- [x] Record focused tests and remaining environment gaps in result.md.
