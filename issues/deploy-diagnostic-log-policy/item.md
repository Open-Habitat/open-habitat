---
created: 2026-10-05
updated: 2026-10-05
type: task
reporter: jari
status: open
priority: normal
related: ['@correlate-diagnostics']
lane: logging
lane_seq: 3
blocked_by: ['@correlate-diagnostics']
preparation: ready
---

# Apply diagnostic log policy on the test installation

## Purpose

Complete the test-installation part of [ADR 0013](../../docs/decisions/adr-0013-diagnostic-logging.md) after @implement-diagnostic-emitter and @correlate-diagnostics. The concrete guest configuration and receipts belong to Fleetrepo's `nah-diagnostic-log-access` issue, not to this portable product repository. This issue is a scheduling bridge: issuectl cannot express a blocker across repositories, so without a local successor the Fleetrepo work could be forgotten or run against an older release.

## Next action

When the product work lands, check that the release containing both changes is installed on the test guest. Then pick up `nah-diagnostic-log-access` from the Fleetrepo DAG, where its worker can inspect actual journal permissions, ingress, retention and cross-user access under Fleetrepo's operator policy. If that issue is already finished, inspect its release and guest receipts rather than starting a duplicate run. A product commit or a synthetic test alone does not prove deployed access. If journald cannot enforce the agreed reader boundary, return the concrete alternatives for a joint decision instead of declaring success or introducing a second log store.

The product issue records only the release and Fleetrepo issue result needed to establish that this handoff happened. Installation-specific configuration, identities and logs remain private in Fleetrepo.

## Acceptance Criteria

- [ ] The test guest runs a release containing both product diagnostics changes, with the installed revision identified.
- [ ] Fleetrepo's `nah-diagnostic-log-access` has a landed result verifying the agreed reader boundary, ingress and retention; this issue links to that outcome without copying private evidence. If the boundary cannot be enforced, keep this issue open for the joint decision.

