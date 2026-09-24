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
Implement ADR 0004's Linux HostExecutor for the existing journaled Writer in `internal/provision/`. This is app code and disposable-guest proof, not host activation.

## Acceptance Criteria
- [ ] Under the already-authorized immutable numeric GitHub subject, fail if candidate NSS name, UID, GID, group, home or allocation collides; never adopt/delete `alice`, `bob` or existing accounts. Bound command execution and identity/path checks; make account, private home, root-owned binding config, ACL/socket/unit readiness phase-specific and verify existing binding drift before reuse. Preserve pending journal on partial failure; no blind recovery or UID reuse.
- [ ] Hermetic phase/fault/concurrency/context tests and private synthetic-UID guest checks for actual NSS/permissions; record exact scope and limits in `result.md`. Review security/privilege boundary independently after final diff.
- [ ] Run `./scripts/ci-local.sh --clean --json` on clean committed tree and relevant private guest checks. No credentials, ingress, production host or persistent Fleetrepo changes. See `issues/prepare-login-pilot/plan.md` and ADR 0004.
