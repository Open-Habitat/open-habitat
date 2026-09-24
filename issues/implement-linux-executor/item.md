---
created: 2026-09-24
updated: 2026-09-24
type: task
status: open
priority: high
lane: auth-jit
lane_seq: 50
collision: [internal/provision/]
---

# Implement bounded Linux account executor

## Goal
Implement ADR 0004's Linux HostExecutor for the existing journaled Writer in `internal/provision/`. Deliver a bounded, testable application slice, **not** a claim that first login or host activation works yet. Jari approved this smaller pre-merge gate on 2026-09-24: the test environment is where we learn how real account creation behaves, not something we must prove works before merging this slice.

## Acceptance Criteria
- [ ] Under the already-authorized immutable numeric GitHub subject, refuse an existing NSS name, UID, GID, group, home or allocation; never adopt/delete `alice`, `bob` or existing accounts. Bound command execution and identity/path checks; keep account, private home, binding config and ACL/socket/unit operations phase-specific. Reject drift on reuse, preserve pending journal on partial failure and never silently recover or reuse a UID.
- [ ] Focused tests cover safe identity/path checks, collisions, failed phases and no silent reuse. Inspect the final diff for obvious privilege or destructive-operation mistakes; one focused independent review is appropriate if these boundaries changed, but no repeated review loop or pre-merge guest certification. Record what was tested and what remains unknown in `result.md`.
- [ ] Run the repository's clean `./scripts/ci-local.sh --clean --json` gate on committed code before merging. A **JIT-specific guest demonstration is not a pre-merge criterion for this executor slice**. The later integration/test-environment step will run it with synthetic users, observe real NSS/home/ACL/systemd behavior, fix what fails and record results before live-person OAuth, ingress or pilot acceptance. Do not activate this draft on a host or use real credentials as part of this issue. Fleetrepo owns persistent host declarations; no ad-hoc host mutation. See `issues/prepare-login-pilot/plan.md` and ADR 0004.

## Decision — 2026-09-24
Jari approved merging a bounded testable slice without first building a comprehensive JIT guest harness. This changes this issue's delivery gate, not the later pilot's safety, identity-consent, ingress or live-test boundaries.
