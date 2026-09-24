---
created: 2026-09-24
updated: 2026-09-24
type: task
status: in-progress
priority: high
lane: auth-jit
lane_seq: 60
collision: [internal/provision/]
blocked_by: ['@implement-linux-executor']
---

# Package restricted root broker service

## Goal
Wire only the reviewed Writer.Handle to the restricted inherited UDS broker, and package a neutral root service contract. Do not activate it on a live host.

## Acceptance Criteria
- [ ] Configure strict root state and reviewed UID range; broker receives no OAuth token/network access and rejects wrong peer UID, unsafe paths, restart drift or missing handler. Reuse bounded context and socket transport, do not enable fixture listener.
- [ ] Supply service/socket templates and release/package verification; negative startup/restart, wrong-peer and symlink tests in a disposable guest. Record the exact neutral-to-private handoff for root-owned allowlist, ledger, ACL, boot ordering and approved UID pool with Fleetrepo `native-agent-hetzner-jit-broker`; do not declare or verify actual private values, mutate Fleetrepo or activate the host here. Fleetrepo's private JIT declaration requires this landed public contract first; actual integration and two-new-UID proof remain gated by `@prove-jit-guest-isolation` and the login pilot.
- [ ] Run `./scripts/ci-local.sh --clean --json` on clean committed tree, issue-specific guest tests and independent security review of final diff; record receipts and limitations in `result.md`. See `issues/prepare-login-pilot/plan.md`.
