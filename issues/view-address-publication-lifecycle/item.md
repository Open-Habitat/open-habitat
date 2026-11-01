---
created: 2026-11-01
updated: 2026-11-01
type: task
status: open
priority: normal
provenance: other
provenance_detail: Implementation proposal from ADR 0035 awaiting Jari review
source_ref: taskfleet:01m6btshefrtxw97thtw5qxjqx/implementation:view-address-publication-lifecycle
originating_run: 01m6btshefrtxw97thtw5qxjqx
originating_run_kind: technical-decision
preparation: ready
blocked_by: ['@decide-view-stable-address', '@view-address-reservations']
lane: decide-view-stable-address
lane_seq: 2
---

# Unify publication checks for stable view addresses

## Description

## Problem

(`view-address-publication-lifecycle`, after 1). Replace movable/multiple-link
   operations with publication and duration changes on the reservation. Wire
   content authorization, expiry, owner/admin revocation, withdrawal and site
   policy to that same state. Test direct old content URLs, republishing,
   deletion, unavailable exports and session races; retain traffic budgets.
   Remove obsolete Settings retarget/rotate callers with their API, and update
   URL validation when the response starts returning app-origin entry URLs.

Implements proposed ADR 0035 (docs/decisions/adr-0035-view-stable-address.md). Await Jari approval before implementation; entry/address-bar semantics, frozen-version identity, administrative deletion and legacy reset remain recommendations.

## Acceptance Criteria

- [ ] Implement this unit under the approved ADR, including the checks named above.
- [ ] Keep changed contracts, generated types and current callers coherent in each landed unit.
- [ ] Record focused tests and remaining environment gaps in result.md.
