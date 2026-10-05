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

# Verify diagnostic logs on the test installation

## Purpose

The test installation should make the service logs from [ADR 0013](../../docs/decisions/adr-0013-service-logging.md) straightforward to find and safe to read after @implement-diagnostic-emitter and @correlate-diagnostics land. Fleetrepo's `nah-diagnostic-log-access` owns the guest settings, operator instructions and receipts. This small bridge keeps that cross-repository work on the product DAG after the release it needs; it does not create another logging system or duplicate Fleetrepo's issue.

When the product changes are released, check the installed revision and pick up the Fleetrepo issue in its own DAG. If Fleetrepo already completed it, read its actual guest evidence rather than starting a duplicate run. Record the release and Fleetrepo outcome here without copying private host details. An earlier product unit test cannot establish effective journal readers or retention on the guest.

## Acceptance Criteria

- [ ] The test guest runs a release containing both product logging changes, with the installed revision identified.
- [ ] Fleetrepo's `nah-diagnostic-log-access` has a landed result for where to find service logs, who can read them, and the effective journal retention/space settings; this issue links to that result without copying private evidence.

