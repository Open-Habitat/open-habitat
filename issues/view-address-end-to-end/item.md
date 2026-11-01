---
created: 2026-11-01
updated: 2026-11-01
type: task
status: open
priority: normal
provenance: other
provenance_detail: Implementation proposal from ADR 0035 awaiting Jari review
source_ref: taskfleet:01m6btshefrtxw97thtw5qxjqx/implementation:view-address-end-to-end
originating_run: 01m6btshefrtxw97thtw5qxjqx
originating_run_kind: technical-decision
preparation: ready
blocked_by: ['@decide-view-stable-address', '@view-card-public-switch', '@view-address-access-exemption']
lane: decide-view-stable-address
lane_seq: 6
---

# Verify stable view addresses through the real ingress

## Description

## Problem

(`view-address-end-to-end`, after 4). Exercise two users plus an anonymous
   browser, multi-file exports, blocked cookies, restart, expiry, republish,
   administrator/owner revocation, withdrawal, site toggle and deletion. Verify
   both URLs and ingress log/cache rules. Update the operator guide and record
   the approved authority rules in the nearest instructions. Report browser or
   environment gaps explicitly instead of claiming gateway tests prove them.

Implements proposed ADR 0035 (docs/decisions/adr-0035-view-stable-address.md). Await Jari approval before implementation; entry/address-bar semantics, frozen-version identity, administrative deletion and legacy reset remain recommendations.

## Acceptance Criteria

- [ ] Implement this unit under the approved ADR, including the checks named above.
- [ ] Keep changed contracts, generated types and current callers coherent in each landed unit.
- [ ] Record focused tests and remaining environment gaps in result.md.
